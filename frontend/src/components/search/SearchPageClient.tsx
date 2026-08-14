'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews, AnalysisApiError } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { AnalysisResultView } from '@/components/search/AnalysisResultView';
import { AnalysisModeBadge } from '@/components/search/AnalysisModeBadge';
import { SourceArticleCard } from '@/components/search/SourceArticleCard';
import { RetrievalContextStatus } from '@/components/search/RetrievalContextStatus';
import { SourceEntitiesPanel } from '@/components/search/SourceEntitiesPanel';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { resolveInitialLanguage, persistLanguageSelection } from '@/lib/i18n/languages';
import { getDictionary } from '@/lib/i18n/dictionaries';

export function SearchPageClient(): JSX.Element {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  /**
   * Milestone #51 Phase B — bounded, optional story anchor threaded
   * through from CountryArticleCard's "Ask GlobalNews AI about this"
   * action (see that file).
   *
   * CTO final correction — now also reads `articleId`. `undefined`
   * when there's no country anchor, so ordinary homepage/search Q&A
   * (which never sets these URL params) is completely unaffected.
   * `title` mirrors the already-present `q` param (StoryContext
   * requires it). articleId, when present, is what
   * AnalysisService uses server-side to resolve the exact selected
   * article as a trusted evidence anchor — countryCode alone could
   * not distinguish one Rwanda story from another.
   */
  const countryCodeParam = searchParams.get('countryCode');
  const articleIdParam = searchParams.get('articleId');
  const storyContext: StoryContext | undefined = countryCodeParam
    ? { title: query, countryCode: countryCodeParam, articleId: articleIdParam ?? undefined }
    : undefined;

  // Milestone #47 — resolved once on mount via
  // resolveInitialLanguage()'s explicit-override > browser > English
  // order; changing the selector re-persists and re-fetches.
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [hasResolvedLanguage, setHasResolvedLanguage] = useState(false);
  const dictionary = getDictionary(language);

  const [isLoading, setIsLoading] = useState(true);
  const [response, setResponse] = useState<AnalysisApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLanguage(resolveInitialLanguage());
    setHasResolvedLanguage(true);
  }, []);

  // Milestone #47 — smallest safe mechanism for dynamic <html lang>
  // without a routing rewrite: layout.tsx is a server component with a
  // statically-set lang="en" that has no access to this client-side
  // language state, so this component (already a client component,
  // already holding the resolved language) sets
  // document.documentElement.lang directly. This only updates while a
  // user is on the search page — other pages keep the layout's static
  // "en" — a genuine, disclosed partial limitation, not a full i18n
  // routing solution.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  function handleLanguageChange(next: LanguageCode): void {
    setLanguage(next);
    persistLanguageSelection(next);
  }

  useEffect(() => {
    // Milestone #47 — wait for the initial language resolution (reads
    // localStorage/navigator.language, both browser-only) before firing
    // the first request, so the very first fetch already uses the
    // correct language instead of always starting as English and
    // re-fetching immediately after.
    if (!hasResolvedLanguage) return undefined;

    let cancelled = false;

    if (!query.trim()) {
      setIsLoading(false);
      setResponse(null);
      setFetchError(dictionary.noQuestionMessage);
      return undefined;
    }

    setIsLoading(true);
    setFetchError(null);
    setResponse(null);

    analyzeNews(query, language, storyContext)
      .then((result) => {
        if (!cancelled) setResponse(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFetchError(error instanceof AnalysisApiError ? error.message : dictionary.genericFetchError);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, language, hasResolvedLanguage, dictionary.noQuestionMessage, dictionary.genericFetchError, countryCodeParam, articleIdParam]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      {/*
        Milestone #47 (runtime correction, Round 2): kept here too, on
        the results/search experience, so a user can change language
        for another query without returning to the homepage. Uses the
        SAME extracted LanguageSelector + persistLanguageSelection()
        component — one shared localStorage-backed state.

        KNOWN, DISCLOSED GAP (unresolved as of Round 2): the actual
        homepage/home-search component still needs its own
        <LanguageSelector> instance so the selector is visible BEFORE
        the first search is submitted. That file was never included in
        any context delivered for this milestone, and its exact path
        was not guessed at, per explicit instruction — this component
        alone cannot satisfy that requirement.
      */}
      <div className="mb-6 flex justify-end">
        <LanguageSelector
          value={language}
          onChange={handleLanguageChange}
          label={dictionary.languageSelectorLabel}
        />
      </div>

      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
          {dictionary.yourQuestion}
        </span>
        <h1 className="mt-2 text-balance font-display text-2xl font-medium text-ink-primary sm:text-3xl">
          {query || dictionary.noQuestionProvided}
        </h1>
      </div>

      {isLoading && <LoadingStages stages={[...dictionary.loadingStages]} />}

      {!isLoading && fetchError && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center" role="alert">
          <p className="text-sm text-ink-secondary">{fetchError}</p>
        </div>
      )}

      {!isLoading && !fetchError && response && (
        <div className="flex flex-col gap-10">
          <RetrievalContextStatus retrievalContext={response.retrievalContext} language={language} />
          <SourceEntitiesPanel sourceEntities={response.sourceEntities} language={language} />

          {response.analysis ? (
            <AnalysisResultView
              analysis={response.analysis}
              provenance={response.provenance}
              sourceDiversity={response.sourceDiversity}
              language={language}
            />
          ) : (
            /**
             * Milestone #30 — branches on `response.provenance.status`,
             * not merely on `analysis === null`, so "nothing to analyze"
             * (not-attempted, zero retrieved articles),
             * "AI broke while analyzing" (failed, articles may still be
             * shown below), and "AI produced something but it didn't
             * validate" (validation-rejected) never look identical to
             * the user. The badge alone already carries most of that
             * distinction (see AnalysisModeBadge); the paragraph below
             * adds the specific reason from analysisError when present.
             *
             * Milestone #47: the localized fallback strings below come
             * from the dictionary — analysisError itself (when present)
             * is still whatever the backend returned (English, per
             * Milestone #47's scope — backend error strings are not yet
             * localized) and is shown as-is, never silently replaced.
             */
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-3">
                <AnalysisModeBadge provenance={response.provenance} language={language} />
              </div>
              <p className="text-sm text-ink-secondary">
                {response.analysisError ??
                  (response.provenance.status === 'not-attempted'
                    ? dictionary.noEvidenceMessage
                    : dictionary.aiUnavailableMessage)}
              </p>
            </div>
          )}

          {response.articles.length > 0 && (
            <section>
              <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-signal-bright">
                {dictionary.originalSourcesHeading} ({response.articles.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {response.articles.map((article) => (
                  <SourceArticleCard key={article.id} article={article} language={language} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
