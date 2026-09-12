/**
 * S4 — the user-facing Support API paths, in one place.
 *
 * Mirrors `lib/admin/adminRoutes.ts`. No component spells a path itself, so
 * there is exactly one file to check against the backend controller and
 * exactly one file a spec has to assert against.
 *
 * THESE ARE THE USER ROUTES, NOT THE ADMIN ONES. `/support/*` is scoped to the
 * caller by the session on every read; `/admin/support/*` is a different
 * surface with a different capability and a different response shape. Nothing
 * in this folder may reach for the admin paths, and a spec enforces it.
 *
 * There is deliberately NO status path here. No user route accepts a status:
 * replying to a ticket sets AWAITING_ADMIN server-side, and reopening a
 * resolved ticket is a consequence of replying, never a field anybody submits.
 */
export const SUPPORT_API = {
  /** GET the caller's own tickets; POST to open a new one. */
  tickets: '/support/tickets',

  /** GET one of the caller's own tickets, with the messages they may read. */
  ticket: (reference: string): string => `/support/tickets/${encodeURIComponent(reference)}`,

  /** POST the owner's reply. */
  messages: (reference: string): string =>
    `/support/tickets/${encodeURIComponent(reference)}/messages`,
} as const;

/**
 * The input bounds the backend DTO enforces, mirrored so the form can refuse
 * a submission the server would only reject anyway.
 *
 * THE SERVER REMAINS THE AUTHORITY. These are a courtesy that saves a round
 * trip and gives a better message than a validation-pipe array; they are not a
 * validation layer. `supportSurface.spec.ts` reads the backend DTO source and
 * asserts these numbers still match it, so the two cannot drift apart in
 * silence.
 *
 * Lengths are measured on the TRIMMED value, because the DTO's @Transform
 * trims before @MinLength runs — a whitespace-only message is empty to the
 * server, and the form must agree.
 */
export const SUPPORT_INPUT_BOUNDS = {
  subject: { min: 3, max: 200 },
  message: { min: 10, max: 5000 },
  reply: { min: 2, max: 5000 },
} as const;
