import { readPolitics } from '@/lib/evidence/retainedReaders';
import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import {
  LANGUAGE_COOKIE_NAME,
  SELECTABLE_LOCALES,
  isActiveLanguageCode,
} from '@/lib/i18n/languages';
import { PoliticsEvidenceScreen } from '@/components/politics/PoliticsEvidenceScreen';

export const metadata: Metadata = {
  title: 'Politics — retained evidence',
  robots: { index: false, follow: false },
};

function politicsLocale(): 'en' | 'pl' {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  return SELECTABLE_LOCALES.find((l) => l === active) === 'pl' ? 'pl' : 'en';
}

export default async function PoliticsVisualPreviewPage(): Promise<JSX.Element> {
  const locale = politicsLocale();
  const result = await readPolitics();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <div className="min-h-screen bg-sp-bg">
        <PoliticsEvidenceScreen locale={locale} result={result} />
      </div>
    </ScriptRun>
  );
}
