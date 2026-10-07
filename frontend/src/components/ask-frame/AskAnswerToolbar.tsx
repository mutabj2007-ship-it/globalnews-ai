'use client';

import { useEffect, useId, useRef, useState, type JSX, type ReactNode } from 'react';
import type { AnalysisSourceRef, DisplayLocale } from '@globalnews-ai/shared';
import type { AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { AskTurnCopy } from './AskTurnCopy';
import { AskTurnSave } from './AskTurnSave';
import { AskTurnBrief } from './AskTurnBrief';
import { useAskSourcesPanel } from './AskSourcesPanel';
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DESIGN COMPLETENESS R1 — THE ANSWER TOOLBAR (Design B1 · C1–C5 · §8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   Copy · Share · Save · Sources (n) · More      `role="toolbar"`, text labels, 44 px, wraps.
 *
 * Only real capability renders (the Design's own rule: "Remove actions that are not
 * implemented. Do not show dummy controls."):
 *
 *   Copy       the turn's question, answer and links → local clipboard (no network)
 *   Share      the OS share sheet (`navigator.share`) with this ONE answer's question, opening
 *              and source links. Rendered only where the platform offers it.
 *              CAPABILITY-BLOCKED — "Copy link": no answer-scoped share-link endpoint (D7).
 *   Save       the reader's bookmark (`/ask-v2/bookmarks`), Saved feedback + Undo
 *   Sources n  this answer's own list in the panel / sheet; hidden when n = 0
 *   More       Refresh reporting (a NEW explicit turn for the same question — the answer on
 *              screen stays until the new one arrives) and Use in a briefing (`/ask-v2/briefings`).
 *              CAPABILITY-BLOCKED — "Download" (no export endpoint, D8) and "What Ask remembers"
 *              (no preferences store, D6): omitted, never shown disabled.
 */
function ActionSheet({
  title,
  closeLabel,
  onClose,
  children,
}: {
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-ask="sheet-close"]')?.focus({ preventScroll: true });
  }, []);
  return (
    <div data-ask="sheet-layer" className={`${styles.sheetLayer} ${styles.actionLayer}`}>
      <div aria-hidden="true" onClick={onClose} className={styles.sheetScrim} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ask="action-sheet"
        className={`${styles.sheet} ${styles.actionSheet}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== 'Tab' || box.current === null) return;
          const items = [
            ...box.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
          ];
          const first = items[0];
          const last = items[items.length - 1];
          if (first === undefined || last === undefined) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className={styles.sheetHead}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" data-ask="sheet-close" onClick={onClose} className={styles.sheetClose}>
            {closeLabel}
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
      </div>
    </div>
  );
}

export function AskAnswerToolbar({
  turn,
  locale,
  canSave,
  sources,
  opening,
  note,
  about,
  onRefresh,
  openFullHref,
  onRunDeeper,
}: {
  readonly turn: AskR2Turn;
  readonly locale: DisplayLocale;
  readonly canSave: boolean;
  /** The SAME array the inline citations number against. */
  readonly sources: readonly AnalysisSourceRef[];
  /** The answer's opening, for the Share preview (clamped to 3 lines there). */
  readonly opening: string;
  /** The limited-reporting note, repeated at the top of Sources. */
  readonly note: string | null;
  /** "About this answer" lines for the Sources panel. */
  readonly about: readonly string[];
  /** Refresh reporting — a new explicit turn for this question. Absent → not offered. */
  readonly onRefresh?: (question: string) => void;
  /**
   * ASK DESIGN AUTHORITY R3 — CTO RULING 6. The legacy hand-offs leave the reading flow; where
   * they still do something real they are rows of More. Absent → not offered.
   */
  readonly openFullHref?: string;
  /** Run deeper analysis — asks for confirmation before anything runs (AskDeepConfirm). */
  readonly onRunDeeper?: () => void;
}): JSX.Element {
  const s = askShellStrings(locale).askR2Strings;
  const r = s.read;
  const openSources = useAskSourcesPanel();
  const [canShare, setCanShare] = useState(false);
  const [sheet, setSheet] = useState<'share' | 'more' | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  /* After mount only: the server render never claims a platform capability. */
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  const close = () => {
    setSheet(null);
    opener.current?.focus({ preventScroll: true });
  };
  /* More is offered only when it holds a real action; a More that could open empty never is. */
  const offerMore = onRefresh !== undefined || openFullHref !== undefined || onRunDeeper !== undefined;

  return (
    <>
      <div data-ask="turn-actions" role="toolbar" aria-label={r.moreTitle} className="flex flex-wrap items-center">
        {/* TRUST R1 — copy this answer (local clipboard only; nothing is shared or sent). */}
        <AskTurnCopy locale={locale} />
        {canShare && (
          <button
            type="button"
            data-ask="share"
            onClick={(event) => {
              opener.current = event.currentTarget;
              setSheet('share');
            }}
          >
            {r.share}
          </button>
        )}
        {/* STANDALONE PUBLIC BETA CONVERGENCE R1 — the reader's Save / Saved (0 AI). */}
        {canSave && <AskTurnSave operation={turn.operation} locale={locale} />}
        {openSources !== null && sources.length > 0 && (
          <button
            type="button"
            data-ask="open-sources"
            onClick={(event) =>
              openSources({ sources, opener: event.currentTarget, note, about })
            }
          >
            {s.sources}
            <span data-count="">{sources.length}</span>
            <span className={styles.visuallyHidden}>{` (${s.sourcesLabel(sources.length)})`}</span>
          </button>
        )}
        {offerMore && (
          <button
            type="button"
            data-ask="more"
            aria-haspopup="dialog"
            onClick={(event) => {
              opener.current = event.currentTarget;
              setSheet('more');
            }}
          >
            {r.more}
          </button>
        )}
      </div>
      {sheet === 'share' && (
        <ActionSheet title={r.shareTitle} closeLabel={s.close} onClose={close}>
          <div data-ask="share-preview" className={styles.sharePreview}>
            <p>{turn.question}</p>
            <p>{opening}</p>
            <p>{r.shareIncludes(sources.length)}</p>
          </div>
          <p className="mt-3 text-[0.9375rem] leading-[1.5] text-[var(--ad-ink-2,#93a0b8)]">{r.sharePrivacy}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              data-ask="share-via"
              className={styles.secondaryWide}
              onClick={() => {
                /* Only this answer: its question, opening and its own source links. */
                const links = sources.map((source) => `- ${source.title} ${source.url}`).join('\n');
                const text = [turn.question, opening, links].filter((part) => part !== '').join('\n\n');
                void navigator.share({ title: turn.question, text }).then(close, () => undefined);
              }}
            >
              {r.shareVia}
            </button>
          </div>
        </ActionSheet>
      )}
      {sheet === 'more' && (
        <ActionSheet title={r.moreTitle} closeLabel={s.close} onClose={close}>
          {onRefresh !== undefined && (
            <button
              type="button"
              data-ask="refresh-reporting-action"
              className={styles.actionRow}
              onClick={() => {
                close();
                onRefresh(turn.question);
              }}
            >
              <span>{r.refreshReporting}</span>
              <span>{r.refreshNote}</span>
            </button>
          )}
          {onRunDeeper !== undefined && (
            <button
              type="button"
              data-ask="run-deeper"
              className={styles.actionRow}
              onClick={() => {
                close();
                onRunDeeper();
              }}
            >
              <span>{s.runDeep}</span>
              <span>{s.runDeepMeta}</span>
            </button>
          )}
          {openFullHref !== undefined && (
            <a data-ask="open-full-analysis" href={openFullHref} className={styles.actionRow}>
              <span>{s.openFull}</span>
            </a>
          )}
          {canSave && (
            /* R2 · D1 — Use in a briefing: shown only when the server has briefings switched on. */
            <div data-ask="more-briefing">
              <AskTurnBrief operation={turn.operation} locale={locale} label={r.useInBriefing} />
            </div>
          )}
        </ActionSheet>
      )}
    </>
  );
}
