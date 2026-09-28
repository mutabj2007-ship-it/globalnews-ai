/**
 * ════════════════════════════════════════════════════════════════════════════
 * ADDENDUM R1 · PRODUCER — INHERITED-CONTEXT ELIGIBILITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DISCRIMINATOR IS A DETERMINER, AND THAT IS WHY NO GAZETTEER IS NEEDED.
 *
 *   "Who is Kagame?"        bare subject          -> EXPLICIT_NAMED_SUBJECT
 *   "Who is the president?" definite description   -> DEFINITE_DESCRIPTION
 *
 * English marks the difference grammatically: a role takes an article, a name
 * does not. That single fact separates the two cases the addendum requires to
 * behave differently, without any list of people — and it is why the rule cannot
 * drift into a gazetteer as it is extended.
 *
 * The country vocabulary is consulted ONLY TO EXCLUDE. "Who is Rwanda?" is a
 * geographic subject and typed geography owns it; a name the vocabulary does not
 * claim is never turned into a country by anything here.
 *
 * REUSES the accepted `OFFICE_HEAD_NOUNS` from producer A for the role test, so
 * there is one office lexicon in this lane and not two.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FINAL ADDENDUM DELTA — four changes, no redesign
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   D-1  THREE FRAMES ADDED, INCLUDING `what is X` RE-ADMITTED.
 *        The first addendum removed `what is` because it over-fired on
 *        "What is happening in Kenya?". It is safe now because suppression is
 *        gated on the LANDED intent reading, and that question measures
 *        CURRENT_EVENT — the classifier's own CURRENT_EVENT_MARKERS already
 *        refuse to read it as a stable explanation. The guard moved from the
 *        frame list to the place that actually knows.
 *
 *   D-2  DETERMINERS SPLIT INTO DEFINITE AND INDEFINITE, and this is the whole
 *        of the new discriminator:
 *          "What is THE inflation rate?"  definite   -> presupposes a referent
 *                                                       -> inherited context MAY help
 *          "What is A recession?"          indefinite -> names a KIND
 *                                                       -> stable, suppress
 *        Grammar, not a lexicon. An indefinite article is stripped and the
 *        remainder classified; a definite one ends the matter.
 *
 *   D-3  THE LANDED INTENT READING IS CONSUMED, NOT RECOMPUTED. Suppression
 *        now requires a STABLE intent. No classifier is created, none is
 *        imported into the decision, and the value is passed in — so the
 *        producer stays pure and the seam is explicit.
 *
 *   D-4  `intentClass` is recorded on the reading as provenance, so a decision
 *        states which intent qualified it rather than leaving a reviewer to
 *        re-derive it.
 *
 * Everything else — the determiner test, the country-exclusion guard, the
 * function-word guard, rank 2's protection, `blocksExecution: false` — is
 * unchanged from the accepted addendum.
 */

import { resolveCountryByAnyIdentifier, resolveCountryByCity } from '@globalnews-ai/shared';
import { OFFICE_HEAD_NOUNS } from './office-geography.producer';
import type {
  InheritedContextEligibility, SubjectReading, SubjectShape,
} from './addendum.contract';

/**
 * Reference/identity frames, closed and EN.
 *
 * Deliberately narrow: these are the frames whose subject slot is the whole
 * point of the question. "What happened in X" is not here — it is an event
 * question and its geography is ordinary.
 *
 * EXPORTED so the multilingual lane adds PL forms in place; MA §12 forbids
 * forking Ask AI for language work.
 */
export const REFERENCE_FRAMES: readonly RegExp[] = [
  /^who\s+(?:is|was|are|were)\s+(.+)$/i,
  /^what\s+(?:is|was|are|were)\s+(.+)$/i,
  /^tell\s+me\s+about\s+(.+)$/i,
  /^what\s+do\s+you\s+know\s+about\s+(.+)$/i,
  /^describe\s+(.+)$/i,
  /^explain\s+(.+)$/i,
  /^how\s+(?:does|do)\s+(.+?)\s+work$/i,
];

/**
 * `what is X` IS A FRAME AGAIN — D-1. The first addendum excluded it because
 * "What is happening in Kenya?" captured "happening in Kenya" and suppressed the
 * reader's selection. Excluding the frame fixed that case and cost the whole
 * stable-explanation class, which is the under-coverage the final addendum closes.
 *
 * The correct gate was never the frame. It is the intent: that question measures
 * CURRENT_EVENT and a CURRENT_EVENT never suppresses. The regression for it is
 * retained and now passes for the RIGHT reason — asserted both ways in the spec.
 */

/**
 * DEFINITE determiners presuppose a REFERENT — "the inflation rate", "the
 * president", "this minister". Which one? Whose? The question is underspecified
 * and inherited context is exactly what can specify it, so these stay eligible.
 */
const DEFINITE_DETERMINERS: readonly string[] = ['the', 'this', 'that', 'these', 'those', 'my', 'our', 'their'];

/**
 * INDEFINITE determiners name a KIND — "a recession", "an induction motor".
 * There is no referent to resolve and no country can specialise the answer, so
 * the article is stripped and the remainder treated as a stable bare subject.
 */
const INDEFINITE_DETERMINERS: readonly string[] = ['a', 'an'];

/**
 * Function words that cannot appear INSIDE a name. A name does not contain a
 * preposition, a conjunction or an article. Grammatical, not a list of people.
 */
const NON_NAME_INTERNAL: readonly string[] = [
  'in', 'on', 'at', 'of', 'for', 'from', 'to', 'and', 'or', 'with', 'by', 'about',
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'happening', 'going',
];

/** Letters, hyphen, apostrophe. A token with a digit or symbol is not a name. */
const NAME_TOKEN = /^[\p{L}][\p{L}'-]*$/u;

/** A name is short. Three tokens covers "jean paul kagame"; more is a sentence. */
const MAX_NAME_TOKENS = 3;

function stripTrailing(text: string): string {
  return text.replace(/[?!.,;:\s]+$/u, '').trim();
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/** Does the raw (case-preserving) query capitalise this subject? Evidence only. */
function isCapitalized(subject: string, rawQuery: string): boolean {
  const first = subject.split(' ')[0];
  if (first === undefined || first.length === 0) return false;
  const re = new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'u');
  const m = re.exec(rawQuery);
  if (m === null) return false;
  const ch = m[0].charAt(0);
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

/**
 * Read the subject of a reference/identity question.
 *
 * TOTAL AND NEVER THROWING. Returns `NOT_A_REFERENCE_QUESTION` for everything
 * that is not one of the closed frames, which is the overwhelming majority of
 * questions and the safe default.
 */
export function readSubject(rawQuery: string): SubjectReading {
  const cleaned = stripTrailing(normalizeSpaces(rawQuery ?? ''));
  if (cleaned.length === 0) {
    return { shape: 'NOT_A_REFERENCE_QUESTION', capitalizedInRawQuery: false };
  }

  let captured: string | null = null;
  for (const frame of REFERENCE_FRAMES) {
    const m = frame.exec(cleaned);
    if (m !== null && m[1] !== undefined) { captured = stripTrailing(m[1]); break; }
  }
  if (captured === null || captured.length === 0) {
    return { shape: 'NOT_A_REFERENCE_QUESTION', capitalizedInRawQuery: false };
  }

  const subject = captured;
  const capitalizedInRawQuery = isCapitalized(subject, rawQuery ?? '');
  const lower = subject.toLowerCase();
  const tokens = lower.split(' ').filter((t) => t.length > 0);
  const shape = classify(lower, tokens);
  return { shape, subject, capitalizedInRawQuery };
}

function classify(lower: string, tokens: readonly string[]): SubjectShape {
  const first = tokens[0];
  if (first === undefined) return 'NOT_A_REFERENCE_QUESTION';

  /* A DEFINITE determiner makes it a description needing a referent. */
  if (DEFINITE_DETERMINERS.includes(first)) return 'DEFINITE_DESCRIPTION';

  /* An INDEFINITE determiner names a kind: strip it and judge the remainder. */
  if (INDEFINITE_DETERMINERS.includes(first)) {
    const rest = tokens.slice(1);
    if (rest.length === 0) return 'NOT_A_REFERENCE_QUESTION';
    return classify(rest.join(' '), rest);
  }

  /* The country vocabulary is consulted ONLY to exclude. */
  if (resolveCountryByAnyIdentifier(lower) !== undefined) return 'GEOGRAPHIC_SUBJECT';
  if (resolveCountryByCity(lower) !== undefined) return 'GEOGRAPHIC_SUBJECT';

  /* A bare office noun alone is still a role: "who is president" is
     "who is THE president" with the article dropped, not a name. */
  if (OFFICE_HEAD_NOUNS.includes(lower)) return 'DEFINITE_DESCRIPTION';

  if (tokens.length > MAX_NAME_TOKENS) return 'NOT_A_REFERENCE_QUESTION';
  if (!tokens.every((t) => NAME_TOKEN.test(t))) return 'NOT_A_REFERENCE_QUESTION';

  /* A name contains no function word. This is what stops "happening in kenya"
     being read as a name, and it is grammar rather than a gazetteer. */
  if (tokens.some((t) => NON_NAME_INTERNAL.includes(t))) return 'NOT_A_REFERENCE_QUESTION';

  /* A subject that CONTAINS a place is not a bare identity: the place is the
     scope and typed geography owns it. Vocabulary consulted only to exclude. */
  if (tokens.some((t) => resolveCountryByAnyIdentifier(t) !== undefined
                      || resolveCountryByCity(t) !== undefined)) {
    return 'GEOGRAPHIC_SUBJECT';
  }

  /* "president kagame" — an office noun followed by a name is still an explicitly
     named subject, because the name is present. */
  return 'EXPLICIT_NAMED_SUBJECT';
}

/**
 * D-3 · THE STABLE INTENT CLASSES, from the LANDED `QueryIntent` union.
 *
 * Measured on canonical at the CTO-declared commit:
 *
 *   What is inflation?                 EXPLANATION
 *   What is NATO?                      EXPLANATION
 *   What is a recession?               EXPLANATION
 *   Explain inflation.                 EXPLANATION
 *   How does an induction motor work?  EXPLANATION
 *   Who is Kagame?                     ENTITY_BACKGROUND
 *   Who is the president?              ENTITY_BACKGROUND
 *   What is happening?                 CURRENT_EVENT
 *   What is happening in Kenya?        CURRENT_EVENT
 *   What is the security situation?    CURRENT_EVENT
 *
 * `CURRENT_EVENT` is the classifier's default and its `CURRENT_EVENT_MARKERS`
 * already refuse to read a happening question as a stable explanation. So the
 * eligibility rule needs no marker list of its own — it reads the one that exists.
 *
 * `GEOGRAPHIC_REGIONAL` and every article-anchored form are deliberately ABSENT
 * from this set: a question the classifier already reads as regional or anchored
 * is never a stable definition.
 */
export const STABLE_INTENT_CLASSES: readonly string[] = ['EXPLANATION', 'ENTITY_BACKGROUND'];

export interface EligibilityInputs {
  /** True when ANY producer established a place the reader typed or requested. */
  readonly typedGeographyPresent: boolean;
  /** True when storyContext.articleId resolved to a real article (frozen rank 2). */
  readonly resolvedArticleAnchorPresent: boolean;
  /**
   * D-3 · the LANDED `classifyQueryIntent()` reading for this question, passed in.
   *
   * PASSED, NOT RECOMPUTED. The producer stays pure and the seam stays explicit,
   * and no seventh classifier comes into existence. `readLandedIntent` below is
   * the one-line adapter that supplies it.
   */
  readonly intentClass: string;
}

/**
 * Decide whether inherited context may become effective scope for this question.
 *
 * SUPPRESSES only when BOTH hold:
 *   1  the question is a reference/identity question with an explicitly named subject
 *   2  no typed or requested place was supplied
 *
 * The second condition is what keeps "What did Kagame say in Kenya yesterday?"
 * working: Kenya is typed, so nothing is suppressed and the frozen order decides.
 *
 * A RESOLVED ARTICLE ANCHOR IS NEVER SUPPRESSED. Pointing at a document is a
 * stronger act than a leftover country hint, and rank 2 sits above typed
 * geography in the frozen table. Suppressing it here would overturn a frozen
 * rank, which this addendum does not do.
 */
export function decideInheritedContextEligibility(
  rawQuery: string,
  inputs: EligibilityInputs,
): InheritedContextEligibility {
  const subject = readSubject(rawQuery);

  /**
   * THREE CONDITIONS, ALL REQUIRED.
   *
   *   1  the landed intent reads the question as STABLE
   *   2  the subject is an explicit bare subject — not a definite description,
   *      not a place
   *   3  the reader supplied no typed or requested place
   *
   * Condition 1 is what keeps every current-event question eligible, including
   * the one the first addendum got wrong. Condition 2 is what keeps
   * "What is the inflation rate?" eligible while "What is a recession?" is not.
   * Condition 3 is what keeps "What is inflation in Rwanda?" typed.
   */
  const suppress =
    STABLE_INTENT_CLASSES.includes(inputs.intentClass) &&
    subject.shape === 'EXPLICIT_NAMED_SUBJECT' &&
    !inputs.typedGeographyPresent;

  if (!suppress) {
    return {
      decision: 'ELIGIBLE', subject, suppresses: [], blocksExecution: false,
      intentClass: inputs.intentClass,
    };
  }

  /* Rank 2 survives; the two weaker inherited slots do not. */
  const suppresses = inputs.resolvedArticleAnchorPresent
    ? (['MAP_GEOGRAPHY_CONTEXT'] as const)
    : (['MAP_GEOGRAPHY_CONTEXT', 'STORY_COUNTRY_HINT'] as const);

  return {
    decision: 'SUPPRESSED',
    reason: 'EXPLICIT_NAMED_SUBJECT_NO_TYPED_GEOGRAPHY',
    subject,
    suppresses: [...suppresses],
    blocksExecution: false,
    intentClass: inputs.intentClass,
  };
}

/**
 * THE SEAM. One guard, immediately before rank 7 is consulted, and it is the
 * only line this addendum adds to the retrieval path.
 *
 *   const inherited = decideInheritedContextEligibility(rawQuery, {
 *     typedGeographyPresent: typedLocation !== undefined || declaredRegion !== undefined,
 *     resolvedArticleAnchorPresent: hasResolvedArticleAnchor,
 *   });
 *   const eligibleGeographyContext =
 *     inherited.suppresses.includes('MAP_GEOGRAPHY_CONTEXT') ? undefined : geographyContext;
 *
 * `geographyContextUsed` then stamps ABSENT rather than `true`, which is already
 * the accepted meaning of "never eligible" — so the chip needs no new state and
 * D's existing four-valued reading renders it correctly with no change.
 */
export function eligibleMapGeography<T>(
  geographyContext: T | undefined,
  eligibility: InheritedContextEligibility,
): T | undefined {
  return eligibility.suppresses.includes('MAP_GEOGRAPHY_CONTEXT') ? undefined : geographyContext;
}

/**
 * THE INTENT SEAM — one line, and the only place the landed classifier is named.
 *
 *   import { classifyQueryIntent } from '../query/query-intent.util';
 *   const intentClass = classifyQueryIntent(normalizedQuery, {
 *     hasResolvedArticleAnchor,
 *   }).intent;
 *
 * Kept out of the producer on purpose: the producer takes the reading as data, so
 * it is pure, testable without the engine, and provably not a classifier itself.
 * An integration that forgets this seam passes an empty string and NOTHING is
 * suppressed — the safe direction, and a test asserts it.
 */
export const INTENT_IS_READ_NEVER_DERIVED_HERE = true as const;
