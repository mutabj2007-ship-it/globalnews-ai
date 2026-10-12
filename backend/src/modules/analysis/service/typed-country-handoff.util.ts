/**
 * EA-GEO-R1 G-1 (P0) — the typed country Analysis retrieves, given its own text reading and the ONE
 * country the Ask router resolved from the same words on the server. The route VALIDATES; it never
 * adds a scope.
 *
 *   no route country   → text (every /analysis caller, and every Ask turn without one typed country)
 *   both, same         → that country
 *   both, different    → none, `disputed`: an identity two server readers dispute is not
 *                        established, so retrieval falls back to ordinary search rather than
 *                        searching either country's feed (Congo - Kinshasa was retrieved as COG)
 *   route only         → none (text). Filling the gap would move a question such as "What has
 *                        changed in Kenya's economy?" from the generic search to the country feed:
 *                        a retrieval-path change, not an identity repair, and not qualified here.
 */
export function reconcileTypedCountry<T extends { readonly country: { readonly iso3: string } }>(
  text: T | undefined,
  route: T | undefined,
): { readonly location: T | undefined; readonly disputed: boolean } {
  if (route === undefined || text === undefined) return { location: text, disputed: false };
  return text.country.iso3 === route.country.iso3
    ? { location: text, disputed: false }
    : { location: undefined, disputed: true };
}
