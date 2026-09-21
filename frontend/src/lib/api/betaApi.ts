import type { BetaCategory, BetaCategoryView } from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §15/§16/§17 — the public Beta category client.
 *
 * Called from SERVER components, so the category surfaces render on
 * the first paint with real content — which §21 needs, since these
 * are the routes intended to be publicly indexable (unlike Ask).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Short, because this endpoint performs no AI work — it is a bounded
 * SELECT over stored articles (§16). If it has not answered in five
 * seconds something is wrong upstream, and a public page should show
 * its empty state rather than hang. Contrast analysisApi.ts's 30s,
 * which has to accommodate a real model call.
 */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * How long Next.js may serve a cached copy of a category view.
 *
 * §16's rule is about not running AI, and this endpoint runs none —
 * but caching still matters here for a different reason: these are
 * public, potentially crawled routes, and an uncached one would issue
 * a database query per crawler hit. 120s keeps a "current
 * developments" surface honest (the corpus does not move faster than
 * that in practice) while collapsing burst traffic to one query.
 */
const REVALIDATE_SECONDS = 120;

export interface FetchCategoryViewOptions {
  category: BetaCategory;
  countryCode?: string;
}

/**
 * Fetches a category view.
 *
 * Returns null instead of throwing. A category page must render
 * something useful even when the backend is unreachable — §17's
 * contract includes a freshness signal and evidence counts precisely
 * so an empty surface can say "nothing current" honestly, and a
 * thrown error would instead produce a Next.js error boundary on a
 * public marketing-facing route.
 */
export async function fetchCategoryView(
  options: FetchCategoryViewOptions,
): Promise<BetaCategoryView | null> {
  const params = new URLSearchParams();
  if (options.countryCode) params.set('country', options.countryCode);

  const query = params.toString();
  const url = `${API_BASE_URL}/beta/categories/${options.category}${query ? `?${query}` : ''}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;
    return (await response.json()) as BetaCategoryView;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
