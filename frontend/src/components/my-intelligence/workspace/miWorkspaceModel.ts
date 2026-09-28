/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE — PREMIUM WORKSPACE R1 · THE WORKSPACE, AS DATA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: MY-INTELLIGENCE-PREMIUM-WORKSPACE-R1 (package "R1 review ZIPs and
 * navigation conflictsCTO.zip", SHA256 4059e9b3…a567ed4) — IA_BOARD.md,
 * SPEC.md, INTERACTIONS.md. Pure: no React, no DOM, no request. Every rule the
 * rail, drawer and dashboard render from is asserted here directly.
 *
 * RESOLVED OPEN ITEMS (the package's DECISIONS_AND_CONFLICTS.md), each to the
 * truthful default the package itself names:
 *   D1  Deep Intelligence tag: NEUTRAL edge (#1d3a5a), no tier violet — no tier
 *       exists, and FORBIDDEN_TIER_VIOLET stays absent from this surface.
 *   D2  The Overview | Saved | Following | Recent tablist is replaced by the
 *       rail / drawer. Sub-views stay CLIENT state (never URL state): the
 *       sign-in return validator accepts exactly /my-intelligence.
 *   D4  No new route. Saved, New since, For you, history and Specialists are
 *       in-workspace views; /history keeps its own full page.
 *   D5  Politics / Economy link their preview routes and are tagged Preview.
 *   D6  Conflict and Security are one tile → /conflict.
 *   D7  Plan & usage is a status line with no destination.
 *   D8  "Selected stories" enters selection mode; no briefings library.
 *   D11 Rail pin is PAGE state only. This surface keeps no browser storage (a
 *       standing, asserted rule), so the pin is not persisted.
 *   D14/D15 Elections: the release binds no country to the Elections preview
 *       and its live route is gated closed, so NO country is presented as
 *       supported. The selector offers followed countries as context and each
 *       shows the truthful no-governed-data notice.
 *   D17 The Specialist module lists both entries as navigation only: no
 *       counts, scores, live states or invented activity.
 */

export type WorkspaceView = 'today' | 'forYou' | 'newSince' | 'saved' | 'history' | 'specialists';

export type RailGroupId = 'mine' | 'intelligence' | 'specialists' | 'deep' | 'account';

/** INTERACTIONS.md — every rail action and what it does. None of them spends. */
export type RailAction =
  | { readonly kind: 'view'; readonly view: WorkspaceView }
  | { readonly kind: 'following' }
  | { readonly kind: 'select' }
  | { readonly kind: 'href'; readonly href: string }
  | { readonly kind: 'none' };

/**
 * The intelligence domains (IA group INTELLIGENCE; the Explore tiles). A
 * `preview` domain has only a *-visual-preview route in this release and is
 * labelled Preview wherever it appears (D5).
 */
export const INTELLIGENCE_DOMAINS = [
  { id: 'map', href: '/map', preview: false },
  { id: 'politics', href: '/politics-visual-preview', preview: true },
  { id: 'economy', href: '/economy-visual-preview', preview: true },
  { id: 'market', href: '/market', preview: false },
  { id: 'energy', href: '/energy', preview: false },
  { id: 'conflict', href: '/conflict', preview: false },
  { id: 'humanitarian', href: '/humanitarian', preview: false },
] as const;

export type DomainId = (typeof INTELLIGENCE_DOMAINS)[number]['id'];

/**
 * SPECIALISTS. Elections is a PREVIEW entry bound to no country (the route
 * `/election-visual-preview` itself states "No subject bound"); Imihigo opens
 * its live route.
 */
export const ELECTIONS_PREVIEW_HREF = '/election-visual-preview';
export const IMIHIGO_HREF = '/imihigo';

/**
 * DEEP INTELLIGENCE. Analysis Workspace opens Ask AI idle — never /search?q=,
 * which auto-runs analysis (the inherited N3 boundary: a rail click must not
 * spend). Deep Intelligence has no destination in Beta.
 */
export const ANALYSIS_WORKSPACE_HREF = '/ask';
export const ACCOUNT_SETTINGS_HREF = '/account/settings';
export const SEARCH_HREF = '/search';

/**
 * SPEC.md density rules: no dashboard section shows more than 4 rows on
 * desktop or 3 on phone before View all; For you shows 6 (3 on phone); the
 * dashboard never renders a full collection.
 */
export const DASHBOARD_ROWS = { desktop: 4, phone: 3 } as const;
export const FOR_YOU_PREVIEW = { desktop: 6, phone: 3 } as const;
export const COLLECTION_PREVIEW = 3;
/** The bounded destinations: never an unbounded list in the DOM. */
export const DESTINATION_LIMIT = 50;

/** SPEC.md rail geometry. */
export const RAIL = { collapsedPx: 64, expandedPx: 280, contextPx: 360 } as const;

/** Rows to show for a section at a tier, never more than the bound. */
export function previewCount(available: number, bound: number): number {
  return Math.max(0, Math.min(available, bound));
}

/**
 * The countries with governed election data, as the release knows them. There
 * is no governed availability source in this release (D15: "the real list must
 * come from governed election data availability, not a hard-coded list"), so
 * the list is empty — which is the truth, not a placeholder.
 */
export const GOVERNED_ELECTION_COUNTRIES: readonly string[] = [];

/**
 * Elections availability for one country: the live route must be allowed to
 * open AND the country must be in the governed list. Both are false today, so
 * every country shows the truthful unsupported notice.
 */
export function electionsSupportedFor(
  iso3: string,
  liveRouteMayOpen: boolean,
  governed: readonly string[] = GOVERNED_ELECTION_COUNTRIES,
): boolean {
  return liveRouteMayOpen && governed.includes(iso3);
}

/** The groups a collapsed rail opens onto, in IA order. */
export const RAIL_GROUP_ORDER: readonly RailGroupId[] = ['mine', 'intelligence', 'specialists', 'deep', 'account'];

/** Groups start collapsed except My Intelligence (IA_BOARD.md). */
export function initialOpenGroups(): ReadonlySet<RailGroupId> {
  return new Set<RailGroupId>(['mine']);
}
