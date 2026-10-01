'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisApiResponse, LanguageCode, MultiStoryAction } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  MI_AI_ACTION_OFF,
  MI_AI_ACTION_ON,
  MI_BANNER_ERROR,
  MI_CARD,
  MI_FOCUS,
  MI_LOCAL_ACTION,
  MI_PILL,
  MI_SAND_FOCUS,
  MI_SAND_NOTE,
  MI_SELECTION_BAR,
  MI_SELECTION_FILL,
  MI_SELECTION_MODE_CONTROL,
  MI_SELECTION_PANEL,
  MI_SHEET,
  MI_TARGET,
} from './miPresentation';
import { AiTag, fill } from './MiPrimitives';
import { AskCompactResult } from '@/components/ask/AskCompactResult';
import { openFullAnalysisHref } from '@/lib/ask/useAskR2Conversation';

export type ActionId =
  | 'compare'
  | 'summarize'
  | 'askAbout'
  | 'explain'
  | 'whatChanged'
  | 'briefing';

/** The six actions and their minimums, exactly as the frozen authority lists them. */
export const MI_ACTIONS: ReadonlyArray<{ id: ActionId; min: number }> = [
  { id: 'compare', min: 2 },
  { id: 'summarize', min: 1 },
  { id: 'askAbout', min: 1 },
  { id: 'explain', min: 2 },
  { id: 'whatChanged', min: 1 },
  { id: 'briefing', min: 2 },
];

type SelectionCopy = ReturnType<typeof getDictionary>['myIntelligence']['selection'];

/** "1 story selected" / "2 stories selected" (PL avoids agreement with a colon form). */
export function storiesSelectedLabel(t: SelectionCopy, count: number): string {
  return fill(count === 1 ? t.storiesSelectedOne : t.storiesSelectedOther, { count });
}

/** The accessible state line: "2 stories selected. Selection mode active." */
export function selectionStatusLabel(t: SelectionCopy, count: number): string {
  if (count === 0) return t.statusNone;
  return fill(count === 1 ? t.statusOne : t.statusOther, { count });
}

/** The governed compute mark — the same lightning the compute sheet's Run carries. */
function ComputeMark({ className = 'h-[13px] w-[13px]' }: { className?: string }): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

function ActionIcon({ id }: { id: ActionId }): JSX.Element {
  const paths: Record<ActionId, string> = {
    compare: 'M4 7h6M4 12h6M4 17h6M14 7h6M14 12h6M14 17h6',
    summarize: 'M5 5h14M5 10h14M5 15h9',
    askAbout: 'M4 5h16v11H9l-5 4V5Z',
    explain: 'M12 4v16M4 9h6M14 15h6M4 15h6M14 9h6',
    whatChanged: 'M4 16 9 9l4 4 7-8',
    briefing: 'M6 3h9l4 4v14H6V3Zm9 0v4h4',
  };

  /* COLOR / ACTION-AWARENESS R1 — the icon takes the action's own sand (currentColor), not violet. */
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[id]} />
    </svg>
  );
}

/**
 * AN AI ACTION — THE COMPUTE COMMITMENT POINT, MARKED BEFORE IT IS PRESSED.
 *
 * Sand border, dark sand surface, sand text, the governed lightning mark and
 * the AI tag: never colour alone. The accessible name says it is an AI action
 * that asks for confirmation. Pressing it only OPENS the compute sheet; the
 * sheet's own Run / Send is the one control that may start compute.
 */
export function ActionPill({
  id,
  enabled,
  min,
  language,
  onPress,
  block = false,
}: {
  id: ActionId;
  enabled: boolean;
  min: number;
  language: LanguageCode;
  onPress: () => void;
  block?: boolean;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.selection;
  const name = t.actions[id];

  return (
    <button
      type="button"
      data-mi-action={id}
      data-mi-action-kind="ai"
      disabled={!enabled}
      aria-disabled={!enabled}
      aria-label={
        enabled
          ? fill(t.aiActionAria, { action: name })
          : `${fill(t.aiActionAria, { action: name })} ${fill(t.selectAtLeast, { count: min })}`
      }
      title={enabled ? undefined : fill(t.selectAtLeast, { count: min })}
      onClick={onPress}
      className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} inline-flex h-[44px] shrink-0 snap-start items-center gap-2 border px-3.5 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${
        block ? 'w-full' : ''
      } ${enabled ? MI_AI_ACTION_ON : MI_AI_ACTION_OFF}`}
    >
      <ActionIcon id={id} />
      <span className={`whitespace-nowrap ${block ? 'flex-1 text-left' : ''}`}>{name}</span>
      <ComputeMark />
      <AiTag label={t.aiTag} />
    </button>
  );
}

/**
 * THE SELECTION-MODE CONTROL (the former isolated "Done").
 *
 * It says the reader is IN a mode and how to leave it: "Selection mode · Done"
 * where there is room, a stacked "2 selected / Done" on a phone. Warm sand
 * awareness with a 2px rule — but no lightning and no AI tag, because Done
 * exits the mode and spends nothing.
 */
export function SelectionModeToggle({
  language,
  selecting,
  selectedCount,
  onToggle,
  variant,
}: {
  language: LanguageCode;
  selecting: boolean;
  selectedCount: number;
  onToggle: () => void;
  variant: 'phone' | 'wide';
}): JSX.Element {
  const mi = getDictionary(language).myIntelligence;
  const t = mi.selection;
  const visibility = variant === 'phone' ? 'md:hidden' : 'hidden md:inline-flex';

  /*
    SELECT SAND-AWARENESS CORRECTION — ONE control in two states, not two
    buttons. The same element, the same sand treatment and the same size carry
    "Select stories" into "Selection mode · Done", so the transition reads as
    the control changing state. Neither state is a compute action: no
    lightning, no AI tag, and pressing it sends nothing.
  */
  return (
    <button
      type="button"
      data-mi-control={selecting ? 'selection-mode-done' : 'select'}
      aria-pressed={selecting}
      aria-label={
        selecting ? `${selectionStatusLabel(t, selectedCount)} ${t.doneAria}` : t.selectAria
      }
      onClick={onToggle}
      className={`${MI_PILL} ${MI_TARGET} ${MI_SAND_FOCUS} ${MI_SELECTION_MODE_CONTROL} ${variant === 'phone' ? 'inline-flex' : ''} min-h-[44px] shrink-0 items-center gap-2 px-3.5 text-[13px] transition-colors motion-reduce:transition-none ${visibility}`}
    >
      {!selecting ? (
        <span className="whitespace-nowrap">{variant === 'phone' ? mi.select : t.selectStories}</span>
      ) : variant === 'phone' ? (
        <span className="flex flex-col items-center leading-[1.15]">
          <span className="text-[11px] font-semibold">
            {selectedCount > 0 ? fill(t.countLabel, { count: selectedCount }) : t.modeLabel}
          </span>
          <span className="text-[13.5px] font-bold">{mi.done}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap">{t.modeDone}</span>
      )}
    </button>
  );
}

/** The one accessible state line: announced whenever the mode or the count changes. */
export function SelectionStatus({
  language,
  selecting,
  selectedCount,
}: {
  language: LanguageCode;
  selecting: boolean;
  selectedCount: number;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.selection;

  return (
    <p role="status" aria-live="polite" className="sr-only" data-mi-selection-status="">
      {selecting ? selectionStatusLabel(t, selectedCount) : ''}
    </p>
  );
}

/**
 * FIRST-USE NOTE. Informational, never a modal and never a blocker. It names
 * no price, credit or balance — Sand charging is off — and it says the one
 * true thing about compute: AI runs only on an explicit confirmation.
 *
 * It lives in page state only: this surface keeps NO browser storage (a
 * standing rule, asserted by its own spec). It shows when selection mode opens
 * with nothing selected, and leaves after the first selection or "Got it".
 */
export function SelectionIntro({
  language,
  visible,
  onDismiss,
}: {
  language: LanguageCode;
  visible: boolean;
  onDismiss: () => void;
}): JSX.Element | null {
  const t = getDictionary(language).myIntelligence.selection;

  if (!visible) return null;

  return (
    <div
      data-mi-selection-intro=""
      className={`${MI_CARD} ${MI_SELECTION_PANEL} flex flex-col gap-2 px-4 py-3 text-[13px] leading-[1.5] sm:flex-row sm:items-start sm:justify-between`}
    >
      <div className="flex flex-col gap-1">
        <p className="text-[#e4eefb]">{t.introBody}</p>
        {/* INTEREST + SELECTION HOOK R1 — the intro teaches the sand + control. */}
        <p data-mi-hook-hint="" className="text-[#D9B98A]">{t.hookHint}</p>
        <p className="flex items-center gap-1.5 text-[#D9B98A]">
          <ComputeMark className="h-[12px] w-[12px]" />
          <span>{t.introCompute}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={`${MI_TARGET} ${MI_FOCUS} ${MI_LOCAL_ACTION} shrink-0 self-start rounded-[10px] px-2 text-[13px]`}
      >
        {t.introDismiss}
      </button>
    </div>
  );
}

/** The three lines every selection surface states: how many, what next, what costs compute. */
function SelectionHeading({
  language,
  selectedCount,
  onClear,
  as: Heading,
}: {
  language: LanguageCode;
  selectedCount: number;
  onClear: () => void;
  as: 'h2' | 'p';
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.selection;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#D9B98A]">{t.modeLabel}</span>
          <Heading data-mi-selected-count={selectedCount} className="text-[14.5px] font-bold text-white">
            {storiesSelectedLabel(t, selectedCount)}
          </Heading>
        </span>
        <button
          type="button"
          data-mi-control="clear"
          onClick={onClear}
          className={`${MI_TARGET} ${MI_FOCUS} ${MI_LOCAL_ACTION} shrink-0 rounded-[10px] px-2 text-[13px]`}
        >
          {t.clear}
        </button>
      </div>
      <p className="text-[12.5px] font-semibold text-[#cfe2f2]">{t.guidance}</p>
      <p data-mi-cost-note="" className="flex items-start gap-1.5 text-[12px] leading-[1.4] text-[#D9B98A]">
        <ComputeMark className="mt-[2px] h-[11px] w-[11px]" />
        <span>{t.costNote}</span>
      </p>
    </div>
  );
}

/**
 * THE PHONE AND TABLET ACTION RAIL.
 *
 * ── WHY THE FADE IS PART OF THE PRODUCT, NOT DECORATION ──────────────────
 *
 * Six actions do not fit at 360, 390, 430 or 768. The first version of this
 * design cut the third pill dead at the viewport edge, mid-shape, with no
 * cue — which reads as a layout bug, not as a rail, and left half the action
 * model undiscoverable. The Product Owner froze the correction: a 24 px
 * trailing fade into the bar's own fill, the count in the heading, and
 * trailing padding so the last pill is FADED rather than SLICED.
 *
 * COLOR / ACTION-AWARENESS R1 — the cue now follows the scroll position: a
 * leading fade once scrolled, a trailing fade plus a "more actions" chevron
 * until the end is reached. The chevron is a real control (it scrolls the
 * rail), so the continuation is visible AND operable.
 *
 * The fades are `pointer-events-none` so they can never swallow a tap meant
 * for the pill beneath, and they are hidden from assistive technology, which
 * reaches all six pills through DOM order regardless of scroll position.
 */
/**
 * The bottom nav's REAL rendered height, safe area included. Its labels may
 * take two lines (Polish does), so a fixed 56px offset let the rail slide
 * under a taller nav. Measured and observed; null until measured, and the rail
 * then falls back to the accepted 56px + safe-area offset.
 */
function useBottomNavHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const nav = document.querySelector<HTMLElement>('[data-gn-bottom-nav]');
    if (nav === null) return undefined;
    const measure = (): void => {
      const measured = nav.getBoundingClientRect().height;
      setHeight(measured > 0 ? Math.ceil(measured) : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return height;
}

export function SelectionRail({
  language,
  selectedCount,
  onClear,
  onAction,
}: {
  language: LanguageCode;
  selectedCount: number;
  onClear: () => void;
  onAction: (id: ActionId) => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.selection;
  const navHeight = useBottomNavHeight();
  const listRef = useRef<HTMLUListElement | null>(null);
  const [position, setPosition] = useState<'start' | 'middle' | 'end'>('start');

  const measure = useCallback(() => {
    const list = listRef.current;
    if (list === null) return;
    const max = list.scrollWidth - list.clientWidth;
    setPosition(max <= 1 ? 'end' : list.scrollLeft <= 1 ? 'start' : list.scrollLeft >= max - 1 ? 'end' : 'middle');
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const scrollOn = (): void => {
    const list = listRef.current;
    if (list === null) return;
    list.scrollBy({ left: Math.round(list.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <div
      data-mi-selection-rail=""
      className={`fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 ${MI_SELECTION_BAR} lg:hidden`}
      style={navHeight !== null ? { bottom: `${navHeight}px` } : undefined}
      role="region"
      aria-label={storiesSelectedLabel(t, selectedCount)}
    >
      <div className="px-4 pb-1 pt-2.5">
        <SelectionHeading language={language} selectedCount={selectedCount} onClear={onClear} as="p" />
      </div>

      <div className="relative" data-mi-rail-position={position}>
        <ul
          ref={listRef}
          onScroll={measure}
          className="flex snap-x scroll-px-4 items-center gap-2 overflow-x-auto px-4 pb-3 pt-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          /* Trailing padding clears the chevron, so the final pill is never sliced. */
          style={{ paddingInlineEnd: '56px' }}
        >
          {MI_ACTIONS.map(({ id, min }) => (
            <li key={id} className="shrink-0">
              <ActionPill
                id={id}
                min={min}
                enabled={selectedCount >= min}
                language={language}
                onPress={() => onAction(id)}
              />
            </li>
          ))}
        </ul>
        {position !== 'start' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-[24px]"
            style={{ background: `linear-gradient(to left, rgba(4,17,31,0), ${MI_SELECTION_FILL})` }}
          />
        )}
        {position !== 'end' && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-[64px]"
              style={{ background: `linear-gradient(to right, rgba(4,17,31,0), ${MI_SELECTION_FILL} 55%)` }}
            />
            <button
              type="button"
              data-mi-control="more-actions"
              aria-label={t.moreActions}
              onClick={scrollOn}
              className={`${MI_FOCUS} absolute right-1.5 top-1/2 flex h-[44px] w-[36px] -translate-y-[calc(50%+6px)] items-center justify-center rounded-full text-[#D9B98A]`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The desktop side panel. Actions stack, so there is no rail and no fade. */
export function SelectionPanel({
  language,
  selectedCount,
  onClear,
  onAction,
}: {
  language: LanguageCode;
  selectedCount: number;
  onClear: () => void;
  onAction: (id: ActionId) => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.selection;

  return (
    <section
      data-mi-selection-panel=""
      className={`${MI_CARD} ${MI_SELECTION_PANEL} hidden p-4 lg:block`}
      aria-label={storiesSelectedLabel(t, selectedCount)}
    >
      <SelectionHeading language={language} selectedCount={selectedCount} onClear={onClear} as="h2" />
      <ul className="mt-3 flex flex-col gap-2">
        {MI_ACTIONS.map(({ id, min }) => (
          <li key={id}>
            <ActionPill
              id={id}
              min={min}
              enabled={selectedCount >= min}
              language={language}
              onPress={() => onAction(id)}
              block
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * COMPUTE-ACTION CLOSURE R1 — the six UI actions, mapped EXACTLY onto the
 * governed multi-story actions. No other action exists.
 */
export const MI_ACTION_TO_MULTI_STORY: Readonly<Record<ActionId, MultiStoryAction>> = {
  compare: 'COMPARE',
  summarize: 'SUMMARIZE',
  askAbout: 'ASK_SELECTED',
  explain: 'EXPLAIN_DISAGREEMENTS',
  whatChanged: 'WHAT_CHANGED',
  briefing: 'CREATE_BRIEFING',
};

export type ComputeRunStatus = 'idle' | 'running' | 'failed';

function actionTitle(t: ReturnType<typeof getDictionary>['myIntelligence']['compute'], action: ActionId, count: number): string {
  const titles: Record<ActionId, string> = {
    compare: fill(t.titleCompare, { count }),
    summarize: fill(t.titleSummarize, { count }),
    askAbout: fill(t.titleAsk, { count }),
    explain: fill(t.titleExplain, { count }),
    whatChanged: fill(t.titleWhatChanged, { count }),
    briefing: fill(t.titleBriefing, { count }),
  };
  return titles[action];
}

/**
 * THE COMPUTE-COMMIT SHEET — the one place on this surface where AI can start.
 *
 * Everything before this point is free of compute: browsing, saving,
 * following, selecting, filtering and switching language all run nothing. The
 * sand note states the boundary in the frozen wording, with no price, no
 * credits and no balance, because Sand charging is off and the fixture quotes
 * are design fixtures rather than prices.
 *
 * The primary says Run or Send, never Open — the CTO ruling that a
 * compute-triggering control must name the compute.
 *
 * COMPUTE-ACTION CLOSURE R1 — the primary is now the real commitment: it hands
 * the typed question to the caller, which crosses the governed selection
 * compute boundary exactly once. While that runs the primary is disabled
 * and says so, Cancel and Esc are held, and the selection stays intact. A
 * failure stays HERE, with the selection, and the primary becomes an explicit
 * "Try again". Stories without a governed reference are listed as left out —
 * never sent as a bare URL.
 */
export function ComputeCommitSheet({
  language,
  action,
  storyTitles,
  excludedCount = 0,
  status = 'idle',
  errorMessage,
  onCancel,
  onConfirm,
}: {
  language: LanguageCode;
  action: ActionId;
  /** The selected stories that WILL be sent: each carries a governed reference. */
  storyTitles: readonly string[];
  /** Selected stories refused locally because they carry no governed reference. */
  excludedCount?: number;
  status?: ComputeRunStatus;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (question: string) => void;
}): JSX.Element {
  const mi = getDictionary(language).myIntelligence;
  const t = mi.compute;
  const [question, setQuestion] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const isAsk = action === 'askAbout';
  const count = storyTitles.length;
  const min = MI_ACTIONS.find((entry) => entry.id === action)?.min ?? 1;
  const running = status === 'running';
  const tooFew = count < min;
  const questionMissing = isAsk && question.trim().length < 2;
  const blocked = running || tooFew || questionMissing;

  /* Focus moves into the sheet, and Esc closes it — except while a Run is in flight. */
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !running) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, running]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(2,6,14,0.72)] sm:items-center">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={running ? undefined : onCancel}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={actionTitle(t, action, count)}
        aria-busy={running}
        data-mi-compute-sheet={status}
        tabIndex={-1}
        className={`${MI_SHEET} relative z-10 flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-y-auto border border-[#0e2d4d] bg-[#04162b] p-5 outline-none`}
      >
        <h2 className="text-[17px] font-bold leading-[1.25] text-white">{actionTitle(t, action, count)}</h2>

        {/* On a phone keyboard the list collapses to a count so the draft stays readable. */}
        <p className="mt-2 text-[12.5px] text-[#7d92aa] sm:hidden">
          {fill(t.storiesAttached, { count })}
        </p>
        <ul className="mt-2 hidden flex-col gap-1 sm:flex">
          {storyTitles.map((title) => (
            <li key={title} className="text-[12.5px] leading-[1.45] text-[#93a7bd]">
              · {title}
            </li>
          ))}
        </ul>

        {excludedCount > 0 && (
          <p data-mi-excluded={excludedCount} role="note" className="mt-2 text-[12.5px] leading-[1.45] text-[#cfe2f2]">
            {fill(excludedCount === 1 ? t.missingRefOne : t.missingRefOther, { count: excludedCount })}
          </p>
        )}
        {tooFew && (
          <p data-mi-too-few="" role="note" className="mt-2 text-[12.5px] leading-[1.45] text-[#cfe2f2]">
            {fill(t.tooFewVerified, { count: min })}
          </p>
        )}

        {isAsk && (
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-[#cfe2f2]">{t.questionLabel}</span>
            <textarea
              value={question}
              maxLength={1000}
              rows={3}
              disabled={running}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.questionPlaceholder}
              className="w-full resize-y rounded-[10px] border border-[#1d3a5a] bg-[#02101f] p-3 text-[14px] text-[#e4eefb] outline-none focus:border-[#2f6ea8]"
            />
            <span className="flex items-center justify-between text-[11.5px] text-[#7d92aa]">
              <span>{questionMissing ? t.questionRequired : t.draftOnly}</span>
              <span>{question.length}/1000</span>
            </span>
          </label>
        )}

        <p className={`${MI_SAND_NOTE} mt-3 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.45]`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[1px] h-[14px] w-[14px] shrink-0" fill="currentColor">
            <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
          </svg>
          <span>{t.sandNote}</span>
        </p>

        {running && (
          <p data-mi-running="" role="status" className="mt-2 text-[12.5px] leading-[1.45] text-[#cfe2f2]">
            {t.runningNote}
          </p>
        )}
        {status === 'failed' && (
          <div data-mi-run-failed="" role="alert" className={`${MI_BANNER_ERROR} mt-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.45]`}>
            <p className="font-semibold">{t.failedTitle}</p>
            {errorMessage !== undefined && <p className="mt-0.5">{errorMessage}</p>}
          </div>
        )}

        <p className="mt-2 text-[11.5px] leading-[1.4] text-[#7d92aa]">{t.languageNote}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={running}
            className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} inline-flex h-[44px] items-center border border-[#1d3a5a] px-4 text-[13.5px] font-semibold text-[#cfe2f2] disabled:opacity-50`}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            data-mi-control="run"
            disabled={blocked}
            aria-disabled={blocked}
            onClick={() => {
              if (!blocked) onConfirm(question);
            }}
            className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} inline-flex h-[44px] items-center gap-2 border border-[#6a5634] bg-[#2e2618] px-4 text-[13.5px] font-bold text-[#D9B98A] disabled:opacity-50`}
          >
            {running ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px] animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="currentColor">
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
              </svg>
            )}
            {running
              ? t.running
              : status === 'failed'
                ? t.retry
                : isAsk
                  ? t.send
                  : action === 'compare'
                    ? t.run
                    : t.runGeneric}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * THE RESULT — ONE RESPONSE, THROUGH THE EXISTING READER.
 *
 * The analysis itself is rendered by `AskCompactResult`, the governed reader
 * of an AnalysisApiResponse (execution badge, brief, cited sources,
 * telemetry). Nothing here re-renders analysis. This wrapper adds only the
 * SELECTION facts the response already carries in retrievalContext.selection:
 * which action ran, how many selected stories resolved, and which did not.
 *
 * The /search transition is switched off for this result: it rebuilds a
 * single-question request, and would run a different, unscoped analysis
 * rather than reopen this one. The note says so rather than offering it.
 */
export function SelectionResultSheet({
  language,
  action,
  response,
  question,
  titlesByRef,
  onClose,
  operationId,
}: {
  language: LanguageCode;
  action: ActionId;
  response: AnalysisApiResponse;
  question: string;
  titlesByRef: Readonly<Record<string, string>>;
  onClose: () => void;
  /** R2D — the canonical Ask operation this result IS (display-only reopen, never a rerun). */
  operationId?: string;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.compute;
  const selection = response.retrievalContext?.selection;
  const requested = selection?.requested ?? Object.keys(titlesByRef).length;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(2,6,14,0.72)] sm:items-center">
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={actionTitle(t, action, requested)}
        data-mi-result={selection?.action ?? MI_ACTION_TO_MULTI_STORY[action]}
        tabIndex={-1}
        className={`${MI_SHEET} relative z-10 flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-y-auto border border-[#0e2d4d] bg-[#04162b] p-5 outline-none`}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#D9B98A]">{t.resultLabel}</p>
        <h2 className="mt-0.5 text-[17px] font-bold leading-[1.25] text-white">{actionTitle(t, action, requested)}</h2>

        {selection !== undefined && (
          <div data-mi-result-selection="" className="mt-2 flex flex-col gap-1 text-[12.5px] leading-[1.45]">
            <p data-mi-resolved={`${selection.resolved}/${selection.requested}`} className="text-[#cfe2f2]">
              {fill(t.resultResolved, { resolved: selection.resolved, requested: selection.requested })}
            </p>
            {selection.unresolvedRefs.length > 0 && (
              <div data-mi-unresolved={selection.unresolvedRefs.length}>
                <p className="text-[#cfe2f2]">{t.resultUnresolved}</p>
                <ul className="mt-0.5 flex flex-col gap-0.5 text-[#93a7bd]">
                  {selection.unresolvedRefs.map((ref) => (
                    <li key={ref}>· {titlesByRef[ref] ?? `${ref.slice(0, 12)}…`}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <AskCompactResult
            response={response}
            question={question}
            language={language}
            context={undefined}
            showFullAnalysisLink={false}
          />
        </div>

        <p className="mt-3 text-[11.5px] leading-[1.45] text-[#7d92aa]">{t.resultFullNote}</p>

        <div className="mt-4 flex items-center justify-end gap-3">
          {operationId !== undefined && (
            <a
              data-mi-control="open-in-ask"
              href={openFullAnalysisHref(operationId)}
              className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} inline-flex h-[44px] items-center border border-[#1d3a5a] px-4 text-[13.5px] text-[#5abff5]`}
            >
              {t.openInAsk}
            </a>
          )}
          <button
            type="button"
            data-mi-control="close-result"
            onClick={onClose}
            className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} ${MI_LOCAL_ACTION} inline-flex h-[44px] items-center border border-[#1d3a5a] px-4 text-[13.5px]`}
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
