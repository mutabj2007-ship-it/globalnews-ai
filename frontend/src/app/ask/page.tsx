import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { ASK_PRODUCT_NAME } from '@/lib/ask/askBrand';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskShellFrame } from '@/components/ask-nav/AskShellFrame';
import { AskThemedPage } from '@/components/ask-nav/AskThemedPage';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme';
import { askThemeColor, parseAskThemePreference } from '@/lib/ask/askTheme';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
export const metadata: Metadata = {
  /* R4 · CTO brand ruling — one canonical product name, never an authored variant */
  title: ASK_PRODUCT_NAME,
  robots: { index: false, follow: false },
};
/** ASK DESIGN AUTHORITY R3 — the browser chrome follows the reader's Ask treatment (Light unless
    they saved another), so a Light page is not framed by the layout's navy status-bar colour. */
export function generateViewport(): Viewport {
  return { themeColor: askThemeColor(parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)) };
}

/**
 * STANDALONE ASK — /ask NO LONGER RENDERS THE PLATFORM HEADER.
 *
 * `<NavBar />` was here. It is the GlobalNews AI PLATFORM header: its wordmark
 * links to `/`, it carries a Search control, and its account menu offers
 * `/my-intelligence`, `/history`, `/support` and `/account/settings`. Four of
 * those are on the ASK GLOBALNEWSAI STANDALONE BETA removal list, and `/history`
 * is the legacy Search history that must never be presented as Ask Recent, so no
 * subset of that bar is the ruled Ask menu. `<AskNavShell />` renders the ruled
 * set instead. NavBar is untouched and still serves every other route.
 *
 * PR #66's COLUMN IS PRESERVED EXACTLY. `styles.page` is the one viewport-high
 * flex column the composer clipping fix introduced: the header is
 * `flex-shrink: 0`, the frame is `flex: 1 1 0`, and the page itself never
 * scrolls. The only change here is WHICH header sits in that first slot.
 *
 * Both of the elements that column sizes are still DIRECT children of it —
 * `AskNavProvider` and `Suspense` render no DOM, and neither does
 * `AskShellFrame`. The Suspense fallback keeps #66's `min-h-0 flex-1` for the
 * same reason.
 */
export default function AskPage(): JSX.Element {
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — the reader's own locale, resolved once and not clamped.
     This line was `=== 'pl' ? 'pl' : 'en'`; see lib/ask/askLocale.ts for the one declared
     boundary between the seven-locale interface and the two-locale answer engine. */
  /* T2 — through the display-locale authority: the effective locale of this surface (the reader's
     own while H's Ask shell is complete for it, English with the declared notice otherwise). */
  const locale = surfaceLocale('askStandalone').effective;
  /* R4 · one disposition per surface. The nav and continuity chrome read the two-locale
     catalogues (`askNavStrings` / `askContinuityStrings`); the Ask frame renders in the
     reader's locale. Reading both from one disposition is what stops them drifting. */
  const chrome = askLanguageDisposition(locale).catalogueLocale;
  /* TRUST R1 — the column is also the theme scope (AskThemedPage), rendered from the cookie. */
  const theme = parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value);
  return (
    <AskThemedPage theme={theme}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} theme={theme} surface="reading" />
        <Suspense fallback={<main className="min-h-0 flex-1 bg-void" />}>
          <AskShellFrame locale={locale} />
        </Suspense>
      </AskNavProvider>
    </AskThemedPage>
  );
}
