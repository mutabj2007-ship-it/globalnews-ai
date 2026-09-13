'use client';

import type { WatchCapability } from '@/lib/map/monetization/watchModel';

/**
 * PART IV §9 — THE ASSESSMENT TIMELINE. HOW THE UNDERSTANDING MOVED.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT IS NOT A NEWS ARCHIVE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "It records how GlobalNewsAI's understanding moved. It is the clearest
 * available demonstration that work was done."
 *
 * The canonical transition vocabulary is closed and ordered:
 *
 *   FIRST DETECTED -> EVIDENCE ADDED -> PRECISION IMPROVED -> ASSESSMENT CHANGED
 *   -> DISPUTED -> CONFIRMED -> STABILISED
 *
 * §9 singles out one kind of entry as the most persuasive thing the product can
 * show: "COUNTRY -> CITY, provenance INTERPRETED -> STATED". Precision and
 * provenance movements are FIRST-CLASS entries, not metadata — they are the
 * product visibly getting better at knowing where something is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SHAPE IS FREE; THE CONTENT IS PROFESSIONAL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §9's free view is truncated to seven days, and earlier transitions are listed
 * BY DATE AND TITLE ONLY — "visible, countable, unopenable". §12.1 names this as
 * the SHAPE treatment, and §12.2 forbids the alternatives explicitly: "no blur,
 * no gradient fade".
 *
 * That is a deliberately generous lock. The user can see exactly how much work
 * exists and count it; what they cannot do is read it. A blur would hide the
 * quantity as well as the content and would make the product look like it was
 * concealing something rather than reserving it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A DRAWER, NEVER AN EXPANSION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §2.2: "The timeline is a drawer OVER the rail, never an expansion below it."
 * The collapsed strip below is what lives in the rail; opening it mounts a
 * `RailDrawer`, so the column never grows.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORDER IS DIFFERENT ON EACH SURFACE, AND THE MATRIX SAYS WHY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §16A: desktop is "oldest-first drawer over the rail"; mobile is
 * "NEWEST-FIRST so the current state is above the fold; free tail at the bottom".
 *
 * That is not an inconsistency. On desktop the drawer is full-height and the
 * whole arc is visible at once, so reading it as a narrative — first detected,
 * then improved, then confirmed — is what makes it persuasive. On a 620px phone
 * only three or four entries fit, and a reader opening it wants to know WHERE
 * THINGS STAND, not where they began. Same data, opposite ends, because the
 * question each surface answers is different.
 *
 * WHAT THIS BUILD SHOWS: no transition history service exists, so there are no
 * entries and the strip says so. It does not render a fabricated shape.
 */

export type TimelineTransition =
  | 'FIRST_DETECTED'
  | 'EVIDENCE_ADDED'
  | 'PRECISION_IMPROVED'
  | 'ASSESSMENT_CHANGED'
  | 'DISPUTED'
  | 'CONFIRMED'
  | 'STABILISED';

export const TIMELINE_TRANSITIONS: readonly TimelineTransition[] = [
  'FIRST_DETECTED',
  'EVIDENCE_ADDED',
  'PRECISION_IMPROVED',
  'ASSESSMENT_CHANGED',
  'DISPUTED',
  'CONFIRMED',
  'STABILISED',
];

export interface TimelineEntry {
  readonly id: string;
  readonly transition: TimelineTransition;
  readonly whenLabel: string;
  /** `null` where the entry is beyond the free window — SHAPE, not content. */
  readonly consequence: string | null;
  readonly title: string;
}

export interface TimelineLabels {
  readonly title: string;
  readonly openLabel: string;
  readonly transitions: Readonly<Record<TimelineTransition, string>>;
  readonly withheldTitle: string;
  readonly withheldBody: string;
  readonly proMark: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly countLabel: string;
}

/** The collapsed strip that lives in the rail. One line, never an expansion. */
export function AssessmentTimelineStrip({
  count,
  labels,
  onOpen,
}: {
  readonly count: number;
  readonly labels: TimelineLabels;
  readonly onOpen: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-gn="timeline-strip"
      onClick={onOpen}
      className="flex min-h-[38px] w-full items-center justify-between gap-[8px] rounded-[2px] border border-sp-line-2 px-[10px] py-[8px] text-start outline-none transition-[color,background-color,border-color] duration-[140ms] hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.08] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-cyan"
    >
      <span className="font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-ui-idle">
        {labels.title}
      </span>
      <span className="font-gn-mono text-[9px] tabular-nums text-sp-ink-3">
        {count > 0 ? `${count} ${labels.countLabel}` : labels.openLabel}
      </span>
    </button>
  );
}

export interface AssessmentTimelineProps {
  readonly entries: readonly TimelineEntry[];
  readonly withheldCount: number;
  readonly capability: WatchCapability;
  readonly labels: TimelineLabels;
  /**
   * §16A. `OLDEST_FIRST` on desktop, `NEWEST_FIRST` on compact.
   *
   * Required rather than defaulted: a default would let one surface silently
   * inherit the other's reading order, and the two are opposite on purpose.
   */
  readonly order: 'OLDEST_FIRST' | 'NEWEST_FIRST';
}

export function AssessmentTimeline({
  entries,
  withheldCount,
  labels,
  order,
}: AssessmentTimelineProps): JSX.Element {
  /*
    Entries arrive oldest-first from the producer, which is the order the history
    happened in. Compact reverses a COPY — mutating the caller's array would
    reorder it for every other surface reading the same history.
  */
  const ordered = order === 'NEWEST_FIRST' ? [...entries].reverse() : entries;
  return (
    <div data-gn="assessment-timeline" className="flex flex-col gap-[12px]">
      {ordered.length === 0 ? (
        <div data-gn="timeline-empty">
          <h3 className="font-gn-mono text-[10px] uppercase tracking-[0.12em] text-sp-ink-2">
            {labels.emptyTitle}
          </h3>
          <p className="mt-[6px] text-[11.5px] leading-[1.55] text-sp-ink-3">{labels.emptyBody}</p>
        </div>
      ) : (
        <ol data-gn-order={order} className="flex flex-col">
          {ordered.map((entry) => (
            <li
              key={entry.id}
              data-gn="timeline-entry"
              data-gn-transition={entry.transition}
              data-gn-withheld={entry.consequence === null ? 'true' : 'false'}
              className="relative border-s border-sp-line-2 py-[8px] ps-[13px]"
            >
              <span
                aria-hidden="true"
                className="absolute left-[-3.5px] top-[13px] block h-[6px] w-[6px] rounded-full border border-sp-line-2 bg-sp-panel"
              />
              <div className="flex items-baseline gap-[8px]">
                <span className="font-gn-mono text-[8.5px] uppercase tracking-[0.12em] text-sp-ink-3">
                  {entry.whenLabel}
                </span>
                <span className="font-gn-mono text-[9px] uppercase tracking-[0.1em] text-sp-ink-2">
                  {labels.transitions[entry.transition]}
                </span>
              </div>
              {/*
                SHAPE, NOT BLUR. Beyond the free window the entry keeps its date
                and its title and loses only its consequence line — visible,
                countable, unopenable, exactly as §9 requires.
              */}
              <p className="mt-[3px] text-[11.5px] leading-[1.5] text-sp-ink-2">
                {entry.consequence ?? entry.title}
              </p>
            </li>
          ))}
        </ol>
      )}

      {withheldCount > 0 && (
        <div
          data-gn="timeline-withheld"
          className="border-s-2 border-sp-capability-line bg-sp-panel-2 py-[10px] ps-[11px] pe-[10px]"
        >
          <h3 className="flex items-center gap-[7px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-capability">
            {labels.withheldTitle}
            <span
              data-gn="tier-mark"
              data-gn-tier="PRO"
              className="rounded-[2px] border border-sp-capability-line px-[4px] py-px text-[8px] tracking-[0.12em]"
            >
              {labels.proMark}
            </span>
          </h3>
          <p className="mt-[5px] text-[11.5px] leading-[1.55] text-sp-ink-2">
            {labels.withheldBody}
          </p>
        </div>
      )}
    </div>
  );
}
