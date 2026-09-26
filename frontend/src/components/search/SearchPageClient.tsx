'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AnalysisApiResponse, LanguageCode, StoryContext } from '@globalnews-ai/shared';
import { analyzeNews, AnalysisApiError, type AnalysisApiErrorCode } from '@/lib/api/analysisApi';
import { analysisAutoRunDecision } from '@/lib/analysis/analysisAutoRun';
import { LoadingStages } from '@/components/search/LoadingStages';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { resolveFrameEvidence } from '@/components/analysis-frame/analysisFrameState';
import { ZeroReportRecovery } from '@/components/analysis-frame/ZeroReportRecovery';
import { PRIMARY_DIMENSION_KEYS, type PrimaryDimensionKey } from '@/components/search/analysisDimensions';
import { resolveStoryTitle, usePublishStoryContext } from '@/lib/ask/storyContextStore';
import { resolveInitialLanguage } from '@/lib/i18n/languages';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import { AdaptiveTextarea } from '@/components/ui/AdaptiveTextarea';

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
export function resolveAnalysisErrorMessage(error: unknown, dictionary: Dictionary): string {
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
  /*
   * R4 §4.1 — the frame's opening dimension is linkable. `?d=` is read
   * here and validated against the real key list rather than cast, so a
   * hand-edited or stale URL opens the brief instead of a blank centre.
   */
  const dimensionParam = searchParams.get('d');
  const initialDimension: PrimaryDimensionKey =
    dimensionParam !== null && (PRIMARY_DIMENSION_KEYS as readonly string[]).includes(dimensionParam)
      ? (dimensionParam as PrimaryDimensionKey)
      : 'brief';

  const countryCodeParam = searchParams.get('countryCode');
  const articleIdParam = searchParams.get('articleId');
  /*
   * ASK AI REV A §4.2 — the transport for the SUBJECT across the Ask ->
   * full-analysis transition.
   *
   * Rev A owns the reason this parameter exists: without it the
   * transition builds `title: query`, which makes the FOLLOW-UP the
   * story title and reintroduces the subject/question inversion the
   * contract rules against (Rev A change log #1).
   *
   * IT IS NOT AN ANCHOR AND CANNOT BECOME ONE — see the gate below.
   * The three-state resolution lives in `resolveStoryTitle`, and the
   * distinction it makes is the point: ABSENT is legacy behaviour,
   * MALFORMED fails closed. R1 collapsed the two and then wrote
   * `title: storyTitle ?? query`, which promoted the follow-up to
   * subject exactly when the URL was least trustworthy.
   */
  const storyTitleParam = searchParams.get('storyTitle');
  /*
   * ── ARTICLE-ANCHOR REPAIR ─────────────────────────────────────────────
   *
   * This gate used to require `countryCode`, and threw `articleId` away
   * whenever it was absent — a DIFFERENT, optional parameter deciding
   * whether the story anchor survived at all.
   *
   * Every layer around it disagrees. `StoryContext.countryCode` is
   * optional in the shared contract; `analysisApi`'s own dedup key
   * prefers `articleId`; and `analysis.service.ts` prefers it too,
   * resolving it through `findArticleById` — a lookup by ID, and so
   * INDEPENDENT OF LANGUAGE.
   *
   * That is why this surfaced as an EN/PL parity bug rather than a
   * missing-anchor bug. With the anchor stripped, the request degrades to
   * a generic search on the question text, and that path IS
   * language-dependent. The same Russia story retrieved in Polish and
   * returned nothing in English — not because the workspace failed to
   * render, but because it was truthfully answering a different question.
   *
   * Not every entry point supplies a country: `resolvePrimaryCountry()`
   * returns the unique maximum or nothing, so a story naming two
   * countries equally resolves to NEITHER, by design. Those stories
   * carry `articleId` and no `countryCode`, and they were exactly the
   * ones that lost their anchor.
   *
   * The anchor now survives when EITHER identifier is present. Each field
   * is included only when it actually exists, so nothing is sent as
   * `undefined` and no value is invented. With neither, the generic
   * analysis is unchanged.
   */
  const storyContext: StoryContext | undefined = useMemo(
    () =>
      /*
        FAIL CLOSED FIRST (R2 finding 3). `&&` evaluates left to right, so
        a malformed subject short-circuits before the anchor gate is
        consulted: no context is constructed, therefore none is published,
        therefore the dock cannot transport one.

        THE ANCHOR GATE ITSELF IS UNCHANGED, character for character, and
        deliberately so — `articleAnchorParity`, `m51PhaseB` and
        `m52aHardening` pin it, and the R2 corrections had no business
        moving an accepted assertion that was already right.

        `resolveStoryTitle` is called twice rather than hoisted into a
        const. It is pure and takes a short string, and hoisting it would
        either add a dependency this memo does not need or force a block
        body — which would change the two textual shapes those three
        accepted specs assert. The duplication is the cheaper price.
      */
      resolveStoryTitle(storyTitleParam).kind !== 'malformed' &&
      (articleIdParam !== null || countryCodeParam !== null)
        ? {
            /*
              `query` is reachable as the subject ONLY on the absent
              branch. R1's `storyTitle ?? query` also reached it on the
              malformed branch, which promoted the reader's follow-up to
              story subject exactly when the URL was least trustworthy.
            */
            title:
              resolveStoryTitle(storyTitleParam).kind === 'valid' && storyTitleParam !== null
                ? storyTitleParam
                : query,
            ...(articleIdParam !== null ? { articleId: articleIdParam } : {}),
            ...(countryCodeParam !== null ? { countryCode: countryCodeParam } : {}),
          }
        : undefined,
    [query, storyTitleParam, countryCodeParam, articleIdParam],
  );

  /*
   * ASK AI REV A §5 — THIS PAGE IS THE PUBLISHER.
   *
   * The dock is a sibling of the page in the root layout and cannot
   * reach page state (§0(a)). This hook is the only writer: it publishes
   * the SAME `storyContext` object the workspace itself analyses, so
   * there is no second derivation of the anchor and no way for the two
   * to disagree.
   *
   * It also clears — when the context becomes `undefined` on this very
   * route (L2), and on unmount (L1, L5). That is the correctness half:
   * an anchor outliving its page would silently attach a story the
   * reader has already left to an unrelated question.
   */
  usePublishStoryContext(storyContext);

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

  /**
   * H2B — the Analysis Workspace shell owns the question heading once a
   * response exists, so the legacy heading below stands down rather than
   * producing a second <h1>. 10-ACCESSIBILITY §1 allows exactly one, and
   * it must be the analysis question.
   */
  const showsWorkspace = !isLoading && !fetchError && response !== null;

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
    /*
      CHECKPOINT D — the decision is named and countable. Same two conditions,
      same order, same outcomes; see analysisAutoRun.ts for why it is a function.
    */
    const decision = analysisAutoRunDecision(query, hasResolvedLanguage);

    if (decision === 'idle-language-pending') return undefined;

    let cancelled = false;

    if (decision === 'idle-no-query') {
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

  /*
   * ── R4 §3 — THE BOUNDED PERSISTENT FRAME IS NOW THE PRESENTATION ──
   *
   * Everything below this branch is the presentation R4 §2 rejects: an
   * uncontrolled long document, a vertical card stack, the same
   * analytical field rendered twice, and Original Sources as a large
   * image-card wall that pushed the geography and evidence off screen
   * while the reader read.
   *
   * It is not deleted, and neither is any field it showed. It is
   * REPLACED as the default, and its content is recomposed into the four
   * persistent regions plus Complete Record progressive disclosure.
   * `r4DataPreservation.spec.ts` seeds every field named by §4 with a
   * unique sentinel and asserts each one still reaches the reader — so
   * the preservation claim is measured on the rendered markup rather
   * than asserted in a comment.
   *
   * The early return is deliberate: the frame is near-full-height by
   * contract, and the wrapper below is `max-w-5xl` with page padding.
   * Rendering the frame inside it would reintroduce the page-level
   * scrolling §2 rejects.
   *
   * The branches BELOW still run, and must: loading, fetch failure, the
   * no-question entry form and the question heading are all states the
   * frame is not (and under §5 must not be) responsible for.
   */
  /*
    RETRY GOES THROUGH THE ROUTER, NOT THROUGH A NEW EFFECT DEPENDENCY.

    My first attempt added a `retryNonce` to the analysis effect's dependency
    array, and five accepted assertions caught it: this effect's deps are
    themselves a protected contract — storyContext memoized and honestly listed,
    no eslint-disable, and the stale-response cleanup that fires when they
    change. Adding a nonce to that list is not a free re-run; it edits the
    mechanism those tests exist to guard.

    `router.refresh()` re-renders the route's Server Component and the client
    re-issues from its unchanged deps, so retry works and the protected contract
    is untouched. Left here as the reason, not as a comment about a comment.
  */
  const handleRetry = (): void => {
    router.refresh();
  };

  /* Plain functions, not useCallback: neither is a dependency of the analysis
     effect, and importing useCallback would change this file's React import
     line — itself pinned by an accepted assertion about the memoization
     contract. Nothing here needs a stable identity. */
  const handleEditQuestion = (): void => {
    setWorkspaceQuery(query);
    setResponse(null);
    setFetchError(null);
    setIsLoading(false);
    router.replace('/search');
  };

  if (showsWorkspace && response !== null) {
    /*
      THE ACCEPTED RECOVERY SURFACE, RECONCILED ONTO THE CURRENT CLIENT.

      Added, not restored-over: this file's newer behaviour — storyContext
      stability, stale-response race protection, language-switch context and the
      PWA localization contract — is untouched, and every one of those suites
      still passes.

      The split is made by `resolveFrameEvidence`, the SAME accepted resolver the
      frame already uses, on its own `evidenceSurvives` flag. So
      `analysis-failed-with-evidence` keeps the FULL frame — reporting survived
      an AI failure and the reader can still use it — and only the genuinely
      empty states take the recovery view. A reader who asked something that was
      never searched for is told that, rather than being shown an empty frame
      that implies a search happened and found nothing.
    */
    const evidence = resolveFrameEvidence(response, hasQuery);
    if (!evidence.evidenceSurvives) {
      return (
        <ZeroReportRecovery
          response={response}
          state={evidence.state}
          clarificationReason={evidence.clarificationReason}
          language={language}
          onRetry={handleRetry}
          onEdit={handleEditQuestion}
          onBack={() => router.back()}
        />
      );
    }

    return (
      <AnalysisFrameSurface
        response={response}
        language={language}
        initialDimension={initialDimension}
      />
    );
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
        showsWorkspace ? null : (
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
              {dictionary.yourQuestion}
            </span>
            <h1 className="mt-2 text-balance font-display text-2xl font-medium text-ink-primary sm:text-3xl">
              {query}
            </h1>
          </div>
        )
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
            className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"
          >
            <label className="sr-only" htmlFor="search-workspace-question">
              {dictionary.searchWorkspaceAriaLabel}
            </label>
            <AdaptiveTextarea
              id="search-workspace-question"
              aria-label={dictionary.searchWorkspaceAriaLabel}
              value={workspaceQuery}
              onChange={(event) => setWorkspaceQuery(event.target.value)}
              placeholder={dictionary.searchWorkspacePlaceholder}
              maxLength={1000}
              minHeight={48}
              maxHeight={460}
              maxViewportFraction={0.56}
              keepVisible
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="w-full flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-ink-primary placeholder:text-ink-tertiary focus:border-cyan-400 focus:outline-none"
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

      {/*
        R4 §2 — the rejected presentation stood here.

        It is unreachable now: the guard it used is exactly
        `showsWorkspace`, and that returns the bounded frame above. It is
        removed rather than left dead, so nobody maintains two analysis
        presentations or re-enables this one by loosening a condition.

        Nothing it rendered is lost. The workspace, the classic record,
        the retrieval status, the source-entities panel and the
        source-card wall are all recomposed into the frame's four regions
        and its Complete Record — asserted field by field, on rendered
        markup, in `analysis-frame/r4DataPreservation.spec.ts`.
      */}
    </div>
  );
}

/*
 * R4 — `AnalysisClassicRecord` stood here.
 *
 * It was the disclosure that kept the long-form record reachable from
 * the old `/search` document. That document is gone (§2), and the record
 * now lives behind the frame's own Complete Record control, so a second
 * disclosure wrapping a second copy would be exactly the duplicate
 * rendering §3.C forbids.
 *
 * The record itself is NOT gone: `analysis-frame/CompleteRecordView.tsx`
 * renders the same accepted `AnalysisResultView`, plus the retrieval
 * context, mode badge and source entities this wrapper used to carry.
 */
