import type { ConversationSubjectDisclosure } from '@globalnews-ai/shared';
import { classifyQueryIntent } from '../query/query-intent.util';
import { deriveGenericNewsQuery } from '../query/derive-generic-news-query.util';
import { deriveEventTopic, hasAnaphoricReference, isEventTopic } from './event-anchor.util';

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
 * An audience ellipsis: the reader keeps the subject and changes only WHO it is
 * about. A closed list — a new SUBJECT after "what about" is a fresh question.
 */
const AUDIENCE_ELLIPSIS_EN =
  /^(?:and\s+|but\s+)?(?:what|how)\s+about\s+(?:for\s+)?(?:the\s+)?(?:small\s+|smaller\s+|ordinary\s+|local\s+)?(?:businesses|business|companies|firms|consumers|households|families|workers|employees|investors|farmers|exporters|importers|banks|borrowers|savers|retirees|pensioners|students|young\s+people|users|citizens)\s*\??$/i;
const AUDIENCE_ELLIPSIS_PL =
  /^(?:a\s+)?(?:co\s+z|jak\s+z|a\s+dla|dla)?\s*(?:ma[łl]ymi\s+)?(?:firmami|firmy|firm|przedsi[ęe]biorstwami|przedsi[ęe]biorstwa|konsumentami|konsumenci|konsument[óo]w|gospodarstwami\s+domowymi|rodzinami|rodziny|pracownikami|pracownicy|inwestorami|inwestorzy|rolnikami|rolnicy|eksporterami|bankami|banki|kredytobiorcami|emerytami|emeryci|studentami|u[żz]ytkownikami|obywatelami)\s*\??$/iu;

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
  const base = stripTrailingPunctuation(priorQuestion);
  if (base.length === 0 || isSubjectFollowUp(base)) return undefined;
  if (isEventTopic(deriveEventTopic(base))) return undefined;

  const explanation = classifyQueryIntent(base).subject;
  if (explanation !== undefined) return explanation;

  const derived = deriveGenericNewsQuery(base);
  return derived.length > 0 && derived !== base ? derived : base;
}

/** Deterministic disclosures for a continued subject. Codes only. */
export function deriveConversationSubjectDisclosures(
  followUp: string,
): ConversationSubjectDisclosure[] {
  return PRODUCT_SELF_REFERENCE.test(followUp) ? ['PRODUCT_APPLICABILITY_NOT_ESTABLISHED'] : [];
}
