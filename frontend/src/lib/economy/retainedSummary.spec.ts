import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RetainedEconomySummary } from '@/components/economy/RetainedEconomySummary';
import type { RetainedObservation } from './economyObservationRead';

// UI fixture only: never admitted by a runtime reader.
const observation: RetainedObservation = {
  value: 15.9, unit: 'PERCENT', periodId: '2026-08', geographyLabel: 'All Rwanda',
  seriesLabel: 'Rwanda headline CPI, year on year',
  provenance: { institution: 'National Institute of Statistics of Rwanda', jurisdiction: 'RW',
    referencePeriod: '2026-08', publicationDateStated: '2026-09-10', sourceLanguage: 'en',
    contentAddress: 'a'.repeat(64), retrievedAt: '2026-09-20T00:00:00Z', licence: 'CC BY 4.0',
    parserId: 'nisr.cpi.pdf', parserVersion: '1.0.0', extractorId: 'test', extractorVersion: '1',
    basePeriod: 'Feb 2014=100', sourceUrl: 'https://statistics.gov.rw/test-fixture.pdf' },
};
it.each(['en', 'pl'] as const)('answers the single-period question in %s with distinct source language', locale => {
  const html = renderToStaticMarkup(createElement(RetainedEconomySummary, { observation, locale }));
  expect(html).toContain(locale === 'pl' ? '15,9%' : '15.9%');
  expect(html).toContain(locale === 'pl' ? 'trend nieustalony' : 'trend not established');
  expect(html).toContain('2026-09-10');
  expect(html).toContain('National Institute of Statistics of Rwanda');
  expect(html).toContain('lang="en"');
  expect(html).toContain('href="https://statistics.gov.rw/test-fixture.pdf"');
  expect(html).toContain('href="#economy-evidence"');
  expect(html).not.toMatch(/<svg|<canvas|Run analysis/);
});
it('does not invent a source link when the older read has no document URL', () => {
  const html = renderToStaticMarkup(createElement(RetainedEconomySummary, {
    observation: { ...observation, provenance: { ...observation.provenance, sourceUrl: undefined } }, locale: 'en',
  }));
  expect(html).toContain('document URL is unavailable');
  expect(html).not.toContain('target="_blank"');
});
