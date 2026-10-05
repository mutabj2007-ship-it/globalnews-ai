'use client';

import { useEffect, useState } from 'react';
import { accountFetch } from '@/lib/api/accountFetch';
import { ADMIN_API, ADMIN_ROUTES } from '@/lib/admin/adminRoutes';
import { hasCapability } from '@/lib/admin/adminCapabilities';
import type { AdminMeResponse } from '@/lib/admin/adminApiTypes';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC VISUAL CONVERGENCE — "Inspect in Admin" (Alpha: public story → the same Admin record)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHO SEES IT. Only a reader the existing Admin identity mechanism (GET /admin/me — the same read
 * AdminShell makes) answers as an Admin holding `news.manage`, the capability the backend requires
 * for the story routes. Everyone else sees nothing: no disabled control, no hint.
 *
 * WHAT IT COSTS. Nothing for ordinary readers: the check runs only for a SIGNED-IN reader, only
 * once a Brief panel is open, at most once per page view (one shared promise). It returns the
 * caller's own role and capabilities — no private Admin data is read to decide presentation. The
 * backend guard stack (AdminPlatformEnabledGuard + RequireAuthGuard + AdminGuard + capability) stays
 * the security authority: the link opens an Admin page that enforces it again.
 *
 * WHERE IT GOES. The real Admin story page (ADMIN_ROUTES.newsStories) with the CANONICAL id the
 * panel holds: `storyId` once resolved, otherwise the `articleRef` — with STORY_BRIEF_ENABLED OFF the
 * public resolver answers 404, and Admin resolves the article through its own guarded route.
 */
let adminCheck: Promise<boolean> | null = null;

function checkAdmin(): Promise<boolean> {
  if (adminCheck === null) {
    adminCheck = accountFetch(ADMIN_API.me)
      .then(async (response) => {
        if (!response.ok) return false;
        const me = (await response.json()) as AdminMeResponse;
        return hasCapability(me.capabilities, 'news.manage');
      })
      .catch(() => false);
  }
  return adminCheck;
}

/** Test seam. */
export function resetVisualAdminCheckForTests(): void {
  adminCheck = null;
}

export function useVisualAdminInspect(active: boolean): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    let live = true;
    void checkAdmin().then((ok) => {
      if (live) setAllowed(ok);
    });
    return () => {
      live = false;
    };
  }, [active]);
  return active && allowed;
}

export function adminStoryHref(identity: { readonly storyId: string | null; readonly articleRef: string }): string {
  const params = new URLSearchParams();
  if (identity.storyId !== null) params.set('storyId', identity.storyId);
  else params.set('articleRef', identity.articleRef);
  return `${ADMIN_ROUTES.newsStories}?${params.toString()}`;
}
