import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { comparisonTableOf, type ComparisonTable } from '../comparison-table';

/**
 * R2 · D1 — WHAT A BRIEFING VERSION KEEPS, projected from one stored Ask R2 result.
 *
 * OUR OUTPUT AND EVIDENCE REFERENCES, NEVER SOURCE TEXT. A version holds the validated answer
 * prose we produced, its key facts and comparison rows (each with source ids), any deterministic
 * computation, and for each cited source only: id, publisher host, link, headline and
 * publication time — what a reader needs to check the briefing, not a copy of the article.
 * Model background text (never sourced) is kept only with `citable: false`.
 *
 * Pure: the same payload always gives the same snapshot; no AI, no clock, no retrieval.
 */
export const BRIEFING_BLOCKS_SCHEMA = 'briefing-blocks/1' as const;

export interface BriefingEvidenceRef {
  readonly id: string;
  readonly host: string | null;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
}

export interface BriefingBlocks {
  readonly schema: typeof BRIEFING_BLOCKS_SCHEMA;
  readonly answerState: string | null;
  /** The validated analysis summary (sourced), or null. */
  readonly summary: string | null;
  readonly keyFacts: readonly {
    readonly claim: string;
    readonly sourceArticleIds: readonly string[];
  }[];
  readonly comparisonTable: ComparisonTable | null;
  readonly computation: unknown;
  /** Non-sourced model background, explicitly never citable. */
  readonly background: { readonly text: string; readonly citable: false } | null;
}

export interface BriefingSnapshot {
  readonly asOf: string;
  readonly blocks: BriefingBlocks;
  readonly evidenceRefs: readonly BriefingEvidenceRef[];
  readonly coverageGaps: readonly string[];
}

interface StoredR2Payload {
  readonly schema?: unknown;
  readonly answer?: { readonly state?: unknown } | null;
  readonly checkedAt?: unknown;
  readonly analysis?: AnalysisApiResponse | null;
  readonly background?: { readonly text?: unknown } | null;
  readonly computation?: unknown;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

/** Null when the payload is not a completed Ask R2 result a briefing can be made from. */
export function briefingSnapshotOf(payload: unknown): BriefingSnapshot | null {
  if (payload === null || typeof payload !== 'object') return null;
  const p = payload as StoredR2Payload;
  if (p.schema !== 'ask-r2-result/1' || typeof p.checkedAt !== 'string') return null;
  const analysis = p.analysis?.analysis ?? null;
  const sources = analysis?.sources ?? [];
  const known = new Set(sources.map((s) => s.articleId));
  const linked = (ids: readonly string[] | undefined) => (ids ?? []).filter((id) => known.has(id));
  const backgroundText = typeof p.background?.text === 'string' ? p.background.text : null;
  const summary = analysis?.summary?.trim() ? analysis.summary : null;
  if (summary === null && backgroundText === null) return null;

  const answerState = typeof p.answer?.state === 'string' ? p.answer.state : null;
  const gaps = [...(analysis?.unknowns ?? [])].filter((u) => typeof u === 'string' && u.trim());
  return {
    asOf: p.checkedAt,
    blocks: {
      schema: BRIEFING_BLOCKS_SCHEMA,
      answerState,
      summary,
      keyFacts: (analysis?.keyFacts ?? [])
        .map((f) => ({ claim: f.claim, sourceArticleIds: linked(f.sourceArticleIds) }))
        .filter((f) => f.sourceArticleIds.length > 0),
      comparisonTable: comparisonTableOf(p.analysis),
      computation: p.computation ?? null,
      background: backgroundText === null ? null : { text: backgroundText, citable: false },
    },
    evidenceRefs: sources.map((s) => ({
      id: s.articleId,
      host: hostOf(s.url),
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      publishedAt: s.publishedAt ?? null,
    })),
    coverageGaps: summary === null ? ['NO_SOURCED_ANSWER', ...gaps] : gaps,
  };
}
