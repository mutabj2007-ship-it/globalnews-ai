import { readFileSync } from 'fs';
import { join } from 'path';

import type { AnalysisApiResponse, SignificanceLevel, TrustLevel } from '@globalnews-ai/shared';

import { fixture } from '@/components/analysis-frame/frameFixtures';
import {
  PRIMARY_DIMENSION_KEYS,
  buildAnalysisWorkspaceModel,
  buildCitationNumbering,
  buildSourceSupport,
  resolveEvidenceMeter,
} from './analysisDimensions';
import { buildDimensionClaims } from './analysisClaims';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * L-4 — METRIC SEMANTICS  ·  L-5 — COMPLETE RECORD FIDELITY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ─── L-4 · THE TRACE, FIELD BY FIELD ──────────────────────────────────────
 *
 * Each rendered figure, the field it comes from, who computes it, and what it
 * actually measures.
 *
 *   EVIDENCE SUPPORT — "MODERATE"
 *     analysis.trustState.level -> resolveEvidenceMeter() -> label + n/3
 *     BACKEND-derived from grounded citations.
 *     Answers: how well does the evidence support this analysis?
 *
 *   SIGNIFICANCE — "MAJOR"
 *     analysis.significance.level, with a cited rationale array beside it.
 *     MODEL-supplied.
 *     Answers: how big is this event?
 *
 *   AI SELF-ASSESSMENT — "HIGH (92/100)"
 *     analysis.confidence.level + analysis.confidence.score. MODEL-supplied.
 *     Answers: how sure is the model of its own answer?
 *     (L-3 fixed the scale these two are stated on; it did not merge them.)
 *
 *   RETRIEVAL — "N articles"
 *     sourceDiversity.retrievedArticleCount — BACKEND, computed over the
 *     ORIGINAL retrieved pool, deliberately BEFORE de-duplication and before
 *     the maxArticles cap (analysis.service.ts:1965 passes `articles`, never
 *     `deduped`, so duplicate concentration cannot become invisible).
 *
 *   CLUSTERS — sourceDiversity.reportingClusterCount    distinct reportings
 *   DOMAINS  — sourceDiversity.knownDomainCount         distinct hostnames
 *   OUTLETS  — sourceDiversity.distinctSourceNameCount  raw provider names
 *
 *   COMPLETE RECORD BUTTON — "7 ITEMS"
 *     AnalysisFrame.tsx:500 `model.sourceSupport.length`
 *     -> buildSourceSupport() -> `response.articles.map(...)`
 *     = the FINAL evidence set: after de-duplication, after the cap — the exact
 *       array the model was shown and the response ships.
 *
 * ─── THE QUESTION THE RULING PUTS DIRECTLY: MODERATE vs MAJOR ─────────────
 *
 * They are GENUINELY DIFFERENT METRICS, not a conflicting mapping. Different
 * fields, different producers, different enums, different questions. Neither is
 * derived from the other, which is why a story can be strongly evidenced and
 * minor, or weakly evidenced and critical. Removing either would lose real
 * information, so neither is removed.
 *
 * ─── BUT ONE TOKEN IS SHARED ACROSS BOTH SCALES ───────────────────────────
 *
 *   TrustLevel         high  | MODERATE | limited | insufficient
 *   SignificanceLevel  minor | MODERATE | major   | critical
 *
 * "moderate" is a legal value of BOTH. A reader can meet the same word twice on
 * one screen meaning two unrelated things — moderate SUPPORT and moderate
 * MAGNITUDE. That is a collision in the vocabulary, not a defect in the data,
 * and renaming an enum that crosses the API contract is a redesign.
 * RECORDED FOR CLAUDE DESIGN, deliberately not renamed here.
 *
 * ─── AND "7 ITEMS" IS PRECISE INTERNALLY, UNNAMED ON SCREEN ───────────────
 *
 * The ruling asks whether it "merely mirrors retrieved-source count". It does
 * NOT. `retrievedArticleCount` counts the PRE-dedup pool; `sourceSupport.length`
 * counts the POST-dedup, post-cap set. They are legitimately DIFFERENT NUMBERS,
 * and both can appear on one screen.
 *
 * So the finding is the ruling's other branch: the quantity has a precise
 * internal contract and NO STATED ONE IN THE UI. "ITEMS" names neither articles
 * nor sources nor clusters, while "N articles" sits nearby meaning a different
 * article count. A reader seeing "12 articles" and "7 ITEMS" has nothing on
 * screen telling them why the two differ.
 *
 * RECORDED FOR CLAUDE DESIGN. No new wording is invented here, per the ruling.
 */

/* ------------------------------------------------------------------ *
 * Helpers — the real adapters, over a realistic response.
 * ------------------------------------------------------------------ */

const withSignificance = (res: AnalysisApiResponse): AnalysisApiResponse => ({
  ...res,
  analysis:
    res.analysis === null
      ? null
      : {
          ...res.analysis,
          significance: {
            level: 'major',
            rationale: [
              { claim: 'It binds the following budget cycle.', sourceArticleIds: ['a1'] },
            ],
          },
        },
});

const src = (rel: string): string => readFileSync(join(__dirname, '..', ...rel.split('/')), 'utf-8');

/*
  An assertion that a surface does NOT do something must read the CODE, not the
  prose. CompleteRecordView's own doc comment names the JSON dump it replaced,
  which is exactly the string the check below looks for.
*/
const stripComments = (source: string): string =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('L-4 — the metrics are distinct, and one word is overloaded', () => {
  describe('EVIDENCE SUPPORT IS BACKEND-DERIVED AND HAS ITS OWN SCALE', () => {
    it('maps every TrustLevel to its label', () => {
      expect(resolveEvidenceMeter('high').label).toBe('STRONG');
      expect(resolveEvidenceMeter('moderate').label).toBe('MODERATE');
      expect(resolveEvidenceMeter('limited').label).toBe('LIMITED');
      expect(resolveEvidenceMeter('insufficient').label).toBe('INSUFFICIENT');
    });

    it('an absent rating is UNRATED, never a low one', () => {
      /*
        'insufficient' and absent both fill zero segments, and there the
        resemblance ends: one is an assessment, the other is the absence of one.
        `rated` is what keeps them apart.
      */
      expect(resolveEvidenceMeter(null).label).toBe('UNRATED');
      expect(resolveEvidenceMeter(null).rated).toBe(false);
      expect(resolveEvidenceMeter('insufficient').rated).toBe(true);
    });

    it('synthesises no numeric score of its own', () => {
      for (const level of ['high', 'moderate', 'limited', 'insufficient'] as TrustLevel[]) {
        const meter = resolveEvidenceMeter(level);

        expect(meter.totalSegments).toBe(3);
        expect(meter.filledSegments).toBeLessThanOrEqual(3);
      }
    });

    it('reads trustState — the workspace model binds that field and no other', () => {
      const model = buildAnalysisWorkspaceModel(withSignificance(fixture()));

      /* The fixture's trustState.level is 'moderate'; its significance is 'major'. */
      expect(model.evidenceMeter.level).toBe('moderate');
      expect(model.evidenceMeter.label).toBe('MODERATE');
    });
  });

  describe('MODERATE AND MAJOR ARE DIFFERENT METRICS — MEASURED, NOT ASSERTED', () => {
    const response = withSignificance(fixture());

    it('the same response carries both at once, with different values', () => {
      /*
        The decisive observation. If these were one metric rendered two ways,
        they could not disagree on a single response — and here they do:
        MODERATE support and MAJOR significance, simultaneously.
      */
      const model = buildAnalysisWorkspaceModel(response);

      expect(model.evidenceMeter.label).toBe('MODERATE');
      expect(response.analysis?.significance?.level).toBe('major');
    });

    it('MAJOR is not a legal evidence-support label', () => {
      const labels = (['high', 'moderate', 'limited', 'insufficient', null] as const).map(
        (level) => resolveEvidenceMeter(level).label,
      );

      expect(labels).not.toContain('MAJOR');
      expect(labels).not.toContain('MINOR');
      expect(labels).not.toContain('CRITICAL');
    });

    it('changing significance does not move the evidence meter', () => {
      /* Independence, demonstrated by varying one and observing the other. */
      const critical: AnalysisApiResponse = {
        ...response,
        analysis:
          response.analysis === null
            ? null
            : { ...response.analysis, significance: { level: 'critical', rationale: [] } },
      };

      expect(buildAnalysisWorkspaceModel(critical).evidenceMeter.label).toBe('MODERATE');
    });

    it('and changing trustState does not move significance', () => {
      const limited: AnalysisApiResponse = {
        ...response,
        analysis:
          response.analysis === null
            ? null
            : {
                ...response.analysis,
                trustState: { ...response.analysis.trustState, level: 'limited' },
              },
      };

      expect(buildAnalysisWorkspaceModel(limited).evidenceMeter.label).toBe('LIMITED');
      expect(limited.analysis?.significance?.level).toBe('major');
    });

    it('significance contributes its RATIONALE to the workspace, not its level', () => {
      /*
        What significance feeds into the dimension list is its cited rationale
        array. The level is a separate badge, and never becomes a rating.
      */
      const entries = buildDimensionClaims(response, 'significance');

      expect(entries).toHaveLength(1);
      expect(entries[0]?.text).toBe('It binds the following budget cycle.');
    });
  });

  describe('THE OVERLOADED TOKEN — RECORDED, NOT RENAMED', () => {
    it('"moderate" is a legal value of BOTH scales', () => {
      /*
        This test asserts the hazard, not a fix, so the collision cannot be
        quietly forgotten before the Claude Design redesign reaches it.
      */
      const trustLevels: readonly TrustLevel[] = ['high', 'moderate', 'limited', 'insufficient'];
      const significanceLevels: readonly SignificanceLevel[] = [
        'minor',
        'moderate',
        'major',
        'critical',
      ];

      expect(trustLevels).toContain('moderate');
      expect(significanceLevels).toContain('moderate');
    });

    it('and the scales are otherwise disjoint, so exactly one word collides', () => {
      const trustOnly = ['high', 'limited', 'insufficient'];
      const significanceOnly = ['minor', 'major', 'critical'];

      for (const level of trustOnly) expect(significanceOnly).not.toContain(level);
    });
  });

  describe('"N ITEMS" IS THE FINAL EVIDENCE SET, UNDER A NOUN THAT SAYS SO NOWHERE', () => {
    const frame = src('analysis-frame/AnalysisFrame.tsx');

    it('is bound to sourceSupport.length', () => {
      expect(frame).toContain('const recordItemCount = model.sourceSupport.length;');
    });

    it('which is exactly the response article count — never filtered', () => {
      for (const articleCount of [1, 5, 7, 12]) {
        const response = fixture({ articleCount });

        expect(buildSourceSupport(response)).toHaveLength(articleCount);
        expect(buildSourceSupport(response)).toHaveLength(response.articles.length);
      }
    });

    it('uncited sources still count — so the figure is not "sources used"', () => {
      /*
        The sharpest reason the label misleads. An article the analysis never
        cites is still an ITEM, and nothing on screen says so.
      */
      const response = fixture({ articleCount: 5, keyFactCount: 1 });
      const support = buildSourceSupport(response);
      const uncited = support.filter((e) => e.supportState === 'not-cited-in-this-analysis');

      expect(uncited.length).toBeGreaterThan(0);
      expect(support).toHaveLength(5);
    });

    it('is not any of the sourceDiversity counters', () => {
      expect(frame).not.toContain('recordItemCount = model.retrievedArticleCount');
      expect(frame).not.toContain('recordItemCount = model.reportingClusterCount');
      expect(frame).not.toContain('recordItemCount = model.distinctSourceNameCount');
    });

    it('and the wording is left exactly as it is, as the ruling requires', () => {
      /*
        "record that for the future Claude Design redesign rather than inventing
        new wording now."
      */
      const en = readFileSync(
        join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', 'en.ts'),
        'utf-8',
      );

      expect(en).toContain("completeRecordCount: '{n} ITEMS'");
    });
  });
});

describe('L-5 — the Complete Record does not transform the analysis', () => {
  const response = withSignificance(fixture({ articleCount: 6, keyFactCount: 3, uncertainties: 2 }));
  const model = buildAnalysisWorkspaceModel(response);

  describe('THE RECORD REUSES THE ACCEPTED COMPONENTS RATHER THAN RE-RENDERING', () => {
    const record = src('analysis-frame/CompleteRecordView.tsx');

    it('renders through AnalysisResultView, not a second implementation', () => {
      expect(record).toContain("import { AnalysisResultView } from '../search/AnalysisResultView';");
    });

    it('and reads the same workspace model the frame reads', () => {
      expect(record).toContain(
        "import { buildAnalysisWorkspaceModel } from '../search/analysisDimensions';",
      );
    });

    it('it is not a JSON dump of analysis alone', () => {
      /*
        `JSON.stringify(response.analysis)` would silently drop every sibling of
        `analysis` on the response — retrievalContext, sourceEntities,
        sourceDiversity, analysisError — which is the drop this view exists to
        prevent.
      */
      expect(stripComments(record)).not.toContain('JSON.stringify(response.analysis)');
      expect(record).toContain('SourceEntitiesPanel');
      expect(record).toContain('RetrievalContextStatus');
    });
  });

  describe('SAME OBJECT -> SAME SEMANTIC DIMENSIONS', () => {
    for (const dimension of PRIMARY_DIMENSION_KEYS) {
      it(`${dimension}: the index count equals the rendered entry count`, () => {
        /*
          The index number and the cards are two views of ONE selection. Computed
          independently they could disagree, and a reader would have no way to
          tell which was right.
        */
        const indexed = model.dimensions.find((d) => d.key === dimension);
        const entries = buildDimensionClaims(response, dimension);

        if (dimension === 'brief') {
          expect(indexed?.count).toBeNull();
          expect(entries).toHaveLength(0);
          return;
        }

        expect(indexed?.count).toBe(entries.length);
      });
    }

    it('insufficient-evidence carries uncertainties AND unknowns, dropping neither', () => {
      const analysis = response.analysis;
      const entries = buildDimensionClaims(response, 'insufficient-evidence');

      expect(entries).toHaveLength(
        (analysis?.uncertainties?.length ?? 0) + (analysis?.unknowns.length ?? 0),
      );
      expect(entries.every((e) => e.kind === 'uncertainty' || e.kind === 'unknown')).toBe(true);
    });

    it('no dimension is merged into another', () => {
      const populated = PRIMARY_DIMENSION_KEYS.filter((k) => k !== 'brief')
        .map((k) => buildDimensionClaims(response, k).map((e) => e.text))
        .filter((texts) => texts.length > 0);

      for (let i = 0; i < populated.length; i += 1) {
        for (let j = i + 1; j < populated.length; j += 1) {
          expect(populated[i]).not.toEqual(populated[j]);
        }
      }
    });

    it('building twice from the same object yields identical output', () => {
      /* Determinism is what makes "same object, same record" testable at all. */
      expect(buildDimensionClaims(response, 'key-facts')).toEqual(
        buildDimensionClaims(response, 'key-facts'),
      );
      expect(buildAnalysisWorkspaceModel(response).dimensions).toEqual(model.dimensions);
    });
  });

  describe('SAME OBJECT -> SAME CITATIONS', () => {
    it('citation numbering is one map, shared by both surfaces', () => {
      const independent = buildCitationNumbering(response.analysis?.sources, response.articles);

      expect(model.citationNumbering).toEqual(independent);
    });

    it('claims keep their own cited article ids — never reassigned', () => {
      const entries = buildDimensionClaims(response, 'key-facts');

      entries.forEach((entry, i) => {
        const canonical = response.analysis?.keyFacts[i]?.sourceArticleIds ?? [];

        expect(entry.citations.map((c) => c.articleId)).toEqual(canonical);
      });
    });

    it('citation numbers come from the shared map, never from render position', () => {
      for (const entry of buildDimensionClaims(response, 'key-facts')) {
        for (const citation of entry.citations) {
          expect(citation.citationNumber).toBe(
            model.citationNumbering.get(citation.articleId) ?? null,
          );
        }
      }
    });

    it('ordinals are per-dimension and positional, so nothing is renumbered globally', () => {
      /*
        Ordinals restart at 01 in every dimension. They identify a card within
        its own list; they are NOT citation numbers, and conflating the two
        would renumber citations by accident.
      */
      expect(buildDimensionClaims(response, 'key-facts').map((e) => e.ordinal)).toEqual([
        '01',
        '02',
        '03',
      ]);
      expect(buildDimensionClaims(response, 'significance').map((e) => e.ordinal)).toEqual(['01']);
    });

    it('an uncited entry keeps an empty citation list rather than inheriting one', () => {
      const uncited = buildDimensionClaims(response, 'insufficient-evidence').filter(
        (e) => e.uncited,
      );

      expect(uncited.length).toBeGreaterThan(0);
      for (const entry of uncited) {
        expect(entry.citations).toEqual([]);
        expect(entry.citationCount).toBe(0);
      }
    });
  });

  describe('SAME OBJECT -> SAME SOURCES, SAME COUNTS', () => {
    const support = buildSourceSupport(response);

    it('every retrieved article appears exactly once, in response order', () => {
      expect(support.map((e) => e.articleId)).toEqual(response.articles.map((a) => a.id));
    });

    it('the source count is not changed by the record', () => {
      expect(support).toHaveLength(response.articles.length);
      expect(model.sourceSupport).toHaveLength(response.articles.length);
    });

    it('uncited sources are preserved, not filtered away', () => {
      /* "Insufficient evidence is a first-class result" applies to sources too. */
      const uncited = support.filter((e) => e.supportState === 'not-cited-in-this-analysis');

      expect(uncited.length).toBeGreaterThan(0);
      expect(support.length).toBeGreaterThan(uncited.length);
    });

    it('source identity is carried through unchanged', () => {
      support.forEach((entry, i) => {
        const article = response.articles[i];

        expect(entry.article.id).toBe(article?.id);
        expect(entry.article.url).toBe(article?.url);
        expect(entry.article.sourceName).toBe(article?.sourceName);
      });
    });

    it('sources are neither sorted nor grouped', () => {
      const reversed: AnalysisApiResponse = {
        ...response,
        articles: [...response.articles].reverse(),
      };

      expect(buildSourceSupport(reversed).map((e) => e.articleId)).toEqual(
        reversed.articles.map((a) => a.id),
      );
    });
  });

  describe('THE CANONICAL PROSE IS NOT PARAPHRASED', () => {
    it('claim text is carried verbatim from the contract', () => {
      buildDimensionClaims(response, 'key-facts').forEach((entry, i) => {
        expect(entry.text).toBe(response.analysis?.keyFacts[i]?.claim);
      });
    });

    it('an affected party keeps subject and finding separate, losing neither', () => {
      const withParty: AnalysisApiResponse = {
        ...response,
        analysis:
          response.analysis === null
            ? null
            : {
                ...response.analysis,
                affectedParties: [
                  {
                    party: 'Small exporters',
                    partyType: 'group',
                    effect: 'face higher filing costs',
                    sourceArticleIds: ['a1'],
                  },
                ],
              },
      };
      const entry = buildDimensionClaims(withParty, 'who-is-affected')[0];

      expect(entry?.party).toBe('Small exporters');
      expect(entry?.text).toBe('face higher filing costs');
    });

    it('nothing invents an evidence breadth the payload did not carry', () => {
      /* UncertaintyItem carries no breadth in the contract; none is manufactured. */
      for (const entry of buildDimensionClaims(response, 'insufficient-evidence')) {
        expect(entry.evidenceBreadth).toBeNull();
      }
    });
  });
});
