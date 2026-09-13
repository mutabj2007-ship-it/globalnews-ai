import type { LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { formatUtcClock } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { LatestNowPreviousButton, LatestNowNextButton } from '@/components/home/LatestNowScrollControls';
import { LatestNowTicker } from '@/components/home/LatestNowTicker';
import { CARD_INTERACTION_CLASSES } from '@/components/home/interactionStyles';

interface LatestNowRailProps {
  /** The full chronological feed (Phase B's `latestUpdates`) — this component derives its own compact slice from it, rather than HomeFeed exposing a separate stored field. */
  updates: NewsArticle[];
  language?: LanguageCode;
}

const RAIL_COUNT = 6;
const SCROLL_REGION_ID = 'latest-now-scroll-region';

/**
 * Milestone #51 (browser-acceptance UX polish) — control placement
 * redesign: the previous/next buttons no longer sit in a detached
 * header row above the cards (which read as a small unrelated
 * toolbar). They're now passed into LatestNowTicker as
 * previousButton/nextButton, which positions them as an absolute
 * overlay directly on the rail — left/right edges, vertically
 * centered against the cards, layered above the two-sided edge fade.
 * The heading row above now contains ONLY the section label.
 *
 * Visual flow: gap tightened (gap-3 → gap-2.5, matched in
 * LatestNowTicker), and each card's metadata row uses a quieter,
 * single muted tone (ink-tertiary) rather than the brighter
 * signal-bright previously used for the category — the headline is
 * now unambiguously the most visually dominant element in the card,
 * with metadata clearly secondary, reinforcing "read more like a live
 * news stream" rather than six equally-loud boxes.
 *
 * RECENCY, not popularity: this rail is a slice of the same
 * chronologically-sorted `latestUpdates` Latest Updates itself uses,
 * never a ranking, click count, or "trending" signal. Deliberately no
 * images (kept light for a compact rail) and no per-card data-mode
 * badge (that's NewsroomSection's job, once).
 *
 * Server Component: every card renders server-side, passed as
 * `children` into LatestNowTicker (a client component) — the smallest
 * possible client boundary for the auto-scroll behavior. The two
 * overlay buttons (LatestNowPreviousButton/LatestNowNextButton) are
 * the other, pre-existing tiny client boundary, now rendered as
 * ticker props rather than a separate toolbar component.
 *
 * Undersupply handling: 0 articles → renders nothing (no empty
 * heading). 1+ articles → renders cleanly; overlay buttons only
 * appear when there's genuinely more than fits (handled inside each
 * button component via a count prop, not a media query guess).
 */
export function LatestNowRail({ updates, language = 'en' }: LatestNowRailProps): JSX.Element | null {
  const t = getDictionary(language).latestNowRail;
  const items = updates.slice(0, RAIL_COUNT);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-border bg-void" aria-labelledby="latest-now-heading">
      <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
        <span
          id="latest-now-heading"
          className="mb-2.5 block font-mono text-xs uppercase tracking-widest text-cyan-400"
        >
          {t.label}
        </span>

        <LatestNowTicker
          regionId={SCROLL_REGION_ID}
          regionLabel={t.regionLabel}
          previousButton={
            <LatestNowPreviousButton regionId={SCROLL_REGION_ID} itemCount={items.length} previousLabel={t.previousLabel} />
          }
          nextButton={<LatestNowNextButton regionId={SCROLL_REGION_ID} itemCount={items.length} nextLabel={t.nextLabel} />}
        >
          {items.map((item) => (
            <li key={item.id} className="w-[180px] shrink-0 snap-start">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t.readFullStoryPrefix} ${item.title}`}
                className={`flex h-full flex-col gap-1.5 rounded-xl border border-cyan-500/15 bg-surface p-3 ${CARD_INTERACTION_CLASSES}`}
              >
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
                  <span>{formatUtcClock(item.publishedAt)}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{item.category}</span>
                </div>
                <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-primary">{item.title}</p>
                <span className="mt-auto truncate font-mono text-[10px] text-ink-tertiary">{item.sourceName}</span>
              </a>
            </li>
          ))}
        </LatestNowTicker>
      </div>
    </section>
  );
}
