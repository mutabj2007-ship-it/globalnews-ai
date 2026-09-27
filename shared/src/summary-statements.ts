/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK INLINE EVIDENCE CITATIONS + INFERENCE LABEL R1 — THE SUMMARY STATEMENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS. `NewsAnalysisResult.summary` is plain prose. Nothing in it
 * says which sentence rests on which article, so a reader saw an answer and a
 * source list with no way to connect them — and a sentence such as "could
 * potentially affect military operations" read exactly like a reported fact.
 *
 * WHAT IT IS. An optional, additive list of statements, each an EXACT span of
 * `summary`, each carrying a kind and — only for reported kinds — the article
 * ids the backend validated for that very span. It never replaces or rewrites
 * `summary`; every surface that renders the plain summary is unchanged, and a
 * result without statements renders exactly as before.
 *
 * THE FOUR KINDS, one presentation contract:
 *   REPORTED_FACT         the reporting states it. Cited.
 *   REPORTED_CONSEQUENCE  the reporting itself links an effect to the subject. Cited.
 *   ANALYTICAL_INFERENCE  a wider implication no evidence item reports. Labelled,
 *                         never cited — a citation would imply a source said it.
 *   UNSUPPORTED           backend-assigned only: written as reported, but no
 *                         validated evidence supports it for this span (or, for an
 *                         anchored event, only context evidence does). Labelled,
 *                         never cited, never presented as fact.
 */

export type SummaryStatementKind =
  | 'REPORTED_FACT'
  | 'REPORTED_CONSEQUENCE'
  | 'ANALYTICAL_INFERENCE'
  | 'UNSUPPORTED';

export interface SummaryStatement {
  /** An exact, trimmed span of `summary`. Statements appear in summary order and never overlap. */
  readonly text: string;
  readonly kind: SummaryStatementKind;
  /**
   * Real article ids, validated for THIS span. Non-empty for the two reported
   * kinds and always empty for ANALYTICAL_INFERENCE and UNSUPPORTED.
   */
  readonly sourceArticleIds: readonly string[];
}

export interface SummarySegment {
  readonly text: string;
  /** Present when this segment is exactly one statement's span. */
  readonly statement?: SummaryStatement;
}

/**
 * Splits one piece of summary text into plain segments and statement segments.
 *
 * THE ONE PLACEMENT AUTHORITY. The backend uses it to decide which statements
 * survive validation, and the frontend uses it to render them, so a statement
 * the backend accepted is always placed where the backend placed it. Placement
 * is a forward-only exact match: each statement must occur at or after the end
 * of the previous one. A statement that does not occur is simply not placed —
 * its text is never inserted, so nothing can be rendered that `summary` does
 * not already contain.
 */
export function projectSummaryStatements(
  text: string,
  statements: readonly SummaryStatement[] | undefined,
): { segments: SummarySegment[]; placed: SummaryStatement[] } {
  const segments: SummarySegment[] = [];
  const placed: SummaryStatement[] = [];
  let cursor = 0;

  for (const statement of statements ?? []) {
    if (statement.text.length === 0) continue;
    const at = text.indexOf(statement.text, cursor);
    if (at < 0) continue;
    if (at > cursor) segments.push({ text: text.slice(cursor, at) });
    segments.push({ text: statement.text, statement });
    placed.push(statement);
    cursor = at + statement.text.length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return { segments, placed };
}
