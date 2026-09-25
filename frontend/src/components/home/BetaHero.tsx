import type { JSX } from 'react';
import { Sparkles, Zap, Map as MapIcon, Globe2, Check } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroWorldVisual } from '@/components/home/HeroWorldVisual';
import { SixtySecondBrief } from '@/components/home/SixtySecondBrief';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C1 · THE BETA HOME HERO, RESTORED TO PROTOTYPE SCALE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME CLOSURE R2, increment C1, on top of the H2 hero.
 *
 * The R2 contract's finding is that R1 "drifted away from the strongest visual
 * and interaction qualities of the approved Beta-launch prototype". For this
 * zone the drift was specific and measurable, and C0 RENDERED the prototype to
 * confirm it rather than inferring from screenshots a second time:
 *
 *   - the prototype's globe fills the hero's right half and glows;
 *     H2 rendered the SAME component at 156px on phone and 460px on desktop at
 *     60% opacity, as background texture;
 *   - the prototype's hero sits on a layered dark-blue intelligence field;
 *     H2 sat on the flat page canvas;
 *   - the contract requires THREE actions; H2 shipped two.
 *
 * So this increment changes composition, scale and one added zone. It does NOT
 * rebuild the visual technology, because the repository already owns it.
 *
 * ── WHY HeroWorldVisual AND NOT HeroIntelligenceField ─────────────────────
 *
 * Section 13 says to inspect the retired Hero/world-visual/background
 * components before recreating visual technology. Both were read.
 *
 * `HeroWorldVisual` wins on the merits and on cost. It already draws real
 * country geometry from the vendored atlas with NO request, layered atmospheric
 * glow, category-coloured ambient nodes, connector arcs, a radar sweep and a
 * scan line, and it honours `prefers-reduced-motion` — all as a Server
 * Component with ZERO client JavaScript. It was written to answer a CTO
 * rejection of "a plain cyan political map", which is the same quality bar R2
 * is applying now. It was never the weak part; its SIZE was.
 *
 * `HeroIntelligenceField` calls `useId()`. A hook cannot run in a Server
 * Component, so composing it here would force a client boundary — and the whole
 * hero with it — for a decorative SVG that informs nothing. The Ask entry below
 * depends on this component staying server-rendered. It stays retired, and the
 * layered field it contributed is reproduced as CSS gradient layers, which cost
 * nothing and cannot regress the quota fix.
 *
 * ── THE ASK ENTRY IS UNCHANGED, DELIBERATELY ──────────────────────────────
 *
 * A native GET form to /ask carrying name="q" navigates to /ask?q=..., where
 * `AskFrameScreen` stages the value as a DRAFT and runs only on Send. So typing
 * here costs nothing, by construction rather than by discipline.
 *
 * It also fixes a real quota defect and must not be regressed: the superseded
 * hero routed to /search?q=, and /search keeps its explicit-query auto-run
 * under the N3 ruling, so pressing Ask on Home started a metered analysis
 * immediately. R4.1 `CONTRACT_CONFLICTS.md` C1 settles it — every Ask entry
 * goes to /ask, and only "Open complete analysis" goes to /search?q=. R2
 * section 29 repeats the prohibition. Not one character of the form below
 * changes.
 *
 * ── THE THREE ACTIONS, AND WHERE THE THIRD GOES ───────────────────────────
 *
 * The rendered prototype draws two actions. The contract requires three, and
 * the contract is the later instruction, so three ship. Destinations were
 * checked against the app routes and the module registry before being assigned:
 *
 *   Explore World  ->  #whats-happening-now, the editorial section's anchor
 *   Ask            ->  /ask   (idle on arrival, 0 AI)
 *   Open Map       ->  /map   (free to browse)
 *
 * Explore World does NOT get a /world route. `world-intelligence` is the one
 * registry module whose destination is absent, and minting a route for it here
 * would invent a surface that does not exist. Browsing today's coverage is
 * precisely what the editorial section is, so the anchor is the honest target.
 *
 * ── THE TIER BOUNDARY SELLS NOTHING ───────────────────────────────────────
 *
 * Section 5 requires the "Go further with GlobalNewsAI" teaser upper-right,
 * violet for the tier boundary and sand for metered compute, with no prices, no
 * credit balances and no checkout — and says to inspect the real plans routes
 * before assigning a CTA. The inspection is recorded in C0: there is no plans,
 * pricing, billing, upgrade or checkout route anywhere in the app, and /account
 * has a layout but no page, so it does not resolve.
 *
 * Therefore the teaser has NO call to action. Every alternative was a link to
 * something that does not exist. It states where the free product ends, which
 * is the whole of what section 5 asks it to communicate, and stops there.
 *
 * ── WHAT IS STILL NOT HERE ────────────────────────────────────────────────
 *
 * No sample ribbon, no "Illustration" badge, no illustrative headline, no
 * credit line, no prototype geography. The review build's own banner reads
 * "Every headline, count, source and map label is an illustrative sample, not
 * live coverage"; section 6 keeps all of it out of the product.
 */

interface BetaHeroProps {
  language?: LanguageCode;
  /**
   * The one `getHomeFeed()` response's latest-updates role, handed to the
   * 60-second brief in the right column. No second fetch: this is the same
   * object the page already holds.
   */
  latestUpdates: NewsArticle[];
}

export function BetaHero({ language = 'en', latestUpdates }: BetaHeroProps): JSX.Element {
  const t = getDictionary(language).betaHome;

  return (
    <section
      aria-labelledby="beta-hero-heading"
      className="relative isolate overflow-hidden pb-10 pt-6 sm:pb-14 lg:pb-20 lg:pt-12"
    >
      {/*
        THE LAYERED DARK-BLUE INTELLIGENCE FIELD.

        Four stacked gradient layers rather than one flat wash: a deep blue
        vertical base, a cyan bloom behind the globe, a violet counterweight on
        the headline side, and a vignette that keeps the type legible where the
        bloom is brightest. Pure CSS, so it costs no JavaScript, cannot shift
        layout, and needs no reduced-motion handling — nothing moves.
      */}
      {/*
        FULL-BLEED, not a card. `PageCanvas` centres its children inside a
        max-width column with side padding, so an `inset-0` layer stops at that
        column and draws a visible rectangle — the hero then reads as a panel
        sitting on the page rather than as the page's own field. Bleeding to
        `w-screen` from the centre line fixes that, and `PageCanvas` already
        carries `overflow-x-hidden`, so widening here cannot introduce a
        horizontal scrollbar.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#04090f_0%,#050e1c_45%,#04080f_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_78%_32%,rgba(34,211,238,0.20),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_12%_18%,rgba(139,92,246,0.14),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,6,12,0.65)_100%)]" />
      </div>

      {/*
        THE GLOBE, at prototype scale. Decorative and aria-hidden: it explains,
        it does not inform. It sits behind the right column so the 60-second
        brief overlaps it exactly as the prototype draws, and it is pushed
        partly off the right edge at every width so it reads as a world rather
        than an icon. On phone it stays a restrained corner accent — the
        headline owns that viewport.

        THE MASK IS WHY IT READS AS A FIELD AND NOT A PANEL. `HeroWorldVisual`
        draws itself inside a rounded, bordered, clipped HUD panel, which is
        right at the 460px it was used at before and wrong at 640–780px: the
        border becomes a large rectangle across the hero. Its own spec pins the
        exact signature `export function HeroWorldVisual(): JSX.Element`, so it
        takes no presentation prop and must not grow one. Fading its edges from
        the outside with a radial mask dissolves the panel entirely and leaves
        the luminous world, without touching the component or its spec.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-72px] top-[-16px] w-[220px] opacity-50 [mask-image:radial-gradient(ellipse_at_center,#000_42%,transparent_76%)] sm:w-[300px] sm:opacity-60 lg:right-[-60px] lg:top-[-24px] lg:w-[640px] lg:opacity-95 xl:right-[-40px] xl:w-[780px]"
      >
        <div className="aspect-[560/340] w-full">
          <HeroWorldVisual />
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start lg:gap-12">
        <div className="flex max-w-2xl flex-col">
          <h1
            id="beta-hero-heading"
            className="font-display text-4xl font-semibold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            <span className="block text-ink-primary">{t.heroA}</span>
            {/* The approved accent line. */}
            <span className="block text-emerald-300">{t.heroB}</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-tertiary sm:text-lg">
            {t.heroSub}
          </p>

          {/*
            GET, not POST, and no handler: see the file note. `autoComplete` off
            keeps a previous question from reappearing as if it were live
            context.
          */}
          <form
            action="/ask"
            method="get"
            role="search"
            aria-label={t.askAria}
            className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border-strong bg-void/70 p-2 pl-4 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)] focus-within:border-cyan-400/50"
          >
            <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-violet-300" />
            <input
              type="search"
              name="q"
              autoComplete="off"
              placeholder={t.askPlaceholder}
              aria-label={t.askAria}
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink-primary outline-none placeholder:text-ink-tertiary"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
            >
              {t.askButton}
            </button>
          </form>

          {/* The metered-cost disclosure. Approved copy, stated before the spend. */}
          <p className="mt-3 flex max-w-xl items-start gap-2 text-sm text-ink-tertiary">
            <Zap size={15} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-300" />
            <span>{t.askHint}</span>
          </p>

          {/*
            THE THREE ACTIONS. All three are ordinary links to destinations that
            already exist, and none of them spends anything on arrival.
          */}
          <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href="#whats-happening-now"
              className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border-strong bg-void/70 px-4 py-3 text-left transition-colors hover:border-cyan-400/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
            >
              <Globe2 size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-cyan-300" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-ink-primary">{t.exploreWorld}</span>
                <span className="text-xs text-ink-tertiary">{t.exploreWorldSub}</span>
              </span>
            </a>
            <a
              href="/ask"
              className="flex min-h-[44px] items-center gap-3 rounded-xl bg-violet-600 px-4 py-3 text-left transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none"
            >
              <Sparkles size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-white" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-white">{t.askToday}</span>
                <span className="text-xs text-white/80">{t.askTodaySub}</span>
              </span>
            </a>
            <a
              href="/map"
              className="flex min-h-[44px] items-center gap-3 rounded-xl bg-teal-700 px-4 py-3 text-left transition-colors hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 motion-reduce:transition-none"
            >
              <MapIcon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-white" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-white">{t.openMap}</span>
                <span className="text-xs text-white/80">{t.openMapSub}</span>
              </span>
            </a>
          </div>
        </div>

        {/*
          The right column: the tier boundary above, then "Your world in 60
          seconds" overlapping the globe on desktop and following the actions on
          phone, as the prototype places it.
        */}
        <div className="flex flex-col gap-4 lg:mt-0">
          {/*
            THE TIER BOUNDARY. The violet edge is the boundary itself; the sand
            icon and sand text carry metered compute. No price, no balance, no
            checkout, and no CTA, because there is no plans route to point one
            at.

            It sits over the brightest part of the world visual, so the surface
            is near-opaque rather than a 30% tint: the first capture had the
            closing note effectively unreadable against the globe. Contrast is
            not decoration here — this card is where the reader is told what
            costs money.
          */}
          <aside
            aria-labelledby="beta-premium-heading"
            className="rounded-2xl border border-violet-500/40 bg-[#0b0a1f]/90 p-4 shadow-[0_0_40px_-12px_rgba(139,92,246,0.5)] backdrop-blur-md"
          >
            <h2
              id="beta-premium-heading"
              className="flex items-center gap-2 text-sm font-semibold text-violet-200"
            >
              <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-violet-300" />
              {t.premiumTitle}
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              <li className="flex items-start gap-2 text-xs leading-relaxed text-ink-secondary">
                <Check size={14} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-300" />
                <span>{t.premiumFree}</span>
              </li>
              <li className="flex items-start gap-2 text-xs leading-relaxed text-amber-200/90">
                <Zap size={14} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-300" />
                <span>{t.premiumMetered}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-ink-secondary">{t.premiumNote}</p>
          </aside>

          <SixtySecondBrief items={latestUpdates} language={language} />
        </div>
      </div>
    </section>
  );
}
