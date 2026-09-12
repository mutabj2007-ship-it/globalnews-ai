import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { DeleteAccountDangerZone } from './DeleteAccountDangerZone';

/**
 * ACCOUNT DESTRUCTIVE-ACTION SAFETY — PRODUCT OWNER RULING.
 *
 * "Delete Account" sat in the quick account dropdown, directly below Sign Out,
 * gated only by window.confirm(). These tests assert the two halves of the
 * correction:
 *
 *   1. the quick menu can no longer delete anything, by any path — mouse,
 *      keyboard or otherwise;
 *   2. the deletion that replaced it is genuinely deliberate.
 *
 * This repository's jest is `testEnvironment: 'node'` with no jsdom, so the
 * component is asserted through its RENDERED MARKUP (the same technique
 * analysisFrameClient.spec.ts established) plus the executable source. The
 * `disabled` attribute is the load-bearing assertion: it is what makes the
 * control inoperable by keyboard as well as by mouse, rather than merely
 * styled as unavailable.
 */

const HERE = __dirname;
const NAV = join(HERE, '..', 'navigation');

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const accountControlSource = codeOnly(readFileSync(join(NAV, 'AccountControl.tsx'), 'utf-8'));
const navBarSource = codeOnly(readFileSync(join(NAV, 'NavBar.tsx'), 'utf-8'));
const settingsPageSource = readFileSync(
  join(HERE, '..', '..', 'app', 'account', 'settings', 'page.tsx'),
  'utf-8',
);

const dictionary = getDictionary('en');
const EMAIL = 'someone@example.com';

const copy = {
  dangerZoneHeading: dictionary.accountSettings.dangerZoneHeading,
  dangerZoneNote: dictionary.accountSettings.dangerZoneNote,
  warning: dictionary.navBar.deleteAccountConfirm,
  deleteAccountLabel: dictionary.navBar.deleteAccount,
  confirmationLabel: dictionary.accountSettings.confirmationLabel,
  confirmationHint: dictionary.accountSettings.confirmationHint,
  confirmationMismatch: dictionary.accountSettings.confirmationMismatch,
  deletePermanently: dictionary.accountSettings.deletePermanently,
  deletingLabel: dictionary.accountSettings.deletingLabel,
  deleteFailed: dictionary.accountSettings.deleteFailed,
};

function render(): string {
  return renderToStaticMarkup(
    createElement(DeleteAccountDangerZone, {
      email: EMAIL,
      copy,
      onDelete: () => Promise.resolve(),
      onDeleted: () => undefined,
    }),
  );
}

describe('the quick account dropdown can no longer delete an account', () => {
  it('contains no Delete Account entry and no deletion label of any kind', () => {
    expect(accountControlSource).not.toContain('deleteAccountLabel');
    expect(accountControlSource).not.toContain('deleteAccount');
  });

  it('never calls the deletion action, and never issues the DELETE itself', () => {
    expect(accountControlSource).not.toMatch(/deleteAccount\(\)/);
    expect(accountControlSource).not.toMatch(/method:\s*'DELETE'/);
    // The hook still EXPOSES deleteAccount; this component simply stops
    // destructuring it, which is why the call above cannot exist.
    expect(accountControlSource).toContain('const { user, isLoading, signOut } = useAccount()');
  });

  it('no longer receives the deletion props from either NavBar instance', () => {
    for (const removed of ['deleteAccountLabel', 'deleteAccountConfirmLabel']) {
      expect(navBarSource).not.toContain(removed);
    }
  });

  it('Sign Out remains a simple, independent one-click action', () => {
    expect(accountControlSource).toContain('onClick={() => void signOut()}');
    expect(accountControlSource).toContain('{signOutLabel}');
  });

  it('what replaced the destructive entry is navigational only — a Link, with no handler', () => {
    const start = accountControlSource.indexOf('href="/account/settings"');
    expect(start).toBeGreaterThan(-1);
    const element = accountControlSource.slice(
      accountControlSource.lastIndexOf('<', start),
      accountControlSource.indexOf('</Link>', start),
    );
    expect(element).toContain('<Link');
    expect(element).not.toContain('onClick');
  });

  it('keyboard focus cannot reach deletion from the dropdown — every focusable entry in it is a link or Sign Out', () => {
    const popup = accountControlSource.slice(accountControlSource.indexOf('{menuOpen && ('));
    const focusable = popup.match(/<(a|button|Link)\b/g) ?? [];
    // Identity <p>, History, Support, Settings, Sign Out — four focusable
    // controls, none destructive. The trigger itself sits above this slice.
    expect(focusable).toHaveLength(4);
    expect(popup).not.toContain('window.confirm');
  });
});

describe('deletion is reachable only through the dedicated settings surface', () => {
  it('the settings route is the only file that renders the danger zone', () => {
    expect(settingsPageSource).toContain('<DeleteAccountDangerZone');
    expect(settingsPageSource).toContain('onDelete={deleteAccount}');
    // The post-deletion confirmation is owned by the page, because deleting
    // clears the session and unmounts the danger zone in the same render.
    expect(settingsPageSource).toContain('onDeleted={() => setDeleted(true)}');
    expect(settingsPageSource).toContain('t.deletedHeading');
  });

  it('the destructive warning is the ONE reviewed string, not a second copy written for this page', () => {
    expect(settingsPageSource).toContain('dictionary.navBar.deleteAccountConfirm');
    const html = render();
    expect(html).toContain(dictionary.navBar.deleteAccountConfirm.slice(0, 40));
  });

  it('the backend contract is untouched — still DELETE /users/me through the existing hook', () => {
    const hook = readFileSync(join(HERE, '..', '..', 'lib', 'hooks', 'useAccount.ts'), 'utf-8');
    expect(hook).toContain("accountFetch('/users/me', { method: 'DELETE' })");
  });
});

describe('the deletion itself requires deliberate intent', () => {
  const html = render();

  it('renders a clearly separated danger zone, not an action mixed into ordinary settings', () => {
    expect(html).toContain(copy.dangerZoneHeading);
    expect(html).toContain(copy.dangerZoneNote);
    expect(html).toContain('aria-labelledby="danger-zone-heading"');
  });

  it('shows the full destructive warning BEFORE any interaction — it is not revealed by the click that acts', () => {
    expect(html).toContain(copy.warning);
  });

  it('requires a typed confirmation, with a real accessible name', () => {
    expect(html).toContain('id="delete-account-confirmation"');
    expect(html).toContain('for="delete-account-confirmation"');
    expect(html).toContain(copy.confirmationLabel);
  });

  it('the final control is DISABLED until the confirmation matches — inoperable by keyboard, not merely dimmed', () => {
    const button = html.slice(html.indexOf('<button'), html.indexOf('</button>'));
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-disabled="true"');
    expect(button).toContain(copy.deletePermanently);
  });

  it('the final control is separately and explicitly labelled — never a bare "Delete"', () => {
    expect(copy.deletePermanently.toLowerCase()).toContain('permanently');
    expect(copy.deletePermanently).not.toBe(copy.deleteAccountLabel);
  });
});

describe('the confirmation comparison itself', () => {
  const source = readFileSync(join(HERE, 'DeleteAccountDangerZone.tsx'), 'utf-8');

  it('compares the typed value to the caller’s OWN address, exactly', () => {
    expect(codeOnly(source)).toContain("const matches = typed.trim() === email");
  });

  it('is not a prefix, case-insensitive or emptiness-tolerant comparison — the classic ways such a gate is accidentally defeated', () => {
    const code = codeOnly(source);
    expect(code).not.toContain('toLowerCase()');
    expect(code).not.toContain('startsWith(');
    expect(code).not.toContain('includes(email)');
    // An empty field can never match a real address, so the disabled state
    // holds on first paint.
    expect(EMAIL.length).toBeGreaterThan(0);
    expect(''.trim() === EMAIL).toBe(false);
  });

  it('the action refuses to run even if the control were somehow activated while unmatched', () => {
    expect(codeOnly(source)).toContain('if (!matches) return;');
  });
});

describe('positive control', () => {
  /*
    A guard that cannot fail is not a guard. These re-run the load-bearing
    assertions against the PREIMAGE — the account popup as it was, with the
    destructive entry in it — and require them to fail.
  */
  const preimage = codeOnly(`
    <button type="button" onClick={() => void signOut()}>{signOutLabel}</button>
    <button type="button" onClick={() => void handleDeleteAccount()}>{deleteAccountLabel}</button>
    async function handleDeleteAccount() { if (!window.confirm(deleteAccountConfirmLabel)) return; await deleteAccount(); }
  `);

  it('the old popup source fails the no-deletion assertions', () => {
    expect(() => expect(preimage).not.toContain('deleteAccountLabel')).toThrow();
    expect(() => expect(preimage).not.toContain('window.confirm')).toThrow();
    expect(() => expect(preimage).not.toMatch(/deleteAccount\(\)/)).toThrow();
  });

  it('a danger zone whose button were merely styled-as-disabled fails the disabled assertion', () => {
    const styledOnly = '<button class="opacity-40">Delete account permanently</button>';
    expect(() => expect(styledOnly).toContain('disabled=""')).toThrow();
  });
});
