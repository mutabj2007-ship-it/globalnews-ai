# BETA-PREFLIGHT-AUDIT-R1

Assignment: GitHub Issue #27 — BETA-LAUNCH-CONVERGENCE-R1 Claude Code preflight, Phase 0.
Authority: `docs/BETA-LAUNCH-CONVERGENCE-R1.md` @ `e801495b977c6cba7d2ac4c52e965dfc7a63ff0c`.
Branch: `integration/beta-launch-convergence-r1`.
Audit date: 2026-09-25.

## 0. Scope and honesty statement

This is an AUDIT ONLY. No UI was redesigned, no provider activated, no Production
deployment made, no custom domain bound, no Railway configuration changed.

**What was measured:** the repository source tree at `e801495`, plus real local test and
build runs recorded in §G.

**What was NOT measured, and must not be read as measured:** the contents of the live
Alpha or Production databases. Every coverage classification in §B is derived from the
*code-declared admitted scope* of each capture — the allowlists, `geo` pins and
country filters that decide what a capture is permitted to admit. Whether a permitted
country actually has stored rows today requires a read against the Alpha database, which
this phase did not authorize. Rows are therefore classified by ELIGIBILITY, and every
such cell is marked accordingly. This distinction is the difference between "the pipeline
may admit this country" and "this country has data", and §4 of the authority exists
precisely because those two have been conflated before.

Railway deployment SHAs, domain state and service inventory in §F are reproduced from the
authority document's own §1 plus environment identifiers found in source; no Railway API
was called.

---

## A. Route matrix

Every user-facing surface that exists on this branch. `robots` is the EFFECTIVE state:
`frontend/src/lib/seo/routes.ts` is the single registry that page metadata, `robots.ts`
and `sitemap.ts` all read, and its `classify()` default is `noindex` for any unlisted
path. Machine-readable: `docs/beta/evidence/route-matrix.csv`.

| Route | Status | Home card destination | robots | Desktop file | Compact/mobile file | Real data reader | Retained/provider source | Primary data on first screen | Useful data behind drawer/lens | Fixtures can reach | EN/PL | Alpha visible |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | public | — (is the entry) | **index** + sitemap | `app/page.tsx` | same, responsive + `MobileBottomNav` | `lib/homeFeed.ts` → `fetchTopHeadlines` | GNews live / cached / mock (`NewsDataMode`) | yes — feed + Engine | no | mock mode only if zero real providers; fail-closed in prod by `NewsStartupValidator` | platform dictionary `en.ts`/`pl.ts` | yes |
| `/map` | public | Country Intelligence (`active`) | **index** + sitemap | `app/map/page.tsx` | no `/compact`; responsive shell | `MapPageClient`, `geo` module | reference geography + conflict observations | yes | partial — lenses/HUD | no | platform dictionary | yes |
| `/conflict` | public | Conflict (`preview`) | noindex | `app/conflict/page.tsx` (18 ln) | **none** | **client-side** `fetch('/conflict-data/observations?limit=500')` in `ConflictDashboard.tsx:97` | UCDP Candidate CSV v26.0.8 (Aug 2026), one reviewed digest | **no — client fetch after hydration** | evidence via `lib/conflict/evidenceDetail.ts` | test harness mocks the endpoint | `lib/conflict/strings.ts` (module-local) | yes |
| `/energy` | public | Energy (`preview`) | noindex | `app/energy/page.tsx` | **none** | `lib/energy/energyReadModel.ts` → `GET /energy/observations` | Eurostat PEM, **`geo` pinned to `ES`** | yes but see §C-1 | raw provenance dominates the primary frame | `energyFixtures.ts` present in source; route always renders governed frame | `energyStrings.ts` + fallback disclosure | yes |
| `/market`, `/market/compact` | public | Market (`preview`) | noindex | `app/market/page.tsx` | `app/market/compact/page.tsx` | `mktReadModel.ts`, `mktProcurementRead.ts` | TED, **`buyer-country IN (POL)`**, one publication date `20260924` | yes | no | no | `mktStrings.ts`, **no `pl:` key found** + fallback disclosure | yes |
| `/humanitarian`, `/humanitarian/compact` | public | Humanitarian (`preview`) | noindex | `app/humanitarian/page.tsx` | `app/humanitarian/compact/page.tsx` | `humanitarianRead.ts` | Copernicus EMS producer; page states DEGRADED is the production state | degraded frame | no | none by design (no fixture route) | `humStrings.ts` + fallback disclosure | yes |
| `/economy-visual-preview`, `/compact` | **preview family** | Economy (`preview`) | noindex | `app/economy-visual-preview/page.tsx` | `.../compact/page.tsx` | `economyObservationRead.ts` → `GET /economy/observations` | NISR CPI Rwanda (`rw-nisr`, `enabled:false`), Eurostat registered-not-enabled | marker strip + retained or absence frame | no | `lib/economy/fixtures.ts` imported by spec only | `economy/strings.ts` + fallback | yes |
| `/politics-visual-preview`, `/compact` | **preview family** | Politics (`preview`) | noindex | `app/politics-visual-preview/page.tsx` | `.../compact/page.tsx` | `politicsReadModel.ts` → `GET /politics/observations` | offline producer, no fetch/schedule | absence frame | no | no | `politicsStrings.ts` + fallback | yes |
| `/security-visual-preview`, `/compact` | **preview family** | Security (`preview`) | noindex | `app/security-visual-preview/page.tsx` | `.../compact/page.tsx` | **none — no read model exists** | **none** | **no data of any kind** | n/a | no | `securityStrings.ts`, **no `pl:` key found** | yes |
| `/election-visual-preview`, `/compact` | **preview family, ORPHAN** | none | noindex | `app/election-visual-preview/page.tsx` | `.../compact/page.tsx` | `lib/evidence/retainedReaders.ts` `readElection` | retained election evidence | n/a | n/a | no | `electionStrings.ts` | reachable by URL only |
| `/delivery-visual-preview`, `/compact` | **preview family, ORPHAN** | none | noindex | `app/delivery-visual-preview/page.tsx` | `.../compact/page.tsx` | **none — provider-free archived preview** | none | n/a | n/a | it *is* the archived preview | `deliveryStrings.ts` | reachable by URL only |
| `/imihigo`, `/imihigo/compact` | public, **effectively orphan** | none | noindex (compact re-exports parent metadata) | `app/imihigo/page.tsx` | `app/imihigo/compact/page.tsx` | `lib/imihigo/retainedReader.ts` | NISR Imihigo 2024/25 PDF, **Rwanda only**, `data/imihigo/` | yes | optional source details | no | `deliveryStrings.ts` | only inbound link is `/workspace`, itself orphaned |
| `/ask` | public | — (Ask dock / bottom nav) | noindex | `app/ask/page.tsx` | responsive | `AskFrameScreen` | analysis pipeline on explicit submit | n/a | n/a | no | `askStrings.ts` + fallback | yes |
| `/search` | public | — (Ask/Analysis entry) | noindex, `userDependent` | `app/search/page.tsx` | responsive | `SearchPageClient` | analysis pipeline | n/a | n/a | no | platform dictionary | yes |
| `/workspace` | **internal prototype, ORPHAN** | none | noindex, `ruling:'main'` | `app/workspace/page.tsx` (421 ln) | responsive | none — static capability list | none | n/a | n/a | it is a static list | platform dictionary | reachable by URL only |
| **World Intelligence** | **NO SURFACE** | card present, `comingSoon`, **no destination** | n/a | **absent** | **absent** | — | — | — | — | — | — | card is inert by `isModuleNavigable` |
| `/privacy`, `/terms`, `/source-policy` | public legal | footer | **index** + sitemap | static | responsive | — | — | yes | no | no | platform dictionary | yes |
| `/support`, `/history`, `/account/settings`, `/admin/**` | private | — | noindex, `userDependent` | various | various | account/admin APIs | — | n/a | n/a | no | platform + admin/support dictionaries | yes |

### A-findings

**A-1. Not one intelligence module route is indexable.** `PUBLIC_ROUTES` in
`frontend/src/lib/seo/routes.ts:46` contains exactly five paths: `/`, `/map`,
`/source-policy`, `/privacy`, `/terms`. Every specialist surface — Conflict, Energy,
Market, Humanitarian, Economy, Politics, Security, Imihigo, Ask — falls through
`classify()` to the `noindex` default, and `sitemapRoutes()` requires
`sitemap && index && !userDependent`, so none can appear in the sitemap. A public Beta
launched from this branch would ship an intelligence product that no search engine may
list.

**A-2. `sitemap.ts` returns `[]` on Alpha unconditionally** (`isAlphaEnvironment()` guard,
`sitemap.ts:47`), and returns `[]` on any environment where `NEXT_PUBLIC_SITE_URL` is
unset or invalid (`resolveSiteOrigin()` fails closed to `null`). Binding
globalnewsai.live without setting that variable yields a live site with an empty sitemap
and no canonical tags.

**A-3. Three of the nine Home cards point at `*-visual-preview` routes.** Economy,
Politics and Security have no canonical route: `frontend/src/app/economy/` does not exist
on this branch (verified absent), and `/politics` and `/security` are likewise absent. The
reader-facing destination for three of nine modules is an Alpha inspection surface.

**A-4. Seven of nine header nav items are non-routing.** `frontend/src/lib/navModel.ts`
renders nine items in the approved Claude Design order, but only Home and World Map are
`kind:'route'`. World, Politics, Business, Technology, Science, Health and About are
`kind:'unavailable'` with no `href` — a deliberate quota suspension
(`H-PUBLIC-NAV-QUOTA-SAFETY-1`), honestly labelled, but it means the primary header offers
a first-time Beta visitor two working destinations.

**A-5. `/conflict` and `/energy` have no compact route** while Market, Humanitarian,
Economy, Politics, Security, Election, Delivery and Imihigo all do. `/conflict` also
fetches its observations client-side after hydration, so its first paint carries no data.

**A-6. Four orphaned public routes.** `/election-visual-preview` and
`/delivery-visual-preview` have zero inbound links anywhere in `frontend/src`.
`/workspace` has none either, and `/imihigo`'s only inbound link is from `/workspace`.
All four are reachable by direct URL and are `noindex`.

**A-7. `/map` first-load JS is 860 kB and `/conflict` 830 kB** (measured, §G build). These
are the two heaviest Beta surfaces and both are phone destinations.

---

## B. Data coverage matrix

Declared regions, from `shared/src/global-reach-regions.ts` — East Africa 11, EU-27 27,
Middle East 16 = **54 countries**.

Per-country CSV: `docs/beta/evidence/coverage-matrix.csv`.

### B-1 Summary by module (code-declared admitted scope)

| Module | Provider / source class | Reader / endpoint | Code-declared admitted scope | EA 11 | EU-27 27 | ME 16 |
|---|---|---|---|---|---|---|
| Conflict | UCDP Candidate CSV v26.0.8, digest-reviewed, CC BY 4.0 | `GET /conflict-data/observations` → `conflict-observation.controller.ts` | **allowlist = all 54** (`ucdp-candidate.reviewed.ts:17`) | 11 ELIGIBLE | 27 ELIGIBLE | 16 ELIGIBLE |
| Energy | Eurostat PEM (`nrg_pem`) | `GET /energy/observations` | **`geo` pinned to `ES`**, `GEO_DRIFT` throws on anything else (`energy-eurostat-pem.ts:18,148`) | 0 | **1** (ESP) | 0 |
| Market | TED procurement notices | `GET /market/...` → `market-read.controller.ts` | **`buyer-country IN (POL)`**, single-notice refusal if not exactly `POL` (`ted-procurement-retained.ts:8,257`) | 0 | **1** (POL) | 0 |
| Economy | NISR CPI Rwanda (`rw-nisr`); Eurostat economy producer | `GET /economy/observations` | Rwanda CPI retained; NISR normalizer declares `enabled:false`, `ingestionMethod:'none'`; Eurostat registered, not enabled | **1** (RWA, gated) | 0 | 0 |
| Imihigo / Delivery | NISR Imihigo Evaluation Report 2024/25 PDF | `lib/imihigo/retainedReader.ts` (local `data/imihigo/`) | **Rwanda only**, 27 districts + City of Kigali, one cycle, no schedule | **1** (RWA) | 0 | 0 |
| Humanitarian | Copernicus EMS producer | `GET /humanitarian/...` | no country allowlist declared; page states DEGRADED is the production state, five of seven change states have no producer | 0 declared | 0 declared | 0 declared |
| Politics | offline producer, no fetch/schedule (`politics.producer.ts:54`) | `GET /politics/observations` | none | 0 | 0 | 0 |
| Security | **no producer, no read model** | none | none | 0 | 0 | 0 |
| Country / Map | reference geography, East Africa tranche | `geo` module | geography reference, not domain observations | n/a | n/a | n/a |
| World | **no surface** | — | — | — | — | — |

### B-2 Measured cell tally — 8 domain modules x 54 declared countries = 432 cells

Generated into `docs/beta/evidence/coverage-matrix.csv`. Country/Map (reference geography)
and World (no surface) are excluded from the per-country domain tally and reported in B-1.

| Classification | Cells | Share | Which |
|---|---|---|---|
| `DATA_AVAILABLE` | **3** | **0.7%** | ESP Energy, POL Market, RWA Imihigo |
| `PARTIAL` | 55 | 12.7% | 54 Conflict (allowlisted, one monthly artifact) + RWA Economy (gated) |
| `DELAYED` | 0 | 0% | none declared |
| `COVERAGE_GAP` | **374** | **86.6%** | the remainder |

No country silently disappears: all 54 appear in all 8 module blocks.

### B-findings

**B-1. Three of the four "successful retained one-shot captures" the authority cites are
single-country.** Energy is Spain. Market is Poland. Imihigo is Rwanda. Economy's only
retained subject is Rwanda CPI, and it is declared `enabled:false`. Authority §4 states
plainly: *"A single-country proof capture is a pipeline proof, not a Beta dataset."* By
that rule, Energy, Market, Economy and Imihigo each currently hold a pipeline proof, not a
Beta dataset.

**B-2. Measured against the 54 declared countries, code-declared coverage is:**
Conflict eligible for 54; Energy 1; Market 1; Economy 1 (gated); Imihigo 1; Humanitarian,
Politics, Security 0. Expressed as the authority's own vocabulary and counting a country
as `COVERAGE_GAP` where no source is permitted to admit it, **the three priority regions
carry 51 to 54 `COVERAGE_GAP` cells per module for six of the nine modules.**

**B-3. Conflict is the only module whose declared scope matches the declared product
regions.** Its allowlist is literally `[...EAST_AFRICA_MEMBERS, ...MIDDLE_EAST_MEMBERS,
...EU27_MEMBERS]`. This makes Conflict the only module that can satisfy §4's
"every declared country is accounted for" requirement without a new capture.

**B-4. Eurostat geography is structurally single-country, not merely unconfigured.**
`energy-eurostat-pem.ts` pins `{key:'geo', value:'ES'}` in the accepted request and
`singletonCode(dimension.geo, 'ES', 'GEO_DRIFT')` throws if the response carries any other
geography. Widening Energy to EU-27 is a reviewed source-authority change, not a
parameter edit.

**B-5. TED is pinned to one publication date as well as one country** —
`publication-date=20260924`. There is no cadence, so Market's retained holding does not
advance without a new reviewed capture.

---

## C. Front-end visibility audit

Data that exists in a read model but is not readable as intelligence.

**C-1. Energy renders real observations as a raw provenance dump labelled
`COVERAGE_GAP`.** `frontend/src/lib/energy/energyRetainedAdapter.ts:38` sets
`readerState: 'COVERAGE_GAP'` on **every** subject built from real admitted observations,
and line 40 sets `brief: null, headline: null, assessment: null`. The only content the
reader receives is `fields` — a fourteen-value key/value list per observation
(lines 43–48) whose members include `observationKey`, `retrievalId`, `subjectId`,
`spatialPrecision`, `evidenceRole` and `provenance.providerId`. The `evidence[].title`
at line 52 concatenates all of the same identifiers into one string.

This is three authority violations in one adapter:
- §3 — *"Raw IDs, parser/retrieval identities, hashes, revision internals … MUST NOT
  dominate the first public frame."* Here they are the entire frame.
- §3 — *"Withholding an assessment MUST NOT hide or visually suppress valid observed
  facts."* A real Spanish net-generation figure is labelled a coverage gap.
- §6 DATA — *"Known observations and unavailable assessments are visually distinct."*
  They are not; both render as `COVERAGE_GAP`.

Owner: `frontend/src/lib/energy/energyRetainedAdapter.ts` lines 36–56, consumed by
`components/energy/EnergyShell.tsx` via `app/energy/page.tsx:95`.

**C-2. `/conflict` has no server-rendered data.** `ConflictDashboard.tsx:97` fetches
`/conflict-data/observations?limit=500` from the client. First paint is empty for every
reader, and the surface is invisible to any non-JS consumer. `app/conflict/page.tsx` is 18
lines and performs no read.

**C-3. Security presents a dashboard shell with no data path at all.**
`frontend/src/lib/security/` contains `securityStrings.ts`, `securityZones.ts`,
`securityPublicReadLabel.ts` and a spec — no read model, no fetch. The card on Home is
badged `preview` and is clickable, so a reader can reach a Security Intelligence surface
that cannot ever show an observation.

**C-4. Eleven module-local string catalogues bypass the platform dictionary.**
`ask`, `conflict`, `delivery`, `economy`, `election`, `energy`, `humanitarian`, `market`,
`navigation`, `politics`, `security` each own a `*Strings.ts`. `mktStrings.ts` and
`securityStrings.ts` contain **no `pl:` key**; `conflict/strings.ts`,
`delivery/deliveryStrings.ts` and `election/electionStrings.ts` carry no fallback
disclosure. EN/PL parity is therefore per-module and unverified as a whole.

**C-5. Economy's richest content is in a fixture module, not a reader.**
`frontend/src/lib/energy/energyFixtures.ts` (and the Economy equivalent) contain fully
authored intelligence — "Both TSOs confirm NordBalt unavailability; cause assessed as
subsea fault", "European crude import cover revised from 14 to 11 days" — with headlines,
tones, change states and evidence counts. These are illustrative and must never reach a
reader. `app/energy/page.tsx:75-88` documents an explicit Alpha data-honesty correction
that keeps the public route on the governed frame, which is the right control; the risk is
that the fixture module and the public adapter share the same frame types, so a future
binding edit is one import away from publishing invented energy assessments.

**C-6. `/workspace` is a 421-line static capability list, registered `noindex` with
`ruling:'main'`** and flagged in its own registry entry as a surface whose §B category and
actual content disagree. It is an internal prototype on a public URL.

---

## D. Visual test inventory

No Jest result in this report is offered as a visual PASS. Machine-readable:
`docs/beta/evidence/visual-test-inventory.csv`.

| Runner | Targets | 1440 desktop | 390 phone | 360 | 430 | Populated real data | Multi-country | EN/PL | PO golden authority |
|---|---|---|---|---|---|---|---|---|---|
| `scripts/spatial-visual/` (Playwright, `retries:0`) | map / spatial frames | 2048 px goldens | no | no | no | yes (geography) | world + East Africa | no | **2 of 4 frames APPROVED**; V3 SELECTED COUNTRY and V4 EVIDENCE MODE are `PENDING` — gate refuses to certify |
| `scripts/ask-dashboard-browser.spec.cjs` | `/`, `/map`, `/search`, `/humanitarian` | 1440×900 | 390×844 | no | no | not asserted | no | no | no |
| `scripts/tests/conflict-browser.cjs` | `/conflict` | 1440 | 390 | no | no | **mocked** — `page.route('**/conflict-data/observations?*')` from `conflict-observation.fixture.json` | no | en + lang loop | no |
| `scripts/datafed/visual-authority-browser.mjs` | economy / evidence | 1440 | 390 | no (375) | 430 | **no — screenshots named `UI-FIXTURE`**, served from a stub `/economy/observations/rw-nisr-cpi` | no | **en + pl** | no |
| `scripts/datafed-evidence-browser.cjs` | `/`, `/humanitarian`, `/security-visual-preview`, compact | 1440 | 390 | no | no | not asserted | no | no | no |
| `scripts/imihigo/browser-validation.mjs` | `/imihigo` | 1440 | 390 | no (320/375) | 430 | yes — real retained NISR | Rwanda only | not asserted | no |
| `scripts/verify-election-preview.cjs` | `/election-visual-preview` | 1440 | 390 | no | no | retained election | no | no | no |

### D-findings

**D-1. No module has a 360×800 capture.** Authority §2(3) requires adaptation evidence for
360×800 and 430×932. Across every runner the widths used are 320, 375, 390, 430, 768, 1440
and 2048 — **360 appears nowhere**. Imihigo and datafed cover 430; nothing covers 360.

**D-2. Six modules have no browser capture at all:** Energy, Market, Economy (real-data
path), Politics, Security (beyond one datafed page visit), and Home as a governed frame.
`/energy` and `/market` — two Gate B modules — have zero Playwright coverage.

**D-3. The only multi-record populated captures that exist are fixture-driven or
single-country.** Conflict's populated state is a mocked fixture; datafed's economy
captures are explicitly filenamed `UI-FIXTURE` and served from a stub HTTP handler;
Imihigo's is real but Rwanda-only. **No runner captures a populated multi-country state
for any module**, which is precisely what authority §7 requires before a dashboard can be
accepted.

**D-4. Product Owner golden authority exists for two map frames and nothing else.**
`golden-authority.manifest.json` holds V1 WORLD and V2 RWANDA/EAST AFRICA as `APPROVED`,
V3 and V4 as `PENDING` with `filename: null`. There is no golden authority for Home or for
any specialist dashboard, so no specialist module can currently pass a golden gate.

**D-5. EN/PL browser evidence exists for the datafed economy path only.** Conflict loops a
language variable; every other runner captures one locale.

---

## E. Git cleanup / risk list

**E-1. Open PRs touching Beta-target modules — 2.**
- **#22 Alpha Market Procurement R1** (opened 2026-09-24). Authority §10 already rules it
  *"evidence/work-in-progress, not automatic merge material"* and §1 that it is *"NOT the
  Beta visual authority"*. It touches Market, a Gate B module.
- **#12 fix(alpha): retry transient next/font build fetch** (opened 2026-09-23). Build
  infrastructure; a `frontend-build-baseline-r1` worktree exists for the same concern.

**E-2. Branch population is a live merge hazard.** 134 local + 81 remote refs.
**213 of them do not contain the Beta base `e801495`, and only 3 contain the Alpha base
`df664f58`.** There are **25 `feature/beta-*` branches**. Merging any of those 25 wholesale
into this branch would revert the Energy Eurostat and Market TED work that landed in
`df664f58`. Authority §10's "no merging stale Alpha experimental branches without diff
review" is not a formality here — it is the default outcome of a wholesale merge.

**E-3. Fixtures and internal surfaces that could leak into public Beta.**
- `frontend/src/lib/energy/energyFixtures.ts` — authored energy assessments with real
  institution names and figures (see C-5).
- `frontend/src/lib/economy/fixtures.ts` — imported by `econContract.spec.ts` only today.
- `/workspace` — internal prototype on a public URL (C-6).
- `/delivery-visual-preview` — archived provider-free preview, orphaned but routable.
- `scripts/spatial-visual/fixtures/` and `scripts/tests/conflict-observation.fixture.json`
  — test-only, correctly outside `frontend/src`.

**E-4. Duplicated public/preview route families — 5.** `economy-visual-preview`,
`politics-visual-preview`, `security-visual-preview`, `election-visual-preview`,
`delivery-visual-preview`, each with its own `/compact` child. Three of them are the
*only* destination for a Home card (A-3); two are orphaned (A-6). Meanwhile
`econContract.spec.ts:812-815` still asserts against
`app/economy/fixture-demo/{page,compact,corridor,compact-corridor}` — paths that do not
exist on this branch, because `frontend/src/app/economy/` is absent.

**E-5. Route/indexability contradictions.** None in the emitted output — the registry is
genuinely single-source and `sitemapRoutes()` asserts the conjunction, which is a real
strength. The contradiction is at the product level: eight module surfaces are linked from
Home as reader destinations while being classified private-by-default
(A-1). `app/imihigo/compact/page.tsx` re-exports its parent's metadata rather than
declaring its own, so its `noindex` is inherited, not stated.

**E-6. Frontend deployment lag — the authority document overstates this one, and the
correction is favourable.** Authority §1 states the Alpha frontend deployment
`d49bd5a9` *"is behind the current integration head"*. By commit count that is true — 23
commits. **By content it is not: the `frontend/` tree hash is identical at both commits**
(`67a5915d58d37498beb7b59a299cba0a6b9385c6`). The 9 files that differ between
`d49bd5a9` and `e801495` are 6 backend Energy files, 2 CI workflows and the authority
document itself. The deployed Alpha frontend is therefore byte-current with the Beta base,
and existing Alpha visual observations remain valid evidence for the frontend.

**E-7. The test suite pins the source text of the files the Design authority must
rewrite.** This is the single largest mechanical obstacle to §9.
- **232 of 293 frontend spec files (79%) call `readFileSync`** and assert against source
  text rather than rendered behaviour.
- `frontend/src/lib/market/visualAuthorityCorrection.spec.ts` asserts **byte-identity
  against git base `e4e010ac`** for 12 files, including `MarketScreen.tsx`,
  `MarketCompactScreen.tsx`, `MktParts.tsx`, `mktTokens.ts`, and four
  `components/energy/*.tsx` files plus `energyTokens.ts`, `energyFrame.ts`,
  `energyUrl.ts`.
- `frontend/src/lib/evidence/visualAuthority.spec.ts` pins **8 files by sha256**, including
  `PoliticsScreen.tsx`, `PoliticsCompactScreen.tsx`, `PolParts.tsx`,
  `app/politics-visual-preview/page.tsx` and its compact child.

Twenty presentation files across Energy, Market, Politics and Election are byte- or
hash-frozen. **Both specs already fail on this branch** (§G), so the freeze is broken
before any Design work begins — the pins now protect nothing while still guaranteeing that
faithful reproduction of a new Design authority reports as a regression.

---

## F. Railway facts

Recorded, not called. No Railway configuration was read or changed in this phase.

| Fact | Value | Source |
|---|---|---|
| Alpha backend deployed commit | `df664f58324bf6aba08fd63b1df6da7b31089315` | authority §1 |
| Alpha frontend deployed commit | `d49bd5a9970fd7c0673f347a50f2cf5368750293` | authority §1 |
| Alpha frontend content vs Beta base | **identical `frontend/` tree** `67a5915d…` | measured, E-6 |
| Alpha environment id | `70105bf5-b195-41af-b237-8745c8e76506` | `lib/seo/deploymentEnvironment.ts:66` |
| Production environment id | `8f4c9c3e-21f5-4fc1-abed-89e3b30eaddc` | same, recorded as evidence only, never a trigger |
| Retained one-shot capture services | UCDP Conflict candidate; TED Market procurement; Eurostat Energy | authority §1, confirmed by `backend/src/tooling/{energy-eurostat-alpha-r1,ted-market-procurement-alpha-r1}.ts` |
| One-shot CI gates | `.github/workflows/alpha-energy-eurostat-r1-ci.yml`, `alpha-market-ted-capture-r1-ci.yml` | added in the 9-file delta, E-6 |
| Custom domain state | **globalnewsai.live attached to neither Alpha nor Production** | authority §1 |
| Current domains | Railway-generated domains remain in place | authority §1 |
| Production promotion | **not authorized** | authority §1, §11 |
| Site origin mechanism | `NEXT_PUBLIC_SITE_URL`, hard-validated, **fails closed to `null`** → no canonical, no `og:url`, empty sitemap | `lib/seo/siteOrigin.ts` |
| Alpha indexing posture | `sitemap.ts` returns `[]` whenever `RAILWAY_ENVIRONMENT_ID` matches the Alpha id | `app/sitemap.ts:47` |
| Noindex failure direction | anything other than an exact Alpha id match behaves as **Production** (deliberate asymmetry) | `deploymentEnvironment.ts` |
| Railway config in repo | **none** — no `railway.toml`, `nixpacks.*` or `Procfile` found | measured |
| Staged/pending Railway work | none found in repo | measured |

**F-1. Binding globalnewsai.live has a hard prerequisite.** `NEXT_PUBLIC_SITE_URL` must be
set on the Production frontend service before or with the domain bind, or the launched site
emits no canonical tags and an empty sitemap. Authority §11(6) should be read together
with this variable.

---

## G. Commands run, and measured results

All commands run inside the audit worktree, on `e801495`, with no source file modified.

| # | Command | Result |
|---|---|---|
| 1 | `git worktree add ../beta-preflight-r1 integration/beta-launch-convergence-r1` | HEAD `e801495`, authority file present, sha256 `b847312d4019eeccdcd7623a3d11377d9fabcf0ab2f3692fcac1c653b6adab09` |
| 2 | `npm install --no-audit --no-fund` | exit 0 |
| 3 | `npm run test:shared` | **PASS — 13/13 suites, 523/523 tests** |
| 4 | `npm run build:shared` | **exit 0** |
| 5 | `npx jest` (frontend) | **FAIL — 10 suites failed, 283 passed / 293; 15 tests failed, 6482 passed, 13 skipped** |
| 6 | `npx prisma generate` (backend) | Prisma Client 7.9.1 → `src/generated/prisma` |
| 7 | `npx jest` (backend, after 6) | **FAIL — 14 suites failed, 265 passed, 5 skipped / 284; 66 tests failed, 7343 passed, 154 skipped** |
| 8 | `npm run build:frontend` | **exit 0** — 35 routes emitted; `/map` 860 kB, `/conflict` 830 kB first-load JS |

Full logs: `docs/beta/evidence/` (`frontend-test-failures.txt`, `backend-test-failures.txt`).

### G-1. Backend test prerequisite that is not declared

The backend has **no `postinstall` and no `prisma generate` in its scripts**. A fresh
checkout reports **94 failed suites** purely because `PrismaService` has no generated
client (`Property 'snapshotRetrieval' does not exist on type 'PrismaService'`). After
`npx prisma generate` that falls to 14. Anyone bringing up a Beta module branch will hit
this first and may misread it as 94 real regressions.

### G-2. Frontend failures — 10 suites

| Suite | Character |
|---|---|
| `lib/market/visualAuthorityCorrection.spec.ts` | **byte-freeze broken** — `MarketScreen.tsx`, `MarketCompactScreen.tsx`, `mktContract.spec.ts` differ from base `e4e010ac` |
| `lib/evidence/visualAuthority.spec.ts` | **sha256 freeze broken** — 5 Politics/Election files differ from their pinned hashes |
| `lib/market/mktRetained.spec.ts`, `lib/market/marketSyntheticHarness.spec.ts` | suite failed to run |
| `components/admin/adminOperationalSurface.spec.ts`, `adminSupportSurface.spec.ts`, `lib/admin/adminProvenance.spec.ts` | admin provenance/capability assertions |
| `components/map/c911RequestEconomy.spec.ts` | homepage must not fetch on mount — provider-economy contract |
| `components/map/m51PhaseB.spec.ts`, `lib/map/mapShellRouteWiring.spec.ts` | map shell wiring |

### G-3. Backend failures — 14 suites, and how to read the 66

**53 of the individual failure blocks cite `DATABASE_URL is not configured` or
`ECONNREFUSED`** — this machine has no Postgres, and `PrismaService` throws at
construction (`database/prisma.service.ts:60`). Those are an environment prerequisite, not
defects: `admin.security.spec.ts`, `admin-convergence-http.spec.ts`,
`admin-passive-reads.spec.ts` and `convergence-assembly.spec.ts` need a database.

The remainder are genuine and environment-independent, and two groups matter for Beta:

- **`modules/analysis/region/declared-regions.spec.ts`** — 7 failures. These assert the
  **source text** of the analysis service, e.g. expecting the literal
  `this.retrievePerSideEvidence(members, requestedLanguage)`. The implementation has
  drifted from the pinned text. Directly Beta-relevant: this is the East Africa
  region-scope governance suite, and it includes
  *"membership comes from this module and from nothing else at request time"*.
- **`modules/news/news.service.spec.ts`, `news.module.spec.ts`,
  `news.service.{live-first-seen,post-relevance-fallback}.spec.ts`,
  `providers/gnews.provider.spec.ts`** — cached-fallback provenance, relevance-gate
  persistence, provider health states, and DI registration of
  `ALL_NEWS_PROVIDERS`. These govern the Home feed, which is the one module the authority
  sequences first.

I did not attempt to fix any of these; Issue #27 is audit-only.

---

## H. Top 10 Beta blockers, in priority order

**1. No intelligence route is indexable, and the sitemap cannot list one.**
`lib/seo/routes.ts` registers five public paths and none is a module. Launching the Beta
on globalnewsai.live from this branch ships a product that search engines may not list.
Fix is a governed policy decision plus one table — but it is a decision, not an edit, and
it gates §11.
*Owner: `frontend/src/lib/seo/routes.ts`. Blocks: public launch.*

**2. Energy publishes real observations as a raw-ID dump labelled `COVERAGE_GAP`.**
`energyRetainedAdapter.ts:38-52` — three §3/§6 violations in one adapter (C-1). The most
severe *reader-facing truth* defect found: a real figure presented as an absence.
*Owner: `frontend/src/lib/energy/energyRetainedAdapter.ts`. Blocks: Energy acceptance.*

**3. Twenty presentation files are byte/hash-frozen, and the freeze is already broken.**
E-7. Until `visualAuthorityCorrection.spec.ts` and `visualAuthority.spec.ts` are
re-governed, every faithful reproduction of the incoming Design authority will report as a
regression in Energy, Market, Politics and Election.
*Owner: those two specs. Blocks: §9 for four modules.*

**4. Three of nine Home cards have no canonical route.** Economy, Politics and Security
point at `*-visual-preview`. `app/economy/`, `/politics` and `/security` are absent.
*Owner: route families + `intelligenceModules.ts`. Blocks: Gate A(4) — "every public card
destination has an intentional reader-facing landing state".*

**5. Data breadth fails §4 for six of nine modules.** Energy 1 country, Market 1,
Economy 1 (gated), Imihigo 1, Humanitarian/Politics/Security 0 — against 54 declared. And
Energy's single country is structural (`GEO_DRIFT`), not configuration.
*Owner: source authorities, not UI. Blocks: every regional module's DATA acceptance.*

**6. Security Intelligence is a clickable card over a surface with no data path.** No read
model, no producer, no endpoint (C-3).
*Owner: `frontend/src/lib/security/`. Blocks: Gate C(9).*

**7. Populated multi-country visual evidence does not exist for any module.** Conflict's is
mocked, datafed's is `UI-FIXTURE`, Imihigo's is Rwanda-only; and no runner captures
360×800 (D-1, D-3). Golden authority covers two map frames only (D-4).
*Owner: `scripts/`. Blocks: §7 for every dashboard.*

**8. Home-feed and region-scope backend suites are red.** `news.service`, `news.module`,
`gnews.provider` and `declared-regions` fail independently of the database (G-3). Gate A
starts with Home; its feed contracts are failing now.
*Owner: `backend/src/modules/news/`, `modules/analysis/region/`. Blocks: Gate A.*

**9. 25 `feature/beta-*` branches predate the Beta base; 213 refs do not contain it.**
Any wholesale merge reverts the Energy and Market Alpha work (E-2).
*Owner: process. Blocks: §10 discipline.*

**10. Two Gate B modules have no phone route and no browser coverage.** `/conflict` and
`/energy` have no `/compact`; `/conflict` fetches client-side so its first paint is empty;
neither has a Playwright capture (A-5, D-2). `/map` 860 kB and `/conflict` 830 kB
first-load JS are the heaviest phone payloads.
*Owner: those route folders + `scripts/`. Blocks: Gate B phone acceptance.*

**Deliberately not in the ten,** because each is honest-and-labelled rather than broken:
the seven non-routing header items (a declared quota suspension), the World card's absent
destination (§1 compliance, correctly inert), Humanitarian's degraded frame (accurate),
and the missing Prisma `postinstall` (developer friction, G-1).

---

## I. Recommended first implementation module

**Gate A — the Beta shell: Home desktop, then Home phone, then shared
navigation/footer/mobile navigation.** This is what authority §5 sequences first, and the
audit supports it rather than merely deferring to it:

1. **It is the only surface already indexable.** `/` is one of five `index` routes, so
   shell work is the only Beta work that compounds into public discovery today.
2. **It is not byte-frozen.** The 20 pinned files are Energy, Market, Politics and
   Election. Home's components — `Hero`, `GlobalDevelopments`, `IntelligenceEngineSection`,
   `LiveStatusStrip`, `HowItWorks`, `TrustSection`, `PageCanvas`, `NavBar`, `Footer`,
   `MobileBottomNav` — carry no byte or sha256 pin, so blocker 3 does not obstruct it.
3. **Its data path is real and live**, not a single-country proof: `homeFeed.ts` reads the
   news pipeline, with `NewsStartupValidator` fail-closed against mock in production.
4. **It is where the nine module cards are decided.** `intelligenceModules.ts` and
   `navModel.ts` are shell files, so blocker 4 (three cards with no canonical route) and
   blocker 6 (Security card over an empty surface) are *resolved in the shell*, before a
   reader can reach a dead specialist landing.
5. **The Alpha frontend is byte-current with the Beta base** (E-6), so Home shell work can
   be deployed and visually accepted on Alpha immediately, with no frontend catch-up
   deployment first.

**Two things to do before the first shell commit**, both audit-only and both cheap:

- **Run `npx prisma generate`** and record the 14-suite backend baseline, so Gate A is
  measured against a known figure rather than 94 (G-1).
- **Get a ruling on the two frozen-source specs.** They are not Home's problem, but they
  are Gate B's first problem, and the ruling has a lead time that the shell work does not.

After Gate A, the audit supports the authority's **Conflict** ordering for Gate B, on one
measured ground: Conflict is the only module whose declared admitted scope already covers
all 54 declared countries (B-3), so it is the only Gate B module that can satisfy §4
without a new source authority. Its costs are known and local — add a `/compact` route,
move the observation read server-side, and trim the 830 kB payload.

**Energy should not be first even though it is closest to having real data.** Blocker 2 is
a reader-truth defect, blocker 3 freezes eight of its files, it has no phone route, and its
data is one country by construction. It needs a source-authority decision and a spec
ruling before implementation, not during.
