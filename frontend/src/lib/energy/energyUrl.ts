/**
 * ════════════════════════════════════════════════════════════════════════════
 * H01 — ONE ROUTE FAMILY, WITH SUBSTRATE · SUBJECT · WINDOW AS URL STATE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Design's instruction, carried verbatim:
 *
 *   "implement one route family (`/energy`) with substrate, subject and window
 *    as URL-encoded state — not /energy-a, /energy-b, /energy-c, /energy-d."
 *   "The state count is not the route count."
 *
 * This module is the whole of that state, and it follows the discipline `/map`
 * already proves and that `c2RuntimeDefects` pins: PURE CODECS over
 * `URLSearchParams`, EXACTLY ONE WRITER, and DEFAULTS ABSENT FROM THE QUERY —
 * "'no parameter' and 'the default' are the same thing in both directions."
 *
 * ── WHAT IS DELIBERATELY NOT IN THE URL ───────────────────────────────────
 *
 * The LENS and the ASK overlay are not here, and their absence is the design's
 * own ruling rather than an omission:
 *
 *   R07 / state board: "D is NOT A ROUTE. It is a transient full-surface
 *   overlay over the preserved shell state, with explicit ← subject return."
 *   "Closing restores the substrate, selection, window and Watch state beneath
 *   it."
 *
 * A transient surface that survived a reload would not be transient, and a
 * shareable lens URL would be a fifth route wearing an overlay's clothes. The
 * SHEET STAGE is excluded for the same reason — it is a gesture position, not a
 * statement about the world.
 *
 * ── EVERY INPUT IS UNTRUSTED ──────────────────────────────────────────────
 *
 * These values arrive from an address bar a person can type into. No decoder
 * throws; each returns the default for anything it cannot read, and the default
 * is always the honest one.
 */

import {
  ENERGY_DEFAULT_SUBSTRATE,
  ENERGY_DEFAULT_WINDOW,
  ENERGY_SUBSTRATES,
  ENERGY_WINDOWS,
  type EnergySubstrate,
  type EnergyWindow,
} from '@/lib/energy/energyFrame';

export const SUBSTRATE_QUERY_KEY = 'substrate';
export const SUBJECT_QUERY_KEY = 'subject';
export const WINDOW_QUERY_KEY = 'window';
export const FRAME_QUERY_KEY = 'frame';

/**
 * WHICH DATA SET FEEDS THE ONE FRAME — not a second route and not a second
 * implementation.
 *
 * `governed` (the default, and therefore ABSENT from the query) renders what
 * the platform actually holds today: 0 sources READY, four unlanded imports,
 * and consequently every zone in its correct absence state.
 *
 * `design-fixture` renders the frozen design's OWN fixtures — carried from the
 * authority archive, never authored here — so the populated geometry of every
 * zone can be compared against the frozen shell. The design labels that mode
 * itself, permanently, with `DESIGN FIXTURE DATA`, and Part XI states the rule
 * this obeys: "Every value in this package is a DESIGN FIXTURE, not an
 * intelligence finding."
 *
 * Both feed the SAME components. Contract item 11 permits "a preview route only
 * if you need one — the route can be `/energy` behind a flag instead"; this is
 * that flag, expressed in the state mechanism the route already has.
 */
export type EnergyFrameSource = 'governed' | 'design-fixture';
export const ENERGY_DEFAULT_FRAME_SOURCE: EnergyFrameSource = 'governed';

export interface EnergyUrlState {
  readonly substrate: EnergySubstrate;
  readonly subject: string | null;
  readonly window: EnergyWindow;
  readonly frame: EnergyFrameSource;
}

export const ENERGY_DEFAULT_URL_STATE: EnergyUrlState = {
  substrate: ENERGY_DEFAULT_SUBSTRATE,
  subject: null,
  window: ENERGY_DEFAULT_WINDOW,
  frame: ENERGY_DEFAULT_FRAME_SOURCE,
};

/* ── DECODERS ─────────────────────────────────────────────────────────────
   Membership is read from the frame contract's own lists rather than re-listed
   here, so the type and the runtime cannot drift. */

export function decodeSubstrate(raw: string | null | undefined): EnergySubstrate {
  if (typeof raw !== 'string') return ENERGY_DEFAULT_SUBSTRATE;
  const lower = raw.toLowerCase();
  return (ENERGY_SUBSTRATES as readonly string[]).includes(lower)
    ? (lower as EnergySubstrate)
    : ENERGY_DEFAULT_SUBSTRATE;
}

export function decodeWindow(raw: string | null | undefined): EnergyWindow {
  if (typeof raw !== 'string') return ENERGY_DEFAULT_WINDOW;
  const lower = raw.toLowerCase();
  return (ENERGY_WINDOWS as readonly string[]).includes(lower)
    ? (lower as EnergyWindow)
    : ENERGY_DEFAULT_WINDOW;
}

/**
 * A subject id is an OPAQUE KEY, not a description. It is bounded, restricted
 * to an id alphabet, and never interpolated into anything but a lookup — a
 * subject the frame does not hold resolves to no selection, which is the same
 * thing as arriving without one.
 */
export function decodeSubjectId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return null;
  return /^[a-z0-9][a-z0-9_-]*$/i.test(raw) ? raw : null;
}

export function decodeFrameSource(raw: string | null | undefined): EnergyFrameSource {
  return raw === 'design-fixture' ? 'design-fixture' : ENERGY_DEFAULT_FRAME_SOURCE;
}

export function energyStateFromSearchParams(
  params: URLSearchParams | null | undefined,
): EnergyUrlState {
  return {
    substrate: decodeSubstrate(params?.get(SUBSTRATE_QUERY_KEY)),
    subject: decodeSubjectId(params?.get(SUBJECT_QUERY_KEY)),
    window: decodeWindow(params?.get(WINDOW_QUERY_KEY)),
    frame: decodeFrameSource(params?.get(FRAME_QUERY_KEY)),
  };
}

/* ── THE SINGLE WRITER ────────────────────────────────────────────────────
   One function composes the whole query. It is pure: it calls no router and
   touches no history. Two writers racing is the original H-C2 defect and this
   module does not reintroduce it. */

export function searchParamsWithEnergyState(
  existing: URLSearchParams | null | undefined,
  state: EnergyUrlState,
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? '');

  /*
    A DEFAULT DELETES ITS KEY. It never writes an empty value, which would read
    as a deliberate choice of nothing, and it never writes the default spelled
    out, which would make a shared link brittle against a later default change.
  */
  const put = (key: string, value: string | null, isDefault: boolean): void => {
    if (value === null || isDefault) params.delete(key);
    else params.set(key, value);
  };

  put(SUBSTRATE_QUERY_KEY, state.substrate, state.substrate === ENERGY_DEFAULT_SUBSTRATE);
  put(SUBJECT_QUERY_KEY, state.subject, state.subject === null);
  put(WINDOW_QUERY_KEY, state.window, state.window === ENERGY_DEFAULT_WINDOW);
  put(FRAME_QUERY_KEY, state.frame, state.frame === ENERGY_DEFAULT_FRAME_SOURCE);

  return params;
}

/** The href for a given shell state. `/energy` alone is the default state, by construction. */
export function energyHref(state: EnergyUrlState): string {
  const query = searchParamsWithEnergyState(null, state).toString();
  return query.length > 0 ? `/energy?${query}` : '/energy';
}
