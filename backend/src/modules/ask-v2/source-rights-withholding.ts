/*
  E1-TAARIFA-RIGHTS-RULING-R2 §8.2 step 3 — a STORED answer derived from sources that are not
  cleared for AI use is WITHHELD from every reader surface, not deleted: the stored record stays
  unchanged for audit, and what a reader receives says it is withheld pending a source-rights review.

  Decided at read time from the payload's own evidence (analysis.articles[].sourceId) with the same
  governed policy every new answer uses, so a later clearance re-admits it and a later restriction
  withholds it — no data rewrite either way. A metadata list (recentReporting) keeps only items the
  METADATA decision admits. Pure; no I/O.
*/
import { partitionByRights } from '../news/rights/source-use-policy';

export const WITHHELD_BASIS = 'WITHHELD_SOURCE_RIGHTS' as const;

type Json = Record<string, unknown>;

const articlesOf = (payload: Json): Array<{ sourceId?: string | null; providerId?: string | null }> => {
  const analysis = payload.analysis as Json | null | undefined;
  const list = analysis?.articles;
  return Array.isArray(list) ? (list as Array<{ sourceId?: string | null; providerId?: string | null }>) : [];
};

export function withheldForSourceRights(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const p = payload as Json;
  const excluded = partitionByRights(articlesOf(p), 'AI_INPUT').excluded;

  let out: Json = p;
  const recent = p.recentReporting as Json | null | undefined;
  if (recent && Array.isArray(recent.items)) {
    const items = partitionByRights(recent.items as Array<{ sourceId?: string | null }>, 'METADATA').allowed;
    if (items.length !== (recent.items as unknown[]).length) out = { ...out, recentReporting: { ...recent, items } };
  }
  if (excluded.length === 0) return out;

  const answer = (p.answer as Json | undefined) ?? {};
  return {
    ...out,
    answer: { ...answer, state: 'INSUFFICIENT', basis: WITHHELD_BASIS, missingRoles: [] },
    analysis: null,
    background: null,
    recentReporting: null,
    comparisonTable: null,
    artifact: null,
    intelligence: null,
    withheld: { reason: 'SOURCE_RIGHTS', count: excluded.length },
  };
}

/**
 * MASTER CTO P0 RIGHTS CONTAINMENT R1.1 — may an earlier answer's points reach the model again?
 * Model-reasoning answers carry no source content (yes). A SOURCED answer only when every evidence
 * reference still resolves (through the store, which cannot return a held source) to an article
 * usable as AI input; no references, too many to check, an unresolvable one or a failed read → no.
 */
export async function priorWorkRightsClearedWith(
  artifact: { readonly provenance?: string; readonly evidenceRefs?: readonly string[] },
  findArticleById: ((id: string) => Promise<{ sourceId?: string | null; providerId?: string | null } | null>) | undefined,
  maxRefs: number,
): Promise<boolean> {
  if (artifact.provenance !== 'SOURCED_REPORTING') return true;
  const refs = artifact.evidenceRefs ?? [];
  if (refs.length === 0 || refs.length > maxRefs || findArticleById === undefined) return false;
  try {
    const found = await Promise.all(refs.map((id) => findArticleById(id)));
    if (found.some((a) => a === null)) return false;
    return partitionByRights(found as Array<{ sourceId?: string | null; providerId?: string | null }>, 'AI_INPUT').excluded.length === 0;
  } catch {
    return false;
  }
}
