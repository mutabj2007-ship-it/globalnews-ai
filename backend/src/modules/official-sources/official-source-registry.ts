import type { OfficialSourceClass, OfficialSourceEntry } from '@globalnews-ai/shared';

/**
 * M64.1 — Official Source Registry: reusable contract + lookup
 * helpers, so authoritative institutional sources are never hardcoded
 * throughout unrelated service code (per the M64 audit's explicit
 * finding: do not hardcode IEBC, Rwanda institutions, Polish
 * institutions, etc. directly into service code).
 *
 * M64.1 SCOPE: no real institutional entries are seeded. OFFICIAL_SOURCES
 * starts empty and stays empty this milestone — adding real entries
 * (with their own provenance/reliability review) is explicitly a
 * later round's work, not something this milestone silently does.
 *
 * Filtering logic is factored into the exported `*From()` functions,
 * each taking the entry array as an explicit parameter, with the
 * zero-arg public functions below as thin wrappers over
 * OFFICIAL_SOURCES. This lets tests exercise the actual filtering
 * predicates against real fixture data, rather than only ever being
 * able to observe them return an empty array.
 */
export const OFFICIAL_SOURCES: OfficialSourceEntry[] = [];

export function getOfficialSourceByIdFrom(
  entries: OfficialSourceEntry[],
  id: string,
): OfficialSourceEntry | undefined {
  return entries.find((entry) => entry.id === id);
}

export function getOfficialSourcesForCountryFrom(
  entries: OfficialSourceEntry[],
  countryCode: string,
): OfficialSourceEntry[] {
  return entries.filter((entry) => entry.countryCode === countryCode);
}

export function getOfficialSourcesByClassFrom(
  entries: OfficialSourceEntry[],
  authorityClass: OfficialSourceClass,
): OfficialSourceEntry[] {
  return entries.filter((entry) => entry.authorityClass === authorityClass);
}

export function getEnabledOfficialSourcesFrom(entries: OfficialSourceEntry[]): OfficialSourceEntry[] {
  return entries.filter((entry) => entry.enabled);
}

export function getOfficialSourceById(id: string): OfficialSourceEntry | undefined {
  return getOfficialSourceByIdFrom(OFFICIAL_SOURCES, id);
}

export function getOfficialSourcesForCountry(countryCode: string): OfficialSourceEntry[] {
  return getOfficialSourcesForCountryFrom(OFFICIAL_SOURCES, countryCode);
}

export function getOfficialSourcesByClass(authorityClass: OfficialSourceClass): OfficialSourceEntry[] {
  return getOfficialSourcesByClassFrom(OFFICIAL_SOURCES, authorityClass);
}

export function getEnabledOfficialSources(): OfficialSourceEntry[] {
  return getEnabledOfficialSourcesFrom(OFFICIAL_SOURCES);
}
