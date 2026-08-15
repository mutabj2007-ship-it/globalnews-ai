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
 * Milestone #62 Phase 1 introduced context/relevance; Phase 2 (this
 * update) adds affectedParties/immediateImpacts/spilloverImplications
 * using the same structural-verification approach. significance and
 * watchNext remain out of scope and this file does not reference
 * either.
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

  it('does not reference significance or watchNext — both remain out of scope through M62 Phase 2', () => {
    expect(source).not.toMatch(/analysis\.significance/);
    expect(source).not.toMatch(/analysis\.watchNext/);
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

  it('does not reference significance or watchNext anywhere — both remain out of scope for this phase', () => {
    expect(source).not.toMatch(/analysis\.significance/);
    expect(source).not.toMatch(/analysis\.watchNext/);
  });
});
