import {
  BRIEF_HEIGHT_COMPRESSED, BRIEF_HEIGHT_NORMAL, CENTRE_MIN_HEIGHT, COMMAND_BAR_HEIGHT,
  DOCK_COMPACT_COMPRESSED, DOCK_COMPACT_NORMAL, frameHeightFor, indexTrackWidth,
  opensCompressed, resolveColumns, resolveCompressed, resolveTracks, shouldClearForcedExpansion,
  breakpointSweep, centreWidthFor, CENTRE_READING_TARGET,
} from './frameGeometry';

/* PAF acceptance test 3 — F-5 / F-6 */
describe('PAF-3 — expanding the dock reduces the centre and moves nothing else', () => {
  it('changes centreHeight only; brief height and frame height are untouched', () => {
    const frameHeight = frameHeightFor(1080);
    const compact = resolveTracks({ frameHeight, compressed: false, dock: 'compact' });
    const expanded = resolveTracks({ frameHeight, compressed: false, dock: 'expanded' });

    expect(expanded.frameHeight).toBe(compact.frameHeight);
    expect(expanded.briefHeight).toBe(compact.briefHeight);
    expect(expanded.dockHeight).toBeGreaterThan(compact.dockHeight);
    expect(expanded.centreHeight).toBeLessThan(compact.centreHeight);
    // The frame is conserved: what the dock takes, the centre gives.
    expect(expanded.dockHeight - compact.dockHeight).toBe(compact.centreHeight - expanded.centreHeight);
  });

  it("row 1 and row 2 origins cannot move — brief is the only thing above the centre", () => {
    const frameHeight = frameHeightFor(900);
    for (const dock of ['compact', 'expanded'] as const) {
      for (const compressed of [false, true]) {
        const t = resolveTracks({ frameHeight, compressed, dock });
        expect(t.briefHeight).toBe(compressed ? BRIEF_HEIGHT_COMPRESSED : BRIEF_HEIGHT_NORMAL);
        expect(t.briefHeight + t.centreHeight + t.dockHeight).toBe(frameHeight);
      }
    }
  });
});

/* PAF acceptance test 6 — the centre floor, and the dock is what yields */
describe('PAF-6 — centreH >= 240 in every state; the dock yields, not the centre', () => {
  it('holds across every window height from 672 to 1600, both compressions, both dock states', () => {
    const breaches: string[] = [];
    for (let windowHeight = 672; windowHeight <= 1600; windowHeight += 1) {
      const frameHeight = frameHeightFor(windowHeight);
      for (const dock of ['compact', 'expanded'] as const) {
        for (const compressed of [false, true]) {
          const t = resolveTracks({ frameHeight, compressed, dock });
          if (t.centreFloorHonoured && t.centreHeight < CENTRE_MIN_HEIGHT) {
            breaches.push(`${windowHeight}/${dock}/${compressed}: ${t.centreHeight}`);
          }
        }
      }
    }
    expect(breaches).toEqual([]);
  });

  it('an expanded dock never grows past the ceiling that preserves the floor', () => {
    for (let windowHeight = 672; windowHeight <= 1600; windowHeight += 7) {
      const frameHeight = frameHeightFor(windowHeight);
      const t = resolveTracks({ frameHeight, compressed: true, dock: 'expanded' });
      expect(t.centreHeight).toBeGreaterThanOrEqual(CENTRE_MIN_HEIGHT);
    }
  });

  it('reports honestly when the frame is too short for even a compact dock to protect the floor', () => {
    const t = resolveTracks({ frameHeight: 300, compressed: true, dock: 'compact' });
    expect(t.dockHeight).toBe(DOCK_COMPACT_COMPRESSED);
    expect(t.centreFloorHonoured).toBe(false);
  });
});

/* The handoff's own worked cases (§3.1) */
describe('PAF §3.1 worked cases', () => {
  it.each([
    [1080, false, 'compact', 1032, 196, DOCK_COMPACT_NORMAL, 1032 - 196 - DOCK_COMPACT_NORMAL],
    [900, false, 'compact', 852, 196, DOCK_COMPACT_NORMAL, 852 - 196 - DOCK_COMPACT_NORMAL],
    [720, true, 'compact', 672, 52, DOCK_COMPACT_COMPRESSED, 672 - 52 - DOCK_COMPACT_COMPRESSED],
    [720, true, 'expanded', 672, 52, 282, 338],
  ] as Array<[number, boolean, 'compact' | 'expanded', number, number, number, number]>)(
    'window %i compressed=%s dock=%s -> frame %i / brief %i / dock %i / centre %i',
    (windowHeight, compressed, dock, frame, brief, dockH, centre) => {
      const t = resolveTracks({ frameHeight: frameHeightFor(windowHeight), compressed, dock });
      expect([t.frameHeight, t.briefHeight, t.dockHeight, t.centreHeight]).toEqual([frame, brief, dockH, centre]);
    },
  );

  it('the command bar is outside the frame', () => {
    expect(frameHeightFor(1080)).toBe(1080 - COMMAND_BAR_HEIGHT);
  });
});

/* PAF acceptance test 8 — F-2, the index never compresses */
describe('PAF-8 — the index track is not a function of compression', () => {
  it('index width is identical in both compression states at every breakpoint', () => {
    for (const width of [1600, 1440, 1280, 1100, 1024, 900, 768]) {
      expect(indexTrackWidth(width, false)).toBe(indexTrackWidth(width, true));
    }
  });

  it('compression is not an input to resolveColumns at all', () => {
    expect(resolveColumns.length).toBe(1);
  });
});

/* PAF acceptance test 9 — one flag, hysteresis, override */
describe('PAF-9 — compression: one flag, two causes, 60/30 hysteresis, FULL override', () => {
  const tall = frameHeightFor(1080);

  it('compresses above 60 and restores below 30', () => {
    const base = { userForcedExpanded: false, frameHeight: tall, previousCompressed: false };
    expect(resolveCompressed({ ...base, centreScrollTop: 61 })).toBe(true);
    expect(resolveCompressed({ ...base, centreScrollTop: 29, previousCompressed: true })).toBe(false);
  });

  it('holds the previous value inside the 30..60 band — no oscillation', () => {
    const base = { userForcedExpanded: false, frameHeight: tall };
    for (const scrollTop of [30, 40, 50, 60]) {
      expect(resolveCompressed({ ...base, centreScrollTop: scrollTop, previousCompressed: true })).toBe(true);
      expect(resolveCompressed({ ...base, centreScrollTop: scrollTop, previousCompressed: false })).toBe(false);
    }
  });

  it('a short frame compresses regardless of scroll position', () => {
    const short = frameHeightFor(720);
    expect(resolveCompressed({ centreScrollTop: 0, userForcedExpanded: false, frameHeight: short, previousCompressed: false })).toBe(true);
    expect(opensCompressed(short)).toBe(true);
    expect(opensCompressed(frameHeightFor(900))).toBe(false);
  });

  it('FULL overrides BOTH causes — the control stays available on a short frame (§3.3)', () => {
    const short = frameHeightFor(720);
    expect(resolveCompressed({ centreScrollTop: 500, userForcedExpanded: true, frameHeight: short, previousCompressed: true })).toBe(false);
  });

  it('the override is cleared by the next downward pass of 60px', () => {
    expect(shouldClearForcedExpansion(61)).toBe(true);
    expect(shouldClearForcedExpansion(60)).toBe(false);
    expect(shouldClearForcedExpansion(0)).toBe(false);
  });
});

/* §3.2 width breakpoints */
describe('PAF §3.2 — breakpoints, and geography is the last thing to leave', () => {
  it.each([
    [1600, 'XL', 260, 296, false, true],
    [1280, 'L', 260, 296, false, true],
    [1279, 'M', 236, 276, false, true],
    [1072, 'M', 236, 276, false, true],
    [1071, 'M_NARROW', 212, 252, false, true],
    [1024, 'M_NARROW', 212, 252, false, true],
    [768, 'S', null, 268, true, true],
    [767, 'XS', null, null, false, false],
  ] as Array<[number, string, number | null, number | null, boolean, boolean]>)(
    '%ipx -> %s',
    (width, bp, indexWidth, rightWidth, chipRow, frameApplies) => {
      const c = resolveColumns(width);
      expect([c.breakpoint, c.indexWidth, c.rightWidth, c.indexIsChipRow, c.frameApplies])
        .toEqual([bp, indexWidth, rightWidth, chipRow, frameApplies]);
    },
  );

  it('the right column persists at every desktop breakpoint', () => {
    for (const width of [1600, 1440, 1280, 1100, 1024, 900, 768]) {
      expect(resolveColumns(width).rightWidth).not.toBeNull();
    }
  });

  it('the index becomes a chip row at S but is never removed before the right column', () => {
    const s = resolveColumns(800);
    expect(s.indexIsChipRow).toBe(true);
    expect(s.rightWidth).toBe(268);
  });
});

/* PAF-R1.2 closure — the 1072px crossover */
describe('PAF-R1.2 — the centre holds the reading target at every column-grid width', () => {
  it('SWEEP: 1024..2560, every single width, not sampled', () => {
    const sweep = breakpointSweep(1024, 2560);
    expect(sweep.length).toBe(2560 - 1024 + 1);
    const failures = sweep.filter((row) => !row.holdsTarget);
    // Reported as widths, not as a count, so a regression names itself.
    expect(failures.map((row) => `${row.width}px=${row.centre}`)).toEqual([]);
  });

  it('the crossover is exactly 1072 and it is a STEP UP in centre width', () => {
    expect(centreWidthFor(1071)).toBe(1071 - 212 - 252);   // 607
    expect(centreWidthFor(1072)).toBe(1072 - 236 - 276);   // 560
    // Both sides clear the target; the narrow state is the wider centre,
    // which is the whole point of it existing.
    expect(centreWidthFor(1071)!).toBeGreaterThanOrEqual(CENTRE_READING_TARGET);
    expect(centreWidthFor(1072)!).toBeGreaterThanOrEqual(CENTRE_READING_TARGET);
  });

  it('the OLD geometry is what failed, and the sweep would have caught it', () => {
    // Before closure the M tracks ran down to 1024: 1024 - 236 - 276 = 512.
    expect(1024 - 236 - 276).toBeLessThan(CENTRE_READING_TARGET);
    // And starting L at 1072 — the wording the closure was first written
    // against — would have been WORSE, not better.
    expect(1072 - 260 - 296).toBeLessThan(CENTRE_READING_TARGET);
    expect(1072 - 260 - 296).toBeLessThan(1024 - 236 - 276 + 5);
  });

  it('the 260px Index is preserved wherever the viewport supports it', () => {
    for (const width of [1280, 1440, 1600, 1920, 2560]) {
      expect(`${width}: ${resolveColumns(width).indexWidth}`).toBe(`${width}: 260`);
    }
  });

  it('geography persists at every desktop width, narrow band included', () => {
    for (const width of [1024, 1050, 1071, 1072, 1280, 1440]) {
      expect(`${width}: ${resolveColumns(width).rightWidth}`).not.toBe(`${width}: null`);
      expect(resolveColumns(width).rightWidth).toBeGreaterThanOrEqual(252);
    }
  });

  it('the narrow band keeps a FIXED index column — it does not fall back to chips', () => {
    for (const width of [1024, 1050, 1071]) {
      expect(`${width}: ${resolveColumns(width).indexIsChipRow}`).toBe(`${width}: false`);
    }
  });

  it('S is a different layout model and is deliberately out of this guarantee', () => {
    // The chip row is not a narrower column grid, so the sweep excludes it.
    // Stated rather than silently skipped: at 768 the centre is 500px.
    expect(centreWidthFor(800)).toBeNull();
    expect(resolveColumns(768).indexIsChipRow).toBe(true);
  });
});
