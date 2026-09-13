/**
 * SPATIAL M2 — LABEL PLACEMENT, FROM DESIGN PART I §F.
 *
 * "Labels are placed by priority into a GREEDY COLLISION GRID, recomputed every
 * frame: evidence captions first, then countries by polygon area, then oceans
 * and seas, then lakes by area, then cities by scale rank, then rivers. A label
 * that cannot fit is DROPPED, NEVER OVERLAPPED. Country labels are suppressed
 * when an evidence caption for the same country is already on screen, so the
 * intelligence layer always wins the space."
 *
 * ── WHY THIS IS A DOM OVERLAY AND NOT A MAPLIBRE SYMBOL LAYER ─────────────
 *
 * MapLibre renders text from an SDF glyph source, which means a `glyphs` URL —
 * a font server. The whole style in this shell is deliberately local: no tile
 * server, no style server, nothing that leaks a viewport to a third party, and
 * a spec assertion holds it that way. The Design prototype solves it the same
 * way, with an absolutely positioned `#labels` layer over the canvas, so this
 * follows the reference rather than trading the local-style guarantee for text.
 *
 * ── AND WHY THE PLACEMENT ITSELF IS PURE ──────────────────────────────────
 *
 * Nothing here touches the DOM or the engine. It takes candidates that already
 * carry screen positions and estimated sizes and returns which of them may be
 * drawn. That makes the rule — priority order, collision, suppression — unit
 * testable, which is the only way "a label that cannot fit is dropped" stops
 * being a hope about a renderer.
 */

/** Part I §F's own order. Lower number wins the space. */
export type LabelKind = 'evidence' | 'country' | 'water' | 'lake' | 'city' | 'river' | 'continent';

export const LABEL_PRIORITY: Readonly<Record<LabelKind, number>> = {
  evidence: 0,
  country: 1,
  water: 2,
  lake: 3,
  city: 4,
  river: 5,
  /*
    Continent labels sit LAST despite being the largest type. They are ambient
    orientation, not information — a dropped continent label costs a reader
    nothing, a dropped country label costs them the map.
  */
  continent: 6,
};

export interface LabelCandidate {
  readonly id: string;
  readonly kind: LabelKind;
  readonly text: string;
  /** Screen position in CSS pixels, already projected by the engine. */
  readonly x: number;
  readonly y: number;
  /** Tie-break within a kind: polygon area, population, scale rank. Higher first. */
  readonly weight: number;
  /** The ISO3 this label belongs to, where it has one. */
  readonly countryIso3?: string;
  /** Estimated box, in CSS pixels. */
  readonly width: number;
  readonly height: number;
}

export interface PlacementViewport {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned overlap, with a small breathing gap so labels do not touch. */
const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap: number,
): boolean =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width + gap * 2 &&
  Math.abs(a.y - b.y) * 2 < a.height + b.height + gap * 2;

export interface PlacementOptions {
  readonly gap?: number;
  /** Countries that already carry an evidence caption on screen. */
  readonly suppressCountries?: ReadonlySet<string>;
  /** Drop anything whose box falls outside the viewport. */
  readonly viewport?: PlacementViewport;
  /**
   * Screen rectangles the HUD occupies — legend, controls, banner, readout.
   *
   * A label is geography; a HUD panel is chrome that sits over it. Without
   * this the collision grid only knows about other labels, so "Indian Ocean"
   * placed itself underneath the Previous View button and read as a smear.
   * Chrome always wins, because the reader can pan the map out from under a
   * label but cannot move the controls.
   */
  readonly reserved?: readonly { x: number; y: number; width: number; height: number }[];
}

/**
 * The labels that may be drawn, in draw order.
 *
 * GREEDY, BY PRIORITY THEN WEIGHT. Each candidate is tested against everything
 * already placed; a collision drops it outright rather than nudging it, because
 * a nudged label is a label in the wrong place and the reader has no way to
 * know it moved.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  options: PlacementOptions = {},
): readonly LabelCandidate[] {
  const gap = options.gap ?? 3;
  const suppress = options.suppressCountries ?? new Set<string>();
  const viewport = options.viewport;

  const ordered = [...candidates].sort(
    (a, b) => LABEL_PRIORITY[a.kind] - LABEL_PRIORITY[b.kind] || b.weight - a.weight,
  );

  const placed: LabelCandidate[] = [];

  for (const candidate of ordered) {
    /*
      "Country labels are suppressed when an evidence caption for the same
      country is already on screen, so THE INTELLIGENCE LAYER ALWAYS WINS THE
      SPACE." Applied before collision, because the point is not that the two
      overlap — it is that repeating the country name adds nothing beside a
      caption that already names it.
    */
    if (candidate.kind === 'country' && candidate.countryIso3 !== undefined) {
      if (suppress.has(candidate.countryIso3)) continue;
    }

    if (viewport !== undefined) {
      const halfW = candidate.width / 2;
      const halfH = candidate.height / 2;

      if (
        candidate.x - halfW < 0 ||
        candidate.y - halfH < 0 ||
        candidate.x + halfW > viewport.width ||
        candidate.y + halfH > viewport.height
      ) {
        continue;
      }
    }

    if (options.reserved?.some((rect) => overlaps(candidate, rect, gap))) continue;

    if (placed.some((other) => overlaps(candidate, other, gap))) continue;

    placed.push(candidate);
  }

  return placed;
}

/**
 * ── THE ZOOM LADDER ───────────────────────────────────────────────────────
 *
 * Part I §F: "Fade thresholds are per-feature, derived from area or scale rank,
 * so the user gains ROUGHLY ONE NEW CLASS OF LABEL PER ZOOM STEP rather than a
 * wall of text at any single step."
 *
 * The threshold is a function of the feature's own size: a large country earns
 * its label at the world view, a small one at a regional zoom. `minZoomFor`
 * turns an area into that threshold, so nothing is hand-listed and a country
 * the registry gains gets a sensible tier for free.
 *
 * THE CEILING MATTERS AS MUCH AS THE FLOOR. The CTO's requirement is that the
 * map becomes MORE informative as the reader zooms, so nothing here removes a
 * country label as zoom increases — a label that has appeared stays.
 */
export function minZoomForArea(areaSquareDegrees: number): number {
  if (areaSquareDegrees >= 900) return 0;
  if (areaSquareDegrees >= 300) return 1.4;
  if (areaSquareDegrees >= 90) return 2.2;
  if (areaSquareDegrees >= 30) return 3;
  if (areaSquareDegrees >= 8) return 3.8;
  if (areaSquareDegrees >= 2) return 4.6;

  return 5.4;
}

/** Country labels only ever GAIN as the camera zooms in. */
export function countryLabelVisible(areaSquareDegrees: number, zoom: number): boolean {
  return zoom >= minZoomForArea(areaSquareDegrees);
}

/**
 * A label's estimated box, from its text and type size.
 *
 * Deliberately an ESTIMATE and deliberately generous: measuring every label in
 * the DOM each frame is the expensive thing this avoids, and a slightly wide
 * box drops a marginal label rather than letting two collide. Erring toward
 * dropping is the direction Part I §F chooses.
 */
export function estimateLabelBox(
  text: string,
  fontSizePx: number,
  trackingEm: number,
): { width: number; height: number } {
  /* IBM Plex Mono advances at ~0.6em; tracking adds a full em per character. */
  const perChar = fontSizePx * (0.6 + trackingEm);

  return { width: Math.max(fontSizePx, text.length * perChar), height: fontSizePx * 1.35 };
}
