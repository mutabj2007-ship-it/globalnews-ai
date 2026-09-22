import { readElection } from '@/lib/evidence/retainedReaders';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import {
  LANGUAGE_COOKIE_NAME,
  SELECTABLE_LOCALES,
  isActiveLanguageCode,
} from '@/lib/i18n/languages';
import { ElectionEvidenceScreen } from '@/components/election/ElectionEvidenceScreen';
import type { ElectionLocale } from '@/lib/election/electionStrings';

export const metadata: Metadata = {
  title: 'Kenya Elections — retained evidence',
  robots: { index: false, follow: false },
};

function electionLocale(): ElectionLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  const selectable = SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
  return selectable === 'pl' ? 'pl' : 'en';
}

export default async function ElectionVisualPreviewCompactPage(): Promise<JSX.Element> {
  const locale = electionLocale();
  const result = await readElection(locale);
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <div style={{ minHeight: '100vh' }}>
        <ElectionEvidenceScreen locale={locale} compact={true} result={result} />
      </div>
    </ScriptRun>
  );
}
