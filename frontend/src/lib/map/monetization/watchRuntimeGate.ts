/**
 * WATCH RUNTIME GATE — one constant, one reason, one line to reverse.
 *
 * MEASURED, NOT ASSUMED. The Spatial shell renders a Watch composer, a
 * watchboard and a Watch block on the intelligence rail. There is no Watch
 * runtime anywhere in this programme to serve them:
 *
 *   candidate  backend/src/modules/watch          does not exist
 *   canonical  app.module.ts, "WatchModule"        0 occurrences
 *
 * The shell was already honest about this in one sense — `watchCapability`
 * resolves `canActivate` to the literal `false`, so the surfaces render preview
 * and sign-in states rather than pretending to arm anything. But a composer a
 * reader can open, fill in and submit against nothing is still an activation
 * affordance, and the Product Owner's ruling is explicit: "Gate it OFF from
 * active Alpha map UX ... preferred Alpha behavior is hidden until runtime
 * activation."
 *
 * SO THIS HIDES, AND DELETES NOTHING. `WatchComposer`, `Watchboard`, the CTA
 * ladder, `watchModel`, the rail's Watch block and every contract behind them
 * are untouched and still compile, still tested. Only their mount sites consult
 * this flag. When `WatchModule` is registered and serving, this becomes `true`
 * and the surfaces return exactly as they were.
 *
 * IT IS A CONSTANT, NOT AN ENV VAR, ON PURPOSE. An environment variable would
 * imply an operator may turn Watch on, and turning this on without a backend
 * would produce precisely the fake activation the ruling forbids. The gate
 * moves when the runtime does, in source, under review.
 *
 * FOLLOW IS NOT AFFECTED AND MUST NEVER BE FOLDED INTO THIS. Follow is real,
 * persistent and authenticated (`FollowsModule` is registered; three routes
 * serve it). Nothing below touches `follow`, and Follow state is never
 * relabelled as Watch.
 */
export const WATCH_RUNTIME_ACTIVE = false;
