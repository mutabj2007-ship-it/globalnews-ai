import type { LanguageCode, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface LiveStatusStripProps {
  /** Whether the last homepage data fetch reached the backend successfully. */
  isLive: boolean;

  /** The provenance of the news returned by the backend. */
  dataMode: NewsDataMode | null;

  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;
}

export function LiveStatusStrip({
  isLive,
  dataMode,
  language = 'en',
}: LiveStatusStripProps): JSX.Element {
  const t = getDictionary(language).liveStatusStrip;

  /**
   * Milestone #48 — the CLOCK FORMAT itself (not just surrounding
   * text) uses a locale string. With `hour: '2-digit', minute:
   * '2-digit', hour12: false` explicitly forced, en-US and pl-PL
   * produce the identical "HH:MM" digit format for this specific
   * combination of options — the locale choice here only affects
   * things this call doesn't use (AM/PM markers, separators), so
   * switching it for Polish is safe and low-risk, verified not to
   * change the rendered value.
   */
  const lastUpdated = new Date().toLocaleTimeString(language === 'pl' ? 'pl-PL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });

  const isReallyLive = isLive && dataMode === 'live';

  const badgeText = !isLive
    ? t.reconnecting
    : dataMode === 'live'
      ? t.live
      : dataMode === 'cached'
        ? t.cached
        : dataMode === 'mock'
          ? t.mock
          : t.unknown;

  return (
    <div className="border-b border-cyan-500/15 bg-surface">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              isReallyLive ? 'bg-emerald-500/10' : 'bg-amber-500/10'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isReallyLive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}

              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  isReallyLive ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </span>

            <span
              className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${
                isReallyLive ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {badgeText}
            </span>
          </span>

          <span className="text-xs text-ink-secondary sm:text-sm">{t.monitoring}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] text-ink-tertiary sm:text-xs">
            {t.lastUpdatedPrefix} {lastUpdated} UTC
          </span>
        </div>
      </div>
    </div>
  );
}