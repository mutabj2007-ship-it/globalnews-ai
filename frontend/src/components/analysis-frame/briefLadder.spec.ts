import { BAND_PADDING, THRESHOLD, TITLE_FLOOR_HOLDS_TO, resolveBriefBand } from './briefLadder';

/* PAF acceptance test 10 — the width yielding ladder */
describe('PAF-10 — brief width ladder', () => {
  const withClause = (w: number) => resolveBriefBand(w, true);

  it('the stated thresholds fire at exactly the stated widths', () => {
    expect(withClause(THRESHOLD.locationToken).showLocationToken).toBe(true);
    expect(withClause(THRESHOLD.locationToken - 1).showLocationToken).toBe(false);

    expect(withClause(THRESHOLD.clause).showClause).toBe(true);
    expect(withClause(THRESHOLD.clause - 1).showClause).toBe(false);

    expect(withClause(THRESHOLD.meterSegments).showMeterSegments).toBe(true);
    expect(withClause(THRESHOLD.meterSegments - 1).showMeterSegments).toBe(false);

    expect(withClause(THRESHOLD.controlLabel).controlLabelled).toBe(true);
    expect(withClause(THRESHOLD.controlLabel - 1).controlLabelled).toBe(false);
  });

  it('yields in order — an item never returns once a narrower band has dropped it', () => {
    let previous = withClause(1200);
    for (let w = 1199; w >= 468; w -= 1) {
      const current = withClause(w);
      expect(Number(current.showLocationToken)).toBeLessThanOrEqual(Number(previous.showLocationToken));
      expect(Number(current.showClause)).toBeLessThanOrEqual(Number(previous.showClause));
      expect(Number(current.showMeterSegments)).toBeLessThanOrEqual(Number(previous.showMeterSegments));
      expect(Number(current.controlLabelled)).toBeLessThanOrEqual(Number(previous.controlLabelled));
      previous = current;
    }
  });

  it('NEVER yields the title, the evidence word, or the expand affordance — at any width', () => {
    for (let w = 1600; w >= 320; w -= 1) {
      const band = withClause(w);
      expect(band.showTitle).toBe(true);
      expect(band.showEvidenceWord).toBe(true);
      expect(band.showControl).toBe(true);
    }
  });

  it('THE FITTING INVARIANT holds at every width down to the stated 499px floor', () => {
    const breaches: string[] = [];
    for (let w = 1600; w >= TITLE_FLOOR_HOLDS_TO; w -= 1) {
      const band = withClause(w);
      if (band.retainedWidth > band.contentWidth) {
        breaches.push(`${w}: retained ${band.retainedWidth} > content ${band.contentWidth}`);
      }
    }
    expect(breaches).toEqual([]);
  });

  it('below 499px the title ellipsises inside its floor — stated, not hidden (03 §2a)', () => {
    expect(withClause(TITLE_FLOOR_HOLDS_TO).titleEllipsised).toBe(false);
    // 468px is the narrowest supported desktop band, at the S breakpoint.
    const narrowest = withClause(468);
    expect(narrowest.titleEllipsised).toBe(true);
    expect(narrowest.showTitle).toBe(true);
    expect(narrowest.showEvidenceWord).toBe(true);
  });

  it('content width excludes the band padding, never the other way round', () => {
    expect(withClause(800).contentWidth).toBe(800 - BAND_PADDING);
  });
});

/* RULING 2 — an absent clause is absent, never fabricated */
describe('RULING 2 — a clause the contract never supplied is not rendered at any width', () => {
  it('showClause is false at every width when no clause is available', () => {
    for (let w = 1600; w >= 320; w -= 1) {
      expect(resolveBriefBand(w, false).showClause).toBe(false);
    }
  });

  it('dropping the clause frees width rather than leaving a gap', () => {
    const wide = 1200;
    expect(resolveBriefBand(wide, false).retainedWidth)
      .toBeLessThan(resolveBriefBand(wide, true).retainedWidth);
  });

  it('the fitting invariant still holds with no clause, down to the floor', () => {
    for (let w = 1600; w >= TITLE_FLOOR_HOLDS_TO; w -= 1) {
      const band = resolveBriefBand(w, false);
      expect(band.retainedWidth).toBeLessThanOrEqual(band.contentWidth);
    }
  });
});
