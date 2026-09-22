import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { ROOT, readInputs, normalizeInputs, generatedFiles } from './normalize-regional-packs.mjs';
const require = createRequire(import.meta.url);
const {
  COUNTRIES,
  loadSourcePacks,
  accountSourceCoverage,
  EAST_AFRICA_MEMBERS,
  MIDDLE_EAST_MEMBERS,
} = require('../../shared/dist');
const { supranationalById } = require('../../backend/dist/modules/geo/supranational-membership');
const regions = [
  { id: 'region:east-africa', members: EAST_AFRICA_MEMBERS, provenanceNote: 'Governed' },
  { id: 'region:middle-east', members: MIDDLE_EAST_MEMBERS, provenanceNote: 'Governed' },
  {
    id: 'region:european-union',
    members: supranationalById('region:european-union').members,
    provenanceNote: 'Governed EU27',
  },
];
const inputs = readInputs(),
  result = normalizeInputs(inputs, COUNTRIES);
const coverage = (data) => accountSourceCoverage(regions, loadSourcePacks(data.packs, regions));
test('N -> O -> P yields 11/16/27 canonical countries and accounts for every source', () => {
  assert.deepEqual(
    ['N', 'O', 'P'].map((lane) => inputs.filter((i) => i.lane === lane).length),
    [11, 16, 27],
  );
  assert.equal(result.report.candidates, 298);
  assert.equal(result.report.admittedRecords + result.report.rejected.length, 298);
  assert.equal(result.report.admittedRecords, 290);
  assert.equal(result.report.rejected.length, 8);
  assert.equal(loadSourcePacks(result.packs, regions).length, 54);
});
test('M derives UNVERIFIED instead of copying regional GAP/PARTIAL labels', () => {
  assert.ok(
    coverage(result).every(
      (r) => r.state === 'UNVERIFIED' && r.gapReason && r.validatedLocalPublisherCount === 0,
    ),
  );
  const changed = structuredClone(inputs);
  changed.forEach((i) => {
    i.raw.coverageStatus = 'VALIDATED_LOCAL_BASELINE';
    i.raw.status = 'VALIDATED_LOCAL_BASELINE';
  });
  assert.deepEqual(normalizeInputs(changed, COUNTRIES), result);
});
test('all records remain dormant with no rights or transport promotion', () => {
  for (const e of result.packs.flatMap((p) => p.entries)) {
    assert.equal(e.activationStatus, 'DISABLED');
    assert.equal(e.verifiedAt, null);
    assert.equal(e.transport, 'NONE');
    assert.equal(e.endpoint, null);
    assert.notEqual(e.rights.standing, 'PERMITTED');
    assert.equal(e.rights.binding, null);
    assert.equal(e.health.status, 'UNKNOWN');
    assert.equal(e.health.lastSuccessAt, null);
    assert.ok(e.failureReason);
  }
});
test('original source metadata, names, language evidence and SHA references survive verbatim', () => {
  for (const e of result.packs.flatMap((p) => p.entries)) {
    const p = JSON.parse(e.provenanceNote),
      input = inputs.find((i) => i.manifestPath === p.manifestPath);
    assert.equal(p.manifestSha256, input.sha256);
    const original = input.raw.sources.find((s) => (s.sourceId || s.id) === p.originalSourceId);
    assert.deepEqual(p.originalEvidence, original);
    assert.equal(e.publisherName, input.lane === 'O' ? original.publisher.name : original.name);
  }
});
test('expected languages and unobserved language targets are not actual languages', () => {
  for (const pack of result.packs.filter((p) => p.governedRegion === 'region:european-union'))
    assert.ok(pack.entries.every((e) => e.languages.length === 0));
  for (const e of result.packs.flatMap((p) => p.entries)) {
    const p = JSON.parse(e.provenanceNote);
    if (p.lane === 'O' && p.originalEvidence.languageStatus !== 'observed')
      assert.deepEqual(e.languages, []);
  }
});
for (const [name, mutate] of [
  [
    'activation',
    (s) => {
      s.enabled = true;
    },
  ],
  [
    'rights permission',
    (s) => {
      s.rights.status = 'PERMITTED';
    },
  ],
  [
    'rights binding',
    (s) => {
      s.rights.binding = { rightsAuthorityId: 'fake', rightsRecordKey: 'fake' };
    },
  ],
  [
    'reuse approval',
    (s) => {
      s.rights.reuseApproved = true;
    },
  ],
])
  test('refuses unreviewed ' + name, () => {
    const changed = structuredClone(inputs),
      first = changed[0].raw.sources[0],
      id = first.id;
    mutate(first);
    const output = normalizeInputs(changed, COUNTRIES);
    assert.ok(output.report.rejected.some((r) => r.originalSourceId === id));
    assert.ok(!output.packs.flatMap((p) => p.entries).some((e) => e.sourceId === id));
  });
test('publisher collisions refuse all conflicting records; no first-wins admission', () => {
  const changed = structuredClone(inputs),
    first = changed[0].raw.sources[0],
    second = changed[0].raw.sources[1];
  second.homepage = first.homepage;
  const a = normalizeInputs(changed, COUNTRIES),
    b = normalizeInputs([...changed].reverse(), COUNTRIES);
  const ids = (r) => r.packs.flatMap((p) => p.entries.map((e) => e.sourceId)).sort();
  assert.deepEqual(ids(a), ids(b));
  assert.ok(!ids(a).includes(first.id) && !ids(a).includes(second.id));
});
test('aliases and conflicting hosts remain visible in country gaps', () => {
  for (const r of result.report.rejected) {
    const pack = result.packs.find(
      (p) => JSON.parse(p.provenanceNote).manifestPath === r.manifestPath,
    );
    assert.ok(pack.gapReason.includes(r.originalSourceId) && pack.gapReason.includes(r.reason));
  }
});
test('a single international institutional reference cannot become local', () => {
  const input = structuredClone(inputs.find((i) => i.raw.country === 'COD'));
  input.raw.sources = input.raw.sources.filter((s) => s.id === 'ea-r1:cod:ocha');
  const e = normalizeInputs([input], COUNTRIES).packs[0].entries[0];
  assert.equal(e.basis, 'INTERNATIONAL');
  assert.equal(
    coverage(normalizeInputs([input], COUNTRIES)).find((r) => r.iso3 === 'COD').state,
    'COVERAGE_GAP',
  );
});
test('M refuses non-EU members even if a national file claims EU scope', () => {
  const changed = structuredClone(inputs),
    p = changed.find((i) => i.lane === 'P');
  p.raw.countryCode = 'GB';
  p.raw.sources = [];
  assert.throws(
    () => loadSourcePacks(normalizeInputs(changed, COUNTRIES).packs, regions),
    /country\/region mismatch/,
  );
});
test('unknown programmes, noncanonical countries and activated packs fail closed', () => {
  for (const mutate of [
    (i) => {
      i.region = 'region:europe';
    },
    (i) => {
      i.raw.country = 'ZZZ';
    },
    (i) => {
      i.raw.enabled = true;
    },
  ]) {
    const changed = structuredClone(inputs);
    mutate(changed[0]);
    assert.throws(() => normalizeInputs(changed, COUNTRIES));
  }
});
test('generator preserves original bytes and reproduces snapshots offline', () => {
  const before = inputs.map((i) => fs.readFileSync(path.join(ROOT, i.manifestPath)));
  execFileSync(process.execPath, ['scripts/global-reach/normalize-regional-packs.mjs', '--check'], {
    cwd: ROOT,
  });
  inputs.forEach((i, n) =>
    assert.deepEqual(fs.readFileSync(path.join(ROOT, i.manifestPath)), before[n]),
  );
  for (const [name, value] of Object.entries(generatedFiles(result)))
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/src/modules/global-reach/data', name))),
      value,
    );
});
