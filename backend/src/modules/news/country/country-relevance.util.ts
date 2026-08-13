import type { CountryMeta, LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getLocalizedCountryName } from '@globalnews-ai/shared';

export interface CountryRelevanceResult {
  score: number;
  isRelevant: boolean;
  reasons: string[];
}

const COUNTRY_CONTEXT_TERMS = [
  'government',
  'president',
  'capital',
  'army',
  'military',
  'border',
  'citizens',
  'nationals',
  'country',
  'state',
  'province',
  'city',
  'refugees',
  'migrants',
  'embassy',
  'election',
  'parliament',
  'economy',
  'war',
  'conflict',
  'peace',
  'humanitarian',
];

const PERSON_CONTEXT_TERMS = [
  'student',
  'pupil',
  'class',
  'school',
  'teacher',
  'professor',
  'doctor',
  'actor',
  'actress',
  'player',
  'singer',
  'candidate',
  'aged',
  'born',
  'mr',
  'mrs',
  'ms',
  'dr',
];

/**
 * Explicit aliases are safer than attempting to generate demonyms.
 * This map can be expanded gradually as confirmed cases appear.
 */
const COUNTRY_DEMONYMS: Partial<Record<string, string[]>> = {
  SDN: ['sudanese'],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsWholePhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedPhrase = normalize(phrase);

  return normalizedPhrase.length > 0 ? normalizedText.includes(` ${normalizedPhrase} `) : false;
}

/**
 * Milestone #50 Phase C (multilingual country-relevance containment)
 * — `localizedName` is new and optional. Every existing caller that
 * never passes it (search()/GNewsProvider.search() context, or any
 * call with no language context) behaves byte-for-byte as before:
 * only the canonical English name and demonyms are checked. When
 * present, it's an ADDITIONAL positive signal alongside the canonical
 * name — never a replacement — derived centrally via
 * getLocalizedCountryName() (Intl.DisplayNames, the same mechanism
 * already established for display in Milestone #49), never a second,
 * manually-maintained translation table. Because it's resolved from
 * THAT country's own ISO2 code specifically, a Polish localized name
 * can never accidentally match a different country's article (Poland
 * resolves "Polska", not Germany's "Niemcy" or any other country's
 * name).
 */
function containsCountryReference(text: string, country: CountryMeta, localizedName?: string): boolean {
  if (containsWholePhrase(text, country.name)) {
    return true;
  }

  if (localizedName && containsWholePhrase(text, localizedName)) {
    return true;
  }

  const demonyms = COUNTRY_DEMONYMS[country.iso3] ?? [];

  return demonyms.some((demonym) => containsWholePhrase(text, demonym));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPersonContext(text: string): boolean {
  return PERSON_CONTEXT_TERMS.some((term) => containsWholePhrase(text, term));
}

function isLikelySurnameOnlyMention(
  title: string,
  summary: string,
  country: CountryMeta,
  localizedName?: string,
): boolean {
  if (containsCountryReference(title, country, localizedName)) {
    return false;
  }

  if (!hasPersonContext(summary)) {
    return false;
  }

  const escapedCountryName = escapeRegExp(country.name);

  const surnamePattern = new RegExp(`\\b[A-Z][a-z]+\\s+${escapedCountryName}\\b`);

  const match = summary.match(surnamePattern);

  if (!match) {
    return false;
  }

  const precedingWord = match[0].split(/\s+/)[0]?.toLowerCase();

  // Avoid treating geographic names such as "South Sudan" as surnames.
  const geographicPrefixes = new Set(['north', 'south', 'east', 'west', 'new']);

  return !geographicPrefixes.has(precedingWord);
}

/**
 * Whether an article's title or summary mentions a given city, as a
 * whole phrase (case-insensitive, punctuation-tolerant).
 *
 * This is deliberately a separate boolean signal rather than folded
 * into scoreCountryRelevance's own 0-100 additive scale: that scale
 * already saturates at 100 from country-name/context-term matches
 * alone, so adding more points to the same capped scale would let
 * city-relevant and merely country-relevant articles tie at the
 * ceiling and defeat city-first ranking. Callers should treat this as
 * a higher-priority sort key layered on top of the existing country
 * relevance score, not as a replacement for it.
 */
export function articleMentionsCity(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  city: string,
): boolean {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  const fullText = `${title} ${summary}`;

  return containsWholePhrase(fullText, city);
}

/**
 * Milestone #50 Phase C — `language` is new and optional. Every
 * existing caller that never passes it (none currently do, outside
 * CountryNewsService's own new call site) behaves byte-for-byte as
 * before — only the canonical English name/ISO codes/demonyms are
 * evaluated. When present and not 'en' (English text always already
 * matches the canonical name directly), the corresponding localized
 * country name is resolved via getLocalizedCountryName() and checked
 * as an ADDITIONAL signal in both the title and summary checks —
 * never replacing the canonical-name check, so English mentions of
 * "Poland" continue to be recognized even while Polish retrieval is
 * active (canonical-name compatibility is preserved unconditionally).
 */
export function scoreCountryRelevance(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  country: CountryMeta,
  language?: LanguageCode,
): CountryRelevanceResult {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  const fullText = `${title} ${summary}`;

  const localizedName =
    language && language !== 'en' ? getLocalizedCountryName(country.iso2, language) : undefined;

  let score = 0;
  const reasons: string[] = [];

  const titleHasCountryReference = containsCountryReference(title, country, localizedName);

  const summaryHasCountryReference = containsCountryReference(summary, country, localizedName);

  if (titleHasCountryReference) {
    score += 60;
    reasons.push('country reference appears in title');
  }

  if (summaryHasCountryReference) {
    score += 30;
    reasons.push('country reference appears in summary');
  }

  if (containsWholePhrase(fullText, country.iso2)) {
    score += 8;
    reasons.push('ISO2 code appears');
  }

  if (containsWholePhrase(fullText, country.iso3)) {
    score += 12;
    reasons.push('ISO3 code appears');
  }

  const contextMatches = COUNTRY_CONTEXT_TERMS.filter((term) =>
    containsWholePhrase(fullText, term),
  ).length;

  if (contextMatches > 0) {
    const contextScore = Math.min(contextMatches * 5, 20);
    score += contextScore;
    reasons.push(`${contextMatches} country-context term(s) found`);
  }

  if (isLikelySurnameOnlyMention(title, summary, country, localizedName)) {
    score -= 50;
    reasons.push('likely surname-only mention');
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    isRelevant: finalScore >= 35,
    reasons,
  };
}
