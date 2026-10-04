import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { resolveAskLocale } from '@/lib/ask/askLocale';
import { cookies } from 'next/headers';
import { AccountSettingsBody } from '@/components/account/AccountSettingsBody';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
import { AskThemedSurface } from '@/components/ask-nav/AskThemedSurface';
import { THEME_COOKIE_NAME, parseThemePreference } from '@/lib/theme/theme';
import { AskContinuityHeader } from '@/components/ask-nav/AskContinuityHeader';
import { AskClearedBoundary } from '@/components/ask-nav/AskClearedBoundary';
import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';

/**
 * ALPHA VISUAL ACCEPTANCE REPAIR R1 — the server wrapper of the account settings surface.
 *
 * The body (identity row + Danger Zone, account deletion and its typed confirmation) is
 * AccountSettingsBody, unchanged in behaviour. What this wrapper decides is the chrome and
 * the language:
 *
 *   standalone Public Beta   the standalone Ask navigation only — no platform header, no
 *                            Footer, no global Ask dock — in the reader's active EN/PL.
 *   GNA_PUBLIC_ROOT=platform the released platform presentation, exactly as before.
 *
 * Metadata (noindex) stays with app/account/layout.tsx, untouched.
 */
export default function AccountSettingsPage(): JSX.Element {
  if (!standaloneAskRoot()) return <AccountSettingsBody language="en" chrome="platform" />;
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
        <AskContinuityHeader locale={chrome} surface="settings" />
        <AskClearedBoundary>
          <AccountSettingsBody language={chrome} chrome="standalone" />
        </AskClearedBoundary>
      </AskNavProvider>
    </AskThemedSurface>
  );
}
