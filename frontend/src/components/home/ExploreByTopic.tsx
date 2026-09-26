import type { JSX } from 'react';
import Image from 'next/image';
import {
  Search,
  Globe2,
  MapPinned,
  ScanSearch,
  LineChart,
  ShieldAlert,
  TrendingUp,
  History,
  Radar,
  ArrowRight,
} from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import {
  TOPIC_STYLE,
  TOPIC_FALLBACK,
  TOPIC_CARD_BASE,
  SECTION_TITLE,
  SECTION_STANDFIRST,
} from '@/components/home/homePresentation';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C4 · EXPLORE BY TOPIC
 *
 * ── IT NOW CARRIES `id="intelligence-modules"` ──────────────────────────
 *
 * Not decoration, and not a leftover. `MobileBottomNav` ships four approved
 * destinations and one of them is `#intelligence-modules`. §7 of the DESKTOP
 * COMPOSITION RULING moves the nine-card Engine off Home, which would have left
 * that tab pointing at an element no longer in the document — a dead control in
 * the product's primary mobile navigation.
 *
 * The anchor therefore moves to the surface that now answers the same question
 * on Home: the topic strip. The tab keeps working, it lands somewhere that
 * genuinely shows the reader the intelligence domains, and nothing in
 * `MobileBottomNav` had to be edited to achieve it. When the separate
 * intelligence/topics page exists, that tab is the second thing to repoint at
 * it, after `View all topics`.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME CLOSURE R2 increment C4. A compact topic row between the editorial
 * area and the nine-card Engine, ending in "View all topics".
 *
 * ── SIX ENTRIES, AND EVERY ONE COMES OUT OF THE REGISTRY ─────────────────
 *
 * The contract names World, Economy, Energy, Security, Humanitarian and
 * Markets. Those are not news categories — the governed news taxonomy is
 * world, politics, business, technology, science, health, sports,
 * entertainment — they are INTELLIGENCE MODULE ids. So each entry is looked up
 * in `INTELLIGENCE_MODULES` and takes the registry's own title, icon and
 * destination.
 *
 * That is deliberate rather than convenient. A topic here cannot acquire a
 * route the registry does not have, cannot keep one the registry drops, and
 * cannot carry a name the module section does not also show. The alternative —
 * a six-row table written in this file — would have been a second source of
 * truth for the same six surfaces, free to drift from the first.
 *
 * ── WORLD IS NOT A LINK, AND THAT IS THE HONEST RESULT ───────────────────
 *
 * `world-intelligence` is the one module whose `destination` is absent: the
 * registry marks it `comingSoon` with "No route". Five of the six topics
 * therefore link to real preview surfaces and World renders as plain text,
 * gated by the same `isModuleNavigable` the nine-card Engine uses.
 *
 * Minting a `/world` route to make the row symmetrical would have invented a
 * surface that does not exist, which §6 forbids and which C0 recorded as the
 * standing rule for this whole closure. The note under the row says both
 * things out loud instead: preview surfaces open with partial data, and a
 * topic with no surface yet is not a link.
 *
 * ── IT SPENDS NOTHING ────────────────────────────────────────────────────
 *
 * A Server Component with no client bundle, no state and no handler, rendering
 * ordinary links. Nothing here can begin a metered analysis, and "View all
 * topics" is an in-page anchor to `#intelligence-modules` — an anchor that
 * already exists and is one of the four approved destinations.
 */

const ICONS = {
  Search,
  Globe2,
  MapPinned,
  ScanSearch,
  LineChart,
  ShieldAlert,
  TrendingUp,
  History,
  Radar,
} as const;

/**
 * The contract's own order. These are registry ids, not labels — every visible
 * string is resolved from the dictionary through the module's `dictionaryKey`.
 */
const TOPIC_IDS = [
  'world-intelligence',
  'economy',
  'energy',
  'security',
  'humanitarian',
  'market',
] as const;

/**
 * The approved category hues, the same ones the nine-card Engine applies to its
 * module titles. Keyed by module id so a topic can never be tinted as another
 * module.
 */
/**
 * ── Z7 · THE PROTOTYPE'S TOPIC-CARD ACCENTS ──────────────────────────────
 *
 * The Product Owner's desktop prototype draws six substantial cards, each with
 * a tinted icon tile, a name, a two-line description and a filled circular
 * arrow in the card's own accent. The previous treatment was a flat 92px tile
 * carrying an icon and a name — recognisably the same content, and not
 * recognisably the same design.
 *
 * Each topic gets four values so the card composes without a lookup in the
 * markup: the icon colour, the tile fill behind it, the card's hover border
 * and the arrow fill. Colours are read off the prototype and kept inside the
 * product's existing palette rather than introducing new hexes.
 *
 * ORDER AND NAMES REMAIN THE REGISTRY'S. Nothing here invents a topic, a label
 * or a destination; `INTELLIGENCE_MODULES` is still the only source of those,
 * and a topic with no surface is still not a link.
 */
/*
 * ── WHERE THE TOPIC COLOURS NOW COME FROM ──────────────────────────────
 *
 * They used to be a local table of Tailwind washes
 * (`from-sky-500/30 to-sky-700/12` and five siblings). Sampling the
 * prototype showed two things wrong with that, not one:
 *
 *   · the wash ran top-to-bottom; the prototype's gradient runs
 *     top-left to bottom-right, which is why the cards never sat right
 *     next to the screenshot however the opacities were tuned;
 *   · at 30% over a dark page the wash desaturates to roughly `#12233c`,
 *     while the prototype's own top-left corners sample `#032f6f`,
 *     `#003831`, `#391525`, `#4a2d14`. The prototype is far more
 *     chromatic than any opacity of an existing app token.
 *
 * §11 forbids substituting muted existing colours for that reason, so the
 * table moved to `homePresentation.ts` and now carries sampled values.
 * The prototype also draws the icon as a BARE GLYPH with no tile behind
 * it; the tile is gone from the markup below rather than restyled.
 */

interface ExploreByTopicProps {
  language?: LanguageCode;
}

export function ExploreByTopic({ language = 'en' }: ExploreByTopicProps): JSX.Element {
  const t = getDictionary(language).betaHome;
  const moduleText = getDictionary(language).intelligenceModules.modules;

  const topics = TOPIC_IDS.map((id) => INTELLIGENCE_MODULES.find((m) => m.id === id)).filter(
    (m): m is NonNullable<typeof m> => m !== undefined,
  );

  return (
    <section
      id="intelligence-modules"
      aria-labelledby="beta-topics-heading"
      className="flex scroll-mt-24 flex-col gap-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Measured: cap box y 360..379 -> ~27px, weight 700. */}
          <h2 id="beta-topics-heading" className={`font-display ${SECTION_TITLE}`}>
            {t.exploreTopicsTitle}
          </h2>
          {/* The prototype puts the standfirst directly under the heading, not
              under the grid, and keeps it to one short line. */}
          <p className={`mt-1 ${SECTION_STANDFIRST}`}>{t.exploreTopicsNote}</p>
        </div>
        {/*
          ══════════════════════════════════════════════════════════════════
          "VIEW ALL TOPICS" — STRUCTURALLY READY, DELIBERATELY NOT WIRED.
          ══════════════════════════════════════════════════════════════════

          DESKTOP COMPOSITION RULING §6 supersedes the anchor this control used
          to carry: *"`View all topics` will lead to a separate
          intelligence/topics page... create/use a truthful destination only if
          an appropriate route already exists; otherwise leave the Home CTA
          structurally ready and report the route dependency; do not invent a
          production route silently."*

          MEASURED: `app/` carries no topics, intelligence or engine segment.
          There is no route to point this at, and the old `#intelligence-modules`
          anchor is no longer a destination either, because §7 moves the
          nine-card Engine off Home entirely — pointing at it would scroll the
          reader to nothing.

          So the control keeps its place, its wording and its weight, and does
          not navigate. It is a real `<button disabled>`: the browser refuses
          the press, it is out of the tab order, and its own label says why. A
          link to a page that does not exist would 404; a link to a removed
          anchor would silently do nothing; this does neither.

          ROUTE DEPENDENCY, REPORTED: when the intelligence/topics page exists,
          this becomes a Link to it and nothing else in this file changes.
        */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          tabIndex={-1}
          className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1.5 text-[13px] font-semibold text-[#6f8aa6] xl:min-h-[28px]"
        >
          {t.viewAllTopics}
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary/70">
            {t.viewAllTopicsPending}
          </span>
        </button>
      </div>

      {/* Measured: six cards of 136px across 861px -> 9px gutters. */}
      <ul className="mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-[9px]">
        {topics.map((module) => {
          /* The prototype's short name where it gives one; the registry's
             title otherwise. The label never decides the destination. */
          const label =
            t.topicLabels[module.id] ??
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.title ??
            module.id;
          const Icon = ICONS[module.icon];
          const accent = TOPIC_STYLE[module.id] ?? TOPIC_FALLBACK;
          /* Section 6 of the premium pass asks for shorter copy. The prototype's
             own one-line blurb where the dictionary carries one; the registry's
             module description otherwise, so a new topic is never blank. */
          const summary =
            t.topicBlurbs[module.id] ??
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.description ??
            '';
          const navigable = isModuleNavigable(module) && module.destination !== undefined;

          const body = (
            <>
              {/*
                ── THE IMAGE AREA ──────────────────────────────────────────

                Product Owner addition: "topic cards must no longer be
                color-only surfaces ... each `Explore by topic` card should
                include a visual image area so the card feels alive and
                editorial, not just categorical", structured as image → icon +
                title → short descriptor → arrow.

                WHICH OF THE THREE PERMITTED SOURCES THIS IS, AND WHY.

                The ruling's first preference is "a real representative topic
                image from governed Home/topic content". That is not available
                and would not be honest if it were: the governed feed's
                categories are the news taxonomy, while these six are
                INTELLIGENCE MODULES. Putting a specific article's photograph
                on the Energy card asserts that the article is about Energy,
                which the data does not say. So this is the third option done
                properly — "a tasteful topic visual/illustration fallback".

                Each image is abstract editorial artwork in the topic's own
                accent: a field gradient, one geometric motif, a vignette. No
                place, no people, no scene, no event, so nothing here can be
                read as reporting and nothing here can go stale. They are built
                by `scripts/topic-art/render.py`, a tool the application never
                imports, and the render is deterministic.

                The category colour language is kept — the surface, icon and
                arrow are still the topic's — so the image adds recognition
                rather than replacing the system.
              */}
              {/* Measured against the RENDERED card, not the min-height: the six
                  settle at ~230px once the longest description wraps, so the
                  band is 96px — 42%, inside the ruled 40-45%. */}
              <span className="relative block h-[112px] w-full shrink-0 overflow-hidden lg:h-[104px] xl:h-[108px]">
                <Image
                  src={`/images/topics/${module.id === 'world-intelligence' ? 'world' : module.id}.png`}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(min-width: 1024px) 200px, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                {/*
                  THE SCRIM IS BOTTOM-WEIGHTED, NOT A BLANKET.

                  The previous version ramped darkness across the whole frame,
                  which is half of why the Product Owner found the image area
                  "too dark and too close to the card tint, so the image area
                  reads as empty". The scene now keeps its own luminance for
                  the upper two thirds and only darkens where it meets the
                  title, which is the sole place the overlay has a job to do.

                  The module colour treatment is preserved by the card's own
                  surface gradient behind and below this image, and by the
                  accent on the icon and arrow — not by dimming the picture.
                */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,8,18,0)_0%,rgba(2,8,18,0)_46%,rgba(2,8,18,0.34)_70%,rgba(2,8,18,0.78)_90%,rgba(2,8,18,0.94)_100%)]"
                />
              </span>

              <span className="flex flex-1 flex-col p-[15px] pt-[13px] xl:p-[16px] xl:pt-[14px]">
                <span className="flex min-w-0 items-center gap-2 xl:gap-1.5">
                  <Icon
                    aria-hidden="true"
                    size={24}
                    strokeWidth={2.1}
                    className={`${accent.icon} shrink-0 drop-shadow-[0_0_10px_rgba(255,255,255,0.18)]`}
                  />
                  {/* Wraps rather than truncates: "Humanitarian" is the longest of the
                      six and losing its ending is worse than a second line. */}
                  <span className="block min-w-0 text-[16px] font-bold leading-[1.1] tracking-[-0.02em] text-white xl:text-[14px]">
                    {label}
                  </span>
                </span>
                {/*
                  The registry's own module summary where the dictionary gives
                  no short blurb, so this card and the module section can never
                  disagree about what a topic is.
                */}
                <span className="mt-[9px] line-clamp-3 text-[12.5px] leading-[1.42] text-[#9db2c9] xl:text-[12px]">
                  {summary}
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-auto ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full xl:h-8 xl:w-8 ${accent.arrow} transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0`}
                >
                  <ArrowRight size={17} strokeWidth={2.6} />
                </span>
              </span>
            </>
          );

          return (
            <li key={module.id} className="h-full">
              {navigable ? (
                <a
                  href={module.destination}
                  className={`${TOPIC_CARD_BASE} ${accent.surface} ${accent.hover}`}
                >
                  {body}
                </a>
              ) : (
                /*
                  Not a link, and it does not pretend to be one: no hover lift,
                  no pointer cursor, muted surface. The registry says this module
                  has no route, so the row says the same thing.
                */
                <span className={`${TOPIC_CARD_BASE} ${accent.surface} cursor-default opacity-65 hover:translate-y-0`}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>

    </section>
  );
}
