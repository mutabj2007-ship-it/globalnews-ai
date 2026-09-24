import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { SecLocale } from '@/lib/security/securityStrings';
import { SecurityCompactScreen } from '@/components/security/SecurityCompactScreen';
import { AlphaRetainedReportingDock } from '@/components/alpha/AlphaRetainedReportingDock';

/**
 * SECURITY — ALPHA VISUAL PREVIEW, COMPACT. `PEEK · HALF · FULL · WORKSPACE`.
 *
 * Main names this address with its four detents, and the detents are why the phone gets its
 * own inspection rather than being judged by narrowing the desktop: the desktop frame is four
 * permanent regions, and this one is a single column under a detent control whose contents
 * are Main's own list per detent.
 *
 * **A0 and C2 survive every detent, including PEEK at 152px.** That is the assertion worth
 * making at this address: on a 390px phone at the smallest detent, the honesty markers are
 * the first thing an engineer would reasonably cut, and Part IX's reduction rule exists
 * because they are the last thing that may go.
 *
 * The desktop preview's header carries the rest — noindex, no home card, no component that
 * exists only for the preview, zero metered AI on any interaction including a detent change.
 */
export const metadata: Metadata = {
  title: 'Security Intelligence — Alpha visual preview, compact',
  robots: { index: false, follow: false },
};

function securityLocale(): SecLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  return SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
}

export default function SecurityVisualPreviewCompactPage(): JSX.Element {
  const locale = securityLocale();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <div className="min-h-screen bg-sp-bg">
        <SecurityCompactScreen locale={locale} />
        <AlphaRetainedReportingDock domain="security" />
      </div>
    </ScriptRun>
  );
}
