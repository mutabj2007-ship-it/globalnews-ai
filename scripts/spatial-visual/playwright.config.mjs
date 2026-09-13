/**
 * Playwright configuration for the Part B protected-frame runner — C907 R2.
 *
 * Lives under `scripts/` with the rest of the visual-release machinery, because
 * C907 §0.1(5) puts everything that decides Spatial acceptance inside the SC
 * fingerprint. A config that chose a different reporter, viewport or retry
 * count would change what "PASS" means, so it is governed like the rest.
 *
 * NO RETRIES, DELIBERATELY. A protected frame that passes on the second attempt
 * is not deterministic, and retrying would hide precisely the flakiness this
 * gate is supposed to expose.
 */
export default {
  testDir: '.',
  testMatch: ['spatial-visual.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    /* Real device pixels: the thresholds are shares of the pane, and a
       device-scale factor other than 1 changes antialiasing behaviour. */
    deviceScaleFactor: 1,
    baseURL: process.env.SPATIAL_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000',
  },
};
