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
}

export function MapControlCluster({
  globeLocator = null,
  layers = null,
  threeD = null,
  label,
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
      className="pointer-events-auto absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2"
    >
      {LOWER_LEFT_CLUSTER.map((id) => {
        const control = slots[id];
        return control === null ? null : <div key={id} data-gn-slot={id}>{control}</div>;
      })}
    </div>
  );
}
