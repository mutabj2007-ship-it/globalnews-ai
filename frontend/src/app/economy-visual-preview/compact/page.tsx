import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { EconomyLocale } from '@/lib/economy/strings';
import { EconomyCompactScreen } from '@/components/economy/compact/EconomyCompactScreen';
import { PRODUCTION_SHAPED_SUBJECT } from '@/lib/economy/productionSubject';
import { AlphaVisualPreviewMarker } from '@/components/economy/AlphaVisualPreview';
import { RetainedObservationPanel } from '@/components/economy/RetainedObservationPanel';
import { economyCapabilityFrom, readEconomyObservations } from '@/lib/economy/economyObservationRead';

/**
 * ECONOMY — ALPHA PRODUCT OWNER VISUAL PREVIEW, COMPACT.
 *
 * The desktop preview's header explains why this is not `/economy`; every word of it
 * applies here and is not repeated. What is worth saying twice is the reason the compact
 * frame gets its own preview rather than being inspected by narrowing the desktop one:
 * Part VI's compact model is *"not a scaled desktop"*. Its vertical order is
 * assessment → indicator rail → attention feed, it has a horizontal rail the desktop frame
 * does not have, and its disclosure is a detented sheet rather than a grid column. Those
 * are different compositions, so they are different inspections.
 *
 * The frame pins no width. It measures itself across 375–430 exactly as it will in
 * production, which is what makes a browser measurement at 390px worth anything.
 */
export const metadata: Metadata = {
  title: 'Economy Intelligence — Alpha visual preview, compact',
  robots: { index: false, follow: false },
};

function economyLocale(): EconomyLocale {
  /*
    TWO NARROWINGS, NOT ONE — AND THIS LINEAGE NEEDS BOTH.

    Canonical's Economy routes return the cookie straight out of `isActiveLanguageCode`,
    because at C55 that guard narrowed to `DisplayLocale`. On this lineage it narrows to
    `LanguageCode`, which admits `sw` and `rw` — source-intelligence languages with no
    display contract — so the cookie is then intersected with `SELECTABLE_LOCALES`, the
    deployment registry. `EconomyLocale` IS `DisplayLocale`, so the second step is what
    makes the value assignable without a cast, and a cast here would have asserted exactly
    the membership the type system had just refused.

    This is the same two-step `/market` already uses. It is not an Economy mechanism: both
    surfaces read the one decision the platform made in `app/layout.tsx`.
  */
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  return SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
}

export default async function EconomyVisualPreviewCompactPage(): Promise<JSX.Element> {
  const locale = economyLocale();
  const read = await readEconomyObservations();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AlphaVisualPreviewMarker locale={locale} />
        {/*
          THE SAME REAL FIGURE AT COMPACT WIDTH. The panel wraps rather than scrolling —
          the provenance grid collapses to one column below 240px of free width — so no
          chrome budget moves and nothing is added to the frozen top bar.
        */}
        <RetainedObservationPanel read={read} />
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <EconomyCompactScreen
            subject={PRODUCTION_SHAPED_SUBJECT}
            locale={locale}
            data={economyCapabilityFrom(read)}
          />
        </div>
      </main>
    </ScriptRun>
  );
}
