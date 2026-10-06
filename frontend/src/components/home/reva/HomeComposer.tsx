'use client';

import { ASK_INPUT_MAX_CHARS } from '@globalnews-ai/shared';
import type { FormEvent, JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MessagesSquare } from 'lucide-react';
import { openGlobalAsk } from '@/lib/ask/openGlobalAsk';
import { HERO_COMPOSER_ID, STAGE_QUESTION_EVENT, fill } from './homeRevaModel';

/**
 * HOME REV A — THE ONE PRIMARY ASK COMPOSER (COMPONENTS.md "Hero Ask composer").
 *
 * 64 px pill (56 phone), 17 px input (16 phone: no iOS zoom), Ask button.
 *
 * BEHAVIOUR IS PRESERVED, NOT REDESIGNED: typing and focus are local (0 AI);
 * submitting stages the question in Ask through the SAME `openGlobalAsk()`
 * hand-off the current Home composer uses — nothing runs until the reader
 * presses Send there. The status line is always visible and says exactly that;
 * after a submit it names the staged question.
 *
 * Suggested investigations fill this composer through STAGE_QUESTION_EVENT
 * (a local event, 0 AI, 0 provider).
 */
export function HomeComposer({
  placeholder,
  ariaLabel,
  askLabel,
  note,
  stagedTemplate,
}: {
  placeholder: string;
  ariaLabel: string;
  askLabel: string;
  note: string;
  stagedTemplate: string;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [staged, setStaged] = useState<string | null>(null);

  useEffect(() => {
    const onStage = (event: Event): void => {
      const question = (event as CustomEvent<{ question?: string }>).detail?.question;
      const input = inputRef.current;
      if (input === null || typeof question !== 'string') return;
      input.value = question;
      document.getElementById(HERO_COMPOSER_ID)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input.focus({ preventScroll: true });
    };
    window.addEventListener(STAGE_QUESTION_EVENT, onStage);
    return () => window.removeEventListener(STAGE_QUESTION_EVENT, onStage);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const draft = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    if (draft.length === 0) {
      inputRef.current?.focus();
      return;
    }
    openGlobalAsk(draft);
    setStaged(draft);
    event.currentTarget.reset();
  };

  return (
    <div id={HERO_COMPOSER_ID} className="mt-6 w-full max-w-[560px] scroll-mt-24">
      <form
        role="search"
        aria-label={ariaLabel}
        onSubmit={submit}
        className="flex h-[56px] items-center gap-2 rounded-full border border-[#1f4f82] bg-[linear-gradient(180deg,#0b2240_0%,#081a33_100%)] pl-4 pr-[5px] shadow-[inset_0_1px_0_rgba(150,200,255,0.10),0_18px_40px_-24px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] focus-within:border-[#5abff5] focus-within:shadow-[0_0_0_3px_rgba(90,191,245,0.18)] motion-reduce:transition-none md:h-[64px] md:pl-5 md:pr-[7px]"
      >
        <MessagesSquare aria-hidden="true" className="h-5 w-5 shrink-0 text-[#8fb3d4]" />
        <input
          ref={inputRef}
          name="q"
          type="text"
          autoComplete="off"
          maxLength={ASK_INPUT_MAX_CHARS}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={`${HERO_COMPOSER_ID}-status`}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-[#7e99ba] md:text-[17px]"
        />
        <button
          type="submit"
          className="inline-flex h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-[#0a6bd6] px-4 text-[14.5px] font-bold text-white transition-colors hover:bg-[#1479e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5abff5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081a33] motion-reduce:transition-none md:h-[50px] md:px-5"
        >
          {askLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>
      <p id={`${HERO_COMPOSER_ID}-status`} role="status" className="mt-2 px-1 text-[12.5px] leading-snug text-[#93a9c2]">
        {staged === null ? note : fill(stagedTemplate, { question: staged })}
      </p>
    </div>
  );
}
