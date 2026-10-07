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
import styles from './askDashboard.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK DESIGN COMPLETENESS R1 — SOURCES: A SIDE PANEL (≥1024) OR A SHEET (BELOW, AND THE DOCK)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Design C1 / C6 / F3 and RECONCILIATION_GUIDE §8. One list, two presentations, no new data:
 *
 *   - the list is `analysis.sources` of the ONE answer whose control was used, in its own order,
 *     so item n is exactly the source an inline citation n carries (identity is the backend
 *     article id; the number is an answer-local label derived from the same payload). Nothing is
 *     re-ranked, counted or invented;
 *   - ≥1024: a 380 px NON-MODAL side panel beside the reading column — the answer stays readable
 *     and scrollable, focus moves to the item asked for and returns to the opener on Close;
 *   - below 1024 and in the dock: an accessible sheet (`role="dialog"`, `aria-modal`), ~82 %
 *     high, focus kept inside while open, Esc / Close / scrim close it, focus returns to the
 *     opener with `preventScroll`, and the reading position is never touched — no body scroll
 *     lock that could reset it.
 *
 * Each item: number, title (wraps), publisher · date — "Date not provided" when the record has
 * none, never a guessed date — and "Open original ↗" (new tab, `safeExternalHref` the only href
 * source). "About this answer" (collapsed) holds the method/status lines the answer turn hands
 * over. CAPABILITY-BLOCKED: "Cited in this answer" vs "Also consulted" — the backend does not
 * distinguish cited from consulted articles (Design D2), so ONE list is shown and nothing is
 * guessed. Opening Sources is a display action: zero network, zero AI.
 */
export interface AskSourcesOpenRequest {
  readonly sources: readonly AnalysisSourceRef[];
  /** 1-based answer-local number to bring into view, if a citation was used. */
  readonly at?: number;
  readonly opener: HTMLElement | null;
  /** The limited-reporting note, repeated at the top (Design C6) — only where the answer has one. */
  readonly note?: string | null;
  /** "About this answer": the answer's own status lines, verbatim. */
  readonly about?: readonly string[];
}

type OpenSources = (request: AskSourcesOpenRequest) => void;

const SourcesPanelContext = createContext<OpenSources | null>(null);

/** Null outside a provider: callers then keep their plain behaviour (a citation is a link). */
export function useAskSourcesPanel(): OpenSources | null {
  return useContext(SourcesPanelContext);
}

/** The desktop side-panel breakpoint (the frame's persistent-column layout). */
export const ASK_SIDE_PANEL_QUERY =
  '(min-width: 1024px) and (orientation: landscape), (min-width: 1101px)';

/** The one rendering of a source list. */
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
    unknown basis → "Report date". No new date provenance. No date at all → the Design's
    "Date not provided", never a guessed date.
  */
  const dateStrings = askDictionary(locale).askAi;
  const r = askShellStrings(locale).askR2Strings.read;
  return (
    <ol className="flex flex-col">
      {sources.map((source, index) => {
        const href = safeExternalHref(source.url);
        // prettier-ignore
        const date = sourceDateLabel(source.publishedAt, source.publishedAtBasis, 'en', dateStrings, locale);
        return (
          <li
            key={source.articleId}
            data-ask="source"
            data-source-number={index + 1}
            data-ask-source-highlight={highlight === index + 1 ? 'true' : undefined}
            className="flex scroll-mt-4 gap-3 py-3.5"
          >
            {/* R4 · the citation number is a left-to-right token whatever the thread's
                direction — pinned LTR and isolated rather than left to the paragraph. */}
            <span
              className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--ad-accent-soft,#16223f)] px-[6px] text-[0.8125rem] font-semibold tabular-nums text-[var(--ad-accent-soft-ink,#a8c5ff)]"
              {...isolatedLtr()}
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {/* R4 · a publisher's headline is prose of unknown direction: isolated. */}
              <p
                data-ask="source-title"
                className="text-[0.9375rem] font-semibold leading-[1.35] text-[var(--ad-ink,#edeff5)]"
                {...isolatedAuto()}
              >
                {source.title}
              </p>
              <span
                className="text-[0.8125rem] leading-[1.4] text-[var(--ad-ink-3,#7d89a1)]"
                {...isolatedAuto()}
              >
                {[source.publisher, date ?? r.dateNotProvided].filter(Boolean).join(' · ')}
              </span>
              {href !== undefined && (
                <a
                  data-ask="source-open"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-[32px] w-fit items-center gap-1 text-[0.875rem] font-medium text-[var(--ad-accent-text,#6c93ff)] underline underline-offset-2"
                >
                  {r.openOriginal}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

function SourcesBody({
  request,
  locale,
}: {
  readonly request: AskSourcesOpenRequest;
  readonly locale: DisplayLocale;
}): JSX.Element {
  const r = askShellStrings(locale).askR2Strings.read;
  return (
    <>
      {request.note != null && request.note !== '' && (
        <p data-ask="sources-note" className={styles.sheetNote}>
          {request.note}
        </p>
      )}
      <AskSourcesList sources={request.sources} locale={locale} highlight={request.at} />
      {request.about !== undefined && request.about.length > 0 && (
        <details data-ask="about-answer" className={styles.about}>
          <summary>{r.aboutAnswer}</summary>
          <div>
            {request.about.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function AskSourcesSurface({
  request,
  locale,
  panel,
  onClose,
}: {
  readonly request: AskSourcesOpenRequest;
  readonly locale: DisplayLocale;
  /** true: the ≥1024 non-modal side panel; false: the modal sheet. */
  readonly panel: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const s = askShellStrings(locale).askR2Strings;
  const box = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const root = box.current;
    if (root === null) return;
    const target =
      request.at === undefined
        ? null
        : root.querySelector<HTMLElement>(`[data-source-number="${request.at}"]`);
    target?.scrollIntoView?.({ block: 'nearest' });
    (
      target?.querySelector<HTMLElement>('a[href]') ??
      root.querySelector<HTMLElement>('[data-ask="sources-close"]')
    )?.focus({ preventScroll: true });
  }, [request]);

  const head = (
    <div className={styles.sheetHead}>
      <div className="min-w-0">
        <h2 id={titleId}>{s.sources}</h2>
        <p>{s.read.sourcesCited(request.sources.length)}</p>
      </div>
      <button type="button" data-ask="sources-close" onClick={onClose} className={styles.sheetClose}>
        {s.close}
      </button>
    </div>
  );

  if (panel) {
    return (
      /* Non-modal: a labelled complementary region; Esc still closes it from inside. */
      <aside
        ref={box}
        data-ask="sources-panel"
        aria-labelledby={titleId}
        className={styles.sidePanel}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        {head}
        <div className={styles.sheetBody}>
          <SourcesBody request={request} locale={locale} />
        </div>
      </aside>
    );
  }

  return (
    <div data-ask="sources-sheet-layer" className={styles.sheetLayer}>
      <div
        aria-hidden="true"
        data-ask="sources-backdrop"
        onClick={onClose}
        className={styles.sheetScrim}
      />
      <div
        ref={box as React.RefObject<HTMLDivElement>}
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
          if (event.key !== 'Tab' || box.current === null) return;
          const items = focusable(box.current);
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
        className={styles.sheet}
      >
        {head}
        <div className={styles.sheetBody}>
          <SourcesBody request={request} locale={locale} />
        </div>
      </div>
    </div>
  );
}

export function AskSourcesPanelProvider({
  locale,
  presentation = 'auto',
  children,
}: {
  readonly locale: DisplayLocale;
  /**
   * `auto` — the side panel at the frame's ≥1024 layout, the sheet below it. `sheet` — always
   * the sheet (the dock is always the phone layout, Design §2).
   */
  readonly presentation?: 'auto' | 'sheet';
  readonly children: ReactNode;
}): JSX.Element {
  const [request, setRequest] = useState<AskSourcesOpenRequest | null>(null);
  const [panel, setPanel] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback<OpenSources>(
    (next) => {
      opener.current = next.opener;
      setPanel(
        presentation === 'auto' &&
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia(ASK_SIDE_PANEL_QUERY).matches,
      );
      setRequest(next);
    },
    [presentation],
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
      {request !== null && (
        <AskSourcesSurface request={request} locale={locale} panel={panel} onClose={close} />
      )}
    </SourcesPanelContext.Provider>
  );
}
