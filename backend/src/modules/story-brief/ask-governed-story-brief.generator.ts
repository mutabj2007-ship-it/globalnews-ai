import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AskV2Service } from '../ask-v2/ask-v2.service';
import { accountPrincipal } from '../ask-v2/guest/ask-principal';
import { briefingSnapshotOf } from '../ask-v2/briefings/briefing-snapshot';
import type { QuoteTurnDto } from '../ask-v2/ask-v2.dto';
import type {
  StoryBriefEvidenceInput,
  StoryBriefGeneration,
  StoryBriefGenerator,
  StoryBriefRequester,
} from './story-brief.generator';
import type { StoryBriefConclusion, StoryBriefFailureKind } from './story-brief.rules';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * EA-STORY-BRIEF-01 — STORY BRIEF GENERATION THROUGH THE GOVERNED ASK PATH (CTO §3)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * NOT a second AI execution path. A signed-in reader's explicit Read Brief / refresh runs ONE
 * ordinary Ask V2 operation under THAT reader's account principal, with STORY context for the
 * canonical story's founding article: the same router, context resolver (retained article only),
 * execution adapter, compute meter / budgets / breaker, ledger and StoredResult as any Ask turn.
 * Its stored result is projected by the SAME briefing snapshot a saved Briefing uses, so the
 * Brief's blocks / evidence refs / payload.intelligence have exactly the Ask shapes.
 *
 * The question is a fixed, system-composed sentence: no reader text and no discussion content
 * ever reach the run. The turn lives in the requester's own Ask history (their compute, their
 * record); the shared Brief stores no requester identity (lineage = operation id only).
 * Guests never reach this class: POST /stories/:id/brief is signed-in only.
 */
export const STORY_BRIEF_QUESTION =
  'Brief me on this story in 60 to 100 words, as three or four short points: what happened; why it matters locally; ' +
  'who may be affected; and what to watch or verify next. Say plainly what the current reporting does not yet establish.';

/** Ask answer states that are a conclusion, and which conclusion. */
const CONCLUSION_OF: Readonly<Record<string, StoryBriefConclusion>> = {
  CURRENTLY_VERIFIED: 'READY',
  CURRENT_REPORTING: 'READY',
  /* CURRENT-REPORTING TRUTH R1 — a produced brief from retained reporting is a conclusion, as before */
  RETAINED_REPORTING: 'READY',
  RETAINED_RECORD: 'READY',
  COMPUTED_RESULT: 'READY',
  REFERENCE_BACKGROUND: 'READY',
  PARTIAL: 'PARTIAL',
  INSUFFICIENT: 'INSUFFICIENT',
};

/** A governed refusal / failure code → the Brief attempt's failure kind (never INSUFFICIENT). */
export function failureKindOf(code: string | null | undefined): Exclude<StoryBriefFailureKind, 'OUTCOME_UNKNOWN'> {
  const c = code ?? '';
  if (/^BUDGET_/.test(c)) return 'BUDGET_REFUSED';
  if (/^(MODEL_|CIRCUIT_)/.test(c)) return 'PROVIDER_DEGRADED';
  if (/^(ASK_R2_DISABLED|ASK_PUBLIC_COMPUTE_DISABLED|ASK_EXECUTION_PORT_NOT_BOUND)/.test(c)) return 'CAPABILITY_UNAVAILABLE';
  return 'EXECUTION_FAILED';
}

type OperationView = Awaited<ReturnType<AskV2Service['getOperation']>>;

@Injectable()
export class AskGovernedStoryBriefGenerator implements StoryBriefGenerator {
  constructor(
    private readonly ask: AskV2Service,
    private readonly config: ConfigService,
  ) {}

  /** Configured: the Ask V2 deployment literal. A runtime refusal is still recorded honestly. */
  get available(): boolean {
    return this.config.get<string>('ASK_V2_ENABLED') === 'true';
  }

  async generate(input: StoryBriefEvidenceInput, requester: StoryBriefRequester): Promise<StoryBriefGeneration> {
    if (!this.available) {
      return { outcome: 'FAILED', failureKind: 'CAPABILITY_UNAVAILABLE', failureCode: 'ASK_V2_DISABLED', operationId: null };
    }
    const p = accountPrincipal(requester.userId);
    let view: OperationView;
    try {
      /* One Ask thread per (reader, story); one governed turn per Brief attempt. */
      const thread = await this.ask.createThread(p, { idempotencyKey: `story-brief:${input.storyId}`, language: 'en' });
      const quote: QuoteTurnDto = {
        idempotencyKey: `story-brief:${input.attemptId}`,
        question: STORY_BRIEF_QUESTION,
        language: 'en',
        intent: 'ask',
        context: { kind: 'STORY', articleRef: input.leadArticle.articleRef, url: input.leadArticle.articleUrl } as QuoteTurnDto['context'],
      };
      view = await this.ask.quote(p, thread.id, quote);
      /* The reader's explicit Read Brief IS the consent; the governed lifecycle still applies. */
      if (view.requiresAcceptance) {
        if (view.status === 'QUOTED') view = await this.ask.accept(p, view.operationId);
        if (view.status === 'ACCEPTED') view = await this.ask.reserve(p, view.operationId);
      }
      if (!['COMPLETED', 'RELEASED', 'REFUNDED'].includes(view.status)) {
        view = await this.ask.execute(p, view.operationId);
      }
    } catch (error) {
      const code = (error as { code?: string; message?: string })?.code ?? (error as Error)?.message ?? 'EXECUTION_FAILED';
      return { outcome: 'FAILED', failureKind: failureKindOf(code), failureCode: String(code).slice(0, 120), operationId: null };
    }
    return this.project(view);
  }

  /** The governed operation's outcome → a Brief conclusion or a named failure. */
  project(view: OperationView): StoryBriefGeneration {
    const operationId = view.operationId;
    if (view.status !== 'COMPLETED' || view.result === null) {
      const code = view.failureCode ?? `OPERATION_${view.status}`;
      return { outcome: 'FAILED', failureKind: failureKindOf(code), failureCode: code, operationId };
    }
    const payload = view.result.payload as { answer?: { state?: unknown } } | null;
    const answerState = typeof payload?.answer?.state === 'string' ? payload.answer.state : null;
    const snapshot = briefingSnapshotOf(view.result.payload);
    if (answerState === 'CAPABILITY_UNAVAILABLE') {
      return { outcome: 'FAILED', failureKind: 'CAPABILITY_UNAVAILABLE', failureCode: 'ANSWER_CAPABILITY_UNAVAILABLE', operationId };
    }
    if (answerState === 'CLARIFICATION_REQUIRED') {
      return { outcome: 'FAILED', failureKind: 'EXECUTION_FAILED', failureCode: 'ANSWER_CLARIFICATION_REQUIRED', operationId };
    }
    /* A completed run with no sourced answer is a CONCLUSION about the evidence: insufficient. */
    const state: StoryBriefConclusion =
      snapshot === null ? 'INSUFFICIENT' : (CONCLUSION_OF[answerState ?? ''] ?? 'PARTIAL');
    return {
      outcome: 'CONCLUDED',
      state,
      blocks: (snapshot?.blocks ?? { schema: 'briefing-blocks/1', answerState, summary: null }) as unknown as Record<string, unknown>,
      evidenceRefs: (snapshot?.evidenceRefs ?? []) as unknown as Record<string, unknown>[],
      coverageGaps: snapshot?.coverageGaps ?? ['NO_SOURCED_ANSWER'],
      uncertainty: [],
      asOf: new Date(snapshot?.asOf ?? Date.now()),
      operationId,
    };
  }
}
