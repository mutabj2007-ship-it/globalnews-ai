import { readFileSync } from 'fs';
import { join } from 'path';

import {
  LAYER_REGISTRY,
  layerAppliesInMode,
  layerById,
  layerUnavailableReason,
  layersForMode,
  railLayers,
} from '@/lib/map/layers/layerRegistry';
import {
  LIVE_MAP_MODES,
  MAP_MODES,
  type MapMode,
  type ModeUnavailableReason,
} from '@/lib/map/state/mapState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT E-3 — THE LAYER RAIL SAYS WHY, AND ASKS ABOUT THE MODE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Covers SPATIAL-LAYER-CONTROL-DUPLICATION-1.
 *
 * ─── DEFECT 1 · THE PHRASE THE RULING NAMES, STILL IN THE PRODUCT ─────────
 *
 * The ruling says: *"Placeholder semantics must distinguish NOT BUILT /
 * NOT CONNECTED / NO DATA FOR THIS GEOGRAPHY / TIER RESTRICTED / TEMPORARILY
 * UNAVAILABLE. Do not collapse every condition into 'No data yet.'"*
 *
 * E-1 fixed that for the MODE row. The LAYER rail was still rendering the
 * literal string `'No data yet'` for every unavailable layer — admin-1 with no
 * geometry at all, and `situations` whose substrate IS registered but serves no
 * route, got the same four words.
 *
 * NOTHING NEW WAS INVENTED TO FIX IT. The registry already records `runtime`
 * (LIVE / GATED / NOT_IMPLEMENTED / FAILED_MEASUREMENT) with `runtimeEvidence`
 * stating the case in each layer's own words, so the reason is DERIVED from
 * evidence already present rather than assigned by taste.
 *
 * ─── DEFECT 2 · TWO AUTHORITIES ON APPLICABILITY, AND NEITHER USED TOGETHER ─
 *
 * `layersForMode()` has always answered "which layers may this mode draw", and
 * NOTHING CALLED IT — it was dead code. Meanwhile the rail decided what to
 * offer from `available` alone and did `void mode`, ignoring the question
 * entirely. Two answers to one question, used neither together nor at all.
 *
 * HOW MUCH OF THIS IS REACHABLE — MEASURED, NOT ASSUMED. My first reading was
 * that the gap was entirely latent. The suite below disproved it, and the
 * accurate statement is narrower:
 *
 *   INSIDE WORLD AND EVIDENCE — the only modes a reader can enter — the gap IS
 *   latent. Everything that does not apply there is already disabled for being
 *   unbuilt, so this fix changes nothing visible today.
 *
 *   INSIDE THE BETA MODES it is already real. `countryEvidence` is BUILT and
 *   does not apply in SITUATIONS or SOURCES, so the old rail would have offered
 *   it there as a fully operable control over a mode that does not draw it —
 *   the exact failure the rail's own doc comment forbids: "a toggle that
 *   switches on and draws nothing teaches the user that the world is empty
 *   there". Those modes are unreachable while they are beta, which is the only
 *   reason no reader has met it. That is not a reason to leave it.
 *
 * The rail now asks, and a non-applicable layer is DISABLED WITH ITS REASON
 * rather than removed, which is what `RAIL_EVIDENCE_LAYERS`' comment already
 * promised and no code performed.
 */

const stripComments = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const rail = stripComments(
  readFileSync(join(__dirname, 'shell', 'LayerToggleRail.tsx'), 'utf-8'),
);
const en = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'en.ts'), 'utf-8');
const pl = readFileSync(join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'pl.ts'), 'utf-8');

const REASONS: readonly ModeUnavailableReason[] = [
  'NOT_BUILT',
  'NOT_CONNECTED',
  'NO_DATA_FOR_GEOGRAPHY',
  'TIER_RESTRICTED',
  'TEMPORARILY_UNAVAILABLE',
];

describe('E-3 — an unavailable layer says which kind of unavailable', () => {
  describe('THE REASON IS DERIVED FROM RUNTIME EVIDENCE, NOT ASSIGNED', () => {
    it('an available layer has no reason to give', () => {
      for (const layer of LAYER_REGISTRY.filter((l) => l.available)) {
        expect(layerUnavailableReason(layer)).toBeNull();
      }
    });

    it('every unavailable layer has one', () => {
      for (const layer of LAYER_REGISTRY.filter((l) => !l.available)) {
        expect(layerUnavailableReason(layer)).not.toBeNull();
      }
    });

    it('a genuinely missing dataset is NOT_BUILT — there is nothing to connect', () => {
      expect(layerUnavailableReason(layerById('admin2')!)).toBe('NOT_BUILT');
    });

    it('bundled reference geography is LIVE once the renderer and same-origin data both exist', () => {
      for (const id of ['rivers', 'admin1'] as const) {
        const layer = layerById(id)!;
        expect(layer.runtime).toBe('LIVE');
        expect(layer.available).toBe(true);
        expect(layerUnavailableReason(layer)).toBeNull();
      }
    });

    it('a closed gate is NOT_CONNECTED, because the substrate exists', () => {
      /*
        `situations` is GATED: the Situation substrate IS registered and serves
        no route. Calling that "not built" would be FALSER than the generic word
        it replaces — the same test E-1 applied to Watch, Change and Sources.
      */
      const situations = layerById('situations')!;

      expect(situations.runtime).toBe('GATED');
      expect(layerUnavailableReason(situations)).toBe('NOT_CONNECTED');
    });

    it('and the two are genuinely different answers, not one word twice', () => {
      expect(layerUnavailableReason(layerById('situations')!)).not.toBe(
        layerUnavailableReason(layerById('admin1')!),
      );
    });

    it('a layer that worked and stopped promises nothing', () => {
      const failed = {
        ...layerById('admin1')!,
        runtime: 'FAILED_MEASUREMENT' as const,
        available: false,
      };

      expect(layerUnavailableReason(failed)).toBe('TEMPORARILY_UNAVAILABLE');
    });
  });

  describe('THE RAIL RENDERS THE SPECIFIC REASON', () => {
    it('reads the derived reason rather than the generic label', () => {
      expect(rail).toContain('const unavailableReason = layerUnavailableReason(layer);');
      expect(rail).toContain('labels.unavailableReasons[unavailableReason]');
    });

    it('keeps the generic label only as a fallback', () => {
      /*
        Retained, not removed: a layer whose runtime says nothing usable still
        needs a word. It is no longer the answer for every unbuilt layer.
      */
      expect(rail).toContain('unavailableReason === null ? labels.unavailable');
    });

    it('exposes the reason as data, as the mode row does', () => {
      expect(rail).toContain('data-gn-unavailable-reason={');
    });
  });

  describe('THE RAIL ASKS ABOUT THE MODE — ONE AUTHORITY, NOT TWO', () => {
    it('no longer discards the mode prop', () => {
      /* The precise shape of the dead-code defect. */
      expect(rail).not.toContain('void mode;');
    });

    it('consults the registry predicate rather than a second rule of its own', () => {
      expect(rail).toContain('const applies = layerAppliesInMode(layer, mode);');
    });

    it('and layersForMode is built on that same predicate, so they cannot drift', () => {
      for (const mode of MAP_MODES) {
        expect(layersForMode(mode).map((l) => l.id)).toEqual(
          LAYER_REGISTRY.filter((l) => layerAppliesInMode(l, mode)).map((l) => l.id),
        );
      }
    });

    it('a layer outside the mode is refused, with its own reason', () => {
      expect(rail).toContain('const operable = layer.available && applies;');
      expect(rail).toContain('if (!operable) return;');
      expect(rail).toContain('labels.notInMode');
    });

    it('and it is DISABLED, never removed — the rail geometry does not move', () => {
      /*
        The stability rule: the same controls in the same places whatever mode
        is active. Removing one would slide the rest under the user's cursor.
      */
      for (const mode of MAP_MODES) {
        expect(railLayers().map((l) => l.id)).toEqual(railLayers().map((l) => l.id));
        void mode;
      }
      expect(rail).not.toContain('.filter((l) => layerAppliesInMode');
    });

    it('a layer with no declared modes applies everywhere', () => {
      /* Empty means "every mode" — reference geography is not mode-specific. */
      const graticule = layerById('graticule')!;

      expect(graticule.modes).toEqual([]);
      for (const mode of MAP_MODES) expect(layerAppliesInMode(graticule, mode)).toBe(true);
    });

    it('a layer with declared modes applies only in those', () => {
      const situations = layerById('situations')!;

      expect(layerAppliesInMode(situations, 'SITUATIONS')).toBe(true);
      expect(layerAppliesInMode(situations, 'CHANGE')).toBe(true);
      expect(layerAppliesInMode(situations, 'WORLD')).toBe(false);
    });
  });

  describe('HOW MUCH OF THIS IS REACHABLE TODAY — STATED EXACTLY', () => {
    /*
      My first draft of this block claimed the gap was entirely latent. It is
      not, and this suite caught it: there ARE available layers that do not
      apply in some mode. The accurate statement is narrower, and worth having.
    */

    it('inside the LIVE modes, every non-applicable rail layer is also unavailable', () => {
      /*
        WORLD and EVIDENCE are the only modes a reader can actually enter, and
        there the gap is latent — anything that does not apply is already
        disabled for being unbuilt. So this fix changes nothing visible today.
      */
      for (const mode of LIVE_MAP_MODES) {
        for (const layer of railLayers()) {
          if (!layerAppliesInMode(layer, mode)) expect(layer.available).toBe(false);
        }
      }
    });

    it('but in the BETA modes it is already real, not hypothetical', () => {
      /*
        countryEvidence declares WORLD/EVIDENCE/WATCH/CHANGE, is BUILT, and does
        not apply in SITUATIONS or SOURCES — so the old rail would have offered
        it there as a fully operable control over a mode that does not draw it.

        It is the ONLY one, because every other mode-scoped rail layer is also
        unavailable today. That is worth pinning precisely: if a second name
        appears here, a newly built layer has inherited the same gap.

        Those modes are unreachable while they are beta, which is the only
        reason no reader has met this. It is not a reason to leave it.
      */
      const offenders: string[] = [];

      for (const mode of MAP_MODES) {
        if ((LIVE_MAP_MODES as readonly MapMode[]).includes(mode)) continue;
        for (const layer of railLayers()) {
          if (layer.available && !layerAppliesInMode(layer, mode)) offenders.push(layer.id);
        }
      }

      expect([...new Set(offenders)].sort()).toEqual(['countryEvidence']);
    });

    it('so enabling any beta mode is the trigger, and the guard is now in place', () => {
      const scoped = railLayers().filter((l) => l.modes.length > 0);

      expect(scoped.map((l) => l.id)).toContain('sourceDensity');
      expect(scoped.map((l) => l.id)).toContain('situations');
    });
  });

  describe('BOTH LANGUAGES CARRY THE NEW LABELS', () => {
    it('en declares every reason for layers', () => {
      const layersBlock = en.slice(en.indexOf('layers: {'));

      for (const reason of REASONS) expect(layersBlock).toContain(`${reason}:`);
    });

    it('pl declares every reason for layers', () => {
      const layersBlock = pl.slice(pl.indexOf('layers: {'));

      for (const reason of REASONS) expect(layersBlock).toContain(`${reason}:`);
    });

    it('both declare the not-in-mode label', () => {
      expect(en).toContain('notInMode:');
      expect(pl).toContain('notInMode:');
    });

    it('not-in-mode does NOT claim the layer is unbuilt', () => {
      /*
        The layer works; this mode simply does not draw it. Saying "not built"
        here would be untrue, which is the whole point of separating the two.
      */
      expect(en).toContain("notInMode: 'Not shown in this mode'");
    });

    it('and "No data yet" survives only as the fallback', () => {
      expect(en).toContain("unavailable: 'No data yet'");
    });
  });
});
