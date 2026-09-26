import type { JSX } from 'react';
import { Info } from 'lucide-react';
import type { LanguageCode, NewsArticle, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { StoryRailMotion } from '@/components/home/StoryRailMotion';
import { StoryVisual } from '@/components/home/StoryVisual';
import {
  CARD_SHELL_INTERACTIVE,
  CHIP_STYLE,
  CHIP_FALLBACK,
  CHIP_BASE,
  CATEGORY_TEXT,
  CATEGORY_TEXT_FALLBACK,
  CATEGORY_TEXT_BASE,
  CATEGORY_ARTWORK,
  CATEGORY_ARTWORK_FALLBACK,
  SECTION_TITLE,
  SECTION_STANDFIRST,
} from '@/components/home/homePresentation';
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
  /*
    C3, as ruled: "Below `lg`: one horizontal scrollable pill row; never
    multi-row wrap; active pill visibly filled; clipped/partial next item may
    indicate scrollability; touch targets remain >=44px."

    `min-h-[44px]` is the ruled floor and it is unconditional until `xl` —
    1024-1279 is the tablet range, so the pills stay thumb-sized there and only
    compact to the prototype's row at 1280. `whitespace-nowrap` is what stops a
    two-word PL label from breaking the strip into a second line at 360px.
  */
  'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border border-[#17324f] bg-[#0b1c31] px-4 text-[13px] font-medium text-[#a8c0da] transition-colors hover:border-cyan-300/55 hover:bg-[#12293f] hover:text-white motion-reduce:transition-none xl:min-h-[26px] xl:px-3 xl:text-[12px]';

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
    <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-tertiary">
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

          <div className="gn-head flex flex-col gap-[7px]">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h2
              id="beta-now-heading"
              className={`font-display ${SECTION_TITLE}`}
            >
              {t.nowHeading}
              <span className={`mt-1 block font-normal ${SECTION_STANDFIRST}`}>
                {t.nowStandfirst}
                {stamp === null ? null : <> · {stamp}</>}
              </span>
            </h2>

            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
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

            </div>

            {/*
              THE FILTER ROW.

              The composition ruling collapsed the heading to ONE row, and this
              is the one place that could not hold: at the measured heading size
              (~27px) the six category chips, the data-mode label and "View all"
              do not fit beside the title in 836px, and the browser was wrapping
              them into THREE rows — about 130px of heading against the
              prototype's ~50px, which is worse than the single line the ruling
              was removing.

              So the row is split the cheapest way: the title keeps the data
              mode and "View all" beside it, and the chips take one compact
              26px strip below. That is ~26px, not the ~50px the ruling
              rejected, and the approved filter UI stays visible. Declared,
              because it is a deliberate departure from a literal reading.
            */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {showFilter ? (
              <div
                role="radiogroup"
                aria-label={t.categoryFilterAria}
                className="gn-chips -mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:mx-0 xl:flex-wrap xl:gap-1.5 xl:overflow-visible xl:px-0 xl:pb-0"
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

            {noAiNote}
            </div>
          </div>

          {/*
            BREATHING ROOM, as ruled: "add approximately 16-24px more
            separation before the story-card rail begins ... Do not reduce
            typography or card size to recover the space. The cards may move
            down slightly."

            So this is padding, not a smaller anything: ~18px on phone and
            ~22px from `lg`, on top of the section's own gap. Nothing above it
            was removed — heading, timestamp, LIVE indicator, View all, the
            chips and the no-AI disclosure all stay.
          */}
          <div className="gn-deck flex flex-col gap-3 pt-[20px] lg:pt-[28px]">
            {rail.length === 0 ? null : (
              /*
                The rail. Focusable so the arrow keys scroll it, labelled so a
                screen reader says as much, and `snap-x snap-mandatory` so a
                touch swipe lands on a card rather than between two. The negative
                margin plus matching padding keeps the focus ring from being
                clipped by the scroll container.
              */
              /*
                COMPLETION RULING item 4. `StoryRailMotion` renders this <ul>
                and gives it the restrained auto-advance: one card every 7s,
                smooth, paused whenever the reader is hovering, focused,
                dragging, swiping or scrolling, resumed after 4.5s of quiet,
                and disabled outright under `prefers-reduced-motion`.

                It makes NO network requests. The cards below are still
                server-rendered and passed through as children, so no article
                data crosses the client boundary and nothing about the rail's
                motion can cause a provider call or spend quota.

                The native scrollbar is hidden, not the scrolling:
                `overflow-x-auto` stays, `tabIndex={0}` and `role="group"` move
                with the element, and `snap-x snap-mandatory` still lands each
                swipe on a card.
              */
              <StoryRailMotion
                ariaLabel={t.storyRailAria}
                className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 lg:gap-[10px] xl:gap-[12px]"
              >
                {rail.map((article) => (
                  <li
                    key={article.id}
                    data-gn-story=""
                    data-gn-cat={article.category}
                    /*
                       CARD WIDTH BY TIER, not one basis that shrinks.

                       The prototype's four-up rail is measured at 1280, where
                       the left column is 836px and a card is 202px. At 1024
                       that same column is ~600px, so four-up gives ~140px
                       cards and every headline truncates mid-word — a shrunk
                       desktop, which the ruling refuses.

                       So four-up starts at `xl` (1280), the width it was
                       measured at, and 1024-1279 shows ~2.4 cards. The rail is
                       horizontally swipeable at every width, so nothing is
                       unreachable; the cards are simply legible at each tier.
                       Below `lg` one card dominates with the next peeking,
                       which is what tells a thumb it swipes.
                    */
                    className="flex h-[322px] shrink-0 basis-[87%] snap-start sm:h-[268px] sm:basis-[54%] md:basis-[44%] lg:h-[312px] lg:basis-[calc(41%-7.5px)] xl:h-[320px] xl:basis-[calc(25%-9px)]"
                  >
                    <RailCard article={article} language={language} />
                  </li>
                ))}
              </StoryRailMotion>
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
      className={`group flex h-full w-full flex-col overflow-hidden ${CARD_SHELL_INTERACTIVE} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50`}
    >
      <span className="relative block overflow-hidden">
        {/*
          The zoom lives on a wrapper INSIDE the clipping box, so the image grows
          behind a fixed frame instead of resizing the card. Frozen under
          `prefers-reduced-motion`.
        */}
        <span className="block transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          {/* Measured: 202 x 91 image on a 212-tall card -> 20:9, 43% of the card. */}
          <StoryImage article={article} language={language} className="aspect-[16/10] lg:aspect-[16/9] xl:aspect-[16/9]" />
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
          className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/55 via-black/20 to-transparent"
        />
        {/*
          The chip is no longer a generic black pill with cyan text. Its fill,
          border and text are the triple sampled from the prototype's own chip
          for this hue family — see `CHIP_STYLE`, which also records why the
          prototype's four domain names cannot be printed on a real story.
        */}
        {/*
          C4, as ruled: "Desktop / large screens: use the Product Owner
          prototype treatment: category chip over the image, top-left. Below
          `lg`: use the R4.1/R5.1 phone treatment: coloured category text above
          the headline. Do not force desktop image-overlay chips onto compact
          phone cards."

          So the chip is `hidden lg:inline-flex` and the coloured text label
          below lives in the body. The elapsed time follows the same logic: it
          stays on the image at `lg`+ where the prototype draws it, and joins
          the meta row below `lg` where R5.1 puts it ("Poland · 6 sources ·
          2h ago"). Neither is duplicated at any width.
        */}
        <span
          className={`absolute left-[11px] top-[11px] hidden ${CHIP_BASE} ${(CHIP_STYLE[article.category] ?? CHIP_FALLBACK).className} shadow-[0_2px_10px_-2px_rgba(0,0,0,0.9)] lg:inline-flex`}
        >
          {categoryLabels[article.category] ?? article.category}
        </span>
        <span className="absolute right-[11px] top-[11px] hidden items-center text-[10.5px] font-medium text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,0.95)] lg:inline-flex">
          <Elapsed article={article} language={language} />
        </span>
      </span>

      <span className="flex flex-1 flex-col gap-[3px] p-4 lg:p-[16px] xl:p-[17px]">
        {/*
          Two clamped lines for the headline and two for the summary. The clamps
          are what hold the rail to one card height: without them a long
          headline makes its own card taller than its neighbours, which is the
          ragged rail the prototype does not have.
        */}
        {/*
          C4 below `lg`: the subject in its own colour, above the headline,
          exactly as R5.1 draws it. Hidden at `lg`+, where the prototype's chip
          over the image carries the same fact — so the category appears once
          at every width, never twice and never not at all.
        */}
        <span
          className={`${CATEGORY_TEXT_BASE} ${CATEGORY_TEXT[article.category] ?? CATEGORY_TEXT_FALLBACK} lg:hidden`}
        >
          {categoryLabels[article.category] ?? article.category}
        </span>
        {/* Measured: headline ~15px on ~16.5px leading at `lg`+; the phone card
            is far more headline-led, per the approved phone frame. */}
        <span className="mt-[5px] line-clamp-3 text-[17px] font-bold leading-[1.16] tracking-[-0.012em] text-white sm:line-clamp-3 lg:mt-0 lg:text-[16px] lg:leading-[1.24] xl:text-[15.5px] xl:leading-[1.26]">
          {article.title}
        </span>
        <span className="mt-[3px] line-clamp-3 text-[13px] leading-[1.38] text-[#93a9c2] sm:line-clamp-3 lg:mt-[7px] lg:text-[12.5px] lg:leading-[1.45] xl:mt-[8px] xl:text-[12px] xl:leading-[1.48]">
          {article.summary}
        </span>
        <span className="mt-auto flex items-center gap-1.5 pt-2 text-[11.5px] tracking-[0.005em] text-[#8299b4] lg:pt-2.5 lg:text-[11px] xl:pt-3">
          <span className="truncate">{article.sourceName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{pluralWithForms(article.sourcesCount, language, t.sourceForms)}</span>
          {/* Below `lg` the age lives here rather than on the image.
              `Elapsed` supplies its own leading separator, so this row adds
              none — that is what produced the doubled "· ·" in the first
              capture. */}
          <span className="shrink-0 lg:hidden">
            <Elapsed article={article} language={language} />
          </span>
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
  /* The shared artwork-first visual — see `StoryVisual`. */
  return (
    <StoryVisual
      article={article}
      className={className}
      missingLabel={t.imageUnavailable}
      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 41vw, (min-width: 640px) 54vw, 88vw"
    />
  );
}

/** Basis-aware elapsed time, or nothing at all where the feed gives none. */
function Elapsed({ article, language }: { article: NewsArticle; language: LanguageCode }): JSX.Element | null {
  const elapsed = formatObservationalTime(article.publishedAt, article.publishedAtBasis, language);
  if (elapsed === '') return null;
  return <>{' · '}{elapsed}</>;
}
