'use client';

import type { JSX } from 'react';
import { BookOpenText, ExternalLink, MessagesSquare } from 'lucide-react';
import { safeExternalHref, type HomeStoryCard, type LanguageCode, type NewsArticle } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { StoryVisual } from '@/components/home/StoryVisual';
import { useStageB } from '@/lib/stories/stageBStore';
import { openVisualBrief } from '@/lib/visual/visualBriefStore';
import { fill } from '@/components/home/reva/homeRevaModel';
import { absoluteDate, briefStoryOfCard, domainLabel, freshnessLabel, isAttention, otherReportsLabel } from './homeStoryView';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PHONE-FIRST HOME CORRECTION R1 · §6, §12 — THE COMPACT HOME STORY CARD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Legacy compact scale (HomeR1Stories, the accepted pre-/visual Home): 12 px radius, 16/9 image,
 * 14 px body padding, 15.5 px three-line headline, 12 px meta. Click contract (unchanged ruling):
 *   IMAGE / CARD / TITLE / PUBLISHER   nothing (no anchor, no handler, no stretched link)
 *   READ BRIEF                         the in-app Story Brief panel
 *   DISCUSS                            the same Brief at its Discussion (only under discussion.read)
 *   READ ORIGINAL ↗                    the ONE exit to the publisher, new tab, safeExternalHref
 * Save, alerts, evidence and Ask follow-up live in the Brief, not in a crowded card toolbar.
 *
 * Amber (--gt-amber) marks a MATERIAL UPDATE (New / Developing) — the design's attention marker,
 * not a warning. Older reporting is plainly labelled "Earlier" with its date.
 */
export function HomeStoryCardView({
  card,
  language,
  discussionRead,
  showSummary = true,
}: {
  readonly card: HomeStoryCard;
  readonly language: LanguageCode;
  readonly discussionRead: boolean;
  readonly showSummary?: boolean;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.home;
  const ts = dict.visual.stories;
  const { counts } = useStageB();
  const count = counts[card.articleRef] ?? card.discussion?.comments;
  const titleId = `home-card-${card.articleRef.slice(0, 16)}`;
  const age = formatObservationalTime(card.publishedAt, card.publishedAtBasis, language);
  const dated = card.freshness === 'EARLIER' || card.freshness === 'ACTIVE_DISCUSSION' ? absoluteDate(card.publishedAt, language) : age;
  const domain = domainLabel(card, t);
  const others = otherReportsLabel(card.otherReports.count, t);
  const attention = isAttention(card.freshness);
  const story = briefStoryOfCard(card);

  return (
    <article
      aria-labelledby={titleId}
      data-home-card=""
      data-article-ref={card.articleRef}
      data-freshness={card.freshness}
      className="flex h-full w-full flex-col overflow-hidden rounded-[12px] border border-[var(--gt-line)] bg-[var(--gt-card)] shadow-[0_8px_24px_-20px_rgba(20,36,59,0.5)]"
    >
      <div aria-hidden="true" data-home-card-image="" className="pointer-events-none relative select-none">
        <StoryVisual article={{ category: card.category as NewsArticle['category'], imageUrl: card.imageUrl ?? undefined }} className="aspect-[16/9]" missingLabel={dict.betaHome.imageUnavailable} sizes="(min-width: 1000px) 300px, (min-width: 600px) 45vw, 84vw" />
        <span
          data-home-freshness=""
          className={`absolute start-[10px] top-[10px] inline-flex items-center gap-1 rounded-[6px] px-2 py-[3px] text-[11.5px] font-bold ${
            attention ? 'bg-[var(--gt-amber)] text-[var(--gt-amberOn)]' : 'bg-[var(--gt-chrome)] text-[var(--gt-ink)]'
          }`}
        >
          {freshnessLabel(card.freshness, t)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="text-[12px] leading-snug text-[var(--gt-ink2)]">
          <bdi data-home-card-publisher="" className="font-semibold text-[var(--gt-ink)]">
            {card.publisher}
          </bdi>
          {dated === '' ? '' : ` · ${dated}`}
          {domain === null ? '' : ` · ${domain}`}
        </p>
        <h3 id={titleId} dir="auto" className="line-clamp-3 text-[15.5px] font-bold leading-[1.28] text-[var(--gt-ink)]">
          {card.title}
        </h3>
        {showSummary && card.summary !== null && (
          <p dir="auto" data-home-card-change="" className="line-clamp-2 text-[13px] leading-[1.4] text-[var(--gt-ink2)]">
            {card.summary}
          </p>
        )}
        <p className="mt-auto flex flex-wrap gap-x-2 pt-1 text-[12px] text-[var(--gt-ink2)]">
          {card.countries.length > 0 && <span>{card.countries.slice(0, 2).map((c) => c.name).join(', ')}</span>}
          {others !== null && <span data-home-card-others="">{others}</span>}
        </p>
      </div>
      <div role="group" aria-label={ts.actionsAria} data-home-card-actions="" className="flex items-center gap-0.5 border-t border-[var(--gt-line2)] px-1.5 py-1">
        <button
          type="button"
          data-home-action="read-brief"
          onClick={() => openVisualBrief(story, 'top')}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-2.5 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:bg-[var(--gt-actSoft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
        >
          <BookOpenText aria-hidden="true" className="h-4 w-4" />
          {ts.readBrief}
        </button>
        {discussionRead && (
          <button
            type="button"
            data-home-action="discuss"
            onClick={() => openVisualBrief(story, 'discussion')}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-2.5 text-[0.875rem] font-semibold text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)] hover:text-[var(--gt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
          >
            <MessagesSquare aria-hidden="true" className="h-4 w-4" />
            {count !== undefined && count > 0 ? `${ts.discuss} · ${count}` : ts.discuss}
          </button>
        )}
        <a
          href={safeExternalHref(card.url)}
          target="_blank"
          rel="noopener noreferrer"
          data-home-action="read-original"
          aria-label={fill(ts.readOriginalAria, { publisher: card.publisher })}
          className="ms-auto inline-flex min-h-[44px] items-center gap-1 rounded-[0.5rem] px-2.5 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
        >
          <span className="max-[359px]:sr-only">{ts.readOriginal}</span>
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}
