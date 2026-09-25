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
  readonly icon: string;
  readonly tile: string;
  readonly hover: string;
  readonly arrow: string;
}

const TOPIC_ACCENT: Record<string, TopicAccent> = {
  'world-intelligence': {
    icon: 'text-sky-300',
    tile: 'bg-sky-400/12 ring-1 ring-inset ring-sky-300/25',
    hover: 'hover:border-sky-400/50 hover:shadow-[0_18px_44px_-26px_rgba(56,189,248,0.75)]',
    arrow: 'bg-sky-500/85 text-white',
  },
  economy: {
    icon: 'text-violet-300',
    tile: 'bg-violet-400/12 ring-1 ring-inset ring-violet-300/25',
    hover: 'hover:border-violet-400/50 hover:shadow-[0_18px_44px_-26px_rgba(167,139,250,0.75)]',
    arrow: 'bg-violet-500/85 text-white',
  },
  energy: {
    icon: 'text-emerald-300',
    tile: 'bg-emerald-400/12 ring-1 ring-inset ring-emerald-300/25',
    hover: 'hover:border-emerald-400/50 hover:shadow-[0_18px_44px_-26px_rgba(52,211,153,0.75)]',
    arrow: 'bg-emerald-500/85 text-white',
  },
  security: {
    icon: 'text-rose-300',
    tile: 'bg-rose-400/12 ring-1 ring-inset ring-rose-300/25',
    hover: 'hover:border-rose-400/50 hover:shadow-[0_18px_44px_-26px_rgba(251,113,133,0.75)]',
    arrow: 'bg-rose-500/85 text-white',
  },
  humanitarian: {
    icon: 'text-amber-300',
    tile: 'bg-amber-400/12 ring-1 ring-inset ring-amber-300/25',
    hover: 'hover:border-amber-400/50 hover:shadow-[0_18px_44px_-26px_rgba(251,191,36,0.75)]',
    arrow: 'bg-amber-500/85 text-white',
  },
  market: {
    icon: 'text-cyan-300',
    tile: 'bg-cyan-400/12 ring-1 ring-inset ring-cyan-300/25',
    hover: 'hover:border-cyan-400/50 hover:shadow-[0_18px_44px_-26px_rgba(34,211,238,0.75)]',
    arrow: 'bg-cyan-500/85 text-white',
  },
};

const TOPIC_FALLBACK: TopicAccent = {
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
    <section aria-labelledby="beta-topics-heading" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="beta-topics-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink-primary sm:text-3xl"
        >
          {t.exploreTopicsTitle}
        </h2>
        <a
          href="#intelligence-modules"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          {t.viewAllTopics}
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3.5">
        {topics.map((module) => {
          const label =
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.title ?? module.id;
          const Icon = ICONS[module.icon];
          const accent = TOPIC_ACCENT[module.id] ?? TOPIC_FALLBACK;
          const summary =
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.description ?? '';
          const navigable = isModuleNavigable(module) && module.destination !== undefined;

          const body = (
            <>
              <span
                aria-hidden="true"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.tile}`}
              >
                <Icon size={21} strokeWidth={1.9} className={accent.icon} />
              </span>
              <span className="mt-3.5 block text-[15px] font-semibold leading-snug text-ink-primary">
                {label}
              </span>
              {/*
                The description is the registry's own module summary, clamped to
                the prototype's two lines. It is not a second copy of the text:
                the same string already renders in the modules section below, so
                the two can never disagree.
              */}
              <span className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-tertiary">
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
                  className={`group flex h-full min-h-[150px] flex-col items-start rounded-2xl border border-border-strong bg-void/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${accent.hover}`}
                >
                  {body}
                </a>
              ) : (
                /*
                  Not a link, and it does not pretend to be one: no hover lift,
                  no pointer cursor, muted surface. The registry says this module
                  has no route, so the row says the same thing.
                */
                <span className="group flex h-full min-h-[150px] cursor-default flex-col items-start rounded-2xl border border-dashed border-border-strong bg-void/30 p-4 opacity-70">
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
