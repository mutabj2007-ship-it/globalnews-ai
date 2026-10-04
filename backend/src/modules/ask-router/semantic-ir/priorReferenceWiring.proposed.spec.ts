import { interpretSemanticFirstTurn } from './semantic-first';
import type { ResolvedReferenceProjection, TurnInterpretationInput } from './interpret-turn';
import type { SemanticResolution } from './semantic-interpreter';
import { readInterpreterFirstContainer } from '../../ask-v2/conversation/conversation-state';
import { resolvePriorReference } from '../../ask-v2/conversation/prior-reference';
import type { PriorArtifact } from '../../ask-v2/conversation/conversation-artifact';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PROPOSED CORE WIRING — EVIDENCE ONLY. NOT PART OF CLAUDE F's APPLIED PATCH.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `semantic-first.ts`, `interpret-turn.ts`, `semantic-turn-ir.ts` and `semantic-interpreter.ts` are
 * Claude Code's files under D-4. This spec exists so the proposed diffs in
 * 04-F-IMPLEMENTATION-REPORT.md are not an untested suggestion: it demonstrates, on a real call to
 * the real composition, that C-3 closes with them and does not close without them.
 *
 * It lives on the throwaway `proposed/core-wiring` branch and is delivered as
 * `06-F-PROPOSED-CORE.diff`, never in `05-F-PATCH.diff`.
 */

const FR_ARTIFACT: PriorArtifact = {
  kind: 'RECOMMENDATION',
  label: 'Commencer par le pilote',
  components: ['risque plus faible', 'retour plus rapide', 'réversible', 'budget plus petit'],
  provenance: 'MODEL_REASONING',
  citable: false,
  sourceOperationId: 'op-0002',
};
const TURN = 'Pourquoi avez-vous dit que le pilote était un risque plus faible ?';

const verdict: SemanticResolution = {
  path: 'SEMANTIC',
  job: 'EXPLANATION',
  needsCurrentEvidence: false,
  depth: 'STANDARD',
  transformation: null,
  confidence: 'HIGH',
  temporalRole: 'NONE',
  relation: null,
  reference: 'ARTIFACT_PROPOSITION',
  objective: null,
};

const inputFor = (projection?: ResolvedReferenceProjection): TurnInterpretationInput =>
  ({
    reading: {
      originalQuestion: TURN,
      sourceLanguage: 'fr',
      normalizationLanguage: 'fr',
      displayLanguage: 'fr',
      origin: 'ASK',
      geography: [],
    },
    namedPlace: false,
    landedIntent: 'ASK',
    eligibleInheritedScope: false,
    mapOrStoryContext: false,
    personal: false,
    hasResolvedArticleAnchor: false,
    resolution: verdict,
    ...(projection === undefined ? {} : { priorReference: projection }),
  }) as unknown as TurnInterpretationInput;

describe('PROPOSED · the five interpreter-first languages can reference their own earlier work', () => {
  it('WITHOUT the container and the resolver, the reference is still erased (the measured C-3)', () => {
    const { ir, decision } = interpretSemanticFirstTurn(inputFor());
    /* the interpreter named a target, and the composition discards it because state looked empty */
    expect(verdict.reference).toBe('ARTIFACT_PROPOSITION');
    expect(decision.job.discourseReference).toBe('NONE');
    expect(ir.references.target).toBe('NONE');
  });

  it('WITH them, it resolves — and carries the turn that produced the work', () => {
    const container = readInterpreterFirstContainer('fr', [], [FR_ARTIFACT])!;
    expect(container.artifactSourceOperationId).toBe('op-0002');

    const outcome = resolvePriorReference({
      turn: TURN,
      artifacts: container.artifacts,
      pointsBack: { kind: 'INTERPRETER', target: 'ARTIFACT_PROPOSITION' },
    });
    expect(outcome.state).toBe('RESOLVED');
    if (outcome.state !== 'RESOLVED') throw new Error('unreachable');
    expect(outcome.resolved.sourceOperationId).toBe('op-0002');
    expect(outcome.resolved.component).toBe('risque plus faible');

    const { ir, decision } = interpretSemanticFirstTurn(
      inputFor({
        resolved: true,
        target: outcome.resolved.target,
        sourceOperationId: outcome.resolved.sourceOperationId,
        needsInterpretation: false,
        unresolvable: false,
      }),
    );
    expect(decision.job.discourseReference).toBe('PRIOR_WORK');
    expect(ir.references.target).toBe('ARTIFACT_PROPOSITION');
    /* and it is NOT a request for current evidence */
    expect(decision.job.freshness).toBe('NONE');
    expect(ir.turn.freshness).toBe('NONE');
    expect(decision.currentEvidenceNeeded).toEqual([]);
  });

  it('an UNRESOLVABLE reference is not promoted to a reference, and asks nothing of the news', () => {
    const { ir, decision } = interpretSemanticFirstTurn(
      inputFor({
        resolved: false,
        target: 'NONE',
        needsInterpretation: false,
        unresolvable: true,
      }),
    );
    expect(decision.job.discourseReference).toBe('NONE');
    expect(ir.references.target).toBe('NONE');
    expect(decision.currentEvidenceNeeded).toEqual([]);
  });

  it('NEEDS_INTERPRETATION escalates: PRIOR_WORK_REFERENCE enters the unresolved fields', () => {
    const { ir } = interpretSemanticFirstTurn(
      inputFor({
        resolved: false,
        target: 'NONE',
        needsInterpretation: true,
        unresolvable: false,
      }),
    );
    expect(ir.resolution.unresolvedFields).toContain('PRIOR_WORK_REFERENCE');
  });
});
