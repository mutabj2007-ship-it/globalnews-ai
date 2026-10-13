import { standaloneAskRoot } from '@/lib/ask/standaloneRoot';

/**
 * CTO R28 — the `/ask/preview` gate, the same rule as `/visual`: the design preview exists only where
 * the platform root is configured (Alpha). On the standalone Ask root (Production) it is a 404.
 */
export function designPreviewAvailable(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return !standaloneAskRoot(env);
}
