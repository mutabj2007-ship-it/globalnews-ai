import type { LanguageCode } from '@globalnews-ai/shared';
import { processSteps } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { hudCornerBracketClassName } from '@/components/home/hudPanelGeometry';

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
      className="relative border-b border-border bg-surface/40"
      aria-labelledby="how-it-works-heading"
    >
      <span aria-hidden="true" className={hudCornerBracketClassName('top-left')} />
      <span aria-hidden="true" className={hudCornerBracketClassName('top-right')} />
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
        <div className="mb-4 flex flex-col gap-1.5 sm:mb-5">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">
            {t.label}
          </span>
          <h2
            id="how-it-works-heading"
            className="font-display text-xl font-medium tracking-tight text-ink-primary sm:text-2xl"
          >
            {t.headline}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5">
          {/* Signal-flow connector — a continuous cyan rail with an explicit pulsing "signal" marker at each midpoint between steps, not just a plain line. */}
          <div className="pointer-events-none absolute left-0 right-0 top-5 hidden sm:block" aria-hidden="true">
            <style>{`
              @keyframes gna-flow-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
              .gna-flow-node { animation: gna-flow-pulse 2.4s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) { .gna-flow-node { animation: none !important; opacity: 0.7 !important; transform: none !important; } }
            `}</style>
            <div className="h-px bg-gradient-to-r from-cyan-500/10 via-cyan-500/60 to-cyan-500/10" />
            <div className="absolute inset-0 flex items-center justify-around px-[16.6%]">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className="gna-flow-node h-1.5 w-1.5 rotate-45 bg-cyan-400"
                  style={{ animationDelay: `${i * 0.8}s` }}
                />
              ))}
            </div>
          </div>

          {processSteps.map((item, index) => {
            const Icon = item.icon;
            const localized = t.steps[index];
            return (
              <div key={item.step} className="relative flex flex-col items-start gap-3">
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-void text-cyan-300 shadow-[0_0_20px_-6px_rgba(34,211,238,0.4)]">
                  <Icon size={17} strokeWidth={2} />
                </div>
                <div>
                  <div className="mb-1 font-mono text-xs text-ink-tertiary">{item.step}</div>
                  <h3 className="mb-1.5 font-display text-base font-medium text-ink-primary">
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
