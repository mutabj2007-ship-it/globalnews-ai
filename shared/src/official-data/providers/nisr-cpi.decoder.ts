/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR CPI PDF DECODER — THE `application/pdf` ROW'S OWN PARSER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DORMANT. `rw-nisr` ships `enabled: false` / `ingestionMethod: 'none'`, no scheduler
 * reaches this file, and landing a parser is not activating a source. Production HOLD.
 *
 * ── WHERE THIS LIVES, AND WHY IT IS NOT IN THE EVALUATOR ──────────────────
 *
 * `R-PD-7` · NO PROVIDER-SPECIFIC PARSING IN THE GENERIC EVALUATOR: *"The evaluator
 * calls `binding.decode` and knows nothing about NISR, CPI, tables or Rwanda … it
 * appears only as a `providerId` in a registry ROW, exactly as `EUROSTAT` and `TED` do
 * today."* `assertEurostatJsonStatEnvelope` sits in `parser-registry.ts` beside its row;
 * this is larger than an envelope assertion, so it is its own module under
 * `providers/`, imported by exactly one registry row and by nothing else.
 *
 * `admission-evaluator.ts` gained no NISR branch, no PDF branch and no line at all.
 *
 * ── PROVENANCE OF THIS FILE ───────────────────────────────────────────────
 *
 * The parsing rules, the refusal set, the negative controls and the two findings are
 * G's, from `G-NISR-CPI-PDF-PARSER-R5`. What changed on landing:
 *
 *   1. THE CANDIDATE-LOCAL CONTRACT SHAPES ARE GONE. R5 declared `ArtifactDecoder<T>`
 *      and `ParserBindingWithDecode<T>` locally because neither had landed; both now
 *      exist in `parser-registry.ts` and are imported. R5's two inverting pins — which
 *      asserted the landed tree declared neither — are deleted WITH the blocker they
 *      guarded, which is what R5 said to do with them.
 *
 *   2. THE REFUSAL VOCABULARY IS THE PLATFORM'S AT THE SEAM. R5's result type carried
 *      `refusalKey: string` and an `offset`. The canonical `ArtifactDecodeResult<T>`
 *      carries a `SnapshotRefusalKey` and no offset, "so a decoder refuses in the SAME
 *      vocabulary every other step refuses in — a new media type cannot invent its own
 *      failure language". The ten NISR keys are not lost: each is carried VERBATIM in
 *      `detail`, which is E1 · C-4's classified, non-interpolated reason field, and
 *      each is still the thing the tests assert on. See §2.
 *
 *   3. THE PRINTED PERCENT MARKER IS NOW A CROSS-CHECK. Measured on the real August
 *      2026 artifact: NISR prints `%` in its percentage cells and not in its index
 *      cells. R5 was written against a measurement that had it stripped. See §4.
 *
 *   4. THE EXTRACTOR CARRIES AN IDENTITY. See §7.
 *
 * ── WHAT THIS FILE REFUSES TO DO, AND WHY EACH REFUSAL IS A RULING ────────
 *
 * R-PAR-9   a PDF has glyphs at coordinates, not a governed table. A row whose cells
 *           cannot be confidently associated is NOT a low-confidence observation — IT
 *           IS NOT AN OBSERVATION. There is no confidence score in this file and no
 *           threshold for one to become.
 * R-PAR-10  no OCR. A PDF with no text layer is refused, not guessed at.
 * R-PAR-12  a parser sees ONE artifact. Nothing here compares editions, reads a
 *           previous release, or knows that one exists.
 * THE SHARPEST · a real CPI is a weighted aggregate whose weights are a methodology,
 *           not a table. A PARSER AVERAGING COMPONENTS PRODUCES A NUMBER THAT LOOKS
 *           OFFICIAL, IS NOT, AND IS ATTRIBUTED TO NISR. So All Rwanda is read from the
 *           publisher's own annex or the artifact is refused; there is no arithmetic
 *           path to a national figure in this file.
 * R-ART-6   the content address is the hinge and it is one-way. This decoder RECEIVES
 *           an address and never mints, alters or recomputes one.
 */

import type { SnapshotRefusalKey } from '../snapshot-admission';
import type { ArtifactDecodeResult, ArtifactDecoder, ParserBinding } from '../parser-registry';

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · IDENTITY — SERVER-OWNED, NEVER SELF-ASSERTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The parser identity is the REGISTRY's and the decoder does not assert it about
 * itself — that circularity is what the registry exists to break. `parserVersion` is
 * what makes a parser upgrade detectable after the fact, which it can only be if
 * something other than the parser records it.
 */
export const NISR_CPI_PARSER_ID = 'nisr.cpi.pdf' as const;
export const NISR_CPI_PARSER_VERSION = '1.0.0' as const;
export const NISR_CPI_MEDIA_TYPE = 'application/pdf' as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · REFUSAL KEYS — OURS, CLASSIFIED, NEVER PUBLISHER TEXT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ELEVEN KEYS, AND THEY ARE THIS PARSER'S DIAGNOSIS, NOT THE PLATFORM'S VERDICT.
 *
 * The platform's verdict is `PARSE_FAILED`: PERMANENT, because a body that this parser
 * could not read will not read differently on a retry of the same request. That is the
 * right class for all eleven, and it is why they collapse onto one platform key without
 * losing anything that governs behaviour.
 *
 * What WOULD be lost is the diagnosis, so it is carried in `detail` verbatim. A reader
 * of an audit row sees `PARSE_FAILED` and `NISR_PDF_NATIONAL_ROW_MISSING` together, and
 * the second is a classified constant from this list rather than a message built from
 * publisher text — E1 · C-4.
 *
 * NOT `BODY_NOT_PDF_SHAPED`. That key belongs to the SHAPE arm — the bytes did not begin
 * with `%PDF-` — and it is TRANSIENT, because an HTML interstitial clears. An artifact
 * that IS a PDF and cannot be read is a different fact with a different retry semantic,
 * and conflating them would put a permanently unreadable document on a retry schedule.
 */
export const NISR_CPI_REFUSAL_KEYS = [
  /** No text layer. R-PAR-10 forbids OCR, so this is terminal for the artifact. */
  'NISR_PDF_NO_TEXT_LAYER',
  /** The annex header did not yield all ten column roles. */
  'NISR_PDF_HEADER_ROLES_UNRESOLVED',
  /** Three period columns did not resolve to three distinct, orderable months. */
  'NISR_PDF_PERIOD_COLUMNS_UNORDERABLE',
  /** The document's stated reference period disagrees with its current-period column. */
  'NISR_PDF_PERIOD_DISAGREES_WITH_CONTENT',
  /** The All Rwanda annex is absent. There is no arithmetic fallback. */
  'NISR_PDF_NATIONAL_ROW_MISSING',
  /** A row's cells could not be confidently associated. R-PAR-9: not an observation. */
  'NISR_PDF_ROW_CELLS_UNASSOCIATED',
  /** A numeric cell could not be given exactly one unit. */
  'NISR_PDF_UNIT_AMBIGUOUS',
  /** The CC BY 4.0 token is not present in the artifact's own imprint. */
  'NISR_PDF_LICENCE_TOKEN_ABSENT',
  /** No publication date, or it is not distinguishable from the reference period. */
  'NISR_PDF_PUBLICATION_DATE_UNRESOLVED',
  /** The base period is absent; an index without its base is not a figure. */
  'NISR_PDF_BASE_PERIOD_ABSENT',
  /*
    ADDED ON LANDING, AND THE REASON IS THIS ROUND'S OTHER HALF.

    In R5 the observed edition language travelled only inside the decoder's own result
    and had nowhere canonical to be written — R5's blocker §1.4 — so an unobserved
    language had no consequence and needed no refusal. `OfficialDataRetrieval.
    sourceLanguage` now exists, which means an unobserved language would become an
    ABSENT lineage field on a figure that does have an edition. Absent must mean "the
    publisher states none", never "we did not look", so not observing it is a refusal.
  */
  'NISR_PDF_SOURCE_LANGUAGE_UNOBSERVED',
] as const;
export type NisrCpiRefusalKey = (typeof NISR_CPI_REFUSAL_KEYS)[number];

/** The platform key every one of the eleven is reported under. See §2's header. */
export const NISR_CPI_PLATFORM_REFUSAL_KEY: SnapshotRefusalKey = 'PARSE_FAILED';

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · SEMANTIC COLUMN BINDING — BY ROLE, NEVER BY MONTH STRING
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The annex header is:
 *
 *     Code · Categories · Weights · Aug-25 · Jul-26 · Aug-26 ·
 *     on Jul. 2026 · on Aug. 2025 · 1 month · 12 months
 *
 * Three of those ten CHANGE EVERY MONTH. In the July edition the same three read
 * `Jul-25 · Jun-26 · Jul-26`. A parser matching header text is a parser that works once.
 *
 * So the three period columns are found by SHAPE, parsed to months, and assigned roles
 * BY CHRONOLOGICAL ORDER — the earliest is the year-ago column, the latest is the
 * current one. Nothing anywhere compares a header to a literal month.
 */

export const NISR_CPI_COLUMN_ROLES = [
  'COICOP_CODE',
  'CATEGORY_LABEL',
  'WEIGHT',
  'INDEX_YEAR_AGO',
  'INDEX_PREVIOUS_PERIOD',
  'INDEX_CURRENT_PERIOD',
  'PCT_CHANGE_ON_PREVIOUS',
  'PCT_CHANGE_ON_YEAR_AGO',
  'CONTRIBUTION_1_MONTH',
  'CONTRIBUTION_12_MONTHS',
] as const;
export type NisrCpiColumnRole = (typeof NISR_CPI_COLUMN_ROLES)[number];

/** `Aug-25`, `Jul-26`. Two-digit year, three-letter English month. */
const PERIOD_COLUMN = /^([A-Za-z]{3})-(\d{2})$/;
/** `on Jul. 2026`, `on Aug. 2025`. The optional stop is the publisher's, not ours. */
const CHANGE_COLUMN = /^on\s+([A-Za-z]{3})\.?\s+(\d{4})$/i;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** `2026-08`, or null. Never throws, never guesses a century beyond 2000+YY. */
export function parsePeriodColumn(header: string): string | null {
  const m = PERIOD_COLUMN.exec(header.trim());
  if (m === null) return null;
  const month = MONTHS[(m[1] ?? '').toLowerCase()];
  const yy = Number(m[2]);
  if (month === undefined || !Number.isInteger(yy)) return null;
  return `${2000 + yy}-${String(month).padStart(2, '0')}`;
}

export function parseChangeColumn(header: string): string | null {
  const m = CHANGE_COLUMN.exec(header.trim());
  if (m === null) return null;
  const month = MONTHS[(m[1] ?? '').toLowerCase()];
  const year = Number(m[2]);
  if (month === undefined || !Number.isInteger(year)) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export interface ColumnBinding {
  readonly role: NisrCpiColumnRole;
  readonly index: number;
  /** For the three period columns and the two change columns: the month they name. */
  readonly period: string | null;
}

/**
 * Bind ten headers to ten roles, or refuse.
 *
 * THE ORDERING IS THE WHOLE POINT. The three period columns are sorted and assigned
 * earliest → `INDEX_YEAR_AGO`, middle → `INDEX_PREVIOUS_PERIOD`, latest →
 * `INDEX_CURRENT_PERIOD`. If the publisher reorders its columns — which a
 * header-position parser would silently misread — this still binds correctly. If two of
 * them name the same month they cannot be ordered, and it refuses.
 */
export function bindColumns(
  headers: readonly string[],
): { ok: true; bindings: readonly ColumnBinding[] } | { ok: false; refusalKey: NisrCpiRefusalKey } {
  if (headers.length !== NISR_CPI_COLUMN_ROLES.length) {
    return { ok: false, refusalKey: 'NISR_PDF_HEADER_ROLES_UNRESOLVED' };
  }

  const periodCols: { index: number; period: string }[] = [];
  const changeCols: { index: number; period: string }[] = [];
  const fixed = new Map<NisrCpiColumnRole, number>();

  headers.forEach((raw, index) => {
    const h = raw.trim();
    const period = parsePeriodColumn(h);
    if (period !== null) {
      periodCols.push({ index, period });
      return;
    }
    const change = parseChangeColumn(h);
    if (change !== null) {
      changeCols.push({ index, period: change });
      return;
    }
    const lower = h.toLowerCase();
    if (lower === 'code') fixed.set('COICOP_CODE', index);
    else if (lower === 'categories') fixed.set('CATEGORY_LABEL', index);
    else if (lower === 'weights') fixed.set('WEIGHT', index);
    else if (lower === '1 month') fixed.set('CONTRIBUTION_1_MONTH', index);
    else if (lower === '12 months') fixed.set('CONTRIBUTION_12_MONTHS', index);
  });

  if (periodCols.length !== 3 || changeCols.length !== 2 || fixed.size !== 5) {
    return { ok: false, refusalKey: 'NISR_PDF_HEADER_ROLES_UNRESOLVED' };
  }

  const sorted = [...periodCols].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  const months = new Set(sorted.map((c) => c.period));
  if (months.size !== 3) return { ok: false, refusalKey: 'NISR_PDF_PERIOD_COLUMNS_UNORDERABLE' };

  /* The two change columns name the periods compared AGAINST, so the later of them is
     the previous period and the earlier is the year-ago period. They are a cross-check
     on the ordering above, not a second source of truth. */
  const changeSorted = [...changeCols].sort((a, b) => (a.period < b.period ? -1 : 1));
  const yearAgo = sorted[0];
  const previous = sorted[1];
  const current = sorted[2];
  if (yearAgo === undefined || previous === undefined || current === undefined) {
    return { ok: false, refusalKey: 'NISR_PDF_HEADER_ROLES_UNRESOLVED' };
  }
  const changeEarly = changeSorted[0];
  const changeLate = changeSorted[1];
  if (changeEarly === undefined || changeLate === undefined) {
    return { ok: false, refusalKey: 'NISR_PDF_HEADER_ROLES_UNRESOLVED' };
  }
  if (changeEarly.period !== yearAgo.period || changeLate.period !== previous.period) {
    return { ok: false, refusalKey: 'NISR_PDF_HEADER_ROLES_UNRESOLVED' };
  }

  const bindings: ColumnBinding[] = [
    { role: 'COICOP_CODE', index: fixed.get('COICOP_CODE') ?? -1, period: null },
    { role: 'CATEGORY_LABEL', index: fixed.get('CATEGORY_LABEL') ?? -1, period: null },
    { role: 'WEIGHT', index: fixed.get('WEIGHT') ?? -1, period: null },
    { role: 'INDEX_YEAR_AGO', index: yearAgo.index, period: yearAgo.period },
    { role: 'INDEX_PREVIOUS_PERIOD', index: previous.index, period: previous.period },
    { role: 'INDEX_CURRENT_PERIOD', index: current.index, period: current.period },
    { role: 'PCT_CHANGE_ON_PREVIOUS', index: changeLate.index, period: changeLate.period },
    { role: 'PCT_CHANGE_ON_YEAR_AGO', index: changeEarly.index, period: changeEarly.period },
    { role: 'CONTRIBUTION_1_MONTH', index: fixed.get('CONTRIBUTION_1_MONTH') ?? -1, period: null },
    { role: 'CONTRIBUTION_12_MONTHS', index: fixed.get('CONTRIBUTION_12_MONTHS') ?? -1, period: null },
  ];
  if (bindings.some((b) => b.index < 0)) {
    return { ok: false, refusalKey: 'NISR_PDF_HEADER_ROLES_UNRESOLVED' };
  }
  return { ok: true, bindings };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · UNITS — FOUR IN ONE TABLE, AND NONE NAMED IN THE CELL
 * ══════════════════════════════════════════════════════════════════════════ */

export const NISR_CPI_UNIT_BY_ROLE: Readonly<Record<NisrCpiColumnRole, string | null>> = {
  COICOP_CODE: null,
  CATEGORY_LABEL: null,
  WEIGHT: 'PERCENT_OF_BASKET',
  INDEX_YEAR_AGO: 'INDEX_POINTS',
  INDEX_PREVIOUS_PERIOD: 'INDEX_POINTS',
  INDEX_CURRENT_PERIOD: 'INDEX_POINTS',
  PCT_CHANGE_ON_PREVIOUS: 'PERCENT',
  PCT_CHANGE_ON_YEAR_AGO: 'PERCENT',
  CONTRIBUTION_1_MONTH: 'INDEX_POINTS_CONTRIBUTED',
  CONTRIBUTION_12_MONTHS: 'INDEX_POINTS_CONTRIBUTED',
};

/**
 * A number without its role has no unit, and this function will not invent one.
 *
 * `INDEX_POINTS` and `PERCENT` are the two that would be silently interchangeable to a
 * parser reading cells left to right — 15.7 is a plausible index value and a real
 * percentage, and nothing about the number distinguishes them.
 */
export function unitForRole(role: NisrCpiColumnRole): string | null {
  return NISR_CPI_UNIT_BY_ROLE[role];
}

/**
 * WHETHER THE PUBLISHER PRINTS A `%` IN THIS ROLE'S CELLS — MEASURED, NOT ASSUMED.
 *
 * R5 was written against a measurement in which the marker had already been stripped,
 * so the role was the ONLY thing distinguishing an index level from a percentage. The
 * real August 2026 artifact prints the marker, and printing it makes it evidence:
 *
 *     WEIGHT                  `100%`  `39%`  `7%`            ALWAYS
 *     INDEX_*                 `208.3` `235.3` `241.4`        NEVER
 *     PCT_CHANGE_*            `2.6%`  `15.9%` `-1.4%`        ALWAYS
 *     CONTRIBUTION_*          `2.6%` on the GENERAL INDEX row,
 *                             `2.2` / `7.9` on component rows  EITHER
 *
 * The fourth row is why this is a three-valued table rather than a boolean: the general
 * index contributes the whole of its own change, and NISR prints that cell as the
 * percentage it is. An OPTIONAL that was measured is not a loophole — it is the one
 * place the publisher is genuinely inconsistent, recorded as such.
 *
 * WHAT THIS BUYS. `R-PAR-5` forbids inferring a unit from a column name; this infers
 * nothing. It CROSS-CHECKS the unit the role already determined against the marker the
 * publisher actually printed, and refuses when they contradict. A reordering that put
 * percentages under an index header would pass the change-column cross-check only if the
 * headers moved with them — and would fail here, because the cells would carry `%` under
 * a role whose unit is `INDEX_POINTS`.
 */
export const NISR_CPI_PERCENT_MARKER_BY_ROLE: Readonly<
  Record<NisrCpiColumnRole, 'REQUIRED' | 'FORBIDDEN' | 'EITHER' | 'NOT_NUMERIC'>
> = {
  COICOP_CODE: 'NOT_NUMERIC',
  CATEGORY_LABEL: 'NOT_NUMERIC',
  WEIGHT: 'REQUIRED',
  INDEX_YEAR_AGO: 'FORBIDDEN',
  INDEX_PREVIOUS_PERIOD: 'FORBIDDEN',
  INDEX_CURRENT_PERIOD: 'FORBIDDEN',
  PCT_CHANGE_ON_PREVIOUS: 'REQUIRED',
  PCT_CHANGE_ON_YEAR_AGO: 'REQUIRED',
  CONTRIBUTION_1_MONTH: 'EITHER',
  CONTRIBUTION_12_MONTHS: 'EITHER',
};

/**
 * THE SHAPE REGEX, AND WHAT IT ACTUALLY GUARDS.
 *
 * R5's M-8a found that the decoder's stated rationale and the clause carrying it had
 * come apart: the thousands-separator refusal it attributed to this regex is in fact
 * produced downstream, because `Number('1,234.5')` is already `NaN`. Recorded there,
 * and recorded here, because the regex is NOT redundant — it is the only thing
 * rejecting four other forms and the first is the dangerous one:
 *
 *     ''       Number('')     === 0     A MISSING CELL BECOMES A PUBLISHED ZERO
 *     '   '    Number('   ')  === 0     the same
 *     '0x1F'   Number('0x1F') === 31    a hex string becomes an index level
 *     '1e3'    Number('1e3')  === 1000  exponent notation NISR does not print
 *
 * Do not relax it, and do not replace `Number` with `parseFloat` — `parseFloat('1,234.5')`
 * is `1` and `parseFloat('15.7%')` is `15.7`, which is the salvaging parser R5's M-8d
 * demonstrated.
 */
const NUMERIC_CELL = /^-?\d+(\.\d+)?$/;

/**
 * Parse a numeric cell for a role, refusing rather than coercing.
 *
 * NEGATIVES ARE REAL: rural monthly change was -0.2 percent in the July 2026 edition and
 * -1.4 percent for alcoholic beverages in August, so a parser stripping a sign or typing
 * the field non-negative inverts a month of deflation. Thousands separators are NOT
 * accepted in this series because NISR's CPI prints none — the GDP release prints commas,
 * and accepting both here would make one parser silently correct for two conventions it
 * cannot tell apart.
 */
export function parseNumericCell(
  raw: string,
  role: NisrCpiColumnRole,
): { ok: true; value: number; unit: string; printedPercentMarker: boolean } | { ok: false; refusalKey: NisrCpiRefusalKey } {
  const unit = unitForRole(role);
  if (unit === null) return { ok: false, refusalKey: 'NISR_PDF_UNIT_AMBIGUOUS' };

  const s = raw.trim();
  /* AT MOST ONE trailing marker, removed and REMEMBERED rather than discarded. A cell
     ending in `%%` is not a percentage twice; it is a cell this parser does not
     understand, and the regex below refuses it. */
  const printedPercentMarker = s.endsWith('%');
  const body = printedPercentMarker ? s.slice(0, -1) : s;

  if (!NUMERIC_CELL.test(body)) return { ok: false, refusalKey: 'NISR_PDF_UNIT_AMBIGUOUS' };
  const value = Number(body);
  if (!Number.isFinite(value)) return { ok: false, refusalKey: 'NISR_PDF_UNIT_AMBIGUOUS' };

  const policy = NISR_CPI_PERCENT_MARKER_BY_ROLE[role];
  if (policy === 'NOT_NUMERIC') return { ok: false, refusalKey: 'NISR_PDF_UNIT_AMBIGUOUS' };
  if (policy === 'REQUIRED' && !printedPercentMarker) {
    return { ok: false, refusalKey: 'NISR_PDF_UNIT_AMBIGUOUS' };
  }
  if (policy === 'FORBIDDEN' && printedPercentMarker) {
    return { ok: false, refusalKey: 'NISR_PDF_UNIT_AMBIGUOUS' };
  }

  return { ok: true, value, unit, printedPercentMarker };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · GEOGRAPHY — THREE PUBLISHED SERIES, AND THE THIRD IS NEVER COMPUTED
 * ══════════════════════════════════════════════════════════════════════════ */

export const NISR_CPI_GEOGRAPHIES = ['URBAN', 'RURAL', 'ALL_RWANDA'] as const;
export type NisrCpiGeography = (typeof NISR_CPI_GEOGRAPHIES)[number];

/**
 * ALL RWANDA IS A PUBLISHED SERIES, NOT A DERIVATION, AND THIS CONSTANT EXISTS SO A
 * GUARD CAN ASSERT IT BY NAME.
 *
 * The measured August 2026 figures are urban 15.7, rural 16.0, All Rwanda 15.9 — the
 * national figure lies BETWEEN the other two, which is exactly why a mean looks
 * plausible, and `(15.7 + 16.0) / 2 = 15.85` rounds to `15.9` EXACTLY. R5's M-18 injected
 * that parser and every equality assertion against the August edition still passed. It
 * was caught by the July edition, where `(14.5 + 13.3) / 2 = 13.9` and the publisher says
 * `13.8`, and by a positive control that replaces the national value with one no
 * arithmetic over urban and rural can produce.
 *
 * There is no arithmetic anywhere in this file that combines urban and rural.
 */
export const ALL_RWANDA_IS_NEVER_COMPUTED = true as const;

/** Urban is a stratum over twelve unnamed centres — not a place. Precision is COUNTRY. */
export const NISR_CPI_SPATIAL_PRECISION = 'COUNTRY' as const;

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · THE DECODED ARTIFACT
 * ══════════════════════════════════════════════════════════════════════════ */

export interface NisrCpiCell {
  readonly role: NisrCpiColumnRole;
  readonly value: number;
  readonly unit: string;
  /** Evidence, retained: whether the publisher printed a `%` in this cell. */
  readonly printedPercentMarker: boolean;
}

export interface NisrCpiRow {
  readonly coicopCode: string;
  readonly categoryLabel: string;
  readonly geography: NisrCpiGeography;
  readonly cells: readonly NisrCpiCell[];
}

export interface NisrCpiDecoded {
  /** From the document body, never from the filename or the upload folder. */
  readonly referencePeriod: string;
  /** Distinct from the reference period, and asserted to be so. */
  readonly publicationDate: string;
  /** OBSERVED from the artifact edition. Never a declared locale tag. */
  readonly sourceLanguage: string;
  readonly basePeriod: string;
  /** The issue ordinal from the running footer. Detects a MISSED RELEASE, never a revision. */
  readonly issueOrdinal: number | null;
  readonly columns: readonly ColumnBinding[];
  readonly rows: readonly NisrCpiRow[];
  /** Verbatim licence token found in the imprint. */
  readonly licenceToken: string;
  /** Which of the three published geographies were present. */
  readonly geographiesPresent: readonly NisrCpiGeography[];
  /** §7 — which extraction produced this, so a decode is attributable to one. */
  readonly extractorId: string;
  readonly extractorVersion: string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 7 · THE TEXT LAYER — INJECTED, SO THE REFUSAL IS EXPLICIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `ArtifactDecoder<T>` takes bytes. Extracting a text layer from PDF bytes needs a
 * library, `shared/` has no runtime dependencies, and `R-PAR-10` forbids OCR — so the
 * extraction step is INJECTED rather than chosen here. Three reasons, and the third is
 * the important one:
 *
 *   1  the library choice belongs where the runtime is, not in a contract package
 *   2  every rule in this file is testable against the real measured text of the August
 *      2026 artifact with no PDF dependency in the test path
 *   3  A DECODER THAT SILENTLY FELL BACK TO OCR WOULD BREAK R-PAR-10 INVISIBLY. An
 *      injected extractor that returns null is a refusal a reviewer can see.
 *
 * ── AND IT CARRIES AN IDENTITY, WHICH R5's DID NOT ────────────────────────
 *
 * R5's extractor was a bare function. An injected bare function is a way to change what
 * a parser MEANS without changing the `parserVersion` that is supposed to make such a
 * change detectable — E1 · P-4's hazard, arriving through the one seam the registry does
 * not own. So an extractor states who it is, and `NisrCpiDecoded` records it: two
 * extractions of one artifact that disagree are then attributable to the extraction
 * rather than to the publisher.
 *
 * The parser identity stays the registry's. The extractor identity is additional
 * evidence and is never a substitute for it.
 */
export interface NisrCpiTextLayerExtractor {
  /** Names the library and the strategy, e.g. `pdftotext.table`. Server-owned. */
  readonly extractorId: string;
  readonly extractorVersion: string;
  readonly extract: (bytes: Uint8Array) => NisrCpiTextLayer | null;
}

export interface NisrCpiTextLayerAnnex {
  readonly geography: NisrCpiGeography;
  /** Exactly ten, or `bindColumns` refuses. */
  readonly headers: readonly string[];
  /** Cells already associated to columns. An unassociable row is omitted and COUNTED. */
  readonly rows: readonly { readonly cells: readonly string[] }[];
  /**
   * The extractor's HONEST count of rows whose cells it could not confidently associate.
   * R-PAR-9. Do not silently drop such rows and report zero: a non-zero count refuses the
   * artifact, and a false zero admits a wrong number.
   */
  readonly unassociatedRowCount: number;
}

export interface NisrCpiTextLayer {
  /** The imprint block — licence line and running footer, issue ordinal at the END. */
  readonly imprint: string;
  /** Publisher-stated, verbatim, e.g. "10 September 2026". */
  readonly publicationDateText: string;
  /** Publisher-stated reference period, verbatim, e.g. "August 2026". */
  readonly referencePeriodText: string;
  /** Verbatim, e.g. "Feb 2014=100". */
  readonly basePeriodText: string;
  /** OBSERVED from the edition. Empty means "not observed", which is a refusal. */
  readonly sourceLanguage: string;
  /** One entry per annex actually present in the document. */
  readonly annexes: readonly NisrCpiTextLayerAnnex[];
}

export const NISR_CPI_LICENCE_TOKEN = 'Licensed under CC BY 4.0' as const;
const ISSUE_ORDINAL = /N°\s*(\d{1,2})\s*$/u;

/** English month names, for the document body. Separate from the column parser. */
const BODY_PERIOD = /^([A-Za-z]+)\s+(\d{4})$/;

function bodyPeriodToIso(text: string): string | null {
  const m = BODY_PERIOD.exec(text.trim());
  if (m === null) return null;
  const month = MONTHS[(m[1] ?? '').slice(0, 3).toLowerCase()];
  const year = Number(m[2]);
  if (month === undefined || !Number.isInteger(year)) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function publicationDateToIso(text: string): string | null {
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text.trim());
  if (m === null) return null;
  const day = Number(m[1]);
  const month = MONTHS[(m[2] ?? '').slice(0, 3).toLowerCase()];
  const year = Number(m[3]);
  if (month === undefined || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  if (day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 8 · THE DECODER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * REFUSAL PRECEDENCE IS NOT A DIAGNOSIS. The key names the FIRST defect reached, not the
 * only defect present. An artifact with both a date collision and a column disagreement
 * reports the date. A test pins this so a reviewer does not read
 * `NISR_PDF_PUBLICATION_DATE_UNRESOLVED` as "the columns agree".
 */
export function makeNisrCpiDecoder(
  extractor: NisrCpiTextLayerExtractor,
): ArtifactDecoder<NisrCpiDecoded> {
  return (bytes: Uint8Array): ArtifactDecodeResult<NisrCpiDecoded> => {
    const refuse = (
      key: NisrCpiRefusalKey,
      detail: string,
    ): ArtifactDecodeResult<NisrCpiDecoded> => ({
      ok: false,
      refusalKey: NISR_CPI_PLATFORM_REFUSAL_KEY,
      /* The parser's own diagnosis, verbatim, beside the platform's verdict. Both are
         classified constants; neither is built from publisher text. */
      detail: `${key}:${detail}`,
    });

    /*
      NISR PRODUCTIONIZATION R1 · B-2.3 — A THROWING EXTRACTOR IS A REFUSAL, NOT A CRASH.

      The adapter is required to catch everything and return `null`, and the production
      one does. This is the second half of that rule, held where it cannot be forgotten
      by whoever writes the NEXT adapter: an exception escaping here would surface as an
      unhandled producer error rather than a governed refusal, and a governed refusal is
      the only outcome the admission evaluator can classify.

      It does not relax the refusing default — `NISR_CPI_NO_EXTRACTOR_INSTALLED` still
      returns `null` by returning `null`. It closes the case where an installed extractor
      breaks its own contract.
    */
    let layer: NisrCpiTextLayer | null;
    try {
      layer = extractor.extract(bytes);
    } catch {
      return refuse('NISR_PDF_NO_TEXT_LAYER', 'EXTRACTOR_THREW');
    }
    if (layer === null) return refuse('NISR_PDF_NO_TEXT_LAYER', 'NO_TEXT_LAYER');

    /* THE LICENCE TRAVELS WITH THE BYTES, AND THE STRING AROUND IT VARIES. August reads
       "NISR © 2026 National Institute of Statistics of Rwanda. Licensed under CC BY 4.0";
       July's imprint differs around the same token. Matching the whole line fails on the
       next release; the stable token is the licence phrase. ABSENCE OF A LICENCE IS
       NEVER READ AS PERMISSION. */
    if (!layer.imprint.includes(NISR_CPI_LICENCE_TOKEN)) {
      return refuse('NISR_PDF_LICENCE_TOKEN_ABSENT', 'LICENCE_TOKEN_NOT_IN_IMPRINT');
    }

    if (layer.sourceLanguage.trim() === '') {
      return refuse('NISR_PDF_SOURCE_LANGUAGE_UNOBSERVED', 'EDITION_LANGUAGE_NOT_OBSERVED');
    }

    const referencePeriod = bodyPeriodToIso(layer.referencePeriodText);
    if (referencePeriod === null) {
      return refuse('NISR_PDF_PERIOD_DISAGREES_WITH_CONTENT', 'REFERENCE_PERIOD_UNPARSEABLE');
    }

    const publicationDate = publicationDateToIso(layer.publicationDateText);
    if (publicationDate === null) {
      return refuse('NISR_PDF_PUBLICATION_DATE_UNRESOLVED', 'PUBLICATION_DATE_UNPARSEABLE');
    }
    /* Three dates, three homes. A release whose publication month equals its reference
       month is not impossible in principle, but for this monthly series it means one of
       the two was read from the wrong place. */
    if (publicationDate.slice(0, 7) === referencePeriod) {
      return refuse('NISR_PDF_PUBLICATION_DATE_UNRESOLVED', 'PUBLICATION_MONTH_EQUALS_REFERENCE_MONTH');
    }

    if (layer.basePeriodText.trim() === '') {
      return refuse('NISR_PDF_BASE_PERIOD_ABSENT', 'BASE_PERIOD_EMPTY');
    }

    const present = layer.annexes.map((a) => a.geography);
    if (!present.includes('ALL_RWANDA')) {
      /* NO ARITHMETIC PATH. The national figure is published or it is absent, and the
         refusal fires even when urban and rural are both present and complete — that is,
         even when everything a computing parser would need is available. */
      return refuse('NISR_PDF_NATIONAL_ROW_MISSING', 'ALL_RWANDA_ANNEX_ABSENT');
    }

    const rows: NisrCpiRow[] = [];
    for (const annex of layer.annexes) {
      if (annex.unassociatedRowCount > 0) {
        /* R-PAR-9. Not a low-confidence observation — not an observation, and the whole
           artifact is refused rather than partially admitted. */
        return refuse('NISR_PDF_ROW_CELLS_UNASSOCIATED', 'UNASSOCIATED_ROWS_PRESENT');
      }

      const bound = bindColumns(annex.headers);
      if (!bound.ok) return refuse(bound.refusalKey, 'COLUMN_BINDING_FAILED');

      const currentCol = bound.bindings.find((b) => b.role === 'INDEX_CURRENT_PERIOD');
      if (currentCol?.period !== referencePeriod) {
        /* The document says one month and its own current column says another. Neither
           side is privileged: the refusal fires in both directions. */
        return refuse('NISR_PDF_PERIOD_DISAGREES_WITH_CONTENT', 'CURRENT_COLUMN_NOT_REFERENCE_PERIOD');
      }

      for (const raw of annex.rows) {
        if (raw.cells.length !== bound.bindings.length) {
          return refuse('NISR_PDF_ROW_CELLS_UNASSOCIATED', 'CELL_COUNT_MISMATCH');
        }
        const codeIdx = bound.bindings.find((b) => b.role === 'COICOP_CODE')?.index ?? -1;
        const labelIdx = bound.bindings.find((b) => b.role === 'CATEGORY_LABEL')?.index ?? -1;
        const cells: NisrCpiCell[] = [];
        for (const b of bound.bindings) {
          if (b.role === 'COICOP_CODE' || b.role === 'CATEGORY_LABEL') continue;
          const cell = parseNumericCell(raw.cells[b.index] ?? '', b.role);
          if (!cell.ok) return refuse(cell.refusalKey, `CELL_${b.role}`);
          cells.push({
            role: b.role,
            value: cell.value,
            unit: cell.unit,
            printedPercentMarker: cell.printedPercentMarker,
          });
        }
        rows.push({
          coicopCode: (raw.cells[codeIdx] ?? '').trim(),
          categoryLabel: (raw.cells[labelIdx] ?? '').trim(),
          geography: annex.geography,
          cells,
        });
      }
    }

    const issueMatch = ISSUE_ORDINAL.exec(layer.imprint.trim());
    const issueRaw = issueMatch === null ? null : Number(issueMatch[1]);
    const issueOrdinal =
      issueRaw !== null && Number.isInteger(issueRaw) && issueRaw >= 1 && issueRaw <= 12 ? issueRaw : null;

    const firstAnnex = layer.annexes[0];
    if (firstAnnex === undefined) return refuse('NISR_PDF_HEADER_ROLES_UNRESOLVED', 'NO_ANNEXES');
    const columnsBound = bindColumns(firstAnnex.headers);
    if (!columnsBound.ok) return refuse(columnsBound.refusalKey, 'COLUMN_BINDING_FAILED');

    return {
      ok: true,
      value: {
        referencePeriod,
        publicationDate,
        sourceLanguage: layer.sourceLanguage.trim(),
        basePeriod: layer.basePeriodText.trim(),
        issueOrdinal,
        columns: columnsBound.bindings,
        rows,
        licenceToken: NISR_CPI_LICENCE_TOKEN,
        geographiesPresent: present,
        extractorId: extractor.extractorId,
        extractorVersion: extractor.extractorVersion,
      },
    };
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 9 · THE BINDING, AND THE ONE SEAM THE REGISTRY DOES NOT OWN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The registry table is a frozen, server-owned constant evaluated at module load, and it
 * must stay one: `resolveParserBinding` is the component allowed to decide what may read
 * a body, and a table assembled at request time is not that. But a PDF text layer needs a
 * library, and `shared/` has none.
 *
 * So the ROW is static and the EXTRACTOR is installed by the composition root. The
 * default is the one that cannot be wrong: with nothing installed the decoder REFUSES
 * every artifact with `NISR_PDF_NO_TEXT_LAYER`. A deployment that forgets to wire an
 * extractor reads no NISR figures; it does not read them badly.
 *
 * WHAT MAY BE INSTALLED AND WHAT MAY NOT. The extractor supplies the text layer and
 * nothing else. It cannot change `parserId`, `parserVersion` or `mediaType` — those are
 * the frozen row's, which is what makes a decode attributable — and installing one is
 * recorded in the decoded value as `extractorId`/`extractorVersion`.
 */

/** The extractor of last resort: none. Refuses, and says which refusal it is. */
export const NISR_CPI_NO_EXTRACTOR_INSTALLED: NisrCpiTextLayerExtractor = Object.freeze({
  extractorId: 'nisr.cpi.no-extractor-installed',
  extractorVersion: '1.0.0',
  extract: () => null,
});

let installedExtractor: NisrCpiTextLayerExtractor = NISR_CPI_NO_EXTRACTOR_INSTALLED;

/**
 * Wire the text-layer extraction. Composition-root only.
 *
 * Passing `null` restores the refusing default, which is what a test tears down to and
 * is deliberately NOT a way to leave a half-configured runtime: the default refuses.
 */
export function installNisrCpiTextLayerExtractor(
  extractor: NisrCpiTextLayerExtractor | null,
): void {
  installedExtractor = extractor ?? NISR_CPI_NO_EXTRACTOR_INSTALLED;
}

export function installedNisrCpiTextLayerExtractorId(): string {
  return installedExtractor.extractorId;
}

/**
 * The row's decoder. Resolves the installed extractor PER CALL, so an extractor wired
 * after module load is the one that runs, and a decode performed before wiring refuses
 * rather than being silently deferred.
 */
export const nisrCpiDecode: ArtifactDecoder<NisrCpiDecoded> = (decoded) =>
  makeNisrCpiDecoder(installedExtractor)(decoded);

/**
 * Minimal structural facts. THE ADMISSION GATE, NOT THE DOMAIN PARSER: it establishes
 * that the body is the KIND OF THING the endpoint returns — "at least one table was
 * extracted and it has the shape a CPI release has" — and never that the figures are
 * plausible. What the numbers MEAN is Economy's.
 */
export const assertNisrCpiEnvelope = (parsed: NisrCpiDecoded): true | string => {
  const v = parsed as unknown;
  if (typeof v !== 'object' || v === null) return 'ENVELOPE_NOT_AN_OBJECT';
  const r = v as Record<string, unknown>;
  if (typeof r['referencePeriod'] !== 'string') return 'ENVELOPE_MISSING_REFERENCE_PERIOD';
  if (typeof r['publicationDate'] !== 'string') return 'ENVELOPE_MISSING_PUBLICATION_DATE';
  if (!Array.isArray(r['rows'])) return 'ENVELOPE_MISSING_ROWS';
  if ((r['rows'] as unknown[]).length === 0) return 'ENVELOPE_NO_ROWS_EXTRACTED';
  if (!Array.isArray(r['geographiesPresent'])) return 'ENVELOPE_MISSING_GEOGRAPHIES';
  return true;
};

/**
 * The frozen binding the registry row carries.
 *
 * FREEZING IS LOAD-BEARING: a caller that could rewrite `parserId` after dispatch could
 * attribute one parser's output to another.
 */
export const NISR_CPI_BINDING: ParserBinding<NisrCpiDecoded> = Object.freeze({
  parserId: NISR_CPI_PARSER_ID,
  parserVersion: NISR_CPI_PARSER_VERSION,
  mediaType: NISR_CPI_MEDIA_TYPE,
  decode: nisrCpiDecode,
  assertEnvelope: assertNisrCpiEnvelope,
});

/* ══════════════════════════════════════════════════════════════════════════
 * 10 · NO INFERRED REVISION OR FINALITY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NISR publishes no provisional, revised, preliminary or final marker on this series —
 * searched across two editions and six release pages, found in none, and re-measured on
 * the retained August artifact: zero occurrences of
 * provisional|revised|revision|preliminary|final.
 *
 * Economy's `REVISED` means *"a later vintage THE PUBLISHER HAS ISSUED"*, which is
 * publisher-stated by definition — `R-NUM-3`. NISR states none, so:
 *
 *     releaseStatus    null
 *     revisionOrdinal  unreachable — `assertReleaseStatusIsApplicable` throws unless
 *                      releaseStatus === 'REVISED'
 *
 * And on the ruled target there is no `revisionKind` to fabricate at all — `R-FA-3`:
 * *"the prior value is a prior Observation, not a property of its successor."*
 *
 * The issue ordinal in the running footer is NOT a substitute. It detects a MISSED
 * RELEASE — a gap in the monthly sequence — and never a revision. The two look identical
 * downstream and have opposite remedies: a revision needs a supersession edge, a missed
 * release needs a fetch.
 */
export const NISR_CPI_RELEASE_STATUS: null = null;
export const NISR_CPI_ISSUE_ORDINAL_DETECTS = 'MISSED_RELEASE_NEVER_REVISION' as const;

/**
 * A gap in the monthly issue sequence. `false` across the year boundary rather than
 * fabricating a missed release every January; `null` on a sequence it cannot read,
 * rather than a guess.
 */
export function missedReleaseBetween(previous: number, next: number): boolean | null {
  if (previous < 1 || previous > 12 || next < 1 || next > 12) return null;
  if (next === 1 && previous === 12) return false;
  if (next <= previous) return null;
  return next - previous > 1;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 11 · CHECKSUM AND PARSER-VERSION PROVENANCE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * R-ART-6: the content address is the hinge and it is ONE-WAY. Above it bytes, below it
 * meaning, and no parse result may change an artifact record.
 *
 * So this module RECEIVES the address the retention layer sealed and never mints,
 * recomputes or alters one. `RetainedPayload` carries a unique unexported symbol
 * precisely so "a parser cannot mint an address for bytes it invented".
 *
 * The provenance a decoded observation carries is assembled from four places, none of
 * them the parser's own claim about itself:
 *
 *     contentAddress   the sealed payload      — the bytes that were read
 *     parserId/Version the registry binding    — server-owned, not self-asserted
 *     extractor id     the decoded value       — which extraction produced the layer
 *     referencePeriod  the document body       — never a filename or an upload folder
 *     sourceLanguage   the artifact edition    — never a declared locale tag
 */
export interface NisrCpiParseProvenance {
  /** Copied from the sealed payload. Never computed here. */
  readonly contentAddress: string;
  /** From the registry row, not from this module's own constants at call time. */
  readonly parserId: string;
  readonly parserVersion: string;
  readonly extractorId: string;
  readonly extractorVersion: string;
  readonly referencePeriod: string;
  readonly sourceLanguage: string;
  readonly publicationDate: string;
}

export function assembleProvenance(
  sealedContentAddress: string,
  binding: ParserBinding<NisrCpiDecoded>,
  decoded: NisrCpiDecoded,
): NisrCpiParseProvenance {
  return {
    contentAddress: sealedContentAddress,
    parserId: binding.parserId,
    parserVersion: binding.parserVersion,
    extractorId: decoded.extractorId,
    extractorVersion: decoded.extractorVersion,
    referencePeriod: decoded.referencePeriod,
    sourceLanguage: decoded.sourceLanguage,
    publicationDate: decoded.publicationDate,
  };
}
