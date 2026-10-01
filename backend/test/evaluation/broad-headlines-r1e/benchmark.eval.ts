/*
 * PUBLIC BETA HARDENING R1E — BROAD HEADLINES OFFLINE QUALITY BENCHMARK (evaluation only).
 *
 * CURRENT is the real pipeline: NewsService.topHeadlines (buildResponse: duplicate collapse,
 * provider order kept, country annotation) → AnalysisService broad branch → clusterDuplicateArticles
 * → first SLOTS → the model input. The "model" here only RECORDS the evidence it was handed; it
 * returns the repository's MockAnalysisProvider output, which is discarded. No provider, OpenAI or
 * database is contacted. Options A / B / C are applied to the SAME ordered, de-duplicated
 * candidate list CURRENT slices from. Option D = CURRENT evidence set (prompt-only, not executed).
 *
 *   R1E_OUT=<dir> npx jest -c test/evaluation/broad-headlines-r1e/jest.eval.config.js
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle, NewsResponse } from '@globalnews-ai/shared';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AnalysisService } from '../../../src/modules/analysis/service/analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../../../src/modules/analysis/interfaces';
import { AnalysisConfigService } from '../../../src/modules/analysis/config/analysis-config.service';
import { MockAnalysisProvider } from '../../../src/modules/analysis/providers/mock-analysis.provider';
import { NewsService } from '../../../src/modules/news/news.service';
import { CountryNewsService } from '../../../src/modules/news/country/country-news.service';
import type { NewsProvider } from '../../../src/modules/news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../../src/modules/news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../../src/modules/news/persistence/article-persistence.service';
import { classifyCategory } from '../../../src/modules/news/classification/classify-category.util';
import { detectArticleDomains } from '../../../src/modules/analysis/query/detect-analytical-domains.util';
import {
  clusterArticlesWithMembership,
  clusterDuplicateArticles,
} from '../../../src/modules/analysis/duplicates/cluster-articles.util';
import { resolvePublisherIdentity } from '../../../src/modules/news/identity/publisher-identity.util';
import {
  BUCKET_CAP,
  PUBLISHER_CAP,
  SLOTS,
  bucketOf,
  optionA,
  optionB,
  optionC1,
  optionC2,
  type ScoreBreakdown,
  type Selection,
} from './prototypes';

const HERE = __dirname;
const OUT = process.env.R1E_OUT ?? join(HERE, 'out');

interface Dataset {
  readonly id: string;
  readonly language: 'en' | 'pl';
  readonly label: string;
  readonly origin: 'FIXTURE' | 'REAL_CACHE_ONLY_SNAPSHOT';
  readonly nowMs: number;
  readonly articles: NewsArticle[];
  readonly auditKind: Map<string, string>;
}

type Row = [string, string, string, string, string, string, string];

function loadDatasets(): Dataset[] {
  const fixtures = JSON.parse(readFileSync(join(HERE, 'datasets', 'fixtures.json'), 'utf8')) as {
    nowIso: string;
    datasets: Array<{
      id: string;
      language: 'en' | 'pl';
      label: string;
      items?: Row[];
      reorderOf?: string;
      order?: string[];
    }>;
  };
  const nowMs = Date.parse(fixtures.nowIso);
  const byId = new Map<string, Row[]>();
  const out: Dataset[] = [];
  for (const d of fixtures.datasets) {
    const rows = d.items ?? d.order!.map((id) => byId.get(d.reorderOf!)!.find((r) => r[0] === id)!);
    if (d.items) byId.set(d.id, d.items);
    out.push({
      id: d.id,
      language: d.language,
      label: d.label,
      origin: 'FIXTURE',
      nowMs,
      auditKind: new Map(rows.map((r) => [r[0], r[1]])),
      articles: rows.map(([id, , title, summary, sourceName, url, publishedAt]) => ({
        id,
        title,
        summary,
        url,
        sourceId: sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sourceName,
        /* exactly what gnews.provider.ts:666 does for a top-headlines record */
        category: classifyCategory({ title, summary }),
        sourcesCount: 1,
        publishedAt,
        publishedAtBasis: 'publisher' as const,
        sourceLanguage: d.language,
        providerId: 'gnews',
      })),
    });
  }
  /* REAL cache-only snapshots (GET /news/top-headlines/retained), verbatim NewsResponse captures. */
  const realDir = join(HERE, 'datasets', 'real');
  if (existsSync(realDir)) {
    for (const file of readdirSync(realDir).filter((f) => f.endsWith('.json')).sort()) {
      const capture = JSON.parse(readFileSync(join(realDir, file), 'utf8')) as {
        capturedAt: string;
        language: 'en' | 'pl';
        limit: number;
        response: NewsResponse;
      };
      if ((capture.response.articles ?? []).length === 0) continue;
      out.push({
        id: `REAL-${capture.language.toUpperCase()}-${file.replace(/\.json$/, '')}`,
        language: capture.language,
        label: `Production cache-only snapshot (limit=${capture.limit}, lang=${capture.language}) captured ${capture.capturedAt}`,
        origin: 'REAL_CACHE_ONLY_SNAPSHOT',
        nowMs: Date.parse(capture.capturedAt),
        auditKind: new Map(),
        articles: capture.response.articles,
      });
    }
  }
  return out;
}

async function runCurrent(dataset: Dataset) {
  const provider = {
    id: 'gnews',
    displayName: 'gnews',
    isMock: false,
    capabilities: ['search', 'top-headlines'],
    search: async () => [],
    topHeadlines: async () => dataset.articles.map((a) => ({ ...a })),
    category: async () => [],
    health: async () => ({ providerId: 'gnews', displayName: 'gnews', status: 'ok', checkedAt: '' }),
  } as unknown as NewsProvider;
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: [provider] },
      { provide: ALL_NEWS_PROVIDERS, useValue: [provider] },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: [] },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const news = moduleRef.get(NewsService);
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const recorder: AnalysisProvider = {
    id: 'openai',
    displayName: 'evidence recorder (no model)',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      return mock.analyzeNews(input);
    },
  };
  const config = {
    get: () => ({
      maxArticles: SLOTS,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'none',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(news, moduleRef.get(CountryNewsService), recorder, config);
  /* the provider response exactly as the broad branch receives it (same call, then cache hit) */
  const response = await news.topHeadlines(20, { lang: dataset.language });
  await service.analyzeNews(
    dataset.language === 'en' ? 'Any global news can you share?' : 'Co się dzieje na świecie?',
    dataset.language,
    undefined,
    undefined,
    undefined,
    undefined,
    { broadHeadlines: true },
  );
  const sent = inputs[0]?.articles ?? [];
  const candidates = clusterDuplicateArticles([...response.articles]);
  const membership = clusterArticlesWithMembership([...response.articles]);
  const clusterSize = new Map<string, number>();
  for (const cluster of membership)
    for (const member of cluster.members) clusterSize.set(member.id, cluster.members.length);
  const reproduced =
    JSON.stringify(sent.map((a) => a.id)) ===
    JSON.stringify(candidates.slice(0, SLOTS).map((a) => a.id));
  return { response, candidates, sent, membership, clusterSize, reproduced, providerCalls: provider };
}

/* ── descriptive metrics (no quality score) ─────────────────────────────────────────────── */
interface Metrics {
  selected: number;
  dropped: number;
  distinctPublishers: number;
  maxPublisherShare: string;
  distinctCountries: number;
  categories: string;
  domains: string;
  buckets: string;
  unclassified: number;
  corroborated: number;
  oldest: string;
  newest: string;
  changedVsCurrent: number;
}

function dist(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${k}:${n}`)
    .join(' ');
}

function metricsOf(
  selected: NewsArticle[],
  candidates: NewsArticle[],
  current: NewsArticle[],
  clusterSize: Map<string, number>,
): Metrics {
  const publishers = selected.map((a) => resolvePublisherIdentity(a) ?? a.sourceName);
  const pubCounts = new Map<string, number>();
  for (const p of publishers) pubCounts.set(p, (pubCounts.get(p) ?? 0) + 1);
  const maxShare = selected.length === 0 ? 0 : Math.max(...pubCounts.values()) / selected.length;
  const times = selected.map((a) => a.publishedAt).sort();
  const currentIds = new Set(current.map((a) => a.id));
  return {
    selected: selected.length,
    dropped: candidates.length - selected.length,
    distinctPublishers: pubCounts.size,
    maxPublisherShare: `${Math.round(maxShare * 100)}%`,
    distinctCountries: new Set(selected.map((a) => a.countryCode).filter(Boolean)).size,
    categories: dist(selected.map((a) => a.category)),
    domains: dist(
      selected.flatMap((a) => {
        const d = [...detectArticleDomains({ title: a.title, summary: a.summary })];
        return d.length > 0 ? d : ['(none)'];
      }),
    ),
    buckets: dist(selected.map((a) => bucketOf(a).bucket)),
    unclassified: selected.filter((a) => bucketOf(a).bucket === 'UNCLASSIFIED').length,
    corroborated: selected.filter((a) => (clusterSize.get(a.id) ?? 1) > 1).length,
    oldest: times[0] ?? '',
    newest: times[times.length - 1] ?? '',
    changedVsCurrent: selected.filter((a) => !currentIds.has(a.id)).length,
  };
}

/* ── deterministic blind order (seeded by dataset id) ───────────────────────────────────── */
function seeded(id: string): () => number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h >>> 0) / 4294967296);
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

it('R1E broad-headlines offline benchmark', async () => {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, 'raw-inputs'), { recursive: true });
  const datasets = loadDatasets();
  const csv: string[] = [
    'dataset,language,origin,option,selected,dropped,distinct_publishers,max_publisher_share,distinct_countries,unclassified,corroborated,changed_vs_current,oldest,newest,categories,domains,buckets',
  ];
  const pipelineMd: string[] = [];
  const aMd: string[] = [];
  const bMd: string[] = [];
  const cMd: string[] = [];
  const blindMd: string[] = [];
  const keyMd: string[] = [];
  const langMd: Record<'en' | 'pl', string[]> = { en: [], pl: [] };
  const langStats: Record<'en' | 'pl', { items: number; world: number; noDomain: number; unclassified: number; inputs: number; afterCollapse: number; afterCluster: number }> = {
    en: { items: 0, world: 0, noDomain: 0, unclassified: 0, inputs: 0, afterCollapse: 0, afterCluster: 0 },
    pl: { items: 0, world: 0, noDomain: 0, unclassified: 0, inputs: 0, afterCollapse: 0, afterCluster: 0 },
  };
  const summary: Array<Record<string, unknown>> = [];

  for (const dataset of datasets) {
    writeFileSync(
      join(OUT, 'raw-inputs', `${dataset.id}.json`),
      JSON.stringify(
        {
          id: dataset.id,
          origin: dataset.origin,
          language: dataset.language,
          label: dataset.label,
          articles: dataset.articles.map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            url: a.url,
            sourceName: a.sourceName,
            publishedAt: a.publishedAt,
            publishedAtBasis: a.publishedAtBasis,
            category: a.category,
            countryCode: a.countryCode ?? null,
            sourceLanguage: a.sourceLanguage ?? null,
            auditKind: dataset.auditKind.get(a.id) ?? null,
          })),
        },
        null,
        2,
      ),
    );
    const run = await runCurrent(dataset);
    expect(run.reproduced).toBe(true);
    const cands = run.candidates;
    const current = run.sent;
    const a = optionA(cands);
    const b = optionB(cands, (id) => run.clusterSize.get(id) ?? 1, dataset.nowMs);
    const c1 = optionC1(cands);
    const c2 = optionC2(cands);
    const options: Array<[string, NewsArticle[]]> = [
      ['CURRENT', current],
      ['A', a.selected],
      ['B', b.selected],
      ['C1', c1.selected],
      ['C2', c2.selected],
    ];
    const kind = (x: NewsArticle) => dataset.auditKind.get(x.id) ?? '—';
    const line = (x: NewsArticle) =>
      `${esc(x.title)} — ${esc(x.sourceName)}${x.countryCode ? ` [${x.countryCode}]` : ''}`;

    /* ── CURRENT ── */
    const collapsedByProvider = dataset.articles.length - run.response.articles.length;
    const collapsedByCluster = run.response.articles.length - cands.length;
    pipelineMd.push(
      `## ${dataset.id} — ${dataset.label}`,
      `Origin: **${dataset.origin}** · language **${dataset.language}** · input ${dataset.articles.length} → after provider duplicate collapse ${run.response.articles.length} (−${collapsedByProvider}) → after clusterDuplicateArticles ${cands.length} (−${collapsedByCluster}) → **first ${SLOTS} sent** (${current.length}) · reproduced through the real pipeline: **${run.reproduced ? 'yes' : 'NO'}**`,
      '',
      '| Pos | Sent? | Title — publisher [country] | classifyCategory | Domains | Cluster size | Audit kind (fixture label) |',
      '|---|---|---|---|---|---|---|',
      ...cands.map((x, i) => {
        const doms = [...detectArticleDomains({ title: x.title, summary: x.summary })].join('+') || '—';
        return `| ${i + 1} | ${i < SLOTS ? 'SENT' : '**dropped (position)**'} | ${line(x)} | ${x.category} | ${doms} | ${run.clusterSize.get(x.id) ?? 1} | ${kind(x)} |`;
      }),
      ...(run.membership.filter((m) => m.members.length > 1).length > 0
        ? [
            '',
            `Clusters collapsed: ${run.membership
              .filter((m) => m.members.length > 1)
              .map((m) => m.members.map((x) => x.id).join(' ≡ '))
              .join('; ')}`,
          ]
        : []),
      '',
    );

    /* ── A ── */
    aMd.push(
      `## ${dataset.id} (${dataset.language})`,
      `Excluded by the narrow screen: ${Object.keys(a.notes).length === 0 ? '**none**' : Object.entries(a.notes).map(([id, n]) => `${id} (${n})`).join('; ')} · changed vs CURRENT: **${metricsOf(a.selected, cands, current, run.clusterSize).changedVsCurrent}**`,
      '',
      ...a.selected.map((x, i) => `${i + 1}. ${line(x)} — _${kind(x)}_`),
      '',
    );

    /* ── B ── */
    const comp = (s: ScoreBreakdown) =>
      `${s.analyticalDomains.value} (${s.analyticalDomains.detail}) | ${s.countryAttributed.value} (${s.countryAttributed.detail}) | ${s.sourceRole.value} (${s.sourceRole.detail}) | ${s.corroboration.value} | ${s.freshness.value} | ${s.storedConfidence.value} (${s.storedConfidence.detail}) | **${s.total}**`;
    bMd.push(
      `## ${dataset.id} (${dataset.language})`,
      `Changed vs CURRENT: **${metricsOf(b.selected, cands, current, run.clusterSize).changedVsCurrent}**`,
      '',
      '| Prov. pos | B rank | Title — publisher | Domains | Country | Source role | Corrob. | Fresh. | Stored conf. | Total | Selected? | Audit kind |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...cands.map((x, i) => {
        const rank = b.selected.findIndex((s) => s.id === x.id);
        return `| ${i + 1} | ${rank >= 0 ? rank + 1 : '—'} | ${line(x)} | ${comp(b.scores.get(x.id)!)} | ${rank >= 0 ? 'yes' : 'no'} | ${kind(x)} |`;
      }),
      '',
    );

    /* ── C ── */
    cMd.push(
      `## ${dataset.id} (${dataset.language})`,
      `C1 changed vs CURRENT: **${metricsOf(c1.selected, cands, current, run.clusterSize).changedVsCurrent}** · C2 changed vs CURRENT: **${metricsOf(c2.selected, cands, current, run.clusterSize).changedVsCurrent}**`,
      '',
      '| Prov. pos | Title — publisher | Bucket | Basis | C1 | C2 | Audit kind |',
      '|---|---|---|---|---|---|---|',
      ...cands.map((x, i) => {
        const bk = bucketOf(x);
        const in1 = c1.selected.findIndex((s) => s.id === x.id);
        const in2 = c2.selected.findIndex((s) => s.id === x.id);
        return `| ${i + 1} | ${line(x)} | ${bk.bucket} | ${esc(bk.basis)} | ${in1 >= 0 ? `slot ${in1 + 1}` : '—'}${c1.notes[x.id] ? ` · ${esc(c1.notes[x.id]!)}` : ''} | ${in2 >= 0 ? `slot ${in2 + 1}` : '—'}${c2.notes[x.id] ? ` · ${esc(c2.notes[x.id]!)}` : ''} | ${kind(x)} |`;
      }),
      '',
    );

    /* ── metrics ── */
    const perOption: Record<string, Metrics> = {};
    for (const [name, sel] of options) {
      const m = metricsOf(sel, cands, current, run.clusterSize);
      perOption[name] = m;
      csv.push(
        [
          dataset.id,
          dataset.language,
          dataset.origin,
          name,
          m.selected,
          m.dropped,
          m.distinctPublishers,
          m.maxPublisherShare,
          m.distinctCountries,
          m.unclassified,
          m.corroborated,
          m.changedVsCurrent,
          m.oldest,
          m.newest,
          `"${m.categories}"`,
          `"${m.domains}"`,
          `"${m.buckets}"`,
        ].join(','),
      );
    }
    csv.push(
      [dataset.id, dataset.language, dataset.origin, 'D (= CURRENT evidence set; not executed)', '', '', '', '', '', '', '', 0, '', '', '', '', ''].join(','),
    );

    /* ── language stats ── */
    const ls = langStats[dataset.language];
    ls.inputs += dataset.articles.length;
    ls.afterCollapse += run.response.articles.length;
    ls.afterCluster += cands.length;
    for (const x of cands) {
      ls.items += 1;
      if (x.category === 'world') ls.world += 1;
      if (detectArticleDomains({ title: x.title, summary: x.summary }).size === 0) ls.noDomain += 1;
      if (bucketOf(x).bucket === 'UNCLASSIFIED') ls.unclassified += 1;
    }
    langMd[dataset.language].push(
      `### ${dataset.id} — ${dataset.label}`,
      '| Option | Selected | Changed vs CURRENT | Publishers | Max publisher share | Countries | Unclassified | Buckets |',
      '|---|---|---|---|---|---|---|---|',
      ...options.map(([name]) => {
        const m = perOption[name]!;
        return `| ${name} | ${m.selected} | ${m.changedVsCurrent} | ${m.distinctPublishers} | ${m.maxPublisherShare} | ${m.distinctCountries} | ${m.unclassified} | ${m.buckets} |`;
      }),
      '',
    );

    /* ── blind pack (CURRENT, A, B, C1 → SET 1..4 in a seeded order) ── */
    const four: Array<[string, NewsArticle[]]> = options.filter(([n]) => n !== 'C2');
    const rnd = seeded(dataset.id);
    const order = four
      .map((entry) => ({ entry, k: rnd() }))
      .sort((x, y) => x.k - y.k)
      .map((x) => x.entry);
    blindMd.push(`## ${dataset.id} (${dataset.language === 'en' ? 'English' : 'Polish'})`, '');
    blindMd.push(
      '| # | SET 1 | SET 2 | SET 3 | SET 4 |',
      '|---|---|---|---|---|',
      ...Array.from({ length: SLOTS }, (_, i) =>
        `| ${i + 1} | ${order.map(([, sel]) => (sel[i] ? esc(sel[i]!.title) : '—')).join(' | ')} |`,
      ),
      '',
    );
    keyMd.push(
      `| ${dataset.id} | ${order.map(([name]) => (name === 'CURRENT' ? 'CURRENT (= D evidence)' : name === 'C1' ? 'C (C1)' : name)).join(' | ')} |`,
    );
    summary.push({
      dataset: dataset.id,
      language: dataset.language,
      origin: dataset.origin,
      inputs: dataset.articles.length,
      candidates: cands.length,
      sent: current.length,
      changed: Object.fromEntries(options.map(([n]) => [n, perOption[n]!.changedVsCurrent])),
      reproduced: run.reproduced,
    });
  }

  const header = (title: string, body: string[]) =>
    [`# ${title}`, '', 'Generated by `backend/test/evaluation/broad-headlines-r1e/benchmark.eval.ts` (evaluation only; no provider, model or database contacted).', '', ...body].join('\n') + '\n';

  writeFileSync(join(OUT, 'CURRENT-PIPELINE.md'), header('CURRENT — the accepted broad-headline selection, reproduced through the real pipeline', [
    `Pipeline: NewsService.topHeadlines (provider order kept; collapseDuplicateStories) → AnalysisService broad branch → clusterDuplicateArticles → first ${SLOTS} → model input (recorded, not executed). Every dataset asserts that the recorded model input equals the first ${SLOTS} de-duplicated candidates.`,
    '',
    ...pipelineMd,
  ]));
  writeFileSync(join(OUT, 'OPTION-A-RESULTS.md'), header('OPTION A — provider order + narrow unsuitability screen', [
    'Screen = the repository\'s only existing unsuitable-item detector: `containsUnresolvedTemplatePlaceholder` (article-metadata-hygiene.util.ts) on title or summary. No category, topic or publisher is excluded. Nothing else changes.',
    '',
    ...aMd,
  ]));
  writeFileSync(join(OUT, 'OPTION-B-RESULTS.md'), header('OPTION B — visible score from existing signals (UNVALIDATED equal-weight prototype)', [
    'Components (each an existing function; a missing signal contributes 0): analytical domains detected (`detectArticleDomains`, count) · country attributed (`resolvePrimaryCountry` via `resolveArticleCountries`, 0/1) · source role (`newsRoleOf`: WIRE_REPORTING or OFFICIAL_WEB = 1) · corroboration (cluster size − 1, `clusterArticlesWithMembership`) · freshness (`scoreArticleConfidence` with relevance 0 = the existing freshness bonus, ÷20) · stored confidence (÷100, retained rows only). Total = sum; ties keep provider order. Category and provider position are NOT components.',
    '',
    ...bMd,
  ]));
  writeFileSync(join(OUT, 'OPTION-C-RESULTS.md'), header('OPTION C — bounded diversity reservation', [
    `Buckets come only from repository labels (classifyCategory category; detectArticleDomains). The classifier default \`world\` with no domain = **UNCLASSIFIED** (not guessed). Bucket precedence when several labels apply: SECURITY (domain) › SPORTS › ENTERTAINMENT › TECHNOLOGY › ECONOMY › INFRASTRUCTURE › HEALTH_HUMANITARIAN › POLITICS_GOVERNANCE — a naming precedence, not an importance order (every bucket has the same cap).`,
    '',
    `**C1:** at most ${BUCKET_CAP} per classified bucket, at most ${PUBLISHER_CAP} per publisher (registrable domain, \`resolvePublisherIdentity\`), UNCLASSIFIED uncapped; fill in provider order; deferred items BACKFILL in provider order so no slot is left empty. **C2 (no bucket reservation can be safely made):** every item treated as UNCLASSIFIED — publisher cap only.`,
    '',
    ...cMd,
  ]));
  const langSection = (lang: 'en' | 'pl') => {
    const s = langStats[lang];
    const pct = (n: number) => (s.items === 0 ? '—' : `${Math.round((n / s.items) * 100)}%`);
    return header(`${lang === 'en' ? 'ENGLISH' : 'POLISH'} RESULTS`, [
      `Candidates evaluated: ${s.items} · inputs ${s.inputs} → after provider collapse ${s.afterCollapse} → after clustering ${s.afterCluster}`,
      '',
      `| Measure | Value |`,
      '|---|---|',
      `| classifyCategory fell to default \`world\` | ${s.world} (${pct(s.world)}) |`,
      `| No analytical domain detected | ${s.noDomain} (${pct(s.noDomain)}) |`,
      `| UNCLASSIFIED for Option C | ${s.unclassified} (${pct(s.unclassified)}) |`,
      '',
      ...langMd[lang],
    ]);
  };
  writeFileSync(join(OUT, 'EN-RESULTS.md'), langSection('en'));
  writeFileSync(join(OUT, 'PL-RESULTS.md'), langSection('pl'));
  writeFileSync(join(OUT, 'BLIND-COMPARISON.md'), header('BLIND COMPARISON — four evidence sets per dataset', [
    `Each column is the ${SLOTS} headlines one approach would hand the model, in order. Which approach produced which SET is in ANSWER-KEY.md — please judge before opening it. The SET order is shuffled per dataset. A fifth approach (D: prompt-only) uses exactly the same evidence as one of these sets and is not shown separately.`,
    '',
    ...blindMd,
  ]));
  writeFileSync(join(OUT, 'ANSWER-KEY.md'), header('ANSWER KEY — do not open before judging BLIND-COMPARISON.md', [
    '| Dataset | SET 1 | SET 2 | SET 3 | SET 4 |',
    '|---|---|---|---|---|',
    ...keyMd,
    '',
    'CURRENT = the accepted positional selection. OPTION D (prompt-only) is not executed; its evidence set is identical to CURRENT. C shown in the blind pack is C1 (bucket + publisher caps); C2 (publisher cap only) is in OPTION-C-RESULTS.md.',
  ]));
  writeFileSync(join(OUT, 'METRICS.csv'), csv.join('\n') + '\n');
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  expect(datasets.length).toBeGreaterThan(0);
});
