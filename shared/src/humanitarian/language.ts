/* ────────────────────────────────────────────────────────────────────────────
   PROPOSED  shared/src/humanitarian/language.ts
   HUMANITARIAN LANGUAGE FINALIZATION R2 · branch feature/humanitarian-language-qualification-r1
   base 58f80fd4108d3472e5433c7a50e19295788f2544

   ── R2 · THE IMPORT CORRECTION ─────────────────────────────────────────────
   R1 wrote `import type { LanguageCode } from '@globalnews-ai/shared'`. That is a
   SELF-PACKAGE IMPORT: this file lives inside `shared`, and reaching its own
   package by name makes a module depend on its own barrel. Two things go wrong —
   a cycle through `shared/src/index.ts`, and a dependency on the package's
   PUBLIC surface for a type it can address directly.

   Measured at the base: `LanguageCode` is declared at
   `shared/src/analysis.ts:30` and nowhere else, and the established idiom inside
   `shared/src` is the relative path to that module:

     shared/src/comparison-coverage.ts:1   import type { LanguageCode } from './analysis';
     shared/src/countryDisplayName.ts:1    import type { LanguageCode } from './analysis';

   and from a subdirectory, the same idiom one level up — the form
   `shared/src/humanitarian/retained-read.ts:1` already uses:

     import { ... } from '../observation/absence';

   So this file binds to the canonical internal owner: `../analysis`.
   ──────────────────────────────────────────────────────────────────────────── */

import type { LanguageCode } from '../analysis';

/* ── 1 · THE TWO AXES — KEPT DISTINCT ───────────────────────────────────────
   Unchanged from R1 and restated because R2 names it: `sourceLanguage` and
   `displayLanguage` are different types because they are different sizes.
   Canonical already says so, in the two places this contract is built on:

   `shared/src/news.ts` on `NewsArticle.sourceLanguage` — "Deliberately a plain
   string, NOT LanguageCode … Undefined when the provider didn't report a language
   for this article — never fabricated or inferred."

   `shared/src/analysis.ts:11` on `LanguageCode` — "Represents requested/resolved
   UI and analysis response language ONLY — never an arbitrary evidence/source
   language."                                                                   */

/** The publisher's own tag, verbatim from source metadata. Trimmed, lowercased, nothing else. */
export type SourceLanguageTag = string;

/** The language the reader is served. The product's own closed set. */
export type DisplayLanguage = LanguageCode;

/* ── 2 · TRANSLATION STATE ─────────────────────────────────────────────────── */

export type TranslationState =
  /** The text shown IS the source's own text, in the source's own language. */
  | 'ORIGINAL'
  /** The SOURCE published this translation. Only ever set from source metadata. */
  | 'SOURCE_TRANSLATION'
  /** This platform translated it, by machine. Labelled as such, always. */
  | 'PLATFORM_TRANSLATED'
  /** No translation exists. The source text stands, in a language the reader may not read. */
  | 'UNTRANSLATED'
  /** The source language is not known, so no translation claim can be made at all. */
  | 'UNKNOWN';

export const TRANSLATION_STATES: readonly TranslationState[] = [
  'ORIGINAL',
  'SOURCE_TRANSLATION',
  'PLATFORM_TRANSLATED',
  'UNTRANSLATED',
  'UNKNOWN',
];

/** What the source metadata actually said. Every field is an observation. */
export interface ObservedLanguageMetadata {
  /** Every language the source declares, verbatim. EMPTY = the source declared none. */
  readonly declared: readonly SourceLanguageTag[];
  /** The language the SOURCE designates as the original, where it designates one. */
  readonly designatedOriginal?: SourceLanguageTag;
  /** Languages the SOURCE itself translated into. The ONLY input to SOURCE_TRANSLATION. */
  readonly sourceSuppliedTranslations: readonly SourceLanguageTag[];
}

export interface TranslationStateInput {
  readonly observed: ObservedLanguageMetadata;
  readonly displayLanguage: DisplayLanguage;
  /** True only when this platform actually produced a translation for `displayLanguage`. */
  readonly platformTranslationPresent: boolean;
}

/**
 * THE ONLY WRITER OF `TranslationState`. One function, in the discipline
 * `toChangeState` already establishes: a state with several writers is a state
 * with several meanings.
 */
export function translationStateOf(input: TranslationStateInput): TranslationState {
  const { observed, displayLanguage, platformTranslationPresent } = input;

  /* 1 — UNKNOWN STAYS UNKNOWN, AND OUTRANKS EVERYTHING.
     With no declared language there is nothing to translate FROM, so no
     translation claim is sayable — not even about a translation that exists.
     Labelling one PLATFORM_TRANSLATED would assert a source language by
     implication, which is inference through the back door. */
  if (observed.declared.length === 0) return 'UNKNOWN';

  /* 2 — ORIGINAL. With several declared languages this holds only where the
     source DESIGNATED one and it matches; a record that merely contains the
     display language among several is not thereby an original in it. */
  const original = observed.designatedOriginal;
  if (original !== undefined && original === displayLanguage) return 'ORIGINAL';
  if (
    original === undefined &&
    observed.declared.length === 1 &&
    observed.declared[0] === displayLanguage
  ) {
    return 'ORIGINAL';
  }

  /* 3 — SOURCE_TRANSLATION, and ONLY from source metadata. Never "official". */
  if (observed.sourceSuppliedTranslations.includes(displayLanguage)) return 'SOURCE_TRANSLATION';

  /* 4 — PLATFORM_TRANSLATED. Labelled, never silent. WHICH ENGINE PRODUCED IT IS
     NOT THIS CONTRACT'S BUSINESS and is deliberately not carried. */
  if (platformTranslationPresent) return 'PLATFORM_TRANSLATED';

  /* 5 — UNTRANSLATED. A real displayable state, never a synonym for UNKNOWN. */
  return 'UNTRANSLATED';
}

/** True where the state asserts the source itself published the text or its translation. */
export function isSourceAuthored(state: TranslationState): boolean {
  return state === 'ORIGINAL' || state === 'SOURCE_TRANSLATION';
}

/* ── 3 · MULTILINGUAL RECORDS — THE PRODUCT DOES NOT PICK ─────────────────── */

export type SourceLanguageClaim =
  | { readonly kind: 'SINGLE'; readonly language: SourceLanguageTag }
  | {
      readonly kind: 'DESIGNATED';
      readonly language: SourceLanguageTag;
      readonly alsoDeclared: readonly SourceLanguageTag[];
    }
  | { readonly kind: 'MULTIPLE_UNDESIGNATED'; readonly languages: readonly SourceLanguageTag[] }
  | { readonly kind: 'NOT_OBSERVED' };

export const SOURCE_LANGUAGE_CLAIM_KINDS = [
  'SINGLE',
  'DESIGNATED',
  'MULTIPLE_UNDESIGNATED',
  'NOT_OBSERVED',
] as const;

export function sourceLanguageClaimOf(observed: ObservedLanguageMetadata): SourceLanguageClaim {
  if (observed.declared.length === 0) return { kind: 'NOT_OBSERVED' };
  if (observed.designatedOriginal !== undefined) {
    return {
      kind: 'DESIGNATED',
      language: observed.designatedOriginal,
      alsoDeclared: observed.declared.filter((l) => l !== observed.designatedOriginal),
    };
  }
  if (observed.declared.length === 1) return { kind: 'SINGLE', language: observed.declared[0] };
  return { kind: 'MULTIPLE_UNDESIGNATED', languages: observed.declared };
}

/* ── 4 · TITLES — PROVENANCE IS STRUCTURAL, NOT A RULE ─────────────────────
   `original` is REQUIRED, so a record carrying only a translated title cannot be
   constructed. The rule is enforced by the type rather than by review.          */

export interface QualifiedTitle {
  /** The source's own title, as published. REQUIRED — it IS the provenance. */
  readonly original: string;
  /** The language of `original`, where observed. Never inferred. */
  readonly originalLanguage?: SourceLanguageTag;
  /** An optional, clearly-labelled rendering for the reader. Never a replacement. */
  readonly display?: {
    readonly text: string;
    readonly language: DisplayLanguage;
    readonly state: Extract<TranslationState, 'SOURCE_TRANSLATION' | 'PLATFORM_TRANSLATED'>;
  };
}

export function assertTitleProvenance(title: QualifiedTitle): void {
  if (title.original.trim() === '') {
    throw new Error('HUMANITARIAN_TITLE_ORIGINAL_MISSING: a display title may not stand alone.');
  }
}

/* ── 5 · REFUSAL · TEXT THAT CANNOT BE SAFELY QUALIFIED ────────────────────
   Retain the metadata; withhold the body. The refusal shape follows the accepted
   NISR precedent, which refuses on an unobserved edition language rather than
   defaulting: `NISR_PDF_SOURCE_LANGUAGE_UNOBSERVED` / `EDITION_LANGUAGE_NOT_OBSERVED`. */

export type TextQualification =
  | { readonly kind: 'AVAILABLE'; readonly state: TranslationState }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: TextUnavailableReason };

export type TextUnavailableReason =
  /** The source declared no language, so the body cannot be qualified. */
  | 'SOURCE_LANGUAGE_NOT_OBSERVED'
  /** Several declared, none designated: which language this body is in is unknown. */
  | 'SOURCE_LANGUAGE_AMBIGUOUS'
  /** The source text exists in a language with no qualified path to the reader. */
  | 'NO_QUALIFIED_RENDERING'
  /** The source published no body for this record. Absence at the source. */
  | 'NOT_PUBLISHED_BY_SOURCE';

export const TEXT_UNAVAILABLE_REASONS: readonly TextUnavailableReason[] = [
  'SOURCE_LANGUAGE_NOT_OBSERVED',
  'SOURCE_LANGUAGE_AMBIGUOUS',
  'NO_QUALIFIED_RENDERING',
  'NOT_PUBLISHED_BY_SOURCE',
];

export interface QualifiedTextInput {
  readonly observed: ObservedLanguageMetadata;
  readonly displayLanguage: DisplayLanguage;
  readonly platformTranslationPresent: boolean;
  /** Whether the source published a body/summary at all. */
  readonly sourceTextPresent: boolean;
}

/** THE ONLY WRITER of `TextQualification`. Refuses rather than inventing. */
export function qualifyText(input: QualifiedTextInput): TextQualification {
  if (!input.sourceTextPresent) return { kind: 'UNAVAILABLE', reason: 'NOT_PUBLISHED_BY_SOURCE' };

  const claim = sourceLanguageClaimOf(input.observed);
  if (claim.kind === 'NOT_OBSERVED') {
    return { kind: 'UNAVAILABLE', reason: 'SOURCE_LANGUAGE_NOT_OBSERVED' };
  }
  if (claim.kind === 'MULTIPLE_UNDESIGNATED') {
    return { kind: 'UNAVAILABLE', reason: 'SOURCE_LANGUAGE_AMBIGUOUS' };
  }

  const state = translationStateOf({
    observed: input.observed,
    displayLanguage: input.displayLanguage,
    platformTranslationPresent: input.platformTranslationPresent,
  });
  /* Unreachable today — the two branches above already caught it — but kept, so a
     state meaning "no claim is sayable" can never travel as AVAILABLE if a later
     edit reorders the branches above. */
  if (state === 'UNKNOWN') return { kind: 'UNAVAILABLE', reason: 'SOURCE_LANGUAGE_NOT_OBSERVED' };
  return { kind: 'AVAILABLE', state };
}

/* ── 6 · ASK · A CITATION KEEPS THE SOURCE'S IDENTITY ────────────────────── */

export interface CitationLanguageIdentity {
  /** The publisher's name, as published. NEVER translated — it is an identifier. */
  readonly publisherName: string;
  /** The source's own title. Never translated away. */
  readonly originalTitle: string;
  /** The source's language, where observed. */
  readonly sourceLanguage?: SourceLanguageTag;
  /** The language the ANSWER is written in. A different fact, in a different field. */
  readonly answerLanguage: DisplayLanguage;
  /** An optional labelled rendering of the title for the reader. */
  readonly displayTitle?: QualifiedTitle['display'];
}

/**
 * Whether the citation MUST state the source's language.
 *
 * True when they differ, and true when the source language was not observed —
 * because silence there reads as agreement, and a Polish reader meeting a Polish
 * answer with no stated source language will assume a Polish source.
 */
export function mustDiscloseSourceLanguage(c: CitationLanguageIdentity): boolean {
  if (c.sourceLanguage === undefined) return true;
  return c.sourceLanguage !== c.answerLanguage;
}

export function assertCitationIdentity(c: CitationLanguageIdentity): void {
  if (c.originalTitle.trim() === '') {
    throw new Error(
      'ASK_CITATION_ORIGINAL_TITLE_MISSING: a citation without the source title has no identity.',
    );
  }
  if (c.publisherName.trim() === '') {
    throw new Error(
      'ASK_CITATION_PUBLISHER_MISSING: a citation without a publisher has no identity.',
    );
  }
}

/* ── 7 · WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN ──────────────────────
   · no translation provider, model, endpoint, key or vendor name — L does not own
     machine-translation provider selection
   · no fetch, client or adapter for ReliefWeb, GDACS or any source
   · no country -> language table, and no function that takes a country
   · no mapping of a `SourceLanguageTag` onto `LanguageCode`
   · no "official translation" wording
   · no self-package import — `../analysis` is the canonical internal owner       */
