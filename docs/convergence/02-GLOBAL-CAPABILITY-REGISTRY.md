# 02 — Global Capability Registry (human view)

Generated from `02-GLOBAL-CAPABILITY-REGISTRY.json` by `tools/render.py`. Do not edit by hand; edit `tools/capabilities.source.py`.

Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f` (Alpha runtime, Railway-verified) · Production `5b714833 / 58f80fd4` (runtime flags unmeasured, HOLD)

| Capability | Alpha state | Production state | Shared search | Citation | Continuity | Briefing | Follow | Alert | Locales (en pl fr de es pt ar) | Blockers |
|---|---|---|---|---|---|---|---|---|---|---|
| **ASK-CORE** Ask GlobalNewsAI (root /, /ask, global dock) | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS (evidenceId + governed basis) | PARTIAL (Ask V2 threads; prior user question only; prior-reference resolver unwired) | PARTIAL (briefing snapshot drops governed intelligence) | ABSENT | ABSENT | F F P P P P P | P0-ASK-01, P1-ASK-03, P1-ASK-04 |
| **ASK-SEARCH** Search (/search) on the shared Ask engine | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PARTIAL | PARTIAL | ABSENT | ABSENT | F F E E E E E | P0-LANG-01 |
| **ASK-LEGACY** Legacy POST /analysis/news engine | LOCAL_ONLY | UNVERIFIED_RUNTIME | SEARCHABLE | PASS | PARTIAL (priorQuestion only) | ABSENT | ABSENT | ABSENT | F F P P P P P | P1-ASK-05 |
| **CONVERSATION** Shared conversation continuity (prior answer, 'why did you say that', 'still true now') | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | FAIL (prior evidence/citations never carried forward) | PARTIAL | N/A | N/A | N/A | F F P P P P P | P1-CONV-01, P1-CONV-02 |
| **LANG-SYSTEM** Seven-locale display system (one switch governs whole UI) | COVERAGE_GAP | COVERAGE_GAP | N/A | N/A | N/A | N/A | N/A | N/A | F F E E E E E | P0-LANG-01, P0-LANG-02, P0-LANG-03, P1-LANG-04, P1-LANG-05, P1-LANG-06, P2-LANG-07 |
| **HOME** Home (What Changed · Follow · Alerts · Ask with Evidence) | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | N/A | N/A | ABSENT | PARTIAL | PARTIAL (in-app, flag off) | F F E E E E E | P1-HOME-01 |
| **MAP-COUNTRY** Map / country views | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PARTIAL | N/A | ABSENT | PARTIAL | ABSENT | F F E E E E E | P2-MAP-01 |
| **CONFLICT** Conflict (UCDP retained observations) | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PARTIAL | FAIL (dropped by briefing snapshot) | ABSENT | ABSENT | F F E E E E E | P0-ASK-01, P2-CONF-02 |
| **SECURITY** Security observations | PREVIEW_ONLY | UNVERIFIED_RUNTIME | RETAINED_ONLY | ABSENT | N/A | ABSENT | ABSENT | ABSENT | F E E E E E E | P1-SEC-01 |
| **POLITICS** Politics (institutions, legislatures, decisions) | PREVIEW_ONLY | UNVERIFIED_RUNTIME | RETAINED_ONLY | ABSENT | N/A | ABSENT | ABSENT | ABSENT | F F E E E E E | P1-POL-01 |
| **ECONOMY** Economy (official indicators) | ASK_BOUND | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PARTIAL | FAIL | ABSENT | ABSENT | F F E E E E E | P1-ECON-01, P1-ECON-02 |
| **MARKET** Market (TED procurement) | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PARTIAL | FAIL | ABSENT | ABSENT | F E E E E E E | P1-MKT-01, P1-MKT-02 |
| **ENERGY** Energy (Eurostat retained) | RETAINED_ONLY | UNVERIFIED_RUNTIME | RETAINED_ONLY | ABSENT | N/A | ABSENT | ABSENT | ABSENT | F F E E E E E | P1-ENG-01 |
| **ELECTION** Election (Kenya IEBC bundle only — not a global Election product) | PREVIEW_ONLY | UNVERIFIED_RUNTIME | RETAINED_ONLY | ABSENT | N/A | ABSENT | ABSENT | ABSENT | F F E E E E E | P2-ELE-01 |
| **HUMANITARIAN** Humanitarian | COVERAGE_GAP | UNVERIFIED_RUNTIME | ABSENT | ABSENT | N/A | ABSENT | ABSENT | ABSENT | F E E E E E E | P1-HUM-01 |
| **IMIHIGO** Imihigo (NISR retained snapshot) | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PARTIAL | FAIL | ABSENT | ABSENT | F F E E E E E | P1-RIGHTS-04 |
| **SIGNALS** Signals (GDELT GEO / Event Registry) | ABSENT | ABSENT | ABSENT | ABSENT | N/A | ABSENT | ABSENT | ABSENT | A A A A A A A | P3-SIG-01 |
| **MY-INTELLIGENCE** My Intelligence workspace | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PARTIAL | PARTIAL | PARTIAL | ABSENT | F F E E E E E | P1-MI-01, P1-MI-02 |
| **SAVED** Saved (Ask results) | ALPHA_LIVE | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | PASS | PARTIAL | N/A | N/A | F F E E E E E | — |
| **HISTORY-RECENT** History / Recent | ALPHA_LIVE | UNVERIFIED_RUNTIME | N/A | N/A | PASS | N/A | N/A | N/A | F P E E E E E | P1-HIST-01 |
| **BRIEFINGS** Briefings | LOCAL_ONLY | ABSENT | RETAINED_ONLY | FAIL (governed intelligence dropped; RETAINED_RECORD answers unbriefable) | PARTIAL | PARTIAL | N/A | N/A | F F E E E E E | P1-BRF-01 |
| **FOLLOW** Follow an issue / country | LOCAL_ONLY | UNVERIFIED_RUNTIME | N/A | N/A | N/A | ABSENT | PARTIAL | ABSENT | F F E E E E E | P2-FOL-01 |
| **ALERTS-WATCH** Alerts / Watch | DESIGN_ONLY | ABSENT | RETAINED_ONLY | N/A | N/A | N/A | N/A | LOCAL_ONLY | F F E E E E E | P2-ALR-01 |
| **DISCUSSIONS** Discussions / comments | LOCAL_ONLY | ABSENT | RETAINED_ONLY | N/A | N/A | N/A | N/A | N/A | F F E E E E E | P2-DIS-01 |
| **ACCOUNT-AUTH** Account, sign-in, settings | ALPHA_LIVE | UNVERIFIED_RUNTIME | N/A | N/A | N/A | N/A | N/A | N/A | F P E E E E E | P1-ACC-01 |
| **SUPPORT** Support / Help & feedback | ALPHA_LIVE | UNVERIFIED_RUNTIME | N/A | N/A | N/A | N/A | N/A | N/A | F F E E E E E | P1-LANG-06 |
| **LEGAL** Privacy, Cookies, Terms, Source policy, Third-party notices | ALPHA_LIVE | UNVERIFIED_RUNTIME | N/A | N/A | N/A | N/A | N/A | N/A | F F E E E E E | P1-LEG-01, P2-THEME-01 |
| **CONSENT** Pre-login consent / cookie / data-handling notice | ABSENT | ABSENT | N/A | N/A | N/A | N/A | N/A | N/A | A A A A A A A | P0-PRIV-01, P1-PRIV-03, P1-PRIV-04, P2-PRIV-05 |
| **THEME** Light/Dark theme system | LOCAL_ONLY | UNVERIFIED_RUNTIME | N/A | N/A | N/A | N/A | N/A | N/A | - - - - - - - | P2-THEME-02 |
| **PREVIEW-ROUTES** Preview / fixture route containment | PREVIEW_ONLY | UNVERIFIED_RUNTIME | N/A | N/A | N/A | N/A | N/A | N/A | F F E E E E E | P1-PRV-01, P2-PRV-02 |
| **NEWS-SOURCES** News retrieval + source coverage (local vs international) | COVERAGE_GAP | UNVERIFIED_RUNTIME | ASK_BOUND | PASS | N/A | N/A | N/A | N/A | - - - - - - - | P0-SRC-01, P1-SRC-02, P1-SRC-03, P2-SRC-04 |
| **TELEMETRY-ADMIN** Admin + analytics | LOCAL_ONLY | UNVERIFIED_RUNTIME | N/A | N/A | N/A | N/A | N/A | N/A | F F E E E E E | P1-OBS-01 |
| **PAID** Paid product (Sand ledger / charging) | DESIGN_ONLY | ABSENT | N/A | N/A | N/A | N/A | N/A | N/A | A A A A A A A | P3-PAID-01 |

Locale key: F full · P partial · E English fallback · A absent · - not applicable.

## Per-capability detail

### ASK-CORE — Ask GlobalNewsAI (root /, /ask, global dock)

- Surface: /, /ask, AskAiDock (all platform routes)
- Backend owner: ask-v2, ask-router (routeAskR2 / SemanticTurnIR), analysis (engine under adapter), ask-intelligence
- Frontend owner: components/ask-frame, components/ask, lib/ask
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority); guest trial OFF by design (not a defect)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: news (GNews) + governed UCDP/TED/NISR CPI/Imihigo records
- Source rights: BLOCKED_RIGHTS (GNews has no rights record; see 07)
- Source languages: en, fr, es, ar (native GNews search), pl (headlines then en), de/pt (en strategy), sw/rw (en strategy)
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json, stage0/backend-modules.json#ask-v2, AskFrameScreen.tsx:158, AskAiDock.tsx:300
- **P0 P0-ASK-01** — Conflict contributor selected for any country + 'situation' (travel/visa/political/energy/economic questions inject UCDP records) _(evidence: backend/src/modules/ask-intelligence/contributor-selection.ts:29-45,224-236; stage0/search-binding.json R1)_
- **P1 P1-ASK-03** — FR/DE/ES/PT/AR Ask chrome partly English on Alpha 5513275f; resolved in H final 266007c (pending final R4 integration) _(evidence: stage0/language.json; useRotatingExample.ts:126)_
- **P1 P1-ASK-04** — Deterministic routers/conversation readers EN/PL only (7 guards) _(evidence: knowledge-requirement.ts:400,438; turn-normalization.ts:64; conversation-place.ts:41)_

### ASK-SEARCH — Search (/search) on the shared Ask engine

- Surface: /search
- Backend owner: ask-v2
- Frontend owner: components/search
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: as ASK-CORE
- Source rights: BLOCKED_RIGHTS
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: SearchPageClient.tsx:246, stage0/frontend-routes.json
- **P0 P0-LANG-01** — Selector offers 7 locales but 36 route files + root layout clamp to en/pl via isActiveLanguageCode; fr/de/es/pt/ar render English; <html lang> en|pl only _(evidence: frontend/src/lib/i18n/languages.ts:21,91,159; app/layout.tsx:193,259,273; app/search/page.tsx:20)_

### ASK-LEGACY — Legacy POST /analysis/news engine

- Surface: (no live frontend caller at 5513275f)
- Backend owner: analysis
- Frontend owner: lib/api/analysisApi.ts (orphan useAskConversation, AnalysisFrameClient)
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **LOCAL_ONLY**
- Production: **UNVERIFIED_RUNTIME** — legacy route still served by Production backend 5b714833 (frontend callers: see T4 caller graph)
- Data: news
- Source rights: BLOCKED_RIGHTS
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json R2
- **P1 P1-ASK-05** — Second public Ask engine still served; bypasses routeAskR2 and governed reads; contradicts 'one Ask engine'. Retire after Production moves to Ask V2 _(evidence: analysis.controller.ts:66; stage0/search-binding.json R2)_

### CONVERSATION — Shared conversation continuity (prior answer, 'why did you say that', 'still true now')

- Surface: /ask, dock, /search
- Backend owner: ask-v2 (threads), ask-router (conversation-state)
- Frontend owner: lib/ask
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: AskThread/AskTurn/StoredResult
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json continuity
- **P1 P1-CONV-01** — prior-reference resolver has no production importer; 'Why did you say that?' detected but not resolved against prior answer _(evidence: ask-v2/conversation/prior-reference.ts:282; user-job.ts:649-660)_
- **P1 P1-CONV-02** — 'Is it still true now?' re-retrieves fresh reporting; never re-verifies the prior claim against its own evidence _(evidence: user-job.ts:682)_

### LANG-SYSTEM — Seven-locale display system (one switch governs whole UI)

- Surface: all routes
- Backend owner: analysis DTO, ask-v2 DTO, telemetry DTO, news top-headlines DTO
- Frontend owner: lib/i18n, lib/ask (askSevenStrings, askLocale), app/layout.tsx
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **COVERAGE_GAP** — 7 locales selectable; full-shell rendering only en/pl; Ask frame partial for fr–ar
- Production: **COVERAGE_GAP** — Production frontend 58f80fd4: ACTIVE_LANGUAGES en/pl; no seven-locale Ask catalogue
- Data: 23 catalogues + 12 inline tables + 41 '=== pl' branches; 3 catalogues hold all 7 locales
- Source rights: N/A
- Source languages: sw, rw (retrieval only; still present in UI-facing LANGUAGE tables)
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/language.json
- **P0 P0-LANG-01** — Selector offers 7 locales but 36 route files + root layout clamp to en/pl via isActiveLanguageCode; fr/de/es/pt/ar render English; <html lang> en|pl only _(evidence: frontend/src/lib/i18n/languages.ts:21,91,159; app/layout.tsx:193,259,273)_
- **P0 P0-LANG-02** — Stored fr–ar choice is overwritten to 'pl' on Polish browsers _(evidence: LanguageSync.tsx:52-58; Hero.tsx:264-269)_
- **P0 P0-LANG-03** — No <html dir>; Arabic RTL only inside AskFrameScreen; Economy forces dir=ltr _(evidence: AskFrameScreen.tsx:431-432; EconomyScreen.tsx:222)_
- **P1 P1-LANG-04** — Main dictionary has no fr/de/es/pt/ar catalogue (2813 keys); recovered C55 catalogues dormant at 1655/2813 (58.8%), 0 keys for My Intelligence/Home R1/Reva/Ask AI _(evidence: stage0/language.json coverage)_
- **P1 P1-LANG-05** — LanguageCode type lacks de/pt; analysis + telemetry DTOs reject de/pt; no de/pt retrieval strategy _(evidence: shared/src/analysis.ts:30; analyze-news.dto.ts:144; record-event.dto.ts:51)_
- **P1 P1-LANG-06** — Stale 'English and Polish only' copy live in support _(evidence: supportEn.ts:304; supportPl.ts:216)_
- **P2 P2-LANG-07** — Preference not persisted to account; no Accept-Language _(evidence: stage0/language.json selector)_

### HOME — Home (What Changed · Follow · Alerts · Ask with Evidence)

- Surface: / (platform mode, GNA_PUBLIC_ROOT=platform)
- Backend owner: news, follows, stories
- Frontend owner: components/home, lib/homeFeed.ts
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority); Home R1 discussion/alert flags still unmeasured
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: GNews top headlines (en/pl only)
- Source rights: BLOCKED_RIGHTS
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/language.json, stage0/backend-modules.json#news
- **P1 P1-HOME-01** — Top-headlines DTO en/pl only; Home R1 discussion/alert flags default off; four-service Home not provable without flags _(evidence: top-headlines-query.dto.ts:20; stage0/backend-notes flags)_

### MAP-COUNTRY — Map / country views

- Surface: /map
- Backend owner: geo, news (country), conflict-observation
- Frontend owner: components/map, lib/map
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: world-atlas geometry + GNews country feed + retained
- Source rights: BLOCKED_RIGHTS
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/frontend-routes.json
- **P2 P2-MAP-01** — Arabic text-direction work marked OPEN; legacy map hidden below lg when NEXT_PUBLIC_MAP_SHELL off _(evidence: map/page.tsx:120-139; MapPageClient.tsx:2077)_

### CONFLICT — Conflict (UCDP retained observations)

- Surface: /conflict, /map overlay
- Backend owner: conflict-observation, conflict-claim, ask-intelligence
- Frontend owner: components/conflict
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: RETAINED (UCDP Candidate capture via operator script)
- Source rights: RIGHTS_CLEARED (UCDP Candidate E-5); UCDP GED API BLOCKED_CREDENTIAL
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json conflict
- **P0 P0-ASK-01** — Conflict contributor selected for any country + 'situation' (travel/visa/political/energy/economic questions inject UCDP records) _(evidence: backend/src/modules/ask-intelligence/contributor-selection.ts:29-45,224-236; stage0/search-binding.json R1)_
- **P2 P2-CONF-02** — capture script bypasses safe-fetch _(evidence: backend/src/tooling/ucdp-candidate-alpha-r1.ts:65)_

### SECURITY — Security observations

- Surface: /security-visual-preview (preview)
- Backend owner: security (SecurityProducerModule not imported)
- Frontend owner: lib/securityApi.ts (0 importers)
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **PREVIEW_ONLY**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: route returns NOT_ASSESSED; security served through Conflict
- Source rights: UNKNOWN
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-modules.json#security
- **P1 P1-SEC-01** — SecurityObservation store unbound; producer module never imported _(evidence: stage0/backend-modules.json#security)_

### POLITICS — Politics (institutions, legislatures, decisions)

- Surface: /politics-visual-preview (preview)
- Backend owner: politics
- Frontend owner: components/politics
- Authority: `specialist/politics-r1-integration-d920893 (active lane, 3 ahead)` @ `d9208933`
- Alpha: **PREVIEW_ONLY**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: POLITICS_RETAINED_CAPTURES = [] (empty ledger); lane adds observation store migration
- Source rights: UNKNOWN
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/workstreams.json politics lane
- **P1 P1-POL-01** — No searchable projection or Ask contributor; route constant NOT_ASSESSED; owned by Politics lane — consume its handoff _(evidence: politics.retained.ts:9; stage0/search-binding.json politics)_

### ECONOMY — Economy (official indicators)

- Surface: /economy-visual-preview (preview)
- Backend owner: economy, official-data (NISR CPI)
- Frontend owner: components/economy, lib/economy
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ASK_BOUND** — Ask-bound for Rwanda NISR CPI only; UI is preview-only
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: RETAINED (NISR CPI RWA); Eurostat producer unbound
- Source rights: BLOCKED_RIGHTS (rw-nisr RIGHTS-RECORD-UNRESOLVED yet served); Eurostat E-5 recorded twice outside registry
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json economy
- **P1 P1-ECON-01** — NISR CPI served while rw-nisr rights unresolved _(evidence: stage0/sources.json; official-source-registry.ts:171)_
- **P1 P1-ECON-02** — Seven-locale economyStrings unreachable (route clamps); forced LTR _(evidence: economy-visual-preview/page.tsx:53; EconomyScreen.tsx:222)_

### MARKET — Market (TED procurement)

- Surface: /market, /market/compact (orphan)
- Backend owner: market-ingest (read only; scheduler/adapters unbound)
- Frontend owner: components/market, lib/market
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: RETAINED (TED capture via operator script)
- Source rights: RIGHTS_CLEARED (TED E-5)
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json market
- **P1 P1-MKT-01** — Procurement read takes newest 20 notices before country filter → false NO_MATCH _(evidence: ask-specialist-read.coordinator.ts:369-375)_
- **P1 P1-MKT-02** — mktStrings English-only (PL disclosed fallback) _(evidence: mktStrings.ts:316)_

### ENERGY — Energy (Eurostat retained)

- Surface: /energy
- Backend owner: energy
- Frontend owner: components/energy
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **RETAINED_ONLY**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: RETAINED (Eurostat nrg_cb_pem one capture); ENTSO-E BLOCKED_CREDENTIAL
- Source rights: RIGHTS_CLEARED (Eurostat)
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json energy
- **P1 P1-ENG-01** — Not Ask-bound; energy questions select Conflict instead _(evidence: stage0/search-binding.json energy; probe)_

### ELECTION — Election (Kenya IEBC bundle only — not a global Election product)

- Surface: /election-visual-preview (preview)
- Backend owner: election
- Frontend owner: components/election
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **PREVIEW_ONLY**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: RETAINED (IEBC PDF committed); reader flag ELECTION_EVIDENCE_READ_ENABLED default false
- Source rights: BLOCKED_RIGHTS (admission policy, no rights record)
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-modules.json#election
- **P2 P2-ELE-01** — Election capability matrix (calendar, authority, races, results, polling, voting areas) absent beyond one KE bundle _(evidence: stage0/sources.json election)_

### HUMANITARIAN — Humanitarian

- Surface: /humanitarian, /humanitarian/compact (orphan)
- Backend owner: humanitarian (boot module absent: HUMANITARIAN_PROVISIONING undefined)
- Frontend owner: components/humanitarian, lib/humanitarian
- Authority: `integration/humanitarian-data-r1-convergence (active lane, 31 ahead / 84 behind, not final)` @ `05e6c23e`
- Alpha: **COVERAGE_GAP**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: NOT_ASSESSED constant at 5513275f; ReliefWeb/HDX/OCHA/ACLED absent; Copernicus EMS E-5 CONDITIONAL
- Source rights: BLOCKED_CREDENTIAL / BLOCKED_RIGHTS (per lane)
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/workstreams.json humanitarian
- **P1 P1-HUM-01** — No functioning reader at Alpha; lane must rebase (84 behind) and collides on MyIntelligenceClient.tsx with H; credential-dependent sources need approved org identity _(evidence: stage0/workstreams.json; humanitarian.registration.ts:84)_

### IMIHIGO — Imihigo (NISR retained snapshot)

- Surface: /imihigo, /imihigo/compact (orphan)
- Backend owner: ask-intelligence (imihigo-retained.json)
- Frontend owner: lib/imihigo/retained.json
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: RETAINED (capture 2026-09-22)
- Source rights: BLOCKED_RIGHTS (self-declared CC BY, not through rights evaluator)
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/sources.json imihigo
- **P1 P1-RIGHTS-04** — Imihigo committed/served without rights-evaluator record _(evidence: data/imihigo/capture.json:4)_

### SIGNALS — Signals (GDELT GEO / Event Registry)

- Surface: —
- Backend owner: signals (registered, nothing injects SignalsService)
- Frontend owner: —
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ABSENT**
- Production: **ABSENT** — unbound substrate
- Data: none (live-only providers, no store)
- Source rights: BLOCKED_RIGHTS (no rights record); .env.example GDELT_ENABLED=true
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-modules.json#signals
- **P3 P3-SIG-01** — Unbound substrate; decide retire vs bind _(evidence: app.module.ts:127)_

### MY-INTELLIGENCE — My Intelligence workspace

- Surface: /my-intelligence
- Backend owner: my-intelligence, follows, ask-v2 (selection)
- Frontend owner: components/my-intelligence
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: SavedStory, interests, follows; dev fixtures behind NEXT_PUBLIC_MI_DEV_FIXTURES
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/frontend-routes.json
- **P1 P1-MI-01** — Public ?state= review switch on Alpha route; dev fixtures in import graph (env-gated) _(evidence: app/my-intelligence/page.tsx:25-31; devFixtures.ts:30)_
- **P1 P1-MI-02** — File collision between H and Humanitarian lanes _(evidence: components/my-intelligence/MyIntelligenceClient.tsx)_

### SAVED — Saved (Ask results)

- Surface: /saved
- Backend owner: ask-v2 (bookmarks)
- Frontend owner: components/ask-nav, lib/ask
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: StoredResult bookmarks
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/language.json Saved

### HISTORY-RECENT — History / Recent

- Surface: /ask/recent, /history (legacy)
- Backend owner: ask-v2 (threads), history (SearchHistoryEntry — written only by legacy /analysis/news)
- Frontend owner: components/ask-nav, app/history
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: AskThread (recent); SearchHistoryEntry stale
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/frontend-routes.json
- **P1 P1-HIST-01** — /history on Production allowlist but legacy, hard-coded English, links to /search which redirects _(evidence: standaloneRouteGate.ts:30; history/page.tsx:50-79)_

### BRIEFINGS — Briefings

- Surface: /saved/briefing
- Backend owner: ask-v2 (briefings, ASK_BRIEFINGS_ENABLED)
- Frontend owner: components/briefing
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **LOCAL_ONLY** — flag ASK_BRIEFINGS_ENABLED absent by default; route not in Standalone allowlist
- Production: **ABSENT** — no briefings in Production backend 5b714833; /saved/briefing absent in 58f80fd4
- Data: briefing snapshots
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/search-binding.json R3
- **P1 P1-BRF-01** — briefing-snapshot ignores payload.intelligence; governed answers lose provenance or are unbriefable _(evidence: briefing-snapshot.ts:65-102)_

### FOLLOW — Follow an issue / country

- Surface: platform Home, /my-intelligence
- Backend owner: follows
- Frontend owner: lib/api (follows)
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **LOCAL_ONLY** — countries only; no issue follow; not in Standalone
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: FollowedCountry
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-modules.json#follows
- **P2 P2-FOL-01** — Follow is country-only; 'Follow an Issue' (paid core service) absent _(evidence: stage0/backend-modules.json#follows)_

### ALERTS-WATCH — Alerts / Watch

- Surface: Home R1 alerts centre (flag)
- Backend owner: stories (StoryAlert, ALERTS_IN_APP), watch (WATCH_RUNTIME_ACTIVE=false, no Nest module)
- Frontend owner: components/home (AlertsCentre)
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **DESIGN_ONLY** — in-app alert foundation behind ALERTS_IN_APP (default off); no push transport; Watch dormant
- Production: **ABSENT** — `stories` module absent in Production backend 5b714833; Watch dormant
- Data: StoryAlert only
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-modules.json
- **P2 P2-ALR-01** — No material-change detection, push/PWA transport or user controls; in-app ≠ phone alerts _(evidence: stage0/backend-modules.json#watch,#stories)_

### DISCUSSIONS — Discussions / comments

- Surface: Home R1 DiscussionPanel (flag)
- Backend owner: stories (DISCUSSION_READ/WRITE)
- Frontend owner: components/home (DiscussionPanel)
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **LOCAL_ONLY** — DISCUSSION_READ/WRITE absent by default; docker-compose passes neither
- Production: **ABSENT** — `stories` module absent in Production backend 5b714833
- Data: story discussion tables; excluded from Ask by design (proven)
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stories.structure.spec.ts
- **P2 P2-DIS-01** — Moderation/ownership/privacy/mobile flow not provable while flags off _(evidence: stage0/backend-notes flags)_

### ACCOUNT-AUTH — Account, sign-in, settings

- Surface: /account/settings
- Backend owner: auth, users
- Frontend owner: components/account, components/auth
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: User, sessions (Google OAuth)
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/language.json Account/Settings
- **P1 P1-ACC-01** — platform-mode settings hard-code language='en' _(evidence: account/settings/page.tsx:27)_

### SUPPORT — Support / Help & feedback

- Surface: /support
- Backend owner: support (SUPPORT_AI_ENABLED false)
- Frontend owner: components/support
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: support tickets
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/language.json Support
- **P1 P1-LANG-06** — Stale 'English and Polish only' copy live in support _(evidence: supportEn.ts:304; supportPl.ts:216)_

### LEGAL — Privacy, Cookies, Terms, Source policy, Third-party notices

- Surface: /privacy, /cookies, /terms, /source-policy, /third-party-notices
- Backend owner: —
- Frontend owner: app/(legal pages)
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ALPHA_LIVE** — runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)
- Production: **UNVERIFIED_RUNTIME** — code present at 58f80fd4 except /cookies; runtime flags not measured (HOLD)
- Data: static
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/frontend-routes.json
- **P1 P1-LEG-01** — NavBar on legal pages links to /search and /my-intelligence which redirect in Production _(evidence: NavBar.tsx:223,353; AccountControl.tsx:258)_
- **P2 P2-THEME-01** — /terms /source-policy /third-party-notices dark-only _(evidence: stage0/frontend-routes.json)_

### CONSENT — Pre-login consent / cookie / data-handling notice

- Surface: —
- Backend owner: —
- Frontend owner: —
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **ABSENT**
- Production: **ABSENT** — no consent notice component at 58f80fd4
- Data: none
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/language.json
- **P0 P0-PRIV-01** — Public-Beta Production P0: pre-login privacy/data/cookie notice and guest-trial boundary (≥3 questions before login, truthful guest session) not proven _(evidence: no consent component at 5513275f or 58f80fd4; contract R2 T5; Alpha guest OFF is intentional)_
- **P1 P1-PRIV-03** — Privacy page retention claims (limit identifiers ~1 week, usage 90 days, conversations 12 months) hold only when RETENTION_SWEEP_ENABLED=true (default off); privacy/cookies/guest copy en/pl only _(evidence: stage2/T5-CONSENT-GUEST-TRIAL.md; RETENTION_SWEEP_ENABLED default)_
- **P1 P1-PRIV-04** — Guest claim moves ALL guest conversations (copy says 'keep this conversation'); plain sign-in leaves guest data visible on shared device; no immediate guest-data deletion; no /cookies footer link (fixed on T5B branch for non-protected surfaces; Ask composer mounts P-1/P-4/P-5 await H) _(evidence: stage2/T5-CONSENT-GUEST-TRIAL.md patches P-1..P-5)_
- **P2 P2-PRIV-05** — Production backend 5b714833 stores raw IPv4 (and /64 IPv6) in guest/compute limit scopes with no deletion; Alpha uses a keyed daily pseudonym — fixed at next promotion; live only if Production guest flags are on (unmeasured) _(evidence: 5b714833:backend/src/modules/compute-controls/compute-scopes.ts:43-51 vs 5513275f:…:44-47)_

### THEME — Light/Dark theme system

- Surface: all routes
- Backend owner: —
- Frontend owner: app/globals.css, domain token files
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **LOCAL_ONLY** — tokens exist; every Alpha dashboard dark-only with hex-colour token files
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: N/A
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/frontend-routes.json
- **P2 P2-THEME-02** — Light theme not available on dashboards (hex palettes: humTokens 24, MI workspace 64-72) _(evidence: stage0/frontend-routes.json theme; hexsummary)_

### PREVIEW-ROUTES — Preview / fixture route containment

- Surface: /{delivery,economy,election,politics,security}-visual-preview (+compact), /workspace, orphan compacts
- Backend owner: —
- Frontend owner: app/*-visual-preview, app/workspace
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **PREVIEW_ONLY** — 10 preview routes public without auth on platform Alpha (noindex only); /workspace fake page
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: design fixtures (none reachable as evidence)
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/frontend-routes.json
- **P1 P1-PRV-01** — Preview routes linked from Alpha Home/My Intelligence and public _(evidence: lib/intelligenceModules.ts:203,284,305; homeRevaModel.ts:101; miWorkspaceModel.ts:53-68)_
- **P2 P2-PRV-02** — /workspace fake page served by c908 Production _(evidence: workspace/page.tsx:273-285)_

### NEWS-SOURCES — News retrieval + source coverage (local vs international)

- Surface: all evidence answers
- Backend owner: news, global-reach (admin only), official-sources
- Frontend owner: —
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **COVERAGE_GAP**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: 1 active source (GNews) of 348 records; 0 active+rights-cleared local in 54 priority countries
- Source rights: BLOCKED_RIGHTS
- Source languages: en, fr, es, ar, pl
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/sources.json, stage0/source-coverage.json
- **P0 P0-SRC-01** — GNews (no rights record) is the only active source and silently substitutes for local coverage in all 54 priority countries; no COVERAGE_GAP disclosure _(evidence: news.module.ts:71; stage0/source-coverage.json)_
- **P1 P1-SRC-02** — RSS activation bypasses rights (Standard Media RESTRICTED activatable by env) _(evidence: feed-source-registry.ts:213-241)_
- **P1 P1-SRC-03** — Placeholder API keys count as configured _(evidence: provider.tokens.ts:59-61; .env.example:209)_
- **P2 P2-SRC-04** — Retrieval authority defects D1–D7 _(evidence: docs/retrieval-source-authority-audit-r1.md (branch claude/retrieval-source-authority-audit-r1))_

### TELEMETRY-ADMIN — Admin + analytics

- Surface: /admin/** (22 pages)
- Backend owner: admin (ADMIN_PLATFORM_ENABLED), telemetry
- Frontend owner: components/admin, lib/admin
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **LOCAL_ONLY**
- Production: **UNVERIFIED_RUNTIME** — code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)
- Data: AnalysisRun only for /analysis/news; Ask V2 traffic invisible
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-modules.json#telemetry
- **P1 P1-OBS-01** — Telemetry interceptor records only /analysis/news; admin analytics blind to Ask V2 _(evidence: telemetry.interceptor.ts:31,40; admin-analytics.service.ts:238)_

### PAID — Paid product (Sand ledger / charging)

- Surface: —
- Backend owner: ask-v2 (SAND_LEDGER_ENABLED false; SAND_CHARGING_ENABLED literal false)
- Frontend owner: —
- Authority: `release/alpha-r4-search-conversation-5513275` @ `5513275f`
- Alpha: **DESIGN_ONLY**
- Production: **ABSENT** — charging hard-off
- Data: none
- Source rights: N/A
- Source languages: —
- Rollback: rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md
- Evidence: stage0/backend-notes flags
- **P3 P3-PAID-01** — Paid boundary (persistence, monitoring, briefings, alerts) undefined in code; charging hard-off by design _(evidence: ask-compute.contract.ts:4)_
