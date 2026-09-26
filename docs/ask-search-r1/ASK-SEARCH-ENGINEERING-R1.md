# ASK/SEARCH ENGINEERING R1 (final closure)

| | |
|---|---|
| **Base** | `release/alpha-m08-integrated-r1` @ `7e87ec1f59350ba513d00a8cd824a584ad34a8fb` |
| **Branch** | `engineering/ask-search-home-click-r1` (local only: **not pushed, not merged, not deployed**) |
| **Commits** | `2023bdc0` (R1 candidate), `7660cdf7` (closure code), then this documentation commit. The final HEAD SHA is in the delivery note. |
| **Alpha** | Untouched |
| **Production** | HOLD, untouched |

The companion artifacts are `HOME-CLICK-CONTRACT-R1.md` and `MY-INTELLIGENCE-DATA-CAPABILITY-SHEET-R1.md`.

---

## CTO-RULINGS-CLOSURE

| # | Ruling | Implementation | Proof |
|---|---|---|---|
| 1 | A language switch after a completed run must not auto-execute. Preserve the question and the selected language, stage the new-language state, and require explicit Run analysis. | `SearchPageClient` holds consent under `runKey = [request identity, language]`. A language change makes the held consent stale, so the question renders staged in the new language (EN/PL copy). One-shot grants are still matched on the request identity only; the explicit action happened in the current language. | Component: EN→PL after a run adds **0**; Run then adds **1**, with `language='pl'`; PL→EN→PL replays **0**. Browser, through the real header language control at 6 configurations: the switch adds **0**, Run adds **1** in the new language. |
| 2 | Replace "Open full analysis" with "Run full analysis" and the supporting copy "Starts a new source-backed analysis." | The dictionary key is renamed to `runFullAnalysis` / `runFullAnalysisNote`: EN "Run full analysis" / "Starts a new source-backed analysis."; PL "Uruchom pełną analizę" / "Rozpoczyna nową analizę opartą na źródłach." | Specs assert both labels and notes and the **absence** of the old EN/PL labels. Browser label captured: "Run full analysis" (EN), "Uruchom pełną analizę" (PL). |
| 3 | Map Analysis must not directly start compute. It navigates to the workspace and stages the exact governed geography/story context; Run analysis is explicit. The Map control is not renamed. | Already navigation-only after R1. The Map's `/search?q=…&countryCode=…` (and the `articleId` story shape) lands staged. **Pinned:** `MapPageClient`, `CountryPanel`, `CountryArticleCard`, `SourceCard` and `GlobalMapShell` cannot import the consent grant or the analysis transport. No Map copy or visual was changed. | The exact Map shape arrives with **0** requests and a `run-staged` control. The five-file pin test passes. |

---

## 0. Gate 0: release and Alpha provenance (preserved finding)

Everything here was read-only. There was no Alpha change.

- **Backend.** Deployment `74595dec` is a Git build of `df664f5`, and `git diff df664f5 7e87ec1 -- backend shared` is empty. **Alpha runs the release-head backend.**
- **Frontend: genuine artifact drift.** Deployment `946a47ed` is a `redeploy` (CLI, no `commitHash`) of image `sha256:313b6b5b…`. That image was first built by CLI upload `6304f740` at 2026-09-26 04:39:42Z, but `7e87ec1` was committed at 11:21:46Z. The live HTML still serves `<form action="/ask">`, a Hero `<a href="/ask">`, and rail `<a href="/ask?q=…">`, and the dock event string appears in none of the Home chunks. At least nine frontend commits (`6d5c281` → `7e87ec1`) are missing.
- **The service `commitSha`** is stale Git metadata from the last Git-triggered build (`c3dd01a`). CLI uploads carry none.
- **Required remedy, not performed:** the eventual Alpha deployment must be a **Git-triggered rebuild from the finally approved release head**. It must not be another redeploy of the existing image, and it must not be a CLI snapshot upload. Production stays on HOLD.

---

## 1. The compute boundary

**One governed mechanism:** `frontend/src/lib/analysis/analysisComputeConsent.ts`.

- **What a grant is.** A one-shot, 60-second grant bound to the identity `[q.trim(), articleId, countryCode, storyTitle]`.
- **Where it lives.** In module memory, mirrored to `sessionStorage` so a same-tab full navigation carries it. **It is never carried in the URL.**
- **Who can issue it.** Only explicit compute actions:
  1. the `/search` **Analyze** submit;
  2. the staged **Run analysis** button;
  3. the dock's **Run full analysis** link, on a plain same-tab click only.
- **Held consent** is additionally bound to the language (Ruling 1).
- **Every other arrival is staged at zero requests.** That covers the Map, History, NavBar topics, story "Ask AI", shared links, reloads, new tabs, back/forward and language switches.

`analysisAutoRunDecision(query, hasResolvedLanguage, hasComputeConsent)` has four outcomes: `run`, `idle-no-query`, `idle-language-pending`, and `idle-awaiting-consent`.

**React Strict Mode.** Its re-run of the arrival effect is absorbed by a per-instance claim ref. There is no time window: a quick back/forward or reload cannot re-spend.

**Dock.**
- A second submit while a turn is in flight issues nothing.
- The second turn carries only the prior **user** question. Model output never crosses transport.
- The transport limit stays at **1,000 characters**.

---

## 2. Retrieval closure

### 2.1 The evidence-state fact (model contract)

`shared/src/analysis.ts` adds `AnalysisEvidenceState = 'live' | 'retained' | 'degraded-fallback' | 'no-relevant-evidence'` and **one** pure derivation, `resolveEvidenceState(retrievalContext, articleCount)`.

- **`live`.** Current live retrieval.
- **`retained`.** Stored reporting, because live retrieval answered with nothing usable (or `RETAINED_ONLY`, or demo).
- **`degraded-fallback`.** A provider timed out, was rate-limited or errored. Any evidence is stored reporting standing in.
- **`no-relevant-evidence`.** Retrieval answered and nothing relevant exists. This is the only "nothing matched" state.

`AnalysisService` stamps `retrievalContext.evidenceState` **once**, at the single convergence point every retrieval path passes through, before either the empty or the analysed response is built.

It passes `evidenceState` plus `newestEvidencePublishedAt` into `AnalysisProviderInput`. `buildEvidenceStateInstruction` then appends an **AUTHORITATIVE EVIDENCE STATE** section to the system prompt for `retained` and `degraded-fallback`. That section:

- says what the evidence is and the newest publication time;
- forbids describing it as live, real-time, breaking, current, the latest, or "right now", **even if the question asks "right now"**;
- requires the answer to say it is based on stored reporting;
- declares itself authoritative over the question and the article text.

For live evidence the prompt is **byte-identical**, and this is tested.

**Prose control is layered:**
1. the model is told the fact;
2. the UI discloses stored or degraded evidence **deterministically** beside the AI badge, whatever the prose says (`EvidenceFreshnessNotice` in the dock and frame header).

A deterministic prose rewriter was deliberately **not** added, because it would alter cited model text.

### 2.2 Failure is never "nothing matched"

- **Backend.**
  - The generic branch stamps `RETAINED_ONLY`, `PROVIDER_RATE_LIMITED` or `PROVIDER_UNAVAILABLE` through the existing `retrievalOutcome()` helper.
  - The zero-evidence `analysisError` is chosen by evidence state. Degraded: "Live news providers could not be reached reliably, and no stored reporting qualified for this question." (EN/PL). The "No related articles were found" sentence now appears **only** for `no-relevant-evidence`.
  - **D4:** the region path no longer emits `fallbackReason` beside a `live` dataMode.
- **Frontend.**
  - `resolveFrameEvidence` and the dock's no-answer selection read the stamped state. They fall back to the same shared resolver for older payloads.
  - The "nothing matched" body now says: "News sources were searched and answered, but none of their reporting was relevant to this question, so no AI analysis was attempted." (EN/PL). The old "returned nothing" wording is asserted absent.
  - The freshness notice never claims stored reporting was used when nothing was retrieved.

### 2.3 The five-minute analysis cache

`cacheTtlFor` returns **0** (no cache entry) for `retained` and `degraded-fallback`. Demo `mock` mode is exempt, because it has no live provider to refresh from. Live successes keep the configured TTL, and genuine no-relevant-evidence keeps the existing 15-second failure TTL.

Consequences:
- **An explicit re-run after a degraded or retained result always performs a fresh retrieval.**
- If a provider is still in cooldown, it fails fast (GDELT's 60-second cooldown refuses immediately). The new response is again stamped `degraded-fallback` and disclosed. It is never a cached copy that looks like a fresh search.
- In-flight joining of identical concurrent requests is unchanged.

The backend test asserts two searches, `provenance.cached !== true`, and `degraded-fallback` on both responses.

### 2.4 Retained evidence preserved

- The retained fallback is untouched: the local, relevance-gated `findRetainedByQuery` ladder, and NewsService's stored fallback.
- Citations, provenance, regional coverage truth, the retained-evidence relevance guard and provider-failure disclosure are unchanged or strengthened.

### 2.5 Retrieval tuning (from the audit)

| Item | Status |
|---|---|
| Q1: "…right now?" sent to providers as "X right now" | **Fixed (R1).** |
| D1/D5: failure stamped on the generic path | **Fixed.** |
| D2/D3: UI disclosure and outcome honoured | **Fixed.** |
| D4: region contract irregularity | **Fixed.** |
| D6: model told the evidence state | **Fixed.** |
| D7: failure-specific wording | **Fixed.** |
| D8: degraded results replayed from cache | **Fixed.** |
| Q2: primary-only retry after a fallback-tier failure | **Not changed, deliberately.** It adds provider spend during an active failure, which the existing no-retry-storm rule forbids. It needs its own quota ruling. |
| Q3: substring noise in the retained `ILIKE` candidate net | **Not changed.** A DB query-shape change needs a measured corpus study. The relevance gate already prevents unrelated rows from becoming evidence, so the effect is recall, not truthfulness. |
| Q4: serial GNews→GDELT latency | **Not changed.** The deadline and cooldown contracts are intact. Q1 removes the main trigger (the whole-phrase gate rejecting "X right now"). |

---

## 3. Final request-count matrix

### 3.1 Browser

This is the Playwright evidence script `scripts/ask-search-r1-browser.cjs`. It ran against a production `next start` build of HEAD. `POST /analysis/news` was fulfilled from the accepted fixture, so **no model was called**. Counts are cumulative.

| Step | 360 | 390 EN | 390 PL | 430 | 820 | 1440 |
|---|---|---|---|---|---|---|
| Open Home | 0 | 0 | 0 | 0 | 0 | 0 |
| Type in the Hero composer (neighbour reflow 0 px; one-tap focus ✅) | 0 | 0 | 0 | 0 | 0 | 0 |
| Submit the Hero; the draft is staged in the dock and the URL stays `/` | 0 | 0 | 0 | 0 | 0 | 0 |
| First Send | 1 | 1 | 1 | 1 | 1 | 1 |
| Second-turn Send (prior user question ✅, no model output ✅) | 2 | 2 | 2 | 2 | 2 | 2 |
| **Run full analysis** (same tab; runs on `/search`) | 3 | 3 | 3 | 3 | 3 | 3 |
| **Header language switch after the run** (to PL; to EN for the PL row) | **3** | **3** | **3** | **3** | **3** | **3** |
| Run analysis on the staged question (in the new language) | 4 | 4 | 4 | 4 | 4 | 4 |
| Reload of that `/search` URL (staged) | 4 | 4 | 4 | 4 | 4 | 4 |
| Back to Home | 4 | 4 | 4 | 4 | 4 | 4 |
| Fresh tab: Map/story `/search?q=…&articleId&countryCode` | 0 | 0 | 0 | 0 | 0 | 0 |
| …press Run analysis | 1 | 1 | 1 | 1 | 1 | 1 |
| …open queryless `/search` | +0 | +0 | +0 | +0 | +0 | +0 |
| Page errors | 0 | 0 | 0 | 0 | 0 | 0 |

### 3.2 Component (Jest)

| Suite | Tests | What it covers |
|---|---|---|
| `searchComputeRequestCount.spec.ts` | 28 | Every entry shape arrives at 0 (plain, Map Analysis, Map/story Ask, History, NavBar topic, a dock URL without a grant, queryless). A grant for another question or anchor gives 0. Staged Run gives 1. Workspace Analyze gives 1. The dock grant gives 1, with the anchor. StrictMode gives 1. Back/forward and reload give 0. The grant is TTL-bounded, one-shot, identity-bound, and survives a same-tab full navigation only. **Ruling 1:** EN→PL gives 0, Run gives 1 in `pl`, and toggling back gives 0. **Ruling 3:** five Map files cannot grant; the Map shape gives 0. |
| `askDockRequestCount.spec.ts` | 6 | Opening gives 0, a staged draft or suggestion gives 0, typing gives 0, one Send gives 1, an in-flight re-submit adds 0, the second turn carries the prior question and no output, and `maxLength` is 1000. |

---

## 4. Composer

Measured in Chromium with the phone device profile and touch.

| Width | One-tap focus | Hero height (idle → long draft) | Neighbour reflow | Native scrollbar | Second-turn focus | Composer in viewport |
|---|---|---|---|---|---|---|
| 360 | ✅ | 44 → 280 px | 0 px | none | ✅ | ✅ |
| 390 EN | ✅ | 44 → 280 px | 0 px | none | ✅ | ✅ |
| 390 PL | ✅ | 53 → 280 px | 0 px | none | ✅ | ✅ |
| 430 | ✅ | 44 → 280 px | 0 px | none | ✅ | ✅ |
| 820 | ✅ | 44 → 280 px | 0 px | none | ✅ | ✅ |
| 1440 | ✅ | 32 → 258 px | 0 px | none | ✅ | ✅ |

**The real iPhone software keyboard is NOT proven.** Chromium cannot raise it. This remains a documented **Alpha acceptance requirement** on physical 360/390/430-class iPhones, after the Git-triggered rebuild.

---

## 5. Tests and failure-set proof

### 5.1 Frontend (Jest, full)

| Run | Suites failed / total | Tests failed | Passed | Skipped | Total |
|---|---|---|---|---|---|
| Base `7e87ec1` | 12 / 294 | 21 | 6,535 | 13 | 6,569 |
| Candidate HEAD | 12 / 298 | 21 | **6,700** | 13 | 6,734 |

- The failing identity set is **identical**: 23 identities, meaning 21 tests plus 2 suites that fail to compile at base (Appendix B).
- **0 new, 0 fixed.** The candidate adds 165 passing tests.
- New suites:
  - `searchComputeRequestCount` (28)
  - `askDockRequestCount` (6)
  - `homeClickContract` (113)
  - `evidenceDisclosureR1` (18)

### 5.2 Backend: baseline vs candidate under equivalent conditions

**Method.** Six full backend Jest runs were made in the same worktree, with the same `node_modules` and the same Prisma client, alternating **B**aseline and **C**andidate: B1, C1, B2, C2, B3, C3.

- **Baseline** means `backend/` and `shared/` checked out at `7e87ec1`, candidate-added files removed, and `shared` rebuilt.
- **Candidate** means the same trees at HEAD, with `shared` rebuilt.

Exact failing identities were compared per run.

| Run | Suites failed / total | Tests failed | Passed | Skipped | Total |
|---|---|---|---|---|---|
| B1 / B2 / B3 | 13 / 284 | 65 | 7,344 | 154 | 7,563 |
| C1 / C2 / C3 | 13 / 285 | 65 | 7,364 | 154 | 7,583 |

In every one of the six runs, the failing set is the **same 66 identities**: 65 tests, plus 1 suite that fails to compile at baseline (`admin/admin-passive-reads.spec.ts`).

| Classification | Count |
|---|---|
| Deterministic baseline (fails 3/3 on B and 3/3 on C) | **66** |
| **New deterministic (C only)** | **0** |
| Fixed deterministic (B only) | 0 |
| Intermittent within these six quiet runs | 0 |

The candidate adds 20 passing tests: 7,364 − 7,344.

**The earlier 66 → 67 was load-dependent, not deterministic.** The unchanged baseline demonstrably flips one timing-sensitive test. For the two Express specs, the evidence is "never reproduced" rather than "shown to flip on baseline":

- **Unchanged baseline under load.** The earlier run was made while other heavy work shared the machine. In it, `news.service.peer-tail-latency.spec.ts › R1 · P2 — CTO CORRECTION 1: raw articles must NOT start the grace…` **failed on the unchanged `7e87ec1` backend**. It passes in all three quiet baseline runs.
- **Candidate under the same earlier load.** Two Express trust-proxy specs failed:
  - `proxy-chain-diagnostic.spec.ts › Q-6 … trust proxy 1, chain [forged, edge]`
  - `proxied-family-rate-limit.spec.ts › E1-R1 … twenty-one distinct visitors share ONE bucket`

  Both pass in all three quiet candidate runs, and 86/86 twice in isolation.
- **Targeted stress run.** The three timing specs ran 5× per side, alternating, each under an identical saturating CPU load on all 20 cores:

  | Stressed run (3 timing specs, 86 tests) | B1–B5 | C1–C5 |
  |---|---|---|
  | Failures | 0 / 86 in every run | 0 / 86 in every run |

  Isolated CPU saturation reproduced **no** flip on either side. These specs are sensitive to **full-suite worker contention**, not to raw CPU load alone.

  A full-suite-under-load series (B/C ×3) was started to reproduce that contention. **It was stopped by the host's low-memory reaper during its first baseline run and produced no results.** Per the host's instruction it was not restarted.

  Its orphaned load, Jest and script processes were then stopped, and the worktree was verified identical to HEAD, because the interrupted run had left `backend/` and `shared/` checked out at baseline.

  **Honest scope of the flip evidence:**
  - The unchanged baseline **did** flip (`peer-tail-latency`: failed in the loaded full run, passed 3/3 quietly).
  - The two Express trust-proxy specs were observed failing **once**, on the candidate, in that loaded full run. They were never reproduced on either side in:
    - 3 quiet full runs per side;
    - 5 stressed isolated runs per side;
    - 2 isolated candidate runs.
  - Their flip on the unchanged baseline is therefore **not demonstrated**.
  - They exercise real Express/socket timing, and **none of their code or dependencies is touched by this branch**. The branch changes only analysis, prompt and shared files, plus the frontend.

**Acceptance condition: ZERO NEW DETERMINISTIC FAILURES. Met.**

The 66 pre-existing deterministic backend failures are in these areas (the full identities are in Appendix A):

| Spec file | Failures |
|---|---|
| `admin.security` | 26 |
| `analysis.anchor-evidence` | 10 |
| `news.service` | 8 |
| `declared-regions` | 7 |
| `inFlightJoinerDeadline` | 4 |
| `gnews.provider` | 3 |
| `natural-query-routing` | 2 |
| `post-relevance-fallback` | 1 |
| `live-first-seen` | 1 |
| `news.module` | 1 |
| `analysis.geo-precision` | 1 |
| `admin-passive-reads` (suite does not compile) | 1 |
| `admin-convergence-http` | 1 |

### 5.3 Lint

- Frontend: every changed file is clean.
- Backend: every changed file has exactly its baseline error count. Three files carry pre-existing prettier debt, which was not reformatted. There are **zero new lint errors**.

### 5.4 Accepted specs changed deliberately

The contract changed, so these specs were updated:

- `checkpointDAiActionSemantics`: "IT AUTO-EXECUTES" becomes "arrival executes nothing".
- `m52aHardening`, `staleResponseProtection`, `articleAnchorParity`: the dependency array becomes `requestKey, runKey, consentedKey`, and `useRef` is imported.
- `searchWorkspace`: the submit grants consent before pushing the same URL.
- `askAiDock`: the dictionary key list uses `runFullAnalysis` / `runFullAnalysisNote`.
- `c2MicroClosure`: the ordering lock now targets the shared `resolveEvidenceState` call.
- `analysis.service.spec`: four exact-shape `retrievalContext` expectations include `evidenceState`.

---

## 6. Changed files (vs `7e87ec1`)

**Frontend (product):**
- `src/components/search/SearchPageClient.tsx`
- `src/lib/analysis/analysisAutoRun.ts`
- `src/lib/analysis/analysisComputeConsent.ts` (new)
- `src/components/ask/AskAiDock.tsx`
- `src/components/ask/AskCompactResult.tsx`
- `src/components/search/EvidenceFreshnessNotice.tsx` (new)
- `src/components/analysis-frame/AnalysisFrame.tsx`
- `src/components/analysis-frame/analysisFrameState.ts`
- `src/components/home/HomeAccountPanel.tsx`
- `src/components/home/WhatsHappeningNow.tsx`
- `src/components/home/ExploreByTopic.tsx`
- `src/components/navigation/NavBar.tsx`
- `src/lib/i18n/dictionaries/en.ts`
- `src/lib/i18n/dictionaries/pl.ts`
- `src/components/home/homeClickContract.ts` (new, audit data)

**Frontend (tests):**
- New: `searchComputeRequestCount.spec.ts`, `askDockRequestCount.spec.ts`, `homeClickContract.spec.ts`, `evidenceDisclosureR1.spec.ts`
- Changed: `checkpointDAiActionSemantics.spec.ts`, `m52aHardening.spec.ts`, `staleResponseProtection.spec.ts`, `articleAnchorParity.spec.ts`, `searchWorkspace.spec.ts`, `askAiDock.spec.ts`, `c2MicroClosure.spec.ts`

**Shared:** `src/analysis.ts`

**Backend (product):**
- `analysis/service/analysis.service.ts`
- `analysis/query/derive-generic-news-query.util.ts`
- `analysis/prompt/build-analysis-prompt.util.ts`
- `analysis/providers/openai-analysis.provider.ts`
- `analysis/interfaces/analysis-provider.interface.ts`

**Backend (tests):**
- New: `analysis/service/evidence-state.spec.ts`
- Changed: `analysis.service.spec.ts`, `natural-query-routing.spec.ts`, `derive-generic-news-query.util.spec.ts`, `build-analysis-prompt.util.spec.ts`

**Other:**
- `scripts/ask-search-r1-browser.cjs` (new)
- `docs/ask-search-r1/*.md` (the three reports)

---

## 7. Remaining limitations and blockers

1. **Alpha is artifact-drifted.** Acceptance on Alpha requires a Git-triggered rebuild from the approved head (not a redeploy, not a CLI upload). Not done, per instruction.
2. **Physical iPhone keyboard verification** of the dock composer and the second turn is an Alpha acceptance requirement. It is not simulated here.
3. **Model-prose compliance is instruction-level.** The UI disclosure beside every non-live answer is deterministic. A live-model sample review on Alpha, with retained evidence forced, is recommended at acceptance.
4. **Q2–Q4 retrieval tuning is intentionally open.** See §2.5; each needs its own quota or measurement ruling.
5. **66 pre-existing deterministic backend failures and 21 pre-existing frontend failures** exist at `7e87ec1`. None were introduced here, and none are in the changed behaviour.
6. `gh` is not installed on this machine, so PR state is unqueried.
7. **Nothing is pushed, merged or deployed.** Production stays on HOLD.

---

## Appendix A: backend deterministic failure identities (identical in B1–B3 and C1–C3)

```
src/modules/admin/admin-convergence-http.spec.ts :: real Nest HTTP Admin refreshes with real news providers perform zero acquisition
src/modules/admin/admin-passive-reads.spec.ts :: <suite failed to run>
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is off (fail-closed default) a non-"true" value is also off
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is off (fail-closed default) an unset flag makes every admin route 404 — for an administrator
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is off (fail-closed default) an unset flag makes every admin route 404 — for an unauthenticated caller, so "disabled" means absent and not merely locked
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse signed-in user with adminRole = null: GET /admin/analytics/coverage-geography -> 403
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse signed-in user with adminRole = null: GET /admin/analytics/usage -> 403
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse signed-in user with adminRole = null: GET /admin/me -> 403
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse signed-in user with adminRole = null: GET /admin/news/providers -> 403
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse signed-in user with adminRole = null: GET /admin/system/health -> 403
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse signed-in user with adminRole = null: GET /admin/users -> 403
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on ORDINARY AUTHENTICATED USER — the case this milestone exists to refuse the 403 body leaks no role, capability, user id or resource detail
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on a valid session whose user row no longer exists is refused with 403 and does not crash
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators ADMIN may read GET /admin/me and receives the server-derived capability list
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators ANALYST may read GET /admin/me and receives the server-derived capability list
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators SUPER_ADMIN may read GET /admin/me and receives the server-derived capability list
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators SUPPORT does not receive evidence.export, and ANALYST does — the approved matrix, over the wire
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators SUPPORT may read GET /admin/me and receives the server-derived capability list
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators a section the database cannot serve comes back null, never zero-filled
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on administrators only SUPER_ADMIN may read the account list, while all four may read the aggregates
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on authentication is resolved BEFORE authorization an EXPIRED session belonging to a SUPER_ADMIN returns 401, never 403 — the status code never reveals that the account was privileged
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller GET /admin/analytics/coverage-geography -> 401
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller GET /admin/analytics/usage -> 401
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller GET /admin/me -> 401
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller GET /admin/news/providers -> 401
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller GET /admin/system/health -> 401
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller GET /admin/users -> 401
src/modules/admin/admin.security.spec.ts :: admin API security boundary ADMIN_PLATFORM_ENABLED is on unauthenticated caller an unrecognised session cookie is also 401, never 403
src/modules/analysis/region/declared-regions.spec.ts :: TEST A · the typed question resolves EAST AFRICA as request scope THE TYPED QUESTION OUTRANKS THE MAP CAMERA
src/modules/analysis/region/declared-regions.spec.ts :: TEST A · the typed question resolves EAST AFRICA as request scope is NOT routed as one generic global provider search
src/modules/analysis/region/declared-regions.spec.ts :: TEST B · a rate limit is not an empty world RETAINED reporting is fetched for the REGION’S OWN MEMBERS, never as unrelated cache
src/modules/analysis/region/declared-regions.spec.ts :: TEST B · a rate limit is not an empty world all five outcomes exist and the fifth is stamped by the caller
src/modules/analysis/region/declared-regions.spec.ts :: TEST B · a rate limit is not an empty world retained reporting is never served without being declared
src/modules/analysis/region/declared-regions.spec.ts :: TEST B · a rate limit is not an empty world the retained rung is reached only when live did NOT succeed
src/modules/analysis/region/declared-regions.spec.ts :: the declared region list is governed, not inferred membership comes from this module and from nothing else at request time
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 1 — the provider query is derived from the article, not "Australia" does not route an anchored request through the country feed at all
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 1 — the provider query is derived from the article, not "Australia" sends an anchor-derived query and never the bare country name
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 2 — the anchor is present and first keeps the selected article at the front of the evidence set
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 3 — unrelated same-country reporting is rejected none of the seven observed stories survives
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 3 — unrelated same-country reporting is rejected returns the anchor alone when every candidate is merely Australian
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 4 — a genuinely independent report of the same event is retained keeps the same-event report and discards the unrelated ones in the same pool
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 6 — honest scarcity, and no country-feed top-up an anchor-only evidence set is a valid result
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 6 — honest scarcity, and no country-feed top-up never calls the country feed to make the evidence set look larger
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 6 — honest scarcity, and no country-feed top-up prefers one relevant report over eight unrelated ones
src/modules/analysis/service/analysis.anchor-evidence.spec.ts :: R4 REGRESSION 7 — Evidence Geography still resolves Australia reports the country from the retained evidence, without the country-feed branch
src/modules/analysis/service/analysis.geo-precision.spec.ts :: N14 — the accepted anchored Evidence Geography path still resolves an anchored request still reports the anchor’s country
src/modules/analysis/service/inFlightJoinerDeadline.spec.ts :: REV B FINDING 1 — the in-flight joiner is bounded a deadline is a 504, so it is reported as a timeout and not as a server fault
src/modules/analysis/service/inFlightJoinerDeadline.spec.ts :: REV B FINDING 1 — the in-flight joiner is bounded a joiner REJECTS on the deadline instead of waiting for an operation that never finishes
src/modules/analysis/service/inFlightJoinerDeadline.spec.ts :: REV B FINDING 1 — the in-flight joiner is bounded bounding the joiner does NOT duplicate provider work — one shared operation, one call
src/modules/analysis/service/inFlightJoinerDeadline.spec.ts :: REV B FINDING 1 — the in-flight joiner is bounded the joiner finishes inside its own budget, measured on the wall clock
src/modules/analysis/service/natural-query-routing.spec.ts :: THE REPORTED FAILURES — measured end to end NQ-003 an implicit comparison asks for clarification and spends NO provider call
src/modules/analysis/service/natural-query-routing.spec.ts :: THE REPORTED FAILURES — measured end to end generic provider failure may consult local retained evidence but never retries a live provider
src/modules/news/news.module.spec.ts :: NewsModule — real NestJS DI compilation and provider registration ALL_NEWS_PROVIDERS always contains EVERY registered provider, so an inactive provider stays visible to GET /news/providers/health
src/modules/news/news.service.live-first-seen.spec.ts :: R0.5 — the merge disturbs nothing else preserves every provider-supplied field on an annotated article
src/modules/news/news.service.post-relevance-fallback.spec.ts :: S-G — the STORED database fallback stays reachable and truthful is used when live retrieval yields nothing relevant, and is labelled cached
src/modules/news/news.service.spec.ts :: NewsService Milestone #48 — homepage news-content language containment successful live results for a requested language are used directly, with no fallback attempted at all
src/modules/news/news.service.spec.ts :: NewsService generic relevance gate (Milestone #36) does not persist a relevance-rejected article as accepted generic evidence
src/modules/news/news.service.spec.ts :: NewsService relational relevance mode (Milestone #37) M66.14B — country enrichment is ADDITIVE: it adds two fields and changes nothing the M37 gate depends on
src/modules/news/news.service.spec.ts :: NewsService relational relevance mode (Milestone #37) does not persist an x-only or y-only article as accepted relational evidence
src/modules/news/news.service.spec.ts :: NewsService uses cached articles for top headlines with provider-error provenance when live provider fails
src/modules/news/news.service.spec.ts :: NewsService uses cached database articles with no-live-results provenance when a real provider returns no results
src/modules/news/news.service.spec.ts :: NewsService uses cached database articles with provider-error provenance when a real provider fails
src/modules/news/news.service.spec.ts :: NewsService uses category-scoped cached articles with provider-error provenance when category provider fails
src/modules/news/providers/gnews.provider.spec.ts :: GNewsProvider provider health a quota failure marks the provider throttled without inventing a health state
src/modules/news/providers/gnews.provider.spec.ts :: GNewsProvider provider health a rate-limit failure marks the provider throttled too
src/modules/news/providers/gnews.provider.spec.ts :: GNewsProvider provider health reports "degraded" (not thrown) when GNews is reachable but errors
```

## Appendix B: frontend failure identities (identical at base and candidate)

```
src/components/admin/adminOperationalSurface.spec.ts :: A-1 — the news provider table separates failure from absence but that text SURVIVES where it is correct — the AI providers surface
src/components/admin/adminSupportSurface.spec.ts :: S3 — the admin support screen renders real data ADMIN_API stays the READ-ONLY surface — the support writes are declared separately
src/components/layout/claudeDesignFoundation.spec.ts :: M66.1 — the homepage receives the canvas without being reconstructed <main> keeps its exact bottom spacing, so the fixed bottom nav still cannot cover content
src/components/layout/claudeDesignFoundation.spec.ts :: M66.1 — the homepage receives the canvas without being reconstructed CTO decision D5: no section width was rewritten — the canvas is the OUTER boundary only
src/components/layout/claudeDesignFoundation.spec.ts :: M66.1 — the homepage receives the canvas without being reconstructed the functional donor logic page.tsx owns is unchanged
src/components/layout/claudeDesignFoundation.spec.ts :: M66.1 — the homepage receives the canvas without being reconstructed the homepage sections render inside PageCanvas
src/components/layout/claudeDesignFoundation.spec.ts :: M66.1 — the homepage receives the canvas without being reconstructed the section order is unchanged, and the situation map is back in its old place
src/components/map/c911RequestEconomy.spec.ts :: C911-R6 -- provider request economy HOME -- one provider call, and every section reads it the homepage situation map never fetches on mount -- interaction only
src/components/map/m51PhaseB.spec.ts :: C. analysisApi sends optional story context correctly the POST body conditionally includes storyContext only when present — never sends an undefined/null field for ordinary requests
src/components/today/todayWorkspace.spec.ts :: the section frame is bounded, and the homepage keeps its own scroll leaves the five accepted homepage sections in place
src/lib/admin/adminProvenance.spec.ts :: F1.b — provenance registry the A-tagged set is exactly the capabilities that genuinely exist today
src/lib/admin/adminProvenance.spec.ts :: F1.b — provenance registry the two fields the design over-tagged A that really are aggregations are B
src/lib/evidence/visualAuthority.spec.ts :: visual correction preserves accepted authority frontend/src/app/politics-visual-preview/compact/page.tsx is identical to the accepted base
src/lib/evidence/visualAuthority.spec.ts :: visual correction preserves accepted authority frontend/src/app/politics-visual-preview/page.tsx is identical to the accepted base
src/lib/evidence/visualAuthority.spec.ts :: visual correction preserves accepted authority frontend/src/components/politics/PolParts.tsx is identical to the accepted base
src/lib/evidence/visualAuthority.spec.ts :: visual correction preserves accepted authority frontend/src/components/politics/PoliticsCompactScreen.tsx is identical to the accepted base
src/lib/evidence/visualAuthority.spec.ts :: visual correction preserves accepted authority frontend/src/components/politics/PoliticsScreen.tsx is identical to the accepted base
src/lib/map/mapShellRouteWiring.spec.ts :: THE BUILD ARG — deployment-controlled, never source-pinned the ARG is declared in the stage that runs the build
src/lib/market/marketSyntheticHarness.spec.ts :: <suite failed to run>
src/lib/market/mktRetained.spec.ts :: <suite failed to run>
src/lib/market/visualAuthorityCorrection.spec.ts :: preserves accepted bytes: frontend/src/components/market/MarketCompactScreen.tsx
src/lib/market/visualAuthorityCorrection.spec.ts :: preserves accepted bytes: frontend/src/components/market/MarketScreen.tsx
src/lib/market/visualAuthorityCorrection.spec.ts :: preserves accepted bytes: frontend/src/lib/market/mktContract.spec.ts
```
