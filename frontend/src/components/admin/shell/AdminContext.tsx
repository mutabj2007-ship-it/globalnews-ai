'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';
import type { AdminMeResponse } from '@/lib/admin/adminApiTypes';
import { hasCapability, type AdminCapability } from '@/lib/admin/adminCapabilities';

/**
 * F1.b — the one place the Admin surface reads its dictionary and its
 * capability list from.
 *
 * The dictionary is resolved ONCE, server-side, in app/admin/layout.tsx
 * (which reads the language cookie exactly as app/layout.tsx does) and
 * handed down here. Twenty routes therefore share one cookie read, and
 * no second localisation mechanism exists.
 *
 * `capabilities` is whatever GET /admin/me returned and nothing else.
 * There is no role -> capability derivation on the client, in this file
 * or anywhere under frontend/.
 */
export interface AdminContextValue {
  t: AdminDictionary;
  me: AdminMeResponse;
  can: (capability: AdminCapability) => boolean;
}

const AdminContextObject = createContext<AdminContextValue | null>(null);

export function AdminContextProvider({
  t,
  me,
  children,
}: {
  t: AdminDictionary;
  me: AdminMeResponse;
  children: ReactNode;
}): JSX.Element {
  const value: AdminContextValue = {
    t,
    me,
    can: (capability) => hasCapability(me.capabilities, capability),
  };

  return <AdminContextObject.Provider value={value}>{children}</AdminContextObject.Provider>;
}

/**
 * Throws rather than returning a permissive default. A screen rendered
 * outside the shell has escaped the access boundary, and the correct
 * response to that is a loud failure, not a silently empty capability
 * set that might read as "allowed" somewhere downstream.
 */
export function useAdminContext(): AdminContextValue {
  const value = useContext(AdminContextObject);

  if (!value) {
    throw new Error('ADMIN_CONTEXT: an admin screen was rendered outside AdminShell.');
  }

  return value;
}
