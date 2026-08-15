'use client';

import { useEffect, useRef, useState } from 'react';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { CARD_INTERACTION_CLASSES } from '@/components/home/interactionStyles';

interface GlobalDevelopmentsProps {
  lead: NewsArticle | null;
  secondary: NewsArticle[];
  dataMode: NewsDataMode | null;
  language?: LanguageCode;
}

const SECONDARY_COUNT = 5;
const AUTO_ADVANCE_INTERVAL_MS = 6000;

/**
 * M60 Phase 2 — CTO-approved recomposition into a controlled
 * horizontal carousel matching the "Trending Around the World"
 * reference: show a readable set of cards -> pause -> advance
 * approximately one card -> pause -> repeat, rather than the prior
 * "one large lead card + vertical list" layout OR perpetual
 * pixel-by-pixel scrolling (both explicitly rejected).
 *
 * Data: still exactly `lead` + `secondary` (Phase B's
 * featured/inFocus allocation, untouched) — `[lead, ...secondary]`
 * is simply rendered as a single uniform sequence of up to 6 cards
 * instead of one large card plus a separate list. No new fetch, no
 * hardcoded reference-image stories — every card is real
 * getHomeFeed() data, per the explicit Real Data Rule.
 *
 * This file is now a client component (the auto-advance timer and
 * manual controls both need it), but stays a single focused
 * component — matching this codebase's own precedent
 * (IntelligenceEngineInteractive) of keeping a client boundary
 * narrowly scoped to the interactive surface rather than converting
 * the whole page tree, since GlobalDevelopments was already this
 * page's own independent section (page.tsx itself remains an async
 * Server Component; only this section became client).
 *
 * Native CSS scroll-snap on a horizontal overflow-x-auto track
 * provides touch swipe for free (no custom touch-event handlers
 * needed) while the auto-advance/manual-control logic scrolls the
 * same track programmatically via scrollTo — both paths move the
 * same underlying DOM state, so they never fight each other.
 */
export function GlobalDevelopments({
  lead,
  secondary,
  dataMode,
  language = 'en',
}: GlobalDevelopmentsProps): JSX.Element {
  const t = getDictionary(language).globalDevelopments;
  const items = lead ? [lead, ...secondary].slice(0, SECONDARY_COUNT + 1) : [];

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  function scrollByOneCard(direction: 1 | -1): void {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>('[data-carousel-card]');
    const step = firstCard ? firstCard.offsetWidth + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: 'smooth' });
  }

  // Reduced-motion users receive NO automatic movement at all — this
  // effect never even registers a timer in that case, rather than
  // registering one and skipping its tick.
  useEffect(() => {
    if (prefersReducedMotion || items.length <= 1 || isPaused) return;

    const intervalId = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scrollByOneCard(1);
      }
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, isPaused, items.length]);

  function renderCard(item: NewsArticle, isLead: boolean) {
    return (
      <a
        key={item.id}
        data-carousel-card
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t.readFullStoryPrefix} ${item.title}`}
        className={`group flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-cyan-500/15 bg-surface sm:w-[300px] ${CARD_INTERACTION_CLASSES}`}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border">
          <SafeImage
            src={item.imageUrl || '/images/article-placeholder.jpg'}
            alt={item.title}
            fill
            priority={isLead}
            sizes="300px"
            className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
          />
          <span className="absolute left-3 top-3 rounded-full border border-cyan-500/30 bg-void/80 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-cyan-300 backdrop-blur-sm">
            {item.category}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="mb-1.5 line-clamp-2 text-balance font-display text-sm font-medium leading-snug text-ink-primary transition-colors group-hover:text-cyan-300">
            {item.title}
          </h3>
          <div className="mt-auto flex items-center gap-1.5 font-mono text-[11px] text-ink-tertiary">
            <span>{formatRelativeTime(item.publishedAt, language)}</span>
            {item.sourcesCount > 1 && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{pluralWithForms(item.sourcesCount, language, t.sourceForms)}</span>
              </>
            )}
          </div>
        </div>
      </a>
    );
  }

  return (
    <section className="border-b border-border bg-void" aria-labelledby="global-developments-heading">
      <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">{t.eyebrow}</span>
            <h2
              id="global-developments-heading"
              className="mt-1 font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
            >
              {t.headline}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {dataMode && <DataModeLabel dataMode={dataMode} language={language} />}
            {items.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t.previousLabel}
                  onClick={() => scrollByOneCard(-1)}
                  className="rounded-full border border-cyan-500/25 p-1.5 text-ink-secondary transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
                >
                  <span aria-hidden="true">&larr;</span>
                </button>
                <button
                  type="button"
                  aria-label={t.nextLabel}
                  onClick={() => scrollByOneCard(1)}
                  className="rounded-full border border-cyan-500/25 p-1.5 text-ink-secondary transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
                >
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {!lead ? (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-void/60 px-4 py-2.5 backdrop-blur-sm">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-amber-400">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {t.unavailableLabel}
              </span>
              <p className="mt-1 text-xs text-ink-secondary">{t.unavailable}</p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {[
                { label: t.statusFeedUnavailable, ok: false },
                { label: t.statusCountryAvailable, ok: true },
                { label: t.statusSearchAvailable, ok: true },
                { label: t.statusMapAvailable, ok: true },
                { label: t.statusWaitingProvider, ok: false },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="flex w-[160px] shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-surface p-3"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${tile.ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  />
                  <p className="font-mono text-[10px] uppercase leading-snug tracking-wide text-ink-tertiary">
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            ref={trackRef}
            role="region"
            aria-label={t.headline}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            onPointerDown={() => setIsPaused(true)}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, index) => renderCard(item, index === 0))}
          </div>
        )}
      </div>
    </section>
  );
}
