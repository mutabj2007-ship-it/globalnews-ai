export function CoverageLegend(): JSX.Element {
  const levels = [
    { color: '#111827', label: 'No stories loaded' },
    { color: '#1d315f', label: '1–3 stories' },
    { color: '#2855a6', label: '4–7 stories' },
    { color: '#3d6fff', label: '8–12 stories' },
    { color: '#7ea0ff', label: '13+ stories' },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-tertiary">
        Coverage Legend
      </p>

      <div className="space-y-2">
        {levels.map((level) => (
          <div key={level.label} className="flex items-center gap-3">
            <div
              className="h-4 w-4 rounded"
              style={{ backgroundColor: level.color }}
            />
            <span className="text-sm text-ink-secondary">
              {level.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}