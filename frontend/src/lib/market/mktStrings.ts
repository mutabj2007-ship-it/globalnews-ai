import type { DisplayLocale } from '@globalnews-ai/shared';

/**
 * PART VII · MARKET — DOMAIN-LOCAL COPY, on the accepted Economy pattern.
 * Resolution makes the fallback VISIBLE; nothing falls back silently.
 */
export type MktLocale = DisplayLocale;

export interface MktStrings {
  readonly domain: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly sections: Readonly<Record<'READINESS' | 'SUBJECTS' | 'PROCUREMENT' | 'ENTITY', string>>;
  readonly drawers: Readonly<Record<'READINESS_DETAIL' | 'SUBJECT_DETAIL' | 'ANALYSIS', string>>;
  readonly absence: Readonly<Record<
    'NO_QUALIFIED_SOURCE' | 'NO_ACTIVE_PROVIDER' | 'NOT_RUNTIME_ENABLED' | 'NO_DETERMINISTIC_JOIN'
    | 'NO_ROUTE_GEOMETRY' | 'AWAITING_SHARED_CONTRACT' | 'STATE_NOT_DERIVABLE' | 'NO_VINTAGE_PUBLISHED', string>>;
  readonly subjects: Readonly<Record<string, string>>;
  readonly labels: Readonly<Record<
    'measured' | 'ready' | 'notReady' | 'observationBody' | 'observationBadgeHeld'
    | 'observationBadgeZero' | 'dependency' | 'close'
    | 'sourceReadiness' | 'contractSays' | 'noScorer' | 'changeCeiling' | 'localeFallback'
    | 'degradedDefault' | 'analysisUnavailable' | 'watchUnavailable' | 'noData', string>>;

  /**
   * THE READER GROUP — Part VII's reader-facing copy, added for the Alpha visual surface.
   *
   * A SEPARATE group rather than more `labels`, because every leaf here is copy a READER
   * sees about the market, while `labels` is copy about the platform. Keeping the two
   * apart is what lets the capability detail keep its engineering register while the
   * primary surface loses it.
   */
  readonly reader: Readonly<Record<
    'headline' | 'headlineNone' | 'observations'
    | 'seriesIdentifier' | 'seriesNameNotCarried' | 'value' | 'unit' | 'period'
    | 'vintage' | 'vintagePublisher' | 'vintageChanged' | 'vintageNone'
    | 'freshness' | 'source' | 'sourceClass' | 'provisionalRetention'
    | 'capability' | 'capabilityRights' | 'capabilityActivation' | 'capabilityNone'
    | 'providerNotActivated'
    | 'readNoEndpoint' | 'readNoActivatedProvider' | 'readNoObservation' | 'readNoDisplayable'
    | 'showCapability' | 'showProvenance'
    | 'awaitingData' | 'coverage' | 'change' | 'readinessControl', string>>;

  /**
   * READINESS LABELS — lifted out of the two screens.
   *
   * These were an inline `READY_LABELS` map declared inside `MarketScreen` AND a second
   * copy inside `MarketCompactScreen`: hardcoded English in a localized surface, twice,
   * so a correction to one silently disagreed with the other. One definition, in the
   * catalogue, where a translator can reach it.
   */
  readonly readiness: Readonly<Record<
    'equityOrIndex' | 'runtimeSubjects' | 'routeGeometry' | 'procurementCompanyJoin'
    | 'gleifSector' | 'gleifParent' | 'procurementRefKinds' | 'changeStates', string>>;

  readonly freshness: Readonly<Record<
    'LIVE' | 'DELAYED' | 'LAST_CLOSE' | 'LATEST_PUBLISHED' | 'STALE' | 'UNAVAILABLE', string>>;

  readonly release: Readonly<Record<
    'SCHEDULED' | 'PRELIMINARY' | 'REVISED' | 'FINAL' | 'WITHDRAWN', string>>;
  readonly procurement: Readonly<Record<
    'notice' | 'buyer' | 'country' | 'cpv' | 'noticeType' | 'published' | 'deadline'
    | 'statedValue' | 'openNotice' | 'retainedAt' | 'notStated', string>>;
}

const en: MktStrings = {
  domain: 'Market',
  metaTitle: 'Market Intelligence — GlobalNews AI',
  metaDescription: 'Market subjects, source readiness and what the platform can and cannot yet observe.',
  sections: {
    READINESS: 'Source and data readiness',
    SUBJECTS: 'Market subjects',
    PROCUREMENT: 'Procurement identity',
    ENTITY: 'Commercial entity',
  },
  drawers: {
    READINESS_DETAIL: 'Source and data readiness — measured',
    SUBJECT_DETAIL: 'Subject dispositions',
    ANALYSIS: 'Analysis handoff',
  },
  absence: {
    NO_QUALIFIED_SOURCE: 'No qualified source — no equity or index source meets the official/free requirement',
    NO_ACTIVE_PROVIDER: 'No provider is active for this subject',
    NOT_RUNTIME_ENABLED: 'Not runtime-enabled — the contract lists no enabled subject',
    NO_DETERMINISTIC_JOIN: 'No deterministic join between a procurement record and a company',
    NO_ROUTE_GEOMETRY: 'No route geometry is producible — endpoints only',
    AWAITING_SHARED_CONTRACT: 'Awaiting a shared contract — dependency recorded for Main',
    STATE_NOT_DERIVABLE: 'State not derivable — this is not “no material change”',
    NO_VINTAGE_PUBLISHED: 'No vintage published — a fetch time is not a vintage',
  },
  subjects: {
    INSTRUMENT: 'Instrument', COMMODITY: 'Commodity', SECTOR: 'Sector',
    COMMERCIAL_ENTITY: 'Commercial entity', CORRIDOR: 'Corridor',
    PROCUREMENT_OPPORTUNITY: 'Procurement opportunity',
  },
  labels: {
    measured: 'Measured', ready: 'Ready', notReady: 'Not ready',
    /*
      F M-3, verbatim. It REPLACES the pair "No observation data is connected. No market
      provider is active." rather than sitting beside it — F: the header "should absorb the
      sentence above rather than sit beside a duplicate". The provider fact it dropped is
      not lost: it is the NO_PRODUCER chip, which is where F's own table puts it.
    */
    observationBody:
      'This surface holds no market observations. That describes what we hold — it is not a statement about the market.',
    /*
      F M-1 / M-2. `HELD` rather than `DATA`: "NO OBSERVATION DATA" is true and is one word
      away from being read as *there is no market data* — a claim about the world. HELD puts
      the subject back on us.
    */
    observationBadgeHeld: 'OBSERVATIONS HELD',
    observationBadgeZero: 'NO OBSERVATIONS HELD',
    dependency: 'Dependency recorded for Main',
    close: 'Close',
    sourceReadiness: 'Source readiness',
    contractSays: 'Read from the contract',
    noScorer: 'No score, rank or similarity exists in this domain.',
    changeCeiling: 'Change-state ceiling',
    localeFallback: 'Market copy is not yet authored in this language. Showing English.',
    degradedDefault: 'Degraded state — this is the Beta default, not an error.',
    analysisUnavailable: 'Cost unavailable — cannot invoke',
    watchUnavailable: 'Watch subject types are not registered for this subject.',
    noData: 'No data',
  },
  reader: {
    headline: 'Market observations',
    headlineNone: 'No market observations are held',
    observations: 'Observations',
    seriesIdentifier: 'Series',
    seriesNameNotCarried: 'A published name for this series is not carried by the contract yet.',
    value: 'Value',
    unit: 'Unit',
    period: 'Period',
    vintage: 'Vintage',
    vintagePublisher: 'Published by the source',
    vintageChanged: 'Source recorded a change',
    vintageNone: 'No vintage published',
    freshness: 'Freshness',
    source: 'Source',
    sourceClass: 'Source class',
    provisionalRetention: 'Held against a provisional retention. Not a settled figure.',
    capability: 'Sources and capability',
    capabilityRights: 'Rights permit use',
    capabilityActivation: 'Activated',
    capabilityNone: 'No source is currently active.',
    providerNotActivated: 'Not currently active',
    readNoEndpoint: 'Data not yet available.',
    readNoActivatedProvider: 'Source not currently active.',
    readNoObservation: 'Awaiting verified observation.',
    readNoDisplayable: 'Awaiting a verified unit and source.',
    showCapability: 'Sources and capability',
    showProvenance: 'Where this came from',
    /*
      THE DATA-NEUTRAL VOCABULARY.

      The Product Owner's ruling allows a slot with no figure to read `—` or a restrained
      `Awaiting verified data`, and forbids the register these five replaced: *"no internal
      read is connected", "provider not running", "endpoint not implemented", "rights permit
      use but not activated"*. Those sentences described our implementation. These describe
      AVAILABILITY, which is the only thing a reader can act on, and they are short enough
      that a slot carrying one does not become the loudest thing in its region.

      The engineering register is not deleted — it moved. `absence`, `readiness` and
      `labels.contractSays` still say `Not runtime-enabled — the contract lists no enabled
      subject`, and they still mean it, inside the developer readiness disclosure where a
      lane can read the constant that produced the verdict.
    */
    awaitingData: 'Awaiting verified data',
    coverage: 'Coverage',
    change: 'Change',
    readinessControl: 'Readiness detail',
  },
  readiness: {
    equityOrIndex: 'Equity or index source qualified',
    runtimeSubjects: 'Any Market subject runtime-enabled',
    routeGeometry: 'Corridor route geometry producible',
    procurementCompanyJoin: 'Deterministic procurement-to-company join',
    gleifSector: 'GLEIF supplies a sector code',
    gleifParent: 'GLEIF direct parent carries an LEI',
    procurementRefKinds: 'All procurement reference kinds have a producer',
    changeStates: 'All change states derivable',
  },
  freshness: {
    LIVE: 'Live',
    DELAYED: 'Delayed',
    LAST_CLOSE: 'Last close',
    LATEST_PUBLISHED: 'Latest published',
    STALE: 'Current edition unverified',
    UNAVAILABLE: 'Unavailable',
  },
  release: {
    SCHEDULED: 'Scheduled',
    PRELIMINARY: 'Preliminary',
    REVISED: 'Revised',
    FINAL: 'Final',
    WITHDRAWN: 'Withdrawn',
  },
  procurement: {
    notice: 'Official notice',
    buyer: 'Buyer',
    country: 'Country',
    cpv: 'CPV',
    noticeType: 'Record type',
    published: 'Published',
    deadline: 'Deadline',
    statedValue: 'Stated value',
    openNotice: 'Open source record',
    retainedAt: 'Retained',
    notStated: 'Not stated',
  },
};

/**
 * POLISH — AUTHORED SO FAR, AND DELIBERATELY NOT A CATALOGUE ENTRY.
 *
 * The same `{ ...en, … }` construction as Humanitarian, with the same consequence and a
 * worse one on this surface. 10 leaves of 40 were authored; the spread satisfied the
 * total interface, `pl` registered as complete, `fellBack` stayed false, and no
 * disclosure rendered. Measured: the notice showed 6/6 for fr, de, es, pt, ar and 0/6
 * for pl.
 *
 * WHAT POLISH INHERITED IS THE WHOLE PRODUCT. The overrides cover `domain`, `metaTitle`,
 * `metaDescription`, two section names and five labels. The `absence` group — all eight
 * explanations of why there is no data — was inherited in full, along with the header
 * subtitle "No observation data is connected. No market provider is active."
 *
 * ON A DEGRADED SURFACE THE ABSENCE COPY IS THE PRODUCT. It is the only thing a reader is
 * here to read, and it was the untranslated, undisclosed part. A Polish reader was told,
 * in English and without acknowledgement, that no qualified source meets the
 * official/free requirement.
 *
 * So the draft is held and unregistered — not annotated `MktStrings`, not spreading `en`,
 * so it cannot be re-registered without being completed. Nothing here is translated,
 * extended or reworded in this lane, and per F's sequencing the Polish authoring waits
 * for the observation and absence copy to settle, because both change what a reader sees.
 */
/**
 * POLISH — L'S RATIFIED AUTHORITY, APPLIED; STILL NOT A CATALOGUE ENTRY, AND WHY.
 *
 * `L-HUM-MARKET-PL-CATALOGUE-AUTHORITY-1` is accepted implementation authority and every
 * value below is its wording, unedited — 40/40 against CHECKPOINT 2's interface, replacing
 * the 10-leaf `{ ...en }` draft whose inherited group was `absence`: all eight explanations
 * of why data is missing, which on a degraded surface are the product.
 *
 * F'S RATIFIED ENGLISH MOVED THE INTERFACE. Measured:
 *
 *   interface leaves now : 41
 *   L authored           : 40
 *   RETIRED by F (2)     : labels.noObservation · labels.noProvider
 *   UNFILLED (3)         : labels.observationBody       (F M-3)
 *                          labels.observationBadgeHeld  (F M-1)
 *                          labels.observationBadgeZero  (F M-2)
 *
 * None of the three has a Polish source: they are new English, ratified after L authored.
 * So `pl` stays unregistered and the disclosure renders — F §4 again, and it matters more
 * here than on Humanitarian, because the badge and the body ARE the product on a surface
 * that shows no figures.
 *
 * `NO_PRODUCER` is untouched by all of this: it renders through
 * `economyStrings(locale).gapReason`, the approved seven-locale label, so a Polish reader
 * already sees `Brak producenta danych` whatever this catalogue does. L is explicit that
 * nothing here may duplicate, shadow or re-translate it — a second copy is a second place
 * for it to drift.
 */
export const MKT_PL_DRAFT_AWAITING_COMPLETION = {
  domain: "Rynek",
  metaTitle: "Wywiad rynkowy — GlobalNews AI",
  metaDescription: "Podmioty rynkowe, gotowość źródeł i to, czego platforma jeszcze nie obserwuje.",
  sections: {
    READINESS: "Gotowość źródeł i danych",
    SUBJECTS: "Podmioty rynkowe",
    PROCUREMENT: "Tożsamość w zamówieniach publicznych",
    ENTITY: "Podmiot gospodarczy",
  },
  drawers: {
    READINESS_DETAIL: "Gotowość źródeł i danych — zmierzona",
    SUBJECT_DETAIL: "Dyspozycje podmiotów",
    ANALYSIS: "Przekazanie do analizy",
  },
  absence: {
    NO_QUALIFIED_SOURCE: "Brak kwalifikowanego źródła — żadne źródło notowań ani indeksów nie spełnia wymogu „urzędowe lub bezpłatne”",
    NO_ACTIVE_PROVIDER: "Dla tego podmiotu nie jest aktywny żaden dostawca",
    NOT_RUNTIME_ENABLED: "Nieuruchomione — kontrakt nie wymienia żadnego włączonego podmiotu",
    NO_DETERMINISTIC_JOIN: "Brak deterministycznego powiązania między rekordem zamówienia a spółką",
    NO_ROUTE_GEOMETRY: "Nie da się wytworzyć geometrii trasy — tylko punkty końcowe",
    AWAITING_SHARED_CONTRACT: "Oczekiwanie na wspólny kontrakt — zależność odnotowana dla Main",
    STATE_NOT_DERIVABLE: "Nie da się wyprowadzić stanu — to nie jest „brak istotnej zmiany”",
    NO_VINTAGE_PUBLISHED: "Nie opublikowano wersji danych — czas pobrania to nie jest wersja danych",
  },
  subjects: {
    INSTRUMENT: "Instrument",
    COMMODITY: "Surowiec",
    SECTOR: "Sektor",
    COMMERCIAL_ENTITY: "Podmiot gospodarczy",
    CORRIDOR: "Korytarz",
    PROCUREMENT_OPPORTUNITY: "Postępowanie o zamówienie",
  },
  labels: {
    measured: "Zmierzone",
    ready: "Gotowe",
    notReady: "Niegotowe",
    dependency: "Zależność odnotowana dla Main",
    close: "Zamknij",
    sourceReadiness: "Gotowość źródeł",
    contractSays: "Odczytane z kontraktu",
    noScorer: "W tej domenie nie istnieje żaden wynik, ranking ani miara podobieństwa.",
    changeCeiling: "Pułap stanów zmiany",
    localeFallback: "Treści rynkowe nie są jeszcze opracowane w tym języku. Pokazujemy wersję angielską.",
    degradedDefault: "Stan ograniczony — to domyślne zachowanie w wersji Beta, a nie błąd.",
    analysisUnavailable: "Koszt niedostępny — nie można uruchomić",
    watchUnavailable: "Dla tego podmiotu nie zarejestrowano typów obserwacji.",
    noData: "Brak danych",
  },
} as const;

const MKT_CATALOGUE: Partial<Record<MktLocale, MktStrings>> = { en };

export interface MktStringsResolution {
  readonly strings: MktStrings; readonly requested: MktLocale;
  readonly resolved: MktLocale; readonly fellBack: boolean;
}

export function resolveMktStrings(locale: MktLocale): MktStringsResolution {
  const found = MKT_CATALOGUE[locale];
  if (found) return { strings: found, requested: locale, resolved: locale, fellBack: false };
  return { strings: en, requested: locale, resolved: 'en', fellBack: true };
}

export function mktStrings(locale: MktLocale): MktStrings {
  return resolveMktStrings(locale).strings;
}

export function mktLocalesAwaitingContent(locales: readonly MktLocale[]): MktLocale[] {
  return locales.filter((l) => MKT_CATALOGUE[l] === undefined);
}
