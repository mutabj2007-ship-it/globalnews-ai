import {
  governedCode,
  OBSERVED_ARTIFACT_KINDS,
  OBSERVED_JOB_KINDS,
  OBSERVED_TRANSFORMATIONS,
} from './ask-observation.contract';
import { TRANSFORMATIONS, USER_JOBS } from '../ask-router/user-job';
import { ARTIFACT_KINDS } from '../ask-v2/conversation/conversation-artifact';

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
  it('artifact kinds = ARTIFACT_KINDS', () => {
    expect([...OBSERVED_ARTIFACT_KINDS].sort()).toEqual([...ARTIFACT_KINDS].sort());
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
