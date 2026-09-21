import type { MapMode, ModeUnavailableReason } from '@/lib/map/state/mapState';

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
    runtime: 'LIVE',
    runtimeEvidence:
      'Bundled Natural Earth 1:50m river centreline geometry is served from /reference/rivers.json and rendered by EvidenceMapCanvas through referenceGeography.ts.',
    available: true, licence: 'Natural Earth centerlines — public domain', modes: [], defaultOn: true,
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
    /*
      C907 §4 — THIS CLAIM IS NOW TRUE. It was not before: the registry
      declared the graticule LIVE and available while `EvidenceMapCanvas`
      added no such layer, so the GRID control governed nothing and a reader
      toggling it saw no change. `graticule.ts` supplies the layer; the
      evidence sentence below is unchanged because it was always an accurate
      description of how the layer would work — it simply described one that
      did not exist yet.
    */
    runtimeEvidence:
      'Generated client-side, with no dataset and no network request; see lib/map/reference/graticule.ts.',
    /*
      defaultOn: false -> true. The golden world frame carries the grid — a 10°
      graticule, measured at 33 px spacing over the map pane — so a composition
      that matches the golden authority has it on. It remains a rail control a
      reader can switch off.
    */
    available: true, licence: 'Generated — no third-party data', modes: [], defaultOn: true,
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
      'GATE: country Follow persistence exists and the shared Watch identity substrate is present, but no map Watch observation feed/producer is wired. The layer therefore remains unavailable until a governed Watch runtime can emit map evidence.',
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
    runtime: 'LIVE',
    runtimeEvidence:
      'Bundled Natural Earth 1:50m admin-1 line geometry is served from /reference/admin1-lines.json and rendered by EvidenceMapCanvas. Coverage is intentionally sparse and excludes East Africa at this Natural Earth scale; Rwanda administrative authority remains NISR.',
    available: true, licence: 'Natural Earth admin-1 lines — public domain',
    modes: [], defaultOn: true,
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
  /* One predicate, so this and the rail cannot drift apart. */
  return LAYER_REGISTRY.filter((layer) => layerAppliesInMode(layer, mode));
}

/**
 * ══ E-3 · WHY A LAYER CANNOT DRAW, IN THE SAME FIVE WORDS THE MODES USE ════
 *
 * The rail said "No data yet" for every unavailable layer — the exact collapse
 * the ruling names: *"Do not collapse every condition into 'No data yet.'"*
 * E-1 fixed that for the mode row and left the layer rail saying one word for
 * four different situations.
 *
 * NOTHING NEW IS INVENTED HERE. `runtime` already records what is true today, with
 * `runtimeEvidence` stating the evidence in the layer's own words, so the reason
 * is DERIVED from that rather than assigned by taste:
 *
 *   NOT_IMPLEMENTED  -> NOT_BUILT      "No admin-1 geometry exists in the
 *                                       product." Nothing to connect.
 *   GATED            -> NOT_CONNECTED  `situations`: the substrate IS registered,
 *                                       and serves no route. Calling that "not
 *                                       built" would be FALSER than the generic
 *                                       word it replaces — the same test E-1
 *                                       applied to Watch, Change and Sources.
 *   FAILED_MEASUREMENT -> TEMPORARILY_UNAVAILABLE   it worked and stopped.
 *
 * Returns null for an available layer, because there is no reason to give.
 */
export function layerUnavailableReason(layer: LayerDefinition): ModeUnavailableReason | null {
  if (layer.available) return null;

  switch (layer.runtime) {
    case 'NOT_IMPLEMENTED':
      return 'NOT_BUILT';
    case 'GATED':
      return 'NOT_CONNECTED';
    case 'FAILED_MEASUREMENT':
      return 'TEMPORARILY_UNAVAILABLE';
    default:
      /*
        A LIVE layer that is nonetheless unavailable is a contradiction in the
        registry, not a state to describe. The honest answer promises nothing.
      */
      return 'TEMPORARILY_UNAVAILABLE';
  }
}

/**
 * ══ E-3 · ONE AUTHORITY ON APPLICABILITY, NOT TWO ══════════════════════════
 *
 * `layersForMode()` has always answered "which layers may this mode draw", and
 * NOTHING CALLED IT. Meanwhile the rail decided what to offer from
 * `available` alone and never asked about the mode at all — so the registry held
 * two answers to one question and used neither together.
 *
 * Today that gap is invisible: every layer whose `modes` exclude the current mode
 * also happens to be unavailable, so it is already disabled for the other
 * reason. It is a LATENT defect with a named trigger — the moment `sourceDensity`
 * or `situations` becomes available, the rail would offer it as fully operable in
 * a mode that cannot draw it, and switching it on would draw nothing. That is
 * exactly the failure the rail's own doc comment forbids: "a toggle that
 * switches on and draws nothing teaches the user that the world is empty
 * there".
 *
 * So the rail now asks, and a layer that does not apply is DISABLED WITH ITS
 * REASON rather than removed — which is what `RAIL_EVIDENCE_LAYERS`' own comment
 * already promised: "A control that is not applicable is shown disabled with
 * its reason, exactly like an unavailable mode; it is not removed."
 */
export function layerAppliesInMode(layer: LayerDefinition, mode: MapMode): boolean {
  return layer.modes.length === 0 || layer.modes.includes(mode);
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
