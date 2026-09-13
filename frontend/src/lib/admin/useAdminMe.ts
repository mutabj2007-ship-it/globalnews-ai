'use client';

import { useCallback, useEffect, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';
import { ADMIN_API } from './adminRoutes';
import type { AdminMeResponse } from './adminApiTypes';

/**
 * F1.b — the `/admin/me` client boundary.
 *
 * FIVE OUTCOMES, and the shell renders a different surface for each.
 * They are deliberately not collapsed:
 *
 *   loading        request in flight — chrome only, never populated content
 *   authorized     200 — the shell renders, nav built from capabilities[]
 *   unauthenticated 401 — not signed in
 *   forbidden      403 OR 404
 *   unreachable    network failure or 5xx
 *
 * WHY 403 AND 404 COLLAPSE INTO ONE OUTCOME. When ADMIN_PLATFORM_ENABLED
 * is off the backend returns 404 to EVERYONE, precisely so "disabled" is
 * indistinguishable from "absent". The client cannot tell a disabled
 * platform from an unauthorized caller, and must not try — inventing a
 * "platform disabled" screen would undo the property F1.a built.
 *
 * This gate is CONVENIENCE, NOT SECURITY. Every admin endpoint enforces
 * independently; if this check were bypassed the visitor would see an
 * empty shell whose every request returns 403 or 404. The role is never
 * cached in localStorage, sessionStorage or any other persistence — it is
 * re-read from the server on every mount.
 */
export type AdminAccessOutcome =
  'loading' | 'authorized' | 'unauthenticated' | 'forbidden' | 'unreachable';

export interface AdminMeState {
  outcome: AdminAccessOutcome;
  me: AdminMeResponse | null;
  reload: () => void;
}

export function useAdminMe(): AdminMeState {
  const [outcome, setOutcome] = useState<AdminAccessOutcome>('loading');
  const [me, setMe] = useState<AdminMeResponse | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setOutcome('loading');
    setMe(null);
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await accountFetch(ADMIN_API.me);

        if (cancelled) return;

        if (response.status === 401) {
          setOutcome('unauthenticated');
          return;
        }

        if (response.status === 403 || response.status === 404) {
          setOutcome('forbidden');
          return;
        }

        if (!response.ok) {
          setOutcome('unreachable');
          return;
        }

        const data = (await response.json()) as AdminMeResponse;
        if (cancelled) return;

        setMe(data);
        setOutcome('authorized');
      } catch {
        if (!cancelled) setOutcome('unreachable');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { outcome, me, reload };
}
