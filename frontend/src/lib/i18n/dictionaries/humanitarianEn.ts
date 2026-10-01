import type { DisplayLocale } from '@globalnews-ai/shared';
import type {
  TranslationState,
  TextUnavailableReason,
  SourceLanguageClaim,
  HumanitarianObservationKind,
  HumanitarianHazardType,
  HumanitarianEventStatus,
  HumanitarianImpactMeasure,
  HumanitarianStatusMeasure,
  ImpactAssertionBasis,
} from '@globalnews-ai/shared';

/**
 * PROPOSED  frontend/src/lib/i18n/dictionaries/humanitarianEn.ts
 * HUMANITARIAN LANGUAGE QUALIFICATION R1 · contract and copy · not merged.
 *
 * Pattern: the shipped `Dictionary = typeof en` discipline (a key present here and
 * missing in Polish is a compile error) and the module-scoped shape
 * `frontend/src/lib/delivery/deliveryStrings.ts` already uses.
 *
 * SCOPE. Every string below labels a **provenance or absence** state. None
 * paraphrases, summarises or re-words a source. None names a translation
 * provider. None says "official translation" — `SOURCE_TRANSLATION` states WHO
 * supplied the translation and claims nothing about its status, which is the
 * contract's rule.
 */
export type HumanitarianLocale = Extract<DisplayLocale, 'en' | 'pl'>;

export interface HumanitarianLanguageStrings {
  /** The domain's own name. Reused from the shipped dictionaries, not re-minted. */
  readonly domainName: string;

  /** The five translation states, short form — a chip or an inline tag. */
  readonly translationState: Readonly<Record<TranslationState, string>>;
  /** The same five, as a sentence a reader can act on. */
  readonly translationStateDetail: Readonly<Record<TranslationState, string>>;

  /** Why a body or summary is not shown. The metadata is still there. */
  readonly textUnavailable: Readonly<Record<TextUnavailableReason, string>>;
  readonly textUnavailableHeading: string;
  readonly metadataRetainedNote: string;

  /** What the record's source language turned out to be. */
  readonly sourceLanguageClaim: Readonly<Record<SourceLanguageClaim['kind'], string>>;

  /** Titles and provenance. */
  readonly title: {
    readonly originalLabel: string;
    readonly translatedLabel: string;
    readonly showOriginal: string;
    readonly originalLanguageIs: string;
    readonly languageNotStated: string;
  };

  /** Ask citations. The source keeps its identity in a Polish answer. */
  readonly citation: {
    readonly publishedByLabel: string;
    readonly sourceLanguageLabel: string;
    readonly answerLanguageDiffers: string;
    readonly titleShownAsPublished: string;
  };

  /** The one sentence that must never be lost. */
  readonly translationIsNotEvidence: string;

  /**
   * CONVERGENCE (Claude Code, final semantic authority) — reader labels for Main's canonical
   * vocabularies (shared/src/humanitarian/observation.ts). Main's contract declares no reader
   * text and assigns EN/PL labelling to L; each map is typed by Main's own union, so a member
   * added there without a label here is a compile error in both languages. Source strings
   * (sourceNativeType, sourceSeverityStated, sourceFormat, status values) are NEVER labelled —
   * they are shown verbatim, as the source wrote them.
   */
  readonly vocabulary: {
    readonly observationKind: Readonly<Record<HumanitarianObservationKind, string>>;
    readonly hazardType: Readonly<Record<HumanitarianHazardType, string>>;
    readonly eventStatus: Readonly<Record<HumanitarianEventStatus, string>>;
    readonly impactMeasure: Readonly<Record<HumanitarianImpactMeasure, string>>;
    readonly statusMeasure: Readonly<Record<HumanitarianStatusMeasure, string>>;
    readonly impactBasis: Readonly<Record<ImpactAssertionBasis, string>>;
  };
}

export const humanitarianEn: HumanitarianLanguageStrings = {
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
      'GlobalNews AI translated this. The source’s own wording is kept and can be opened.',
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
    NO_QUALIFIED_RENDERING:
      'There is no checked way to show this text in your language yet.',
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

  title: {
    originalLabel: 'Title as published',
    translatedLabel: 'Translated title',
    showOriginal: 'Show the title as published',
    originalLanguageIs: 'Published in {language}',
    languageNotStated: 'Language not stated by the source',
  },

  citation: {
    publishedByLabel: 'Published by {publisher}',
    sourceLanguageLabel: 'Source language: {language}',
    answerLanguageDiffers:
      'This answer is in {answerLanguage}. The source it cites was published in {sourceLanguage}.',
    titleShownAsPublished: 'The source’s title is shown as published.',
  },

  translationIsNotEvidence: 'A translation carries no more certainty than the original.',

  vocabulary: {
    observationKind: {
      HUMANITARIAN_EVENT: 'Event',
      HUMANITARIAN_REPORT: 'Report',
      HUMANITARIAN_IMPACT_ASSERTION: 'Impact figure, as stated by the source',
    },
    hazardType: {
      EARTHQUAKE: 'Earthquake',
      TROPICAL_CYCLONE: 'Tropical cyclone',
      FLOOD: 'Flood',
      DROUGHT: 'Drought',
      WILDFIRE: 'Wildfire',
      VOLCANIC_ACTIVITY: 'Volcanic activity',
      ARMED_CONFLICT_DISPLACEMENT: 'Displacement due to armed conflict',
      EPIDEMIC: 'Epidemic',
    },
    eventStatus: {
      ONGOING: 'Ongoing',
      CLOSED: 'Closed',
      NOT_STATED: 'Status not stated by the source',
    },
    impactMeasure: {
      PEOPLE_AFFECTED: 'People affected',
      PEOPLE_DISPLACED: 'People displaced',
      FATALITIES: 'Fatalities',
      INJURED: 'Injured',
      PEOPLE_IN_NEED: 'People in need',
      HOUSES_DAMAGED: 'Houses damaged',
      HOUSES_DESTROYED: 'Houses destroyed',
    },
    statusMeasure: {
      SHELTER_STATUS: 'Shelter',
      HEALTH_STATUS: 'Health',
      FOOD_SECURITY_STATUS: 'Food security',
      WATER_STATUS: 'Water',
      HUMANITARIAN_ACCESS_STATUS: 'Humanitarian access',
    },
    impactBasis: {
      SOURCE_STATED: 'Stated by the source',
      SOURCE_ESTIMATED: 'Estimated by the source',
    },
  },
};
