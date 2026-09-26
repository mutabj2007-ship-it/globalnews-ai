import {
  AMBIGUOUS_COUNTRY_NAMES,
  resolveCountryByAnyIdentifier,
  resolveLocationContext,
  type EventAnchorDisclosure,
  type EventEvidenceRelation,
  type EventQuestionAspects,
  type NewsArticle,
} from '@globalnews-ai/shared';
import { FALLBACK_STOPWORDS } from '../query/derive-generic-news-query.util';
import { scoreGenericRelevance } from '../../news/relevance/generic-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — DETERMINISTIC EVENT ANCHORING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Everything here is deterministic and bounded: closed word lists, the existing
 * Recall R2 relevance gate for "is this article about the event", and sentence-
 * level pattern checks for "does this report itself link a consequence to the
 * event". No AI call, no stemming dictionary, no model output is ever read.
 */

/** Question words that ask ABOUT an event rather than name it (EN + PL). */
const ASPECT_AND_FUNCTION_WORDS = new Set([
  'cause',
  'caused',
  'causes',
  'causing',
  'reason',
  'reasons',
  'behind',
  'blame',
  'blamed',
  'effect',
  'effects',
  'impact',
  'impacts',
  'influence',
  'influenced',
  'influences',
  'consequence',
  'consequences',
  'affect',
  'affects',
  'affected',
  'affecting',
  'implication',
  'implications',
  'involved',
  'concern',
  'concerns',
  'great',
  'big',
  'serious',
  'neighboring',
  'neighbouring',
  'neighbor',
  'neighbour',
  'neighbors',
  'neighbours',
  'countries',
  'country',
  'region',
  'regional',
  'border',
  'borders',
  'cross',
  'spillover',
  'does',
  'do',
  'did',
  'has',
  'had',
  'have',
  'its',
  'it',
  'this',
  'that',
  'these',
  'those',
  'will',
  'would',
  'could',
  'can',
  'should',
  'there',
  'they',
  'their',
  'them',
  'any',
  'all',
  'which',
  'whom',
  'whose',
  'as',
  'by',
  'from',
  'into',
  'up',
  'out',
  'so',
  'if',
  'than',
  'then',
  'mean',
  'means',
  'matter',
  'matters',
  'explain',
  'tell',
  'more',
  'much',
  'many',
  /* PL */
  'co',
  'czy',
  'jak',
  'jaki',
  'jakie',
  'dlaczego',
  'czemu',
  'kto',
  'przyczyna',
  'przyczyny',
  'spowodowało',
  'skutek',
  'skutki',
  'wpływ',
  'wpływa',
  'konsekwencje',
  'sąsiednie',
  'sąsiednich',
  'kraje',
  'krajów',
  'region',
  'to',
  'tego',
  'tym',
  'ten',
  'ta',
  'te',
  'tej',
  'temu',
  'jest',
  'są',
  'był',
  'była',
  'było',
  'w',
  'na',
  'o',
  'i',
  'z',
  'do',
  'się',
]);

const ANAPHOR =
  /\b(?:this|that|it|these|those)\b|\bthe\s+(?:crash|event|incident|attack|accident|disaster|explosion|outbreak|strike|blast|shooting|collapse|deal|decision|vote|election|killing|killings|protest|protests|fire|flood|earthquake)\b/i;
const ANAPHOR_PL = /(?:^|\s)(?:to|tego|tym|ten|ta|te|tej|temu|tę)(?=\s|[?!.,;:]|$)/iu;

const CAUSE_ASPECT =
  /\b(?:cause[ds]?|causing|why|reasons?|blamed?|behind)\b|przyczyn|dlaczego|czemu/iu;
const EFFECT_ASPECT =
  /\b(?:effects?|impacts?|influenc(?:e|es|ed)|consequences?|affect(?:s|ed|ing)?|implications?|involved|concern)\b|skutk|wpływ|konsekwencj/iu;
const CROSS_BORDER_ASPECT =
  /\b(?:neighbou?r(?:s|ing)?|cross[- ]border|regional|region|spill[- ]?over|surrounding countries|other countries|borders?)\b|sąsied|sąsiad|region/iu;

/** A sentence that itself LINKS something to the event (EN + PL). */
const CONSEQUENCE_LINK =
  /\b(?:after|following|in the wake of|due to|because of|as a result of|in response to|prompted by|triggered by|led to|leads to|prompted|triggered|sparked|forced|resulted in|caused)\b|(?:^|\s)(?:po|wskutek|z powodu|w wyniku|w następstwie|doprowadził\w*)(?=\s)/iu;
/** A sentence that REPORTS a cause, and one that reports the cause as unknown. */
const CAUSE_REPORTED =
  /\b(?:caused by|blamed on|due to|because of|attributed to|the result of|resulted from|engine failure|mechanical failure|pilot error|bad weather|shot down)\b|spowodowan|z powodu|wskutek/iu;
const CAUSE_UNKNOWN =
  /\b(?:under investigation|not (?:yet )?(?:known|determined|clear|established)|no cause|unknown cause|cause (?:is|was|remains) (?:unknown|unclear)|investigat)/iu;

function tokens(text: string): string[] {
  return (text ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * True when `span` names a country, city or ambiguous country. A span of three
 * letters or fewer counts only when written in capitals ("UK", "DRC"): the
 * resolver also accepts ISO codes, and ordinary words — "it", "is", "in", "to"
 * — would otherwise read as Italy, Iceland, India and Tonga.
 */
function isPlace(span: string): boolean {
  if (span.replace(/\s+/g, '').length <= 3 && span !== span.toUpperCase()) return false;
  const lower = span.toLowerCase();
  return (
    AMBIGUOUS_COUNTRY_NAMES[lower] !== undefined ||
    resolveCountryByAnyIdentifier(span) !== undefined ||
    resolveLocationContext(span) !== undefined
  );
}

/**
 * The event's topic words from a question: everything that is not framing,
 * question aspect, anaphor or place. "What caused the plane crash in Congo?"
 * → "plane crash". Returns undefined when nothing names an event.
 */
export function deriveEventTopic(question: string): string | undefined {
  const words = tokens(question);
  const kept: string[] = [];
  for (let i = 0; i < words.length;) {
    let placeSpan = 0;
    for (let len = Math.min(4, words.length - i); len >= 1; len--) {
      if (isPlace(words.slice(i, i + len).join(' '))) {
        placeSpan = len;
        break;
      }
    }
    if (placeSpan > 0) {
      i += placeSpan;
      continue;
    }
    const word = words[i];
    i += 1;
    const lower = word.toLowerCase();
    if (lower.length < 2) continue;
    if (FALLBACK_STOPWORDS.has(lower) || ASPECT_AND_FUNCTION_WORDS.has(lower)) continue;
    kept.push(lower);
  }
  return kept.length > 0 ? kept.slice(0, 4).join(' ') : undefined;
}

export function detectEventAspects(question: string): EventQuestionAspects {
  return {
    cause: CAUSE_ASPECT.test(question),
    effect: EFFECT_ASPECT.test(question),
    crossBorder: CROSS_BORDER_ASPECT.test(question),
  };
}

export function asksAboutEvent(aspects: EventQuestionAspects): boolean {
  return aspects.cause || aspects.effect || aspects.crossBorder;
}

/**
 * A follow-up that refers BACK to an event instead of naming one: it carries an
 * anaphor ("this", "it", "the crash", PL "to/tego/tym") and names no event and
 * no place of its own.
 */
export function isAnaphoricFollowUp(question: string): boolean {
  if (!ANAPHOR.test(question) && !ANAPHOR_PL.test(question)) return false;
  if (deriveEventTopic(question) !== undefined) return false;
  const words = tokens(question);
  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= Math.min(4, words.length - i); len++) {
      if (isPlace(words.slice(i, i + len).join(' '))) return false;
    }
  }
  return true;
}

/**
 * A bare ambiguous country name in the question ("Congo"), when it is NOT
 * qualified ("DR Congo", "Democratic Republic of the Congo", "Republic of the
 * Congo", "Congo-Kinshasa", "Congo-Brazzaville").
 */
export function detectAmbiguousCountryMention(
  question: string,
): { mention: string; candidates: readonly string[] } | undefined {
  const text = question ?? '';
  for (const [name, candidates] of Object.entries(AMBIGUOUS_COUNTRY_NAMES)) {
    const re = new RegExp(`(^|[^\\p{L}])(${name})(?=$|[^\\p{L}])`, 'iu');
    const match = re.exec(text);
    if (!match) continue;
    const at = match.index + match[1].length;
    if (!isQualifiedMention(text, at, name.length))
      return { mention: text.slice(at, at + name.length), candidates };
  }
  return undefined;
}

/** "DR Congo", "Republic of the Congo", "Congo-Kinshasa" … name ONE country. */
function isQualifiedMention(text: string, at: number, length: number): boolean {
  const before = text.slice(Math.max(0, at - 32), at).toLowerCase();
  const after = text.slice(at + length, at + length + 16).toLowerCase();
  return (
    /(?:^|[^\p{L}])(?:dr|d\.r\.|democratic republic of(?: the)?|republic of(?: the)?|demokratyczn\p{L}* republik\p{L}*|republik\p{L}*)\s*$/iu.test(
      before,
    ) || /^\s*[-–(]?\s*(?:kinshasa|brazzaville)/iu.test(after)
  );
}

/**
 * The text with every UNQUALIFIED ambiguous country name blanked out, so a bare
 * "Congo" in an article cannot vote for either candidate when the event evidence
 * is used to disambiguate. Qualified forms ("DR Congo", "Congo-Brazzaville") and
 * other signals (cities such as Goma, demonyms) are untouched and still decide.
 */
export function withoutAmbiguousCountryMentions(text: string): string {
  let out = text ?? '';
  for (const name of Object.keys(AMBIGUOUS_COUNTRY_NAMES)) {
    const re = new RegExp(`(^|[^\\p{L}])(${name})(?=$|[^\\p{L}])`, 'giu');
    out = out.replace(
      re,
      (whole: string, lead: string, word: string, offset: number, full: string) =>
        isQualifiedMention(full, offset + lead.length, word.length)
          ? whole
          : `${lead}${' '.repeat(word.length)}`,
    );
  }
  return out;
}

function sentences(text: string): string[] {
  return (text ?? '')
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One word with light inflection ("crash" → crash|crashes|crashed|crashing). */
function inflectedWordPattern(word: string): RegExp {
  const stem = word.replace(/(?:es|s|ed|ing)$/i, '');
  return new RegExp(
    `(^|[^\\p{L}])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}{0,4}(?=$|[^\\p{L}])`,
    'iu',
  );
}

/** The event's head noun (last topic word) with light inflection. */
function headNounPattern(topic: string): RegExp {
  return inflectedWordPattern(tokens(topic).pop() ?? topic);
}

/**
 * Every topic word, lightly inflected, inside ONE field — the title, or one
 * summary sentence. Covers "plane crashes" / "plane crashed" for "plane crash",
 * which the global Recall R2 gate deliberately does not inflect.
 */
function allTopicWordsInOneField(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  topic: string,
): boolean {
  const patterns = tokens(topic).map(inflectedWordPattern);
  if (patterns.length === 0) return false;
  const fields = [article.title ?? '', ...sentences(article.summary ?? '')];
  return fields.some((field) => patterns.every((p) => p.test(field)));
}

/**
 * The ONE classifier of an article's relation to the anchored event.
 * Reuses the Recall R2 relevance gate for "is this article about the event".
 */
export function classifyEventEvidence(
  article: Pick<NewsArticle, 'title' | 'summary' | 'category'>,
  topic: string,
): EventEvidenceRelation {
  const about =
    scoreGenericRelevance(article, topic).isRelevant || allTopicWordsInOneField(article, topic);
  if (!about) return 'CONTEXT_ONLY';
  const head = headNounPattern(topic);
  const linksConsequence = sentences(`${article.title ?? ''}. ${article.summary ?? ''}`).some(
    (s) => head.test(s) && CONSEQUENCE_LINK.test(s) && !CAUSE_UNKNOWN.test(s),
  );
  return linksConsequence ? 'REPORTED_CONSEQUENCE' : 'DIRECT_EVENT';
}

/**
 * Deterministic disclosures for an answer, from event-linked evidence only.
 * Context evidence can never establish a cause or a cross-border consequence.
 */
export function deriveEventDisclosures(
  aspects: EventQuestionAspects,
  topic: string,
  classified: ReadonlyArray<{
    article: Pick<NewsArticle, 'title' | 'summary'>;
    relation: EventEvidenceRelation;
  }>,
): EventAnchorDisclosure[] {
  const head = headNounPattern(topic);
  const eventLinked = classified.filter((c) => c.relation !== 'CONTEXT_ONLY');
  const eventSentences = eventLinked.flatMap((c) =>
    sentences(`${c.article.title ?? ''}. ${c.article.summary ?? ''}`),
  );
  const disclosures: EventAnchorDisclosure[] = [];

  if (aspects.cause) {
    const causeReported = eventSentences.some(
      (s) => CAUSE_REPORTED.test(s) && !CAUSE_UNKNOWN.test(s),
    );
    if (!causeReported) disclosures.push('CAUSE_NOT_ESTABLISHED');
  }
  if (aspects.crossBorder) {
    const crossBorderReported = eventSentences.some(
      (s) => head.test(s) && CROSS_BORDER_ASPECT.test(s) && CONSEQUENCE_LINK.test(s),
    );
    if (!crossBorderReported) disclosures.push('CROSS_BORDER_NOT_ESTABLISHED');
  }
  if (classified.some((c) => c.relation === 'CONTEXT_ONLY')) disclosures.push('CONTEXT_SEPARATED');
  return disclosures;
}

/**
 * THE DETERMINISTIC GUARANTEE, independent of prompt obedience.
 *
 * A claim about the event's consequences — immediateImpacts,
 * spilloverImplications, affectedParties — whose ONLY supporting articles are
 * CONTEXT_ONLY is withheld. Context may still appear where it belongs (the
 * `context` field, key facts about the context itself); it can never stand in
 * for an effect, an affected party or a cross-border impact of the event.
 */
export function withholdContextOnlyConsequenceClaims<
  T extends {
    immediateImpacts?: ReadonlyArray<{ sourceArticleIds: readonly string[] }>;
    spilloverImplications?: ReadonlyArray<{ sourceArticleIds: readonly string[] }>;
    affectedParties?: ReadonlyArray<{ sourceArticleIds: readonly string[] }>;
  },
>(analysis: T, contextArticleIds: ReadonlySet<string>): { analysis: T; withheld: number } {
  if (contextArticleIds.size === 0) return { analysis, withheld: 0 };
  let withheld = 0;
  const keep = <C extends { sourceArticleIds: readonly string[] }>(
    claims: ReadonlyArray<C> | undefined,
  ): C[] | undefined => {
    if (claims === undefined) return undefined;
    return claims.filter((claim) => {
      const contextOnly =
        claim.sourceArticleIds.length > 0 &&
        claim.sourceArticleIds.every((id) => contextArticleIds.has(id));
      if (contextOnly) withheld += 1;
      return !contextOnly;
    });
  };
  const next = {
    ...analysis,
    ...(analysis.immediateImpacts !== undefined
      ? { immediateImpacts: keep(analysis.immediateImpacts) }
      : {}),
    ...(analysis.spilloverImplications !== undefined
      ? { spilloverImplications: keep(analysis.spilloverImplications) }
      : {}),
    ...(analysis.affectedParties !== undefined
      ? { affectedParties: keep(analysis.affectedParties) }
      : {}),
  } as T;
  return { analysis: withheld > 0 ? next : analysis, withheld };
}
