import { BACKGROUND_PRESENTATION_RULE, jobRulesFor } from './job-execution';

/**
 * R7 X4 (#92) — the general-background path's presentation contract (the PO's conceptual answer:
 * long numbered paragraphs and an invented "70%" forecast). Separate from WP6, which never reaches
 * this path. Pure text fixtures: no provider, model, DB or network.
 */
const job = (over: Record<string, unknown> = {}) =>
  ({ job: 'REFERENCE', depth: 'STANDARD', transformation: null, analysis: null, discourseReference: 'NONE', ...over }) as never;

describe('R7 X4 · background presentation (separate from WP6)', () => {
  it('every background answer carries the presentation contract, LAST (existing numbering unchanged)', () => {
    for (const j of [job(), job({ job: 'DEEP_CONCEPTUAL_ANALYSIS', depth: 'DEEP' }), job({ job: 'PLANNING' })]) {
      const rules = jobRulesFor(j, false);
      expect(rules.startsWith('R4 JOB RULES (trusted)\n1. ')).toBe(true);
      expect(rules.trim().endsWith(BACKGROUND_PRESENTATION_RULE)).toBe(true);
    }
  });

  it('lead first; illustrative examples labelled; no uncalibrated probability or percentage', () => {
    expect(BACKGROUND_PRESENTATION_RULE).toMatch(/^PRESENTATION: Lead with the direct answer/);
    expect(BACKGROUND_PRESENTATION_RULE).toMatch(/do not write long numbered paragraphs/);
    expect(BACKGROUND_PRESENTATION_RULE).toMatch(/Label any example, scenario or hypothetical as illustrative/);
    expect(BACKGROUND_PRESENTATION_RULE).toMatch(
      /Do not give a numerical probability, percentage or likelihood figure unless it is a calibrated figure from a source you can name/,
    );
  });

  it('it is NOT the WP6 block (WP6 never reaches the background path)', () => {
    expect(BACKGROUND_PRESENTATION_RULE).not.toContain('ANSWER PRESENTATION');
  });
});
