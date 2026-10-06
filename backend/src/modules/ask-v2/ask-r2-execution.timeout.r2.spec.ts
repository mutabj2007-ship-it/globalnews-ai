import { isTimeoutFailure } from './ask-r2-execution.adapter';
import { AnalysisDeadlineExceededError } from '../analysis/service/analysis.service';

/**
 * ASK R2 LIVE-GATE REPAIR (P0-5) — live Alpha 2026-10-06 10:42Z: the analysis budget expired and
 * the turn was released MODEL_FAILURE → "Ask is unavailable right now". A deadline / budget expiry
 * / provider timeout is MODEL_TIMEOUT end to end.
 */
describe('P0-5 · a deadline is a timeout, whatever its wording', () => {
  it.each([
    'Analysis did not complete within the total synchronous budget of 28000 ms.',
    'OpenAI request cancelled because the analysis response deadline expired.',
    'provider-timeout',
    'GNews request timed out.',
  ])('%s → timeout', (text) => {
    expect(isTimeoutFailure(text)).toBe(true);
    expect(isTimeoutFailure(new Error(text))).toBe(true);
  });

  it('the real deadline error the analysis throws is a timeout', () => {
    expect(isTimeoutFailure(new AnalysisDeadlineExceededError(28_000, 'k'))).toBe(true);
  });

  it.each(['OpenAI returned malformed JSON', 'Schema validation failed', 'quota exceeded'])(
    '%s → NOT a timeout (stays a failure)',
    (text) => {
      expect(isTimeoutFailure(new Error(text))).toBe(false);
    },
  );
});
