import { projectSummaryStatements, safeExternalHref } from '@globalnews-ai/shared';
import type { AnalysisSourceRef, LanguageCode, SummaryStatement } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ═══ ASK INLINE EVIDENCE CITATIONS + INFERENCE LABEL R1 ═══════════════════
 *
 * THE BRIEF, WITH ITS CITATIONS. Renders the accepted brief paragraphs exactly
 * as `AskCompactResult` always did, and — only where the backend validated one
 * — marks a sentence with the sources that support it, or labels it as
 * analytical inference / not established.
 *
 * NOTHING IS COMPOSED HERE. Every character on screen is a character of
 * `analysis.summary`; statements are PLACED, by the same shared function the
 * backend used to accept them, never inserted. A citation number is the
 * source's position in `analysis.sources` — the same number the Sources list
 * prints — and a source id the backend did not attach to that sentence is
 * never shown. No statements means the plain paragraphs of before.
 */

/** 1-based numbers, in source-list order, for the ids a statement carries. */
export function citationNumbers(
  statement: SummaryStatement,
  sources: readonly AnalysisSourceRef[],
): number[] {
  if (statement.kind !== 'REPORTED_FACT' && statement.kind !== 'REPORTED_CONSEQUENCE') return [];
  return statement.sourceArticleIds
    .map((id) => sources.findIndex((source) => source.articleId === id))
    .filter((index) => index >= 0)
    .map((index) => index + 1)
    .sort((a, b) => a - b);
}

/** Every source number cited anywhere in the brief. */
export function citedSourceNumbers(
  statements: readonly SummaryStatement[] | undefined,
  sources: readonly AnalysisSourceRef[],
): Set<number> {
  return new Set((statements ?? []).flatMap((statement) => citationNumbers(statement, sources)));
}

export function AskCitedBrief({
  paragraphs,
  statements,
  sources,
  language,
}: {
  readonly paragraphs: readonly string[];
  readonly statements: readonly SummaryStatement[] | undefined;
  readonly sources: readonly AnalysisSourceRef[];
  readonly language: LanguageCode;
}): JSX.Element {
  const t = getDictionary(language).askAi;
  let remaining: readonly SummaryStatement[] = statements ?? [];

  return (
    <div data-ask="brief" className="flex flex-col gap-3">
      {paragraphs.map((paragraph, index) => {
        const { segments, placed } = projectSummaryStatements(paragraph, remaining);
        remaining = remaining.filter((statement) => !placed.includes(statement));

        return (
          <p
            key={`${index}-${paragraph.slice(0, 24)}`}
            data-ask="brief-paragraph"
            className="text-sm leading-relaxed text-ink-primary"
          >
            {segments.map((segment, segmentIndex) => {
              const statement = segment.statement;
              const key = `${segmentIndex}-${segment.text.slice(0, 12)}`;
              if (statement === undefined) return <span key={key}>{segment.text}</span>;

              if (statement.kind === 'ANALYTICAL_INFERENCE' || statement.kind === 'UNSUPPORTED') {
                return (
                  <span key={key} data-ask="statement" data-statement-kind={statement.kind} className="text-ink-secondary">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                      {statement.kind === 'ANALYTICAL_INFERENCE' ? t.inferenceLabel : t.unsupportedLabel}
                    </span>{' '}
                    <em>{segment.text}</em>
                  </span>
                );
              }

              return (
                <span key={key} data-ask="statement" data-statement-kind={statement.kind}>
                  {segment.text}
                  {citationNumbers(statement, sources).map((n) => {
                    const source = sources[n - 1];
                    return (
                      <a
                        key={n}
                        data-ask="citation"
                        data-citation={n}
                        href={safeExternalHref(source.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t.citationLabel
                          .replace('{n}', String(n))
                          .replace('{title}', source.title)
                          .replace('{publisher}', source.publisher)}
                        className="ms-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded px-0.5 font-mono text-[11px] text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                      >
                        [{n}]
                      </a>
                    );
                  })}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
