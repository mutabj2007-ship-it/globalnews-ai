import { readFileSync } from 'fs';
import { join } from 'path';

import { WORLD_CAMERA, type CameraState } from '@/lib/map/camera/cameraState';
import { declaredProductRegion, membersFor } from '@/lib/map/region/declaredProductRegions';

import { DEPLOYMENT_JUMP_TARGETS, jumpTargetById } from './breadcrumbs';
import {
  placeForScope,
  resolveLadderPlace,
  scopeForJumpTarget,
  scopesEqual,
  type GeographyScope,
} from './geographyScope';
import { resolveCameraPlace, rungName } from './resolvedLadder';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT A — EXPLICIT GEOGRAPHY SELECTION IS AUTHORITATIVE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO RULING (ALPHA CONVERGENCE R1):
 *
 *   "The defect is the state inversion in which resolveCameraPlace() /
 *    countryAt(camera centre) reconstructs an explicit region selection from
 *    viewport coordinates … explicit user geography selection is authoritative;
 *    camera state must not redefine it."
 *
 * Every numbered block below is one of the eight regression proofs the ruling
 * requires, named so a failure says which proof broke.
 *
 * THE CENTRAL TECHNIQUE, AND WHY IT IS STRONGER THAN CHECKING ONE CAMERA:
 * each scoped assertion is run against a SET of hostile cameras — including
 * cameras deliberately centred on the two countries that were actually
 * misreported — and the scoped answer must be IDENTICAL for all of them. That
 * proves independence from the camera rather than merely a correct answer at
 * one convenient viewport, which is what the defect could still satisfy.
 */

const at = (lon: number, lat: number, zoom: number): CameraState => ({
  ...WORLD_CAMERA,
  center: [lon, lat],
  zoom,
});

/*
  HOSTILE CAMERAS. These are the viewports that produced, or could produce, the
  reported misreads. They are used as INPUTS THAT MUST BE IGNORED, never as
  expected answers — no assertion below depends on which country any of them
  resolves to.
*/
const AFRICA_BOUNDS_CENTRE = at(17, 1.24, 3); // the fitted centre of africa bounds
const OVER_CENTRAL_AFRICAN_REPUBLIC = at(20.9, 6.6, 4);
const OVER_CHAD = at(19.0, 15.4, 4);
const OVER_POLAND = at(19.1, 52.1, 6);
const OVER_OPEN_OCEAN = at(-150, 5, 6);

const HOSTILE_CAMERAS: readonly CameraState[] = [
  AFRICA_BOUNDS_CENTRE,
  OVER_CENTRAL_AFRICAN_REPUBLIC,
  OVER_CHAD,
  OVER_POLAND,
  OVER_OPEN_OCEAN,
];

const AFRICA: GeographyScope = { rung: 'CONTINENT', id: 'africa' };
const EAST_AFRICA: GeographyScope = { rung: 'SUBREGION', id: 'eastAfrica' };
const EUROPE: GeographyScope = { rung: 'CONTINENT', id: 'europe' };
const POLAND: GeographyScope = { rung: 'COUNTRY', id: 'POL' };
const KIGALI: GeographyScope = { rung: 'CITY', id: 'kigali' };

describe('CHECKPOINT A — the camera may not redefine an explicit geography selection', () => {
  /* ── PROOF 1 ──────────────────────────────────────────────────────────── */
  describe('PROOF 1 — AFRICA remains AFRICA and carries no arbitrary country after camera fit', () => {
    it('resolves the continent from the governed registry, not from a coordinate', () => {
      expect(placeForScope(AFRICA).continent).toBe('Africa');
    });

    it('carries NO country and NO city, by construction', () => {
      const place = placeForScope(AFRICA);

      expect(place.country).toBeNull();
      expect(place.countryIso3).toBeNull();
      expect(place.city).toBeNull();
    });

    it('is IDENTICAL from every hostile camera, including one centred on the misreported country', () => {
      const answers = HOSTILE_CAMERAS.map((camera) => resolveLadderPlace(camera, AFRICA));

      for (const answer of answers) {
        expect(answer).toEqual(answers[0]);
        expect(answer.country).toBeNull();
      }
    });

    it('the COUNTRY rung prints nothing even when the camera has reached country scale', () => {
      /*
        The zoom is deliberately deep enough that `reached` is true for COUNTRY.
        Before this correction that is exactly when a country name appeared.
      */
      const deep = resolveLadderPlace(at(20.9, 6.6, 7), AFRICA);

      expect(rungName('COUNTRY', deep, true)).toBeNull();
      expect(rungName('CONTINENT', deep, true)).toBe('Africa');
    });
  });

  /* ── PROOF 2 ──────────────────────────────────────────────────────────── */
  describe('PROOF 2 — EAST AFRICA remains EAST AFRICA and never becomes a camera-centre country', () => {
    it('names the governed region label', () => {
      expect(placeForScope(EAST_AFRICA).subregion).toBe('East Africa');
    });

    it('derives its continent from its own members rather than a second label table', () => {
      expect(placeForScope(EAST_AFRICA).continent).toBe('Africa');
    });

    it('carries NO country, so it cannot become Chad or any other country', () => {
      const place = placeForScope(EAST_AFRICA);

      expect(place.country).toBeNull();
      expect(place.countryIso3).toBeNull();
    });

    it('is IDENTICAL from every hostile camera, including one centred on Chad', () => {
      const answers = HOSTILE_CAMERAS.map((camera) => resolveLadderPlace(camera, EAST_AFRICA));

      for (const answer of answers) {
        expect(answer).toEqual(answers[0]);
        expect(answer.subregion).toBe('East Africa');
        expect(answer.country).toBeNull();
      }
    });

    it('CONTROL — the same cameras DO resolve to different countries unscoped, so the scope is what suppresses it', () => {
      /*
        Without this control the block above could pass simply because the
        camera lookup never resolves anything in a test environment. It proves
        the fallback is alive and that the scope is what overrides it.
      */
      const unscoped = HOSTILE_CAMERAS.map((camera) => resolveCameraPlace(camera).countryIso3);
      const distinct = new Set(unscoped.filter((iso3) => iso3 !== null));

      expect(distinct.size).toBeGreaterThan(1);
    });
  });

  /* ── PROOF 3 ──────────────────────────────────────────────────────────── */
  describe('PROOF 3 — the governed East Africa membership is untouched', () => {
    it('is exactly the eleven declared members, in the declared order', () => {
      expect(membersFor('region:east-africa')).toEqual([
        'BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA',
      ]);
    });

    it('still excludes Sudan and Zambia explicitly rather than silently', () => {
      const region = declaredProductRegion('region:east-africa');

      expect(region?.excludedPending.map((entry) => entry.iso3).sort()).toEqual(['SDN', 'ZMB']);
    });

    it('does not contain Chad, and Chad is not excluded-pending either — it was never a member', () => {
      const region = declaredProductRegion('region:east-africa');

      expect(region?.members).not.toContain('TCD');
      expect(region?.excludedPending.map((entry) => entry.iso3)).not.toContain('TCD');
    });
  });

  /* ── PROOF 4 ──────────────────────────────────────────────────────────── */
  describe('PROOF 4 — EUROPE clears a stale country identity', () => {
    it('names the continent and carries no country', () => {
      const place = placeForScope(EUROPE);

      expect(place.continent).toBe('Europe');
      expect(place.country).toBeNull();
      expect(place.countryIso3).toBeNull();
    });

    it('does not inherit Poland when the camera is still sitting over Poland', () => {
      const place = resolveLadderPlace(OVER_POLAND, EUROPE);

      expect(place.country).toBeNull();
      expect(place.continent).toBe('Europe');
    });
  });

  /* ── PROOF 5 ──────────────────────────────────────────────────────────── */
  describe('PROOF 5 — Poland remains an explicit COUNTRY selection', () => {
    it('resolves name, ISO3 and continent from the registry', () => {
      const place = placeForScope(POLAND);

      expect(place.country).toBe('Poland');
      expect(place.countryIso3).toBe('POL');
      expect(place.continent).toBe('Europe');
    });

    it('survives a camera parked over a different continent entirely', () => {
      const place = resolveLadderPlace(OVER_CHAD, POLAND);

      expect(place.country).toBe('Poland');
      expect(place.countryIso3).toBe('POL');
    });

    it('the Poland jump target still declares its ISO3', () => {
      expect(jumpTargetById('poland')?.countryIso3).toBe('POL');
    });
  });

  /* ── PROOF 6 ──────────────────────────────────────────────────────────── */
  describe('PROOF 6 — Kigali stays a CITY with Rwanda as parent, not a viewport country', () => {
    it('keeps the city identity AND the full parent ladder', () => {
      const place = placeForScope(KIGALI);

      expect(place.city).toBe('Kigali');
      expect(place.country).toBe('Rwanda');
      expect(place.countryIso3).toBe('RWA');
      expect(place.subregion).toBe('East Africa');
      expect(place.continent).toBe('Africa');
    });

    it('takes the parent from the gazetteer seed, not the camera — proven by a hostile viewport', () => {
      const place = resolveLadderPlace(OVER_CHAD, KIGALI);

      expect(place.city).toBe('Kigali');
      expect(place.country).toBe('Rwanda');
    });

    it('renders the golden row AFRICA · EAST AFRICA · RWANDA · KIGALI on reached rungs', () => {
      const place = placeForScope(KIGALI);

      expect([
        rungName('CONTINENT', place, true),
        rungName('SUBREGION', place, true),
        rungName('COUNTRY', place, true),
        rungName('CITY', place, true),
      ]).toEqual(['Africa', 'East Africa', 'Rwanda', 'Kigali']);
    });
  });

  /* ── PROOF 7 + 8 — the state a scope is built from ────────────────────── */
  describe('PROOFS 7 and 8 — scopes are derived from the EXISTING jump targets', () => {
    it('WORLD establishes no scope, which is what lets Reset World fall back to free navigation', () => {
      expect(scopeForJumpTarget(jumpTargetById('world')!)).toBeNull();
    });

    it('every non-world jump target yields a scope, so no destination is left camera-derived', () => {
      for (const target of DEPLOYMENT_JUMP_TARGETS) {
        if (target.rung === 'WORLD') continue;

        expect(scopeForJumpTarget(target)).not.toBeNull();
      }
    });

    it('maps each declared target to the right rung and identity', () => {
      expect(scopeForJumpTarget(jumpTargetById('africa')!)).toEqual(AFRICA);
      expect(scopeForJumpTarget(jumpTargetById('eastAfrica')!)).toEqual(EAST_AFRICA);
      expect(scopeForJumpTarget(jumpTargetById('europe')!)).toEqual(EUROPE);
      expect(scopeForJumpTarget(jumpTargetById('poland')!)).toEqual(POLAND);
      expect(scopeForJumpTarget(jumpTargetById('kigali')!)).toEqual(KIGALI);
    });

    it('a null scope restores the previous camera-derived behaviour EXACTLY', () => {
      /*
        PROOF 7/8 depend on this: Reset World and free panning must behave as
        they always did. `resolveLadderPlace(camera, null)` is the identity of
        `resolveCameraPlace(camera)` — not merely similar to it.
      */
      for (const camera of HOSTILE_CAMERAS) {
        expect(resolveLadderPlace(camera, null)).toEqual(resolveCameraPlace(camera));
      }
    });

    it('scopesEqual distinguishes rung and identity, so the shell cannot conflate two scopes', () => {
      expect(scopesEqual(AFRICA, { rung: 'CONTINENT', id: 'africa' })).toBe(true);
      expect(scopesEqual(AFRICA, EUROPE)).toBe(false);
      expect(scopesEqual(AFRICA, { rung: 'SUBREGION', id: 'africa' })).toBe(false);
      expect(scopesEqual(null, null)).toBe(true);
      expect(scopesEqual(AFRICA, null)).toBe(false);
    });
  });

  /* ══ A2 LIFECYCLE CORRECTION — SELECTIONS SURVIVE CAMERA MANIPULATION ══ */
  describe('A2 — an explicit selection survives ordinary pan and zoom', () => {
    /*
      CTO A2 ruling: *"Do not clear explicit geography selection merely because
      the user pans or zooms the camera. AFRICA, EAST AFRICA, COUNTRY and CITY
      selections must survive ordinary camera manipulation."*

      A pan/zoom sequence is modelled as the camera actually moving — a drag
      across continents and a zoom range from world scale to street scale. The
      scope is held constant because the corrected lifecycle no longer clears it
      on gesture; each test asserts the resolved geography never moves with the
      camera.
    */
    const panAndZoomSequence: readonly CameraState[] = [
      at(17, 1.24, 3),       // where it started
      at(21, 6.6, 5),        // panned onto Central African Republic
      at(19, 15.4, 6),       // panned onto Chad
      at(-58, -12, 4),       // panned to another continent entirely
      at(-150, 5, 9),        // panned to open ocean, zoomed in
      at(30.06, -1.94, 11),  // zoomed to street scale over Kigali
      at(0, 0, 0.5),         // zoomed all the way out, below continent scale
    ];

    const stableAcross = (scope: GeographyScope) =>
      panAndZoomSequence.map((camera) => resolveLadderPlace(camera, scope));

    it('A2-1 — select AFRICA, pan and zoom: still AFRICA, never an arbitrary country', () => {
      const answers = stableAcross(AFRICA);

      for (const answer of answers) {
        expect(answer.continent).toBe('Africa');
        expect(answer.country).toBeNull();
        expect(answer.countryIso3).toBeNull();
        expect(answer.city).toBeNull();
      }
    });

    it('A2-2 — select EAST AFRICA, pan over Chad and CAF: still EAST AFRICA', () => {
      const answers = stableAcross(EAST_AFRICA);

      for (const answer of answers) {
        expect(answer.subregion).toBe('East Africa');
        expect(answer.continent).toBe('Africa');
        expect(answer.country).toBeNull();
      }
    });

    it('A2-3 — select Poland, pan and zoom: the selected intelligence geography remains Poland', () => {
      const answers = stableAcross(POLAND);

      for (const answer of answers) {
        expect(answer.country).toBe('Poland');
        expect(answer.countryIso3).toBe('POL');
        expect(answer.continent).toBe('Europe');
      }
    });

    it('A2-4 — select Kigali, manipulate the camera: CITY identity does not collapse into the camera-centre country', () => {
      const answers = stableAcross(KIGALI);

      for (const answer of answers) {
        expect(answer.city).toBe('Kigali');
        expect(answer.country).toBe('Rwanda');
        expect(answer.countryIso3).toBe('RWA');
      }
    });

    it('A2-5 — Reset World clears explicit geography: a null scope returns camera context', () => {
      /*
        Reset World sets the scope to null. That is what makes the ladder go
        back to describing the camera, and it must be EXACTLY the old behaviour
        so that "Reset World still works" means what it used to mean.
      */
      for (const camera of panAndZoomSequence) {
        expect(resolveLadderPlace(camera, null)).toEqual(resolveCameraPlace(camera));
      }
    });

    it('A2-6 — Previous View restores explicit geography and camera coherently', () => {
      /*
        Previous View restores a camera from history and does NOT clear the
        scope (asserted in the wiring suite). Coherent therefore means: the
        restored pair names the selected geography, not the restored camera.
        Walking back through several cameras must not change the answer.
      */
      const walkBack = [...panAndZoomSequence].reverse();

      for (const scope of [AFRICA, EAST_AFRICA, POLAND, KIGALI]) {
        const answers = walkBack.map((camera) => resolveLadderPlace(camera, scope));

        for (const answer of answers) expect(answer).toEqual(answers[0]);
      }
    });

    it('A2-7 — a scoped rung is not zoom-gated, so zooming out does not un-name the selection', () => {
      /*
        `rungName` drops a rung the camera has not reached. The navigator now
        passes reached=true when a scope exists, because the gate exists to stop
        the CAMERA claiming a place — not to stop the ladder naming what the
        reader explicitly chose. At zoom 0.5 the CONTINENT rung is unreached.
      */
      const zoomedOut = resolveLadderPlace(at(0, 0, 0.5), AFRICA);

      expect(rungName('CONTINENT', zoomedOut, false)).toBeNull();
      expect(rungName('CONTINENT', zoomedOut, true)).toBe('Africa');
      expect(rungName('COUNTRY', zoomedOut, true)).toBeNull();
    });
  });

  /* ── THE RULING'S EXPLICIT PROHIBITION ────────────────────────────────── */
  describe('NO SPECIAL-CASING — the defect class is removed, not two of its symptoms', () => {
    const source = readFileSync(join(__dirname, 'geographyScope.ts'), 'utf-8');

    /*
      CTO: "Do not hard-code special-case exclusions for CAF/Chad." Asserted
      against the implementation only; this spec names both countries on
      purpose, because a regression test that cannot say what went wrong is
      worth less than one that can.
    */
    it('names no country code or country name anywhere in the implementation', () => {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      expect(code).not.toMatch(/\bCAF\b/);
      expect(code).not.toMatch(/\bTCD\b/);
      expect(code).not.toMatch(/Central African/i);
      expect(code).not.toMatch(/\bChad\b/i);
    });

    it('writes no region membership of its own — declaredProductRegions stays the only source', () => {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      for (const iso3 of ['BDI', 'COD', 'DJI', 'ERI', 'ETH', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA']) {
        expect(code).not.toContain(`'${iso3}'`);
      }
    });

    it('hard-codes no continent or region label either — every name is looked up', () => {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      expect(code).not.toMatch(/['"`]Africa['"`]/);
      expect(code).not.toMatch(/['"`]East Africa['"`]/);
      expect(code).not.toMatch(/['"`]Europe['"`]/);
    });
  });
});
