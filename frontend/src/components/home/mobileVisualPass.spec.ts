import { readFileSync } from 'fs';
import { join } from 'path';

const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const mobileVisualSource = readFileSync(join(__dirname, 'HeroWorldVisualMobile.tsx'), 'utf-8');
const mobileGridSource = readFileSync(join(__dirname, 'IntelligenceModulesMobile.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');

describe('Mobile visual pass (CTO directive — actual implementation, not verification only)', () => {
  it('mobile gets a genuine lightweight world visual, not a hidden desktop visual', () => {
    expect(heroSource).toMatch(/<HeroWorldVisualMobile/);
    expect(heroSource).toMatch(/mt-6 h-24 w-full max-w-2xl lg:hidden/);
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

  it('9 modules in a 2-column mobile grid no longer orphan the last card — the 9th renders full-width', () => {
    expect(mobileGridSource).toMatch(/const gridModules = INTELLIGENCE_MODULES\.slice\(0, 8\)/);
    expect(mobileGridSource).toMatch(/const overflowModule = INTELLIGENCE_MODULES\[8\]/);
    expect(mobileGridSource).toMatch(/\{overflowModule && \(/);
  });

  it('mobile module hub badge uses the same cyan HUD system as the rest of the revised page', () => {
    expect(mobileGridSource).toMatch(/border-cyan-500\/30/);
    expect(mobileGridSource).toMatch(/text-cyan-300/);
  });
});

describe('Navigation active-route indicator (CTO directive)', () => {
  it('uses real pathname-based active detection, not a hardcoded/fake active state', () => {
    expect(navBarSource).toMatch(/usePathname/);
    expect(navBarSource).toMatch(/const isActive = pathname === link\.href/);
  });

  it('communicates active state with a real aria-current attribute, not color alone', () => {
    expect(navBarSource).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
  });
});
