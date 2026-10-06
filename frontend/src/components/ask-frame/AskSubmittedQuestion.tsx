'use client';

import { useId, useState, type JSX } from 'react';

/**
 * ASK RETRIEVAL / CONVERSATION R2 — A LONG QUESTION IS NOT A GIANT HEADING.
 *
 * A submitted question was always the D25 question heading (21 / 26 / 30 px bold), so a
 * multi-paragraph research prompt became a wall of bold display text above its own answer on a
 * phone. An ordinary question keeps the D25 heading exactly. A long or multi-line one keeps its
 * heading semantics (it still names the turn for assistive technology) but renders at reading
 * size as a compact three-line preview, with an accessible control that reveals the complete
 * original — its own line breaks kept, nothing cut from the text itself.
 *
 * ASK READING EXPERIENCE R1 — the ordinary question is no longer a display heading either: the
 * callers pass the compact 17px question bubble (≤85% of the column, at the inline end), and the
 * long preview sits in the same bubble. Both keep their <h2>.
 */
export const LONG_QUESTION_CHARS = 180;

export function isLongQuestion(question: string): boolean {
  return question.length > LONG_QUESTION_CHARS || /\n/.test(question.trim());
}

export function AskSubmittedQuestion({
  question,
  headingClassName,
  showFullLabel,
  showLessLabel,
}: {
  readonly question: string;
  /** The D25 question heading class, used unchanged for an ordinary question. */
  readonly headingClassName: string;
  readonly showFullLabel: string;
  readonly showLessLabel: string;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  if (!isLongQuestion(question)) return <h2 className={headingClassName}>{question}</h2>;
  return (
    <div
      data-ask="submitted-question"
      data-long="true"
      className="mb-3 mt-1 ms-auto flex w-fit max-w-[85%] flex-col gap-1.5 rounded-[14px] border border-[var(--ask-read-line-soft,#0e2d4d)] bg-[var(--ask-read-sunk,#06223d)] px-4 py-2.5"
    >
      <h2
        id={textId}
        data-expanded={expanded ? 'true' : 'false'}
        className={`whitespace-pre-line break-words text-[1rem] font-semibold leading-[1.5] text-[var(--ask-read-ink,#fff)] ${
          expanded ? '' : 'line-clamp-3'
        }`}
      >
        {question}
      </h2>
      <button
        type="button"
        data-ask="show-full-question"
        aria-expanded={expanded}
        aria-controls={textId}
        onClick={() => setExpanded((open) => !open)}
        className="self-start rounded-[8px] py-1 text-[13px] font-semibold text-[var(--ask-read-control-ink,#7cc4f5)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ask-read-control-ink,#5abff5)]"
      >
        {expanded ? showLessLabel : showFullLabel}
      </button>
    </div>
  );
}
