import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import type { ChangeStateLabels } from '@/lib/observation/changeState';
import type { EnergyMetaCountedNoun, EnergyScopeToken } from '@/lib/energy/energyModel';
import type {
  EnergyDataTier,
  EnergyEvidenceRole,
  EnergyPrecision,
  EnergyReaderState,
  EnergySourceClass,
  EnergySubjectType,
  EnergySubstrate,
  EnergyWindow,
} from '@/lib/energy/energyFrame';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART XI ENERGY — EN / PL CATALOGUE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── WHY PL IS AUTHORED HERE AND NOT DEFERRED ──────────────────────────────
 *
 * DEPENDENCY-MATRIX row 12 assigns it explicitly:
 *
 *   "L validates, does not implement; STRINGS ARE H'S TO PLACE."
 *
 * and the implementation graph runs L02 (EN/PL label validation) and L03 (PL
 * string lengths at the 10px metadata floor in dense rows) in the PARALLEL NOW
 * lane — L measures what H has placed. So placing Polish is this lane's job and
 * validating it is not. **Every PL string below is PENDING L02 VALIDATION** and
 * the package reports that seam rather than implying the copy is signed off.
 *
 * ── THE STRINGS THAT CARRY THE MOST WEIGHT ARE THE ABSENCE ONES ───────────
 *
 * Main's rule outranks every other on this surface:
 *
 *   "Silence must never imply stable supply, no outage, no disruption, normal
 *    operations, or safety. Every zone with nothing to show says WHY there is
 *    nothing."
 *
 * So each absence state below has BOTH a chip label and a `…Why` sentence, and
 * the frame has no way to render the chip without the sentence. A mistranslation
 * here would turn "we have not assessed this" into "there is nothing wrong",
 * which is the single failure this whole design exists to prevent — which is
 * also why L02 validation is reported as outstanding rather than assumed.
 *
 * M06: Main approved the STRUCTURE of the precision and data-tier statements
 * ("the precision ladder and the rule 'renderer quality never implies evidence
 * precision' are canonical and approved") and sent the WORDS to L02. The words
 * below are placements against that approved structure.
 */

/**
 * The one locale type this surface can honour. `getDictionary` is keyed by
 * `LanguageCode`; the accepted `ScriptRun` boundary is keyed by `DisplayLocale`;
 * neither union contains the other. The intersection is the honest type, and it
 * needs no cast.
 */
export type EnergyLocale = LanguageCode & DisplayLocale;

/** What this deployment actually offers, which is what `ACTIVE_LANGUAGES` says. */
export const ENERGY_LOCALES: readonly EnergyLocale[] = ['en', 'pl'];

/** The em-dash the frozen design uses wherever a value is absent. Never "0", never "—%". */
export const ENERGY_ABSENT = '—';

export interface EnergyStrings {
  readonly moduleName: string;
  readonly metaTitle: string;
  readonly metaDescription: string;

  readonly substrate: Readonly<Record<EnergySubstrate, string>>;
  readonly substrateShort: Readonly<Record<EnergySubstrate, string>>;
  readonly substrateEyebrow: Readonly<Record<EnergySubstrate, string>>;
  readonly substrateHeadline: Readonly<Record<EnergySubstrate, string>>;
  /** The context-bar crumb. Distinct from the switcher label, as the design froze it. */
  readonly substrateCrumb: Readonly<Record<EnergySubstrate, string>>;

  readonly window: Readonly<Record<EnergyWindow, string>>;
  readonly windowShort: Readonly<Record<EnergyWindow, string>>;
  /** M05 — the explicit label the 7D fallback must carry. Never silent. */
  readonly windowFallbackLabel: string;
  readonly windowFallbackWhy: string;

  readonly tierFree: string;
  readonly tierProfessional: string;
  readonly tierBoundaryTitle: string;
  readonly tierBoundaryBody: string;
  readonly tierBoundaryNote: string;

  readonly state: Readonly<Record<EnergyReaderState, string>>;
  readonly stateWhy: Readonly<Record<EnergyReaderState, string>>;

  readonly subjectType: Readonly<Record<EnergySubjectType, string>>;
  readonly precision: Readonly<Record<EnergyPrecision, string>>;
  readonly precisionRule: string;
  readonly dataTier: Readonly<Record<EnergyDataTier, string>>;
  readonly sourceClass: Readonly<Record<EnergySourceClass, string>>;
  readonly evidenceRole: Readonly<Record<EnergyEvidenceRole, string>>;
  readonly disputedRetained: string;

  readonly railItems: readonly string[];
  /**
   * TEMPLATES, NOT FUNCTIONS. This catalogue crosses the server/client boundary
   * as data, so every member must be serialisable — a function here is a
   * runtime error at the boundary rather than a style preference. The two
   * placeholders are substituted by `formatEnergyString` on the client.
   */
  readonly watchActiveTemplate: string;
  readonly watchNotWatching: string;
  readonly watchWatching: string;
  readonly watchProfessionalOnly: string;

  readonly layersTitle: string;
  readonly layers: readonly { readonly label: string; readonly tier: EnergyDataTier }[];

  readonly hudEvidence: string;
  readonly hudPrecision: string;
  readonly hudDataTier: string;
  readonly hudInvestigate: string;
  readonly drawerTitle: string;
  readonly drawerAssessment: string;
  readonly drawerOpenLens: string;
  readonly drawerNote: string;
  readonly lensTitle: string;
  readonly lensUncertain: string;
  readonly lensAffected: string;
  readonly lensTimeline: string;
  readonly lensTimelineAppendOnly: string;
  readonly lensGeographyFacet: string;
  readonly lensConfidence: string;
  readonly lensRevisions: string;
  readonly lensLastChecked: string;
  readonly lensCrossDomain: string;
  readonly crossDomainNoConsequence: string;
  /** R2 — the CTO price-ownership ruling, stated on the surface that references it. */
  readonly crossDomainMarketOwnership: string;
  readonly vesselUnavailable: string;

  readonly changeAxisNote: string;
  /**
   * R2 — M01 IS RESOLVED, so the pending note is replaced by the note that
   * describes what the reader is actually looking at: two axes, not one phrase.
   */
  readonly changeAxisTwoAxisNote: string;
  /** M01 labels, per locale. Neither EN nor PL is authority — see `changeState.ts`. */
  readonly changeState: ChangeStateLabels;
  /**
   * R3 · `row.meta` AS TWO ELEMENTS — THE TEMPLATES, NEVER A JOINED SENTENCE.
   *
   * L's ruling 2: *"the overflow is not a translation problem. It is a
   * data-cardinality problem, and no Polish string can close it."* The two
   * numbers in the line are DATA, so the only closure is a bounded presentation
   * rule with a protected numeral — which is why the recency and the count are
   * separate templates here rather than one sentence with a `·` inside it.
   *
   * The `·` is NOT in any of these strings. It is a composition operator
   * rendered by the container, the same resolution M01 reached for the state
   * axes, so it cannot be clipped away and cannot be orphaned.
   */
  readonly metaRecency: string;
  /** Appended to the hour count. EN `2h`, PL `6 h` — the space is the locale's. */
  readonly metaRecencyHourUnit: string;
  /**
   * Appended to the day count, or NULL where the locale renders hours at every
   * magnitude. L's delivered PL template is `sprawdzono {H} h` and measures
   * H=168, so Polish is hours-always and this is null there; EN keeps the
   * design's own `checked 1d`.
   */
  readonly metaRecencyDayUnit: string | null;
  /** The noun that follows the evidence count. One element with it — never clipped. */
  readonly metaCounted: Readonly<Record<EnergyMetaCountedNoun, string>>;
  readonly scope: Readonly<Record<EnergyScopeToken, string>>;
  readonly revisionSpine: string;
  readonly revisionSpineSingle: string;

  readonly flowsShareSemantics: string;
  readonly flowsPeriodicNotLive: string;
  readonly dependenceTitle: string;
  readonly storageTitle: string;
  readonly locatorTitle: string;
  readonly locatorOrientationOnly: string;
  readonly absenceLegendTitle: string;

  readonly askTitle: string;
  readonly askZeroCost: string;
  readonly askContextTitle: string;
  readonly askContextFields: readonly string[];
  readonly askNothingStored: string;
  readonly askReturnNote: string;
  readonly deepAnalysisTitle: string;
  /** M07 — the action without a number Main did not set. */
  readonly priceNotSet: string;
  readonly pricedBeforeExecution: string;

  readonly sheetStage: Readonly<Record<'peek' | 'half' | 'full', string>>;
  readonly tabs: Readonly<Record<'map' | 'changed' | 'watch' | 'ask', string>>;
  readonly compactMapNote: string;
  readonly returnToEnergy: string;

  readonly reducedMotionOn: string;
  readonly reducedMotionOff: string;
  readonly rendererLabel: string;
  readonly fixtureBanner: string;
  readonly fixtureBannerBody: string;
  readonly governedBanner: string;
  readonly governedBannerBody: string;

  readonly gateBlockedTemplate: string;
  readonly noSubjectSelected: string;
  readonly substrateRegionLabel: string;
  readonly substrateTextSummary: string;
}

const EN: EnergyStrings = {
  moduleName: 'Energy Intelligence',
  metaTitle: 'Energy Intelligence',
  metaDescription:
    'Energy system condition, flow, capacity, dependence and infrastructure status. Every zone states what is known, what is withheld and why.',

  substrate: { spatial: 'SEE THE SYSTEM', change: 'SEE THE CHANGE', flows: 'DEPENDENCY' },
  substrateShort: { spatial: 'SYSTEM', change: 'CHANGE', flows: 'FLOWS' },
  substrateEyebrow: {
    spatial: 'A · SPATIAL COMMAND CANVAS — SEE THE SYSTEM',
    change: 'C · CHANGE OBSERVATORY — SEE THE CHANGE',
    flows: 'B · ENERGY FLOW SYSTEM — UNDERSTAND THE DEPENDENCY',
  },
  substrateHeadline: {
    spatial: 'Energy corridors, assets and grid situations',
    change: 'How our assessment moved',
    flows: 'Source → corridor → market · share of assessed supply',
  },
  substrateCrumb: { spatial: 'Spatial canvas', change: 'Change', flows: 'Flows' },

  window: { visit: 'SINCE LAST VISIT', '24h': '24H', '7d': '7D', '30d': '30D' },
  windowShort: { visit: 'SINCE VISIT', '24h': '24H', '7d': '7D', '30d': '30D' },
  windowFallbackLabel: '7D · NO VISIT CHECKPOINT',
  windowFallbackWhy:
    'Since-last-visit needs a per-reader checkpoint the platform does not yet provide, so this window is the stated 7-day fallback rather than a personalised one.',

  tierFree: 'FREE · KNOW',
  tierProfessional: 'PROFESSIONAL · FOLLOW',
  tierBoundaryTitle: 'PROFESSIONAL · FOLLOW',
  tierBoundaryBody: 'Since last visit, Watch, Timeline continuity and longer history.',
  tierBoundaryNote: 'Same substrate and same evidence — persistence is the boundary, not access to facts.',

  state: {
    NO_MATERIAL_CHANGE: 'NO MATERIAL CHANGE',
    COVERAGE_GAP: 'COVERAGE GAP',
    UNAVAILABLE_LICENSED: 'UNAVAILABLE · LICENSED',
    NO_DATA: 'NO DATA',
  },
  stateWhy: {
    NO_MATERIAL_CHANGE: 'Evidence was reviewed and the assessment did not move. This is a result, not an absence of data.',
    COVERAGE_GAP: 'Source coverage is insufficient to assess this. The assessment is withheld, never inferred.',
    UNAVAILABLE_LICENSED: 'The capability exists; the current data tier does not provide it.',
    NO_DATA: 'No available record.',
  },

  subjectType: {
    SUPPLY_SITUATION: 'ENERGY SUPPLY SITUATION',
    CORRIDOR: 'ENERGY CORRIDOR',
    INFRASTRUCTURE_ASSET: 'ENERGY INFRASTRUCTURE ASSET',
    GRID_SITUATION: 'GRID SITUATION',
  },
  precision: {
    CORRIDOR_25KM: 'CORRIDOR-LEVEL ±25 KM',
    ROUTE_LEVEL: 'ROUTE-LEVEL · PUBLIC REGISTER',
    ASSET_LEVEL: 'ASSET-LEVEL · PUBLIC REGISTER',
    REGION_LEVEL: 'REGION-LEVEL · NO ASSET PRECISION IMPLIED',
  },
  precisionRule: 'Renderer resolution does not imply evidence precision.',
  dataTier: {
    PUBLIC: 'PUBLIC',
    PERIODIC: 'PERIODIC',
    OPERATOR_REPORTED: 'OPERATOR REPORTED',
    LICENSED: 'LICENSED · OFF IN BETA',
    NOT_AVAILABLE: 'NOT AVAILABLE · NEVER SIMULATED',
  },
  sourceClass: {
    GOVERNMENT: 'GOVERNMENT',
    REGULATOR: 'REGULATOR',
    TSO_GRID_OPERATOR: 'TSO / GRID OPERATOR',
    ENERGY_COMPANY: 'ENERGY COMPANY',
    PORT_TERMINAL: 'PORT / TERMINAL',
    STATISTICAL_INSTITUTION: 'STATISTICAL INSTITUTION',
    INTERGOVERNMENTAL: 'INTERGOVERNMENTAL',
    INDUSTRY_REPORTING: 'INDUSTRY REPORTING',
    LOCAL_MEDIA: 'LOCAL MEDIA',
    REGIONAL_MEDIA: 'REGIONAL MEDIA',
    INTERNATIONAL_MEDIA: 'INTERNATIONAL MEDIA',
    COMMERCIAL_LICENSED: 'COMMERCIAL DATA · LICENSED',
  },
  evidenceRole: { SUPPORTS: 'SUPPORTS', CONTEXT: 'CONTEXT', PARTIAL: 'PARTIAL', DISPUTED: 'DISPUTED' },
  disputedRetained: 'Disputed and contradicted artifacts are retained and labelled, never hidden.',

  railItems: ['Overview', 'Corridors', 'Infrastructure', 'Electricity', 'Supply situations', 'Countries', 'Timeline'],
  watchActiveTemplate: 'WATCH · {count} ACTIVE',
  watchNotWatching: '+ WATCH',
  watchWatching: 'WATCHING',
  watchProfessionalOnly: 'Watch is a Professional capability.',

  layersTitle: 'LAYERS',
  layers: [
    { label: 'Oil & product routes', tier: 'PUBLIC' },
    { label: 'LNG routes', tier: 'PERIODIC' },
    { label: 'Gas pipelines', tier: 'PUBLIC' },
    { label: 'Interconnectors', tier: 'OPERATOR_REPORTED' },
    { label: 'Watched assets', tier: 'PUBLIC' },
    { label: 'Vessel positions', tier: 'NOT_AVAILABLE' },
  ],

  hudEvidence: 'Evidence',
  hudPrecision: 'Geometry precision',
  hudDataTier: 'Data tier',
  hudInvestigate: 'INVESTIGATE →',
  drawerTitle: 'DRAWER · INVESTIGATE',
  drawerAssessment: 'CURRENT ASSESSMENT',
  drawerOpenLens: 'OPEN LENS →',
  drawerNote: 'Drawer investigates. The lens is the full subject surface; Workspace handles multi-subject synthesis.',
  lensTitle: 'D · SITUATION LENS — UNDERSTAND THE SUBJECT',
  lensUncertain: 'WHAT IS UNCERTAIN',
  lensAffected: 'AFFECTED ENERGY SYSTEMS',
  lensTimeline: 'TIMELINE · HOW UNDERSTANDING CHANGED',
  lensTimelineAppendOnly: 'APPEND-ONLY',
  lensGeographyFacet: 'FACET · GEOGRAPHY',
  lensConfidence: 'CONFIDENCE',
  lensRevisions: 'REVISIONS',
  lensLastChecked: 'LAST CHECKED',
  lensCrossDomain: 'CROSS-DOMAIN REFERENCES',
  crossDomainNoConsequence: 'No assessed energy-access consequence.',
  crossDomainMarketOwnership: 'Market owns price observations. Energy links to them and never restates them.',
  vesselUnavailable: 'VESSEL POSITIONS · UNAVAILABLE',

  changeAxisNote: 'Bands mark assessment events, not article counts. Quiet rows state what was reviewed.',
  changeAxisTwoAxisNote: 'A change state is two facts: what moved, and what is known about why.',
  changeState: {
    service: {
      NO_MATERIAL_CHANGE: 'NO MATERIAL CHANGE',
      DISRUPTION_OBSERVED: 'DISRUPTION OBSERVED',
      SUPPLY_IMPACT_OBSERVED: 'SUPPLY IMPACT OBSERVED',
      SUPPLY_IMPACT_REVISED: 'SUPPLY IMPACT REVISED',
      RESTORED: 'RESTORED',
    },
    cause: {
      CAUSE_NOT_ASSESSED: 'CAUSE NOT ASSESSED',
      CAUSE_OPEN: 'CAUSE OPEN',
      CAUSE_ASSESSED: 'CAUSE ASSESSED',
    },
  },
  metaRecency: 'checked {value}',
  metaRecencyHourUnit: 'h',
  metaRecencyDayUnit: 'd',
  metaCounted: {
    EVIDENCE: 'evidence',
    REVIEWED: 'reviewed',
  },
  scope: {
    CORRIDOR: 'CORRIDOR',
    INTERCONNECTOR: 'INTERCONNECTOR',
    SUPPLY_SITUATION: 'SUPPLY SITUATION',
    ASSET: 'ASSET',
    GENERATION: 'GENERATION',
    INFRASTRUCTURE: 'INFRASTRUCTURE',
    GRID_SITUATION: 'GRID SITUATION',
    HISTORICAL: 'HISTORICAL',
  },
  revisionSpine: 'REVISION SPINE',
  revisionSpineSingle: 'No revisions recorded. Absence of history is not absence of assessment.',

  flowsShareSemantics: 'Widths are share of assessed supply — a ratio, never a flow rate.',
  flowsPeriodicNotLive: 'PERIODIC · NOT LIVE',
  dependenceTitle: 'DEPENDENCE & REDUNDANCY',
  storageTitle: 'STORAGE · PERIODIC',
  locatorTitle: 'LOCATOR · VECTOR 2D',
  locatorOrientationOnly: 'Orientation only. No asset precision.',
  absenceLegendTitle: 'FOUR ABSENCE STATES, EACH DISTINCT BY TREATMENT',

  askTitle: 'ASK AI · SHARED CAPABILITY',
  askZeroCost: '0 SAND',
  askContextTitle: 'Context envelope passed with this request:',
  askContextFields: ['subject', 'geography', 'evidence refs', 'assessment', 'uncertainty', 'time window', 'cross-domain refs', 'watch context'],
  askNothingStored: 'Nothing is stored for this view yet, so there is nothing to answer from. Ask does not synthesise.',
  askReturnNote: 'Closing Ask returns to the exact substrate, subject, geography, window and Watch context you left.',
  deepAnalysisTitle: 'DEEP ANALYSIS · WORKSPACE',
  priceNotSet: 'PRICE NOT SET',
  pricedBeforeExecution: 'Priced before execution. Stored navigation, timeline and references cost nothing.',

  sheetStage: { peek: 'PEEK', half: 'HALF', full: 'FULL' },
  tabs: { map: 'MAP', changed: 'CHANGED', watch: 'WATCH', ask: 'ASK' },
  compactMapNote: 'Selecting a subject raises the sheet, so the explanation never covers the geometry it refers to.',
  returnToEnergy: 'Energy',

  reducedMotionOn: 'REDUCED MOTION · ON',
  reducedMotionOff: 'REDUCED MOTION · OFF',
  rendererLabel: 'MERCATOR · MAPLIBRE VECTOR 2D',
  fixtureBanner: 'DESIGN FIXTURE DATA',
  fixtureBannerBody:
    'Every value on this screen is a design fixture carried from the frozen Part XI package. It is not an intelligence finding.',
  governedBanner: 'NO GOVERNED ENERGY DATA',
  governedBannerBody:
    'No source is active and no record has landed. Every zone states its own absence — silence does not mean stable supply.',

  gateBlockedTemplate: 'Withheld pending {gate} review.',
  noSubjectSelected: 'Select a subject to see its assessment, evidence and revision history.',
  substrateRegionLabel: 'Energy spatial substrate',
  substrateTextSummary: 'Every subject on this substrate is also reachable from the list beside it. The map is not the only path.',
};

const PL: EnergyStrings = {
  moduleName: 'Analiza energetyczna',
  metaTitle: 'Analiza energetyczna',
  metaDescription:
    'Stan systemu energetycznego, przepływy, moce, zależności i stan infrastruktury. Każda strefa mówi, co jest znane, co zostało wstrzymane i dlaczego.',

  substrate: { spatial: 'ZOBACZ SYSTEM', change: 'ZOBACZ ZMIANĘ', flows: 'ZALEŻNOŚCI' },
  substrateShort: { spatial: 'SYSTEM', change: 'ZMIANA', flows: 'PRZEPŁYWY' },
  substrateEyebrow: {
    spatial: 'A · PRZESTRZENNY PULPIT — ZOBACZ SYSTEM',
    change: 'C · OBSERWATORIUM ZMIAN — ZOBACZ ZMIANĘ',
    flows: 'B · SYSTEM PRZEPŁYWÓW — ZROZUM ZALEŻNOŚĆ',
  },
  substrateHeadline: {
    spatial: 'Korytarze energetyczne, obiekty i sytuacje systemowe',
    change: 'Jak zmieniła się nasza ocena',
    flows: 'Źródło → korytarz → rynek · udział w ocenionej podaży',
  },
  substrateCrumb: { spatial: 'Kanwa przestrzenna', change: 'Zmiana', flows: 'Przepływy' },

  window: { visit: 'OD OSTATNIEJ WIZYTY', '24h': '24 G', '7d': '7 DNI', '30d': '30 DNI' },
  windowShort: { visit: 'OD WIZYTY', '24h': '24 G', '7d': '7 DNI', '30d': '30 DNI' },
  windowFallbackLabel: '7 DNI · BRAK PUNKTU WIZYTY',
  windowFallbackWhy:
    'Zakres „od ostatniej wizyty” wymaga indywidualnego punktu odniesienia, którego platforma jeszcze nie udostępnia — dlatego obowiązuje jawnie oznaczony zakres 7 dni, a nie zakres spersonalizowany.',

  tierFree: 'BEZPŁATNY · WIEDZA',
  tierProfessional: 'PROFESJONALNY · OBSERWACJA',
  tierBoundaryTitle: 'PROFESJONALNY · OBSERWACJA',
  tierBoundaryBody: 'Od ostatniej wizyty, obserwacja, ciągłość osi czasu i dłuższa historia.',
  tierBoundaryNote: 'To samo podłoże i te same dowody — granicą jest trwałość, nie dostęp do faktów.',

  state: {
    NO_MATERIAL_CHANGE: 'BEZ ISTOTNEJ ZMIANY',
    COVERAGE_GAP: 'LUKA W POKRYCIU',
    UNAVAILABLE_LICENSED: 'NIEDOSTĘPNE · LICENCJA',
    NO_DATA: 'BRAK DANYCH',
  },
  stateWhy: {
    NO_MATERIAL_CHANGE: 'Dowody zostały przejrzane, a ocena się nie zmieniła. To wynik, a nie brak danych.',
    COVERAGE_GAP: 'Pokrycie źródłowe jest niewystarczające do oceny. Ocena została wstrzymana, nie wywnioskowana.',
    UNAVAILABLE_LICENSED: 'Możliwość istnieje; obecny poziom danych jej nie udostępnia.',
    NO_DATA: 'Brak dostępnego zapisu.',
  },

  subjectType: {
    SUPPLY_SITUATION: 'SYTUACJA PODAŻOWA',
    CORRIDOR: 'KORYTARZ ENERGETYCZNY',
    INFRASTRUCTURE_ASSET: 'OBIEKT INFRASTRUKTURY',
    GRID_SITUATION: 'SYTUACJA SYSTEMOWA',
  },
  precision: {
    CORRIDOR_25KM: 'POZIOM KORYTARZA ±25 KM',
    ROUTE_LEVEL: 'POZIOM TRASY · REJESTR PUBLICZNY',
    ASSET_LEVEL: 'POZIOM OBIEKTU · REJESTR PUBLICZNY',
    REGION_LEVEL: 'POZIOM REGIONU · BEZ PRECYZJI OBIEKTOWEJ',
  },
  precisionRule: 'Rozdzielczość renderowania nie oznacza precyzji dowodu.',
  dataTier: {
    PUBLIC: 'PUBLICZNE',
    PERIODIC: 'OKRESOWE',
    OPERATOR_REPORTED: 'ZGŁOSZONE PRZEZ OPERATORA',
    LICENSED: 'LICENCJA · WYŁĄCZONE W BECIE',
    /* L's recommendation: `NIEDOSTĘPNE` collapses UNAVAILABLE (entitlement) and
       NOT AVAILABLE (the never-simulated tier) in Polish, so the tier carries its
       own qualifier. Both forms are F-4 ellipsis-REFUSED — see `energyOverflow.ts`. */
    NOT_AVAILABLE: 'NIEDOSTĘPNE · BRAK ŹRÓDŁA',
  },
  sourceClass: {
    GOVERNMENT: 'ADMINISTRACJA',
    REGULATOR: 'REGULATOR',
    TSO_GRID_OPERATOR: 'OPERATOR SYSTEMU',
    ENERGY_COMPANY: 'FIRMA ENERGETYCZNA',
    PORT_TERMINAL: 'PORT / TERMINAL',
    STATISTICAL_INSTITUTION: 'URZĄD STATYSTYCZNY',
    INTERGOVERNMENTAL: 'MIĘDZYRZĄDOWE',
    INDUSTRY_REPORTING: 'RAPORTY BRANŻOWE',
    LOCAL_MEDIA: 'MEDIA LOKALNE',
    REGIONAL_MEDIA: 'MEDIA REGIONALNE',
    INTERNATIONAL_MEDIA: 'MEDIA MIĘDZYNARODOWE',
    COMMERCIAL_LICENSED: 'DANE KOMERCYJNE · LICENCJA',
  },
  evidenceRole: { SUPPORTS: 'POTWIERDZA', CONTEXT: 'KONTEKST', PARTIAL: 'CZĘŚCIOWE', DISPUTED: 'SPORNE' },
  disputedRetained: 'Sporne i zaprzeczone materiały są zachowywane i oznaczane, nigdy ukrywane.',

  railItems: ['Przegląd', 'Korytarze', 'Infrastruktura', 'Elektroenergetyka', 'Sytuacje podażowe', 'Kraje', 'Oś czasu'],
  watchActiveTemplate: 'OBSERWACJA · {count} AKTYWNE',
  watchNotWatching: '+ OBSERWUJ',
  watchWatching: 'OBSERWOWANE',
  watchProfessionalOnly: 'Obserwacja jest funkcją planu profesjonalnego.',

  layersTitle: 'WARSTWY',
  layers: [
    { label: 'Trasy ropy i produktów', tier: 'PUBLIC' },
    { label: 'Trasy LNG', tier: 'PERIODIC' },
    { label: 'Gazociągi', tier: 'PUBLIC' },
    { label: 'Połączenia międzysystemowe', tier: 'OPERATOR_REPORTED' },
    { label: 'Obserwowane obiekty', tier: 'PUBLIC' },
    { label: 'Pozycje statków', tier: 'NOT_AVAILABLE' },
  ],

  hudEvidence: 'Dowody',
  hudPrecision: 'Precyzja geometrii',
  hudDataTier: 'Poziom danych',
  hudInvestigate: 'ZBADAJ →',
  drawerTitle: 'PANEL · ZBADAJ',
  drawerAssessment: 'BIEŻĄCA OCENA',
  drawerOpenLens: 'OTWÓRZ SOCZEWKĘ →',
  drawerNote: 'Panel bada. Soczewka to pełna powierzchnia tematu; synteza wielotematyczna należy do Przestrzeni roboczej.',
  lensTitle: 'D · SOCZEWKA SYTUACJI — ZROZUM TEMAT',
  lensUncertain: 'CO JEST NIEPEWNE',
  lensAffected: 'OBJĘTE SYSTEMY ENERGETYCZNE',
  lensTimeline: 'OŚ CZASU · JAK ZMIENIAŁO SIĘ ROZUMIENIE',
  lensTimelineAppendOnly: 'TYLKO DOPISYWANIE',
  lensGeographyFacet: 'ASPEKT · GEOGRAFIA',
  lensConfidence: 'PEWNOŚĆ',
  lensRevisions: 'REWIZJE',
  lensLastChecked: 'OSTATNIE SPRAWDZENIE',
  lensCrossDomain: 'ODNIESIENIA MIĘDZYDZIEDZINOWE',
  crossDomainNoConsequence: 'Brak ocenionych skutków dla dostępu do energii.',
  crossDomainMarketOwnership: 'Ceny są własnością Rynku. Energetyka je przywołuje i nigdy nie powtarza.',
  vesselUnavailable: 'POZYCJE STATKÓW · NIEDOSTĘPNE',

  changeAxisNote: 'Pasma oznaczają zdarzenia oceny, nie liczbę artykułów. Spokojne wiersze mówią, co przejrzano.',
  changeAxisTwoAxisNote: 'Stan zmiany to dwa fakty: co się zmieniło i co wiadomo o przyczynie.',
  /*
    ══ R3 · L'S DELIVERED POLISH VOCABULARY, ADOPTED WHOLE ══════════════════

    Authority: `L-ENERGY-PARTXI-PL-FIT-R2.zip` sha256
    `dbe7f4b5f926c84d7a798b3be0377a903fdc2fc923b8b303330d005473f6a9a5`,
    ruling `ENERGY PL LABEL FIT = RESOLVED` / `ENERGY PL IMPLEMENTATION = READY FOR H`.
    Verified before use; its own MANIFEST is 5/5 OK.

    Budget: `row.state` is 190px at 10px with .1em tracking = 7.0px per
    character = 27 characters. L's measured fit, all eight, over budget: ZERO.

      BEZ ISTOTNEJ ZMIANY             19 ch  133.0px
      ZAKŁÓCENIE ODNOTOWANE           21 ch  147.0px
      WPŁYW NA DOSTAWY ODNOTOWANY     27 ch  189.0px     <- one pixel of margin
      KOREKTA WPŁYWU NA DOSTAWY       25 ch  175.0px
      PRZYWRÓCONO                     11 ch   77.0px
      PRZYCZYNA NIEOCENIONA           21 ch  147.0px
      PRZYCZYNA OTWARTA               17 ch  119.0px
      PRZYCZYNA OCENIONA              18 ch  126.0px

    ── WHY THE WORD ORDER IS LOAD-BEARING, NOT STYLISTIC ────────────────────

    Under Main's F-3 the SERVICE element is the one that ellipsizes and the
    CAUSE element is `flex:none`. So the worst case available to the service
    element is `190 - 147 (PRZYCZYNA NIEOCENIONA) - 6 (gap) = 37px = 5
    characters`, and the service vocabulary has to stay unambiguous inside it.

      discriminator-first   B · Z · W · K · P     shared prefix 0 ch
                            unambiguous from 1 character (7.0px)
      verb-first (rejected) ODNOTOWANO …          shared prefix 11 ch
                            unambiguous from 12 characters (84.0px)

    The verb-first family needs 84px and gets 37px, so a reader under pressure
    would see `ODNOT…` — a prefix shared by two different service states. That
    is F-4's hazard in the form F-4 does not catch, because `ODNOTOWANO` is not
    itself a label. `ENERGY_ELLIPSIS_PERMITTED` in `energyOverflow.ts` is F-4′,
    which does catch it, and it is asserted against this vocabulary.

    ── FOUR LABELS CHANGED BEYOND THE TWO THE ACTIVATION NAMED ──────────────

    The R3 order names `SUPPLY_IMPACT_OBSERVED` and `DISRUPTION_OBSERVED`.
    L's package delivers the complete eight-token vocabulary, and four of the
    remaining six differ from the values R2 carried. **R2's values in those
    four slots were H's own pairings, placed as fillers where L had not yet
    delivered — H has no Polish copy authority and never claimed it.** They are
    replaced by L's, and each change is recorded here rather than absorbed:

      SUPPLY_IMPACT_REVISED  ZMIENIONA OCENA WPŁYWU  -> KOREKTA WPŁYWU NA DOSTAWY
        H's form DROPPED `na dostawy`, which is the exact defect L's §2 rejects
        for the observed label: the two-axis model puts no constraint on which
        subject carries a service token, so a label that leans on the `scope`
        column is wrong the first time a `KORYTARZ` row carries it.
      RESTORED               WZNOWIONO               -> PRZYWRÓCONO
      CAUSE_NOT_ASSESSED     PRZYCZYNA NIEZBADANA    -> PRZYCZYNA NIEOCENIONA
      CAUSE_ASSESSED         PRZYCZYNA USTALONA      -> PRZYCZYNA OCENIONA
        H's cause pair used two different roots (`zbadana` / `ustalona`) for one
        axis; L's shares the `ocen-` root across NOT_ASSESSED and ASSESSED, so
        the axis reads as one vocabulary. This is L's own §3 argument — one
        English modifier must map to one Polish word, or a later reviewer
        unifies it in the direction that does not fit.

    Each of the four is L's to keep or to revert; none is H's to re-author.
    `CAUSE_OPEN` is unchanged and remains an independent fact under F-3.
  */
  changeState: {
    service: {
      NO_MATERIAL_CHANGE: 'BEZ ISTOTNEJ ZMIANY',
      DISRUPTION_OBSERVED: 'ZAKŁÓCENIE ODNOTOWANE',
      SUPPLY_IMPACT_OBSERVED: 'WPŁYW NA DOSTAWY ODNOTOWANY',
      SUPPLY_IMPACT_REVISED: 'KOREKTA WPŁYWU NA DOSTAWY',
      RESTORED: 'PRZYWRÓCONO',
    },
    cause: {
      CAUSE_NOT_ASSESSED: 'PRZYCZYNA NIEOCENIONA',
      CAUSE_OPEN: 'PRZYCZYNA OTWARTA',
      CAUSE_ASSESSED: 'PRZYCZYNA OCENIONA',
    },
  },
  /* `SYTUACJA DOSTAW` (15) and `SYTUACJA SIECI` (14) are L's own resolutions of
     the two 17-character overflows, accepted as delivered. A later, more literal
     edit back to `SYTUACJA PODAŻOWA` / `SYTUACJA SIECIOWA` is a regression. */
  /*
    L's delivered templates, §6 of `02-META-PRESENTATION.md`:

      sprawdzono {H} h · {N} przejrzane        (evidence reviewed)
      sprawdzono {H} h · {N} dowodów           (evidence count)

    `godz.` -> `h` recovers four characters and is a UNIT SYMBOL rather than an
    invented abbreviation, consistent with the UNITS AUTHORITY rule that a
    displayed unit is the source's unit. It buys the common case; it does not
    close the column, because `{H}` and `{N}` are data:

      H=6   N=22     30 ch  180.0px  FITS
      H=12  N=220    32 ch  192.0px  OVER by 2.0
      H=168 N=1000   34 ch  204.0px  OVER by 14.0

    A week-old check with a four-digit evidence count is an ordinary value, not
    a pathological one, which is why the presentation rule in `energyOverflow.ts`
    is MANDATORY rather than a fallback.

    `metaRecencyDayUnit` is null: L's template is hours at every magnitude and
    measures H=168 directly.
  */
  metaRecency: 'sprawdzono {value}',
  metaRecencyHourUnit: ' h',
  metaRecencyDayUnit: null,
  metaCounted: {
    EVIDENCE: 'dowodów',
    REVIEWED: 'przejrzane',
  },
  scope: {
    CORRIDOR: 'KORYTARZ',
    INTERCONNECTOR: 'POŁĄCZENIE',
    SUPPLY_SITUATION: 'SYTUACJA DOSTAW',
    ASSET: 'OBIEKT',
    GENERATION: 'WYTWARZANIE',
    INFRASTRUCTURE: 'INFRASTRUKTURA',
    GRID_SITUATION: 'SYTUACJA SIECI',
    HISTORICAL: 'HISTORYCZNE',
  },
  revisionSpine: 'OŚ REWIZJI',
  revisionSpineSingle: 'Brak zapisanych rewizji. Brak historii nie oznacza braku oceny.',

  flowsShareSemantics: 'Szerokości to udział w ocenionej podaży — wskaźnik, nigdy natężenie przepływu.',
  flowsPeriodicNotLive: 'OKRESOWE · NIE NA ŻYWO',
  dependenceTitle: 'ZALEŻNOŚĆ I REDUNDANCJA',
  storageTitle: 'MAGAZYNOWANIE · OKRESOWE',
  locatorTitle: 'LOKALIZATOR · WEKTOR 2D',
  locatorOrientationOnly: 'Tylko orientacja. Bez precyzji obiektowej.',
  absenceLegendTitle: 'CZTERY STANY BRAKU, KAŻDY ROZRÓŻNIONY OBRAMOWANIEM',

  askTitle: 'ZAPYTAJ AI · WSPÓLNA FUNKCJA',
  askZeroCost: '0 SAND',
  askContextTitle: 'Koperta kontekstu przekazana z tym zapytaniem:',
  askContextFields: ['temat', 'geografia', 'odniesienia do dowodów', 'ocena', 'niepewność', 'zakres czasu', 'odniesienia międzydziedzinowe', 'kontekst obserwacji'],
  askNothingStored: 'Dla tego widoku nie zapisano jeszcze niczego, więc nie ma z czego odpowiadać. Zapytaj AI nie tworzy syntezy.',
  askReturnNote: 'Zamknięcie przywraca dokładnie to podłoże, temat, geografię, zakres i kontekst obserwacji, które opuszczono.',
  deepAnalysisTitle: 'ANALIZA POGŁĘBIONA · PRZESTRZEŃ ROBOCZA',
  priceNotSet: 'CENA NIEUSTALONA',
  pricedBeforeExecution: 'Wycena przed wykonaniem. Zapisana nawigacja, oś czasu i odniesienia nic nie kosztują.',

  sheetStage: { peek: 'PODGLĄD', half: 'POŁOWA', full: 'PEŁNA' },
  tabs: { map: 'MAPA', changed: 'ZMIANY', watch: 'OBSERWACJA', ask: 'ZAPYTAJ' },
  compactMapNote: 'Wybór tematu podnosi arkusz, więc wyjaśnienie nigdy nie zasłania geometrii, której dotyczy.',
  returnToEnergy: 'Energetyka',

  reducedMotionOn: 'OGRANICZONY RUCH · WŁ.',
  reducedMotionOff: 'OGRANICZONY RUCH · WYŁ.',
  rendererLabel: 'MERKATOR · MAPLIBRE WEKTOR 2D',
  fixtureBanner: 'DANE POKAZOWE PROJEKTU',
  fixtureBannerBody:
    'Każda wartość na tym ekranie jest daną pokazową przeniesioną z zamrożonego pakietu Part XI. Nie jest ustaleniem wywiadowczym.',
  governedBanner: 'BRAK NADZOROWANYCH DANYCH ENERGETYCZNYCH',
  governedBannerBody:
    'Żadne źródło nie jest aktywne i nie wprowadzono zapisu. Każda strefa podaje własny brak — cisza nie oznacza stabilnych dostaw.',

  gateBlockedTemplate: 'Wstrzymane do czasu przeglądu {gate}.',
  noSubjectSelected: 'Wybierz temat, aby zobaczyć jego ocenę, dowody i historię rewizji.',
  substrateRegionLabel: 'Podłoże przestrzenne energetyki',
  substrateTextSummary: 'Każdy temat na tym podłożu jest też dostępny z listy obok. Mapa nie jest jedyną drogą.',
};

/**
 * PARTIAL, AND DELIBERATELY SO. `EnergyLocale` is the intersection of the two
 * registries and is therefore wider than what this deployment offers —
 * `ACTIVE_LANGUAGES` is `['en','pl']`. Typing the catalogue as complete would
 * force a stub entry for every locale L has not authored, and a stub is how a
 * half-translated absence sentence reaches a reader. A missing locale falls to
 * EN, which is the governed fallback rather than a blank.
 */
const CATALOGUE: Readonly<Partial<Record<EnergyLocale, EnergyStrings>>> = { en: EN, pl: PL };

/**
 * Resolve the catalogue. An unknown locale falls to EN rather than to an empty
 * object, so a zone can never lose its absence sentence — a blank absence chip
 * would be the exact silence the design forbids.
 */
export function energyStrings(locale: string | null | undefined): EnergyStrings {
  return CATALOGUE[(locale ?? 'en') as EnergyLocale] ?? EN;
}

/** Substitutes `{name}` placeholders. Keeps the catalogue serialisable. */
export function formatEnergyString(template: string, values: Readonly<Record<string, string | number>>): string {
  return Object.entries(values).reduce<string>(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function isEnergyLocale(value: string | null | undefined): value is EnergyLocale {
  return value === 'en' || value === 'pl';
}
