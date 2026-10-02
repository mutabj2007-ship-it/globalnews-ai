import {
  THEME_COOKIE_NAME,
  parseThemePreference,
  parseThemeSchedule,
  scheduleIsLightAt,
  type ThemeSchedule,
} from './theme';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — SCHEDULED DAY / NIGHT (the only clock reader)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Scheduled mode resolves on the DEVICE'S LOCAL CLOCK (no geolocation, no request). Theme
 * scopes keep `data-gna-theme="scheduled"`; the resolved half is ONE attribute on <html>,
 * `data-gna-schedule="light|dark"`, which the token blocks and the generated Ask adapter read.
 *
 *   before paint  SCHEDULE_BOOT_SCRIPT (inline in <head>) reads the cookie and sets the
 *                 attribute, so the first painted frame is already the scheduled half.
 *   afterwards    the store re-applies it at each boundary and when the tab becomes visible.
 *   no script     the attribute is absent and Scheduled falls back to System (CSS).
 */
export const SCHEDULE_ATTRIBUTE = 'data-gna-schedule';

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** The scheduled half for a local instant. */
export function scheduledHalf(schedule: ThemeSchedule, now: Date): 'light' | 'dark' {
  return scheduleIsLightAt(schedule, minutesOfDay(now)) ? 'light' : 'dark';
}

/** Milliseconds until the next schedule boundary (at least one second). */
export function msUntilNextBoundary(schedule: ThemeSchedule, now: Date): number {
  const current = minutesOfDay(now);
  const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const deltas = [toMin(schedule.lightFrom), toMin(schedule.darkFrom)].map(
    (m) => (m - current + 1440) % 1440 || 1440,
  );
  const minutes = Math.min(...deltas);
  return Math.max(1000, minutes * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds());
}

/** Apply (or clear) the html attribute for a cookie value. Returns the half applied. */
export function applyScheduleAttribute(
  cookieValue: string | undefined,
  now: Date = new Date(),
): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null;
  const root = document.documentElement;
  if (parseThemePreference(cookieValue) !== 'scheduled') {
    root.removeAttribute(SCHEDULE_ATTRIBUTE);
    return null;
  }
  const half = scheduledHalf(parseThemeSchedule(cookieValue), now);
  root.setAttribute(SCHEDULE_ATTRIBUTE, half);
  return half;
}

/**
 * The pre-paint boot script: the same rules, self-contained (no imports), so the first frame of
 * a Scheduled reader is already right. It only reads one first-party cookie and sets one
 * attribute; it requests nothing.
 */
export const SCHEDULE_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=scheduled(?:\\.(\\d\\d)(\\d\\d)-(\\d\\d)(\\d\\d))?(?:;|$)/);if(!m)return;var f=m[1]?(+m[1])*60+(+m[2]):420,t=m[3]?(+m[3])*60+(+m[4]):1140;if(f===t){f=420;t=1140}var d=new Date(),n=d.getHours()*60+d.getMinutes();var l=f<t?(n>=f&&n<t):(n>=f||n<t);document.documentElement.setAttribute('${SCHEDULE_ATTRIBUTE}',l?'light':'dark')}catch(e){}})();`;
