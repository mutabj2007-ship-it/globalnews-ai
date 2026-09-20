/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PRODUCTION NISR CPI TEXT-LAYER EXTRACTOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The one place a general-purpose PDF reader meets a governed contract, so the whole of
 * the narrowing lives here — ruling B-2.3.
 *
 * ── WHAT IT REPLACES ──────────────────────────────────────────────────────
 *
 * The accepted first-real-data proof extracted its text with `pdftotext`, a tooling-only
 * subprocess. That cannot be the production seam: `NisrCpiTextLayerExtractor.extract` is
 * **synchronous**, a subprocess needs `spawnSync`, and `backend/Dockerfile` is
 * `node:20-alpine` with no `apk add` at any stage and stays that way (B-2).
 *
 * This adapter is pure JS, in process, and synchronous. It reads the text layer through
 * `readPdfTextLayer`, whose header records why no npm package could satisfy both the
 * synchronous seam and the six admission criteria at once.
 *
 * ── THE ASSOCIATION RULE, WHICH IS THE ONLY PART THAT CAN BE WRONG QUIETLY ─
 *
 * `R-PAR-9`: a PDF has glyphs at coordinates, not a governed table.
 *
 * A PDF splits one label across several runs for kerning. Grouping them by the distance
 * between run ORIGINS cannot work, because those distances overlap: in the real August
 * annex header, `12 mon`→`ths` (one cell) is 26.9 apart while `ts`→`Aug-25` (two cells)
 * is 23.3 apart. Measured from where a run ENDS, using the font's own advance widths, the
 * two populations separate completely:
 *
 *     within a cell   -0.3 … 0.0      runs are typeset adjacent
 *     between cells   14.7 … 235.7    the narrowest real column gap is 14.7
 *
 * So the threshold sits in an empty band more than ten units wide, and it is a
 * MEASUREMENT rather than a tuning parameter. A row that does not yield exactly ten cells
 * is COUNTED as unassociated, never dropped and never repaired.
 */

import { createHash } from 'node:crypto';

import type {
  NisrCpiGeography,
  NisrCpiTextLayer,
  NisrCpiTextLayerAnnex,
  NisrCpiTextLayerExtractor,
} from '@globalnews-ai/shared';

import {
  PDF_READ_LIMITS,
  PDF_SYNC_TEXT_VERSION,
  readPdfTextLayer,
  type PdfTextRun,
} from '../pdf/pdf-sync-text';

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · IDENTITY
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `nisr.cpi.<library>.<strategy>` — B-2.2. The "library" is this deployment's own
 * synchronous reader, and the strategy is positional cell association over its runs.
 *
 * Two extraction strategies over one reader are two different extractors and must not
 * share an id, because they can produce different layers from identical bytes.
 */
export const NISR_CPI_EXTRACTOR_ID = 'nisr.cpi.pdfsynctext.positional' as const;

/**
 * DERIVED, NOT RE-DECLARED — and that is the whole of B-2.2's intent.
 *
 * B-2.2 asks the boot gate to assert a declared constant against "the resolved installed
 * version of the pinned package", because a hand-typed version constant goes stale when a
 * dependency moves underneath it. There is no package here, so there is no npm version to
 * resolve; what there is instead is a stronger arrangement:
 *
 *   1. this value IS the extraction module's own exported version — it cannot disagree
 *      with the code that produced the layer, because there is only one constant; and
 *   2. `nisr-pdf-extractor.integrity.spec.ts` pins a content hash of the extraction
 *      source, so changing the extraction WITHOUT bumping that version fails CI.
 *
 * An npm version check detects dependency drift and would not notice an edit to the
 * extraction itself. The split is deliberate: a WIRING question is answered at boot, and
 * a SOURCE-INTEGRITY question is answered where source is available, which is CI.
 */
export const NISR_CPI_EXTRACTOR_VERSION = PDF_SYNC_TEXT_VERSION;

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · LINES AND CELLS
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Measured: within a cell the gap is at most 0, between cells at least 14.7. The
 * threshold sits in the empty band, far from both populations.
 */
const CELL_GAP = 4;
/** Runs share a baseline within this many user-space units. */
const LINE_TOLERANCE = 1.6;

const COLUMN_COUNT = 10;

interface Line {
  readonly page: number;
  readonly y: number;
  readonly cells: readonly string[];
  /** The joined text of the whole line, for matching document-level anchors. */
  readonly text: string;
}

function toLines(runs: readonly PdfTextRun[]): Line[] {
  const byPage = new Map<number, PdfTextRun[]>();
  for (const r of runs) {
    const a = byPage.get(r.page) ?? [];
    a.push(r);
    byPage.set(r.page, a);
  }

  const lines: Line[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const grouped: { y: number; runs: PdfTextRun[] }[] = [];
    /* Top of the page first, then left to right — reading order. */
    for (const r of [...byPage.get(page)!].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const hit = grouped.find((g) => Math.abs(g.y - r.y) <= LINE_TOLERANCE);
      if (hit === undefined) grouped.push({ y: r.y, runs: [r] });
      else hit.runs.push(r);
    }

    for (const g of grouped) {
      const sorted = [...g.runs].sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let current = '';
      let prevEnd: number | null = null;
      for (const r of sorted) {
        if (prevEnd !== null && r.x - prevEnd > CELL_GAP) {
          cells.push(current.trim());
          current = '';
        }
        current += r.text;
        prevEnd = r.x + r.width;
      }
      if (current.trim() !== '') cells.push(current.trim());
      const kept = cells.filter((c) => c !== '');
      if (kept.length === 0) continue;
      lines.push({ page, y: g.y, cells: kept, text: kept.join(' ').replace(/\s+/g, ' ').trim() });
    }
  }
  return lines;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · THE DOCUMENT-LEVEL ANCHORS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * None is read from the filename or the upload folder. The artifact's own filename
 * contains "AUGUST 2026" and its folder is `2026-09` — the reference period and a month
 * that is not it — and `R-AID-1` forbids parsing either.
 */

const ANNEX_HEAD = /^Annex\s+\d+:\s*Consumer Price Index,\s*(.+?)$/;
const ANNEX_GEOGRAPHY: Readonly<Record<string, NisrCpiGeography>> = Object.freeze({
  urban: 'URBAN',
  rural: 'RURAL',
  'all rwanda': 'ALL_RWANDA',
});
/** The publisher's own end-of-table marker. Everything after it is notes, not rows. */
const TABLE_END = /^Source\s*:/i;
const RUNNING_FOOTER = /National Institute of Statistics of Rwanda\s*\/\s*CPI/;

/**
 * The edition language, OBSERVED — never a declared locale tag.
 *
 * Corroborated structurally as well as here: the decoder's column binder requires the
 * five FIXED English headers to bind, so a French edition (`Catégories`) fails to bind and
 * is refused rather than mislabelled as English.
 */
const ENGLISH_EDITION_MARKERS: readonly string[] = [
  'Consumer Price Index',
  'GENERAL INDEX',
  'Categories',
  'Weights',
];

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE EXTRACTION
 * ══════════════════════════════════════════════════════════════════════════ */

export function extractNisrCpiTextLayer(bytes: Uint8Array): NisrCpiTextLayer | null {
  try {
    const layer = readPdfTextLayer(bytes, PDF_READ_LIMITS);
    if (layer === null) return null;

    const lines = toLines(layer.runs);
    if (lines.length === 0) return null;
    const whole = lines.map((l) => l.text).join('\n');

    /* ── the three document facts, each from its own anchor ──────────────── */

    /* The publication states its own reference period in a sentence. */
    const reference = /for the month of\s+([A-Za-z]+\s+\d{4})/.exec(whole);
    /* The cover carries the publication date on a line of its own. */
    const publication = lines.find((l) => /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(l.text));
    /* The definitions section names the index reference period. */
    const base = /Index reference period\s*\(([^)]*)\)/.exec(whole);
    if (reference === null || publication === undefined || base === null) return null;

    /* ── the imprint ─────────────────────────────────────────────────────
       A footer occurrence that ENDS at the issue ordinal is SELECTED rather than one
       being trimmed to look as though it does — a selection a reviewer can check instead
       of an edit they cannot see. If none qualifies the footer is still carried and the
       decoder records `issueOrdinal: null`, which is honest and never a guess. */
    const licence = lines.find((l) => l.text.includes('Licensed under'))?.text ?? '';
    const footers = lines.filter((l) => RUNNING_FOOTER.test(l.text)).map((l) => l.text);
    const completeFooter = footers.find((f) => /N°\s*\d{1,2}$/u.test(f));
    const imprint = [licence, completeFooter ?? footers[0] ?? ''].filter((x) => x !== '').join('\n');

    /* ── the annexes ─────────────────────────────────────────────────────── */
    const headIndexes = lines
      .map((l, i) => (ANNEX_HEAD.test(l.text) ? i : -1))
      .filter((i) => i >= 0);

    const annexes: NisrCpiTextLayerAnnex[] = [];
    for (let k = 0; k < headIndexes.length; k += 1) {
      const from = headIndexes[k]!;
      const to = k + 1 < headIndexes.length ? headIndexes[k + 1]! : lines.length;

      const title = ANNEX_HEAD.exec(lines[from]!.text)?.[1] ?? '';
      const geography = ANNEX_GEOGRAPHY[title.trim().toLowerCase()];
      if (geography === undefined) continue; // caught by the structural check below

      let headerIdx = -1;
      for (let i = from; i < to; i += 1) {
        const c = lines[i]!.cells;
        if (c.length === COLUMN_COUNT && c[0] === 'Code' && c[1] === 'Categories') {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) return null;

      const rows: { cells: readonly string[] }[] = [];
      let unassociatedRowCount = 0;
      for (let i = headerIdx + 1; i < to; i += 1) {
        const line = lines[i]!;
        if (TABLE_END.test(line.text)) break;
        if (RUNNING_FOOTER.test(line.text)) continue; // page furniture, not a row
        if (/^\d{1,3}$/.test(line.text)) continue; // a bare page number
        if (line.cells.length === COLUMN_COUNT) {
          rows.push({ cells: line.cells });
          continue;
        }
        /*
          R-PAR-9. NOT DROPPED AND NOT REPAIRED — COUNTED. A non-zero count refuses the
          whole artifact at the decoder, and a false zero would admit a wrong number. The
          extractor's candour is the only thing that control rests on.
        */
        unassociatedRowCount += 1;
      }

      annexes.push({
        geography,
        headers: lines[headerIdx]!.cells,
        rows,
        unassociatedRowCount,
      });
    }

    /* A document whose annex structure is not the one this extractor measured is refused:
       an unrecognised annex heading is not skipped quietly. */
    if (annexes.length !== headIndexes.length) return null;
    if (annexes.length === 0) return null;

    const sourceLanguage = ENGLISH_EDITION_MARKERS.every((m) => whole.includes(m)) ? 'en' : '';

    return {
      imprint,
      publicationDateText: publication.text,
      referencePeriodText: (reference[1] ?? '').trim(),
      basePeriodText: (base[1] ?? '').replace(/\s+/g, ' ').trim(),
      sourceLanguage,
      annexes,
    };
  } catch {
    /*
      CATCH EVERYTHING, RETURN null — B-2.3. An exception escaping this adapter would
      surface as an unhandled producer error rather than a governed refusal, and a
      governed refusal is the only outcome the admission evaluator can classify.
    */
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · THE EXTRACTOR
 * ══════════════════════════════════════════════════════════════════════════ */

export const NISR_CPI_PRODUCTION_EXTRACTOR: NisrCpiTextLayerExtractor = Object.freeze({
  extractorId: NISR_CPI_EXTRACTOR_ID,
  extractorVersion: NISR_CPI_EXTRACTOR_VERSION,
  extract: extractNisrCpiTextLayer,
});

/**
 * A content hash of the extraction the deployment is actually running.
 *
 * Used by `nisr-pdf-extractor.integrity.spec.ts` to pin the extraction against its
 * declared version. It hashes the FUNCTION SOURCES rather than the files, so it is
 * available in a compiled image as well as under ts-jest — and it is asserted in CI
 * rather than at boot, because a hash that differs between a transpiler and a compiler
 * would fail in one environment and pass in the other, which is worse than not checking.
 */
export function nisrCpiExtractionFingerprint(): string {
  return createHash('sha256')
    .update(readPdfTextLayer.toString())
    .update(extractNisrCpiTextLayer.toString())
    .update(toLines.toString())
    .digest('hex');
}
