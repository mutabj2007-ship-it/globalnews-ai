import { readFileSync } from 'fs';
import { join } from 'path';

const shellSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const interactiveSource = readFileSync(join(__dirname, 'IntelligenceEngineInteractive.tsx'), 'utf-8');
const cardSource = readFileSync(join(__dirname, 'IntelligenceModuleCard.tsx'), 'utf-8');

/**
 * CTO connector-hover authorization — IntelligenceModulesDesktop was
 * split into a thin Server Component shell (section chrome only) and
 * IntelligenceEngineInteractive (a narrowly-scoped 'use client'
 * component owning the hub/connector/card hover-focus state). This
 * test file was updated to check content in its new location rather
 * than assuming everything still lives in one file.
 */
describe('Intelligence Engine shell (Server Component, CTO connector-hover authorization)', () => {
  it('the shell itself requires no client JS — no "use client" directive', () => {
    expect(shellSource.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('the shell renders the interactive surface, delegating hub/connector/card ownership to it', () => {
    expect(shellSource).toMatch(/<IntelligenceEngineInteractive/);
  });

  it('the section has a background technical field, not empty black space', () => {
    expect(shellSource).toMatch(/backgroundImage/);
  });

  it('uses the wider frame-utilization max-width', () => {
    expect(shellSource).toMatch(/max-w-\[1480px\]/);
  });
});

describe('Intelligence Engine interactive surface (CTO connector-hover authorization)', () => {
  it('is the ONLY client boundary for this feature — a narrowly-scoped "use client", not the whole homepage', () => {
    expect(interactiveSource.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('owns exactly one piece of local state — hoveredModuleId, no global state/new dependency', () => {
    expect(interactiveSource).toMatch(/useState<string \| null>\(null\)/);
    expect(interactiveSource).not.toMatch(/redux|zustand|useContext/i);
  });

  it('renders a prominent central engine hub — not merely a text eyebrow', () => {
    expect(interactiveSource).toMatch(/gna-hub-core/);
    expect(interactiveSource).toMatch(/h-44 w-44/);
  });

  it('hub ring/core animations respect prefers-reduced-motion', () => {
    expect(interactiveSource).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('renders one colored connector trace per module that reacts to hoveredModuleId — brighter stroke/wider width/larger terminus when active', () => {
    expect(interactiveSource).toMatch(/const active = hoveredModuleId === module\.id/);
    expect(interactiveSource).toMatch(/strokeWidth=\{active \? '0\.9' : '0\.4'\}/);
    expect(interactiveSource).toMatch(/r=\{active \? '1\.5' : '0\.9'\}/);
  });

  it('connector state changes use plain CSS transitions, not requestAnimationFrame/scroll listeners/animation libraries', () => {
    const codeOnly = interactiveSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(interactiveSource).toMatch(/transition-all duration-200/);
    expect(codeOnly).not.toMatch(/requestAnimationFrame/);
    expect(codeOnly).not.toMatch(/addEventListener\(['"]scroll/);
  });

  it('module cards render from the canonical config and wire up hover/focus state both ways (onHoverChange + isEmphasized)', () => {
    expect(interactiveSource).toMatch(/INTELLIGENCE_MODULES\.map/);
    expect(interactiveSource).toMatch(/onHoverChange=\{setHoveredModuleId\}/);
    expect(interactiveSource).toMatch(/isEmphasized=\{hoveredModuleId === module\.id\}/);
  });
});

describe('Module card hover/focus contract (CTO connector-hover authorization)', () => {
  it('fires onHoverChange on BOTH mouse hover and keyboard focus \u2014 never hover-only', () => {
    expect(cardSource).toMatch(/onMouseEnter=\{\(\) => onHoverChange\?\.\(module\.id\)\}/);
    expect(cardSource).toMatch(/onMouseLeave=\{\(\) => onHoverChange\?\.\(null\)\}/);
    expect(cardSource).toMatch(/onFocus=\{\(\) => onHoverChange\?\.\(module\.id\)\}/);
    expect(cardSource).toMatch(/onBlur=\{\(\) => onHoverChange\?\.\(null\)\}/);
  });

  it('onHoverChange and isEmphasized are optional, defaulting to no-op/false \u2014 IntelligenceModulesMobile (no connector to link) is unaffected', () => {
    expect(cardSource).toMatch(/onHoverChange\?:/);
    expect(cardSource).toMatch(/isEmphasized\?:\s*boolean/);
    expect(cardSource).toMatch(/isEmphasized = false/);
  });

  it('supports a tall (portrait) variant for the desktop band', () => {
    expect(cardSource).toMatch(/tall\?:\s*boolean/);
    expect(cardSource).toMatch(/min-h-\[190px\]/);
  });

  it('never uses a background-gradient class combined with a text-color class (a real bug caught and fixed earlier this revision)', () => {
    expect(cardSource).not.toMatch(/bg-gradient-to-\w+ \$\{accent\.text\}/);
  });

  it('active/preview/comingSoon states remain communicated via a text badge, not color alone', () => {
    expect(cardSource).toMatch(/\{stateLabel\}/);
  });

  it('non-navigable modules never render as a clickable link', () => {
    expect(cardSource).toMatch(/if \(navigable && module\.destination\)/);
  });
});
