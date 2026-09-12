'use client';

import { useCallback, useEffect, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';
import type { AdminDataState } from './adminDataState';

/**
 * F1.b — the one way an admin screen reads a real backend surface.
 *
 * Uses the EXISTING accountFetch helper (credentials + CSRF echo). No
 * second API client is introduced, matching the discipline E1 held to.
 *
 * A failure never becomes data. Every non-2xx and every thrown request
 * resolves to state 'error' with `data` left null, so a panel renders the
 * error branch rather than an empty table that could read as "no
 * records". One failing panel does not blank a screen: each resource is
 * fetched independently.
 */
export interface AdminResource<T> {
  state: AdminDataState;
  data: T | null;
  reload: () => void;
}

export function useAdminResource<T>(path: string): AdminResource<T> {
  const [state, setState] = useState<AdminDataState>('loading');
  const [data, setData] = useState<T | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setState('loading');
    setData(null);
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await accountFetch(path);
        if (cancelled) return;

        if (!response.ok) {
          setState('error');
          return;
        }

        const payload = (await response.json()) as T;
        if (cancelled) return;

        setData(payload);
        setState('real');
      } catch {
        if (!cancelled) setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  return { state, data, reload };
}
