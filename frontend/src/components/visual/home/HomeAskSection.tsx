'use client';

import { useRef, useState, type FormEvent, type JSX } from 'react';
import { ArrowRight, MessagesSquare } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { submitGlobalAsk } from '@/lib/ask/submitGlobalAsk';
import { fill } from '@/components/home/reva/homeRevaModel';

/**
 * PHONE-FIRST HOME CORRECTION R1 · §7 — ASK GLOBALNEWSAI, IN ITS LOWER PLACE.
 *
 * The SAME one Ask (submitGlobalAsk → the root-mounted AskAiDock → Ask V2): conversation,
 * explanation, decisions, research, on any subject — Home's business/conflict focus does not limit
 * Ask. Pressing Ask is the explicit Send; examples only fill the box. The story search above never
 * routes here, and nothing here routes to story search. `/ask` stays the dedicated Ask Standalone.
 */
export function HomeAskSection({ language, examples }: { readonly language: LanguageCode; readonly examples: readonly string[] }): JSX.Element {
  const dict = getDictionary(language);
  const t = dict.visual.hero;
  const th = dict.visual.home;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const draft = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    if (draft.length === 0) {
      inputRef.current?.focus();
      return;
    }
    if (draft.length < 2) return;
    if (submitGlobalAsk(draft)) {
      setStatus(fill(t.sent, { question: draft }));
      event.currentTarget.reset();
    }
  };

  return (
    <section id="home-ask" aria-labelledby="home-ask-title" data-home-ask="" className="scroll-mt-24 rounded-[1rem] border border-[var(--gt-line)] bg-[var(--gt-card)] p-4 min-[600px]:p-6">
      <h2 id="home-ask-title" className="flex items-center gap-2 font-display text-[1.25rem] font-bold text-[var(--gt-ink)]">
        <MessagesSquare aria-hidden="true" className="h-5 w-5 text-[var(--gt-link)]" />
        {th.askHeading}
      </h2>
      <p className="mt-1 max-w-[40rem] text-[0.875rem] leading-snug text-[var(--gt-ink2)]">{th.askLine}</p>
      <form onSubmit={submit} aria-label={t.askLabel} data-visual-composer="" data-ask-sends="true" className="mt-3 flex flex-col gap-2 min-[600px]:flex-row min-[600px]:items-end">
        <textarea
          ref={inputRef}
          name="q"
          rows={2}
          dir="auto"
          maxLength={1000}
          enterKeyHint="send"
          placeholder={t.placeholder}
          aria-label={t.askLabel}
          aria-describedby="home-ask-note"
          className="min-h-[3.25rem] w-full flex-1 resize-y rounded-[0.625rem] border border-[var(--gt-line)] bg-[var(--gt-card)] px-3 py-2.5 text-[1rem] text-[var(--gt-ink)] outline-none placeholder:text-[var(--gt-ink3)] focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
        />
        <button
          type="submit"
          data-visual-ask=""
          className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-1.5 rounded-[0.5rem] bg-[var(--gt-act)] px-5 text-[0.9375rem] font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)] focus-visible:ring-offset-2"
        >
          {t.ask}
          <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </form>
      <p id="home-ask-note" role="status" className="mt-2 text-[0.8125rem] leading-snug text-[var(--gt-ink2)]">
        {status ?? t.note}
      </p>
      {examples.length > 0 && (
        <ul aria-label={t.examplesAria} className="mt-2 flex flex-wrap gap-2">
          {examples.slice(0, 3).map((question) => (
            <li key={question} className="min-w-0 max-w-full">
              <button
                type="button"
                data-visual-example=""
                onClick={() => {
                  if (inputRef.current !== null) {
                    inputRef.current.value = question;
                    inputRef.current.focus();
                  }
                }}
                className="min-h-[44px] max-w-full rounded-[0.5rem] border border-[var(--gt-line)] px-3 py-2 text-start text-[0.8125rem] font-semibold leading-snug text-[var(--gt-ink)] hover:border-[var(--gt-act)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)]"
              >
                <span dir="auto">{question}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
