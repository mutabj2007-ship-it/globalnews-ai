import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { deriveKnowledgeRequirement, particularPhenomenon } from './knowledge-requirement';
import { EN_PUBLIC_EVENT, PL_PUBLIC_EVENT } from './advisory-requirement';
import { readTransformation } from './user-job';

/**
 * CTO R4 FINAL CLOSEOUT — through the real integrated router.
 *   §1/§2  a word naming a potentially current phenomenon is not itself a request for current
 *          reporting: generic causal / conceptual questions are reasoning, zero news;
 *   §3     CURRENT_REPORTING needs POSITIVE currentness evidence (time, a bounded window, a
 *          particular event / place, a present-state request, an explicit change);
 *   §5     causal analysis is first-class (analysis CAUSAL);
 *   §6     transformation FAMILIES (table, checklist, plan, summary, briefing, comparison,
 *          scenarios, action steps), EN and PL;
 *   §7     a stable clause + a current clause is MIXED (the stable half survives).
 * "news" = a REQUIRED NEWS_REPORTING evidence request; "reasoning" = REFERENCE_BACKGROUND_ONLY.
 */
const PRIOR: AskRouteContext['priorWork'] = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'earlier work' };

function route(q: string, lang: 'en' | 'pl' = 'en', extra: Partial<AskRouteContext> = {}) {
  const r = routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-03T12:00:00Z', ...extra },
    { specialistRegistry: specialistRegistryFixture },
  );
  return {
    job: r.job.job,
    source: r.job.source,
    analysis: r.job.analysis ?? null,
    transformation: r.job.transformation,
    knowledge: r.knowledgeRequirement,
    reasoning: r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY',
    news: r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
    currentClauses: r.currentEvidenceNeeded,
  };
}

describe('§1 R4-G1 — the two reported P0 questions are conceptual causal analysis, zero news', () => {
  it.each([
    ['How does a currency peg turn a small shock into a big crisis?', 'en'],
    [
      'Jak nadmierna centralizacja władzy może prowadzić do gorszych decyzji w czasie kryzysu?',
      'pl',
    ],
  ] as const)('%s', (q, lang) => {
    expect(route(q, lang)).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      analysis: 'CAUSAL',
      reasoning: true,
      news: false,
    });
  });
});

describe('§2/§5 — causal / conceptual mechanism questions (never phrase-matched topics)', () => {
  it.each([
    ['How does inflation destroy purchasing power?', 'en'],
    ['Why can a bank run become self-reinforcing?', 'en'],
    ['How can political centralisation create institutional fragility?', 'en'],
    ['Why does a currency peg sometimes amplify a shock?', 'en'],
    ['How can a war reshape an economy?', 'en'],
    ['How can success create the conditions for failure?', 'en'],
    ['Why can efficiency make a system fragile?', 'en'],
    ['How does leverage magnify losses?', 'en'],
    ['How can centralisation weaken resilience?', 'en'],
    ['Why can rapid growth create instability?', 'en'],
    /* own wording, other domains — the families generalise beyond the CTO list */
    ['How can a monopoly undermine its own innovation?', 'en'],
    ['Why do sanctions sometimes strengthen the regime they target?', 'en'],
    ['How can a pandemic accelerate automation?', 'en'],
    ['Jak inflacja niszczy siłę nabywczą?', 'pl'],
    ['Dlaczego panika bankowa może się sama napędzać?', 'pl'],
    ['Jak wojna może przekształcić gospodarkę?', 'pl'],
    ['W jaki sposób szybki wzrost może osłabiać stabilność firmy?', 'pl'],
    ['Jak sukces może prowadzić do porażki?', 'pl'],
  ] as const)('%s → causal reasoning, zero news', (q, lang) => {
    expect(route(q, lang)).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      analysis: 'CAUSAL',
      reasoning: true,
      news: false,
    });
  });

  it('a past-tense question about one particular historical event is not a general mechanism (recorded "Why was NATO created?" decision kept)', () => {
    expect(route('Why was NATO created?').analysis).toBeNull();
    expect(route('Dlaczego upadło Imperium Rzymskie?', 'pl').analysis).toBeNull();
  });

  it('"how can I / we …" is advice about the reader’s own action, not a mechanism question', () => {
    expect(route('How can we avoid losing our best customers?').analysis).toBeNull();
  });
});

describe('§3 — CURRENT_REPORTING needs POSITIVE currentness evidence', () => {
  it.each([
    ['What is happening in the current currency crisis in Argentina?', 'en'],
    ['What happened to the currency peg this week?', 'en'],
    ['Is Lebanon experiencing a banking crisis right now?', 'en'],
    ['What is the situation in Sudan?', 'en'],
    ['What is the latest on the war in Ukraine?', 'en'],
    ['What did the central bank decide yesterday?', 'en'],
    ['Jaka jest sytuacja w Sudanie?', 'pl'],
    ['Co się dzieje z kryzysem w Argentynie?', 'pl'],
    ['Jaka jest obecna sytuacja na rynku pracy?', 'pl'],
  ] as const)('%s → current reporting', (q, lang) => {
    const r = route(q, lang);
    expect(r.reasoning).toBe(false);
    expect(r.news).toBe(true);
  });

  it('the anchoring rule: a particular instance counts, a generic mention does not', () => {
    const anchored = (q: string, lang: 'en' | 'pl', place = false) =>
      particularPhenomenon(q, lang, lang === 'pl' ? PL_PUBLIC_EVENT : EN_PUBLIC_EVENT, place);
    expect(anchored('How can a war reshape an economy?', 'en')).toBe(false);
    expect(anchored('Why do elections polarise societies?', 'en')).toBe(false);
    expect(anchored('What is the war about?', 'en')).toBe(true);
    expect(anchored('What will the ongoing protests change?', 'en')).toBe(true);
    expect(anchored('What is the war doing to Sudan?', 'en', true)).toBe(true);
    expect(anchored('Jak wojna może przekształcić gospodarkę?', 'pl')).toBe(false);
    expect(anchored('Czego dotyczy obecny kryzys?', 'pl')).toBe(true);
  });

  it('a state noun used generically is not freshness; a present-state request is', () => {
    expect(
      deriveKnowledgeRequirement('Why do crises spread between banks?', 'en').requirement,
    ).toBe('STABLE_REFERENCE');
    expect(deriveKnowledgeRequirement('What is the security situation?', 'en').requirement).toBe(
      'CURRENT_REPORTING',
    );
  });
});

describe('§6 — transformation FAMILIES (EN + PL), on earlier work', () => {
  it.each([
    ['Make it a checklist.', 'en', 'CHECKLIST'],
    ['Put that in a table.', 'en', 'TABLE'],
    ['OK, put those into a comparison matrix.', 'en', 'TABLE'],
    ['Lay out three scenarios from that: best case, base case, worst case.', 'en', 'SCENARIOS'],
    ['Turn this into a one-page briefing for the board.', 'en', 'BRIEFING'],
    ['Break that into concrete action steps.', 'en', 'ACTION_STEPS'],
    ['Summarise that in five bullets.', 'en', 'SUMMARY'],
    ['Can you turn it into a 6-week plan?', 'en', 'PLAN'],
    ['Compare those side by side.', 'en', 'COMPARISON'],
    ['Ujmij to w tabeli.', 'pl', 'TABLE'],
    ['Przerób to na krótką listę kontrolną.', 'pl', 'CHECKLIST'],
    ['Zrób z tego plan na 60 dni.', 'pl', 'PLAN'],
    ['Rozpisz to na konkretne kroki.', 'pl', 'ACTION_STEPS'],
    ['Przygotuj z tego notatkę dla zarządu.', 'pl', 'BRIEFING'],
    ['Podsumuj to w trzech punktach.', 'pl', 'SUMMARY'],
    ['Przedstaw z tego trzy scenariusze.', 'pl', 'SCENARIOS'],
  ] as const)('%s → %s (TRANSFORMATION / PLANNING, zero news)', (q, lang, kind) => {
    expect(readTransformation(q, lang)).toBe(kind);
    const r = route(q, lang, { priorWork: PRIOR });
    expect(r.transformation).toBe(kind);
    expect(r.job).toBe(kind === 'PLAN' ? 'PLANNING' : 'TRANSFORMATION');
    expect(r).toMatchObject({ reasoning: true, news: false });
  });

  it('a request that is not a work form is not a transformation', () => {
    expect(readTransformation('What is the table of elements?', 'en')).toBeNull();
    expect(readTransformation('Show me the latest news about Kenya.', 'en')).toBeNull();
  });

  it('a topic summary / briefing with nothing earlier to work on goes to the classifier, never assumed', () => {
    expect(route('Give me a briefing on AI regulation.').source).toBe('UNRESOLVED');
  });
});

describe('§7 — MIXED keeps the stable half (a stable clause + a current clause)', () => {
  it.each([
    [
      "Explain why currency pegs can be fragile and tell me what happened to Argentina's exchange rate this week.",
      'en',
    ],
    ['What is a debt ceiling, and where does the US debt ceiling fight stand now?', 'en'],
    [
      "Give me the background on the Kashmir dispute and what's happened there in the past week.",
      'en',
    ],
    ['Czym jest Trybunał Konstytucyjny i jak wygląda obecnie spór polityczny wokół niego?', 'pl'],
  ] as const)('%s → MIXED_REFERENCE_CURRENT, the current clause named', (q, lang) => {
    const r = route(q, lang);
    expect(r.knowledge).toBe('MIXED_REFERENCE_CURRENT');
    expect(r.job).toBe('MIXED');
    expect(r.currentClauses.length).toBeGreaterThan(0);
  });
});
