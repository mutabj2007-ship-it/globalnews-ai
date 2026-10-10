import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { askProgressStrings, askProgressStringsQualified, ASK_PROGRESS_LOCALES } from '@/lib/ask/askProgressStrings';
import { followStrings } from '@/lib/ask/followStrings';
import { AskProgressRunning } from './AskProgressPanel';

/*
  ASK R3 PROGRESS R1 — CTO priorities 1, 3, 4, 5 (2026-10-10), from the ORIGINAL Claude Design R3
  package only: ProgressPanel.dc.html, PROGRESS_MOTION_SPEC.md, the Research Progress addendum
  §5–§7, HANDOFF.md (greeting, D12 row affordance). Driven only by the real in-flight signal.
*/
const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const byAsk = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => typeof n.type === 'string' && n.props['data-ask'] === id);

describe('copy — EN verbatim from ProgressPanel.dc.html; six drafts for Claude L', () => {
  it('EN', () => {
    const en = askProgressStrings('en');
    expect(en.collapsed(1)).toBe('Search activity · 1 step');
    expect(en.collapsed(3)).toBe('Search activity · 3 steps');
    expect([en.show, en.hide, en.inProgress, en.completed, en.answerReady]).toEqual(['Show', 'Hide', 'In progress', 'Completed', 'Answer ready']);
  });
  it('seven locales, same keys, only EN qualified', () => {
    const keys = Object.keys(askProgressStrings('en')).sort();
    for (const l of ASK_PROGRESS_LOCALES) {
      expect(Object.keys(askProgressStrings(l)).sort()).toEqual(keys);
      expect(askProgressStringsQualified(l)).toBe(l === 'en');
    }
  });
});

describe('priority 4 — the ORIGINAL emblem beside the real running line', () => {
  const render = () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(createElement(AskProgressRunning, { locale: 'en', label: 'Working on your answer…' }));
    });
    return r.root;
  };
  it('one row: working emblem + the line; one polite atomic status; a group named "Search activity"', () => {
    const root = render();
    const group = byAsk(root, 'progress')[0]!;
    expect(group.props['data-ask-progress']).toBe('running');
    expect(group.props['aria-label']).toBe('Search activity');
    const status = byAsk(root, 'working')[0]!;
    expect(status.props.role).toBe('status');
    expect(status.props['aria-live']).toBe('polite');
    expect(status.props['aria-atomic']).toBe('true');
    expect(textOf(status)).toBe('In progress: Working on your answer…');
    expect(byAsk(root, 'working-emblem')).toHaveLength(1);
  });
  it('reduced motion: the visible "In progress ·" prefix (CSS) carries the state', () => {
    const root = render();
    expect(textOf(root.find((n) => n.props.className === 'gna-ask-rm-only'))).toBe('In progress · ');
    const css = read('..', '..', 'app', 'globals.css');
    /* shown by default, hidden only inside the working layer's no-preference block (no new reduce block) */
    expect(css).toMatch(/\.gna-ask-rm-only \{\s*display: inline;/);
    const layer = css.slice(css.indexOf('ASK R3 PROGRESS R1 — THE WORKING MOTION'));
    /* browser finding: an equal-specificity hide rule lost to the later base rule — the hide must out-rank it */
    expect(layer).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*\.gna-ask-progress-row \.gna-ask-rm-only \{\s*display: none;/);
    /* E-4 emblem freeze: the working mount animates opacity only, never scale */
    expect(layer).not.toMatch(/scale\(/);
  });
  it('the working motion is its own layer (2.4 s / 7.2 s / 1.6 s), paused when hidden, never the idle values', () => {
    const css = read('..', '..', 'app', 'globals.css');
    const layer = css.slice(css.indexOf('ASK R3 PROGRESS R1 — THE WORKING MOTION'));
    expect(layer).toMatch(/\.gna-ask-working-emblem \.gna-ask-emblem-sweep \{\s*animation: gnaAskEmblemTurn 2\.4s linear infinite;/);
    expect(layer).toMatch(/\.gna-ask-working-emblem \.gna-ask-emblem-arc \{\s*animation: gnaAskEmblemTurn 7\.2s linear infinite;/);
    expect(layer).toMatch(/\.gna-ask-working-emblem \.gna-ask-emblem-core \{\s*animation: gnaAskWorkCore 1\.6s cubic-bezier\(0\.45, 0, 0\.55, 1\) infinite;/);
    expect(layer).toMatch(/\[data-ask-paused='true'\] \.gna-ask-emblem-sweep/);
    /* the idle welcome motion keeps its own values */
    expect(css).toMatch(/\.gna-ask-emblem-sweep \{\s*animation: gnaAskEmblemTurn 32s linear infinite;/);
  });
  it('the same original geometry — no redrawn logo', () => {
    const emblem = read('AskEmblem.tsx');
    expect(emblem).toMatch(/export function AskWorkingEmblem[\s\S]*<AskEmblemSvg id=\{id\} size=\{24\} \/>/);
  });
  it('nothing is timer-driven: the panel has no timers', () => {
    expect(read('AskProgressPanel.tsx')).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });
});

/* priority 5 (the Search activity RECORD) — superseded by askR3ResearchActivity.spec.ts (PO acceptance failure R1):
   the 0717ff7 session-only, analysis-inferred record was the defect. */

describe('priorities 1 and 3 — greeting and the drawer row affordance', () => {
  it('the verified-name greeting is the R3 wording, "Welcome back, {name}" (no added period)', () => {
    expect(followStrings('en').greeting('Amina')).toBe('Welcome back, Amina');
  });
  it('the drawer row delete is the R3 44 px "⋯" glyph named "Delete conversation: {title}"', () => {
    const rows = read('AskConversations.tsx');
    /* browser finding: the old name read "Delete: {title}" — with the word gone, the name must be R3's */
    expect(rows).toMatch(/aria-label=\{`\$\{r3\.deleteConversationAction\}: \$\{title\}`\}/);
    expect(rows).toMatch(/<span aria-hidden="true">⋯<\/span>/);
    expect(rows).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
  });
});
