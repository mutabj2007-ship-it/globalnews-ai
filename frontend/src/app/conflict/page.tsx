import { ConflictDashboard } from '@/components/conflict/ConflictDashboard';
import { LanguageSync } from '@/components/i18n/LanguageSync';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
export const metadata = {
  title: 'Conflict Intelligence | GlobalNews AI',
  robots: { index: false, follow: false },
};
export default function ConflictPage() {
  const language = surfaceLocale('conflict').language;
  return (
    <>
      <LanguageSync />
      <ConflictDashboard language={language} />
    </>
  );
}
