import { COUNTRIES, findCountryByIso3, type CountryMeta, type NewsArticle } from '@globalnews-ai/shared';
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

/*
  CTO ALPHA CONTENT-INTEGRITY R1 (B) — DIRECT BILATERAL EVIDENCE, NOT REGIONAL CONTEXT.

  `evidencesRelationship` asks only that both sides and the relation's vocabulary appear. A regional
  item passes that too: live Alpha 2026-10-09 (op 05242618), an East Africa–China business programme
  naming Tanzania and Rwanda among its participants was admitted as Tanzania–Rwanda trade-and-
  transport evidence, and the answer read a corridor change into it. A report is DIRECT evidence of
  the relationship only if its own text is about the two sides as such:

    • it names no third country and its headline frames nothing as a bloc/regional initiative, or
    • its HEADLINE names both sides, no third country and no bloc (a bilateral story whose body
      mentions others — "Rwanda, Tanzania agree rail link; Uganda to join later").
  A geographic adjective ("the two East African neighbours") never demotes a bilateral report.

  Otherwise it is REGIONAL_CONTEXT: it may concern the region, but it does not establish a
  bilateral change and is never admitted as evidence of one. Deterministic: no model, no provider.
*/
export type RelationshipEvidenceClass = 'DIRECT' | 'REGIONAL_CONTEXT' | 'NONE';

const BLOC_FRAME =
  /(?:^| )(?:east african community|eac|sadc|comesa|afcfta|african union|bloc|partner states|member states|multilateral)(?= |$)/u;

function nameForms(country: CountryMeta): string[] {
  return [country.name, ...(COUNTRY_DEMONYMS_BY_ISO3[country.iso3] ?? [])]
    .map((f) => normalizeForCountryMatch(f))
    .filter((f) => f.length >= 4);
}

/** Every third country named (by name or demonym) in a normalised text. */
function namesThirdCountry(text: string, sides: readonly string[]): boolean {
  const padded = ` ${text} `;
  return COUNTRIES.some(
    (c) => !sides.includes(c.iso3) && nameForms(c).some((f) => padded.includes(` ${f} `)),
  );
}

export function relationshipEvidenceClass(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  scope: RelationshipScope,
): RelationshipEvidenceClass {
  if (!evidencesRelationship(article, scope)) return 'NONE';
  const sides = scope.countries;
  const title = normalizeForCountryMatch(article.title ?? '');
  const body = normalizeForCountryMatch(`${article.title ?? ''} ${article.summary ?? ''}`);
  if (!namesThirdCountry(body, sides) && !BLOC_FRAME.test(title)) return 'DIRECT';
  const sideCountries = sides
    .map((iso3) => findCountryByIso3(iso3))
    .filter((c): c is CountryMeta => c !== undefined);
  const titleNamesBoth =
    sideCountries.length === 2 &&
    sideCountries.every((c) => nameForms(c).some((f) => ` ${title} `.includes(` ${f} `)));
  if (titleNamesBoth && !namesThirdCountry(title, sides) && !BLOC_FRAME.test(title)) return 'DIRECT';
  return 'REGIONAL_CONTEXT';
}

/** Only DIRECT bilateral reporting is evidence for a question about the relationship itself. */
export function directlyEvidencesRelationship(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  scope: RelationshipScope,
): boolean {
  return relationshipEvidenceClass(article, scope) === 'DIRECT';
}
