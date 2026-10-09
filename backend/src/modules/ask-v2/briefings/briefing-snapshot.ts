import type { AnalysisApiResponse } from '@globalnews-ai/shared';
import { comparisonTableOf, type ComparisonTable } from '../comparison-table';
import type { AskContribution } from '../../ask-intelligence/ask-contribution.contract';

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
  /**
   * EAST AFRICA P0 · A — the governed specialist basis of the answer (payload.intelligence),
   * kept exactly as the answer carried it: which contributors were considered, and each
   * contribution's status, temporal basis, disclosures and source-attributed observations.
   * Null when no specialist was considered. Absent on versions saved before this field existed
   * (unknown, not "none").
   */
  readonly intelligence: BriefingIntelligence | null;
}

export interface BriefingIntelligence {
  readonly considered: readonly string[];
  readonly contributions: readonly AskContribution[];
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
  readonly intelligence?: unknown;
}

/** payload.intelligence as written by the execution adapter, or null; never rebuilt or re-read. */
function intelligenceOf(value: unknown): BriefingIntelligence | null {
  if (value === null || typeof value !== 'object') return null;
  const { considered, contributions } = value as Record<string, unknown>;
  if (!Array.isArray(considered) || !considered.every((c) => typeof c === 'string')) return null;
  if (!Array.isArray(contributions)) return null;
  if (!contributions.every((c) => c !== null && typeof c === 'object')) return null;
  return {
    considered: considered as string[],
    contributions: contributions as AskContribution[],
  };
}

/*
  A contribution an answer can rest on as its sourced basis: USED, not context, not reference
  geography (by contributor, temporal basis or disclosure), with at least one observation that names
  its source. NO_DATA / NO_MATCH / REFUSED / DEGRADED / NOT_ASSESSED, a place resolution and a
  source-less record never make an answer citable. Mirrored in the frontend BriefingVersionView.
*/
function isGovernedBasis(c: AskContribution): boolean {
  return (
    c.status === 'USED' &&
    c.applicability !== 'CONTEXT' &&
    c.contributorId !== 'GEOGRAPHY' &&
    c.temporalBasis !== 'REFERENCE_GEOGRAPHY' &&
    c.temporalBasis !== 'NONE' &&
    !(c.disclosures ?? []).includes('CONTEXT_NOT_EVIDENCE') &&
    (c.observations ?? []).some((o) => typeof o?.source?.name === 'string' && o.source.name.trim() !== '')
  );
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
  const intelligence = intelligenceOf(p.intelligence);
  /*
    PRIMARILY STRUCTURED ANSWERS (found in the Opportunities intake, affects Alpha today): a
    governed-record answer (RETAINED_RECORD — Imihigo, a retained Conflict record) has no news
    summary and no background; its whole basis is payload.intelligence. The frontend offers Save /
    Follow for it, but the snapshot used to refuse it (BRIEFING_TURN_NOT_SAVEABLE). It is saveable
    when it rests on at least one USED, non-context governed observation — stored verbatim.
  */
  const governedBasis = (intelligence?.contributions ?? []).some(isGovernedBasis);
  if (summary === null && backgroundText === null && !governedBasis) return null;

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
      intelligence,
    },
    evidenceRefs: sources.map((s) => ({
      id: s.articleId,
      host: hostOf(s.url),
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      publishedAt: s.publishedAt ?? null,
    })),
    /* a governed-record answer is sourced (by its records), so it is not "no sourced answer" */
    coverageGaps: summary === null && !governedBasis ? ['NO_SOURCED_ANSWER', ...gaps] : gaps,
  };
}
