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
    <div data-ask="submitted-question" data-long="true" className="mb-3 mt-2.5 flex flex-col gap-1.5">
      <h2
        id={textId}
        data-expanded={expanded ? 'true' : 'false'}
        className={`whitespace-pre-line break-words text-[16px] font-semibold leading-[1.5] text-white ${
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
        className="self-start rounded-[8px] py-1 text-[13px] font-semibold text-[#7cc4f5] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5abff5]"
      >
        {expanded ? showLessLabel : showFullLabel}
      </button>
    </div>
  );
}
