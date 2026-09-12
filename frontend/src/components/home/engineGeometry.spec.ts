import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { INTELLIGENCE_MODULES } from '@/lib/intelligenceModules';
import {
  ACK_KEY_TIMES,
  BOW_DEPTH,
  BOW_THRESHOLD,
  CARD_ACK_PHASE,
  CARD_NODE_RATIO,
  ENGINE_DESKTOP,
  ENGINE_MOBILE,
  FILLER_COUNT,
  FILLER_FILL,
  FILLER_OPACITY,
  FILLER_RADIUS,
  HOVER_NODE_RATIO,
  HUB_ACK_PHASE,
  HUB_VISUAL,
  MOBILE_ICON_PATHS,
  MODULE_IDENTITY,
  NODE_OPACITY_APPLIED,
  PULSE_DURATIONS,
  PULSE_FADE_TIMES,
  PULSE_FADE_VALUES,
  PULSE_KEY_POINTS,
  PULSE_KEY_TIMES,
  RING_ORDER,
  cardAckValues,
  cardNodeRadius,
  fillerNodes,
  hubAckValues,
  hubVisualRadius,
  pulseBegin,
  pulseDuration,
  ringEngine,
} from './intelligenceEngineGeometry';

const geometrySource = readFileSync(join(__dirname, 'intelligenceEngineGeometry.ts'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * M66.5 — GN-CD-130 → GN-CD-156, the released geometry contract.
 *
 * This file exists because GN-CD §T names `ringEngine()` "the primary
 * asset" and §A states that every derived coordinate in the release "was
 * produced by running `ringEngine()` verbatim and is reproducible". So
 * this suite REPRODUCES them: the ported routine is executed against the
 * released configuration literals and compared, row by row, with the
 * tables the specification publishes.
 *
 * The released tables below are transcribed HERE, in the test, and
 * nowhere in the product. That is the point — the implementation
 * generates, the test checks the generator against the publication. If
 * the two ever disagree, this suite fails rather than the engine
 * drifting quietly.
 */

/** GN-CD-145 — desktop: θ, anchor, card edge, length, bow, path. */
const DESKTOP_TABLE: Record<string, [string, string, string, string, number, string]> = {
  'world-intelligence': ['90.0', '620.0,143.0', '620.0,87.0', '56.0', 0, 'M620.0 143.0L620.0 87.0'],
  'ai-research': ['159.3', '519.9,212.1', '358.4,151.0', '172.7', 0, 'M519.9 212.1L358.4 151.0'],
  'country-intelligence': ['20.7', '720.1,212.1', '881.6,151.0', '172.7', 0, 'M720.1 212.1L881.6 151.0'],
  evidence: ['180.0', '513.0,250.0', '340.0,250.0', '173.0', 0, 'M513.0 250.0L340.0 250.0'],
  market: ['0.0', '727.0,250.0', '900.0,250.0', '173.0', 0, 'M727.0 250.0L900.0 250.0'],
  economy: ['-159.3', '519.9,287.9', '358.4,349.0', '172.7', 0, 'M519.9 287.9L358.4 349.0'],
  timeline: ['-20.7', '720.1,287.9', '881.6,349.0', '172.7', 0, 'M720.1 287.9L881.6 349.0'],
  conflict: ['-130.1', '551.1,331.9', '464.5,435.0', '134.7', 0, 'M551.1 331.9L464.5 435.0'],
  forecast: ['-49.9', '688.9,331.9', '775.5,435.0', '134.7', 0, 'M688.9 331.9L775.5 435.0'],
};

/** GN-CD-145 — mobile. Evidence and Market are the two bowed links. */
const MOBILE_TABLE: Record<string, [string, string, string, string, number, string]> = {
  'world-intelligence': ['90.0', '155.0,141.0', '155.0,68.0', '73.0', 0, 'M155.0 141.0L155.0 68.0'],
  'ai-research': ['144.7', '128.1,154.9', '95.6,132.0', '39.7', 0, 'M128.1 154.9L95.6 132.0'],
  'country-intelligence': ['35.3', '181.9,154.9', '214.4,132.0', '39.7', 0, 'M181.9 154.9L214.4 132.0'],
  evidence: ['180.0', '122.0,174.0', '109.0,174.0', '13.0', 11, 'M122.0 174.0Q115.5 185.0 109.0 174.0'],
  market: ['0.0', '188.0,174.0', '201.0,174.0', '13.0', 11, 'M188.0 174.0Q194.5 163.0 201.0 174.0'],
  economy: ['-144.7', '128.1,193.1', '95.6,216.0', '39.7', 0, 'M128.1 193.1L95.6 216.0'],
  timeline: ['-35.3', '181.9,193.1', '214.4,216.0', '39.7', 0, 'M181.9 193.1L214.4 216.0'],
  conflict: ['-114.8', '141.1,203.9', '106.0,280.0', '83.8', 0, 'M141.1 203.9L106.0 280.0'],
  forecast: ['-65.2', '168.9,203.9', '204.0,280.0', '83.8', 0, 'M168.9 203.9L204.0 280.0'],
};

/** GN-CD-146 §16c — the released filler coordinates, both viewports. */
const DESKTOP_FILLER =
  '(727.0,250.0) (723.4,222.3) (712.7,196.5) (695.7,174.3) (673.5,157.3) (647.7,146.6) (620.0,143.0) (592.3,146.6) (566.5,157.3) (544.3,174.3) (527.3,196.5) (516.6,222.3) (513.0,250.0) (516.6,277.7) (527.3,303.5) (544.3,325.7) (566.5,342.7) (592.3,353.4) (620.0,357.0) (647.7,353.4) (673.5,342.7) (695.7,325.7) (712.7,303.5) (723.4,277.7)';
const MOBILE_FILLER =
  '(188.0,174.0) (186.9,165.5) (183.6,157.5) (178.3,150.7) (171.5,145.4) (163.5,142.1) (155.0,141.0) (146.5,142.1) (138.5,145.4) (131.7,150.7) (126.4,157.5) (123.1,165.5) (122.0,174.0) (123.1,182.5) (126.4,190.5) (131.7,197.3) (138.5,202.6) (146.5,205.9) (155.0,207.0) (163.5,205.9) (171.5,202.6) (178.3,197.3) (183.6,190.5) (186.9,182.5)';

/** GN-CD-147 — dur, begin, hub hit, card hit, in released ring order. */
const PULSE_TABLE: Array<[number, number, number, number]> = [
  [3.6, 0.0, 1.08, 2.52],
  [4.05, 1.0, 2.21, 3.83],
  [4.5, 1.44, 2.79, 4.59],
  [3.6, 2.44, 3.52, 4.96],
  [4.05, 2.88, 4.09, 5.71],
  [4.5, 3.88, 5.23, 7.03],
  [3.6, 4.32, 5.4, 6.84],
  [4.05, 5.32, 6.54, 8.15],
  [4.5, 5.76, 7.11, 8.91],
];

function key(point: { x: number; y: number }): string {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

describe('M66.5 — the released connector geometry is REPRODUCED, never transcribed', () => {
  it('desktop reproduces all nine GN-CD-145 rows: angle, anchor, card edge, length, bow and path', () => {
    const links = ringEngine(ENGINE_DESKTOP);
    expect(links).toHaveLength(9);
    for (const link of links) {
      const [theta, anchor, edge, length, bow, d] = DESKTOP_TABLE[link.id];
      expect(Number(link.theta.toFixed(1))).toBeCloseTo(Number(theta), 1);
      expect(key(link.anchor)).toBe(anchor);
      expect(key(link.edge)).toBe(edge);
      expect(Number(link.length.toFixed(1))).toBeCloseTo(Number(length), 1);
      expect(link.bow).toBe(bow);
      expect(link.d).toBe(d);
    }
  });

  it('mobile reproduces all nine rows, including the two bowed horizontal links', () => {
    const links = ringEngine(ENGINE_MOBILE);
    expect(links).toHaveLength(9);
    for (const link of links) {
      const [theta, anchor, edge, length, bow, d] = MOBILE_TABLE[link.id];
      expect(Number(link.theta.toFixed(1))).toBeCloseTo(Number(theta), 1);
      expect(key(link.anchor)).toBe(anchor);
      expect(key(link.edge)).toBe(edge);
      expect(Number(link.length.toFixed(1))).toBeCloseTo(Number(length), 1);
      expect(link.bow).toBe(bow);
      expect(link.d).toBe(d);
    }
  });

  it('exactly two links bow, they are Evidence and Market on mobile, and they sit 13px from the hub', () => {
    const bowed = ringEngine(ENGINE_MOBILE).filter((link) => link.bow > 0);
    expect(bowed.map((link) => link.id).sort()).toEqual(['evidence', 'market']);
    for (const link of bowed) {
      expect(Number(link.length.toFixed(1))).toBeCloseTo(13.0, 1);
      expect(link.bow).toBe(BOW_DEPTH);
      expect(link.d).toContain('Q');
    }
    expect(ringEngine(ENGINE_DESKTOP).every((link) => link.bow === 0)).toBe(true);
  });

  it('the bow rule is the released threshold — GN-CD-145 short-link bow at dist < 26 -> 11', () => {
    expect(BOW_THRESHOLD).toBe(26);
    expect(BOW_DEPTH).toBe(11);
    const shortest = Math.min(...ringEngine(ENGINE_MOBILE).map((link) => link.length));
    const shortestUnbowed = Math.min(
      ...ringEngine(ENGINE_MOBILE)
        .filter((link) => link.bow === 0)
        .map((link) => link.length),
    );
    expect(shortest).toBeLessThan(BOW_THRESHOLD);
    expect(shortestUnbowed).toBeGreaterThanOrEqual(BOW_THRESHOLD);
  });

  it('the pulse travels the connector REVERSED — card edge to hub anchor, same control point when bowed', () => {
    for (const config of [ENGINE_DESKTOP, ENGINE_MOBILE]) {
      for (const link of ringEngine(config)) {
        expect(link.motion.startsWith(`M${link.edge.x.toFixed(1)} ${link.edge.y.toFixed(1)}`)).toBe(true);
        expect(link.motion.endsWith(`${link.anchor.x.toFixed(1)} ${link.anchor.y.toFixed(1)}`)).toBe(true);
        if (link.bow) {
          expect(link.motion).toContain(`Q${link.control.x.toFixed(1)} ${link.control.y.toFixed(1)}`);
        }
      }
    }
  });

  it('extending any connector backwards passes through the hub centre — the generated-geometry invariant', () => {
    for (const config of [ENGINE_DESKTOP, ENGINE_MOBILE]) {
      for (const link of ringEngine(config)) {
        // The anchor lies on the hub circle at the module's own angle, so the
        // vector centre -> anchor and the vector centre -> card edge are collinear.
        const cross =
          (link.anchor.x - config.cx) * (link.edge.y - config.cy) -
          (link.anchor.y - config.cy) * (link.edge.x - config.cx);
        expect(Math.abs(cross)).toBeLessThan(0.5);
        const radius = Math.hypot(link.anchor.x - config.cx, link.anchor.y - config.cy);
        expect(radius).toBeCloseTo(config.r, 6);
      }
    }
  });
});

describe('M66.5 — the three node populations, exactly as released', () => {
  it('42 nodes per viewport: 9 anchor + 9 card-edge + 24 filler', () => {
    for (const config of [ENGINE_DESKTOP, ENGINE_MOBILE]) {
      expect(ringEngine(config)).toHaveLength(9);
      expect(fillerNodes(config)).toHaveLength(FILLER_COUNT);
      expect(ringEngine(config).length * 2 + fillerNodes(config).length).toBe(42);
    }
    expect(FILLER_COUNT).toBe(24);
  });

  it('the 24 filler coordinates reproduce the released lists exactly, on both viewports', () => {
    const render = (config: typeof ENGINE_DESKTOP): string =>
      fillerNodes(config)
        .map((node) => `(${key(node)})`)
        .join(' ');
    expect(render(ENGINE_DESKTOP)).toBe(DESKTOP_FILLER);
    expect(render(ENGINE_MOBILE)).toBe(MOBILE_FILLER);
  });

  it('filler nodes sit at exactly 15 degrees, radius 1.4, in the released fill and opacity', () => {
    expect(360 / FILLER_COUNT).toBe(15);
    expect(FILLER_RADIUS).toBe(1.4);
    expect(FILLER_FILL).toBe('#67e8f9');
    expect(FILLER_OPACITY).toBe(0.45);
    const nodes = fillerNodes(ENGINE_DESKTOP);
    for (let i = 0; i < nodes.length; i += 1) {
      const angle = Math.atan2(ENGINE_DESKTOP.cy - nodes[i].y, nodes[i].x - ENGINE_DESKTOP.cx);
      const degrees = ((angle * 180) / Math.PI + 360) % 360;
      expect(degrees).toBeCloseTo((i * 15) % 360, 6);
    }
  });

  it('the four cardinal filler indices land on the axes — Market, World, Evidence, and the empty downward axis', () => {
    // GN-CD-146: indices 0, 6, 12 and 18 coincide with the four cardinal
    // points, three of which carry a module anchor (Market, World,
    // Evidence). The fourth is the downward axis, where no module sits.
    // "An intentional consequence of 24 evenly spaced nodes, not a
    // duplication bug" — so none of them is de-duplicated.
    const filler = fillerNodes(ENGINE_DESKTOP).map(key);
    const anchors = new Map(ringEngine(ENGINE_DESKTOP).map((link) => [key(link.anchor), link.id]));
    expect(anchors.get(filler[0])).toBe('market');
    expect(anchors.get(filler[6])).toBe('world-intelligence');
    expect(anchors.get(filler[12])).toBe('evidence');
    expect(anchors.has(filler[18])).toBe(false);
    expect(filler[18]).toBe(`${ENGINE_DESKTOP.cx.toFixed(1)},${(ENGINE_DESKTOP.cy + ENGINE_DESKTOP.r).toFixed(1)}`);
    // All 24 are still emitted; the coincidence removes nothing.
    expect(fillerNodes(ENGINE_DESKTOP)).toHaveLength(24);
  });

  it('node radii are the released values on both viewports', () => {
    expect(ENGINE_DESKTOP.nodeR).toBe(3.4);
    expect(ENGINE_MOBILE.nodeR).toBe(2.8);
    expect(cardNodeRadius(ENGINE_DESKTOP)).toBe(2.45);
    expect(cardNodeRadius(ENGINE_MOBILE)).toBe(2.02);
    expect(CARD_NODE_RATIO).toBe(0.72);
    expect(ENGINE_DESKTOP.pulseR).toBe(3.4);
    expect(ENGINE_MOBILE.pulseR).toBe(2);
    // GN-CD-156 — hovered hub anchor, 3.4 -> 5.78.
    expect(Number((ENGINE_DESKTOP.nodeR * HOVER_NODE_RATIO).toFixed(2))).toBe(5.78);
  });

  it('the acknowledgement swells carry the released stops at both ends and both viewports', () => {
    const parse = (values: string): number[] => values.split(';').map(Number);
    expect(parse(hubAckValues(ENGINE_DESKTOP))).toEqual([3.4, 6.12, 3.4]);
    expect(parse(hubAckValues(ENGINE_MOBILE))).toEqual([2.8, 5.04, 2.8]);
    expect(parse(cardAckValues(ENGINE_DESKTOP))).toEqual([2.45, 5.1, 2.45]);
    expect(parse(cardAckValues(ENGINE_MOBILE))).toEqual([2.02, 4.2, 2.02]);
    expect(ACK_KEY_TIMES).toBe('0;0.08;0.3');
  });

  it('GN-CD-146 node-opacity divergence is reproduced, not harmonised (UNRESOLVED-017)', () => {
    expect(NODE_OPACITY_APPLIED.desktop).toBe(true);
    expect(NODE_OPACITY_APPLIED.mobile).toBe(false);
  });
});

describe('M66.5 — pulse timing is generated from the released formulas', () => {
  it('three durations cycle by ring position, and reproduce the released table', () => {
    expect([...PULSE_DURATIONS]).toEqual([3.6, 4.05, 4.5]);
    PULSE_TABLE.forEach(([dur], index) => {
      expect(pulseDuration(index)).toBe(dur);
    });
  });

  it('the reconstructed begin formula reproduces all nine released offsets exactly', () => {
    PULSE_TABLE.forEach(([, begin], index) => {
      expect(pulseBegin(index)).toBe(begin);
    });
  });

  it('no two module pulses share a start offset — the network never reads as synchronised', () => {
    const begins = PULSE_TABLE.map((_, index) => pulseBegin(index));
    expect(new Set(begins).size).toBe(9);
  });

  it('each pulse reaches the hub at begin + dur x 0.3 and returns to the card at begin + dur x 0.7', () => {
    expect(HUB_ACK_PHASE).toBe(0.3);
    expect(CARD_ACK_PHASE).toBe(0.7);
    const links = ringEngine(ENGINE_DESKTOP);
    PULSE_TABLE.forEach(([dur, begin, hubHit, cardHit], index) => {
      expect(links[index].dur).toBe(dur);
      expect(links[index].begin).toBe(begin);
      expect(links[index].hubAck).toBeCloseTo(hubHit, 1);
      expect(links[index].cardAck).toBeCloseTo(cardHit, 1);
    });
  });

  it('the released cycle definition is unchanged — out at 0.3, dwell to 0.4, back by 0.7', () => {
    expect(PULSE_KEY_TIMES).toBe('0;0.3;0.4;0.7;1');
    expect(PULSE_KEY_POINTS).toBe('0;1;1;0;0');
    expect(PULSE_FADE_VALUES).toBe('0;1;1;1;1;0;0');
    expect(PULSE_FADE_TIMES).toBe('0;0.04;0.3;0.4;0.7;0.76;1');
    expect(PULSE_FADE_VALUES.split(';')).toHaveLength(PULSE_FADE_TIMES.split(';').length);
  });

  it('begins and durations are COMPUTED, never a hardcoded nine-entry table in the product', () => {
    const code = stripComments(geometrySource);
    expect(code).toMatch(/export function pulseBegin/);
    expect(code).toMatch(/export function pulseDuration/);
    // The released begin literals must not appear as a transcribed array.
    expect(code).not.toMatch(/\[\s*0\s*,\s*1\s*,\s*1\.44\s*,\s*2\.44/);
  });
});

describe('M66.5 — the released compositions and their invariants', () => {
  it('the canvases are the released fixed pixel boxes', () => {
    expect([ENGINE_DESKTOP.canvasWidth, ENGINE_DESKTOP.canvasHeight]).toEqual([1240, 520]);
    expect([ENGINE_MOBILE.canvasWidth, ENGINE_MOBILE.canvasHeight]).toEqual([310, 340]);
    expect([ENGINE_DESKTOP.cardW, ENGINE_DESKTOP.cardH]).toEqual([340, 82]);
    expect([ENGINE_MOBILE.cardW, ENGINE_MOBILE.cardH]).toEqual([108, 56]);
  });

  it('hub centre and anchor radius are the released literals', () => {
    expect([ENGINE_DESKTOP.cx, ENGINE_DESKTOP.cy, ENGINE_DESKTOP.r]).toEqual([620, 250, 107]);
    expect([ENGINE_MOBILE.cx, ENGINE_MOBILE.cy, ENGINE_MOBILE.r]).toEqual([155, 174, 33]);
  });

  it('GN-CD §E geometric invariant — the anchor radius IS the hub visual radius', () => {
    expect(hubVisualRadius(HUB_VISUAL.desktop.box, HUB_VISUAL.desktop.inset)).toBe(ENGINE_DESKTOP.r);
    expect(hubVisualRadius(HUB_VISUAL.mobile.box, HUB_VISUAL.mobile.inset)).toBe(ENGINE_MOBILE.r);
    expect(HUB_VISUAL.desktop.box).toBe(296);
    expect(HUB_VISUAL.desktop.core).toBe(158);
    expect(HUB_VISUAL.mobile.box).toBe(66);
    expect(HUB_VISUAL.mobile.core).toBe(52);
  });

  it('the nine cards form a CLOSED RING, mirror-symmetric about the hub, with one card at 12 o’clock', () => {
    for (const config of [ENGINE_DESKTOP, ENGINE_MOBILE]) {
      const top = config.items.filter((item) => item.y < config.cy && Math.abs(item.x - config.cx) < 1);
      expect(top).toHaveLength(1);
      // Every non-axial card has a mirror partner across x = cx.
      for (const item of config.items) {
        const mirrored = config.items.find(
          (other) => Math.abs(other.x - (2 * config.cx - item.x)) < 1.5 && Math.abs(other.y - item.y) < 1,
        );
        expect(mirrored).toBeDefined();
      }
      // No two cards occupy the same slot.
      expect(new Set(config.items.map((item) => `${item.x},${item.y}`)).size).toBe(9);
    }
  });

  it('GN-CD-154 card extent check — no mobile card is clipped by the 310x340 canvas', () => {
    for (const item of ENGINE_MOBILE.items) {
      expect(item.x - ENGINE_MOBILE.cardW / 2).toBeGreaterThanOrEqual(0);
      expect(item.x + ENGINE_MOBILE.cardW / 2).toBeLessThanOrEqual(ENGINE_MOBILE.canvasWidth);
      expect(item.y - ENGINE_MOBILE.cardH / 2).toBeGreaterThanOrEqual(0);
      expect(item.y + ENGINE_MOBILE.cardH / 2).toBeLessThanOrEqual(ENGINE_MOBILE.canvasHeight);
    }
  });

  it('CTO decision D-9 A — DOM and tab order follow the released geometry order, not the registry order', () => {
    expect([...RING_ORDER]).toEqual([
      'world-intelligence',
      'ai-research',
      'country-intelligence',
      'evidence',
      'market',
      'economy',
      'timeline',
      'conflict',
      'forecast',
    ]);
    expect(ENGINE_DESKTOP.items.map((item) => item.id)).toEqual([...RING_ORDER]);
    expect(ENGINE_MOBILE.items.map((item) => item.id)).toEqual([...RING_ORDER]);
    // Deliberately DIFFERENT from the canonical registry order, which its own
    // spec locks. Both orders are correct; each is asserted where it belongs.
    expect(ENGINE_DESKTOP.items.map((item) => item.id)).not.toEqual(
      INTELLIGENCE_MODULES.map((moduleItem) => moduleItem.id),
    );
  });

  it('every ring position names a real module from the canonical registry, and all nine are placed', () => {
    const ids = new Set(INTELLIGENCE_MODULES.map((moduleItem) => moduleItem.id));
    expect(RING_ORDER).toHaveLength(9);
    for (const id of RING_ORDER) {
      expect(ids.has(id)).toBe(true);
    }
    expect(new Set(RING_ORDER).size).toBe(9);
  });
});

describe('M66.5 — released identity colours and mobile icons (CTO decision D-4 A)', () => {
  it('the nine identity colours are the GN-CD-148 literals, held locally to this family', () => {
    expect(MODULE_IDENTITY['ai-research'].hex).toBe('#fbbf24');
    expect(MODULE_IDENTITY.evidence.hex).toBe('#c4b5fd');
    expect(MODULE_IDENTITY.economy.hex).toBe('#34d399');
    expect(MODULE_IDENTITY.conflict.hex).toBe('#f87171');
    expect(MODULE_IDENTITY['world-intelligence'].hex).toBe('#34d399');
    expect(MODULE_IDENTITY['country-intelligence'].hex).toBe('#60a5fa');
    expect(MODULE_IDENTITY.market.hex).toBe('#22d3ee');
    expect(MODULE_IDENTITY.timeline.hex).toBe('#c4b5fd');
    expect(MODULE_IDENTITY.forecast.hex).toBe('#fbbf24');
  });

  it('each rgb triple is the same colour as its hex — one property drives border, fill, glow, text and stroke', () => {
    for (const id of RING_ORDER) {
      const { hex, rgb } = MODULE_IDENTITY[id];
      const channels = rgb.split(',').map(Number);
      expect(channels).toHaveLength(3);
      const asHex = `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      expect(asHex).toBe(hex);
    }
  });

  it('UNRESOLVED-015 is reproduced as released, not silently de-duplicated', () => {
    expect(MODULE_IDENTITY.economy.hex).toBe(MODULE_IDENTITY['world-intelligence'].hex);
    expect(MODULE_IDENTITY.evidence.hex).toBe(MODULE_IDENTITY.timeline.hex);
    // ...and status is therefore NEVER carried by colour alone (GN-CD-307):
    // every card renders a text badge. Asserted in intelligenceEngineCanvas.spec.ts.
  });

  it('all nine mobile icon paths exist and are single stroked paths', () => {
    for (const id of RING_ORDER) {
      expect(typeof MOBILE_ICON_PATHS[id]).toBe('string');
      expect(MOBILE_ICON_PATHS[id].length).toBeGreaterThan(10);
      expect(MOBILE_ICON_PATHS[id].startsWith('M')).toBe(true);
    }
    expect(new Set(Object.values(MOBILE_ICON_PATHS)).size).toBe(9);
  });
});

/**
 * GN-CD-148/149 fit contract — CTO decision D-5 A.
 *
 * The mobile card is a fixed `108x56` box with `overflow:hidden`, so the
 * released short titles and the localized status badges must be MEASURED
 * rather than assumed. IBM Plex Mono has a fixed 600/1000-em advance, so
 * the widths below are exact for the released type sizes and tracking.
 */
const MOBILE_TEXT_COLUMN = ENGINE_MOBILE.cardW - 2 * 7 - 17 - 6; // 71px
const MOBILE_VERTICAL_BUDGET = ENGINE_MOBILE.cardH - 2 * 5; // 46px
const NAME_LINE_HEIGHT = 10 * 1.22;
const BADGE_BLOCK = 15;

function monoWidth(text: string, px: number, tracking: number): number {
  return text.length * (px * 0.6 + px * tracking);
}

function badgeWidth(label: string): number {
  return monoWidth(label, 9, 0) + 2 * 3 + 2;
}

describe('M66.5 — every released mobile card fits, in both production languages', () => {
  const languages = ['en', 'pl'] as const;

  it('all nine modules carry a shortTitle in both languages, and none is empty', () => {
    for (const language of languages) {
      const modules = getDictionary(language).intelligenceModules.modules;
      for (const moduleItem of INTELLIGENCE_MODULES) {
        const text = modules[moduleItem.dictionaryKey as keyof typeof modules];
        expect(typeof text.shortTitle).toBe('string');
        expect(text.shortTitle.length).toBeGreaterThan(0);
      }
    }
  });

  it('no short title exceeds two lines in the released 71px column, so none is clipped', () => {
    expect(MOBILE_TEXT_COLUMN).toBe(71);
    expect(MOBILE_VERTICAL_BUDGET).toBe(46);
    for (const language of languages) {
      const modules = getDictionary(language).intelligenceModules.modules;
      for (const moduleItem of INTELLIGENCE_MODULES) {
        const text = modules[moduleItem.dictionaryKey as keyof typeof modules];
        const width = monoWidth(text.shortTitle, 10, 0.02);
        const lines = Math.ceil(width / MOBILE_TEXT_COLUMN);
        expect(lines).toBeLessThanOrEqual(2);
        expect(lines * NAME_LINE_HEIGHT + BADGE_BLOCK).toBeLessThanOrEqual(MOBILE_VERTICAL_BUDGET);
      }
    }
  });

  it('every localized status badge fits the column on ONE line — which is why nowrap is load-bearing', () => {
    for (const language of languages) {
      const labels = getDictionary(language).intelligenceModules.stateLabels;
      for (const label of [labels.active, labels.preview, labels.comingSoon]) {
        expect(badgeWidth(label.toUpperCase())).toBeLessThanOrEqual(MOBILE_TEXT_COLUMN);
      }
    }
  });

  it('the tightest fit in the whole card is the English COMING SOON badge — locked so copy cannot silently break it', () => {
    const english = getDictionary('en').intelligenceModules.stateLabels.comingSoon.toUpperCase();
    const width = badgeWidth(english);
    expect(width).toBeGreaterThan(60);
    expect(width).toBeLessThanOrEqual(MOBILE_TEXT_COLUMN);
  });

  it('reusing the full title on mobile WOULD clip — the measured reason shortTitle exists', () => {
    const modules = getDictionary('en').intelligenceModules.modules;
    const clipped = INTELLIGENCE_MODULES.filter((moduleItem) => {
      const text = modules[moduleItem.dictionaryKey as keyof typeof modules];
      return Math.ceil(monoWidth(text.title, 10, 0.02) / MOBILE_TEXT_COLUMN) > 2;
    });
    expect(clipped.length).toBeGreaterThan(0);
  });
});
