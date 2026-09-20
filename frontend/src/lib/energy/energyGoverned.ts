import type { EnergyFrameData, EnergyZoneState } from '@/lib/energy/energyModel';
import type { EnergyZone } from '@/lib/energy/energyFrame';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE GOVERNED FRAME — WHAT THE PLATFORM ACTUALLY HOLDS TODAY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This is the default state of `/energy`, and it contains NO ENERGY VALUE OF
 * ANY KIND. Not a generation figure, not a capacity, not a storage level, not a
 * flow, not an outage, not a grid condition, not an infrastructure condition.
 * The reason is measured rather than cautious:
 *
 *   RIGHTS-SECURITY-MATRIX tally     SOURCE READY = 0
 *   DEPENDENCY-MATRIX                DomainObservation  PROPOSED, UNLANDED
 *                                    json-numeric       LANDED ELSEWHERE
 *                                    spatial/precision  PROPOSED, UNLANDED
 *                                    absence union      PROPOSED, UNLANDED
 *   RIGHTS-SECURITY-MATRIX           "ENTSO-E is named in accepted canonical
 *                                     bytes. That is a citation, not an
 *                                     activation."
 *
 * So there is nothing to render, and the frame's job is to say so ZONE BY ZONE
 * rather than to look populated. Every entry below is an absence with a named
 * owner; not one of them is a blank.
 *
 * ── WHY THERE ARE NO SUBJECTS, NOT EVEN EMPTY ONES ────────────────────────
 *
 * A subject row carrying a name is a claim that the platform tracks that
 * subject. It does not yet. Carrying the frozen design's Hormuz, Świnoujście,
 * Suez and NordBalt into THIS set would present design fixtures as governed
 * coverage — which is the one thing the data-honesty rule forbids. They live in
 * the fixture set, labelled, where the design put them.
 *
 * ── WHY "NO MATERIAL CHANGE" DOES NOT APPEAR HERE ─────────────────────────
 *
 * Because it would be a lie. NO MATERIAL CHANGE means *evidence was reviewed
 * and the assessment held* — a result, and the product's paid output. Nothing
 * has been reviewed, so `quietStateFor(0)` returns COVERAGE GAP and there is no
 * path in this file to the quiet state. The reader still sees all four
 * treatments, in the frozen absence-state legend the design already ships,
 * where they describe the vocabulary instead of asserting coverage.
 */

const zone = (
  readerState: EnergyZoneState['readerState'],
  canonicalAbsence: EnergyZoneState['canonicalAbsence'],
  gate: EnergyZoneState['gate'],
): EnergyZoneState => ({ readerState, canonicalAbsence, gate, whyKey: gate === null ? 'stateWhy' : 'gate' });

const GOVERNED_ZONES: Partial<Record<EnergyZone, EnergyZoneState>> = {
  /*
    SPATIAL. G02 — "Confirm which corridors and assets can carry route-level or
    asset-level geometry from public registers" — is unmeasured, so no corridor
    is admitted. The substrate still renders BASE GEOGRAPHY, which is the
    design's own DATA-POOR tier: "renders geography and watched-asset geometry
    only; no assessed overlays … NEVER A BLANK CANVAS, never a fabricated
    substitute."
  */
  'spatial.corridorMarker': zone('COVERAGE_GAP', 'NO_DATA_FOR_GEOGRAPHY', 'G02'),
  /*
    E01 is BLOCKING for asset-level geometry, per the rights matrix. A frontend
    "may not resolve a rights or sensitivity question by choosing a renderer, a
    zoom limit or a rounding", so the answer is not a coarser marker — it is no
    marker, and a statement naming the review that owns the decision.
  */
  'spatial.assetMarker': zone('COVERAGE_GAP', 'NO_DATA_FOR_GEOGRAPHY', 'E01'),

  /*
    CHANGE. There are no assessments, so there is no movement to show. The grid
    keeps its geometry, density, rows and roving tabindex — M01 blocks the
    WORDS, and G01–G04 block the VALUES, and neither blocks the surface.
  */
  'change.grid': zone('COVERAGE_GAP', 'NO_DATA_FOR_GEOGRAPHY', 'G01'),
  'change.revisionSpine': zone('NO_DATA', 'NO_DATA', null),

  /*
    FLOWS — CORRECTED IN R2, AND THE CORRECTION IS THE POINT OF §B.

    R1 rendered this zone as the violet entitlement boundary, reasoning that
    commercial flow series are licensed. That read availability off ONE axis.
    Under the two-axis model both axes are at their FLOOR here — rights
    UNMEASURED, exposure NOT ASSESSED — and Main's precedence table is explicit:

        floor | floor -> COVERAGE GAP

    Violet would have told a reader that PAYING WOULD REVEAL IT, on a series
    where nobody has assessed whether it should be exposed at all. And it would
    have made the eventual licence visible as a colour change, which §B calls
    the oracle: *"That change is itself the disclosure."*
  */
  'flows.sankey': zone('COVERAGE_GAP', 'NO_DATA_FOR_GEOGRAPHY', 'G01'),
  'flows.dependence': zone('COVERAGE_GAP', 'NO_DATA_FOR_GEOGRAPHY', 'G01'),
  'flows.storage': zone('COVERAGE_GAP', 'NO_DATA_FOR_GEOGRAPHY', 'G01'),

  /*
    CROSS-DOMAIN. No Energy subject exists to reference from, so no reference
    has been made. This is "no available record", not a withheld assessment.
  */
  crossDomain: zone('NO_DATA', 'NO_DATA', null),

  /*
    WATCH HAS NO ZONE ENTRY IN R2, AND ITS ABSENCE IS THE CORRECTION.

    R1 rendered Watch as a violet E02 gate. Both halves were wrong: E1 clears
    Watch on situations, corridors, grid situations and SINGLE ASSETS, and
    routing a security withhold to violet is D-2. Only a reader-assembled
    COMPOSITE set is held, and that capability is not built at all.

    So there is nothing to withhold and nothing to explain. The governed frame
    has no subjects, therefore nothing to watch — an ordinary emptiness, which
    is exactly what it should look like.
  */
  /*
    ASK. Ask answers from STORED assessments, evidence and references. Nothing
    is stored, so it says that. It does not synthesise — that is the structural
    half of M07, which Main ruled.
  */
  ask: zone('NO_DATA', 'NO_DATA', null),

  /*
    WORKSPACE ENTRY. The handoff exists and is priced before execution; the
    PRICE does not exist, because Main does not set prices and M07 is with the
    Product Owner. The affordance shows the action and no number.

    R2 moves this off the violet chip. A price nobody has set is not an
    entitlement boundary — violet would say "pay and you may have it", about a
    number that does not exist. `NO DATA` is what it actually is: no available
    record. M07 is a pricing gate rather than a security one, so it is named.
  */
  workspaceEntry: zone('NO_DATA', 'NO_DATA', 'M07'),
};

/**
 * THE GOVERNED SET. Every collection is empty and every emptiness is explained.
 *
 * `changeAxis` is the one populated field and it is not a claim about energy:
 * it is the grid's column ruler. H04 fixes 28 columns; the labels are relative
 * window positions rather than dates, because a date axis without assessments
 * would imply a period was covered.
 */
export const ENERGY_GOVERNED_FRAME: EnergyFrameData = {
  source: 'governed',
  /* M05 — the platform has no per-reader visit checkpoint. Stated, not assumed. */
  hasVisitCheckpoint: false,
  subjects: [],
  feed: [],
  changeRows: [],
  flowNodes: [],
  flowLinks: [],
  dependence: [],
  storage: [],
  spatialGeometry: [],
  withheldGeometry: [],
  changeAxis: [],
  watchCount: 0,
  zones: GOVERNED_ZONES,
};
