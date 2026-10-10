import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ASK DESIGN AUTHORITY R3 — CTO PRODUCT RULINGS (static contract). Each block names its ruling.
 */
const src = (...p: string[]): string => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');
const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const shell = code(src('components', 'ask-nav', 'AskNavShell.tsx'));
const frame = code(src('components', 'ask-frame', 'AskFrameScreen.tsx'));
const turn = code(src('components', 'ask-frame', 'AskR2TurnView.tsx'));
const toolbar = code(src('components', 'ask-frame', 'AskAnswerToolbar.tsx'));
const footer = code(src('components', 'ask-nav', 'AskReadingFooter.tsx'));
const css = src('components', 'ask-frame', 'askDashboard.module.css');

describe('ruling 1 — standalone Ask has the Design header only', () => {
  it('/ask and the standalone root are the reading surface; the platform bar is not rendered there', () => {
    expect(src('app', 'ask', 'page.tsx')).toMatch(/<AskNavShell[^>]*surface="reading"/);
    expect(src('components', 'ask-nav', 'AskStandaloneRoot.tsx')).toMatch(/<AskNavShell[^>]*surface="reading"/);
    expect(shell).toMatch(/\{!reading && \(\s*<header\s+data-ask-nav="shell"/);
  });

  it('the frame header shows at every width on standalone Ask, over the reading column ≥1024', () => {
    expect(css).toMatch(/\.page\[data-ask-standalone\] \.frame \.phoneHeader \{\s*display: flex;/);
    expect(css).toMatch(/'history header side'/);
  });
});

describe('ruling 2 — the drawer is the conversations', () => {
  it('no navigation menu under the list on the reading surface', () => {
    const drawer = shell.slice(shell.indexOf('data-ask-nav="drawer"'));
    /* ASK R3 NAVIGATION / USABILITY R1 — the drawer on EVERY Ask page now ends in the one
       conversations footer (no route menu under the list anywhere), not only on the reading
       surface. */
    expect(drawer).toMatch(/data-ask-nav="conversations">[\s\S]*?<\/div>\s*(\{(\/\*[\s\S]*?\*\/)?\}\s*)?<AskReadingFooter/);
    expect(drawer).not.toMatch(/renderRoutes\(/);
    expect(drawer).not.toMatch(/\{reading \? \(/);
  });
});

describe('ruling 3 — no cost line under the composer; legal links in the quiet footer', () => {
  it('standalone Ask passes no cost note, and the under-composer legal row is not standalone', () => {
    expect(frame).toMatch(/costNote=\{nav === null \? t\.states\.costNotConfigured : undefined\}/);
    expect(frame).toMatch(/\{nav === null && \(\s*<p\s+data-ask="privacy-links"/);
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/cookies"');
  });

  it('Account / Settings stay reachable: one account entry in the footer', () => {
    expect(footer).toContain('href="/account/settings"');
    expect(footer).toContain('accountSignInUrl(');
  });
});

describe('ruling 4 — reader language; the truth state is kept', () => {
  it('the reference answer reads ONE quiet line; its governed kind stays on the element', () => {
    expect(turn).toMatch(/data-ask="reference-note"[^>]*data-ask-guidance-kind=/);
    expect(turn).toContain('{r.generalExplanationLine}');
  });

  it('scope / state / freshness and "No citable sources" live under a collapsed About this answer', () => {
    const about = turn.slice(turn.indexOf('<details data-ask="about-answer">'));
    expect(about).toMatch(/<summary>\{r\.aboutAnswer\}<\/summary>/);
    expect(about).toContain('data-ask="no-citable"');
    expect(about).toContain("answerMeta('inline')");
    expect(about).toContain('{referenceTitle}');
  });
});

describe('ruling 6 — legacy hand-offs are More rows, not cards', () => {
  it('no hand-off row in the reading flow; More offers them when they are real', () => {
    expect(turn).not.toContain('data-ask="handoffs"');
    expect(toolbar).toContain('data-ask="run-deeper"');
    expect(toolbar).toContain('data-ask="open-full-analysis"');
  });
});

describe('ruling 8 — nothing verified vs search incomplete', () => {
  it('one reader sentence, and the incomplete-search line only when the search was limited', () => {
    expect(turn).toContain('{r.noReportingTitle}');
    expect(turn).toMatch(/view\.badge === 'insuf' && view\.searchLimited && \(\s*<p data-ask="search-incomplete">/);
  });
});

describe('ruling 10 — continuity', () => {
  it('earlier turns are read in full and in order, not folded under an "Earlier" label', () => {
    expect(frame).not.toMatch(/data-ask-earlier-eyebrow/);
    expect(frame).not.toMatch(/<details key=\{`(restored|r2)-/);
  });

  it('emblem 136 / 64 typing at every width', () => {
    expect(css).toMatch(/\.frame :global\(\.gna-ask-emblem\) \{\s*--emblem-size: 136px;/);
  });
});
