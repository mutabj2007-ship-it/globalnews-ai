import type { JSX } from 'react';
import { ImageOff, Info } from 'lucide-react';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatObservationalTime } from '@/lib/formatRelativeTime';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { SafeImage } from '@/components/ui/SafeImage';
import { DataModeLabel } from '@/components/ui/DataModeLabel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C2 · "WHAT'S HAPPENING NOW" — THE INTERACTIVE EDITORIAL AREA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME CLOSURE R2 increment C2, on top of the H3 section. H3 delivered a
 * heading, a freshness stamp, a lead story and a static four-up grid. R2
 * requires the interactions the prototype actually has: category chips, a
 * scroll-snap story rail with swipe, hover emphasis on the cards, keyboard
 * access to the rail, and a "View all".
 *
 * ── THE CHIPS ARE NOW BUILDABLE WITHOUT TOUCHING N7 ──────────────────────
 *
 * H3 withheld them for a specific reason, not caution: the chips the review
 * frame draws (Energy, Economy, Security, Humanitarian) are domain categories
 * this product's governed vocabulary does not contain, and rendering them would
 * have required inventing the mapping between the two — exactly the taxonomy
 * decision N7 reserves.
 *
 * R2 approves the chip UI and states it is driven by the governed taxonomy.
 * Both hold together only one way, and that is what is built here: the chips
 * come from `getDictionary(l).map.categories` — the shared `NewsCategory` union
 * — and ONLY for the categories the feed actually returned. So no label is
 * invented, no chip is offered that would lead to an empty result, and N7 STAYS
 * OPEN: the taxonomy itself is not being decided here.
 *
 * ── IT FILTERS WITH NO JAVASCRIPT AT ALL ─────────────────────────────────
 *
 * A hidden radio per category, labels styled as the chips, and one emitted
 * `<style>` block whose rules hide the stories that do not match the checked
 * radio. That is the whole mechanism.
 *
 * This is not cleverness for its own sake. This section sits on the page whose
 * defining constraint is that browsing must never start a metered analysis, and
 * a component with no client bundle cannot issue a request under any code path
 * — the `noAiNote` beneath the heading stays true by construction rather than
 * by review. It also keeps the whole Home a Server Component, keeps the hero's
 * native GET form intact, and works before hydration and with JS disabled.
 *
 * Accessibility comes from using the platform rather than working around it:
 * radios in a `radiogroup` give arrow-key selection, roving focus and
 * screen-reader state for free, which a div-and-onClick chip row would have had
 * to reimplement.
 *
 * ── "VIEW ALL" CLEARS THE FILTER; IT IS NOT A LINK ───────────────────────
 *
 * There is no all-stories route in this product. `/search` is the analysis
 * workspace and runs `analyzeNews`; `/story/:id` is N6 and still OPEN; `/map`
 * is country coverage, not a story list. C0 established the rule that no CTA
 * may point at a route that does not exist, so "View all" is a second label for
 * the "All" radio — a real affordance that returns the reader to every story.
 * FLAGGED FOR THE PRODUCT OWNER in case a route was intended.
 *
 * ── THE RAIL ─────────────────────────────────────────────────────────────
 *
 * `overflow-x-auto` with `snap-x snap-mandatory` gives horizontal scrolling,
 * native touch swipe and snap positions with no library and no JS. The region
 * is focusable so a keyboard reader can scroll it with the arrow keys, and it
 * is labelled to say so. It carries up to twelve stories — H3 sliced to four,
 * which left nothing to scroll.
 *
 * NO AUTOPLAY. The contract makes it optional, and an auto-advancing rail moves
 * content out from under someone mid-read, competes with the page's own scroll
 * on touch, and is the kind of motion `prefers-reduced-motion` exists to
 * suppress. Declining an optional feature is cheaper to reverse than shipping
 * one that has to be taken back.
 *
 * ── DATA TRUTH IS UNCHANGED ──────────────────────────────────────────────
 *
 * Every field is the feed's own: `title`, `summary`, `imageUrl` through
 * SafeImage or the governed "Image unavailable" treatment, `sourceName`,
 * `sourcesCount`, and `publishedAt` through `formatObservationalTime` so an
 * observed timestamp is never presented as a publication claim. No illustrative
 * headline, no sample image, no invented count. Stories link out to their
 * publisher, which stays the behaviour while N6 is open.
 */

interface WhatsHappeningNowProps {
  /** The one `getHomeFeed()` response, by role. No second fetch. */
  lead: NewsArticle | null;
  secondary: NewsArticle[];
  discovery: NewsArticle[];
  /**
   * The provenance of what is being shown — live, cached, mock or unknown.
   *
   * It moves here with the rest of the retired strip's duty. §6 requires a
   * truthful availability state, and "these stories are cached" is exactly
   * that: without it the reader cannot tell fresh reporting from a stale copy.
   * Rendered through the governed `DataModeLabel` rather than a second
   * vocabulary invented here.
   */
  dataMode: NewsDataMode | null;
  language?: LanguageCode;
}

/** One id space for the radio group; this section renders once per page. */
const RADIO_NAME = 'gn-home-category';
const RADIO_ID = (category: string): string => `gn-cat-${category}`;

const CHIP_CLASS =
  'cursor-pointer rounded-full border border-border-strong bg-void/60 px-4 py-1.5 text-sm font-medium text-ink-secondary transition-colors hover:border-cyan-400/40 hover:text-ink-primary motion-reduce:transition-none';

export function WhatsHappeningNow({
  lead,
  secondary,
  discovery,
  dataMode,
  language = 'en',
}: WhatsHappeningNowProps): JSX.Element {
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  /*
    The rail carries up to twelve. H3 took four, which is a grid, not a
    carousel — there was nothing to scroll to.
  */
  const rail = [...secondary, ...discovery].slice(0, 12);

  /*
    CHIPS ONLY FOR CATEGORIES THE FEED ACTUALLY RETURNED, in the governed
    vocabulary's own order. Offering a category with no stories behind it would
    be a promise the feed cannot keep, and it is also what makes the CSS-only
    filter safe: every chip is guaranteed a non-empty result, so no empty state
    exists that stylesheet rules would have to detect.

    `all` is excluded from the scan and always leads.
  */
  const present = new Set<string>();
  if (lead !== null) present.add(lead.category);
  for (const article of rail) present.add(article.category);

  const categories = Object.keys(categoryLabels).filter(
    (key) => key !== 'all' && present.has(key),
  );
  /* One category is not a filter. Below two, the chips are simply not drawn. */
  const showFilter = categories.length >= 2;

  /*
    The stamp describes the FRESHEST thing actually returned, not render time.
    Using `new Date()` here would state a freshness the feed never claimed.
  */
  const newest = lead ?? rail[0];
  const stampTime =
    newest === undefined
      ? ''
      : formatObservationalTime(newest.publishedAt, newest.publishedAtBasis, language);
  const stamp = stampTime === '' ? null : t.updatedStamp.replace('{time}', stampTime);

  /*
    The filter itself. For each category: hide every story not in it, and light
    its own chip. `all` needs no hiding rule — everything is visible by default,
    which is also the state before any CSS loads.
  */
  const filterCss = categories
    .map(
      (key) =>
        `#${RADIO_ID(key)}:checked ~ .gn-deck [data-gn-story]:not([data-gn-cat="${key}"]){display:none}` +
        `#${RADIO_ID(key)}:checked ~ .gn-chips label[for="${RADIO_ID(key)}"]{background-color:#f1f6fb;color:#04090f;border-color:#f1f6fb}`,
    )
    .join('');

  const noAiNote = (
    <p className="flex items-start gap-2 text-sm text-ink-tertiary">
      <Info size={15} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{t.noAiNote}</span>
    </p>
  );

  return (
    /* C1 gives the hero an "Explore World" action, and this section is where it
       lands. scroll-mt keeps the heading clear of the fixed header. */
    <section
      id="whats-happening-now"
      aria-labelledby="beta-now-heading"
      className="flex scroll-mt-24 flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="beta-now-heading"
          className="font-display text-3xl font-semibold tracking-tight text-ink-primary sm:text-4xl"
        >
          {t.nowHeading}
        </h2>
        <span className="flex items-center gap-3">
          <DataModeLabel dataMode={dataMode} language={language} />
          {stamp === null ? null : <span className="text-sm text-ink-tertiary">{stamp}</span>}
        </span>
      </div>

      {lead === null && rail.length === 0 ? (
        <>
          {noAiNote}
          {/*
            THE DEGRADED STATE, inherited from the retired status strip. A gap is
            stated, never disguised — §6.
          */}
          <p
            role="status"
            className="rounded-2xl border border-border-strong bg-void/60 p-6 text-sm text-ink-tertiary"
          >
            {t.feedUnavailable}
          </p>
        </>
      ) : (
        <>
          {/*
            The radios lead the group because the stylesheet reaches the chip row
            and the deck as their following siblings. They are visually hidden
            with `sr-only`, never `display:none`, so they stay focusable and
            operable.
          */}
          {showFilter ? (
            <>
              <style>{filterCss}</style>
              <input
                type="radio"
                name={RADIO_NAME}
                id={RADIO_ID('all')}
                defaultChecked
                aria-label={categoryLabels.all}
                className="sr-only"
              />
              {categories.map((key) => (
                <input
                  key={key}
                  type="radio"
                  name={RADIO_NAME}
                  id={RADIO_ID(key)}
                  aria-label={categoryLabels[key] ?? key}
                  className="sr-only"
                />
              ))}

              <div
                role="radiogroup"
                aria-label={t.categoryFilterAria}
                className="gn-chips flex flex-wrap items-center gap-2"
              >
                <label htmlFor={RADIO_ID('all')} className={CHIP_CLASS}>
                  {categoryLabels.all}
                </label>
                {categories.map((key) => (
                  <label key={key} htmlFor={RADIO_ID(key)} className={CHIP_CLASS}>
                    {categoryLabels[key] ?? key}
                  </label>
                ))}
                {/*
                  "View all" is a second label for the same All radio, worded as
                  the contract words it. It clears the filter; it does not
                  navigate, because there is no all-stories route to navigate to.
                */}
                <label
                  htmlFor={RADIO_ID('all')}
                  className="ml-auto cursor-pointer text-sm font-semibold text-cyan-300 underline-offset-4 hover:underline"
                >
                  {t.viewAll}
                </label>
              </div>
            </>
          ) : null}

          {noAiNote}

          <div className="gn-deck flex flex-col gap-4">
            {lead === null ? null : <LeadStory article={lead} language={language} />}

            {rail.length === 0 ? null : (
              /*
                The rail. Focusable so the arrow keys scroll it, labelled so a
                screen reader says as much, and `snap-x snap-mandatory` so a
                touch swipe lands on a card rather than between two. The negative
                margin plus matching padding keeps the focus ring from being
                clipped by the scroll container.
              */
              <ul
                tabIndex={0}
                role="group"
                aria-label={t.storyRailAria}
                className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              >
                {rail.map((article) => (
                  <li
                    key={article.id}
                    data-gn-story=""
                    data-gn-cat={article.category}
                    className="flex shrink-0 basis-[86%] snap-start sm:basis-[46%] lg:basis-[calc(25%-0.5625rem)]"
                  >
                    <RailCard article={article} language={language} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The lead story. It carries the filter attributes too, so choosing a category
 * the lead is not in hides it rather than leaving a headline that contradicts
 * the chip the reader just pressed.
 */
function LeadStory({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      data-gn-story=""
      data-gn-cat={article.category}
      className="group grid grid-cols-1 overflow-hidden rounded-2xl border border-border-strong bg-void/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_18px_40px_-24px_rgba(34,211,238,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:grid-cols-2"
    >
      {/* Both wrappers carry the height so `sm:h-full` still reaches the image
          through the zoom layer and the lead keeps its full-bleed column. */}
      <span className="relative block overflow-hidden sm:h-full">
        <span className="block transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:h-full">
          <StoryImage article={article} language={language} className="aspect-[16/10] sm:h-full" />
        </span>
      </span>
      <div className="flex flex-col gap-2 p-5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-cyan-300/80">
          {categoryLabels[article.category] ?? article.category}
        </span>
        <h3 className="font-display text-xl font-semibold leading-snug text-ink-primary sm:text-2xl">
          {article.title}
        </h3>
        {/* The publisher's own summary. Never an AI-written one — none is generated here. */}
        <p className="line-clamp-3 text-sm leading-relaxed text-ink-tertiary">{article.summary}</p>
        <p className="mt-auto pt-2 text-xs text-ink-tertiary">
          {article.sourceName}
          {' · '}
          {pluralWithForms(article.sourcesCount, language, t.sourceForms)}
          <Elapsed article={article} language={language} />
        </p>
      </div>
    </a>
  );
}

/** One card in the rail: lift on hover, and a slow zoom on its own image. */
function RailCard({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element {
  const t = getDictionary(language).betaHome;
  const categoryLabels = getDictionary(language).map.categories;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-void/60 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_18px_40px_-24px_rgba(34,211,238,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className="relative block overflow-hidden">
        {/*
          The zoom lives on a wrapper INSIDE the clipping box, so the image grows
          behind a fixed frame instead of resizing the card. Frozen under
          `prefers-reduced-motion`.
        */}
        <span className="block transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <StoryImage article={article} language={language} className="aspect-[16/9]" />
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="font-mono text-[11px] uppercase tracking-wide text-cyan-300/80">
          {categoryLabels[article.category] ?? article.category}
        </span>
        <span className="text-sm font-semibold leading-snug text-ink-primary">{article.title}</span>
        <span className="mt-auto pt-1 text-xs text-ink-tertiary">
          {article.sourceName}
          {' · '}
          {pluralWithForms(article.sourcesCount, language, t.sourceForms)}
          <Elapsed article={article} language={language} />
        </span>
      </span>
    </a>
  );
}

/**
 * The image, or the governed absence treatment. SPEC §6 records that licensed
 * editorial photography was not available to the design review, so a card
 * without a feed image states that plainly rather than borrowing an
 * illustration — which §6 of the Home contract forbids on the live path.
 */
function StoryImage({
  article,
  language,
  className,
}: {
  article: NewsArticle;
  language: LanguageCode;
  className: string;
}): JSX.Element {
  const t = getDictionary(language).betaHome;

  if (article.imageUrl === undefined) {
    return (
      <span className={`flex w-full items-center justify-center gap-2 bg-surface text-xs text-ink-tertiary ${className}`}>
        <ImageOff size={16} strokeWidth={1.75} aria-hidden="true" />
        {t.imageUnavailable}
      </span>
    );
  }

  return (
    <span className={`relative block w-full bg-surface ${className}`}>
      <SafeImage
        src={article.imageUrl}
        alt=""
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover"
      />
    </span>
  );
}

/** Basis-aware elapsed time, or nothing at all where the feed gives none. */
function Elapsed({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element | null {
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  if (elapsed === '') return null;
  return <>{' · '}{elapsed}</>;
}
