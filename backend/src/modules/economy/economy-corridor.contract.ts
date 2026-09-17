import {
  type EconomyCorridor,
  type EconomyCorridorCapability,
  type EconomyCorridorEndpoint,
  type EconomyCorridorLink,
  assertCorridorIsHonest,
} from '@globalnews-ai/shared';
import type { MapEvidenceGeography } from '../geo/map-feed.contract';

/**
 * ECON-DATA-CONTRACT-ADAPT-1 - THE CORRIDOR ADAPTER, BOUND TO THE ACCEPTED
 * SHARED CONTRACT.
 *
 * The corridor SHAPE - capability vocabulary, link kinds, endpoint reference,
 * chain and the honesty assertion - now comes from shared. What stays here is
 * the one thing that is genuinely backend-local: the RESOLVER'S FULL EVIDENCE
 * PAYLOAD.
 *
 * -- WHY THE SPLIT IS WHERE IT IS ------------------------------------------
 *
 * `EconomyCorridorEndpoint` carries a `geographyId` and `renderable` - the
 * reference a surface needs. `MapEvidenceGeography` carries precision, location
 * provenance, the candidate set, the unresolvable reason and the matched text -
 * the resolver's own output, which is a backend type. Shared carries the
 * reference; the backend carries the evidence. Copying the resolver's payload
 * into shared would be a second representability set for geography evidence,
 * which is the failure this codebase has spent D14 avoiding.
 *
 * So `BackendCorridorEndpoint` below holds the resolver output and DERIVES the
 * shared endpoint from it. Nothing re-states precision or provenance, and the
 * derivation cannot raise either: it reads `place?.geographyId` and
 * `renderable` and nothing else.
 *
 * -- CAPABILITY, MEASURED AND UNCHANGED ------------------------------------
 *
 * `CORRIDOR_SPATIAL_CAPABILITY` keeps the value `ENDPOINT_ONLY`. That is a
 * MEASURED state of this deployment, re-measured on C36 and on the staged
 * contract baseline: the spatial precision ladder is REGION / COUNTRY /
 * PROVINCE / DISTRICT / CITY / EXACT with no line member, the resolver's finest
 * output is one point plus a derived extent, the map feed ships join keys
 * rather than geometry, and no provider returns geometry. MARKET-SOURCE-1
 * corroborated it from the data side as well: every corridor source examined
 * supplies relationship and flow data and none supplies route geometry.
 *
 * The shared contract can express `ROUTE_SUPPORTED`, and has no geometry field
 * to attach a route to - so this value can be raised only by a shared Spatial
 * change with its own authority, never by an edit here.
 */

/** Re-exported for backend consumers so the vocabulary has ONE definition. */
export type CorridorSpatialCapability = EconomyCorridorCapability;

/**
 * The measured state in force. Asserted by test against the shipped spatial
 * contract, so a future geometry capability breaks the test rather than leaving
 * this constant quietly stale.
 */
export const CORRIDOR_SPATIAL_CAPABILITY: EconomyCorridorCapability = 'ENDPOINT_ONLY';

/**
 * ONE ENDPOINT as the BACKEND holds it: the resolver's full evidence, kept
 * whole, plus the role label.
 *
 * An endpoint whose geography did not resolve is KEPT, with the resolver's
 * `renderable: false` intact. Dropping it would silently shorten the chain, and
 * "Red Sea to East African imports" has a real economic meaning while one end
 * is a region the gazetteer cannot resolve.
 */
export interface BackendCorridorEndpoint {
  /** Caller-supplied label for the endpoint's role, e.g. 'ORIGIN_PORT'. */
  readonly role: string;
  /** The resolver's own output, passed through untouched. */
  readonly geography: MapEvidenceGeography;
}

/**
 * Derive the SHARED endpoint from the backend one.
 *
 * Reads two fields and invents nothing. `geographyId` is omitted rather than
 * emptied when the resolver produced no place, because an absent reference and
 * an empty string are different facts.
 */
export function toSharedCorridorEndpoint(
  endpoint: BackendCorridorEndpoint,
): EconomyCorridorEndpoint {
  const geographyId = endpoint.geography.place?.geographyId;

  return {
    role: endpoint.role,
    ...(geographyId === undefined ? {} : { geographyId }),
    renderable: endpoint.geography.renderable,
  };
}

/**
 * Build a corridor under the measured capability, from backend endpoints.
 *
 * The refusal rules are the shared contract's - endpoint count, dangling role,
 * unevidenced link - applied through `assertCorridorIsHonest` rather than
 * re-implemented here. A second copy of those checks would be exactly the
 * duplicate semantics this adaptation exists to remove.
 */
export function buildCorridor(input: {
  corridorId: string;
  label: string;
  endpoints: readonly BackendCorridorEndpoint[];
  chain: readonly EconomyCorridorLink[];
}): EconomyCorridor {
  const corridor: EconomyCorridor = {
    corridorId: input.corridorId,
    label: input.label,
    capability: CORRIDOR_SPATIAL_CAPABILITY,
    endpoints: input.endpoints.map(toSharedCorridorEndpoint),
    chain: input.chain,
  };

  assertCorridorIsHonest(corridor);

  return Object.freeze(corridor);
}
