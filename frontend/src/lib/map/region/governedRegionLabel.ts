import { governedRegionLabelKey } from '@/lib/map/navigation/breadcrumbs';
import type { RegionSelection } from '@/lib/map/region/regionSelection';

/**
 * MAP-PL-ACTIVE-REGION-LABEL-1 — a governed region is NAMED BY THE DICTIONARY.
 *
 * `RegionSelection.name` is whatever the resolver produced. For a gazetteer
 * node that is G's published name and is correct in any locale. For a DECLARED
 * PRODUCT REGION it is the declaration's `label` — data in one language — and
 * rendering it to a Polish reader is how "EAST AFRICA" appeared on the active
 * chip beside a control already reading "AFRYKA WSCHODNIA".
 *
 * So a governed region is renamed from the localised breadcrumb targets, which
 * is where every reader-facing place name on this surface already lives.
 *
 * IT NEVER BLANKS AND NEVER INVENTS. A region with no jump-target key, or a
 * locale missing that entry, keeps the name it had.
 *
 * Lives in `lib` rather than in the shell because it is a pure function over
 * data, and because a spec that imported it from the shell would drag
 * maplibre's stylesheet into a node-environment test.
 */
export function localisedGovernedRegion(
  region: RegionSelection | null,
  selectionId: string,
  targets: Readonly<Record<string, string>>,
): RegionSelection | null {
  if (region === null) return region;

  const key = governedRegionLabelKey(selectionId);
  const localised = key === null ? undefined : targets[key];

  return localised === undefined ? region : { ...region, name: localised };
}
