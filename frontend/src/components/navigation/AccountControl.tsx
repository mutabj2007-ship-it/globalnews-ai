'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/lib/hooks/useAccount';
import { accountSignInUrl } from '@/lib/api/accountBase';

export interface AccountControlProps {
  signInLabel: string;
  signInClassName: string;
  /**
   * R4 HEADER ACCOUNT PRIVACY — the NEUTRAL label the closed trigger shows to
   * every authenticated user. "Account" / "Konto". It is a constant string
   * from the dictionary, never derived from the account: not the email, not
   * the local part of the email, not initials of either, and deliberately not
   * `displayName` either. A future backend may populate displayName; that must
   * not silently turn the public header into a real-name disclosure surface
   * (CTO amendment 1).
   */
  accountLabel: string;
  /** Accessible name of the trigger — "Account menu" / "Menu konta". */
  accountMenuAriaLabel: string;
  /** Heading of the identity row inside the OPENED control only. */
  signedInAsLabel: string;
  historyLabel: string;
  /**
   * RC-1 — the user Support entry. Sits in the SIGNED-IN account menu beside
   * History, and deliberately NOT in `primaryNavLinks`: /support is a page of
   * the caller's own correspondence, so it has no meaning for a signed-out
   * visitor and no business in the public header.
   */
  supportLabel: string;
  signOutLabel: string;
  /**
   * ACCOUNT DESTRUCTIVE-ACTION SAFETY. Replaces `deleteAccountLabel` and
   * `deleteAccountConfirmLabel`. Those two props existed ONLY to render and
   * gate a destructive action inside this popup; the Product Owner ruling
   * removes that action from the quick menu entirely, so the props go with
   * it rather than lingering as unused surface. What remains is a purely
   * NAVIGATIONAL entry to /account/settings.
   */
  settingsLabel: string;
}

/**
 * Milestone #57 — replaces the two previously-decorative "Sign In"
 * buttons in NavBar.tsx (desktop and mobile) with this one component,
 * reused for both via the same signInClassName each caller already
 * used for its own button, so no visual change occurs for a signed-out
 * visitor beyond the button now actually doing something. Signed-out:
 * a real navigation (not a fetch — this must leave the SPA for
 * Google's consent screen) to the first-party /api/auth/google path,
 * carrying the current page as the return destination. Signed-in: a small
 * inline menu — no new page, no profile/settings system beyond these
 * actions.
 *
 * RC-1 adds Support to that menu, immediately after History. It reuses the
 * existing menu architecture exactly: one more <Link>, one more label prop
 * fed from the same `navBar` dictionary section, and no change to the
 * signed-out branch. A signed-out visitor's markup is byte-for-byte what it
 * was, because this menu only renders once a real session exists.
 *
 * ── R4 LAUNCH-PREP — HEADER ACCOUNT PRIVACY ──────────────────────────────
 *
 * THE DEFECT THIS CORRECTS. The signed-in trigger used to render the account's
 * display name with the address as its fallback. Because `findOrCreateUser`
 * never writes a display name, that fallback fired for every real account, so an
 * authenticated visitor's FULL EMAIL ADDRESS was permanently visible in the
 * public header of all nine surfaces that mount <NavBar>, with no interaction
 * required to reveal it.
 *
 * THE CONTRACT NOW, EXACTLY:
 *   signed out              -> Sign In. No email, no account identifier.
 *   signed in, menu CLOSED  -> the neutral `accountLabel`. No email, no
 *                              displayName, no email-derived initials, and
 *                              nothing about the account in any aria-label,
 *                              title or data-* attribute either.
 *   signed in, menu OPEN    -> the caller's OWN email, exactly once, inside
 *                              the conditionally-rendered surface, reached
 *                              only by deliberately opening this control.
 *
 * The email cannot cross users: its only source is the guarded, per-caller
 * GET /users/me (see useAccount.ts), which is held in React state for the
 * lifetime of one mount and is never cached, stored or server-rendered.
 *
 * NOT CHANGED BY THIS CORRECTION: `signInClassName` (CTO decision D4 — one
 * released class string across all three states), the signed-out branch, the
 * loading placeholder, the menu's own actions, and their RC-1 ordering
 * (History -> Support -> Sign Out).
 *
 * ACCOUNT DESTRUCTIVE-ACTION SAFETY — PRODUCT OWNER RULING. The menu's
 * fourth entry was "Delete Account": an irreversible action sitting directly
 * beside Sign Out, reachable in two clicks from any page's header and gated
 * only by a native window.confirm(). Two adjacent controls, one of which
 * ends a session and the other of which destroys the account, is an
 * accidental-action hazard regardless of the confirm dialog.
 *
 * The quick menu now carries History -> Support -> Settings -> Sign Out.
 * Sign Out keeps its own simple, independent one-click behaviour. Deletion
 * is reachable ONLY through /account/settings, whose Danger Zone requires
 * the caller to type their own account address before the final
 * "Delete account permanently" control becomes operable.
 *
 * NO BACKEND OR AUTH CONTRACT CHANGED. Deletion is still exactly
 * DELETE /users/me via the same `useAccount().deleteAccount`; this component
 * simply no longer calls it. Re-authentication is NOT implemented because
 * the existing auth architecture exposes no re-auth endpoint — adding one
 * would be a backend change, which this task is not authorized to make.
 *
 * ACCESSIBILITY. Because the email now lives behind this popup, the popup had
 * to become operable: the trigger declares aria-expanded/aria-controls against
 * a useId-unique id (the desktop and mobile instances both mount, so a fixed
 * id would collide), Escape closes and returns focus to the trigger, and a
 * pointerdown outside dismisses. Native <a>/<button> semantics are kept and no
 * role="menu"/role="menuitem" is introduced, because this control deliberately
 * does not implement the full ARIA menu keyboard model (CTO amendment 4).
 */
export function AccountControl({
  signInLabel,
  signInClassName,
  accountLabel,
  accountMenuAriaLabel,
  signedInAsLabel,
  historyLabel,
  supportLabel,
  signOutLabel,
  settingsLabel,
}: AccountControlProps): JSX.Element {
  const { user, isLoading, signOut } = useAccount();
  /*
    M-ALPHA-AUTH — this control sits in the header of nine surfaces, so its
    "originating page" is simply wherever it is mounted. `usePathname()` is the
    right source: it is stable between the server prerender of this client
    component and its hydration, so the href does not change under the user and
    no hydration mismatch is introduced. It returns a path with no query string
    and no fragment, which is exactly the shape the backend allowlist accepts.

    A path the backend does not recognise is not a problem to handle here: it is
    silently replaced with the homepage on the way in, which is the behaviour
    this control had before this milestone.
  */
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Registered only while the popup is open, and removed on cleanup — the same
   * shape the language control already uses (nativeControlScheme.spec.ts).
   * Escape restores focus to the trigger so a keyboard user is not dropped at
   * the top of the document.
   */
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return;
      }
      /*
        CAPTURE PHASE, then stopPropagation: Escape must close the INNERMOST
        layer only. NavBar keeps its own document keydown listener to exit the
        full-screen mobile menu (a real keyboard exit from a full-viewport
        overlay), and inside that overlay this popup is nested within it. A
        capture-phase listener runs before that bubble-phase one, so Escape
        dismisses this popup and leaves the menu the user is standing in open —
        without NavBar being modified at all.
      */
      event.stopPropagation();
      setMenuOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menuOpen]);

  if (isLoading) {
    return <span className={signInClassName} aria-hidden="true" />;
  }

  if (!user) {
    return (
      <a href={accountSignInUrl(pathname ?? undefined)} className={signInClassName}>
        {signInLabel}
      </a>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={signInClassName}
        aria-label={accountMenuAriaLabel}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {accountLabel}
      </button>
      {menuOpen && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-10 mt-2 flex min-w-[10rem] max-w-[16rem] flex-col gap-1 rounded-lg border border-cyan-500/25 bg-surface p-2 text-sm"
        >
          {/*
            THE ONLY PLACE THE EMAIL IS RENDERED ANYWHERE IN THE PRODUCT, and
            only while `menuOpen` — a deliberately opened control. It is a
            non-interactive <p>, so it stays out of the action sequence, and it
            truncates inside the popup's max-width so a long address cannot
            widen the surface past its intended bounds.
          */}
          <p className="min-w-0 px-2 pb-1 pt-0.5 text-xs text-ink-secondary">
            <span className="block">{signedInAsLabel}</span>
            <span className="block truncate font-medium text-ink-primary">{user.email}</span>
          </p>
          <span aria-hidden="true" className="mb-1 block h-px bg-cyan-500/20" />
          <Link href="/history" className="rounded px-2 py-1.5 text-left hover:bg-surface-hover">
            {historyLabel}
          </Link>
          <Link href="/support" className="rounded px-2 py-1.5 text-left hover:bg-surface-hover">
            {supportLabel}
          </Link>
          {/*
            ACCOUNT DESTRUCTIVE-ACTION SAFETY. This entry replaces the former
            "Delete Account" button, which sat here, immediately after Sign
            Out, as a one-click irreversible action inside a popup that opens
            on a single click of the header. Deletion now lives on
            /account/settings behind a typed confirmation. This is a <Link>:
            the only thing it can do is navigate.
          */}
          <Link href="/account/settings" className="rounded px-2 py-1.5 text-left hover:bg-surface-hover">
            {settingsLabel}
          </Link>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left hover:bg-surface-hover"
            onClick={() => void signOut()}
          >
            {signOutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
