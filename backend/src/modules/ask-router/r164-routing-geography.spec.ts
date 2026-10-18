import { routeAskR2, type AskR2Route } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { maskMonthTimes, maskNegatedPlaces } from './normalization/qualified-reading';

/*
  CTO R164 — EA R161 R-1 / R-2 (and R-3/R-5/R-6, the same one-place collapse): the countries a question
  names reach the envelope retrieval reads. Main's own cases; EA reviews independently with its own
  frozen fixture.
*/
const route = (q: string, prior?: string): AskR2Route =>
  routeAskR2(
    {
      originalQuestion: q,
      sourceLanguage: 'en',
      normalizationLanguage: 'en',
      displayLanguage: 'en',
      origin: 'ASK',
    } as never,
    {
      requestInstant: '2026-10-18T12:00:00Z',
      ...(prior === undefined ? {} : { priorQuestion: prior }),
    },
    { specialistRegistry: specialistRegistryFixture },
  );
const typed = (r: AskR2Route): string[] =>
  r.envelope.geography.candidates.filter((c) => c.source === 'TYPED_GEOGRAPHY').map((c) => c.value);

describe('R-1 · a month written as a time is not a place', () => {
  it.each([
    ['What happened in South Sudan in August 2026?', ['SSD']],
    ['What happened in Kenya in August 2026?', ['KEN']],
    ['What happened in South Sudan in August?', ['SSD']],
    ['Any news from Tanzania since March?', ['TZA']],
    ['What happened in Rwanda on 3 May 2026?', ['RWA']],
    ['What happened in Rwanda in September 2026?', ['RWA']],
  ])('%s → %j', (q, want) => {
    expect(typed(route(q))).toEqual(want);
  });

  it('the mask keeps length and leaves a month that is not a time alone', () => {
    const t = 'Kenya in August 2026; the March on Washington';
    expect(maskMonthTimes(t)).toHaveLength(t.length);
    expect(maskMonthTimes(t)).not.toMatch(/August/);
    expect(maskMonthTimes(t)).toMatch(/March on Washington/);
  });
});

describe('R-2 · a rejected country is never the one searched', () => {
  it.each([
    ['No, not Kenya. I meant Tanzania.', "What's happening in Kenya this week?", 'TZA', 'KEN'],
    [
      'No, not Congo-Brazzaville. I meant the DRC.',
      "What's new in Congo-Brazzaville?",
      'COD',
      'COG',
    ],
    ['Not Congo-Brazzaville, I meant DR Congo.', "What's new in Congo-Brazzaville?", 'COD', 'COG'],
  ])('%s', (q, prior, want, never) => {
    const t = typed(route(q, prior));
    expect(t).toContain(want);
    expect(t).not.toContain(never);
  });

  it('controls: "Sorry, I meant …" and "And what about …" are unchanged', () => {
    expect(
      typed(route('Sorry, I meant Tanzania.', "What's happening in Kenya this week?")),
    ).toEqual(['TZA']);
    expect(
      typed(route('And what about Burundi?', "What's happening in Rwanda this week?")),
    ).toEqual(['BDI']);
  });

  it('a negation without a correction is not masked ("not only Kenya")', () => {
    expect(maskNegatedPlaces('Is it not Kenya that leads the region?')).toMatch(/Kenya/);
  });
});

describe('R-3 / R-5 / R-6 · every named country reaches the envelope', () => {
  it.each([
    ['Rwanda and DR Congo: what changed this week?', ['RWA', 'COD']],
    ['Compare inflation in Kenya and Brazil this year', ['KEN', 'BRA']],
    ['Compare Rwanda and Denmark on internet access', ['RWA', 'DNK']],
    ['How is the war in Gaza affecting Kenya?', ['PSE', 'KEN']],
    ['What impact does the Gaza conflict have on Kenyan trade this month?', ['PSE', 'KEN']],
  ])('%s', (q, want) => {
    expect(typed(route(q))).toEqual(expect.arrayContaining(want));
  });

  it('a demonym outside an impact question stays a passing mention', () => {
    expect(typed(route('Kenyan runner wins the Berlin marathon. What happened?'))).not.toContain(
      'KEN',
    );
  });

  it('single-country and worldwide questions are unchanged', () => {
    expect(typed(route("What's happening in Brazil this week?"))).toEqual(['BRA']);
    expect(typed(route('What happened with AI regulation this week?'))).toEqual([]);
  });

  it('a bilateral relationship keeps its own two-sided scope (its lane searches both)', () => {
    const r = route('What is the relationship between Rwanda and DR Congo right now?');
    expect(r.relationship?.countries).toEqual(['RWA', 'COD']);
  });
});

describe('EA R164 NR-1 · an excluded or contrasted place is not searched', () => {
  it.each([
    ['What happened in Kenya, not Tanzania, this week?', ['KEN'], 'TZA'],
    ['Tell me about Uganda rather than Kenya', ['UGA'], 'KEN'],
    ['What is happening in East Africa other than Rwanda?', [], 'RWA'],
    ['Any news from Kenya, excluding Somalia?', ['KEN'], 'SOM'],
  ])('%s', (q, want, never) => {
    const t = typed(route(q));
    expect(t).toEqual(expect.arrayContaining(want));
    expect(t).not.toContain(never);
  });

  it('a turn that opens by rejecting a place: "Not Rwanda. Burundi instead." → BDI', () => {
    const t = typed(route('Not Rwanda. Burundi instead.', "What's happening in Rwanda this week?"));
    expect(t).toContain('BDI');
    expect(t).not.toContain('RWA');
  });

  it('"not only … but also …" keeps both places', () => {
    expect(typed(route('What is happening not only in Kenya but also in Uganda?'))).toEqual(
      expect.arrayContaining(['KEN', 'UGA']),
    );
  });

  it('an impact question carries a demonym origin: "the Kenyan election affect Uganda"', () => {
    expect(typed(route('How does the Kenyan election affect Uganda?'))).toEqual(
      expect.arrayContaining(['UGA', 'KEN']),
    );
  });
});
