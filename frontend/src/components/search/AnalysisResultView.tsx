import type { ReactNode } from 'react';
import type { AnalysisProvenance, NewsAnalysisResult, SourceDiversity } from '@globalnews-ai/shared';
import { AnalysisModeBadge } from '@/components/search/AnalysisModeBadge';
import { AnalysisCitation } from '@/components/search/AnalysisCitation';
import { EvidenceSufficiencyNote } from '@/components/search/EvidenceSufficiencyNote';
import { TrustBadge } from '@/components/search/TrustBadge';
import { SourceDiversitySummary } from '@/components/search/SourceDiversitySummary';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

interface AnalysisResultViewProps {
  analysis: NewsAnalysisResult;
  /** Milestone #30 — the badge now needs the full provenance, not just analysis.analysisMode. */
  provenance: AnalysisProvenance;
  /**
   * Milestone #44 — a sibling of `analysis` on AnalysisApiResponse, not
   * a field of NewsAnalysisResult, so it must be threaded in as its own
   * prop (unlike trustState/relationalComposition, which are read
   * directly off `analysis` below — no redundant props for those).
   */
  sourceDiversity?: SourceDiversity;
}

function SectionHeading({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-signal-bright">
      {children}
    </h3>
  );
}

export function AnalysisResultView({ analysis, provenance, sourceDiversity }: AnalysisResultViewProps): JSX.Element {
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
          <AnalysisModeBadge provenance={provenance} />
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

      {/*
        Milestone #44 — TrustBadge (driven by analysis.trustState, the
        Milestone #42 authoritative backend trust signal) now occupies
        the prominent position analysis.confidence previously held here.
        analysis.confidence is demoted to a small, explicitly-labeled
        "AI self-assessment" details block further below — it must never
        visually outrank this component.
      */}
      <TrustBadge trustState={analysis.trustState} />
      <SourceDiversitySummary
        sourceDiversity={sourceDiversity}
        isMock={provenance.analysisMode === 'mock-ai'}
      />

      {/*
        Milestone #44 — renders relationalComposition's own backend-
        authored summary VERBATIM. No frontend re-derivation of
        direction, sufficiency, or causality — the counts shown are
        simple array lengths from already-backend-computed buckets.
      */}
      {analysis.relationalComposition && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <SectionHeading>Relationship evidence</SectionHeading>
          <p className="text-sm leading-relaxed text-ink-primary">
            {analysis.relationalComposition.summary}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary sm:grid-cols-4">
            <dt>Supporting</dt>
            <dd>{analysis.relationalComposition.supportingClaims.length}</dd>
            <dt>Reverse</dt>
            <dd>{analysis.relationalComposition.reverseClaims.length}</dd>
            <dt>Association-only</dt>
            <dd>{analysis.relationalComposition.associationOnlyClaims.length}</dd>
            <dt>Mixed</dt>
            <dd>{analysis.relationalComposition.mixedClaims.length}</dd>
          </dl>
        </div>
      )}

      {/*
        Milestone #44 — analysis.confidence demoted from its former
        prominent position to a small, explicitly-labeled, collapsed-
        by-default secondary section. This is the AI provider's own
        self-reported estimate (Milestone #42: never authoritative,
        never cross-checked) — never styled to compete with TrustBadge.
      */}
      <details className="rounded-2xl border border-border-strong bg-surface p-4">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
          AI self-assessment (not the evidence trust rating)
        </summary>
        <div className="mt-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
            AI self-assessment: {analysis.confidence.level} ({analysis.confidence.score}/100)
          </p>
          <p className="text-xs leading-relaxed text-ink-tertiary">{analysis.confidence.explanation}</p>
          <p className="mt-2 text-[11px] italic leading-relaxed text-ink-tertiary">
            This is the AI model&rsquo;s own confidence estimate and is not the authoritative evidence trust rating above.
          </p>
        </div>
      </details>

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
                <AnalysisCitation sourceArticleIds={fact.sourceArticleIds} sources={analysis.sources} />
                <EvidenceSufficiencyNote
                  evidenceBreadth={fact.evidenceBreadth}
                  evidenceBasis={fact.evidenceBasis}
                />
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
                <AnalysisCitation sourceArticleIds={agreement.sourceArticleIds} sources={analysis.sources} />
                <EvidenceSufficiencyNote
                  evidenceBreadth={agreement.evidenceBreadth}
                  evidenceBasis={agreement.evidenceBasis}
                />
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
                      <AnalysisCitation sourceArticleIds={position.sourceArticleIds} sources={analysis.sources} />
                      <EvidenceSufficiencyNote
                        evidenceBreadth={position.evidenceBreadth}
                        evidenceBasis={position.evidenceBasis}
                      />
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

      {/* Uncertainty / insufficient evidence */}
      {analysis.uncertainties && analysis.uncertainties.length > 0 && (
        <section>
          <SectionHeading>Insufficient evidence</SectionHeading>
          <ul className="flex flex-col gap-2">
            {analysis.uncertainties.map((uncertainty, index) => (
              <li
                key={index}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed text-ink-secondary"
              >
                {uncertainty.description}
                <AnalysisCitation sourceArticleIds={uncertainty.sourceArticleIds} sources={analysis.sources} />
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
                <span className="text-sm text-ink-primary">
                  {event.event}
                  <AnalysisCitation sourceArticleIds={event.sourceArticleIds} sources={analysis.sources} />
                  <EvidenceSufficiencyNote
                    evidenceBreadth={event.evidenceBreadth}
                    evidenceBasis={event.evidenceBasis}
                  />
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Entities / topics */}
      {entityGroups.length > 0 && (
        <section>
          <SectionHeading>
            Entities &amp; topics
            {/*
              Milestone #30 §G/H — these entities come straight from
              NewsAnalysisResult.entities: AI-interpreted free text, not
              grounded against sourceArticleIds the way keyFacts/
              agreements/differences/timeline are (see
              validate-analysis-result.ts). Deliberately NOT merged with
              the deterministic, source-derived SourceEntitiesPanel
              (Milestone #29) — this label exists so the two are never
              mistaken for one another.
            */}
            <span className="ml-2 font-mono text-[10px] normal-case tracking-normal text-ink-tertiary">
              (AI-interpreted, unverified)
            </span>
          </SectionHeading>
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
