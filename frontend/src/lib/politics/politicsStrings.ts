import type { DisplayLocale, RetainedPoliticsClaim } from '@globalnews-ai/shared';
import type {
  PoliticsConfidence, PoliticsEpistemicState, PoliticsEventKind,
  PoliticsPollField, PoliticsSubjectType,
} from './politicsDomain';

/** Plan B: existing copy slots in EN/PL. Epistemic states remain distinct; other locales disclose fallback. */
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
    | 'showProvenance' | 'developerDetail' | 'retainedEvidence' | 'retainedSubjectsAvailable'
    | 'openSource' | 'sourceType' | 'evidenceRole' | 'publisher' | 'publishedAt'
    | 'retrievedAt' | 'subject', string>>;

  readonly subjectTypes: Readonly<Record<PoliticsSubjectType, string>>;
  readonly observationKinds: Readonly<Record<RetainedPoliticsClaim['kind'], string>>;
  readonly stages: Readonly<Record<RetainedPoliticsClaim['stage'], string>>;
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
    emptyIsResult: 'No governed evidence is retained in this preview. This does not mean nothing happened. Jurisdiction, subject and source classes remain unassessed.',
    /* §9. Stated on the frame because a reader deciding whether to click deserves it. */
    zeroAiNavigation: 'Browsing costs no AI. Analysis states its cost first.',
    showProvenance: 'Where this came from',
    developerDetail: 'Readiness detail',
    retainedEvidence: 'Retained evidence',
    retainedSubjectsAvailable: 'Retained political subjects are available in the primary substrate. No shared attention ranking has been issued.',
    openSource: 'Open source',
    sourceType: 'Source type',
    evidenceRole: 'Evidence role',
    publisher: 'Publisher / provider',
    publishedAt: 'Published',
    retrievedAt: 'Retrieved',
    subject: 'Subject',
  },

  subjectTypes: {
    ELECTION: 'Election',
    LEGISLATIVE_SUBJECT: 'Legislative subject',
    PROTEST_CAMPAIGN: 'Protest / mobilisation campaign',
  },

  observationKinds: {
    ELECTION_PROCESS_NOTICE: 'Election process notice',
    LEGISLATIVE_STAGE: 'Legislative stage',
    PROTEST_HELD: 'Protest held',
  },

  stages: {
    ANNOUNCED: 'Announced',
    HELD: 'Held',
    INTRODUCED: 'Introduced',
    AMENDED: 'Amended',
    PASSED: 'Passed',
    REJECTED: 'Rejected',
    VETOED: 'Vetoed',
    SIGNED: 'Signed',
    IMPLEMENTED: 'Implemented',
    WITHDRAWN: 'Withdrawn',
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

const pl: PolStrings = {
  domain: 'Polityka',
  metaTitle: 'Analiza polityczna — GlobalNews AI',
  metaDescription: 'Udokumentowane wydarzenia polityczne, działania instytucji i procesy polityczne wraz ze źródłami i ograniczeniami.',
  zones: { HEADER: 'Stan polityczny', ATTENTION: 'Uwaga', SUBSTRATE: 'Wydarzenia polityczne', CONTEXT: 'Kontekst' },
  labels: {
    jurisdiction: 'Jurysdykcja', assessment: 'Ocena', confidence: 'Pewność oceny',
    lastReassessment: 'Ostatnia ponowna ocena', precision: 'Dokładność', precisionCeiling: 'Limit dokładności',
    changeState: 'Stan zmiany', lifecycleEvent: 'Zdarzenie w cyklu', subjectType: 'Typ tematu',
    evidence: 'Dowody', stage: 'Etap', actors: 'Podmioty', crossDomain: 'Odniesienia między dziedzinami',
    sourceClass: 'Klasa źródła', timeline: 'Oś czasu', watch: 'Obserwuj', ask: 'Zapytaj AI',
    deepAnalysis: 'Pogłębiona analiza', polling: 'Sondaże', awaitingData: 'Oczekiwanie na zweryfikowane dane',
    notAssessed: 'Nie oceniono', noVerifiedEvidence: 'Brak zweryfikowanych dowodów',
    localeFallback: 'Treść polityczna nie jest dostępna w tym języku. Wyświetlono wersję angielską.',
    close: 'Zamknij',
    emptyIsResult: 'W tym podglądzie nie ma zachowanych dowodów dopuszczonych zgodnie z zasadami. Nie oznacza to, że nic się nie wydarzyło. Jurysdykcja, temat i klasy źródeł pozostają nieocenione.',
    zeroAiNavigation: 'Przeglądanie nie używa AI. Koszt analizy jest podany przed jej uruchomieniem.',
    showProvenance: 'Pochodzenie danych', developerDetail: 'Szczegóły gotowości',
    retainedEvidence: 'Zachowane dowody',
    retainedSubjectsAvailable: 'Zachowane tematy polityczne są dostępne w głównym obszarze. Nie wydano wspólnego rankingu uwagi.',
    openSource: 'Otwórz źródło',
    sourceType: 'Typ źródła',
    evidenceRole: 'Rola dowodowa',
    publisher: 'Wydawca / dostawca',
    publishedAt: 'Opublikowano',
    retrievedAt: 'Pobrano',
    subject: 'Temat',
  },
  subjectTypes: { ELECTION: 'Wybory', LEGISLATIVE_SUBJECT: 'Temat legislacyjny', PROTEST_CAMPAIGN: 'Protest / kampania mobilizacyjna' },
  observationKinds: {
    ELECTION_PROCESS_NOTICE: 'Informacja o procesie wyborczym',
    LEGISLATIVE_STAGE: 'Etap procesu legislacyjnego',
    PROTEST_HELD: 'Odbyty protest',
  },
  stages: {
    ANNOUNCED: 'Ogłoszono',
    HELD: 'Odbyto',
    INTRODUCED: 'Wniesiono',
    AMENDED: 'Zmieniono',
    PASSED: 'Przyjęto',
    REJECTED: 'Odrzucono',
    VETOED: 'Zawetowano',
    SIGNED: 'Podpisano',
    IMPLEMENTED: 'Wdrożono',
    WITHDRAWN: 'Wycofano',
  },
  eventKinds: { VOTE: 'Głosowanie', RESIGNATION: 'Rezygnacja', APPOINTMENT: 'Powołanie', COURT_RULING: 'Orzeczenie sądu', COALITION_AGREEMENT: 'Umowa koalicyjna', COMMISSION_DECISION: 'Decyzja komisji', RALLY: 'Wiec' },
  confidence: { LOW: 'Niska', MODERATE: 'Umiarkowana', HIGH: 'Wysoka' },
  epistemic: {
    CONFIRMED_FACT: 'Potwierdzony fakt', OFFICIAL_POSITION: 'Oficjalne stanowisko',
    POLITICAL_CLAIM: 'Twierdzenie polityczne', ALLEGATION: 'Zarzut',
    INDEPENDENT_ASSESSMENT: 'Niezależna ocena', DISPUTED_READING: 'Sporny odczyt', UNVERIFIED_REPORT: 'Niezweryfikowana relacja',
  },
  pollFields: {
    POLLSTER: 'Pracownia badawcza', FIELD_DATES: 'Termin badania', SAMPLE_SIZE: 'Wielkość próby',
    METHODOLOGY: 'Metodologia', GEOGRAPHY: 'Obszar', MARGIN_OF_ERROR: 'Margines błędu',
    SPONSOR: 'Zleceniodawca', FRESHNESS: 'Aktualność', OFFICIAL_STATUS: 'Status oficjalny', SINGLE_POLL_VS_TREND: 'Pojedynczy sondaż czy trend',
  },
};

const POL_CATALOGUE: Partial<Record<PolLocale, PolStrings>> = { en, pl };

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
