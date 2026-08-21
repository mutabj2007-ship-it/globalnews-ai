/**
 * M66.5 — GN-CD-130 → GN-CD-156: the ONE geometry asset for the
 * Intelligence Engine.
 *
 * GN-CD §T names `ringEngine()` "the primary asset" and instructs:
 * "port the algorithm, not the output". That is exactly what this file
 * does. Every connector, node and pulse the engine renders is COMPUTED
 * here from the two released configuration literal sets; not one
 * coordinate is transcribed from the specification's derived tables.
 * Those tables are used only as an independent check, in
 * `engineGeometry.spec.ts`, which re-derives all 18 connector rows and
 * all 48 filler coordinates and compares them against the released
 * values at the released ±0.1px / ±0.1° tolerance.
 *
 * WHY GENERATED (GN-CD-145): every connector's angle is its own
 * module's angle, so extending any connector backwards passes through
 * the hub centre. Hardcoding paths guarantees drift the first time a
 * card moves.
 *
 * WHAT THIS REPLACES. The M65.1 geometry described the engine in
 * PERCENTAGES of an anisotropic canvas (`CANVAS_ASPECT_RATIO = 2.2`,
 * `preserveAspectRatio="none"`, hand-placed `RING_SLOTS`, a ray/ELLIPSE
 * intersection, and connectors that ran to each card's CENTRE). The
 * released design is a fixed-pixel canvas (`1240x520` / `310x340`) with
 * a ray/RECTANGLE intersection that terminates on each card's EDGE.
 * Those are different geometries, not different tunings, so the
 * percentage model is gone rather than adjusted.
 *
 * WHAT IS DELIBERATELY KEPT from M65.1: keying by the canonical module
 * id from `lib/intelligenceModules.ts` rather than by the design's
 * positional `i` index. A renamed or removed module then surfaces
 * immediately as a missing entry instead of silently shifting the whole
 * composition. The released `items` arrays are reproduced here in their
 * released ORDER with their released COORDINATES; only the key form
 * differs.
 *
 * NO DOM MEASUREMENT OF ANY KIND: no getBoundingClientRect, no
 * ResizeObserver, no requestAnimationFrame, no window access. Pure
 * arithmetic on fixed constants — the one guard from the superseded
 * geometry spec worth keeping, and now also a GN-CD requirement.
 *
 * NO DATA. Nothing in this file is a signal, a count, a measurement or
 * telemetry. GN-CD-147 is explicit: "DATA SOURCE: NONE — PRESENTATION
 * ONLY. The pulses do not represent measured traffic and must never be
 * presented as live telemetry."
 */

/** A module's authored ring position, in canvas-local pixels. */
export interface RingItem {
  /** Canonical module id from `lib/intelligenceModules.ts`. */
  id: string;
  /** Card centre x, canvas-local. */
  x: number;
  /** Card centre y, canvas-local. */
  y: number;
}

/** One released engine configuration — GN-CD-152 (desktop) / GN-CD-154 (mobile). */
export interface EngineConfig {
  canvasWidth: number;
  canvasHeight: number;
  /** Hub centre. */
  cx: number;
  cy: number;
  /** Anchor radius. GN-CD §E: this MUST equal the hub's visual radius. */
  r: number;
  cardW: number;
  cardH: number;
  pulseR: number;
  nodeR: number;
  items: RingItem[];
}

/**
 * GN-CD-145 §Y and GN-CD §N.3 — the released card order. This is the
 * DOM order, and therefore the tab order (CTO decision D-9 A, resolving
 * UNRESOLVED-018 in favour of the released geometry order).
 *
 * It is NOT the same as the `INTELLIGENCE_MODULES` array order, and it
 * is not meant to be: that array's order is a configuration fact locked
 * by `lib/intelligenceModules.spec.ts`, while this is a presentation
 * fact locked by `engineGeometry.spec.ts`. Both are correct; each is
 * asserted where it belongs.
 */
export const RING_ORDER: readonly string[] = [
  'world-intelligence',
  'ai-research',
  'country-intelligence',
  'evidence',
  'market',
  'economy',
  'timeline',
  'conflict',
  'forecast',
];

/** GN-CD-152 — desktop configuration, verbatim. Canvas `1240x520`. */
export const ENGINE_DESKTOP: EngineConfig = {
  canvasWidth: 1240,
  canvasHeight: 520,
  cx: 620,
  cy: 250,
  r: 107,
  cardW: 340,
  cardH: 82,
  pulseR: 3.4,
  nodeR: 3.4,
  items: [
    { id: 'world-intelligence', x: 620, y: 46 },
    { id: 'ai-research', x: 250, y: 110 },
    { id: 'country-intelligence', x: 990, y: 110 },
    { id: 'evidence', x: 170, y: 250 },
    { id: 'market', x: 1070, y: 250 },
    { id: 'economy', x: 250, y: 390 },
    { id: 'timeline', x: 990, y: 390 },
    { id: 'conflict', x: 430, y: 476 },
    { id: 'forecast', x: 810, y: 476 },
  ],
};

/** GN-CD-154 — mobile configuration, verbatim. Canvas `310x340`. */
export const ENGINE_MOBILE: EngineConfig = {
  canvasWidth: 310,
  canvasHeight: 340,
  cx: 155,
  cy: 174,
  r: 33,
  cardW: 108,
  cardH: 56,
  pulseR: 2,
  nodeR: 2.8,
  items: [
    { id: 'world-intelligence', x: 155, y: 40 },
    { id: 'ai-research', x: 56, y: 104 },
    { id: 'country-intelligence', x: 254, y: 104 },
    { id: 'evidence', x: 55, y: 174 },
    { id: 'market', x: 255, y: 174 },
    { id: 'economy', x: 56, y: 244 },
    { id: 'timeline', x: 254, y: 244 },
    { id: 'conflict', x: 93, y: 308 },
    { id: 'forecast', x: 217, y: 308 },
  ],
};

/**
 * GN-CD-148 — the nine identity colours, held LOCALLY to this family
 * (CTO decision D-4 A).
 *
 * They are deliberately NOT merged into `moduleAccentClasses.ts`. That
 * table is a general-purpose Tailwind palette map still consumed by the
 * retired module card; these are `[DESIGN-EXACT]` literals belonging to
 * one released component family, and GN-CD §V requires them at ΔE 0.
 * Keeping them here means the shared table is never edited and the
 * released values can never drift.
 *
 * `rgb` is the channel triple the released card gradient, border, glow
 * and badge all interpolate — carried as a string so a component can
 * hand it to CSS as one custom property instead of nine class
 * permutations.
 *
 * RECORDED, NOT CORRECTED — UNRESOLVED-015: three identity pairs
 * collide (economy/world both `#34d399`; evidence/timeline both
 * `#c4b5fd`; conflict `#f87171` is shared with BREAKING elsewhere in
 * the system). GN-CD-130 names this "the one place the collision is
 * already visible". It is reproduced exactly as released. It is not an
 * accessibility defect: GN-CD-149 carries status as badge TEXT, never
 * by colour alone (GN-CD-307).
 */
export interface ModuleIdentity {
  hex: string;
  rgb: string;
}

export const MODULE_IDENTITY: Record<string, ModuleIdentity> = {
  'ai-research': { hex: '#fbbf24', rgb: '251,191,36' },
  evidence: { hex: '#c4b5fd', rgb: '196,181,253' },
  economy: { hex: '#34d399', rgb: '52,211,153' },
  conflict: { hex: '#f87171', rgb: '248,113,113' },
  'world-intelligence': { hex: '#34d399', rgb: '52,211,153' },
  'country-intelligence': { hex: '#60a5fa', rgb: '96,165,250' },
  market: { hex: '#22d3ee', rgb: '34,211,238' },
  timeline: { hex: '#c4b5fd', rgb: '196,181,253' },
  forecast: { hex: '#fbbf24', rgb: '251,191,36' },
};

/**
 * GN-CD-148 — the nine mobile icon paths, verbatim `[DESIGN-EXACT]`.
 * Rendered at `17x17` in a `0 0 24 24` viewBox, `fill:none`,
 * `stroke-width:1.5`, round caps and joins, stroked in the module's
 * identity colour.
 *
 * UNRESOLVED-007 is reproduced as released and NOT resolved here:
 * desktop shows two-letter mono codes in a bordered tile, mobile shows
 * these stroked line icons with no tile. GN-CD-150 records that these
 * "are not two renderings of one system" and that unifying them is a
 * design change, explicitly not applied.
 */
export const MOBILE_ICON_PATHS: Record<string, string> = {
  'ai-research':
    'M12 4a4 4 0 0 0-4 4v8a4 4 0 0 0 8 0V8a4 4 0 0 0-4-4M12 4v16M8.5 9h-2M8.5 15h-2M15.5 9h2M15.5 15h2',
  evidence: 'M12 4v16M5 8h14M8 8l-3 6h6zM16 8l-3 6h6z',
  economy: 'M4 20h16M7 17v-5M11.5 17V9M16 17v-8M13.5 5.5H18v4.5',
  conflict: 'M12 3.5l7 2.8v5.4c0 4-2.9 7.2-7 8.8-4.1-1.6-7-4.8-7-8.8V6.3zM12 9v4',
  'world-intelligence':
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3.2 12h17.6M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18',
  'country-intelligence':
    'M12 21c4.2-5.4 6-8.4 6-11.4A6 6 0 0 0 6 9.6c0 3 1.8 6 6 11.4M9.6 9.6a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0',
  market: 'M4 20h16M5 16.5l4.5-5 3 2.8 5.5-7.3M14.5 6.5H18v3.5',
  timeline: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M9 4v4M15 4v4M8 14.5h3M13 17h3',
  forecast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 12l4.5-3.5M8.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
};

/** GN-CD-145 — the short-link bow threshold and its bow depth. */
export const BOW_THRESHOLD = 26;
export const BOW_DEPTH = 11;

/** GN-CD-146 — filler ring: 24 nodes, radius 1.4, `#67e8f9` at 0.45, never animated. */
export const FILLER_COUNT = 24;
export const FILLER_RADIUS = 1.4;
export const FILLER_FILL = '#67e8f9';
export const FILLER_OPACITY = 0.45;

/** GN-CD-146 — derived node geometry, expressed as ratios of `nodeR` so both viewports stay in step. */
export const CARD_NODE_RATIO = 0.72;
/** GN-CD-156 — hovered hub anchor radius (`3.4 -> 5.78`), the same 1.7x the connector width takes. */
export const HOVER_NODE_RATIO = 1.7;
/** GN-CD-147 — acknowledgement peak radii: hub swells to 1.8x `nodeR`, card edge to 1.5x `nodeR`. */
export const HUB_ACK_RATIO = 1.8;
export const CARD_ACK_RATIO = 1.5;
/** GN-CD-146 — released rest opacities (desktop only; see `NODE_OPACITY_APPLIED`). */
export const ANCHOR_OPACITY = 0.9;
export const CARD_NODE_OPACITY = 0.55;

/**
 * GN-CD-147 — the three released pulse durations, cycled by ring
 * position. Three durations across nine staggered starts is what stops
 * the network reading as a loop.
 */
export const PULSE_DURATIONS = [3.6, 4.05, 4.5] as const;

/** GN-CD-147 — the released cycle definition. Out at 0.3, dwell to 0.4, back by 0.7. */
export const PULSE_KEY_TIMES = '0;0.3;0.4;0.7;1';
export const PULSE_KEY_POINTS = '0;1;1;0;0';
export const PULSE_FADE_VALUES = '0;1;1;1;1;0;0';
export const PULSE_FADE_TIMES = '0;0.04;0.3;0.4;0.7;0.76;1';
/** GN-CD-147 — the acknowledgement swell envelope, identical at both ends. */
export const ACK_KEY_TIMES = '0;0.08;0.3';
/** GN-CD-147 — the fraction of a cycle at which each end acknowledges. */
export const HUB_ACK_PHASE = 0.3;
export const CARD_ACK_PHASE = 0.7;

/**
 * GN-CD-145 — connector rest strokes. Desktop consumes the computed
 * hover state; mobile hardcodes its own and has no hover.
 *
 * The `.32` / `.34` difference is REAL and is reproduced as released.
 * GN-CD-145 records that it "has no design rationale I can evidence"
 * and instructs: "Do not harmonise without a design decision"
 * (UNRESOLVED-017). Harmonising it here would be exactly the silent
 * correction the specification forbids.
 */
export const CONNECTOR_REST_DESKTOP = 'rgba(56,189,248,.32)';
export const CONNECTOR_REST_MOBILE = 'rgba(56,189,248,.34)';
export const CONNECTOR_WIDTH_REST = 1;
export const CONNECTOR_WIDTH_HOVER = 1.7;

/**
 * GN-CD-146 — whether the released template applies the computed node
 * `opacity`. Desktop does; the mobile template omits the attribute
 * entirely, so mobile renders all 42 nodes at full opacity. Recorded
 * as-is under UNRESOLVED-017 rather than corrected.
 */
export const NODE_OPACITY_APPLIED = { desktop: true, mobile: false } as const;

/** Emits a coordinate the way the released routine does: `toFixed(1)`. */
function fx(value: number): string {
  return value.toFixed(1);
}

/**
 * Emits a radius attribute without trailing-zero noise. Numerically
 * identical to the released literals; `engineGeometry.spec.ts` compares
 * these NUMERICALLY rather than as strings, because SVG does not
 * distinguish `5.1` from `5.10`.
 */
export function svgNum(value: number): string {
  return String(Number(value.toFixed(3)));
}

export interface Point {
  x: number;
  y: number;
}

export interface EngineLink {
  /** Canonical module id. */
  id: string;
  /** Position around the ring, in released geometry order. */
  index: number;
  /** The module's true angle from the hub, in degrees. */
  theta: number;
  /** Anchor on the hub circumference. */
  anchor: Point;
  /** Intersection of the hub ray with the card's rectangle edge. */
  edge: Point;
  /** Straight-line distance anchor to card edge. */
  length: number;
  /** 11 when the link is shorter than 26, else 0. */
  bow: number;
  /** Quadratic control point; only meaningful when bowed. */
  control: Point;
  /** Connector path, hub anchor to card edge. */
  d: string;
  /** Pulse motion path — the connector REVERSED (card edge to hub anchor). */
  motion: string;
  /** Released pulse duration for this ring position, in seconds. */
  dur: number;
  /** Released pulse start offset for this ring position, in seconds. */
  begin: number;
  /** Absolute time at which this pulse reaches the hub anchor. */
  hubAck: number;
  /** Absolute time at which it returns to the card edge. */
  cardAck: number;
}

/**
 * GN-CD-147 — pulse duration for a ring position. Three durations
 * cycled by position, exactly as released.
 */
export function pulseDuration(index: number): number {
  return PULSE_DURATIONS[index % PULSE_DURATIONS.length];
}

/**
 * GN-CD-147 — pulse start offset for a ring position.
 *
 * HONEST PROVENANCE: GN-CD-147 publishes the nine `begin` values and
 * describes them as "[DESIGN-DERIVED from the released formulas]", but
 * it does not print the formula itself. The expression below was
 * RECONSTRUCTED here — a 0.72s stagger per position with a 0.28s offset
 * on alternating positions, which desynchronises the mirror-symmetric
 * pairs — and it reproduces all nine released values exactly.
 * `engineGeometry.spec.ts` asserts the reconstruction against every one
 * of the nine published literals, so if the reconstruction is ever
 * wrong the suite fails rather than the engine drifting quietly.
 *
 * This is generated rather than hardcoded because GN-CD §U.5 requires
 * it: "Staggered begins via the released formula — never synchronised,
 * never hardcoded."
 */
export function pulseBegin(index: number): number {
  return Number((index * 0.72 + (index % 2) * 0.28).toFixed(2));
}

/**
 * GN-CD-145 — `ringEngine()`, ported verbatim.
 *
 * Solves, for each module:
 *   th    = atan2(cy - y, x - cx)              the module's true angle
 *   a     = centre + r * (cos th, -sin th)     anchor on the hub circle
 *   n     = unit(a - centre_of_card)           card -> anchor direction
 *   scale = min(|(w/2)/nx|, |(h/2)/ny|)        ray / rectangle intersection
 *   e     = card_centre + n * scale            the point on the card edge
 *   bow   = dist(e, a) < 26 ? 11 : 0
 */
export function ringEngine(config: EngineConfig): EngineLink[] {
  const { cx, cy, r, cardW: w, cardH: h } = config;

  return config.items.map((item, index) => {
    const th = Math.atan2(cy - item.y, item.x - cx);
    const ax = cx + r * Math.cos(th);
    const ay = cy - r * Math.sin(th);

    const ux = ax - item.x;
    const uy = ay - item.y;
    const len = Math.hypot(ux, uy) || 1;
    const nx = ux / len;
    const ny = uy / len;

    const scale = Math.min(Math.abs(w / 2 / (nx || 1e-6)), Math.abs(h / 2 / (ny || 1e-6)));
    const ex = item.x + nx * scale;
    const ey = item.y + ny * scale;

    const dist = Math.hypot(ex - ax, ey - ay);
    const bow = dist < BOW_THRESHOLD ? BOW_DEPTH : 0;
    const mx = (ax + ex) / 2 + (bow ? -ny * bow : 0);
    const my = (ay + ey) / 2 + (bow ? nx * bow : 0);

    const d = bow
      ? `M${fx(ax)} ${fx(ay)}Q${fx(mx)} ${fx(my)} ${fx(ex)} ${fx(ey)}`
      : `M${fx(ax)} ${fx(ay)}L${fx(ex)} ${fx(ey)}`;

    // GN-CD-147: the pulse travels the connector REVERSED — card edge to
    // hub anchor — reusing the same quadratic control point when bowed.
    const motion = bow
      ? `M${fx(ex)} ${fx(ey)}Q${fx(mx)} ${fx(my)} ${fx(ax)} ${fx(ay)}`
      : `M${fx(ex)} ${fx(ey)}L${fx(ax)} ${fx(ay)}`;

    const dur = pulseDuration(index);
    const begin = pulseBegin(index);

    return {
      id: item.id,
      index,
      theta: (th * 180) / Math.PI,
      anchor: { x: ax, y: ay },
      edge: { x: ex, y: ey },
      length: dist,
      bow,
      control: { x: mx, y: my },
      d,
      motion,
      dur,
      begin,
      hubAck: Number((begin + dur * HUB_ACK_PHASE).toFixed(3)),
      cardAck: Number((begin + dur * CARD_ACK_PHASE).toFixed(3)),
    };
  });
}

/**
 * GN-CD-146 §16c — the 24 filler circumference nodes, generated
 * verbatim at exactly 15 degrees apart.
 *
 * Indices 0, 6, 12 and 18 land on the four cardinal module anchors.
 * GN-CD-146 records that as "an intentional consequence of 24 evenly
 * spaced nodes, not a duplication bug", so they are NOT de-duplicated.
 */
export function fillerNodes(config: EngineConfig): Point[] {
  const nodes: Point[] = [];
  for (let k = 0; k < FILLER_COUNT; k += 1) {
    const th = (k / FILLER_COUNT) * Math.PI * 2;
    nodes.push({ x: config.cx + config.r * Math.cos(th), y: config.cy - config.r * Math.sin(th) });
  }
  return nodes;
}

/** GN-CD-147 — the hub-end acknowledgement swell for a viewport, e.g. `3.4;6.12;3.4`. */
export function hubAckValues(config: EngineConfig): string {
  return `${svgNum(config.nodeR)};${svgNum(config.nodeR * HUB_ACK_RATIO)};${svgNum(config.nodeR)}`;
}

/** GN-CD-147 — the card-end acknowledgement swell, e.g. `2.45;5.1;2.45`. */
export function cardAckValues(config: EngineConfig): string {
  const base = Number((config.nodeR * CARD_NODE_RATIO).toFixed(2));
  return `${svgNum(base)};${svgNum(config.nodeR * CARD_ACK_RATIO)};${svgNum(base)}`;
}

/** GN-CD-146 §16b — card-edge node radius: `nodeR x 0.72`, rounded as the released values are. */
export function cardNodeRadius(config: EngineConfig): number {
  return Number((config.nodeR * CARD_NODE_RATIO).toFixed(2));
}

/**
 * GN-CD §E — the geometric invariant, expressed as executable code
 * rather than as a comment: the anchor radius IS the hub's visual
 * radius, so connectors terminate on the hub's drawn boundary at every
 * angle. Desktop: the 296px hub box inset by the breathing ring's 41px
 * gives 107. Mobile: the 66px hub box halved gives 33.
 *
 * "If the hub size changes, `r` must change with it."
 */
export const HUB_VISUAL = {
  desktop: { box: 296, inset: 41, left: 472, top: 102, core: 158 },
  mobile: { box: 66, inset: 0, left: 122, top: 141, core: 52 },
} as const;

export function hubVisualRadius(box: number, inset: number): number {
  return box / 2 - inset;
}
