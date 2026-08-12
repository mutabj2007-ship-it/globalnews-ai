'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { resolveInitialLanguage, persistLanguageSelection, readLanguageCookie } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';

const ROTATION_INTERVAL_MS = 3200;

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
export function Hero(): JSX.Element {
  const router = useRouter();
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [query, setQuery] = useState('');

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

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-24 pt-10 text-center sm:px-6 sm:pb-32 lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-bright opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-bright" />
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary">
            {t.badge}
          </span>
        </div>

        <h1 className="max-w-3xl font-display text-4xl font-medium leading-[1.1] tracking-tight text-ink-primary sm:text-5xl md:text-6xl">
          {t.headline}
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-ink-secondary sm:text-lg">
          {t.subhead}
        </p>

        {/* Signal dial: pulse rings that echo the search bar's own shape */}
        <div className="relative mt-12 w-full max-w-2xl">
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl border border-signal/50 animate-ring-pulse"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl border border-signal/50 animate-ring-pulse [animation-delay:1.1s]"
            aria-hidden="true"
          />

          <form
            role="search"
            aria-label={t.formAriaLabel}
            onSubmit={handleSubmit}
            className="relative flex items-center gap-3 rounded-2xl border border-border-strong bg-surface px-5 py-4 shadow-[0_0_0_1px_rgba(61,111,255,0.08)] transition-colors focus-within:border-signal"
          >
            <Search size={20} className="shrink-0 text-ink-tertiary" strokeWidth={2} />
            <input
              type="text"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder={t.inputPlaceholder}
              aria-label={t.inputAriaLabel}
              className="w-full bg-transparent text-base text-ink-primary placeholder:text-ink-tertiary focus:outline-none sm:text-lg"
            />
            <button
              type="submit"
              aria-label={t.submitAriaLabel}
              className="hidden shrink-0 items-center justify-center rounded-xl bg-signal p-2.5 text-white transition-colors hover:bg-signal-bright sm:flex"
            >
              <ArrowRight size={18} strokeWidth={2.25} />
            </button>
          </form>

          {/* Rotating example suggestions — intentionally NOT translated, see this file's own doc comment. */}
          <div className="mt-4 flex h-6 items-center justify-center gap-2 font-mono text-xs text-ink-tertiary sm:text-sm">
            <span className="shrink-0 text-ink-tertiary/70">{t.tryPrefix}</span>
            <span
              key={suggestionIndex}
              className={isVisible ? 'animate-fade-slide-in' : 'animate-fade-slide-out'}
            >
              &ldquo;{t.exampleQuestions[suggestionIndex]}&rdquo;
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
