'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews, AnalysisApiError, type AnalysisApiErrorCode } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { AnalysisResultView } from '@/components/search/AnalysisResultView';
import { AnalysisModeBadge } from '@/components/search/AnalysisModeBadge';
import { SourceArticleCard } from '@/components/search/SourceArticleCard';
import { RetrievalContextStatus } from '@/components/search/RetrievalContextStatus';
import { SourceEntitiesPanel } from '@/components/search/SourceEntitiesPanel';
import { resolveInitialLanguage } from '@/lib/i18n/languages';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';

interface SearchPageClientProps {
  /**
   * M65 — the language the Server Component already resolved from the
   * cookie. Seeding state with it means the server render and the first
   * client render agree, and a header language change (which persists
   * the cookie and calls router.refresh()) flows back down here as a new
   * prop instead of leaving this page on a stale language.
   */
  initialLanguage?: LanguageCode;
}

/**
 * M65 — maps a real analysis failure onto localized, user-facing copy.
 *
 * The HTTP semantics are untouched and still fully available on the
 * error object (`status`, `code`); what changes is that a user never
 * sees them. Before M65 a throttled request rendered the literal string
 * "Backend responded with 429".
 */
function resolveAnalysisErrorMessage(error: unknown, dictionary: Dictionary): string {
  if (!(error instanceof AnalysisApiError)) return dictionary.genericFetchError;

  const byCode: Record<AnalysisApiErrorCode, string> = {
    timeout: dictionary.analysisErrorTimeout,
    network: dictionary.analysisErrorNetwork,
    'invalid-query': dictionary.analysisErrorInvalidQuery,
    'rate-limited': dictionary.analysisErrorRateLimited,
    server: dictionary.analysisErrorServer,
    unknown: dictionary.genericFetchError,
  };

  return byCode[error.code] ?? dictionary.genericFetchError;
}

export function SearchPageClient({ initialLanguage = 'en' }: SearchPageClientProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  /**
   * Milestone #51 Phase B — bounded, optional story anchor threaded
   * through from CountryArticleCard's "Ask GlobalNews AI about this"
   * action (see that file).
   *
   * Milestone #52-A — memoized. A plain object-literal expression here
   * would construct a NEW object identity on every render, which the
   * effect below (correctly) uses inside its body — an honest
   * exhaustive-deps warning, not a false positive, because including
   * that ever-changing identity directly in the dependency array would
   * refire the effect (and re-issue the analysis request) on every
   * unrelated re-render, not only when the actual story changes. useMemo
   * keyed on the real primitive inputs keeps the object identity stable
   * across renders where none of those actually changed, so it can be
   * listed in the effect's dependency array honestly — no
   * eslint-disable, no suppressed rule.
   */
  const countryCodeParam = searchParams.get('countryCode');
  const articleIdParam = searchParams.get('articleId');
  const storyContext: StoryContext | undefined = useMemo(
    () =>
      countryCodeParam
        ? { title: query, countryCode: countryCodeParam, articleId: articleIdParam ?? undefined }
        : undefined,
    [query, countryCodeParam, articleIdParam],
  );

  // Milestone #47 — resolved once on mount via resolveInitialLanguage()'s
  // explicit-override > browser > English order. M65 — seeded from the
  // Server Component's own cookie-resolved value so the first render
  // already agrees with the shell around it.
  const [language, setLanguage] = useState<LanguageCode>(initialLanguage);
  const [hasResolvedLanguage, setHasResolvedLanguage] = useState(false);
  const dictionary = getDictionary(language);

  const [isLoading, setIsLoading] = useState(true);
  const [response, setResponse] = useState<AnalysisApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // M65 — the workspace's own question field, used when this page is
  // opened without a query. Submitting navigates to the SAME
  // /search?q=... URL the Hero and the header already produce, so there
  // is exactly one analysis entry contract in the application.
  const [workspaceQuery, setWorkspaceQuery] = useState('');

  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    setLanguage(resolveInitialLanguage());
    setHasResolvedLanguage(true);
  }, []);

  /**
   * M65 — a header language change persists the cookie and calls
   * router.refresh(), which re-renders this route's Server Component and
   * delivers a new initialLanguage. Following it here is what makes the
   * analysis itself re-run in the newly selected language, instead of
   * this page staying on whatever it resolved at mount.
   */
  useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    // Milestone #47 — wait for the initial language resolution (reads
    // localStorage/navigator.language, both browser-only) before firing
    // the first request, so the very first fetch already uses the
    // correct language instead of always starting as English and
    // re-fetching immediately after.
    if (!hasResolvedLanguage) return undefined;

    let cancelled = false;

    if (!query.trim()) {
      // M65 — no question is no longer an error condition. The render
      // below shows the research workspace instead of an alert.
      setIsLoading(false);
      setResponse(null);
      setFetchError(null);
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
        setFetchError(resolveAnalysisErrorMessage(error, dictionary));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, language, hasResolvedLanguage, dictionary, storyContext]);

  function handleWorkspaceSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = workspaceQuery.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      {/*
        M65 — the language control now lives in the global header
        (NavBar), where the approved design places it. A second visible
        control here would be a duplicate of the same state, not a second
        legitimate presentation. The language STATE itself is unchanged:
        it is still resolved through resolveInitialLanguage() and the
        same persisted cookie/localStorage pair, and it now also follows
        a header change via initialLanguage.
      */}

      {hasQuery ? (
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            {dictionary.yourQuestion}
          </span>
          <h1 className="mt-2 text-balance font-display text-2xl font-medium text-ink-primary sm:text-3xl">
            {query}
          </h1>
        </div>
      ) : (
        /*
          M65 — the research workspace. /search without a question used
          to render an error telling the user to go back to the homepage,
          which made three real destinations (two active intelligence
          modules and the mobile "Ask" tab) dead ends. It is now a usable
          entry point in its own right.

          Presentation deliberately stays in the CURRENT production
          visual language: no recovered Claude Design evidence exists for
          the search page, and inventing one here is exactly what the
          missing-design rule forbids. Only the behaviour is fixed.
        */
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            {dictionary.searchWorkspaceHeading}
          </span>
          <h1 className="mt-2 text-balance font-display text-2xl font-medium text-ink-primary sm:text-3xl">
            {dictionary.searchWorkspaceIntro}
          </h1>

          <form
            role="search"
            aria-label={dictionary.searchWorkspaceAriaLabel}
            onSubmit={handleWorkspaceSubmit}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="search-workspace-question">
              {dictionary.searchWorkspaceAriaLabel}
            </label>
            <input
              id="search-workspace-question"
              type="text"
              value={workspaceQuery}
              onChange={(event) => setWorkspaceQuery(event.target.value)}
              placeholder={dictionary.searchWorkspacePlaceholder}
              maxLength={1000}
              className="w-full flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {dictionary.searchWorkspaceSubmitLabel}
            </button>
          </form>
        </div>
      )}

      {hasQuery && isLoading && <LoadingStages stages={[...dictionary.loadingStages]} />}

      {hasQuery && !isLoading && fetchError && (
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
             * (not-attempted, zero retrieved articles), "AI broke while
             * analyzing" (failed, articles may still be shown below), and
             * "AI produced something but it didn't validate"
             * (validation-rejected) never look identical to the user.
             *
             * Milestone #47: the localized fallback strings below come
             * from the dictionary — analysisError itself (when present)
             * is still whatever the backend returned and is shown as-is,
             * never silently replaced.
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
