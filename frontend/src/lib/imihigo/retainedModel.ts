import { createHash } from 'node:crypto';

export type EntityClass = 'district' | 'ministry' | 'board' | 'city-of-kigali';
export interface SourceField {
  readonly value: string;
  readonly pdfPage: number;
  readonly quote: string;
}
export interface ImihigoRecord {
  readonly entity: string;
  readonly entityClass: EntityClass;
  readonly result: { readonly label: string; readonly value: string; readonly unit: string | null };
  readonly target: SourceField | null;
  readonly indicator: SourceField | null;
  readonly evaluationStatus: SourceField | null;
  readonly provenance: {
    readonly pdfPage: number; readonly printedPage: string; readonly section: string;
    readonly quote: string; readonly columnHeader: string | null;
  };
}
export interface RetainedCapture {
  readonly schemaVersion: 1;
  readonly captureId: string;
  readonly documentId: string;
  readonly revisionOf: string | null;
  readonly revisionLabel: string;
  readonly cycle: string;
  readonly reportPeriod: string;
  readonly evaluationDate: SourceField & { readonly precision: 'month' | 'day' };
  readonly publicationDate: SourceField | null;
  readonly sourceLanguage: string;
  readonly languageBasis: string;
  readonly publisher: string;
  readonly sourceUrl: string;
  readonly sourceDocument: string;
  readonly license: string;
  readonly artifact: string;
  readonly sha256: string;
  readonly capturedAt: string;
  readonly byteLength: number;
  readonly parser: string;
  readonly decoder: string;
  readonly orderReason: 'LEXICAL' | 'AUTHORITY_PUBLISHED';
  readonly records: readonly ImihigoRecord[];
  readonly coverage: string;
}
export interface CaptureAuthority {
  readonly sha256: string;
  readonly contentHash: string;
  readonly sourceUrl: string;
  readonly documentId: string;
  readonly parser: string;
}
export interface ImihigoView {
  readonly state: 'retained' | 'empty';
  readonly current: readonly RetainedCapture[];
  readonly history: readonly RetainedCapture[];
}

// Canonical content identity binds every field (including source language, precision,
// qualifiers and missing values) to a reviewed decoder output, not just its URL.
export function contentHash(value: unknown): string {
  function canonical(input: unknown): string {
    if (Array.isArray(input)) return `[${input.map(canonical).join(',')}]`;
    if (input !== null && typeof input === 'object') {
      const object = input as Record<string, unknown>;
      return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
    }
    return JSON.stringify(input);
  }
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function refuse(message: string): never { throw new Error(`Imihigo admission refused: ${message}`); }

/** Pure admission of reviewed retained data. No fetch, filesystem, parser or scoring. */
export function admitRetained(candidates: readonly unknown[], authorities: readonly CaptureAuthority[]): ImihigoView {
  const history: RetainedCapture[] = [];
  const current = new Map<string, RetainedCapture>();
  const seen = new Map<string, string>();
  for (const input of candidates) {
    if (!input || typeof input !== 'object') refuse('missing capture');
    const capture = input as RetainedCapture;
    const authority = authorities.find(entry => entry.sha256 === capture.sha256);
    if (!authority || capture.captureId !== capture.sha256 || capture.sourceUrl !== authority.sourceUrl ||
        capture.documentId !== authority.documentId || capture.parser !== authority.parser) refuse('exact-source identity');
    const digest = contentHash(input);
    if (digest !== authority.contentHash) refuse('unreviewed content or missing field');
    if (capture.schemaVersion !== 1 || !capture.records?.length || !capture.sourceLanguage || !capture.decoder ||
        !capture.publisher || !capture.languageBasis || !capture.artifact || !capture.license) refuse('missing provenance');
    const captureTime = Date.parse(capture.capturedAt);
    const evaluation = capture.evaluationDate;
    const datePattern = evaluation?.precision === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-\d{2}-\d{2}$/;
    const evaluationTime = Date.parse(evaluation?.precision === 'month' ? `${evaluation.value}-01` : evaluation?.value);
    if (!datePattern.test(evaluation?.value) || !Number.isFinite(captureTime) || !Number.isFinite(evaluationTime) ||
        evaluationTime > captureTime) refuse('chronology');
    if (capture.orderReason !== 'LEXICAL' && capture.orderReason !== 'AUTHORITY_PUBLISHED') refuse('ordering');
    for (const row of capture.records) {
      if (!['district', 'ministry', 'board', 'city-of-kigali'].includes(row.entityClass) || !row.entity ||
          !row.result?.label || !/^\d+(\.\d+)?$/.test(row.result.value) ||
          !row.provenance?.quote || !row.provenance.section || row.provenance.pdfPage < 1 ||
          !row.provenance.quote.includes(row.entity) || !row.provenance.quote.includes(row.result.value)) refuse('source-supported result');
      for (const field of [row.target, row.indicator, row.evaluationStatus]) {
        if (field !== null && (!field?.value || !field.quote?.includes(field.value) || field.pdfPage < 1)) refuse('unsupported optional field');
      }
    }
    if (new Set(capture.records.map(row => row.entity)).size !== capture.records.length) refuse('duplicate entity');
    if (capture.orderReason === 'LEXICAL' && capture.records.some((row, i) => i > 0 && capture.records[i - 1].entity > row.entity)) refuse('false order provenance');
    if (seen.has(capture.captureId)) {
      if (seen.get(capture.captureId) !== digest) refuse('duplicate capture conflict');
      continue; // Same bytes and reviewed content: idempotent, never a new revision.
    }
    const previous = current.get(capture.documentId);
    if (previous) {
      if (capture.revisionOf !== previous.captureId || capture.cycle !== previous.cycle ||
          capture.reportPeriod !== previous.reportPeriod || capture.sourceLanguage !== previous.sourceLanguage) refuse('revision lineage');
      if (captureTime <= Date.parse(previous.capturedAt) || capture.evaluationDate.value < previous.evaluationDate.value) refuse('revision chronology');
    } else if (capture.revisionOf !== null) refuse('orphan revision');
    // Own and freeze the admitted data; callers cannot mutate a reviewed view afterwards.
    const retained = freeze(JSON.parse(JSON.stringify(capture)) as RetainedCapture);
    history.push(retained);
    current.set(retained.documentId, retained);
    seen.set(retained.captureId, digest);
  }
  return freeze({ state: history.length ? 'retained' : 'empty', current: [...current.values()], history });
}
