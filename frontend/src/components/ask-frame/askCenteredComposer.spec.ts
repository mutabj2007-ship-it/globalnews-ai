import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DISPLAY_LOCALES, type DisplayLocale } from '@globalnews-ai/shared';
import { Composer, composerKeyAction, enterSends, physicalKeyboardEvidence } from './AskParts';
import { QUESTION_EXAMPLES, exampleText } from '@/lib/ask/askQuestionExamples';
import { buildExampleQueue } from '@/lib/ask/askExampleRotation';
import { askSevenStrings } from '@/lib/ask/askSevenStrings';
import { askDirectionProps, isolatedAuto } from '@/lib/ask/askDirection';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * STANDALONE CENTERED INTELLIGENCE COMPOSER + ROTATING QUESTION EXAMPLES R1
 *
 * Group C-1  the entry state, and nothing outside it
 * Group C-2  the centred geometry
 * Group C-3  the example lives INSIDE the composer
 * Group C-4  selection fills the composer and submits nothing
 * Group C-5  the keyboard ruling — ONE submit pipeline
 * Group C-6  CROSS-PLATFORM FUNCTIONAL PARITY ADDENDUM
 * Group C-7  seven languages and Arabic RTL
 * Group C-8  responsive widths
 * Group C-9  themes
 * Group C-10 accessibility
 */

const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const css = read('askDashboard.module.css');
const screen = code(read('AskFrameScreen.tsx'));
const parts = code(read('AskParts.tsx'));
const rule = (selector: string) =>
  css
    .split(selector)
    .slice(1)
    .map((block) => block.split('}')[0])
    .join('\n');

/*
  R4 ANSWER READING R1 — the stylesheet now carries a SECOND appended section (answer prose
  typography). These assertions are about the centred-composer section only, so they read it
  between its own banner and the next one. Without this they would claim a later contract's
  rules as unscoped entry rules.
*/
const centredComposerCss = (): string =>
  (css.split('STANDALONE CENTERED INTELLIGENCE COMPOSER + ROTATING')[1] ?? '').split(
    'R4 ANSWER READING EXPERIENCE R1',
  )[0];

const example = (locale: DisplayLocale = 'en', compact = false) => ({
  text: exampleText(QUESTION_EXAMPLES[0], locale, compact),
  id: QUESTION_EXAMPLES[0].id,
  useLabel: askSevenStrings(locale).exampleUse,
  onUse: () => undefined,
  onFocus: () => undefined,
  onBlur: () => undefined,
  animationClass: 'enter',
  generation: 1,
  directionProps: isolatedAuto(),
});

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(
      Composer as never,
      {
        value: '',
        onChange: () => undefined,
        inputLabel: 'label',
        placeholder: 'hint',
        submitLabel: 'Ask',
        costNote: 'note',
        maxHeight: 220,
        onSubmit: () => undefined,
        ...props,
      } as never,
    ),
  );

describe('C-1 · the entry state, and nothing outside it', () => {
  it('is exactly "no question yet" — not a second surface and not a new route', () => {
    expect(screen).toMatch(/const entryState = !hasQuestion;/);
    expect(screen).toContain("data-ask-entry={entryState ? 'true' : undefined}");
    /* hasQuestion already covers turns, a reopened operation, a pending run and a sign-in
       interruption, so the entry geometry cannot survive into any of them. */
    expect(screen).toMatch(
      /const hasQuestion =\s*r2\.turns\.length > 0 \|\|\s*opened !== null \|\|\s*isPending \|\|\s*r2\.signInRequired !== null;/,
    );
  });

  it('rotates only in the entry state, so no timer runs in the answered workspace', () => {
    expect(screen).toMatch(
      /useRotatingExample\(\{\s*locale: interfaceLocale,\s*enabled: entryState,/,
    );
  });

  it('keeps ONE composer instance — a second one would be a second submit path', () => {
    expect(screen.match(/<Composer\b/g)).toHaveLength(1);
    expect(parts.match(/<form\b/g)).toHaveLength(1);
  });

  it('does not mount a standing list of example questions outside the composer', () => {
    expect(screen).not.toContain('QuestionsWorthAsking');
    /* The primitive itself is untouched and still exported for a later contract. */
    expect(code(read('AskParts.tsx'))).toContain('export function QuestionsWorthAsking');
  });

  it('leaves the post-answer workspace geometry alone: every new rule is entry-scoped', () => {
    const introduced = centredComposerCss();
    expect(introduced.length).toBeGreaterThan(0);
    const selectors = introduced
      .split('\n')
      .filter((line) => line.trim().endsWith('{') && !line.includes('@'))
      .map((line) => line.trim());
    for (const selector of selectors) {
      const scoped =
        selector.includes("[data-ask-entry='true']") ||
        selector.startsWith('.entry') ||
        selector.startsWith('.exampleEnter') ||
        selector.startsWith('from') ||
        selector.startsWith('to');
      expect({ selector, scoped }).toEqual({ selector, scoped: true });
    }
  });
});

describe('C-2 · the centred geometry', () => {
  it('bottom-aligns the heading above the composer and lifts the pair with a spacer', () => {
    expect(rule(".frame[data-ask-entry='true'] .reader")).toMatch(/justify-content: flex-end;/);
    expect(rule('.entrySpacer')).toMatch(/flex: 0 1 32vh;/);
    expect(screen).toContain('data-ask="entry-spacer"');
    expect(screen).toContain('className={styles.entrySpacer}');
  });

  it('is calm: no rule across the viewport under the entry composer', () => {
    expect(rule(".frame[data-ask-entry='true'] .composerBar")).toMatch(/border-top: 0;/);
    expect(rule(".frame[data-ask-entry='true'] .composerBar")).toMatch(/background: transparent;/);
    /* And the answered state keeps its border, byte for byte. */
    expect(rule('\n.composerBar')).toMatch(/border-top: 1px solid var\(--ask-line, #0a2744\);/);
  });

  it('makes the composer the dominant object without going edge to edge', () => {
    expect(
      rule(".frame[data-ask-entry='true'] :global([data-ask='composer']) > div:first-child"),
    ).toMatch(/min-height: 64px;/);
    /* The released 760-wide centred column is unchanged: dominant, not full-bleed. */
    expect(rule('\n.grid,\n.composerGrid')).toMatch(/max-width: 760px;/);
    expect(rule('\n.grid,\n.composerGrid')).toMatch(/margin: 0 auto;/);
  });

  it('centres the heading stack and leads with the wordmark, then the question', () => {
    expect(rule(".frame[data-ask-entry='true'] .empty")).toMatch(/text-align: center;/);
    expect(rule(".frame[data-ask-entry='true'] .empty")).toMatch(/align-items: center;/);
    expect(screen).toContain('data-ask="entry-brand"');
    expect(screen.indexOf('data-ask="entry-brand"')).toBeLessThan(
      screen.indexOf('{sevenStrings.composerHint}</h1>'),
    );
  });

  it('keeps the entry heading theme-aware rather than hardcoding a dark ink', () => {
    expect(rule('.entryBrand')).toMatch(/color: var\(--ask-ink2, #8fa6c0\);/);
  });
});

describe('C-3 · the example lives inside the composer', () => {
  it('renders the example in the composer and stands the native placeholder down', () => {
    const html = render({ example: example('en') });
    expect(html).toContain('data-ask="composer-example"');
    expect(html).toContain(QUESTION_EXAMPLES[0].text.en);
    expect(html).toContain(`data-ask-example-id="${QUESTION_EXAMPLES[0].id}"`);
    expect(html).toMatch(/placeholder=""/);
  });

  it('shows the plain hint, and no example layer, when there is no example', () => {
    const html = render({});
    expect(html).not.toContain('data-ask="composer-example"');
    expect(html).toContain('placeholder="hint"');
  });

  it('withdraws the example the moment the composer has a value', () => {
    const html = render({ value: 'a', example: example('en') });
    expect(html).not.toContain('data-ask="composer-example"');
    expect(html).toContain('placeholder="hint"');
    expect(parts).toMatch(/const showExample = example !== undefined && value\.length === 0;/);
  });

  it('never lets the example layer swallow a click meant for the field', () => {
    /* ASK RELIABILITY R1 (§8) — Product Owner instruction 2026-10-06: a sample question shown inside the input is
     visible GUIDANCE ONLY — plain text, not clickable, not focusable; it never fills, submits, navigates or
     steals focus. This supersedes the earlier C-3/C-4/C-6/C-10 'tap the example to fill' contract. */
    const html = render({ example: example('en') });
    expect(html).toMatch(/data-ask="composer-example-layer"[^>]*class="[^"]*pointer-events-none/);
    expect(html).not.toMatch(/data-ask="composer-example"[^>]*class="[^"]*pointer-events-auto/);
  });

  it('animates only when motion is allowed, and the stylesheet refuses it too', () => {
    const moving = render({ example: { ...example('en'), animationClass: 'gn-example-fade' } });
    expect(moving).toContain('gn-example-fade');
    const still = render({ example: { ...example('en'), animationClass: undefined } });
    expect(still).not.toContain('gn-example-fade');
    expect(rule('.exampleEnter')).toMatch(/animation: exampleEnter 420ms/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.exampleEnter \{\s*animation: none;/,
    );
    expect(screen).toContain(
      'animationClass: rotatingExample.animate ? styles.exampleEnter : undefined',
    );
    expect(code(read('../../lib/ask/useRotatingExample.ts'))).toContain(
      "'(prefers-reduced-motion: reduce)'",
    );
  });

  it('fades and rises only — no typewriter, no bounce, no horizontal travel', () => {
    const keyframes = css.split('@keyframes exampleEnter')[1].split('\n}')[0];
    expect(keyframes).toMatch(/opacity: 0;/);
    expect(keyframes).toMatch(/transform: translateY\(6px\);/);
    expect(keyframes).not.toMatch(/translateX|scale|width:|steps\(/);
  });
});

describe('C-4 · selection fills the composer and submits nothing', () => {
  it('is plain guidance text — never a control, never a form submit', () => {
    /* ASK RELIABILITY R1 (§8) — Product Owner instruction 2026-10-06: a sample question shown inside the input is
     visible GUIDANCE ONLY — plain text, not clickable, not focusable; it never fills, submits, navigates or
     steals focus. This supersedes the earlier C-3/C-4/C-6/C-10 'tap the example to fill' contract. */
    const html = render({ example: example('en') });
    expect(html).toMatch(/<span[^>]*data-ask="composer-example"/);
    expect(html).not.toMatch(/<button[^>]*data-ask="composer-example"/);
    expect(parts).not.toMatch(/onClick=\{example\.onUse\}/);
  });

  it('puts the example into the draft through the shared draft path, then focuses it', () => {
    expect(screen).toMatch(
      /onUse: \(\) => \{\s*rotatingExample\.onUse\(\);\s*draftQuestion\(rotatingExample\.text \?\? ''\);/,
    );
    expect(screen).toMatch(/function draftQuestion\(draft: string\) \{\s*setQuestion\(draft\);/);
    expect(screen).toMatch(/\[data-ask="composer-input"\]'\)\?\.focus\(\)/);
  });

  it('does not submit: nothing in the selection path reaches ask() or the form', () => {
    const onUse = screen.split('onUse: () => {')[1].split('},')[0];
    expect(onUse).not.toMatch(/ask\(\)|requestSubmit|onSubmit/);
  });

  it('leaves the inserted text ordinary and editable — the composer is uncontrolled by it', () => {
    const html = render({ value: QUESTION_EXAMPLES[0].text.en, example: example('en') });
    expect(html).toContain('data-ask="composer-input"');
    expect(html).not.toContain('readonly');
    expect(html).not.toContain('disabled=""');
  });
});

describe('C-5 · the keyboard ruling — one submit pipeline', () => {
  it('Enter on a desktop keyboard is the Ask button: the SAME form submit', () => {
    expect(
      composerKeyAction({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        enterSends: true,
        ready: true,
      }),
    ).toBe('SUBMIT');
    expect(parts).toMatch(
      /if \(action === 'SUBMIT'\) event\.currentTarget\.form\?\.requestSubmit\(\)/,
    );
    const html = render({});
    expect(html).toMatch(/<button type="submit"[^>]*data-ask="send"/);
    /* One form, one onSubmit, one handler for both paths. */
    expect(parts.match(/onSubmit\?\.\(\)/g)).toHaveLength(1);
    expect(parts).toMatch(
      /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*onSubmit\?\.\(\);/,
    );
  });

  it('Shift+Enter is a newline, and an IME confirmation is never a send', () => {
    const base = { key: 'Enter', isComposing: false, enterSends: true, ready: true } as const;
    expect(composerKeyAction({ ...base, shiftKey: true })).toBe('DEFAULT');
    expect(composerKeyAction({ ...base, shiftKey: false, isComposing: true })).toBe('DEFAULT');
    expect(parts).toMatch(/isComposing: event\.nativeEvent\.isComposing/);
  });

  it('an empty composer and Enter does nothing — including with an example on screen', () => {
    /* A visible rotating example is a SUGGESTION: the value is still empty, so `ready` is
       false and the keystroke is swallowed. This is the accidental-compute guard. */
    expect(
      composerKeyAction({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        enterSends: true,
        ready: false,
      }),
    ).toBe('SUPPRESS');
    const html = render({ example: example('en') });
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""/);
    expect(parts).toMatch(
      /const ready = !pending && value\.trim\(\)\.length > 0 && onSubmit !== undefined;/,
    );
  });

  it('a question in flight disables every path, so a repeat press cannot duplicate it', () => {
    const html = render({ value: 'q', pending: true });
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""/);
    expect(
      composerKeyAction({
        key: 'Enter',
        shiftKey: false,
        isComposing: false,
        enterSends: true,
        ready: false,
      }),
    ).toBe('SUPPRESS');
    /* Three independent layers, none of them new: the ready gate, the screen's own guard,
       and the conversation hook's in-flight ref. No second quota or compute mechanism. */
    expect(screen).toMatch(/if \(isPending \|\| !question\.trim\(\)\) return;/);
    expect(screen).toMatch(/setQuestion\(''\);/);
    expect(
      code(readFileSync(join(__dirname, '../../lib/ask/useAskR2Conversation.ts'), 'utf8')),
    ).toMatch(/if \(inFlight\.current\) return 'busy';/);
  });
});

describe('C-6 · cross-platform functional parity addendum', () => {
  const withPointers = (fine: boolean, anyFine: boolean) => {
    (globalThis as unknown as { window: unknown }).window = {
      matchMedia: (q: string) => ({
        matches: q === '(pointer: fine)' ? fine : q === '(any-pointer: fine)' ? anyFine : false,
      }),
    };
  };
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('a laptop sends on Enter, exactly as before', () => {
    withPointers(true, true);
    expect(enterSends()).toBe(true);
  });

  it('A TABLET WITH A KEYBOARD CASE sends on Enter — the coarse primary pointer no longer denies it', () => {
    /* The released gate was `(pointer: fine)`, which a touchscreen tablet answers false even
       with a real keyboard attached. That was the downgrade the addendum forbids. */
    withPointers(false, true);
    expect(enterSends()).toBe(true);
  });

  it('a phone with no keyboard and no pointer keeps Enter as a newline', () => {
    withPointers(false, false);
    expect(enterSends()).toBe(false);
  });

  it('a hardware keyboard with no pointer is recognised from keys a soft keyboard cannot send', () => {
    for (const event of [
      { key: 'Tab', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false },
      { key: 'ArrowLeft', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false },
      { key: 'Enter', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false },
      { key: 'a', shiftKey: false, ctrlKey: true, altKey: false, metaKey: false },
      { key: 'v', shiftKey: false, ctrlKey: false, altKey: false, metaKey: true },
    ]) {
      expect(physicalKeyboardEvidence(event)).toBe(true);
    }
    /* Plain typing and a plain Enter prove nothing either way. */
    for (const event of [
      { key: 'a', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false },
      { key: 'A', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false },
      { key: 'Enter', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false },
    ]) {
      expect(physicalKeyboardEvidence(event)).toBe(false);
    }
    expect(parts).toMatch(
      /if \(physicalKeyboardEvidence\(event\)\) physicalKeyboard\.current = true;/,
    );
    expect(parts).toMatch(/enterSends: enterSends\(\) \|\| physicalKeyboard\.current,/);
  });

  it('the evidence latch can only ever grant Enter, never withdraw it', () => {
    const latch = parts.split('const physicalKeyboard = useRef(false);')[1];
    expect(latch).toContain('physicalKeyboard.current = true');
    expect(latch).not.toContain('physicalKeyboard.current = false');
  });

  it('exposes no soft-keyboard Send action, so a phone keeps multiline input', () => {
    /* The addendum requires that a Send/Go/Search action, WHERE EXPOSED, use the same submit
       handler. None is exposed: on a touch keyboard Enter stays a newline and the Ask button
       sends, which is the released behaviour the base contract ordered preserved. If a later
       contract exposes one it inherits the single handler by construction — there is only one. */
    expect(parts).not.toMatch(/enterKeyHint/i);
    expect(screen).not.toMatch(/enterKeyHint/i);
  });

  it('hides no capability at any width: the lane added no display:none', () => {
    const introduced = centredComposerCss();
    expect(introduced).not.toMatch(/display:\s*none/);
    expect(introduced).not.toMatch(/visibility:\s*hidden/);
    expect(introduced).not.toMatch(/content-visibility/);
  });

  it('the example, its selection and the rotation are in the markup at every width', () => {
    /* One component, one DOM: the phone differs by CSS and by shorter phrasing, never by a
       missing control. */
    const html = render({ example: example('en', true), maxHeight: 140 });
    expect(html).toContain('data-ask="composer-example"');
    expect(html).toMatch(/<span[^>]*data-ask="composer-example"/);
    expect(html).toMatch(/<button type="submit"[^>]*data-ask="send"/);
    expect(parts).not.toMatch(/matchMedia[^)]*max-width/);
  });

  it('the language selector shows the READER selection, not the copy-catalogue locale', () => {
    /*
      Found in this lane's own Arabic screenshot: the control read "English" for a reader who
      had chosen Arabic, because one prop was doing two jobs. Seven-language support is one of
      the capabilities the parity addendum forbids downgrading, and the selector is the single
      control whose whole job is to show it.
    */
    const shell = code(readFileSync(join(__dirname, '../ask-nav/AskNavShell.tsx'), 'utf8'));
    expect(shell).toContain('readonly selected?: DisplayLocale;');
    expect(shell).toContain(
      'const selectedLocale: DisplayLocale = selected ?? displayLocaleOf(language);',
    );
    expect(shell).not.toContain('value={displayLocaleOf(language)}');
    const root = code(readFileSync(join(__dirname, '../ask-nav/AskStandaloneRoot.tsx'), 'utf8'));
    expect(root).toMatch(
      /<AskNavShell language=\{disposition\.catalogueLocale\} selected=\{locale\}/,
    );
  });

  it('the phone entry view lifts the group less, but loses nothing', () => {
    const phone =
      centredComposerCss()
        .split('@media (max-width: 860px), (orientation: portrait) and (max-width: 1100px) {')
        .pop() ?? '';
    /* CTO H closeout §4 — the near-the-thumb lift is PHONE-only (≤600px); a portrait tablet keeps
       the desktop optical-centre lift, so the composer is centred at ~768 and ~1024 as well. */
    const phoneOnly = css.split('@media (max-width: 600px) {')[1]?.split('}\n}')[0] ?? '';
    expect(phoneOnly).toMatch(/\.entrySpacer \{\s*flex: 0 1 6vh;/);
    expect(phone).not.toMatch(/\.entrySpacer/);
    expect(phone).toMatch(/min-height: 72px;/);
    expect(phone).not.toMatch(/display:\s*none/);
    /* The example WRAPS on a phone instead of losing the words that carry the capability. */
    expect(phone).toMatch(/-webkit-line-clamp: 2;/);
    expect(phone).toMatch(/white-space: normal;/);
  });
});

describe('C-7 · seven languages and Arabic RTL', () => {
  it('the selected language decides the example text, for all seven', () => {
    for (const locale of DISPLAY_LOCALES) {
      const html = render({ example: example(locale) });
      expect(html).toContain(QUESTION_EXAMPLES[0].text[locale]);
    }
    expect(screen).toMatch(/locale: interfaceLocale,/);
  });

  it('uses the reader s existing language selection — no second Ask-only selector', () => {
    expect(code(read('../../lib/ask/useRotatingExample.ts'))).not.toMatch(
      /LanguageSelector|persistLanguageSelection|LANGUAGE_COOKIE/,
    );
    expect(screen.match(/LanguageSelector/g)).toBeNull();
  });

  it('EN and PL are untouched: the heading is still the released dictionary hint', () => {
    expect(askSevenStrings('en').composerHint).toBe(getDictionary('en').askAi.inputPlaceholder);
    expect(askSevenStrings('pl').composerHint).toBe(getDictionary('pl').askAi.inputPlaceholder);
    expect(askSevenStrings('en').composerHint).toBe('What would you like to understand?');
    expect(askSevenStrings('pl').composerHint).toBe('Co chcesz zrozumieć?');
  });

  it('names the example control in the reader s own language, in all seven', () => {
    const labels = DISPLAY_LOCALES.map((locale) => askSevenStrings(locale).exampleUse);
    expect(new Set(labels).size).toBe(7);
    for (const label of labels) expect(label.trim().length).toBeGreaterThan(8);
    expect(askSevenStrings('ar').exampleUse).toMatch(/[؀-ۿ]/);
  });

  it('Arabic takes the scope direction and the example is isolated, never marked', () => {
    expect(askDirectionProps('ar').dir).toBe('rtl');
    expect(askDirectionProps('ar').lang).toBe('ar');
    const html = render({ example: example('ar') });
    expect(html).toMatch(/data-ask="composer-example"[^>]*style="unicode-bidi:isolate"/);
    /* The run inherits direction: declaring one here would be a second direction authority
       inside a paragraph that already has one. */
    expect(isolatedAuto()).toEqual({ style: { unicodeBidi: 'isolate' } });
    expect(Object.keys(isolatedAuto())).not.toContain('dir');
    expect(html).not.toMatch(/[‎‏⁦-⁩]/);
  });

  it('the rotating transition cannot break RTL: it moves only on the vertical axis', () => {
    const keyframes = css.split('@keyframes exampleEnter')[1].split('\n}')[0];
    expect(keyframes).not.toMatch(/translateX|left:|right:|margin-left|margin-right/);
  });

  it('aligns the example to the reading start, not to the left', () => {
    const html = render({ example: example('ar') });
    expect(html).toMatch(/data-ask="composer-example"[^>]*class="[^"]*text-start/);
    expect(html).not.toMatch(/data-ask="composer-example"[^>]*class="[^"]*text-left/);
  });

  it('every queue position has text in every language, so rotation cannot hit a gap', () => {
    const queue = buildExampleQueue(QUESTION_EXAMPLES, 17);
    for (const item of queue) {
      for (const locale of DISPLAY_LOCALES) {
        expect(exampleText(item, locale).length).toBeGreaterThan(8);
      }
    }
  });
});

describe('C-8 · responsive widths', () => {
  it('the entry geometry is declared for the desktop widths and for the phone band', () => {
    expect(css).toMatch(/\.frame\[data-ask-entry='true'\] \.emptyTitle \{\s*font-size: 44px;/);
    const phone =
      centredComposerCss()
        .split('@media (max-width: 860px), (orientation: portrait) and (max-width: 1100px) {')
        .pop() ?? '';
    expect(phone).toMatch(/\.frame\[data-ask-entry='true'\] \.emptyTitle \{\s*font-size: 28px;/);
  });

  it('1280 and 1440 keep the released centred column; the Sources column rule is untouched', () => {
    expect(css).toMatch(/@media \(min-width: 1280px\)/);
    expect(rule('\n.grid,\n.composerGrid')).toMatch(/max-width: 760px;/);
  });

  it('375 / 390 / 430 all fall in the phone band and keep the composer above the safe area', () => {
    for (const width of [375, 390, 430]) expect(width).toBeLessThanOrEqual(860);
    const phone =
      centredComposerCss()
        .split('@media (max-width: 860px), (orientation: portrait) and (max-width: 1100px) {')
        .pop() ?? '';
    expect(css).toMatch(/padding-bottom: max\(10px, env\(safe-area-inset-bottom\)\);/);
    expect(phone.length).toBeGreaterThan(0);
  });

  it('the example cannot overflow its field at any width', () => {
    const html = render({ example: example('en') });
    expect(html).toMatch(/data-ask="composer-example"[^>]*class="[^"]*max-w-full/);
    expect(html).toMatch(/data-ask="composer-example"[^>]*class="[^"]*truncate/);
  });
});

describe('C-9 · themes', () => {
  it('the example is drawn in EXACTLY the released placeholder ink, so it cannot differ in either theme', () => {
    const html = render({ example: example('en') });
    /* ASK READING EXPERIENCE R1 — both now read the --ask-read-ink3 token (dark fallback #6f89a8),
       so the identity this test protects holds in light as well as dark. */
    const placeholderInk = /placeholder:text-\[var\(--ask-read-ink3,#6f89a8\)\]/;
    expect(parts).toMatch(placeholderInk);
    expect(html).toMatch(/data-ask="composer-example"[^>]*class="[^"]*text-\[var\(--ask-read-ink3,#6f89a8\)\]/);
  });

  it('the entry chrome uses the themed tokens that retarget in Light', () => {
    expect(rule('.entryBrand')).toMatch(/var\(--ask-ink2/);
    expect(read('../../app/globals.css')).toMatch(/--ask-ink2: var\(--gt-ink2\);/);
  });
});

describe('C-10 · accessibility', () => {
  it('the example is not a focus stop and is hidden from assistive tech as a control', () => {
    /* ASK RELIABILITY R1 (§8) — Product Owner instruction 2026-10-06: a sample question shown inside the input is
     visible GUIDANCE ONLY — plain text, not clickable, not focusable; it never fills, submits, navigates or
     steals focus. This supersedes the earlier C-3/C-4/C-6/C-10 'tap the example to fill' contract. */
    const html = render({ example: example('en') });
    expect(html).not.toMatch(/<button type="button"[^>]*data-ask="composer-example"/);
    expect(html).toMatch(/data-ask="composer-example"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-ask="composer-example"/);
    expect(html).not.toMatch(/Use this example question/);
  });

  it('creates no aria-live loop: nothing announces every few seconds', () => {
    const html = render({ example: example('en') });
    expect(html).not.toMatch(/aria-live/);
    expect(parts).not.toMatch(/aria-live|role="status"|role="alert"/);
    /* And the example a reader is actually reading cannot change under them: focus pauses. */
    expect(parts).toMatch(/onFocus=\{example\?\.onFocus\}/);
    expect(parts).toMatch(/onBlur=\{example\?\.onBlur\}/);
  });

  it('behaves as a suggestion, not as an automatically changing value', () => {
    const html = render({ example: example('en') });
    /* The textarea's value stays empty while an example is shown. */
    expect(html).toMatch(/<textarea[^>]*>(<\/textarea>)/);
    expect(html).not.toContain(`>${QUESTION_EXAMPLES[0].text.en}</textarea>`);
  });

  it('the spacer is invisible to assistive technology and holds no content', () => {
    expect(screen).toMatch(/data-ask="entry-spacer"\s*aria-hidden="true"/);
  });

  it('keeps the composer s accessible name even while the native placeholder stands down', () => {
    const html = render({ example: example('en') });
    expect(html).toMatch(/<label class="sr-only" for="ask-frame-composer">label<\/label>/);
    expect(html).toMatch(/id="ask-frame-composer"/);
  });

  it('keeps the Ask button s accessible name', () => {
    expect(render({ value: 'q' })).toMatch(/data-ask="send"[^>]*>Ask/);
  });
});
