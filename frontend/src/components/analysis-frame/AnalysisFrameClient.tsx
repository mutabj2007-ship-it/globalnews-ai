'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { analyzeNews } from '@/lib/api/analysisApi';
import { LoadingStages } from '@/components/search/LoadingStages';
import { resolveAnalysisErrorMessage } from '@/components/search/SearchPageClient';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { PRIMARY_DIMENSION_KEYS, type PrimaryDimensionKey } from '../search/analysisDimensions';
import { resolveFrameView, runAnalysisRequest } from './frameRequest';
import { AnalysisFrame } from './AnalysisFrame';
import { CompleteRecordView } from './CompleteRecordView';
import { EvidenceLibrary } from './EvidenceLibrary';

/**
 * The frame's route client.
 *
 * R1.1 — THE STATE MACHINE, AND WHY IT IS WRITTEN AS FOUR EXHAUSTIVE
 * GUARDS RATHER THAN ONE COMBINED CONDITION.
 *
 * R1 shipped ONE combined loading guard that was true whenever no result
 * had arrived. With no `?q=` the effect returned before setting anything,
 * so every value stayed at its initial state, that guard was permanently
 * true, and the route sat on the last loading stage forever — with no
 * request ever issued. The defect was that "nothing has happened yet" and
 * "a request is in flight" were the same expression. The spec asserts
 * both the old guard and the old early return are absent from this file,
 * so neither is quoted here.
 *
 * They are now four disjoint branches, in this order, and every one of
 * them is terminal:
 *
 *   1. no question        -> the deliberate empty state. NEVER a spinner.
 *   2. request pending    -> LoadingStages, and ONLY here.
 *   3. request failed     -> the failure state, which says the request
 *                            failed and never that retrieval succeeded.
 *   4. settled, no result -> the same failure state. Defensive: this is
 *                            unreachable today, and it is a branch rather
 *                            than a fall-through precisely so that it can
 *                            never become a spinner again.
 *
 * `isLoading` initialises to `hasQuery`, so the loading branch is
 * reachable ONLY when a request has been or is about to be issued in the
 * same commit. No question means no request means no loading — asserted
 * exhaustively in `analysisFrameClient.spec.ts`.
 *
 * ARCHITECTURE (CTO ruling, R1.1). `/analysis?q=` performs the
 * established `analyzeNews(query, language)` call exactly once. It is not
 * a second analysis workflow: `/search` and `/analysis` are alternative
 * surfaces over the same single call, only one is mounted at a time, and
 * the empty state does NOT analyse — its call to action routes to the
 * existing question-entry surface. No client-side persistence of any kind
 * was added: the query travels in the URL, exactly as it already does
 * everywhere else in this application. The spec asserts that against this
 * file's source text, which is why the APIs are not named here.
 *
 * The stale-response guard is the same shape `staleResponseProtection.spec.ts`
 * pins for the existing client: a local `cancelled` flag, every setState
 * guarded by it, and a cleanup that sets it.
 */
export interface AnalysisFrameClientProps {
  initialLanguage?: LanguageCode;
}

/** Which destination the user has opened from inside the frame. */
type Destination = 'frame' | 'record' | 'library';

/** The existing question-entry surface. The empty state routes here. */
export const QUESTION_ENTRY_PATH = '/search';

function readDimension(value: string | null): PrimaryDimensionKey {
  return PRIMARY_DIMENSION_KEYS.includes(value as PrimaryDimensionKey)
    ? (value as PrimaryDimensionKey)
    : 'brief';
}

export function AnalysisFrameClient({
  initialLanguage = 'en',
}: AnalysisFrameClientProps): JSX.Element {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const hasQuery = query.trim().length > 0;
  const dimension = readDimension(searchParams.get('d'));
  const language = initialLanguage;
  const dictionary = getDictionary(language);
  const t = dictionary.analysisFrame;

  const [response, setResponse] = useState<AnalysisApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(hasQuery);
  const [destination, setDestination] = useState<Destination>('frame');

  useEffect(() => {
    let cancelled = false;

    void runAnalysisRequest(
      { query, language, dictionary },
      {
        analyze: analyzeNews,
        resolveErrorMessage: resolveAnalysisErrorMessage,
        onLoading: setIsLoading,
        onResult: setResponse,
        onError: setFetchError,
        onReset: () => {
          setResponse(null);
          setFetchError(null);
        },
        isCancelled: () => cancelled,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [query, language, dictionary]);

  const view = resolveFrameView({ hasQuery, isLoading, response, fetchError });

  /* 1 — NO QUESTION. */
  if (view === 'no-question') {
    return (
      <main
        data-paf="no-question"
        className="flex min-h-screen flex-col items-start justify-center gap-4 bg-[#05080d] px-8"
      >
        <h1 className="font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#a9bccf]">
          {t.noQuestionTitle}
        </h1>
        <p className="max-w-[60ch] font-gn-sans text-[14px] leading-[1.6] text-[#d5e1ee]">
          {t.noQuestionBody}
        </p>
        <Link
          href={QUESTION_ENTRY_PATH}
          data-paf="ask-a-question"
          className="rounded-[6px] border border-[#22303f] px-3 py-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          {t.askAQuestion}
        </Link>
      </main>
    );
  }

  /* 2 — REQUEST PENDING. The only branch that may show a spinner. */
  if (view === 'loading') {
    return <LoadingStages stages={[...dictionary.loadingStages]} />;
  }

  /* 3 and 4 — TERMINAL FAILURE. Never claims retrieval succeeded. */
  if (view === 'failed' || response === null) {
    return (
      <main
        data-paf="request-failed"
        role="alert"
        className="flex min-h-screen flex-col items-start justify-center gap-4 bg-[#05080d] px-8"
      >
        <h1 className="font-gn-mono text-[12px] uppercase tracking-[0.16em] text-[#e0a33d]">
          {t.requestFailedTitle}
        </h1>
        <p className="max-w-[60ch] font-gn-sans text-[14px] leading-[1.6] text-[#d5e1ee]">
          {fetchError ?? dictionary.genericFetchError}
        </p>
        <p className="max-w-[60ch] font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.12em] text-[#54687f]">
          {t.requestFailedNote}
        </p>
        <Link
          href={QUESTION_ENTRY_PATH}
          data-paf="ask-a-question"
          className="rounded-[6px] border border-[#22303f] px-3 py-2 font-gn-mono text-[12px] md:text-[11px] uppercase tracking-[0.14em] text-[#67e8f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
        >
          {t.askAQuestion}
        </Link>
      </main>
    );
  }

  if (destination === 'record') {
    return <CompleteRecordView response={response} language={language} onBack={() => setDestination('frame')} />;
  }

  if (destination === 'library') {
    return <EvidenceLibrary articles={response.articles} language={language} onBack={() => setDestination('frame')} />;
  }

  return (
    <AnalysisFrame
      response={response}
      language={language}
      initialDimension={dimension}
      onOpenRecord={() => setDestination('record')}
    />
  );
}
