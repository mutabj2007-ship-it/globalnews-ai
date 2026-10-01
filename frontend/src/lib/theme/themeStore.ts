'use client';

import { useSyncExternalStore } from 'react';
import { readThemeCookie, themeCookieString, type ThemePreference } from './theme';

/**
 * HOME R1 · DUAL THEME — the reader's choice in the browser. A tiny external store over the
 * one first-party cookie: setting it writes the cookie, re-labels every theme scope already
 * in the document (`[data-gna-theme]`) and notifies subscribers. Nothing is fetched, nothing
 * navigates, no other state (held stories, Ask conversation) is touched.
 */
const listeners = new Set<() => void>();
let override: ThemePreference | null = null;

function current(): ThemePreference {
  if (override !== null) return override;
  return typeof document === 'undefined' ? 'system' : readThemeCookie(document.cookie);
}

export function setThemePreference(preference: ThemePreference): void {
  override = preference;
  if (typeof document !== 'undefined') {
    document.cookie = themeCookieString(preference);
    for (const scope of document.querySelectorAll<HTMLElement>('[data-gna-theme]')) {
      scope.dataset.gnaTheme = preference;
    }
  }
  for (const listener of listeners) listener();
}

/**
 * The preference as the client sees it. `serverPreference` is what the server rendered from
 * the cookie, so hydration never disagrees with the first frame.
 */
export function useThemePreference(serverPreference: ThemePreference = 'system'): ThemePreference {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    current,
    () => serverPreference,
  );
}

/** Tests only. */
export function resetThemeStoreForTest(): void {
  override = null;
}
