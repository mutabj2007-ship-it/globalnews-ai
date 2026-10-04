import { surfaceLocale } from '@/lib/i18n/displayLocale.server';
import { BetaHomeHeader } from '@/components/home/BetaHomeHeader';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { Footer } from '@/components/layout/Footer';
import { MyIntelligenceClient } from '@/components/my-intelligence/MyIntelligenceClient';

/**
 * /my-intelligence — the signed-in personal intelligence workspace.
 *
 * ── THE CHROME IS BORROWED, NOT REDRAWN ──────────────────────────────────
 *
 * This is Home's exact header composition and for the same reason: at and
 * above `lg`, `BetaHomeHeader` is the R6 header the Product Owner approved,
 * and below `lg` the existing `NavBar` chrome serves unchanged, which is why
 * it is WRAPPED rather than replaced. `MobileBottomNav` renders below `lg`,
 * so it is present at 768 as well as on phones — which is why the selection
 * rail is positioned above it rather than over it.
 *
 * NO BOTTOM TAB IS HIGHLIGHTED HERE. `/my-intelligence` is a secondary route,
 * not a fifth destination: the four Beta destinations are unchanged, the
 * five-tab concept is closed as reference only, and nothing in this file adds
 * a navigation item anywhere.
 *
 * ── STATE PREVIEWS ───────────────────────────────────────────────────────
 *
 * `?state=` renders one of the approved states so the Product Owner can
 * inspect them during development. It is a REVIEW affordance on a route that
 * does not yet exist in production, and it is read here rather than inside the
 * client so that nothing about it leaks into the page's own behaviour. It
 * carries no data and changes nothing but which state renders.
 */
export default function MyIntelligencePage({
  searchParams,
}: {
  searchParams?: { state?: string };
}): JSX.Element {
  const language = surfaceLocale('myIntelligence').language;

  const state = searchParams?.state;

  return (
    <>
      <BetaHomeHeader language={language} isHome={false} />
      {/*
        PREMIUM WORKSPACE R1 · D3 — below lg the page carries its own workspace
        header (menu · My Intelligence · search · avatar), rendered by the
        client, instead of the global phone NavBar. The desktop header is
        unchanged.
      */}
      <MyIntelligenceClient
        language={language}
        forceFirstVisit={state === 'first-visit'}
        forceBoundaryFailure={state === 'degraded'}
        forceEmpty={state === 'empty'}
        forceError={state === 'error'}
        forceSignedOut={state === 'signed-out'}
      />
      <Footer language={language} />
      <MobileBottomNav language={language} />
    </>
  );
}
