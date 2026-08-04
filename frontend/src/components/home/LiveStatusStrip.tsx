import type { NewsDataMode } from '@globalnews-ai/shared';

interface LiveStatusStripProps {
  /** Whether the last homepage data fetch reached the backend successfully. */
  isLive: boolean;
  /** Whether the backend served live provider data or mock/demo data. */
  dataMode: NewsDataMode | null;
}

export function LiveStatusStrip({ isLive, dataMode }: LiveStatusStripProps): JSX.Element {
  const lastUpdated = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });

  // Exactly one of these three states is ever shown — live and demo
  // labels must never appear together.
  const isReallyLive = isLive && dataMode === 'live';
  const badgeText = !isLive ? 'RECONNECTING' : dataMode === 'live' ? 'LIVE \u00b7 Powered by GNews' : 'DEMO MODE \u00b7 Sample content only';

  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              isReallyLive ? 'bg-rose-500/10' : 'bg-ink-tertiary/10'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isReallyLive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  isReallyLive ? 'bg-rose-500' : 'bg-ink-tertiary'
                }`}
              />
            </span>
            <span
              className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${
                isReallyLive ? 'text-rose-400' : 'text-ink-tertiary'
              }`}
            >
              {badgeText}
            </span>
          </span>
          <span className="text-xs text-ink-secondary sm:text-sm">
            Monitoring trusted global sources
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-ink-tertiary sm:text-xs">
            Last updated: {lastUpdated} UTC
          </span>
        </div>
      </div>
    </div>
  );
}
