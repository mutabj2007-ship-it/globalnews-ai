import { mapGeographyChipShown, readDraftContext, readEffectiveContext } from './effectiveContext';

/**
 * ASK R2 CONSOLIDATED INTEGRATION R1 · G SEAM D — the Map chip reads what scoped the
 * answer. Cases mirror G's own effective-context spec (backend, vendored byte-identical).
 */
const MAP_ONLY = { storyContextPresent: false, geographyContextPresent: true };

describe('effective context — four states, from what the server stamped', () => {
  it.each([
    [{ geographyContextUsed: true }, 'USED'],
    [{ geographyContextUsed: false }, 'PRESENT_UNUSED'],
    [{}, 'NOT_ELIGIBLE'],
  ] as const)('%j → %s', (facts, effect) => {
    expect(readEffectiveContext(facts, MAP_ONLY).mapGeography).toBe(effect);
  });

  it('a store the reader never filled is ABSENT, whatever the server says', () => {
    expect(
      readEffectiveContext(
        { geographyContextUsed: true },
        { storyContextPresent: false, geographyContextPresent: false },
      ).mapGeography,
    ).toBe('ABSENT');
  });

  it('a draft makes no global claim', () => {
    expect(readDraftContext(MAP_ONLY).globalScopeIsHonest).toBe(false);
  });
});

describe('the dock chip', () => {
  it('while drafting, the Map country on offer is shown', () => {
    expect(mapGeographyChipShown('draft', {}, MAP_ONLY)).toBe(true);
  });

  it('answered with the Map country USED → shown', () => {
    expect(mapGeographyChipShown('answered', { geographyContextUsed: true }, MAP_ONLY)).toBe(true);
  });

  it('answered with the Map country suppressed ("What is NATO?") → NOT shown as the scope', () => {
    expect(mapGeographyChipShown('answered', {}, MAP_ONLY)).toBe(false);
  });

  it('answered with the Map country outranked by a typed place → NOT shown as the scope', () => {
    expect(mapGeographyChipShown('answered', { geographyContextUsed: false }, MAP_ONLY)).toBe(
      false,
    );
  });
});
