# T4: One Ask engine / legacy analysis convergence

**Base:** `5513275ff731936a07c01e937b92c263ba6d6cf9`. This is the live Alpha commit for both backend and frontend.
**Production (CTO-verified Railway):** backend `5b714833f2a0`, frontend `58f80fd4108d`. Both are ancestors of the base commit.
**Machine-readable graph:** [`T4-legacy-caller-graph.json`](./T4-legacy-caller-graph.json)

## 0. Verdict

- **POST /analysis/news has no live frontend caller, at Alpha or at Production.**
  - Every mounted Ask surface goes through Ask V2 (`useAskR2Conversation` → `lib/api/askV2Api.ts`). That covers the global dock, `/ask`, `/search` Run, and the My Intelligence selection actions.
  - `analyzeNews` in `lib/api/analysisApi.ts` is called only by two files that no page or layout imports: `lib/ask/useAskConversation.ts` and `components/analysis-frame/AnalysisFrameClient.tsx`. This holds at both frontend SHAs.
  - `SearchPageClient.tsx`, which is mounted and protected, imports the module only for `AnalysisApiError` and the error-code type.
  - This confirms the Stage 0 finding.
  - It corrects `stage0/routes-notes.md §4`. That note said `/search` and `/my-intelligence` "still reach analyzeNews". That is true at file level only: they import the module, but they never call the function.
- **The legacy family is still live in two places, through side channels rather than the route itself:**
  - **Question history.** `SearchHistoryEntry` is written only by the legacy controller (`HistoryService.recordExplicitQuestion`, `analysis.controller.ts:84`). As a result, `/history` and the My Intelligence "Recent Intelligence" panel show no question asked through Ask V2. They are stale by construction.
  - **Admin analytics.** `AnalysisRun` and the `analysis_started` / `analysis_completed` events are recorded only for `POST /analysis/news` (`telemetry.interceptor.ts:31,40`). The admin "analysis runs" panel therefore measures only legacy traffic, which is now close to zero.
- **GET /news/search has no frontend caller at either SHA.** `newsApi.searchNews` has zero importers.
- **This commit adds PII-free legacy-use telemetry** on `POST /analysis/news`, `GET /news/search`, `GET /history` and `DELETE /history`.
  - The readout is the admin-only `GET /admin/analytics/legacy-usage`.
  - The data turns "nobody calls it" from an inference over source code into a measurement over traffic. That measurement covers stale PWA bundles, external scripts and benchmarks, none of which a source graph can see.

## 1. Method

- **Snapshots.** Each SHA was extracted with `git archive` (read-only, no checkout) into `scratchpad/t4-trees/<sha8>`.
- **Frontend reachability:**
  - Compute the non-type import closure, including `import()` / `next/dynamic`, from every `frontend/src/app/**/page.tsx` and `layout.tsx` (`scratchpad/t4/graph.mjs`).
  - Then check at symbol level: which files actually call `analyzeNews` or consume `useQuestionHistory`.
  - Then find the shortest import chain to confirm or refute each path (`scratchpad/t4/chain.mjs`).
- **Route gate.** The Standalone allowlist was parsed from each SHA's own `lib/routing/standaloneRouteGate.ts`. The 58f80fd4 list is the same as Alpha's minus `/cookies`.
  - Alpha is Platform mode, where every route passes.
  - Production is Standalone mode, with an allowlist of `/`, `/ask`, `/ask/*`, `/saved`, `/history`, `/account/settings`, `/support`, the legal pages and `/admin/*`.
  - These modes come from the gate's own comment at `standaloneRouteGate.ts:10-11`. `GNA_PUBLIC_ROOT` is not set anywhere in the repo, so the mode-to-environment mapping is **unverified against Railway**. The same caveat was already recorded in Stage 0.
- **Backend.** At both backend SHAs, `git grep` for `AnalysisService.analyzeNews`, `recordExplicitQuestion`, `prisma.analysisRun`, `@Post('news')`, `@Get('search')` and `@Controller('history')`.
- **Other sources.** `scripts/`, `docs/benchmarks/`, `next.config.mjs` rewrites and `public/sw.js` were also checked. `sw.js` never handles `/api/` or `/news/`, so it neither caches nor issues legacy calls. There is no `e2e/` directory.

## 2. Caller graph

Line numbers are given at Alpha / Production. All 22 callers are in the JSON file.

| # | Legacy route | Caller | Alpha 5513275f | Prod (BE 5b714833 / FE 58f80fd4) | Live-reachable A / P | Class |
|---|---|---|---|---|---|---|
| B1 | POST /analysis/news | `backend/.../analysis/controller/analysis.controller.ts` (the public route) | :66 | :66 | public / public | **COMPATIBILITY** |
| B2 | analyzeNews (engine) | `backend/.../ask-v2/ask-r2-execution.adapter.ts` | :628 | :474 | yes / yes (via /ask-v2) | **INTERNALIZE** |
| B3 | analyzeNews (engine) | `backend/.../support/support-ai.service.ts` | :323 | :323 | yes / yes (Support AI) | **INTERNALIZE** |
| B4 | history side effect | `analysis.controller.ts` → `HistoryService.recordExplicitQuestion` | :84 | :84 | legacy route only | **MIGRATE** |
| B5 | telemetry | `backend/.../telemetry/telemetry.interceptor.ts` (`ANALYSIS_ROUTE`) | :31 | :31 | global / global | **MIGRATE** |
| B6 | telemetry read | `backend/.../admin/analytics/admin-analytics.service.ts` (`analysisRun.*`) | :238-259 | :238-259 | /admin / /admin | **MIGRATE** |
| B7 | GET /news/search | `backend/.../news/news.controller.ts` | :12 | :12 | public, 0 FE callers | **COMPATIBILITY** (then REMOVE) |
| B8 | NewsService.search (service) | `analysis.service.ts` (≈20 sites), `country-news.service.ts:192` | yes | yes | internal | **INTERNALIZE** |
| B9 | GET\|DELETE /history | `backend/.../history/history.controller.ts` | :16 | :16 | auth / auth | **COMPATIBILITY** |
| F1 | POST /analysis/news | `frontend/src/lib/api/analysisApi.ts` `analyzeNews` (definition) | :205/:323 | :205/:323 | **no / no** | **REMOVE** |
| F2 | POST /analysis/news | `frontend/src/lib/ask/useAskConversation.ts` | :54 | :54 | **no / no** (orphan) | **REMOVE** |
| F3 | POST /analysis/news | `frontend/src/components/analysis-frame/AnalysisFrameClient.tsx` | :111 | :111 | **no / no** (orphan) | **REMOVE** |
| F4 | analysisApi types only | `frontend/src/components/search/SearchPageClient.tsx` (PROTECTED) | :8 | :7 | /search, /my-intelligence / 307 | **COMPATIBILITY** |
| F5 | deny-list | `frontend/src/lib/askNavModel.ts` `COMPUTE_ENDPOINTS` | :350 | :350 | guard, not a caller | **COMPATIBILITY** |
| F6 | proxy | `frontend/next.config.mjs` `/api/analysis/*`, `/api/history/*` | :129,:132 | :129,:132 | yes / yes | **COMPATIBILITY** |
| F7 | GET /news/search | `frontend/src/lib/api/newsApi.ts` `searchNews` | :110 | :110 | **no / no** (0 importers) | **REMOVE** |
| F8 | GET\|DELETE /history | `frontend/src/app/history/page.tsx` | :38,:46 | :38,:46 | **yes / yes** (direct URL only in Prod) | **MIGRATE** |
| F9 | GET /history | `frontend/src/lib/myIntelligence/hooks.ts` `useQuestionHistory` ← `useMyIntelligenceData.ts:153` | :144 | :144 | **yes / no** (/my-intelligence is 307 in Standalone) | **MIGRATE** |
| F10 | AnalysisRun read (UI) | `frontend/src/components/admin/screens/AnalyticsUsageTab.tsx` | — | — | yes / yes | **MIGRATE** |
| S1 | POST /analysis/news | `scripts/ask-search-r1-browser.cjs` (stale Playwright harness) | :44 | :44 | not deployed | **REMOVE** |
| S2 | POST /analysis/news | `scripts/ask-dashboard-browser.spec.cjs` (stale harness) | :58,:220 | :58,:220 | not deployed | **REMOVE** |
| S3 | POST /analysis/news | `docs/benchmarks/m59-phase2-analysis-benchmark.js` (manual benchmark) | :46 | :46 | external caller | **REMOVE** |

**Counts by class:** COMPATIBILITY 6 · INTERNALIZE 3 · MIGRATE 6 · REMOVE 7 (22 in total).

**Test-only references** are not live callers:
- 70 frontend spec files mention the legacy client or route. Most are source guards asserting that it is *not* called.
- About 6–8 frontend specs exercise the `analyzeNews` client contract (heuristic count). They go with F1.
- 6 backend spec files reference the controller or route.

**Classification rules:**
- **INTERNALIZE:** in-process use of the analysis engine or the news-retrieval primitive. It stays as an implementation detail.
- **COMPATIBILITY:** served or kept while a dependency remains, and measured in the meantime.
- **MIGRATE:** a live surface whose data source is legacy-only.
- **REMOVE:** dead code, stale harnesses, or benchmarks with no mounted path.

### Why the file-level closure overstates

The import closure puts `analysisApi.ts` in the `/search` and `/my-intelligence` bundles. The only edge is `SearchPageClient.tsx:8`, which imports `AnalysisApiError` (a class used in `instanceof`) and nothing else. `chain.mjs` finds no path from any page to `AnalysisFrameClient.tsx` or `useAskConversation.ts` at either SHA. Similarly, `newsApi.ts` is in the `/` and `/map` bundles only because it also exports `fetchTopHeadlines`; `searchNews` has no importer.

## 3. Frontend surfaces still depending on legacy analysis

| Surface | Legacy dependency | Alpha (platform) | Production 58f80fd4 (standalone) |
|---|---|---|---|
| Any Ask surface (dock, `/ask`, `/search`, MI actions) | POST /analysis/news | **none** (Ask V2) | **none** (Ask V2) |
| `/history` | GET/DELETE /history → `SearchHistoryEntry`, written only by the legacy route | **live, stale** | **live, stale**. Allowlisted, but linked only from `MiSections.tsx:353` inside `/my-intelligence`, so reachable by direct URL or bookmark only |
| `/my-intelligence` "Recent Intelligence" | GET /history | **live, stale** | not reachable (307 → `/`) |
| `/admin` → Analytics usage | AnalysisRun, recorded only for the legacy route | **live, legacy-only numbers** | **live, legacy-only numbers** |
| `/search` error copy | `AnalysisApiError` class (no network) | compile-time only | not reachable (307) |

**Production impact of the stale side channels:**
- Production backend `5b714833` has the same controller, interceptor and history writer.
- A Production reader who asks through Ask V2 never sees that question in `/history`.
- Production admin analytics count only legacy requests.
- This is not a regression introduced by T4. It is the state already running.

## 4. Deprecation and migration plan

Each step has a regression gate, and each step can be rolled back on its own. The public route is never deleted. At the end it becomes internal-only, and the in-process `AnalysisService.analyzeNews` used by Ask V2 (B2) and Support AI (B3) is untouched throughout.

| Step | Change | Gate to proceed | Rollback |
|---|---|---|---|
| **0 (this commit)** | Instrument the legacy routes (§5) and correct the stale comments. | Backend and frontend builds green; no new test failures (§7). | Revert the commit. The interceptors are additive and the handlers are unchanged. |
| **1 Observe** | Deploy to Alpha, then Production backend. Watch `GET /admin/analytics/legacy-usage` and the `legacy_route_use` log lines. | **G0:** at least 14 days on Production with `POST /analysis/news` traffic only from `caller=none\|external` and `uaFamily=script\|bot`. Any `frontend:*` caller means a stale client or a missed surface: investigate first. | Nothing to roll back; the change is read-only. |
| **2 History → Ask V2** | Either (a) Ask V2 records a history entry on an explicit verified send (ask-v2 is protected, so this goes through its owner), or, preferably, (b) `/history` redirects to `/ask/recent` (Ask V2 threads) and MI "Recent Intelligence" reads Ask V2 recent threads. | **G1:** a question asked via Ask V2 appears in the replacement surface. `GET /history` legacy-usage traffic falls to about 0 from `frontend:/history`. `standaloneRouteGate`, `askNavModel` and the SEO specs are updated together. | Restore the `/history` page (frontend revert). The legacy store is untouched, so no data is lost. |
| **3 Admin analytics → Ask V2** | Add an Ask V2 emitter: either write `AnalysisRun` from the Ask V2 execution path (provenance is available in the adapter), or re-point the admin panel to ask-observability or `admin/ask-intelligence`. Label any legacy-only figure as such meanwhile. | **G2:** Ask V2 traffic is visible in the admin analytics usage panel. `admin-analytics.instrumentation.spec.ts` is updated. | Revert the emitter; AnalysisRun keeps its legacy rows. |
| **4 Dead frontend code** | Delete `useAskConversation.ts`, `AnalysisFrameClient.tsx` (and its frame-only siblings if they become unreferenced), `analyzeNews` plus its fetch in `analysisApi.ts` (keep `AnalysisApiError` while `SearchPageClient` imports it), `newsApi.searchNews`, and their client-contract specs. Retarget or delete S1–S3. | **G3:** frontend build and suite pass. A guard spec asserts that no `frontend/src` file references `/analysis/news` outside deny-lists. | git revert. Nothing deployed depended on the deleted code. |
| **5 GET /news/search** | Make it internal-only: remove the controller handler. `NewsService.search` stays. | **G0** applied to `GET /news/search`, with zero `frontend:*` callers. | Re-add the handler. |
| **6 POST /analysis/news internal-only** | Remove `@Post('news')` from the public surface, for example by gating it behind `RequireAuthGuard` + `AdminGuard` or an env flag, or by unmounting the controller. Drop the `/api/analysis/*` rewrite and the `COMPUTE_ENDPOINTS` entry. Update `legacy-retirement.guard.spec.ts` (caller 1 changes from public route to internal) and `m-alpha-auth.contract.spec.ts` ("guest Analysis is still reachable"). Keep the history writer only if step 2 chose (a). | **G4:** G0–G3 all green, plus a further 7 days of zero `frontend:*` legacy traffic **on Production**. A CTO decision is required, because R2G contracted that the route stays served. | Re-enable through the flag or by reverting. Prefer an env flag (`LEGACY_ANALYSIS_PUBLIC=true`) so the rollback needs no deploy. |

**Production specifics:**
- Production runs FE `58f80fd4` and BE `5b714833`. Neither carries this telemetry, so G0 can only start once a backend containing this commit is promoted to Production.
- The Production frontend already has no legacy caller, so steps 1–3 carry no Production-frontend risk.
- Step 6 is the only step that changes Production's public API surface.

## 5. Telemetry design (added in this commit)

- **Where.** A new `backend/src/modules/legacy-usage/` directory:
  - `legacy-route-usage.ts` holds the classifier and the in-process registry.
  - `legacy-route-usage.interceptor.ts` holds the interceptor.
  - It is attached per handler as an instance, `@UseInterceptors(new LegacyRouteUsageInterceptor(route, resolveAuth))`, on:
    - `AnalysisController.analyzeNews`
    - `NewsController.search`
    - `HistoryController.list` and `HistoryController.clear`
  - Ask V2 handlers never carry it, and a spec asserts this.
  - No `app.module.ts` change and no Prisma migration were needed.
- **Event.** One structured log line per request: `{"event":"legacy_route_use","route","caller","auth","uaFamily","at"}`. The fields are:
  - `route`: one of 4 literals. Never the URL.
  - `caller`: a closed enum.
    - `frontend:/`, `frontend:/ask`, `frontend:/ask/*`, `frontend:/search`, `frontend:/my-intelligence`, `frontend:/history`, `frontend:/map`, `frontend:/saved`, `frontend:/admin/*`.
    - `frontend-other`, `external`, `none`.
    - Derived from the Referer pathname, or the Origin host, compared against `FRONTEND_ORIGIN`. The query string and fragment are never read.
  - `auth`:
    - `POST /analysis/news`: `signed-in` or `anonymous`, from the existing verified-user marker set by `AnalysisRateLimitGuard`. Only a boolean is derived; the id is never passed on.
    - `/history`: `signed-in`, because `RequireAuthGuard` runs first.
    - `GET /news/search`: `not-assessed`. The news module is session-blind by contract (`news-session-blindness.spec.ts`), so the measurement reads no session either.
  - `uaFamily`: one of `edge`, `chrome`, `firefox`, `safari`, `other-browser`, `bot`, `script`, `none`.
  - `at`: ISO timestamp.
- **Never recorded:** query or body, URL or query string, IP or `x-forwarded-for`, cookie or session, user id, raw user-agent, full Referer.
- **Counters.** In-process and bounded by the enums: per route, `total`, `lastSeenAt`, and counts by caller, by auth and by `uaFamily`.
  - **Readout:** `GET /admin/analytics/legacy-usage`.
  - Served by the new `AdminLegacyUsageController`, with the same guard chain (`AdminPlatformEnabledGuard`, `RequireAuthGuard`, `AdminGuard`) and the same capability (`analytics.view`) as `/admin/analytics/usage`.
  - Added to the `admin.security.spec.ts` 401/403/404 battery.
  - The response carries `scope: 'process'` and `countingSince`, so per-instance, since-restart counts cannot be mistaken for platform totals. The durable record is the log line.
- **Why not `modules/telemetry`.** Its privacy contract (`telemetry.privacy.spec.ts`) forbids any telemetry file from reading a header, and it pins the file list. That contract is left unchanged. The legacy-usage directory has its own privacy spec instead. `ProductEvent` names are a closed Prisma enum and `AnalysisRun` has no route column, so persisting there would need a migration. That is why this uses a log line plus counters.
- **Guarantees, all tested:**
  - Recorded before the handler runs, so failed requests still count.
  - The response stream passes through untouched.
  - A registry or context failure is swallowed.
  - Requests rejected by guards (429 or 401) are *not* counted. The guards already log them.
- **Admin UI.** No frontend panel was added. Adding a section to `AdminAnalyticsUsageResponse` would require changing the frontend mirror and `adminApiContract.spec.ts`. The JSON readout is enough for G0, and a panel is a follow-up.

## 6. Changed-file manifest

| File | Change |
|---|---|
| `backend/src/modules/legacy-usage/legacy-route-usage.ts` | **new**: classifier and registry |
| `backend/src/modules/legacy-usage/legacy-route-usage.interceptor.ts` | **new**: per-handler interceptor |
| `backend/src/modules/legacy-usage/legacy-route-usage.spec.ts` | **new**: 14 tests (no PII, counts, Ask V2 unaffected, behaviour unchanged, wiring) |
| `backend/src/modules/admin/legacy-usage/admin-legacy-usage.controller.ts` | **new**: admin-only readout |
| `backend/src/modules/admin/admin.module.ts` | registers `AdminLegacyUsageController` |
| `backend/src/modules/admin/admin.security.spec.ts` | adds the new route to the denial battery |
| `backend/src/modules/analysis/controller/analysis.controller.ts` | `@UseInterceptors(...)` on `POST /analysis/news`, plus a comment. Handler unchanged |
| `backend/src/modules/news/news.controller.ts` | `@UseInterceptors(...)` on `GET /news/search`, plus a comment |
| `backend/src/modules/history/history.controller.ts` | `@UseInterceptors(...)` on `GET` and `DELETE /history`, plus a comment |
| `backend/src/modules/ask-v2/legacy-retirement.guard.spec.ts` | stale header comment corrected (comment only; assertions unchanged) |
| `backend/src/modules/ask-v2/README.md` | status note: Ask V2 is now the one engine |
| `frontend/src/components/home/Hero.tsx` | stale comment corrected (comment only) |
| `docs/convergence/stage2/T4-LEGACY-ASK-CONVERGENCE.md`, `T4-legacy-caller-graph.json` | **new**: this dossier |

No file listed in `protected-files.tsv` was modified. This was checked mechanically. The legacy endpoint is neither removed nor disabled.

One stale comment is left as it is. `analysis.controller.ts` still has the R1 block that says "Every surface … reaches analysis only here". A T4 block directly beneath it now records the current state, and the original R1 text is kept for history.

## 7. Builds, tests and failure-set comparison

### Builds

| Build | Result |
|---|---|
| backend `npm run build` (nest build plus geo packaging verify) | **pass** |
| frontend `npm run build` (spatial token/structure verify plus next build) | **pass** |

### Full test suites

The failure sets were compared by (suite path, test fullName) against the Stage 0 baselines `stage0/r4-be.json` and `r4-fe.json`, which were taken at the same SHA. The comparison script is `scratchpad/t4/compare.py`.

| Suite | Base: suites / tests / failed | T4: suites / tests / failed | New failures | Fixed |
|---|---|---|---|---|
| backend jest | 439 / 11868 / **33** | 440 / 11887 / **33** | **0** | 0 |
| frontend jest | 380 / 8293 / **21** (+3 suite-level errors) | 380 / 8293 / **21** (same 3 suite-level errors) | **0** | 0 |

**Backend notes:**
- The +19 tests are the 14 in `legacy-route-usage.spec.ts` plus 5 new cases in the `admin.security.spec.ts` battery for `/admin/analytics/legacy-usage`.
- In the first full run, 4 suites were SIGKILLed: jest workers were OOM-killed while the frontend build ran concurrently.
  - The killed suites were `ask-r2-execution.postgres`, `entity-run-suppression`, `non-latin-label-comparison` and `market-snapshot-admission.negative-control`.
- `candidate-integrity.spec.ts` also failed in that run, because the new files were not yet tracked by git.
- Re-running these 5 suites after staging the new files: 4 passed and 1 was skipped (the postgres suite, skipped at base too).
- The merged result is the row above, with no new failures. The pre-existing 33 backend and 21 frontend failures are unchanged and are not caused by T4.
