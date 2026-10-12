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
import { isPublisherRightsHeld } from '../news/rights/publisher-rights-hold';

export const WITHHELD_BASIS = 'WITHHELD_SOURCE_RIGHTS' as const;

type Json = Record<string, unknown>;

const articlesOf = (payload: Json): Array<{ sourceId?: string | null; providerId?: string | null; url?: string | null }> => {
  const analysis = payload.analysis as Json | null | undefined;
  const list = analysis?.articles;
  return Array.isArray(list) ? (list as Array<{ sourceId?: string | null; providerId?: string | null; url?: string | null }>) : [];
};

export function withheldForSourceRights(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const p = payload as Json;
  const excluded = partitionByRights(articlesOf(p), 'AI_INPUT').excluded;

  let out: Json = p;
  const recent = p.recentReporting as Json | null | undefined;
  if (recent && Array.isArray(recent.items)) {
    const items = partitionByRights(recent.items as Array<{ sourceId?: string | null; url?: string | null }>, 'METADATA').allowed;
    if (items.length !== (recent.items as unknown[]).length) out = { ...out, recentReporting: { ...recent, items } };
  }
  if (excluded.length === 0) return out;
  return withheldPayload(out, p, excluded.length);
}

function withheldPayload(out: Json, p: Json, count: number): Json {
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
    withheld: { reason: 'SOURCE_RIGHTS', count },
  };
}

/**
 * MASTER CTO R4 · P0 #86 — the SAME withheld shape, decided by the publisher rights hold ONLY.
 * Briefing snapshots never passed the read-time withholding at all (a pre-existing bypass for every
 * rights class); #86 is source-specific, so a briefing is withheld here only when its answer rests on
 * a held publisher host. Widening it to every rights class is a separate CTO / E1 decision.
 */
export function withheldForPublisherRightsHold(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const p = payload as Json;
  const held = articlesOf(p).filter((a) => isPublisherRightsHeld(a)).length;
  let out: Json = p;
  const recent = p.recentReporting as Json | null | undefined;
  if (recent && Array.isArray(recent.items)) {
    const items = (recent.items as Array<{ url?: string | null }>).filter((i) => !isPublisherRightsHeld(i));
    if (items.length !== (recent.items as unknown[]).length) out = { ...out, recentReporting: { ...recent, items } };
  }
  return held === 0 ? out : withheldPayload(out, p, held);
}

/**
 * MASTER CTO P0 RIGHTS CONTAINMENT R1.1 — may an earlier answer's points reach the model again?
 * Model-reasoning answers carry no source content (yes). A SOURCED answer only when every evidence
 * reference still resolves (through the store, which cannot return a held source) to an article
 * usable as AI input; no references, too many to check, an unresolvable one or a failed read → no.
 */
export async function priorWorkRightsClearedWith(
  artifact: { readonly provenance?: string; readonly evidenceRefs?: readonly string[] },
  findArticleById: ((id: string) => Promise<{ sourceId?: string | null; providerId?: string | null; url?: string | null } | null>) | undefined,
  maxRefs: number,
): Promise<boolean> {
  if (artifact.provenance !== 'SOURCED_REPORTING') return true;
  const refs = artifact.evidenceRefs ?? [];
  if (refs.length === 0 || refs.length > maxRefs || findArticleById === undefined) return false;
  try {
    const found = await Promise.all(refs.map((id) => findArticleById(id)));
    if (found.some((a) => a === null)) return false;
    return partitionByRights(found as Array<{ sourceId?: string | null; providerId?: string | null; url?: string | null }>, 'AI_INPUT').excluded.length === 0;
  } catch {
    return false;
  }
}
