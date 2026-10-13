/**
 * EA-GEO-R1 G-4 — which admitted reports count for ONE compared country.
 *
 * A comparison's per-country coverage used to count only the reports that country's OWN search
 * returned, so a Rwanda report found by the anchored "Rwanda economy" supplement left Rwanda at 0
 * while the evidence held Rwanda reporting — and that coverage block is sent to the model as
 * authoritative. A supplement report now counts for a country when it EVIDENCES that country by
 * the same per-side admission rule the comparison already applies to retained reporting
 * (`evidences`). Nothing is counted twice, and a report that evidences only Kenya never counts for
 * Rwanda, however many there are.
 */
export function supplementCredit<A extends { readonly id: string }>(
  finalEvidence: readonly A[],
  ownIds: { readonly live: ReadonlySet<string>; readonly retained: ReadonlySet<string> },
  supplement: { readonly live: ReadonlySet<string>; readonly retained: ReadonlySet<string> },
  evidences: (article: A) => boolean,
): { readonly live: number; readonly retained: number } {
  let live = 0;
  let retained = 0;
  for (const article of finalEvidence) {
    if (ownIds.live.has(article.id) || ownIds.retained.has(article.id)) continue;
    const fromLive = supplement.live.has(article.id);
    if (!fromLive && !supplement.retained.has(article.id)) continue;
    if (!evidences(article)) continue;
    if (fromLive) live += 1;
    else retained += 1;
  }
  return { live, retained };
}
