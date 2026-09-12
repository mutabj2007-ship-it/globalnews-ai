'use client';

import { useCallback, useRef, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';

/**
 * S3 — the one way an admin screen WRITES to a backend surface, and the
 * POST counterpart to `useAdminResource`.
 *
 * Uses the SAME `accountFetch` helper the read hook uses, which is what
 * supplies `credentials: 'include'` and echoes the `gna_csrf` cookie
 * back as `X-CSRF-Token`. No second API client is introduced and no
 * admin file constructs a bare `fetch`, which
 * `adminSecurityPosture.spec.ts` now asserts for the whole admin
 * surface rather than for the read hook alone.
 *
 * A FAILURE NEVER BECOMES A SUCCESS. Every non-2xx response and every
 * thrown request resolves to `false` and leaves `state` at 'error'; the
 * caller reloads its data only on `true`. A composer therefore cannot
 * clear itself — and cannot imply a reply was sent — because a request
 * came back at all.
 *
 * THE PENDING FLAG IS A CORRECTNESS CONTROL, NOT A SPINNER. `submit`
 * refuses to start while a request is already in flight, so a
 * double-clicked reply button cannot post the same message to a
 * requester twice.
 */
export type AdminMutationState = 'idle' | 'pending' | 'error' | 'done';

export interface AdminMutation<Body> {
  state: AdminMutationState;
  pending: boolean;
  /** Resolves true only on a 2xx response. */
  submit: (body: Body) => Promise<boolean>;
  reset: () => void;
}

export function useAdminMutation<Body>(path: string): AdminMutation<Body> {
  const [state, setState] = useState<AdminMutationState>('idle');

  /**
   * The in-flight latch is a ref, not the state above, for two reasons:
   * a state update is not visible to a second call in the same tick, and
   * a state updater must stay pure — React may invoke it twice in
   * development, which would defeat a guard written inside one.
   */
  const inFlight = useRef(false);

  const submit = useCallback(
    async (body: Body): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setState('pending');

      try {
        const response = await accountFetch(path, { method: 'POST', body });

        if (!response.ok) {
          setState('error');
          return false;
        }

        setState('done');
        return true;
      } catch {
        setState('error');
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [path],
  );

  const reset = useCallback(() => setState('idle'), []);

  return { state, pending: state === 'pending', submit, reset };
}
