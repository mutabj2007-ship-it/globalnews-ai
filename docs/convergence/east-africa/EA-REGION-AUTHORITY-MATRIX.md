# Region authority matrix: East Africa, EAC, Europe, European Union, Middle East

Ledger item `EA-REGION-AUTHORITY-01`. Measured read-only on `integration/r4-east-africa-convergence-r1` (R4 + East Africa convergence on corrected R4 `db98d957`), 2026-10-05.

Five layers are kept apart on purpose. One region name can carry different memberships in different layers, and that is legitimate as long as each membership is labelled with its owner and purpose. A product coverage list is **not** evidence of retrieval, local-source coverage or monitoring.

## Where memberships are written

Only two places write a membership out.

| Authority | File | Holds |
|---|---|---|
| **Canonical geography** | `backend/src/modules/geo/supranational-membership.ts` | UN M49 subregions, political unions (EAC, EU), and contested regions with **no** members (Middle East, Horn of Africa, Great Lakes) |
| **Product-governed coverage scope** | `shared/src/global-reach-regions.ts` | `EAST_AFRICA_MEMBERS` (11), `MIDDLE_EAST_MEMBERS` (16), `EU27_MEMBERS` (27) |

Every other layer reads one of these two. The literal copies are listed under "Drift" below.

## The matrix

Counts are member countries. "→ X" means the layer reads that authority.

| Region | Geographic definition | Product coverage definition | Source-pack definition | Retrieval definition (Ask) | Monitoring definition |
|---|---|---|---|---|---|
| **East Africa** | `region:eastern-africa`, M49 "Eastern Africa" (alias "East Africa"): **18**. COD is in M49 *Middle* Africa. | `region:east-africa`, **PRODUCT_GOVERNED**: **11** (BDI COD DJI ERI ETH KEN RWA SOM SSD TZA UGA). SDN and ZMB are `excludedPending`. | Lane N `backend/source-packs/east-africa-r1`: **11** → product list ("Product Owner Alpha monitoring membership, alpha-1") | `DECLARED_REGIONS = [EAST_AFRICA]`: **11** → product list. Phrases: east africa, eastern africa, the horn of africa, east african | UCDP allowlist includes the **11** → product list. Watch uses geography (`region:eastern-africa`, 18); no product-region Watch path. |
| **EAC** | `EAC`, POLITICAL_UNION: **8** (BDI COD KEN RWA SOM SSD TZA UGA; Somalia effective 2024-03-04) | `region:east-african-community`, BACKEND_PUBLISHED → geography (8) | **NONE** (no EAC pack) | **No own definition.** The phrase "east african" matches "East African Community", so EAC questions retrieve the **11** (adds DJI ERI ETH). See R-1. | No EAC entry. All 8 are covered via the East Africa 11 in UCDP; Watch → geography (8). |
| **Europe** | `EUROPE_*`, M49 "Europe": **44** (CYP placed outside on purpose; XKX and QNC are outside M49) | `region:europe`, BACKEND_PUBLISHED → geography (44), labelled "NOT the European Union" | **NONE** (no Europe pack) | **NONE.** Falls through to a generic keyword search; `geo-resolver` refuses supranational phrases | No Europe entry. UCDP covers EU-27 only (non-EU Europe such as UKR, RUS, BLR, SRB is excluded). Watch → geography (44). |
| **European Union** | `EU`, POLITICAL_UNION: **27** | `EU27_MEMBERS` (27) in shared. **No** frontend declared region. | Lane P `backend/src/modules/source-packs/eu27`: **27**. Registry reads the *geographic* `EU`; `governance.json` holds an ISO2 copy | **NONE** (no declared region) | UCDP allowlist includes `EU27_MEMBERS` (27). Watch → geography (27). |
| **Middle East** | `CONTESTED_MEMBERSHIP`, **0 members**: "No agreed membership. UN M49 has no 'Middle East'…" | `region:middle-east`, **PRODUCT_GOVERNED**: **16** (BHR EGY IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR ARE YEM). `excludedPending`: CYP AFG PAK DZA LBY MAR TUN SDN. Labelled "not a claim that this membership is universally agreed". | Lane O `shared/source-packs/middle-east-r1`: **16**, scopeNote "GlobalNews AI monitoring construct, not a geopolitical boundary claim" | **NONE** (generic keyword search) | UCDP allowlist includes the **16**. Watch → geography (**0**: region level only, "no agreed membership"). |

Coverage accounting (`global-reach/coverage-check.ts`, `PRIORITY_REGIONS`) uses the product lists: EA 11, EU 27, ME 16.

**Verdict on the Middle East rule:** nowhere in the code presents "Middle East" as an agreed geographic definition. Every defining site disclaims it. The product's 16 are allowed as an explicit **PRODUCT-GOVERNED COVERAGE SCOPE**.

## East Africa baseline: the 11 countries by layer

All 11 are present in the product, source-pack, Ask-retrieval and UCDP-monitoring layers (one shared list). The differences are only in geography and Watch:

| ISO3 | M49 Eastern Africa | EAC | Watch (via geography) |
|---|---|---|---|
| BDI KEN RWA SOM SSD TZA UGA | yes | yes | yes |
| COD | **no** (M49 Middle Africa) | yes | via EAC only |
| DJI ERI ETH | yes | **no** | via Eastern Africa only |

This matrix records **which list** each layer uses. It is **not** a per-country measurement. The measured per-country state (local / official / regional-international sources, freshness, health, rights and use scope, retrieval outcome, retained evidence, coverage gaps) stays in `EA-CAPABILITY-REGISTER` and was **not re-measured** in this convergence: no live retrieval or provider spend is authorized here. Weak coverage stays recorded as a gap, never dropped. International or GNews articles never count as local coverage, and a provider failure is never "nothing happened".

## Findings (classified; none changed in this step)

| ID | Finding | Class | Who decides |
|---|---|---|---|
| R-1 | An **EAC** question is answered over the **11-country East Africa** scope (adds DJI ERI ETH, which are not EAC members). The phrase match is intended ("East African Community" selects the region), but the answer scope then is not EAC. | Truthfulness (scope label) | CTO/PO: either EAC becomes its own retrieval scope (→ geography 8), or the answer must disclose "East Africa product scope (11), not EAC (8)" |
| R-2 | `region:middle-east` is the **same id** for the contested geography (0) and the product scope (16). Any surface that resolves the id must say which one it shows. | Truthfulness (identity) | Design truth-binding: a selected Middle East region is always labelled product-governed |
| R-3 | `EU27_MEMBERS` is commented "the product-governed **Europe** membership", while frontend `region:europe` is M49 Europe (44, "NOT the EU"). | Documentation contradiction | Engineering: correct the shared comment to "EU-27" |
| R-4 | Retrieval phrases "eastern africa" and "the horn of africa" select the product 11, while geography defines Eastern Africa as M49 18 and the Horn as contested. | Scope label | Same decision as R-1 (disclose the product scope in the answer) |
| R-5 | Watch has no product-region path: watching "East Africa" uses geographic Eastern Africa (18), not the governed 11. | Capability gap | Part of the Watch roadmap (J-items). Not to be presented as available. |
| R-6 | Europe (non-EU) and EAC have no source pack, no retrieval and no own monitoring. | Coverage gap (declared, not a defect) | Register as COVERAGE_GAP / NOT_ASSESSED |
| R-7 | Drift copies: `east-africa.tranche.ts` `EAC_ISO2_BY_ISO3` restates EAC (contradicting its own comment); literal 11 / 16 copies in `build-east-africa.mjs`, `east-africa-r1/index.json`, `verify-middle-east-source-packs.mjs`, `middle-east-r1/pack.json`; EU held three times (geography, shared, `eu27/governance.json` ISO2). All agree today. | Drift risk | Engineering: a spec that asserts the copies match their authority |
| R-8 | `geographyScope.ts:170` says the Middle East "spans Asia, Africa and Europe". By `COUNTRIES.region` the 16 are Asia (15) and Africa (EGY). | Comment inaccuracy | Engineering |

Not verified: the claim that the East Africa breadcrumb camera box (`breadcrumbs.ts:150-155`) leaves out DJI and ERI. That came from a coordinate reading, not a render.

## Layer ownership

| Layer | Owner | Rule |
|---|---|---|
| Geographic | canonical geography module | Never invent a membership for a contested region |
| Product coverage | Product Owner (declared scope) | Always labelled PRODUCT_GOVERNED; never presented as agreed geography |
| Source-pack | East Africa / evidence lane | Packs follow the product list; navigation geography does not define completeness |
| Retrieval | Ask (one backend) | A region is retrievable only when declared; today only East Africa is |
| Monitoring | Monitoring lane | Coverage of a list is not live local-source coverage of each member |
