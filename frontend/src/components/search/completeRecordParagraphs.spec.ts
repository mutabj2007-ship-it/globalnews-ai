import { readFileSync } from 'fs';
import { join } from 'path';

import { splitSynthesisParagraphs } from '@/components/analysis-frame/briefModel';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * L-1 / L-2 — PARAGRAPH STRUCTURE AND JUSTIFIED BODY PROSE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * L-1. The Analysis Workspace rendered the synthesis as paragraphs; the Complete
 * Analysis Record rendered `{analysis.summary}` in a SINGLE <p>, collapsing a
 * multi-paragraph brief into one slab. Two surfaces, one string, two different
 * answers about where a paragraph ends.
 *
 * The ruling is explicit: *"do not reconstruct paragraphs independently on each
 * surface"*. So the Complete Record now imports the SAME `splitSynthesisParagraphs`
 * the workspace already used — not a second splitter that agrees today.
 *
 * L-2. Justification applies to BODY PROSE ONLY, via one shared class.
 */

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const completeRecord = stripComments(readFileSync(join(__dirname, 'AnalysisResultView.tsx'), 'utf-8'));
const workspaceBrief = stripComments(readFileSync(join(__dirname, 'ExecutiveBrief.tsx'), 'utf-8'));
const globals = readFileSync(join(__dirname, '..', '..', 'app', 'globals.css'), 'utf-8');

describe('L-1 — three source paragraphs remain three rendered paragraphs', () => {
  const THREE = [
    'The ministry confirmed the proposal returns to committee.',
    'Opposition parties said they would seek amendments.',
    'A vote is expected before the end of the session.',
  ].join('\n\n');

  it('the canonical splitter yields three', () => {
    expect(splitSynthesisParagraphs(THREE)).toHaveLength(3);
  });

  it('and joining them back reproduces the input — layout only, never editorial', () => {
    expect(splitSynthesisParagraphs(THREE).join('\n\n')).toBe(THREE);
  });

  it('a single-paragraph brief still yields exactly one', () => {
    expect(splitSynthesisParagraphs('One paragraph only.')).toHaveLength(1);
  });

  it('irregular blank-line spacing still yields three', () => {
    const irregular = 'First.\n\n\n  \nSecond.\n\nThird.';

    expect(splitSynthesisParagraphs(irregular)).toHaveLength(3);
  });

  describe('BOTH SURFACES CONSUME THE SAME SPLITTER', () => {
    it('the Complete Record imports it rather than splitting its own way', () => {
      expect(completeRecord).toContain(
        "import { splitSynthesisParagraphs } from '@/components/analysis-frame/briefModel';",
      );
      expect(completeRecord).toContain('splitSynthesisParagraphs(analysis.summary).map(');
    });

    it('the Analysis Workspace still imports the same one', () => {
      expect(workspaceBrief).toContain(
        "import { splitSynthesisParagraphs } from '@/components/analysis-frame/briefModel';",
      );
    });

    it('neither surface renders the raw summary in a single <p> any more', () => {
      /* The exact shape of the defect. */
      expect(completeRecord).not.toMatch(/<p[^>]*>\s*\{analysis\.summary\}\s*<\/p>/);
    });

    it('both mark their paragraphs so a test can find them', () => {
      expect(completeRecord).toContain('data-gn="brief-paragraph"');
      expect(workspaceBrief).toContain('data-gn="brief-paragraph"');
    });
  });
});

describe('L-2 — justified body prose, and only body prose', () => {
  it('both surfaces use the one shared class', () => {
    expect(completeRecord).toContain('gn-justified-prose');
    expect(workspaceBrief).toContain('gn-justified-prose');
  });

  it('the class justifies only at comfortable measures', () => {
    /*
      Justification stretches inter-word spaces. In a narrow column there are
      too few words per line to absorb the difference, so it produces rivers of
      white space — which is why the ruling allows a responsive rule rather than
      forcing poor justification.
    */
    expect(globals).toMatch(/\.gn-justified-prose\s*\{[^}]*text-align:\s*left/);
    expect(globals).toMatch(/@media \(min-width: 640px\)[\s\S]*text-align:\s*justify/);
  });

  it('the last line stays natural — text-align-last is never forced', () => {
    expect(globals).not.toMatch(/text-align-last:\s*justify/);
    expect(globals).toMatch(/text-align-last:\s*auto/);
  });

  it('hyphenation is enabled, which is what makes justification tolerable', () => {
    expect(globals).toMatch(/\.gn-justified-prose\s*\{[^}]*hyphens:\s*auto/);
  });

  describe('WHAT MUST NOT BE JUSTIFIED', () => {
    it('the class is applied to paragraphs, not to headings or metadata rows', () => {
      /*
        Stretching a two-word chip across a column is not typography. The class
        appears only on the <p> elements that carry running prose.
      */
      const justifiedUses = completeRecord.split('gn-justified-prose').length - 1;

      expect(justifiedUses).toBe(1);
    });

    it('source cards, metrics and labels carry no justification class', () => {
      for (const surface of [completeRecord, workspaceBrief]) {
        expect(surface).not.toMatch(/data-gn="source-[a-z]+"[^>]*gn-justified-prose/);
      }
    });
  });
});

describe('L-6 — this is a presentation change and costs nothing', () => {
  it('no analysis client reaches the Complete Record', () => {
    expect(completeRecord).not.toContain('analyzeNews');
    expect(completeRecord).not.toContain('analysisApi');
  });

  it('no provider or news client either', () => {
    expect(completeRecord).not.toContain('fetchTopHeadlines');
    expect(completeRecord).not.toContain('fetchCountryNews');
    expect(completeRecord).not.toContain('fetchMapFeed');
  });

  it('the surface issues no fetch of its own', () => {
    expect(completeRecord).not.toMatch(/\bfetch\(/);
  });

  it('and no effect runs on it that could', () => {
    /* A presentation change must not acquire a lifecycle. */
    expect(completeRecord).not.toContain('useEffect');
  });
});
