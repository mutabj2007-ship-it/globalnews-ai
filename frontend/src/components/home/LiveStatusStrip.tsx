import type { LanguageCode, NewsDataMode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { resolveLiveStatus } from '@/lib/liveStatus';

interface LiveStatusStripProps {
  /** Whether the last homepage data fetch reached the backend successfully. */
  isLive: boolean;

  /** The provenance of the news returned by the backend. */
  dataMode: NewsDataMode | null;

  /** Milestone #48 — defaults to 'en', so every pre-M48 caller renders exactly as before. */
  language?: LanguageCode;

  /**
   * M65 — the real freshness instant, resolved ONCE by page.tsx and
   * passed to BOTH status presentations (this mobile strip and Hero's
   * desktop DATA STATUS row) so they can never disagree about the same
   * moment. Required rather than defaulted: any fallback that is not a
   * genuinely passed-in time would reintroduce the render-time
   * `new Date()` generation this replaces.
   */
  updatedAt: string;
}

/**
 * M65 — the mobile status strip, implementing the approved Claude Design
 * (GlobalNews AI.dc.html ~L760-768: amber scan-line treatment) over
 * completely unchanged status truth.
 *
 * TRUTH MODEL: the badge state, its text and the timestamp all come from
 * resolveLiveStatus() (lib/liveStatus.ts) — the SAME pure function
 * Hero's desktop DATA STATUS row calls, with the SAME real
 * isLive / dataMode / updatedAt inputs. `isReallyLive` still requires
 * BOTH a successful fetch AND dataMode === 'live', so cached, mock,
 * reconnecting and unknown states are never dressed up as live. Nothing
 * here is hardcoded.
 *
 * BREAKPOINT: lg:hidden, matching the approved design, which places the
 * desktop equivalent inside the Hero's own left column rather than as a
 * second global strip. No status information is lost on desktop — Hero
 * renders the same badge and the same timestamp from the same function.
 *
 * The monitoring line is RETAINED per explicit CTO decision (the
 * recovered archive dropped it; that deletion is not carried).
 */
export function LiveStatusStrip({
  isLive,
  dataMode,
  language = 'en',
  updatedAt,
}: LiveStatusStripProps): JSX.Element {
  const t = getDictionary(language).liveStatusStrip;
  const { isReallyLive, badgeText, lastUpdated } = resolveLiveStatus(isLive, dataMode, language, updatedAt);

  return (
    <div className="relative overflow-hidden border-b border-[rgba(56,189,248,0.15)] bg-[rgba(6,10,20,0.92)] lg:hidden">
      <style>
        {`
          @keyframes gna-status-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .gna-status-scan { animation: gna-status-scan 5.5s linear infinite; }
          @media (prefers-reduced-motion: reduce) { .gna-status-scan { animation: none !important; opacity: 0.35 !important; } }
        `}
      </style>

      {/* Amber scan-line — the design's own status-strip motion cue. Decorative. */}
      <span
        aria-hidden="true"
        className="gna-status-scan pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,rgba(251,191,36,0),rgba(251,191,36,0.09),rgba(251,191,36,0))]"
      />

      <div className="relative mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-[5px] border px-[9px] py-[3px] ${
              isReallyLive
                ? 'border-[rgba(52,211,153,0.45)] bg-[rgba(16,72,55,0.5)]'
                : 'border-[rgba(251,191,36,0.45)] bg-[rgba(72,52,16,0.5)]'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {isReallyLive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}

              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  isReallyLive ? 'bg-[#34d399]' : 'bg-amber-400'
                }`}
              />
            </span>

            <span
              className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isReallyLive ? 'text-[#6ee7b7]' : 'text-amber-300'
              }`}
            >
              {badgeText}
            </span>
          </span>

          <span className="text-xs text-[#a7c0d8]">{t.monitoring}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5b7fa6]">
            {t.lastUpdatedPrefix} {lastUpdated} UTC
          </span>
        </div>
      </div>
    </div>
  );
}
