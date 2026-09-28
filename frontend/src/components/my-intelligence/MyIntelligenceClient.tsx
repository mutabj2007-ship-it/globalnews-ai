'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { MI_CARD, MI_EYEBROW, MI_GREETING, MI_PAGE } from './miPresentation';
import { FixtureBanner, StatusBanner, fill } from './MiPrimitives';
import {
  AuthRequiredCard,
  ForYouSection,
  NewSinceSection,
  RecentSection,
  SavedSection,
} from './MiSections';
import {
  ComputeCommitSheet,
  MI_ACTIONS,
  SelectionIntro,
  SelectionRail,
  SelectionStatus,
  SelectionResultSheet,
  MI_ACTION_TO_MULTI_STORY,
  type ActionId,
  type ComputeRunStatus,
} from './MiSelection';
import { useMyIntelligenceData } from './useMyIntelligenceData';
import { isNewSince } from './newSince';
import type { WorkspaceView } from './workspace/miWorkspaceModel';
import { WorkspaceDrawer, WorkspaceRail } from './workspace/WorkspaceNav';
import { InterestEditor } from './workspace/InterestEditor';
import {
  ExploreModule,
  forYouReason,
  ForYouModule,
  GoDeeperCard,
  HistoryPreview,
  SavedPreview,
  SelectPromiseCard,
  SpecialistModule,
  WhatChangedCard,
} from './workspace/WorkspaceDashboard';
import {
  DestinationBack,
  SelectionContextRail,
  SpecialistsDestination,
  WorkspacePhoneHeader,
} from './workspace/WorkspaceChrome';

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

  /*
    PREMIUM WORKSPACE R1 — the view, the rail and the drawer. All CLIENT
    state: the sign-in return validator accepts exactly /my-intelligence, so a
    view in the URL could not survive sign-in (D2/D4). The rail pin is page
    state too — this surface keeps no browser storage (D11).
  */
  const [view, setView] = useState<WorkspaceView>('today');
  const [railExpanded, setRailExpanded] = useState(false);
  const [railPinned, setRailPinned] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [followingRequest, setFollowingRequest] = useState(0);
  /* INTEREST + SELECTION HOOK R1 — the Tune interests editor (For you header, and Account & Control → Preferences). */
  const [interestEditorOpen, setInterestEditorOpen] = useState(false);
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

  /* Entering or leaving selection mode is local state only: no request of any kind (enterSelection / leaveSelection below). */

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

  /*
    INTEREST + SELECTION HOOK R1 — THE HOOK IS ALSO THE DOOR. Pressed outside
    selection mode it enters the mode AND selects that story, which opens the
    desktop context rail / the phone selection rail. Local state only: no
    request of any kind. Inside the mode it toggles exactly as before, with
    the same maximum-selection rule.
  */
  const onHookToggle = useCallback(
    (url: string) => {
      if (!selecting) setSelecting(true);
      onToggleSelected(url);
    },
    [onToggleSelected, selecting],
  );

  const handlers = {
    language,
    savedRefs: data.savedRefs,
    onToggleSaved,
    selecting,
    selectedUrls,
    onToggleSelected: onHookToggle,
  };

  const counts = {
    newSince: data.newSinceCount,
    saved: data.saved.length,
    following: data.follows?.length ?? 0,
  };

  /*
    PREMIUM WORKSPACE R1 — "Selected stories", "Briefings from selected
    stories" and the promise CTA all ENTER selection mode (D8, D10). Entering
    is local state only; from a view with nothing selectable the reader is
    taken to Today for me, where the selectable stories are.
  */
  const enterSelection = useCallback(() => {
    setSelecting(true);
    setView((current) => (current === 'history' || current === 'specialists' ? 'today' : current));
  }, []);

  const leaveSelection = useCallback(() => {
    setSelecting(false);
    clearSelection();
  }, [clearSelection]);

  const removeSelected = useCallback((url: string) => {
    setSelectedUrls((current) => {
      const next = new Set(current);
      next.delete(url);
      return next;
    });
  }, []);

  const openFollowing = useCallback(() => setFollowingRequest((n) => n + 1), []);

  const initial = (data.userName ?? data.userEmail ?? '').trim().charAt(0).toUpperCase() || null;

  const navProps = {
    language,
    view,
    onView: setView,
    onFollowing: openFollowing,
    onSelect: enterSelection,
    selecting,
    counts,
    userName: data.userName,
    userEmail: data.userEmail,
    onSignOut: () => {
      void data.signOut();
    },
    onPreferences: () => setInterestEditorOpen(true),
  };

  if (signedOut) {
    return (
      <>
        <WorkspacePhoneHeader language={language} initial={null} onMenu={() => undefined} showMenu={false} />
        <main className={`${MI_PAGE} min-h-screen px-4 py-16 pb-28 lg:pb-16`}>
          <AuthRequiredCard language={language} />
        </main>
      </>
    );
  }

  const w = t.workspace;
  const backToToday = (): void => setView('today');

  return (
    <>
      <WorkspacePhoneHeader language={language} initial={initial} onMenu={() => setDrawerOpen(true)} showMenu />

      <div data-mi-workspace="" className={`${MI_PAGE} flex min-h-screen`}>
        <WorkspaceRail
          {...navProps}
          expanded={railExpanded}
          pinned={railPinned}
          onExpandedChange={setRailExpanded}
          onPinnedChange={(next) => {
            setRailPinned(next);
            if (!next) setRailExpanded(false);
          }}
        />

        <main
          className={`min-w-0 flex-1 ${selecting && selectedUrls.size > 0 ? 'pb-[340px]' : 'pb-[132px]'} lg:pb-16 ${
            selecting ? 'lg:pr-[360px]' : ''
          }`}
        >
          <div className="mx-auto w-full max-w-[1120px] px-4 py-5 md:px-8 md:py-6 min-[1800px]:max-w-[1240px]">
            {/* ── Status banner slot ──────────────────────────────────────── */}
            <div className="flex flex-col gap-2.5">
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

            {/* ── Header block ────────────────────────────────────────────── */}
            <div data-mi-header="" className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
              <div className="min-w-0">
                <p className={MI_EYEBROW}>{t.eyebrow}</p>
                <h1 className={`${MI_GREETING} mt-1.5`}>
                  {data.userName === null ? t.greetingAnonymous : fill(t.greetingNamed, { name: data.userName })}
                </h1>
                <p className="mt-2 max-w-[62ch] text-[14.5px] leading-[1.5] text-[#b9cbe0]">{w.subcopy}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {/* First visit: no boundary exists, so no previous-visit line is claimed. */}
                {data.previousSeenAt !== null && (
                  <p className="font-mono text-[12px] text-[#93a7bd]">
                    {fill(t.previousVisit, {
                      date: new Date(data.previousSeenAt).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })}
                  </p>
                )}
                <FollowingControl
                  language={language}
                  follows={data.follows}
                  newByCountry={newByCountry}
                  openRequest={followingRequest}
                />
              </div>
            </div>

            {/* ── The view ───────────────────────────────────────────────── */}
            <div className="mt-5">
              {view === 'today' && (
                <div data-mi-view="today" className="flex flex-col gap-5">
                  {/*
                    Phone order (SPEC.md): What changed → For you → the Select
                    promise → Explore → Specialists → Saved → History → Go
                    deeper. Desktop: What changed | promise (7fr | 5fr), then
                    For you. Row B is `contents` below lg so its two cards join
                    the outer column and take their phone order.
                  */}
                  <div className="max-lg:contents lg:order-1 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-5">
                    <div className="order-1 min-w-0 lg:order-none">
                      <WhatChangedCard
                        stories={data.newSince}
                        count={data.newSinceCount}
                        boundary={data.previousSeenAt}
                        isFirstVisit={data.isFirstVisit}
                        failed={data.boundaryFailed}
                        handlers={handlers}
                        onViewAll={() => setView('newSince')}
                      />
                    </div>
                    <div className="order-3 min-w-0 lg:order-none">
                      <SelectPromiseCard
                        language={language}
                        selecting={selecting}
                        selectedCount={selectedUrls.size}
                        onToggle={selecting ? leaveSelection : enterSelection}
                      />
                    </div>
                  </div>
                  <div className="order-2 min-w-0">
                    <ForYouModule
                      stories={data.forYou}
                      handlers={handlers}
                      onViewAll={() => setView('forYou')}
                      interests={data.interests}
                      filtered={data.forYouFiltered}
                      matchCount={data.forYouMatchCount}
                      broad={data.forYouBroad}
                      onTune={() => setInterestEditorOpen(true)}
                    />
                  </div>
                  <div className="order-4 min-w-0">
                    <ExploreModule language={language} />
                  </div>
                  <div className="order-5 min-w-0">
                    <SpecialistModule language={language} onView={setView} />
                  </div>
                  <div className="order-6 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <SavedPreview stories={data.saved} totalCount={data.saved.length} handlers={handlers} onViewAll={() => setView('saved')} />
                    <HistoryPreview questions={data.recent} language={language} onViewAll={() => setView('history')} />
                    <GoDeeperCard language={language} onSelect={enterSelection} />
                  </div>
                </div>
              )}

              {view === 'newSince' && (
                <div data-mi-view="newSince" className="flex flex-col gap-4">
                  <DestinationBack language={language} onBack={backToToday} />
                  {/* D9 — the governed explainer, verbatim, lives here. */}
                  <NewSinceSection
                    stories={data.newSince}
                    count={data.newSinceCount}
                    boundary={data.previousSeenAt}
                    isFirstVisit={data.isFirstVisit}
                    failed={data.boundaryFailed}
                    handlers={handlers}
                  />
                </div>
              )}

              {view === 'forYou' && (
                <div data-mi-view="forYou" className="flex flex-col gap-4">
                  <DestinationBack language={language} onBack={backToToday} />
                  <ForYouSection stories={data.forYou} handlers={handlers} reasonFor={(story) => forYouReason(story, data.interests, language)} />
                </div>
              )}

              {view === 'saved' && (
                <div data-mi-view="saved" className="flex flex-col gap-4">
                  <DestinationBack language={language} onBack={backToToday} />
                  <SavedSection
                    stories={visibleSaved}
                    totalCount={data.saved.length}
                    categories={categories}
                    activeCategory={category}
                    onCategory={setCategory}
                    handlers={handlers}
                  />
                </div>
              )}

              {view === 'history' && (
                <div data-mi-view="history" className="flex flex-col gap-4">
                  <DestinationBack language={language} onBack={backToToday} />
                  <RecentSection questions={data.recent} language={language} limit={SEARCH_HISTORY_LIST_LIMIT} bounded />
                </div>
              )}

              {view === 'specialists' && (
                <SpecialistsDestination language={language} follows={data.follows} onBack={backToToday} />
              )}
            </div>
          </div>
        </main>
      </div>

      <WorkspaceDrawer {...navProps} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {interestEditorOpen && (
        <InterestEditor
          language={language}
          current={data.interests}
          saving={data.isSavingInterests}
          onApply={data.saveInterests}
          onClose={() => setInterestEditorOpen(false)}
        />
      )}

      {/* Desktop: the contextual selection rail, only while selection mode is on. */}
      {selecting && (
        <SelectionContextRail
          language={language}
          stories={selectedStories}
          onRemove={removeSelected}
          onClear={clearSelection}
          onDone={leaveSelection}
          onAction={openSheet}
        />
      )}

      {/* Phone/tablet: the inherited bottom selection rail, above the bottom navigation. */}
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
    </>
  );
}

/** Exported so a test can assert the six actions and their minimums never drift. */
export { MI_ACTIONS };
