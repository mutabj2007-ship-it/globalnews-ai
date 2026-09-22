import { readerAbsence, type ObservationAbsenceState, type ReaderAbsenceState } from '../observation/absence';

/**
 * Current release has no admitted Humanitarian observation store or coverage assessment.
 * This bounded read contract deliberately cannot carry observations or a positive empty
 * finding. A geometry record alone has no observation chronology, revision or rights
 * admission. Expanding this contract requires that retained observation path first.
 */
export interface HumanitarianRetainedRead {
  readonly kind: 'UNAVAILABLE';
  readonly absence: Extract<ReaderAbsenceState, 'NOT_ASSESSED' | 'COVERAGE_GAP'>;
  readonly observations: readonly never[];
}

export function humanitarianReadAbsence(
  state: Exclude<ObservationAbsenceState, 'ASSESSED_NOTHING_QUALIFIED'>,
): HumanitarianRetainedRead {
  const absence = readerAbsence(state);
  if (absence === 'ASSESSED_NOTHING_QUALIFIED') {
    throw new Error('Humanitarian has no admitted coverage assessment');
  }
  return { kind: 'UNAVAILABLE', absence, observations: [] };
}

/** Unknown or future success payloads must not bypass an unimplemented admission gate. */
export function parseHumanitarianRetainedRead(value: unknown): HumanitarianRetainedRead | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (Object.keys(value).sort().join(',') !== 'absence,kind,observations') return null;
  if (!('kind' in value) || value.kind !== 'UNAVAILABLE' ||
      !('absence' in value) || (value.absence !== 'NOT_ASSESSED' && value.absence !== 'COVERAGE_GAP') ||
      !('observations' in value) || !Array.isArray(value.observations) || value.observations.length !== 0) return null;
  return { kind: 'UNAVAILABLE', absence: value.absence, observations: [] };
}