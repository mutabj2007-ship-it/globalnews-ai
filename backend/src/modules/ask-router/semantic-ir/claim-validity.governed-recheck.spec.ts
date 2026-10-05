import { readClaimValidity } from './prior-claim';

/*
  SHARED GOVERNED RE-CHECK (CTO ruling A) — the claim-validity form, extended structurally:
  EN: one optional RECALL clause about the earlier answer may lead it ("What did you say earlier about that
      decision, and is it still true now?"); the recall object is anaphoric only, never a new proposition.
  PL: the natural word order "Czy to nadal jest prawdą?" (adverb before the verb, instrumental "prawdą").
  A turn that carries its own subject or proposition is never this form.
*/
describe('claim-validity form (EN / PL)', () => {
  it.each([
    ['Is that still true now?', 'en'],
    ['What did you say earlier about that decision, and is it still true now?', 'en'],
    ['What did you tell me before about that, and is it still accurate?', 'en'],
    ['Remind me what you said, is it still accurate?', 'en'],
    ['Czy to nadal jest prawdą?', 'pl'],
    ['Czy to jest nadal prawda?', 'pl'],
    ['Czy to wciąż aktualne?', 'pl'],
  ])('"%s" (%s) is the claim-validity form', (text, lang) => {
    expect(readClaimValidity(text, lang)).toBe(true);
  });

  it.each([
    ['What did you say about the Polish budget being cut by 10%, and is it still true now?', 'en'],
    ['Is Poland still in the EU?', 'en'],
    ['What did you say earlier?', 'en'],
    ['Is it raining in Kigali now?', 'en'],
    ['Czy Polska nadal jest w UE?', 'pl'],
  ])('"%s" (%s) is NOT the form (own subject / proposition, or no validity question)', (text, lang) => {
    expect(readClaimValidity(text, lang)).toBe(false);
  });
});
