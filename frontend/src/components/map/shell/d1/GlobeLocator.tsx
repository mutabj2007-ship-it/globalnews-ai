'use client';

import {
  indicatorIsMeaningful,
  viewportRectFor,
  type LngLatBounds,
} from '@/lib/map/d1/globeLocatorGeometry';

/**
 * THE GLOBE LOCATOR — lower-left cluster, first control (specification §3d).
 *
 * "Global camera position with a viewport indicator." Rendered from the LIVE
 * camera, never from an image: the board's own note requires it, and a fixed
 * picture of the world would be a locator that lies the moment the camera moves.
 *
 * IT IS NOT THE 3D TOGGLE. The specification says so twice — "the globe locator
 * is not the 3D toggle; the two are distinct and must not be merged" — and
 * `controlsMayMerge()` refuses the pairing in code. This component therefore has
 * no projection state, no toggle and no `onClick` that changes the renderer; its
 * only action is the one a locator legitimately has, which is to take the reader
 * home to the global view.
 *
 * NO NEW GEOMETRY IS FETCHED. `landPath` is the outline the map already holds,
 * passed down. Absent it, the graticule frame and the indicator still draw —
 * a locator with no coastline is less useful, but it is still live and still
 * true, which a placeholder image would not be.
 */
export interface GlobeLocatorProps {
  readonly bounds: LngLatBounds;
  /** An SVG path in the same 0..1 space this component draws in. Optional. */
  readonly landPath?: string | null;
  readonly label: string;
  readonly homeLabel: string;
  readonly onGoGlobal?: () => void;
}

const SIZE = 64;

export function GlobeLocator({
  bounds,
  landPath = null,
  label,
  homeLabel,
  onGoGlobal,
}: GlobeLocatorProps): JSX.Element {
  const rect = viewportRectFor(bounds);
  const meaningful = indicatorIsMeaningful(rect);

  const px = (value: number): number => Math.round(value * SIZE * 100) / 100;

  return (
    <button
      type="button"
      data-gn-control="globe-locator"
      data-gn-cluster="lower-left"
      /* Distinct from the 3D control, and asserted. A locator that also toggled
         projection would be the merge the specification forbids. */
      data-gn-is-3d-toggle="false"
      data-gn-indicator={meaningful ? 'shown' : 'suppressed'}
      onClick={onGoGlobal}
      aria-label={`${label} — ${homeLabel}`}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#22303f] bg-[rgba(5,8,13,0.86)] transition-colors hover:border-[rgba(34,211,238,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
    >
      <svg
        width={40}
        height={20}
        viewBox={`0 0 ${SIZE} ${SIZE / 2}`}
        aria-hidden="true"
        focusable="false"
        data-gn="globe-locator-canvas"
      >
        {/* The world frame. Equirectangular, so the indicator arithmetic and the
            drawing share one projection rather than approximating each other. */}
        <rect x={0} y={0} width={SIZE} height={SIZE / 2} fill="#07111a" stroke="#1b2938" strokeWidth={1} />
        <line x1={0} y1={SIZE / 4} x2={SIZE} y2={SIZE / 4} stroke="#16222f" strokeWidth={0.75} />
        <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE / 2} stroke="#16222f" strokeWidth={0.75} />
        {landPath === null ? null : (
          <path d={landPath} fill="#13202c" stroke="#1e2d3c" strokeWidth={0.5} data-gn="globe-locator-land" />
        )}
        {meaningful ? (
          <>
            <rect
              data-gn="globe-locator-viewport"
              x={px(rect.x)}
              y={px(rect.y) / 2}
              width={px(rect.width)}
              height={px(rect.height) / 2}
              fill="rgba(34,211,238,0.16)"
              stroke="#22d3ee"
              strokeWidth={1}
            />
            {rect.wraps ? (
              <rect
                data-gn="globe-locator-viewport-wrap"
                x={px(rect.wrapX)}
                y={px(rect.y) / 2}
                width={px(rect.wrapWidth)}
                height={px(rect.height) / 2}
                fill="rgba(34,211,238,0.16)"
                stroke="#22d3ee"
                strokeWidth={1}
              />
            ) : null}
          </>
        ) : null}
      </svg>
    </button>
  );
}
