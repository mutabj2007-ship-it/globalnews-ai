import type { Metadata } from 'next';
import type { JSX } from 'react';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { effectiveWithin } from '@/lib/i18n/surfaceLocale';
import { ImihigoScreen } from '@/components/delivery/ImihigoScreen';
import { readRetainedImihigo } from '@/lib/imihigo/retainedReader';

export const metadata: Metadata = {
  title: 'Imihigo Intelligence — retained NISR evaluation',
  robots: { index: false, follow: false },
};
/** Explicit R1 specialist route. No acquisition; /delivery's broader gates stay closed. */
export default function ImihigoPage({ searchParams }: { searchParams?: { compact?: string } }): JSX.Element {
  /* T2 — the effective locale; the delivery catalogue authors en/pl only. */
  const locale = effectiveWithin(surfaceLocale('imihigo'), ['en', 'pl']);
  const view = readRetainedImihigo();
  return <ScriptRun locale={locale} step="wrapping" as="div"><main>
    <ImihigoScreen view={view} locale={locale} compact={searchParams?.compact === '1'} />
  </main></ScriptRun>;
}
