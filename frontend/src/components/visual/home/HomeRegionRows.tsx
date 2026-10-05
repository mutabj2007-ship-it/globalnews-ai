'use client';

import { useRef, type JSX } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HomeRegionRow, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { fill } from '@/components/home/reva/homeRevaModel';
import { HomeStoryCardView } from './HomeStoryCardView';
import { regionLabel, storiesHref } from './homeStoryView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE-FIRST HOME CORRECTION R1 · §6 — THREE REGION ROWS (East Africa · European Union · Middle East)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Order is fixed by the server contract (HOME_REGION_ORDER). Each row is a LOCAL horizontal list
 * with scroll-snap — never page overflow — using the accepted legacy slide geometry
 * (HomeR1Stories: 84% phone so the next card visibly peeks · 50% · 33.3% · 25%, gap 12 px),
 * left-aligned on the common content grid. Explicit Previous / Next buttons (44 px) are the
 * non-swipe affordance; nothing auto-moves. "See all" opens the region list in story search.
 *
 * Honest states: the 72-hour count is stated; a row with no recent report says so and shows dated
 * earlier reporting; an empty row is a coverage gap; a failed read is UNAVAILABLE. A row is never
 * back-filled from another region or a global feed.
 */
export function HomeRegionRows({
  rows,
  language,
  discussionRead,
}: {
  readonly rows: readonly HomeRegionRow[];
  readonly language: LanguageCode;
  readonly discussionRead: boolean;
}): JSX.Element {
  const t = getDictionary(language).visual.home;
  return (
    <section aria-labelledby="home-regions-title" data-home-regions="" className="flex flex-col gap-7">
      <h2 id="home-regions-title" className="sr-only">
        {t.regionsHeading}
      </h2>
      {rows.map((row) => (
        <RegionRow key={row.id} row={row} language={language} discussionRead={discussionRead} />
      ))}
    </section>
  );
}

function RegionRow({ row, language, discussionRead }: { readonly row: HomeRegionRow; readonly language: LanguageCode; readonly discussionRead: boolean }): JSX.Element {
  const t = getDictionary(language).visual.home;
  const listRef = useRef<HTMLUListElement | null>(null);
  const name = regionLabel(row.id, t);
  const headingId = `home-row-${row.id.replace(/[^a-z]/g, '-')}`;
  const step = (dir: 1 | -1): void => {
    const el = listRef.current;
    if (el === null) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * Math.max(el.clientWidth * 0.85, 240), behavior: 'smooth' });
  };
  const status =
    row.state === 'UNAVAILABLE'
      ? t.rowUnavailable
      : row.state === 'EMPTY'
        ? t.rowEmpty
        : row.counts.recent === 0
          ? t.rowNoneRecent
          : fill(t.rowRecent, { count: row.counts.recent }) + (row.state === 'SPARSE' ? ` · ${t.rowSparse}` : '');

  return (
    <section aria-labelledby={headingId} data-home-region={row.id} data-row-state={row.state} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 id={headingId} className="font-display text-[1.25rem] font-bold leading-tight text-[var(--gt-ink)]">
            {name}
          </h3>
          <p data-home-row-status="" role="status" className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--gt-ink2)]">
            {status}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {row.stories.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t.rowPrev}
                aria-controls={`${headingId}-list`}
                onClick={() => step(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gt-line)] bg-[var(--gt-card)] text-[var(--gt-ink)] hover:border-[var(--gt-act)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" />
              </button>
              <button
                type="button"
                aria-label={t.rowNext}
                aria-controls={`${headingId}-list`}
                data-home-row-next=""
                onClick={() => step(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gt-line)] bg-[var(--gt-card)] text-[var(--gt-ink)] hover:border-[var(--gt-act)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" />
              </button>
            </>
          )}
          {row.state !== 'UNAVAILABLE' && (
            <a
              href={storiesHref({ region: row.id })}
              aria-label={fill(t.rowSeeAria, { region: name })}
              data-home-row-see-all=""
              className="inline-flex min-h-[44px] items-center rounded-[0.5rem] px-3 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
            >
              {t.rowSee}
            </a>
          )}
        </div>
      </div>
      <details className="text-[0.75rem] leading-snug text-[var(--gt-ink2)]">
        <summary className="inline-flex min-h-[32px] cursor-pointer items-center font-semibold text-[var(--gt-ink2)]">{t.rowAbout}</summary>
        <p className="mt-1 max-w-[52rem]">{row.disclosure}</p>
      </details>
      {row.stories.length > 0 && (
        <ul
          ref={listRef}
          id={`${headingId}-list`}
          aria-labelledby={headingId}
          data-home-row-list=""
          className="relative -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:thin]"
        >
          {row.stories.map((card) => (
            <li
              key={card.articleRef}
              className="flex min-w-0 shrink-0 basis-[84%] snap-start min-[600px]:basis-[calc(50%-6px)] min-[900px]:basis-[calc(33.333%-8px)] min-[1200px]:basis-[calc(25%-9px)]"
            >
              <HomeStoryCardView card={card} language={language} discussionRead={discussionRead} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
