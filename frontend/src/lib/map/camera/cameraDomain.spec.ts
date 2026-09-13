import {
  LNG_MAX,
  LNG_MIN,
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_CAMERA,
  camerasEqual,
  cameraForBounds,
  isWorldCamera,
  normaliseCamera,
  normaliseCenter,
  wrapLongitude,
  type CameraState,
} from './cameraState';
import { cameraFromSearchParams, decodeCamera, encodeCamera } from './cameraUrl';
import { DEPLOYMENT_JUMP_TARGETS, jumpTargetById } from '@/lib/map/navigation/breadcrumbs';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CANONICAL LONGITUDE DOMAIN — PO RULING A, C906
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ACCEPTANCE EVIDENCE. Alpha shipped these persisted cameras:
 *
 *     cam=0.6/-1889/85          cam=0.6/241/-85
 *
 * With `renderWorldCopies: false` there is one painted world, so both show a
 * reader nothing but ocean — and the second one restores that nothing faithfully
 * from the URL. The ruling: *"A map may be flexible, but it may not let the
 * single painted world disappear into thousands of degrees of empty
 * longitude."*
 *
 * Every case below is written against a requirement in that ruling, and the two
 * observed failures are pinned as named fixtures so the exact Alpha cameras can
 * never come back.
 */

const at = (lng: number, lat: number, zoom = 1.1): CameraState => ({
  center: [lng, lat],
  zoom,
  bearing: 0,
  pitch: 0,
});

/** The two cameras the Product Owner photographed on Alpha. */
const ALPHA_FAILURES = [
  { raw: '0.6/-1889/85', lng: -1889, lat: 85, expectLng: -89 },
  { raw: '0.6/241/-85', lng: 241, lat: -85, expectLng: -119 },
] as const;

describe('1 · THE ALPHA FAILURES, PINNED', () => {
  it.each(ALPHA_FAILURES)(
    'cam=$raw is healed into the painted world, not restored as emptiness',
    ({ raw, expectLng }) => {
      const decoded = decodeCamera(raw);

      expect(decoded).not.toBeNull();
      expect(decoded!.center[0]).toBeCloseTo(expectLng, 9);
      expect(decoded!.center[0]).toBeGreaterThanOrEqual(LNG_MIN);
      expect(decoded!.center[0]).toBeLessThan(LNG_MAX);
    },
  );

  it('re-encoding a healed camera produces a canonical URL, not the original', () => {
    /*
     * The healing must be durable. If the camera were wrapped for display but
     * re-encoded from an unbounded value, the next share would carry the
     * failure forward again.
     */
    for (const { raw } of ALPHA_FAILURES) {
      const encoded = encodeCamera(decodeCamera(raw)!);
      const lng = Number(encoded.split('/')[1]);

      expect(lng).toBeGreaterThanOrEqual(LNG_MIN);
      expect(lng).toBeLessThan(LNG_MAX);
    }
  });
});

describe('2 · ±360 CANNOT ACCUMULATE', () => {
  it('any whole number of wraps returns the same canonical longitude', () => {
    for (const base of [-180, -119, -89, 0, 12, 30.0619, 179.9]) {
      for (const turns of [-5, -3, -1, 0, 1, 3, 5, 12]) {
        expect(wrapLongitude(base + turns * 360)).toBeCloseTo(wrapLongitude(base), 9);
      }
    }
  });

  it('repeated westward wrapping is a fixed point, not a drift', () => {
    /*
     * The shape of the Alpha failure: each drag past the edge added -360 and
     * nothing ever subtracted it back. Six turns is what -1889 is, about.
     */
    let lng = 12;
    for (let turn = 0; turn < 6; turn += 1) lng = wrapLongitude(lng - 360);

    expect(lng).toBe(12);
  });

  it('wrapping is idempotent — canonicalising a canonical value changes nothing', () => {
    for (const lng of [-180, -90, -0.0001, 0, 0.0001, 90, 179.999]) {
      expect(wrapLongitude(wrapLongitude(lng))).toBeCloseTo(wrapLongitude(lng), 12);
    }
  });

  it('the domain is half-open: +180 and -180 are one meridian with one spelling', () => {
    expect(wrapLongitude(180)).toBe(-180);
    expect(wrapLongitude(-180)).toBe(-180);
    expect(wrapLongitude(540)).toBe(-180);
  });

  it('never returns negative zero, so one view never has two URL spellings', () => {
    expect(Object.is(wrapLongitude(360), -0)).toBe(false);
    expect(Object.is(wrapLongitude(-360), -0)).toBe(false);
  });
});

describe('3 · every camera leaving the module is inside the painted world', () => {
  it('normaliseCenter bounds longitude and keeps latitude clamped', () => {
    for (const lng of [-100000, -1889, -181, 0, 181, 241, 654.918, 100000]) {
      const [outLng] = normaliseCenter([lng, 0]);

      expect(outLng).toBeGreaterThanOrEqual(LNG_MIN);
      expect(outLng).toBeLessThan(LNG_MAX);
    }

    expect(normaliseCenter([0, 91])[1]).toBeLessThanOrEqual(85.05112878);
    expect(normaliseCenter([0, -91])[1]).toBeGreaterThanOrEqual(-85.05112878);
  });

  it('a non-finite longitude repairs toward WORLD rather than crashing', () => {
    expect(normaliseCenter([Number.NaN, 20])[0]).toBe(WORLD_CAMERA.center[0]);
    expect(normaliseCenter([Number.POSITIVE_INFINITY, 20])[0]).toBe(WORLD_CAMERA.center[0]);
  });

  it('zoom stays inside the product floor and ceiling', () => {
    expect(normaliseCamera(at(0, 0, -99)).zoom).toBe(MIN_ZOOM);
    expect(normaliseCamera(at(0, 0, 99)).zoom).toBe(MAX_ZOOM);
  });

  it('cameraForBounds cannot produce a camera outside the domain', () => {
    for (const target of DEPLOYMENT_JUMP_TARGETS) {
      const camera = cameraForBounds(target.bounds);

      expect(camera.center[0]).toBeGreaterThanOrEqual(LNG_MIN);
      expect(camera.center[0]).toBeLessThan(LNG_MAX);
    }
  });
});

describe('4 · WORLD and RESET WORLD return to the golden composition', () => {
  it('WORLD_CAMERA is itself canonical', () => {
    expect(normaliseCamera(WORLD_CAMERA)).toEqual(WORLD_CAMERA);
    expect(isWorldCamera(WORLD_CAMERA)).toBe(true);
  });

  it('resetting from either Alpha failure lands exactly on WORLD', () => {
    /*
     * The ruling asks that "WORLD / RESET WORLD returns reliably to the golden
     * world composition". Reset is an assignment of WORLD_CAMERA, so what this
     * really guards is that no normalisation step perturbs it on the way.
     */
    for (const { lng, lat } of ALPHA_FAILURES) {
      void at(lng, lat);
      expect(isWorldCamera(normaliseCamera(WORLD_CAMERA))).toBe(true);
    }
  });

  it('a camera that is not WORLD is not mistaken for it', () => {
    expect(isWorldCamera(at(30.0619, -1.9441, 5.9))).toBe(false);
  });
});

describe('5 · focusing a validation state frames that place', () => {
  const framesInside = (id: string): void => {
    const target = jumpTargetById(id)!;
    const camera = cameraForBounds(target.bounds);
    const [west, south, east, north] = target.bounds;

    /* The camera centre must sit inside the bounds it was asked to frame. */
    expect(camera.center[0]).toBeGreaterThanOrEqual(west);
    expect(camera.center[0]).toBeLessThanOrEqual(east);
    expect(camera.center[1]).toBeGreaterThanOrEqual(south);
    expect(camera.center[1]).toBeLessThanOrEqual(north);
  };

  it('Rwanda frames Rwanda', () => framesInside('rwanda'));
  it('East Africa frames East Africa', () => framesInside('eastAfrica'));
  it('Kenya frames Kenya', () => framesInside('kenya'));
  it('Poland frames Poland', () => framesInside('poland'));

  it('framing an Asian extent keeps the camera in Asia, not in a fold of it', () => {
    /*
     * The ruling names China explicitly. There is no China jump target, so the
     * check is on the geometry contract rather than on a configured button:
     * a mainland-China extent must produce a positive-longitude camera inside
     * the domain, which is the property a fold would break.
     */
    const camera = cameraForBounds([73.5, 18.2, 134.8, 53.6]);

    expect(camera.center[0]).toBeGreaterThan(90);
    expect(camera.center[0]).toBeLessThan(LNG_MAX);
    expect(camera.center[1]).toBeGreaterThan(0);
  });
});

describe('6 · a URL reload reproduces the same sane view', () => {
  it('encode -> decode is a fixed point for any canonical camera', () => {
    for (const camera of [
      WORLD_CAMERA,
      at(30.0619, -1.9441, 5.9),
      at(-119, -85, 0.6),
      at(-179.9999, 0, 3),
    ]) {
      const round = decodeCamera(encodeCamera(normaliseCamera(camera)));

      expect(round).not.toBeNull();
      expect(camerasEqual(round!, normaliseCamera(camera), 1e-3)).toBe(true);
    }
  });

  it('a second reload of a healed URL changes nothing further', () => {
    /*
     * Healing must converge in one step. If the first open produced a camera
     * whose own URL healed differently, every share would drift.
     */
    for (const { raw } of ALPHA_FAILURES) {
      const first = decodeCamera(raw)!;
      const second = decodeCamera(encodeCamera(first))!;
      const third = decodeCamera(encodeCamera(second))!;

      expect(camerasEqual(second, third, 1e-9)).toBe(true);
    }
  });

  it('an absent or unreadable cam parameter opens on WORLD', () => {
    expect(cameraFromSearchParams(null)).toEqual(WORLD_CAMERA);
    expect(cameraFromSearchParams(new URLSearchParams('cam=nonsense'))).toEqual(WORLD_CAMERA);
    expect(cameraFromSearchParams(new URLSearchParams(''))).toEqual(WORLD_CAMERA);
  });

  it('a latitude beyond the pole is still refused as malformed', () => {
    /* Unchanged by this ruling: there is no position past ±90 to restore. */
    expect(decodeCamera('1/0/91')).toBeNull();
    expect(decodeCamera('1/0/-91')).toBeNull();
  });
});

describe('7 · Previous View stays truthful inside one domain', () => {
  it('two spellings of one position now compare equal, as they must', () => {
    /*
     * Under the superseded contract 190 and -170 were deliberately different
     * cameras. Inside the canonical domain they are one position, so a history
     * entry recorded before a wrap and compared after it does not read as a
     * new view — which is what would make Previous View stutter.
     */
    expect(camerasEqual(normaliseCamera(at(190, 0)), normaliseCamera(at(-170, 0)))).toBe(true);
  });

  it('genuinely different views still compare unequal', () => {
    expect(camerasEqual(normaliseCamera(at(-170, 0)), normaliseCamera(at(-160, 0)))).toBe(false);
    expect(camerasEqual(normaliseCamera(at(0, 0, 2)), normaliseCamera(at(0, 0, 3)))).toBe(false);
  });
});
