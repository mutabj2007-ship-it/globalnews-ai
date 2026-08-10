import { resolveOrganizationAlias } from './organization-alias-resolver.util';

describe('resolveOrganizationAlias', () => {
  describe('exact canonical name matching', () => {
    it.each([
      'African Union',
      'Arab League',
      'European Union',
      'NATO',
      'OPEC',
      'United Nations',
      'World Health Organization',
    ])('resolves the canonical name "%s" to itself', (name) => {
      expect(resolveOrganizationAlias(name)).toEqual({
        canonical: name,
        matchedFrom: name,
      });
    });
  });

  describe('curated alias resolution', () => {
    it('resolves "UN" to "United Nations"', () => {
      expect(resolveOrganizationAlias('UN')).toEqual({
        canonical: 'United Nations',
        matchedFrom: 'UN',
      });
    });

    it('resolves "WHO" to "World Health Organization"', () => {
      expect(resolveOrganizationAlias('WHO')).toEqual({
        canonical: 'World Health Organization',
        matchedFrom: 'WHO',
      });
    });

    it('resolves "EU" to "European Union"', () => {
      expect(resolveOrganizationAlias('EU')).toEqual({
        canonical: 'European Union',
        matchedFrom: 'EU',
      });
    });

    it('is case-insensitive for alias lookup', () => {
      expect(resolveOrganizationAlias('un')?.canonical).toBe('United Nations');
      expect(resolveOrganizationAlias('Un')?.canonical).toBe('United Nations');
    });
  });

  describe('multiple aliases resolving to one canonical organization do not create separate entries', () => {
    it('"UN" and "United Nations" both resolve to the same canonical value', () => {
      const fromAlias = resolveOrganizationAlias('UN');
      const fromCanonical = resolveOrganizationAlias('United Nations');
      expect(fromAlias?.canonical).toBe(fromCanonical?.canonical);
      expect(fromAlias?.canonical).toBe('United Nations');
    });
  });

  describe('no fuzzy matching — near-misses of real organizations never resolve', () => {
    it.each(['Untied Nations', 'Unitde Nations', 'Nited Nations', 'UUN', 'Unted Nations'])(
      'does not resolve the near-miss "%s"',
      (nearMiss) => {
        expect(resolveOrganizationAlias(nearMiss)).toBeUndefined();
      },
    );
  });

  describe('unrelated organizations are not accidentally merged', () => {
    it('WHO and World Bank remain distinct canonical entities', () => {
      expect(resolveOrganizationAlias('WHO')?.canonical).toBe('World Health Organization');
      expect(resolveOrganizationAlias('World Bank')?.canonical).toBe('World Bank');
    });

    it('NATO and OPEC remain distinct and unresolved into each other', () => {
      expect(resolveOrganizationAlias('NATO')?.canonical).toBe('NATO');
      expect(resolveOrganizationAlias('OPEC')?.canonical).toBe('OPEC');
    });
  });

  describe('countries are explicitly out of scope, even ones commonly paired with organizations in news text', () => {
    it.each(['DRC', 'DR Congo', 'Democratic Republic of the Congo'])(
      'does not resolve the country name/alias "%s" (handled exclusively by the geographic resolver)',
      (countryTerm) => {
        expect(resolveOrganizationAlias(countryTerm)).toBeUndefined();
      },
    );
  });

  describe('unrelated / unknown input', () => {
    it('returns undefined for empty or whitespace-only input', () => {
      expect(resolveOrganizationAlias('')).toBeUndefined();
      expect(resolveOrganizationAlias('   ')).toBeUndefined();
    });

    it.each(['Google', 'Paul Kagame', 'Rwanda', 'Kigali', 'ceasefire'])(
      'does not resolve the unrelated term "%s"',
      (term) => {
        expect(resolveOrganizationAlias(term)).toBeUndefined();
      },
    );
  });
});
