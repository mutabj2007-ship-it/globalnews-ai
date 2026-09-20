import type { SourceProvenance } from '@globalnews-ai/shared';

import { economyFigure } from './economyAdapters';
import type { EconomyReadResult, RetainedObservation } from './economyObservationRead';
import { PRODUCTION_SHAPED_SUBJECT } from './productionSubject';
import type { EconomySubject, Series } from './types';

/**
 * Bind the retained official Economy read into the existing Economy presentation model.
 *
 * This is deliberately narrow: today we retain one real series (Rwanda headline CPI).
 * That one series is populated; every unrelated structural series stays a governed GAP.
 * No GDP, debt, employment, policy-rate, trade or FX value is manufactured.
 */
export function economySubjectFromRead(read: EconomyReadResult): EconomySubject {
  if (read.kind !== 'OBSERVATIONS' || read.observations.length === 0) {
    return PRODUCTION_SHAPED_SUBJECT;
  }

  const retained = read.observations[0]!;
  const cpi = retainedCpiSeries(retained);
  const indicators = PRODUCTION_SHAPED_SUBJECT.indicators.map((series) =>
    series.model.category === 'INFLATION_CPI' ? cpi : series,
  );

  return {
    ...PRODUCTION_SHAPED_SUBJECT,
    id: 'rw-economy',
    name: 'Rwanda Economy',
    scopeLabel: 'RW · ALL RWANDA',
    contextLabel: `CPI · ${retained.periodId}`,
    assessment: {
      id: 'rw-economy-observation-only',
      subjectId: 'rw-economy',
      model: null,
      absentReason: 'NO_ASSESSMENT_PRODUCER',
      statement: `Official headline CPI observation retained for ${retained.periodId}; no comparative assessment has been formed.`,
      confidence: 'LOW',
    },
    primarySeries: cpi,
    indicators,
    watch: {
      ...PRODUCTION_SHAPED_SUBJECT.watch,
      id: 'w-rw-economy',
      label: 'Rwanda economy basket',
      members: indicators.map((series) => ({
        subjectId: series.model.seriesId,
        label: series.model.label,
        enabled: false,
      })),
    },
  };
}

function retainedCpiSeries(retained: RetainedObservation): Series {
  const provenance: SourceProvenance = {
    sourceType: 'PUBLIC_DATA',
    providerId: 'rw-nisr',
    institution: retained.provenance.institution,
    jurisdiction: retained.provenance.jurisdiction,
    language: retained.provenance.sourceLanguage,
    retrievedAt: retained.provenance.retrievedAt,
    evidenceRole: 'REFERENCE_DATA',
    authorityClass: 'OFFICIAL_STATISTICS',
  };

  const slot = economyFigure({
    seriesId: 'rw-nisr:cpi:all-rwanda',
    periodId: retained.periodId,
    vintage: retained.provenance.publicationDateStated,
    value: retained.value,
    unit: retained.unit,
    semantics: {
      releaseStatus: null,
      valueKind: 'ACTUAL',
      freshness: 'UNDETERMINED',
    },
    provenance,
  });

  return {
    model: {
      seriesId: 'rw-nisr:cpi:all-rwanda',
      label: retained.seriesLabel,
      economyIso2: 'RW',
      unit: retained.unit,
      category: 'INFLATION_CPI',
      geographyId: 'RW',
    },
    shortLabel: 'CPI',
    direction: 'FLAT',
    latest: slot,
    triad: {
      actual: slot,
      expected: null,
      previous: null,
      surprise: null,
      surpriseUnit: retained.unit,
    },
    history: [slot],
  };
}
