'use client';

import type { CameraState } from '@/lib/map/camera/cameraState';
import type { MapMode, MapPeriod } from '@/lib/map/state/mapState';
import { MachineReadable } from '@/lib/typography/runBoundary';

/**
 * SPATIAL M2 — THE READOUT AND SCALE BAR, FROM DESIGN PART I §E.
 *
 * "Zoom level, centre coordinate, active mode and period; a true ground-
 * distance bar. ESTABLISHES THAT THE MAP IS SPATIALLY REAL. Hidden on phones."
 *
 * That last justification is the whole reason this exists. A dark stylised map
 * with glowing markers can read as an illustration; a live centre coordinate
 * and a ground-distance bar that changes as you zoom are what tell a reader
 * they are looking at an instrument. It is diagnostic information, and it is
 * rendered in the diagnostic register — smallest type, faintest ink, no
 * pointer events — so it never competes with the intelligence layer.
 *
 * THE SCALE BAR IS COMPUTED, NOT DECORATIVE. Web Mercator ground resolution
 * varies with latitude as well as zoom, so the bar measures a real distance at
 * the CURRENT centre and then snaps to a round number — the number is chosen to
 * fit the bar rather than the bar drawn to fit a number, which is the only way
 * round it stays true.
 */

const EARTH_CIRCUMFERENCE_OVER_TILE = 156543.03392;

/** Metres per screen pixel at this camera. */
export function metresPerPixel(camera: CameraState): number {
  /*
    `156543.034 * cos(lat) / 2^z` is the 256 px-tile figure. MapLibre uses
    512 px tiles, so its zoom z covers twice the ground of a 256 px zoom z —
    hence `z + 1`. My first cut used `z + 8`, which is the tile-pixel form, and
    the bar read "20 km" across the whole world. Measured against the readout's
    own centre, so the two can be checked against each other.
  */
  return (
    (EARTH_CIRCUMFERENCE_OVER_TILE * Math.cos((camera.center[1] * Math.PI) / 180)) /
    Math.pow(2, camera.zoom + 1)
  );
}

/** A round distance and the pixel width that represents it. */
export function scaleBarFor(camera: CameraState, maxPx = 70): { label: string; widthPx: number } {
  const mpp = metresPerPixel(camera);
  const rough = mpp * maxPx;
  const steps = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000,
    100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000,
  ];
  const chosen = steps.find((step) => step >= rough) ?? steps[steps.length - 1];
  const widthPx = Math.max(12, Math.round(chosen / mpp));
  const label = chosen >= 1_000 ? `${Math.round(chosen / 1_000)} km` : `${chosen} m`;

  return { label, widthPx };
}

const coordinate = (camera: CameraState): string => {
  const [lon, lat] = camera.center;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';

  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
};

export interface MapReadoutProps {
  readonly camera: CameraState;
  readonly mode: MapMode;
  readonly period: MapPeriod;
  readonly labels: {
    readonly zoom: string;
    readonly centre: string;
    readonly mode: string;
    readonly modes: Readonly<Record<MapMode, string>>;
    readonly periods: Readonly<Record<MapPeriod, string>>;
  };
}

export function MapReadout({ camera, mode, period, labels }: MapReadoutProps): JSX.Element {
  return (
    <div
      data-gn="map-readout"
      /* Diagnostic register: faintest ink, smallest type, inert to the pointer. */
      /*
        DESIGN v1.6 — the map readout is a DIAGNOSTIC REGISTER and stays the
        quietest thing on the map, but it was quiet enough to be unreadable
        against the lifted v1.5 land. Labels rise to #8AA0AE, values to
        #C3D6E0, and a 3 px drop shadow holds both over whatever is beneath.

        It remains `pointer-events-none`: brighter is not the same as
        actionable, and this is still a readout rather than a control.
      */
      className="pointer-events-none whitespace-nowrap text-right font-gn-mono text-[9.5px] leading-[1.7] tracking-[0.1em] text-[#8AA0AE] [text-shadow:0_1px_3px_rgba(2,6,10,.9)]"
    >
      <div>
        {labels.zoom}{' '}
        <MachineReadable as="span" className="font-normal text-[#C3D6E0]">
          {camera.zoom.toFixed(1)}
        </MachineReadable>
      </div>
      <div>
        {labels.centre}{' '}
        <MachineReadable as="span" className="font-normal text-[#C3D6E0]">
          {coordinate(camera)}
        </MachineReadable>
      </div>
      <div>
        {labels.mode}{' '}
        <b className="font-normal text-[#C3D6E0]">
          {labels.modes[mode]} &middot; {labels.periods[period]}
        </b>
      </div>
    </div>
  );
}

export function MapScaleBar({ camera }: { readonly camera: CameraState }): JSX.Element {
  const { label, widthPx } = scaleBarFor(camera);

  return (
    <div
      data-gn="map-scale-bar"
      className="pointer-events-none flex items-center gap-[7px] font-gn-mono text-[9px] text-sp-ink-3"
    >
      <span
        aria-hidden="true"
        className="block h-[5px] border border-t-0 border-sp-line-2"
        style={{ width: widthPx }}
      />
      <span>{label}</span>
    </div>
  );
}
