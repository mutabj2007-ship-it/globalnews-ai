#!/usr/bin/env node
/**
 * ER1 T2 — deterministic fixture generator (offline; reads local files only; no network).
 *
 *   node backend/test/evaluation/early-signal-r1/tools/build-fixtures.mjs <path-to-EA-12-CASE-CHRONOLOGICAL-BENCHMARK.json>
 *
 * Inputs are pinned by SHA-256 and the run refuses on mismatch, so a fixture can always be traced to
 * the exact evidence it was derived from. Output is metadata only: no article bodies, no URLs to
 * premium text, no images. Re-running on the same inputs produces byte-identical output.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..', '..'); // repo root
const OUT = resolve(HERE, '..', 'fixtures');

const PINNED = {
  eaBenchmark: 'e13f8f84a21625164c9d22be002d55c0eb5073ab821124b79dba0b751b57de03',
  admission: '6d98d2ac44d23f4230ec1add22ac7f7e06593f078cfd9cb407bfcb5811ae0c91',
  regions: '90e7e699305271d76a37b69154683d3ac2dfec324f7c78896f9d710efd7f46c5',
};

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const rel = (p) => relative(ROOT, p).split('\\').join('/');
function pinned(path, expected, label) {
  const buf = readFileSync(path);
  const got = sha(buf);
  if (got !== expected) throw new Error(`${label}: sha256 ${got} != pinned ${expected} (${path})`);
  return buf;
}
const write = (name, obj) => writeFileSync(join(OUT, name), JSON.stringify(obj, null, 2) + '\n');

const eaPath = process.argv[2];
if (!eaPath) throw new Error('usage: build-fixtures.mjs <EA-12-CASE-CHRONOLOGICAL-BENCHMARK.json>');

/* ── 1. regions (from shared/src/global-reach-regions.ts @ base) ─────────── */
const regionsPath = join(ROOT, 'shared', 'src', 'global-reach-regions.ts');
const regionsSrc = pinned(regionsPath, PINNED.regions, 'regions').toString('utf8');
const members = (name) => {
  const m = regionsSrc.match(new RegExp(`export const ${name}\\b[^=]*=\\s*Object\\.freeze\\(\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`members ${name} not found`);
  return [...m[1].matchAll(/'([A-Z]{3})'/g)].map((x) => x[1]);
};
const regions = {
  provenance: { file: rel(regionsPath), sha256: PINNED.regions },
  EAST_AFRICA: members('EAST_AFRICA_MEMBERS'),
  MIDDLE_EAST: members('MIDDLE_EAST_MEMBERS'),
  EU27: members('EU27_MEMBERS'),
};
if (regions.EAST_AFRICA.length !== 11 || regions.MIDDLE_EAST.length !== 16 || regions.EU27.length !== 27)
  throw new Error('region member counts changed');

/* ── 2. EA 17 cases (metadata only) ──────────────────────────────────────── */
const ea = JSON.parse(pinned(eaPath, PINNED.eaBenchmark, 'EA benchmark').toString('utf8'));
const eaCases = ea.cases.map((c) => ({
  id: c.id,
  title: c.title,
  replay: c.replay === true,
  categories: c.categories ?? [],
  eventCountry: c.eventCountry ?? null,
  notEventCountryRoles: c.notEventCountry ?? {},
  languages: c.languages ?? null,
  claims: (c.claims ?? []).map((k) => ({
    claim: k.claim ?? null,
    unit: k.unit ?? null,
    attribution: k.attribution ?? null,
    state: k.state ?? null,
    values: k.values ?? undefined,
  })),
  replayCutoffs: (c.replayCutoffs ?? []).map((r) => ({
    cutoff: r.cutoff,
    availableEvidence: r.availableEvidence ?? [],
    expected: r.expected ?? null,
    leakGuard: r.leakGuard ?? [],
  })),
  timelineKinds: (c.timeline ?? []).map((t, i) => ({ index: i, t: t.t ?? null, kind: t.kind ?? null, verification: t.verification ?? null })),
  rightsAccess: c.rightsAccess ?? null,
  expectedB: c.expectedB ?? null,
  baselineA: c.baselineA ?? null,
  protects: c.protects ?? [],
}));
write('ea-17-cases.fixture.json', {
  provenance: {
    source: 'Claude_Output/REGIONAL-EARLY-SIGNAL-R1/EA/EA-12-CASE-CHRONOLOGICAL-BENCHMARK.json',
    sha256: PINNED.eaBenchmark,
    author: ea.author,
    status: ea.status,
    note: 'Metadata-only extraction. Timeline URLs omitted; the original is the evidence of record.',
  },
  globalRules: ea.globalRules,
  coverageSummary: ea.coverageSummary,
  cases: eaCases,
});

/* ── 3. eight-row coverage association ───────────────────────────────────── */
const packDir = join(ROOT, 'backend', 'source-packs', 'east-africa-r1');
const hostOf = (u) => new URL(u).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
const eaRows = [];
for (const f of readdirSync(packDir).filter((f) => /^[A-Z]{3}\.json$/.test(f)).sort()) {
  const buf = readFileSync(join(packDir, f));
  const pack = JSON.parse(buf.toString('utf8'));
  for (const s of pack.sources)
    eaRows.push({
      sourceId: s.id,
      iso3: f.slice(0, 3),
      host: hostOf(s.homepage),
      homepage: s.homepage,
      feedUrl: s.feedUrl ?? null,
      duplicateOf: s.duplicateOf ?? null,
      technicalStatus: s.technicalStatus,
      rightsStatus: s.rights?.status ?? null,
      checkedAt: s.evidence?.checkedAt ?? null,
      isDirectoryListing: /\/national-societies-directory\//.test(s.homepage),
      manifestPath: rel(join(packDir, f)),
      manifestSha256: sha(buf),
    });
}
const admissionPath = join(ROOT, 'backend', 'src', 'modules', 'global-reach', 'data', 'regional-admission.json');
const admission = JSON.parse(pinned(admissionPath, PINNED.admission, 'admission').toString('utf8'));
const canon = [];
for (const lane of ['n', 'o', 'p']) {
  const p = join(ROOT, 'backend', 'src', 'modules', 'global-reach', 'data', `${lane}-canonical-packs.json`);
  for (const pack of JSON.parse(readFileSync(p, 'utf8')))
    for (const e of pack.entries)
      canon.push({
        sourceId: e.sourceId,
        iso3: e.iso3,
        canonicalHost: e.canonicalHost,
        nameKey: e.publisherName.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''),
        transport: e.transport,
        activationStatus: e.activationStatus,
        rightsStanding: e.rights.standing,
      });
}
canon.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
write('eight-row-coverage.fixture.json', {
  provenance: {
    base: '059cdb7f75f5b60623df66219d096d8b0a726f7f',
    admission: { file: rel(admissionPath), sha256: PINNED.admission },
    packs: [...new Set(eaRows.map((r) => `${r.manifestPath}@${r.manifestSha256}`))],
  },
  admission: { candidates: admission.candidates, admittedRecords: admission.admittedRecords, rejected: admission.rejected },
  eaRegisterRows: eaRows,
  canonicalIdentities: canon,
});

write('regions.fixture.json', regions);
console.log(JSON.stringify({ eaCases: eaCases.length, replays: eaCases.filter((c) => c.replay).length, eaRows: eaRows.length, canon: canon.length, rejected: admission.rejected.length }));
