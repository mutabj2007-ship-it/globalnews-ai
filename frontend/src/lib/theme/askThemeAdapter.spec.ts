import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config';
import {
  ADAPTER_BEGIN,
  ADAPTER_END,
  buildAskThemeAdapterCss,
  extractColourUtilities,
  flattenColours,
  lightTokenFor,
} from './askThemeAdapter';

/**
 * HOME R1 · DUAL THEME — the embedded-Ask adapter is GENERATED from the answer components'
 * own source. This spec regenerates it and fails on drift (UPDATE_ASK_THEME_ADAPTER=1 writes
 * it). Every colour utility the embedded answer tree uses must have a Light rule.
 */
const SRC = join(__dirname, '..', '..');
const GLOBALS = join(SRC, 'app', 'globals.css');
/** The components the embedded panel renders (the Standalone answer tree + the dock shell). */
export const EMBEDDED_ASK_SOURCES = [
  'components/ask/AskAiDock.tsx',
  'components/ask/AskCompactResult.tsx',
  'components/ask-frame/AskR2TurnView.tsx',
  'components/ask-frame/AskIntelligenceBasis.tsx',
  'components/ask-frame/AskTurnSave.tsx',
  'components/ask-frame/AskDeepConfirm.tsx',
  'components/search/AnalysisModeBadge.tsx',
  'components/search/EvidenceFreshnessNotice.tsx',
  'components/search/LoadingStages.tsx',
  'components/my-intelligence/MiPrimitives.tsx',
  'components/bookmark/StoryBookmark.tsx',
  /* TRUST R1 — the Standalone Ask surface, now themed through the same adapter. */
  'components/ask-frame/AskFrameScreen.tsx',
  'components/ask-frame/AskParts.tsx',
  'components/ask-frame/AskSourcesColumn.tsx',
  'components/ask-frame/AskTurnCopy.tsx',
  'components/ask-nav/AskNavShell.tsx',
  'components/ask-nav/AskContinuityHeader.tsx',
  'components/ask-nav/AskClearedBoundary.tsx',
  'components/ui/AdaptiveTextarea.tsx',
  'components/search/LanguageSelector.tsx',
];

const colours = flattenColours(
  (
    resolveConfig(tailwindConfig as never) as unknown as {
      theme: { colors: Record<string, unknown> };
    }
  ).theme.colors,
);
const utilities = EMBEDDED_ASK_SOURCES.flatMap((file) =>
  extractColourUtilities(readFileSync(join(SRC, file), 'utf8'), colours),
);
const unique = [...new Map(utilities.map((u) => [u.cls, u])).values()].sort((a, b) =>
  a.cls.localeCompare(b.cls),
);
const generated = buildAskThemeAdapterCss(unique);

describe('embedded-Ask theme adapter', () => {
  it('is up to date with the answer components (regenerate on drift)', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    const start = css.indexOf(ADAPTER_BEGIN);
    const end = css.indexOf(ADAPTER_END);
    if (process.env.UPDATE_ASK_THEME_ADAPTER === '1') {
      const next =
        start >= 0
          ? css.slice(0, start) + generated + css.slice(end + ADAPTER_END.length)
          : `${css.trimEnd()}\n\n${generated}\n`;
      writeFileSync(GLOBALS, next);
      return;
    }
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, end + ADAPTER_END.length)).toBe(generated);
  });

  it('covers every colour utility of the embedded answer tree with a Light token', () => {
    expect(unique.length).toBeGreaterThan(40);
    const uncovered = unique.filter((u) => lightTokenFor(u) === null).map((u) => u.cls);
    expect(uncovered).toEqual([]);
  });

  /* TRUST R1 — the Standalone Ask is now a themed Ask scope too (data-ask-standalone), and
     Scheduled resolves through the <html data-gna-schedule> attribute. */
  it('applies ONLY inside an Ask theme scope (embedded dock or Standalone) resolving to Light', () => {
    const rules = generated
      .split('\n')
      .filter(
        (line) => line.includes('{') && !line.trim().startsWith('@media') && !line.startsWith('/*'),
      );
    const scope =
      /(?:html(?:\[data-gna-schedule='light'\]|:not\(\[data-gna-schedule\]\)) )?\[data-ask-(?:transport='r2'|standalone)\]\[data-gna-theme='(?:light|system|scheduled)'\]/;
    for (const line of rules) {
      const selectorList = line.trim().replace(/^@media[^{]*\{\s*/, '');
      expect(selectorList.startsWith('[data-ask-') || selectorList.startsWith('html')).toBe(true);
      expect(selectorList).toMatch(scope);
      /* every comma-separated selector in the list starts at an Ask scope */
      for (const part of selectorList.slice(0, selectorList.indexOf(' {')).split(/, (?=\[|html)/))
        expect(part).toMatch(new RegExp(`^${scope.source}`));
    }
    expect(generated).not.toMatch(/data-gna-theme='dark'/);
    expect(generated).not.toMatch(/data-gna-schedule='dark'/);
  });

  it('keeps semantic meaning: green → mint, amber → sand, red → danger, blue action → act', () => {
    const tok = (cls: string, value: string, prop: 'bg' | 'text' | 'border') =>
      lightTokenFor({ cls, variants: [], important: false, prop, value, alpha: null });
    expect(tok('text-[#7eebbe]', '#7eebbe', 'text')).toBe('var(--gt-mintText)');
    expect(tok('text-[#f3d36b]', '#f3d36b', 'text')).toBe('var(--gt-sandInk)');
    expect(tok('text-[#f2a5a5]', '#f2a5a5', 'text')).toBe('var(--gt-danger)');
    expect(tok('bg-[#0a6bd6]', '#0a6bd6', 'bg')).toBe('var(--gt-act)');
    expect(tok('text-white', '#fff', 'text')).toBe('var(--gt-ink)');
  });
});
