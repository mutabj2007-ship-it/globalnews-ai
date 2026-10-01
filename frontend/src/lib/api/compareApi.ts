import type { SelectedStoryRef } from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from './apiBase';

/**
 * HOME R1 · STAGE A — the zero-AI Compare read (POST /news/stories/resolve).
 *
 * One read of RETAINED reporting by identity: no provider, no model, no write, no session
 * (no credentials are sent — the route is public data). The server verifies every
 * `{articleRef, url}` pair and answers `unavailable` (with its reason) for anything it
 * cannot resolve, so the view can say "Not available" instead of dropping a column.
 * Reached through the existing same-origin public `/news/:path*` family — no new proxy
 * route, no change to the authenticated families.
 */

export interface CompareStoryView {
  readonly articleRef: string;
  readonly status: 'available' | 'unavailable';
  readonly reason?: string;
  readonly article?: {
    readonly title: string;
    readonly url: string;
    readonly imageUrl: string | null;
    readonly sourceName: string;
    readonly sourcesCount: number;
    readonly category: string;
    readonly publishedAt: string;
    readonly publishedAtBasis: string;
    readonly countryCode: string | null;
    readonly countryName: string | null;
  };
}

export type CompareReadOutcome =
  | { readonly ok: true; readonly stories: readonly CompareStoryView[] }
  | { readonly ok: false; readonly reason: 'UNAVAILABLE' | 'FAILED' };

const TIMEOUT_MS = 10000;

export async function resolveStoriesForCompare(
  stories: readonly SelectedStoryRef[],
): Promise<CompareReadOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/news/stories/resolve`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories: stories.map((s) => ({ articleRef: s.articleRef, url: s.url })) }),
      signal: controller.signal,
    });
    if (response.status === 404) return { ok: false, reason: 'UNAVAILABLE' };
    if (!response.ok) return { ok: false, reason: 'FAILED' };
    const body = (await response.json()) as { stories?: CompareStoryView[] };
    return Array.isArray(body.stories) ? { ok: true, stories: body.stories } : { ok: false, reason: 'FAILED' };
  } catch {
    return { ok: false, reason: 'FAILED' };
  } finally {
    clearTimeout(timer);
  }
}
