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

/*
  C8 — `min-h-[44px]` is not decoration. Measured at 430, 390 and 360 the chips
  came out 34px tall, below the 44px touch target, and they are the section's
  primary control on a phone. `inline-flex items-center` keeps the label
  centred now that the box is taller than its text.
*/
const CHIP_CLASS =
  'inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-border-strong bg-void/60 px-3.5 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:border-cyan-400/40 hover:text-ink-primary motion-reduce:transition-none lg:min-h-[32px]';

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
    ══════════════════════════════════════════════════════════════════════
    THE LEAD STORY JOINS THE RAIL AS AN EQUAL CARD.
    ══════════════════════════════════════════════════════════════════════

    HERO CORRECTION RULING, zone Z4: *"Do not let the current oversized
    lead-story presentation dominate the page."* The Product Owner's desktop
    prototype draws FOUR EQUAL CARDS and no privileged one.

    This is a PRESENTATION change and nothing more. The allocator is
    untouched: `featured`, `inFocus` and `discovery` arrive exactly as
    `allocateHomeFeed` produced them under its unchanged `exclusive` stream
    policy, and the featured story keeps its position at the head of the
    sequence. What changes is that it is no longer drawn at twice the size of
    everything after it. No story is dropped, no order is rewritten, and no
    second request is made.

    `LeadStory` is removed from this file rather than left unreferenced,
    because an unused component here is a lint failure rather than an
    inspectable retirement — the released version stays readable in git at
    the commit before this one.

    The rail carries up to twelve. H3 took four, which is a grid, not a
    carousel — there was nothing to scroll to.
  */
  const rail = [...(lead === null ? [] : [lead]), ...secondary, ...discovery].slice(0, 12);

  /*
    CHIPS ONLY FOR CATEGORIES THE FEED ACTUALLY RETURNED, in the governed
    vocabulary's own order. Offering a category with no stories behind it would
    be a promise the feed cannot keep, and it is also what makes the CSS-only
    filter safe: every chip is guaranteed a non-empty result, so no empty state
    exists that stylesheet rules would have to detect.

    `all` is excluded from the scan and always leads.
  */
  const present = new Set<string>();
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
  const newest = rail[0];
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
        `#${RADIO_ID(key)}:checked ~ .gn-head label[for="${RADIO_ID(key)}"]{background-color:#f1f6fb;color:#04090f;border-color:#f1f6fb}`,
    )
    .join('');

  /*
    DESKTOP COMPOSITION RULING — the note is a TRUTH AFFORDANCE and stays, but
    it stops taking a line of the composition. It rides the end of the chip row
    on wide viewports and drops beneath it on narrow ones, so the band keeps
    the prototype's density without trading the statement away.
  */
  const noAiNote = (
    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-tertiary">
      <Info size={13} strokeWidth={1.75} aria-hidden="true" className="mt-[1px] shrink-0" />
      <span>{t.noAiNote}</span>
    </p>
  );

  return (
    /* C1 gives the hero an "Explore World" action, and this section is where it
       lands. scroll-mt keeps the heading clear of the fixed header. */
    <section
      id="whats-happening-now"
      aria-labelledby="beta-now-heading"
      className="flex scroll-mt-24 flex-col gap-3"
    >
      {rail.length === 0 ? (
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
          {/*
            DESKTOP COMPOSITION RULING — ONE HEADING ROW.

            The chips used to take a line of their own beneath the heading, and
            the prototype's band has no such line: title and standfirst on the
            left, the filter and "View all" on the right, then straight into the
            cards. That row was the last ~50px standing between "Explore by
            topic" and the first screen.

            The radios stay AHEAD of this wrapper so the CSS-only filter still
            works by sibling selection; the stylesheet now reaches the labels
            through `.gn-head` rather than `.gn-chips` directly.
          */}
          <div className="gn-head flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <h2
              id="beta-now-heading"
              className="font-display text-[22px] font-semibold tracking-tight text-ink-primary sm:text-2xl"
            >
              {t.nowHeading}
              <span className="mt-1 block text-[12.5px] font-normal text-ink-tertiary">
                {t.nowStandfirst}
                {stamp === null ? null : <> · {stamp}</>}
              </span>
            </h2>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-2">
              {showFilter ? (
                <div
                  role="radiogroup"
                  aria-label={t.categoryFilterAria}
                  className="gn-chips flex flex-wrap items-center gap-1.5"
                >
                  <label htmlFor={RADIO_ID('all')} className={CHIP_CLASS}>
                    {categoryLabels.all}
                  </label>
                  {categories.map((key) => (
                    <label key={key} htmlFor={RADIO_ID(key)} className={CHIP_CLASS}>
                      {categoryLabels[key] ?? key}
                    </label>
                  ))}
                </div>
              ) : null}

              <DataModeLabel dataMode={dataMode} language={language} />

              {/*
                "View all" is a second label for the same All radio, worded as
                the contract words it. It clears the filter; it does not
                navigate, because there is no all-stories route to navigate to.
              */}
              <label
                htmlFor={RADIO_ID('all')}
                className="inline-flex min-h-[44px] cursor-pointer items-center text-[13px] font-semibold text-cyan-300 underline-offset-4 hover:underline lg:min-h-[32px]"
              >
                {t.viewAll}
              </label>
            </div>

            <div className="w-full">{noAiNote}</div>
          </div>

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

            </>
          ) : null}

          <div className="gn-deck flex flex-col gap-3">
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
                    className="flex h-[224px] shrink-0 basis-[86%] snap-start sm:basis-[46%] lg:basis-[calc(25%-0.5625rem)]"
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
          <StoryImage article={article} language={language} className="aspect-[16/10]" />
        </span>

        {/*
          §7 — THE CATEGORY AND THE AGE SIT ON THE IMAGE, as the prototype draws
          them: a filled category chip at the top left and the elapsed time at
          the top right. Moving them off the body is what lets the body hold a
          fixed number of lines, which is what makes every card the same height.
          Both read over a gradient scrim rather than over bare photography, so
          the text keeps its contrast whatever the image is.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent"
        />
        <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-cyan-200 backdrop-blur-sm">
          {categoryLabels[article.category] ?? article.category}
        </span>
        <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-md bg-black/55 px-2 py-1 text-[10.5px] font-medium text-white/85 backdrop-blur-sm">
          <Elapsed article={article} language={language} />
        </span>
      </span>

      <span className="flex flex-1 flex-col gap-1 p-2.5">
        {/*
          Two clamped lines for the headline and two for the summary. The clamps
          are what hold the rail to one card height: without them a long
          headline makes its own card taller than its neighbours, which is the
          ragged rail the prototype does not have.
        */}
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-primary">
          {article.title}
        </span>
        <span className="line-clamp-2 text-[11.5px] leading-snug text-ink-tertiary">{article.summary}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-[10.5px] text-ink-tertiary">
          <span className="truncate">{article.sourceName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{pluralWithForms(article.sourcesCount, language, t.sourceForms)}</span>
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
