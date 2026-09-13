import { readFileSync } from 'fs';
import { join } from 'path';
// M66.3 — the released Hero type roles now live in the token layer rather than
// in an arbitrary class string, so the assertions below read the config the way
// headerSourcePort.spec.ts already does. tailwind.config.ts's only import is a
// type-only import, so importing it from a spec pulls in no runtime dependency.
import tailwindConfig from '../../../tailwind.config';

/**
 * `theme` on a Tailwind `Config` is optional and loosely typed, so released
 * values are read through the same narrowed view M66.2's headerSourcePort.spec
 * established rather than by indexing an optional chain.
 */
type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

const heroSource = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');
const mapSource = readFileSync(join(__dirname, 'HomepageSituationMap.tsx'), 'utf-8');
const engineSource = readFileSync(join(__dirname, 'IntelligenceEngineInteractive.tsx'), 'utf-8');
const shellSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const worldVisualSource = readFileSync(join(__dirname, 'HeroWorldVisual.tsx'), 'utf-8');
const howItWorksSource = readFileSync(join(__dirname, 'HowItWorks.tsx'), 'utf-8');
const navSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');
const footerSource = readFileSync(join(__dirname, '../layout/Footer.tsx'), 'utf-8');

/**
 * CTO reference-locked reconstruction — a single pass touching Hero
 * proportions/search, world-visual density, Situation Map
 * proportions, Engine compaction, HUD geometry coverage, How It
 * Works/Trust/Nav/Footer tuning, and typography rhythm. This test
 * file protects the concrete, verifiable outcomes of that pass.
 */
describe('Reference-locked reconstruction — Hero', () => {
  it('the Hero grid gives the intelligence visual clear dominance in a genuine three-zone composition — M66.3 moved the SAME released tracks from the lg gate to the cd-hero gate (CTO decision L-1A); the tracks themselves are unchanged', () => {
    expect(heroSource).toMatch(/cd-hero:grid-cols-\[minmax\(0,470px\)_minmax\(0,1fr\)_312px\]/);
    expect(heroSource).toMatch(/cd-hero:min-h-cd-hero-frame/);
    // The dominance this test has always protected is the MAP track, and what
    // actually threatened it was not the track definition but the Hero-local
    // padding and gap that were subtracted from it. Those are now forbidden.
    // Guards run on comment-stripped source: Hero.tsx's own documentation
    // legitimately names each constraint while explaining why it was removed.
    const heroCode = heroSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(heroCode).not.toMatch(/lg:px-8/);
    expect(heroCode).not.toMatch(/lg:gap-5/);
    expect(heroCode).not.toMatch(/max-w-\[1600px\]/);
  });

  it('the search field is the approved design\u2019s 12px-radius rounded rectangle — M66.3 re-expresses the same released values as tokens rather than an arbitrary class string', () => {
    expect(heroSource).toMatch(/rounded-cd-12 border border-cd-edge-control-active-32/);
    const colors = (themeExtend.colors.cd as Record<string, unknown>) as Record<string, string>;
    expect(colors['edge-control-active-32']).toBe('rgba(56,189,248,0.32)');
    expect((themeExtend.borderRadius as unknown as Record<string, string>)['cd-12']).toBe('12px');
    // `max-w-xl` is superseded by GN-CD-055's own column padding (20px 26px
    // 24px), which is what bounds the field now.
    expect(heroSource).toMatch(/cd-hero:px-cd-26/);
  });

  it('the headline uses the approved design\u2019s exact fluid clamp, weight and tracking — now via the released cd-hero type role, and with its separately authored mobile ladder', () => {
    expect(heroSource).toMatch(/cd-hero:text-cd-hero\b/);
    expect(heroSource).toMatch(/text-cd-hero-m\b/);
    const fontSize = themeExtend.fontSize as unknown as Record<string, [string, Record<string, string>]>;
    expect(fontSize['cd-hero'][0]).toBe('clamp(34px,3.5vw,54px)');
    expect(fontSize['cd-hero'][1].lineHeight).toBe('1.05');
    expect(fontSize['cd-hero'][1].letterSpacing).toBe('-0.026em');
    expect(fontSize['cd-hero'][1].fontWeight).toBe('700');
    // GN-CD-058's mobile ladder is 26px/1.1/-.02em — NOT the clamp floor, which
    // is what the pre-M66.3 Hero rendered at 390px.
    expect(fontSize['cd-hero-m'][0]).toBe('26px');
    expect(fontSize['cd-hero-m'][1].lineHeight).toBe('1.1');
    expect(fontSize['cd-hero-m'][1].letterSpacing).toBe('-0.02em');
  });
});

describe('Reference-locked reconstruction — World visual', () => {
  it('has a distinct micro-particle layer beyond the dense dot-matrix grid', () => {
    expect(worldVisualSource).toMatch(/Micro-particles/);
  });
});

describe('Reference-locked reconstruction — Situation Map', () => {
  it('the map dominates at roughly 72/28, not the earlier more balanced ~62/38', () => {
    expect(mapSource).toMatch(/lg:grid-cols-\[2\.7fr_1fr\]/);
  });

  it('the Open Full Map CTA is integrated into the context panel\u2019s own frame, not a detached section-header button', () => {
    expect(mapSource).toMatch(/Open Full Map CTA — integrated/);
  });
});

describe('Reference-locked reconstruction — Intelligence Engine (M60 Phase 2: true radial geometry supersedes the earlier compact command-deck-band geometry)', () => {
  it('the hub is visually dominant — a percentage-sized element (24%, the CTO-approved dominant-but-not-overwhelming size) with multiple concentric rings, not a small fixed-pixel icon between feature cards', () => {
    expect(shellSource).toMatch(/mb-2 flex flex-wrap items-end/);
    expect(engineSource).toMatch(/width: '24%'/);
    expect(engineSource).toMatch(/gna-hub-ring-outer/);
  });

  it('connectors are true radiating lines computed from a fixed hub center and fixed module positions via vector arithmetic, never an orthogonal elbow route', () => {
    expect(engineSource).toMatch(/function hubEdgePointToward/);
    expect(engineSource).toMatch(/<line/);
    expect(engineSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/<path/);
  });
});

describe('Reference-locked reconstruction — HUD geometry coverage', () => {
  /**
   * M66.6 — the ONE change authorized in this protected file (CTO decision
   * D-7). The Trust half of this assertion was removed and the title narrowed
   * accordingly, because GN-CD-180 replaces the Trust panel's HUD brackets
   * with a released 16px-radius bordered surface. `hudPanelGeometry.spec.ts`
   * now records that exception with its reason. The How It Works expectation
   * below is UNCHANGED, and no other assertion in this file was touched.
   */
  it('How It Works still carries corner brackets, extending the HUD geometry system beyond Hero/Modules/Map/Footer', () => {
    expect(howItWorksSource).toMatch(/hudCornerBracketClassName/);
  });

  it('How It Works section padding gives genuine breathing room after the Intelligence Engine (M61 — increased from the earlier compressed py-6/py-7 values)', () => {
    expect(howItWorksSource).toMatch(/py-8 sm:px-6 sm:py-10/);
  });
});

describe('Reference-locked reconstruction — Nav/Footer', () => {
  /**
   * M66.2 — the rail assertion was inverted; the height assertion is untouched.
   *
   * GN-CD-020's layer table lists "Scan line ❌ none" and describes the header
   * as "four declarations deep: fill, blur, border, nothing else" — deliberately
   * the plainest surface in the design, because every section beneath it carries
   * its own technical field. The rail was a C2.1 addition with no authority in
   * the released family, and CTO authorization §10 instructed its removal, so
   * its ABSENCE is now the contract.
   *
   * Replacing one presentation lock with another would leave this test weaker
   * than it was, so the three released base declarations it never covered are
   * asserted here instead.
   */
  it('nav height matches the released GN-CD-020 header (62px) and the header carries no scan-line rail', () => {
    expect(navSource).toMatch(/h-\[62px\] max-w/);
    expect(navSource).not.toMatch(/bg-gradient-to-r from-transparent via-cyan-400\/50 to-transparent/);
    // The released base: a flat translucent fill, a 10px backdrop blur and one
    // 1px bottom border. No gradient, no glow, no shadow at any scroll position.
    expect(navSource).toMatch(/bg-\[rgba\(4,7,14,0\.92\)\]/);
    expect(navSource).toMatch(/backdrop-blur-\[10px\]/);
    expect(navSource).toMatch(/border-b border-\[rgba\(56,189,248,0\.18\)\]/);
  });

  /**
   * M66.7 — the ONE change authorized in this protected file (CTO decision
   * D-9). Both assertions below were C2.1 presentation locks that GN-CD-200
   * disproves: the released footer is a single flat bar, and its layer
   * inventory has no status line and therefore no indicator dot.
   *
   * Replacing one presentation lock with another would leave this test weaker
   * than it was — the same reasoning M66.2 recorded for the sibling NavBar
   * assertion in this describe block — so the released BASE declarations the
   * test never covered are asserted instead: the flat fill, the .14 border,
   * and the absence of every technical layer. That last one is the point of
   * GN-CD-200: 'the only home section with a flat fill and no technical field
   * of any kind... the page ends by removing every technical layer.'
   *
   * No other assertion in this file was touched.
   */
  it('the footer is the released terminal surface — a flat fill, the .14 border, and no technical field of any kind', () => {
    const footerCode = footerSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(footerCode).toMatch(/bg-cd-fill-footer/);
    expect(footerCode).toMatch(/lg:border-cd-edge-card/);
    // Every layer GN-CD-200's inventory records as absent stays absent.
    expect(footerCode).not.toMatch(/hudCornerBracketClassName|HUD_CARD_CLIP|HUD_PANEL_CLIP/);
    expect(footerCode).not.toMatch(/gradient|backdrop-blur|shadow-|bg-cd-grid-|bg-cd-rules-/);
    expect(footerCode).not.toMatch(/bg-cyan-400/);
  });
});
