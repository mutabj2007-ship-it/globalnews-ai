import type { JSX } from 'react';
import { Globe2, Map as MapIcon, MessagesSquare } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroGlobe } from '@/components/home/HeroGlobe';
import { HomeComposer } from './HomeComposer';
import { HeroGreeting, HeroNewSince } from './HeroReturningState';

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
 * - Signed in (D3): greeting above the H1 and a truthful New-since chip.
 *
 * The globe is CROPPED at the section edge (overflow-x: clip), never allowed to
 * widen the page: VISUAL_SPEC phone "300, cropped right".
 *
 * The retired Hero surfaces (the gold "Go further / Plans coming soon" card and
 * the three coloured CTA tiles) do not exist in Rev A: no price, no plans.
 */
export function HomeWelcomeHero({ language }: { language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).homeReva.hero;
  const route =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-3 text-[14px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none md:px-4';

  return (
    <section aria-labelledby="home-hero-heading" data-home-hero="" className="relative isolate overflow-x-clip pb-8 pt-6 md:pt-10 lg:pb-10 lg:pt-12">
      {/* The world visual: behind the text, radial mask + left-to-right scrim, one link to /map. */}
      <a
        href="/map"
        aria-label={t.globeLabel}
        title={t.globeLabel}
        data-home-hero-globe=""
        className="absolute -right-[92px] -top-2 -z-10 block h-[300px] w-[300px] rounded-full opacity-90 [mask-image:radial-gradient(circle_at_50%_50%,#000_62%,transparent_72%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] md:-right-10 md:top-2 md:h-[420px] md:w-[420px] lg:right-0 lg:top-4 lg:h-[470px] lg:w-[470px] lg:opacity-100 gn-xl:h-[560px] gn-xl:w-[560px]"
      >
        <HeroGlobe />
      </a>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 -z-[5] w-[78%] bg-[linear-gradient(90deg,rgba(2,11,24,0.92)_0%,rgba(2,11,24,0.70)_55%,transparent_100%)] md:w-[70%]" />

      <div className="relative max-w-[640px]">
        <HeroGreeting language={language} />
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5abff5]">{t.eyebrow}</p>
        <h1
          id="home-hero-heading"
          className="mt-3 font-display text-[34px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white min-[380px]:text-[38px] md:text-[60px] gn-xl:text-[72px]"
        >
          <span className="block">{t.titleA}</span>
          <span className="block">{t.titleB}</span>
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
          <a href="#whats-happening-now" className={`${route} border-[#1d3a5a] bg-[#061527] hover:border-[#2f6ea8]`}>
            <Globe2 aria-hidden="true" className="hidden h-[18px] w-[18px] text-[#8fd3ff] md:block" />
            {t.exploreWorld}
          </a>
          {/* INTERACTIONS: "Ask GlobalNewsAI → /ask idle" — a real link, 0 AI. */}
          <a href="/ask" className={`${route} border-[#1b6fa8] bg-[#07233d] hover:border-[#5abff5]`}>
            <MessagesSquare aria-hidden="true" className="hidden h-[18px] w-[18px] text-[#8fd3ff] md:block" />
            {t.askGlobalNews}
          </a>
          <a href="/map" className={`${route} border-[#1d3a5a] bg-[#061527] hover:border-[#2f6ea8]`}>
            <MapIcon aria-hidden="true" className="hidden h-[18px] w-[18px] text-[#8fd3ff] md:block" />
            {t.openMap}
          </a>
        </div>

        <HeroNewSince language={language} />
      </div>
    </section>
  );
}
