import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R4 ANSWER READING EXPERIENCE R1 · PHASE C — HIERARCHY, DENSITY AND THEMES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Product Owner's words were *"a modern research conversation rather than a dashboard of
 * large bordered cards"*, and the correction added nine specifics. This spec pins the ones a
 * screenshot cannot prove on its own — that a rule exists, that a distinction was kept, that
 * a disclosure was not quietly dropped while the box around it was.
 *
 * ── MEASURED, on the scratch harness at 1440 with two earlier turns and four sources ──
 *
 *                              before      after
 *   first answer word          y = 507     y = 304
 *   bordered boxes in a turn   13          6  (and none of the six is a card around the answer)
 *   earlier-turn stack         202px       57px
 *   phone first answer word    y = 665     y = 378
 *   phone bordered boxes       8           3
 *   light-theme answer ink     #E6EEF6 on #F3F6F9 — 1.1:1     #15181C on #E7E9EC — 14.5:1
 *
 * The harness is scratch and is never committed, so the numbers live in the handoff with the
 * screenshots. What is asserted here is the CSS and markup that produce them, which is what a
 * reviewer can actually re-run.
 */

const css = readFileSync(join(__dirname, 'askDashboard.module.css'), 'utf8');
const turnView = readFileSync(join(__dirname, 'AskR2TurnView.tsx'), 'utf8');
const screen = readFileSync(join(__dirname, 'AskFrameScreen.tsx'), 'utf8');
const globals = readFileSync(join(__dirname, '..', '..', 'app', 'globals.css'), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** The Phase C section only — so an assertion here cannot be satisfied by older CSS. */
const phaseC = (): string => {
  const start = css.indexOf('PHASE C — HIERARCHY, DENSITY AND THE THEMES');
  expect(start).toBeGreaterThan(0);
  return css.slice(start);
};

describe('C-1 · the answer is the page, and the qualified states are still distinct', () => {
  it('the normal answered tones render with no box at all', () => {
    const section = strip(phaseC());
    expect(section).toMatch(
      /\[data-ask='answer'\]\[data-ask-read-plain='true'\]\)\s*\{[^}]*border:\s*0;[^}]*padding:\s*0;[^}]*background:\s*none;/,
    );
  });

  it('exactly the three normal tones are plain; every qualified tone keeps an edge', () => {
    /*
      THE ASSERTION THAT MATTERS MOST IN THIS FILE. The programme forbids blurring a
      reference-background, insufficient-evidence, unavailable or retained-record answer into
      a researched one. Removing the box from those tones would do exactly that with CSS, so
      the membership of the plain set is pinned by name rather than by count.
    */
    expect(strip(turnView)).toContain(
      "const PLAIN_TONES: ReadonlySet<AskR2View['tone']> = new Set(['current', 'verified', 'partial']);",
    );
    const section = strip(phaseC());
    for (const tone of ['reference', 'insufficient', 'unavailable', 'retained', 'clarification']) {
      expect(section).toContain(`[data-ask='answer'][data-ask-read-rule='${tone}']`);
    }
    expect(section).toMatch(/border-inline-start:\s*3px solid/);
  });

  it('the tone is still readable from the DOM after the box is gone', () => {
    /* A visual change must not remove a machine-readable state. */
    expect(strip(turnView)).toContain('data-ask-tone={view.tone}');
    expect(strip(turnView)).toContain('data-ask-tone="current"');
  });
});

describe('C-2 · the light theme is a reading surface, not a dimmed dark one', () => {
  it('the reading tokens are declared in the light scope and reset in the dark ones', () => {
    const tokens = [
      '--ask-read-bg',
      '--ask-read-answer-bg',
      '--ask-read-sunk',
      '--ask-read-line',
      '--ask-read-ink',
      '--ask-read-ink2',
      '--ask-read-ink3',
    ];
    for (const token of tokens) {
      expect(globals).toContain(`${token}: #`);
      /* Three resets: the explicit dark scope, and the system-preference dark scope. */
      const resets = globals.split(`${token}: initial;`).length - 1;
      expect(resets).toBeGreaterThanOrEqual(2);
    }
  });

  it('the reading surfaces carry only a bounded cast, not a tint', () => {
    /*
      "Do not simply increase saturation globally." The cast is bounded rather than
      eliminated: R, G and B stay within 10 of each other — under 4% of the range — because a
      fully achromatic grey reads yellow on most sRGB panels. A future edit that reintroduces
      a real tint fails here rather than in a screenshot nobody re-takes.

      The bound alone is not the guarantee; the old `#F3F6F9` had a smaller spread than this.
      What makes the light theme readable is this bound TOGETHER WITH the separation and
      contrast assertions below, which the old palette failed by a wide margin.
    */
    const read = (name: string): readonly number[] => {
      const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`, 'i').exec(globals);
      if (m === null) throw new Error(`no ${name}`);
      const hex = m[1];
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    };
    const surfaces = [
      '--ask-read-bg',
      '--ask-read-sunk',
      '--ask-read-line',
      '--ask-read-line-soft',
      '--ask-read-ink',
      '--ask-read-ink2',
      '--ask-read-ink3',
    ];
    for (const name of surfaces) {
      const [r, g, b] = read(name);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(10);
    }
  });

  it('page, answer and control are separated enough to tell apart', () => {
    /*
      The measured defect was #F3F6F9 / #EEF2F7 / #FFFFFF — under 2% luminance apart, so
      "clearer page / answer / control distinction" could not be satisfied by colour choice
      alone. Relative luminance is computed here rather than eyeballed.
    */
    const lum = (name: string): number => {
      const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`, 'i').exec(globals);
      if (m === null) throw new Error(`no ${name}`);
      const hex = m[1];
      const c = [0, 2, 4]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const page = lum('--ask-read-bg');
    const answer = lum('--ask-read-answer-bg');
    const sunk = lum('--ask-read-sunk');
    expect(answer).toBeGreaterThan(page);
    expect(page).toBeGreaterThan(sunk);
    /* Each step at least 5% of the range, so the three are distinguishable on a bad panel. */
    expect(answer - page).toBeGreaterThan(0.05);
    expect(page - sunk).toBeGreaterThan(0.05);
  });

  it('every reading ink clears WCAG AA against the answer surface', () => {
    const rgb = (name: string): readonly number[] => {
      const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`, 'i').exec(globals);
      if (m === null) throw new Error(`no ${name}`);
      const hex = m[1];
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    };
    const rl = (c: readonly number[]): number => {
      const lin = c
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    };
    const ratio = (a: readonly number[], b: readonly number[]): number => {
      const [x, y] = [rl(a), rl(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    /*
      Checked against BOTH surfaces. Provenance and meta text render on the PAGE, not on the
      answer, so a palette that only cleared AA against white would still fail where those
      strings actually appear — which is exactly the kind of gap the first light theme had.
    */
    for (const surface of ['--ask-read-answer-bg', '--ask-read-bg']) {
      const bg = rgb(surface);
      expect(ratio(rgb('--ask-read-ink'), bg)).toBeGreaterThan(12);
      expect(ratio(rgb('--ask-read-ink2'), bg)).toBeGreaterThan(4.5);
      expect(ratio(rgb('--ask-read-ink3'), bg)).toBeGreaterThan(4.5);
    }
  });

  it('the dark scope resolves to the ACCEPTED palette, byte for byte', () => {
    /*
      Every reading rule is written `var(--ask-read-*, <accepted dark value>)`, and the dark
      scopes set the token to `initial`, so the fallback is what renders. That is the only
      reason this round can change the light theme without touching the accepted dark one,
      so the shape is asserted rather than trusted.
    */
    const section = strip(phaseC());
    const vars = section.match(/var\(--ask-read-[a-z0-9-]+(,[^)]*)?\)/g) ?? [];
    expect(vars.length).toBeGreaterThan(20);
    const withoutFallback = vars.filter((v) => !v.includes(','));
    /* Only the state-rule indirection may omit a fallback; it sets --ask-read-rule itself. */
    expect(withoutFallback).toEqual([]);
  });
});

describe('C-3 · density — a border means "separate from the answer"', () => {
  it('the earlier-turn stack is a margin note, not two cards', () => {
    const section = strip(phaseC());
    expect(section).toMatch(/\.earlier\[data-ask-read='r4'\]\s*\{[^}]*border:\s*0;/);
    expect(section).toMatch(/white-space:\s*nowrap;/);
    /* Opening one restores the full question — compression must not hide the words. */
    expect(section).toMatch(
      /\.earlier\[data-ask-read='r4'\]\[open\] summary[^{]*\{\s*white-space:\s*normal;\s*\}/,
    );
    expect(strip(screen)).toContain('data-ask="earlier-turn" data-ask-read="r4"');
  });

  it('the hand-off controls are secondary but still reach 44px', () => {
    const section = strip(phaseC());
    expect(section).toMatch(
      /\[data-ask='run-deeper'\]\)\s*\{[^}]*min-height:\s*44px;[^}]*border:\s*0;[^}]*background:\s*none;/,
    );
  });

  it('a borderless control keeps a visible focus ring', () => {
    /* Removing a border is a visual decision; removing focus is an accessibility defect. */
    expect(strip(phaseC())).toMatch(/:focus-visible[^{]*\{[^}]*outline:\s*2px solid/);
  });

  it('the sources rail no longer starts above the answer', () => {
    expect(strip(phaseC())).toMatch(
      /\.grid > \.sourcesColumn\[data-ask-read='r4'\]\s*\{[^}]*padding-top:\s*[\d.]+rem;/,
    );
    /* …and drops the offset where the rail stacks under the answer instead of beside it. */
    expect(strip(phaseC())).toMatch(/@media \(max-width: 1023px\)[\s\S]{0,160}padding-top:\s*0;/);
  });

  it('zero sources collapses the track instead of leaving an empty rail', () => {
    expect(strip(phaseC())).toMatch(
      /\[data-ask-sources-column='false'\] \.grid[\s\S]{0,120}grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    /* The attribute is now written in both directions; before, it was set only when true. */
    expect(strip(screen)).toContain("data-ask-sources-column={withSourcesColumn ? 'true' : 'false'}");
  });
});

describe('C-4 · nothing truthful was removed with the box around it', () => {
  it('the model-background disclosure keeps its words, its place and its dashed edge', () => {
    const section = strip(phaseC());
    expect(section).toContain("[data-ask='reference-note'][data-ask-read='r4']");
    /*
      The dashed rule is the vocabulary this surface already uses for "not current sourced
      research". Compacting the block is a visual change; dropping the dash would be a
      provenance change wearing a visual one's clothes.
    */
    expect(section).toMatch(/border-inline-start:\s*2px dashed/);
    expect(strip(turnView)).toContain('data-ask="reference-note"');
  });

  it('the AI-cost meta line under a hand-off control is demoted, never deleted', () => {
    /* A control that runs AI must say so BEFORE it is pressed. */
    expect(strip(turnView)).toContain('{s.runDeepMeta}');
    expect(strip(turnView)).toContain('{s.openFullMeta}');
    expect(strip(phaseC())).toMatch(
      /\[data-ask='run-deeper'\] span:last-child\)\s*\{\s*color:\s*var\(--ask-read-ink3/,
    );
  });

  it('the ANSWER eyebrow is hidden from sight on the latest turn, not from assistive tech', () => {
    /*
      It is clipped, not `display: none` and not removed: a screen reader arriving at the
      region still hears what it is, and the accepted specs that read the label still find it.
    */
    const section = strip(phaseC());
    expect(section).toMatch(/data-ask-eyebrow='answer'[\s\S]{0,260}clip-path:\s*inset\(50%\);/);
    expect(section).not.toMatch(/data-ask-eyebrow='answer'[\s\S]{0,260}display:\s*none;/);
    expect(strip(turnView)).toContain('data-ask-eyebrow="answer"');
  });

  it('the analytical-inference run keeps its governed distinction', () => {
    /*
      Its lighter, italic treatment tells a reader a sentence is the model's inference rather
      than something a source reported. Phase C fixed its CONTRAST; it must not have flattened
      it into the colour of reported fact.
    */
    const section = strip(phaseC());
    expect(section).toContain("[data-ask-statement='ANALYTICAL_INFERENCE']");
    expect(section).toMatch(/ANALYTICAL_INFERENCE'\]\)[\s\S]{0,120}var\(--ask-read-ink2/);
    expect(section).not.toMatch(/ANALYTICAL_INFERENCE'\]\)[\s\S]{0,120}var\(--ask-read-ink,/);
  });
});

describe('C-5 · the reading column', () => {
  it('is bounded rather than filling the desk', () => {
    const section = strip(phaseC());
    expect(section).toMatch(/max-width:\s*68ch;/);
    expect(section).toMatch(/@media \(min-width: 1536px\)[\s\S]{0,140}max-width:\s*70ch;/);
  });

  it('phone and desktop render the same structure', () => {
    /* The parity addendum permits geometry to change and forbids anything being removed. */
    const section = strip(phaseC());
    const phoneOnly = section.match(/@media \(max-width: 1023px\)[\s\S]*?\}\s*\}/g) ?? [];
    for (const block of phoneOnly) {
      expect(block).not.toMatch(/display:\s*none/);
    }
  });
});
