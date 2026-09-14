/**
 * ============================================================================
 * C911-R3 -- EXECUTIVE BRIEF FACTUAL FIDELITY
 * ============================================================================
 *
 * C910 solved the STRUCTURAL problem: a multi-development evidence set can no
 * longer be answered with one blended paragraph. That correction is NOT
 * reopened here, and this file changes no production module.
 *
 * What this file measures is the question C910 did not ask: does the structural
 * guarantee create PRESSURE TO INVENT? A schema that requires a second field
 * could, in principle, teach the model to manufacture a second development when
 * the evidence carries only one.
 *
 * The verdict below is NO for the cases the contract names, WITH ONE MEASURED
 * AND DISCLOSED EXCEPTION stated in the final block rather than hidden. That
 * follows this repository's existing convention -- see
 * country-development-eligibility.spec.ts, which asserts the two corpus items
 * its own model gets wrong.
 */
import {
  assessBriefCompliance,
  countSynthesisParagraphs,
  detectDevelopmentBreadth,
} from './brief-compliance.util';
import { normalizeBriefFields } from '../providers/normalize-brief-fields.util';
import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';
import type { NewsArticle } from '@globalnews-ai/shared';

const article = (over: Partial<NewsArticle>): NewsArticle => ({
  id: 'a1',
  title: 'Title',
  summary: 'Summary',
  url: 'https://example.com/a1',
  sourceId: 's1',
  sourceName: 'Source One',
  category: 'world',
  sourcesCount: 1,
  publishedAt: new Date().toISOString(),
  ...over,
});

/** Two clusters across two domains -- the multi-development condition. */
const BROAD_EVIDENCE: NewsArticle[] = [
  article({
    id: 'a1',
    title: 'Parliament passes electricity reform bill',
    summary: 'The electricity reform bill restructures the national utility.',
    category: 'politics',
    url: 'https://example.com/a1',
  }),
  article({
    id: 'a2',
    title: 'Central bank holds rates as inflation eases',
    summary: 'The central bank held its policy rate for a third meeting.',
    category: 'business',
    url: 'https://example.com/a2',
  }),
];

/** One story, one domain -- narrow evidence. */
const NARROW_EVIDENCE: NewsArticle[] = [
  article({
    id: 'b1',
    title: 'Parliament passes electricity reform bill',
    summary: 'The electricity reform bill restructures the national utility.',
    category: 'politics',
    url: 'https://example.com/b1',
  }),
];

describe('C911-R3 -- the structural guarantee does not force invention', () => {
  describe('NARROW EVIDENCE IS NEVER PUSHED INTO TWO DEVELOPMENTS', () => {
    it('narrow evidence is not multi-development, so no second field is required', () => {
      expect(detectDevelopmentBreadth(NARROW_EVIDENCE).multiDevelopment).toBe(false);
    });

    it('a narrow one-paragraph brief remains COMPLIANT', () => {
      const verdict = assessBriefCompliance(
        'Parliament passed the electricity reform bill.',
        detectDevelopmentBreadth(NARROW_EVIDENCE),
      );

      expect(verdict.compliant).toBe(true);
    });

    it('the multi-development prose section is absent for narrow evidence', () => {
      const messages = buildAnalysisMessages(
        'What are the latest developments?',
        NARROW_EVIDENCE,
        1200,
        undefined,
        'en',
        undefined,
        undefined,
      );

      expect(messages.system).not.toContain('primaryDevelopment');
    });
  });

  describe('FAIL-CLOSED REMAINS AUTHORITATIVE WHEN THE SECOND FIELD IS EMPTY', () => {
    it('an empty second field collapses to one paragraph and is WITHHELD', () => {
      const normalized = normalizeBriefFields({
        primaryDevelopment: 'Parliament passed the electricity reform bill.',
        additionalDevelopments: '   ',
      }) as { summary: string };

      expect(countSynthesisParagraphs(normalized.summary)).toBe(1);

      const verdict = assessBriefCompliance(
        normalized.summary,
        detectDevelopmentBreadth(BROAD_EVIDENCE),
      );

      // The existing validator decides, and it withholds. The schema did not
      // rescue a degenerate answer.
      expect(verdict.compliant).toBe(false);
    });

    it('both fields empty is still withheld, never accepted as structure', () => {
      const normalized = normalizeBriefFields({
        primaryDevelopment: '  ',
        additionalDevelopments: '  ',
      }) as { summary: string };

      expect(
        assessBriefCompliance(normalized.summary, detectDevelopmentBreadth(BROAD_EVIDENCE))
          .compliant,
      ).toBe(false);
    });
  });

  describe('THE ANTI-PADDING CONTRACT IS PRESENT AND MUST STAY PRESENT', () => {
    const system = buildAnalysisMessages(
      'What are the latest developments?',
      BROAD_EVIDENCE,
      1200,
      undefined,
      'en',
      undefined,
      detectDevelopmentBreadth(BROAD_EVIDENCE),
    ).system;

    it('states that cluster count is NOT a development count', () => {
      expect(system).toContain('DO NOT PAD');
      expect(system).toContain('do not mean');
    });

    it('forbids restating one development in both fields', () => {
      expect(system).toContain('DIFFERENT material developments');
      expect(system).toContain('do not restate one in both');
    });

    it('forbids splitting one development across both fields', () => {
      expect(system).toContain('do not split one across them');
    });

    it('permits an honest short second field rather than an invented one', () => {
      expect(system).toContain('An honest short second field is correct; an invented one is not.');
    });

    it('states the withheld consequence, with no repair and no second attempt', () => {
      expect(system).toContain('WITHHELD');
      expect(system).toContain('no repair request');
      expect(system).toContain('second attempt');
    });
  });

  describe('NO SYNCHRONOUS REPAIR AND NO EXTRA RETRIEVAL ARE INTRODUCED HERE', () => {
    it('this checkpoint adds no repair directive to any prompt', () => {
      const withoutRepair = buildAnalysisMessages(
        'What are the latest developments?',
        BROAD_EVIDENCE,
        1200,
        undefined,
        'en',
        undefined,
        detectDevelopmentBreadth(BROAD_EVIDENCE),
      );

      const withRepair = buildAnalysisMessages(
        'What are the latest developments?',
        BROAD_EVIDENCE,
        1200,
        undefined,
        'en',
        'REPAIR',
        detectDevelopmentBreadth(BROAD_EVIDENCE),
      );

      // The repair channel still exists and is still only used when a caller
      // explicitly supplies a directive. C911 supplies none.
      expect(withoutRepair.system).not.toContain('REPAIR');
      expect(withRepair.system).toContain('REPAIR');
    });
  });

  /**
   * ── THE DISCLOSED RESIDUAL ────────────────────────────────────────────
   *
   * MEASURED, NOT ASSUMED. `assessBriefCompliance` counts paragraphs and
   * nothing else -- deliberately, because its own documentation records that a
   * length check or a keyword check "would be gameable by padding". The
   * consequence is that a SECOND PARAGRAPH THAT MERELY PARAPHRASES THE FIRST
   * satisfies the structural guarantee.
   *
   * This is asserted here rather than left for a reader to discover. Closing it
   * would mean adding a CONTENT-based withholding trigger to the Executive
   * Brief, and `ExecutiveBriefState.reason` is documented as describing "the
   * SHAPE of the answer and never its content". That is a product-contract
   * change and therefore a Product Owner / CTO decision, not an engineering
   * one -- it is reported in MASTER-REPORT.md as a HOLD item.
   *
   * The prompt-level defences asserted above are what stand against it today,
   * and this test exists so that if the behaviour ever changes, it changes
   * visibly.
   */
  describe('DISCLOSED RESIDUAL -- a paraphrased second paragraph still passes', () => {
    it('two near-identical paragraphs satisfy the structural check', () => {
      const paraphrased = normalizeBriefFields({
        primaryDevelopment: 'Parliament passed the electricity reform bill.',
        additionalDevelopments: 'The electricity reform bill was passed by parliament.',
      }) as { summary: string };

      const verdict = assessBriefCompliance(
        paraphrased.summary,
        detectDevelopmentBreadth(BROAD_EVIDENCE),
      );

      // ASSERTED AS THE CURRENT, KNOWN BEHAVIOUR -- not endorsed as correct.
      expect(verdict.compliant).toBe(true);
      expect(verdict.paragraphs).toBe(2);
    });
  });
});
