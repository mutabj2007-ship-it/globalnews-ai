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
  HumanitarianClaimClass,
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

  /** The one sentence that must never be lost. */
  readonly translationIsNotEvidence: string;

  /** H's claim-class taxonomy (shared HUMANITARIAN_CLAIM_CLASSES); these are its EN/PL labels. */
  readonly claimClass: Readonly<Record<HumanitarianClaimClass, string>>;

  /* ═══ L R2 SURFACE GROUPS — merged into the canonical pair (CTO language-authority ruling) ═══ */
  /* ── 1 · THE HUMANITARIAN PAGE ─────────────────────────────────────────── */
  readonly humanitarianPage: {
    readonly sourceLanguageRowLabel: string;
    readonly reportLanguageRowLabel: string;
    readonly notAssessed: string;
    readonly notAssessedDetail: string;
    readonly retainedReportingHeading: string;
    readonly noRetainedReporting: string;
    readonly coverageGap: string;
    readonly partial: string;
  };

  /* ── 2 · HOME ──────────────────────────────────────────────────────────── */
  readonly home: {
    readonly cardTitle: string;
    readonly cardBlurb: string;
    readonly noRetainedDataYet: string;
    readonly sourceLanguagesSeen: string;
    /* Convergence · the Home consumer (H brief behind G's display gate). */
    readonly retainedRecordCount: string;
    readonly newestRetainedAt: string;
    readonly areasWithoutEvidence: string;
    readonly openHumanitarian: string;
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
    /* Convergence · the "new since your previous visit" consumer of lane A's delta feed. */
    readonly newSinceTitle: string;
    readonly changeNew: string;
    readonly changeRevised: string;
    readonly changesMayBeMissing: string;
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
    /** Admin-only source health (never shown to readers: public reads are lossy). */
    readonly sourceUnavailable: string;
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

  /**
   * CONVERGENCE · READER LABELS FOR E1's REQUIRED DISCLOSURE CODES (E1 R2 · D-1). Keyed by E1's
   * code; E1's list itself is NOT copied here — a display hop binds the list from the backend and
   * may display only when every required code has a label below (G R2 gate). A code E1 adds
   * without a label here therefore makes every display refuse, never display unlabelled.
   */
  readonly readerDisclosure: Readonly<Record<string, string>>;

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


  translationIsNotEvidence: 'A translation carries no more certainty than the original.',

  claimClass: {
    FACT: 'Recorded',
    SOURCE_ASSERTION: 'Stated by the source',
    ESTIMATE: 'Estimate',
    INTERPRETATION: 'Interpretation',
    UNKNOWN: 'Not known',
  },

  humanitarianPage: {
    sourceLanguageRowLabel: 'Source language',
    reportLanguageRowLabel: 'Report language',
    notAssessed: 'Not assessed',
    notAssessedDetail:
      'No admitted source has assessed this. That is not a statement that nothing happened.',
    retainedReportingHeading: 'Retained reporting',
    noRetainedReporting: 'No reporting has been retained for this yet.',
    coverageGap: 'This area is not covered by an admitted source.',
    partial: 'Part of this record is available. What is missing is marked.',
  },

  home: {
    cardTitle: 'Humanitarian',
    cardBlurb: 'People, needs and response',
    noRetainedDataYet: 'No humanitarian reporting has been retained yet.',
    sourceLanguagesSeen: 'Sources so far: {languages}',
    retainedRecordCount: 'Retained records: {count}',
    newestRetainedAt: 'Newest record retained {date}',
    areasWithoutEvidence:
      'No retained evidence for {count} of {total} areas. That is not a statement that nothing happened.',
    openHumanitarian: 'Open Humanitarian',
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
    newSinceTitle: 'Humanitarian records new since your previous visit',
    changeNew: 'New record',
    changeRevised: 'Revised by the source',
    changesMayBeMissing:
      'Some changes may be missing: older records left our retained store before you looked.',
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
    sourceUnavailable: 'A source did not answer. What is shown may be incomplete.',
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

  readerDisclosure: {
    IMPACT_NOT_ASSESSED: 'Impact on people was not assessed from these records.',
    RETAINED_NOT_CURRENT: 'These are retained records, not current observations.',
    SEVERITY_NOT_ASSESSED: 'Severity was not assessed.',
    COUNTRY_SCOPE_NOT_STATED_BY_SOURCE:
      'Where a source states no country, none is assigned for it.',
    PUBLISHER_TIME_ZONE_NOT_STATED: 'Publisher times are shown as stated; no time zone is assumed.',
    GEOMETRY_WITHHELD_SOURCE_CENTROID: 'Locations are withheld; only countries are shown.',
  },

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
