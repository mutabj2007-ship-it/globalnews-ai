'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AnalysisApiResponse, LanguageCode } from '@globalnews-ai/shared';
import { ARTICLE_REF_PATTERN, MAX_SELECTED_STORIES, SEARCH_HISTORY_LIST_LIMIT, findCountryByIso3 } from '@globalnews-ai/shared';
import { FollowingControl } from './MiFollowing';
import { resolveAnalysisErrorMessage } from '@/components/search/SearchPageClient';
import {
  SELECTION_ACTION_QUESTIONS,
  SelectionActionError,
  runSelectionAction,
} from '@/lib/myIntelligence/selection';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { MI_CARD, MI_EYEBROW, MI_GREETING, MI_PAGE, MI_PILL, MI_TARGET } from './miPresentation';
import { FixtureBanner, StatusBanner, fill } from './MiPrimitives';
import {
  AuthRequiredCard,
  FollowingSection,
  ForYouSection,
  NewSinceSection,
  RecentSection,
  RECENT_PREVIEW_LIMIT,
  SavedSection,
} from './MiSections';
import {
  ComputeCommitSheet,
  MI_ACTIONS,
  SelectionIntro,
  SelectionModeToggle,
  SelectionPanel,
  SelectionRail,
  SelectionStatus,
  SelectionResultSheet,
  MI_ACTION_TO_MULTI_STORY,
  type ActionId,
  type ComputeRunStatus,
} from './MiSelection';
import { useMyIntelligenceData } from './useMyIntelligenceData';
import { isNewSince } from './newSince';

type TabId = 'overview' | 'saved' | 'following' | 'recent';

const TABS: readonly TabId[] = ['overview', 'saved', 'following', 'recent'];

/**
 * MY INTELLIGENCE — the signed-in personal intelligence workspace.
 *
 * Built from the frozen MY-INTELLIGENCE-R1.2 design authority. The composition,
 * order, tier behaviour and copy are the authority's; what this file adds is
 * the state that makes them run.
 *
 * ── THE COMPUTE LINE ─────────────────────────────────────────────────────
 *
 * Opening this page, changing tab, saving, unsaving, following, selecting,
 * filtering and switching language all run ZERO AI. The only thing on this
 * surface that can start compute is confirming the commit sheet, and that
 * hands off to Ask rather than running here. That is not an implementation
 * detail — it is the product contract the Product Owner froze, and it is why
 * the sheet exists at all.
 *
 * ── SUB-VIEWS ARE CLIENT STATE, NOT URL STATE ────────────────────────────
 *
 * R1.2 rules the tabs are client state. They are not query parameters, because
 * the sign-in return validator rejects `?` and `#` outright and the authority
 * forbids loosening it — so a sub-view in the URL could not survive sign-in
 * anyway, and putting it there would imply a durability the product cannot
 * deliver.
 */
export function MyIntelligenceClient({
  language,
  forceFirstVisit,
  forceBoundaryFailure,
  forceEmpty,
  forceError,
  forceSignedOut,
}: {
  language: LanguageCode;
  forceFirstVisit?: boolean;
  forceBoundaryFailure?: boolean;
  forceEmpty?: boolean;
  forceError?: boolean;
  forceSignedOut?: boolean;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;
  const data = useMyIntelligenceData({
    forceFirstVisit,
    forceBoundaryFailure,
    forceEmpty,
    forceError,
  });

  const [tab, setTab] = useState<TabId>('overview');
  const [selecting, setSelecting] = useState(false);
  /* First-use note: page state only — this surface keeps no browser storage. */
  const [introDone, setIntroDone] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<ReadonlySet<string>>(new Set());
  const [category, setCategory] = useState<string>(t.saved.filterAll);
  const [sheetAction, setSheetAction] = useState<ActionId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /*
    COMPUTE-ACTION CLOSURE R1 — the one explicit Run. `inFlight` is the
    double-submit guard: a second tap while a request is running is ignored
    before anything is sent, independent of how fast React re-renders the
    disabled button.
  */
  const [runStatus, setRunStatus] = useState<ComputeRunStatus>('idle');
  const [runError, setRunError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<{
    action: ActionId;
    response: AnalysisApiResponse;
    question: string;
    titlesByRef: Readonly<Record<string, string>>;
  } | null>(null);
  const inFlight = useRef(false);

  const signedOut = forceSignedOut === true || (!data.isLoading && !data.isSignedIn);

  const onToggleSaved = useCallback(
    (url: string) => {
      const wasSaved = data.savedRefs.has(url);
      data.toggleSaved(url);
      setToast(wasSaved ? t.saved.unsavedToast : t.saved.savedToast);
    },
    [data, t.saved.savedToast, t.saved.unsavedToast],
  );

  const onToggleSelected = useCallback((url: string) => {
    /* The first selection means the first-use note has done its job. */
    setIntroDone(true);
    setSelectedUrls((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else if (next.size >= MAX_SELECTED_STORIES) {
        /* The governed bound: at most 8 selected stories per action. Nothing is added. */
        setToast(fill(t.selection.maxReached, { count: MAX_SELECTED_STORIES }));
        return current;
      } else next.add(url);
      return next;
    });
  }, [t.selection.maxReached]);

  const clearSelection = useCallback(() => setSelectedUrls(new Set()), []);

  /* Entering or leaving selection mode is local state only: no request of any kind. */
  const toggleSelecting = useCallback(() => {
    setSelecting((on) => !on);
    if (selecting) clearSelection();
  }, [clearSelection, selecting]);

  const categories = useMemo(
    () => Array.from(new Set(data.saved.map((story) => story.category))),
    [data.saved],
  );

  const visibleSaved = useMemo(
    () =>
      category === t.saved.filterAll
        ? data.saved
        : data.saved.filter((story) => story.category === category),
    [category, data.saved, t.saved.filterAll],
  );

  /* Per-country new counts, from the same rule the section uses. One rule, one source. */
  const newByCountry = useMemo(() => {
    const out: Record<string, number> = {};
    for (const story of data.newSince) {
      if (!isNewSince(story, data.previousSeenAt)) continue;
      out[story.countryCode] = (out[story.countryCode] ?? 0) + 1;
    }
    return out;
  }, [data.newSince, data.previousSeenAt]);

  /*
    The selected stories, once each, in the order they were selected. A story
    listed in two sections is ONE selection.
  */
  const selectedStories = useMemo(() => {
    const pool = [...data.newSince, ...data.saved, ...data.forYou];
    return [...selectedUrls]
      .map((url) => pool.find((story) => story.url === url))
      .filter((story): story is (typeof pool)[number] => story !== undefined);
  }, [data.forYou, data.newSince, data.saved, selectedUrls]);

  /*
    Only a story carrying its GOVERNED reference — the server-issued sha256
    articleRef from the live feed or saved-story data — can be sent. One
    without it is refused and shown as left out; it is never sent as a bare
    URL and never looked up by search.
  */
  const verifiedStories = useMemo(
    () =>
      selectedStories.filter(
        (story): story is (typeof selectedStories)[number] & { articleRef: string } =>
          typeof story.articleRef === 'string' && ARTICLE_REF_PATTERN.test(story.articleRef),
      ),
    [selectedStories],
  );
  const excludedCount = selectedStories.length - verifiedStories.length;

  const openSheet = useCallback((id: ActionId) => {
    setRunStatus('idle');
    setRunError(undefined);
    setSheetAction(id);
  }, []);

  const closeSheet = useCallback(() => {
    if (inFlight.current) return;
    setSheetAction(null);
    setRunStatus('idle');
    setRunError(undefined);
  }, []);

  const dictionary = getDictionary(language);

  const onConfirm = useCallback(
    (question: string) => {
      if (sheetAction === null || inFlight.current) return;
      const action = sheetAction;
      const multiStory = MI_ACTION_TO_MULTI_STORY[action];
      const typed = action === 'askAbout' ? question.trim() : undefined;
      const stories = verifiedStories.map((story) => ({ articleRef: story.articleRef, url: story.url }));
      const titlesByRef = Object.fromEntries(verifiedStories.map((story) => [story.articleRef, story.title]));

      inFlight.current = true;
      setRunStatus('running');
      setRunError(undefined);

      /* THE ONE COMPUTE CALL: the governed boundary, then the existing client, then POST /analysis/news. */
      runSelectionAction(multiStory, stories, language, typed)
        .then((response) => {
          setResult({
            action,
            response,
            question: typed ?? SELECTION_ACTION_QUESTIONS[language === 'pl' ? 'pl' : 'en'][multiStory],
            titlesByRef,
          });
          setSheetAction(null);
          setRunStatus('idle');
        })
        .catch((error: unknown) => {
          /* The selection is untouched; the sheet stays open with an explicit retry. */
          setRunStatus('failed');
          if (error instanceof SelectionActionError) {
            setRunError(
              error.reason === 'question-required'
                ? t.compute.questionRequired
                : error.reason === 'too-many'
                  ? fill(t.selection.maxReached, { count: MAX_SELECTED_STORIES })
                  : fill(t.compute.tooFewVerified, {
                      count: MI_ACTIONS.find((entry) => entry.id === action)?.min ?? 1,
                    }),
            );
          } else {
            setRunError(resolveAnalysisErrorMessage(error, dictionary));
          }
        })
        .finally(() => {
          inFlight.current = false;
        });
    },
    [dictionary, language, sheetAction, t.compute.questionRequired, t.compute.tooFewVerified, t.selection.maxReached, verifiedStories],
  );

  const handlers = {
    language,
    savedRefs: data.savedRefs,
    onToggleSaved,
    selecting,
    selectedUrls,
    onToggleSelected,
  };

  const counts: Record<TabId, number> = {
    overview: 0,
    saved: data.saved.length,
    following: data.follows?.length ?? 0,
    recent: data.recent.length,
  };

  if (signedOut) {
    return (
      <main className={`${MI_PAGE} min-h-screen px-4 py-16 pb-28 lg:pb-16`}>
        <AuthRequiredCard language={language} />
      </main>
    );
  }

  const showNewSince = tab === 'overview';
  const showSaved = tab === 'overview' || tab === 'saved';
  const showForYou = tab === 'overview';
  const showRecent = tab === 'overview' || tab === 'recent';
  /* Select is meaningless where there is nothing selectable. */
  const canSelect = (tab === 'overview' || tab === 'saved') && data.saved.length + data.newSince.length > 0;

  return (
    <main className={`${MI_PAGE} min-h-screen ${selecting && selectedUrls.size > 0 ? 'pb-[340px]' : 'pb-[132px]'} lg:pb-16`}>
      <div className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-6 md:py-7 min-[1700px]:max-w-[1400px]">
        {/* ── Title block ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={MI_EYEBROW}>{t.eyebrow}</p>
            <h1 className={`${MI_GREETING} mt-1.5`}>
              {data.userName === null
                ? t.greetingAnonymous
                : fill(t.greetingNamed, { name: data.userName })}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.5] text-[#93a7bd]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              {data.previousSeenAt === null ? (
                <span>{t.newSince.firstVisit}</span>
              ) : (
                <>
                  <span>
                    {fill(t.previousVisit, {
                      date: new Date(data.previousSeenAt).toLocaleString(
                        language === 'pl' ? 'pl-PL' : 'en-GB',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
                      ),
                    })}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {data.newSinceCount === 1
                      ? t.newlyIdentifiedCountOne
                      : fill(t.newlyIdentifiedCount, { count: data.newSinceCount })}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Identity is one line. This is not an account page. */}
          <div className="hidden shrink-0 flex-col items-end gap-1 lg:flex">
            {data.userEmail !== null && (
              <span className="text-[12.5px] text-[#7d92aa]">{data.userEmail}</span>
            )}
            <Link href="/account/settings" className="text-[12.5px] font-semibold text-[#5abff5]">
              {t.accountSettings}
            </Link>
          </div>

          {/* On phone the Select toggle sits at the right of the eyebrow row. */}
          {canSelect && (
            <SelectionModeToggle
              language={language}
              selecting={selecting}
              selectedCount={selectedUrls.size}
              onToggle={toggleSelecting}
              variant="phone"
            />
          )}
        </div>

        {/* ── Sticky tab bar ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 -mx-4 mt-4 bg-[#010a19]/95 px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6">
          <div className="flex items-center gap-2">
            {/*
              PHONE: four equal grid columns, 13px, no counts, NO horizontal
              scrolling. The earlier scrolling-pill version clipped the third
              tab mid-word at 360 and hid the fourth entirely; a grid cannot do
              that, in either language.
            */}
            <div
              role="tablist"
              aria-label={t.tabs.ariaLabel}
              className="grid flex-1 grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2"
            >
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`${MI_PILL} inline-flex h-[44px] items-center justify-center gap-1.5 border px-1 text-[13px] font-semibold md:px-4 ${
                    tab === id
                      ? 'border-[#1b6fa8] bg-[#07304f] text-[#cfe6ff]'
                      : 'border-[#1d3a5a] text-[#9fb4cb]'
                  }`}
                >
                  <span className="truncate">{t.tabs[id]}</span>
                  {counts[id] > 0 && (
                    <span className="hidden text-[12px] font-normal text-[#7d92aa] md:inline">
                      {counts[id]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {canSelect && (
              <SelectionModeToggle
                language={language}
                selecting={selecting}
                selectedCount={selectedUrls.size}
                onToggle={toggleSelecting}
                variant="wide"
              />
            )}
          </div>
        </div>

        {/* ── Status banner slot ──────────────────────────────────────── */}
        <div className="mt-3 flex flex-col gap-2.5">
          {data.hasError && (
            <StatusBanner
              tone="error"
              action={
                <button
                  type="button"
                  onClick={data.retry}
                  className="rounded-full border border-current px-3 py-1 text-[12.5px] font-semibold"
                >
                  {t.states.retry}
                </button>
              }
            >
              {t.states.error}
            </StatusBanner>
          )}
          {data.isDegraded && <StatusBanner tone="degraded">{t.states.degraded}</StatusBanner>}
          {data.usesFixtures && <FixtureBanner language={language} />}
          <SelectionIntro
            language={language}
            visible={selecting && selectedUrls.size === 0 && !introDone}
            onDismiss={() => setIntroDone(true)}
          />
        </div>
        <SelectionStatus language={language} selecting={selecting} selectedCount={selectedUrls.size} />

        {/* ── Columns ─────────────────────────────────────────────────── */}
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] lg:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {showNewSince && (
              <NewSinceSection
                stories={data.newSince}
                count={data.newSinceCount}
                boundary={data.previousSeenAt}
                isFirstVisit={data.isFirstVisit}
                failed={data.boundaryFailed}
                handlers={handlers}
              />
            )}
            {showSaved && (
              <SavedSection
                stories={visibleSaved}
                totalCount={data.saved.length}
                categories={categories}
                activeCategory={category}
                onCategory={setCategory}
                handlers={handlers}
              />
            )}
            {showForYou && <ForYouSection stories={data.forYou} handlers={handlers} />}
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[72px]">
            {selecting && selectedUrls.size > 0 && (
              <SelectionPanel
                language={language}
                selectedCount={selectedUrls.size}
                onClear={clearSelection}
                onAction={openSheet}
              />
            )}
            {tab === 'overview' && (
              /* DENSITY R1 — ONE compact control on Overview, never the country wall. */
              <FollowingControl language={language} follows={data.follows} newByCountry={newByCountry} />
            )}
            {tab === 'following' && (
              <FollowingSection
                follows={data.follows}
                newByCountry={newByCountry}
                language={language}
              />
            )}
            {showRecent && (
              <RecentSection
                questions={data.recent}
                language={language}
                limit={tab === 'recent' ? SEARCH_HISTORY_LIST_LIMIT : RECENT_PREVIEW_LIMIT}
                bounded={tab === 'recent'}
              />
            )}
          </div>
        </div>
      </div>

      {/* The phone/tablet rail. Sits above the bottom navigation, never over it. */}
      {selecting && selectedUrls.size > 0 && (
        <SelectionRail
          language={language}
          selectedCount={selectedUrls.size}
          onClear={clearSelection}
          onAction={openSheet}
        />
      )}

      {sheetAction !== null && (
        <ComputeCommitSheet
          language={language}
          action={sheetAction}
          storyTitles={verifiedStories.map((story) => story.title)}
          excludedCount={excludedCount}
          status={runStatus}
          errorMessage={runError}
          onCancel={closeSheet}
          onConfirm={onConfirm}
        />
      )}

      {result !== null && (
        <SelectionResultSheet
          language={language}
          action={result.action}
          response={result.response}
          question={result.question}
          titlesByRef={result.titlesByRef}
          onClose={() => setResult(null)}
        />
      )}

      {toast !== null && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 lg:bottom-6">
          <div className={`${MI_CARD} flex items-center gap-4 px-4 py-3 text-[13px] text-[#e4eefb] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]`}>
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="font-semibold text-[#5abff5]">
              {t.saved.toastUndo}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/** Exported so a test can assert the six actions and their minimums never drift. */
export { MI_ACTIONS };
