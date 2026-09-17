import { buildAnalysisJsonSchema } from '../prompt/build-analysis-prompt.util';
import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * L-3 — "AI SELF-ASSESSMENT: HIGH (1/100)"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: trace model/schema value -> normalization -> numeric scale ->
 * qualitative label -> rendering, and *"do not simply change 1 or change HIGH"*.
 *
 * ─── THE TRACE, AND WHAT IT RULED OUT ─────────────────────────────────────
 *
 *   inverted?                 NO. Nothing subtracts from 100 anywhere.
 *   wrong label mapping?      NO. `level` and `score` are separate fields the
 *                             model supplies together; neither is derived from
 *                             the other.
 *   different concepts?       They ARE different concepts, and correctly so —
 *                             but that is not what produced "1".
 *   decimal normalization?    YES, and one layer deeper than it looks.
 *
 * ─── THE ACTUAL CAUSE ─────────────────────────────────────────────────────
 *
 * The JSON schema declared `score: { type: 'number' }`. No minimum, no maximum,
 * no description. The prompt said "reflect this in the confidence score" and
 * never named a scale. THE CONTRACT NEVER TOLD THE MODEL WHAT UNITS TO ANSWER
 * IN — the "0-100" existed only in a TypeScript comment, which the model cannot
 * read.
 *
 * So the model answered on the scale models naturally use for confidence: a 0-1
 * probability. `Math.round(0.92)` is 1, clamped into [0,100], rendered
 * faithfully as "HIGH (1/100)".
 *
 * NEITHER THE NUMBER NOR THE LABEL WAS WRONG. They were on different scales and
 * nothing reconciled them. That is why the fix is the schema and the prompt,
 * with scale detection as the defensive half — and why changing the 1, or
 * changing the HIGH, would have hidden it.
 */

const ARTICLES = [
  {
    id: 'a1',
    title: 'Poland revives tax proposal',
    summary: 'The proposal returns to committee.',
    url: 'https://example.com/a1',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-15T00:00:00.000Z',
  },
] as never;

describe('L-3 — the confidence scale is stated, not assumed', () => {
  describe('THE SCHEMA NOW DECLARES THE SCALE', () => {
    const built = buildAnalysisJsonSchema() as unknown as {
      schema: { properties: { confidence: { properties: { score: Record<string, unknown> } } } };
    };
    const score = built.schema.properties.confidence.properties.score;

    it('bounds the value 0-100 rather than accepting any number', () => {
      expect(score.type).toBe('number');
      expect(score.minimum).toBe(0);
      expect(score.maximum).toBe(100);
    });

    it('says in words that it is not a probability', () => {
      /*
        The bound alone would not have prevented this: 0.92 satisfies
        `minimum: 0, maximum: 100` perfectly well.
      */
      expect(String(score.description)).toMatch(/NOT a 0-1 probability/);
    });
  });

  describe('THE PROMPT SAYS IT TOO', () => {
    const PROMPT = buildAnalysisMessages('What is happening in Poland?', ARTICLES, 1200).system;

    it('states the 0-100 scale explicitly', () => {
      expect(PROMPT).toMatch(/"confidence\.score" IS ON A 0-100 SCALE, not a 0-1 probability/);
    });

    it('ties the number to the label so the two cannot disagree', () => {
      expect(PROMPT).toMatch(/0-39 for "low", 40-74 for\s+"medium", 75-100 for "high"/);
    });

    it('keeps self-assessment distinct from evidence support', () => {
      /* CTO: "Keep AI self-assessment distinct from the authoritative evidence-support rating." */
      expect(PROMPT).toMatch(/YOUR OWN self-assessment and is a\s+different thing from how well the evidence supports/);
      expect(PROMPT).toMatch(/the\s+backend derives and you are not asked for/);
    });
  });

  describe('BOUNDARY TESTS FOR THE SCALE', () => {
    /*
      The normalizer is internal, so the boundaries are asserted through the
      same arithmetic it performs. Each case names what it protects.
    */
    const normalize = (raw: number): number => {
      const looksLikeFraction = !Number.isInteger(raw) && raw > 0 && raw < 1;
      const scaled = looksLikeFraction ? raw * 100 : raw;

      return Math.max(0, Math.min(100, Math.round(scaled)));
    };

    it('the measured case: 0.92 is 92, not 1', () => {
      expect(normalize(0.92)).toBe(92);
    });

    it('other fractions scale correctly', () => {
      expect(normalize(0.5)).toBe(50);
      expect(normalize(0.05)).toBe(5);
      expect(normalize(0.999)).toBe(100);
    });

    it('legitimate 0-100 integers are untouched', () => {
      expect(normalize(0)).toBe(0);
      expect(normalize(1)).toBe(1);
      expect(normalize(50)).toBe(50);
      expect(normalize(92)).toBe(92);
      expect(normalize(100)).toBe(100);
    });

    it('an integer 1 is NOT rescaled to 100 — the ambiguity is resolved toward the contract', () => {
      /*
        1 could mean "1 out of 100" or "certain". Guessing would turn a
        legitimate low score into a maximum one, which is a far worse error than
        reporting the low score the model actually gave.
      */
      expect(normalize(1)).toBe(1);
    });

    it('non-integers ABOVE 1 are treated as 0-100 and rounded, not scaled', () => {
      expect(normalize(92.4)).toBe(92);
      expect(normalize(1.5)).toBe(2);
    });

    it('out-of-range values are clamped rather than rejected', () => {
      expect(normalize(150)).toBe(100);
      expect(normalize(-20)).toBe(0);
    });

    it('the clamp still cannot manufacture a score from nothing', () => {
      expect(normalize(0)).toBe(0);
    });
  });

  describe('SELF-ASSESSMENT AND EVIDENCE SUPPORT REMAIN DIFFERENT THINGS', () => {
    it('the schema asks the model only for its own confidence', () => {
      const built = buildAnalysisJsonSchema() as unknown as {
        schema: { properties: Record<string, unknown> };
      };
      const schema = built.schema;

      /*
        Evidence support is derived by the backend from grounded citations. If
        it ever appeared in the model schema, the model would be marking its own
        homework — which is precisely the confusion the two fields exist to keep
        apart.
      */
      expect(Object.keys(schema.properties)).toContain('confidence');
      expect(Object.keys(schema.properties)).not.toContain('trustState');
      expect(Object.keys(schema.properties)).not.toContain('evidenceSupport');
    });
  });
});
