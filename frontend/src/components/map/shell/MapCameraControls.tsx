'use client';

import type { CameraAvailability, CameraIntent } from '@/lib/map/camera/cameraIntents';

/**
 * SPATIAL M1a / M2 — CAMERA CONTROLS.
 *
 * Real `<button>`s: they are tab-reachable, they announce their state, and
 * they DISABLE when the action would do nothing — at the zoom stops, with an
 * empty history, or when the camera is already the world view with nothing
 * selected.
 *
 * A control that is present but inert is worse than one that is absent,
 * because the user learns nothing from pressing it. `cameraAvailability` is
 * computed from the same session the reducer owns, so the disabled state can
 * never disagree with what the intent would actually do.
 *
 * ── M2 — THE THIRD RESET, AND WHY THERE ARE THREE ─────────────────────────
 *
 * Design Part I §C gives three buttons three DISTINCT PROMISES, and Part II
 * §6's M1 acceptance is that they "produce three visibly different outcomes":
 *
 *   RESET WORLD     global view, and CLEARS THE SELECTION.
 *   RESET EVIDENCE  KEEPS the selection and fits the bounds of all evidence
 *                   visible in the current mode and period. Amber, per Part I
 *                   §E's control spec — it is an attention colour because it
 *                   is the one reset scoped to what the platform knows rather
 *                   than to the world.
 *   PREVIOUS VIEW   pops the 25-deep history, restoring the camera AND the
 *                   selection that was active with it.
 *
 * Reset Evidence disables when there is no evidence to fit. That is not a
 * cosmetic detail: an enabled button that frames nothing would imply evidence
 * exists somewhere off-screen, which is the "absence of evidence is absence of
 * the event" failure attached to a control.
 */

export interface MapCameraControlsLabels {
  readonly group: string;
  readonly resetWorld: string;
  readonly resetEvidence: string;
  readonly previousView: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
}

export interface MapCameraControlsProps {
  readonly availability: CameraAvailability;
  readonly onIntent: (intent: CameraIntent) => void;
  /**
   * Fit the bounds of all currently visible evidence, keeping the selection.
   *
   * Passed as a callback rather than as an intent because the bounds are a
   * fact about the evidence set, which the camera reducer deliberately knows
   * nothing about. The shell computes them and commits the resulting camera
   * through the same reducer, so the move still lands in the history.
   */
  readonly onResetEvidence?: () => void;
  /** False when the current mode and period contain no evidence to fit. */
  readonly canResetEvidence?: boolean;
  readonly labels: MapCameraControlsLabels;
}

/**
 * M11 — THE CONTROL COLUMN IS A LAYOUT BOX, NOT A CONTROL.
 *
 * `flex flex-col items-end gap-[6px]` right-aligns children that are narrower
 * than the column and puts 6px of nothing between them. Measured at 1440x900:
 * the wrapper is 125x171 = 21,330 px2, the visible controls inside it total
 * 12,406 px2, and a 1px hit-test grid found the WRAPPER ITSELF topmost at
 * 8,420 of 21,204 sampled points — 39.7% of its own area, every one of them
 * transparent. (Main's audit measured 127x171 and 9,521 px2 / 44%; the small
 * difference is where each of us puts the boundary, not a different defect.)
 * No point inside the wrapper reached the map canvas at all, and a drag begun
 * in the strip beside the zoom buttons moved the map not one degree.
 *
 * The parent HUD island is already `pointer-events: none` and re-arms operable
 * descendants, so this component's own `pointer-events-auto` was the single
 * remaining thing standing between that empty strip and the map.
 *
 * Each visible control block declares `pointer-events-auto` for itself instead,
 * which also means this component is correct on its own rather than only inside
 * that island. Nothing moves: the column, its alignment, its 6px rhythm, every
 * button's box, its disabled logic and its focus ring are untouched.
 */
const PASS_THROUGH = 'pointer-events-none';
const TAKES_POINTER = 'pointer-events-auto';

/*
  DESIGN v1.6 — CAMERA BUTTONS MOVE FROM #8BA1AE TO THE IDLE UI RAMP.

  These were already the brightest chrome on the map, which is why they were not
  part of the revision's headline failure — but they sat on the PASSIVE ramp
  like everything else, and leaving them there would have made the one set of
  controls the reader uses most the dimmest thing in the new interaction layer.
  Border weight rises .28 -> .38 with the same reasoning as the mode chips: an
  edge is what makes a surface read as pressable.

  The disabled treatment is unchanged and stays an OPACITY rather than a band.
  A zoom-out that is unavailable because the camera is already at the world
  floor is not UNBUILT — the control exists and works, it simply has nowhere
  further to go, and marking it as unbuilt would say the product lacks a
  feature it has.
*/
const BTN =
  `${TAKES_POINTER} font-gn-mono text-[9.5px] uppercase tracking-[0.12em] whitespace-nowrap rounded-[2px] border border-[rgba(126,166,186,.38)] bg-sp-panel/90 px-[10px] py-[7px] text-sp-ui-hover backdrop-blur-[6px] transition-[color,background-color,border-color] duration-[140ms] hover:border-sp-cyan/45 hover:bg-sp-cyan/[0.08] hover:text-sp-cyan disabled:opacity-[.35] disabled:hover:border-[rgba(126,166,186,.38)] disabled:hover:bg-sp-panel/90 disabled:hover:text-sp-ui-hover disabled:cursor-default focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sp-cyan`;

const BTN_AMBER =
  `${BTN} hover:!border-sp-amber/45 hover:!bg-sp-amber/[0.14] hover:!text-sp-amber`;

export function MapCameraControls({
  availability,
  onIntent,
  onResetEvidence,
  canResetEvidence = false,
  labels,
}: MapCameraControlsProps): JSX.Element {
  return (
    /*
      STACKED AND RIGHT-ALIGNED, as the reference places them: the zoom pair as
      one bordered unit, then Previous view, Reset evidence (amber) and Reset
      world beneath it. Three distinct promises, three distinct buttons — and
      each disables when it would do nothing, because a control that is present
      but inert teaches the user nothing when they press it.
    */
    <div
      data-gn="map-camera-controls"
      role="group"
      aria-label={labels.group}
      /* M11 — the column passes the pointer through; its controls do not. */
      className={`${PASS_THROUGH} flex flex-col items-end gap-[6px]`}
    >
      <div
        data-gn="map-zoomer"
        /*
          The zoomer is re-armed as a BLOCK, not button by button: it is opaque
          chrome with its own border and backdrop, so its 1px frame belongs to
          the control and must not fall through to the map.
        */
        className={`${TAKES_POINTER} flex flex-col border border-sp-line-2 bg-sp-panel/90 backdrop-blur-[6px]`}
      >
        <button
          type="button"
          data-gn="map-zoom-in"
          aria-label={labels.zoomIn}
          disabled={!availability.canZoomIn}
          onClick={() => onIntent({ kind: 'zoom-in' })}
          className="h-[30px] w-[32px] text-[15px] text-sp-ink-2 transition-colors hover:bg-sp-cyan/10 hover:text-sp-cyan disabled:opacity-[.35] disabled:hover:bg-transparent disabled:hover:text-sp-ink-2"
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          data-gn="map-zoom-out"
          aria-label={labels.zoomOut}
          disabled={!availability.canZoomOut}
          onClick={() => onIntent({ kind: 'zoom-out' })}
          className="h-[30px] w-[32px] border-t border-sp-line text-[15px] text-sp-ink-2 transition-colors hover:bg-sp-cyan/10 hover:text-sp-cyan disabled:opacity-[.35] disabled:hover:bg-transparent disabled:hover:text-sp-ink-2"
        >
          <span aria-hidden="true">&minus;</span>
        </button>
      </div>

      <button
        type="button"
        data-gn="map-previous-view"
        className={BTN}
        disabled={!availability.canGoBack}
        onClick={() => onIntent({ kind: 'previous-view' })}
      >
        <span aria-hidden="true">&#9664; </span>
        {labels.previousView}
      </button>

      {onResetEvidence && (
        <button
          type="button"
          data-gn="map-reset-evidence"
          /* Amber — Part I §E. The one reset scoped to what the platform knows. */
          className={BTN_AMBER}
          disabled={!canResetEvidence}
          onClick={onResetEvidence}
        >
          {labels.resetEvidence}
        </button>
      )}

      <button
        type="button"
        data-gn="map-reset-world"
        className={BTN}
        disabled={!availability.canResetWorld}
        onClick={() => onIntent({ kind: 'reset-world' })}
      >
        {labels.resetWorld}
      </button>
    </div>
  );
}
