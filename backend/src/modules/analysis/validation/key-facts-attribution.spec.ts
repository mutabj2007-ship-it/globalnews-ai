import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';
import { semanticsForField } from '../prompt/dimension-semantics';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * J-3 — KEY FACTS: FACT vs REPORTED STATEMENT vs INTERPRETIVE CHARACTERISATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE MEASURED CASE, AND THE FOUR QUESTIONS IT COLLAPSES.
 *
 *     "Russia issued a threat to Poland…"
 *
 * asserted in GlobalNews AI's own voice, hides four separate questions the
 * reader cannot separate afterwards:
 *
 *   1. does the evidence support RUSSIA as the actor, or a ministry/official?
 *   2. does it identify a more precise speaker than the country?
 *   3. does it support the statement itself?
 *   4. does the SOURCE call it a threat — or is that our word?
 *
 * ─── WHY THE FIX IS STRUCTURAL ────────────────────────────────────────────
 *
 * CTO ruling: *"Prefer preserving attribution structurally rather than
 * post-processing prose after generation."*
 *
 * Rewriting the sentence afterwards would be the same judgement in quieter
 * language, made by a second system with no access to the evidence. Instead the
 * claim now CARRIES its kind: `assertion` is FACT or REPORTED_STATEMENT, and a
 * reported statement carries the speaker the evidence names.
 *
 * ─── AND WHY A REPORTED STATEMENT WITHOUT A SPEAKER IS DROPPED ────────────
 *
 * It is indistinguishable from a fact, which is the exact collapse this exists
 * to prevent. Inventing an attributor would fabricate provenance; silently
 * downgrading it to FACT would assert in our own voice something the model
 * itself flagged as merely reported. Both are worse than one fewer key fact.
 */

const ARTICLES = [
  {
    id: 'a1',
    title: 'Ministry comments on border measures',
    summary: 'The foreign ministry spokesperson said the measures would have consequences.',
    url: 'https://example.com/a1',
    sourceId: 'src',
    sourceName: 'Source',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-09-15T00:00:00.000Z',
  },
] as never;

const PROMPT = buildAnalysisMessages('What is happening in Poland?', ARTICLES, 1200).system;

describe('J-3 — key facts carry their kind', () => {
  describe('THE CONTRACT DISTINGUISHES THE THREE THINGS', () => {
    it('key facts carry FACT and refuse SIGNIFICANCE', () => {
      const keyFacts = semanticsForField('keyFacts');

      expect(keyFacts?.carries).toBe('FACT');
      expect(keyFacts?.refuses).toContain('SIGNIFICANCE');
    });

    it('the worked refusal is the measured Poland case', () => {
      const keyFacts = semanticsForField('keyFacts');

      expect(keyFacts?.example.rejected).toBe('Russia issued a threat to Poland');
    });

    it('and it names all four questions the sentence collapsed', () => {
      const because = semanticsForField('keyFacts')?.example.because ?? '';

      expect(because).toMatch(/RUSSIA as the actor/);
      expect(because).toMatch(/more precise\s+speaker/);
      expect(because).toMatch(/supports the statement itself/);
      expect(because).toMatch(/SOURCE calls it a threat/);
    });
  });

  describe('FIXTURE 1 — A SOURCED FACT IS A KEY FACT', () => {
    it('FACT is defined as the evidence establishing the proposition', () => {
      expect(PROMPT).toMatch(/"FACT" — the supplied evidence ESTABLISHES this proposition/);
      expect(PROMPT).toMatch(/stated\s+in GlobalNews AI's own voice/);
    });
  });

  describe('FIXTURE 2 — AN ATTRIBUTED REPORTED STATEMENT IS A KEY FACT', () => {
    it('REPORTED_STATEMENT is defined as the assertion that someone said it', () => {
      expect(PROMPT).toMatch(/"REPORTED_STATEMENT" — someone SAID this/);
      expect(PROMPT).toMatch(/a different claim from the content being true/);
    });

    it('the speaker must be the most precise attributor the evidence supports', () => {
      expect(PROMPT).toMatch(/a named official or ministry where one is given/);
      expect(PROMPT).toMatch(/the country ONLY when the evidence\s+attributes it no more precisely/);
    });

    it('the reporting verb is carried too, from the evidence', () => {
      expect(PROMPT).toMatch(/reporting verb the evidence uses/);
    });
  });

  describe('FIXTURE 3 — AN UNSUPPORTED INTERPRETATION IS REJECTED', () => {
    it('characterisations are named as judgements, not facts', () => {
      expect(PROMPT).toContain('AN INTERPRETIVE CHARACTERISATION IS NOT A KEY FACT');
      /* The prompt wraps mid-list, so the whitespace must be flexible. */
      expect(PROMPT).toMatch(/"threat",\s+"escalation", "crackdown", "crisis" or "landmark"/);
      expect(PROMPT).toMatch(/judgements about what\s+something MEANS/);
    });

    it('such a word is admissible ONLY if the evidence itself uses it — and then attributed', () => {
      expect(PROMPT).toMatch(/only where the supplied evidence\s+itself uses it/);
      expect(PROMPT).toMatch(/never a "FACT" in our own voice/);
    });

    it('reporting the action is the fallback when the evidence does not characterise', () => {
      expect(PROMPT).toMatch(/report the action/);
    });

    it('softening the wording is refused as the same judgement in quieter language', () => {
      /*
        Without this, the instruction is satisfiable by paraphrase — which is
        exactly the post-processing the ruling forbids, performed by the model
        instead of by a later pass.
      */
      expect(PROMPT).toContain('DO NOT SOFTEN A CHARACTERISATION INTO ACCEPTABLE WORDING');
      expect(PROMPT).toMatch(/is the same judgement in\s+quieter language/);
    });
  });

  describe('FIXTURE 4 — SIGNIFICANCE LANGUAGE IS REJECTED FROM KEY FACTS', () => {
    it('the contract refuses SIGNIFICANCE in key facts', () => {
      expect(semanticsForField('keyFacts')?.refuses).toContain('SIGNIFICANCE');
    });

    it('and a GlobalNews AI characterisation is refused outright', () => {
      expect(PROMPT).toContain('GlobalNews AI CHARACTERISATION');
      expect(PROMPT).toMatch(/yours and must not appear here at all/);
    });
  });

  describe('FIXTURE 5 — EMPTY KEY FACTS REMAINS VALID', () => {
    it('an omitted entry is stated to be better than a mislabelled one', () => {
      expect(PROMPT).toMatch(/An empty dimension is an honest answer; a mislabelled one is not/);
    });

    it('no instruction pressures the model to fill key facts', () => {
      expect(PROMPT).not.toMatch(/always provide at least/i);
      expect(PROMPT).not.toMatch(/must not be empty/i);
    });
  });

  describe('CITATION GROUNDING WAS NOT WEAKENED', () => {
    it('every pre-existing grounding rule survives', () => {
      expect(PROMPT).toContain('Use only the supplied articles.');
      expect(PROMPT).toMatch(/evidenceIds/);
      expect(PROMPT).toMatch(/evidenceBasis/);
    });

    it('nothing permits inference', () => {
      expect(PROMPT).not.toMatch(/you may infer/i);
      expect(PROMPT).not.toMatch(/if uncertain, include it anyway/i);
    });

    it('the attribution instruction appears exactly once', () => {
      expect(PROMPT.split('ATTRIBUTION IS STRUCTURAL, NOT PROSE').length - 1).toBe(1);
    });
  });
});
