import type { SourceCorroborationClass } from '@globalnews-ai/shared';

import { FEED_SOURCES, type FeedSourceEntry } from './feed-source-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLISHER FEEDS — CORROBORATION AUTHORITY, BY EXPLICIT FEED IDENTITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS REPLACES, AND WHY IT HAD TO BE REPLACED.
 *
 * R1 answered "may this source corroborate journalism?" from `SourceType`:
 * `NEWS_PROVIDER -> LOCAL_JOURNALISM`. The recovered C55 definition of that
 * member says, verbatim, *"a news aggregator or wire API — GNews, GDELT DOC,
 * Event Registry articles."* So the inference classified two global aggregators
 * as local newsrooms.
 *
 * THE CONSEQUENCE, CONCRETELY. Wire copy reaches this pipeline through more
 * than one aggregator. If aggregators counted as local journalism, one agency
 * filing arriving via GNews and again via GDELT DOC would read as two
 * independent local newsrooms confirming each other — manufactured
 * corroboration, produced by the very vocabulary added to prevent it.
 *
 * THE ERROR WAS SCOPE. `SourceType` is a property of EVERY record in the
 * pipeline. Corroboration class is a claim about a SPECIFIC publisher that
 * someone fetched, read and verified on a stated date. A three-member union
 * over the whole world cannot carry a judgement that was only ever made about
 * six named feeds.
 *
 * ── SO THIS MODULE DECLARES, IT DOES NOT DERIVE ─────────────────────────────
 *
 * The mapping below is keyed by the registry's own `sourceId`. There is no rule
 * here that could be applied to a source nobody has assessed: an id that is not
 * in this table has no class, and a source with no class contributes no
 * journalistic corroboration. **FAIL-CLOSED IS THE WHOLE DESIGN.**
 *
 * That is what makes the negative cases structural rather than incidental:
 *
 *   'gnews'         not in the table -> undefined -> contributes nothing
 *   'gdelt-doc'     not in the table -> undefined -> contributes nothing
 *   a future feed   not in the table -> undefined -> contributes nothing
 *
 * None of those is a special case, an exclusion list, or a name this module
 * knows. They are the default, and the six curated feeds are the exception.
 *
 * ── WHY IT LIVES HERE AND NOT IN `shared/` ──────────────────────────────────
 *
 * `shared/src/source-type.ts` carries the VOCABULARY; this carries the
 * JUDGEMENT about named publishers. Feed identities belong to the feeds lane,
 * beside the registry that defines them, so the two cannot drift apart and no
 * consumer outside this lane can acquire an opinion about a feed it has never
 * heard of.
 *
 * ── THE RECOVERED REGISTRY BLOB IS NOT TOUCHED ──────────────────────────────
 *
 * `feed-source-registry.ts` remains byte-identical to canonical C55
 * (`e6a73bf6082912f05dc2063170f682529d92cce4`). This is an ADDITIVE table
 * beside it, not an added field inside it — the recovery rule was "recover, do
 * not recreate", and editing a recovered blob to append a column would have
 * broken it for a value that can be declared alongside instead.
 */

/**
 * The six recovered publishers, classified individually.
 *
 * `Record<string, ...>` and not a mapped type over the registry, deliberately:
 * a mapped type would make every FUTURE registry entry a compile error until
 * someone classified it, which sounds strict and is the wrong strictness. It
 * would pressure whoever adds a feed into picking a class to make the build
 * pass. Absence here is already the safe answer, and it stays the safe answer
 * without anyone being pushed into a judgement they have not made.
 */
const FEED_CORROBORATION_CLASS: Readonly<Record<string, SourceCorroborationClass>> = {
  /* ── Individually verified newsrooms, filing their own journalism ── */
  'feed:ktpress-rw': 'LOCAL_JOURNALISM',
  'feed:taarifa-rw': 'LOCAL_JOURNALISM',
  'feed:standardmedia-ke': 'LOCAL_JOURNALISM',
  'feed:wp-pl': 'LOCAL_JOURNALISM',

  /* ── Institutions publishing about their own acts ── */
  'feed:cbk-ke': 'OFFICIAL_PUBLIC',
  'feed:gus-pl': 'OFFICIAL_PUBLIC',
};

/**
 * The corroboration class of a source, or `undefined` when this authority has
 * no opinion about it.
 *
 * `undefined` IS A MEANINGFUL ANSWER AND MUST NOT BE COALESCED. It says "no
 * curated assessment exists", which is exactly right for an aggregator, for a
 * provider id, and for any feed added after this table was written. Defaulting
 * it to either class would reintroduce the R1 defect from the other end.
 */
export function corroborationClassForFeed(
  sourceId: string | undefined,
): SourceCorroborationClass | undefined {
  if (sourceId === undefined) return undefined;

  return FEED_CORROBORATION_CLASS[sourceId];
}

/**
 * THE PREDICATE THE RULE IS ACTUALLY ABOUT.
 *
 * True only for a source this authority has explicitly classified as an
 * individually verified newsroom. Everything else — an aggregator, an
 * institution, an unclassified feed, an unknown id, `undefined` — is false.
 *
 * It consumes FEED IDENTITY, never `SourceType`. There is no argument you can
 * pass that makes `'gnews'` true.
 */
export function contributesJournalisticCorroboration(sourceId: string | undefined): boolean {
  return corroborationClassForFeed(sourceId) === 'LOCAL_JOURNALISM';
}

/**
 * Which registry entries carry a classification, for health and audit output.
 *
 * Derived from the registry rather than from the table's own keys, so an id
 * classified here that no longer exists in the registry simply stops appearing
 * instead of being reported as a live publisher.
 */
export function classifiedFeedSources(): readonly FeedSourceEntry[] {
  return FEED_SOURCES.filter((entry) => corroborationClassForFeed(entry.sourceId) !== undefined);
}

/**
 * The ids this authority knows, exported so a spec asserts the SAME table the
 * product uses rather than a second copy of it.
 */
export const CLASSIFIED_FEED_IDS: readonly string[] = Object.keys(FEED_CORROBORATION_CLASS);
