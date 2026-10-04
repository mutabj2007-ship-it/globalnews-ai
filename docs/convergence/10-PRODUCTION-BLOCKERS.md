# 10 — Production Blockers (Stage 1 gap classification)

> **Stage 2 runtime correction (2026-10-04, CTO contract R2).** Railway runtime authority replaces the Git-derived Production assumption below:
> - **Alpha:** backend and frontend at `5513275f` (SUCCESS); live root is platform Home (`GNA_PUBLIC_ROOT` configured); Ask V2 active for signed-in users; guest trial **OFF by design** during controlled acceptance (not a defect).
> - **Production:** backend `5b714833`, frontend `58f80fd4` (SUCCESS). Strict ancestors of Alpha, 85 and 84 commits behind. Not `release/production-c908`.
> - **Production flags are not inferred; Production stays HOLD.**
>
> Registries (02, 09, 10, `status.json`) are regenerated with these facts. See `stage2/STAGE2-REPORT.md`.

Authority `5513275f`. **Production posture: HOLD.** Nothing here authorizes a Production change.

## Classes (contract Stage 1)

- **P0 — product blocker.** The product misleads, or answers with wrong-domain evidence. Fix before any further Alpha acceptance claim.
- **P1 — Alpha blocker.** Prevents a measured Alpha-acceptance row from going GREEN.
- **P2 — Production blocker.** Acceptable in Alpha with disclosure; must close before Production qualification.
- **P3 — later enhancement.**

The list below is generated from `02-GLOBAL-CAPABILITY-REGISTRY.json`. A blocker shared by several capabilities appears once, with every capability listed.

## Production qualification preconditions (not blockers of a single capability)

1. **Production is 85 / 84 commits behind the Alpha line** (backend `5b714833`, frontend `58f80fd4`, Railway authority; corrected from the Stage 0 assumption of `release/production-c908`).
   - Any promotion must come from one exact Alpha-tested SHA, with a rollback ref recorded first (13).
2. **Production flags are unmeasured.** Alpha runtime is now supplied by the CTO's Railway authority. The text below records the Stage 0 position, superseded for Alpha:
   - Alpha and Production hosts are unreachable from the measuring container (network policy 403 on `frontend-alpha-4560.up.railway.app`).
   - Every in-repo statement of a deployed SHA is stale. `docs/ALPHA_PRODUCTION_PARITY_MATRIX.md:14` names `2c4b6ce` / `fc162e2`, and neither is an ancestor of `production-c908`.
   - The deployed values of `GNA_PUBLIC_ROOT`, `ASK_V2_ENABLED`, `ASK_R2_ENABLED` and `ASK_PUBLIC_COMPUTE_ENABLED` must be recorded before any Alpha cell can move from UNVERIFIED to PASS.
3. **Test baseline at `5513275f` is not green** (`stage0/test-baseline.json`).
   - Backend: 33 failing tests in 10 suites, including `qualification/h-handoff.qualification.spec.ts`.
   - Frontend: 21 failing tests in 13 suites.
   - Production qualification needs an explained or zero failure set.
4. **Source rights.** GNews commercial terms are still an open beta gate (`docs/beta/HOME-R2-DEDUP-PROVIDER-DISCLOSURE-R1.md:69`). Product Owner/legal decision required (contract stop condition).

<!-- GENERATED:BEGIN -->
### P0 — product blocker (6)

| ID | Blocker | Capabilities | Evidence |
|---|---|---|---|
| P0-ASK-01 | Conflict contributor selected for any country + 'situation' (travel/visa/political/energy/economic questions inject UCDP records) | ASK-CORE, CONFLICT | backend/src/modules/ask-intelligence/contributor-selection.ts:29-45,224-236; stage0/search-binding.json R1 |
| P0-LANG-01 | Selector offers 7 locales but 36 route files + root layout clamp to en/pl via isActiveLanguageCode; fr/de/es/pt/ar render English; <html lang> en\|pl only | ASK-SEARCH, LANG-SYSTEM | frontend/src/lib/i18n/languages.ts:21,91,159; app/layout.tsx:193,259,273; app/search/page.tsx:20 |
| P0-LANG-02 | Stored fr–ar choice is overwritten to 'pl' on Polish browsers | LANG-SYSTEM | LanguageSync.tsx:52-58; Hero.tsx:264-269 |
| P0-LANG-03 | No <html dir>; Arabic RTL only inside AskFrameScreen; Economy forces dir=ltr | LANG-SYSTEM | AskFrameScreen.tsx:431-432; EconomyScreen.tsx:222 |
| P0-PRIV-01 | Public-Beta Production P0: pre-login privacy/data/cookie notice and guest-trial boundary (≥3 questions before login, truthful guest session) not proven | CONSENT | no consent component at 5513275f or 58f80fd4; contract R2 T5; Alpha guest OFF is intentional |
| P0-SRC-01 | GNews (no rights record) is the only active source and silently substitutes for local coverage in all 54 priority countries; no COVERAGE_GAP disclosure | NEWS-SOURCES | news.module.ts:71; stage0/source-coverage.json |

### P1 — Alpha blocker (30)

| ID | Blocker | Capabilities | Evidence |
|---|---|---|---|
| P1-ACC-01 | platform-mode settings hard-code language='en' | ACCOUNT-AUTH | account/settings/page.tsx:27 |
| P1-ASK-03 | FR/DE/ES/PT/AR Ask chrome partly English on Alpha 5513275f; resolved in H final 266007c (pending final R4 integration) | ASK-CORE | stage0/language.json; useRotatingExample.ts:126 |
| P1-ASK-04 | Deterministic routers/conversation readers EN/PL only (7 guards) | ASK-CORE | knowledge-requirement.ts:400,438; turn-normalization.ts:64; conversation-place.ts:41 |
| P1-ASK-05 | Second public Ask engine still served; bypasses routeAskR2 and governed reads; contradicts 'one Ask engine'. Retire after Production moves to Ask V2 | ASK-LEGACY | analysis.controller.ts:66; stage0/search-binding.json R2 |
| P1-BRF-01 | briefing-snapshot ignores payload.intelligence; governed answers lose provenance or are unbriefable | BRIEFINGS | briefing-snapshot.ts:65-102 |
| P1-CONV-01 | prior-reference resolver has no production importer; 'Why did you say that?' detected but not resolved against prior answer | CONVERSATION | ask-v2/conversation/prior-reference.ts:282; user-job.ts:649-660 |
| P1-CONV-02 | 'Is it still true now?' re-retrieves fresh reporting; never re-verifies the prior claim against its own evidence | CONVERSATION | user-job.ts:682 |
| P1-ECON-01 | NISR CPI served while rw-nisr rights unresolved | ECONOMY | stage0/sources.json; official-source-registry.ts:171 |
| P1-ECON-02 | Seven-locale economyStrings unreachable (route clamps); forced LTR | ECONOMY | economy-visual-preview/page.tsx:53; EconomyScreen.tsx:222 |
| P1-ENG-01 | Not Ask-bound; energy questions select Conflict instead | ENERGY | stage0/search-binding.json energy; probe |
| P1-HIST-01 | /history on Production allowlist but legacy, hard-coded English, links to /search which redirects | HISTORY-RECENT | standaloneRouteGate.ts:30; history/page.tsx:50-79 |
| P1-HOME-01 | Top-headlines DTO en/pl only; Home R1 discussion/alert flags default off; four-service Home not provable without flags | HOME | top-headlines-query.dto.ts:20; stage0/backend-notes flags |
| P1-HUM-01 | No functioning reader at Alpha; lane must rebase (84 behind) and collides on MyIntelligenceClient.tsx with H; credential-dependent sources need approved org identity | HUMANITARIAN | stage0/workstreams.json; humanitarian.registration.ts:84 |
| P1-LANG-04 | Main dictionary has no fr/de/es/pt/ar catalogue (2813 keys); recovered C55 catalogues dormant at 1655/2813 (58.8%), 0 keys for My Intelligence/Home R1/Reva/Ask AI | LANG-SYSTEM | stage0/language.json coverage |
| P1-LANG-05 | LanguageCode type lacks de/pt; analysis + telemetry DTOs reject de/pt; no de/pt retrieval strategy | LANG-SYSTEM | shared/src/analysis.ts:30; analyze-news.dto.ts:144; record-event.dto.ts:51 |
| P1-LANG-06 | Stale 'English and Polish only' copy live in support | LANG-SYSTEM, SUPPORT | supportEn.ts:304; supportPl.ts:216 |
| P1-LEG-01 | NavBar on legal pages links to /search and /my-intelligence which redirect in Production | LEGAL | NavBar.tsx:223,353; AccountControl.tsx:258 |
| P1-MI-01 | Public ?state= review switch on Alpha route; dev fixtures in import graph (env-gated) | MY-INTELLIGENCE | app/my-intelligence/page.tsx:25-31; devFixtures.ts:30 |
| P1-MI-02 | File collision between H and Humanitarian lanes | MY-INTELLIGENCE | components/my-intelligence/MyIntelligenceClient.tsx |
| P1-MKT-01 | Procurement read takes newest 20 notices before country filter → false NO_MATCH | MARKET | ask-specialist-read.coordinator.ts:369-375 |
| P1-MKT-02 | mktStrings English-only (PL disclosed fallback) | MARKET | mktStrings.ts:316 |
| P1-OBS-01 | Telemetry interceptor records only /analysis/news; admin analytics blind to Ask V2 | TELEMETRY-ADMIN | telemetry.interceptor.ts:31,40; admin-analytics.service.ts:238 |
| P1-POL-01 | No searchable projection or Ask contributor; route constant NOT_ASSESSED; owned by Politics lane — consume its handoff | POLITICS | politics.retained.ts:9; stage0/search-binding.json politics |
| P1-PRIV-03 | Privacy page retention claims (limit identifiers ~1 week, usage 90 days, conversations 12 months) hold only when RETENTION_SWEEP_ENABLED=true (default off); privacy/cookies/guest copy en/pl only | CONSENT | stage2/T5-CONSENT-GUEST-TRIAL.md; RETENTION_SWEEP_ENABLED default |
| P1-PRIV-04 | Guest claim moves ALL guest conversations (copy says 'keep this conversation'); plain sign-in leaves guest data visible on shared device; no immediate guest-data deletion; no /cookies footer link | CONSENT | stage2/T5-CONSENT-GUEST-TRIAL.md patches P-1..P-5 |
| P1-PRV-01 | Preview routes linked from Alpha Home/My Intelligence and public | PREVIEW-ROUTES | lib/intelligenceModules.ts:203,284,305; homeRevaModel.ts:101; miWorkspaceModel.ts:53-68 |
| P1-RIGHTS-04 | Imihigo committed/served without rights-evaluator record | IMIHIGO | data/imihigo/capture.json:4 |
| P1-SEC-01 | SecurityObservation store unbound; producer module never imported | SECURITY | stage0/backend-modules.json#security |
| P1-SRC-02 | RSS activation bypasses rights (Standard Media RESTRICTED activatable by env) | NEWS-SOURCES | feed-source-registry.ts:213-241 |
| P1-SRC-03 | Placeholder API keys count as configured | NEWS-SOURCES | provider.tokens.ts:59-61; .env.example:209 |

### P2 — Production blocker (12)

| ID | Blocker | Capabilities | Evidence |
|---|---|---|---|
| P2-ALR-01 | No material-change detection, push/PWA transport or user controls; in-app ≠ phone alerts | ALERTS-WATCH | stage0/backend-modules.json#watch,#stories |
| P2-CONF-02 | capture script bypasses safe-fetch | CONFLICT | backend/src/tooling/ucdp-candidate-alpha-r1.ts:65 |
| P2-DIS-01 | Moderation/ownership/privacy/mobile flow not provable while flags off | DISCUSSIONS | stage0/backend-notes flags |
| P2-ELE-01 | Election capability matrix (calendar, authority, races, results, polling, voting areas) absent beyond one KE bundle | ELECTION | stage0/sources.json election |
| P2-FOL-01 | Follow is country-only; 'Follow an Issue' (paid core service) absent | FOLLOW | stage0/backend-modules.json#follows |
| P2-LANG-07 | Preference not persisted to account; no Accept-Language | LANG-SYSTEM | stage0/language.json selector |
| P2-MAP-01 | Arabic text-direction work marked OPEN; legacy map hidden below lg when NEXT_PUBLIC_MAP_SHELL off | MAP-COUNTRY | map/page.tsx:120-139; MapPageClient.tsx:2077 |
| P2-PRIV-05 | Production backend 5b714833 stores raw IPv4 (and /64 IPv6) in guest/compute limit scopes with no deletion; Alpha uses a keyed daily pseudonym — fixed at next promotion; live only if Production guest flags are on (unmeasured) | CONSENT | 5b714833:backend/src/modules/compute-controls/compute-scopes.ts:43-51 vs 5513275f:…:44-47 |
| P2-PRV-02 | /workspace fake page served by c908 Production | PREVIEW-ROUTES | workspace/page.tsx:273-285 |
| P2-SRC-04 | Retrieval authority defects D1–D7 | NEWS-SOURCES | docs/retrieval-source-authority-audit-r1.md (branch claude/retrieval-source-authority-audit-r1) |
| P2-THEME-01 | /terms /source-policy /third-party-notices dark-only | LEGAL | stage0/frontend-routes.json |
| P2-THEME-02 | Light theme not available on dashboards (hex palettes: humTokens 24, MI workspace 64-72) | THEME | stage0/frontend-routes.json theme; hexsummary |

### P3 — later enhancement (2)

| ID | Blocker | Capabilities | Evidence |
|---|---|---|---|
| P3-PAID-01 | Paid boundary (persistence, monitoring, briefings, alerts) undefined in code; charging hard-off by design | PAID | ask-compute.contract.ts:4 |
| P3-SIG-01 | Unbound substrate; decide retire vs bind | SIGNALS | app.module.ts:127 |

<!-- GENERATED:END -->
