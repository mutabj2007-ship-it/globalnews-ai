'use client';

import { useState } from 'react';

import {
  LIVE_MAP_MODES,
  MAP_MODES,
  type MapMode,
  type ModeUnavailableReason,
  modeAvailability,
  modeUnavailableReason,
} from '@/lib/map/state/mapState';
import { BAND_CLASS, BAND_UNBUILT_MARKER, bandFor } from '@/lib/map/spatial/controlBands';

/**
 * SPATIAL M2 — THE MODE SWITCHER, FROM DESIGN PART II §2.
 *
 * "Six modes; beta modes carry a marker. In: available modes, active, pinned
 * reason. Out: mode change. NEVER MOVES THE CAMERA."
 *
 * ── THE TWO RULES THAT ARE STRUCTURAL HERE, NOT REMEMBERED ────────────────
 *
 * IT CANNOT MOVE THE CAMERA. This component has no camera prop, no intent
 * dispatcher and no imperative handle. Part I §C: "Mode switching never moves
 * the camera. It changes which records qualify for the overlay. The user's
 * POSITION IN THE WORLD IS THEIRS, NOT THE MODE'S." There is no wire through
 * which it could, which is stronger than a comment saying it must not.
 *
 * ── E-2 · A REASON NOBODY CAN REACH IS STILL A SILENT NO-OP ──────────────
 *
 * E-1 gave each unbeta mode its own reason and put it on `title` and
 * `aria-label`. That fixed WHAT the reason says. It did not fix WHO CAN HEAR
 * IT, because the chip carried the HTML `disabled` attribute, and a disabled
 * button:
 *
 *   - is removed from the tab order, so a KEYBOARD user cannot focus it and
 *     never hears the accessible name that carries the reason;
 *   - receives no pointer events, so a TOUCH user — who has no hover at all —
 *     cannot surface the `title` tooltip by any gesture available to them.
 *
 * So for everyone not using a mouse, the tab remained exactly what the ruling
 * forbids: it did nothing and said nothing. The reason existed in the markup
 * and was unreachable in the product.
 *
 * THE FIX IS `aria-disabled`, NOT `disabled`. The chip stays focusable and
 * activatable, so its reason can be reached by keyboard and by touch; the click
 * handler still refuses to change mode, so nothing becomes usable that is not
 * built. Activating it PUBLISHES the reason into the status line this component
 * already renders for pinning — no new affordance, no layout change, and the
 * announcement reaches a screen reader through `role="status"` rather than
 * depending on hover.
 *
 * AN UNAVAILABLE MODE IS DISABLED WITH A REASON, NEVER HIDDEN, AND NEVER
 * SILENTLY EMPTY. Part II §6, M5 acceptance: "a mode with no data is
 * UNAVAILABLE rather than empty." Hiding it would leave the user unable to
 * learn the capability exists; showing it as working would answer a real
 * question with an empty map, which reads as "nothing is happening there".
 *
 * ── PINNING ───────────────────────────────────────────────────────────────
 *
 * Part II §1, Watch surface: "Mode switcher is PRESENT BUT PINNED to Watch
 * with a visible reason, rather than hidden — the user must understand why the
 * map looks quiet." So `pinnedReason` disables the other modes and is
 * rendered, not merely honoured.
 */

export interface ModeSwitcherLabels {
  readonly group: string;
  readonly modes: Readonly<Record<MapMode, string>>;
  /**
   * The generic fallback. Retained because a surface may still have nothing
   * more specific to say, but it is now the EXCEPTION rather than the answer
   * for every unbuilt mode — see `unavailableReasons`.
   */
  readonly unavailable: string;
  /**
   * CHECKPOINT E — why THIS mode cannot answer. Four modes shared one word for
   * four different reasons, which told the reader a capability was absent while
   * saying nothing about whether it was coming, broken, empty here, or gated.
   */
  readonly unavailableReasons: Readonly<Record<ModeUnavailableReason, string>>;
  readonly beta: string;
}

export interface ModeSwitcherProps {
  readonly active: MapMode;
  readonly onModeChange: (mode: MapMode) => void;
  /** When set, every other mode is disabled and this reason is shown. */
  readonly pinnedReason?: string | null;
  /** Defaults to all six. A surface may offer fewer, never more. */
  readonly modes?: readonly MapMode[];
  readonly labels: ModeSwitcherLabels;
  readonly className?: string;
}

export function ModeSwitcher({
  active,
  onModeChange,
  pinnedReason = null,
  modes = MAP_MODES,
  labels,
  className = '',
}: ModeSwitcherProps): JSX.Element {
  const pinned = pinnedReason !== null && pinnedReason.length > 0;

  /*
    E-2 — WHY THIS IS STATE AND NOT A TOOLTIP.

    A tooltip is a hover affordance. This has to survive on a phone, where
    there is no hover, and in a screen reader, where the user is moving by
    keyboard. Holding the last requested reason lets the existing status line
    say it out loud instead.

    Cleared on a successful mode change, because the reason describes a refusal
    and there is no longer one to describe.
  */
  const [requestedReason, setRequestedReason] = useState<string | null>(null);

  return (
    <div data-gn="map-mode-switcher" className={`flex min-w-0 flex-col ${className}`}>
      <div
        role="radiogroup"
        aria-label={labels.group}
        /*
          Part II §5's shrink order: "the mode row scrolls horizontally BEFORE
          ANYTHING ELSE SHRINKS". The scrollbar is hidden because a HUD row is
          not a document — the overflow is navigated by dragging or by keyboard,
          not by a visible track.
        */
        className="flex min-w-0 flex-1 gap-[2px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {modes.map((mode) => {
          const availability = modeAvailability(mode);
          const isLive = availability === 'live';
          const isActive = mode === active;
          const disabled = !isLive || (pinned && !isActive);
          /*
            CHECKPOINT E — the stated reason. A pinned surface keeps its own
            explanation, which is about THIS surface rather than about the mode.
          */
          const reason = modeUnavailableReason(mode);
          const unavailableText =
            reason === null ? labels.unavailable : labels.unavailableReasons[reason];
          const disabledReason = pinned && !isActive ? pinnedReason : unavailableText;

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isActive}
              /*
                E-2 — `aria-disabled`, NOT `disabled`. The chip keeps its place
                in the tab order so the reason is reachable without a mouse;
                the handler below is what guarantees it still cannot act.
              */
              aria-disabled={disabled || undefined}
              data-gn="map-mode"
              data-gn-mode={mode}
              data-gn-availability={availability}
              title={disabled ? disabledReason : undefined}
              aria-label={disabled ? `${labels.modes[mode]} — ${disabledReason}` : undefined}
              data-gn-unavailable-reason={disabled && reason !== null ? reason : undefined}
              onClick={() => {
                /*
                  E-2 — A REFUSAL THAT SAYS SO.

                  The mode still does not change: this returns before
                  `onModeChange` exactly as it did when the button was
                  `disabled`. What is new is that the refusal is now audible
                  and visible to a reader who is not hovering a mouse.
                */
                if (disabled) {
                  setRequestedReason(disabledReason ?? null);
                  return;
                }
                setRequestedReason(null);
                onModeChange(mode);
              }}
              /*
                DESIGN v1.6 — the three bands, chosen here and spelled in
                `controlBands.ts`.

                `isLive` is the BUILT question — whether this mode's model
                exists at all — and `pinned` is a temporary product state, so a
                mode pinned off is still AVAILABLE chrome that happens to be
                refused right now rather than UNBUILT. Rendering the two the
                same was part of what made the row unreadable: SITUATIONS
                (no model) and a pinned-off WORLD (a real view) looked
                identical.
              */
              className={`shrink-0 whitespace-nowrap rounded-[2px] border px-[10px] py-[6px] font-gn-mono text-[10px] tracking-[0.12em] ${
                BAND_CLASS[bandFor({ active: isActive, built: isLive })]
              } ${disabled && isLive ? 'cursor-default opacity-60' : ''}`}
            >
              {labels.modes[mode]}
              {/*
                The prototype marks an unshipped mode with a superscript beta,
                not with a word — the row is 10 px and a spelled-out
                "UNAVAILABLE" doubled every chip's width. The reason is on the
                accessible name and the tooltip, where there is room for it.
              */}
              {!isLive && (
                <span
                  data-gn="map-mode-unavailable"
                  aria-hidden="true"
                  className={`ml-[5px] align-super text-[8px] ${BAND_UNBUILT_MARKER}`}
                >
                  β
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/*
        ONE STATUS LINE, TWO KINDS OF REFUSAL.

        Pinning is a standing condition and keeps its persistent line, unchanged.
        A requested reason is the answer to something the reader just pressed, so
        it takes precedence while it is set — otherwise pressing SITUATIONS on a
        pinned surface would answer with the pinning reason, which is about the
        surface rather than about the mode the reader actually asked about.

        `role="status"` is what makes this reach a screen reader at all: the
        region is announced when its content changes, without moving focus away
        from the chip the reader is on.
      */}
      {(pinned || requestedReason !== null) && (
        <p
          data-gn="map-mode-pinned-reason"
          data-gn-reason-source={requestedReason !== null ? 'requested' : 'pinned'}
          role="status"
          className="mt-[3px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-amber"
        >
          {requestedReason ?? pinnedReason}
        </p>
      )}
    </div>
  );
}

/** Re-exported so a surface cannot build its own idea of which modes work. */
export { LIVE_MAP_MODES };
