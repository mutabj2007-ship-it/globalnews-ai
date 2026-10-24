/*
  CTO R169 HAZARD B — the coverage-leads control is switched in CODE, not by a build-time
  NEXT_PUBLIC_* variable. A frontend variable change on Railway can rebuild the service from a stale
  source pin, and a NEXT_PUBLIC value set after a build does nothing at all. So activation is ONE
  reviewed commit that sets this to `true` together with the backend's governed E1 use record,
  deployed by exact SHA; rolling back is redeploying the previous exact SHA. Nothing else turns it on.
*/
export const COVERAGE_LEADS_UI_ENABLED = false;

/*
  CTO R174 (24 Oct 2026) — OFF again as containment: the GDELT DOC API answered HTTP 429 to Alpha's
  backend on the one authorized probe (#95 6382273763), so a button that can only say "not available"
  is hidden. The backend is switched off too (GDELT_LEAD_DISCOVERY_ENABLED=false on Alpha). All
  feature code, its budget and its reviews stay in place for re-activation once GDELT answers.
*/
