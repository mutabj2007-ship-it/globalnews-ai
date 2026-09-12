/**
 * F1.b — the six Admin data states, as one type with one renderer
 * behind it (`AdminStateBlock`), so no screen can invent its own empty
 * state.
 *
 *   real             a value the backend actually produced
 *   zero             a TRUE zero — rendered as `0` with its window label
 *   loading          skeleton that preserves layout height
 *   unavailable      no source exists — renders "No source" plus its tag
 *   error            reason + correlation id + retry
 *   notImplemented   a planned surface, visible and explicitly inert
 *
 * Two rules the approved package states and this codebase enforces:
 *   - a missing probe renders UNKNOWN, never HEALTHY
 *   - an unpopulated counter renders UNKNOWN, never 0
 */
export const ADMIN_DATA_STATES = [
  'real',
  'zero',
  'loading',
  'unavailable',
  'error',
  'notImplemented',
] as const;

export type AdminDataState = (typeof ADMIN_DATA_STATES)[number];

export interface AdminValue<T> {
  state: AdminDataState;
  /** Present only when state is 'real' or 'zero'. Never synthesised. */
  value?: T;
  /** ISO-8601 timestamp of the reading, when the backend supplied one. */
  asOf?: string;
  /** Correlation id, present only on 'error'. */
  correlationId?: string;
}

export const NOT_IMPLEMENTED: AdminValue<never> = Object.freeze({ state: 'notImplemented' });
export const UNAVAILABLE: AdminValue<never> = Object.freeze({ state: 'unavailable' });
export const LOADING: AdminValue<never> = Object.freeze({ state: 'loading' });

/**
 * The only sanctioned way to turn a backend number into a rendered
 * value. `undefined` and `null` become `unavailable` — NOT zero. This is
 * the function that stops an unpopulated provider counter from being
 * displayed as a measurement of nothing.
 */
export function fromOptionalNumber(
  value: number | undefined | null,
  asOf?: string,
): AdminValue<number> {
  if (value === undefined || value === null) return { state: 'unavailable' };
  if (value === 0) return { state: 'zero', value: 0, asOf };
  return { state: 'real', value, asOf };
}

export function fromOptionalString(
  value: string | undefined | null,
  asOf?: string,
): AdminValue<string> {
  if (value === undefined || value === null || value === '') return { state: 'unavailable' };
  return { state: 'real', value, asOf };
}

export function isPresented(state: AdminDataState): boolean {
  return state === 'real' || state === 'zero';
}

/**
 * ADMIN-03 — the state of ONE SECTION of a multi-section response.
 *
 * The analytics endpoints return several independently-read sections in
 * one payload, and a section is `null` when ITS read failed. That null
 * carries information the six states already have a name for, and it is
 * NOT the same as the request failing: the request succeeded, the
 * database did not answer for that part.
 *
 * So a null section resolves to `error`, never to `unavailable` and
 * never to a zero. `unavailable` means "no source exists", which is a
 * permanent property of the platform and is exactly what an operator
 * must not be told when a query simply failed. That distinction is the
 * A-1 finding, and this is the one function that keeps it.
 */
export function sectionState(resourceState: AdminDataState, section: unknown): AdminDataState {
  if (resourceState !== 'real') return resourceState;
  return section === null || section === undefined ? 'error' : 'real';
}

/**
 * A number from inside a section, carrying the section's state.
 *
 * Composes `sectionState` with `fromOptionalNumber`, so a genuine zero
 * inside a healthy section still renders as a measured zero while a
 * failed section renders as an error — two outcomes that a single
 * `?? 0` would have collapsed into the same digit.
 */
export function sectionNumber(
  resourceState: AdminDataState,
  section: unknown,
  value: number | undefined | null,
): AdminValue<number> {
  const state = sectionState(resourceState, section);
  if (state !== 'real') return { state };
  return fromOptionalNumber(value);
}
