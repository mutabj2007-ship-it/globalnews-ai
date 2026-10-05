import { cookies } from 'next/headers';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { DISPLAY_LOCALE_COOKIE, requestedDisplayLocaleOf } from '@/lib/i18n/displayLocale';
import { resolveSurfaceLocale, type SurfaceId, type SurfaceLocale } from '@/lib/i18n/surfaceLocale';

/**
 * T2 · THE SERVER SIDE OF THE DISPLAY-LOCALE AUTHORITY (route pages, layouts, metadata).
 *
 * Every Server Component that needs a locale calls one of these — never `cookies().get(…)` plus
 * its own validator. The cookie is validated against the seven display locales; the surface's
 * effective locale comes from the effective-locale rule (`surfaceLocale.ts`). The root layout's
 * request-path variant is `documentLocale.server.ts`.
 */

/** What the reader asked for (validated against DISPLAY_LOCALES; English when nothing stored). */
export function requestedDisplayLocale(): DisplayLocale {
  return requestedDisplayLocaleOf(cookies().get(DISPLAY_LOCALE_COOKIE)?.value);
}

/** The effective locale decision for a named surface. Route pages call this. */
export function surfaceLocale(surface: SurfaceId): SurfaceLocale {
  return resolveSurfaceLocale(surface, requestedDisplayLocale());
}

