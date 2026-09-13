import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { expect, test, type Page } from '@playwright/test';

import { PROTECTED_FRAMES, frameUrl, type ProtectedFrame } from './cases';
import { decodePng } from './decodePng.mjs';
import { installPinnedEvidence } from './interception.mjs';
import { compareFrame, geographicOccupancy } from './compare-golden-frame.mjs';

/*
 * ════════════════════════════════════════════════════════════════════════════
 * SPATIAL VISUAL GATE — PART B RUNNER (C907 §11, corrected in C907 R2)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LOCATION IS GOVERNANCE. This file, `cases.ts`, `decodePng.mjs`,
 * `interception.mjs`, `compare-golden-frame.mjs` and
 * `golden-authority.manifest.json` live under `scripts/` because C907 §0.1(5)
 * puts the executable visual-release machinery inside the SC fingerprint.
 *
 * ── WHAT C907 R2 CORRECTED, AND WHY IT MATTERED ─────────────────────────────
 *
 * The first issue of this runner could not have executed. It imported
 * `./decodePng`, which did not exist. It read `window.__gnGeographicOccupancy`
 * and `window.__gnWorldSpanDegrees`, neither of which any product file sets —
 * both behind `?? 0`, so the two framing thresholds were being fed zeros. It
 * waited on `[data-gn-idle="true"]`, an attribute nothing emits, so every run
 * would have died on a 20-second timeout. And it relied on `fixture=golden-*`
 * URL parameters that no product code reads.
 *
 * Five phantom hooks. The fix deliberately adds NONE of them to the product:
 *
 *   DETERMINISTIC DATA   pinned by the harness through Playwright routing
 *                        (`interception.mjs`), which fails closed on any
 *                        unpinned endpoint.
 *   SETTLE DETECTION     pixel stability — two identical consecutive captures
 *                        of the pane — instead of a bespoke idle attribute.
 *                        It measures the thing actually cared about (the frame
 *                        has stopped changing) and cannot be satisfied by an
 *                        attribute that lies.
 *   GEOGRAPHIC OCCUPANCY computed from the decoded pane, where it was always a
 *                        share of pane area anyway.
 *   WORLD SPAN           derived from the settled camera in the page's own
 *                        `cam=` URL and the pane width, using the product's
 *                        published Web-Mercator relation. For V1 this is the
 *                        real test: the case pins no zoom, so the span reflects
 *                        whatever the world-fit rule actually chose.
 *
 * The product keeps no test-only code path. Nothing here can be reached by a
 * user typing a query parameter.
 */

const OUT = join(__dirname, '..', '..', 'artifacts', 'spatial-visual');
const BASE = process.env.SPATIAL_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';

/*
 * ── THE MANIFEST IS THE STATUS AUTHORITY, NOT THIS FILE ────────────────────
 *
 * C907 R2 review finding. The runner compared EVERY frame, and
 * `compare-golden-frame.mjs` holds measurements only for V1 and V2 — it returns
 * `no golden measurements for frame V3` by design. So the ordinary Alpha gate
 * could never pass while V3 and V4 were LEGITIMATELY pending: a correct
 * candidate failed for the honest reason that two frames have no approved
 * reference yet.
 *
 * Fixing that by quietly skipping frames without measurements would be the
 * wrong repair — it would make "nobody wrote a threshold" indistinguishable
 * from "the Product Owner approved this frame", which is the failure the whole
 * authority manifest exists to prevent. So status is read from the SC-owned
 * manifest, the one artefact a Product Owner ruling actually moves:
 *
 *   APPROVED  →  capture, compare, must pass. An APPROVED frame with no
 *                measurements is a HARD FAIL, never a skip.
 *   PENDING   →  capture for Part C inspection, DO NOT certify, and say so.
 *   anything else, or a frame missing from the manifest  →  HARD FAIL.
 *
 * PENDING never becomes PASS: a pending frame is reported as NOT CERTIFIED in
 * the test annotations and in stdout, and `--require-all` (the Production gate)
 * fails on it — enforced here as well as in stage 1, so neither entry point can
 * certify a frame nobody approved.
 */
interface ManifestFrame {
  readonly id: string;
  readonly name: string;
  readonly status: 'APPROVED' | 'PENDING' | string;
}

const MANIFEST: { frames: readonly ManifestFrame[] } = JSON.parse(
  readFileSync(join(__dirname, 'golden-authority.manifest.json'), 'utf8'),
);

const REQUIRE_ALL =
  process.env.SPATIAL_VISUAL_REQUIRE_ALL === '1' || process.env.SPATIAL_VISUAL_REQUIRE_ALL === 'true';

const statusOf = (id: string): string | undefined =>
  MANIFEST.frames.find((frame) => frame.id === id)?.status;

/** MapLibre's tile size. The same constant the product frames the world with. */
const TILE_SIZE = 512;

test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });

/** The map pane only: rails and the top bar are not part of the comparison. */
async function panePng(page: Page): Promise<Buffer> {
  const box = await page.locator('[data-gn="map-canvas"]').boundingBox();
  if (box === null) throw new Error('map canvas is not in the page');
  return page.screenshot({ clip: box, type: 'png' });
}

/**
 * Settled means "two consecutive captures are byte-identical", not "a timer
 * expired". Reduced motion is already on, so a frame that still differs is
 * still loading tiles, labels or evidence — and a capture taken then is a
 * measurement of the loading process.
 */
async function captureSettledPane(page: Page, attempts = 12, gapMs = 400): Promise<Buffer> {
  let previous = await panePng(page);
  for (let i = 0; i < attempts; i += 1) {
    await page.waitForTimeout(gapMs);
    const next = await panePng(page);
    if (next.equals(previous)) return next;
    previous = next;
  }
  throw new Error(`map pane never settled: ${attempts} captures ${gapMs}ms apart all differed`);
}

async function labelCounts(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const node of document.querySelectorAll('[data-gn="map-label"]')) {
      const kind = node.getAttribute('data-gn-label-kind') ?? 'unknown';
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    return counts;
  });
}

/**
 * Longitude span of the pane, from the settled camera.
 *
 * Web Mercator: the whole world is TILE_SIZE * 2^zoom CSS pixels wide, so a
 * pane of `width` pixels spans `360 * width / (TILE_SIZE * 2^zoom)` degrees.
 * The zoom is read back from the product's own `cam=` URL contract rather than
 * from a test-only global, so this measures what the product decided.
 */
function worldSpanDegrees(url: string, paneWidth: number): number {
  const cam = new URL(url).searchParams.get('cam');
  if (cam === null) throw new Error('the settled URL carries no cam= parameter to read the camera from');
  const zoom = Number(cam.split('/')[0]);
  if (!Number.isFinite(zoom)) throw new Error(`unreadable zoom in cam=${cam}`);
  return (360 * paneWidth) / (TILE_SIZE * 2 ** zoom);
}

for (const frame of PROTECTED_FRAMES as readonly ProtectedFrame[]) {
  test(`${frame.id} ${frame.name}`, async ({ page }, testInfo) => {
    const status = statusOf(frame.id);

    /* A protected case the authority manifest does not declare is ungoverned:
       it could be certified, or silently ignored, and nobody would know which. */
    expect(
      status,
      `${frame.id} is a protected case but is absent from golden-authority.manifest.json. ` +
        'Every protected frame must carry a declared status.',
    ).toBeDefined();

    expect(
      ['APPROVED', 'PENDING'],
      `${frame.id} has manifest status "${status}". Use APPROVED or PENDING.`,
    ).toContain(status);

    const evidence = await installPinnedEvidence(page);

    await page.setViewportSize(frame.viewport);
    await page.goto(frameUrl(BASE, frame), { waitUntil: 'networkidle' });

    const panePixels = await captureSettledPane(page);

    /* ── DETERMINISM IS ASSERTED, NOT ASSUMED ──
       If any API call went unpinned it was aborted, and this frame was built
       from incomplete data. Naming the paths turns a vague flake into a task.
       This applies to PENDING frames too: a capture a person is asked to judge
       must be as deterministic as one a threshold judges. */
    expect(
      evidence.missing,
      `unpinned API endpoints — add a fixture for each under scripts/spatial-visual/fixtures/:\n  ${evidence.missing.join('\n  ')}`,
    ).toEqual([]);

    mkdirSync(OUT, { recursive: true });
    const slug = `${frame.id}-${frame.name.replace(/\W+/g, '-')}`;
    const suffix = status === 'APPROVED' ? '' : '-PENDING-NOT-CERTIFIED';
    writeFileSync(join(OUT, `${slug}${suffix}.png`), panePixels);
    writeFileSync(
      join(OUT, `${slug}${suffix}-full.png`),
      await page.screenshot({ fullPage: false, type: 'png' }),
    );

    /* ── STRUCTURE, read from the DOM ──
       Applied to every frame regardless of status: these are product
       invariants, not golden comparisons, and they need no approved capture. */
    await expect(page.locator('[data-gn="map-evidence-legend"]')).toBeVisible();
    await expect(page.locator('[data-gn="layer-toggle-rail"]')).toBeVisible();

    const railWidth = (await page.locator('[data-gn="intelligence-rail"]').boundingBox())?.width;
    expect(railWidth).toBe(372);

    /* ── PENDING: CAPTURED, NOT CERTIFIED ── */
    if (status === 'PENDING') {
      const notice =
        `${frame.id} ${frame.name}: PENDING — NOT CERTIFIED. No approved golden capture exists, ` +
        'so no perceptual comparison was performed. The capture written above is for Product Owner ' +
        'inspection (Part C) only and is not evidence that this frame is correct.';

      testInfo.annotations.push({ type: 'PENDING / NOT CERTIFIED', description: notice });
      console.log(`  ${notice}`);

      expect(
        REQUIRE_ALL,
        `${notice}\n--require-all was given (Production gate), so a pending frame is a failure.`,
      ).toBe(false);
      return;
    }

    /* ── APPROVED: MEASURED, AND A MISSING MEASUREMENT IS A HARD FAIL ── */
    const pane = decodePng(panePixels);

    const verdict = compareFrame(
      frame.id,
      {
        pixels: pane.pixels,
        geographicOccupancy: geographicOccupancy(pane.pixels, frame.id),
        worldSpanDegrees: worldSpanDegrees(page.url(), pane.width),
      },
      await labelCounts(page),
    );

    /* An APPROVED frame the comparator holds no measurements for is a gap in the
       gate, not a pass. It fails here with that said plainly rather than being
       skipped into invisibility. */
    expect(
      verdict.failures,
      verdict.failures.join('\n') +
        (verdict.failures.some((f: string) => f.startsWith('no golden measurements'))
          ? `\n${frame.id} is APPROVED in the manifest but compare-golden-frame.mjs holds no ` +
            'measurements for it. An approved frame without a threshold is an uncertified frame.'
          : ''),
    ).toEqual([]);
  });
}

/*
 * PART C IS NOT AUTOMATED, AND THAT IS THE POINT.
 *
 * A threshold that passes proves nothing DRIFTED; it cannot prove the
 * composition is right, because it was tuned on a frame that may already have
 * been wrong. Every defect the C907 audit found would have passed a threshold
 * calibrated on the Alpha build. The captures written to `artifacts/` above
 * exist to be looked at by a person — see docs/spatial-visual-gate.md.
 */
