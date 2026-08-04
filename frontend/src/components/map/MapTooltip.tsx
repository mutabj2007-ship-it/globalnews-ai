import type { HoveredCountry } from '@/components/map/WorldMap';

interface MapTooltipProps {
  hovered: HoveredCountry;
  knownStoryCount: number | null;
}

export function MapTooltip({
  hovered,
  knownStoryCount,
}: MapTooltipProps): JSX.Element | null {
  if (!hovered.country) return null;

  const explored = knownStoryCount !== null;

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
          <h3 className="text-sm font-semibold text-ink-primary">
            {hovered.country.name}
          </h3>

          <p className="mt-1 font-mono text-[11px] text-ink-tertiary">
            {hovered.country.iso3} · {hovered.country.region}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
            explored
              ? 'border border-brand/40 text-brand'
              : 'border border-border text-ink-tertiary'
          }`}
        >
          {explored ? 'LOADED' : 'READY'}
        </span>
      </div>

      <div className="my-3 h-px bg-border" />

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
          Stories
        </span>

        <span className="text-lg font-semibold text-ink-primary">
          {knownStoryCount ?? '—'}
        </span>
      </div>

      <p className="mt-3 text-xs text-ink-secondary">
        {explored
          ? 'Click to refresh and explore the latest coverage.'
          : 'Click to load live news coverage for this country.'}
      </p>
    </div>
  );
}