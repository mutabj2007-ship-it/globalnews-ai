/*
  EA R96 · F6–F8 SKIP-REASON — FIXTURE C (frontend): the reader's search activity (R-6, both
  classifiers) and the lane status copy in all seven locales (R-5, W-1, W-7). NOT WIRED.

  Author: East Africa independent validator, for Main (globalnews-ai-85). 2026-10-15.
  Authority: E1 `E1_R96_F6F8_PLAN_CONDITIONAL` R-5, R-6, W-1, W-7.
  Placement for a run: frontend/src/lib/ask/ea-r96-f6f8-fe.fixture.spec.ts
  Pure: builds payloads in memory; no network, no DOM.

  The fixture does not prescribe the new step's field names. A "not searched" step passes when it is
  (a) never `failed` / `partial`, (b) claims nothing was found, and (c) is distinguishable from the
  existing "Search attempted; detailed retrieval outcome unavailable" step — that copy says a search
  was attempted, which is false for a refusal and uses the word W-1 forbids.
*/
import type { AskAnswerState, AskR2Payload } from '@/lib/api/askV2Api';
import { askR2View } from './askR2View';
import { searchActivityOf, type SearchStep } from './askSearchActivity';
import { askShellStrings } from './shell/askShellCatalogue';

const RIGHTS = 'rights-not-cleared';
const LOCALES = ['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'] as const;
const ATTEMPTED_UNKNOWN: SearchStep = { kind: 'SEARCH', status: 'unknown' };

function payload(state: AskAnswerState, over: Partial<AskR2Payload> = {}): AskR2Payload {
  return {
    schema: 'ask-r2-result/1',
    route: {
      questionClass: 'CURRENT_REPORTING', terminalState: 'EXECUTABLE', scopedBy: 'TYPED_GEOGRAPHY',
      refusals: [], disclosures: [], clarification: [], normalization: 'QUALIFIED', questionLanguage: 'en',
    },
    chips: { kind: 'NONE' },
    answer: { state, basis: 'x', missingRoles: [] },
    aiExecuted: true,
    modelPriorCitable: false,
    ...over,
  } as AskR2Payload;
}
const withContext = (retrievalContext: Record<string, unknown>) =>
  payload('INSUFFICIENT', { analysis: { analysis: null, articles: [], retrievalContext } as never });

const searchOf = (p: AskR2Payload): SearchStep | undefined =>
  searchActivityOf(p)?.steps.find((s) => s?.kind === 'SEARCH');

const notSearchedShape = (step: SearchStep | undefined) => {
  expect(step).toBeDefined();
  expect(['failed', 'partial']).not.toContain(step!.status);
  expect(step!.found).toBeUndefined();
  expect(step).not.toEqual(ATTEMPTED_UNKNOWN);
};

const trace = (succeeded: string[], unavailable: { lane: string; reason: string }[]) => ({
  queryVariants: [], timeWindow: null, languages: ['en'],
  lanesAttempted: [...succeeded, ...unavailable.map((u) => u.lane)],
  lanesSucceeded: succeeded,
  lanesUnavailable: unavailable,
  candidatesSeen: 0, candidatesAdmitted: 0,
});
const ALL_REFUSED = ['gnews', 'gdelt-doc', 'rss-feeds'].map((lane) => ({ lane, reason: RIGHTS }));

/* ═════════════════════ 8 · R-6: the FE classifiers ═════════════════════ */
describe('EA-F6F8 8 · R-6: reopened / stored answers', () => {
  it('8.1 [HOLDS] a PRE-fix stored trace (kind/reason "unavailable") stays honestly unspecific — never re-labelled not-searched', () => {
    const step = searchOf(withContext({
      dataMode: 'live', providers: [], fallbackReason: 'provider-error',
      providerFailures: [{ providerId: 'gnews', kind: 'unavailable' }, { providerId: 'gdelt-doc', kind: 'unavailable' }, { providerId: 'rss-feeds', kind: 'unavailable' }],
      retrievalTrace: trace([], ['gnews', 'gdelt-doc', 'rss-feeds'].map((lane) => ({ lane, reason: 'unavailable' }))),
    }));
    expect(step).toBeDefined();
    expect(['failed', 'unknown']).toContain(step!.status);
    expect(JSON.stringify(step)).not.toMatch(/NOT_PERMITTED|not.?searched|rights/i);
  });
  it('8.2 [HOLDS] the G rows 1/4/5/6 pre-fix shape (empty lanesUnavailable, failures only) is not re-labelled either', () => {
    const step = searchOf(withContext({
      dataMode: 'live', providers: [], fallbackReason: 'provider-error',
      providerFailures: [{ providerId: 'gnews', kind: 'unavailable' }, { providerId: 'gdelt-doc', kind: 'unavailable' }],
      retrievalTrace: trace([], []),
    }));
    expect(JSON.stringify(step)).not.toMatch(/NOT_PERMITTED|not.?searched|rights/i);
  });
  it('8.3 [AFTER] a POST-fix stored trace (every lane rights-not-cleared) shows not-searched — never "failed"', () => {
    notSearchedShape(searchOf(withContext({
      dataMode: 'live', providers: [], fallbackReason: 'provider-error',
      providerFailures: ALL_REFUSED.map((l) => ({ providerId: l.lane, kind: RIGHTS })),
      retrievalTrace: trace([], ALL_REFUSED),
    })));
  });
  it('8.4 [AFTER] the research record path: outcome NOT_PERMITTED shows not-searched — never "failed", never "Search attempted"', () => {
    notSearchedShape(searchOf(payload('INSUFFICIENT', {
      research: {
        schema: 'ask-research/1', performed: true, outcome: 'NOT_PERMITTED', reused: false,
        lanes: { attempted: [], succeeded: [], unavailable: ALL_REFUSED },
      } as never,
    })));
  });
  it('8.7 [AFTER] R-4 ordering (EA finding): a NOT_PERMITTED record never yields an undefined activity step', () => {
    /* at 4fcec7b searchStep() has no default branch, so an unknown outcome code returns undefined and
       the reader's activity list holds an undefined step — the FE case must ship with the emitter */
    const steps = searchActivityOf(payload('INSUFFICIENT', {
      research: {
        schema: 'ask-research/1', performed: true, outcome: 'NOT_PERMITTED', reused: false,
        lanes: { attempted: [], succeeded: [], unavailable: ALL_REFUSED },
      } as never,
    }))?.steps ?? [];
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) expect(s).toBeDefined();
  });
  it('8.5 [HOLDS] R-8 control: a POST-fix stored trace with a genuine outage is still "failed"', () => {
    const step = searchOf(withContext({
      dataMode: 'live', providers: [], fallbackReason: 'provider-error',
      providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }, { providerId: 'gdelt-doc', kind: 'timeout' }],
      retrievalTrace: trace([], [{ lane: 'gnews', reason: 'rate-limited' }, { lane: 'gdelt-doc', reason: 'timeout' }]),
    }));
    expect(step?.status).toBe('failed');
  });
  it('8.6 [HOLDS] mixed stored trace (feed lane answered, two refused) stays partial — never completed, never not-searched', () => {
    const step = searchOf(withContext({
      dataMode: 'live', providers: ['rss-feeds'],
      providerFailures: [{ providerId: 'gnews', kind: RIGHTS }, { providerId: 'gdelt-doc', kind: RIGHTS }],
      retrievalTrace: trace(['rss-feeds'], ALL_REFUSED.slice(0, 2)),
    }));
    expect(step?.status).toBe('partial');
  });
});

/* ═════════════════════ 9 · R-5 / W-1 / W-7: lane copy, seven locales ═════════════════════ */
const verificationFor = (locale: (typeof LOCALES)[number], unavailable: { lane: string; reason: string }[], succeeded: string[] = [], notice?: string) => {
  const s = askShellStrings(locale).askR2Strings;
  const p = withContext({
    dataMode: 'live', providers: succeeded, fallbackReason: succeeded.length === 0 ? 'provider-error' : undefined,
    ...(notice === undefined ? {} : { verificationNotice: notice }),
    retrievalTrace: trace(succeeded, unavailable),
  });
  return { s, v: askR2View(p, s, locale as never).verification };
};

describe.each(LOCALES)('EA-F6F8 9 · R-5/W-7 · %s', (locale) => {
  it('9.1 [AFTER] a refused lane never carries the "unavailable" word, the raw reason token or a raw provider id', () => {
    const { s, v } = verificationFor(locale, ALL_REFUSED);
    const refused = (v?.lanes ?? []).filter((l) => !l.ok);
    expect(refused.length).toBeGreaterThan(0);
    for (const l of refused) {
      expect(l.status).not.toContain(s.verification.unavailable);
      expect(l.status).not.toMatch(/unavailable/i);
      expect(`${l.label} ${l.status}`).not.toContain(RIGHTS);
      expect(['gnews', 'gdelt-doc']).not.toContain(l.label);
    }
  });
  it('9.2 [AFTER] mixed: the answered feed lane is "available"; the refused lanes follow 9.1', () => {
    const { s, v } = verificationFor(locale, ALL_REFUSED.slice(0, 2), ['rss-feeds'], 'COVERAGE_INCOMPLETE');
    const lanes = v?.lanes ?? [];
    expect(lanes.filter((l) => l.ok).map((l) => l.status)).toEqual([s.verification.available]);
    for (const l of lanes.filter((x) => !x.ok)) {
      expect(l.status).not.toContain(s.verification.unavailable);
      expect(`${l.label} ${l.status}`).not.toContain(RIGHTS);
    }
  });
  it('9.3 [AFTER] (EA addition, W-1) nothing in the verification view of a refusal-only turn says "unavailable"', () => {
    const { s, v } = verificationFor(locale, ALL_REFUSED, [], 'COVERAGE_INCOMPLETE');
    const text = JSON.stringify(v ?? {});
    expect(text).not.toContain(s.verification.unavailable);
    expect(text).not.toMatch(/unavailable/i);
  });
  it('9.4 [HOLDS] R-8 control: a rate-limited lane still reads as unavailable (rate-limited) in this locale', () => {
    const { s, v } = verificationFor(locale, [{ lane: 'news-providers', reason: 'rate-limited' }]);
    const lane = (v?.lanes ?? []).find((l) => !l.ok);
    expect(lane?.status).toContain(s.verification.unavailable);
  });
});
