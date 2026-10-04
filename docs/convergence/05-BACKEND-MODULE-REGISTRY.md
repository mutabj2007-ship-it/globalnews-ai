# 05 — Backend Module Registry

Authority `5513275f`. Raw records: `stage0/backend-modules.json` (37 module directories plus 7 top-level areas). Classification follows contract Part IX. A Nest import is **not** treated as a user capability: the column *User usefulness* states whether a reachable public route actually consumes the module.

## Facts that decide product behaviour

- **Ask engine.**
  - Every mounted Ask surface (`/`, `/ask`, dock, `/search`, `/my-intelligence` selection, `/saved`, `/ask/recent`) calls **Ask V2**.
  - Ask V2 is gated by `ASK_V2_ENABLED` + `ASK_R2_ENABLED` + `ASK_PUBLIC_COMPUTE_ENABLED`, plus a DB operational switch. **The code default is OFF.**
  - The last recorded Alpha check (2026-09-26, at an older SHA) found the flag unset (`docs/ask-search-r1/MY-INTELLIGENCE-DATA-CAPABILITY-SHEET-R1.md:6`). The Alpha value at `5513275f` is **UNVERIFIED**.
- **Routing authority.** `routeAskR2` (`ask-router/ask-r2-route.ts:566`), built on `SemanticTurnIR` (`semantic-ir/semantic-turn-ir.ts:133`, built by `interpret-turn.ts:353`). Its sole caller is the Ask V2 adapter (`ask-r2-execution.adapter.ts:244`). `AnalysisService.analyzeNews` is the retrieval engine *under* the adapter.
- **Legacy engine.** `POST /analysis/news` is still public, has no live frontend caller, and bypasses `routeAskR2` and the governed reads. The guard comment `legacy-retirement.guard.spec.ts:9-11` says Production still calls it. That is true of the c908 Production ref and false at `5513275f`.
- **Conversation systems.** There are two:
  - legacy stateless `priorQuestion`, which writes `SearchHistoryEntry`;
  - Ask V2 durable threads (`AskThread`/`AskTurn`/`StoredResult`, plus guest claim).

  `/history` reads only the legacy store, so it receives no Ask V2 activity.
- **Schedulers.**
  - No `@Cron` or `ScheduleModule` anywhere.
  - Timers: the retention sweep (off by default) and guest maintenance. Guest maintenance runs on every boot even when Ask V2 is off, and it writes and deletes rows (`guest-maintenance.service.ts:64-69`).
  - The market-ingest scheduler is unbound.
- **External hosts at runtime.**
  - Always: `api.openai.com` (when a key is set), `gnews.io`, Google OAuth.
  - Flag-gated: GDELT DOC, RSS publisher hosts, `api.x.com`, YouTube.
  - Operator scripts only: Eurostat, TED, UCDP.
  - Never at runtime: GDELT GEO, Event Registry, `statistics.gov.rw`, Wikipedia, Copernicus.
- **Constant-absence routes.**
  - `/security/observations/:cc` → NOT_ASSESSED (producer module never imported).
  - `/politics/observations` → NOT_ASSESSED (`POLITICS_RETAINED_CAPTURES = []`).
  - `/humanitarian/observations` → NOT_ASSESSED (`HUMANITARIAN_PROVISIONING` undefined).
- **Unbound substrate.** `SituationModule`, `SignalsModule` (registered, nothing injects them), reference-providers, readiness, watch, source-packs, global-reach acquisition, the Eurostat economy producer, and the market-ingest adapters and scheduler.
- **Observability gap.** `TelemetryInterceptor` records `AnalysisRun` only for `/analysis/news` (`telemetry.interceptor.ts:31,40`), so admin analytics cannot see Ask V2 traffic.

## Feature flags (defaults)

Every flag below is off unless set to exactly `'true'`, unless noted otherwise.

| Flag | Default | Effect when off |
|---|---|---|
| ASK_V2_ENABLED | false (`.env.example:704`) | every `/ask-v2` route 404 |
| ASK_R2_ENABLED · ASK_PUBLIC_COMPUTE_ENABLED · ASK_GUEST_TRIAL_ENABLED | absent | no Ask AI (env value **and** DB switch required) |
| ASK_BRIEFINGS_ENABLED | absent | briefings 404 |
| SAND_LEDGER_ENABLED / SAND_CHARGING_ENABLED | false / literal `false` | no ledger / never charges |
| ADMIN_PLATFORM_ENABLED | false | `/admin` 404 |
| DISCUSSION_READ · DISCUSSION_WRITE · ALERTS_IN_APP · COMPARE_READ_ENABLED | absent | 404 |
| ELECTION_EVIDENCE_READ_ENABLED | false | reader off |
| RETENTION_SWEEP_ENABLED | absent | no sweep |
| SUPPORT_AI_ENABLED · GLOBAL_REACH_ACQUISITION_ACTIVE | false | off |
| GDELT_DOC_ENABLED · RSS_FEEDS_ENABLED · EVENT_REGISTRY_ENABLED | false | providers off |
| GDELT_ENABLED | code off; **`.env.example:280` = true** | — |
| WATCH_RUNTIME_ACTIVE · COPERNICUS_PRODUCER_ENABLED · ECONOMY_PRODUCER_ENABLED | code constant `false` | off |
| Frontend GNA_PUBLIC_ROOT | unset → Standalone | module routes redirect to `/` |
| Frontend GNA_HOME_R1 and other GNA_* gates | off | Home R1 UI hidden |

`docker-compose.yml` passes no Ask, Discussion or Alerts flag, so a Compose deployment cannot enable them.

## Module table

<!-- GENERATED:BEGIN -->
| Module | In AppModule | Classification | Routes | Flags | Ask reachability | User usefulness |
|---|---|---|---|---|---|---|
| admin | yes (backend/src/app.module.ts:147), unconditional | controller/live-route, dormant | 11 | ADMIN_PLATFORM_ENABLED (default OFF (code requires exact 'true'; unset => off); trim+lowe… | reads AskObservation/ComputeMeter/OperationalSwitch for admin Ask dashboard; POST switche… | admin-only; 404 by default |
| analysis | yes (backend/src/app.module.ts:117) | controller/live-route, internal-service, provider | 1 | OPENAI_API_KEY (absent => MockAnalysisProvider), OPENAI_MODEL (gpt-4o-mini), AI_EXECUTION… | IS the shared engine: ask-v2 adapter calls AnalysisService.analyzeNews; analysis imports … | Indirect only (through ask-v2). Direct route has no live frontend consumer at 5513275f. |
| ask-intelligence | no (imported by AskV2Module ask-v2.module.ts imports) | internal-service, retained-read | 0 | — | part of ask-v2 path (specialist contributors) | indirect via Ask V2 only |
| ask-observability | no (imported by AskV2Module, admin) | internal-service, producer | 0 | ASK_OBSERVATION_* constants (code) | ask-v2 only | admin/telemetry |
| ask-router | no -- NOT a Nest module (pure library) | internal-service | 0 | — | ROUTING AUTHORITY for Ask V2 (SemanticTurnIR). Analysis uses only bilateral-relationship … | indirect via Ask V2 |
| ask-v2 | yes (backend/src/app.module.ts:136), unconditional (routes 404 by guard) | controller/live-route, dormant, scheduler, producer, internal-service | 24 | ASK_V2_ENABLED (default OFF (code requires exact 'true'; unset => off); root .env.example… | IS the Ask path. Imports AnalysisModule, NewsModule, ComputeControlsModule, SpecialistMod… | PRIMARY user capability (the only Ask engine wired to the UI) but 404/unavailable unless … |
| auth | yes (backend/src/app.module.ts:132) | controller/live-route, provider | 3 | OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_FLOW_SECRET, PUBLIC_BACKEND_ORIGIN, PUBLIC_OA… | auth.service imports ask-v2 guest claim (guest->account continuation) | yes (sign-in) |
| compute-controls | no (imported by AskV2Module, GuestCoreModule, AdminModule) | internal-service | 0 | ASK_PUBLIC_COMPUTE_ENABLED, ASK_R2_ENABLED, ASK_GUEST_TRIAL_ENABLED, ASK_FLAG_CACHE_MS=50… | ask-v2 budget/kill-switch authority | indirect |
| conflict-claim | yes (backend/src/app.module.ts:214) | internal-service | 0 | — | registry is consumed by ask-r2-execution.adapter (specialist-claim.registry import) | indirect via Ask V2 |
| conflict-observation | yes (backend/src/app.module.ts:99) | controller/live-route, retained-read | 2 | ALPHA_UCDP_CANDIDATE_R1_APPLY (tooling only) | YES: ConflictObservationRepository re-provided in AskIntelligenceModule | public page /conflict (noindex) and /map; both redirected to / in Standalone mode (defaul… |
| data-retention | yes (backend/src/app.module.ts:69) | scheduler, dormant | 0 | RETENTION_SWEEP_ENABLED (default OFF (code requires exact 'true'; unset => off)), RETENTI… | none | none (ops) |
| economy | yes (backend/src/app.module.ts:81) | controller/live-route, retained-read, unbound-substrate | 1 | ECONOMY_PRODUCER_ENABLED (literal const false) | YES: EconomyModule imported by AskIntelligenceModule; EconomyObservationReadService used … | preview page only; redirected in Standalone mode |
| election | yes (backend/src/app.module.ts:82) | controller/live-route, retained-read, dormant, preview/test-only | 1 | ELECTION_EVIDENCE_READ_ENABLED (default OFF (code requires exact 'true'; unset => off); .… | no | preview only; disabled by default |
| energy | yes (backend/src/app.module.ts:91) | controller/live-route, retained-read | 1 | GN_ALPHA_PRODUCT_OWNER_REVIEW (=== 'YES' reveals review rows), ALPHA_ENERGY_EUROSTAT_R1_A… | NO (not imported by ask-intelligence/ask-v2/analysis) | /energy page; redirected in Standalone mode |
| follows | yes (backend/src/app.module.ts:156) | controller/live-route | 3 | — | no | platform-mode Home/My Intelligence only; those pages not in Standalone allowlist |
| geo | yes (backend/src/app.module.ts:116) | controller/live-route, internal-service | 7 | — | geo-gazetteer/geo-resolver used as library by ask-router, ask-intelligence, analysis | map (platform mode) |
| global-reach | no (imported by AdminModule) | internal-service, dormant, unbound-substrate | 0 | GLOBAL_REACH_ACQUISITION_ACTIVE (default OFF (code requires exact 'true'; unset => off)),… | analysis imports source-pack.registry | admin only |
| history | yes (backend/src/app.module.ts:134) | controller/live-route | 2 | — | written by analysis route only; ask-v2 never writes SearchHistoryEntry | page reachable in Standalone, but no live producer -> stale/empty for new activity |
| humanitarian | partial: HumanitarianReadModule yes (backend/src/app.module.ts:237); HumanitarianModule (… | controller/live-route, dormant, unbound-substrate | 1 | COPERNICUS_PRODUCER_ENABLED (literal false), HUMANITARIAN_PROVISIONING (code constant und… | no | page renders an absence; redirected in Standalone mode |
| market-ingest | MarketReadModule yes (backend/src/app.module.ts:90); scheduler/adapters/producer not in a… | controller/live-route, retained-read, unbound-substrate | 2 | ALPHA_TED_MARKET_R1_APPLY (tooling), TED_MARKET_ALPHA_R1_LIMIT (tooling) | YES: MarketReadRepository in AskIntelligenceModule | /market page; redirected in Standalone mode |
| my-intelligence | yes (backend/src/app.module.ts:157) | controller/live-route | 6 | — | no | /my-intelligence page not in Standalone allowlist; saved stories store used by bookmark c… |
| news | yes (backend/src/app.module.ts:72) | controller/live-route, provider, producer, internal-service, dormant | 7 | GNEWS_API_KEY, GNEWS_FEED_TIER=delayed, GNEWS_PROVIDER_DISPLAY_NAME, COUNTRY_NEWS_CACHE_T… | YES: NewsModule imported by AskV2Module and AnalysisModule | Home (platform mode) + map; in Standalone root no direct news route consumer |
| official-data | no (library; RetainedNisrCpiReader provided in EconomyModule; boot assertion in main.ts:1… | internal-service, dormant, unbound-substrate | 0 | — | via economy reader | indirect (economy) |
| official-sources | no (library) | internal-service | 0 | — | none | none directly |
| politics | yes (backend/src/app.module.ts:71) | controller/live-route, retained-read, preview/test-only | 1 | — | no | preview page renders empty ledger |
| readiness | no (types-only contract) | unbound-substrate | 0 | — | none | none |
| reference-providers | no | unbound-substrate | 0 | — | none | none |
| security | SecurityModule yes (backend/src/app.module.ts:215); SecurityProducerModule NOT imported a… | controller/live-route, unbound-substrate | 1 | — | no | none (no consumer) |
| signals | yes (backend/src/app.module.ts:127) | internal-service, unbound-substrate, dormant | 0 | GDELT_ENABLED (code: off unless 'true'; .env.example=true), GDELT_GEO_API_BASE_URL, GDELT… | no | none |
| situation | yes (backend/src/app.module.ts:192) | unbound-substrate | 0 | — | no | none |
| source-packs | no (data only: eu27 JSON manifests) | unbound-substrate | 0 | — | none | none |
| specialist | no (imported by ConflictClaimModule and AskV2Module) | internal-service | 0 | — | ask-v2 | indirect |
| stories | StoriesModule yes (backend/src/app.module.ts:158); StoryObservationModule (@Global) yes (… | controller/live-route, dormant, producer | 20 | DISCUSSION_READ_ENABLED (default OFF (code requires exact 'true'; unset => off)), DISCUSS… | briefings.service reads story-relation.read | dormant by default (both backend and frontend flags off) |
| support | yes (backend/src/app.module.ts:152) | controller/live-route, provider | 8 | SUPPORT_AI_ENABLED (false), SUPPORT_AI_TIMEOUT_MS=20000, SUPPORT_AI_MAX_CONCURRENT=2, SUP… | SupportAiService -> AnalysisService (non-Ask exception) | yes (/support in Standalone allowlist) |
| telemetry | yes (backend/src/app.module.ts:163); TelemetryInterceptor as APP_INTERCEPTOR | controller/live-route, producer | 1 | — | observes analysis route only; ask-v2 traffic not recorded as AnalysisRun | none user-facing; admin analytics read AnalysisRun/ProductEvent |
| users | yes (backend/src/app.module.ts:133) | controller/live-route | 3 | — | none | yes |
| watch | no (no Nest module) | dormant, unbound-substrate | 0 | WATCH_RUNTIME_ACTIVE (literal false) | none | none |
| health (top-level) | yes (backend/src/app.module.ts:70) | controller/live-route | 2 | — | none | ops |
| app (top-level) | yes (controllers: [AppController]) | controller/live-route | 1 | — | none | none |
| database (top-level) | yes (PrismaModule) | internal-service | 0 | DATABASE_URL, DB_POOL_MAX=10 | none | infra |
| security (top-level, not modules/security) | providers in AppModule | internal-service | 0 | FRONTEND_ORIGIN, TRUST_PROXY=false, PUBLIC_BACKEND_ORIGIN, PUBLIC_OAUTH_CALLBACK_BASE, OA… | none | infra |
| observability (top-level) | APP_INTERCEPTOR/APP_FILTER/middleware | internal-service | 0 | — | none | infra |
| tooling (top-level) | no (operator scripts) | producer, preview/test-only | 0 | ALPHA_ENERGY_EUROSTAT_R1_APPLY, ALPHA_TED_MARKET_R1_APPLY, ALPHA_UCDP_CANDIDATE_R1_APPLY | none | operator only |
| qualification / shared-vocabulary / config (top-level) | no | preview/test-only | 0 | — | none | none |

**Classification counts (multi-label):** controller/live-route 23 · internal-service 17 · unbound-substrate 12 · dormant 11 · retained-read 7 · producer 6 · provider 4 · preview/test-only 4 · scheduler 2 · records 44. Full records: `stage0/backend-modules.json`.
<!-- GENERATED:END -->
