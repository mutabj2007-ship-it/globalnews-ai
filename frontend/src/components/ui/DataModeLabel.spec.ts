import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * Milestone #48 (UI polish consistency fix) — DataModeLabel (the
 * small homepage provider badges beside Newsroom Snapshot, Latest
 * Updates, and any other below-Hero section using it) has no separate
 * dictionary section of its own — it deliberately reuses
 * `liveStatusStrip.live/cached/mock/unknown`, the exact same strings
 * LiveStatusStrip's own top bar already uses, since both describe the
 * identical four data-provenance states. These tests exist at the
 * dictionary level (rather than rendering the component) because that
 * IS the fix: proving the shared keys are correct and byte-identical
 * to the original hardcoded English is what guarantees both badges
 * stay in sync — there is no component-local string to test
 * separately.
 */
describe('DataModeLabel badge text (Milestone #48 — shared liveStatusStrip keys)', () => {
  it('English "live" state is byte-identical to the original hardcoded DataModeLabel text', () => {
    const en = getDictionary('en');
    expect(en.liveStatusStrip.live).toBe('LIVE \u00b7 Powered by GNews');
  });

  it('English "cached"/"mock"/"unknown" states are byte-identical to the original hardcoded text', () => {
    const en = getDictionary('en');
    expect(en.liveStatusStrip.cached).toBe('CACHED \u00b7 Previously retrieved reporting');
    expect(en.liveStatusStrip.mock).toBe('DEMO MODE \u00b7 Sample content only');
    expect(en.liveStatusStrip.unknown).toBe('DATA STATUS UNKNOWN');
  });

  it('Polish "live" state matches the LiveStatusStrip top-bar wording exactly, keeping "GNews" unchanged', () => {
    const pl = getDictionary('pl');
    expect(pl.liveStatusStrip.live).toBe('NA ŻYWO \u00b7 Obsługiwane przez GNews');
    expect(pl.liveStatusStrip.live).toContain('GNews');
  });

  it('Polish "cached"/"mock"/"unknown" states are present, non-empty, and distinct from English', () => {
    const en = getDictionary('en');
    const pl = getDictionary('pl');
    for (const key of ['cached', 'mock', 'unknown'] as const) {
      expect(pl.liveStatusStrip[key].length).toBeGreaterThan(0);
      expect(pl.liveStatusStrip[key]).not.toBe(en.liveStatusStrip[key]);
    }
  });

  it('no second/duplicate dictionary section was introduced for this badge — DataModeLabel has no dataModeLabel key of its own', () => {
    const en = getDictionary('en') as Record<string, unknown>;
    expect(en.dataModeLabel).toBeUndefined();
  });
});
