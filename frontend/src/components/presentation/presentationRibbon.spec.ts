import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * R7 — THE PRESENTATION RIBBON'S ACCEPTANCE CONTRACT.
 *
 * Test identifiers below are R7 §18's own (T-01 … T-32). Where a test needs a
 * live layout — column counts at measured widths, focus-ring visibility, the
 * host's frame behaviour — it belongs to the browser acceptance pass and is
 * named here as such rather than silently claimed.
 *
 * A DEDICATED FILE. F's GEO-PRECISION-1 block owns the append region at the end
 * of `dictionaries/index.spec.ts`; nothing here touches that file.
 */
const RIBBON = join(__dirname, 'PresentationRibbon.tsx');
const TAILWIND = join(__dirname, '..', '..', '..', 'tailwind.config.ts');

const source = readFileSync(RIBBON, 'utf-8');
const tailwind = readFileSync(TAILWIND, 'utf-8');

/** Every negative guard runs against comment-stripped source. */
const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const code = codeOnly(source);

describe('R7 T-01/T-03 — five content cells, fixed order, never omitted', () => {
  it('fixes the arity in the type and the identity at runtime', () => {
    expect(code).toMatch(
      /cells: readonly \[RibbonCell, RibbonCell, RibbonCell, RibbonCell, RibbonCell\];/,
    );
    expect(code).toMatch(
      /const ORDER: ReadonlyArray<RibbonCell\['kind'\]> = \['what', 'where', 'why', 'who', 'evidence'\];/,
    );
    expect(code).toMatch(/assertOrder\(cells\);/);
  });

  it('renders an unavailable cell IN PLACE rather than dropping it', () => {
    // The only filter is the mobile WHO relocation, which §13 requires.
    const filters = code.match(/cells\.filter\([\s\S]*?\);/g) ?? [];
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain("inlineWho && cell.kind === 'who'");
    expect(code).toMatch(/const unavailable = cell\.value === null;/);
    expect(code).toContain('t.unavailable');
  });
});

describe('R7 T-02 — Uncertain is a treatment, not a sixth cell', () => {
  it('has no UNCERTAIN cell kind anywhere', () => {
    expect(code).not.toMatch(/'uncertain'/);
    expect(code).toMatch(
      /kind: 'what' \| 'where' \| 'why' \| 'who' \| 'evidence';/,
    );
  });

  it('confines the amber treatment to the EVIDENCE cell', () => {
    expect(code).toMatch(/if \(cell\.kind === 'evidence'\) return evidenceTreatment/);
    const treatment = code.slice(code.indexOf('function evidenceTreatment'), code.indexOf('function cellHue'));
    expect(treatment).toContain('rgba(245,158,11,.05)');
    expect(treatment).toContain('rgba(245,158,11,.28)');
    expect(treatment).toContain('rgba(245,158,11,.4)');
  });
});

describe('R7 T-14/T-14a/T-15 — solid amber is an ACTION; tint is uncertainty', () => {
  it('keeps --gn-uncertain and --gn-action as separate constants despite one hex', () => {
    expect(code).toMatch(/const UNCERTAIN_AMBER = '#f59e0b';/);
    expect(code).toMatch(/const ACTION_AMBER = '#f59e0b';/);
  });

  it('uses solid amber as a SURFACE in exactly one place — DEEP ANALYSIS', () => {
    const solidFills = code.match(/background: ACTION_AMBER/g) ?? [];
    expect(solidFills).toHaveLength(1);
    // The uncertainty constant never becomes a background of its own.
    expect(code).not.toMatch(/background: UNCERTAIN_AMBER|backgroundColor: UNCERTAIN_AMBER/);
  });

  it('permits solid amber only on marks of 14px or less', () => {
    // The meter segment is 13×4 — the one amber mark this component draws.
    expect(code).toMatch(/className="h-\[4px\] w-\[13px\] rounded-\[2px\]"/);
    expect(code).toMatch(/backgroundColor: index < filled \? fill : '#1b2634'/);
    // No amber surface larger than a mark is filled solid.
    expect(code).not.toMatch(/bg-\[#f59e0b\]/);
  });
});

describe('R7 T-05/T-22 — the column count comes from auto-fit and nothing else', () => {
  it('drives the grid from minmax(162px, 1fr) with no media query', () => {
    expect(code).toContain('repeat(auto-fit, minmax(162px, 1fr))');
    expect(code).not.toMatch(/@media|matchMedia|window\.innerWidth|ResizeObserver/);
    expect(code).not.toMatch(/columnCount|useState\(.*columns/);
  });

  it('sets no viewport unit, no fixed position and no height on itself', () => {
    expect(code).not.toMatch(/\b\d+(vh|vw|dvh|dvw)\b/);
    expect(code).not.toMatch(/position: 'fixed'|fixed inset|className="[^"]*\bfixed\b/);
    expect(code).not.toMatch(/height: '100/);
  });
});

describe('R7 T-04/T-06/T-17-locale — labels are verbatim and never truncate', () => {
  it('renders labels nowrap at 7.5px and never abbreviates or icon-swaps them', () => {
    expect(code).toMatch(/whitespace-nowrap font-gn-mono text-\[7\.5px\] font-bold uppercase tracking-\[\.10em\]/);
    expect(code).not.toMatch(/truncate|text-ellipsis|slice\(0,|substring\(0,/);
  });

  it('carries R7 §17s exact EN and PL step labels', () => {
    const en = getDictionary('en').presentationRibbon.labels;
    const pl = getDictionary('pl').presentationRibbon.labels;
    expect(en).toEqual({
      what: 'WHAT HAPPENED',
      where: 'WHERE',
      why: 'WHY IT MATTERS',
      who: 'WHO IS AFFECTED',
      evidence: 'EVIDENCE',
    });
    expect(pl).toEqual({
      what: 'CO SIĘ STAŁO',
      where: 'GDZIE',
      why: 'DLACZEGO TO WAŻNE',
      who: 'KOGO DOTYCZY',
      evidence: 'DOWODY',
    });
  });

  it('keeps every ribbon key present, non-empty and translated in both locales', () => {
    const en = getDictionary('en').presentationRibbon;
    const pl = getDictionary('pl').presentationRibbon;
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    for (const key of ['viewSources', 'showSources', 'deepAnalysis', 'unavailable'] as const) {
      expect(pl[key].length).toBeGreaterThan(0);
      expect(pl[key]).not.toBe(en[key]);
    }
    expect(pl.deepAnalysis).toBe('PEŁNA ANALIZA');
    expect(pl.viewSources).toBe('POKAŻ ŹRÓDŁA');
  });
});

describe('R7 T-08/T-14-interaction — cells are not controls', () => {
  it('makes no cell clickable or focusable', () => {
    const cellRenderer = code.slice(code.indexOf('const renderCell'), code.indexOf('const sourcesLabel'));
    expect(cellRenderer).not.toMatch(/onClick|tabIndex|role="button"|<button/);
  });

  it('has exactly two controls, and both are real buttons', () => {
    expect((code.match(/<button/g) ?? [])).toHaveLength(2);
    expect((code.match(/type="button"/g) ?? [])).toHaveLength(2);
  });
});

describe('R7 T-10 — VIEW SOURCES states its count and its state', () => {
  it('always puts the count in the label and never ships a bare chevron', () => {
    expect(code).toMatch(/\$\{sources\.expanded \? '▾' : '▸'\}/);
    expect(code).toMatch(/\(\$\{sources\.count\}\)/);
    expect(code).toMatch(/aria-expanded=\{sources\.expanded\}/);
  });

  it('offers the workspace label variant without a second implementation', () => {
    expect(code).toMatch(/sources\.labelVariant === 'show' \? t\.showSources : t\.viewSources/);
    expect(getDictionary('en').presentationRibbon.showSources).toBe('SHOW ORIGINAL SOURCES');
  });

  it('meets the 44px hit area', () => {
    expect((code.match(/min-h-\[44px\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('R7 T-12/T-13 — DEEP ANALYSIS is absent, never disabled, never animated', () => {
  it('renders only when the caller supplies an opener', () => {
    expect(code).toMatch(/\{deepAnalysis !== undefined && \(/);
    expect(code).not.toMatch(/disabled/);
  });

  it('carries no animation, pulse or glow on any action', () => {
    expect(code).not.toMatch(/animate-|transition-transform|@keyframes|translate-y|shadow-\[0 0/);
  });
});

describe('R7 T-16/T-17/T-18 — four geography provenance classes', () => {
  it('declares exactly the four classes', () => {
    expect(code).toMatch(
      /'evidence-resolved'\s*\|\s*'retrieved-for'\s*\|\s*'ai-interpreted'\s*\|\s*'unresolved'/,
    );
  });

  it('separates them by DOT FILL and BORDER STYLE, not by hue alone', () => {
    const dot = code.slice(code.indexOf('cell.provenance !== undefined'), code.indexOf('<span className="basis">'));
    // resolved: filled cyan. retrieved-for: hollow ring. ai-interpreted: filled
    // neutral. unresolved: hollow neutral. Four cues, greyscale-separable.
    expect(dot).toMatch(/'evidence-resolved'\s*\?\s*\{ backgroundColor: GEO \}/);
    expect(dot).toMatch(/'retrieved-for'\s*\?\s*\{ border: `1px solid \$\{GEO\}` \}/);
    expect(dot).toMatch(/'ai-interpreted'\s*\?\s*\{ backgroundColor: UNKNOWN \}/);
    expect(dot).toMatch(/\{ border: `1px solid \$\{UNKNOWN\}` \}/);
  });

  it('gives ai-interpreted and unresolved the neutral hue, never resolved cyan', () => {
    expect(code).toMatch(
      /if \(cell\.provenance === 'unresolved' \|\| cell\.provenance === 'ai-interpreted'\) return UNKNOWN;/,
    );
  });

  it('places nothing on a map — the component draws no map at all', () => {
    expect(code).not.toMatch(/<svg|maplibre|marker|latitude|longitude|coordinate/i);
  });
});

describe('R7 T-20/T-21 — evidence and the untinted unresolved state', () => {
  it('never lets the meter be the sole carrier of support', () => {
    expect(code).toMatch(/\{evidence\.word\}/);
    expect(code).toMatch(/role="img" aria-label=\{label\}/);
    expect(code).toMatch(/\$\{t\.evidenceSupport\}: \$\{cell\.evidence\.word\}, \$\{cell\.evidence\.bars\} \$\{t\.ofThree\}/);
  });

  it('leaves a contested cell its bar count and states the contradiction in words', () => {
    expect(code).toMatch(/const filled = evidence\.bars;/);
  });

  it('applies NO tint to a non-evidence cell, so unresolved WHERE is untinted', () => {
    expect(code).toMatch(/const treatment = cell\.kind === 'evidence' \? evidenceTreatment\(cell\.evidence\) : null;/);
    expect(code).toMatch(/const tinted = treatment !== null && treatment\.border !== 'transparent';/);
  });
});

describe('R7 T-27/T-31 — mobile density and overflow', () => {
  it('keeps all five steps at mobile density, with WHO inline below the actions', () => {
    expect(code).toMatch(/const inlineWho = density === 'mobile';/);
    expect(code).toMatch(/\{inlineWho && \(/);
    expect(code).toMatch(/\{whoCell\.value \?\? t\.unavailable\}/);
  });

  it('scrolls a long value inside 132px on one axis only', () => {
    expect(code).toMatch(/maxHeight: '132px', overflowY: 'auto', overflowX: 'hidden'/);
    expect(code).not.toMatch(/overflow: 'auto'|overflow-auto/);
  });
});

describe('R7 T-29 — the markup is a definition list', () => {
  it('uses dl / dt / dd with the basis note inside the dd', () => {
    expect(code).toMatch(/<dl/);
    expect(code).toMatch(/<dt className="flex items-center gap-\[6px\]"/);
    expect(code).toMatch(/<dd className="mt-\[6px\]"/);
    expect(code).toMatch(/<span className="basis">\{cell\.basisNote\}<\/span>/);
    expect(code).toMatch(/aria-describedby=\{tinted \? basisId : undefined\}/);
  });
});

describe('R7 §5 — every colour is transcribed from the spec, not invented', () => {
  const ALLOWLIST_NOT_IN_TAILWIND = ['#7dc0ff', '#d97706', '#141d29'];

  it('draws every hex from tailwind.config.ts, except R7 §14s three interaction states', () => {
    const used = [...new Set((code.match(/#[0-9a-f]{6}/gi) ?? []).map((hex) => hex.toLowerCase()))];
    expect(used.length).toBeGreaterThanOrEqual(10);
    const unknown = used.filter(
      (hex) => !tailwind.toLowerCase().includes(hex) && !ALLOWLIST_NOT_IN_TAILWIND.includes(hex),
    );
    expect(unknown).toEqual([]);
  });

  it('does not edit H’s token block — it consumes released values as literals', () => {
    // The guard is the scope audit, not this file; what this asserts is that the
    // component reaches for no token name the gn-* block does not already export.
    expect(code).toMatch(/font-gn-mono/);
    expect(code).toMatch(/font-gn-display/);
  });
});

describe('R7 T-07 — there is exactly one ribbon implementation', () => {
  it('is the only component exporting a PresentationRibbon', () => {
    expect(code).toMatch(/export function PresentationRibbon\(/);
    expect((source.match(/export function PresentationRibbon/g) ?? [])).toHaveLength(1);
  });

  it('contains no Today-specific orchestration', () => {
    expect(code).not.toMatch(/TodaySection|WatchModule|homeFeed|allocateToday|TodayCard/);
    expect(code).not.toMatch(/fetch\(|accountFetch|useEffect|setInterval/);
  });
});
