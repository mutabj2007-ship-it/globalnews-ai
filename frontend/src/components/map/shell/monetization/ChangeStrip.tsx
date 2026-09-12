'use client';

import {
  CHANGE_CHIP,
  CHANGE_CHIP_CLASS,
  changeRingsVisible,
  summariseChange,
  type ChangeState,
} from '@/lib/map/monetization/changeStates';

/**
 * PART IV §7 — THE CHANGE STRIP. ONE LINE, AND NEVER TWO.
 *
 * "Top of the map canvas, beside the breadcrumb trail, right-aligned. Aggregates
 * the current viewport: '3 SIGNIFICANT · 5 NEW EVIDENCE'."
 *
 * §2.2's consequences name it explicitly: "The change strip is a single line and
 * NEVER WRAPS TO TWO." A strip that wrapped would push the map down by a row
 * whenever the world got busy — the interface moving because the news moved,
 * which is the opposite of a calm map. `whitespace-nowrap` and `truncate` are
 * therefore load-bearing, not cosmetic.
 *
 * BELOW ZOOM 4 the strip carries counts and per-mark change rings are suppressed
 * entirely (§7). At world scale a ring per mark is noise on a map whose whole
 * argument is calm, and the marks are smaller than the rings would be. The strip
 * says so rather than silently changing behaviour.
 *
 * IT IS A READOUT, NOT A CONTROL. `pointer-events-none` on the container: it sits
 * over the canvas, and a transparent strip that swallowed a drag would be the
 * PO-3 defect returning by another route. Nothing in it is clickable.
 */

export interface ChangeStripLabels {
  readonly label: string;
  readonly states: Readonly<Record<ChangeState, string>>;
  readonly ringsSuppressed: string;
  readonly noChange: string;
}

export interface ChangeStripProps {
  /*
    `unknown[]`, DELIBERATELY. Derivation results arrive here and are gated by
    `summariseChange`, which drops anything that is not one of the seven display
    states — a backend honesty state such as NO_BASELINE counts as nothing
    rather than as a chip. Typing this as `ChangeState[]` would move the gate
    to the caller, where it could be forgotten.
  */
  readonly states: readonly unknown[];
  readonly zoom: number;
  readonly labels: ChangeStripLabels;
}

export function ChangeStrip({ states, zoom, labels }: ChangeStripProps): JSX.Element | null {
  const summary = summariseChange(states);
  const ringsOn = changeRingsVisible(zoom);

  /*
    NOTHING TO SAY IS SAID BY SAYING NOTHING — the one place in Part IV where an
    empty state is correct. This is the world's aggregate, not a Watch result;
    §6.4.4's "never style NO MATERIAL CHANGE as an empty state" is about a watch
    line, which is a different thing and lives in the watchboard.
  */
  if (summary.length === 0 && ringsOn) return null;

  return (
    <div
      data-gn="change-strip"
      data-gn-rings={ringsOn ? 'on' : 'suppressed'}
      aria-label={labels.label}
      className="pointer-events-none flex min-w-0 items-center gap-[7px] overflow-hidden whitespace-nowrap"
    >
      {summary.map(({ state, count }) => (
        <span
          key={state}
          data-gn="change-strip-item"
          data-gn-state={state}
          className={`flex shrink-0 items-center gap-[5px] rounded-[2px] border px-[6px] py-[3px] font-gn-mono text-[9px] uppercase tracking-[0.1em] ${CHANGE_CHIP_CLASS[state]}`}
        >
          <b className="font-normal tabular-nums">{count}</b>
          <span>{labels.states[state]}</span>
          <span aria-hidden="true" className="opacity-60">
            {CHANGE_CHIP[state]}
          </span>
        </span>
      ))}

      {!ringsOn && (
        <span
          data-gn="change-strip-suppressed"
          className="shrink-0 truncate font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3"
        >
          {labels.ringsSuppressed}
        </span>
      )}
    </div>
  );
}
