import { SELECTABLE_LOCALES } from '@/lib/i18n/languages';
import { shownAccountName } from '@/lib/account/accountName';
import { askGreetingStrings } from './askGreetingStrings';

/*
  E1-BIDI-2 (E1 ADDENDUM-25) — the greeting name is untrusted runtime data, so isolation is the
  DEFENCE: isolate the outside, sanitize the inside. Acceptance: isolates (not marks) around a
  sanitized name. The sanitizer is addressableName(), which REFUSES rather than strips, so a name
  carrying any bidi control renders the neutral greeting. Control characters are written as escapes.
*/
const FSI = '⁨';
const PDI = '⁩';
const ANY_BIDI = /[‎‏‪-‮⁦-⁩؜]/gu;

describe('E1-BIDI-2 · greeting name: sanitized inside, isolated outside', () => {
  it.each([
    ['planted RLM', 'Ami‏na'],
    ['unbalanced LRI', 'Amina⁦'],
    ['unbalanced FSI', '⁨Amina'],
    ['RLO override', 'Ami‮na'],
    ['planted LRM', '‎Amina'],
    ['Arabic letter mark', 'Amina؜'],
    ['stray PDI', 'Amina⁩'],
  ])('positive control: a name with a %s is neutralized (neutral greeting)', (_case, name) => {
    expect(shownAccountName({ displayName: name })).toBeNull();
  });

  it('a name over the length cap is neutralized; an empty one is neutral', () => {
    expect(shownAccountName({ displayName: 'A'.repeat(41) })).toBeNull();
    expect(shownAccountName({ displayName: '   ' })).toBeNull();
  });

  it.each(SELECTABLE_LOCALES.map((l) => [l]))(
    '%s: a clean name passes byte-identical, wrapped in exactly one balanced isolate pair',
    (locale) => {
      for (const clean of ['Amina K.', 'أمينة']) {
        const name = shownAccountName({ displayName: clean });
        expect(name).toBe(clean);
        const line = askGreetingStrings(locale).greet.morning(name!);
        expect(line).toContain(`${FSI}${clean}${PDI}`);
        expect(line.match(ANY_BIDI)).toEqual([FSI, PDI]);
      }
    },
  );
});
