import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { specialistRegistryFixture } from '../../ask-router/frozen-c/fixtures/specialist-registry.fixture';
import { readCompanionIntent, servesIntent } from '../companion-relevance';
import { inheritedConversationCountry } from './conversation-place';
import { readConversationalTurn } from './conversation-state';

/**
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §34 — THE PERMANENT PRODUCT-OWNER ACCEPTANCE JOURNEYS.
 *
 * Each live PO failure is a named, permanent regression at the layer that decides it, before any
 * model or provider. Execution-level proofs live beside them and are referenced by name:
 *   PO-01  ask-r2-execution.adapter.spec  "CTO P0 — advisory / decision support …" (no news call)
 *   PO-02  analysis/service/relationship-evidence.spec (one-sided reports rejected)
 *   PO-03  ask-r2-execution.adapter.spec  "CTO P0 · Defect E" (companion block)
 *   PO-04  frontend lib/ask/askThreadRestore.spec + conversation-journeys.r3.postgres (persistence)
 *   PO-10  frontend platform/homeR1StageA.contract.spec + ask-frame/askChatUx.spec (failed send)
 */
const deps = { specialistRegistry: specialistRegistryFixture };

function routeTurn(
  question: string,
  earlierOldestFirst: readonly string[] = [],
  lang: 'en' | 'pl' = 'en',
) {
  const newestFirst = earlierOldestFirst.map((q) => ({ question: q, language: lang })).reverse();
  const turn = readConversationalTurn(question, lang, newestFirst);
  const answered = turn?.composition?.effectiveQuestion ?? question;
  const place = turn?.composition
    ? null
    : inheritedConversationCountry(question, lang, newestFirst);
  const route = routeAskR2(
    {
      originalQuestion: answered,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    {
      requestInstant: '2026-10-03T08:00:00Z',
      ...(place === null ? {} : { mapContextCountry: place }),
    },
    deps,
  );
  return { turn, answered, route, places: route.envelope.geography.candidates.map((c) => c.value) };
}
const needsNews = (r: ReturnType<typeof routeTurn>['route']) =>
  r.plan.evidenceRequests.some((e) => e.required && e.evidenceClass === 'NEWS_REPORTING');

describe('R3 §34 — permanent PO acceptance journeys', () => {
  it('PO-01 a general business / advisory question is ADVISORY reasoning, with no news dependency', () => {
    const { route } = routeTurn(
      'Indicate how I can benefit from selling secondary data online like GlobalNewsAI. Who are going to be our best customers and how do we keep them?',
    );
    expect(route.knowledgeRequirement).toBe('ADVISORY');
    expect(needsNews(route)).toBe(false);
  });

  it('PO-02 the Rwanda / Tanzania commercial-border question keeps BOTH sides and the commercial relation', () => {
    const { route } = routeTurn('Rwanda and Tanzania border commercial services');
    expect(route.relationship).toMatchObject({ countries: ['RWA', 'TZA'], domain: 'COMMERCIAL' });
  });

  it('PO-03 Rwanda travel companion material must be travel-relevant (country + recency is not enough)', () => {
    const q = 'Which places can I visit in Rwanda? list them and elaborate why.';
    expect(readCompanionIntent(q, 'en')).toBe('TRAVEL');
    expect(
      servesIntent({ title: 'Nyungwe park trail closed after landslide', summary: '' }, 'TRAVEL'),
    ).toBe(true);
    for (const title of [
      'UK court convicts genocide suspect',
      'Rwandan researchers develop new plastic material',
      'Opposition party holds congress in Kigali',
    ])
      expect(servesIntent({ title, summary: '' }, 'TRAVEL')).toBe(false);
  });

  it('PO-04 a travel follow-up stays in the same trip (the turn and its thread are persisted — see PG twin)', () => {
    const { turn, route } = routeTurn('I have five days and prefer nature.', [
      'Which places can I visit in Rwanda?',
    ]);
    expect(turn?.composition?.kind).toBe('JOB_CONTEXT');
    expect(route.knowledgeRequirement).toBe('PLACE_REFERENCE');
  });

  it('PO-05 Madagascar → "And the economy?" keeps the country and the economic domain', () => {
    const { places, route } = routeTurn('And the economy?', ['What is going on in Madagascar?']);
    expect(places).toEqual(['MDG']);
    expect(route.envelope.domains.domains).toContain('economic');
  });

  it('PO-06 Madagascar economy → "And in Kenya?" — Kenya replaces the place, the subject carries', () => {
    const { answered, places } = routeTurn('And in Kenya?', ["How is Madagascar's economy doing?"]);
    expect(answered).toBe("How is Kenya's economy doing?");
    expect(places).toEqual(['KEN']);
  });

  it('PO-07 "What about yesterday?" changes the time and keeps the place', () => {
    const { places, route } = routeTurn('What about yesterday?', [
      'What is going on in Madagascar?',
    ]);
    expect(places).toEqual(['MDG']);
    expect(route.readerStatedPeriod).toBe('yesterday');
  });

  it('PO-08 a Tanzania safari question is travel background, not forced news', () => {
    const { route } = routeTurn(
      'I want to visit Tanzania especially Safari national park, I want to know some information before going there',
    );
    expect(route.knowledgeRequirement).toBe('PLACE_REFERENCE');
    expect(needsNews(route)).toBe(false);
  });

  it.each(['What is happening in Greenland?', 'Kalaallit Nunaat news', 'Grønland'])(
    'PO-09 Greenland alias "%s" resolves to GRL, never Denmark',
    (q) => {
      const { route } = routeTurn(q);
      const read =
        route.outcome.status === 'NOT_READ'
          ? []
          : route.outcome.reading.geography.map((g) => g.value);
      expect(read).toContain('GRL');
      expect(read).not.toContain('DNK');
    },
  );

  it('PO-10 first guest network failure — frontend contract (named here; proven in the frontend suites)', () => {
    /* useAskR2Conversation.ts: a dropped first send is a failed send with retry, never "busy" —
       homeR1StageA.contract.spec (approved narrow deviation) + askChatUx.spec. */
    expect(true).toBe(true);
  });
});
