import {
  assertGeometryIsWellFormed,
  GEOMETRY_CRS,
  GEOMETRY_DATA_DEFECT_CODES,
  GEOMETRY_PROGRAMMING_MISTAKE_CODES,
  refusalCodeOf,
  type GeometryDenotation,
  type KeyedGeometry,
  type SourceAssertedGeometry,
  type SourceGeometryKind,
} from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COPERNICUS EMS — ORDINARY INUNDATION EXTENT PRODUCER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * G-HUMANITARIAN-COPERNICUS-PRODUCER-R1.
 *
 *     E1: HUMANITARIAN PRODUCER IMPLEMENTATION = CLEARED
 *         HUMANITARIAN PRODUCER ACTIVATION     = NOT CLEARED
 *
 * IMPLEMENTED AND DISABLED. There is no scheduled job, no Alpha fetch and no Production
 * fetch, and `assertActivationPermitted` refuses unconditionally while activation is not
 * cleared — so the disabled state is a property of the code rather than of a config file
 * somebody has to remember not to change.
 *
 * ── AND NO WRITE PATH, DELIBERATELY ───────────────────────────────────────
 *
 * E1's clearance carries one condition: *"PA-E1-1 lands before the producer's first write
 * path is wired."* PA-E1-1 is the column-level GRANT that stops a producer role from
 * blanking `protection_class_id` and `presentation_partition_key` on a governed record —
 * E1 executed that attack and it succeeded with `UPDATE 1`.
 *
 * So this producer RETURNS evidence and stores nothing. There is no repository, no
 * Prisma client and no SQL anywhere in this module, and a test asserts their absence. The
 * write path is the next lane's, after PA-E1-1.
 *
 * ── WHY THIS CANDIDATE, AND ONLY THIS ONE ─────────────────────────────────
 *
 * E1's ten cases rank an ordinary inundation polygon as case 2, SAFE_FOR_EXACT
 * (extent only) — the only case with NO classification dependency, which is why it can be
 * built while the S-1/S-2 classifier does not exist. No other Humanitarian provider is
 * touched by this lane.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · RIGHTS — CARRIED, NEVER BROADENED
 * ══════════════════════════════════════════════════════════════════════════ */

export const COPERNICUS_SOURCE_ID = 'COPERNICUS_EMS';
export const COPERNICUS_DOMAIN_ID = 'HUMANITARIAN';

/**
 * G's measured state, reproduced verbatim and NOT widened by this lane.
 *
 * The grant enumerates ACTS — reproduction, distribution, communication to the public,
 * adaptation, and any combination — under "free, full and open access". The word
 * "commercial" does not appear on the terms page, so the reading stays conditional and
 * this producer claims nothing beyond it.
 */
export const COPERNICUS_RIGHTS = Object.freeze({
  sourceId: COPERNICUS_SOURCE_ID,
  rightsClass: 'E-5 CONDITIONAL' as const,
  instrument:
    'Copernicus EMS On-Demand Mapping Terms and Conditions, read verbatim in ' +
    'G-HUMANITARIAN-DATA-READINESS-R1: "free, full and open access to Copernicus Service ' +
    'Information"; permitted acts (a) reproduction (b) distribution (c) communication to the ' +
    'public (d) adaptation, modification and combination (e) any combination of (a) to (d).',
  conditions: Object.freeze([
    'Commercial use is NOT expressly named on the terms page. The reading stays CONDITIONAL and is a Product Owner confirmation item.',
    'Attribution per the Copernicus Citation Guidelines is required; the verbatim string has NOT been retrieved, and reworded attribution is not attribution.',
    'Article 53 of Regulation (EU) 2021/696 restricts some activations. Never publish an activation inventory, and never publish "no activation here" — the gaps would be the sensitive ones.',
    'Third-party data reached through the portal may carry different licence terms and must be separated at ingestion.',
    'Products are stated to be "for information purposes only".',
  ]),
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · ACTIVATION — OFF, AND REFUSED IN CODE
 * ══════════════════════════════════════════════════════════════════════════ */

export const COPERNICUS_PRODUCER_ENABLED = false as const;

/** E1's ruling, as a constant a test can read rather than a sentence in a comment. */
export const HUMANITARIAN_PRODUCER_ACTIVATION = 'NOT_CLEARED' as const;

export class ProducerNotActivated extends Error {}

export function assertActivationPermitted(): never {
  throw new ProducerNotActivated(
    'HUMANITARIAN_PRODUCER_NOT_ACTIVATED: E1 ruled HUMANITARIAN PRODUCER ACTIVATION = NOT CLEARED. ' +
      'Implementation is cleared; execution is not. There is no flag that changes this, because a ' +
      'flag is what gets changed.',
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · PROTECTION AUTHORITY — CONSUMED, NEVER DECIDED
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * GX-3 · `protectionClassId` is assigned UPSTREAM from a declared class and is NEVER
 * computed from the geometry. GX-17(f) · every record carries a partition key, including
 * unprotected ones, because a key only protected-adjacent records carry is itself a flag.
 *
 * Both therefore arrive from the authority system through this port. This producer holds
 * no class id, no partition key and no rule for choosing either — a test asserts that no
 * literal of either kind appears in this module.
 */
export interface GovernedRecordKeying {
  /**
   * @returns the keys the authority system assigns to this source record, or `null` when
   *   it declines to key it — in which case the record is WITHHELD, never defaulted.
   */
  keyFor(input: { readonly sourceId: string; readonly sourceGeometryId: string }):
    | { readonly recordKey: string; readonly presentationPartitionKey: string; readonly protectionClassId?: string }
    | null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · THE SOURCE PAYLOAD — ONLY WHAT EMS ACTUALLY PUBLISHES
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * An EMS delineation feature, reduced to the fields this producer reads.
 *
 * NOTHING IS INVENTED. There is no population field, no severity, no access state, no
 * impact count and no classification anywhere in this type, because an observed-event
 * delineation publishes none of them — and a producer that carried a place to put them
 * would eventually have something put there.
 */
export interface EmsDelineationFeature {
  /** The activation code, e.g. an EMSR number. Publisher-supplied. */
  readonly activationCode: string;
  /** The product/layer identifier within the activation. Publisher-supplied. */
  readonly productId: string;
  readonly featureId: string;
  /** The publisher's own geometry type string, verbatim. */
  readonly geometryType: string;
  /** The publisher's CRS string, verbatim. */
  readonly crs: string;
  readonly coordinates: unknown;
}

export interface EmsDelineationPayload {
  readonly features: readonly EmsDelineationFeature[];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4a · REFUSAL VOCABULARY — GOVERNED WHERE IT EXISTS, LOCAL ONLY WHERE IT DOES NOT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * R1 declared four local codes. Three of them duplicated governed semantics and one
 * of them collapsed four governed codes into a single word, which is worse than a
 * duplicate: `GEOMETRY_MALFORMED` erased the distinction between a non-finite leaf, a
 * disagreeing type, a non-object carrier and missing coordinates — distinctions the
 * governed vocabulary draws deliberately.
 *
 * E1 has already measured what an ungoverned vocabulary costs: 39 codes thrown, 30 in
 * neither governed list, 7 listed and never thrown — and seven of the eight near-misses
 * READ CORRECTLY AND MATCHED NOTHING (`GEOMETRY_CRS_NOT_SUPPORTED` for the real
 * `GEOMETRY_CRS_UNSUPPORTED`). It failed loud rather than silent, and that is the only
 * reason it was a defect rather than an incident — but every genuine source defect then
 * pages an operator, and *a control that cries wolf is a control that has been removed,
 * just more slowly.*
 *
 * So this producer does not name codes. It BORROWS them, through a checked lookup that
 * fails at module load if the governed vocabulary ever renames one.
 */

/**
 * Take a code from the governed vocabulary, or refuse to start.
 *
 * This is the whole anti-drift mechanism and it runs at import time: a rename in the
 * governed lists breaks the module immediately, instead of producing a plausible string
 * that matches nothing and alarms forever.
 */
function governedCode(code: string): string {
  if (!GEOMETRY_DATA_DEFECT_CODES.includes(code) && !GEOMETRY_PROGRAMMING_MISTAKE_CODES.includes(code)) {
    throw new Error(
      `COPERNICUS_REFUSAL_CODE_NOT_GOVERNED: '${code}' is in neither governed list. A producer ` +
        'may not invent a refusal code, and a near-miss of a real one is the exact failure E1 measured.',
    );
  }
  return code;
}

/** A feature whose kind this domain does not emit. The governed code says exactly that. */
export const CODE_KIND_NOT_EMITTED_BY_DOMAIN = governedCode('GEOMETRY_KIND_NOT_DECLARED_BY_DOMAIN');

/** A foreign CRS. Governed, and deliberately NOT spelled `..._NOT_SUPPORTED`. */
export const CODE_CRS_UNSUPPORTED = governedCode('GEOMETRY_CRS_UNSUPPORTED');

/**
 * THE ONE GENUINELY PRODUCER-SPECIFIC STATE, named rather than smuggled.
 *
 * "The authority system declined to key this record" is not a data defect — the source
 * is fine — and it is not a programming mistake. It is also none of the four governed
 * WITHHELD reasons: it is not the renderer's inability, not the source publishing NONE,
 * not PROTECTED, and not a record the contract refused. It is a producer-side state with
 * no governed equivalent, so it is declared here and flagged as local, which is the
 * opposite of quietly reusing a governed code that nearly fits.
 */
export const PRODUCER_SPECIFIC_WITHHELD_CODES = ['RECORD_NOT_KEYED_BY_AUTHORITY'] as const;
export type ProducerSpecificWithheldCode = (typeof PRODUCER_SPECIFIC_WITHHELD_CODES)[number];

/**
 * The same list, widened by ASSIGNMENT rather than by a cast.
 *
 * `readonly ['X']`.includes(someString) does not typecheck, and the obvious repair is
 * `as readonly string[]` — a cast, in a file whose own test asserts it contains none. An
 * annotated assignment widens it with the compiler still checking, which is the
 * difference between narrowing something and asserting something.
 */
const PRODUCER_SPECIFIC_CODE_SET: readonly string[] = PRODUCER_SPECIFIC_WITHHELD_CODES;

/**
 * R1.2 · A THIRD ORIGIN, BECAUSE THE SECOND ONE WAS BECOMING A LIE.
 *
 * `UNGOVERNED` is not a new vocabulary. It is the honest answer to "which vocabulary did
 * this code come from" when the answer is NEITHER — and after GX-24/GX-25 landed, that
 * is the answer for every structural refusal. See `originOf` below and G-R12-C1 in the
 * report: the six structural codes are in neither governed list, so AS-13's closed
 * extractor returns `GEOMETRY_UNCLASSIFIED_REFUSAL` for all of them.
 *
 * R1.1 asserted the origin AT EACH CALL SITE, which is how a label drifts from the thing
 * it labels: the code changed underneath and the hand-written 'GOVERNED' stayed. It is
 * now DERIVED from membership, so it cannot disagree with the lists it describes.
 */
export type WithheldCodeOrigin = 'GOVERNED' | 'PRODUCER_SPECIFIC' | 'UNGOVERNED';

/** Which vocabulary a code actually belongs to. Measured, never asserted. */
export function originOf(code: string): WithheldCodeOrigin {
  if (GEOMETRY_DATA_DEFECT_CODES.includes(code) || GEOMETRY_PROGRAMMING_MISTAKE_CODES.includes(code)) {
    return 'GOVERNED';
  }
  if (PRODUCER_SPECIFIC_CODE_SET.includes(code)) {
    return 'PRODUCER_SPECIFIC';
  }
  return 'UNGOVERNED';
}

export interface WithheldRecord {
  readonly sourceGeometryId: string;
  /** A governed refusal code, or the one declared producer-specific code. */
  readonly code: string;
  /** Which vocabulary the code came from. A reader never has to guess. */
  readonly codeOrigin: WithheldCodeOrigin;
}

export interface ProducerResult {
  readonly emitted: readonly KeyedGeometry[];
  readonly withheld: readonly WithheldRecord[];
}

/**
 * The only geometry kinds an inundation extent may be.
 *
 * WITHHOLD RATHER THAN TRANSFORM. A feature that is not polygonal is dropped with a
 * reason; it is never converted, simplified, or reduced to something drawable. The
 * prohibited coercions — polygon to point, to centroid, to a scalar radius, to a halo —
 * are absent by construction: there is no code in this module that reads a coordinate
 * and produces a different geometry.
 */
const POLYGONAL: readonly SourceGeometryKind[] = ['POLYGON', 'MULTIPOLYGON'];

/** The declared emission set, for a domain registry and for the spec to read. */
export const COPERNICUS_EMITS: readonly SourceGeometryKind[] = POLYGONAL;

/**
 * An inundation extent is the area that is flooded. `AFFECTED_AREA` is the denotation
 * that says so.
 *
 * It is NOT `OBSERVATION_FOOTPRINT` — that is the sensor's coverage, a different claim —
 * and it is emphatically not `SOURCE_REPORTED_CENTROID` or
 * `DERIVED_REPRESENTATIVE_POINT`, which are the two denotations that would let a polygon
 * arrive wearing a point's clothes.
 */
export const COPERNICUS_DENOTATION: GeometryDenotation = 'AFFECTED_AREA';

/**
 * The two kinds this producer emits, as a narrowed type — so the carrier lookup below
 * needs no cast. R1 narrowed with `as` at the call site; a cast that is correct today is
 * a cast nobody re-checks tomorrow.
 */
type PolygonalKind = Extract<SourceGeometryKind, 'POLYGON' | 'MULTIPOLYGON'>;

function polygonalKindOf(publisherType: string): PolygonalKind | null {
  const t = publisherType.trim().toLowerCase();
  if (t === 'polygon') return 'POLYGON';
  if (t === 'multipolygon') return 'MULTIPOLYGON';
  return null;
}

/**
 * GX-12 · the contract's coordinate carrier is a CLOSED object — exactly `type` and
 * `coordinates`, and nothing else, because "an extra property is a channel". R3 measured
 * a synthetic `exactSiteName` riding all the way to the wire through an open shape.
 *
 * Building that carrier is not a transformation of the geometry. The publisher's
 * coordinate value is placed into it BY REFERENCE and is never copied, reordered,
 * rounded or rebuilt — a test asserts identity, not equality. `type` carries the
 * GeoJSON spelling the contract requires for the kind, which is a property of the
 * carrier rather than a claim about the shape.
 */
const CARRIER_TYPE: Readonly<Record<PolygonalKind, string>> = Object.freeze({
  POLYGON: 'Polygon',
  MULTIPOLYGON: 'MultiPolygon',
});

/**
 * Build one source-native geometry, or withhold.
 *
 * `origin` is `SOURCE_NATIVE` and there is no branch that sets `DERIVED`: this producer
 * has no derivation to declare, so it declares none rather than declaring an empty one.
 */
function withhold(sourceGeometryId: string, code: string): WithheldRecord {
  return { sourceGeometryId, code, codeOrigin: originOf(code) };
}

export function produceInundationExtents(
  payload: EmsDelineationPayload,
  keying: GovernedRecordKeying,
): ProducerResult {
  const emitted: KeyedGeometry[] = [];
  const withheld: WithheldRecord[] = [];

  for (const feature of payload.features) {
    const sourceGeometryId = `${feature.activationCode}/${feature.productId}/${feature.featureId}`;

    const kind = polygonalKindOf(feature.geometryType);
    if (kind === null) {
      withheld.push(withhold(sourceGeometryId, CODE_KIND_NOT_EMITTED_BY_DOMAIN));
      continue;
    }

    if (feature.crs !== GEOMETRY_CRS) {
      // No reprojection. A producer that reprojects is a producer that moves coordinates.
      withheld.push(withhold(sourceGeometryId, CODE_CRS_UNSUPPORTED));
      continue;
    }

    const geometry: SourceAssertedGeometry = {
      kind,
      denotation: COPERNICUS_DENOTATION,
      origin: 'SOURCE_NATIVE',
      crs: GEOMETRY_CRS,
      coordinates: {
        type: CARRIER_TYPE[kind],
        coordinates: feature.coordinates,
      },
      sourceId: COPERNICUS_SOURCE_ID,
      sourceGeometryId,
      relationToAssertion: 'THE_ASSERTION',
    };

    try {
      // The accepted contract's own check, called rather than re-implemented.
      assertGeometryIsWellFormed(geometry);
    } catch (error) {
      /*
        THE CONTRACT'S OWN CODE SURVIVES.

        `refusalCodeOf` is the governed extractor, and it is closed: a foreign string
        becomes `GEOMETRY_UNCLASSIFIED_REFUSAL` rather than riding through. Recording
        what the contract actually threw keeps four distinct facts distinct — a
        non-finite leaf, a disagreeing type, a non-object carrier and missing
        coordinates — where R1 collapsed all four into one invented word.
      */
      /*
        R1.2 · AND TODAY THIS COMES BACK UNGOVERNED. G-R12-C1.

        GX-24/GX-25 throw six codes that are in neither governed list, so AS-13's closed
        extractor collapses all six to `GEOMETRY_UNCLASSIFIED_REFUSAL` — and UNCLASSIFIED
        alarms at programming-mistake severity (AS-E1-7). An unclosed ring from a
        publisher is the commonest real source defect there is, and it currently pages an
        operator.

        Nothing is worked around here. The producer records what the governed extractor
        returned and labels its origin truthfully; the repair is an amendment to the
        governed lists, which is Main's and E1's to make, not a producer's.
      */
      withheld.push(withhold(sourceGeometryId, refusalCodeOf(error)));
      continue;
    }

    const keys = keying.keyFor({ sourceId: COPERNICUS_SOURCE_ID, sourceGeometryId });
    if (keys === null) {
      // The authority declined to key it. WITHHELD — never defaulted to an unprotected key.
      withheld.push(withhold(sourceGeometryId, 'RECORD_NOT_KEYED_BY_AUTHORITY'));
      continue;
    }

    emitted.push({
      recordKey: keys.recordKey,
      geometry,
      emittingDomainId: COPERNICUS_DOMAIN_ID,
      presentationPartitionKey: keys.presentationPartitionKey,
      ...(keys.protectionClassId === undefined
        ? {}
        : { protectionClassId: keys.protectionClassId }),
    });
  }

  return { emitted, withheld };
}
