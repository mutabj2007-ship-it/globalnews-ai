'use client';

import { useEffect, useRef } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import type { SourceSupportEntry } from './analysisDimensions';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { dimensionLabel } from './AnalysisIndex';

/**
 * H2C — E-22 sources drawer / bottom sheet.
 *
 * The provenance end of the chain. Every claim card's citation pill
 * lands here, at the source it actually cites, so a reader can always
 * get from a sentence to the article it came from without leaving the
 * workspace.
 *
 * THE SUPPORTS LINE IS AN INVERTED CITATION MAP, NOT AN OPINION.
 * It is computed by the H2A adapter from the same articleId-keyed
 * citation data the pills use. A source cited by nothing says NOT CITED
 * IN THIS ANALYSIS — which is a real and useful fact about the
 * retrieved pool, and far better than implying every retrieved article
 * informed the answer. 08 row 32 forbids inventing a supports
 * relationship the citation data does not contain, and this component
 * has no path that could.
 *
 * EVERY FIELD IS AN EXISTING RECORD FIELD. Title, outlet, age, category
 * and URL come from the source or article record. When a record has no
 * image the slot renders a labelled placeholder rather than a stock
 * picture, because a decorative stand-in beside a real news source is a
 * small lie about provenance.
 *
 * FOCUS AND ESCAPE. The dialog takes focus on open, restores it to the
 * trigger on close, and closes on Escape — E-22 keyboard contract.
 * Nothing here uses scrollIntoView (10 §3).
 */

export const SOURCES_DRAWER_ID = 'gn-analysis-sources-drawer';

export interface SourcesDrawerProps {
  open: boolean;
  entries: readonly SourceSupportEntry[];
  /** Article the drawer was opened at, when a citation pill opened it. */
  focusArticleId: string | null;
  onClose: () => void;
  language?: LanguageCode;
}

export function SourcesDrawer({
  open,
  entries,
  focusArticleId,
  onClose,
  language = 'en',
}: SourcesDrawerProps): JSX.Element | null {
  const dict = getDictionary(language).analysisWorkspace;
  const t = dict.sources;
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/*
        Scrim. Clicking it closes, but it is aria-hidden — the dialog
        below is the accessible surface and a second focusable overlay
        would only add a keyboard trap.
      */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-gn-scrim backdrop-blur-[3px]"
      />

      <div
        id={SOURCES_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label={t.drawerLabel}
        className="relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l border-gn-line-strong bg-gn-drawer px-5 pb-10 pt-[22px] md:w-[92vw] md:px-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-gn-mono text-gn-hud-entry uppercase text-gn-ink-strong outline-none"
          >
            {t.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-gn-mono text-gn-hud-toggle uppercase text-gn-ink-toggle transition-colors duration-[120ms] hover:text-gn-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
          >
            {t.close}
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="mt-[18px] font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">
            {t.empty}
          </p>
        ) : (
          <ul className="mt-[18px] flex list-none flex-col gap-[10px] p-0">
            {entries.map((entry) => {
              const article = entry.article;
              const title = entry.source?.title ?? article.title;
              const outlet = entry.source?.publisher ?? article.sourceName;
              const publishedAt = entry.source?.publishedAt ?? article.publishedAt;
              const highlighted = focusArticleId === entry.articleId;

              return (
                <li key={entry.articleId}>
                  <article
                    className={`flex gap-[14px] rounded-gn-card border bg-gn-panel p-[14px] ${
                      highlighted
                        ? 'border-gn-line-pill-hover bg-white/[.03]'
                        : 'border-gn-line-card'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-gn-line-inert font-gn-mono text-gn-hud-disc text-gn-ink-disc"
                    >
                      {entry.citationNumber ?? '·'}
                    </span>

                    <div className="min-w-0 flex-1">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-gn-display text-gn-card-title text-gn-ink-card underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                      >
                        {title}
                        <span className="sr-only">
                          {' — '}
                          {outlet}, {t.opensInNewTab}
                        </span>
                      </a>

                      <p className="mt-[6px] font-gn-mono text-gn-hud-outlet text-gn-ink-meta">
                        {outlet}
                        {publishedAt !== undefined &&
                          publishedAt !== '' &&
                          ` · ${formatRelativeTime(publishedAt, language)}`}
                        {article.category !== undefined && ` · ${article.category}`}
                      </p>

                      {/*
                        The inverted citation map, verbatim from the H2A
                        adapter. Never widened, never guessed.
                      */}
                      <p
                        className={`mt-2 font-gn-mono text-gn-hud-supports uppercase ${
                          entry.supportState === 'cited'
                            ? 'text-gn-verified-soft'
                            : 'text-gn-hud-faint'
                        }`}
                      >
                        {entry.supportState === 'cited'
                          ? `${t.supportsPrefix} ${Array.from(
                              new Set(
                                entry.supports.map((origin) =>
                                  dimensionLabel(origin.dimension, dict.dimensions),
                                ),
                              ),
                            ).join(' · ')}`
                          : t.notCited}
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
