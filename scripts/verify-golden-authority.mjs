#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLDEN AUTHORITY GATE — C907 §0.1(5) FINAL RULING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * *"create an SC-owned immutable manifest containing for every protected frame:
 * logical id, filename, width / height, SHA256, authority description … A
 * changed golden image without a corresponding reviewed SC identity change must
 * fail the release gate. The acceptance mechanism itself must never be outside
 * fingerprint governance."*
 *
 * ── WHAT THIS CLOSES ────────────────────────────────────────────────────────
 *
 * A visual gate is only as trustworthy as its reference. If a golden PNG can be
 * replaced — by accident, or by whoever is failing the comparison — then every
 * threshold downstream measures the wrong thing and reports PASS while doing
 * it. That is the single failure mode a screenshot gate has that a unit test
 * does not.
 *
 * The manifest lives under `scripts/`, so it is inside the SC fingerprint:
 *
 *   change a golden PNG and not the manifest  →  this gate FAILS
 *   change the manifest                       →  SC moves, and a moved SC is a
 *                                                reviewed identity change
 *
 * Neither can be done quietly, which is the property the ruling asks for.
 *
 * ── PENDING IS NOT PASSING ──────────────────────────────────────────────────
 *
 * V3 SELECTED COUNTRY and V4 EVIDENCE MODE have no approved capture yet. They
 * are recorded as PENDING and the gate REFUSES TO CERTIFY them. An absent
 * authority must never be treated as a satisfied one — that is how a gate
 * quietly becomes decoration.
 *
 * Usage: node scripts/verify-golden-authority.mjs [--golden-root <abs>] [--require-all]
 *   --require-all  fail if any frame is still PENDING. For a Production gate.
 * Exit 0 = every APPROVED golden matches its manifest entry.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'spatial-visual', 'golden-authority.manifest.json');

const args = process.argv.slice(2);
const flagValue = (name) => (args.indexOf(name) === -1 ? undefined : args[args.indexOf(name) + 1]);
const REQUIRE_ALL = args.includes('--require-all');

const failures = [];
const notes = [];

if (!existsSync(MANIFEST)) {
  console.error('');
  console.error('GOLDEN AUTHORITY GATE — FAIL');
  console.error(`  The SC-owned manifest is missing: ${MANIFEST}`);
  console.error('  The acceptance mechanism must never be outside fingerprint governance.');
  console.error('');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

/**
 * Where the approved captures live.
 *
 * The PNGs are binaries and stay outside ordinary source scanning, which the
 * ruling permits — their IDENTITY is what must be governed, and that is what
 * the manifest holds.
 */
const GOLDEN_ROOT = resolve(
  flagValue('--golden-root') ?? process.env.GOLDEN_AUTHORITY_ROOT ?? join(HERE, '..', '..', manifest.goldenRoot),
);

const REQUIRED_FRAMES = ['V1', 'V2', 'V3', 'V4'];
const seen = new Set();

for (const frame of manifest.frames) {
  seen.add(frame.id);

  if (typeof frame.authority !== 'string' || frame.authority.trim() === '') {
    failures.push(`${frame.id}: no authority description. Every frame must say what it is authority FOR.`);
  }

  if (frame.status === 'PENDING') {
    const message = `${frame.id} ${frame.name}: PENDING — no approved golden capture exists.`;
    if (REQUIRE_ALL) failures.push(`${message} --require-all was given, so this is a failure.`);
    else notes.push(message);
    continue;
  }

  if (frame.status !== 'APPROVED') {
    failures.push(`${frame.id}: unknown status "${frame.status}". Use APPROVED or PENDING.`);
    continue;
  }

  for (const field of ['filename', 'width', 'height', 'sha256']) {
    if (frame[field] === null || frame[field] === undefined) {
      failures.push(`${frame.id}: APPROVED but ${field} is missing.`);
    }
  }

  const path = join(GOLDEN_ROOT, frame.filename ?? '');

  if (!existsSync(path)) {
    failures.push(`${frame.id}: approved golden not found at ${path}`);
    continue;
  }

  const bytes = readFileSync(path);
  const digest = createHash('sha256').update(bytes).digest('hex');

  if (digest !== frame.sha256) {
    failures.push(
      `${frame.id}: GOLDEN CHANGED WITHOUT A REVIEWED IDENTITY CHANGE.\n` +
        `      file     ${frame.filename}\n` +
        `      manifest ${frame.sha256}\n` +
        `      on disk  ${digest}\n` +
        '      Either restore the approved capture, or amend the manifest under a\n' +
        '      Product Owner ruling — which moves SC, which is the point.',
    );
    continue;
  }

  /*
    PNG dimensions, read from the IHDR chunk rather than by decoding the image,
    so this needs no dependency. Bytes 16..23 of a PNG are width and height,
    big-endian, immediately after the 8-byte signature and the IHDR length/type.
  */
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);

  if (width !== frame.width || height !== frame.height) {
    failures.push(
      `${frame.id}: dimensions ${width}x${height} do not match the manifest ` +
        `${frame.width}x${frame.height}.`,
    );
  }
}

for (const id of REQUIRED_FRAMES) {
  if (!seen.has(id)) failures.push(`frame ${id} is missing from the manifest entirely.`);
}

if (failures.length > 0) {
  console.error('');
  console.error('GOLDEN AUTHORITY GATE — FAIL');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(
  `GOLDEN AUTHORITY GATE — PASS · ${manifest.frames.filter((f) => f.status === 'APPROVED').length} approved frames verified`,
);
for (const note of notes) console.log(`  note: ${note}`);
