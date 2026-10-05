import { Injectable } from '@nestjs/common';
import type { StoryBriefConclusion, StoryBriefFailureKind } from './story-brief.rules';

/**
 * EA-STORY-BRIEF-01 — the ONE seam through which a Story Brief may be generated.
 *
 * The input is the canonical story's EVIDENCE only: no reader text, no discussion content (a
 * structure spec pins both), no browser state. The requester is passed so a governed
 * implementation can run the compute under the requester's ComputeOperation (quota, consent,
 * ledger, breaker); it is never stored on the Brief.
 */
export interface StoryBriefEvidenceInput {
  readonly storyId: string;
  readonly evidenceRevision: string;
  readonly materialVersion: number;
  readonly articleRefs: readonly string[];
}

export interface StoryBriefRequester {
  readonly userId: string;
}

export type StoryBriefGeneration =
  | {
      readonly outcome: 'CONCLUDED';
      readonly state: StoryBriefConclusion;
      /** briefing-blocks/1 (summary, keyFacts, …, intelligence = payload.intelligence). */
      readonly blocks: Record<string, unknown>;
      /** References only — never publisher full text. */
      readonly evidenceRefs: readonly Record<string, unknown>[];
      readonly coverageGaps: readonly string[];
      readonly uncertainty: readonly string[];
      readonly asOf: Date;
      readonly operationId: string | null;
    }
  | {
      readonly outcome: 'FAILED';
      readonly failureKind: Exclude<StoryBriefFailureKind, 'OUTCOME_UNKNOWN'>;
      readonly failureCode: string;
      readonly operationId: string | null;
    };

export interface StoryBriefGenerator {
  /** Reported to readers so no surface offers a Read Brief that cannot run. */
  readonly available: boolean;
  generate(input: StoryBriefEvidenceInput, requester: StoryBriefRequester): Promise<StoryBriefGeneration>;
}

export const STORY_BRIEF_GENERATOR = Symbol('STORY_BRIEF_GENERATOR');

/**
 * THE R1 PRODUCTION BINDING — generation is NOT AUTHORIZED yet.
 *
 * A shared Brief generated once and reopened free by every reader is NEW provider spend whose
 * owner (requesting account vs product pool), guest eligibility and refresh limit are an open
 * CTO/PO decision (STORY-BRIEF-CONTRACT §8; the implementation contract forbids new spend
 * without approval). Until then every attempt is recorded honestly as CAPABILITY_UNAVAILABLE,
 * nothing is spent, and `available: false` tells surfaces not to offer it.
 */
@Injectable()
export class UnavailableStoryBriefGenerator implements StoryBriefGenerator {
  readonly available = false;

  async generate(): Promise<StoryBriefGeneration> {
    return {
      outcome: 'FAILED',
      failureKind: 'CAPABILITY_UNAVAILABLE',
      failureCode: 'STORY_BRIEF_GENERATION_NOT_AUTHORIZED',
      operationId: null,
    };
  }
}
