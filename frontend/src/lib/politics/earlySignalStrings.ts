import type { PolLocale } from './politicsStrings';

/**
 * MASTER CTO R66 · #90 — copy for the Politics early-signal panel (contract `politics-early-signal/v1`).
 *
 * Every engine code (wordingCode, mechanismCode, conditionCode, …) is a KEY, never display text. A code with
 * no entry here renders as "not described yet", never as the raw code. Wording follows the contract's
 * render / never-render table (10-FE-CONTRACT-FOR-MAIN.md): no "confirmed", "verified", "breaking", "new
 * signal", "nothing happened", "all quiet", "up to date", no percentages, no countdown, no monitoring claim.
 *
 * Plan B, as the rest of Politics: EN and PL are authored; other locales fall back to EN and the panel
 * discloses it. PL is a Claude Code draft pending Claude L.
 */
export interface EarlySignalStrings {
  readonly title: string;
  readonly preview: string;
  /** Public read state (no route exists; DISABLED until E1 + release gates). */
  readonly disabled: string;
  readonly disabledReasons: Readonly<Record<'RELEASE_GATES_NOT_MET', string>>;
  readonly refused: string;
  readonly noGovernedSource: string;
  readonly lastChecked: (time: string) => string;
  readonly notCheckedYet: string;
  readonly lastAttempt: (time: string, outcome: string) => string;
  readonly access: Readonly<Record<string, string>>;
  readonly absence: Readonly<Record<string, string>>;
  readonly withheld: (n: number) => string;
  readonly withheldReasons: Readonly<Record<string, string>>;
  readonly attributed: (source: string) => string;
  readonly corroborated: (n: number) => string;
  readonly unestablished: (n: number) => string;
  readonly change: Readonly<Record<'NEW_EVIDENCE' | 'NO_MATERIAL_CHANGE', (since: string) => string>>;
  readonly corrected: string;
  readonly retracted: string;
  readonly requiresHumanReview: string;
  readonly disputedTitle: string;
  readonly placeReported: (place: string) => string;
  readonly placeObserved: (place: string) => string;
  readonly placeNotEstablished: string;
  readonly precision: Readonly<Record<string, string>>;
  readonly regionalReview: Readonly<Record<string, string>>;
  readonly times: Readonly<Record<'published' | 'firstSeen' | 'event', string>>;
  readonly notEstablished: string;
  readonly impactTitle: string;
  readonly evidenceClass: Readonly<Record<string, string>>;
  readonly domain: Readonly<Record<string, string>>;
  readonly horizon: Readonly<Record<string, string>>;
  readonly competing: string;
  readonly disconfirmers: string;
  readonly nextCheck: (after: string, condition: string) => string;
  readonly nextCheckNoTime: (condition: string) => string;
  readonly history: string;
  readonly claimStatus: Readonly<Record<string, string>>;
  readonly predicate: Readonly<Record<string, string>>;
  readonly codes: Readonly<Record<string, string>>;
  readonly notDescribed: string;
  readonly localeFallback: string;
  /** Shown when the impact descriptions below are still in English for this locale (pending Claude L). */
  readonly codesInEnglishNote: string | null;
}

const en: EarlySignalStrings = {
  title: 'Early signals',
  preview: 'Development preview · synthetic data · never shown to readers',
  disabled: 'Early signals are not available yet.',
  disabledReasons: {
    RELEASE_GATES_NOT_MET: 'No source is cleared for this use, and the release checks have not been completed.',
  },
  refused: 'This view can only show reviewed, rights-cleared reporting.',
  noGovernedSource: 'Nothing has been checked: no governed source is cleared for early signals.',
  lastChecked: (t) => `Last checked ${t}`,
  notCheckedYet: 'Not checked yet',
  lastAttempt: (t, o) => `Last attempt ${t}: ${o}`,
  access: {
    COMPLETED_MATCH: 'completed, reports found',
    COMPLETED_NO_MATCH: 'completed, no matching reports',
    PARTIAL: 'some sources could not be checked',
    PROVIDER_FAILED: 'could not be completed',
    RIGHTS_WITHHELD: 'reports found but not available to us',
    SEARCH_NOT_RUN: 'not run',
  },
  absence: {
    SEARCH_COMPLETED_NO_MATCHING_REPORTS: 'The check completed and found no matching reports. This is not a statement that nothing happened.',
    SOURCE_WORDING_NOT_AVAILABLE_TO_US: 'Reports were found, but their wording is not available to us under current source rights.',
    NO_SEARCH_HAS_RUN: 'No check has run, so nothing can be said yet.',
    SEARCH_COULD_NOT_BE_COMPLETED: 'The latest check could not be completed. What was known at the last completed check is unchanged.',
    SEARCH_INCOMPLETE_SOME_SOURCES_UNAVAILABLE: 'The check was incomplete: some sources could not be reached.',
    RESULTS_FOUND: 'Reports were found.',
  },
  withheld: (n) => `${n} item${n === 1 ? '' : 's'} not available to us`,
  withheldReasons: {
    RIGHTS_NOT_CLEARED: 'source rights not cleared',
    UNKNOWN_PROVENANCE: 'origin not established',
    DERIVATIVE_ARTEFACT_REFUSED: 'screenshot or repost, not the original',
  },
  attributed: (s) => `${s} reports`,
  corroborated: (n) => `Reported by ${n} independent source${n === 1 ? '' : 's'}`,
  unestablished: (n) => `${n} item${n === 1 ? '' : 's'} whose independence is not established`,
  change: {
    NEW_EVIDENCE: () => 'New evidence seen',
    NO_MATERIAL_CHANGE: (since) => `No material change since ${since}`,
  },
  corrected: 'Corrected by source',
  retracted: 'Retracted by source',
  requiresHumanReview: 'Needs human review before any wider use',
  disputedTitle: 'Accounts differ (human-reviewed)',
  placeReported: (p) => `reported as ${p}`,
  placeObserved: (p) => p,
  placeNotEstablished: 'location not established',
  precision: {
    COUNTRY: 'country level',
    ADMIN1: 'province or state level',
    LOCALITY: 'town or locality',
    FACILITY: 'specific site',
    NOT_ESTABLISHED: 'precision not established',
  },
  regionalReview: {
    EA_VALIDATOR_REVIEW_PENDING: 'East Africa review pending',
    REVIEWER_UNBOUND: 'no regional reviewer assigned',
    NOT_APPLICABLE: '',
  },
  times: { published: 'Published', firstSeen: 'First seen by us', event: 'Event time' },
  notEstablished: 'not established',
  impactTitle: 'Possible impact',
  evidenceClass: {
    OBSERVED_EFFECT: 'An effect is reported by independent sources',
    SUGGESTS_RISK_ONLY: 'Possible effect only: reported, not observed',
    NO_CHANGE_NOTICE: 'A notice says nothing changed',
    INSUFFICIENT: 'Not enough to assess impact',
  },
  domain: {
    PEOPLE: 'People',
    TRANSPORT: 'Transport',
    TRADE: 'Trade',
    JOBS: 'Jobs',
    HUMANITARIAN_ACCESS: 'Humanitarian access',
    SERVICES: 'Services',
  },
  horizon: { OBSERVED_NOW: 'reported now', UNSPECIFIED: 'timing not specified' },
  competing: 'Other explanations',
  disconfirmers: 'What would show this is wrong',
  nextCheck: (after, c) => `Worth re-checking after ${after} for ${c}`,
  nextCheckNoTime: (c) => `Worth re-checking for ${c}`,
  history: 'History',
  claimStatus: {
    CURRENT: 'current',
    SUPERSEDED_BY_UPDATE: 'updated later',
    CORRECTED: 'corrected',
    RETRACTED: 'retracted',
  },
  predicate: {
    CASUALTIES_REPORTED: 'casualties reported',
    ARMED_CLASH_REPORTED: 'armed clash reported',
    FACILITY_CLOSED: 'facility closed',
    ROUTE_DISRUPTED: 'route disrupted',
    COALITION_ANNOUNCED: 'coalition announced',
    OUTBREAK_DECLARED: 'outbreak declared',
    OUTBREAK_ENDED: 'outbreak declared over',
    CONNECTIVITY_DISRUPTED: 'connectivity disrupted',
    CURFEW_DECLARED: 'curfew declared',
    POLICY_RATE_DECISION: 'policy rate decision',
    PRICE_REVIEW_UNCHANGED: 'price review, unchanged',
    PROTEST_HELD: 'protest held',
    LEGISLATIVE_STAGE: 'legislative stage',
  },
  codes: {
    /* mechanisms */
    VIOLENCE_EXPOSURE_OF_RESIDENTS: 'residents exposed to violence',
    SECURITY_CONSTRAINT_ON_ACCESS: 'insecurity limits aid access',
    DISPLACEMENT_PRESSURE: 'pressure on people to leave their homes',
    ROAD_OR_CROSSING_INSECURITY: 'roads or crossings become unsafe',
    FACILITY_UNAVAILABLE: 'the facility cannot be used',
    RELIEF_ROUTE_INTERRUPTED: 'a relief route is interrupted',
    CARGO_DIVERSION_OR_DELAY: 'cargo is diverted or delayed',
    PASSENGER_OR_FREIGHT_ROUTE_INTERRUPTED: 'a passenger or freight route is interrupted',
    POLITICAL_PROCESS_DISRUPTION: 'a political process is disrupted',
    HEALTH_SERVICE_LOAD_AND_MOVEMENT_CONTROLS: 'health services under load and movement controls',
    INFECTION_EXPOSURE_IN_AFFECTED_ZONE: 'infection exposure in the affected area',
    CONTROLS_LIFTED: 'controls are lifted',
    COMMUNICATION_AND_PAYMENT_INTERRUPTION: 'communications and payments interrupted',
    DIGITAL_WORK_AND_TRADE_INTERRUPTED: 'online work and trade interrupted',
    WORKING_HOURS_RESTRICTED: 'working hours restricted',
    MOVEMENT_RESTRICTED: 'movement restricted',
    FINANCING_COST_CHANGE: 'borrowing costs change',
    LOCAL_SERVICE_DISRUPTION: 'local services disrupted',
    /* competing explanations */
    ISOLATED_INCIDENT: 'an isolated incident',
    DIFFERENT_INCIDENT_OR_DATE: 'a different incident or date',
    ACCESS_UNCHANGED: 'access is unchanged',
    SHORT_LIVED_CLASH: 'a short-lived clash',
    ROUTES_UNAFFECTED: 'routes are unaffected',
    PARTIAL_OR_BRIEF_CLOSURE: 'a partial or brief closure',
    ALTERNATIVE_ROUTE_IN_USE: 'an alternative route is in use',
    CARRIERS_ABSORB_DELAY: 'carriers absorb the delay',
    LOCALISED_DELAY: 'a localised delay',
    TALKS_CONTINUE_UNCHANGED: 'talks continue unchanged',
    ANNOUNCEMENT_WITHOUT_OPERATIONAL_CHANGE: 'an announcement with no practical change',
    CONTAINED_CLUSTER: 'a contained cluster',
    NO_FURTHER_CASES: 'no further cases',
    RESURGENCE_RISK_STATED_BY_AUTHORITY: 'the authority states a risk of return',
    REGIONAL_OUTAGE_ONLY: 'a regional outage only',
    SHORT_INTERRUPTION: 'a short interruption',
    EXEMPTIONS_FOR_ESSENTIAL_WORK: 'essential work is exempt',
    LIMITED_ENFORCEMENT: 'limited enforcement',
    RATE_HELD_NO_TRANSMISSION: 'no effect reaches lending rates',
    PEACEFUL_ONE_DAY_EVENT: 'a peaceful one-day event',
    /* disconfirmers */
    OFFICIAL_OR_LOCAL_DENIAL_WITH_EVIDENCE: 'an official or local denial with evidence',
    INCIDENT_PLACE_DIFFERENT: 'the incident happened elsewhere',
    HUMANITARIAN_ACCESS_NOTICE_UNCHANGED: 'a humanitarian notice says access is unchanged',
    NO_DISPLACEMENT_REPORTED_BY_HUMANITARIAN_BODY: 'a humanitarian body reports no displacement',
    OPERATOR_NOTICE_NORMAL_SERVICE: 'an operator notice of normal service',
    REOPENING_NOTICE: 'a reopening notice',
    LOGISTICS_CLUSTER_REPORTS_NORMAL_FLOW: 'logistics reports of normal flow',
    SERVICE_RESUMPTION_NOTICE: 'a notice that service resumed',
    ROUTE_REOPENED_NOTICE: 'a notice that the route reopened',
    MEDIATOR_CONFIRMS_PROCESS_CONTINUES: 'a mediator confirming the process continues',
    RETRACTION_OR_DENIAL_BY_NAMED_PARTIES: 'a retraction or denial by the named parties',
    END_OF_OUTBREAK_DECLARATION: 'a declaration that the outbreak ended',
    ZERO_NEW_CASES_REPORTED_BY_AUTHORITY: 'the authority reporting no new cases',
    NEW_CASE_DECLARED: 'a new case being declared',
    RESTORATION_MEASURED_OR_ANNOUNCED: 'restoration measured or announced',
    RESTORATION_NOTICE: 'a restoration notice',
    CURFEW_LIFTED_NOTICE: 'a notice that the curfew was lifted',
    COMMERCIAL_LENDING_RATES_UNCHANGED: 'commercial lending rates unchanged',
    AUTHORITY_REPORTS_NORMAL_OPERATIONS: 'the authority reporting normal operations',
    /* next-check conditions */
    LOCAL_OR_OFFICIAL_REPORT_NAMING_THE_PLACE: 'a local or official report naming the place',
    HUMANITARIAN_ACCESS_NOTICE_FOR_THE_AREA: 'a humanitarian access notice for the area',
    DISPLACEMENT_FIGURE_FROM_HUMANITARIAN_BODY: 'a displacement figure from a humanitarian body',
    BORDER_OR_ROUTE_OPERATOR_NOTICE: 'a border or route operator notice',
    OPERATOR_OR_AUTHORITY_REOPENING_NOTICE: 'an operator or authority reopening notice',
    LOGISTICS_OR_HUMANITARIAN_NOTICE: 'a logistics or humanitarian notice',
    CARRIER_OR_PORT_NOTICE: 'a carrier or port notice',
    OPERATOR_NOTICE: 'an operator notice',
    MEDIATOR_OR_GOVERNMENT_STATEMENT_ON_TALKS: 'a mediator or government statement on the talks',
    MINISTRY_OR_WHO_SITUATION_UPDATE: 'a ministry or WHO situation update',
    CASE_COUNT_UPDATE_FROM_AUTHORITY: 'a case-count update from the authority',
    AUTHORITY_SURVEILLANCE_UPDATE: 'an authority surveillance update',
    RESTORATION_NOTICE_OR_MEASUREMENT: 'a restoration notice or measurement',
    AUTHORITY_CURFEW_NOTICE: 'an authority curfew notice',
    NEXT_CENTRAL_BANK_PUBLICATION: 'the next central bank publication',
    AUTHORITY_OR_ORGANISER_STATEMENT: 'an authority or organiser statement',
  },
  notDescribed: 'not described yet',
  localeFallback: 'Early signals are shown in English until this language is reviewed.',
  codesInEnglishNote: null,
};

const pl: EarlySignalStrings = {
  ...en,
  title: 'Wczesne sygnały',
  preview: 'Podgląd deweloperski · dane syntetyczne · nigdy nie pokazywane czytelnikom',
  disabled: 'Wczesne sygnały nie są jeszcze dostępne.',
  disabledReasons: {
    RELEASE_GATES_NOT_MET: 'Żadne źródło nie jest dopuszczone do tego użycia, a kontrole wydania nie zostały zakończone.',
  },
  refused: 'Ten widok może pokazywać wyłącznie sprawdzone doniesienia z potwierdzonymi prawami.',
  noGovernedSource: 'Niczego nie sprawdzono: żadne nadzorowane źródło nie jest dopuszczone do wczesnych sygnałów.',
  lastChecked: (t) => `Ostatnio sprawdzono ${t}`,
  notCheckedYet: 'Jeszcze nie sprawdzono',
  lastAttempt: (t, o) => `Ostatnia próba ${t}: ${o}`,
  access: {
    COMPLETED_MATCH: 'zakończona, znaleziono doniesienia',
    COMPLETED_NO_MATCH: 'zakończona, brak pasujących doniesień',
    PARTIAL: 'części źródeł nie udało się sprawdzić',
    PROVIDER_FAILED: 'nie udało się zakończyć',
    RIGHTS_WITHHELD: 'znaleziono doniesienia, ale nie są dla nas dostępne',
    SEARCH_NOT_RUN: 'nie uruchomiono',
  },
  absence: {
    SEARCH_COMPLETED_NO_MATCHING_REPORTS: 'Sprawdzenie zakończyło się bez pasujących doniesień. Nie oznacza to, że nic się nie wydarzyło.',
    SOURCE_WORDING_NOT_AVAILABLE_TO_US: 'Znaleziono doniesienia, ale ich treść nie jest dla nas dostępna przy obecnych prawach do źródeł.',
    NO_SEARCH_HAS_RUN: 'Nie przeprowadzono sprawdzenia, więc nie można jeszcze nic powiedzieć.',
    SEARCH_COULD_NOT_BE_COMPLETED: 'Ostatniego sprawdzenia nie udało się zakończyć. Stan z ostatniego zakończonego sprawdzenia pozostaje bez zmian.',
    SEARCH_INCOMPLETE_SOME_SOURCES_UNAVAILABLE: 'Sprawdzenie było niepełne: części źródeł nie udało się osiągnąć.',
    RESULTS_FOUND: 'Znaleziono doniesienia.',
  },
  withheld: (n) => `Niedostępne dla nas pozycje: ${n}`,
  withheldReasons: {
    RIGHTS_NOT_CLEARED: 'prawa do źródła niepotwierdzone',
    UNKNOWN_PROVENANCE: 'pochodzenie nieustalone',
    DERIVATIVE_ARTEFACT_REFUSED: 'zrzut ekranu lub repost, nie oryginał',
  },
  attributed: (s) => `${s} podaje`,
  corroborated: (n) => `Podają niezależne źródła: ${n}`,
  unestablished: (n) => `Pozycje o nieustalonej niezależności: ${n}`,
  change: {
    NEW_EVIDENCE: () => 'Pojawiły się nowe dowody',
    NO_MATERIAL_CHANGE: (since) => `Brak istotnej zmiany od ${since}`,
  },
  corrected: 'Sprostowane przez źródło',
  retracted: 'Wycofane przez źródło',
  requiresHumanReview: 'Wymaga przeglądu przez człowieka przed szerszym użyciem',
  disputedTitle: 'Relacje się różnią (przegląd przez człowieka)',
  placeReported: (p) => `podawane jako ${p}`,
  placeNotEstablished: 'miejsce nieustalone',
  precision: {
    COUNTRY: 'poziom kraju',
    ADMIN1: 'poziom regionu',
    LOCALITY: 'miejscowość',
    FACILITY: 'konkretne miejsce',
    NOT_ESTABLISHED: 'dokładność nieustalona',
  },
  regionalReview: {
    EA_VALIDATOR_REVIEW_PENDING: 'oczekuje na przegląd Afryki Wschodniej',
    REVIEWER_UNBOUND: 'brak przypisanego recenzenta regionalnego',
    NOT_APPLICABLE: '',
  },
  times: { published: 'Opublikowano', firstSeen: 'Po raz pierwszy zauważone przez nas', event: 'Czas zdarzenia' },
  notEstablished: 'nieustalony',
  impactTitle: 'Możliwy wpływ',
  evidenceClass: {
    OBSERVED_EFFECT: 'Skutek podają niezależne źródła',
    SUGGESTS_RISK_ONLY: 'Tylko możliwy skutek: podany, nie zaobserwowany',
    NO_CHANGE_NOTICE: 'Komunikat mówi, że nic się nie zmieniło',
    INSUFFICIENT: 'Za mało, by ocenić wpływ',
  },
  domain: {
    PEOPLE: 'Ludzie',
    TRANSPORT: 'Transport',
    TRADE: 'Handel',
    JOBS: 'Praca',
    HUMANITARIAN_ACCESS: 'Dostęp humanitarny',
    SERVICES: 'Usługi',
  },
  horizon: { OBSERVED_NOW: 'podawane teraz', UNSPECIFIED: 'czas nieokreślony' },
  competing: 'Inne wyjaśnienia',
  disconfirmers: 'Co pokazałoby, że to nieprawda',
  nextCheck: (after, c) => `Warto sprawdzić ponownie po ${after}: ${c}`,
  nextCheckNoTime: (c) => `Warto sprawdzić ponownie: ${c}`,
  history: 'Historia',
  claimStatus: { CURRENT: 'aktualne', SUPERSEDED_BY_UPDATE: 'zaktualizowane później', CORRECTED: 'sprostowane', RETRACTED: 'wycofane' },
  notDescribed: 'jeszcze nieopisane',
  localeFallback: 'Wczesne sygnały są pokazywane po angielsku, dopóki ten język nie zostanie sprawdzony.',
  /* the per-code impact descriptions are EN until Claude L: said, never mixed silently */
  codesInEnglishNote: 'Opisy możliwego wpływu i warunków ponownego sprawdzenia są na razie po angielsku.',
};

const CATALOGUE: Partial<Record<PolLocale, EarlySignalStrings>> = { en, pl };

export function resolveEarlySignalStrings(locale: PolLocale): { readonly strings: EarlySignalStrings; readonly fellBack: boolean } {
  const found = CATALOGUE[locale];
  return found ? { strings: found, fellBack: false } : { strings: en, fellBack: true };
}

/** A code is always shown as words; an unknown code is "not described yet", never the raw key. */
export function esCode(s: EarlySignalStrings, code: string): string {
  return s.codes[code] ?? s.notDescribed;
}
