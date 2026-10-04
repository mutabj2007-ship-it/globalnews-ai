import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  answerHasStructure,
  answerPlainText,
  parseAnswerBlocks,
  parseInline,
} from './askAnswerMarkdown';
import { AskAnswerProse } from '@/components/ask/AskAnswerProse';

/**
 * R4 ANSWER READING EXPERIENCE R1 · PHASE A — MARKDOWN CORRECTNESS.
 *
 * A-1  raw syntax never reaches the reader
 * A-2  the structure rendered is the structure the ANSWER authored — nothing invented
 * A-3  citations are placed exactly as before
 * A-4  no arbitrary HTML, ever
 * A-5  the Paris Agreement acceptance fixture
 */

const PARIS = `The Paris Agreement requires every party to set and pursue its own climate target, but it does not dictate what that target must be.

## What every party must do

- Prepare, communicate and maintain successive **Nationally Determined Contributions** (NDCs), updated every five years.
- Report emissions and progress through the enhanced transparency framework.
- Take part in the global stocktake, which assesses collective progress every five years.

### What it does not do

1. It sets no binding emissions figure for any individual country.
2. It imposes no penalty for missing a national target.

The agreement's long-term goal is to hold warming *well below* 2 °C, and to pursue efforts to limit it to 1.5 °C.

**Bottom line**
Paris binds countries to a process — target, report, review — rather than to a number.`;

const render = (source: string, statements?: unknown, sources: unknown[] = []) =>
  renderToStaticMarkup(
    createElement(
      AskAnswerProse as never,
      { source, statements, sources, language: 'en' } as never,
    ),
  );

describe('A-1 · raw markdown syntax never reaches the reader', () => {
  it('renders bold as emphasis, not as asterisks — the reported defect', () => {
    const html = render('Prepare **Nationally Determined Contributions** every five years.');
    expect(html).toContain('<strong');
    expect(html).toContain('Nationally Determined Contributions');
    expect(html).not.toContain('**');
  });

  it('leaves no heading hashes, list markers or emphasis marks anywhere in the output', () => {
    const html = render(PARIS);
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).not.toMatch(/\*\*/);
    expect(text).not.toMatch(/^#{1,6}\s/m);
    expect(text).not.toMatch(/^\s*[-•]\s/m);
    expect(text).not.toMatch(/^\s*\d+[.)]\s/m);
    expect(text).not.toMatch(/__|`/);
  });

  it('every character the reader sees is a character the answer wrote', () => {
    const plain = answerPlainText(parseAnswerBlocks(PARIS));
    for (const phrase of [
      'Nationally Determined Contributions',
      'enhanced transparency framework',
      'global stocktake',
      'well below',
      'Paris binds countries to a process',
    ]) {
      expect(plain).toContain(phrase);
    }
    expect(plain).not.toContain('*');
    expect(plain).not.toContain('#');
  });
});

describe('A-2 · the structure is the ANSWER’s, and nothing is invented', () => {
  it('reads headings, bullets and numbered steps the answer authored', () => {
    const blocks = parseAnswerBlocks(PARIS);
    const kinds = blocks.map((b) => b.kind);
    expect(kinds).toContain('heading');
    expect(kinds).toContain('bullets');
    expect(kinds).toContain('ordered');
    expect(kinds).toContain('paragraph');
    const headings = blocks
      .filter((b) => b.kind === 'heading')
      .map((b) => (b as { text: string }).text);
    expect(headings).toEqual(['What every party must do', 'What it does not do', 'Bottom line']);
  });

  it('invents NO heading for an answer that authored none', () => {
    const flat = 'One paragraph.\n\nA second paragraph.\n\nA third paragraph.';
    const blocks = parseAnswerBlocks(flat);
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true);
    expect(answerHasStructure(blocks)).toBe(false);
    expect(render(flat)).not.toContain('answer-heading');
  });

  it('a bold line on its own becomes the section title the answer meant — a bold SENTENCE does not', () => {
    expect(parseAnswerBlocks('**Bottom line**')[0]).toEqual({
      kind: 'heading',
      level: 3,
      text: 'Bottom line',
    });
    const sentence = parseAnswerBlocks(
      '**This is an emphasised full sentence that ends properly.**',
    );
    expect(sentence[0].kind).toBe('paragraph');
  });

  it('numbered steps stay ordered and bullets stay unordered', () => {
    const html = render(PARIS);
    expect(html).toContain('data-ask="answer-steps"');
    expect(html).toContain('data-ask="answer-bullets"');
    expect(html.indexOf('<ol')).toBeGreaterThan(0);
    expect(html.indexOf('<ul')).toBeGreaterThan(0);
  });

  it('keeps a list item together when the answer wrapped it over two lines', () => {
    const blocks = parseAnswerBlocks('- first item\n  continued here\n- second item');
    expect(blocks[0]).toEqual({
      kind: 'bullets',
      items: ['first item continued here', 'second item'],
    });
  });

  it('drops a horizontal rule rather than printing it', () => {
    expect(render('Before.\n\n---\n\nAfter.').replace(/<[^>]*>/g, '')).not.toContain('---');
  });
});

describe('A-3 · citations are placed exactly as before', () => {
  const sources = [
    {
      articleId: 'a1',
      title: 'T1',
      publisher: 'P1',
      url: 'https://example.invalid/1',
      publishedAt: '2026-10-03T00:00:00.000Z',
    },
    {
      articleId: 'a2',
      title: 'T2',
      publisher: 'P2',
      url: 'https://example.invalid/2',
      publishedAt: '2026-10-03T00:00:00.000Z',
    },
  ];

  it('attaches a source number to the sentence the backend attached it to', () => {
    const html = render(
      'Poland postponed the plant until 2036. A second sentence follows.',
      [
        {
          text: 'Poland postponed the plant until 2036.',
          kind: 'REPORTED_FACT',
          sourceArticleIds: ['a1'],
        },
      ],
      sources,
    );
    expect(html).toContain('data-citation="1"');
    expect(html.indexOf('data-citation="1"')).toBeLessThan(html.indexOf('A second sentence'));
  });

  it('places a citation on a bullet the answer authored, not only on a paragraph', () => {
    const html = render(
      '- Poland postponed the plant until 2036.',
      [
        {
          text: 'Poland postponed the plant until 2036.',
          kind: 'REPORTED_FACT',
          sourceArticleIds: ['a2'],
        },
      ],
      sources,
    );
    expect(html).toContain('data-ask="answer-bullet"');
    expect(html).toContain('data-citation="2"');
  });

  it('labels analytical inference and never cites it', () => {
    const html = render(
      'This may affect future costs.',
      [
        {
          text: 'This may affect future costs.',
          kind: 'ANALYTICAL_INFERENCE',
          sourceArticleIds: [],
        },
      ],
      sources,
    );
    expect(html).toContain('data-statement-kind="ANALYTICAL_INFERENCE"');
    expect(html).not.toContain('data-citation');
  });

  it('a statement is consumed once, so a repeated sentence is not double-cited', () => {
    const html = render(
      'Same sentence here. Same sentence here.',
      [{ text: 'Same sentence here.', kind: 'REPORTED_FACT', sourceArticleIds: ['a1'] }],
      sources,
    );
    expect(html.match(/data-citation="1"/g)).toHaveLength(1);
  });
});

describe('A-4 · no arbitrary HTML', () => {
  /* Comment-stripped: both files NAME the prohibition in their docblocks, and a prohibition
     that fails on the sentence stating it is not a prohibition. */
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const source = strip(
    readFileSync(join(__dirname, '..', '..', 'components', 'ask', 'AskAnswerProse.tsx'), 'utf8'),
  );
  const parser = strip(readFileSync(join(__dirname, 'askAnswerMarkdown.ts'), 'utf8'));

  it('neither the parser nor the renderer can inject HTML', () => {
    for (const body of [source, parser]) {
      expect(body).not.toContain('dangerouslySetInnerHTML');
      expect(body).not.toContain('innerHTML');
    }
  });

  it('HTML in the answer text is rendered as text, not executed', () => {
    const html = render('A sentence with <script>alert(1)</script> inside it.');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('a markdown link in the prose yields its label and NO destination', () => {
    const html = render('See [the registry](https://evil.invalid/x) for details.');
    expect(html).toContain('the registry');
    expect(html).not.toContain('evil.invalid');
    expect(html).not.toMatch(/<a [^>]*href="https:\/\/evil/);
  });

  it('the only href the renderer can emit is a governed citation', () => {
    const hrefs = [...source.matchAll(/href=\{([^}]*)\}/g)].map((m) => m[1].trim());
    expect(hrefs).toEqual(['safeExternalHref(cited.url)']);
  });
});

describe('A-5 · the Paris Agreement acceptance fixture', () => {
  it('reads as direct answer → sections → bullets → explanation → bottom line', () => {
    const blocks = parseAnswerBlocks(PARIS);
    const shape = blocks.map((b) => b.kind);
    expect(shape[0]).toBe('paragraph');
    expect(shape).toEqual([
      'paragraph',
      'heading',
      'bullets',
      'heading',
      'ordered',
      'paragraph',
      'heading',
      'paragraph',
    ]);
    const html = render(PARIS);
    expect(html.indexOf('What every party must do')).toBeLessThan(
      html.indexOf('What it does not do'),
    );
    expect(html.indexOf('What it does not do')).toBeLessThan(html.indexOf('Bottom line'));
  });

  it('renders inline emphasis inside a bullet and inside a paragraph', () => {
    const html = render(PARIS);
    expect(html).toMatch(/<li[^>]*data-ask="answer-bullet"[^>]*>.*<strong/);
    expect(html).toContain('<em>well below</em>');
  });
});

describe('A-7 · the reconciliation onto the 5699eb7 semantic baseline', () => {
  const turnView = readFileSync(
    join(__dirname, '..', '..', 'components', 'ask-frame', 'AskR2TurnView.tsx'),
    'utf8',
  );
  const code = turnView.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('NO answer text is rendered raw any more — including the mixed path the baseline added', () => {
    /*
      The semantic baseline introduced a SECOND `<p className="whitespace-pre-wrap">` for a
      MIXED_REFERENCE_CURRENT answer. It survives a clean cherry-pick, because the two edits sit
      in different regions and git raises no conflict. This assertion is what makes that
      impossible to miss again.
    */
    expect(code).not.toContain('whitespace-pre-wrap');
    /* The answer text may appear ONLY as the renderer's `source` prop — never as an element's
       own child, which is what rendering it raw looks like. */
    const all = code.match(/\{payload\.background\.text\}/g) ?? [];
    const asSource = code.match(/source=\{payload\.background\.text\}/g) ?? [];
    expect(all).toHaveLength(asSource.length);
    expect(asSource.length).toBeGreaterThan(0);
  });

  it('both background paths go through the one renderer', () => {
    expect(code.match(/<AskAnswerProse/g)).toHaveLength(2);
    expect(code).toMatch(/source=\{payload\.background\.text\}/);
  });

  it('the baseline’s SEMANTIC conditions are kept exactly — rendering changed, meaning did not', () => {
    expect(code).toMatch(/payload\.guidance\?\.kind === 'MIXED_REFERENCE_CURRENT'/);
    expect(code).toMatch(/payload\.guidance\?\.currentPart === 'SOURCED'/);
    expect(code).toMatch(/payload\.guidance\.stablePart === 'UNAVAILABLE'/);
    expect(code).toMatch(/payload\.guidance\.currentPart !== 'SOURCED'/);
    expect(code).toContain('data-ask="mixed-stable"');
    expect(code).toContain('data-ask="mixed-stable-unavailable"');
    expect(code).toContain('data-ask="guidance-current-gap"');
  });
});

describe('A-6 · inline parsing', () => {
  it('reads code before emphasis, so markup inside code is literal', () => {
    expect(parseInline('a `**x**` b')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'code', text: '**x**' },
      { kind: 'text', text: ' b' },
    ]);
  });

  it('returns the text unchanged when there is no markup', () => {
    expect(parseInline('plain words')).toEqual([{ kind: 'text', text: 'plain words' }]);
  });

  it('does not read a bare asterisk or an in-word underscore as emphasis', () => {
    expect(parseInline('2 * 3 = 6').map((s) => s.kind)).toEqual(['text']);
    expect(parseInline('snake_case_name').map((s) => s.kind)).toEqual(['text']);
  });
});
