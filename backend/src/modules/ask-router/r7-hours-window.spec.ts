import { routeAskR2 } from './ask-r2-route';
import { specialistRegistryFixture } from './frozen-c/fixtures/specialist-registry.fixture';
import { MAX_WINDOW_HOURS, reportingWindowFor, supportedWindowHours } from './reporting-window';
import { readTemporalSemantics } from './temporal-semantics';

/**
 * R7 X1 (#92) — "in / over / during / past / last N hours" is a bounded window reaching now.
 *
 * Before: the temporal reader and the stated-period fallback knew days … quarters, not hours, so
 * "in the last 48 hours" read NO period and the strict publication window reporting-window.ts already
 * supports for hours (≤ MAX_WINDOW_HOURS = 72) never engaged (PO Alpha field defect, #91 R7).
 * Basis: the server request instant; the window bounds PUBLISHER publication time (unchanged).
 */
const NOW = '2026-10-13T10:00:00.000Z';

function routeOf(q: string, language: 'en' | 'pl' = 'en') {
  const r: any = routeAskR2(
    { originalQuestion: q, sourceLanguage: language, normalizationLanguage: language, displayLanguage: language, origin: 'ASK' } as never,
    { requestInstant: NOW } as never,
    { specialistRegistry: specialistRegistryFixture } as never,
  );
  return { window: r.reportingWindow ?? null, statedPeriod: r.envelope?.time?.statedPeriod ?? null };
}

describe('R7 X1 · relative hours windows (EN / PL)', () => {
  it.each([
    ['in the last 48 hours', 48],
    ['over the last 48 hours', 48],
    ['during the past 48 hours', 48],
    ['the last 47 hours', 47],
    ['last 49 hours', 49],
    ['past 72 hours', 72],
    ['w ciągu ostatnich 48 godzin', 48],
    ['ostatnich 24 godzin', 24],
  ])('supportedWindowHours(%s) = %s', (phrase, hours) => {
    expect(supportedWindowHours(phrase)).toBe(hours);
  });

  it('> MAX_WINDOW_HOURS is not a supported window (unchanged bound: 73 h EN and PL)', () => {
    expect(MAX_WINDOW_HOURS).toBe(72);
    expect(supportedWindowHours('in the last 73 hours')).toBeNull();
    expect(supportedWindowHours('w ciągu ostatnich 73 godzin')).toBeNull();
  });

  it('PL day windows are deliberately NOT added (separate pre-existing gap)', () => {
    expect(supportedWindowHours('w ciągu ostatnich 7 dni')).toBeNull();
  });

  it('reportingWindowFor: a 48 h PUBLICATION window anchored on the request instant', () => {
    expect(reportingWindowFor('in the last 48 hours', 'RELATIVE_TO_ASK', NOW)).toEqual({
      statedPeriod: 'in the last 48 hours',
      hours: 48,
      from: '2026-10-11T10:00:00.000Z',
      to: NOW,
      basis: 'PUBLICATION_TIME',
    });
  });

  it.each([
    ['What are the latest developments in Kenya in the last 47 hours?', 47],
    ['What are the latest developments in Kenya in the last 48 hours?', 48],
    ['What are the latest developments in Kenya over the last 49 hours?', 49],
  ])('the ROUTE reads the stated hours window: %s', (q, hours) => {
    const r = routeOf(q);
    expect(r.window?.hours).toBe(hours);
    expect(r.window?.basis).toBe('PUBLICATION_TIME');
    expect(String(r.window?.statedPeriod)).toMatch(/hours/);
  });

  it('the ROUTE reads the PL hours window: "w ciągu ostatnich 48 godzin"', () => {
    const r = routeOf('Co się wydarzyło w Kenii w ciągu ostatnich 48 godzin?', 'pl');
    expect(r.window?.hours).toBe(48);
  });

  it('> 72 h: no window is applied (handled exactly as reporting-window.ts already handles it)', () => {
    expect(routeOf('What are the latest developments in Kenya in the last 73 hours?').window).toBeNull();
  });

  /* negative controls — not windows */
  it.each([
    ['a forecast', 'What could happen in Kenya in the next 48 hours?'],
    ['a duration', 'Is a 48-hour flight from Nairobi to Warsaw normal?'],
    ['a duration (plural)', 'How long is the 48 hours visa transit rule in Kenya?'],
    ['a historic period', 'What happened in Kenya in the 48 hours before the 2007 election?'],
  ])('NEGATIVE %s: no reporting window — %s', (_label, q) => {
    expect(routeOf(q).window).toBeNull();
  });

  it('temporal reading: "in the last 48 hours" is a REPORTING_WINDOW reaching now (CURRENT)', () => {
    const t = readTemporalSemantics('What happened in Kenya in the last 48 hours?', 'en');
    expect(t.spans.some((s) => s.role === 'REPORTING_WINDOW')).toBe(true);
    expect(t.currentness).toBe('CURRENT');
    const pl = readTemporalSemantics('Co się wydarzyło w Kenii w ciągu ostatnich 48 godzin?', 'pl');
    expect(pl.spans.some((s) => s.role === 'REPORTING_WINDOW')).toBe(true);
  });

  it('temporal reading NEGATIVES: "the next 48 hours" and "a 48-hour flight" are not reporting windows', () => {
    for (const q of ['What could happen in Kenya in the next 48 hours?', 'Is a 48-hour flight from Nairobi normal?']) {
      expect(readTemporalSemantics(q, 'en').spans.some((s) => s.role === 'REPORTING_WINDOW')).toBe(false);
    }
  });
});
