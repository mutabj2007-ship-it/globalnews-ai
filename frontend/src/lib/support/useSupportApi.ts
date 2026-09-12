'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';

/**
 * S4 — the only two ways the user Support surface talks to the backend.
 *
 * Both go through the EXISTING `accountFetch`, which supplies
 * `credentials: 'include'` and echoes the `gna_csrf` cookie back as
 * `X-CSRF-Token` on a mutation. No second API client is introduced and no file
 * in this surface constructs a bare `fetch(` — `supportSurface.spec.ts`
 * asserts both.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THIS DUPLICATES lib/admin/useAdminResource AND useAdminMutation, ON PURPOSE.
 *
 * The alternative — importing the admin hooks here — was rejected.
 * `shared/src/support.ts` states the rule this surface lives by: the user
 * shapes and the admin shapes are two declarations for two audiences, and
 * "nothing in the user surface should reach for an admin one". A shared hook
 * would put an admin refactor in a position to break the user surface, and
 * `adminSecurityPosture.spec.ts` sweeps the admin tree as a unit on the
 * assumption that it IS a unit.
 *
 * Promoting both hooks to a neutral location was the other option, and it is
 * the better end state. It was rejected FOR THIS CHECKPOINT only, because it
 * edits an accepted, test-guarded surface in order to serve a new one. The
 * duplication is recorded as debt rather than hidden.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THE TWO PROPERTIES THAT MATTER MORE THAN THE DUPLICATION
 *
 * A FAILURE NEVER BECOMES DATA. Every non-2xx and every thrown request
 * resolves to state 'error' with `data` left null, so the surface renders its
 * error branch. An empty list and a failed load are different things and must
 * never be shown as the same thing — a user who is told "you have no requests"
 * when the request actually failed will not open a second ticket, and their
 * real one goes unanswered.
 *
 * A FAILURE NEVER BECOMES A SUCCESS. `submit` resolves true ONLY on a 2xx, so
 * a composer cannot clear itself — and cannot imply a message was sent —
 * merely because a response came back.
 */
export type SupportResourceState = 'loading' | 'real' | 'error';

export interface SupportResource<T> {
  state: SupportResourceState;
  data: T | null;
  reload: () => void;
}

export function useSupportResource<T>(path: string | null): SupportResource<T> {
  const [state, setState] = useState<SupportResourceState>(path === null ? 'real' : 'loading');
  const [data, setData] = useState<T | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setState('loading');
    setData(null);
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    // A null path means "there is nothing to fetch yet" — no ticket is open,
    // or the visitor is not signed in. It is not a loading state and it is
    // certainly not an error.
    if (path === null) {
      setState('real');
      setData(null);
      return;
    }

    let cancelled = false;
    setState('loading');

    async function load(): Promise<void> {
      try {
        const response = await accountFetch(path as string);
        if (cancelled) return;

        if (!response.ok) {
          setState('error');
          setData(null);
          return;
        }

        const payload = (await response.json()) as T;
        if (cancelled) return;

        setData(payload);
        setState('real');
      } catch {
        if (!cancelled) {
          setState('error');
          setData(null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  return { state, data, reload };
}

export type SupportMutationState = 'idle' | 'pending' | 'error' | 'done';

export interface SupportMutation<Body, Result> {
  state: SupportMutationState;
  pending: boolean;
  /**
   * Resolves the PARSED RESPONSE on a 2xx, and null on anything else.
   *
   * SUPPORT-AI-1 widened this from a boolean. Creating a ticket now
   * returns the whole thread -- including the agent's stored first
   * response -- and throwing that away only to fetch it again would be
   * the round trip this feature exists to remove. Null on failure keeps
   * every existing `if (await submit(...))` call site behaving exactly
   * as it did.
   */
  submit: (body: Body) => Promise<Result | null>;
  reset: () => void;
}

export function useSupportMutation<Body, Result = unknown>(
  path: string,
): SupportMutation<Body, Result> {
  const [state, setState] = useState<SupportMutationState>('idle');

  /**
   * The in-flight latch is a ref rather than the state above, for the same two
   * reasons the admin mutation hook documents: a state update is not visible to
   * a second call in the same tick, and a state updater must stay pure because
   * React may invoke it twice in development.
   *
   * THIS IS A CORRECTNESS CONTROL, NOT A SPINNER. Without it a double-clicked
   * "Send" would open the same support request twice, and the per-user
   * open-ticket cap would then count both against the person who did it.
   */
  const inFlight = useRef(false);

  const submit = useCallback(
    async (body: Body): Promise<Result | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setState('pending');

      try {
        const response = await accountFetch(path, { method: 'POST', body });

        if (!response.ok) {
          setState('error');
          return null;
        }

        const payload = (await response.json()) as Result;
        setState('done');
        return payload;
      } catch {
        // A body that will not parse is a failed submission, not a
        // successful one with nothing in it: the caller must not clear
        // what the person wrote on the strength of a broken response.
        setState('error');
        return null;
      } finally {
        inFlight.current = false;
      }
    },
    [path],
  );

  const reset = useCallback(() => setState('idle'), []);

  return { state, pending: state === 'pending', submit, reset };
}
