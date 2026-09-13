import type { TrustState } from '@globalnews-ai/shared';
import { resolveTrustVisual } from './TrustBadge';

function makeTrustState(overrides: Partial<TrustState>): TrustState {
  return {
    level: 'insufficient',
    reasons: [],
    distinctSourceArticleCount: 0,
    differenceTopicCount: 0,
    uncertaintyCount: 0,
    ...overrides,
  };
}

describe('resolveTrustVisual (Milestone #44 TrustBadge logic)', () => {
  it('A. HIGH -> strong evidence-support text + distinct icon', () => {
    const visual = resolveTrustVisual(
      makeTrustState({ level: 'high', reasons: ['relational-support-adequate'] }),
    );
    expect(visual.label).toBe('Strong evidence support');
    expect(visual.icon).toBeDefined();
  });

  it('B. MODERATE -> moderate support text', () => {
    const visual = resolveTrustVisual(
      makeTrustState({ level: 'moderate', reasons: ['multiple-distinct-articles'] }),
    );
    expect(visual.label).toBe('Moderate evidence support');
  });

  it('C. LIMITED -> limited support text', () => {
    const visual = resolveTrustVisual(
      makeTrustState({ level: 'limited', reasons: ['single-distinct-article'] }),
    );
    expect(visual.label).toBe('Limited evidence support');
  });

  it('D. INSUFFICIENT live evidence -> ordinary insufficient-evidence wording, NOT demo wording', () => {
    const visual = resolveTrustVisual(
      makeTrustState({ level: 'insufficient', reasons: ['no-grounded-evidence'] }),
    );
    expect(visual.label).toBe('Insufficient evidence');
  });

  it('E. mock-execution -> distinct demo wording, never the ordinary live-insufficiency label', () => {
    const visual = resolveTrustVisual(
      makeTrustState({ level: 'insufficient', reasons: ['mock-execution'] }),
    );
    expect(visual.label).toBe('Demo analysis — real evidence trust not assessed');
    expect(visual.label).not.toBe('Insufficient evidence');
  });

  it('every level pairs a DISTINCT icon with distinct text (never color alone)', () => {
    const levels: TrustState['level'][] = ['high', 'moderate', 'limited', 'insufficient'];
    const seenIcons = new Set<unknown>();
    const seenLabels = new Set<string>();
    for (const level of levels) {
      const visual = resolveTrustVisual(makeTrustState({ level, reasons: ['no-grounded-evidence'] }));
      seenIcons.add(visual.icon);
      seenLabels.add(visual.label);
    }
    expect(seenIcons.size).toBe(4);
    expect(seenLabels.size).toBe(4);
  });

  it('N. never independently recalculates TrustLevel — resolveTrustVisual only ever reads trustState.level, never derives it', () => {
    // Constructing a deliberately "impossible" combination (level says
    // insufficient, but reasons look like a strong relational case) to
    // prove the function trusts trustState.level verbatim rather than
    // re-deriving from reasons/counts.
    const visual = resolveTrustVisual(
      makeTrustState({
        level: 'insufficient',
        reasons: ['relational-support-adequate'],
        distinctSourceArticleCount: 99,
      }),
    );
    expect(visual.label).toBe('Insufficient evidence');
  });

  it('G. primary reason text is deterministic given the same reasons array', () => {
    const state = makeTrustState({ level: 'limited', reasons: ['relational-support-limited', 'uncertainties-reported'] });
    const a = resolveTrustVisual(state);
    const b = resolveTrustVisual(state);
    expect(a.primaryReasonText).toBe(b.primaryReasonText);
  });
});
