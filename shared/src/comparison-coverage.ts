import type { LanguageCode } from './analysis';

export interface ComparisonCountryCoverage {
  countryName: string;
  iso2: string;
  iso3: string;
  requested: boolean;
  liveRetrievalAttempted: boolean;
  usableLiveEvidenceCount: number;
  usableRetainedEvidenceCount: number;
  finalQualifyingEvidenceCount: number;
  finalLiveEvidenceCount: number;
  finalRetainedEvidenceCount: number;
  providers: string[];
  providerFailureKinds: string[];
  retrievalState:
    | 'LIVE_EVIDENCE'
    | 'RETAINED_ONLY'
    | 'NO_MATCHING_EVIDENCE'
    | 'PROVIDER_UNAVAILABLE'
    | 'NOT_ATTEMPTED';
  localSourceProvenance: 'CONFIRMED_LOCAL' | 'NOT_ESTABLISHED';
  coverageGap: boolean;
  coverageGapReason:
    | 'NO_QUALIFYING_EVIDENCE'
    | 'PROVIDER_UNAVAILABLE'
    | 'NOT_ATTEMPTED'
    | 'LOCALITY_NOT_ESTABLISHED'
    | null;
  liveArticleIds: string[];
  retainedArticleIds: string[];
}

/** Available even when there is no evidence and synthesis is skipped. */
export function comparisonCoverageLines(
  coverage: readonly ComparisonCountryCoverage[],
  language: LanguageCode = 'en',
): string[] {
  const pl = language === 'pl';
  return coverage.map((member) => {
    const name = pl
      ? (new Intl.DisplayNames(['pl'], { type: 'region' }).of(member.iso2) ?? member.countryName)
      : member.countryName;
    const count = member.finalQualifyingEvidenceCount;
    const evidence =
      count === 0
        ? pl
          ? 'luka w pokryciu: brak zakwalifikowanych materiałów'
          : 'coverage gap: no qualifying evidence'
        : member.retrievalState === 'RETAINED_ONLY'
          ? pl
            ? 'zapisane wcześniej materiały: ' + count + '; bez potwierdzonego bieżącego pobrania'
            : 'retained/stored reports: ' + count + '; current live retrieval not established'
          : pl
            ? 'materiały: ' +
              count +
              ' (bieżące: ' +
              member.finalLiveEvidenceCount +
              ', zapisane: ' +
              member.finalRetainedEvidenceCount +
              ')'
            : 'qualifying reports: ' +
              count +
              ' (live: ' +
              member.finalLiveEvidenceCount +
              ', retained: ' +
              member.finalRetainedEvidenceCount +
              ')';
    const failures = member.providerFailureKinds;
    const degradation = failures.includes('rate-limited')
      ? pl
        ? ' Dostawca osiągnął limit zapytań.'
        : ' A source provider was rate-limited.'
      : '';
    const timeout = failures.includes('timeout')
      ? pl
        ? ' Przekroczono czas oczekiwania na dostawcę.'
        : ' A source provider timed out.'
      : '';
    const unavailable =
      member.retrievalState === 'PROVIDER_UNAVAILABLE'
        ? pl
          ? ' Pobranie na żywo było niedostępne.'
          : ' Live retrieval was unavailable.'
        : '';
    const locality =
      member.localSourceProvenance === 'NOT_ESTABLISHED'
        ? pl
          ? ' Nie ustalono lokalnego pochodzenia źródeł; nie można określić perspektywy krajowych mediów.'
          : ' Publisher locality is not established; national media framing cannot be established.'
        : '';
    return name + ': ' + evidence + '.' + unavailable + degradation + timeout + locality;
  });
}
