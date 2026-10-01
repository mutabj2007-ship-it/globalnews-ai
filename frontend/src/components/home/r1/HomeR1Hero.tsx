'use client';

import type { FormEvent, JSX } from 'react';
import { useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Map as MapIcon, MessagesSquare } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { submitGlobalAsk } from '@/lib/ask/submitGlobalAsk';
import { fill } from '@/components/home/reva/homeRevaModel';

/**
 * HOME R1 · STAGE A — THE LIGHT-PRIMARY HERO (FINAL spec §1–§3; Design R1-P4, R1-N2).
 *
 * One composer. Its "Ask" button is the reader's explicit Send: ONE ordinary turn on the
 * canonical Ask V2 engine, run by the global dock's own submit (submitGlobalAsk → AskAiDock).
 * CONVERGENCE (Unified Intelligence Binding R2): there is no transport switch and no legacy
 * analysis path — the platform has one Ask. Context is whatever the dock already attaches
 * (R2's askContextRefOf); this composer adds none.
 * Typing and focusing are local. Suggestions only FILL the box (0 AI, 0 request). The hero
 * map is gone (R1-N2): World Map stays persistent navigation, linked once below.
 */
export function HomeR1Hero({
  language,
  suggestions,
}: {
  readonly language: LanguageCode;
  readonly suggestions: readonly string[];
}): JSX.Element {
  const t = getDictionary(language).homeR1.hero;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const draft = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    if (draft.length === 0) {
      inputRef.current?.focus();
      return;
    }
    if (draft.length < 2) return;
    submitGlobalAsk(draft);
    setStatus(fill(t.sent, { question: draft }));
    event.currentTarget.reset();
  };

  const stage = (question: string): void => {
    const input = inputRef.current;
    if (input === null) return;
    input.value = question;
    input.focus();
  };

  return (
    <section data-home-r1-hero="" aria-labelledby="home-r1-title" className="relative overflow-hidden pt-6 lg:pt-10">
      {/* Decorative only: a soft orb in the action colour, no image, no map. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-10 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_35%_35%,var(--gt-actSoft)_0%,var(--gt-pgLine2)_45%,transparent_72%)] opacity-80 sm:-right-10 lg:right-0 lg:top-0 lg:h-[380px] lg:w-[380px]"
      />
      <div className="relative max-w-[640px]">
        <h1 id="home-r1-title" className="font-display text-[40px] font-bold leading-[1.04] tracking-[-0.025em] text-[var(--gt-ink)] sm:text-[48px] lg:text-[56px]">
          {t.titleA}
          <span className="block bg-[image:var(--gt-heroGrad)] bg-clip-text text-transparent">{t.titleB}</span>
        </h1>
        <p className="mt-3 max-w-[420px] text-[16px] leading-[1.5] text-[var(--gt-ink2)] lg:text-[17px]">{t.sub}</p>

        <p className="mt-6 flex items-center gap-2 text-[14px] font-semibold text-[var(--gt-ink)]">
          <MessagesSquare aria-hidden="true" className="h-4 w-4 text-[var(--gt-link)]" />
          {t.askBrand}
        </p>
        <form
          role="search"
          aria-label={t.askBrand}
          onSubmit={submit}
          data-home-r1-composer=""
          data-ask-sends="true"
          className="mt-2 flex h-[56px] items-center gap-2 rounded-full border border-[var(--gt-pgLine2)] bg-[var(--gt-card)] pl-4 pr-[5px] shadow-[0_10px_30px_-18px_rgba(20,36,59,0.45)] focus-within:border-[var(--gt-act)] focus-within:shadow-[0_0_0_3px_rgba(36,95,199,0.18)] md:h-[60px]"
        >
          <MessagesSquare aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--gt-ink3)]" />
          <input
            ref={inputRef}
            name="q"
            type="text"
            autoComplete="off"
            maxLength={1000}
            placeholder={t.placeholder}
            aria-label={t.askBrand}
            aria-describedby="home-r1-composer-note"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--gt-ink)] outline-none placeholder:text-[var(--gt-ink3)]"
          />
          <button
            type="submit"
            data-home-r1-ask=""
            className="inline-flex h-[46px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--gt-act)] px-5 text-[15px] font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-act)] focus-visible:ring-offset-2"
          >
            {t.ask}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>
        <p id="home-r1-composer-note" role="status" className="mt-2 px-1 text-[12.5px] leading-snug text-[var(--gt-ink2)]">
          {status ?? t.noteSend}
        </p>

        <ul aria-label={t.suggestionsAria} className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
          {suggestions.slice(0, 3).map((question) => (
            <li key={question} className="shrink-0">
              <button
                type="button"
                data-home-r1-suggestion=""
                onClick={() => stage(question)}
                className="flex min-h-[44px] max-w-[260px] items-center gap-2 rounded-[10px] border border-[var(--gt-line)] bg-[var(--gt-card)] px-3 py-2 text-left text-[13px] font-semibold leading-snug text-[var(--gt-ink)] hover:border-[var(--gt-act)]"
              >
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--gt-link)]" />
                <span>{question}</span>
              </button>
            </li>
          ))}
        </ul>

        <a
          href="/map"
          data-home-r1-map-link=""
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--gt-line)] bg-[var(--gt-card)] px-4 text-[13px] font-semibold text-[var(--gt-ink)] hover:border-[var(--gt-act)]"
        >
          <MapIcon aria-hidden="true" className="h-4 w-4 text-[var(--gt-link)]" />
          {t.mapLink}
        </a>
      </div>
    </section>
  );
}
