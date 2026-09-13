import { readFileSync } from 'fs';
import { join } from 'path';
import type { NewsAnalysisResult, NewsArticle, NewsCategory } from '@globalnews-ai/shared';

import { assessBriefCompliance, detectDevelopmentBreadth } from './brief-compliance.util';
import {
  acceptExecutiveBrief,
  isExecutiveBriefPresentable,
  withholdExecutiveBrief,
} from './brief-fail-closed.util';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EXECUTIVE BRIEF FAIL-CLOSED — C907 CORRECTION 3
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE INVARIANT, in the ruling's own words:
 *
 *     "KNOWN NON-COMPLIANT EXECUTIVE BRIEF != ACCEPTED EXECUTIVE BRIEF."
 *
 * C906 detected the defect and then published the defective brief anyway when
 * its one repair also failed. These tests pin the three things the ruling
 * requires instead: the rejected prose does not leave the backend, the rest of
 * the validated record does, and no additional AI call is invented to make
 * either of those true.
 *
 * The fixture is the SAME Alpha Rwanda evidence set brief-compliance.spec.ts
 * uses — 8 clusters across four domains, answered with one blended paragraph —
 * so the two files are measuring the same real failure from two ends.
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

const ALPHA_BLENDED_SUMMARY =
  'Rwanda has been involved in various significant developments, including environmental ' +
  'concerns related to eucalyptus plantations, economic partnerships with Russia and Pakistan, ' +
  'and initiatives aimed at improving road safety. Additionally, there are ongoing issues ' +
  'related to hate speech convictions and the spread of Ebola in the region.';

/**
 * A validated-shaped record carrying the Alpha summary. Every field below the
 * summary stands for "the rest of the valid analysis record" the ruling
 * requires to survive, so the assertions can check that it does.
 */
function analysisWith(summary: string): NewsAnalysisResult {
  return {
    query: 'Rwanda',
    headline: 'Rwanda: eight developments across four domains',
    summary,
    keyFacts: [
      { claim: 'Ebola reached Sud-Ubangi province.', sourceArticleIds: ['a7'] },
      { claim: 'A financing package was announced for smallholder farmers.', sourceArticleIds: ['a6'] },
    ],
    agreements: [],
    differences: [],
    unknowns: ['The reporting does not establish why the 1933 species were chosen.'],
    timeline: [],
    confidence: { level: 'medium', rationale: 'Model self-report.' },
    entities: {
      countries: ['Rwanda'],
      locations: ['Sud-Ubangi'],
      people: [],
      organizations: [],
      topics: ['public health'],
    },
    sources: [{ articleId: 'a7', sourceName: 'Source a7', url: 'https://example.test/a7' }],
    generatedAt: '2026-09-10T09:00:00.000Z',
    analysisMode: 'live-ai',
    trustState: {
      level: 'moderate',
      distinctSourceArticleCount: 2,
      groundedClaimCount: 2,
      rationale: 'Two distinct cited articles.',
    },
    uncertainties: [],
    context: [],
    relevance: [],
    immediateImpacts: [],
    spilloverImplications: [],
    significance: null,
    watchNext: [],
  } as unknown as NewsAnalysisResult;
}

const BREADTH = detectDevelopmentBreadth(RWANDA_ALPHA_SET);
const FAILING_VERDICT = assessBriefCompliance(ALPHA_BLENDED_SUMMARY, BREADTH);

describe('1 · THE INVARIANT — a known non-compliant brief is never presented', () => {
  it('the fixture really is the failing case, so the rest of this file means something', () => {
    expect(BREADTH.multiDevelopment).toBe(true);
    expect(FAILING_VERDICT.compliant).toBe(false);
    expect(FAILING_VERDICT.paragraphs).toBe(1);
  });

  it('WITHHOLDING EMPTIES THE SUMMARY — the rejected prose does not leave the backend', () => {
    /*
      This is the whole correction. C906 returned `analysis` unchanged here,
      so the paragraph above travelled to five rendering surfaces with nothing
      but a log line to say it had failed.
    */
    const withheld = withholdExecutiveBrief(analysisWith(ALPHA_BLENDED_SUMMARY), FAILING_VERDICT, true);

    expect(withheld.summary).toBe('');
    expect(JSON.stringify(withheld)).not.toContain('various significant developments');
  });

  it('declares the state in a machine-readable field, not only in prose', () => {
    const withheld = withholdExecutiveBrief(analysisWith(ALPHA_BLENDED_SUMMARY), FAILING_VERDICT, true);

    expect(withheld.briefState).toBeDefined();
    expect(withheld.briefState!.availability).toBe('withheld-non-compliant');
    expect(withheld.briefState!.repairRequested).toBe(true);
    expect(withheld.briefState!.clusters).toBe(8);
    expect(withheld.briefState!.categories).toBeGreaterThanOrEqual(4);
    expect(withheld.briefState!.reason).toContain('single paragraph');
  });

  it('one predicate answers "may this be presented", for both ends of the wire', () => {
    expect(isExecutiveBriefPresentable(withholdExecutiveBrief(analysisWith(ALPHA_BLENDED_SUMMARY), FAILING_VERDICT, true))).toBe(false);
    expect(isExecutiveBriefPresentable(analysisWith(ALPHA_BLENDED_SUMMARY))).toBe(true);
  });

  it('a record from before this field existed reads as presentable, never as withheld', () => {
    /* Backward compatibility is fail-OPEN only for records nobody assessed. */
    const legacy = analysisWith('A perfectly ordinary brief.');

    expect(legacy.briefState).toBeUndefined();
    expect(isExecutiveBriefPresentable(legacy)).toBe(true);
  });
});

describe('2 · THE REST OF THE VALID ANALYSIS RECORD IS RETAINED', () => {
  const original = analysisWith(ALPHA_BLENDED_SUMMARY);
  const withheld = withholdExecutiveBrief(original, FAILING_VERDICT, true);

  it('every field except summary and briefState is carried through untouched', () => {
    /*
      Asserted by comparing the whole record rather than a chosen handful, so a
      future field cannot be dropped here without this failing.
    */
    const strip = (record: NewsAnalysisResult): Record<string, unknown> => {
      const copy = { ...record } as Record<string, unknown>;
      delete copy.summary;
      delete copy.briefState;
      return copy;
    };

    expect(strip(withheld)).toEqual(strip(original));
  });

  it('the cited evidence in particular survives — a prose defect costs no claims', () => {
    expect(withheld.keyFacts).toHaveLength(2);
    expect(withheld.sources).toHaveLength(1);
    expect(withheld.trustState.distinctSourceArticleCount).toBe(2);
    expect(withheld.unknowns).toHaveLength(1);
  });

  it('the input record is not mutated — withholding returns a new object', () => {
    expect(original.summary).toBe(ALPHA_BLENDED_SUMMARY);
    expect(original.briefState).toBeUndefined();
  });
});

describe('3 · THE ACCEPTED PATH IS STAMPED TOO', () => {
  const COMPLIANT = ['First development.', 'Second development.'].join('\n\n');

  it('an accepted brief keeps its summary and says it was accepted', () => {
    const verdict = assessBriefCompliance(COMPLIANT, BREADTH);
    const accepted = acceptExecutiveBrief(analysisWith(COMPLIANT), verdict, false);

    expect(verdict.compliant).toBe(true);
    expect(accepted.summary).toBe(COMPLIANT);
    expect(accepted.briefState!.availability).toBe('accepted');
    expect(accepted.briefState!.repairRequested).toBe(false);
    expect(accepted.briefState!.reason).toBeUndefined();
  });

  it('records repairRequested=true when a caller reports that a repair produced the compliant answer', () => {
    /*
      A UTILITY CONTRACT, NOT A CLAIM ABOUT THE CURRENT PATH. `repairRequested`
      records what actually happened, as reported by the caller. The current
      synchronous path never requests a repair and therefore always passes
      `false`; a future GOVERNED ASYNCHRONOUS repair may legitimately pass
      `true`, and this test keeps that branch of the utility honest and covered
      for the day it does. It asserts the utility's behaviour, never the
      service's.
    */
    const verdict = assessBriefCompliance(COMPLIANT, BREADTH);
    const accepted = acceptExecutiveBrief(analysisWith(COMPLIANT), verdict, true);

    expect(accepted.briefState!.availability).toBe('accepted');
    expect(accepted.briefState!.repairRequested).toBe(true);
  });

  it('a narrow evidence set is accepted with one paragraph, exactly as before', () => {
    /* The C906 protection for single-story questions is untouched by C907. */
    const narrow = detectDevelopmentBreadth([RWANDA_ALPHA_SET[0]]);
    const verdict = assessBriefCompliance('One paragraph is the right answer here.', narrow);
    const accepted = acceptExecutiveBrief(analysisWith('One paragraph is the right answer here.'), verdict, false);

    expect(narrow.multiDevelopment).toBe(false);
    expect(accepted.summary).not.toBe('');
    expect(accepted.briefState!.availability).toBe('accepted');
  });
});

describe('4 · NO EXTRA AI CALL WAS INVENTED', () => {
  const serviceSource = readFileSync(
    join(__dirname, '..', 'service', 'analysis.service.ts'),
    'utf-8',
  );
  const utilSource = readFileSync(join(__dirname, 'brief-fail-closed.util.ts'), 'utf-8');

  it('the fail-closed module calls no provider and performs no I/O of any kind', () => {
    /*
      *"Do not invent another AI call."* — the module cannot make one.

      Run against comment-stripped source, this repository's own convention for
      negative guards: the doc comment above the functions discusses providers
      at length precisely in order to say it never touches one, and a guard
      that could not tell prose from code would forbid explaining itself.
    */
    const utilCode = utilSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(utilCode).not.toMatch(/analyzeNews|provider|fetch\(|http/i);
    expect(utilCode).not.toMatch(/\bawait\b|\basync\b/);
  });

  it('the service makes EXACTLY ONE synchronous provider generation on the success path', () => {
    /*
      ─────────────────────────────────────────────────────────────────────────
      RETARGETED, NOT RELAXED — ALPHA BUDGET R1 REV B CONVERGENCE
      ─────────────────────────────────────────────────────────────────────────

      This assertion used to read `.toBe(2)`: the analysis plus the one
      permitted synchronous repair. That ceiling is obsolete. The synchronous
      repair was REMOVED under the accepted Alpha latency correction — it added
      a second full `provider.analyzeNews()` over the same entire article set
      (6,689 tokens against the original's 6,367 on the observed Railway run)
      to the critical path, for an answer that was withheld anyway whenever it
      failed. A brief that fails structural compliance is now withheld
      immediately, with its reason, and the validated analysis is returned at
      once.

      THE INVARIANT IS TIGHTER, NOT WEAKER. The old bound permitted two calls;
      this one permits one. Nothing that was forbidden before is allowed now,
      and the same `not.toMatch` guard against a retry loop is retained
      unchanged beneath. The authority for the new number is
      `briefSingleGeneration.spec.ts`, which asserts the same fact from the
      service's own side; this file asserts it from the fail-closed side, so
      the two agree by measurement rather than by assumption.

      WHAT IS EXPLICITLY NOT TOUCHED. Brief validation itself. Every other test
      in this file — the withheld prose never leaving the backend, the
      machine-readable state, the single presentability predicate, the
      unconditional stamp, the ban on the C906 sentence — is unchanged, and the
      protection is retargeted rather than deleted.
    */
    const successPath = serviceSource.slice(
      serviceSource.indexOf('const providerCallStartedAt = Date.now();'),
      serviceSource.indexOf('} catch (error) {\n          const latencyMs'),
    );

    expect((successPath.match(/this\.provider\.analyzeNews\(/g) ?? []).length).toBe(1);
    expect(successPath).not.toMatch(/\bwhile\s*\(|\bfor\s*\(/);
  });

  it('and ONE is the whole file, not merely the success path', () => {
    /*
      The slice above proves the success path. This proves nothing reintroduced
      a second generation anywhere else in the service — a repair moved into a
      catch block, a retry helper, a "just once more" branch. The synchronous
      path has exactly one model generation, measured against the whole file.
    */
    expect((serviceSource.match(/this\.provider\.analyzeNews\(/g) ?? []).length).toBe(1);
  });

  it('the rejected C906 behaviour cannot come back silently', () => {
    /* The exact sentence that justified publishing a failed brief. */
    expect(serviceSource).not.toContain('Keeping the original analysis.');
    expect(serviceSource).toContain('withholdExecutiveBrief');
    expect(serviceSource).toContain('acceptExecutiveBrief');
  });

  it('BOTH failure paths withhold — a repair that errors is not a compliant brief', () => {
    /*
      The repair can fail two ways: it returns a still-blended answer, or the
      call itself throws. Neither tells us anything new about the FIRST answer,
      which is the one the invariant is about, so both must withhold. The
      stamping is unconditional and sits after the whole `if`, which is what
      makes that true by construction rather than by two matching branches.
    */
    const stamp = serviceSource.slice(
      serviceSource.indexOf('ONE PLACE STAMPS THE RECORD'),
      serviceSource.indexOf('response = {\n            query: originalQuery,'),
    );

    expect(stamp).toContain('briefVerdict.compliant');
    expect(stamp).toContain('acceptExecutiveBrief');
    expect(stamp).toContain('withholdExecutiveBrief');
    /* And it is outside the repair try/catch, so no path can skip it. */
    expect(stamp).not.toContain('catch');
  });
});
