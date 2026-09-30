import type { NewsArticle } from '@globalnews-ai/shared';
import {
  ALL_ISO3_CODES,
  findCountryByIso2,
  findCountryByIso3,
  getLocalizedCountryName,
  resolveCountryByAnyIdentifier,
  type CountryMeta,
} from '@globalnews-ai/shared';

import { classifyCategory } from '../classification/classify-category.util';
import {
  resolveCountriesByDemonym,
  scoreCountryRelevance,
} from '../country/country-relevance.util';
import { resolveRegistrableDomain } from '../identity/publisher-identity.util';
import { FEED_SOURCES, type FeedSourceEntry } from '../providers/feed-source-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — COUNTRY + BROAD ECONOMY, A BOUNDED SECOND ADMISSION PATH
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE MEASURED GAP (Alpha operation 6a379561). For "What has changed in Poland's economy?"
 * the unchanged generic gate requires the phrase, or every load-bearing term ("poland",
 * "economy"), in a headline. A national statistics office never names its own country
 * ("Consumer price indices in August 2026"), Polish-language reporting says "Polska
 * gospodarka", and wire copy says "Polish economy" — so every relevant candidate was rejected.
 *
 * THE CTO RULING THIS IMPLEMENTS, AND NOTHING WIDER.
 *   - Reached ONLY for a subject that is exactly a resolved country + a broad economy term
 *     (`resolveCountryEconomyQuery`). Every other question keeps the generic gate unchanged.
 *   - It can ADD an admission after the generic gate has failed; it can never remove one.
 *   - BOTH components are required, always:
 *       COUNTRY  the article names the country through the EXISTING curated authority
 *                (`scoreCountryRelevance`: names, ISO codes, curated cities, demonyms, the
 *                localized name), OR it comes from a VERIFIED own-country publisher — a
 *                registered feed whose `sourceId` AND URL domain both match the registry, and
 *                whose registry country IS the requested country.
 *       TOPIC    the article's OWN TEXT is economic: the existing deterministic classifier
 *                (`classifyCategory`, recomputed from title + summary, never a stored or
 *                provider-hinted category) says 'business', or a closed, reviewed economic
 *                form occurs as a whole word. Publisher identity NEVER satisfies the topic.
 *   - No threshold, router, provenance, retry, quota or evidence-admission rule elsewhere moves.
 */

/* ── the query side: a closed trigger ─────────────────────────────────────── */

/** Broad economy terms a subject may consist of (besides the country). EN + PL. */
const BROAD_ECONOMY_TERMS = new Set([
  'economy',
  'economies',
  'economic',
  'economics',
  'gospodarka',
  'gospodarki',
  'gospodarce',
  'gospodarkę',
  'gospodarką',
]);

/** Framing that may surround the pair without changing it ("the economy of Poland"). */
const FRAMING = new Set(['the', 'of', 'in', 's', 'state', 'situation', 'w', 'stan', 'sytuacja']);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’'`]s\b/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/** A country named by its canonical name / alias, its demonym, or its Polish name. */
function countryOfWords(
  tokens: readonly string[],
): { country: CountryMeta; used: number } | undefined {
  for (let len = Math.min(4, tokens.length); len >= 1; len--) {
    for (let i = 0; i + len <= tokens.length; i++) {
      const span = tokens.slice(i, i + len).join(' ');
      const byName = resolveCountryByAnyIdentifier(span);
      /* ISO codes are not accepted as words here: "pl" or "us" in a sentence is not a country. */
      if (byName !== undefined && span.length > 3) return { country: byName, used: len };
      const byDemonym = resolveCountriesByDemonym(span);
      if (byDemonym.length === 1) return { country: byDemonym[0], used: len };
    }
  }
  /*
    The localized (Polish) canonical name of ANY country, exactly as the curated display-name
    authority spells it ("Polska", "Kenia", "Niemcy"). No hand-listed inflections: a case form
    the authority does not produce ("Polski", "w Polsce") does not trigger this path.
  */
  for (const token of tokens) {
    const iso2 = localizedPolishNameToIso2().get(token);
    if (iso2 !== undefined) {
      const country = findCountryByIso2(iso2);
      if (country !== undefined) return { country, used: 1 };
    }
  }
  return undefined;
}

let localizedPolishNames: ReadonlyMap<string, string> | undefined;
/** Single-word localized PL names of every curated country (built once from the shared authority). */
function localizedPolishNameToIso2(): ReadonlyMap<string, string> {
  if (localizedPolishNames !== undefined) return localizedPolishNames;
  const map = new Map<string, string>();
  for (const iso3 of ALL_ISO3_CODES) {
    const country = findCountryByIso3(iso3);
    const name = country ? getLocalizedCountryName(country.iso2, 'pl')?.toLowerCase() : undefined;
    if (country !== undefined && name !== undefined && !/\s/.test(name))
      map.set(name, country.iso2);
  }
  localizedPolishNames = map;
  return map;
}

/**
 * The resolved country when — and only when — the retrieval subject is exactly one country and
 * a broad economy term ("Poland's economy", "the Polish economy", "economy of Poland",
 * "gospodarka Polski"). Any other load-bearing word ("inflation", "this week", "energy", a
 * second country) returns undefined and the question keeps the unchanged generic gate.
 */
export function resolveCountryEconomyQuery(subject: string): CountryMeta | undefined {
  const tokens = words(subject);
  if (tokens.length === 0) return undefined;
  const found = countryOfWords(tokens);
  if (found === undefined) return undefined;

  const rest = [...tokens];
  /* Remove the words that named the country (first matching span). */
  const countryWords = new Set(
    words(found.country.name).concat(
      [...localizedPolishNameToIso2().entries()]
        .filter(([, iso2]) => iso2 === found.country.iso2)
        .map(([form]) => form),
    ),
  );
  const remaining = rest.filter((token) => {
    if (countryWords.has(token)) return false;
    if (resolveCountriesByDemonym(token).some((c) => c.iso3 === found.country.iso3)) return false;
    if (resolveCountryByAnyIdentifier(token)?.iso3 === found.country.iso3 && token.length > 3)
      return false;
    return true;
  });
  const content = remaining.filter((token) => !FRAMING.has(token));
  if (content.length === 0) return undefined;
  if (!content.every((token) => BROAD_ECONOMY_TERMS.has(token))) return undefined;
  /* A second country anywhere in the remainder is not this shape. */
  if (content.some((token) => resolveCountriesByDemonym(token).length > 0)) return undefined;
  return found.country;
}

/* ── the article side ─────────────────────────────────────────────────────── */

/**
 * Closed, reviewed economic forms the deterministic classifier does not carry. Each was added
 * because a RETAINED-REAL Statistics Poland release or a Polish-language headline in the
 * closeout tests is economic reporting that the classifier scored as 'world'. Whole words only.
 */
const ECONOMIC_FORMS_EN = [
  'gdp',
  'consumer prices',
  'consumer price',
  'price indices',
  'price index',
  'producer prices',
  'foreign trade',
  'exports',
  'imports',
  'retail sales',
  'industrial production',
  'services production',
  'job vacancies',
  'wages',
  'consumer confidence',
  'business tendency',
];
const ECONOMIC_FORMS_PL_STEMS = [
  'gospodark',
  'gospodarcz',
  'inflacj',
  'bezroboci',
  'recesj',
  'wynagrodze',
];
const ECONOMIC_FORMS_PL_WORDS = ['pkb'];

function normalizeText(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

/** The article's own text is economic. Never consults the publisher. */
export function hasEconomicTopicEvidence(article: Pick<NewsArticle, 'title' | 'summary'>): boolean {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  if (classifyCategory({ title, summary }) === 'business') return true;
  const text = normalizeText(`${title} ${summary}`);
  if (ECONOMIC_FORMS_EN.some((form) => text.includes(` ${form} `))) return true;
  if (ECONOMIC_FORMS_PL_WORDS.some((form) => text.includes(` ${form} `))) return true;
  return ECONOMIC_FORMS_PL_STEMS.some((stem) => text.includes(` ${stem}`));
}

/**
 * The registered feed this article VERIFIABLY comes from: its `sourceId` is a registry entry AND
 * its URL's registrable domain is that entry's canonical host. Either alone is not enough.
 */
export function verifiedFeedPublisherOf(
  article: Pick<NewsArticle, 'sourceId' | 'url'>,
): FeedSourceEntry | undefined {
  const entry = FEED_SOURCES.find((candidate) => candidate.sourceId === article.sourceId);
  if (entry === undefined) return undefined;
  const articleDomain = resolveRegistrableDomain(article.url ?? '');
  const registryDomain = resolveRegistrableDomain(`https://${entry.canonicalHost}`);
  return articleDomain !== undefined && articleDomain === registryDomain ? entry : undefined;
}

export interface CountryEconomyRelevance {
  readonly isRelevant: boolean;
  readonly country: 'named' | 'own-country-publisher' | 'absent';
  readonly topic: boolean;
}

/** Both components, always. */
export function scoreCountryEconomyRelevance(
  article: Pick<NewsArticle, 'title' | 'summary' | 'sourceId' | 'url' | 'sourceLanguage'>,
  countryIso3: string,
): CountryEconomyRelevance {
  const country = findCountryByIso3(countryIso3);
  if (country === undefined) return { isRelevant: false, country: 'absent', topic: false };

  /* The provider-reported language (never inferred): Polish text is also checked for the Polish name. */
  const language = article.sourceLanguage === 'pl' ? 'pl' : undefined;
  const named = scoreCountryRelevance(article, country, language).isRelevant;
  const publisher = verifiedFeedPublisherOf(article);
  const ownCountry =
    publisher !== undefined && publisher.countryCode.toUpperCase() === country.iso2.toUpperCase();
  const countryComponent: CountryEconomyRelevance['country'] = named
    ? 'named'
    : ownCountry
      ? 'own-country-publisher'
      : 'absent';
  const topic = hasEconomicTopicEvidence(article);
  return { isRelevant: countryComponent !== 'absent' && topic, country: countryComponent, topic };
}
