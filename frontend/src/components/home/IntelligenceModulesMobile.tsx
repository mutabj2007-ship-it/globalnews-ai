import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { INTELLIGENCE_MODULES } from '@/lib/intelligenceModules';
import { IntelligenceModuleCard } from '@/components/home/IntelligenceModuleCard';

interface IntelligenceModulesMobileProps {
  language?: LanguageCode;
}

/**
 * CTO directive (mobile pass) — 9 modules in a strict 2-column grid
 * orphan the 9th card alone on its own row. Fixed by rendering the
 * first 8 in the 2-column grid and the 9th (Forecast & Watchlist, the
 * last item in the canonical INTELLIGENCE_MODULES order) full-width
 * beneath it — the CTO's own explicitly suggested resolution ("Forecast
 * may span full width if 9 cards produce an orphan").
 *
 * Also brought the hub badge and eyebrow into the same cyan HUD
 * accent system used everywhere else on the revised homepage (was
 * still on the older `signal` token here) — tertiary-but-consistent
 * energy, not a different design generation.
 *
 * Renders from the SAME INTELLIGENCE_MODULES config as
 * IntelligenceModulesDesktop — this file contains zero module data
 * of its own, satisfying "the SAME data/capability states/routes" as
 * desktop while using a genuinely different, mobile-appropriate
 * layout (no radial network squeezed into a phone).
 */
export function IntelligenceModulesMobile({ language = 'en' }: IntelligenceModulesMobileProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;
  const gridModules = INTELLIGENCE_MODULES.slice(0, 8);
  const overflowModule = INTELLIGENCE_MODULES[8];

  return (
    <section
      id="intelligence-modules"
      className="border-b border-border bg-void lg:hidden"
      aria-labelledby="intelligence-modules-mobile-heading"
    >
      <div className="px-4 py-10 sm:px-6">
        <div className="mb-5">
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-400">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {t.eyebrow}
          </span>
          <h2
            id="intelligence-modules-mobile-heading"
            className="mt-1 font-display text-xl font-medium text-ink-primary"
          >
            {t.heading}
          </h2>
        </div>

        <div className="relative mb-4 overflow-hidden rounded-2xl border border-cyan-500/30 bg-surface p-4 text-center">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400/60" />
          <span className="font-display text-sm font-semibold uppercase tracking-wide text-cyan-300">
            {t.hubLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {gridModules.map((module) => (
            <IntelligenceModuleCard key={module.id} module={module} language={language} />
          ))}
        </div>

        {overflowModule && (
          <div className="mt-3">
            <IntelligenceModuleCard module={overflowModule} language={language} />
          </div>
        )}
      </div>
    </section>
  );
}
