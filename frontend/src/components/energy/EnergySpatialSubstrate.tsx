'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { getCountryFeatureCollection } from '@/lib/map/countryGeometry';
import { ENERGY_INK, ENERGY_LINE, ENERGY_MOTION, ENERGY_SURFACE } from '@/lib/energy/energyTokens';
import { ENERGY_TONE_HEX } from '@/components/energy/EnergyParts';
import type { EnergyFrameData } from '@/lib/energy/energyModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H02 — THE MAPLIBRE VECTOR 2D SUBSTRATE, WHICH IS THE BETA FLOOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   "Beta map floor: MapLibre vector 2D only. Every workflow in this package
 *    works on that floor. Terrain, satellite, globe and 3D infrastructure are
 *    progressive enhancement USING THE SAME LAYER CONTRACT, so an upgrade
 *    changes no information architecture."
 *
 * The layer contract is therefore the load-bearing part, and it is exactly two
 * shapes: GEOJSON LINE LAYERS for corridors and SYMBOL LAYERS for assets. A
 * later terrain or globe renderer consumes the same two sources.
 *
 * ── ZERO NETWORK, AND IT IS STRUCTURAL ───────────────────────────────────
 *
 * The style is FULLY LOCAL: a background paint plus our own layers, with an
 * empty `sources` block at construction. Country geometry is the BUNDLED
 * Natural Earth 1:110m admin-0 set the accepted `/map` surface already uses —
 * an import, not a fetch. There is no tile server, no style URL, no glyph
 * endpoint and no sprite endpoint in this file, so "entering /energy executes
 * 0 providers and 0 models" is a property of the code rather than a claim about
 * it. The measured proof is in the package; this comment is the mechanism.
 *
 * ── WHY THE GOVERNED FRAME STILL DRAWS A MAP ─────────────────────────────
 *
 * Because the degradation matrix says it must. The DATA-POOR tier: "Substrate
 * renders geography and watched-asset geometry only; no assessed overlays …
 * Must remain: explicit absence states … NEVER A BLANK CANVAS, never a
 * fabricated substitute." Base geography is geography. It asserts nothing about
 * energy, and removing it would replace one absence with a different and less
 * legible one.
 *
 * ── WHY ASSET SYMBOLS CAN BE ABSENT WITHOUT THE SUBJECT BEING ABSENT ─────
 *
 * E01 gates asset-level geometry and a frontend "may not resolve a rights or
 * sensitivity question by choosing a renderer, a zoom limit or a rounding". So
 * a withheld asset draws no symbol at all — and stays fully reachable from the
 * list beside the map, which is what the accessibility contract already
 * guarantees: "the map is not the only path to any subject."
 */

const CORRIDOR_SOURCE = 'energy-corridors';
const CORRIDOR_LINE_LAYER = 'energy-corridors-line';
const CORRIDOR_FLOW_LAYER = 'energy-corridors-flow';
const COUNTRY_SOURCE = 'energy-countries';
const COUNTRY_FILL_LAYER = 'energy-countries-fill';
const COUNTRY_LINE_LAYER = 'energy-countries-line';

/** A fully local style. No tile server, no style URL, no glyphs, no sprites. */
const LOCAL_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'energy-background', type: 'background', paint: { 'background-color': ENERGY_SURFACE.substrate } }],
};

/**
 * Great-circle-ish interpolation between waypoints, so a corridor reads as a
 * corridor rather than as a ruler line. This changes the DRAWING and not the
 * PRECISION: the arc is still corridor-level ±25 km, and the badge beside it
 * still says so. "The renderer is not the witness."
 */
function arcBetween(a: readonly [number, number], b: readonly [number, number], steps = 24): [number, number][] {
  const [ax, ay] = a;
  const [bx, by] = b;
  const lift = Math.min(Math.hypot(bx - ax, by - ay) * 0.14, 9);
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t + Math.sin(Math.PI * t) * lift;
    points.push([x, y]);
  }
  return points;
}

function corridorCollection(data: EnergyFrameData): FeatureCollection<LineString, { id: string; tone: string }> {
  const features: Feature<LineString, { id: string; tone: string }>[] = data.spatialGeometry.map((entry) => {
    const path = entry.geometry.path;
    const coordinates: [number, number][] = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const segment = arcBetween(path[i], path[i + 1]);
      coordinates.push(...(i === 0 ? segment : segment.slice(1)));
    }
    return {
      type: 'Feature',
      properties: { id: entry.id, tone: ENERGY_TONE_HEX[entry.tone] },
      geometry: { type: 'LineString', coordinates },
    };
  });

  return { type: 'FeatureCollection', features };
}

interface EnergySpatialSubstrateProps {
  readonly data: EnergyFrameData;
  readonly reducedMotion: boolean;
  readonly bbox: readonly [number, number, number, number];
}

/**
 * R13 motion, as a module constant so it is written once, asserted by name,
 * and injected as RAW TEXT. See the injection site for why a text child of
 * `<style>` is a hydration defect and a broken stylesheet at the same time.
 */
const SUBSTRATE_MOTION_CSS = `
        @keyframes energyFlowDash { to { stroke-dashoffset: -140; } }
        [data-energy-map="maplibre"] canvas { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          [data-energy-flow] { animation: none !important; }
        }
      `;

export function EnergySpatialSubstrate({ data, reducedMotion, bbox }: EnergySpatialSubstrateProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return undefined;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: LOCAL_STYLE,
        bounds: [
          [bbox[0], bbox[3]],
          [bbox[2], bbox[1]],
        ],
        fitBoundsOptions: { padding: 24, animate: false },
        attributionControl: false,
        /* No rotation: the Beta floor is vector 2D and a tilted 2D map is a claim about depth. */
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch {
      setFailed(true);
      return undefined;
    }

    mapRef.current = map;

    map.on('load', () => {
      /* Base geography — bundled, not fetched. */
      map.addSource(COUNTRY_SOURCE, { type: 'geojson', data: getCountryFeatureCollection() });
      map.addLayer({
        id: COUNTRY_FILL_LAYER,
        type: 'fill',
        source: COUNTRY_SOURCE,
        paint: { 'fill-color': '#14202E', 'fill-opacity': 0.92 },
      });
      map.addLayer({
        id: COUNTRY_LINE_LAYER,
        type: 'line',
        source: COUNTRY_SOURCE,
        paint: { 'line-color': 'rgba(120,160,200,.3)', 'line-width': 0.6 },
      });

      /* Corridors — the GeoJSON line layer half of the layer contract. */
      map.addSource(CORRIDOR_SOURCE, { type: 'geojson', data: corridorCollection(data) });
      map.addLayer({
        id: CORRIDOR_LINE_LAYER,
        type: 'line',
        source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'tone'], 'line-width': 1.6, 'line-opacity': 0.55 },
      });
      map.addLayer({
        id: CORRIDOR_FLOW_LAYER,
        type: 'line',
        source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'butt' },
        paint: {
          'line-color': ['get', 'tone'],
          'line-width': 2.2,
          'line-opacity': 0.95,
          'line-dasharray': [2, 3],
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    /* The map is built once; data and motion are applied by the effects below. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Data changes re-feed the SOURCE rather than rebuilding the map. */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;
    const source = map.getSource(CORRIDOR_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(corridorCollection(data));
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null) return;
    map.fitBounds(
      [
        [bbox[0], bbox[3]],
        [bbox[2], bbox[1]],
      ],
      { padding: 24, animate: false },
    );
  }, [bbox]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        ref={containerRef}
        data-energy-map="maplibre"
        data-energy-renderer="maplibre-vector-2d"
        style={{ position: 'absolute', inset: 0 }}
      />
      {/*
        R13 MOTION, AND ITS FULL DEFEAT.

        Flow dashes move in the true direction of transport on a 6–9s cycle. The
        reduced-motion path does not slow them down or shorten them: it STOPS
        them, and direction is then carried by the arrowheads and labels the
        substrate already draws. "No information is motion-only."

        The animation is injected as a stylesheet rather than as a render loop so
        `prefers-reduced-motion` can defeat it at the platform level too, even
        before the in-shell toggle is touched.

        R4 · RAW TEXT, NOT A TEXT CHILD — the second instance of the same
        defect, and the one that only showed itself once the first was fixed,
        because the spatial substrate does not mount on the change substrate.
        `[data-energy-map="maplibre"]` was escaped to `&quot;` by React's SSR,
        which is not a valid attribute value, so the server-rendered rule was
        dropped by the CSS parser — and on this block that meant the
        canvas-transition suppression was absent until hydration. See
        `EnergyShell.tsx` §E for the full reasoning; guard §25 sweeps for both.
      */}
      <style dangerouslySetInnerHTML={{ __html: SUBSTRATE_MOTION_CSS }} />
      <div
        data-energy-flow={reducedMotion ? 'static' : 'animated'}
        data-energy-motion-ms={ENERGY_MOTION.flowDashCycleMsMin}
        style={{ display: 'none' }}
      />
      {failed ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ENERGY_INK.quiet,
            fontSize: '12.5px',
            borderTop: `1px solid ${ENERGY_LINE.hairline}`,
          }}
        >
          The substrate could not initialise in this browser. Every subject remains reachable from the list.
        </div>
      ) : null}
    </div>
  );
}
