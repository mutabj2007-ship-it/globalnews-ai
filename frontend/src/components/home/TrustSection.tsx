import type { LanguageCode } from '@globalnews-ai/shared';
import { trustItems } from '@/lib/homeContent';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { HUD_CARD_CLIP, hudCornerBracketClassName } from '@/components/home/hudPanelGeometry';

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
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`relative overflow-hidden border border-cyan-500/20 bg-surface/60 px-6 py-6 backdrop-blur-sm ${HUD_CARD_CLIP}`}>
          <span aria-hidden="true" className={hudCornerBracketClassName('bottom-left')} />
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400/50" />

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">
              {t.label}
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-cyan-500/30" />
            <h2
              id="trust-heading"
              className="font-display text-sm font-medium tracking-tight text-ink-primary"
            >
              {t.headline}
            </h2>
          </div>

          {/* Dense integrated strip — internal vertical dividers on desktop (not individual bordered boxes) so the five items read as one connected panel, matching the reference's single-frame trust bar. */}
          <div className="grid grid-cols-1 divide-y divide-cyan-500/20 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 lg:divide-x lg:divide-cyan-500/20 xl:grid-cols-5">
            {trustItems.map((item, index) => {
              const Icon = item.icon;
              const localized = t.items[index];
              return (
                <div key={item.title} className="flex items-start gap-3 py-3 first:pt-0 sm:px-3 sm:py-0 sm:first:pl-0 lg:px-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-void text-cyan-300">
                    <Icon size={14} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-ink-primary">
                      {localized?.title ?? item.title}
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-tertiary">
                      {localized?.description ?? item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
