import { createHash } from 'node:crypto';
import retained from './data/imihigo-retained.json';
import authorities from './data/imihigo-authorities.json';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * INTELLIGENCE BINDING R1 — THE SERVER-SIDE IMIHIGO READER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The SAME governed retained authority the frontend Imihigo surface reads — not a second
 * truth. `data/imihigo-retained.json` and `data/imihigo-authorities.json` are byte-identical
 * copies of `frontend/src/lib/imihigo/{retained,authorities}.json`, and the spec pins that
 * byte identity AND re-derives the reviewed canonical content hash with the SAME algorithm as
 * `frontend/src/lib/imihigo/retainedModel.ts#contentHash`. The data could not live in
 * `shared/`: the admission uses node:crypto and the shared barrel is bundled into browser code.
 *
 * Reader-only: no network, no PDF decoding at request time, no scoring or ranking, no
 * inferred rows. A capture whose identity or content hash does not match its reviewed
 * authority is REFUSED — never partially read.
 */

export interface ImihigoRetainedRecord {
  readonly entity: string;
  readonly entityClass: 'district' | 'ministry' | 'board' | 'city-of-kigali';
  readonly result: { readonly label: string; readonly value: string; readonly unit: string | null };
  readonly provenance: {
    readonly pdfPage: number;
    readonly printedPage: string;
    readonly section: string;
    readonly quote: string;
  };
}

export interface ImihigoRetainedView {
  readonly state: 'ADMITTED' | 'REFUSED';
  readonly cycle: string;
  readonly evaluationDate: string;
  readonly publisher: string;
  readonly sourceDocument: string;
  readonly sourceUrl: string;
  readonly licence: string;
  readonly capturedAt: string;
  readonly captureSha256: string;
  readonly records: readonly ImihigoRetainedRecord[];
}

/** The reviewed canonical content identity — the frontend admission's exact algorithm. */
export function imihigoContentHash(value: unknown): string {
  function canonical(input: unknown): string {
    if (Array.isArray(input)) return `[${input.map(canonical).join(',')}]`;
    if (input !== null && typeof input === 'object') {
      const object = input as Record<string, unknown>;
      return `{${Object.keys(object)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(input);
  }
  return createHash('sha256').update(canonical(value)).digest('hex');
}

let admitted: ImihigoRetainedView | null = null;

export function readRetainedImihigo(): ImihigoRetainedView {
  if (admitted !== null) return admitted;
  const capture = retained as unknown as {
    captureId: string;
    sha256: string;
    documentId: string;
    parser: string;
    sourceUrl: string;
    cycle: string;
    evaluationDate: { value: string };
    publisher: string;
    sourceDocument: string;
    license: string;
    capturedAt: string;
    records: ImihigoRetainedRecord[];
  };
  const authority = (authorities as unknown as Array<Record<string, string>>).find(
    (entry) => entry.sha256 === capture.sha256,
  );
  const identityHolds =
    authority !== undefined &&
    capture.captureId === capture.sha256 &&
    capture.sourceUrl === authority.sourceUrl &&
    capture.documentId === authority.documentId &&
    capture.parser === authority.parser &&
    imihigoContentHash(retained) === authority.contentHash;
  admitted = Object.freeze({
    state: identityHolds ? 'ADMITTED' : 'REFUSED',
    cycle: capture.cycle,
    evaluationDate: capture.evaluationDate.value,
    publisher: capture.publisher,
    sourceDocument: capture.sourceDocument,
    sourceUrl: capture.sourceUrl,
    licence: capture.license,
    capturedAt: capture.capturedAt,
    captureSha256: capture.sha256,
    records: identityHolds ? Object.freeze([...capture.records]) : [],
  });
  return admitted;
}
