import type { SourceDiversity } from '@globalnews-ai/shared';
import { resolveSourceDiversityText } from './SourceDiversitySummary';

function makeDiversity(overrides: Partial<SourceDiversity> = {}): SourceDiversity {
  return {
    retrievedArticleCount: 8,
    reportingClusterCount: 5,
    duplicateLikeClusterCount: 2,
    largestClusterSize: 3,
    knownDomainCount: 4,
    unknownDomainArticleCount: 0,
    distinctSourceNameCount: 5,
    ...overrides,
  };
}

const BANNED_PHRASES = ['independent source', 'independent report', 'verified publisher', 'independent publisher'];

describe('resolveSourceDiversityText (Milestone #44 SourceDiversitySummary logic)', () => {
  it('I. live: 8 retrieved / 5 clusters -> safe structural wording', () => {
    const text = resolveSourceDiversityText(makeDiversity(), false);
    expect(text?.primary).toBe('8 retrieved articles · 5 reporting clusters');
  });

  it('J. never emits banned independence/verification language, in primary or detail text', () => {
    const text = resolveSourceDiversityText(makeDiversity({ unknownDomainArticleCount: 2 }), false);
    const allText = [text?.primary, ...(text?.detail ?? [])].join(' ').toLowerCase();
    for (const banned of BANNED_PHRASES) {
      expect(allText).not.toContain(banned);
    }
  });

  it('K. mock mode is explicitly demo-qualified, not presented as live evidence breadth', () => {
    const text = resolveSourceDiversityText(makeDiversity({ retrievedArticleCount: 1, reportingClusterCount: 1 }), true);
    expect(text?.primary).toContain('Demo data');
    expect(text?.primary).toContain('1 retrieved article');
    // Detail metrics are omitted entirely in mock mode (simplification, per approved contract).
    expect(text?.detail).toEqual([]);
  });

  it('mock wording never claims to be ordinary "source diversity" or "evidence breadth"', () => {
    const text = resolveSourceDiversityText(makeDiversity(), true);
    expect(text?.primary.toLowerCase()).not.toContain('evidence breadth');
    expect(text?.primary.toLowerCase()).not.toContain('source diversity');
  });

  it('L. absent sourceDiversity -> undefined (component renders nothing)', () => {
    expect(resolveSourceDiversityText(undefined, false)).toBeUndefined();
    expect(resolveSourceDiversityText(undefined, true)).toBeUndefined();
  });

  it('singular/plural wording is grammatically correct at count boundaries', () => {
    const text = resolveSourceDiversityText(
      makeDiversity({ retrievedArticleCount: 1, reportingClusterCount: 1 }),
      false,
    );
    expect(text?.primary).toBe('1 retrieved article · 1 reporting cluster');
  });

  it('detail includes unknownDomainArticleCount only when greater than zero', () => {
    const withUnknown = resolveSourceDiversityText(makeDiversity({ unknownDomainArticleCount: 3 }), false);
    const withoutUnknown = resolveSourceDiversityText(makeDiversity({ unknownDomainArticleCount: 0 }), false);
    expect(withUnknown?.detail.some((line) => line.includes('unrecognized URLs'))).toBe(true);
    expect(withoutUnknown?.detail.some((line) => line.includes('unrecognized URLs'))).toBe(false);
  });
});
