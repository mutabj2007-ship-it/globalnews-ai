import { getCountryFeatureCollection, computeFeatureBounds } from '@/lib/map/countryGeometry';

/**
 * SPATIAL M2 · DESIGN SELECTION-CALLOUT AMENDMENT — WHERE THE CALLOUT GOES.
 *
 * Pure geometry, separated from the component for the usual reason: a placement
 * rule is a claim about pixels, and a claim about pixels rendered inside a JSX
 * tree cannot be tested without a browser. Every rule in the amendment's
 * BEHAVIOR list that is positional is decided here and asserted by spec.
 *
 *   "anchored beside the selected geography centroid"
 *   "offset so it does not cover the selected geography"
 *   "flip/reposition at viewport edges and against the right rail"
 *   "if the anchor leaves the viewport, park the callout top-left"
 *
 * The three that are not positional — Escape, the close control, and clearing
 * the selection — are lifecycle, and live in the component.
 */

/** How far from the anchor the callout's near edge sits. */
export const CALLOUT_ANCHOR_GAP = 22;

/** Margin kept from every edge of the canvas region. */
export const CALLOUT_EDGE_MARGIN = 12;

/** Where the callout parks when its anchor is off screen. */
export const CALLOUT_PARK = { x: CALLOUT_EDGE_MARGIN, y: CALLOUT_EDGE_MARGIN } as const;

/**
 * DESIGN'S BREAKPOINT, AS A NUMBER RATHER THAN A CLASS.
 *
 * "visible at desktop widths >= 861px; suppressed below 861px". Exported so the
 * component, the media query and the spec all read the same constant — a
 * Tailwind class would have put the number in three places.
 */
export const CALLOUT_MIN_VIEWPORT_WIDTH = 861;

export interface CalloutSize {
  readonly width: number;
  readonly height: number;
}

export interface CalloutViewport {
  readonly width: number;
  readonly height: number;
}

export type CalloutSide = 'right' | 'left' | 'parked';

export interface CalloutPlacement {
  readonly x: number;
  readonly y: number;
  readonly side: CalloutSide;
  /** True when the anchor was off screen and the callout parked. */
  readonly parked: boolean;
}

/**
 * The anchor point for a country selection, in [lon, lat].
 *
 * DERIVED FROM THE SAME GEOMETRY THE MAP DRAWS, via `computeFeatureBounds` on
 * the same feature collection — so the callout cannot point at a different
 * Rwanda from the one on screen. The centre of the feature's bounds, not a
 * population-weighted centroid: this is a leader line for a label, not a claim
 * about where anything is, and a bounds centre is the honest "beside this
 * shape" point.
 */
export function selectionAnchorFor(iso3: string | null): readonly [number, number] | null {
  if (iso3 === null || iso3.length === 0) return null;

  const feature = getCountryFeatureCollection().features.find(
    (candidate) => candidate.properties.country?.iso3 === iso3,
  );

  if (feature === undefined) return null;

  const bounds = computeFeatureBounds(feature);

  if (bounds === null) return null;

  const [[west, south], [east, north]] = bounds;

  /*
    ANTIMERIDIAN. A feature whose bounds wrap the date line has west > east, and
    averaging them lands the anchor on the opposite side of the planet. The
    midpoint is taken the short way round and re-wrapped into [-180, 180].
  */
  const lon = west > east ? (((west + east + 360) / 2 + 180) % 360) - 180 : (west + east) / 2;

  return [lon, (south + north) / 2];
}

/**
 * Where to put the callout, given a projected anchor.
 *
 * `anchor` is in the canvas region's own pixel space, which already excludes
 * the 52 px layer rail and the 372 px intelligence rail — they are grid
 * columns, not overlays. So "against the right rail" is simply the region's
 * right edge, and this function needs no knowledge of either rail's width.
 */
export function placeCallout(
  anchor: { readonly x: number; readonly y: number } | null,
  size: CalloutSize,
  viewport: CalloutViewport,
): CalloutPlacement {
  /*
    ── THE ANCHOR LEFT THE VIEWPORT ──────────────────────────────────────────

    "If the anchor leaves the viewport, park the callout top-left." Parked
    rather than hidden, deliberately: the selection still exists, and a card
    that vanished when the user panned past its country would look like the
    selection had been lost.
  */
  if (
    anchor === null ||
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y) ||
    anchor.x < 0 ||
    anchor.y < 0 ||
    anchor.x > viewport.width ||
    anchor.y > viewport.height
  ) {
    return { ...CALLOUT_PARK, side: 'parked', parked: true };
  }

  /*
    ── BESIDE, NOT OVER ──────────────────────────────────────────────────────

    The default side is the RIGHT of the anchor, offset by the gap, so the
    selected geography stays uncovered. It flips to the left when the callout
    would otherwise cross the region's right edge — which is the rail edge.
  */
  const rightX = anchor.x + CALLOUT_ANCHOR_GAP;
  const fitsRight = rightX + size.width + CALLOUT_EDGE_MARGIN <= viewport.width;

  const leftX = anchor.x - CALLOUT_ANCHOR_GAP - size.width;
  const fitsLeft = leftX >= CALLOUT_EDGE_MARGIN;

  const side: CalloutSide = fitsRight ? 'right' : fitsLeft ? 'left' : 'right';

  /*
    When NEITHER side fits — a narrow region, or an anchor near the middle of a
    small viewport — the right side is kept and clamped below. Clamping can
    overlap the geography, and that is the lesser failure: an unreadable card
    pushed off screen helps nobody, while an overlapping one is still legible
    and still dismissible.
  */
  const x = clamp(
    side === 'right' ? rightX : leftX,
    CALLOUT_EDGE_MARGIN,
    Math.max(CALLOUT_EDGE_MARGIN, viewport.width - size.width - CALLOUT_EDGE_MARGIN),
  );

  /* Vertically centred on the anchor, then clamped inside the region. */
  const y = clamp(
    anchor.y - size.height / 2,
    CALLOUT_EDGE_MARGIN,
    Math.max(CALLOUT_EDGE_MARGIN, viewport.height - size.height - CALLOUT_EDGE_MARGIN),
  );

  return { x, y, side, parked: false };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
