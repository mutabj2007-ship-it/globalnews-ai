'use client';

import { invalidateSavedStories } from '@/lib/myIntelligence/savedStoriesStore';
import { useEffect, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';
import { clearStoryTask } from '@/lib/stories/storyTask';
import { clearKeptQuestion } from '@/lib/ask/askKeptQuestion';

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
  updateDisplayName: (name: string | null) => Promise<{ ok: true } | { ok: false; code: string | null }>;
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
    /* UNIVERSAL BOOKMARK R1 — the shared saved-story state belongs to the reader who just left. */
    invalidateSavedStories();
    /* HOME R1 STAGE B — a pending Discuss / Alert continuation belongs to the reader who left. */
    clearStoryTask();
    /* REASON TO RETURN R1 · G7 — so does an unsent Ask draft kept across a sign-in. */
    clearKeptQuestion();
    setUser(null);
  }

  async function deleteAccount(): Promise<void> {
    await accountFetch('/users/me', { method: 'DELETE' });
    invalidateSavedStories();
    clearStoryTask();
    clearKeptQuestion();
    setUser(null);
  }

  /**
   * REASON TO RETURN R1 · G6 — save (or clear, with null / empty) the name Ask may use. The
   * server applies the shared rule and answers with the stored value, which becomes the state.
   */
  async function updateDisplayName(
    name: string | null,
  ): Promise<{ ok: true } | { ok: false; code: string | null }> {
    try {
      const response = await accountFetch('/users/me', { method: 'PATCH', body: { displayName: name } });
      if (!response.ok) {
        let code: string | null = null;
        try {
          const body = (await response.json()) as { code?: unknown };
          if (typeof body.code === 'string') code = body.code;
        } catch {
          /* no body */
        }
        return { ok: false, code };
      }
      setUser((await response.json()) as AccountUser);
      return { ok: true };
    } catch {
      return { ok: false, code: null };
    }
  }

  return { user, isLoading, signOut, deleteAccount, refresh, updateDisplayName };
}
