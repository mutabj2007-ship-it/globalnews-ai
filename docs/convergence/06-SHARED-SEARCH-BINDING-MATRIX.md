# 06 — Shared Search & Ask Binding Matrix

Authority `5513275f`. Raw records: `stage0/search-binding.json` (14 domains, with all 8 contract answers per domain).

**Method:** code inspection, 98 existing tests re-run (all green), and a probe of 21 questions run through the real `routeAskR2` + `selectContributors`.

## One engine? — Not yet

| Surface | Engine |
|---|---|
| Home | `Hero.tsx:322` → `/search` → Ask V2 |
| Ask dock | `AskAiDock.tsx:300` (`useAskR2Conversation`) → Ask V2 |
| `/ask` | `AskFrameScreen.tsx:158` → Ask V2 (plus guest trial) |
| `/search` | `SearchPageClient.tsx:246` → Ask V2 |
| My Intelligence selection | `{kind: SELECTION}` → `ask-context.resolver.ts:123` → adapter `executeSelection` → Ask V2 |
| **`POST /analysis/news`** | **still public**, no live frontend caller, bypasses `routeAskR2` and the governed reads → **second engine** (P1-ASK-05). It is still the engine of the c908 Production ref, so it can only be retired once Production moves to Ask V2. |

- **Routing authority:** `routeAskR2` / `SemanticTurnIR`, for Ask V2 only.
- **Gates:** `ASK_V2_ENABLED` + `ASK_R2_ENABLED` + `ASK_PUBLIC_COMPUTE_ENABLED`. Alpha values are UNVERIFIED.

## Domain binding

| Domain | Canonical store | Searchable projection | Shared Ask retrieval | State | Negative controls |
|---|---|---|---|---|---|
| News / retained articles | `Article` (Postgres) + GNews live | ILIKE term net on title/summary | adapter `:1092` → `AnalysisService.analyzeNews` | **ASK_BOUND** | PARTIAL: economy domain-gated; weather and politics UNPROVEN (`focused-domain-evidence.spec.ts` "other domains are not gated") |
| Conflict | `ConflictObservation` (UCDP) | governed specialist read | coordinator `readConflict` `:341` | **ASK_BOUND** | **FAIL**: see R1 below |
| Security | `SecurityObservation` | none | — (served through Conflict) | RETAINED_ONLY | N/A |
| Economy | NISR CPI retained (RWA); Eurostat producer unbound | governed `readCpi` | coordinator | **ASK_BOUND** (RWA CPI only) | PROVEN for "CPI for another country → NO_MATCH" (`ask-intelligence.spec.ts`, `governed-answer.spec.ts`) |
| Market | TED notices retained; Comext `MarketObservation` unbound | `readProcurement` | coordinator `:369` | **ASK_BOUND** | PROVEN ("notices for another country are NO_MATCH"); false NO_MATCH defect R5 |
| Energy | Eurostat `nrg_cb_pem` retained | none | — | RETAINED_ONLY | N/A; energy questions select **Conflict** instead |
| Official data | NISR CPI, Imihigo, Eurostat | governed reads (NISR) | coordinator | **ASK_BOUND** (NISR); Eurostat RETAINED_ONLY | PROVEN (Gasabo does not inherit the Kigali aggregate) |
| Politics | observation ledger `[]` (lane adds a store) | none | — | RETAINED_ONLY | UNPROVEN |
| Election | IEBC bundle file (reader flag off) | none | — | RETAINED_ONLY | N/A |
| Humanitarian | none (constant NOT_ASSESSED) | none | coordinator `:327` returns NOT_ASSESSED | ABSENT | PROVEN by absence (G5: NOT_ASSESSED is never support) |
| Signals | none (live-only) | none | — | ABSENT | N/A |
| My Intelligence | `SavedStory`, interests, follows | explicit selection only | `resolveSelection` | **ASK_BOUND** (selection); `SavedStory` text RETAINED_ONLY | N/A |
| Watch / alerts | `StoryAlert`; Watch dormant | none | — | ABSENT / RETAINED_ONLY | N/A |
| Briefings | briefing snapshot (Ask output sink) | n/a | n/a | RETAINED_ONLY | N/A, **drops governed intelligence** (R3) |
| Discussions | story discussion tables | excluded by design | — | RETAINED_ONLY | PROVEN excluded (`stories.structure.spec.ts`) |

## Contract negative controls (Part IV) — measured

| Control | Result | Evidence |
|---|---|---|
| Matching country must not imply matching domain | **FAIL** | "What is the political/energy/economic situation in Poland?" → CONFLICT/POL (probe) |
| Politics data must not answer weather | **UNPROVEN** | no politics store bound; news path not politics-gated; "weather in Poland/Kenya" selected no specialist (probe) |
| Economy data must not answer unrelated politics | **PROVEN** (governed CPI) / PARTIAL (news) | `governed-answer.spec.ts` negative controls; `analysis.country-economy-policy-r2.spec.ts` |
| Conflict data must not answer general travel | **FAIL** | "What is the travel situation in Kenya?" → CONFLICT/KEN; "visa situation for travelling to Ukraine" → CONFLICT/UKR (probe; no test) |
| Humanitarian must not answer generic country background | **PROVEN by absence** | humanitarian returns NOT_ASSESSED; becomes real once the Humanitarian lane binds data |

## Red findings

| ID | Finding | Evidence | Priority |
|---|---|---|---|
| R1 | Conflict over-selection: any typed country plus the bare term "situation"/"sytuacja" (or a security substring) injects up to 10 UCDP records as specialist evidence. Hits travel, visa, political, energy and economic questions. | `ask-intelligence/contributor-selection.ts:29-45,224-236`; `coordinator.ts:341` | **P0-ASK-01** |
| R2 | Two live engines (`/analysis/news` public). | `analysis.controller.ts:66` | P1-ASK-05 |
| R3 | Briefing snapshot ignores `payload.intelligence`; RETAINED_RECORD answers are unbriefable. | `briefing-snapshot.ts:65-102` | P1-BRF-01 |
| R4 | Prior-reference resolver unwired. Continuity carries only the prior user question (plus background artifacts), never prior evidence or citations. "Still true now?" re-retrieves without re-verifying. | `prior-reference.ts:282`; `user-job.ts:649-660,682`; `ask-v2.service.ts:195` | P1-CONV-01/02 |
| R5 | Procurement read takes the newest 20 notices *before* the country filter, giving false NO_MATCH. | `ask-specialist-read.coordinator.ts:369-375` | P1-MKT-01 |
| R6 | Retained stores unreachable from shared Ask: politics, election, energy, Eurostat economy, Comext, SecurityObservation, humanitarian, signals, watch, SavedStory text. | `stage0/search-binding.json` | P1 (per module) |
| R7 | Retrieval does not represent source authority (D1–D7). | `docs/retrieval-source-authority-audit-r1.md` on branch `claude/retrieval-source-authority-audit-r1` | P2-SRC-04 |

## Binding target per evidence-bearing module (Stage 3)

Every module answers the 8 questions through **one** path:

retained store → governed read (rights-checked) → `selectContributors` (domain-scoped by SemanticTurnIR facets, **never** by country plus a generic word) → coordinator → governed prompt with evidenceId citations → no-evidence = honest NOT_ASSESSED/NO_MATCH.

New domains are added as *contributors*, never as engines.
