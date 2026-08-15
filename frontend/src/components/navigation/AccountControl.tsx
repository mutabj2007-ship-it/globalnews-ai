'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from '@/lib/hooks/useAccount';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AccountControlProps {
  signInLabel: string;
  signInClassName: string;
  historyLabel: string;
  signOutLabel: string;
  deleteAccountLabel: string;
  deleteAccountConfirmLabel: string;
}

/**
 * Milestone #57 — replaces the two previously-decorative "Sign In"
 * buttons in NavBar.tsx (desktop and mobile) with this one component,
 * reused for both via the same signInClassName each caller already
 * used for its own button, so no visual change occurs for a signed-out
 * visitor beyond the button now actually doing something. Signed-out:
 * a real navigation (not a fetch — this must leave the SPA for
 * Google's consent screen) to GET /auth/google. Signed-in: a small
 * inline menu (History / Sign out / Delete account) — no new page, no
 * profile/settings system beyond these three actions.
 */
export function AccountControl({
  signInLabel,
  signInClassName,
  historyLabel,
  signOutLabel,
  deleteAccountLabel,
  deleteAccountConfirmLabel,
}: AccountControlProps): JSX.Element {
  const { user, isLoading, signOut, deleteAccount } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return <span className={signInClassName} aria-hidden="true" />;
  }

  if (!user) {
    return (
      <a href={`${API_BASE_URL}/auth/google`} className={signInClassName}>
        {signInLabel}
      </a>
    );
  }

  async function handleDeleteAccount(): Promise<void> {
    if (typeof window !== 'undefined' && !window.confirm(deleteAccountConfirmLabel)) {
      return;
    }
    await deleteAccount();
  }

  return (
    <div className="relative">
      <button type="button" className={signInClassName} onClick={() => setMenuOpen((open) => !open)}>
        {user.displayName ?? user.email}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full z-10 mt-2 flex min-w-[10rem] flex-col gap-1 rounded-lg border border-cyan-500/25 bg-surface p-2 text-sm">
          <Link href="/history" className="rounded px-2 py-1.5 text-left hover:bg-surface-hover">
            {historyLabel}
          </Link>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left hover:bg-surface-hover"
            onClick={() => void signOut()}
          >
            {signOutLabel}
          </button>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-red-400 hover:bg-surface-hover"
            onClick={() => void handleDeleteAccount()}
          >
            {deleteAccountLabel}
          </button>
        </div>
      )}
    </div>
  );
}
