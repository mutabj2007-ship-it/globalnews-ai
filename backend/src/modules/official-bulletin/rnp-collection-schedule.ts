/*
  CTO R158 §2 — ONE source-wide request budget for police.gov.rw, across every environment that collects.

  Alpha and Production have separate databases, so a database lease alone would let each of them read the listing
  once per 30 minutes — doubling the requests to the source. The budget is therefore split on the WALL CLOCK, which
  every environment shares without talking to the others:

  · Each collecting environment declares `RNP_COLLECTOR_SLOT=k/N` (N = how many environments collect, k = its own
    0-based slot). There is no default: an absent or malformed slot stops the lane, so two environments can never
    both fall back to the same slot by accident.
  · Time is cut into slots of 35 minutes; a cycle is N slots. Slot k may read only inside the first 5 minutes of its
    own slot. Any two reads — same environment or not — are therefore at least 35 − 5 = 30 minutes apart, the
    E1 ADDENDUM-02 §3 ceiling, whatever N is.
  · Within one environment, one read per window is enforced by the database lease (rnp-poll-lease.ts), which
    covers replicas, restarts and overlapping deployments sharing that database.
*/
export const RNP_SLOT_MS = 35 * 60 * 1000;
export const RNP_WINDOW_MS = 5 * 60 * 1000;
export const RNP_MAX_COLLECTORS = 4;

export interface RnpCollectorSlot {
  readonly index: number;
  readonly of: number;
}

/** `k/N` → the slot, or null when it is absent or malformed (the lane then stops). */
export function parseRnpCollectorSlot(raw: string | undefined): RnpCollectorSlot | null {
  const m = /^\s*(\d)\s*\/\s*(\d)\s*$/.exec(raw ?? '');
  if (m === null) return null;
  const index = Number(m[1]);
  const of = Number(m[2]);
  if (of < 1 || of > RNP_MAX_COLLECTORS || index >= of) return null;
  return { index, of };
}

export interface RnpWindow {
  /** Epoch ms the window opens; also the lease's identity for that window. */
  readonly start: number;
  readonly end: number;
}

/** The window this slot is inside at `t`, or null when `t` is outside every window of the slot. */
export function rnpWindowAt(slot: RnpCollectorSlot, t: number): RnpWindow | null {
  const cycle = RNP_SLOT_MS * slot.of;
  const start = Math.floor(t / cycle) * cycle + slot.index * RNP_SLOT_MS;
  return t >= start && t < start + RNP_WINDOW_MS ? { start, end: start + RNP_WINDOW_MS } : null;
}

/** The first window of this slot that opens at or after `t`. */
export function nextRnpWindow(slot: RnpCollectorSlot, t: number): RnpWindow {
  const cycle = RNP_SLOT_MS * slot.of;
  let start = Math.floor(t / cycle) * cycle + slot.index * RNP_SLOT_MS;
  if (start < t) start += cycle;
  return { start, end: start + RNP_WINDOW_MS };
}
