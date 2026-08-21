import { readFileSync } from 'fs';
import { join } from 'path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';
import { ENGINE_DESKTOP, ENGINE_MOBILE, RING_ORDER } from './intelligenceEngineGeometry';

const sectionSource = readFileSync(join(__dirname, 'IntelligenceEngineSection.tsx'), 'utf-8');
const ringSource = readFileSync(join(__dirname, 'IntelligenceEngineRing.tsx'), 'utf-8');
const panelSource = readFileSync(join(__dirname, 'IntelligenceModulePanel.tsx'), 'utf-8');
const geometrySource = readFileSync(join(__dirname, 'intelligenceEngineGeometry.ts'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const bottomNavSource = readFileSync(join(__dirname, '../navigation/MobileBottomNav.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface ThemeExtend {
  colors?: { cd?: Record<string, unknown> };
  fontSize?: Record<string, unknown>;
  screens?: Record<string, unknown>;
  backgroundImage?: Record<string, unknown>;
  backgroundSize?: Record<string, unknown>;
  boxShadow?: Record<string, unknown>;
  animation?: Record<string, unknown>;
}
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

/**
 * M66.5 — GN-CD-130 → GN-CD-156.
 *
 * This file carries two kinds of guard, deliberately together: the
 * released DESIGN contract, and the capability TRUTH the design sits on
 * top of.
 *
 * WHAT WAS PRESERVED AND WHAT WAS CONVERTED. Every capability, truth,
 * boundary and localization guard from the M65.1 suite survives here
 * unchanged — those describe what the product may claim, and the
 * milestone did not change that. What was CONVERTED is the block of
 * assertions that locked the M65.1 PRESENTATION: the 2.2 canvas aspect,
 * the percentage `RING_SLOTS`, the anisotropic ray/ellipse maths and the
 * connectors that ran to each card's centre. Those described a geometry
 * the released design replaces, so each was rewritten against the
 * released contract rather than deleted. Nothing was weakened to make an
 * implementation pass: the released geometry itself is proved by
 * execution in `engineGeometry.spec.ts`.
 */

describe('M66.5 — capability truth derives from the canonical configuration', () => {
  it('all nine panels come from INTELLIGENCE_MODULES — the ring never maintains its own module list', () => {
    expect(INTELLIGENCE_MODULES).toHaveLength(9);
    expect(ringSource).toMatch(/import \{ INTELLIGENCE_MODULES/);
    const codeOnly = stripComments(ringSource);
    expect((codeOnly.match(/INTELLIGENCE_MODULES/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // The ring names its cards by canonical id, in released order; it invents none.
    expect(codeOnly).toMatch(/for \(const id of RING_ORDER\)/);
    expect(codeOnly).toMatch(/byId\.get\(id\)/);
  });

  it('exactly four modules are currently ACTIVE, and they are the approved four', () => {
    const active = INTELLIGENCE_MODULES.filter((m) => m.state === 'active').map((m) => m.id).sort();
    expect(active).toEqual(['ai-research', 'country-intelligence', 'evidence', 'world-intelligence']);
    expect(active).toHaveLength(4);
  });

  it('exactly two PREVIEW and three COMING SOON, unchanged by the reconstruction', () => {
    expect(INTELLIGENCE_MODULES.filter((m) => m.state === 'preview').map((m) => m.id).sort()).toEqual([
      'conflict',
      'economy',
    ]);
    expect(INTELLIGENCE_MODULES.filter((m) => m.state === 'comingSoon').map((m) => m.id).sort()).toEqual([
      'forecast',
      'market',
      'timeline',
    ]);
  });

  it('the hub capability line is DERIVED from the configuration, never a hardcoded count (CTO decision D-11)', () => {
    expect(ringSource).toMatch(/INTELLIGENCE_MODULES\.length/);
    expect(ringSource).toMatch(/INTELLIGENCE_MODULES\.filter\(\(moduleItem\) => moduleItem\.state === 'active'\)\.length/);
    const codeOnly = stripComments(ringSource);
    expect(codeOnly).not.toMatch(/9 MODULES/);
    expect(codeOnly).not.toMatch(/4 ACTIVE/);
    expect(codeOnly).not.toMatch(/· LIVE/);
  });

  it('the hub line reads "9 modules · 4 active" today, in both languages, with correct Polish grammar', () => {
    const total = INTELLIGENCE_MODULES.length;
    const active = INTELLIGENCE_MODULES.filter((m) => m.state === 'active').length;
    const en = getDictionary('en').intelligenceModules;
    const pl = getDictionary('pl').intelligenceModules;

    expect(`${total} ${en.moduleForms[1]}`).toBe('9 modules');
    expect(`${active} ${en.activeForms[1]}`).toBe('4 active');
    expect(pl.moduleForms[2]).toBe('modułów');
    expect(pl.activeForms[1]).toBe('aktywne');
  });
});

describe('M66.5 — only legitimately navigable modules are interactive', () => {
  it('isModuleNavigable remains the SOLE interactivity gate', () => {
    expect(panelSource).toMatch(/import \{ isModuleNavigable/);
    expect(panelSource).toMatch(/const navigable = isModuleNavigable\(module\);/);
    expect(panelSource).toMatch(/if \(navigable && module\.destination\)/);
  });

  /*
    M66 — THESE TWO TESTS USED TO ENCODE CTO DECISION D-6 A, WHICH IS SUPERSEDED.

    D-6 A left World Intelligence ACTIVE but inert, and the second test below
    asserted `destination` was undefined — so the suite actively held the defect
    in place: a card announcing ACTIVE that no pointer or keyboard could reach.

    The superseding contract is ACTIVE MEANS ACTIONABLE. What has NOT changed,
    and is asserted harder below, is the rule D-6 A existed to protect: a
    destination must be a real existing surface, never fabricated. The new
    destination is an anchor that already existed on the section this module
    describes, reached by a navigation pattern MobileBottomNav already ships.
  */
  it('exactly FOUR modules produce a real link, and each destination is a real existing surface', () => {
    const navigable = INTELLIGENCE_MODULES.filter(isModuleNavigable);
    expect(navigable.map((m) => m.id).sort()).toEqual([
      'ai-research',
      'country-intelligence',
      'evidence',
      'world-intelligence',
    ]);
    for (const moduleItem of navigable) {
      expect(['/search', '/map', '/#global-developments-heading']).toContain(moduleItem.destination);
    }
  });

  it('each ACTIVE module keeps its own destination — none was redirected to make another one work', () => {
    const destinationOf = (id: string) => INTELLIGENCE_MODULES.find((m) => m.id === id)?.destination;
    expect(destinationOf('ai-research')).toBe('/search');
    expect(destinationOf('country-intelligence')).toBe('/map');
    expect(destinationOf('evidence')).toBe('/search');
    expect(destinationOf('world-intelligence')).toBe('/#global-developments-heading');
  });

  it('World Intelligence is ACTIVE and now ACTIONABLE, pointing at the section it describes', () => {
    const world = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(world?.state).toBe('active');
    expect(world?.destination).toBe('/#global-developments-heading');
    expect(isModuleNavigable(world!)).toBe(true);
  });

  it('THE ANCHOR IS REAL — the id this module points at exists in GlobalDevelopments, and no route was invented', () => {
    /*
      The guard that matters. A hash destination is only honest while the anchor
      exists; renaming that id without updating this config would leave a link
      that silently goes nowhere, which is the failure D-6 A was trying to avoid.
    */
    const developments = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');
    expect(developments).toMatch(/id="global-developments-heading"/);
    // No /world page was created to satisfy the badge.
    expect(INTELLIGENCE_MODULES.every((m) => m.destination !== '/world')).toBe(true);
  });

  it('no PREVIEW or COMING SOON module can ever become clickable (CTO decision D-10)', () => {
    for (const moduleItem of INTELLIGENCE_MODULES) {
      if (moduleItem.state !== 'active') {
        expect(moduleItem.destination).toBeUndefined();
        expect(isModuleNavigable(moduleItem)).toBe(false);
      }
    }
  });

  it('every navigable card shows an obvious keyboard focus state, using the ONE released focus colour', () => {
    // Reused, not invented: cd-edge-focus is the same token HeroLiveFeedPanel,
    // TrendingCard, GlobalDevelopments and LanguageSelector already use.
    expect(panelSource).toMatch(/focus-visible:outline-cd-edge-focus/);
    expect(panelSource).toMatch(/focus-visible:outline-offset-\[-2px\]/);
    // No second focus colour, and no JavaScript keyboard handling — the
    // navigable branch is a real <a>, so Tab and Enter are native.
    expect(panelSource).not.toMatch(/focus-visible:outline-\[/);
    expect(stripComments(panelSource)).not.toMatch(/onKeyDown|onKeyPress|tabIndex/);
  });

  it('the non-navigable panel is a plain container with no handler that could fake interaction', () => {
    const inertBranch = panelSource.slice(panelSource.lastIndexOf('return ('));
    expect(inertBranch).not.toMatch(/onClick=/);
    expect(inertBranch).not.toMatch(/href=/);
    expect(inertBranch).toMatch(/role="group"/);
    expect(inertBranch).toMatch(/aria-label=\{accessibleName\}/);
  });

  it('the engine fabricates no destination of any kind', () => {
    const engineCode = stripComments(ringSource) + stripComments(panelSource) + stripComments(sectionSource);
    expect(engineCode).not.toMatch(/href="\/(world|politics|business|technology|science|health|about|signals)"/);
    expect(stripComments(panelSource).match(/href=/g) ?? []).toHaveLength(1);
    expect(panelSource).toMatch(/href=\{module\.destination\}/);
  });

  it('the released COMING SOON toast is NOT reproduced — nothing announces a navigation that cannot happen', () => {
    const code = stripComments(panelSource) + stripComments(ringSource);
    expect(code).not.toMatch(/notify\(/);
    expect(code).not.toMatch(/role="link"/);
    expect(code).not.toMatch(/tabIndex=\{0\}/);
  });
});

describe('M66.5 — released section canvas (GN-CD-130 → GN-CD-136)', () => {
  it('renders ONE bounded panel — the M65.1 double wrapper and full-bleed rule are gone', () => {
    const code = stripComments(sectionSource);
    expect(code).toMatch(/rounded-cd-16/);
    expect(code).toMatch(/border-cd-edge-section/);
    expect(code).not.toMatch(/border-b border-border/);
    expect(code).not.toMatch(/max-w-\[1800px\]/);
    expect(code).not.toMatch(/mx-auto max-w-/);
  });

  it('carries the released padding and radial field at both authored viewports', () => {
    const code = stripComments(sectionSource);
    expect(code).toMatch(/px-cd-11/);
    expect(code).toMatch(/pb-cd-14/);
    expect(code).toMatch(/pt-cd-13/);
    expect(code).toMatch(/md:px-cd-24/);
    expect(code).toMatch(/md:pb-cd-30/);
    expect(code).toMatch(/md:pt-cd-26/);
    expect(code).toMatch(/bg-cd-engine-m/);
    expect(code).toMatch(/md:bg-cd-engine/);
  });

  it('overflow:hidden is present — GN-CD-151 makes the HUD ring crop load-bearing', () => {
    expect(stripComments(sectionSource)).toMatch(/overflow-hidden/);
  });

  it('carries exactly ONE grid layer, at the released engine rule and both released sizes', () => {
    const code = stripComments(sectionSource);
    expect(code).toMatch(/bg-cd-grid-engine/);
    expect(code).toMatch(/bg-cd-grid-30/);
    expect(code).toMatch(/md:bg-cd-grid-38/);
    expect((code.match(/bg-cd-grid-engine/g) ?? []).length).toBe(1);
  });

  it('renders BOTH released HUD SVGs — mobile is a recomposition, never a scaled desktop layer', () => {
    const code = stripComments(sectionSource);
    expect(code).toMatch(/viewBox="0 0 1240 600"/);
    expect(code).toMatch(/viewBox="0 0 330 400"/);
    expect((code.match(/preserveAspectRatio="xMidYMid slice"/g) ?? []).length).toBe(2);
    expect(code).toMatch(/transform="translate\(0,42\)"/);
    expect(code).toMatch(/transform="translate\(10,52\)"/);
    // Desktop: 4 rings + 1 sweep = 5 circles, 8 radial lines + 4 ticks = 12 paths.
    // Mobile:  3 rings + 1 sweep = 4 circles, 4 radial lines + 4 ticks =  8 paths.
    expect((code.match(/<circle/g) ?? []).length).toBe(9);
    expect((code.match(/<path/g) ?? []).length).toBe(20);
    expect(code).toMatch(/animate-cd-hud-sweep-engine"/);
    expect(code).toMatch(/animate-cd-hud-sweep-engine-m"/);
  });

  it('the heading block is centred, semantic, and entirely dictionary-driven', () => {
    const code = stripComments(sectionSource);
    expect(code).toMatch(/<h2/);
    expect(code).toMatch(/id="intelligence-engine-heading"/);
    expect(code).toMatch(/aria-labelledby="intelligence-engine-heading"/);
    expect(code).toMatch(/text-center/);
    expect(code).toMatch(/\{t\.hubLabel\}/);
    expect(code).toMatch(/\{t\.canvasSubtitle\}/);
    expect(code).toMatch(/text-cd-mono-eyebrow-m/);
    expect(code).toMatch(/md:text-cd-mono-eyebrow/);
    expect(code).toMatch(/text-cd-accent-blue/);
  });
});

describe('M66.5 — released engine network (GN-CD-145 → GN-CD-147)', () => {
  it('the engine renders both released canvases at their fixed pixel sizes', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/h-\[340px\] w-\[310px\]/);
    expect(code).toMatch(/cd-engine:h-\[520px\] cd-engine:w-\[1240px\]/);
    expect(ENGINE_DESKTOP.canvasWidth).toBe(1240);
    expect(ENGINE_MOBILE.canvasWidth).toBe(310);
  });

  it('the M65.1 percentage/anisotropic model is gone — no aspect hack, no non-uniform SVG', () => {
    const code = stripComments(ringSource) + stripComments(geometrySource);
    expect(code).not.toMatch(/CANVAS_ASPECT_RATIO/);
    expect(code).not.toMatch(/preserveAspectRatio="none"/);
    expect(code).not.toMatch(/HUB_EDGE_RADIUS_[XY]/);
    expect(code).not.toMatch(/RING_SLOTS/);
    expect(code).not.toMatch(/hubEdgePointToward/);
    expect(code).not.toMatch(/connectorNodePoints/);
  });

  it('connectors are generated by the released routine, not transcribed into the component', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/ringEngine\(ENGINE_DESKTOP\)/);
    expect(code).toMatch(/ringEngine\(ENGINE_MOBILE\)/);
    expect(code).toMatch(/d=\{link\.d\}/);
    // No literal path data anywhere in the ring.
    expect(code).not.toMatch(/d="M\d/);
  });

  it('all three node populations render, and the filler ring is never animated', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/fillerNodes\(config\)/);
    expect(code).toMatch(/r=\{FILLER_RADIUS\}/);
    expect(code).toMatch(/fill=\{FILLER_FILL\}/);
    expect(code).toMatch(/link\.anchor\.x/);
    expect(code).toMatch(/link\.edge\.x/);
    const fillerBlock = code.slice(code.indexOf('fillerNodes(config)'), code.indexOf('link.anchor.x'));
    expect(fillerBlock).not.toMatch(/<animate/);
  });

  it('every connector carries a bidirectional pulse on BOTH viewports', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/<animateMotion/);
    expect(code).toMatch(/path=\{link\.motion\}/);
    expect(code).toMatch(/keyPoints=\{PULSE_KEY_POINTS\}/);
    expect(code).toMatch(/keyTimes=\{PULSE_KEY_TIMES\}/);
    // ONE network component, used for both viewports — the algorithm runs on
    // the active parameter set rather than a rendered desktop tree being scaled.
    expect((code.match(/<EngineNetwork/g) ?? []).length).toBe(2);
    expect(code).not.toMatch(/scale\(/);
  });

  it('desktop illuminates the whole relationship on hover; mobile has no hover, as released', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/CONNECTOR_WIDTH_HOVER/);
    expect(code).toMatch(/HOVER_NODE_RATIO/);
    expect(code).toMatch(/interactive={false}/);
    expect(code).toMatch(/restStroke=\{CONNECTOR_REST_MOBILE\}/);
    expect(code).toMatch(/restStroke=\{CONNECTOR_REST_DESKTOP\}/);
  });

  it('the released hub layers are present, with the released motion tokens', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/animate-cd-hub-outer-m/);
    expect(code).toMatch(/md:animate-cd-engine-orbit/);
    expect(code).toMatch(/animate-cd-hub-radar-m/);
    expect(code).toMatch(/cd-engine:animate-cd-engine-radar/);
    expect(code).toMatch(/animate-cd-engine-breath/);
    expect(code).toMatch(/cd-engine:animate-cd-engine-dashed/);
    expect(code).toMatch(/bg-cd-core-m/);
    expect(code).toMatch(/md:bg-cd-core/);
    expect(code).toMatch(/shadow-cd-core-glow-m/);
    expect(code).toMatch(/md:shadow-cd-core-glow/);
    // GN-CD-137: the glow IS the core's second shadow — never a second element.
    expect((code.match(/shadow-cd-core-glow/g) ?? []).length).toBe(2);
  });

  it('GN-CD-151 — the family declares NO z-index anywhere; stacking is pure DOM order', () => {
    for (const source of [sectionSource, ringSource, panelSource, geometrySource]) {
      expect(stripComments(source)).not.toMatch(/z-index/);
      expect(stripComments(source)).not.toMatch(/\bz-\d/);
      expect(stripComments(source)).not.toMatch(/\bz-\[/);
    }
  });
});

describe('M66.5 — reduced motion (GN-CD-155, GN-CD-305 §L.2)', () => {
  it('the ring SUBSCRIBES to the media query rather than memoising it', () => {
    expect(ringSource).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    expect(ringSource).toMatch(/addEventListener\('change'/);
    expect(ringSource).toMatch(/removeEventListener\('change'/);
  });

  it('every SMIL element is emitted with begin="indefinite" under reduced motion', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/reduced \? 'indefinite'/);
    // Every animate/animateMotion goes through the same guarded emitter.
    const beginAttrs = code.match(/begin=\{[^}]+\}/g) ?? [];
    expect(beginAttrs.length).toBeGreaterThanOrEqual(4);
    for (const attr of beginAttrs) {
      expect(attr).toMatch(/begin\(/);
    }
  });

  it('every pulse carries the released removal hook', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/className="cd-motion-pulse"/);
    expect((code.match(/cd-motion-pulse/g) ?? []).length).toBe(1);
  });

  it('connectors, nodes, cards and the hub are NOT altered by reduced motion — no layout shift', () => {
    const code = stripComments(ringSource);
    // `reduced` reaches only the SMIL begin emitter, never a class list or a size.
    expect(code).not.toMatch(/reduced \?\s*'[a-z-]*:?[a-z-]*'\s*:\s*'[a-z-]/);
    expect(code).not.toMatch(/reduced && /);
  });
});

describe('M66.5 — released module card (GN-CD-148/149/156)', () => {
  it('the card is a fixed released box at both authored viewports', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/h-\[56px\] w-\[108px\]/);
    expect(code).toMatch(/cd-engine:h-\[82px\] cd-engine:w-\[340px\]/);
    expect([ENGINE_DESKTOP.cardW, ENGINE_DESKTOP.cardH]).toEqual([340, 82]);
    expect([ENGINE_MOBILE.cardW, ENGINE_MOBILE.cardH]).toEqual([108, 56]);
  });

  it('GN-CD §D — the two-level mount is preserved: outer none, inner auto', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/pointer-events-none absolute inset-0/);
    expect(code).toMatch(/pointer-events-auto absolute/);
  });

  it('identity colour reaches border, fill, glow, tile, name, icon and badge through ONE property', () => {
    const code = stripComments(panelSource);
    expect(code).toMatch(/'--em-ch': identity\.rgb/);
    expect(code).toMatch(/border-\[color:rgba\(var\(--em-ch\),\.35\)\]/);
    expect(code).toMatch(/bg-\[linear-gradient\(120deg,rgba\(var\(--em-ch\),\.1\),rgba\(6,11,22,\.85\)\)\]/);
    expect(code).toMatch(/shadow-\[0_0_16px_rgba\(var\(--em-ch\),\.07\)\]/);
    expect(code).toMatch(/md:shadow-\[0_0_24px_rgba\(var\(--em-ch\),\.07\)\]/);
    expect(code).toMatch(/text-\[color:rgb\(var\(--em-ch\)\)\]/);
    expect(code).toMatch(/stroke-\[rgb\(var\(--em-ch\)\)\]/);
    // CTO decision D-4 A — the shared accent tables are NOT touched.
    expect(code).not.toMatch(/moduleAccentClasses/);
    expect(code).not.toMatch(/MODULE_ACCENT_/);
  });

  it('GN-CD-149 — white-space:nowrap on the status badge is present and load-bearing', () => {
    expect(stripComments(panelSource)).toMatch(/whitespace-nowrap/);
  });

  it('exactly three status values exist, they are dictionary-driven, and status is TEXT not colour', () => {
    const code = stripComments(panelSource);
    expect(code).toMatch(/t\.stateLabels\.active/);
    expect(code).toMatch(/t\.stateLabels\.preview/);
    expect(code).toMatch(/t\.stateLabels\.comingSoon/);
    expect(code).toMatch(/\{stateLabel\}/);
    for (const language of ['en', 'pl'] as const) {
      const labels = getDictionary(language).intelligenceModules.stateLabels;
      expect(new Set([labels.active, labels.preview, labels.comingSoon]).size).toBe(3);
    }
  });

  it('desktop shows the two-letter tile; mobile shows the released line icon, as released (UNRESOLVED-007)', () => {
    const code = stripComments(panelSource);
    expect(code).toMatch(/MOBILE_ICON_PATHS/);
    expect(code).toMatch(/h-\[17px\] w-\[17px\]/);
    expect(code).toMatch(/h-\[32px\] w-\[32px\]/);
    expect(code).toMatch(/\{module\.code\}/);
  });

  it('the mobile card uses shortTitle and the desktop card uses the full title (CTO decision D-5 A)', () => {
    const code = stripComments(panelSource);
    expect(code).toMatch(/\{moduleText\.shortTitle\}/);
    expect(code).toMatch(/\{moduleText\.title\}/);
    expect(code).toMatch(/overflow-hidden text-ellipsis whitespace-nowrap/);
  });

  it('GN-CD-148 — the description renders on desktop only', () => {
    const code = stripComments(panelSource);
    // lastIndexOf, not indexOf: the accessible-name template also interpolates
    // the description, and that occurrence is not the rendered one.
    const descIndex = code.lastIndexOf('{moduleText.description}');
    expect(descIndex).toBeGreaterThan(0);
    const block = code.slice(code.lastIndexOf('<span', descIndex), descIndex);
    expect(block).toMatch(/hidden/);
    expect(block).toMatch(/md:line-clamp-2/);
    // Exactly ONE display utility in the md bucket: `line-clamp-2` already
    // declares `display:-webkit-box`, so adding `md:block` would make the
    // two-line clamp depend on Tailwind's plugin ordering.
    expect(block).not.toMatch(/md:block/);
  });

  it('GN-CD-156 — the released hover, focus and disabled treatments are present', () => {
    const code = stripComments(panelSource);
    expect(code).toMatch(/hover:brightness-\[1\.16\]/);
    expect(code).toMatch(/hover:saturate-\[1\.08\]/);
    expect(code).toMatch(/hover:-translate-y-px/);
    expect(code).toMatch(/focus-visible:brightness-\[1\.2\]/);
    expect(code).toMatch(/cursor-not-allowed/);
    expect(code).toMatch(/opacity-\[\.88\] md:opacity-\[\.86\]/);
    expect(code).toMatch(/motion-reduce:/);
  });

  it('CTO decision D-12 A — the released .35 border alpha ships unaltered', () => {
    expect(stripComments(panelSource)).toMatch(/rgba\(var\(--em-ch\),\.35\)/);
    expect(stripComments(panelSource)).not.toMatch(/rgba\(var\(--em-ch\),\.5\)/);
  });
});

describe('M66.5 — accessibility (GN-CD §N, CTO decisions D-8 B / D-8a)', () => {
  it('the engine SVG is entirely decorative and says so', () => {
    const code = stripComments(ringSource);
    const svgCount = (code.match(/<svg/g) ?? []).length;
    expect(svgCount).toBeGreaterThanOrEqual(1);
    expect((code.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(svgCount);
    expect(code).toMatch(/focusable="false"/);
    expect(stripComments(sectionSource)).toMatch(/aria-hidden="true"/);
  });

  it('the duplicated hub core title is decorative; the derived capability line stays accessible', () => {
    const code = stripComments(ringSource);
    const coreIndex = code.indexOf('{t.hubLabel}');
    expect(coreIndex).toBeGreaterThan(0);
    const titleBlock = code.slice(code.lastIndexOf('<span', coreIndex), coreIndex);
    expect(titleBlock).toMatch(/aria-hidden="true"/);
    const labelIndex = code.indexOf('{capabilityCountLabel}');
    const labelBlock = code.slice(code.lastIndexOf('<span', labelIndex), labelIndex);
    expect(labelBlock).not.toMatch(/aria-hidden/);
    // GN-CD-144 authors the status label desktop-only; it is visually absent
    // on mobile and still announced.
    expect(labelBlock).toMatch(/sr-only/);
    expect(labelBlock).toMatch(/md:not-sr-only/);
  });

  it('the nine cards exist EXACTLY ONCE in the DOM — Tab reaches nine, not eighteen', () => {
    const code = stripComments(ringSource);
    expect((code.match(/<IntelligenceModulePanel/g) ?? []).length).toBe(1);
    expect((code.match(/cards\.map\(/g) ?? []).length).toBe(1);
  });

  it('CTO decision D-9 A — DOM order is the released geometry order', () => {
    expect(stripComments(ringSource)).toMatch(/for \(const id of RING_ORDER\)/);
    expect([...RING_ORDER]).toEqual(ENGINE_DESKTOP.items.map((item) => item.id));
    // A module named in RING_ORDER but absent from the registry must drop out
    // loudly rather than shift the ring — the fail-loud guard, asserted.
    expect(stripComments(ringSource)).toMatch(/if \(moduleItem && desktop && mobile\)/);
  });

  it('every card announces its status, whether or not it is a link', () => {
    const code = stripComments(panelSource);
    expect(code).toMatch(/const accessibleName = `\$\{moduleText\.title\}: \$\{moduleText\.description\}, \$\{stateLabel\}`/);
    expect((code.match(/aria-label=\{accessibleName\}/g) ?? []).length).toBe(2);
  });

  it('the visible name and badge are decorative, because the accessible name already carries them', () => {
    const code = stripComments(panelSource);
    expect((code.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('GN-CD §N.4 — the mobile card clears the 44px touch floor on both axes', () => {
    expect(ENGINE_MOBILE.cardW).toBeGreaterThanOrEqual(44);
    expect(ENGINE_MOBILE.cardH).toBeGreaterThanOrEqual(44);
  });
});

describe('M66.5 — responsive composition (CTO decision D-3 C)', () => {
  it('the desktop floor is a NEW breakpoint derived from the released canvas, not the Hero breakpoint', () => {
    const screens = (themeExtend.screens ?? {}) as Record<string, string>;
    expect(screens['cd-engine']).toBe('1340px');
    expect(screens['cd-hero']).toBe('1240px');
    // 1340 - 52 (PageCanvas) - 48 (section padding) = 1240, the released canvas.
    expect(1340 - 52 - 48).toBe(ENGINE_DESKTOP.canvasWidth);
  });

  it('all three bands are expressed, and the intermediate band is retained rather than invented', () => {
    const code = stripComments(ringSource);
    expect(code).toMatch(/md:hidden/);
    expect(code).toMatch(/hidden cd-engine:block/);
    expect(code).toMatch(/md:grid md:grid-cols-2/);
    expect(code).toMatch(/cd-engine:absolute/);
  });

  it('nothing is solved with a scale transform — prohibited by GN-CD-154 and NON-NEGOTIABLE #13', () => {
    for (const source of [sectionSource, ringSource, panelSource]) {
      expect(stripComments(source)).not.toMatch(/scale\(/);
      expect(stripComments(source)).not.toMatch(/\bscale-\d/);
    }
  });

  it('the released tokens this milestone needs all exist, and none collides in the bg- namespace', () => {
    const colors = (themeExtend.colors?.cd ?? {}) as Record<string, string>;
    const images = (themeExtend.backgroundImage ?? {}) as Record<string, string>;
    const shadows = (themeExtend.boxShadow ?? {}) as Record<string, string>;
    const sizes = (themeExtend.backgroundSize ?? {}) as Record<string, string>;
    const fonts = (themeExtend.fontSize ?? {}) as Record<string, unknown>;
    const animations = (themeExtend.animation ?? {}) as Record<string, string>;

    for (const key of ['hub-dash', 'hub-breath', 'hub-breath-m', 'hub-core', 'hub-core-m']) {
      expect(colors[key]).toBeTruthy();
    }
    for (const key of ['cd-engine', 'cd-engine-m', 'cd-grid-engine', 'cd-radar', 'cd-radar-m', 'cd-core', 'cd-core-m']) {
      expect(images[key]).toBeTruthy();
    }
    expect(shadows['cd-core-glow']).toBe('0 0 46px rgba(34,211,238,.26), 0 0 90px rgba(37,99,235,.16)');
    expect(shadows['cd-core-glow-m']).toBe('0 0 26px rgba(34,211,238,.32)');
    expect(sizes['cd-grid-38']).toBe('38px 38px');
    expect(sizes['cd-grid-30']).toBe('30px 30px');
    for (const key of ['cd-mono-eyebrow-m', 'cd-mono-tile', 'cd-engine-sub', 'cd-core-title', 'cd-core-title-m']) {
      expect(fonts[key]).toBeTruthy();
    }
    // GN-CD-143 ERRATA: 7px, not 7.5px.
    expect((fonts['cd-core-title-m'] as [string, unknown])[0]).toBe('7px');
    // The released hub motion tokens were already provisioned by M66.1.
    expect(animations['cd-engine-orbit']).toBe('cd-spin 90s linear infinite');
    expect(animations['cd-engine-radar']).toBe('cd-spin 34s linear infinite');
    expect(animations['cd-engine-breath']).toBe('cd-breath 7.5s ease-in-out infinite');
    expect(animations['cd-engine-dashed']).toBe('cd-spin 44s linear infinite reverse');

    const namespace = [...Object.keys(colors).map((k) => `cd-${k}`), ...Object.keys(images), ...Object.keys(sizes)];
    expect(new Set(namespace).size).toBe(namespace.length);
  });
});

describe('M66.5 — client boundary stays narrow', () => {
  it('the section shell remains a Server Component and defines no DOM handler of its own', () => {
    expect(sectionSource.trimStart().startsWith("'use client'")).toBe(false);
    expect(sectionSource).not.toMatch(/on[A-Z]\w+=\{/);
  });

  it('the ring is the one client boundary, owning hover state and the reduced-motion subscription only', () => {
    expect(ringSource.trimStart().startsWith("'use client'")).toBe(true);
    const code = stripComments(ringSource);
    // Two pieces of state and no more: hover emphasis, and the reduced-motion
    // preference. Counted as CALLS, so the import line is not miscounted.
    expect((code.match(/=\s*useState[(<]/g) ?? []).length).toBe(2);
    expect((code.match(/useState<Hovered>\(null\)/g) ?? []).length).toBe(1);
    expect((code.match(/useEffect\(/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/getBoundingClientRect|ResizeObserver|requestAnimationFrame/);
  });

  it('the panel is a Client Component, because it defines DOM handlers in its own JSX', () => {
    expect(panelSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(panelSource).toMatch(/onMouseEnter=\{/);
    expect(panelSource).toMatch(/onFocus=\{/);
  });

  it('emphasis handlers sit on the FOCUSABLE root, not on an inner div nested inside the link', () => {
    const anchorBlock = panelSource.slice(panelSource.indexOf('<a'), panelSource.indexOf('</a>'));
    expect(anchorBlock).toMatch(/onFocus=\{/);
    expect(anchorBlock).toMatch(/onBlur=\{/);
    expect(anchorBlock).toMatch(/onMouseEnter=\{/);
  });

  it('the engine issues no request and imports no API client — it is configuration and geometry only', () => {
    for (const source of [ringSource, panelSource, sectionSource, geometrySource]) {
      expect(source).not.toMatch(/fetch\(/);
      expect(source).not.toMatch(/@\/lib\/api\//);
      expect(source).not.toMatch(/signals?Api|GeoSignal/i);
    }
  });

  it('the pulses are never presented as telemetry', () => {
    const code = stripComments(ringSource) + stripComments(geometrySource) + stripComments(panelSource);
    expect(code).not.toMatch(/telemetry|traffic|throughput|requests per/i);
  });
});

describe('M66.5 — navigation, localization and protected surfaces', () => {
  it('the #intelligence-modules anchor survives, and MobileBottomNav still points at it', () => {
    expect(sectionSource).toMatch(/id="intelligence-modules"/);
    expect(bottomNavSource).toMatch(/href: '#intelligence-modules'/);
  });

  it('the homepage renders ONE engine section, and neither retired renderer', () => {
    expect(stripComments(pageSource)).toMatch(/<IntelligenceEngineSection language=\{language\} \/>/);
    expect(stripComments(pageSource)).not.toMatch(/<IntelligenceModulesDesktop/);
    expect(stripComments(pageSource)).not.toMatch(/<IntelligenceModulesMobile/);
  });

  it('the retired components are neither imported nor resurrected by this milestone', () => {
    for (const source of [sectionSource, ringSource, panelSource, geometrySource]) {
      const code = stripComments(source);
      expect(code).not.toMatch(/IntelligenceEngineInteractive/);
      expect(code).not.toMatch(/IntelligenceModulesDesktop/);
      expect(code).not.toMatch(/IntelligenceModulesMobile/);
      expect(code).not.toMatch(/IntelligenceModuleCard/);
    }
  });

  it('every visible string is dictionary-driven in BOTH production languages', () => {
    for (const language of ['en', 'pl'] as const) {
      const t = getDictionary(language).intelligenceModules;
      expect(t.hubLabel.length).toBeGreaterThan(0);
      expect(t.canvasSubtitle.length).toBeGreaterThan(0);
      expect(t.stateLabels.active.length).toBeGreaterThan(0);
      expect(t.stateLabels.preview.length).toBeGreaterThan(0);
      expect(t.stateLabels.comingSoon.length).toBeGreaterThan(0);
      for (const moduleItem of INTELLIGENCE_MODULES) {
        const text = t.modules[moduleItem.dictionaryKey as keyof typeof t.modules];
        expect(text.title.length).toBeGreaterThan(0);
        expect(text.shortTitle.length).toBeGreaterThan(0);
        expect(text.description.length).toBeGreaterThan(0);
      }
    }
    const en = getDictionary('en').intelligenceModules;
    const pl = getDictionary('pl').intelligenceModules;
    expect(pl.canvasSubtitle).not.toBe(en.canvasSubtitle);
    expect(pl.modules.evidence.description).not.toBe(en.modules.evidence.description);
    expect(pl.modules.forecast.shortTitle).not.toBe(en.modules.forecast.shortTitle);
  });

  it('the Evidence description makes no bias-detection claim in either language (CTO Decision 2)', () => {
    expect(getDictionary('en').intelligenceModules.modules.evidence.description).toBe(
      'Compare sources. Find agreements and disagreements.',
    );
    expect(getDictionary('en').intelligenceModules.modules.evidence.description).not.toMatch(/bias/i);
    expect(getDictionary('pl').intelligenceModules.modules.evidence.description).not.toMatch(/bias|stronnicz/i);
  });

  it('no hardcoded English survives in the engine components', () => {
    for (const source of [sectionSource, ringSource, panelSource]) {
      const code = stripComments(source);
      expect(code).not.toMatch(/>[A-Z][a-z]+ [A-Z][a-z]+</);
      expect(code).not.toMatch(/'(Active|Preview|Coming soon)'/);
    }
  });

  it('geometry is described exactly once — the duplicate-constant problem does not return', () => {
    expect(ringSource).toMatch(/from '@\/components\/home\/intelligenceEngineGeometry'/);
    expect(panelSource).toMatch(/from '@\/components\/home\/intelligenceEngineGeometry'/);
    const code = stripComments(ringSource) + stripComments(panelSource);
    expect(code).not.toMatch(/const ENGINE_(DESKTOP|MOBILE)\s*=/);
    expect(code).not.toMatch(/function ringEngine/);
  });
});
