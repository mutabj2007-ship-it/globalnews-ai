import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { AskFrameScreen } from '@/components/ask-frame/AskFrameScreen';
import styles from '@/components/ask-frame/askDashboard.module.css';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';
export const metadata: Metadata = {
  title: 'Ask AI — GlobalNews AI',
  robots: { index: false, follow: false },
};
export default function AskPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';
  /* One viewport-high column: the shared header, then the frame in all remaining height. */
  return (
    <div className={styles.page}>
      <NavBar language={locale} />
      <Suspense fallback={<main className="min-h-0 flex-1 bg-void" />}>
        <AskFrameScreen locale={locale} />
      </Suspense>
    </div>
  );
}
