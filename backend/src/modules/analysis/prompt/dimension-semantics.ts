/**
 * ════════════════════════════════════════════════════════════════════════════
 * ANALYSIS-DIMENSION-SEMANTIC-CONTRACT-1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling, Checkpoint J: *"Do not fix these as cosmetic frontend text. Trace
 * generation prompt → structured model schema → parser → normalization →
 * rendered dimension. Correct the semantic contract."*
 *
 * ─── WHAT WAS TRACED, AND WHERE THE DEFECT IS NOT ─────────────────────────
 *
 * The chain is intact at every layer below the prompt:
 *
 *   schema      `affectedParties` carries party / partyType / effect as
 *               separate fields; `immediateImpacts` is a SourcedClaim[].
 *   parser      `validateAffectedParties` and `validateSourcedClaims` preserve
 *               every entry that is grounded, and cap the count.
 *   render      `buildDimensionClaims` maps each dimension to exactly one
 *               field: relevance, affectedParties, immediateImpacts, keyFacts.
 *
 * Nothing drops, renames or flattens these on the way out. **The defect is in
 * the prompt**, and it is a definitional one.
 *
 * ─── THE DEFECT: POSITIVE DEFINITIONS WITH NO CONTRAST CLASS ──────────────
 *
 * The instruction for `affectedParties` said "identify … the supplied evidence
 * EXPLICITLY describes as affected". That is correct as far as it goes, and it
 * goes nowhere near far enough, because it never says what is NOT an affected
 * party. In news prose the subject of a sentence is almost always the ACTOR —
 * "Poland implements policy", "Russia issues threats" — so the most salient
 * entities are the ones DOING things. Asked for "entities the evidence
 * describes as affected", with no contrast, a model returns the entities the
 * evidence is most obviously ABOUT.
 *
 * Measured output, all four of them actors performing actions:
 *
 *     Poland implementing policy          — an actor, and an action
 *     Defence Ministry strengthening security — an actor, and a response
 *     Orlen seeking supplies              — an actor, and a response
 *     Russia issuing threats              — an actor, and an action
 *
 * `immediateImpacts` fails the same way for the same reason. "Direct,
 * already-occurring effects" with no contrast class returns DEVELOPMENTS:
 *
 *     tax proposal revived                — a development
 *     border security enhanced            — a response
 *     Orlen seeking crude alternatives    — a response
 *
 * ─── WHY THE FIX IS A CONTRAST CLASS AND NOT A STERNER ADJECTIVE ──────────
 *
 * Adding "truly" or "genuinely" to an instruction the model already believes it
 * is following changes nothing. What the model lacks is the DISTINCTION, so
 * what the prompt must supply is the distinction: for each dimension, what it
 * is, what it is NOT, and a worked example of the confusion being refused.
 *
 * The seven classes below are that distinction, declared once here so the
 * prompt cannot drift from what the UI renders and a test can assert both.
 */

/**
 * The seven semantic classes an analysis dimension may carry. They are NOT a
 * hierarchy and NOT interchangeable; each answers a different question about
 * the same event.
 */
export type AnalysisSemanticClass =
  /** What is established to have happened. Answers: what is true? */
  | 'FACT'
  /** An entity that DID something. Answers: who acted? */
  | 'ACTOR'
  /** Something an actor did. Answers: what was done? */
  | 'ACTION'
  /** An action taken BECAUSE of something else. Answers: what was done back? */
  | 'RESPONSE'
  /** An entity something HAPPENED TO. Answers: who bears the consequence? */
  | 'AFFECTED_PARTY'
  /** A consequence that has already landed on someone or something. */
  | 'EFFECT'
  /** Why the event matters. Answers: what is the magnitude or the stake? */
  | 'SIGNIFICANCE';

export interface DimensionSemantics {
  /** The response field this governs. */
  readonly field: string;
  /** The UI dimension it renders as, so the two cannot silently diverge. */
  readonly renderedAs: string;
  readonly carries: AnalysisSemanticClass;
  /** The classes most often mistaken for it — the whole point of this module. */
  readonly refuses: readonly AnalysisSemanticClass[];
  /** One sentence the model can apply, phrased as a test rather than a label. */
  readonly test: string;
  /** A worked refusal drawn from the measured failures above. */
  readonly example: { readonly rejected: string; readonly because: string };
}

export const ANALYSIS_DIMENSION_SEMANTICS: readonly DimensionSemantics[] = [
  {
    field: 'affectedParties',
    renderedAs: 'Who is affected',
    carries: 'AFFECTED_PARTY',
    refuses: ['ACTOR', 'ACTION', 'RESPONSE'],
    test:
      'Something in the evidence must HAPPEN TO this entity. An entity that only ' +
      'decides, announces, implements, seeks, threatens or responds is an ACTOR, ' +
      'and an actor is not an affected party merely by being prominent.',
    example: {
      rejected: 'Poland implementing policy',
      because:
        'Poland is the one acting. Naming the actor answers "who did this", not ' +
        '"who is affected". If the evidence also states a consequence Poland bears, ' +
        'the entry must state THAT consequence rather than the action.',
    },
  },
  {
    field: 'immediateImpacts',
    renderedAs: 'Immediate effects',
    carries: 'EFFECT',
    refuses: ['FACT', 'ACTION', 'RESPONSE'],
    test:
      'An effect is a consequence ON someone or something, caused by the event. ' +
      'A DEVELOPMENT is something that happened; a RESPONSE is something an actor ' +
      'chose to do about it. Neither is an effect, however recent or important.',
    example: {
      rejected: 'tax proposal revived',
      because:
        'That is the development itself, not a consequence of it. The effect would ' +
        'be what the revival has already done to someone — a cost borne, an ' +
        'activity halted, a price moved — and only if the evidence states it.',
    },
  },
  {
    field: 'relevance',
    renderedAs: 'Why this matters',
    carries: 'SIGNIFICANCE',
    refuses: ['FACT', 'ACTION'],
    test:
      'This states the STAKE — why the reader should care — grounded in what the ' +
      'evidence says about scale, precedent, dependency or risk. Restating what ' +
      'happened is a fact, not a reason it matters.',
    example: {
      rejected: 'The ministry published new figures',
      because:
        'That is the fact. Why it matters would be what the figures change, whom ' +
        'they bind, or what they make possible — if the evidence says so.',
    },
  },
  {
    field: 'keyFacts',
    renderedAs: 'Key facts',
    carries: 'FACT',
    refuses: ['SIGNIFICANCE'],
    test:
      'A fact is what the evidence establishes as true. Keep the distinction ' +
      'between a SOURCED STATEMENT, a REPORTED THREAT or claim, and a ' +
      'GlobalNews AI CHARACTERISATION — the first is what a source states, the ' +
      'second is what a source reports someone else asserting, and the third is ' +
      'yours and must not appear here at all.',
    example: {
      rejected: 'This is the most serious escalation in years',
      because:
        'Unless a source states it, that is a characterisation. It may belong in ' +
        'significance, attributed — never in key facts as though established.',
    },
  },
];

/** Lookup by response field, so a caller cannot mistype a dimension name. */
export function semanticsForField(field: string): DimensionSemantics | undefined {
  return ANALYSIS_DIMENSION_SEMANTICS.find((entry) => entry.field === field);
}

/**
 * Renders the contract as prompt text.
 *
 * Built from the declaration rather than written twice, so the instruction the
 * model receives and the contract the tests assert are the SAME OBJECT. A
 * prompt that drifted from the declared taxonomy is exactly the failure this
 * module exists to make impossible.
 */
export function renderDimensionSemanticsInstruction(): string {
  const lines: string[] = [
    '- DIMENSION SEMANTICS. These four dimensions answer DIFFERENT questions and',
    '  are not interchangeable. The most common failure is returning the entity a',
    '  story is ABOUT, or the event itself, instead of the thing the dimension',
    '  actually asks for. For each one, the refusal test matters as much as the',
    '  definition:',
  ];

  for (const entry of ANALYSIS_DIMENSION_SEMANTICS) {
    lines.push(
      `  * "${entry.field}" (shown to the reader as "${entry.renderedAs}") carries` +
        ` ${entry.carries} and must NOT contain ${entry.refuses.join(', ')}.`,
      `    ${entry.test}`,
      `    Example of what to REJECT: "${entry.example.rejected}" — ${entry.example.because}`,
    );
  }

  lines.push(
    '  If an entry would only satisfy a dimension by loosening one of these tests,',
    '  omit it. An empty dimension is an honest answer; a mislabelled one is not.',
  );

  return lines.join('\n');
}
