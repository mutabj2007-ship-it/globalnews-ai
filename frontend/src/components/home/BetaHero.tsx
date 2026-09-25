import type { JSX } from 'react';
import { Sparkles, Zap, Map as MapIcon } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroWorldVisual } from '@/components/home/HeroWorldVisual';
import { SixtySecondBrief } from '@/components/home/SixtySecondBrief';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * H2 · THE APPROVED BETA HOME HERO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Issue #29 increment H2. Implements the hero exactly as the verified R4.1
 * Home authority draws it — frames `1440x900_01`, `1920x1080_01`,
 * `1024x768_01`, `768x1024_01`, `430x932_01`, `390x844_01`, `360x800_01` — and
 * as its `i18n_en_pl.json` catalogue words it.
 *
 * ZONES DELIVERED (H0 matrix Z6–Z9):
 *   Z6  two-line display headline, second line in the accent, + subheadline
 *   Z7  Ask entry: field, placeholder, Ask button, metered-cost note
 *   Z8  the CTA pair, each with a title and a subtitle
 *   Z9  the explanatory globe
 *
 * ── THE ASK ENTRY IS A PLAIN GET FORM, AND THAT IS THE POINT ──────────────
 *
 * It posts nothing and runs nothing. `<form action="/ask" method="get">` with
 * `name="q"` navigates to `/ask?q=…`, where `AskFrameScreen` already stages
 * the value as a DRAFT — `useState(params.get('q') ?? '')` — and runs only
 * when the reader presses Send. So typing here costs nothing, and the contract
 * §7 rule that "AI runs only after a clearly explicit user action" holds by
 * construction rather than by discipline.
 *
 * IT ALSO FIXES A REAL QUOTA DEFECT. The superseded hero routed to
 * `/search?q=`, and `/search` keeps its explicit-query auto-run by the N3
 * ruling — so pressing Ask on Home started a metered analysis immediately.
 * R4.1 `CONTRACT_CONFLICTS.md` C1 resolves this in terms: *"every Ask entry →
 * `/ask`; only 'Open complete analysis' → `/search?q=`"*, and
 * `NAVIGATION.md`'s Ask→Analysis boundary table gives the hero input
 * "AI calls on arrival: 0". This component is that resolution.
 *
 * NO CLIENT BOUNDARY. A native GET form needs no JavaScript, so the hero
 * renders and submits with none — which is also why the whole component is a
 * server component.
 *
 * ── WHAT IS NOT HERE, BECAUSE IT IS NOT APPROVED FOR THE HERO ─────────────
 *
 * No sample ribbon, no "Illustration" badge, no illustrative headline, no
 * credit line: SPEC §6 keeps those in the review frames only, and §6 of the
 * Home contract forbids them on the live path. The globe is explanatory and
 * drawn from real country geometry, not prototype geography.
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
      className="relative isolate overflow-hidden pb-8 pt-6 sm:pb-12 lg:pb-16 lg:pt-10"
    >
      {/*
        THE GLOBE. Decorative and aria-hidden: it explains, it does not inform.
        SPEC §4.A caps it at 156px on phone and 220px on tablet, and places it
        behind the brief card on desktop — so it is sized by viewport here and
        never allowed to crowd the headline column.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-64px] top-0 w-[156px] opacity-60 sm:w-[220px] lg:right-0 lg:top-4 lg:w-[460px] lg:opacity-100"
      >
        <HeroWorldVisual />
      </div>

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start">
        <div className="flex max-w-2xl flex-col">
          <h1 id="beta-hero-heading" className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block text-ink-primary">{t.heroA}</span>
            {/* The approved accent line. */}
            <span className="block text-emerald-300">{t.heroB}</span>
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-tertiary sm:text-lg">
            {t.heroSub}
          </p>

          {/*
            GET, not POST, and no handler: see the file note. `autoComplete`
            off keeps a previous question from reappearing as if it were live
            context.
          */}
          <form
            action="/ask"
            method="get"
            role="search"
            aria-label={t.askAria}
            className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border-strong bg-void/70 p-2 pl-4 focus-within:border-cyan-400/50"
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
            THE CTA PAIR. Both are ordinary links to routes that already exist,
            and neither spends anything on arrival: `/ask` opens idle, `/map` is
            free to browse.
          */}
          <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
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
          The approved right column: "Your world in 60 seconds", overlapping
          the globe on desktop and following the CTAs on phone, exactly as the
          R4.1 frames place it.
        */}
        <div className="mt-2 lg:mt-0">
          <SixtySecondBrief items={latestUpdates} language={language} />
        </div>
      </div>
    </section>
  );
}
