'use client';

import { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  MI_CARD,
  MI_PILL,
  MI_SAND_NOTE,
  MI_SELECTION_BAR,
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

function ActionIcon({ id }: { id: ActionId }): JSX.Element {
  const paths: Record<ActionId, string> = {
    compare: 'M4 7h6M4 12h6M4 17h6M14 7h6M14 12h6M14 17h6',
    summarize: 'M5 5h14M5 10h14M5 15h9',
    askAbout: 'M4 5h16v11H9l-5 4V5Z',
    explain: 'M12 4v16M4 9h6M14 15h6M4 15h6M14 9h6',
    whatChanged: 'M4 16 9 9l4 4 7-8',
    briefing: 'M6 3h9l4 4v14H6V3Zm9 0v4h4',
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] shrink-0 text-[#a78bfa]"
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

function ActionPill({
  id,
  enabled,
  min,
  language,
  onPress,
}: {
  id: ActionId;
  enabled: boolean;
  min: number;
  language: LanguageCode;
  onPress: () => void;
}): JSX.Element {
  const t = getDictionary(language).myIntelligence.selection;

  return (
    <button
      type="button"
      disabled={!enabled}
      aria-disabled={!enabled}
      title={enabled ? undefined : fill(t.selectAtLeast, { count: min })}
      onClick={onPress}
      className={`${MI_PILL} ${MI_TARGET} inline-flex h-[44px] shrink-0 snap-start items-center gap-2 border px-3.5 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${
        enabled
          ? 'border-[#1d3a5a] bg-[#0a2340] text-[#e4eefb] hover:border-[#2f6ea8]'
          : 'cursor-not-allowed border-[#173350] bg-[#071c33] text-[#54687e]'
      }`}
    >
      <ActionIcon id={id} />
      <span className="whitespace-nowrap">{t.actions[id]}</span>
      <AiTag label={t.aiTag} />
    </button>
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
 * The fade is `pointer-events-none` so it can never swallow a tap meant for
 * the pill beneath it, and it is hidden from assistive technology, which
 * reaches all six pills through DOM order regardless of scroll position.
 *
 * The scrollbar is hidden but the SCROLLING is not: `overflow-x-auto` with
 * `scroll-snap` stays, so swipe, trackpad, keyboard and programmatic scrolling
 * all continue to work. Hiding the bar without hiding the overflow is the
 * whole reason the fade has to exist.
 */
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

  return (
    <div
      className={`fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 ${MI_SELECTION_BAR} lg:hidden`}
      role="region"
      aria-label={t.summary}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-1.5 pt-3">
        <span className="text-[13.5px] font-bold text-white">
          {fill(t.countLabel, { count: selectedCount })}
        </span>
        <span className="flex items-center gap-3">
          {/* The count is the discoverability signal: it says six exist without a scrollbar. */}
          <span className="text-[12.5px] text-[#93a7bd]">
            {fill(t.pickAction, { count: MI_ACTIONS.length })}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-[13px] font-semibold text-[#5abff5]"
          >
            {t.clear}
          </button>
        </span>
      </div>

      <div className="relative">
        <ul
          className="flex snap-x items-center gap-2 overflow-x-auto px-4 pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          /* Trailing padding = inset + 24px, so the final pill clears the fade. */
          style={{ paddingInlineEnd: '40px' }}
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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-[24px] bg-[linear-gradient(to_right,rgba(6,26,48,0),#061a30)]"
        />
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
    <section className={`${MI_CARD} hidden p-4 lg:block`} aria-label={t.summary}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-white">
          {fill(t.countLabel, { count: selectedCount })}
        </h2>
        <button type="button" onClick={onClear} className="text-[13px] font-semibold text-[#5abff5]">
          {t.clear}
        </button>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#93a7bd]">{t.summary}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {MI_ACTIONS.map(({ id, min }) => (
          <li key={id}>
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
