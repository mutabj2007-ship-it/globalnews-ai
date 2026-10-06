'use client';

import { ASK_QUESTION_MAX_CHARS, askQuestionLength } from '@globalnews-ai/shared';

/**
 * ASK RETRIEVAL / CONVERSATION R2 — THE ONE INPUT LIMIT, SAID BEFORE SUBMIT.
 *
 * Every Ask composer used `maxLength={1000}`, which made the browser drop the end of a pasted
 * research question without a word (Alpha 2026-10-06 06:36 UTC: the stored question was exactly
 * 1,000 characters, ending "Finish with three practica"). The textarea now accepts the whole
 * paste; this reads the draft against the shared documented limit (ASK_QUESTION_MAX_CHARS,
 * the same constant the backend enforces), keeps the full draft, disables Send while it is
 * over, and says so. Nothing is truncated anywhere.
 */
export const ASK_QUESTION_NEAR_FRACTION = 0.85;

export interface AskQuestionLimitState {
  readonly length: number;
  readonly max: number;
  readonly over: boolean;
  /** Close enough that the reader should see the count. */
  readonly near: boolean;
}

export function askQuestionLimitState(value: string): AskQuestionLimitState {
  const length = askQuestionLength(value.trim());
  return {
    length,
    max: ASK_QUESTION_MAX_CHARS,
    over: length > ASK_QUESTION_MAX_CHARS,
    near: length >= Math.floor(ASK_QUESTION_MAX_CHARS * ASK_QUESTION_NEAR_FRACTION),
  };
}

export interface AskQuestionLimitCopy {
  readonly questionTooLong: (max: number) => string;
  readonly questionLength: (length: number, max: number) => string;
}

/** Renders nothing until the draft is near the limit; over it, a polite live message. */
export function AskQuestionLimitNote({
  id,
  state,
  copy,
}: {
  readonly id: string;
  readonly state: AskQuestionLimitState;
  readonly copy: AskQuestionLimitCopy;
}): JSX.Element | null {
  if (!state.near && !state.over) return null;
  return (
    <p
      id={id}
      data-ask="question-limit"
      data-over={state.over ? 'true' : 'false'}
      role={state.over ? 'alert' : undefined}
      aria-live="polite"
      className={`text-[12px] leading-[1.35] ${state.over ? 'text-[#ffb4a8]' : 'text-[#9fb6cf]'}`}
    >
      {state.over
        ? `${copy.questionTooLong(state.max)} ${copy.questionLength(state.length, state.max)}`
        : copy.questionLength(state.length, state.max)}
    </p>
  );
}
