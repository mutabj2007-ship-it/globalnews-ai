import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { NavBar } from '@/components/navigation/NavBar';
import { AskFrameScreen } from '@/components/ask-frame/AskFrameScreen';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';
export const metadata: Metadata = {
  title: 'Ask AI — GlobalNews AI',
  robots: { index: false, follow: false },
};
export default function AskPage(): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';
  return (
    <>
      <NavBar language={locale} />
      <Suspense fallback={<main className="min-h-screen bg-void" />}>
        <AskFrameScreen locale={locale} />
      </Suspense>
    </>
  );
}
