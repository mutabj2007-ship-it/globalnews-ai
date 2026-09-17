import { buildAnalysisMessages } from './build-analysis-prompt.util';
import {
  ANALYSIS_DIMENSION_SEMANTICS,
  renderDimensionSemanticsInstruction,
  semanticsForField,
  type AnalysisSemanticClass,
} from './dimension-semantics';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANALYSIS-DIMENSION-SEMANTIC-CONTRACT-1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling, Checkpoint J: *"Do not fix these as cosmetic frontend text. Trace
 * generation prompt → structured model schema → parser → normalization →
 * rendered dimension. Correct the semantic contract."*
 *
 * ─── WHERE THE DEFECT IS NOT ──────────────────────────────────────────────
 *
 * The chain below the prompt is intact. The schema keeps party / partyType /
 * effect as separate fields; `validateAffectedParties` and
 * `validateSourcedClaims` preserve every grounded entry; `buildDimensionClaims`
 * maps each UI dimension to exactly one response field. Nothing drops, renames
 * or flattens these on the way out.
 *
 * ─── WHERE IT IS ──────────────────────────────────────────────────────────
 *
 * The prompt defined each dimension POSITIVELY ONLY. "Entities the evidence
 * describes as affected", with no statement of what is NOT an affected party,
 * returns the entities the evidence is most obviously ABOUT — and in news prose
 * the subject of a sentence is almost always the ACTOR.
 *
 * These tests assert the CONTRAST CLASSES reach the model, because a sterner
 * adjective on an instruction the model already believes it is following would
 * change nothing.
 */

/*
  The SYSTEM prompt is where the dimension rules live. Built through the real
  composition path rather than by reading the file, so a rule that existed in
  source but never reached a request would fail here.
*/
const ARTICLES = [
  {
    id: "a1",
    title: "Poland revives tax proposal",
    summary: "The ministry confirmed the proposal returns to committee.",
    url: "https://example.com/a1",
    sourceId: "src",
    sourceName: "Source",
    category: "world",
    sourcesCount: 1,
    publishedAt: "2026-09-15T00:00:00.000Z",
  },
] as never;

const PROMPT = buildAnalysisMessages("What is happening in Poland?", ARTICLES, 1200).system;

describe('J — the dimension semantic contract', () => {
  describe('THE TAXONOMY IS DECLARED, NOT IMPLIED', () => {
    it('covers the four dimensions the ruling names', () => {
      expect(ANALYSIS_DIMENSION_SEMANTICS.map((d) => d.field).sort()).toEqual([
        'affectedParties',
        'immediateImpacts',
        'keyFacts',
        'relevance',
      ]);
    });

    it('each dimension names what it carries AND what it refuses', () => {
      for (const entry of ANALYSIS_DIMENSION_SEMANTICS) {
        expect(entry.carries).toBeTruthy();
        expect(entry.refuses.length).toBeGreaterThan(0);
        expect(entry.refuses).not.toContain(entry.carries);
      }
    });

    it('every dimension declares the UI label it renders as, so the two cannot drift', () => {
      expect(semanticsForField('affectedParties')?.renderedAs).toBe('Who is affected');
      expect(semanticsForField('immediateImpacts')?.renderedAs).toBe('Immediate effects');
      expect(semanticsForField('relevance')?.renderedAs).toBe('Why this matters');
      expect(semanticsForField('keyFacts')?.renderedAs).toBe('Key facts');
    });

    it('the seven classes the ruling lists are all expressible', () => {
      const classes: readonly AnalysisSemanticClass[] = [
        'FACT',
        'ACTOR',
        'ACTION',
        'RESPONSE',
        'AFFECTED_PARTY',
        'EFFECT',
        'SIGNIFICANCE',
      ];

      /* Type-level assertion: this compiles only if every class is a member. */
      expect(classes).toHaveLength(7);
    });

    it('each dimension carries a worked refusal, not only a definition', () => {
      for (const entry of ANALYSIS_DIMENSION_SEMANTICS) {
        expect(entry.example.rejected.length).toBeGreaterThan(0);
        expect(entry.example.because.length).toBeGreaterThan(0);
      }
    });
  });

  describe('WHO IS AFFECTED — AN ACTOR IS NOT AN AFFECTED PARTY', () => {
    const affected = semanticsForField('affectedParties');

    it('carries AFFECTED_PARTY and refuses ACTOR, ACTION and RESPONSE', () => {
      expect(affected?.carries).toBe('AFFECTED_PARTY');
      expect(affected?.refuses).toEqual(expect.arrayContaining(['ACTOR', 'ACTION', 'RESPONSE']));
    });

    it('the refusal reaches the prompt in words the model can apply', () => {
      expect(PROMPT).toContain('AN ACTOR IS NOT AN AFFECTED PARTY');
      expect(PROMPT).toMatch(/must\s+HAPPEN TO the entity you list/);
    });

    it('the prompt names the verbs that indicate acting rather than being affected', () => {
      /*
        The measured failures were all of this shape: decides, announces,
        implements, seeks, threatens, responds.
      */
      for (const verb of ['decides', 'announces', 'implements', 'seeks', 'threatens', 'responds']) {
        expect(PROMPT).toContain(verb);
      }
    });

    it('prominence is explicitly refused as a qualification', () => {
      expect(PROMPT).toMatch(/being the most\s+prominent name in the story does not make it affected/);
    });

    it('an actor who ALSO bears a consequence must state the consequence', () => {
      /*
        Without this the instruction would simply exclude every government from
        a story about a government, which is the opposite failure.
      */
      expect(PROMPT).toMatch(/must state the CONSEQUENCE IT BEARS, never the action it took/);
    });
  });

  describe('IMMEDIATE EFFECTS — A DEVELOPMENT IS NOT AN EFFECT', () => {
    const impacts = semanticsForField('immediateImpacts');

    it('carries EFFECT and refuses FACT, ACTION and RESPONSE', () => {
      expect(impacts?.carries).toBe('EFFECT');
      expect(impacts?.refuses).toEqual(expect.arrayContaining(['FACT', 'ACTION', 'RESPONSE']));
    });

    it('the refusal reaches the prompt, naming both confusions', () => {
      expect(PROMPT).toContain('A DEVELOPMENT IS NOT AN EFFECT, AND NEITHER IS A RESPONSE');
    });

    it('an effect is defined as a consequence ON something', () => {
      expect(PROMPT).toMatch(/An effect is\s+a consequence ON someone or something/);
    });

    it('recency and importance are explicitly refused as qualifications', () => {
      expect(PROMPT).toMatch(/however recent or important either is/);
    });

    it('an empty array is stated to be the correct answer when no consequence is evidenced', () => {
      expect(PROMPT).toMatch(/this\s+array is empty, and that is the correct answer/);
    });
  });

  describe('KEY FACTS — THE THREE KINDS OF STATEMENT STAY APART', () => {
    it('the sourced / reported / characterisation distinction is preserved', () => {
      const keyFacts = semanticsForField('keyFacts');

      expect(keyFacts?.test).toMatch(/SOURCED STATEMENT/);
      expect(keyFacts?.test).toMatch(/REPORTED THREAT/);
      expect(keyFacts?.test).toMatch(/CHARACTERISATION/);
      expect(PROMPT).toContain('GlobalNews AI CHARACTERISATION');
    });

    it("a GlobalNews AI characterisation is refused from key facts outright", () => {
      expect(PROMPT).toMatch(/yours and must not appear here at all/);
    });
  });

  describe('THE PROMPT AND THE CONTRACT ARE THE SAME OBJECT', () => {
    it('the instruction is rendered FROM the declaration, not written twice', () => {
      const rendered = renderDimensionSemanticsInstruction();

      for (const entry of ANALYSIS_DIMENSION_SEMANTICS) {
        expect(rendered).toContain(entry.field);
        expect(rendered).toContain(entry.renderedAs);
        expect(rendered).toContain(entry.test);
        expect(rendered).toContain(entry.example.rejected);
      }
    });

    it('and that rendered instruction is actually in the prompt', () => {
      expect(PROMPT).toContain(renderDimensionSemanticsInstruction());
    });

    it('it appears exactly once — no composition path duplicates it', () => {
      const marker = '- DIMENSION SEMANTICS.';

      expect(PROMPT.split(marker).length - 1).toBe(1);
    });

    it('an omitted entry is stated to be better than a mislabelled one', () => {
      expect(PROMPT).toMatch(/An empty dimension is an honest answer; a mislabelled one is not/);
    });
  });

  describe('NOTHING PRE-EXISTING WAS WEAKENED', () => {
    it('the evidence-grounding rules survive verbatim', () => {
      expect(PROMPT).toContain('never inferred');
      expect(PROMPT).toMatch(/exact same evidenceIds\/evidenceBasis rules as\s+keyFacts/);
    });

    it('the caps are unchanged', () => {
      expect(PROMPT).toMatch(/up to 6 people, organizations/);
      expect(PROMPT).toMatch(/up to 4 direct, already-occurring/);
    });

    it('the empty-array escape is still offered for every dimension', () => {
      expect(PROMPT).toMatch(/Return an empty array if the evidence does\s+not identify specific affected parties/);
      expect(PROMPT).toMatch(/Return an\s+empty array if the evidence does not state any direct effect/);
    });

    it('no evidence threshold was lowered anywhere in this change', () => {
      /* The ruling protects these; the fix is definitional, not permissive. */
      expect(PROMPT).not.toMatch(/you may infer/i);
      expect(PROMPT).not.toMatch(/if uncertain, include it anyway/i);
    });
  });
});
