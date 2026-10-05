"""
WHOLE-PRODUCT CONVERGENCE R1 — capability registry SOURCE.

This file is the hand-maintained source of truth for 02-GLOBAL-CAPABILITY-REGISTRY.json.
Every cell is a MEASURED value from docs/convergence/stage0/*.json (commit 5513275f) or a
direct code/ref inspection cited in `evidence`. Run `python3 docs/convergence/tools/render.py`
after editing; it regenerates the JSON registry, 02 .md, and 09 acceptance matrix.

Cell vocabulary for the acceptance matrix (09):
  PASS     measured working in code at the authority SHA
  PARTIAL  measured working for a subset (stated in evidence)
  FAIL     measured not working / wrong
  ABSENT   no implementation
  N/A      not applicable to this capability
  UNVERIFIED  code path exists but depends on a deployment flag/value that cannot be observed
              from this measurement (Alpha/Production hosts are not reachable from the
              measuring container); never counted as green.
Locale cells use the language measurement vocabulary: FULL | PARTIAL | EN_FALLBACK | ABSENT.
"""

AUTH = {"branch": "release/alpha-r4-search-conversation-5513275", "sha": "5513275f"}
PROD_REF = {"branch": "release/production-c908", "sha": "a9cf8a89"}
ROLLBACK_ALPHA = "rollback/alpha-pre-home-discussions-alerts-r1 @ 58f80fd4 (only rollback ref); previous Alpha release refs listed in 13-ROLLBACK-REGISTRY.md"

L = lambda en, pl, rest: {"en": en, "pl": pl, "fr": rest, "de": rest, "es": rest, "pt": rest, "ar": rest}
ASK_LOC = L("FULL", "FULL", "PARTIAL")
CLAMP = L("FULL", "FULL", "EN_FALLBACK")
EN_ONLY = L("FULL", "EN_FALLBACK", "EN_FALLBACK")
EN_PLPARTIAL = L("FULL", "PARTIAL", "EN_FALLBACK")
NO_LOC = L("ABSENT", "ABSENT", "ABSENT")


def cap(**k):
    k.setdefault("authority", AUTH)
    k.setdefault("rollbackAuthority", ROLLBACK_ALPHA)
    k.setdefault("sourceLanguages", [])
    k.setdefault("blockers", [])
    return k


CAPABILITIES = [
    cap(
        id="ASK-CORE",
        name="Ask GlobalNewsAI (root /, /ask, global dock)",
        surface=["/", "/ask", "AskAiDock (all platform routes)"],
        backendOwner=["ask-v2", "ask-router (routeAskR2 / SemanticTurnIR)", "analysis (engine under adapter)", "ask-intelligence"],
        frontendOwner=["components/ask-frame", "components/ask", "lib/ask"],
        alphaState="ASK_BOUND",
        productionState="ABSENT",
        productionNote="c908 serves legacy /analysis/news Ask (see ASK-LEGACY); Ask V2 absent at c908",
        dataState="news (GNews) + governed UCDP/TED/NISR CPI/Imihigo records",
        sourceRightsState="BLOCKED_RIGHTS (GNews has no rights record; see 07)",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS (evidenceId + governed basis)",
        continuityState="PARTIAL (Ask V2 threads; prior user question only; prior-reference resolver unwired)",
        briefingState="PARTIAL (briefing snapshot drops governed intelligence)",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=ASK_LOC,
        sourceLanguages=["en", "fr", "es", "ar (native GNews search)", "pl (headlines then en)", "de/pt (en strategy)", "sw/rw (en strategy)"],
        blockers=[
            {"id": "P0-ASK-01", "priority": "P0", "summary": "Conflict contributor selected for any country + 'situation' (travel/visa/political/energy/economic questions inject UCDP records)", "evidence": "backend/src/modules/ask-intelligence/contributor-selection.ts:29-45,224-236; stage0/search-binding.json R1"},
            {"id": "P1-ASK-02", "priority": "P1", "summary": "Ask V2 requires ASK_V2_ENABLED+ASK_R2_ENABLED+ASK_PUBLIC_COMPUTE_ENABLED (+DB switch); code default OFF; Alpha value unobservable — if unset Ask shows 'unavailable' on every surface", "evidence": "ask-v2.controller.ts:61; AskFrameScreen.tsx:137-139"},
            {"id": "P1-ASK-03", "priority": "P1", "summary": "FR/DE/ES/PT/AR Ask chrome partly English (askR2Strings 184 keys en/pl only); FR–AR example questions are unqualified drafts shown to readers", "evidence": "stage0/language.json; useRotatingExample.ts:126"},
            {"id": "P1-ASK-04", "priority": "P1", "summary": "Deterministic routers/conversation readers EN/PL only (7 guards)", "evidence": "knowledge-requirement.ts:400,438; turn-normalization.ts:64; conversation-place.ts:41"},
        ],
        evidence=["stage0/search-binding.json", "stage0/backend-modules.json#ask-v2", "AskFrameScreen.tsx:158", "AskAiDock.tsx:300"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="UNVERIFIED", Citation="PASS", Continuity="PARTIAL", Briefing="PARTIAL", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="ASK-SEARCH",
        name="Search (/search) on the shared Ask engine",
        surface=["/search"],
        backendOwner=["ask-v2"],
        frontendOwner=["components/search"],
        alphaState="ASK_BOUND",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 /search uses legacy analyzeNews (ref only; deployment unobserved); at 5513275f /search is redirected to / in Standalone",
        dataState="as ASK-CORE",
        sourceRightsState="BLOCKED_RIGHTS",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS",
        continuityState="PARTIAL",
        briefingState="PARTIAL",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P0-LANG-01", "priority": "P0", "summary": "Selector offers 7 locales but 36 route files + root layout clamp to en/pl via isActiveLanguageCode; fr/de/es/pt/ar render English; <html lang> en|pl only", "evidence": "frontend/src/lib/i18n/languages.ts:21,91,159; app/layout.tsx:193,259,273; app/search/page.tsx:20"}],
        evidence=["SearchPageClient.tsx:246", "stage0/frontend-routes.json"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="UNVERIFIED", Citation="PASS", Continuity="PARTIAL", Briefing="PARTIAL", Follow="N/A", Alert="N/A", Mobile="PARTIAL", Desktop="PASS", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="ASK-LEGACY",
        name="Legacy POST /analysis/news engine",
        surface=["(no live frontend caller at 5513275f)"],
        backendOwner=["analysis"],
        frontendOwner=["lib/api/analysisApi.ts (orphan useAskConversation, AnalysisFrameClient)"],
        alphaState="LOCAL_ONLY",
        productionState="PRODUCTION_LIVE",
        productionNote="the Ask engine of c908 (ref only)",
        dataState="news",
        sourceRightsState="BLOCKED_RIGHTS",
        sharedSearchBinding="SEARCHABLE",
        citationState="PASS",
        continuityState="PARTIAL (priorQuestion only)",
        briefingState="ABSENT",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=L("FULL", "FULL", "PARTIAL"),
        blockers=[{"id": "P1-ASK-05", "priority": "P1", "summary": "Second public Ask engine still served; bypasses routeAskR2 and governed reads; contradicts 'one Ask engine'. Retire after Production moves to Ask V2", "evidence": "analysis.controller.ts:66; stage0/search-binding.json R2"}],
        evidence=["stage0/search-binding.json R2"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="FAIL", Citation="PASS", Continuity="PARTIAL", Briefing="ABSENT", Follow="N/A", Alert="N/A", Mobile="N/A", Desktop="N/A", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="CONVERSATION",
        name="Shared conversation continuity (prior answer, 'why did you say that', 'still true now')",
        surface=["/ask", "dock", "/search"],
        backendOwner=["ask-v2 (threads)", "ask-router (conversation-state)"],
        frontendOwner=["lib/ask"],
        alphaState="ASK_BOUND",
        productionState="ABSENT",
        dataState="AskThread/AskTurn/StoredResult",
        sourceRightsState="N/A",
        sharedSearchBinding="ASK_BOUND",
        citationState="FAIL (prior evidence/citations never carried forward)",
        continuityState="PARTIAL",
        briefingState="N/A",
        followState="N/A",
        alertState="N/A",
        displayLocales=L("FULL", "FULL", "PARTIAL"),
        blockers=[
            {"id": "P1-CONV-01", "priority": "P1", "summary": "prior-reference resolver has no production importer; 'Why did you say that?' detected but not resolved against prior answer", "evidence": "ask-v2/conversation/prior-reference.ts:282; user-job.ts:649-660"},
            {"id": "P1-CONV-02", "priority": "P1", "summary": "'Is it still true now?' re-retrieves fresh reporting; never re-verifies the prior claim against its own evidence", "evidence": "user-job.ts:682"},
        ],
        evidence=["stage0/search-binding.json continuity"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="PARTIAL", Citation="FAIL", Continuity="PARTIAL", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="LANG-SYSTEM",
        name="Seven-locale display system (one switch governs whole UI)",
        surface=["all routes"],
        backendOwner=["analysis DTO", "ask-v2 DTO", "telemetry DTO", "news top-headlines DTO"],
        frontendOwner=["lib/i18n", "lib/ask (askSevenStrings, askLocale)", "app/layout.tsx"],
        alphaState="COVERAGE_GAP",
        alphaNote="7 locales selectable; full-shell rendering only en/pl; Ask frame partial for fr–ar",
        productionState="ABSENT",
        productionNote="c908: ACTIVE_LANGUAGES=['en','pl'] only",
        dataState="23 catalogues + 12 inline tables + 41 '=== pl' branches; 3 catalogues hold all 7 locales",
        sourceRightsState="N/A",
        sharedSearchBinding="N/A",
        citationState="N/A",
        continuityState="N/A",
        briefingState="N/A",
        followState="N/A",
        alertState="N/A",
        displayLocales=L("FULL", "FULL", "EN_FALLBACK"),
        sourceLanguages=["sw", "rw (retrieval only; still present in UI-facing LANGUAGE tables)"],
        blockers=[
            {"id": "P0-LANG-01", "priority": "P0", "summary": "Selector offers 7 locales but 36 route files + root layout clamp to en/pl via isActiveLanguageCode; fr/de/es/pt/ar render English; <html lang> en|pl only", "evidence": "frontend/src/lib/i18n/languages.ts:21,91,159; app/layout.tsx:193,259,273"},
            {"id": "P0-LANG-02", "priority": "P0", "summary": "Stored fr–ar choice is overwritten to 'pl' on Polish browsers", "evidence": "LanguageSync.tsx:52-58; Hero.tsx:264-269"},
            {"id": "P0-LANG-03", "priority": "P0", "summary": "No <html dir>; Arabic RTL only inside AskFrameScreen; Economy forces dir=ltr", "evidence": "AskFrameScreen.tsx:431-432; EconomyScreen.tsx:222"},
            {"id": "P1-LANG-04", "priority": "P1", "summary": "Main dictionary has no fr/de/es/pt/ar catalogue (2813 keys); recovered C55 catalogues dormant at 1655/2813 (58.8%), 0 keys for My Intelligence/Home R1/Reva/Ask AI", "evidence": "stage0/language.json coverage"},
            {"id": "P1-LANG-05", "priority": "P1", "summary": "LanguageCode type lacks de/pt; analysis + telemetry DTOs reject de/pt; no de/pt retrieval strategy", "evidence": "shared/src/analysis.ts:30; analyze-news.dto.ts:144; record-event.dto.ts:51"},
            {"id": "P1-LANG-06", "priority": "P1", "summary": "Stale 'English and Polish only' copy live in support", "evidence": "supportEn.ts:304; supportPl.ts:216"},
            {"id": "P2-LANG-07", "priority": "P2", "summary": "Preference not persisted to account; no Accept-Language", "evidence": "stage0/language.json selector"},
        ],
        evidence=["stage0/language.json"],
        acceptance=dict(Data="N/A", Search="N/A", Ask="PARTIAL", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="FAIL", Desktop="FAIL", Rights="N/A", Security="N/A"),
    ),
    cap(
        id="HOME",
        name="Home (What Changed · Follow · Alerts · Ask with Evidence)",
        surface=["/ (platform mode, GNA_PUBLIC_ROOT=platform)"],
        backendOwner=["news", "follows", "stories"],
        frontendOwner=["components/home", "lib/homeFeed.ts"],
        alphaState="ALPHA_READY",
        alphaNote="platform Home only when GNA_PUBLIC_ROOT=platform (Alpha value unobservable); Home R1 gates GNA_* default off",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 Home (ref only); at 5513275f Standalone root serves Ask instead",
        dataState="GNews top headlines (en/pl only)",
        sourceRightsState="BLOCKED_RIGHTS",
        sharedSearchBinding="ASK_BOUND",
        citationState="N/A",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="PARTIAL",
        alertState="PARTIAL (in-app, flag off)",
        displayLocales=CLAMP,
        blockers=[{"id": "P1-HOME-01", "priority": "P1", "summary": "Top-headlines DTO en/pl only; Home R1 discussion/alert flags default off; four-service Home not provable without flags", "evidence": "top-headlines-query.dto.ts:20; stage0/backend-notes flags"}],
        evidence=["stage0/language.json", "stage0/backend-modules.json#news"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="UNVERIFIED", Citation="N/A", Continuity="N/A", Briefing="ABSENT", Follow="PARTIAL", Alert="UNVERIFIED", Mobile="PASS", Desktop="PASS", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="MAP-COUNTRY",
        name="Map / country views",
        surface=["/map"],
        backendOwner=["geo", "news (country)", "conflict-observation"],
        frontendOwner=["components/map", "lib/map"],
        alphaState="ALPHA_READY",
        alphaNote="redirected to / in Standalone; served when GNA_PUBLIC_ROOT=platform",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 /map (ref only)",
        dataState="world-atlas geometry + GNews country feed + retained",
        sourceRightsState="BLOCKED_RIGHTS",
        sharedSearchBinding="ASK_BOUND",
        citationState="PARTIAL",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="PARTIAL",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P2-MAP-01", "priority": "P2", "summary": "Arabic text-direction work marked OPEN; legacy map hidden below lg when NEXT_PUBLIC_MAP_SHELL off", "evidence": "map/page.tsx:120-139; MapPageClient.tsx:2077"}],
        evidence=["stage0/frontend-routes.json"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="UNVERIFIED", Citation="PARTIAL", Continuity="N/A", Briefing="ABSENT", Follow="PARTIAL", Alert="ABSENT", Mobile="PARTIAL", Desktop="PASS", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="CONFLICT",
        name="Conflict (UCDP retained observations)",
        surface=["/conflict", "/map overlay"],
        backendOwner=["conflict-observation", "conflict-claim", "ask-intelligence"],
        frontendOwner=["components/conflict"],
        alphaState="ASK_BOUND",
        productionState="ABSENT",
        dataState="RETAINED (UCDP Candidate capture via operator script)",
        sourceRightsState="RIGHTS_CLEARED (UCDP Candidate E-5); UCDP GED API BLOCKED_CREDENTIAL",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS",
        continuityState="PARTIAL",
        briefingState="FAIL (dropped by briefing snapshot)",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[
            {"id": "P0-ASK-01", "priority": "P0", "summary": "Conflict contributor selected for any country + 'situation' (travel/visa/political/energy/economic questions inject UCDP records)", "evidence": "backend/src/modules/ask-intelligence/contributor-selection.ts:29-45,224-236; stage0/search-binding.json R1"},
            {"id": "P2-CONF-02", "priority": "P2", "summary": "capture script bypasses safe-fetch", "evidence": "backend/src/tooling/ucdp-candidate-alpha-r1.ts:65"},
        ],
        evidence=["stage0/search-binding.json conflict"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="FAIL", Citation="PASS", Continuity="PARTIAL", Briefing="FAIL", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="PASS", Rights="PASS", Security="PARTIAL"),
    ),
    cap(
        id="SECURITY",
        name="Security observations",
        surface=["/security-visual-preview (preview)"],
        backendOwner=["security (SecurityProducerModule not imported)"],
        frontendOwner=["lib/securityApi.ts (0 importers)"],
        alphaState="PREVIEW_ONLY",
        productionState="ABSENT",
        dataState="route returns NOT_ASSESSED; security served through Conflict",
        sourceRightsState="UNKNOWN",
        sharedSearchBinding="RETAINED_ONLY",
        citationState="ABSENT",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=EN_ONLY,
        blockers=[{"id": "P1-SEC-01", "priority": "P1", "summary": "SecurityObservation store unbound; producer module never imported", "evidence": "stage0/backend-modules.json#security"}],
        evidence=["stage0/backend-modules.json#security"],
        acceptance=dict(Data="ABSENT", Search="ABSENT", Ask="ABSENT", Citation="ABSENT", Continuity="N/A", Briefing="ABSENT", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="UNVERIFIED", Security="PASS"),
    ),
    cap(
        id="POLITICS",
        name="Politics (institutions, legislatures, decisions)",
        surface=["/politics-visual-preview (preview)"],
        backendOwner=["politics"],
        frontendOwner=["components/politics"],
        authority={"branch": "specialist/politics-r1-integration-d920893 (active lane, 3 ahead)", "sha": "d9208933"},
        alphaState="PREVIEW_ONLY",
        productionState="ABSENT",
        dataState="POLITICS_RETAINED_CAPTURES = [] (empty ledger); lane adds observation store migration",
        sourceRightsState="UNKNOWN",
        sharedSearchBinding="RETAINED_ONLY",
        citationState="ABSENT",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P1-POL-01", "priority": "P1", "summary": "No searchable projection or Ask contributor; route constant NOT_ASSESSED; owned by Politics lane — consume its handoff", "evidence": "politics.retained.ts:9; stage0/search-binding.json politics"}],
        evidence=["stage0/workstreams.json politics lane"],
        acceptance=dict(Data="ABSENT", Search="ABSENT", Ask="ABSENT", Citation="ABSENT", Continuity="N/A", Briefing="ABSENT", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="UNVERIFIED", Security="PASS"),
    ),
    cap(
        id="ECONOMY",
        name="Economy (official indicators)",
        surface=["/economy-visual-preview (preview)"],
        backendOwner=["economy", "official-data (NISR CPI)"],
        frontendOwner=["components/economy", "lib/economy"],
        alphaState="ASK_BOUND",
        alphaNote="Ask-bound for Rwanda NISR CPI only; UI is preview-only",
        productionState="ABSENT",
        dataState="RETAINED (NISR CPI RWA); Eurostat producer unbound",
        sourceRightsState="BLOCKED_RIGHTS (rw-nisr RIGHTS-RECORD-UNRESOLVED yet served); Eurostat E-5 recorded twice outside registry",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS",
        continuityState="PARTIAL",
        briefingState="FAIL",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[
            {"id": "P1-ECON-01", "priority": "P1", "summary": "NISR CPI served while rw-nisr rights unresolved", "evidence": "stage0/sources.json; official-source-registry.ts:171"},
            {"id": "P1-ECON-02", "priority": "P1", "summary": "Seven-locale economyStrings unreachable (route clamps); forced LTR", "evidence": "economy-visual-preview/page.tsx:53; EconomyScreen.tsx:222"},
        ],
        evidence=["stage0/search-binding.json economy"],
        acceptance=dict(Data="PARTIAL", Search="PARTIAL", Ask="PARTIAL", Citation="PASS", Continuity="PARTIAL", Briefing="FAIL", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="MARKET",
        name="Market (TED procurement)",
        surface=["/market", "/market/compact (orphan)"],
        backendOwner=["market-ingest (read only; scheduler/adapters unbound)"],
        frontendOwner=["components/market", "lib/market"],
        alphaState="ASK_BOUND",
        productionState="ABSENT",
        dataState="RETAINED (TED capture via operator script)",
        sourceRightsState="RIGHTS_CLEARED (TED E-5)",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS",
        continuityState="PARTIAL",
        briefingState="FAIL",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=EN_ONLY,
        blockers=[
            {"id": "P1-MKT-01", "priority": "P1", "summary": "Procurement read takes newest 20 notices before country filter → false NO_MATCH", "evidence": "ask-specialist-read.coordinator.ts:369-375"},
            {"id": "P1-MKT-02", "priority": "P1", "summary": "mktStrings English-only (PL disclosed fallback)", "evidence": "mktStrings.ts:316"},
        ],
        evidence=["stage0/search-binding.json market"],
        acceptance=dict(Data="PASS", Search="PARTIAL", Ask="PARTIAL", Citation="PASS", Continuity="PARTIAL", Briefing="FAIL", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="PASS", Rights="PASS", Security="PARTIAL"),
    ),
    cap(
        id="ENERGY",
        name="Energy (Eurostat retained)",
        surface=["/energy"],
        backendOwner=["energy"],
        frontendOwner=["components/energy"],
        alphaState="RETAINED_ONLY",
        productionState="ABSENT",
        dataState="RETAINED (Eurostat nrg_cb_pem one capture); ENTSO-E BLOCKED_CREDENTIAL",
        sourceRightsState="RIGHTS_CLEARED (Eurostat)",
        sharedSearchBinding="RETAINED_ONLY",
        citationState="ABSENT",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P1-ENG-01", "priority": "P1", "summary": "Not Ask-bound; energy questions select Conflict instead", "evidence": "stage0/search-binding.json energy; probe"}],
        evidence=["stage0/search-binding.json energy"],
        acceptance=dict(Data="PARTIAL", Search="ABSENT", Ask="FAIL", Citation="ABSENT", Continuity="N/A", Briefing="ABSENT", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="PASS", Rights="PASS", Security="PARTIAL"),
    ),
    cap(
        id="ELECTION",
        name="Election (Kenya IEBC bundle only — not a global Election product)",
        surface=["/election-visual-preview (preview)"],
        backendOwner=["election"],
        frontendOwner=["components/election"],
        alphaState="PREVIEW_ONLY",
        productionState="ABSENT",
        dataState="RETAINED (IEBC PDF committed); reader flag ELECTION_EVIDENCE_READ_ENABLED default false",
        sourceRightsState="BLOCKED_RIGHTS (admission policy, no rights record)",
        sharedSearchBinding="RETAINED_ONLY",
        citationState="ABSENT",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P2-ELE-01", "priority": "P2", "summary": "Election capability matrix (calendar, authority, races, results, polling, voting areas) absent beyond one KE bundle", "evidence": "stage0/sources.json election"}],
        evidence=["stage0/backend-modules.json#election"],
        acceptance=dict(Data="PARTIAL", Search="ABSENT", Ask="ABSENT", Citation="ABSENT", Continuity="N/A", Briefing="ABSENT", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="HUMANITARIAN",
        name="Humanitarian",
        surface=["/humanitarian", "/humanitarian/compact (orphan)"],
        backendOwner=["humanitarian (boot module absent: HUMANITARIAN_PROVISIONING undefined)"],
        frontendOwner=["components/humanitarian", "lib/humanitarian"],
        authority={"branch": "integration/humanitarian-data-r1-convergence (active lane, 31 ahead / 84 behind, not final)", "sha": "05e6c23e"},
        alphaState="COVERAGE_GAP",
        productionState="ABSENT",
        dataState="NOT_ASSESSED constant at 5513275f; ReliefWeb/HDX/OCHA/ACLED absent; Copernicus EMS E-5 CONDITIONAL",
        sourceRightsState="BLOCKED_CREDENTIAL / BLOCKED_RIGHTS (per lane)",
        sharedSearchBinding="ABSENT",
        citationState="ABSENT",
        continuityState="N/A",
        briefingState="ABSENT",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=EN_ONLY,
        blockers=[{"id": "P1-HUM-01", "priority": "P1", "summary": "No functioning reader at Alpha; lane must rebase (84 behind) and collides on MyIntelligenceClient.tsx with H; credential-dependent sources need approved org identity", "evidence": "stage0/workstreams.json; humanitarian.registration.ts:84"}],
        evidence=["stage0/workstreams.json humanitarian"],
        acceptance=dict(Data="ABSENT", Search="ABSENT", Ask="PASS", Citation="ABSENT", Continuity="N/A", Briefing="ABSENT", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="PASS", Rights="FAIL", Security="PASS"),
        acceptanceNote="Ask=PASS means honest NOT_ASSESSED, never evidence (governed-answer.spec G5)",
    ),
    cap(
        id="IMIHIGO",
        name="Imihigo (NISR retained snapshot)",
        surface=["/imihigo", "/imihigo/compact (orphan)"],
        backendOwner=["ask-intelligence (imihigo-retained.json)"],
        frontendOwner=["lib/imihigo/retained.json"],
        alphaState="ASK_BOUND",
        productionState="ABSENT",
        dataState="RETAINED (capture 2026-09-22)",
        sourceRightsState="BLOCKED_RIGHTS (self-declared CC BY, not through rights evaluator)",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS",
        continuityState="PARTIAL",
        briefingState="FAIL",
        followState="ABSENT",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P1-RIGHTS-04", "priority": "P1", "summary": "Imihigo committed/served without rights-evaluator record", "evidence": "data/imihigo/capture.json:4"}],
        evidence=["stage0/sources.json imihigo"],
        acceptance=dict(Data="PASS", Search="PASS", Ask="PASS", Citation="PASS", Continuity="PARTIAL", Briefing="FAIL", Follow="ABSENT", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="PASS", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="SIGNALS",
        name="Signals (GDELT GEO / Event Registry)",
        surface=[],
        backendOwner=["signals (registered, nothing injects SignalsService)"],
        frontendOwner=[],
        alphaState="ABSENT",
        productionState="ABSENT",
        dataState="none (live-only providers, no store)",
        sourceRightsState="BLOCKED_RIGHTS (no rights record); .env.example GDELT_ENABLED=true",
        sharedSearchBinding="ABSENT",
        citationState="ABSENT", continuityState="N/A", briefingState="ABSENT", followState="ABSENT", alertState="ABSENT",
        displayLocales=NO_LOC,
        blockers=[{"id": "P3-SIG-01", "priority": "P3", "summary": "Unbound substrate; decide retire vs bind", "evidence": "app.module.ts:127"}],
        evidence=["stage0/backend-modules.json#signals"],
        acceptance=dict(Data="ABSENT", Search="ABSENT", Ask="ABSENT", Citation="ABSENT", Continuity="N/A", Briefing="ABSENT", Follow="ABSENT", Alert="ABSENT", Mobile="N/A", Desktop="N/A", Rights="FAIL", Security="PASS"),
    ),
    cap(
        id="MY-INTELLIGENCE",
        name="My Intelligence workspace",
        surface=["/my-intelligence"],
        backendOwner=["my-intelligence", "follows", "ask-v2 (selection)"],
        frontendOwner=["components/my-intelligence"],
        alphaState="ASK_BOUND",
        alphaNote="selection actions run through Ask V2; redirected in Standalone",
        productionState="ABSENT",
        dataState="SavedStory, interests, follows; dev fixtures behind NEXT_PUBLIC_MI_DEV_FIXTURES",
        sourceRightsState="N/A",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS",
        continuityState="PARTIAL",
        briefingState="PARTIAL",
        followState="PARTIAL",
        alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[
            {"id": "P1-MI-01", "priority": "P1", "summary": "Public ?state= review switch on Alpha route; dev fixtures in import graph (env-gated)", "evidence": "app/my-intelligence/page.tsx:25-31; devFixtures.ts:30"},
            {"id": "P1-MI-02", "priority": "P1", "summary": "File collision between H and Humanitarian lanes", "evidence": "components/my-intelligence/MyIntelligenceClient.tsx"},
        ],
        evidence=["stage0/frontend-routes.json"],
        acceptance=dict(Data="PASS", Search="PARTIAL", Ask="UNVERIFIED", Citation="PASS", Continuity="PARTIAL", Briefing="PARTIAL", Follow="PARTIAL", Alert="ABSENT", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PARTIAL"),
    ),
    cap(
        id="SAVED",
        name="Saved (Ask results)",
        surface=["/saved"],
        backendOwner=["ask-v2 (bookmarks)"],
        frontendOwner=["components/ask-nav", "lib/ask"],
        alphaState="ALPHA_READY",
        productionState="ABSENT",
        dataState="StoredResult bookmarks",
        sourceRightsState="N/A", sharedSearchBinding="ASK_BOUND", citationState="PASS", continuityState="PASS",
        briefingState="PARTIAL", followState="N/A", alertState="N/A",
        displayLocales=CLAMP,
        evidence=["stage0/language.json Saved"],
        acceptance=dict(Data="PASS", Search="N/A", Ask="UNVERIFIED", Citation="PASS", Continuity="PASS", Briefing="PARTIAL", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="HISTORY-RECENT",
        name="History / Recent",
        surface=["/ask/recent", "/history (legacy)"],
        backendOwner=["ask-v2 (threads)", "history (SearchHistoryEntry — written only by legacy /analysis/news)"],
        frontendOwner=["components/ask-nav", "app/history"],
        alphaState="ALPHA_READY",
        alphaNote="/ask/recent ready; /history receives no new entries from Ask V2",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 /history (ref only)",
        dataState="AskThread (recent); SearchHistoryEntry stale",
        sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A", continuityState="PASS",
        briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=EN_PLPARTIAL,
        blockers=[{"id": "P1-HIST-01", "priority": "P1", "summary": "/history on Production allowlist but legacy, hard-coded English, links to /search which redirects", "evidence": "standaloneRouteGate.ts:30; history/page.tsx:50-79"}],
        evidence=["stage0/frontend-routes.json"],
        acceptance=dict(Data="PARTIAL", Search="N/A", Ask="N/A", Citation="N/A", Continuity="PASS", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="BRIEFINGS",
        name="Briefings",
        surface=["/saved/briefing"],
        backendOwner=["ask-v2 (briefings, ASK_BRIEFINGS_ENABLED)"],
        frontendOwner=["components/briefing"],
        alphaState="LOCAL_ONLY",
        alphaNote="flag ASK_BRIEFINGS_ENABLED absent by default; route not in Standalone allowlist",
        productionState="ABSENT",
        dataState="briefing snapshots",
        sourceRightsState="N/A", sharedSearchBinding="RETAINED_ONLY",
        citationState="FAIL (governed intelligence dropped; RETAINED_RECORD answers unbriefable)",
        continuityState="PARTIAL", briefingState="PARTIAL", followState="N/A", alertState="N/A",
        displayLocales=CLAMP,
        blockers=[{"id": "P1-BRF-01", "priority": "P1", "summary": "briefing-snapshot ignores payload.intelligence; governed answers lose provenance or are unbriefable", "evidence": "briefing-snapshot.ts:65-102"}],
        evidence=["stage0/search-binding.json R3"],
        acceptance=dict(Data="PARTIAL", Search="N/A", Ask="N/A", Citation="FAIL", Continuity="PARTIAL", Briefing="FAIL", Follow="N/A", Alert="N/A", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="FOLLOW",
        name="Follow an issue / country",
        surface=["platform Home", "/my-intelligence"],
        backendOwner=["follows"],
        frontendOwner=["lib/api (follows)"],
        alphaState="LOCAL_ONLY",
        alphaNote="countries only; no issue follow; not in Standalone",
        productionState="ABSENT",
        dataState="FollowedCountry",
        sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A", continuityState="N/A",
        briefingState="ABSENT", followState="PARTIAL", alertState="ABSENT",
        displayLocales=CLAMP,
        blockers=[{"id": "P2-FOL-01", "priority": "P2", "summary": "Follow is country-only; 'Follow an Issue' (paid core service) absent", "evidence": "stage0/backend-modules.json#follows"}],
        evidence=["stage0/backend-modules.json#follows"],
        acceptance=dict(Data="PARTIAL", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="ABSENT", Follow="PARTIAL", Alert="ABSENT", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="ALERTS-WATCH",
        name="Alerts / Watch",
        surface=["Home R1 alerts centre (flag)"],
        backendOwner=["stories (StoryAlert, ALERTS_IN_APP)", "watch (WATCH_RUNTIME_ACTIVE=false, no Nest module)"],
        frontendOwner=["components/home (AlertsCentre)"],
        alphaState="DESIGN_ONLY",
        alphaNote="in-app alert foundation behind ALERTS_IN_APP (default off); no push transport; Watch dormant",
        productionState="ABSENT",
        dataState="StoryAlert only",
        sourceRightsState="N/A", sharedSearchBinding="RETAINED_ONLY", citationState="N/A", continuityState="N/A",
        briefingState="N/A", followState="N/A", alertState="LOCAL_ONLY",
        displayLocales=CLAMP,
        blockers=[{"id": "P2-ALR-01", "priority": "P2", "summary": "No material-change detection, push/PWA transport or user controls; in-app ≠ phone alerts", "evidence": "stage0/backend-modules.json#watch,#stories"}],
        evidence=["stage0/backend-modules.json"],
        acceptance=dict(Data="PARTIAL", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="PARTIAL", Mobile="ABSENT", Desktop="UNVERIFIED", Rights="N/A", Security="UNVERIFIED"),
    ),
    cap(
        id="DISCUSSIONS",
        name="Discussions / comments",
        surface=["Home R1 DiscussionPanel (flag)"],
        backendOwner=["stories (DISCUSSION_READ/WRITE)"],
        frontendOwner=["components/home (DiscussionPanel)"],
        alphaState="LOCAL_ONLY",
        alphaNote="DISCUSSION_READ/WRITE absent by default; docker-compose passes neither",
        productionState="ABSENT",
        dataState="story discussion tables; excluded from Ask by design (proven)",
        sourceRightsState="N/A", sharedSearchBinding="RETAINED_ONLY", citationState="N/A", continuityState="N/A",
        briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=CLAMP,
        blockers=[{"id": "P2-DIS-01", "priority": "P2", "summary": "Moderation/ownership/privacy/mobile flow not provable while flags off", "evidence": "stage0/backend-notes flags"}],
        evidence=["stories.structure.spec.ts"],
        acceptance=dict(Data="PARTIAL", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="UNVERIFIED", Desktop="UNVERIFIED", Rights="N/A", Security="UNVERIFIED"),
    ),
    cap(
        id="ACCOUNT-AUTH",
        name="Account, sign-in, settings",
        surface=["/account/settings"],
        backendOwner=["auth", "users"],
        frontendOwner=["components/account", "components/auth"],
        alphaState="ALPHA_READY",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 /account/settings (ref only)",
        dataState="User, sessions (Google OAuth)",
        sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A", continuityState="N/A",
        briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=EN_PLPARTIAL,
        blockers=[{"id": "P1-ACC-01", "priority": "P1", "summary": "platform-mode settings hard-code language='en'", "evidence": "account/settings/page.tsx:27"}],
        evidence=["stage0/language.json Account/Settings"],
        acceptance=dict(Data="PASS", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="SUPPORT",
        name="Support / Help & feedback",
        surface=["/support"],
        backendOwner=["support (SUPPORT_AI_ENABLED false)"],
        frontendOwner=["components/support"],
        alphaState="ALPHA_READY",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 /support (ref only)",
        dataState="support tickets", sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A",
        continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=CLAMP,
        blockers=[{"id": "P1-LANG-06", "priority": "P1", "summary": "Stale 'English and Polish only' copy live in support", "evidence": "supportEn.ts:304; supportPl.ts:216"}],
        evidence=["stage0/language.json Support"],
        acceptance=dict(Data="PASS", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="LEGAL",
        name="Privacy, Cookies, Terms, Source policy, Third-party notices",
        surface=["/privacy", "/cookies", "/terms", "/source-policy", "/third-party-notices"],
        backendOwner=[], frontendOwner=["app/(legal pages)"],
        alphaState="ALPHA_READY",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 has /privacy /terms /source-policy (no /cookies)",
        dataState="static", sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A",
        continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=CLAMP,
        blockers=[
            {"id": "P1-LEG-01", "priority": "P1", "summary": "NavBar on legal pages links to /search and /my-intelligence which redirect in Production", "evidence": "NavBar.tsx:223,353; AccountControl.tsx:258"},
            {"id": "P2-THEME-01", "priority": "P2", "summary": "/terms /source-policy /third-party-notices dark-only", "evidence": "stage0/frontend-routes.json"},
        ],
        evidence=["stage0/frontend-routes.json"],
        acceptance=dict(Data="N/A", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="PASS", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="CONSENT",
        name="Pre-login consent / cookie / data-handling notice",
        surface=[], backendOwner=[], frontendOwner=[],
        alphaState="ABSENT", productionState="ABSENT",
        dataState="none", sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A",
        continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=NO_LOC,
        blockers=[{"id": "P1-PRIV-01", "priority": "P1", "summary": "No consent/cookie notice component exists; guest trial and pre-login flows have no notice (contract Part X)", "evidence": "stage0/language.json Consent"}],
        evidence=["stage0/language.json"],
        acceptance=dict(Data="N/A", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="ABSENT", Desktop="ABSENT", Rights="N/A", Security="FAIL"),
    ),
    cap(
        id="THEME",
        name="Light/Dark theme system",
        surface=["all routes"], backendOwner=[], frontendOwner=["app/globals.css", "domain token files"],
        alphaState="LOCAL_ONLY",
        alphaNote="tokens exist; every Alpha dashboard dark-only with hex-colour token files",
        productionState="ABSENT",
        dataState="N/A", sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A",
        continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=L("N/A", "N/A", "N/A"),
        blockers=[{"id": "P2-THEME-02", "priority": "P2", "summary": "Light theme not available on dashboards (hex palettes: humTokens 24, MI workspace 64-72)", "evidence": "stage0/frontend-routes.json theme; hexsummary"}],
        evidence=["stage0/frontend-routes.json"],
        acceptance=dict(Data="N/A", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="PARTIAL", Desktop="PARTIAL", Rights="N/A", Security="N/A"),
    ),
    cap(
        id="PREVIEW-ROUTES",
        name="Preview / fixture route containment",
        surface=["/{delivery,economy,election,politics,security}-visual-preview (+compact)", "/workspace", "orphan compacts"],
        backendOwner=[], frontendOwner=["app/*-visual-preview", "app/workspace"],
        alphaState="PREVIEW_ONLY",
        alphaNote="10 preview routes public without auth on platform Alpha (noindex only); /workspace fake page",
        productionState="ABSENT",
        productionNote="Standalone allowlist excludes them at 5513275f; c908 serves /workspace",
        dataState="design fixtures (none reachable as evidence)", sourceRightsState="N/A", sharedSearchBinding="N/A",
        citationState="N/A", continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=CLAMP,
        blockers=[
            {"id": "P1-PRV-01", "priority": "P1", "summary": "Preview routes linked from Alpha Home/My Intelligence and public", "evidence": "lib/intelligenceModules.ts:203,284,305; homeRevaModel.ts:101; miWorkspaceModel.ts:53-68"},
            {"id": "P2-PRV-02", "priority": "P2", "summary": "/workspace fake page served by c908 Production", "evidence": "workspace/page.tsx:273-285"},
        ],
        evidence=["stage0/frontend-routes.json"],
        acceptance=dict(Data="N/A", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="N/A", Desktop="N/A", Rights="N/A", Security="FAIL"),
    ),
    cap(
        id="NEWS-SOURCES",
        name="News retrieval + source coverage (local vs international)",
        surface=["all evidence answers"],
        backendOwner=["news", "global-reach (admin only)", "official-sources"],
        frontendOwner=[],
        alphaState="COVERAGE_GAP",
        productionState="PRODUCTION_LIVE",
        productionNote="GNews in c908 (ref only)",
        dataState="1 active source (GNews) of 348 records; 0 active+rights-cleared local in 54 priority countries",
        sourceRightsState="BLOCKED_RIGHTS",
        sharedSearchBinding="ASK_BOUND",
        citationState="PASS", continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=L("N/A", "N/A", "N/A"),
        sourceLanguages=["en", "fr", "es", "ar", "pl"],
        blockers=[
            {"id": "P0-SRC-01", "priority": "P0", "summary": "GNews (no rights record) is the only active source and silently substitutes for local coverage in all 54 priority countries; no COVERAGE_GAP disclosure", "evidence": "news.module.ts:71; stage0/source-coverage.json"},
            {"id": "P1-SRC-02", "priority": "P1", "summary": "RSS activation bypasses rights (Standard Media RESTRICTED activatable by env)", "evidence": "feed-source-registry.ts:213-241"},
            {"id": "P1-SRC-03", "priority": "P1", "summary": "Placeholder API keys count as configured", "evidence": "provider.tokens.ts:59-61; .env.example:209"},
            {"id": "P2-SRC-04", "priority": "P2", "summary": "Retrieval authority defects D1–D7", "evidence": "docs/retrieval-source-authority-audit-r1.md (branch claude/retrieval-source-authority-audit-r1)"},
        ],
        evidence=["stage0/sources.json", "stage0/source-coverage.json"],
        acceptance=dict(Data="PARTIAL", Search="PASS", Ask="PASS", Citation="PASS", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="N/A", Desktop="N/A", Rights="FAIL", Security="PARTIAL"),
    ),
    cap(
        id="TELEMETRY-ADMIN",
        name="Admin + analytics",
        surface=["/admin/** (22 pages)"],
        backendOwner=["admin (ADMIN_PLATFORM_ENABLED)", "telemetry"],
        frontendOwner=["components/admin", "lib/admin"],
        alphaState="LOCAL_ONLY",
        productionState="PRODUCTION_LIVE",
        productionNote="c908 admin pages (ref only)",
        dataState="AnalysisRun only for /analysis/news; Ask V2 traffic invisible", sourceRightsState="N/A",
        sharedSearchBinding="N/A", citationState="N/A", continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=L("FULL", "FULL", "EN_FALLBACK"),
        blockers=[{"id": "P1-OBS-01", "priority": "P1", "summary": "Telemetry interceptor records only /analysis/news; admin analytics blind to Ask V2", "evidence": "telemetry.interceptor.ts:31,40; admin-analytics.service.ts:238"}],
        evidence=["stage0/backend-modules.json#telemetry"],
        acceptance=dict(Data="PARTIAL", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="N/A", Desktop="PASS", Rights="N/A", Security="PASS"),
    ),
    cap(
        id="PAID",
        name="Paid product (Sand ledger / charging)",
        surface=[], backendOwner=["ask-v2 (SAND_LEDGER_ENABLED false; SAND_CHARGING_ENABLED literal false)"], frontendOwner=[],
        alphaState="DESIGN_ONLY", productionState="ABSENT",
        dataState="none", sourceRightsState="N/A", sharedSearchBinding="N/A", citationState="N/A",
        continuityState="N/A", briefingState="N/A", followState="N/A", alertState="N/A",
        displayLocales=NO_LOC,
        blockers=[{"id": "P3-PAID-01", "priority": "P3", "summary": "Paid boundary (persistence, monitoring, briefings, alerts) undefined in code; charging hard-off by design", "evidence": "ask-compute.contract.ts:4"}],
        evidence=["stage0/backend-notes flags"],
        acceptance=dict(Data="N/A", Search="N/A", Ask="N/A", Citation="N/A", Continuity="N/A", Briefing="N/A", Follow="N/A", Alert="N/A", Mobile="N/A", Desktop="N/A", Rights="N/A", Security="N/A"),
    ),
]


# ════════════════════════════════════════════════════════════════════════════
# STAGE 2 RUNTIME CORRECTION (CTO contract R2, 2026-10-04) — applied on top of the Stage 0 cells.
#
# Railway runtime authority supplied by the CTO (wins over any Git-derived inference):
#   Alpha backend  5513275ff731936a07c01e937b92c263ba6d6cf9  SUCCESS
#   Alpha frontend 5513275ff731936a07c01e937b92c263ba6d6cf9  SUCCESS
#   Production backend  5b714833f2a036557a022a55c646fdb101ec596e  SUCCESS
#   Production frontend 58f80fd4108d3472e5433c7a50e19295788f2544  SUCCESS
# Observed Alpha facts: GNA_PUBLIC_ROOT configured (live root = platform Home); Ask V2 active
# (signed-in R4 Ask operations execute); guest trial deliberately OFF during controlled acceptance
# (NOT a defect). Production flag values are NOT inferred (Production HOLD).
#
# Production code measured at the two Production SHAs: Ask V2, route gate, ask-intelligence and every
# module except `stories` (Discussions/Alerts) and `data-retention` are present; frontend lacks
# /cookies and /saved/briefing; backend has no briefings; Ask locale EN/PL only (no askSevenStrings).
# A capability whose code is present at the Production SHAs but whose runtime flags are unmeasured is
# recorded as UNVERIFIED_RUNTIME (a documented Production-only extension of the maturity vocabulary;
# never counted as live).
# ════════════════════════════════════════════════════════════════════════════

RUNTIME = {
    "source": "CTO-verified Railway state, contract GLOBALNEWSAI_CLOUD_STAGE2_BUILD_CONTRACT_R2 (2026-10-04)",
    "alpha": {"backend": "5513275ff731936a07c01e937b92c263ba6d6cf9", "frontend": "5513275ff731936a07c01e937b92c263ba6d6cf9",
              "GNA_PUBLIC_ROOT": "platform (configured; live root is platform Home)",
              "askV2": "active (signed-in Ask operations execute)",
              "guestTrial": "OFF by design during controlled acceptance"},
    "production": {"backend": "5b714833f2a036557a022a55c646fdb101ec596e", "frontend": "58f80fd4108d3472e5433c7a50e19295788f2544",
                   "flags": "not measured — HOLD"},
    "handoffs": {
        "R4 semantic baseline": "handoff/r4-semantic-baseline-5699eb7 @ 5699eb7058b3d20026c62bcffd75f97b7ca846ec",
        "H final (Ask reading/localization, incl. Claude L delivery)": "handoff/r4-h-answer-reading-5699eb7 @ 266007c930e8293638bc7971670ee0264923c18c",
        "Politics immutable base": "specialist/politics-r1-integration-d920893 @ d9208933c6ec758756b3b1019d8d01aa1f7592d1",
        "R4 final replacement": "does not exist yet",
    },
}
PROD_REF = {"branch": "Railway Production (backend 5b714833 / frontend 58f80fd4)", "sha": "5b714833 / 58f80fd4"}

_by_id = {c["id"]: c for c in CAPABILITIES}

# Production: code present at the Production SHAs but runtime flags unmeasured → UNVERIFIED_RUNTIME.
_PROD_PRESENT = ["ASK-CORE", "ASK-SEARCH", "ASK-LEGACY", "CONVERSATION", "HOME", "MAP-COUNTRY", "CONFLICT", "SECURITY",
                 "POLITICS", "ECONOMY", "MARKET", "ENERGY", "ELECTION", "HUMANITARIAN", "IMIHIGO", "MY-INTELLIGENCE",
                 "SAVED", "HISTORY-RECENT", "FOLLOW", "ACCOUNT-AUTH", "SUPPORT", "LEGAL", "PREVIEW-ROUTES",
                 "NEWS-SOURCES", "TELEMETRY-ADMIN", "THEME"]
for _id in _PROD_PRESENT:
    _by_id[_id]["productionState"] = "UNVERIFIED_RUNTIME"
    _by_id[_id]["productionNote"] = "code present at Production SHAs 5b714833/58f80fd4; runtime flags not measured (HOLD)"
_by_id["LANG-SYSTEM"]["productionState"] = "COVERAGE_GAP"
_by_id["LANG-SYSTEM"]["productionNote"] = "Production frontend 58f80fd4: ACTIVE_LANGUAGES en/pl; no seven-locale Ask catalogue"
for _id, _note in [("BRIEFINGS", "no briefings in Production backend 5b714833; /saved/briefing absent in 58f80fd4"),
                   ("DISCUSSIONS", "`stories` module absent in Production backend 5b714833"),
                   ("ALERTS-WATCH", "`stories` module absent in Production backend 5b714833; Watch dormant"),
                   ("CONSENT", "no consent notice component at 58f80fd4"),
                   ("SIGNALS", "unbound substrate"), ("PAID", "charging hard-off")]:
    _by_id[_id]["productionState"] = "ABSENT"
    _by_id[_id]["productionNote"] = _note
_by_id["LEGAL"]["productionNote"] = "code present at 58f80fd4 except /cookies; runtime flags not measured (HOLD)"
_by_id["ASK-LEGACY"]["productionNote"] = "legacy route still served by Production backend 5b714833 (frontend callers: see T4 caller graph)"

# Alpha: verified live at 5513275f with platform root + Ask V2 active → reachable, Ask-bound capabilities are ALPHA_LIVE.
for _id in ["ASK-CORE", "ASK-SEARCH", "CONVERSATION", "HOME", "MAP-COUNTRY", "CONFLICT", "MARKET", "IMIHIGO",
            "MY-INTELLIGENCE", "SAVED", "HISTORY-RECENT", "ACCOUNT-AUTH", "SUPPORT", "LEGAL"]:
    _by_id[_id]["alphaState"] = "ALPHA_LIVE"
    _by_id[_id]["alphaNote"] = "runtime-verified: Alpha 5513275f, platform root, Ask V2 active (CTO Railway authority)"
_by_id["ASK-CORE"]["alphaNote"] += "; guest trial OFF by design (not a defect)"
_by_id["HOME"]["alphaNote"] += "; Home R1 discussion/alert flags still unmeasured"

# UNVERIFIED cells that the runtime facts now resolve (Ask execution on Alpha).
for _id in ["ASK-CORE", "ASK-SEARCH", "HOME", "MAP-COUNTRY", "MY-INTELLIGENCE", "SAVED"]:
    if _by_id[_id]["acceptance"]["Ask"] == "UNVERIFIED":
        _by_id[_id]["acceptance"]["Ask"] = "PASS"

# The Ask-V2-enabled-flag blocker is resolved for Alpha by runtime authority.
_by_id["ASK-CORE"]["blockers"] = [b for b in _by_id["ASK-CORE"]["blockers"] if b["id"] != "P1-ASK-02"]

# H final 266007c delivers the seven-locale Ask shell (Claude L: zero unqualified Ask-shell keys) — available in the
# handoff, NOT yet on Alpha. Record without changing the Alpha locale cells.
_by_id["ASK-CORE"]["handoffNote"] = ("H final 266007c: Ask shell complete in all seven display locales (not yet deployed; "
                                     "integrates with final R4). Not a system-wide language completion claim.")
for _b in _by_id["ASK-CORE"]["blockers"]:
    if _b["id"] == "P1-ASK-03":
        _b["summary"] = ("FR/DE/ES/PT/AR Ask chrome partly English on Alpha 5513275f; resolved in H final 266007c "
                         "(pending final R4 integration)")

# Public-Beta Production P0 (contract R2): pre-login privacy/data/cookie notice + guest-trial boundary not proven.
_by_id["CONSENT"]["blockers"] = [{
    "id": "P0-PRIV-01", "priority": "P0",
    "summary": "Public-Beta Production P0: pre-login privacy/data/cookie notice and guest-trial boundary (≥3 questions before login, truthful guest session) not proven",
    "evidence": "no consent component at 5513275f or 58f80fd4; contract R2 T5; Alpha guest OFF is intentional"}]


# ════════════════════════════════════════════════════════════════════════════
# STAGE 2 TRANCHE DELIVERIES (branches, NOT deployed — Alpha cells stay measured at 5513275f)
# ════════════════════════════════════════════════════════════════════════════
STAGE2_BRANCHES = {
    "T1 coverage truthfulness": "claude/stage2-t1-coverage-truthfulness @ 8333551e (base 5513275f)",
    "T2 global language foundation": "claude/stage2-t2-global-language-foundation (base 266007c)",
    "T3 contributor-selection spec": "claude/stage2-t3-contributor-selection-spec @ 424491a9 (base 5513275f; spec + unapplied patch)",
    "T4 legacy Ask convergence": "claude/stage2-t4-legacy-ask-convergence @ 5a28e269 (base 5513275f)",
    "T5 consent + guest trial (part A)": "claude/stage2-t5-consent-guest-trial @ ef0e8b95 (base 5513275f)",
}
for _id, _note in [
    ("NEWS-SOURCES", "T1 branch 8333551e: canonical coverage state (54/54 COVERAGE_GAP), LOCAL/INTERNATIONAL locality, reader disclosure (map), RSS rights gate, placeholder-key rejection — pending CTO integration"),
    ("ASK-CORE", "T3 branch 424491a9: defect reproduced identically at 5513275f/5699eb7/266007c; first wrong step contributor-selection.ts:227; patch verified, applies after final R4"),
    ("CONFLICT", "T3 branch 424491a9: see ASK-CORE"),
    ("ASK-LEGACY", "T4 branch 5a28e269: 22 callers classified; 0 live frontend callers at Alpha and Production; PII-free legacy-use telemetry + admin readout"),
    ("TELEMETRY-ADMIN", "T4 branch 5a28e269: GET /admin/analytics/legacy-usage (process-scoped)"),
    ("CONSENT", "T5 part A branch ef0e8b95: guest trial = 3 completed answers per guest session; isolation I1–I9 proven on Postgres; consent design (no banner needed: no optional storage)"),
]:
    _by_id[_id]["stage2Branch"] = _note

_by_id["CONSENT"]["blockers"] += [
    {"id": "P1-PRIV-03", "priority": "P1",
     "summary": "Privacy page retention claims (limit identifiers ~1 week, usage 90 days, conversations 12 months) hold only when RETENTION_SWEEP_ENABLED=true (default off); privacy/cookies/guest copy en/pl only",
     "evidence": "stage2/T5-CONSENT-GUEST-TRIAL.md; RETENTION_SWEEP_ENABLED default"},
    {"id": "P1-PRIV-04", "priority": "P1",
     "summary": "Guest claim moves ALL guest conversations (copy says 'keep this conversation'); plain sign-in leaves guest data visible on shared device; no immediate guest-data deletion; no /cookies footer link",
     "evidence": "stage2/T5-CONSENT-GUEST-TRIAL.md patches P-1..P-5"},
    {"id": "P2-PRIV-05", "priority": "P2",
     "summary": "Production backend 5b714833 stores raw IPv4 (and /64 IPv6) in guest/compute limit scopes with no deletion; Alpha uses a keyed daily pseudonym — fixed at next promotion; live only if Production guest flags are on (unmeasured)",
     "evidence": "5b714833:backend/src/modules/compute-controls/compute-scopes.ts:43-51 vs 5513275f:…:44-47"},
]

STAGE2_BRANCHES["T2 global language foundation"] = "claude/stage2-t2-global-language-foundation @ c3754bdd (base 266007c H final)"
_by_id["LANG-SYSTEM"]["stage2Branch"] = (
    "T2 branch c3754bdd (on H final 266007c): one DisplayLocale authority; stored choice never overwritten; root <html lang>/<dir> "
    "from the EFFECTIVE rendered locale (ar=rtl); every route migrated off the en/pl clamp; non-complete surfaces render a DECLARED "
    "English fallback with a localized notice (no silent English). Seven locales render fully only on Ask surfaces; recovered C55 "
    "catalogues: 0 kept (source English unprovable), 3525 keys/locale handed to Claude L; nothing machine-translated. "
    "Integration after final R4; needs H to apply SPEC-T2-H-3 (H spec asserts no root dir) and Humanitarian SPEC-T2-HUM-1/2.")

STAGE2_BRANCHES["T5 consent UI (part B)"] = "claude/stage2-t5b-consent-ui @ 72ce054c (base T2 c3754bdd + T5A)"
_by_id["CONSENT"]["stage2Branch"] += (
    "; T5 part B branch 72ce054c (on T2): GET /ask-v2/guest/status policy fields, POST /ask-v2/guest/forget (own session only, "
    "CSRF-bound, claimed data never deleted), guest-data section + delete control on /privacy and /cookies, footer /cookies link, "
    "truthful retention wording — all legal copy PENDING_PO_LEGAL_APPROVAL; fr–ar via T2 declared fallback")
for _b in _by_id["CONSENT"]["blockers"]:
    if _b["id"] == "P1-PRIV-04":
        _b["summary"] += " (fixed on T5B branch for non-protected surfaces; Ask composer mounts P-1/P-4/P-5 await H)"
