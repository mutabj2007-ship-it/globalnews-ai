/**
 * SHARED SPATIAL GEOMETRY CONTRACT — R3.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT R3 CHANGES, AND WHY EACH CHANGE IS THE SAME CHANGE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * E1's R2 review closed fourteen conditions and held four. All four have one
 * shape, and it is the shape R2 itself named:
 *
 *     "A rule that lives in a parameter list cannot be forgotten by a caller
 *      who has not read the comment."
 *
 * R2 applied that to capability and to the protection class, and then left the
 * PARTITION as a list on a caller-supplied context. E1 wrote the four-line caller
 * that recomputes it from the request and reopens the oracle exactly:
 *
 *     const parts = [...new Set(records.filter(isProtected).map(r => r.partitionKey))];
 *
 * That is E1-P-11 again with a different field, and the answer is the same answer:
 * remove the parameter.
 *
 *   GX-17  partitionIsProtected(partitionKey, registry) — receives NO record list,
 *          NO request, NO set. PresentationContext drops the array and carries a
 *          governed registry, loaded the same way protectedClasses already is.
 *          A partition is dark FROM DECLARATION, so a 0 -> 1 arrival announces
 *          nothing; scope is never finer than the class; minimum membership is
 *          declared, >= 2, and measured against DECLARED ELIGIBILITY rather than
 *          observed contents; the unit is pre-existing and public, never bespoke;
 *          every record carries a key; assignment moves only by whole-partition
 *          migration, and PartitionMigration has no record field to move one with.
 *
 *   GX-18  protection resolves BEFORE any validation that can throw. R2 validated
 *          first, so a protected POLYGON threw while a protected POINT returned
 *          NOT_SHOWN — the record's kind readable through the error channel, the
 *          one channel the two reader tokens do not cover. GX-10 is about what is
 *          DRAWN; a withheld record is not drawn, so validating it buys nothing and
 *          costs a channel. Nothing still reaches RENDER_* without full validation.
 *
 *   GX-19  a per-record failure is isolated. R2 mapped presentOne over the input,
 *          so one malformed record returned ZERO outcomes for the whole set —
 *          two innocent records vanishing because of a third, which is a
 *          membership change a reader can cause and observe.
 *
 *   GX-20  a stored DERIVED record is presentable. R2's native branch passed a
 *          record as its own coercion baseline, and the guard's first check refused
 *          it. That is the defect R2 found in its own first draft, one level up:
 *          a guard keyed on the wrong property, right in the case it was written
 *          for and wrong beside it. A guard that over-refuses is still a wrong guard.
 *
 * And one thing R3 does NOT do: it does not manufacture a path to make
 * PROTECTIVE_COARSENING measurable. See §2. The capability is HELD and the claim
 * is withdrawn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * R2, PRESERVED — every one of these was re-verified by E1 against R2's bytes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND WHAT DID NOT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE THREE AXES ARE UNCHANGED. Precision, geometry representation and denotation
 * remain independent and are never inferred from one another. The precision ladder
 * is not reopened. `rendersAsPoint` and `haloRadiusKmWithGeometry` keep the scope
 * HG-R-1 and HG-R-2 gave them. E1 confirmed all of this and asked for none of it back.
 *
 * WHAT CHANGED IS EXPOSURE, which R1 explicitly declined to decide and handed to E1.
 * E1 returned `HOLD — GEOMETRY EXPOSURE` with sixteen conditions. Every one of the
 * eight measured defects behind that HOLD was re-executed against R1's own compiled
 * bytes in this lane before a line of R2 was written — see
 * `evidence/G1-R1-DEFECTS-REPRODUCED.txt`. E1 was right on all eight.
 *
 * THE SHAPE OF THE REPAIR, IN ONE SENTENCE: R1 stated its safety properties and left
 * them to call sites; R2 removes the call sites that could get them wrong.
 *
 *   - `presentGeometry` is no longer exported. The only reader entry point is
 *     `presentGeometrySet`, so "call the set wrapper" stops being a convention.
 *   - `presentGeometrySet` does not take a capability. It takes a SURFACE ID and
 *     looks the capability up in a frozen module-level registry, so there is no
 *     parameter through which a role-dependent capability can enter.
 *   - Protection is resolved from a class id assigned upstream, by a function whose
 *     parameter list contains no geometry, so protection cannot be computed from the
 *     payload it is protecting.
 *   - Nothing serializes a `SourceAssertedGeometry`. `readerProjection` produces a
 *     closed field set and is the only wire form.
 *
 * This is the same enforcement-by-absence the accepted Market and Entity contracts
 * use: a rule that lives in a parameter list cannot be forgotten by a caller who has
 * not read the comment.
 *
 * NOT ACTIVATED BY THIS FILE: no provider, no Copernicus, no renderer change, no
 * route, no storage. GX-14 remains CONTRACTED and UNMEASURED — there is still no
 * geometry store and no reader API, and R3 does not introduce one. Production HOLD.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE THREE AXES — UNCHANGED FROM R1
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SOURCE_GEOMETRY_KINDS = [
  'NONE',
  'POINT',
  'MULTIPOINT',
  'LINE',
  'MULTILINE',
  'POLYGON',
  'MULTIPOLYGON',
  'BBOX',
] as const;

export type SourceGeometryKind = (typeof SOURCE_GEOMETRY_KINDS)[number];

export const GEOMETRY_DENOTATIONS = [
  'EVENT_LOCATION',
  'AFFECTED_AREA',
  'ADMINISTRATIVE_UNIT',
  'ASSET_OR_FACILITY',
  'OBSERVATION_FOOTPRINT',
  'ANALYSIS_EXTENT',
  'SOURCE_REPORTED_CENTROID',
  'DERIVED_REPRESENTATIVE_POINT',
] as const;

export type GeometryDenotation = (typeof GEOMETRY_DENOTATIONS)[number];

export const GEOMETRY_ORIGINS = ['SOURCE_NATIVE', 'DERIVED'] as const;
export type GeometryOrigin = (typeof GEOMETRY_ORIGINS)[number];

export const GEOMETRY_CRS = 'EPSG:4326' as const;
export type GeometryCrs = typeof GEOMETRY_CRS;

/**
 * GX-12 · OPAQUE IS NOT THE SAME AS CLOSED.
 *
 * R1 typed coordinates as `unknown`, and E1-P-8 measured the consequence: an object
 * carrying arbitrary extra properties survived well-formedness and presentation
 * verbatim. Reproduced in this lane — a synthetic `exactSiteName` rode all the way
 * to the wire.
 *
 * This is a STRUCTURE check and nothing more. It defines no coordinate algebra, no
 * winding rule, no simplification and no reprojection. Those remain out of scope and
 * belong to the first consumer that needs one.
 *
 * GX-24 · R4 widened "structure" by exactly one step: for the kinds whose GeoJSON type
 * is polygonal, a linear ring must be a linear ring. Closure is an equality between two
 * positions the source already published; it computes nothing, rounds nothing and
 * reverses nothing, so it is not the coordinate algebra this paragraph excludes. Winding
 * still is, and stays excluded — see GX-24 and POLYGON_WINDING_VALIDATION.
 */
export interface GeometryCoordinateValue {
  readonly type: string;
  readonly coordinates: unknown;
}

/** GeoJSON `type` for each kind. 'NONE' carries no coordinates and so has no entry. */
const COORDINATE_TYPE_FOR_KIND: Readonly<Partial<Record<SourceGeometryKind, string>>> =
  Object.freeze({
    POINT: 'Point',
    MULTIPOINT: 'MultiPoint',
    LINE: 'LineString',
    MULTILINE: 'MultiLineString',
    POLYGON: 'Polygon',
    MULTIPOLYGON: 'MultiPolygon',
    BBOX: 'Polygon',
  });

function everyLeafIsFinite(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => everyLeafIsFinite(v, depth + 1));
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1a · GX-24 · A LINEAR RING IS A RING — SOURCE-NATIVE STRUCTURAL VALIDITY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * R3 shipped `assertCoordinatesAreClosed`, and the name says CLOSED because the
 * property it enforced was a closed OBJECT — exactly `type` and `coordinates`, because
 * an extra property is a channel. It said nothing about a closed RING, and the first
 * Copernicus producer reported the consequence (HP-B2) rather than inventing a local
 * rule to cover it. Reproduced against the accepted R3 bytes: an unclosed exterior ring,
 * an unclosed interior ring, a two-position ring, a polygon with no rings, an unclosed
 * BBOX, a position of one number, a ring that is not an array, and the scalar
 * `coordinates: 7` all satisfied `assertGeometryIsWellFormed` and presented as
 * RENDER_NATIVE.
 *
 * The rule added here is drawn from RFC 7946 and takes only its MUSTs:
 *
 *   MUST   a linear ring has four or more positions          §3.1.6
 *   MUST   the first and last positions are equivalent       §3.1.6
 *   MUST   a position has two or more numbers                §3.1.1
 *   SHOULD exterior rings are counterclockwise               §3.1.6  — NOT enforced
 *   SHOULD a position carries at most three numbers          §3.1.1  — NOT enforced
 *
 * Taking the MUSTs and leaving the SHOULDs is one rule rather than a list of tastes,
 * and it is what makes the winding answer a derivation instead of a preference.
 *
 * WHICH KINDS. Nothing here names POLYGON, MULTIPOLYGON or BBOX. The dispatch reads the
 * GeoJSON type that COORDINATE_TYPE_FOR_KIND already requires for the kind, so BBOX is
 * covered because its type is 'Polygon', and a kind added later is covered the moment it
 * is given a polygonal type. A second list of polygonal kinds would drift from the first
 * one the day a kind was added, invisibly, because both would look correct in isolation.
 *
 * NO REPAIR. A ring that does not close is refused, never closed for the publisher. An
 * appended coordinate is a coordinate the source never published, and a geometry we
 * completed is indistinguishable downstream from one that arrived complete. The refusal
 * codes below are ordinary GEOMETRY_* codes, so the accepted per-record catch in
 * `presentGeometrySet` turns each into WITHHELD / RECORD_REFUSED and the reader sees
 * NOT_SHOWN — the same absence a protected or undrawable record produces, which is GX-1.
 *
 * ── GX-25 · THE KIND AND THE COORDINATE STRUCTURE MUST AGREE ──────────────────────
 *
 * A declared kind is a claim about the SHAPE of the coordinate tree, and R3 checked only
 * half of that claim: `GEOMETRY_COORDINATE_TYPE_DISAGREES` compares the carrier's `type`
 * string with the kind, and nothing compared the NESTING. A MULTIPOLYGON carrying
 * Polygon-shaped coordinates therefore passed the type check and then met the ring rules
 * one level too shallow.
 *
 * Measured against the R4 bytes before this rule was written: every such mismatch was
 * already REFUSED — nothing leaked — but each was reported as a RING defect. That is a
 * false statement about the data. The rings were correct; the nesting was not.
 *
 * So the depth check runs FIRST, and has its own code. Four normalisations are named and
 * refused, each because it would make a record that is a defect indistinguishable from a
 * record that arrived correct:
 *
 *   appending a closure point   a coordinate we added that the source never published
 *   dropping a ring             a hole silently filled in, and GX-5 says a hole is a position
 *   selecting the largest part  a MULTIPOLYGON reduced to a POLYGON, which is a different
 *                               claim about the world made in our voice
 *   changing the kind           the declaration rewritten to match the bytes, so the
 *                               disagreement that IS the defect is erased by recording it
 *
 * None of the four is implemented anywhere in this module, and the proofs assert their
 * absence by behaviour rather than by search.
 */

/** GX-24 · RFC 7946 §3.1.6. Three distinct positions and a repeat of the first. */
export const MINIMUM_LINEAR_RING_POSITIONS = 4;

/** GX-24 · RFC 7946 §3.1.1. Longitude and latitude. A third number is tolerated. */
export const MINIMUM_POSITION_COMPONENTS = 2;

/**
 * GX-24 · WINDING IS INTENTIONALLY OUTSIDE ALPHA VALIDATION, AND THIS CONSTANT IS THE
 * DECLARATION OF THAT — IT IS NOT A CONTROL.
 *
 * Read with GX-15: a constant that records a decision may not be cited as enforcement.
 * It is exported so that the decision is visible to a reader of the module rather than
 * only to a reader of a review document, exactly as PROTECTIVE_COARSENING_PRESENTATION
 * records a capability that is held rather than absent.
 *
 * Four reasons, in the order they decide it:
 *
 *   1. RFC 7946 §3.1.6 states the right-hand rule as SHOULD, and then instructs parsers
 *      not to reject polygons that do not follow it. Refusing on winding would be
 *      stricter than the format the data is published in.
 *   2. Deciding a ring's winding requires a signed area — arithmetic over the
 *      coordinates, with a sign convention and a zero case. That is the coordinate
 *      algebra GX-12 excludes; ring closure is an equality between two published
 *      positions and is not.
 *   3. The two available responses are both refused elsewhere in this contract. Reversing
 *      a ring is a silent repair. Withholding on winding discards source-faithful data
 *      over a convention that changes no coordinate.
 *   4. It would be unreachable. MAP_ALPHA is ['NONE','POINT'] and MAP_RICH is not
 *      mounted, so no polygon reaches a reader surface today; an Alpha winding rule would
 *      be a rule no proof could exercise. Ring closure is reachable — the producer path
 *      and INTERNAL_AUDIT both exercise it.
 *
 * If a renderer ever needs a winding guarantee it is that surface's normalisation to
 * make and to declare, on a derived geometry marked DERIVED, never a source-native
 * admission gate.
 */
export const POLYGON_WINDING_VALIDATION = 'OUTSIDE_ALPHA_VALIDATION' as const;

/**
 * GX-24 · the refusal codes this rule can produce. Five distinguishable defects, not one
 * collapsed MALFORMED, because A-24 holds here too: an absence that is a source that
 * published no ring is not an absence that is a source that published an open one.
 *
 * None is a PROGRAMMING_MISTAKE. Each is a statement about bytes a publisher sent, so
 * each classifies as DATA_DEFECT under the accepted authority contract's default — which
 * is the safety rule this round was asked for, and it needs no edit there to hold.
 */
export const POLYGON_RING_REFUSAL_CODES = Object.freeze([
  'GEOMETRY_POLYGON_STRUCTURE_INVALID',
  'GEOMETRY_POLYGON_EMPTY',
  'GEOMETRY_COORDINATE_STRUCTURE_DISAGREES_WITH_KIND',
  'GEOMETRY_RING_TOO_FEW_POSITIONS',
  'GEOMETRY_POSITION_TOO_FEW_COMPONENTS',
  'GEOMETRY_RING_NOT_CLOSED',
] as const);

export type PolygonRingRefusalCode = (typeof POLYGON_RING_REFUSAL_CODES)[number];

/**
 * One ring. Every message names indices and lengths only: no coordinate value is ever
 * interpolated into a refusal, because AS-13 measured a thrown message carrying
 * coordinates out of a lane's own fixture.
 */
function assertRingIsALinearRing(ring: unknown, where: string): void {
  if (!Array.isArray(ring)) {
    if (typeof ring === 'number') {
      // The declared kind expects a ring here and the source supplied a coordinate.
      // The coordinates are one nesting level SHALLOWER than the kind declares.
      throw new Error(
        `GEOMETRY_COORDINATE_STRUCTURE_DISAGREES_WITH_KIND: ${where} is a number, not a ` +
          'ring. The coordinates are nested one level shallower than the declared kind ' +
          'requires. The kind is not rewritten to match the coordinates.',
      );
    }
    throw new Error(
      `GEOMETRY_POLYGON_STRUCTURE_INVALID: ${where} is not an array of positions.`,
    );
  }

  /* GX-25 · DEPTH BEFORE RING RULES.
   *
   * Every element of a ring must be a POSITION — an array whose own elements are
   * numbers. Checking that first is what makes the ring codes truthful: a MULTIPOLYGON
   * whose coordinates are Polygon-shaped has perfectly good rings at the wrong depth,
   * and reporting it as GEOMETRY_RING_TOO_FEW_POSITIONS sends an operator to look for a
   * ring defect that does not exist. A-24 again: two distinguishable defects must not
   * collapse into one code, and the wrong one of the two is worse than a coarse one. */
  for (let i = 0; i < ring.length; i += 1) {
    const position: unknown = ring[i];
    if (!Array.isArray(position)) {
      if (typeof position === 'number') {
        throw new Error(
          `GEOMETRY_COORDINATE_STRUCTURE_DISAGREES_WITH_KIND: ${where} element ${i} is a ` +
            'number where a position is required. The coordinates are nested one level ' +
            'shallower than the declared kind requires.',
        );
      }
      throw new Error(
        `GEOMETRY_POLYGON_STRUCTURE_INVALID: ${where} position ${i} is not an array.`,
      );
    }
    for (let c = 0; c < position.length; c += 1) {
      if (Array.isArray(position[c])) {
        throw new Error(
          `GEOMETRY_COORDINATE_STRUCTURE_DISAGREES_WITH_KIND: ${where} position ${i} ` +
            `component ${c} is itself an array. The coordinates are nested at least one ` +
            'level deeper than the declared kind requires. The kind is not rewritten to ' +
            'match the coordinates, and no ring is dropped to make them fit.',
        );
      }
    }
  }

  if (ring.length < MINIMUM_LINEAR_RING_POSITIONS) {
    throw new Error(
      `GEOMETRY_RING_TOO_FEW_POSITIONS: ${where} has ${ring.length} positions; a linear ` +
        `ring has at least ${MINIMUM_LINEAR_RING_POSITIONS}.`,
    );
  }
  for (let i = 0; i < ring.length; i += 1) {
    const position = ring[i] as readonly unknown[];
    if (position.length < MINIMUM_POSITION_COMPONENTS) {
      throw new Error(
        `GEOMETRY_POSITION_TOO_FEW_COMPONENTS: ${where} position ${i} carries ` +
          `${position.length}; a position carries at least ${MINIMUM_POSITION_COMPONENTS}.`,
      );
    }
  }
  const first = ring[0] as readonly unknown[];
  const last = ring[ring.length - 1] as readonly unknown[];
  if (first.length !== last.length) {
    throw new Error(
      `GEOMETRY_RING_NOT_CLOSED: ${where} opens with ${first.length} components and ` +
        `closes with ${last.length}.`,
    );
  }
  for (let c = 0; c < first.length; c += 1) {
    if (first[c] !== last[c]) {
      throw new Error(
        `GEOMETRY_RING_NOT_CLOSED: ${where} does not close — component ${c} of the last ` +
          'position differs from the first. The contract does not append the first ' +
          'position to close it: a coordinate we added is a coordinate the source never ' +
          'published.',
      );
    }
  }
}

/** One polygon: a non-empty list of rings, each independently valid. */
function assertPolygonIsLinearRings(polygon: unknown, where: string): void {
  if (!Array.isArray(polygon)) {
    throw new Error(
      `GEOMETRY_POLYGON_STRUCTURE_INVALID: ${where}coordinates are not an array of rings.`,
    );
  }
  if (polygon.length === 0) {
    throw new Error(
      `GEOMETRY_POLYGON_EMPTY: ${where}carries no ring. A record that means "no geometry" ` +
        'declares kind NONE; an empty coordinate array is a second, undeclared way to say it.',
    );
  }
  for (let i = 0; i < polygon.length; i += 1) {
    assertRingIsALinearRing(polygon[i], `${where}ring ${i}`);
  }
}

/**
 * GX-24 · dispatch on the GeoJSON type the kind already requires. A non-polygonal type
 * returns without a rule: a LineString is not a ring and must not be asked to close.
 */
function assertPolygonalStructure(geoJsonType: string, coordinates: unknown): void {
  if (geoJsonType === 'Polygon') {
    assertPolygonIsLinearRings(coordinates, '');
    return;
  }
  if (geoJsonType === 'MultiPolygon') {
    if (!Array.isArray(coordinates)) {
      throw new Error(
        'GEOMETRY_POLYGON_STRUCTURE_INVALID: coordinates are not an array of polygons.',
      );
    }
    if (coordinates.length === 0) {
      throw new Error(
        'GEOMETRY_POLYGON_EMPTY: carries no polygon. A record that means "no geometry" ' +
          'declares kind NONE; an empty coordinate array is a second, undeclared way to say it.',
      );
    }
    for (let i = 0; i < coordinates.length; i += 1) {
      assertPolygonIsLinearRings(coordinates[i], `polygon ${i} `);
    }
  }
}

/**
 * GX-12. Exactly the own properties `type` and `coordinates`, `type` agreeing with
 * `kind`, every leaf a finite number. Anything else is refused.
 *
 * GX-24. And, for a polygonal type, every ring in every polygon is a linear ring. The
 * check lives HERE rather than beside it, and is not separately exported, so there is no
 * function a caller can reach that validates a polygon's coordinates and skips its rings.
 * A rule that lives in a second function cannot be forgotten only by a caller who read
 * the comment; a rule that lives in the only entry point cannot be forgotten at all.
 *
 * ORDER IS PRESERVED. The ring check runs LAST, after the finite-leaf check, so every
 * value R3 refused is still refused with the code R3 used. This function's existing
 * behaviour is a strict subset of its new behaviour.
 */
export function assertCoordinatesAreClosed(kind: SourceGeometryKind, value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('GEOMETRY_COORDINATES_NOT_AN_OBJECT: coordinates must be an object.');
  }
  const names = Object.getOwnPropertyNames(value).sort();
  if (names.length !== 2 || names[0] !== 'coordinates' || names[1] !== 'type') {
    throw new Error(
      `GEOMETRY_COORDINATES_NOT_CLOSED: own properties are [${names.join(', ')}]; ` +
        'exactly [coordinates, type] are permitted. An extra property is a channel.',
    );
  }
  const v = value as GeometryCoordinateValue;
  const expected = COORDINATE_TYPE_FOR_KIND[kind];
  if (expected === undefined || v.type !== expected) {
    throw new Error(
      `GEOMETRY_COORDINATE_TYPE_DISAGREES: kind '${kind}' requires type '${String(expected)}', got '${String(v.type)}'.`,
    );
  }
  if (!everyLeafIsFinite(v.coordinates)) {
    throw new Error(
      'GEOMETRY_COORDINATE_LEAF_NOT_FINITE: every coordinate leaf must be a finite number.',
    );
  }
  assertPolygonalStructure(expected, v.coordinates);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · DERIVATION — ONE LIST, AND THE READER SET IS DERIVED FROM IT
 * ═══════════════════════════════════════════════════════════════════════════ */

export const GEOMETRY_DERIVATION_METHODS = [
  'CENTROID_OF_PARENT',
  'POINT_ON_SURFACE_OF_PARENT',
  'BOUNDING_BOX_OF_PARENT',
  /** Coarsened for protection. INTERNAL AND AUDIT SURFACES ONLY — GX-2. */
  'PROTECTIVE_COARSENING',
] as const;

export type GeometryDerivationMethod = (typeof GEOMETRY_DERIVATION_METHODS)[number];

export const PROTECTIVE_DERIVATION_METHOD: GeometryDerivationMethod = 'PROTECTIVE_COARSENING';

/**
 * GX-22 · THE CLAIM IS WITHDRAWN, AND NO PATH IS MANUFACTURED TO RESTORE IT.
 *
 * R2 offered `GA-8-neg` as the negative control proving GX-2's internal permission
 * works. E1 instrumented it with a call counter and found `deriveFor` invoked
 * ZERO times on INTERNAL_AUDIT, because that surface supports every kind and the
 * derivation branch is reached only when it cannot draw one. Across 15
 * surface × kind combinations, PROTECTIVE_COARSENING was presented 0 times.
 * The probe passed because nothing happened — R-D.
 *
 * R3 could make it reachable by declaring an internal surface that cannot draw a
 * polygon. R3 does not, for a reason that is not procedural:
 *
 *     AN INTERNAL SURFACE AUTHORISED TO SEE THE FULL GEOMETRY HAS NOTHING TO GAIN
 *     FROM A COARSENED SUBSTITUTE, AND ONE NOT SO AUTHORISED MUST WITHHOLD UNDER
 *     GX-2. There is no honest consumer between those two, so a surface declared
 *     to reach this branch would exist only to be measured.
 *
 * So the DERIVATION PATH is held, not fixed. The METHOD survives as a LABEL for a
 * record a producer or store has already coarsened, which is the role E1 kept it
 * for — and labelling stored data is not the same as producing a substitute at
 * presentation time. `assertNotACoercion`'s coarseness machinery stays, unreached
 * from the exported surface and honestly marked so, because it is what a future
 * authorised path would need and rewriting it later from memory would be worse.
 */
export const PROTECTIVE_COARSENING_PRESENTATION = 'HELD_UNREACHABLE_BY_DESIGN' as const;

/**
 * GX-2 · A PROTECTIVELY COARSENED GEOMETRY IS NEVER PRESENTED TO A READER.
 *
 * E1's argument, and it is the one that will be argued with: labelling is what makes
 * a derivation honest, and for a PROTECTIVE derivation the honest label IS the
 * oracle. "This record had a geometry we are hiding" is exactly the fact protection
 * exists to withhold, and a class-level trigger does not make that uninformative
 * about the individual. The two requirements cannot both hold, so protection is
 * expressed as WITHHOLDING and never as a labelled substitute.
 *
 * DERIVED, NOT RESTATED. A second hand-written list drifts from the first the moment
 * a fourth honest derivation is added — silently, because both lists look correct in
 * isolation. This is the technique the Entity contract's E-1 narrowing uses for the
 * same reason, and the mutation that replaces a derivation with a literal is a known
 * biting mutation there.
 */
export const READER_PRESENTABLE_DERIVATION_METHODS: readonly GeometryDerivationMethod[] =
  GEOMETRY_DERIVATION_METHODS.filter((m) => m !== PROTECTIVE_DERIVATION_METHOD);

export function derivationMayReachAReader(method: GeometryDerivationMethod): boolean {
  return READER_PRESENTABLE_DERIVATION_METHODS.indexOf(method) !== -1;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE GEOMETRY RECORD — UNCHANGED SHAPE
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SourceAssertedGeometry {
  readonly kind: SourceGeometryKind;
  readonly denotation: GeometryDenotation;
  readonly origin: GeometryOrigin;
  readonly crs: GeometryCrs;
  /** Absent only when `kind` is 'NONE'. */
  readonly coordinates?: GeometryCoordinateValue;

  /** Who published it, as the source registry names them. Never a hostname. */
  readonly sourceId: string;
  /**
   * The source's own identifier for this geometry, where it has one.
   * GX-8 · SERVER-ONLY. It is an upstream handle that may be resolvable at the
   * publisher, which means it can return the geometry we withheld.
   */
  readonly sourceGeometryId?: string;

  readonly relationToAssertion: 'THE_ASSERTION' | 'CONTEXT';

  /** Required when `origin` is 'DERIVED'. GX-8 · the parent handle is server-only. */
  readonly derivation?: {
    readonly method: GeometryDerivationMethod;
    readonly derivedFromKind: SourceGeometryKind;
    readonly derivedFromSourceGeometryId?: string;
    /**
     * GX-11(5) · the declared measure by which a PROTECTIVE_COARSENING claims to be
     * coarser than its parent. Required for that method, meaningless for the others.
     */
    readonly coarseningMeasure?: CoarseningMeasure;
  };
}

export const COARSENING_MEASURES = ['VERTEX_COUNT', 'BOUNDING_BOX_EXTENT'] as const;
export type CoarseningMeasure = (typeof COARSENING_MEASURES)[number];

/* ═══════════════════════════════════════════════════════════════════════════
 * 4 · WELL-FORMEDNESS — UNCHANGED RULES, PLUS THE CLOSED COORDINATE CHECK
 * ═══════════════════════════════════════════════════════════════════════════ */

export function assertGeometryIsWellFormed(g: SourceAssertedGeometry): void {
  if (g.crs !== GEOMETRY_CRS) {
    throw new Error(`GEOMETRY_CRS_UNSUPPORTED: '${g.crs}'. Only ${GEOMETRY_CRS} is admitted.`);
  }
  if (g.kind === 'NONE' && g.coordinates !== undefined) {
    throw new Error('GEOMETRY_NONE_WITH_COORDINATES: kind NONE carries no coordinates.');
  }
  if (g.kind !== 'NONE' && g.coordinates === undefined) {
    throw new Error(`GEOMETRY_MISSING_COORDINATES: kind '${g.kind}' requires coordinates.`);
  }
  if (g.kind !== 'NONE') {
    assertCoordinatesAreClosed(g.kind, g.coordinates);
  }
  if (g.sourceId === '') {
    throw new Error('GEOMETRY_ANONYMOUS: every geometry names the source that published it.');
  }
  if (g.origin === 'DERIVED' && g.derivation === undefined) {
    throw new Error(
      'GEOMETRY_DERIVED_WITHOUT_METHOD: a derived geometry must name its method and its parent.',
    );
  }
  if (g.origin === 'SOURCE_NATIVE' && g.derivation !== undefined) {
    throw new Error('GEOMETRY_NATIVE_WITH_DERIVATION: source-native geometry has no derivation.');
  }
  if (
    g.origin === 'DERIVED' &&
    g.derivation !== undefined &&
    g.derivation.method === PROTECTIVE_DERIVATION_METHOD &&
    g.derivation.coarseningMeasure === undefined
  ) {
    throw new Error(
      'GEOMETRY_COARSENING_WITHOUT_MEASURE: a protective coarsening declares the measure by ' +
        'which it is coarser, or it cannot be checked to have coarsened anything.',
    );
  }
  if (g.denotation === 'DERIVED_REPRESENTATIVE_POINT' && g.origin !== 'DERIVED') {
    throw new Error(
      'GEOMETRY_REPRESENTATIVE_POINT_NOT_MARKED_DERIVED: a point we computed is never source-native.',
    );
  }
  if (g.denotation === 'SOURCE_REPORTED_CENTROID' && g.origin !== 'SOURCE_NATIVE') {
    throw new Error(
      'GEOMETRY_SOURCE_CENTROID_IS_NOT_OURS: SOURCE_REPORTED_CENTROID means the SOURCE reported it. ' +
        'A centroid we computed is DERIVED_REPRESENTATIVE_POINT.',
    );
  }
}

/**
 * GX-15 · THIS IS DOCUMENTATION AND IS NOT A CONTROL.
 *
 * It takes no arguments and returns a constant. The independence DESIGN is correct
 * and E1 endorses it; this FUNCTION may not be cited in any evidence claim as
 * enforcement. Kept because a reviewer reading the module should see that the matrix
 * is total, and a future contributor who wants to forbid a combination has to argue
 * for it here, in public. Renamed nothing; relabelled honestly.
 */
export function precisionAndGeometryAreIndependent(): true {
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5 · PROHIBITED COERCIONS — NOW WITH A CONSUMER
 * ═══════════════════════════════════════════════════════════════════════════ */

export const PROHIBITED_GEOMETRY_COERCIONS = [
  'POLYGON_TO_CENTROID_FOR_RENDERING',
  'POLYGON_TO_POINT_PLUS_RADIUS',
  'MULTIPOLYGON_TO_LARGEST_PART',
  'BBOX_TO_POINT',
  'LINE_TO_ENDPOINT',
  'ANY_GEOMETRY_TO_POINT_TO_SATISFY_A_RENDERER',
] as const;

export type ProhibitedGeometryCoercion = (typeof PROHIBITED_GEOMETRY_COERCIONS)[number];

/**
 * GX-15 noted that the array had no consumer, so naming the coercions had
 * documentary value and was not a control. It has one now: `assertNotACoercion`
 * names the specific coercion it caught, so the array is read at the moment it
 * matters rather than admired at the top of the file.
 */
function coercionNameFor(from: SourceGeometryKind, to: SourceGeometryKind): ProhibitedGeometryCoercion {
  if ((from === 'POLYGON' || from === 'MULTIPOLYGON') && to === 'POINT') {
    return 'POLYGON_TO_CENTROID_FOR_RENDERING';
  }
  if (from === 'MULTIPOLYGON' && to === 'POLYGON') return 'MULTIPOLYGON_TO_LARGEST_PART';
  if (from === 'BBOX' && to === 'POINT') return 'BBOX_TO_POINT';
  if ((from === 'LINE' || from === 'MULTILINE') && to === 'POINT') return 'LINE_TO_ENDPOINT';
  return 'ANY_GEOMETRY_TO_POINT_TO_SATISFY_A_RENDERER';
}

/** Order-stable canonical serialization, for shape equality. No algebra, no rounding. */
function canonicalShape(g: SourceAssertedGeometry): string {
  if (g.coordinates === undefined) return `${g.kind}|NONE`;
  return `${g.kind}|${JSON.stringify(g.coordinates.type)}|${JSON.stringify(g.coordinates.coordinates)}`;
}

function vertexCount(value: unknown, depth = 0): number {
  if (depth > 8) return 0;
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'number') return 1;
    return value.reduce((n: number, v) => n + vertexCount(v, depth + 1), 0);
  }
  return 0;
}

function vertices(value: unknown, out: number[][] = [], depth = 0): number[][] {
  if (depth > 8) return out;
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'number') out.push(value as number[]);
    else value.forEach((v) => vertices(v, out, depth + 1));
  }
  return out;
}

function extentOf(value: unknown): number {
  const vs = vertices(value);
  if (vs.length === 0) return 0;
  const xs = vs.map((v) => v[0] as number);
  const ys = vs.map((v) => v[1] as number);
  return Math.max(...xs) - Math.min(...xs) + (Math.max(...ys) - Math.min(...ys));
}

/**
 * GX-11 · THE COERCION GUARD, REPAIRED AND BOUND.
 *
 * R1 compared `kind` only, was skipped entirely when the presented record was
 * DERIVED, and was never called by the render path. Reproduced in this lane: a
 * same-kind different-shape record, a DERIVED record whose parent kind disagreed,
 * and a record from a different `sourceId` all passed, and `presentGeometry`
 * contained no call to it at all.
 *
 * All four are closed. The fifth — proving a protective coarsening coarsened
 * anything — applies on the internal path only, because GX-2 means such a record
 * can no longer reach a reader.
 *
 * A NOTE ON SCOPE, STATED RATHER THAN SMUGGLED: GX-11(1) and GX-11(5) require
 * COMPARING geometries, and a comparison is arithmetic. This is the one place R2
 * computes anything over coordinates, it is confined to the internal path and to
 * equality/monotonicity, and it defines no reprojection, no winding rule and no
 * simplification. R1's "no algebra" property is narrowed here deliberately and with
 * E1's instruction, not eroded.
 */
export function assertNotACoercion(
  presented: SourceAssertedGeometry,
  sourceNative: SourceAssertedGeometry,
): void {
  // GX-11(3) — the thing being compared against must actually be the source's.
  if (sourceNative.origin !== 'SOURCE_NATIVE') {
    throw new Error(
      'GEOMETRY_COERCION_BASELINE_NOT_NATIVE: the comparison baseline must be the source-native record.',
    );
  }
  if (presented.sourceId !== sourceNative.sourceId) {
    throw new Error(
      `GEOMETRY_COERCION_SOURCE_DISAGREES: presented cites '${presented.sourceId}' and the ` +
        `native record cites '${sourceNative.sourceId}'. A geometry may not change publisher on the way out.`,
    );
  }

  if (presented.origin === 'SOURCE_NATIVE') {
    // GX-11(1) — shape, not only kind.
    if (presented.kind !== sourceNative.kind) {
      throw new Error(
        `GEOMETRY_SILENT_COERCION[${coercionNameFor(sourceNative.kind, presented.kind)}]: ` +
          `presented as SOURCE_NATIVE '${presented.kind}' while the source published ` +
          `'${sourceNative.kind}'. Mark it DERIVED with a method, or do not present it.`,
      );
    }
    if (canonicalShape(presented) !== canonicalShape(sourceNative)) {
      throw new Error(
        'GEOMETRY_SILENT_RESHAPE: presented as SOURCE_NATIVE at the same kind but with different ' +
          'coordinates. A generalised polygon claiming to be the published one is the laundering ' +
          'case this guard is named for.',
      );
    }
    return;
  }

  // GX-11(2) — DERIVED is checked, not skipped.
  const d = presented.derivation;
  if (d === undefined) {
    throw new Error('GEOMETRY_DERIVED_WITHOUT_METHOD: a derived geometry must name its parent.');
  }
  if (d.derivedFromKind !== sourceNative.kind) {
    throw new Error(
      `GEOMETRY_DERIVATION_PARENT_KIND_DISAGREES: claims parent '${d.derivedFromKind}', ` +
        `source published '${sourceNative.kind}'.`,
    );
  }
  if (
    sourceNative.sourceGeometryId !== undefined &&
    d.derivedFromSourceGeometryId !== sourceNative.sourceGeometryId
  ) {
    throw new Error(
      'GEOMETRY_DERIVATION_PARENT_ID_DISAGREES: the derivation names a different parent geometry.',
    );
  }

  // GX-11(5) — internal path only: a coarsening must be provably coarser.
  if (d.method === PROTECTIVE_DERIVATION_METHOD) {
    const measure = d.coarseningMeasure;
    if (measure === undefined) {
      throw new Error('GEOMETRY_COARSENING_WITHOUT_MEASURE: declare the measure or it is unverifiable.');
    }
    const parentVertices = vertices(sourceNative.coordinates?.coordinates);
    const ownVertices = vertices(presented.coordinates?.coordinates);
    for (const own of ownVertices) {
      for (const p of parentVertices) {
        if (own.length === p.length && own.every((c, i) => c === p[i])) {
          throw new Error(
            'GEOMETRY_COARSENING_COINCIDENT_WITH_PARENT_VERTEX: a "coarsening" that lands on a ' +
              'vertex of the thing it is hiding has not coarsened it. R-D: a protection that ' +
              'reports the unmutated result did not fire.',
          );
        }
      }
    }
    const coarser =
      measure === 'VERTEX_COUNT'
        ? vertexCount(presented.coordinates?.coordinates) <
          vertexCount(sourceNative.coordinates?.coordinates)
        : extentOf(presented.coordinates?.coordinates) >
          extentOf(sourceNative.coordinates?.coordinates);
    if (!coarser) {
      throw new Error(
        `GEOMETRY_COARSENING_NOT_COARSER: declared measure '${measure}' does not show the result ` +
          'to be coarser than its parent.',
      );
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6 · PROTECTION — CLASS-LEVEL, DECLARED BEFORE THE DATA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GX-3. A record is protected only by a property shared by every member of a class
 * declared in advance of the observation. Not by a per-record property, not by a
 * classification computed from the incoming payload, and not by anything that could
 * differ between two records a reader sees side by side.
 *
 * E1's reason, restated because it is counter-intuitive: a record coarsened BECAUSE
 * OF SOMETHING ABOUT IT announces that thing by being coarsened. The protection
 * becomes the signal.
 *
 * ENFORCED BY THE PARAMETER LIST. `recordIsProtected` receives a class id and a
 * registry. It receives NO GEOMETRY. There is nowhere for a payload-derived
 * classification to enter, which is the same technique the Entity contract uses to
 * keep an external identifier out of identity minting.
 */

export interface ProtectedClassDeclaration {
  readonly classId: string;
  /** ISO-8601. The declaration must precede the observation it protects. */
  readonly declaredAt: string;
  /** Why this class is protected. Audit-only; never reader-facing. */
  readonly basis: string;
  /**
   * GX-17(c) · the governed unit level at which this class's partitions are
   * declared. A partition FINER than this re-identifies within the class, which
   * is the per-record case wearing a geographic name.
   */
  readonly partitionUnitLevel: PartitionUnitLevel;
}

export interface ProtectedClassRegistry {
  readonly declarations: readonly ProtectedClassDeclaration[];
}

export function recordIsProtected(
  protectionClassId: string | undefined,
  registry: ProtectedClassRegistry,
): boolean {
  if (protectionClassId === undefined) return false;
  return registry.declarations.some((d) => d.classId === protectionClassId);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6b · THE PROTECTIVE PARTITION — GOVERNED, AND QUERY-INDEPENDENT BY SIGNATURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GX-17. R2 carried `partitionsContainingProtectedMembers: readonly string[]` on a
 * caller-supplied context and trusted it. E1 wrote the caller that computes it from
 * the request in four lines and reopened the oracle — and the module could not tell
 * the two callers apart, which is E1-P-11 with a different field.
 *
 * So the array is gone. `partitionIsProtected` takes a KEY and a REGISTRY. There is
 * no parameter through which a record list, a request, a filter or a result set
 * could arrive, which is the same enforcement `recordIsProtected` already has
 * against a payload-derived classification.
 *
 * GX-17(e) · THE LADDER IS PRE-EXISTING PUBLIC UNITS, AND `BESPOKE` IS NAMED SO IT
 * CAN BE REFUSED. A grouping invented to hold protected records has membership that
 * is itself the disclosure: knowing which records share a bespoke partition is
 * knowing which records were grouped for protection. Naming the failure is how the
 * refusal gets a call site instead of a paragraph.
 */

export const PARTITION_UNIT_LEVELS = [
  'BESPOKE',
  'SETTLEMENT',
  'DISTRICT',
  'PROVINCE',
  'COUNTRY',
] as const;

export type PartitionUnitLevel = (typeof PARTITION_UNIT_LEVELS)[number];

/** Coarser is a higher rank. `BESPOKE` is rank 0 and is never permitted. */
const PARTITION_UNIT_RANK: Readonly<Record<PartitionUnitLevel, number>> = Object.freeze({
  BESPOKE: 0,
  SETTLEMENT: 1,
  DISTRICT: 2,
  PROVINCE: 3,
  COUNTRY: 4,
});

export interface ProtectedPartitionDeclaration {
  readonly partitionKey: string;
  /** GX-17(e) · a pre-existing public unit. `BESPOKE` is refused at declaration. */
  readonly unitLevel: PartitionUnitLevel;
  /** GX-17(b) · ISO-8601. Must precede the observation, as GX-3 already requires of the class. */
  readonly declaredAt: string;
  /** GX-17(d) · the Product Owner's number. Never below 2. */
  readonly minimumMembership: number;
  /**
   * GX-17(d) · DECLARED ELIGIBLE membership, not observed contents. A partition that
   * is dark only once it contains something is a partition whose darkness is data:
   * an observer watching across two days learns the day a protected record arrived,
   * and on a humanitarian surface *when* a protected site appeared is often the whole
   * question.
   */
  readonly declaredEligibleMembership: number;
  /** GX-17(c) · the classes this partition covers. */
  readonly coversClassIds: readonly string[];
}

export interface ProtectedPartitionRegistry {
  readonly declarations: readonly ProtectedPartitionDeclaration[];
  /** GX-17(g) · whole-partition migrations only. See `PartitionMigration`. */
  readonly migrations?: readonly PartitionMigration[];
}

/**
 * GX-17(g) · A MIGRATION MOVES A PARTITION, NEVER A RECORD.
 *
 * There is no record field on this type, so a per-record move has nowhere to be
 * expressed — a record that moves between a dark partition and a light one is
 * observable at both ends. Enforcement by absence, again.
 */
export interface PartitionMigration {
  readonly fromPartitionKey: string;
  readonly toPartitionKey: string;
  readonly declaredAt: string;
}

/**
 * GX-17(a) · THE RESOLVER.
 *
 * Receives a key and a registry. No records, no request, no set, no filter.
 * GX-17(b) falls out of the signature: a partition is protected because it was
 * DECLARED, so it is dark before its first protected member arrives and stays dark
 * after the last one leaves. There is nothing here that could observe either event.
 */
export function partitionIsProtected(
  partitionKey: string,
  registry: ProtectedPartitionRegistry,
): boolean {
  return registry.declarations.some((d) => d.partitionKey === partitionKey);
}

/**
 * GX-17(c)(d)(e) · REFUSED AT DECLARATION, WHICH IS THE ONLY MOMENT THE CHECK IS
 * CHEAP AND THE ONLY MOMENT IT IS HONEST.
 *
 * Checking membership at presentation would mean counting the records in front of
 * us, and counting the records in front of us is the whole defect GX-17 exists to
 * close. So every one of these is a property of the DECLARATION.
 */
export function assertProtectedPartitionRegistryIsWellFormed(
  partitions: ProtectedPartitionRegistry,
  classes: ProtectedClassRegistry,
): void {
  const seen = new Set<string>();
  for (const d of partitions.declarations) {
    if (seen.has(d.partitionKey)) {
      throw new Error(
        `GEOMETRY_PARTITION_DECLARED_TWICE: '${d.partitionKey}'. Two declarations can disagree, ` +
          'and the one that wins is whichever the array happens to reach first.',
      );
    }
    seen.add(d.partitionKey);

    // GX-17(e)
    if (d.unitLevel === 'BESPOKE') {
      throw new Error(
        `GEOMETRY_PARTITION_BESPOKE: '${d.partitionKey}' is not a pre-existing public unit. ` +
          'A grouping invented to hold protected records has membership that is itself the ' +
          'disclosure.',
      );
    }

    // GX-17(d)
    if (!Number.isInteger(d.minimumMembership) || d.minimumMembership < 2) {
      throw new Error(
        `GEOMETRY_PARTITION_MINIMUM_TOO_SMALL: '${d.partitionKey}' declares ` +
          `${String(d.minimumMembership)}. A partition of one is a record, and a partition of ` +
          'two identifies a member to anyone who knows the other.',
      );
    }
    if (d.declaredEligibleMembership < d.minimumMembership) {
      throw new Error(
        `GEOMETRY_PARTITION_ELIGIBILITY_SHORT: '${d.partitionKey}' declares eligibility ` +
          `${d.declaredEligibleMembership} against a minimum of ${d.minimumMembership}. ` +
          'Merge it into the next coarser unit until the minimum is met — silently accepting ' +
          'it is how an anonymity set of one gets shipped.',
      );
    }

    // GX-17(c)
    if (d.coversClassIds.length === 0) {
      throw new Error(
        `GEOMETRY_PARTITION_COVERS_NOTHING: '${d.partitionKey}' names no class. A partition ` +
          'whose scope cannot be compared to a class cannot be checked against GX-17(c).',
      );
    }
    for (const classId of d.coversClassIds) {
      const cls = classes.declarations.find((c) => c.classId === classId);
      if (cls === undefined) {
        throw new Error(
          `GEOMETRY_PARTITION_CLASS_UNDECLARED: '${d.partitionKey}' covers '${classId}', ` +
            'which is not a declared protected class.',
        );
      }
      if (PARTITION_UNIT_RANK[d.unitLevel] < PARTITION_UNIT_RANK[cls.partitionUnitLevel]) {
        throw new Error(
          `GEOMETRY_PARTITION_FINER_THAN_CLASS: '${d.partitionKey}' is declared at ` +
            `'${d.unitLevel}' while class '${classId}' is declared at ` +
            `'${cls.partitionUnitLevel}'. A partition finer than its class re-identifies ` +
            'within the class — the per-record case wearing a geographic name.',
        );
      }
    }

    if (d.declaredAt === '') {
      throw new Error(
        `GEOMETRY_PARTITION_UNDATED: '${d.partitionKey}' states no declaration date, so it ` +
          'cannot be shown to precede the observations it protects.',
      );
    }
  }

  for (const m of partitions.migrations ?? []) {
    if (m.fromPartitionKey === m.toPartitionKey) {
      throw new Error('GEOMETRY_PARTITION_MIGRATION_NOOP: a migration that moves nothing.');
    }
    if (m.declaredAt === '') {
      throw new Error('GEOMETRY_PARTITION_MIGRATION_UNDATED: a migration states its date.');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7 · RENDERER CAPABILITY — A BUILD-TIME CONSTANT OF A SURFACE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GX-7. Capability is a module-level constant derived from what a surface can draw,
 * and is not a function of session, role, entitlement, request or a per-request flag.
 *
 * R1 took it as a parameter, and E1-P-11 showed the consequence: a caller writing
 * `mayPresentDerived: isAnalyst` reproduces a role-varying geometry exposure and the
 * module cannot tell. R2 does not take a capability at all — the set API takes a
 * SURFACE ID and resolves the capability from a frozen registry. A role-dependent
 * capability has no parameter to arrive through.
 */

export interface RendererGeometryCapability {
  readonly supports: readonly SourceGeometryKind[];
  readonly mayPresentDerived: boolean;
  /**
   * GX-2 · whether this surface is reachable by a reader. It is the flag the
   * protective-derivation refusal keys on, and it is NOT the same question as
   * `mayPresentDerived`.
   *
   * Conflating the two was a real defect in this file's first draft, caught by its
   * own proofs: keying the refusal on the derivation method alone made a protective
   * coarsening impossible on the INTERNAL_AUDIT surface, where GX-2 explicitly
   * permits it. A guard that over-refuses is still a wrong guard.
   */
  readonly readerFacing: boolean;
}

export const RENDERER_SURFACES = ['MAP_ALPHA', 'MAP_RICH', 'INTERNAL_AUDIT'] as const;
export type RendererSurfaceId = (typeof RENDERER_SURFACES)[number];

/**
 * MAP_ALPHA IS THE CURRENT MAP, DECLARED AS IT ALREADY BEHAVES.
 *
 * `['NONE','POINT']` with `mayPresentDerived: false` is exactly what the Alpha-stable
 * map does today, so this declaration changes no pixel. Richer geometry is additive:
 * a surface that can draw a polygon declares so, and the map is not obliged to.
 */
const SURFACE_CAPABILITIES: Readonly<Record<RendererSurfaceId, RendererGeometryCapability>> =
  Object.freeze({
    MAP_ALPHA: Object.freeze({
      supports: Object.freeze(['NONE', 'POINT'] as const) as readonly SourceGeometryKind[],
      mayPresentDerived: false,
      readerFacing: true,
    }),
    /**
     * DECLARED, NOT MOUNTED. No route consumes this surface and none is proposed here.
     * It is declared because rung 2 of the accepted fallback ladder — "present a
     * derived geometry that says so" — must be expressible on a reader surface for the
     * GX-2 refusal to be provable at all. R-A: a guard nothing can reach has not been
     * shown to bind, and an unreachable guard is exactly the defect E1-P-1 found in R1,
     * where `PROTECTED` was vocabulary rather than behaviour across 160 combinations.
     */
    MAP_RICH: Object.freeze({
      supports: Object.freeze(['NONE', 'POINT'] as const) as readonly SourceGeometryKind[],
      mayPresentDerived: true,
      readerFacing: true,
    }),
    INTERNAL_AUDIT: Object.freeze({
      supports: Object.freeze([...SOURCE_GEOMETRY_KINDS]) as readonly SourceGeometryKind[],
      mayPresentDerived: true,
      readerFacing: false,
    }),
  });

export function capabilityOfSurface(surface: RendererSurfaceId): RendererGeometryCapability {
  const c = SURFACE_CAPABILITIES[surface];
  if (c === undefined) {
    throw new Error(`GEOMETRY_SURFACE_NOT_DECLARED: '${String(surface)}' declares no capability.`);
  }
  return c;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8 · OUTCOMES — INTERNAL VOCABULARY, AND THE TWO READER TOKENS
 * ═══════════════════════════════════════════════════════════════════════════ */

export const GEOMETRY_WITHHELD_REASONS = [
  'RENDERER_CANNOT_DRAW_KIND',
  'SOURCE_PUBLISHED_NONE',
  'PROTECTED',
  /**
   * GX-19 · this record could not be presented, and NO OTHER RECORD IS AFFECTED.
   * Internal and audit only, like the other three. It maps to NOT_SHOWN, which is
   * where SOURCE_PUBLISHED_NONE and PROTECTED already go, so a refusal is not
   * distinguishable from an absence at the trust boundary.
   */
  'RECORD_REFUSED',
] as const;

/** INTERNAL AND AUDIT ONLY — GX-1. This type never crosses the HTTP boundary. */
export type GeometryWithheldReason = (typeof GEOMETRY_WITHHELD_REASONS)[number];

export const READER_ABSENCE_TOKENS = ['NOT_SHOWN', 'NOT_DRAWABLE_HERE'] as const;
export type ReaderAbsenceToken = (typeof READER_ABSENCE_TOKENS)[number];

/**
 * GX-1 · THE SINGLE MOST CONSEQUENTIAL RULING, IMPLEMENTED.
 *
 *   PROTECTED               -> NOT_SHOWN
 *   SOURCE_PUBLISHED_NONE   -> NOT_SHOWN
 *   RENDERER_CANNOT_DRAW_KIND -> NOT_DRAWABLE_HERE
 *
 * `NOT_DRAWABLE_HERE` stays distinguishable deliberately. It is a statement about the
 * SURFACE, uniform across every record of that kind, and it is a coverage disclosure
 * the reader is entitled to. It carries no per-record information, so it is not an
 * oracle — provided a protected record never reaches it, which is why protection is
 * resolved BEFORE capability in `presentGeometrySet`.
 *
 * `NOT_SHOWN` asserts nothing about the source. That removes the false provenance
 * statement R1 made — E1-P-2, reproduced in this lane: `EXACT + NONE`, the contract's
 * own marquee row for "coordinates deliberately withheld", told the reader the source
 * published nothing — while keeping the indistinguishability R1 achieved by accident.
 */
export function readerAbsenceTokenFor(reason: GeometryWithheldReason): ReaderAbsenceToken {
  return reason === 'RENDERER_CANNOT_DRAW_KIND' ? 'NOT_DRAWABLE_HERE' : 'NOT_SHOWN';
}

/**
 * GX-19 · the audit half. An outcome may carry a detail string for the internal and
 * audit surfaces; `readerProjection` never reads it, and `assertReaderProjectionIsClosed`
 * compares sorted own-property names, so it cannot ride to the wire by accident.
 */
export interface GeometryAuditDetail {
  readonly reason: GeometryWithheldReason;
  readonly refusalCode?: string;
}

export type GeometryPresentationOutcome =
  | { readonly outcome: 'RENDER_NATIVE'; readonly geometry: SourceAssertedGeometry }
  | {
      readonly outcome: 'RENDER_DERIVED_LABELLED';
      readonly geometry: SourceAssertedGeometry;
    }
  | { readonly outcome: 'WITHHELD'; readonly reason: GeometryWithheldReason };

/** GX-5 · every outcome carries the record's identity. A hole is a position. */
export interface KeyedPresentationOutcome {
  readonly recordKey: string;
  readonly outcome: GeometryPresentationOutcome;
}

export interface KeyedGeometry {
  readonly recordKey: string;
  readonly geometry: SourceAssertedGeometry;
  /** The domain emitting this record. GX-13 — checked at presentation, not only at ingest. */
  readonly emittingDomainId: string;
  /**
   * GX-3 · assigned upstream from a declared class. NEVER computed from the geometry.
   * Absent means "not a member of any protected class", which is a different fact from
   * "we did not check" — and the registry is what decides, not this field alone.
   */
  readonly protectionClassId?: string;
  /**
   * GX-17(f) · NON-OPTIONAL, AND IT STAYS THAT WAY. Every record carries a key,
   * including unprotected records and records in partitions that will never darken:
   * a key that only protected-adjacent records carry is a flag.
   *
   * GX-17(a) · whether this partition is dark is resolved from the governed registry,
   * never from the set this record arrived in.
   */
  readonly presentationPartitionKey: string;
  /**
   * GX-20 · the stored source-native parent, where the caller holds one. Supplied, the
   * coercion guard runs in full against a real baseline; absent, there is no parental
   * claim to check and `assertGeometryIsWellFormed` has already enforced
   * origin/derivation coherence. R2 passed the record as its own baseline, which is
   * how a legitimately stored DERIVED record became unpresentable.
   */
  readonly sourceNativeParent?: SourceAssertedGeometry;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9 · PER-DOMAIN SUPPORT — GX-13, NOW CONSULTED AT RENDER
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface DomainGeometrySupport {
  readonly domainId: string;
  readonly emits: readonly SourceGeometryKind[];
}

export interface DomainGeometryRegistry {
  readonly domains: readonly DomainGeometrySupport[];
}

export function assertDomainMayEmit(
  support: DomainGeometrySupport,
  kind: SourceGeometryKind,
): void {
  if (!support.emits.includes(kind)) {
    throw new Error(
      `GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN: '${support.domainId}' does not declare '${kind}'.`,
    );
  }
}

function assertDomainDeclaredAtRender(
  registry: DomainGeometryRegistry,
  domainId: string,
  kind: SourceGeometryKind,
): void {
  const support = registry.domains.find((d) => d.domainId === domainId);
  if (support === undefined) {
    throw new Error(
      `GEOMETRY_DOMAIN_NOT_REGISTERED: '${domainId}' declares no geometry support. ` +
        'A producer convention that the render path never consults is not a control.',
    );
  }
  assertDomainMayEmit(support, kind);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10 · THE READER ENTRY POINT — SET-SHAPED, AND THE ONLY DOOR
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface PresentationContext {
  readonly protectedClasses: ProtectedClassRegistry;
  readonly domains: DomainGeometryRegistry;
  /**
   * INTERNAL PATH ONLY. A reader surface passes nothing here; `deriveFor` may not
   * produce a PROTECTIVE_COARSENING for a reader, and GA-8 asserts the refusal is
   * loud rather than a silent withhold.
   */
  readonly deriveFor?: (g: SourceAssertedGeometry) => SourceAssertedGeometry | null;
  /**
   * GX-17(a) · THE ARRAY IS GONE.
   *
   * R2 carried `partitionsContainingProtectedMembers: readonly string[]` here and
   * trusted whatever the caller computed. A governed registry replaces it, loaded from
   * the same place and in the same shape as `protectedClasses` — and the difference is
   * not stylistic: a registry is a declaration, a list is whatever the last four lines
   * of the caller produced.
   */
  readonly protectedPartitions: ProtectedPartitionRegistry;
}

/**
 * NOT EXPORTED — GX-4. R1 exported this, and a set wrapper beside a public per-record
 * function is a convention rather than a control. This tree does not police call
 * sites (E1-P-12, E1-P-15 measured exactly that), so the control is that the other
 * door does not exist.
 */
function presentOne(
  record: KeyedGeometry,
  capability: RendererGeometryCapability,
  context: PresentationContext,
  partitionProtected: boolean,
): GeometryPresentationOutcome {
  const g = record.geometry;

  /*
    GX-18 · PROTECTION RESOLVES FIRST, AND VALIDATES NOTHING ON THE WAY.

    R2 validated before branching, on GX-10's instruction that "the render path
    validates what it draws, before any branch". E1 measured what that cost: two
    records in the same declared protected class, differing only in `kind` —

        POINT    -> {"recordKey":"r","withheld":"NOT_SHOWN"}
        POLYGON  -> THROWS GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN

    Wherever a throw is distinguishable from a normal response — a 500 against a 200,
    a longer latency, an error counter — the protected record's kind and
    well-formedness are readable through the error channel, and the error channel is
    the one channel the two reader tokens do not cover.

    GX-10's requirement is about what is DRAWN. A withheld record is not drawn, so
    validating it buys nothing and costs a channel. Nothing below still reaches
    RENDER_NATIVE or RENDER_DERIVED_LABELLED without full validation.
  */
  if (recordIsProtected(record.protectionClassId, context.protectedClasses) || partitionProtected) {
    return { outcome: 'WITHHELD', reason: 'PROTECTED' };
  }

  // GX-10 · everything that may be drawn is validated, before any drawing branch.
  assertGeometryIsWellFormed(g);
  assertDomainDeclaredAtRender(context.domains, record.emittingDomainId, g.kind);

  if (g.kind === 'NONE') {
    return { outcome: 'WITHHELD', reason: 'SOURCE_PUBLISHED_NONE' };
  }

  if (capability.supports.includes(g.kind)) {
    /*
      GX-20 · A STORED DERIVED RECORD IS PRESENTABLE, AND IS STILL LABELLED DERIVED.

      R2 called `assertNotACoercion(g, g)` here, and the guard's first check is
      `sourceNative.origin !== 'SOURCE_NATIVE'` — so a record legitimately stored with
      `origin: 'DERIVED'`, exactly as the producer rules instruct, threw
      GEOMETRY_COERCION_BASELINE_NOT_NATIVE and could never be shown.

      That is the defect R3's predecessor found in its own first draft, one level up:
      a guard keyed on the wrong property, correct in the case it was written for and
      wrong beside it. A guard that over-refuses is still a wrong guard.

      The coercion guard exists to catch a record claiming to be something its PARENT
      is not. With no parent supplied there is no such claim to check, and
      `assertGeometryIsWellFormed` has already enforced origin/derivation coherence.
      Where a caller does hold the stored parent it passes it, and the guard runs in
      full — which is when it has something to say.
    */
    if (record.sourceNativeParent !== undefined) {
      assertNotACoercion(g, record.sourceNativeParent);
    }
    if (g.origin === 'DERIVED') {
      const method = g.derivation?.method;
      if (
        capability.readerFacing &&
        method !== undefined &&
        !derivationMayReachAReader(method)
      ) {
        throw new Error(
          `GEOMETRY_PROTECTIVE_DERIVATION_ON_READER_PATH: '${method}' is an internal and ` +
            'audit method. A protected record is withheld, never substituted.',
        );
      }
      // A stored derivation is never promoted to NATIVE by the surface's ability to draw it.
      return { outcome: 'RENDER_DERIVED_LABELLED', geometry: g };
    }
    return { outcome: 'RENDER_NATIVE', geometry: g };
  }

  if (capability.mayPresentDerived && context.deriveFor !== undefined) {
    const derived = context.deriveFor(g);
    if (derived !== null) {
      assertGeometryIsWellFormed(derived);
      if (derived.origin !== 'DERIVED') {
        throw new Error('GEOMETRY_PRESENTED_DERIVATION_NOT_MARKED: origin must be DERIVED.');
      }
      // GX-2 / GA-8 · a protective derivation on a reader path is a REFUSAL, loudly,
      // not a quiet withhold — a silent withhold would hide the programming mistake.
      if (
        capability.readerFacing &&
        derived.derivation !== undefined &&
        !derivationMayReachAReader(derived.derivation.method)
      ) {
        throw new Error(
          `GEOMETRY_PROTECTIVE_DERIVATION_ON_READER_PATH: '${derived.derivation.method}' is an ` +
            'internal and audit method. A protected record is withheld, never substituted.',
        );
      }
      assertNotACoercion(derived, g);
      if (!capability.supports.includes(derived.kind)) {
        return { outcome: 'WITHHELD', reason: 'RENDERER_CANNOT_DRAW_KIND' };
      }
      return { outcome: 'RENDER_DERIVED_LABELLED', geometry: derived };
    }
  }

  return { outcome: 'WITHHELD', reason: 'RENDERER_CANNOT_DRAW_KIND' };
}

/**
 * GX-4 · THE ONLY READER ENTRY POINT.
 *
 * Takes a SURFACE ID, not a capability (GX-7). Returns exactly one outcome per input,
 * in input order, each carrying its record key (GX-5, GX-9). Applies SC-2 over a
 * query-independent partition (see §11).
 */
export function presentGeometrySet(
  records: readonly KeyedGeometry[],
  surface: RendererSurfaceId,
  context: PresentationContext,
): readonly KeyedPresentationOutcome[] {
  const capability = capabilityOfSurface(surface);
  return records.map((record) => {
    /*
      GX-19 · A PER-RECORD FAILURE IS ISOLATED.

      R2 mapped `presentOne` over the input, so one throw aborted the map and the set
      returned ZERO outcomes for three records. GA-9's "exactly one outcome per input"
      and GX-5's "a hole is a position" both held only while nothing threw — and there
      are eleven ways to throw. Two innocent records went missing because of a third,
      which is a membership change a reader can cause and observe: the same class as
      GX-17, with a malformed record in place of a protected one.

      A refusal is now that record's outcome and nobody else's. It carries an internal
      reason that audit can distinguish, and it maps to NOT_SHOWN — the same token
      SOURCE_PUBLISHED_NONE and PROTECTED already map to — so a malformed record is not
      distinguishable at the trust boundary from a record with nothing to show.

      A NOTE ON WHAT THIS CATCH MUST NOT BECOME: it is a boundary, not a fallback. It
      returns WITHHELD and never a degraded rendering, so nothing reaches a reader that
      failed validation.
    */
    try {
      return {
        recordKey: record.recordKey,
        outcome: presentOne(
          record,
          capability,
          context,
          partitionIsProtected(record.presentationPartitionKey, context.protectedPartitions),
        ),
      };
    } catch {
      return {
        recordKey: record.recordKey,
        outcome: { outcome: 'WITHHELD', reason: 'RECORD_REFUSED' } as const,
      };
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 11 · THE READER PROJECTION — THE ONLY SERIALIZER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * GX-9. No `SourceAssertedGeometry` is serialized by default. R1 had no projection at
 * all, and E1-P-9 measured the default the bytes encoded: everything leaves the
 * server. Reproduced in this lane — `PROTECTIVE_COARSENING`, `derivedFromKind`,
 * `derivedFromSourceGeometryId`, `sourceGeometryId` and `derivedFrom` all rode to the
 * wire on one `JSON.stringify`.
 *
 * The field set below is CLOSED. `assertReaderProjectionIsClosed` compares sorted own
 * property names rather than spot-checking, so a field added later fails the assertion
 * instead of quietly shipping.
 */

export type ReaderGeometryProjection =
  | {
      readonly recordKey: string;
      readonly render: 'NATIVE';
      readonly kind: SourceGeometryKind;
      readonly denotation: GeometryDenotation;
      readonly origin: GeometryOrigin;
      readonly crs: GeometryCrs;
      readonly coordinates: GeometryCoordinateValue;
      readonly sourceId: string;
      readonly relationToAssertion: 'THE_ASSERTION' | 'CONTEXT';
    }
  | {
      readonly recordKey: string;
      readonly render: 'DERIVED_LABELLED';
      readonly kind: SourceGeometryKind;
      readonly denotation: GeometryDenotation;
      readonly origin: GeometryOrigin;
      readonly crs: GeometryCrs;
      readonly coordinates: GeometryCoordinateValue;
      readonly sourceId: string;
      readonly relationToAssertion: 'THE_ASSERTION' | 'CONTEXT';
      readonly derivationMethod: GeometryDerivationMethod;
    }
  | { readonly recordKey: string; readonly withheld: ReaderAbsenceToken };

const NATIVE_FIELDS = [
  'coordinates',
  'crs',
  'denotation',
  'kind',
  'origin',
  'recordKey',
  'relationToAssertion',
  'render',
  'sourceId',
];
const DERIVED_FIELDS = [...NATIVE_FIELDS, 'derivationMethod'].sort();
const WITHHELD_FIELDS = ['recordKey', 'withheld'];

export function readerProjection(outcome: KeyedPresentationOutcome): ReaderGeometryProjection {
  const o = outcome.outcome;
  if (o.outcome === 'WITHHELD') {
    return { recordKey: outcome.recordKey, withheld: readerAbsenceTokenFor(o.reason) };
  }
  const g = o.geometry;
  if (g.coordinates === undefined) {
    // Unreachable: kind NONE is always WITHHELD above. Refused rather than emitted
    // as a half-populated record, because a projection that can emit an absent
    // required field is a projection whose field set is not closed.
    throw new Error('GEOMETRY_PROJECTION_WITHOUT_COORDINATES: a rendered geometry has coordinates.');
  }
  const base = {
    recordKey: outcome.recordKey,
    kind: g.kind,
    denotation: g.denotation,
    origin: g.origin,
    crs: g.crs,
    coordinates: g.coordinates,
    sourceId: g.sourceId,
    relationToAssertion: g.relationToAssertion,
  } as const;

  if (o.outcome === 'RENDER_NATIVE') {
    return { ...base, render: 'NATIVE' };
  }

  const method = g.derivation?.method;
  if (method === undefined || !derivationMayReachAReader(method)) {
    throw new Error(
      'GEOMETRY_PROJECTION_REFUSES_INTERNAL_DERIVATION: a derivation a reader may not see cannot ' +
        'be projected. Withhold instead.',
    );
  }
  return { ...base, render: 'DERIVED_LABELLED', derivationMethod: method };
}

/** GA-7 · the field set is closed, asserted by comparison rather than by spot-check. */
export function assertReaderProjectionIsClosed(p: ReaderGeometryProjection): void {
  const names = Object.getOwnPropertyNames(p).sort();
  const expected =
    'withheld' in p ? WITHHELD_FIELDS : 'derivationMethod' in p ? DERIVED_FIELDS : NATIVE_FIELDS;
  if (names.length !== expected.length || names.some((n, i) => n !== expected[i])) {
    throw new Error(
      `GEOMETRY_PROJECTION_FIELD_SET_OPEN: got [${names.join(', ')}], expected [${expected.join(', ')}].`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 12 · RECONSTRUCTION — GX-6, EXECUTABLE RATHER THAN NARRATED
 * ═══════════════════════════════════════════════════════════════════════════ */

export const FORBIDDEN_READER_GEOMETRIC_QUANTITIES = [
  'AREA',
  'PERIMETER',
  'LENGTH',
  'SET_BOUNDS',
  'SET_CENTROID',
  'CONVEX_HULL',
  'VERTEX_COUNT',
  'INTERSECTION',
  'UNION',
  'DIFFERENCE',
  'DISTANCE_BETWEEN_MEMBERS',
  'BEARING_BETWEEN_MEMBERS',
  'COUNT_OF_MEMBERS_CARRYING_GEOMETRY',
] as const;

export type ForbiddenReaderGeometricQuantity =
  (typeof FORBIDDEN_READER_GEOMETRIC_QUANTITIES)[number];

/**
 * GX-6. No reader-facing surface computes, serves, caches or exposes any of the above
 * over a set containing a protected, coarsened or withheld member.
 *
 * SET_BOUNDS and VERTEX_COUNT are named in the list because they are the two most
 * often missed: a set's bounding box shrinks when a protected member is removed and
 * grows when it is present, and a vertex count distinguishes a real polygon from a
 * coarsened one without showing either.
 *
 * This is a callable guard rather than a paragraph, so the rule has a call site the
 * first route that wants an aggregate must pass through.
 */
export function assertNoGeometricAggregateOverSet(
  quantity: ForbiddenReaderGeometricQuantity,
  outcomes: readonly KeyedPresentationOutcome[],
): void {
  /*
    GX-6(b) · A DERIVED STAND-IN IS A COARSENED MEMBER BY CONSTRUCTION.

    R2 tested `anyWithheld` only, so SET_BOUNDS over a set whose members are all
    RENDER_DERIVED_LABELLED was permitted — and GX-6 names "protected, coarsened or
    withheld". A set's bounds computed over stand-ins is an aggregate over coarsened
    geometry wearing the shape of an aggregate over real one.
  */
  const anyIncomplete = outcomes.some(
    (o) => o.outcome.outcome === 'WITHHELD' || o.outcome.outcome === 'RENDER_DERIVED_LABELLED',
  );
  if (anyIncomplete) {
    throw new Error(
      `GEOMETRY_AGGREGATE_OVER_INCOMPLETE_SET: '${quantity}' may not be computed over a set with a ` +
        'withheld or derived member. The complement rule from AR-1 applies unchanged: an aggregate may be ' +
        'served only where the same aggregate is served for every class, including the protected ' +
        'one, over the same membership.',
    );
  }
}
