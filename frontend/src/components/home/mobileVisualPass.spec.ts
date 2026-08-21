import { readFileSync } from 'fs';
import { join } from 'path';

const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const mobileVisualSource = readFileSync(join(__dirname, 'HeroWorldVisualMobile.tsx'), 'utf-8');
const mobileGridSource = readFileSync(join(__dirname, 'IntelligenceModulesMobile.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');

describe('Mobile visual pass (CTO directive — actual implementation, not verification only)', () => {
  it('mobile gets the approved design\u2019s corner-cropped intelligence field at its exact size and offset, not a hidden desktop visual', () => {
    // M65 — the approved design places the mobile map as a cropped
    // corner overlay behind the text, not as a strip below the headline.
    // Exact values from the design: 238x198 at -16px / -10px.
    expect(heroSource).toMatch(/-right-\[16px\] -top-\[10px\] h-\[198px\] w-\[238px\]/);
    // M66.3 (CTO decision L-1A) — BREAKPOINT ALIGNMENT ONLY. The bleed geometry
    // above is unchanged; the composition handoff moved from `lg` (1024px) to
    // `cd-hero` (1240px), so the class that hides the bleed on the desktop
    // console changed prefix and nothing else.
    expect(heroSource).toMatch(/cd-hero:hidden/);
  });

  it('the mobile visual is a real, separate, lighter-weight implementation — smaller viewport and coarser decimation than desktop', () => {
    expect(mobileVisualSource).toMatch(/width: 400, height: 140/);
    expect(mobileVisualSource).toMatch(/MOBILE_KEEP_EVERY_NTH_POINT = 7/);
  });

  it('the mobile visual reuses the same real geometry/projection foundation as desktop — no duplicated data layer', () => {
    expect(mobileVisualSource).toMatch(/getCountryFeatureCollection/);
    expect(mobileVisualSource).toMatch(/geometryToPathD/);
  });

  it('the mobile visual respects prefers-reduced-motion', () => {
    expect(mobileVisualSource).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('9 modules remain represented — 8 in the main slot topology, the 9th positioned via its own dedicated bottom slot, never orphaned', () => {
    expect(mobileGridSource).toMatch(/INTELLIGENCE_MODULES\.slice\(0, 8\)/);
    expect(mobileGridSource).toMatch(/INTELLIGENCE_MODULES\[8\]/);
    expect(mobileGridSource).toMatch(/BOTTOM_SLOT/);
  });

  it('mobile hub reuses the SAME cyan HUD ring/core identity as the desktop engine hub (M60 Phase 2) — a real connected-engine visual, not the earlier plain label box\u2019s single border', () => {
    expect(mobileGridSource).toMatch(/gna-hub-core-m/);
    expect(mobileGridSource).toMatch(/gna-hub-ring-m-a/);
    expect(mobileGridSource).toMatch(/gna-hub-ring-m-b/);
    expect(mobileGridSource).toMatch(/border-cyan-400\/70/);
    expect(mobileGridSource).toMatch(/text-cyan-300/);
  });
});

describe('Navigation active-route indicator (CTO directive)', () => {
  it('uses real pathname-based active detection, not a hardcoded/fake active state', () => {
    expect(navBarSource).toMatch(/usePathname/);
    // M65 — the nav renders from NAV_MODEL entries rather than raw
    // primaryNavLinks; the detection mechanism itself is unchanged.
    expect(navBarSource).toMatch(/const isActive = pathname === entry\.href/);
  });

  it('communicates active state with a real aria-current attribute, not color alone', () => {
    expect(navBarSource).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
  });
});
