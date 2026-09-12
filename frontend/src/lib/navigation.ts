import type { NavLink } from '@/types/home';

/**
 * Milestone #53 — MVP release-gate remediation. Previously listed 9
 * links; only '/' and '/map' correspond to real, existing Next.js
 * routes (confirmed via direct route inspection: '/world',
 * '/politics', '/business', '/technology', '/science', '/health',
 * '/about' have no matching page and would 404 on click). Per
 * explicit CTO instruction, this is fixed by removing the dead
 * entries — NOT by fabricating placeholder pages — so every rendered
 * primary-nav destination resolves to a real page. Re-add an entry
 * here only once its corresponding route actually exists.
 */
export const primaryNavLinks: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'World Map', href: '/map' },
];
