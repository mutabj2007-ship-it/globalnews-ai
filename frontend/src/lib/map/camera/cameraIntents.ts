import {
  CAMERA_HISTORY_LIMIT,
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_CAMERA,
  ZOOM_STEP,
  type Bounds,
  type CameraSnapshot,
  type CameraState,
  cameraForBounds,
  camerasEqual,
  normaliseCamera,
} from './cameraState';

/**
 * SPATIAL M1a / M2 — CAMERA INTENTS.
 *
 * Controls, keys, wheels and URLs do not move the map. They dispatch an
 * INTENT, and this reducer is the one place that decides what a camera
 * becomes. That is what makes "Previous View" trustworthy: every path to a new
 * camera goes through the same function, so there is no route that changes the
 * view without the history knowing.
 *
 * PURE. No engine, no DOM, no clock. Given a session and an intent it returns
 * the next session — which is why the whole interaction contract is testable
 * without a browser, and why the browser acceptance run is checking the
 * WIRING rather than the logic.
 *
 * ── M2, ON MAIN'S ARBITRATION: ONE REDUCER, ONE STACK, DEPTH 25 ───────────
 *
 * Three changes, all of them Design Part II §3 turned into code.
 *
 * 1. THE STACK HOLDS SNAPSHOTS, NOT CAMERAS. Each entry is
 *    `{camera, selection}`, so stepping back restores the selection that was
 *    active with that view. Previously the card stayed open describing a place
 *    the map had already left.
 *
 * 2. USER GESTURES NO LONGER PUSH HISTORY. The spec is unambiguous — "Push
 *    before any programmatic camera change; NEVER on user drag or wheel. Users
 *    do not expect Previous view to undo their own dragging." My M1a.1 reducer
 *    pushed on a *substantial* gesture, which meant a long pan could be
 *    partially undone by Previous View: the exact surprise the rule forbids.
 *    I reported this as a real delta against the spec and the spec was right.
 *    The gesture branch is deleted rather than tuned, because a threshold is
 *    what produced the surprise.
 *
 * 3. DEPTH 24 -> 25, matching the spec's stated number.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT: `previous-view` still does not push the
 * camera it left. Back walks out the way you came in; it does not toggle.
 */

export type CameraIntent =
  /** Return to the world view. Always available; a no-op only if already there. */
  | { readonly kind: 'reset-world' }
  /** Step back to the previously committed snapshot. */
  | { readonly kind: 'previous-view' }
  | { readonly kind: 'zoom-in' }
  | { readonly kind: 'zoom-out' }
  /** Pan by a fraction of the current span — the keyboard arrows. */
  | { readonly kind: 'pan'; readonly dx: number; readonly dy: number }
  /** A camera the ENGINE reports after a user gesture (drag, wheel, pinch). */
  | { readonly kind: 'gesture'; readonly camera: CameraState }
  /** A deliberate move to a named camera — search result, URL restore, focus. */
  | { readonly kind: 'commit'; readonly camera: CameraState }
  | { readonly kind: 'focus-bounds'; readonly bounds: Bounds }
  /**
   * M2 — THE SELECTION CHANGED WITHOUT THE CAMERA MOVING.
   *
   * Part I §C: "Country click selects and opens the intelligence card; it does
   * NOT move the camera." But the snapshot pushed by the NEXT programmatic
   * move must carry the selection that was actually active, so the reducer has
   * to be told. This intent changes no camera and pushes no history — it only
   * updates what a future push will record.
   */
  | { readonly kind: 'selection'; readonly selection: string | null };

export interface CameraSession {
  readonly camera: CameraState;
  /**
   * M2 — the selection active with the CURRENT camera. Not history; this is
   * what gets recorded when the next programmatic move pushes.
   */
  readonly selection: string | null;
  /** Most recent LAST. Never contains the current camera. */
  readonly history: readonly CameraSnapshot[];
  /**
   * What produced the current camera.
   *
   * The engine wrapper needs this: a camera the USER dragged to must not be
   * animated back at them, while a camera from a control or a URL should ease.
   */
  readonly origin: 'initial' | 'control' | 'gesture' | 'url' | 'reset' | 'back';
}

export const initialCameraSession = (camera: CameraState = WORLD_CAMERA): CameraSession => ({
  camera: normaliseCamera(camera),
  selection: null,
  history: [],
  origin: 'initial',
});

/**
 * PUSH BEFORE ANY PROGRAMMATIC CAMERA CHANGE.
 *
 * Records the camera being LEFT together with the selection that was active
 * with it, which is what makes `previous-view` restore a coherent pair rather
 * than a viewport with someone else's card open.
 */
const push = (session: CameraSession): readonly CameraSnapshot[] => {
  const next: CameraSnapshot[] = [
    ...session.history,
    { camera: session.camera, selection: session.selection },
  ];

  return next.length > CAMERA_HISTORY_LIMIT ? next.slice(next.length - CAMERA_HISTORY_LIMIT) : next;
};

export function cameraReducer(session: CameraSession, intent: CameraIntent): CameraSession {
  const current = session.camera;

  switch (intent.kind) {
    case 'selection': {
      if (intent.selection === session.selection) return session;

      /*
       * NO CAMERA, NO HISTORY. Selecting is not navigating. The only thing
       * that changes is what the next push will record alongside the camera.
       */
      return { ...session, selection: intent.selection };
    }

    case 'reset-world': {
      if (camerasEqual(current, WORLD_CAMERA) && session.selection === null) {
        /* Already home, nothing selected. A history entry here would make "back" undo nothing. */
        return session;
      }

      /*
       * Part I §C: "Reset world returns to the global view AND CLEARS THE
       * SELECTION." Two promises, one button — and the snapshot pushed above
       * is what makes both of them reversible.
       */
      return {
        camera: WORLD_CAMERA,
        selection: null,
        history: push(session),
        origin: 'reset',
      };
    }

    case 'previous-view': {
      if (session.history.length === 0) return session;

      const previous = session.history[session.history.length - 1];

      /*
       * Going back does NOT push the snapshot you left onto the stack. If it
       * did, back would toggle between two views forever instead of walking
       * out the way you came in.
       */
      return {
        camera: previous.camera,
        selection: previous.selection,
        history: session.history.slice(0, -1),
        origin: 'back',
      };
    }

    case 'zoom-in':
    case 'zoom-out': {
      const delta = intent.kind === 'zoom-in' ? ZOOM_STEP : -ZOOM_STEP;
      const camera = normaliseCamera({ ...current, zoom: current.zoom + delta });

      /* At the stop, the control is inert — not a history entry for a view that never changed. */
      if (camerasEqual(camera, current)) return session;

      return { ...session, camera, history: push(session), origin: 'control' };
    }

    case 'pan': {
      /*
       * Pan by a fraction of the CURRENT span, so one arrow press moves a
       * comparable proportion of the screen at every zoom rather than a fixed
       * number of degrees that is a continent when zoomed out and invisible
       * when zoomed in.
       */
      const span = 360 / Math.pow(2, current.zoom);
      const camera = normaliseCamera({
        ...current,
        center: [current.center[0] + intent.dx * span * 0.25, current.center[1] + intent.dy * span * 0.25],
      });

      if (camerasEqual(camera, current)) return session;

      return { ...session, camera, history: push(session), origin: 'control' };
    }

    case 'gesture': {
      const camera = normaliseCamera(intent.camera);

      if (camerasEqual(camera, current)) return session;

      /*
       * ── NEVER ON USER DRAG OR WHEEL ──────────────────────────────────────
       *
       * Design Part II §3, and the one behavioural change M2 makes to the
       * accepted M1a.1 contract. A gesture REPLACES the camera and touches the
       * history not at all. There is no threshold to tune, because the
       * threshold was the defect: at 0.35 zoom / 4 degrees, a long pan left
       * entries behind that Previous View would then partially undo, which is
       * precisely what the spec says users do not expect.
       *
       * The stack now holds only places the PRODUCT sent the user — resets,
       * focuses, searches, selections, zoom buttons. Those are the moves a
       * person wants back out of.
       */
      return { ...session, camera, origin: 'gesture' };
    }

    case 'commit': {
      const camera = normaliseCamera(intent.camera);

      if (camerasEqual(camera, current)) return session;

      return { ...session, camera, history: push(session), origin: 'control' };
    }

    case 'focus-bounds': {
      const camera = cameraForBounds(intent.bounds);

      if (camerasEqual(camera, current)) return session;

      return { ...session, camera, history: push(session), origin: 'control' };
    }

    default:
      return session;
  }
}

/** What the controls need in order to disable themselves honestly. */
export interface CameraAvailability {
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly canGoBack: boolean;
  readonly canResetWorld: boolean;
}

/**
 * PO-1/PO-3 — WHY THIS TAKES A FLOOR RATHER THAN ASSUMING `MIN_ZOOM`.
 *
 * With world copies off, the renderer will not zoom out past the point where
 * one world still covers the viewport — that is what stops the map tiling
 * itself across the screen. On a 1016x856 canvas that floor is
 * log2(1016/512) = 0.99, well above this module's MIN_ZOOM of 0.6.
 *
 * Left unsaid, the zoom-out control stayed enabled at Z 1.0 and did nothing on
 * every further press — measured, six presses, no movement. A control that
 * looks available and is not IS the defect the Product Owner reported, so the
 * engine's real floor is passed in and the button disables itself honestly.
 * The default keeps every existing caller behaving exactly as before.
 */
export function cameraAvailability(
  session: CameraSession,
  minZoom: number = MIN_ZOOM,
): CameraAvailability {
  const floor = Number.isFinite(minZoom) ? Math.max(minZoom, MIN_ZOOM) : MIN_ZOOM;

  return {
    canZoomIn: session.camera.zoom < MAX_ZOOM - 1e-9,
    canZoomOut: session.camera.zoom > floor + 1e-9,
    canGoBack: session.history.length > 0,
    /*
      Reset World has two promises — the world view and no selection — so it is
      available while EITHER is unmet. At the world camera with a country still
      selected the button is live, because it still has something to do.
    */
    canResetWorld: !camerasEqual(session.camera, WORLD_CAMERA) || session.selection !== null,
  };
}
