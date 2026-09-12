import { readFileSync } from 'fs';
import { join } from 'path';

const navBarSource = readFileSync(join(__dirname, 'NavBar.tsx'), 'utf-8');

/**
 * LAUNCH-PREP — THE FULL-SCREEN MOBILE NAVIGATION MUST COVER THE VIEWPORT.
 *
 * <header> carries backdrop-blur-[10px], and a non-none backdrop-filter makes an
 * element the containing block for its fixed-position descendants. While the
 * mobile menu lived inside that header, its `fixed inset-0` resolved against the
 * header instead of the viewport: measured in Chromium at 390x844, the
 * full-screen menu was a 390x92 scrolling strip. Every nav item, Help and the
 * account control were inside it.
 *
 * THE FIX IS THE OVERLAY'S LOCATION, NOT THE HEADER'S APPEARANCE. The approved
 * blur stays exactly where it was; the overlay is portalled to document.body,
 * outside every containing block — the header's, and whatever wrapper each of
 * the nine <NavBar> mount points puts around it.
 *
 * A SOURCE-STRING SUITE, this lane's convention. The runtime half — overlay at
 * 0,0 sized to the viewport at 390x844 and 768, every item reachable, scrolling,
 * and no desktop regression at 1440 — is the browser harness recorded in the
 * delivery report.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const code = codeOnly(navBarSource);

/** Everything from the portal call to its closing, i.e. the overlay markup. */
function overlayBlock(): string {
  const start = code.indexOf('createPortal(');
  expect(start).toBeGreaterThan(-1);
  const end = code.indexOf('document.body,', start);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

describe('mobile nav viewport — the overlay is rendered outside the containing block', () => {
  it('it is portalled, and to document.body', () => {
    expect(code).toContain("import { createPortal } from 'react-dom';");
    expect(code).toContain('createPortal(');
    expect(code).toMatch(/createPortal\([\s\S]*?document\.body,\s*\)\}/);
  });

  it('the portal is guarded, so a server render never touches document', () => {
    expect(code).toMatch(/typeof document !== 'undefined' &&\s*\n\s*createPortal\(/);
  });

  it('exactly one portal exists — the mobile menu, and nothing else was moved', () => {
    expect((code.match(/createPortal\(/g) ?? []).length).toBe(1);
    expect((code.match(/document\.body/g) ?? []).length).toBe(1);
  });

  it('it still renders only while the menu is open', () => {
    expect(code).toMatch(/\{isMobileMenuOpen &&\s*\n\s*typeof document/);
  });

  it('the overlay still declares the full viewport', () => {
    expect(overlayBlock()).toContain('fixed inset-0');
  });

  it('it stacks above the z-50 header, or its close control would be covered', () => {
    const overlay = overlayBlock();
    expect(overlay).toContain('z-[70]');
    expect(overlay).not.toContain('z-40');
    // The header keeps its own z-50 and its approved backdrop.
    expect(code).toContain('sticky top-0 z-50');
  });
});

describe('mobile nav viewport — the approved header appearance is untouched', () => {
  it('the header keeps its fill, border and backdrop blur — the blur was NOT deleted', () => {
    expect(navBarSource).toContain(
      'sticky top-0 z-50 border-b border-[rgba(56,189,248,0.18)] bg-[rgba(4,7,14,0.92)] backdrop-blur-[10px]',
    );
  });

  it('the 52px mobile bar keeps its exact geometry, fill and blur', () => {
    expect(navBarSource).toMatch(
      /h-\[52px\] items-center gap-3 bg-\[rgba\(5,7,13,0\.96\)\] px-4 backdrop-blur-\[8px\]/,
    );
  });

  it('the desktop row keeps its 62px geometry and its canvas', () => {
    expect(navBarSource).toContain('cd-canvas mx-auto hidden h-[62px] max-w-cd-page');
    expect(navBarSource).toMatch(/cd-header:flex/);
  });

  it('the handoff breakpoint is unchanged: two cd-header:hidden, no lg:hidden', () => {
    expect((navBarSource.match(/cd-header:hidden/g) ?? []).length).toBe(2);
    expect(code).not.toMatch(/lg:hidden/);
  });
});

describe('mobile nav viewport — everything inside the overlay survived the move', () => {
  const overlay = overlayBlock();

  it('the close control is still there, still 44x44, still labelled', () => {
    expect(overlay).toContain('aria-label={t.closeMenuAriaLabel}');
    expect(overlay).toContain('h-11 w-11');
    expect(overlay).toContain('setIsMobileMenuOpen(false)');
  });

  it('the SECTIONS heading and the nine-item model are still rendered from NAV_MODEL', () => {
    expect(overlay).toContain('{t.sectionsHeading}');
    expect(overlay).toContain('NAV_MODEL.map');
    expect(overlay).toContain('aria-label={t.mobileNavigationAriaLabel}');
    expect(overlay).toContain('min-h-[52px]');
  });

  it('Help is still in the overlay, still pointing at /support', () => {
    expect(overlay).toContain('{t.help}');
    expect(overlay).toMatch(/href="\/support"/);
  });

  it('the account control is still in the overlay, with the privacy props intact', () => {
    expect(overlay).toContain('<AccountControl');
    for (const prop of [
      'accountLabel={t.account}',
      'accountMenuAriaLabel={t.accountMenuAriaLabel}',
      'signedInAsLabel={t.signedInAs}',
      'historyLabel={t.history}',
      'supportLabel={t.support}',
      'settingsLabel={t.settings}',
      'signOutLabel={t.signOut}',
    ]) {
      expect(overlay).toContain(prop);
    }
  });

  it('the mobile signInClassName is still byte-identical to the released value', () => {
    expect(overlay).toContain(
      'signInClassName="mt-4 w-full rounded-[9px] border border-[rgba(56,189,248,0.5)] bg-gradient-to-b from-[rgba(37,99,235,0.95)] to-[rgba(29,78,216,0.95)] px-5 py-3 text-center text-sm font-semibold text-[#eaf6ff]"',
    );
  });

  it('content taller than the viewport still scrolls inside the overlay', () => {
    expect(overlay).toContain('overflow-y-auto');
  });

  it('BOTH AccountControl instances still exist — desktop rail and overlay', () => {
    expect((navBarSource.match(/<AccountControl/g) ?? []).length).toBe(2);
  });

  it('Escape still closes the menu, and its listener is still cleaned up', () => {
    expect(code).toMatch(/event\.key === 'Escape'\) setIsMobileMenuOpen\(false\)/);
    expect(code).toContain("document.addEventListener('keydown', onKeyDown)");
    expect(code).toContain("document.removeEventListener('keydown', onKeyDown)");
  });

  it('the language control was NOT moved into the overlay, and both instances remain', () => {
    expect(overlay).not.toContain('<LanguageSelector');
    expect((navBarSource.match(/<LanguageSelector/g) ?? []).length).toBe(2);
  });
});
