import type { MarketRetainedProcurementNotice } from '@globalnews-ai/shared';
import { resolveApiBaseUrl } from '@/lib/api/apiBase';

export type MarketProcurementReadResult =
  | { readonly kind: 'PROCUREMENT'; readonly notices: readonly MarketRetainedProcurementNotice[] }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: 'NO_READ_ENDPOINT' | 'NO_PROCUREMENT_STORED' | 'NO_DISPLAYABLE_PROCUREMENT' };

export const MARKET_TED_RETAINED_ONLY = true as const;

export async function readMarketProcurement(): Promise<MarketProcurementReadResult> {
  const target = typeof window === 'undefined'
    ? `${resolveApiBaseUrl()}/market/procurement`
    : '/market-data/procurement';
  try {
    const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { kind: 'UNAVAILABLE', reason: 'NO_READ_ENDPOINT' };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { kind: 'UNAVAILABLE', reason: 'NO_DISPLAYABLE_PROCUREMENT' };
    if (payload.length === 0) return { kind: 'UNAVAILABLE', reason: 'NO_PROCUREMENT_STORED' };
    return { kind: 'PROCUREMENT', notices: payload as MarketRetainedProcurementNotice[] };
  } catch {
    return { kind: 'UNAVAILABLE', reason: 'NO_READ_ENDPOINT' };
  }
}
