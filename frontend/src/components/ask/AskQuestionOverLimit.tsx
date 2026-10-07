import type { JSX } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askFormatCount } from '@/lib/ask/askDirection';
import {
  ASK_QUESTION_MAX_CHARS,
  askQuestionLength,
  askQuestionOverLimit,
} from '@/lib/ask/askQuestionLength';

/**
 * H PROD-1 — the over-limit state, shared by the main Ask composer and the dock composer so the
 * two cannot disagree. Rendered ONLY past the bound: under it the composer looks exactly as it
 * did. The count is numerals in the reader's own number format (`1 001 / 1 000`), so it needs no
 * wording; the one governed sentence says what the limit is. `role="alert"` announces the state
 * once when it appears, and the textarea points at it through `aria-describedby`.
 */
export function AskQuestionOverLimit({
  id,
  draft,
  locale,
  message,
  toneClassName,
}: {
  /** Referenced by the composer textarea's `aria-describedby`. */
  readonly id: string;
  readonly draft: string;
  readonly locale: DisplayLocale;
  /** `askR2Strings.questionOverLimit`, already resolved for the reader's locale. */
  readonly message: (limit: number) => string;
  /** The text colour of the surface it sits on: the Ask reading tokens, or the dock's theme. */
  readonly toneClassName: string;
}): JSX.Element | null {
  if (!askQuestionOverLimit(draft)) return null;
  return (
    <p
      id={id}
      data-ask="question-over-limit"
      role="alert"
      className={`flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] leading-[1.4] ${toneClassName}`}
    >
      <span data-ask="question-length" className="font-semibold tabular-nums">
        {askFormatCount(askQuestionLength(draft), locale)} / {askFormatCount(ASK_QUESTION_MAX_CHARS, locale)}
      </span>
      <span>{message(ASK_QUESTION_MAX_CHARS)}</span>
    </p>
  );
}
