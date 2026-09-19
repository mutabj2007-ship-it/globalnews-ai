import type { DisplayLocale } from '@globalnews-ai/shared';
import type {
  PoliticsConfidence, PoliticsEpistemicState, PoliticsEventKind,
  PoliticsPollField, PoliticsSubjectType,
} from './politicsDomain';

/**
 * PART VIII · POLITICS — DOMAIN-LOCAL COPY, on the accepted Economy/Market/Humanitarian
 * pattern. Resolution makes the fallback VISIBLE; nothing falls back silently.
 *
 * ENGLISH ONLY, AND THAT IS THE GOVERNED ANSWER RATHER THAN A SHORTFALL. The activation is
 * explicit — *"do not author speculative translations outside existing authority. Governed
 * fallback is preferable to invented localization."* Market and Humanitarian both ship
 * EN-only catalogues with a disclosed fallback for the same reason, and L authors the rest.
 *
 * ON A DOMAIN LIKE THIS ONE THE RULE MATTERS MORE THAN USUAL. A mistranslated political
 * label is not a cosmetic defect: `allegation`, `official position` and `confirmed fact` are
 * three different claims about the world, and §6 requires them to stay visibly distinct in
 * every language. Guessing at those in Polish would be inventing an epistemic distinction in
 * a language this lane does not author.
 */
export type PolLocale = DisplayLocale;

export interface PolStrings {
  readonly domain: string;
  readonly metaTitle: string;
  readonly metaDescription: string;

  /** Zone names — Phase 1 §4's four zones, in its own words. */
  readonly zones: Readonly<Record<'HEADER' | 'ATTENTION' | 'SUBSTRATE' | 'CONTEXT', string>>;

  readonly labels: Readonly<Record<
    'jurisdiction' | 'assessment' | 'confidence' | 'lastReassessment'
    | 'precision' | 'precisionCeiling' | 'changeState' | 'lifecycleEvent'
    | 'subjectType' | 'evidence' | 'stage' | 'actors' | 'crossDomain'
    | 'sourceClass' | 'timeline' | 'watch' | 'ask' | 'deepAnalysis'
    | 'polling' | 'awaitingData' | 'notAssessed' | 'noVerifiedEvidence'
    | 'localeFallback' | 'close' | 'emptyIsResult' | 'zeroAiNavigation'
    | 'showProvenance' | 'developerDetail', string>>;

  readonly subjectTypes: Readonly<Record<PoliticsSubjectType, string>>;
  readonly eventKinds: Readonly<Record<PoliticsEventKind, string>>;
  readonly confidence: Readonly<Record<PoliticsConfidence, string>>;
  readonly epistemic: Readonly<Record<PoliticsEpistemicState, string>>;
  readonly pollFields: Readonly<Record<PoliticsPollField, string>>;
}

const en: PolStrings = {
  domain: 'Politics',
  metaTitle: 'Politics Intelligence — GlobalNews AI',
  metaDescription: 'Documented political developments, institutional actions and policy process, with every source and limitation stated.',

  zones: {
    HEADER: 'Political state',
    ATTENTION: 'Attention',
    SUBSTRATE: 'Political developments',
    CONTEXT: 'Context',
  },

  labels: {
    jurisdiction: 'Jurisdiction',
    assessment: 'Assessment',
    confidence: 'Confidence',
    lastReassessment: 'Last reassessment',
    /*
      §8 MAKES THESE TWO FIRST-CLASS, AND THEY ARE NOT THE SAME FACT.

      `PRECISION` is the precision a figure actually carries. `PRECISION CEILING` is the
      finest precision this deployment may ever show for that jurisdiction. The spec draws
      the distinction with two worked examples — `PRECISION · CONSTITUENCY` where
      authoritative geometry exists, `PRECISION CEILING · COUNTY` where it does not — and
      calls missing precision something to make *"honest and visible, never filled"*.
    */
    precision: 'Precision',
    precisionCeiling: 'Precision ceiling',
    changeState: 'Change state',
    lifecycleEvent: 'Lifecycle event',
    subjectType: 'Subject type',
    evidence: 'Evidence',
    stage: 'Stage',
    actors: 'Actors',
    crossDomain: 'Cross-domain references',
    sourceClass: 'Source class',
    timeline: 'Timeline',
    watch: 'Watch',
    ask: 'Ask AI',
    deepAnalysis: 'Deep analysis',
    polling: 'Polling',

    /*
      THE THREE UNAVAILABLE WORDS, AND WHY THERE ARE THREE RATHER THAN ONE.

      The activation offers `Awaiting verified data`, `Not assessed` and `No verified
      evidence` and then says why they may not be merged: *"do not collapse materially
      different states if Part VIII distinguishes them."*

        awaitingData       nothing is connected that could supply this yet
        notAssessed        a subject exists and GlobalNewsAI has formed no assessment
        noVerifiedEvidence evidence was looked for and none met the verification bar

      On the protest region the difference is the whole point. `Not assessed` is true;
      "no unrest" would be an assessment nobody made, and the activation forbids exactly
      that inference.
    */
    awaitingData: 'Awaiting verified data',
    notAssessed: 'Not assessed',
    noVerifiedEvidence: 'No verified evidence',

    localeFallback: 'Politics copy is not yet authored in this language. Showing English.',
    close: 'Close',
    /* The shared attention queue's own semantics: an empty queue is a RESULT. */
    emptyIsResult: 'Nothing currently meets the attention threshold. This is a result, not an error.',
    /* §9. Stated on the frame because a reader deciding whether to click deserves it. */
    zeroAiNavigation: 'Browsing costs no AI. Analysis states its cost first.',
    showProvenance: 'Where this came from',
    developerDetail: 'Readiness detail',
  },

  subjectTypes: {
    ELECTION: 'Election',
    LEGISLATIVE_SUBJECT: 'Legislative subject',
    PROTEST_CAMPAIGN: 'Protest / mobilisation campaign',
  },

  eventKinds: {
    VOTE: 'Vote',
    RESIGNATION: 'Resignation',
    APPOINTMENT: 'Appointment',
    COURT_RULING: 'Court ruling',
    COALITION_AGREEMENT: 'Coalition agreement',
    COMMISSION_DECISION: 'Commission decision',
    RALLY: 'Rally',
  },

  confidence: { LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' },

  epistemic: {
    CONFIRMED_FACT: 'Confirmed fact',
    OFFICIAL_POSITION: 'Official position',
    POLITICAL_CLAIM: 'Political claim',
    ALLEGATION: 'Allegation',
    INDEPENDENT_ASSESSMENT: 'Independent assessment',
    DISPUTED_READING: 'Disputed reading',
    UNVERIFIED_REPORT: 'Unverified report',
  },

  pollFields: {
    POLLSTER: 'Pollster',
    FIELD_DATES: 'Field dates',
    SAMPLE_SIZE: 'Sample size',
    METHODOLOGY: 'Methodology',
    GEOGRAPHY: 'Geography',
    MARGIN_OF_ERROR: 'Margin of error',
    SPONSOR: 'Sponsor',
    FRESHNESS: 'Freshness',
    OFFICIAL_STATUS: 'Official status',
    SINGLE_POLL_VS_TREND: 'Single poll or trend',
  },
};

const POL_CATALOGUE: Partial<Record<PolLocale, PolStrings>> = { en };

export interface PolStringsResolution {
  readonly strings: PolStrings;
  readonly requested: PolLocale;
  readonly resolved: PolLocale;
  readonly fellBack: boolean;
}

/** Resolution with the fallback made visible, never silent. */
export function resolvePolStrings(locale: PolLocale): PolStringsResolution {
  const found = POL_CATALOGUE[locale];
  if (found) return { strings: found, requested: locale, resolved: locale, fellBack: false };
  return { strings: en, requested: locale, resolved: 'en', fellBack: true };
}

/** The value accessor every component uses. One fallback decision, defined above. */
export function polStrings(locale: PolLocale): PolStrings {
  return resolvePolStrings(locale).strings;
}

/** Contracted locales with no authored Politics content yet. Reported, not hidden. */
export function polLocalesAwaitingContent(locales: readonly PolLocale[]): PolLocale[] {
  return locales.filter((l) => POL_CATALOGUE[l] === undefined);
}
