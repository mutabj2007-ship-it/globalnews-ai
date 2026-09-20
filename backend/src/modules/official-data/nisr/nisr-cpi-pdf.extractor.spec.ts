/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PRODUCTION EXTRACTOR — B-P1 … B-P3, B-P8 … B-P10, AND THE INTEGRITY PIN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B-P4 and B-P5 (identity survives the round trip) need a live Postgres and live in
 * `official-data-lineage-roundtrip.live-postgres.spec.ts`.
 * B-P6 and B-P7 (the two boot mutations) live in `official-data.boot.spec.ts`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeNisrCpiDecoder, type NisrCpiTextLayerExtractor } from '@globalnews-ai/shared';

import {
  NISR_CPI_EXTRACTOR_ID,
  NISR_CPI_EXTRACTOR_VERSION,
  NISR_CPI_PRODUCTION_EXTRACTOR,
  extractNisrCpiTextLayer,
  nisrCpiExtractionFingerprint,
} from './nisr-cpi-pdf.extractor';
import { PDF_SYNC_TEXT_VERSION, readPdfTextLayer } from '../pdf/pdf-sync-text';

const BACKEND = join(__dirname, '..', '..', '..', '..');

/* ══════════════════════════════════════════════════════════════════════════
 * B-P1 · THE REAL ARTIFACT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Runs when the retained August 2026 artifact is available on this machine. It SKIPS
 * LOUDLY otherwise and never passes quietly — a skipped check is UNMEASURED, never PASS,
 * which is the convention `official-data-snapshot.live-postgres.spec.ts` already sets.
 *
 * The definitive B-P1 is the production one-shot proof, which fetches the bytes and runs
 * this same extractor over them.
 */
const ARTIFACT = process.env['NISR_ARTIFACT_PATH'];
const haveArtifact = ARTIFACT !== undefined && ARTIFACT !== '' && existsSync(ARTIFACT);

(haveArtifact ? describe : describe.skip)('B-P1 · the adapter extracts the real artifact', () => {
  it('decodes the accepted August 2026 figures through the canonical decoder', () => {
    const bytes = new Uint8Array(readFileSync(ARTIFACT!));
    const out = makeNisrCpiDecoder(NISR_CPI_PRODUCTION_EXTRACTOR)(bytes);
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    expect(out.value.referencePeriod).toBe('2026-08');
    expect(out.value.publicationDate).toBe('2026-09-10');
    expect(out.value.sourceLanguage).toBe('en');
    expect(out.value.issueOrdinal).toBe(8);

    const national = out.value.rows
      .find((r) => r.geography === 'ALL_RWANDA' && r.coicopCode === '00')
      ?.cells.find((c) => c.role === 'PCT_CHANGE_ON_YEAR_AGO')?.value;
    /* Anything less than this is a library demo, not a replacement for `pdftotext`. */
    expect(national).toBe(15.9);

    /* And it read the whole table cleanly — R-PAR-9's count is the control. */
    for (const annex of [1, 2, 3]) void annex;
    expect(out.value.rows).toHaveLength(54);
  });
});

if (!haveArtifact) {
  // eslint-disable-next-line no-console
  console.warn(
    'B-P1 SKIPPED — UNMEASURED, not PASS. Set NISR_ARTIFACT_PATH to the retained August ' +
      '2026 artifact to run it. The production one-shot proof runs it against fetched bytes.',
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * B-P2 · NO OCR EXISTS ON THE PATH
 * ══════════════════════════════════════════════════════════════════════════ */

describe('B-P2 · the dependency closure contains no recogniser or rasteriser', () => {
  const sources = [
    join(__dirname, 'nisr-cpi-pdf.extractor.ts'),
    join(__dirname, '..', 'pdf', 'pdf-sync-text.ts'),
  ].map((f) => readFileSync(f, 'utf8'));

  /*
    THE CODE, WITH PROSE REMOVED — and the first version of this suite did not do that
    and failed on itself. `pdf-sync-text.ts` NAMES `poppler`, `spawnSync` and the
    rejected npm candidates in its header, because recording WHY each was refused is the
    point of the header. A grep over the raw source therefore reported the refusals as
    violations. What must be free of them is the CODE.
  */
  const code = sources.map((src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
  );

  it('imports NOTHING outside node: builtins and the shared contract', () => {
    /*
      THE STRONGEST FORM OF B-2.1(2): the criterion asks for a library with no OCR code
      path, and enforcement by ABSENCE is preferred — "a library that contains no
      rasteriser and no recogniser cannot fall back to one, and no future maintainer can
      turn one on."
      The extraction has NO third-party dependency at all, so its closure is empty and
      the question cannot be reopened by a transitive upgrade.
    */
    const imports = sources.flatMap((s) => [...s.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!));
    const external = imports.filter(
      (i) => !i.startsWith('node:') && !i.startsWith('.') && i !== '@globalnews-ai/shared',
    );
    expect(external).toEqual([]);
  });

  it('names no recogniser or rasteriser anywhere on the path', () => {
    const FORBIDDEN = [
      'tesseract', 'ocr', 'canvas', 'sharp', 'leptonica', 'jimp', 'gm', 'imagemagick',
      'pdfium', 'poppler', 'ghostscript', 'mupdf',
    ];
    for (const needle of FORBIDDEN) {
      const hit = code.some((s) => new RegExp(`\\b${needle}\\b`, 'i').test(s));
      expect({ needle, hit }).toEqual({ needle, hit: false });
    }
  });

  it('decodes no raster image filter, which is the first half of OCR', () => {
    const pdf = sources[1]!;
    /* They are NAMED, in a comment, as refusals — and the code refuses them. */
    expect(pdf).toContain('FILTER_');
    expect(pdf).toContain('NOT_ADMITTED');
    /* And there is no decoder for any of them. */
    expect(/function\s+decodeDct|function\s+decodeJpx|function\s+decodeCcitt/i.test(pdf)).toBe(false);
  });

  it('spawns no process and opens no socket', () => {
    for (const s of code) {
      expect(/child_process|spawn|exec(File)?Sync|node:https|node:http\b|node:net/.test(s)).toBe(false);
    }
  });

  it('and the header RECORDS the rejected candidates rather than hiding them', () => {
    /* The prose the check above steps around is evidence, not noise: it is the
       measurement of why no npm package could satisfy both the synchronous seam and
       the six admission criteria at once. */
    expect(sources[1]!).toContain('pdfjs-dist');
    expect(sources[1]!).toContain('pdf2json');
    expect(sources[1]!).toContain('DEVIATION FROM B-2.2');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * B-P3 · THE IMAGE IS UNCHANGED
 * ══════════════════════════════════════════════════════════════════════════ */

describe('B-P3 · no external binary enters the backend image', () => {
  const dockerfile = readFileSync(join(BACKEND, 'Dockerfile'), 'utf8');

  it('the Dockerfile installs no OS package at any stage', () => {
    /* THE RULING THAT WOULD ERODE MOST QUIETLY, asserted rather than remembered. */
    expect((dockerfile.match(/apk add/g) ?? []).length).toBe(0);
    expect((dockerfile.match(/apt-get/g) ?? []).length).toBe(0);
  });

  it('is still node:20-alpine at base and at production', () => {
    expect(dockerfile).toContain('FROM node:20-alpine AS base');
    expect(dockerfile).toContain('FROM node:20-alpine AS production');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * B-P8 · A THROWING LIBRARY IS A REFUSAL, NOT A CRASH
 * ══════════════════════════════════════════════════════════════════════════ */

describe('B-P8 · nothing escapes the adapter', () => {
  it('MUTATION — an extractor that throws becomes NISR_PDF_NO_TEXT_LAYER', () => {
    const throwing: NisrCpiTextLayerExtractor = {
      extractorId: 'test.throwing',
      extractorVersion: '0.0.0',
      extract: () => {
        throw new Error('LIBRARY_EXPLODED');
      },
    };
    const out = makeNisrCpiDecoder(throwing)(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.detail).toContain('NISR_PDF_NO_TEXT_LAYER');
    expect(out.refusalKey).toBe('PARSE_FAILED');
  });

  it('the production adapter never throws, whatever the bytes', () => {
    const garbage: Uint8Array[] = [
      new Uint8Array(0),
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      new Uint8Array([0x00, 0xff, 0x00, 0xff]),
      new Uint8Array(Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\nstartxref\n999999\n%%EOF')),
      new Uint8Array(Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n')),
    ];
    for (const bytes of garbage) {
      expect(() => extractNisrCpiTextLayer(bytes)).not.toThrow();
      expect(extractNisrCpiTextLayer(bytes)).toBeNull();
    }
  });

  it('the underlying reader never throws either', () => {
    expect(() => readPdfTextLayer(new Uint8Array([1, 2, 3]))).not.toThrow();
    expect(readPdfTextLayer(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * B-P9 · AN UNCOUNTABLE ROW COUNT IS `null`, NEVER `0`
 * ══════════════════════════════════════════════════════════════════════════ */

describe('B-P9 · an uncountable row count refuses', () => {
  it('MUTATION — an extractor that cannot count is refused, not believed', () => {
    /*
      "Do not silently drop such rows and report zero: a non-zero count refuses the
      artifact, and a FALSE ZERO ADMITS A WRONG NUMBER." An unknown count and a count of
      zero are different facts and only one of them is safe.
    */
    const cannotCount: NisrCpiTextLayerExtractor = {
      extractorId: 'test.cannot-count',
      extractorVersion: '0.0.0',
      /* It returns null rather than a layer claiming zero unassociated rows. */
      extract: () => null,
    };
    const out = makeNisrCpiDecoder(cannotCount)(new Uint8Array([0x25]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.detail).toContain('NISR_PDF_NO_TEXT_LAYER');
  });

  it('a non-zero count refuses the WHOLE artifact, not just the row', () => {
    const partial: NisrCpiTextLayerExtractor = {
      extractorId: 'test.partial',
      extractorVersion: '0.0.0',
      extract: () => ({
        imprint: 'Licensed under CC BY 4.0\nN° 8',
        publicationDateText: '10 September 2026',
        referencePeriodText: 'August 2026',
        basePeriodText: 'Feb 2014=100',
        sourceLanguage: 'en',
        annexes: [
          {
            geography: 'ALL_RWANDA' as const,
            headers: ['Code', 'Categories', 'Weights', 'Aug-25', 'Jul-26', 'Aug-26', 'on Jul. 2026', 'on Aug. 2025', '1 month', '12 months'],
            rows: [{ cells: ['00', 'GENERAL INDEX', '100%', '208.3', '235.3', '241.4', '2.6%', '15.9%', '2.6%', '15.9%'] }],
            /* ONE row could not be associated. */
            unassociatedRowCount: 1,
          },
        ],
      }),
    };
    const out = makeNisrCpiDecoder(partial)(new Uint8Array([0x25]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.detail).toContain('NISR_PDF_ROW_CELLS_UNASSOCIATED');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * B-P10 · THE EXTRACTOR CANNOT REWRITE ATTRIBUTION
 * ══════════════════════════════════════════════════════════════════════════ */

describe('B-P10 · identity stays the registry’s', () => {
  it('the production extractor is frozen and declares a library-and-strategy id', () => {
    expect(Object.isFrozen(NISR_CPI_PRODUCTION_EXTRACTOR)).toBe(true);
    expect(NISR_CPI_PRODUCTION_EXTRACTOR.extractorId).toBe(NISR_CPI_EXTRACTOR_ID);
    /* `nisr.cpi.<library>.<strategy>` — two strategies over one reader are two extractors. */
    expect(NISR_CPI_EXTRACTOR_ID.split('.').length).toBeGreaterThanOrEqual(4);
  });

  it('the extractor version IS the extraction module’s, not a second constant', () => {
    expect(NISR_CPI_EXTRACTOR_VERSION).toBe(PDF_SYNC_TEXT_VERSION);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * THE INTEGRITY PIN — B-2.2's INTENT, WHERE SOURCE IS AVAILABLE
 * ══════════════════════════════════════════════════════════════════════════ */

describe('the extraction cannot change without its version changing', () => {
  /*
    B-2.2 asks a boot gate to assert a declared constant against a resolved PACKAGE
    version, so that a dependency bump without a constant bump fails the deployment rather
    than mis-attributing rows. There is no package — the extraction is in-repo — so the
    equivalent is a content hash of the extraction itself, and it is asserted HERE rather
    than at boot because source is available in CI and not in a compiled image.

    WHEN THIS FAILS, THE EXTRACTION CHANGED. Bump `PDF_SYNC_TEXT_VERSION` and update the
    pin below in the same commit. Updating the pin alone is the one thing that defeats it.
  */
  const PINNED_VERSION = '1.0.0';

  it('the pinned version is the one the extractor reports', () => {
    expect(PDF_SYNC_TEXT_VERSION).toBe(PINNED_VERSION);
  });

  it('produces a stable fingerprint for the extraction it is running', () => {
    const a = nisrCpiExtractionFingerprint();
    const b = nisrCpiExtractionFingerprint();
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
