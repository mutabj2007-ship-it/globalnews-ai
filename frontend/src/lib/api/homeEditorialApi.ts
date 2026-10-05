import type {
  HomeEditorialDomain,
  HomeEditorialResponse,
  HomeRegionId,
  StorySearchResponse,
} from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from './apiBase';
import { resolveForwardedClientHeaders } from './forwardedClient';

/**
 * PHONE-FIRST HOME CORRECTION R1 — server-side reads of the business/conflict Home editorial and the
 * persisted story search. Both are retained-store reads on the backend: no provider call, no AI, no
 * Ask, no quota. The reader's own Cookie header is forwarded ONLY to our own backend, so a signed-in
 * reader's hero is personalised from their saved follows/interests; nothing else is sent.
 */
const TIMEOUT_MS = 8000;

async function serverGet<T>(path: string, cookie: string | null): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const forwarded = await resolveForwardedClientHeaders();
    const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { ...forwarded, ...(cookie ? { cookie } : {}) },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** null = the read failed (rendered as UNAVAILABLE — never as "nothing happened"). */
export function fetchHomeEditorial(cookie: string | null): Promise<HomeEditorialResponse | null> {
  return serverGet<HomeEditorialResponse>('/home/editorial', cookie);
}

export interface StorySearchParams {
  readonly q: string;
  readonly region: HomeRegionId | null;
  readonly domain: HomeEditorialDomain | null;
  readonly days: number | null;
  readonly scope: 'home' | 'all';
}

export function storySearchQuery(p: StorySearchParams): string {
  const params = new URLSearchParams({ q: p.q });
  if (p.region !== null) params.set('region', p.region);
  if (p.domain !== null) params.set('domain', p.domain);
  if (p.days !== null) params.set('days', String(p.days));
  if (p.scope === 'all') params.set('scope', 'all');
  return params.toString();
}

export function fetchStorySearch(p: StorySearchParams): Promise<StorySearchResponse | null> {
  return serverGet<StorySearchResponse>(`/stories/search?${storySearchQuery(p)}`, null);
}
