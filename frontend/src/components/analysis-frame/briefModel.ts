import type { AnalysisApiResponse, NewsAnalysisResult } from '@globalnews-ai/shared';

/**
 * PAF-R1 — what the persistent brief is allowed to say, and where every
 * word of it comes from.
 *
 * RULING 2, IMPLEMENTED HERE SO IT CANNOT BE FORGOTTEN IN JSX.
 *
 * ORDINARY ANALYSIS. The contract supplies `headline` (a title) and
 * `summary` (a PARAGRAPH). It supplies no one-sentence thesis clause —
 * no such field exists anywhere in NewsAnalysisResult. Handoff §9 item 3
 * classifies the clause Class C "optional when available"; that
 * condition is therefore permanently false on this path. `clause` is
 * null, the compressed band renders title + telemetry, and `summary` is
 * NEVER sliced, truncated, re-summarised or regex'd to manufacture one.
 *
 * RELATIONAL ANALYSIS. `relationalComposition.summary` is a real
 * one-sentence reduction — "selected from a fixed backend template set,
 * never model prose". The contract also attaches a duty to it:
 *
 *   "when present, relationalComposition.summary is the authoritative
 *    answer to the user's relational question — headline and summary
 *    above remain legacy orientation prose only ... and must NOT be
 *    presented as if they resolve a relational question. Enforcing this
 *    at render time is REQUIRED FUTURE WORK for the frontend milestone
 *    that consumes this field."
 *
 * PAF-R1 is that milestone, so `titleIsOrientationOnly` is set and the
 * band labels the title accordingly. That is the whole reason this
 * module exists as a separate, tested unit rather than an inline ternary.
 */

export interface BriefModel {
  /** `analysis.headline`, verbatim. Never derived from the summary. */
  readonly title: string;
  /**
   * The one-sentence reduction for the COMPRESSED band. Non-null only
   * for a relational analysis, where the backend authored it. Null on
   * every ordinary analysis — see RULING 2.
   */
  readonly clause: string | null;
  /** `analysis.summary`, verbatim, for the EXPANDED band only. */
  readonly paragraph: string;
  /**
   * True when `relationalComposition` is present: the title is legacy
   * orientation prose and must not be shown as the answer.
   */
  readonly titleIsOrientationOnly: boolean;
  /** Where `clause` came from, so the surface can be audited. */
  readonly clauseSource: 'relational-composition' | 'unavailable';
  readonly generatedAt: string | null;
}

export const ABSENT_BRIEF: BriefModel = {
  title: '',
  clause: null,
  paragraph: '',
  titleIsOrientationOnly: false,
  clauseSource: 'unavailable',
  generatedAt: null,
};

export function buildBriefModel(response: AnalysisApiResponse): BriefModel {
  const analysis: NewsAnalysisResult | null = response.analysis;
  if (analysis === null) return ABSENT_BRIEF;

  const relational = analysis.relationalComposition;
  const hasRelational = relational !== undefined && relational !== null;

  const clause =
    hasRelational && typeof relational.summary === 'string' && relational.summary.trim().length > 0
      ? relational.summary
      : null;

  return {
    title: analysis.headline,
    clause,
    // Verbatim. `analysisClaims.ts` already pins this for the existing
    // workspace — "Never re-summarised, never trimmed of content" — and
    // the frame inherits the same rule.
    paragraph: analysis.summary,
    titleIsOrientationOnly: hasRelational,
    clauseSource: clause === null ? 'unavailable' : 'relational-composition',
    generatedAt: analysis.generatedAt,
  };
}

/**
 * The only figures the brief's telemetry row may state, each traced to a
 * contract field. No score, no percentage, no invented count.
 */
export interface BriefTelemetry {
  readonly retrievedArticleCount: number | null;
  readonly reportingClusterCount: number | null;
  readonly unresolvedCount: number | null;
}

export function buildBriefTelemetry(
  response: AnalysisApiResponse,
  unresolvedCount: number | null,
): BriefTelemetry {
  const diversity = response.sourceDiversity;
  return {
    retrievedArticleCount: diversity?.retrievedArticleCount ?? null,
    reportingClusterCount: diversity?.reportingClusterCount ?? null,
    unresolvedCount,
  };
}

/**
 * H-ALPHA-VISUAL-1 H-2 — LAYOUT ONLY, NEVER EDITORIAL.
 *
 * Main's evidence-proportional synthesis returns multiple paragraphs in
 * one `analysis.summary` string, separated by blank lines. Rendering that
 * in a single <p> collapses them into one slab.
 *
 * This splits on blank lines FOR LAYOUT and does nothing else: no
 * re-summarising, no slicing, no reordering, no sentence detection. Join
 * the result with a blank line and you have the input back, which is what
 * the spec asserts. A string with no blank line yields exactly one
 * paragraph, so every pre-existing single-paragraph summary is unchanged.
 */
export function splitSynthesisParagraphs(paragraph: string): readonly string[] {
  const parts = paragraph
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [paragraph];
}
