import type { JSX } from 'react';
import type { Metadata } from 'next';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import type { LanguageCode } from '@globalnews-ai/shared';
import { NavBar } from '@/components/navigation/NavBar';
import { Footer } from '@/components/layout/Footer';
import type { MktLocale } from '@/lib/market/mktStrings';
import { readMarketObservations } from '@/lib/market/mktReadModel';
import { readMarketProcurement } from '@/lib/market/mktProcurementRead';
import { MarketCompactScreen } from '@/components/market/MarketCompactScreen';

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
  /* T2 — the display-locale authority + effective-locale rule (was the EN/PL clamp). */
  return surfaceLocale('market').language;
}

function mktLocale(): MktLocale {
  const language = mktLanguage();
  return surfaceLocale('market').effective;
}

export default async function MarketCompactPage(): Promise<JSX.Element> {
  const [read, procurement] = await Promise.all([readMarketObservations(), readMarketProcurement()]);
  return (
    <ScriptRun locale={mktLocale()} step="wrapping" as="div">
      <NavBar language={mktLanguage()} />
      <MarketCompactScreen locale={mktLocale()} read={read} procurement={procurement} />
      <Footer language={mktLanguage()} />
    </ScriptRun>
  );
}
