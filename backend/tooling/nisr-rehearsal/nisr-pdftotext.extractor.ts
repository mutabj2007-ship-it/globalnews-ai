/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE NISR TEXT-LAYER EXTRACTOR — `pdftotext -table`, AND NO OCR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * TOOLING. Not in the production build: `tsconfig.build.json` already excludes
 * `tooling/**`, so this is kept out by an EXISTING rule rather than by an exemption
 * written to accommodate it.
 *
 * ── WHY THE EXTRACTOR IS HERE AND NOT IN `shared/` ────────────────────────
 *
 * The decoder takes its text layer as an INJECTED dependency, which is G's design and
 * the third of its three reasons is the load-bearing one: *"a decoder that silently fell
 * back to OCR would break R-PAR-10 invisibly. An injected extractor that returns null is
 * a refusal a reviewer can see."*
 *
 * `shared/` has no runtime dependencies and must not acquire one. So the library choice
 * is made here, where the runtime is.
 *
 * ── WHAT THIS IS AND IS NOT ───────────────────────────────────────────────
 *
 * IT IS a rehearsal-grade extractor over the `pdftotext` that is on this machine
 * (xpdf 4.06), sufficient to prove the governed pipeline end to end over the real
 * artifact. Its identity travels with every decode it produces, so a figure is
 * attributable to the extraction that produced it.
 *
 * IT IS NOT the production extractor. A production deployment needs a Node-resident PDF
 * library rather than a subprocess, and until one is installed the registry row's
 * extractor is ABSENT — which makes the decoder refuse every artifact with
 * `NISR_PDF_NO_TEXT_LAYER`. That is the safe direction, and it is stated here rather
 * than discovered later.
 *
 * NO OCR, AND NO PATH TO IT. `pdftotext` is invoked without any rasterising option, and a
 * document with no text layer produces no rows, which this returns `null` for.
 *
 * ── THE ASSOCIATION RULE, WHICH IS THE ONLY PART THAT CAN BE WRONG QUIETLY ─
 *
 * `R-PAR-9`: a PDF has glyphs at coordinates, not a governed table. So the columns are
 * not guessed from the header — THEY ARE MEASURED FROM THE DATA ROWS, whose numeric
 * cells are right-aligned and positionally stable, and the header is then fitted to the
 * columns the data already defined. A row that does not fit is COUNTED, never dropped:
 * `unassociatedRowCount` is what the decoder refuses the whole artifact on.
 *
 * `pdftotext -layout` was measured first and rejected: on this artifact it interleaves
 * cells from adjacent rows, producing plausible-looking rows that are wrong. `-table`
 * associates them correctly, and the difference is exactly the failure R-PAR-9 names.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  NisrCpiGeography,
  NisrCpiTextLayer,
  NisrCpiTextLayerAnnex,
  NisrCpiTextLayerExtractor,
} from '@globalnews-ai/shared';

export const NISR_PDFTOTEXT_EXTRACTOR_ID = 'pdftotext.table' as const;
export const NISR_PDFTOTEXT_EXTRACTOR_VERSION = '1.0.0' as const;

/** The three annex titles, in the publisher's own words. An unrecognised one refuses. */
const ANNEX_GEOGRAPHY: Readonly<Record<string, NisrCpiGeography>> = Object.freeze({
  urban: 'URBAN',
  rural: 'RURAL',
  'all rwanda': 'ALL_RWANDA',
});

const ANNEX_HEAD = /^\s*Annex\s+\d+:\s*Consumer Price Index,\s*(.+?)\s*$/;
const HEADER_LINE = /^\s*Code\s{2,}Categories\b/;
/** The publisher's own table terminator. Everything after it is notes, not rows. */
const TABLE_END = /^\s*Source:/;
/** Page furniture: the running footer, matched on the publisher's exact string. */
const RUNNING_FOOTER = /National Institute of Statistics of Rwanda\s*\/CPI/;

const COLUMN_COUNT = 10;
/** A column geometry inferred from fewer rows than this is an inference, not a measurement. */
const MIN_ROWS_TO_DEFINE_COLUMNS = 5;

interface Token {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Tokens separated by TWO OR MORE spaces, with their character offsets. */
function tokenize(line: string): Token[] {
  const out: Token[] = [];
  for (const m of line.matchAll(/(\S(?:.*?\S)?)(?=\s{2,}|$)/g)) {
    const text = m[1] ?? '';
    if (text === '') continue;
    out.push({ start: m.index ?? 0, end: (m.index ?? 0) + text.length, text });
  }
  return out;
}

interface Columns {
  /** Left edge of each column, from the data rows. */
  readonly starts: readonly number[];
  /** The span each column's data actually occupies — used to fit the header. */
  readonly dataSpans: readonly { readonly from: number; readonly to: number }[];
}

/**
 * THE COLUMNS COME FROM THE DATA, NOT FROM THE HEADER.
 *
 * Only rows that tokenize cleanly into ten contribute. A document whose rows disagree
 * about where the columns are has no columns to measure, and this returns `null` rather
 * than averaging the disagreement away.
 */
function measureColumns(candidates: readonly string[]): Columns | null {
  const clean = candidates.map(tokenize).filter((t) => t.length === COLUMN_COUNT);
  if (clean.length < MIN_ROWS_TO_DEFINE_COLUMNS) return null;

  const starts: number[] = [];
  const dataSpans: { from: number; to: number }[] = [];
  for (let c = 0; c < COLUMN_COUNT; c += 1) {
    const cells = clean.map((t) => t[c]!);
    starts.push(Math.min(...cells.map((x) => x.start)));
    dataSpans.push({
      from: Math.min(...cells.map((x) => x.start)),
      to: Math.max(...cells.map((x) => x.end)),
    });
  }
  /* Strictly increasing, or these are not columns. */
  for (let c = 1; c < COLUMN_COUNT; c += 1) {
    if (starts[c]! <= starts[c - 1]!) return null;
  }
  return { starts, dataSpans };
}

/** Which column contains this offset, under the partition [start_c, start_{c+1}). */
function columnOf(offset: number, starts: readonly number[]): number {
  let c = -1;
  for (let i = 0; i < starts.length; i += 1) {
    if (offset >= starts[i]!) c = i;
  }
  return c;
}

/**
 * Fit the header to the columns the data defined.
 *
 * HEADER LABELS ARE LEFT-ALIGNED; NUMERIC DATA IS RIGHT-ALIGNED. A label therefore
 * routinely begins well to the left of its own column’s figures — on the Rural annex
 * `on Jul. 2026` ends at offset 150 and the figures it labels begin at 151, so the label
 * and its data do not overlap by a single character. Assigning by overlap fails there,
 * and assigning by the data partition puts the label in the previous column.
 *
 * What IS reliable is that columns do not interleave horizontally: a label cannot begin
 * before the previous column’s data has ended. So each header token is assigned to the
 * FIRST column whose data ends at or after the token begins, and tokens landing in the
 * same column are joined in order — which is also how `12 months`, split by `pdftotext`
 * across the gap before the last column, is put back together. That is a general rule
 * about column geometry, not a rule about one label.
 *
 * `null` when the ten do not come out cleanly, which refuses rather than approximating.
 */
function fitHeader(headerLine: string, columns: Columns): readonly string[] | null {
  const buckets: string[][] = Array.from({ length: COLUMN_COUNT }, () => []);

  for (const t of tokenize(headerLine)) {
    const c = columns.dataSpans.findIndex((s) => s.to >= t.start);
    if (c === -1) return null;
    buckets[c]!.push(t.text);
  }

  /* Every column must be labelled. An empty one means the header and the data disagree
     about how many columns there are, and that is a refusal rather than a gap to fill. */
  if (buckets.some((b) => b.length === 0)) return null;
  return buckets.map((b) => b.join(' '));
}
interface AssociatedRows {
  readonly rows: { readonly cells: readonly string[] }[];
  readonly unassociatedRowCount: number;
}

/**
 * Associate every candidate row, and COUNT the ones that could not be.
 *
 * The category column may hold several tokens — `Furnishings household equipment and
 * routine  household  maintenance` is one label `pdftotext` split across wide internal
 * gaps — so it joins them. EVERY OTHER COLUMN MUST HOLD EXACTLY ONE. A numeric column
 * holding two tokens, or none, is a row whose cells could not be confidently associated,
 * and `R-PAR-9` says that is not a low-confidence observation, it is not an observation.
 */
function associateRows(candidates: readonly string[], columns: Columns): AssociatedRows {
  const rows: { readonly cells: readonly string[] }[] = [];
  let unassociatedRowCount = 0;

  for (const line of candidates) {
    const buckets: string[][] = Array.from({ length: COLUMN_COUNT }, () => []);
    let placed = true;
    for (const t of tokenize(line)) {
      const c = columnOf(t.start, columns.starts);
      if (c < 0) {
        placed = false;
        break;
      }
      buckets[c]!.push(t.text);
    }
    const CATEGORY_COLUMN = 1;
    const wellFormed =
      placed &&
      buckets.every((b, i) => (i === CATEGORY_COLUMN ? b.length >= 1 : b.length === 1));

    if (!wellFormed) {
      unassociatedRowCount += 1;
      continue;
    }
    rows.push({ cells: buckets.map((b) => b.join(' ')) });
  }
  return { rows, unassociatedRowCount };
}

/** Collapse runs of whitespace — `Index (Feb  2014=100)` prints a double space. */
function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * THE EDITION LANGUAGE, OBSERVED — NEVER A DECLARED TAG.
 *
 * `R-PROV-3` and this lane's rule since R2: a `Content-Language` header, an `hreflang` or
 * a locale in a path are CLAIMS a publisher makes about a file. What is read here is what
 * the bytes were measured to be — the publication's own English structural vocabulary,
 * every member of which must be present.
 *
 * This is corroborated structurally rather than only by this function: the decoder's
 * column binder requires the five FIXED English headers (`Code`, `Categories`, `Weights`,
 * `1 month`, `12 months`) to bind. The French edition prints `Catégories`, so it would
 * fail to bind and be refused — never mislabelled as English.
 */
const ENGLISH_EDITION_MARKERS: readonly string[] = [
  'Consumer Price Index',
  'GENERAL INDEX',
  'Categories',
  'Weights',
];

function observedLanguage(text: string): string {
  return ENGLISH_EDITION_MARKERS.every((m) => text.includes(m)) ? 'en' : '';
}

function runPdfToText(bytes: Uint8Array): string | null {
  const dir = mkdtempSync(join(tmpdir(), 'nisr-extract-'));
  try {
    const pdf = join(dir, 'artifact.pdf');
    const out = join(dir, 'artifact.txt');
    writeFileSync(pdf, bytes);
    /* `-table` for the association, `-enc UTF-8` because the DEFAULT IS LATIN-1 and
       this document is not: the running footer prints `N° 8` and the imprint prints `©`,
       both of which arrive as replacement characters under the default. The issue ordinal
       would then never match and would be recorded as ABSENT — a measurement replaced by
       an encoding artifact, which is the quietest way to lose a fact.

       No rasterising option exists in this invocation, so there is no path from here to
       OCR — R-PAR-10 is structural rather than promised. */
    execFileSync('pdftotext', ['-table', '-enc', 'UTF-8', pdf, out], { stdio: 'pipe' });
    return readFileSync(out, 'utf8');
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The imprint the decoder reads: the licence line, plus a running footer whose issue
 * ordinal is COMPLETE at the end of the line.
 *
 * The footer repeats on every page and some occurrences are followed by a page number,
 * which would sit between the ordinal and the end of the string. So an occurrence that
 * ENDS at the ordinal is selected rather than one being trimmed to look like it does — a
 * selection a reviewer can check, instead of an edit they cannot see. If no occurrence
 * qualifies, the footer is still carried and the decoder records `issueOrdinal: null`,
 * which is the honest outcome and never a guess.
 */
function buildImprint(lines: readonly string[]): string {
  const licence = lines.find((l) => l.includes('Licensed under')) ?? '';
  const footers = lines.filter((l) => RUNNING_FOOTER.test(l)).map((l) => l.trim());
  const complete = footers.find((l) => /N°\s*\d{1,2}$/u.test(l));
  return [licence.trim(), complete ?? footers[0] ?? ''].filter((x) => x !== '').join('\n');
}

export function extractNisrCpiTextLayer(bytes: Uint8Array): NisrCpiTextLayer | null {
  const text = runPdfToText(bytes);
  if (text === null) return null;

  const lines = text.replace(/\r/g, '').split('\n');

  /* ── THE THREE DOCUMENT-LEVEL FACTS, EACH FROM ITS OWN ANCHOR ───────────
     None is read from the filename or the upload folder. The artifact's own filename
     contains "AUGUST 2026" and its folder is `2026-09` — the reference period and a month
     that is not it — and `R-AID-1` forbids parsing either. */

  /* The publication states its own reference period in a sentence. */
  const referenceMatch = lines
    .map((l) => /for the month of\s+([A-Za-z]+\s+\d{4})/.exec(l))
    .find((m): m is RegExpExecArray => m !== null);

  /* The cover carries the publication date on its own line. */
  const publicationLine = lines.find((l) => /^\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*$/.test(l));

  /* The definitions section names the index reference period. */
  const baseMatch = lines
    .map((l) => /Index reference period\s*\(([^)]*)\)/.exec(l))
    .find((m): m is RegExpExecArray => m !== null);

  const annexHeadIndexes = lines
    .map((l, i) => (ANNEX_HEAD.test(l) ? i : -1))
    .filter((i) => i >= 0);

  const annexes: NisrCpiTextLayerAnnex[] = [];
  for (let k = 0; k < annexHeadIndexes.length; k += 1) {
    const from = annexHeadIndexes[k]!;
    const to = k + 1 < annexHeadIndexes.length ? annexHeadIndexes[k + 1]! : lines.length;

    const title = ANNEX_HEAD.exec(lines[from]!)?.[1] ?? '';
    const geography = ANNEX_GEOGRAPHY[title.trim().toLowerCase()];
    if (geography === undefined) continue; // counted by the structural check below

    let headerIdx = -1;
    for (let i = from; i < to; i += 1) {
      if (HEADER_LINE.test(lines[i]!)) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return null;

    const candidates: string[] = [];
    for (let i = headerIdx + 1; i < to; i += 1) {
      const line = lines[i]!;
      if (TABLE_END.test(line)) break; // the publisher's own end of table
      if (line.trim() === '') continue;
      if (RUNNING_FOOTER.test(line)) continue; // page furniture, not a row
      candidates.push(line);
    }

    const columns = measureColumns(candidates);
    if (columns === null) return null;
    const headers = fitHeader(lines[headerIdx]!, columns);
    if (headers === null) return null;

    const { rows, unassociatedRowCount } = associateRows(candidates, columns);
    annexes.push({
      geography,
      headers: headers.map(squash),
      rows,
      unassociatedRowCount,
    });
  }

  /*
    A DOCUMENT WHOSE ANNEX STRUCTURE IS NOT THE ONE THIS EXTRACTOR MEASURED IS REFUSED.

    An annex heading this extractor does not recognise is not skipped quietly: if the
    count of recognised annexes differs from the count of annex headings, the structure
    changed and the honest answer is that there is no text layer this extractor can read.
  */
  if (annexes.length !== annexHeadIndexes.length) return null;
  if (annexes.length === 0) return null;

  if (referenceMatch === undefined || publicationLine === undefined || baseMatch === undefined) {
    return null;
  }

  return {
    imprint: buildImprint(lines),
    publicationDateText: squash(publicationLine),
    referencePeriodText: squash(referenceMatch[1] ?? ''),
    basePeriodText: squash(baseMatch[1] ?? ''),
    sourceLanguage: observedLanguage(text),
    annexes,
  };
}

export const NISR_PDFTOTEXT_EXTRACTOR: NisrCpiTextLayerExtractor = Object.freeze({
  extractorId: NISR_PDFTOTEXT_EXTRACTOR_ID,
  extractorVersion: NISR_PDFTOTEXT_EXTRACTOR_VERSION,
  extract: extractNisrCpiTextLayer,
});
