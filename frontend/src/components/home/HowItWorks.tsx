import type { LanguageCode } from '@globalnews-ai/shared';
import { processSteps } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface HowItWorksProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #48 — step titles/descriptions are GlobalNews AI editorial
 * copy (Category B), now sourced from the dictionary's parallel
 * `howItWorks.steps` array instead of homeContent.ts's `processSteps`
 * strings. `processSteps` still supplies the step NUMBER and ICON
 * (language-independent, unchanged) via array index alignment — the
 * dictionary array and homeContent.ts's array are kept the same length
 * and order by construction.
 */
export function HowItWorks({ language = 'en' }: HowItWorksProps): JSX.Element {
  const t = getDictionary(language).howItWorks;

  return (
    <section
      className="border-b border-border bg-surface/40"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-12 flex flex-col gap-2 sm:mb-16">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            {t.label}
          </span>
          <h2
            id="how-it-works-heading"
            className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
          >
            {t.headline}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {/* Connecting line for larger screens, purely decorative */}
          <div
            className="absolute left-0 right-0 top-6 hidden h-px bg-border sm:block"
            aria-hidden="true"
          />

          {processSteps.map((item, index) => {
            const Icon = item.icon;
            const localized = t.steps[index];
            return (
              <div key={item.step} className="relative flex flex-col items-start gap-4">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-border-strong bg-void text-signal-bright">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="mb-1 font-mono text-xs text-ink-tertiary">{item.step}</div>
                  <h3 className="mb-2 font-display text-lg font-medium text-ink-primary">
                    {localized?.title ?? item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-secondary">
                    {localized?.description ?? item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
