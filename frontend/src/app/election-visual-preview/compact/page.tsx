import { readElection } from '@/lib/evidence/retainedReaders';
import { bindElection } from '@/lib/evidence/electionBinding';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { effectiveWithin } from '@/lib/i18n/surfaceLocale';
import { ElectionPreviewScreen } from '@/components/election/ElectionPreviewScreen';
import type { ElectionLocale } from '@/lib/election/electionStrings';

/** Plan B: accepted frame, first-party retained read behind the existing fail-closed gate. */
export const metadata: Metadata = {
  title: 'Election Intelligence — provider-free preview (compact)',
  robots: { index: false, follow: false },
};

/** The platform locale mechanism, not a second one. EN/PL, the established baseline. */
function electionLocale(): ElectionLocale {
  /* T2 — the effective locale of the surface; the catalogue authors en/pl, so the rule can only
     yield one of them (any other selection renders English with the declared notice). */
  return effectiveWithin(surfaceLocale('election'), ['en', 'pl']);
}

export default async function ElectionVisualPreviewCompactPage(): Promise<JSX.Element> {
  const locale = electionLocale();
  const binding = bindElection(await readElection(locale));
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <main style={{ minHeight: '100vh' }}>
        <ElectionPreviewScreen locale={locale} compact={true} binding={binding} />
      </main>
    </ScriptRun>
  );
}
