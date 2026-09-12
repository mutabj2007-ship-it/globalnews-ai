import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

const accountControlSource = readFileSync(join(__dirname, 'AccountControl.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');

/**
 * R4 LAUNCH-PREP — HEADER ACCOUNT PRIVACY.
 *
 * An authenticated visitor's full email address was rendered as the visible
 * text of the account control in the public header, permanently, on every one
 * of the nine surfaces that mount <NavBar>, in both the desktop and the mobile
 * presentation, with no interaction required to reveal it.
 *
 * THE CONTRACT THIS SUITE MAKES PERMANENT:
 *   signed out             -> Sign In. No email, no account identifier.
 *   signed in, CLOSED      -> a neutral, constant label. No email, no display
 *                             name, no email-derived initials, and nothing
 *                             about the account in aria-label, title or any
 *                             data-* attribute.
 *   signed in, OPEN        -> the caller's OWN email, exactly once, inside the
 *                             conditionally-rendered surface.
 *
 * It is a SOURCE-STRING suite, the convention this lane already uses
 * (headerSourcePort.spec.ts, supportDiscoverability.spec.ts): no jsdom, no
 * RTL. The runtime half of the proof is the hydrating browser harness recorded
 * in the delivery report.
 */

/**
 * Strips comments before asserting. Every negative assertion below needs it:
 * the corrected component necessarily documents the disclosure it removed, and
 * a guard that fails on the explanation while the code is correct is a guard
 * that punishes documentation. Same helper, same reason, as
 * headerSourcePort.spec.ts.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** The JSX of the signed-in return, i.e. everything from the trigger onward. */
function signedInBranch(source: string): string {
  const code = codeOnly(source);
  const start = code.indexOf('<div className="relative"');
  expect(start).toBeGreaterThan(-1);
  return code.slice(start);
}

/** The closed-state markup: the signed-in return MINUS the conditional popup. */
function closedTriggerMarkup(source: string): string {
  const branch = signedInBranch(source);
  const popupAt = branch.indexOf('{menuOpen && (');
  expect(popupAt).toBeGreaterThan(-1);
  return branch.slice(0, popupAt);
}

describe('R4 header privacy — A/B: the CLOSED authenticated header discloses nothing', () => {
  it('A — the closed trigger renders no email', () => {
    const closed = closedTriggerMarkup(accountControlSource);
    expect(closed).not.toMatch(/\.email/);
    expect(closed).not.toContain('@');
  });

  it('B — the closed trigger renders no display name, and none is read anywhere', () => {
    expect(closedTriggerMarkup(accountControlSource)).not.toMatch(/displayName/);
    // CTO amendment 1: a future backend populating displayName must not turn
    // the public header into a real-name disclosure surface. The component
    // therefore never reads the field at all.
    expect(codeOnly(accountControlSource)).not.toMatch(/displayName/);
  });

  it('B — the label is a constant prop, never derived from the account', () => {
    const closed = closedTriggerMarkup(accountControlSource);
    expect(closed).toContain('{accountLabel}');
    // No slicing, splitting, charAt, initials or case-mangling of any identity.
    for (const derivation of [/\.split\(/, /\.slice\(/, /charAt\(/, /toUpperCase\(/, /initial/i]) {
      expect(closed).not.toMatch(derivation);
    }
    // CTO amendment 1 — the helper proposed in Phase 1 was declined.
    expect(() => statSync(join(__dirname, 'accountLabel.ts'))).toThrow();
  });

  it('B — the neutral label is localized, never a hardcoded literal', () => {
    const code = codeOnly(accountControlSource);
    expect(code).not.toMatch(/>\s*Account\s*</);
    expect(code).not.toMatch(/>\s*Konto\s*</);
    expect(navBarSource).toContain('accountLabel={t.account}');
  });
});

describe('R4 header privacy — C/D: the email is reachable ONLY by deliberate interaction', () => {
  it('C — the email is rendered exactly once in the component', () => {
    expect((codeOnly(accountControlSource).match(/user\.email/g) ?? []).length).toBe(1);
  });

  it('C — that one render sits inside the menuOpen-conditional branch', () => {
    const code = codeOnly(accountControlSource);
    const popupAt = code.indexOf('{menuOpen && (');
    const emailAt = code.indexOf('user.email');
    expect(popupAt).toBeGreaterThan(-1);
    expect(emailAt).toBeGreaterThan(popupAt);
    // ...and the popup is CONDITIONALLY RENDERED, not merely hidden with CSS,
    // so no persistent DOM carries the address while the control is closed.
    expect(code).not.toMatch(/hidden[^"]*"[^>]*\{user\.email\}/);
  });

  it('D — the email appears in no aria-label, title, alt, placeholder or data-* attribute', () => {
    const code = codeOnly(accountControlSource);
    for (const attribute of [
      /aria-label=\{[^}]*email/,
      /title=\{[^}]*email/,
      /alt=\{[^}]*email/,
      /placeholder=\{[^}]*email/,
      /data-[a-z-]+=\{[^}]*email/,
    ]) {
      expect(code).not.toMatch(attribute);
    }
    // The trigger's accessible name is the localized constant, nothing else.
    expect(closedTriggerMarkup(accountControlSource)).toContain('aria-label={accountMenuAriaLabel}');
  });

  it('D — the identity row is non-interactive, so it joins no action sequence', () => {
    const code = codeOnly(accountControlSource);
    const emailAt = code.indexOf('user.email');
    const rowStart = code.lastIndexOf('<p ', emailAt);
    expect(rowStart).toBeGreaterThan(-1);
    const row = code.slice(rowStart, code.indexOf('</p>', emailAt));
    expect(row).not.toMatch(/onClick|href=|tabIndex|<button|<a\s/);
  });

  it('TREE-WIDE — exactly one file in the frontend renders an account email', () => {
    const roots = [join(__dirname, '../..', 'components'), join(__dirname, '../..', 'app')];
    const offenders: string[] = [];

    function walk(directory: string): void {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith('.tsx') || entry.name.includes('.spec.')) continue;
        if (/\{\s*(user|account|me)\.email\s*\}/.test(codeOnly(readFileSync(path, 'utf-8')))) {
          // Relative path, not the bare filename: 'page.tsx' alone would let
          // ANY route start rendering an address without this guard noticing.
          offenders.push(path.slice(path.indexOf(`${sep}src${sep}`) + 5).split(sep).join('/'));
        }
      }
    }

    for (const root of roots) walk(root);
    /*
      ACCOUNT DESTRUCTIVE-ACTION SAFETY amends this R4 pin from ONE file to
      exactly TWO, and states plainly why the second is not a regression.

      The R4 defect was an address rendered in the PUBLIC HEADER of all nine
      NavBar surfaces with no interaction required. The second file here is
      /account/settings, a route a signed-in caller navigates to deliberately,
      which renders that caller's OWN address once, from the same guarded
      per-caller GET /users/me, because the deletion gate requires them to type
      it back exactly. The header's closed trigger still discloses nothing, and
      the list is still CLOSED: any third file fails this test.
    */
    expect(offenders.sort()).toEqual([
      'app/account/settings/page.tsx',
      'components/navigation/AccountControl.tsx',
    ]);
  });
});

describe('R4 header privacy — E: the signed-out and loading branches are untouched', () => {
  it('E — signed out is still Sign In and a real navigation to the consent screen', () => {
    const code = codeOnly(accountControlSource);
    const start = code.indexOf('if (!user) {');
    const end = code.indexOf('}', code.indexOf('</a>', start));
    expect(start).toBeGreaterThan(-1);
    const branch = code.slice(start, end);
    expect(branch).toContain('{signInLabel}');
    /*
      M-ALPHA-AUTH — this assertion's CONTRACT changed, so the assertion was
      updated rather than deleted. It previously pinned
      `${API_BASE_URL}/auth/google`, i.e. a navigation to the BACKEND's own
      origin. That cross-origin shape is exactly what made the session cookie
      cross-site and unusable, and CTO requirement 8 replaces it across all five
      sign-in entry points with the shared first-party helper.

      What this test was actually protecting is unchanged and still asserted
      below: the signed-out branch is a real navigation (an <a href>, not a
      fetch), it carries no account identifier, and it keeps the released
      className. Only the URL it must contain has moved.
    */
    expect(branch).toContain('accountSignInUrl(');
    expect(branch).not.toContain('${API_BASE_URL}/auth/google');
    expect(branch).toContain('className={signInClassName}');
    // No identifier of any kind reaches a signed-out visitor.
    expect(branch).not.toMatch(/email|displayName|accountLabel|signedInAsLabel/);
  });

  it('E — the loading placeholder is still an aria-hidden empty span', () => {
    expect(codeOnly(accountControlSource)).toMatch(
      /if \(isLoading\) \{\s*return <span className=\{signInClassName\} aria-hidden="true" \/>;/,
    );
  });
});

describe('R4 header privacy — F: EN/PL parity of the three new strings', () => {
  const en = getDictionary('en').navBar;
  const pl = getDictionary('pl').navBar;

  it('F — every new key exists and is non-empty in both dictionaries', () => {
    for (const key of ['account', 'accountMenuAriaLabel', 'signedInAs'] as const) {
      expect(typeof en[key]).toBe('string');
      expect(en[key].length).toBeGreaterThan(0);
      expect(typeof pl[key]).toBe('string');
      expect(pl[key].length).toBeGreaterThan(0);
    }
  });

  it('F — the approved English and Polish wording, exactly', () => {
    expect(en.account).toBe('Account');
    expect(pl.account).toBe('Konto');
    expect(en.accountMenuAriaLabel).toBe('Account menu');
    expect(pl.accountMenuAriaLabel).toBe('Menu konta');
    expect(en.signedInAs).toBe('Signed in as');
    expect(pl.signedInAs).toBe('Zalogowano jako');
  });

  it('F — Polish is a real translation, not a copy of English', () => {
    for (const key of ['account', 'accountMenuAriaLabel', 'signedInAs'] as const) {
      expect(pl[key]).not.toBe(en[key]);
    }
  });

  it('F — no new label leaks an identifier-shaped default', () => {
    for (const value of [en.account, pl.account, en.accountMenuAriaLabel, pl.accountMenuAriaLabel]) {
      expect(value).not.toContain('@');
    }
  });
});

describe('R4 header privacy — G: both call sites receive the new labels', () => {
  it('G — there are still exactly two AccountControl instances', () => {
    expect((navBarSource.match(/<AccountControl/g) ?? []).length).toBe(2);
  });

  it('G — desktop AND mobile each pass all three new props from the dictionary', () => {
    for (const pair of [
      'accountLabel={t.account}',
      'accountMenuAriaLabel={t.accountMenuAriaLabel}',
      'signedInAsLabel={t.signedInAs}',
    ]) {
      expect((navBarSource.split(pair).length - 1)).toBe(2);
    }
  });

  it('G — the pre-existing props are all still passed twice as well', () => {
    for (const pair of [
      'signInLabel={t.signIn}',
      'historyLabel={t.history}',
      'supportLabel={t.support}',
      'signOutLabel={t.signOut}',
      /*
        ACCOUNT DESTRUCTIVE-ACTION SAFETY: 'deleteAccountLabel={t.deleteAccount}'
        and 'deleteAccountConfirmLabel={t.deleteAccountConfirm}' stood here.
        They fed a destructive action that no longer exists in this popup. The
        navigational entry that replaced it is asserted in their place, still
        twice, so the desktop/mobile symmetry this pin protects is unchanged.
      */
      'settingsLabel={t.settings}',
    ]) {
      expect((navBarSource.split(pair).length - 1)).toBe(2);
    }
  });
});

describe('R4 header privacy — H/I: the popup is operable and cleans up after itself', () => {
  const code = codeOnly(accountControlSource);

  it('H — the trigger declares the popup it owns, against a unique id', () => {
    expect(code).toContain('aria-expanded={menuOpen}');
    expect(code).toContain('aria-controls={menuId}');
    expect(code).toContain('const menuId = useId();');
    expect(code).toMatch(/id=\{menuId\}/);
  });

  it('H — Escape closes the popup and returns focus to the trigger', () => {
    expect(code).toMatch(/event\.key !== 'Escape'/);
    const escapeAt = code.indexOf("event.key !== 'Escape'");
    const block = code.slice(escapeAt, escapeAt + 400);
    expect(block).toContain('setMenuOpen(false)');
    expect(block).toMatch(/triggerRef\.current\?\.focus\(\)/);
  });

  it('I — an outside pointerdown closes it, and every listener is removed', () => {
    expect(code).toContain("document.addEventListener('pointerdown'");
    expect(code).toContain("document.removeEventListener('pointerdown'");
    expect(code).toContain("document.addEventListener('keydown', handleKeyDown, true)");
    expect(code).toContain("document.removeEventListener('keydown', handleKeyDown, true)");
    // Capture phase + stopPropagation, so Escape dismisses THIS popup and
    // leaves NavBar's full-screen mobile menu — which it is nested inside —
    // open, without NavBar being modified.
    expect(code).toContain('event.stopPropagation();');
    // Registered only while open: the effect bails out when closed.
    expect(code).toMatch(/if \(!menuOpen\) \{\s*return;\s*\}/);
    expect(code).toMatch(/\}, \[menuOpen\]\);/);
  });

  it('I — native anchor/button semantics are kept; no partial ARIA menu model', () => {
    expect(code).not.toMatch(/role="menu"/);
    expect(code).not.toMatch(/role="menuitem"/);
    expect(code).toMatch(/<Link href="\/history"/);
    expect(code).toMatch(/<Link href="\/support"/);
    /*
      ACCOUNT DESTRUCTIVE-ACTION SAFETY: three real buttons became two. The
      removed one is the destructive Delete Account control; the trigger and
      Sign Out remain. History, Support and the new Settings entry are all
      <Link>s, so this count is still the whole button surface of the popup.
    */
    expect((code.match(/type="button"/g) ?? []).length).toBe(2);
    expect(code).toMatch(/<Link href="\/account\/settings"/);
  });
});

describe('R4 header privacy — J/K/L: nothing else about the header moved', () => {
  it('J — the released desktop signInClassName is byte-identical (GN-CD-027 / ERRATUM-009)', () => {
    expect(navBarSource).toContain(
      'signInClassName="rounded-[9px] border border-cd-edge-emphasis-50 bg-gradient-to-b from-[rgba(37,99,235,0.95)] to-[rgba(29,78,216,0.95)] px-5 py-[9px] font-cd-body text-cd-signin text-cd-ink-signin shadow-[0_0_22px_rgba(37,99,235,0.35)] transition-opacity hover:opacity-90"',
    );
  });

  it('J — the released mobile signInClassName is byte-identical', () => {
    expect(navBarSource).toContain(
      'signInClassName="mt-4 w-full rounded-[9px] border border-[rgba(56,189,248,0.5)] bg-gradient-to-b from-[rgba(37,99,235,0.95)] to-[rgba(29,78,216,0.95)] px-5 py-3 text-center text-sm font-semibold text-[#eaf6ff]"',
    );
  });

  it('J — CTO decision D4 survives: ONE class string across all three states', () => {
    expect((codeOnly(accountControlSource).match(/className=\{signInClassName\}/g) ?? []).length).toBe(3);
  });

  it('J — the 62px desktop row and the 52px mobile bar are unchanged', () => {
    expect(navBarSource).toContain('h-[62px]');
    expect(navBarSource).toMatch(/h-\[52px\] items-center gap-3/);
  });

  it('K — the ordering is History, Support, Settings, Sign Out — the three kept entries hold their relative order and Sign Out is last', () => {
    const code = codeOnly(accountControlSource);
    const positions = [
      code.indexOf('href="/history"'),
      code.indexOf('href="/support"'),
      code.indexOf('href="/account/settings"'),
      code.indexOf('{signOutLabel}'),
    ];
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // The identity row sits ABOVE them all, so no existing entry moved
    // relative to any other.
    expect(code.indexOf('user.email')).toBeLessThan(positions[0]);
  });

  it('K — the quick menu contains NO destructive action at all, so it needs no confirmation gate', () => {
    /*
      This pin used to assert `window.confirm(deleteAccountConfirmLabel)` here.
      The Product Owner ruling removes the destructive action from this popup
      rather than hardening its dialog, so the gate is asserted where the
      action now lives (deleteAccountDangerZone.spec.ts) and this file asserts
      the ABSENCE, which is the actual safety property.
    */
    const code = codeOnly(accountControlSource);
    expect(code).not.toContain('window.confirm');
    expect(code).not.toContain('deleteAccount');
    expect(code).not.toMatch(/method:\s*'DELETE'/);
  });

  it('L — a long address cannot expand the popup beyond its intended bounds', () => {
    const code = codeOnly(accountControlSource);
    const popup = code.slice(code.indexOf('{menuOpen && ('));
    expect(popup).toContain('min-w-[10rem]');
    expect(popup).toContain('max-w-[16rem]');
    // The address itself truncates rather than pushing the surface wider, and
    // its row may shrink inside the flex column.
    const emailRow = popup.slice(popup.lastIndexOf('<p ', popup.indexOf('user.email')), popup.indexOf('user.email'));
    expect(emailRow).toContain('min-w-0');
    expect(popup).toMatch(/className="block truncate[^"]*">\{user\.email\}/);
  });
});
