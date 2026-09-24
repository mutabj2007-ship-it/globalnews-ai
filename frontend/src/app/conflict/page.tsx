import { cookies } from 'next/headers';
import { ConflictDashboard } from '@/components/conflict/ConflictDashboard';
import { LanguageSync } from '@/components/i18n/LanguageSync';
import { LANGUAGE_COOKIE_NAME, isActiveLanguageCode } from '@/lib/i18n/languages';
import { AlphaRetainedReportingDock } from '@/components/alpha/AlphaRetainedReportingDock';
export const metadata = {
  title: 'Conflict Intelligence | GlobalNews AI',
  robots: { index: false, follow: false },
};
export default function ConflictPage() {
  const value = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const language = value && isActiveLanguageCode(value) ? value : 'en';
  return (
    <>
      <LanguageSync />
      <ConflictDashboard language={language} />
      <AlphaRetainedReportingDock domain="conflict" />
    </>
  );
}
