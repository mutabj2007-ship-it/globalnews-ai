#!/usr/bin/env node
/**
 * PORTABLE RUNNER — runs lane C's expectations against YOUR adapter.
 *
 *   node expectations/run-against-adapter.mjs ./path/to/binding.mjs
 *
 * It imports nothing from this package's `src/`. The only thing it needs is a binding module
 * that adapts your canonical adapter to four small functions (see ADAPTER-SEAM.md).
 *
 * `SEMANTIC_INVARIANT` assertions are reported as FAIL. `PACKAGE_CONVENTION` assertions —
 * today only the refusal-code spelling — are reported as NOTE unless your binding supplies a
 * `refusalAliases` map, because lane C does not define canonical refusal vocabulary.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const bindingPath = process.argv[2];
if (!bindingPath) {
  console.error('usage: node expectations/run-against-adapter.mjs <binding.mjs>');
  process.exit(2);
}

const EXPECT = JSON.parse(
  readFileSync(new URL('./humanitarian-ask-expectations.json', import.meta.url), 'utf8'),
);
const binding = await import(pathToFileURL(bindingPath).href);

for (const fn of ['makeStore', 'read']) {
  if (typeof binding[fn] !== 'function') {
    console.error(`binding is missing required export: ${fn}()`);
    process.exit(2);
  }
}
const aliases = binding.refusalAliases ?? null;
const skip = new Set(binding.skipRows ?? []);

let disclosuresNoted = false;
let pass = 0;
const fails = [];
const notes = [];
const skipped = [];

for (const row of EXPECT.rows) {
  if (skip.has(row.id)) {
    skipped.push(`${row.id} — ${binding.skipReasons?.[row.id] ?? 'skipped by binding'}`);
    continue;
  }

  let actual;
  try {
    actual = await binding.read(await binding.makeStore(row.store), row.request);
  } catch (e) {
    fails.push(`${row.id} [${row.contractTest}] threw: ${e?.message ?? e}`);
    continue;
  }

  const problems = [];
  const e = row.expect;

  if (actual.availability !== e.availability.value) {
    problems.push(`availability ${actual.availability} != ${e.availability.value}`);
  }
  if (actual.assessment !== e.assessment.value) {
    problems.push(`assessment ${actual.assessment} != ${e.assessment.value}`);
  }
  const claimsNonEmpty = Array.isArray(actual.claims) ? actual.claims.length > 0 : !!actual.claimsNonEmpty;
  if (claimsNonEmpty !== e.claimsNonEmpty.value) {
    problems.push(`claimsNonEmpty ${claimsNonEmpty} != ${e.claimsNonEmpty.value}`);
  }
  if (typeof actual.executionPlannable === 'boolean') {
    if (actual.executionPlannable !== e.executionPlannable.value) {
      problems.push(`executionPlannable ${actual.executionPlannable} != ${e.executionPlannable.value}`);
    }
  } else {
    notes.push(`${row.id} executionPlannable not reported by the binding`);
  }

  if (typeof actual.withheldTotal === 'number') {
    if (actual.withheldTotal !== e.withheldTotal.value) {
      problems.push(`withheldTotal ${actual.withheldTotal} != ${e.withheldTotal.value}`);
    }
  } else {
    notes.push(`${row.id} withheldTotal not reported — disclosure audit UNVERIFIED`);
  }
  if ('askTerminal' in actual) {
    if ((actual.askTerminal ?? null) !== (e.askTerminal.value ?? null)) {
      problems.push(`askTerminal ${String(actual.askTerminal)} != ${String(e.askTerminal.value)}`);
    }
  } else {
    notes.push(`${row.id} askTerminal not reported — frozen-terminal rule UNVERIFIED`);
  }

  // E1 D-1 / D-4: the six required disclosure codes. Only checked when the binding reports them;
  // lane C's own oracle does not, and says so rather than quietly passing.
  if (Array.isArray(actual.disclosures)) {
    const req = EXPECT.requiredDisclosures;
    if (actual.availability === 'AVAILABLE') {
      const missing = req.codes.filter((c) => !actual.disclosures.includes(c));
      if (missing.length > 0) problems.push(`E1 D-1: missing disclosures ${missing.join(',')}`);
    }
    for (const c of req.mandatoryOnEveryAnswer) {
      if (!actual.disclosures.includes(c)) problems.push(`E1 D-4: ${c} missing from an answer`);
    }
  } else if (!disclosuresNoted) {
    notes.push(
      "disclosures not reported by the binding — E1's six required codes (D-1) and the " +
        'IMPACT_NOT_ASSESSED mandate (D-4) are UNVERIFIED against your adapter',
    );
    disclosuresNoted = true;
  }

  // THE LEAK CHECK. If the binding exposes sink payloads, assert the canary reaches none of them.
  if (actual.sinks && typeof binding.leakCanary === 'string') {
    for (const [sink, payload] of Object.entries(actual.sinks)) {
      if (JSON.stringify(payload ?? null).includes(binding.leakCanary)) {
        problems.push(`DISCLOSURE LEAK: withheld evidence reached ${sink}`);
      }
    }
  }

  // Convention, not invariant.
  const wantRefusal = e.refusalCode.value;
  const mapped = aliases && wantRefusal !== null ? (aliases[wantRefusal] ?? wantRefusal) : wantRefusal;
  if (aliases) {
    if ((actual.refusal ?? null) !== (mapped ?? null)) {
      problems.push(`refusal ${String(actual.refusal)} != ${String(mapped)} (aliased)`);
    }
  } else if ((actual.refusal ?? null) !== (wantRefusal ?? null)) {
    notes.push(`${row.id} refusal ${String(actual.refusal)} vs lane-C ${String(wantRefusal)} — supply refusalAliases to assert this`);
  }

  if (problems.length === 0) pass += 1;
  else fails.push(`${row.id} [${row.contractTest}] ${problems.join('; ')}`);
}

/* ---- cross-row invariants: these are the ones worth the most ---- */
const crossFails = [];
async function readRow(id) {
  const row = EXPECT.rows.find((r) => r.id === id);
  if (!row || skip.has(id)) return null;
  return binding.read(await binding.makeStore(row.store), row.request);
}

// Sudan vs Kenya must not share an identity. Only checked if the binding exposes identity.
if (typeof binding.identityMaterial === 'function') {
  const sdn = EXPECT.rows.find((r) => r.id === 'G3a-sdn-identity');
  const ken = EXPECT.rows.find((r) => r.id === 'G3b-ken-identity');
  const a = await binding.identityMaterial(sdn.request);
  const b = await binding.identityMaterial(ken.request);
  if (a === b) crossFails.push('IDENTITY: Sudan and Kenya produce identical identity material');
  const win = EXPECT.rows.find((r) => r.id === 'G3c-window-participates');
  if ((await binding.identityMaterial(win.request)) === a) {
    crossFails.push('IDENTITY: the stated window does not participate in identity');
  }
} else {
  notes.push('identityMaterial not exposed — §E identity separation UNVERIFIED against your adapter');
}

if (!binding.sinksExposed) {
  notes.push(
    'sink payloads not exposed — the five-sink disclosure proof is UNVERIFIED against your ' +
      'adapter. Expose `sinks` and `leakCanary` to run it; it is the most important check here.',
  );
}

// Surface invariance: the dashboard-context row and the standalone row must agree.
const s1 = await readRow('G4a-standalone-reaches-the-same-tool');
const s2 = await readRow('G2c-no-fabrication-on-refusal');
if (s1 && s2 && (s1.availability !== s2.availability || s1.assessment !== s2.assessment)) {
  crossFails.push('SURFACE: standalone and dashboard-context results disagree on the same store');
}

// Reopen purity: the same read twice must agree.
const r1 = await readRow('G7a-reopen-is-pure');
const r2 = await readRow('G7a-reopen-is-pure');
if (r1 && r2 && JSON.stringify(r1) !== JSON.stringify(r2)) {
  crossFails.push('REOPEN: repeating an identical read produced a different result');
}

/* ---- report ---- */
console.log(`LANE C EXPECTATIONS   ${EXPECT.schema}`);
console.log(`BINDING               ${bindingPath}`);
console.log(`ROWS                  ${EXPECT.rows.length}  PASS ${pass}  FAIL ${fails.length}  SKIP ${skipped.length}`);
for (const f of fails) console.log(`  FAIL  ${f}`);
for (const f of crossFails) console.log(`  FAIL  ${f}`);
for (const s of skipped) console.log(`  SKIP  ${s}`);
for (const n of notes) console.log(`  NOTE  ${n}`);
if (fails.length + crossFails.length > 0) process.exitCode = 1;
