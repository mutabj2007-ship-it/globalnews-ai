import {
  comparisonCoverageLines,
  type ComparisonCountryCoverage,
  type DisplayLocale,
} from '@globalnews-ai/shared';
import { askCountryName } from './askCountryName';
import { askShellAdditive } from './shell/askShellCatalogue';
import type { ShellComparisonCoverageCopy } from './shell/askShellOverlay';

/**
 * R4 · CTO LOCALIZATION CONVERGENCE — the "coverage checked" lines of a comparison answer, in the
 * reader's DisplayLocale.
 *
 * The shared `comparisonCoverageLines` carries its own English and Polish sentences and nothing
 * else; it is used by the Ask answer card only and is left byte-identical. For fr / de / es / pt /
 * ar the sentences are Claude L's (R6 additive delivery, held in the locale overlay's
 * `additive.comparisonCoverage` and served by askShellAdditive — the one Ask resolver path; never
 * authored here) and the country is named by the DisplayLocale formatter. A
 * locale without L's copy keeps the shared English and is reported by the rendered-surface
 * acceptance test, never hidden.
 */

/** The template shape (owned by the overlay contract, so the overlays can type it). */
export type AskComparisonCoverageCopy = ShellComparisonCoverageCopy;

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

export function askComparisonCoverageLines(
  coverage: readonly ComparisonCountryCoverage[],
  locale: DisplayLocale,
): string[] {
  const copy =
    locale === 'en' || locale === 'pl' ? undefined : askShellAdditive(locale)?.comparisonCoverage;
  if (copy === undefined) return comparisonCoverageLines(coverage, locale === 'pl' ? 'pl' : 'en');
  return coverage.map((member) => {
    const count = member.finalQualifyingEvidenceCount;
    const evidence =
      count === 0
        ? copy.gap
        : member.retrievalState === 'RETAINED_ONLY'
          ? fill(copy.retained, { count })
          : fill(copy.qualifying, {
              count,
              live: member.finalLiveEvidenceCount,
              retained: member.finalRetainedEvidenceCount,
            });
    const failures = member.providerFailureKinds;
    const notes =
      (member.retrievalState === 'PROVIDER_UNAVAILABLE' ? copy.liveUnavailable : '') +
      (failures.includes('rate-limited') ? copy.rateLimited : '') +
      (failures.includes('timeout') ? copy.timedOut : '') +
      (member.localSourceProvenance === 'NOT_ESTABLISHED' ? copy.localityNotEstablished : '');
    return fill(copy.line, {
      name: askCountryName(member.iso3, locale) ?? member.countryName,
      evidence,
      notes,
    });
  });
}
