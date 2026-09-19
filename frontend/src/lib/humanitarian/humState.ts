/**
 * PART X · HUMANITARIAN — 17 ACCOUNTED CANDIDATES ARE NOT 17 PAGES.
 *
 * R18 says it in its own words: "A coding agent must not read 17 accounted states as
 * 17 pages or components. The ten drawn states share one frame architecture; the
 * seven deltas are state changes inside frames that already exist."
 *
 * So the ten resolve, by R12's routing table, into FOUR FRAME STATES and SIX DRAWER
 * KINDS over ONE frame:
 *
 *   H-01 ENTRY      H-02 SELECTED     H-06 GAP        H-08 QUIET      ← frame states
 *   H-03 POPULATION_NEED   H-04 DISPLACEMENT_ACCESS   H-05 EVIDENCE
 *   H-07 WATCH             H-09 TIMELINE             H-10 ANALYSIS   ← drawer kinds
 *
 * and the seven deltas D-01…D-07 introduce NO new component — R18's own "changed
 * component" column names an existing one in every row.
 *
 * A DRAWER IS A SLOT, NOT A PAGE. R12: "drawers replace and never stack; one
 * sustained panel at a time". That is why the count is a slot and a union rather
 * than six routes, and it is asserted rather than assumed.
 */

/** H-01 · H-02 · H-06 · H-08. The frame is one component; this is its state. */
export type HumFrameState = 'ENTRY' | 'SELECTED' | 'GAP' | 'QUIET';

/** H-03 · H-04 · H-05 · H-07 · H-09 · H-10. One shell, six contents. */
export type HumDrawerKind =
  | 'POPULATION_NEED'
  | 'DISPLACEMENT_ACCESS'
  | 'EVIDENCE'
  | 'WATCH'
  | 'TIMELINE'
  | 'ANALYSIS';

export const HUM_FRAME_STATES: readonly HumFrameState[] = ['ENTRY', 'SELECTED', 'GAP', 'QUIET'];
export const HUM_DRAWER_KINDS: readonly HumDrawerKind[] = [
  'POPULATION_NEED', 'DISPLACEMENT_ACCESS', 'EVIDENCE', 'WATCH', 'TIMELINE', 'ANALYSIS',
];

/** R12's detents. One open at a time; the union has no "two drawers" shape. */
export type HumDetent = 'PEEK' | 'HALF' | 'FULL';

/** R12 assigns each drawer its phone detent. Read from the contract, not chosen here. */
export const HUM_DRAWER_DETENT: Readonly<Record<HumDrawerKind, HumDetent>> = {
  POPULATION_NEED: 'FULL',
  DISPLACEMENT_ACCESS: 'HALF',
  EVIDENCE: 'HALF',
  WATCH: 'HALF',
  TIMELINE: 'FULL',
  ANALYSIS: 'FULL',
};

/**
 * The whole view state. `drawer` is a SINGLE optional value — a stack would need an
 * array, and there is deliberately no array here. This is R12's replacement rule
 * expressed as a type rather than as discipline.
 */
export interface HumViewState {
  readonly frame: HumFrameState;
  readonly drawer: HumDrawerKind | null;
}

export const initialViewState = (frame: HumFrameState = 'ENTRY'): HumViewState =>
  ({ frame, drawer: null });

export type HumViewAction =
  | { readonly kind: 'SELECT_FRAME'; readonly frame: HumFrameState }
  | { readonly kind: 'OPEN_DRAWER'; readonly drawer: HumDrawerKind }
  | { readonly kind: 'CLOSE_DRAWER' };

/**
 * OPEN_DRAWER on an already-open drawer REPLACES it. There is no push, because there
 * is nothing to push onto.
 */
export function humViewReducer(state: HumViewState, action: HumViewAction): HumViewState {
  switch (action.kind) {
    case 'SELECT_FRAME':
      /* Changing frame closes the drawer: a drawer belongs to the frame beneath it. */
      return { frame: action.frame, drawer: null };
    case 'OPEN_DRAWER':
      return { frame: state.frame, drawer: action.drawer };
    case 'CLOSE_DRAWER':
      return { frame: state.frame, drawer: null };
  }
}

/**
 * The accounting R18 asks a reader to be able to check.
 * Ten drawn states = four frame states + six drawer kinds. Asserted by test.
 */
export const DRAWN_BETA_STATES = 10 as const;
export const INHERITED_DELTAS = 7 as const;
export const ACCOUNTED_CANDIDATES = 17 as const;

/** The mapping, so the claim is inspectable rather than rhetorical. */
export const DRAWN_STATE_MAP: Readonly<Record<string, { readonly as: 'FRAME' | 'DRAWER'; readonly value: string }>> = {
  'H-01': { as: 'FRAME', value: 'ENTRY' },
  'H-02': { as: 'FRAME', value: 'SELECTED' },
  'H-03': { as: 'DRAWER', value: 'POPULATION_NEED' },
  'H-04': { as: 'DRAWER', value: 'DISPLACEMENT_ACCESS' },
  'H-05': { as: 'DRAWER', value: 'EVIDENCE' },
  'H-06': { as: 'FRAME', value: 'GAP' },
  'H-07': { as: 'DRAWER', value: 'WATCH' },
  'H-08': { as: 'FRAME', value: 'QUIET' },
  'H-09': { as: 'DRAWER', value: 'TIMELINE' },
  'H-10': { as: 'DRAWER', value: 'ANALYSIS' },
};
