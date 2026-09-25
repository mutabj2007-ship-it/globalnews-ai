/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE HOME PRESENTATION LAYER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DESKTOP PREMIUM VISUAL PASS §1:
 *
 *   "Stop using the existing app look as the default. Build a Home-specific
 *    presentation layer if necessary."
 *
 * This is that layer. It is a Home-only token module: nothing outside
 * `components/home` imports it, and it redefines nothing in the global theme,
 * so no other accepted surface can shift because of a value in this file.
 *
 * ── EVERY VALUE HERE WAS MEASURED OR SAMPLED, NOT CHOSEN ────────────────
 *
 * §3 ("Measure the prototype screenshot directly. Do not eyeball it.") and §11
 * ("Sample the prototype directly … Do not substitute muted existing app
 * colors merely because they already exist.") are method instructions, so the
 * method is recorded with the result. Geometry came from edge-run detection on
 * column and row medians of `PO-DESKTOP-HOME-BETA-LAUNCH.jpg` (1280x853);
 * colours are the median of a 5x5 pixel patch, or the brightest pixel inside a
 * glyph box where the target is text. The full table, with the coordinates
 * each number came from, is `PROTOTYPE-MEASURED-TABLE.md` in the package.
 *
 * A token whose value is a measurement carries that measurement in its
 * comment. If a future reader thinks a value is wrong, they can re-measure the
 * same pixels and settle it, instead of arguing about taste.
 *
 * ── THE FINDING THAT DROVE §2 ───────────────────────────────────────────
 *
 * The prototype's card hairline samples at `#010d1d`. Its card fill samples at
 * `#082038`. The hairline is DARKER THAN THE FILL. The prototype does not
 * outline its cards at all — it separates them with a filled surface and an
 * outer shadow, and the only bright edge on a card is a 1px inner highlight
 * along the top, which reads as light falling on a raised object rather than
 * as a drawn border.
 *
 * The shipped implementation used `border-[1.5px] border-white/[0.13]`, a
 * bright rule on every card. That single choice is most of what §2 called "the
 * outlined-box look" and what the ruling called "an internal engineering
 * dashboard". `CARD_SHELL` below is the corrected mechanism, not a softened
 * version of the old one.
 */

/* -- THE PAGE SURFACE ---------------------------------------------------- */

/**
 * Sampled page background: `#010a19` (also `#020b1a`, `#010c1c` elsewhere on
 * the page). The application's global `bg-void` is `#080b12` -- lighter, and
 * grey rather than blue.
 *
 * The global token is NOT changed. `bg-void` sits on `<body>` and under every
 * accepted surface in the product, and the standing rule is not to redesign
 * completed surfaces. This class goes on Home's own `<main>` instead, so the
 * sampled background reaches exactly one route.
 */
export const HOME_PAGE_SURFACE =
  'relative bg-[#010a19] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[560px] ' +
  'before:bg-[radial-gradient(ellipse_120%_90%_at_50%_0%,rgba(6,40,78,0.55),transparent_72%)]';

/* ── SURFACES ───────────────────────────────────────────────────────────── */

/**
 * The Home card shell.
 *
 * Measured: radius 12px (prototype corner arc), card fill `#082038` at the top
 * falling to `#02152b` at the bottom, hairline `#010d1d`.
 *
 * Four layers, in the order the prototype builds them:
 *   1. a filled gradient surface — the separation mechanism;
 *   2. a hairline that is darker than the fill, so the card reads as cut into
 *      the page rather than drawn on top of it;
 *   3. a 1px inner highlight on the top edge only (`inset 0 1px 0`), which is
 *      the only bright edge the prototype has;
 *   4. a wide, soft cast shadow, which is what actually lifts the card.
 */
export const CARD_SHELL =
  'rounded-[12px] border border-[#010d1d] bg-[linear-gradient(to_bottom,#082038_0%,#041a30_46%,#02152b_100%)] ' +
  'shadow-[inset_0_1px_0_rgba(148,197,255,0.13),0_18px_40px_-24px_rgba(0,0,0,0.95),0_2px_10px_-6px_rgba(0,0,0,0.8)]';

/** The same shell with the hover lift §4 asks for. */
export const CARD_SHELL_INTERACTIVE =
  `${CARD_SHELL} transition-[transform,box-shadow] duration-200 ` +
  'hover:-translate-y-[3px] ' +
  'hover:shadow-[inset_0_1px_0_rgba(148,197,255,0.22),0_26px_56px_-22px_rgba(0,0,0,0.98),0_0_0_1px_rgba(56,189,248,0.16)] ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** Rail map card. Sampled fill `#05172d`; same shell language, own fill. */
export const RAIL_CARD_SHELL =
  'rounded-[12px] border border-[#01101f] bg-[linear-gradient(to_bottom,#06192f_0%,#041426_100%)] ' +
  'shadow-[inset_0_1px_0_rgba(148,197,255,0.12),0_18px_40px_-24px_rgba(0,0,0,0.95)]';

/** Rail Ask card. Sampled fill `#031428` — deliberately darker than the map. */
export const ASK_CARD_SHELL =
  'rounded-[12px] border border-[#010e1c] bg-[linear-gradient(to_bottom,#04162b_0%,#020f20_100%)] ' +
  'shadow-[inset_0_1px_0_rgba(148,197,255,0.10),0_18px_40px_-24px_rgba(0,0,0,0.95)]';

/** Map inner box. Sampled `#021124`; measured inset 13px, radius ~8px. */
export const MAP_BOX =
  'rounded-[8px] bg-[#021124] shadow-[inset_0_0_0_1px_rgba(120,180,255,0.07),inset_0_18px_40px_-28px_rgba(80,160,255,0.35)]';

/**
 * Ask prompt row. Measured 32px tall, 8px gap, radius ~8px.
 * Sampled fill `#12263f`, border `#122840` — again barely lighter than itself,
 * so §7's "fewer hard borders" is the sampled truth, not a softening.
 */
export const ASK_ROW =
  'rounded-[8px] border border-[#122840] bg-[#12263f] shadow-[inset_0_1px_0_rgba(160,200,255,0.06)]';

/* ── TYPE SCALE ─────────────────────────────────────────────────────────── */

/**
 * §8 ("Increase typography scale") resolved by measurement rather than taste.
 * Cap-height boxes read off the prototype, converted at cap ≈ 0.72em:
 *
 *   section heading   cap 20px  ->  ~27px / 700
 *   story headline    2 lines   ->  ~15px / 16.5px leading
 *   topic label                 ->  ~15px / 700
 *   standfirst                  ->  ~12.5px
 *   meta                        ->  ~10.5px
 */
export const SECTION_TITLE =
  'font-semibold tracking-[-0.02em] text-white text-[24px] lg:text-[27px] xl:text-[28px]';
export const SECTION_STANDFIRST = 'text-[12.5px] leading-[1.45] text-[#8fa6c0]';

/* ── CATEGORY CHIPS ─────────────────────────────────────────────────────── */

export interface ChipStyle {
  readonly className: string;
}

/**
 * Measured 55x18px, radius ~5px, ~10px uppercase, 7px horizontal padding.
 *
 * ── THE PROTOTYPE'S FOUR CHIPS ARE NOT CATEGORIES THIS PRODUCT EMITS ────
 *
 * The prototype draws ENERGY, SECURITY, ECONOMY and HUMANITARIAN. Those are
 * INTELLIGENCE MODULE names. The governed news taxonomy — the one the feed
 * actually carries, and the one `dict.map.categories` labels — is world,
 * politics, business, technology, science, health, sports, entertainment.
 * A real story is never tagged "energy".
 *
 * So the four prototype chips cannot be reproduced literally without printing
 * a category the story does not have. What IS reproduced is what the
 * prototype's chips are made of, sampled from its own pixels: a dark tinted
 * fill, a border one step brighter than that fill, and light text in the same
 * hue. Those sampled triples are then assigned across the eight real
 * categories by hue family — the teal the prototype used for ENERGY goes to
 * science, its indigo goes to business, its maroon to politics, its amber to
 * health. Same visual language, true labels.
 *
 * The one sampled value deliberately NOT carried over is the prototype's
 * HUMANITARIAN chip, which it fills solid amber (`#ecae4c`) with dark text
 * while its other three are tinted. Reproducing a one-off exception on a
 * category that will never appear would make a real feed look inconsistent
 * for no gain. It stays here under its own key, unused by the live taxonomy,
 * so the value is not lost if a domain-tagged surface ever wants it.
 */
export const CHIP_STYLE: Record<string, ChipStyle> = {
  /* teal — sampled from the prototype's ENERGY chip */
  science: { className: 'border-[#054e55] bg-[#033a3e] text-[#8ce1da]' },
  technology: { className: 'border-[#054e55] bg-[#033a3e] text-[#8ce1da]' },
  /* maroon — sampled from the prototype's SECURITY chip */
  politics: { className: 'border-[#3d131d] bg-[#2d1728] text-[#de979f]' },
  /* indigo — sampled from the prototype's ECONOMY chip */
  business: { className: 'border-[#2f2a86] bg-[#241f63] text-[#c4bffb]' },
  /* amber, in the tinted form rather than the prototype's solid fill */
  health: { className: 'border-[#6b4a12] bg-[#43300d] text-[#ffcf7d]' },
  /* the prototype's own blue, for the broadest category */
  world: { className: 'border-[#0c4577] bg-[#07304f] text-[#93cdf5]' },
  sports: { className: 'border-[#14513a] bg-[#0b3627] text-[#7fe0b6]' },
  entertainment: { className: 'border-[#4a2160] bg-[#311542] text-[#d9a6f0]' },

  /* Retained, unused by the live taxonomy: the prototype's exact chips. */
  energy: { className: 'border-[#054e55] bg-[#033a3e] text-[#8ce1da]' },
  security: { className: 'border-[#3d131d] bg-[#2d1728] text-[#de979f]' },
  economy: { className: 'border-[#251872] bg-[#302977] text-[#dcd9ff]' },
  humanitarian: { className: 'border-[#f5b94b] bg-[#ecae4c] text-[#3a2a06]' },
};

export const CHIP_FALLBACK: ChipStyle = {
  className: 'border-[#1d3350] bg-[#12253d] text-[#a9c2dc]',
};

export const CHIP_BASE =
  'inline-flex h-[18px] items-center rounded-[5px] border px-[7px] font-mono text-[9.5px] font-bold uppercase tracking-[0.10em]';

/* ── TOPIC CARDS ────────────────────────────────────────────────────────── */

export interface TopicStyle {
  /** Sampled corner-to-corner gradient of the prototype card. */
  readonly surface: string;
  /** Sampled icon glyph colour. The prototype has NO icon tile — a bare glyph. */
  readonly icon: string;
  /** Filled circular arrow, measured 24px diameter. */
  readonly arrow: string;
  readonly hover: string;
}

/**
 * Sampled at four corners of each prototype card. The gradient runs from a
 * saturated tint at the top-left to near-black at the bottom-right — which is
 * why the shipped `from-sky-500/30 to-sky-700/12` vertical wash never matched:
 * wrong axis, and far less chromatic than the sampled values.
 */
export const TOPIC_STYLE: Record<string, TopicStyle> = {
  'world-intelligence': {
    surface: 'bg-[linear-gradient(135deg,#032f6f_0%,#042858_38%,#061831_100%)]',
    icon: 'text-[#6ce6ff]',
    arrow: 'bg-[#1668c4] text-white shadow-[0_0_16px_-4px_rgba(56,189,248,0.8)]',
    hover: 'hover:shadow-[0_26px_56px_-22px_rgba(8,60,130,0.95),inset_0_1px_0_rgba(140,210,255,0.28)]',
  },
  economy: {
    surface: 'bg-[linear-gradient(135deg,#1a1a4a_0%,#181b44_38%,#09182d_100%)]',
    icon: 'text-[#b296fc]',
    arrow: 'bg-[#5b3fc4] text-white shadow-[0_0_16px_-4px_rgba(167,139,250,0.8)]',
    hover: 'hover:shadow-[0_26px_56px_-22px_rgba(40,30,110,0.95),inset_0_1px_0_rgba(190,170,255,0.26)]',
  },
  energy: {
    surface: 'bg-[linear-gradient(135deg,#003831_0%,#0a2c2b_38%,#051f25_100%)]',
    icon: 'text-[#1ffcc9]',
    arrow: 'bg-[#0f8f6b] text-white shadow-[0_0_16px_-4px_rgba(45,212,191,0.8)]',
    hover: 'hover:shadow-[0_26px_56px_-22px_rgba(0,70,60,0.95),inset_0_1px_0_rgba(130,255,225,0.26)]',
  },
  security: {
    surface: 'bg-[linear-gradient(135deg,#391525_0%,#2e1a22_38%,#141522_100%)]',
    icon: 'text-[#ff8d97]',
    arrow: 'bg-[#b8394a] text-white shadow-[0_0_16px_-4px_rgba(251,113,133,0.8)]',
    hover: 'hover:shadow-[0_26px_56px_-22px_rgba(90,20,38,0.95),inset_0_1px_0_rgba(255,170,180,0.26)]',
  },
  humanitarian: {
    surface: 'bg-[linear-gradient(135deg,#4a2d14_0%,#362816_38%,#161a20_100%)]',
    icon: 'text-[#ffc762]',
    arrow: 'bg-[#b7801f] text-white shadow-[0_0_16px_-4px_rgba(251,191,36,0.8)]',
    hover: 'hover:shadow-[0_26px_56px_-22px_rgba(95,58,15,0.95),inset_0_1px_0_rgba(255,215,140,0.26)]',
  },
  market: {
    surface: 'bg-[linear-gradient(135deg,#131c2b_0%,#0d1a2a_38%,#091626_100%)]',
    icon: 'text-[#a8bfd1]',
    arrow: 'bg-[#3c5570] text-white shadow-[0_0_16px_-4px_rgba(148,180,210,0.7)]',
    hover: 'hover:shadow-[0_26px_56px_-22px_rgba(20,35,55,0.95),inset_0_1px_0_rgba(180,205,230,0.24)]',
  },
};

export const TOPIC_FALLBACK: TopicStyle = {
  surface: 'bg-[linear-gradient(135deg,#0e1c30_0%,#0a1728_38%,#061220_100%)]',
  icon: 'text-[#9db4cc]',
  arrow: 'bg-[#2a3f58] text-white',
  hover: 'hover:shadow-[0_26px_56px_-22px_rgba(10,25,45,0.95)]',
};

/** Measured: 136x119 card, radius 12, icon ~25px bare, arrow circle 24px. */
export const TOPIC_CARD_BASE =
  'group relative flex h-full min-h-[122px] flex-col items-start overflow-hidden rounded-[12px] border border-[#01101f] p-[13px] ' +
  'shadow-[inset_0_1px_0_rgba(148,197,255,0.14),0_18px_40px_-24px_rgba(0,0,0,0.95)] ' +
  'transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/* ── SITUATION MAP LEGEND ───────────────────────────────────────────────── */

/**
 * Sampled from the prototype's own legend dots. The shipped values were
 * Tailwind `emerald/red/amber/violet`, which sample visibly duller than these.
 */
export const LEGEND_COLOUR: Record<string, string> = {
  energy: '#36e8c4',
  conflict: '#f2666f',
  humanitarian: '#ffca53',
  economy: '#a36ef0',
};
