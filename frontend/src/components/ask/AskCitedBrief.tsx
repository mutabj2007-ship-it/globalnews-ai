import type { JSX } from 'react';
import type { AnalysisSourceRef, LanguageCode, SummaryStatement } from '@globalnews-ai/shared';
import { AskAnswerProse } from './AskAnswerProse';

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

/**
 * R4 ANSWER READING EXPERIENCE R1 — THIS COMPONENT IS NOW A THIN ADAPTER.
 *
 * It kept its name and its props because `AskCompactResult` and the accepted dock specs pin
 * them, and `citationNumbers` / `citedSourceNumbers` above are imported elsewhere. What moved
 * is the drawing: `AskAnswerProse` renders the ANSWER'S OWN structure — headings, bullets,
 * numbered steps, emphasis — instead of printing its markup at the reader, and places the same
 * citations through the same `projectSummaryStatements` call, in the same document order.
 *
 * The paragraphs arrive already split by `splitSynthesisParagraphs`; re-joining them with blank
 * lines hands the parser the ONE string the answer was authored as, so a list that straddles a
 * paragraph split is still read as one list.
 */
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
  return (
    <AskAnswerProse
      source={paragraphs.join('\n\n')}
      statements={statements}
      sources={sources}
      language={language}
    />
  );
}
