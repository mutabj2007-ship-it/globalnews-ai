import { resolveCountryByAnyIdentifier, type CountryMeta } from '@globalnews-ai/shared';
import { resolveCountriesByDemonym } from '../../news/country/country-relevance.util';
import { blocksGeographicRouting } from './routing-function-words.util';
import { resolvePolishCountry } from './polish-country-forms.util';

/**
 * G-ALPHA-2 STAGE 2 — DETERMINISTIC QUERY INTENT CLASSIFICATION.
 *
 * WHAT WAS MISSING. The pipeline never asked what KIND of question it had been
 * given. It asked one question — "does this name a country?" — and everything
 * that failed that test became a single undifferentiated "generic news search"
 * whose provider phrase was the user's own sentence. Measured on the governing
 * baseline, that is why all four reported questions returned nothing:
 *
 *   NQ-001  "...updates in the Ukrainian and Russian conflicts..."  0 evidence
 *           (two countries named by demonym; neither was seen at all, and the
 *            whole sentence was required verbatim inside a headline)
 *   NQ-002  "...elaborate more about it."                           Italy
 *   NQ-003  "Which country is more powerful in East Africa?"        0 evidence
 *           (an implicit comparison with no determinable members)
 *   NQ-004  "What do you know about President Donald Trump?"        0 evidence
 *           (fixed separately by G-ALPHA-1 D2)
 *
 * WHAT THIS IS AND IS NOT. This is a closed, deterministic, pattern-and-table
 * classifier in the exact discipline of the modules beside it (M35's
 * SUBJECT_EXTRACTION_PATTERNS, M37's RELATIONAL_PATTERNS): no AI call, no NLP
 * library, no embeddings, no part-of-speech tagging, no learned model. It is
 * NOT a hard-code of the reported sentences — nothing here names Ukraine,
 * Russia, Rwanda, Kenya, quantum or Donald Trump. It classifies SHAPES.
 *
 * IT NEVER LOWERS AN EVIDENCE GATE. Classification decides only which
 * retrieval SHAPE a question gets and which phrase is searched for. Every
 * article admitted afterwards passes the same unmodified relevance gate it
 * passed before — scoreGenericRelevance for generic and per-entity retrieval,
 * scoreCountryRelevance for country retrieval, scoreRelationalRelevance for
 * relational retrieval. A question with no qualifying evidence still ends at
 * the existing zero-evidence surface with the analysis provider never called.
 *
 * ARTICLE_ANCHORED IS NOT DECIDED HERE. The CTO requirement that an anchored
 * request outrank everything else is ALREADY satisfied structurally in
 * AnalysisService: `if (anchorArticle) { ... } else if (location) { ... } else
 * { ...this classifier... }`. Encoding the same precedence a second time here
 * would create two places for one rule to drift, so the enum member exists,
 * classifyQueryIntent() reports it when told an anchor resolved, and the
 * service's own ordering — asserted by spec — remains the authority.
 */

export type QueryIntent =
  /** A resolved storyContext.articleId is present. Decided by AnalysisService, not here. */
  | 'ARTICLE_ANCHORED'
  /** Two or more determinable countries/entities; each side is retrieved and gated on its own. */
  | 'MULTI_ENTITY'
  /** An explicit comparison whose members are determinable. Retrieved per side, like MULTI_ENTITY. */
  | 'COMPARISON_RESEARCH'
  /** An explicit comparison whose members are NOT determinable. Must clarify, never invent members. */
  | 'CLARIFICATION_REQUIRED'
  /** Exactly one country, named directly or by demonym. */
  | 'GEOGRAPHIC_REGIONAL'
  /** "What is X" / "Explain X" with no current-event marker — the subject is what to search for. */
  | 'EXPLANATION'
  /** "What do you know about X" / "Tell me about X" — a named subject, not a place. */
  | 'ENTITY_BACKGROUND'
  /** The default. A news product's default reading of a topic is that it is a news topic. */
  | 'CURRENT_EVENT';

export interface QueryClassification {
  readonly intent: QueryIntent;
  /**
   * The determinable sides of a multi-entity or comparison question, in the
   * order the question named them. Populated ONLY for MULTI_ENTITY and
   * COMPARISON_RESEARCH; empty for every other intent. Bounded by MAX_SIDES.
   *
   * These are curated CountryMeta records, not free text, which is what lets
   * AnalysisService gate each side's results with the existing
   * scoreCountryRelevance() rather than inventing a new relevance system.
   */
  readonly sides: readonly CountryMeta[];
  /** Every country the question names, directly or by demonym, deduplicated by ISO3. */
  readonly countries: readonly CountryMeta[];
  /**
   * A concise subject, supplied ONLY for EXPLANATION and ONLY as a candidate.
   * AnalysisService uses it exclusively when the existing derivation left the
   * sentence untouched, so no shape already handled by M35/M46/G-ALPHA-1 D2 can
   * change. Never a rewrite of the user's question — always a span of it.
   */
  readonly subject?: string;
  /** Diagnostic only. Never rendered, never sent to a provider, never shown to a reader. */
  readonly reason: string;
}

export interface QueryIntentInput {
  /** True when storyContext.articleId resolved to a real article. */
  readonly hasResolvedArticleAnchor?: boolean;
}

/**
 * At most three sides are ever retrieved. This is the same bounded-fan-out
 * discipline Milestone #63 established for supplemental domain retrieval (a
 * hard cap on extra provider calls, chosen so one question can never become an
 * unbounded burst). A question naming more countries than this is still
 * classified MULTI_ENTITY; only the first three are retrieved, and the reason
 * string records the truncation.
 */
const MAX_SIDES = 3;

/**
 * The longest span accepted as one coordinated member. Long enough for
 * "the United Arab Emirates" and "the Democratic Republic of the Congo",
 * deliberately no longer.
 */
const MAX_MEMBER_WORDS = 6;

/**
 * Explicit comparison markers. A question carrying one of these is ASKING for a
 * comparison, which is what makes an undeterminable member a clarification case
 * rather than an ordinary unmatched query.
 */
const COMPARISON_MARKERS: readonly RegExp[] = [
  /\bcompare\b/i,
  /\bcompared\s+(?:to|with)\b/i,
  /\bcomparison\b/i,
  /\bversus\b/i,
  /\bvs\.?\b/i,
  /\bwhich\s+(?:one|country|countries|nation|nations|state|states)\b.*\b(?:more|less|better|worse|stronger|weaker|bigger|smaller|richer|poorer|safer)\b/i,
  /\bwho\s+is\s+(?:more|less|better|worse|stronger|weaker|bigger|richer|safer)\b/i,
  /\bdifference[s]?\s+between\b/i,

  /*
   * G-SEARCH-POLISH-PARITY-1 — THE MISSING GENERIC DEGREE WORD.
   *
   * MEASURED. "Which country is more powerful in East Africa?" reached
   * CLARIFICATION_REQUIRED; "Który kraj jest potężniejszy w Afryce Wschodniej?"
   * reached CURRENT_EVENT and answered silently. So did "...bardziej wpływowy"
   * and "...bardziej demokratyczny".
   *
   * THE CAUSE IS GRAMMATICAL, NOT A MISSING TRANSLATION. English marks every
   * comparison with a separate word — "more" / "less" — so ONE alternative
   * catches the entire open class of adjectives. Polish forms the comparative
   * MORPHOLOGICALLY, by suffixing the adjective itself (silny -> silniejszy,
   * potężny -> potężniejszy), so an enumerated stem list can only ever cover
   * the adjectives somebody thought of. G-ALPHA-2.1 enumerated nine; the tenth
   * one a reader typed was the one that failed.
   *
   * BUT POLISH ALSO HAS THE ANALYTIC FORM: "bardziej X" / "mniej X" — the exact
   * structural counterpart of "more X" / "less X", used for every adjective
   * that does not take the synthetic suffix. It was simply absent. Adding it
   * closes the open class the same way "more" does in English, which is why
   * this is a structural repair rather than another word on a list.
   *
   * IT CANNOT WIDEN WHAT MATCHES, because it is added INSIDE the existing
   * frame: the pattern still requires "który kraj / państwo" first. "Polska
   * jest bardziej zaangażowana" carries no frame and still matches nothing.
   *
   * `potężniejsz` is added too, because it is the measured failure — but the
   * synthetic list remains incomplete BY NATURE, and that is exactly why the
   * generic form above is the part that matters.
   */
  /*
   * G-ALPHA-2.1 (A) — POLISH. Bounded patterns, not translation: each is a
   * closed Polish comparison frame, matched with the /u flag so ą ć ę ł ń ó ś
   * ź ż are handled as letters. Both the diacritic and the bare-ASCII spelling
   * are accepted, because Polish is commonly typed without diacritics.
   */
  /\bpor[óo]wnaj\b/iu,
  /\bpor[óo]wnanie\b/iu,
  /\bpor[óo]wna[ćc]\b/iu,
  /\br[óo][żz]nic[ae]\s+mi[eę]dzy\b/iu,
  /\bkt[óo]r[ye]\s+(?:pa[nń]stwo|kraj|kraje|pa[nń]stwa)\b.*\b(?:bardziej|mniej|silniejsz|pot[eę][żz]niejsz|wa[żz]niejsz|bogatsz|biedniejsz|lepsz|gorsz|wi[eę]ksz|mniejsz|bezpieczniejsz)/iu,
  /\bkto\s+jest\s+(?:bardziej|mniej|silniejszy|pot[eę][żz]niejszy|wa[żz]niejszy|bogatszy|lepszy)\b/iu,
];

/**
 * Explanation markers — a request for what something IS, as opposed to what is
 * happening with it. Group 1 is the subject span in every pattern.
 */
const EXPLANATION_PATTERNS: readonly RegExp[] = [
  /^what\s+(?:is|are)\s+(?:a|an|the)?\s*(.+)$/i,
  /^what\s+does\s+(.+?)\s+mean$/i,
  /^explain\s+(?:to\s+me\s+)?(?:what\s+(?:is|are)\s+)?(.+)$/i,
  /^define\s+(.+)$/i,
  /^describe\s+(.+)$/i,
  /^how\s+(?:does|do)\s+(.+?)\s+work$/i,
  /^(?:can|could|would)\s+you\s+(?:please\s+)?explain\s+(.+)$/i,
  /^tell\s+me\s+what\s+(.+?)\s+(?:is|are)\b.*$/i,

  /*
   * G-ALPHA-2.1 (A) — Polish explanation frames.
   *   "Co to jest X?"          / "Czym jest X?"
   *   "Wyjaśnij X"             / "Wytłumacz X"
   *   "Wyjaśnij czym jest X i opowiedz o tym więcej"
   *   "Czy możesz wyjaśnić X dokładniej?"
   */
  /^co\s+to\s+(?:jest|s[ąa])\s+(.+)$/iu,
  /^czym\s+(?:jest|s[ąa])\s+(.+)$/iu,
  /^co\s+oznacza\s+(.+)$/iu,
  /^wyja[śs]nij\s+(?:mi\s+)?(?:czym\s+(?:jest|s[ąa])\s+)?(.+)$/iu,
  /^wyt[łl]umacz\s+(?:mi\s+)?(?:czym\s+(?:jest|s[ąa])\s+)?(.+)$/iu,
  /^zdefiniuj\s+(.+)$/iu,
  /^opisz\s+(.+)$/iu,
  /^czy\s+mo[żz]esz\s+(?:mi\s+)?wyja[śs]ni[ćc]\s+(.+)$/iu,
];

/**
 * Markers that make a question about the PRESENT, which outranks an explanation
 * reading. "What is happening in Spain" opens like an explanation pattern and is
 * plainly a news question; this is what keeps those apart.
 */
const CURRENT_EVENT_MARKERS: readonly RegExp[] = [
  /\bhappening\b/i,
  /\bhappened\b/i,
  /\bhappens\b/i,
  /\bnews\b/i,
  /\blatest\b/i,
  /\brecent(?:ly)?\b/i,
  /\bcurrent(?:ly)?\b/i,
  /\bupdate[sd]?\b/i,
  /\btoday\b/i,
  /\byesterday\b/i,
  /\bthis\s+(?:week|month|year|morning|evening)\b/i,
  /\bgoing\s+on\b/i,
  /\bdevelopment[s]?\b/i,
  /\bsituation[s]?\b/i,
  /\bcrisis\b/i,
  /\bconflict[s]?\b/i,
  /\bwar\b/i,
  /\belection[s]?\b/i,

  /* G-ALPHA-2.1 (A) — Polish current-event markers, same bounded discipline. */
  /\bdzieje\s+si[eę]\b/iu,
  /\bwydarzy[łl]o\s+si[eę]\b/iu,
  /\bnajnowsz[ey]\b/iu,
  /\bwiadomo[śs]ci\b/iu,
  /\baktualn[ye]\b/iu,
  /\bobecn[ae]\b/iu,
  /\bsytuacj[aię]\b/iu,
  /\bkryzys\b/iu,
  /\bkonflikt(?:y|em|cie)?\b/iu,
  /\bwojn[aiyę]\b/iu,
  /\bwybor(?:y|ach|ami)\b/iu,
  /\bdzisiaj\b/iu,
  /\bteraz\b/iu,
];

/**
 * Openers that introduce a named subject the user wants background on. Kept
 * deliberately in step with M35/G-ALPHA-1 D2's SUBJECT_EXTRACTION_PATTERNS —
 * this recognises the same family, it does not re-extract it. The subject span
 * itself still comes from that module, which remains the single authority.
 */
const ENTITY_BACKGROUND_MARKERS: readonly RegExp[] = [
  /^what\s+do\s+you\s+know\s+(?:about|of|on|regarding)\s+.+$/i,
  /^what\s+can\s+you\s+(?:tell\s+me|say)\s+(?:about|of|on|regarding)\s+.+$/i,
  /^do\s+you\s+know\s+(?:anything|much|something)\s+(?:about|of|on|regarding)\s+.+$/i,
  /^tell\s+me\s+(?:more\s+)?about\s+.+$/i,
  /^who\s+is\s+.+$/i,
  /^who\s+was\s+.+$/i,

  /* G-ALPHA-2.1 (A) — Polish background openers. */
  /^co\s+wiesz\s+o\s+.+$/iu,
  /^co\s+mo[żz]esz\s+(?:mi\s+)?powiedzie[ćc]\s+o\s+.+$/iu,
  /^opowiedz\s+(?:mi\s+)?o\s+.+$/iu,
  /^kim\s+(?:jest|by[łl])\s+.+$/iu,
];

/**
 * Coordination frames that put two or more members in an explicit list. Group 1
 * is the full member list, which splitMembers() then divides.
 *
 * A frame is REQUIRED before any country NAME is accepted from free text. This
 * is the same caution COUNTRY_CONTEXT_PATTERN already exercises in
 * AnalysisService, and for the same reason: Georgia, Turkey, Chad and Jordan are
 * ordinary English words as well as countries, so an ungated scan of every word
 * would misroute prose. Demonyms need no frame — see resolveNamedCountries().
 */
const COORDINATION_FRAMES: readonly RegExp[] = [
  /\bbetween\s+(.+?)\s*[?.!]*$/i,
  /*
   * The optional preposition MUST consume its own trailing whitespace.
   * Written as `(?:in|of|for|between)?\s*` it matched the "In" of
   * "India" and handed the member list "dia and Pakistan" to the
   * splitter, so "Compare India and Pakistan" found one member and asked
   * for clarification. Caught by the class corpus, not by a reviewer.
   */
  /\bcompare\s+(?:the\s+)?(?:current\s+)?(?:situations?|economies|economics|politics|conditions?|states?)?\s*(?:(?:in|of|for|between)\s+)?(.+?)\s*[?.!]*$/i,
  /\bcomparison\s+(?:of|between)\s+(.+?)\s*[?.!]*$/i,
  /\bdifference[s]?\s+between\s+(.+?)\s*[?.!]*$/i,
  /*
   * ASK EXPLICIT-SCOPE R1 — COUNTRY LISTS INSIDE A LONGER SENTENCE.
   *
   * The live failure that introduced this frame was:
   *   "Compare how current local reporting in Israel, Iran, Saudi Arabia,
   *    Turkey and the UAE is framing ..."
   *
   * The older comparison frames only accepted a country list immediately
   * after "compare". Here the comparison target is introduced later by the
   * ordinary geographic preposition "in", so the classifier saw no countries
   * and a stale storyContext country silently won.
   *
   * This frame is deliberately conservative:
   * - it only opens on an explicit geographic preposition;
   * - it stops at a finite-clause verb boundary or sentence end;
   * - resolveNamedCountries still accepts it ONLY if at least two members
   *   resolve exactly through the canonical country table.
   *
   * Therefore "in general", "in the market", etc. contribute nothing, while
   * a real comma/and country list becomes authoritative typed scope.
   */
  /\b(?:in|from|across)\s+(.+?)(?=\s+(?:is|are|was|were|has|have|had|will|would|can|could|should|may|might|that|which|who|while)\b|[?.!]|$)/i,
  /^(.+?)\s+(?:versus|vs\.?)\s+(.+?)\s*[?.!]*$/i,

  /*
   * G-ALPHA-2.1 (A) — Polish coordination frames. "między X a Y" is the
   * ordinary Polish "between X and Y"; note the connective is "a", not "i",
   * which is why splitMembers() below accepts both.
   */
  /\bmi[eę]dzy\s+(.+?)\s*[?.!]*$/iu,
  /\bpor[óo]wnaj\s+(?:sytuacj[eęę]\s+)?(?:w|we|z)?\s*(.+?)\s*[?.!]*$/iu,
  /\bpor[óo]wnanie\s+(?:sytuacji\s+)?(?:w|we|z)?\s*(.+?)\s*[?.!]*$/iu,
  /\br[óo][żz]nic[ae]\s+mi[eę]dzy\s+(.+?)\s*[?.!]*$/iu,
];

/**
 * G-ALPHA-2.1 (A) — Polish prepositions that introduce a place, and the single
 * token following one. Global so every prepositional phrase in the sentence is
 * considered, which is what lets "Porównaj sytuację w Rwandzie i Kenii" and
 * "Co dzieje się w Polsce?" both be read.
 */
const POLISH_LOCATION_FRAME = /\b(?:w|we|z|ze|do|na|o|od|dla|przez)\s+([\p{L}]+)/giu;

function stripTrailingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .trim();
}

function stripLeadingThe(value: string): string {
  return value.replace(/^(?:the)\s+/i, '').trim();
}

/**
 * Strips one leading article of any kind. Used ONLY for an explanation subject,
 * where "Explain a recession" and "What is a recession" must produce the same
 * search phrase. Member resolution deliberately keeps the narrower
 * stripLeadingThe(), which is the idiom the surrounding modules already use.
 */
function stripLeadingArticle(value: string): string {
  return value.replace(/^(?:a|an|the)\s+/i, '').trim();
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/**
 * Divides a coordinated member list into its members. Splits on commas, on the
 * conjunctions both languages use to coordinate ("and", "or", "oraz", "i",
 * "lub", "a"), and on the explicit comparison connectives.
 */
function splitMembers(list: string): string[] {
  return (
    list
      /*
       * "a" is a genuine Polish coordinating connective ("między Rosją a
       * Ukrainą") and is NOT the English article here — the split is
       * whitespace-delimited on both sides, so an English "a car" is never
       * divided by it.
       */
      .split(/\s*,\s*|\s+(?:and|or|with|versus|vs\.?|oraz|lub|a)\s+|\s+i\s+/iu)
      .map((part) => stripLeadingThe(stripTrailingPunctuation(part)))
      .filter((part) => part.length > 0)
  );
}

/**
 * Resolves one coordinated member to a country, by shrinking it from the right
 * the same way AnalysisService#resolveExactLocationInSegment does — so
 * "Rwanda and Kenya" splitting to "Kenya." or a member carrying a trailing noun
 * ("Rwanda politics") still resolves, while nothing is invented from a member
 * that resolves to nothing.
 */
function resolveMemberCountry(member: string): CountryMeta | undefined {
  const words = member.split(/\s+/).filter(Boolean);

  if (words.length === 0 || words.length > MAX_MEMBER_WORDS) {
    return undefined;
  }

  for (let length = words.length; length >= 1; length -= 1) {
    const candidate = stripLeadingThe(words.slice(0, length).join(' '));

    if (candidate.length === 0) continue;

    // The Stage 1 guard applies here identically. A coordination frame is not
    // permission for a lone prose function word to become a country: "between
    // us and them" must not resolve to the United States.
    if (blocksGeographicRouting(candidate)) continue;

    /*
     * G-ALPHA-2.1 (A) — English identifiers first, then Polish surface forms.
     * The order matters only for a token that could be read either way, and
     * the English table is the one every other route already consults, so it
     * stays authoritative.
     */
    const country = resolveCountryByAnyIdentifier(candidate) ?? resolvePolishCountry(candidate);

    if (country) return country;
  }

  return undefined;
}

function pushUnique(into: CountryMeta[], country: CountryMeta | undefined): void {
  if (!country) return;
  if (into.some((existing) => existing.iso3 === country.iso3)) return;
  into.push(country);
}

/**
 * Every country the question names, in the order it named them.
 *
 * TWO EVIDENCE SOURCES, TWO DIFFERENT GATES:
 *
 *   DEMONYMS are scanned across the WHOLE sentence with no frame required.
 *   That is safe precisely because the curated demonym table is not a
 *   mechanical derivation: it deliberately omits every adjectival form that is
 *   ambiguous or non-locative in ordinary English ('american', 'korean',
 *   'congolese', 'guinean', 'dominican', 'georgian', 'english'), and its
 *   non-locative compound guard keeps "french fries" and "turkish delight" from
 *   naming a country. An unambiguous adjectival form IS the user naming a
 *   place, wherever it appears — which is what finally makes "the Ukrainian and
 *   Russian conflicts" resolve to two countries.
 *
 *   COUNTRY NAMES require an explicit coordination frame, because several real
 *   country names are also ordinary words. This is the same restraint
 *   COUNTRY_CONTEXT_PATTERN already applies, carried over deliberately rather
 *   than relaxed.
 */
function resolveNamedCountries(text: string): CountryMeta[] {
  const found: CountryMeta[] = [];

  for (const frame of COORDINATION_FRAMES) {
    const match = text.match(frame);

    if (!match) continue;

    // A frame may capture one member list (group 1) or an explicit pair
    // (groups 1 and 2, the "X versus Y" shape).
    const captures = match.slice(1).filter((capture): capture is string => Boolean(capture));
    const members = captures.flatMap((capture) => splitMembers(capture));
    const resolvedHere: CountryMeta[] = [];

    for (const member of members) {
      pushUnique(resolvedHere, resolveMemberCountry(member));
    }

    // A frame contributes only when it genuinely produced a coordination —
    // two or more distinct countries. One country from a frame is indis-
    // tinguishable from ordinary prepositional geography, which detectLocation()
    // already owns, so it is left to it.
    if (resolvedHere.length >= 2) {
      for (const country of resolvedHere) pushUnique(found, country);
      break;
    }
  }

  for (const country of resolveCountriesByDemonym(text)) {
    pushUnique(found, country);
  }

  /*
   * G-ALPHA-2.1 (A) — POLISH PREPOSITIONAL GEOGRAPHY.
   *
   * "w Polsce", "z Polski", "o Rwandzie" state a place exactly as plainly as
   * "in Poland" does, and the English COUNTRY_CONTEXT_PATTERN cannot see any of
   * them. This is the Polish counterpart of that same preposition gate: a
   * country name is only read when a preposition introduces it, never from a
   * free scan of every word.
   *
   * It is safe to run ungated across the sentence because the token must ALSO
   * be an unambiguous Polish country surface form — a set measured to have zero
   * collisions with another country and zero collisions with the Stage 1
   * function-word list, and floored at four characters.
   */
  for (const match of text.matchAll(POLISH_LOCATION_FRAME)) {
    const token = match[1];

    if (!token || blocksGeographicRouting(token)) continue;

    pushUnique(found, resolvePolishCountry(token));
  }

  return found;
}

/**
 * G-ALPHA-2.1 (B) — INNER FRAMES: "what X is" INSIDE an explanation body.
 *
 * The Alpha defect this closes is "Explain what quantum is and elaborate more
 * about it." The outer opener captures the whole body — "what quantum is and
 * elaborate more about it" — which is eight words, over the subject bound, and
 * was therefore refused. The concept was sitting in plain sight the entire
 * time, inside an embedded copular clause.
 *
 * Group 1 is the concept in every pattern. Anything after the clause is a tail
 * and is discarded by construction, which is what makes this a REDUCTION rather
 * than a raised word limit: the bound below is unchanged and still applies to
 * the reduced concept.
 */
const EXPLANATION_INNER_FRAMES: readonly RegExp[] = [
  // "what quantum is ..." / "what black holes are ..."
  /^what\s+(.+?)\s+(?:is|are)\b.*$/i,
  // "czym jest kwant ..." / "czym są czarne dziury ..."
  /^czym\s+(?:jest|s[ąa])\s+(.+?)(?:\s+(?:i|oraz)\s+.*)?$/iu,
  // "co to jest kwant ..."
  /^co\s+to\s+(?:jest|s[ąa])\s+(.+?)(?:\s+(?:i|oraz)\s+.*)?$/iu,
];

/**
 * G-ALPHA-2.1 (B) — TRAILING ELABORATION CLAUSES.
 *
 * A closed list of phrases that ask for MORE of an answer without naming any
 * part of the concept. Each is anchored to the end of the body, so a phrase can
 * only ever be removed as a tail — "detail" inside a concept such as "detail
 * engineering" is untouched because it is not final.
 *
 * These are meta-requests, not subject matter. Removing them is what lets the
 * unchanged bound accept the concept that remains.
 */
const ELABORATION_TAILS: readonly RegExp[] = [
  /\s+and\s+(?:elaborate|expand|explain|tell\s+me|say|give\s+me|describe|go)\b.*$/i,
  /\s+in\s+(?:more|greater|full)\s+detail\b.*$/i,
  /\s+in\s+detail\b.*$/i,
  /\s+in\s+(?:simple|plain|layman'?s?)\s+(?:terms|english|words)\b.*$/i,
  /\s+(?:for|to)\s+me\b\s*$/i,
  /\s+please\b\s*$/i,
  /\s+step\s+by\s+step\b.*$/i,
  /\s+as\s+(?:much|simply)\s+as\s+possible\b.*$/i,
  /\s+briefly\b\s*$/i,

  /* Polish equivalents, same closed discipline. */
  /\s+(?:i|oraz)\s+(?:opowiedz|wyja[śs]nij|wyt[łl]umacz|powiedz|opisz|rozwi[nń])\b.*$/iu,
  /\s+(?:dok[łl]adniej|szczeg[óo][łl]owo|bardziej\s+szczeg[óo][łl]owo)\b.*$/iu,
  /\s+w\s+prostych\s+s[łl]owach\b.*$/iu,
  /\s+prosz[eę]\b\s*$/iu,
  /\s+wi[eę]cej\s+o\s+tym\b.*$/iu,
];

/**
 * Reduces an explanation BODY to its concept, deterministically.
 *
 * Two steps, both subtractive: strip any trailing elaboration clause, then take
 * the concept out of an embedded "what X is" frame if there is one. Neither
 * step can add a word, so the result is always a span of what the user wrote.
 */
function reduceExplanationBody(body: string): string {
  let reduced = stripTrailingPunctuation(body);

  for (const tail of ELABORATION_TAILS) {
    reduced = stripTrailingPunctuation(reduced.replace(tail, ''));
  }

  for (const frame of EXPLANATION_INNER_FRAMES) {
    const match = reduced.match(frame);
    const inner = match?.[1] ? stripTrailingPunctuation(match[1]) : undefined;

    if (inner && inner.length > 0) {
      reduced = inner;
      break;
    }
  }

  return stripLeadingArticle(reduced);
}

/**
 * G-ALPHA-2.1 (B) — the concept lives in the FIRST clause.
 *
 * The reported Alpha input is two sentences: "What is quantum? Explain what
 * quantum is and elaborate more about it." An opener anchored at the start
 * captured straight through the question mark and produced the subject
 * "quantum? Explain what quantum is" — a span that is not a concept and would
 * have been sent to a provider. Explanation extraction therefore reads only up
 * to the first sentence terminator; the rest of the input still counts for
 * every other signal, including the current-event markers.
 */
function firstSentence(text: string): string {
  const match = text.match(/^[^?!.]+/u);

  return (match?.[0] ?? text).trim();
}

/** Extracts the subject span of an explanation question, if the shape is one. */
function extractExplanationSubject(text: string): string | undefined {
  const opening = firstSentence(text);

  for (const pattern of EXPLANATION_PATTERNS) {
    const match = opening.match(pattern);

    if (!match) continue;

    const subject = reduceExplanationBody(match[1] ?? '');

    /*
     * THE BOUND IS UNCHANGED, AND STILL REFUSES. G-ALPHA-2.1 (B) adds
     * reduction, not permission: a body that is still longer than
     * MAX_MEMBER_WORDS after every subtractive step is genuinely a sentence
     * rather than a concept, and is refused rather than truncated — the same
     * choice M37 makes for an oversized relational concept. A truncated
     * fragment would become both the provider query and the phrase the
     * relevance gate demands verbatim, which is the very failure this whole
     * package exists to remove.
     */
    if (subject.length === 0 || wordCount(subject) > MAX_MEMBER_WORDS) continue;

    return subject;
  }

  return undefined;
}

/**
 * Classifies a query already processed by normalizeQuery().
 *
 * TOTAL AND NEVER-THROWING: every input returns a classification. The default
 * is CURRENT_EVENT, which routes to the existing generic branch unchanged — so
 * a shape this classifier does not recognise behaves exactly as it does today.
 * The ONLY class that withholds retrieval is CLARIFICATION_REQUIRED, and only
 * for the case the CTO named explicitly: a question that ASKS for a comparison
 * while naming no determinable members.
 */
export function classifyQueryIntent(
  normalizedQuery: string,
  input: QueryIntentInput = {},
): QueryClassification {
  const text = stripTrailingPunctuation(normalizedQuery ?? '');

  if (input.hasResolvedArticleAnchor) {
    return {
      intent: 'ARTICLE_ANCHORED',
      sides: [],
      countries: [],
      reason: 'a storyContext.articleId resolved to a real article',
    };
  }

  if (text.length === 0) {
    return { intent: 'CURRENT_EVENT', sides: [], countries: [], reason: 'empty query' };
  }

  const countries = resolveNamedCountries(text);
  const isComparison = matchesAny(text, COMPARISON_MARKERS);
  const sides = countries.slice(0, MAX_SIDES);

  /*
   * G-ALPHA-2.1 (C) — MORE COUNTRIES THAN CAN BE RETRIEVED IS A CLARIFICATION,
   * NOT A QUIET TRUNCATION.
   *
   * G-ALPHA-2 capped retrieval at MAX_SIDES and recorded the truncation only
   * in this object's `reason`, which is a diagnostic string that nothing
   * downstream reads and no reader ever sees. So a question naming six
   * countries was answered from three of them and presented exactly like a
   * complete answer. Silence about which three is the whole problem: the user
   * cannot tell a bounded answer from a full one.
   *
   * The two honest options were an explicit partial-coverage field on
   * AnalysisRetrievalContext — a shared-contract change, which the CTO
   * instruction reserves for a proposal rather than an implementation — or
   * asking. This asks. It is the smaller behaviour, it needs no new contract
   * and no new frontend copy, and it reuses the CLARIFICATION_REQUIRED class
   * and the existing non-retrievable surface that already exist for exactly
   * "the members are not determinable enough to answer honestly".
   *
   * The ceiling itself is unchanged and still believed to be the safe bound —
   * see MAX_SIDES. What changes is that exceeding it is now said out loud.
   */
  if (countries.length > MAX_SIDES) {
    return {
      intent: 'CLARIFICATION_REQUIRED',
      sides: [],
      countries,
      reason:
        `${countries.length} countries named, above the ${MAX_SIDES}-side retrieval ceiling; ` +
        'answering from a subset would imply coverage that was never retrieved',
    };
  }

  if (isComparison) {
    if (sides.length >= 2) {
      return {
        intent: 'COMPARISON_RESEARCH',
        sides,
        countries,
        reason: `explicit comparison with ${sides.length} determinable members`,
      };
    }

    /*
     * THE CTO'S EXPLICIT REQUIREMENT. "Which country is more powerful in East
     * Africa?" asks for a comparison and names no members. The only two
     * alternatives are to invent them — choosing which East African countries
     * the user "meant", which is fabricated evidence selection dressed as
     * retrieval — or to say so. This says so, using the existing
     * non-retrievable surface and no new user-facing copy.
     */
    return {
      intent: 'CLARIFICATION_REQUIRED',
      sides: [],
      countries,
      reason:
        sides.length === 1
          ? 'explicit comparison naming only one determinable member'
          : 'explicit comparison naming no determinable members',
    };
  }

  if (sides.length >= 2) {
    return {
      intent: 'MULTI_ENTITY',
      sides,
      countries,
      reason: `${countries.length} countries named`,
    };
  }

  if (countries.length === 1) {
    return {
      intent: 'GEOGRAPHIC_REGIONAL',
      sides: [],
      countries,
      reason: `one country named: ${countries[0].name}`,
    };
  }

  if (matchesAny(text, ENTITY_BACKGROUND_MARKERS)) {
    return {
      intent: 'ENTITY_BACKGROUND',
      sides: [],
      countries,
      reason: 'a background opener introduces a named subject',
    };
  }

  /*
   * An explanation reading is accepted ONLY when nothing in the sentence points
   * at the present. "What is happening in Spain" and "What is the latest on the
   * strike" open like explanations and are plainly news questions; a
   * current-event marker is what keeps them out of this class.
   */
  if (!matchesAny(text, CURRENT_EVENT_MARKERS)) {
    const subject = extractExplanationSubject(text);

    if (subject) {
      return {
        intent: 'EXPLANATION',
        sides: [],
        countries,
        subject,
        reason: `explanation request for "${subject}", no current-event marker present`,
      };
    }
  }

  return {
    intent: 'CURRENT_EVENT',
    sides: [],
    countries,
    reason: 'default — a topic in a news product is read as a news topic',
  };
}
