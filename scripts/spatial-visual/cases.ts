/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE FOUR PROTECTED FRAMES — C907 §11
 * ════════════════════════════════════════════════════════════════════════════
 *
 * *"Create deterministic protected render cases: V1 WORLD, V2 RWANDA / EAST
 * AFRICA, V3 SELECTED COUNTRY, V4 EVIDENCE MODE. At fixed viewport +
 * deterministic fixture evidence: capture screenshots."*
 *
 * ── WHAT MAKES A CASE DETERMINISTIC ─────────────────────────────────────────
 *
 * Four things, and all four must hold or the comparison in part B measures
 * noise instead of drift:
 *
 *   FIXED VIEWPORT    so the map pane width is the same, which the world-fit
 *                     framing rule depends on by design.
 *   FIXED CAMERA      supplied through the `cam=` URL parameter, which is the
 *                     product's own camera contract — not a synthetic hook. A
 *                     case that cannot be expressed as a URL is a case a human
 *                     cannot reproduce by hand.
 *   PINNED EVIDENCE   supplied by the TEST HARNESS, not by the product. The
 *                     first issue of these cases asked for it with a
 *                     `fixture=golden-*` query parameter; nothing in the
 *                     product ever read that parameter, so every "deterministic"
 *                     capture was in fact taken against the live feed. The
 *                     parameters are gone and `interception.mjs` pins the
 *                     responses from outside instead — C907 R2.
 *   MOTION DISABLED   the 3.2 s evidence ripple and the amber sweep are real
 *                     product behaviour and would otherwise sample at a random
 *                     phase.
 *
 * ── THE CAMERAS ARE DERIVED FROM THE GOLDEN FRAMES, NOT COPIED FROM THEM ────
 *
 * The golden captures print `Z 1.6` and `Z 6.9`, which are the d3 prototype's
 * own scale factor and NOT MapLibre zooms — copying them would be the blind
 * hardcoding §6 forbids. V1 therefore asks for RESET WORLD and lets the
 * viewport-aware rule solve the zoom, which is the behaviour under test. V2's
 * centre is the golden Rwanda frame's own printed centre, `1.94°S 29.87°E`,
 * and its zoom is the product's regional framing for that extent.
 */

export interface ProtectedFrame {
  readonly id: 'V1' | 'V2' | 'V3' | 'V4';
  readonly name: string;
  /** CSS pixels. Fixed, because the framing rule is a function of the pane. */
  readonly viewport: { readonly width: number; readonly height: number };
  /**
   * The route, including the camera. `null` for V1: RESET WORLD is what is
   * being tested, so the case must NOT pin a zoom.
   */
  readonly cam: string | null;
  readonly query: Readonly<Record<string, string>>;
  /** What a human reviewer is being asked to confirm in part C. */
  readonly acceptance: readonly string[];
}

export const PROTECTED_FRAMES: readonly ProtectedFrame[] = [
  {
    id: 'V1',
    name: 'WORLD',
    viewport: { width: 1440, height: 900 },
    cam: null,
    query: { mode: 'EVIDENCE', period: '7D' },
    acceptance: [
      'The world occupies the usable map frame — no small Earth in an empty field.',
      'Continents, coastlines and internal borders are all separately legible.',
      'The 10° graticule reads across open ocean and is covered by land.',
      'NO river, city or lake labels at world scale.',
      'Cyan and amber evidence are the brightest things in frame.',
      'The right rail has its own ground and reads as sitting above the map.',
    ],
  },
  {
    id: 'V2',
    name: 'RWANDA / EAST AFRICA',
    viewport: { width: 1440, height: 900 },
    /* The golden Rwanda frame's own printed centre. */
    cam: '5.9/29.87/-1.94',
    query: { mode: 'EVIDENCE', period: '7D', select: 'RWA' },
    acceptance: [
      'East Africa geography is visible FIRST, with intelligence above it.',
      'The field is dark teal/slate, not near-black.',
      'Lakes Kivu, Edward and Albert are drawn and labelled.',
      'Uganda, DR Congo, Tanzania and Burundi are filled and edged as context.',
      'Kigali, Kampala and Goma are labelled; nothing is invented for Bukavu.',
      'Rwanda carries the selected treatment and the evidence rings sit above the geography.',
    ],
  },
  {
    id: 'V3',
    name: 'SELECTED COUNTRY',
    viewport: { width: 1440, height: 900 },
    cam: '4.2/37.9/0.2',
    query: { mode: 'EVIDENCE', period: '7D', select: 'KEN' },
    acceptance: [
      'The selection is carried by fill + edge + HUD state, never by an oversized border.',
      'The selection callout has its own ground and does not float on the map.',
      'Neighbouring countries keep their own evidence tones.',
    ],
  },
  {
    id: 'V4',
    name: 'EVIDENCE MODE',
    viewport: { width: 1440, height: 900 },
    cam: '2.4/24/6',
    query: { mode: 'EVIDENCE', period: '30D' },
    acceptance: [
      'All five legend states are distinguishable: verified, attention, interpreted, none, reference.',
      'Uncertainty is DRAWN — dashed and unfilled — not merely labelled.',
      'No colour appears on the map that is not in the legend.',
    ],
  },
];

/** The route a frame is captured at. */
export function frameUrl(base: string, frame: ProtectedFrame): string {
  const params = new URLSearchParams(frame.query);
  if (frame.cam !== null) params.set('cam', frame.cam);
  return `${base}/map?${params.toString()}`;
}
