import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { aboutRetrievalFigures } from '@/lib/ask/askR2View';
import { buildBriefTelemetry } from '../analysis-frame/briefModel';
import { fixture } from '../analysis-frame/frameFixtures';
import { buildTelemetryModel } from './analysisClaims';
import { selectBriefAnswers } from './analysisDimensions';
import { retrievalFiguresWithheld } from './evidenceDisplay';

/**
 * E1 ADDENDUM-18 C-1 / C-2 (CTO #95 c6375734941). The retrieval counts are counted AFTER the rights
 * gate, so where reports were found and all withheld — or nothing was searched — "0 retrieved
 * reports" reads as "no reporting exists". Every reader-facing count renderer goes through ONE
 * decision (retrievalFiguresWithheld) and states no figure there; a search that ran and found
 * nothing, a partial withholding and a genuine outage keep their true figures.
 *
 * Locale note: suppression removes the figure, it adds no copy, so it is the same in all seven
 * locales; the rights-withheld / not-searched states keep their existing, Claude L-approved copy.
 */
const withContext = (
  context: Record<string, unknown>,
  articleCount = 0,
): AnalysisApiResponse => {
  const base = fixture({ articleCount });
  return { ...base, retrievalContext: { ...context } } as unknown as AnalysisApiResponse;
};

const askOf = (response: AnalysisApiResponse): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: { terminalState: 'EXECUTABLE' },
    answer: { state: 'INSUFFICIENT', basis: 'x', missingRoles: [] },
    analysis: response,
  }) as never;

const evidenceCell = (response: AnalysisApiResponse) => {
  const value = selectBriefAnswers(response).find((c) => c.key === 'how-strong-is-the-evidence')?.value;
  if (value?.kind !== 'evidence-strength') throw new Error('no evidence-strength cell');
  return value;
};

const CASES = {
  /* C-1: reports came back and every one was withheld for rights */
  rightsWithheldTotal: withContext({
    dataMode: 'live',
    providers: ['rss-feeds'],
    articlesRetrieved: 0,
    rightsExcluded: { count: 4, reasons: { SOURCE_RIGHTS_NOT_CLEARED: 4 } },
  }),
  /* every lane refused before any network call (the live Kenya shape) */
  rightsRefusedOnly: withContext({
    dataMode: 'unavailable',
    providers: [],
    articlesRetrieved: 0,
    providerFailures: [{ providerId: 'gnews', kind: 'rights-not-cleared' }],
    retrievalTrace: { lanesUnavailable: [{ lane: 'rss-feeds', reason: 'not-configured' }] },
  }),
  /* no provider was asked at all */
  notAttempted: withContext({ dataMode: 'unavailable', providers: [], articlesRetrieved: 0, retrievalAttempted: false }),
  /* a search that RAN and matched nothing: 0 is the true result */
  completedZero: withContext({ dataMode: 'live', providers: ['rss-feeds'], articlesRetrieved: 0 }),
  /* some withheld, some admitted: the admitted figure is still stated */
  partialWithholding: withContext(
    {
      dataMode: 'live',
      providers: ['rss-feeds'],
      articlesRetrieved: 2,
      rightsExcluded: { count: 3, reasons: { SOURCE_RIGHTS_NOT_CLEARED: 3 } },
    },
    2,
  ),
  /* a genuine outage: a search was attempted */
  outage: withContext({
    dataMode: 'unavailable',
    providers: [],
    articlesRetrieved: 0,
    providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }],
  }),
} as const;

const WITHHELD: ReadonlyArray<keyof typeof CASES> = ['rightsWithheldTotal', 'rightsRefusedOnly', 'notAttempted'];
const SHOWN: ReadonlyArray<keyof typeof CASES> = ['completedZero', 'partialWithholding', 'outage'];

describe('retrieval figures: one decision, every renderer (E1 C-1 / C-2)', () => {
  it.each(WITHHELD)('%s → no figure on any surface', (name) => {
    const r = CASES[name];
    expect(retrievalFiguresWithheld(r.retrievalContext, r.articles.length)).toBe(true);
    /* AnalysisFrame BriefRow / TrustSummaryLine and AskCompactResult */
    expect(buildBriefTelemetry(r, null)).toMatchObject({ retrievedArticleCount: null, reportingClusterCount: null });
    /* AnalysisWorkspace → AnalysisTelemetry (E-05 cell omitted) */
    expect(buildTelemetryModel(r)).toMatchObject({ articlesRetrieved: null, reportingClusterCount: null });
    /* ExecutiveBrief "how strong is the evidence" */
    expect(evidenceCell(r)).toMatchObject({ articlesRetrieved: null, reportingClusterCount: null, distinctSourceNameCount: null });
    /* Ask "About this answer" */
    expect(aboutRetrievalFigures(askOf(r))).toBeNull();
  });

  it.each(SHOWN)('%s → true figures kept', (name) => {
    const r = CASES[name];
    const n = r.articles.length;
    expect(retrievalFiguresWithheld(r.retrievalContext, n)).toBe(false);
    expect(buildBriefTelemetry(r, null).retrievedArticleCount).toBe(n);
    expect(buildTelemetryModel(r).articlesRetrieved).toBe(n);
    expect(evidenceCell(r).articlesRetrieved).toBe(n);
    expect(aboutRetrievalFigures(askOf(r))).toEqual({ reports: n, clusters: r.sourceDiversity?.reportingClusterCount });
  });

  it('the C-1 shape is not mistaken for a completed zero (mutation: drop the rightsExcluded rule)', () => {
    const withheld = CASES.rightsWithheldTotal.retrievalContext;
    const { rightsExcluded: _dropped, ...sameWithoutExclusion } = withheld as unknown as Record<string, unknown>;
    expect(retrievalFiguresWithheld(withheld, 0)).toBe(true);
    expect(retrievalFiguresWithheld(sameWithoutExclusion as never, 0)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * STRUCTURAL GUARD — no reader-facing file reads the raw count fields
 * except the builders that apply the shared decision.
 * ------------------------------------------------------------------ */
const SRC = join(__dirname, '..', '..');
const RAW_READ = /\.(articlesRetrieved|retrievedArticleCount|reportingClusterCount)\b/;

/* builders: each must apply retrievalFiguresWithheld itself */
const BUILDERS = [
  'components/analysis-frame/briefModel.ts',
  'components/search/analysisClaims.ts',
  'components/search/analysisDimensions.ts',
  'lib/ask/askR2View.ts',
];
/* the decision itself, a test fixture, and a renderer whose only input is gated at its caller */
const OTHER_ALLOWED = [
  'components/search/evidenceDisplay.ts',
  'components/analysis-frame/frameFixtures.ts',
  'components/search/SourceDiversitySummary.tsx',
];
/* renderers that read already-gated builder output by name */
const GATED_OUTPUT = /\b(telemetry|cell\.value)\.(articlesRetrieved|retrievedArticleCount|reportingClusterCount)\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('structural guard: raw retrieval counts reach readers only through the shared decision', () => {
  const rel = (f: string) => relative(SRC, f).split(sep).join('/');
  const files = sourceFiles(SRC);

  it('no other file reads the raw count fields', () => {
    const offenders = files
      .filter((f) => ![...BUILDERS, ...OTHER_ALLOWED].includes(rel(f)))
      .filter((f) => RAW_READ.test(readFileSync(f, 'utf8').replace(GATED_OUTPUT, '')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it.each(BUILDERS)('%s applies retrievalFiguresWithheld', (file) => {
    expect(readFileSync(join(SRC, file), 'utf8')).toMatch(/retrievalFiguresWithheld\(/);
  });

  it('every caller that hands sourceDiversity to the summary renderer gates it', () => {
    const passers = files.filter((f) => /<AnalysisResultView[\s\S]*?sourceDiversity=/.test(readFileSync(f, 'utf8')));
    expect(passers.length).toBeGreaterThan(0);
    for (const f of passers) expect(readFileSync(f, 'utf8')).toMatch(/retrievalFiguresWithheld\(/);
    /* and the summary is rendered only by AnalysisResultView, which forwards its prop */
    const renderers = files.filter((f) => /<SourceDiversitySummary\b/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(renderers).toEqual(['components/search/AnalysisResultView.tsx']);
  });
});
