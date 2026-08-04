import type { ReactNode } from 'react';
import type { NewsAnalysisResult } from '@globalnews-ai/shared';
import { AnalysisModeBadge } from '@/components/search/AnalysisModeBadge';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

interface AnalysisResultViewProps {
  analysis: NewsAnalysisResult;
}

const CONFIDENCE_STYLES: Record<NewsAnalysisResult['confidence']['level'], string> = {
  low: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  medium: 'border-signal/40 bg-signal/10 text-signal-bright',
  high: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
};

function SectionHeading({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-signal-bright">
      {children}
    </h3>
  );
}

export function AnalysisResultView({ analysis }: AnalysisResultViewProps): JSX.Element {
  const entityGroups: Array<{ label: string; values: string[] }> = [
    { label: 'Countries', values: analysis.entities.countries },
    { label: 'Locations', values: analysis.entities.locations },
    { label: 'People', values: analysis.entities.people },
    { label: 'Organizations', values: analysis.entities.organizations },
    { label: 'Topics', values: analysis.entities.topics },
  ].filter((group) => group.values.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Headline + summary */}
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <AnalysisModeBadge mode={analysis.analysisMode} />
          <span className="font-mono text-[11px] text-ink-tertiary">
            Generated {formatRelativeTime(analysis.generatedAt)}
          </span>
        </div>
        <h2 className="mb-3 text-balance font-display text-2xl font-medium leading-tight text-ink-primary sm:text-3xl">
          {analysis.headline}
        </h2>
        <p className="text-sm leading-relaxed text-ink-secondary sm:text-base">
          {analysis.summary}
        </p>
      </div>

      {/* Confidence */}
      <div
        className={`rounded-2xl border p-5 ${CONFIDENCE_STYLES[analysis.confidence.level]}`}
      >
        <div className="mb-1 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest">
          Confidence: {analysis.confidence.level} ({analysis.confidence.score}/100)
        </div>
        <p className="text-sm leading-relaxed opacity-90">{analysis.confidence.explanation}</p>
      </div>

      {/* Key facts */}
      {analysis.keyFacts.length > 0 && (
        <section>
          <SectionHeading>Key facts</SectionHeading>
          <ul className="flex flex-col gap-3">
            {analysis.keyFacts.map((fact, index) => (
              <li
                key={index}
                className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-ink-primary"
              >
                {fact.claim}
                <span className="ml-2 font-mono text-[10px] text-ink-tertiary">
                  [{fact.sourceArticleIds.length} source{fact.sourceArticleIds.length === 1 ? '' : 's'}]
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Agreements */}
      {analysis.agreements.length > 0 && (
        <section>
          <SectionHeading>Where sources agree</SectionHeading>
          <ul className="flex flex-col gap-3">
            {analysis.agreements.map((agreement, index) => (
              <li
                key={index}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm leading-relaxed text-ink-primary"
              >
                {agreement.point}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Differences */}
      {analysis.differences.length > 0 && (
        <section>
          <SectionHeading>Where reporting differs</SectionHeading>
          <div className="flex flex-col gap-4">
            {analysis.differences.map((difference, index) => (
              <div key={index} className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-2 text-sm font-medium text-ink-primary">{difference.topic}</p>
                <ul className="flex flex-col gap-2">
                  {difference.positions.map((position, posIndex) => (
                    <li
                      key={posIndex}
                      className="rounded-lg bg-surface-hover p-3 text-sm leading-relaxed text-ink-secondary"
                    >
                      {position.description}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unknowns */}
      {analysis.unknowns.length > 0 && (
        <section>
          <SectionHeading>What remains unknown</SectionHeading>
          <ul className="flex flex-col gap-2">
            {analysis.unknowns.map((unknown, index) => (
              <li
                key={index}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed text-ink-secondary"
              >
                {unknown}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      {analysis.timeline.length > 0 && (
        <section>
          <SectionHeading>Timeline</SectionHeading>
          <ol className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {analysis.timeline.map((event, index) => (
              <li key={index} className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="font-mono text-xs text-ink-tertiary">
                  {formatRelativeTime(event.timestamp)}
                </span>
                <span className="text-sm text-ink-primary">{event.event}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Entities / topics */}
      {entityGroups.length > 0 && (
        <section>
          <SectionHeading>Entities &amp; topics</SectionHeading>
          <div className="flex flex-col gap-3">
            {entityGroups.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  {group.label}:
                </span>
                {group.values.map((value) => (
                  <span
                    key={value}
                    className="rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs text-ink-secondary"
                  >
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
