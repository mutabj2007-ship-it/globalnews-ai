import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { ASK_PRODUCT_NAME } from '@/lib/ask/askBrand';
import { resolveAskLocale } from '@/lib/ask/askLocale';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
import { SavedClient } from '@/components/ask/SavedClient';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';

/**
 * ASK RECENT + SAVED CONTINUITY R1 — `/saved`.
 *
 * Standalone Ask: saved QUESTIONS only. Saved Stories remain where they are, in My
 * Intelligence, untouched and unexposed here, per the Product Owner's standalone
 * ruling.
 *
 * NOINDEX and signed-in only, for the same reasons as `/ask/recent`: the server
 * answers 401 and the surface reports it, rather than this page inferring a session.
 *
 * STANDALONE CONTINUITY SHELL CLOSURE — the standalone Ask navigation, never the
 * platform NavBar: the same AskNavProvider + AskNavShell as `/` and `/ask` (62px bar
 * on desktop), plus AskContinuityHeader for the phone/768-portrait 56px header whose
 * trigger opens the same drawer. The list below it scrolls normally.
 */
export const metadata: Metadata = {
  /* R4 · CTO brand ruling — one canonical product name, never an authored variant */
  title: `Saved — ${ASK_PRODUCT_NAME}`,
  robots: { index: false, follow: false },
};

export default function SavedPage(): JSX.Element {
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — the reader's own locale, resolved once and not clamped.
     This line was `=== 'pl' ? 'pl' : 'en'`; see lib/ask/askLocale.ts for the one declared
     boundary between the seven-locale interface and the two-locale answer engine. */
  const locale = resolveAskLocale(cookies().get(LANGUAGE_COOKIE_NAME)?.value);
  /* R4 · one disposition per surface. The nav and continuity chrome read the two-locale
     catalogues (`askNavStrings` / `askContinuityStrings`); the Ask frame renders in the
     reader's locale. Reading both from one disposition is what stops them drifting. */
  const chrome = askLanguageDisposition(locale).catalogueLocale;

  return (
    <AskThemedSurface theme={parseThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} />
        <AskContinuityHeader locale={chrome} surface="saved" />
        <AskClearedBoundary>
          <SavedClient locale={chrome} />
        </AskClearedBoundary>
      </AskNavProvider>
    </AskThemedSurface>
  );
}
