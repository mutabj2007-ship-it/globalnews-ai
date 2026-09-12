import { resolveLiveStatus } from './liveStatus';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * M65 — the status truth model, extracted from LiveStatusStrip so the
 * mobile strip and the Hero desktop DATA STATUS row cannot drift apart.
 * These are the invariants that were previously asserted against the
 * strip's own source; they are now asserted against the real function.
 */
describe('resolveLiveStatus — honest live/cached/mock/reconnecting state', () => {
  const UPDATED_AT = '2026-08-18T14:07:00.000Z';

  it('is only genuinely live when the fetch succeeded AND the backend reports dataMode live', () => {
    expect(resolveLiveStatus(true, 'live', 'en', UPDATED_AT).isReallyLive).toBe(true);
    expect(resolveLiveStatus(true, 'cached', 'en', UPDATED_AT).isReallyLive).toBe(false);
    expect(resolveLiveStatus(true, 'mock', 'en', UPDATED_AT).isReallyLive).toBe(false);
    expect(resolveLiveStatus(false, 'live', 'en', UPDATED_AT).isReallyLive).toBe(false);
    expect(resolveLiveStatus(true, null, 'en', UPDATED_AT).isReallyLive).toBe(false);
  });

  it('classifies every real state distinctly — a failed fetch is reconnecting, never unknown', () => {
    expect(resolveLiveStatus(false, null, 'en', UPDATED_AT).statusKey).toBe('reconnecting');
    expect(resolveLiveStatus(false, 'live', 'en', UPDATED_AT).statusKey).toBe('reconnecting');
    expect(resolveLiveStatus(true, 'live', 'en', UPDATED_AT).statusKey).toBe('live');
    expect(resolveLiveStatus(true, 'cached', 'en', UPDATED_AT).statusKey).toBe('cached');
    expect(resolveLiveStatus(true, 'mock', 'en', UPDATED_AT).statusKey).toBe('mock');
    expect(resolveLiveStatus(true, null, 'en', UPDATED_AT).statusKey).toBe('unknown');
  });

  it('badge text comes from the dictionary in both production languages — never a hardcoded English literal', () => {
    const en = getDictionary('en').liveStatusStrip;
    const pl = getDictionary('pl').liveStatusStrip;

    expect(resolveLiveStatus(true, 'live', 'en', UPDATED_AT).badgeText).toBe(en.live);
    expect(resolveLiveStatus(true, 'live', 'pl', UPDATED_AT).badgeText).toBe(pl.live);
    expect(resolveLiveStatus(true, 'cached', 'pl', UPDATED_AT).badgeText).toBe(pl.cached);
    expect(resolveLiveStatus(false, null, 'pl', UPDATED_AT).badgeText).toBe(pl.reconnecting);

    // A real translation, not the same string in both languages.
    expect(pl.live).not.toBe(en.live);
  });

  it('formats the REAL supplied instant as UTC HH:MM, never a hardcoded prototype value', () => {
    expect(resolveLiveStatus(true, 'live', 'en', UPDATED_AT).lastUpdated).toBe('14:07');
    // en-US and pl-PL produce the identical digit format for this exact
    // option set — the documented reason switching locale here is safe.
    expect(resolveLiveStatus(true, 'live', 'pl', UPDATED_AT).lastUpdated).toBe('14:07');
  });

  it('is a pure function of its inputs — the same inputs always produce the same output', () => {
    const a = resolveLiveStatus(true, 'cached', 'pl', UPDATED_AT);
    const b = resolveLiveStatus(true, 'cached', 'pl', UPDATED_AT);
    expect(a).toEqual(b);
  });

  it('accepts a Date as well as an ISO string, so neither call site has to pre-format', () => {
    expect(resolveLiveStatus(true, 'live', 'en', new Date(UPDATED_AT)).lastUpdated).toBe('14:07');
  });
});
