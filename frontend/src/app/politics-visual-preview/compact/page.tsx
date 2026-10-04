import type { Metadata } from 'next';
import type { JSX } from 'react';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import type { PolLocale } from '@/lib/politics/politicsStrings';
import { PoliticsCompactScreen } from '@/components/politics/PoliticsCompactScreen';
import { readPoliticsObservations } from '@/lib/politics/politicsReadModel';

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
  /* T2 — the display-locale authority + effective-locale rule (was the EN/PL clamp). */
  return surfaceLocale('politics').effective;
}

export default async function PoliticsVisualPreviewCompactPage(): Promise<JSX.Element> {
  const locale = politicsLocale();
  const read = await readPoliticsObservations();
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
        <PoliticsCompactScreen locale={locale} read={read} />
      </div>
    </ScriptRun>
  );
}
