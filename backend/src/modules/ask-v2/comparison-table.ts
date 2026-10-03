import type { AnalysisApiResponse } from '@globalnews-ai/shared';

/**
 * R2-S1 · ITEM 1 — THE EVIDENCE-LINKED COMPARISON TABLE (CTO checkpoint 3 ruling §11).
 *
 * A DETERMINISTIC PROJECTION of what the validated answer already holds: the analysis's
 * `agreements` and `differences[].positions`, each with its `sourceArticleIds`. No AI call, no
 * retrieval, no new claim: every row is a statement the answer already made, and every row
 * carries the ids of the reports that support it, resolved against the answer's own source list.
 *
 * MISSING STAYS MISSING. An id that is not in the source list is dropped; a row left with no
 * resolvable source is not shown (and is counted, so the reader is told rows were omitted).
 * A table is produced only when there is something to compare (at least two linked rows).
 *
 * Pure and total: the same payload always gives the same table, so it is applied when a stored
 * result is READ (every client read passes through one place), which also covers results stored
 * before this projection existed.
 */
export const COMPARISON_TABLE_SCHEMA = 'ask-comparison-table/1' as const;
export const COMPARISON_TABLE_MAX_ROWS = 12;

export interface ComparisonTableRow {
  readonly kind: 'AGREEMENT' | 'DIFFERENCE';
  /** The difference's topic; null for an agreement. */
  readonly topic: string | null;
  readonly statement: string;
  /** Only ids present in `analysis.sources`, in source-list order. */
  readonly sourceArticleIds: readonly string[];
}

export interface ComparisonTable {
  readonly schema: typeof COMPARISON_TABLE_SCHEMA;
  readonly rows: readonly ComparisonTableRow[];
  /** Rows the answer held that had no resolvable source, or exceeded the row cap. */
  readonly omittedRows: number;
}

export function comparisonTableOf(
  response: AnalysisApiResponse | null | undefined,
): ComparisonTable | null {
  const analysis = response?.analysis;
  if (!analysis) return null;
  const order = new Map<string, number>();
  (analysis.sources ?? []).forEach((s, i) => {
    if (!order.has(s.articleId)) order.set(s.articleId, i);
  });
  const linked = (ids: readonly string[] | undefined): string[] =>
    [...new Set((ids ?? []).filter((id) => order.has(id)))].sort(
      (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );

  const candidates: ComparisonTableRow[] = [];
  for (const d of analysis.differences ?? []) {
    for (const p of d.positions ?? []) {
      candidates.push({
        kind: 'DIFFERENCE',
        topic: d.topic?.trim() || null,
        statement: (p.description ?? '').trim(),
        sourceArticleIds: linked(p.sourceArticleIds),
      });
    }
  }
  for (const a of analysis.agreements ?? []) {
    candidates.push({
      kind: 'AGREEMENT',
      topic: null,
      statement: (a.point ?? '').trim(),
      sourceArticleIds: linked(a.sourceArticleIds),
    });
  }

  const usable = candidates.filter((r) => r.statement.length > 0 && r.sourceArticleIds.length > 0);
  const rows = usable.slice(0, COMPARISON_TABLE_MAX_ROWS);
  if (rows.length < 2) return null;
  return { schema: COMPARISON_TABLE_SCHEMA, rows, omittedRows: candidates.length - rows.length };
}

/**
 * The read-side projection: an `ask-r2-result/1` payload gains `comparisonTable` when its
 * analysis supports one. Anything else is returned untouched (same reference).
 */
export function withComparisonTable<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') return payload;
  const p = payload as {
    schema?: unknown;
    analysis?: AnalysisApiResponse | null;
    comparisonTable?: unknown;
  };
  if (p.schema !== 'ask-r2-result/1' || p.comparisonTable !== undefined) return payload;
  const table = comparisonTableOf(p.analysis);
  return table === null ? payload : ({ ...p, comparisonTable: table } as T);
}
