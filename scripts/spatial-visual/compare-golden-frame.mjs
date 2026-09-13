#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * SPATIAL VISUAL GATE — PART B · PERCEPTUAL COMPARISON (C907 §11)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * *"perceptual screenshot comparison: tolerances for font/platform
 * antialiasing, but enough sensitivity to detect palette, luminance, density
 * and framing regressions."*
 *
 * ── WHY NOT PIXEL EQUALITY, AND WHY NOT ONLY A DIFF SCORE ───────────────────
 *
 * Raw pixel equality is unusable: glyph rasterisation differs between
 * platforms, so a correct frame fails on a different machine and the gate gets
 * switched off. A single perceptual score is almost as bad in the other
 * direction — it answers "how different" and never "different HOW", so a
 * threshold loose enough to tolerate text is loose enough to hide a missing
 * coastline.
 *
 * So this measures FOUR SPECIFIC PROPERTIES, each chosen because a named
 * failure in the ruling moves it and platform noise does not:
 *
 *   PALETTE OCCUPANCY      what share of the map pane each approved token
 *                          covers. A missing fill, a wrong opacity or a
 *                          redesigned palette moves this immediately;
 *                          antialiasing moves it by a fraction of a point.
 *   LUMINANCE DISTRIBUTION mean, median and the fraction of the pane below a
 *                          near-black threshold. This is the 8/8/16 failure,
 *                          measured directly.
 *   GEOGRAPHIC OCCUPANCY   land + ocean as a share of the pane, and the
 *                          painted world's width against the pane's. This is
 *                          the tiny-world failure.
 *   STRUCTURAL COUNTS      label counts per class, read from the DOM rather
 *                          than from pixels, so they are exact and completely
 *                          font-independent. This is label explosion.
 *
 * ── THE NUMBERS BELOW ARE MEASUREMENTS, NOT PREFERENCES ─────────────────────
 *
 * Every expectation is measured from the two golden captures
 * (`GOLDEN-01-world-evidence.png`, `GOLDEN-02-rwanda-selected.png`) over their
 * own map pane, and is recorded here with the value it came from. They are the
 * authority; this file is a transcription of them.
 *
 * Usage: node scripts/compare-golden-frame.mjs --frame V2 --capture <png>
 */

/**
 * GOLDEN MEASUREMENTS — map pane only, excluding rails and top bar.
 *
 * Tolerances are asymmetric on purpose. A pane getting DARKER than golden is
 * the failure this whole contract exists about, so `nearBlackFraction` has
 * almost no headroom; a pane getting slightly lighter is not a known failure
 * mode and is given room.
 */
export const GOLDEN = {
  V1: {
    name: 'WORLD',
    /*
      MEASURED AT CHANNEL TOLERANCE 2, AND THE TOLERANCE IS PART OF THE
      MEASUREMENT. `#1e2b36` (bare land) and `#212e39` (land under the
      noEvidence .07 wash) are three steps apart per channel: at tolerance 6
      each one's count includes the other and the two states cannot be told
      apart. Tolerance 2 separates them, which is what makes "the noEvidence
      wash disappeared" a detectable regression rather than a rounding change.
    */
    palette: {
      /* ocean. Measured 54.23%. */
      '#040a10': { share: 54.2, tolerance: 7 },
      /* bare land. Measured 16.56%. */
      '#1e2b36': { share: 16.6, tolerance: 5 },
      /* land under the noEvidence .07 wash. Measured 3.46%. */
      '#212e39': { share: 3.5, tolerance: 3 },
    },
    luminance: { mean: 21.9, median: 10.2, tolerance: 8 },
    /*
      Measured on the golden world pane: 57.7 % of it sits below luminance 12,
      and that is CORRECT — it is ocean. `#040a10` has a relative luminance of
      9.2, so a world view is legitimately mostly dark. The failure at world
      scale is not darkness but the ABSENCE OF LAND, which shows up as this
      fraction climbing toward 100 while `geographicOccupancy` falls.
    */
    nearBlack: { threshold: 12, maxFraction: 0.70 },
    /*
      Every geographic surface as a share of the pane, at tolerance 2.
      Measured: 54.23 + 16.56 + 3.46 + 0.10 = 74.35%. The remainder is labels,
      HUD, evidence marks, halos and their antialiasing.
    */
    geographicOccupancy: { min: 66 },
    /* Measured: the golden world pane spans ~362° of longitude. */
    worldSpanDegrees: { min: 330 },
    labels: { river: 0, city: 0, lake: 0 },
    /* The brightest 2% of land/water boundary pixels. Measured: (81.9,109.4,122.7). */
    coastlineBrightest: { rgb: [82, 109, 123], tolerance: 14 },
  },
  V2: {
    name: 'RWANDA / EAST AFRICA',
    /*
      At tolerance 2, and these three numbers are the arithmetic proof that the
      approved tokens are what the golden frame is made of:

        land #1e2b36 + rgba(58,214,230,.12) = (33, 64, 75) = #21404b  exactly
        land #1e2b36 + rgba(74,91,103,.07)  = (33, 46, 57) = #212e39  exactly
    */
    palette: {
      /* land under the verified-evidence .12 fill. Measured 18.11%. */
      '#21404b': { share: 18.1, tolerance: 5 },
      /* bare land. Measured 9.05%. */
      '#1e2b36': { share: 9.1, tolerance: 4 },
      /* land under the noEvidence .07 wash. Measured 8.24%. */
      '#212e39': { share: 8.2, tolerance: 4 },
    },
    luminance: { mean: 48.8, median: 50.0, tolerance: 10 },
    /*
      Measured on the golden Rwanda pane: **0.0 %** below luminance 12. At
      regional scale the frame is land, and land is lifted. This is where the
      8/8/16 failure is caught: a pane of `#080b12` measures luminance 10.9 and
      would put this at 100 %.
    */
    nearBlack: { threshold: 12, maxFraction: 0.02 },
    /* Measured: 18.11 + 9.05 + 8.24 + 0.07 = 35.5% at tolerance 2. */
    geographicOccupancy: { min: 28 },
    labels: { lakeMin: 1, cityMin: 3, riverMax: 4 },
  },
};

/**
 * THE NEAR-BLACK RULE IS PER FRAME, AND THAT IS A MEASUREMENT, NOT A HEDGE.
 *
 * My first draft made this one global constant and it was wrong — the golden
 * WORLD pane would have failed it. Measured:
 *
 *     GOLDEN-01 (world)   57.7 % below luminance 12   ← correct; it is ocean
 *     GOLDEN-02 (Rwanda)   0.0 % below luminance 12   ← correct; it is land
 *
 * `#040a10`, the approved ocean, has a relative luminance of 9.2, so "dark" is
 * the right answer at world scale and the wrong one at regional scale. A
 * single threshold could only have been set loose enough to pass the world
 * frame, which is loose enough to pass the Alpha failure.
 *
 * IT ALSO MEANS LUMINANCE ALONE CANNOT CATCH THE ALPHA DEFECT. `#080b12`
 * measures 10.9 against the ocean's 9.2 — two points apart. What separates
 * them is WHERE they appear and WHAT ELSE is in frame, which is why this file
 * measures palette occupancy and geographic occupancy alongside luminance and
 * requires all of them.
 */
export const NEAR_BLACK_DEFAULT = { threshold: 12, maxFraction: 0.70 };

/** Rec. 709 relative luminance. */
export const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * The share of `pixels` within `tolerance` of `hex`, as a percentage.
 *
 * Chebyshev distance per channel, not Euclidean: a token is a specific value
 * and a channel that has drifted 14 steps has drifted, whatever the other two
 * did. The tolerance exists for antialiasing and for the 8-bit rounding of a
 * composited fill, not to admit a neighbouring colour.
 */
export function occupancy(pixels, hex, tolerance = 2) {
  const target = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let hits = 0;

  for (let i = 0; i < pixels.length; i += 3) {
    if (
      Math.abs(pixels[i] - target[0]) <= tolerance &&
      Math.abs(pixels[i + 1] - target[1]) <= tolerance &&
      Math.abs(pixels[i + 2] - target[2]) <= tolerance
    ) {
      hits += 1;
    }
  }

  return (hits * 300) / pixels.length;
}

/** Mean, median and the near-black fraction of a pane. */
export function luminanceProfile(pixels, nearBlackThreshold = NEAR_BLACK_DEFAULT.threshold) {
  const values = new Float64Array(pixels.length / 3);

  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 1) {
    values[j] = luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
  }

  const sorted = Float64Array.from(values).sort();
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let dark = 0;
  for (const value of values) if (value < nearBlackThreshold) dark += 1;

  return { mean, median: sorted[Math.floor(sorted.length / 2)], nearBlackFraction: dark / values.length };
}

/**
 * The verdict for one frame.
 *
 * Returns every failure rather than the first, because a reviewer reading a
 * gate report needs to know whether one thing moved or the whole composition
 * did — and because "palette drifted AND the pane went dark" is a different
 * diagnosis from either alone.
 */
/**
 * GEOGRAPHIC OCCUPANCY, MEASURED FROM THE PANE RATHER THAN ASKED OF THE PRODUCT.
 *
 * C907 R2. The runner used to read `window.__gnGeographicOccupancy`, a global
 * NO PART OF THE PRODUCT EVER SET — with `?? 0` behind it, so the measurement
 * silently became zero and the threshold below it could only ever have failed
 * or been ignored. The number is a share of pane area, which is exactly what
 * the decoded pixels already say, so it is computed here from the same pixels
 * the palette occupancies come from and needs no instrumentation in shipped
 * code.
 *
 * The token list per frame is the frame's own approved geographic palette. No
 * threshold in GOLDEN is altered by this function; it only supplies the input
 * that was previously absent.
 */
export function geographicOccupancy(pixels, frameId) {
  const expected = GOLDEN[frameId];
  if (!expected || !expected.palette) return 0;
  let total = 0;
  for (const hex of Object.keys(expected.palette)) total += occupancy(pixels, hex, 2);
  return total;
}

export function compareFrame(frameId, pane, domCounts) {
  const expected = GOLDEN[frameId];
  const failures = [];

  if (!expected) return { ok: false, failures: [`no golden measurements for frame ${frameId}`] };

  for (const [hex, rule] of Object.entries(expected.palette)) {
    const share = occupancy(pane.pixels, hex, 2);
    if (Math.abs(share - rule.share) > rule.tolerance) {
      failures.push(
        `palette drift: ${hex} covers ${share.toFixed(1)}% of the pane, golden is ` +
          `${rule.share}% (±${rule.tolerance})`,
      );
    }
  }

  const nearBlack = expected.nearBlack ?? NEAR_BLACK_DEFAULT;
  const profile = luminanceProfile(pane.pixels, nearBlack.threshold);

  if (profile.nearBlackFraction > nearBlack.maxFraction) {
    failures.push(
      `NEAR-BLACK PANE: ${(profile.nearBlackFraction * 100).toFixed(1)}% below luminance ` +
        `${nearBlack.threshold}; golden ${expected.name} allows at most ` +
        `${(nearBlack.maxFraction * 100).toFixed(0)}%. This is the measured Alpha failure.`,
    );
  }

  if (Math.abs(profile.mean - expected.luminance.mean) > expected.luminance.tolerance) {
    failures.push(
      `luminance drift: pane mean ${profile.mean.toFixed(1)}, golden ` +
        `${expected.luminance.mean} (±${expected.luminance.tolerance})`,
    );
  }

  if (expected.geographicOccupancy && pane.geographicOccupancy < expected.geographicOccupancy.min) {
    failures.push(
      `missing geographic context: land+ocean cover ${pane.geographicOccupancy.toFixed(1)}% of the ` +
        `pane, golden requires at least ${expected.geographicOccupancy.min}%`,
    );
  }

  if (expected.worldSpanDegrees && pane.worldSpanDegrees < expected.worldSpanDegrees.min) {
    failures.push(
      `TINY-WORLD FRAMING: the pane spans ${pane.worldSpanDegrees.toFixed(0)}° of longitude, ` +
        `golden spans ~362°`,
    );
  }

  const labels = expected.labels ?? {};
  for (const [kind, max] of [
    ['river', labels.river],
    ['city', labels.city],
    ['lake', labels.lake],
  ]) {
    if (max !== undefined && (domCounts[kind] ?? 0) > max) {
      failures.push(`LABEL EXPLOSION: ${domCounts[kind]} ${kind} labels, golden frame shows ${max}`);
    }
  }
  if (labels.riverMax !== undefined && (domCounts.river ?? 0) > labels.riverMax) {
    failures.push(`LABEL EXPLOSION: ${domCounts.river} river labels, cap is ${labels.riverMax}`);
  }
  if (labels.lakeMin !== undefined && (domCounts.lake ?? 0) < labels.lakeMin) {
    failures.push(`missing geographic context: ${domCounts.lake} lake labels, golden shows at least ${labels.lakeMin}`);
  }
  if (labels.cityMin !== undefined && (domCounts.city ?? 0) < labels.cityMin) {
    failures.push(`missing geographic context: ${domCounts.city} city labels, golden shows at least ${labels.cityMin}`);
  }

  return { ok: failures.length === 0, failures, profile };
}
