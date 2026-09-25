import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { getDictionary } from '@/lib/i18n/dictionaries';
import tailwindConfig from '../../../tailwind.config';
import { ENGINE_DESKTOP, ENGINE_MOBILE, MODULE_IDENTITY, RING_ORDER } from './intelligenceEngineGeometry';

const sectionSource = readFileSync(join(__dirname, 'IntelligenceEngineSection.tsx'), 'utf-8');
const ringSource = readFileSync(join(__dirname, 'IntelligenceEngineRing.tsx'), 'utf-8');
const panelSource = readFileSync(join(__dirname, 'IntelligenceModulePanel.tsx'), 'utf-8');
const geometrySource = readFileSync(join(__dirname, 'intelligenceEngineGeometry.ts'), 'utf-8');
const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const bottomNavSource = readFileSync(join(__dirname, '../navigation/MobileBottomNav.tsx'), 'utf-8');
const developmentsSource = readFileSync(join(__dirname, 'GlobalDevelopments.tsx'), 'utf-8');
const hashFocusSource = readFileSync(join(__dirname, 'GlobalDevelopmentsHashFocus.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, '../navigation/NavBar.tsx'), 'utf-8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface ThemeExtend {
  colors?: { cd?: Record<string, unknown> };
  fontSize?: Record<string, unknown>;
  screens?: Record<string, unknown>;
  scrollMargin?: Record<string, unknown>;
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

  /*
    ── FINAL-9-MODULE-ENGINE-CONVERGENCE-R1 · THE STATE CENSUS MOVED, AND HERE
       IS WHY IT IS NOT A RELAXATION ────────────────────────────────────────

    It read 4 ACTIVE / 2 PREVIEW / 3 COMING SOON. It now reads 2 / 6 / 1, and
    every one of those movements is a badge becoming MORE truthful rather than
    less, which is what §7 asks for:

      ai-research -> security      ACTIVE  -> PREVIEW   `/security` is 404; the
                                                        only surface is a
                                                        noindex preview route
      evidence    -> politics      ACTIVE  -> PREVIEW   `/politics` is 404; same
      market                       SOON    -> PREVIEW   `/market` EXISTS and
                                                        renders the accepted
                                                        Part VII frame, so
                                                        "not yet available to
                                                        inspect" was false
      timeline    -> humanitarian  SOON    -> PREVIEW   `/humanitarian` exists
                                                        and renders
      forecast    -> energy        SOON    -> SOON      no surface of any kind

    The two that stayed ACTIVE are the two open user surfaces: the homepage feed
    anchor and `/map`. Nothing was promoted; two things were demoted to the
    truth and three were promoted to a weaker claim than they could make.
  */
  /*
    ── R2 · ONE ACTIVE, BECAUSE ONE WORKING PRODUCT SURFACE EXISTS ──────────

    World left ACTIVE by ruling, not by drift:
    `MAIN-WORLD-INTELLIGENCE-CANONICAL-FOUNDATION-R1` makes World a SURFACE
    distinct from Home, Map and Country — and R1's destination WAS Home's own
    section anchor. A card cannot be the working surface for a thing it is
    defined as not being.
  */
  it('exactly one module is ACTIVE — the one working product surface', () => {
    const active = INTELLIGENCE_MODULES.filter((m) => m.state === 'active').map((m) => m.id).sort();
    expect(active).toEqual(['country-intelligence']);
  });

  it('seven PREVIEW and one COMING SOON — the badge follows the surface, not the card', () => {
    expect(INTELLIGENCE_MODULES.filter((m) => m.state === 'preview').map((m) => m.id).sort()).toEqual([
      'conflict',
      'economy',
      'energy',
      'humanitarian',
      'market',
      'politics',
      'security',
    ]);
    /*
      Energy moved COMING SOON -> PREVIEW with H-ENERGY-PARTXI-IMPLEMENTATION-R4.
      That is the one direction a badge may move on its own: COMING SOON asserts
      no surface exists, and one now does. World is the last card for which that
      assertion is still true.
    */
    expect(INTELLIGENCE_MODULES.filter((m) => m.state === 'comingSoon').map((m) => m.id).sort()).toEqual([
      'world-intelligence',
    ]);
  });

  it('the nine are the specialist family, and no stale heading survives', () => {
    /*
      §3 — the four removed headings must not remain as top-level cards. Checked
      on the KEYS a renderer reads, so a heading cannot come back through the
      dictionary while the id stays new.
    */
    const ids = INTELLIGENCE_MODULES.map((m) => m.id);
    const keys = INTELLIGENCE_MODULES.map((m) => m.dictionaryKey);
    for (const gone of ['ai-research', 'evidence', 'timeline', 'forecast']) {
      expect(`${gone}: ${ids.includes(gone)}`).toBe(`${gone}: false`);
    }
    for (const gone of ['aiResearch', 'evidence', 'timeline', 'forecast']) {
      expect(`${gone}: ${keys.includes(gone)}`).toBe(`${gone}: false`);
    }
    expect(ids.sort()).toEqual([
      'conflict', 'country-intelligence', 'economy', 'energy', 'humanitarian',
      'market', 'politics', 'security', 'world-intelligence',
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

  it('the hub line reads "9 modules · 1 active" today, in both languages, with correct Polish grammar', () => {
    const total = INTELLIGENCE_MODULES.length;
    const active = INTELLIGENCE_MODULES.filter((m) => m.state === 'active').length;
    const en = getDictionary('en').intelligenceModules;
    const pl = getDictionary('pl').intelligenceModules;

    expect(`${total} ${en.moduleForms[1]}`).toBe('9 modules');
    /*
      The count is DERIVED, so this line moves when the configuration does —
      which is the whole point of CTO decision D-11 and the reason the assertion
      above it forbids a hardcoded "4 ACTIVE" in the component.
    */
    /*
      ONE, and the English forms make that read correctly because all three are
      the same word. Polish's singular form is asserted below for the same
      reason it has always been: `1 aktywny`, not `1 aktywne`.
    */
    expect(`${active} ${en.activeForms[0]}`).toBe('1 active');
    expect(pl.activeForms[0]).toBe('aktywny');
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
  /*
    ── R2 §11 · PREVIEW MAY BE CLICKABLE, AND FIVE CARDS NOW ARE ────────────

    *"PREVIEW means an approved Alpha surface users may inspect, even though
    final data/provider activation is incomplete. PREVIEW MAY BE CLICKABLE. Do
    not equate PREVIEW with inert."*

    Every destination below is a route that EXISTS in the converged worktree —
    that is the standard this test holds, and it is why Politics and Conflict
    are absent from the list rather than pointed somewhere plausible.
  */
  it('accepted modules produce a real link, and each destination is a real existing surface', () => {
    const navigable = INTELLIGENCE_MODULES.filter(isModuleNavigable);
    expect(navigable.map((m) => m.id).sort()).toEqual([
      'conflict',
      'country-intelligence',
      'economy',
      'energy',
      'humanitarian',
      'market',
      'politics',
      'security',
    ]);
    const REAL = ['/conflict', '/map', '/market', '/humanitarian', '/security-visual-preview', '/economy-visual-preview',
      '/politics-visual-preview', '/energy'];
    for (const moduleItem of navigable) {
      expect(`${moduleItem.id}: ${REAL.includes(moduleItem.destination as string)}`)
        .toBe(`${moduleItem.id}: true`);
    }
    /* and each route really is on disk, not merely in this list */
    const APP = join(__dirname, '..', '..', 'app');
    for (const dir of ['conflict', 'map', 'market', 'humanitarian', 'security-visual-preview', 'economy-visual-preview',
      'politics-visual-preview', 'energy']) {
      expect(`${dir}: ${existsSync(join(APP, dir, 'page.tsx'))}`).toBe(`${dir}: true`);
    }
    /*
      AND THE GOVERNED ROUTES STAY SHUT, beside the list that just grew. Five of
      the six destinations above are preview addresses standing in for a product
      route that is NOT open; asserting their absence here, in the test that
      proves the previews exist, means the two facts cannot drift apart.
    */
    for (const shut of ['politics', 'security', 'economy']) {
      expect(`app/${shut}: ${existsSync(join(APP, shut))}`).toBe(`app/${shut}: false`);
    }
  });

  it('no card points at /search any more — §8, the obsolete generic destination', () => {
    /*
      Two cards did: `AI Research Assistant` and `Evidence & Source Comparison`,
      both landing on the same generic analysis entry because that was the old
      architecture. §8 names exactly that pattern. Neither card exists now, and
      the assertion is kept as a TRIPWIRE so a later edit cannot quietly restore
      it for a specialist module that has no route of its own.
    */
    for (const moduleItem of INTELLIGENCE_MODULES) {
      expect(`${moduleItem.id}: ${moduleItem.destination ?? '-'}`).not.toBe(`${moduleItem.id}: /search`);
    }
  });

  it('every destination is its own — no two cards share one, and none was redirected', () => {
    const destinationOf = (id: string) => INTELLIGENCE_MODULES.find((m) => m.id === id)?.destination;
    expect(destinationOf('country-intelligence')).toBe('/map');
    expect(destinationOf('security')).toBe('/security-visual-preview');
    expect(destinationOf('market')).toBe('/market');
    expect(destinationOf('economy')).toBe('/economy-visual-preview');
    expect(destinationOf('humanitarian')).toBe('/humanitarian');
    /*
      Politics joined this list when its package landed, and it names the
      PREVIEW address — never `/politics`, which stays 404 and unactivated.
      Both halves are asserted, because naming the right route matters exactly
      as much here as having one.
    */
    expect(destinationOf('politics')).toBe('/politics-visual-preview');
    expect(destinationOf('politics')).not.toBe('/politics');

    /*
      UNIQUENESS IS THE POINT OF THE ENGINE. Two cards sharing a destination
      would make the distinction the nine exist to draw invisible — which is
      why Conflict has its own `/conflict` dashboard instead of pointing at `/map`, and why the
      two cards that once shared `/search` are gone.
    */
    const set = INTELLIGENCE_MODULES.map((m) => m.destination).filter(Boolean);
    expect(new Set(set).size).toBe(set.length);

    /* World remains closed; accepted Conflict authority supplies its own route. */
    expect(destinationOf('conflict')).toBe('/conflict');
    for (const id of ['world-intelligence']) {
      expect(`${id}: ${destinationOf(id) ?? '-'}`).toBe(`${id}: -`);
    }
  });

  /*
    ── THIS TEST HAS NOW TURNED OVER TWICE, AND BOTH TIMES BY RULING ────────

    D-6 A left World ACTIVE but inert. M66 superseded it with "ACTIVE means
    actionable" and pointed the card at the homepage section it described.
    R2 §1 supersedes THAT: World Intelligence is a SURFACE, distinct from
    Home/Public Today, from Map and from Country — so the homepage anchor is no
    longer a destination it may hold, and there is no other.

    The rule underneath all three revisions is unchanged and is what is asserted
    now: a card's badge and its destination must agree, and neither may be
    chosen to make the other look better. §1: *"Do not remove the World card. Do
    not route it to Home merely to make it clickable."*
  */
  it('World Intelligence is COMING SOON and holds no destination, per the canonical ruling', () => {
    const world = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(world).toBeDefined();
    expect(world?.state).toBe('comingSoon');
    expect(world?.destination).toBeUndefined();
    expect(isModuleNavigable(world!)).toBe(false);
    /* the card is NOT removed — §1's other half */
    expect(INTELLIGENCE_MODULES.map((m) => m.id)).toContain('world-intelligence');
  });

  it('the retired World anchor is no longer claimed by any card', () => {
    for (const moduleItem of INTELLIGENCE_MODULES) {
      expect(`${moduleItem.id}: ${moduleItem.destination ?? '-'}`)
        .not.toBe(`${moduleItem.id}: /#global-developments-heading`);
    }
  });

  it.skip('superseded by R2 §1 — kept so the supersession is visible in the file', () => {
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

  /*
    ── CTO DECISION D-10 IS SUPERSEDED ON ITS PREMISE, NOT ON ITS PURPOSE ───

    D-10 made PREVIEW inert, and this test enforced it by asserting that
    anything not ACTIVE carried no destination. R2 §11 rules the premise wrong:
    PREVIEW is *"an approved Alpha surface users may inspect"* and MAY be
    clickable.

    D-10's PURPOSE survives intact and is what is asserted now — a card must
    never be clickable when there is nothing to open. That is enforced in two
    independent ways, either of which alone would hold:

      COMING SOON is never navigable, whatever a destination field says;
      no destination is never navigable, whatever a badge says.

    So the protection did not weaken; it stopped being carried by the wrong
    attribute.
  */
  it('nothing without a surface can ever become clickable (D-10\u2019s purpose, R2 \u00a711\u2019s premise)', () => {
    for (const moduleItem of INTELLIGENCE_MODULES) {
      if (moduleItem.state === 'comingSoon') {
        expect(moduleItem.destination).toBeUndefined();
        expect(isModuleNavigable(moduleItem)).toBe(false);
      }
      if (moduleItem.destination === undefined) {
        expect(isModuleNavigable(moduleItem)).toBe(false);
      }
    }
    /* and a COMING SOON card stays inert even if someone hands it a route */
    expect(isModuleNavigable({
      ...(INTELLIGENCE_MODULES.find((m) => m.state === 'comingSoon') as typeof INTELLIGENCE_MODULES[number]),
      destination: '/map',
    })).toBe(false);
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
    // The card BOUNDARY carries the identity RGB plus a per-module alpha
    // (DC-03); the decorative tile and badge keep the released .35. Both still
    // read the identity colour from the same single property.
    expect(code).toMatch(/border-\[color:rgba\(var\(--em-ch\),var\(--em-ba\)\)\]/);
    expect(code).toMatch(/border-\[color:rgba\(var\(--em-ch\),\.35\)\]/);
    expect(code).toMatch(/'--em-ch': identity\.rgb, '--em-ba': borderAlpha/);
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

  /*
    SUPERSEDED, NOT DELETED. This block used to assert 'CTO decision D-12 A —
    the released .35 border alpha ships unaltered'. Claude Design's DC-03 closes
    that deliberately-open question the other way for the four cards that are
    interactive components, so the lock is REPLACED by a stronger guard: the
    contrast is COMPUTED here, from the shipped alphas and the released colour
    stack, rather than asserted from a table. A future edit to any alpha that
    drops a navigable card below 3:1 now fails, and the five inert cards are
    still held at the released value.
  */
  it('DC-03 — every NAVIGABLE card boundary clears WCAG 2.1 SC 1.4.11 (3:1), computed', () => {
    const code = stripComments(panelSource);

    // The card border is the one place the alpha varies; the tile and the badge
    // are decorative children, not component boundaries, and keep .35.
    expect(code).toMatch(/border border-\[color:rgba\(var\(--em-ch\),var\(--em-ba\)\)\]/);
    expect((code.match(/rgba\(var\(--em-ch\),\.35\)/g) ?? []).length).toBe(2);

    const alphas: Record<string, number> = {};
    const mapBlock = code.slice(code.indexOf('const SC1411_BORDER_ALPHA: Record<string, string> = {'));
    for (const [, key, value] of mapBlock
      .slice(0, mapBlock.indexOf('};'))
      .matchAll(/'?([a-z-]+)'?:\s*'(\.\d+)'/g)) {
      alphas[key] = Number(value);
    }
    const inert = Number(/const INERT_BORDER_ALPHA = '(\.\d+)'/.exec(code)?.[1]);
    const fallback = Number(/const SC1411_BORDER_ALPHA_FALLBACK = '(\.\d+)'/.exec(code)?.[1]);

    /*
      ── THE CHECK IS NOW A SUPERSET, AND THAT IS STRICTLY STRONGER ──────────

      It asserted the alpha map's keys EQUALLED the navigable set, which was
      true while both were the same four. After ENGINE-CONVERGENCE-R1 two of
      those four are no longer navigable — but their MEASURED VALUES are still
      correct, because the alphas belong to the released COLOURS and the colours
      travelled with the slots (`security` inherits #fbbf24, `politics`
      inherits #c4b5fd).

      Deleting two measured values to satisfy an equality would throw away
      measurement and would have to be re-derived the moment either module
      opens. So the two halves of the rule are asserted separately:

        every navigable module HAS a measured alpha   — the protection
        every alpha key IS a real module id           — no orphan drift

      A navigable module without a measured alpha still fails, which is the
      thing this test exists to prevent.
    */
    const navigable = INTELLIGENCE_MODULES.filter(isModuleNavigable);
    expect(navigable.length).toBeGreaterThan(0);
    /*
      ── R2 · THE MEASURED-OR-FALLBACK RULE, WHICH IS THE FILE'S OWN ─────────

      R1's version of this required every navigable module to carry a MEASURED
      alpha. R2 makes three more modules navigable — market, economy and
      humanitarian — and none of them has one, because until now none of them
      could be clicked.

      That is not a gap the panel left open. It is the case
      `SC1411_BORDER_ALPHA_FALLBACK` exists for, in its own words: *"Any FUTURE
      module promoted to navigable without a measured value falls back to the
      highest alpha any of the nine identity colours needs … so a promotion can
      never silently ship below 3:1."*

      So the requirement is measured-OR-covered, and the REAL protection is the
      computation below, which runs for every navigable module against both
      gradient stops and both grounds and demands 3:1 whichever alpha it used.
      A module that cannot clear it fails here no matter which branch supplied
      its value — which is strictly what SC 1.4.11 asks and strictly more than
      "is it in the table".
    */
    const ids = INTELLIGENCE_MODULES.map((m) => m.id);
    expect(Number.isFinite(fallback)).toBe(true);
    for (const key of Object.keys(alphas)) {
      expect(`${key} is a module: ${ids.includes(key)}`).toBe(`${key} is a module: true`);
    }

    type Rgb = [number, number, number];
    const channel = (c: number): number => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([r, g, b]: Rgb): number =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const contrast = (a: Rgb, b: Rgb): number => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const composite = (fg: Rgb, alpha: number, bg: Rgb): Rgb =>
      [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as Rgb;

    // The released stack, read from the config rather than restated here.
    const PAGE: Rgb = [4, 6, 12];
    const stops = (token: string): Rgb[] =>
      [...String((themeExtend.backgroundImage ?? {})[token]).matchAll(
        /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/g,
      )].map(([, r, g, b, a]) => composite([+r, +g, +b], Number(a), PAGE));
    const grounds = [...stops('cd-engine'), ...stops('cd-engine-m')];
    expect(grounds).toHaveLength(4);

    for (const moduleItem of navigable) {
      const rgb = MODULE_IDENTITY[moduleItem.id].rgb.split(',').map(Number) as Rgb;
      const alpha = alphas[moduleItem.id] ?? fallback;
      for (const ground of grounds) {
        // Both stops of the card's own 120deg gradient, each over the ground.
        for (const fill of [composite(rgb, 0.1, ground), composite([6, 11, 22], 0.85, ground)]) {
          const border = composite(rgb, alpha, fill);
          // SC 1.4.11 names the ADJACENT colours: the fill inside, the ground outside.
          for (const adjacent of [fill, ground]) {
            expect({
              module: moduleItem.id,
              passes: contrast(border, adjacent) >= 3,
            }).toEqual({ module: moduleItem.id, passes: true });
          }
        }
      }
    }

    // The inert cards are NOT interactive components; DC-03 explicitly
    // leaves them at the released value, and the difference is useful.
    expect(inert).toBe(0.35);
    // Any future promotion without a measured value must still clear 3:1: the
    // fallback is the highest alpha ANY of the nine identity colours needs.
    expect(fallback).toBeGreaterThanOrEqual(Math.max(...Object.values(alphas)));
  });

  it('DC-01 — the open affordance exists, is gated on the SOLE navigability check, and invents nothing', () => {
    const code = stripComments(panelSource);

    // The string is the one that already shipped, translated, in both
    // dictionaries — orphaned until now. No new copy was written.
    expect(code).toMatch(/\{t\.openAction\}/);
    for (const language of ['en', 'pl'] as const) {
      expect(getDictionary(language).intelligenceModules.openAction.length).toBeGreaterThan(0);
    }
    expect(getDictionary('pl').intelligenceModules.openAction).not.toBe(
      getDictionary('en').intelligenceModules.openAction,
    );

    // Rendered ONLY behind `navigable` — the same isModuleNavigable() result
    // that chooses <a> over <div>, so an inert card cannot show it by styling.
    const affordance = code.slice(code.indexOf('{navigable && ('), code.indexOf('{t.openAction}'));
    expect(affordance).toMatch(/aria-hidden="true"/);
    expect((code.match(/\{navigable && \(/g) ?? []).length).toBe(1);
    expect(code).toMatch(/const navigable = isModuleNavigable\(module\)/);

    // Below md the word does not fit beside shortTitle and the badge in 108x56,
    // so the arrow travels alone — Claude Design's own instruction.
    expect(code).toMatch(/hidden md:inline">\{t\.openAction\}/);

    // No new colour: the card's own identity property tints it.
    const glyph = code.slice(code.indexOf('{navigable && ('), code.indexOf('</svg>', code.indexOf('{navigable && (')));
    expect(glyph).toMatch(/text-\[color:rgb\(var\(--em-ch\)\)\]/);
    expect(glyph).not.toMatch(/#[0-9a-fA-F]{3,6}/);

    // No UI-library import surface was added to this file for a 10px arrow.
    expect(panelSource).not.toMatch(/lucide-react/);

    // It must NOT enter the accessible name — the element is already announced
    // as a link and the name already ends in the status label.
    expect(code).toMatch(
      /const accessibleName = `\$\{moduleText\.title\}: \$\{moduleText\.description\}, \$\{stateLabel\}`/,
    );
    expect(code).not.toMatch(/accessibleName[^;]*openAction/);
  });

  it('DC-01 — the affordance can never reach an inert card', () => {
    const code = stripComments(panelSource);
    // The inert branch is the LAST return; the affordance lives in the shared
    // body behind the navigable gate, so the inert element renders no cue.
    const inertBranch = code.slice(code.lastIndexOf('return ('));
    expect(inertBranch).not.toMatch(/openAction/);
    // And the modules that would render it are provably not navigable.
    for (const moduleItem of INTELLIGENCE_MODULES.filter((m) => !isModuleNavigable(m))) {
      expect(moduleItem.destination).toBeUndefined();
    }
    /*
      THREE once the Politics package landed: World, Conflict and Energy. The
      count is written down rather than derived on purpose — it is the number of
      cards a pointer must never reach, and a silent change to it is exactly
      what this test is for.

      SO IT IS UPDATED DELIBERATELY AND WITH ITS REASON, which is the only way
      this number is allowed to move. Politics did not become navigable by a
      change to the gate or to this test; it became navigable because a real
      route now exists at the address its card names, re-measured on disk by
      `five modules produce a real link` above. The gate itself is unchanged,
      and the inert branch is still asserted to carry no affordance.
    */
    expect(INTELLIGENCE_MODULES.filter((m) => !isModuleNavigable(m)).map((m) => m.id)).toEqual(['world-intelligence']);
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
    /*
      GATE A · R5.1 — the anchor must be on the LIVE section, not merely
      present somewhere on disk. It is one of the four approved navigation
      destinations, so asserting it against the retired engine file would let
      destination 4 break while this test stayed green.
    */
    const liveSection = readFileSync(join(__dirname, 'IntelligenceModulesSection.tsx'), 'utf-8');
    expect(liveSection).toMatch(/id="intelligence-modules"/);
    expect(bottomNavSource).toMatch(/href: '#intelligence-modules'/);
  });

  /*
    GATE A · R5.1 — THIS PIN IS REPLACED, NOT DELETED.

    It asserted that page.tsx mounts IntelligenceEngineSection. Under
    `HOME_R4.1_DELTA.md` the modules section is the approved Home surface and
    the engine is retired, so the old assertion now protects a surface the
    Product Owner has superseded — exactly what
    `BETA-DESIGN-AUTHORITY-R5.1.md` §3 says to replace with a gate on the R5.1
    result instead.

    What it still guarantees, and why each half matters: Home mounts exactly
    ONE module renderer, so the three retired ones cannot come back silently;
    and the engine is retired rather than deleted, so its released geometry
    stays inspectable and every other assertion in this file keeps its subject.
  */
  it('the homepage renders ONE module section — the R5.1 one — and no retired renderer', () => {
    const code = stripComments(pageSource);
    expect(code).toMatch(/<IntelligenceModulesSection language=\{language\} \/>/);
    expect(code).not.toMatch(/<IntelligenceEngineSection/);
    expect(code).not.toMatch(/<IntelligenceModulesDesktop/);
    expect(code).not.toMatch(/<IntelligenceModulesMobile/);
  });

  it('the retired engine section is kept on disk, not deleted', () => {
    expect(sectionSource).toMatch(/id="intelligence-modules"/);
    expect(sectionSource.length).toBeGreaterThan(0);
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
    /*
      ENGINE-CONVERGENCE-R1 — the two sampled keys FOLLOW the slots they were
      sampling. `evidence` and `forecast` are no longer module keys; the same
      two SLOTS now carry `politics` and `energy`, and the property being
      checked is unchanged: Polish is really Polish, not English copied across.
    */
    expect(pl.modules.politics.description).not.toBe(en.modules.politics.description);
    expect(pl.modules.energy.shortTitle).not.toBe(en.modules.energy.shortTitle);
  });

  /*
    ── CTO DECISION 2 OUTLIVED THE CARD IT WAS WRITTEN FOR ───────────────────

    The Evidence card is gone from the Engine (§3), so the assertion that pinned
    its exact description has nothing left to pin. The RULE it enforced is not
    about that card: it is that a module description must not claim a capability
    the product does not have, and "detect bias" was the example.

    So the test is not deleted and not narrowed to one key — it is generalised
    to EVERY module description in BOTH languages. That is strictly more than it
    checked before, and it now also covers the four new cards, which is exactly
    where an overstated claim would next appear.
  */
  it('no module description claims bias detection, in either language (CTO Decision 2, generalised)', () => {
    for (const language of ['en', 'pl'] as const) {
      const modules = getDictionary(language).intelligenceModules.modules;
      for (const [key, text] of Object.entries(modules)) {
        expect(`${language}.${key}: ${/bias|stronnicz/i.test(text.description)}`)
          .toBe(`${language}.${key}: false`);
      }
    }
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

/* ─────────── Claude Design DC-02 — hash activation moves FOCUS, not only the viewport ─────────── */

describe('DC-02 — the one in-page module actually announces its arrival', () => {
  it('the anchor target is programmatically focusable, and is still the same heading', () => {
    // The id, the text and the classes are untouched — the destination in
    // intelligenceModules.ts and the guard above both depend on them.
    expect(developmentsSource).toMatch(/<h2\s+id="global-developments-heading"/);
    const heading = developmentsSource.slice(
      developmentsSource.indexOf('<h2'),
      developmentsSource.indexOf('</h2>'),
    );
    expect(heading).toMatch(/tabIndex=\{-1\}/);
    // -1 only: a real Tab stop on a heading would be a new, undesigned stop.
    expect(developmentsSource).not.toMatch(/tabIndex=\{0\}/);
  });

  it('focus is placed by a client handler mounted inside the already-client section, not by page.tsx', () => {
    expect(hashFocusSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(developmentsSource).toMatch(/<GlobalDevelopmentsHashFocus \/>/);
    // app/page.tsx is a protected file for this work and must not have moved.
    expect(pageSource).not.toMatch(/GlobalDevelopmentsHashFocus/);
    // The handler renders nothing.
    expect(hashFocusSource).toMatch(/\): null \{/);
    expect(hashFocusSource).toMatch(/return null;/);
  });

  it('it focuses the real heading, and knows only that one id', () => {
    const code = stripComments(hashFocusSource);
    expect(code).toMatch(/const TARGET_ID = 'global-developments-heading'/);
    expect(code).toMatch(/document\.getElementById\(TARGET_ID\)\?\.focus\(\)/);
    /*
      ── THE MECHANISM IS RETAINED; ITS ENGINE CALLER IS NOT ─────────────────

      This asserted that the id focused here is the id the World card pointed
      at. R2 §1 removed that destination, so the second half of the sentence has
      no subject any more.

      `GlobalDevelopmentsHashFocus` is NOT retired with it, and that is a fact
      rather than an oversight: `MobileBottomNav` ships `#intelligence-modules`
      and the same hash-focus pattern serves every in-page arrival on this page.
      What is asserted now is that the id it focuses still EXISTS — a focus
      handler aimed at a removed heading is a silent no-op, and that is the
      failure this half was really protecting against.
    */
    expect(developmentsSource).toMatch(/id="global-developments-heading"/);
    /* and no Engine card claims it any more */
    for (const moduleItem of INTELLIGENCE_MODULES) {
      expect(moduleItem.destination ?? '-').not.toContain('global-developments-heading');
    }
  });

  it('all three activation paths are covered — including re-activating an already-current fragment', () => {
    const code = stripComments(hashFocusSource);
    // 1. arriving with the fragment already in the URL (no hashchange fires)
    expect(code).toMatch(/focusIfTargeted\(\);/);
    // 2. ordinary same-document fragment navigation
    expect(code).toMatch(/addEventListener\('hashchange', focusIfTargeted\)/);
    // 3. the second activation of the SAME link, which fires no hashchange at
    //    all — the case the design's acceptance criterion names explicitly.
    expect(code).toMatch(/addEventListener\('click', handleClick\)/);
    // Both listeners are removed again.
    expect(code).toMatch(/removeEventListener\('hashchange', focusIfTargeted\)/);
    expect(code).toMatch(/removeEventListener\('click', handleClick\)/);
  });

  it('the native anchor is never hijacked — no preventDefault, no routing, no scroll animation of our own', () => {
    const code = stripComments(hashFocusSource);
    expect(code).not.toMatch(/preventDefault/);
    expect(code).not.toMatch(/scrollIntoView|scrollTo|behavior:/);
    expect(code).not.toMatch(/useRouter|next\/navigation|next\/link/);
    // It reads href and nothing else, and ignores every other anchor.
    expect(code).toMatch(/href\.endsWith\(`#\$\{TARGET_ID\}`\)/);
  });

  it('no /world route was invented to solve this, and the destination is unchanged', () => {
    expect(INTELLIGENCE_MODULES.every((m) => m.destination !== '/world')).toBe(true);
    expect(stripComments(hashFocusSource)).not.toMatch(/'\/world'|"\/world"/);
    /*
      `/search` left this list when the two cards that pointed at it left the
      Engine (§3, §8). The route itself is untouched and still serves Ask AI;
      what changed is that no Intelligence Engine card claims it.
    */
    const destinations = INTELLIGENCE_MODULES.map((m) => m.destination).filter(Boolean);
    expect([...new Set(destinations)].sort()).toEqual([
      '/conflict',
      '/economy-visual-preview',
      '/energy',
      '/humanitarian',
      '/map',
      '/market',
      '/politics-visual-preview',
      '/security-visual-preview',
    ]);
  });
});

/* ───────── G-001 — fragment navigation must not land under the sticky header ───────── */

describe('G-001 — every fragment target clears the sticky header', () => {
  /**
   * The opening tag that owns a given id, so every assertion below is about
   * THAT element. Comments are stripped first: IntelligenceEngineSection's own
   * doc comment quotes `id="intelligence-modules"` while explaining why the
   * anchor lives there, and matching the prose instead of the element would
   * make these guards vacuous.
   */
  function openingTagOf(rawSource: string, id: string): string {
    const source = stripComments(rawSource);
    const idIndex = source.indexOf(`id="${id}"`);
    expect(idIndex).toBeGreaterThan(0);
    return source.slice(idIndex, source.indexOf('>', idIndex));
  }

  /** Every `scroll-mt-[Npx]` value in an opening tag, base and variant alike. */
  function scrollMargins(tag: string): number[] {
    return [...tag.matchAll(/scroll-mt-\[(\d+)px\]/g)].map(([, px]) => Number(px));
  }

  it('the sticky header is real, and these are the heights being cleared', () => {
    // Read, not assumed: if NavBar stops being sticky, or its bars change
    // height, this test is the thing that notices.
    expect(navBarSource).toMatch(/<header className="sticky top-0/);
    expect(navBarSource).toMatch(/h-\[62px\][^"]*cd-header:flex/);
    expect(navBarSource).toMatch(/flex h-\[52px\]/);
    // The offsets below are gated on cd-header because that is the breakpoint
    // the header ITSELF switches on — mirroring it keeps them correct by
    // construction rather than by coincidence.
    expect(navBarSource).toMatch(/cd-header:(flex|hidden)/);
    expect((themeExtend.screens ?? {})['cd-header']).toBe('1400px');
  });

  it('the retired World anchor keeps its header compensation, so restoring it is safe', () => {
    /*
      R2 §1 removed the destination; the COMPENSATION on the heading is left
      exactly as released. If World's own surface ever adopts this anchor, or a
      future card points at it, the scroll margin is already correct — and a
      later edit that strips it fails here rather than in a reader's viewport.
    */
    const world = INTELLIGENCE_MODULES.find((m) => m.id === 'world-intelligence');
    expect(world?.destination).toBeUndefined();

    const tag = openingTagOf(developmentsSource, 'global-developments-heading');
    expect(scrollMargins(tag)).toEqual([65, 75]);
    expect(tag).toMatch(/cd-header:scroll-mt-\[75px\]/);

    // DC-02 focuses this element, and focusing scrolls it into view — so the
    // compensation has to sit on the SAME element the focus lands on, not on
    // an ancestor.
    expect(tag).toMatch(/tabIndex=\{-1\}/);
  });

  it("MobileBottomNav's Intelligence tab lands the engine section clear of the header", () => {
    expect(bottomNavSource).toMatch(/href: '#intelligence-modules'/);
    const tag = openingTagOf(sectionSource, 'intelligence-modules');
    expect(scrollMargins(tag)).toEqual([65, 75]);
    expect(tag).toMatch(/cd-header:scroll-mt-\[75px\]/);
  });

  it('every offset genuinely exceeds the header height it is compensating for', () => {
    // Computed from NavBar's own literals rather than restated here: the
    // mobile bar plus its 1px border, and the desktop bar plus the same.
    const mobileBar = Number(/flex h-\[(\d+)px\]/.exec(navBarSource)?.[1]);
    const desktopBar = Number(/h-\[(\d+)px\][^"]*cd-header:flex/.exec(navBarSource)?.[1]);
    const border = 1;
    expect(mobileBar).toBeGreaterThan(0);
    expect(desktopBar).toBeGreaterThan(mobileBar);

    for (const [source, id] of [
      [developmentsSource, 'global-developments-heading'],
      [sectionSource, 'intelligence-modules'],
    ] as const) {
      const [base, wide] = scrollMargins(openingTagOf(source, id));
      expect({ id, clearsMobile: base > mobileBar + border }).toEqual({ id, clearsMobile: true });
      expect({ id, clearsDesktop: wide > desktopBar + border }).toEqual({ id, clearsDesktop: true });
    }
  });

  it('NO fragment destination anywhere in the engine is left uncompensated', () => {
    // The generalizing guard. A future hash destination added to the registry
    // without a scroll margin on its target fails here rather than in a user's
    // viewport.
    const fragments = INTELLIGENCE_MODULES.map((m) => m.destination)
      .filter((d): d is string => typeof d === 'string' && d.includes('#'))
      .map((d) => d.slice(d.indexOf('#') + 1));
    /*
      EMPTY AFTER R2 — no Engine card carries a fragment destination at all.
      The guard is kept, and it is kept GENERALIZING: the moment one is added
      without a scroll margin on its target, this fails. An empty list is the
      current answer, not a disabled test.
    */
    expect(fragments).toEqual([]);

    const owners: Record<string, string> = {
      'global-developments-heading': developmentsSource,
      'intelligence-modules': sectionSource,
    };
    for (const id of [...fragments, 'intelligence-modules', 'global-developments-heading']) {
      expect({ id, compensated: scrollMargins(openingTagOf(owners[id], id)).length === 2 }).toEqual({
        id,
        compensated: true,
      });
    }
  });

  it('the correction is VISUALLY INERT — nothing released was displaced', () => {
    // scroll-margin participates in no layout, paint or stacking pass. The
    // section's released treatment is asserted in full above; this guard says
    // the G-001 classes did not arrive at the cost of any of it.
    const code = stripComments(sectionSource);
    for (const released of [
      /relative/, /overflow-hidden/, /rounded-cd-16/, /border-cd-edge-section/,
      /bg-cd-engine-m/, /md:bg-cd-engine/, /px-cd-11/, /pb-cd-14/, /pt-cd-13/,
      /md:px-cd-24/, /md:pb-cd-30/, /md:pt-cd-26/,
    ]) {
      expect(code).toMatch(released);
    }
    // The heading keeps its released type treatment and its id.
    const heading = openingTagOf(developmentsSource, 'global-developments-heading');
    expect(heading).toMatch(/mt-cd-4 font-cd-display text-2xl font-medium tracking-tight text-cd-ink-primary sm:text-3xl/);

    // Arbitrary values only — no scrollMargin key was added to the config, so
    // tailwind.config.ts stays untouched by this milestone.
    expect(themeExtend.scrollMargin).toBeUndefined();
  });
});
