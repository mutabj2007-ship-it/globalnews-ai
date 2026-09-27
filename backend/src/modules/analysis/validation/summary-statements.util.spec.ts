import { projectSummaryStatements } from '@globalnews-ai/shared';
import type { NewsAnalysisResult } from '@globalnews-ai/shared';
import { withholdExecutiveBrief } from './brief-fail-closed.util';
import {
  demoteContextOnlyConsequenceStatements,
  isUnreportedAnalyticalInference,
  validateSummaryStatements,
} from './summary-statements.util';

/** Request-local S-labels → real article ids, as validateAnalysisResult builds it. */
const EVIDENCE = new Map([
  ['S1', 'crash-1'],
  ['S2', 'crash-2'],
  ['S3', 'crash-3'],
  ['S4', 'ebola-1'],
]);

const stmt = (text: string, kind: string, evidenceIds: string[] = []) => ({ text, kind, evidenceIds });

describe('INLINE CITATIONS R1 — validateSummaryStatements (citation authority)', () => {
  it('one supporting article: the sentence carries exactly that article', () => {
    const summary = 'The aircraft crashed near Goma.';
    expect(
      validateSummaryStatements([stmt(summary, 'REPORTED_FACT', ['S1'])], summary, EVIDENCE),
    ).toEqual([{ text: summary, kind: 'REPORTED_FACT', sourceArticleIds: ['crash-1'] }]);
  });

  it('multiple supporting articles: every resolved id, deduplicated, in cited order', () => {
    const summary = 'The aircraft crashed while returning to Kinshasa, killing 14 people.';
    const [only] = validateSummaryStatements(
      [stmt(summary, 'REPORTED_FACT', ['S2', 'S1', 'S2'])],
      summary,
      EVIDENCE,
    );
    expect(only.sourceArticleIds).toEqual(['crash-2', 'crash-1']);
  });

  it('mixed evidence: unknown / fabricated / real-id evidenceIds are dropped, valid ones kept', () => {
    const summary = 'The exact cause remains under investigation.';
    const [only] = validateSummaryStatements(
      [stmt(summary, 'REPORTED_FACT', ['S2', 'S99', 'crash-3', 'https://x'])],
      summary,
      EVIDENCE,
    );
    expect(only).toEqual({ text: summary, kind: 'REPORTED_FACT', sourceArticleIds: ['crash-2'] });
  });

  it('no evidence: a sentence claimed as reported with nothing resolvable is UNSUPPORTED and uncited', () => {
    const summary = 'Rwanda closed its border after the crash.';
    expect(
      validateSummaryStatements([stmt(summary, 'REPORTED_CONSEQUENCE', ['S99'])], summary, EVIDENCE),
    ).toEqual([{ text: summary, kind: 'UNSUPPORTED', sourceArticleIds: [] }]);
  });

  it('an annotation that is not an exact span of the summary is never placed or rendered', () => {
    const summary = 'The aircraft crashed near Goma.';
    expect(
      validateSummaryStatements(
        [stmt('The aircraft crashed near Goma airport.', 'REPORTED_FACT', ['S1'])],
        summary,
        EVIDENCE,
      ),
    ).toEqual([]);
  });

  it('a span crossing a paragraph break is refused (it cannot sit inside one paragraph)', () => {
    const summary = 'First development.\n\nSecond development.';
    expect(
      validateSummaryStatements([stmt(summary, 'REPORTED_FACT', ['S1'])], summary, EVIDENCE),
    ).toEqual([]);
  });

  it('out-of-order annotations are placed forward-only; the summary text is never altered', () => {
    const summary = 'A happened. B happened.';
    const statements = validateSummaryStatements(
      [stmt('B happened.', 'REPORTED_FACT', ['S1']), stmt('A happened.', 'REPORTED_FACT', ['S2'])],
      summary,
      EVIDENCE,
    );
    expect(statements.map((s) => s.text)).toEqual(['B happened.']);
    const { segments } = projectSummaryStatements(summary, statements);
    expect(segments.map((s) => s.text).join('')).toBe(summary);
  });

  it('an empty (withheld) summary has no statements', () => {
    expect(validateSummaryStatements([stmt('x', 'REPORTED_FACT', ['S1'])], '', EVIDENCE)).toEqual([]);
  });

  it('a reported sentence that cites nothing stays plain summary (e.g. an honest gap statement)', () => {
    const summary = 'The available reporting does not establish what caused the crash.';
    expect(validateSummaryStatements([stmt(summary, 'REPORTED_FACT', [])], summary, EVIDENCE)).toEqual([]);
  });

  it('absent or malformed annotations never throw', () => {
    expect(validateSummaryStatements(undefined, 'Plain.', EVIDENCE)).toEqual([]);
    expect(validateSummaryStatements('nope', 'Plain.', EVIDENCE)).toEqual([]);
    expect(validateSummaryStatements([null, 7, { text: 1 }], 'Plain.', EVIDENCE)).toEqual([]);
  });
});

describe('INLINE CITATIONS R1 — the inference authority', () => {
  it('model-declared ANALYTICAL_INFERENCE is labelled and never cited, even with ids', () => {
    const summary = 'The loss of senior officers could affect command continuity.';
    expect(
      validateSummaryStatements(
        [stmt(summary, 'ANALYTICAL_INFERENCE', ['S1'])],
        summary,
        EVIDENCE,
      ),
    ).toEqual([{ text: summary, kind: 'ANALYTICAL_INFERENCE', sourceArticleIds: [] }]);
  });

  it('the live defect: speculation annotated as fact is relabelled ANALYTICAL_INFERENCE', () => {
    const summary = 'The deaths could potentially affect military operations in the east.';
    expect(
      validateSummaryStatements([stmt(summary, 'REPORTED_FACT', ['S1'])], summary, EVIDENCE),
    ).toEqual([{ text: summary, kind: 'ANALYTICAL_INFERENCE', sourceArticleIds: [] }]);
  });

  it('the live defect: un-annotated speculation in the brief is still labelled', () => {
    const summary =
      'Fourteen people died in the crash. It may have indirect implications for regional security.';
    const statements = validateSummaryStatements(
      [stmt('Fourteen people died in the crash.', 'REPORTED_FACT', ['S1', 'S2'])],
      summary,
      EVIDENCE,
    );
    expect(statements).toEqual([
      { text: 'Fourteen people died in the crash.', kind: 'REPORTED_FACT', sourceArticleIds: ['crash-1', 'crash-2'] },
      {
        text: 'It may have indirect implications for regional security.',
        kind: 'ANALYTICAL_INFERENCE',
        sourceArticleIds: [],
      },
    ]);
  });

  it('attributed speculation is a reported statement, not our inference', () => {
    expect(isUnreportedAnalyticalInference('Officials warned the closure could raise prices.')).toBe(false);
    expect(isUnreportedAnalyticalInference('According to the WHO, cases may rise.')).toBe(false);
    expect(isUnreportedAnalyticalInference('Według ministra inflacja może spaść.')).toBe(false);
  });

  it('non-speculative prose is untouched; "May" the month is not a modal', () => {
    expect(isUnreportedAnalyticalInference('In May, the army confirmed the crash.')).toBe(false);
    expect(isUnreportedAnalyticalInference('The inquiry opened on Monday.')).toBe(false);
  });

  it('Polish speculative forms are recognised', () => {
    expect(isUnreportedAnalyticalInference('Katastrofa może wpłynąć na operacje wojskowe.')).toBe(true);
    expect(isUnreportedAnalyticalInference('To prawdopodobnie osłabi dowództwo.')).toBe(true);
    expect(isUnreportedAnalyticalInference('Samolot rozbił się w pobliżu Gomy.')).toBe(false);
  });

  it('a speculation the verified excerpt itself makes is reported, not inferred', () => {
    expect(
      isUnreportedAnalyticalInference(
        'The closure could raise fuel prices.',
        'traders say the closure could raise fuel prices',
      ),
    ).toBe(false);
  });
});

describe('INLINE CITATIONS R1 — context-only consequence (Anchoring R1 Gate C on the summary)', () => {
  const context = new Set(['ebola-1']);

  it('a consequence cited only to context becomes UNSUPPORTED; event-cited statements are kept', () => {
    const { statements, demoted } = demoteContextOnlyConsequenceStatements(
      [
        { text: 'Neighbouring countries are on alert.', kind: 'REPORTED_CONSEQUENCE', sourceArticleIds: ['ebola-1'] },
        { text: 'Rwanda closed its border.', kind: 'REPORTED_CONSEQUENCE', sourceArticleIds: ['crash-1', 'ebola-1'] },
        { text: 'Ebola cases are rising.', kind: 'REPORTED_FACT', sourceArticleIds: ['ebola-1'] },
      ],
      context,
    );
    expect(demoted).toBe(1);
    expect(statements).toEqual([
      { text: 'Neighbouring countries are on alert.', kind: 'UNSUPPORTED', sourceArticleIds: [] },
      { text: 'Rwanda closed its border.', kind: 'REPORTED_CONSEQUENCE', sourceArticleIds: ['crash-1', 'ebola-1'] },
      /* Context may still be stated as a fact about the context itself. */
      { text: 'Ebola cases are rising.', kind: 'REPORTED_FACT', sourceArticleIds: ['ebola-1'] },
    ]);
  });

  it('absent statements stay absent', () => {
    expect(demoteContextOnlyConsequenceStatements(undefined, context)).toEqual({
      statements: undefined,
      demoted: 0,
    });
  });
});

describe('INLINE CITATIONS R1 — retained / withheld brief', () => {
  it('withholding the brief clears its statements with it', () => {
    const analysis = {
      summary: 'A happened.',
      summaryStatements: [{ text: 'A happened.', kind: 'REPORTED_FACT', sourceArticleIds: ['crash-1'] }],
    } as unknown as NewsAnalysisResult;
    const withheld = withholdExecutiveBrief(
      analysis,
      { compliant: false, reason: 'x', breadth: { clusters: 2, categories: 2 } } as never,
      false,
    );
    expect(withheld.summary).toBe('');
    expect(withheld.summaryStatements).toEqual([]);
  });

  it('a pre-R1 record without statements stays without them', () => {
    const withheld = withholdExecutiveBrief(
      { summary: 'A happened.' } as unknown as NewsAnalysisResult,
      { compliant: false, reason: 'x', breadth: { clusters: 2, categories: 2 } } as never,
      false,
    );
    expect('summaryStatements' in withheld).toBe(false);
  });
});
