import { ASK_NAV_LIVE_ROUTES } from './askNavModel';

/**
 * THE STANDALONE ASK NAVIGATION MATRIX — the Product Owner correction's ruled set
 * as data rather than a table in a report, so a spec asserts it and it cannot
 * drift from the model.
 *
 * SUPERSESSION. The R2 §16 matrix carried Today, World Map and My Intelligence.
 * The ASK GLOBALNEWSAI STANDALONE BETA correction removes all three from the Ask
 * navigation, so they are gone from this matrix too. Their routes still exist and
 * still work; they are simply not Ask Beta destinations.
 *
 * `route: null` means the destination is NOT a static path — Language is an
 * in-place control and Sign in resolves `accountSignInUrl(returnPath)` at render
 * time. Naming a static path for either would fabricate a route.
 *
 * LIVENESS IS NOT A FIELD HERE. It was, and that was a second place to edit when
 * Claude H's routes land — CTO requires a DETERMINISTIC ONE-CONTRACT activation,
 * so the matrix now DERIVES liveness from `ASK_NAV_LIVE_ROUTES`, the single
 * switch the renderer also reads. Adding one string to that one array is the
 * whole activation; nothing in this file changes.
 *
 * Recent and Saved are ruled INTO the signed-in navigation but owned by Claude H
 * and are not present on this branch, so they are suppressed rather than
 * rendered dead: the IA stays complete and reviewable while nothing 404s.
 *
 * Every row is 0 AI and 0 provider. That is not a claim about the destination's
 * own page — it is the cost of the NAVIGATION: reaching the row, reading it and
 * activating it issues no analysis request. The one network call the shell makes
 * at all is the single session read described in AskNavShell.
 */
export interface MatrixRow {
  readonly destination: string;
  readonly signedOut: 'visible' | 'hidden';
  readonly signedIn: 'visible' | 'hidden';
  readonly route: string | null;
  readonly aiCost: '0';
  readonly providerCost: '0';
}

/**
 * Is this row's destination present in the application today? Derived, never
 * stored — see the note above. A row with no static route (Language, Sign in,
 * Sign out) is always live: its destination is resolved at render time.
 */
export function matrixRowIsLive(row: MatrixRow): boolean {
  return row.route === null || ASK_NAV_LIVE_ROUTES.includes(row.route);
}

export const ASK_NAV_MATRIX: readonly MatrixRow[] = [
  {
    destination: 'New question',
    signedOut: 'visible',
    signedIn: 'visible',
    route: '/ask',
    aiCost: '0',
    providerCost: '0',
  },
  {
    destination: 'Recent',
    signedOut: 'hidden',
    signedIn: 'visible',
    route: '/ask/recent',
    aiCost: '0',
    providerCost: '0',
  },
  {
    destination: 'Saved',
    signedOut: 'hidden',
    signedIn: 'visible',
    route: '/saved',
    aiCost: '0',
    providerCost: '0',
  },
  {
    destination: 'Help & feedback',
    signedOut: 'visible',
    signedIn: 'visible',
    route: '/support',
    aiCost: '0',
    providerCost: '0',
  },
  {
    destination: 'Settings',
    signedOut: 'hidden',
    signedIn: 'visible',
    route: '/account/settings',
    aiCost: '0',
    providerCost: '0',
  },
  {
    destination: 'Language',
    signedOut: 'visible',
    signedIn: 'visible',
    route: null,
    aiCost: '0',
    providerCost: '0',
  },
  /* Dynamic, not static: accountSignInUrl(returnPath). /login does not exist. */
  {
    destination: 'Sign in',
    signedOut: 'visible',
    signedIn: 'hidden',
    route: null,
    aiCost: '0',
    providerCost: '0',
  },
  {
    destination: 'Sign out',
    signedOut: 'hidden',
    signedIn: 'visible',
    route: null,
    aiCost: '0',
    providerCost: '0',
  },
];
