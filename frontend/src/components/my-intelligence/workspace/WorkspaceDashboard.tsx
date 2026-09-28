'use client';

import Link from 'next/link';
import type { LanguageCode } from '@globalnews-ai/shared';
import { findCountryByIso3 } from '@globalnews-ai/shared';
import {
  Activity,
  ArrowRight,
  Building2,
  Cpu,
  FileText,
  History,
  Scale,
  Sparkles,
  Split,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { MI_ASK_SURFACE, MI_CARD, MI_FOCUS, MI_RAIL, MI_TARGET } from '../miPresentation';
import { BookmarkButton, fill } from '../MiPrimitives';
import { NewSinceRow, SavedCard, StoryImage, StoryTitle } from '../MiStoryViews';
import { MI_ACTIONS, SelectionModeToggle, type ActionId } from '../MiSelection';
import type { FixtureStory } from '../devFixtures';
import type { RecentQuestion } from '../useMyIntelligenceData';
import { DOMAIN_ICONS, NotInBetaTag } from './WorkspaceNav';
import {
  ANALYSIS_WORKSPACE_HREF,
  COLLECTION_PREVIEW,
  DASHBOARD_ROWS,
  FOR_YOU_PREVIEW,
  IMIHIGO_HREF,
  INTELLIGENCE_DOMAINS,
  type WorkspaceView,
} from './miWorkspaceModel';

export interface StoryHandlers {
  readonly language: LanguageCode;
  readonly savedRefs: ReadonlySet<string>;
  readonly onToggleSaved: (url: string) => void;
  readonly selecting: boolean;
  readonly selectedUrls: ReadonlySet<string>;
  readonly onToggleSelected: (url: string) => void;
}

const EYEBROW_MONO = 'font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fa6c0]';
const CARD_TITLE = 'text-[19px] font-bold leading-[1.2] text-white sm:text-[21px]';
const VIEW_ALL = `${MI_FOCUS} inline-flex min-h-[44px] items-center rounded-[8px] px-1 text-[13.5px] font-semibold text-[#5abff5]`;

/**
 * Phone shows fewer rows than desktop (SPEC.md density rules): list items past
 * the phone bound (3) are hidden below md. One list in the DOM, never two.
 */
const PHONE_BOUND_3 = 'max-md:[&>li:nth-child(n+4)]:hidden';

function shortDate(iso: string, language: LanguageCode): string {
  return new Date(iso).toLocaleString(language === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ═══ ROW B · WHAT CHANGED ════════════════════════════════════════════════ */

export function WhatChangedCard({
  stories,
  count,
  boundary,
  isFirstVisit,
  failed,
  handlers,
  onViewAll,
}: {
  stories: readonly FixtureStory[];
  count: number;
  boundary: string | null;
  isFirstVisit: boolean;
  failed: boolean;
  handlers: StoryHandlers;
  onViewAll: () => void;
}): JSX.Element {
  const { language } = handlers;
  const t = getDictionary(language).myIntelligence;
  const w = t.workspace;
  const shown = stories.slice(0, DASHBOARD_ROWS.desktop);

  return (
    <section data-mi-module="what-changed" aria-labelledby="mi-what-changed-title" className={`${MI_CARD} flex min-w-0 flex-col p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={EYEBROW_MONO}>{w.whatChanged}</span>
          {count > 0 && (
            <span className="rounded-full bg-[#0b2c4d] px-2 py-[1px] text-[12px] font-bold text-[#93cdf5]">
              {fill(t.newSince.countLabel, { count })}
            </span>
          )}
        </div>
        {count > 0 && (
          <button type="button" onClick={onViewAll} className={VIEW_ALL}>
            {fill(w.viewAllCount, { count })}
          </button>
        )}
      </div>
      <h2 id="mi-what-changed-title" className={`${CARD_TITLE} mt-1`}>{t.newSince.title}</h2>

      {failed ? (
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[#ffcf7d]">{t.newSince.unavailable}</p>
      ) : isFirstVisit || boundary === null ? (
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[#93a7bd]">{t.newSince.firstVisit}</p>
      ) : (
        <>
          {/* D9 — the short explainer; the governed verbatim one is on View all. */}
          <p className="mt-2 text-[13.5px] leading-[1.55] text-[#93a7bd]">{fill(w.newShort, { date: shortDate(boundary, language) })}</p>
          {shown.length === 0 ? (
            <p className="mt-3 text-[13.5px] text-[#7d92aa]">{t.newSince.empty}</p>
          ) : (
            <ul className={`mt-1 ${PHONE_BOUND_3}`} data-mi-rows={shown.length}>
              {shown.map((story) => (
                  <NewSinceRow
                    key={story.id}
                    story={story}
                    language={language}
                    isSaved={handlers.savedRefs.has(story.url) || handlers.savedRefs.has(story.url.replace(/\/$/, ''))}
                    onToggleSaved={() => handlers.onToggleSaved(story.url)}
                    selecting={handlers.selecting}
                    isSelected={handlers.selectedUrls.has(story.url)}
                    onToggleSelected={() => handlers.onToggleSelected(story.url)}
                  />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* ═══ ROW B · THE SELECT PROMISE ══════════════════════════════════════════ */

export const ACTION_ICONS: Readonly<Record<ActionId, LucideIcon>> = {
  compare: Split,
  summarize: FileText,
  askAbout: Sparkles,
  explain: Scale,
  whatChanged: History,
  briefing: FileText,
};

/**
 * The module explains before it commits: the six actions are PLAIN TEXT here
 * (not buttons), and the one control is the zero-compute selection-mode
 * control in its sand treatment — no bolt, no AI tag (SPEC.md, D10).
 */
export function SelectPromiseCard({
  language,
  selecting,
  selectedCount,
  onToggle,
}: {
  language: LanguageCode;
  selecting: boolean;
  selectedCount: number;
  onToggle: () => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;
  const w = t.workspace;

  return (
    <section data-mi-module="select-promise" aria-labelledby="mi-promise-title" className={`${MI_RAIL} flex min-w-0 flex-col border-t-2 border-t-[#6a5634] p-4 sm:p-5`}>
      <p className={EYEBROW_MONO}>{w.promiseEyebrow}</p>
      <h2 id="mi-promise-title" className={`${CARD_TITLE} mt-1`}>{w.promiseTitle}</h2>
      <p className="mt-2 text-[14px] leading-[1.55] text-[#b9cbe0]">{w.promiseBody}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5" aria-label={t.selection.pickAction.replace(' ({count})', '')}>
        {MI_ACTIONS.map(({ id }) => {
          const Icon = ACTION_ICONS[id];
          return (
            <li key={id} className="flex items-center gap-2 text-[13.5px] text-[#cfe2f2]">
              <Icon aria-hidden="true" className="h-[15px] w-[15px] shrink-0 text-[#8fb3d4]" />
              <span className="min-w-0 truncate">{t.selection.actions[id]}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
        <SelectionModeToggle language={language} selecting={selecting} selectedCount={selectedCount} onToggle={onToggle} variant="phone" />
        <SelectionModeToggle language={language} selecting={selecting} selectedCount={selectedCount} onToggle={onToggle} variant="wide" />
        <p className="text-[12.5px] leading-[1.45] text-[#93a7bd]">{t.selection.introCompute}</p>
      </div>
    </section>
  );
}

/* ═══ FOR YOU ═════════════════════════════════════════════════════════════ */

export function ForYouModule({
  stories,
  handlers,
  onViewAll,
}: {
  stories: readonly FixtureStory[];
  handlers: StoryHandlers;
  onViewAll: () => void;
}): JSX.Element {
  const { language } = handlers;
  const t = getDictionary(language).myIntelligence;
  const shown = stories.slice(0, FOR_YOU_PREVIEW.desktop);

  return (
    <section data-mi-module="for-you" aria-labelledby="mi-for-you-title" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 id="mi-for-you-title" className="text-[21px] font-bold text-white">{t.forYou.title}</h2>
          <span className="text-[13px] text-[#93a7bd]">{t.forYou.note}</span>
        </div>
        {stories.length > 0 && (
          <button type="button" onClick={onViewAll} className={VIEW_ALL}>
            {getDictionary(language).myIntelligence.workspace.viewAll}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className={`${MI_RAIL} mt-3 p-4 text-[13.5px] text-[#7d92aa]`}>{t.forYou.empty}</p>
      ) : (
        /*
          INTEREST + SELECTION HOOK R1 — width-driven, not breakpoint-driven: a card
          is never narrower than 310px, so opening the 360px selection rail drops
          the grid from 3 to 2 columns instead of squeezing the cards. The 24px
          column gap is wider than the hook's straddle.
        */
        <ul className={`mt-3 grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,310px),1fr))] ${PHONE_BOUND_3}`} data-mi-cards={shown.length}>
          {shown.map((story) => {
            const country = findCountryByIso3(story.countryCode);
            const name = country === undefined ? story.countryCode : getCountryDisplayName(country.iso2, language, country.name);
            return (
                <SavedCard
                  key={story.id}
                  compact
                  story={story}
                  language={language}
                  reason={fill(t.forYou.reason, { country: name })}
                  isSaved={handlers.savedRefs.has(story.url)}
                  onToggleSaved={() => handlers.onToggleSaved(story.url)}
                  selecting={handlers.selecting}
                  isSelected={handlers.selectedUrls.has(story.url)}
                  onToggleSelected={() => handlers.onToggleSelected(story.url)}
                />
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ═══ EXPLORE ═════════════════════════════════════════════════════════════ */

/** Navigation tiles only: no KPI, count or live state on any tile (SPEC.md). */
export function ExploreModule({ language }: { language: LanguageCode }): JSX.Element {
  const w = getDictionary(language).myIntelligence.workspace;

  return (
    <section data-mi-module="explore" aria-labelledby="mi-explore-title" className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id="mi-explore-title" className="text-[21px] font-bold text-white">{w.explore}</h2>
        <span className="text-[13px] text-[#93a7bd]">{w.exploreNote}</span>
      </div>
      <ul className="mt-3 grid grid-cols-4 gap-2 md:grid-cols-[repeat(auto-fit,minmax(128px,1fr))] md:gap-3">
        {INTELLIGENCE_DOMAINS.map((domain) => {
          const Icon = DOMAIN_ICONS[domain.id];
          return (
            <li key={domain.id} className="min-w-0">
              <Link
                href={domain.href}
                data-mi-domain={domain.id}
                className={`${MI_CARD} ${MI_FOCUS} flex h-full min-h-[88px] flex-col items-center gap-1.5 p-2 text-center transition-colors hover:border-[#1b6fa8] md:min-h-[96px] md:items-start md:p-3.5 md:text-left`}
              >
                <Icon aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-[#5abff5]" />
                <span className="text-[12px] font-semibold leading-[1.2] text-white [overflow-wrap:anywhere] md:text-[14.5px]">{w.domains[domain.id]}</span>
                <span className={`hidden font-mono text-[11px] md:block ${domain.preview ? 'text-[#c9b48c]' : 'text-[#7d92aa]'}`}>
                  {domain.preview ? w.preview : domain.href}
                </span>
                {domain.preview && <span className="font-mono text-[10px] text-[#c9b48c] md:hidden">{w.preview}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ═══ SPECIALIST INTELLIGENCE MODULE ══════════════════════════════════════ */

/**
 * D17 — navigation only. Both specialists are listed; there is no count,
 * score, live state or "recent activity", because no rule for relevance
 * exists and none may be invented. Elections carries Preview and names no
 * country: the release binds none (see miWorkspaceModel).
 */
export function SpecialistModule({ language, onView }: { language: LanguageCode; onView: (view: WorkspaceView) => void }): JSX.Element {
  const s = getDictionary(language).myIntelligence.workspace.specialists;
  const w = getDictionary(language).myIntelligence.workspace;

  const entry = 'flex min-h-[60px] w-full items-center gap-3 rounded-[10px] border border-[#0e2d4d] bg-[#041a30] px-3 py-2 text-left transition-colors hover:border-[#1b6fa8]';

  return (
    <section data-mi-module="specialists" aria-labelledby="mi-specialists-title" className={`${MI_CARD} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="mi-specialists-title" className="text-[19px] font-bold text-white">{s.moduleTitle}</h2>
          <p className="mt-0.5 text-[13px] text-[#93a7bd]">{s.moduleNote}</p>
        </div>
        <button type="button" onClick={() => onView('specialists')} className={VIEW_ALL}>
          {s.viewAll}
        </button>
      </div>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        <li>
          <button type="button" onClick={() => onView('specialists')} className={`${MI_FOCUS} ${entry}`}>
            <Vote aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-[#5abff5]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-white">{s.elections}</span>
              <span className="block text-[12.5px] text-[#93a7bd]">{s.countryAware}</span>
            </span>
            <span className="shrink-0 rounded-[6px] border border-[#5a4e38] px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-[0.08em] text-[#c9b48c]">{w.preview}</span>
          </button>
        </li>
        <li>
          <Link href={IMIHIGO_HREF} className={`${MI_FOCUS} ${entry}`}>
            <Building2 aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-[#5abff5]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-white">{s.imihigo}</span>
              <span className="block text-[12.5px] text-[#93a7bd]">{s.imihigoSub}</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#5abff5]" />
          </Link>
        </li>
      </ul>
    </section>
  );
}

/* ═══ ROW E · SAVED · QUESTION HISTORY · GO DEEPER ═══════════════════════ */

export function SavedPreview({
  stories,
  totalCount,
  handlers,
  onViewAll,
}: {
  stories: readonly FixtureStory[];
  totalCount: number;
  handlers: StoryHandlers;
  onViewAll: () => void;
}): JSX.Element {
  const { language } = handlers;
  const t = getDictionary(language).myIntelligence;
  const w = t.workspace;

  return (
    <section data-mi-module="saved-preview" aria-labelledby="mi-saved-preview-title" className={`${MI_RAIL} min-w-0 p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="mi-saved-preview-title" className="text-[18px] font-bold text-white">{t.saved.title}</h2>
        {totalCount > 0 && (
          <button type="button" onClick={onViewAll} className={VIEW_ALL}>
            {fill(w.viewAllCount, { count: totalCount })}
          </button>
        )}
      </div>
      {totalCount === 0 ? (
        <p className="mt-2 text-[13.5px] text-[#93a7bd]">{t.saved.empty}</p>
      ) : (
        <ul className="mt-2">
          {stories.slice(0, COLLECTION_PREVIEW).map((story) => (
            <li key={story.id} className="flex items-center gap-3 border-b border-[#0a2744] py-2 last:border-b-0">
              <StoryImage
                story={story}
                fallback={t.saved.noImage}
                className="flex h-[44px] w-[56px] shrink-0 items-center justify-center rounded-[8px] border border-[#0e2d4d] bg-[linear-gradient(140deg,#0b2742,#061a30)]"
                fallbackClassName="px-1 text-center text-[9px] leading-[1.2] text-[#54687e]"
              />
              <span className="min-w-0 flex-1">
                <StoryTitle story={story} className="line-clamp-2 block text-[14px] font-bold leading-[1.3] text-white [overflow-wrap:anywhere]" />
                <span className="block truncate font-mono text-[11.5px] text-[#7d92aa]">
                  {story.sourceName}
                  {story.savedAt ? ` · ${fill(t.saved.savedAgo, { age: formatRelativeTime(story.savedAt, language) })}` : ''}
                </span>
              </span>
              <BookmarkButton isSaved={handlers.savedRefs.has(story.url)} onToggle={() => handlers.onToggleSaved(story.url)} language={language} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HistoryPreview({
  questions,
  language,
  onViewAll,
}: {
  questions: readonly RecentQuestion[];
  language: LanguageCode;
  onViewAll: () => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence;
  const w = t.workspace;
  const shown = questions.slice(0, COLLECTION_PREVIEW);

  return (
    <section data-mi-module="history-preview" aria-labelledby="mi-history-preview-title" className={`${MI_ASK_SURFACE} min-w-0 p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="mi-history-preview-title" className="text-[18px] font-bold text-white">{t.recent.questionHistory}</h2>
        {questions.length > 0 && (
          <button type="button" onClick={onViewAll} className={VIEW_ALL}>
            {fill(w.viewAllCount, { count: questions.length })}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-[13.5px] text-[#7d92aa]">{t.recent.empty}</p>
      ) : (
        <ul className="mt-1">
          {shown.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 border-b border-[#0a2744] py-2 last:border-b-0">
              <History aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#a78bfa]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-white" title={entry.query}>{entry.query}</span>
                <span className="block text-[11.5px] text-[#7d92aa]">{fill(t.recent.askedOn, { date: formatRelativeTime(entry.createdAt, language) })}</span>
              </span>
              {/* `/ask?q=` STAGES a draft; nothing runs until Send inside Ask. */}
              <Link
                href={`/ask?q=${encodeURIComponent(entry.query)}`}
                aria-label={fill(t.recent.askAgainAria, { question: entry.query })}
                className={`${MI_FOCUS} ${MI_TARGET} inline-flex shrink-0 items-center rounded-full border border-[#1d3a5a] px-3 text-[12.5px] font-semibold text-[#cfe2f2]`}
              >
                {t.recent.askAgain}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[#7d92aa]">{w.historyShort}</p>
    </section>
  );
}

export function GoDeeperCard({ language, onSelect }: { language: LanguageCode; onSelect: () => void }): JSX.Element {
  const w = getDictionary(language).myIntelligence.workspace;
  const row = 'flex min-h-[56px] w-full items-center gap-3 rounded-[10px] border border-[#0e2d4d] bg-[#041a30] px-3 py-2 text-left';

  return (
    <section data-mi-module="go-deeper" aria-labelledby="mi-go-deeper-title" className={`${MI_CARD} min-w-0 p-4 sm:p-5`}>
      <p className={EYEBROW_MONO}>{w.deepEyebrow}</p>
      <h2 id="mi-go-deeper-title" className="mt-1 text-[18px] font-bold text-white">{w.goDeeper}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        <li>
          {/* Ask AI idle. Complete analysis only via the explicit handoff inside Ask. */}
          <Link href={ANALYSIS_WORKSPACE_HREF} className={`${MI_FOCUS} ${row} hover:border-[#1b6fa8]`}>
            <Activity aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[#5abff5]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold text-white">{w.items.analysisWorkspace}</span>
              <span className="block text-[12.5px] text-[#93a7bd]">{w.items.analysisWorkspaceSub}</span>
            </span>
          </Link>
        </li>
        <li>
          <button type="button" onClick={onSelect} className={`${MI_FOCUS} ${row} hover:border-[#1b6fa8]`}>
            <FileText aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[#5abff5]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold text-white">{w.items.briefings}</span>
              <span className="block text-[12.5px] text-[#93a7bd]">{w.items.briefingsSub}</span>
            </span>
          </button>
        </li>
        <li>
          <div className={row} data-mi-deep-intelligence="">
            <Cpu aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[#6a7f95]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold text-[#cfe2f2]">{w.items.deepIntelligence}</span>
              <span className="block text-[12.5px] text-[#93a7bd]">{w.items.deepIntelligenceSub}</span>
            </span>
            <NotInBetaTag label={w.notInBeta} />
          </div>
        </li>
      </ul>
    </section>
  );
}
