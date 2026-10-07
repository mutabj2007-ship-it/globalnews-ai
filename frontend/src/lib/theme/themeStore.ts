'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  parseThemeSchedule,
  readThemeCookie,
  readThemeCookieValue,
  themeCookieString,
  themeCookieValue,
  DEFAULT_THEME_SCHEDULE,
  type ThemePreference,
  type ThemeSchedule,
} from './theme';
import { applyScheduleAttribute, msUntilNextBoundary } from './themeSchedule';

/**
 * HOME R1 · DUAL THEME — the reader's choice in the browser. A tiny external store over the
 * one first-party cookie: setting it writes the cookie, re-labels every theme scope already
 * in the document (`[data-gna-theme]`) and notifies subscribers. Nothing is fetched, nothing
 * navigates, no other state (held stories, Ask conversation) is touched.
 *
 * TRUST & CONVERSATIONAL EXPERIENCE R1 — Scheduled: the store also keeps the <html> schedule
 * attribute current (themeSchedule.ts) at each boundary and when the tab becomes visible.
 */
const listeners = new Set<() => void>();
let override: ThemePreference | null = null;
let scheduleOverride: ThemeSchedule | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let visibilityBound = false;

function current(): ThemePreference {
  if (override !== null) return override;
  return typeof document === 'undefined' ? 'system' : readThemeCookie(document.cookie);
}

/* A stable snapshot per cookie value (useSyncExternalStore compares by identity). */
let parsedFrom: string | undefined;
let parsed: ThemeSchedule = DEFAULT_THEME_SCHEDULE;
function currentSchedule(): ThemeSchedule {
  if (scheduleOverride !== null) return scheduleOverride;
  if (typeof document === 'undefined') return DEFAULT_THEME_SCHEDULE;
  const value = readThemeCookieValue(document.cookie);
  if (value !== parsedFrom) {
    parsedFrom = value;
    parsed = parseThemeSchedule(value);
  }
  return parsed;
}

/** Re-apply the schedule attribute now and arm the next boundary (Scheduled only). */
function syncSchedule(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (typeof document === 'undefined' || document.documentElement === undefined) return;
  const preference = current();
  applyScheduleAttribute(themeCookieValue(preference, currentSchedule()));
  if (preference !== 'scheduled') return;
  timer = setTimeout(syncSchedule, msUntilNextBoundary(currentSchedule(), new Date()));
  if (!visibilityBound && typeof document.addEventListener === 'function') {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncSchedule();
    });
  }
}

export function setThemePreference(
  preference: ThemePreference,
  schedule: ThemeSchedule = currentSchedule(),
): void {
  override = preference;
  scheduleOverride = schedule;
  if (typeof document !== 'undefined') {
    document.cookie = themeCookieString(preference, schedule);
    for (const scope of document.querySelectorAll<HTMLElement>('[data-gna-theme]')) {
      scope.dataset.gnaTheme = preference;
    }
    syncSchedule();
  }
  for (const listener of listeners) listener();
}

/**
 * The preference as the client sees it. `serverPreference` is what the server rendered from
 * the cookie, so hydration never disagrees with the first frame.
 */
export function useThemePreference(serverPreference: ThemePreference = 'system'): ThemePreference {
  /*
    ASK DESIGN AUTHORITY R3 — CTO THEME RULING. With NO theme cookie and no choice made in this
    session, a scope keeps the preference its server render read: standalone Ask's is Light (the
    approved Design), the platform's is System — so neither changes after hydration. A stored or
    newly chosen preference wins exactly as before.
  */
  const snapshot = useCallback(
    (): ThemePreference =>
      override === null &&
      typeof document !== 'undefined' &&
      readThemeCookieValue(document.cookie) === undefined
        ? serverPreference
        : current(),
    [serverPreference],
  );
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      /* The first subscriber arms the schedule (the boot script already set the first frame). */
      if (listeners.size === 1) syncSchedule();
      return () => listeners.delete(listener);
    },
    snapshot,
    () => serverPreference,
  );
}

/** The Scheduled hours as the client sees them. */
export function useThemeSchedule(): ThemeSchedule {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentSchedule,
    () => DEFAULT_THEME_SCHEDULE,
  );
}

/** Tests only. */
export function resetThemeStoreForTest(): void {
  override = null;
  scheduleOverride = null;
  if (timer !== null) clearTimeout(timer);
  timer = null;
}
