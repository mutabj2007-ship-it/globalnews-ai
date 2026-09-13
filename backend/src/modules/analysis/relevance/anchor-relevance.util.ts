import type { NewsArticle } from '@globalnews-ai/shared';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';

import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';

/**
 * R4 ARTICLE-SPECIFIC EVIDENCE RELEVANCE — C1 + C2.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. When a Today/World-Map row is sent to
 * ANALYSE, the request carries `storyContext.articleId` (the selected story)
 * and `storyContext.countryCode`. The country code took priority over
 * free-text detection, which routed retrieval into CountryNewsService, whose
 * provider query is `buildSearchTerm()` — the bare country name. So the string
 * that reached GNews for "Hotel worker charged with sexually assaulting
 * Australian three-year-old in Penang" was literally `Australia`, and the only
 * question asked of any candidate was "is this article about Australia?".
 * Seven unrelated Australian stories passed that question correctly. The same
 * mechanism, on a different country, produced the Tuvalu result for the
 * Airport Chaplain story.
 *
 * WHAT THIS MODULE DOES. Two things, both derived from the anchor article's
 * own text and nothing else:
 *
 *   1. `buildAnchorRetrievalQuery()` — the provider query, so retrieval asks
 *      about the STORY instead of the country.
 *   2. `isMateriallyRelatedToAnchor()` — the admission gate, so sharing a
 *      country is not sufficient.
 *
 * WHY A NEW FILE RATHER THAN AN EDIT TO generic-relevance.util.ts. That module
 * is shared: `scoreGenericRelevance()` is the M36 gate and
 * `scoreRelationalRelevance()` is the M37 gate, and country-relevance.util.ts
 * next door is load-bearing for the World Map. Widening any of them to know
 * about anchors would put Analysis-lane behavior inside code the map depends
 * on. This module is Analysis-only and IMPORTS the existing scorer rather than
 * reimplementing it — every per-term admission decision below is
 * `scoreGenericRelevance()`, unmodified, exactly as the CTO instruction asks
 * ("prefer reuse of existing scoreGenericRelevance before creating another
 * scorer"). There is no second scoring engine here; there is a term extractor
 * and a counting rule.
 */

/**
 * Function words and news-desk vocabulary that carry no topical identity.
 * Deliberately NOT imported from derive-generic-news-query.util.ts's
 * FALLBACK_STOPWORDS: that list is tuned for stripping a user's QUESTION
 * ("what", "tell", "me", "latest developments"), while this one is tuned for
 * stripping a HEADLINE. They overlap but are not the same job, and coupling
 * them would mean a future tweak to question-stripping silently changed
 * evidence admission.
 */
/**
 * R1-C — EXPORTED, NOT COPIED.
 *
 * The retained-reporting matcher needs exactly this stopword set. Re-declaring
 * it in the news module would create a second list that drifts from this one
 * the first time either is edited. Export is additive: no member changes, no
 * consumer of this module behaves differently.
 */
export const HEADLINE_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'as',
  'if',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'from',
  'by',
  'into',
  'over',
  'after',
  'before',
  'about',
  'against',
  'between',
  'during',
  'under',
  'amid',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'has',
  'have',
  'had',
  'will',
  'would',
  'can',
  'could',
  'may',
  'might',
  'must',
  'do',
  'does',
  'did',
  'not',
  'no',
  'its',
  'it',
  'his',
  'her',
  'their',
  'this',
  'that',
  'these',
  'those',
  'he',
  'she',
  'they',
  'we',
  'you',
  'who',
  'what',
  'when',
  'where',
  'why',
  'how',
  'says',
  'say',
  'said',
  'new',
  'news',
  'report',
  'reports',
  'update',
  'updates',
  'live',
  'latest',
  'more',
  'than',
  'up',
  'out',
  'off',
  'down',
  'first',
  'last',
]);

/**
 * Adjectival endings that turn a country name into a demonym. Applied ONLY as
 * a country-exclusion test (see isCountryTerm) — never to a candidate
 * article's text, and never as general stemming.
 */
const DEMONYM_SUFFIXES = ['ians', 'ian', 'ans', 'an', 'ese', 'ish', 'ic', 'ns', 'n', 'i', 's'];

/**
 * Re-endings tried after a demonym suffix is stripped, so a stem can be tested
 * back against the real country registry. "Australian" -> "Australi" + "a";
 * "Polish" -> "Pol" + "and"; "Tuvaluan" -> "Tuvalu" + "".
 */
const COUNTRY_STEM_ENDINGS = ['', 'a', 'e', 'y', 'ia', 'and', 'any', 'land'];

/**
 * Demonyms whose stem shares nothing with the country's ISO name, so the
 * suffix rule below cannot reach them. Deliberately a short, explicit
 * supplement rather than a claim of completeness: it covers the adjectives
 * most likely to appear in an English headline for a country the World Map
 * feeds heavily. Anything not listed falls back to the suffix rule, and
 * anything that rule also misses is bounded by the two-term admission
 * requirement — see isMateriallyRelatedToAnchor.
 */
const IRREGULAR_COUNTRY_ADJECTIVES = new Set([
  'american',
  'americans',
  'british',
  'briton',
  'britons',
  'english',
  'scottish',
  'welsh',
  'irish',
  'french',
  'spanish',
  'dutch',
  'swiss',
  'greek',
  'greeks',
  'danish',
  'swedish',
  'norwegian',
  'norwegians',
  'finnish',
  'portuguese',
  'filipino',
  'filipinos',
  'thai',
  'kiwi',
  'kiwis',
  'aussie',
  'aussies',
  'emirati',
  'emiratis',
  'saudi',
  'saudis',
  'israeli',
  'israelis',
  'kurdish',
]);

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * True when a token names a country, or is the adjectival form of one.
 *
 * THIS IS THE RULE THE WHOLE CONTRACT TURNS ON. "Sharing only Australia /
 * Tuvalu / Rwanda or any other country is NOT sufficient" is enforced here, by
 * making country words ineligible to be counted as evidence of topical
 * relation in the first place — not by weighting them lower. A term that
 * cannot be counted cannot admit an article on its own or in combination.
 *
 * Deliberately excludes EVERY country, not merely the anchor's own. A Penang
 * story and a Jakarta story share nothing relevant by both naming Indonesia
 * either.
 *
 * Honest limit: this is a suffix rule over the ISO country registry, not a
 * curated demonym table. It resolves the regular forms (Australian, Tuvaluan,
 * Rwandan, Malaysian) and the -land forms (Polish -> Poland, Finnish ->
 * Finland). Irregular demonyms with no shared stem — Dutch/Netherlands,
 * Swiss/Switzerland — are NOT caught. The consequence is bounded: such a token
 * would count as one ordinary term, and admission additionally requires a
 * DISTINCTIVE match plus a second term (see isMateriallyRelatedToAnchor), so a
 * single uncaught demonym can never admit an article by itself.
 */
export function isCountryTerm(token: string): boolean {
  const normalized = normalizeToken(token);
  if (normalized.length < 3) return false;

  if (IRREGULAR_COUNTRY_ADJECTIVES.has(normalized)) return true;
  if (resolvesToCountryName(normalized)) return true;

  for (const suffix of DEMONYM_SUFFIXES) {
    if (!normalized.endsWith(suffix) || normalized.length <= suffix.length + 1) continue;
    const stem = normalized.slice(0, normalized.length - suffix.length);

    for (const ending of COUNTRY_STEM_ENDINGS) {
      if (resolvesToCountryName(stem + ending)) return true;
    }
  }

  return false;
}

/**
 * Country resolution by NAME or curated alias only — never by ISO code.
 *
 * This distinction is load-bearing, not pedantry. resolveCountryByAnyIdentifier()
 * accepts ISO2 and ISO3, so a bare `resolveCountryByAnyIdentifier(word)` over
 * headline words would classify ordinary English as geography: "and" is
 * Andorra's ISO3, "arm" is Armenia's, "are" is the United Arab Emirates', "no"
 * is Norway's ISO2, "it" is Italy's. Those words would then be deleted from
 * the anchor's term set, weakening the very gate this module exists to build.
 * A headline word is a name, so only names and aliases may match here.
 */
function resolvesToCountryName(candidate: string): boolean {
  const country = resolveCountryByAnyIdentifier(candidate);
  if (country === undefined) return false;

  const lower = candidate.toLowerCase();
  // Reject a match that only succeeded because the word looked like a code.
  if (lower === country.iso2.toLowerCase() || lower === country.iso3.toLowerCase()) {
    return country.name.toLowerCase() === lower;
  }
  return true;
}

export interface AnchorTerms {
  /**
   * Proper-noun-like terms from the anchor headline — places, people,
   * organizations — with every country term removed. These identify the
   * specific STORY.
   */
  readonly distinctive: string[];
  /** Remaining content words from the headline. These corroborate; they never admit alone. */
  readonly supporting: string[];
}

/**
 * Splits the anchor's own headline into distinctive and supporting terms.
 *
 * WHY THE TITLE AND NOT THE SUMMARY. A headline is the event stated once, in
 * the reporter's own most-specific vocabulary. A summary adds background
 * ("Australia has seen rising concern about...") whose words are shared with
 * exactly the unrelated same-country stories this gate must reject. Using the
 * title keeps the term set tight and is what makes rejection of "Australian
 * inflation" fall out rather than need tuning. The candidate side still reads
 * title AND summary, because that is scoreGenericRelevance's own contract.
 *
 * DISTINCTIVENESS IS DECIDED BY CASING, WHICH IS EVIDENCE, NOT A GUESS. In an
 * English headline an interior capitalized word is a proper noun. The first
 * word is skipped for that test because sentence-initial capitalization says
 * nothing. A headline in a Title Cased style would capitalize everything, so a
 * headline whose interior words are ALL capitalized is treated as carrying no
 * casing signal at all and contributes no distinctive terms — better to fall
 * through to the stricter supporting-only rule than to call every word a
 * proper noun.
 */
export function extractAnchorTerms(title: string): AnchorTerms {
  const rawWords = (title ?? '').split(/\s+/).filter(Boolean);
  const distinctive: string[] = [];
  const supporting: string[] = [];
  const seen = new Set<string>();

  const interior = rawWords.slice(1);
  const interiorContent = interior.filter((word) => {
    const n = normalizeToken(word);
    return n.length > 2 && !HEADLINE_STOPWORDS.has(n);
  });
  const capitalizedInterior = interiorContent.filter((word) => /^\p{Lu}/u.test(word));
  // All-capitalized interior content => Title Case styling => no casing signal.
  const casingIsInformative =
    interiorContent.length > 0 && capitalizedInterior.length < interiorContent.length;

  rawWords.forEach((word, index) => {
    const normalized = normalizeToken(word);
    if (normalized.length < 3) return;
    if (HEADLINE_STOPWORDS.has(normalized)) return;
    if (isCountryTerm(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const isProperNoun = casingIsInformative && index > 0 && /^\p{Lu}/u.test(word);
    if (isProperNoun) distinctive.push(normalized);
    else supporting.push(normalized);
  });

  return { distinctive, supporting };
}

/** How many terms the provider query may carry. See buildAnchorRetrievalQuery. */
const ANCHOR_QUERY_TERM_LIMIT = 4;

/**
 * C1 — the provider query for an article-specific ANALYSE.
 *
 * WHY FOUR TERMS. GNews combines free-text terms with AND. Every term added
 * narrows the result set, so a whole headline retrieves nothing and a single
 * word retrieves the country feed's problem all over again. Four is chosen
 * against the contract's own stated preference: "prefer 1 or 2 relevant
 * reports over 8 unrelated country reports". Under-retrieving is a state C3
 * explicitly permits and the response reports honestly; over-retrieving is the
 * defect. So this is tuned for precision, and the caller's single bounded
 * retry (distinctive terms only) is what recovers recall when four terms find
 * nothing.
 *
 * Distinctive terms lead because they are what makes the query about this
 * story. Country terms are already gone — including them would re-admit the
 * bare-country behavior through the back door.
 *
 * Returns undefined when the headline yields no usable term at all. Callers
 * must then not call the provider; see makeProviderSafeNewsQuery's own
 * `undefined` contract, which this mirrors deliberately.
 */
export function buildAnchorRetrievalQuery(
  terms: AnchorTerms,
  limit: number = ANCHOR_QUERY_TERM_LIMIT,
): string | undefined {
  const ordered = [...terms.distinctive, ...terms.supporting].slice(0, Math.max(1, limit));
  if (ordered.length === 0) return undefined;
  return ordered.join(' ');
}

/** The narrower second attempt: the story's proper nouns alone. */
export function buildAnchorFallbackQuery(terms: AnchorTerms): string | undefined {
  if (terms.distinctive.length === 0) return undefined;
  return terms.distinctive.slice(0, 2).join(' ');
}

export interface AnchorRelevanceResult {
  readonly isRelated: boolean;
  readonly matchedDistinctive: string[];
  readonly matchedSupporting: string[];
  readonly reason: string;
}

/**
 * C2 — is this candidate materially about the anchor's story?
 *
 * THE RULE, AND WHY IT IS SHAPED THIS WAY.
 *
 *   with distinctive terms available:  >= 1 distinctive AND >= 2 total
 *   with none available:               >= 3 supporting
 *
 * A distinctive term is what ties a candidate to THIS event — "Penang", a
 * named person, a named organization. Requiring one is what rejects
 * "Australian inflation", "puppet workshop in Australia" and the unrelated
 * murder: none of them can reach Penang. Requiring a SECOND term on top is
 * what stops a lone place-name coincidence — a different Penang story — from
 * qualifying on geography alone, which is the same mistake as the country feed
 * at a smaller scale.
 *
 * The no-distinctive-terms branch is stricter on purpose. A headline with no
 * proper nouns ("Inflation rises for a third month") offers nothing that
 * identifies an event, so admission there rests entirely on ordinary
 * vocabulary and three independent matches is the least that means anything.
 *
 * EVERY MATCH IS scoreGenericRelevance(), UNMODIFIED. Per term, its
 * single-word rule already demands two independent corroborating signals
 * (title, summary, repeated summary, category), so "mentioned once in passing"
 * does not count as a match here either. This function contributes the term
 * set and the counting rule; it contributes no scoring of its own.
 */
export function isMateriallyRelatedToAnchor(
  candidate: Pick<NewsArticle, 'title' | 'summary' | 'category'>,
  terms: AnchorTerms,
): AnchorRelevanceResult {
  const matchedDistinctive = terms.distinctive.filter(
    (term) => scoreGenericRelevance(candidate, term).isRelevant,
  );
  const matchedSupporting = terms.supporting.filter(
    (term) => scoreGenericRelevance(candidate, term).isRelevant,
  );
  const total = matchedDistinctive.length + matchedSupporting.length;

  if (terms.distinctive.length > 0) {
    const isRelated = matchedDistinctive.length >= 1 && total >= 2;
    return {
      isRelated,
      matchedDistinctive,
      matchedSupporting,
      reason: isRelated
        ? `matched distinctive [${matchedDistinctive.join(', ')}] plus ${total} anchor terms in total`
        : matchedDistinctive.length === 0
          ? 'no distinctive anchor term matched — a shared country is not a topical relation'
          : 'only one anchor term matched — insufficient corroboration for the same story',
    };
  }

  const isRelated = matchedSupporting.length >= 3;
  return {
    isRelated,
    matchedDistinctive,
    matchedSupporting,
    reason: isRelated
      ? `anchor carries no distinctive terms; matched ${matchedSupporting.length} supporting terms`
      : 'anchor carries no distinctive terms and fewer than three supporting terms matched',
  };
}

/** Identity used to keep the anchor itself out of its own supporting set. */
export function isSameArticleAsAnchor(candidate: NewsArticle, anchor: NewsArticle): boolean {
  return candidate.id === anchor.id || candidate.url === anchor.url;
}
