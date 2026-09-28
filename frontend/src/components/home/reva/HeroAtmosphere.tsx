import type { JSX } from 'react';

/**
 * HOME REV A COLOR RECONCILIATION — THE CURRENT HOME HERO FIELD, REUSED.
 *
 * The layer stack below is the current Home's premium Hero atmosphere, taken
 * VERBATIM from `BetaHero.tsx` (the retired-from-Home Hero, kept on disk):
 *
 *   1. deep blue intelligence base   linear #00101f → #001729 → #04223f → #020d1c
 *   2. cyan/blue globe bloom         rgba(20,124,214,0.42)
 *   3. brighter cyan core            rgba(64,182,255,0.30)
 *   4. restrained violet counterweight rgba(124,92,246,0.22), top-left
 *   5. faint 96 px grid              rgba(125,211,252,0.045 / 0.035)
 *   6. lower teal/blue depth         rgba(2,52,84,0.40)
 *   7. vignette                      rgba(2,6,12,0.62)
 *
 * The ONLY change is scope: BetaHero bled the field to the full viewport
 * (`w-screen`); beside the Rev A product rail it covers the Hero cell and
 * bleeds only into the content column's own side padding, so it never paints
 * under the rail. Its bottom edge fades out (a mask on the container, not a
 * change to any layer) so the field dissolves into What's happening instead of
 * ending in a hard line. No new palette, still dark and premium.
 */
export function HeroAtmosphere(): JSX.Element {
  return (
    <div aria-hidden="true" data-home-hero-atmosphere="" className="pointer-events-none absolute inset-y-0 -left-4 -right-4 -z-20 [mask-image:linear-gradient(to_bottom,#000_72%,transparent_100%)] md:-left-10 md:-right-10">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#00101f_0%,#001729_34%,#04223f_58%,#020d1c_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_86%_130%_at_58%_46%,rgba(20,124,214,0.42),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_44%_74%_at_56%_44%,rgba(64,182,255,0.30),transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_64%_at_6%_20%,rgba(124,92,246,0.22),transparent_70%)]" />
      <div className="absolute inset-0 opacity-[0.40] [background-image:repeating-linear-gradient(90deg,rgba(125,211,252,0.045)_0_1px,transparent_1px_96px),repeating-linear-gradient(0deg,rgba(125,211,252,0.035)_0_1px,transparent_1px_96px)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(2,52,84,0.40),transparent_86%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_36%,rgba(2,6,12,0.62)_100%)]" />
    </div>
  );
}
