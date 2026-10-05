'use client';

import { useRef, useState, type FormEvent, type JSX } from 'react';
import { ArrowRight, MessagesSquare } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { submitGlobalAsk } from '@/lib/ask/submitGlobalAsk';
import { fill } from '@/components/home/reva/homeRevaModel';
import { VisualHeroMap } from './VisualHeroMap';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMPACT VISUAL PRODUCT R1 — THE HERO (Design: navy surface, heading, ONE Ask, Global Map)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ONE ASK. The composer is the SAME shared Ask the Home R1 hero uses: pressing Ask is the
 * reader's explicit Send — one ordinary turn on the canonical Ask V2 engine, run by the
 * root-mounted dock (submitGlobalAsk → AskAiDock). No second Ask, no transport choice, no new
 * routing. Example prompts only FILL the box (0 AI, 0 request).
 *
 * GEOMETRY (design doc 01): stacked below a hero inner width of 848 px; two columns from there.
 * A CONTAINER query on the hero itself, so the brief panel opening beside the feed reflows the
 * hero rather than overflowing it. Logical properties only, so Arabic mirrors without forks; the
 * map graphic itself is never mirrored.
 */
export function VisualHero({
  language,
  examples,
}: {
  readonly language: LanguageCode;
  readonly examples: readonly string[];
}): JSX.Element {
  const t = getDictionary(language).visual.hero;
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
    if (submitGlobalAsk(draft)) {
      setStatus(fill(t.sent, { question: draft }));
      event.currentTarget.reset();
    }
  };

  const stage = (question: string): void => {
    const input = inputRef.current;
    if (input === null) return;
    input.value = question;
    input.focus();
  };

  return (
    <section
      aria-labelledby="visual-hero-title"
      data-visual-hero=""
      className="rounded-[1rem] bg-[var(--gt-navy)] bg-[linear-gradient(160deg,var(--gt-navy)_0%,var(--gt-hdr)_100%)] p-4 text-white [container-type:inline-size] min-[600px]:p-6 min-[1024px]:p-8"
    >
      <div className="grid grid-cols-1 gap-6 [@container(min-width:848px)]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] [@container(min-width:848px)]:gap-8">
        <div className="flex min-w-0 flex-col">
          <p className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-cyan-200">{t.eyebrow}</p>
          <h1 id="visual-hero-title" className="mt-2 font-display text-[1.75rem] font-bold leading-[1.1] tracking-[-0.015em] text-white min-[600px]:text-[2rem] min-[1024px]:text-[2.25rem]">
            {t.title}
          </h1>
          <p className="mt-2 max-w-[36rem] text-[1rem] leading-[1.5] text-[var(--gt-hdrInk)]">{t.line}</p>

          <form
            role="search"
            aria-label={t.askLabel}
            onSubmit={submit}
            data-visual-composer=""
            data-ask-sends="true"
            className="mt-5 flex min-h-[3.25rem] items-center gap-2 rounded-[0.625rem] bg-[var(--gt-card)] ps-3 pe-[5px] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] focus-within:ring-2 focus-within:ring-cyan-300"
          >
            <MessagesSquare aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--gt-ink3)]" />
            <input
              ref={inputRef}
              name="q"
              type="text"
              dir="auto"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={1000}
              placeholder={t.placeholder}
              aria-label={t.askLabel}
              aria-describedby="visual-composer-note"
              className="min-w-0 flex-1 bg-transparent text-[1rem] text-[var(--gt-ink)] outline-none placeholder:text-[var(--gt-ink3)]"
            />
            <button
              type="submit"
              data-visual-ask=""
              className="inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-[0.5rem] bg-[var(--gt-act)] px-4 text-[0.9375rem] font-bold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t.ask}
              <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
            </button>
          </form>
          <p id="visual-composer-note" role="status" className="mt-2 text-[0.8125rem] leading-snug text-[var(--gt-hdrInk)]">
            {status ?? t.note}
          </p>

          {examples.length > 0 && (
            <ul aria-label={t.examplesAria} className="mt-3 flex flex-wrap gap-2">
              {examples.slice(0, 3).map((question) => (
                <li key={question} className="min-w-0 max-w-full">
                  <button
                    type="button"
                    data-visual-example=""
                    onClick={() => stage(question)}
                    className="min-h-[44px] max-w-full rounded-[0.5rem] border border-white/20 bg-white/[0.06] px-3 py-2 text-start text-[0.8125rem] font-semibold leading-snug text-white hover:border-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    <span dir="auto">{question}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <VisualHeroMap language={language} />
      </div>
    </section>
  );
}
