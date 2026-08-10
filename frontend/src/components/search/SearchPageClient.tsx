'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { analyzeNews, AnalysisApiError } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { AnalysisResultView } from '@/components/search/AnalysisResultView';
import { SourceArticleCard } from '@/components/search/SourceArticleCard';
import { RetrievalContextStatus } from '@/components/search/RetrievalContextStatus';
import { SourceEntitiesPanel } from '@/components/search/SourceEntitiesPanel';

export function SearchPageClient(): JSX.Element {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [response, setResponse] = useState<AnalysisApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!query.trim()) {
      setIsLoading(false);
      setResponse(null);
      setFetchError('No question was provided. Try searching from the homepage.');
      return undefined;
    }

    setIsLoading(true);
    setFetchError(null);
    setResponse(null);

    analyzeNews(query)
      .then((result) => {
        if (!cancelled) setResponse(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFetchError(
          error instanceof AnalysisApiError
            ? error.message
            : 'Something went wrong while analyzing this question. Please try again.',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
          Your question
        </span>
        <h1 className="mt-2 text-balance font-display text-2xl font-medium text-ink-primary sm:text-3xl">
          {query || 'No question provided'}
        </h1>
      </div>

      {isLoading && <LoadingStages />}

      {!isLoading && fetchError && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center" role="alert">
          <p className="text-sm text-ink-secondary">{fetchError}</p>
        </div>
      )}

      {!isLoading && !fetchError && response && (
        <div className="flex flex-col gap-10">
          <RetrievalContextStatus retrievalContext={response.retrievalContext} />
          <SourceEntitiesPanel sourceEntities={response.sourceEntities} />

          {response.analysis ? (
            <AnalysisResultView analysis={response.analysis} />
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-sm text-ink-secondary">
                {response.analysisError ??
                  'AI analysis is temporarily unavailable, but the underlying articles are shown below.'}
              </p>
            </div>
          )}

          {response.articles.length > 0 && (
            <section>
              <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-signal-bright">
                Original sources ({response.articles.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {response.articles.map((article) => (
                  <SourceArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
