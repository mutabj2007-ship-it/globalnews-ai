/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART XI ENERGY — THE FRAME CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This module is the single place where Part XI's reader vocabulary, Main's
 * reconciled rulings and the security gates meet. Components read from here;
 * none of them re-decides any of it.
 *
 * AUTHORITIES CONSUMED
 *   Design   `GlobalNewsAI Part XI - Energy Intelligence v1.0 Review.zip`
 *            sha256 fa61230008e73dd22e1f70a6c6c1229fd26339e3a36d65cfa94d904314106b28
 *   Main     `MAIN-ENERGY-PARTXI-RECONCILIATION-R1.zip`
 *            sha256 7e4b0caeeaeec8e876ed35af43dae5b54c6bc7f5d75dc85f5fee6333ab0ebe70
 *            contracts/SEND-TO-H-ENERGY-PARTXI-R1.md · matrices/*
 *
 * ── THE RULE THAT OUTRANKS EVERY OTHER, CARRIED VERBATIM ──────────────────
 *
 *   "Silence must never imply stable supply, no outage, no disruption, normal
 *    operations, or safety. Every zone with nothing to show says WHY there is
 *    nothing."
 *
 * That is why this file has no "ok", no "normal", no "healthy" and no green
 * outside MINT — and why `ENERGY_READER_STATES` is closed: a zone that cannot
 * name its absence has no way to render at all.
 */

/* ══ 1 · SHELL STATE ═══════════════════════════════════════════════════════
   H01: ONE route family, with substrate · subject · window as URL-encoded
   state. The state count is not the route count — 25 board states resolve to
   1 shell, 3 substrates, 1 HUD, 1 drawer, 1 lens, 1 sheet, 2 overlays. */

/** A · spatial · C · change · B · flows. Substrate is shell state, never navigation. */
export type EnergySubstrate = 'spatial' | 'change' | 'flows';
export const ENERGY_SUBSTRATES: readonly EnergySubstrate[] = ['spatial', 'change', 'flows'];
export const ENERGY_DEFAULT_SUBSTRATE: EnergySubstrate = 'spatial';

export type EnergyWindow = 'visit' | '24h' | '7d' | '30d';
export const ENERGY_WINDOWS: readonly EnergyWindow[] = ['visit', '24h', '7d', '30d'];

/**
 * ── WHY THE DEFAULT IS 7D AND NOT "SINCE LAST VISIT" ──────────────────────
 *
 * The frozen design's own R01 says it, and Main's M05 disposition repeats it:
 *
 *   R01  '"Since last visit" assumes a Main-provided visit checkpoint;
 *         fallback to 7D with an explicit window label when absent.'
 *   M05  'OPEN — PRODUCT OWNER … Part XI already ships the correct fallback:
 *         7D with an explicit window label. So this blocks nothing.'
 *
 * The platform has no per-reader visit checkpoint, so `visit` is NOT SILENTLY
 * SUBSTITUTED: selecting it resolves to 7D and the window label says, in the
 * reader's own language, that no checkpoint is available. A silent substitution
 * would be the shell implying a personalisation it does not have.
 */
export const ENERGY_DEFAULT_WINDOW: EnergyWindow = '7d';

/** True when the shell must state the fallback rather than the requested window. */
export function windowFallsBackToSevenDay(requested: EnergyWindow, hasVisitCheckpoint: boolean): boolean {
  return requested === 'visit' && !hasVisitCheckpoint;
}

/** The window actually in force once M05's absence is accounted for. */
export function effectiveWindow(requested: EnergyWindow, hasVisitCheckpoint: boolean): EnergyWindow {
  return windowFallsBackToSevenDay(requested, hasVisitCheckpoint) ? '7d' : requested;
}

/** Transient surfaces. Two overlays, per R04 — not routes, and never both at once. */
export type EnergyOverlay = 'lens' | 'ask';

/** Compact sheet stages. H05 — one sheet, three stages, below 700px. */
export type EnergySheetStage = 'peek' | 'half' | 'full';
export const ENERGY_SHEET_STAGES: readonly EnergySheetStage[] = ['peek', 'half', 'full'];

/** The handle cycles the three stages, in this order. */
export function nextSheetStage(stage: EnergySheetStage): EnergySheetStage {
  return stage === 'peek' ? 'half' : stage === 'half' ? 'full' : 'peek';
}

/** Entitlement. R12 — one shell; FREE and PROFESSIONAL are a delta, not a product. */
export type EnergyTier = 'free' | 'professional';
/**
 * M05 is OPEN and entitlement gates are a Product Owner decision. Main:
 * "default FREE; violet marks the boundary". Nothing here grants PROFESSIONAL.
 */
export const ENERGY_DEFAULT_TIER: EnergyTier = 'free';

/* ══ 2 · THE FOUR SUBJECT TYPES — M04 RULED ════════════════════════════════
   "The four Energy subject types are: Energy Supply Situation · Energy
    Corridor · Energy Infrastructure Asset · Grid Situation."
   Generation System and Energy Transition Programme stay DEFERRED per R03 and
   are absent from this union rather than commented into it. */

export type EnergySubjectType = 'SUPPLY_SITUATION' | 'CORRIDOR' | 'INFRASTRUCTURE_ASSET' | 'GRID_SITUATION';
export const ENERGY_SUBJECT_TYPES: readonly EnergySubjectType[] = [
  'SUPPLY_SITUATION',
  'CORRIDOR',
  'INFRASTRUCTURE_ASSET',
  'GRID_SITUATION',
];

/**
 * Chokepoint is a ROLE on `Energy Corridor`, not a type — M04, ruled by Main
 * after Part XI R02/R03 resolved it that way. A role is not an identity, so no
 * new identity space opens and `ENERGY_SUBJECT_TYPES` stays at four.
 */
export type EnergyCorridorRole = 'chokepoint' | 'route';
export type EnergyAssetRole = 'terminal' | 'refinery' | 'storage' | 'interconnector';

/* ══ 3 · SPATIAL PRECISION — R10, AND IT IS MANDATORY ══════════════════════
   ZONE-TO-DATA, precision badge row: "never absent — a geometry without a
   precision statement must not render." That is enforced by the type: every
   geometry in this frame carries `precision`, and there is no nullable form. */

export type EnergyPrecision = 'CORRIDOR_25KM' | 'ROUTE_LEVEL' | 'ASSET_LEVEL' | 'REGION_LEVEL';

/**
 * A system scope has NO GEOMETRY FIELD TO POPULATE — not a nullable one, an
 * absent one (GEOGRAPHY-SYSTEM-SCOPE: "No point geometry is fabricated from a
 * system scope"). Grid situations, bidding zones and derived regional supply
 * situations are system scopes. There is nothing for a renderer to centre on,
 * which is precisely why it cannot invent a marker.
 */
export type EnergySpatialKind = 'line' | 'region' | 'systemScope';

export function systemScopeMayCarryGeometry(kind: EnergySpatialKind): boolean {
  return kind !== 'systemScope';
}

/* ══ 4 · THE FOUR READER ABSENCE STATES ════════════════════════════════════
   Frozen treatment (README §4) mapped onto Main's canonical members
   (RECONCILIATION §4). The mapping is ONE-WAY: canonical -> reader. */

export type EnergyReaderState =
  /** Evidence reviewed, assessment unchanged. A RESULT, not an absence of data. */
  | 'NO_MATERIAL_CHANGE'
  /** Insufficient source coverage to assess. Assessment WITHHELD, never inferred. */
  | 'COVERAGE_GAP'
  /** Capability exists; the current data tier does not provide it. */
  | 'UNAVAILABLE_LICENSED'
  /** No available record. */
  | 'NO_DATA';

export const ENERGY_READER_STATES: readonly EnergyReaderState[] = [
  'NO_MATERIAL_CHANGE',
  'COVERAGE_GAP',
  'UNAVAILABLE_LICENSED',
  'NO_DATA',
];

/** Border treatment is load-bearing: the four states are separated by TREATMENT as well as label. */
export type EnergyStateTreatment = 'solidAchromatic' | 'dashedAchromatic' | 'solidViolet' | 'labelOnly';

export const ENERGY_STATE_TREATMENT: Readonly<Record<EnergyReaderState, EnergyStateTreatment>> = {
  NO_MATERIAL_CHANGE: 'solidAchromatic',
  COVERAGE_GAP: 'dashedAchromatic',
  UNAVAILABLE_LICENSED: 'solidViolet',
  NO_DATA: 'labelOnly',
};

/**
 * ── THE CANONICAL MEMBERS, CARRIED SO THE DISTINCTION SURVIVES ────────────
 *
 * This is NOT a declaration of the shared absence union — that union is Main's
 * and is PROPOSED/UNLANDED (DEPENDENCY-MATRIX row 16). These are the member
 * NAMES, consumed as strings, so a record's canonical member can ride into the
 * DOM on a data attribute even where the reader sees one chip.
 *
 * Main's standing instruction, and the reason this exists at all:
 *
 *   "NOT_CONNECTED and TEMPORARILY_UNAVAILABLE have no Part XI reader state …
 *    They must not be collapsed into COVERAGE GAP — the standing CTO ruling
 *    forbids exactly that collapse. ACTION for H: render the nearest Part XI
 *    state AND carry the canonical member in the data attribute, so the
 *    distinction survives into telemetry even where the reader sees one chip."
 *
 * So the collapse is prevented by construction: the reader chip and the
 * canonical member are two independent fields, and nothing in this frame reads
 * one off the other.
 */
export type EnergyCanonicalAbsence =
  | 'NO_DATA_FOR_GEOGRAPHY'
  | 'TIER_RESTRICTED'
  | 'NOT_BUILT'
  | 'NO_DATA'
  | 'NOT_CONNECTED'
  | 'TEMPORARILY_UNAVAILABLE';

/** The nearest reader state for a canonical member. Never the reverse. */
export function readerStateForCanonical(member: EnergyCanonicalAbsence): EnergyReaderState {
  switch (member) {
    case 'NO_DATA_FOR_GEOGRAPHY':
      return 'COVERAGE_GAP';
    case 'TIER_RESTRICTED':
      return 'UNAVAILABLE_LICENSED';
    case 'NOT_BUILT':
    case 'NO_DATA':
      return 'NO_DATA';
    /*
      OPERATOR CONDITIONS. They have no Part XI reader state, and that is
      correct and deliberate. The nearest reader state is NO_DATA — "no
      available record" — and NOT coverage gap, because a coverage gap is a
      statement about SOURCES and these are statements about a CONNECTION.
      The canonical member rides the data attribute regardless, which is what
      keeps the two apart downstream.
    */
    case 'NOT_CONNECTED':
    case 'TEMPORARILY_UNAVAILABLE':
      return 'NO_DATA';
  }
}

/**
 * NO MATERIAL CHANGE has no canonical absence member, because it is not an
 * absence. It is the product's paid output: evidence was reviewed and the
 * assessment held. Rendering it as "no data" is the single most expensive
 * mistake available on this surface, so it is unreachable from this function.
 */
export function canonicalMemberFor(state: EnergyReaderState): EnergyCanonicalAbsence | null {
  switch (state) {
    case 'NO_MATERIAL_CHANGE':
      return null;
    case 'COVERAGE_GAP':
      return 'NO_DATA_FOR_GEOGRAPHY';
    case 'UNAVAILABLE_LICENSED':
      return 'TIER_RESTRICTED';
    case 'NO_DATA':
      return 'NO_DATA';
  }
}

/**
 * NO MATERIAL CHANGE may only be claimed when evidence was actually reviewed.
 * ZONE-TO-DATA, corridor-marker row: "no assessment -> NO MATERIAL CHANGE only
 * if evidence was reviewed; otherwise COVERAGE GAP." Withholding is the answer,
 * so the quiet state cannot be reached by having looked at nothing.
 */
export function quietStateFor(artifactsReviewed: number): EnergyReaderState {
  return artifactsReviewed > 0 ? 'NO_MATERIAL_CHANGE' : 'COVERAGE_GAP';
}

/* ══ 5 · DATA TIERS — R09 ══════════════════════════════════════════════════ */

export type EnergyDataTier =
  | 'PUBLIC'
  | 'PERIODIC'
  | 'OPERATOR_REPORTED'
  /** Off in Beta by design; renders as UNAVAILABLE. */
  | 'LICENSED'
  /** Vessel telemetry, SCADA, private grid telemetry, exact plant sensors. */
  | 'NOT_AVAILABLE';

/** "No real-time feed is simulated." Both of these render as UNAVAILABLE, always. */
export function tierRendersUnavailable(tier: EnergyDataTier): boolean {
  return tier === 'LICENSED' || tier === 'NOT_AVAILABLE';
}

/* ══ 6 · SECURITY AND RIGHTS GATES ═════════════════════════════════════════
   RIGHTS-SECURITY-MATRIX: three independent questions, and

     "H answers neither. A frontend may not resolve a rights or sensitivity
      question by choosing a renderer, a zoom limit or a rounding."

   So the gates are represented, not decided. Each one names its owner and the
   ONE feature it governs; a gate never widens to stop a neighbouring zone. */

export type EnergyGateId = 'E01' | 'E02' | 'E03' | 'E04' | 'G01' | 'G02' | 'G03' | 'G04' | 'M01' | 'M02' | 'M05' | 'M07';

export interface EnergyGate {
  readonly id: EnergyGateId;
  readonly owner: 'E1' | 'G' | 'Main' | 'ProductOwner' | 'platform';
  /** The one feature this gate stops. Nothing else. */
  readonly stops: string;
  /** What it explicitly does NOT stop — the reason a blocked gate cannot spread. */
  readonly doesNotStop: string;
}

export const ENERGY_GATES: Readonly<Record<EnergyGateId, EnergyGate>> = {
  E01: { id: 'E01', owner: 'E1', stops: 'asset-level geometry', doesNotStop: 'corridor, route and region geometry; the whole spatial substrate' },
  E02: { id: 'E02', owner: 'E1', stops: 'Watch on infrastructure', doesNotStop: 'Watch on situations, corridors and grid situations' },
  E03: { id: 'E03', owner: 'E1', stops: 'licensed and sensitive series handling', doesNotStop: 'public and periodic evidence' },
  E04: { id: 'E04', owner: 'E1', stops: 'the "what to monitor next" surface', doesNotStop: 'assessment, uncertainty, timeline, evidence' },
  G01: { id: 'G01', owner: 'G', stops: 'source licence position', doesNotStop: 'every absence state' },
  G02: { id: 'G02', owner: 'G', stops: 'which corridors and assets carry geometry', doesNotStop: 'base geography and the precision ladder' },
  G03: { id: 'G03', owner: 'G', stops: 'freshness and next-check cadence', doesNotStop: 'the last-checked field itself' },
  G04: { id: 'G04', owner: 'G', stops: 'the real UNAVAILABLE / COVERAGE GAP distribution', doesNotStop: 'rendering all four states' },
  M01: { id: 'M01', owner: 'Main', stops: "the change grid's WORDS", doesNotStop: 'its geometry, density, rows and roving tabindex' },
  M02: { id: 'M02', owner: 'platform', stops: 'canonical token mapping', doesNotStop: 'nothing — the frozen placeholders implement unchanged' },
  M05: { id: 'M05', owner: 'ProductOwner', stops: '"since last visit" and entitlement gating', doesNotStop: 'the 7D fallback with an explicit window label' },
  M07: { id: 'M07', owner: 'ProductOwner', stops: 'Sand prices', doesNotStop: 'the priced-before-execution handoff itself' },
};

/* ══ 7 · COST — AND THE PRICE MAIN HAS NOT SET ═════════════════════════════ */

/**
 * Ask AI is 0 Sand and is NOT a compute engine. It answers from stored
 * assessments, stored evidence and stored cross-domain references; any new
 * synthesis is an explicit handoff to the shared Workspace / Deep Analysis
 * path, priced before execution. M07's structural half is ruled; only the
 * NUMBERS are open.
 */
export type EnergyCostClass = 'ZERO_STORED' | 'METERED_HANDOFF';

/**
 * ZONE-TO-DATA, Sand affordance row:
 *
 *   "price unknown -> affordance shows the action, NEVER A NUMBER MAIN DID
 *    NOT SET"
 *
 * and Main's M07 disposition: "The Sand numbers (12/18/24) are illustrative and
 * Main does not set prices."
 *
 * So the frozen design's 12 / 18 / 24 / 142 are NOT rendered as prices by this
 * implementation. They are design fixtures for a pricing table that does not
 * exist. This sentinel is what a price slot carries instead, and it is a
 * TYPE-LEVEL absence: there is no number to accidentally print.
 */
export const ENERGY_PRICE_UNSET = Symbol('energy.price.unset');
export type EnergyPrice = typeof ENERGY_PRICE_UNSET;

/** There is exactly one price resolver and it returns the sentinel, until M07. */
export function energySandPrice(): EnergyPrice {
  return ENERGY_PRICE_UNSET;
}

/* ══ 8 · SOURCE CLASSES — R08 ══════════════════════════════════════════════
   Twelve classes. Each artifact carries class, role, observed time and
   language. "Authority is stated per artifact and claim, never implied by
   institution branding." */

export const ENERGY_SOURCE_CLASSES = [
  'GOVERNMENT',
  'REGULATOR',
  'TSO_GRID_OPERATOR',
  'ENERGY_COMPANY',
  'PORT_TERMINAL',
  'STATISTICAL_INSTITUTION',
  'INTERGOVERNMENTAL',
  'INDUSTRY_REPORTING',
  'LOCAL_MEDIA',
  'REGIONAL_MEDIA',
  'INTERNATIONAL_MEDIA',
  'COMMERCIAL_LICENSED',
] as const;
export type EnergySourceClass = (typeof ENERGY_SOURCE_CLASSES)[number];

/** supports · context · partial · disputed. Disputed artifacts are RETAINED AND LABELLED, never hidden. */
export type EnergyEvidenceRole = 'SUPPORTS' | 'CONTEXT' | 'PARTIAL' | 'DISPUTED';

/** There is no filter, flag or branch anywhere in this frame that removes a disputed artifact. */
export function evidenceIsHidden(_role: EnergyEvidenceRole): false {
  return false;
}

/* ══ 9 · UNITS — RENDER WHAT THE RECORD CARRIES ════════════════════════════
   UNITS-AUTHORITY: "render the unit as the record carries it. Do not convert,
   scale, abbreviate across dimensions, or infer a unit from a number's
   magnitude." There is deliberately no factor table in this file, because
   "a factor table with three safe rows is where the fourth, unsafe row gets
   added." A bare `MW` is ambiguous with Malawi's iso2, which is why the
   namespace is not optional. */

export type EnergyUnit = `ene:${string}`;

export interface EnergyReading {
  readonly value: string;
  readonly unit: EnergyUnit;
  readonly dimension: 'rate' | 'quantity' | 'ratio';
}

/** Formats a reading. It cannot convert, because nothing here knows how. */
export function formatEnergyReading(reading: EnergyReading): string {
  return `${reading.value} ${reading.unit.slice('ene:'.length)}`;
}

/* ══ 10 · THE ZONE CENSUS ══════════════════════════════════════════════════
   Every Part XI zone named by ZONE-TO-DATA, so the frame can be asserted
   complete by measurement rather than by reading. A zone in this list MUST
   render something in the governed frame — its absence state if nothing else.
   "No zone requires a value to exist." */

export const ENERGY_ZONES = [
  'shell.contextBar',
  'shell.substrateSwitcher',
  'shell.window',
  'shell.tier',
  'shell.sand',
  'shell.rail',
  'shell.watchSummary',
  'spatial.substrate',
  'spatial.corridorMarker',
  'spatial.assetMarker',
  'spatial.precisionBadge',
  'spatial.layers',
  'spatial.hud',
  'drawer',
  'lens',
  'change.grid',
  'change.revisionSpine',
  'flows.sankey',
  'flows.dependence',
  'flows.storage',
  'flows.locator',
  'crossDomain',
  'watch',
  'ask',
  'workspaceEntry',
] as const;
export type EnergyZone = (typeof ENERGY_ZONES)[number];

/** The cross-domain references Energy may make. It references; it never restates. */
export const ENERGY_CROSS_DOMAINS = ['MARKET', 'ECONOMY', 'SECURITY', 'CONFLICT', 'POLITICS', 'HUMANITARIAN'] as const;
export type EnergyCrossDomain = (typeof ENERGY_CROSS_DOMAINS)[number];

/**
 * "no assessed energy-access consequence" is a VALID reference state — a
 * reference that finds nothing says so rather than rendering blank.
 */
export type EnergyCrossDomainState = 'STORED_SUMMARY' | 'NO_ASSESSED_CONSEQUENCE';
