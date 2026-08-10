import { COUNTRIES, type NewsArticle } from '@globalnews-ai/shared';
import {
  ORGANIZATION_CANDIDATE_PHRASES,
  resolveOrganizationAlias,
} from './organization-alias-resolver.util';

/**
 * Milestone #29: provenance for one resolved organization within a
 * single article — the canonical identity plus every distinct surface
 * form actually found in that article's text that resolved to it (e.g.
 * a canonical "United Nations" with matchedFrom ["United Nations",
 * "UN"] when the article used both). Never a silent substitution: the
 * original wording is always recoverable from matchedFrom.
 */
export interface OrganizationMatch {
  canonical: string;
  matchedFrom: string[];
}

export interface ArticleEntities {
  countries: string[];
  people: string[];
  organizations: string[];
  locations: string[];
  events: string[];
  companies: string[];
  currencies: string[];
  topics: string[];
  /**
   * Present only when `organizations` is non-empty — omitted (not an
   * empty array) otherwise, so an article with no organizations keeps
   * exactly the same shape it always has. One entry per canonical
   * organization in `organizations`, in the same order.
   */
  organizationMatches?: OrganizationMatch[];
}


const COMPANY_NAMES = [
  'Airbus',
  'Amazon',
  'Apple',
  'Boeing',
  'BP',
  'Chevron',
  'ExxonMobil',
  'Google',
  'Meta',
  'Microsoft',
  'Nvidia',
  'OpenAI',
  'Saudi Aramco',
  'Shell',
  'Tesla',
  'TotalEnergies',
  'Toyota',
];

const EVENT_KEYWORDS = [
  'airstrike',
  'attack',
  'ceasefire',
  'conflict',
  'coup',
  'drought',
  'earthquake',
  'election',
  'explosion',
  'flood',
  'humanitarian crisis',
  'negotiation',
  'outbreak',
  'peace talks',
  'protest',
  'referendum',
  'sanctions',
  'shooting',
  'strike',
  'summit',
  'war',
  'wildfire',
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  politics: ['government', 'president', 'minister', 'parliament', 'policy', 'election'],
  conflict: ['army', 'military', 'war', 'airstrike', 'ceasefire', 'rebels', 'conflict'],
  economy: ['economy', 'economic', 'inflation', 'employment', 'gdp', 'trade', 'recession'],
  markets: ['market', 'stocks', 'shares', 'investors', 'bonds', 'index'],
  energy: ['oil', 'crude', 'fuel', 'gas', 'opec', 'pipeline', 'refinery'],
  health: ['health', 'hospital', 'disease', 'vaccine', 'outbreak', 'patients'],
  technology: [
    'technology',
    'artificial intelligence',
    'software',
    'chip',
    'semiconductor',
    'cybersecurity',
  ],
  humanitarian: ['humanitarian', 'refugees', 'displaced', 'famine', 'aid', 'malnutrition'],
};

const CURRENCY_PATTERNS: Array<{
  code: string;
  patterns: RegExp[];
}> = [
  {
    code: 'USD',
    patterns: [
      /\bUSD\b/g,
      /\bUS dollars?\b/gi,
      /\bAmerican dollars?\b/gi,
      /\bdollars?\b/gi,
      /US\$/g,
    ],
  },
  {
    code: 'EUR',
    patterns: [/\bEUR\b/g, /\beuros?\b/gi, /€/g],
  },
  {
    code: 'GBP',
    patterns: [/\bGBP\b/g, /\bpound sterling\b/gi, /\bBritish pounds?\b/gi, /£/g],
  },
  {
    code: 'RWF',
    patterns: [/\bRWF\b/g, /\bRwandan francs?\b/gi, /\bRwanda francs?\b/gi],
  },
  {
    code: 'KES',
    patterns: [/\bKES\b/g, /\bKenyan shillings?\b/gi],
  },
  {
    code: 'JPY',
    patterns: [/\bJPY\b/g, /\bJapanese yen\b/gi],
  },
  {
    code: 'CNY',
    patterns: [/\bCNY\b/g, /\bChinese yuan\b/gi, /\brenminbi\b/gi],
  },
];

const LOCATION_SUFFIXES = [
  'City',
  'County',
  'District',
  'Island',
  'Islands',
  'Mountain',
  'Mountains',
  'Province',
  'Region',
  'River',
  'State',
  'Valley',
];

const PERSON_TITLES = [
  'Ambassador',
  'Chairman',
  'Chairwoman',
  'Chancellor',
  'Colonel',
  'Dr.',
  'General',
  'Governor',
  'King',
  'Mayor',
  'Minister',
  'Pope',
  'President',
  'Prime Minister',
  'Professor',
  'Queen',
  'Senator',
  'Secretary',
  'Sheikh',
  'Vice President',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deduplicate(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function buildArticleText(article: Pick<NewsArticle, 'title' | 'summary'>): string {
  return [article.title, article.summary]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

function containsPhrase(text: string, phrase: string): boolean {
  const isShortAcronym = phrase.length <= 4 && phrase === phrase.toUpperCase();

  const pattern = new RegExp(
    `(?<![A-Za-z0-9])${escapeRegExp(phrase)}(?![A-Za-z0-9])`,
    isShortAcronym ? '' : 'i',
  );

  return pattern.test(text);
}

function extractCountries(text: string): string[] {
  const matches: Array<{ name: string; length: number }> = [];

  for (const country of COUNTRIES) {
    const candidateNames = [country.name, country.iso2, country.iso3]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    const matched = candidateNames.some((candidate) => containsPhrase(text, candidate));

    if (matched) {
      matches.push({
        name: country.name,
        length: country.name.length,
      });
    }
  }

  return deduplicate(matches.sort((a, b) => b.length - a.length).map((match) => match.name));
}

function extractNamedItems(text: string, items: string[]): string[] {
  return deduplicate(items.filter((item) => containsPhrase(text, item)));
}

/**
 * Milestone #29: like extractNamedItems, but resolves each matched
 * candidate phrase through the organization alias resolver first, so
 * "UN" and "United Nations" appearing in the same article collapse to
 * one canonical "United Nations" entry instead of two unrelated
 * strings. Candidate phrases are tried in a stable order
 * (ORGANIZATION_CANDIDATE_PHRASES); the surface forms actually found
 * are preserved per canonical organization via organizationMatches,
 * never silently discarded.
 */
function extractOrganizations(text: string): {
  organizations: string[];
  organizationMatches?: OrganizationMatch[];
} {
  const canonicalOrder: string[] = [];
  const surfaceFormsByCanonical = new Map<string, Set<string>>();

  for (const candidate of ORGANIZATION_CANDIDATE_PHRASES) {
    if (!containsPhrase(text, candidate)) continue;

    const resolved = resolveOrganizationAlias(candidate);
    if (!resolved) continue;

    if (!surfaceFormsByCanonical.has(resolved.canonical)) {
      surfaceFormsByCanonical.set(resolved.canonical, new Set());
      canonicalOrder.push(resolved.canonical);
    }

    surfaceFormsByCanonical.get(resolved.canonical)!.add(resolved.matchedFrom);
  }

  if (canonicalOrder.length === 0) {
    return { organizations: [] };
  }

  const organizationMatches: OrganizationMatch[] = canonicalOrder.map((canonical) => ({
    canonical,
    matchedFrom: Array.from(surfaceFormsByCanonical.get(canonical)!),
  }));

  return { organizations: canonicalOrder, organizationMatches };
}


function extractCurrencies(text: string): string[] {
  const found: string[] = [];

  for (const currency of CURRENCY_PATTERNS) {
    if (currency.patterns.some((pattern) => pattern.test(text))) {
      found.push(currency.code);
    }

    for (const pattern of currency.patterns) {
      pattern.lastIndex = 0;
    }
  }

  return deduplicate(found);
}

function extractEvents(text: string): string[] {
  return deduplicate(EVENT_KEYWORDS.filter((event) => containsPhrase(text, event)));
}

function extractTopics(text: string): string[] {
  const normalizedText = text.toLowerCase();

  return Object.entries(TOPIC_KEYWORDS)
    .map(([topic, keywords]) => ({
      topic,
      score: keywords.reduce(
        (total, keyword) => total + (normalizedText.includes(keyword.toLowerCase()) ? 1 : 0),
        0,
      ),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.topic);
}

function extractTitledPeople(text: string): string[] {
  const titles = [...PERSON_TITLES]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');

  const nameToken = `[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ'’.-]+`;

  const pattern = new RegExp(`(?:${titles})\\s+(${nameToken}(?:\\s+${nameToken}){1,2})`, 'g');

  const people: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    people.push(match[1].trim());
  }

  return deduplicate(people);
}

function extractSuffixedLocations(text: string): string[] {
  const suffixes = LOCATION_SUFFIXES.map(escapeRegExp).join('|');

  const locationToken = `[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ'’.-]+`;

  const pattern = new RegExp(
    `\\b(${locationToken}(?:\\s+${locationToken}){0,2}\\s+(?:${suffixes}))\\b`,
    'g',
  );

  const locations: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    locations.push(match[1].trim());
  }

  return deduplicate(locations);
}

export function extractArticleEntities(
  article: Pick<NewsArticle, 'title' | 'summary'>,
): ArticleEntities {
  const text = buildArticleText(article);

  if (!text) {
    return {
      countries: [],
      people: [],
      organizations: [],
      locations: [],
      events: [],
      companies: [],
      currencies: [],
      topics: [],
    };
  }

  const countries = extractCountries(text);
  const { organizations, organizationMatches } = extractOrganizations(text);
  const companies = extractNamedItems(text, COMPANY_NAMES);
  const events = extractEvents(text);
  const currencies = extractCurrencies(text);
  const topics = extractTopics(text);
  const people = extractTitledPeople(text);
  const locations = extractSuffixedLocations(text);

  return {
    countries,
    people,
    organizations,
    locations,
    events,
    companies,
    currencies,
    topics,
    ...(organizationMatches ? { organizationMatches } : {}),
  };
}
