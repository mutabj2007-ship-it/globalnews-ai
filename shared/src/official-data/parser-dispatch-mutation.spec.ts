import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseStrictJson } from './json-strict';
import { resolveParserBinding, registeredParserProviders } from './parser-registry';
import type { ArtifactDecoder, ParserBinding } from './parser-registry';
import { sniffRefusal } from './snapshot-admission';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PARSER DISPATCH CONTRACT — PROVED AS COMPILATIONS THAT MUST FAIL
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's ruling A requires two invariants that a runtime test CANNOT establish,
 * because the whole point is that the defect never reaches runtime:
 *
 *   1. A binding with NO DECODER must fail at compile time.
 *   2. A PDF binding wired to `parseStrictJson` must fail at compile time.
 *
 * So these cases run the real TypeScript compiler over real source files and
 * assert on the diagnostics. A compile that SUCCEEDS where it must fail is the
 * failure — which is why each mutation is paired with a positive control that
 * must compile, proving the harness is capable of reporting success at all.
 *
 * WHY NOT `@ts-expect-error`. It proves a line errors, but not WHICH error, and
 * it silently passes if the line errors for an unrelated reason — a typo would
 * satisfy it. These cases match the diagnostic text, so they establish that the
 * binding is rejected FOR THE REASON CLAIMED.
 */

const HARNESS = mkdtempSync(join(tmpdir(), 'parser-dispatch-'));

/** The contract under test, restated locally so the harness needs no build. */
const BASE = `
export type SnapshotRefusalKey =
  | 'PROVENANCE_HOST_MISMATCH' | 'STATUS_NOT_OK' | 'MEDIA_TYPE_NOT_ALLOWED'
  | 'CHARSET_NOT_ALLOWED' | 'ENCODING_NOT_ALLOWED' | 'SIZE_EXCEEDED'
  | 'DECOMPRESSION_BOUND_EXCEEDED' | 'BODY_NOT_JSON_SHAPED' | 'ARCHIVE_NOT_ALLOWED'
  | 'PARSE_FAILED' | 'ENVELOPE_NOT_RECOGNISED' | 'SECRET_DETECTED' | 'PROVIDER_NOT_ALLOWLISTED';

export interface LexicalNumberToken { readonly path: string; readonly token: string; }

/* EXACTLY the landed StrictJsonResult. Not simplified. */
export type StrictJsonResult =
  | { readonly ok: true; readonly value: unknown; readonly nodes: number;
      readonly maxDepth: number; readonly lexicalNumberTokens: readonly LexicalNumberToken[] }
  | { readonly ok: false;
      readonly refusalKey: Extract<SnapshotRefusalKey, 'PARSE_FAILED' | 'BODY_NOT_JSON_SHAPED'>;
      readonly detail: string; readonly offset: number };

export declare function parseStrictJson(bytes: Uint8Array): StrictJsonResult;

export type ArtifactDecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusalKey: SnapshotRefusalKey; readonly detail: string };

export type ArtifactDecoder<T> = (decoded: Uint8Array) => ArtifactDecodeResult<T>;

export interface ParserBinding<T = unknown> {
  readonly parserId: string;
  readonly parserVersion: string;
  readonly mediaType: string;
  readonly decode: ArtifactDecoder<T>;
  readonly assertEnvelope: (value: T) => true | string;
}

/* A PDF artifact: its OWN typed result. Nothing JSON-shaped reaches it. */
export interface PdfTableExtract {
  readonly pages: number;
  readonly tables: readonly {
    readonly rows: readonly (readonly string[])[];
    readonly headerRowIndex: number | null;
  }[];
}
export declare const extractPdfTables: ArtifactDecoder<PdfTableExtract>;
`;

/** Compiles one case against the contract and returns the diagnostics. */
function compile(name: string, body: string): string {
  writeFileSync(join(HARNESS, 'base.ts'), BASE, 'utf8');
  writeFileSync(join(HARNESS, `${name}.ts`), body, 'utf8');
  try {
    execFileSync(
      process.execPath,
      [
        require.resolve('typescript/lib/tsc.js'),
        '--noEmit',
        '--strict',
        '--target', 'ES2020',
        '--moduleResolution', 'node',
        join(HARNESS, `${name}.ts`),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return '';
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

afterAll(() => {
  rmSync(HARNESS, { recursive: true, force: true });
});

describe('1 · POSITIVE CONTROLS — the harness can report success', () => {
  it('the landed JSON decoder satisfies ArtifactDecoder with NO change to it', () => {
    const out = compile(
      'a-json-unchanged',
      `
import { parseStrictJson } from './base';
import type { ArtifactDecoder, ParserBinding } from './base';

export const jsonDecoder: ArtifactDecoder<unknown> = parseStrictJson;

export const eurostatBinding: ParserBinding<unknown> = {
  parserId: 'eurostat.jsonstat',
  parserVersion: '1.0.0',
  mediaType: 'application/json',
  decode: parseStrictJson,
  assertEnvelope: (v: unknown) => (typeof v === 'object' && v !== null) || 'NOT_AN_OBJECT',
};
`,
    );
    expect(out).toBe('');
  });

  it('a PDF row with its OWN decoder compiles — the path exists and is type-safe', () => {
    const out = compile(
      'b-pdf-row',
      `
import type { ParserBinding, PdfTableExtract } from './base';
import { extractPdfTables } from './base';

export const nisrCpiBinding: ParserBinding<PdfTableExtract> = {
  parserId: 'nisr.cpi.pdf',
  parserVersion: '1.0.0',
  mediaType: 'application/pdf',
  decode: extractPdfTables,
  assertEnvelope: (v: PdfTableExtract) => v.tables.length > 0 || 'NO_TABLE_FOUND',
};
`,
    );
    expect(out).toBe('');
  });
});

describe('2 · MUTATION 1 — a binding with no decoder must NOT compile', () => {
  it('the pre-convergence binding literal is now a type error', () => {
    /*
      This is EXACTLY the shape every registry row carried before this round:
      parserId, parserVersion, mediaType, assertEnvelope — and no decoder. It
      compiled, and the evaluator supplied `parseStrictJson` on its behalf.
    */
    const out = compile(
      'm1-no-decoder',
      `
import type { ParserBinding } from './base';
export const legacyBinding: ParserBinding = {
  parserId: 'eurostat.jsonstat',
  parserVersion: '1.0.0',
  mediaType: 'application/json',
  assertEnvelope: (v: unknown) => true,
};
`,
    );
    expect(out).not.toBe('');
    /* and it fails for the RIGHT reason: the missing decoder, named */
    expect(out).toMatch(/decode/);
    expect(out).toMatch(/TS2(739|741|345|322)/);
  });
});

describe('3 · MUTATION 2 — a PDF binding on parseStrictJson must NOT compile', () => {
  it('THE MEASURED DEFECT CODE: PDF bytes down the JSON decoder', () => {
    /*
      The crossed wiring: a row that CLAIMS application/pdf, runs the JSON
      decoder over the bytes, then asserts a PDF envelope against whatever came
      back. Before the generic parameter tied `decode` and `assertEnvelope` to
      one `T`, nothing objected.
    */
    const out = compile(
      'm2-crossed-envelope',
      `
import { parseStrictJson } from './base';
import type { ParserBinding, PdfTableExtract } from './base';
export const crossed: ParserBinding<PdfTableExtract> = {
  parserId: 'nisr.cpi.pdf',
  parserVersion: '1.0.0',
  mediaType: 'application/pdf',
  decode: parseStrictJson,
  assertEnvelope: (v: PdfTableExtract) => v.tables.length > 0 || 'NO_TABLE_FOUND',
};
`,
    );
    expect(out).not.toBe('');
    /*
      The diagnostic names the DECODER ASSIGNMENT, not something incidental: the
      strict-JSON decoder is reported as not assignable to the PDF row's decoder
      type. That is the crossing being rejected, at the exact property.
    */
    expect(out).toMatch(/TS2322/);
    expect(out).toMatch(/StrictJsonResult' is not assignable to type 'ArtifactDecoder<PdfTableExtract>/);
  });

  it('and the same crossing is rejected for any other artifact type too', () => {
    const out = compile(
      'm2b-crossed-generic',
      `
import { parseStrictJson } from './base';
import type { ParserBinding } from './base';
interface CsvExtract { readonly rows: readonly (readonly string[])[]; }
export const crossed: ParserBinding<CsvExtract> = {
  parserId: 'x.csv',
  parserVersion: '1.0.0',
  mediaType: 'text/csv',
  decode: parseStrictJson,
  assertEnvelope: (v: CsvExtract) => v.rows.length > 0 || 'NO_ROWS',
};
`,
    );
    expect(out).not.toBe('');
    expect(out).toMatch(/TS2322/);
    expect(out).toMatch(/ArtifactDecoder<CsvExtract>/);
  });
});

/* ── THE LANDED REGISTRY, AT RUNTIME ─────────────────────────────────────── */

describe('4 · the landed registry dispatches through the binding', () => {
  it('every registered row supplies its own decoder', () => {
    for (const providerId of registeredParserProviders()) {
      /* the two governed JSON endpoints */
      const endpoints: Record<string, string> = { EUROSTAT: 'prc_hicp_midx', TED: 'notices/search' };
      const binding = resolveParserBinding(providerId, endpoints[providerId]!, 'application/json');
      expect(binding).not.toBeNull();
      expect(typeof binding!.decode).toBe('function');
      expect(typeof binding!.assertEnvelope).toBe('function');
    }
  });

  it('the JSON rows name the LANDED strict decoder, not a copy of it', () => {
    const binding = resolveParserBinding('EUROSTAT', 'prc_hicp_midx', 'application/json');
    expect(binding!.decode).toBe(parseStrictJson);
  });

  it('the JSON path is byte-identical — same value, same refusal, same detail', () => {
    const binding = resolveParserBinding('EUROSTAT', 'prc_hicp_midx', 'application/json')!;
    const bytes = new TextEncoder().encode('{"value":{},"dimension":{},"id":[]}');

    const direct = parseStrictJson(bytes);
    const dispatched = binding.decode(bytes);
    expect(dispatched).toEqual(direct);

    const bad = new TextEncoder().encode('{"a":');
    expect(binding.decode(bad)).toEqual(parseStrictJson(bad));
  });

  it('an unbound endpoint still resolves to null rather than a default parser', () => {
    expect(resolveParserBinding('EUROSTAT', 'not a dataset code', 'application/json')).toBeNull();
    expect(resolveParserBinding('UNREVIEWED', 'anything', 'application/json')).toBeNull();
  });

  it('a media type the row is not authorised for does not resolve', () => {
    expect(resolveParserBinding('EUROSTAT', 'prc_hicp_midx', 'application/pdf')).toBeNull();
  });
});

/* ── A PDF MUST NEVER REACH BODY_NOT_JSON_SHAPED ─────────────────────────── */

describe('5 · the leading-byte sniff is media-aware', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7

  it('THE REQUIREMENT — a PDF is never refused as BODY_NOT_JSON_SHAPED', () => {
    expect(sniffRefusal(pdf, 'application/pdf')).toBeNull();
  });

  it('MUTATION CONTROL — under the JSON media type the same bytes ARE refused', () => {
    /* Proves the sniff still has teeth and that only the media arm changed. */
    expect(sniffRefusal(pdf, 'application/json')).toBe('BODY_NOT_JSON_SHAPED');
    expect(sniffRefusal(pdf)).toBe('BODY_NOT_JSON_SHAPED'); // default is JSON
  });

  it('the JSON path is completely unchanged', () => {
    const json = new TextEncoder().encode('{"a":1}');
    const arr = new TextEncoder().encode('  [1,2]');
    const html = new TextEncoder().encode('<!DOCTYPE html>');
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);

    expect(sniffRefusal(json, 'application/json')).toBeNull();
    expect(sniffRefusal(arr, 'application/json')).toBeNull();
    expect(sniffRefusal(html, 'application/json')).toBe('BODY_NOT_JSON_SHAPED');
    expect(sniffRefusal(bom, 'application/json')).toBe('BODY_NOT_JSON_SHAPED');
  });

  it('container facts stay UNIVERSAL — they describe the envelope, not the payload', () => {
    const gzip = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

    for (const media of ['application/json', 'application/pdf', 'text/csv']) {
      expect(sniffRefusal(gzip, media)).toBe('ENCODING_NOT_ALLOWED');
      expect(sniffRefusal(zip, media)).toBe('ARCHIVE_NOT_ALLOWED');
    }
  });

  it('an empty body under a non-JSON type refuses with a non-JSON vocabulary', () => {
    const empty = new Uint8Array([0x20, 0x20]);
    expect(sniffRefusal(empty, 'application/json')).toBe('BODY_NOT_JSON_SHAPED');
    expect(sniffRefusal(empty, 'application/pdf')).toBe('PARSE_FAILED');
  });
});

/* ── NO MEDIA CLASS IS CLAIMED WITHOUT A REAL DECODER ────────────────────── */

describe('6 · support is claimed only where a decoder actually exists', () => {
  it('XLS/XLSX/CSV are NOT registered — Main modelled the class, nobody built the decoder', () => {
    for (const media of [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/pdf',
    ]) {
      for (const provider of registeredParserProviders()) {
        expect(resolveParserBinding(provider, 'anything', media)).toBeNull();
      }
    }
  });

  it('the JSON allowlist was not widened', () => {
    /*
      §8's boundary. The dispatch path is general; the ADMITTED set is not. A
      media class becomes reachable by registering a row that supplies a real
      decoder, not by adding a string here.
    */
    const admission = require('./snapshot-admission') as {
      ALPHA_ADMITTED_MEDIA_TYPES: readonly string[];
    };
    expect([...admission.ALPHA_ADMITTED_MEDIA_TYPES]).toEqual(['application/json']);
  });

  it('a decoder is a function per row, so two rows cannot share one hardwired parser by accident', () => {
    const a = resolveParserBinding('EUROSTAT', 'prc_hicp_midx', 'application/json')!;
    const b = resolveParserBinding('TED', 'notices/search', 'application/json')!;
    expect(a.parserId).not.toBe(b.parserId);
    /* both legitimately name the same strict JSON decoder — that is the point:
       the JSON path is shared, and it is shared BY NAME rather than by default */
    expect(a.decode).toBe(b.decode);
    expect(a.assertEnvelope).not.toBe(b.assertEnvelope);
  });
});

/* ── TYPE-LEVEL USE AT RUNTIME, SO THE IMPORTS ARE REAL ──────────────────── */

describe('7 · the exported contract is usable as declared', () => {
  it('ArtifactDecoder admits the landed JSON decoder', () => {
    const decoder: ArtifactDecoder<unknown> = parseStrictJson;
    const out = decoder(new TextEncoder().encode('{}'));
    expect(out.ok).toBe(true);
  });

  it('a ParserBinding can be constructed for a non-JSON artifact type', () => {
    interface TableExtract {
      readonly rows: readonly (readonly string[])[];
    }
    const decode: ArtifactDecoder<TableExtract> = () => ({ ok: true, value: { rows: [] } });
    const binding: ParserBinding<TableExtract> = {
      parserId: 'test.table',
      parserVersion: '0.0.0',
      mediaType: 'application/pdf',
      decode,
      assertEnvelope: (v) => v.rows.length >= 0 || 'NO_ROWS',
    };
    const decoded = binding.decode(new Uint8Array());
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(binding.assertEnvelope(decoded.value)).toBe(true);
  });
});
