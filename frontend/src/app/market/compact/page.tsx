import type { JSX } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import {
  LANGUAGE_COOKIE_NAME,
  SELECTABLE_LOCALES,
  isActiveLanguageCode,
} from '@/lib/i18n/languages';
import type { LanguageCode } from '@globalnews-ai/shared';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import type { MktLocale } from '@/lib/market/mktStrings';
import { readMarketObservations } from '@/lib/market/mktReadModel';
import { MarketCompactScreen } from '@/components/market/MarketCompactScreen';
import { AlphaRetainedReportingDock } from '@/components/alpha/AlphaRetainedReportingDock';

/**
 * THE COMPACT ENTRY — and this route used to be the defect.
 *
 * It rendered `MarketScreen`: the desktop composition, byte for byte. Both routes served
 * `data-mkt="screen"`, 33 domain nodes and 19,106 characters of identical root HTML. The
 * header here argued that one composition serves both widths — but Humanitarian's compact
 * route in the same programme is genuinely distinct, so the pattern existed and this route
 * missed it. Every mobile-viewport row of every QA matrix was exercising the desktop
 * screen at 390px while reporting on the compact one.
 *
 * The compact composition is now a reader surface too, and the ordering rule the
 * activation names is what shapes it: PRIMARY OBSERVATIONS BEFORE SECONDARY METADATA.
 * The value, its unit and its period come first; provenance is one tap away rather than
 * four rows down; the capability detail is last, because a reader who came to see the
 * market did not come to read a provider allowlist.
 */
export const metadata: Metadata = {
  title: 'Market Intelligence — compact',
  robots: { index: false, follow: false },
};

function mktLanguage(): LanguageCode {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  return cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
}

function mktLocale(): MktLocale {
  const language = mktLanguage();
  return SELECTABLE_LOCALES.find((l) => l === language) ?? 'en';
}

export default async function MarketCompactPage(): Promise<JSX.Element> {
  const read = await readMarketObservations();
  return (
    <ScriptRun locale={mktLocale()} step="wrapping" as="div">
      <NavBar language={mktLanguage()} />
      <MarketCompactScreen locale={mktLocale()} read={read} />
      <AlphaRetainedReportingDock domain="market" />
      <Footer language={mktLanguage()} />
    </ScriptRun>
  );
}
