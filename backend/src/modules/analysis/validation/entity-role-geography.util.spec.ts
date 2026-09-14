/**
 * C911-R2 -- the exact Production factual error, and the attributions that
 * must survive it.
 *
 * Every "must be rejected" case below is a shape the product actually
 * produced or a direct structural sibling of it. Every "must remain valid"
 * case is quoted from the C911 contract's own list of attributions that a
 * correction may not break.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import type { NewsArticle } from '@globalnews-ai/shared';

import {
  applyBriefRelationIntegrity,
  extractRoleAttributions,
  findRoleContradictions,
} from './entity-role-geography.util';
import { isExecutiveBriefPresentable, withholdExecutiveBrief } from './brief-fail-closed.util';
import { validateAnalysisResult } from './validate-analysis-result';

const article = (title: string, summary: string): Pick<NewsArticle, 'title' | 'summary'> => ({
  title,
  summary,
});

/** The evidence a South Africa analysis actually held. */
const SOUTH_AFRICA_EVIDENCE = [
  article(
    'India Prime Minister Narendra Modi opens trade forum',
    'India Prime Minister Narendra Modi opened a trade forum in New Delhi attended by delegations from South Africa and Brazil.',
  ),
  article(
    'South Africa President Cyril Ramaphosa addresses parliament',
    'South Africa President Cyril Ramaphosa addressed parliament on the electricity reform bill.',
  ),
];

describe('C911-R2 -- ENTITY + ROLE + GEOGRAPHY relation validation', () => {
  describe('THE REPRODUCED PRODUCTION ERROR', () => {
    it('rejects "South Africa’s Prime Minister Narendra Modi"', () => {
      const contradictions = findRoleContradictions(
        "South Africa's Prime Minister Narendra Modi announced the agreement.",
        SOUTH_AFRICA_EVIDENCE,
      );

      expect(contradictions).toHaveLength(1);
      expect(contradictions[0].person).toBe('Narendra Modi');
      expect(contradictions[0].role).toBe('prime minister');
      expect(contradictions[0].claimedCountryIso3).toBe('ZAF');
      expect(contradictions[0].evidenceCountryIso3).toBe('IND');
    });

    it('the contradiction is drawn from the evidence, never from world knowledge', () => {
      // Remove the article that attests Modi and the module has NO opinion.
      // This is the whole design: it knows nothing about who governs India.
      const withoutModi = [SOUTH_AFRICA_EVIDENCE[1]];

      expect(
        findRoleContradictions(
          "South Africa's Prime Minister Narendra Modi announced the agreement.",
          withoutModi,
        ),
      ).toHaveLength(0);
    });

    it('rejects a foreign leader attributed to Zambia', () => {
      const evidence = [
        article(
          'India Prime Minister Narendra Modi visits Lusaka',
          'India Prime Minister Narendra Modi arrived in Lusaka for talks.',
        ),
      ];

      const contradictions = findRoleContradictions(
        "Zambia's President Narendra Modi opened the session.",
        evidence,
      );

      expect(contradictions).toHaveLength(1);
      expect(contradictions[0].claimedCountryIso3).toBe('ZMB');
      expect(contradictions[0].evidenceCountryIso3).toBe('IND');
    });
  });

  describe('MUST REMAIN VALID -- the contract’s own list', () => {
    it('"Prime Minister of India Narendra Modi ..." is supported', () => {
      expect(
        findRoleContradictions(
          'Prime Minister of India Narendra Modi met trade officials.',
          SOUTH_AFRICA_EVIDENCE,
        ),
      ).toHaveLength(0);
    });

    it('"South Africa President Cyril Ramaphosa ..." is supported', () => {
      expect(
        findRoleContradictions(
          'South Africa President Cyril Ramaphosa signed the bill.',
          SOUTH_AFRICA_EVIDENCE,
        ),
      ).toHaveLength(0);
    });

    it('"Narendra Modi met South African officials" attributes nothing to Modi', () => {
      // 'officials' is not a person title, so no country is bound to a named
      // person and there is nothing to contradict.
      expect(
        extractRoleAttributions('Narendra Modi met South African officials in Pretoria.'),
      ).toHaveLength(0);

      expect(
        findRoleContradictions(
          'Narendra Modi met South African officials in Pretoria.',
          SOUTH_AFRICA_EVIDENCE,
        ),
      ).toHaveLength(0);
    });

    it('"India’s prime minister discussed South Africa" names no person', () => {
      expect(
        extractRoleAttributions("India's prime minister discussed South Africa trade access."),
      ).toHaveLength(0);
    });

    it('a person the evidence never attributes to any country is left alone', () => {
      expect(
        findRoleContradictions(
          "South Africa's Minister Thandi Modise briefed the committee.",
          SOUTH_AFRICA_EVIDENCE,
        ),
      ).toHaveLength(0);
    });

    it('an empty evidence set produces no verdict at all', () => {
      expect(
        findRoleContradictions("South Africa's Prime Minister Narendra Modi spoke.", []),
      ).toHaveLength(0);
    });
  });

  describe('EXTRACTION -- the four attribution shapes', () => {
    it('reads possessive, bare, "of"-prefixed and "of"-suffixed forms', () => {
      const shapes: Array<[string, string, string]> = [
        ["South Africa's President Cyril Ramaphosa spoke.", 'Cyril Ramaphosa', 'ZAF'],
        ['India Prime Minister Narendra Modi spoke.', 'Narendra Modi', 'IND'],
        ['Prime Minister of India Narendra Modi spoke.', 'Narendra Modi', 'IND'],
        ['President Cyril Ramaphosa of South Africa spoke.', 'Cyril Ramaphosa', 'ZAF'],
      ];

      for (const [text, person, iso3] of shapes) {
        const found = extractRoleAttributions(text);

        expect(found.length).toBeGreaterThanOrEqual(1);
        expect(found.some((a) => a.person === person && a.countryIso3 === iso3)).toBe(true);
      }
    });

    it('reads a demonym as the country form', () => {
      const found = extractRoleAttributions('South African President Cyril Ramaphosa spoke.');

      expect(found.some((a) => a.countryIso3 === 'ZAF' && a.person === 'Cyril Ramaphosa')).toBe(
        true,
      );
    });

    it('"prime minister" is never truncated to "minister"', () => {
      const found = extractRoleAttributions('India Prime Minister Narendra Modi spoke.');

      expect(found.some((a) => a.role === 'prime minister')).toBe(true);
    });

    it('is re-entrant -- repeated calls give identical results', () => {
      const text = 'India Prime Minister Narendra Modi spoke.';

      expect(extractRoleAttributions(text)).toEqual(extractRoleAttributions(text));
    });

    it('empty and whitespace input yield nothing rather than throwing', () => {
      expect(extractRoleAttributions('')).toHaveLength(0);
      expect(extractRoleAttributions('   ')).toHaveLength(0);
    });
  });

  describe('FAIL-CLOSED DIRECTION -- only a positive contradiction counts', () => {
    it('agreement anywhere in the evidence outranks silence elsewhere', () => {
      const evidence = [
        article('Modi arrives', 'Narendra Modi arrived in Pretoria.'),
        article(
          'India Prime Minister Narendra Modi opens forum',
          'India Prime Minister Narendra Modi opened the forum.',
        ),
      ];

      expect(
        findRoleContradictions('Prime Minister of India Narendra Modi spoke.', evidence),
      ).toHaveLength(0);
    });
  });
});

/**
 * C911-R2 — END TO END through validateAnalysisResult.
 *
 * The unit tests above prove the verdict. These prove the verdict is actually
 * ENFORCED on the path a real analysis takes, and that enforcement drops only
 * the contradicted claim rather than the whole record.
 */
describe('C911-R2 — enforcement inside validateAnalysisResult', () => {
  const makeArticle = (over: Partial<NewsArticle>): NewsArticle => ({
    id: 'article-1',
    title: 'Test headline',
    summary: 'Test summary',
    url: 'https://example.com/test',
    sourceId: 'test-source',
    sourceName: 'Test Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date().toISOString(),
    ...over,
  });

  const EVIDENCE: NewsArticle[] = [
    makeArticle({
      id: 'article-modi',
      title: 'India Prime Minister Narendra Modi opens trade forum',
      summary:
        'India Prime Minister Narendra Modi opened a trade forum attended by a South Africa delegation.',
    }),
  ];

  const ctx = (articles: NewsArticle[]) => ({
    query: 'What are the latest developments in South Africa?',
    articles,
    analysisMode: 'live-ai' as const,
    maxArticleChars: 1200,
  });

  const candidate = (claims: string[]) => ({
    headline: 'A headline',
    summary: 'A summary',
    keyFacts: claims.map((claim) => ({ claim, evidenceIds: ['S1'] })),
    agreements: [],
    differences: [],
    unknowns: ['Some open question'],
    uncertainties: [],
    timeline: [],
    confidence: { level: 'medium', score: 60, explanation: 'Reasonable evidence.' },
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
  });

  it('drops the contradicted claim and keeps the supported one', () => {
    const result = validateAnalysisResult(
      candidate([
        "South Africa's Prime Minister Narendra Modi opened the forum.",
        'A South Africa delegation attended the forum.',
      ]),
      ctx(EVIDENCE),
    );

    const claims = result.keyFacts.map((f) => f.claim);

    expect(claims).not.toContain("South Africa's Prime Minister Narendra Modi opened the forum.");
    expect(claims).toContain('A South Africa delegation attended the forum.');
  });

  it('keeps the correctly attributed claim — the check is not anti-Modi', () => {
    const result = validateAnalysisResult(
      candidate(['India Prime Minister Narendra Modi opened the forum.']),
      ctx(EVIDENCE),
    );

    expect(result.keyFacts.map((f) => f.claim)).toContain(
      'India Prime Minister Narendra Modi opened the forum.',
    );
  });

  it('does not reject the analysis record — it drops one entry, as this file already does', () => {
    const result = validateAnalysisResult(
      candidate(["South Africa's Prime Minister Narendra Modi opened the forum."]),
      ctx(EVIDENCE),
    );

    // The record survives with its other validated sections intact.
    expect(result.headline).toBe('A headline');
    expect(result.summary).toBe('A summary');
    expect(result.keyFacts).toHaveLength(0);
  });

  it('is inert when the evidence attributes nobody', () => {
    const silent = [makeArticle({ id: 'a1', title: 'Markets steady', summary: 'Markets steady.' })];

    const result = validateAnalysisResult(
      candidate(["South Africa's Prime Minister Narendra Modi opened the forum."]),
      ctx(silent),
    );

    expect(result.keyFacts).toHaveLength(1);
  });
});

/**
 * C911-R11 -- THE EXECUTIVE BRIEF ITSELF.
 *
 * C911-R2 protected sourced claims. The reported Production defect was in the
 * user-visible brief, so these assert the brief path: the exact error cannot be
 * shown as compliant, and every accepted valid control still is.
 */
describe('C911-R11 -- Executive Brief relation integrity', () => {
  const breadth = { clusters: 3, categories: 2, multiDevelopment: true };
  const compliant = { compliant: true, paragraphs: 2, breadth };
  const structurallyFailed = {
    compliant: false,
    paragraphs: 1,
    breadth,
    reason: 'THE ORIGINAL STRUCTURAL REASON',
  };

  const EVIDENCE = [
    article(
      'India Prime Minister Narendra Modi opens trade forum',
      'India Prime Minister Narendra Modi opened a trade forum attended by a South Africa delegation.',
    ),
    article(
      'South Africa President Cyril Ramaphosa addresses parliament',
      'South Africa President Cyril Ramaphosa addressed parliament on the electricity reform bill.',
    ),
  ];

  describe('THE REPORTED PRODUCTION DEFECT CANNOT BE DISPLAYED', () => {
    it('a structurally valid brief carrying the exact error is NOT compliant', () => {
      const brief =
        "South Africa's Prime Minister Narendra Modi opened a trade forum this week.\n\n" +
        'Separately, parliament advanced the electricity reform bill.';

      const verdict = applyBriefRelationIntegrity(compliant, brief, EVIDENCE);

      expect(verdict.compliant).toBe(false);
      expect(verdict.reason).toContain('Narendra Modi');
      expect(verdict.reason).toContain('ZAF');
      expect(verdict.reason).toContain('IND');
    });

    it('the paragraph count and measured breadth are carried through untouched', () => {
      const brief = "South Africa's Prime Minister Narendra Modi spoke.\n\nAnd separately, this.";
      const verdict = applyBriefRelationIntegrity(compliant, brief, EVIDENCE);

      // C910's structural measurements are REPORTED, not recomputed or altered.
      expect(verdict.paragraphs).toBe(compliant.paragraphs);
      expect(verdict.breadth).toBe(compliant.breadth);
    });

    it('the brief prose is never rewritten - only the verdict changes', () => {
      const brief = "South Africa's Prime Minister Narendra Modi spoke.\n\nSecond development.";
      const before = brief;

      applyBriefRelationIntegrity(compliant, brief, EVIDENCE);

      // No silent "correction" of a country or a title in generated prose.
      expect(brief).toBe(before);
    });
  });

  describe('ACCEPTED VALID CONTROLS STILL PASS', () => {
    it('same-country attribution is allowed', () => {
      const brief =
        'India Prime Minister Narendra Modi opened a trade forum.\n\nParliament advanced the bill.';

      expect(applyBriefRelationIntegrity(compliant, brief, EVIDENCE).compliant).toBe(true);
    });

    it('"Prime Minister of India Narendra Modi" is allowed', () => {
      const brief = 'Prime Minister of India Narendra Modi met officials.\n\nSecond development.';

      expect(applyBriefRelationIntegrity(compliant, brief, EVIDENCE).compliant).toBe(true);
    });

    it('"South Africa President Cyril Ramaphosa" is allowed', () => {
      const brief =
        'South Africa President Cyril Ramaphosa signed the bill.\n\nSecond development.';

      expect(applyBriefRelationIntegrity(compliant, brief, EVIDENCE).compliant).toBe(true);
    });

    it('"Narendra Modi met South African officials" is allowed', () => {
      const brief = 'Narendra Modi met South African officials.\n\nSecond development.';

      expect(applyBriefRelationIntegrity(compliant, brief, EVIDENCE).compliant).toBe(true);
    });

    it('evidence SILENCE is no opinion - the brief is not withheld', () => {
      const silent = [article('Markets steady', 'Markets steady in early trading.')];
      const brief = "South Africa's Prime Minister Narendra Modi spoke.\n\nSecond development.";

      expect(applyBriefRelationIntegrity(compliant, brief, silent).compliant).toBe(true);
    });

    it('a brief naming no country-qualified person is no opinion', () => {
      const brief = 'Parliament advanced the electricity reform bill.\n\nInflation eased.';

      expect(applyBriefRelationIntegrity(compliant, brief, EVIDENCE).compliant).toBe(true);
    });
  });

  describe('IT COMPOSES WITH THE STRUCTURAL CHECK RATHER THAN REPLACING IT', () => {
    it('an already-failed brief keeps its ORIGINAL structural reason', () => {
      const brief = "South Africa's Prime Minister Narendra Modi spoke.";

      const verdict = applyBriefRelationIntegrity(structurallyFailed, brief, EVIDENCE);

      expect(verdict.compliant).toBe(false);
      expect(verdict.reason).toBe('THE ORIGINAL STRUCTURAL REASON');
    });

    it('an already-withheld (empty) brief is not re-judged', () => {
      const verdict = applyBriefRelationIntegrity(compliant, '', EVIDENCE);

      expect(verdict).toBe(compliant);
    });

    it('a whitespace-only brief is not re-judged either', () => {
      expect(applyBriefRelationIntegrity(compliant, '   \n\n  ', EVIDENCE)).toBe(compliant);
    });
  });
});

/**
 * C911-R11 -- END TO END: THE READER CANNOT SEE IT.
 *
 * The verdict tests above prove the judgement. These prove the CONSEQUENCE --
 * that a relation-contradicting brief is emptied and stamped with the EXISTING
 * two-state vocabulary, and that the one-generation budget is untouched.
 *
 * Service wiring is asserted by source inspection, which is the convention this
 * repository already uses for exactly this guarantee -- see
 * executive-brief-structural-recovery.spec.ts R6.
 */
describe('C911-R11 -- the withheld consequence, and the unchanged budget', () => {
  const SERVICE = readFileSync(join(__dirname, '../service/analysis.service.ts'), 'utf-8');
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const code = stripComments(SERVICE);

  const breadth = { clusters: 3, categories: 2, multiDevelopment: true };

  const EVIDENCE = [
    article(
      'India Prime Minister Narendra Modi opens trade forum',
      'India Prime Minister Narendra Modi opened a trade forum attended by a South Africa delegation.',
    ),
  ];

  const baseAnalysis = {
    headline: 'A headline',
    summary:
      "South Africa's Prime Minister Narendra Modi opened a trade forum.\n\nSecond development.",
    keyFacts: [],
    agreements: [],
    differences: [],
    timeline: [],
    uncertainties: [],
    unknowns: [],
    entities: { countries: [], locations: [], people: [], organizations: [], topics: [] },
    confidence: { level: 'medium' as const, score: 60, explanation: 'x' },
    sources: [],
  };

  it('the contradicting brief is EMPTIED, so no surface can render it', () => {
    const verdict = applyBriefRelationIntegrity(
      { compliant: true, paragraphs: 2, breadth },
      baseAnalysis.summary,
      EVIDENCE,
    );

    expect(verdict.compliant).toBe(false);

    const withheld = withholdExecutiveBrief(baseAnalysis as never, verdict, false);

    expect(withheld.summary).toBe('');
    expect(isExecutiveBriefPresentable(withheld)).toBe(false);
  });

  it('it uses the EXISTING two-state vocabulary - no third state', () => {
    const verdict = applyBriefRelationIntegrity(
      { compliant: true, paragraphs: 2, breadth },
      baseAnalysis.summary,
      EVIDENCE,
    );
    const withheld = withholdExecutiveBrief(baseAnalysis as never, verdict, false);

    expect(withheld.briefState?.availability).toBe('withheld-non-compliant');
  });

  it('the withheld record keeps everything except the brief', () => {
    const verdict = applyBriefRelationIntegrity(
      { compliant: true, paragraphs: 2, breadth },
      baseAnalysis.summary,
      EVIDENCE,
    );
    const withheld = withholdExecutiveBrief(baseAnalysis as never, verdict, false);

    expect(withheld.headline).toBe('A headline');
    expect(withheld.briefState?.clusters).toBe(3);
    expect(withheld.briefState?.categories).toBe(2);
  });

  describe('THE SERVICE WIRING', () => {
    it('composes relation integrity onto the structural verdict', () => {
      expect(code).toContain('applyBriefRelationIntegrity(');
      expect(code).toContain(
        'const structuralVerdict = assessBriefCompliance(analysis.summary, developmentBreadth);',
      );
    });

    it('judges the brief against `deduped` - the exact evidence the model saw', () => {
      const call = code.slice(code.indexOf('applyBriefRelationIntegrity('));

      expect(call.slice(0, 200)).toContain('deduped');
    });

    it('STILL exactly one provider generation', () => {
      expect(code.match(/this\.provider\.analyzeNews\(/g) ?? []).toHaveLength(1);
    });

    it('STILL no repair directive and no repair generation', () => {
      expect(code).not.toContain('repairDirective');
      expect(code).toContain('const repairRequested = false;');
    });

    it('STILL one place stamps the record', () => {
      expect(code.match(/withholdExecutiveBrief\(/g) ?? []).toHaveLength(1);
      expect(code.match(/acceptExecutiveBrief\(/g) ?? []).toHaveLength(1);
    });

    it('adds no retrieval call alongside the brief verdict', () => {
      const region = code.slice(
        code.indexOf('const structuralVerdict'),
        code.indexOf('const repairRequested = false;'),
      );

      expect(region).not.toContain('this.newsService');
      expect(region).not.toContain('this.provider.analyzeNews');
    });
  });
});
