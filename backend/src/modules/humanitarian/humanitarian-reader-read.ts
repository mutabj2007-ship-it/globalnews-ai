import {
  humanitarianRetainedRead,
  type HumanitarianRetainedRead,
  type HumanitarianRetainedRecord,
} from '@globalnews-ai/shared';
import { readerAdmissionFromRuling } from './reader-clearance.ruling';

/**
 * E1 R2 · C1 — THE ONLY WAY BACKEND CODE BUILDS A HUMANITARIAN READER READ.
 *
 * The shared contract's constructor `humanitarianRetainedRead(records, isReaderAdmissible)` must
 * take a predicate (the shared package cannot import a backend ruling), and a caller passing
 * `() => true` would satisfy it. This wrapper binds E1's ruling-derived predicate and exposes no
 * parameter a caller could steer; `humanitarian-reader-read.spec.ts` fails if any other production
 * file calls the raw constructor. Today no source is reader-cleared, so any non-empty input is
 * refused (HUM-READ-5) and an empty store reads NO_RETAINED_EVIDENCE.
 */
export function buildHumanitarianReaderRead(
  records: readonly HumanitarianRetainedRecord[],
): Exclude<HumanitarianRetainedRead, { kind: 'UNAVAILABLE' }> {
  return humanitarianRetainedRead(records, readerAdmissionFromRuling());
}
