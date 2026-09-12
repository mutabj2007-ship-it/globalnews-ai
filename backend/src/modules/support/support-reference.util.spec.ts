import {
  SUPPORT_REFERENCE_ALPHABET,
  SUPPORT_REFERENCE_BODY_LENGTH,
  SUPPORT_REFERENCE_PATTERN,
} from '@globalnews-ai/shared';
import {
  generateSupportReference,
  isSupportReference,
  normalizeSupportReference,
} from './support-reference.util';

/**
 * S2 — the reference generator.
 *
 * These tests are about two properties that are easy to lose in a
 * refactor and expensive to lose in production: the reference must stay
 * OPAQUE (never sequential, never volume-revealing) and it must stay
 * READABLE by a human who is reading it off a screen and typing it into
 * a form.
 */
describe('S2 — support reference generation', () => {
  it('produces the shape the S1 contract declares', () => {
    const reference = generateSupportReference();

    expect(reference).toMatch(SUPPORT_REFERENCE_PATTERN);
    expect(reference.startsWith('GN-')).toBe(true);
    expect(reference).toHaveLength(3 + SUPPORT_REFERENCE_BODY_LENGTH);
  });

  it('never emits I, L, O or U — a reference has to survive being read aloud', () => {
    const body = Array.from({ length: 400 }, () => generateSupportReference().slice(3)).join('');

    ['I', 'L', 'O', 'U'].forEach((letter) => {
      expect({ letter, present: body.includes(letter) }).toEqual({ letter, present: false });
    });
  });

  it('uses every character of the Crockford alphabet — a stuck generator is caught', () => {
    const body = Array.from({ length: 400 }, () => generateSupportReference().slice(3)).join('');
    const seen = new Set(body.split(''));

    expect(seen.size).toBe(SUPPORT_REFERENCE_ALPHABET.length);
    SUPPORT_REFERENCE_ALPHABET.split('').forEach((character) => {
      expect({ character, seen: seen.has(character) }).toEqual({ character, seen: true });
    });
  });

  it('does not repeat itself across ten thousand draws', () => {
    const references = new Set<string>();

    for (let index = 0; index < 10_000; index += 1) {
      references.add(generateSupportReference());
    }

    expect(references.size).toBe(10_000);
  });

  it('is NOT sequential — consecutive references share no common prefix', () => {
    // A counter dressed up as an identifier would show here: successive
    // values would differ only in their last characters.
    const first = generateSupportReference().slice(3);
    const second = generateSupportReference().slice(3);

    let sharedPrefix = 0;
    while (sharedPrefix < first.length && first[sharedPrefix] === second[sharedPrefix]) {
      sharedPrefix += 1;
    }

    // Two independent draws sharing 5+ leading characters has a
    // probability of about one in 33 million.
    expect(sharedPrefix).toBeLessThan(5);
  });

  describe('validation', () => {
    it('accepts a well-formed reference', () => {
      expect(isSupportReference('GN-7QK2M4XR9T')).toBe(true);
      expect(isSupportReference(generateSupportReference())).toBe(true);
    });

    it('REJECTS a sequential-looking reference — the appearance cannot come back', () => {
      expect(isSupportReference('GN-1042')).toBe(false);
      expect(isSupportReference('GN-2026-0001')).toBe(false);
    });

    it('rejects the excluded letters, the wrong length, and the wrong prefix', () => {
      [
        'GN-IQK2M4XR9T',
        'GN-LQK2M4XR9T',
        'GN-OQK2M4XR9T',
        'GN-UQK2M4XR9T',
        'GN-7QK2M4XR9',
        'GN-7QK2M4XR9TT',
        'XX-7QK2M4XR9T',
        '7QK2M4XR9T',
        '',
      ].forEach((candidate) => {
        expect({ candidate, accepted: isSupportReference(candidate) }).toEqual({
          candidate,
          accepted: false,
        });
      });
    });

    it('rejects lower case as-is — normalization is a separate, deliberate step', () => {
      expect(isSupportReference('gn-7qk2m4xr9t')).toBe(false);
      expect(isSupportReference(normalizeSupportReference('gn-7qk2m4xr9t'))).toBe(true);
    });
  });

  describe('normalization', () => {
    it('upper-cases and trims, so a pasted reference still finds its ticket', () => {
      expect(normalizeSupportReference('  gn-7qk2m4xr9t \n')).toBe('GN-7QK2M4XR9T');
    });

    it('leaves an already-normal reference untouched', () => {
      const reference = generateSupportReference();
      expect(normalizeSupportReference(reference)).toBe(reference);
    });
  });
});
