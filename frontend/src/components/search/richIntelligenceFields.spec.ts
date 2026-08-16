import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'AnalysisResultView.tsx'), 'utf-8');

/**
 * Milestone #62 Phase 1 — this repository's frontend test architecture
 * has no React Testing Library/jsdom anywhere (confirmed in the
 * M52-A round: not a dependency, no jest.config/setup exists), so —
 * exactly like every other frontend spec in this codebase — this
 * proves rendering behavior structurally, against the real source
 * text, rather than via a runtime render(). This is explicitly
 * STRUCTURAL/RENDERING VERIFICATION, not visual acceptance — per the
 * CTO's own instruction, true browser visual acceptance remains a
 * separate, deferred step.
 *
 * Milestone #62 Phase 1 introduced context/relevance; Phase 2 added
 * affectedParties/immediateImpacts/spilloverImplications; Phase 3
 * added significance; Phase 4 (this update, the final M62 phase)
 * adds watchNext, using the same structural-verification approach
 * throughout.
 */
describe('AnalysisResultView — relevance/context (M62 Phase 1)', () => {
  it('the relevance section is gated on analysis.relevance.length > 0 — no unconditional heading, no placeholder for the empty case', () => {
    const gateIndex = source.indexOf('{analysis.relevance.length > 0 && (');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(source).not.toMatch(/No relevance available/i);
    expect(source).not.toMatch(/No context available/i);
  });

  it('the context section is gated on analysis.context.length > 0', () => {
    expect(source).toMatch(/\{analysis\.context\.length > 0 && \(/);
  });

  it('relevance renders each item\u2019s claim text, citation, and evidence-sufficiency note — reusing the exact same shape keyFacts already uses, not a new rendering system', () => {
    const gateIndex = source.indexOf('{analysis.relevance.length > 0 && (');
    const nextGateIndex = source.indexOf('{analysis.context.length > 0 && (');
    const relevanceBlock = source.slice(gateIndex, nextGateIndex);

    expect(relevanceBlock).toMatch(/analysis\.relevance\.map\(\(item, index\) => \(/);
    expect(relevanceBlock).toMatch(/\{item\.claim\}/);
    expect(relevanceBlock).toMatch(
      /<AnalysisCitation sourceArticleIds=\{item\.sourceArticleIds\} sources=\{analysis\.sources\} \/>/,
    );
    expect(relevanceBlock).toMatch(/<EvidenceSufficiencyNote/);
    expect(relevanceBlock).toMatch(/evidenceBreadth=\{item\.evidenceBreadth\}/);
    expect(relevanceBlock).toMatch(/evidenceBasis=\{item\.evidenceBasis\}/);
  });

  it('context renders each item\u2019s claim text, citation, and evidence-sufficiency note, identically to relevance', () => {
    const gateIndex = source.indexOf('{analysis.context.length > 0 && (');
    const keyFactsGateIndex = source.indexOf('{/* Key facts */}');
    const contextBlock = source.slice(gateIndex, keyFactsGateIndex);

    expect(contextBlock).toMatch(/analysis\.context\.map\(\(item, index\) => \(/);
    expect(contextBlock).toMatch(/\{item\.claim\}/);
    expect(contextBlock).toMatch(
      /<AnalysisCitation sourceArticleIds=\{item\.sourceArticleIds\} sources=\{analysis\.sources\} \/>/,
    );
    expect(contextBlock).toMatch(/<EvidenceSufficiencyNote/);
  });

  it('ordering: the AI self-assessment disclosure closes, THEN relevance, THEN context, THEN key facts — trust/evidence status is never pushed below these interpretive sections', () => {
    const detailsCloseIndex = source.indexOf('</details>');
    const relevanceIndex = source.indexOf('{analysis.relevance.length > 0 && (');
    const contextIndex = source.indexOf('{analysis.context.length > 0 && (');
    const keyFactsCommentIndex = source.indexOf('{/* Key facts */}');
    const keyFactsGateIndex = source.indexOf('{analysis.keyFacts.length > 0 && (');

    expect(detailsCloseIndex).toBeGreaterThan(-1);
    expect(relevanceIndex).toBeGreaterThan(detailsCloseIndex);
    expect(contextIndex).toBeGreaterThan(relevanceIndex);
    expect(keyFactsCommentIndex).toBeGreaterThan(contextIndex);
    expect(keyFactsGateIndex).toBeGreaterThan(keyFactsCommentIndex);
  });

  it('TrustBadge and the AI self-assessment disclosure both appear before relevance/context — trust status is never demoted beneath interpretive content', () => {
    const trustBadgeIndex = source.indexOf('<TrustBadge trustState={analysis.trustState}');
    const detailsIndex = source.indexOf('<details className="rounded-2xl border border-border-strong bg-surface p-4">');
    const relevanceIndex = source.indexOf('{analysis.relevance.length > 0 && (');

    expect(trustBadgeIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(trustBadgeIndex);
    expect(relevanceIndex).toBeGreaterThan(detailsIndex);
  });
});

describe('AnalysisResultView — affectedParties/immediateImpacts/spilloverImplications (M62 Phase 2)', () => {
  it('all three sections are gated on their own .length > 0 — no unconditional heading, no placeholder for the empty case', () => {
    expect(source).toMatch(/\{analysis\.affectedParties\.length > 0 && \(/);
    expect(source).toMatch(/\{analysis\.immediateImpacts\.length > 0 && \(/);
    expect(source).toMatch(/\{analysis\.spilloverImplications\.length > 0 && \(/);
    expect(source).not.toMatch(/No affected parties/i);
    expect(source).not.toMatch(/No immediate impacts/i);
    expect(source).not.toMatch(/No spillover/i);
  });

  it('immediateImpacts and spilloverImplications reuse the exact same claim-rendering shape as context/relevance/keyFacts — no new rendering system', () => {
    const gateIndex = source.indexOf('{analysis.immediateImpacts.length > 0 && (');
    const nextGateIndex = source.indexOf('{analysis.spilloverImplications.length > 0 && (');
    const keyFactsCommentIndex = source.indexOf('{/* Key facts */}');
    const immediateBlock = source.slice(gateIndex, nextGateIndex);
    const spilloverBlock = source.slice(nextGateIndex, keyFactsCommentIndex);

    for (const block of [immediateBlock, spilloverBlock]) {
      expect(block).toMatch(/\{item\.claim\}/);
      expect(block).toMatch(
        /<AnalysisCitation sourceArticleIds=\{item\.sourceArticleIds\} sources=\{analysis\.sources\} \/>/,
      );
      expect(block).toMatch(/<EvidenceSufficiencyNote/);
    }
  });

  it('affectedParties renders party, partyType, and effect — a distinct shape from the plain claim-list pattern, without introducing a new component', () => {
    const gateIndex = source.indexOf('{analysis.affectedParties.length > 0 && (');
    const immediateGateIndex = source.indexOf('{analysis.immediateImpacts.length > 0 && (');
    const affectedBlock = source.slice(gateIndex, immediateGateIndex);

    expect(affectedBlock).toMatch(/analysis\.affectedParties\.map\(\(item, index\) => \(/);
    expect(affectedBlock).toMatch(/\{item\.party\}/);
    expect(affectedBlock).toMatch(/\{item\.partyType\}/);
    expect(affectedBlock).toMatch(/\{item\.effect\}/);
    expect(affectedBlock).toMatch(
      /<AnalysisCitation sourceArticleIds=\{item\.sourceArticleIds\} sources=\{analysis\.sources\} \/>/,
    );
    expect(affectedBlock).toMatch(/<EvidenceSufficiencyNote/);
  });

  it('ordering: context closes, THEN affectedParties, THEN immediateImpacts, THEN spilloverImplications, THEN key facts — matching the approved sequence', () => {
    const contextGateIndex = source.indexOf('{analysis.context.length > 0 && (');
    const affectedIndex = source.indexOf('{analysis.affectedParties.length > 0 && (');
    const immediateIndex = source.indexOf('{analysis.immediateImpacts.length > 0 && (');
    const spilloverIndex = source.indexOf('{analysis.spilloverImplications.length > 0 && (');
    const keyFactsCommentIndex = source.indexOf('{/* Key facts */}');

    expect(contextGateIndex).toBeGreaterThan(-1);
    expect(affectedIndex).toBeGreaterThan(contextGateIndex);
    expect(immediateIndex).toBeGreaterThan(affectedIndex);
    expect(spilloverIndex).toBeGreaterThan(immediateIndex);
    expect(keyFactsCommentIndex).toBeGreaterThan(spilloverIndex);
  });
});

describe('AnalysisResultView — significance (M62 Phase 3)', () => {
  it('the section is gated on a truthy check (analysis.significance &&), not .length — since significance is a single nullable object, not an array', () => {
    expect(source).toMatch(/\{analysis\.significance && \(/);
    expect(source).not.toMatch(/No significance available/i);
  });

  it('renders the significance heading and a level badge for all four levels, plus the rationale using the exact same claim-rendering shape as every other grounded-claim section', () => {
    const gateIndex = source.indexOf('{analysis.significance && (');
    const relevanceGateIndex = source.indexOf('{analysis.relevance.length > 0 && (');
    const block = source.slice(gateIndex, relevanceGateIndex);

    expect(block).toMatch(/\{t\.significance\}/);
    expect(block).toMatch(/significanceMinor/);
    expect(block).toMatch(/significanceModerate/);
    expect(block).toMatch(/significanceMajor/);
    expect(block).toMatch(/significanceCritical/);
    expect(block).toMatch(/analysis\.significance\.rationale\.map\(\(item, index\) => \(/);
    expect(block).toMatch(/\{item\.claim\}/);
    expect(block).toMatch(
      /<AnalysisCitation sourceArticleIds=\{item\.sourceArticleIds\} sources=\{analysis\.sources\} \/>/,
    );
    expect(block).toMatch(/<EvidenceSufficiencyNote/);
  });

  it('ordering: the AI self-assessment disclosure closes, THEN significance, THEN relevance — significance sits ahead of the Phase 1/2 interpretive sections, per the approved hierarchy', () => {
    const detailsCloseIndex = source.indexOf('</details>');
    const significanceIndex = source.indexOf('{analysis.significance && (');
    const relevanceIndex = source.indexOf('{analysis.relevance.length > 0 && (');

    expect(detailsCloseIndex).toBeGreaterThan(-1);
    expect(significanceIndex).toBeGreaterThan(detailsCloseIndex);
    expect(relevanceIndex).toBeGreaterThan(significanceIndex);
  });

  it('TrustBadge appears before significance, and the significance markup is never nested inside or adjacent-styled to resemble TrustBadge — trust/evidence status is never conflated with severity', () => {
    const trustBadgeIndex = source.indexOf('<TrustBadge trustState={analysis.trustState}');
    const significanceIndex = source.indexOf('{analysis.significance && (');
    const trustBadgeSnippet = source.slice(trustBadgeIndex, trustBadgeIndex + 200);

    expect(trustBadgeIndex).toBeGreaterThan(-1);
    expect(significanceIndex).toBeGreaterThan(trustBadgeIndex);
    expect(trustBadgeSnippet).not.toMatch(/significance/);
  });
});

describe('AnalysisResultView — watchNext (M62 Phase 4, final)', () => {
  it('the section is gated on .length > 0, matching every other array-shaped grounded-claim field, and renders no empty-state placeholder', () => {
    expect(source).toMatch(/\{analysis\.watchNext\.length > 0 && \(/);
    expect(source).not.toMatch(/No watchNext available/i);
    expect(source).not.toMatch(/Nothing to watch/i);
  });

  it('reuses the exact same claim-rendering shape as every other grounded-claim section — no new visual subsystem', () => {
    const gateIndex = source.indexOf('{analysis.watchNext.length > 0 && (');
    const keyFactsCommentIndex = source.indexOf('{/* Key facts */}');
    const block = source.slice(gateIndex, keyFactsCommentIndex);

    expect(block).toMatch(/\{t\.watchNext\}/);
    expect(block).toMatch(/analysis\.watchNext\.map\(\(item, index\) => \(/);
    expect(block).toMatch(/\{item\.claim\}/);
    expect(block).toMatch(
      /<AnalysisCitation sourceArticleIds=\{item\.sourceArticleIds\} sources=\{analysis\.sources\} \/>/,
    );
    expect(block).toMatch(/<EvidenceSufficiencyNote/);
  });

  it('ordering: spilloverImplications closes, THEN watchNext, THEN key facts — matching the final approved interpretive sequence', () => {
    const spilloverIndex = source.indexOf('{analysis.spilloverImplications.length > 0 && (');
    const watchNextIndex = source.indexOf('{analysis.watchNext.length > 0 && (');
    const keyFactsCommentIndex = source.indexOf('{/* Key facts */}');

    expect(spilloverIndex).toBeGreaterThan(-1);
    expect(watchNextIndex).toBeGreaterThan(spilloverIndex);
    expect(keyFactsCommentIndex).toBeGreaterThan(watchNextIndex);
  });

  it('the full final interpretive ordering holds end to end: significance, relevance, context, affectedParties, immediateImpacts, spilloverImplications, watchNext, then key facts', () => {
    const order = [
      '{analysis.significance && (',
      '{analysis.relevance.length > 0 && (',
      '{analysis.context.length > 0 && (',
      '{analysis.affectedParties.length > 0 && (',
      '{analysis.immediateImpacts.length > 0 && (',
      '{analysis.spilloverImplications.length > 0 && (',
      '{analysis.watchNext.length > 0 && (',
      '{/* Key facts */}',
    ];
    let lastIndex = -1;
    for (const marker of order) {
      const index = source.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });
});
