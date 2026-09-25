import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { getDictionary } from '@/lib/i18n/dictionaries';
import colors from 'tailwindcss/colors';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GATE A · THE R5.1 MODULE SECTION, GATED BY RESULT RATHER THAN BY SOURCE TEXT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `BETA-DESIGN-AUTHORITY-R5.1.md` §3 requires that obsolete byte/source-text
 * pins be replaced, when touched, with gates that protect the approved R5.1
 * result. Five such pins were re-pointed in this change; this file is the
 * positive half — it asserts the things R5.1 actually decided, so a later edit
 * cannot quietly undo them.
 *
 * It deliberately does NOT pin layout strings, class names or geometry. Those
 * are what made the previous generation of specs fight the design lane. What
 * is asserted here is the CONTRACT: which modules, in which order, with which
 * states, which destinations, which badge words, which locale coverage, and
 * which of the OPEN decisions must stay unanswered.
 */

/** Local view over the two active locales; the module exports a getter, not a map. */
const dictionaries = { en: getDictionary('en'), pl: getDictionary('pl') } as const;

/** Same helper the neighbouring specs use, for the same reason: this file's
 *  own prose explains the OPEN decisions it asserts are NOT implemented, so an
 *  assertion run over the comments would fail on its own documentation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const sectionSource = readFileSync(join(__dirname, 'IntelligenceModulesSection.tsx'), 'utf-8');
/** The CODE, with prose removed — what actually renders. */
const sectionCode = stripComments(sectionSource);
const pageSource = readFileSync(join(__dirname, '..', '..', 'app', 'page.tsx'), 'utf-8');

/** The nine modules INTELLIGENCE_MODULE_MATRIX.md records, in its order. */
const MATRIX_ORDER = [
  'security',
  'world-intelligence',
  'country-intelligence',
  'politics',
  'economy',
  'conflict',
  'market',
  'humanitarian',
  'energy',
] as const;

describe('R5.1 module matrix — the registry still is what the matrix recorded', () => {
  it('carries the nine modules in the matrix order', () => {
    expect(INTELLIGENCE_MODULES.map((m) => m.id)).toEqual([...MATRIX_ORDER]);
  });

  it('holds the matrix state distribution: 1 active, 7 preview, 1 comingSoon', () => {
    const counts = INTELLIGENCE_MODULES.reduce<Record<string, number>>(
      (acc, m) => ({ ...acc, [m.state]: (acc[m.state] ?? 0) + 1 }),
      {},
    );
    expect(counts).toEqual({ active: 1, preview: 7, comingSoon: 1 });
  });

  it('routes each module exactly where the matrix says, and World Intelligence nowhere', () => {
    const routes = Object.fromEntries(INTELLIGENCE_MODULES.map((m) => [m.id, m.destination]));
    expect(routes).toEqual({
      security: '/security-visual-preview',
      'world-intelligence': undefined,
      'country-intelligence': '/map',
      politics: '/politics-visual-preview',
      economy: '/economy-visual-preview',
      conflict: '/conflict',
      market: '/market',
      humanitarian: '/humanitarian',
      energy: '/energy',
    });
  });

  it('keeps World Intelligence unnavigable, and every other module navigable', () => {
    for (const m of INTELLIGENCE_MODULES) {
      expect(isModuleNavigable(m)).toBe(m.id !== 'world-intelligence');
    }
  });

  /*
    M2 IS OPEN. The matrix default is the registry's `/conflict`; the variant
    `/map?domain=conflict` is the other candidate. Asserting the default keeps
    the open question visible if someone silently switches it.
  */
  it('leaves M2 at the registry default — Conflict opens /conflict', () => {
    const conflict = INTELLIGENCE_MODULES.find((m) => m.id === 'conflict');
    expect(conflict?.destination).toBe('/conflict');
  });
});

describe('R5.1 section — summary counted, never asserted', () => {
  it('substitutes the four counts into the template rather than hardcoding them', () => {
    /* The literal "9 modules" must not appear: R5.1 requires the line be computed. */
    expect(sectionCode).not.toMatch(/9 modules/);
    expect(sectionSource).toMatch(/INTELLIGENCE_MODULES\.length/);
    for (const token of ['{n}', '{a}', '{p}', '{u}']) {
      expect(sectionSource).toContain(token);
    }
  });

  it('renders the counts the registry actually holds, in both locales', () => {
    for (const locale of ['en', 'pl'] as const) {
      const t = dictionaries[locale].intelligenceModules;
      const line = t.modulesSummary
        .replace('{n}', '9')
        .replace('{a}', '1')
        .replace('{p}', '7')
        .replace('{u}', '1');
      expect(line).toMatch(/\b9\b/);
      expect(line).toMatch(/\b1\b/);
      expect(line).toMatch(/\b7\b/);
      expect(line).not.toMatch(/\{[naup]\}/);
    }
  });
});

describe('P1 stays OPEN — the Beta-parity badge text is what ships', () => {
  it('uses the registry wording, not R5.1’s proposed "Unavailable"', () => {
    expect(dictionaries.en.intelligenceModules.stateLabels.comingSoon).toBe('Coming soon');
    expect(dictionaries.pl.intelligenceModules.stateLabels.comingSoon).toBe('Wkrótce');
  });

  it('keeps "unavailable" out of the shipped summary and subtitle in both locales', () => {
    for (const locale of ['en', 'pl'] as const) {
      const t = dictionaries[locale].intelligenceModules;
      expect(`${t.modulesSummary} ${t.modulesSubtitle}`.toLowerCase()).not.toMatch(
        /unavailable|niedostępn/,
      );
    }
  });

  it('renders the badge from stateLabels, so adopting P1 is a dictionary edit', () => {
    expect(sectionSource).toMatch(/t\.stateLabels\.comingSoon/);
    expect(sectionCode).not.toMatch(/'Unavailable'|"Unavailable"/);
  });
});

/**
 * CTO ruling C-3 closed ONE part of P2 — the category TITLE-colour treatment.
 * These assert the approved mapping is applied exactly, and that the rest of
 * P2 is still not implemented.
 *
 * Source of truth: `CATEGORY_COLOUR_TOKENS.md`, Mapping table, module column,
 * with the intelligence-dark value of each token. World Intelligence shares
 * `--c-economy` because the package maps it there ("Economy Intelligence;
 * World Intelligence (registry: emerald)"). `--c-science` maps to "(no
 * module)" and must therefore not ship.
 */
describe('C-3 — the approved category TITLE colours are applied', () => {
  /**
   * module id -> the Tailwind class shipped, and the R5.1 intelligence-dark
   * value it must resolve to. The hexes are `CATEGORY_COLOUR_TOKENS.md`'s
   * token table; the classes are the package's own stated derivation of them
   * ("the exact Tailwind -300 text shades the branch uses").
   */
  /*
    HUES, NOT HEXES — and that is a requirement, not a shortcut.

    `CATEGORY_COLOUR_TOKENS.md` has a "Hue" column naming each token's hue, and
    states that its intelligence-dark values ARE "the exact Tailwind -300 text
    shades the branch uses". Asserting (hue, -300) therefore binds to the
    package's own table exactly as tightly as asserting the hex would.

    It must not assert the hex, because GN-CD-300 §W.4 rules that the approved
    Energy value "does not exist and must not appear" anywhere in the tree, and
    `claudeDesignFoundation.spec.ts` enforces that whole-tree. Writing the
    literal here — even to check it — would put this file in breach of an
    accepted NON-NEGOTIABLE. The hue form keeps both authorities satisfied.
  */
  const TITLE_HUE: Record<string, string> = {
    security: 'orange',
    'world-intelligence': 'emerald',
    'country-intelligence': 'blue',
    politics: 'violet',
    economy: 'emerald',
    conflict: 'red',
    market: 'cyan',
    humanitarian: 'purple',
    energy: 'amber',
  };

  it('maps every registry module to a title colour — the map is total', () => {
    for (const m of INTELLIGENCE_MODULES) {
      expect(TITLE_HUE[m.id]).toBeDefined();
      expect(sectionCode).toContain(`text-${TITLE_HUE[m.id]}-300`);
    }
  });

  it('uses the -300 step the package names, and a hue Tailwind actually defines', () => {
    for (const [id, hue] of Object.entries(TITLE_HUE)) {
      const shade = (colors as unknown as Record<string, Record<string, string>>)[hue]?.['300'];
      expect(`${id}:${typeof shade}`).toBe(`${id}:string`);
      expect(shade).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  /*
    The whole-tree prohibition, asserted locally so a future edit that inlines
    a value is caught here rather than in a distant foundation spec.
  */
  it('introduces no raw hex literal at all, satisfying GN-CD-300 §W.4', () => {
    expect(sectionCode).not.toMatch(/#[0-9a-f]{6}\b/i);
  });

  it('applies the colour to the TITLE only, via the module id', () => {
    expect(sectionCode).toMatch(/CATEGORY_TITLE_CLASS\.get\(module\.id\)/);
    /* Exactly one consumer: the title span. */
    expect((sectionCode.match(/CATEGORY_TITLE_CLASS\.get\(/g) ?? []).length).toBe(1);
  });

  it('does NOT ship a science colour, which the package maps to no module', () => {
    expect(sectionCode).not.toContain('--c-science');
    expect(sectionCode).not.toContain('text-lime-300');
  });

  /*
    C-3: "Do not infer or expand the palette to icons, borders, badges, other
    pages or other OPEN proposals." The status ladder must keep its own
    colours, which CATEGORY_COLOUR_TOKENS.md's Rule also requires.
  */
  it('leaves icons, borders and badges on their STATUS colours', () => {
    expect(sectionCode).toMatch(/STATE_STYLE/);
    const stateBlock = sectionCode.slice(
      sectionCode.indexOf('const STATE_STYLE'),
      sectionCode.indexOf('const CATEGORY_TITLE_TOKEN'),
    );
    expect(stateBlock).not.toMatch(/--c-/);
    expect(stateBlock).toMatch(/icon:/);
    expect(stateBlock).toMatch(/border:/);
    expect(stateBlock).toMatch(/badge:/);
    /* STATE_STYLE no longer carries a title colour at all. */
    expect(stateBlock).not.toMatch(/\btitle:/);
  });

  it('does not colour any other surface — the tokens are used here only', () => {
    expect(sectionCode).not.toMatch(/MODULE_ACCENT_CLASSES|MODULE_ACCENT_HEX/);
  });
});

describe('R5.1 approved card rules that are NOT proposed', () => {
  it('dashes the border for comingSoon only, and keeps Active and Preview solid', () => {
    const dashed = sectionCode.match(/border-dashed/g) ?? [];
    expect(dashed).toHaveLength(1);
    const comingSoonBlock = sectionCode.slice(
      sectionCode.indexOf('comingSoon: {'),
      sectionCode.indexOf('};', sectionCode.indexOf('comingSoon: {')),
    );
    expect(comingSoonBlock).toMatch(/border-dashed/);
  });

  it('gives every card a route line, with an explicit "No route" where there is none', () => {
    expect(sectionSource).toMatch(/t\.routeNone/);
    expect(dictionaries.en.intelligenceModules.routeNone).toBe('No route');
    expect(dictionaries.pl.intelligenceModules.routeNone).toBe('Brak trasy');
  });

  it('notes "Opens preview" only on a preview module that really has a surface', () => {
    expect(sectionSource).toMatch(/module\.state === 'preview' && module\.destination/);
  });

  it('never ships the review-package note, which describes the ZIP and not the product', () => {
    expect(sectionCode).not.toMatch(/not in this review package|poza tym pakietem/);
  });
});

describe('the four approved navigation destinations are untouched', () => {
  const bottomNav = readFileSync(
    join(__dirname, '..', 'navigation', 'MobileBottomNav.tsx'),
    'utf-8',
  );

  it('still ships exactly Home, World Map, Ask AI and Intelligence', () => {
    for (const href of ["'/'", "'/map'", "'/ask'", "'#intelligence-modules'"]) {
      expect(bottomNav).toContain(href);
    }
  });

  it('carries the #intelligence-modules anchor on the live section', () => {
    expect(sectionSource).toMatch(/id="intelligence-modules"/);
  });

  it('keeps /ask and /search distinct — this section links to neither', () => {
    expect(sectionCode).not.toMatch(/'\/search'|"\/search"|\/search\?q=/);
    expect(sectionCode).not.toMatch(/'\/ask'|"\/ask"/);
  });

  /* N1 is OPEN: the desktop header must not gain destinations here. */
  it('adds no navigation destination of its own', () => {
    expect(sectionCode).not.toMatch(/primaryNavLinks|NAV_MODEL/);
  });
});

describe('data honesty — nothing illustrative reaches Home', () => {
  it('renders only registry config and dictionary strings', () => {
    expect(sectionSource).toMatch(/INTELLIGENCE_MODULES/);
    expect(sectionSource).toMatch(/getDictionary/);
  });

  it('imports no fixture, sample or prototype module', () => {
    expect(sectionCode).not.toMatch(/fixtures?|Fixture|SAMPLE_|DEMO_|mockData/);
  });

  it('starts no request and spends no AI — it is static config', () => {
    expect(sectionCode).not.toMatch(/\bfetch\(/);
    expect(sectionCode).not.toMatch(/analyzeNews|useEffect|'use client'/);
  });

  it('leaves the single homepage feed request untouched', () => {
    /* Comments name the call too; the CODE must hold exactly one, as
       claudeDesignFoundation.spec.ts asserts for the same reason. */
    expect((stripComments(pageSource).match(/getHomeFeed\(/g) ?? []).length).toBe(1);
  });
});

describe('EN and PL both carry every string this section renders', () => {
  const KEYS = [
    'sectionTitle',
    'modulesSummary',
    'modulesSubtitle',
    'routeNone',
    'opensPreview',
  ] as const;

  it.each(['en', 'pl'] as const)('%s defines all Gate A keys, non-empty', (locale) => {
    const t = dictionaries[locale].intelligenceModules as Record<string, unknown>;
    for (const key of KEYS) {
      expect(typeof t[key]).toBe('string');
      expect((t[key] as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('gives every module a title and description in both locales', () => {
    for (const locale of ['en', 'pl'] as const) {
      const modules = dictionaries[locale].intelligenceModules.modules as Record<
        string,
        { title: string; description: string }
      >;
      for (const m of INTELLIGENCE_MODULES) {
        const entry = modules[m.dictionaryKey];
        expect(entry?.title?.trim().length ?? 0).toBeGreaterThan(0);
        expect(entry?.description?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  /*
    C-3 evidence-strengthening: the browser probe previously checked four of
    the nine modules. It now checks all nine, and so does this gate — for
    ALL NINE ids, in BOTH locales, title and description, with no EN text
    leaking into PL. Five cards were previously covered by manual inspection
    only.
  */
  it.each(MATRIX_ORDER)('%s has distinct EN and PL title and description', (id) => {
    /* Not named `module`: @next/next/no-assign-module-variable rejects that
       identifier, and the production build runs ESLint over spec files too. */
    const registryEntry = INTELLIGENCE_MODULES.find((m) => m.id === id);
    expect(registryEntry).toBeDefined();
    const key = registryEntry!.dictionaryKey;
    const en = (dictionaries.en.intelligenceModules.modules as Record<string, { title: string; description: string }>)[key];
    const pl = (dictionaries.pl.intelligenceModules.modules as Record<string, { title: string; description: string }>)[key];

    for (const entry of [en, pl]) {
      expect(entry?.title?.trim().length ?? 0).toBeGreaterThan(0);
      expect(entry?.description?.trim().length ?? 0).toBeGreaterThan(0);
    }
    /* A PL string identical to its EN twin is an untranslated fallback. */
    expect(pl.title).not.toBe(en.title);
    expect(pl.description).not.toBe(en.description);
  });

  it('matches INTELLIGENCE_MODULE_MATRIX.md’s exact display names, all nine, both locales', () => {
    /* The matrix's "Display name EN/PL (exact)" columns, verbatim. */
    const EXACT: Record<string, { en: string; pl: string }> = {
      security: { en: 'Security Intelligence', pl: 'Analiza bezpieczeństwa' },
      'world-intelligence': { en: 'World Intelligence', pl: 'Analiza świata' },
      'country-intelligence': { en: 'Country Intelligence', pl: 'Analiza krajów' },
      politics: { en: 'Politics Intelligence', pl: 'Analiza polityczna' },
      economy: { en: 'Economy Intelligence', pl: 'Analiza gospodarcza' },
      conflict: { en: 'Conflict Intelligence', pl: 'Analiza konfliktów' },
      market: { en: 'Market Intelligence', pl: 'Analiza rynkowa' },
      humanitarian: { en: 'Humanitarian Intelligence', pl: 'Analiza humanitarna' },
      energy: { en: 'Energy Intelligence', pl: 'Analiza energetyczna' },
    };
    for (const m of INTELLIGENCE_MODULES) {
      for (const locale of ['en', 'pl'] as const) {
        const modules = dictionaries[locale].intelligenceModules.modules as Record<string, { title: string }>;
        expect(modules[m.dictionaryKey].title).toBe(EXACT[m.id][locale]);
      }
    }
  });

  it('keeps the PL strings genuinely Polish, not an EN fallback', () => {
    const en = dictionaries.en.intelligenceModules;
    const pl = dictionaries.pl.intelligenceModules;
    for (const key of KEYS) {
      expect(pl[key]).not.toBe(en[key]);
    }
  });
});
