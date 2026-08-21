import type { CountryMeta, LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { COUNTRIES, getLocalizedCountryName } from '@globalnews-ai/shared';

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

/**
 * M66.14B — PREPARED TEXT, COMPUTED ONCE.
 *
 * normalize() runs two Unicode-property regex passes over its whole input, and
 * containsWholePhrase() used to call it on the ARTICLE TEXT every single time.
 * A single scoreCountryRelevance() call performs 30-60 such checks, and callers
 * that sweep every country repeat all of them 195 times over text that never
 * changes. Preparing each distinct text once and reusing it is worth ~5x on that
 * workload and costs nothing on the existing single-country path.
 *
 * THIS IS A REFACTOR, NOT A RULE CHANGE. Same normalization, same comparison,
 * same order, same results. normalize() is pure and deterministic, so computing
 * it once is identical to computing it sixty times. No weight, threshold, alias,
 * demonym, localized name, ISO check, context term or reasons string is touched,
 * and no candidate is skipped. Proven by a differential test in this file's spec.
 *
 * containsWholePhrase() KEEPS ITS SIGNATURE so articleMentionsCity() and every
 * other caller are untouched; it is now a thin wrapper over the two halves.
 */
function prepareText(text: string): string {
  return ` ${normalize(text)} `;
}

function preparedContainsPhrase(preparedText: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);

  return normalizedPhrase.length > 0 ? preparedText.includes(` ${normalizedPhrase} `) : false;
}

function containsWholePhrase(text: string, phrase: string): boolean {
  return preparedContainsPhrase(prepareText(text), phrase);
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
function containsCountryReference(preparedText: string, country: CountryMeta, localizedName?: string): boolean {
  if (preparedContainsPhrase(preparedText, country.name)) {
    return true;
  }

  if (localizedName && preparedContainsPhrase(preparedText, localizedName)) {
    return true;
  }

  const demonyms = COUNTRY_DEMONYMS[country.iso3] ?? [];

  return demonyms.some((demonym) => preparedContainsPhrase(preparedText, demonym));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPersonContext(preparedText: string): boolean {
  return PERSON_CONTEXT_TERMS.some((term) => preparedContainsPhrase(preparedText, term));
}

function isLikelySurnameOnlyMention(
  preparedTitle: string,
  preparedSummary: string,
  summary: string,
  country: CountryMeta,
  localizedName?: string,
): boolean {
  if (containsCountryReference(preparedTitle, country, localizedName)) {
    return false;
  }

  if (!hasPersonContext(preparedSummary)) {
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

  const preparedTitle = prepareText(title);
  const preparedSummary = prepareText(summary);
  const preparedFullText = prepareText(fullText);

  const localizedName =
    language && language !== 'en' ? getLocalizedCountryName(country.iso2, language) : undefined;

  let score = 0;
  const reasons: string[] = [];

  const titleHasCountryReference = containsCountryReference(preparedTitle, country, localizedName);

  const summaryHasCountryReference = containsCountryReference(preparedSummary, country, localizedName);

  if (titleHasCountryReference) {
    score += 60;
    reasons.push('country reference appears in title');
  }

  if (summaryHasCountryReference) {
    score += 30;
    reasons.push('country reference appears in summary');
  }

  if (preparedContainsPhrase(preparedFullText, country.iso2)) {
    score += 8;
    reasons.push('ISO2 code appears');
  }

  if (preparedContainsPhrase(preparedFullText, country.iso3)) {
    score += 12;
    reasons.push('ISO3 code appears');
  }

  const contextMatches = COUNTRY_CONTEXT_TERMS.filter((term) =>
    preparedContainsPhrase(preparedFullText, term),
  ).length;

  if (contextMatches > 0) {
    const contextScore = Math.min(contextMatches * 5, 20);
    score += contextScore;
    reasons.push(`${contextMatches} country-context term(s) found`);
  }

  if (isLikelySurnameOnlyMention(preparedTitle, preparedSummary, summary, country, localizedName)) {
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

/**
 * M66.14B — the article's single canonical country, or undefined.
 *
 * NOT A SECOND ALGORITHM. An argmax over the existing scoreCountryRelevance(),
 * which country-news.service.ts and analysis.service.ts already trust. Every
 * rule about demonyms, aliases, localized names, context terms, person context
 * and surname-only mentions lives there and is unchanged; this adds no rule and
 * cannot make an article relevant to a country the scorer rejected.
 *
 * WHY undefined RATHER THAN A BEST GUESS. The 35-point isRelevant threshold is
 * the scorer's own statement that below it there is no evidence of a country,
 * and an article about cryptocurrency markets genuinely has no country.
 * Returning the least-bad candidate would put a marker on a map for an article
 * that never mentioned anywhere. Absence is the honest answer.
 *
 * TIE-BREAKING is deterministic: on an exact score tie the earlier entry in
 * COUNTRIES wins, because the comparison is strict `>`. COUNTRIES is a fixed
 * literal array, so the same article always resolves the same way — but a tie's
 * winner reflects declaration order, not a judgement that one country is more
 * relevant.
 *
 * `language` is forwarded verbatim, where it only ever ADDS the localized
 * country name as an extra positive signal and never replaces the canonical
 * English one. That is what lets a Polish interface resolve an English article,
 * and it is asserted in this file's spec.
 */
export interface PrimaryCountryResult {
  /** ISO 3166-1 alpha-2, matching CountryMeta.iso2. */
  countryCode: string;
  /** Canonical English name, matching CountryMeta.name. */
  countryName: string;
  /** The winning score, for logging and tests. */
  score: number;
}

export function resolvePrimaryCountry(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  language?: LanguageCode,
): PrimaryCountryResult | undefined {
  let best: PrimaryCountryResult | undefined;

  for (const country of COUNTRIES) {
    const relevance = scoreCountryRelevance(article, country, language);

    if (!relevance.isRelevant) {
      continue;
    }

    if (best === undefined || relevance.score > best.score) {
      best = {
        countryCode: country.iso2,
        countryName: country.name,
        score: relevance.score,
      };
    }
  }

  return best;
}
