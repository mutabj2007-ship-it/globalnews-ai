import type { Viewport } from 'next';
import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { askDirectionProps } from '@/lib/ask/askDirection';
import { resolveAskLocale } from '@/lib/ask/askLocale';
import { cookies } from 'next/headers';
import { AccountSettingsBody } from '@/components/account/AccountSettingsBody';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme';
import { askThemeColor, parseAskThemePreference } from '@/lib/ask/askTheme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';

/** ASK DESIGN AUTHORITY R3 — the browser chrome follows the reader's Ask treatment (Light unless
    they saved another), so a Light page is not framed by the layout's navy status-bar colour. */
export function generateViewport(): Viewport {
  return { themeColor: askThemeColor(parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)) };
}

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the server wrapper of the account settings surface.
 *
 * The body (identity row + Danger Zone, account deletion and its typed confirmation) is
 * AccountSettingsBody, unchanged in behaviour. What this wrapper decides is the chrome and
 * the language:
 *
 *   both roots               the Ask navigation, theme and direction — no platform header, no
 *                            Footer — in the reader's own DisplayLocale (R4 CTO ruling: Alpha
 *                            runs GNA_PUBLIC_ROOT=platform and the Ask navigation reaches this page).
 *
 * Metadata (noindex) stays with app/account/layout.tsx, untouched.
 */
export default function AccountSettingsPage(): JSX.Element {
  /* R4 · SEVEN-LANGUAGE ASK FRONTEND — the reader's own locale, resolved once and not clamped.
     This line was `=== 'pl' ? 'pl' : 'en'`; see lib/ask/askLocale.ts for the one declared
     boundary between the seven-locale interface and the two-locale answer engine. */
  const locale = resolveAskLocale(cookies().get(LANGUAGE_COOKIE_NAME)?.value);
  /*
    R4 · CTO PLATFORM-SETTINGS RULINGS — Settings is an Ask surface in BOTH modes. On Alpha
    (GNA_PUBLIC_ROOT=platform) it rendered the platform presentation: first hard-coded English,
    then the platform NavBar / Footer around localized content — English chrome, a second brand
    spelling, no light theme, LTR in Arabic. It now uses the same Ask shell, theme and direction
    as Recent, Saved and the briefing detail, whatever the root. The platform NavBar / Footer
    themselves are unchanged (their localization is the whole-product programme's).
  */
  /* R4 · one disposition per surface. The nav and continuity chrome read the two-locale
     catalogues (`askNavStrings` / `askContinuityStrings`); the Ask frame renders in the
     reader's locale. Reading both from one disposition is what stops them drifting. */
  const chrome = askLanguageDisposition(locale).catalogueLocale;
  /*
    R4 · CTO LOCALIZATION CONVERGENCE — the body reads the reader's own DisplayLocale through
    the Ask locale authority. The `askLocaleForLegacyCatalogue` crossing this replaced collapsed
    de / pt to English and bypassed Claude L's qualified overlay for all five new languages.
  */
  return (
    <AskThemedSurface theme={parseAskThemePreference(cookies().get(THEME_COOKIE_NAME)?.value)}>
      <AskNavProvider>
        <AskNavShell language={chrome} selected={locale} />
        <AskContinuityHeader locale={chrome} surface="settings" />
        <AskClearedBoundary>
          {/* R4 · the body is outside the nav shell's direction scope: Arabic laid it out LTR */}
          <div className="contents" {...askDirectionProps(chrome)}>
            <AccountSettingsBody locale={chrome} chrome="standalone" />
          </div>
        </AskClearedBoundary>
      </AskNavProvider>
    </AskThemedSurface>
  );
}
