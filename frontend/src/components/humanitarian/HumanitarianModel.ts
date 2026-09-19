/**
 * PART X · HUMANITARIAN — THE DEGRADED BETA MODEL.
 *
 * WHAT THIS IS AND IS NOT. It is the shape the frame renders. It is NOT data, and it
 * carries no figure: every `FigureSlot` below is ABSENT with a reason, because the
 * source programme is not DATA READY and inventing a population, a need level, a
 * severity, an access condition or a coordinate is the one thing this lane may not do.
 *
 * The jurisdiction names are the frozen design's own specimens (Part X draws eastern
 * DRC, Sudan and Poland). They are LABELS ON AN EMPTY FRAME, not findings, and every
 * value beside them is an absence with a stated reason.
 */
import {
  accessNotAssessed, accessNotProducibleAtPrecision, area, changeStateNotDerivable,
  compositeScopeUnavailable, coverageGapAssertedFromAbsence, evidenceUnavailable,
  precisionFloor, rightsRestricted, sectorsNotAssessed, sensitiveLocationProtected,
  statedTitle, standingUncertain, titleFromChangeState,
  type AccessRow, type ChangeStateSlot, type CoverageState, type EvidenceState,
  type FrameTitle, type FutureState, type PrecisionState, type RightsState,
  type SectorNeedRow, type SensitiveLocationState, type StandingState,
} from '@/lib/humanitarian/humDegraded';
import type { HumFrameState } from '@/lib/humanitarian/humState';

export interface HumSituationView {
  readonly frame: HumFrameState;
  readonly jurisdiction: string;
  readonly region: string;
  /**
   * NOT A STRING. A frame whose headline asserts that someone checked may not carry
   * authored prose — see `FrameTitle` — so QUIET has nowhere to hardcode "Checked".
   */
  readonly title: FrameTitle;
  readonly precision: PrecisionState;
  readonly coverage: CoverageState;
  readonly change: ChangeStateSlot;
  readonly standing: StandingState;
  readonly sectors: readonly SectorNeedRow[];
  readonly access: readonly AccessRow[];
  readonly evidence: EvidenceState;
  readonly rights: RightsState;
  readonly sensitive: SensitiveLocationState;
  readonly composite: FutureState;
  /** Revision identity does not exist as a shared schema. Stated, never invented. */
  readonly revision: null;
}

const base = (frame: HumFrameState, region: string, jurisdiction: string, title: FrameTitle): HumSituationView => ({
  frame, region, jurisdiction, title,
  precision: precisionFloor('COUNTRY'),
  coverage: coverageGapAssertedFromAbsence(),
  change: changeStateNotDerivable(),
  standing: standingUncertain(),
  sectors: sectorsNotAssessed('NO_VALIDATED_BASELINE'),
  access: [accessNotAssessed(area('—', 'COUNTRY'), 'NO_LOCAL_EVIDENCE_IN_PERIOD')],
  evidence: evidenceUnavailable('NO_VALIDATED_BASELINE'),
  rights: rightsRestricted('Source rights review — Product Owner'),
  sensitive: sensitiveLocationProtected(),
  composite: compositeScopeUnavailable(),
  revision: null,
});

/**
 * The four frame states, each in its truthful degraded form.
 * GAP and QUIET are not variants of a populated frame — on today's contracts they
 * are the only two a reader could legitimately reach, and SELECTED/ENTRY are shown
 * with every axis absent rather than with placeholder values.
 */
export const HUM_VIEWS: Readonly<Record<HumFrameState, HumSituationView>> = {
  ENTRY: {
    ...base('ENTRY', 'East Africa', 'Regional scope', statedTitle('Humanitarian conditions and what changed')),
    precision: precisionFloor('COUNTRY'),
  },
  /**
   * THE SPECIMEN WAS INFLATING ITS OWN PRECISION BY CAPTION.
   *
   * This view declares `precisionFloor('ADMIN1')` — PROVINCE — and used to name three
   * ADMIN2 territories: Rutshuru, Masisi, Nyiragongo. This domain's own mapping records
   * ADMIN2 as `producible: false` ("no admin-2 dataset is loaded"). Three district names
   * under a province-level declaration is a finer placement than the frame is entitled
   * to make, asserted in the one channel nothing was checking.
   *
   * So the rows are stated at the rung that HAS a producer, and the rung that does not
   * is stated as a row of its own rather than by quietly omitting the districts — an
   * omitted rung reads as a rung with nothing in it. `renderableArea()` clamps anyway;
   * this makes the data honest before it reaches the clamp.
   */
  SELECTED: {
    ...base('SELECTED', 'East Africa', 'North Kivu, DR Congo', statedTitle('Displacement and service pressure')),
    precision: precisionFloor('ADMIN1'),
    access: [
      accessNotAssessed(area('North Kivu', 'ADMIN1'), 'NO_LOCAL_EVIDENCE_IN_PERIOD'),
      accessNotProducibleAtPrecision('ADMIN2'),
    ],
  },
  GAP: {
    ...base('GAP', 'East Africa', 'Blue Nile, Sudan', statedTitle('Not assessable on current evidence')),
    evidence: evidenceUnavailable('NO_VALIDATED_BASELINE', true),
  },
  /**
   * NO TITLE STRING. `titleFromChangeState()` carries no text; the headline is resolved
   * from `change` every render, and `change` is `changeStateNotDerivable()`. "Checked"
   * is unreachable from here, and it is unreachable structurally rather than by wording.
   */
  QUIET: {
    ...base('QUIET', 'Europe', 'Lublin and Podkarpackie, Poland', titleFromChangeState()),
    precision: precisionFloor('ADMIN1'),
  },
};

/**
 * The attention queue. EMPTY, and the emptiness is a RESULT.
 * Part X H-01's degraded fallback says it in its own words: "Empty queue is a
 * legitimate result." A queue filled with placeholder rows would be an incident feed
 * made of nothing, which is exactly what §1 says this surface is not.
 */
export const HUM_QUEUE_ROWS: readonly never[] = [];
