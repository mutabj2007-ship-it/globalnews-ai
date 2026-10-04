import {
  comparisonCoverageLines,
  type ComparisonCountryCoverage,
  type DisplayLocale,
} from '@globalnews-ai/shared';
import { askCountryName } from './askCountryName';

/**
 * R4 · CTO LOCALIZATION CONVERGENCE — the "coverage checked" lines of a comparison answer, in the
 * reader's DisplayLocale.
 *
 * The shared `comparisonCoverageLines` carries its own English and Polish sentences and nothing
 * else; it is used by the Ask answer card only and is left byte-identical. For fr / de / es / pt /
 * ar the sentences are Claude L's (ASK_COMPARISON_COVERAGE_COPY, delivered through the additive
 * manifest — never authored here) and the country is named by the DisplayLocale formatter. A
 * locale without L's copy keeps the shared English and is reported by the rendered-surface
 * acceptance test, never hidden.
 */
export interface AskComparisonCoverageCopy {
  /** "coverage gap: no qualifying evidence" */
  readonly gap: string;
  /** "retained/stored reports: {count}; current live retrieval not established" */
  readonly retained: string;
  /** "qualifying reports: {count} (live: {live}, retained: {retained})" */
  readonly qualifying: string;
  /** " Live retrieval was unavailable." */
  readonly liveUnavailable: string;
  /** " A source provider was rate-limited." */
  readonly rateLimited: string;
  /** " A source provider timed out." */
  readonly timedOut: string;
  /** " Publisher locality is not established; national media framing cannot be established." */
  readonly localityNotEstablished: string;
  /** "{name}: {evidence}.{notes}" — the line itself, so punctuation and order are L's */
  readonly line: string;
}

/** L_RETURNED only. Empty until Claude L returns the additive manifest. */
export const ASK_COMPARISON_COVERAGE_COPY: Readonly<
  Partial<Record<Exclude<DisplayLocale, 'en' | 'pl'>, AskComparisonCoverageCopy>>
> = {};

const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

export function askComparisonCoverageLines(
  coverage: readonly ComparisonCountryCoverage[],
  locale: DisplayLocale,
): string[] {
  const copy =
    locale === 'en' || locale === 'pl' ? undefined : ASK_COMPARISON_COVERAGE_COPY[locale];
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
