/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — QQ-10 · THE SEMANTIC SUBJECT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Contract §3: "G's English discriminator uses English grammar (definite/indefinite
 * article). Polish has no articles. Do not expose G to raw English-only article
 * semantics. Use L's qualified-reading boundary to produce a language-independent
 * semantic subject/context reading that G consumes."
 *
 * So there are two halves, kept apart:
 *
 *   1  `readSemanticSubject(text, language)` — the READING. It answers one question:
 *      what is this question's subject, as a MEANING — a stable concept or name
 *      (EXPLICIT_NAMED_SUBJECT), a role or value that presupposes a referent
 *      (DEFINITE_DESCRIPTION), a place (GEOGRAPHIC_SUBJECT), or no subject frame at all?
 *        EN  G's own `readSubject`, byte-for-byte — the accepted English grammar;
 *        PL  the Polish question FRAME carries what English puts in the article
 *            (`pl-readings.resources.ts` §6), with G's exclusions mirrored.
 *      Its output type is G's `SubjectReading`: the reading is in G's vocabulary, so G's
 *      rule reads it without knowing which language produced it.
 *
 *   2  `decideContextEligibility(reading, inputs)` — G's RULE, applied to the reading.
 *      The same three conditions, the same `STABLE_INTENT_CLASSES`, the same result
 *      shape as G's `decideInheritedContextEligibility`; the only difference is that the
 *      subject comes from the reading instead of from English text. A parity spec proves
 *      it returns G's exact result for every English row G's corpus carries.
 *
 * Neither half produces an intent, a class or a route. The intent condition is the
 * LANDED classifier's reading, passed in (G D-3).
 */

import { resolveCountryByAnyIdentifier, resolveCountryByCity } from '@globalnews-ai/shared';
import { resolvePolishCountry } from '../../analysis/query/polish-country-forms.util';
import {
  readSubject,
  STABLE_INTENT_CLASSES,
  type EligibilityInputs,
} from '../../analysis/context-producers/inherited-context-eligibility';
import type {
  InheritedContextEligibility,
  SubjectReading,
  SubjectShape,
} from '../../analysis/context-producers/addendum.contract';
import {
  PL_DEFINITE_DETERMINERS,
  PL_NON_NAME_INTERNAL,
  PL_OFFICE_HEAD_NOUNS,
  PL_SUBJECT_FRAMES,
  type PlSubjectFrameKind,
} from './pl-readings.resources';

/** G's name limits, mirrored: letters/hyphen/apostrophe; at most three tokens. */
const NAME_TOKEN = /^[\p{L}][\p{L}'-]*$/u;
const MAX_NAME_TOKENS = 3;

const PL_OFFICE_FORMS: ReadonlySet<string> = new Set(Object.values(PL_OFFICE_HEAD_NOUNS).flat());

function stripTrailing(text: string): string {
  return text.replace(/[?!.,;:\s]+$/u, '').trim();
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function isPlace(phrase: string): boolean {
  return (
    resolveCountryByAnyIdentifier(phrase) !== undefined ||
    resolveCountryByCity(phrase) !== undefined ||
    resolvePolishCountry(phrase) !== undefined
  );
}

/** The longest office form the subject starts with, in tokens, or 0. */
function leadingOfficeLength(tokens: readonly string[]): number {
  for (let len = Math.min(3, tokens.length); len >= 1; len -= 1) {
    if (PL_OFFICE_FORMS.has(tokens.slice(0, len).join(' '))) return len;
  }
  return 0;
}

function classifyPolish(
  kind: PlSubjectFrameKind,
  lower: string,
  tokens: readonly string[],
): SubjectShape {
  const first = tokens[0];
  if (first === undefined) return 'NOT_A_REFERENCE_QUESTION';

  /* G: a DEFINITE determiner makes it a description needing a referent. Polish HAS
     demonstratives and possessives; it has no article, and none is simulated. */
  if (PL_DEFINITE_DETERMINERS.includes(first)) return 'DEFINITE_DESCRIPTION';

  /* The VALUE frame asks for the value of X — "Jaka jest stopa inflacji?" — which
     presupposes a referent exactly as EN's definite article does. */
  if (kind === 'VALUE') return 'DEFINITE_DESCRIPTION';

  /* G: the country vocabulary is consulted ONLY TO EXCLUDE. */
  if (isPlace(lower)) return 'GEOGRAPHIC_SUBJECT';

  /* G: a bare office noun is a role. And an office of a named country
     ("prezydentem Rwandy") is THE office of that country — a definite role, which is
     how English writes it ("the president of Rwanda"). */
  const office = leadingOfficeLength(tokens);
  if (office === tokens.length) return 'DEFINITE_DESCRIPTION';
  if (office > 0 && isPlace(tokens.slice(office).join(' '))) return 'DEFINITE_DESCRIPTION';

  if (tokens.length > MAX_NAME_TOKENS) return 'NOT_A_REFERENCE_QUESTION';
  if (!tokens.every((t) => NAME_TOKEN.test(t))) return 'NOT_A_REFERENCE_QUESTION';
  if (tokens.some((t) => PL_NON_NAME_INTERNAL.includes(t))) return 'NOT_A_REFERENCE_QUESTION';
  if (tokens.some((t) => isPlace(t))) return 'GEOGRAPHIC_SUBJECT';

  /* "prezydent Kagame" — an office noun followed by a name is still a named subject. */
  return 'EXPLICIT_NAMED_SUBJECT';
}

function isCapitalized(subject: string, rawQuery: string): boolean {
  const first = subject.split(' ')[0];
  if (first === undefined || first.length === 0) return false;
  const i = rawQuery.toLowerCase().indexOf(first.toLowerCase());
  if (i < 0) return false;
  const ch = rawQuery.charAt(i);
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

function readPolishSubject(rawQuery: string): SubjectReading {
  const cleaned = stripTrailing(normalizeSpaces(rawQuery ?? ''));
  if (cleaned.length === 0)
    return { shape: 'NOT_A_REFERENCE_QUESTION', capitalizedInRawQuery: false };

  for (const frame of PL_SUBJECT_FRAMES) {
    const m = frame.pattern.exec(cleaned);
    const captured = m?.[1] === undefined ? '' : stripTrailing(m[1]);
    if (captured.length === 0) continue;
    const lower = captured.toLowerCase();
    const toks = lower.split(' ').filter((t) => t.length > 0);
    return {
      shape: classifyPolish(frame.kind, lower, toks),
      subject: captured,
      capitalizedInRawQuery: isCapitalized(captured, rawQuery),
    };
  }
  return { shape: 'NOT_A_REFERENCE_QUESTION', capitalizedInRawQuery: false };
}

/**
 * The question's subject, as a meaning. EN is G's accepted reader, unchanged; PL is the
 * frame-semantic mirror. Total and never throwing.
 */
export function readSemanticSubject(rawQuery: string, language: 'en' | 'pl'): SubjectReading {
  return language === 'pl' ? readPolishSubject(rawQuery) : readSubject(rawQuery);
}

/**
 * For a caller that holds no question-language axis (the landed /analysis path, where
 * `requestedLanguage` is the DISPLAY language): read with both languages' frames and keep
 * the one that found a subject frame. The two frame sets are disjoint by construction —
 * every EN frame opens with an English word, every PL frame with a Polish one — so at
 * most one can match; a spec asserts that over the QQ-10 corpus.
 */
export function readSubjectInEitherLanguage(rawQuery: string): SubjectReading {
  const en = readSubject(rawQuery);
  return en.shape === 'NOT_A_REFERENCE_QUESTION' ? readPolishSubject(rawQuery) : en;
}

/**
 * G's inherited-context eligibility rule, reading the subject from the qualified reading.
 *
 * THREE CONDITIONS, ALL REQUIRED — G's, verbatim in meaning:
 *   1  the landed intent reads the question as STABLE (`STABLE_INTENT_CLASSES`, G's own);
 *   2  the subject is an explicit bare subject — not a description, not a place;
 *   3  the reader supplied no typed or requested place.
 * A resolved article anchor is never suppressed (G: rank 2 survives).
 */
export function decideContextEligibility(
  subject: SubjectReading,
  inputs: EligibilityInputs,
): InheritedContextEligibility {
  const suppress =
    STABLE_INTENT_CLASSES.includes(inputs.intentClass) &&
    subject.shape === 'EXPLICIT_NAMED_SUBJECT' &&
    !inputs.typedGeographyPresent;

  if (!suppress) {
    return {
      decision: 'ELIGIBLE',
      subject,
      suppresses: [],
      blocksExecution: false,
      intentClass: inputs.intentClass,
    };
  }

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
