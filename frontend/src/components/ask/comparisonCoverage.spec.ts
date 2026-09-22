import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskCompactResult } from './AskCompactResult';
import { fixture } from '@/components/analysis-frame/frameFixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { usesStoryContextLabel } from '@/lib/ask/turnContext';

describe('Ask coverage presentation', () => {
  it.each(['What happened next?', 'Why?', 'Co dalej?', 'Dlaczego?'])(
    'preserves short relative follow-up: %s',
    (question) => {
      expect(usesStoryContextLabel(question)).toBe(true);
    },
  );
  it.each([
    'Compare Israel, Iran and Saudi Arabia',
    'What is happening in Iran?',
    'Co się dzieje w Iranie?',
  ])('does not label new geography as a story follow-up: %s', (question) => {
    expect(usesStoryContextLabel(question)).toBe(false);
  });
  it('uses the authoritative server decision once settled', () => {
    expect(usesStoryContextLabel('What happened next?', false)).toBe(false);
    expect(usesStoryContextLabel('Explain the outcome', true)).toBe(true);
  });
  it('renders all coverage members in compact results with wrapping and no acquisition', () => {
    const source = readFileSync(join(__dirname, 'AskCompactResult.tsx'), 'utf8');
    expect(source).toContain('data-ask="coverage-checked"');
    expect(source).toContain(
      'comparisonCoverageLines(response.retrievalContext.comparisonCoverage, language).map',
    );
    expect(source).toContain('min-w-0');
    expect(source).not.toMatch(/\bfetch\s*\(|\banalyzeNews\s*\(/u);
  });
});

describe('rendered compact coverage in EN/PL', () => {
  it.each(['en', 'pl'] as const)(
    'keeps every country visible without synthesis (%s)',
    (language) => {
      const response = fixture({ analysisNull: true, articleCount: 0 });
      response.retrievalContext.comparisonCoverage = [
        ['Israel', 'IL', 'ISR'],
        ['Iran', 'IR', 'IRN'],
        ['Saudi Arabia', 'SA', 'SAU'],
      ].map(([countryName, iso2, iso3]) => ({
        countryName,
        iso2,
        iso3,
        requested: true,
        liveRetrievalAttempted: true,
        usableLiveEvidenceCount: 0,
        usableRetainedEvidenceCount: 0,
        finalQualifyingEvidenceCount: 0,
        finalLiveEvidenceCount: 0,
        finalRetainedEvidenceCount: 0,
        providers: [],
        providerFailureKinds: [],
        retrievalState: 'NO_MATCHING_EVIDENCE' as const,
        localSourceProvenance: 'NOT_ESTABLISHED' as const,
        coverageGap: true,
        coverageGapReason: 'NO_QUALIFYING_EVIDENCE' as const,
        liveArticleIds: [],
        retainedArticleIds: [],
      }));
      const html = renderToStaticMarkup(
        createElement(AskCompactResult, {
          response,
          question: 'Compare Israel, Iran and Saudi Arabia',
          language,
          context: undefined,
        }),
      );
      expect(html).toContain('data-ask="coverage-checked"');
      expect(html).toContain(language === 'pl' ? 'Izrael' : 'Israel');
      expect(html).toContain('Iran');
      expect(html).toContain(language === 'pl' ? 'Arabia Saudyjska' : 'Saudi Arabia');
      expect(html).toContain(language === 'pl' ? 'luka w pokryciu' : 'coverage gap');
      expect(html).not.toContain('undefined');
    },
  );
});
