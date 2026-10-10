/**
 * ════════════════════════════════════════════════════════════════════════════
 * STANDALONE ASK NAVIGATION — THE ASK GLOBALNEWSAI PUBLIC BETA SHELL IA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SUPERSESSION RECORD. This file previously held the ASK PERSONAL NAVIGATION +
 * TODAY R2 information architecture, which placed Ask inside the GlobalNewsAI
 * platform: a DISCOVER section (Today, World Map) and a YOUR INTELLIGENCE
 * section (My Intelligence) sat beside the Ask items.
 *
 * The Product Owner correction ASK GLOBALNEWSAI STANDALONE BETA supersedes that
 * IA. We are not launching the platform; we are launching Ask GlobalNewsAI as a
 * standalone product. Today, World Map and My Intelligence are therefore not
 * required Ask Beta destinations, and they are REMOVED FROM THIS MODEL rather
 * than demoted inside it. The underlying routes and products are untouched and
 * still reachable from the platform's own header on every other route — this is
 * a navigation scope decision, not a deletion.
 *
 * WHAT SURVIVED THE CORRECTION, unchanged and deliberately so:
 *
 *   1  NO DEAD CONTROLS. Every entry has a real destination or a real action.
 *      There is no 'unavailable' kind in this union AT ALL, so a grey
 *      placeholder row is not expressible — the original defect cannot recur
 *      by edit.
 *
 *   2  A SIGNED-OUT READER SEES FEWER ITEMS, NOT GREY ONES. Recent, Saved and
 *      Settings are ABSENT from the signed-out menu, not disabled in it.
 *      `askMenuFor('signed-out')` returns a shorter array; it never returns a
 *      row carrying a `disabled` flag, because no such flag exists.
 *
 *   3  EVERY ENTRY CARRIES A VISIBLE LABEL. `labelKey` is what renders, through
 *      askNavStrings, in EN and PL. `icon` is a hint a renderer MAY use and
 *      never replaces a label.
 *
 * THE RULED SET, verbatim from the correction:
 *
 *   Signed-in   New question · Recent · Saved · Help & feedback · Settings ·
 *               Language · Sign out
 *   Signed-out  New question · Help & feedback · Language · Sign in
 *
 * Nothing else. `ASK_NAV_EXCLUDED_LABELS` below holds the correction's removal
 * list as data so a spec asserts the absence instead of a reviewer eyeballing it.
 */

/**
 * Two sections only. 'discover' and 'yourIntelligence' are GONE from the union,
 * not merely unused: a future edit cannot reintroduce a World Map row by
 * assigning it to a section that still exists.
 */
export const ASK_MENU_SECTIONS = ['ask', 'support'] as const;
export type AskMenuSection = (typeof ASK_MENU_SECTIONS)[number];

/**
 * 'route'  — a real Next.js destination.
 * 'action' — a real in-app action with no static URL (Sign in, Sign out, Language).
 *
 * THERE IS NO 'unavailable'. That is the point of this file.
 */
export const ASK_MENU_KINDS = ['route', 'action'] as const;
export type AskMenuKind = (typeof ASK_MENU_KINDS)[number];

export type AskMenuAudience = 'signed-in' | 'signed-out';

export interface AskMenuEntry {
  readonly id: string;
  /** Key into askNavStrings. The visible label, EN/PL. */
  readonly labelKey: string;
  /** English wording — provenance and last-resort fallback only. */
  readonly label: string;
  readonly kind: AskMenuKind;
  readonly section: AskMenuSection;
  /** Present only for 'route'. */
  readonly href?: string;
  /** Present only for 'action'. */
  readonly action?: 'signOut' | 'language' | 'signIn';
  /** Optional recognition aid. NEVER a replacement for the label. */
  readonly icon?: string;
  /** Which audiences see this entry at all. Absence is absence, never a grey row. */
  readonly audiences: readonly AskMenuAudience[];
  /** True for rows that must never sit in the navigation row itself. */
  readonly destructive?: true;
  /**
   * Set when the destination is owned by ANOTHER worker and may not exist yet.
   * The renderer suppresses such an entry until its route is live, so a
   * not-yet-implemented destination can be declared in the IA without shipping
   * a 404 as a menu row. See `askMenuFor`.
   */
  readonly ownedElsewhere?: 'claude-h';
}

const BOTH: readonly AskMenuAudience[] = ['signed-in', 'signed-out'];
const IN_ONLY: readonly AskMenuAudience[] = ['signed-in'];
const OUT_ONLY: readonly AskMenuAudience[] = ['signed-out'];

/** The ruled order: ASK, then SUPPORT, then utilities (below, outside sections). */
export const ASK_MENU_MODEL: readonly AskMenuEntry[] = [
  /* ── ASK ──────────────────────────────────────────────────────────────── */
  /*
   * New question is a ROUTE to the existing `/ask`, not an in-app action.
   * "Starts a new thread state" is what a clean /ask load DOES. Modelling it as
   * an action made the model disagree with the Product Owner's own matrix, and
   * a matrix test caught that. No automatic submission and no provider call: a
   * fresh composer destroys nothing and asks nothing.
   */
  {
    id: 'new-question',
    labelKey: 'newQuestion',
    label: 'New question',
    kind: 'route',
    section: 'ask',
    href: '/ask',
    icon: 'plus',
    audiences: BOTH,
  },
  /*
   * Recent and Saved are CLAUDE H's routes. They are declared here because the
   * correction puts them in the signed-in navigation, and suppressed by
   * `askMenuFor` until the routes exist, because this round forbids dead
   * controls. When H lands them, ASK_NAV_LIVE_ROUTES gains two strings and
   * these rows appear — no change to this model and none to the renderer.
   */
  {
    id: 'recent',
    labelKey: 'recent',
    label: 'Recent',
    kind: 'route',
    section: 'ask',
    href: '/ask/recent',
    icon: 'clock',
    audiences: IN_ONLY,
    ownedElsewhere: 'claude-h',
  },
  {
    id: 'saved',
    labelKey: 'saved',
    label: 'Saved',
    kind: 'route',
    section: 'ask',
    href: '/saved',
    icon: 'bookmark',
    audiences: IN_ONLY,
    ownedElsewhere: 'claude-h',
  },

  /* ── SUPPORT ──────────────────────────────────────────────────────────── */
  {
    id: 'help',
    labelKey: 'help',
    label: 'Help & feedback',
    kind: 'route',
    section: 'support',
    href: '/support',
    icon: 'help',
    audiences: BOTH,
  },
  /*
   * `/account/settings`, the route AccountControl already uses. NOT a new
   * settings surface and NOT `/my-intelligence`, which the correction excludes.
   */
  {
    id: 'settings',
    labelKey: 'settings',
    label: 'Settings',
    kind: 'route',
    section: 'support',
    href: '/account/settings',
    icon: 'settings',
    audiences: IN_ONLY,
  },
];

/**
 * Utilities sit BELOW the sections and outside them.
 *
 * Sign out is marked `destructive` and is deliberately the only such row. The
 * governing rule keeps destructive actions out of the navigation row itself, so
 * the renderer places it behind the account disclosure; a spec asserts no OTHER
 * destructive row has crept in beside navigation.
 */
export const ASK_MENU_UTILITIES: readonly AskMenuEntry[] = [
  /*
   * CORRECTION, RECORDED: `language` carried `action: 'newQuestion'` by
   * copy-paste in the first R2 draft — a defect that would have wired the
   * language control to start a new question. The matrix test caught it while
   * chasing an unrelated failure.
   */
  {
    id: 'language',
    labelKey: 'language',
    label: 'Language',
    kind: 'action',
    section: 'support',
    action: 'language',
    icon: 'globe',
    audiences: BOTH,
  },
  /*
   * CORRECTION, RECORDED: the first R2 draft gave Sign in the route `/login`.
   * THAT ROUTE DOES NOT EXIST, so shipping it would have fabricated exactly the
   * dead destination this round was called to remove. The real behaviour is
   * `accountSignInUrl(pathname)`: a DYNAMIC url carrying the reader's return
   * path. Sign in is therefore an action whose destination the renderer
   * resolves, and this model says so rather than naming a static path.
   */
  {
    id: 'sign-in',
    labelKey: 'signIn',
    label: 'Sign in',
    kind: 'action',
    section: 'support',
    action: 'signIn',
    audiences: OUT_ONLY,
  },
  {
    id: 'sign-out',
    labelKey: 'signOut',
    label: 'Sign out',
    kind: 'action',
    section: 'support',
    action: 'signOut',
    audiences: IN_ONLY,
    destructive: true,
  },
];

/**
 * THE CORRECTION'S REMOVAL LIST, as data.
 *
 * Nineteen labels the standalone Ask navigation may not carry. Seven are the
 * dead editorial entries the earlier rounds removed; the rest are real products
 * that simply are not Ask Beta destinations. A spec asserts no entry and no
 * rendered string matches any of these.
 */
export const ASK_NAV_EXCLUDED_LABELS: readonly string[] = [
  'World',
  'Politics',
  'Business',
  'Technology',
  'Science',
  'Health',
  'About',
  'Today',
  'World Map',
  'My Intelligence',
  'Economy',
  'Energy',
  'Security',
  'Humanitarian',
  'Market',
  'Conflict',
  'Elections',
  'Imihigo',
  'Deep Intelligence',
];

/**
 * Routes those excluded destinations live at. The products are NOT deleted —
 * every one of these still resolves — they are simply not reachable from the
 * standalone Ask shell. `/history` is here because it is the legacy Search
 * history that must never be presented as Ask Recent.
 */
export const ASK_NAV_EXCLUDED_ROUTES: readonly string[] = [
  '/',
  '/map',
  '/my-intelligence',
  '/history',
  '/search',
];

/**
 * Routes the shell may link to BECAUSE THEY EXIST, measured against the app
 * router at the time of writing and asserted against the filesystem by
 * askNavModel.spec.ts. This is the single list that decides whether a declared
 * entry renders, which is what makes "no dead controls" a checkable property.
 */
export const ASK_NAV_LIVE_ROUTES: readonly string[] = [
  '/ask',
  '/support',
  '/account/settings',
  /* STANDALONE PUBLIC BETA CONVERGENCE R1 — H's continuity routes are live. Never /history. */
  '/ask/recent',
  '/saved',
];

/**
 * Declared in the IA, not yet live, owned by Claude H. HANDOFF: when either
 * route lands, add it to ASK_NAV_LIVE_ROUTES and remove it from here; the row
 * then appears in the signed-in menu with no other change anywhere.
 */
/**
 * ASK R3 NAVIGATION / USABILITY R1 — THE R3 PRIMARY NAVIGATION: Ask · My updates · Saved.
 *
 * R3 HANDOFF.md §3 L74 (phone header ☰ · [Ask | My updates | Saved] · +), restored on phone AND
 * desktop by the CTO R3 conformity rulings of 2026-10-10. Existing destinations only: `/ask`, My
 * updates (`MY_UPDATES_HREF`, followedQuestions.ts) and `/saved`. No badge: there is no reviewed /
 * unreviewed state in the backend (B2), and the design forbids inventing a count.
 */
export type AskPrimarySectionId = 'ask' | 'updates' | 'saved';

export interface AskPrimarySection {
  readonly id: AskPrimarySectionId;
  readonly href: string;
}

export const ASK_PRIMARY_SECTIONS: readonly AskPrimarySection[] = Object.freeze([
  { id: 'ask', href: '/ask' },
  { id: 'updates', href: '/saved/updates' },
  { id: 'saved', href: '/saved' },
] as const);

export const ASK_NAV_PENDING_ROUTES: readonly string[] = [];

/**
 * The menu a given reader actually sees.
 *
 * Two filters, in this order: the audience filter (absence is absence), then the
 * liveness filter (a route entry whose destination does not exist is dropped
 * rather than rendered dead). `liveRoutes` is injected so a spec can prove both
 * states — the menu as it ships today, and the menu after H lands — without
 * editing this file.
 */
export function askMenuFor(
  audience: AskMenuAudience,
  liveRoutes: readonly string[] = ASK_NAV_LIVE_ROUTES,
): readonly AskMenuEntry[] {
  return ASK_MENU_MODEL.filter(
    (entry) =>
      entry.audiences.includes(audience) &&
      (entry.kind !== 'route' || entry.href === undefined || liveRoutes.includes(entry.href)),
  );
}

export function askUtilitiesFor(audience: AskMenuAudience): readonly AskMenuEntry[] {
  return ASK_MENU_UTILITIES.filter((entry) => entry.audiences.includes(audience));
}

/** Sections in ruled order, each with its visible entries, empty sections omitted. */
export function askMenuSectionsFor(
  audience: AskMenuAudience,
  liveRoutes: readonly string[] = ASK_NAV_LIVE_ROUTES,
): readonly { section: AskMenuSection; entries: readonly AskMenuEntry[] }[] {
  const visible = askMenuFor(audience, liveRoutes);
  return ASK_MENU_SECTIONS.map((section) => ({
    section,
    entries: visible.filter((entry) => entry.section === section),
  })).filter((group) => group.entries.length > 0);
}

/**
 * ZERO-COMPUTE CONTRACT, held as data.
 *
 * Every id here is an interaction that must cost nothing. Opening the menu,
 * moving through it and changing language issue no analysis request; a spec
 * asserts each resolves to a route or an action that touches no endpoint in
 * COMPUTE_ENDPOINTS.
 */
export const ZERO_COMPUTE_INTERACTIONS: readonly string[] = [
  'open-menu',
  'close-menu',
  'new-question',
  'recent',
  'saved',
  'help',
  'settings',
  'language',
  'sign-in',
];

/** Endpoints a zero-compute interaction may never call. */
export const COMPUTE_ENDPOINTS: readonly string[] = [
  '/analysis/news',
  '/ask-v2/operations',
  '/search',
];
