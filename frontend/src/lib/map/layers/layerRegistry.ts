import type { MapMode } from '@/lib/map/state/mapState';

/**
 * SPATIAL M2 — THE LAYER REGISTRY, FROM DESIGN PART I §F.
 *
 * "Every layer is classified as REFERENCE (geography the world has) or
 * EVIDENCE (geography the platform knows), given a visible zoom range, a data
 * dependency and a tier. A LAYER MAY NEVER CHANGE CLASS."
 *
 * That last sentence is the reason this is a registry rather than a list of
 * booleans in a component. The class is what stops a reference outline from
 * being read as a claim: slate district borders are geography the world has,
 * and if a layer could move from REFERENCE to EVIDENCE then drawing more of
 * the world would start meaning knowing more about it. `class` is therefore
 * declared here, once, and no function in this module can change it.
 *
 * The rail reads this registry. Part II §2: LayerToggleRail "reads the layer
 * registry, renders toggles the surface permits". It does not hold its own
 * list, so a layer cannot exist on the map without appearing in the legend's
 * vocabulary and the registry's licence record.
 */

export type LayerClass = 'REFERENCE' | 'EVIDENCE';

/** Part I §F's own column: what is buildable now vs what waits for data. */
export type LayerTier = 'implement-next' | 'beta' | 'later' | 'experimental';

/**
 * ── RUNTIME TRUTH — MAIN-FINAL-CORRECTED-ALPHA-CONVERGENCE-1, PO RULING 5 ──
 *
 * "A layer may be visible/toggleable only if implementation exists AND runtime
 * backing exists AND the activation gate is green. Otherwise classify GATED /
 * NOT IMPLEMENTED / FAILED MEASUREMENT. Do not create decorative toggles."
 *
 * THIS IS A DIFFERENT AXIS FROM `tier`, WHICH IS WHY IT IS A NEW FIELD RATHER
 * THAN A REINTERPRETATION OF ONE. `tier` is Part I §F's ROADMAP column — when
 * the programme intends to build a layer. `runtime` is what is true right now.
 * A layer can be `implement-next` and `GATED` at the same time without either
 * statement being wrong, and collapsing them would lose one of them.
 *
 *   LIVE               implementation and runtime backing both exist, gate green
 *   GATED              implemented, but a named gate is closed — the gate is stated
 *   NOT_IMPLEMENTED    no implementation and/or no dataset exists anywhere
 *   FAILED_MEASUREMENT could not be established from this environment; never
 *                      assumed to be either of the other two
 *
 * `available` is now DERIVED from this and is no longer hand-set, so a layer
 * cannot be offered as enabled while its backing is absent — which is exactly
 * what `watch` was doing before this ruling.
 */
export type LayerRuntimeStatus = 'LIVE' | 'GATED' | 'NOT_IMPLEMENTED' | 'FAILED_MEASUREMENT';

export interface LayerDefinition {
  readonly id: string;
  /** REFERENCE or EVIDENCE. Immutable — see the note above. */
  readonly class: LayerClass;
  /** [minZoom, maxZoom] from Part I §F. Outside it the layer is not drawn. */
  readonly zoomRange: readonly [number, number];
  readonly tier: LayerTier;
  /** PO ruling 5 — what is true at runtime today. See `LayerRuntimeStatus`. */
  readonly runtime: LayerRuntimeStatus;
  /** The closed gate or the missing dataset, in the layer's own words. */
  readonly runtimeEvidence: string;
  /**
   * DERIVED from `runtime` — never hand-set. Whether this layer may be offered
   * as an enabled toggle at all. An unavailable layer renders as a disabled
   * toggle with a stated reason, never as an enabled toggle that silently draws
   * nothing — Part II §6's "unavailable rather than empty" rule applied to
   * layers as well as modes.
   */
  readonly available: boolean;
  /** Attribution obligation, recorded next to the layer that incurs it. */
  readonly licence: string;
  /** Modes in which this layer may be offered at all. Empty = every mode. */
  readonly modes: readonly MapMode[];
  /** Default toggle state before the user has expressed a preference. */
  readonly defaultOn: boolean;
}

/**
 * Read straight off Part I §F, in its order. Zoom ranges, licences and tiers
 * are the spec's, not mine — which is what makes this table auditable against
 * the document rather than against my memory of it.
 */
export const LAYER_REGISTRY: readonly LayerDefinition[] = [
  {
    id: 'base', class: 'REFERENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'LIVE',
    runtimeEvidence:
      'Natural Earth admin-0 ships in the bundle and is drawn on every frame.',
    available: true, licence: 'Natural Earth — public domain', modes: [], defaultOn: true,
  },
  {
    id: 'admin0', class: 'REFERENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'LIVE',
    runtimeEvidence:
      'Same bundled world-atlas geometry as `base`; no network dependency.',
    available: true, licence: 'Natural Earth — public domain', modes: [], defaultOn: true,
  },
  {
    id: 'hydrography', class: 'REFERENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'LIVE',
    runtimeEvidence:
      'Natural Earth lakes ship in the bundle.',
    available: true, licence: 'Natural Earth lakes 50m/10m — public domain', modes: [], defaultOn: true,
  },
  {
    id: 'rivers', class: 'REFERENCE', zoomRange: [4, 11], tier: 'implement-next',
    runtime: 'NOT_IMPLEMENTED',
    runtimeEvidence:
      'No centreline dataset is present in the product.',
    available: false, licence: 'Natural Earth centerlines — public domain', modes: [], defaultOn: false,
  },
  {
    id: 'places', class: 'REFERENCE', zoomRange: [3, 13], tier: 'implement-next',
    runtime: 'NOT_IMPLEMENTED',
    runtimeEvidence:
      'No populated-places dataset is wired to the renderer.',
    available: false, licence: 'Natural Earth populated places — public domain', modes: [], defaultOn: false,
  },
  {
    id: 'labels', class: 'REFERENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'LIVE',
    runtimeEvidence:
      'DOM collision grid in `labelPlacement.ts`; no glyph server needed.',
    available: true, licence: 'Natural Earth — public domain', modes: [], defaultOn: true,
  },
  {
    id: 'graticule', class: 'REFERENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'LIVE',
    runtimeEvidence:
      'Generated client-side from the camera; no dataset at all.',
    available: true, licence: 'Generated — no third-party data', modes: [], defaultOn: false,
  },
  {
    id: 'countryEvidence', class: 'EVIDENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'LIVE',
    runtimeEvidence:
      '`/geo/map-feed` is served: GeoModule is registered in app.module.ts.',
    available: true, licence: 'GlobalNews AI evidence store — internal',
    modes: ['WORLD', 'EVIDENCE', 'WATCH', 'CHANGE'], defaultOn: true,
  },
  {
    id: 'evidencePoints', class: 'EVIDENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'GATED',
    runtimeEvidence:
      'GATE: no producer emits point-precision evidence. `PRODUCIBLE_SPATIAL_PRECISION` is [\'COUNTRY\',\'UNKNOWN\'] and `rendersAsPoint` admits EXACT|CITY only, so this layer can draw nothing today. The gate is the producer, not this code.',
    available: false, licence: 'GlobalNews AI evidence store — internal',
    modes: ['EVIDENCE', 'CHANGE'], defaultOn: true,
  },
  {
    id: 'watch', class: 'EVIDENCE', zoomRange: [1, 13], tier: 'implement-next',
    runtime: 'GATED',
    runtimeEvidence:
      'GATE: there is no Watch runtime anywhere. `backend/src/modules/watch` is absent here and `WatchModule` appears 0 times in canonical app.module.ts. This layer was `available: true` before PO ruling 5 — it was the decorative toggle the ruling names.',
    available: false, licence: 'GlobalNews AI user store — internal',
    modes: ['WORLD', 'EVIDENCE', 'WATCH'], defaultOn: true,
  },
  {
    id: 'sourceDensity', class: 'EVIDENCE', zoomRange: [1, 9], tier: 'beta',
    runtime: 'NOT_IMPLEMENTED',
    runtimeEvidence:
      'No source-registry feed exists to density-map.',
    available: false, licence: 'Source registry — internal', modes: ['SOURCES'], defaultOn: false,
  },
  {
    id: 'situations', class: 'EVIDENCE', zoomRange: [1, 13], tier: 'beta',
    runtime: 'GATED',
    runtimeEvidence:
      'GATE: the Situation substrate is now registered (PO ruling 1) but serves NO route — SituationModule declares no controller — and its identity port is bound to UNWIRED_SITUATION_IDENTITY_PORT, which throws. Substrate present, producer and call site absent.',
    available: false, licence: 'Situation model — internal',
    modes: ['SITUATIONS', 'CHANGE'], defaultOn: false,
  },
  {
    id: 'admin1', class: 'REFERENCE', zoomRange: [6, 13], tier: 'beta',
    runtime: 'NOT_IMPLEMENTED',
    runtimeEvidence:
      'No admin-1 geometry exists in the product.',
    available: false, licence: 'geoBoundaries ADM1 — CC-BY 4.0 (attribution required)',
    modes: [], defaultOn: false,
  },
  {
    id: 'admin2', class: 'REFERENCE', zoomRange: [8, 13], tier: 'beta',
    runtime: 'NOT_IMPLEMENTED',
    runtimeEvidence:
      'No admin-2 geometry exists in the product.',
    available: false, licence: 'geoBoundaries ADM2 — CC-BY 4.0 (attribution required)',
    modes: [], defaultOn: false,
  },
];

export function layerById(id: string): LayerDefinition | undefined {
  return LAYER_REGISTRY.find((layer) => layer.id === id);
}

/** Layers a surface may offer in this mode. Availability is reported, not filtered. */
export function layersForMode(mode: MapMode): readonly LayerDefinition[] {
  return LAYER_REGISTRY.filter((layer) => layer.modes.length === 0 || layer.modes.includes(mode));
}

/** Whether the camera's zoom is inside a layer's declared visible range. */
export function layerVisibleAtZoom(layer: LayerDefinition, zoom: number): boolean {
  return zoom >= layer.zoomRange[0] && zoom <= layer.zoomRange[1];
}

/**
 * The default toggle map, before any stored preference is applied.
 *
 * An UNAVAILABLE layer is always off here, whatever its `defaultOn` says. A
 * toggle that starts on and draws nothing is the layer-shaped version of an
 * empty world, and the rail disables it with a reason instead.
 */
export function defaultLayerState(): Record<string, boolean> {
  const state: Record<string, boolean> = {};

  for (const layer of LAYER_REGISTRY) {
    state[layer.id] = layer.available && layer.defaultOn;
  }

  return state;
}

/**
 * Merge a stored preference over the defaults.
 *
 * Stored state is UNTRUSTED — it comes from localStorage and may name layers
 * that no longer exist or enable ones whose data has since been withdrawn. So
 * unknown keys are dropped and unavailable layers stay off no matter what the
 * store says.
 */
export function resolveLayerState(stored: Record<string, boolean> | null | undefined): Record<string, boolean> {
  const state = defaultLayerState();

  if (!stored) return state;

  for (const layer of LAYER_REGISTRY) {
    const value = stored[layer.id];

    if (typeof value === 'boolean' && layer.available) state[layer.id] = value;
  }

  return state;
}

/** The attributions a deployment must display, for the layers actually on. */
export function requiredAttributions(state: Record<string, boolean>): readonly string[] {
  const seen = new Set<string>();

  for (const layer of LAYER_REGISTRY) {
    if (state[layer.id] && layer.available) seen.add(layer.licence);
  }

  return [...seen].sort();
}

/**
 * THE LEFT HUD RAIL'S OWN SET, IN THE DESIGN REFERENCE'S ORDER.
 *
 * The reference rail is `◈ EVID · ◇ SRC · ◎ WATCH · ⬡ SITU · — · ≈ WATER ·
 * A LABEL · # GRID`, and it is STABLE: the same seven controls in the same
 * places whatever mode is active.
 *
 * That stability is the point. `layersForMode()` answers a different question —
 * which layers a mode may legitimately DRAW — and driving the rail from it made
 * controls appear and disappear as the mode changed, so the rail's geometry
 * moved under the user's cursor. A control that is not applicable is shown
 * disabled with its reason, exactly like an unavailable mode; it is not
 * removed.
 */
export const RAIL_EVIDENCE_LAYERS: readonly string[] = [
  'countryEvidence',
  'sourceDensity',
  'watch',
  'situations',
];

export const RAIL_REFERENCE_LAYERS: readonly string[] = ['hydrography', 'labels', 'graticule'];

/** The rail's layers, in the reference's order. Never filtered by mode. */
export function railLayers(): readonly LayerDefinition[] {
  const byId = (id: string): LayerDefinition | undefined => layerById(id);

  return [...RAIL_EVIDENCE_LAYERS, ...RAIL_REFERENCE_LAYERS]
    .map(byId)
    .filter((layer): layer is LayerDefinition => layer !== undefined);
}
