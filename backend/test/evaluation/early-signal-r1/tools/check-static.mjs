#!/usr/bin/env node
/**
 * ER1 T2 — tiny static manifest check (CTO R17: "tiny static manifest checks are fine").
 * Validates fixture inventory and provenance only. It does NOT execute any derivation logic; the
 * behavioural harness (early-signal-r1.spec.ts) stays queued for the single heavy runner.
 *
 *   node backend/test/evaluation/early-signal-r1/tools/check-static.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
const FORBIDDEN = ['probability', 'likelihood', 'riskScore', 'confidencePercent', 'forecast', 'severityScore'];
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const keysDeep = (v, out = []) => {
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (out.push(k), keysDeep(x, out));
  return out;
};

const ea = load('ea-17-cases.fixture.json');
const eight = load('eight-row-coverage.fixture.json');
const regions = load('regions.fixture.json');
const syn = load('synthetic-27.fixture.json');

check('EA pinned sha256', ea.provenance.sha256 === 'e13f8f84a21625164c9d22be002d55c0eb5073ab821124b79dba0b751b57de03');
check('EA 17 cases', ea.cases.length === 17, ea.cases.length);
check('EA 6 replays', ea.cases.filter((c) => c.replay).length === 6);
check('EA ids unique', new Set(ea.cases.map((c) => c.id)).size === 17);
check('EA fixture carries no URL', !JSON.stringify(ea).includes('http'));
check('synthetic 27 cases', syn.cases.length === 27, syn.cases.length);
check('synthetic ids S-01..S-27', syn.cases.map((c) => c.id).join() === Array.from({ length: 27 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`).join());
check('synthetic 8 EIGHT_ROW cases', syn.cases.filter((c) => c.group === 'EIGHT_ROW').length === 8);
check('every synthetic case cites an origin', syn.cases.every((c) => Array.isArray(c.origin) && c.origin.length > 0));
const rejected = eight.admission.rejected.map((r) => r.originalSourceId).sort();
const eightIds = syn.cases.filter((c) => c.group === 'EIGHT_ROW').map((c) => c.input.sourceId).sort();
check('admission 298 → 290 + 8', eight.admission.candidates === 298 && eight.admission.admittedRecords === 290 && rejected.length === 8);
check('synthetic eight == runtime rejected eight', JSON.stringify(rejected) === JSON.stringify(eightIds));
check('EA register rows 86', eight.eaRegisterRows.length === 86);
check('canonical identities 290', eight.canonicalIdentities.length === 290);
check('canonical: no host collision (negative control)', new Set(eight.canonicalIdentities.map((c) => c.canonicalHost)).size === 290);
check('canonical: no name collision (negative control)', new Set(eight.canonicalIdentities.map((c) => c.nameKey)).size === 290);
check('canonical: all DISABLED + transport NONE', eight.canonicalIdentities.every((c) => c.activationStatus === 'DISABLED' && c.transport === 'NONE'));
check('no EA register row is rights CLEARED', eight.eaRegisterRows.every((r) => r.rightsStatus !== 'CLEARED'));
check('regions 11/16/27 disjoint = 54', regions.EAST_AFRICA.length === 11 && regions.MIDDLE_EAST.length === 16 && regions.EU27.length === 27 && new Set([...regions.EAST_AFRICA, ...regions.MIDDLE_EAST, ...regions.EU27]).size === 54);
for (const [name, obj] of [['ea', ea], ['eight', eight], ['regions', regions]])
  check(`no forbidden key in ${name} fixture`, !keysDeep(obj).some((k) => FORBIDDEN.includes(k)));
const synKeys = keysDeep(syn.cases.filter((c) => c.id !== 'S-26'));
check('no forbidden key in synthetic fixture (S-26 is the deliberate probe)', !synKeys.some((k) => FORBIDDEN.includes(k)));

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (${r.detail})`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`STATIC ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
