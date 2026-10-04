import { readFileSync } from 'fs';
import { join } from 'path';
import { ASK_NAV_EXCLUDED_LABELS, ASK_NAV_EXCLUDED_ROUTES } from '@/lib/askNavModel';

const shell = readFileSync(join(__dirname, 'AskNavShell.tsx'), 'utf-8');
const shellCss = readFileSync(join(__dirname, 'askNav.module.css'), 'utf-8');
const askPage = readFileSync(join(__dirname, '..', '..', 'app', 'ask', 'page.tsx'), 'utf-8');
const wrapper = readFileSync(join(__dirname, 'AskShellFrame.tsx'), 'utf-8');
const contract = readFileSync(
  join(__dirname, '..', '..', 'lib', 'ask', 'askShellMenu.ts'),
  'utf-8',
);
const frameDir = join(__dirname, '..', 'ask-frame');
const frame = readFileSync(join(frameDir, 'AskFrameScreen.tsx'), 'utf-8');
const frameCss = readFileSync(join(frameDir, 'askDashboard.module.css'), 'utf-8');
const navBar = readFileSync(join(__dirname, '..', 'navigation', 'NavBar.tsx'), 'utf-8');

/** The z-index declared in the LAST occurrence of a selector's block. */
function zIndexIn(css: string, selector: string): number {
  const start = css.lastIndexOf(selector);
  if (start === -1) return Number.NaN;
  const block = css.slice(start, css.indexOf('}', start));
  const match = /z-index:\s*(\d+)/.exec(block);
  return match?.[1] === undefined ? Number.NaN : Number(match[1]);
}

/** The first media query text in a stylesheet, normalised to one space. */
function firstMediaQuery(css: string): string {
  const match = /@media[^{]+/.exec(css);
  return (match?.[0] ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE STANDALONE ASK SHELL — THE PROPERTIES THAT MAKE IT SAFE ON A PHONE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Everything here is a REAL coupling, not a style preference. The shell sits
 * above a frozen D25 surface that goes full screen and fixed at z-60 on a phone,
 * so a wrong height causes a visible resize on hydration and a wrong z-index or
 * a missed breakpoint causes a keyboard trap behind an opaque layer. Each case
 * below fails if one half of such a pair moves without the other.
 */
describe('ASK SHELL — the D25 geometry it must not disturb', () => {
  /**
   * askDashboard.module.css computes the frame height as
   * `calc(var(--ask-visible-height,100dvh) - var(--ask-top,62px))`. `--ask-top`
   * is measured at runtime, so the FALLBACK is what the first paint uses: a bar
   * of any other height makes the Ask surface resize on hydration.
   */
  /**
   * PR #66 REPLACED THE MECHANISM THIS SHELL ONCE HAD TO MATCH. The composer
   * clipping fix deleted `--ask-top` and made the route a viewport-high flex
   * column, so the frame takes the height the header leaves BY CONSTRUCTION.
   * These cases pin the column, because the shell's correctness now rests on it
   * rather than on a measured constant.
   */
  it('the route is still PR #66s one viewport-high column, and the frame still flexes into it', () => {
    expect(frameCss).toMatch(/\.page \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/);
    expect(frameCss).toContain('.page > :global(header)');
    expect(frameCss).toMatch(/\.page > :global\(header\) \{\s*flex-shrink: 0;/);
    expect(frameCss).toMatch(/\.frame \{[\s\S]*?flex: 1 1 0;[\s\S]*?min-height: 0;/);
    /* TRUST R1 — the column element is rendered by AskThemedPage (also the theme scope). */
    expect(askPage).toContain('<AskThemedPage theme={theme}>');
    expect(askPage).toContain('min-h-0 flex-1');
  });

  it('the measured --ask-top is gone, and the keyboard-aware height is NOT', () => {
    /* Restoring either would undo a shipped fix. */
    expect(frameCss).not.toContain('--ask-top');
    expect(frame).not.toContain('--ask-top');
    expect(frame).toContain("'--ask-visible-height'");
    expect(frameCss).toContain('var(--ask-visible-height, 100dvh)');
  });

  it('the bar is a <header> and a DIRECT child of the column, or flex-shrink never applies', () => {
    expect(shell).toContain('<header');
    expect(shell).toContain('h-[62px]');
    /* Nothing may wrap it: a provider element or a div here would break the rule. */
    const rendered = askPage.slice(askPage.indexOf('return ('));
    /* TRUST R1 — the column is rendered by AskThemedPage (the same styles.page element, now also
       the theme scope); the header is still its direct child. */
    expect(rendered).toMatch(/<AskThemedPage theme=\{theme\}>\s*<AskNavProvider>\s*<AskNavShell/);
    expect(readFileSync(join(__dirname, 'AskThemedPage.tsx'), 'utf-8')).toMatch(
      /className=\{styles\.page\}/,
    );
    expect(wrapper).not.toMatch(/return \(\s*<div/);
  });

  it('the phone header D25 draws is unchanged: 56 tall, back/close and source count intact', () => {
    expect(frameCss).toMatch(/\.phoneHeader\s*\{[\s\S]*?height:\s*56px/);
    expect(frameCss).toMatch(/\.phoneStrip\s*\{[\s\S]*?height:\s*44px/);
    expect(frame).toContain("data-ask={returnsToMap ? 'back' : 'close'}");
    expect(frame).toContain('data-ask="header-state"');
    expect(frame).toContain('{r2s.askTitle}');
  });

  /**
   * THE GENERIC SLOT IS GONE. CTO refused `navSlot?: React.ReactNode` because it
   * lets any caller render any tree into a frozen D25 header. These cases make
   * its return a test failure, not a review catch.
   */
  it('the frame exposes a NARROW typed control and no generic node slot', () => {
    /*
      THE DECLARATION, NOT THE WORD. The frame's own comment names
      `navSlot?: React.ReactNode` deliberately — it is the record of what was
      refused and why — so these match a prop declaration rather than a mention.
    */
    expect(frame).not.toMatch(/readonly navSlot/);
    expect(frame).not.toMatch(/readonly \w+\??: React\.ReactNode/);
    expect(frame).not.toContain('{navSlot}');
    expect(frame).toMatch(/readonly shellMenu\?: AskShellMenuControl;/);
    expect(contract).toContain('readonly open: boolean;');
    expect(contract).toContain('readonly onToggle: () => void;');
    /* Again the declaration, not the word: the contract documents what it replaced. */
    expect(contract).not.toMatch(/readonly \w+\??:[^\n]*ReactNode/);
    expect(contract).not.toMatch(/readonly \w+\??:[^\n]*JSX\.Element/);
  });

  it('the trigger REPLACES the left control and only without a governed return', () => {
    expect(frame).toContain('returnPath === null && shellMenu !== undefined ?');
    expect(frame).toContain('data-ask="shell-menu"');
    /* The ruled Back/Close survives untouched on the other branch. */
    expect(frame).toContain("data-ask={returnsToMap ? 'back' : 'close'}");
    expect(frame).toContain('aria-label={returnsToMap ? r2s.returnMap : r2s.close}');
    expect(frame).toContain("{returnsToMap ? '←' : '×'}");
  });

  it('the header still holds exactly three slots, centred title intact', () => {
    const header = frame.slice(frame.indexOf('className={styles.phoneHeader}'));
    const inside = header.slice(0, header.indexOf('</header>'));
    expect(inside).toContain('flex-1 truncate text-center');
    expect(inside).toContain('data-ask="header-state"');
    /* One left control rendered, whichever branch wins — never both. */
    expect(inside.match(/min-h-11 min-w-11/g) ?? []).toHaveLength(2);
    expect(inside).toContain('{r2s.askTitle}');
  });

  it('one state drives both mount points, and the wrapper adds no DOM', () => {
    expect(wrapper).toContain('useAskNav()');
    expect(wrapper).toContain('shellMenu={{');
    expect(wrapper).toContain('openLabel: strings.openMenuAriaLabel');
    expect(wrapper).toContain('closeLabel: strings.closeMenuAriaLabel');
  });

  /**
   * PR #66 BEHAVIOUR THIS SHELL MUST NOT DISTURB. The shell replaces a header;
   * it has no business touching the signed-out contract, and these prove it did
   * not while reapplying onto the new base.
   */
  it('preserves the #66 signed-out closure end to end', () => {
    expect(frame).toContain('data-ask="sign-in-required"');
    expect(frame).toContain("else if (outcome === 'signed-out') setQuestion(draft);");
    expect(frame).toContain('keepQuestion(');
    expect(frame).toContain('readKeptQuestion()');
    expect(frame).toContain('ASK_SIGN_IN_HREF');
    expect(frame).toContain('r2.signInRequired !== null');
  });
});

describe('ASK SHELL — one session read, zero compute', () => {
  it('calls useAccount exactly once, so the request count on /ask does not rise', () => {
    expect(shell.match(/useAccount\(\)/g)).toHaveLength(1);
  });

  it('touches no compute or analysis path', () => {
    for (const forbidden of [
      '/analysis',
      'ask-v2',
      'askV2Api',
      'analysisApi',
      'dashboardContext',
    ]) {
      expect(shell).not.toContain(forbidden);
    }
    /*
      The shell issues no fetch of its own AT ALL. Its single network call is
      inside useAccount, which is why this asserts the absence of fetch here
      rather than counting requests in a source file.
    */
    expect(shell).not.toContain('fetch(');
    /*
      `@/components/search/LanguageSelector` is the ONE path in this file that
      contains the substring "/search". It is the released language control's
      module path — the control NavBar uses, reused rather than reimplemented —
      not the /search route and not a search request. Asserted explicitly so a
      blunter rule cannot be added later and "fixed" by forking that component.
    */
    const searchMentions = shell.match(/\/search/g) ?? [];
    expect(searchMentions).toHaveLength(1);
    expect(shell).toContain("from '@/components/search/LanguageSelector'");
  });

  it('re-selecting the current language is a no-op, so it cannot cost a reload', () => {
    /*
      MOVED, NOT RELAXED. The guard now compares against `selectedLocale` — the reader's own
      selection — rather than against the two-locale catalogue index, because the selector
      used to display "English" to a reader who had chosen Arabic. The property this test
      protects (re-selecting costs no reload) is unchanged, and it is now correct for all
      seven rather than only for the two.
    */
    expect(shell).toContain('if (next === selectedLocale) return;');
    expect(shell).toContain(
      'const selectedLocale: DisplayLocale = selected ?? displayLocaleOf(language);',
    );
    expect(shell).toContain('value={selectedLocale}');
  });
});

describe('ASK SHELL — /ask no longer renders the platform header', () => {
  it('the route imports the Ask shell and not NavBar', () => {
    expect(askPage).toContain("from '@/components/ask-nav/AskNavShell'");
    /*
      The IMPORT and the ELEMENT are what matter. The file's comment names
      `<NavBar />` on purpose — it is the record of what was removed and why —
      so this asserts the wiring is gone, not that the word is unmentioned.
    */
    expect(askPage).not.toMatch(/import\s*\{[^}]*\bNavBar\b[^}]*\}/);
    const rendered = askPage.slice(askPage.indexOf('return ('));
    expect(rendered).not.toContain('NavBar');
    expect(rendered).not.toContain('MobileBottomNav');
  });

  it('the trigger is passed into the frame so one state serves both mount points', () => {
    expect(askPage).toContain('<AskNavProvider>');
    expect(askPage).toContain('<AskShellFrame locale={locale} />');
    expect(askPage).not.toContain('AskNavPhoneTrigger');
  });

  it('NavBar is untouched by this lane — it still serves every other route', () => {
    expect(navBar).not.toContain('ask-nav');
    expect(navBar).not.toContain('AskNavShell');
  });
});

describe('ASK SHELL — no dead controls, no excluded destination', () => {
  it('renders none of the nineteen excluded labels', () => {
    for (const excluded of ASK_NAV_EXCLUDED_LABELS) {
      expect(shell).not.toContain(`>${excluded}<`);
    }
  });

  it('hard-codes no href at all, excluded or otherwise — every destination comes from the model', () => {
    for (const excluded of ASK_NAV_EXCLUDED_ROUTES) {
      expect(shell).not.toContain(`href="${excluded}"`);
    }
    expect(shell).toContain("href={entry.href ?? '/ask'}");
  });

  it('uses no opacity-based disabling — the defect this round removed', () => {
    expect(shell).not.toContain('opacity-60');
    expect(shell).not.toContain('aria-disabled');
    /*
      An attribute, not the word. `button:not([disabled])` appears in the
      focusable-node selector used by the Tab containment, and that is a reader
      of other elements' state rather than a disabled control of our own.
    */
    expect(shell).not.toMatch(/\sdisabled[=\s/>]/);
    expect(shell).toContain('button:not([disabled])');
  });

  /**
   * R4 HEADER ACCOUNT PRIVACY, held from this side too.
   *
   * headerAccountPrivacy.spec.ts pins the set of files that may render an
   * account address CLOSED at two. An earlier draft of this shell printed
   * "Signed in as <address>" in both the desktop disclosure and the drawer, and
   * that test caught it as a third file. The address was never in the Product
   * Owner's ruled set, so it was removed rather than the pin widened. This case
   * is the local guard, so the row cannot come back by edit without a failure
   * here as well as there.
   */
  it('renders no account address anywhere — the R4 pin stays closed at two files', () => {
    expect(shell).not.toContain('user.email');
    expect(shell).not.toContain('signedInAs');
    expect(shell).not.toMatch(/\.email/);
  });

  it('the wordmark is identity, not a duplicate control', () => {
    expect(shell).toContain('{askProductName(language)}');
    expect(shell).not.toMatch(/<Link[^>]*>\s*\{askProductName/);
  });
});

describe('ASK SHELL — the keyboard contract, because the drawer covers a live surface', () => {
  it('Escape closes the drawer', () => {
    expect(shell).toContain("if (event.key === 'Escape') {");
    expect(shell).toContain('setOpen(false);');
  });

  it('Tab is contained, so focus cannot land on the covered composer', () => {
    expect(shell).toContain("if (event.key !== 'Tab'");
    expect(shell).toContain('event.preventDefault();');
    expect(shell).toContain('first.focus();');
    expect(shell).toContain('last.focus();');
  });

  it('the drawer is a labelled modal dialog and the trigger reports its state', () => {
    expect(shell).toContain('role="dialog"');
    expect(shell).toContain('aria-modal="true"');
    expect(frame).toContain('aria-expanded={shellMenu.open}');
    expect(frame).toContain(
      'aria-label={shellMenu.open ? shellMenu.closeLabel : shellMenu.openLabel}',
    );
  });

  it('closing returns focus to the trigger that opened it', () => {
    expect(shell).toContain(
      'document.querySelector<HTMLElement>(\'[data-ask="shell-menu"]\')?.focus()',
    );
    expect(shell).toContain('wasOpen.current');
  });

  it('every control clears the 44px touch minimum', () => {
    expect(shell).toContain('min-h-11');
    expect(shellCss).toContain('height: 56px');
  });
});

/*
  STANDALONE PUBLIC BETA CONVERGENCE R1 — the desktop account control is a DISCLOSURE. An ARIA
  menu promises arrow-key roving focus, typeahead and Home/End; without them role="menu" is a
  false promise to a screen-reader user. A button that expands a region is the honest shape.
*/
describe('account control — disclosure semantics, not an unimplemented ARIA menu', () => {
  const code = shell.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  it('no role="menu", role="menuitem" or aria-haspopup="menu" anywhere in the shell', () => {
    expect(code).not.toMatch(/role="menu"|role="menuitem"|aria-haspopup="menu"/);
  });
  it('the toggle controls the panel it expands (aria-expanded + aria-controls → id)', () => {
    expect(code).toMatch(/aria-expanded=\{accountOpen\}\s+aria-controls="ask-nav-account-panel"/);
    expect(code).toMatch(/id="ask-nav-account-panel"/);
  });
  it('the drawer keeps its dialog semantics (focus containment is untouched)', () => {
    expect(code).toMatch(/role="dialog"\s+aria-modal="true"/);
  });
});
