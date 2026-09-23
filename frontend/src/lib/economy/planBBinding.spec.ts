import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImihigoScreen } from '@/components/delivery/ImihigoScreen';
import { readRetainedImihigo } from '@/lib/imihigo/retainedReader';
import { EconomyCompactScreen } from '@/components/economy/compact/EconomyCompactScreen';
import { RetainedSourceDetails } from '@/components/economy/EconomyScreen';
import { SeriesChart } from '@/components/economy/Substrate';
import { economySubjectFromRead } from './economyRetainedSubject';
import { economyCapabilityFrom, type EconomyReadResult, type RetainedObservation } from './economyObservationRead';

// Test-only transport shape. These metadata are never admitted into a reader-facing store.
const observation: RetainedObservation = {
  value: 15.9, unit: 'PERCENT', periodId: '2026-08', geographyLabel: 'All Rwanda',
  seriesLabel: 'Rwanda headline CPI, year on year',
  provenance: { institution: 'National Institute of Statistics of Rwanda', jurisdiction: 'RW',
    referencePeriod: '2026-08', publicationDateStated: '2026-09-10', sourceLanguage: 'en',
    contentAddress: 'a'.repeat(64), retrievedAt: '2026-09-20T00:00:00Z', licence: 'CC BY 4.0',
    parserId: 'nisr.cpi.pdf', parserVersion: '1.0.0', extractorId: 'TEST-ONLY', extractorVersion: '1',
    basePeriod: 'Feb 2014=100', sourceUrl: 'https://statistics.gov.rw/test-fixture.pdf' },
};
const read: EconomyReadResult = { kind: 'OBSERVATIONS', observations: [observation] };

it.each(['en', 'pl'] as const)('binds the same retained observation and limitation to existing %s slots', locale => {
  const subject = economySubjectFromRead(read, locale);
  expect(subject.assessment.model).toBeNull();
  expect(subject.attention).toHaveLength(0);
  expect(subject.assessment.statement).toContain(locale === 'pl' ? 'trend nieustalony' : 'trend not established');
  expect(subject.assessment.statement).toContain(locale === 'pl' ? '15,9%' : '15.9%');
  expect(subject.primarySeries?.history).toHaveLength(1);
  expect(subject.primarySeries?.latest).toMatchObject({ kind: 'OBSERVATION', observation: {
    value: 15.9, unit: 'PERCENT', provenance: { language: 'en' },
  } });
  const chart = renderToStaticMarkup(createElement(SeriesChart, { series: subject.primarySeries!, windowMonths: 12, locale }));
  expect(chart).toContain('data-econ="series-single-period"');
  expect(chart).not.toContain('data-econ="chart-bar"');
  const html = renderToStaticMarkup(createElement(EconomyCompactScreen, {
    subject, locale, data: economyCapabilityFrom(read), retainedObservation: observation,
    initialSurface: { kind: 'INSPECT', detent: 'HALF' },
  }));
  expect(html).toContain('data-econ="economy-sheet"');
  expect(html).toContain('data-econ="retained-source-details"');
  expect(html).toContain('href="https://statistics.gov.rw/test-fixture.pdf"');
  expect(html).toContain('lang="en"');
  expect(html).toContain(locale === 'pl' ? 'Otwórz dokument źródłowy' : 'Open source document');
  expect(html).not.toContain('data-econ="retained-summary"');
});
it('withholds a document link when no retained URL exists', () => {
  const html = renderToStaticMarkup(createElement(RetainedSourceDetails, {
    observation: { ...observation, provenance: { ...observation.provenance, sourceUrl: undefined } }, locale: 'en',
  }));
  expect(html).not.toContain('href=');
  expect(html).toContain(observation.provenance.institution);
});
it.each(['en', 'pl'] as const)('keeps all 28 Imihigo scores and explains their meaning within the existing %s frame', locale => {
  const html = renderToStaticMarkup(createElement(ImihigoScreen, { view: readRetainedImihigo(), compact: true, locale }));
  expect((html.match(/data-del="region"/g) ?? [])).toHaveLength(4);
  expect((html.match(/data-del="subject"/g) ?? [])).toHaveLength(28);
  expect(html).toContain('2024/2025');
  expect(html).toContain('28');
  expect(html).toContain('Final Score');
  expect(html).toContain(locale === 'pl' ? 'bez jednostki' : 'no unit stated');
  expect(html).not.toMatch(/<input|<select|data-imihigo="summary"/);
  expect(html).not.toContain(locale === 'pl' ? 'Cel: Niepodany' : 'Target: Not stated');
});
