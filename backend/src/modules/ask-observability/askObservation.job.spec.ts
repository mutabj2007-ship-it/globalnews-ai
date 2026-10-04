import {
  governedCode,
  governedCodes,
  OBSERVED_ARTIFACT_KINDS,
  OBSERVED_JOB_KINDS,
  OBSERVED_PLACE_CODE,
  OBSERVED_SEMANTIC_CONFLICTS,
  OBSERVED_SEMANTIC_RELATIONS,
  OBSERVED_TRANSFORMATIONS,
} from './ask-observation.contract';
import { TRANSFORMATIONS, USER_JOBS } from '../ask-router/user-job';
import { IR_CONFLICTS } from '../ask-router/semantic-ir/semantic-turn-ir';
import { RELATION_KINDS } from '../ask-router/bilateral-relationship';
import {
  ARTIFACT_KINDS,
  SERVER_ARTIFACT_KINDS,
} from '../ask-v2/conversation/conversation-artifact';

/**
 * CTO R4 closeout — the observation's job vocabularies are COPIES (the observability module reaches
 * no router or Ask file). This proves the copies equal the authorities, so a new job, transformation
 * or artifact kind cannot be silently dropped by the writer, and that free text never survives.
 */
describe('R4 — observed job vocabularies equal their authorities', () => {
  it('job kinds = USER_JOBS + UNRESOLVED', () => {
    expect([...OBSERVED_JOB_KINDS].sort()).toEqual([...USER_JOBS, 'UNRESOLVED'].sort());
  });
  it('transformations = TRANSFORMATIONS', () => {
    expect([...OBSERVED_TRANSFORMATIONS].sort()).toEqual([...TRANSFORMATIONS].sort());
  });
  /* R4 ALPHA R-3 — the authority now holds the model kinds AND the server-derived answer records */
  it('artifact kinds = ARTIFACT_KINDS + SERVER_ARTIFACT_KINDS', () => {
    expect([...OBSERVED_ARTIFACT_KINDS].sort()).toEqual(
      [...ARTIFACT_KINDS, ...SERVER_ARTIFACT_KINDS].sort(),
    );
  });
  it('CTO R4 semantic IR — conflict / relation vocabularies equal their authorities', () => {
    expect([...OBSERVED_SEMANTIC_CONFLICTS].sort()).toEqual([...IR_CONFLICTS].sort());
    expect([...OBSERVED_SEMANTIC_RELATIONS].sort()).toEqual([...RELATION_KINDS].sort());
  });
  it('CTO R4 semantic IR — place codes are ISO3 / REGION key / CITY:<ISO2>; names and prose are dropped', () => {
    expect(governedCodes(['COD', 'REGION:SENKAKU', 'CITY:QA'], OBSERVED_PLACE_CODE)).toEqual([
      'COD',
      'REGION:SENKAKU',
      'CITY:QA',
    ]);
    expect(
      governedCodes(['CITY:QA:Doha', 'Doha', 'the Falklands', 'rwa'], OBSERVED_PLACE_CODE),
    ).toEqual([]);
    expect(governedCodes(['JOB_UNRESOLVED', 'why did they…'], OBSERVED_SEMANTIC_CONFLICTS)).toEqual(
      ['JOB_UNRESOLVED'],
    );
  });
  it('POSITIVE CONTROL — a value outside the vocabulary (free text) is dropped to null', () => {
    expect(governedCode('DEEP_CONCEPTUAL_ANALYSIS', OBSERVED_JOB_KINDS)).toBe(
      'DEEP_CONCEPTUAL_ANALYSIS',
    );
    expect(governedCode('How does a currency peg turn a shock…', OBSERVED_JOB_KINDS)).toBeNull();
    expect(governedCode('Prime moment', OBSERVED_ARTIFACT_KINDS)).toBeNull();
    expect(governedCode(null, OBSERVED_JOB_KINDS)).toBeNull();
  });
});
