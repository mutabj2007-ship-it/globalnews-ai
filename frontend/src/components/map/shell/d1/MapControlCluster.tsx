'use client';

import { LOWER_LEFT_CLUSTER, type MapControlId } from '@/lib/map/d1/mapComposition';

/**
 * THE LOWER-LEFT CLUSTER — specification §3d.
 *
 *   "The lower-left cluster carries the globe locator …, then Layers and 3D as
 *    separate controls."
 *
 * The ORDER is the contract, so this component does not hard-code it: it reads
 * `LOWER_LEFT_CLUSTER` and renders whatever the contract says, in the order the
 * contract says. Re-typing the order here would let the two drift, and the
 * drift would be invisible — three controls in the wrong order still look like
 * three controls.
 *
 * A control the caller does not supply is skipped rather than replaced by a
 * placeholder. Three slots with one empty says something is broken; two
 * controls says two controls.
 */
export interface MapControlClusterProps {
  readonly globeLocator?: JSX.Element | null;
  readonly layers?: JSX.Element | null;
  readonly threeD?: JSX.Element | null;
  readonly label: string;
  /**
   * ══ MAP-LAYERS-EVIDENCE-GRAMMAR-COLLISION-1 ═══════════════════════════
   *
   * MEASURED LIVE: GRAMATYKA DOWODÓW drew over WARSTWY in the lower-left HUD.
   * The cause is structural rather than a bad offset. Three islands shared
   * that corner, each absolutely anchored to the bottom edge and each GROWING
   * UPWARD from its own anchor:
   *
   *     control cluster   bottom-4        (16px)   grows up
   *     scale bar         bottom-[104px]           grows up
   *     evidence legend   bottom-[128px]  z-20     grows up
   *
   * The cluster holds the layers panel — seven 44px rows plus a heading, well
   * past 128px — so it grew straight through both neighbours, and the legend's
   * higher z-index meant the legend won. Nudging offsets would only move the
   * collision to whichever panel expanded next, and the legend is itself
   * expandable.
   *
   * So the shell now lays that corner out as ONE COLUMN and overlap is
   * impossible by construction: the panels are siblings in a flow rather than
   * three things pinned to the same edge. Same panels, same corner, same order,
   * same information architecture — no redesign, and no magic numbers left to
   * drift.
   *
   * `positioned: false` is what the shell passes. The default keeps the old
   * self-anchored behaviour for any other caller.
   */
  readonly positioned?: boolean;
}

export function MapControlCluster({
  globeLocator = null,
  layers = null,
  threeD = null,
  label,
  positioned = true,
}: MapControlClusterProps): JSX.Element {
  const slots: Readonly<Record<MapControlId, JSX.Element | null>> = {
    'globe-locator': globeLocator,
    layers,
    'three-d': threeD,
    zoom: null,
    'layer-visibility': null,
  };

  return (
    <div
      data-gn="map-control-cluster"
      data-gn-cluster="lower-left"
      role="group"
      aria-label={label}
      className={`pointer-events-auto flex flex-col items-start gap-2${
        positioned ? ' absolute bottom-4 left-4 z-10' : ''
      }`}
    >
      {LOWER_LEFT_CLUSTER.map((id) => {
        const control = slots[id];
        return control === null ? null : <div key={id} data-gn-slot={id}>{control}</div>;
      })}
    </div>
  );
}
