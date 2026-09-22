import type { JSX } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { LanguageCode } from '@globalnews-ai/shared';
import { EnergyShell } from '@/components/energy/EnergyShell';
import { readEnergyObservations } from '@/lib/energy/energyReadModel';
import { ENERGY_GOVERNED_FRAME } from '@/lib/energy/energyGoverned';
import { energyStateFromSearchParams } from '@/lib/energy/energyUrl';
import { energyStrings, type EnergyLocale } from '@/lib/energy/energyStrings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H01 — `/energy`, AND THERE IS NO SECOND ENERGY ROUTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   "implement ONE ROUTE FAMILY (`/energy`) with substrate, subject and window
 *    as URL-encoded state — NOT /energy-a, /energy-b, /energy-c, /energy-d."
 *
 * The 25 board states resolve to one shell, three substrates, one HUD, one
 * drawer, one lens, one sheet and two overlays. This file is the only Energy
 * page in the tree, and `energyVisualFrame.spec.ts` asserts that by walking the
 * route directory rather than by trusting this comment.
 *
 * ── ZERO PROVIDERS AND ZERO MODELS, BY CONSTRUCTION ──────────────────────
 *
 * This Server Component reads only the internal retained Energy endpoint.
 * The reader imports no provider, producer, scheduler or model.
 *
 * ── WHY THE PAGE IS `noindex` ────────────────────────────────────────────
 *
 * The Engine card for Energy is COMING SOON and this lane does not change it —
 * card state is an acceptance decision, not an implementation one. An
 * indexable page would be a public claim that Energy Intelligence is open,
 * which is precisely the claim the card is currently and correctly refusing to
 * make. Market's route made the same choice for the same reason.
 */
export const metadata: Metadata = {
  title: 'Energy Intelligence',
  robots: { index: false, follow: false },
};

function energyLanguage(): LanguageCode {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  return cookie !== undefined && isActiveLanguageCode(cookie) ? cookie : 'en';
}

/**
 * Read the cookie once, express it in each type. `LanguageCode` carries `sw`
 * and `rw`; `DisplayLocale` carries `de` and `pt`; neither contains the other,
 * and `SELECTABLE_LOCALES` is already the derived intersection. The pattern is
 * the platform's, reused rather than reinvented.
 */
function energyLocale(): EnergyLocale {
  const language = energyLanguage();
  return (SELECTABLE_LOCALES.find((locale) => locale === language) ?? 'en') as EnergyLocale;
}

export default async function EnergyPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<JSX.Element> {
  const params = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value) && value.length > 0) params.set(key, value[0]);
  });

  const urlState = energyStateFromSearchParams(params);
  const locale = energyLocale();

  /*
    ALPHA DATA-HONESTY CORRECTION.

    The public Home Intelligence Engine links directly to /energy. That makes
    this route a reader-reachable Alpha surface, not an inspector-only design
    address. A query parameter must therefore never be able to replace governed
    absence with illustrative design values: URLs are user-controlled, can be
    shared, bookmarked and indexed independently of the Home card, and a banner
    is not an authorization boundary.

    The design fixture module remains in source for visual regression tests and
    Claude Design comparison, but this public route always renders the governed
    frame. No provider or model is activated by this correction.
  */
  const data = { ...ENERGY_GOVERNED_FRAME, retainedRead: await readEnergyObservations() };

  return (
    <ScriptRun locale={locale} step="wrapping" as="div">
      <EnergyShell data={data} strings={energyStrings(locale)} urlState={urlState} locale={locale} />
    </ScriptRun>
  );
}
