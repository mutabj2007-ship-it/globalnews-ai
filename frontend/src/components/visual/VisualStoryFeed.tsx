'use client';

import { useId, useMemo, useState, type JSX } from 'react';
import { BookOpenText, ExternalLink, Info, MessagesSquare } from 'lucide-react';
import { safeExternalHref, type LanguageCode, type NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { StoryVisual } from '@/components/home/StoryVisual';
import { StoryBookmark } from '@/components/bookmark/StoryBookmark';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { useStageB } from '@/lib/stories/stageBStore';
import { openVisualBrief, type VisualBriefStory } from '@/lib/visual/visualBriefStore';
import { fill } from '@/components/home/reva/homeRevaModel';
import type { NewsArticle } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — "DEVELOPING STORIES" AND THE STORY-CARD CLICK CONTRACT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE APPROVED PRODUCT OWNER CLICK CONTRACT (H0 ruling 4; it SUPERSEDES, for this surface, the
 * WP2 / Claude H T-14 rule that image, headline and "Read source" open the publisher):
 *
 *   IMAGE            nothing — aria-hidden, pointer-events none, not focusable, no anchor
 *   CARD BACKGROUND  nothing — no stretched link, no onClick on the card
 *   TITLE            nothing — a plain <h3>; the card is labelled by it
 *   PUBLISHER        nothing — attribution text in <bdi>
 *   READ BRIEF       the internal Story Brief panel
 *   DISCUSS          the SAME Story Brief, at its Discussion section (only under discussion.read)
 *   SAVE             the existing StoryBookmark (the shared saved-stories store)
 *   READ ORIGINAL ↗  the ONLY control that leaves GlobalNewsAI: publisher URL, new tab,
 *                    safeExternalHref, "Read Original — [publisher], opens in a new tab"
 *
 * The machine-checkable rows are lib/visual/visualClickContract.ts. None of these controls runs
 * AI or a provider: the Brief opens on a READ, and nothing here can start a verification.
 *
 * DATA: the cards are the SAME one getHomeFeed() response the current Home allocates (no second
 * request). The interest filter narrows what is already loaded. There is no "Load more": the
 * feed has no cursor (H0 dependency D-7), so the count shown is what was loaded, said plainly.
 */
export interface VisualStory {
  readonly article: NewsArticle;
  readonly articleRef: string;
}

export function briefStoryOf({ article, articleRef }: VisualStory): VisualBriefStory {
  return {
    articleRef,
    url: article.url,
    title: article.title,
    summary: article.summary,
    sourceName: article.sourceName,
    sourcesCount: article.sourcesCount,
    publishedAt: article.publishedAt,
    publishedAtBasis: article.publishedAtBasis,
    category: article.category,
  };
}

export function VisualStoryFeed({
  stories,
  dataMode,
  language,
  discussionRead,
}: {
  readonly stories: readonly VisualStory[];
  readonly dataMode: NewsDataMode | null;
  readonly language: LanguageCode;
  /** Stage B discussion.read — Discuss renders only when the real capability exists. */
  readonly discussionRead: boolean;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.stories;
  const categoryLabels = dict.map.categories as Record<string, string>;
  const [interest, setInterest] = useState<string>('all');
  const selectId = useId();
  const categories = useMemo(() => {
    const present = new Set(stories.map((s) => s.article.category));
    return Object.keys(categoryLabels).filter((key) => key !== 'all' && present.has(key as NewsArticle['category']));
  }, [stories, categoryLabels]);
  const shown = interest === 'all' ? stories : stories.filter((s) => s.article.category === interest);

  return (
    <section id="visual-stories" aria-labelledby="visual-stories-title" data-visual-stories="" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 id="visual-stories-title" className="font-display text-[1.375rem] font-bold leading-tight text-[var(--gt-ink)]">
          {t.heading}
        </h2>
        <DataModeLabel dataMode={dataMode} language={language} labels={dict.homeReva.provenance} />
      </div>

      {stories.length === 0 ? (
        <p role="status" className="rounded-[0.75rem] border border-[var(--gt-line)] bg-[var(--gt-card)] p-6 text-[0.875rem] text-[var(--gt-ink2)]">
          {dict.betaHome.feedUnavailable}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {categories.length >= 2 && (
              <div className="flex items-center gap-2">
                <label htmlFor={selectId} className="text-[0.875rem] font-semibold text-[var(--gt-ink2)]">
                  {t.interest}
                </label>
                <select
                  id={selectId}
                  value={interest}
                  aria-label={t.filterAria}
                  onChange={(e) => setInterest(e.target.value)}
                  data-visual-interest=""
                  className="min-h-[44px] rounded-[0.5rem] border border-[var(--gt-line)] bg-[var(--gt-card)] px-3 text-[0.875rem] text-[var(--gt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
                >
                  <option value="all">{t.allTopics}</option>
                  {categories.map((key) => (
                    <option key={key} value={key}>
                      {categoryLabels[key] ?? key}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p role="status" className="text-[0.8125rem] text-[var(--gt-ink2)]">
              {fill(t.showing, { count: shown.length })}
            </p>
          </div>
          <p className="flex items-start gap-1.5 text-[0.75rem] leading-snug text-[var(--gt-ink2)]">
            <Info aria-hidden="true" className="mt-[1px] h-[13px] w-[13px] shrink-0" />
            <span>{t.noAi}</span>
          </p>
          <ul
            aria-labelledby="visual-stories-title"
            className="grid gap-4 min-[600px]:gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,max(280px,calc((100%_-_48px)/3))),1fr))]"
          >
            {shown.map((story) => (
              <li key={story.article.id} className="flex min-w-0">
                <VisualStoryCard story={story} language={language} discussionRead={discussionRead} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function VisualStoryCard({
  story,
  language,
  discussionRead,
}: {
  readonly story: VisualStory;
  readonly language: LanguageCode;
  readonly discussionRead: boolean;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.stories;
  const { article, articleRef } = story;
  const href = safeExternalHref(article.url);
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  const titleId = `visual-card-${article.id}`;
  const { counts } = useStageB();
  const count = counts[articleRef];
  const categoryLabels = dict.map.categories as Record<string, string>;

  return (
    <article
      aria-labelledby={titleId}
      data-visual-card=""
      className="flex w-full flex-col overflow-hidden rounded-[0.75rem] border border-[var(--gt-line)] bg-[var(--gt-card)] shadow-[0_8px_24px_-20px_rgba(20,36,59,0.5)]"
    >
      {/* IMAGE — decorative and inert: no anchor, no focus, no pointer events. */}
      <div aria-hidden="true" data-visual-card-image="" className="pointer-events-none select-none">
        <StoryVisual
          article={article}
          className="aspect-[16/9]"
          missingLabel={dict.betaHome.imageUnavailable}
          sizes="(min-width: 1200px) 30vw, (min-width: 600px) 48vw, 100vw"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[0.8125rem] text-[var(--gt-ink2)]">
          {/* PUBLISHER — attribution only, never a link. */}
          <bdi data-visual-card-publisher="" className="font-semibold text-[var(--gt-ink)]">
            {article.sourceName}
          </bdi>
          {elapsed === '' ? '' : ` · ${elapsed}`}
          {` · ${categoryLabels[article.category] ?? article.category}`}
        </p>
        {/* TITLE — a plain heading. No anchor, no handler. */}
        <h3 id={titleId} dir="auto" className="line-clamp-3 text-[1rem] font-bold leading-[1.3] text-[var(--gt-ink)]">
          {article.title}
        </h3>
        <p className="text-[0.8125rem] text-[var(--gt-ink2)]">{pluralWithForms(article.sourcesCount, language, dict.homeR1.compare.sourceForms)}</p>
      </div>
      <div role="group" aria-label={t.actionsAria} data-visual-card-actions="" className="flex flex-wrap items-center gap-1 border-t border-[var(--gt-line2)] px-2 py-1.5">
        <button
          type="button"
          data-visual-action="read-brief"
          onClick={() => openVisualBrief(briefStoryOf(story), 'top')}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-3 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:bg-[var(--gt-actSoft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
        >
          <BookOpenText aria-hidden="true" className="h-4 w-4" />
          {t.readBrief}
        </button>
        {discussionRead && (
          <button
            type="button"
            data-visual-action="discuss"
            onClick={() => openVisualBrief(briefStoryOf(story), 'discussion')}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[0.5rem] px-3 text-[0.875rem] font-semibold text-[var(--gt-ink2)] hover:bg-[var(--gt-sunk)] hover:text-[var(--gt-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
          >
            <MessagesSquare aria-hidden="true" className="h-4 w-4" />
            {count !== undefined && count > 0 ? `${t.discuss} · ${count}` : t.discuss}
          </button>
        )}
        <span data-visual-action="save" className="inline-flex items-center">
          <StoryBookmark url={article.url} language={language} size="compact" />
        </span>
        {/* READ ORIGINAL ↗ — the ONE exit. */}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-visual-action="read-original"
          aria-label={fill(t.readOriginalAria, { publisher: article.sourceName })}
          className="ms-auto inline-flex min-h-[44px] items-center gap-1 rounded-[0.5rem] px-3 text-[0.875rem] font-semibold text-[var(--gt-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
        >
          {t.readOriginal}
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  );
}
