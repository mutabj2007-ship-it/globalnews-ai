/**
 * MUTATION CAMPAIGN. Each mutation copies the tree, breaks ONE rule, rebuilds, and requires
 * that the NAMED probe or corpus row fails. A mutation that survives means the rule it breaks
 * is not actually bound by anything — which is how two probes in the router round were found
 * to have silently become decoration after a rename.
 *
 * Never writes to the working tree.
 */

import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MUTATIONS = [
  { id: 'MU-1',  bites: 'OK-3', file: 'src/reader.ts',
    from: "  // R2: observation keys are ACCEPTED, opaquely.",
    to:   "  if (identity.observationKeys.length > 0) {\n    return refuse(identity, 'NOT_CONNECTED', 'OBSERVATION_KEY_CONSTRUCT_ABSENT');\n  }\n  // R2: observation keys are ACCEPTED, opaquely." },
  { id: 'MU-2',  bites: 'B-3',  file: 'src/reader.ts',
    from: "if (!port.governed) {\n    return refuse(identity, 'NOT_CONNECTED', 'SPECIALIST_NOT_BOUND');",
    to:   "if (false) {\n    return refuse(identity, 'NOT_CONNECTED', 'SPECIALIST_NOT_BOUND');" },
  { id: 'MU-3',  bites: 'B-1',  file: 'src/reader.ts',
    from: "      registered: false,\n      bound: false,", to: "      registered: true,\n      bound: false," },
  { id: 'MU-4',  bites: 'I-1',  file: 'src/ports.ts',
    from: "    `country:${identity.countryIso3}`,\n", to: "" },
  { id: 'MU-5',  bites: 'I-2',  file: 'src/ports.ts',
    from: "    `window:${identity.statedWindow ?? ''}`,\n", to: "" },
  { id: 'MU-6',  bites: 'I-7',  file: 'src/ports.ts',
    from: "    `reader:${identity.readerRevision}`,\n", to: "" },
  { id: 'MU-7',  bites: 'I-6',  file: 'src/ports.ts',
    from: "  ].join(UNIT_SEPARATOR);", to: "  ].join('');" },
  { id: 'MU-8',  bites: 'I-5',  file: 'src/reader.ts',
    from: "observationKeys: [...new Set(request.observationKeys ?? [])].sort(),",
    to:   "observationKeys: [...(request.observationKeys ?? [])]," },
  { id: 'MU-9',  bites: 'V-1',  file: 'src/reader.ts',
    from: "  if (partition.releasable.some((c) => c.sources.length === 0)) {",
    to:   "  if (partition.releasable.every((c) => c.sources.length === 0)) {" },
  { id: 'MU-10', bites: 'V-2',  file: 'src/reader.ts',
    from: "const PRODUCIBLE_SCOPES: readonly string[] = ['COUNTRY', 'REGION'];",
    to:   "const PRODUCIBLE_SCOPES: readonly string[] = ['COUNTRY', 'REGION', 'SETTLEMENT'];" },
  { id: 'MU-11', bites: 'V-3',  file: 'src/reader.ts',
    from: "  if (served.classified.length === 0) {", to: "  if (false) {" },
  { id: 'MU-12', bites: 'A-1',  file: 'src/reader.ts',
    from: "    return refuse(identity, served.state, served.refusal ?? refusalForState(served.state));",
    to:   "    return { state: served.state, claims: served.claims, refusal: served.refusal, identity };" },
  { id: 'MU-13', bites: 'I-8',  file: 'src/reader.ts',
    from: "    askTerminal: null,\n    identity,\n  };",
    to:   "    askTerminal: null,\n    identity: (served as unknown as { identity: typeof identity }).identity,\n  };" },
  { id: 'MU-14', bites: 'AS-1', file: 'src/ports.ts',
    from: "  | 'TEMPORARILY_UNAVAILABLE';", to: "  | 'TEMPORARILY_UNAVAILABLE'\n  | 'NOT_ASSESSED';" },
  { id: 'MU-15', bites: 'CORPUS', file: 'src/reader.ts',
    from: "  return result.state === 'AVAILABLE' && result.claims.length > 0;", to: "  return true;" },
  { id: 'MU-16', bites: 'N-1',  file: 'src/reader.ts',
    from: "export function buildIdentity(", to: "const _p = globalThis.fetch;\nexport function buildIdentity(" },
  { id: 'MU-17', bites: 'N-2',  file: 'src/reader.ts',
    from: "const PRODUCIBLE_SCOPES", to: "const LEGACY = '/analysis/news';\nconst PRODUCIBLE_SCOPES" },
  { id: 'MU-18', bites: 'L-1',  file: 'src/reader.ts',
    from: "const PRODUCIBLE_SCOPES", to: "const locale = 'en';\nconst PRODUCIBLE_SCOPES" },
  { id: 'MU-19', bites: 'L-2',  file: 'src/reader.ts',
    from: "    statedWindow: request.statedWindow ?? null,",
    to:   "    statedWindow: request.statedWindow === undefined ? null : request.statedWindow.toUpperCase()," },
  { id: 'MU-20', bites: 'C-1',  file: 'corpus/corpus.ts',
    from: "    contractTest: 'G6',", to: "    contractTest: 'G1'," },
  { id: 'MU-40', bites: 'BP-6',  file: 'src/binding.ts',
    from: "  return Object.keys(matrix).filter((k) => readerClears(matrix[k] as E1SourceClearance)).sort();",
    to:   "  return Object.keys(matrix).sort();" },
  { id: 'MU-41', bites: 'BP-7',  file: 'src/binding.ts',
    from: "  clearance: 'RIGHTS_CONFIRMATION_REQUIRED',",
    to:   "  clearance: 'NOT_CLEARED'," },
  { id: 'MU-42', bites: 'BP-6',  file: 'src/binding.ts',
    from: "  GDACS: 'RIGHTS_CONFIRMATION_REQUIRED',",
    to:   "  GDACS: 'CLEARED_FOR_ALPHA_RUNTIME'," },
  { id: 'MU-27', bites: 'DG-1',  file: 'src/disclosure.ts',
    from: "  return cls === 'READER_SAFE';",
    to:   "  return cls === 'READER_SAFE' || cls === 'PROTECTED_LOCATION';" },
  { id: 'MU-28', bites: 'DG-1',  file: 'src/disclosure.ts',
    from: "    if (admissibleToSink(c.disclosure)) releasable.push(c.claim);\n    else counts[c.disclosure] += 1;",
    to:   "    releasable.push(c.claim);\n    if (!admissibleToSink(c.disclosure)) counts[c.disclosure] += 1;" },
  { id: 'MU-29', bites: 'CORPUS', file: 'src/disclosure.ts',
    from: "  return partition.releasable.length === 0 && partition.withheldTotal > 0;",
    to:   "  return false;" },
  { id: 'MU-30', bites: 'DG-4',  file: 'src/disclosure.ts',
    from: "    SAVED_RECENT: ok.flatMap((c) => c.sources.map((s) => s.articleRef)).sort(),",
    to:   "    SAVED_RECENT: [...ok.flatMap((c) => c.sources.map((s) => s.articleRef)).sort(), `withheld:${partition.withheldTotal}`]," },
  { id: 'MU-31', bites: 'BP-2',  file: 'src/binding.ts',
    from: "  return c === 'CLEARED_FOR_ALPHA_RUNTIME';",
    to:   "  return c === 'CLEARED_FOR_ALPHA_RUNTIME' || c === 'CLEARED_FOR_DEV_CAPTURE';" },
  { id: 'MU-32', bites: 'BP-1',  file: 'src/binding.ts',
    from: "  if (!i.readerSafeRetainedDataExists) refused.push('NO_READER_SAFE_RETAINED_DATA');",
    to:   "  if (false) refused.push('NO_READER_SAFE_RETAINED_DATA');" },
  { id: 'MU-33', bites: 'BP-3',  file: 'src/binding.ts',
    from: "      askTerminal: 'CAPABILITY_UNAVAILABLE',\n    };",
    to:   "      askTerminal: null,\n    };" },
  { id: 'MU-34', bites: 'XD-1',  file: 'src/crossdomain.ts',
    from: "    .sort();\n  return [`legs:${encoded.length}`",
    to:   ";\n  return [`legs:${encoded.length}`" },
  { id: 'MU-35', bites: 'XD-8',  file: 'src/crossdomain.ts',
    from: "  return [`legs:${encoded.length}`, ...encoded].join(UNIT_SEPARATOR);",
    to:   "  return [`legs:${encoded.length}`, ...encoded].join('');" },
  { id: 'MU-36', bites: 'XD-6',  file: 'src/crossdomain.ts',
    from: "  return legs.some((l) => l.domainId === 'HUMANITARIAN' && l.requiredness === 'REQUIRED');",
    to:   "  return false;" },
  { id: 'MU-37', bites: 'XD-7',  file: 'src/crossdomain.ts',
    from: "  return [...new Set(legs.map((l) => l.domainId))].sort() as DomainId[];",
    to:   "  return legs.map((l) => l.domainId) as DomainId[];" },
  { id: 'MU-38', bites: 'OK-1',  file: 'src/reader.ts',
    from: "    observationKeys: [...new Set(request.observationKeys ?? [])].sort(),",
    to:   "    observationKeys: [],"  },
  { id: 'MU-39', bites: 'DG-5',  file: 'src/reader.ts',
    from: "    sinks: NO_SINKS,",
    to:   "    sinks: projectToSinks({ releasable: [{ claim: 'x', sources: [], scope: 'COUNTRY', asOfStated: null }], withheldCountsByClass: { READER_SAFE: 0, INTERNAL_ONLY: 0, PROTECTED_LOCATION: 0, WITHHELD: 0 }, withheldTotal: 0 })," },
  { id: 'MU-24', bites: 'CORPUS', file: 'src/ports.ts',
    from: "  if (state === 'NO_DATA_FOR_GEOGRAPHY') return 'NOT_ASSESSED';",
    to:   "  if (state === 'NO_DATA_FOR_GEOGRAPHY') return 'SOURCE_UNAVAILABLE';" },
  { id: 'MU-25', bites: 'AX-2',  file: 'src/ports.ts',
    from: "  if (state === 'AVAILABLE') return 'RETAINED_REPORTING';",
    to:   "  if (state === 'AVAILABLE') return 'RETAINED_REPORTING';\n  if (state === 'NOT_CONNECTED') return 'NOT_ASSESSED';" },
  { id: 'MU-26', bites: 'AX-3',  file: 'src/ports.ts',
    from: "  if (state === 'AVAILABLE') return 'RETAINED_REPORTING';",
    to:   "  if (state === 'AVAILABLE') return 'CURRENT_PROVIDER_OBSERVATION';" },
  { id: 'MU-21', bites: 'M-1',  file: 'probes/probe.mjs',
    from: "probe('L-3', 'CONTROL: the language detector catches the ordinary form', () =>\n  /\\b(language|locale)\\b/i.test('const locale = \"pl\";') ? true : 'detector blind',\n);",
    to:   "" },
  { id: 'MU-22', bites: 'B-3',  file: 'fixtures/store.fixture.ts',
    from: "      read: () => serve([{ claim: claim('UNGOVERNED STUB OUTPUT'), disclosure: 'READER_SAFE' }]),",
    to:   "      read: () => empty('NOT_CONNECTED', 'SPECIALIST_NOT_BOUND')," },
  { id: 'MU-23', bites: 'AS-3', file: 'src/reader.ts',
    from: "    return refuse(identity, 'NOT_CONNECTED', 'SPECIALIST_NOT_BOUND');\n  }\n\n  const served",
    to:   "    return refuse(identity, 'NOT_BUILT', 'SPECIALIST_NOT_BOUND');\n  }\n\n  const served" },
];

function run(dir, cmd, args) {
  try {
    const out = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

const report = [];
for (const m of MUTATIONS) {
  const dir = mkdtempSync(join(tmpdir(), 'hum-mut-'));
  cpSync('.', dir, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.includes('/build') });
  const target = join(dir, m.file);
  const src = readFileSync(target, 'utf8');
  if (!src.includes(m.from)) {
    report.push({ ...m, verdict: 'ANCHOR LOST', note: 'mutation text no longer present — probe is unproven' });
    rmSync(dir, { recursive: true, force: true });
    continue;
  }
  writeFileSync(target, src.replace(m.from, m.to));

  const build = run(dir, 'tsc', ['-p', 'tsconfig.json']);
  let verdict = 'SURVIVED';
  let note = '';

  if (!build.ok) {
    // A mutation the compiler rejects still bit: the rule is enforced by the type system.
    verdict = 'BIT';
    note = 'rejected by tsc';
  } else {
    const corpus = run(dir, 'node', ['build/probes/run-corpus.js']);
    const probes = run(dir, 'node', ['probes/probe.mjs']);
    if (m.bites === 'CORPUS') {
      if (!corpus.ok) { verdict = 'BIT'; note = 'corpus failed'; }
      else note = 'corpus still green';
    } else {
      const line = probes.out.split('\n').find((l) => l.includes(` ${m.bites} `) || l.includes(`  ${m.bites}  `));
      if (line && line.startsWith('FAIL')) { verdict = 'BIT'; note = `${m.bites} failed`; }
      else if (!probes.ok) { verdict = 'BIT (WRONG PROBE)'; note = `probes failed but not ${m.bites}`; }
      else if (!corpus.ok) { verdict = 'BIT (WRONG PROBE)'; note = 'corpus failed instead'; }
      else note = `${m.bites} still passing`;
    }
  }
  report.push({ ...m, verdict, note });
  rmSync(dir, { recursive: true, force: true });
}

for (const r of report) {
  console.log(`${r.verdict.padEnd(18)} ${r.id.padEnd(6)} -> ${r.bites.padEnd(7)} ${r.note}`);
}
const bad = report.filter((r) => r.verdict !== 'BIT');
console.log('');
console.log(`MUTATIONS ${report.length}  BIT ${report.length - bad.length}  NOT-CLEANLY-BIT ${bad.length}`);
if (bad.length > 0) process.exitCode = 1;
