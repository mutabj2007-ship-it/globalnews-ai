import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANALYSIS_CLIENT_TIMEOUT_MS,
  ANALYSIS_TOTAL_BUDGET_MS,
  type NewsArticle,
  type NewsCategory,
} from '@globalnews-ai/shared';

import {
  MIN_CATEGORIES_FOR_STRUCTURE,
  MIN_CLUSTERS_FOR_STRUCTURE,
  assessBriefCompliance,
  detectDevelopmentBreadth,
} from './brief-compliance.util';
import {
  buildAnalysisMessages,
  buildDevelopmentBreadthSection,
} from '../prompt/build-analysis-prompt.util';
import type { AnalysisDevelopmentBreadth } from '../interfaces/analysis-provider.interface';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EXECUTIVE-BRIEF-STRUCTURAL-COMPLIANCE-RECOVERY-1 · R2
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE GOVERNING RULE UNDER TEST: the model and the validator must receive the
 * SAME already-computed breadth fact.
 *
 * Two Production runs are reproduced as fixtures, both question "Iran", both
 * `withheld-non-compliant` on the accepted base:
 *
 *     6 clusters / 4 domains   the contract's reported run
 *     8 clusters / 2 domains   the 2026-09-14 screenshot — clears
 *                              MIN_CATEGORIES_FOR_STRUCTURE by exactly one
 *
 * SOURCE ASSERTIONS STRIP COMMENTS FIRST. A gate that matches prose inside a
 * doc comment proves nothing about the code; every structural assertion below
 * runs against comment-stripped source.
 */

const article = (id: string, category: NewsCategory, title: string): NewsArticle => ({
  id,
  title,
  summary: `${title}. Reporting detail for ${id}.`,
  url: `https://example.test/${id}`,
  sourceId: `source-${id}`,
  sourceName: `Source ${id}`,
  category,
  sourcesCount: 1,
  publishedAt: '2026-09-10T08:00:00.000Z',
});

const NARROW: AnalysisDevelopmentBreadth = {
  clusters: 1,
  categories: 1,
  multiDevelopment: false,
};
const SIX_FOUR: AnalysisDevelopmentBreadth = {
  clusters: 6,
  categories: 4,
  multiDevelopment: true,
};
const EIGHT_TWO: AnalysisDevelopmentBreadth = {
  clusters: 8,
  categories: 2,
  multiDevelopment: true,
};

const BACKEND_SRC = join(__dirname, '..', '..', '..');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const code = (relative: string): string =>
  stripComments(readFileSync(join(BACKEND_SRC, relative), 'utf8'));

const SERVICE = 'modules/analysis/service/analysis.service.ts';
const PROMPT = 'modules/analysis/prompt/build-analysis-prompt.util.ts';
const VALIDATOR = 'modules/analysis/validation/brief-compliance.util.ts';

describe('R1 — narrow/single-development evidence still permits one concise paragraph', () => {
  it('a one-paragraph brief is compliant for a narrow set', () => {
    const verdict = assessBriefCompliance('One concise paragraph.', NARROW);
    expect(verdict.compliant).toBe(true);
    expect(verdict.reason).toBeUndefined();
  });

  it('the narrow section permits one paragraph and forbids padding', () => {
    const section = buildDevelopmentBreadthSection(NARROW);
    expect(section).toContain('NARROW EVIDENCE SET');
    expect(section).toMatch(/One well-written paragraph is a correct/);
    expect(section).toMatch(/Do NOT pad/);
    expect(section).not.toContain('WITHHELD');
  });

  it('absent breadth emits nothing — the prompt stays byte-identical', () => {
    expect(buildDevelopmentBreadthSection(undefined)).toBe('');
    const withoutBreadth = buildAnalysisMessages('Iran', [], 500, undefined, 'en', undefined);
    const legacy = buildAnalysisMessages('Iran', [], 500, undefined, 'en');
    expect(withoutBreadth.system).toBe(legacy.system);
  });
});

describe('R2 — 8 clusters / 2 domains receives explicit structure BEFORE generation', () => {
  it('the section states the measured counts', () => {
    expect(buildDevelopmentBreadthSection(EIGHT_TWO)).toContain(
      '8 distinct reporting clusters across 2 editorial domains',
    );
  });

  it('the section states the real consequence and the blank-line rule', () => {
    const section = buildDevelopmentBreadthSection(EIGHT_TWO);
    expect(section).toContain('WITHHELD');
    expect(section).toMatch(/no second attempt/);
    expect(section).toContain('BLANK LINE');
    expect(section).toMatch(/do not pad/);
  });

  it('it reaches the SYSTEM PROMPT the provider is actually given', () => {
    const { system } = buildAnalysisMessages(
      'Iran',
      [article('a', 'politics', 'Alpha'), article('b', 'business', 'Beta')],
      500,
      undefined,
      'en',
      undefined,
      EIGHT_TWO,
    );
    expect(system).toContain('8 distinct reporting clusters across 2 editorial domains');
  });
});

describe('R3 — 6 clusters / 4 domains receives the same correct structural requirement', () => {
  it('the section states its own measured counts', () => {
    expect(buildDevelopmentBreadthSection(SIX_FOUR)).toContain(
      '6 distinct reporting clusters across 4 editorial domains',
    );
  });

  it('both broad fixtures carry the identical requirement, differing only in the counts', () => {
    const normalise = (s: string): string => s.replace(/\d+/g, 'N');
    expect(normalise(buildDevelopmentBreadthSection(SIX_FOUR))).toBe(
      normalise(buildDevelopmentBreadthSection(EIGHT_TWO)),
    );
  });
});

describe('R4 — compliant output accepted', () => {
  it.each([
    ['6 clusters / 4 domains', SIX_FOUR],
    ['8 clusters / 2 domains', EIGHT_TWO],
  ])('%s: two blank-line separated paragraphs comply', (_label, breadth) => {
    const verdict = assessBriefCompliance('First development.\n\nSecond development.', breadth);
    expect(verdict.compliant).toBe(true);
    expect(verdict.paragraphs).toBe(2);
  });
});

describe('R5 — non-compliant output still withheld (validation NOT weakened)', () => {
  it.each([
    ['a single blended paragraph', 'Iran has been involved in several developments at once.'],
    ['single newlines only', 'First.\nSecond.\nThird.'],
    ['whitespace-padded single block', '   \n  One paragraph.  \n   '],
    ['an empty summary', ''],
  ])('%s is refused', (_label, summary) => {
    expect(assessBriefCompliance(summary, EIGHT_TWO).compliant).toBe(false);
  });

  it('the withheld reason is unchanged, and names both measured counts', () => {
    expect(assessBriefCompliance('one para', EIGHT_TWO).reason).toBe(
      'The retrieved evidence carries 8 distinct reporting clusters across 2 domains, ' +
        'and the summary is a single paragraph.',
    );
  });

  it('the prompt count and the verdict count come from ONE value and cannot disagree', () => {
    const section = buildDevelopmentBreadthSection(EIGHT_TWO);
    const verdict = assessBriefCompliance('one para', EIGHT_TWO);
    expect(section).toContain(String(EIGHT_TWO.clusters));
    expect(verdict.reason).toContain(String(EIGHT_TWO.clusters));
    expect(verdict.breadth).toBe(EIGHT_TWO);
  });
});

describe('R6 — exactly one provider generation, and no repair generation', () => {
  it('the service makes exactly one analyzeNews call', () => {
    const occurrences = code(SERVICE).match(/this\.provider\.analyzeNews\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it('the service never supplies a repairDirective', () => {
    expect(code(SERVICE)).not.toContain('repairDirective');
  });

  it('repairRequested remains pinned false', () => {
    expect(code(SERVICE)).toContain('const repairRequested = false;');
  });

  it('the service passes the SAME breadth variable it computed, not a new measurement', () => {
    const source = code(SERVICE);
    expect(source.match(/detectDevelopmentBreadth\(/g) ?? []).toHaveLength(1);
    expect(source).toContain('const developmentBreadth = detectDevelopmentBreadth(deduped);');
    expect(source).toContain('developmentBreadth,');
    expect(source).toContain('assessBriefCompliance(analysis.summary, developmentBreadth)');
  });
});

describe('R7 — budgets unchanged', () => {
  it('the derived server and client budgets are untouched', () => {
    expect(ANALYSIS_TOTAL_BUDGET_MS).toBe(32_000);
    expect(ANALYSIS_CLIENT_TIMEOUT_MS).toBe(40_000);
  });

  it('the appended section is small and bounded', () => {
    expect(buildDevelopmentBreadthSection(EIGHT_TWO).length).toBeLessThan(1_200);
    expect(buildDevelopmentBreadthSection(NARROW).length).toBeLessThan(1_200);
  });
});

describe('R8 — existing analysis validation remains unchanged', () => {
  it('the structural thresholds are unmoved', () => {
    expect(MIN_CLUSTERS_FOR_STRUCTURE).toBe(2);
    expect(MIN_CATEGORIES_FOR_STRUCTURE).toBe(2);
  });

  it('paragraph counting still splits on blank lines only — one definition, both ends', () => {
    const { countSynthesisParagraphs } = jest.requireActual<
      typeof import('./brief-compliance.util')
    >('./brief-compliance.util');
    expect(countSynthesisParagraphs('a\nb')).toBe(1);
    expect(countSynthesisParagraphs('a\n\nb')).toBe(2);
    expect(countSynthesisParagraphs('')).toBe(0);
  });

  it('the validator module itself declares no new behaviour', () => {
    const source = code(VALIDATOR);
    expect(source).toContain('export const MIN_CLUSTERS_FOR_STRUCTURE = 2;');
    expect(source).toContain('export const MIN_CATEGORIES_FOR_STRUCTURE = 2;');
    expect(source).not.toContain('developmentBreadth?');
  });

  it('breadth derives from the supplied articles alone — no retrieval surface', () => {
    const breadth = detectDevelopmentBreadth([
      article('a', 'politics', 'Sanctions talks resume in Vienna'),
      article('b', 'business', 'Shipping insurers raise Gulf premiums'),
    ]);
    expect(breadth.clusters).toBe(2);
    expect(breadth.categories).toBe(2);
    expect(breadth.multiDevelopment).toBe(true);
  });
});

describe('R9 — the false repair promise is gone from the base prompt', () => {
  it('the prompt no longer tells the model it will be asked to re-organise', () => {
    const source = code(PROMPT);
    expect(source).not.toMatch(/you will be asked once to/);
    expect(source).toContain('THERE IS NO SECOND ATTEMPT');
  });
});
