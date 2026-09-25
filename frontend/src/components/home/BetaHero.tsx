import type { JSX } from 'react';
import { Crown, Sparkles, Zap, Map as MapIcon, Globe2, Check } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroGlobe } from '@/components/home/HeroGlobe';
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
      className="relative isolate overflow-hidden pb-7 pt-5 sm:pb-8 lg:pb-9 lg:pt-8"
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
        className="pointer-events-none absolute inset-y-0 left-1/2 -z-20 w-screen -translate-x-1/2"
      >
        {/*
          ── THE WORLD ATMOSPHERE ────────────────────────────────────────
          HERO SCALE CORRECTION: *"The current Hero still looks too much like a
          plain dark panel with a globe asset placed inside it. Blend the world
          treatment into the Hero background using gradients, atmospheric haze
          and subtle world/geographic texture so the globe feels embedded in the
          product surface."*

          Seven layers, each doing one job, all pure CSS — no JavaScript, no
          layout cost, nothing that moves and so nothing needing a
          reduced-motion branch.
        */}

        {/* 1 · the deep base, warmer toward the horizon line than the edges */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#03070e_0%,#061426_42%,#08192c_62%,#040a14_100%)]" />

        {/* 2 · THE ATMOSPHERE ITSELF — a wide blue bloom centred on the globe,
               far larger than the sphere, so the light reads as coming OFF the
               world rather than being painted behind it */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_86%_130%_at_58%_46%,rgba(56,150,236,0.30),transparent_68%)]" />

        {/* 3 · the hotter inner core of that bloom */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_44%_74%_at_56%_44%,rgba(80,190,255,0.22),transparent_62%)]" />

        {/* 4 · violet counterweight on the headline side, so the left is not a
               dead corner and the two accents balance */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_64%_at_6%_20%,rgba(124,92,246,0.18),transparent_70%)]" />

        {/* 5 · SUBTLE GEOGRAPHIC TEXTURE — a graticule so faint it reads as
               material rather than as a grid. Two repeating-linear-gradients,
               one per axis, at ~2.5% so no line is ever individually legible */}
        <div className="absolute inset-0 opacity-[0.55] [background-image:repeating-linear-gradient(90deg,rgba(125,211,252,0.045)_0_1px,transparent_1px_96px),repeating-linear-gradient(0deg,rgba(125,211,252,0.035)_0_1px,transparent_1px_96px)]" />

        {/* 6 · atmospheric haze drifting up from the horizon */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(14,52,92,0.34),transparent_84%)]" />

        {/* 7 · vignette, last, so type stays legible where the bloom is brightest */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_36%,rgba(2,6,12,0.62)_100%)]" />
      </div>

      {/*
        THE GLOBE — HERO SCALE CORRECTION.

        The previous pass was refused for the opposite reason to the one before
        it: *"the globe has now been reduced too far... it reads as a small
        decorative globe behind the premium card."* The required hierarchy is
        stated plainly — left is headline/search/actions, MIDDLE-RIGHT is a
        large illuminated Earth, far right is the premium card floating above
        it — and the card must not overpower the world.

        So the sphere is no longer bounded by the hero's own height. It is a
        fixed square, ~1.7× its previous apparent size, centred vertically on
        the band and allowed to overflow it top and bottom, with its horizontal
        centre moved from ~68% of the hero to ~52% — into the middle. That is
        what puts Earth behind the search field and the action row rather than
        beside them, and it is why it no longer reads as a circular icon parked
        behind the card.

        THE MASKS ARE WHAT KEEP IT FROM BEING THE EARLIER REJECTED CROP. Fading
        top, bottom and left means the sphere has no hard edge anywhere: it
        dissolves into the atmosphere behind the headline instead of ending on
        a line, so a viewer reads "a world the page is sitting on" rather than
        "a large image that did not fit".

        `-z-10` keeps it above the atmosphere layers and below every control.
        It is `aria-hidden`, carries no marks, and nothing on the page reads it.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[380px] w-[380px] -translate-x-[6%] -translate-y-[52%] opacity-75 [mask-image:radial-gradient(circle_at_50%_50%,#000_84%,rgba(0,0,0,0.72)_93%,transparent_100%)] sm:h-[460px] sm:w-[460px] sm:opacity-90 lg:h-[580px] lg:w-[580px] lg:-translate-x-[20%] lg:-translate-y-[50%] lg:opacity-100 xl:h-[640px] xl:w-[640px] xl:-translate-x-[22%]"
      >
        <HeroGlobe />
      </div>

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start lg:gap-7">
        <div className="flex max-w-2xl flex-col">
          <h1
            id="beta-hero-heading"
            className="font-display text-[36px] font-semibold leading-[1.04] tracking-[-0.022em] sm:text-[44px] lg:text-[50px] xl:text-[56px]"
          >
            <span className="block text-ink-primary">{t.heroA}</span>
            {/*
              The accent line. CYAN, not emerald: the Product Owner's desktop
              screenshot draws "what's changing." in the product's cyan, and
              under the takeover ruling that screenshot is the controlling
              visual authority for Home. Emerald was the previous
              implementation's choice and the ruling is explicit that the
              current implementation is reference evidence, not authority.
            */}
            <span className="block text-cyan-300">{t.heroB}</span>
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary sm:text-base">
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
            className="mt-5 flex w-full max-w-[600px] items-center gap-2 rounded-2xl border border-border-strong bg-void/75 p-2 pl-4 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)] focus-within:border-cyan-400/50"
          >
            <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-violet-300" />
            <input
              type="search"
              name="q"
              autoComplete="off"
              placeholder={t.askPlaceholder}
              aria-label={t.askAria}
              className="min-h-[44px] min-w-0 flex-1 bg-transparent py-2 text-base text-ink-primary outline-none placeholder:text-ink-tertiary"
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
            >
              {t.askButton}
            </button>
          </form>

          {/* The metered-cost disclosure. Approved copy, stated before the spend. */}
          <p className="mt-3 flex max-w-xl items-start gap-1.5 text-[12px] leading-snug text-ink-tertiary">
            <Zap size={13} strokeWidth={2} aria-hidden="true" className="mt-[2px] shrink-0 text-amber-300" />
            <span>{t.askHint}</span>
          </p>

          {/*
            THE THREE ACTIONS. All three are ordinary links to destinations that
            already exist, and none of them spends anything on arrival.
          */}
          <div className="mt-5 grid w-full max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href="#whats-happening-now"
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-border-strong bg-void/70 px-4 py-3 text-left transition-colors hover:border-cyan-400/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none"
            >
              <Globe2 size={20} strokeWidth={1.85} aria-hidden="true" className="shrink-0 text-cyan-300" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] font-semibold leading-tight text-ink-primary">{t.exploreWorld}</span>
                <span className="text-[11px] leading-tight text-ink-tertiary">{t.exploreWorldSub}</span>
              </span>
            </a>
            <a
              href="/ask"
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl bg-violet-600 px-4 py-3 text-left transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none"
            >
              <Sparkles size={20} strokeWidth={1.85} aria-hidden="true" className="shrink-0 text-white" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] font-semibold leading-tight text-white">{t.askToday}</span>
                <span className="text-[11px] leading-tight text-white/80">{t.askTodaySub}</span>
              </span>
            </a>
            <a
              href="/map"
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl bg-teal-700 px-4 py-3 text-left transition-colors hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 motion-reduce:transition-none"
            >
              <MapIcon size={20} strokeWidth={1.85} aria-hidden="true" className="shrink-0 text-white" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] font-semibold leading-tight text-white">{t.openMap}</span>
                <span className="text-[11px] leading-tight text-white/80">{t.openMapSub}</span>
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
            className="rounded-2xl border border-amber-300/60 bg-[#0b0904]/[0.97] p-4 shadow-[0_18px_60px_-18px_rgba(245,197,94,0.45)] backdrop-blur-md"
          >
            <h2
              id="beta-premium-heading"
              className="flex items-start gap-2.5 text-[15px] font-semibold leading-snug text-amber-100"
            >
              <Crown size={18} strokeWidth={1.9} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-300" />
              <span className="block">{t.premiumTitle}</span>
            </h2>

            {/*
              THE FOUR CAPABILITY LINES. They name what the paid layer is for.
              None of them is a control: there is nothing to click here, so
              nothing can be started by accident, and Watch — named on the first
              line — stays inactive product-wide.
            */}
            <ul className="mt-3 flex flex-col gap-2">
              {[t.premiumCap1, t.premiumCap2, t.premiumCap3, t.premiumCap4].map((capability) => (
                <li key={capability} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-primary">
                  <Check
                    size={15}
                    strokeWidth={2.4}
                    aria-hidden="true"
                    className="mt-[3px] shrink-0 rounded-full bg-amber-400/15 p-[1px] text-amber-300"
                  />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>

            {/*
              ══════════════════════════════════════════════════════════════
              WHERE THE PROTOTYPE'S "View Plans →" BUTTON WENT — A DECLARED
              DEVIATION, NOT AN OVERSIGHT.
              ══════════════════════════════════════════════════════════════

              The Product Owner's screenshot puts a filled gold "View Plans →"
              button in this slot. There is NO PLANS ROUTE IN THIS PRODUCT —
              `app/` carries no plans, pricing or upgrade segment — and the
              activation forbids inventing one: *"Do not invent active pricing,
              checkout, credits or Watch functionality."*

              A gold button that goes nowhere is worse than no button: it is
              the one element on this card a reader is most likely to press,
              and pressing it would be the product's first broken promise about
              money. So the slot keeps the button's WEIGHT and gives it to the
              governed sentence that is true — the same sentence the card
              already shipped with. When a plans route exists, this block is
              where the button goes, and nothing else on the card changes.
            */}
            {/*
              ══════════════════════════════════════════════════════════════
              THE CTA SLOT — KEPT, AND TRUTHFUL.
              ══════════════════════════════════════════════════════════════

              The first pass removed the prototype's filled gold "View Plans →"
              button entirely, on the grounds that a gold button going nowhere
              would be the product's first broken promise about money. The HERO
              CORRECTION RULING accepts the reasoning and rejects the remedy:
              *"If no plans route exists, keep the prototype-sized CTA slot but
              use truthful non-broken behavior such as `Plans coming soon` /
              disabled state rather than removing the CTA area entirely."*

              So the slot returns at the prototype's size and weight, as a
              REAL disabled button rather than a paragraph dressed as one:

                · `<button type="button" disabled>` — the browser refuses the
                  press, so there is no click handler to go wrong and no href
                  to resolve nowhere;
                · `aria-disabled` and `tabIndex={-1}` keep it out of the tab
                  order, so a keyboard reader never lands on a dead control;
                · its label SAYS it is not open yet, so the disabled state is
                  explained rather than merely felt — a greyed control with an
                  active-sounding label is the thing that actually frustrates
                  people;
                · `cursor-not-allowed` and no hover transition, so the pointer
                  reports the same fact.

              Nothing here can start a purchase, because there is nothing here
              to press. When a plans route exists, this becomes an enabled link
              to it and nothing else on the card changes.
            */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              tabIndex={-1}
              className="mt-4 w-full cursor-not-allowed rounded-xl bg-gradient-to-b from-[#f6d98a] to-[#e0b354] px-4 py-2.5 text-center text-[13px] font-bold tracking-wide text-[#3a2b08] shadow-[0_6px_18px_-8px_rgba(245,197,94,0.9)]"
            >
              {t.premiumCta}
            </button>

            <p className="mt-2.5 text-center text-[11px] leading-snug text-amber-100/60">{t.premiumNote}</p>
          </aside>

          {/*
            §5 · THE 60-SECOND BRIEF IS A PHONE ZONE, NOT A DESKTOP ONE.

            The Product Owner's PHONE frame carries "Your world in 60 seconds"
            directly under the search field. The DESKTOP frame does not carry it
            at all: the hero's right column there is the premium card and
            nothing else, and the page goes straight from the actions into
            What's happening now.

            Rendering it on both was what made the desktop hero 380px taller
            than the prototype's, which is the "large empty vertical area" §5
            refuses. So it is hidden at `lg` and up and kept exactly as it is
            below — no behaviour, binding or copy changes, and the phone pass
            still finds it where the phone frame puts it.
          */}
          <div className="lg:hidden">
            <SixtySecondBrief items={latestUpdates} language={language} />
          </div>
        </div>
      </div>
    </section>
  );
}
