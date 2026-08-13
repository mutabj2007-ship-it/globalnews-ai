import type { LanguageCode } from '@globalnews-ai/shared';
import type { HoveredCountry } from '@/components/map/WorldMap';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getCountryDisplayName } from '@/lib/countryDisplayName';

interface MapTooltipProps {
  hovered: HoveredCountry;
  knownStoryCount: number | null;
  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

export function MapTooltip({ hovered, knownStoryCount, language = 'en' }: MapTooltipProps): JSX.Element | null {
  if (!hovered.country) return null;

  const t = getDictionary(language).map;
  const explored = knownStoryCount !== null;
  // Milestone #49 Phase D — display-only localized name; the
  // underlying country object (including its canonical name and ISO
  // codes) is completely unaffected.
  const displayName = getCountryDisplayName(hovered.country.iso2, language, hovered.country.name);

  return (
    <div
      className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-border-strong bg-void/95 p-4 shadow-2xl backdrop-blur"
      style={{
        left: hovered.x,
        top: hovered.y - 14,
      }}
      role="status"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">{displayName}</h3>

          <p className="mt-1 font-mono text-[11px] text-ink-tertiary">
            {hovered.country.iso3} · {hovered.country.region}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
            explored ? 'border border-brand/40 text-brand' : 'border border-border text-ink-tertiary'
          }`}
        >
          {explored ? t.tooltipLoaded : t.tooltipReady}
        </span>
      </div>

      <div className="my-3 h-px bg-border" />

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">{t.tooltipStories}</span>

        <span className="text-lg font-semibold text-ink-primary">{knownStoryCount ?? '—'}</span>
      </div>

      <p className="mt-3 text-xs text-ink-secondary">
        {explored ? t.tooltipRefreshAction : t.tooltipLoadAction}
      </p>
    </div>
  );
}
