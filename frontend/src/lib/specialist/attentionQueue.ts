import type { SpecialistDomainId } from '@/lib/specialist/specialistDomain';

/**
 * SHARED · RAIL — THE ATTENTION QUEUE CONTRACT FOR ContextSummaryPanel.
 *
 *     ruling     Part V C·2 — shared component, domain-aware ordering,
 *                shell FROZEN
 *     contract   Shared Specialist Addendum §15
 *
 * C·2, verbatim: "The panel's layout, interaction model and shell remain
 * frozen; Conflict supplies a domain-specific ranking input and the panel
 * consumes an UPSTREAM ORDERED RESULT. No Conflict ranking engine inside the UI
 * component, and no separate Conflict panel."
 *
 * ── SO THIS MODULE SORTS NOTHING ──────────────────────────────────────────
 *
 * There is no comparator here, and `items` is consumed in the order it arrives.
 * The ranking rule ("severity, then change recency") is DECLARED in the domain
 * config so it can be read and cited, and applied upstream by the shared
 * assessment service. A guard asserts this module contains no sort.
 *
 * The temptation is strong and worth naming: the data to sort by is right
 * there on each item. Sorting it here would work, and would put a second
 * ranking authority in the product the first time the upstream rule changed.
 *
 * ── AND THE HOLDING LINE IS A RESULT ──────────────────────────────────────
 *
 * §15: "The checked-and-holding line is a RESULT, never an empty state."
 * Part IV's version is blunter — this line is what the user is paying for.
 * `emptyIsResult` is fixed `true` for that reason: it is not configurable,
 * because a domain configuring it to `false` would be turning the product's
 * paid output back into an empty state.
 */

export interface AttentionQueueItem {
  readonly id: string;
  readonly label: string;
  /** Domain-scoped state token — `CONFLICT:SIGNIFICANT_CHANGE`. */
  readonly stateToken?: string;
  /** Free-text state word. Always present when a mark is shown — never colour alone. */
  readonly stateLabel?: string;
  /** Domain-configured severity or equivalent. Rendered typographically. */
  readonly emphasis?: string;
  readonly summary?: string;
  /** The dense metadata line the rail already speaks in. */
  readonly meta?: string;
  /**
   * The upstream rank. READ, NEVER COMPUTED — see this file's header.
   * Present so the panel can prove it consumed an ordered result rather than
   * having produced one.
   */
  readonly attentionRank?: number;
  /** C·4 state inheritance: a queued row renders at reduced weight when the
   *  same amber state is already at full strength on the selected object. */
  readonly amberInherited?: boolean;
}

export interface AttentionQueue {
  readonly domain: SpecialistDomainId;
  readonly headerLabel: string;
  readonly headerCount: number;
  readonly items: readonly AttentionQueueItem[];
  readonly holdingLabel: string;
  readonly holdingCount: number;
  readonly holdingItems: readonly AttentionQueueItem[];
  /** Where selection returns to. The 34px return header target. */
  readonly returnTargetRef?: string;
  /** Fixed. See the header. */
  readonly emptyIsResult: true;
  /**
   * The rule the UPSTREAM service applied, stated for the record.
   * Declarative only; nothing here executes it.
   */
  readonly orderedBy: string;
}

/**
 * Whether the queue was genuinely ordered upstream.
 *
 * Used by guards and by the panel's own dev-time assertion. A queue whose items
 * carry no rank has not been through the shared assessment service, and the
 * honest rendering of that is the unavailable state — not a locally sorted list
 * that looks identical and is not the same thing.
 */
export function queueWasOrderedUpstream(queue: AttentionQueue): boolean {
  return queue.items.every((item) => typeof item.attentionRank === 'number');
}

/** Total subjects the queue speaks for — attention plus holding. */
export function queueSubjectCount(queue: AttentionQueue): number {
  return queue.items.length + queue.holdingItems.length;
}
