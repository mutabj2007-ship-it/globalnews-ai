import type { SeriesDisclosure } from '@/lib/energy/energyDisclosure';
import {
  PART_XI_PLACEHOLDER_DECOMPOSITION,
  type ChangeState,
} from '@/lib/observation/changeState';
import type {
  EnergyChangeRow,
  EnergyDependenceRow,
  EnergyFeedItem,
  EnergyFlowLink,
  EnergyFlowNode,
  EnergyFrameData,
  EnergyRowMeta,
  EnergyStorageRow,
  EnergySubject,
} from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE FROZEN DESIGN'S OWN FIXTURES — CARRIED, NEVER AUTHORED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROVENANCE
 *   `GlobalNewsAI Part XI - Energy Intelligence v1.0 Review.zip`
 *   sha256 fa61230008e73dd22e1f70a6c6c1229fd26339e3a36d65cfa94d904314106b28
 *   file   `Energy Intelligence v1.0.dc.html`
 *   sha256 72a7eb04f425442badb487e61df3dc42677eb8aea3cfe2a2d2377cc5421e4c62
 *
 * EVERY VALUE BELOW WAS TRANSCRIBED FROM THAT FILE. Not one was invented here,
 * adjusted, rounded, extended or filled in. Where the design had no value, this
 * file has no value. The design states the rule these obey, and the frame
 * renders its banner permanently in this mode so a reader cannot mistake them:
 *
 *   "Every value in this package is a DESIGN FIXTURE, not an intelligence
 *    finding. Energy data contracts with G/Main are not concluded."
 *
 * ── WHY THIS SET EXISTS AT ALL ────────────────────────────────────────────
 *
 * Contract item 10 asks for a frame in which "every zone renders WITH FIXTURES
 * AND with each of the four absence states". A zone that has only ever rendered
 * empty has not been shown to render. This set is how the populated geometry of
 * every zone is proved against the frozen shell — the conformance input, not a
 * data claim. `/energy` alone never serves it; it needs `?frame=design-fixture`.
 *
 * ── WHAT WAS DELIBERATELY NOT CARRIED ─────────────────────────────────────
 *
 * The SAND PRICES. The design shows 12 / 18 / 24 and a 142 balance; Main ruled
 * "the Sand numbers are illustrative and Main does not set prices", and
 * ZONE-TO-DATA says the affordance shows the action and "never a number Main
 * did not set". So no price crossed over, in either frame. That is the single
 * place where this file is narrower than the design, and it is narrower on
 * Main's instruction rather than on judgement.
 */


/**
 * ── R2 · THE FIXTURE PHRASES, DECOMPOSED ONTO MAIN'S TWO AXES ────────────
 *
 * Main decomposed the SEVEN frozen Part XI placeholders and shipped the table as
 * data (`PART_XI_PLACEHOLDER_DECOMPOSITION`) *"so the migration is checkable
 * rather than remembered"*. This resolver consults that table FIRST and never
 * overrides it.
 *
 * The frozen shell's own fixtures also use phrases beyond those seven — they are
 * timeline-entry labels rather than vocabulary members. Mapping those onto the
 * two axes is H's reading of the design's own assessment text, so each one is
 * listed with the sentence it was read from, and **no axis member is invented**:
 * the service axis has five members and the cause axis three, exactly as Main
 * declared them.
 *
 * An unmapped phrase THROWS. A silent `null` would put a fixture on screen with
 * no change state and no way to notice, which is the class of quiet failure this
 * frame exists to refuse.
 */
const FIXTURE_PHRASE_DECOMPOSITION: Readonly<Record<string, ChangeState>> = {
  /* "Transit conditions assessed as degraded … no confirmed closure." */
  'DEVELOPING · UNRESOLVED': { service: 'DISRUPTION_OBSERVED', cause: 'CAUSE_OPEN' },
  'DEVELOPING': { service: 'DISRUPTION_OBSERVED', cause: 'CAUSE_OPEN' },
  /* "Both TSOs confirm unavailability" — the condition moved; the cause line is separate. */
  'OUTAGE CONFIRMED': { service: 'DISRUPTION_OBSERVED', cause: 'CAUSE_NOT_ASSESSED' },
  /* "Transit resumed … the cause remains unassessed and recurrence risk is retained." */
  'RESTORED · CAUSE UNRESOLVED': { service: 'RESTORED', cause: 'CAUSE_OPEN' },
  'RESTORED · CAUSE OPEN': { service: 'RESTORED', cause: 'CAUSE_OPEN' },
  /* "One additional October slot was published, WHICH DOES NOT ALTER CURRENT SUPPLY." */
  'CAPACITY CHANGE': { service: 'NO_MATERIAL_CHANGE', cause: 'CAUSE_NOT_ASSESSED' },
  /* Evidence events move neither axis: they record what was read, not what moved. */
  'EVIDENCE DISPUTED': { service: 'NO_MATERIAL_CHANGE', cause: 'CAUSE_NOT_ASSESSED' },
  'EVIDENCE NOTED': { service: 'NO_MATERIAL_CHANGE', cause: 'CAUSE_NOT_ASSESSED' },
  /* "LitPol redistribution observed; no consumer interruption." */
  'LOAD REDISTRIBUTED': { service: 'SUPPLY_IMPACT_OBSERVED', cause: 'CAUSE_NOT_ASSESSED' },
  /* A scheduled statistical refresh. Nothing moved and nothing was asked about why. */
  'PERIODIC UPDATE': { service: 'NO_MATERIAL_CHANGE', cause: 'CAUSE_NOT_ASSESSED' },
  /* "Naval activity assessed as proximate factor — confidence moderate." */
  'CAUSE ASSESSED': { service: 'NO_MATERIAL_CHANGE', cause: 'CAUSE_ASSESSED' },
  /*
    "Transit resumed at reduced throughput; CAUSE NOT ASSESSED." — the timeline
    entry, at the moment it was written. It is deliberately NOT the same as the
    subject's current `RESTORED · CAUSE UNRESOLVED`: the entry records that
    nobody had looked yet, the subject records that somebody has and it is
    unresolved. Collapsing those two would be the A-24 failure the cause axis
    has three members to prevent.
  */
  'RESTORED': { service: 'RESTORED', cause: 'CAUSE_NOT_ASSESSED' },
};

/**
 * ── R2 · THE TWO DISCLOSURE AXES, SET SEPARATELY ─────────────────────────
 *
 * `ENTITLEMENT` is a true entitlement case: exposure was assessed and allowed,
 * rights are blocked. It renders violet and truthfully — paying WOULD reveal it.
 *
 * `REFUSED` is E03-3, carried: vessel- and cargo-resolved series are *"refused
 * REGARDLESS OF LICENCE"*, because a commercial product that reconstitutes
 * per-vessel movement is R09's `NOT AVAILABLE` capability *"bought rather than
 * fetched, and the licence changes only the invoice."* Exposure dominates, so
 * it renders as COVERAGE GAP — indistinguishable from a benign gap, which is
 * D-1, and never violet, which is D-2.
 *
 * Both are present on the same surface deliberately: that is the negative
 * control which keeps the exposure rule from being a constant.
 */
const ENTITLEMENT: SeriesDisclosure = { rights: 'RIGHTS_BLOCKED', exposure: 'EXPOSURE_ALLOWED' };
const REFUSED: SeriesDisclosure = { rights: 'RIGHTS_BLOCKED', exposure: 'EXPOSURE_REFUSED' };

function cs(phrase: string): ChangeState {
  const canonical = PART_XI_PLACEHOLDER_DECOMPOSITION[phrase];
  if (canonical !== undefined) return canonical;
  const local = FIXTURE_PHRASE_DECOMPOSITION[phrase];
  if (local !== undefined) return local;
  throw new Error(
    `energyFixtures: "${phrase}" has no decomposition onto the two change-state axes. ` +
      'Add it to FIXTURE_PHRASE_DECOMPOSITION with the design sentence it was read from, ' +
      'or correct the phrase. Do not add an axis member.',
  );
}

/**
 * ══ R3 · THE META DECOMPOSITION, AND WHY IT IS A DECOMPOSITION ═════════════
 *
 * The design's own dense rows carry their metadata as one sentence —
 * `checked 2h · 11 evidence`. R3 renders recency and evidence count as separate
 * logical elements, so the fixture has to supply the parts. **The parts are read
 * out of the design's sentence; none is invented**, which is the same discipline
 * `FIXTURE_PHRASE_DECOMPOSITION` applies to the change-state phrases, and for
 * the same reason: a decomposition keyed by the source sentence cannot drift
 * from it, while a re-typed table can.
 *
 * `cs()` throws on an unmapped phrase and so does `metaOf()`. A fixture sentence
 * with no decomposition is a mistake, never a default.
 */
const FIXTURE_META_DECOMPOSITION: Readonly<Record<string, EnergyRowMeta>> = {
  'checked 2h · 11 evidence': { kind: 'EVIDENCED', checkedHours: 2, count: 11, counted: 'EVIDENCE' },
  'checked 2h · 9 evidence': { kind: 'EVIDENCED', checkedHours: 2, count: 9, counted: 'EVIDENCE' },
  'checked 6h · 12 evidence': { kind: 'EVIDENCED', checkedHours: 6, count: 12, counted: 'EVIDENCE' },
  'checked 12h · 5 evidence': { kind: 'EVIDENCED', checkedHours: 12, count: 5, counted: 'EVIDENCE' },
  'checked 6h · 22 reviewed': { kind: 'EVIDENCED', checkedHours: 6, count: 22, counted: 'REVIEWED' },
  /* `1d` is the design's own form. It is 24 hours; the DAY-form is the locale's. */
  'checked 1d · 8 reviewed': { kind: 'EVIDENCED', checkedHours: 24, count: 8, counted: 'REVIEWED' },
  /*
    The three governed statements. No recency, no count — nothing to segment,
    and nothing that may be clipped: `0 qualifying sources` carries a numeral and
    `no available record` loses its meaning at any cut.
  */
  '0 qualifying sources': { kind: 'STATEMENT', statement: '0 qualifying sources' },
  'tier boundary, not a gap': { kind: 'STATEMENT', statement: 'tier boundary, not a gap' },
  'no available record': { kind: 'STATEMENT', statement: 'no available record' },
};

function metaOf(sentence: string): EnergyRowMeta {
  const local = FIXTURE_META_DECOMPOSITION[sentence];
  if (local !== undefined) return local;
  throw new Error(
    `energyFixtures: "${sentence}" has no meta decomposition. Add it to ` +
      'FIXTURE_META_DECOMPOSITION with the design sentence it was read from. ' +
      'Do not assemble a meta value inline — the parts must come from the design.',
  );
}

/** Public reference cartography, [lon, lat], transcribed from the design's `PT`. */
const PT: Readonly<Record<string, readonly [number, number]>> = {
  hormuz: [56.4, 26.6],
  babel: [43.3, 12.6],
  suez: [32.35, 30.6],
  raslaffan: [51.55, 25.9],
  rotterdam: [4.1, 51.9],
  swinoujscie: [14.25, 53.9],
  kollsnes: [5.0, 60.5],
  barcelona: [2.2, 41.4],
  skikda: [6.9, 36.9],
  milford: [-5.0, 51.7],
  gdansk: [18.7, 54.4],
  bosphorus: [29.0, 41.1],
  novorossiysk: [37.8, 44.7],
  klaipeda: [21.1, 55.7],
  nybro: [15.9, 56.7],
  baumgarten: [16.9, 48.5],
  lubmin: [13.6, 54.1],
  zeebrugge: [3.2, 51.3],
};

function waypoints(...keys: readonly string[]): readonly (readonly [number, number])[] {
  return keys.map((key) => PT[key]).filter((point): point is readonly [number, number] => Boolean(point));
}

/**
 * The corridor arcs, transcribed from `CORRIDOR_ARCS`. Every one is
 * CORRIDOR-LEVEL ±25 KM: maritime corridors from public reference cartography,
 * which is the precision the design states and the only precision these may
 * carry. A crisp vector line at asset-rendering quality still says ±25 km —
 * "the renderer is not the witness."
 */
const FIXTURE_CORRIDORS: EnergyFrameData['spatialGeometry'] = [
  { id: 'hormuz-rotterdam', tone: 'amber', geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('hormuz', 'babel', 'suez', 'rotterdam') } },
  { id: 'raslaffan-barcelona', tone: 'cyan', geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('raslaffan', 'babel', 'suez', 'barcelona') } },
  { id: 'kollsnes-rotterdam', tone: 'mint', geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('kollsnes', 'rotterdam') } },
  { id: 'skikda-barcelona', tone: 'achromatic', geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('skikda', 'barcelona') } },
  { id: 'milford-zeebrugge', tone: 'achromatic', geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('milford', 'zeebrugge') } },
  { id: 'novorossiysk-barcelona', tone: 'achromatic', geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('novorossiysk', 'bosphorus', 'barcelona') } },
];

const HORMUZ: EnergySubject = {
  id: 'hormuz',
  type: 'CORRIDOR',
  corridorRole: 'chokepoint',
  assetRole: null,
  name: 'Strait of Hormuz',
  scopeLabel: 'CHOKEPOINT ROLE',
  readerState: null,
  canonicalAbsence: null,
  changeState: cs('DEVELOPING · UNRESOLVED'),
  tone: 'amber',
  geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('hormuz', 'babel', 'suez', 'rotterdam') },
  geometryWithheldBy: null,
  dataTier: 'OPERATOR_REPORTED',
  artifactsReviewed: 31,
  lastChecked: '13:20 UTC',
  nextCheck: null,
  brief: 'Transit conditions assessed as degraded. Two operators report re-routing; no confirmed closure.',
  headline: 'Hormuz transit conditions are degraded, but the corridor remains open',
  assessment:
    'Two operators have re-routed cargoes away from the strait. No closure is confirmed by any primary source. European crude import cover is assessed at 11 days under current routing, revised down from 14.',
  uncertainty:
    'Duration of re-routing; whether transit restrictions are formal or precautionary; volume actually diverted. One international report claiming closure is contradicted by two primary artifacts and retained as disputed.',
  confidence: 'Moderate',
  revisions: '5',
  affectedSystems: [
    { label: 'Gulf loading terminals', meta: '4 assets · operator reported', tone: 'amber' },
    { label: 'Hormuz transit corridor', meta: 'selected subject', tone: 'cyan' },
    { label: 'Suez / Bab el-Mandeb', meta: '2 chokepoints · attention', tone: 'amber' },
    { label: 'NW Europe import terminals', meta: '6 assets · watched', tone: 'mint' },
  ],
  fields: [
    { key: 'CHANGE HISTORY', value: '5 revisions in 72h · last 2h ago' },
    { key: 'DEPENDENT SYSTEMS', value: 'EU crude import · Asian LNG · 3 refinery clusters' },
    { key: 'ALTERNATE ROUTES', value: 'Suez / Bab el-Mandeb — both at attention' },
    { key: 'GEOMETRY PRECISION', value: 'Corridor-level ±25 km' },
    { key: 'DATA TIER', value: 'Operator reported · periodic · no vessel telemetry' },
  ],
  timeline: [
    { at: '17 Sep 02:10', changeState: cs('DISRUPTION OBSERVED'), text: 'Two operators report re-routing away from the strait', tone: 'amber' },
    { at: '17 Sep 05:40', changeState: cs('CAUSE ASSESSED'), text: 'Naval activity assessed as proximate factor — confidence moderate', tone: 'cyan' },
    { at: '17 Sep 09:15', changeState: cs('SUPPLY IMPACT REVISED'), text: 'European import cover revised 14 → 11 days at current routing', tone: 'amber' },
    { at: '17 Sep 11:02', changeState: cs('EVIDENCE DISPUTED'), text: 'Closure claim contradicted by two primary artifacts; retained as disputed', tone: 'achromatic' },
    { at: '17 Sep 13:20', changeState: cs('ASSESSMENT UNCHANGED'), text: 'Re-checked against 31 artifacts; corridor open, severity held', tone: 'achromatic' },
  ],
  evidence: [
    { id: 'hz-1', sourceClass: 'PORT_TERMINAL', role: 'SUPPORTS', language: 'EN', title: 'Terminal operator notice: berthing schedule revised for two cargoes', observedAt: '17 Sep', disclosure: null },
    { id: 'hz-2', sourceClass: 'REGULATOR', role: 'SUPPORTS', language: 'EN', title: 'Maritime authority advisory on transit conditions', observedAt: '17 Sep', disclosure: null },
    { id: 'hz-3', sourceClass: 'INTERGOVERNMENTAL', role: 'CONTEXT', language: 'EN', title: 'Periodic bulletin on regional export volumes', observedAt: '16 Sep', disclosure: null },
    { id: 'hz-4', sourceClass: 'REGIONAL_MEDIA', role: 'PARTIAL', language: 'AR → EN', title: 'Report of naval activity near the strait', observedAt: '17 Sep', disclosure: null },
    { id: 'hz-5', sourceClass: 'INTERNATIONAL_MEDIA', role: 'DISPUTED', language: 'EN', title: 'Claim of full closure', observedAt: '17 Sep', disclosure: null },
  ],
  crossDomain: [
    { domain: 'MARKET', state: 'STORED_SUMMARY', summary: 'Crude and freight rate movement · stored summary' },
    { domain: 'ECONOMY', state: 'STORED_SUMMARY', summary: 'Import-cost pass-through scenarios · stored summary' },
    { domain: 'SECURITY', state: 'STORED_SUMMARY', summary: 'Threat posture around transiting vessels · stored summary' },
    { domain: 'CONFLICT', state: 'STORED_SUMMARY', summary: 'Regional armed-conflict situation · stored summary' },
    { domain: 'POLITICS', state: 'STORED_SUMMARY', summary: 'Government and coalition responses · stored summary' },
    /* The design's own valid absence: a reference that finds nothing says so. */
    { domain: 'HUMANITARIAN', state: 'NO_ASSESSED_CONSEQUENCE', summary: null },
  ],
  watched: true,
};

const SWINOUJSCIE: EnergySubject = {
  id: 'swinoujscie',
  type: 'INFRASTRUCTURE_ASSET',
  corridorRole: null,
  assetRole: 'terminal',
  name: 'Świnoujście LNG terminal',
  scopeLabel: 'TERMINAL',
  readerState: 'NO_MATERIAL_CHANGE',
  canonicalAbsence: null,
  changeState: cs('NO MATERIAL CHANGE'),
  tone: 'achromatic',
  /*
    E01 IS BLOCKING FOR ASSET-LEVEL GEOMETRY — the rights matrix says so, and a
    frontend may not answer a sensitivity question by choosing a renderer. So
    this asset carries NO geometry even in the fixture frame, and names the
    review that owns the decision. The subject remains fully reachable: it is in
    the feed, the change grid, the drawer and the lens, and the a11y contract's
    promise that "the map is not the only path to any subject" is what makes
    that sufficient rather than a degradation.
  */
  geometry: null,
  geometryWithheldBy: 'E01',
  dataTier: 'OPERATOR_REPORTED',
  artifactsReviewed: 22,
  lastChecked: '06:00 UTC',
  nextCheck: '18:00',
  brief: 'Regasification availability unchanged. 22 artifacts reviewed since the last check.',
  headline: 'Świnoujście regasification availability is unchanged',
  assessment:
    'Availability, send-out capacity and booked slots are unchanged against the previous assessment. One additional October slot was published, which does not alter current supply.',
  uncertainty:
    'Slot utilisation for November is published as indicative. Cargo-level arrival detail is not available at the current data tier.',
  confidence: 'High',
  revisions: '2',
  affectedSystems: [
    { label: 'Świnoujście terminal', meta: 'selected subject', tone: 'mint' },
    { label: 'Polish transmission', meta: 'periodic · operator reported', tone: 'achromatic' },
    { label: 'Baltic Pipe', meta: 'redundancy pair · watched', tone: 'mint' },
    { label: 'Polish storage', meta: 'periodic', tone: 'achromatic' },
  ],
  fields: [
    { key: 'CHANGE HISTORY', value: '2 revisions in 30d' },
    { key: 'DEPENDENT SYSTEMS', value: 'PL transmission · Baltic Pipe redundancy pair' },
    { key: 'REDUNDANCY', value: 'Baltic Pipe available on the same market' },
    { key: 'GEOMETRY PRECISION', value: 'Asset-level · public register' },
    { key: 'DATA TIER', value: 'Operator published · periodic' },
  ],
  timeline: [
    { at: '15 Sep 08:00', changeState: cs('CAPACITY CHANGE'), text: 'October regasification slot added to the published schedule', tone: 'achromatic' },
    { at: '16 Sep 06:00', changeState: cs('ASSESSMENT UNCHANGED'), text: 'Availability re-checked against 18 artifacts; unchanged', tone: 'achromatic' },
    { at: '17 Sep 06:00', changeState: cs('NO MATERIAL CHANGE'), text: '22 artifacts reviewed; availability, send-out and bookings unchanged', tone: 'achromatic' },
  ],
  evidence: [
    { id: 'sw-1', sourceClass: 'ENERGY_COMPANY', role: 'SUPPORTS', language: 'PL → EN', title: 'Published send-out and slot schedule', observedAt: '17 Sep', disclosure: null },
    { id: 'sw-2', sourceClass: 'REGULATOR', role: 'SUPPORTS', language: 'PL → EN', title: 'Transmission system operator status page', observedAt: '17 Sep', disclosure: null },
    { id: 'sw-3', sourceClass: 'STATISTICAL_INSTITUTION', role: 'CONTEXT', language: 'EN', title: 'Monthly regasification volumes', observedAt: '01 Sep', disclosure: null },
    { id: 'sw-4', sourceClass: 'COMMERCIAL_LICENSED', role: 'CONTEXT', language: 'EN', title: 'Cargo-level arrival series', observedAt: null, disclosure: ENTITLEMENT },
  ],
  crossDomain: [
    { domain: 'MARKET', state: 'STORED_SUMMARY', summary: 'Regional gas price context · stored summary' },
    { domain: 'POLITICS', state: 'STORED_SUMMARY', summary: 'Polish supply diversification policy · stored summary' },
    { domain: 'HUMANITARIAN', state: 'NO_ASSESSED_CONSEQUENCE', summary: null },
  ],
  watched: false,
};

const SUEZ: EnergySubject = {
  id: 'suez',
  type: 'CORRIDOR',
  corridorRole: 'chokepoint',
  assetRole: null,
  name: 'Suez Canal',
  scopeLabel: 'CHOKEPOINT ROLE',
  readerState: null,
  canonicalAbsence: null,
  changeState: cs('RESTORED · CAUSE UNRESOLVED'),
  tone: 'achromatic',
  geometry: { kind: 'line', precision: 'CORRIDOR_25KM', path: waypoints('suez', 'babel') },
  geometryWithheldBy: null,
  dataTier: 'OPERATOR_REPORTED',
  artifactsReviewed: 5,
  lastChecked: '12:10 UTC',
  nextCheck: null,
  brief: 'Transit resumed at reduced throughput. Severity revised down; the cause remains unassessed.',
  headline: 'Suez transit has resumed at reduced throughput, but the cause is unresolved',
  assessment:
    'Transit resumed 11 hours ago at reduced throughput. Severity and supply impact are revised down. The situation is not closed: the cause remains unassessed and recurrence risk is retained.',
  uncertainty: 'Whether reduced throughput is a scheduling effect or a persistent constraint. No operator statement on cause.',
  confidence: 'Moderate',
  revisions: '3',
  affectedSystems: [
    { label: 'Suez corridor', meta: 'selected subject', tone: 'achromatic' },
    { label: 'Hormuz corridor', meta: 'upstream · attention', tone: 'amber' },
    { label: 'EU refinery clusters', meta: '3 clusters · periodic statistics', tone: 'achromatic' },
  ],
  fields: [
    { key: 'CHANGE HISTORY', value: '3 revisions in 48h' },
    { key: 'RESTORATION', value: 'Severity changed — situation not resolved' },
    { key: 'DEPENDENT SYSTEMS', value: 'Gulf → Europe crude and LNG routing' },
    { key: 'GEOMETRY PRECISION', value: 'Corridor-level ±25 km' },
    { key: 'DATA TIER', value: 'Operator reported · periodic' },
  ],
  timeline: [
    { at: '16 Sep 04:20', changeState: cs('DISRUPTION OBSERVED'), text: 'Delays reported by two shipping agents', tone: 'amber' },
    { at: '16 Sep 19:40', changeState: cs('SUPPLY IMPACT REVISED'), text: 'Routing delay assessed as material for two cargoes', tone: 'amber' },
    { at: '17 Sep 02:30', changeState: cs('RESTORED'), text: 'Transit resumed at reduced throughput; cause not assessed', tone: 'achromatic' },
  ],
  evidence: [
    { id: 'sz-1', sourceClass: 'PORT_TERMINAL', role: 'SUPPORTS', language: 'EN', title: 'Transit resumption notice', observedAt: '17 Sep', disclosure: null },
    { id: 'sz-2', sourceClass: 'INTERNATIONAL_MEDIA', role: 'CONTEXT', language: 'EN', title: 'Reported throughput figures', observedAt: '17 Sep', disclosure: null },
  ],
  crossDomain: [
    { domain: 'MARKET', state: 'STORED_SUMMARY', summary: 'Freight rate context · stored summary' },
    { domain: 'SECURITY', state: 'STORED_SUMMARY', summary: 'Regional maritime threat posture · stored summary' },
  ],
  watched: false,
};

const NORDBALT: EnergySubject = {
  id: 'nordbalt',
  type: 'GRID_SITUATION',
  corridorRole: null,
  assetRole: 'interconnector',
  name: 'NordBalt (LT–SE) interconnector',
  scopeLabel: 'INTERCONNECTOR',
  readerState: null,
  canonicalAbsence: null,
  changeState: cs('OUTAGE CONFIRMED'),
  tone: 'amber',
  /*
    A GRID SITUATION IS A SYSTEM, NOT A PLACE. GEOGRAPHY-SYSTEM-SCOPE: geometry
    "none", precision region-level, "may it become a point? NO — a grid is a
    system, not a place." So this subject carries a system scope, which admits
    no coordinates at all. Nothing can centre on it because there is nothing to
    centre on — which is exactly the intended guarantee.
  */
  geometry: { kind: 'systemScope', precision: 'REGION_LEVEL' },
  geometryWithheldBy: null,
  dataTier: 'OPERATOR_REPORTED',
  artifactsReviewed: 11,
  lastChecked: '11:48 UTC',
  nextCheck: null,
  brief: 'Both TSOs confirm unavailability. Cause assessed as a subsea fault, confidence moderate.',
  headline: 'NordBalt is unavailable and the cause is assessed as a subsea fault',
  assessment:
    'Both transmission system operators confirm unavailability. The cause is assessed as a subsea fault with moderate confidence. Reserve margin in the affected price area remains adequate; no consumer interruption is assessed.',
  uncertainty: 'Repair duration is stated by the operator as indicative, not confirmed. One source disputes the fault location.',
  confidence: 'Moderate',
  revisions: '5',
  affectedSystems: [
    { label: 'NordBalt link', meta: 'selected subject', tone: 'amber' },
    { label: 'LitPol Link', meta: 'load redistributed · watched', tone: 'mint' },
    { label: 'SE4 price area', meta: 'attention · periodic', tone: 'amber' },
    { label: 'Nordic generation', meta: 'reservoir levels · periodic', tone: 'achromatic' },
  ],
  fields: [
    { key: 'CHANGE HISTORY', value: '5 revisions in 12h' },
    { key: 'DEPENDENT SYSTEMS', value: 'SE4 price area · LT grid · LitPol Link' },
    { key: 'CONSUMER IMPACT', value: 'None assessed' },
    { key: 'GEOMETRY PRECISION', value: 'Route-level · public register' },
    { key: 'DATA TIER', value: 'TSO reported · periodic · no SCADA' },
  ],
  timeline: [
    { at: '17 Sep 02:40', changeState: cs('OUTAGE CONFIRMED'), text: 'Confirmed by both TSOs; earlier partial report superseded', tone: 'amber' },
    { at: '17 Sep 04:15', changeState: cs('CAUSE ASSESSED'), text: 'Subsea fault assessed — confidence moderate, 1 source disputed', tone: 'cyan' },
    { at: '17 Sep 07:02', changeState: cs('SUPPLY IMPACT REVISED'), text: 'Reserve margin adequate in SE4; no consumer interruption', tone: 'achromatic' },
    { at: '17 Sep 09:30', changeState: cs('EVIDENCE NOTED'), text: 'Repair window stated by operator as indicative, not confirmed', tone: 'achromatic' },
    { at: '17 Sep 11:48', changeState: cs('LOAD REDISTRIBUTED'), text: 'LitPol redistribution observed; no consumer interruption', tone: 'amber' },
  ],
  evidence: [
    { id: 'nb-1', sourceClass: 'TSO_GRID_OPERATOR', role: 'SUPPORTS', language: 'LT → EN', title: 'Joint statement confirming interconnector unavailability', observedAt: '17 Sep', disclosure: null },
    { id: 'nb-2', sourceClass: 'REGULATOR', role: 'SUPPORTS', language: 'SV → EN', title: 'Reserve margin notice for price area SE4', observedAt: '17 Sep', disclosure: null },
    { id: 'nb-3', sourceClass: 'LOCAL_MEDIA', role: 'CONTEXT', language: 'PL', title: 'Report of load redistribution on the Polish side', observedAt: '17 Sep', disclosure: null },
    { id: 'nb-4', sourceClass: 'COMMERCIAL_LICENSED', role: 'CONTEXT', language: 'EN', title: 'Cross-border flow series (licensed provider)', observedAt: null, disclosure: ENTITLEMENT },
  ],
  crossDomain: [
    { domain: 'MARKET', state: 'STORED_SUMMARY', summary: 'Price-area spread context · stored summary' },
    { domain: 'SECURITY', state: 'STORED_SUMMARY', summary: 'Subsea infrastructure threat posture · stored summary' },
    { domain: 'HUMANITARIAN', state: 'NO_ASSESSED_CONSEQUENCE', summary: null },
  ],
  watched: false,
};

const EU_SUPPLY: EnergySubject = {
  id: 'eu_supply',
  type: 'SUPPLY_SITUATION',
  corridorRole: null,
  assetRole: null,
  name: 'European crude import cover',
  scopeLabel: 'SUPPLY SITUATION',
  readerState: null,
  canonicalAbsence: null,
  changeState: cs('SUPPLY IMPACT REVISED'),
  tone: 'amber',
  /* A derived regional supply situation is a system scope: no geometry, region-level, no asset precision implied. */
  geometry: { kind: 'systemScope', precision: 'REGION_LEVEL' },
  geometryWithheldBy: null,
  dataTier: 'PERIODIC',
  artifactsReviewed: 12,
  lastChecked: '09:15 UTC',
  nextCheck: null,
  brief: 'Import cover revised from 14 to 11 days at current routing. Cover remains adequate this week.',
  headline: 'European crude import cover is revised down to 11 days at current routing',
  assessment:
    'Under current re-routing, assessed import cover falls from 14 to 11 days. Cover remains adequate for the current week. The revision follows the Hormuz transit assessment and does not assume closure.',
  uncertainty: 'Cover is derived from periodic statistics and public terminal schedules; it is not a real-time inventory measure.',
  confidence: 'Moderate',
  revisions: '2',
  affectedSystems: [
    { label: 'EU import cover', meta: 'selected subject', tone: 'amber' },
    { label: 'NW Europe terminals', meta: '6 assets · watched', tone: 'mint' },
    { label: 'Hormuz corridor', meta: 'upstream · attention', tone: 'amber' },
    { label: 'EU refinery clusters', meta: '3 clusters · periodic', tone: 'achromatic' },
  ],
  fields: [
    { key: 'DERIVED FROM', value: 'Hormuz transit assessment · terminal schedules' },
    { key: 'CHANGE HISTORY', value: '2 revisions in 24h' },
    { key: 'DEPENDENT SYSTEMS', value: '6 import terminals · 3 refinery clusters' },
    { key: 'GEOMETRY PRECISION', value: 'Region-level' },
    { key: 'DATA TIER', value: 'Periodic statistics · derived assessment' },
  ],
  timeline: [
    { at: '17 Sep 03:10', changeState: cs('SUPPLY IMPACT OBSERVED'), text: 'Re-routing reduces assessed arrivals for two cargoes', tone: 'amber' },
    { at: '17 Sep 09:15', changeState: cs('SUPPLY IMPACT REVISED'), text: 'Import cover revised 14 → 11 days', tone: 'amber' },
  ],
  evidence: [
    { id: 'eu-1', sourceClass: 'STATISTICAL_INSTITUTION', role: 'SUPPORTS', language: 'EN', title: 'Monthly import and stock statistics', observedAt: '01 Sep', disclosure: null },
    { id: 'eu-2', sourceClass: 'PORT_TERMINAL', role: 'SUPPORTS', language: 'EN', title: 'Published arrival schedules, six terminals', observedAt: '17 Sep', disclosure: null },
    { id: 'eu-3', sourceClass: 'INTERGOVERNMENTAL', role: 'CONTEXT', language: 'EN', title: 'Regional stock adequacy bulletin', observedAt: '15 Sep', disclosure: null },
  ],
  crossDomain: [
    { domain: 'ECONOMY', state: 'STORED_SUMMARY', summary: 'Import-cost pass-through · stored summary' },
    { domain: 'MARKET', state: 'STORED_SUMMARY', summary: 'Crude benchmark context · stored summary' },
    { domain: 'HUMANITARIAN', state: 'NO_ASSESSED_CONSEQUENCE', summary: null },
  ],
  watched: true,
};

const SUBJECTS: readonly EnergySubject[] = [HORMUZ, SWINOUJSCIE, SUEZ, NORDBALT, EU_SUPPLY];

/**
 * THE FEED, transcribed from the design's `feedItems`. The last three rows are
 * the reason this set is worth shipping: they carry COVERAGE GAP, UNAVAILABLE ·
 * LICENSED and NO DATA in situ, beside populated rows, so the four treatments
 * can be compared where a reader would actually meet them.
 */
const FEED: readonly EnergyFeedItem[] = [
  { subjectId: 'nordbalt', readerState: null, canonicalAbsence: null, changeState: cs('OUTAGE CONFIRMED'), tone: 'amber', ago: '2h', title: 'Both TSOs confirm NordBalt unavailability; cause assessed as subsea fault', scopeLabel: 'GRID SITUATION · LT–SE', evidenceLabel: '11 EVIDENCE', evidenceTone: 'cyan' },
  { subjectId: 'hormuz', readerState: null, canonicalAbsence: null, changeState: cs('DEVELOPING · UNRESOLVED'), tone: 'amber', ago: '2h', title: 'Hormuz transit degraded; two operators re-route, no confirmed closure', scopeLabel: 'ENERGY CORRIDOR · HORMUZ', evidenceLabel: '9 EVIDENCE', evidenceTone: 'cyan' },
  { subjectId: 'eu_supply', readerState: null, canonicalAbsence: null, changeState: cs('SUPPLY IMPACT REVISED'), tone: 'amber', ago: '6h', title: 'European crude import cover revised from 14 to 11 days at current routing', scopeLabel: 'SUPPLY SITUATION · EU', evidenceLabel: '12 EVIDENCE', evidenceTone: 'cyan' },
  { subjectId: 'suez', readerState: null, canonicalAbsence: null, changeState: cs('RESTORED · CAUSE OPEN'), tone: 'achromatic', ago: '11h', title: 'Suez transit resumed at reduced throughput — cause unresolved, risk retained', scopeLabel: 'ENERGY CORRIDOR · SUEZ', evidenceLabel: '5 EVIDENCE', evidenceTone: 'cyan' },
  { subjectId: 'swinoujscie', readerState: 'NO_MATERIAL_CHANGE', canonicalAbsence: null, changeState: cs('NO MATERIAL CHANGE'), tone: 'achromatic', ago: '6h', title: 'Świnoujście LNG availability unchanged — send-out, slots and bookings held', scopeLabel: 'ASSET · PL · next check 18:00', evidenceLabel: '22 REVIEWED', evidenceTone: 'achromatic' },
  { subjectId: null, readerState: 'COVERAGE_GAP', canonicalAbsence: 'NO_DATA_FOR_GEOGRAPHY', changeState: null, tone: 'achromatic', ago: '—', title: 'Iranian domestic refinery throughput — insufficient source coverage to assess', scopeLabel: 'NOT AN ASSESSMENT', evidenceLabel: '0 QUALIFYING SOURCES', evidenceTone: 'violet' },
  /*
    R2 · THIS ROW CHANGED STATE, AND THE COMPOSITION DID NOT.

    The frozen design renders vessel-level transit counts as the violet
    entitlement boundary. E03-3 refuses vessel- and cargo-resolved series
    *"regardless of licence"*, so exposure is REFUSED — and §B's precedence
    makes exposure dominate, which lands it on COVERAGE GAP.

    That is not a redesign: the row, the slot and the geometry are untouched.
    What changed is the state the row is in, and it changed because rendering
    violet would tell a reader that PAYING WOULD REVEAL IT — false, and
    informative about what is being protected (D-2).
  */
  { subjectId: null, readerState: 'COVERAGE_GAP', canonicalAbsence: 'NO_DATA_FOR_GEOGRAPHY', changeState: null, tone: 'achromatic', ago: '—', title: 'Vessel-level transit counts — insufficient source coverage to assess', scopeLabel: 'NOT AN ASSESSMENT', evidenceLabel: '0 QUALIFYING SOURCES', evidenceTone: 'achromatic' },
  { subjectId: null, readerState: 'NO_DATA', canonicalAbsence: 'NO_DATA', changeState: null, tone: 'achromatic', ago: '—', title: 'Pre-2019 cross-border series — no available record', scopeLabel: 'HISTORICAL', evidenceLabel: '—', evidenceTone: 'achromatic' },
];

/** The change grid, transcribed from `ROWS`. Bands mark assessment events, never article counts. */
const CHANGE_ROWS: readonly EnergyChangeRow[] = [
  { subjectId: 'nordbalt', subject: 'NordBalt (LT–SE)', scope: 'INTERCONNECTOR', readerState: null, canonicalAbsence: null, changeState: cs('OUTAGE CONFIRMED'), tone: 'amber', meta: metaOf('checked 2h · 11 evidence'), bands: { 20: 'amber', 21: 'amber', 22: 'amber', 23: 'amber' } },
  { subjectId: 'hormuz', subject: 'Strait of Hormuz', scope: 'CORRIDOR', readerState: null, canonicalAbsence: null, changeState: cs('DEVELOPING'), tone: 'amber', meta: metaOf('checked 2h · 9 evidence'), bands: { 22: 'amber', 23: 'amber', 24: 'amber' } },
  { subjectId: 'eu_supply', subject: 'EU crude import cover', scope: 'SUPPLY_SITUATION', readerState: null, canonicalAbsence: null, changeState: cs('SUPPLY IMPACT REVISED'), tone: 'amber', meta: metaOf('checked 6h · 12 evidence'), bands: { 23: 'amber', 24: 'amber' } },
  { subjectId: 'suez', subject: 'Suez Canal', scope: 'CORRIDOR', readerState: null, canonicalAbsence: null, changeState: cs('RESTORED · CAUSE OPEN'), tone: 'achromatic', meta: metaOf('checked 12h · 5 evidence'), bands: { 19: 'amber', 20: 'amber', 22: 'achromatic' } },
  { subjectId: 'swinoujscie', subject: 'Świnoujście LNG', scope: 'ASSET', readerState: 'NO_MATERIAL_CHANGE', canonicalAbsence: null, changeState: cs('NO MATERIAL CHANGE'), tone: 'achromatic', meta: metaOf('checked 6h · 22 reviewed'), bands: { 11: 'cyan' } },
  { subjectId: null, subject: 'Nordic reservoir levels', scope: 'GENERATION', readerState: null, canonicalAbsence: null, changeState: cs('PERIODIC UPDATE'), tone: 'achromatic', meta: metaOf('checked 1d · 8 reviewed'), bands: { 4: 'achromatic', 11: 'achromatic', 18: 'achromatic', 25: 'achromatic' } },
  { subjectId: null, subject: 'Baltic cable repair fleet', scope: 'INFRASTRUCTURE', readerState: 'COVERAGE_GAP', canonicalAbsence: 'NO_DATA_FOR_GEOGRAPHY', changeState: null, tone: 'achromatic', meta: metaOf('0 qualifying sources'), bands: {} },
  { subjectId: null, subject: 'Kaliningrad islanded operation', scope: 'GRID_SITUATION', readerState: 'UNAVAILABLE_LICENSED', canonicalAbsence: 'TIER_RESTRICTED', changeState: null, tone: 'violet', meta: metaOf('tier boundary, not a gap'), bands: {} },
  { subjectId: null, subject: 'Pre-2019 cross-border series', scope: 'HISTORICAL', readerState: 'NO_DATA', canonicalAbsence: 'NO_DATA', changeState: null, tone: 'achromatic', meta: metaOf('no available record'), bands: {} },
];

/**
 * THE FLOW SUBSTRATE. `sharePct` is SHARE OF ASSESSED SUPPLY — `ene:PCT`, a
 * ratio — and the one licensed link carries no number at all, because the tier
 * does not provide it and a placeholder would be a fabricated substitute.
 */
const FLOW_NODES: readonly EnergyFlowNode[] = [
  { id: 'gulf', label: 'Gulf loading', column: 0, tone: 'amber' },
  { id: 'norway', label: 'Norwegian shelf', column: 0, tone: 'mint' },
  { id: 'nafrica', label: 'North Africa', column: 0, tone: 'achromatic' },
  { id: 'hormuz', label: 'Hormuz', column: 1, tone: 'amber' },
  { id: 'suez', label: 'Suez', column: 1, tone: 'achromatic' },
  { id: 'northsea', label: 'North Sea routes', column: 1, tone: 'mint' },
  { id: 'nweurope', label: 'NW Europe', column: 2, tone: 'cyan' },
  { id: 'iberia', label: 'Iberia', column: 2, tone: 'cyan' },
  { id: 'central', label: 'Central Europe', column: 2, tone: 'cyan' },
];

const FLOW_LINKS: readonly EnergyFlowLink[] = [
  { from: 'gulf', to: 'hormuz', sharePct: 38, tone: 'amber', disclosure: null },
  { from: 'gulf', to: 'suez', sharePct: 12, tone: 'achromatic', disclosure: null },
  { from: 'norway', to: 'northsea', sharePct: 31, tone: 'mint', disclosure: null },
  { from: 'nafrica', to: 'suez', sharePct: 9, tone: 'achromatic', disclosure: null },
  { from: 'hormuz', to: 'nweurope', sharePct: 24, tone: 'amber', disclosure: null },
  { from: 'hormuz', to: 'iberia', sharePct: 14, tone: 'amber', disclosure: null },
  { from: 'suez', to: 'central', sharePct: 21, tone: 'achromatic', disclosure: null },
  { from: 'northsea', to: 'nweurope', sharePct: 31, tone: 'mint', disclosure: null },
  { from: 'northsea', to: 'central', sharePct: null, tone: 'violet', disclosure: ENTITLEMENT },
];

const DEPENDENCE: readonly EnergyDependenceRow[] = [
  { scopeLabel: 'Poland', source: 'Baltic Pipe + Świnoujście LNG', sharePct: 91, readerState: null, note: '2 corridors · redundancy present', tone: 'mint' },
  { scopeLabel: 'Germany', source: 'NW-EU grid + 3 LNG terminals', sharePct: 78, readerState: null, note: '4 corridors · diversified', tone: 'achromatic' },
  { scopeLabel: 'Czechia', source: 'Southern route + DE transit', sharePct: 86, readerState: null, note: 'single dominant path · concentrated', tone: 'amber' },
  { scopeLabel: 'Slovakia', source: 'Southern route', sharePct: null, readerState: 'COVERAGE_GAP', note: 'insufficient sources', tone: 'achromatic' },
];

const STORAGE: readonly EnergyStorageRow[] = [
  { scopeLabel: 'Poland', levelPct: 94, readerState: null, meta: 'periodic · reported 06:00 UTC', tone: 'mint' },
  { scopeLabel: 'Germany', levelPct: 91, readerState: null, meta: 'periodic · reported 06:00 UTC', tone: 'mint' },
  { scopeLabel: 'Austria', levelPct: 82, readerState: null, meta: 'periodic · reported 05:00 UTC', tone: 'achromatic' },
  { scopeLabel: 'Czechia', levelPct: 76, readerState: null, meta: 'drawdown 4 days running', tone: 'amber' },
];

export const ENERGY_DESIGN_FIXTURE_FRAME: EnergyFrameData = {
  source: 'design-fixture',
  /* Still false. A fixture data set does not manufacture a platform capability. */
  hasVisitCheckpoint: false,
  subjects: SUBJECTS,
  feed: FEED,
  changeRows: CHANGE_ROWS,
  flowNodes: FLOW_NODES,
  flowLinks: FLOW_LINKS,
  dependence: DEPENDENCE,
  storage: STORAGE,
  spatialGeometry: FIXTURE_CORRIDORS,
  withheldGeometry: [{ id: 'swinoujscie', name: 'Świnoujście LNG terminal', gate: 'E01' }],
  changeAxis: ['21 AUG', '28 AUG', '04 SEP', '11 SEP', '17 SEP'],
  watchCount: SUBJECTS.filter((subject) => subject.watched).length,
  /*
    Two zones are absent even here, and both for reasons no fixture can dissolve:
    a Sand price Main has not set, and Watch membership Code has not landed.
  */
  zones: {
    workspaceEntry: { readerState: 'UNAVAILABLE_LICENSED', canonicalAbsence: 'TIER_RESTRICTED', gate: 'M07', whyKey: 'gate' },
    watch: { readerState: 'UNAVAILABLE_LICENSED', canonicalAbsence: 'TIER_RESTRICTED', gate: 'E02', whyKey: 'gate' },
  },
};
