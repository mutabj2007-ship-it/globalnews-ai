'use client';

import { useEffect, useState, useRef, type FormEvent, type ChangeEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { resolveInitialLanguage, persistLanguageSelection, readLanguageCookie } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { HeroWorldVisual } from '@/components/home/HeroWorldVisual';
import { HUD_CARD_CLIP } from '@/components/home/hudPanelGeometry';
import { HeroWorldVisualMobile } from '@/components/home/HeroWorldVisualMobile';

const ROTATION_INTERVAL_MS = 3200;
/** How many real HomeFeed articles the compact live-feed panel shows — small enough to stay a compact edge panel, not a duplicate news section. */
const FEED_PANEL_COUNT = 3;

interface HeroProps {
  /** CTO Frontend Visual Revision (continuation), Section 12 — the compact "Global Intelligence / Live Feed" panel. Reuses the SAME already-fetched HomeFeed data page.tsx passes down; this introduces zero new fetch. Optional and defaults to empty so any pre-existing caller (none currently exist without this prop, but kept defensive) still renders correctly. */
  latestArticles?: NewsArticle[];
}

/**
 * Milestone #47 (homepage integration) — the language selector now
 * lives here, BEFORE the user ever submits a question, closing the
 * exact defect this correction targets: language was previously only
 * selectable after reaching /search.
 *
 * Reuses the SAME LanguageSelector component and the SAME
 * resolveInitialLanguage()/persistLanguageSelection() localStorage
 * mechanism SearchPageClient.tsx already uses — one shared,
 * single-source-of-truth language state, never a second independent
 * one. A language chosen here is picked up automatically by
 * SearchPageClient's own resolveInitialLanguage() call on mount, with
 * NO change needed to the `/search?q=...` navigation itself — this is
 * why `handleSubmit` below is untouched from the pre-existing
 * architecture; localStorage alone bridges the two pages.
 *
 * Only en/pl are ever rendered as options here — see
 * LanguageSelector.tsx / ACTIVE_LANGUAGES in i18n/languages.ts.
 *
 * Localizes this component's OWN principal messaging (badge, headline,
 * subhead, input placeholder/aria-labels, "Try:" prefix, and — as of
 * the Defect 2 correction — the rotating example questions
 * themselves) via the same dictionary architecture already used on
 * /search. The rotating examples now come from
 * dictionary.hero.exampleQuestions (a parallel, translated array) —
 * lib/homeContent.ts's own exampleSearches export is no longer
 * imported here at all, so the SAME 6 questions are shown, fully
 * localized, with the identical rotation timing/animation logic as
 * before.
 */
export function Hero({ latestArticles = [] }: HeroProps): JSX.Element {
  const router = useRouter();
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [query, setQuery] = useState('');
  // Query-limit correction — mirrors AnalyzeNewsDto.query's own
  // @MaxLength(1000). Enforced client-side via the textarea's own
  // maxLength attribute (so a user simply cannot type past it) and
  // used here only to drive the live character-count display.
  const QUESTION_MAX_LENGTH = 1000;
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [language, setLanguage] = useState<LanguageCode>('en');
  const [hasResolvedLanguage, setHasResolvedLanguage] = useState(false);
  const t = getDictionary(language).hero;

  /**
   * Milestone #47 (correction round 2, Blocker 2) — synchronizes a
   * browser-detected client language with the language the Server
   * Component actually used to render the already-delivered homepage
   * feed, WITHOUT an unconditional refresh on every load.
   *
   * LOOP-PREVENTION MECHANISM (why this cannot repeat):
   * 1. This effect has an empty dependency array — it runs exactly
   *    ONCE per real mount of this component.
   * 2. `router.refresh()` re-renders Server Components on the current
   *    route, but does NOT unmount/remount already-mounted Client
   *    Components — Hero is not destroyed and recreated by a refresh,
   *    so this effect does not fire again as a result of calling it.
   * 3. The refresh is CONDITIONAL: it only happens when `resolved`
   *    (what the client determines the language should be) differs
   *    from `effectiveServerLanguage` (what page.tsx actually used —
   *    reconstructed here via the SAME `cookie ?? 'en'` fallback logic
   *    page.tsx itself applies, read via readLanguageCookie()). Once
   *    triggered, the resulting page.tsx re-render reads the
   *    now-freshly-set cookie, so on any SUBSEQUENT mount (e.g. a
   *    genuine full page reload) `effectiveServerLanguage` already
   *    equals `resolved` and no further refresh fires — this is a
   *    one-time correction per divergence, never a sustained loop.
   *
   * Concretely: a first-time Polish-browser visitor has no cookie yet
   * -> effectiveServerLanguage resolves to 'en' (page.tsx's own
   * default, Blocker 1) -> resolveInitialLanguage() detects 'pl' from
   * navigator.language -> resolved ('pl') !== effectiveServerLanguage
   * ('en') -> persist + refresh -> Hero=pl, cookie=pl, feed re-fetches
   * as pl. A default-English visitor: effectiveServerLanguage='en',
   * resolved='en' -> equal -> no refresh, no wasted request.
   */
  useEffect(() => {
    const effectiveServerLanguage = readLanguageCookie() ?? 'en';
    const resolved = resolveInitialLanguage();

    setLanguage(resolved);
    setHasResolvedLanguage(true);

    if (resolved !== effectiveServerLanguage) {
      persistLanguageSelection(resolved);
      router.refresh();
    }
  }, [router]);

  function handleLanguageChange(next: LanguageCode): void {
    setLanguage(next);
    persistLanguageSelection(next);
    // Milestone #47 (homepage feed language correction): the homepage
    // feed below Hero is rendered by a Server Component (page.tsx) that
    // only re-runs on navigation/refresh — changing the client-side
    // `language` state here does NOT, by itself, cause the already-
    // rendered feed sections to re-fetch. router.refresh() (the SAME
    // router instance already used for the existing search
    // navigation below, no new import) re-runs the Server Component on
    // the next request, which now reads the cookie
    // persistLanguageSelection() just set above and re-requests the
    // feed in the new language — the smallest safe mechanism, with NO
    // component converted to a client component and NO new fetch
    // logic added here in Hero.tsx itself. This is a direct, explicit
    // user action, so it always refreshes unconditionally — unlike the
    // mount-time sync effect above, there is no "already matches"
    // case to skip here.
    router.refresh();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      const swapTimeout = setTimeout(() => {
        setSuggestionIndex((current) => (current + 1) % t.exampleQuestions.length);
        setIsVisible(true);
      }, 350);
      return () => clearTimeout(swapTimeout);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
    // Milestone #47 (Defect 2 correction): `language` is a dependency
    // so this effect's closure always uses the CURRENT language's
    // exampleQuestions array length — without this, a language change
    // after mount would keep advancing the rotation index against the
    // array length captured at first render. Both current arrays are
    // the same length (6), so this was latent rather than visibly
    // broken, but is fixed for correctness now that this effect
    // depends on dictionary-driven, per-language data.
  }, [language, t.exampleQuestions.length]);

  // Query-limit correction — auto-grow the textarea as content wraps,
  // capped by the CSS max-height already applied to the element (see
  // the className below) so growth stops and the textarea scrolls
  // internally beyond that point, rather than growing unboundedly.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [query]);

  // Query-limit correction — Enter submits (matching the prior
  // single-line <input>'s native behavior); Shift+Enter inserts a
  // literal newline instead, since a <textarea> does not submit its
  // form on Enter the way an <input> does. Uses the form's own native
  // requestSubmit() rather than duplicating handleSubmit's logic.
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

    // Milestone #47: UNCHANGED from the pre-existing architecture — no
    // language query parameter is added here. The language selected
    // above was already persisted to localStorage the moment it
    // changed (see handleLanguageChange), and SearchPageClient's own
    // resolveInitialLanguage() reads that same key on mount, so it
    // carries over automatically without altering this navigation call
    // or its URL shape at all.
    //
    // Natural-language questions are supported as-is — punctuation like
    // "?" or apostrophes is safe; the query is sent to the dedicated
    // results page, which calls the backend, which sends it to the
    // configured news provider.
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="relative overflow-hidden border-b border-border bg-void">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
      {/* CTO continuation, priority 2 — a shared cyan atmosphere spanning BOTH Hero columns, so the world visualization reads as emerging from the same Hero background rather than a separate boxed card floating beside the text. */}
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_70%_60%_at_75%_45%,rgba(34,211,238,0.10),transparent_65%)] lg:block" />

      {/*
        Milestone #47 (homepage integration) — placed as a small,
        unobtrusive row at the very top of the hero content, ahead of
        everything else (badge/headline/form), so it is unambiguously
        visible BEFORE the user can submit a question. Uses the exact
        same LanguageSelector already proven on /search, so it reads as
        the same control, not a second, unrelated one.
      */}
      <div className="relative mx-auto flex max-w-4xl justify-end px-4 pt-6 sm:px-6 lg:px-8">
        <LanguageSelector
          value={language}
          onChange={handleLanguageChange}
          label={getDictionary(language).languageSelectorLabel}
        />
      </div>

      <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-6 px-4 pb-8 pt-6 sm:px-6 sm:pb-10 lg:grid-cols-[0.31fr_0.50fr_0.19fr] lg:gap-5 lg:px-8 lg:pb-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-bright opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-bright" />
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary">
              {t.badge}
            </span>
          </div>

          <h1 className="max-w-xl font-display text-3xl font-medium leading-[1.05] tracking-tight text-ink-primary sm:text-4xl lg:text-[2.75rem]">
            {t.headline}
          </h1>

          <p className="mt-4 max-w-md text-balance text-sm text-ink-secondary sm:text-base">
            {t.subhead}
          </p>

          {/* Compact mobile-only world visual — lightweight partial-horizon strip, not the desktop visual hidden/shown; see HeroWorldVisualMobile's own doc comment. Keeps geographic/global identity present on mobile without the desktop's full visual weight. */}
          <div className="mt-6 h-24 w-full max-w-2xl lg:hidden">
            <HeroWorldVisualMobile />
          </div>

          {/* Signal dial: pulse rings that echo the search bar's own shape */}
          <div className="relative mt-6 w-full max-w-xl">
            <div
              className={`pointer-events-none absolute inset-0 border border-cyan-400/40 animate-ring-pulse ${HUD_CARD_CLIP}`}
              aria-hidden="true"
            />

            <form
              ref={formRef}
              role="search"
              aria-label={t.formAriaLabel}
              onSubmit={handleSubmit}
              className={`relative flex items-end gap-2.5 border border-cyan-500/30 bg-void/80 px-3.5 py-2.5 backdrop-blur-sm transition-colors focus-within:border-cyan-400 ${HUD_CARD_CLIP}`}
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 text-cyan-400"
              >
                <Search size={13} strokeWidth={2} />
              </span>
              {/*
                Query-limit correction — converted from a single-line
                <input> to an auto-growing <textarea>. rows={1} plus
                matching padding/line-height keeps the initial rendered
                height visually equivalent to the prior input; the
                useEffect above grows it as content wraps, capped by
                max-h-40 (~8 lines at this font size) beyond which it
                scrolls internally via overflow-y-auto rather than
                growing unboundedly. maxLength enforces the 1000-char
                limit natively; Enter submits (via handleTextareaKeyDown
                below), Shift+Enter inserts a literal newline.
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
                className="max-h-40 w-full resize-none overflow-y-auto bg-transparent text-sm leading-6 text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
              />
              <button
                type="submit"
                aria-label={t.submitAriaLabel}
                className="hidden shrink-0 items-center justify-center rounded-full bg-cyan-500 p-2 text-void transition-colors hover:bg-cyan-400 sm:flex"
              >
                <ArrowRight size={15} strokeWidth={2.25} />
              </button>
            </form>

            {/*
              Query-limit correction — live character count, kept
              visually subordinate: invisible until the user
              approaches the limit (800+), then a plain count, turning
              into an explicit "maximum reached" message once the
              1000-char cap is hit. aria-live announces the
              limit-reached state to screen reader users without
              chattering on every keystroke below that threshold.
              Accessibility correction — this element is now ALWAYS
              rendered with the same id, matching the textarea's
              aria-describedby, which must resolve to a real element
              at all times, not one conditionally absent from the DOM.
              Below the 800-char threshold it uses sr-only (visually
              hidden but still present in the accessibility tree,
              never `hidden`/display:none, which would remove it from
              that tree too) with empty content, so nothing gets
              announced on every keystroke; at 800+ it becomes visually
              present with real, live-updating content exactly as
              before.
            */}
            <p
              id="hero-question-char-count"
              aria-live="polite"
              className={
                query.length >= 800
                  ? `mt-1.5 text-right font-mono text-[11px] ${
                      query.length >= QUESTION_MAX_LENGTH ? 'text-amber-400' : 'text-ink-tertiary'
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

            {/* Rotating example suggestions — intentionally NOT translated, see this file's own doc comment. */}
            <div className="mt-3 flex h-5 items-center justify-center gap-2 font-mono text-[11px] text-ink-tertiary sm:justify-start">
              <span className="shrink-0 text-ink-tertiary/70">{t.tryPrefix}</span>
              <span
                key={suggestionIndex}
                className={isVisible ? 'animate-fade-slide-in' : 'animate-fade-slide-out'}
              >
                &ldquo;{t.exampleQuestions[suggestionIndex]}&rdquo;
              </span>
            </div>

            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-start">
              <a
                href="/map"
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-cyan-400 hover:text-cyan-300"
              >
                {t.exploreMapCta}
              </a>
            </div>

            {/* Credibility row — only truthful, generic capability terms; no unsupported numeric claims. */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
              {[t.credibilityLiveSources, t.credibilityAiAnalysis, t.credibilityEvidence].map((label) => (
                <li key={label} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-signal-bright" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ambient intelligence visualization — CTO Frontend Visual Revision: now HeroWorldVisual, using REAL world geometry (equirectangular-projected SVG, see its own doc comment), not the earlier abstract dot-grid. Deliberately decorative/ambient, distinct from the real Global Situation Map further down the page.
            M60 Phase 2 — this is now its OWN dedicated grid column (the middle ~50% zone), with nothing absolutely positioned on top of it: the live-intelligence panel that previously overlaid its right edge is now a genuine third sibling column below, so the map is never obscured. */}
        <div className="relative hidden h-[520px] lg:block">
          <HeroWorldVisual />
        </div>

        {/* Global Intelligence / Live Feed — M60 Phase 2: promoted from an absolutely-positioned overlay on top of the map to its own real grid column (the right ~19% zone), matching the approved reference composition. Same real HomeFeed data (zero new fetch), same truthful fallback when unavailable — only the layout position changed. Visible at the same lg: breakpoint the 3-column grid itself activates, since it is now load-bearing layout, not an overlay reserved for extra-wide screens. */}
        <div className="relative hidden h-[520px] w-full flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-void/90 p-3 shadow-[0_0_30px_-8px_rgba(34,211,238,0.3)] backdrop-blur-md lg:flex">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-cyan-400/60" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">{t.feedPanelEyebrow}</span>
          <span className="mb-3 font-display text-sm font-medium text-ink-primary">{t.feedPanelHeading}</span>

          {latestArticles.length > 0 ? (
            <ul className="flex flex-1 flex-col gap-2.5 overflow-hidden">
              {latestArticles.slice(0, FEED_PANEL_COUNT).map((item) => (
                <li key={item.id} className="border-t border-border/60 pt-2.5 first:border-t-0 first:pt-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block transition-colors hover:text-cyan-300"
                  >
                    <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-tertiary">
                      {formatRelativeTime(item.publishedAt, language)}
                      <span aria-hidden="true">&middot;</span>
                      {item.category}
                    </span>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-secondary">{item.title}</p>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col gap-3 border-t border-amber-500/20 pt-3">
              <div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-amber-400">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {t.feedPanelUnavailableHeading}
                </span>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{t.feedPanelUnavailableBody}</p>
              </div>

              <dl className="flex flex-col gap-1.5 border-t border-border/50 pt-2.5">
                {[t.feedPanelSearchStatus, t.feedPanelCountryStatus, t.feedPanelMapStatus].map((label) => (
                  <div key={label} className="flex items-center justify-between">
                    <dt className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">{label}</dt>
                    <dd className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-emerald-400" />
                      {t.feedPanelAvailable}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="text-[11px] leading-relaxed text-ink-tertiary">{t.feedPanelUnavailableFooter}</p>
            </div>
          )}

          <a
            href="/map"
            className="mt-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-cyan-400 transition-colors hover:text-cyan-300"
          >
            {t.feedPanelViewMap}
            <ArrowRight size={11} strokeWidth={2.5} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
