import type { MarketRetainedProcurementNotice } from '@globalnews-ai/shared';

export type MarketProcurementReadResult =
  | { readonly kind: 'PROCUREMENT'; readonly notices: readonly MarketRetainedProcurementNotice[] }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: 'NO_READ_ENDPOINT' | 'NO_PROCUREMENT_STORED' | 'NO_DISPLAYABLE_PROCUREMENT' };
