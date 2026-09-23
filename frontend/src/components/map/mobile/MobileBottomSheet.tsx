'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * MOBILE SPATIAL MVP — THE BOTTOM INTELLIGENCE SHEET.
 *
 * The desktop right rail is a 372 px column beside the map. A phone has no
 * beside, so the same intelligence arrives from below in three declared stops:
 *
 *   PEEK  what is selected, how much is retained, what state it is in
 *   HALF  the actions, the newest reporting, the evidence summary
 *   FULL  the whole retained set, provider and freshness, evidence state
 *
 * ── WHY THREE STOPS AND NOT A FREE-FLOATING PANEL ─────────────────────────
 *
 * A sheet that can rest anywhere makes the map's remaining height unknowable,
 * which is the thing a map most needs to be. Three stops mean the map's visible
 * area is one of three known numbers, and PEEK and HALF both leave a usable map
 * behind the sheet — the requirement that the map stay visible is a layout
 * fact here, not an intention.
 *
 * ── DRAGGING ──────────────────────────────────────────────────────────────
 *
 * The handle is a real button with a 44 px hit area, so the sheet is operable
 * by tap alone — Peek to Half to Full and around again — before any drag is
 * attempted. Dragging is layered on top with pointer events, which cover touch,
 * mouse and pen with one code path, and `setPointerCapture` so a finger that
 * slides off the handle keeps dragging rather than dropping the sheet.
 *
 * A drag settles to the NEAREST stop by the height the user actually left it
 * at, not by the direction they moved: releasing a sheet a third of the way
 * back down should return it to where it came from, and distance says that
 * where velocity does not.
 *
 * The sheet never animates while a finger is down — a transition during a drag
 * makes the surface lag the thumb — so the transition is applied only when the
 * pointer is up.
 */

export type SheetStop = 'PEEK' | 'HALF' | 'FULL';

export const SHEET_STOPS: readonly SheetStop[] = ['PEEK', 'HALF', 'FULL'];

/**
 * Stop heights as a fraction of the viewport, except PEEK which is a fixed
 * height because it must show a known amount of content rather than a share of
 * whatever device it lands on.
 */
export const PEEK_HEIGHT_PX = 148;
export const HALF_FRACTION = 0.52;
/**
 * FULL WAS 0.88 AND IS NOW 0.74, BECAUSE R2 SET A FLOOR UNDER THE MAP.
 *
 * §16.2: "At every state the map holds AT LEAST 26% of the viewport and remains
 * pannable."
 *
 * MEASURED at the R2 reference frame of 390x620: a 0.88 sheet is 546px, leaving
 * 74px of map — 12%. The rule is not decorative. A sheet that takes seven eighths
 * of a 620px phone has stopped being a sheet over a map and become a page with a
 * strip of decoration above it, and the reader loses the thing they were
 * reading ABOUT.
 *
 * 0.74 is the largest fraction that satisfies the floor exactly, so FULL stays
 * as tall as R2 permits: 459px of sheet and 161px of map at the reference frame.
 */
export const FULL_FRACTION = 0.74;

/** §16.2's floor, stated once so the sheet and its guard cannot disagree. */
export const MIN_MAP_FRACTION = 0.26;

/** Every touch target in this shell. Below this a control is not tappable. */
export const MIN_TOUCH_PX = 44;

/** Movement under this is a tap, not a drag. */
const TAP_SLOP_PX = 6;

export interface MobileBottomSheetLabels {
  readonly sheetLabel: string;
  readonly handleLabel: string;
  readonly stops: Readonly<Record<SheetStop, string>>;
}

export const SPATIAL_DETENTS = { peek: PEEK_HEIGHT_PX, half: HALF_FRACTION, full: FULL_FRACTION } as const;
export interface MobileBottomSheetProps {
  /** A recovered domain may supply its accepted detents; defaults preserve Spatial. */
  readonly geometry?: { readonly peek: number; readonly half: number; readonly full: number };
  readonly stop: SheetStop;
  readonly onStopChange: (stop: SheetStop) => void;
  readonly labels: MobileBottomSheetLabels;
  readonly children: React.ReactNode;
}

/**
 * The sheet's height at a stop — ALWAYS ROUNDED DOWN.
 *
 * ── A DEFECT FOUND IN THE BROWSER, AND IT WAS MINE ────────────────────────
 *
 * This used `Math.round`, which rounds UP whenever the fractional pixel is .5 or
 * more — making the sheet TALLER than its fraction and the map SMALLER than the
 * floor §16.2 guarantees. Measured on the running product at 390x844:
 *
 *     844 x 0.74 = 624.56  ->  round 625  ->  map 219px = 25.9%   BELOW THE FLOOR
 *     844 x 0.74 = 624.56  ->  floor 624  ->  map 220px = 26.1%   holds
 *
 * It was latent at the reference frame too — 620 x 0.74 = 458.8 rounds to 459 and
 * leaves 25.97%. My own R2 evidence recorded "map 26%" because the measurement was
 * displayed to two decimal places; the extra digit is where the violation lived.
 *
 * `Math.floor` is the correct operation and not merely a smaller one: flooring the
 * SHEET can only give the MAP more room, so the floor holds for every viewport
 * height rather than for the ones that happen to round down. The accepted
 * fractions are unchanged — this makes the accepted rule true.
 */
function heightFor(stop: SheetStop, viewportHeight: number, geometry: NonNullable<MobileBottomSheetProps["geometry"]> = SPATIAL_DETENTS): number {
  if (stop === 'PEEK') return geometry.peek;
  if (stop === 'HALF') return Math.floor(viewportHeight * geometry.half);

  return Math.floor(viewportHeight * geometry.full);
}

/**
 * The map fraction a stop actually leaves, in real pixels.
 *
 * Exported so the guard measures what the sheet DOES rather than what its
 * constants imply — the arithmetic above is exactly where the two diverged.
 */
export function mapFractionAt(stop: SheetStop, viewportHeight: number): number {
  if (viewportHeight <= 0) return 1;

  return (viewportHeight - heightFor(stop, viewportHeight)) / viewportHeight;
}

export function MobileBottomSheet({
  stop,
  geometry = SPATIAL_DETENTS,
  onStopChange,
  labels,
  children,
}: MobileBottomSheetProps): JSX.Element {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  /*
    A DRAG ALSO PRODUCES A CLICK. The handle is a button, so every drag ends
    with a click event as well as a pointerup — and with the tap-to-cycle
    behaviour below, that meant one drag moved the sheet TWICE: once by
    settling, once by cycling. Measured: a single upward drag from PEEK landed
    on FULL instead of HALF, and a downward drag from PEEK went to HALF.

    So a pointer that actually travelled marks itself, and the click that
    follows it is ignored. Anything under the threshold is a tap, which is what
    a finger that lands and lifts without moving actually is.
  */
  const movedRef = useRef(false);

  /*
    MEASURED, NEVER ASSUMED — the same rule the camera contract holds. A stop
    is a fraction of the viewport, so a zero measurement would produce a zero
    sheet; until a real height exists the sheet renders at its PEEK constant,
    which is a number and not a guess.
  */
  useEffect(() => {
    const measure = (): void => setViewportHeight(window.innerHeight);

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  const settled = viewportHeight > 0 ? heightFor(stop, viewportHeight, geometry) : geometry.peek;
  const height = dragHeight ?? settled;

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      /* Capture so a finger sliding off the handle keeps the drag. */
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startY: event.clientY, startHeight: settled };
      movedRef.current = false;
      setDragHeight(settled);
    },
    [settled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;

      if (drag === null || viewportHeight === 0) return;

      /* Upward movement is a NEGATIVE delta and a TALLER sheet. */
      const travelled = drag.startY - event.clientY;

      if (Math.abs(travelled) > TAP_SLOP_PX) movedRef.current = true;

      const next = drag.startHeight + travelled;
      const min = geometry.peek;
      const max = heightFor('FULL', viewportHeight, geometry);

      setDragHeight(Math.max(min, Math.min(max, next)));
    },
    [viewportHeight, geometry],
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;

      if (drag === null) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const landed = dragHeight ?? drag.startHeight;

      dragRef.current = null;
      setDragHeight(null);

      if (viewportHeight === 0) return;

      /* NEAREST BY DISTANCE, not by direction — see this file's own note. */
      let nearest: SheetStop = 'PEEK';
      let best = Number.POSITIVE_INFINITY;

      for (const candidate of SHEET_STOPS) {
        const distance = Math.abs(heightFor(candidate, viewportHeight, geometry) - landed);

        if (distance < best) {
          best = distance;
          nearest = candidate;
        }
      }

      if (nearest !== stop) onStopChange(nearest);
    },
    [dragHeight, onStopChange, stop, viewportHeight, geometry],
  );

  /* Tap cycles PEEK -> HALF -> FULL -> PEEK, so the sheet works without a drag. */
  const cycle = useCallback(() => {
    if (movedRef.current) {
      /* This click is the tail of a drag that has already settled. */
      movedRef.current = false;

      return;
    }

    const index = SHEET_STOPS.indexOf(stop);

    onStopChange(SHEET_STOPS[(index + 1) % SHEET_STOPS.length]);
  }, [onStopChange, stop]);

  const dragging = dragRef.current !== null;

  return (
    <section
      data-gn="mobile-sheet"
      data-gn-stop={stop}
      data-gn-dragging={dragging ? 'true' : 'false'}
      aria-label={labels.sheetLabel}
      style={{ height: `${height}px` }}
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex flex-col border-t border-sp-line-2 bg-sp-panel ${
        dragging ? '' : 'transition-[height] duration-200 ease-out'
      }`}
    >
      <button
        type="button"
        data-gn="mobile-sheet-handle"
        aria-label={`${labels.handleLabel} — ${labels.stops[stop]}`}
        aria-expanded={stop !== 'PEEK'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={cycle}
        /*
          `touch-none` matters: without it the browser claims the vertical
          gesture for page scrolling and the sheet never sees the move events.
          The 44 px height is the touch target; the 4 px bar inside it is only
          what the target looks like.
        */
        className="flex h-[44px] w-full shrink-0 cursor-grab touch-none items-center justify-center outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-sp-cyan active:cursor-grabbing"
      >
        <span aria-hidden="true" className="h-[4px] w-[44px] rounded-full bg-sp-line-2" />
      </button>

      <div
        data-gn="mobile-sheet-content"
        /*
          The content scrolls, the sheet does not. `overscroll-contain` stops a
          flick at the end of the list from scrolling the page behind it, which
          on a phone reads as the whole app coming loose.
        */
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[14px] pb-[18px]"
      >
        {children}
      </div>
    </section>
  );
}
