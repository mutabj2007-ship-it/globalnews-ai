import { withoutTerms } from './askR2View';

/**
 * ASK PUBLIC BETA RETRIEVAL REPAIR R1 — BETA-ASK-001. The broadening suggestion removes a
 * stated period WITH the words that govern it, and never offers a sentence left broken.
 */

const Q1 =
  'What has changed in eastern Democratic Republic of the Congo over the last 7 days? Identify any verified security or territorial changes, effects on civilians or displacement, and any important claims that remain disputed. Separate confirmed facts from analytical inference, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.';

describe('BETA-ASK-001 — the broadening suggestion is always grammatical', () => {
  it('the live Q1: "over the last 7 days" goes as a whole; the rest is preserved exactly', () => {
    const out = withoutTerms(Q1, ['last 7 days'], ['last 7 days']);
    expect(out).toBe(
      'What has changed in eastern Democratic Republic of the Congo? Identify any verified security or territorial changes, effects on civilians or displacement, and any important claims that remain disputed. Separate confirmed facts from analytical inference, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.',
    );
    expect(out).not.toMatch(/over the\?|the\?|\s\?/);
  });

  it.each([
    ['What changed in Poland this week?', 'this week', 'What changed in Poland?'],
    ['What happened in Kenya in the past 24 hours?', 'past 24 hours', 'What happened in Kenya?'],
    ['What happened in Kenya during the last week?', 'last week', 'What happened in Kenya?'],
    ['Over the last 7 days, what changed in Rwanda?', 'last 7 days', 'What changed in Rwanda?'],
    [
      'What changed in Rwanda over the last 30 days, and why?',
      'last 30 days',
      'What changed in Rwanda, and why?',
    ],
  ])('%s', (question, period, expected) => {
    expect(withoutTerms(question, [period], [period])).toBe(expected);
  });

  it('a removal that would still leave a dangling word offers no suggestion rather than a broken one', () => {
    /* "over" governs "the next" here, not the period as typed — the guard refuses the result. */
    expect(
      withoutTerms('What will change over the next of 7 days?', ['7 days'], ['7 days']),
    ).toBeNull();
    /* A non-time term whose removal strands its article is refused too. */
    expect(withoutTerms('What changed in the energy market?', ['energy market'])).toBeNull();
    /* A dangling word the reader already wrote is not the suggestion's fault. */
    expect(withoutTerms('What is going on in Kenya this week?', ['this week'], ['this week'])).toBe(
      'What is going on in Kenya?',
    );
  });

  it('non-time terms keep the existing whole-word behaviour', () => {
    expect(withoutTerms('Is today a holiday today?', ['today'])).toBe('Is a holiday today?');
    expect(withoutTerms('Todays news?', ['today'])).toBeNull();
    expect(withoutTerms('Anything?', [])).toBeNull();
  });
});
