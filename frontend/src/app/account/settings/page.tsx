import { cookies } from 'next/headers';
import { AccountSettingsBody } from '@/components/account/AccountSettingsBody';
import { AskNavProvider, AskNavShell } from '@/components/ask-nav/AskNavShell';
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
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';
  return (
    <AskNavProvider>
      <AskNavShell language={locale} />
      <AskContinuityHeader locale={locale} surface="settings" />
      <AskClearedBoundary>
        <AccountSettingsBody language={locale} chrome="standalone" />
      </AskClearedBoundary>
    </AskNavProvider>
  );
}
