import { readElection } from '@/lib/evidence/retainedReaders';
import { bindElection } from '@/lib/evidence/electionBinding';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import { ElectionPreviewScreen } from '@/components/election/ElectionPreviewScreen';
import type { ElectionLocale } from '@/lib/election/electionStrings';

/** Plan B: accepted frame, first-party retained read behind the existing fail-closed gate. */
export const metadata: Metadata = {
  title: 'Election Intelligence — provider-free preview (compact)',
  robots: { index: false, follow: false },
};

/** The platform locale mechanism, not a second one. EN/PL, the established baseline. */
function electionLocale(): ElectionLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  const selectable = SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
  return selectable === 'pl' ? 'pl' : 'en';
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
