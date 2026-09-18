/**
 * ════════════════════════════════════════════════════════════════════════════
 * HUD ORIGIN — INTERACTING WITH CHROME IS NOT SELECTING A GEOGRAPHY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MAP-WORLD-COUNTRY-RETRIEVAL-1`, and the CAF and NER reports before it.
 *
 * ── THE HAZARD THIS CLOSES, MEASURED ─────────────────────────────────────
 *
 * The map HUD is not beside the map — it is ON it. Every control in the top
 * geography row, the rails, the layer column and the camera cluster is a DOM
 * descendant of `[data-gn=map-canvas-region]`, and the pixels beneath them are
 * live country polygons.
 *
 * Proven in R3.1: from East Africa view, making the WORLD button click-through
 * and clicking its own centre — (90, 100) — selected **Algeria** and issued
 * `GET /news/country/DZA`. One pointer event at a navigation control's pixel
 * bought news for a country nobody chose.
 *
 * Niger, Central African Republic and Algeria were the same defect wearing
 * three different countries, which is exactly why **no country, coordinate or
 * viewport is named anywhere in this file.** A special case for any of them
 * would have fixed one symptom and left the class intact.
 *
 * ── THE RULE IS SEMANTIC, NOT POSITIONAL AND NOT TIMED ───────────────────
 *
 *   A pointer event that BEGAN ON CHROME is an interaction with that chrome,
 *   whatever the browser later resolves its target to.
 *
 * So the test is the event's own **origin**, read from `composedPath()`. It is
 * not a coordinate test — the geometry is legitimate, the controls really are
 * over the map. It is not a timer: a quiet window was explicitly rejected,
 * because it would guess at a mechanism rather than state a rule, and would go
 * on masking whatever produced the stray event.
 *
 * ── WHY A MARKER ATTRIBUTE AND NOT A LIST OF SELECTORS ───────────────────
 *
 * A list of class names or `data-gn` values is a second register of what counts
 * as chrome, and it drifts the moment a control is added — which is how a row
 * of eight controls came to be guarded by a test that drove one of them.
 *
 * `data-gn-hud` is declared BY the chrome, on the chrome, so a new HUD surface
 * is covered by carrying the marker its siblings already carry. The failure mode
 * of a forgotten marker is a control that behaves as it does today; the failure
 * mode of a forgotten list entry is silent quota spend.
 */

/** The single marker every interactive HUD surface carries. */
export const MAP_HUD_MARKER = 'data-gn-hud';

/**
 * The map surface itself. Present so the rule can be stated in both directions:
 * chrome is rejected, and the canvas explicitly remains selectable.
 */
export const MAP_SURFACE_MARKER = 'data-gn-map-surface';

interface HudOriginCandidate {
  readonly composedPath?: () => readonly EventTarget[];
  readonly target?: EventTarget | null;
  readonly originalEvent?: HudOriginCandidate;
}

function hasHudMarker(node: unknown): boolean {
  return (
    typeof node === 'object' &&
    node !== null &&
    'getAttribute' in node &&
    typeof (node as Element).getAttribute === 'function' &&
    (node as Element).getAttribute(MAP_HUD_MARKER) !== null
  );
}

/**
 * Walk up from a node when `composedPath()` is unavailable.
 *
 * MapLibre hands its handlers a synthetic event wrapping the DOM one, and in
 * some paths only `target` survives. Falling back to an ancestor walk means the
 * rule still holds rather than failing open — and failing open here costs quota.
 */
function ancestorCarriesMarker(target: EventTarget | null | undefined): boolean {
  let node: unknown = target;

  while (node !== null && node !== undefined) {
    if (hasHudMarker(node)) return true;

    node =
      typeof node === 'object' && 'parentElement' in node
        ? (node as Element).parentElement
        : null;
  }

  return false;
}

/**
 * Did this pointer/click event originate inside map HUD chrome?
 *
 * `true` means the reader was operating a control — a geography jump, a rail
 * button, a layer toggle, a zoom or reset control, Ask AI, a popup action — and
 * the map must not treat it as a click on the geography beneath.
 *
 * Deliberately conservative in one direction only: an event it cannot classify
 * is NOT treated as HUD, so a genuine map click is never swallowed. The canvas
 * must stay selectable, and a guard that quietly disabled selection would be a
 * worse defect than the one it replaced.
 */
export function eventOriginatesFromMapHud(event: unknown): boolean {
  if (event === null || event === undefined || typeof event !== 'object') return false;

  const candidate = event as HudOriginCandidate;

  /*
    THE COMPOSED PATH IS THE AUTHORITY. It is the event's own record of where it
    began and what it travelled through, which is precisely the question, and it
    is correct even when the browser has re-targeted the event to a common
    ancestor after a re-render.
  */
  const path =
    typeof candidate.composedPath === 'function' ? candidate.composedPath() : null;

  if (path !== null && path.length > 0) {
    for (const node of path) {
      if (hasHudMarker(node)) return true;
    }

    return false;
  }

  /* MapLibre synthetic events carry the DOM event under `originalEvent`. */
  const original = candidate.originalEvent;

  if (original !== undefined && original !== null) {
    const originalPath =
      typeof original.composedPath === 'function' ? original.composedPath() : null;

    if (originalPath !== null && originalPath.length > 0) {
      for (const node of originalPath) {
        if (hasHudMarker(node)) return true;
      }

      return false;
    }

    if (ancestorCarriesMarker(original.target)) return true;
  }

  return ancestorCarriesMarker(candidate.target);
}
