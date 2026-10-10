import { routeAskR2, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { fallbackResolution, type SemanticResolution } from './semantic-ir/semantic-interpreter';

/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — routing. On Alpha, "Give any reports about Eric Prince please."
  was answered with a historical Blackwater biography: the turn was JOB_UNRESOLVED and the
  interpreter (or its fallback) made it REFERENCE_BACKGROUND_ONLY. An explicit request for REPORTS is
  now current evidence on every interpreter outcome. Pure: no model, no network.
*/
const route = (question: string, semanticResolution?: SemanticResolution): AskR2Route =>
  routeAskR2(
    { originalQuestion: question, sourceLanguage: 'en', normalizationLanguage: 'en', displayLanguage: 'en', origin: 'ASK' },
    { requestInstant: '2026-10-10T12:00:00Z', ...(semanticResolution === undefined ? {} : { semanticResolution }) },
    { specialistRegistry: specialistRegistryFixture },
  );
const verdict = (needsCurrentEvidence: boolean): SemanticResolution => ({
  path: 'SEMANTIC',
  job: needsCurrentEvidence ? 'CURRENT_EVENTS' : 'PLACE_BACKGROUND',
  needsCurrentEvidence,
  depth: 'STANDARD',
  transformation: null,
  confidence: 'HIGH',
  temporalRole: 'NONE',
  relation: null,
  reference: 'NONE',
  objective: null,
} as SemanticResolution);
const requiresReporting = (r: AskR2Route) =>
  r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING') &&
  r.plan.terminalState !== 'REFERENCE_BACKGROUND_ONLY';

const ALPHA = 'Give any reports about Eric Prince please.';
const N1 = 'Report abt Eric Prince in congo. According reuters please.';
const N3 = 'Give any recent reports about Eric Prince in Congo.';

describe('an explicit request for reports is current evidence on every interpreter outcome', () => {
  it.each([ALPHA, N1, N3])('%s', (q) => {
    const first = route(q);
    expect(first.semantic?.resolution.conflicts ?? []).not.toContain('JOB_UNRESOLVED');
    expect(requiresReporting(first)).toBe(true);
    expect(requiresReporting(route(q, verdict(false)))).toBe(true);
    expect(requiresReporting(route(q, fallbackResolution(first.semantic!)))).toBe(true);
  });
});

describe('controls — unchanged', () => {
  it('N9 a conceptual question about reporting is not a news search', () => {
    for (const q of ['What is a news report?', 'How do news agencies verify their reports?']) {
      expect(requiresReporting(route(q, verdict(false)))).toBe(false);
    }
  });
  it.each([
    ['en', 'How should I judge whether a news outlet is trustworthy?'],
    ['en', 'How can news framing affect public understanding?'],
    ['en', 'Why do news cycles reward outrage?'],
    ['pl', 'Jak ocenić wiarygodność serwisu z wiadomościami?'],
  ] as const)('"news" as a SUBJECT is not a request for reports (%s: %s)', (lang, q) => {
    const r = routeAskR2(
      { originalQuestion: q, sourceLanguage: lang, normalizationLanguage: lang, displayLanguage: lang, origin: 'ASK' },
      { requestInstant: '2026-10-10T12:00:00Z', semanticResolution: verdict(false) },
      { specialistRegistry: specialistRegistryFixture },
    );
    expect(requiresReporting(r)).toBe(false);
  });
  it('a person question without a request for reports keeps the interpreter decision', () => {
    expect(requiresReporting(route('Who is Erik Prince?', verdict(false)))).toBe(false);
  });
});
