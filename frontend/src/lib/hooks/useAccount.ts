'use client';

import { useEffect, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';

export interface AccountUser {
  id: string;
  email: string;
  displayName: string | null;
}

/**
 * Milestone #57 — the entire signed-in-state mechanism: checks
 * GET /users/me once on mount (a request the httpOnly session cookie
 * either does or doesn't satisfy) and exposes the resulting
 * signed-in/signed-out state, plus signOut/deleteAccount actions. A
 * failed/401 response is treated identically to "not signed in" — the
 * guest experience never breaks or shows an error state merely
 * because no one is signed in, which is the expected, normal case for
 * the overwhelming majority of visits.
 */
export function useAccount(): {
  user: AccountUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh(): Promise<void> {
    try {
      const response = await accountFetch('/users/me');
      if (!response.ok) {
        setUser(null);
        return;
      }
      const data = (await response.json()) as AccountUser;
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut(): Promise<void> {
    await accountFetch('/auth/signout', { method: 'POST' });
    setUser(null);
  }

  async function deleteAccount(): Promise<void> {
    await accountFetch('/users/me', { method: 'DELETE' });
    setUser(null);
  }

  return { user, isLoading, signOut, deleteAccount, refresh };
}
