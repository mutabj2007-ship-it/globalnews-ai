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
 *   scheduled         TRUST & CONVERSATIONAL EXPERIENCE R1 — light during the reader's own
 *                     day hours (default 07:00–19:00, editable), dark otherwise, on the
 *                     DEVICE'S LOCAL CLOCK. A schedule, not astronomical sunrise/sunset; no
 *                     geolocation. The clock is read only in themeSchedule.ts (client).
 *
 * PERSISTENCE. There is no account preference model (User has no preference column), so —
 * per the amendment — the choice is browser/device-local: ONE first-party cookie, read by
 * the server so the first rendered frame carries the right `data-gna-theme`, exactly like
 * the language cookie. No database migration, no account write, no network request.
 *
 * Switching is presentation only: it re-labels the theme scopes already in the document.
 * No navigation, no request, no AI; held stories and the Ask conversation are untouched.
 */

export type ThemePreference = 'light' | 'dark' | 'system' | 'scheduled';

export const THEME_COOKIE_NAME = 'globalnews-ai-theme';
export const THEME_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'light',
  'dark',
  'system',
  'scheduled',
];

/** Day hours of the Scheduled mode, as local "HH:MM" (light from `lightFrom` until `darkFrom`). */
export interface ThemeSchedule {
  readonly lightFrom: string;
  readonly darkFrom: string;
}
export const DEFAULT_THEME_SCHEDULE: ThemeSchedule = { lightFrom: '07:00', darkFrom: '19:00' };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SCHEDULED_VALUE = /^scheduled(?:\.([01]\d|2[0-3])([0-5]\d)-([01]\d|2[0-3])([0-5]\d))?$/;

export function isValidClockTime(value: string): boolean {
  return HHMM.test(value);
}

/** Anything unknown, missing or malformed is the default: System. */
export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return typeof value === 'string' && SCHEDULED_VALUE.test(value) ? 'scheduled' : 'system';
}

/** The schedule a cookie value carries; the default when absent or malformed. */
export function parseThemeSchedule(value: string | null | undefined): ThemeSchedule {
  const m = typeof value === 'string' ? SCHEDULED_VALUE.exec(value) : null;
  if (!m || m[1] === undefined) return DEFAULT_THEME_SCHEDULE;
  const lightFrom = `${m[1]}:${m[2]}`;
  const darkFrom = `${m[3]}:${m[4]}`;
  return lightFrom === darkFrom ? DEFAULT_THEME_SCHEDULE : { lightFrom, darkFrom };
}

/** The cookie value for a preference (Scheduled carries its hours: `scheduled.0700-1900`). */
export function themeCookieValue(
  preference: ThemePreference,
  schedule: ThemeSchedule = DEFAULT_THEME_SCHEDULE,
): string {
  if (preference !== 'scheduled') return preference;
  return `scheduled.${schedule.lightFrom.replace(':', '')}-${schedule.darkFrom.replace(':', '')}`;
}

/** What a scope actually shows. System needs the media fact; explicit choices ignore it. */
export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
  scheduledIsLight = true,
): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  if (preference === 'scheduled') return scheduledIsLight ? 'light' : 'dark';
  return preference;
}

/** Minutes after local midnight → whether the schedule is in its light hours. Pure. */
export function scheduleIsLightAt(schedule: ThemeSchedule, minutesOfDay: number): boolean {
  const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const from = toMin(schedule.lightFrom);
  const to = toMin(schedule.darkFrom);
  return from < to
    ? minutesOfDay >= from && minutesOfDay < to
    : minutesOfDay >= from || minutesOfDay < to;
}

export function themeCookieString(
  preference: ThemePreference,
  schedule: ThemeSchedule = DEFAULT_THEME_SCHEDULE,
): string {
  return `${THEME_COOKIE_NAME}=${themeCookieValue(preference, schedule)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_S}; SameSite=Lax`;
}

/** The raw cookie value from a `document.cookie`-shaped string. */
export function readThemeCookieValue(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === THEME_COOKIE_NAME) return rest.join('=');
  }
  return undefined;
}

/** Read the preference from a `document.cookie`-shaped string. */
export function readThemeCookie(cookieHeader: string | null | undefined): ThemePreference {
  return parseThemePreference(readThemeCookieValue(cookieHeader));
}
