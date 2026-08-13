import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface CoverageLegendProps {
  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

export function CoverageLegend({ language = 'en' }: CoverageLegendProps): JSX.Element {
  const t = getDictionary(language).map;

  const levels = [
    { color: '#111827', label: t.legendNoStories },
    { color: '#1d315f', label: t.legendFew },
    { color: '#2855a6', label: t.legendSome },
    { color: '#3d6fff', label: t.legendMany },
    { color: '#7ea0ff', label: t.legendLots },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-tertiary">
        {t.coverageLegendTitle}
      </p>

      <div className="space-y-2">
        {levels.map((level) => (
          <div key={level.label} className="flex items-center gap-3">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: level.color }} />
            <span className="text-sm text-ink-secondary">{level.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
