import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK TRUTHFUL RETRIEVAL R2A — THE NEGATIVE-ASSERTION GUARD (hard requirement)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PRODUCT RULING: ABSENCE OF RETRIEVED EVIDENCE IS NOT EVIDENCE OF ABSENCE.
 *
 * Production (BETA-ASK-006) answered "There is no evidence of an incident involving a passenger
 * plane travelling from Dubai to Israel today" from seven unrelated Gaza / Lebanon reports while
 * the incident had relevant reporting. A negative factual conclusion requires explicit relevant
 * counter-evidence; "my search found nothing" — no articles, an irrelevant corpus, a timeout, a
 * rate limit, an unconfigured lane, missing language coverage — never authorises one.
 *
 * Deterministic and server-side, applied to the generated prose before display:
 *
 *   findNegativeAssertions(text)  sentences that deny an event, its occurrence or its harm
 *                                 ("there is no evidence of …", "did not occur", "no
 *                                 casualties", "nothing happened"). Coverage-scoped hedges
 *                                 ("the available reports do not mention …", "could not be
 *                                 verified", "has not been confirmed") are NOT denials.
 *   canAssertNegative(...)        true ONLY when an admitted report itself carries an explicit
 *                                 counter-statement (denied / false report / hoax; no injuries
 *                                 / unharmed / landed safely for a harm denial). Absence of
 *                                 matches, provider failure or an unavailable lane → false.
 */

const NEGATIVE_ASSERTION: readonly RegExp[] = [
  /\b(?:there\s+(?:is|was|are|were)\s+)?no\s+(?:evidence|reports?|indication|record|sign|information|confirmation|trace)\s+(?:of|that|about|regarding|suggesting)\b/i,
  /\bthere\s+(?:is|was|are|were|has\s+been|have\s+been)\s+no\s+(?:such\s+)?(?:incident|event|crash|accident|attack|emergency|casualt\w*|injur\w*|deaths?|fatalit\w*|victims?)\b/i,
  /\b(?:did\s+not|didn't|has\s+not|hasn't|have\s+not|haven't|never)\s+(?:occur(?:red)?|happen(?:ed)?|take\s+place|taken\s+place|exist(?:ed)?)\b/i,
  /\bno\s+(?:such\s+)?(?:incident|crash|accident|attack|emergency)\s+(?:occurred|happened|took\s+place|was\s+reported|has\s+been\s+reported)\b/i,
  /\b(?:nothing|none)\s+(?:happened|occurred|took\s+place)\b/i,
  /\bno\s+(?:one\s+was\s+(?:killed|injured|hurt)|casualt\w*|injur\w*|deaths?|fatalit\w*)\s+(?:were|was|have\s+been|has\s+been)?\s*(?:reported|recorded|caused|occurred)?\b/i,
  /\b(?:the\s+)?(?:claim|report|reports|incident)\s+(?:is|are|was|were)\s+(?:false|untrue|fabricated|unfounded|baseless)\b/i,
];

/** Coverage-scoped wording that states what the SOURCES contain — honest, never a denial. */
const COVERAGE_HEDGE =
  /\b(?:(?:available|retrieved|provided|supplied|checked)\s+(?:reports?|sources?|evidence|articles?|reporting)\s+(?:do|does|did)\s+not\s+(?:mention|address|describe|cover|report|include|state)|(?:could|can)\s+not\s+(?:be\s+)?(?:verif\w*|confirm\w*|establish\w*)|(?:has|have)\s+not\s+(?:yet\s+)?been\s+(?:confirmed|verified|established)|not\s+(?:yet\s+)?(?:confirmed|verified|established)|(?:is|are|was|were)\s+not\s+(?:mentioned|addressed|reported)\s+in\s+the\s+(?:available|retrieved|provided)|unclear|unknown|not\s+stated)\b/i;

/** What an admitted report must SAY for a denial of the event itself to be authorised. */
export const EVENT_COUNTER_EVIDENCE =
  /\b(?:denied|denies|deny|false\s+(?:report|claim|alarm)|did\s+not\s+(?:happen|occur|take\s+place)|hoax|fabricat\w*|debunk\w*|fake\s+(?:news|report|video)|no\s+(?:such\s+)?(?:incident|crash|attack|emergency)\s+(?:occurred|happened|took\s+place))\b/i;

/** What an admitted report must SAY for a denial of harm (casualties) to be authorised. */
export const HARM_COUNTER_EVIDENCE =
  /\b(?:no\s+(?:one\s+(?:was\s+)?(?:killed|injured|hurt|harmed)|injur\w*|casualt\w*|deaths?|fatalit\w*|serious\s+injur\w*)|unharmed|unhurt|without\s+injur\w*|escaped\s+(?:injury|unhurt|unharmed)|landed\s+safely|(?:all|every)\s+(?:of\s+the\s+)?(?:\d+\s+)?(?:passengers|people|crew)(?:\s+and\s+crew)?\s+(?:were\s+|are\s+)?(?:safe|unharmed|evacuated\s+safely))\b/i;

export const HARM_WORDS =
  /\b(?:casualt\w*|injur\w*|deaths?|dead|killed|hurt|fatalit\w*|victims?)\b/i;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function findNegativeAssertions(text: string): string[] {
  return sentences(text).filter(
    (s) => !COVERAGE_HEDGE.test(s) && NEGATIVE_ASSERTION.some((pattern) => pattern.test(s)),
  );
}

export interface NegativeAssertionCoverage {
  /** A lane failed, was rate-limited, timed out or is not configured. */
  readonly incomplete: boolean;
}

/**
 * May this negative sentence be stated? Only with explicit counter-evidence in an ADMITTED
 * report. Coverage is accepted for the record but can never authorise a denial on its own:
 * complete coverage that found nothing is still absence of evidence.
 */
export function canAssertNegative(
  sentence: string,
  evidence: readonly Pick<NewsArticle, 'title' | 'summary'>[],
  coverage: NegativeAssertionCoverage,
): boolean {
  /* Recorded, never decisive: complete coverage that found nothing is still absence. */
  void coverage;
  const counter = HARM_WORDS.test(sentence) ? HARM_COUNTER_EVIDENCE : EVENT_COUNTER_EVIDENCE;
  return evidence.some((article) =>
    counter.test(`${article.title ?? ''} ${article.summary ?? ''}`),
  );
}

/** Every unauthorised negative sentence in a text. */
export function unauthorisedNegatives(
  text: string,
  evidence: readonly Pick<NewsArticle, 'title' | 'summary'>[],
  coverage: NegativeAssertionCoverage,
): string[] {
  return findNegativeAssertions(text).filter((s) => !canAssertNegative(s, evidence, coverage));
}

/** List fields of the analysis whose items carry generated prose, and that prose's key. */
const LIST_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['keyFacts', 'claim'],
  ['context', 'claim'],
  ['relevance', 'claim'],
  ['immediateImpacts', 'claim'],
  ['spilloverImplications', 'claim'],
  ['watchNext', 'claim'],
  ['agreements', 'point'],
  ['timeline', 'event'],
];

/**
 * The analysis with every list item that makes an unauthorised negative assertion removed.
 * Removal only — no item is rewritten — and the count says how many went.
 */
export function withoutUnauthorisedNegatives<T extends object>(
  analysis: T,
  evidence: readonly Pick<NewsArticle, 'title' | 'summary'>[],
  coverage: NegativeAssertionCoverage,
): { analysis: T; removed: number } {
  let removed = 0;
  const out: Record<string, unknown> = { ...(analysis as Record<string, unknown>) };
  for (const [field, key] of LIST_FIELDS) {
    const items = out[field];
    if (!Array.isArray(items)) continue;
    const kept = items.filter((item: unknown) => {
      const text = (item as Record<string, unknown> | null)?.[key];
      const bad =
        typeof text === 'string' && unauthorisedNegatives(text, evidence, coverage).length > 0;
      if (bad) removed += 1;
      return !bad;
    });
    out[field] = kept;
  }
  return { analysis: (removed === 0 ? analysis : out) as T, removed };
}
