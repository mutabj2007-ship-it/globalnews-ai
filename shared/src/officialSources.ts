/**
 * M64.1 — Official Source Registry contract.
 *
 * These types describe authoritative institutional sources (election
 * authorities, statistics agencies, central banks, governments,
 * courts, international organizations, news agencies/publishers,
 * research bodies) as reusable, typed data — never hardcoded into
 * unrelated service code (per the M64 audit's explicit finding: do
 * not hardcode IEBC, Rwanda institutions, Polish institutions, etc.
 * throughout backend services).
 *
 * M64.1 SCOPE: contracts and an empty registry only. No real
 * institutional entries are seeded in this milestone.
 */

export type OfficialSourceClass =
  | 'OFFICIAL_ELECTION_AUTHORITY'
  | 'OFFICIAL_STATISTICS'
  | 'CENTRAL_BANK'
  | 'GOVERNMENT'
  | 'COURT'
  | 'INTERNATIONAL_ORGANIZATION'
  | 'NEWS_AGENCY'
  | 'NEWS_PUBLISHER'
  | 'RESEARCH'
  | 'OTHER';

/**
 * CTO correction — M64.1 does not authorize or introduce scraping
 * infrastructure. 'manual' replaces the earlier proposed
 * 'scrape-manual-review': it names the same "no automated ingestion
 * exists for this entry yet" state honestly, without implying a
 * scraping pipeline is part of this milestone's scope.
 */
export type OfficialSourceIngestionMethod = 'api' | 'rss' | 'manual' | 'none';

export interface OfficialSourceEntry {
  /** Stable slug, e.g. 'iebc-kenya'. */
  id: string;
  name: string;

  /** ISO2, joins CountryMeta (countries.ts). Absent for INTERNATIONAL_ORGANIZATION entries. */
  countryCode?: string;

  languages: string[];
  authorityClass: OfficialSourceClass;
  baseUrl: string;

  /** Human-readable. Never a fabricated numeric "trust score". */
  reliabilityNote?: string;

  enabled: boolean;
  ingestionMethod: OfficialSourceIngestionMethod;

  /** Who added this entry and on what basis — an audit trail for the registry itself, not for the institution it describes. */
  provenanceNote: string;
}
