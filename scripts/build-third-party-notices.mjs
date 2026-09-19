import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ══ THIRD-PARTY NOTICES — GENERATED FROM THE INSTALLED PACKAGES ═══════════
 *
 * R2-B §9 · CTO rights ruling, 2026-09-19:
 *
 *   "provide an accessible Third-Party Notices surface using the EXACT
 *    upstream license texts from the installed package versions, not
 *    hand-written summaries."
 *
 * ── WHY A GENERATOR AND NOT A PASTE ───────────────────────────────────────
 *
 * A licence text typed or pasted by hand is a licence text that can be typed
 * wrong, and a wrong notice is worse than an absent one because it looks
 * discharged. This reads the bytes from `node_modules`, writes them into a
 * committed module, and records a SHA-256 of what it read.
 *
 * `thirdPartyNotices.spec.ts` then re-reads the installed file and asserts the
 * committed text still matches it byte for byte. So:
 *
 *   the PAGE ships committed text     — no node_modules read at runtime, and
 *                                       nothing to fail in a build sandbox
 *   the SPEC proves it is exact       — and fails the day a dependency is
 *                                       upgraded with a changed notice
 *
 * ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────────────
 *
 * The gazetteer's upstream DATA packages — `iso3166-2-db`, `all-the-cities`,
 * `cities.json` — are not installed in this repository. They were consumed by
 * the backend gazetteer build, and `backend/.../gazetteer.v1.json` records
 * them under `builtFrom`. This script will not invent a notice for a package
 * it cannot read: the ruling asks for exact upstream texts, and a
 * hand-written MIT notice with a guessed copyright holder is precisely the
 * hand-written summary it rules out.
 *
 * They are therefore listed on the page as DATA SOURCES with their declared
 * licences and the product's own published attribution string, and the gap is
 * recorded in the package README as an open item rather than papered over.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * Packages whose notice ships in the browser bundle.
 *
 * `maplibre-gl`'s own LICENSE.txt already embeds the notices it is required to
 * pass on — mapbox-gl-js v1.13, glfx.js and d3-color — so reproducing that one
 * file verbatim discharges "any directly implicated bundled map dependency
 * already required by that upstream notice" without this script deciding which
 * those are.
 */
const BUNDLED = [
  {
    id: 'maplibre-gl',
    candidates: ['LICENSE.txt', 'LICENSE', 'LICENSE.md'],
  },
];

const notices = [];

for (const pkg of BUNDLED) {
  const base = resolve(ROOT, 'node_modules', pkg.id);
  const manifestPath = resolve(base, 'package.json');

  if (!existsSync(manifestPath)) {
    console.error(`FAIL ${pkg.id}: not installed at ${base}`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const licensePath = pkg.candidates
    .map((name) => resolve(base, name))
    .find((candidate) => existsSync(candidate));

  if (licensePath === undefined) {
    console.error(`FAIL ${pkg.id}: no licence file among ${pkg.candidates.join(', ')}`);
    process.exit(1);
  }

  /*
    Read as UTF-8 and normalised to LF only. A CRLF checkout would otherwise
    produce a different hash on a different machine for identical text, and the
    spec's byte comparison normalises the same way.
  */
  const text = readFileSync(licensePath, 'utf-8').replace(/\r\n/g, '\n');

  notices.push({
    id: pkg.id,
    name: manifest.name,
    version: manifest.version,
    license: manifest.license ?? null,
    file: licensePath.slice(ROOT.length + 1).replace(/\\/g, '/'),
    sha256: createHash('sha256').update(text, 'utf-8').digest('hex'),
    text,
  });

  console.log(`ok  ${manifest.name}@${manifest.version} — ${text.length} bytes`);
}

const OUT = resolve(ROOT, 'frontend', 'src', 'lib', 'legal', 'thirdPartyNotices.generated.ts');

const header = `/*
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Produced by \`scripts/build-third-party-notices.mjs\` from the licence files
 * of the INSTALLED packages. Every \`text\` below is a verbatim copy, normalised
 * to LF line endings and nothing else.
 *
 * \`thirdPartyNotices.spec.ts\` re-reads those same files and asserts each text
 * and hash still matches, so this file cannot drift from what actually ships.
 * If that spec fails after a dependency upgrade, re-run the generator — do not
 * edit this file.
 */

export interface ThirdPartyNotice {
  /** The package name as installed. */
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** The SPDX identifier the package declares, or null if it declares none. */
  readonly license: string | null;
  /** Where the text was read from, relative to the repository root. */
  readonly file: string;
  /** SHA-256 of \`text\`, for the spec's byte comparison. */
  readonly sha256: string;
  /** The upstream notice, verbatim. NEVER translated, NEVER summarised. */
  readonly text: string;
}

export const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[] = ${JSON.stringify(
  notices,
  null,
  2,
)} as const;
`;

writeFileSync(OUT, header, 'utf-8');
console.log(`wrote ${OUT.slice(ROOT.length + 1)}`);
