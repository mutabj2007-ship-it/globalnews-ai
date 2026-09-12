/**
 * R1/T2 — the return-visit write interval.
 *
 * WHY THIS VALUE, STATED HONESTLY. The accepted Return/Today architecture
 * gate specifies "N ≈ 30". I searched this repository for an existing
 * idle-or-visit window to inherit and found none: session lifetime is
 * ABSOLUTE rather than idle-based, and the throttler's 60-second windows
 * are abuse controls, not visit windows. So thirty minutes is the CTO's
 * figure adopted as specified, not a number derived from the codebase,
 * and this comment says so rather than implying an evidence base that
 * does not exist.
 *
 * WHAT IT ACTUALLY CONTROLS. `UsersService.recordSeen()` writes only when
 * the stored value is NULL or older than this interval. A user who
 * refreshes the return surface twenty times in an hour therefore produces
 * AT MOST TWO writes, and a page refresh produces none. That property is
 * asserted directly in `return-state.spec.ts` — it is the whole point of
 * the constant, not a side effect of it.
 *
 * ONE DECLARATION, so the value cannot drift between the service and the
 * test that proves the service honours it.
 */
export const RETURN_VISIT_MIN_INTERVAL_MS = 30 * 60 * 1000;
