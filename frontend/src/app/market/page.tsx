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
import { MarketScreen } from '@/components/market/MarketScreen';
import { AlphaRetainedReportingDock } from '@/components/alpha/AlphaRetainedReportingDock';

/**
 * PART VII · THE MARKET ROUTE.
 *
 * NO FIXTURE ROUTE EXISTS BESIDE THIS ONE, and that is deliberate. Part VII's boards
 * label themselves "ALL VALUES ILLUSTRATIVE — NOT PRODUCTION DATA"; giving those numbers
 * a URL would put invented prices one omitted flag away from a reader, which is the exact
 * failure the activation calls a FAIL. Economy ships four `fixture-demo` routes; Market
 * ships none, and the divergence is a decision rather than an omission.
 *
 * ── THE READ HAPPENS HERE, ON THE SERVER ──────────────────────────────────
 *
 * `readMarketObservations()` is awaited in this Server Component, so the observations are
 * already in the HTML when it reaches the browser. A reader's page load costs ZERO
 * requests for Market data: no client fetch, no hydration-time call, no polling. That is
 * the property the readiness substrate proved and this surface keeps rather than re-earns
 * — and it is why the cost boundary holds by construction instead of by discipline.
 *
 * The read touches INTERNAL STORED OBSERVATIONS ONLY. There is no provider URL anywhere
 * in the Market frontend, so no page load can reach GNews, OpenAI, `/analysis/news`, or a
 * Market provider, whatever a future edit does to the screen.
 *
 * ── THE LOCALE MECHANISM IS THE PLATFORM'S ────────────────────────────────
 *
 * Read the cookie once, express it in each type — the pattern this lineage already uses
 * for Humanitarian, reused rather than reinvented. `LanguageCode` carries `sw` and `rw`;
 * `DisplayLocale` carries `de` and `pt`; neither contains the other and neither is
 * widened. `SELECTABLE_LOCALES` is already the derived intersection, so the chrome takes
 * the platform language and the Market catalogue takes the display locale.
 */
export const metadata: Metadata = {
  title: 'Market Intelligence',
  /**
   * STILL `noindex` — the entry point is prepared, not opened. Home navigation stays off
   * until the surface can consume stored observations, and an indexable page would be a
   * public claim that it already can.
   */
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

export default async function MarketPage(): Promise<JSX.Element> {
  const read = await readMarketObservations();
  return (
    <ScriptRun locale={mktLocale()} step="wrapping" as="div">
      <NavBar language={mktLanguage()} />
      <MarketScreen locale={mktLocale()} read={read} />
      <AlphaRetainedReportingDock domain="market" />
      <Footer language={mktLanguage()} />
    </ScriptRun>
  );
}
