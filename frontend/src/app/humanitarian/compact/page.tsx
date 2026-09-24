import { readHumanitarianObservations } from '@/lib/humanitarian/humanitarianRead';
import type { JSX } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { HumLocale } from '@/lib/humanitarian/humStrings';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import { HumanitarianCompactScreen } from '@/components/humanitarian/HumanitarianCompactScreen';
import { AlphaRetainedReportingDock } from '@/components/alpha/AlphaRetainedReportingDock';

/**
 * PART X · THE PHONE FRAME AT ITS OWN ENTRY.
 *
 * R14: "Phone is not a shrunken desktop." A separate entry is the accepted precedent
 * (`/economy/compact`) and it is what lets the compact frame be a real composition
 * rather than a media query over the desktop one.
 */
export const metadata: Metadata = {
  title: 'Humanitarian Intelligence — compact',
  robots: { index: false, follow: false },
};

/*
  THE THREE-SET MODEL, AND WHY THIS ROUTE READS THE COOKIE ONCE AND VIEWS IT TWICE.

  H wrote one accessor because in its lineage the platform language and the display
  locale were the same union. In THIS lineage they are two overlapping sets that
  neither contains the other, and `@/lib/i18n/languages` says so in as many words:
  LanguageCode has `sw` and `rw`; DisplayLocale has `de` and `pt`.

  So the cookie is read once and expressed in each type. NavBar and Footer take the
  platform `LanguageCode`, exactly as the other seven routes hand it to them;
  the Humanitarian screen takes `HumLocale` (= DisplayLocale), which is what its
  string catalogue is keyed on.

  NEITHER UNION IS WIDENED, and that is the point rather than an implementation
  detail: the CTO ruling recorded beside `SELECTABLE_LOCALES` is that DisplayLocale
  may be recovered only in a way that preserves the current visible EN/PL runtime.
  `SELECTABLE_LOCALES` is already the derived intersection — what this deployment
  offers, expressed in the shared contract's type — so this reuses that one registry
  instead of writing a second list that would agree with it only by discipline.

  H's behaviour is preserved exactly: the platform cookie, accepted only if the
  deployment offers it, else `en`. No selector, no second cookie, no new resolution
  order.
*/
function humLanguage(): LanguageCode {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  return cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
}

function humLocale(): HumLocale {
  const language = humLanguage();
  return SELECTABLE_LOCALES.find((l) => l === language) ?? 'en';
}

export default async function HumanitarianCompactPage(): Promise<JSX.Element> {
  const retainedRead = await readHumanitarianObservations();
  return (
    <ScriptRun locale={humLocale()} step="wrapping" as="div">
      {/*
        THE APPLICATION'S OWN CHROME, NOT A SECOND ONE. Seven routes already mount
        NavBar and Footer with the resolved language; Humanitarian is a capability
        inside this product, not a surface beside it. Mounting NavBar also gives the
        route the platform's language selector — the defect that kept the Spatial
        shell unusable at any locale was exactly its absence.
      */}
      <NavBar language={humLanguage()} />
      <HumanitarianCompactScreen locale={humLocale()} retainedRead={retainedRead} />
      <AlphaRetainedReportingDock domain="humanitarian" />
      <Footer language={humLanguage()} />
    </ScriptRun>
  );
}
