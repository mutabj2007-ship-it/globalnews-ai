import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORPUS, type CorpusRow } from './frozen-c/corpus/corpus';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { route } from './frozen-c/src/index';
import { ASK_QUESTION_CLASSES, TERMINAL_STATES } from './frozen-c/src/ports';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — THE FROZEN C ROUTER, IN-TREE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Contract §1: frozen C is THE Ask R2 routing authority, integrated without silently
 * rewriting its semantics. So:
 *
 *   1. its sources, corpus and fixtures are VENDORED BYTE-IDENTICAL from
 *      ASK-R2-CORE-ROUTER-PROTOTYPE-FROZEN.zip (sha256 30b12d9c…a15a) and every byte is
 *      re-verified here against the package's own MANIFEST.sha256 on every run — an edit to
 *      a frozen file fails this spec, whatever the edit;
 *   2. its 41-row corpus replays IN THIS TREE with the package runner's exact comparison
 *      (`probes/run-corpus.ts`), and must still be 41/41, every class and terminal reached,
 *      zero CONTRADICTORY divergence.
 *
 * The only accommodation is a backend jest mapper for the package's ESM-style `.js`
 * specifiers, scoped to the package's own module names. Integration defects go in the
 * adapters (ask-router/*.ts), never in `frozen-c/`.
 */

const ROOT = join(__dirname, 'frozen-c');

describe('frozen C — byte identity against its own manifest', () => {
  const manifest = readFileSync(join(ROOT, 'FROZEN-C-MANIFEST.sha256'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[0-9a-f]{64}\s+\*?(src|corpus|fixtures)\//.test(l))
    .map((l) => {
      const [hash, file] = l.split(/\s+\*?/);
      return { hash: hash!, file: file! };
    });

  it('vendors exactly the 11 src/corpus/fixtures files of the frozen package', () => {
    expect(manifest.map((m) => m.file).sort()).toEqual([
      'corpus/baseline-facts.ts',
      'corpus/corpus.ts',
      'corpus/design-matrix.ts',
      'fixtures/counterfactual.fixture.ts',
      'fixtures/specialist-registry.fixture.ts',
      'src/classify.ts',
      'src/envelope.ts',
      'src/index.ts',
      'src/planner.ts',
      'src/ports.ts',
      'src/registry.ts',
    ]);
  });

  it.each(
    readFileSync(join(ROOT, 'FROZEN-C-MANIFEST.sha256'), 'utf8')
      .split('\n')
      .filter((l) => /\s\*?(src|corpus|fixtures)\//.test(l))
      .map((l) => l.trim().split(/\s+\*?/)),
  )('%s  %s', (hash, file) => {
    expect(
      createHash('sha256')
        .update(readFileSync(join(ROOT, file!)))
        .digest('hex'),
    ).toBe(hash);
  });

  it('the manifest copy itself is the frozen package’s (its sha256 is pinned)', () => {
    expect(
      createHash('sha256')
        .update(readFileSync(join(ROOT, 'FROZEN-C-MANIFEST.sha256')))
        .digest('hex'),
    ).toBe(FROZEN_MANIFEST_SHA256);
  });
});

/*
  The frozen package's MANIFEST.sha256, hashed from the hash-verified archive
  (30b12d9c…a15a, 117,772 B) at vendoring time. A literal, so the manifest copy cannot be
  edited to agree with an edited source.
*/
const FROZEN_MANIFEST_SHA256 = 'a8e70e6c295eb7b49de6a88432e4d70278d970fbd19261177be7db406d6def25';

function show(v: unknown): string {
  return Array.isArray(v) ? `[${v.join(', ')}]` : String(v);
}

/** The package runner's comparison, verbatim in substance (probes/run-corpus.ts compareRow). */
function mismatches(row: CorpusRow): string[] {
  const { plan } = route(row.input, { specialistRegistry: specialistRegistryFixture });
  const droppedAxes = [
    ...new Set(plan.constraints.filter((c) => !c.carried).map((c) => c.axis)),
  ].sort();
  const checks: (readonly [string, unknown, unknown])[] = [
    ['questionClass', row.expect.questionClass, plan.questionClass],
    ['terminalState', row.expect.terminalState, plan.terminalState],
    ['refusals', row.expect.refusals, plan.refusals],
    ['scopedBy', row.expect.scopedBy, plan.scopedBy],
    ['scopedByLanded', row.expect.scopedByLanded, plan.scopedByLanded],
    ['divergenceKind', row.expect.divergenceKind, plan.divergenceKind],
    ['geographyRequired', row.expect.geographyRequired, plan.geographyRequired],
    ['modelPriorPermitted', row.expect.modelPriorPermitted, plan.modelPriorPermitted],
    ['droppedConstraintAxes', row.expect.droppedConstraintAxes, droppedAxes],
    ['disclosures', row.expect.disclosures, plan.disclosures],
  ];
  if (row.expect.specialistRequiredness !== undefined) {
    const actual = Object.fromEntries(plan.specialistLegs.map((l) => [l.domain, l.requiredness]));
    checks.push([
      'specialistRequiredness',
      JSON.stringify(row.expect.specialistRequiredness),
      JSON.stringify(actual),
    ]);
  }
  if (row.expect.reportingSubstitutionForbidden !== undefined) {
    checks.push([
      'reportingSubstitutionForbidden',
      row.expect.reportingSubstitutionForbidden,
      plan.reportingSubstitutionForbidden,
    ]);
  }
  if (row.expect.clarification !== undefined) {
    const actual = plan.clarification.map(
      (c) => `${c.code}:${c.axis ?? '-'}:${c.observed ?? '-'}:${c.candidate ?? '-'}`,
    );
    checks.push(['clarification', row.expect.clarification, actual]);
  }
  if (row.expect.verificationOutcomes !== undefined) {
    checks.push([
      'verificationOutcomes',
      row.expect.verificationOutcomes,
      plan.verification === null ? ['<no contract>'] : plan.verification.admissibleOutcomes,
    ]);
  }
  return checks
    .filter(([, e, a]) => show(e) !== show(a))
    .map(([f, e, a]) => `${f}: expected ${show(e)} / actual ${show(a)}`);
}

describe('frozen C — its corpus replays in this tree', () => {
  it.each(CORPUS.map((row) => [row.id, row] as const))('%s', (_id, row) => {
    expect(mismatches(row)).toEqual([]);
  });

  it('41 rows; every class and every terminal reached; 0 CONTRADICTORY divergence', () => {
    const plans = CORPUS.map(
      (row) => route(row.input, { specialistRegistry: specialistRegistryFixture }).plan,
    );
    expect(CORPUS).toHaveLength(41);
    expect(new Set(plans.map((p) => p.questionClass)).size).toBe(ASK_QUESTION_CLASSES.length);
    expect(new Set(plans.map((p) => p.terminalState)).size).toBe(TERMINAL_STATES.length);
    expect(plans.filter((p) => p.divergenceKind === 'CONTRADICTORY')).toHaveLength(0);
  });

  it('determinism: two routes of the same input are deep-equal', () => {
    for (const row of CORPUS) {
      const deps = { specialistRegistry: specialistRegistryFixture };
      expect(route(row.input, deps)).toEqual(route(row.input, deps));
    }
  });
});
