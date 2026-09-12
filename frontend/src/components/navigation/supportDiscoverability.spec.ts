import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { primaryNavLinks } from '@/lib/navigation';
import { NAV_MODEL } from '@/lib/navModel';
import { footerLinkGroups } from '@/lib/homeContent';

const accountControlSource = readFileSync(join(__dirname, 'AccountControl.tsx'), 'utf-8');
const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');

/**
 * RC-1 — REQUIRED MAIN INTEGRATION: /support must be reachable.
 *
 * F shipped the whole Support surface without touching navigation, which is
 * the correct thing for a lane that does not own the header to do — but it
 * left a real product defect: a signed-in user had no way to reach a page
 * built for them. This suite is the permanent guard on the repair.
 *
 * IT ASSERTS BOTH HALVES OF THE DECISION. Support must be IN the signed-in
 * account menu, and it must NOT be in the public primary navigation. The
 * second half matters as much as the first: /support renders the caller's own
 * correspondence, so advertising it to signed-out visitors would be a link to
 * a page that cannot show them anything.
 */
describe('RC-1 — Support discoverability', () => {
  it('the signed-in account menu links to /support', () => {
    expect(accountControlSource).toMatch(/<Link\s+href="\/support"/);
  });

  it('Support sits beside History in the account menu, not in some other surface', () => {
    const historyAt = accountControlSource.indexOf('href="/history"');
    const supportAt = accountControlSource.indexOf('href="/support"');
    expect(historyAt).toBeGreaterThan(-1);
    expect(supportAt).toBeGreaterThan(-1);
    // Immediately after History, and before the sign-out / delete actions.
    expect(supportAt).toBeGreaterThan(historyAt);
    expect(supportAt).toBeLessThan(accountControlSource.indexOf('{signOutLabel}'));
  });

  it('the entry is localized through the navBar dictionary, never a hardcoded string', () => {
    expect(accountControlSource).toMatch(/\{supportLabel\}/);
    expect(accountControlSource).not.toMatch(/>\s*Support\s*</);
    expect(navBarSource).toMatch(/supportLabel=\{t\.support\}/);
  });

  it('BOTH NavBar call sites pass the label — desktop and mobile', () => {
    const occurrences = navBarSource.match(/supportLabel=\{t\.support\}/g) ?? [];
    expect(occurrences).toHaveLength(2);
    const historyOccurrences = navBarSource.match(/historyLabel=\{t\.history\}/g) ?? [];
    expect(occurrences).toHaveLength(historyOccurrences.length);
  });

  it('the label exists in every real dictionary, and Polish is a real translation', () => {
    expect(getDictionary('en').navBar.support).toBe('Support');
    expect(getDictionary('pl').navBar.support).toBe('Pomoc');
    expect(getDictionary('pl').navBar.support).not.toBe(getDictionary('en').navBar.support);
  });

  it('Support is NOT added to primaryNavLinks, and the public entry is chrome/footer rather than the editorial nav', () => {
    // The real invariant, asserted against the real array.
    expect(primaryNavLinks.some((link) => link.href === '/support')).toBe(false);

    // SUPPORT CLOSURE — the old second assertion was a SOURCE-PROXIMITY regex
    // (`/primaryNavLinks[\s\S]{0,400}\/support/`). It was never a statement
    // about the array; it fired on any `/support` within 400 characters of the
    // WORD "primaryNavLinks" anywhere in NavBar.tsx — including the file's own
    // doc comment explaining that primaryNavLinks is untouched. It reported a
    // violation against correct code the moment the Help entry landed.
    //
    // Replaced by the property that actually matters and cannot be fooled by
    // prose: NAV_MODEL — the nine-item Claude Design sequence — carries no
    // support destination, so Help is not in the editorial navigation.
    expect(NAV_MODEL.some((entry) => entry.href === '/support')).toBe(false);
    expect(NAV_MODEL).toHaveLength(9);
  });

  it('the menu that carries it renders only for a signed-in user', () => {
    // The signed-out branch returns before the menu is constructed, so the
    // /support link cannot appear in a signed-out render.
    /*
      ACCOUNT DESTRUCTIVE-ACTION SAFETY: the end marker was
      'async function handleDeleteAccount', which was removed with the
      destructive action. It is replaced by the first line of the signed-in
      render, which is what the slice was always trying to stop before, and
      which cannot silently vanish the way the helper did (an indexOf that
      returns -1 would quietly produce an empty slice and a green test).
    */
    const signedInRenderStart = accountControlSource.indexOf('<div className="relative"');
    expect(signedInRenderStart).toBeGreaterThan(-1);
    const signedOutBranch = accountControlSource.slice(
      accountControlSource.indexOf('if (!user)'),
      signedInRenderStart,
    );
    expect(signedOutBranch.length).toBeGreaterThan(0);
    expect(signedOutBranch).not.toMatch(/\/support/);
  });

  it('the support dictionary section resolves through the ONE global dictionary', () => {
    expect(getDictionary('en').support.heading.length).toBeGreaterThan(0);
    expect(getDictionary('pl').support.heading.length).toBeGreaterThan(0);
    expect(getDictionary('pl').support.heading).not.toBe(getDictionary('en').support.heading);
  });
});

/**
 * SUPPORT CLOSURE — PUBLIC HELP DISCOVERY, AND WHY IT IS NOT IN NAV_MODEL.
 *
 * CTO policy: Help is publicly discoverable; a personal ticket still requires
 * authentication. Those are two different things, and RC-1 had conflated them —
 * /support was reachable only from the SIGNED-IN account menu, so a visitor who
 * did not yet have an account had no way to find help at all.
 *
 * PLACEMENT CONSUMES THE DESIGN, IT DOES NOT COMPETE WITH IT. NAV_MODEL is the
 * approved Claude Design sequence, ported from the prototype's own nav-model
 * script and built as one explicit ordered array so the exact nine-item
 * sequence is "guaranteed by construction" (navModel.ts). That design specifies
 * no Help entry, and a tenth item would break the property that file exists to
 * hold. Help therefore sits with the persistent UTILITIES the design does place
 * in the header rail — the language selector and the account control — plus the
 * footer. No new navigation system is introduced.
 */
describe('SUPPORT CLOSURE — Help is publicly discoverable in chrome, mobile and footer', () => {
  it('the DESKTOP header rail carries a public Help entry', () => {
    expect(navBarSource).toMatch(/href="\/support"/);
    expect(navBarSource).toContain('{t.help}');
  });

  it('the MOBILE menu carries the same entry, and closes the menu on use', () => {
    // Both call sites render {t.help}; the mobile one must also dismiss the
    // overlay, or the reader is left on the menu they just navigated away from.
    expect((navBarSource.match(/\{t\.help\}/g) ?? []).length).toBe(2);
    const mobileBlock = navBarSource.slice(navBarSource.indexOf('setIsMobileMenuOpen(false)'));
    expect(mobileBlock).toContain('{t.help}');
  });

  it('the FOOTER carries a Help destination that resolves to the real /support route', () => {
    const hrefs = footerLinkGroups.flatMap((group) => group.links.map((link) => link.href));
    expect(hrefs).toContain('/support');
  });

  it('Help is NOT inserted into the approved Claude Design nav sequence', () => {
    // The design placement is consumed, not overridden.
    expect(NAV_MODEL).toHaveLength(9);
    expect(NAV_MODEL.some((entry) => entry.href === '/support')).toBe(false);
    expect(primaryNavLinks).toHaveLength(2);
  });

  it('the public Help label and the account-menu Support label are DISTINCT in both languages', () => {
    // Two audiences: Help is the public affordance, Support is the signed-in
    // reader's own correspondence. Identical wording would blur that.
    for (const language of ['en', 'pl'] as const) {
      const navBar = getDictionary(language).navBar;
      expect(navBar.help.length).toBeGreaterThan(0);
      expect(navBar.support.length).toBeGreaterThan(0);
      expect(navBar.help).not.toBe(navBar.support);
    }
  });

  it('every new label is localized through the dictionary, never hardcoded English', () => {
    expect(getDictionary('pl').navBar.help).not.toBe(getDictionary('en').navBar.help);
    expect(getDictionary('pl').footer.linkLabels['/support']).not.toBe(
      getDictionary('en').footer.linkLabels['/support'],
    );
    // The chrome renders the dictionary value, not a literal.
    expect(navBarSource).not.toMatch(/>\s*Help\s*</);
  });

  it('the signed-in account menu entry SURVIVES — public Help did not replace it', () => {
    expect(accountControlSource).toContain('href="/support"');
    expect(accountControlSource).toContain('{supportLabel}');
  });
});
