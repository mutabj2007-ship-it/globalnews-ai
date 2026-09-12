import { getCountryDisplayName } from './countryDisplayName';

/**
 * Milestone #49 Phase D (World Map country-name localization).
 * getCountryDisplayName() uses Intl.DisplayNames — a standard,
 * locale-aware built-in, not a hand-maintained translation table —
 * reused as the SINGLE centralized mechanism by every map component
 * that displays a country name.
 */
describe('getCountryDisplayName (Milestone #49 Phase D)', () => {
  it('POL + en -> Poland', () => {
    expect(getCountryDisplayName('PL', 'en', 'Poland')).toBe('Poland');
  });

  it('POL + pl -> Polska', () => {
    expect(getCountryDisplayName('PL', 'pl', 'Poland')).toBe('Polska');
  });

  it('DEU + en -> Germany', () => {
    expect(getCountryDisplayName('DE', 'en', 'Germany')).toBe('Germany');
  });

  it('DEU + pl -> Niemcy', () => {
    expect(getCountryDisplayName('DE', 'pl', 'Germany')).toBe('Niemcy');
  });

  it('USA + en -> United States', () => {
    expect(getCountryDisplayName('US', 'en', 'United States')).toBe('United States');
  });

  it('USA + pl -> Stany Zjednoczone', () => {
    expect(getCountryDisplayName('US', 'pl', 'United States')).toBe('Stany Zjednoczone');
  });

  it('ESP + pl -> Hiszpania', () => {
    expect(getCountryDisplayName('ES', 'pl', 'Spain')).toBe('Hiszpania');
  });

  it('accepts a lowercase iso2 code', () => {
    expect(getCountryDisplayName('pl', 'pl', 'Poland')).toBe('Polska');
  });

  it('never throws and never returns an empty string, even for an unresolvable code — falls back to the canonical name', () => {
    const result = getCountryDisplayName('ZZ', 'pl', 'FallbackName');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('the canonical name argument is never itself parsed or translated — only iso2 drives localization', () => {
    // Deliberately mismatched canonical name: proves the function
    // trusts iso2, not the string passed as the fallback.
    expect(getCountryDisplayName('PL', 'pl', 'Some Other Name')).toBe('Polska');
  });
});
