import type { DisplayLocale } from '@globalnews-ai/shared';
import type {
  TranslationState,
  TextUnavailableReason,
  SourceLanguageClaim,
} from '@globalnews-ai/shared';

/**
 * PROPOSED  frontend/src/lib/i18n/dictionaries/humanitarianLanguageEn.ts
 * HUMANITARIAN LANGUAGE FINALIZATION R2 · base 58f80fd4108d3472e5433c7a50e19295788f2544
 *
 * ── WHY ONE SURFACE-SCOPED MODULE RATHER THAN SIX DICTIONARY EDITS ─────────
 *
 * R2 requires complete EN/PL strings for six surfaces: the Humanitarian page,
 * Home, Map, My Intelligence, Admin and the Ask disclosures. They are delivered
 * as ONE module with a group per surface, and NOT as edits inside the six
 * existing dictionaries, for three reasons:
 *
 *   1 · Three other lanes own those files this round — G owns the Humanitarian
 *       frontend, F owns Admin, H owns the Analysis Workspace. An additive module
 *       produces no merge conflict with any of them; six scattered edits would.
 *   2 · Every translation decision about one word then sits in one reviewable
 *       place, next to the reason for it, instead of in six files.
 *   3 · A surface consumes the group it needs. Nothing is forced to import the
 *       other five.
 *
 * This file imports from `@globalnews-ai/shared`, which is correct HERE: the
 * frontend is a different package. The self-package import R2 removes was inside
 * `shared` itself — see `shared/src/humanitarian/language.ts`, which now binds to
 * `../analysis`.
 *
 * ── SCOPE ────────────────────────────────────────────────────────────────────
 * Every string labels a PROVENANCE, LANGUAGE or ABSENCE state. None paraphrases
 * a source, none names a translation provider, none claims an official
 * translation, and none turns an absence into reassurance.
 */
export type HumanitarianLocale = Extract<DisplayLocale, 'en' | 'pl'>;

/**
 * The claim classes the Humanitarian programme requires be kept apart. The
 * vocabulary is the H lane's; these are the EN/PL labels for it, which is this
 * lane's half. See HANDOFF dependency HL-9.
 */
export type HumanitarianClaimClass =
  | 'FACT'
  | 'SOURCE_ASSERTION'
  | 'ESTIMATE'
  | 'INTERPRETATION'
  | 'UNKNOWN';

export const HUMANITARIAN_CLAIM_CLASSES: readonly HumanitarianClaimClass[] = [
  'FACT',
  'SOURCE_ASSERTION',
  'ESTIMATE',
  'INTERPRETATION',
  'UNKNOWN',
];

export interface HumanitarianLanguageStrings {
  /** The domain's name. Taken from the shipped dictionaries, not re-minted. */
  readonly domainName: string;

  /* ── language and provenance, shared by every surface ──────────────────── */
  readonly translationState: Readonly<Record<TranslationState, string>>;
  readonly translationStateDetail: Readonly<Record<TranslationState, string>>;
  readonly textUnavailable: Readonly<Record<TextUnavailableReason, string>>;
  readonly textUnavailableHeading: string;
  readonly metadataRetainedNote: string;
  readonly sourceLanguageClaim: Readonly<Record<SourceLanguageClaim['kind'], string>>;
  readonly claimClass: Readonly<Record<HumanitarianClaimClass, string>>;
  readonly title: {
    readonly originalLabel: string;
    readonly translatedLabel: string;
    readonly showOriginal: string;
    readonly originalLanguageIs: string;
    readonly languageNotStated: string;
  };
  readonly translationIsNotEvidence: string;

  /* ── 1 · THE HUMANITARIAN PAGE ─────────────────────────────────────────── */
  readonly humanitarianPage: {
    readonly sourceLanguageRowLabel: string;
    readonly reportLanguageRowLabel: string;
    readonly notAssessed: string;
    readonly notAssessedDetail: string;
    readonly retainedReportingHeading: string;
    readonly noRetainedReporting: string;
    readonly sourceUnavailable: string;
    readonly coverageGap: string;
    readonly partial: string;
  };

  /* ── 2 · HOME ──────────────────────────────────────────────────────────── */
  readonly home: {
    readonly cardTitle: string;
    readonly cardBlurb: string;
    readonly noRetainedDataYet: string;
    readonly sourceLanguagesSeen: string;
  };

  /* ── 3 · MAP ───────────────────────────────────────────────────────────── */
  readonly map: {
    readonly layerName: string;
    readonly geometryFromSource: string;
    readonly countryLevelOnly: string;
    readonly hazardNotImpact: string;
    readonly precisionUnknown: string;
    readonly reportLanguageOnMarker: string;
  };

  /* ── 4 · MY INTELLIGENCE ───────────────────────────────────────────────── */
  readonly myIntelligence: {
    readonly savedSectionTitle: string;
    readonly reopenedAsStored: string;
    readonly storedAnswerLanguage: string;
    readonly storedSourceLanguageDiffers: string;
  };

  /* ── 5 · ADMIN · SOURCE HEALTH ─────────────────────────────────────────── */
  readonly admin: {
    readonly sectionTitle: string;
    readonly languageMetadataCoverage: string;
    readonly recordsWithNoDeclaredLanguage: string;
    readonly recordsWithAmbiguousLanguage: string;
    readonly bodiesWithheldForLanguage: string;
    readonly reliefwebAppnameRequired: string;
    readonly acquisitionDisabled: string;
    readonly noLanguageInference: string;
  };

  /* ── 6 · ASK DISCLOSURES ───────────────────────────────────────────────── */
  readonly askDisclosure: {
    readonly publishedByLabel: string;
    readonly sourceLanguageLabel: string;
    readonly answerLanguageDiffers: string;
    readonly titleShownAsPublished: string;
    readonly answerUsesTranslatedReporting: string;
    readonly someSourcesWithheldForLanguage: string;
  };
}

export const humanitarianLanguageEn: HumanitarianLanguageStrings = {
  domainName: 'Humanitarian',

  translationState: {
    ORIGINAL: 'Original',
    SOURCE_TRANSLATION: 'Translated by the source',
    PLATFORM_TRANSLATED: 'Machine translation',
    UNTRANSLATED: 'Not translated',
    UNKNOWN: 'Source language not stated',
  },
  translationStateDetail: {
    ORIGINAL: 'This is the source’s own text, in the language it was published in.',
    SOURCE_TRANSLATION: 'The source published this translation itself.',
    PLATFORM_TRANSLATED:
      'GlobalNews AI translated this by machine. The source’s own wording is kept and can be opened.',
    UNTRANSLATED:
      'No translation exists for this text. It is shown in the language the source published.',
    UNKNOWN:
      'The source did not state what language this is in, so nothing is claimed about it — including whether it was translated.',
  },

  textUnavailable: {
    SOURCE_LANGUAGE_NOT_OBSERVED:
      'The source did not state a language for this text, so it cannot be shown safely.',
    SOURCE_LANGUAGE_AMBIGUOUS:
      'The source lists several languages for this record and does not say which this text is in.',
    NO_QUALIFIED_RENDERING: 'There is no checked way to show this text in your language yet.',
    NOT_PUBLISHED_BY_SOURCE: 'The source published no text for this record.',
  },
  textUnavailableHeading: 'Text not shown',
  metadataRetainedNote:
    'Everything else about this record — who published it, when, and where it applies — is unchanged and shown above.',

  sourceLanguageClaim: {
    SINGLE: 'Published in {language}',
    DESIGNATED: 'Published in {language}; the source also lists {others}',
    MULTIPLE_UNDESIGNATED: 'The source lists {languages} and does not say which is the original',
    NOT_OBSERVED: 'The source did not state a language',
  },

  claimClass: {
    FACT: 'Recorded',
    SOURCE_ASSERTION: 'Stated by the source',
    ESTIMATE: 'Estimate',
    INTERPRETATION: 'Interpretation',
    UNKNOWN: 'Not known',
  },

  title: {
    originalLabel: 'Title as published',
    translatedLabel: 'Translated title',
    showOriginal: 'Show the title as published',
    originalLanguageIs: 'Published in {language}',
    languageNotStated: 'Language not stated by the source',
  },

  translationIsNotEvidence: 'A translation carries no more certainty than the original.',

  humanitarianPage: {
    sourceLanguageRowLabel: 'Source language',
    reportLanguageRowLabel: 'Report language',
    notAssessed: 'Not assessed',
    notAssessedDetail:
      'No admitted source has assessed this. That is not a statement that nothing happened.',
    retainedReportingHeading: 'Retained reporting',
    noRetainedReporting: 'No reporting has been retained for this yet.',
    sourceUnavailable: 'A source did not answer. What is shown may be incomplete.',
    coverageGap: 'This area is not covered by an admitted source.',
    partial: 'Part of this record is available. What is missing is marked.',
  },

  home: {
    cardTitle: 'Humanitarian',
    cardBlurb: 'People, needs and response',
    noRetainedDataYet: 'No humanitarian reporting has been retained yet.',
    sourceLanguagesSeen: 'Sources so far: {languages}',
  },

  map: {
    layerName: 'Humanitarian',
    geometryFromSource: 'Shape as the source supplied it',
    countryLevelOnly: 'The source establishes this only at country level.',
    hazardNotImpact: 'This shape is the hazard, not the people affected.',
    precisionUnknown: 'The source did not state how precisely this is located.',
    reportLanguageOnMarker: 'Report language: {language}',
  },

  myIntelligence: {
    savedSectionTitle: 'Saved humanitarian results',
    reopenedAsStored: 'Reopened as it was stored. Nothing has been re-run.',
    storedAnswerLanguage: 'This result was written in {language}.',
    storedSourceLanguageDiffers:
      'It cites sources published in {sourceLanguages}, which it did not translate away.',
  },

  admin: {
    sectionTitle: 'Humanitarian language metadata',
    languageMetadataCoverage: 'Records with a declared source language: {withLanguage} of {total}',
    recordsWithNoDeclaredLanguage: 'No declared language: {count}',
    recordsWithAmbiguousLanguage: 'Several languages, none designated: {count}',
    bodiesWithheldForLanguage: 'Bodies withheld because the language could not be qualified: {count}',
    reliefwebAppnameRequired: 'RELIEFWEB_APPNAME_REQUIRED — acquisition stays off until one is approved.',
    acquisitionDisabled: 'Acquisition is off for this source.',
    noLanguageInference:
      'A record with no declared language is counted, never guessed from its country.',
  },

  askDisclosure: {
    publishedByLabel: 'Published by {publisher}',
    sourceLanguageLabel: 'Source language: {language}',
    answerLanguageDiffers:
      'This answer is in {answerLanguage}. The source it cites was published in {sourceLanguage}.',
    titleShownAsPublished: 'The source’s title is shown as published.',
    answerUsesTranslatedReporting:
      'This answer draws on reporting that was machine-translated. The originals are linked.',
    someSourcesWithheldForLanguage:
      '{count} retained records were left out because their language could not be qualified.',
  },
};
