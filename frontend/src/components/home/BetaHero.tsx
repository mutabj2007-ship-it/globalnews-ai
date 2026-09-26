import type { JSX } from 'react';
import { Crown, Sparkles, Zap, Map as MapIcon, Globe2, Check, ArrowRight } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroGlobe } from '@/components/home/HeroGlobe';
import { HeroAskField } from '@/components/home/HeroAskField';
import { PREMIUM_TEASER_SHELL } from '@/components/home/homePresentation';
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
      /* Measured: the prototype's hero runs from the 62px header down to the
         "What's happening now" cap box at y=360 -- about 293px of block. */
      className="relative isolate pb-5 pt-4 sm:pb-6 lg:-mt-[16px] lg:pb-2 lg:pt-0"
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
        {/* §11 — sampled from the prototype: `#001729` deep, `#041d3b` mid,
            `#023454` where the atmosphere lifts toward the globe. The shipped
            base (`#03070e`/`#08192c`) was a grey-navy; every one of these is
            measurably bluer. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#00101f_0%,#001729_34%,#04223f_58%,#020d1c_100%)]" />

        {/* 2 · THE ATMOSPHERE ITSELF — a wide blue bloom centred on the globe,
               far larger than the sphere, so the light reads as coming OFF the
               world rather than being painted behind it */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_86%_130%_at_58%_46%,rgba(20,124,214,0.42),transparent_70%)]" />

        {/* 3 · the hotter inner core of that bloom */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_44%_74%_at_56%_44%,rgba(64,182,255,0.30),transparent_64%)]" />

        {/* 4 · violet counterweight on the headline side, so the left is not a
               dead corner and the two accents balance */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_64%_at_6%_20%,rgba(124,92,246,0.22),transparent_70%)]" />

        {/* 5 · SUBTLE GEOGRAPHIC TEXTURE — a graticule so faint it reads as
               material rather than as a grid. Two repeating-linear-gradients,
               one per axis, at ~2.5% so no line is ever individually legible */}
        <div className="absolute inset-0 opacity-[0.40] [background-image:repeating-linear-gradient(90deg,rgba(125,211,252,0.045)_0_1px,transparent_1px_96px),repeating-linear-gradient(0deg,rgba(125,211,252,0.035)_0_1px,transparent_1px_96px)]" />

        {/* 6 · atmospheric haze drifting up from the horizon */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(2,52,84,0.40),transparent_86%)]" />

        {/* 7 · vignette, last, so type stays legible where the bloom is brightest */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_36%,rgba(2,6,12,0.62)_100%)]" />
      </div>

      {/*
        ══════════════════════════════════════════════════════════════════
        THE GLOBE — THE MECHANISM CHANGED, NOT THE NUMBERS.
        ══════════════════════════════════════════════════════════════════

        The ruling: *"the globe must visually read as a free large globe, not a
        rectangle with a globe inside it... it must not touch the ceiling/top
        edge the way it does now"*, and §9: *"If a mechanism produces a result
        that still looks mechanically wrong, do not defend the mechanism.
        Change the mechanism."*

        THE DIAGNOSIS. Every previous pass sized and positioned the sphere
        correctly and still looked boxed, because the `<section>` carried
        `overflow-hidden`. The hero was a rectangle with a clipping edge, so
        whatever the globe did, its top was sheared flat against the header and
        its bottom against the next band. No amount of resizing fixes a clip —
        the rectangle was the thing being seen.

        THE CHANGE. `overflow-hidden` is GONE from the hero. The section no
        longer clips anything, so the sphere is bounded only by its own alpha
        and its own mask. It sits clear of the header by design rather than by
        luck, and it extends BELOW the hero into the page, fading out, because
        a world that continues past the frame reads as a world while one that
        stops on a line reads as a picture of one.

        The full-bleed background still works: `PageCanvas` carries
        `overflow-x-hidden`, which is what kept the `w-screen` layer from
        producing a horizontal scrollbar, and that is unchanged.

        THE MASK does the edge instead of the box. It is a circle, generous in
        the middle and soft only in the last few percent, so the sphere keeps
        its full illuminated mass and dissolves into the atmosphere at the limb
        rather than ending anywhere.
      */}
      <div
        aria-hidden="true"
        /*
          THE GLOBE HAS TWO FRAMINGS, NOT ONE THAT SHRINKS.

          THE LOWER FEATHER IS DEEP ON PURPOSE, AND IT WAS DEEPENED TWICE.

          The first attempt held full opacity to 44% and still had readable
          geography over the editorial band; the Product Owner rejected it
          because "the physical globe — coastline, limb, outlines and
          illuminated geography — remains visibly present too far down."

          Now the Earth itself is fully opaque only to 28% of its own box and
          is gone by 82%, across eight stops, so the dissolve is long rather
          than a cut. What continues below is the hero's ATMOSPHERE layers at
          `-z-20`, which are diffuse blue light with no limb and no coastline —
          exactly the ruled sequence: full Earth -> atmospheric blue ->
          increasingly faint geography -> clean dark editorial surface.

          The globe did not shrink. `h-[470px] lg` / `h-[510px] xl` and its
          position are untouched; only its lower opacity changed.

          Below `lg` it is the R4.1/R5.1 phone treatment, which
          `390x844_H3_home_top_dark.png` draws literally: a large Earth whose
          left limb sits behind the headline's right edge and whose right side
          is CROPPED BY THE VIEWPORT. It reads as a real object continuing past
          the screen, which is what makes it premium at 390px. Scaling the
          desktop framing down instead produced a dim wash behind the type --
          recognisable as nothing.

          At `lg` and up it returns to the Product Owner prototype's framing,
          measured and accepted in the premium pass, untouched.
        */
        className="pointer-events-none absolute -right-[76px] -top-[34px] left-auto -z-10 h-[268px] w-[268px] translate-x-0 opacity-95 [mask-image:radial-gradient(circle_at_58%_46%,#000_62%,rgba(0,0,0,0.42)_84%,transparent_100%)] sm:-right-[54px] sm:-top-[26px] sm:h-[330px] sm:w-[330px] md:h-[390px] md:w-[390px] lg:left-1/2 lg:right-auto lg:top-[18px] lg:h-[470px] lg:w-[470px] lg:-translate-x-[20%] lg:opacity-100 lg:[mask-image:linear-gradient(to_bottom,#000_0%,#000_28%,rgba(0,0,0,0.80)_38%,rgba(0,0,0,0.52)_46%,rgba(0,0,0,0.30)_54%,rgba(0,0,0,0.16)_61%,rgba(0,0,0,0.07)_68%,rgba(0,0,0,0.02)_75%,transparent_82%)] xl:h-[510px] xl:w-[510px] xl:-translate-x-[18%]"
      >
        {/*
          TWO NESTED MASKS, because they do two different jobs and one gradient
          cannot do both.

          OUTER (above): a vertical fade, so the sphere dissolves as it reaches
          the editorial band beneath the hero. The hero no longer clips, which
          is what freed the globe — but "not clipped" must not become "spills
          over the stories", so the bottom is faded instead of cut.

          INNER (below): the circular limb. Generous through the middle so the
          illuminated mass is untouched, soft only in the last few percent, so
          the edge is atmosphere rather than a boundary.
        */}
        <div className="h-full w-full lg:[mask-image:radial-gradient(circle_at_50%_50%,#000_87%,rgba(0,0,0,0.5)_96%,transparent_100%)]">
          <HeroGlobe />
        </div>
      </div>

      {/*
        §4 — THE CONNECTED-PERSPECTIVE BADGE, which the prototype places over
        the world beside the headline. It is a product statement, not a
        measurement: no count, no place, no time, nothing derived from the feed.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[88px] z-[1] hidden max-w-[130px] translate-x-[118%] rounded-lg bg-[rgba(6,12,22,0.78)] px-3 py-2 text-[12px] font-medium leading-snug text-ink-secondary shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-sm lg:block"
      >
        {t.connectedPerspective}
      </span>

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,232px)] lg:items-start lg:gap-10">
        <div className="flex max-w-2xl flex-col pr-[96px] sm:pr-[112px] lg:pr-0">
          <h1
            id="beta-hero-heading"
            className="font-display text-[34px] font-extrabold leading-[1.07] tracking-[-0.025em] sm:text-[40px] lg:text-[42px] xl:text-[46px]"
          >
            <span className="block text-white">{t.heroA}</span>
            {/*
              The accent line. CYAN, not emerald: the Product Owner's desktop
              screenshot draws "what's changing." in the product's cyan, and
              under the takeover ruling that screenshot is the controlling
              visual authority for Home. Emerald was the previous
              implementation's choice and the ruling is explicit that the
              current implementation is reference evidence, not authority.
            */}
            {/*
              §11 — the accent is TWO sampled colours, not one. The prototype
              draws "what's" at `#5abff5` (sky) and "changing." at `#5df9e1`
              rising to `#61fcea` (aqua); the implementation drew the whole
              line in a single flat `cyan-300`.

              It is rendered as a gradient across the line rather than as two
              spans, because `heroB` is one translated string: Polish does not
              split at the same word, and hard-coding a split point here would
              put the colour change in the wrong place in the other language.
              The gradient reproduces both sampled endpoints in both.
            */}
            <span className="block bg-[linear-gradient(90deg,#5abff5_0%,#4fd8e6_44%,#5df9e1_74%,#61fcea_100%)] bg-clip-text text-transparent [text-shadow:0_0_36px_rgba(70,220,230,0.28)]">
              {t.heroB}
            </span>
          </h1>

          <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-[#cfe2f2]">
            {t.heroSub}
          </p>

          {/*
            Correction item 6 — the Ask field is a real composer. Pressing
            anywhere on the pill focuses the input and places the cursor;
            focusing expands it in a controlled way and, on phone, summons the
            keyboard and keeps the composer visible.

            Focus navigates nothing and starts nothing. `HeroAskField` renders
            a plain GET form to /ask with no handler and makes no request of
            its own: submitting stages a DRAFT on /ask, and the first metered
            moment is still the reader pressing Send there.
          */}
          <HeroAskField
            placeholder={t.askPlaceholder}
            ariaLabel={t.askAria}
            buttonLabel={t.askButton}
            hint={t.askHint}
          />

          {/*
            C7, as ruled: ">=1024: retain all three Product Owner actions ...
            <1024: follow the R4.1/R5.1 phone authority and use the two compact
            actions: Ask AI about today, Open World Map ... Explore World is
            therefore omitted from the phone Hero, not deleted from the desktop
            product."

            Two columns below `lg`, which is how both R5.1 frames draw the pair,
            three from `lg` up. Explore World carries `hidden lg:flex`, so below
            `lg` it leaves the layout AND the tab order rather than becoming a
            third squeezed tile. Its destination is the current-developments
            anchor, which on a phone is simply the next thing the reader
            scrolls to, so nothing becomes unreachable by omitting it.
          */}
          <div className="mt-3 grid w-full max-w-[660px] grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-[11px]">
            <a
              href="#whats-happening-now"
              className="hidden min-h-[60px] items-center gap-3 rounded-[9px] bg-[linear-gradient(105deg,#0a6bd6_0%,#0c42a2_100%)] px-[15px] py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_32px_-18px_rgba(10,107,214,0.95)] transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_20px_40px_-16px_rgba(10,107,214,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:flex"
            >
              <Globe2 size={20} strokeWidth={1.85} aria-hidden="true" className="shrink-0 text-white" />
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-[13.5px] font-bold leading-[1.18] text-white lg:line-clamp-none lg:text-[14px] lg:leading-tight">{t.exploreWorld}</span>
                <span className="mt-[2px] line-clamp-2 text-[11px] leading-[1.25] text-white/85 lg:text-[11.5px] lg:leading-tight">{t.exploreWorldSub}</span>
              </span>
            </a>
            <a
              href="/ask"
              className="flex min-h-[56px] flex-col items-start gap-1.5 rounded-[9px] bg-[linear-gradient(105deg,#412d9f_0%,#1f328a_100%)] px-3.5 py-3 lg:min-h-[60px] lg:flex-row lg:items-center lg:gap-3 lg:px-[15px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_32px_-18px_rgba(65,45,159,0.95)] transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_20px_40px_-16px_rgba(65,45,159,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <Sparkles size={20} strokeWidth={1.85} aria-hidden="true" className="mt-[1px] shrink-0 text-white lg:mt-0" />
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-[13.5px] font-bold leading-[1.18] text-white lg:line-clamp-none lg:text-[14px] lg:leading-tight">{t.askToday}</span>
                <span className="mt-[2px] line-clamp-2 text-[11px] leading-[1.25] text-white/85 lg:text-[11.5px] lg:leading-tight">{t.askTodaySub}</span>
              </span>
            </a>
            <a
              href="/map"
              className="flex min-h-[56px] flex-col items-start gap-1.5 rounded-[9px] bg-[linear-gradient(105deg,#0b8d6a_0%,#037050_100%)] px-3.5 py-3 lg:min-h-[60px] lg:flex-row lg:items-center lg:gap-3 lg:px-[15px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_32px_-18px_rgba(11,141,106,0.95)] transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_20px_40px_-16px_rgba(11,141,106,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <MapIcon size={20} strokeWidth={1.85} aria-hidden="true" className="mt-[1px] shrink-0 text-white lg:mt-0" />
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-[13.5px] font-bold leading-[1.18] text-white lg:line-clamp-none lg:text-[14px] lg:leading-tight">{t.openMap}</span>
                <span className="mt-[2px] line-clamp-2 text-[11px] leading-[1.25] text-white/85 lg:text-[11.5px] lg:leading-tight">{t.openMapSub}</span>
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
          {/*
            C10, as ruled: "Do not force the desktop premium card beside/over
            the phone globe ... `Go further with GlobalNewsAI` must still exist
            on phone, but as a compact full-width premium teaser lower in the
            Home flow ... after Explore by topic and before How It Works."

            So this card is now `lg`-and-up only. It is NOT duplicated below
            `lg`: `HomePremiumTeaser` is a different, smaller component with its
            own heading id, rendered once by the page in the ruled position. One
            premium block is visible at any width, and no id appears twice.
          */}
          <aside
            aria-labelledby="beta-premium-heading"
            className={`relative hidden overflow-hidden p-[14px] lg:block ${PREMIUM_TEASER_SHELL}`}
          >
            {/* Sampled: the card's own fill is near-black `#090d19`, and the
                gold reads as a warm bloom in its TOP-LEFT corner (`#483c23`),
                not as a tint across the whole surface. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_62%_at_6%_2%,rgba(139,110,255,0.22),transparent_64%)]"
            />
            <h2
              id="beta-premium-heading"
              className="relative flex items-start gap-2.5 text-[15px] font-bold leading-[1.22] text-white"
            >
              {/* Measured ~36 x 32px, and it glows. */}
              <Crown
                size={26}
                strokeWidth={1.9}
                aria-hidden="true"
                className="mt-[1px] shrink-0 text-[#c4b5fd] drop-shadow-[0_0_12px_rgba(167,139,250,0.7)]"
              />
              <span className="block">{t.premiumTitle}</span>
            </h2>

            {/*
              THE FOUR CAPABILITY LINES. They name what the paid layer is for.
              None of them is a control: there is nothing to click here, so
              nothing can be started by accident, and Watch — named on the first
              line — stays inactive product-wide.
            */}
            <ul className="relative mt-[12px] flex flex-col gap-[8px]">
              {[t.premiumCap1, t.premiumCap2, t.premiumCap3, t.premiumCap4].map((capability) => (
                <li key={capability} className="flex items-center gap-2.5 text-[13px] leading-[1.25] text-white">
                  {/* Measured: a 17px ring, not a bare tick. */}
                  <Check
                    size={17}
                    strokeWidth={2.6}
                    aria-hidden="true"
                    className="shrink-0 rounded-full border border-[#4a3a93] bg-[#1b1540] p-[3px] text-[#c4b5fd]"
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
              className="relative mt-[12px] h-[44px] w-full cursor-not-allowed rounded-[10px] border border-[#4a3a93] bg-[linear-gradient(180deg,#3b2f8f_0%,#2a2168_100%)] px-4 text-center text-[13px] font-bold tracking-[0.01em] text-[#e4dcff] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] xl:h-[35px]"
            >
              {t.premiumCta}
            </button>

            <p className="relative mt-[10px] text-center text-[10.5px] leading-snug text-[#8b86bb]">{t.premiumNote}</p>
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
