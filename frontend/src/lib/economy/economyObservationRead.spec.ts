import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EconomyScreen } from '@/components/economy/EconomyScreen';
import { readEconomyObservations, economyCapabilityFrom } from './economyObservationRead';
import { economySubjectFromRead } from './economyRetainedSubject';

jest.mock('@/lib/api/apiBase', () => ({ resolveApiBaseUrl: () => 'http://localhost:3001' }));
const originalFetch = global.fetch;
const body = {
  slot: { kind: 'OBSERVATION', observation: { value: 15.9, unit: 'PERCENT', periodId: '2026-08' } },
  publishable: true, seriesLabel: 'Rwanda headline CPI, year on year', geographyLabel: 'All Rwanda',
  provenance: { institution: 'National Institute of Statistics of Rwanda', jurisdiction: 'RW',
    licence: 'Licensed under CC BY 4.0', retrievedAt: '2026-09-20T00:00:00Z',
    contentAddress: 'a'.repeat(64), parserId: 'nisr.cpi.pdf', parserVersion: '1.0.0',
    extractorId: 'nisr.cpi.pdfsynctext.positional', extractorVersion: '1.0.0',
    referencePeriod: '2026-08', sourceLanguage: 'en', basePeriod: 'Feb 2014=100', publicationDateStated: '2026-09-10' },
};
afterEach(() => { global.fetch = originalFetch; });
function response(value: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => value });
}
it('binds only the retained CPI, preserving period, value, unit and source language', async () => {
  response(body);
  const read = await readEconomyObservations();
  expect(read.kind).toBe('OBSERVATIONS');
  const subject = economySubjectFromRead(read);
  expect(subject.primarySeries?.latest).toMatchObject({ kind: 'OBSERVATION', observation: {
    value: 15.9, unit: 'PERCENT', periodId: '2026-08', vintage: '2026-09-10',
    semantics: { releaseStatus: null }, provenance: { language: 'en' },
  } });
  expect(subject.primarySeries?.history).toHaveLength(1);
  expect(subject.primarySeries?.triad).toBeNull();
  expect(subject.indicators.filter(s => s.latest.kind === 'OBSERVATION')).toHaveLength(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/economy/observations/rw-nisr-cpi', expect.objectContaining({ cache: 'no-store' }));
});
it.each([
  { ...body, publishable: false }, { slot: { kind: 'GAP', reason: 'WITHHELD' } },
  { ...body, provenance: null },
  ...['15.9', NaN, Infinity, null].map(value => ({ ...body, slot: { kind: 'OBSERVATION', observation: { ...body.slot.observation, value } } })),
  { ...body, slot: { kind: 'OBSERVATION', observation: { ...body.slot.observation, unit: 'INDEX' } } },
  { ...body, provenance: { ...body.provenance, referencePeriod: '2026-07' } },
])('does not display malformed or unpublishable evidence %#', async value => {
  response(value);
  const read = await readEconomyObservations();
  expect(read).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' });
  expect(economyCapabilityFrom(read).numericObservations).toBe('NO_OBSERVATION_SOURCE');
});
it('does not describe a transport error as proof that nothing is retained', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('unreachable'));
  expect(await readEconomyObservations()).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' });
});

it('keeps one-vintage and duplicate-vintage revision controls disabled, as well as evidence-free actions', async () => {
  response(body);
  const read = await readEconomyObservations();
  const subject = economySubjectFromRead(read);
  const slot = subject.primarySeries!.latest;
  for (const vintages of [[slot], [slot, slot]]) {
    const html = renderToStaticMarkup(createElement(EconomyScreen, {
      subject, locale: 'en', frameWidth: 1440, data: economyCapabilityFrom(read),
      revisionVintages: vintages, revisionEffects: {},
    }));
    for (const label of ['Explain triad', 'Revisions', 'Competing readings', 'Policy event']) {
      expect(html).toMatch(new RegExp('disabled=""[^>]*>' + label + '</button>'));
    }
    expect(html).toContain('trend not available yet');
  }
});

it('distinguishes no retained capture from retained but undisplayable', async () => {
  response({ publishable: false, retainedState: 'NO_CAPTURE', slot: { kind: 'GAP', reason: 'NO_PRODUCER' } });
  expect(await readEconomyObservations()).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_OBSERVATION_RETAINED' });
  response({ publishable: false, retainedState: 'NOT_DISPLAYABLE', slot: { kind: 'GAP', reason: 'NO_PRODUCER' } });
  expect(await readEconomyObservations()).toEqual({ kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_OBSERVATION' });
});
