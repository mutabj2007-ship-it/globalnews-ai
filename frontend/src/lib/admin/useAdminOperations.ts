'use client';

import { useCallback, useRef, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';
import { ADMIN_OPERATIONS_API } from './adminRoutes';
import type { AdminOperationsSwitchResult } from './adminOperationsTypes';

/**
 * ADMIN OPERATIONS R1 — the write hook for the incident controls.
 *
 * Built on `accountFetch`, which supplies `credentials: 'include'` and echoes the
 * `gna_csrf` cookie as `X-CSRF-Token`, so this file constructs no bare `fetch` and
 * `adminSecurityPosture.spec.ts` keeps holding for the whole admin surface.
 *
 * A FAILURE NEVER BECOMES A SUCCESS, and a SUCCESS IS THE SERVER'S WORD.
 * `useAdminMutation` already resolves false on a non-2xx; this hook additionally
 * returns the server's re-read `switch` and its `applied` flag, because a 2xx alone
 * does not establish that the stored value changed. The screen renders that payload,
 * never an optimistic local guess.
 *
 * The in-flight latch is a ref rather than state: a state update is not visible to a
 * second call in the same tick, so a double-clicked control could otherwise submit the
 * same change twice.
 */
export type AdminOperationsWriteState = 'idle' | 'pending' | 'error' | 'done';

export interface AdminOperationsWrite {
  state: AdminOperationsWriteState;
  pending: boolean;
  /** The server's confirmed result, or null when nothing has been applied yet. */
  result: AdminOperationsSwitchResult | null;
  submit: (name: string, enabled: boolean, reason: string) => Promise<boolean>;
  reset: () => void;
}

export function useAdminOperationsWrite(): AdminOperationsWrite {
  const [state, setState] = useState<AdminOperationsWriteState>('idle');
  const [result, setResult] = useState<AdminOperationsSwitchResult | null>(null);
  const inFlight = useRef(false);

  const submit = useCallback(
    async (name: string, enabled: boolean, reason: string): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setState('pending');
      try {
        const response = await accountFetch(ADMIN_OPERATIONS_API.setSwitch(name), {
          method: 'POST',
          body: { enabled, reason },
        });
        if (!response.ok) {
          setResult(null);
          setState('error');
          return false;
        }
        const body = (await response.json()) as AdminOperationsSwitchResult;
        setResult(body);
        setState('done');
        return true;
      } catch {
        setResult(null);
        setState('error');
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
  }, []);

  return { state, pending: state === 'pending', result, submit, reset };
}
