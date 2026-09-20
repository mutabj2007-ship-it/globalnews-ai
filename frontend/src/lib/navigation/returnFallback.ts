/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE GOVERNED RETURN FALLBACK — DERIVED, NEVER CHOSEN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * When `canReturnInApp()` is false the control must still do something, and
 * what it does has to come from accepted authority rather than from a table
 * someone typed.
 *
 * `lib/intelligenceModules.ts` IS that authority: every `destination` in it is
 * asserted to be a real route, and `isModuleNavigable` is the sole gate on
 * whether a module may be linked at all. Inverting that relation gives the
 * fallback — *the route whose Engine card links to this surface* — and the
 * Engine ring lives on `/`.
 *
 *     country-intelligence  active   -> /map
 *     market                preview  -> /market
 *     humanitarian          preview  -> /humanitarian
 *     energy                preview  -> /energy
 *     economy               preview  -> /economy-visual-preview
 *     politics              preview  -> /politics-visual-preview
 *     security              preview  -> /security-visual-preview
 *     conflict              preview  -> specialistEntryHref(...)
 *     world-intelligence    comingSoon  NONE — not navigable
 *
 * Every one of those destinations is reached FROM the Engine ring on `/`, so
 * the fallback for every specialist surface is `/`. One value, derived, and
 * surface-independent.
 *
 * TWO SURFACES HAVE NO ENGINE CARD — `/election-visual-preview` and
 * `/delivery-visual-preview` — and that is correct rather than an omission. The
 * Engine is closed at nine, a mirror-symmetric ring asserted nine separate
 * ways; a tenth card is a geometry redesign. Their fallback is still `/`,
 * because `/` is the product root a reader can always act from, not because a
 * card points at them.
 *
 * WHY THIS FILE IMPORTS NOTHING. The derivation is real but it must not become
 * a RUNTIME EDGE. Importing `intelligenceModules` here would pull the route
 * table — and through it `mapShellFlag` and `mapDomainEntry` — into the sealed
 * dependency closure of every specialist surface that hosts the control, which
 * their own containment guards measure and reject.
 *
 * So the derivation is asserted AT TEST TIME instead, in the shared-nav guard,
 * which imports `INTELLIGENCE_MODULES` itself and proves every navigable
 * destination is reached from `PRODUCT_ROOT`. The property is enforced exactly
 * as strongly, and it costs the product no coupling: if the route authority
 * ever stops being reachable from `/`, the guard fails.
 */

/** The product root. The Engine ring — the index of every surface — is here. */
export const PRODUCT_ROOT = '/';

/**
 * The route a return lands on when there is no in-app entry behind the reader.
 *
 * Takes the current pathname only so the derivation can be asserted per surface
 * and so a future contract can legitimately narrow one surface without
 * introducing a second table. Today every governed surface resolves to `/`.
 */
export function returnFallbackFor(pathname: string): string {
  /*
    A reader already at the root has nothing above it. Returning the root is
    still correct and still not a dead control — it is a no-op navigation the
    browser handles — but the control is not hosted on `/` in the first place,
    so this branch exists for totality rather than for a real surface.
  */
  if (pathname === PRODUCT_ROOT) return PRODUCT_ROOT;

  /*
    THE DERIVATION. Every navigable module's destination is linked from the
    Engine ring, and the ring is on the root. So the route that leads to this
    surface is the root, for every surface the ring covers — and for the two
    preview surfaces it deliberately does not cover.
  */
  return PRODUCT_ROOT;
}
