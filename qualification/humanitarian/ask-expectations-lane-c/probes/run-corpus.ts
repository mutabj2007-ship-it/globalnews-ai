/**
 * CORPUS RUNNER. Deterministic: no clock, no randomness, no network, no environment read.
 * Output is byte-identical across processes, which probe P-2 verifies by running it twice.
 */

import { CORPUS, uncoveredContractTests, reachedStates, hasBothProvenanceClasses } from '../corpus/corpus.js';
import { readHumanitarian, plannableForRead } from '../src/reader.js';
import { storeFor } from '../fixtures/store.fixture.js';

let pass = 0;
const failures: string[] = [];

for (const row of CORPUS) {
  const port = storeFor(row.store);
  const result = readHumanitarian(port, row.request);
  const problems: string[] = [];

  if (result.state !== row.expectState) {
    problems.push(`state ${result.state} != ${row.expectState}`);
  }
  if (result.assessment !== row.expectAssessment) {
    problems.push(`assessment ${result.assessment} != ${row.expectAssessment}`);
  }
  if (result.refusal !== row.expectRefusal) {
    problems.push(`refusal ${String(result.refusal)} != ${String(row.expectRefusal)}`);
  }
  if (result.claims.length > 0 !== row.expectClaimsNonEmpty) {
    problems.push(`claims ${result.claims.length} vs expectNonEmpty ${row.expectClaimsNonEmpty}`);
  }
  if (result.withheldTotal !== row.expectWithheldTotal) {
    problems.push(`withheldTotal ${result.withheldTotal} != ${row.expectWithheldTotal}`);
  }
  if (result.askTerminal !== row.expectAskTerminal) {
    problems.push(`askTerminal ${String(result.askTerminal)} != ${String(row.expectAskTerminal)}`);
  }
  if (plannableForRead(result) !== row.expectExecutionPlannable) {
    problems.push(`plannable ${plannableForRead(result)} != ${row.expectExecutionPlannable}`);
  }

  if (problems.length === 0) {
    pass += 1;
  } else {
    failures.push(`${row.id} [${row.contractTest}] ${problems.join('; ')}`);
  }
}

console.log('CORPUS ROWS      ' + String(CORPUS.length));
console.log('PASS             ' + String(pass));
console.log('FAIL             ' + String(failures.length));
for (const f of failures) console.log('  FAIL ' + f);
console.log('CONTRACT TESTS   ' + String(8 - uncoveredContractTests().length) + '/8 covered');
console.log('UNCOVERED        ' + (uncoveredContractTests().join(',') || '(none)'));
console.log('STATES REACHED   ' + reachedStates().join(','));
console.log('PROVENANCE BOTH  ' + String(hasBothProvenanceClasses()));
if (failures.length > 0) process.exitCode = 1;
