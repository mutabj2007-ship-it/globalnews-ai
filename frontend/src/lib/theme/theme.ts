/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R1 · STAGE A CLOSEOUT — DUAL THEME AUTHORITY (CTO product amendment)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Light · Dark · System. ONE component architecture, TWO token sets (the accepted Claude
 * Design `THEMES.light` / `THEMES.dark`, verbatim, as `--gt-*` custom properties in
 * globals.css). No component is forked per theme.
 *
 *   system (default)  follows the browser / OS `prefers-color-scheme` — resolved by CSS
 *                     media queries, so the first painted frame is already right; no clock.
 *   light / dark      an explicit choice; overrides System until the reader changes it.
 *
 * PERSISTENCE. There is no account preference model (User has no preference column), so —
 * per the amendment — the choice is browser/device-local: ONE first-party cookie, read by
 * the server so the first rendered frame carries the right `data-gna-theme`, exactly like
 * the language cookie. No database migration, no account write, no network request.
 *
 * Switching is presentation only: it re-labels the theme scopes already in the document.
 * No navigation, no request, no AI; held stories and the Ask conversation are untouched.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE_NAME = 'globalnews-ai-theme';
export const THEME_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Anything unknown, missing or malformed is the default: System. */
export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/** What a scope actually shows. System needs the media fact; explicit choices ignore it. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export function themeCookieString(preference: ThemePreference): string {
  return `${THEME_COOKIE_NAME}=${preference}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_S}; SameSite=Lax`;
}

/** Read the preference from a `document.cookie`-shaped string. */
export function readThemeCookie(cookieHeader: string | null | undefined): ThemePreference {
  if (!cookieHeader) return 'system';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === THEME_COOKIE_NAME) return parseThemePreference(rest.join('='));
  }
  return 'system';
}
