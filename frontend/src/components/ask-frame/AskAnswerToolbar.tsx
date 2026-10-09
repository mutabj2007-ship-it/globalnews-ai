'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type JSX,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import type { AnalysisSourceRef, DisplayLocale } from '@globalnews-ai/shared';
import type { AskR2Turn } from '@/lib/ask/useAskR2Conversation';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { AskActionGlyph } from './AskActionGlyph';
import { AskTurnCopy } from './AskTurnCopy';
import { AskTurnSave } from './AskTurnSave';
import { AskTurnBrief } from './AskTurnBrief';
import { AskTurnFollow } from './AskTurnFollow';
import { useAskSourcesPanel } from './AskSourcesPanel';
import styles from './askDashboard.module.css';
import { askV2Api } from '@/lib/api/askV2Api';
import { cleanAskDestination } from '@/lib/ask/askCleanNavigation';
import { askR3FullStrings } from '@/lib/ask/askR3FullStrings';
import { followStrings } from '@/lib/ask/followStrings';
import { useAskNavOptional } from '@/components/ask-nav/AskNavShell';
import { AskConfirmDialog } from './AskConfirmDialog';
import { useAskToast } from './AskToast';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DESIGN COMPLETENESS R1 — THE ANSWER TOOLBAR (Design B1 · C1–C5 · §8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   Copy · Share · Save · Sources (n) · More      `role="toolbar"`, text labels, 44 px, ONE row.
 *
 * SUPERSEDED BY PRODUCT OWNER / CLAUDE DESIGN R3 §10 (D06 revision 2, 9 Oct 2026) · the row line
 * above ended "wraps". It no longer wraps at any width. The superseded rationale is kept on the
 * record: wrapping was accepted while every action was a bordered text pill of equal weight, so a
 * second line cost nothing but height. R3 §10 replaces that with one row of fixed order and a
 * flexible gap before More, and moves the secondary action (Share) into More where the row is
 * narrow — so nothing is dropped, nothing is duplicated and nothing wraps.
 *
 * "Follow this question" left this row entirely (R3 §10: "stays outside the row, in its own card
 * below, as the deliberate continuity action"). It is rendered below as `turn-continuity`.
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
 *              screen stays until the new one arrives) and Use in a briefing (`/ask-v2/briefings`),
 *              plus Share as its first row while the row is narrow (R3 §10).
 *              CAPABILITY-BLOCKED — "Download" (no export endpoint, D8) and "What Ask remembers"
 *              (no preferences store, D6): omitted, never shown disabled. R3 §10 also lists
 *              "Download briefing", "Compare reporting", "Listen · coming later" and "Delete
 *              conversation" as More rows: NOT rendered. The first two have no endpoint, the third
 *              is a disabled control the same Design forbids, and conversation delete belongs to
 *              the conversation, not to one answer (CLAUDE CODE R3-H01 §3; CTO: no dummy features).
 */
/**
 * CLAUDE DESIGN R3 §10 (D06 revision 2) — "Below 360 px: Share moves to the top of More".
 *
 * This is the package's own breakpoint, read from its own prototype: `small = s.w > 0 && s.w < 360`
 * and `showShareInline: !small`.
 *
 * SUPERSEDED: this lane briefly used 600 px, because it had substituted TEXT LABELS for the
 * approved icon row and five text pills do not fit one line at 390 px. The CTO DESIGN R3
 * COMPLETION CONTRACT of 9 Oct 2026 withdrew that substitution — "The previously introduced 600px
 * Share-to-More rule is not an approved visual requirement" — and the icon row restores the
 * geometry the 360 px figure was derived from. The measurements are in GEOMETRY-MEASUREMENT.md.
 */
export const ASK_TOOLBAR_COMPACT_QUERY = '(max-width: 359px)';

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
  const [sheet, setSheet] = useState<'share' | 'more' | 'delete' | null>(null);
  /* R3 FULL DESIGN · D06 More — Delete conversation (the reader's own, existing DELETE) */
  const nav = useAskNavOptional();
  const toast = useAskToast();
  const r3 = askR3FullStrings(locale);
  const fs3 = followStrings(locale);
  const threadId = turn.operation?.threadId ?? null;
  const canDelete = canSave && threadId !== null && nav !== null;
  const opener = useRef<HTMLElement | null>(null);
  const row = useRef<HTMLDivElement>(null);
  /*
    The server render starts at the NARROW shape (compact = true). A row that must never wrap is
    safest rendered at its narrowest before the viewport is known: the only post-mount change a
    wide reader sees is Share moving out of More into the row, never a wrapped first paint.
  */
  const [compact, setCompact] = useState(true);
  /* After mount only: the server render never claims a platform capability. */
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setCompact(false);
      return;
    }
    const media = window.matchMedia(ASK_TOOLBAR_COMPACT_QUERY);
    const read = (): void => setCompact(media.matches === true);
    read();
    /* Optional, as elsewhere in Ask: a host that stubs `matchMedia` down to `{ matches }` still
       gets the right row for its width; it just does not follow a later resize. */
    media.addEventListener?.('change', read);
    return () => media.removeEventListener?.('change', read);
  }, []);
  const close = () => {
    setSheet(null);
    opener.current?.focus({ preventScroll: true });
  };
  /* R3 §10 — while the row is narrow, Share is a More row rather than a row button. */
  const shareInMore = canShare && compact;
  /* More is offered only when it holds a real action; a More that could open empty never is. */
  const offerMore =
    shareInMore || onRefresh !== undefined || openFullHref !== undefined || onRunDeeper !== undefined || canDelete;

  /*
    R3 §10 — `role="toolbar"` gains the arrow-key movement ARIA expects of it: Left/Right
    (mirrored under `dir="rtl"` by reading the resolved direction, not the locale, so an embedded
    Ask inherits its host), Home and End.

    SUPERSEDED DEVIATION (kept on the record): "a roving tabindex would take four of the five
    actions out of the Tab order … so arrow keys are ADDED and nothing the keyboard could reach
    before became unreachable."

    R3 FULL DESIGN (master CTO contract 2026-10-09 §4 D06 and §6: "keyboard roving navigation",
    "roving toolbar tab index") rules it: R3 §10's "Tab enters and leaves" is implemented. The row
    is ONE Tab stop — the last action the reader focused, the first by default — and every action
    stays reachable with Left/Right/Home/End. The buttons live in child components, so the
    tabindex is applied to the rendered row (and re-applied when its children change).
  */
  const rovingIndex = useRef(0);
  const applyRoving = (): void => {
    /* a host without a DOM (test renderers) has nothing to rove */
    if (row.current === null || typeof row.current.querySelectorAll !== 'function') return;
    const items = [...row.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (items.length === 0) return;
    const keep = Math.min(rovingIndex.current, items.length - 1);
    items.forEach((item, index) => {
      item.tabIndex = index === keep ? 0 : -1;
    });
  };
  useEffect(() => {
    applyRoving();
    if (row.current === null || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => applyRoving());
    observer.observe(row.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    return () => observer.disconnect();
  });
  const onToolbarFocus = (event: ReactFocusEvent<HTMLDivElement>): void => {
    /* a host without a DOM (test renderers) has nothing to rove */
    if (row.current === null || typeof row.current.querySelectorAll !== 'function') return;
    const items = [...row.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const here = items.indexOf(event.target as HTMLElement);
    if (here < 0 || here === rovingIndex.current) return;
    rovingIndex.current = here;
    applyRoving();
  };
  const onToolbarKey = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (row.current === null) return;
    const { key } = event;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    const items = [...row.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (items.length === 0) return;
    const rtl = getComputedStyle(row.current).direction === 'rtl';
    const here = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (key === 'Home') next = 0;
    else if (key === 'End') next = items.length - 1;
    else {
      if (here < 0) return;
      next = (here + ((key === 'ArrowRight') === rtl ? -1 : 1) + items.length) % items.length;
    }
    const target = items[next];
    if (target === undefined) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
  };

  return (
    <>
      <div
        ref={row}
        data-ask="turn-actions"
        role="toolbar"
        aria-label={r.moreTitle}
        data-ask-toolbar-row={compact ? 'compact' : 'full'}
        onKeyDown={onToolbarKey}
        onFocus={onToolbarFocus}
        className="flex items-center"
      >
        {/* TRUST R1 — copy this answer (local clipboard only; nothing is shared or sent). */}
        <AskTurnCopy locale={locale} />
        {canShare && !compact && (
          <button
            type="button"
            data-ask="share"
            aria-label={r.share}
            title={r.share}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setSheet('share');
            }}
          >
            <AskActionGlyph name="share" />
          </button>
        )}
        {/* STANDALONE PUBLIC BETA CONVERGENCE R1 — the reader's Save / Saved (0 AI). */}
        {canSave && <AskTurnSave operation={turn.operation} locale={locale} />}
        {openSources !== null && sources.length > 0 && (
          /*
            §10 keeps Sources a TEXT control: "a text button: count chip + 'sources'". The chip
            precedes the word, as the package renders it, and both are `aria-hidden` because the
            button's own label already says the whole thing ("3 cited sources. Open source list").
            The count is this answer's own cited sources — never a retrieval total.
          */
          <button
            type="button"
            data-ask="open-sources"
            aria-haspopup="dialog"
            aria-label={`${s.sourcesLabel(sources.length)} — ${s.sources}`}
            onClick={(event) =>
              openSources({ sources, opener: event.currentTarget, note, about })
            }
          >
            <span aria-hidden="true" data-count="">
              {sources.length}
            </span>
            <span aria-hidden="true">{s.sources}</span>
          </button>
        )}
        {/* §10's own flexible gap: the package uses a spacer flex item, not an auto margin. */}
        <span aria-hidden="true" data-ask="turn-actions-gap" />
        {offerMore && (
          <button
            type="button"
            data-ask="more"
            aria-haspopup="dialog"
            aria-label={r.moreTitle}
            title={r.moreTitle}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setSheet('more');
            }}
          >
            <AskActionGlyph name="more" />
          </button>
        )}
      </div>
      {/*
        REASON TO RETURN R1 · §8 — follow this question (My updates); server-gated, 0 AI.

        R3 §10 moved it out of the row above into its own card: it is the deliberate continuity
        action, not a sibling of Copy and Share. Still ONE store (a Briefing with scope
        ASK_QUESTION) and still nothing scheduled — every check is one the reader starts.
        `AskTurnFollow` renders null when the answer is not followable or briefings are off, and
        the card then has no children, so CSS collapses it (`:empty`) rather than drawing an
        empty box. The card is the same at every width: nothing here is responsive.
      */}
      {canSave && (
        <div data-ask="turn-continuity">
          <AskTurnFollow operation={turn.operation} question={turn.question} locale={locale} />
        </div>
      )}

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
          {/*
            R3 §10 — Share, while the row is narrow. The SAME platform share sheet the row button
            opens (`r.share`, already qualified in all seven locales): one capability, one code
            path, reached from the row or from here, never from both at once. `opener` still points
            at More, so closing returns focus there.
          */}
          {shareInMore && (
            <button
              type="button"
              data-ask="share-in-more"
              className={styles.actionRow}
              onClick={() => setSheet('share')}
            >
              <span>{r.share}</span>
            </button>
          )}
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
          {/*
            R3 FULL DESIGN · HANDOFF §10 More lists "Delete conversation" — the reader's OWN
            conversation, the existing owner-scoped DELETE, confirmed first (AskConfirmDialog).
            Listen ("coming later", aria-disabled), Download briefing and Compare reporting stay
            OMITTED: no backend does them, and the recorded ruling is omission over a disabled
            control (CTO R3-H05; open for a Design/PO ruling in 02-MISSING-NOW-AND-DEPS.md).
          */}
          {canDelete && (
            <button
              type="button"
              data-ask="more-delete-conversation"
              className={styles.actionRow}
              onClick={() => setSheet('delete')}
            >
              <span>{r3.deleteConversationAction}</span>
            </button>
          )}
        </ActionSheet>
      )}
      {sheet === 'delete' && threadId !== null && (
        <AskConfirmDialog
          title={r3.deleteTitle}
          body={fs3.deleteConversationConfirm(turn.question)}
          note={fs3.deleteConversationNote}
          confirmLabel={fs3.deleteConversation}
          cancelLabel={r3.keep}
          onCancel={close}
          onConfirm={() => {
            setSheet(null);
            void askV2Api.deleteThread(threadId).then((outcome) => {
              /* the path is read at the moment of deleting, not subscribed to (no router hook here) */
              if (outcome.ok) nav?.clearAndGo(cleanAskDestination(window.location.pathname));
              else toast?.({ text: fs3.deleteConversationFailed });
            });
          }}
        />
      )}
    </>
  );
}
