import { useId } from 'react';
import { getCountryFeatureCollection, type CountryFeature } from '@/lib/map/countryGeometry';

/**
 * HeroIntelligenceField — the Hero's world field (GN-CD-043 → GN-CD-050).
 *
 * M65 introduced this component. M66.3 corrects its projection fit against the
 * released specification and recomposes it for the two authored viewports. What
 * M65 established and M66.3 deliberately PRESERVES:
 *
 *   - real country geometry from getCountryFeatureCollection() — the SAME local
 *     world-atlas/topojson data every other geographic surface in this app uses,
 *     resolved at render with NO request of any kind. GN-CD-043 fetches
 *     `countries-110m.json` from a CDN at runtime; GN-CD §T itself calls that "a
 *     prototype convenience" and instructs production to vendor it locally. This
 *     component already did, and still does;
 *   - instance-unique SVG ids via useId(). GN-CD flags the prototype's fixed
 *     `#gnAtm` / `#gnGlow` ids as UNRESOLVED-022 because two mounted maps would
 *     collide. This component renders twice per page — the desktop field and the
 *     mobile bleed — so the hazard is real here and was solved before it was
 *     specified;
 *   - decorative-only semantics. Zero data props, zero handlers, zero state,
 *     aria-hidden at the root.
 *
 * ── M66.3 CORRECTION 1: ONE UNIFORM SCALE ──────────────────────────────────
 *
 * The M65 implementation scaled longitude and latitude INDEPENDENTLY: the
 * projected x half-extent (2.7354) was mapped to 440 viewBox units while the y
 * half-extent (1.4224) was mapped to 272.8, a ratio of 1.1925. The rendered
 * globe therefore had an aspect of 1.613 against Natural Earth 1's true 1.9231
 * — every landmass was ~19% too tall for its width. `d3.geoNaturalEarth1()`
 * applies a single scale and cannot produce that. The polynomial itself was
 * transcribed correctly; only the fit was wrong.
 *
 * GN-CD-043 specifies the fit as:
 *
 *     proj.fitExtent([[w*0.02, h*0.07], [w*0.98, h*0.93]], { type: 'Sphere' })
 *
 * i.e. the sphere is fitted, with one uniform scale, into the centred 96% × 86%
 * sub-box of the host and centred there. `fitScale()` below is exactly that
 * computation. Because the insets are symmetric, the sphere's centre is the
 * host's centre, so a fixed viewBox plus the default
 * `preserveAspectRatio="xMidYMid meet"` reproduces `fitExtent` output rather
 * than approximating it: the SVG scales the whole viewBox uniformly and centres
 * it, and the sphere is centred within the viewBox. At the released desktop
 * mount (`left:22%; right:13%` of a 1388px Hero over a 428px-plus frame) and at
 * the released mobile bleed (238x198) the resulting sphere matches the
 * `fitExtent` result to within a fraction of a pixel; `heroGeometry.spec.ts`
 * proves both numerically rather than asserting a class string.
 *
 * ── M66.3 CORRECTION 2: THE REAL SPHERE BOUNDARY ───────────────────────────
 *
 * GN-CD-045 draws the sphere outline as the projected `{type:'Sphere'}` path.
 * M65 drew an <ellipse>. Natural Earth 1 has a FLAT POLE LINE 55.0% of the
 * width of the equator, which no ellipse can express, and M65's ellipse was
 * also 12.4 units shorter than the projection's own half-height, so polar
 * geometry escaped its own outline. `sphereBoundaryPathD()` traces the true
 * boundary: up the antimeridian, straight across the north pole line, back down
 * the prime antimeridian, and straight across the south pole line.
 *
 * ── M66.3 CORRECTION 3: THE COMPACT RECOMPOSITION ──────────────────────────
 *
 * GN-CD-046 authors a genuine geometry change for small screens — a 40 deg x
 * 30 deg graticule rather than a dimmed 10 deg x 10 deg one — and GN-CD-050 and
 * GN-CD-052 reduce the decorative link and node counts. The design's own
 * responsive table forbids "rendering the full 15-node map in the 238px bleed".
 * The `compact` prop carries that recomposition.
 *
 * ── WHAT IS DELIBERATELY NOT PORTED (CTO decision L-8) ─────────────────────
 *
 * GN-CD-048's evidence-scope focus radii, GN-CD-049's scope-derived pulse,
 * GN-CD-051's relationship paths and GN-CD-052's named, geolocated, categorised
 * and keyboard-focusable signal nodes are ALL data claims. No backend route
 * supplies geolocated intelligence signals, evidence scope or source counts, so
 * porting them would fabricate coverage. Every point below is a fixed,
 * arbitrary, UNLABELED mark with no id, no place name, no category and no
 * coordinate significance, reproducing the reference's visual RHYTHM and
 * nothing else. The ring MULTIPLIERS and per-ring strokes from GN-CD-048 are
 * pure presentation and are used; the scope-derived BASE that gives them
 * meaning is not, and no element here is focusable, labelled or tooltipped.
 *
 * GN-CD-050 is explicit that the connection lattice "must never be labelled,
 * exposed in a tooltip, or described to users as connections". It is not.
 */

/**
 * M66.14B — a REAL focus target, resolved by the caller.
 *
 * The component receives an already-projected place and a colour channel. It
 * performs no lookup, holds no state and knows nothing about articles, so the
 * field stays a pure presentation surface exactly as CTO decision L-8 required.
 */
export interface HeroFieldFocus {
  /** Degrees, already resolved from a country centroid by the caller. */
  lon: number;
  lat: number;
  /** An 'r,g,b' channel triple from CATEGORY_CHANNEL — never a second colour table. */
  channel: string;
}

interface HeroIntelligenceFieldProps {
  /**
   * GN-CD-046 / GN-CD-050 / GN-CD-052 — the authored small-viewport
   * recomposition: a coarser graticule, fewer decorative links, fewer marks and
   * a two-ring focus. Not a scale of the desktop field.
   */
  compact?: boolean;
  /** M66.14B — the resolved country focus, or null for the released idle render. */
  focus?: HeroFieldFocus | null;
}

/**
 * The internal drawing space. Its aspect is irrelevant to fidelity — the sphere
 * is fitted inside it by the same rule GN-CD-043 uses, and the SVG then scales
 * the whole box uniformly into whatever host the Hero gives it.
 */
const VIEWPORT = { width: 1000, height: 580 };

/** GN-CD-043 — fitExtent's insets: 2% horizontal, 7%/93% vertical. */
const FIT_X = 0.96;
const FIT_Y = 0.86;

/** Natural Earth 1 closed-form polynomial projection (radians in, projected units out). */
function naturalEarth1Radians(lonRad: number, latRad: number): [number, number] {
  const lat2 = latRad * latRad;
  const lat4 = lat2 * lat2;
  const lat6 = lat2 * lat4;
  const lat8 = lat4 * lat4;
  const lat10 = lat8 * lat2;
  const lat12 = lat10 * lat2;
  const x = lonRad * (0.8707 - 0.131979 * lat2 - 0.013791 * lat4 + 0.003971 * lat10 - 0.001529 * lat12);
  const y = latRad * (1.007226 + 0.015085 * lat2 - 0.044475 * lat6 + 0.028874 * lat8 - 0.005916 * lat10);
  return [x, y];
}

/** The sphere's projected half-extents: x at (180,0), y at the pole. Computed, never hardcoded. */
export const SPHERE_HALF_X = naturalEarth1Radians(Math.PI, 0)[0];
export const SPHERE_HALF_Y = naturalEarth1Radians(0, Math.PI / 2)[1];

/**
 * GN-CD-043's fitExtent, as one uniform scale. Exported so the geometry spec can
 * execute it rather than pattern-match a class name.
 */
export function fitScale(width: number, height: number): number {
  return Math.min((width * FIT_X) / (2 * SPHERE_HALF_X), (height * FIT_Y) / (2 * SPHERE_HALF_Y));
}

const SCALE = fitScale(VIEWPORT.width, VIEWPORT.height);

/** [lon,lat] degrees -> viewBox coordinates, under the single fitted scale. */
export function projectPoint([lonDeg, latDeg]: [number, number]): [number, number] {
  const [x, y] = naturalEarth1Radians((lonDeg * Math.PI) / 180, (latDeg * Math.PI) / 180);
  return [VIEWPORT.width / 2 + x * SCALE, VIEWPORT.height / 2 - y * SCALE];
}

function pointsToPathD(points: Array<[number, number]>, close: boolean): string {
  if (points.length < 2) return '';
  const [firstX, firstY] = points[0];
  const rest = points
    .slice(1)
    .map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  return `M ${firstX.toFixed(1)} ${firstY.toFixed(1)} ${rest}${close ? ' Z' : ''}`;
}

/**
 * GN-CD-045 — the projected {type:'Sphere'} boundary. Traced rather than
 * approximated, so the flat pole lines Natural Earth 1 actually produces are
 * present.
 */
export function sphereBoundaryPathD(): string {
  const ring: Array<[number, number]> = [];
  for (let lat = -90; lat <= 90; lat += 2) ring.push(projectPoint([180, lat]));
  ring.push(projectPoint([-180, 90]));
  for (let lat = 90; lat >= -90; lat -= 2) ring.push(projectPoint([-180, lat]));
  ring.push(projectPoint([180, -90]));
  return pointsToPathD(ring, true);
}

function simplifyRing(ring: Array<[number, number]>, keepEvery: number): Array<[number, number]> {
  if (ring.length <= 2 || keepEvery <= 1) return ring;
  const simplified: Array<[number, number]> = [];
  for (let i = 0; i < ring.length; i += keepEvery) simplified.push(ring[i]);
  const last = ring[ring.length - 1];
  if (simplified[simplified.length - 1] !== last) simplified.push(last);
  return simplified;
}

function ringToPathD(ring: Array<[number, number]>, keepEvery: number): string {
  const simplified = simplifyRing(ring, keepEvery);
  if (simplified.length < 2) return '';
  return pointsToPathD(simplified.map(projectPoint), true);
}

type Geometry =
  | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> }
  | { type: 'MultiPolygon'; coordinates: Array<Array<Array<[number, number]>>> };

function countryPathD(geometry: Geometry | null | undefined, keepEvery: number): string {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ringToPathD(ring, keepEvery)).join(' ');
  }
  return geometry.coordinates
    .map((polygon) => polygon.map((ring) => ringToPathD(ring, keepEvery)).join(' '))
    .join(' ');
}

/** GN-CD-046 — a meridian/parallel set at the given steps. */
function graticulePaths(lonStep: number, latStep: number, latLimit: number): string[] {
  const paths: string[] = [];
  for (let lon = -180; lon <= 180; lon += lonStep) {
    const points: Array<[number, number]> = [];
    for (let lat = -90; lat <= 90; lat += 5) points.push(projectPoint([lon, lat]));
    paths.push(pointsToPathD(points, false));
  }
  for (let lat = -latLimit; lat <= latLimit; lat += latStep) {
    const points: Array<[number, number]> = [];
    for (let lon = -180; lon <= 180; lon += 10) points.push(projectPoint([lon, lat]));
    paths.push(pointsToPathD(points, false));
  }
  return paths;
}

interface DecorativeMark {
  lon: number;
  lat: number;
  color: string;
}

/**
 * Fixed, arbitrary, UNLABELED decorative marks — no id, no place name, no
 * category claim, no real coordinate significance, no accessible name, no
 * tooltip. See this file's doc comment and CTO decision L-8.
 */
const DECORATIVE_MARKS: DecorativeMark[] = [
  { lon: -95, lat: 38, color: '#60a5fa' },
  { lon: -60, lat: -20, color: '#34d399' },
  { lon: -5, lat: 45, color: '#60a5fa' },
  { lon: 30, lat: 45, color: '#f87171' },
  { lon: 20, lat: 5, color: '#fb923c' },
  { lon: 45, lat: -10, color: '#22d3ee' },
  { lon: 78, lat: 25, color: '#a78bfa' },
  { lon: 115, lat: 30, color: '#a78bfa' },
  { lon: 105, lat: -5, color: '#fb923c' },
  { lon: 145, lat: -30, color: '#fb923c' },
];

/** The one emphasised decorative mark. Not a selection, not a place, not a signal. */
const FOCUS_MARK: DecorativeMark = DECORATIVE_MARKS[4];

/**
 * GN-CD-050 — the decorative lattice, as index pairs into the marks above.
 * Eight on desktop, the first three when compact. PRESENTATION ONLY.
 */
const DECORATIVE_LINKS: Array<[number, number]> = [
  [2, 0],
  [6, 7],
  [3, 5],
  [0, 1],
  [8, 9],
  [1, 4],
  [7, 8],
  [4, 3],
];

/**
 * GN-CD-048 — the ring multipliers and per-ring strokes. Presentation values
 * only: the scope-derived BASE radius that makes them an evidence claim is
 * deliberately absent (L-8), so the base below is a fixed decorative constant.
 */
const DECORATIVE_RING_BASE = 14;
const RING_MULTIPLIERS_DESKTOP = [1, 1.8, 2.7, 3.6];
const RING_MULTIPLIERS_COMPACT = [1, 2];

export function HeroIntelligenceField({
  compact = false,
  focus = null,
}: HeroIntelligenceFieldProps = {}): JSX.Element {
  const collection = getCountryFeatureCollection();

  /*
    M66.14B — THE RING STACK MOVES; NOTHING ELSE DOES.

    With no focus this is byte-for-byte the released render: the emphasis sits
    on FOCUS_MARK exactly as before, so a reader who never interacts sees
    today's hero. When a feed row is focused, the SAME ring stack — same
    DECORATIVE_RING_BASE, same multipliers, same per-ring strokes, same
    animation — relocates to the focused country and takes that article's
    category colour. No ring is added, no geometry is redrawn, and all ten
    decorative marks and eight links are untouched.

    This is the one part of CTO decision L-8 that expires, and only this part:
    L-8 withheld GN-CD-048's scope-derived emphasis because 'no backend route
    supplies geolocated intelligence signals'. One now does, at country
    precision. GN-CD-051's relationship paths and GN-CD-052's named,
    keyboard-focusable nodes remain unported — relationships still have no
    data, and this field is aria-hidden so nothing in it may be focusable.

    THE VIEWPORT NEVER MOVES. viewBox is still built from VIEWPORT constants;
    focus changes a circle's cx/cy, never a transform, pan or zoom.
  */
  const focusPoint = focus
    ? projectPoint([focus.lon, focus.lat])
    : projectPoint([FOCUS_MARK.lon, FOCUS_MARK.lat]);
  const focusColor = focus ? `rgb(${focus.channel})` : FOCUS_MARK.color;

  // Per-instance identifiers — see this file's doc comment. Same mechanism
  // Logo.tsx already uses; ':' is legal in a DOM id but not in a CSS class
  // selector, so the raw useId() value is sanitised before being used for the
  // animation class names.
  const uid = useId();
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '');
  const glowId = `gnaHifGlow-${safeUid}`;
  const ringClass = `gna-hif-ring-${safeUid}`;
  const markClass = `gna-hif-mark-${safeUid}`;
  const linkClass = `gna-hif-link-${safeUid}`;

  const graticule = compact ? graticulePaths(40, 30, 60) : graticulePaths(10, 10, 80);
  const links = compact ? DECORATIVE_LINKS.slice(0, 3) : DECORATIVE_LINKS;
  const marks = compact ? DECORATIVE_MARKS.filter((_, index) => index % 2 === 0) : DECORATIVE_MARKS;
  const ringMultipliers = compact ? RING_MULTIPLIERS_COMPACT : RING_MULTIPLIERS_DESKTOP;
  const keepEvery = compact ? 6 : 3;

  return (
    <div aria-hidden="true" className="relative h-full w-full overflow-hidden">
      <style>
        {`
          @keyframes ${ringClass}-kf { 0% { opacity: .55; transform: scale(.6); } 100% { opacity: 0; transform: scale(1.8); } }
          @keyframes ${markClass}-kf { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
          @keyframes ${linkClass}-kf { to { stroke-dashoffset: -200; } }
          .${ringClass} { transform-box: fill-box; transform-origin: center; }
          .${markClass} { animation: ${markClass}-kf 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .${linkClass} { animation: ${linkClass}-kf 14s linear infinite; }
          @media (prefers-reduced-motion: reduce) {
            .${ringClass}, .${markClass}, .${linkClass} {
              animation: none !important; opacity: .5 !important;
            }
          }
        `}
      </style>

      {/* GN-CD-044 — map atmosphere. Presentation only. */}
      <div className="pointer-events-none absolute inset-0 bg-cd-map-atm" />

      <svg
        viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`}
        className="relative h-full w-full"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* GN-CD-044 — the glow filter, at its released blur and filter region. */}
          <filter id={glowId} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* GN-CD-045 — the real projected sphere boundary, flat pole lines included. */}
        <path d={sphereBoundaryPathD()} fill="none" stroke="rgba(56,189,248,0.22)" strokeWidth="1" />

        {/* GN-CD-046 — graticule. 10x10 desktop, 40x30 compact: a geometry recomposition, not a dimming. */}
        <g
          fill="none"
          stroke={compact ? 'rgba(56,189,248,0.07)' : 'rgba(56,189,248,0.085)'}
          strokeWidth="0.6"
        >
          {graticule.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>

        {/* GN-CD-047 — real country geometry, at the released fill and stroke. */}
        <g fill="rgba(13,48,88,0.62)" stroke="rgba(56,189,248,0.42)" strokeWidth="0.55">
          {collection.features.map((feature: CountryFeature) => (
            <path key={feature.properties.numericId} d={countryPathD(feature.geometry as Geometry, keepEvery)} />
          ))}
        </g>

        {/* GN-CD-050 — the decorative lattice. Unlabeled, tooltip-free, never a real relationship. */}
        <g fill="none" strokeWidth="0.8" strokeDasharray="4 6" stroke="rgba(96,165,250,0.3)">
          {links.map(([from, to], index) => {
            const [x1, y1] = projectPoint([DECORATIVE_MARKS[from].lon, DECORATIVE_MARKS[from].lat]);
            const [x2, y2] = projectPoint([DECORATIVE_MARKS[to].lon, DECORATIVE_MARKS[to].lat]);
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={linkClass}
                style={{ animationDelay: `${(index * 0.6).toFixed(1)}s` }}
              />
            );
          })}
        </g>

        {/* GN-CD-048/049 ring PRESENTATION around the emphasised decorative mark. No scope, no evidence claim. */}
        <g>
          {ringMultipliers.map((multiplier, index) => (
            <circle
              key={index}
              cx={focusPoint[0]}
              cy={focusPoint[1]}
              r={DECORATIVE_RING_BASE * multiplier}
              fill="none"
              stroke={index === 0 ? focusColor : `rgba(34,211,238,${(0.26 - (index - 1) * 0.05).toFixed(2)})`}
              strokeOpacity={index === 0 ? 0.75 : 1}
              strokeWidth={index === 0 ? 1.1 : 0.7}
              strokeDasharray={index > 1 ? '3 5' : undefined}
              className={index === 0 ? ringClass : undefined}
              style={index === 0 ? { animation: `${ringClass}-kf 4.2s linear infinite` } : undefined}
            />
          ))}
          <circle cx={focusPoint[0]} cy={focusPoint[1]} r="3.4" fill={focusColor} filter={`url(#${glowId})`} />
        </g>

        {/* GN-CD-052 node PRESENTATION — halo, static ring, glowing core. No id, no label, no role, no tabindex. */}
        {marks.map((mark, index) => {
          const [x, y] = projectPoint([mark.lon, mark.lat]);
          return (
            <g key={index}>
              <circle cx={x} cy={y} r="8" fill={mark.color} opacity="0.1" />
              <circle
                cx={x}
                cy={y}
                r="5.6"
                fill="none"
                stroke={mark.color}
                strokeWidth="0.7"
                opacity="0.28"
              />
              <circle
                cx={x}
                cy={y}
                r={compact ? 3.1 : 2.6}
                fill={mark.color}
                filter={`url(#${glowId})`}
                className={markClass}
                style={{ animationDelay: `${(index * 0.35).toFixed(2)}s` }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
