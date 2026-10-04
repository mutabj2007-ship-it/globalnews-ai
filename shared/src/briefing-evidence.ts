/**
 * BRIEFING EVIDENCE PRESERVATION — the ONE shared capability check behind "Save as briefing"
 * (CTO Politics ruling: briefings). Used by the backend refusal and by the frontend control state.
 *
 * The question is not "which module answered" but "can the briefing path PRESERVE this answer's evidence?".
 * The briefing snapshot today keeps the news analysis (with its sources), background and computation; it does
 * not carry governed specialist evidence (`payload.intelligence` contributions: observations, citations,
 * revision, provenance). An answer that USED such evidence would be saved as an uncited, weakened copy — so it
 * is not saveable at all. Politics is simply the first contributor to expose this; every specialist is treated
 * the same. GEOGRAPHY is place context, never evidence, so it never blocks a save.
 *
 * When the snapshot learns to carry specialist evidence, flip BRIEFING_SNAPSHOT_CARRIES_SPECIALIST_EVIDENCE —
 * do not add a per-module briefing path.
 */
export const BRIEFING_SNAPSHOT_CARRIES_SPECIALIST_EVIDENCE = false as const;
export const BRIEFING_UNAVAILABLE_SPECIALIST_EVIDENCE = 'BRIEFING_UNAVAILABLE_SPECIALIST_EVIDENCE' as const;
/** Contributors whose output is context, not evidence. */
export const BRIEFING_CONTEXT_ONLY_CONTRIBUTORS: readonly string[] = ['GEOGRAPHY'];

/** True when the answer depends on governed specialist evidence (USED, ≥1 observation, not context-only). */
export function answerUsesSpecialistEvidence(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false;
  const contributions = (payload as { intelligence?: { contributions?: unknown } | null }).intelligence
    ?.contributions;
  if (!Array.isArray(contributions)) return false;
  return contributions.some((c: unknown) => {
    if (c === null || typeof c !== 'object') return false;
    const x = c as { contributorId?: unknown; status?: unknown; observations?: unknown };
    return (
      x.status === 'USED' &&
      Array.isArray(x.observations) &&
      x.observations.length > 0 &&
      !BRIEFING_CONTEXT_ONLY_CONTRIBUTORS.includes(String(x.contributorId))
    );
  });
}

/** Can the briefing path preserve everything this stored Ask answer's claims rest on? Pure. */
export function briefingPreservesEvidence(payload: unknown): boolean {
  return BRIEFING_SNAPSHOT_CARRIES_SPECIALIST_EVIDENCE || !answerUsesSpecialistEvidence(payload);
}
