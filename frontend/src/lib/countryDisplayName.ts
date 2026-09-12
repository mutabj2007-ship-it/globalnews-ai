import { getLocalizedCountryName, type LanguageCode } from '@globalnews-ai/shared';

/**
 * Milestone #50 Phase D (consolidate country display-name resolution)
 * — this file is now a THIN COMPATIBILITY WRAPPER only. The actual
 * `Intl.DisplayNames` implementation lives in exactly one place,
 * `shared/src/countryDisplayName.ts` (introduced in Milestone #50
 * Phase C for the backend relevance scorer), and both frontend and
 * backend now consume that SAME canonical resolver — there is no
 * longer a second, independent `Intl.DisplayNames` construction
 * anywhere in the codebase.
 *
 * This wrapper exists to preserve the exact Milestone #49 public API
 * every frontend call site already depends on
 * (`getCountryDisplayName(iso2, language, canonicalName): string`,
 * always returning a string, with the canonical English name as a
 * built-in fallback) — the shared resolver's own API
 * (`getLocalizedCountryName(iso2, language): string | undefined`) is
 * deliberately fallback-free, since backend relevance scoring needs to
 * distinguish "no localized name available" from "the localized name
 * happens to equal the canonical one." This wrapper is where that
 * fallback behavior is applied, not duplicated locale logic.
 */
export function getCountryDisplayName(
  iso2: string,
  language: LanguageCode,
  canonicalName: string,
): string {
  return getLocalizedCountryName(iso2, language) ?? canonicalName;
}
