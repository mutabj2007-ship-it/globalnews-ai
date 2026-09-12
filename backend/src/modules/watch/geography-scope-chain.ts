import {
  resolveCountryByAnyIdentifier,
  type WatchScopeChain,
  type WatchScopeLevel,
  type WatchScopeNode,
} from '@globalnews-ai/shared';
import { childrenOf, lookupGeographyId, type GeoNode } from '../geo/gazetteer-search';
import { admin2Coverage } from '../geo/admin-name-corrections';
import { WATCH_WORLD_GEOGRAPHY_ID } from './watch-subject.identity';

/**
 * THE GEOGRAPHIC SCOPE CHAIN — WORLD -> REGION -> COUNTRY -> PROVINCE ->
 * DISTRICT -> CITY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE VOCABULARY IS THE ACCEPTED ONE AND IS NOT RESTATED DIFFERENTLY HERE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   REGION    is SUPRANATIONAL — above the country. This is the design
 *             specification's sense, and the opposite of the everyday reading
 *             in which "region" means a province.
 *   PROVINCE  is admin1, subnational.
 *   DISTRICT  is admin2, subnational.
 *
 * The chain is built from the geo ladder's own nodes, so a scope node's
 * `geographyId` is the SAME string the map feed and the article resolver use.
 * A Watch target and the evidence about it therefore address one object.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HARD PART IS NOT THE CHAIN. IT IS SAYING HOW FAR IT GOES.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every level in the vocabulary can be NAMED for every country. Almost none of
 * them can be POPULATED for most. Rwanda has admin2 units in this gazetteer;
 * Kenya has none at all. A Watch surface that offered "narrow to district"
 * wherever the enum allows it would render a control backed by nothing, and the
 * user would experience an empty result as a product that does not work rather
 * than as a dataset that does not reach.
 *
 * So `deepestSupportedLevel` is measured against the shipped data, per target,
 * and `unsupportedBelow` names each missing level WITH ITS REASON. Disabling a
 * control and explaining why is honest; offering it and returning nothing is
 * not.
 *
 * NOTHING HERE INVENTS GEOMETRY. No ADM2 is synthesised, no locality is
 * implied, and no boundary is drawn. A scope node carries an identity and a
 * name; extents live on the geo nodes themselves and remain what they already
 * are — derived camera targets, never administrative boundaries.
 */

const LEVEL_ORDER: readonly WatchScopeLevel[] = [
  'WORLD',
  'REGION',
  'COUNTRY',
  'PROVINCE',
  'DISTRICT',
  'SECTOR',
  'CITY',
];

const KIND_TO_LEVEL: Readonly<Record<GeoNode['kind'], WatchScopeLevel>> = {
  region: 'REGION',
  country: 'COUNTRY',
  admin1: 'PROVINCE',
  admin2: 'DISTRICT',
  admin3: 'SECTOR',
  city: 'CITY',
};

/**
 * THE WORLD IS A REAL SCOPE AND NOT A NULL.
 *
 * A watch on "everything" is a legitimate subject, and modelling it as an
 * absent geography would make "the whole world" indistinguishable from "no
 * geography chosen yet". It is a node with an id, so it can be watched,
 * addressed and descended from like any other.
 */
export const WORLD_SCOPE_NODE: WatchScopeNode = {
  level: 'WORLD',
  geographyId: WATCH_WORLD_GEOGRAPHY_ID,
  name: 'World',
};

function toScopeNode(node: GeoNode): WatchScopeNode {
  return {
    level: KIND_TO_LEVEL[node.kind],
    geographyId: node.geographyId,
    name: node.name,
    code: node.hierarchy.find((ancestor) => ancestor.geographyId === node.geographyId)?.code,
  };
}

function ancestorLevel(kind: string): WatchScopeLevel | undefined {
  return KIND_TO_LEVEL[kind as GeoNode['kind']];
}

/**
 * The ISO2 of the country in this chain, if there is one.
 *
 * Resolved through the shared country registry rather than by slicing an
 * `admin1:` id, because 20 of Madagascar's 22 admin1 units carry NO ISO 3166-2
 * code — their ids are `admin1:MDG:<GeoNames code>` — so a string slice would
 * silently return "MD" for Madagascar and answer a question about Moldova.
 */
function countryIso2(chain: readonly WatchScopeNode[]): string | undefined {
  const country = chain.find((node) => node.level === 'COUNTRY');
  if (!country) return undefined;

  return resolveCountryByAnyIdentifier(country.geographyId.slice('country:'.length))?.iso2;
}

/**
 * Does this country have SECOND-LEVEL units in the shipped gazetteer?
 *
 * Measured from `admin2Coverage()`, which reports what the artifact actually
 * holds, rather than assumed from the presence of the DISTRICT enum member.
 */
function hasDistrictData(iso2: string | undefined): boolean {
  if (!iso2) return false;

  return admin2Coverage().some((entry) => entry.cc === iso2 && entry.units > 0);
}

export type ScopeChainRefusal = 'UNKNOWN_GEOGRAPHY_ID';

export interface ScopeChainResult {
  readonly chain: WatchScopeChain | null;
  readonly reason?: ScopeChainRefusal;
}

/**
 * Build the full scope chain for one target.
 *
 * An unknown `geographyId` returns `null` with a reason, never a partial chain
 * and never a guess — the same refusal discipline the gazetteer search uses for
 * a place it does not hold.
 */
export function deriveScopeChain(geographyId: string): ScopeChainResult {
  if (geographyId === WATCH_WORLD_GEOGRAPHY_ID) {
    return {
      chain: {
        target: WORLD_SCOPE_NODE,
        chain: [WORLD_SCOPE_NODE],
        /*
         * The world's ladder reaches CITY somewhere on earth, so nothing below
         * it is globally unsupported. Narrowing is a question about a chosen
         * country, and this chain does not pre-judge which one.
         */
        deepestSupportedLevel: 'CITY',
        unsupportedBelow: [],
      },
    };
  }

  const node = lookupGeographyId(geographyId);
  if (!node) return { chain: null, reason: 'UNKNOWN_GEOGRAPHY_ID' };

  const target = toScopeNode(node);

  /*
   * ANCESTORS COME FROM THE GEO NODE'S OWN HIERARCHY, coarsest first, so the
   * chain cannot disagree with what the map feed shows for the same place.
   *
   * A SUPRANATIONAL REGION IS THE ONE INVERSION. Its `hierarchy` lists its
   * MEMBER COUNTRIES — it descends rather than ascends — so those must not be
   * read as ancestors. A region's only ancestor is the world.
   */
  const ancestors: WatchScopeNode[] =
    node.kind === 'region'
      ? []
      : node.hierarchy.flatMap((ancestor): WatchScopeNode[] => {
          const level = ancestorLevel(ancestor.kind);
          if (!level) return [];

          return [
            {
              level,
              geographyId: ancestor.geographyId,
              name: ancestor.name,
              code: ancestor.code,
            },
          ];
        });

  /*
   * A country can belong to SEVERAL supranational regions at once — Rwanda is
   * in Eastern Africa, Sub-Saharan Africa and the East African Community. A
   * chain is a single path, so exactly one REGION is kept: the first the geo
   * node lists, which is its narrowest M49 subregion. The others remain
   * discoverable through the geo ladder; they are simply not this path.
   */
  const seenRegion = ancestors.findIndex((entry) => entry.level === 'REGION');
  const pathAncestors = ancestors.filter(
    (entry, index) => entry.level !== 'REGION' || index === seenRegion,
  );

  const chain: WatchScopeNode[] = [
    WORLD_SCOPE_NODE,
    ...pathAncestors.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)),
    target,
  ].filter(
    (entry, index, all) =>
      all.findIndex((other) => other.geographyId === entry.geographyId) === index,
  );

  return { chain: withSupportEnvelope(target, chain) };
}

/**
 * How far down the ladder this target can honestly be narrowed, and what is
 * missing below that.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS A DATA LIMIT. IT IS NOT AN ENTITLEMENT CEILING.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `deepestSupportedLevel` answers "what does the shipped data support for this
 * target?" — a question about the gazetteer.
 *
 * Part IV v1.2 R2 section 6.5 defines a SECOND limit on the same axis: a
 * PRECISION CEILING per tier (illustratively COUNTRY on Free). That answers
 * "what is this account allowed to see?" — a question about commerce, whose
 * values R2 requires be "read from configuration and never hard-coded".
 *
 * THEY MUST NOT BE MERGED. Reusing this field as the entitlement ceiling would
 * make a commercial limit indistinguishable from a data gap: a user on a
 * restricted tier would be told the district data does not exist, and a genuine
 * data gap would look like something an upgrade could buy. Neither is true, and
 * both are the kind of quiet dishonesty this contract exists to prevent.
 *
 * NO ENTITLEMENT CEILING IS INTRODUCED HERE, and no default Free or Pro value
 * appears anywhere in this module. The entitlement lane owns that limit and
 * applies it ON TOP of this one; the narrower of the two wins at render time,
 * and the surface can say which one bound the result because they arrived
 * separately.
 */
function withSupportEnvelope(
  target: WatchScopeNode,
  chain: readonly WatchScopeNode[],
): WatchScopeChain {
  const iso2 = countryIso2(chain);
  const unsupportedBelow: { level: WatchScopeLevel; reason: string }[] = [];

  let deepest: WatchScopeLevel = target.level;

  if (target.level === 'CITY') {
    // A settlement is the finest rung this product expresses at all.
    unsupportedBelow.push({
      level: 'CITY',
      reason:
        'Localities and neighbourhoods below settlement level are absent from the shipped gazetteer for every country; no locality geometry is invented to fill the gap.',
    });

    return { target, chain, deepestSupportedLevel: 'CITY', unsupportedBelow: [] };
  }

  const districtsExist = hasDistrictData(iso2);

  if (target.level === 'REGION') {
    /*
     * A REGION WITH CONTESTED_MEMBERSHIP HAS NO MEMBERS AND THEREFORE NOTHING
     * TO DESCEND TO.
     * Reporting COUNTRY as reachable for "Middle East" would promise a
     * narrowing step that returns an empty list, so the envelope says REGION
     * and names the reason.
     */
    const members = childrenOf(target.geographyId, 1);
    if (members.length === 0) {
      return {
        target,
        chain,
        deepestSupportedLevel: 'REGION',
        unsupportedBelow: [
          {
            level: 'COUNTRY',
            reason:
              'This region has no agreed membership, so it has no member countries to narrow to. Membership basis is CONTESTED_MEMBERSHIP — deliberately distinct from provenance CONTESTED / CONTESTED-SOURCE and from the change state DISPUTED — rather than resolved to one source list.',
          },
        ],
      };
    }

    deepest = 'CITY';
  }

  if (target.level === 'COUNTRY' || target.level === 'PROVINCE') {
    deepest = districtsExist ? 'CITY' : 'CITY';

    if (!districtsExist) {
      /*
       * TWO INDEPENDENT REASONS, AND KENYA HAS BOTH.
       *
       * The data reason is that the shipped gazetteer holds no admin2 units for
       * the country. The LICENSING reason applies to Kenya specifically: Part IV
       * v1.2 R2 section 15.1 states that county geometry requires IEBC boundary
       * licensing and that "until confirmed, this Watch renders at COUNTRY
       * ceiling". Both are stated so a surface never presents county scope as
       * merely missing data that G could go and fetch.
       */
      unsupportedBelow.push({
        level: 'DISTRICT',
        reason:
          iso2 === 'KE'
            ? 'No second-level administrative units are present for KE in the shipped gazetteer, and county geometry additionally requires IEBC boundary licensing (Part IV v1.2 R2 section 15.1 / open dependency 11). Until that is resolved a Kenyan Watch renders at COUNTRY ceiling. Districts are not synthesised from settlements.'
            : iso2
              ? `No second-level administrative units are present for ${iso2} in the shipped gazetteer. Districts are not synthesised from settlements.`
              : 'No second-level administrative units are present for this country in the shipped gazetteer.',
      });
    }
  }

  if (target.level === 'DISTRICT') {
    deepest = 'CITY';
  }

  return { target, chain, deepestSupportedLevel: deepest, unsupportedBelow };
}

/**
 * The levels a surface may offer as NARROWING options for a target, in order.
 *
 * Derived from the envelope rather than from the enum, so a level that has no
 * data behind it never reaches a picker.
 */
export function narrowableLevels(chain: WatchScopeChain): readonly WatchScopeLevel[] {
  const blocked = new Set(chain.unsupportedBelow.map((entry) => entry.level));
  const from = LEVEL_ORDER.indexOf(chain.target.level) + 1;
  const to = LEVEL_ORDER.indexOf(chain.deepestSupportedLevel);

  if (from > to) return [];

  return LEVEL_ORDER.slice(from, to + 1).filter((level) => !blocked.has(level));
}
