import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, deflateSync, inflateSync } from 'node:zlib';

import {
  PDF_MAX_COMPRESSION_RATIO,
  PDF_MAX_DECODED_BYTES_PER_STREAM,
  PDF_MAX_DECODED_BYTES_PER_DOCUMENT,
  PDF_MAX_FILTERS_PER_STREAM,
  SNAPSHOT_DECODED_BYTE_CAP,
} from '@globalnews-ai/shared';

import {
  createPdfDecodeAuditor,
  PDF_DECODE_BOUND_REFUSALS,
  PDF_READ_LIMITS,
  readPdfTextLayer,
  readPdfTextLayerOutcome,
  type PdfReadLimits,
} from './pdf-sync-text';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · B-2 — BOUNDED PDF DECOMPRESSION
 * ════════════════════════════════════════════════════════════════════════════
 * Contract: F-ASK-R2-PUBLIC-ASK-OPERATIONAL-CONTROLS-CLOSURE-R1 / 08 (R-1…R-8, FC-1…FC-6,
 * P-1…P-3, A-1…A-7). Acceptance: E1 b2-pdf-decompression.js 11/11 (run separately by
 * `_authority/b2-e1-harness-adapter.cjs`). Implementation-facing — E1 certifies.
 *
 * Every adversarial case is a REAL PDF the reader parses end to end (xref, page tree,
 * content streams, Form XObjects), not a call into a private helper, so the bound is
 * proven where the parser actually decodes.
 */

const MiB = 1024 * 1024;

type Obj = { num: number; body: string | Buffer };

/** A minimal, valid PDF: classic xref table, one catalog, a page tree, standard font. */
function buildPdf(objects: Obj[]): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n', 'latin1')];
  const offsets = new Map<number, number>();
  let length = parts[0]!.length;
  for (const o of objects) {
    offsets.set(o.num, length);
    const head = Buffer.from(`${o.num} 0 obj\n`, 'latin1');
    const body = typeof o.body === 'string' ? Buffer.from(o.body, 'latin1') : o.body;
    const tail = Buffer.from('\nendobj\n', 'latin1');
    parts.push(head, body, tail);
    length += head.length + body.length + tail.length;
  }
  const max = Math.max(...objects.map((o) => o.num));
  let xref = `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= max; n += 1) {
    const off = offsets.get(n);
    xref +=
      off === undefined ? '0000000000 65535 f \n' : `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${max + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

function stream(dict: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ]);
}

const FONT = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
const TEXT = (s: string): Buffer => Buffer.from(`BT /F1 12 Tf 72 720 Td (${s}) Tj ET\n`, 'latin1');

/** One page whose /Contents is the given stream objects (numbered from 10). */
function pageWithContents(contents: Buffer[], extra: Obj[] = [], resourcesExtra = ''): Buffer {
  const contentNums = contents.map((_, i) => 10 + i);
  const contentsRef =
    contentNums.length === 1
      ? `${contentNums[0]} 0 R`
      : `[${contentNums.map((n) => `${n} 0 R`).join(' ')}]`;
  return buildPdf([
    { num: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { num: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      num: 3,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> ${resourcesExtra} >> /Contents ${contentsRef} >>`,
    },
    { num: 4, body: FONT },
    ...contents.map((c, i) => ({ num: 10 + i, body: c })),
    ...extra,
  ]);
}

const flate = (data: Buffer, dict = '/Filter /FlateDecode'): Buffer =>
  stream(dict, deflateSync(data, { level: 9 }));

/**
 * Data that compresses at a REALISTIC ratio (~50:1 measured, inside the calibrated 512),
 * so the per-stream ratio term does not fire first and the control under test is the one
 * that has to stop it. Whitespace-only runs keep it a valid, inert content stream.
 * Deterministic: a fixed-seed LCG, HIGH bits only (its low bits cycle with a short
 * period, which deflate finds and compresses at ~800:1).
 */
function realisticRatioData(bytes: number, seed = 7): Buffer {
  const out = Buffer.alloc(bytes);
  const alphabet = [0x20, 0x0a, 0x09, 0x0d];
  let state = seed;
  const next = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state >>> 16;
  };
  let i = 0;
  while (i < bytes) {
    const run = 24 + (next() % 64);
    const byte = alphabet[next() % alphabet.length]!;
    out.fill(byte, i, Math.min(bytes, i + run));
    i += run;
  }
  return out;
}
const legitPage = (): Buffer => pageWithContents([flate(TEXT('CONSUMER PRICE INDEX AUGUST 2026'))]);

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

describe('B-2 · R-1/R-7 — the contract members exist and are imported, not re-declared', () => {
  it('PDF_READ_LIMITS carries the decoded ceilings from shared', () => {
    expect(PDF_READ_LIMITS.maxDecodedBytes).toBe(PDF_MAX_DECODED_BYTES_PER_STREAM);
    expect(PDF_READ_LIMITS.maxDocumentDecodedBytes).toBe(PDF_MAX_DECODED_BYTES_PER_DOCUMENT);
    expect(PDF_MAX_DECODED_BYTES_PER_STREAM).toBe(SNAPSHOT_DECODED_BYTE_CAP);
    expect(PDF_MAX_FILTERS_PER_STREAM).toBe(1);
    expect(PDF_MAX_COMPRESSION_RATIO).toBe(512);
  });

  it('MU-7 guard: the parser declares no bound literal of its own', () => {
    const src = readFileSync(join(__dirname, 'pdf-sync-text.ts'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(src).not.toMatch(/const\s+PDF_MAX_(COMPRESSION_RATIO|DECODED|DOCUMENT|FILTERS)/);
    expect(src).toMatch(/from '@globalnews-ai\/shared'/);
    expect(src).toMatch(/maxOutputLength: bound/g);
    expect(src.match(/maxOutputLength: bound/g)).toHaveLength(2);
  });

  it('FC-2: four distinct bound-refusal keys, none equal to FLATE_INFLATE_FAILED', () => {
    expect([...PDF_DECODE_BOUND_REFUSALS]).toEqual([
      'FLATE_OUTPUT_CAP_EXCEEDED',
      'DOCUMENT_DECODED_BUDGET_EXCEEDED',
      'FILTER_CHAIN_TOO_LONG',
      'PREDICTOR_OUTPUT_CAP_EXCEEDED',
    ]);
  });
});

describe('B-2 · positive controls — legitimate PDFs still read (P-1…P-3)', () => {
  it('P-3: a legitimate single-stream text page reads', () => {
    const out = readPdfTextLayerOutcome(legitPage());
    expect(out.refusal).toBeNull();
    expect(out.layer?.runs.map((r) => r.text).join('')).toContain(
      'CONSUMER PRICE INDEX AUGUST 2026',
    );
  });

  it('P-2: a legitimate multi-stream page and a nested Form XObject read', () => {
    const multi = pageWithContents([
      flate(TEXT('PART ONE')),
      flate(TEXT('PART TWO')),
      flate(TEXT('PART THREE')),
    ]);
    expect(readPdfTextLayer(multi)?.runs.map((r) => r.text)).toEqual([
      'PART ONE',
      'PART TWO',
      'PART THREE',
    ]);

    const form = flate(
      TEXT('INSIDE A FORM'),
      '/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Filter /FlateDecode',
    );
    const nested = pageWithContents(
      [flate(Buffer.from('/X1 Do\n', 'latin1'))],
      [{ num: 20, body: form }],
      '/XObject << /X1 20 0 R >>',
    );
    expect(readPdfTextLayer(nested)?.runs.map((r) => r.text)).toEqual(['INSIDE A FORM']);
  });

  it('P-2: a legitimate FlateDecode + PNG predictor stream decodes', () => {
    /* Columns 8: each row = 1 filter byte (0 = None) + 8 data bytes. */
    const text = TEXT('PREDICTED');
    const rows: number[] = [];
    for (let i = 0; i < text.length; i += 8) {
      rows.push(0);
      for (let j = 0; j < 8; j += 1) rows.push(text[i + j] ?? 0x20);
    }
    const s = stream(
      '/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 8 >>',
      deflateSync(Buffer.from(rows)),
    );
    expect(readPdfTextLayer(pageWithContents([s]))?.runs.map((r) => r.text)).toEqual(['PREDICTED']);
  });

  it('P-1 (real document): the in-repo NISR Imihigo PDF decodes without any bound refusal', () => {
    const path = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'data',
      'imihigo',
      'nisr-imihigo-2024-2025.pdf',
    );
    expect(existsSync(path)).toBe(true);
    const out = readPdfTextLayerOutcome(new Uint8Array(readFileSync(path)), {
      ...PDF_READ_LIMITS,
      maxPages: 64,
    });
    /* The reader may refuse this document for its own pre-existing reasons (fonts, size);
       what B-2 must never do is refuse it on a DECODE BOUND. */
    if (out.refusal !== null)
      expect(PDF_DECODE_BOUND_REFUSALS as readonly string[]).not.toContain(out.refusal.key);
  });
});

describe('B-2 · adversarial controls (A-1…A-7)', () => {
  const zeros64 = Buffer.alloc(64 * MiB, 0);

  it('A-1: single-layer high-ratio stream is refused during inflation, fast', () => {
    const bomb = pageWithContents([
      stream('/Filter /FlateDecode', deflateSync(zeros64, { level: 9 })),
    ]);
    const { value, ms } = timed(() => readPdfTextLayerOutcome(bomb));
    expect(value.layer).toBeNull();
    expect(value.refusal?.key).toBe('FLATE_OUTPUT_CAP_EXCEEDED');
    expect(value.refusal?.bound).toBeLessThanOrEqual(PDF_MAX_DECODED_BYTES_PER_STREAM);
    expect(ms).toBeLessThan(250);
  });

  it('A-2: the raw-deflate variant (zlib header omitted) is refused identically', () => {
    const bomb = pageWithContents([
      stream('/Filter /FlateDecode', deflateRawSync(zeros64, { level: 9 })),
    ]);
    const out = readPdfTextLayerOutcome(bomb);
    expect(out.refusal?.key).toBe('FLATE_OUTPUT_CAP_EXCEEDED');
  });

  it('A-3: two chained FlateDecode filters are refused before the first inflate', () => {
    const inner = deflateSync(Buffer.alloc(8 * MiB, 0), { level: 9 });
    const chained = pageWithContents([
      stream('/Filter [/FlateDecode /FlateDecode]', deflateSync(inner, { level: 9 })),
    ]);
    const { value, ms } = timed(() => readPdfTextLayerOutcome(chained));
    expect(value.refusal?.key).toBe('FILTER_CHAIN_TOO_LONG');
    expect(ms).toBeLessThan(100);
  });

  it('A-4: many streams summing over the document budget are refused by the cumulative budget', () => {
    const data = realisticRatioData(6 * MiB);
    const chunk = flate(data);
    /* Each stream is individually admissible (under 8 MiB and under the ratio bound)… */
    expect(deflateSync(data, { level: 9 }).length * PDF_MAX_COMPRESSION_RATIO).toBeGreaterThan(
      data.length,
    );
    const many = pageWithContents(Array.from({ length: 8 }, () => chunk));
    expect(many.length).toBeLessThan(PDF_READ_LIMITS.maxBytes);
    /* …and only the document budget stops eight of them. */
    expect(readPdfTextLayerOutcome(many).refusal?.key).toBe('DOCUMENT_DECODED_BUDGET_EXCEEDED');
    /* Control: five fit inside the budget and are not refused on a bound. */
    const five = readPdfTextLayerOutcome(pageWithContents(Array.from({ length: 5 }, () => chunk)));
    if (five.refusal !== null)
      expect(PDF_DECODE_BOUND_REFUSALS as readonly string[]).not.toContain(five.refusal.key);
  });

  it('A-5: predictor expansion over the remaining budget is refused before allocating', () => {
    const s = stream(
      '/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 1000000000 >>',
      deflateSync(Buffer.from([0, 1, 2, 3])),
    );
    const { value, ms } = timed(() => readPdfTextLayerOutcome(pageWithContents([s])));
    expect(value.refusal?.key).toBe('PREDICTOR_OUTPUT_CAP_EXCEEDED');
    expect(ms).toBeLessThan(100);
  });

  it('A-6: a nested Form XObject chain shares ONE budget (never reset per level)', () => {
    /* Seven nested forms, each carrying 6 MiB of padding before calling the next. Depth 7 is
       inside MAX_XOBJECT_DEPTH (8), so only the byte budget can stop it. */
    const pad = realisticRatioData(6 * MiB, 11);
    const extra: Obj[] = [];
    for (let level = 1; level <= 7; level += 1) {
      const next = level < 7 ? `/X${level + 1} Do\n` : '';
      const body = Buffer.concat([pad, Buffer.from(next, 'latin1')]);
      const res =
        level < 7 ? `/Resources << /XObject << /X${level + 1} ${20 + level} 0 R >> >>` : '';
      extra.push({
        num: 19 + level,
        body: flate(
          body,
          `/Type /XObject /Subtype /Form /BBox [0 0 1 1] ${res} /Filter /FlateDecode`,
        ),
      });
    }
    const nested = pageWithContents(
      [flate(Buffer.from('/X1 Do\n', 'latin1'))],
      extra,
      '/XObject << /X1 20 0 R >>',
    );
    const out = readPdfTextLayerOutcome(nested);
    expect(out.refusal?.key).toBe('DOCUMENT_DECODED_BUDGET_EXCEEDED');
  });

  it('A-7: resident memory stays under a watermark across A-1…A-6 (the process, not the request)', () => {
    const before = process.memoryUsage().rss;
    for (let i = 0; i < 3; i += 1) {
      readPdfTextLayerOutcome(
        pageWithContents([stream('/Filter /FlateDecode', deflateSync(zeros64, { level: 1 }))]),
      );
    }
    const grown = process.memoryUsage().rss - before;
    expect(grown).toBeLessThan(256 * MiB);
  });

  it('G7/G8: malformed and truncated streams refuse as FLATE_INFLATE_FAILED (a bad file, not a bomb)', () => {
    const malformed = pageWithContents([
      stream('/Filter /FlateDecode', Buffer.from([0x78, 0x9c, 0xff, 0xff, 0xff, 0xff])),
    ]);
    expect(readPdfTextLayerOutcome(malformed).refusal?.key).toBe('FLATE_INFLATE_FAILED');
    /* A truncated stream at a LEGITIMATE ratio: the truncation, not a bound, is the cause. */
    const full = deflateSync(realisticRatioData(256 * 1024, 3));
    const truncated = pageWithContents([
      stream('/Filter /FlateDecode', full.subarray(0, Math.floor(full.length / 2))),
    ]);
    expect(readPdfTextLayerOutcome(truncated).refusal?.key).toBe('FLATE_INFLATE_FAILED');
    /* E1's own G8 fixture (1 MiB of one byte, ~1000:1) is refused too — on the ratio bound,
       which it genuinely exceeds before its truncation is reached. Refused either way. */
    const e1 = deflateSync(Buffer.alloc(MiB, 0x42));
    expect(
      readPdfTextLayerOutcome(
        pageWithContents([stream('/Filter /FlateDecode', e1.subarray(0, e1.length >> 1))]),
      ).layer,
    ).toBeNull();
  });
});

describe('B-2 · FC-6 — fail closed on a missing bound', () => {
  it('hand-built limits without the decoded ceilings refuse rather than inflate unbounded', () => {
    const legacy = {
      maxBytes: 4 * MiB,
      maxPages: 64,
      maxWallMs: 20_000,
      maxRuns: 200_000,
    } as unknown as PdfReadLimits;
    expect(readPdfTextLayerOutcome(legitPage(), legacy).refusal?.key).toBe('DECODED_BOUND_MISSING');
    const infinite = { ...PDF_READ_LIMITS, maxDecodedBytes: Number.POSITIVE_INFINITY };
    expect(readPdfTextLayerOutcome(legitPage(), infinite).refusal?.key).toBe(
      'DECODED_BOUND_MISSING',
    );
  });

  it('a NaN bound never reaches zlib — zlib treats maxOutputLength NaN as "no limit"', () => {
    /* The measured fact that makes this guard load-bearing (found during integration, when a
       stale shared build left the constants undefined): */
    const bomb = deflateSync(Buffer.alloc(16 * MiB, 0));
    expect(inflateSync(bomb, { maxOutputLength: Number.NaN }).length).toBe(16 * MiB);
    /* …and the auditor/budget refuses such a bound before any decode. */
    const auditor = (): unknown =>
      createPdfDecodeAuditor({ ...PDF_READ_LIMITS, maxDecodedBytes: Number.NaN });
    expect(auditor).toThrow('DECODED_BOUND_MISSING');
    expect(
      readPdfTextLayerOutcome(legitPage(), {
        ...PDF_READ_LIMITS,
        maxDocumentDecodedBytes: Number.NaN,
      }).refusal?.key,
    ).toBe('DECODED_BOUND_MISSING');
  });
});

describe('B-2 · the audit seam runs the real decode path', () => {
  it('refuses the E1 classes through decodeStream, admits the positive control, and resets after a refusal', () => {
    const a = createPdfDecodeAuditor();
    expect(() => a.decode(deflateSync(Buffer.alloc(64 * MiB, 0)), ['FlateDecode'])).toThrow(
      'FLATE_OUTPUT_CAP_EXCEEDED',
    );
    expect(() => a.decode(deflateRawSync(Buffer.alloc(64 * MiB, 0)), ['FlateDecode'])).toThrow(
      'FLATE_OUTPUT_CAP_EXCEEDED',
    );
    expect(() => a.decode(Buffer.from([1, 2, 3]), ['FlateDecode', 'FlateDecode'])).toThrow(
      'FILTER_CHAIN_TOO_LONG',
    );
    const legit = deflateSync(
      Buffer.from('BT /F1 12 Tf (CONSUMER PRICE INDEX AUGUST 2026) Tj ET\n'.repeat(400)),
    );
    expect(a.decode(legit, ['FlateDecode']).length).toBe(21600);
  });
});
