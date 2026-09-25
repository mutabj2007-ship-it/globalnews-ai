import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { getDictionary } from '@/lib/i18n/dictionaries';

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

describe('P2 stays OPEN — no category palette is introduced', () => {
  it('ships none of the nine proposed --c-* category tokens', () => {
    for (const token of [
      '--c-energy',
      '--c-economy',
      '--c-security',
      '--c-humanitarian',
      '--c-politics',
      '--c-science',
      '--c-conflict',
      '--c-market',
      '--c-country',
    ]) {
      expect(sectionCode).not.toContain(token);
    }
  });

  it('colours the card by STATUS, which is the documented P2 fallback', () => {
    /* PROPOSED_DELTAS.md P2 fallback: "module icon/title by status". */
    expect(sectionSource).toMatch(/STATE_STYLE/);
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

  it('keeps the PL strings genuinely Polish, not an EN fallback', () => {
    const en = dictionaries.en.intelligenceModules;
    const pl = dictionaries.pl.intelligenceModules;
    for (const key of KEYS) {
      expect(pl[key]).not.toBe(en[key]);
    }
  });
});
