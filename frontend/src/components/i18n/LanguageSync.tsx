'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  persistLanguageSelection,
  readLanguageCookie,
  resolveInitialLanguage,
} from '@/lib/i18n/languages';

/**
 * CHECKPOINT I — LANGUAGE-PERSISTENCE-ON-REFRESH.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 *
 * The product has TWO stores for one preference. `localStorage` is the
 * long-lived client record; the cookie is the only thing a Server Component
 * can read. They agree while both survive — and when the cookie alone is
 * missing, they do not.
 *
 * The homepage has always reconciled them: `Hero` compares what the client
 * resolves against what the server actually used, and refreshes if they
 * disagree. NOTHING ELSE DID. So a reader whose cookie was cleared, or whose
 * browser is Polish and who arrives directly on `/map`, gets English — and
 * REFRESHING NEVER FIXES IT, because the refresh re-reads the same absent
 * cookie. Only a detour through the homepage repaired it.
 *
 * That is the item exactly: PL did not survive a refresh anywhere but home.
 *
 * ── THE MECHANISM IS THE RELEASED ONE, NOT A NEW ONE ─────────────────────
 *
 * Every function here is the one Hero already calls, in the same order:
 * resolve what the client believes, reconstruct what the server used with the
 * SAME `cookie ?? 'en'` fallback the routes apply, and refresh only when they
 * disagree. No second preference store, no new cookie, no route-specific rule.
 *
 * ── WHY IT CANNOT LOOP ────────────────────────────────────────────────────
 *
 * `persistLanguageSelection` writes the cookie before the refresh, so the next
 * run finds the two in agreement and does nothing. The condition is the guard.
 *
 * ── AND WHY IT IS AN EFFECT ───────────────────────────────────────────────
 *
 * Reading `localStorage` during render would make the server and client first
 * renders disagree and produce a hydration mismatch — M65's rule, kept here.
 *
 * Renders nothing. It is a behaviour mounted on a route, not a surface.
 */
export function LanguageSync(): null {
  const router = useRouter();

  useEffect(() => {
    const effectiveServerLanguage = readLanguageCookie() ?? 'en';
    const resolved = resolveInitialLanguage();

    if (resolved !== effectiveServerLanguage) {
      persistLanguageSelection(resolved);
      router.refresh();
    }
  }, [router]);

  return null;
}
