import { MAX_ZOOM, MIN_ZOOM, WORLD_CAMERA } from './cameraState';
import {
  TILE_SIZE,
  effectiveMinZoom,
  isWorldCameraRequest,
  worldCameraForPane,
  worldFitZoom,
} from './worldFraming';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * VIEWPORT-AWARE WORLD FRAMING — C907 §6
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ACCEPTANCE EVIDENCE. Both Alpha failure cameras the C906 correction pinned
 * are at ZOOM 0.6 — `cam=0.6/-1889/85` and `cam=0.6/241/-85`. C906 healed the
 * longitude and left the zoom floor where it was, so the composition the
 * golden contract rejects — one small Earth inside a large empty field — was
 * still one gesture away.
 *
 * The rule is solved, not chosen: the golden world capture shows ~362° of
 * longitude across its map pane, measured from its own 10° graticule, which is
 * "the world exactly fills the usable map area". These tests assert that
 * relationship at arbitrary viewports rather than asserting a number.
 */
describe('1 · the world fills the pane, at any viewport', () => {
  it('solves for the zoom at which one painted world covers the pane', () => {
    for (const [w, h] of [
      [840, 674],
      [1016, 700],
      [1440, 900],
      [600, 600],
    ] as const) {
      expect(TILE_SIZE * 2 ** worldFitZoom(w, h)).toBeCloseTo(Math.max(w, h), 6);
    }
  });

  it('the binding dimension is the larger one, so no axis is left empty', () => {
    expect(worldFitZoom(840, 674)).toBe(worldFitZoom(840, 100));
    expect(worldFitZoom(400, 900)).toBe(worldFitZoom(900, 900));
  });

  it('NO NUMBER FROM A SCREENSHOT APPEARS HERE', () => {
    /*
      The ruling: *"Do NOT blindly hardcode a zoom merely because a screenshot
      used one."* The golden HUD reads Z 1.6, which is the d3 prototype's scale
      factor and not a MapLibre zoom. The only constant in the module is the
      tile size.
    */
    expect(TILE_SIZE).toBe(512);
    expect(worldFitZoom(1024, 1024)).toBe(1);
  });
});

describe('2 · THE ALPHA UNDERZOOM IS CLOSED', () => {
  it('a 0.6 camera is no longer reachable on a real desktop pane', () => {
    /* 1016 px is the map pane at 1440 CSS between the 52 px and 372 px rails. */
    expect(effectiveMinZoom(1016, 700)).toBeGreaterThan(0.6);
  });

  it('at the floor, the painted world still covers the pane', () => {
    for (const [w, h] of [
      [1016, 700],
      [1440, 900],
      [1920, 1080],
    ] as const) {
      expect(TILE_SIZE * 2 ** effectiveMinZoom(w, h)).toBeGreaterThanOrEqual(Math.min(w, h));
    }
  });

  it('stays inside the product range the state layer can express', () => {
    /*
      `normaliseCamera` clamps every camera into [MIN_ZOOM, MAX_ZOOM]. A floor
      outside that range would be one the URL could not carry, and "URL reload
      reproduces the sane camera" would stop being true.
    */
    expect(effectiveMinZoom(200, 200)).toBe(MIN_ZOOM);
    expect(effectiveMinZoom(1e9, 1e9)).toBe(MAX_ZOOM);
  });

  it('a container with no area is not a measurement', () => {
    expect(effectiveMinZoom(0, 0)).toBe(MIN_ZOOM);
    expect(effectiveMinZoom(Number.NaN, 10)).toBe(MIN_ZOOM);
  });
});

describe('3 · RESIZE IS THE SAME RULE, NOT A SECOND ONE', () => {
  it('a wider pane raises the floor', () => {
    expect(effectiveMinZoom(1600, 900)).toBeGreaterThan(effectiveMinZoom(1000, 900));
  });

  it('the floor is a pure function of the pane, so it cannot drift on resize', () => {
    expect(effectiveMinZoom(1280, 800)).toBe(effectiveMinZoom(1280, 800));
  });
});

describe('4 · RESET WORLD lands on the golden composition', () => {
  it('keeps the golden centre and solves only the zoom', () => {
    const framed = worldCameraForPane(1016, 700);

    expect(framed.center).toEqual(WORLD_CAMERA.center);
    expect(framed.bearing).toBe(WORLD_CAMERA.bearing);
    expect(framed.pitch).toBe(WORLD_CAMERA.pitch);
    expect(framed.zoom).toBe(effectiveMinZoom(1016, 700));
  });

  it('recognises a reset by the CANONICAL world camera, zoom included', () => {
    /*
      ── MAP-ZOOM-IN-CONTROL-1 · THIS ASSERTION USED TO LOCK THE DEFECT IN ───

      It read:

          expect(isWorldCameraRequest({ ...WORLD_CAMERA, zoom: 4.2 })).toBe(true);

      — a camera centred on the world at ANY zoom counted as "a reset". This
      predicate decides whether `EvidenceMapCanvas` REPLACES the requested zoom
      with the pane's framing floor, so that made every world-centred camera
      unzoomable: pressing `+` at the world view produced a new zoom in the
      reducer, had it overwritten with the floor at the engine boundary, and
      committed back to where it started. The control looked enabled and did
      nothing.

      The behaviour the old test protected is kept and restated below: a reset
      is dispatched as the canonical `WORLD_CAMERA` and still matches, while a
      REFRAMED reset no longer needs to — it already carries the floor zoom, so
      applying it unchanged produces exactly the same frame.
    */
    expect(isWorldCameraRequest(WORLD_CAMERA)).toBe(true);

    /* A reader-chosen zoom at the world centre is NOT a reset request. */
    expect(isWorldCameraRequest({ ...WORLD_CAMERA, zoom: 4.2 })).toBe(false);
    expect(isWorldCameraRequest({ ...WORLD_CAMERA, zoom: WORLD_CAMERA.zoom + 0.75 })).toBe(false);

    /* Centre still governs: the right zoom elsewhere is still not a reset. */
    expect(isWorldCameraRequest({ ...WORLD_CAMERA, center: [30.06, -1.94] })).toBe(false);
  });

  it('a REFRAMED world camera applies its own zoom, and that is the same frame', () => {
    /*
      The case the old comment was worried about, made explicit. After framing,
      the committed camera carries `effectiveMinZoom`. It no longer matches the
      predicate — and it does not need to, because `framedZoom` falls through to
      `target.zoom`, which is already the floor. Substituting or not substituting
      produces an identical camera, so nothing regresses.
    */
    const framed = worldCameraForPane(1016, 700);

    expect(framed.zoom).toBe(effectiveMinZoom(1016, 700));
    expect(isWorldCameraRequest(framed)).toBe(framed.zoom === WORLD_CAMERA.zoom);
  });
});

describe('5 · what C906 established is NOT touched', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, 'worldFraming.ts'), 'utf8');

  it('no world copies, no longitude clamp, no pan wall', () => {
    /*
      v1.7's free horizontal pan and C906's canonical longitude domain are
      both outside this module's job, and it must not reach into either.
    */
    expect(source).not.toMatch(/renderWorldCopies|transformConstrain|wrapLongitude|LNG_(MIN|MAX)/);
  });

  it('constrains zoom and nothing else', () => {
    expect(source).not.toMatch(/center:\s*\[/);
    expect(worldCameraForPane(1016, 700).center).toEqual(WORLD_CAMERA.center);
  });
});
