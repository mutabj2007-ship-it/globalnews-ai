/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE D1 DOMAIN BIND — MAIN-CONFLICT-D1-DOMAIN-BIND-R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PROPOSED for `frontend/src/lib/map/d1/conflictDomainBind.ts`.
 * Nothing lands without authorization. No provider. No activation. No deployment.
 *
 * `MapDomainEntry { domain: 'CONFLICT' }`  ->  the accepted D1 workspace.
 *
 * ── THE BIND IS ONE PROP, AND THE AUTHORITY ALREADY SAYS SO ───────────────
 *
 * Part V C·2, quoted inside the landed `ContextSummaryPanel` and inside the
 * landed `attentionQueue.ts`:
 *
 *     "The panel's layout, interaction model and shell remain FROZEN; Conflict
 *      supplies a domain-specific ranking input and the panel consumes an
 *      UPSTREAM ORDERED RESULT. No Conflict ranking engine inside the UI
 *      component, and NO SEPARATE CONFLICT PANEL."
 *
 * The panel's own docblock states the mechanism: "the queue arrives as ONE
 * OPTIONAL PROP. With `queue` absent this component's behaviour is untouched
 * and is the World/Country domain's own configuration."
 *
 * So there is nothing to design here. The seam was built, accepted and frozen
 * before this round, and the entire bind is: WHICH VALUE GOES IN THAT PROP.
 *
 *   NO new panel        C·2 forbids it
 *   NO new rail         `IntelligenceRightRail` is a container; it hosts what it
 *                       is handed and "does not know what a selection is"
 *   NO mode change      the domain is not a projection; mode stays WORLD
 *   NO recovered files  nothing from `lib/map/conflict/` is required to bind
 *
 * ── AND IN DATA-NEUTRAL STATE THE QUEUE IS EMPTY, WHICH IS A RESULT ───────
 *
 * `MAIN-CONFLICT-RUNTIME-CONTRACT-R1` refused MCR-15 (`attentionRank`) for R1:
 * no producer exists, so the unavailable state is the honest rendering rather
 * than an invented rank. `attentionQueue.ts` fixes `emptyIsResult: true` and
 * says why: §15's "checked-and-holding line is a RESULT, never an empty state",
 * and a domain configuring it to `false` "would be turning the product's paid
 * output back into an empty state."
 *
 * So the bind produces a queue with no items, and the panel renders the result
 * line it already renders. Nothing new is drawn.
 */

import type { MapDomainEntry } from '@/lib/map/state/mapDomainEntry';
import type { MapShellVariant } from '@/lib/map/mapShellFlag';
import type { AttentionQueue } from '@/lib/specialist/attentionQueue';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1 · THE THREE CASES, AS A CLOSED UNION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A closed union rather than a nullable presentation, because the three cases
 * are three different facts and a consumer that cannot tell them apart cannot
 * report honestly which one it hit (A-24).
 *
 *   BOUND       modern shell + domain=conflict   the D1 workspace, Conflict
 *   NO_DOMAIN   modern shell + no domain         Country's /map, byte-untouched
 *   REFUSED     legacy shell + domain=conflict   an honest failure, never Country
 */
export type D1BindRefusal =
  /**
   * THE ONE THAT MATTERS. `NEXT_PUBLIC_MAP_SHELL` is default OFF and that
   * default is an accepted rollback property — `mapShellFlag.ts`: "A flag whose
   * failure mode is 'ship the new thing' is not a rollback mechanism."
   *
   * On the legacy variant `/map` mounts the legacy `WorldMap`: no D1
   * composition, no HUD, no rail, no panel. There is no surface to bind to.
   *
   * Returning a presentation anyway would render COUNTRY INTELLIGENCE UNDER A
   * CONFLICT URL, which is the precise failure this round is required to
   * prevent. So the outcome is a named refusal a caller must handle, not a
   * silent fallback it can ignore.
   */
  'D1_WORKSPACE_NOT_MOUNTED';

export type D1BindOutcome =
  | { readonly kind: 'BOUND'; readonly presentation: ConflictD1Presentation }
  | { readonly kind: 'NO_DOMAIN' }
  | { readonly kind: 'REFUSED'; readonly reason: D1BindRefusal };

/* ═══════════════════════════════════════════════════════════════════════════
 * 2 · WHAT BEING BOUND CONSISTS OF — AND WHAT IT CANNOT CONSIST OF
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * THE ASSESSMENT RAIL'S STATE, NAMED RATHER THAN OMITTED.
 *
 * Part V §07.2 governs it: "The rail SWAPPED, not extended. SELECTION replaces
 * the attention queue with this card and leaves a 34px return header."
 *
 * The mount condition is therefore a SELECTED CONFLICT SUBJECT, not the domain.
 * A domain entry selects nothing — the entry URL carries no `sel` at all — so
 * there is no subject, and the rail does not mount.
 *
 * That absence is given a name instead of being left implicit, because
 * "the rail is not on screen" and "the rail is on screen with nothing in it"
 * are different facts and only one of them is true here.
 */
export type ConflictAssessmentRailState = 'NOT_MOUNTED_NO_SUBJECT';

/**
 * The whole of the Conflict presentation.
 *
 * ── ENFORCEMENT BY ABSENCE, AND EXACTLY WHAT IT FORBIDS ───────────────────
 *
 * The round's four prohibitions are structural here, not remembered:
 *
 *   an incident exists          there is no incident field, and `queue.items`
 *                               is built empty by `bindConflictD1` from no input
 *   severity exists             there is no severity field. `ConflictSeverity`
 *                               is not imported and cannot be
 *   a watched situation exists  there is no watch field. Part V's own
 *                               `conflictWatchScopeAvailability` returns HOLD or
 *                               UNSUPPORTED in every branch it has
 *   UCDP is active              this module is a pure function. It has no
 *                               fetch, no client, no provider and no async
 *
 * A probe asserts the type carries no such field and that the module's
 * executable bytes name none of those concepts.
 */
export interface ConflictD1Presentation {
  readonly domain: 'CONFLICT';
  /** The ONE prop. Goes to the frozen `ContextSummaryPanel`, nowhere else. */
  readonly queue: AttentionQueue;
  readonly assessmentRail: ConflictAssessmentRailState;
}

/**
 * The copy the bind needs and refuses to invent.
 *
 * Three display strings, supplied by the caller from the EN/PL dictionaries,
 * because a `lib/` module that wrote its own English would be a second copy
 * authority and would not have a Polish half.
 *
 * `orderedBy` is `attentionQueue.ts`'s "rule the UPSTREAM service applied,
 * stated for the record". With MCR-15 refused there is no upstream service, so
 * the dictionary string must say that — it must NOT name a ranking rule the
 * product did not apply.
 */
export interface ConflictD1Labels {
  readonly headerLabel: string;
  readonly holdingLabel: string;
  readonly orderedBy: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3 · THE BIND
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The data-neutral Conflict queue.
 *
 * THE COUNTS ARE DERIVED, NEVER ACCEPTED. `headerCount` and `holdingCount` are
 * computed from the arrays rather than taken as parameters, so a caller has no
 * way to state a count that disagrees with the list it ships beside. A count
 * that can be written by hand is a count that will one day be wrong by hand.
 */
function dataNeutralConflictQueue(labels: ConflictD1Labels): AttentionQueue {
  const items: readonly [] = [];
  const holdingItems: readonly [] = [];

  return {
    domain: 'CONFLICT',
    headerLabel: labels.headerLabel,
    headerCount: items.length,
    items,
    holdingLabel: labels.holdingLabel,
    holdingCount: holdingItems.length,
    holdingItems,
    /* Fixed `true` by the contract. Not this module's to choose. */
    emptyIsResult: true,
    orderedBy: labels.orderedBy,
  };
}

/**
 * Bind a domain entry to the D1 workspace.
 *
 * TOTAL over its inputs, and PURE: no router, no history, no window, no fetch.
 * It reads two values and returns one of three outcomes.
 *
 * `entry` is the `MapDomainEntry | null` the accepted
 * `MAIN-CONFLICT-DISTINCT-ENTRY-SEAM-R1` codec already produces from the URL.
 * `null` is Country's entry and stays Country's entry.
 */
export function bindConflictD1(
  entry: MapDomainEntry | null,
  variant: MapShellVariant,
  labels: ConflictD1Labels,
): D1BindOutcome {
  /*
    NO DOMAIN IS CHECKED FIRST, AND ON PURPOSE.

    Country's `/map` must behave identically on both variants, so the absence of
    the key returns before the variant is ever consulted. A legacy `/map` with no
    domain is NO_DOMAIN, not a refusal — there is nothing to refuse.
  */
  if (entry === null) return { kind: 'NO_DOMAIN' };

  /*
    THE HONEST FAILURE. Not a fallback, not a degraded render, not Country with a
    different label: a named refusal the caller must destructure to get past.
  */
  if (variant !== 'shell') {
    return { kind: 'REFUSED', reason: 'D1_WORKSPACE_NOT_MOUNTED' };
  }

  /*
    CONFLICT IS THE ONLY DOMAIN THIS ROUND BINDS.

    The other five members of `SpecialistDomainId` are reserved identities with
    no accepted D1 presentation, and binding them here would claim one. They
    refuse through the same door rather than through a second mechanism.
  */
  if (entry.domain !== 'CONFLICT') {
    return { kind: 'REFUSED', reason: 'D1_WORKSPACE_NOT_MOUNTED' };
  }

  return {
    kind: 'BOUND',
    presentation: {
      domain: 'CONFLICT',
      queue: dataNeutralConflictQueue(labels),
      assessmentRail: 'NOT_MOUNTED_NO_SUBJECT',
    },
  };
}

/**
 * The `queue` prop for `ContextSummaryPanel`, and the whole of what the D1
 * workspace changes.
 *
 * `null` for NO_DOMAIN and for REFUSED, which is the value the panel's docblock
 * calls "the World/Country domain's own configuration" — so a refused bind
 * cannot accidentally become a Conflict render. The caller still has to handle
 * REFUSED for the surface to be honest; this helper exists so that forgetting
 * to handle it fails CLOSED rather than open.
 */
export function contextPanelQueueFor(outcome: D1BindOutcome): AttentionQueue | null {
  return outcome.kind === 'BOUND' ? outcome.presentation.queue : null;
}
