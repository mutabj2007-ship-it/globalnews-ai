'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { safeExternalHref, type AnalysisSourceRef, type DisplayLocale } from '@globalnews-ai/shared';
import { isolatedAuto, isolatedLtr } from '@/lib/ask/askDirection';
import { sourceDateLabel } from '@/components/ask/AskCompactResult';
import { askDictionary } from '@/lib/ask/shell/askDictionary';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK READING EXPERIENCE R1 — SOURCES AS A PANEL (DESKTOP) OR A SHEET (PHONE / TABLET / DOCK)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * H-FREEZE §12 / CAPABILITY-MATRIX §B. One list, two presentations, no new data:
 *
 *   - the list is `analysis.sources` of the ONE answer whose control was used, in its own order,
 *     so item n is exactly the source an inline `[n]` carries (identity is the backend article
 *     id; the number is an answer-local label derived from the same payload). Nothing is
 *     re-ranked, counted or invented, and "cited" vs "also consulted" is not guessed (D2);
 *   - desktop: the existing NON-MODAL Sources column is the panel — a citation scrolls the
 *     column to its item and focuses it; the reading column does not move;
 *   - otherwise: an accessible sheet (`role="dialog"`, `aria-modal`), focus kept inside while it
 *     is open, Esc / Close / backdrop close it, focus returns to the control that opened it with
 *     `preventScroll`, and the conversation's scroll position is never touched — there is no
 *     body scroll lock that could reset it.
 *
 * Opening Sources is a display action: zero network, zero AI (STATE-MATRIX §5).
 */
export interface AskSourcesOpenRequest {
  readonly sources: readonly AnalysisSourceRef[];
  /** 1-based answer-local number to bring into view, if a citation was used. */
  readonly at?: number;
  readonly opener: HTMLElement | null;
}

type OpenSources = (request: AskSourcesOpenRequest) => void;

const SourcesPanelContext = createContext<OpenSources | null>(null);

/** Null outside a provider: callers then keep their plain behaviour (a citation is a link). */
export function useAskSourcesPanel(): OpenSources | null {
  return useContext(SourcesPanelContext);
}

/** The one rendering of a source list, shared by the desktop column and the sheet. */
export function AskSourcesList({
  sources,
  locale,
  highlight,
}: {
  readonly sources: readonly AnalysisSourceRef[];
  readonly locale: DisplayLocale;
  readonly highlight?: number;
}): JSX.Element {
  /*
    EAST AFRICA E7 — a source's date says what it IS, through the one existing contract
    (sourceDateLabel): publisher → "Published", observed → "First seen by GlobalNewsAI",
    unknown basis → "Report date". No new date provenance. The reader's locale governs the
    strings and the formatting; the language argument is only the contract's fallback when no
    locale is given, and a locale is always given here.
  */
  const dateStrings = askDictionary(locale).askAi;
  return (
    <ol className="flex flex-col">
      {sources.map((source, index) => (
        <li
          key={source.articleId}
          data-ask="source"
          data-source-number={index + 1}
          data-ask-source-highlight={highlight === index + 1 ? 'true' : undefined}
          className="flex scroll-mt-4 gap-2.5 border-t border-[var(--ask-read-line-soft,#0a2744)] py-2.5 data-[ask-source-highlight=true]:bg-[var(--ask-read-sunk,#06223d)]"
        >
          {/* R4 · the citation number is a left-to-right token whatever the thread's
              direction, and it is bracketed by borders rather than by characters — so it
              is pinned LTR and isolated rather than left to the paragraph. */}
          <span
            className="flex h-[22px] min-w-[28px] shrink-0 items-center justify-center rounded-[5px] border border-[var(--ask-read-line,#2b4a6b)] px-[5px] text-[0.75rem] font-bold tabular-nums text-[var(--ask-read-ink,#d5e4f2)]"
            {...isolatedLtr()}
          >
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* R4 · a publisher's headline is prose of unknown direction. Isolated in the
                inherited direction so its own punctuation stays with it. */}
            <a
              href={safeExternalHref(source.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.875rem] font-semibold leading-[1.3] text-[var(--ask-read-ink,#e6eef6)] underline decoration-transparent underline-offset-4 hover:decoration-[var(--ask-read-control-line,#5abff5)]"
              {...isolatedAuto()}
            >
              {source.title}
            </a>
            {/* R4 · publisher name and a UTC stamp: one run, isolated, so the stamp's
                Latin "UTC" cannot reorder against an Arabic publisher. */}
            <span
              className="text-[0.75rem] leading-[1.3] text-[var(--ask-read-ink3,#8299b4)]"
              {...isolatedAuto()}
            >
              {[source.publisher, sourceDateLabel(source.publishedAt, source.publishedAtBasis, 'en', dateStrings, locale)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

function AskSourcesSheet({
  request,
  locale,
  onClose,
}: {
  readonly request: AskSourcesOpenRequest;
  readonly locale: DisplayLocale;
  readonly onClose: () => void;
}): JSX.Element {
  const s = askShellStrings(locale).askR2Strings;
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const root = dialog.current;
    if (root === null) return;
    const target =
      request.at === undefined
        ? null
        : root.querySelector<HTMLElement>(`[data-source-number="${request.at}"]`);
    target?.scrollIntoView?.({ block: 'nearest' });
    (target?.querySelector<HTMLElement>('a[href]') ?? root.querySelector<HTMLElement>('[data-ask="sources-close"]'))?.focus({
      preventScroll: true,
    });
  }, [request]);

  return (
    <div data-ask="sources-sheet-layer" className="fixed inset-0 z-[70] flex items-end justify-center">
      <div
        aria-hidden="true"
        data-ask="sources-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(1,10,25,0.55)]"
      />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ask="sources-sheet"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== 'Tab' || dialog.current === null) return;
          const items = focusable(dialog.current);
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        className="relative flex max-h-[82dvh] w-full max-w-[40rem] flex-col rounded-t-[16px] border border-[var(--ask-read-line,#1d4a73)] bg-[var(--ask-read-answer-bg,#03152a)] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[var(--ask-read-ink,#e6eef6)] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ask-read-line-soft,#0e2d4d)] px-4 py-2">
          <h2 id={titleId} className="text-[1rem] font-semibold">
            {s.sources}{' '}
            <span className="text-[0.875rem] font-normal text-[var(--ask-read-ink3,#8299b4)]">
              {s.sourcesLabel(request.sources.length)}
            </span>
          </h2>
          <button
            type="button"
            data-ask="sources-close"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] px-2 text-[0.875rem] font-semibold text-[var(--ask-read-control-ink,#cfe2f2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ask-read-control-ink,#5abff5)]"
          >
            {s.close}
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4">
          <AskSourcesList sources={request.sources} locale={locale} highlight={request.at} />
        </div>
      </div>
    </div>
  );
}

export function AskSourcesPanelProvider({
  locale,
  columnSources,
  children,
}: {
  readonly locale: DisplayLocale;
  /**
   * The sources the desktop column currently lists (the latest answer's), or null when the
   * surface has no column. A request for exactly these is served by the column when it is shown.
   */
  readonly columnSources?: readonly AnalysisSourceRef[] | null;
  readonly children: ReactNode;
}): JSX.Element {
  const [request, setRequest] = useState<AskSourcesOpenRequest | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback<OpenSources>(
    (next) => {
      if (columnSources != null && next.sources === columnSources) {
        const column = document.querySelector<HTMLElement>('[data-ask="sources-column"]');
        /* `offsetParent` is null while the column is display:none (below its breakpoint). */
        if (column !== null && column.offsetParent !== null) {
          const item =
            next.at === undefined
              ? null
              : column.querySelector<HTMLElement>(`[data-source-number="${next.at}"]`);
          column
            .querySelectorAll('[data-ask-source-highlight]')
            .forEach((el) => el.removeAttribute('data-ask-source-highlight'));
          item?.setAttribute('data-ask-source-highlight', 'true');
          item?.scrollIntoView?.({ block: 'nearest' });
          (item?.querySelector<HTMLElement>('a[href]') ?? column).focus({ preventScroll: true });
          return;
        }
      }
      opener.current = next.opener;
      setRequest(next);
    },
    [columnSources],
  );

  const close = useCallback(() => {
    setRequest(null);
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }, []);

  const value = useMemo(() => open, [open]);
  return (
    <SourcesPanelContext.Provider value={value}>
      {children}
      {request !== null && <AskSourcesSheet request={request} locale={locale} onClose={close} />}
    </SourcesPanelContext.Provider>
  );
}
