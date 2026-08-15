import { readFileSync } from 'fs';
import { join } from 'path';

const cardSource = readFileSync(join(__dirname, 'IntelligenceModuleCard.tsx'), 'utf-8');
const mobileSource = readFileSync(join(__dirname, 'IntelligenceModulesMobile.tsx'), 'utf-8');
const desktopSource = readFileSync(join(__dirname, 'IntelligenceModulesDesktop.tsx'), 'utf-8');
const interactiveSource = readFileSync(join(__dirname, 'IntelligenceEngineInteractive.tsx'), 'utf-8');

/**
 * CTO browser-runtime fix — real production execution failed with:
 * "Event handlers cannot be passed to Client Component props."
 *
 * Root cause: IntelligenceModuleCard.tsx defines raw DOM event
 * handlers (onMouseEnter/onMouseLeave/onFocus/onBlur) directly in its
 * own returned JSX, but had no 'use client' directive — a hard
 * Next.js App Router violation: any component whose own render
 * output attaches DOM event handler props MUST be a Client Component.
 * A file's server/client nature is determined by its own directive,
 * not by which parent imports it — an earlier assumption that this
 * file "could remain Server-Component-compatible" was incorrect.
 *
 * Fix: added 'use client' to IntelligenceModuleCard.tsx only — the
 * minimal correct boundary. This test protects that fix and the
 * import-graph reasoning around it from regressing.
 */
describe('Intelligence module Server/Client boundary (CTO browser-runtime fix)', () => {
  it('IntelligenceModuleCard is a Client Component — required because it defines DOM event handlers in its own JSX', () => {
    expect(cardSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(cardSource).toMatch(/onMouseEnter=\{/);
    expect(cardSource).toMatch(/onMouseLeave=\{/);
    expect(cardSource).toMatch(/onFocus=\{/);
    expect(cardSource).toMatch(/onBlur=\{/);
  });

  it('IntelligenceModulesMobile is now a Client Component (M60 Phase 2, Correction 1) — it owns its own hoveredModuleId-equivalent state and wires onHoverChange/isEmphasized to drive the new connected-hub connectors, the same class of requirement that made IntelligenceModuleCard itself a client component', () => {
    expect(mobileSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(mobileSource).toMatch(/import \{ IntelligenceModuleCard \} from/);
    expect(mobileSource).toMatch(/<IntelligenceModuleCard/);
    expect(mobileSource).toMatch(/onHoverChange=\{setActiveModuleId\}/);
  });

  it('IntelligenceModulesDesktop remains a thin Server Component shell — it never imports IntelligenceModuleCard directly, only the already-client IntelligenceEngineInteractive', () => {
    expect(desktopSource.trimStart().startsWith("'use client'")).toBe(false);
    expect(desktopSource).not.toMatch(/import \{ IntelligenceModuleCard \} from/);
    expect(desktopSource).toMatch(/import \{ IntelligenceEngineInteractive \} from/);
  });

  it('IntelligenceEngineInteractive remains the intended narrow client boundary for the hover/focus interaction', () => {
    expect(interactiveSource.trimStart().startsWith("'use client'")).toBe(true);
    expect(interactiveSource).toMatch(/onHoverChange=\{setHoveredModuleId\}/);
    expect(interactiveSource).toMatch(/isEmphasized=\{hoveredModuleId === moduleItem\.id\}/);
  });

  it('no Server Component in this module group defines a raw DOM event handler in its own JSX (the exact class of bug that caused the runtime error)', () => {
    const handlerPattern = /on(MouseEnter|MouseLeave|Focus|Blur|Click|Change|Submit)=\{/;
    for (const [, source] of [
      ['IntelligenceModulesMobile', mobileSource],
      ['IntelligenceModulesDesktop', desktopSource],
    ] as const) {
      const isServerComponent = !source.trimStart().startsWith("'use client'");
      if (isServerComponent) {
        expect(handlerPattern.test(source)).toBe(false);
      }
    }
  });
});
