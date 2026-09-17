import { readFileSync } from 'fs';
import { join } from 'path';

import { GRATICULE_LAYER_ID } from '@/lib/map/reference/graticule';
import {
  RAIL_EVIDENCE_LAYERS,
  RAIL_REFERENCE_LAYERS,
  layerById,
  railLayers,
} from '@/lib/map/layers/layerRegistry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT E-2 — A REASON NOBODY CAN REACH IS STILL A SILENT NO-OP
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling, Checkpoint E: the Beta tabs *"must not remain silent no-ops"* and
 * must *"present a truthful unavailable / not-connected state"*.
 *
 * ─── WHAT E-1 FIXED, AND WHAT IT LEFT ─────────────────────────────────────
 *
 * E-1 gave each unbuilt mode its own reason — NOT_BUILT, NOT_CONNECTED and the
 * rest — and put it on `title` and `aria-label`. That settled WHAT the reason
 * says.
 *
 * It did not settle WHO CAN HEAR IT. The chip carried the HTML `disabled`
 * attribute, and by specification a disabled button:
 *
 *   - is removed from the tab order, so a KEYBOARD user cannot focus it and
 *     never reaches the accessible name that carries the reason;
 *   - receives no pointer events, so a TOUCH user — who has no hover at all —
 *     has no gesture that can summon the `title` tooltip.
 *
 * So for every reader not driving a mouse, the tab was still exactly what the
 * ruling forbids: it did nothing, and it said nothing. The reason was present
 * in the markup and absent from the product.
 *
 * ─── THE CORRECTION ───────────────────────────────────────────────────────
 *
 * `aria-disabled` instead of `disabled`. The control keeps its place in the tab
 * order, so its reason is reachable by keyboard and by touch. The click handler
 * still returns before acting, so NOTHING BECOMES USABLE THAT IS NOT BUILT —
 * which is the load-bearing half, and is asserted here in both surfaces.
 *
 * Activating an unavailable mode publishes its reason into the `role="status"`
 * line the component already renders for pinning. No new affordance, no layout
 * change, and the announcement does not depend on hover.
 *
 * ─── AND THE SAME DEFECT IN THE LAYER RAIL ────────────────────────────────
 *
 * `LayerToggleRail` had it too, identically, for its unbuilt layers. It is the
 * same checkpoint ("SPATIAL CONTROLS / MODES") and the same argument, so it is
 * corrected the same way rather than left as a known copy of a fixed bug.
 *
 * ─── ALSO CLASSIFIED HERE ─────────────────────────────────────────────────
 *
 * SPATIAL-GRATICULE-FEATURE-1 — ALREADY CORRECTED, by C907 §4, before this
 * checkpoint. The registry once declared the graticule LIVE while the canvas
 * added no such layer, so the GRID control governed nothing. It now governs a
 * real layer. Guarded below so it cannot silently regress to a control over
 * nothing.
 */

const stripComments = (src: string): string =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const shell = (name: string): string =>
  stripComments(readFileSync(join(__dirname, 'shell', name), 'utf-8'));

const switcher = shell('ModeSwitcher.tsx');
const rail = shell('LayerToggleRail.tsx');
const canvas = readFileSync(join(__dirname, 'shell', 'EvidenceMapCanvas.tsx'), 'utf-8');

describe('E-2 — an unavailable control is reachable, and still refuses', () => {
  describe('THE MODE CHIPS', () => {
    it('no longer carry the HTML disabled attribute', () => {
      /*
        The exact shape of the defect. `disabled` is what removed the chip from
        the tab order and denied it pointer events.
      */
      expect(switcher).not.toContain('disabled={disabled}');
    });

    it('carry aria-disabled instead, so assistive tech still knows', () => {
      expect(switcher).toContain('aria-disabled={disabled || undefined}');
    });

    it('STILL REFUSE TO CHANGE MODE — the load-bearing half', () => {
      /*
        Reachability must not have bought usability. If this regressed, an
        unbuilt mode would become enterable and the map would answer a real
        question with an empty overlay.
      */
      expect(switcher).toMatch(
        /if \(disabled\) \{\s*setRequestedReason\(disabledReason \?\? null\);\s*return;\s*\}/,
      );
    });

    it('publish the reason into a live region rather than a tooltip', () => {
      expect(switcher).toContain('role="status"');
      expect(switcher).toContain('{requestedReason ?? pinnedReason}');
    });

    it('a requested reason takes precedence over the pinned one', () => {
      /*
        Pressing SITUATIONS on a pinned surface must answer about SITUATIONS,
        not about the pinning — the reader asked a specific question.
      */
      expect(switcher).toContain('{(pinned || requestedReason !== null) && (');
      expect(switcher).toContain(
        "data-gn-reason-source={requestedReason !== null ? 'requested' : 'pinned'}",
      );
    });

    it('and the pinned line still renders on its own', () => {
      /* Pinning is a standing condition; it did not become press-to-reveal. */
      expect(switcher).toContain('data-gn="map-mode-pinned-reason"');
    });

    it('the reason still travels on the accessible name and the tooltip', () => {
      /* E-1's guarantees are additive, not replaced. */
      expect(switcher).toContain('title={disabled ? disabledReason : undefined}');
      expect(switcher).toContain(
        'aria-label={disabled ? `${labels.modes[mode]} — ${disabledReason}` : undefined}',
      );
    });
  });

  describe('THE LAYER RAIL, WHICH HAD THE SAME DEFECT', () => {
    it('no longer disables an unbuilt layer out of the tab order', () => {
      expect(rail).not.toContain('disabled={!layer.available}');
    });

    it('marks it aria-disabled instead', () => {
      expect(rail).toContain('aria-disabled={!layer.available || undefined}');
    });

    it('STILL REFUSES TO TOGGLE AN UNBUILT LAYER', () => {
      expect(rail).toMatch(/if \(!layer\.available\) return;\s*onToggle\(layer\.id, !on\);/);
    });

    it('still states the reason on the accessible name', () => {
      expect(rail).toContain('aria-label={reason ?');
    });

    it('and OUT OF RANGE is still not treated as unavailable', () => {
      /*
        A layer outside its zoom range stays ON and stays operable — the user's
        preference has not changed. Only `available` gates the control.
      */
      expect(rail).toContain("const status = !layer.available ? 'unavailable' : !inRange ? 'out-of-range'");
      expect(rail).not.toContain('aria-disabled={!inRange');
    });
  });

  describe('WHAT MUST NOT HAVE CHANGED', () => {
    it('the working LABEL and WATER controls are still offered', () => {
      /* CTO: "Preserve working LABEL/WATER controls." */
      const offered = railLayers().map((l) => l.id);

      expect(offered).toContain('labels');
      expect(offered).toContain('hydrography');
      expect(layerById('labels')?.available).toBe(true);
      expect(layerById('hydrography')?.available).toBe(true);
    });

    it('the rail still offers exactly the declared evidence and reference layers', () => {
      expect(railLayers().map((l) => l.id)).toEqual([
        ...RAIL_EVIDENCE_LAYERS,
        ...RAIL_REFERENCE_LAYERS,
      ]);
    });

    it('no layer is in both groups, so nothing is offered twice', () => {
      /*
        The rail groups by "is it in RAIL_EVIDENCE_LAYERS", so a layer listed in
        both constants would render once per group — one control, two chips,
        disagreeing about its own class.
      */
      for (const id of RAIL_EVIDENCE_LAYERS) expect(RAIL_REFERENCE_LAYERS).not.toContain(id);
    });

    it('and every rail layer belongs to one of the two declared lists', () => {
      /*
        The reference group is rendered by NEGATION — everything not in the
        evidence list. A layer reaching the rail from neither list would be
        silently labelled reference whatever its real class.
      */
      const declared = [...RAIL_EVIDENCE_LAYERS, ...RAIL_REFERENCE_LAYERS];

      for (const layer of railLayers()) expect(declared).toContain(layer.id);
    });
  });

  describe('SPATIAL-GRATICULE-FEATURE-1 — ALREADY CORRECTED, NOW GUARDED', () => {
    it('the GRID control governs a layer that actually exists', () => {
      /*
        The original defect: the registry declared the graticule LIVE and
        available while the canvas added no such layer, so toggling GRID changed
        nothing. Both halves are asserted, because either one alone is the bug.
      */
      expect(layerById('graticule')?.available).toBe(true);
      expect(canvas).toContain('map.addSource(GRATICULE_SOURCE_ID');
      expect(canvas).toContain(`apply(GRATICULE_LAYER_ID, layers.graticule !== false);`);
    });

    it('the layer id the canvas toggles is the one the graticule module declares', () => {
      expect(GRATICULE_LAYER_ID).toBeTruthy();
      expect(canvas).toContain("from '@/lib/map/reference/graticule'");
    });

    it('it is generated client-side, so the control costs no request', () => {
      const graticule = layerById('graticule');

      expect(graticule?.runtime).toBe('LIVE');
      expect(String(graticule?.runtimeEvidence)).toMatch(/no dataset and no network request/);
    });
  });
});
