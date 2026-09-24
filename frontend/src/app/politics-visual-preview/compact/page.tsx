import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { PolLocale } from '@/lib/politics/politicsStrings';
import { PoliticsCompactScreen } from '@/components/politics/PoliticsCompactScreen';
import { AlphaRetainedReportingDock } from '@/components/alpha/AlphaRetainedReportingDock';

/**
 * POLITICS — ALPHA PRODUCT OWNER VISUAL PREVIEW, COMPACT.
 *
 * The desktop preview's header explains why this is a preview address; every word applies
 * and is not repeated. What is worth saying twice is why the phone gets its own inspection
 * rather than being judged by narrowing the desktop one: R14's phone row is a *"single
 * column, attention/data-first"* with *"detents PEEK/HALF/FULL/WORKSPACE, replacement
 * sheets"*, and the desktop row is three capped zones with a resident context rail. Those
 * are different compositions, so they are different inspections.
 *
 * The frame pins no width. It measures itself across 375–430 exactly as it will in
 * production, which is what makes a browser measurement at 390px worth anything.
 */
export const metadata: Metadata = {
  title: 'Politics Intelligence — Alpha visual preview, compact',
  robots: { index: false, follow: false },
};

function politicsLocale(): PolLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  return SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
}

export default function PoliticsVisualPreviewCompactPage(): JSX.Element {
  const locale = politicsLocale();
  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      {/*
        THE GROUND COVERS THE DOCUMENT, NOT THE VIEWPORT.

        The screen is `min-h-screen`, which is right for a short page and wrong for a long
        one: past the fold the document background showed through as a pale band under the
        frame. The ground belongs to the page rather than to the screen component, so it is
        set here, once, on the element that actually wraps the whole route.
      */}
      <div className="min-h-screen bg-sp-bg">
        <PoliticsCompactScreen locale={locale} />
        <AlphaRetainedReportingDock domain="politics" />
      </div>
    </ScriptRun>
  );
}
