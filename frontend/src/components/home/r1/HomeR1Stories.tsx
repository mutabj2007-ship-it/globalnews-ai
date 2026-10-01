import type { JSX } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { safeExternalHref, type LanguageCode, type NewsArticle, type NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { StoryVisual } from '@/components/home/StoryVisual';
import { StoryRailMotion } from '@/components/home/StoryRailMotion';
import { DataModeLabel } from '@/components/ui/DataModeLabel';
import { StoryCardActions } from './StoryCardActions';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME R1 · STAGE A — "WHAT'S HAPPENING NOW", LIGHT PRIMARY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The same ONE feed response and the same allocation as Rev A (no second request); the
 * same CSS-only category filter (no client bundle can start anything). What R1 adds:
 *
 *   · THE PUBLISHER LINK IS UNCHANGED. Image, headline and "Read source" are each the
 *     publisher's `<a target="_blank">` (safeExternalHref), exactly as Rev A's card.
 *   · THE ACTION ROW (home.cardActions) is a SIBLING below the card's links — never nested
 *     in one — so no action can hijack the publisher navigation.
 *   · STORY AUTO-ADVANCE ENDS once the action row ships (Design R1-P5): with actions the
 *     rail is a plain scroller; without them Rev A's StoryRailMotion is kept.
 *   · articleRef is the server's sha256(normalizeArticleUrl(url)) — the governed identity
 *     the Compare read and Ask verify; it is never shown and never authority.
 */
export interface HomeR1Story {
  readonly article: NewsArticle;
  readonly articleRef: string;
}

const RADIO = 'gn-r1-category';
const RADIO_ID = (key: string): string => `gn-r1-cat-${key}`;
const CHIP =
  'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border border-[#DCE3EA] bg-white px-4 text-[13px] font-semibold text-[#526174] hover:border-[#245FC7] lg:min-h-[34px] lg:px-3';

export function HomeR1Stories({
  stories,
  dataMode,
  language,
  cardActions,
  compareTray,
}: {
  readonly stories: readonly HomeR1Story[];
  readonly dataMode: NewsDataMode | null;
  readonly language: LanguageCode;
  readonly cardActions: boolean;
  readonly compareTray: boolean;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.homeR1;
  const b = dict.betaHome;
  const categoryLabels = dict.map.categories;
  const gd = dict.globalDevelopments;
  const present = new Set(stories.map((s) => s.article.category));
  const categories = Object.keys(categoryLabels).filter((key) => key !== 'all' && present.has(key as NewsArticle['category']));
  const showFilter = categories.length >= 2;
  const newest = stories[0]?.article;
  const stampTime = newest === undefined ? '' : formatObservationalTime(newest.publishedAt, newest.publishedAtBasis, language);
  const stamp = stampTime === '' ? null : b.updatedStamp.replace('{time}', stampTime);
  const filterCss = categories
    .map(
      (key) =>
        `#${RADIO_ID(key)}:checked ~ .gn-r1-deck [data-gn-story]:not([data-gn-cat="${key}"]){display:none}` +
        `#${RADIO_ID(key)}:checked ~ .gn-r1-head label[for="${RADIO_ID(key)}"]{background-color:#14243B;color:#ffffff;border-color:#14243B}`,
    )
    .join('');
  const allCss = `#${RADIO_ID('all')}:checked ~ .gn-r1-head label[for="${RADIO_ID('all')}"]{background-color:#14243B;color:#ffffff;border-color:#14243B}`;

  const cards = stories.slice(0, 12).map(({ article, articleRef }) => (
    <li
      key={article.id}
      data-gn-story=""
      data-gn-cat={article.category}
      className="flex min-w-0 shrink-0 basis-[84%] snap-start sm:basis-[calc(50%-6px)] [@container(min-width:700px)]:basis-[calc(33.333%-8px)] [@container(min-width:1000px)]:basis-[calc(25%-9px)]"
    >
      <RailCard
        article={article}
        articleRef={articleRef}
        language={language}
        cardActions={cardActions}
        compareTray={compareTray}
      />
    </li>
  ));

  return (
    <section id="whats-happening-now" aria-labelledby="home-r1-now" className="flex scroll-mt-24 flex-col gap-3 [container-type:inline-size]">
      {stories.length === 0 ? (
        <p role="status" className="rounded-[12px] border border-[#DCE3EA] bg-white p-6 text-[14px] text-[#526174]">
          {b.feedUnavailable}
        </p>
      ) : (
        <>
          {showFilter && (
            <>
              <style>{filterCss + allCss}</style>
              <input type="radio" name={RADIO} id={RADIO_ID('all')} defaultChecked aria-label={categoryLabels.all} className="sr-only" />
              {categories.map((key) => (
                <input key={key} type="radio" name={RADIO} id={RADIO_ID(key)} aria-label={categoryLabels[key] ?? key} className="sr-only" />
              ))}
            </>
          )}
          <div className="gn-r1-head flex flex-col gap-2">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <h2 id="home-r1-now" className="font-display text-[24px] font-bold leading-tight tracking-[-0.015em] text-[#14243B]">
                {b.nowHeading}
                <span className="mt-1 block text-[13px] font-normal text-[#526174]">
                  {b.nowStandfirst}
                  {stamp === null ? null : <> · {stamp}</>}
                </span>
              </h2>
              <DataModeLabel dataMode={dataMode} language={language} labels={dict.homeReva.provenance} />
            </div>
            {showFilter && (
              <div role="radiogroup" aria-label={b.categoryFilterAria} className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
                <label htmlFor={RADIO_ID('all')} className={CHIP}>
                  {categoryLabels.all}
                </label>
                {categories.map((key) => (
                  <label key={key} htmlFor={RADIO_ID(key)} className={CHIP}>
                    {categoryLabels[key] ?? key}
                  </label>
                ))}
              </div>
            )}
            <p className="flex items-start gap-1.5 text-[12px] leading-snug text-[#526174]">
              <Info aria-hidden="true" className="mt-[1px] h-[13px] w-[13px] shrink-0" />
              <span>{t.stories.noAi}</span>
            </p>
          </div>
          <div className="gn-r1-deck pt-2">
            {cardActions ? (
              /* R1-P5 — no auto-advance once the reader has actions on a card. */
              <ul
                aria-label={b.storyRailAria}
                tabIndex={0}
                data-home-r1-rail="static"
                className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245FC7]"
              >
                {cards}
              </ul>
            ) : (
              <StoryRailMotion
                ariaLabel={b.storyRailAria}
                previousLabel={gd.previousLabel}
                nextLabel={gd.nextLabel}
                className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245FC7]"
              >
                {cards}
              </StoryRailMotion>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function RailCard({
  article,
  articleRef,
  language,
  cardActions,
  compareTray,
}: {
  readonly article: NewsArticle;
  readonly articleRef: string;
  readonly language: LanguageCode;
  readonly cardActions: boolean;
  readonly compareTray: boolean;
}): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.homeR1;
  const categoryLabels = dict.map.categories;
  const href = safeExternalHref(article.url);
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  return (
    <article data-home-r1-card="" className="flex w-full flex-col overflow-hidden rounded-[12px] border border-[#DCE3EA] bg-white shadow-[0_8px_24px_-20px_rgba(20,36,59,0.5)]">
      <a href={href} target="_blank" rel="noopener noreferrer" data-publisher-link="image" tabIndex={-1} aria-hidden="true" className="relative block">
        <StoryVisual
          article={article}
          className="aspect-[16/9]"
          missingLabel={dict.betaHome.imageUnavailable}
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 48vw, 84vw"
        />
        <span className="absolute left-[10px] top-[10px] rounded-[6px] bg-white/95 px-2 py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#14243B]">
          {categoryLabels[article.category] ?? article.category}
        </span>
      </a>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="text-[11.5px] text-[#526174]">
          {elapsed}
          {elapsed === '' ? '' : ' · '}
          {pluralWithForms(article.sourcesCount, language, t.compare.sourceForms)}
        </p>
        <h3 className="line-clamp-3 text-[15.5px] font-bold leading-[1.28] text-[#14243B]">
          <a href={href} target="_blank" rel="noopener noreferrer" data-publisher-link="headline" className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245FC7]">
            {article.title}
          </a>
        </h3>
        <p className="mt-auto flex items-center justify-between gap-2 pt-1 text-[12px] text-[#526174]">
          <span className="truncate">{article.sourceName}</span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-publisher-link="read-source"
            className="inline-flex min-h-[32px] shrink-0 items-center gap-1 font-semibold text-[#245FC7] hover:underline"
          >
            {t.stories.readSource}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </p>
      </div>
      {cardActions && (
        <StoryCardActions
          articleRef={articleRef}
          url={article.url}
          card={{
            title: article.title,
            sourceName: article.sourceName,
            ...(article.imageUrl === undefined ? {} : { imageUrl: article.imageUrl }),
          }}
          language={language}
          compare={compareTray}
        />
      )}
    </article>
  );
}
