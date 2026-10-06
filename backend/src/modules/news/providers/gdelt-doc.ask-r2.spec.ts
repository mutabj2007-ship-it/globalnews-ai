import { ConfigService } from '@nestjs/config';
import {
  GDELT_DOC_REQUEST_TIMEOUT_MS,
  GdeltDocProvider,
  gdeltWindowParams,
} from './gdelt-doc.provider';
import { laneFailureReason } from '../../analysis/service/analysis.service';

/**
 * ASK RETRIEVAL / CONVERSATION R2 — the independent fallback (contract §6, gate C).
 *
 * Measured 2026-10-06 from a workstation against the public DOC endpoint: a 7-day artlist query
 * answered in 15.8 s (HTTP 200); GDELT's own "one request every 5 seconds" 429 arrived after
 * 12–13 s. With an 8 s deadline every one of those answers was aborted and logged as a timeout
 * (Alpha 04:57, 06:24, 06:46 UTC), so the only independent fallback never returned evidence.
 * GDELT also always received `timespan=24h`, whatever window the reader stated.
 */
describe('ASK R2 · GDELT DOC as a real fallback', () => {
  it('the request deadline covers the measured response time (15.8 s) with margin', () => {
    expect(GDELT_DOC_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(16_000);
    expect(GDELT_DOC_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(30_000); /* still bounded */
  });

  it('a stated window is sent as GDELT start/end date-times (UTC), never the fixed 24 h', () => {
    expect(gdeltWindowParams('2026-09-29T06:36:00.000Z', '2026-10-06T06:36:00.000Z')).toEqual({
      startdatetime: '20260929063600',
      enddatetime: '20261006063600',
    });
  });

  it('no window (or an unparseable one) keeps the explicit 24 h — GDELT’s 3-month default is never reached', () => {
    expect(gdeltWindowParams(undefined, undefined)).toEqual({ timespan: '24h' });
    expect(gdeltWindowParams('not a date', undefined)).toEqual({ timespan: '24h' });
  });

  it('the window reaches the wire', async () => {
    const provider = new GdeltDocProvider(
      new ConfigService({ GDELT_DOC_ENABLED: 'true' }) as unknown as ConfigService,
    );
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ articles: [] }), { status: 200 }));
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await provider.search('Rwanda Tanzania port', {
        from: '2026-09-29T06:36:00.000Z',
        to: '2026-10-06T06:36:00.000Z',
      });
    } finally {
      global.fetch = original;
    }
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('startdatetime')).toBe('20260929063600');
    expect(url.searchParams.get('enddatetime')).toBe('20261006063600');
    expect(url.searchParams.get('timespan')).toBeNull();
  });
});

describe('ASK R2 · a failed lane is named with its own reason (contract §4)', () => {
  it.each([
    ['rate-limited', 'rate-limited'],
    ['quota', 'quota'],
    ['timeout', 'timeout'],
    ['auth', 'auth'],
    ['unreachable', 'unavailable'],
    ['malformed', 'unavailable'],
    ['unknown', 'unavailable'],
  ])('%s → %s', (kind, reason) => {
    expect(laneFailureReason(kind)).toBe(reason);
  });
});
