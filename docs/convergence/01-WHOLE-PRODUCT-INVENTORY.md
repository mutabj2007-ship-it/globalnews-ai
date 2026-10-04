# 01 — Whole-Product Inventory (Stage 0)

> **Stage 2 runtime correction (2026-10-04, CTO contract R2).** Railway runtime authority replaces the Git-derived Production assumption below:
> - **Alpha:** backend and frontend at `5513275f` (SUCCESS); live root is platform Home (`GNA_PUBLIC_ROOT` configured); Ask V2 active for signed-in users; guest trial **OFF by design** during controlled acceptance (not a defect).
> - **Production:** backend `5b714833`, frontend `58f80fd4` (SUCCESS). Strict ancestors of Alpha, 85 and 84 commits behind. Not `release/production-c908`.
> - **Production flags are not inferred; Production stays HOLD.**
>
> Registries (02, 09, 10, `status.json`) are regenerated with these facts. See `stage2/STAGE2-REPORT.md`.

| | |
|---|---|
| Programme | GlobalNewsAI Whole-Product Convergence & Seven-Language System R1 |
| Stage | **0 — Measure** (no product code changed) |
| Measurement authority | `release/alpha-r4-search-conversation-5513275` @ `5513275f` (newest Alpha release; contains Production c908, m08, the home/discussions/alerts candidate and trust-r3) |
| Production runtime (Railway) | backend `5b714833`, frontend `58f80fd4` (strict ancestors; 85 / 84 commits behind Alpha). Stage 0 wrongly assumed `release/production-c908` @ `a9cf8a89`. |
| `origin/main` | `5149276f` (2026-08-17), stale; not an ancestor of the Alpha line |
| Convergence branch | `claude/whole-product-convergence-r1` (from `5513275f`; `docs/convergence/` only) |
| Measured | 2026-10-04 |
| Posture | Alpha = proving ground · **Production = HOLD** |

## Answers to the contract's ten questions (Purpose 1–10)

1. **What capabilities exist?** The registry tracks 33 capabilities (`02-GLOBAL-CAPABILITY-REGISTRY.json`).
   - Backend: 37 module directories, 21 with live controllers, 12 unbound substrate, 11 dormant.
   - Frontend: 57 pages.
2. **Which are live in Alpha?** UNVERIFIED for every flag-dependent capability.
   - The Alpha host is not reachable from the measuring container.
   - In code, the capabilities that would be live with `GNA_PUBLIC_ROOT=platform` and the Ask V2 flags on are those marked ASK_BOUND or ALPHA_READY in 02.
   - No capability is marked ALPHA_LIVE, because no deployment was observed.
3. **Which are local, preview, retained-only or unbound?**
   - PREVIEW_ONLY: Politics, Security, Election, plus 10 preview routes.
   - RETAINED_ONLY: Energy.
   - LOCAL_ONLY (behind default-off flags): Briefings, Follow, Discussions.
   - DESIGN_ONLY: Alerts/Watch and the paid layer.
   - ABSENT: Signals and the consent notice.
4. **Searchable through shared Ask?**
   - ASK_BOUND: News, Conflict, Economy (Rwanda CPI only), Market (TED), Imihigo, and My Intelligence selection.
   - Not bound: Politics, Election, Energy, Security, Humanitarian, Signals, Watch, SavedStory text (06).
5. **Which surfaces work in all seven locales?** **None.**
   - Only en/pl render the whole shell.
   - The Ask frame is partial for fr/de/es/pt/ar. Everything else falls back silently to English (03).
6. **Source-only languages:** sw and rw are retrieval-only, using the English search strategy. They remain in UI-facing language tables, so display and source languages are conflated in the type layer (03).
7. **Which modules have real evidence, rights-cleared sources, citations, continuity, briefing, follow and alerts?** None has all seven.
   - Real retained evidence with rights clearance: Conflict (UCDP Candidate) and Market (TED).
   - Real data with **unresolved** rights: Economy (NISR CPI), Imihigo and Election (IEBC).
   - Briefing drops governed evidence for all of them. Follow is country-only. Alerts are not built.
8. **Alpha-ready?** At most AMBER after the P0s close.
   - Today the matrix reads **0 GREEN · 1 AMBER (Theme) · 32 RED** (09, `status.json`).
9. **Production-ready?** None.
   - Production (`5b714833` / `58f80fd4`) ships Ask V2, the route gate and the intelligence modules, but not Discussions/Alerts (`stories`), briefings, `/cookies` or the seven-locale Ask catalogue. Its runtime flags are unmeasured (HOLD).
10. **What remains red?**
    - 153 FAIL, 77 ABSENT and 31 UNVERIFIED cells.
    - Blockers: 5 P0, 30 P1, 11 P2, 2 P3 (10).

## The five P0 product blockers

| ID | What the reader experiences | Evidence |
|---|---|---|
| P0-LANG-01 | Picks Français, Deutsch, Español, Português or العربية; every page outside the Ask answer stays English, `<html lang="en">`. | `lib/i18n/languages.ts:21,91,159`; `app/layout.tsx:259,273` |
| P0-LANG-02 | Picks a non-EN/PL language on a Polish browser; it silently becomes Polish. | `LanguageSync.tsx:52-58`; `Hero.tsx:264-269` |
| P0-LANG-03 | Arabic: only the answer frame is RTL; nav, dock, Saved, Recent, Settings and modules stay LTR. | `AskFrameScreen.tsx:431-432` |
| P0-ASK-01 | Asks "What is the travel / political / energy situation in Kenya or Poland?" and gets armed-conflict (UCDP) records as specialist evidence. | `ask-intelligence/contributor-selection.ts:29-45,224-236` |
| P0-SRC-01 | Every country answer comes from one international aggregator (GNews, no rights record). No country has an active local source, and nothing tells the reader. | `news/news.module.ts:71`; `08` |

## Measurement inventory

| Output | Contents | Source of numbers |
|---|---|---|
| `02-GLOBAL-CAPABILITY-REGISTRY.json/.md` | 33 capabilities × every contract field | `tools/capabilities.source.py` (evidence per cell) |
| `03-LANGUAGE-CAPABILITY-MATRIX.md` | locale systems, key coverage, surface × locale, backend path | `stage0/language.json` |
| `04-FRONTEND-ROUTE-REGISTRY.md` | 71 route records | `stage0/frontend-routes.json` |
| `05-BACKEND-MODULE-REGISTRY.md` | 44 module records, flags | `stage0/backend-modules.json` |
| `06-SHARED-SEARCH-BINDING-MATRIX.md` | 14 domains × 8 questions, negative controls | `stage0/search-binding.json` |
| `07-SOURCE-ADMISSION-REGISTRY.json` | 348 source records | `stage0/sources.json` |
| `08-SOURCE-COVERAGE-MATRIX.md` | 54 priority countries | `stage0/source-coverage.json` |
| `09-ALPHA-ACCEPTANCE-MATRIX.md` | 33 rows × 21 measured columns + 7-locale journey | 02 |
| `10`–`13` | blockers, roadmap, decisions, rollback | 02, `stage0/workstreams.json` |
| `stage0/test-baseline.json` | builds and full suites at `5513275f` | jest JSON |
| `status.json` | finish-line roll-up | `tools/render.py` |

## Build and test baseline at `5513275f`

| Check | Result |
|---|---|
| shared build · backend build · frontend build | PASS · PASS · PASS |
| shared tests | 528 / 528 pass (14 suites) |
| backend tests | 11,868 total · 11,385 pass · **33 fail** (10 suites) · 450 skipped |
| frontend tests | 8,293 total · 8,259 pass · **21 fail** (13 suites) · 13 skipped |

Failing areas:

- **Backend:** analysis (3 suites), news (5), official-data (1), `qualification/h-handoff.qualification.spec.ts` (1).
- **Frontend:** map, layout, market, admin, evidence, today, ask.

The full list of failing tests is in `stage0/test-baseline.json`. They are pre-existing at the authority SHA, and Stage 0 changes no code.

## Active workstreams (Part XIV), inventoried and not touched

| Lane | Ref | Tip | vs Alpha | Final? | Consumption plan |
|---|---|---|---|---|---|
| R4 semantic repair | `handoff/r4-semantic-baseline-5699eb7` | `5699eb70` | +2 / −0 | handoff (immutable by name) | Consume via H checkpoint (it contains R4) |
| Claude H answer-reading / localisation | `checkpoint/r4-h-answer-reading-ea724fa-pre-l` | `ea724fa4` | +11 / −0 | checkpoint before L | Consume when L lands; it owns `lib/ask/shell/locales` |
| Claude L language qualification | **no branch** | — | — | — | Key manifest (rev 4: 559 keys, 530 in L scope) is referenced in H's checkpoint; L EN/PL humanitarian work lives inside the humanitarian branch |
| Politics | `specialist/politics-r1-integration-d920893` | `d9208933` | +3 / −1 | not marked final | Consume handoff; Stage 3 binds its store as an Ask contributor |
| Humanitarian | `integration/humanitarian-data-r1-convergence` | `05e6c23e` | +31 / −84 | mutable `integration/` | Needs a rebase onto Alpha; **collides with H** on `components/my-intelligence/MyIntelligenceClient.tsx` |
| E1 security / rights | **no branch** | — | — | — | Rulings live inside the humanitarian branch; Alpha already has `782b175f` ("close E1 security P1s") |

**Safe zones for non-colliding work:** `docs/`, `scripts/`, `.github/`, and every backend module except ask-v2, ask-router, ask-observability, politics, humanitarian, ask-intelligence and my-intelligence. `app.module.ts`, `prisma/` and the H-owned `lib/ask/*` and `components/ask-frame/*` also need care. Details are in `stage0/workstreams.json`.

## What could not be measured, and what would unblock it

| Gap | Why | Unblock |
|---|---|---|
| Deployed Alpha and Production SHAs, and flag values (`GNA_PUBLIC_ROOT`, `ASK_V2_ENABLED`, `ASK_R2_ENABLED`, `ASK_PUBLIC_COMPUTE_ENABLED`, `DISCUSSION_*`, `ALERTS_IN_APP`) | Railway hosts denied by the cloud environment's network policy (403) | Allow `frontend-alpha-4560.up.railway.app` (and the backend host) in the environment's network settings, or record the values in a signed ops note. 31 UNVERIFIED cells depend on this. |
| Retained row counts and last retrievals | Retained data lives in Postgres, not the repo | Read-only admin export or a DB snapshot count |
| Real-device mobile parity | No device run in Stage 0 | Stage 6 Playwright device matrix (Chromium is available in the container) |

## Name mapping (contract Part II / IV / V / VIII / IX / XII names → numbered outputs)

| Contract name | Output |
|---|---|
| `GLOBAL-CAPABILITY-REGISTRY.json/.md` | `02-GLOBAL-CAPABILITY-REGISTRY.json/.md` |
| `SHARED-SEARCH-BINDING-MATRIX.md` | `06-SHARED-SEARCH-BINDING-MATRIX.md` |
| `SOURCE-ADMISSION-REGISTRY.json` | `07-SOURCE-ADMISSION-REGISTRY.json` |
| `SOURCE-COVERAGE-MATRIX.md` | `08-SOURCE-COVERAGE-MATRIX.md` |
| `FRONTEND-ROUTE-REGISTRY.md` | `04-FRONTEND-ROUTE-REGISTRY.md` |
| `BACKEND-MODULE-REGISTRY.md` | `05-BACKEND-MODULE-REGISTRY.md` |
| `ALPHA-ACCEPTANCE-MATRIX.md` | `09-ALPHA-ACCEPTANCE-MATRIX.md` |
