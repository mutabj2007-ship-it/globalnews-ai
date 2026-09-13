import type { NewsArticle, NewsCategory } from '@globalnews-ai/shared';

import {
  MIN_CATEGORIES_FOR_STRUCTURE,
  MIN_CLUSTERS_FOR_STRUCTURE,
  assessBriefCompliance,
  buildBriefRepairDirective,
  countSynthesisParagraphs,
  detectDevelopmentBreadth,
} from './brief-compliance.util';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EXECUTIVE BRIEF COMPLIANCE — PO RULING D, C906
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ACCEPTANCE EVIDENCE, reproduced as a fixture: the Alpha "Rwanda" analysis —
 * 8 retrieved reports, 8 reporting clusters, four editorial domains — answered
 * with ONE blended paragraph naming five unrelated developments.
 *
 * The ruling forbids reporting a wording-only prompt change as the fix, so the
 * requirement is asserted here as behaviour: on this exact evidence shape, a
 * one-paragraph brief is NON-COMPLIANT and the product knows it without asking
 * anyone's opinion.
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

/**
 * The Alpha Rwanda set, by domain and headline.
 *
 * Titles are deliberately unalike: `clusterDuplicateArticles` collapses
 * near-duplicates, and eight rewrites of one wire story would be one cluster.
 * These eight are eight stories, which is what the screenshot reported.
 */
const RWANDA_ALPHA_SET: NewsArticle[] = [
  article('a1', 'science', 'Rwanda planted exotic tree species in a 1933 experimental forest'),
  article('a2', 'business', 'Assessing the Rwanda-Russia economic partnership'),
  article('a3', 'world', "Can Rwanda's helmet strategy end a deadly road safety emergency?"),
  article('a4', 'sports', 'Manchester United v Sabah: a Rwandan debutant eyes history'),
  article('a5', 'politics', 'Rwandan imprisoned for hate speech fails in bid for intervention'),
  article('a6', 'business', 'Partnership opens new doors for Rwandan smallholder farmers'),
  article('a7', 'health', "Ebola reaches Congo's Sud-Ubangi province after travel through Rwanda"),
  article('a8', 'politics', 'Pakistan attaches importance to strengthening economic ties'),
];

/** Exactly what Alpha returned. */
const ALPHA_BLENDED_SUMMARY =
  'Rwanda has been involved in various significant developments, including environmental ' +
  'concerns related to eucalyptus plantations, economic partnerships with Russia and Pakistan, ' +
  'and initiatives aimed at improving road safety. Additionally, there are ongoing issues ' +
  'related to hate speech convictions and the spread of Ebola in the region.';

const COMPLIANT_SUMMARY = [
  'An experimental forest planted in 1933 is the subject of new findings: scientists report ' +
    'that the eucalyptus planted there acidified the soil. The reporting does not establish why ' +
    'those species were chosen.',
  'Separately, two economic partnerships are reported — one with Russia and one with Pakistan — ' +
    'alongside a financing package for smallholder farmers.',
  'A public-health development is reported from the region: Ebola has reached a neighbouring ' +
    'province following travel through Rwanda and Uganda.',
].join('\n\n');

describe('1 · THE ALPHA RWANDA SET IS A MULTI-DEVELOPMENT EVIDENCE SET', () => {
  it('detects the breadth the screenshot reported', () => {
    const breadth = detectDevelopmentBreadth(RWANDA_ALPHA_SET);

    expect(breadth.clusters).toBe(8);
    expect(breadth.categories).toBeGreaterThanOrEqual(4);
    expect(breadth.multiDevelopment).toBe(true);
  });

  it('THE ALPHA BRIEF IS NON-COMPLIANT — this is the whole ruling, as a test', () => {
    const verdict = assessBriefCompliance(
      ALPHA_BLENDED_SUMMARY,
      detectDevelopmentBreadth(RWANDA_ALPHA_SET),
    );

    expect(verdict.compliant).toBe(false);
    expect(verdict.paragraphs).toBe(1);
    expect(verdict.reason).toContain('single paragraph');
  });

  it('a paragraph-organised answer over the same evidence is compliant', () => {
    const verdict = assessBriefCompliance(
      COMPLIANT_SUMMARY,
      detectDevelopmentBreadth(RWANDA_ALPHA_SET),
    );

    expect(verdict.compliant).toBe(true);
    expect(verdict.paragraphs).toBe(3);
  });
});

describe('2 · NARROW QUESTIONS KEEP THE RIGHT TO ONE PARAGRAPH', () => {
  it('a single story reported by several outlets is not multi-development', () => {
    /*
     * The ruling protects this case by name. Eight rewrites of one wire story
     * collapse to one cluster, so the structural requirement never fires and a
     * single well-made paragraph stays the right answer.
     */
    const oneStory = Array.from({ length: 8 }, (_, index) =>
      article(`w${index}`, 'politics', 'Minister announces the budget for the coming year'),
    );

    const breadth = detectDevelopmentBreadth(oneStory);

    expect(breadth.clusters).toBeLessThan(MIN_CLUSTERS_FOR_STRUCTURE + 1);
    expect(breadth.multiDevelopment).toBe(false);
    expect(assessBriefCompliance('One paragraph is fine here.', breadth).compliant).toBe(true);
  });

  it('several stories inside ONE domain do not force structure on their own', () => {
    /*
     * Both signals are required. Two political stories are not the same thing
     * as an evidence set spanning health, business and sport, and demanding
     * paragraphs from the first would be the padding the ruling forbids.
     */
    const onePolicyArea = [
      article('p1', 'politics', 'Parliament debates the electoral timetable'),
      article('p2', 'politics', 'Opposition parties respond to the proposed schedule'),
      article('p3', 'politics', 'Commission publishes its own timetable guidance'),
    ];

    const breadth = detectDevelopmentBreadth(onePolicyArea);

    expect(breadth.clusters).toBeGreaterThanOrEqual(MIN_CLUSTERS_FOR_STRUCTURE);
    expect(breadth.categories).toBeLessThan(MIN_CATEGORIES_FOR_STRUCTURE);
    expect(breadth.multiDevelopment).toBe(false);
  });

  it('an empty or single-article set is never multi-development', () => {
    expect(detectDevelopmentBreadth([]).multiDevelopment).toBe(false);
    expect(detectDevelopmentBreadth([RWANDA_ALPHA_SET[0]]).multiDevelopment).toBe(false);
  });
});

describe('3 · paragraphs are counted exactly as the frontend splits them', () => {
  it('splits on a blank line and on nothing else', () => {
    expect(countSynthesisParagraphs('one')).toBe(1);
    expect(countSynthesisParagraphs('one\ntwo')).toBe(1);
    expect(countSynthesisParagraphs('one\n\ntwo')).toBe(2);
    expect(countSynthesisParagraphs('one\n   \ntwo\n\nthree')).toBe(3);
  });

  it('ignores leading, trailing and repeated blank lines', () => {
    expect(countSynthesisParagraphs('\n\none\n\n\n\ntwo\n\n')).toBe(2);
  });

  it('an empty summary is zero paragraphs, and therefore non-compliant when broad', () => {
    const breadth = detectDevelopmentBreadth(RWANDA_ALPHA_SET);

    expect(countSynthesisParagraphs('')).toBe(0);
    expect(assessBriefCompliance('', breadth).compliant).toBe(false);
  });
});

describe('4 · the repair directive asks for a re-organisation and nothing more', () => {
  const directive = buildBriefRepairDirective(
    assessBriefCompliance(ALPHA_BLENDED_SUMMARY, detectDevelopmentBreadth(RWANDA_ALPHA_SET)),
  );

  it('states the defect using the measured breadth', () => {
    expect(directive).toContain('8 distinct reporting clusters');
    expect(directive).toContain('RE-ORGANISATION, NOT A NEW ANALYSIS');
  });

  it('forbids new evidence, new facts and invented causes', () => {
    expect(directive).toContain('SAME evidenceId values');
    /* Matched across the directive's own line wrapping rather than as one line. */
    expect(directive).toMatch(/Do not\s+introduce a source, a fact, a figure or a development/);
    expect(directive).toContain('Do not invent a reason, a cause or a motive');
  });

  it('forbids padding and imposes no paragraph quota', () => {
    expect(directive).toContain('Do not pad');
    expect(directive).toContain('there is no target count');
    expect(directive).not.toMatch(/exactly \d+ paragraphs/);
  });
});
