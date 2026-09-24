export const TED_PROCUREMENT_R1 = Object.freeze({
  providerId: 'TED',
  endpointId: 'TED_SEARCH_V3',
  sourceUrl: 'https://api.ted.europa.eu/v3/notices/search',
  requestPath: 'v3/notices/search',
  parserId: 'ted-search-v3-procurement',
  parserVersion: '1',
  limit: 25,
  query:
    'publication-date>=20260923 AND buyer-country IN (AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE) SORT BY publication-date DESC',
  fields: Object.freeze([
    'publication-number',
    'publication-date',
    'notice-type',
    'notice-title',
    'buyer-name',
    'buyer-country',
    'classification-cpv',
    'total-value',
    'total-value-cur',
    'deadline-receipt-tender-date-lot',
    'deadline-receipt-tender-time-lot',
  ]),
  page: 1,
  scope: 'ALL',
  paginationMode: 'PAGE_NUMBER',
  onlyLatestVersions: true,
});

export function tedProcurementRequestBody(): Record<string, unknown> {
  return {
    query: TED_PROCUREMENT_R1.query,
    fields: [...TED_PROCUREMENT_R1.fields],
    page: TED_PROCUREMENT_R1.page,
    limit: TED_PROCUREMENT_R1.limit,
    scope: TED_PROCUREMENT_R1.scope,
    checkQuerySyntax: false,
    paginationMode: TED_PROCUREMENT_R1.paginationMode,
    onlyLatestVersions: TED_PROCUREMENT_R1.onlyLatestVersions,
  };
}
