import { normalizeArticleUrl } from '@globalnews-ai/shared';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * UNIFIED INTELLIGENCE BINDING R2H — HOME COMPARE AS A SELECTION REFERENCE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Home's "Compare stories" opens the ONE Ask (/ask) with the chosen stories staged as a
 * SELECTION (action COMPARE). The /ask URL carries only the stories' URLs (`compare=`, 2..8);
 * /ask derives each story's reference — `articleRef = sha256(normalizeArticleUrl(url))`, the
 * SAME formula as the server's `computeArticleRef` (shared normalizer, UTF-8, hex) — and sends
 * `{ kind: 'SELECTION', action: 'COMPARE', stories: [{ articleRef, url }] }` only when the reader
 * presses Ask. The server re-checks every pair (ASK_CONTEXT_STORY_REF_MISMATCH) and resolves each
 * story from RETAINED reporting; one unretained story refuses the whole turn, truthfully.
 *
 * REFERENCES ONLY: no title, source or summary crosses. Selecting, opening and arriving cost
 * nothing (no request). Imports only the shared normalizer (dashboard network graphs stay clean).
 */

export const COMPARE_MIN_STORIES = 2;
export const COMPARE_MAX_STORIES = 8;
const URL_MAX = 500;
const URL_SHAPE = /^https?:\/\/\S+$/i;

export interface AskCompareStoryRef {
  readonly articleRef: string;
  readonly url: string;
}
/** Structurally the SELECTION member of AskV2ContextRef (lib/api/askV2Api.ts). */
export interface AskCompareRef {
  readonly kind: 'SELECTION';
  readonly action: 'COMPARE';
  readonly stories: readonly AskCompareStoryRef[];
}

function usableUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length >= 8 && url.length <= URL_MAX && URL_SHAPE.test(url);
}

/** 2..8 distinct usable story URLs (by canonical identity), in the reader's order; else undefined. */
export function compareUrls(urls: readonly unknown[]): readonly string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!usableUrl(url)) return undefined;
    const key = normalizeArticleUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out.length >= COMPARE_MIN_STORIES && out.length <= COMPARE_MAX_STORIES ? out : undefined;
}

/** The launcher href: a draft arrival on /ask — opening it runs nothing. */
export function askCompareHref(urls: readonly string[], returnPath = '/'): string | undefined {
  const chosen = compareUrls(urls);
  if (chosen === undefined) return undefined;
  const params = new URLSearchParams();
  for (const url of chosen) params.append('compare', url);
  if (returnPath.startsWith('/') && !returnPath.startsWith('//')) params.set('return', returnPath);
  return `/ask?${params.toString()}`;
}

/** The /ask arrival: the staged URLs, or undefined (a crafted/oversized list stages nothing). */
export function dashboardCompareContext(
  params: Pick<URLSearchParams, 'getAll'>,
): readonly string[] | undefined {
  const raw = params.getAll('compare');
  if (raw.length === 0 || raw.length > COMPARE_MAX_STORIES * 2) return undefined;
  return compareUrls(raw);
}

/** sha256(normalizeArticleUrl(url)) as 64 lowercase hex — the server's computeArticleRef. */
export async function articleRefOf(url: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeArticleUrl(url));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The SELECTION reference sent on the reader's Ask (never on arrival). */
export async function askCompareRef(urls: readonly string[]): Promise<AskCompareRef | undefined> {
  const chosen = compareUrls(urls);
  if (chosen === undefined) return undefined;
  const stories = await Promise.all(
    chosen.map(async (url) => ({ articleRef: await articleRefOf(url), url })),
  );
  return { kind: 'SELECTION', action: 'COMPARE', stories };
}
