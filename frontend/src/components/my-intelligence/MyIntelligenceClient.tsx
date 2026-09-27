'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { findCountryByIso3 } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { MI_CARD, MI_EYEBROW, MI_GREETING, MI_PAGE, MI_PILL, MI_TARGET } from './miPresentation';
import { FixtureBanner, StatusBanner, fill } from './MiPrimitives';
import {
  AuthRequiredCard,
  FollowingSection,
  ForYouSection,
  NewSinceSection,
  RecentSection,
  SavedSection,
} from './MiSections';
import { ComputeCommitSheet, MI_ACTIONS, SelectionPanel, SelectionRail, type ActionId } from './MiSelection';
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
  const [selectedUrls, setSelectedUrls] = useState<ReadonlySet<string>>(new Set());
  const [category, setCategory] = useState<string>(t.saved.filterAll);
  const [sheetAction, setSheetAction] = useState<ActionId | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    setSelectedUrls((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedUrls(new Set()), []);

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

  const selectedTitles = useMemo(() => {
    const pool = [...data.newSince, ...data.saved, ...data.forYou];
    return pool.filter((story) => selectedUrls.has(story.url)).map((story) => story.title);
  }, [data.forYou, data.newSince, data.saved, selectedUrls]);

  const handlers = {
    language,
    savedRefs: new Set(data.saved.map((story) => story.url)),
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
  const showFollowing = tab === 'overview' || tab === 'following';
  const showRecent = tab === 'overview' || tab === 'recent';
  /* Select is meaningless where there is nothing selectable. */
  const canSelect = (tab === 'overview' || tab === 'saved') && data.saved.length + data.newSince.length > 0;

  return (
    <main className={`${MI_PAGE} min-h-screen pb-[132px] lg:pb-16`}>
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
            <button
              type="button"
              onClick={() => {
                setSelecting((on) => !on);
                if (selecting) clearSelection();
              }}
              className={`${MI_PILL} ${MI_TARGET} inline-flex h-[44px] shrink-0 items-center gap-1.5 border px-3.5 text-[13px] font-semibold md:hidden ${
                selecting ? 'border-[#1b6fa8] bg-[#07304f] text-[#93cdf5]' : 'border-[#1d3a5a] text-[#cfe2f2]'
              }`}
            >
              {selecting ? t.done : t.select}
            </button>
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
              <button
                type="button"
                onClick={() => {
                  setSelecting((on) => !on);
                  if (selecting) clearSelection();
                }}
                className={`${MI_PILL} ${MI_TARGET} hidden h-[44px] shrink-0 items-center gap-1.5 border px-4 text-[13px] font-semibold md:inline-flex ${
                  selecting ? 'border-[#1b6fa8] bg-[#07304f] text-[#93cdf5]' : 'border-[#1d3a5a] text-[#cfe2f2]'
                }`}
              >
                {selecting ? t.done : t.select}
              </button>
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
        </div>

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
                onAction={setSheetAction}
              />
            )}
            {showFollowing && (
              <FollowingSection
                follows={data.follows}
                newByCountry={newByCountry}
                language={language}
              />
            )}
            {showRecent && <RecentSection questions={data.recent} language={language} />}
          </div>
        </div>
      </div>

      {/* The phone/tablet rail. Sits above the bottom navigation, never over it. */}
      {selecting && selectedUrls.size > 0 && (
        <SelectionRail
          language={language}
          selectedCount={selectedUrls.size}
          onClear={clearSelection}
          onAction={setSheetAction}
        />
      )}

      {sheetAction !== null && (
        <ComputeCommitSheet
          language={language}
          action={sheetAction}
          storyTitles={selectedTitles}
          onCancel={() => setSheetAction(null)}
          onConfirm={() => setSheetAction(null)}
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
