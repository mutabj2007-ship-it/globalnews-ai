import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseAnswerBlocks } from './askAnswerMarkdown';
import { withoutTerms } from './askR2View';
import { AskAnswerProse } from '@/components/ask/AskAnswerProse';
import { briefExcerpt } from '@/components/visual/VisualBriefPanel';
import { visibleBrief } from '@/components/visual/VisualBriefStateView';

/** ASK RELIABILITY R1 — frontend rows of the A–Q regression matrix (M, A rewrite, §8 hints, §9). */
const SRC = join(__dirname, '..', '..');
const code = (rel: string): string =>
  readFileSync(join(SRC, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('M — requested tables render as tables', () => {
  const md = [
    'Here is the comparison.',
    '',
    '| Country | Petrol (per litre) | Effective date |',
    '|---|---|---|',
    '| Rwanda | not available | not available |',
    '| Tanzania | TZS 3,100 | 2026-10-01 |',
    '',
    'Values marked not available were not reported.',
  ].join('\n');
  it('parses a pipe table into header + rows', () => {
    const blocks = parseAnswerBlocks(md);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'table', 'paragraph']);
    const table = blocks[1];
    if (table.kind !== 'table') throw new Error('not a table');
    expect(table.header).toEqual(['Country', 'Petrol (per litre)', 'Effective date']);
    expect(table.rows[1]).toEqual(['Tanzania', 'TZS 3,100', '2026-10-01']);
  });
  it('renders a real <table> inside its own scroll region (no page overflow)', () => {
    const html = renderToStaticMarkup(h(AskAnswerProse, { source: md, sources: [], language: 'en' }));
    expect(html).toContain('data-ask="answer-table"');
    expect(html).toMatch(/<table[^>]*>/);
    expect(html).toContain('<th scope="col"');
    expect(html).toContain('<th scope="row"');
    expect(html).toMatch(/overflow-x-auto/);
  });
  it('pipe lines without a separator row stay prose', () => {
    expect(parseAnswerBlocks('| not a table |').map((b) => b.kind)).toEqual(['paragraph']);
  });
});

describe('M — numbered lists keep counting', () => {
  it('a loose list ("1." blank "2." blank "3.") is ONE list', () => {
    const blocks = parseAnswerBlocks('1. **Demand-pull**: a.\n\n2. **Cost-push**: b.\n\n3. **Built-in**: c.');
    expect(blocks).toEqual([{ kind: 'ordered', start: 1, items: ['**Demand-pull**: a.', '**Cost-push**: b.', '**Built-in**: c.'] }]);
  });
  it('a list split by prose keeps its authored number, rendered with start=', () => {
    const blocks = parseAnswerBlocks('1. First\n\nSome explanation.\n\n2. Second');
    expect(blocks.map((b) => (b.kind === 'ordered' ? `ol@${b.start}` : b.kind))).toEqual(['ol@1', 'paragraph', 'ol@2']);
    const html = renderToStaticMarkup(
      h(AskAnswerProse, { source: '1. First\n\nSome explanation.\n\n2. Second', sources: [], language: 'en' }),
    );
    expect(html).toContain('<ol data-ask="answer-steps" start="2"');
  });
});

describe('A — a suggested rewrite never leaves a dangling fragment', () => {
  it('"…affects the entire world" minus "world" is not suggested', () => {
    expect(withoutTerms('How this affects the entire world', ['world'])).toBeNull();
    expect(withoutTerms('Comparew how how Russia and Ukraine are currently doing and provide how this affects the entire world', ['world'])).toBeNull();
  });
});

describe('§8 — sample questions are visible guidance only', () => {
  it('the /ask composer example is plain text (no button, no onClick)', () => {
    const parts = code('components/ask-frame/AskParts.tsx');
    expect(parts).not.toMatch(/<button[^>]*data-ask="composer-example"/);
    expect(parts).toMatch(/<span\s+data-ask="composer-example"/);
    expect(parts).not.toMatch(/onClick=\{example\.onUse\}/);
  });
  it('the Home Ask section and the R1 hero show hints, not controls', () => {
    const home = code('components/visual/home/HomeAskSection.tsx');
    expect(home).not.toMatch(/data-visual-example=""[\s\S]{0,80}onClick/);
    expect(home).not.toMatch(/<button[^>]*data-visual-example/);
    const hero = code('components/home/r1/HomeR1Hero.tsx');
    expect(hero).not.toMatch(/<button[^>]*data-home-r1-suggestion/);
    expect(hero).not.toMatch(/stage\(question\)/);
  });
});

describe('§9 — the brief is short; publisher text is an excerpt; Follow is at the top', () => {
  it('publisher text is capped at 45 words', () => {
    const long = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
    expect(briefExcerpt(long).split(' ').length).toBe(45);
    expect(briefExcerpt(long).endsWith('…')).toBe(true);
    expect(briefExcerpt('short text')).toBe('short text');
  });
  it('the visible brief is at most ~100 words; the rest is folded', () => {
    const sentence = 'This is a ten word sentence for the brief test.';
    const long = Array.from({ length: 20 }, () => sentence).join(' ');
    const v = visibleBrief(long);
    expect(v.head.split(' ').length).toBeLessThanOrEqual(100);
    expect(v.rest).not.toBeNull();
    expect(visibleBrief(sentence)).toEqual({ head: sentence, rest: null });
  });
  it('Follow / Discuss / Ask sit in the quick-actions row right under the title', () => {
    const panel = code('components/visual/VisualBriefPanel.tsx');
    const title = panel.indexOf('{story.title}');
    const quick = panel.indexOf('data-visual-brief-quick-actions');
    const reporting = panel.indexOf('<ReportingWeHold');
    expect(quick).toBeGreaterThan(title);
    expect(quick).toBeLessThan(reporting);
    expect(panel.slice(quick, reporting)).toMatch(/data-visual-alert="off"/);
    expect((panel.match(/data-visual-alert="off"/g) ?? []).length).toBe(1);
  });
});
