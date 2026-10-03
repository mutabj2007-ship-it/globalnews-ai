import { findCountryByIso3, type CountryMeta, type NewsArticle } from '@globalnews-ai/shared';
import {
  COUNTRY_DEMONYMS_BY_ISO3,
  normalizeForCountryMatch,
  scoreCountryRelevance,
} from '../../news/country/country-relevance.util';
import { relationKindsIn, type RelationKind } from '../../ask-router/bilateral-relationship';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 §14 / §44 / PO-02 — RELATIONSHIP EVIDENCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A question about what happens BETWEEN Rwanda and Tanzania is answered from reports about that
 * relationship — not from Rwanda news plus Tanzania news. An item qualifies only if ITS OWN TEXT:
 *
 *   1  is about BOTH sides (the country gate, a name, or a demonym for each), and
 *   2  when the reader named a specific relation (border, corridor, trade, transport, energy…),
 *      shows that relation's vocabulary — a report that both presidents attended a summit is
 *      not border-commerce evidence.
 *
 * Geography and recency are never a proxy for relevance. Deterministic: no model, no provider.
 */
export interface RelationshipScope {
  readonly countries: readonly string[];
  readonly relations: readonly RelationKind[];
}

/** Relations that ANY two-sided report speaks to (a general or diplomatic question). */
/* CTO R4 fourth pass — the historical / competitive framings are not narrower evidence classes */
const BROAD: ReadonlySet<RelationKind> = new Set([
  'GENERAL',
  'DIPLOMATIC',
  'HISTORICAL_RELATION',
  'COMPETITION',
]);

function mentions(article: Pick<NewsArticle, 'title' | 'summary'>, country: CountryMeta): boolean {
  if (scoreCountryRelevance(article, country).isRelevant) return true;
  const text = ` ${normalizeForCountryMatch(`${article.title ?? ''} ${article.summary ?? ''}`)} `;
  const forms = [country.name, ...(COUNTRY_DEMONYMS_BY_ISO3[country.iso3] ?? [])]
    .map((f) => normalizeForCountryMatch(f))
    .filter((f) => f.length >= 4);
  return forms.some((f) => text.includes(` ${f} `));
}

export function evidencesRelationship(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  scope: RelationshipScope,
): boolean {
  const sides = scope.countries
    .map((iso3) => findCountryByIso3(iso3))
    .filter((c): c is CountryMeta => c !== undefined);
  if (sides.length !== 2 || !sides.every((side) => mentions(article, side))) return false;
  const specific = scope.relations.filter((r) => !BROAD.has(r));
  if (specific.length === 0) return true;
  const shown = relationKindsIn(`${article.title ?? ''} ${article.summary ?? ''}`);
  return specific.some((r) => shown.includes(r));
}
