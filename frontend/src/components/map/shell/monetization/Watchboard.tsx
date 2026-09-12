'use client';

import { CHANGE_CHIP, CHANGE_CHIP_CLASS, type ChangeState } from '@/lib/map/monetization/changeStates';
import type { WatchCapability } from '@/lib/map/monetization/watchModel';

/**
 * PART IV §8.2 — THE WATCHBOARD. ALERTS ACCUMULATE; THEY NEVER INTERRUPT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * "ALERTS NEVER ARRIVE AS TOASTS OVER THE MAP"
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * They accumulate here and are opened deliberately. §8.3 makes the reason
 * structural rather than aesthetic: one digest per subject per cadence window,
 * one alert affordance over the map, amber count capped at 9+, DEVELOPING held
 * until it resolves or escalates, and push available only at CRITICAL ONLY.
 * That last one is described as "the structural resistance to notification
 * inflation" — the product is built so it cannot become noisy even if it wanted
 * to.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO MATERIAL CHANGE IS A LINE HERE, AND THAT IS THE POINT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §8.2: "NO MATERIAL CHANGE entries are present, at reduced opacity, showing
 * checked time and stable duration. THEY PROVE THE WORK RAN."
 *
 * A watchboard that only showed changes would be indistinguishable from a
 * watchboard that had stopped working. The quiet lines are the evidence of
 * labour, which is what the user is paying for — §6.4.4 forbids styling them as
 * an empty state anywhere they appear.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS BUILD SHOWS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No watch service exists, so there are NO ENTRIES — not zero entries dressed
 * as a working board, but an explicit statement that monitoring has not begun.
 * The Shared and Portfolios tabs (§8.2, §11) are ABSENT rather than ghosted,
 * because §11 is absolute about it: "for a non-organisation account, every
 * Institutional control is ABSENT — not ghosted, not greyed."
 */

export interface WatchboardEntry {
  readonly id: string;
  readonly state: ChangeState;
  readonly subject: string;
  readonly description: string;
  readonly checkedLabel: string;
  readonly evidenceDelta: number | null;
  readonly ceiling: string;
}

export interface WatchboardLabels {
  readonly title: string;
  readonly tabMine: string;
  readonly onMap: string;
  readonly states: Readonly<Record<ChangeState, string>>;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly signedOutBody: string;
  readonly checked: string;
  readonly ceiling: string;
}

export interface WatchboardProps {
  readonly entries: readonly WatchboardEntry[];
  readonly capability: WatchCapability;
  readonly labels: WatchboardLabels;
  readonly onSelectSubject: ((id: string) => void) | undefined;
}

export function Watchboard({
  entries,
  capability,
  labels,
  onSelectSubject,
}: WatchboardProps): JSX.Element {
  const signedOut = capability.blockedBy === 'SIGNED_OUT';

  return (
    <div data-gn="watchboard" className="flex flex-col gap-[12px]">
      {/*
        ONE TAB, BECAUSE ONE TAB IS TRUE. Shared and Portfolios belong to an
        organisation that does not exist for this account, and §11 requires them
        ABSENT rather than ghosted — a consumer view carries no enterprise
        chrome at all.
      */}
      <div role="tablist" aria-label={labels.title} className="flex gap-[4px] border-b border-sp-line pb-[8px]">
        <span
          role="tab"
          aria-selected="true"
          data-gn="watchboard-tab"
          className="rounded-[2px] border border-sp-watch-line bg-sp-watch-dim px-[9px] py-[5px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-watch"
        >
          {labels.tabMine}
        </span>
      </div>

      {entries.length === 0 ? (
        /*
          AN EXPLICIT STATEMENT, NOT AN EMPTY LIST. "No alerts" would imply a
          board that ran and found nothing; the truth is that nothing has run.
        */
        <div data-gn="watchboard-empty" data-gn-blocked-by={capability.blockedBy}>
          <h3 className="font-gn-mono text-[10px] uppercase tracking-[0.12em] text-sp-ink-2">
            {labels.emptyTitle}
          </h3>
          <p className="mt-[6px] text-[11.5px] leading-[1.55] text-sp-ink-3">
            {signedOut ? labels.signedOutBody : labels.emptyBody}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[6px]">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-gn="watchboard-entry"
              data-gn-state={entry.state}
              /*
                REDUCED OPACITY FOR NO MATERIAL CHANGE — present, quiet, and
                never styled as emptiness. It proves the work ran.
              */
              className={`rounded-[2px] border border-sp-line-2 bg-sp-panel-2 p-[10px] ${
                entry.state === 'NO_MATERIAL_CHANGE' ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-center gap-[7px]">
                <span
                  className={`shrink-0 rounded-[2px] border px-[5px] py-px font-gn-mono text-[8px] uppercase tracking-[0.1em] ${CHANGE_CHIP_CLASS[entry.state]}`}
                >
                  {CHANGE_CHIP[entry.state]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-sp-ink">
                  {entry.subject}
                </span>
              </div>

              <p className="mt-[5px] text-[11.5px] leading-[1.5] text-sp-ink-2">
                {entry.description}
              </p>

              <div className="mt-[6px] flex flex-wrap items-center gap-x-[10px] gap-y-[3px] font-gn-mono text-[8.5px] uppercase tracking-[0.1em] text-sp-ink-3">
                <span>
                  {labels.checked} {entry.checkedLabel}
                </span>
                {entry.evidenceDelta !== null && (
                  <span>
                    {entry.evidenceDelta > 0 ? '+' : ''}
                    {entry.evidenceDelta} EV
                  </span>
                )}
                <span>
                  {labels.ceiling} {entry.ceiling}
                </span>
              </div>

              {onSelectSubject && (
                <button
                  type="button"
                  data-gn="watchboard-on-map"
                  onClick={() => onSelectSubject(entry.id)}
                  className="mt-[8px] min-h-[32px] rounded-[2px] border border-sp-line-2 px-[9px] py-[6px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-ui-idle outline-none transition-colors hover:border-sp-cyan/45 hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-sp-cyan"
                >
                  {labels.onMap}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
