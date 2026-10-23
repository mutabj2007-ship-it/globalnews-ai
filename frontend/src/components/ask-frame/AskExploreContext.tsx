'use client';

import { createContext, useContext, type JSX, type ReactNode } from 'react';

/**
 * R135 ASK EXPLORE R1 — whether this deployment serves the platform pages (/map, /conflict,
 * /market, /imihigo …). Decided ONCE on the server from the same predicate the route gate uses
 * (`standaloneAskRoot`, GNA_PUBLIC_ROOT) and handed down; the client never guesses.
 *
 * Default FALSE (fail closed): outside the provider, or on a Standalone deployment where those
 * pages redirect to `/`, Ask shows no link to them. The in-Ask records (conflict events, tenders)
 * read the public `/conflict-data` and `/market-data` proxies, which both modes serve.
 */
const PlatformPages = createContext(false);

export function AskPlatformPagesProvider({ value, children }: { readonly value: boolean; readonly children?: ReactNode }): JSX.Element {
  return <PlatformPages.Provider value={value}>{children}</PlatformPages.Provider>;
}

export function usePlatformPages(): boolean {
  return useContext(PlatformPages);
}
