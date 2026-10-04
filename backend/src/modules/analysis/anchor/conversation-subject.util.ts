import type { ConversationSubjectDisclosure } from '@globalnews-ai/shared';
import { normalizeQuery } from '@globalnews-ai/shared';
import { classifyQueryIntent } from '../query/query-intent.util';
import { retrievalSubjectOf } from '../query/response-directives.util';
import {
  deriveFallbackNewsQuery,
  deriveGenericNewsQuery,
  FALLBACK_STOPWORDS,
} from '../query/derive-generic-news-query.util';
import {
  deriveEventTopic,
  hasAnaphoricReference,
  isAnaphoricFollowUp,
  isEventTopic,
} from './event-anchor.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK CONVERSATIONAL TOPIC CONTINUITY R1 — THE ONE SUBJECT-CONTINUITY AUTHORITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT (Gate D-A, docs/ask-conversational-topic-continuity-r1.md).
 * "Explain the new EU AI regulation in plain English" → "how will this affect
 * GlobalNewsAI in general?" routed Turn 2 on its own words; they name nothing
 * that exists in reporting, so the follow-up answered zero and no analysis was
 * attempted. `priorQuestion` was transported but used only for EVENTS.
 *
 * WHAT THIS DECIDES, deterministically and without any AI:
 *   1. whether a follow-up refers back to a NON-event subject;
 *   2. what that subject is, taken only from the prior USER question.
 * The service then routes by the prior user question — the same substitution
 * Anchoring R1 makes for events — so every existing routing authority (country,
 * explanation subject, generic subject extraction) derives the subject exactly
 * as it did on the turn that introduced it. The model still receives the
 * reader's actual follow-up. No prior AI output is read here or anywhere else.
 *
 * WHAT IT NEVER DOES: override current text. A follow-up that names its own
 * subject ("What about inflation in Poland?") has no anaphor and is not an
 * audience ellipsis, so it is a fresh question; an event follow-up belongs to
 * the event anchor, which is evaluated first and is untouched.
 */

/** A follow-up is a short turn. Anything longer is treated as its own question. */
const MAX_FOLLOW_UP_WORDS = 16;

/* "this week", "that time", "w tym roku" point at a time, not back at a subject. */
const TEMPORAL_DEMONSTRATIVES =
  /\b(?:this|that)\s+(?:week|month|year|morning|afternoon|evening|weekend|time|quarter)\b|(?:^|\s)w\s+tym\s+(?:tygodniu|miesi[ąa]cu|roku|kwartale)(?=\s|[?!.,;:]|$)|(?:^|\s)ten\s+tydzie[ńn](?=\s|[?!.,;:]|$)/giu;

/* Expletive "it" introduces a new claim rather than referring back. */
const EXPLETIVE_IT =
  /\b(?:is|was)\s+it\s+true\s+that\b|\bit\s+(?:is|was)\s+(?:true|said|reported|possible|likely|clear)\s+that\b/i;

/**
 * An audience or aspect ellipsis: the reader keeps the subject and changes
 * only WHO it is about ("businesses") or WHICH ASPECT of it ("enforcement",
 * "timing"). A closed list — a new SUBJECT after "what about" ("inflation in
 * Poland") is a fresh question.
 */
const ELLIPSIS_TERMS_EN =
  '(?:small\\s+|smaller\\s+|ordinary\\s+|local\\s+)?(?:businesses|business|companies|firms|consumers|households|families|workers|employees|investors|farmers|exporters|importers|banks|borrowers|savers|retirees|pensioners|students|young\\s+people|users|citizens|enforcement|implementation|timing|timeline|deadlines?|penalties|fines|costs?|prices|jobs|employment|wages|compliance|exemptions|risks|benefits|next\\s+steps)';
const AUDIENCE_ELLIPSIS_EN = new RegExp(
  `^(?:and\\s+|but\\s+)?(?:what|how)\\s+about\\s+(?:for\\s+)?(?:the\\s+)?${ELLIPSIS_TERMS_EN}(?:\\s*(?:,|and|or)\\s*(?:the\\s+)?${ELLIPSIS_TERMS_EN})*\\s*\\??$`,
  'i',
);
const ELLIPSIS_TERMS_PL =
  '(?:ma[łl]ymi\\s+)?(?:firmami|firmy|firm|przedsi[ęe]biorstwami|przedsi[ęe]biorstwa|konsumentami|konsumenci|konsument[óo]w|gospodarstwami\\s+domowymi|rodzinami|rodziny|pracownikami|pracownicy|inwestorami|inwestorzy|rolnikami|rolnicy|eksporterami|bankami|banki|kredytobiorcami|emerytami|emeryci|studentami|u[żz]ytkownikami|obywatelami|egzekwowaniem|egzekwowanie|wdro[żz]eniem|wdro[żz]enie|terminami|terminy|karami|kary|kosztami|koszty|cenami|ceny|zatrudnieniem|zatrudnienie|p[łl]acami|p[łl]ace)';
const AUDIENCE_ELLIPSIS_PL = new RegExp(
  `^(?:a\\s+)?(?:co\\s+z|jak\\s+z|a\\s+dla|dla)?\\s*${ELLIPSIS_TERMS_PL}(?:\\s*(?:,|i|oraz|lub)\\s*${ELLIPSIS_TERMS_PL})*\\s*\\??$`,
  'iu',
);

/* The product itself: facts about it are not in any evidence channel. */
const PRODUCT_SELF_REFERENCE =
  /global\s*news\s*ai|\b(?:this|your)\s+(?:platform|site|website|app|service|product)\b|(?:^|\s)(?:t[aeą]j?|wasz[aeą]?j?)\s+(?:platform[aęiy]?|aplikacj[aęi]|serwis(?:u|ie)?)(?=\s|[?!.,;:]|$)/iu;

/*
 * The Polish anaphor "to" is also English "to" ("doing to the economy"), so
 * the Polish forms count only in a question that reads as Polish: Polish
 * letters, or a Polish function word.
 */
const POLISH_MARKERS =
  /[ąćęłńóśźż]|(?:^|\s)(?:czy|jak|co|dlaczego|czemu|si[ęe]|na|jest|s[ąa]|nie|dla|oraz|mnie|mi|czym)(?=\s|[?!.,;:]|$)/iu;
const looksPolish = (text: string): boolean => POLISH_MARKERS.test(text);

const stripTrailingPunctuation = (value: string): string =>
  value.trim().replace(/[?!.,;:]+$/g, '').trim();

const wordCount = (value: string): number => value.split(/\s+/).filter(Boolean).length;

function isAudienceEllipsis(question: string): boolean {
  const text = question.trim();
  return AUDIENCE_ELLIPSIS_EN.test(text) || AUDIENCE_ELLIPSIS_PL.test(text);
}

/**
 * True when `question` is a bounded follow-up that refers back to a subject
 * rather than naming one: an anaphor ("this", "it", "to", "tego"…) or an
 * audience ellipsis ("What about businesses?"), no event of its own, and no
 * explanation subject of its own.
 */
export function isSubjectFollowUp(question: string): boolean {
  const text = stripTrailingPunctuation(question);
  if (text.length === 0 || wordCount(text) > MAX_FOLLOW_UP_WORDS) return false;
  if (isEventTopic(deriveEventTopic(text))) return false;
  if (isAudienceEllipsis(question)) return true;

  const withoutTime = text.replace(TEMPORAL_DEMONSTRATIVES, ' ');
  if (!hasAnaphoricReference(withoutTime, looksPolish(text)) || EXPLETIVE_IT.test(text)) return false;

  /* "What is this regulation?" names nothing new; "Explain quantum" does. */
  const ownSubject = classifyQueryIntent(text).subject;
  return ownSubject === undefined || hasAnaphoricReference(ownSubject, looksPolish(ownSubject));
}

/**
 * The subject a follow-up continues, as a span of the PRIOR USER QUESTION, or
 * undefined when the prior question cannot supply one (it is itself a
 * referring follow-up, or it is an event — the event anchor's case).
 */
export function deriveConversationSubject(priorQuestion: string): string | undefined {
  /*
    ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — the prior question's answer-format instructions
    ("Give the dates and cite the sources") are not its subject, exactly as for the current turn
    (response-directives.util). Measured on Alpha operation 8237863d: the continued subject was
    "Kenya's economy? Give the dates and cite the sources".
  */
  const base = stripTrailingPunctuation(retrievalSubjectOf(priorQuestion));
  if (base.length === 0 || isSubjectFollowUp(base)) return undefined;
  if (isEventTopic(deriveEventTopic(base))) return undefined;

  const explanation = classifyQueryIntent(base).subject;
  if (explanation !== undefined) return explanation;

  const derived = deriveGenericNewsQuery(base);
  if (derived.length > 0 && derived !== base) return derived;
  /*
    D.1 — no subject frame matched ("Why is inflation high in Poland?"). The
    existing fallback reduction drops question/function words and keeps the
    user's content words in order ("inflation high Poland"): still a span of
    what they wrote, and a subject rather than a sentence.
  */
  if (looksPolish(base)) {
    /* The same reduction with the closed Polish list: "inflacja Polsce wysoka". */
    const kept = base
      .split(/\s+/)
      .filter((word) => word.length > 0 && !CONVERSATIONAL_FILLER_PL.has(word.toLowerCase()));
    return kept.length > 0 ? kept.join(' ') : base;
  }
  return deriveFallbackNewsQuery(base) ?? base;
}

/** Deterministic disclosures for a continued subject. Codes only. */
export function deriveConversationSubjectDisclosures(
  followUp: string,
): ConversationSubjectDisclosure[] {
  return PRODUCT_SELF_REFERENCE.test(followUp) ? ['PRODUCT_APPLICABILITY_NOT_ESTABLISHED'] : [];
}

/*
 * ── D.1 — THE CURRENT TURN'S EVIDENCE-BEARING MODIFIER ─────────────────────
 *
 * Retrieval meaning = INHERITED SUBJECT + CURRENT-TURN FOCUS, never the prior
 * question alone and never a blind concatenation. The focus is what is left of
 * the follow-up once everything that cannot bear on evidence is removed:
 * anaphors ("this", "to"), question and function words (the existing
 * FALLBACK_STOPWORDS authority plus the closed conversational list below),
 * conversational framing ("should I be scared", "in general"), the product's
 * own name (a question about GlobalNewsAI is disclosed, never searched), and
 * words the inherited subject already carries. What remains are targets and
 * aspects: "consumers", "businesses", "Poland", "prices", "enforcement".
 */

/* Conversational framing and affect: meaning for the reader, none for evidence. */
const CONVERSATIONAL_FILLER = new Set([
  'will', 'would', 'could', 'can', 'may', 'might', 'should', 'shall', 'must', 'does', 'do', 'did',
  'has', 'have', 'had', 'i', 'we', 'you', 'your', 'my', 'our', 'it', 'its', 'they', 'them', 'their',
  'there', 'then', 'also', 'else', 'so', 'very', 'really', 'actually', 'just', 'general', 'generally',
  'overall', 'scared', 'afraid', 'worried', 'worry', 'concerned', 'fear', 'anything', 'something',
  'everything', 'much', 'more', 'less', 'any', 'all', 'by', 'from', 'into', 'as', 'if', 'than',
  'think', 'mean', 'means', 'please', 'explain', 'describe', 'still', 'too', 'which', 'whom', 'whose',
  'matter', 'matters', 'mattering', 'affect', 'affects', 'affected', 'affecting', 'impact', 'impacts',
  'effect', 'effects', 'influence', 'influences', 'consequence', 'consequences', 'implications',
]);

/* Polish function words, anaphors and framing, same closed discipline. */
const CONVERSATIONAL_FILLER_PL = new Set([
  'a', 'i', 'oraz', 'czy', 'jak', 'co', 'dlaczego', 'czemu', 'na', 'w', 'we', 'z', 'ze', 'o', 'do',
  'dla', 'od', 'po', 'przez', 'się', 'sie', 'jest', 'są', 'sa', 'to', 'tego', 'tym', 'ten',
  'ta', 'te', 'tej', 'temu', 'tę', 'mnie', 'mi', 'ja', 'my', 'nas', 'wpłynie', 'wplynie',
  'wpływa', 'wplywa', 'wpływ', 'wplyw', 'wpływu', 'znaczenie', 'ma', 'mieć', 'może',
  'moze', 'będzie', 'bedzie', 'ogólnie', 'ogolnie', 'bać', 'bac', 'powinienem',
  'powinnam', 'naprawdę', 'skutki', 'skutek', 'konsekwencje',
]);

/* An aspect word keeps the meaning honest ("… impact") without joining the evidence match. */
const ASPECT_WORDS = /^(?:matter|matters|affect|affects|affected|affecting|impacts?|effects?|influences?|consequences?|implications?|wp[łl]yw\w*|wp[łl]yn\w*|skutk\w*|konsekwencj\w*|znaczeni\w*)$/iu;

const PRODUCT_TOKENS = /^(?:globalnewsai|platform\w*|app|aplikacj\w*|serwis\w*|site|website|service|product)$/iu;
const PRODUCT_SELF_REFERENCE_ALL = new RegExp(PRODUCT_SELF_REFERENCE.source, 'giu');

const tokenize = (text: string): string[] =>
  text
    .replace(PRODUCT_SELF_REFERENCE_ALL, ' ')
    .split(/[^\p{L}\p{N}'’-]+/u)
    .map((word) => word.replace(/^['’-]+|['’-]+$/g, ''))
    .filter((word) => word.length > 0);

/** A word's matching stem: plural endings off (EN), an inflection tail off (PL). */
function stemOf(word: string): string {
  const lower = word.toLowerCase();
  if (/[ąćęłńóśźż]/u.test(lower) || !/^[a-z0-9'-]+$/.test(lower)) {
    return lower.length > 5 ? lower.slice(0, lower.length - 3) : lower.slice(0, Math.max(4, lower.length - 1));
  }
  if (lower.endsWith('ies')) return lower.slice(0, -3);
  if (lower.endsWith('sses') || lower.endsWith('shes') || lower.endsWith('ches')) return lower.slice(0, -2);
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

export interface FollowUpFocus {
  /** Target words that must appear in a report for it to address the focus. */
  readonly terms: readonly string[];
  /** True when the follow-up asks about effect/impact/significance. */
  readonly asksImpact: boolean;
  /**
   * ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — DISPLAY ONLY. The same kept words, grouped as the
   * reader wrote them: adjacent words stay one phrase ("ordinary households"), so the label
   * never reads "ordinary and households". Retrieval, ordering and disclosures use `terms`.
   */
  readonly phrases: readonly string[];
}

export function deriveFollowUpFocus(followUp: string, inheritedSubject: string): FollowUpFocus {
  const subjectStems = new Set(tokenize(inheritedSubject).map(stemOf));
  const terms: string[] = [];
  const phrases: string[][] = [];
  let lastKept = -2;
  let asksImpact = false;

  const tokens = tokenize(followUp);
  for (let index = 0; index < tokens.length; index++) {
    const word = tokens[index];
    const lower = word.toLowerCase();
    if (ASPECT_WORDS.test(lower)) asksImpact = true;
    if (
      FALLBACK_STOPWORDS.has(lower) ||
      CONVERSATIONAL_FILLER.has(lower) ||
      CONVERSATIONAL_FILLER_PL.has(lower) ||
      PRODUCT_TOKENS.test(lower) ||
      subjectStems.has(stemOf(word)) ||
      /^\p{N}+$/u.test(word) ||
      word.length < 3
    ) {
      continue;
    }
    if (!terms.some((term) => stemOf(term) === stemOf(word))) terms.push(word);
    if (index === lastKept + 1 && phrases.length > 0) phrases[phrases.length - 1].push(word);
    else phrases.push([word]);
    lastKept = index;
  }

  return { terms, asksImpact, phrases: phrases.map((phrase) => phrase.join(' ')) };
}

/** The stated retrieval meaning: inherited subject + focus (+ "impact" when asked). */
export function composeRetrievalMeaning(subject: string, focus: FollowUpFocus): string {
  return [subject, ...focus.terms, ...(focus.asksImpact && focus.terms.length > 0 ? ['impact'] : [])].join(' ');
}

/** True when a report's own title or summary addresses at least one focus term. */
export function addressesFocus(
  article: { readonly title?: string; readonly summary?: string },
  terms: readonly string[],
): boolean {
  if (terms.length === 0) return false;
  const words = tokenize(`${article.title ?? ''} ${article.summary ?? ''}`).map((word) => word.toLowerCase());
  return terms.some((term) => {
    const stem = stemOf(term);
    return words.some((word) => word.startsWith(stem));
  });
}

/**
 * Evidence reaches the model in this order: reports that address the focus
 * first, the rest after, each group in its original order. Nothing is
 * added or dropped here — the existing cap decides what is sent — so the
 * focus changes WHICH subject evidence survives, never whether it is about
 * the subject.
 */
export function orderByFocus<T extends { readonly title?: string; readonly summary?: string }>(
  articles: readonly T[],
  terms: readonly string[],
): T[] {
  if (terms.length === 0) return [...articles];
  return [
    ...articles.filter((article) => addressesFocus(article, terms)),
    ...articles.filter((article) => !addressesFocus(article, terms)),
  ];
}

/**
 * CTO R4 — SUBJECTLESS FOLLOW-UP GUARD (shared authority, no phrase list). The analysis path
 * continues a follow-up that refers back instead of naming a subject ONLY through these two
 * authorities (analysis.service.ts — the event anchor and topic continuity): an anaphoric follow-up
 * to a prior EVENT question, or a subject follow-up whose prior USER question yields a conversation
 * subject. When the follow-up refers back and NEITHER holds, nothing would be carried and the
 * literal words would be searched.
 *   refersBack     the turn refers back instead of naming a subject of its own
 *   namesNothing   it names nothing at all (an anaphor and no content word or place)
 *   carried        a valid reader subject exists to continue: the prior USER question names a
 *                  subject of its own (it is not itself a referring follow-up), or one of the two
 *                  continuation authorities above derives one from it
 */
export function readSubjectlessFollowUp(
  question: string,
  priorQuestion: string | undefined,
): { readonly refersBack: boolean; readonly namesNothing: boolean; readonly carried: boolean } {
  const q = normalizeQuery(question).normalizedQuery;
  const namesNothing = isAnaphoricFollowUp(q);
  const refersBack = namesNothing || isSubjectFollowUp(q);
  if (!refersBack) return { refersBack, namesNothing, carried: false };
  const prior =
    priorQuestion === undefined || priorQuestion.trim().length === 0
      ? undefined
      : normalizeQuery(priorQuestion).normalizedQuery;
  const carried =
    prior !== undefined &&
    (!(isAnaphoricFollowUp(prior) || isSubjectFollowUp(prior)) ||
      (isAnaphoricFollowUp(q) && isEventTopic(deriveEventTopic(prior))) ||
      (isSubjectFollowUp(q) && deriveConversationSubject(prior) !== undefined));
  return { refersBack, namesNothing, carried };
}
