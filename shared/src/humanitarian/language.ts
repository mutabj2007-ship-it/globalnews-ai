/* ────────────────────────────────────────────────────────────────────────────
   PROPOSED  shared/src/humanitarian/language.ts
   HUMANITARIAN LANGUAGE QUALIFICATION R1 · branch feature/humanitarian-language-qualification-r1
   Contract and types only. Not merged. Any shared-type change goes through Main.

   SCOPE, AS THE CONTRACT SETS IT
     L does NOT own machine-translation provider selection — no provider, model,
     endpoint, key or vendor appears anywhere in this file, and `PLATFORM_TRANSLATED`
     deliberately carries no provider identity.
     L does NOT acquire source data — nothing here fetches, and no ReliefWeb or
     GDACS client is proposed.
   ──────────────────────────────────────────────────────────────────────────── */

import type { LanguageCode } from '../analysis';

/* ── 1 · THE TWO LANGUAGE AXES, AND WHY THEY ARE DIFFERENT TYPES ────────────
   This is not a new rule. Canonical already states it, twice, and this file
   reuses the statement rather than restating it:

   `shared/src/news.ts:135` on `NewsArticle.sourceLanguage`:
     "Deliberately a plain string, NOT LanguageCode: retrieved evidence can be in
      any language the news provider supports, a far larger set than GlobalNews
      AI's own closed UI-language list, and coercing an unrecognized value into a
      false LanguageCode member would be dishonest. Undefined when the provider
      didn't report a language for this article — NEVER FABRICATED OR INFERRED."

   `shared/src/analysis.ts:11` on `LanguageCode`:
     "Represents requested/resolved UI and analysis response language ONLY —
      never an arbitrary evidence/source language."

   The second sentence of the first quote is the contract's "never infer language
   from country", already accepted. Nothing below widens it.                     */

/**
 * The publisher's own language tag, **verbatim** from source metadata — trimmed
 * and lowercased, never otherwise normalised, never mapped onto `LanguageCode`.
 *
 * A source may report `en`, `pl`, `fr`, `es-419`, `ha`, `prs` or something this
 * product has never heard of. All of those are faithful; a coerced member is not.
 */
export type SourceLanguageTag = string;

/** The language the reader is being served. A closed set — the product's own. */
export type DisplayLanguage = LanguageCode;

/* ── 2 · TRANSLATION STATE ─────────────────────────────────────────────────── */

export type TranslationState =
  /** The text shown IS the source's own text, in the source's own language. */
  | 'ORIGINAL'
  /** The SOURCE published this translation. Only ever set from source metadata. */
  | 'SOURCE_TRANSLATION'
  /** GlobalNews AI translated it. Labelled as such, always. */
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

/**
 * WHAT WAS OBSERVED. Every field is an observation, and the type makes the
 * difference between "observed absent" and "not observed" representable.
 */
export interface ObservedLanguageMetadata {
  /**
   * Every language the source itself declares for this record, verbatim.
   * EMPTY means the source declared none — which is a fact, not a default.
   * A ReliefWeb record routinely declares several (`language: [...]`).
   */
  readonly declared: readonly SourceLanguageTag[];
  /**
   * The language the SOURCE designates as the original, where it designates one.
   * Undefined when it does not — and then this product does NOT pick one.
   */
  readonly designatedOriginal?: SourceLanguageTag;
  /**
   * Languages for which the SOURCE supplied its own translation, verbatim from
   * metadata. This is the ONLY input that can produce `SOURCE_TRANSLATION`.
   */
  readonly sourceSuppliedTranslations: readonly SourceLanguageTag[];
}

export interface TranslationStateInput {
  readonly observed: ObservedLanguageMetadata;
  readonly displayLanguage: DisplayLanguage;
  /** True only when this platform actually produced a translation for `displayLanguage`. */
  readonly platformTranslationPresent: boolean;
}

/**
 * THE ONLY WRITER OF `TranslationState`.
 *
 * One function, in the discipline `toChangeState` already establishes: a state
 * with several writers is a state with several meanings. The precedence below is
 * the contract, and the order is the argument.
 */
export function translationStateOf(input: TranslationStateInput): TranslationState {
  const { observed, displayLanguage, platformTranslationPresent } = input;

  /* 1 — UNKNOWN FIRST, AND IT OUTRANKS EVERYTHING.
     With no declared language there is nothing to translate FROM, so no
     translation claim is sayable — not even about a translation that exists. A
     translation of unknown origin labelled PLATFORM_TRANSLATED would assert a
     source language by implication. */
  if (observed.declared.length === 0) return 'UNKNOWN';

  /* 2 — ORIGINAL. The source's own language is the reader's language, so the
     source text needs no translation and gets no translation label. With several
     declared languages this holds only when the source DESIGNATED one and it
     matches; a record that merely contains the display language among several is
     not thereby an original in it. */
  const original = observed.designatedOriginal;
  if (original !== undefined && original === displayLanguage) return 'ORIGINAL';
  if (original === undefined && observed.declared.length === 1 && observed.declared[0] === displayLanguage) {
    return 'ORIGINAL';
  }

  /* 3 — SOURCE_TRANSLATION, and ONLY from source metadata.
     The contract: do not claim "official translation" unless the source supplied
     it. This branch is reachable only from `sourceSuppliedTranslations`, which is
     observed, never inferred. */
  if (observed.sourceSuppliedTranslations.includes(displayLanguage)) return 'SOURCE_TRANSLATION';

  /* 4 — PLATFORM_TRANSLATED. Labelled, never silent. Which engine produced it is
     not this contract's business and is not carried here. */
  if (platformTranslationPresent) return 'PLATFORM_TRANSLATED';

  /* 5 — UNTRANSLATED. A real, displayable state: the source text stands in its
     own language, and the reader is told which. Never a synonym for UNKNOWN. */
  return 'UNTRANSLATED';
}

/** True where the state asserts the source itself published the translation. */
export function isSourceAuthored(state: TranslationState): boolean {
  return state === 'ORIGINAL' || state === 'SOURCE_TRANSLATION';
}

/* ── 3 · MULTILINGUAL RECORDS ──────────────────────────────────────────────
   A ReliefWeb record with several declared languages and no designated original
   has no single "the source language", and this product must not choose one.    */

export type SourceLanguageClaim =
  | { readonly kind: 'SINGLE'; readonly language: SourceLanguageTag }
  | { readonly kind: 'DESIGNATED'; readonly language: SourceLanguageTag; readonly alsoDeclared: readonly SourceLanguageTag[] }
  | { readonly kind: 'MULTIPLE_UNDESIGNATED'; readonly languages: readonly SourceLanguageTag[] }
  | { readonly kind: 'NOT_OBSERVED' };

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
   The contract requires that a translated title never overwrites provenance.
   `original` is REQUIRED, so a record carrying only a translated title cannot be
   constructed. That is the rule enforced by the type rather than by review.      */

export interface QualifiedTitle {
  /** The source's own title, as published. REQUIRED — it is the provenance. */
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

/** A display title may exist only alongside its original. Asserted, not assumed. */
export function assertTitleProvenance(title: QualifiedTitle): void {
  if (title.original.trim() === '') {
    throw new Error('HUMANITARIAN_TITLE_ORIGINAL_MISSING: a display title may not stand alone.');
  }
}

/* ── 5 · REFUSAL · TEXT THAT CANNOT BE SAFELY QUALIFIED ────────────────────
   The contract: retain metadata and mark body/summary unavailable rather than
   inventing a translation.

   The refusal-code shape follows the accepted NISR precedent, which refuses on an
   unobserved edition language rather than defaulting:
     `NISR_PDF_SOURCE_LANGUAGE_UNOBSERVED` / `EDITION_LANGUAGE_NOT_OBSERVED`.     */

export type TextQualification =
  /** Qualified, and displayable, with its `TranslationState`. */
  | { readonly kind: 'AVAILABLE'; readonly state: TranslationState }
  /** Withheld. The METADATA IS RETAINED; only the text is unavailable. */
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
  if (claim.kind === 'NOT_OBSERVED') return { kind: 'UNAVAILABLE', reason: 'SOURCE_LANGUAGE_NOT_OBSERVED' };
  if (claim.kind === 'MULTIPLE_UNDESIGNATED') return { kind: 'UNAVAILABLE', reason: 'SOURCE_LANGUAGE_AMBIGUOUS' };

  const state = translationStateOf({
    observed: input.observed,
    displayLanguage: input.displayLanguage,
    platformTranslationPresent: input.platformTranslationPresent,
  });
  /* UNKNOWN cannot reach here — the two claim branches above already caught it —
     but the guard stays, because a state that means "no claim is sayable" must
     never travel as AVAILABLE if a later edit changes the order above. */
  if (state === 'UNKNOWN') return { kind: 'UNAVAILABLE', reason: 'SOURCE_LANGUAGE_NOT_OBSERVED' };
  return { kind: 'AVAILABLE', state };
}

/* ── 6 · ASK · A CITATION KEEPS THE SOURCE'S IDENTITY ──────────────────────
   The contract: a Polish answer based on an English source must not imply the
   source itself was Polish. Two separate fields, and a render rule derived from
   comparing them — not a reviewer's memory.                                      */

export interface CitationLanguageIdentity {
  /** The publisher's name, as published. NEVER translated (the P-4 identifier rule). */
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
 * Whether the citation MUST state the source's language to the reader.
 *
 * True whenever the source language differs from the answer language, and true
 * when it was not observed — because silence there reads as agreement.
 */
export function mustDiscloseSourceLanguage(c: CitationLanguageIdentity): boolean {
  if (c.sourceLanguage === undefined) return true;
  return c.sourceLanguage !== c.answerLanguage;
}

/** A citation may never present a translated title without the original beside it. */
export function assertCitationIdentity(c: CitationLanguageIdentity): void {
  if (c.originalTitle.trim() === '') {
    throw new Error('ASK_CITATION_ORIGINAL_TITLE_MISSING: a citation without the source title has no identity.');
  }
  if (c.publisherName.trim() === '') {
    throw new Error('ASK_CITATION_PUBLISHER_MISSING: a citation without a publisher has no identity.');
  }
}

/* ── 7 · WHAT THIS FILE DELIBERATELY DOES NOT CONTAIN ──────────────────────
   · no translation provider, model, endpoint, key or vendor name
   · no fetch, client or adapter for ReliefWeb, GDACS or any source
   · no country -> language table, and no function that takes a country
   · no mapping of a `SourceLanguageTag` onto `LanguageCode`
   · no "official translation" wording — `SOURCE_TRANSLATION` says who supplied it
     and claims nothing about status                                              */
