'use client';

import { useMemo } from 'react';
import { getCountryFeatureCollection } from '@/lib/map/countryGeometry';
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  geometryToFramePath,
  meridians,
  parallels,
} from '@/components/today/todayMapProjection';

/**
 * R4 CORRECTION 1 — REAL GEOGRAPHY IN THE TODAY PANEL.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────
 *
 * An ordinal dot grid labelled SCHEMATIC INDEX · NOT COORDINATES. It was
 * honest, and it was not a map: a reader could not tell Kenya from Brazil by
 * looking at it. This draws the actual world.
 *
 * ── IT CONSUMES TWO EXISTING PRIMITIVES AND ADDS NEITHER ─────────────────
 *
 *   lib/map/countryGeometry         Natural Earth 1:110m admin-0, bundled as
 *                                   TopoJSON and already joined to our own
 *                                   CountryMeta by ISO 3166-1 NUMERIC id
 *   today/todayMapProjection        a Mercator frame clipped to the inhabited
 *                                   world — see that file for why an
 *                                   equirectangular frame could not deliver
 *                                   the zoom at a fixed width
 *
 * `lib/geo/equirectangularProjection` is left exactly as the Hero world visual
 * needs it. Two surfaces, two jobs: the Hero draws a decorative full-globe
 * band; this draws a readable map of where people actually are.
 *
 * The numeric-id join is why this file matches by `iso2` against curated
 * metadata rather than by name: fragile string matching between a geometry
 * dataset's names and ours is exactly what that primitive exists to avoid.
 * And reusing the Hero's projection means the two world visuals on this page
 * cannot disagree about where a country is.
 *
 * NOTHING IN `components/map/**` IS TOUCHED OR IMPORTED. The full World Map
 * page renders with maplibre-gl, a WebGL renderer that has no business on the
 * homepage; this is static SVG over the same underlying geometry.
 *
 * ── NO NEW PAYLOAD ───────────────────────────────────────────────────────
 *
 * The atlas chunk is ALREADY in the homepage's initial set — HeroWorldVisual,
 * HeroWorldVisualMobile and HeroIntelligenceField all consume it above the
 * fold. Verified in `.next/app-build-manifest.json`: chunk 9018 is listed for
 * `/page` before and after this change, and the homepage's First Load JS is
 * unmoved at 224 kB. A lazy import here would buy nothing and cost a frame of
 * empty canvas, so the import is plain.
 *
 * ── PRECISION: THE COUNTRY, AND NEVER FINER ──────────────────────────────
 *
 * Evidence is drawn by FILLING THE COUNTRY'S OWN SHAPE, not by placing a point
 * inside it. That is the whole argument for doing it this way: a dot has a
 * position, and any position inside a country is a claim about where in that
 * country the news came from — a claim nothing in the payload supports. A
 * filled outline says "this country" and can say nothing more precise.
 *
 * No city and no centroid is computed or rendered anywhere here.
 *
 * ── UNRESOLVED IS NEVER PLOTTED ──────────────────────────────────────────
 *
 * A record with no resolved country has no place on a map, so it is not given
 * one. It stays counted in the region's own rows, in words, where absence can
 * be stated rather than implied by a marker sitting somewhere arbitrary.
 */
interface TodayWorldCanvasProps {
  /** ISO-2 codes with evidence in this retrieval. Unresolved records are absent. */
  evidenceIso2: ReadonlySet<string>;
  /** ISO-2 of the filtered country, drawn brighter. */
  selectedIso2: string | null;
}

/* The evidence hue, unchanged from the schematic it replaces. */
const EVIDENCE = '#22d3ee';
const EVIDENCE_BRIGHT = '#67e8f9';
/*
  DESIGN-C2 LOCK 7 — SELECTION IS NOT EVIDENCE.

  Cyan on this surface means EVIDENCE. A browsing selection is the reader
  pointing at a country; it asserts nothing about what was retrieved there. So
  selection gets its own slate grammar and never borrows the evidence hue:
  a 2px slate ring OUTSIDE the country (C2-34), drawn beneath the country's own
  stroke so the slate reads as a halo.

  These are the accepted tokens, restored from the C2 authority — not new ones.
*/
const SELECT_RING = '#33465c';
/* Lock 7's "slate raised one step" against this surface's opaque land. */
const SELECT_LAND = '#1e3049';
/*
  LAND HAS TO BE VISIBLE OR IT IS NOT A MAP. The first pass used #0e1826 on a
  #080d14 panel — technically drawn, and unreadable at a glance, which fails
  the "visible world/country outlines" requirement as surely as a blank box
  would. These sit clearly above the panel while staying well below the cyan,
  so evidence still reads first.
*/
const LAND = '#16243a';
const LAND_EDGE = '#2f4763';

/* The frame's own units come from the projection module. */

interface CountryPath {
  key: string;
  iso2: string | null;
  d: string;
}

/*
  BUILT ONCE PER MODULE, NOT ONCE PER MOUNT. The path strings are the expensive
  part and they depend on nothing, so every later mount reuses them and
  re-rendering on selection costs one fill-colour change per country.
*/
let cachedWorld: CountryPath[] | null = null;

/** Computed once: the graticule depends on the frame, not on any prop. */
const GRATICULE = { parallels: parallels(), meridians: meridians() };

function buildWorld(): CountryPath[] {
  if (cachedWorld !== null) return cachedWorld;
  cachedWorld = getCountryFeatureCollection()
    /* The numeric id repeats across this collection ("000" appears more than
       once), so it cannot be the React key on its own. The map position is
       taken BEFORE the filter below, so the values stay distinct even though
       some entries are dropped, and no identifier is invented. */
    .features.map((f, index) => ({
      key: `${f.properties.numericId}-${index}`,
      iso2: f.properties.country?.iso2 ?? null,
      d: geometryToFramePath(f.geometry),
    }))
    /* A feature entirely outside the clip produces no path at all, so
       Antarctica is absent rather than laid along the bottom edge as a
       degenerate sliver. */
    .filter((f) => f.d.length > 0);
  return cachedWorld;
}

export function TodayWorldCanvas({
  evidenceIso2,
  selectedIso2,
}: TodayWorldCanvasProps): JSX.Element {
  const world = useMemo(buildWorld, []);

  return (
    <svg
      viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      {/*
        A GRATICULE, not decoration: real parallels every 15° and meridians
        every 30°, projected through the SAME frame as the coastlines — so the
        parallels bunch toward the top exactly as Mercator says they should.
      */}
      <g stroke="rgba(34,211,238,.09)" strokeWidth={0.3} fill="none">
        {GRATICULE.parallels.map((y) => (
          <line key={`p${y.toFixed(1)}`} x1={0} y1={y} x2={FRAME_WIDTH} y2={y} />
        ))}
        {GRATICULE.meridians.map((x) => (
          <line key={`m${x}`} x1={x} y1={0} x2={x} y2={FRAME_HEIGHT} />
        ))}
      </g>

      {world.map((f) => {
        const isEvidence = f.iso2 !== null && evidenceIso2.has(f.iso2);
        const isSelected = f.iso2 !== null && f.iso2 === selectedIso2;
        return (
          <g key={f.key}>
            {/* C2-34 — the OUTER slate selection ring, under the country. */}
            {isSelected ? (
              <path
                data-gn-select-ring="true"
                d={f.d}
                fill="none"
                stroke={SELECT_RING}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            ) : null}
            <path
              data-gn-evidence={isEvidence ? 'true' : 'false'}
              data-gn-selected={isSelected ? 'true' : 'false'}
              d={f.d}
              fill={isEvidence ? EVIDENCE : isSelected ? SELECT_LAND : LAND}
              fillOpacity={isEvidence ? 0.72 : 1}
              stroke={isEvidence ? EVIDENCE_BRIGHT : isSelected ? SELECT_RING : LAND_EDGE}
              strokeWidth={isEvidence ? 0.4 : isSelected ? 0.35 : 0.25}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
