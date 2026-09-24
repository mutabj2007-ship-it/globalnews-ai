import type { Metadata } from 'next';
import type { JSX } from 'react';
import { cookies } from 'next/headers';
import { ScriptRun } from '@/lib/typography/runBoundary';
import { LANGUAGE_COOKIE_NAME, SELECTABLE_LOCALES, isActiveLanguageCode } from '@/lib/i18n/languages';
import type { PolLocale } from '@/lib/politics/politicsStrings';
import { PoliticsScreen } from '@/components/politics/PoliticsScreen';
import { readPoliticsObservations } from '@/lib/politics/politicsReadModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * POLITICS — ALPHA PRODUCT OWNER VISUAL PREVIEW. NOT THE POLITICS ROUTE.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY A PREVIEW ADDRESS RATHER THAN `/politics`.
 *
 * There is no `/politics` route to reuse, and there is no Politics route contract to
 * violate — measured, not assumed: **`shared/src/politics` exists on zero refs in this
 * repository**, and no Politics frontend file exists on `main`,
 * `integration/alpha-convergence-2`, `beta/canonical-recovery-r1` or
 * `rc/rc2a-code-security-closure`. `MAIN-POLITICS-PLATFORM-1` was delivered as a candidate
 * package and never promoted into this tree.
 *
 * So the activation's own test applies — *"if route activation is currently data-gated,
 * create the narrowest `/politics-visual-preview`"* — and it is gated by something stronger
 * than a flag: G-POLITICS-CAP-1 measured Politics **6 ABSENT · 2 PARTIAL · 0 SUPPORTED**
 * with producer coverage **0 of 24**, and G-POLITICS-DATA-SOURCE-1 found **zero of the
 * seven observation classes data-ready**. Opening a live `/politics` on that evidence would
 * be claiming a surface the platform cannot yet supply.
 *
 * ── IT IS NOT A SECOND POLITICS IMPLEMENTATION ────────────────────────────
 *
 * It is the FIRST one, and it is built on the shared specialist platform rather than beside
 * it: `SpecialistHudLine` and `HUD_SLOTS` for the HUD grammar, R14's geometry caps, the
 * Spatial `sp-*` token family, and Part VIII's own vocabularies. When `/politics` opens,
 * these are the components it consumes; this file is a mount point that adds a preview
 * marker and subtracts nothing.
 *
 * ── ZERO PROVIDERS, AND NO AI ON LOAD ─────────────────────────────────────
 *
 * The module graph reachable from here performs no fetch. One cookie is read on the server
 * and the page renders. No GNews, no OpenAI, no `/analysis/news`, no Politics provider, and
 * no automatic summary — §9 of Part VIII makes ordinary browsing zero-AI, and the frame says
 * so to the reader rather than only obeying it.
 *
 * NOINDEX, AND ABSENT FROM NAVIGATION. `intelligenceModules.ts` carries no `politics` entry
 * at all, so there is nothing to make inert; nothing links here, and the Product Owner
 * reaches it by typing it.
 */
export const metadata: Metadata = {
  title: 'Politics Intelligence — Alpha visual preview',
  robots: { index: false, follow: false },
};

/**
 * THE PLATFORM LOCALE MECHANISM, NOT A SECOND ONE.
 *
 * The same two-step `/market` and the Economy preview use: read the platform language
 * cookie, accept it only if the deployment offers it, then intersect with
 * `SELECTABLE_LOCALES` so the value narrows to `DisplayLocale` without a cast. This
 * deployment offers EN and PL; a preview that widened that set would be previewing a
 * product we do not ship.
 */
function politicsLocale(): PolLocale {
  const cookie = cookies().get(LANGUAGE_COOKIE_NAME)?.value;
  const active = cookie && isActiveLanguageCode(cookie) ? cookie : 'en';
  return SELECTABLE_LOCALES.find((l) => l === active) ?? 'en';
}

export default async function PoliticsVisualPreviewPage(): Promise<JSX.Element> {
  const locale = politicsLocale();
  const read = await readPoliticsObservations();
  return (
    /*
      D7-AR-ADOPTION — `wrapping` is the step that satisfies both minimums on a frame that
      carries dense mono chrome and running prose, which this one does.
    */
    <ScriptRun locale={locale} step="wrapping" as="div">
      {/*
        THE GROUND COVERS THE DOCUMENT, NOT THE VIEWPORT.

        The screen is `min-h-screen`, which is right for a short page and wrong for a long
        one: past the fold the document background showed through as a pale band under the
        frame. The ground belongs to the page rather than to the screen component, so it is
        set here, once, on the element that actually wraps the whole route.
      */}
      <div className="min-h-screen bg-sp-bg">
        <PoliticsScreen locale={locale} read={read} />
      </div>
    </ScriptRun>
  );
}
