import { routeAskR2, type AskRouteContext } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { readTemporalRoles, readTransformation, referencesPriorWork } from './user-job';

/**
 * CTO R4 — DEEP CONVERSATIONAL INTELLIGENCE, through the real integrated router.
 * "news" = a REQUIRED NEWS_REPORTING evidence request. "reasoning" = the route answers from the
 * background reasoning lane (REFERENCE_BACKGROUND_ONLY), so GNews/GDELT/RSS calls are zero.
 * UNRESOLVED = the router keeps frozen C's plan and the executor classifies BEFORE any news call.
 */
const PRIOR: AskRouteContext['priorWork'] = { kind: 'CONCEPTUAL_FRAMEWORK', label: 'Prime moment' };

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
    depth: r.job.depth,
    transformation: r.job.transformation,
    reference: r.job.discourseReference,
    temporal: r.job.temporal.map((t) => `${t.role}${t.days === undefined ? '' : `:${t.days}`}`),
    terminal: r.plan.terminalState,
    reasoning: r.plan.terminalState === 'REFERENCE_BACKGROUND_ONLY',
    news: r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
  };
}

describe('R4 — the frozen live Prime Moment corpus (Alpha c7e8c03, thread 3a29fa20)', () => {
  it('live T1 (op 01dff63f) — a causal concept question is deep reasoning, zero news', () => {
    const r = route(
      'indicate how a prime moment of someone can lead him to losing whatever he had in life',
    );
    expect(r).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      depth: 'DEEP',
      reasoning: true,
      news: false,
    });
  });
  it('scripted T1 — "Define deeply … I need deeper analysis" is deep reasoning, zero news', () => {
    const r = route(
      'Define deeply what is "Prime moment" of something or someone. I need deeper analysis.',
    );
    expect(r).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      depth: 'DEEP',
      reasoning: true,
      news: false,
    });
  });
  it('live T2 (op b7ade95f) — applying the earlier framework is decision support on prior work', () => {
    const r = route('Apply that idea to GlobalNewsAI. Are we approaching our prime moment?', 'en', {
      priorWork: PRIOR,
    });
    expect(r).toMatchObject({
      job: 'DECISION_SUPPORT',
      reference: 'PRIOR_WORK',
      reasoning: true,
      news: false,
    });
  });
  it('live T3 (op 8abfdd63) — "Which part is weakest?" diagnoses the earlier framework', () => {
    const r = route('Which part is weakest?', 'en', { priorWork: PRIOR });
    expect(r).toMatchObject({
      job: 'DEEP_CONCEPTUAL_ANALYSIS',
      reference: 'PRIOR_WORK',
      reasoning: true,
      news: false,
    });
  });
  it('scripted T4 — "What should we do about it?" is advice on the earlier work', () => {
    const r = route('What should we do about it?', 'en', { priorWork: PRIOR });
    expect(r).toMatchObject({ job: 'ADVISORY', reasoning: true, news: false });
  });
  it('live T4 (op 81c69b30) — "Turn that into a 90-day plan." is a PLAN with a 90-day PLAN_HORIZON', () => {
    const r = route('Turn that into a 90-day plan.', 'en', { priorWork: PRIOR });
    expect(r).toMatchObject({
      job: 'PLANNING',
      transformation: 'PLAN',
      temporal: ['PLAN_HORIZON:90'],
      reasoning: true,
      news: false,
    });
    expect(r.terminal).not.toBe('CLARIFICATION_REQUIRED');
  });
});

describe('R4 — the same journey in Polish uses the same semantic schema', () => {
  it.each([
    [
      'Wyjaśnij dogłębnie, czym jest „moment szczytowy” czegoś lub kogoś.',
      {},
      'DEEP_CONCEPTUAL_ANALYSIS',
    ],
    ['Zastosuj tę ideę do GlobalNewsAI.', { priorWork: PRIOR }, 'DECISION_SUPPORT'],
    ['Która część jest najsłabsza?', { priorWork: PRIOR }, 'DEEP_CONCEPTUAL_ANALYSIS'],
    ['Przekształć to w plan na 90 dni.', { priorWork: PRIOR }, 'PLANNING'],
  ] as const)('%s → %s', (q, extra, job) => {
    const r = route(q, 'pl', extra);
    expect(r).toMatchObject({ job, reasoning: true, news: false });
  });
  it('PL plan horizon is 90 days, not a reporting window', () => {
    expect(route('Przekształć to w plan na 90 dni.', 'pl', { priorWork: PRIOR }).temporal).toEqual([
      'PLAN_HORIZON:90',
    ]);
  });
});

describe('R4 — paraphrase families: deep conceptual questions never become news', () => {
  const FAMILIES: Record<string, string[]> = {
    resilience: [
      'What does resilience really mean?',
      'Explain in depth what organisational resilience is.',
      'How can resilience become a weakness?',
    ],
    maturity: [
      'What does maturity actually mean for a company?',
      'Analyse deeply what institutional maturity is.',
    ],
    readiness: [
      'What does readiness really mean before a big launch?',
      'Explain conceptually what market readiness is.',
    ],
    'strategic timing': [
      'Explain in depth the concept of strategic timing.',
      'How can good timing lead to failure?',
    ],
    'critical mass': [
      'What does critical mass really mean for a network?',
      'Explain deeply what critical mass is.',
    ],
    'institutional trust': [
      'What does institutional trust actually mean?',
      'How can institutional trust collapse?',
    ],
    'opportunity cost': [
      'Explain fundamentally what opportunity cost is.',
      'What does opportunity cost really mean in strategy?',
    ],
    'success/failure paradox': [
      'How can success lead to failure?',
      'Why does success sometimes cause decline?',
      'Explain in depth how winning can undermine a company.',
    ],
  };
  for (const [family, questions] of Object.entries(FAMILIES))
    it.each(questions)(`${family}: %s`, (q) => {
      const r = route(q);
      expect(r).toMatchObject({ news: false, reasoning: true });
      expect(['DEEP_CONCEPTUAL_ANALYSIS', 'EXPLANATION']).toContain(r.job);
    });
});

describe('R4 — imperatives are requests (no "?")', () => {
  it.each([
    ['Summarise that.', 'SUMMARY'],
    ['Put that into a table.', 'TABLE'],
    ['Turn this into a checklist.', 'CHECKLIST'],
    ['Give me three scenarios for it.', 'SCENARIOS'],
    ['Explain that more deeply.', 'EXPLAIN_MORE'],
  ] as const)('%s → %s on prior work, zero news', (q, kind) => {
    const r = route(q, 'en', { priorWork: PRIOR });
    expect(r).toMatchObject({ transformation: kind, reasoning: true, news: false });
  });
  it('a self-contained imperative plan request with no prior work is PLANNING', () => {
    expect(route('Draft a 30-day onboarding plan for a new analyst.')).toMatchObject({
      job: 'PLANNING',
      temporal: ['PLAN_HORIZON:30'],
      reasoning: true,
      news: false,
    });
  });
  it('a dangling reference with NO prior work never invents one', () => {
    expect(route('Turn that into a 90-day plan.').reference).toBe('NONE');
  });
});

describe('R4 — news negative controls stay news', () => {
  it.each([
    'What happened in Kenya 90 days ago?',
    'Latest news on Tesla layoffs.',
    'What changed in Rwanda this month?',
    'What is the latest on the Sudan ceasefire talks?',
  ])('%s', (q) => {
    const r = route(q);
    expect(r.reasoning).toBe(false);
    expect(['CURRENT_REPORTING', 'CHANGE_ANALYSIS', 'MIXED', null]).toContain(r.job);
  });
  it('a reporting window is never a plan horizon', () => {
    expect(readTemporalRoles('latest news from the last 90 days', 'en').map((t) => t.role)).toEqual(
      ['REPORTING_WINDOW'],
    );
    expect(readTemporalRoles('what happened 90 days ago', 'en').map((t) => t.role)).toEqual([
      'REPORTING_WINDOW',
    ]);
  });
  it('a trip length is TRIP_DURATION, a plan horizon is PLAN_HORIZON', () => {
    expect(readTemporalRoles('plan a 5-day trip to Kenya', 'en')[0]).toMatchObject({
      role: 'TRIP_DURATION',
      days: 5,
    });
    expect(readTemporalRoles('Turn that into a 90-day plan.', 'en')[0]).toMatchObject({
      role: 'PLAN_HORIZON',
      days: 90,
    });
    expect(readTemporalRoles('plan na 90 dni', 'pl')[0]).toMatchObject({
      role: 'PLAN_HORIZON',
      days: 90,
    });
  });
});

describe('R4 — UNRESOLVED questions: the semantic verdict decides, never a news default', () => {
  const q = 'Are we approaching our prime moment?';
  it('the router alone leaves it UNRESOLVED (the executor classifies before any news call)', () => {
    expect(route(q).source).toBe('UNRESOLVED');
  });
  it('a semantic "no current evidence" verdict routes to reasoning', () => {
    expect(
      route(q, 'en', { semanticJob: { job: 'DECISION_SUPPORT', needsCurrentEvidence: false } }),
    ).toMatchObject({ job: 'DECISION_SUPPORT', source: 'SEMANTIC', reasoning: true, news: false });
  });
  it('a semantic "current evidence" verdict keeps the evidence route', () => {
    expect(
      route(q, 'en', { semanticJob: { job: 'CURRENT_REPORTING', needsCurrentEvidence: true } })
        .reasoning,
    ).toBe(false);
  });
});

describe('R4 — readers (EN/PL parity)', () => {
  it.each([
    ['Turn that into a 90-day plan.', 'en', 'PLAN'],
    ['Przekształć to w plan na 90 dni.', 'pl', 'PLAN'],
    ['Podsumuj to.', 'pl', 'SUMMARY'],
    ['Rozwiń to głębiej.', 'pl', 'EXPLAIN_MORE'],
    ['Zrób z tego tabelę.', 'pl', 'TABLE'],
  ] as const)('%s → %s', (q, lang, kind) => {
    expect(readTransformation(q, lang)).toBe(kind);
  });
  it.each([
    ['Apply that idea to GlobalNewsAI.', 'en'],
    ['Which part is weakest?', 'en'],
    ['Zastosuj tę ideę do GlobalNewsAI.', 'pl'],
    ['Która część jest najsłabsza?', 'pl'],
  ] as const)('%s references earlier work', (q, lang) => {
    expect(referencesPriorWork(q, lang)).toBe(true);
  });
  it('"The First World War" is not a reference to earlier work', () => {
    expect(referencesPriorWork('What caused the First World War?', 'en')).toBe(false);
  });
  it('PL "Co powinniśmy z tym zrobić?" refers to earlier work like EN "about it"', () => {
    expect(referencesPriorWork('Co powinniśmy z tym zrobić?', 'pl')).toBe(true);
    expect(route('Co powinniśmy z tym zrobić?', 'pl', { priorWork: PRIOR }).reference).toBe(
      'PRIOR_WORK',
    );
  });
});

describe('R4 — sealed-eval post-inspection fixes (own wording, not the sealed items)', () => {
  it.each([
    ['Summarise what has happened in Sudan over the past week.', 'en'],
    ['What did markets do in the last few days?', 'en'],
    ['Co wydarzyło się w Chile w ostatnim tygodniu?', 'pl'],
  ] as const)('a reporting window without a number is news: %s', (q, lang) => {
    expect(route(q, lang).reasoning).toBe(false);
    expect(readTemporalRoles(q, lang).map((t) => t.role)).toContain('REPORTING_WINDOW');
  });
  it.each([
    ['How would that hold up for a family business?', 'en'],
    ['Is there a weaker version of it for charities?', 'en'],
    ['Co z tego, co zaproponowałeś, jest najtrudniejsze?', 'pl'],
  ] as const)('a pronoun follow-up resolves to the earlier work when one exists: %s', (q, lang) => {
    const r = route(q, lang, { priorWork: PRIOR });
    expect(r).toMatchObject({ reference: 'PRIOR_WORK', reasoning: true, news: false });
    expect(route(q, lang).reference).toBe('NONE');
  });
  it.each([
    ["What has changed in Kenya's economy?", 'en'],
    ['Co się zmieniło w gospodarce Kenii?', 'pl'],
  ] as const)(
    'a change question with no time marker is current evidence, never the reasoning fallback: %s',
    (q, lang) => {
      const r = route(q, lang);
      expect(r.source).not.toBe('UNRESOLVED');
      expect(r.reasoning).toBe(false);
    },
  );
  it('a pronoun follow-up that asks for current events stays news even with earlier work', () => {
    const r = route('What happened with that in the past week?', 'en', { priorWork: PRIOR });
    expect(r.reasoning).toBe(false);
  });
});

describe('R4 — MIXED survives (a stable part plus a current part is never collapsed)', () => {
  it.each([
    'What is inflation and what is the current inflation rate in Kenya?',
    'Explain what a central bank does and what the Bank of England decided this week.',
  ])('%s', (q) => {
    const r = route(q);
    expect(r.job).not.toBe('DEEP_CONCEPTUAL_ANALYSIS');
    expect(r.reasoning).toBe(false);
  });
});
