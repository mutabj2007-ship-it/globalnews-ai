'use client';

import { useSyncExternalStore } from 'react';
import {
  HOME_R1_GATES_OFF,
  RELEASE_GATES_META_NAME,
  parseReleaseGatesMeta,
  type HomeR1Gates,
} from '@/lib/platform/homeR1Gates';

/**
 * HOME R1 · STAGE A — the server-read release gates, as client islands see them.
 *
 * The root layout reads the gates per request (server-only environment) and, ONLY when at
 * least one is on, emits them as one `<meta name="gna-release-gates">` through its own
 * metadata. Nothing is added to <body> (the PWA contract pins its four children) and no
 * client bundle reads an environment variable. During server render and hydration every
 * gate is OFF; the client snapshot is read from the document once it exists. All gated
 * behaviour is reached only by an explicit reader action, so it is never needed earlier.
 */
let cached: HomeR1Gates | null = null;

function readFromDocument(): HomeR1Gates {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return HOME_R1_GATES_OFF;
  const content = document.querySelector(`meta[name="${RELEASE_GATES_META_NAME}"]`)?.getAttribute('content');
  cached = parseReleaseGatesMeta(content ?? null);
  return cached;
}

const subscribe = (): (() => void) => () => undefined;

export function usePlatformGates(): HomeR1Gates {
  return useSyncExternalStore(subscribe, readFromDocument, () => HOME_R1_GATES_OFF);
}

/** Tests only — forget the parsed document value. */
export function resetPlatformGatesForTest(): void {
  cached = null;
}
