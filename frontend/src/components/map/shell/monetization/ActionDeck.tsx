'use client';

import { useState } from 'react';
import type { Tier } from '@/lib/map/monetization/watchModel';

/**
 * PART IV §10 — THE ACTION DECK. ALL HIGH-COST AI IN ONE COLLAPSED CLUSTER.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS COLLAPSED, AT THE EDGE, AND NEVER IN THE READING PATH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "All high-cost AI lives in ONE collapsed cluster at the bottom-right of the
 * map. NEVER INLINE IN THE READING PATH." And: "Normal map navigation,
 * selection, hover and the intelligence card spend nothing and must never carry
 * sand."
 *
 * That is what keeps the free product free-feeling. A reader moving around the
 * map, selecting a country and reading its assessment never encounters a
 * priced control; every one of them is behind a deliberate click, in a corner
 * they went to on purpose.
 *
 * DELIBERATENESS RULES, implemented literally:
 *   - the deck opens on CLICK, never on hover
 *   - every action STATES ITS COST BEFORE IT RUNS — no silent spend
 *   - cost appears on the CONTROL, never on the output
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SAND, AND THE ONE THING IT MAY NOT TOUCH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sand marks a control that spends metered compute. It appears on the invoking
 * control and nowhere else — results render in ordinary ink, because a finished
 * analysis is content the user owns and pricing the output would charge them
 * twice in the interface.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT IS AN ANCHORED POPUP, AND TEMPORARY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §16.4 classes it TEMPORARY — "collapsed by default", dismissing to "prior
 * state, NOTHING SPENT". So it is anchored to its own control, dismissible by
 * clicking away, and it leaves no trace: closing it cannot have cost anything,
 * because nothing spends without an explicit Run that stated the cost first.
 *
 * ON COMPACT IT CONFIRMS ONE ACTION AT A TIME. §16A's mobile column is
 * explicit — "anchored popup; ONE ACTION PER CONFIRM" — which is why choosing an
 * action opens the cost prompt rather than running it. A list of eight priced
 * controls on a 390px screen is a place to mis-tap, and a mis-tap that spends
 * compute is the one mistake this deck exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GHOSTING, AND WHAT THIS BUILD CAN HONESTLY RUN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Tier-locked actions "remain in place, in order, readable, at 45% opacity with
 * a violet left edge and a PRO or INST mark. They are NOT REMOVED and NOT
 * BLURRED: the user can see what the product does before deciding to pay."
 *
 * NOTHING here is invocable, and the reason is the contract rather than the
 * capability: the Analysis system exists, but the monetized deep-analysis
 * activation and entitlement contract is not configured, so no action is
 * authorised to spend. Every action renders as a preview and the deck says so
 * once, at the foot, rather than failing per control. The meter reads as unset
 * rather than as a fabricated allowance: an invented "3 / 5 THIS MONTH" would be
 * a commercial claim.
 */

export interface DeckAction {
  readonly id: string;
  /** §10's stated cost, in actions. Rendered on the control, before it runs. */
  readonly cost: number;
  /** `null` = available to all tiers. */
  readonly tier: Exclude<Tier, 'FREE'> | null;
  /** Some actions require a Watch to exist first. */
  readonly requiresWatch?: boolean;
}

export interface ActionDeckLabels {
  readonly open: string;
  readonly title: string;
  readonly close: string;
  readonly actions: Readonly<Record<string, string>>;
  readonly costUnit: string;
  readonly tierMark: Readonly<Record<'PROFESSIONAL' | 'INSTITUTIONAL', string>>;
  readonly requiresWatch: string;
  readonly meterUnset: string;
  readonly previewNote: string;
}

export interface ActionDeckProps {
  readonly actions: readonly DeckAction[];
  readonly labels: ActionDeckLabels;
  readonly hasWatch: boolean;
  /**
   * Compact confirms ONE action at a time (§16A mobile column), so choosing
   * one opens the cost prompt instead of listing them all as pressable.
   */
  readonly onChooseAction?: (id: string) => void;
}

export function ActionDeck({
  actions,
  labels,
  hasWatch,
  onChooseAction,
}: ActionDeckProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div data-gn="action-deck" data-gn-open={open ? 'true' : 'false'} className="pointer-events-none flex flex-col items-end gap-[6px]">
      {open && (
        <div
          data-gn="action-deck-panel"
          role="group"
          aria-label={labels.title}
          className="pointer-events-auto w-[262px] rounded-[3px] border border-sp-line-2 bg-sp-panel/95 p-[10px] backdrop-blur-[6px]"
        >
          <h3 className="mb-[8px] font-gn-mono text-[9px] uppercase tracking-[0.14em] text-sp-ink-3">
            {labels.title}
          </h3>

          <ul className="flex flex-col gap-[3px]">
            {actions.map((action) => {
              const locked = action.tier !== null;
              const watchMissing = action.requiresWatch === true && !hasWatch;

              return (
                <li key={action.id}>
                  <button
                    type="button"
                    data-gn="deck-action"
                    data-gn-action={action.id}
                    data-gn-locked={locked ? 'true' : 'false'}
                    /*
                      CHOOSING IS NOT RUNNING. A tier-locked action stays inert;
                      an available one opens the cost prompt, which is the only
                      place a Run can be pressed. Nothing here spends.
                    */
                    disabled={locked || onChooseAction === undefined}
                    onClick={() => { if (!locked) onChooseAction?.(action.id); }}
                    className={`flex w-full items-center justify-between gap-[8px] rounded-[2px] border px-[9px] py-[8px] text-start transition-colors ${
                      locked
                        ? 'cursor-default border-s-2 border-l-sp-capability-line border-y-sp-line-3 border-r-sp-line-3 opacity-45'
                        : 'cursor-default border-sp-line-3'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] text-sp-ink-2">
                        {labels.actions[action.id] ?? action.id}
                      </span>
                      {watchMissing && (
                        <span className="mt-[2px] block font-gn-mono text-[8px] uppercase tracking-[0.1em] text-sp-ink-3">
                          {labels.requiresWatch}
                        </span>
                      )}
                    </span>

                    {locked ? (
                      <span
                        data-gn="tier-mark"
                        data-gn-tier={action.tier === 'PROFESSIONAL' ? 'PRO' : 'INST'}
                        className="shrink-0 rounded-[2px] border border-sp-capability-line px-[4px] py-px font-gn-mono text-[8px] uppercase tracking-[0.12em] text-sp-capability"
                      >
                        {labels.tierMark[action.tier as 'PROFESSIONAL' | 'INSTITUTIONAL']}
                      </span>
                    ) : (
                      /*
                        THE COST, ON THE CONTROL, BEFORE IT RUNS. Sand, and sand
                        appears nowhere else in the product.
                      */
                      <span
                        data-gn="deck-cost"
                        className="shrink-0 rounded-[2px] border border-sp-compute-line px-[4px] py-px font-gn-mono text-[8px] uppercase tracking-[0.1em] text-sp-compute"
                      >
                        {action.cost} {labels.costUnit}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/*
            THE METER IS UNSET, NOT INVENTED. §10 wants "0 / 5 THIS MONTH ·
            RESETS 1 OCT" — a stated allowance. No allowance has been set, and
            printing a number here would be a commercial claim nobody approved.
          */}
          <p
            data-gn="deck-meter"
            className="mt-[9px] border-t border-sp-line-3 pt-[8px] font-gn-mono text-[8.5px] uppercase leading-[1.6] tracking-[0.1em] text-sp-ink-3"
          >
            {labels.meterUnset}
          </p>
          <p data-gn="deck-preview-note" className="mt-[5px] text-[10.5px] leading-[1.5] text-sp-ink-3">
            {labels.previewNote}
          </p>
        </div>
      )}

      {/* OPENS ON CLICK, NEVER ON HOVER. §10's first deliberateness rule. */}
      <button
        type="button"
        data-gn="action-deck-toggle"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="pointer-events-auto flex min-h-[32px] items-center gap-[7px] rounded-[2px] border border-sp-compute-line bg-sp-panel/90 px-[10px] py-[7px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] text-sp-compute outline-none backdrop-blur-[6px] transition-[color,background-color,border-color] duration-[140ms] hover:bg-[rgba(216,192,138,.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-compute"
      >
        <span aria-hidden="true" className="block h-[7px] w-[7px] rotate-45 border border-current" />
        {open ? labels.close : labels.open}
      </button>
    </div>
  );
}
