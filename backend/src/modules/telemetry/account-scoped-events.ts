import type { ProductEventName } from '../../generated/prisma/enums';

/**
 * R3/T7 — THE ONLY EVENTS THAT MAY CARRY A userId.
 *
 * The accepted architecture gate is explicit: "Link to an account only
 * where the event is account-scoped (follow_created, return_visit).
 * Everything else anonymous."
 *
 * That rule is stricter than "attach the session if one happens to be
 * present", and the difference matters. Attaching an account to every
 * event a signed-in person triggers would build a per-account
 * behavioural profile across every surface of the platform — what they
 * read, which countries they filter to, when they open evidence. This
 * list makes that impossible rather than merely discouraged.
 *
 * The three below are account-scoped because the account IS the subject:
 * a follow belongs to somebody, and a return visit is meaningless
 * without knowing whose. Everything else is stored anonymously EVEN FOR
 * A SIGNED-IN USER, and `TelemetryService.recordProductEvent` discards
 * the session rather than storing it.
 *
 * ONE DECLARATION, so the rule cannot drift between the ingest path, the
 * emitters and the spec that proves it holds.
 */
export const ACCOUNT_SCOPED_EVENTS = ['follow_created', 'follow_removed', 'return_visit'] as const;

export type AccountScopedEvent = (typeof ACCOUNT_SCOPED_EVENTS)[number];

export function isAccountScoped(name: ProductEventName): name is AccountScopedEvent {
  return (ACCOUNT_SCOPED_EVENTS as readonly string[]).includes(name);
}
