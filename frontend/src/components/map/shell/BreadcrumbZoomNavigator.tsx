'use client';

import {
  DEPLOYMENT_JUMP_TARGETS,
  type JumpTarget,
  type ScaleRung,
  breadcrumbLadder,
  type BreadcrumbRung,
} from '@/lib/map/navigation/breadcrumbs';
import type { CameraState } from '@/lib/map/camera/cameraState';
import { BAND_ACTIVE, BAND_AVAILABLE } from '@/lib/map/spatial/controlBands';
import { resolveCameraPlace, rungName } from '@/lib/map/navigation/resolvedLadder';

/**
 * SPATIAL M2 — THE BREADCRUMB SCALE LADDER, FROM DESIGN PART I §E.
 *
 * "World / Africa / East Africa / Rwanda / Kigali, plus validation jumps.
 * HIGHLIGHTS THE SCALE THE CAMERA IS CURRENTLY INSIDE, so the user always
 * knows where they are in the hierarchy."
 *
 * ── THE LIE THIS COMPONENT IS BUILT TO AVOID ──────────────────────────────
 *
 * The familiar map-UI failure is a breadcrumb trail that reads
 * "World › Africa › Rwanda" because the zoom is high, while the camera is over
 * the Pacific. It happens when one control conflates two different facts.
 *
 * They are kept apart here, in the markup as well as the module:
 *
 *   THE LADDER is a SCALE indicator derived from zoom alone. It says how far
 *   in the camera is — nothing more. The rungs are not places and are not
 *   clickable, because a scale is not a destination.
 *
 *   THE JUMPS are configured DESTINATIONS with real gazetteer bounds. They are
 *   buttons, and each one names a place.
 *
 * A reader can therefore never be told they are "in Rwanda" by a control that
 * only knows the zoom level.
 *
 * ── AND IT DOES NOT MOVE THE CAMERA ITSELF ────────────────────────────────
 *
 * Part II §3: "Search and breadcrumbs call FOCUS. Nothing else may animate the
 * camera." A jump emits bounds; the shell turns them into a focus intent, so
 * the move lands in the camera history like every other move and Previous View
 * can walk back out of it.
 */

export interface BreadcrumbLabels {
  readonly group: string;
  readonly scaleLabel: string;
  readonly jumpsLabel: string;
  readonly rungs: Readonly<Record<ScaleRung, string>>;
  readonly targets: Readonly<Record<string, string>>;
}

export interface BreadcrumbZoomNavigatorProps {
  readonly camera: CameraState;
  readonly onJump: (target: JumpTarget) => void;
  readonly labels: BreadcrumbLabels;
  readonly targets?: readonly JumpTarget[];
  readonly className?: string;
}

export function BreadcrumbZoomNavigator({
  camera,
  onJump,
  labels,
  targets = DEPLOYMENT_JUMP_TARGETS,
  className = '',
}: BreadcrumbZoomNavigatorProps): JSX.Element {
  const ladder = breadcrumbLadder(camera);
  /*
    PO GOLDEN-FRAME CORRECTION — "Do not display generic rung names like
    CONTINENT / SUBREGION / COUNTRY when a resolved value exists."

    Resolved from the camera's actual centre, not from its zoom. Over Rwanda
    the ladder reads WORLD · AFRICA · EAST AFRICA · RWANDA · KIGALI, which is
    the golden row. Over the Pacific every name resolves to null and the rungs
    keep their generic words — so the "you are in Rwanda while the camera is
    over the Pacific" failure this component was built to prevent is still
    impossible, because a name is only ever printed for a place the camera is
    measurably inside.
  */
  const place = resolveCameraPlace(camera);

  /*
    PO RULING C — a rung with no resolved place is DROPPED, not relabelled.

    WORLD is the one rung that is always true and never resolves to a place
    name, so it keeps its own word: "World" is a resolved answer at world
    scale, not a generic stand-in for one.
  */
  const visibleRungs: { entry: BreadcrumbRung; name: string | null }[] = ladder
    .map((entry) => ({ entry, name: rungName(entry.rung, place, entry.reached) }))
    .filter(({ entry, name }) => name !== null || entry.rung === 'WORLD');

  return (
    <nav
      data-gn="map-breadcrumbs"
      aria-label={labels.group}
      className={`flex max-w-[60%] flex-wrap items-center gap-[5px] ${className}`}
    >
      {/*
        THE SCALE LADDER — NOT LINKS. These are rungs, not destinations, and
        rendering them as buttons is exactly how the "you are in Rwanda while
        the camera is over the Pacific" lie gets built. The reference separates
        them from the jump targets with a divider for the same reason.
      */}
      <ol
        data-gn="breadcrumb-scale"
        aria-label={labels.scaleLabel}
        className="flex flex-wrap items-center gap-[5px]"
      >
        {/*
          ══ PO RULING C (C906) — THE GENERIC ROW IS GONE ══════════════════

          Alpha still rendered WORLD | CONTINENT | SUBREGION | COUNTRY | CITY
          as a visible row above the resolved geography. The ruling: *"Keep
          internal hierarchy semantics if required, but do not make generic
          rung names a second visible breadcrumb row."*

          C905 printed the generic word as a FALLBACK whenever a rung was
          unreached or unresolved — which at the world view is four rungs out
          of five, so the fallback was the normal state rather than the edge
          case.

          A rung with no resolved place is now DROPPED, not relabelled. The
          hierarchy itself is unharmed: the ladder is still derived from
          `breadcrumbLadder`, still ordered WORLD -> CITY, and every rendered
          rung still carries `data-gn-rung`, `data-gn-reached` and
          `data-gn-active`, so the scale semantics remain readable by tests and
          by assistive technology without being spelled out as chrome.
        */}
        {visibleRungs.map(({ entry, name }) => (
          <li key={entry.rung}>
            <span
              data-gn="breadcrumb-rung"
              data-gn-rung={entry.rung}
              data-gn-reached={entry.reached}
              data-gn-active={entry.active}
              aria-current={entry.active ? 'true' : undefined}
              /*
                DESIGN v1.6 — the geography-level rungs are chrome and were on
                the passive ramp.

                A rung is a READOUT, not a button — it says what scale the
                camera is at — so an unreached rung keeps a quieter treatment
                than a pressable control would. It is still lifted onto the
                v1.6 idle ink, because #5D7280 at 60% was below the threshold
                at which a reader could tell how far up the ladder they were.
              */
              className={`block whitespace-nowrap border px-[8px] py-[5px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] backdrop-blur-[6px] ${
                entry.active
                  ? BAND_ACTIVE
                  : entry.reached
                    ? 'border-sp-line bg-sp-panel/[0.85] text-sp-ui-hover'
                    : 'border-sp-line bg-sp-panel/[0.85] text-sp-ui-off'
              }`}
            >
              {name ?? labels.rungs.WORLD}
            </span>
          </li>
        ))}
      </ol>

      <span aria-hidden="true" className="mx-[2px] h-[16px] w-px bg-sp-line-2" />

      {/* THE JUMPS — real destinations with real gazetteer bounds. */}
      <div
        data-gn="breadcrumb-jumps"
        role="group"
        aria-label={labels.jumpsLabel}
        className="flex flex-wrap items-center gap-[5px]"
      >
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            data-gn="breadcrumb-jump"
            data-gn-target={target.id}
            data-gn-rung={target.rung}
            onClick={() => onJump(target)}
            /*
              DESIGN v1.6 — a quick place is a CAMERA JUMP, which is a working
              control and gets the full AVAILABLE band. The revision lists it
              beside the geography-level buttons for exactly that reason: both
              move the camera, so both must read as pressable.

              Its own panel background is kept over the band's wash so the
              chip stays legible against the map rather than against a rail.
            */
            className={`cursor-pointer whitespace-nowrap border px-[8px] py-[5px] font-gn-mono text-[9.5px] uppercase tracking-[0.12em] backdrop-blur-[6px] ${BAND_AVAILABLE}`}
          >
            {labels.targets[target.id] ?? target.id}
          </button>
        ))}
      </div>
    </nav>
  );
}
