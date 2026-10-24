/*
  CTO R169 HAZARD B — the coverage-leads control is switched in CODE, not by a build-time
  NEXT_PUBLIC_* variable. A frontend variable change on Railway can rebuild the service from a stale
  source pin, and a NEXT_PUBLIC value set after a build does nothing at all. So activation is ONE
  reviewed commit that sets this to `true` together with the backend's governed E1 use record,
  deployed by exact SHA; rolling back is redeploying the previous exact SHA. Nothing else turns it on.
*/
export const COVERAGE_LEADS_UI_ENABLED = false;
