import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n/languages';
import { ImihigoScreen } from '@/components/delivery/ImihigoScreen';
import { readRetainedImihigo } from '@/lib/imihigo/retainedReader';

export const metadata: Metadata = {
  title: 'Imihigo Intelligence — retained NISR evaluation',
  robots: { index: false, follow: false },
};
/** Explicit R1 specialist route. No acquisition; /delivery's broader gates stay closed. */
export default function ImihigoPage({ searchParams }: { searchParams?: { compact?: string } }): JSX.Element {
  const locale = cookies().get(LANGUAGE_COOKIE_NAME)?.value === 'pl' ? 'pl' : 'en';
  const view = readRetainedImihigo();
  return <ScriptRun locale={locale} step="wrapping" as="div"><main>
    <ImihigoScreen view={view} locale={locale} compact={searchParams?.compact === '1'} />
  </main></ScriptRun>;
}
