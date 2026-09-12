'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { TimelineEntry } from './analysisClaims';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

/**
 * H2D — E-28 Timeline, as an evidence-aware chronological LIST.
 *
 * NOT A CHART, AND THE SPACING IS THE REASON WHY. Every event sits the
 * same distance from its neighbour. Proportional spacing would assert
 * measured intervals — "these two things happened close together" — and
 * the contract supplies instants, never intervals. Equal spacing says
 * only "this came after that", which is the whole of what the payload
 * knows.
 *
 * NOTHING IS SORTED, INTERPOLATED OR DERIVED. The list is an <ol> in
 * response order. No date is invented for an event that lacks one, no
 * duration is computed between two events, and no missing event is
 * implied by a gap.
 *
 * AN UNPARSEABLE TIMESTAMP LOSES ITS TIME LINE, NOT ITS EVENT. The
 * adapter records whether the value parses; where it does not, the
 * event and its citations still render and the time is simply absent.
 * A guessed date would be worse than no date.
 *
 * CITATION LINKAGE IS REAL HERE. TimelineEvent carries sourceArticleIds
 * and, when the backend validated one, an evidence excerpt — exactly
 * like a claim. Events therefore carry the same numbered pills, and an
 * event that genuinely cites nothing says so.
 */

export interface TimelineSubViewProps {
  entries: readonly TimelineEntry[];
  onOpenSource: (articleId: string) => void;
  language?: LanguageCode;
}

export function TimelineSubView({
  entries,
  onOpenSource,
  language = 'en',
}: TimelineSubViewProps): JSX.Element {
  const dict = getDictionary(language).analysisWorkspace;
  const t = dict.timeline;

  if (entries.length === 0) {
    return (
      <div className="rounded-gn-module border border-gn-line-card bg-gn-panel p-5">
        <p className="font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint">
          {dict.noItemsInDimension}
        </p>
      </div>
    );
  }

  return (
    <ol aria-label={t.heading} className="relative m-0 flex list-none flex-col gap-4 p-0 pl-5">
      {/* Connector. Decorative: the ordered list already carries sequence. */}
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-[3px] top-2 w-px bg-gn-line-geo-soft"
      />
      {entries.map((entry, index) => (
        <li key={`${entry.ordinal}-${index}`} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-5 top-[6px] h-[7px] w-[7px] rounded-full bg-gn-geo"
          />
          {entry.timeValid && (
            <time
              dateTime={entry.timestamp}
              className="font-gn-mono text-gn-hud-outlet uppercase text-gn-ink-meta"
            >
              {formatRelativeTime(entry.timestamp, language)}
            </time>
          )}
          <p className="mt-[3px] font-gn-display text-gn-timeline text-gn-ink-body">
            {entry.event}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-[10px]">
            {entry.uncited ? (
              <span className="rounded-gn-pill border border-gn-line-pill px-[9px] py-[3px] font-gn-mono text-gn-hud-outlet uppercase text-gn-hud-faint">
                {dict.claim.uncited}
              </span>
            ) : (
              entry.citations.map((citation) =>
                citation.citationNumber === null ? (
                  <span
                    key={citation.articleId}
                    className="rounded-gn-pill border border-gn-line-pill px-[9px] py-[3px] font-gn-mono text-gn-hud-outlet uppercase text-gn-hud-faint"
                  >
                    {dict.claim.unresolvedCitation}
                  </span>
                ) : (
                  <button
                    key={citation.articleId}
                    type="button"
                    onClick={() => onOpenSource(citation.articleId)}
                    aria-label={`${dict.claim.sourcePrefix} ${citation.citationNumber}${
                      citation.outletName === null ? '' : `, ${citation.outletName}`
                    }. ${dict.claim.openInSourcesPanel}`}
                    className="flex min-h-[22px] items-center gap-[6px] rounded-gn-pill border border-gn-line-pill bg-gn-chip py-[3px] pl-[4px] pr-[9px] transition-colors duration-[120ms] hover:border-gn-line-pill-hover hover:bg-gn-pill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gn-focus"
                  >
                    <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-gn-line-inert font-gn-mono text-gn-hud-disc text-gn-ink-disc">
                      {citation.citationNumber}
                    </span>
                    {citation.outletName !== null && (
                      <span
                        aria-hidden="true"
                        className="hidden font-gn-mono text-gn-hud-outlet text-gn-ink-kind md:inline"
                      >
                        {citation.outletName}
                      </span>
                    )}
                  </button>
                ),
              )
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
