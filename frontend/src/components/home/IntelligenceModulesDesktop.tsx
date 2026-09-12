import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { IntelligenceEngineInteractive } from '@/components/home/IntelligenceEngineInteractive';

interface IntelligenceModulesDesktopProps {
  language?: LanguageCode;
}

/**
 * CTO explicit authorization — this Server Component is now a thin
 * shell (section chrome, background field, heading) around
 * `IntelligenceEngineInteractive`, the narrowly-scoped client
 * component that owns the hub + connector + module-card hover/focus
 * interaction. Nothing in THIS file needs client JS, so it stays a
 * Server Component — only the actual interactive surface became a
 * client boundary, per the explicit "client boundary must remain
 * small" requirement.
 *
 * Preserves the responsive 3 -> 5 -> 9 column band graduation and the
 * central engine hub from the prior rounds — both now live inside
 * IntelligenceEngineInteractive.tsx, unchanged in visual behavior,
 * only relocated to enable the new hover/focus interaction.
 */
export function IntelligenceModulesDesktop({ language = 'en' }: IntelligenceModulesDesktopProps): JSX.Element {
  const t = getDictionary(language).intelligenceModules;

  return (
    <section
      className="relative hidden overflow-hidden border-b border-border bg-void lg:block"
      aria-labelledby="intelligence-modules-heading"
    >
      {/* Background technical field — faint radial grid, not empty space. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(34,211,238,0.08), transparent 60%), linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      <div className="relative mx-auto max-w-[1480px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-400">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              {t.eyebrow}
            </span>
            <h2 id="intelligence-modules-heading" className="mt-2 font-display text-2xl font-medium text-ink-primary sm:text-3xl">
              {t.heading}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-ink-secondary">{t.description}</p>
        </div>

        <IntelligenceEngineInteractive language={language} />
      </div>
    </section>
  );
}
