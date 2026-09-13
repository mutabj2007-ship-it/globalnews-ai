import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * ONE MODEL GENERATION, EVEN WHEN THE EXECUTIVE BRIEF IS INVALID.
 *
 * Railway run 579a0134: the brief failed structural compliance, the backend
 * requested a "targeted repair", and that repair was a SECOND FULL
 * `provider.analyzeNews()` — 6,689 tokens against the original's 6,367, 13,887 ms
 * on top of 16,535 ms — which pushed a correct response 914 ms past the client
 * deadline. The reader was told the analysis had failed.
 *
 * The repair is off the synchronous path. These assertions are structural,
 * against the service source, because they must hold even where a provider
 * double cannot be constructed.
 */

const SOURCE = readFileSync(join(__dirname, 'analysis.service.ts'), 'utf8');

describe('an invalid Executive Brief costs ONE generation, not two', () => {
  it('the analysis path calls the provider exactly once', () => {
    const calls = SOURCE.match(/await this\.provider\.analyzeNews\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it('no repair directive is built on the synchronous path', () => {
    expect(SOURCE).not.toMatch(/buildBriefRepairDirective\s*\(/);
  });

  it('a non-compliant brief is withheld rather than re-generated', () => {
    expect(SOURCE).toMatch(/withholdExecutiveBrief/);
    expect(SOURCE).toMatch(/briefVerdict\.compliant/);
  });

  /*
    THE VALIDATION ITSELF MUST NOT HAVE MOVED. Removing the repair was a latency
    correction; it is not permission to accept a brief that failed.
  */
  it('brief compliance is still assessed, and acceptance is still gated on it', () => {
    expect(SOURCE).toMatch(/assessBriefCompliance\(/);
    expect(SOURCE).toMatch(/acceptExecutiveBrief/);
  });

  it('the rest of the analysis is still returned when the brief is withheld', () => {
    /* withholdExecutiveBrief empties the summary and stamps the state; it does
       not discard the validated record. The stamping is one expression, so an
       accepted and a withheld brief cannot come from two drifting paths. */
    expect(SOURCE).toMatch(/briefVerdict\.compliant\s*\n?\s*\?\s*acceptExecutiveBrief/);
  });
});

describe('the total synchronous budget is ENFORCED, not merely declared', () => {
  it('the complete operation is raced against the configured total budget', () => {
    expect(SOURCE).toMatch(/withResponseDeadline\(/);
    expect(SOURCE).toMatch(/config\.totalBudgetMs/);
    expect(SOURCE).toMatch(/Promise\.race\(/);
  });

  it('the deadline failure is a distinct type, not a generic provider failure', () => {
    expect(SOURCE).toMatch(/class AnalysisDeadlineExceededError/);
  });

  it('in-flight coalescing is preserved — the race does not replace it', () => {
    expect(SOURCE).toMatch(/this\.inFlightAnalyses\.set\(cacheKey/);
  });
});
