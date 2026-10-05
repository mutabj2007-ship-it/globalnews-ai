'use client';

import type { JSX } from 'react';
import { BookOpenText, ExternalLink, MessagesSquare, Search } from 'lucide-react';
import { safeExternalHref, type HomeEditorialResponse, type HomeStoryCard, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { StoryVisual } from '@/components/home/StoryVisual';
import { useStageB } from '@/lib/stories/stageBStore';
import { openVisualBrief } from '@/lib/visual/visualBriefStore';
import { fill } from '@/components/home/reva/homeRevaModel';
import { VisualHeroMap } from '../VisualHeroMap';
import { absoluteDate, briefStoryOfCard, domainLabel, freshnessLabel, isAttention, otherReportsLabel } from './homeStoryView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE-FIRST HOME CORRECTION R1 · §3, §7, §8 — THE HERO
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   SEARCH STORIES        the large input — a plain GET form to /stories (persisted story search).
 *                         It never runs Ask, AI or a provider; Back restores the query by URL.
 *   YOUR WORLD IN 60 S    the personal major story (saved follows/interests first; otherwise a
 *                         stable high-impact default), what changed, why it is here, publisher and
 *                         date, Read brief / Discuss / Read Original, then two further developments.
 *   LEGACY WORLD MAP      the real GlobalNewsAI WorldMap beside it (≥ 848 px hero width); on a phone
 *                         it follows the story at its compact height (min(180 px, 42svh)), so the
 *                         first screen is the story, not the map. Lazy-loaded, zero provider reads.
 */
export function HomeHeroSection({
  editorial,
  language,
  discussionRead,
}: {
  readonly editorial: HomeEditorialResponse | null;
  readonly language: LanguageCode;
  readonly discussionRead: boolean;
}): JSX.Element {
  const t = getDictionary(language).visual.home;
  const hero = editorial?.hero ?? null;

  return (
    <section
      aria-labelledby="home-w60-title"
      data-home-hero=""
      className="rounded-[1rem] bg-[var(--gt-navy)] bg-[linear-gradient(160deg,var(--gt-navy)_0%,var(--gt-hdr)_100%)] p-3 text-white [container-type:inline-size] min-[600px]:p-5 min-[1024px]:p-6"
    >
      <form action="/stories" method="get" role="search" aria-label={t.searchLabel} data-home-story-search="" className="flex flex-col gap-1.5">
        <label htmlFor="home-story-search" className="text-[0.8125rem] font-semibold text-[var(--gt-hdrInk)]">
          {t.searchLabel}
        </label>
        <div className="flex min-h-[3.25rem] items-center gap-2 rounded-[0.625rem] bg-[var(--gt-card)] ps-3 pe-[5px] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] focus-within:ring-2 focus-within:ring-[var(--gt-amber)]">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--gt-ink3)]" />
          <input
            id="home-story-search"
            name="q"
            type="search"
            dir="auto"
            autoComplete="off"
            enterKeyHint="search"
            minLength={2}
            maxLength={120}
            required
            placeholder={t.searchPlaceholder}
            aria-describedby="home-story-search-note"
            className="min-w-0 flex-1 bg-transparent text-[1rem] text-[var(--gt-ink)] outline-none placeholder:text-[var(--gt-ink3)]"
          />
          <button
            type="submit"
            data-home-search-submit=""
            className="inline-flex min-h-[2.75rem] shrink-0 items-center rounded-[0.5rem] bg-[var(--gt-act)] px-4 text-[0.9375rem] font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {t.searchButton}
          </button>
        </div>
        <p id="home-story-search-note" className="text-[0.75rem] leading-snug text-[var(--gt-hdrInk)]">
          {t.searchNote}
        </p>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-4 [@container(min-width:848px)]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] [@container(min-width:848px)]:gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 id="home-w60-title" className="flex items-center gap-2 font-display text-[1.375rem] font-bold leading-tight text-white min-[600px]:text-[1.625rem]">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--gt-amber)]" />
            {t.w60Title}
          </h1>
          {hero === null ? (
            <p role="status" data-home-w60-empty="" className="rounded-[0.75rem] bg-white/[0.06] p-4 text-[0.875rem] leading-snug text-[var(--gt-hdrInk)]">
              {editorial === null || editorial.degraded ? t.w60Unavailable : t.w60Empty}
            </p>
          ) : (
            <>
              <LeadStory card={hero.story} basisLine={whyLine(hero, t)} personal={hero.basis === 'PREFERENCES'} language={language} discussionRead={discussionRead} />
              {hero.more.length > 0 && (
                <ol data-home-w60-more="" className="flex flex-col divide-y divide-white/10 rounded-[0.75rem] bg-white/[0.05]">
                  {hero.more.map((card) => (
                    <MoreRow key={card.articleRef} card={card} language={language} />
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
        <div className="min-w-0">
          <VisualHeroMap language={language} />
        </div>
      </div>
    </section>
  );
}

function whyLine(hero: NonNullable<HomeEditorialResponse['hero']>, t: ReturnType<typeof getDictionary>['visual']['home']): string {
  if (hero.basis === 'DEFAULT') return t.w60DefaultWhy;
  if (hero.matched.countries.length > 0) return fill(t.w60BecauseCountries, { countries: hero.matched.countries.map((c) => c.name).join(', ') });
  const names = hero.matched.domains.map((d) => (d === 'business' ? t.domainBusiness : t.domainConflict));
  return fill(t.w60BecauseDomains, { domains: names.join(', ') });
}

function LeadStory({
  card,
  basisLine,
  personal,
  language,
  discussionRead,
}: {
  readonly card: HomeStoryCard;
  readonly basisLine: string;
  readonly personal: boolean;
  readonly language: LanguageCode;
  readonly discussionRead: boolean;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.home;
  const ts = dict.visual.stories;
  const { counts } = useStageB();
  const count = counts[card.articleRef] ?? card.discussion?.comments;
  const story = briefStoryOfCard(card);
  const age = formatObservationalTime(card.publishedAt, card.publishedAtBasis, language);
  const dated = isAttention(card.freshness) ? age : absoluteDate(card.publishedAt, language);
  const others = otherReportsLabel(card.otherReports.count, t);
  const domain = domainLabel(card, t);

  return (
    <article aria-labelledby="home-w60-lead" data-home-w60-lead="" data-article-ref={card.articleRef} data-hero-basis={personal ? 'PREFERENCES' : 'DEFAULT'} className="overflow-hidden rounded-[0.75rem] bg-[var(--gt-card)] text-[var(--gt-ink)]">
      <div className="grid grid-cols-1 min-[520px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div aria-hidden="true" className="pointer-events-none relative select-none">
          <StoryVisual
            article={{ category: card.category as NewsArticle['category'], imageUrl: card.imageUrl ?? undefined }}
            className="aspect-[16/9] min-[520px]:h-full min-[520px]:aspect-auto min-[520px]:min-h-[170px] max-h-[200px] min-[520px]:max-h-none"
            missingLabel={dict.betaHome.imageUnavailable}
            sizes="(min-width: 848px) 300px, 100vw"
          />
          <span className={`absolute start-[10px] top-[10px] rounded-[6px] px-2 py-[3px] text-[11.5px] font-bold ${isAttention(card.freshness) ? 'bg-[var(--gt-amber)] text-[var(--gt-amberOn)]' : 'bg-[var(--gt-chrome)] text-[var(--gt-ink)]'}`}>
            {freshnessLabel(card.freshness, t)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 p-3.5">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-[var(--gt-link)]">{personal ? t.w60Personal : t.w60Default}</p>
          <h2 id="home-w60-lead" dir="auto" className="line-clamp-3 text-[1.0625rem] font-bold leading-[1.28]">
            {card.title}
          </h2>
          <p className="text-[12px] text-[var(--gt-ink2)]">
            <bdi className="font-semibold text-[var(--gt-ink)]">{card.publisher}</bdi>
            {dated === '' ? '' : ` · ${dated}`}
            {domain === null ? '' : ` · ${domain}`}
            {card.countries.length > 0 ? ` · ${card.countries.slice(0, 2).map((c) => c.name).join(', ')}` : ''}
            {others === null ? '' : ` · ${others}`}
          </p>
          {card.summary !== null && (
            <p dir="auto" data-home-w60-change="" className="line-clamp-3 text-[0.875rem] leading-[1.45] text-[var(--gt-ink2)]">
              <span className="font-semibold text-[var(--gt-ink)]">{t.whatChanged}: </span>
              {card.summary}
            </p>
          )}
          <p data-home-w60-why="" className="text-[0.75rem] leading-snug text-[var(--gt-ink2)]">
            {basisLine}
          </p>
        </div>
      </div>
      <div role="group" aria-label={ts.actionsAria} className="flex items-center gap-0.5 border-t border-[var(--gt-line2)] px-1.5 py-1">
        <button type="button" data-home-action="read-brief" onClick={() => openVisualBrief(story, 'top')} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-2.5 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:bg-[var(--gt-actSoft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]">
          <BookOpenText aria-hidden="true" className="h-4 w-4" />
          {ts.readBrief}
        </button>
        {discussionRead && (
          <button type="button" data-home-action="discuss" onClick={() => openVisualBrief(story, 'discussion')} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-2.5 text-[0.875rem] font-semibold text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]">
            <MessagesSquare aria-hidden="true" className="h-4 w-4" />
            {count !== undefined && count > 0 ? `${ts.discuss} · ${count}` : ts.discuss}
          </button>
        )}
        <a href={safeExternalHref(card.url)} target="_blank" rel="noopener noreferrer" data-home-action="read-original" aria-label={fill(ts.readOriginalAria, { publisher: card.publisher })} className="ms-auto inline-flex min-h-[44px] items-center gap-1 rounded-[0.5rem] px-2.5 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]">
          {ts.readOriginal}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}

function MoreRow({ card, language }: { readonly card: HomeStoryCard; readonly language: LanguageCode }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.home;
  const age = formatObservationalTime(card.publishedAt, card.publishedAtBasis, language);
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${isAttention(card.freshness) ? 'bg-[var(--gt-amber)]' : 'bg-white/40'}`} />
      <div className="min-w-0 flex-1">
        <p dir="auto" className="line-clamp-2 text-[0.875rem] font-semibold leading-snug text-white">
          {card.title}
        </p>
        <p className="truncate text-[0.75rem] text-[var(--gt-hdrInk)]">
          <bdi>{card.publisher}</bdi>
          {age === '' ? '' : ` · ${age}`}
          {domainLabel(card, t) === null ? '' : ` · ${domainLabel(card, t)}`}
        </p>
      </div>
      <button
        type="button"
        data-home-action="read-brief"
        onClick={() => openVisualBrief(briefStoryOfCard(card), 'top')}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-[0.5rem] px-2.5 text-[0.8125rem] font-semibold text-cyan-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <BookOpenText aria-hidden="true" className="h-4 w-4" />
        {dict.visual.stories.readBrief}
      </button>
    </li>
  );
}
