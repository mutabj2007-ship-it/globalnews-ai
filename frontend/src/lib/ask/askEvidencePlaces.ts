import { COUNTRIES, getLocalizedCountryName, type DisplayLocale, type NewsArticle } from '@globalnews-ai/shared';
import type { AnalysisSourceRef } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MASTER CTO R32 · D10 — WHERE THE CITED REPORTS ARE, INSIDE THE ANSWER (no map)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The answer contract carries no coordinates, no answer-level precision and no place provenance
 * (shared/src/news.ts: no latitude, longitude, city or region per article). What it does carry is
 * the country recorded for each evidence article (`NewsArticle.countryCode`, ISO alpha-2). So the
 * truthful geographic context is a country-level list over THIS answer's own cited reports — the
 * same `analysis.sources` array its citations number against — never a map, a route or a pin.
 *
 * A cited report whose country is not recorded, not in the registry, or is a DR Congo / Republic of
 * the Congo identity, is counted under "Location not established". The Congo identities stay there
 * while the Congo evidence repair (backend B-1 / R-1, successor 4627963) is on HOLD — the same
 * fail-closed rule the place research action already follows (ChoosePlace PLACE_RESEARCH_HELD_ISO3):
 * a stored code is not evidence of which Congo a report is about.
 */
const IDENTITY_HELD_ISO2: ReadonlySet<string> = new Set(['CD', 'CG']);

export interface EvidencePlace {
  readonly iso2: string;
  readonly iso3: string;
  /** The country's name in the reader's locale (shared CLDR lookup). */
  readonly name: string;
  readonly reports: number;
}

export interface EvidencePlaces {
  /** Most-cited first, then by name. */
  readonly places: readonly EvidencePlace[];
  /** Cited reports with no established country. */
  readonly notEstablished: number;
}

/** Null when the answer cites no report: there is nothing to place. */
export function evidencePlacesOf(
  sources: readonly Pick<AnalysisSourceRef, 'articleId'>[],
  articles: readonly Pick<NewsArticle, 'id' | 'countryCode'>[],
  locale: DisplayLocale,
): EvidencePlaces | null {
  if (sources.length === 0) return null;
  const byId = new Map(articles.map((article) => [article.id, article]));
  const counts = new Map<string, number>();
  let notEstablished = 0;
  for (const source of sources) {
    const code = byId.get(source.articleId)?.countryCode?.trim().toUpperCase();
    const meta = code === undefined || IDENTITY_HELD_ISO2.has(code) ? undefined : COUNTRIES.find((c) => c.iso2 === code);
    if (meta === undefined) {
      notEstablished += 1;
      continue;
    }
    counts.set(meta.iso2, (counts.get(meta.iso2) ?? 0) + 1);
  }
  const places = [...counts.entries()]
    .map(([iso2, reports]) => {
      const meta = COUNTRIES.find((c) => c.iso2 === iso2)!;
      return { iso2, iso3: meta.iso3, name: getLocalizedCountryName(iso2, locale) ?? meta.name, reports };
    })
    .sort((a, b) => b.reports - a.reports || a.name.localeCompare(b.name, locale));
  return { places, notEstablished };
}
