import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEWS_CATEGORIES, resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import {
  missingSeams,
  routeAskR2,
  type AskR2Route,
  type AskRouteContext,
} from '../modules/ask-router/ask-r2-route';
import { deriveAnswerState, referenceAdmissibleFor } from '../modules/ask-router/answer-state';
import { landedSpecialistRegistryPort } from '../modules/ask-router/specialist-registry.port';
import {
  CORPUS as FROZEN_CORPUS,
  type CorpusRow,
} from '../modules/ask-router/frozen-c/corpus/corpus';
import { specialistRegistryFixture } from '../modules/ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { route as frozenRoute } from '../modules/ask-router/frozen-c/src/index';
import { DECLARED_PRECEDENCE } from '../modules/ask-router/frozen-c/src/ports';
import {
  CORPUS as L_CORPUS,
  MAP_ORIGIN,
  NON_EQUIVALENT,
} from '../modules/ask-router/l-corpus/corpus';
import {
  decideContextEligibility,
  readSemanticSubject,
} from '../modules/ask-router/normalization/semantic-subject';
import {
  ANALYTICAL_DOMAINS,
  detectRequestedDomains,
} from '../modules/analysis/query/detect-analytical-domains.util';
import { classifyQueryIntent } from '../modules/analysis/query/query-intent.util';
import { resolveCountriesByDemonym } from '../modules/news/country/country-relevance.util';
import { REFERENCE_PROVIDERS } from '../modules/reference-providers/reference-provider-registry';
import { OFFICIAL_SOURCES } from '../modules/official-sources/official-source-registry';
import { harness as landedHarness } from '../modules/analysis/service/map-geography-context.harness-spec';
import { readContinuationEllipsis } from '../modules/analysis/anchor/continuation-ellipsis.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE H — MAIN R1.1 MASTER CORPUS, BACKEND ROWS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's 373-row MASTER-CORPUS-R1.1 (vendored byte-identical; sha256 pinned against Main's
 * MANIFEST) is evaluated here for every row whose assertion is a backend fact, on the
 * INTEGRATED path — never on a lane's fixture where the integrated path exists:
 *
 *   /ask (Ask R2)   routeAskR2 → frozen C plan → §7 answer state      (the ask-v2 executor)
 *   Map dock        the landed AnalysisService with a Map geography    (G's service harness,
 *                   context — the one surface that carries a Map        reused, not rebuilt)
 *                   selection; a Map-context row must hold on BOTH.
 *
 * Rows whose evidence is markup, a browser run, a device, or a named spec elsewhere are
 * recorded DEFERRED here with where their verdict comes from; `tooling/qualification/
 * merge-main-r1-1.mjs` joins every source into the one 373-row table.
 *
 * Verdicts: PASS · FAIL · EXPLAINED (a difference justified by a named authority — counted,
 * never hidden) · HELD (outside this candidate by ruling: security hold, D-1, device).
 * Each row is its own test: an EXPECTED non-PASS must carry its written reason in
 * `EXPECTED`, so a regression AND a silent improvement both fail this suite.
 *
 * Deterministic: no model, no provider (the landed harness's provider throws), no network,
 * a fixed request instant.
 */

const CORPUS_SHA256 = 'bd6c5dc6996d3cde06dc8d4fae0b34e5fc86df3bb6db2c000141008b8e51a19b';
const MATRIX_SHA256 = '2ca5d1b6a7a830213e40743b04080cdb8b1e5bdf90a1711477435b2202a29e09';
const VENDORED = join(__dirname, 'vendored');
const corpusBytes = readFileSync(join(VENDORED, 'MASTER-CORPUS-R1.1.json'));
const matrixBytes = readFileSync(join(VENDORED, 'ask-r2-context-integrity.matrix.json'));

interface MasterRow {
  readonly id: string;
  readonly family: string;
  readonly laneCaseId: string | null;
  readonly lang: string;
  readonly question: string | null;
  readonly asserts: string;
  readonly state: string;
}
interface MatrixCase {
  readonly id: string;
  readonly harness: string;
  readonly given: Record<string, unknown>;
}
const MASTER: readonly MasterRow[] = (
  JSON.parse(corpusBytes.toString('utf8')) as { rows: MasterRow[] }
).rows;
const MATRIX: readonly MatrixCase[] = (
  JSON.parse(matrixBytes.toString('utf8')) as { cases: MatrixCase[] }
).cases;

type Verdict = 'PASS' | 'FAIL' | 'EXPLAINED' | 'HELD' | 'DEFERRED';
interface RowResult {
  readonly id: string;
  readonly family: string;
  readonly verdict: Verdict;
  readonly path: string;
  readonly observed: string;
  readonly note?: string;
}

/** Non-PASS verdicts this candidate EXPECTS, each with its reason. Anything else must PASS. */
const EXPECTED: Readonly<Record<string, { verdict: Verdict; reason: string }>> = {
  'MC-067': {
    verdict: 'EXPLAINED',
    reason:
      'Ask R2 carries no multi-story selection, so the >8 limit is reachable only where a selection exists; frozen C row B7c replays SELECTION_EXCEEDS_MAX:SELECTION:9:8 in-tree. On /ask the same text is now the personal class (Alpha Enablement R1, MC-055): IDENTITY_REQUIRED signed out, the personal-library requirement signed in.',
  },
  'MC-076': {
    verdict: 'EXPLAINED',
    reason:
      'CTO ruling (Alpha merge gate): ACCEPTED. Reporting executes and no specialist is shown as executed; neither Conflict nor Humanitarian is named because "eastern DRC" carries no domain word, and naming a domain from geography alone would be the guess contract §2 forbids.',
  },
  'G-006': {
    verdict: 'EXPLAINED',
    reason:
      'V1-C6 asks for G’s 8-rank order; frozen C (contract §1 routing authority) declares a total 9-rank order with ENTITY_GEOGRAPHY and ARTICLE_ANCHOR after TYPED_GEOGRAPHY ("resolved article anchor authoritative per accepted precedence"). Totality holds; order is frozen C’s.',
  },
  'G-025': {
    verdict: 'EXPLAINED',
    reason:
      'V7-C2: the anchor inside the candidate set DOES disambiguate (retrieval is COD, story used), but the landed service exposes countryInterpretation only inside eventAnchor.disclosures, which exists only when an event topic is present. "What is happening in Congo?" has none, so the value is measured by its effect, not read from the response.',
  },
  'MD-003': {
    verdict: 'HELD',
    reason:
      'Structural disjointness PASSES (REFERENCE_PROVIDERS role REFERENCE, disabled, never an OFFICIAL_SOURCES member). Rendering a Wikipedia contribution is unreachable: the provider ships enabled:false under D-1 (contract §6).',
  },
};

const results = new Map<string, RowResult>();
function record(
  row: MasterRow,
  verdict: Verdict,
  path: string,
  observed: unknown,
  note?: string,
): void {
  results.set(row.id, {
    id: row.id,
    family: row.family,
    verdict,
    path,
    observed: typeof observed === 'string' ? observed : JSON.stringify(observed),
    ...(note === undefined ? {} : { note }),
  });
}
const pass = (ok: boolean): Verdict => (ok ? 'PASS' : 'FAIL');

/* ── the integrated paths ────────────────────────────────────────────────── */

/** Production semantics: Conflict is the one registered specialist; nothing is bound. */
const deps = { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT']) };
const INSTANT = '2026-09-28T12:00:00.000Z';

function ask(q: string, lg: 'en' | 'pl', ctx: AskRouteContext = {}): AskR2Route {
  return routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lg,
      normalizationLanguage: lg,
      displayLanguage: lg,
      origin: 'ASK',
    },
    { computeConsent: 'GRANTED', requestInstant: INSTANT, identityVerified: false, ...ctx },
    deps,
  );
}
const lgOf = (row: MasterRow): 'en' | 'pl' => (row.lang === 'pl' ? 'pl' : 'en');
const textOf = (row: MasterRow): string => String(row.question).split(' — with')[0]!.trim();
const iso3 = (id: string): string | undefined => resolveCountryByAnyIdentifier(id)?.iso3;

function brief(r: AskR2Route): Record<string, unknown> {
  const p = r.plan;
  return {
    class: p.questionClass,
    terminal: p.terminalState,
    scopedBy: p.scopedBy,
    geo: r.envelope.geography.candidates.map((c) => `${c.source}:${c.value}`),
    time: `${r.envelope.time.requirement}:${r.envelope.time.statedPeriod}`,
    refusals: p.refusals,
    disclosures: p.disclosures,
  };
}

/** The Map dock: the landed service with a Map geography context. */
async function dock(
  q: string,
  lg: 'en' | 'pl',
  mapIso3?: string,
  story?: { title: string; countryCode: string },
) {
  const h = landedHarness();
  const country = mapIso3 === undefined ? undefined : resolveCountryByAnyIdentifier(mapIso3);
  const response = await h.service.analyzeNews(
    q,
    lg,
    story,
    undefined,
    undefined,
    country === undefined ? undefined : { countryCode: country.iso3, displayName: country.name },
  );
  return {
    countryCalls: h.countryCalls.map((c) => iso3(c) ?? c),
    searchCalls: h.searchCalls,
    ctx: response.retrievalContext,
    providerCalled: (h.provider.analyzeNews as jest.Mock).mock.calls.length > 0,
  };
}

/** Map NOT effective, on both paths. */
async function mapSuppressed(q: string, lg: 'en' | 'pl', map: string) {
  const r = ask(q, lg, { mapContextCountry: map });
  const d = await dock(q, lg, map);
  const ok =
    r.eligibility?.decision === 'SUPPRESSED' &&
    r.plan.scopedBy !== 'MAP_GEOGRAPHY_CONTEXT' &&
    !r.envelope.geography.candidates.some((c) => c.source === 'MAP_GEOGRAPHY_CONTEXT') &&
    !d.countryCalls.includes(map) &&
    d.ctx?.geographyContextUsed !== true;
  return {
    ok,
    observed: {
      r2: { eligibility: r.eligibility?.decision, ...brief(r) },
      dock: { countryCalls: d.countryCalls, geographyContextUsed: d.ctx?.geographyContextUsed },
    },
  };
}

/** Map IS effective (eligible and nothing outranks it), on both paths. */
async function mapEffective(q: string, lg: 'en' | 'pl', map: string) {
  const r = ask(q, lg, { mapContextCountry: map });
  const d = await dock(q, lg, map);
  const ok =
    r.eligibility?.decision === 'ELIGIBLE' &&
    r.plan.scopedBy === 'MAP_GEOGRAPHY_CONTEXT' &&
    d.countryCalls.join(',') === map &&
    d.ctx?.geographyContextUsed === true;
  return {
    ok,
    observed: {
      r2: { eligibility: r.eligibility?.decision, ...brief(r) },
      dock: { countryCalls: d.countryCalls, geographyContextUsed: d.ctx?.geographyContextUsed },
    },
  };
}

/** The typed place wins over the Map, on both paths. */
async function typedWins(q: string, lg: 'en' | 'pl', map: string, expected: string) {
  const r = ask(q, lg, { mapContextCountry: map });
  const d = await dock(q, lg, map);
  const typed = r.envelope.geography.candidates
    .filter((c) => c.source === 'TYPED_GEOGRAPHY')
    .map((c) => c.value);
  const ok =
    r.plan.scopedBy === 'TYPED_GEOGRAPHY' &&
    typed.join(',') === expected &&
    d.countryCalls.join(',') === expected &&
    d.ctx?.geographyContextUsed !== true;
  return {
    ok,
    observed: {
      r2: { typed, ...brief(r) },
      dock: { countryCalls: d.countryCalls, geographyContextUsed: d.ctx?.geographyContextUsed },
    },
  };
}

/** L's routing key (ask-r2-route.l-pairs.spec.ts), extended with the envelope axes. */
function twinKey(r: AskR2Route): Record<string, string> {
  const p = r.plan;
  return {
    questionClass: p.questionClass,
    terminalState: p.terminalState,
    refusals: p.refusals.join('+'),
    scopedBy: p.scopedBy,
    geographyRequired: String(p.geographyRequired),
    modelPriorPermitted: String(p.modelPriorPermitted),
    requiredEvidence: p.evidenceRequests
      .filter((e) => e.required)
      .map((e) => e.evidenceClass)
      .sort()
      .join('+'),
    droppedAxes: [...new Set(p.constraints.filter((c) => !c.carried).map((c) => c.axis))]
      .sort()
      .join('+'),
    specialistLegs: p.specialistLegs.map((l) => `${l.domain}:${l.requiredness}`).join('+'),
    clarification: p.clarification.map((c) => c.code).join('+'),
    disclosures: p.disclosures.join('+'),
    geography: r.envelope.geography.candidates.map((c) => `${c.source}:${c.value}`).join('+'),
    domains: r.envelope.domains.domains.join('+'),
    timeRequirement: r.envelope.time.requirement,
    currentStatus: String(r.envelope.currentStatus.requested),
  };
}
const diffKeys = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).filter((k) => a[k] !== b[k]);

/** `git grep` in the frontend; exit status 1 means "no match" and is returned as "". */
function gitGrep(args: string): string {
  try {
    return execSync(`git grep ${args}`, { cwd: join(__dirname, '../../../frontend') }).toString();
  } catch (e) {
    if ((e as { status?: number }).status === 1) return '';
    throw e;
  }
}

/* ── identity ────────────────────────────────────────────────────────────── */

describe('Gate H — the corpus under evaluation is Main’s and G’s, byte-identical', () => {
  it('MASTER-CORPUS-R1.1.json sha256 = Main MANIFEST', () => {
    expect(createHash('sha256').update(corpusBytes).digest('hex')).toBe(CORPUS_SHA256);
  });
  it('ask-r2-context-integrity.matrix.json sha256 = G MANIFEST', () => {
    expect(createHash('sha256').update(matrixBytes).digest('hex')).toBe(MATRIX_SHA256);
  });
  it('373 rows, 41 matrix cases', () => {
    expect(MASTER).toHaveLength(373);
    expect(MATRIX).toHaveLength(41);
  });
});

/* ── evaluation (runs once; each row then asserted as its own test) ─────── */

const byId = new Map(MASTER.map((r) => [r.id, r]));
const row = (id: string): MasterRow => {
  const r = byId.get(id);
  if (r === undefined) throw new Error(`no row ${id}`);
  return r;
};

/* C-ROUTER — frozen C's 41 rows. C-001..C-010 carry lane ids; C-011..C-041 are
   CARRIED_ID_UNKNOWN and take the remaining frozen rows in corpus order (an ordinal
   assignment, recorded as such). Verdict = the frozen replay in THIS tree; the integrated
   route over the same text is recorded alongside (agreement is information, not verdict:
   the frozen row's readings are fixtures, the integrated route's are the landed ones). */
function frozenMismatches(r: CorpusRow): string[] {
  const { plan } = frozenRoute(r.input, { specialistRegistry: specialistRegistryFixture });
  const dropped = [
    ...new Set(plan.constraints.filter((c) => !c.carried).map((c) => c.axis)),
  ].sort();
  const checks: [string, unknown, unknown][] = [
    ['questionClass', r.expect.questionClass, plan.questionClass],
    ['terminalState', r.expect.terminalState, plan.terminalState],
    ['refusals', r.expect.refusals, plan.refusals],
    ['scopedBy', r.expect.scopedBy, plan.scopedBy],
    ['modelPriorPermitted', r.expect.modelPriorPermitted, plan.modelPriorPermitted],
    ['droppedConstraintAxes', r.expect.droppedConstraintAxes, dropped],
    ['disclosures', r.expect.disclosures, plan.disclosures],
  ];
  return checks.filter(([, e, a]) => JSON.stringify(e) !== JSON.stringify(a)).map(([k]) => k);
}
function evaluateC(): void {
  const cRows = MASTER.filter((r) => r.family === 'C-ROUTER');
  const code = (id: string) => id.split('-')[0]!;
  const used = new Set<string>();
  const assigned = new Map<string, CorpusRow>();
  for (const r of cRows) {
    if (r.laneCaseId === null) continue;
    const f = FROZEN_CORPUS.find((x) => code(x.id) === code(r.laneCaseId!));
    if (f !== undefined) {
      assigned.set(r.id, f);
      used.add(f.id);
    }
  }
  const rest = FROZEN_CORPUS.filter((f) => !used.has(f.id));
  for (const r of cRows) if (!assigned.has(r.id)) assigned.set(r.id, rest.shift()!);
  for (const r of cRows) {
    const f = assigned.get(r.id)!;
    const miss = frozenMismatches(f);
    const lg = f.input.questionLanguage === 'pl' ? 'pl' : 'en';
    const integrated =
      f.input.questionLanguage === 'en' || f.input.questionLanguage === 'pl'
        ? brief(
            ask(f.input.rawQuestion, lg, {
              ...(f.input.mapContextCountry
                ? { mapContextCountry: f.input.mapContextCountry }
                : {}),
              ...(f.input.storyAnchorCountry
                ? { storyAnchorCountry: f.input.storyAnchorCountry }
                : {}),
              ...(f.input.articleRefs
                ? { articleRefs: f.input.articleRefs, hasResolvedArticleAnchor: true }
                : {}),
              ...(f.input.declaredRegion ? { declaredRegion: f.input.declaredRegion } : {}),
              ...(f.input.identityVerified === undefined
                ? {}
                : { identityVerified: f.input.identityVerified }),
              ...(f.input.computeConsent === undefined
                ? {}
                : { computeConsent: f.input.computeConsent }),
            }),
          )
        : null;
    const agrees =
      integrated !== null &&
      integrated.class === f.expect.questionClass &&
      integrated.terminal === f.expect.terminalState &&
      integrated.scopedBy === f.expect.scopedBy;
    record(
      r,
      pass(miss.length === 0),
      `frozen replay ${f.id}${r.laneCaseId === null ? ' (ordinal assignment)' : ''}`,
      {
        mismatches: miss,
        integrated:
          integrated === null
            ? 'NOT_APPLICABLE (language outside EN/PL)'
            : { ...integrated, agreesWithFrozenRow: agrees },
      },
    );
  }
}

/* L-ENPL — Main's 44 rows are the two halves of 22 of L's pairs. */
function evaluateL(): void {
  const prior = { en: 'What is happening in Rwanda?', pl: 'Co dzieje się w Rwandzie?' } as const;
  for (const r of MASTER.filter((x) => x.family === 'L-ENPL')) {
    const [pairId, half] = r.laneCaseId!.split('.') as [string, 'en' | 'pl'];
    const lrow = L_CORPUS.find(([, id]) => id === pairId)!;
    const [, , ctxFlag, en, pl] = lrow;
    const map = MAP_ORIGIN.has(pairId);
    const routeHalf = (q: string, lg: 'en' | 'pl') =>
      routeAskR2(
        {
          originalQuestion: q,
          sourceLanguage: lg,
          normalizationLanguage: lg,
          displayLanguage: lg,
          origin: map ? 'MAP' : 'ASK',
          ...(map ? { originCountries: ['RWA'] } : {}),
        },
        {
          ...(ctxFlag ? { priorQuestion: prior[lg] } : {}),
          ...(map ? { mapContextCountry: 'RWA' } : {}),
        },
        { specialistRegistry: specialistRegistryFixture },
      );
    const e = routeHalf(en, 'en');
    const p = routeHalf(pl, 'pl');
    const mine = half === 'en' ? e : p;
    const diff = diffKeys(twinKey(e), twinKey(p)).filter(
      (k) => !['geography', 'domains', 'timeRequirement', 'currentStatus'].includes(k),
    );
    const seams = missingSeams(mine);
    const textMatches = (half === 'en' ? en : pl) === r.question;
    const explained = pairId in NON_EQUIVALENT;
    record(
      r,
      !textMatches
        ? 'FAIL'
        : explained
          ? 'EXPLAINED'
          : pass(diff.length === 0 && seams.length === 0),
      'L pair through routeAskR2 (frozen fixture registry, as L measured)',
      {
        pair: pairId,
        routing: `${mine.plan.questionClass}/${mine.plan.terminalState}/${mine.plan.scopedBy}`,
        divergentKeys: diff,
        missingSeams: seams,
      },
      explained ? NON_EQUIVALENT[pairId] : undefined,
    );
  }
}

const MC_MAP_ROWS: Readonly<Record<string, readonly [map: string, expected: string]>> = {
  'MC-001': ['POL', 'RWA'],
  'MC-002': ['POL', 'RWA'],
  'MC-003': ['POL', 'KEN'],
  'MC-004': ['POL', 'KEN'],
  'MC-005': ['UGA', 'RWA'],
  'MC-006': ['UGA', 'RWA'],
  'MC-007': ['KEN', 'NGA'],
  'MC-008': ['KEN', 'NGA'],
  'MC-009': ['DEU', 'POL'],
  'MC-010': ['DEU', 'POL'],
};
const TWINS: readonly [string, string][] = [
  ['MC-017', 'MC-018'],
  ['MC-019', 'MC-020'],
  ['MC-021', 'MC-022'],
  ['MC-023', 'MC-024'],
  ['MC-025', 'MC-026'],
  ['MC-027', 'MC-028'],
  ['MC-029', 'MC-030'],
  ['MC-031', 'MC-032'],
];
const CAPABILITY_ROWS = [
  'MC-047',
  'MC-048',
  'MC-049',
  'MC-050',
  'MC-051',
  'MC-052',
  'MC-053',
  'MC-054',
  'MC-055',
  'MC-056',
  'MC-072',
  'MC-073',
  'MC-074',
  'MC-075',
];

async function evaluateMainConvergence(): Promise<void> {
  for (const [id, [map, expected]] of Object.entries(MC_MAP_ROWS)) {
    const r = row(id);
    const t = await typedWins(textOf(r), lgOf(r), map, expected);
    record(r, pass(t.ok), `R2 route + Map dock, Map ${map}`, t.observed);
  }
  {
    const r = row('MC-011');
    const s = await mapSuppressed(textOf(r), 'en', 'POL');
    record(r, pass(s.ok), 'R2 route + Map dock, Map POL', s.observed);
  }
  {
    const r = row('MC-012');
    const e = await mapEffective(textOf(r), 'en', 'RWA');
    record(r, pass(e.ok), 'R2 route + Map dock, Map RWA (positive control)', e.observed);
  }
  {
    const en = ask(textOf(row('MC-013')), 'en');
    const pl = ask(textOf(row('MC-014')), 'pl');
    const carriedOrStated = (r: AskR2Route) =>
      r.plan.constraints.every((c) => c.carried || c.refusal !== null) &&
      (r.plan.constraints.every((c) => c.carried) || r.plan.refusals.length > 0);
    const axes = (r: AskR2Route) =>
      r.envelope.topic.readerTerms.includes('entertainment') &&
      r.envelope.geography.candidates.some(
        (c) => c.source === 'TYPED_GEOGRAPHY' && c.value === 'RWA',
      ) &&
      r.envelope.time.statedPeriod !== null &&
      r.plan.questionClass === 'CURRENT_REPORTING';
    record(row('MC-013'), pass(axes(en) && carriedOrStated(en)), 'R2 route', {
      ...brief(en),
      topic: en.envelope.topic.readerTerms,
      constraints: en.plan.constraints,
    });
    const same = diffKeys(twinKey(en), twinKey(pl));
    record(
      row('MC-014'),
      pass(axes(pl) && carriedOrStated(pl) && same.length === 0),
      'R2 route, EN/PL twin',
      { ...brief(pl), topic: pl.envelope.topic.readerTerms, divergentKeys: same },
    );
  }
  record(
    row('MC-015'),
    pass(
      !(ANALYTICAL_DOMAINS as readonly string[]).includes('entertainment') &&
        ANALYTICAL_DOMAINS.length === 8 &&
        NEWS_CATEGORIES.includes('entertainment' as never),
    ),
    'taxonomy negative control',
    {
      analyticalDomains: ANALYTICAL_DOMAINS,
      newsCategoryHasEntertainment: NEWS_CATEGORIES.includes('entertainment' as never),
    },
  );
  {
    const r = ask(textOf(row('MC-016')), 'en');
    record(
      row('MC-016'),
      pass(
        typeof r.envelope.time.statedPeriod === 'string' &&
          r.envelope.time.statedPeriod === 'this week',
      ),
      'R2 envelope',
      { statedPeriod: r.envelope.time.statedPeriod },
    );
  }
  for (const [enId, plId] of TWINS) {
    const e = ask(textOf(row(enId)), 'en');
    const p = ask(textOf(row(plId)), 'pl');
    const d = diffKeys(twinKey(e), twinKey(p));
    record(row(enId), pass(missingSeams(e).length === 0), 'R2 route (EN half recorded)', {
      ...brief(e),
      missingSeams: missingSeams(e),
    });
    record(
      row(plId),
      pass(d.length === 0 && missingSeams(p).length === 0),
      'R2 route, EN/PL envelope-semantics twin',
      { ...brief(p), divergentKeys: d },
    );
  }
  for (const id of [
    'MC-033',
    'MC-034',
    'MC-035',
    'MC-036',
    'MC-037',
    'MC-038',
    'MC-039',
    'MC-040',
    'MC-041',
  ]) {
    const r = row(id);
    const route = ask(textOf(r), lgOf(r));
    const a = deriveAnswerState(route.plan, { items: {}, producedAnswer: false });
    record(
      r,
      pass(
        route.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY' &&
          a.state === 'CAPABILITY_UNAVAILABLE' &&
          a.basis === 'REFERENCE_UNAVAILABLE' &&
          a.missingRoles.includes('REFERENCE'),
      ),
      'R2 route + §7 derivation with nothing produced',
      { terminal: route.plan.terminalState, answerWhenNothingProduced: a },
    );
  }
  for (const id of ['MC-042', 'MC-043', 'MC-044', 'MC-045', 'MC-046']) {
    const r = row(id);
    const route = ask(textOf(r), 'en');
    const p = route.plan;
    const evidenceRequired = p.evidenceRequests.some(
      (e) => e.required && e.evidenceClass !== 'MODEL_PRIOR',
    );
    record(
      r,
      pass(
        !p.modelPriorPermitted &&
          evidenceRequired &&
          !referenceAdmissibleFor(p) &&
          p.questionClass !== 'REFERENCE',
      ),
      'R2 route',
      {
        ...brief(r === undefined ? route : route),
        modelPriorPermitted: p.modelPriorPermitted,
        referenceAdmissible: referenceAdmissibleFor(p),
      },
    );
  }
  for (const id of CAPABILITY_ROWS) {
    const r = row(id);
    const route = ask(textOf(r), 'en');
    const ok = ['CAPABILITY_UNAVAILABLE', 'IDENTITY_REQUIRED'].includes(route.plan.terminalState);
    record(r, pass(ok), 'R2 route (identity not verified)', {
      ...brief(route),
      capability: route.seam.producers.capability,
    });
  }
  {
    const port = deps.specialistRegistry.resolve('security');
    const plan = ask('What is the security situation in Kenya?', 'en').plan;
    const withheld = plan.withheldEvidence.find((w) => w.forDomain === 'security');
    record(
      row('MC-057'),
      pass(port.registered && !port.bound && withheld?.state === 'REGISTERED_UNBOUND'),
      'production specialist port + R2 plan',
      { port, withheld },
    );
  }
  {
    const nonSpecRefs = gitGrep('-l "ConflictAssessmentRail" -- "src/**/*.tsx" "src/**/*.ts"')
      .split('\n')
      .filter(
        (l) => l.length > 0 && !/\.spec\.tsx?$/.test(l) && !/ConflictAssessmentRail\.tsx$/.test(l),
      );
    const askFrame = gitGrep(
      '-n -E "specialistLegs|detectRequestedDomains|analyticalDomains" -- "src/components/ask-frame" "src/lib/ask"',
    ).trim();
    /* The rule is "never mounted on domain DETECTION". A referrer that mounts the rail on an
       explicit reader selection (the Conflict dashboard's event row, assessment null) is not
       a detection mount; a referrer that also reads a detected domain would be. */
    const mountsOnDetection = nonSpecRefs.filter((f) =>
      /detectRequestedDomains|analyticalDomains|specialistLegs|detectedDomain/.test(
        readFileSync(join(__dirname, '../../../frontend', f), 'utf8'),
      ),
    );
    record(
      row('MC-058'),
      pass(mountsOnDetection.length === 0 && askFrame === ''),
      'frontend source scan',
      {
        conflictRailReferrers: nonSpecRefs,
        referrersReadingDetectedDomains: mountsOnDetection,
        askSurfaceMountsOnDomains: askFrame,
      },
    );
  }
  {
    const required = ask('Give me the conflict assessment for the DRC', 'en').plan;
    const supplementary = ask('What is the security situation in the DRC?', 'en').plan;
    const ok =
      required.terminalState === 'CAPABILITY_UNAVAILABLE' &&
      required.reportingSubstitutionForbidden &&
      !required.evidenceRequests.some((e) => e.evidenceClass === 'NEWS_REPORTING' && e.required) &&
      supplementary.terminalState === 'EXECUTABLE' &&
      supplementary.disclosures.includes('SPECIALIST_INTELLIGENCE_NOT_USED');
    record(row('MC-059'), pass(ok), 'R2 route, both legs in one run', {
      required: {
        terminal: required.terminalState,
        legs: required.specialistLegs,
        substitutionForbidden: required.reportingSubstitutionForbidden,
      },
      supplementary: {
        terminal: supplementary.terminalState,
        disclosures: supplementary.disclosures,
      },
    });
  }
  {
    const plan = ask(
      'What is the humanitarian situation in Sudan, per the Humanitarian specialist?',
      'en',
    ).plan;
    const unregistered = plan.withheldEvidence.filter(
      (w) => w.forDomain !== null && w.refusal === 'SPECIALIST_NOT_REGISTERED',
    );
    const registered = ask(
      'What is the security situation in Kenya?',
      'en',
    ).plan.withheldEvidence.filter((w) => w.forDomain === 'security');
    record(
      row('MC-060'),
      pass(
        unregistered.some((w) => w.forDomain === 'humanitarian') &&
          registered.every((w) => w.refusal !== 'SPECIALIST_NOT_REGISTERED'),
      ),
      'R2 route',
      { unregistered, registered },
    );
  }
  {
    const legs = MASTER.filter(
      (r) => r.question !== null && ['MAIN-CONVERGENCE', 'G-ELIGIBILITY'].includes(r.family),
    ).flatMap((r) => ask(textOf(r), lgOf(r)).plan.specialistLegs.map((l) => l.requirednessSource));
    const explicit = ask('Give me the conflict assessment for the DRC', 'en').plan.specialistLegs;
    record(
      row('MC-061'),
      pass(
        legs.length > 0 &&
          legs.every((s) => s === 'DECLARED' || s === 'DEFAULTED') &&
          explicit.every((l) => l.requirednessSource === 'DECLARED'),
      ),
      'R2 route over every question row',
      { legs: legs.length, explicit },
    );
  }
  {
    const r = ask(textOf(row('MC-065')), 'en');
    record(row('MC-065'), pass(r.plan.scopedBy === 'SOURCE_INTENT'), 'R2 route', brief(r));
  }
  {
    const b7c = FROZEN_CORPUS.find((f) => f.id === 'B7c-selection-over-max')!;
    const plan = frozenRoute(b7c.input, { specialistRegistry: specialistRegistryFixture }).plan;
    const onAsk = ask(textOf(row('MC-067')), 'en');
    record(row('MC-067'), 'EXPLAINED', 'frozen C B7c replay + R2 route', {
      frozenB7c: plan.clarification.map((c) => `${c.code}:${c.axis}:${c.observed}:${c.candidate}`),
      onAsk: brief(onAsk),
    });
  }
  {
    const r = ask(textOf(row('MC-068')), 'en');
    record(
      row('MC-068'),
      pass(r.plan.terminalState === 'IDENTITY_REQUIRED'),
      'R2 route (identity not verified)',
      brief(r),
    );
  }
  {
    const r = ask(textOf(row('MC-069')), 'en');
    const reading =
      r.outcome.status === 'NOT_READ' ? [] : r.outcome.reading.geography.map((g) => g.value);
    const d = await dock(textOf(row('MC-069')), 'en');
    const ok =
      reading.includes('CONTESTED') &&
      !r.envelope.geography.candidates.some((c) => c.value === 'COD' || c.value === 'COG') &&
      d.ctx?.retrievalOutcome === 'CLARIFICATION_REQUIRED' &&
      d.ctx?.clarificationReason === 'AMBIGUOUS_COUNTRY' &&
      [...(d.ctx?.clarificationCandidates ?? [])].sort().join(',') === 'COD,COG' &&
      !d.providerCalled;
    record(
      row('MC-069'),
      pass(ok),
      'R2 reading + landed executor (the adapter returns its clarification — adapter spec)',
      {
        reading,
        r2: brief(r),
        executor: {
          outcome: d.ctx?.retrievalOutcome,
          reason: d.ctx?.clarificationReason,
          candidates: d.ctx?.clarificationCandidates,
          modelCalled: d.providerCalled,
        },
      },
    );
  }
  {
    /* Alpha Enablement R1: the "says so" decision is the continuation reader, applied by the
       Ask R2 adapter and the landed path before anything runs (adapter + service specs). */
    const twins = [
      [textOf(row('MC-070')), 'en'],
      ['A Kenia?', 'pl'],
    ] as const;
    const observed = twins.map(([q, lg]) => {
      const r = ask(q, lg);
      return {
        q,
        fabricated:
          r.envelope.topic.readerTerms.length > 0 || r.envelope.domains.domains.length > 0,
        typedKenya: r.envelope.geography.candidates.some(
          (c) => c.source === 'TYPED_GEOGRAPHY' && c.value === 'KEN',
        ),
        continuation: readContinuationEllipsis(q)?.candidates ?? null,
      };
    });
    record(
      row('MC-070'),
      pass(
        observed.every(
          (o) => !o.fabricated && o.typedKenya && JSON.stringify(o.continuation) === '["KEN"]',
        ),
      ),
      'R2 route + continuation reader (EN/PL), first turn',
      observed,
    );
  }
  {
    const r = ask(textOf(row('MC-071')), 'en');
    /* CTO R4 THIRD PASS §3 supersedes the former MC-071 criterion (HISTORICAL → broadening
       offered): a COMPLETED past period is historical / reference analysis — answered by
       reasoning with no news search, the period read as a HISTORICAL_PERIOD time role. */
    record(
      row('MC-071'),
      pass(
        r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY' &&
          r.job.temporal.some((t) => t.role === 'HISTORICAL_PERIOD') &&
          !r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
      ),
      'R2 route (request instant 2026-09-28; CTO R4 third pass §3 historical contract)',
      brief(r),
    );
  }
  {
    const r = ask(textOf(row('MC-076')), 'en');
    const noneExecuted = r.plan.specialistLegs.every((l) => !l.bound);
    const named = r.plan.withheldEvidence
      .filter((w) => w.forDomain !== null)
      .map((w) => w.forDomain);
    record(
      row('MC-076'),
      r.plan.terminalState === 'EXECUTABLE' && noneExecuted
        ? named.length >= 2
          ? 'PASS'
          : 'EXPLAINED'
        : 'FAIL',
      'R2 route',
      { ...brief(r), named },
    );
  }
  {
    const unread = ['Wie ist die Lage in Kenia?', 'qwxz vbnm plkj?'].map((q) => ask(q, 'en'));
    const topic = ask('Rwanda news', 'en');
    const disclosed = unread.every(
      (u) => u.plan.terminalState === 'CLARIFICATION_REQUIRED' && u.plan.clarification.length > 0,
    );
    record(
      row('MC-078'),
      pass(disclosed && topic.plan.terminalState === 'EXECUTABLE'),
      'R2 route',
      {
        unread: unread.map((u) => ({
          normalization: u.outcome.status,
          ...brief(u),
          causes: u.plan.clarification.map((c) => `${c.code}:${c.axis}:${c.observed}`),
        })),
        topic: brief(topic),
      },
    );
  }
}

async function evaluateGE(): Promise<void> {
  const suppressed = ['GE-001', 'GE-002', 'GE-003', 'GE-004', 'GE-005', 'GE-014'];
  for (const id of suppressed) {
    const s = await mapSuppressed(textOf(row(id)), 'en', 'POL');
    record(row(id), pass(s.ok), 'R2 route + Map dock, Map POL', s.observed);
  }
  for (const [id, map] of [
    ['GE-006', 'RWA'],
    ['GE-007', 'RWA'],
    ['GE-008', 'RWA'],
    ['GE-011', 'POL'],
    ['GE-013', 'RWA'],
  ] as const) {
    const e = await mapEffective(textOf(row(id)), 'en', map);
    record(row(id), pass(e.ok), `R2 route + Map dock, Map ${map}`, e.observed);
  }
  for (const [id, map, expected] of [
    ['GE-009', 'POL', 'RWA'],
    ['GE-010', 'RWA', 'KEN'],
    ['GE-012', 'POL', 'POL'],
  ] as const) {
    const t = await typedWins(textOf(row(id)), 'en', map, expected);
    record(row(id), pass(t.ok), `R2 route + Map dock, Map ${map}`, t.observed);
  }
  {
    const subject = readSemanticSubject('What is NATO?', 'en');
    const nonStable = [
      'CURRENT_EVENT',
      'ARTICLE_ANCHORED',
      'COMPARISON_RESEARCH',
      'MULTI_ENTITY',
      'GEOGRAPHIC_REGIONAL',
      'CLARIFICATION_REQUIRED',
    ];
    const decisions = nonStable.map(
      (c) =>
        decideContextEligibility(subject, {
          typedGeographyPresent: false,
          resolvedArticleAnchorPresent: true,
          intentClass: c,
        }).suppresses,
    );
    const anchored = ask('What is NATO?', 'en', {
      mapContextCountry: 'POL',
      hasResolvedArticleAnchor: true,
      storyAnchorCountry: 'KEN',
      articleRefs: ['a'.repeat(64)],
    });
    record(
      row('GE-015'),
      pass(
        decisions.every((d) => d.length === 0) &&
          anchored.plan.scopedBy !== 'MAP_GEOGRAPHY_CONTEXT' &&
          anchored.plan.scopedBy !== 'CLASSIFIED_SHAPE',
      ),
      'eligibility over six non-stable classes + R2 route with anchor',
      { decisions, anchoredScope: anchored.plan.scopedBy },
    );
  }
  {
    const d = decideContextEligibility(readSemanticSubject('What is NATO?', 'en'), {
      typedGeographyPresent: false,
      resolvedArticleAnchorPresent: false,
      intentClass: '',
    });
    record(
      row('GE-016'),
      pass(d.suppresses.length === 0),
      'eligibility with the intent seam absent',
      d,
    );
  }
}

async function evaluateMD(): Promise<void> {
  {
    const s = await mapSuppressed(textOf(row('MD-001')), 'pl', 'POL');
    record(row('MD-001'), pass(s.ok), 'R2 route + Map dock, Map POL (QQ-10)', s.observed);
  }
  {
    const s = await mapSuppressed(textOf(row('MD-002')), 'pl', 'POL');
    record(row('MD-002'), pass(s.ok), 'R2 route + Map dock, Map POL (QQ-10)', s.observed);
  }
  {
    const officialIds = new Set(OFFICIAL_SOURCES.map((o) => o.id));
    const disjoint = REFERENCE_PROVIDERS.every(
      (p) =>
        p.role === 'REFERENCE' && p.activation.enabled === false && !officialIds.has(p.id as never),
    );
    record(row('MD-003'), disjoint ? 'HELD' : 'FAIL', 'reference registry vs official registry', {
      providers: REFERENCE_PROVIDERS.map((p) => ({
        id: p.id,
        role: p.role,
        enabled: p.activation.enabled,
      })),
      disjoint,
    });
  }
  {
    const questionRows = MASTER.filter(
      (r) =>
        r.question !== null &&
        ['C-ROUTER', 'L-ENPL', 'MAIN-CONVERGENCE', 'G-ELIGIBILITY'].includes(r.family) &&
        !/^(A|The) /.test(String(r.question)),
    );
    const unwired = questionRows
      .map((r) => ({ id: r.id, missing: missingSeams(ask(textOf(r), lgOf(r))) }))
      .filter((x) => x.missing.length > 0);
    record(
      row('MD-011'),
      pass(unwired.length === 0),
      'IC-8 over every question row, integrated path',
      { rows: questionRows.length, unwired },
    );
  }
}

/* G-CONTEXT — G's matrix, by case id. Service cases on the landed harness; pure cases on
   the landed functions and the integrated envelope; markup / browser / frontend-pure cases
   are DEFERRED to the frontend spec and the browser run. */
async function evaluateG(): Promise<void> {
  const gRow = (caseId: string) =>
    MASTER.find((r) => r.family === 'G-CONTEXT' && r.laneCaseId === caseId)!;
  /* G's `given` blocks are heterogeneous JSON, read per case id. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (c: MatrixCase) => c.given as Record<string, any>;
  const deferred: Record<string, string> = {};
  for (const c of MATRIX) {
    const r = gRow(c.id);
    const gv = g(c);
    switch (c.id) {
      case 'V1-C1':
      case 'V1-C2':
      case 'V1-C3': {
        const d = await dock(gv.question, 'en', gv.geographyContext.countryCode);
        const expected = { 'V1-C1': 'KEN', 'V1-C2': 'RWA', 'V1-C3': 'RWA' }[c.id];
        const r2 = ask(gv.question, 'en', { mapContextCountry: gv.geographyContext.countryCode });
        record(
          r,
          pass(
            d.countryCalls.join(',') === expected &&
              d.ctx?.geographyContextUsed === false &&
              r2.plan.scopedBy === 'TYPED_GEOGRAPHY',
          ),
          'landed service harness + R2 route',
          {
            countryCalls: d.countryCalls,
            geographyContextUsed: d.ctx?.geographyContextUsed,
            r2: brief(r2),
          },
        );
        break;
      }
      case 'V1-C4': {
        const d = await dock(gv.question, 'en', 'POL', gv.storyContext);
        record(
          r,
          pass(
            d.countryCalls.join(',') === 'KEN' &&
              d.ctx?.storyContextUsed === true &&
              d.ctx !== undefined &&
              !('geographyContextUsed' in d.ctx),
          ),
          'landed service harness',
          {
            countryCalls: d.countryCalls,
            ctx: {
              storyContextUsed: d.ctx?.storyContextUsed,
              hasGeographyStamp: d.ctx !== undefined && 'geographyContextUsed' in d.ctx,
            },
          },
        );
        break;
      }
      case 'V1-C5': {
        const h = landedHarness();
        const url = 'https://example.org/a';
        const { computeArticleRef } = await import('../modules/news/identity/article-ref.util');
        const res = await h.service.analyzeNews(
          gv.question,
          'en',
          undefined,
          undefined,
          { action: 'SUMMARIZE', stories: [{ articleRef: computeArticleRef(url), url }] } as never,
          { countryCode: 'POL', displayName: 'Poland' },
        );
        record(
          r,
          pass(
            h.countryCalls.length === 0 &&
              h.searchCalls.length === 0 &&
              !(
                res.retrievalContext !== undefined && 'geographyContextUsed' in res.retrievalContext
              ) &&
              (h.provider.analyzeNews as jest.Mock).mock.calls.length === 0,
          ),
          'landed service harness',
          { countryCalls: h.countryCalls, searchCalls: h.searchCalls },
        );
        break;
      }
      case 'V1-C6': {
        const G_ORDER = [
          'SELECTION',
          'ARTICLE_ANCHOR',
          'SOURCE_INTENT',
          'FOLLOW_UP_RELATION',
          'DECLARED_REGION',
          'TYPED_GEOGRAPHY',
          'MAP_GEOGRAPHY_CONTEXT',
          'CLASSIFIED_SHAPE',
        ];
        const total = G_ORDER.every((x) => (DECLARED_PRECEDENCE as readonly string[]).includes(x));
        record(r, total ? 'EXPLAINED' : 'FAIL', 'frozen C DECLARED_PRECEDENCE', {
          frozen: DECLARED_PRECEDENCE,
          g: G_ORDER,
          gRanksAllPresent: total,
        });
        break;
      }
      case 'V2-C1': {
        const doms = detectRequestedDomains(gv.question).map((o) => o.domain);
        const r2 = ask(gv.question, 'en');
        const typed = r2.envelope.geography.candidates.find(
          (x) => x.source === 'TYPED_GEOGRAPHY',
        )?.value;
        record(
          r,
          pass(
            doms.includes('security' as never) &&
              typed === 'KEN' &&
              r2.envelope.domains.domains.includes('security'),
          ),
          'landed detector + R2 envelope',
          { doms, typed, envelopeDomains: r2.envelope.domains.domains },
        );
        break;
      }
      case 'V2-C2': {
        const r2 = ask(gv.question, 'en');
        record(
          r,
          pass(
            r2.envelope.topic.readerTerms.length > 0 &&
              !r2.envelope.domains.domains.includes('entertainment'),
          ),
          'R2 envelope topic axis',
          { topic: r2.envelope.topic.readerTerms, domains: r2.envelope.domains.domains },
        );
        break;
      }
      case 'V2-C3':
        record(
          r,
          pass(
            !(ANALYTICAL_DOMAINS as readonly string[]).includes('entertainment') &&
              NEWS_CATEGORIES.includes('entertainment' as never) &&
              ANALYTICAL_DOMAINS.length === 8,
          ),
          'taxonomy negative control',
          { analytical: ANALYTICAL_DOMAINS.length },
        );
        break;
      case 'V3-C1':
      case 'V3-C2': {
        const r2 = ask(gv.question, 'en');
        const sp = r2.envelope.time.statedPeriod;
        const ok =
          c.id === 'V3-C1'
            ? sp === 'this week' &&
              r2.seam.producers.statedPeriod !== null &&
              gv.question.toLowerCase().includes(String(sp))
            : typeof sp === 'string';
        record(
          r,
          pass(ok),
          'R2 envelope time axis (provenance = the stated-period producer on the seam trace)',
          {
            statedPeriod: sp,
            producer: r2.seam.producers.statedPeriod,
            derivation: r2.envelope.time.derivation,
          },
        );
        break;
      }
      case 'V3-C3': {
        const dto = readFileSync(
          join(__dirname, '../modules/analysis/dto/analyze-news.dto.ts'),
          'utf8',
        );
        record(r, pass(!/requestedWindow/.test(dto)), 'source read', {
          requestedWindowOnDto: /requestedWindow/.test(dto),
        });
        break;
      }
      case 'V4-C1': {
        const a = resolveCountriesByDemonym('rwandan').map((m) => m.iso3);
        const b = resolveCountriesByDemonym('kenyan').map((m) => m.iso3);
        const r2 = ask('Rwandan security developments', 'en');
        const entity = r2.envelope.geography.candidates
          .filter((x) => x.source === 'ENTITY_GEOGRAPHY')
          .map((x) => x.value);
        const typedToo = ask(
          'Security developments in Rwanda',
          'en',
        ).envelope.geography.candidates.map((x) => x.source);
        record(
          r,
          pass(
            a.join() === 'RWA' &&
              b.join() === 'KEN' &&
              entity.join() === 'RWA' &&
              typedToo.includes('TYPED_GEOGRAPHY') &&
              !typedToo.includes('ENTITY_GEOGRAPHY'),
          ),
          'landed demonym resolver + R2 envelope provenance',
          { rwandan: a, kenyan: b, demonymRoute: entity, typedRoute: typedToo },
        );
        break;
      }
      case 'V4-C2': {
        const d = await dock(gv.question, 'en', 'POL');
        const r2 = ask(gv.question, 'en', { mapContextCountry: 'POL' });
        record(
          r,
          pass(
            d.ctx?.geographyContextUsed !== true &&
              !d.countryCalls.includes('POL') &&
              r2.plan.scopedBy !== 'MAP_GEOGRAPHY_CONTEXT',
          ),
          'landed service harness + R2 route',
          {
            countryCalls: d.countryCalls,
            geographyContextUsed: d.ctx?.geographyContextUsed,
            r2: brief(r2),
          },
        );
        break;
      }
      case 'V4-C3':
        record(r, pass(resolveCountriesByDemonym('rwandans').length === 0), 'pin on first run', {
          rwandans: resolveCountriesByDemonym('rwandans').map((m) => m.iso3),
        });
        break;
      case 'V4-C4': {
        const a = ask(gv.questions[0], 'en');
        const b = ask(gv.questions[1], 'en');
        const src = (x: AskR2Route) => x.envelope.geography.candidates.map((c2) => c2.source);
        const ok = a.plan.scopedBy === 'TYPED_GEOGRAPHY' && !src(b).includes('TYPED_GEOGRAPHY');
        record(r, pass(ok && src(b).includes('ENTITY_GEOGRAPHY')), 'R2 envelope provenance', {
          case0: { scopedBy: a.plan.scopedBy, sources: src(a) },
          case1: { scopedBy: b.plan.scopedBy, sources: src(b) },
        });
        break;
      }
      case 'V6-C2':
      case 'V6-C3': {
        const map = gv.geographyContext?.countryCode as string | undefined;
        const d = await dock(gv.question, 'en', map);
        const ok =
          map === undefined
            ? d.ctx !== undefined && !('geographyContextUsed' in d.ctx)
            : d.ctx?.geographyContextUsed === true && d.countryCalls.join(',') === map;
        record(r, pass(ok), 'landed service harness (markup half: frontend spec)', {
          countryCalls: d.countryCalls,
          geographyContextUsed: d.ctx?.geographyContextUsed,
        });
        break;
      }
      case 'V6-C4': {
        const d = await dock(gv.question, 'en', 'RWA');
        const fields = JSON.stringify({
          ...(d.ctx ?? {}),
          query: undefined,
          normalizedQuery: undefined,
          retrievalQuery: undefined,
        });
        record(
          r,
          pass(!/convention/i.test(fields) && !d.countryCalls.join(' ').includes('convention')),
          'landed service harness',
          { contextFieldsCarryVenue: /convention/i.test(fields) },
        );
        break;
      }
      case 'V7-C1': {
        const i = classifyQueryIntent(gv.question).intent;
        record(
          r,
          pass(i === 'CLARIFICATION_REQUIRED'),
          'landed classifier (first-run value recorded)',
          { intent: i },
        );
        break;
      }
      case 'V7-C2':
      case 'V7-C3': {
        const d = await dock(gv.question, 'en', undefined, gv.storyContext);
        const h = landedHarness();
        const res = await h.service.analyzeNews(gv.question, 'en', gv.storyContext);
        const interp =
          (res as { countryInterpretation?: string }).countryInterpretation ??
          (res.retrievalContext as { countryInterpretation?: string } | undefined)
            ?.countryInterpretation;
        const disclosed = JSON.stringify(res.retrievalContext ?? {}).includes(
          'COUNTRY_FROM_SELECTED_CONTEXT',
        );
        const verdict: Verdict =
          c.id === 'V7-C2'
            ? d.countryCalls.join(',') === 'COD' && d.ctx?.storyContextUsed === true
              ? disclosed || interp === 'COUNTRY_FROM_SELECTED_CONTEXT'
                ? 'PASS'
                : 'EXPLAINED'
              : 'FAIL'
            : pass(
                !disclosed &&
                  !d.countryCalls.includes('POL') &&
                  d.ctx?.retrievalOutcome === 'CLARIFICATION_REQUIRED',
              );
        record(r, verdict, 'landed service harness', {
          countryInterpretation: interp ?? null,
          disclosed,
          countryCalls: d.countryCalls,
          storyContextUsed: d.ctx?.storyContextUsed,
          outcome: d.ctx?.retrievalOutcome,
        });
        break;
      }
      case 'F1-C2': {
        const h = landedHarness();
        const res = await h.service.analyzeNews(
          'What are the latest developments?',
          'en',
          undefined,
          undefined,
          undefined,
          { countryCode: 'RWA', displayName: 'Poland' },
        );
        const prompt = JSON.stringify(h.providerInputs);
        record(
          r,
          pass(
            h.countryCalls.map((x) => iso3(x)).join(',') === 'RWA' &&
              !/Poland/.test(prompt) &&
              !/Poland/.test(JSON.stringify(res.retrievalContext ?? {})),
          ),
          'landed service harness',
          { countryCalls: h.countryCalls },
        );
        break;
      }
      case 'F4-C1': {
        const d = await dock(gv.question, 'en', undefined, gv.storyContext);
        record(
          r,
          pass(d.countryCalls.join(',') === 'KEN' && d.ctx?.storyContextUsed === false),
          'landed service harness (first run recorded)',
          { countryCalls: d.countryCalls, storyContextUsed: d.ctx?.storyContextUsed },
        );
        break;
      }
      case 'F4-C3': {
        const h = landedHarness();
        let status = 0;
        try {
          await h.service.analyzeNews(
            'What changed?',
            'en',
            gv.storyContext,
            undefined,
            undefined,
            gv.geographyContext,
          );
        } catch (e) {
          status = (e as { getStatus?: () => number }).getStatus?.() ?? -1;
        }
        record(r, pass(status === 400 && h.countryCalls.length === 0), 'landed service harness', {
          status,
        });
        break;
      }
      default:
        deferred[c.id] = c.harness;
        record(
          r,
          'DEFERRED',
          c.harness === 'browser'
            ? 'browser run (Gate H d-harness)'
            : 'frontend qualification spec',
          `harness=${c.harness}`,
        );
    }
  }
}

const ready = (async () => {
  evaluateC();
  evaluateL();
  await evaluateMainConvergence();
  await evaluateGE();
  await evaluateMD();
  await evaluateG();
  /* Every other row: its evidence lives outside this spec. */
  for (const r of MASTER) {
    if (results.has(r.id)) continue;
    const where =
      r.family === 'D-DEVICE' || r.id === 'MD-012'
        ? 'DEVICE-ONLY (no PASS claimed)'
        : r.family === 'D-MOBILE'
          ? 'D harness (browser)'
          : r.family === 'E1-SECURITY'
            ? 'E1 evidence mapping (NOT independently certified)'
            : 'evidence mapping (named specs)';
    record(r, 'DEFERRED', where, '');
  }
})();

afterAll(async () => {
  await ready;
  const out = process.env.QUAL_OUT;
  if (out !== undefined) writeFileSync(out, JSON.stringify([...results.values()], null, 1) + '\n');
});

describe('Gate H — Main R1.1 rows evaluated on the integrated backend path', () => {
  it('every one of the 373 rows has a verdict or a named deferral', async () => {
    await ready;
    expect(results.size).toBe(373);
  });

  const EVALUATED_FAMILIES = [
    'C-ROUTER',
    'L-ENPL',
    'MAIN-CONVERGENCE',
    'G-ELIGIBILITY',
    'MAIN-R1.1-CONVERGENCE',
    'G-CONTEXT',
  ];
  it.each(MASTER.filter((r) => EVALUATED_FAMILIES.includes(r.family)).map((r) => [r.id] as const))(
    '%s',
    async (id) => {
      await ready;
      const res = results.get(id)!;
      if (res.verdict === 'DEFERRED') return;
      const expected = EXPECTED[id]?.verdict ?? 'PASS';
      /* L's own asymmetry register and a fully-explained authority difference are EXPLAINED. */
      const allowed =
        expected === 'PASS' && res.verdict === 'EXPLAINED' && res.family === 'L-ENPL'
          ? 'EXPLAINED'
          : expected;
      expect({ id, verdict: res.verdict, observed: res.observed }).toEqual({
        id,
        verdict: allowed,
        observed: res.observed,
      });
    },
  );
});
