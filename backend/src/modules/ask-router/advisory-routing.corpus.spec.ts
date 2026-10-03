import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { readAdvisory } from './advisory-requirement';

/**
 * CTO P0 — the ADVISORY / DECISION-SUPPORT acceptance corpus, through the real integrated router.
 * Broad paraphrases per category (not the reported sentence alone), EN and PL, plus explicit
 * latest/current variants as negative controls. "news" here means a REQUIRED NEWS_REPORTING
 * evidence request — the news pipeline.
 */
function route(q: string, lang: 'en' | 'pl' = 'en') {
  const r = routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { requestInstant: '2026-10-03T12:00:00Z' },
    { specialistRegistry: specialistRegistryFixture },
  );
  return {
    knowledge: r.knowledgeRequirement,
    terminal: r.plan.terminalState,
    news: r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING'),
    currentEvidenceNeeded: r.currentEvidenceNeeded,
  };
}

/** The live Product Owner question, operation 11218ecd-0096-4e0f-83ca-7b9eef646af9 (historical failing control). */
const PO_QUESTION =
  'You have been programmed to being conversational and could be directive to offer advice based on your knowledge, indicate how a I can benefit from selling secondary data online like GlobalNewsAI will be doing. Who are going to be our best customers and what techniques are we going to implement to keep them around?';

const ADVISORY: Record<string, [string, 'en' | 'pl'][]> = {
  'historical failing control (live op 11218ecd)': [[PO_QUESTION, 'en']],
  'business strategy': [
    ['How should a small analytics startup position itself against bigger competitors?', 'en'],
    ['What should we consider before expanding our consultancy into a second market?', 'en'],
    ['How can I benefit from building a data business around public information?', 'en'],
  ],
  'customer segmentation': [
    ['Who are the likely customers for a secondary-data intelligence service?', 'en'],
    ['Which customer segments should a B2B research tool target first?', 'en'],
    ['Kto jest klientem docelowym dla usługi analizy danych?', 'pl'],
  ],
  monetization: [
    ['How should I monetize a news intelligence product?', 'en'],
    ['What pricing model would you suggest for a niche data API?', 'en'],
    ['Jak powinienem zarabiać na produkcie z analizą wiadomości?', 'pl'],
  ],
  retention: [
    ['What customer-retention techniques should GlobalNewsAI use?', 'en'],
    ['How can we reduce churn in a subscription research product?', 'en'],
    ['Jak możemy poprawić utrzymanie klientów w naszej firmie?', 'pl'],
  ],
  'product feature planning': [
    ['Which features should our product roadmap prioritise next quarter?', 'en'],
    ['Help me prioritise features for an MVP of a monitoring dashboard.', 'en'],
  ],
  'organisational / process advice': [
    ['How should we design the onboarding workflow for new analysts?', 'en'],
    ['What would you recommend for structuring a small editorial team?', 'en'],
  ],
  'writing / planning': [
    ['Help me plan a launch announcement for our platform.', 'en'],
    ['Give me some tips for writing a clear executive summary.', 'en'],
  ],
  'stable comparison / trade-offs': [
    ['Compare subscriptions, usage pricing and enterprise contracts for this product.', 'en'],
    ['What are the pros and cons of freemium versus a free trial?', 'en'],
    ['Jakie są zalety i wady modelu subskrypcyjnego?', 'pl'],
  ],
};

describe('advisory / decision support → general guidance from the background reasoning provider, no news', () => {
  for (const [category, questions] of Object.entries(ADVISORY)) {
    it.each(questions)(`${category}: %s`, (q, lang) => {
      expect(route(q, lang)).toMatchObject({
        knowledge: 'ADVISORY',
        terminal: 'REFERENCE_BACKGROUND_ONLY',
        news: false,
      });
    });
  }
});

describe('mixed advisory + current → the advice is answered, the current part is named', () => {
  it.each([
    [
      'How should I sell this service, and what are competitors charging today?',
      'competitors charging today',
    ],
    [
      'What pricing should we use, and what is the latest price of competitor tools?',
      'latest price',
    ],
  ])('%s', (q, timedPart) => {
    const r = route(q);
    expect(r).toMatchObject({
      knowledge: 'MIXED_ADVISORY_CURRENT',
      terminal: 'REFERENCE_BACKGROUND_ONLY',
      news: false,
    });
    expect(r.currentEvidenceNeeded.join(' ')).toContain(timedPart);
  });
});

describe('negative controls — genuine freshness, current facts and news stay on the current path', () => {
  it.each([
    'What are companies currently paying for competitor X in October 2026?',
    "Based on today's market, which competitors changed their pricing?",
    'What did the IMF recommend for Kenya today?',
    'What is going on in Madagascar?',
    'How should the government respond to the strike?',
    'How should I think about the war in Sudan?',
    'Should we worry about the election crisis in Mali?',
    'Latest news about subscription price rises',
  ])('%s → not advisory', (q) => {
    const r = route(q);
    expect(r.knowledge).not.toBe('ADVISORY');
    expect(r.knowledge).not.toBe('MIXED_ADVISORY_CURRENT');
  });

  it('ordinary explanatory questions keep their existing stable path', () => {
    expect(route('How does photosynthesis work?').knowledge).toBe('STABLE_REFERENCE');
    expect(route('Why is the sky blue?').terminal).toBe('REFERENCE_BACKGROUND_ONLY');
  });

  it('a topic noun is not time: "news intelligence product" is not freshness', () => {
    expect(readAdvisory('How should I monetize a news intelligence product?', 'en')?.mode).toBe(
      'ADVISORY',
    );
  });

  it('"strategy" alone is a public-affairs subject, not a request for advice', () => {
    expect(readAdvisory("What is Russia's strategy in Ukraine?", 'en')).toBeNull();
  });

  it('reported speech is not a request for advice', () => {
    expect(readAdvisory('What did the central bank recommend yesterday?', 'en')).toBeNull();
  });
});

describe('a public event as the subject is current affairs, unless it is about the reader’s own venture', () => {
  it('a decision frame about a war, election or crisis alone is not advice (EN + PL)', () => {
    expect(readAdvisory('How should I think about the war in Sudan?', 'en')).toBeNull();
    expect(readAdvisory('Jak powinienem rozumieć wojnę w Sudanie?', 'pl')).toBeNull();
  });

  it('the same event inside the reader’s own planning stays advisory', () => {
    expect(
      readAdvisory('How should our company adapt its pricing model to the sanctions?', 'en')?.mode,
    ).toBe('ADVISORY');
  });

  it('a Polish "choice" (wyboru) is not an election', () => {
    expect(readAdvisory('Co polecasz do wyboru na start?', 'pl')?.mode).toBe('ADVISORY');
  });
});
