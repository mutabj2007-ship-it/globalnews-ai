'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  MI_AI_ACTION_OFF,
  MI_AI_ACTION_ON,
  MI_CARD,
  MI_FOCUS,
  MI_LOCAL_ACTION,
  MI_PILL,
  MI_SAND_NOTE,
  MI_SELECTION_BAR,
  MI_SELECTION_FILL,
  MI_SELECTION_MODE_CONTROL,
  MI_SELECTION_PANEL,
  MI_SHEET,
  MI_TARGET,
} from './miPresentation';
import { AiTag, fill } from './MiPrimitives';

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
function ActionPill({
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

  if (!selecting) {
    return (
      <button
        type="button"
        data-mi-control="select"
        onClick={onToggle}
        className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} ${variant === 'phone' ? 'inline-flex' : ''} h-[44px] shrink-0 items-center gap-1.5 border border-[#1d3a5a] px-3.5 text-[13px] font-semibold text-[#cfe2f2] ${visibility}`}
      >
        {mi.select}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-mi-control="selection-mode-done"
      aria-pressed="true"
      aria-label={`${selectionStatusLabel(t, selectedCount)} ${t.doneAria}`}
      onClick={onToggle}
      className={`${MI_PILL} ${MI_TARGET} ${MI_FOCUS} ${MI_SELECTION_MODE_CONTROL} ${variant === 'phone' ? 'inline-flex' : ''} min-h-[44px] shrink-0 items-center gap-2 px-3.5 text-[13px] ${visibility}`}
    >
      {variant === 'phone' ? (
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
 */
export function ComputeCommitSheet({
  language,
  action,
  storyTitles,
  onCancel,
  onConfirm,
}: {
  language: LanguageCode;
  action: ActionId;
  storyTitles: readonly string[];
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  const mi = getDictionary(language).myIntelligence;
  const t = mi.compute;
  const [question, setQuestion] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const isAsk = action === 'askAbout';
  const count = storyTitles.length;

  const titles: Record<ActionId, string> = {
    compare: fill(t.titleCompare, { count }),
    summarize: fill(t.titleSummarize, { count }),
    askAbout: fill(t.titleAsk, { count }),
    explain: fill(t.titleExplain, { count }),
    whatChanged: fill(t.titleWhatChanged, { count }),
    briefing: fill(t.titleBriefing, { count }),
  };

  /* Focus moves into the sheet, and Esc closes it. */
  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(2,6,14,0.72)] sm:items-center">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={titles[action]}
        tabIndex={-1}
        className={`${MI_SHEET} relative z-10 flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-y-auto border border-[#0e2d4d] bg-[#04162b] p-5 outline-none`}
      >
        <h2 className="text-[17px] font-bold leading-[1.25] text-white">{titles[action]}</h2>

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

        {isAsk && (
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-[#cfe2f2]">{t.questionLabel}</span>
            <textarea
              value={question}
              maxLength={1000}
              rows={3}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.questionPlaceholder}
              className="w-full resize-y rounded-[10px] border border-[#1d3a5a] bg-[#02101f] p-3 text-[14px] text-[#e4eefb] outline-none focus:border-[#2f6ea8]"
            />
            <span className="flex items-center justify-between text-[11.5px] text-[#7d92aa]">
              <span>{t.draftOnly}</span>
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

        <p className="mt-2 text-[11.5px] leading-[1.4] text-[#7d92aa]">{t.languageNote}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`${MI_PILL} ${MI_TARGET} inline-flex h-[44px] items-center border border-[#1d3a5a] px-4 text-[13.5px] font-semibold text-[#cfe2f2]`}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            disabled={isAsk && question.trim().length === 0}
            onClick={onConfirm}
            className={`${MI_PILL} ${MI_TARGET} inline-flex h-[44px] items-center gap-2 border border-[#6a5634] bg-[#2e2618] px-4 text-[13.5px] font-bold text-[#D9B98A] disabled:opacity-50`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="currentColor">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
            </svg>
            {isAsk ? t.send : action === 'compare' ? t.run : t.runGeneric}
          </button>
        </div>
      </div>
    </div>
  );
}
