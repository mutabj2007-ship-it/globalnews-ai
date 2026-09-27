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

/**
 * TOPIC CONTINUITY R1 — the SAME anaphor vocabulary, exposed as a predicate so
 * the conversation-subject authority does not grow a second list that drifts.
 * It says only that the question refers back; what it refers back to (an event
 * or a subject) is decided by the caller's own authority.
 */
export function hasAnaphoricReference(question: string, polish = true): boolean {
  return ANAPHOR.test(question) || (polish && ANAPHOR_PL.test(question));
}

const CAUSE_ASPECT =
  /\b(?:cause[ds]?|causing|why|reasons?|blamed?|behind)\b|przyczyn|dlaczego|czemu/iu;
const EFFECT_ASPECT =
  /\b(?:effects?|impacts?|influenc(?:e|es|ed)|consequences?|affect(?:s|ed|ing)?|implications?|involved|concern)\b|skutk|wpływ|konsekwencj/iu;
const CROSS_BORDER_ASPECT =
  /\b(?:neighbou?r(?:s|ing)?|cross[- ]border|regional|region|spill[- ]?over|surrounding countries|other countries|borders?)\b|sąsied|sąsiad|region/iu;

/**
 * R1.1 B3 — THE EVENT-LIKENESS GATE. The smallest deterministic test that a
 * topic names a discrete OCCURRENCE (a crash, an earthquake, an explosion)
 * rather than an ongoing subject (AI regulation, inflation, interest rates).
 * Only an event-like topic is anchored; every other question keeps its pre-R1
 * retrieval and prompt exactly. A closed stem list, matched per topic word with
 * light inflection — no semantic classifier and no AI call. No existing query
 * authority carries these semantics: the security and entity lexicons mix in
 * ongoing subjects (sanctions, war, summit, negotiation) and serve other lanes.
 */
const EVENT_NOUN_STEMS_EN = [
  'crash',
  'collision',
  'explosion',
  'blast',
  'bombing',
  'attack',
  'airstrike',
  'strike',
  'shooting',
  'stabbing',
  'earthquake',
  'quake',
  'flood',
  'wildfire',
  'fire',
  'landslide',
  'mudslide',
  'avalanche',
  'tsunami',
  'hurricane',
  'cyclone',
  'typhoon',
  'tornado',
  'storm',
  'eruption',
  'collapse',
  'derailment',
  'sinking',
  'shipwreck',
  'accident',
  'disaster',
  'spill',
  'stampede',
  'riot',
  'coup',
  'assassination',
  'killing',
  'massacre',
  'hijacking',
  'kidnapping',
  'outbreak',
  'incident',
  'raid',
  'invasion',
  'ambush',
  'blackout',
  'outage',
  'cyberattack',
];
/* PL stems: Polish inflects the ending, so these are matched as prefixes. */
const EVENT_NOUN_STEMS_PL = [
  'katastrof',
  'wypad',
  'zderzeni',
  'wybuch',
  'eksplozj',
  'zamach',
  'atak',
  'trzęsieni',
  'powodzi',
  'powódź',
  'pożar',
  'lawin',
  'osuwisk',
  'huragan',
  'erupcj',
  'zawaleni',
  'wykolejeni',
  'strzelanin',
  'zamieszk',
  'przewrót',
  'epidemi',
  'wyciek',
  'porwani',
];

/** R1.1 B3 — true when a topic word names a discrete event (EN + PL). */
export function isEventTopic(topic: string | undefined): boolean {
  if (topic === undefined) return false;
  return tokens(topic).some((raw) => {
    const word = raw.toLowerCase();
    return (
      EVENT_NOUN_STEMS_EN.some(
        (stem) =>
          word === stem ||
          (word.startsWith(stem) && /^(?:s|es|d|ed|ing)$/.test(word.slice(stem.length))),
      ) ||
      EVENT_NOUN_STEMS_PL.some((stem) => word.startsWith(stem) && word.length - stem.length <= 4)
    );
  });
}

/*
 * R1.1 B1 / B2 — RELATIONS ARE DIRECTIONAL AND LOCAL.
 *
 * Chronology ("after", "following", "in the wake of", PL "po") is NOT a
 * relation: "After the crash, officials discussed an Ebola outbreak" reports
 * sequence, not consequence. A consequence needs an explicit construction in
 * ONE local statement, in the right direction:
 *   event → effect      "the crash prompted / led to / forced / triggered …"
 *   effect ← event      "… in response to / as a result of / because of the crash"
 * A cause needs the same, pointing the other way, at the event itself:
 *   "the crash was caused by / blamed on / attributed to …",
 *   "investigators attributed the crash to …", "X caused the crash",
 *   "the cause of the crash was …".
 * Only modifiers may stand between the construction and the event noun;
 * a connector ("after", "and", "while" …) breaks the link, so
 * "closed because of fog after the crash" links fog, not the crash.
 */
const CONNECTOR_WORDS =
  'after|before|following|and|or|but|while|during|when|as|then|with|amid|despite|since|until|than|po|oraz|i|ale|podczas|gdy';
/** Up to four modifier words ("the", "the DR Congo plane") — never a connector. */
const MODIFIERS = `(?:(?!(?:${CONNECTOR_WORDS})(?!\\p{L}))[^\\s,.;:!?]+\\s+){0,4}`;
const FORWARD_EFFECT_VERBS =
  'led to|leads to|lead to|resulted in|results in|caused|causes|prompted|prompts|triggered|triggers|forced|forces|sparked|sparks|doprowadził\\p{L}*|spowodował\\p{L}*|wywołał\\p{L}*|zmusił\\p{L}*';
const BACKWARD_EFFECT_LINKS =
  'in response to|as a result of|because of|due to|prompted by|triggered by|caused by|sparked by|forced by|w odpowiedzi na|w wyniku|wskutek|z powodu|w następstwie';
const EVENT_AUX =
  '(?:\\s+(?:itself|also|has|have|had|was|were|is|has been|had been|may have been|might have been|could have been|appears to have been|appeared to have been|reportedly|likely|probably|apparently|possibly|allegedly|został\\p{L}*|była|było|był))*';
const CAUSE_PASSIVE_LINKS =
  'caused by|blamed on|attributed to|due to|because of|the result of|a result of|resulted from|triggered by|spowodowan\\p{L}*|wywołan\\p{L}*|z powodu|wskutek';

/** The event's head noun (last topic word), lightly inflected, as a regex source. */
function headSource(topic: string): string {
  const word = tokens(topic).pop() ?? topic;
  const stem = word.replace(/(?:es|s|ed|ing)$/i, '');
  return `(?<!\\p{L})${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}{0,4}(?!\\p{L})`;
}

/** Does this sentence explicitly report a consequence OF the event? */
function consequenceLinkPattern(topic: string): RegExp {
  const head = headSource(topic);
  return new RegExp(
    [
      `${head}${EVENT_AUX}\\s+(?:${FORWARD_EFFECT_VERBS})(?!\\p{L})(?!\\s+by(?!\\p{L}))`,
      `(?<!\\p{L})(?:${BACKWARD_EFFECT_LINKS})\\s+${MODIFIERS}${head}`,
    ].join('|'),
    'iu',
  );
}

/** Does this sentence explicitly report the cause OF the event? */
function eventCausePattern(topic: string): RegExp {
  const head = headSource(topic);
  return new RegExp(
    [
      `${head}${EVENT_AUX}\\s+(?:${CAUSE_PASSIVE_LINKS})(?!\\p{L})`,
      `(?<!\\p{L})(?:attributed|attributes|attributing|blamed|blames|blaming)\\s+${MODIFIERS}${head}\\s+(?:to|on)(?!\\p{L})`,
      `(?<!\\p{L})(?:caused|triggered)\\s+${MODIFIERS}${head}`,
      `(?<!\\p{L})(?:cause|causes|reason|reasons)\\s+(?:of|for|behind)\\s+${MODIFIERS}${head}\\s+(?:was|were|is|has been)\\s+(?!(?:not|unknown|unclear|still|under|being)(?!\\p{L}))`,
      `(?<!\\p{L})przyczyn\\p{L}*\\s+${MODIFIERS}${head}\\s+(?:był\\p{L}*|jest)\\s+(?!(?:nie|nieznan)\\p{L}*)`,
    ].join('|'),
    'iu',
  );
}

/** A statement that reports the cause as unknown, open or unstated. */
const CAUSE_UNKNOWN =
  /\b(?:under investigation|being investigated|not (?:yet )?(?:known|determined|clear|established|given|disclosed)|no cause|unknown cause|cause (?:is|was|remains) (?:unknown|unclear|not known)|(?:unclear|unknown|not (?:yet )?(?:said|say|clear)) what caused|investigators (?:have not|did not|are (?:still )?(?:trying|working)))/iu;

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
  /* R1.1 B1 — an explicit, directional link; chronology stays DIRECT_EVENT. */
  const link = consequenceLinkPattern(topic);
  const linksConsequence = sentences(`${article.title ?? ''}. ${article.summary ?? ''}`).some(
    (s) => link.test(s) && !CAUSE_UNKNOWN.test(s),
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
  const link = consequenceLinkPattern(topic);
  const eventCause = eventCausePattern(topic);
  const eventLinked = classified.filter((c) => c.relation !== 'CONTEXT_ONLY');
  const eventSentences = eventLinked.flatMap((c) =>
    sentences(`${c.article.title ?? ''}. ${c.article.summary ?? ''}`),
  );
  const disclosures: EventAnchorDisclosure[] = [];

  if (aspects.cause) {
    /* R1.1 B2 — the cause OF THE EVENT, in one local statement; a causal
       phrase about anything else in the article never counts. */
    const causeReported = eventSentences.some((s) => eventCause.test(s) && !CAUSE_UNKNOWN.test(s));
    if (!causeReported) disclosures.push('CAUSE_NOT_ESTABLISHED');
  }
  if (aspects.crossBorder) {
    /* R1.1 B1 — an explicit consequence link, never mere chronology. */
    const crossBorderReported = eventSentences.some(
      (s) => CROSS_BORDER_ASPECT.test(s) && link.test(s) && !CAUSE_UNKNOWN.test(s),
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
