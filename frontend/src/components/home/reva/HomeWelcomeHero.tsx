import type { JSX } from 'react';
import { Globe2, Map as MapIcon, MessagesSquare } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroGlobe } from '@/components/home/HeroGlobe';
import { HomeComposer } from './HomeComposer';
import { HeroNewSince } from './HeroReturningState';
import { HeroAtmosphere } from './HeroAtmosphere';

/**
 * HOME WELCOME & DISCOVERY R1 REV A — THE HERO.
 *
 * Authority: VISUAL_SPEC (geometry, world visual), COMPONENTS (composer,
 * routes), COPY_EN_PL, REV_A_DELTA row 10 (H1 60 / globe 470 at 1440 with the
 * rail; the globe caption is hidden because Open Map carries the handoff).
 *
 * - ONE H1, real server-rendered text (SEO_CONTENT_HIERARCHY; PERFORMANCE_NOTES:
 *   the LCP element is the text block, not the globe).
 * - ONE primary Ask composer and exactly three routes; no other primary CTA.
 * - The world visual is the CURRENT governed raster (`HeroGlobe`,
 *   /images/hero-globe-night.png). §6 ASSET HOLD: the older approved hero
 *   visual replaces it only when identified; no markers, density or events.
 *   The whole globe is ONE link to /map named "Open World Map".
 * - Signed in (D3): a truthful New-since chip below the routes. (DENSITY R1
 *   removed the greeting and the eyebrow label to tighten the Hero.)
 *
 * The globe is CROPPED on the x axis (overflow-x: clip on its own wrapper), never
 * allowed to widen the page: VISUAL_SPEC phone "300, cropped right".
 *
 * COLOR RECONCILIATION (CTO): the Hero wears the CURRENT Home atmosphere
 * (HeroAtmosphere, verbatim BetaHero layers), line two of the H1 keeps the
 * cyan → teal accent, and the three routes keep their blue / violet-indigo /
 * teal product-entry families. Geometry is unchanged.
 *
 * The retired Hero surfaces (the gold "Go further / Plans coming soon" card and
 * the three coloured CTA tiles) do not exist in Rev A: no price, no plans.
 */
export function HomeWelcomeHero({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.hero;
  /*
    HOME REV A COLOR RECONCILIATION — the three routes keep Rev A's pill geometry
    and wear the CURRENT Home's product-entry families, verbatim from BetaHero:
    Explore World blue #0a6bd6 → #0c42a2, Ask GlobalNewsAI violet/indigo
    #412d9f → #1f328a, Open Map teal/green #0b8d6a → #037050 (not Watch mint).
    White text on each keeps contrast; focus rings are the existing ones.
  */
  const route =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-[transform,box-shadow] hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:px-4';
  const ROUTE_EXPLORE = 'bg-[linear-gradient(105deg,#0a6bd6_0%,#0c42a2_100%)] shadow-[0_14px_32px_-18px_rgba(10,107,214,0.95)] focus-visible:ring-sky-300/60';
  const ROUTE_ASK = 'bg-[linear-gradient(105deg,#412d9f_0%,#1f328a_100%)] shadow-[0_14px_32px_-18px_rgba(65,45,159,0.95)] focus-visible:ring-violet-300';
  const ROUTE_MAP = 'bg-[linear-gradient(105deg,#0b8d6a_0%,#037050_100%)] shadow-[0_14px_32px_-18px_rgba(11,141,106,0.95)] focus-visible:ring-teal-300';

  return (
    <section aria-labelledby="home-hero-heading" data-home-hero="" className="relative isolate pb-8 pt-6 md:pt-10 lg:pb-10 lg:pt-12">
      <HeroAtmosphere />
      {/* The world visual: behind the text, one link to /map, CROPPED on the x axis only (never widens the page). */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-x-clip">
      <a
        href="/map"
        aria-label={t.globeLabel}
        title={t.globeLabel}
        data-home-hero-globe=""
        className="pointer-events-auto absolute -right-[92px] -top-2 block h-[300px] w-[300px] rounded-full opacity-90 [mask-image:radial-gradient(circle_at_50%_50%,#000_62%,transparent_72%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] md:-right-10 md:top-2 md:h-[420px] md:w-[420px] lg:right-0 lg:top-4 lg:h-[470px] lg:w-[470px] lg:opacity-100 gn-xl:h-[560px] gn-xl:w-[560px]"
      >
        <HeroGlobe />
      </a>
      </div>

      <div className="relative max-w-[640px]">
        {/* DENSITY R1 (Product Owner): the Hero opens directly on the H1 — no "Welcome back" line and no eyebrow label. */}
        <h1
          id="home-hero-heading"
          className="font-display text-[34px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white min-[380px]:text-[38px] md:text-[60px] gn-xl:text-[72px]"
        >
          {/* The current Home identity: line one white, line two the existing cyan → teal treatment (BetaHero). */}
          <span className="block">{t.titleA}</span>
          <span data-home-hero-accent="" className="block bg-[linear-gradient(90deg,#5abff5_0%,#4fd8e6_44%,#5df9e1_74%,#61fcea_100%)] -mb-[0.06em] bg-clip-text pb-[0.06em] text-transparent [text-shadow:0_0_36px_rgba(70,220,230,0.28)]">
            {t.titleB}
          </span>
        </h1>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-[#cfe2f2] md:max-w-none md:text-[18px]">{t.sub}</p>

        <HomeComposer
          placeholder={t.composerPlaceholder}
          ariaLabel={t.composerAria}
          askLabel={t.ask}
          note={t.note}
          stagedTemplate={t.staged}
        />

        <div className="mt-4 grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-2.5">
          <a href="#whats-happening-now" data-home-route="explore" className={`${route} ${ROUTE_EXPLORE}`}>
            <Globe2 aria-hidden="true" className="hidden h-[18px] w-[18px] text-white md:block" />
            {t.exploreWorld}
          </a>
          {/* INTERACTIONS: "Ask GlobalNewsAI → /ask idle" — a real link, 0 AI. */}
          <a href="/ask" data-home-route="ask" className={`${route} ${ROUTE_ASK}`}>
            <MessagesSquare aria-hidden="true" className="hidden h-[18px] w-[18px] text-white md:block" />
            {t.askGlobalNews}
          </a>
          <a href="/map" data-home-route="map" className={`${route} ${ROUTE_MAP}`}>
            <MapIcon aria-hidden="true" className="hidden h-[18px] w-[18px] text-white md:block" />
            {t.openMap}
          </a>
        </div>

        <HeroNewSince language={language} />
      </div>
    </section>
  );
}
