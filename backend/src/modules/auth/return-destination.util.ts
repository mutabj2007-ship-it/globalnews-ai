/**
 * M-ALPHA-AUTH — the validated return destination.
 *
 * THE DEFECT THIS EXISTS FOR. Before this module the OAuth callback ended with
 * `response.redirect(this.frontendOrigin())` unconditionally, so a user who
 * pressed Sign In on /support, /history, /admin or a Watch control was returned
 * to the homepage with their destination discarded. There was no returnTo
 * concept anywhere in backend, frontend or shared — this is a new capability,
 * not a repaired one.
 *
 * WHY THE VALUE IS TREATED AS HOSTILE. It arrives as a query parameter on
 * GET /auth/google, so it is attacker-authored by definition. A redirect target
 * taken from a request is the classic open-redirect primitive: it makes this
 * application's own domain into a credible launchpad for a phishing hop, and it
 * is more dangerous here than on an ordinary page because the user arrives at it
 * having JUST completed a real Google sign-in and is primed to trust whatever
 * follows.
 *
 * THREE INDEPENDENT GATES, each sufficient on its own:
 *
 *   1. ENTRY   — this module, at /auth/google. Anything that is not a known
 *                relative application path becomes null, which the caller
 *                renders as the existing homepage default.
 *   2. TRANSIT — the surviving value is carried inside the HMAC-SHA256 signed,
 *                httpOnly OAuth flow-state cookie (oauth-flow-state.ts). It is
 *                never placed in the `state` query parameter, never in a URL,
 *                and never in a cookie readable by JavaScript, so it cannot be
 *                edited between the two hops.
 *   3. EXIT    — this module again at the callback, plus a same-origin
 *                assertion against the resolved absolute URL. Even a value that
 *                somehow reached the callback unvalidated cannot leave this
 *                origin.
 *
 * REVALIDATION AT EXIT IS NOT REDUNDANT. It is the gate that survives a future
 * mistake: if someone later adds a second way to populate the flow state, or
 * relaxes the HMAC, or widens the entry allowlist carelessly, the exit gate
 * still holds. Defence that only works while every other layer is correct is
 * not defence.
 *
 * ALLOWLIST, NOT DENYLIST, AND DELIBERATELY SMALL. Only routes that actually
 * exist in frontend/src/app are permitted. A denylist of dangerous shapes would
 * have to anticipate every encoding trick; an allowlist only has to know this
 * product's own pages.
 */

/**
 * Bound on the accepted value. Every allowlisted destination is far shorter than
 * this; the limit exists so a pathological input is rejected on length before
 * any further work is done on it, not because a legitimate path could approach
 * it.
 */
const MAX_RETURN_DESTINATION_LENGTH = 128;

/**
 * Exact application routes a sign-in may return to.
 *
 * Every entry corresponds to a real `page.tsx` in frontend/src/app. Routes that
 * exist but have no sign-in entry point (/privacy, /terms, /source-policy) are
 * deliberately absent: nothing in the product asks to return to them, and an
 * allowlist should contain what is used rather than what is possible.
 */
const ALLOWED_EXACT_DESTINATIONS: ReadonlySet<string> = new Set([
  '/',
  '/history',
  '/support',
  '/map',
  '/search',
  '/workspace',
]);

/**
 * The one prefix family, and why it is a family rather than an exact list.
 *
 * The admin shell is roughly twenty pages (frontend/src/app/admin/**), and an
 * administrator who signs in from /admin/support should land back on
 * /admin/support rather than the admin root. Enumerating all twenty here would
 * rot the moment a page is added or renamed.
 *
 * The pattern is deliberately narrow: lowercase letters, digits and hyphens
 * only, one or more bounded segments, anchored at both ends. It cannot express a
 * dot, a doubled slash, an encoded character, or anything outside this
 * application's own route vocabulary, so widening the family cannot widen the
 * threat surface.
 *
 * RBAC IS UNAFFECTED. Being allowed to RETURN to /admin is not being allowed to
 * USE it. AdminGuard runs on every admin request regardless of how the browser
 * arrived, and an ordinary user returned to /admin sees exactly the 403 they
 * would have seen anyway.
 */
const ALLOWED_ADMIN_DESTINATION = /^\/admin(\/[a-z0-9-]+)*$/;

/**
 * Characters that end validation immediately, before any structural check.
 *
 *   %   percent-encoding is rejected OUTRIGHT rather than decoded. Decoding
 *       invites the whole "validate then decode" class of bugs: `/%2f%2fevil`
 *       passes a naive leading-doubled-slash check and becomes protocol-relative
 *       once a browser normalizes it. No allowlisted route contains a percent
 *       sign, so refusing the character costs nothing and removes the class.
 *   \   browsers treat a backslash as a path separator in several positions, so
 *       `/\evil.example` is protocol-relative in practice.
 *   :   kills any scheme, including `javascript:` and `data:`.
 *   @   kills the userinfo trick, `/evil.example@real.example`.
 *   ? # no query string and no fragment are accepted at all. The contract is
 *       "return to the originating PAGE": a Follow attempt returns to its
 *       country page and the user presses Follow again (CTO requirement 9), so
 *       no state needs to survive the redirect and none is allowed to.
 */
const FORBIDDEN_CHARACTERS = /[%\\:@?#]/;

/**
 * C0 controls plus DEL — which is what makes CR/LF response splitting
 * unreachable.
 *
 * Written as a character-code scan rather than a regular expression ON PURPOSE:
 * a regex literal containing raw control characters is invisible in a diff, in a
 * code review and in most editors, and a reviewer cannot confirm by reading it
 * that the range is the one intended. This form states the bound in numbers a
 * reader can check.
 */
function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * THE STRUCTURAL GATE - is this even shaped like a safe relative path?
 *
 * SEPARATED OUT, AND HONEST ABOUT WHAT IT IS. This layer is REDUNDANT with the
 * allowlist below, by construction and on purpose. Every input it rejects, the
 * allowlist would also reject, because the allowlist is exact-match plus one
 * narrow anchored pattern. A mutation test proved this: deleting the
 * protocol-relative guard changed no observable behaviour at all through the
 * composed function.
 *
 * IT IS STILL WORTH HAVING, AND IT IS WORTH SAYING WHY. The allowlist is the
 * part of this module most likely to be edited - a new page is added, someone
 * needs to return to it, an entry goes in. That edit is exactly when a
 * structural mistake becomes possible, and this layer is what is standing there
 * when it happens. Defence that only works while every other layer is correct
 * is not defence.
 *
 * Because it is redundant, it can only be PROVED directly, not through the
 * composed path - so it is exported and tested on its own, and that is what a
 * mutation of these guards now breaks.
 */
export function hasSafeRelativeShape(value: string | undefined | null): boolean {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_RETURN_DESTINATION_LENGTH) return false;

  if (containsControlCharacter(value)) return false;
  if (FORBIDDEN_CHARACTERS.test(value)) return false;

  // A single leading slash, and exactly one. Both `//host` and `/\host` are
  // protocol-relative URLs in a browser: an absolute destination wearing a
  // relative shape. (The backslash form is already excluded by
  // FORBIDDEN_CHARACTERS; it is named here because that is the reason it is in
  // that set.)
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;

  // Any dot-segment traversal. No legitimate route contains one, so this is a
  // flat refusal rather than a normalization attempt - normalizing an
  // attacker's path is how traversal bugs get written.
  if (value.includes('..')) return false;

  return true;
}

/**
 * THE LOAD-BEARING GATE - is this one of the routes this product actually has?
 *
 * This is the check that does the real work. Everything above it is a second
 * opinion. An allowlist only has to know this product's own pages, whereas a
 * denylist would have to anticipate every encoding trick ever invented, which
 * is why the decision rests here rather than on the character tests.
 */
function isAllowlistedDestination(value: string): boolean {
  return ALLOWED_EXACT_DESTINATIONS.has(value) || ALLOWED_ADMIN_DESTINATION.test(value);
}

/**
 * Returns the destination if it is a known relative application path, else null.
 *
 * NULL MEANS "USE THE EXISTING DEFAULT", never "error". A rejected value is
 * never echoed back to the caller, never logged as content, and never surfaced
 * in a message, so an open-redirect probe and an ordinary sign-in are
 * indistinguishable from outside. Failing to a safe local route is the whole
 * contract (CTO requirements 6 and 10).
 *
 * TOTAL FUNCTION: never throws, for any input, so neither the entry handler nor
 * the callback can be made to fail by feeding it something strange.
 */
export function validateReturnDestination(value: string | undefined | null): string | null {
  if (!hasSafeRelativeShape(value)) return null;

  const candidate = value as string;
  return isAllowlistedDestination(candidate) ? candidate : null;
}

/**
 * THE ORIGIN ASSERTION, extracted so it can be proved on its own.
 *
 * WHY IT IS ITS OWN EXPORTED FUNCTION. It was originally inline inside
 * `resolveSafeReturnUrl`, and a mutation test exposed the problem with that:
 * removing the assertion entirely broke nothing, because the allowlist upstream
 * already rejects every input that could reach it. Every value
 * `validateReturnDestination` accepts is a bare absolute path with no scheme, no
 * backslash, no percent-encoding and no authority, and `new URL()` cannot turn
 * any of those into a foreign origin. So the assertion was unreachable through
 * the composed path and no test could distinguish its presence from its absence.
 *
 * That does NOT mean it is pointless. Its entire job is to survive a future
 * mistake upstream: a widened allowlist, a second way of populating the flow
 * state, a relaxed HMAC. Defence that only works while every other layer is
 * correct is not defence.
 *
 * Extracting it makes the guarantee testable directly, with the off-origin
 * candidates a broken upstream would produce - which is the only honest way to
 * prove a defence-in-depth layer. Its tests are what a mutation removes.
 *
 * `new URL(candidate, base)` is the browser's own resolution algorithm, so this
 * asks the question that actually matters - "where would a browser go?" -
 * instead of re-implementing an approximation of it. The comparison is then
 * byte-exact on the origin.
 */
export function sameOriginUrlOrFallback(frontendOrigin: string, candidate: string): string {
  try {
    const base = new URL(frontendOrigin);
    const resolved = new URL(candidate, base);

    if (resolved.origin !== base.origin) return frontendOrigin;

    return resolved.toString();
  } catch {
    // A malformed origin, or a candidate that is not resolvable at all. The
    // caller always gets a usable value back and is never left holding
    // something it has to make a decision about.
    return frontendOrigin;
  }
}

/**
 * EXIT GATE. Applied at the callback, after the destination has already been
 * validated at entry and carried under an HMAC.
 *
 * REVALIDATION HERE IS NOT REDUNDANT. The signature proves the value was not
 * EDITED in transit; it does not prove it was SAFE when written, and those are
 * different claims. So the allowlist is applied again, and then the origin
 * assertion above runs on the result.
 *
 * Falls back to the frontend origin whenever there is no usable destination,
 * which is exactly the behaviour this endpoint had before the milestone.
 */
export function resolveSafeReturnUrl(
  frontendOrigin: string,
  destination: string | null | undefined,
): string {
  const validated = validateReturnDestination(destination ?? null);
  if (validated === null) return frontendOrigin;

  return sameOriginUrlOrFallback(frontendOrigin, validated);
}
