'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { TrendingCard } from '@/components/home/TrendingCard';
import { GlobalDevelopmentsHashFocus } from '@/components/home/GlobalDevelopmentsHashFocus';

interface GlobalDevelopmentsProps {
  lead: NewsArticle | null;
  secondary: NewsArticle[];
  dataMode: NewsDataMode | null;
  language?: LanguageCode;
}

const SECONDARY_COUNT = 5;

/** GN-CD-108 — the released auto-advance interval. */
const AUTO_ADVANCE_INTERVAL_MS = 6000;
/** GN-CD-108 — the released re-arm delay after a control activation. */
const MANUAL_REARM_MS = 9000;
/** GN-CD-105 — the released step constant, added to the measured card width. */
const RAIL_STEP_GAP = 12;
/** GN-CD-105 — the released fallback step when no card can be measured. */
const RAIL_STEP_FALLBACK = 220;

/**
 * Global Developments — the Claude Design news-discovery rail
 * (GN-CD-100 -> GN-CD-115), reconciled in M66.4.
 *
 * ── NAMING ────────────────────────────────────────────────────────────────
 *
 * The Claude Design family is called Trending. The product surface is not,
 * and must not be. `allocateHomeFeed` selects the lead story by response
 * order and states in its own contract that no popularity or engagement claim
 * is made or implied; `inFocus` explicitly replaced the former "trending"
 * concept with a curated selection rather than a measured popularity signal.
 * There is no rank, no engagement metric and no editorial score anywhere
 * behind this rail, so the rendered copy stays Global Developments / What is
 * happening right now, and this file's own spec enforces that no rendered
 * string ever says trending, most read or popular. The design family name
 * survives only in the imported component's identifier.
 *
 * ── ONE REQUEST, NO RE-ORDERING ───────────────────────────────────────────
 *
 * `lead` and `secondary` are `feed.featured` and `feed.inFocus` from the
 * single homepage getHomeFeed(language) call that page.tsx already makes.
 * This file fetches nothing and sorts nothing: array order is the editorial
 * order, exactly as GN-CD's hierarchy analysis requires, and re-ordering here
 * would invent a ranking the data does not carry.
 *
 * ── THE TWO-FLAG PAUSE MODEL (GN-CD-108) ──────────────────────────────────
 *
 * The rail carries two independent pause flags, and the specification is
 * emphatic that both are required: a single merged flag was tried during
 * design and failed, because touch and keyboard users never fire mouseleave,
 * so the pause latched permanently and the rail died after one arrow tap.
 * The pre-M66.4 implementation had exactly that single flag, and
 * onPointerDown set it with nothing to clear it — so one tap on a touch
 * device stopped the rail for the life of the page. Corrected here:
 *
 *   holdRef   set by pointer enter / focus within, cleared by leave / blur
 *   pausedRef set by any arrow activation, cleared by a 9000ms timer
 *
 * Both live in refs rather than state so a hover cannot tear down and rebuild
 * the interval.
 *
 * ── CONTROLS THAT CANNOT ACT ARE NOT RENDERED ─────────────────────────────
 *
 * GN-CD records that a rail shorter than its viewport leaves the arrows with
 * nothing to scroll, "appearing broken". At the released desktop geometry the
 * rail only overflows from the fifth card onward, and a short provider
 * response is entirely possible. A ResizeObserver measures the real overflow
 * and the arrows render only when they can actually move something.
 *
 * ── DELIBERATELY NOT IMPLEMENTED ──────────────────────────────────────────
 *
 * GN-CD-104's VIEW ALL has no destination: the design sends it to the search
 * screen and says plainly that this is a prototype convenience, not an
 * intent. No trending listing route exists, so the control is omitted rather
 * than pointed somewhere invented. The urgent and top-story card treatments
 * are absent for the reasons recorded in TrendingCard.tsx.
 */
export function GlobalDevelopments({
  lead,
  secondary,
  dataMode,
  language = 'en',
}: GlobalDevelopmentsProps): JSX.Element {
  const t = getDictionary(language).globalDevelopments;
  const items = lead ? [lead, ...secondary].slice(0, SECONDARY_COUNT + 1) : [];

  const railRef = useRef<HTMLDivElement | null>(null);
  const holdRef = useRef(false);
  const pausedRef = useRef(false);
  const rearmRef = useRef<number | null>(null);

  const [canScroll, setCanScroll] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Real overflow, measured rather than assumed: the released card widths and
  // gap mean a rail of four or fewer desktop cards has nothing to scroll.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => setCanScroll(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => () => {
    if (rearmRef.current !== null) window.clearTimeout(rearmRef.current);
  }, []);

  /** GN-CD-105 step algorithm, ported exactly, including the backward wrap. */
  const railStep = useCallback(
    (direction: 1 | -1): void => {
      const el = railRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>('[data-rail-card]');
      const step = card ? card.offsetWidth + RAIL_STEP_GAP : RAIL_STEP_FALLBACK;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      let target = el.scrollLeft + direction * step;
      if (target > max - 4) target = direction > 0 ? 0 : max;
      if (target < 0) target = max;
      el.scrollTo({ left: target, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    },
    [prefersReducedMotion],
  );

  /** GN-CD-108 railNudge — arrow activation pauses, then re-arms on a timer. */
  const railNudge = useCallback(
    (direction: 1 | -1): void => {
      if (rearmRef.current !== null) window.clearTimeout(rearmRef.current);
      pausedRef.current = true;
      railStep(direction);
      rearmRef.current = window.setTimeout(() => {
        pausedRef.current = false;
      }, MANUAL_REARM_MS);
    },
    [railStep],
  );

  // Reduced-motion users receive NO automatic movement at all — the interval
  // is never created, rather than created and skipped. Neither is it created
  // when there is nothing to scroll.
  useEffect(() => {
    if (prefersReducedMotion || !canScroll) return;

    const intervalId = window.setInterval(() => {
      if (!holdRef.current && !pausedRef.current) railStep(1);
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, canScroll, railStep]);

  const arrowBase =
    'grid place-items-center text-cd-ink-glyph transition-colors duration-cd-180 hover:text-cd-ink-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-cd-edge-focus';
  const arrowDesktop =
    'absolute top-1/2 z-[3] hidden h-cd-34 w-cd-34 -translate-y-1/2 rounded-full border border-cd-edge-control-active bg-cd-fill-rail-arrow backdrop-blur-[6px] hover:border-cd-accent-cyan focus-visible:border-cd-accent-cyan cd-hero:grid';
  const arrowMobile = 'h-cd-touch w-cd-touch cd-hero:hidden';

  return (
    <section className="relative mt-cd-14 cd-hero:mt-0" aria-labelledby="global-developments-heading">
      {/*
        DC-02 — renders nothing. Focuses this section's heading when the
        Intelligence Engine's World Intelligence module resolves its
        `/#global-developments-heading` destination. See the component's own
        file for why the viewport moving is not, by itself, sufficient.
      */}
      <GlobalDevelopmentsHashFocus />
      {/*
        GN-CD-100 — on desktop this is a bordered, radius-16 panel on its own
        gradient. On mobile the design authors NO container at all: no border,
        no radius, no background, no padding. Both are deliberate.
      */}
      <div className="relative cd-hero:overflow-hidden cd-hero:rounded-cd-16 cd-hero:border cd-hero:border-cd-edge-section cd-hero:bg-cd-trending cd-hero:px-cd-18 cd-hero:py-cd-16">
        {/* GN-CD-101 — 1px vertical rules every 88px. Desktop only, decorative. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-cd-rules-trending cd-hero:block"
        />

        {/* GN-CD-102/103 — header row. */}
        <div className="relative mb-cd-10 flex flex-wrap items-center justify-between gap-cd-10 cd-hero:mb-cd-13">
          <div className="min-w-0">
            <span className="block font-cd-mono text-cd-mono-section-m uppercase text-cd-ink-label cd-hero:text-cd-mono-section">
              {t.eyebrow}
            </span>
            {/*
              GN-CD-103 authors this label as a styled <div> and then reports
              its own DEFECT-009: no section on the home surface is a real
              heading, so the page cannot be navigated by heading at all. The
              production heading and its aria-labelledby relationship are kept
              rather than that defect being reproduced.
            */}
            {/*
              DC-02 — `tabIndex={-1}` makes this heading programmatically
              focusable without adding a Tab stop. It is what lets
              GlobalDevelopmentsHashFocus place focus here on hash activation.
              Nothing visual changes, and the id and text are untouched.

              G-001 — `scroll-mt-*` is the other half of that correction.

              This heading is the Intelligence Engine's World Intelligence
              destination (`/#global-developments-heading`). NavBar is
              `sticky top-0 z-50`, so without a scroll margin the browser's
              fragment scroll aligns this heading's box with the viewport top —
              i.e. underneath the header. Measured in Chromium: the resting
              offset was 0px against a 53/63px header, on direct arrival, on an
              in-page activation, and on a repeat activation alike.

              DC-02's `.focus()` does NOT rescue it. Once the fragment scroll
              has run, the element already counts as in view, so focusing it
              moves nothing — it simply lands focus on an element that is
              entirely behind the header, taking its `.cd-canvas
              :focus-visible` ring with it. The heading DC-02 exists to
              announce was invisible at the moment it was announced.

              `scroll-margin-top` RENDERS NOTHING. It has no effect on layout,
              paint or stacking; it is read only while the browser performs a
              scroll-into-view. The approved Claude Design appearance is
              therefore unchanged, which is the whole reason this correction
              was authorized to touch a released composition.

              The breakpoint is `cd-header`, not `sm`/`md`, because it is the
              breakpoint the HEADER ITSELF switches on (NavBar.tsx: `h-[52px]`
              below, `h-[62px]` at and above `cd-header` = 1400px, plus its
              1px bottom border). Mirroring it keeps the offset correct by
              construction if the header's own gate ever moves. The CTO-
              approved 65/75px carry ~12px of clearance over the 53/63px the
              header actually occupies, so the heading does not sit flush
              against the header edge and read as clipped.

              Applies identically under `prefers-reduced-motion`: globals.css
              switches `scroll-behavior` to `auto`, which changes how the
              scroll happens, never where it stops.
            */}
            <h2
              id="global-developments-heading"
              tabIndex={-1}
              className="scroll-mt-[65px] mt-cd-4 font-cd-display text-2xl font-medium tracking-tight text-cd-ink-primary sm:text-3xl cd-header:scroll-mt-[75px]"
            >
              {t.headline}
            </h2>
          </div>

          <div className="flex items-center gap-cd-10">
            {dataMode && <DataModeLabel dataMode={dataMode} language={language} />}
            {canScroll && (
              <div className="-mx-cd-4 -my-cd-16 flex items-center gap-cd-2 cd-hero:hidden">
                <button
                  type="button"
                  aria-label={t.previousLabel}
                  onClick={() => railNudge(-1)}
                  className={`${arrowBase} ${arrowMobile}`}
                >
                  <span aria-hidden="true">&#8249;</span>
                </button>
                <button
                  type="button"
                  aria-label={t.nextLabel}
                  onClick={() => railNudge(1)}
                  className={`${arrowBase} ${arrowMobile}`}
                >
                  <span aria-hidden="true">&#8250;</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {!lead ? (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-void/60 px-4 py-2.5 backdrop-blur-sm">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-amber-400">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {t.unavailableLabel}
              </span>
              <p className="mt-1 text-xs text-ink-secondary">{t.unavailable}</p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {[
                { label: t.statusFeedUnavailable, ok: false },
                { label: t.statusCountryAvailable, ok: true },
                { label: t.statusSearchAvailable, ok: true },
                { label: t.statusMapAvailable, ok: true },
                { label: t.statusWaitingProvider, ok: false },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="flex w-[160px] shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-surface p-3"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${tile.ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  />
                  <p className="font-mono text-[10px] uppercase leading-snug tracking-wide text-ink-tertiary">
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /*
            GN-CD-100 SS-D — the pause wrapper. Pointer and focus hold live
            here so the whole rail region, arrows included, holds the
            auto-advance while a user is working with it.
          */
          <div
            className="relative"
            onMouseEnter={() => {
              holdRef.current = true;
            }}
            onMouseLeave={() => {
              holdRef.current = false;
            }}
            onFocus={() => {
              holdRef.current = true;
            }}
            onBlur={() => {
              holdRef.current = false;
            }}
          >
            {canScroll && (
              <>
                <button
                  type="button"
                  aria-label={t.previousLabel}
                  onClick={() => railNudge(-1)}
                  className={`${arrowBase} ${arrowDesktop} left-[-19px]`}
                >
                  <span aria-hidden="true">&#8249;</span>
                </button>
                <button
                  type="button"
                  aria-label={t.nextLabel}
                  onClick={() => railNudge(1)}
                  className={`${arrowBase} ${arrowDesktop} right-[-19px]`}
                >
                  <span aria-hidden="true">&#8250;</span>
                </button>
              </>
            )}

            {/* GN-CD-105 — the rail viewport. */}
            <div
              ref={railRef}
              role="region"
              aria-roledescription="carousel"
              aria-label={t.headline}
              className="-mx-cd-14 flex gap-cd-11 snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-cd-14 pb-cd-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] cd-hero:mx-0 cd-hero:gap-cd-12 cd-hero:px-0 cd-hero:pb-cd-2 [&::-webkit-scrollbar]:hidden"
            >
              {items.map((item, index) => (
                <TrendingCard
                  key={item.id}
                  article={item}
                  language={language}
                  isLead={index === 0}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
