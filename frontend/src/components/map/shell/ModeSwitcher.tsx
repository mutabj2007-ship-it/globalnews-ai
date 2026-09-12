'use client';

import { LIVE_MAP_MODES, MAP_MODES, type MapMode, modeAvailability } from '@/lib/map/state/mapState';
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
  readonly unavailable: string;
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

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              data-gn="map-mode"
              data-gn-mode={mode}
              data-gn-availability={availability}
              title={disabled ? (pinned ? pinnedReason : labels.unavailable) : undefined}
              aria-label={disabled ? `${labels.modes[mode]} — ${pinned ? pinnedReason : labels.unavailable}` : undefined}
              onClick={() => {
                if (disabled) return;
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

      {pinned && (
        <p
          data-gn="map-mode-pinned-reason"
          role="status"
          className="mt-[3px] font-gn-mono text-[9px] uppercase tracking-[0.12em] text-sp-amber"
        >
          {pinnedReason}
        </p>
      )}
    </div>
  );
}

/** Re-exported so a surface cannot build its own idea of which modes work. */
export { LIVE_MAP_MODES };
