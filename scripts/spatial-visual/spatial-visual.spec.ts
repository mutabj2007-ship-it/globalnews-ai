import { readFileSync } from 'fs';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { expect, test, type Page } from '@playwright/test';

import { PROTECTED_FRAMES, frameUrl, type ProtectedFrame } from './cases';

/*
 * ════════════════════════════════════════════════════════════════════════════
 * SPATIAL VISUAL GATE — PART B RUNNER (C907 §11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LOCATION IS GOVERNANCE. This file, `cases.ts`, `compare-golden-frame.mjs` and
 * `golden-authority.manifest.json` live under `scripts/` because the C907
 * §0.1(5) ruling puts the executable visual-release machinery inside the SC
 * fingerprint: *"The acceptance mechanism itself must never be outside
 * fingerprint governance."* Moving any of them out of `scripts/` removes them
 * from candidate identity, which is the defect the ruling closes.
 *
 * Captures the four protected frames and hands each one to
 * `scripts/compare-golden-frame.mjs`, which holds the golden measurements and
 * does the judging. The split is deliberate: the measurements are pure
 * functions with no browser in them, so they can be unit-tested and were —
 * both golden captures pass their own thresholds, and each fails the other's.
 *
 * ── WHAT IS ASSERTED FROM THE DOM RATHER THAN FROM PIXELS ───────────────────
 *
 * Label counts, HUD presence and rail geometry. All three are exact in the DOM
 * and approximate in a screenshot, and all three are font- and
 * platform-independent there. Reading them from pixels would be the fragile
 * choice, not the rigorous one.
 *
 * ── DETERMINISM ─────────────────────────────────────────────────────────────
 *
 * Fixed viewport, fixed camera through the product's own `cam=` URL, pinned
 * fixture evidence, reduced motion, and a wait on the map's own idle signal
 * rather than on a timer. A capture taken while tiles or the evidence feed are
 * still settling is not a measurement of anything.
 */

const OUT = join(__dirname, '..', '..', 'artifacts', 'spatial-visual');
const BASE = process.env.SPATIAL_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';

test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });

/** The map pane only: rails and the top bar are not part of the comparison. */
async function panePixels(page: Page): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  const box = await page.locator('[data-gn="map-canvas"]').boundingBox();
  if (box === null) throw new Error('map canvas is not in the page');

  const shot = await page.screenshot({ clip: box, type: 'png' });
  const { decodePng } = await import('./decodePng');

  return decodePng(shot);
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

for (const frame of PROTECTED_FRAMES) {
  test(`${frame.id} ${frame.name}`, async ({ page }) => {
    await page.setViewportSize(frame.viewport);
    await page.goto(frameUrl(BASE, frame), { waitUntil: 'networkidle' });

    /* The map's own settled signal, not a sleep. */
    await page.waitForSelector('[data-gn="map-canvas"][data-gn-idle="true"]', { timeout: 20_000 });

    const shot = await page.screenshot({ fullPage: false, type: 'png' });
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${frame.id}-${frame.name.replace(/\W+/g, '-')}.png`), shot);

    /* ── STRUCTURE, read from the DOM ── */
    await expect(page.locator('[data-gn="map-evidence-legend"]')).toBeVisible();
    await expect(page.locator('[data-gn="layer-toggle-rail"]')).toBeVisible();

    const railWidth = (await page.locator('[data-gn="intelligence-rail"]').boundingBox())?.width;
    expect(railWidth).toBe(372);

    /* ── MEASUREMENT, handed to the golden comparator ── */
    const pane = await panePixels(page);
    const { compareFrame } = await import('./compare-golden-frame.mjs');

    const verdict = compareFrame(frame.id, {
      pixels: pane.pixels,
      geographicOccupancy: await page.evaluate(() => window.__gnGeographicOccupancy ?? 0),
      worldSpanDegrees: await page.evaluate(() => window.__gnWorldSpanDegrees ?? 0),
    }, await labelCounts(page));

    expect(verdict.failures).toEqual([]);
  });
}

/*
 * PART C IS NOT AUTOMATED, AND THAT IS THE POINT.
 *
 * A threshold that passes proves nothing DRIFTED; it cannot prove the
 * composition is right, because it was tuned on a frame that may already have
 * been wrong. Every defect the C907 audit found would have passed a threshold
 * calibrated on the Alpha build. The four captures written to `artifacts/`
 * above exist to be looked at by a person — see docs/spatial-visual-gate.md.
 */
