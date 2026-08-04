'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { exampleSearches } from '@/lib/homeContent';

const ROTATION_INTERVAL_MS = 3200;

export function Hero(): JSX.Element {
  const router = useRouter();
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      const swapTimeout = setTimeout(() => {
        setSuggestionIndex((current) => (current + 1) % exampleSearches.length);
        setIsVisible(true);
      }, 350);
      return () => clearTimeout(swapTimeout);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Natural-language questions are supported as-is — punctuation like
    // "?" or apostrophes is safe; the query is sent to the dedicated
    // results page, which calls the backend, which sends it to the
    // configured news provider.
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="relative overflow-hidden border-b border-border bg-void">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-24 pt-20 text-center sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-bright opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-bright" />
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary">
            AI-powered news intelligence
          </span>
        </div>

        <h1 className="max-w-3xl font-display text-4xl font-medium leading-[1.1] tracking-tight text-ink-primary sm:text-5xl md:text-6xl">
          Understand today&rsquo;s world in seconds.
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-ink-secondary sm:text-lg">
          Ask a question about any story and GlobalNews AI reads the coverage across
          outlets and viewpoints, then gives you a clear, sourced summary you can trust.
        </p>

        {/* Signal dial: pulse rings that echo the search bar's own shape */}
        <div className="relative mt-12 w-full max-w-2xl">
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl border border-signal/50 animate-ring-pulse"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl border border-signal/50 animate-ring-pulse [animation-delay:1.1s]"
            aria-hidden="true"
          />

          <form
            role="search"
            aria-label="Ask GlobalNews AI"
            onSubmit={handleSubmit}
            className="relative flex items-center gap-3 rounded-2xl border border-border-strong bg-surface px-5 py-4 shadow-[0_0_0_1px_rgba(61,111,255,0.08)] transition-colors focus-within:border-signal"
          >
            <Search size={20} className="shrink-0 text-ink-tertiary" strokeWidth={2} />
            <input
              type="text"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="Ask anything..."
              aria-label="Ask GlobalNews AI a question"
              className="w-full bg-transparent text-base text-ink-primary placeholder:text-ink-tertiary focus:outline-none sm:text-lg"
            />
            <button
              type="submit"
              aria-label="Submit question"
              className="hidden shrink-0 items-center justify-center rounded-xl bg-signal p-2.5 text-white transition-colors hover:bg-signal-bright sm:flex"
            >
              <ArrowRight size={18} strokeWidth={2.25} />
            </button>
          </form>

          {/* Rotating example suggestions */}
          <div className="mt-4 flex h-6 items-center justify-center gap-2 font-mono text-xs text-ink-tertiary sm:text-sm">
            <span className="shrink-0 text-ink-tertiary/70">Try:</span>
            <span
              key={suggestionIndex}
              className={isVisible ? 'animate-fade-slide-in' : 'animate-fade-slide-out'}
            >
              &ldquo;{exampleSearches[suggestionIndex]}&rdquo;
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
