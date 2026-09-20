/**
 * NISR CPI PDF DECODER — SPEC
 *
 * G's R5 suite, landed. Three things changed on the way in and each is marked at the
 * test it changed:
 *
 *   1. IT RUNS. R5 lived in `backend/src/modules/eastafrica-intel/_candidate/`, which
 *      the backend suite collects, but the decoder it tested is now `shared/`'s — and
 *      `shared` gained a runner in the convergence round precisely so a contract's own
 *      suite is not "documentation with a `.spec.ts` extension".
 *
 *   2. THE TWO INVERTING PINS ARE GONE, WITH THE BLOCKER THEY GUARDED. R5 pinned that
 *      `shared/src` declared `ArtifactDecoder` nowhere and that `ParserBinding` carried
 *      no `decode`. Both landed. R5's instruction for that day was explicit — "deleted
 *      with the blocker, never weakened" — and the guarantee they stood in for is now
 *      carried by the compiler and by `parser-dispatch-mutation.spec.ts`, which is the
 *      stronger place for it.
 *
 *   3. THE PERCENT MARKER INVERTED ONE TEST. See §5. Recorded, not quietly patched.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT IN THESE FIXTURES IS MEASURED, AND WHAT IS SHAPE
 * ──────────────────────────────────────────────────────────────────────────
 *
 * This distinction is the first thing in the file because getting it wrong is how a test
 * suite launders invented numbers into a citation.
 *
 * MEASURED — the ten annex headers for both editions, the two imprints, the issue
 * ordinals 8 and 7, the publication dates, the base period, and the six headline percent
 * changes per edition including the July rural negative.
 *
 * The August six were re-measured INDEPENDENTLY in this round, from the retained artifact
 * `sha256 4ba5193b…` (1,727,902 bytes), and all six agree with G's R4 reading:
 *
 *     urban 15.7 / 1.8 · rural 16.0 / 3.1 · All Rwanda 15.9 / 2.6
 *
 * SHAPE ONLY — NOT PUBLISHER VALUES, NOT CITABLE, NOT NISR FIGURES: the index-point
 * cells, the weight cells, the contribution cells, the COICOP code and the category
 * label. They are `SHAPE_ONLY_NOT_A_PUBLISHER_VALUE`, and no assertion reads one AS a
 * value; they are exercised only for parse, unit and refusal behaviour.
 */

import {
  ALL_RWANDA_IS_NEVER_COMPUTED,
  NISR_CPI_BINDING,
  NISR_CPI_COLUMN_ROLES,
  NISR_CPI_GEOGRAPHIES,
  NISR_CPI_ISSUE_ORDINAL_DETECTS,
  NISR_CPI_LICENCE_TOKEN,
  NISR_CPI_MEDIA_TYPE,
  NISR_CPI_PARSER_ID,
  NISR_CPI_PARSER_VERSION,
  NISR_CPI_PERCENT_MARKER_BY_ROLE,
  NISR_CPI_PLATFORM_REFUSAL_KEY,
  NISR_CPI_REFUSAL_KEYS,
  NISR_CPI_RELEASE_STATUS,
  NISR_CPI_SPATIAL_PRECISION,
  NISR_CPI_UNIT_BY_ROLE,
  assembleProvenance,
  assertNisrCpiEnvelope,
  bindColumns,
  makeNisrCpiDecoder,
  missedReleaseBetween,
  parseChangeColumn,
  parseNumericCell,
  parsePeriodColumn,
  unitForRole,
  type NisrCpiDecoded,
  type NisrCpiGeography,
  type NisrCpiTextLayer,
  type NisrCpiTextLayerExtractor,
} from './nisr-cpi.decoder';

/* ══════════════════════════════════════════════════════════════════════════
 * MEASURED CONSTANTS
 * ══════════════════════════════════════════════════════════════════════════ */

interface CpiHeadline {
  readonly geography: NisrCpiGeography;
  readonly annualPercentChange: number;
  readonly monthlyPercentChange: number;
}

/** Measured. Re-read from the retained August artifact this round; unchanged from R4. */
const AUG2026_HEADLINES: readonly CpiHeadline[] = [
  { geography: 'URBAN', annualPercentChange: 15.7, monthlyPercentChange: 1.8 },
  { geography: 'RURAL', annualPercentChange: 16.0, monthlyPercentChange: 3.1 },
  { geography: 'ALL_RWANDA', annualPercentChange: 15.9, monthlyPercentChange: 2.6 },
];

/** Measured by G in R4. The previous edition, and the one carrying the negative. */
const JUL2026_HEADLINES: readonly CpiHeadline[] = [
  { geography: 'URBAN', annualPercentChange: 14.5, monthlyPercentChange: 0.9 },
  { geography: 'RURAL', annualPercentChange: 13.3, monthlyPercentChange: -0.2 },
  { geography: 'ALL_RWANDA', annualPercentChange: 13.8, monthlyPercentChange: 0.3 },
];

/** Measured: the August 2026 annex header row, in publisher order. */
const AUG_HEADERS: readonly string[] = [
  'Code', 'Categories', 'Weights',
  'Aug-25', 'Jul-26', 'Aug-26',
  'on Jul. 2026', 'on Aug. 2025',
  '1 month', '12 months',
];

/** Measured: the July 2026 annex header row. Three of the ten have moved. */
const JUL_HEADERS: readonly string[] = [
  'Code', 'Categories', 'Weights',
  'Jul-25', 'Jun-26', 'Jul-26',
  'on Jun. 2026', 'on Jul. 2025',
  '1 month', '12 months',
];

/** Measured verbatim. The prefix differs between editions; the token does not. */
const AUG_LICENCE_LINE = 'NISR © 2026 National Institute of Statistics of Rwanda. Licensed under CC BY 4.0';
const JUL_LICENCE_LINE = '©National Institute of Statistics of Rwanda. Licensed under CC BY 4.0';

/** Measured verbatim, and the issue ordinal is anchored at the end of the block. */
const AUG_FOOTER = 'National Institute of Statistics of Rwanda /CPI August 2026- N° 8';
const JUL_FOOTER = 'National Institute of Statistics of Rwanda /CPI July 2026- N° 7';

const AUG_IMPRINT = `${AUG_LICENCE_LINE}\n${AUG_FOOTER}`;
const JUL_IMPRINT = `${JUL_LICENCE_LINE}\n${JUL_FOOTER}`;

/**
 * NOT A PUBLISHER VALUE. A number that occupies a cell so the parse path is exercised.
 * Named so that no reader, and no future grep, can mistake it for a NISR figure.
 */
const SHAPE_ONLY_NOT_A_PUBLISHER_VALUE = '100.0';
/** The same shape value where the publisher prints a marker. Still not a NISR figure. */
const SHAPE_ONLY_NOT_A_PUBLISHER_VALUE_PCT = '100.0%';

/** Build one annex row: shape cells everywhere, measured cells in the two change columns. */
function row(headline: CpiHeadline): { readonly cells: readonly string[] } {
  return {
    cells: [
      '0',                                       // COICOP code — shape
      'GENERAL INDEX',                           // category label — shape
      SHAPE_ONLY_NOT_A_PUBLISHER_VALUE_PCT,      // weights — shape, marker REQUIRED
      SHAPE_ONLY_NOT_A_PUBLISHER_VALUE,          // index, year ago — shape
      SHAPE_ONLY_NOT_A_PUBLISHER_VALUE,          // index, previous — shape
      SHAPE_ONLY_NOT_A_PUBLISHER_VALUE,          // index, current — shape
      `${headline.monthlyPercentChange}%`,       // on Jul. 2026 — MEASURED
      `${headline.annualPercentChange}%`,        // on Aug. 2025 — MEASURED
      SHAPE_ONLY_NOT_A_PUBLISHER_VALUE,          // contribution 1 month — shape
      SHAPE_ONLY_NOT_A_PUBLISHER_VALUE,          // contribution 12 months — shape
    ],
  };
}

function annexes(
  headers: readonly string[],
  headlines: readonly CpiHeadline[],
): NisrCpiTextLayer['annexes'] {
  return headlines.map((h) => ({
    geography: h.geography,
    headers,
    rows: [row(h)],
    unassociatedRowCount: 0,
  }));
}

function augustLayer(patch: Partial<NisrCpiTextLayer> = {}): NisrCpiTextLayer {
  return {
    imprint: AUG_IMPRINT,
    publicationDateText: '10 September 2026',
    referencePeriodText: 'August 2026',
    basePeriodText: 'Feb 2014=100',
    sourceLanguage: 'en',
    annexes: annexes(AUG_HEADERS, AUG2026_HEADLINES),
    ...patch,
  };
}

function julyLayer(patch: Partial<NisrCpiTextLayer> = {}): NisrCpiTextLayer {
  return {
    imprint: JUL_IMPRINT,
    publicationDateText: '10 August 2026',
    referencePeriodText: 'July 2026',
    basePeriodText: 'Feb 2014=100',
    sourceLanguage: 'en',
    annexes: annexes(JUL_HEADERS, JUL2026_HEADLINES),
    ...patch,
  };
}

const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF" — never parsed here

/** A test extractor. It has an identity, as every extractor must. */
function extractorFor(layer: NisrCpiTextLayer | null): NisrCpiTextLayerExtractor {
  return {
    extractorId: 'test.fixed-layer',
    extractorVersion: '1.0.0',
    extract: () => layer,
  };
}

function decoderFor(layer: NisrCpiTextLayer | null) {
  return makeNisrCpiDecoder(extractorFor(layer));
}

function decodeOrThrow(layer: NisrCpiTextLayer): NisrCpiDecoded {
  const r = decoderFor(layer)(BYTES);
  if (!r.ok) throw new Error(`expected decode to succeed, refused ${r.detail}`);
  return r.value;
}

/**
 * The parser's own diagnosis, read back out of `detail`.
 *
 * The platform key is `PARSE_FAILED` for all eleven — see the decoder's §2 — so a test
 * that asserted on `refusalKey` alone would pass for the wrong refusal. This reads the
 * NISR key, and a separate test pins that the platform key is what it should be.
 */
function refusalOf(layer: NisrCpiTextLayer | null): string {
  const r = decoderFor(layer)(BYTES);
  if (r.ok) throw new Error('expected a refusal, got a decode');
  return r.detail.split(':')[0] ?? '';
}

function cellValue(
  decoded: NisrCpiDecoded,
  geography: NisrCpiGeography,
  role: (typeof NISR_CPI_COLUMN_ROLES)[number],
): number {
  const r = decoded.rows.find((x) => x.geography === geography);
  if (r === undefined) throw new Error(`no row for ${geography}`);
  const c = r.cells.find((x) => x.role === role);
  if (c === undefined) throw new Error(`no cell for ${role}`);
  return c.value;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · THE FIXTURE'S OWN HONESTY
 * ══════════════════════════════════════════════════════════════════════════ */

describe('fixture provenance', () => {
  it('keeps every shape cell identical, so no shape cell can read as a datum', () => {
    const cells = row(AUG2026_HEADLINES[0]!).cells;
    const shape = [cells[3], cells[4], cells[5], cells[8], cells[9]];
    expect(new Set(shape).size).toBe(1);
    expect(shape[0]).toBe(SHAPE_ONLY_NOT_A_PUBLISHER_VALUE);
  });

  it('carries the July negative, which is the value a sign-stripping parser loses', () => {
    const rural = JUL2026_HEADLINES.find((h) => h.geography === 'RURAL');
    expect(rural?.monthlyPercentChange).toBe(-0.2);
  });

  it('agrees with the independent re-measurement of the retained August artifact', () => {
    /*
      The six values below were read this round from `pdftotext -table` over the retained
      bytes, and are asserted here so the fixture cannot drift from the artifact without
      a test saying so. They are the publisher's, not this suite's.
    */
    expect(AUG2026_HEADLINES).toEqual([
      { geography: 'URBAN', annualPercentChange: 15.7, monthlyPercentChange: 1.8 },
      { geography: 'RURAL', annualPercentChange: 16.0, monthlyPercentChange: 3.1 },
      { geography: 'ALL_RWANDA', annualPercentChange: 15.9, monthlyPercentChange: 2.6 },
    ]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · SEMANTIC COLUMN BINDING
 * ══════════════════════════════════════════════════════════════════════════ */

describe('semantic column binding', () => {
  it('binds all ten roles from the August header row', () => {
    const b = bindColumns(AUG_HEADERS);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.bindings.map((x) => x.role)).toEqual([...NISR_CPI_COLUMN_ROLES]);
  });

  it('binds the July header row to the same roles though three headers moved', () => {
    const b = bindColumns(JUL_HEADERS);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.bindings.map((x) => x.role)).toEqual([...NISR_CPI_COLUMN_ROLES]);
    expect(b.bindings.find((x) => x.role === 'INDEX_CURRENT_PERIOD')?.period).toBe('2026-07');
  });

  it('assigns the period roles by chronological order, not by position', () => {
    /* The publisher reorders its three period columns. A position parser reads the
       year-ago column as the current one; this still binds correctly. */
    const shuffled = [
      'Code', 'Categories', 'Weights',
      'Aug-26', 'Aug-25', 'Jul-26',
      'on Jul. 2026', 'on Aug. 2025',
      '1 month', '12 months',
    ];
    const b = bindColumns(shuffled);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.bindings.find((x) => x.role === 'INDEX_CURRENT_PERIOD')?.index).toBe(3);
    expect(b.bindings.find((x) => x.role === 'INDEX_YEAR_AGO')?.index).toBe(4);
    expect(b.bindings.find((x) => x.role === 'INDEX_PREVIOUS_PERIOD')?.index).toBe(5);
  });

  it('never compares a header against a literal month name', () => {
    /* Shape, not text: a month the artifacts have never carried still binds. */
    expect(parsePeriodColumn('Mar-27')).toBe('2027-03');
    expect(parseChangeColumn('on Mar. 2027')).toBe('2027-03');
    expect(parsePeriodColumn('Aug 2026')).toBeNull();
    expect(parsePeriodColumn('Foo-26')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · DECODING THE AUGUST 2026 ARTIFACT
 * ══════════════════════════════════════════════════════════════════════════ */

describe('decoding the August 2026 artifact', () => {
  const d = decodeOrThrow(augustLayer());

  it('reads the reference period from the document body', () => {
    expect(d.referencePeriod).toBe('2026-08');
  });

  it('keeps the publication date separate from, and later than, the reference period', () => {
    expect(d.publicationDate).toBe('2026-09-10');
    expect(d.publicationDate.slice(0, 7)).not.toBe(d.referencePeriod);
  });

  it('carries the source language explicitly', () => {
    expect(d.sourceLanguage).toBe('en');
  });

  it('carries the base period, because an index without its base is not a figure', () => {
    expect(d.basePeriod).toBe('Feb 2014=100');
  });

  it('reads the issue ordinal from the running footer', () => {
    expect(d.issueOrdinal).toBe(8);
  });

  it('reports all three published geographies', () => {
    expect([...d.geographiesPresent].sort()).toEqual([...NISR_CPI_GEOGRAPHIES].sort());
  });

  it('reproduces every measured headline percent change', () => {
    for (const h of AUG2026_HEADLINES) {
      expect(cellValue(d, h.geography, 'PCT_CHANGE_ON_YEAR_AGO')).toBe(h.annualPercentChange);
      expect(cellValue(d, h.geography, 'PCT_CHANGE_ON_PREVIOUS')).toBe(h.monthlyPercentChange);
    }
  });

  it('gives every numeric cell exactly one unit', () => {
    for (const r of d.rows) {
      for (const c of r.cells) {
        expect(c.unit).toBe(NISR_CPI_UNIT_BY_ROLE[c.role]);
        expect(typeof c.unit).toBe('string');
      }
    }
  });

  it('records which extraction produced it', () => {
    expect(d.extractorId).toBe('test.fixed-layer');
    expect(d.extractorVersion).toBe('1.0.0');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE SAME DECODER ON THE JULY EDITION
 * ══════════════════════════════════════════════════════════════════════════ */

describe('decoding the July 2026 artifact with the same decoder', () => {
  const d = decodeOrThrow(julyLayer());

  it('binds the moved headers and reads July as the reference period', () => {
    expect(d.referencePeriod).toBe('2026-07');
    expect(d.issueOrdinal).toBe(7);
  });

  it('preserves the negative monthly change rather than stripping the sign', () => {
    expect(cellValue(d, 'RURAL', 'PCT_CHANGE_ON_PREVIOUS')).toBe(-0.2);
  });

  it('reproduces every measured July headline', () => {
    for (const h of JUL2026_HEADLINES) {
      expect(cellValue(d, h.geography, 'PCT_CHANGE_ON_YEAR_AGO')).toBe(h.annualPercentChange);
      expect(cellValue(d, h.geography, 'PCT_CHANGE_ON_PREVIOUS')).toBe(h.monthlyPercentChange);
    }
  });

  it('is the edition that catches an averaging parser, and the August one is not', () => {
    /* July: (14.5 + 13.3) / 2 = 13.9 and the publisher says 13.8. August: 15.85 → 15.9,
       which IS the published figure. Carrying two editions is the control. */
    const u = JUL2026_HEADLINES.find((h) => h.geography === 'URBAN')!.annualPercentChange;
    const r = JUL2026_HEADLINES.find((h) => h.geography === 'RURAL')!.annualPercentChange;
    const all = JUL2026_HEADLINES.find((h) => h.geography === 'ALL_RWANDA')!.annualPercentChange;
    expect(Math.round(((u + r) / 2) * 10) / 10).not.toBe(all);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 5 · NEGATIVE CONTROL 1 — HEADER DRIFT
 * ══════════════════════════════════════════════════════════════════════════ */

describe('NC-1 header drift', () => {
  it('accepts the drift that actually happens: the three period headers moving on', () => {
    /* The half that matters first. If this refused, the parser would work once. */
    expect(bindColumns(JUL_HEADERS).ok).toBe(true);
    expect(bindColumns(AUG_HEADERS).ok).toBe(true);
  });

  it('refuses when a period header is no longer recognisable', () => {
    const drifted = AUG_HEADERS.map((h) => (h === 'Aug-26' ? 'August 2026' : h));
    const b = bindColumns(drifted);
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.refusalKey).toBe('NISR_PDF_HEADER_ROLES_UNRESOLVED');
  });

  it('refuses when a fixed header is renamed', () => {
    const renamed = AUG_HEADERS.map((h) => (h === 'Weights' ? 'Weighting' : h));
    const b = bindColumns(renamed);
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.refusalKey).toBe('NISR_PDF_HEADER_ROLES_UNRESOLVED');
  });

  it('refuses a column count that is not ten', () => {
    expect(bindColumns(AUG_HEADERS.slice(0, 9)).ok).toBe(false);
    expect(bindColumns([...AUG_HEADERS, 'Extra']).ok).toBe(false);
  });

  it('refuses two period columns naming the same month, which cannot be ordered', () => {
    const b = bindColumns(AUG_HEADERS.map((h) => (h === 'Jul-26' ? 'Aug-26' : h)));
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.refusalKey).toBe('NISR_PDF_PERIOD_COLUMNS_UNORDERABLE');
  });

  it('refuses when the change columns contradict the period columns', () => {
    const b = bindColumns(AUG_HEADERS.map((h) => (h === 'on Jul. 2026' ? 'on Jun. 2026' : h)));
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.refusalKey).toBe('NISR_PDF_HEADER_ROLES_UNRESOLVED');
  });

  it('surfaces header drift through the decoder, not only through the binder', () => {
    const drifted = annexes(
      AUG_HEADERS.map((h) => (h === 'Aug-26' ? 'August 2026' : h)),
      AUG2026_HEADLINES,
    );
    expect(refusalOf(augustLayer({ annexes: drifted }))).toBe('NISR_PDF_HEADER_ROLES_UNRESOLVED');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 6 · NEGATIVE CONTROL 2 — MIXED UNITS
 * ══════════════════════════════════════════════════════════════════════════ */

describe('NC-2 mixed units', () => {
  it('keeps index points and percent distinguishable, though the cells look alike', () => {
    expect(unitForRole('INDEX_CURRENT_PERIOD')).toBe('INDEX_POINTS');
    expect(unitForRole('PCT_CHANGE_ON_YEAR_AGO')).toBe('PERCENT');
    expect(unitForRole('INDEX_CURRENT_PERIOD')).not.toBe(unitForRole('PCT_CHANGE_ON_YEAR_AGO'));
  });

  it('gives the four unit-bearing role groups four distinct units', () => {
    const units = new Set(
      NISR_CPI_COLUMN_ROLES.map((r) => unitForRole(r)).filter((u): u is string => u !== null),
    );
    expect(units.size).toBe(4);
  });

  it('refuses a cell whose role carries no unit', () => {
    const r = parseNumericCell('0', 'COICOP_CODE');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusalKey).toBe('NISR_PDF_UNIT_AMBIGUOUS');
  });

  it('refuses a thousands separator rather than guessing the convention', () => {
    // NISR's CPI prints none; the GDP release does. One parser cannot silently be
    // correct for two conventions it cannot tell apart.
    const r = parseNumericCell('1,234.5', 'INDEX_CURRENT_PERIOD');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusalKey).toBe('NISR_PDF_UNIT_AMBIGUOUS');
  });

  /**
   * ── THE ONE TEST THIS ROUND INVERTED, AND WHY ─────────────────────────
   *
   * R5 asserted that `'15.7%'` in a `PCT_CHANGE_ON_YEAR_AGO` cell REFUSES, as a cell
   * "carrying its own unit marker". That was correct against R4's measurement, in which
   * the marker had already been stripped by the extraction, so the role was the only
   * thing that could distinguish an index level from a percentage.
   *
   * THE REAL ARTIFACT PRINTS THE MARKER. Measured this round, from the retained bytes:
   * `15.9%` in the change columns, `100%` in the weights, `208.3` in the index columns.
   * Keeping the old assertion would have refused every genuine NISR percentage cell —
   * the parser would have refused the artifact it was written for.
   *
   * So the marker is not ignored and not merely tolerated: it is CROSS-CHECKED against
   * the unit the role already determined, and a contradiction refuses. That is strictly
   * more than R5 had, and it is the direction the finding pushed.
   */
  it('accepts the marker the publisher actually prints, on the roles that carry it', () => {
    const pct = parseNumericCell('15.7%', 'PCT_CHANGE_ON_YEAR_AGO');
    expect(pct.ok).toBe(true);
    if (!pct.ok) return;
    expect(pct.value).toBe(15.7);
    expect(pct.unit).toBe('PERCENT');
    expect(pct.printedPercentMarker).toBe(true);
  });

  it('REFUSES a percent marker on an index cell — the contradiction that matters', () => {
    /* 15.7 is a plausible index level and a real percentage. If a column reorder put
       percentages under an index header, this is what catches it. */
    const idx = parseNumericCell('15.7%', 'INDEX_CURRENT_PERIOD');
    expect(idx.ok).toBe(false);
    if (idx.ok) return;
    expect(idx.refusalKey).toBe('NISR_PDF_UNIT_AMBIGUOUS');
  });

  it('REFUSES a missing marker where the publisher always prints one', () => {
    expect(parseNumericCell('15.7', 'PCT_CHANGE_ON_YEAR_AGO').ok).toBe(false);
    expect(parseNumericCell('100', 'WEIGHT').ok).toBe(false);
  });

  it('allows either form ONLY where the publisher is genuinely inconsistent', () => {
    /* Measured: the GENERAL INDEX row prints its contributions as percentages, the
       component rows print them bare. An OPTIONAL that was measured is not a loophole. */
    expect(NISR_CPI_PERCENT_MARKER_BY_ROLE['CONTRIBUTION_1_MONTH']).toBe('EITHER');
    expect(parseNumericCell('2.6%', 'CONTRIBUTION_1_MONTH').ok).toBe(true);
    expect(parseNumericCell('2.2', 'CONTRIBUTION_1_MONTH').ok).toBe(true);
    /* and the marker is retained as evidence either way */
    const marked = parseNumericCell('2.6%', 'CONTRIBUTION_1_MONTH');
    expect(marked.ok && marked.printedPercentMarker).toBe(true);
  });

  /**
   * WHAT THE SHAPE REGEX ACTUALLY GUARDS — FOUND BY A MUTATION THAT DID NOT BITE.
   *
   * R5's M-8a relaxed the cell regex to accept thousands separators and the suite did
   * not notice, because `Number('1,234.5')` is already NaN: the comma refusal is
   * produced by the finiteness check, not by the regex whose comment claimed it. The
   * regex is the ONLY thing rejecting the four forms below, and the first is dangerous.
   */
  it('refuses an empty cell rather than reading it as zero', () => {
    for (const raw of ['', '   ']) {
      const r = parseNumericCell(raw, 'INDEX_CURRENT_PERIOD');
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.refusalKey).toBe('NISR_PDF_UNIT_AMBIGUOUS');
    }
  });

  it('refuses hex and exponent forms, which coerce to finite numbers', () => {
    for (const raw of ['0x1F', '1e3', '.5', '+15.7']) {
      expect(parseNumericCell(raw, 'INDEX_CURRENT_PERIOD').ok).toBe(false);
    }
  });

  it('refuses rather than salvaging a prefix, which is what a lenient parse would do', () => {
    // parseFloat('1,234.5') is 1 and parseFloat('15.7 pts') is 15.7. Either would be a
    // wrong number carrying NISR's name, so neither form is salvaged.
    for (const raw of ['1,234.5', '15.7 pts', '15,7', '15.7%%']) {
      expect(parseNumericCell(raw, 'PCT_CHANGE_ON_YEAR_AGO').ok).toBe(false);
    }
  });

  it('accepts a negative, because a month of deflation is data', () => {
    const r = parseNumericCell('-0.2%', 'PCT_CHANGE_ON_PREVIOUS');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(-0.2);
    expect(r.unit).toBe('PERCENT');
  });

  it('surfaces a mixed-unit cell through the decoder', () => {
    const mixed = AUG2026_HEADLINES.map((h) => ({
      geography: h.geography,
      headers: AUG_HEADERS,
      rows: [{ cells: row(h).cells.map((c, i) => (i === 5 ? '1,234.5' : c)) }],
      unassociatedRowCount: 0,
    }));
    expect(refusalOf(augustLayer({ annexes: mixed }))).toBe('NISR_PDF_UNIT_AMBIGUOUS');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 7 · NEGATIVE CONTROL 3 — WRONG PERIOD
 * ══════════════════════════════════════════════════════════════════════════ */

describe('NC-3 wrong period', () => {
  it('refuses when the body states one month and the current column names another', () => {
    expect(refusalOf(augustLayer({ referencePeriodText: 'July 2026' }))).toBe(
      'NISR_PDF_PERIOD_DISAGREES_WITH_CONTENT',
    );
  });

  it('refuses the reverse mismatch too, so neither side is privileged', () => {
    /* Isolated deliberately: R5's C-2 records that patching July's reference period to
       August ALSO created a publication-month collision, so the fixture tested two
       things and the test named one. June in the body, July in the columns. */
    expect(refusalOf(julyLayer({ referencePeriodText: 'June 2026' }))).toBe(
      'NISR_PDF_PERIOD_DISAGREES_WITH_CONTENT',
    );
  });

  it('reports the publication-date defect first when an artifact carries both', () => {
    /* REFUSAL PRECEDENCE IS NOT A DIAGNOSIS. A reviewer must not read a date refusal as
       a statement that the columns agree. */
    const both = augustLayer({ referencePeriodText: 'September 2026' });
    expect(refusalOf(both)).toBe('NISR_PDF_PUBLICATION_DATE_UNRESOLVED');
  });

  it('refuses an unparseable reference period rather than defaulting to the column', () => {
    expect(refusalOf(augustLayer({ referencePeriodText: 'Q3 2026' }))).toBe(
      'NISR_PDF_PERIOD_DISAGREES_WITH_CONTENT',
    );
  });

  it('refuses a publication date in the reference month', () => {
    expect(refusalOf(augustLayer({ publicationDateText: '10 August 2026' }))).toBe(
      'NISR_PDF_PUBLICATION_DATE_UNRESOLVED',
    );
  });

  it('refuses an unparseable publication date', () => {
    expect(refusalOf(augustLayer({ publicationDateText: '2026-09-10' }))).toBe(
      'NISR_PDF_PUBLICATION_DATE_UNRESOLVED',
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 8 · NEGATIVE CONTROL 4 — THE NATIONAL ROW, AND THE SHARPEST RULING
 * ══════════════════════════════════════════════════════════════════════════ */

/** Not a NISR figure. Chosen because no combination of 15.7 and 16.0 yields it. */
const IMPOSSIBLE_FROM_URBAN_AND_RURAL = 99.9;

describe('NC-4 missing national row', () => {
  const withoutNational = annexes(AUG_HEADERS, AUG2026_HEADLINES).filter(
    (a) => a.geography !== 'ALL_RWANDA',
  );

  it('refuses when the All Rwanda annex is absent, with no arithmetic fallback', () => {
    expect(refusalOf(augustLayer({ annexes: withoutNational }))).toBe(
      'NISR_PDF_NATIONAL_ROW_MISSING',
    );
  });

  it('refuses even when urban and rural are both present and complete', () => {
    // Everything a computing parser would need is available. It still refuses.
    expect(withoutNational).toHaveLength(2);
    expect(refusalOf(augustLayer({ annexes: withoutNational }))).toBe(
      'NISR_PDF_NATIONAL_ROW_MISSING',
    );
  });

  it('shows why an equality test against the real edition would not catch averaging', () => {
    const u = AUG2026_HEADLINES.find((h) => h.geography === 'URBAN')!.annualPercentChange;
    const r = AUG2026_HEADLINES.find((h) => h.geography === 'RURAL')!.annualPercentChange;
    const all = AUG2026_HEADLINES.find((h) => h.geography === 'ALL_RWANDA')!.annualPercentChange;
    expect(Math.round(((u + r) / 2) * 10) / 10).toBe(all);
    // Which is the whole reason for the control below.
  });

  it('POSITIVE CONTROL: returns the published national value, not a computed one', () => {
    const headlines: readonly CpiHeadline[] = AUG2026_HEADLINES.map((h) =>
      h.geography === 'ALL_RWANDA'
        ? {
            geography: h.geography,
            annualPercentChange: IMPOSSIBLE_FROM_URBAN_AND_RURAL,
            monthlyPercentChange: IMPOSSIBLE_FROM_URBAN_AND_RURAL,
          }
        : h,
    );
    const d = decodeOrThrow(augustLayer({ annexes: annexes(AUG_HEADERS, headlines) }));

    expect(cellValue(d, 'ALL_RWANDA', 'PCT_CHANGE_ON_YEAR_AGO')).toBe(
      IMPOSSIBLE_FROM_URBAN_AND_RURAL,
    );
    // Urban and rural are untouched, so an averaging parser would have produced 15.9
    // here and this assertion would fail.
    expect(cellValue(d, 'URBAN', 'PCT_CHANGE_ON_YEAR_AGO')).toBe(15.7);
    expect(cellValue(d, 'RURAL', 'PCT_CHANGE_ON_YEAR_AGO')).toBe(16.0);
    expect(cellValue(d, 'ALL_RWANDA', 'PCT_CHANGE_ON_YEAR_AGO')).not.toBe(15.9);
  });

  it('holds the constant that names the rule, so a guard can cite it', () => {
    expect(ALL_RWANDA_IS_NEVER_COMPUTED).toBe(true);
  });

  it('keeps urban a stratum rather than a place', () => {
    expect(NISR_CPI_SPATIAL_PRECISION).toBe('COUNTRY');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 9 · NEGATIVE CONTROL 5 — LICENCE-TEXT VARIATION
 * ══════════════════════════════════════════════════════════════════════════ */

describe('NC-5 licence-text variation', () => {
  it('accepts the August imprint', () => {
    expect(decodeOrThrow(augustLayer()).licenceToken).toBe(NISR_CPI_LICENCE_TOKEN);
  });

  it('accepts the July imprint, whose surrounding string differs', () => {
    expect(AUG_LICENCE_LINE).not.toBe(JUL_LICENCE_LINE);
    expect(decodeOrThrow(julyLayer()).licenceToken).toBe(NISR_CPI_LICENCE_TOKEN);
  });

  it('accepts an imprint prefix this lane has never seen, since only the token is stable', () => {
    const future = `NISR © 2027 Kigali. ${NISR_CPI_LICENCE_TOKEN}\n${AUG_FOOTER}`;
    expect(decodeOrThrow(augustLayer({ imprint: future })).licenceToken).toBe(
      NISR_CPI_LICENCE_TOKEN,
    );
  });

  it('refuses an imprint that reserves rights', () => {
    const reserved = `© 2026 NISR. All rights reserved.\n${AUG_FOOTER}`;
    expect(refusalOf(augustLayer({ imprint: reserved }))).toBe('NISR_PDF_LICENCE_TOKEN_ABSENT');
  });

  it('refuses a different CC licence rather than treating CC as one thing', () => {
    const nc = `NISR. Licensed under CC BY-NC 4.0\n${AUG_FOOTER}`;
    expect(refusalOf(augustLayer({ imprint: nc }))).toBe('NISR_PDF_LICENCE_TOKEN_ABSENT');
  });

  it('refuses an empty imprint rather than reading absence as permission', () => {
    expect(refusalOf(augustLayer({ imprint: '' }))).toBe('NISR_PDF_LICENCE_TOKEN_ABSENT');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 10 · THE REMAINING REFUSALS, AND FULL KEY COVERAGE
 * ══════════════════════════════════════════════════════════════════════════ */

describe('remaining refusals', () => {
  it('refuses an artifact with no text layer, and does not reach for OCR', () => {
    expect(refusalOf(null)).toBe('NISR_PDF_NO_TEXT_LAYER');
  });

  it('refuses the whole artifact when any row could not be associated', () => {
    const withUnassociated = annexes(AUG_HEADERS, AUG2026_HEADLINES).map((a, i) =>
      i === 0 ? { ...a, unassociatedRowCount: 1 } : a,
    );
    expect(refusalOf(augustLayer({ annexes: withUnassociated }))).toBe(
      'NISR_PDF_ROW_CELLS_UNASSOCIATED',
    );
  });

  it('refuses a row whose cell count does not match the bound columns', () => {
    const short = AUG2026_HEADLINES.map((h) => ({
      geography: h.geography,
      headers: AUG_HEADERS,
      rows: [{ cells: row(h).cells.slice(0, 9) }],
      unassociatedRowCount: 0,
    }));
    expect(refusalOf(augustLayer({ annexes: short }))).toBe('NISR_PDF_ROW_CELLS_UNASSOCIATED');
  });

  it('refuses an index with no stated base period', () => {
    expect(refusalOf(augustLayer({ basePeriodText: '' }))).toBe('NISR_PDF_BASE_PERIOD_ABSENT');
  });

  it('refuses an artifact with no annexes at all', () => {
    expect(refusalOf(augustLayer({ annexes: [] }))).toBe('NISR_PDF_NATIONAL_ROW_MISSING');
  });

  it('refuses an edition whose language was not observed', () => {
    /* Absent must mean "the publisher states none", never "we did not look" — which is
       what the field now means once it reaches `lineage.retrieval`. */
    expect(refusalOf(augustLayer({ sourceLanguage: '' }))).toBe(
      'NISR_PDF_SOURCE_LANGUAGE_UNOBSERVED',
    );
    expect(refusalOf(augustLayer({ sourceLanguage: '   ' }))).toBe(
      'NISR_PDF_SOURCE_LANGUAGE_UNOBSERVED',
    );
  });

  it('reports every refusal under the PLATFORM key, with its own diagnosis beside it', () => {
    const r = decoderFor(null)(BYTES);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusalKey).toBe(NISR_CPI_PLATFORM_REFUSAL_KEY);
    expect(r.refusalKey).toBe('PARSE_FAILED');
    expect(r.detail.startsWith('NISR_PDF_NO_TEXT_LAYER:')).toBe(true);
    /* NEVER the JSON key, and never the shape key — those belong to other steps. */
    expect(r.refusalKey).not.toBe('BODY_NOT_JSON_SHAPED');
    expect(r.refusalKey).not.toBe('BODY_NOT_PDF_SHAPED');
  });

  it('exercises every declared refusal key except none', () => {
    // A key that no test can produce is a key that documents a refusal the decoder does
    // not actually make.
    const produced = new Set<string>([
      refusalOf(null),
      refusalOf(augustLayer({ imprint: '' })),
      refusalOf(augustLayer({ sourceLanguage: '' })),
      refusalOf(augustLayer({ referencePeriodText: 'July 2026' })),
      refusalOf(augustLayer({ publicationDateText: '10 August 2026' })),
      refusalOf(augustLayer({ basePeriodText: '' })),
      refusalOf(
        augustLayer({
          annexes: annexes(AUG_HEADERS, AUG2026_HEADLINES).filter(
            (a) => a.geography !== 'ALL_RWANDA',
          ),
        }),
      ),
      refusalOf(
        augustLayer({
          annexes: annexes(AUG_HEADERS, AUG2026_HEADLINES).map((a, i) =>
            i === 0 ? { ...a, unassociatedRowCount: 1 } : a,
          ),
        }),
      ),
      refusalOf(
        augustLayer({
          annexes: annexes(
            AUG_HEADERS.map((h) => (h === 'Aug-26' ? 'August 2026' : h)),
            AUG2026_HEADLINES,
          ),
        }),
      ),
      refusalOf(
        augustLayer({
          annexes: AUG2026_HEADLINES.map((h) => ({
            geography: h.geography,
            headers: AUG_HEADERS,
            rows: [{ cells: row(h).cells.map((c, i) => (i === 5 ? '1,234.5' : c)) }],
            unassociatedRowCount: 0,
          })),
        }),
      ),
    ]);
    // The eleventh key is reachable only through the binder, which the decoder calls.
    const unorderable = bindColumns(AUG_HEADERS.map((h) => (h === 'Jul-26' ? 'Aug-26' : h)));
    if (!unorderable.ok) produced.add(unorderable.refusalKey);

    for (const key of NISR_CPI_REFUSAL_KEYS) {
      expect({ key, produced: produced.has(key) }).toEqual({ key, produced: true });
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 11 · NO INFERRED REVISION OR FINALITY
 * ══════════════════════════════════════════════════════════════════════════ */

describe('revision and finality are never inferred', () => {
  it('carries no release status, because the publisher states none', () => {
    expect(NISR_CPI_RELEASE_STATUS).toBeNull();
  });

  it('records that the issue ordinal detects a missed release and never a revision', () => {
    expect(NISR_CPI_ISSUE_ORDINAL_DETECTS).toBe('MISSED_RELEASE_NEVER_REVISION');
  });

  it('reports no gap for a consecutive pair', () => {
    expect(missedReleaseBetween(7, 8)).toBe(false);
  });

  it('reports a gap when an issue was skipped', () => {
    expect(missedReleaseBetween(8, 10)).toBe(true);
  });

  it('does not fabricate a missed release every January', () => {
    expect(missedReleaseBetween(12, 1)).toBe(false);
  });

  it('returns null rather than guessing on a sequence it cannot read', () => {
    expect(missedReleaseBetween(8, 8)).toBeNull();
    expect(missedReleaseBetween(9, 8)).toBeNull();
    expect(missedReleaseBetween(0, 8)).toBeNull();
    expect(missedReleaseBetween(8, 13)).toBeNull();
  });

  it('leaves the issue ordinal null when the footer does not carry one', () => {
    const noOrdinal = `${AUG_LICENCE_LINE}\nNational Institute of Statistics of Rwanda /CPI August 2026`;
    expect(decodeOrThrow(augustLayer({ imprint: noOrdinal })).issueOrdinal).toBeNull();
  });

  it('leaves the issue ordinal null rather than accepting an out-of-range counter', () => {
    const outOfRange = `${AUG_LICENCE_LINE}\nNISR /CPI August 2026- N° 99`;
    expect(decodeOrThrow(augustLayer({ imprint: outOfRange })).issueOrdinal).toBeNull();
  });

  it('exposes no revision field on the decoded artifact at all', () => {
    const d = decodeOrThrow(augustLayer()) as unknown as Record<string, unknown>;
    for (const forbidden of ['revisionKind', 'revisionOrdinal', 'releaseStatus', 'isFinal']) {
      expect(Object.prototype.hasOwnProperty.call(d, forbidden)).toBe(false);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 12 · PROVENANCE AND THE BINDING
 * ══════════════════════════════════════════════════════════════════════════ */

describe('provenance', () => {
  const SEALED = 'a'.repeat(64);

  it('carries the identity the registry row states', () => {
    expect(NISR_CPI_BINDING.parserId).toBe(NISR_CPI_PARSER_ID);
    expect(NISR_CPI_BINDING.parserVersion).toBe(NISR_CPI_PARSER_VERSION);
    expect(NISR_CPI_BINDING.mediaType).toBe(NISR_CPI_MEDIA_TYPE);
    expect(NISR_CPI_MEDIA_TYPE).toBe('application/pdf');
  });

  it('is frozen, so a caller cannot rewrite the parser identity after dispatch', () => {
    expect(Object.isFrozen(NISR_CPI_BINDING)).toBe(true);
  });

  it('refuses by default, because no extractor is installed in a bare runtime', () => {
    /* The safe default: a deployment that forgets to wire an extractor reads no NISR
       figures. It does not read them badly. */
    const r = NISR_CPI_BINDING.decode(BYTES);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail.startsWith('NISR_PDF_NO_TEXT_LAYER:')).toBe(true);
  });

  it('copies the sealed content address and never mints one', () => {
    const d = decodeOrThrow(augustLayer());
    const p = assembleProvenance(SEALED, NISR_CPI_BINDING, d);
    expect(p.contentAddress).toBe(SEALED);
  });

  it('takes parser identity from the registry row, not from the decoder asserting it', () => {
    const d = decodeOrThrow(augustLayer());
    const impostor = { ...NISR_CPI_BINDING, parserId: 'someone.else', parserVersion: '9.9.9' };
    const p = assembleProvenance(SEALED, impostor, d);
    expect(p.parserId).toBe('someone.else');
    expect(p.parserVersion).toBe('9.9.9');
    /* The point: the value comes from the BINDING it was dispatched under, so a decode
       performed under the wrong identity is catchable rather than self-certifying. */
  });

  it('carries reference period, source language, publication date and the extractor', () => {
    const d = decodeOrThrow(augustLayer());
    const p = assembleProvenance(SEALED, NISR_CPI_BINDING, d);
    expect(p.referencePeriod).toBe('2026-08');
    expect(p.sourceLanguage).toBe('en');
    expect(p.publicationDate).toBe('2026-09-10');
    expect(p.extractorId).toBe('test.fixed-layer');
  });
});

describe('envelope admission', () => {
  it('admits a decoded artifact', () => {
    expect(assertNisrCpiEnvelope(decodeOrThrow(augustLayer()))).toBe(true);
  });

  it('names what is missing rather than returning a bare false', () => {
    const d = decodeOrThrow(augustLayer());
    const { rows: _rows, ...withoutRows } = d;
    expect(assertNisrCpiEnvelope(withoutRows as unknown as NisrCpiDecoded)).toBe(
      'ENVELOPE_MISSING_ROWS',
    );
    expect(assertNisrCpiEnvelope({ ...d, rows: [] })).toBe('ENVELOPE_NO_ROWS_EXTRACTED');
  });

  it('stays STRUCTURAL — it never judges whether the figures are plausible', () => {
    const d = decodeOrThrow(augustLayer());
    const absurd: NisrCpiDecoded = {
      ...d,
      rows: d.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, value: -999 })) })),
    };
    /* The admission gate establishes that the body is the KIND OF THING the endpoint
       returns. What the numbers MEAN is Economy's. */
    expect(assertNisrCpiEnvelope(absurd)).toBe(true);
  });
});
