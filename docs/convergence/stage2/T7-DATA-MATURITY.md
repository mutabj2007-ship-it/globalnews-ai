# T7 — Data Maturity / Real Sources Ranking (Stage 2)

Measured at Alpha runtime `5513275f`. Sources are from `../07-SOURCE-ADMISSION-REGISTRY.json` (348 records) and coverage from `../08-SOURCE-COVERAGE-MATRIX.md`. Per the contract, **visual previews and NOT_ASSESSED reads are not working modules**.

## Classification per module

| Rank | Module | Retained real evidence | Official / current source | Local source | Rights state | Freshness | Citation | Ask binding | Coverage gaps |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Market (TED procurement)** | yes, TED notices (operator capture) | official (EU TED) | international/EU (not local per country) | **E-5 cleared** | single retained capture; no scheduler bound | yes | ASK_BOUND (scan-order defect) | non-EU countries; no local procurement portals |
| 2 | **Conflict (UCDP Candidate)** | yes, retained event records | research/official-adjacent (UCDP) | international | **E-5 cleared** (Candidate); UCDP GED API **credential-blocked** (no setting) | retained capture via script (bypasses safe-fetch) | yes | ASK_BOUND (**over-selects**, T3) | no local reporting layer; GED current feed blocked |
| 3 | **Economy (NISR CPI)** | yes, RWA CPI series | official national statistics | **local (RWA)** | **unresolved** (rw-nisr RIGHTS-RECORD-UNRESOLVED yet served) | retained release (2026-08 reference period) | yes | ASK_BOUND (RWA only) | every other country; Eurostat producer unbound |
| 4 | **Imihigo (NISR)** | yes, retained evaluation (capture 2026-09-22) | official | local (RWA) | **self-declared CC BY**, no rights-evaluator record | closed cycle 2024/25 | yes | ASK_BOUND | RWA only |
| 5 | **Energy (Eurostat)** | yes, one retained capture (`nrg_cb_pem`) | official (Eurostat) | international/EU | **E-5 cleared** (Eurostat) | single capture; ENTSO-E **credential-blocked** | no | RETAINED_ONLY (not Ask-bound; questions leak to Conflict) | non-EU; no current acquisition |
| 6 | **Election (IEBC)** | IEBC PDF bundle committed (KE) | official electoral authority | local (KE) | admission policy only, **no rights record** | fixed artifact | no | RETAINED_ONLY, reader flag off | **not a global Election product**: calendar, races, results, polling and voting areas absent elsewhere |
| 7 | **Politics** | Alpha: none (ledger `[]`). Lane: observation store, local-test only | — | — | unknown (lane) | — | no | not bound | everything until the lane lands a rights-cleared source |
| 8 | **Humanitarian** | Alpha: none (constant NOT_ASSESSED). Lane: specialist adapter | Copernicus EMS (E-5 **CONDITIONAL**); ReliefWeb/HDX/OCHA/ACLED **absent** | — | conditional / credential-dependent (needs approved org identity) | — | no | honest NOT_ASSESSED | everything until the lane's convergence gate |
| 9 | **Security** | `SecurityObservation` store, no producer imported | — | — | unknown | — | no | not bound | served via Conflict only |
| 10 | **Signals** | none (live-only GDELT GEO / Event Registry, unbound) | — | — | no rights record | — | no | not bound | retire or bind decision (P3) |
| — | **News (all Ask answers)** | `Article` retained + GNews live | aggregator | **0 active local in 54 priority countries** | GNews: **no rights record, under E1/legal review** (not accepted, not disabled) | live | yes | ASK_BOUND | **COVERAGE_GAP everywhere** (T1 makes this explicit) |

**Not counted as working:**
- the `*-visual-preview` routes (Politics, Economy, Election, Security, Delivery);
- `/politics/observations`, `/security/observations/:cc` and `/humanitarian/observations`, which all return constant NOT_ASSESSED.

## Priority actions (contract order)

1. **Politics: a real rights-cleared source.** This belongs to the Politics lane. Cloud contributes the binding contract (T6) and a rights-registry entry shape (T1 registry), and will not implement the lane.
2. **Humanitarian: a real retained reader.** This belongs to the Humanitarian lane. Credential-dependent sources stay blocked until approved organization identity exists (stop condition).
3. **Election beyond the narrow Kenya read.** Build the Election capability matrix (calendar, authority, race/district, results, polling, voting area, candidate/party facts) as a separate authority from Politics. First step: a rights record for IEBC.
4. **Energy acquisition.**
   - Bind the Eurostat retained store as an ENERGY contributor once the seam is free.
   - Wire a scheduled, safe-fetch Eurostat acquisition (the capture script currently uses plain `fetch()`).
   - ENTSO-E needs a token setting (credential, stop condition).
5. **Deeper Economy and Market local official coverage.**
   - Resolve the rw-nisr rights record.
   - Bind the Eurostat economy producer.
   - Fix procurement filter-then-limit.
   - Add local official statistics from the East Africa / EU-27 packs (CENTRAL_BANK, OFFICIAL_STATISTICS roles: 54 + 54 listed entries, all disabled) **only after per-source rights clearance**.

## Rights/credential decisions that block real data (escalate; not routine)

| Item | Needed from |
|---|---|
| GNews commercial / public-display rights | E1 / legal (Product Owner) |
| rw-nisr, Imihigo and IEBC rights records | E1 |
| UCDP GED API token, ENTSO-E token, Event Registry key | credentials / company identity |
| Humanitarian credential sources (e.g. organization-registered APIs) | approved organization identity / email |
