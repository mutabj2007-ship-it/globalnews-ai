import type { DisplayLocale } from '@globalnews-ai/shared';
import { ABSENCE_CHROME, quietClaimFor, type AbsenceReason, type ChangeStateSlot } from './humDegraded';

/**
 * PART X · HUMANITARIAN — DOMAIN-LOCAL COPY.
 *
 * Following the ACCEPTED Economy precedent exactly: a domain-owned catalogue with the
 * same shape the shared dictionaries use, keyed by locale, complete per locale, no
 * runtime merging — rather than editing all seven shared dictionaries from a domain
 * lane. `resolveHumStrings()` makes the fallback VISIBLE; nothing falls back silently.
 *
 * WHY EN AND PL ARE AUTHORED AND FIVE ARE NOT. Humanitarian terminology is not
 * decorative: NOT ASSESSED, COVERAGE GAP, UNVERIFIED CLAIM and SEVERELY CONSTRAINED
 * each carry a rule, and a loose translation of any of them would break the honesty
 * the whole design is built on. Authoring five more well is translation work this
 * lane is not authorised to improvise. So they are DECLARED AWAITING CONTENT and the
 * frame DISCLOSES the fallback on screen — which is the same posture LANG-UI-7-D3
 * exists to enforce, and the opposite of a silent English substitution.
 */
export type HumLocale = DisplayLocale;

export interface HumStrings {
  readonly domain: string;
  readonly metaTitle: string;
  readonly metaDescription: string;

  /**
   * THE QUIET FRAME IS NOT IN THIS RECORD, AND ITS ABSENCE IS THE POINT.
   *
   * `frames.QUIET` was `'Checked — no material change'` — a hardcoded claim that a check
   * happened, on a frame whose change slot is `changeStateNotDerivable()`. There is now
   * no key to author it into: the QUIET label comes from `quietFrame`, keyed by a claim
   * that is COMPUTED from the slot, so the honest half and the loud half are the same
   * half. `humFrameLabel()` is the only accessor and takes the slot as an argument.
   */
  readonly frames: Readonly<Record<'ENTRY' | 'SELECTED' | 'GAP', string>>;

  /**
   * The FRAME TAB, keyed by an earned claim rather than by a frame name. F A-3 / A-5.
   * Only one of the two is reachable today.
   */
  readonly quietFrame: Readonly<Record<'CHECKED_NO_MATERIAL_CHANGE' | 'NOT_DERIVABLE', string>>;

  /**
   * The FRAME SUBTITLE. F A-4 is the load-bearing correction and it belongs here rather
   * than only in the body: "the negation has to be as prominent as the claim it replaces,
   * which means it belongs in the frame title". The derived arm reuses A-5 verbatim — the
   * same ratified string in a second slot, not a new one.
   */
  readonly quietSubtitle: Readonly<Record<'CHECKED_NO_MATERIAL_CHANGE' | 'NOT_DERIVABLE', string>>;

  /**
   * The label ABOVE a reason, derived from the reason. The block printed the constant
   * "Not assessed" over rights-blocked states, where an assessment may exist and simply
   * may not be shown; a constant cannot be right for four different kinds of limitation.
   */
  readonly absenceChrome: Readonly<Record<'NOT_ASSESSED' | 'NOT_ESTABLISHED' | 'NOT_SHOWN', string>>;
  readonly drawers: Readonly<Record<
    'POPULATION_NEED' | 'DISPLACEMENT_ACCESS' | 'EVIDENCE' | 'WATCH' | 'TIMELINE' | 'ANALYSIS', string>>;

  readonly zoneA: Readonly<Record<'jurisdiction' | 'precision' | 'updated' | 'coverage' | 'revision' | 'generated' | 'scope', string>>;
  readonly assessment: Readonly<Record<'title' | 'noAssessment' | 'confidence' | 'direction' | 'changeState', string>>;

  readonly need: Readonly<Record<'title' | 'noComposite' | 'sector' | 'level' | 'basis' | 'perAreaPerMethod', string>>;
  readonly sectors: Readonly<Record<'WATER' | 'SHELTER' | 'FOOD' | 'HEALTH' | 'SANITATION' | 'PROTECTION', string>>;
  readonly needLevels: Readonly<Record<'NO_ASSESSED_NEED' | 'STRESSED' | 'SEVERE' | 'CRITICAL' | 'NOT_ASSESSED', string>>;
  readonly access: Readonly<Record<'title' | 'ownAxis' | 'OPEN' | 'CONSTRAINED' | 'SEVERELY_CONSTRAINED' | 'DENIED' | 'NOT_ASSESSED' | 'notAssessedIsNotOpen' | 'causeReferenced', string>>;
  readonly coverage: Readonly<Record<'BASELINE_VALIDATED' | 'DELAYED' | 'STALE' | 'COVERAGE_GAP' | 'assertedFromAbsence' | 'notZeroNeed' | 'whatWouldClose', string>>;
  readonly standing: Readonly<Record<'STANDING_CLAIM' | 'UNVERIFIED_CLAIM' | 'SUPERSEDED' | 'onRecordNotConverted' | 'supersededUnavailable', string>>;
  readonly confidence: Readonly<Record<'LOW' | 'MODERATE' | 'HIGH' | 'NOT_APPLICABLE', string>>;
  readonly direction: Readonly<Record<'DETERIORATION' | 'IMPROVEMENT' | 'RESTORATION' | 'MIXED' | 'UNCHANGED' | 'NO_DIRECTION_SET', string>>;

  /**
   * Per-record reasons only. There is deliberately NO key for an aggregated-because-
   * protected reason: an authored string for it is half of a per-record protection
   * oracle, and the class-level posture below is where protection is stated instead.
   */
  readonly absence: Readonly<Record<
    'NO_VALIDATED_BASELINE' | 'NO_LOCAL_EVIDENCE_IN_PERIOD' | 'RIGHTS_UNAVAILABLE' | 'RIGHTS_RESTRICTED'
    | 'AWAITING_SHARED_CONTRACT' | 'NOT_PRODUCIBLE_AT_THIS_PRECISION'
    | 'STATE_NOT_DERIVABLE', string>>;

  readonly spatial: Readonly<Record<'degraded' | 'countryOutlineOnly' | 'shadingImplies' | 'noRouteGeometry' | 'namedEndpointsOnly' | 'notAvailable', string>>;
  readonly sensitive: Readonly<Record<'title' | 'protectionOn' | 'noReveal' | 'dependency', string>>;
  readonly watch: Readonly<Record<'title' | 'compositeUnavailable' | 'triggersInactive' | 'notMetered', string>>;
  readonly analysis: Readonly<Record<'title' | 'storedFree' | 'costUnavailable' | 'deepAnalysis' | 'crossDomain' | 'referenceCountOnly', string>>;
  readonly timeline: Readonly<Record<'title' | 'historyOfUnderstanding' | 'unavailable', string>>;
  readonly queue: Readonly<Record<'title' | 'cap' | 'notAnIncidentFeed' | 'empty' | 'openFull', string>>;
  readonly common: Readonly<Record<'close' | 'notAssessed' | 'noData' | 'dependencyRecorded' | 'localeFallback' | 'degradedDefault', string>>;
}

const en: HumStrings = {
  domain: 'Humanitarian',
  metaTitle: 'Humanitarian Intelligence — GlobalNews AI',
  metaDescription: 'Humanitarian conditions, material change, access and uncertainty, with every absence stated rather than filled.',
  frames: {
    ENTRY: 'Overview and attention',
    SELECTED: 'Selected humanitarian situation',
    GAP: 'Coverage gap — not assessable on current evidence',
  },
  /* F A-3 / A-5. A-5 is RETAINED and gated, never withdrawn. */
  quietFrame: {
    CHECKED_NO_MATERIAL_CHANGE: 'Checked — no material change',
    NOT_DERIVABLE: 'Change not established',
  },
  /* F A-4 / A-5. "Not checked" is the correction, and it sits where the false claim was. */
  quietSubtitle: {
    CHECKED_NO_MATERIAL_CHANGE: 'Checked — no material change',
    NOT_DERIVABLE: 'Not checked — no change state could be derived for this situation',
  },
  /* F §1, verbatim. Three values, eight reasons, total coverage, no default. */
  absenceChrome: {
    NOT_ASSESSED: 'Not assessed',
    NOT_ESTABLISHED: 'Not established',
    NOT_SHOWN: 'Not shown',
  },
  drawers: {
    POPULATION_NEED: 'Affected population and need profile',
    DISPLACEMENT_ACCESS: 'Displacement and humanitarian access',
    EVIDENCE: 'Evidence set and competing readings',
    WATCH: 'Watch configuration',
    TIMELINE: 'Timeline — history of the understanding',
    ANALYSIS: 'Cross-domain, Ask and Deep Analysis',
  },
  zoneA: {
    jurisdiction: 'Jurisdiction', precision: 'Precision', updated: 'Updated',
    coverage: 'Coverage', revision: 'Revision', generated: 'Generated', scope: 'Scope',
  },
  assessment: {
    title: 'Assessment',
    noAssessment: 'No assessment issued',
    confidence: 'Confidence', direction: 'Direction', changeState: 'Change state',
  },
  need: {
    title: 'Need by sector', noComposite: 'No composite score',
    sector: 'Sector', level: 'Level', basis: 'Basis', perAreaPerMethod: 'Per area · per method',
  },
  sectors: { WATER: 'Water', SHELTER: 'Shelter', FOOD: 'Food', HEALTH: 'Health', SANITATION: 'Sanitation', PROTECTION: 'Protection' },
  needLevels: {
    NO_ASSESSED_NEED: 'No assessed need', STRESSED: 'Stressed', SEVERE: 'Severe',
    CRITICAL: 'Critical', NOT_ASSESSED: 'Not assessed',
  },
  access: {
    title: 'Access condition', ownAxis: 'Own axis · own revision',
    OPEN: 'Open', CONSTRAINED: 'Constrained', SEVERELY_CONSTRAINED: 'Severely constrained',
    DENIED: 'Denied', NOT_ASSESSED: 'Not assessed',
    notAssessedIsNotOpen: 'Not assessed is not open.',
    causeReferenced: 'Cause referenced, not assessed here',
  },
  coverage: {
    BASELINE_VALIDATED: 'Baseline validated', DELAYED: 'Delayed', STALE: 'Stale', COVERAGE_GAP: 'Coverage gap',
    /*
      THE IMPLEMENTATION CLAUSE IS GONE; THE HONEST HALF IS NOT.

      This read `… — shared coverage authority not yet wired`. The Product Owner's
      data-neutral ruling forbids that register on a reader screen, and names the
      family exactly: *"schema missing", "internal reader unavailable", "provider
      disabled"* belong in engineering/admin evidence. `not yet wired` is the same
      sentence in different words.

      What survives is the half a reader must have: the gap is asserted FROM ABSENCE
      OF EVIDENCE. Without it, a coverage gap reads as a measured finding of no need,
      which is the single most dangerous misreading available on this surface, and
      `notZeroNeed` below exists to prevent exactly it.
    */
    assertedFromAbsence: 'Gap asserted from absence of evidence',
    notZeroNeed: 'Silence here is a gap in coverage. It is not an assessment of no need.',
    whatWouldClose: 'What would close the gap',
  },
  standing: {
    STANDING_CLAIM: 'Standing claim', UNVERIFIED_CLAIM: 'Unverified claim', SUPERSEDED: 'Superseded',
    onRecordNotConverted: 'On record. Not converted into an assessment or a figure.',
    supersededUnavailable: 'Superseded text stated as unavailable — never reconstructed.',
  },
  confidence: { LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High', NOT_APPLICABLE: 'Not applicable' },
  direction: {
    DETERIORATION: 'Deterioration', IMPROVEMENT: 'Improvement', RESTORATION: 'Restoration',
    MIXED: 'Mixed', UNCHANGED: 'Unchanged', NO_DIRECTION_SET: 'No direction set',
  },
  absence: {
    NO_VALIDATED_BASELINE: 'No validated local-source baseline',
    NO_LOCAL_EVIDENCE_IN_PERIOD: 'No local evidence in the current period',
    RIGHTS_UNAVAILABLE:
      'We do not hold the rights to show this. Material on it may exist and may already have been assessed — what is missing is our permission to show it, not the assessment.',
    RIGHTS_RESTRICTED:
      'We may show this only at a coarser precision than the one you are looking at. That is a limit on what we may display here, not a statement about what has been assessed.',
    /* `— dependency recorded for Main` named an internal lane to a reader. The
       dependency is still recorded; it is recorded in the engineering disclosure. */
    AWAITING_SHARED_CONTRACT: 'Awaiting a shared contract',
    NOT_PRODUCIBLE_AT_THIS_PRECISION: 'Not producible at this precision',
    /*
      THE MIDDLE SENTENCE WAS THE ONLY ENGINEERING ONE, AND IT IS THE ONE THAT WENT.

      `the change states that would express it have no producer on this baseline`
      describes our pipeline. The first and last sentences describe the reader's
      situation and the inference they must not draw, and the last one is the whole
      reason this string is long: without *"not a finding that nothing changed"*, a
      reader completes the sentence themselves and completes it wrongly.

      `humContract.spec.ts` asserts this string carries no numeral, and it still
      carries none.
    */
    STATE_NOT_DERIVABLE:
      'Whether this changed cannot be established from what we hold. This is a limit in what we can show — not a finding that nothing changed.',
  },
  spatial: {
    degraded: 'Spatial substrate — degraded',
    countryOutlineOnly: 'Country outline only · no admin shading · no site markers',
    shadingImplies: 'Shading an unassessed area would imply an assessment.',
    noRouteGeometry: 'No route geometry drawn',
    namedEndpointsOnly: 'Named endpoints only',
    notAvailable: 'Named-area table — the geography strip is unavailable at this precision',
  },
  sensitive: {
    title: 'Sensitive-location protection',
    protectionOn: 'On by default',
    noReveal: 'No reveal control exists, at any role.',
    dependency: 'Shared classifier and precision clamp are owned by Main and E1 and are not implemented here.',
  },
  watch: {
    title: 'Watch',
    compositeUnavailable: 'Composite scope unavailable pending upstream',
    triggersInactive: 'Triggers are shown. The binding is not active.',
    notMetered: 'Monitoring is never metered.',
  },
  analysis: {
    title: 'Analysis', storedFree: 'Stored navigation · zero user-metered AI',
    costUnavailable: 'Cost unavailable — cannot invoke',
    deepAnalysis: 'Deep analysis', crossDomain: 'Cross-domain references',
    /* `the reference renderer is unmounted` is implementation state. What a reader
       needs is what they will and will not get: a count, and not the records. */
    referenceCountOnly: 'Count only — the referenced records are not shown here.',
  },
  timeline: {
    title: 'Timeline', historyOfUnderstanding: 'History of the understanding',
    /* `the assessment revision schema does not exist yet` is the forbidden "schema
       missing" verbatim. Availability is the reader-facing fact. */
    unavailable: 'Revision history is not yet available.',
  },
  queue: {
    title: 'Attention queue', cap: 'Capped at 5 · surplus opens in a drawer',
    notAnIncidentFeed: 'Not an incident feed',
    empty: 'No situations carry a derivable change state. This is a legitimate result, not an error.',
    openFull: 'Open full queue in drawer',
  },
  common: {
    close: 'Close', notAssessed: 'Not assessed', noData: 'No data',
    dependencyRecorded: 'Dependency recorded for Main',
    localeFallback: 'Humanitarian copy is not yet authored in this language. Showing English.',
    degradedDefault: 'Degraded state — this is the Beta default, not an error.',
  },
};

/**
 * POLISH — AUTHORED SO FAR, AND DELIBERATELY NOT A CATALOGUE ENTRY.
 *
 * WHAT WENT WRONG. This was `const pl: HumStrings = { ...en, … }`. The spread satisfied
 * the total interface with 27 authored leaves out of 116, so `pl` REGISTERED as complete,
 * `resolveHumStrings('pl')` returned `fellBack: false`, and the disclosure banner never
 * rendered. Measured at runtime: the notice showed on 6 of 6 rows for fr, de, es, pt and
 * ar — and 0 of 6 for Polish.
 *
 * THE HONESTY WAS EXACTLY INVERTED. A French reader got a fully English screen WITH an
 * honest notice. A Polish reader got a mostly English screen WITHOUT one. The locale
 * closest to being finished was the only one lying about it.
 *
 * The `Partial<Record<…>>` + `fellBack` pattern is right, and it works for the five
 * unauthored locales exactly as intended. It works BECAUSE a registered locale is total.
 * `...en` manufactures the one state the pattern exists to make impossible: registered
 * but partial. A total interface cannot catch it — the spread satisfies the type.
 *
 * SO THE DRAFT IS KEPT AND UNREGISTERED. It is deliberately NOT annotated `HumStrings`
 * and deliberately does NOT spread `en`, so it cannot be dropped back into the catalogue
 * without being total — it would not typecheck.
 *
 * NOTHING HERE IS TRANSLATED, EXTENDED OR REWORDED IN THIS LANE. It is the previously
 * authored text, held.
 */
/**
 * POLISH — L'S RATIFIED AUTHORITY, APPLIED; STILL NOT A CATALOGUE ENTRY, AND WHY.
 *
 * `L-HUM-MARKET-PL-CATALOGUE-AUTHORITY-1` (19,189 B / `fb6be911…9332`) is accepted
 * implementation authority and every value below is its wording, unedited. It replaced the
 * 27-leaf `{ ...en }` draft with a total catalogue: 116/116, MISSING 0, EXTRA 0 — against
 * CHECKPOINT 2's interface.
 *
 * F'S RATIFIED ENGLISH MOVED THAT INTERFACE, and the delta is measured rather than assumed:
 *
 *   interface leaves now : 120
 *   L authored           : 116
 *   RETIRED by F (3)     : frames.QUIET · watch.quietResult · absence.PROTECTED_LOCATION_AGGREGATED
 *   UNFILLED (7)         : quietFrame.NOT_DERIVABLE · quietSubtitle.NOT_DERIVABLE
 *                          absenceChrome.NOT_ESTABLISHED · absenceChrome.NOT_SHOWN
 *                          + three leaves L authored against English F has since replaced:
 *                          absence.STATE_NOT_DERIVABLE · absence.RIGHTS_UNAVAILABLE
 *                          · absence.RIGHTS_RESTRICTED
 *
 * THREE OF THE SEVEN ARE FILLED FROM L'S OWN PACKAGE, not from anywhere else:
 * `absenceChrome.NOT_ASSESSED` is L's `Nieocenione` for that exact English, and both
 * `CHECKED_NO_MATERIAL_CHANGE` slots take L's `Sprawdzone — bez istotnej zmiany`, which L
 * authored for precisely that sentence in `04`. The remaining four have no source: L's
 * Polish for them was authored against English the Product Owner has since replaced, and
 * L's own rule governs that case — *"If the Product Owner ratifies different English, the
 * Polish must be re-authored with it."*
 *
 * SO `pl` STAYS UNREGISTERED, AND THAT IS F'S OWN INSTRUCTION, NOT A SHORTFALL CHOSEN HERE.
 * F §4: *"Every string in this authority must either be authored in Polish by L, or its
 * group must fall out of the `pl` catalogue so the fallback banner does its job. Inheriting
 * them silently is the one delivery route that is worse than not correcting them."*
 * Registering now would give a Polish reader four corrected English sentences with
 * `fellBack: false` asserting that nothing fell back — the exact inversion both lanes were
 * convened to remove.
 *
 * THE TERMINOLOGY RULING IS LIVE AND TESTED. `istotna zmiana` throughout; the withdrawn
 * the withdrawn draft form appears in no string in this domain, and a guard fails if it
 * returns — L FIND-A2, which found the obsolete 27-leaf object still live as an `as const`
 * one accidental import away from re-registering. That object is gone; this is the only
 * Polish here.
 *
 * WHAT L NEEDS TO SUPPLY, EXACTLY — four values against F's ratified English:
 *   quietFrame.NOT_DERIVABLE       EN "Change not established"
 *   quietSubtitle.NOT_DERIVABLE    EN "Not checked — no change state could be derived for this situation"
 *   absenceChrome.NOT_ESTABLISHED  EN "Not established"   (STATE_NOT_DERIVABLE + NOT_PRODUCIBLE + AWAITING)
 *   absenceChrome.NOT_SHOWN        EN "Not shown"         (both rights reasons)
 * and three re-authored against F A-2 / B-2 / B-3.
 */
export const HUM_PL_DRAFT_AWAITING_COMPLETION = {
  domain: "Wywiad humanitarny",
  metaTitle: "Wywiad humanitarny — GlobalNews AI",
  metaDescription: "Warunki humanitarne, istotna zmiana, dostęp i niepewność — każdy brak nazwany, a nie wypełniony.",
  frames: {
    ENTRY: "Przegląd i uwaga",
    SELECTED: "Wybrana sytuacja humanitarna",
    GAP: "Luka w pokryciu — nie da się ocenić na obecnych dowodach",
  },
  drawers: {
    POPULATION_NEED: "Ludność dotknięta i profil potrzeb",
    DISPLACEMENT_ACCESS: "Przesiedlenia i dostęp humanitarny",
    EVIDENCE: "Zbiór dowodów i rozbieżne odczyty",
    WATCH: "Konfiguracja obserwacji",
    TIMELINE: "Oś czasu — historia rozumienia sytuacji",
    ANALYSIS: "Analiza międzydomenowa, Zapytaj i Analiza pogłębiona",
  },
  zoneA: {
    jurisdiction: "Jurysdykcja",
    precision: "Precyzja",
    updated: "Aktualizacja",
    coverage: "Pokrycie",
    revision: "Wersja",
    generated: "Wygenerowano",
    scope: "Zakres",
  },
  assessment: {
    title: "Ocena",
    noAssessment: "Nie wydano oceny",
    confidence: "Pewność",
    direction: "Kierunek",
    changeState: "Stan zmiany",
  },
  need: {
    title: "Potrzeby według sektorów",
    noComposite: "Brak wyniku zbiorczego",
    sector: "Sektor",
    level: "Poziom",
    basis: "Podstawa",
    perAreaPerMethod: "Na obszar · na metodę",
  },
  sectors: {
    WATER: "Woda",
    SHELTER: "Schronienie",
    FOOD: "Żywność",
    HEALTH: "Zdrowie",
    SANITATION: "Sanitacja",
    PROTECTION: "Ochrona",
  },
  needLevels: {
    NO_ASSESSED_NEED: "Brak ocenionej potrzeby",
    STRESSED: "Podwyższone",
    SEVERE: "Poważne",
    CRITICAL: "Krytyczne",
    NOT_ASSESSED: "Nieocenione",
  },
  access: {
    title: "Warunki dostępu",
    ownAxis: "Własna oś · własna wersja",
    OPEN: "Otwarty",
    CONSTRAINED: "Ograniczony",
    SEVERELY_CONSTRAINED: "Poważnie ograniczony",
    DENIED: "Zablokowany",
    NOT_ASSESSED: "Nieoceniony",
    notAssessedIsNotOpen: "Nieoceniony nie znaczy otwarty.",
    causeReferenced: "Przyczyna wskazana, nieoceniana tutaj",
  },
  coverage: {
    BASELINE_VALIDATED: "Podstawa zwalidowana",
    DELAYED: "Opóźnione",
    STALE: "Nieaktualne",
    COVERAGE_GAP: "Luka w pokryciu",
    assertedFromAbsence: "Luka stwierdzona na podstawie braku dowodów — wspólna instancja odpowiadająca za pokrycie nie jest jeszcze podłączona",
    notZeroNeed: "Cisza w tym miejscu to luka w pokryciu. To nie jest ocena braku potrzeb.",
    whatWouldClose: "Co zamknęłoby lukę",
  },
  standing: {
    STANDING_CLAIM: "Twierdzenie obowiązujące",
    UNVERIFIED_CLAIM: "Twierdzenie niezweryfikowane",
    SUPERSEDED: "Zastąpione",
    onRecordNotConverted: "Odnotowane. Nieprzekształcone w ocenę ani w liczbę.",
    supersededUnavailable: "Zastąpiony tekst oznaczony jako niedostępny — nigdy nieodtwarzany.",
  },
  confidence: {
    LOW: "Niska",
    MODERATE: "Umiarkowana",
    HIGH: "Wysoka",
    NOT_APPLICABLE: "Nie dotyczy",
  },
  direction: {
    DETERIORATION: "Pogorszenie",
    IMPROVEMENT: "Poprawa",
    RESTORATION: "Przywrócenie",
    MIXED: "Mieszany",
    UNCHANGED: "Bez zmian",
    NO_DIRECTION_SET: "Nie ustalono kierunku",
  },
  absence: {
    NO_VALIDATED_BASELINE: "Brak zwalidowanej podstawy ze źródeł lokalnych",
    NO_LOCAL_EVIDENCE_IN_PERIOD: "Brak lokalnych dowodów w bieżącym okresie",
    RIGHTS_UNAVAILABLE: "Prawa do źródła niedostępne — źródło może istnieć i może nie zostać pokazane",
    RIGHTS_RESTRICTED: "Prawa do źródła ograniczone — prezentacja na tej precyzji jest niedozwolona",
    AWAITING_SHARED_CONTRACT: "Oczekiwanie na wspólny kontrakt — zależność odnotowana dla Main",
    NOT_PRODUCIBLE_AT_THIS_PRECISION: "Nie da się wytworzyć na tej precyzji",
    STATE_NOT_DERIVABLE: "Nie da się wyprowadzić stanu — to nie jest „brak istotnej zmiany”",
  },
  spatial: {
    degraded: "Podkład przestrzenny — ograniczony",
    countryOutlineOnly: "Tylko kontur kraju · bez cieniowania jednostek · bez znaczników miejsc",
    shadingImplies: "Cieniowanie nieocenionego obszaru sugerowałoby ocenę.",
    noRouteGeometry: "Nie rysujemy geometrii tras",
    namedEndpointsOnly: "Tylko nazwane punkty końcowe",
    notAvailable: "Tabela nazwanych obszarów — pas geograficzny jest niedostępny na tej precyzji",
  },
  sensitive: {
    title: "Ochrona lokalizacji wrażliwych",
    protectionOn: "Włączona domyślnie",
    noReveal: "Nie istnieje żadna kontrolka ujawniania, w żadnej roli.",
    dependency: "Wspólny klasyfikator i ogranicznik precyzji należą do Main i E1 i nie są tutaj zaimplementowane.",
  },
  watch: {
    title: "Obserwacja",
    compositeUnavailable: "Zakres zbiorczy niedostępny — oczekuje na warstwę nadrzędną",
    triggersInactive: "Wyzwalacze są pokazane. Powiązanie nie jest aktywne.",
    notMetered: "Monitorowanie nigdy nie jest rozliczane.",
  },
  analysis: {
    title: "Analiza",
    storedFree: "Nawigacja po zapisanych danych · zero AI rozliczanego użytkownikowi",
    costUnavailable: "Koszt niedostępny — nie można uruchomić",
    deepAnalysis: "Analiza pogłębiona",
    crossDomain: "Odniesienia międzydomenowe",
    referenceCountOnly: "Tylko liczba — renderer odniesień nie jest zamontowany.",
  },
  timeline: {
    title: "Oś czasu",
    historyOfUnderstanding: "Historia rozumienia sytuacji",
    unavailable: "Historia wersji jest niedostępna — schemat wersji oceny jeszcze nie istnieje.",
  },
  queue: {
    title: "Kolejka uwagi",
    cap: "Limit 5 · nadmiar otwiera się w szufladzie",
    notAnIncidentFeed: "To nie jest strumień zdarzeń",
    empty: "Żadna sytuacja nie ma stanu zmiany, który dałoby się wyprowadzić. To prawidłowy wynik, a nie błąd.",
    openFull: "Otwórz pełną kolejkę w szufladzie",
  },
  common: {
    close: "Zamknij",
    notAssessed: "Nieocenione",
    noData: "Brak danych",
    dependencyRecorded: "Zależność odnotowana dla Main",
    localeFallback: "Treści humanitarne nie są jeszcze opracowane w tym języku. Pokazujemy wersję angielską.",
    degradedDefault: "Stan ograniczony — to domyślne zachowanie w wersji Beta, a nie błąd.",
  },
  /*
    L-DUAL-VISUAL-RUNTIME-QA-2 · 04-PL-AUTHORITY-REMAP-119, applied where it maps.

    L's remap targets CHECKPOINT 3's four-class chrome. F's ratified English merged two of
    those four into one class (`Not established` = NOT_DERIVABLE + NOT_AVAILABLE + the
    awaiting-contract reason), so two of L's four values map one-for-one and the merged
    class has no single Polish value. That is reported, not papered over.

      NOT_ASSESSED  <- L 'Nieocenione'        same class, same reasons
      NOT_SHOWN     <- L 'Nieprezentowane'    L's own gloss is "rights-blocked — it may
                                              exist and may not be shown", which is F's
                                              `Not shown` class exactly
      NOT_ESTABLISHED  — UNFILLED. L supplies 'Niedostępne' and 'Niewyprowadzalne' for the
                         two halves F merged; picking either would narrow the class, and
                         inventing a third is not this lane's to do.
  */
  absenceChrome: {
    NOT_ASSESSED: 'Nieocenione',
    NOT_SHOWN: 'Nieprezentowane',
  },
  /*
    L's `CHECKED_NO_MATERIAL_CHANGE` is authored for exactly F's A-5 sentence, so it
    applies to both slots. L's `NOT_DERIVABLE` was authored for the checkpoint-3 sentence,
    which F's A-3 / A-4 replaced — L's own rule governs: "If the Product Owner ratifies
    different English, the Polish must be re-authored with it."
  */
  quietFrame: {
    CHECKED_NO_MATERIAL_CHANGE: 'Sprawdzone — bez istotnej zmiany',
  },
  quietSubtitle: {
    CHECKED_NO_MATERIAL_CHANGE: 'Sprawdzone — bez istotnej zmiany',
  },
} as const;

/** Authored content only. A locale absent from this map is REPORTED, never guessed. */
const HUM_CATALOGUE: Partial<Record<HumLocale, HumStrings>> = { en };

export interface HumStringsResolution {
  readonly strings: HumStrings;
  readonly requested: HumLocale;
  readonly resolved: HumLocale;
  readonly fellBack: boolean;
}

/** Resolution with the fallback made visible, never silent. */
export function resolveHumStrings(locale: HumLocale): HumStringsResolution {
  const found = HUM_CATALOGUE[locale];
  if (found) return { strings: found, requested: locale, resolved: locale, fellBack: false };
  return { strings: en, requested: locale, resolved: 'en', fellBack: true };
}

export function humStrings(locale: HumLocale): HumStrings {
  return resolveHumStrings(locale).strings;
}

/** Contracted locales with no authored Humanitarian content yet. Reported, not hidden. */
export function humLocalesAwaitingContent(locales: readonly HumLocale[]): HumLocale[] {
  return locales.filter((l) => HUM_CATALOGUE[l] === undefined);
}

/**
 * THE ONLY WAY A FRAME LABEL IS READ.
 *
 * Three frames have a stated name. The fourth's name IS a claim about whether anyone
 * looked, so it is resolved from the change slot instead of being looked up — which is
 * why this function takes the slot and why `frames` has no QUIET key to fall back to.
 */
export function humFrameLabel(
  t: HumStrings,
  frame: 'ENTRY' | 'SELECTED' | 'GAP' | 'QUIET',
  change: ChangeStateSlot,
): string {
  return frame === 'QUIET' ? t.quietFrame[quietClaimFor(change)] : t.frames[frame];
}

/** The chrome above a reason, derived. There is no constant to be wrong. */
export function humAbsenceChrome(t: HumStrings, reason: AbsenceReason): string {
  return t.absenceChrome[ABSENCE_CHROME[reason]];
}
