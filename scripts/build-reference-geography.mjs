#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * BUILD THE REFERENCE-GEOGRAPHY BASELINE — GOVERNED, REPRODUCIBLE, OFFLINE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PO ruling D-2: "Close the empty-canvas defect with BUNDLED provider-neutral
 * local geography. Use a governed Natural Earth 1:50m vector baseline suitable
 * for the existing MapLibre rendering path... Do not introduce a
 * commercial/vendor basemap dependency for this correction."
 *
 * This script turns the upstream Natural Earth 1:50m GeoJSON into the two
 * shapes the product actually renders:
 *
 *   1. PUBLIC GEOJSON  -> frontend/public/reference/*.json
 *      Inland water, rivers and sub-national lines, fetched by MapLibre as
 *      ordinary same-origin sources.
 *
 *      COASTLINE AND ADMIN-0 LINES ARE DELIBERATELY NOT EMITTED. The spatial
 *      surface draws both from its own 1:50m country polygons
 *      (`spatialCountryGeometry.ts`); emitting them here produced a second
 *      rendering of the same edge, which is the registration seam the C904
 *      review rejected. This script ships only what the base geometry does
 *      not already contain. No tile server, no style server, no token, no viewport leaves
 *      the browser. The product keeps ZERO external map endpoints, which is
 *      the guarantee `labelPlacement.ts` and `basemapSource.ts` both record.
 *
 *   2. LABEL SEEDS     -> frontend/src/lib/map/labels/referencePlaces.ts
 *      Lake, river and city label anchors as a plain TS array, so they enter
 *      the EXISTING greedy collision grid through `referenceLabelCandidates`
 *      exactly like CONTINENT_LABELS and WATER_LABELS already do. The label
 *      system already declares `lake`, `city` and `river` in `LabelKind` with
 *      priorities 3, 4 and 5 — this feeds a seam that was built and never
 *      supplied. No second label system is introduced.
 *
 * ── WHY THE PUBLIC FOLDER AND NOT THE BACKEND ───────────────────────────────
 *
 * Reference geography is NOT evidence, and the failure that produced this
 * ruling was the backend losing its data files at packaging time. Serving the
 * reference layers from the frontend's own static assets makes the separation
 * structural rather than a convention: the map still draws the world when the
 * evidence API is down, and a reference layer can never be mistaken for an
 * evidence source because it does not come from the evidence service.
 *
 * ── THE RWANDA EXCLUSION IS DELIBERATE AND LOAD-BEARING ─────────────────────
 *
 * PO ruling D-2: "The Rwanda NISR geometry remains the Rwanda administrative
 * authority." Natural Earth also carries Rwandan provincial lines. Shipping
 * both would put a second, unofficial administrative source on the same map,
 * and a reader could not tell which one they were looking at. Every RWA
 * feature is therefore dropped from the admin-1 layer, and the count of what
 * was dropped is written into the manifest so the exclusion is auditable
 * rather than assumed.
 *
 * ── PROVENANCE ──────────────────────────────────────────────────────────────
 *
 * Natural Earth is public domain (https://www.naturalearthdata.com/about/terms-of-use/).
 * Upstream: nvkelso/natural-earth-vector, the `geojson/` directory.
 * Every input's sha256 is pinned below and re-verified on every run, so a
 * swapped or truncated source fails the build instead of shipping as
 * "official reference geography".
 *
 * USAGE
 *   node scripts/build-reference-geography.mjs --src <dir-of-ne-geojson> --repo <worktree>
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* ── THE PINNED BASELINE ──────────────────────────────────────────────────── */

const SOURCES = {
  lakes: {
    file: 'ne_50m_lakes.geojson',
    sha256: 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52',
  },
  rivers: {
    file: 'ne_50m_rivers_lake_centerlines.geojson',
    sha256: 'f286e0ce978fde999ca2d7a78c764be08542e19b63cded52b05c12d5173ccc51',
  },
  admin1Lines: {
    file: 'ne_50m_admin_1_states_provinces_lines.geojson',
    sha256: '72cca93c850d412628a5da4bc5ebfe21ba4d376eb34611bde6b623ee73f0fdcf',
  },
  places: {
    file: 'ne_50m_populated_places_simple.geojson',
    sha256: '8e70756b39fae9bcdc1e332bfc510c024c5edd3a13203ffd20092ee37b61d978',
  },
};

/**
 * The administrative authority that owns Rwanda. Natural Earth's own Rwandan
 * provincial lines are dropped rather than drawn beside it.
 */
const ADMINISTRATIVE_AUTHORITY_ISO3 = new Set(['RWA']);

/**
 * 4 decimal places is ~11 m at the equator. The source is 1:50 000 000 data
 * whose own positional error is orders of magnitude larger, so this discards
 * noise, not detail — and it is roughly half the bytes.
 */
const COORD_DP = 4;

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function round(value) {
  const factor = 10 ** COORD_DP;
  return Math.round(value * factor) / factor;
}

/** Rounds every coordinate in place, at any nesting depth. */
function roundGeometry(coords) {
  if (typeof coords[0] === 'number') {
    return [round(coords[0]), round(coords[1])];
  }
  return coords.map(roundGeometry);
}

function readSource(dir, key) {
  const spec = SOURCES[key];
  const raw = readFileSync(join(dir, spec.file));
  const digest = sha256(raw);

  if (digest !== spec.sha256) {
    throw new Error(
      `${spec.file}: sha256 ${digest} does not match the pinned baseline ${spec.sha256}. ` +
        'The reference baseline is governed — update the pin deliberately or fix the source.',
    );
  }

  return JSON.parse(raw.toString('utf8'));
}

/** Keeps ONLY the listed property keys, lower-cased, dropping null/empty. */
function prune(properties, keep) {
  const out = {};
  for (const [from, to] of Object.entries(keep)) {
    const value = properties[from];
    if (value === null || value === undefined || value === '') continue;
    out[to] = value;
  }
  return out;
}

function featureCollection(features) {
  return { type: 'FeatureCollection', features };
}

/**
 * Bounding-box centre of a geometry — the anchor a lake or river label hangs
 * from. Adequate because the collision grid decides whether the label is drawn
 * at all; a centroid refinement would change which labels survive, which is a
 * design decision and not this script's to make.
 */
function bboxCentre(coords) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const visit = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
      return;
    }
    for (const child of c) visit(child);
  };

  visit(coords);

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [round((minX + maxX) / 2), round((minY + maxY) / 2)];
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DEDUPLICATION BY GOVERNED IDENTITY — PO RULING B, C906
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED ALPHA FAILURE: ANGARA, ERTIS, ALBERT NILE, BAHR EL JEBEL, LUALABA
 * and SHIRE repeated across the viewport.
 *
 * The Product Owner asked me to VERIFY the root cause rather than assume it,
 * and the measurement is worth recording because it is only part of the story:
 *
 *     river seeds   449 rows / 342 distinct names / 103 names duplicated
 *     worst offenders   Ob x4, Abay x3, Huang x3, Albert Nile x2, Angara x2
 *
 * So one-label-per-segment is real — Natural Earth splits a long river into
 * named reaches and C905 emitted a seed for each — but 2x duplication does not
 * by itself produce the wall in the screenshots. The other half is the zoom
 * gate and the projection guard, both fixed in `labelSources.ts`. This half
 * fixes the DATA: one governed identity, one label.
 *
 * ── ONE BEST CARTOGRAPHIC ANCHOR, CHOSEN BY EXTENT ──────────────────────────
 *
 * When several features share a name, the label belongs on the LONGEST of
 * them — the reach a reader would call "the Angara" — not on whichever segment
 * happened to be first in the file. Extent is measured as the bounding-box
 * diagonal, which is stable, cheap and needs no projection.
 *
 * The ruling's escape clause is respected by NOT implementing it: *"if a very
 * long feature genuinely deserves repetition, that is a separate explicit
 * high-zoom rule, never automatic one-label-per-segment."* There is no such
 * rule here, so a long river gets exactly one label.
 */
function bboxDiagonal(coords) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const visit = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
      return;
    }
    for (const child of c) visit(child);
  };

  visit(coords);

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return 0;
  return Math.hypot(maxX - minX, maxY - minY);
}

/**
 * One row per name, keeping the row with the greatest extent.
 *
 * `minZoom` is taken as the MINIMUM across the merged set, because the surviving
 * anchor represents the whole feature and the feature is as prominent as its
 * most prominent reach.
 */
function dedupeByName(rows) {
  const best = new Map();

  for (const row of rows) {
    const current = best.get(row.name);

    if (current === undefined) {
      best.set(row.name, { ...row });
      continue;
    }

    current.minZoom = Math.min(current.minZoom, row.minZoom);

    if (row.extent > current.extent) {
      best.set(row.name, { ...row, minZoom: current.minZoom });
    }
  }

  return [...best.values()].map(({ extent, ...rest }) => {
    void extent;
    return rest;
  });
}

/* ── THE BUILD ────────────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2);
  const srcDir = args[args.indexOf('--src') + 1];
  const repo = args[args.indexOf('--repo') + 1];

  if (!srcDir || !repo) {
    throw new Error('usage: build-reference-geography.mjs --src <dir> --repo <worktree>');
  }

  const publicDir = join(repo, 'frontend', 'public', 'reference');
  mkdirSync(publicDir, { recursive: true });

  const manifest = { generator: 'scripts/build-reference-geography.mjs', layers: {} };

  const emit = (name, collection, note) => {
    const text = `${JSON.stringify(collection)}\n`;
    const path = join(publicDir, `${name}.json`);
    writeFileSync(path, text);
    manifest.layers[name] = {
      file: `frontend/public/reference/${name}.json`,
      features: collection.features.length,
      bytes: Buffer.byteLength(text),
      sha256: sha256(text),
      note,
    };
  };

  /* ── LAKES ─────────────────────────────────────────────────────────────── */
  const lakeSeeds = [];
  {
    const src = readSource(srcDir, 'lakes');
    const features = src.features.map((f) => {
      const props = prune(f.properties, { name: 'name', name_pl: 'namePl', min_zoom: 'minZoom' });
      const coordinates = roundGeometry(f.geometry.coordinates);

      if (typeof props.name === 'string') {
        const centre = bboxCentre(coordinates);
        if (centre !== null) {
          lakeSeeds.push({
            kind: 'lake',
            name: props.name,
            namePl: props.namePl,
            lon: centre[0],
            lat: centre[1],
            minZoom: typeof props.minZoom === 'number' ? props.minZoom : 4,
            extent: bboxDiagonal(coordinates),
          });
        }
      }

      return {
        type: 'Feature',
        properties: props,
        geometry: { type: f.geometry.type, coordinates },
      };
    });

    emit('lakes', featureCollection(features), 'Inland water bodies, drawn as fill beneath all evidence.');
  }

  /* ── RIVERS ────────────────────────────────────────────────────────────── */
  const riverSeeds = [];
  {
    const src = readSource(srcDir, 'rivers');
    const features = src.features.map((f) => {
      const props = prune(f.properties, { name: 'name', min_zoom: 'minZoom' });
      const coordinates = roundGeometry(f.geometry.coordinates);

      if (typeof props.name === 'string') {
        const centre = bboxCentre(coordinates);
        if (centre !== null) {
          riverSeeds.push({
            kind: 'river',
            name: props.name,
            lon: centre[0],
            lat: centre[1],
            minZoom: typeof props.minZoom === 'number' ? props.minZoom : 5,
            extent: bboxDiagonal(coordinates),
          });
        }
      }

      return { type: 'Feature', properties: props, geometry: { type: f.geometry.type, coordinates } };
    });

    emit('rivers', featureCollection(features), 'River and lake centrelines.');
  }

  /* ── ADMIN-1 BOUNDARY LINES, MINUS THE NISR-GOVERNED COUNTRY ───────────── */
  {
    const src = readSource(srcDir, 'admin1Lines');
    const excluded = src.features.filter((f) =>
      ADMINISTRATIVE_AUTHORITY_ISO3.has(String(f.properties.ADM0_A3)),
    );
    const kept = src.features.filter(
      (f) => !ADMINISTRATIVE_AUTHORITY_ISO3.has(String(f.properties.ADM0_A3)),
    );

    emit(
      'admin1-lines',
      featureCollection(
        kept.map((f) => ({
          type: 'Feature',
          properties: prune(f.properties, { ADM0_A3: 'adm0A3', MIN_ZOOM: 'minZoom' }),
          geometry: { type: f.geometry.type, coordinates: roundGeometry(f.geometry.coordinates) },
        })),
      ),
      `Sub-national boundaries. ${excluded.length} feature(s) excluded for ` +
        `${[...ADMINISTRATIVE_AUTHORITY_ISO3].join(', ')} — that country's administrative ` +
        'authority is NISR, and a second unofficial source must not be drawn beside it.',
    );

    manifest.administrativeAuthorityExclusion = {
      iso3: [...ADMINISTRATIVE_AUTHORITY_ISO3],
      excludedFeatures: excluded.length,
      reason: 'PO ruling D-2 — NISR remains the Rwanda administrative authority.',
    };
  }

  /* ── POPULATED PLACES — LABEL SEEDS ONLY, NO GEOMETRY LAYER ────────────── */
  const citySeeds = [];
  {
    const src = readSource(srcDir, 'places');
    for (const f of src.features) {
      const name = f.properties.name;
      if (typeof name !== 'string' || name === '') continue;

      const [lon, lat] = f.geometry.coordinates;

      citySeeds.push({
        kind: 'city',
        /* A point has no extent, so prominence IS the tie-break for a shared name. */
        extent: 20 - Number(f.properties.scalerank ?? 10),
        name,
        iso3: f.properties.adm0_a3 ?? undefined,
        lon: round(lon),
        lat: round(lat),
        /* Lower scalerank = more prominent. Inverted into a weight so the
           collision grid's "higher weight first" rule reads correctly. */
        weight: 20 - Number(f.properties.scalerank ?? 10),
        minZoom: Number(f.properties.min_zoom ?? 3),
        capital: Number(f.properties.adm0cap ?? 0) === 1,
      });
    }
  }

  /* ── THE TS SEED MODULE ────────────────────────────────────────────────── */
  {
    /*
      PO RULING B — ONE GOVERNED IDENTITY, ONE LABEL. Applied here rather than
      at render time so the shipped data itself carries the guarantee and no
      surface can reintroduce the wall by forgetting to deduplicate.
    */
    const lakeRows = dedupeByName(lakeSeeds);
    const riverRows = dedupeByName(riverSeeds);
    const cityRows = dedupeByName(citySeeds);

    const body = `/**
 * GENERATED — DO NOT EDIT BY HAND.
 * Produced by scripts/build-reference-geography.mjs from the pinned
 * Natural Earth 1:50m baseline. Public domain; see the script for provenance
 * and the per-source sha256 pins.
 *
 * These are LABEL ANCHORS ONLY. They feed \`referenceLabelCandidates\`, which
 * feeds the existing greedy collision grid in \`labelPlacement.ts\`. They are
 * reference geography: they never carry evidence, never raise precision, and
 * never create reporting.
 */

export interface ReferencePlaceSeed {
  readonly kind: 'lake' | 'river' | 'city';
  readonly name: string;
  /** Present only where Natural Earth supplies one. Never machine-translated. */
  readonly namePl?: string;
  readonly iso3?: string;
  readonly lon: number;
  readonly lat: number;
  /** Higher is more prominent; ties broken by the collision grid. */
  readonly weight?: number;
  readonly minZoom: number;
  readonly capital?: boolean;
}

/**
 * WHY THREE HOMOGENEOUS TABLES AND NOT ONE TAGGED ARRAY.
 *
 * MEASURED, NOT PREFERRED: a single array of ~2 000 literals each carrying a
 * \`kind\` drawn from a three-way union made the compiler give up —
 *
 *     error TS2590: Expression produces a union type that is too complex to
 *     represent.
 *
 * — which would have failed the real build. Splitting the tag out leaves three
 * homogeneous arrays the checker handles trivially, drops ~20 KB of repeated
 * tag strings, and makes each row's kind a structural guarantee rather than a
 * value that could be mistyped in generated output.
 */
interface ReferencePlaceRow {
  readonly name: string;
  readonly namePl?: string;
  readonly iso3?: string;
  readonly lon: number;
  readonly lat: number;
  readonly weight?: number;
  readonly minZoom: number;
  readonly capital?: boolean;
}

const LAKE_ROWS: readonly ReferencePlaceRow[] = ${JSON.stringify(lakeRows.map(({ kind, ...rest }) => rest), null, 0)};

const RIVER_ROWS: readonly ReferencePlaceRow[] = ${JSON.stringify(riverRows.map(({ kind, ...rest }) => rest), null, 0)};

const CITY_ROWS: readonly ReferencePlaceRow[] = ${JSON.stringify(cityRows.map(({ kind, ...rest }) => rest), null, 0)};

const tagged = (
  rows: readonly ReferencePlaceRow[],
  kind: ReferencePlaceSeed['kind'],
): readonly ReferencePlaceSeed[] => rows.map((row) => ({ ...row, kind }));

export const REFERENCE_PLACE_SEEDS: readonly ReferencePlaceSeed[] = [
  ...tagged(LAKE_ROWS, 'lake'),
  ...tagged(RIVER_ROWS, 'river'),
  ...tagged(CITY_ROWS, 'city'),
];

export const REFERENCE_PLACE_COUNTS = {
  lake: ${lakeRows.length},
  river: ${riverRows.length},
  city: ${cityRows.length},
} as const;
`;

    const path = join(repo, 'frontend', 'src', 'lib', 'map', 'labels', 'referencePlaces.ts');
    writeFileSync(path, body);
    manifest.labelSeeds = {
      file: 'frontend/src/lib/map/labels/referencePlaces.ts',
      lake: lakeRows.length,
      river: riverRows.length,
      city: cityRows.length,
      deduplicated: {
        lake: lakeSeeds.length - lakeRows.length,
        river: riverSeeds.length - riverRows.length,
        city: citySeeds.length - cityRows.length,
      },
      bytes: Buffer.byteLength(body),
      sha256: sha256(body),
    };
  }

  /* ── THE MANIFEST ─────────────────────────────────────────────────────── */
  manifest.sources = Object.fromEntries(
    Object.entries(SOURCES).map(([key, spec]) => [key, { file: spec.file, sha256: spec.sha256 }]),
  );
  manifest.attribution =
    'Reference geography: Natural Earth (public domain), 1:50m physical and cultural vectors.';

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(join(publicDir, 'MANIFEST.json'), manifestText);

  process.stdout.write(manifestText);
}

main();
