/**
 * ASK R2 A/B/C BLOCKER REPAIR R1 — WHAT A REVISION REMOVED, AS DATA FOR GENERATION.
 *
 * When a follow-up revises the earlier answer by RE-READING its evidence against the corrected
 * question ("My shipment goes through Dar es Salaam, not Mombasa. Revise your answer … and explain
 * what changed"), the corrected evidence gate decides which earlier reports no longer qualify. That
 * is a measured fact, not something the model should guess, and the reader explicitly asked for it.
 * Live Alpha ec50673, C: the Mombasa-only Kenya–Rwanda item was correctly dropped but the answer never
 * said so, because generation was never told.
 *
 * The gate's reasons are internal labels ("not via Mombasa", "route Dar es Salaam"); they are turned
 * into plain reasons here so the model can repeat them truthfully. Nothing is rendered to the reader
 * directly — the model writes the explanation, constrained by these facts.
 */
export interface RereadRemoval {
  readonly title: string;
  readonly missing: readonly string[];
}

function plainReason(missing: readonly string[]): string {
  const excluded = missing.find((m) => m.startsWith('not via '));
  if (excluded !== undefined) {
    return `its only route link is ${excluded.slice('not via '.length)}, which the reader has now ruled out`;
  }
  const route = missing.find((m) => m.startsWith('route '));
  if (route !== undefined) return `it does not name the reader's corrected route (${route.slice('route '.length)})`;
  return 'it no longer matches the corrected question';
}

export function removedFromEarlierAnswer(removals: readonly RereadRemoval[]): string {
  if (removals.length === 0) return '';
  const lines = removals.map((r) => `- "${r.title.replace(/"/g, "'")}" — ${plainReason(r.missing)}.`);
  return (
    'CHANGED SINCE YOUR EARLIER ANSWER (measured by re-checking that answer\'s evidence against the ' +
    "reader's corrected question — these are facts, not guesses):\n" +
    `Removed:\n${lines.join('\n')}\n` +
    'In the brief, after any single-report disclosure, say in one plain sentence what was removed and ' +
    'why (as stated above), then present what remains. Do not invent other changes, and state the ' +
    'single-report disclosure only once.'
  );
}
