import { extractArticleEntities } from './article-entities.util';

describe('extractArticleEntities', () => {
  it('extracts countries, organizations, events and topics from a conflict article', () => {
    const result = extractArticleEntities({
      title:
        'Sudan conflict intensifies as United Nations calls for a ceasefire',
      summary:
        'The military conflict has displaced families across Sudan and created a humanitarian crisis.',
    });

    expect(result.countries).toContain('Sudan');
    expect(result.organizations).toContain('United Nations');
    expect(result.events).toEqual(
      expect.arrayContaining([
        'conflict',
        'ceasefire',
        'humanitarian crisis',
      ]),
    );
    expect(result.topics).toEqual(
      expect.arrayContaining(['conflict', 'humanitarian']),
    );
  });

  it('extracts multiple countries without duplicating them', () => {
    const result = extractArticleEntities({
      title: 'Kenya and Uganda sign a regional trade agreement',
      summary:
        'Kenya said the agreement with Uganda would improve trade across East Africa.',
    });

    expect(result.countries).toEqual(
      expect.arrayContaining(['Kenya', 'Uganda']),
    );

    expect(
      result.countries.filter((country) => country === 'Kenya'),
    ).toHaveLength(1);
  });

  it('extracts organizations and companies separately', () => {
    const result = extractArticleEntities({
      title: 'OPEC meets as Shell and BP review oil production',
      summary:
        'The Organization of the Petroleum Exporting Countries discussed crude supply and energy markets.',
    });

    expect(result.organizations).toContain('OPEC');

    expect(result.companies).toEqual(
      expect.arrayContaining(['Shell', 'BP']),
    );

    expect(result.topics).toEqual(
      expect.arrayContaining(['energy', 'markets']),
    );
  });

  it('extracts explicit currencies without treating the yen symbol ambiguously', () => {
    const result = extractArticleEntities({
      title: 'Euro rises while the US dollar weakens',
      summary:
        'Analysts compared EUR, USD and the Chinese yuan during market trading.',
    });

    expect(result.currencies).toEqual(
      expect.arrayContaining(['EUR', 'USD', 'CNY']),
    );

    expect(result.currencies).not.toContain('JPY');
  });

  it('extracts Rwanda-related intelligence entities', () => {
    const result = extractArticleEntities({
      title:
        'Rwanda election preparations continue across Kigali City',
      summary:
        'The election process and government planning remain under review.',
    });

    expect(result.countries).toContain('Rwanda');
    expect(result.locations).toContain('Kigali City');
    expect(result.events).toContain('election');
    expect(result.topics).toContain('politics');
  });

  it('extracts a titled person but avoids classifying organizations as people', () => {
    const result = extractArticleEntities({
      title:
        'President Paul Kagame addresses the African Union summit',
      summary:
        'The speech focused on regional trade and economic cooperation.',
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
});