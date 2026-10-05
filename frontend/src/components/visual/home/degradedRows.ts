import { HOME_REGION_ORDER, productCoverageScope, type HomeRegionRow } from '@globalnews-ai/shared';

/** When the editorial read failed: three UNAVAILABLE rows in the governed order — never "nothing happened". */
export function degradedRows(): HomeRegionRow[] {
  return HOME_REGION_ORDER.map((id) => {
    const scope = productCoverageScope(id);
    return {
      id,
      scopeLabel: scope?.scopeLabel ?? id,
      disclosure: scope?.disclosure ?? '',
      memberCount: scope?.members.length ?? 0,
      state: 'UNAVAILABLE' as const,
      stories: [],
      counts: { recent: 0, total: 0 },
    };
  });
}
