'use client';

import type { JSX } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { STAGE_QUESTION_EVENT } from './homeRevaModel';

/**
 * HOME REV A — SUGGESTED INVESTIGATIONS (COMPONENTS.md; D4 ruling).
 *
 * D4: the questions are Home's EXISTING governed static suggestion copy
 * (`hero.exampleQuestions`, the same list the current Home rail shows). No AI
 * generation, no provider fetch, nothing dynamic invented.
 *
 * DENSITY / 60-SECONDS CORRECTION R2: the module follows the key elements
 * (Hero → 60 s → stories) and, where the content column is ≥1000 px, lays its
 * three questions out as one row.
 *
 * Pressing one FILLS the Hero composer (a local event) — it is staged, not
 * sent: nothing runs until the reader submits and then presses Send in Ask.
 */
export function SuggestedInvestigations({
  title,
  note,
  questions,
}: {
  title: string;
  note: string;
  questions: readonly string[];
}): JSX.Element | null {
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby="home-suggested-heading" data-home-suggested="" className="rounded-[14px] border border-[#122a45] bg-[#061527] p-4 md:p-[18px]">
      <h2 id="home-suggested-heading" className="text-[17px] font-bold text-white">
        {title}
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 [@container_home-content_(min-width:1000px)]:grid-cols-3">
        {questions.slice(0, 3).map((question) => (
          <li key={question}>
            <button
              type="button"
              data-home-suggestion=""
              onClick={() => window.dispatchEvent(new CustomEvent(STAGE_QUESTION_EVENT, { detail: { question } }))}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-[10px] border border-[#1b3a5a] bg-[#07182c] px-3 py-2 text-left text-[13.5px] font-semibold leading-snug text-white transition-colors hover:border-[#2f6ea8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] motion-reduce:transition-none"
            >
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#5abff5]" />
              <span className="min-w-0 flex-1">{question}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[12px] leading-snug text-[#8299b4]">{note}</p>
    </section>
  );
}
