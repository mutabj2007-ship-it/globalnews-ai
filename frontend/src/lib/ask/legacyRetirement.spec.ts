import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * UNIFIED INTELLIGENCE BINDING R2G — LEGACY RETIREMENT GUARD.
 *
 * One Ask engine. No first-party reader surface reaches the legacy news-analysis transport
 * (`analyzeNews` → POST /analysis/news). The route itself stays on the server (real Production
 * callers may still depend on it; it is NOT deleted or 410'd here), and the server-side Support
 * AI exception is outside this frontend.
 *
 * The two modules that still import `analyzeNews` are UNMOUNTED (nothing imports them). They are
 * retirement-ready and listed in RETIREMENT-READY.md; this guard fails the moment anything mounts
 * them again or any other module starts calling the legacy transport.
 */

const SRC = join(__dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next') return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const production = walk(SRC)
  .filter(
    (p) =>
      /\.(ts|tsx)$/.test(p) && !/\.spec\.tsx?$/.test(p) && !p.includes(`${sep}qualification${sep}`),
  )
  .map((p) => ({ rel: relative(SRC, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));
/** Code only: block and line comments removed (the legacy name appears in many comments). */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const DEAD_LEGACY_CALLERS = [
  'components/analysis-frame/AnalysisFrameClient.tsx',
  'lib/ask/useAskConversation.ts',
];

describe('R2G — no mounted surface reaches the legacy analysis transport', () => {
  it('only the two unmounted modules import analyzeNews', () => {
    const importers = production
      .filter((f) =>
        /import\s*\{[^}]*\banalyzeNews\b[^}]*\}\s*from\s*'@\/lib\/api\/analysisApi'/.test(
          code(f.text),
        ),
      )
      .map((f) => f.rel)
      .sort();
    expect(importers).toEqual([...DEAD_LEGACY_CALLERS].sort());
  });

  it.each(DEAD_LEGACY_CALLERS)('%s is not imported by any production module', (dead) => {
    const stem = dead.replace(/\.tsx?$/, '');
    const name = stem.split('/').pop()!;
    const importers = production.filter(
      (f) => f.rel !== dead && new RegExp(`from\\s*'[^']*/${name}'`).test(code(f.text)),
    );
    expect(importers.map((f) => f.rel)).toEqual([]);
  });

  it('the only POST /analysis/news fetch is inside lib/api/analysisApi.ts', () => {
    const fetchers = production
      .filter((f) => /\/analysis\/news`/.test(code(f.text)) && /fetch\(/.test(code(f.text)))
      .map((f) => f.rel);
    expect(fetchers).toEqual(['lib/api/analysisApi.ts']);
  });

  it('every reader Ask surface submits through the canonical Ask V2 conversation', () => {
    for (const rel of [
      'components/ask-frame/AskFrameScreen.tsx',
      'components/ask/AskAiDock.tsx',
      'components/search/SearchPageClient.tsx',
      'components/my-intelligence/MyIntelligenceClient.tsx',
    ]) {
      const text = code(readFileSync(join(SRC, rel), 'utf8'));
      expect(text).toMatch(/useAskR2Conversation/);
      expect(text).not.toMatch(/\banalyzeNews\s*\(/);
    }
  });
});
