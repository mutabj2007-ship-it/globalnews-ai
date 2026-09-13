'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { buildEvidenceMapGeometry } from './geographicEvidenceGeometry';
import type { EvidenceGeographyModel } from './evidenceGeography';

/* ==================================================================== *
 * H-ALPHA-VISUAL-1 ITEM E — EXPANDED EVIDENCE GEOGRAPHY.
 *
 * ── WHAT THE OLD INVARIANT WAS PROTECTING, AND WHAT REPLACES IT ──────
 *
 * `geographicEvidence.spec.ts` pinned "no zoom, pan or re-centre control
 * exists on the map at any size". That was never about controls for
 * their own sake. An exploratory map invites the reader to believe there
 * is something below country level to explore, and on this path there is
 * not: `geographicEvidenceState.ts` decides precision in exactly one
 * place and it yields only 'country' or 'unresolved'. The CTO has now
 * narrowed that invariant deliberately, so the protection has to be
 * re-established by construction rather than by absence.
 *
 * ── WHY ZOOMING HERE CANNOT REVEAL SUBNATIONAL DETAIL ────────────────
 *
 * Not by policy — by data. The geometry is Natural Earth 1:110m ADMIN-0
 * from `world-atlas/countries-110m.json`. An admin-0 feature has an
 * outer boundary and nothing inside it. There are no province borders,
 * no districts, no settlements and no coordinates in the source, so no
 * magnification can uncover one. This component adds no dataset, reads
 * no new field, and derives no new precision.
 *
 * ZOOM IS SCHEMATIC. It scales the drawing that is already there. It is
 * NOT a resolution swap: nothing switches to countries-50m/10m, so the
 * reader cannot mistake a sharper outline for finer evidence. Capped at
 * MAX_ZOOM per R3.
 *
 * THE PRECISION STATEMENT IS ALWAYS VISIBLE, at every zoom level, and
 * the expanded view adds a second, blunter sentence saying the ceiling
 * IS the ceiling — because a reader who has just been given a zoom
 * control is exactly the reader most likely to assume otherwise.
 * ==================================================================== */

/** R3: maximum schematic zoom. */
export const MAX_ZOOM = 2.5;
export const MIN_ZOOM = 1;
export const ZOOM_STEP = 0.25;
/** Pan step for keyboard operation, in viewBox units per press. */
export const PAN_STEP = 6;

export interface ViewState {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export const REST_VIEW: ViewState = { zoom: MIN_ZOOM, x: 0, y: 0 };

export function clampZoom(z: number): number {
  return z < MIN_ZOOM ? MIN_ZOOM : z > MAX_ZOOM ? MAX_ZOOM : z;
}

/**
 * Pan is bounded so the country cannot be dragged off the canvas — at
 * rest there is nothing to pan, and at maximum zoom the drawing may move
 * by at most half the box in each direction. Pure, so it is testable
 * without a browser.
 */
/* ==================================================================== *
 * H-C2 RUNTIME CORRECTION C2 — WHERE THE ZOOM SCALES FROM.
 *
 * MEASURED DEFECT, expanded map at a 1440 viewport whose map region spans
 * x 171-1269, evidence country AUS:
 *
 *     zoom 1.00   evidence rect x  413   100 % visible
 *     zoom 1.50   evidence rect x 1280     0 % visible
 *     zoom 2.50   evidence rect x 3014     0 % visible
 *
 * One press of "+" and the evidence country left the frame. The cause was one
 * attribute: `transformBox: 'fill-box'` makes a CSS `transform-origin: center`
 * resolve against the GROUP'S OWN BOUNDING BOX, and that box spans every
 * context polygon — here islands well to the north-east. Scaling about that
 * point translates the evidence country out of view.
 *
 * The origin was always meant to be the centre of the VIEWBOX, which is also
 * what `clampPan`'s `(zoom - 1) * extent / 2` bound assumes: pan is limited to
 * the overhang a centre-scaled drawing produces, and is zero at rest. The
 * bound was correct; the origin it was written for did not exist.
 *
 * Expressed in the SVG transform attribute rather than in CSS, so there is no
 * second coordinate system to disagree with. `translate(view.x view.y)` stays
 * OUTERMOST and therefore keeps its exact previous meaning — viewBox units,
 * applied before the scale — so pan behaviour, PAN_STEP and every existing
 * pan assertion are untouched.
 * ==================================================================== */
export function viewBoxCentre(viewBox: string): { cx: number; cy: number } {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  if ([x, y, w, h].some((n) => !Number.isFinite(n))) return { cx: 0, cy: 0 };
  return { cx: (x as number) + (w as number) / 2, cy: (y as number) + (h as number) / 2 };
}

export function zoomTransform(viewBox: string, view: ViewState): string {
  const { cx, cy } = viewBoxCentre(viewBox);
  return (
    `translate(${view.x} ${view.y}) ` +
    `translate(${cx} ${cy}) scale(${view.zoom}) translate(${-cx} ${-cy})`
  );
}

/* ==================================================================== *
 * C3 — REFERENCE LABELS, AND WHY MORE OF THEM APPEAR AS YOU ZOOM.
 *
 * "Zooming reveals more WORLD. It never reveals more EVIDENCE."
 *
 * The label is drawn INSIDE the scaled group so it travels with its country,
 * and its font size is divided by the zoom so its size ON SCREEN never
 * changes. That single division is what makes the reveal progressive and
 * makes it honest: at higher zoom a label occupies FEWER viewBox units, so a
 * country whose outline was too small to hold its own name becomes able to,
 * and is named. Nothing is loaded, nothing is unhidden — the same 1:110m
 * admin-0 polygons are on screen at every zoom level. What increases is how
 * much of the world is legible, which is exactly what the ruling permits and
 * exactly what it distinguishes from evidence.
 *
 * The size is a FRACTION OF THE VIEWBOX HEIGHT rather than a pixel value,
 * because this component does not measure its container and the viewBox
 * differs per country. A fraction of the drawn height is constant on screen
 * whatever the country and whatever the container.
 * ==================================================================== */
/**
 * The label's size ON SCREEN, in px. R1 section 8.1 floors desktop text at
 * 11px; a first cut expressed the size as a bare fraction of the viewBox and
 * measured 10px live, which is a floor breach dressed as a design choice.
 * This is stated in pixels and converted, so the floor is a fact.
 */
export const LABEL_MIN_PX = 12;
/** SSR fallback only: no element has been measured yet. */
export const LABEL_HEIGHT_FRACTION = 0.026;
/** Mean glyph advance as a fraction of font size, for the label face. */
export const LABEL_CHAR_RATIO = 0.58;

/**
 * viewBox units per rendered pixel.
 *
 * `preserveAspectRatio="xMidYMid meet"` fits the viewBox inside the box, so
 * whichever axis binds sets the scale. Taking the LARGER ratio is the
 * conservative reading — it can only make the label bigger than the floor,
 * never smaller.
 */
export function unitsPerPixel(
  viewBoxWidth: number,
  viewBoxHeight: number,
  boxWidthPx: number,
  boxHeightPx: number,
): number | null {
  if (boxWidthPx <= 0 || boxHeightPx <= 0) return null;
  return Math.max(viewBoxWidth / boxWidthPx, viewBoxHeight / boxHeightPx);
}

export function labelFontSize(
  viewBoxHeight: number,
  zoom: number,
  perPixel: number | null,
): number {
  const base =
    perPixel === null ? viewBoxHeight * LABEL_HEIGHT_FRACTION : LABEL_MIN_PX * perPixel;
  return base / Math.max(zoom, MIN_ZOOM);
}

/**
 * Does this country's own outline have room for its own name?
 *
 * Monotonic in zoom by construction: `fontSize` falls as zoom rises, so the
 * required width falls with it and the set of eligible labels can only grow.
 * A country with no curated name is never eligible — it is drawn and left
 * unnamed rather than given an invented one.
 */
export function labelFits(boxWidth: number, name: string, fontSize: number): boolean {
  if (name.length === 0) return false;
  return boxWidth >= name.length * fontSize * LABEL_CHAR_RATIO;
}

export function clampPan(value: number, zoom: number, extent: number): number {
  const limit = ((zoom - 1) * extent) / 2;
  return value < -limit ? -limit : value > limit ? limit : value;
}

export function applyView(view: ViewState, dx: number, dy: number, dz: number, extent: number): ViewState {
  const zoom = clampZoom(view.zoom + dz);
  return {
    zoom,
    x: clampPan(view.x + dx, zoom, extent),
    y: clampPan(view.y + dy, zoom, extent),
  };
}

export interface EvidenceGeographyExpandedProps {
  model: EvidenceGeographyModel;
  precisionLabel: string;
  onClose: () => void;
  language?: LanguageCode;
}

export function EvidenceGeographyExpanded({
  model,
  precisionLabel,
  onClose,
  language = 'en',
}: EvidenceGeographyExpandedProps): JSX.Element | null {
  const t = getDictionary(language).analysisFrame;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<Element | null>(null);
  const [view, setView] = useState<ViewState>(REST_VIEW);
  const mapRef = useRef<HTMLDivElement | null>(null);
  /** Measured so the label's size can be stated in PIXELS. 0 until mounted. */
  const [mapSize, setMapSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  /*
    THE SAME EVIDENCE-VS-TARGET RULE AS `EvidenceMap`, restated rather
    than re-decided: only article-resolved countries are FILLED, and the
    route's own country is outlined at most. A larger canvas must not
    quietly promote a retrieval filter into evidence.
  */
  const articleEvidence = model.countries.filter((c) => c.basis === 'article-evidence');
  const filled = articleEvidence.length > 0 ? articleEvidence : model.countries;
  const outlinedIso3 =
    articleEvidence.length > 0
      ? (model.countries.find((c) => c.basis === 'retrieval-filter')?.iso3 ??
         model.queryTarget?.iso3 ??
         null)
      : (model.queryTarget?.iso3 ?? null);

  const geometry = buildEvidenceMapGeometry(
    filled.map((c) => c.iso3),
    outlinedIso3,
    16 / 10,
  );

  /*
    FOCUS MANAGEMENT. The element that opened the overlay is remembered
    and restored on close, and focus moves to the close control on open
    so a keyboard reader is inside the dialog rather than behind it.
  */
  useEffect(() => {
    restoreRef.current = typeof document === 'undefined' ? null : document.activeElement;
    closeRef.current?.focus();
    return () => {
      const node = restoreRef.current;
      if (node instanceof HTMLElement) node.focus();
    };
  }, []);

  useEffect(() => {
    const node = mapRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const r = node.getBoundingClientRect();
      setMapSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const extent = 100;

  /*
    C3 — WHICH NEIGHBOURS ARE NAMED AT THIS ZOOM.

    Eligibility is a question about SPACE, not about importance: a country is
    named when its own outline is wide enough to hold its own name at the
    current zoom. Nothing is ranked, nothing is curated, and a country without
    curated metadata is drawn and left unnamed rather than given a guess.
  */
  const viewBoxWidth = geometry === null ? 0 : Number(geometry.viewBox.split(/\s+/)[2] ?? 0);
  const viewBoxHeight = geometry === null ? 0 : Number(geometry.viewBox.split(/\s+/)[3] ?? 0);
  const perPixel = unitsPerPixel(viewBoxWidth, viewBoxHeight, mapSize.w, mapSize.h);
  const labelSize = labelFontSize(viewBoxHeight, view.zoom, perPixel);
  const referenceLabels =
    geometry === null
      ? []
      : geometry.contextCountries.filter((c) =>
          labelFits(c.boxWidth, getCountryDisplayName(c.iso2, language, c.name), labelSize),
        );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      const key = event.key;
      if (key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      /* KEYBOARD OPERATION IS FIRST-CLASS, not a pointer fallback. */
      const step = (dx: number, dy: number, dz: number): void => {
        event.preventDefault();
        setView((v) => applyView(v, dx, dy, dz, extent));
      };
      if (key === 'ArrowLeft') return step(PAN_STEP, 0, 0);
      if (key === 'ArrowRight') return step(-PAN_STEP, 0, 0);
      if (key === 'ArrowUp') return step(0, PAN_STEP, 0);
      if (key === 'ArrowDown') return step(0, -PAN_STEP, 0);
      if (key === '+' || key === '=') return step(0, 0, ZOOM_STEP);
      if (key === '-' || key === '_') return step(0, 0, -ZOOM_STEP);
      if (key === '0') {
        event.preventDefault();
        setView(REST_VIEW);
      }
    },
    [onClose],
  );

  /*
    PAF-21 — THE RING IS WRITTEN ON EVERY CONTROL, NOT SHARED.
    A single constant would satisfy the eye and fail the invariant: the
    per-file count in `frameBehaviour.spec.ts` exists so a control cannot
    be added later and quietly inherit nothing. Each button therefore
    carries its own `focus-visible:outline-gn-focus`.
  */
  const control =
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border border-[#22303f] px-3 font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#a9bccf] md:text-[11px]';
  const ring = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus';

  return (
    <div
      data-paf="geo-expanded"
      role="dialog"
      aria-modal="true"
      aria-label={t.geoExpandedRegion}
      ref={dialogRef}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      /*
        Desktop overlay, phone full-screen — one element, two insets, so
        there is a single implementation of this view rather than two that
        can disagree.
      */
      className="fixed inset-0 z-50 flex flex-col bg-[rgba(3,6,11,.94)] p-0 md:p-8"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-[#16202e] bg-[#05080d] md:mx-auto md:w-full md:max-w-[1100px] md:rounded-[14px] md:border">
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#101923] px-4 py-3">
          <span className="font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#93c5fd] md:text-[11px]">
            {t.evidenceGeography}
          </span>
          {/* PRECISION IS IN THE HEADER, so it is on screen at every zoom. */}
          <span
            data-paf="geo-expanded-precision"
            className="font-gn-mono text-[12px] uppercase tracking-[0.14em] text-[#67e8f9] md:text-[11px]"
          >
            {precisionLabel}
          </span>
          <button
            ref={closeRef}
            type="button"
            data-paf="geo-close"
            onClick={onClose}
            className={`ml-auto ${control} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus`}
          >
            {t.geoClose}
          </button>
        </header>

        <div ref={mapRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#071016]">
          {geometry === null ? (
            <span className="absolute inset-0 flex items-center justify-center px-4 text-center font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#4a5c73] md:text-[11px]">
              {t.mapNothingToDraw}
            </span>
          ) : (
            <svg
              viewBox={geometry.viewBox}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
              focusable="false"
            >
              {/*
                ONE transform group. Zoom and pan are a schematic scale of
                the SAME admin-0 drawing — no second dataset, no detail
                that was not already on screen at rest.
              */}
              <g
                data-paf="geo-viewport"
                data-zoom={view.zoom.toFixed(2)}
                /* C2 — scales about the VIEWBOX centre. See zoomTransform. */
                transform={zoomTransform(geometry.viewBox, view)}
              >
                {/*
                  C4 — LOCK 7's REFERENCE GRAMMAR, RESTORED.

                  This carried fill #0b1a24 / stroke #1b2c3a at 0.6px, which
                  A1-EG-13b does not permit and which measured almost exactly
                  the #071016 ground behind it — the reason the neighbours read
                  as absent rather than as neutral. The locked values are
                  slate fill rgba(148,163,184,.06) and a 1px #22303f border.

                  NO MARKER, at any zoom. Reference geography never takes one;
                  that prohibition is what keeps this layer distinguishable
                  from evidence in greyscale, where colour cannot help.
                */}
                <g
                  data-paf="geo-reference-layer"
                  fill="rgba(148,163,184,.06)"
                  stroke="#22303f"
                  strokeWidth="1"
                  strokeLinejoin="round"
                >
                  {geometry.contextPaths.map((d, i) => (
                    <path key={i} d={d} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
                {geometry.targetPath === null ? null : (
                  <path
                    data-paf="map-query-target"
                    d={geometry.targetPath.d}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.1"
                    strokeDasharray="3 2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {geometry.evidencePaths.map((p) => (
                  <path
                    key={p.iso3}
                    data-paf="evidence-country"
                    data-iso3={p.iso3}
                    d={p.d}
                    fill="rgba(34,211,238,.22)"
                    stroke="#67e8f9"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/*
                  C3 — THE REFERENCE LABELS, LAST SO THEY ARE NEVER OVERDRAWN.

                  Every one of these is cartography. Read what is NOT here:
                  no marker, no precision tag, no citation count, no cyan of
                  any strength, and no basis — the four things this product
                  requires of an evidence label and forbids to a reference
                  one. A reader can tell what they are looking AT from what
                  the evidence SUPPORTS, which is the whole purpose of the
                  grammar.

                  `pointerEvents: none` because a label is not a control and
                  must never intercept a drag over the map beneath it.
                */}
                {referenceLabels.map((c) => (
                  <text
                    key={c.iso3 === '' ? c.d.slice(0, 12) : c.iso3}
                    data-paf="geo-reference-label"
                    data-iso3={c.iso3}
                    x={c.labelX}
                    y={c.labelY}
                    fontSize={labelSize}
                    fill="#94a3b8"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: 'none', letterSpacing: `${labelSize * 0.04}px` }}
                  >
                    {getCountryDisplayName(c.iso2, language, c.name)}
                  </text>
                ))}
              </g>
            </svg>
          )}

          {/*
            A1-EG-14 — A SCHEMATIC SAYS SO.

            This canvas draws admin-0 outlines on a plain ground; it is
            not a basemap and has no reference layer to reveal. A1 permits
            reference geography to deepen at zoom where a basemap supports
            it — this surface does not, so zooming reveals no interior
            detail, and the canvas states that rather than letting the
            reader infer it from an absence.
          */}
          <span
            data-paf="geo-schematic"
            className="absolute right-[10px] top-[8px] font-gn-mono text-[12px] uppercase tracking-[0.12em] text-[#4a5c73] md:text-[11px]"
          >
            {t.geoSchematic}
          </span>

          <span
            data-paf="not-a-coordinate"
            className="absolute bottom-[8px] left-[10px] max-w-[46%] font-gn-mono text-[12px] uppercase leading-[1.25] tracking-[0.14em] text-[#4b7f8c] md:text-[11px]"
          >
            {t.notACoordinate}
          </span>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#101923] px-4 py-3">
          <button
            type="button"
            data-paf="geo-zoom-out"
            onClick={() => setView((v) => applyView(v, 0, 0, -ZOOM_STEP, extent))}
            disabled={view.zoom <= MIN_ZOOM}
            aria-label={t.geoZoomOut}
            className={`${control} ${ring} focus-visible:outline-gn-focus disabled:opacity-40`}
          >
            &minus;
          </button>
          <button
            type="button"
            data-paf="geo-zoom-in"
            onClick={() => setView((v) => applyView(v, 0, 0, ZOOM_STEP, extent))}
            disabled={view.zoom >= MAX_ZOOM}
            aria-label={t.geoZoomIn}
            className={`${control} ${ring} focus-visible:outline-gn-focus disabled:opacity-40`}
          >
            +
          </button>
          <button
            type="button"
            data-paf="geo-zoom-reset"
            onClick={() => setView(REST_VIEW)}
            className={`${control} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus`}
          >
            {t.geoZoomReset}
          </button>

          {/*
            THE BLUNT SENTENCE. A reader handed a zoom control will assume
            zooming buys detail. It does not, and this says so in words
            rather than leaving the absence to be inferred.
          */}
          <span
            data-paf="geo-no-subnational"
            className="ml-auto max-w-full font-gn-mono text-[12px] uppercase leading-[1.3] tracking-[0.1em] text-[#4a5c73] md:text-[11px]"
          >
            {t.geoNoSubnational}
          </span>
        </footer>
      </div>
    </div>
  );
}
