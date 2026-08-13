import type { LanguageCode } from '@globalnews-ai/shared';
import { trustItems } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface TrustSectionProps {
  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #48 — item titles/descriptions are GlobalNews AI editorial
 * copy (Category B), sourced from the dictionary's parallel
 * `trustSection.items` array. `trustItems` (homeContent.ts) still
 * supplies the ICON (language-independent) via array index alignment.
 */
export function TrustSection({ language = 'en' }: TrustSectionProps): JSX.Element {
  const t = getDictionary(language).trustSection;

  return (
    <section className="border-b border-border bg-void" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-12 flex flex-col gap-2 sm:mb-16">
          <span className="font-mono text-xs uppercase tracking-widest text-signal-bright">
            {t.label}
          </span>
          <h2
            id="trust-heading"
            className="font-display text-2xl font-medium tracking-tight text-ink-primary sm:text-3xl"
          >
            {t.headline}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trustItems.map((item, index) => {
            const Icon = item.icon;
            const localized = t.items[index];
            const isLastOddCard =
              trustItems.length % 3 !== 0 && index === trustItems.length - 1;
            return (
              <div
                key={item.title}
                className={`rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-signal/60 ${
                  isLastOddCard ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-signal-dim/40 text-signal-bright">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <h3 className="mb-2 font-display text-base font-medium text-ink-primary">
                  {localized?.title ?? item.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  {localized?.description ?? item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
