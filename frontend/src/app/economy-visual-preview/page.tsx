import { RetainedEconomySummary } from '@/components/economy/RetainedEconomySummary';
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
 * ════════════════════════════════════════════════════════════════════════════
 * ECONOMY — ALPHA PRODUCT OWNER VISUAL PREVIEW. NOT THE ECONOMY ROUTE.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS IS NOT `/economy`, AND WHY THAT IS NOT A TECHNICALITY.
 *
 * `/economy` is governed. `shared/src/economy/route-eligibility.ts` holds eight conditions
 * and a predicate, and today the route is NOT ELIGIBLE on three of them —
 * `E1_PUBLISHABLE_OBSERVATION`, `E4A_SOURCE_REGISTERED` and
 * `E4B_SOURCE_ACTIVATED_WITH_RIGHTS`. Every one of the three is a DATA condition. Main's
 * accepted entry states the consequence in a sentence worth quoting because it is the
 * whole reason this file exists: *"not one of the eight is visual readiness."*
 *
 * A second guard holds the same door from the other side. `b4aEconomySubstrate.spec.ts`
 * asserts, in its `B4-A · what was NOT activated` block:
 *
 *     expect(existsSync(join(REPO, 'frontend', 'src', 'app', 'economy'))).toBe(false);
 *
 * That is a TRIPWIRE, and Main's entry is explicit about how it may be discharged: it is
 * *"retired and replaced by a presence assertion with the same teeth, never deleted"* —
 * and only when the seven transition conditions hold. Creating `app/economy/` to inspect a
 * layout would trip it, and deleting the assertion to stop it tripping is the exact move
 * that entry forbids.
 *
 * So this route is somewhere else entirely, and the contract is untouched: `app/economy`
 * still does not exist, the eligibility predicate still returns NOT ELIGIBLE, and the
 * tripwire still passes unchanged. Nothing here is a claim that Economy is ready.
 *
 * ── IT IS NOT A SECOND ECONOMY IMPLEMENTATION ─────────────────────────────
 *
 * Every import below is the one the eventual `/economy` will use, and canonical's own
 * `app/economy/page.tsx` at `3db5a09` composes these same four: `EconomyScreen`,
 * `PRODUCTION_SHAPED_SUBJECT`, `ECONOMY_DATA_CAPABILITY` and the platform locale read.
 * This file adds a preview marker and subtracts nothing. When the route opens, what a
 * reader sees is what is on this page, because it is rendered by the same components from
 * the same subject under the same capability.
 *
 * ── FIXTURES ARE NOT REACHABLE FROM HERE ──────────────────────────────────
 *
 * `FIXTURE_DATA_CAPABILITY` is not imported, and `data` is passed explicitly rather than
 * defaulted, so there is no omission, flag or default parameter by which this page could
 * arrive at the design's illustrative Rwanda, Kenya or Poland figures.
 *
 * THE CAPABILITY IS NO LONGER A LITERAL, AND IT NO LONGER READS `NO_OBSERVATION_SOURCE`.
 * It is `economyCapabilityFrom(read)` — the answer to the retained-observation read —
 * so it says OBSERVED exactly when something was observed and NO_OBSERVATION_SOURCE
 * otherwise. Neither branch can reach a fixture: no branch of that function returns one.
 *
 * ── ZERO EXTERNAL CALLS ───────────────────────────────────────────────────
 *
 * The module graph reachable from this file performs no fetch. It reads one cookie on the
 * server and renders. No GNews, no OpenAI, no `/analysis/news`, no TED, no Eurostat, no
 * GUS, no provider of any kind — on load or on any interaction this page offers.
 *
 * NOINDEX, AND ABSENT FROM NAVIGATION. `intelligenceModules.ts` keeps Economy at
 * `state: 'preview'` with no `destination`, and `isModuleNavigable` requires both `active`
 * and a destination, so the Home tile stays inert. Nothing links here; the Product Owner
 * reaches it by typing it.
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
  const subject = economySubjectFromRead(read);
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
        {retained ? <RetainedEconomySummary observation={retained} locale={locale} /> : <EconomyScreen
          subject={subject}
          locale={locale}
          data={economyCapabilityFrom(read)}
          retainedObservation={retained}
          revisionVintages={revisionVintages}
          revisionEffects={revisionEffects}
          timeline={timeline}
        />}
      </main>
    </ScriptRun>
  );
}
