'use client';

import { useEffect, useState, useRef, type FormEvent, type ChangeEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { resolveInitialLanguage, persistLanguageSelection, readLanguageCookie } from '@/lib/i18n/languages';
import { resolveLiveStatus } from '@/lib/liveStatus';
import { useHeroFocus } from '@/components/home/HeroFocusProvider';
import { IntelligenceContextCard } from '@/components/home/IntelligenceContextCard';
import { countryFocusPoint } from '@/lib/heroFocusTarget';
import { categoryChannel } from '@/components/home/TrendingCard';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HeroHud } from '@/components/home/HeroHud';
import { HeroIntelligenceField } from '@/components/home/HeroIntelligenceField';
import { HeroLiveFeedPanel } from '@/components/home/HeroLiveFeedPanel';

const ROTATION_INTERVAL_MS = 3200;

interface HeroProps {
  /** The Global Intelligence / Live Feed panel. Reuses the SAME already-fetched HomeFeed data page.tsx passes down; this introduces zero new fetch. */
  latestArticles?: NewsArticle[];
  /**
   * M65 — the resolved page language, supplied by the Server Component
   * that already read the cookie. Passed in rather than resolved here so
   * the server render and the first client render always agree; see the
   * mount effect below for the browser-language case.
   */
  language?: LanguageCode;
  /**
   * M65 — real freshness state for the desktop DATA STATUS row, which
   * the approved design places inside Hero's own left column. These are
   * the SAME real feed.isLive / feed.dataMode values page.tsx already
   * passes to LiveStatusStrip for mobile, resolved through the shared
   * resolveLiveStatus() so both surfaces compute one truth.
   */
  isLive?: boolean;
  dataMode?: NewsDataMode | null;
  /**
   * M65 — the real freshness instant, resolved ONCE by page.tsx and
   * passed down. Deliberately REQUIRED, not defaulted: Hero is a Client
   * Component, and any fallback that is not a genuinely passed-in time
   * would reintroduce exactly the imperative `new Date()` render-time
   * generation this removes, letting the mobile strip and the desktop
   * row disagree about the same instant.
   */
  updatedAt: string;
}

/**
 * Hero / Global Intelligence — GN-CD-040 → GN-CD-076.
 *
 * M65 reconstructed this surface from the recovered design. M66.3 reconciles it
 * against the released specification under the CTO authorization of the same
 * name. Real behaviour is untouched; what changes is geometry, composition and
 * the mobile ladder.
 *
 * ── THE COMPOSITION, AND WHY IT WAS NARROW ────────────────────────────────
 *
 * GN-CD-040 composes the Hero as `minmax(0,470px) minmax(0,1fr) 312px` with NO
 * gap, inside a surface that IS the page content box — 1388px at the native
 * 1440px viewport. M66.1's PageCanvas already delivers exactly that box
 * (`max-w-cd-page` 1500 less `lg:px-cd-26` 26x2 = 1388 at 1440), so the outer
 * foundation was never the problem. The Hero's own wrapper was: a `max-w-[1600px]`
 * cap that could never bind inside a 1500px canvas, `lg:px-8` (-64px), and
 * `lg:gap-5` (-40px, taken entirely from the map track). Together they cut the
 * map track from 606px to 502px, and a `left: max(22%, 470px)` floor on the map
 * mount deleted the designed underlap beneath the headline as well, leaving the
 * visible map band at 542px against the released 770.6px. Per CTO decision L-9
 * those Hero-local constraints are removed here; PageCanvas is untouched.
 *
 * ── THE HANDOFF (CTO decision L-1A) ───────────────────────────────────────
 *
 * The console renders at and above `cd-hero` (1240px); the authored mobile Hero
 * card renders below it. GN-CD §B leaves 768-1360 without a composition
 * (UNRESOLVED-001/002) and the prototype's own answer is an 80px horizontal
 * scroll, which M66.1 decision D4 rejected. At the previous `lg` gate the map
 * track computed to 138px at 1024px — a sliver. Desktop and mobile are
 * independently authored, never one scaled into the other.
 *
 * ── FUNCTIONAL TRUTH, COMPLETELY UNCHANGED ────────────────────────────────
 *
 *   - handleSubmit still routes to /search?q=<encodeURIComponent(query)>, which
 *     is what reaches analysisApi -> POST /analysis/news;
 *   - the 1000-char cap mirroring AnalyzeNewsDto, Enter / Shift+Enter, the
 *     auto-growing textarea and the aria-describedby character count are all
 *     byte-identical in behaviour;
 *   - latestArticles is the real HomeFeed data, from the single
 *     getHomeFeed(language) request. No prototype headline, no demonstration
 *     article, no second fetch;
 *   - DATA STATUS is real: badge text and colour come from resolveLiveStatus(),
 *     never a hardcoded "LIVE", and a cached, mock or reconnecting state is
 *     never dressed in the design's live-green treatment. The design's own
 *     hardcoded prototype clock literal is not adopted;
 *   - the mount-time browser-language sync still calls router.refresh() so the
 *     Server-Component feed follows the resolved language;
 *   - the visible language control still lives in the header (NavBar). A second
 *     one here would be a duplicate, not a second legitimate presentation.
 *
 * ── DATA STATUS ON TWO LINES (CTO decision L-2A) ──────────────────────────
 *
 * GN-CD-056 composes the row as `DATA STATUS` + a LIVE pill + `· LAST UPDATED
 * {t} UTC`, sized around the design's four-character `LIVE` literal. Production
 * carries the honest provenance string instead, and measured against the
 * released 418px text box the row overflows in nine of ten language x state
 * combinations — up to +274px for Polish demo mode. The fix is structural only:
 * the timestamp moves to its own line and the primary row may wrap, so the pill
 * is never abbreviated, truncated or hidden and no dictionary string changes.
 *
 * ── WHAT IS DELIBERATELY ABSENT (CTO decisions L-6A, L-7, L-8) ────────────
 *
 * GN-CD-066 category controls are omitted: there is no real signal dataset to
 * filter, and repurposing them as navigation is out of scope this milestone.
 * GN-CD-067's signal preview, GN-CD-069b's `{n} ACTIVE SIGNALS · 118 COUNTRIES`
 * readout, GN-CD-048/049's evidence-scope focus radii and GN-CD-051's
 * relationship paths are all data claims with no backing route and are not
 * fabricated. GN-CD-068's EXPAND MAP IS implemented, because /map is a real
 * destination — as a real keyboard-reachable link, which the prototype's own
 * version is not (DEFECT-004).
 *
 * GN-CD-063's decorative caret is also omitted. The specification itself records
 * that it coexists with the browser's real caret, producing two carets in a
 * focused field (UNRESOLVED-020), and the authorization forbids reproducing
 * prototype accessibility defects.
 */
export function Hero({
  latestArticles = [],
  language = 'en',
  isLive = false,
  dataMode = null,
  updatedAt,
}: HeroProps): JSX.Element {
  const router = useRouter();
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [query, setQuery] = useState('');
  // Mirrors AnalyzeNewsDto.query's own @MaxLength(1000). Enforced
  // client-side via the textarea's own maxLength attribute (so a user
  // simply cannot type past it) and used here only to drive the live
  // character-count display.
  const QUESTION_MAX_LENGTH = 1000;
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = getDictionary(language).hero;
  /*
    M66.13 — `statusKey` is now destructured too. resolveLiveStatus has always
    returned it — liveStatus.ts exposes it "for callers that need to branch on it
    directly rather than re-deriving it from badgeText" — it simply was not read
    here. It is handed to HeroLiveFeedPanel so the feed's status line and its
    amber live cue come from the SAME resolver as this row, instead of the panel
    inferring liveness from articles.length. No new computation is introduced.
  */
  const { isReallyLive, statusKey, badgeText, lastUpdated } = resolveLiveStatus(isLive, dataMode, language, updatedAt);

  /*
    M66.14B — Hero READS focus and owns none of it.

    The state lives in HeroFocusProvider, which wraps this component and
    GlobalDevelopments together. Hero's job is to turn a focused country code
    into the point and colour the decorative field needs, and to place the
    context card.

    Hero deliberately does not touch article FIELDS here — Hero.spec.ts:85
    forbids `latestArticles.` in this file, and that contract still holds:
    focus.countryCode and focus.category come from the provider, which built
    them from the one article the reader actually interacted with.

    A focus whose country did not resolve yields a null target, so the map
    returns to its released idle render rather than keeping the previous
    article's country on screen.
  */
  const { focus } = useHeroFocus();
  const focusCountryPoint = focus?.countryCode ? countryFocusPoint(focus.countryCode) : null;
  const fieldFocus = focusCountryPoint
    ? {
        lon: focusCountryPoint[0],
        lat: focusCountryPoint[1],
        channel: categoryChannel(focus?.category),
      }
    : null;

  /**
   * Milestone #47 (correction round 2, Blocker 2) — synchronizes a
   * browser-detected client language with the language the Server
   * Component actually used to render the already-delivered homepage
   * feed, WITHOUT an unconditional refresh on every load.
   *
   * LOOP-PREVENTION MECHANISM (why this cannot repeat):
   * 1. This effect has an empty dependency array — it runs exactly ONCE
   *    per real mount of this component.
   * 2. router.refresh() re-renders Server Components on the current
   *    route but does NOT unmount/remount already-mounted Client
   *    Components, so this effect does not fire again as a result of
   *    calling it.
   * 3. The refresh is CONDITIONAL: it only happens when what the client
   *    resolves differs from what the server actually used
   *    (reconstructed via the SAME `cookie ?? 'en'` fallback page.tsx
   *    itself applies). Once triggered, the resulting page.tsx re-render
   *    reads the now-freshly-set cookie, so on any subsequent mount the
   *    two already agree and no further refresh fires.
   *
   * M65 — this stays inside an effect, never in render: reading
   * localStorage during render would make the server and client first
   * renders disagree and produce a hydration mismatch.
   */
  useEffect(() => {
    const effectiveServerLanguage = readLanguageCookie() ?? 'en';
    const resolved = resolveInitialLanguage();

    if (resolved !== effectiveServerLanguage) {
      persistLanguageSelection(resolved);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setSuggestionIndex((current) => (current + 1) % t.exampleQuestions.length);
        setIsVisible(true);
      }, 350);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
    // `language` is a dependency so this effect's closure always uses
    // the CURRENT language's exampleQuestions array length.
  }, [language, t.exampleQuestions.length]);

  // Auto-grow the textarea as content wraps, capped by the CSS
  // max-height already applied to the element so growth stops and the
  // textarea scrolls internally rather than growing unboundedly.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [query]);

  // Enter submits (matching the prior single-line <input>'s native
  // behavior); Shift+Enter inserts a literal newline instead, since a
  // <textarea> does not submit its form on Enter the way an <input>
  // does. Uses the form's own native requestSubmit().
  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // UNCHANGED: no language query parameter is added here. The language
    // selected in the header was already persisted the moment it
    // changed, and the search page reads that same source, so it carries
    // over without altering this navigation call or its URL shape.
    //
    // Natural-language questions are supported as-is — punctuation like
    // "?" or apostrophes is safe; the query is sent to the dedicated
    // results page, which calls the backend, which sends it to the
    // configured news provider.
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="relative">
      {/*
        GN-CD-040 — THE HERO SURFACE. It is the page content box: no width cap,
        no padding and no gap of its own on desktop (CTO decision L-9), so the
        released 470 / 606 / 312 tracks compose exactly. Below `cd-hero` it is
        the authored mobile card: radius 16, border .16, its own radial centred
        at 92% 6% under the map bleed, padding 13/14/15.
      */}
      <div className="relative overflow-hidden rounded-cd-16 border border-cd-edge-section bg-cd-void bg-cd-hero-m px-cd-14 pb-cd-15 pt-cd-13 cd-hero:rounded-cd-18 cd-hero:border-cd-edge-card cd-hero:bg-cd-hero cd-hero:p-0">
        {/*
          Z01 · GN-CD-041 — the 44px technical grid. Desktop only: the design
          verifies the mobile hero has no orthogonal grid, deliberately, because
          the HUD carries the technical read at that size.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-cd-grid-hero bg-cd-grid-44 cd-hero:block"
        />

        {/* Z02 · GN-CD-042 / 042b — the construction HUD, authored separately per viewport. */}
        <HeroHud />

        {/*
          Z03 · GN-CD-043 — the map mount, at its released percentages. It begins
          at 22% (inside the text column) and ends at 87%, so it runs beneath the
          headline and beneath the feed panel. That underlap is the mechanism
          that makes the Hero read as one surface rather than a map in a box
          (GN-CD §U.2); the old max(22%,470px) floor removed it.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 top-0 hidden cd-hero:block"
          style={{ left: '22%', right: '13%' }}
        >
          <HeroIntelligenceField focus={fieldFocus} />
        </div>

        {/*
          M66.14B — the intelligence context card.

          A SIBLING of the map wrapper above, never a child of it. That wrapper
          is aria-hidden and pointer-events-none, so a card placed inside it
          would be invisible to assistive technology — and announcing what a
          keyboard user just focused is the entire point of this chain.

          Desktop only in B-1: the mobile in-flow presentation that pushes the
          pillar grid down is B-2 and is deliberately not implemented here, so
          the smallest viewport is untouched by this milestone.

          The card returns null when nothing is focused, so it costs no layout
          until a reader interacts.
        */}
        <div className="pointer-events-none absolute bottom-cd-24 left-[22%] z-cd-10 hidden cd-hero:block">
          <IntelligenceContextCard language={language} />
        </div>

        {/*
          Z04 / Z05 · GN-CD-053 and GN-CD-054 — the edge scrims, anchored to the
          HERO SURFACE, not to the map field. This is the correction that matters
          most visually: anchored to the map field they landed ~170px inside it,
          banding the map body while leaving its actual left edge hard-cut.
          Explicitly pointer-events-none — GN-CD-053's own risk note is that a
          scrim which ever received pointer events would block the map beneath.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-[20%] hidden w-[16%] bg-cd-scrim-l cd-hero:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-[12%] hidden w-[12%] bg-cd-scrim-r cd-hero:block"
        />

        {/*
          GN-CD-043 mobile — the map bleed: a 238x198 box at right:-16px /
          top:-10px, deliberately overflowing the card and clipped by its
          overflow:hidden, under the two GN-CD-026 scrims. A child of the CARD,
          so those offsets are the released ones.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[16px] -top-[10px] h-[198px] w-[238px] overflow-hidden cd-hero:hidden"
        >
          <HeroIntelligenceField compact />
          <div className="pointer-events-none absolute inset-0 bg-cd-map-scrim-a" />
          <div className="pointer-events-none absolute inset-0 bg-cd-map-scrim-b" />
        </div>

        {/*
          Z06 · GN-CD-055 — the content grid. `position:relative` so it paints
          above all four background layers. No z-index anywhere in this family:
          order is DOM order.
        */}
        <div className="relative grid grid-cols-1 cd-hero:min-h-cd-hero-frame cd-hero:grid-cols-[minmax(0,470px)_minmax(0,1fr)_312px] cd-hero:items-stretch">
          {/* Z07 · GN-CD-055 column 1 — padding 20/26/24 on desktop; the card's own padding on mobile. */}
          <div className="relative flex flex-col cd-hero:px-cd-26 cd-hero:pb-cd-24 cd-hero:pt-cd-20">
            {/*
              GN-CD-056 — the DATA STATUS row. Desktop only: the mobile
              equivalent is the status strip above the card (GN-CD-223), and
              duplicating it inside the hero is exactly what the design forbids.

              Two lines, per CTO decision L-2A. The primary row wraps rather than
              clipping, so the complete provenance pill survives in every state
              and both languages.
            */}
            <div className="hidden flex-col gap-cd-4 font-cd-mono text-cd-mono-status uppercase cd-hero:flex">
              <div className="flex flex-wrap items-center gap-x-cd-10 gap-y-cd-6 text-cd-ink-muted">
                {t.dataStatusLabel}
                <span
                  className={`inline-flex items-center gap-cd-6 rounded-cd-5 border px-cd-9 py-cd-3 ${
                    isReallyLive
                      ? 'border-cd-edge-live bg-cd-fill-live text-cd-ink-live'
                      : 'border-[rgba(251,191,36,0.45)] bg-[rgba(72,52,16,0.5)] text-amber-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-cd-6 w-cd-6 shrink-0 rounded-full ${
                      isReallyLive ? 'animate-cd-live-dot bg-cd-live' : 'bg-amber-400'
                    }`}
                  />
                  {badgeText}
                </span>
              </div>
              <span className="text-cd-ink-meta">
                &middot; {t.lastUpdatedLabel} {lastUpdated} UTC
              </span>
            </div>

            {/* GN-CD-057 — the AI capability badge. Its bolt is aria-hidden; the design leaves it exposed (UNRESOLVED-019). */}
            <div className="mt-0 self-start rounded-cd-pill border border-[rgba(34,211,238,0.4)] px-cd-9 py-cd-4 font-cd-mono text-cd-mono-preview-cat-m uppercase text-cd-ink-label cd-hero:mt-cd-18 cd-hero:bg-cd-fill-badge cd-hero:px-cd-13 cd-hero:py-cd-6 cd-hero:text-cd-mono-status">
              <span aria-hidden="true">&#9889;</span> {t.badge}
            </div>

            {/*
              GN-CD-058 — the headline. Desktop keeps the released fluid clamp
              (50.4px at the native 1440px); mobile is the separately authored
              26px ladder, not the clamp floor.

              CTO decision L-3: the design's authored two-line <br /> is NOT
              reproduced. Production copy is a single translated dictionary
              string, and inserting a manual break would mean inventing a break
              point per language. Two or three lines is an intentional
              production-content divergence from GN-CD §U.8.
            */}
            <h1 className="mt-cd-12 font-cd-display text-cd-hero-m text-cd-ink-primary cd-hero:mt-cd-18 cd-hero:text-cd-hero">
              {t.headline}
            </h1>

            {/* GN-CD-059 — supporting copy, at its own measure per viewport. */}
            <p className="mt-cd-9 max-w-cd-copy-m text-balance font-cd-body text-cd-hero-copy-m text-cd-ink-secondary cd-hero:mt-cd-18 cd-hero:max-w-cd-copy cd-hero:text-cd-hero-copy">
              {t.subhead}
            </p>

            <div className="mt-cd-13 w-full cd-hero:mt-cd-18">
              {/* GN-CD-060 — the ask field. Its border breathes; it does not blink. */}
              <form
                ref={formRef}
                role="search"
                aria-label={t.formAriaLabel}
                onSubmit={handleSubmit}
                className="animate-cd-ask-field relative flex items-center gap-cd-9 rounded-cd-12 border border-cd-edge-control-active-32 bg-cd-fill-ask-m py-cd-7 pl-cd-12 pr-cd-7 focus-within:animate-none focus-within:border-cd-accent-cyan cd-hero:gap-cd-12 cd-hero:bg-cd-fill-ask cd-hero:py-cd-9 cd-hero:pl-cd-16 cd-hero:pr-cd-10"
              >
                {/* GN-CD-061 — the AI indicator: ring, halo, glowing core. */}
                <span
                  aria-hidden="true"
                  className="relative flex h-cd-17 w-cd-17 shrink-0 items-center justify-center rounded-full border-[1.5px] border-cd-edge-focus cd-hero:h-cd-20 cd-hero:w-cd-20"
                >
                  <span className="animate-cd-ai-halo absolute -inset-[3px] rounded-full border border-[rgba(34,211,238,0.32)] cd-hero:-inset-cd-4 cd-hero:border-cd-edge-focus-halo" />
                  <span className="animate-cd-ai-core h-cd-5 w-cd-5 rounded-full bg-cd-accent-cyan shadow-[0_0_8px_#22d3ee] cd-hero:h-cd-6 cd-hero:w-cd-6 cd-hero:shadow-[0_0_10px_#22d3ee]" />
                </span>

                {/*
                  GN-CD-062 — the input. A <textarea> rather than the design's
                  <input>: it carries the real 1000-character AnalyzeNewsDto cap,
                  the auto-grow, the Shift+Enter newline and the live count. The
                  container's focus-within border is the replacement focus
                  indicator the design's own `outline:none` leaves out
                  (DEFECT-007).
                */}
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setQuery(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={t.inputPlaceholder}
                  aria-label={t.inputAriaLabel}
                  aria-describedby="hero-question-char-count"
                  maxLength={QUESTION_MAX_LENGTH}
                  rows={1}
                  className="max-h-40 w-full resize-none overflow-y-auto bg-transparent font-cd-body text-cd-input leading-6 text-cd-ink-primary placeholder:text-cd-ink-muted focus:outline-none"
                />

                {/*
                  GN-CD-064 — the submit control. 44x44 on mobile to meet the
                  touch floor, 38x38 on desktop. It keeps its real accessible
                  name; the design's own button has none (UNRESOLVED-021).
                */}
                <button
                  type="submit"
                  aria-label={t.submitAriaLabel}
                  className="animate-cd-submit flex h-cd-44 w-cd-44 flex-none items-center justify-center rounded-cd-10 bg-gradient-to-b from-cd-accent-blue-strong to-cd-accent-blue-deep font-cd-body text-[17px] leading-none text-cd-ink-on-submit cd-hero:h-cd-38 cd-hero:w-cd-38 cd-hero:rounded-cd-9 cd-hero:text-[16px]"
                >
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </form>

              {/*
                Live character count, kept visually subordinate: sr-only (still
                in the accessibility tree, never display:none) until the user
                approaches the limit, then a plain count, then an explicit
                "maximum reached" message. Always rendered with the same id so
                the textarea's aria-describedby always resolves.
              */}
              <p
                id="hero-question-char-count"
                aria-live="polite"
                className={
                  query.length >= 800
                    ? `mt-cd-6 text-right font-cd-mono text-cd-feed-time ${
                        query.length >= QUESTION_MAX_LENGTH ? 'text-cd-ink-attention' : 'text-cd-ink-meta'
                      }`
                    : 'sr-only'
                }
              >
                {query.length >= 800
                  ? query.length >= QUESTION_MAX_LENGTH
                    ? t.questionMaxLengthReached
                    : `${query.length} / ${QUESTION_MAX_LENGTH}`
                  : ''}
              </p>

              {/* Rotating example questions — dictionary-driven, localized. Real product copy; the design has no slot for it. */}
              <div className="mt-cd-10 flex min-h-cd-20 items-center gap-cd-8 font-cd-mono text-cd-feed-time text-cd-ink-meta">
                <span className="shrink-0">{t.tryPrefix}</span>
                <span
                  key={suggestionIndex}
                  className={`truncate ${isVisible ? 'animate-fade-slide-in' : 'animate-fade-slide-out'}`}
                >
                  &ldquo;{t.exampleQuestions[suggestionIndex]}&rdquo;
                </span>
              </div>
            </div>

            {/*
              GN-CD-065 — the capability bullets. Desktop: a wrapping flex row at
              12.5px. Mobile: the authored two-column mono grid.

              The design's mobile rule adds `white-space:nowrap`, sized around
              its own 14-character "Evidence-Based". Real Polish copy
              ("Kontekst oparty na dowodach") does not fit a 161px cell, so the
              cells wrap instead of overflowing. Same class of decision as L-3:
              real translated copy governs, and no abbreviation is invented.
            */}
            <ul className="mt-cd-4 grid grid-cols-2 gap-x-cd-10 gap-y-cd-8 cd-hero:mt-cd-18 cd-hero:flex cd-hero:flex-wrap cd-hero:items-center cd-hero:gap-cd-16">
              {[
                t.credibilityLiveSources,
                t.credibilityAiAnalysis,
                t.credibilityEvidence,
                t.credibilityMultiPerspective,
              ].map((label) => (
                <li
                  key={label}
                  className="flex items-start gap-cd-5 font-cd-mono text-cd-mono-bullet-m text-cd-ink-tertiary cd-hero:items-center cd-hero:gap-cd-7 cd-hero:font-cd-body cd-hero:text-cd-bullet"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[3px] h-cd-4 w-cd-4 shrink-0 rounded-full bg-cd-accent-sky cd-hero:mt-0 cd-hero:h-cd-5 cd-hero:w-cd-5"
                  />
                  {label}
                </li>
              ))}
            </ul>

            {/*
              The real /map CTA — RETAINED per explicit prior CTO decision. It is
              working navigation to a real route; absence from the design
              evidence is not grounds for deleting real functionality.
            */}
            <a
              href="/map"
              className="mt-cd-13 inline-flex min-h-cd-touch items-center justify-center gap-cd-6 self-start rounded-cd-9 border border-cd-edge-control-active px-cd-14 font-cd-body text-cd-action text-cd-ink-tertiary transition-colors hover:border-cd-accent-cyan hover:text-cd-ink-label cd-hero:mt-cd-18 cd-hero:min-h-0 cd-hero:py-cd-8"
            >
              {t.exploreMapCta}
            </a>
          </div>

          {/*
            Z08 · GN-CD-055 / §D — column 2 is a TRANSPARENT OVERLAY above the
            map: pointer-events:none, with each interactive child re-enabling
            pointer-events:auto. That is what keeps the map clickable everywhere
            the overlay has no control.

            It holds exactly one control. GN-CD-066's category filters and
            GN-CD-067's signal preview are omitted (L-6A, L-8) because no real
            signal dataset exists behind them, and GN-CD-069b's
            "{n} ACTIVE SIGNALS · 118 COUNTRIES" readout is a prototype literal.
          */}
          <div className="pointer-events-none relative hidden cd-hero:block">
            {/* Z08.3 · GN-CD-068 — EXPAND MAP. A real link, so it is keyboard-reachable; the prototype's is not (DEFECT-004). */}
            <div className="absolute right-cd-6 top-cd-14 flex flex-col items-end gap-cd-7">
              <a
                href="/map"
                className="pointer-events-auto rounded-cd-8 border border-cd-edge-control-active bg-cd-fill-action px-cd-12 py-cd-6 font-cd-mono text-cd-mono-expand uppercase text-cd-ink-label backdrop-blur-[6px] transition-colors hover:border-cd-accent-cyan"
              >
                {t.exploreMapCta} <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>

          {/*
            Z09 · GN-CD-070 → 076 — the Live Feed. Desktop only: the design
            authors its absence on mobile and splits its status function into the
            mobile status strip above the card. Same real HomeFeed data, zero new
            fetch.
          */}
          <HeroLiveFeedPanel
            articles={latestArticles}
            language={language}
            statusKey={statusKey}
            className="hidden cd-hero:flex"
          />
        </div>
      </div>
    </section>
  );
}
