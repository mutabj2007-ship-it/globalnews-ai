/**
 * Country reference metadata: ISO 3166-1 alpha-2/alpha-3/numeric codes,
 * display name, and region, for a curated set of countries.
 *
 * This is precise, unambiguous lookup-table data (ISO 3166-1 codes are a
 * published standard, not something approximated or invented) — separate
 * entirely from the *geographic boundary* data used to draw the map,
 * which comes from the `world-atlas` package (see frontend's map
 * documentation for source/license details).
 *
 * `isoNumeric` is the ISO 3166-1 numeric code as a string, which is also
 * the feature `id` used by the `world-atlas` TopoJSON (`countries-110m`)
 * — this is the "map feature ID mapping" that lets the frontend join
 * news/country data to map geometry without fragile name matching.
 *
 * This list is intentionally curated (not all ~195 countries) so the
 * backend's country-news endpoint and the map's country search only
 * cover countries we can confidently resolve. It's isolated here
 * specifically so it can be extended later without touching any caller.
 */
export interface CountryMeta {
  iso2: string;
  iso3: string;
  isoNumeric: string;
  name: string;
  region: string;
}

export const COUNTRIES: CountryMeta[] = [
  { iso2: 'US', iso3: 'USA', isoNumeric: '840', name: 'United States', region: 'Americas' },
  { iso2: 'CA', iso3: 'CAN', isoNumeric: '124', name: 'Canada', region: 'Americas' },
  { iso2: 'MX', iso3: 'MEX', isoNumeric: '484', name: 'Mexico', region: 'Americas' },
  { iso2: 'BR', iso3: 'BRA', isoNumeric: '076', name: 'Brazil', region: 'Americas' },
  { iso2: 'AR', iso3: 'ARG', isoNumeric: '032', name: 'Argentina', region: 'Americas' },
  { iso2: 'CL', iso3: 'CHL', isoNumeric: '152', name: 'Chile', region: 'Americas' },
  { iso2: 'CO', iso3: 'COL', isoNumeric: '170', name: 'Colombia', region: 'Americas' },
  { iso2: 'PE', iso3: 'PER', isoNumeric: '604', name: 'Peru', region: 'Americas' },
  { iso2: 'VE', iso3: 'VEN', isoNumeric: '862', name: 'Venezuela', region: 'Americas' },
  { iso2: 'CU', iso3: 'CUB', isoNumeric: '192', name: 'Cuba', region: 'Americas' },

  { iso2: 'GB', iso3: 'GBR', isoNumeric: '826', name: 'United Kingdom', region: 'Europe' },
  { iso2: 'IE', iso3: 'IRL', isoNumeric: '372', name: 'Ireland', region: 'Europe' },
  { iso2: 'FR', iso3: 'FRA', isoNumeric: '250', name: 'France', region: 'Europe' },
  { iso2: 'DE', iso3: 'DEU', isoNumeric: '276', name: 'Germany', region: 'Europe' },
  { iso2: 'ES', iso3: 'ESP', isoNumeric: '724', name: 'Spain', region: 'Europe' },
  { iso2: 'PT', iso3: 'PRT', isoNumeric: '620', name: 'Portugal', region: 'Europe' },
  { iso2: 'IT', iso3: 'ITA', isoNumeric: '380', name: 'Italy', region: 'Europe' },
  { iso2: 'NL', iso3: 'NLD', isoNumeric: '528', name: 'Netherlands', region: 'Europe' },
  { iso2: 'BE', iso3: 'BEL', isoNumeric: '056', name: 'Belgium', region: 'Europe' },
  { iso2: 'CH', iso3: 'CHE', isoNumeric: '756', name: 'Switzerland', region: 'Europe' },
  { iso2: 'AT', iso3: 'AUT', isoNumeric: '040', name: 'Austria', region: 'Europe' },
  { iso2: 'SE', iso3: 'SWE', isoNumeric: '752', name: 'Sweden', region: 'Europe' },
  { iso2: 'NO', iso3: 'NOR', isoNumeric: '578', name: 'Norway', region: 'Europe' },
  { iso2: 'DK', iso3: 'DNK', isoNumeric: '208', name: 'Denmark', region: 'Europe' },
  { iso2: 'FI', iso3: 'FIN', isoNumeric: '246', name: 'Finland', region: 'Europe' },
  { iso2: 'PL', iso3: 'POL', isoNumeric: '616', name: 'Poland', region: 'Europe' },
  { iso2: 'UA', iso3: 'UKR', isoNumeric: '804', name: 'Ukraine', region: 'Europe' },
  { iso2: 'RO', iso3: 'ROU', isoNumeric: '642', name: 'Romania', region: 'Europe' },
  { iso2: 'GR', iso3: 'GRC', isoNumeric: '300', name: 'Greece', region: 'Europe' },
  { iso2: 'CZ', iso3: 'CZE', isoNumeric: '203', name: 'Czechia', region: 'Europe' },
  { iso2: 'HU', iso3: 'HUN', isoNumeric: '348', name: 'Hungary', region: 'Europe' },
  { iso2: 'RS', iso3: 'SRB', isoNumeric: '688', name: 'Serbia', region: 'Europe' },
  { iso2: 'HR', iso3: 'HRV', isoNumeric: '191', name: 'Croatia', region: 'Europe' },
  { iso2: 'RU', iso3: 'RUS', isoNumeric: '643', name: 'Russia', region: 'Europe' },

  { iso2: 'CN', iso3: 'CHN', isoNumeric: '156', name: 'China', region: 'Asia' },
  { iso2: 'JP', iso3: 'JPN', isoNumeric: '392', name: 'Japan', region: 'Asia' },
  { iso2: 'KR', iso3: 'KOR', isoNumeric: '410', name: 'South Korea', region: 'Asia' },
  { iso2: 'KP', iso3: 'PRK', isoNumeric: '408', name: 'North Korea', region: 'Asia' },
  { iso2: 'IN', iso3: 'IND', isoNumeric: '356', name: 'India', region: 'Asia' },
  { iso2: 'PK', iso3: 'PAK', isoNumeric: '586', name: 'Pakistan', region: 'Asia' },
  { iso2: 'BD', iso3: 'BGD', isoNumeric: '050', name: 'Bangladesh', region: 'Asia' },
  { iso2: 'ID', iso3: 'IDN', isoNumeric: '360', name: 'Indonesia', region: 'Asia' },
  { iso2: 'PH', iso3: 'PHL', isoNumeric: '608', name: 'Philippines', region: 'Asia' },
  { iso2: 'VN', iso3: 'VNM', isoNumeric: '704', name: 'Vietnam', region: 'Asia' },
  { iso2: 'TH', iso3: 'THA', isoNumeric: '764', name: 'Thailand', region: 'Asia' },
  { iso2: 'MY', iso3: 'MYS', isoNumeric: '458', name: 'Malaysia', region: 'Asia' },
  { iso2: 'SG', iso3: 'SGP', isoNumeric: '702', name: 'Singapore', region: 'Asia' },
  { iso2: 'TW', iso3: 'TWN', isoNumeric: '158', name: 'Taiwan', region: 'Asia' },
  { iso2: 'AF', iso3: 'AFG', isoNumeric: '004', name: 'Afghanistan', region: 'Asia' },
  { iso2: 'IR', iso3: 'IRN', isoNumeric: '364', name: 'Iran', region: 'Asia' },
  { iso2: 'IQ', iso3: 'IRQ', isoNumeric: '368', name: 'Iraq', region: 'Asia' },
  { iso2: 'SY', iso3: 'SYR', isoNumeric: '760', name: 'Syria', region: 'Asia' },
  { iso2: 'IL', iso3: 'ISR', isoNumeric: '376', name: 'Israel', region: 'Asia' },
  { iso2: 'PS', iso3: 'PSE', isoNumeric: '275', name: 'Palestine', region: 'Asia' },
  { iso2: 'SA', iso3: 'SAU', isoNumeric: '682', name: 'Saudi Arabia', region: 'Asia' },
  { iso2: 'AE', iso3: 'ARE', isoNumeric: '784', name: 'United Arab Emirates', region: 'Asia' },
  { iso2: 'QA', iso3: 'QAT', isoNumeric: '634', name: 'Qatar', region: 'Asia' },
  { iso2: 'JO', iso3: 'JOR', isoNumeric: '400', name: 'Jordan', region: 'Asia' },
  { iso2: 'LB', iso3: 'LBN', isoNumeric: '422', name: 'Lebanon', region: 'Asia' },
  { iso2: 'YE', iso3: 'YEM', isoNumeric: '887', name: 'Yemen', region: 'Asia' },
  { iso2: 'TR', iso3: 'TUR', isoNumeric: '792', name: 'Turkey', region: 'Asia' },
  { iso2: 'GE', iso3: 'GEO', isoNumeric: '268', name: 'Georgia', region: 'Asia' },
  { iso2: 'AM', iso3: 'ARM', isoNumeric: '051', name: 'Armenia', region: 'Asia' },
  { iso2: 'AZ', iso3: 'AZE', isoNumeric: '031', name: 'Azerbaijan', region: 'Asia' },
  { iso2: 'KZ', iso3: 'KAZ', isoNumeric: '398', name: 'Kazakhstan', region: 'Asia' },

  { iso2: 'EG', iso3: 'EGY', isoNumeric: '818', name: 'Egypt', region: 'Africa' },
  { iso2: 'LY', iso3: 'LBY', isoNumeric: '434', name: 'Libya', region: 'Africa' },
  { iso2: 'MA', iso3: 'MAR', isoNumeric: '504', name: 'Morocco', region: 'Africa' },
  { iso2: 'DZ', iso3: 'DZA', isoNumeric: '012', name: 'Algeria', region: 'Africa' },
  { iso2: 'TN', iso3: 'TUN', isoNumeric: '788', name: 'Tunisia', region: 'Africa' },
  { iso2: 'SD', iso3: 'SDN', isoNumeric: '729', name: 'Sudan', region: 'Africa' },
  { iso2: 'SS', iso3: 'SSD', isoNumeric: '728', name: 'South Sudan', region: 'Africa' },
  { iso2: 'ET', iso3: 'ETH', isoNumeric: '231', name: 'Ethiopia', region: 'Africa' },
  { iso2: 'SO', iso3: 'SOM', isoNumeric: '706', name: 'Somalia', region: 'Africa' },
  { iso2: 'KE', iso3: 'KEN', isoNumeric: '404', name: 'Kenya', region: 'Africa' },
  { iso2: 'TZ', iso3: 'TZA', isoNumeric: '834', name: 'Tanzania', region: 'Africa' },
  { iso2: 'UG', iso3: 'UGA', isoNumeric: '800', name: 'Uganda', region: 'Africa' },
  { iso2: 'NG', iso3: 'NGA', isoNumeric: '566', name: 'Nigeria', region: 'Africa' },
  { iso2: 'GH', iso3: 'GHA', isoNumeric: '288', name: 'Ghana', region: 'Africa' },
  { iso2: 'CI', iso3: 'CIV', isoNumeric: '384', name: "Cote d'Ivoire", region: 'Africa' },
  { iso2: 'SN', iso3: 'SEN', isoNumeric: '686', name: 'Senegal', region: 'Africa' },
  { iso2: 'ML', iso3: 'MLI', isoNumeric: '466', name: 'Mali', region: 'Africa' },
  { iso2: 'NE', iso3: 'NER', isoNumeric: '562', name: 'Niger', region: 'Africa' },
  { iso2: 'TD', iso3: 'TCD', isoNumeric: '148', name: 'Chad', region: 'Africa' },
  { iso2: 'CM', iso3: 'CMR', isoNumeric: '120', name: 'Cameroon', region: 'Africa' },
  { iso2: 'CD', iso3: 'COD', isoNumeric: '180', name: 'DR Congo', region: 'Africa' },
  { iso2: 'AO', iso3: 'AGO', isoNumeric: '024', name: 'Angola', region: 'Africa' },
  { iso2: 'ZM', iso3: 'ZMB', isoNumeric: '894', name: 'Zambia', region: 'Africa' },
  { iso2: 'ZW', iso3: 'ZWE', isoNumeric: '716', name: 'Zimbabwe', region: 'Africa' },
  { iso2: 'MZ', iso3: 'MOZ', isoNumeric: '508', name: 'Mozambique', region: 'Africa' },
  { iso2: 'ZA', iso3: 'ZAF', isoNumeric: '710', name: 'South Africa', region: 'Africa' },
  { iso2: 'NA', iso3: 'NAM', isoNumeric: '516', name: 'Namibia', region: 'Africa' },
  { iso2: 'RW', iso3: 'RWA', isoNumeric: '646', name: 'Rwanda', region: 'Africa' },

  { iso2: 'AU', iso3: 'AUS', isoNumeric: '036', name: 'Australia', region: 'Oceania' },
  { iso2: 'NZ', iso3: 'NZL', isoNumeric: '554', name: 'New Zealand', region: 'Oceania' },
  { iso2: 'PG', iso3: 'PNG', isoNumeric: '598', name: 'Papua New Guinea', region: 'Oceania' },
  { iso2: 'FJ', iso3: 'FJI', isoNumeric: '242', name: 'Fiji', region: 'Oceania' },
];

/**
 * Common names, abbreviations, and colloquialisms that don't match a
 * country's canonical `name`, `iso2`, or `iso3` exactly (those are
 * already handled directly). Keys are lowercase; values are ISO alpha-3 codes.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'USA',
  us: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  uk: 'GBR',
  britain: 'GBR',
  england: 'GBR',
  'great britain': 'GBR',
  'united kingdom': 'GBR',
  'dr congo': 'COD',
  'congo kinshasa': 'COD',
  'democratic republic of the congo': 'COD',
  'south korea': 'KOR',
  'north korea': 'PRK',
  uae: 'ARE',
  'united arab emirates': 'ARE',
  'czech republic': 'CZE',
  czechia: 'CZE',
  russia: 'RUS',
  'russian federation': 'RUS',
  rwanda: 'RWA',
};

const BY_ISO3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));
const BY_ISO2 = new Map(COUNTRIES.map((c) => [c.iso2, c]));
const BY_NUMERIC = new Map(COUNTRIES.map((c) => [c.isoNumeric, c]));

/** Case-insensitive lookup by ISO alpha-3 code (e.g. "esp" -> Spain). */
export function findCountryByIso3(code: string): CountryMeta | undefined {
  return BY_ISO3.get(code.trim().toUpperCase());
}

/** Case-insensitive lookup by ISO alpha-2 code. */
export function findCountryByIso2(code: string): CountryMeta | undefined {
  return BY_ISO2.get(code.trim().toUpperCase());
}

/** Lookup by ISO 3166-1 numeric code (matches world-atlas TopoJSON feature ids). */
export function findCountryByNumeric(code: string): CountryMeta | undefined {
  return BY_NUMERIC.get(String(code).padStart(3, '0'));
}

/** Case-insensitive substring match on country name, ISO codes, or a known alias, for search/autocomplete. */
export function searchCountriesByName(query: string, limit = 8): CountryMeta[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const matches = new Map<string, CountryMeta>();

  for (const country of COUNTRIES) {
    const nameMatch = country.name.toLowerCase().includes(normalized);
    const codeMatch =
      country.iso2.toLowerCase() === normalized ||
      country.iso3.toLowerCase() === normalized;

    if (nameMatch || codeMatch) matches.set(country.iso3, country);
  }

  for (const [alias, iso3] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.includes(normalized)) {
      const country = BY_ISO3.get(iso3);
      if (country) matches.set(country.iso3, country);
    }
  }

  return Array.from(matches.values()).slice(0, limit);
}

/** Resolves a country from an ISO2/ISO3 code, exact name, or known alias. Returns undefined if nothing matches. */
export function resolveCountryByAnyIdentifier(input: string): CountryMeta | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  return (
    BY_ISO3.get(upper) ??
    BY_ISO2.get(upper) ??
    COUNTRIES.find((country) => country.name.toLowerCase() === lower) ??
    (COUNTRY_ALIASES[lower] ? BY_ISO3.get(COUNTRY_ALIASES[lower]) : undefined)
  );
}

export const ALL_ISO3_CODES: string[] = COUNTRIES.map((c) => c.iso3);
