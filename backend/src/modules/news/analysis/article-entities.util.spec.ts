import { extractArticleEntities } from './article-entities.util';

describe('extractArticleEntities', () => {
  it('extracts countries, organizations, events and topics from a conflict article', () => {
    const result = extractArticleEntities({
      title: 'Sudan conflict intensifies as United Nations calls for a ceasefire',
      summary:
        'The military conflict has displaced families across Sudan and created a humanitarian crisis.',
    });

    expect(result.countries).toContain('Sudan');
    expect(result.organizations).toContain('United Nations');
    expect(result.events).toEqual(
      expect.arrayContaining(['conflict', 'ceasefire', 'humanitarian crisis']),
    );
    expect(result.topics).toEqual(expect.arrayContaining(['conflict', 'humanitarian']));
  });

  it('extracts multiple countries without duplicating them', () => {
    const result = extractArticleEntities({
      title: 'Kenya and Uganda sign a regional trade agreement',
      summary: 'Kenya said the agreement with Uganda would improve trade across East Africa.',
    });

    expect(result.countries).toEqual(expect.arrayContaining(['Kenya', 'Uganda']));

    expect(result.countries.filter((country) => country === 'Kenya')).toHaveLength(1);
  });

  it('extracts organizations and companies separately', () => {
    const result = extractArticleEntities({
      title: 'OPEC meets as Shell and BP review oil production',
      summary:
        'The Organization of the Petroleum Exporting Countries discussed crude supply and energy markets.',
    });

    expect(result.organizations).toContain('OPEC');

    expect(result.companies).toEqual(expect.arrayContaining(['Shell', 'BP']));

    expect(result.topics).toEqual(expect.arrayContaining(['energy', 'markets']));
  });

  it('extracts explicit currencies without treating the yen symbol ambiguously', () => {
    const result = extractArticleEntities({
      title: 'Euro rises while the US dollar weakens',
      summary: 'Analysts compared EUR, USD and the Chinese yuan during market trading.',
    });

    expect(result.currencies).toEqual(expect.arrayContaining(['EUR', 'USD', 'CNY']));

    expect(result.currencies).not.toContain('JPY');
  });

  it('extracts Rwanda-related intelligence entities', () => {
    const result = extractArticleEntities({
      title: 'Rwanda election preparations continue across Kigali City',
      summary: 'The election process and government planning remain under review.',
    });

    expect(result.countries).toContain('Rwanda');
    expect(result.locations).toContain('Kigali City');
    expect(result.events).toContain('election');
    expect(result.topics).toContain('politics');
  });

  it('extracts a titled person but avoids classifying organizations as people', () => {
    const result = extractArticleEntities({
      title: 'President Paul Kagame addresses the African Union summit',
      summary: 'The speech focused on regional trade and economic cooperation.',
    });

    expect(result.people).toContain('Paul Kagame');
    expect(result.organizations).toContain('African Union');
    expect(result.events).toContain('summit');
    expect(result.people).not.toContain('African Union');
  });

  it('returns empty arrays for an empty article', () => {
    const result = extractArticleEntities({
      title: '',
      summary: '',
    });

    expect(result).toEqual({
      countries: [],
      people: [],
      organizations: [],
      locations: [],
      events: [],
      companies: [],
      currencies: [],
      topics: [],
    });
  });

  it('handles an empty summary without throwing', () => {
    expect(() =>
      extractArticleEntities({
        title: 'Rwanda development update',
        summary: '',
      }),
    ).not.toThrow();
  });

  describe('Milestone #29: organization alias resolution', () => {
    it('collapses "UN" and "United Nations" mentioned in the same article into one canonical entry', () => {
      const result = extractArticleEntities({
        title: 'UN Security Council meets as United Nations calls for ceasefire',
        summary: 'The UN and United Nations officials confirmed talks are ongoing.',
      });

      expect(result.organizations).toEqual(['United Nations']);
      expect(result.organizations.filter((org) => org === 'United Nations')).toHaveLength(1);

      expect(result.organizationMatches).toEqual([
        {
          canonical: 'United Nations',
          matchedFrom: expect.arrayContaining(['UN', 'United Nations']),
        },
      ]);
    });

    it('resolves "WHO" to its canonical name and preserves the original acronym in matchedFrom', () => {
      const result = extractArticleEntities({
        title: 'WHO warns of outbreak risk',
        summary: 'The organization urged governments to prepare.',
      });

      expect(result.organizations).toEqual(['World Health Organization']);
      expect(result.organizationMatches).toEqual([
        { canonical: 'World Health Organization', matchedFrom: ['WHO'] },
      ]);
    });

    it('keeps distinct organizations separate rather than merging them', () => {
      const result = extractArticleEntities({
        title: 'NATO and OPEC issue separate statements',
        summary: 'NATO addressed security while OPEC discussed oil output.',
      });

      expect(result.organizations).toEqual(expect.arrayContaining(['NATO', 'OPEC']));
      expect(result.organizations).toHaveLength(2);
    });

    it('does not resolve a near-miss/typo of a real organization (no fuzzy matching)', () => {
      const result = extractArticleEntities({
        title: 'Untied Nations officials to visit the region',
        summary: 'Local authorities welcomed the delegation.',
      });

      expect(result.organizations).not.toContain('United Nations');
    });

    it('does not treat a mentioned country as an organization', () => {
      const result = extractArticleEntities({
        title: 'DRC and DR Congo officials meet regional partners',
        summary: 'The Democratic Republic of the Congo delegation discussed trade.',
      });

      expect(result.organizations).toEqual([]);
      expect(result.organizationMatches).toBeUndefined();
      // The country is still captured where it always was: `countries`,
      // via the existing geographic extraction, unaffected by this change.
      expect(result.countries).toContain('DR Congo');
    });

    it('omits organizationMatches entirely (not an empty array) when there are no organizations', () => {
      const result = extractArticleEntities({
        title: 'Kenya and Uganda sign a regional trade agreement',
        summary: 'Kenya said the agreement with Uganda would improve trade across East Africa.',
      });

      expect(result.organizations).toEqual([]);
      expect(result.organizationMatches).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(result, 'organizationMatches')).toBe(false);
    });
  });
});
