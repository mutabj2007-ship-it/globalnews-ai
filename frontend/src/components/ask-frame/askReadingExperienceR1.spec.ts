import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ASK_INPUT_MAX_CHARS, DISPLAY_LOCALES, type AnalysisSourceRef } from '@globalnews-ai/shared';
import { AskEmblem } from './AskEmblem';
import { AskWorkingStatus } from './AskWorkingStatus';
import { AskSourcesList } from './AskSourcesPanel';
import { AskAnswerProse } from '@/components/ask/AskAnswerProse';
import { isNumericCell } from '@/components/ask/AskAnswerTable';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { askR2Strings } from '@/lib/ask/askR2Strings';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK READING EXPERIENCE R1 — CONFORMITY TO THE CLAUDE H FREEZE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authorities: H FREEZE b2a0d236…1740 and H CONFORMITY 2be04762…7c04, over Design R1
 * e06a8278…3bf1. "APPLY DELTAS — DO NOT REBUILD ASK": every check here is on the accepted R4
 * components, not on a second surface.
 */
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
/* House rule (R4): strip comments before scanning for a prohibition. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const globals = read('app', 'globals.css');
const emblemCss = globals.slice(globals.indexOf('.gna-ask-emblem {'));
const rule = (selector: string) => {
  /* the motion rule: inside the no-preference block, its first declaration is its animation */
  const i = emblemCss.indexOf(`\n  ${selector} {\n    animation`);
  return i < 0 ? '' : emblemCss.slice(i, emblemCss.indexOf('}', i));
};

describe('E · the emblem (EMBLEM-FREEZE / CONFORMITY 03)', () => {
  const component = read('components', 'ask-frame', 'AskEmblem.tsx');
  const html = renderToStaticMarkup(createElement(AskEmblem, { state: 'ready', placement: 'page' }));

  it('E-1/E-2/E-3 · sweep 32 s, arc 96 s (exactly 3×), core 8 s breath 1 → .85 → 1', () => {
    const sweep = /animation: gnaAskEmblemTurn (\d+)s linear infinite/.exec(rule('.gna-ask-emblem-sweep'));
    const arc = /animation: gnaAskEmblemTurn (\d+)s linear infinite/.exec(rule('.gna-ask-emblem-arc'));
    expect(sweep?.[1]).toBe('32');
    expect(arc?.[1]).toBe('96');
    expect(Number(arc?.[1]) / Number(sweep?.[1])).toBe(3);
    expect(rule('.gna-ask-emblem-core')).toContain('animation: gnaAskEmblemCore 8s cubic-bezier(0.45, 0, 0.55, 1) infinite');
    const core = emblemCss.slice(emblemCss.indexOf('@keyframes gnaAskEmblemCore'));
    expect(core.slice(0, core.indexOf('\n}\n'))).toMatch(/50% \{\s*opacity: 0\.85;/);
    /* clockwise: 0 → 360deg */
    expect(emblemCss).toMatch(/@keyframes gnaAskEmblemTurn \{\s*from \{\s*transform: rotate\(0deg\);\s*\}\s*to \{\s*transform: rotate\(360deg\);/);
  });

  it('E-1 · the pivot is the EMBLEM centre, never the line’s own box (fill-box)', () => {
    expect(emblemCss).toMatch(/\.gna-ask-emblem-sweep,\s*\.gna-ask-emblem-arc \{\s*transform-box: view-box;\s*transform-origin: 20px 20px;/);
    expect(emblemCss).not.toMatch(/fill-box/);
  });

  it('E-4 · no ping: the r7 ring is static at .55 and nothing animates r or scale', () => {
    expect(component).toContain('<circle cx="20" cy="20" r="7" fill="none" stroke="#67e8f9" strokeWidth="1" opacity=".55" />');
    expect(emblemCss).not.toMatch(/gnEmbRing|scale\(|\br:\s/);
  });

  it('E-5 · reduced motion: no animation and no transition at all — the static sweep-000 pose', () => {
    /* motion and transitions exist ONLY inside the no-preference block */
    const motionStart = emblemCss.indexOf('@media (prefers-reduced-motion: no-preference) {');
    expect(motionStart).toBeGreaterThan(-1);
    const base = emblemCss.slice(0, motionStart);
    expect(base).not.toMatch(/animation:|transition:/);
    const motion = emblemCss.slice(motionStart, emblemCss.indexOf('@keyframes'));
    for (const cls of ['gna-ask-emblem-sweep', 'gna-ask-emblem-arc', 'gna-ask-emblem-core'])
      expect(motion).toMatch(new RegExp(`\\.${cls} \\{\\s*animation: gnaAskEmblem`));
    /* the base pose is the canonical one: nothing rotated, the core fully opaque */
    expect(base).not.toMatch(/rotate\(|opacity: 0\.85/);
  });

  it('E-6 · leaving stops motion and unmounts; it is shown only in ready / typing', () => {
    expect(emblemCss).toMatch(/\[data-ask-emblem-state='leaving'\] \.gna-ask-emblem-sweep,[\s\S]*?animation: none;/);
    expect(component).toMatch(/if \(gone\) return null;/);
    expect(component).toMatch(/const LEAVE_MS = 200;/);
    /* never in the reading content: the turn view and the answer renderer do not use it */
    expect(read('components', 'ask-frame', 'AskR2TurnView.tsx')).not.toMatch(/AskEmblem/);
    expect(read('components', 'ask', 'AskAnswerProse.tsx')).not.toMatch(/AskEmblem/);
    const frame = code(read('components', 'ask-frame', 'AskFrameScreen.tsx'));
    expect(frame).toMatch(/const emblemState = isPending\s*\?\s*'leaving'/);
    expect(frame).toMatch(/entryState \|\|\s*\(isPending && r2\.turns\.length === 0 && opened === null && r2\.signInRequired === null\)/);
  });

  it('E-7 · source geometry, navy values, provenance recorded, Logo.tsx not used', () => {
    for (const fragment of [
      'viewBox="0 0 40 40"',
      'r="19"',
      'strokeDasharray="15 98"',
      'r="13.5"',
      'strokeDasharray="3 5"',
      'd="M20 20 L20 4.5"',
      'r="4.6"',
      'stroke="rgba(103,232,249,.95)"',
      'stroke="rgba(103,232,249,.55)"',
    ])
      expect(component).toContain(fragment);
    expect(component).toContain('c1c6573ba67ec9bad519ad0dbc59e54a434176e68c454d6fdc3ad73b7542c33a');
    expect(component).toContain('81e8be90eed8bae3275bf651002b8c51922fa9e90270c98ba4be38736d7d5601');
    for (const dir of ['ask', 'ask-frame', 'ask-nav'])
      for (const f of readdirSync(join(SRC, 'components', dir)).filter((n) => n.endsWith('.tsx')))
        expect(read('components', dir, f)).not.toMatch(/ui\/Logo/);
  });

  it('E-7 · the light adaptation is exactly the three colour deltas (plus its opacities)', () => {
    expect(globals).toMatch(/--ask-read-emblem-glow-edge: #22d3ee;/);
    expect(globals).toMatch(/--ask-read-emblem-sweep: #0e7490;/);
    expect(globals).toMatch(/--ask-read-emblem-sweep-opacity: 0\.85;/);
    expect(globals).toMatch(/--ask-read-emblem-arc: #0e9fb5;/);
    /* dark scopes reset to the navy source (the var() fallbacks) */
    expect(globals.match(/--ask-read-emblem-arc: initial;/g)).toHaveLength(2);
  });

  it('E-8 · inline SVG, decorative, no C2PA payload, composited properties only', () => {
    expect(html).toMatch(/^<div aria-hidden="true" data-ask="emblem"/);
    expect(html).toContain('<svg viewBox="0 0 40 40"');
    expect(html).not.toMatch(/<img|<metadata|c2pa|<title/i);
    const animated = emblemCss.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    for (const block of animated) expect(block).not.toMatch(/filter|box-shadow|width|height/);
    expect(component).toMatch(/animation-play-state|data-ask-emblem-paused/);
    expect(emblemCss).toMatch(/\[data-ask-emblem-paused='true'\][\s\S]*?animation-play-state: paused;/);
  });

  it('sizes come from the Ask root CONTAINER (page) or the dock, never the viewport', () => {
    expect(emblemCss).toMatch(/@container ask-root \(min-width: 700px\)/);
    expect(emblemCss).toMatch(/@container ask-root \(min-width: 1024px\)/);
    expect(read('components', 'ask-frame', 'askDashboard.module.css')).toMatch(/container: ask-root \/ inline-size;/);
    for (const px of ['136px', '144px', '160px', '64px', '72px', '96px', '48px']) expect(emblemCss).toContain(px);
  });
});

describe('Research state — truthful, never a timer (H-FREEZE §5)', () => {
  it('no Ask surface mounts the simulated LoadingStages timer', () => {
    for (const file of [
      ['components', 'ask-frame', 'AskFrameScreen.tsx'],
      ['components', 'ask', 'AskAiDock.tsx'],
    ]) {
      const source = code(read(...file));
      expect(source).not.toMatch(/LoadingStages|setInterval/);
      expect(source).toMatch(/<AskWorkingStatus label=\{r2s\.working\} \/>/);
    }
  });

  it('the working line is a polite status with no stage, percentage or motion', () => {
    const html = renderToStaticMarkup(createElement(AskWorkingStatus, { label: 'Working on your answer…' }));
    expect(html).toMatch(/role="status" aria-live="polite"/);
    expect(html).not.toMatch(/animate-|%/);
    const source = code(read('components', 'ask-frame', 'AskWorkingStatus.tsx'));
    expect(source).not.toMatch(/setInterval|setTimeout|useEffect/);
  });

  it('the copy is neutral in all seven languages and never the overridden universal research line', () => {
    expect(askR2Strings('en').working).toBe('Working on your answer…');
    for (const locale of DISPLAY_LOCALES) {
      const text = askShellStrings(locale).askR2Strings.working;
      expect(text.length).toBeGreaterThan(5);
      expect(text).not.toMatch(/Searching news coverage|search|news/i);
      if (locale !== 'en') expect(text).not.toBe('Working on your answer…');
    }
  });

  it('dict.loadingStages is retired from the Ask shell (L2) and kept for /search only', () => {
    const shell = askShellStrings('fr').dict as unknown as Record<string, unknown>;
    expect(shell.loadingStages).toBeUndefined();
    expect(read('app', 'search', 'page.tsx')).toMatch(/LoadingStages/);
  });
});

describe('Answer hierarchy — answer first (H-FREEZE §4)', () => {
  const turn = code(read('components', 'ask-frame', 'AskR2TurnView.tsx'));

  it('question → answer → status footer → basis → actions → hand-offs, in DOM order', () => {
    const at = (needle: string) => turn.indexOf(needle);
    const question = at('<AskSubmittedQuestion');
    const answer = at('data-ask="answer"');
    const meta = at('data-ask="answer-meta"');
    const basis = at('<AskIntelligenceBasis');
    /* ASK DESIGN COMPLETENESS R1 — the actions are the Design toolbar component. */
    const actions = at('<AskAnswerToolbar');
    const handoffs = at('data-ask="handoffs"');
    for (const i of [question, answer, meta, basis, actions, handoffs]) expect(i).toBeGreaterThan(-1);
    expect(question).toBeLessThan(answer);
    expect(answer).toBeLessThan(meta);
    expect(meta).toBeLessThan(basis);
    expect(basis).toBeLessThan(actions);
    expect(actions).toBeLessThan(handoffs);
    /* scope chips and the engine-state line live in the footer, not above the answer */
    expect(at('data-ask="scope"')).toBeGreaterThan(meta);
    expect(at('data-ask="engine-state"')).toBeGreaterThan(meta);
  });

  it('the question is a compact 17px bubble (≤85%), still the <h2> AskSubmittedQuestion renders', () => {
    expect(turn).toMatch(/const QUESTION =\s*'[^']*max-w-\[85%\][^']*text-\[1\.0625rem\][^']*'/);
    expect(turn).not.toMatch(/text-\[26px\]|text-\[30px\]|min-\[1900px\]:text-\[30px\]/);
    const css = read('components', 'ask-frame', 'askDashboard.module.css');
    const q = css.slice(css.indexOf('.question {'));
    expect(q.slice(0, q.indexOf('}'))).toMatch(/max-width: 85%;[\s\S]*font-size: 1\.0625rem;/);
    expect(read('components', 'ask-frame', 'AskSubmittedQuestion.tsx')).toMatch(/<h2 className=\{headingClassName\}>/);
  });

  it('no mono prose and no dark-only literal on the reading components', () => {
    for (const file of [
      'AskR2TurnView.tsx',
      'AskIntelligenceBasis.tsx',
      'AskSubmittedQuestion.tsx',
      'AskRecentReporting.tsx',
      'AskSourcesColumn.tsx',
      'AskSourcesPanel.tsx',
      'AskWorkingStatus.tsx',
    ]) {
      const source = code(read('components', 'ask-frame', file));
      expect(source).not.toMatch(/font-mono/);
      /* every hex is a var() fallback of a reading token, never a bare dark literal */
      const bare = source.replace(/var\(--[a-z0-9-]+,\s*(?:var\(--[a-z0-9-]+,\s*)?#[0-9a-fA-F]{3,8}\)?\)/g, '');
      expect(bare).not.toMatch(/(?:text|bg|border|decoration|outline)-\[#[0-9a-fA-F]{6}\]|text-white/);
    }
  });

  it('no full-paragraph italics: the inference run keeps <em> but not its slant', () => {
    const prose = code(read('components', 'ask', 'AskAnswerProse.tsx'));
    /* R3 (CTO design-authority reset): the inference run reads in the body ink like the Design's
       prose — no dimmed run and no "Analytical inference:" label; the kind stays on the span. */
    expect(prose).toMatch(/className="\[&_em\]:not-italic"/);
    expect(prose).not.toMatch(/statement-qualifier/);
    expect(prose).not.toMatch(/font-mono text-\[10px\] uppercase/);
  });
});

describe('Sources — one list, panel or sheet, backend identity (H-FREEZE §7, §12)', () => {
  const sources = [
    { articleId: 'a1', title: 'One', publisher: 'P1', url: 'https://one.example/a', publishedAt: '2026-10-05T10:00:00.000Z' },
    { articleId: 'a2', title: 'Two', publisher: 'P2', url: 'https://two.example/b', publishedAt: null },
  ] as unknown as AnalysisSourceRef[];

  it('the list numbers in payload order and highlights only the cited item', () => {
    const html = renderToStaticMarkup(createElement(AskSourcesList, { sources, locale: 'en', highlight: 2 }));
    expect([...html.matchAll(/data-source-number="(\d)"/g)].map((m) => m[1])).toEqual(['1', '2']);
    expect(html.match(/data-ask-source-highlight="true"/g)).toHaveLength(1);
    expect(html).toMatch(/data-source-number="2" data-ask-source-highlight="true"/);
    expect(html).toContain('href="https://one.example/a"');
  });

  it('EAST AFRICA E7 — each source date is labelled by its own publishedAtBasis through sourceDateLabel', () => {
    const dated = [
      { articleId: 'p', title: 'Pub', publisher: 'P1', url: 'https://p.example/a', publishedAt: '2026-10-05T10:00:00.000Z', publishedAtBasis: 'publisher' },
      { articleId: 'o', title: 'Obs', publisher: 'P2', url: 'https://o.example/b', publishedAt: '2026-10-05T10:00:00.000Z', publishedAtBasis: 'observed' },
      { articleId: 'u', title: 'Unk', publisher: 'P3', url: 'https://u.example/c', publishedAt: '2026-10-05T10:00:00.000Z' },
      { articleId: 'n', title: 'None', publisher: 'P4', url: 'https://n.example/d', publishedAt: null, publishedAtBasis: 'publisher' },
    ] as unknown as AnalysisSourceRef[];
    const html = renderToStaticMarkup(createElement(AskSourcesList, { sources: dated, locale: 'en' }));
    const items = [...html.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => m[0]);
    expect(items[0]).toMatch(/P1 · Published 5 Oct 2026, 10:00 UTC/);
    expect(items[1]).toMatch(/P2 · First seen by GlobalNewsAI 5 Oct 2026, 10:00 UTC/);
    expect(items[2]).toMatch(/P3 · Report date 5 Oct 2026, 10:00 UTC/);
    /* no date → no label, never an invented one */
    /* ASK DESIGN COMPLETENESS R1 — still no date label and no invented date: the Design's
       explicit "Date not provided" (C1 / C6) */
    expect(items[3]).toMatch(/>P4 · Date not provided<\/span>/);
    expect(items[3]).not.toMatch(/Published|First seen|Report date/);
    /* one contract: the list does not format a bare date of its own */
    const panel = code(read('components', 'ask-frame', 'AskSourcesPanel.tsx'));
    expect(panel).toMatch(/sourceDateLabel\(source\.publishedAt, source\.publishedAtBasis,/);
    expect(panel).not.toMatch(/formatUtc\(/);
  });

  it('the sheet is a modal dialog with Esc, focus containment and focus return; the column is not modal', () => {
    const panel = code(read('components', 'ask-frame', 'AskSourcesPanel.tsx'));
    expect(panel).toMatch(/role="dialog"\s+aria-modal="true"/);
    expect(panel).toMatch(/event\.key === 'Escape'/);
    expect(panel).toMatch(/event\.key !== 'Tab'/);
    expect(panel).toMatch(/opener\.current\?\.focus\(\{ preventScroll: true \}\)/);
    expect(panel).not.toMatch(/overflow\s*=\s*'hidden'|body\.style/);
    const column = code(read('components', 'ask-frame', 'AskSourcesColumn.tsx'));
    expect(column).not.toMatch(/aria-modal|role="dialog"/);
    expect(column).toMatch(/<AskSourcesList sources=\{sources\} locale=\{locale\} \/>/);
  });

  it('a citation outside a panel is still the governed link; inside one it opens Sources at n', () => {
    const html = renderToStaticMarkup(
      createElement(AskAnswerProse, {
        source: 'A fact.',
        statements: [{ text: 'A fact.', kind: 'REPORTED_FACT', sourceArticleIds: ['a2'] }] as never,
        sources,
        language: 'en',
      }),
    );
    expect(html).toMatch(/<a data-ask="citation" data-citation="2" href="https:\/\/two\.example\/b"/);
    const citation = code(read('components', 'ask', 'AskCitation.tsx'));
    expect(citation).toMatch(/openSources\(\{ sources, at: n, opener: event\.currentTarget \}\)/);
    expect(citation).toMatch(/event\.metaKey \|\| event\.ctrlKey/);
  });

  it('the Sources action renders only with a real list; Share only where the platform shares; no Copy link / Download', () => {
    /*
      ASK DESIGN COMPLETENESS R1 — the Design toolbar (RECONCILIATION_GUIDE §8): Share uses
      `navigator.share` "when available, else hide", so it renders only after mount and only where
      the platform offers it. Copy link (no share-link endpoint, D7) and Download (no export
      endpoint, D8) have no backing and are not rendered at all.
    */
    const turn = code(read('components', 'ask-frame', 'AskR2TurnView.tsx'));
    expect(turn).toMatch(/const answerSources = payload\.analysis\?\.analysis\?\.sources \?\? \[\];/);
    expect(turn).toMatch(/sources=\{answerSources\}/);
    const toolbar = code(read('components', 'ask-frame', 'AskAnswerToolbar.tsx'));
    expect(toolbar).toMatch(/openSources !== null && sources\.length > 0/);
    expect(toolbar).toMatch(/typeof navigator\.share === 'function'/);
    expect(toolbar).toMatch(/\{canShare && \(/);
    expect(toolbar).not.toMatch(/data-ask="(?:copy-link|download)"/);
    expect(turn).not.toMatch(/data-ask="(?:share|copy-link|download)"/);
  });
});

describe('Tables (RESPONSIVE-FREEZE §5)', () => {
  const md = (cols: number) =>
    [
      `| ${Array.from({ length: cols }, (_, i) => `H${i}`).join(' | ')} |`,
      `|${'---|'.repeat(cols)}`,
      `| ${Array.from({ length: cols }, (_, i) => (i === 1 ? '1,250' : `v${i}`)).join(' | ')} |`,
    ].join('\n');
  const render = (cols: number) =>
    renderToStaticMarkup(createElement(AskAnswerProse, { source: md(cols), sources: [], language: 'en' }));

  it('≤3 columns: a natural table, no forced minimum width and no scroll hint', () => {
    const html = render(3);
    expect(html).toContain('data-ask-table-cols-wide="false"');
    expect(html).not.toContain('min-width');
    expect(html).not.toContain('table-scroll-hint');
  });

  it('≥4 columns: a labelled scroller, sticky first column, hint hidden until it overflows', () => {
    const html = render(5);
    expect(html).toContain('data-ask-table-cols-wide="true"');
    expect(html).toMatch(/<div role="region" aria-label="H0 · H1 · H2 · H3 · H4" tabindex="0" data-ask="answer-table"[^>]*overflow-x-auto/);
    expect(html).toContain('min-width:40rem');
    expect(html).toMatch(/<p data-ask="table-scroll-hint" hidden=""/);
    expect(html).toContain('Scroll sideways to see all 5 columns');
    expect(html.match(/gna-ask-table-sticky/g)).toHaveLength(2);
    /* every cell carries its column label for the stacked form; the data exists once */
    expect(html.match(/data-label="H1"/g)).toHaveLength(1);
    expect(html).toMatch(/class="[^"]*text-end[^"]*">1,250</);
  });

  it('the stacked form is a container query in rem (narrow OR enlarged text), never a page scroll', () => {
    const t = globals.slice(globals.indexOf('.gna-ask-table {'));
    expect(t).toMatch(/\.gna-ask-table \{\s*container-type: inline-size;/);
    /* Design B4/B5: a 390 phone keeps the contained scroll; ≤360 (a 312 px column) stacks. */
    expect(t).toMatch(/@container \(max-width: 20rem\)/);
    expect(t).toMatch(/content: attr\(data-label\);/);
  });

  it('numeric cells are recognised conservatively', () => {
    expect(isNumericCell('1,250')).toBe(true);
    expect(isNumericCell('-3.5%')).toBe(true);
    expect(isNumericCell('2026-10-03')).toBe(false);
    expect(isNumericCell('Kenya')).toBe(false);
  });
});

describe('Input limit — the governed shared constant, never a second literal', () => {
  it.each([
    ['components', 'home', 'r1', 'HomeR1Hero.tsx'],
    ['components', 'home', 'HeroAskField.tsx'],
    ['components', 'home', 'reva', 'HomeComposer.tsx'],
    ['components', 'my-intelligence', 'MiSelection.tsx'],
    ['components', 'search', 'SearchPageClient.tsx'],
    ['components', 'visual', 'VisualHero.tsx'],
    ['components', 'visual', 'home', 'HomeAskSection.tsx'],
  ])('%s/%s…', (...path) => {
    const source = read(...path);
    expect(source).toContain('maxLength={ASK_INPUT_MAX_CHARS}');
    expect(source).not.toMatch(/maxLength=\{1000\}|\/1000\b/);
    expect(source).toContain("import { ASK_INPUT_MAX_CHARS } from '@globalnews-ai/shared';");
    expect(ASK_INPUT_MAX_CHARS).toBe(4000);
  });
});
