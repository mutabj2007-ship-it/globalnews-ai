import {
  readerAbsence,
  type ObservationAbsenceState,
  type ReaderAbsenceState,
} from '../observation/absence';
import { assertDomainObservationIsWellFormed } from '../observation/domain-observation';
import { assertHumanitarianClaimIsWellFormed, type HumanitarianObservation } from './observation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUMANITARIAN RETAINED READ — the bounded reader contract
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Three result states, and no fourth:
 *
 *   UNAVAILABLE           the read could not be answered: NOT_ASSESSED (no admitted observation
 *                         path / no assessment), or COVERAGE_GAP (the lossy reader projection of
 *                         SOURCE_NOT_CONNECTED, SOURCE_TEMPORARILY_UNAVAILABLE and protected
 *                         withholding — readers never see source topology; Admin does).
 *
 *   NO_RETAINED_EVIDENCE  (CTO ruling, Humanitarian-specific) the retained Humanitarian store WAS
 *                         queried and holds no retained record. A fact about OUR STORE and NEVER a
 *                         finding about a crisis: it must not be read as "assessed, nothing
 *                         happened". Deliberately NOT a member of the global seven-state
 *                         ObservationAbsenceState authority (Security/Energy undisturbed), and
 *                         deliberately not an `absence` value, so no reader projection can map it
 *                         onto ASSESSED_NOTHING_QUALIFIED.
 *
 *   RETAINED              one or more admitted records on Main's canonical HumanitarianObservation
 *                         (Main is the record authority), wrapped with the retained-capture pointer
 *                         the analysis workspace (H) reads. Every row is reader-admissible by
 *                         construction (`humanitarianRetainedRead`).
 *
 * R1 READER LIMITS (CTO rulings on G's conflicts):
 *   C-3  no reader-facing Humanitarian polygons — a row whose event references a governed geometry
 *        record is REFUSED (geometry stays protected until the geometry authority permits a reader
 *        projection);
 *   C-4  no manufactured precision — a row carries only what the record states (ISO3 where the
 *        source scoped it), never a derived EXACT / DISTRICT / REGION / ADMIN3.
 */

/** One admitted retained record, as a reader may receive it. Structurally H's read model. */
export interface HumanitarianRetainedRecord {
  readonly captureKey: string;
  readonly publisherReleasedAt: string;
  readonly observation: HumanitarianObservation;
}

export type HumanitarianRetainedRead =
  | {
      readonly kind: 'UNAVAILABLE';
      readonly absence: Extract<ReaderAbsenceState, 'NOT_ASSESSED' | 'COVERAGE_GAP'>;
      readonly observations: readonly never[];
    }
  | {
      readonly kind: 'NO_RETAINED_EVIDENCE';
      readonly observations: readonly never[];
    }
  | {
      readonly kind: 'RETAINED';
      readonly observations: readonly HumanitarianRetainedRecord[];
    };

export const HUMANITARIAN_RETAINED_READ_KINDS = [
  'UNAVAILABLE',
  'NO_RETAINED_EVIDENCE',
  'RETAINED',
] as const;

export class HumanitarianReadRefused extends Error {
  readonly name = 'HumanitarianReadRefused';
}

export function humanitarianReadAbsence(
  state: Exclude<ObservationAbsenceState, 'ASSESSED_NOTHING_QUALIFIED'>,
): Extract<HumanitarianRetainedRead, { kind: 'UNAVAILABLE' }> {
  const absence = readerAbsence(state);
  if (absence === 'ASSESSED_NOTHING_QUALIFIED') {
    throw new Error('Humanitarian has no admitted coverage assessment');
  }
  return { kind: 'UNAVAILABLE', absence, observations: [] };
}

/**
 * Who decides a record is reader-admissible: the CALLER binds E1's source rights (a source cleared
 * for reader-facing use) and the protection authority. This contract refuses whatever fails it.
 * Until such a source exists, every real record is refused.
 */
export type HumanitarianReaderAdmission = (record: HumanitarianRetainedRecord) => boolean;

/** Structural checks shared by construction and parsing (no admission decision here). */
export function assertHumanitarianRetainedRecord(record: HumanitarianRetainedRecord): void {
  if (Object.keys(record).sort().join(',') !== 'captureKey,observation,publisherReleasedAt') {
    throw new HumanitarianReadRefused(
      'HUM-READ-1: a retained row carries exactly captureKey, observation, publisherReleasedAt.',
    );
  }
  if (
    typeof record.captureKey !== 'string' ||
    record.captureKey.length === 0 ||
    record.captureKey.length > 256
  ) {
    throw new HumanitarianReadRefused('HUM-READ-2: captureKey is a bounded non-empty string.');
  }
  if (
    typeof record.publisherReleasedAt !== 'string' ||
    Number.isNaN(Date.parse(record.publisherReleasedAt))
  ) {
    throw new HumanitarianReadRefused('HUM-READ-3: publisherReleasedAt is an ISO timestamp.');
  }
  assertDomainObservationIsWellFormed(record.observation);
  assertHumanitarianClaimIsWellFormed(record.observation.observationKind, record.observation.claim);
  const claim = record.observation.claim as { readonly geometryRecordKey?: unknown };
  if (claim.geometryRecordKey !== undefined) {
    throw new HumanitarianReadRefused(
      'HUM-READ-4: a reader row may not reference governed geometry in R1 (no reader-facing polygons).',
    );
  }
}

/**
 * The ONE constructor of a non-absence read. `[]` means the store was queried and is empty →
 * NO_RETAINED_EVIDENCE (never an assessment). A malformed, non-admissible or geometry-bearing
 * record refuses the WHOLE read — a read is never silently thinned.
 */
export function humanitarianRetainedRead(
  records: readonly HumanitarianRetainedRecord[],
  isReaderAdmissible: HumanitarianReaderAdmission,
): Exclude<HumanitarianRetainedRead, { kind: 'UNAVAILABLE' }> {
  if (records.length === 0) return { kind: 'NO_RETAINED_EVIDENCE', observations: [] };
  for (const record of records) {
    assertHumanitarianRetainedRecord(record);
    if (isReaderAdmissible(record) !== true) {
      throw new HumanitarianReadRefused(
        `HUM-READ-5: '${record.observation.observationKey}' is not reader-admissible. ` +
          'Protected or internal evidence never reaches a reader.',
      );
    }
  }
  return { kind: 'RETAINED', observations: Object.freeze([...records]) };
}

/** Bound on rows a reader payload may carry (a summary surface, not an export). */
export const HUMANITARIAN_READ_MAX_ROWS = 200;

/**
 * Parse an untrusted payload. Unknown or future shapes fail closed. A RETAINED payload passes
 * every structural check again (it crossed a network boundary); reader admissibility was decided
 * by the server that built it, and parsing can never widen it.
 */
export function parseHumanitarianRetainedRead(value: unknown): HumanitarianRetainedRead | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(',');
  if (v.kind === 'UNAVAILABLE') {
    if (keys !== 'absence,kind,observations') return null;
    if (v.absence !== 'NOT_ASSESSED' && v.absence !== 'COVERAGE_GAP') return null;
    if (!Array.isArray(v.observations) || v.observations.length !== 0) return null;
    return { kind: 'UNAVAILABLE', absence: v.absence, observations: [] };
  }
  if (v.kind === 'NO_RETAINED_EVIDENCE') {
    if (keys !== 'kind,observations') return null;
    if (!Array.isArray(v.observations) || v.observations.length !== 0) return null;
    return { kind: 'NO_RETAINED_EVIDENCE', observations: [] };
  }
  if (v.kind === 'RETAINED') {
    if (keys !== 'kind,observations') return null;
    if (!Array.isArray(v.observations)) return null;
    if (v.observations.length === 0 || v.observations.length > HUMANITARIAN_READ_MAX_ROWS) {
      return null;
    }
    try {
      for (const row of v.observations) {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
        assertHumanitarianRetainedRecord(row as HumanitarianRetainedRecord);
      }
    } catch {
      return null;
    }
    return {
      kind: 'RETAINED',
      observations: v.observations as readonly HumanitarianRetainedRecord[],
    };
  }
  return null;
}
