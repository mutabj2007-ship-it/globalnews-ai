import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Milestone #50 Phase E (sticky World Map — corrected).
 *
 * IMPORTANT LIMITS OF THIS TEST — READ BEFORE TRUSTING IT:
 * This is a structural/source-inspection test, not a rendered-DOM or
 * screenshot test. It CANNOT prove that the map is actually visually
 * sticky in a real browser — Jest/jsdom has no CSS layout engine, so
 * `position: sticky`'s actual scroll-holding behavior is fundamentally
 * unverifiable here, regardless of how thorough the assertions below
 * are. MapPageClient.tsx also depends on next/dynamic + maplibre-gl (a
 * browser-only mapping library), ruling out a meaningful full-render
 * harness for this component.
 *
 * What this test DOES verify: the exact structural relationship the
 * fix depends on, directly against the shipped source. This is a
 * MEANINGFUL improvement over the previous version of this test, which
 * asserted the presence of `lg:items-start` as if it were REQUIRED for
 * sticky to work — that assertion was actively wrong: `items-start`
 * was the root cause of the M50 v2 runtime failure (it collapsed the
 * sticky element's containing block to exactly the sticky element's
 * own height, leaving no room to stick within). This test now asserts
 * the CORRECTED relationship instead: `lg:sticky` must be on a
 * DIFFERENT element than the one carrying the fixed `h-[480px]`
 * height, and the outer grid must NOT constrain the left column's
 * height via `items-start`.
 *
 * MANUAL BROWSER ACCEPTANCE REMAINS THE AUTHORITATIVE GATE FOR STICKY
 * BEHAVIOR ITSELF. This test protects against regressing the known
 * structural precondition for sticky to have ANY chance of working —
 * it does not and cannot replace visually confirming it works.
 */
const source = readFileSync(join(__dirname, 'MapPageClient.tsx'), 'utf-8');

function extractClassNames(src: string): string[] {
  return [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
}

describe('MapPageClient sticky desktop layout (Milestone #50 Phase E)', () => {
  const classNameValues = extractClassNames(source);

  it('lg:sticky is present, scoped only to the desktop breakpoint', () => {
    const stickyBearingClass = classNameValues.find((value) => value.includes('sticky'));
    expect(stickyBearingClass).toBeDefined();
    expect(stickyBearingClass).toMatch(/lg:sticky\b/);
    expect(stickyBearingClass).not.toMatch(/(?<!lg:)\bsticky\b(?!-)/);
  });

  it('CRITICAL: the element carrying lg:sticky is NOT the same element carrying the fixed h-[480px] height — this is the exact M50 v2 regression this test now guards against', () => {
    const stickyBearingClass = classNameValues.find((value) => value.includes('sticky'));
    expect(stickyBearingClass).toBeDefined();
    // The fixed-height class must NOT appear on the same className
    // string as lg:sticky. If it ever does again, the sticky
    // element's containing block would once more equal its own
    // height, with zero room to stick — reproducing the v2 failure.
    expect(stickyBearingClass).not.toMatch(/h-\[480px\]/);
  });

  it('CRITICAL: the outer grid does NOT constrain the left column with items-start — that class collapsed the sticky containing block to the bug height in M50 v2 and must not return', () => {
    const gridClass = classNameValues.find(
      (value) => value.includes('grid-cols-1') && value.includes('lg:grid-cols-3'),
    );
    expect(gridClass).toBeDefined();
    expect(gridClass).not.toMatch(/items-start/);
  });

  it('the sticky wrapper has an lg:top offset, clearing the sticky NavBar without overlapping it', () => {
    expect(source).toMatch(/lg:top-\d+/);
  });

  it('the sticky wrapper stays below the NavBar in stacking order (z-40 vs NavBar z-50)', () => {
    expect(source).toMatch(/lg:z-40/);
  });

  it('the map column remains hidden below the lg breakpoint, preserving the existing mobile stacked-scroll fallback', () => {
    const outerCellClass = classNameValues.find(
      (value) => value.includes('hidden') && value.includes('lg:col-span-2') && value.includes('lg:block'),
    );
    expect(outerCellClass).toBeDefined();
  });

  it('the h-[480px] fixed-height element exists somewhere (the actual map canvas area), confirming the map content itself was not accidentally removed by this restructuring', () => {
    expect(source).toMatch(/h-\[480px\]/);
  });
});
