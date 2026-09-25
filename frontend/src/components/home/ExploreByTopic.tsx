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
const TOPIC_ACCENT: Record<string, string> = {
  'world-intelligence': 'text-emerald-300',
  economy: 'text-emerald-300',
  energy: 'text-amber-300',
  security: 'text-orange-300',
  humanitarian: 'text-purple-300',
  market: 'text-cyan-300',
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
          className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          {t.viewAllTopics}
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {topics.map((module) => {
          const label =
            moduleText[module.dictionaryKey as keyof typeof moduleText]?.title ?? module.id;
          const Icon = ICONS[module.icon];
          const accent = TOPIC_ACCENT[module.id] ?? 'text-ink-secondary';
          const navigable = isModuleNavigable(module) && module.destination !== undefined;

          const body = (
            <>
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" className={`shrink-0 ${accent}`} />
              <span className="text-sm font-medium leading-snug text-ink-primary">{label}</span>
            </>
          );

          return (
            <li key={module.id} className="h-full">
              {navigable ? (
                <a
                  href={module.destination}
                  className="flex h-full min-h-[92px] flex-col items-start gap-2 rounded-2xl border border-border-strong bg-void/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {body}
                </a>
              ) : (
                /*
                  Not a link, and it does not pretend to be one: no hover lift,
                  no pointer cursor, muted surface. The registry says this module
                  has no route, so the row says the same thing.
                */
                <span className="flex h-full min-h-[92px] cursor-default flex-col items-start gap-2 rounded-2xl border border-dashed border-border-strong bg-void/30 p-4 opacity-70">
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
