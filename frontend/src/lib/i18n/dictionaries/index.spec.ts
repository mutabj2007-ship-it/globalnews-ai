import { getDictionary } from './index';

/**
 * Milestone #47 (homepage integration) — these tests exist specifically
 * to prove the homepage Hero localization did not alter a single
 * existing English string. Every `en.hero.*` assertion below is the
 * EXACT original hardcoded string from the pre-Milestone-#47 Hero.tsx,
 * verified against the real component in a companion harness — this
 * file guards the dictionary side of that guarantee permanently.
 */
describe('Milestone #47 (homepage integration) — hero dictionary', () => {
  it('English hero strings are byte-identical to the original hardcoded Hero.tsx text', () => {
    const en = getDictionary('en');
    expect(en.hero.badge).toBe('AI-powered news intelligence');
    expect(en.hero.headline).toBe('Understand today\u2019s world in seconds.');
    expect(en.hero.subhead).toBe(
      'Ask a question about any story and GlobalNews AI reads the coverage across outlets and viewpoints, then gives you a clear, sourced summary you can trust.',
    );
    expect(en.hero.inputPlaceholder).toBe('Ask anything...');
    expect(en.hero.inputAriaLabel).toBe('Ask GlobalNews AI a question');
    expect(en.hero.formAriaLabel).toBe('Ask GlobalNews AI');
    expect(en.hero.submitAriaLabel).toBe('Submit question');
    expect(en.hero.tryPrefix).toBe('Try:');
    expect(en.hero.exampleQuestions).toEqual([
      'What\u2019s happening in the Middle East right now?',
      'Explain the new EU AI regulation in plain English',
      'Summarize today\u2019s central bank announcement',
      'What are scientists saying about the latest climate report?',
      'Break down this week\u2019s tech earnings',
      'What changed in the election polling this week?',
    ]);
  });

  it('Polish hero strings are present, non-empty, and distinct from English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    const stringKeys = [
      'badge',
      'headline',
      'subhead',
      'inputPlaceholder',
      'inputAriaLabel',
      'formAriaLabel',
      'submitAriaLabel',
      'tryPrefix',
    ] as const;

    for (const key of stringKeys) {
      expect(pl.hero[key].length).toBeGreaterThan(0);
      expect(pl.hero[key]).not.toBe(en.hero[key]);
    }

    expect(pl.hero.exampleQuestions).toHaveLength(6);
    expect(en.hero.exampleQuestions).toHaveLength(6);

    for (let i = 0; i < en.hero.exampleQuestions.length; i += 1) {
      expect(pl.hero.exampleQuestions[i].length).toBeGreaterThan(0);
      expect(pl.hero.exampleQuestions[i]).not.toBe(en.hero.exampleQuestions[i]);
    }
  });

  it('an unimplemented language falls back to the English hero dictionary, not an error or empty object', () => {
    const fallback = getDictionary('sw');
    expect(fallback.hero.badge).toBe('AI-powered news intelligence');
  });

  it('Dictionary type is now a proper shared structural shape (en and pl both satisfy it) — regression guard for the as-const type bug found during homepage integration', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    expect(Object.keys(en.hero).sort()).toEqual(Object.keys(pl.hero).sort());
  });
});
