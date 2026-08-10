import { resolveGeoTypo } from './geo-fuzzy-resolver';

describe('resolveGeoTypo', () => {
  describe('the six milestone examples resolve to the expected curated entity', () => {
    it('resolves "Kigalli" to Kigali (city, insertion typo)', () => {
      const match = resolveGeoTypo('Kigalli');
      expect(match).toBeDefined();
      expect(match?.canonicalLocation).toBe('kigali');
      expect(match?.matchKind).toBe('city');
      expect(match?.matchedFrom).toBe('kigalli');
    });

    it('resolves "Kigal" to Kigali (city, deletion typo)', () => {
      const match = resolveGeoTypo('Kigal');
      expect(match).toBeDefined();
      expect(match?.canonicalLocation).toBe('kigali');
      expect(match?.matchKind).toBe('city');
    });

    it('resolves "Rwnada" to Rwanda (country, transposition typo)', () => {
      const match = resolveGeoTypo('Rwnada');
      expect(match).toBeDefined();
      expect(match?.canonicalLocation).toBe('rwanda');
      expect(match?.matchKind).toBe('country');
    });

    it('resolves "Spian" to Spain (country, transposition typo)', () => {
      const match = resolveGeoTypo('Spian');
      expect(match).toBeDefined();
      expect(match?.canonicalLocation).toBe('spain');
      expect(match?.matchKind).toBe('country');
    });

    it('resolves "Pariss" to Paris (city, insertion typo)', () => {
      const match = resolveGeoTypo('Pariss');
      expect(match).toBeDefined();
      expect(match?.canonicalLocation).toBe('paris');
      expect(match?.matchKind).toBe('city');
    });

    it('resolves "Londn" to London (city, deletion typo)', () => {
      const match = resolveGeoTypo('Londn');
      expect(match).toBeDefined();
      expect(match?.canonicalLocation).toBe('london');
      expect(match?.matchKind).toBe('city');
    });

    it('every resolved match carries a matchConfidence of at least 80', () => {
      for (const candidate of ['Kigalli', 'Kigal', 'Rwnada', 'Spian', 'Pariss', 'Londn']) {
        const match = resolveGeoTypo(candidate);
        expect(match?.matchConfidence).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('protected short geographic names are never fuzzy targets', () => {
    it.each(['Chad', 'Iran', 'Iraq', 'Togo', 'Laos', 'Mali', 'Peru', 'Cuba'])(
      'never resolves a near-miss of the short name "%s"',
      (name) => {
        // A single-character edit of a 4-letter name (e.g. one letter
        // swapped for an adjacent keyboard letter) must never resolve,
        // because the canonical name itself is below MIN_TARGET_LENGTH
        // and therefore excluded from the fuzzy target pool entirely.
        const nearMiss = `${name[0]}${name[1]}${name[2]}x`;
        expect(resolveGeoTypo(nearMiss)).toBeUndefined();
      },
    );

    it('does not resolve exact-spelled short names either (not this module\'s concern)', () => {
      expect(resolveGeoTypo('Chad')).toBeUndefined();
      expect(resolveGeoTypo('Iran')).toBeUndefined();
      expect(resolveGeoTypo('Iraq')).toBeUndefined();
    });
  });

  describe('exact spellings are never rewritten by this module', () => {
    it('does not "resolve" a correctly-spelled country to itself', () => {
      expect(resolveGeoTypo('Jordan')).toBeUndefined();
      expect(resolveGeoTypo('Rwanda')).toBeUndefined();
      expect(resolveGeoTypo('Kigali')).toBeUndefined();
    });
  });

  describe('Iran/Iraq must never cross-correct', () => {
    it('a near-miss of "Iran" never resolves to "Iraq" or vice versa', () => {
      expect(resolveGeoTypo('Iras')).toBeUndefined();
      expect(resolveGeoTypo('Iraz')).toBeUndefined();
    });
  });

  describe('ambiguous curated entities fail closed', () => {
    it('"ambia" is equidistant from Zambia and Gambia and must remain unresolved', () => {
      // Zambia and Gambia differ from each other only in their first
      // letter, so a candidate missing that first letter is a genuine,
      // real tie in the curated data — not a contrived example.
      expect(resolveGeoTypo('ambia')).toBeUndefined();
    });
  });

  describe('unknown / unrelated words never resolve', () => {
    it.each(['Obama', 'Google', 'Messi', 'Zelensky', 'Milei', 'Reddit', 'Microsoft'])(
      'does not resolve the unrelated word "%s"',
      (word) => {
        expect(resolveGeoTypo(word)).toBeUndefined();
      },
    );
  });

  describe('input hygiene', () => {
    it('returns undefined for empty or whitespace-only input', () => {
      expect(resolveGeoTypo('')).toBeUndefined();
      expect(resolveGeoTypo('   ')).toBeUndefined();
    });

    it('returns undefined for multi-word input (out of scope for this milestone)', () => {
      expect(resolveGeoTypo('new delhi typo')).toBeUndefined();
      expect(resolveGeoTypo('south sudn')).toBeUndefined();
    });

    it('is case-insensitive', () => {
      expect(resolveGeoTypo('KIGALLI')?.canonicalLocation).toBe('kigali');
      expect(resolveGeoTypo('rWnAdA')?.canonicalLocation).toBe('rwanda');
    });
  });
});
