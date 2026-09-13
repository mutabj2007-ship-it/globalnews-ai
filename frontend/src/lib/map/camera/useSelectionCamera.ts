'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { selectionCameraFor } from '@/lib/map/coveragePaint';
import type { Bounds, CameraState } from './cameraState';

/**
 * H-C907 · ONE COUNTRY-FRAMING POLICY, TWO SHELLS.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE ───────────────────────────────────────
 *
 * `GlobalMapShell` framed a selected country and `MobileSpatialShell` did not.
 * The phone's country-search path called `onSelectionChange` and opened the
 * sheet, so identity, counts and articles updated while the map stayed at the
 * world camera — measured on the Railway Alpha with AFG and ZWE. The mobile
 * shell already owned every part needed (the same reducer, the same
 * `pendingBounds` wiring into `EvidenceMapCanvas`, the same
 * `initialCameraRestored` prop); the only thing missing was the transition.
 *
 * ── WHY A HOOK AND NOT A COPY ─────────────────────────────────────────────
 *
 * A second camera policy is the failure mode, not the fix. So the accepted
 * desktop behaviour moved HERE, unchanged, and both shells consume it.
 *
 * ── THE BEHAVIOUR, PRESERVED EXACTLY ──────────────────────────────────────
 *
 *   1  A selection change that is not a change is ignored.
 *   2  DESELECTION DOES NOT MOVE THE CAMERA.
 *   3  An explicitly restored `cam=` WINS at mount: the ref initialiser records
 *      the mount selection as ALREADY SEEN.
 *   4  A direct camera target (the antimeridian exceptions) is committed as a
 *      camera intent, so the reducer stays the only thing that moves the view.
 *   5  A bounds target goes to the ENGINE to be measured against the REAL
 *      viewport and comes back as an exact camera, which is then committed.
 *      One history entry either way.
 *
 * ── R2 · THE OWNERSHIP RACE THE CTO REVIEW FOUND ──────────────────────────
 *
 * R1 gave this hook ONE untyped `pendingBounds`, used both for a country fit
 * and for an independent focus request. On the phone that is a race, and the
 * region path walks straight into it:
 *
 *     onSelectionChange({ kind: 'REGION', … })   ->  parent CLEARS the country,
 *                                                    so `selectedIso3` AFG -> null
 *     focusBounds(region.extent)                 ->  a pending focus request
 *     ...effect runs on the selection change     ->  R1 cleared pendingBounds
 *                                                    and CANCELLED the region fit
 *
 * The fix is OWNERSHIP, not a second policy. One pending fit, one state, one
 * effect — but the fit now carries WHO ASKED FOR IT, and the rule that decides
 * what survives a selection change is a pure function (`pendingFitAfterSelectionChange`)
 * so it can be tested exhaustively instead of asserted as a source string:
 *
 *     a new country BOUNDS fit    supersedes whatever was pending
 *     a country CAMERA commit     supersedes whatever was pending (it is a newer
 *                                 explicit request; a surviving focus would
 *                                 resolve afterwards and override it)
 *     no country fit at all       cancels an obsolete SELECTION fit and LEAVES
 *                                 an independent FOCUS request alone
 *
 * On desktop nothing changes: that shell never creates a focus-origin fit (it
 * dispatches `focus-bounds` to the reducer instead), so `current.origin` is
 * never `'focus'` there and the rule reduces exactly to R1's `setPendingBounds(null)`.
 *
 * ── WHY `commitRef` AND NOT A DEPENDENCY ──────────────────────────────────
 *
 * The accepted effect depends on `[selectedIso3]` and nothing else. A caller
 * passing an inline `(camera) => dispatch(...)` would change identity every
 * render; listing it as a dependency would re-run the effect and re-commit the
 * fit. The callback is held in a ref refreshed after render, so the dependency
 * array stays exactly what it was on desktop.
 */

/** Who asked for the pending fit. This is the whole of the R2 correction. */
export type PendingFitOrigin = 'selection' | 'focus';

export interface PendingFit {
  readonly bounds: Bounds;
  readonly origin: PendingFitOrigin;
}

/** What the selection change resolved to, as a closed set. */
export type SelectionFitRequest =
  | { readonly kind: 'bounds'; readonly bounds: Bounds }
  | { readonly kind: 'camera' }
  | { readonly kind: 'none' };

/**
 * THE RULE, ISOLATED SO IT CAN BE TESTED WITHOUT A RENDERER.
 *
 * `current` is what is already pending; `request` is what the selection change
 * just asked for. The return value is the new pending fit.
 */
export function pendingFitAfterSelectionChange(
  current: PendingFit | null,
  request: SelectionFitRequest,
): PendingFit | null {
  if (request.kind === 'bounds') return { bounds: request.bounds, origin: 'selection' };

  /*
    A committed camera is a newer explicit request than anything pending. If a
    focus request survived it, the engine would resolve that focus a moment
    later and silently override the country the reader just chose.
  */
  if (request.kind === 'camera') return null;

  /*
    NOTHING TO FRAME — a deselection, or a country whose geometry is unknown.
    An obsolete country fit is cancelled. An INDEPENDENT focus request is not:
    the region path deselects the country ON PURPOSE and then asks for the
    region's extent, and cancelling that was the R1 race.
  */
  return current !== null && current.origin === 'focus' ? current : null;
}

/** Resolve a selection into a fit request. Pure, and the only caller of the resolver. */
export function selectionFitRequestFor(selectedIso3: string | null | undefined): SelectionFitRequest {
  if (!selectedIso3) return { kind: 'none' };

  const target = selectionCameraFor(selectedIso3);

  if (target === null) return { kind: 'none' };

  return target.kind === 'camera' ? { kind: 'camera' } : { kind: 'bounds', bounds: target.bounds };
}

export interface SelectionCameraParams {
  /** The country whose framing the view should follow. */
  readonly selectedIso3: string | null | undefined;
  /** True when the mount camera came from an explicit `cam=` in the URL. */
  readonly initialCameraRestored?: boolean;
  /** Commit a resolved camera. Both shells pass their reducer's commit intent. */
  readonly commitCamera: (camera: CameraState) => void;
}

export interface SelectionCameraBinding {
  /** Pass to `EvidenceMapCanvas.fitBounds`. */
  readonly pendingBounds: Bounds | null;
  /** Pass to `EvidenceMapCanvas.onBoundsResolved`. */
  readonly onBoundsResolved: (resolved: CameraState) => void;
  /**
   * Focus arbitrary bounds through the same engine measurement — a region
   * extent or a non-country search result. Marked `'focus'`, so a deselection
   * that accompanies it cannot cancel it.
   */
  readonly focusBounds: (bounds: Bounds) => void;
}

export function useSelectionCamera({
  selectedIso3,
  initialCameraRestored,
  commitCamera,
}: SelectionCameraParams): SelectionCameraBinding {
  const lastSelectionRef = useRef<string | null>(
    initialCameraRestored ? (selectedIso3 ?? null) : null,
  );
  const [pending, setPending] = useState<PendingFit | null>(null);

  const commitRef = useRef(commitCamera);

  useEffect(() => {
    commitRef.current = commitCamera;
  }, [commitCamera]);

  useEffect(() => {
    if (selectedIso3 === lastSelectionRef.current) return;

    lastSelectionRef.current = selectedIso3 ?? null;

    const request = selectionFitRequestFor(selectedIso3);

    setPending((current) => pendingFitAfterSelectionChange(current, request));

    if (request.kind === 'camera') {
      const target = selectionCameraFor(selectedIso3 ?? null);

      if (target !== null && target.kind === 'camera') commitRef.current(target.camera);
    }
  }, [selectedIso3]);

  const onBoundsResolved = useCallback((resolved: CameraState) => {
    setPending(null);
    commitRef.current(resolved);
  }, []);

  const focusBounds = useCallback((bounds: Bounds) => {
    setPending({ bounds, origin: 'focus' });
  }, []);

  return { pendingBounds: pending?.bounds ?? null, onBoundsResolved, focusBounds };
}
