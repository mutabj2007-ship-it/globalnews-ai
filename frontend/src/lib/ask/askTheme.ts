import type { Viewport } from 'next';
import { parseThemePreference, type ThemePreference } from '@/lib/theme/theme';

/**
 * ASK DESIGN AUTHORITY R3 — CTO THEME RULING.
 *
 * The approved Claude Design is the LIGHT treatment (warm off-white page, white surfaces, muted
 * teal, charcoal text). A reader with NO stored appearance preference therefore opens standalone
 * Ask in Light — not in whatever the operating system prefers, which put iPhones in dark mode on
 * the navy alternate. A preference the reader DID save (Light, Dark, System or Scheduled) still
 * wins exactly as before; navy stays fully supported as the alternate.
 *
 * A malformed cookie is not a preference anyone chose, so it reads as "none" (Light) here, where
 * the platform's own parser reads it as System.
 */
export function parseAskThemePreference(value: string | null | undefined): ThemePreference {
  if (value === undefined || value === null || value.trim() === '') return 'light';
  const parsed = parseThemePreference(value);
  return parsed === 'system' && value !== 'system' ? 'light' : parsed;
}

/** The Ask page surface in each treatment (the `--ad-bg` tokens of askDashboard.module.css). */
export const ASK_LIGHT_PAGE = '#faf9f7';
export const ASK_NAVY_PAGE = '#080b12';

/**
 * The browser chrome colour (iOS Safari tints its status bar / toolbar with it) for an Ask page,
 * so a Light page is not framed by the layout's navy default. System and Scheduled follow the
 * colour scheme, the closest a server render can know.
 */
export function askThemeColor(preference: ThemePreference): NonNullable<Viewport['themeColor']> {
  if (preference === 'light') return ASK_LIGHT_PAGE;
  if (preference === 'dark') return ASK_NAVY_PAGE;
  return [
    { media: '(prefers-color-scheme: light)', color: ASK_LIGHT_PAGE },
    { media: '(prefers-color-scheme: dark)', color: ASK_NAVY_PAGE },
  ];
}
