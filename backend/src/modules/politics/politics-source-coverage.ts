/**
 * ════════════════════════════════════════════════════════════════════════════
 * POLITICS SOURCE COVERAGE — ONE READING OF THREE INCOMPATIBLE PROGRAMMES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED OVER THE 54 GOVERNED SOURCE PACKS AT d0054ca. The three regional
 * programmes that cover this product's three priority regions each record
 * coverage gaps in a DIFFERENT SHAPE, and only two of them name a
 * politics-relevant role at all:
 *
 *   EU-27        27 packs   gaps[{role,status,…}]      PARLIAMENT_GOVERNMENT   27/27
 *   East Africa  11 packs   categories[{category,…}]   GOVERNMENT              11/11
 *   Middle East  16 packs   gaps[ "free text" ]        — none —                 0/16
 *
 * All 38 declared politics roles say COVERAGE_GAP. Not one says covered.
 *
 * So "what is our political-institution coverage in the priority regions?"
 * cannot be answered by reading one field. A consumer that tried would get a
 * number for Europe, a partial number for East Africa and silence for the
 * Middle East — and silence reads as zero.
 *
 * THIS MODULE REFUSES TO LET SILENCE READ AS ZERO. It returns one row per pack
 * with a status that distinguishes the three things that are actually
 * different:
 *
 *   COVERAGE_GAP            the programme declared the role and said it is a gap
 *   ROLE_NOT_DECLARED       the programme's vocabulary HAS no such role here
 *   PROGRAMME_SHAPE_OPAQUE  the programme records gaps as prose this cannot read
 *
 * The last two are NOT findings about coverage. They are findings about the
 * RECORD, and collapsing them into "gap" would be inventing an assessment
 * nobody made — the same error as reading a missing field as a zero.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 *
 * NO ACQUISITION, NO PROVIDER, NO ACTIVATION, NO RIGHTS CLAIM. It reads
 * already-retained offline pack records and derives nothing else. It cannot
 * enable a source: `activationStatus` and `rights` are not read, let alone
 * written. It introduces no second source vocabulary — every role name it
 * reports is the name the programme itself used, carried through verbatim in
 * `declaredAs`.
 *
 * IT IS NOT A COVERAGE PERCENTAGE. A count of declared gaps is not a measure
 * of political reality, and no caller should turn these rows into one.
 */

/** The shape this module needs from a pack. Structural, so no cross-package import is required. */
export interface CoveragePackInput {
  readonly iso3: string;
  readonly gapReason?: string | null;
}

export const POLITICS_COVERAGE_STATUSES = [
  'COVERAGE_GAP',
  'ROLE_NOT_DECLARED',
  'PROGRAMME_SHAPE_OPAQUE',
] as const;
export type PoliticsCoverageStatus = (typeof POLITICS_COVERAGE_STATUSES)[number];

/**
 * Role names that are POLITICS-RELEVANT, as the programmes spell them.
 *
 * Both are about the legislature or the executive. Deliberately NOT included:
 * OFFICIAL_STATISTICS, CENTRAL_BANK, HUMANITARIAN, LOCAL_NEWS, PUBLIC_NEWS and
 * DOMESTIC_PUBLISHER. A statistics office is a political institution in no
 * sense this product can use: it publishes figures, not governance change, and
 * counting it would overstate political coverage by the largest single group in
 * the Middle East packs (12 of 17 official sources there).
 */
export const POLITICS_RELEVANT_ROLE_NAMES: readonly string[] = [
  'PARLIAMENT_GOVERNMENT',
  'GOVERNMENT',
];

export interface PoliticsCoverageRow {
  readonly iso3: string;
  readonly status: PoliticsCoverageStatus;
  /** The programme's OWN role name, verbatim, or null when it declared none. */
  readonly declaredAs: string | null;
  /** The programme's own reason text, verbatim and untruncated, or null. */
  readonly declaredReason: string | null;
}

/**
 * THE FIRST BALANCED JSON OBJECT after the prose preamble.
 *
 * A NAIVE `slice(indexOf('{'))` IS WRONG HERE, AND IT COST ME A FALSE FINDING.
 * Seven of the eleven East Africa packs append a SECOND blob after the first —
 * `… }]} Refused normalization: [{"originalSourceId":…}]` — so slicing to the
 * end of the string yields "Extra data" and fails to parse. My first reading of
 * this corpus therefore reported that only 4 of 11 East Africa packs declared a
 * politics role. That was an artefact of my parser, not a fact about the data:
 * all eleven declare GOVERNMENT. The spec below caught it.
 *
 * Scanning for the matching brace reads the record the programme actually
 * wrote. String literals and escapes are tracked, because a brace inside a
 * reason string must not close the object.
 */
function trailingJson(gapReason: string): unknown {
  const start = gapReason.indexOf('{');

  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < gapReason.length; i += 1) {
    const char = gapReason[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        try {
          return JSON.parse(gapReason.slice(start, i + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readDeclaredRole(
  gapReason: string,
): { role: string; status: string; reason: string | null } | null {
  const root = asRecord(trailingJson(gapReason));

  if (!root) return null;

  /* EU-27: gaps[{ role, status, reason }]. East Africa: categories[{ category, status, reason }]. */
  for (const [key, nameField] of [
    ['gaps', 'role'],
    ['categories', 'category'],
  ] as const) {
    const list = root[key];

    if (!Array.isArray(list)) continue;

    for (const raw of list) {
      const entry = asRecord(raw);

      /* The Middle East programme's `gaps` holds STRINGS, not objects. Not readable here. */
      if (!entry) continue;

      const name = entry[nameField];
      const status = entry.status;

      if (typeof name !== 'string' || typeof status !== 'string') continue;
      if (!POLITICS_RELEVANT_ROLE_NAMES.includes(name)) continue;

      return {
        role: name,
        status,
        reason: typeof entry.reason === 'string' ? entry.reason : null,
      };
    }
  }

  return null;
}

/** Does this pack's gapReason carry a structured role list this module can read at all? */
function shapeIsReadable(gapReason: string): boolean {
  const root = asRecord(trailingJson(gapReason));

  if (!root) return false;

  for (const key of ['gaps', 'categories']) {
    const list = root[key];

    if (Array.isArray(list) && list.some((raw) => asRecord(raw) !== null)) return true;
  }

  return false;
}

/**
 * One politics-coverage row per pack, in input order.
 *
 * A declared politics role is reported with the programme's own status string
 * when that status is a gap. Anything else is reported as a fact about the
 * RECORD, never as a coverage conclusion.
 */
export function politicsCoverageFromPacks(
  packs: readonly CoveragePackInput[],
): readonly PoliticsCoverageRow[] {
  return packs.map((pack) => {
    const gapReason = typeof pack.gapReason === 'string' ? pack.gapReason : '';
    const declared = gapReason.length > 0 ? readDeclaredRole(gapReason) : null;

    if (declared) {
      return Object.freeze({
        iso3: pack.iso3,
        /*
         * THE PROGRAMME'S STATUS IS CARRIED, NOT REINTERPRETED. Every declared
         * politics role measured at d0054ca says COVERAGE_GAP; if one ever says
         * something else, this must not silently flatten it, so an unrecognised
         * status is reported as an unreadable record rather than as coverage.
         */
        status: (declared.status === 'COVERAGE_GAP'
          ? 'COVERAGE_GAP'
          : 'PROGRAMME_SHAPE_OPAQUE') as PoliticsCoverageStatus,
        declaredAs: declared.role,
        declaredReason: declared.reason,
      });
    }

    return Object.freeze({
      iso3: pack.iso3,
      status: (shapeIsReadable(gapReason)
        ? 'ROLE_NOT_DECLARED'
        : 'PROGRAMME_SHAPE_OPAQUE') as PoliticsCoverageStatus,
      declaredAs: null,
      declaredReason: null,
    });
  });
}

/**
 * A count per status, for an operator surface.
 *
 * IT RETURNS NO TOTAL AND NO RATIO, deliberately. A single number would invite
 * "n% covered", and three of these statuses are not about coverage at all.
 */
export function politicsCoverageTally(
  rows: readonly PoliticsCoverageRow[],
): Readonly<Record<PoliticsCoverageStatus, number>> {
  const tally = Object.fromEntries(
    POLITICS_COVERAGE_STATUSES.map((status) => [status, 0]),
  ) as Record<PoliticsCoverageStatus, number>;

  for (const row of rows) tally[row.status] += 1;

  return Object.freeze(tally);
}

/**
 * NO STATUS IN THIS VOCABULARY CAN ASSERT COVERAGE, AND THAT IS THE FINDING.
 *
 * I first wrote this as a predicate, `anyPoliticsCoverageAsserted(rows)`. It
 * was VACUOUS — every branch returned false, because none of the three statuses
 * above says a political institution IS covered. A predicate that cannot vary
 * with its input is not a check; it is a comment that looks like code, and it
 * would have passed any test asserting `false`.
 *
 * The truthful form is a constant. A caller asking "do we have political
 * coverage anywhere in the priority regions?" gets the real answer — the
 * question cannot be answered YES from this data, because no programme has a
 * way to record a politics-institution baseline as admitted. Closing that needs
 * a declared, admitted baseline, not a new status value.
 *
 * It is `true as const` so a future lane that adds an asserting status has to
 * come here and change a literal that tests pin, rather than quietly widening
 * the vocabulary.
 */
export const POLITICS_COVERAGE_CANNOT_BE_ASSERTED_BY_THIS_VOCABULARY = true as const;
