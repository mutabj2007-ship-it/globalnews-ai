#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * PART B RELEASE RUNNER — C907 R2
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHAT WAS WRONG. C907 R2's first issue moved `verify-golden-authority.mjs`
 * into `npm run verify:visual-authority` and then described the result as
 * "full Part B runs for every release candidate". It did not. That command
 * verified the golden BINARIES and never captured or compared a single frame,
 * so the strongest claim in the package was false. The CTO caught it. This file
 * is the part that was missing.
 *
 * THE CHAIN, IN ORDER, EACH STAGE GATING THE NEXT:
 *
 *   1. GOLDEN AUTHORITY   are the approved captures the ones the manifest says?
 *   2. FRAME EXECUTION    capture the protected frames against pinned evidence
 *   3. PERCEPTUAL COMPARE performed inside stage 2, by compare-golden-frame.mjs
 *
 * ── IT IS RED UNTIL IT CAN ACTUALLY RUN, AND THAT IS CORRECT ────────────────
 *
 * If `@playwright/test` cannot be resolved, or a browser is not installed, this
 * EXITS NON-ZERO and says which. It does not skip, it does not warn-and-pass,
 * and it does not report a partial chain as a whole one. A release gate that
 * goes green because its runner is absent is worse than no gate: it converts a
 * missing measurement into a positive claim, which is the exact failure being
 * corrected here.
 *
 * Usage: node scripts/run-visual-gate.mjs [--require-all] [--golden-root <abs>]
 *                                         [--base-url <url>]
 *   --require-all  also fail while any protected frame is PENDING (Production).
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const flag = (name) => (args.indexOf(name) === -1 ? undefined : args[args.indexOf(name) + 1]);
const REQUIRE_ALL = args.includes('--require-all');

const fail = (stage, lines) => {
  console.error('');
  console.error(`SPATIAL VISUAL GATE — FAIL at stage: ${stage}`);
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
};

/* ── STAGE 1 · GOLDEN AUTHORITY ─────────────────────────────────────────── */

console.log('SPATIAL VISUAL GATE — stage 1/2 · golden authority');

const authorityArgs = [join(HERE, 'verify-golden-authority.mjs')];
if (REQUIRE_ALL) authorityArgs.push('--require-all');
const goldenRoot = flag('--golden-root') ?? process.env.GOLDEN_AUTHORITY_ROOT;
if (goldenRoot) authorityArgs.push('--golden-root', goldenRoot);

const authority = spawnSync(process.execPath, authorityArgs, { stdio: 'inherit' });
if (authority.status !== 0) {
  fail('1 · golden authority', [
    'The approved captures do not match the SC-owned manifest, or a required frame is pending.',
    'Frame execution was NOT attempted: comparing against an unverified reference proves nothing.',
  ]);
}

/* ── STAGE 2 · PROTECTED-FRAME EXECUTION + PERCEPTUAL COMPARISON ────────── */

console.log('');
console.log('SPATIAL VISUAL GATE — stage 2/2 · protected-frame execution + perceptual comparison');

const require_ = createRequire(import.meta.url);
let playwrightCli;
try {
  playwrightCli = require_.resolve('@playwright/test/cli');
} catch {
  try {
    require_.resolve('@playwright/test');
    playwrightCli = null;
  } catch {
    fail('2 · protected-frame execution', [
      '@playwright/test cannot be resolved from this repository.',
      '',
      'Part B captures the four protected frames in a real browser. Without the',
      'runner there is no capture, no comparison, and therefore NO PART B RESULT.',
      'This gate reports that as a failure rather than as a pass, because an',
      'absent measurement is not a satisfied one.',
      '',
      'To make it runnable:',
      '  npm install --save-dev --workspaces=false @playwright/test',
      '  npx playwright install chromium',
      'and commit the regenerated package-lock.json.',
    ]);
  }
}

const baseUrl = flag('--base-url') ?? process.env.SPATIAL_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';
const config = join(HERE, 'spatial-visual', 'playwright.config.mjs');

if (!existsSync(config)) {
  fail('2 · protected-frame execution', [`the runner config is missing: ${config}`]);
}

console.log(`  base URL: ${baseUrl}`);
console.log('  the application must already be serving there; this gate does not start it.');

const run = spawnSync(
  process.execPath,
  playwrightCli
    ? [playwrightCli, 'test', '--config', config]
    : [join(ROOT, 'node_modules', '.bin', 'playwright'), 'test', '--config', config],
  {
    stdio: 'inherit',
    cwd: ROOT,
    /* --require-all is enforced in BOTH stages. Stage 1 refuses to certify a
       pending frame; stage 2 refuses to let a pending frame's capture stand in
       for a certified one. Neither entry point can pass a frame nobody
       approved. */
    env: {
      ...process.env,
      SPATIAL_VISUAL_BASE_URL: baseUrl,
      SPATIAL_VISUAL_REQUIRE_ALL: REQUIRE_ALL ? '1' : '0',
    },
  },
);

if (run.status !== 0) {
  fail('2 · protected-frame execution', [
    'One or more protected frames failed to capture or failed the perceptual comparison.',
    'The named failures above are the measurement; they are not advisory.',
  ]);
}

console.log('');
console.log('SPATIAL VISUAL GATE — PASS · golden authority verified, protected frames captured');
console.log('  APPROVED frames were compared against their golden measurements and passed.');
if (!REQUIRE_ALL) {
  console.log('  PENDING frames were captured for Product Owner inspection and NOT CERTIFIED.');
  console.log('  Run with --require-all for the Production gate, which fails while any frame is pending.');
}
