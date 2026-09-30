import { classifyQueryIntent } from './query-intent.util';
import { routeAskR2 } from '../../ask-router/ask-r2-route';
import { landedSpecialistRegistryPort } from '../../ask-router/specialist-registry.port';

/**
 * ASK CONVERSATIONAL BREADTH R1 — conceptual and reflective QUESTION SHAPES reach the existing
 * EXPLANATION → REFERENCE_BACKGROUND_ONLY path; currentness still outranks them.
 *
 * The fix is the shape, never the noun: every conceptual case below is paired with a control
 * that uses the SAME nouns in a current-event shape and must stay news.
 */
const route = (q: string, lang: 'en' | 'pl' = 'en') =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: lang,
      normalizationLanguage: lang,
      displayLanguage: lang,
      origin: 'ASK',
    },
    { computeConsent: 'GRANTED', requestInstant: '2026-09-30T10:00:00Z', identityVerified: true },
    { specialistRegistry: landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT']) },
  );

describe('the live Alpha failure', () => {
  const LIVE = 'What do you think life is? How can I link it to death and resurrection?';

  it('BEFORE: CURRENT_EVENT default → CURRENT_REPORTING, an empty news search. AFTER: EXPLANATION → REFERENCE_BACKGROUND_ONLY', () => {
    expect(classifyQueryIntent(LIVE).intent).toBe('EXPLANATION');
    const r = route(LIVE);
    expect(r.plan.questionClass).toBe('REFERENCE');
    expect(r.plan.terminalState).toBe('REFERENCE_BACKGROUND_ONLY');
    /* no reporting is requested at all */
    expect(r.plan.evidenceRequests.filter((e) => e.required)).toEqual([]);
  });

  it('currentness outranks it: "What do you think is happening in Ukraine today?" is news', () => {
    const r = route('What do you think is happening in Ukraine today?');
    expect(r.plan.questionClass).toBe('CURRENT_REPORTING');
    expect(r.plan.terminalState).toBe('EXECUTABLE');
  });
});

describe('conceptual, religious, philosophical and ethical shapes → background (EN / PL)', () => {
  it.each([
    ['What do you think life is?', 'en'],
    ['How can I link life to death and resurrection?', 'en'],
    ['How should I think about death?', 'en'],
    ['What is the relationship between faith and hope?', 'en'],
    ['How can I connect grief with meaning?', 'en'],
    ['What does resurrection mean in Christianity?', 'en'],
    ['What do philosophers mean by a meaningful life?', 'en'],
    ['How can I understand forgiveness in Islam?', 'en'],
    ['Is it ethical to lie to protect someone?', 'en'],
    /* the same shapes with unrelated nouns — the shape is what matters */
    ['What do you think friendship is?', 'en'],
    ['How should I think about ambition?', 'en'],
    ['What do economists mean by opportunity cost?', 'en'],
    ['Is it wrong to break a promise to a friend?', 'en'],
    ['Co myślisz, czym jest sprawiedliwość?', 'pl'],
    ['Jak mogę pogodzić wiarę z wątpliwościami?', 'pl'],
    ['Czym jest życie i jak połączyć je ze śmiercią i zmartwychwstaniem?', 'pl'],
    ['Co filozofowie rozumieją przez sens życia?', 'pl'],
    ['Czy etyczne jest kłamać, aby kogoś chronić?', 'pl'],
  ] as const)('%s → REFERENCE_BACKGROUND_ONLY', (q, lang) => {
    const r = route(q, lang);
    expect({ q, terminal: r.plan.terminalState }).toEqual({
      q,
      terminal: 'REFERENCE_BACKGROUND_ONLY',
    });
  });

  it('a compound question is read by its first clause (and the whole text is still gated for currentness)', () => {
    expect(route('What is NATO and how does it work?').plan.terminalState).toBe(
      'REFERENCE_BACKGROUND_ONLY',
    );
    expect(
      route('What is inflation and what is happening to prices today?').plan.questionClass,
    ).toBe('CURRENT_REPORTING');
  });
});

describe('controls: the same vocabulary in a current-event shape stays news', () => {
  it.each([
    ['What do you think is happening in Ukraine today?', 'en'],
    ['What does the latest fighting in Gaza mean?', 'en'],
    ['How is the current war affecting religious communities?', 'en'],
    ['How should I think about the war in Sudan?', 'en'],
    ['What does the new tariff deal mean for Europe?', 'en'],
    ['Is it ethical to deploy the new AI model in schools?', 'en'],
    ['What do you think about the latest church news?', 'en'],
    ['Co myślisz o najnowszych wiadomościach z Watykanu?', 'pl'],
  ] as const)('%s → never background', (q, lang) => {
    expect({ q, terminal: route(q, lang).plan.terminalState }).not.toEqual({
      q,
      terminal: 'REFERENCE_BACKGROUND_ONLY',
    });
  });

  it('SUPERSEDED (PR #72 CTO correction): freshness is scoped to ROUTING — never background there, while retrieval keeps the subject', () => {
    const routing = { freshnessOutranksBackground: true };
    expect(classifyQueryIntent('What does resurrection mean in Christianity', routing).intent).toBe(
      'EXPLANATION',
    );
    expect(classifyQueryIntent('What does the new ruling mean for churches', routing).intent).toBe(
      'CURRENT_EVENT',
    );
    expect(classifyQueryIntent('Explain the new EU AI regulation', routing).intent).toBe(
      'CURRENT_EVENT',
    );
    /* the retrieval classification inside the one reporting call still extracts the subject */
    const retrieval = classifyQueryIntent('Explain the new EU AI regulation');
    expect(retrieval).toMatchObject({ intent: 'EXPLANATION', subject: 'EU AI regulation' });
  });
});

describe('PR #72 CTO correction — asserted freshness outranks EVERY background frame, a proper name does not', () => {
  it.each([
    ['What does the new law mean?', 'en'],
    ['Explain the newly announced policy.', 'en'],
    ['Co oznacza nowa ustawa dla firm?', 'pl'],
    ['What does the proposed rule mean for landlords?', 'en'],
    ['What is the announced ceasefire?', 'en'],
    ['Explain the just passed budget.', 'en'],
    ['Describe the upcoming reform.', 'en'],
    ['What does breaking news about the pope mean?', 'en'],
    ['Who is the new pope?', 'en'],
    ['Czym jest zapowiedziana reforma?', 'pl'],
    ['Co to jest nowe rozporządzenie o cłach?', 'pl'],
    ['What is the new EU AI law?', 'en'],
    ['Explain the new EU AI regulation in plain English', 'en'],
  ] as const)('FRESH: %s → never background', (q, lang) => {
    expect({ q, terminal: route(q, lang).plan.terminalState }).not.toEqual({
      q,
      terminal: 'REFERENCE_BACKGROUND_ONLY',
    });
  });

  it.each([
    ['What is the New Testament?', 'en'],
    ['What is the New Deal?', 'en'],
    ['What is a new moon?', 'en'],
    ['What does New Year mean in Christianity?', 'en'],
    ['Co to jest Nowy Testament?', 'pl'],
    ['Is it just to lie to protect someone?', 'en'],
  ] as const)(
    'STABLE: %s → background (a name or concept containing "new"/"just" is not freshness)',
    (q, lang) => {
      expect({ q, terminal: route(q, lang).plan.terminalState }).toEqual({
        q,
        terminal: 'REFERENCE_BACKGROUND_ONLY',
      });
    },
  );

  it('the live question stays background; the Ukraine control stays current reporting', () => {
    expect(
      route('What do you think life is? How can I link it to death and resurrection?').plan
        .terminalState,
    ).toBe('REFERENCE_BACKGROUND_ONLY');
    expect(route('What do you think is happening in Ukraine today?').plan.questionClass).toBe(
      'CURRENT_REPORTING',
    );
  });
});
