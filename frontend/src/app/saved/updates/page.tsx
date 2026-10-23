import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { ASK_PRODUCT_NAME } from '@/lib/ask/askBrand';
import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme';
import { askThemeColor, parseAskThemePreference } from '@/lib/ask/askTheme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
import { MyUpdatesClient } from '@/components/ask/MyUpdatesClient';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';

/**
 * REASON TO RETURN R1 · §8 — `/saved/updates`: My updates, the reader's followed questions.
 *
 * Grouped by followed question only (no regional feed, no unsolicited items). NOINDEX and
 * signed-in only: the server answers 401 / 404 (ASK_BRIEFINGS_ENABLED off) and the page reports
 * it. Same standalone shell, theme and governed `saved` locale surface as `/saved`.
 */
export const metadata: Metadata = {
  /* R4 · CTO brand ruling — one canonical product name, never an authored variant */
  title: `My updates — ${ASK_PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

/** ASK DESIGN AUTHORITY R3 — the browser chrome follows the reader's Ask treatment (Light unless
    they saved another), so a Light page is not framed by the layout's navy status-bar colour. */
export function generateViewport(): Viewport {
  return { themeColor: askThemeColor(parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)) };
}

export default function MyUpdatesPage(): JSX.Element {
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — the reader's own locale, resolved once and not clamped.
     This line was `=== 'pl' ? 'pl' : 'en'`; see lib/ask/askLocale.ts for the one declared
     boundary between the seven-locale interface and the two-locale answer engine. */
  /* T2 — through the display-locale authority: the effective locale of this surface (the reader's
     own while H's Ask shell is complete for it, English with the declared notice otherwise). */
  const locale = surfaceLocale('saved').effective;
  /* R4 · one disposition per surface. The nav and continuity chrome read the two-locale
     catalogues (`askNavStrings` / `askContinuityStrings`); the Ask frame renders in the
     reader's locale. Reading both from one disposition is what stops them drifting. */
  const chrome = askLanguageDisposition(locale).catalogueLocale;

  return (
    <AskThemedSurface theme={parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} />
        {/* ASK R3 NAVIGATION / USABILITY R1 — titled My updates, never "Saved" (audit D08) */}
        <AskContinuityHeader locale={chrome} surface="updates" />
        <AskClearedBoundary>
          <MyUpdatesClient locale={chrome} />
        </AskClearedBoundary>
      </AskNavProvider>
    </AskThemedSurface>
  );
}
