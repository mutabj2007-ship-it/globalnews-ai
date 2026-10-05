/** Existing product-governed memberships, shared by map and source accounting. */
export const MIDDLE_EAST_MEMBERS: readonly string[] = Object.freeze([
  'BHR',
  'EGY',
  'IRN',
  'IRQ',
  'ISR',
  'JOR',
  'KWT',
  'LBN',
  'OMN',
  'PSE',
  'QAT',
  'SAU',
  'SYR',
  'TUR',
  'ARE',
  'YEM',
]);
export const EAST_AFRICA_MEMBERS: readonly string[] = Object.freeze([
  'BDI',
  'COD',
  'DJI',
  'ERI',
  'ETH',
  'KEN',
  'RWA',
  'SOM',
  'SSD',
  'TZA',
  'UGA',
]);


/**
 * EU-27 local-source/accounting baseline: the European UNION's 27 members, used for coverage
 * accounting. It is NOT "Europe" (UN M49 Europe = 44, see canonical geography; strategic adjacent
 * Europe is separate). [R-3 correction: this comment previously called it the Europe membership.]
 */
export const EU27_MEMBERS: readonly string[] = Object.freeze([
  'AUT','BEL','BGR','HRV','CYP','CZE','DNK','EST','FIN','FRA','DEU','GRC','HUN','IRL',
  'ITA','LVA','LTU','LUX','MLT','NLD','POL','PRT','ROU','SVK','SVN','ESP','SWE',
]);

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT COVERAGE SCOPES — ONE LABEL + DISCLOSURE AUTHORITY (CTO R-2, 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The product's regional lists are PRODUCT-GOVERNED coverage/monitoring scopes, not geographic
 * definitions (docs/convergence/east-africa/EA-REGION-AUTHORITY-MATRIX.md). Every reader-facing
 * surface that shows one of these lists (map, visual Home, Admin) names it with `scopeLabel` and
 * may show `disclosure`; none may present it as agreed geography. A scope says WHICH countries are
 * monitored, never that each has live local-source coverage: per-country coverage is reported
 * separately by the coverage/retrieval contracts.
 */
export type ProductScopeGeographicStatus =
  /** canonical geography records no agreed membership (Middle East) */
  | 'CONTESTED_MEMBERSHIP'
  /** a geographic region of a similar name exists with a different membership (East Africa) */
  | 'DIFFERS_FROM_GEOGRAPHY'
  /** identical to a political union's published membership (EU-27) */
  | 'MATCHES_POLITICAL_UNION';

export interface ProductCoverageScope {
  readonly id: string;
  readonly scopeLabel: string;
  readonly basis: 'PRODUCT_GOVERNED';
  readonly geographicStatus: ProductScopeGeographicStatus;
  readonly members: readonly string[];
  readonly disclosure: string;
}

export const PRODUCT_COVERAGE_SCOPES: readonly ProductCoverageScope[] = Object.freeze([
  Object.freeze({
    id: 'region:middle-east',
    scopeLabel: 'GlobalNewsAI Middle East monitoring scope',
    basis: 'PRODUCT_GOVERNED' as const,
    geographicStatus: 'CONTESTED_MEMBERSHIP' as const,
    members: MIDDLE_EAST_MEMBERS,
    disclosure:
      'The 16 countries GlobalNewsAI monitors under "Middle East". There is no agreed geographic membership of the Middle East; this is the product’s monitoring scope, not a geographic definition. Which countries actually have current data is shown separately.',
  }),
  Object.freeze({
    id: 'region:east-africa',
    scopeLabel: 'GlobalNewsAI East Africa scope',
    basis: 'PRODUCT_GOVERNED' as const,
    geographicStatus: 'DIFFERS_FROM_GEOGRAPHY' as const,
    members: EAST_AFRICA_MEMBERS,
    disclosure:
      'The 11 countries GlobalNewsAI covers as East Africa. This is not the UN "Eastern Africa" region and not the East African Community (8 member states). Which countries actually have current data is shown separately.',
  }),
  Object.freeze({
    id: 'region:european-union',
    scopeLabel: 'European Union (EU-27)',
    basis: 'PRODUCT_GOVERNED' as const,
    geographicStatus: 'MATCHES_POLITICAL_UNION' as const,
    members: EU27_MEMBERS,
    disclosure:
      'The 27 member states of the European Union. Not "Europe" as a whole. Which countries actually have current data is shown separately.',
  }),
]);

export function productCoverageScope(id: string): ProductCoverageScope | undefined {
  return PRODUCT_COVERAGE_SCOPES.find((scope) => scope.id === id);
}
