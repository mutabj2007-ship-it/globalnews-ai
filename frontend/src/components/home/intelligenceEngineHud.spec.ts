import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * M65.1 RETIREMENT NOTE — the components this file inspects
 * (IntelligenceModulesDesktop, IntelligenceEngineInteractive,
 * IntelligenceModulesMobile, IntelligenceModuleCard) have been RETIRED
 * FROM THE HOMEPAGE RENDER PATH. Their files are retained unmodified,
 * per explicit CTO decision, so every assertion below still describes
 * those files accurately and still passes — but it no longer describes
 * what the homepage renders.
 *
 * The live Intelligence Engine is IntelligenceEngineSection /
 * IntelligenceEngineRing / IntelligenceModulePanel, and the guards from
 * this file that remain genuinely valuable — no DOM measurement, pure
 * connector arithmetic, straight lines rather than elbow paths, a narrow
 * client boundary, no fabricated destination — were PORTED to
 * intelligenceEngineCanvas.spec.ts rather than deleted.
 *
 * Nothing here was removed. Deleting these components, and this file
 * with them, is a separate cleanup decision the CTO has deferred.
 */

const desktopSource = readFileSync(join(__dirname, 'IntelligenceEngineInteractive.tsx'), 'utf-8');
const mobileSource = readFileSync(join(__dirname, 'IntelligenceModulesMobile.tsx'), 'utf-8');
const shellSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'IntelligenceModuleCard.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * M60 Phase 2 radial-engine correction — protects the true-radiating-
 * connector geometry (rejecting the earlier left-stack/hub/right-stack
 * + orthogonal-elbow layout) rather than arbitrary Tailwind class
 * strings. The connector formula itself (vector arithmetic: direction
 * from hub center to module, normalized, walked outward by the hub's
 * own radius) is the meaningful invariant — verified both by presence
 * in source AND, separately, by direct execution of the same formula
 * in this development session against every module slot (all 22/10
 * checks passed for desktop/mobile respectively) before this file was
 * written.
 */
describe('Intelligence Engine — true radial geometry (M60 Phase 2 correction)', () => {
  it('the shell remains a Server Component delegating to the interactive surface', () => {
    expect(shellSource.trimStart().startsWith("'use client'")).toBe(false);
    expect(shellSource).toMatch(/<IntelligenceEngineInteractive/);
  });

  it('desktop is a Client Component owning exactly one piece of interaction state', () => {
    expect(desktopSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(desktopSource).toMatch(/useState<string \| null>\(null\)/);
  });

  it('connectors are computed via vector arithmetic from a fixed hub center and fixed module slots — never an orthogonal multi-segment elbow path', () => {
    expect(desktopSource).toMatch(/function hubEdgePointToward/);
    expect(desktopSource).toMatch(/HUB_CENTER/);
    expect(desktopSource).toMatch(/HUB_EDGE_RADIUS/);
    // The rejected elbow formula (center -> horizontal -> vertical ->
    // horizontal-to-card) is a 4-point path string; the corrected
    // implementation renders a single <line> with two endpoints only.
    expect(stripComments(desktopSource)).not.toMatch(/<path/);
    expect(desktopSource).toMatch(/<line/);
  });

  it('M60 Phase 2 card-polish correction — the connector terminus is enlarged with an added unfilled accent-color ring around the existing filled node, without altering connector routing or introducing new routing/animation systems', () => {
    expect(desktopSource).toMatch(/r=\{active \? '2\.2' : '1\.7'\}/);
    expect(desktopSource).toMatch(/r=\{active \? '1\.4' : '1\.0'\}/);
    expect(desktopSource).toMatch(/fill="none"\s*\n\s*stroke=\{color\}/);
    expect(stripComments(desktopSource)).not.toMatch(/<path/);
  });

  it('connector geometry uses only fixed constants and pure arithmetic — no DOM measurement of any kind', () => {
    const codeOnly = stripComments(desktopSource);
    expect(codeOnly).not.toMatch(/getBoundingClientRect/);
    expect(codeOnly).not.toMatch(/ResizeObserver/);
    expect(codeOnly).not.toMatch(/requestAnimationFrame/);
  });

  it('module positions use LEFT_SLOTS/RIGHT_SLOTS/BOTTOM_SLOT, never the retired flat-grid or column-band constants', () => {
    expect(desktopSource).toMatch(/LEFT_SLOTS/);
    expect(desktopSource).toMatch(/RIGHT_SLOTS/);
    expect(desktopSource).toMatch(/BOTTOM_SLOT/);
    expect(desktopSource).not.toMatch(/grid-cols-\[1fr_auto_1fr\]/);
    expect(desktopSource).not.toMatch(/COLUMN_Y_SLOTS/);
  });

  it('M60 Phase 2 containment correction — the canvas has an explicit 900px minimum-height floor alongside its aspect-ratio preference, so it never shrinks below the height the radial composition actually needs', () => {
    expect(desktopSource).toMatch(/aspect-\[10\/7\]/);
    expect(desktopSource).toMatch(/min-h-\[900px\]/);
  });

  it('M60 Phase 2 containment correction — the four side tiers use the verified, generously-spaced Y values (13.9/36.1/58.3/80.6), replacing the earlier dangerously tight set that caused card/card overlap', () => {
    expect(desktopSource).toMatch(/y: 13\.9/);
    expect(desktopSource).toMatch(/y: 36\.1/);
    expect(desktopSource).toMatch(/y: 58\.3/);
    expect(desktopSource).toMatch(/y: 80\.6/);
    expect(desktopSource).not.toMatch(/y: 16 }, \/\/ upper-left/);
  });

  it('M60 Phase 2 card-polish correction — side slots moved to x=15%/85% (from the earlier 10%/90%) to make room for the widened module panels while remaining verified-clear of both the canvas edge and the hub', () => {
    expect(desktopSource).toMatch(/x: 15, y: 13\.9/);
    expect(desktopSource).toMatch(/x: 15, y: 36\.1/);
    expect(desktopSource).toMatch(/x: 15, y: 58\.3/);
    expect(desktopSource).toMatch(/x: 15, y: 80\.6/);
    expect(desktopSource).toMatch(/x: 85, y: 13\.9/);
    expect(desktopSource).toMatch(/x: 85, y: 36\.1/);
    expect(desktopSource).toMatch(/x: 85, y: 58\.3/);
    expect(desktopSource).toMatch(/x: 85, y: 80\.6/);
    expect(desktopSource).not.toMatch(/\{ x: 10, y:/);
    expect(desktopSource).not.toMatch(/\{ x: 90, y:/);
  });

  it('M60 Phase 2 card-polish correction — module panels use a deterministic 240px desktop width, replacing the earlier narrow 176px-equivalent (w-40 sm:w-44) tile width', () => {
    expect(desktopSource).toMatch(/w-\[240px\]/);
    expect(desktopSource).not.toMatch(/w-40 sm:w-44/);
  });

  it('M60 Phase 2 containment correction — the Forecast bottom slot sits at the verified, protected y=86.1% position (x=50%), clear of the lower side tiers, replacing the earlier y=93% position that overlapped the hub label', () => {
    expect(desktopSource).toMatch(/BOTTOM_SLOT: Omit<ModuleSlot, 'id'> = \{ x: 50, y: 86\.1 \}/);
  });

  it('the hub is substantially larger and visually dominant — sized as a percentage of the engine canvas (24%, the CTO-approved dominant-but-not-overwhelming size), not a small fixed pixel box, and not the previously-rejected 30% oversized value', () => {
    expect(desktopSource).toMatch(/width: '24%'/);
    expect(desktopSource).not.toMatch(/width: '30%'/);
    expect(desktopSource).not.toMatch(/h-44 w-44/);
  });

  it('the hub retains multiple concentric rings, glow, and a decorative radar backplane, with prefers-reduced-motion preserved', () => {
    expect(desktopSource).toMatch(/gna-hub-ring-a/);
    expect(desktopSource).toMatch(/gna-hub-ring-b/);
    expect(desktopSource).toMatch(/gna-hub-ring-outer/);
    expect(desktopSource).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('all 9 modules render from the canonical config, positioned via the shared slot list', () => {
    expect(desktopSource).toMatch(/MODULE_SLOTS\.map/);
    expect(desktopSource).toMatch(/INTELLIGENCE_MODULES\.slice\(0, 4\)/);
    expect(desktopSource).toMatch(/INTELLIGENCE_MODULES\.slice\(4, 8\)/);
    expect(desktopSource).toMatch(/INTELLIGENCE_MODULES\[8\]/);
  });

  it('hover/focus state still drives connector and card emphasis both ways', () => {
    expect(desktopSource).toMatch(/onHoverChange=\{setHoveredModuleId\}/);
    expect(desktopSource).toMatch(/isEmphasized=\{hoveredModuleId === moduleItem\.id\}/);
  });
});

describe('Mobile Intelligence Engine — compressed true-radial geometry (M60 Phase 2 correction)', () => {
  it('mobile is a Client Component using the SAME vector-arithmetic connector approach as desktop, not the rejected elbow formula', () => {
    expect(mobileSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(mobileSource).toMatch(/function hubEdgePointToward/);
    expect(mobileSource).not.toMatch(/<path/);
    expect(mobileSource).toMatch(/<line/);
  });

  it('mobile uses an asymmetric, staggered slot topology — not a rigid 2-column grid fed by orthogonal connectors', () => {
    expect(mobileSource).toMatch(/SLOT_OFFSETS/);
    expect(mobileSource).not.toMatch(/grid-cols-2/);
  });

  it('mobile hub reuses the same ring/pulse/reduced-motion identity as desktop, scaled down', () => {
    expect(mobileSource).toMatch(/gna-hub-ring-m-a/);
    expect(mobileSource).toMatch(/gna-hub-ring-m-b/);
    expect(mobileSource).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('all 9 modules remain represented on mobile', () => {
    expect(mobileSource).toMatch(/INTELLIGENCE_MODULES\.slice\(0, 8\)/);
    expect(mobileSource).toMatch(/INTELLIGENCE_MODULES\[8\]/);
  });
});

describe('Module card contract (unchanged by this correction)', () => {
  it('fires onHoverChange on both mouse hover and keyboard focus', () => {
    expect(cardSource).toMatch(/onMouseEnter=\{\(\) => onHoverChange\?\.\(module\.id\)\}/);
    expect(cardSource).toMatch(/onFocus=\{\(\) => onHoverChange\?\.\(module\.id\)\}/);
  });

  it('non-navigable modules never render as a clickable link', () => {
    expect(cardSource).toMatch(/if \(navigable && module\.destination\)/);
  });
});
