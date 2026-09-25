import type { JSX } from 'react';
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
interface TopicAccent {
  readonly surface: string;
  readonly icon: string;
  readonly tile: string;
  readonly hover: string;
  readonly arrow: string;
}

const TOPIC_ACCENT: Record<string, TopicAccent> = {
  'world-intelligence': {
    surface: 'bg-gradient-to-b from-sky-500/30 to-sky-700/12',
    icon: 'text-sky-200',
    tile: 'bg-sky-400/30 ring-1 ring-inset ring-sky-300/55',
    hover: 'hover:border-sky-400/50 hover:shadow-[0_18px_44px_-26px_rgba(56,189,248,0.75)]',
    arrow: 'bg-sky-500 text-white',
  },
  economy: {
    surface: 'bg-gradient-to-b from-violet-500/30 to-violet-700/12',
    icon: 'text-violet-200',
    tile: 'bg-violet-400/30 ring-1 ring-inset ring-violet-300/55',
    hover: 'hover:border-violet-400/50 hover:shadow-[0_18px_44px_-26px_rgba(167,139,250,0.75)]',
    arrow: 'bg-violet-500 text-white',
  },
  energy: {
    surface: 'bg-gradient-to-b from-emerald-500/30 to-emerald-700/12',
    icon: 'text-emerald-200',
    tile: 'bg-emerald-400/30 ring-1 ring-inset ring-emerald-300/55',
    hover: 'hover:border-emerald-400/50 hover:shadow-[0_18px_44px_-26px_rgba(52,211,153,0.75)]',
    arrow: 'bg-emerald-500 text-white',
  },
  security: {
    surface: 'bg-gradient-to-b from-rose-500/30 to-rose-700/12',
    icon: 'text-rose-200',
    tile: 'bg-rose-400/30 ring-1 ring-inset ring-rose-300/55',
    hover: 'hover:border-rose-400/50 hover:shadow-[0_18px_44px_-26px_rgba(251,113,133,0.75)]',
    arrow: 'bg-rose-500 text-white',
  },
  humanitarian: {
    surface: 'bg-gradient-to-b from-amber-500/30 to-amber-700/12',
    icon: 'text-amber-200',
    tile: 'bg-amber-400/30 ring-1 ring-inset ring-amber-300/55',
    hover: 'hover:border-amber-400/50 hover:shadow-[0_18px_44px_-26px_rgba(251,191,36,0.75)]',
    arrow: 'bg-amber-500 text-white',
  },
  market: {
    surface: 'bg-gradient-to-b from-cyan-500/30 to-cyan-700/12',
    icon: 'text-cyan-200',
    tile: 'bg-cyan-400/30 ring-1 ring-inset ring-cyan-300/55',
    hover: 'hover:border-cyan-400/50 hover:shadow-[0_18px_44px_-26px_rgba(34,211,238,0.75)]',
    arrow: 'bg-cyan-500 text-white',
  },
};

const TOPIC_FALLBACK: TopicAccent = {
  surface: 'bg-white/[0.03]',
  icon: 'text-ink-secondary',
  tile: 'bg-white/5 ring-1 ring-inset ring-white/10',
  hover: 'hover:border-cyan-400/40',
  arrow: 'bg-white/15 text-ink-primary',
};

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="beta-topics-heading"
          className="font-display text-[22px] font-semibold tracking-tight text-ink-primary sm:text-2xl"
        >
          {t.exploreTopicsTitle}
        </h2>
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
          className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1 text-sm font-semibold text-ink-tertiary lg:min-h-[32px]"
        >
          {t.viewAllTopics}
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary/70">
            {t.viewAllTopicsPending}
          </span>
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3.5">
        {topics.map((module) => {
          /* The prototype's short name where it gives one; the registry's
             title otherwise. The label never decides the destination. */
          const label =
            t.topicLabels[module.id] ??
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.title ??
            module.id;
          const Icon = ICONS[module.icon];
          const accent = TOPIC_ACCENT[module.id] ?? TOPIC_FALLBACK;
          const summary =
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.description ?? '';
          const navigable = isModuleNavigable(module) && module.destination !== undefined;

          const body = (
            <>
              <span
                aria-hidden="true"
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.tile}`}
              >
                <Icon size={23} strokeWidth={1.9} className={accent.icon} />
              </span>
              <span className="mt-3 block text-[15px] font-semibold leading-snug text-ink-primary">
                {label}
              </span>
              {/*
                The description is the registry's own module summary, clamped to
                the prototype's two lines. It is not a second copy of the text:
                the same string already renders in the modules section below, so
                the two can never disagree.
              */}
              <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-tertiary">
                {summary}
              </span>
              <span
                aria-hidden="true"
                className={`mt-auto ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full ${accent.arrow} transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0`}
              >
                <ArrowRight size={15} strokeWidth={2.4} />
              </span>
            </>
          );

          return (
            <li key={module.id} className="h-full">
              {navigable ? (
                <a
                  href={module.destination}
                  className={`group flex h-full min-h-[132px] flex-col items-start rounded-2xl border border-white/[0.10] ${accent.surface} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${accent.hover}`}
                >
                  {body}
                </a>
              ) : (
                /*
                  Not a link, and it does not pretend to be one: no hover lift,
                  no pointer cursor, muted surface. The registry says this module
                  has no route, so the row says the same thing.
                */
                <span className="group flex h-full min-h-[132px] cursor-default flex-col items-start rounded-2xl border border-dashed border-border-strong bg-void/30 p-4 opacity-70">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-ink-tertiary">{t.exploreTopicsNote}</p>
    </section>
  );
}
