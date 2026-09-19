/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE GOVERNED PROTECTION AUTHORITY — PUBLIC CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ALPHA-HUMANITARIAN-GX14-AUTHORITY-STORE-R1.
 *
 * Main's `MAIN-HUMANITARIAN-GX14-AUTHORITY-STORE-R1` contract, with the eight changes
 * E1 made BLOCKING at implementation. Each is marked `AS-E1-n` where it lands, because
 * a reader comparing this to Main's proposal should be able to see exactly what moved
 * and why — one of them reverses Main outright.
 *
 * WHAT IS NOT HERE: the minting function. `sealProtectionAuthority` lives in
 * `geometry-authority.loader.ts`, which the barrel does not re-export. AS-E1-1.
 *
 * WHAT IS NOT TOUCHED: R3. GX-17 … GX-20 stand, `MAP_ALPHA` is frozen, `MAP_RICH` stays
 * unmounted, and this file adds no reader-facing behaviour of any kind.
 */

import {
  assertReaderProjectionIsClosed,
  readerAbsenceTokenFor,
  type GeometryWithheldReason,
  type ReaderAbsenceToken,
  type ReaderGeometryProjection,
} from './spatial-geometry';
import {
  authorityIsInstalledInstance,
  type ProtectionAuthority,
} from './geometry-authority.loader';

/**
 * Re-exported as a TYPE ONLY.
 *
 * A type cannot be constructed. Application code needs to name the authority it is
 * handed; it must not be able to make one, and re-exporting the type without the
 * minting function is exactly that distinction expressed in the module graph.
 */
export type { ProtectionAuthority };

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE RESOLVERS — AS-3, R3's SHAPE PRESERVED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * R3's `partitionIsProtected(partitionKey, registry)` is preserved exactly. These take
 * the SEALED authority and delegate, so what changes is not the question asked but WHO
 * MAY SUPPLY THE ANSWER'S SOURCE.
 *
 * Still no record list, no request, no set, no filter — GX-17(a) is inherited rather
 * than restated, which is why there is no new proof obligation here.
 */

export function partitionIsProtectedUnderAuthority(
  partitionKey: string,
  authority: ProtectionAuthority,
): boolean {
  return authority.partitions.declarations.some((d) => d.partitionKey === partitionKey);
}

export function recordIsProtectedUnderAuthority(
  protectionClassId: string | undefined,
  authority: ProtectionAuthority,
): boolean {
  if (protectionClassId === undefined) return false;
  return authority.classes.declarations.some((d) => d.classId === protectionClassId);
}

/**
 * AS-E1-2 · called ONCE PER REQUEST BATCH, before anything is resolved.
 *
 * A mismatch is a `PROGRAMMING_MISTAKE` alarm and the batch withholds — it does not
 * throw to the reader, because a reader-visible throw was itself the GX-18 channel.
 */
export class ForgedAuthority extends Error {}

export function assertAuthorityIsInstalled(authority: ProtectionAuthority): void {
  if (!authorityIsInstalledInstance(authority)) {
    throw new ForgedAuthority(
      'GEOMETRY_AUTHORITY_NOT_THE_INSTALLED_INSTANCE: this handle is structurally valid and is ' +
        'not the authority the loader sealed. Structural validity is what a forgery has.',
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · THE READER STORE ROW — AS-4, AS-E1-3, AS-E1-4
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two stores, and the separation is the control:
 *
 *   AUTHORITY STORE   full-resolution geometry including every protected record. The
 *                     reader process holds NO CREDENTIAL for it.
 *   READER STORE      one row per record, always. EITHER a reader projection OR a
 *                     withheld token — never geometry for a protected record, and
 *                     never an absence.
 *
 * THE ROW FOR A PROTECTED RECORD IS PRESENT AND WITHHELD, NOT MISSING. Deleting it
 * would make the reader store's MEMBERSHIP a function of the dark set, which is the
 * channel GX-5 closed — a hole is a position.
 */

export const READER_ROW_KINDS = ['PROJECTED', 'WITHHELD'] as const;
export type ReaderRowKind = (typeof READER_ROW_KINDS)[number];

/**
 * AS-E1-3 · `rowKind` IS A STORAGE COLUMN AND IS NEVER SERIALIZED.
 *
 * E1 measured the inconsistency in Main's contract: `WithheldReaderRow { rowKind,
 * recordKey, withheld }` FAILS R3's `assertReaderProjectionIsClosed` with
 * `GEOMETRY_PROJECTION_FIELD_SET_OPEN`, because R3's `WITHHELD_FIELDS` is exactly
 * `['recordKey','withheld']`. As written, the contract refused its own rows.
 *
 * It failed closed and loudly, so it could never have shipped a leak — but the two
 * halves disagreed. The resolution E1 requires: `rowKind` is a STORAGE DISCRIMINATOR,
 * the SERIALIZED row is R3's projection exactly, and closure is asserted on the
 * serialized shape. That is `serializeReaderRow` below, and `GA-46` is the assertion.
 */
export interface StoredWithheldRow {
  readonly rowKind: 'WITHHELD';
  readonly recordKey: string;
  /**
   * THE READER TOKEN, ALREADY MAPPED — never R3's internal `GeometryWithheldReason`.
   *
   * ── A DESIGN ERROR THE COMPILER CAUGHT, AND IT WAS THE IMPORTANT ONE ──────
   *
   * This field was first typed `GeometryWithheldReason`, R3's internal vocabulary. That
   * union contains `PROTECTED` — so the reader store would have held, in a column, the
   * exact fact GX-14 exists to keep out of it. Not leaked through a query or an error
   * channel: written down, at rest, one `SELECT` away from anyone who ever gets read
   * access to the reader store.
   *
   * R3's `readerAbsenceTokenFor` collapses all four internal reasons to two tokens
   * precisely so the distinction cannot survive the boundary. The mapping must therefore
   * happen BEFORE storage, not at serialization — a row that still knows why it is
   * withheld is a row that can be made to say so.
   *
   * The SQL column mirrors this: a CHECK constraint admits only these two values, so the
   * rule holds against a writer that bypasses this type entirely.
   */
  readonly withheld: ReaderAbsenceToken;
  /**
   * GA-40 — which authority projected this row. A reader never sees it; the projection
   * job refuses to complete while any row carries an epoch older than the current one.
   */
  readonly projectedUnderEpoch: number;
}

export interface StoredProjectedRow {
  readonly rowKind: 'PROJECTED';
  readonly recordKey: string;
  readonly projection: ReaderGeometryProjection;
  readonly projectedUnderEpoch: number;
}

export type StoredReaderRow = StoredWithheldRow | StoredProjectedRow;

/**
 * The ONE constructor for a withheld row, and the only place R3's internal reason is
 * allowed to be seen on the write path.
 *
 * It takes the internal reason, collapses it through R3's own `readerAbsenceTokenFor`,
 * and returns a row that no longer carries it. After this call the distinction between
 * `PROTECTED` and `RECORD_REFUSED` does not exist anywhere downstream — not in a
 * variable, not in a column, not in a backup.
 *
 * Constructing `StoredWithheldRow` by hand is still possible in TypeScript, which is why
 * the SQL CHECK exists too. This is the ergonomic door; the constraint is the wall.
 */
export function withheldRowFor(
  recordKey: string,
  reason: GeometryWithheldReason,
  projectedUnderEpoch: number,
): StoredWithheldRow {
  return {
    rowKind: 'WITHHELD',
    recordKey,
    withheld: readerAbsenceTokenFor(reason),
    projectedUnderEpoch,
  };
}

/**
 * The ONLY way a stored row reaches a reader.
 *
 * `rowKind` and `projectedUnderEpoch` are dropped here, and the result is checked
 * against R3's closure rule unmodified — so the serialized shape cannot drift from R3's
 * projection without this throwing.
 */
export function serializeReaderRow(row: StoredReaderRow): ReaderGeometryProjection {
  const serialized: ReaderGeometryProjection =
    row.rowKind === 'WITHHELD'
      ? ({ recordKey: row.recordKey, withheld: row.withheld } as ReaderGeometryProjection)
      : row.projection;

  // GA-46 — every row served from the reader store passes R3's closure check unmodified.
  assertReaderProjectionIsClosed(serialized);
  return serialized;
}

/**
 * AS-E1-4 · ORDER MUST NOT BE A FUNCTION OF ROW KIND.
 *
 * E1's finding is subtle and correct: AS-4 preserves membership and cardinality, but
 * "order is a property of the query and is not addressed". A reader response ordered by
 * anything correlated with row kind — a clustered index, a join returning projected rows
 * first, a `NULLS LAST` on a projected column — reintroduces AT THE STORE LAYER the
 * ordering channel R3 closed at the presentation layer.
 *
 * So ordering is defined HERE, on `recordKey` alone, and the SQL reader view orders by
 * the same key. `recordKey` is assigned by the producer before protection is known, so
 * it cannot correlate with the dark set.
 *
 * `GA-47` measures it with a set whose protected member is first, last and only.
 */
export function orderReaderRows<T extends { readonly recordKey: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.recordKey < b.recordKey ? -1 : a.recordKey > b.recordKey ? 1 : 0));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE REFUSAL VOCABULARY — AS-8, AS-E1-7
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * AS-E1-7 · THIS REVERSES MAIN'S PROPOSAL, AND E1 IS RIGHT.
 *
 * Main had two classes and made an unrecognised code a `DATA_DEFECT` by default — a
 * data defect being an EXPECTED condition, which means forgetting to classify a new
 * code is silent. E1 inverts the residual: a code in neither known set is
 * `UNCLASSIFIED` and alarms at `PROGRAMMING_MISTAKE` severity.
 *
 * The reader sees no difference — all three map to `NOT_SHOWN`. The difference is
 * entirely on the operator's side, which is where the cost of forgetting should land.
 */
export const GEOMETRY_REFUSAL_CLASSES = [
  'DATA_DEFECT',
  'PROGRAMMING_MISTAKE',
  'UNCLASSIFIED',
] as const;
export type GeometryRefusalClass = (typeof GEOMETRY_REFUSAL_CLASSES)[number];

/**
 * The closed vocabulary. AS-13, and AS-E1-7's second half.
 *
 * E1 measured the hole: `refusalCodeOf` tested a SHAPE — `^GEOMETRY_[A-Z0-9_]+$` — so
 * `GEOMETRY_FAKE_CODE_12_34` passed and reached the audit channel verbatim.
 * "Coordinates cannot ride it; integers can." A closed vocabulary is membership, not a
 * pattern, so both lists below are enumerated and anything else is UNCLASSIFIED.
 */
/*
  ── R1's VOCABULARY WAS INVENTED, AND E1 MEASURED IT ──────────────────────

  E1: 39 refusal codes thrown by runtime, 30 absent from the governed vocabulary,
  7 governed codes never thrown. Re-measured across this whole module: 56 thrown,
  46 absent, 8 governed-but-never-thrown.

  The cause is worth stating exactly, because the shape of the mistake is more
  instructive than its size. R1's two lists were written from PLAUSIBLE NAMES rather
  than from what the code actually throws. Seven of the eight are near-misses of real
  codes — `GEOMETRY_CRS_NOT_SUPPORTED` for the real `GEOMETRY_CRS_UNSUPPORTED`,
  `GEOMETRY_RING_NOT_CLOSED` for `GEOMETRY_COORDINATES_NOT_CLOSED`. They read correctly
  and matched nothing.

  IT FAILED LOUD, NOT SILENT, and that is the only reason this was a defect rather than
  an incident: an unrecognised code becomes UNCLASSIFIED, which alarms. But consider
  what that means in operation — EVERY genuine source-side data defect pages an
  operator. The alarm becomes noise, somebody mutes it, and the one alarm that mattered
  is muted with it. A control that cries wolf is a control that has been removed, just
  more slowly.

  ── HOW THE LISTS BELOW WERE BUILT ────────────────────────────────────────

  By extracting every code this module throws and classifying each one deliberately —
  NOT by pasting a grep, which would make the vocabulary a mirror of the code and its
  classification meaningless. The test that keeps them honest is bidirectional and
  reads the source at run time, so a new `throw` fails the suite until somebody decides
  which side of the boundary it belongs on.

  ── WHAT THE TWO CLASSES MEAN, STATED PRECISELY ───────────────────────────

  E1's classes are closed at three, and adding a fourth would be a redesign nobody
  asked for. So the labels are read at their functional meaning, which is ALARM or NOT:

    DATA_DEFECT          a fault on the FAR side of the trust boundary. A source sent
                         something malformed. Expected, routine, does not alarm.

    PROGRAMMING_MISTAKE  a fault on OUR side — our code, or our governed configuration.
                         Not expected. Always alarms.

  A malformed partition declaration is not literally a programming mistake; it is a
  governance authoring error. It sits in the second list because the question the class
  actually answers is "must a human be woken up", and the answer for a malformed
  governed declaration is yes. The widening is deliberate and recorded rather than
  silently assumed.
*/

export const GEOMETRY_PROGRAMMING_MISTAKE_CODES: readonly string[] = Object.freeze([
  /* Coercion and derivation guards — GX-10/GX-11. Our pipeline reshaping geometry. */
  'GEOMETRY_AGGREGATE_OVER_INCOMPLETE_SET',
  'GEOMETRY_COARSENING_COINCIDENT_WITH_PARENT_VERTEX',
  'GEOMETRY_COARSENING_NOT_COARSER',
  'GEOMETRY_COARSENING_WITHOUT_MEASURE',
  'GEOMETRY_COERCION_BASELINE_NOT_NATIVE',
  'GEOMETRY_COERCION_SOURCE_DISAGREES',
  'GEOMETRY_PRESENTED_DERIVATION_NOT_MARKED',
  'GEOMETRY_REPRESENTATIVE_POINT_NOT_MARKED_DERIVED',
  'GEOMETRY_SILENT_RESHAPE',
  'GEOMETRY_SOURCE_CENTROID_IS_NOT_OURS',

  /* Reader-path and projection guards. A reader nearly saw something it must not. */
  'GEOMETRY_PROJECTION_FIELD_SET_OPEN',
  'GEOMETRY_PROJECTION_REFUSES_INTERNAL_DERIVATION',
  'GEOMETRY_PROJECTION_WITHOUT_COORDINATES',
  'GEOMETRY_PROTECTIVE_DERIVATION_ON_READER_PATH',
  'GEOMETRY_SURFACE_NOT_DECLARED',

  /* Governed partition declarations — authoring errors in the authority itself. */
  'GEOMETRY_PARTITION_BESPOKE',
  'GEOMETRY_PARTITION_CLASS_UNDECLARED',
  'GEOMETRY_PARTITION_COVERS_NOTHING',
  'GEOMETRY_PARTITION_DECLARED_TWICE',
  'GEOMETRY_PARTITION_ELIGIBILITY_SHORT',
  'GEOMETRY_PARTITION_FINER_THAN_CLASS',
  'GEOMETRY_PARTITION_MIGRATION_NOOP',
  'GEOMETRY_PARTITION_MIGRATION_UNDATED',
  'GEOMETRY_PARTITION_MINIMUM_TOO_SMALL',
  'GEOMETRY_PARTITION_UNDATED',

  /* Authority lifecycle. Every one of these means the process must not serve. */
  /*
    GA-33's runtime code, governed here although it is thrown by the backend composition
    root rather than by this module. It means the governed rows changed underneath a
    sealed authority — the single condition GA-33 exists to detect — so it must alarm and
    the process must not continue.

    It was found by the vocabulary gate failing to see it, which is why the gate now
    scrapes the backend Humanitarian module as well as `shared/`. A vocabulary scoped
    more narrowly than the runtime is a vocabulary with a blind spot.
  */
  'GEOMETRY_AUTHORITY_DIGEST_DRIFTED',
  'GEOMETRY_AUTHORITY_DIGEST_INVALID',
  'GEOMETRY_AUTHORITY_EMPTY',
  'GEOMETRY_AUTHORITY_EPOCH_INVALID',
  'GEOMETRY_AUTHORITY_EPOCH_REGRESSED',
  'GEOMETRY_AUTHORITY_NOT_INSTALLED',
  'GEOMETRY_AUTHORITY_NOT_THE_INSTALLED_INSTANCE',
  'GEOMETRY_AUTHORITY_TOKEN_ALREADY_ISSUED',
  'GEOMETRY_AUTHORITY_TOKEN_REQUIRED',
  'GEOMETRY_AUTHORITY_UNDATED',

  /* AS-6 / AS-7 governance. A cadence or cohort rule was broken. */
  'GEOMETRY_CADENCE_EPOCH_NOT_UNIFORM',
  'GEOMETRY_CADENCE_GAP_TOO_LARGE',
  'GEOMETRY_CADENCE_LAG_VIOLATED',
  'GEOMETRY_CADENCE_RUN_MISSING',
  'GEOMETRY_COHORT_DERIVATION_INCOMPLETE',
  'GEOMETRY_COHORT_DERIVATION_OBSERVES_US',
  'GEOMETRY_EMERGENCY_COHORT_NOT_ALREADY_DARK',
  'GEOMETRY_EMERGENCY_TARGET_MISSING',
]);

/**
 * The far side of the trust boundary. A source sent something malformed, which is a
 * routine condition in official data and must NOT wake anybody.
 *
 * Note what is deliberately here rather than above: the parent-disagreement and
 * derivation-shape codes. A record arriving with a derivation that does not match its
 * parent is bad INPUT, not our pipeline misbehaving — the pipeline refusing it is the
 * control working.
 */
export const GEOMETRY_DATA_DEFECT_CODES: readonly string[] = Object.freeze([
  'GEOMETRY_ANONYMOUS',
  'GEOMETRY_COORDINATE_LEAF_NOT_FINITE',
  'GEOMETRY_COORDINATE_TYPE_DISAGREES',
  'GEOMETRY_COORDINATES_NOT_AN_OBJECT',
  'GEOMETRY_COORDINATES_NOT_CLOSED',
  'GEOMETRY_CRS_UNSUPPORTED',
  'GEOMETRY_DERIVATION_PARENT_ID_DISAGREES',
  'GEOMETRY_DERIVATION_PARENT_KIND_DISAGREES',
  'GEOMETRY_DERIVED_WITHOUT_METHOD',
  'GEOMETRY_DOMAIN_NOT_REGISTERED',
  'GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN',
  'GEOMETRY_MISSING_COORDINATES',
  'GEOMETRY_NATIVE_WITH_DERIVATION',
  'GEOMETRY_NONE_WITH_COORDINATES',
]);

/**
 * R1's invented codes, retired with the reason each one was wrong.
 *
 * Kept rather than deleted because E1's bidirectional test requires every governed code
 * to be either reachable or "explicitly reserved/deprecated with documented reason" —
 * and because a name that was once in a contract will be searched for again. A reader
 * who finds `GEOMETRY_RING_NOT_CLOSED` in an old document should land here and be told
 * what it became, not find nothing and assume it was removed for a reason.
 */
export const GEOMETRY_RETIRED_REFUSAL_CODES: Readonly<Record<string, string>> = Object.freeze({
  GEOMETRY_KIND_NOT_DECLARED:
    'never thrown. Invented in R1; the real code is GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN.',
  GEOMETRY_CRS_NOT_SUPPORTED: 'never thrown. The real code is GEOMETRY_CRS_UNSUPPORTED.',
  GEOMETRY_COORDINATES_MISSING: 'never thrown. The real code is GEOMETRY_MISSING_COORDINATES.',
  GEOMETRY_SOURCE_ID_EMPTY:
    'never thrown. R3 refuses an empty sourceId as GEOMETRY_ANONYMOUS.',
  GEOMETRY_COORDINATES_FIELD_SET_OPEN:
    'never thrown. The closed-coordinates check refuses as GEOMETRY_COORDINATES_NOT_AN_OBJECT.',
  GEOMETRY_RING_NOT_CLOSED: 'never thrown. The real code is GEOMETRY_COORDINATES_NOT_CLOSED.',
  GEOMETRY_DERIVATION_PARENT_MISMATCH:
    'never thrown. R3 distinguishes GEOMETRY_DERIVATION_PARENT_ID_DISAGREES from ' +
    '..._KIND_DISAGREES, and collapsing them lost the distinction.',
  RENDERER_CANNOT_DRAW_KIND:
    'CATEGORY ERROR, not a near-miss. This is a GeometryWithheldReason — an OUTCOME on a ' +
    'presented record — and never a thrown refusal code. R1 put an outcome in a vocabulary ' +
    'of exceptions.',
});

/**
 * Neither list is a restatement of the other, and the residual is the third class.
 *
 * E1: "The derivation technique is kept — neither list is a restatement of the other —
 * and the residual is inverted so that forgetting to classify is loud rather than
 * quiet."
 */
export function classifyRefusal(refusalCode: string): GeometryRefusalClass {
  if (GEOMETRY_PROGRAMMING_MISTAKE_CODES.includes(refusalCode)) return 'PROGRAMMING_MISTAKE';
  if (GEOMETRY_DATA_DEFECT_CODES.includes(refusalCode)) return 'DATA_DEFECT';
  return 'UNCLASSIFIED';
}

/** UNCLASSIFIED alarms at the same severity as a programming mistake. AS-E1-7. */
export function refusalClassAlarms(refusalClass: GeometryRefusalClass): boolean {
  return refusalClass !== 'DATA_DEFECT';
}

export const UNCLASSIFIED_REFUSAL_CODE = 'GEOMETRY_UNCLASSIFIED_REFUSAL';

/**
 * AS-13 · THE CODE EXTRACTOR, now closed.
 *
 * Takes the code ONLY — the portion before the first colon — and admits it only if it
 * is a MEMBER of one of the two enumerated sets. A foreign string is classified, never
 * interpolated, which is the rule the snapshot contract's C-4 already states for
 * provider error text; the difference here is that "classified" now means "found in a
 * list" rather than "matched a pattern".
 */
export function refusalCodeOf(error: unknown): string {
  if (!(error instanceof Error)) return UNCLASSIFIED_REFUSAL_CODE;
  const head = error.message.split(':')[0] ?? '';
  if (GEOMETRY_PROGRAMMING_MISTAKE_CODES.includes(head)) return head;
  if (GEOMETRY_DATA_DEFECT_CODES.includes(head)) return head;
  return UNCLASSIFIED_REFUSAL_CODE;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · GX-23 — THE AUDIT CHANNEL, AS-E1-8
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * E1 measured the collision precisely: GA-8 required the protective-derivation refusal
 * to be LOUD, GX-19 required a per-record failure to be ISOLATED, R3 implemented GX-19
 * with an unconditional `catch {` — the right mechanism — and swallowed GA-8 doing it.
 *
 * GX-19 wins, and E1 says why: isolation is the SECURITY property, loudness is an
 * OPERABILITY property, and a reader-visible throw was itself the GX-18 channel. So the
 * signal is restored on a channel the reader cannot observe, and reader-facing behaviour
 * does not change by one byte.
 */

/**
 * AS-E1-8 §1 · `reason` IS NARROWED TO `'RECORD_REFUSED'`.
 *
 * E1 measured that Main's type permitted `{ recordKey, reason: 'PROTECTED' }` — and
 * that pair IS the protected fact, written into a general application log. The sink is
 * only ever called for an isolated refusal, so the type was wider than its use, and the
 * widening was the one pairing that must never be logged.
 *
 * Narrowing the type is what makes it unwritable rather than merely discouraged.
 */
export interface GeometryAuditDetailR1 {
  readonly reason: 'RECORD_REFUSED';
  readonly refusalCode: string;
  readonly refusalClass: GeometryRefusalClass;
  readonly recordKey: string;
  readonly authorityEpoch: number;
}

export interface GeometryRefusalSink {
  record(detail: GeometryAuditDetailR1): void;
  /** AS-12 · an all-refusing set is reported as a refusal, never as a quiet zero. */
  recordSetOutcome(summary: {
    readonly total: number;
    readonly refused: number;
    readonly authorityEpoch: number;
  }): void;
}

export const NO_OP_REFUSAL_SINK: GeometryRefusalSink = Object.freeze({
  record(): void {
    /* intentionally empty */
  },
  recordSetOutcome(): void {
    /* intentionally empty */
  },
});

/**
 * AS-E1-8 §2 · AS-11 IS ENFORCED AT THE CALL SITE, NOT REQUESTED OF THE IMPLEMENTER.
 *
 * E1: "`record()` is invoked inside its own try/catch that swallows. The doc asks the
 * implementer not to throw; A REQUEST IS NOT A GUARANTEE, and a throwing sink inside the
 * GX-19 catch would change reader cardinality — the exact thing AS-11 exists to prevent."
 *
 * So every emission in this system goes through these two functions, and they are the
 * enforcement. A sink that throws is contained here; the reader never learns it existed.
 */
export function emitRefusal(sink: GeometryRefusalSink, detail: GeometryAuditDetailR1): void {
  try {
    sink.record(detail);
  } catch {
    /*
      Deliberately empty, and this is the one place in this codebase where that is the
      correct code. The alternative — letting a broken audit sink propagate — converts an
      observability outage into a reader-visible change in cardinality, which is a
      security regression caused by a logging bug.
    */
  }
}

export function emitSetOutcome(
  sink: GeometryRefusalSink,
  summary: { readonly total: number; readonly refused: number; readonly authorityEpoch: number },
): void {
  try {
    sink.recordSetOutcome(summary);
  } catch {
    /* AS-11, same reasoning as above. */
  }
}

/**
 * Build the detail from a caught error. The single place a thrown error becomes audit.
 *
 * AS-E1-8 §3 — what is absent is the point: no `sourceId`, no `sourceGeometryId`, no
 * coordinates, no class id, no partition key, and no exception text. `GA-48` asserts
 * that for every refusal mode the serialized detail contains none of them.
 */
export function auditDetailFor(
  error: unknown,
  recordKey: string,
  authorityEpoch: number,
): GeometryAuditDetailR1 {
  const refusalCode = refusalCodeOf(error);
  return {
    reason: 'RECORD_REFUSED',
    refusalCode,
    refusalClass: classifyRefusal(refusalCode),
    recordKey,
    authorityEpoch,
  };
}
