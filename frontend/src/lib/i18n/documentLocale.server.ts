import { headers } from 'next/headers';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { surfaceForPathname } from '@/lib/i18n/surfaceRoutes';
import type { SurfaceId, SurfaceLocale } from '@/lib/i18n/surfaceLocale';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';

/**
 * T2 · THE ROOT LAYOUT'S SIDE OF THE DISPLAY-LOCALE AUTHORITY: which surface the current request
 * renders (from the path the middleware forwards), resolved by the same effective-locale rule the
 * route page uses, so `<html lang>` / `<html dir>` describe exactly what is on the page.
 */

/** The request header the middleware sets so the root layout knows which surface it wraps. */
export const SURFACE_PATH_HEADER = 'x-gna-pathname';

/** The surface the current request renders, from the middleware's path header. */
export function currentSurface(): SurfaceId {
  let pathname: string | null = null;
  try {
    pathname = headers().get(SURFACE_PATH_HEADER);
  } catch {
    pathname = null;
  }
  return surfaceForPathname(pathname, standaloneAskRoot());
}

/** The root layout's decision: the current request's surface, resolved by the same rule. */
export function documentSurfaceLocale(): SurfaceLocale {
  return surfaceLocale(currentSurface());
}
