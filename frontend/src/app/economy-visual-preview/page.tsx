import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { EconomyLocale } from '@/lib/economy/strings';
import { EconomyScreen } from '@/components/economy/EconomyScreen';
import { economySubjectFromRead } from '@/lib/economy/economyRetainedSubject';
import { AlphaVisualPreviewMarker } from '@/components/economy/AlphaVisualPreview';
import { economyCapabilityFrom, readEconomyObservations } from '@/lib/economy/economyObservationRead';

/**
 * Noindex Economy preview, linked by the canonical intelligence-module registry.
 * `/economy` remains governed separately; this route does not change its eligibility.
 *
 * The server reads display locale and performs an INTERNAL retained-reader fetch to
 * this deployment's backend. Displayable retained observations populate the accepted
 * EconomyScreen slots; otherwise the existing absence frame renders. No fixture fallback.
 *
 * Page load performs zero EXTERNAL provider/AI acquisition. Source disclosure opens
 * retained detail; only explicit citation navigation opens the publisher's document.
 * The global Ask AI dock submits through its existing engine only on explicit user submit.
 */
export const metadata: Metadata = {
  title: 'Economy Intelligence — Alpha visual preview',
  robots: { index: false, follow: false },
};

/**
 * THE PLATFORM LOCALE MECHANISM, NOT A SECOND ONE.
 *
 * Byte-for-byte the resolution canonical's Economy routes use: read the platform language
 * cookie, accept it only if the deployment currently offers it, else `en`. This deployment
 * offers EN and PL, and `isActiveLanguageCode` is what says so — a preview surface that
 * widened that set would be previewing a product we do not ship.
 */
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

export default async function EconomyVisualPreviewPage(): Promise<JSX.Element> {
  const locale = economyLocale();
  const read = await readEconomyObservations();
  const subject = economySubjectFromRead(read, locale);
  const primaryObservation =
    subject.primarySeries?.latest.kind === 'OBSERVATION'
      ? subject.primarySeries.latest.observation
      : undefined;
  const revisionVintages = subject.primarySeries ? [subject.primarySeries.latest] : undefined;
  const revisionEffects =
    primaryObservation === undefined
      ? undefined
      : {
          [`${primaryObservation.seriesId}:${primaryObservation.vintage}`]:
            'Current retained vintage · no earlier revision is retained.',
        };
  const retained = read.kind === 'OBSERVATIONS' ? read.observations[0] : undefined;
  const timeline =
    retained === undefined
      ? undefined
      : [
          {
            id: `rw-nisr-cpi-${retained.periodId}`,
            dateLabel: retained.provenance.publicationDateStated,
            body: `NISR published headline CPI at ${retained.value}${retained.unit === 'PERCENT' ? '%' : ` ${retained.unit}`} for ${retained.periodId}.`,
            meta: 'CURRENT RETAINED VINTAGE',
            isCurrent: true,
          },
        ];
  return (
    /*
      D7-AR-ADOPTION — the step canonical's Economy routes declare, for the same reason:
      the frame carries both dense HUD chrome and running prose, and `wrapping` is the step
      that satisfies both leading minimums.
    */
    <ScriptRun locale={locale} step="wrapping" as="div">
      <main style={{ minHeight: '100vh' }}>
        <AlphaVisualPreviewMarker
          locale={locale}
          observedGeography={retained?.geographyLabel}
        />
        {/*
          THE ONE REAL FIGURE. The capability below is DERIVED from this read rather
          than declared, so it cannot say OBSERVED unless something was observed. The
          read happens in this SERVER component, so the browser issues no request on
          load and no provider is contacted at any point.
        */}
        <EconomyScreen
          subject={subject}
          locale={locale}
          data={economyCapabilityFrom(read)}
          retainedObservation={retained}
          revisionVintages={revisionVintages}
          revisionEffects={revisionEffects}
          timeline={timeline}
        />
      </main>
    </ScriptRun>
  );
}
