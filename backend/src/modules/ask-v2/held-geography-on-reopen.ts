import { isGeoQuarantined, withoutHeldGeography } from '../news/geo-quarantine/geo-identity-quarantine';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * MASTER CTO P0 #85 · E1 M-1 — THE DISPLAY REOPEN USES THE SAME LOCATION-HOLD PREDICATE.
 *
 * A stored answer is shown again, display-only, by GET /operations/:id. Its evidence list
 * (`analysis.articles[]`) was persisted with each report's country as it was believed at answer
 * time; for the held reports that is the unsupported CG (measured read-only on Alpha: the only
 * CG/COG values in the one stored answer citing them are `analysis.articles[].countryCode`). At read
 * time, held items lose their country fields (withoutHeldGeography: countryCode / countryName
 * removed, a derived precision reads 'unknown'), and a held item is not listed in a per-country
 * companion list (`recentReporting.items`, which lists reports FOR a country). The stored record
 * is not changed; any other payload is returned as it was (the same object).
 *
 * Generated prose cannot be re-resolved here (E1 M-2): measured 0 occurrences on Alpha; recorded in
 * the candidate report for an owner and a date.
 */
export function withHeldGeographyWithdrawn(payload: unknown): unknown {
  if (!isObject(payload)) return payload;
  let out: Json = payload;

  const analysis = payload.analysis;
  if (isObject(analysis) && Array.isArray(analysis.articles)) {
    const articles = analysis.articles as unknown[];
    const mapped = articles.map((a) => (isObject(a) ? withoutHeldGeography(a as Json & { id?: string; url?: string }) : a));
    if (mapped.some((a, i) => a !== articles[i])) out = { ...out, analysis: { ...analysis, articles: mapped } };
  }

  const recent = payload.recentReporting;
  if (isObject(recent) && Array.isArray(recent.items)) {
    const items = recent.items as unknown[];
    const kept = items.filter((i) => !(isObject(i) && isGeoQuarantined(i as { id?: string; url?: string })));
    if (kept.length !== items.length) out = { ...out, recentReporting: { ...recent, items: kept } };
  }

  return out;
}
