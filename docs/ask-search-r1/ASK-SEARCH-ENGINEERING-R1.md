# ASK/SEARCH ENGINEERING R1

**Base:** `release/alpha-m08-integrated-r1` @ `7e87ec1f59350ba513d00a8cd824a584ad34a8fb`.
**Work branch:** `engineering/ask-search-home-click-r1`. It is local only: not pushed, not merged, not deployed.
**Alpha:** untouched. **Production:** HOLD, untouched.

The companion artifacts are `HOME-CLICK-CONTRACT-R1.md` and `MY-INTELLIGENCE-DATA-CAPABILITY-SHEET-R1.md`.

---

## 0. Gate 0: release and Alpha provenance

All checks were read-only: Railway GraphQL through the CLI's session, plus unauthenticated HTTP GETs of the public Alpha frontend.

| Item | Finding |
|---|---|
| Git release head | `origin/release/alpha-m08-integrated-r1` = `7e87ec1f59350ba513d00a8cd824a584ad34a8fb`, committed 2026-09-26 11:21:46Z. |
| Local checkout | The primary checkout is `feature/m64-multi-source-intelligence`, with 97 unrelated uncommitted changes. It was **not touched**. This work is in an isolated worktree branched from `7e87ec1`. |
| PR state | `gh` is not installed on this machine, so PR state could not be queried here. |
| Railway project | `GlobalNewsAI-Alpha` (`38134692…`), environments `alpha` and `production`. |
| **Backend deployment** | `74595dec-3847-459d-8bd8-6e4079cb8ed1`, SUCCESS, 2026-09-24 21:11Z. A Git-triggered build of `df664f5` on the release branch. `df664f5` is an ancestor of `7e87ec1`, and `git diff df664f5 7e87ec1 -- backend shared` is **empty**. **The backend artifact equals the release head's backend.** |
| **Frontend deployment** | `946a47ed-28d6-4b35-b2a2-b05e0e884611`, SUCCESS, 2026-09-26 11:24:38Z. `meta.reason = "redeploy"`, `cliCaller = "claude_code"`, **no `commitHash` and no branch**. Image digest `sha256:313b6b5b…`. |
| Image lineage | Digest `313b6b5b…` was first produced by `6304f740` (reason `deploy`, a CLI upload) at **2026-09-26 04:39:42Z**. `7993b260`, `5282eba4`, `ce01805b` and `946a47ed` are all `redeploy`s of that same digest. A redeploy reuses the image; it does not rebuild. |
| Service `commitSha` discrepancy | The service's Git source metadata still points at the last **Git-triggered** frontend build, `0104d654` (`c3dd01a`, 2026-09-25 12:21Z). Every frontend deployment since has been a CLI snapshot upload, which carries no commit, so that field is stale. |

### Verdict: genuine artifact drift, caused by redeploy/snapshot behaviour

The live Alpha frontend **does not contain** the release head. Evidence from the served HTML at `frontend-alpha-4560.up.railway.app/`:

- The Hero form is `<form … action="/ask" method="get">`. At `7e87ec1` it has no action; `14e0efe` removed it at 11:21Z.
- The Hero Ask CTA is `<a href="/ask">`, and the rail suggestions are `<a href="/ask?q=…">`. At `7e87ec1` these are in-place dock launchers (`8238022`…`ff196b8`, committed 05:37–05:39Z).
- The dock event string `globalnews:ask-open` appears in none of the 18 Home JS chunks.

So the redeploy at 11:24Z, three minutes after `7e87ec1`, re-served an image built at 04:39Z. At least **nine frontend commits** are missing from Alpha (`6d5c281` → `7e87ec1`). The six elastic-composer commits committed at 04:48–04:58Z are very likely missing too. Because CLI uploads carry no commit, the exact source tree of `313b6b5b` cannot be proven from Railway metadata.

**Consequence:** any "verified on Alpha" claim about the Home Ask dock is currently false for the live artifact. Nothing was changed. A fresh **Git-triggered** frontend build of the approved head is the clean remedy, and it needs CTO/PO authorization.

---

## 1. The compute boundary: architecture repair

### The defect

`SearchPageClient` asked `analysisAutoRunDecision(query, hasResolvedLanguage)` and called `analyzeNews()` on **route arrival** whenever `?q=` was non-empty. Every producer of `/search?q=` therefore spent a model execution the moment the route resolved:

- Map "Analysis"
- Map/story "Ask AI"
- Country panel
- History entries
- The dock's "Open full analysis" link, including on reload, copy-link and new tab
- Back/forward
- Shared links

### The repair: one governed consent mechanism

**`frontend/src/lib/analysis/analysisComputeConsent.ts`** (new):

- `grantAnalysisConsent(href)` records a **one-shot, 60 s, identity-bound** grant. The identity is `[q.trim(), articleId, countryCode, storyTitle]`.
  - It is held in module memory for client navigation, and mirrored to `sessionStorage` for a same-tab full navigation.
  - It performs no request.
- `consumeAnalysisConsent(key)` returns true **exactly once** for a matching, fresh grant. Any grant it inspects is cleared, matching or not.
- The consent is **not carried in the URL**. A URL marker would make copied links, reloads and history entries spend again. That is the point of "a URL parameter is not consent".

**`analysisAutoRun.ts`** now takes a third input, `hasComputeConsent`, and returns a fourth state, `'idle-awaiting-consent'`.

**`SearchPageClient.tsx`:**

- **Arrival intake.** A matching grant is adopted into `consentedKey` state, and the effect then runs **once**. With no grant, any consent held for a previous identity is dropped, so back/forward re-stages the question.
- **Strict Mode.** React re-runs the arrival effect on the same instance after the one-shot grant is spent. A per-instance `claimedKeyRef` absorbs that re-run. The first design used a 2 s replay window instead; the new request-count test caught that it would let a quick back/forward re-spend, and it was **replaced**.
- **The staged question.** An unconsented `?q=` renders the question with **Run analysis** and **Edit question** (EN/PL), and makes **zero requests**.
- **Explicit compute sites (the only grants):**
  1. `/search`'s own Analyze submit.
  2. The staged **Run analysis** button.
  3. The dock's **Open full analysis** link, on a plain left-click only. A modified click (new tab or window) carries no grant.
- **Everything else is navigation.** Map, Today, History, NavBar topics, "Ask about this" and shared URLs arrive staged. Promoting any of them to an explicit compute action is a one-line `grantAnalysisConsent(href)` at that call site, so it stays a deliberate, reviewable decision.

**The quick Ask vs full Analysis Workspace distinction is preserved.**

- The dock remains the conversational surface. Its explicit Send is the compute moment, and there is exactly one transport site.
- `/search` remains the full workspace.
- The transition between them is the accepted deeper-compute action.

### Entry routes audited

| Entry | Before | After |
|---|---|---|
| Home Hero composer, Hero CTA, rail suggestions | 0 (dock) | 0 (unchanged) |
| Header / phone Search → `/search` | 0 (no q) | 0 |
| Dock Send | 1 per Send | 1 per Send. **Plus a guard:** a second submit while in flight adds 0. |
| Dock "Open full analysis" (same tab) | 1 on arrival | 1 (accepted deeper-analysis action) |
| …opened in a new tab, copied, reloaded, back/forward | 1 each time | **0**, staged |
| Map Analysis / Ask AI / country panel | 1 on arrival | **0**, staged → Run = 1 |
| History entry | 1 on arrival | **0**, staged → Run = 1 |
| `/ask?q=` (dashboard, bottom nav) | 0 (draft) | 0 |
| `/search` Analyze submit | 1 | 1 |
| Mobile bottom nav | 0 | 0 |
| Specialist workspace links (`/workspace` → `/search`) | 0 | 0 |

### Kept, and flagged for the CTO

- **Language switch after an accepted run re-runs the analysis in the new language.** The consent is bound to the question, not the language. This is existing EN/PL behaviour and was preserved deliberately. It is a second spend from a preference change. Recommendation: bind consent to language too, so a switch stages "Run in Polski". Not done without a ruling.
- **"Open full analysis" re-analyses a question the dock already answered.** It is now explicit and one-shot, but the label does not say it runs a new analysis. Recommendation: relabel, or pass the dock response through. Out of scope here.
- **Retry** on the zero-report recovery screen still calls `router.refresh()`, unchanged. It re-runs nothing new.

---

## 2. Conversation correctness

- The dock's second turn sends `priorQuestion` = the previous **user** question, and the subject from the published story context. **Model output never crosses transport.** This is pinned by `askDockRequestCount.spec.ts` (a sentinel in the prior answer never appears in call 2) and by the browser run.
- `useAskConversation` (the `/ask` dashboard) already carried the same rule, pinned by `useAskConversation.spec.ts`. It is unchanged.
- The 1,000-**character** transport limit is retained: `maxLength={1000}` on every composer, pinned in tests. It is not reinterpreted as words.

---

## 3. Broad-question retrieval audit

The audit read code and ran local probes against the real utilities. **No live provider was called.**

| Finding | Status |
|---|---|
| **Q1. The "right now" subject bug.** `What's happening in the Middle East right now?` derived the provider query **`Middle East right now`**. The whole-phrase relevance gate then required that phrase verbatim in headlines, so nearly every live article was rejected. That triggered the serial GDELT rescue (GNews 8 s → GDELT spacing 5.5 s + 8 s timeout) and left 1–2 retained articles. This matches the Alpha evidence of about 13 s and 1–2 articles. | **FIXED.** The first subject pattern now uses the same optional trailing `right now` / `today` / `currently` group as Milestone #46. Backend test added. |
| **D1. A GDELT failure after GNews answered looked like "no relevant evidence".** NewsService reports `dataMode:'live'` with no `fallbackReason`, and the generic branch never set `outcome`. | **FIXED.** The generic branch stamps `retrievalOutcome()`: `PROVIDER_UNAVAILABLE` or `PROVIDER_RATE_LIMITED` when nothing stood in, `RETAINED_ONLY` when retained evidence did. It uses the same helper the region paths already use. No retry is added. |
| **D2. Retained evidence showed under "LIVE AI ANALYSIS".** The stored-reporting disclosure existed only inside Complete Record. | **FIXED.** A new `EvidenceFreshnessNotice` sits beside the AI badge in both the Ask dock and the frame header whenever evidence is not live (or is `RETAINED_ONLY`). It reuses `resolveRetrievalContextText`, so there is no new copy, in EN and PL. It renders nothing for live evidence. |
| **D3. The frontend ignored `outcome`.** A rate limit with `dataMode:'live'`, or a `provider-error` with zero reporting, resolved to "no-evidence", i.e. "The provider was queried and returned nothing". | **FIXED** in `resolveFrameEvidence` and in the dock's no-answer copy selection. |
| D4. The region path can emit `live` + `fallbackReason:'no-live-results'`. | Neutralised in the UI by D3. Backend cleanup remains open. |
| D6. The AI prompt is not told its evidence is retained, so "right now" can be answered from 48 h-old stored reporting as if current. | **Open.** It needs an internal provider-interface change; recommended next. |
| D7. `analysisError` uses one sentence for failure and absence. `stateNoEvidenceBody` says "returned nothing" even when articles failed relevance. | **Open.** Copy change for review. |
| D8. Answers built from retained evidence are cached for 300 s. | **Open.** Recommend the failure TTL when `dataMode !== 'live'`. |
| Q2–Q4. The primary-only retry after a fallback failure; substring noise in the retained `ILIKE` candidate net; GDELT rescue timing that assumes providers run in parallel when they run serially. | **Open.** Retrieval tuning; each needs its own measured change. |

**The retained-evidence fallback was not removed or weakened.** Citations, provenance, the regional coverage truth, the retained-evidence relevance guard and provider failure disclosure are unchanged or strengthened.

---

## 4. Composer

These were measured in the browser run (§5): Chromium, a production `next start` build, and the phone device profile with touch.

| Width | One-tap focus | Hero height (idle → long draft) | Neighbour reflow | Native scrollbar | Second-turn focus | Dock composer in viewport |
|---|---|---|---|---|---|---|
| 360 | ✅ | 44 → 280 px | **0 px** | none | ✅ | ✅ |
| 390 EN | ✅ | 44 → 280 px | **0 px** | none | ✅ | ✅ |
| 390 PL | ✅ | 53 → 280 px | **0 px** | none | ✅ | ✅ |
| 430 | ✅ | 44 → 280 px | **0 px** | none | ✅ | ✅ |
| 820 (tablet) | ✅ | 44 → 280 px | **0 px** | none | ✅ | ✅ |
| 1440 | ✅ | 32 → 258 px | **0 px** | none | ✅ | ✅ |

**Not proven here:** real iPhone software-keyboard behaviour. Chromium cannot raise the iOS keyboard. The dock lifts itself by the obscured `visualViewport` height (`AskAiDock.tsx`, unchanged). Proving it needs a physical iPhone 360/390/430-class device on the rebuilt Alpha, which is **a remaining blocker for sign-off**.

---

## 5. Request-count proof

### Unit / component (Jest, mounted with `react-test-renderer`, counting calls to the single browser transport `analyzeNews`)

**`searchComputeRequestCount.spec.ts`** (new, 19 tests):

- **0 requests, question staged**, for arrival from a plain question, the map Analysis shape, the map/story Ask shape, a History re-open, a NavBar topic link, and a dock-transition URL opened without a grant.
- Queryless `/search` = 0.
- A grant for a different question, or a different anchor, = 0.
- Staged → Run = exactly 1, and re-renders add 0.
- Workspace type (0) → Analyze → arrival = exactly 1.
- Dock grant → full navigation = exactly 1, carrying the anchor.
- **React StrictMode** double effects = exactly 1.
- Back/forward to an analysed question = 0 more. A remount/reload = 0 more.
- The grant is TTL-bounded, one-shot and identity-bound, and survives a same-tab full navigation via `sessionStorage` but not a new tab.

**`askDockRequestCount.spec.ts`** (new, 6 tests):

- Opening from Home = 0.
- Hero draft or rail suggestion staged = 0.
- Typing = 0.
- One Send = 1, and a repeat submit in flight adds 0.
- The second turn carries the prior user question and no model output.
- `maxLength` is 1000.

### Browser (`scripts/ask-search-r1-browser.cjs`, Playwright 1.63 on Edge)

The run used a production build served locally. `POST /analysis/news` was fulfilled from the accepted frame fixture, so **no model was called**. Cumulative counts:

| Step | 360 | 390 EN | 390 PL | 430 | 820 | 1440 |
|---|---|---|---|---|---|---|
| Open Home | 0 | 0 | 0 | 0 | 0 | 0 |
| Type in the Hero composer | 0 | 0 | 0 | 0 | 0 | 0 |
| Submit the Hero, staged in the dock (URL stays `/`) | 0 | 0 | 0 | 0 | 0 | 0 |
| First Send | 1 | 1 | 1 | 1 | 1 | 1 |
| Second turn Send (prior question carried; no model output) | 2 | 2 | 2 | 2 | 2 | 2 |
| Open full analysis (same tab, runs on `/search`) | 3 | 3 | 3 | 3 | 3 | 3 |
| Reload of that `/search` URL (staged) | 3 | 3 | 3 | 3 | 3 | 3 |
| Back to Home | 3 | 3 | 3 | 3 | 3 | 3 |
| Fresh tab: map/story `/search?q=…&articleId&countryCode` | 0 | 0 | 0 | 0 | 0 | 0 |
| …press Run analysis | 1 | 1 | 1 | 1 | 1 | 1 |
| …then open queryless `/search` | +0 | +0 | +0 | +0 | +0 | +0 |
| Page errors | 0 | 0 | 0 | 0 | 0 | 0 |

No hydration race falls back to `/ask`. The Home form has no route action at `7e87ec1`; this is pinned by the existing `askAiDock.spec`, and the browser run confirms the URL stays `/` after submit.

Screenshots and `report.json` are in `frontend/.next/ask-search-r1-evidence/`. That directory is not committed, and the run is reproducible with the script header's command.

---

## 6. Tests

| Suite | Base `7e87ec1` | After R1 |
|---|---|---|
| Frontend (Jest), full | 294 suites (12 failing); **21 failed**, 13 skipped, 6,535 passed (6,569 total) | 298 suites (12 failing); **21 failed, the identical set (0 new, 0 fixed)**; 13 skipped; **6,685 passed** (6,719 total) |
| Backend (Jest), full | 284 suites (14 failing); **66 failed**, 7,343 passed (7,563 total) | 284 suites; 67 failed / 7,346 passed in the same full-suite run. The two differing `src/security/proxy-*` Express-matrix cases and one flipped `peer-tail-latency` case are timing-sensitive. Re-run in isolation with R1 applied, all **86/86 pass twice**. **0 regressions attributable to R1.** |
| Backend `src/modules/analysis` | 24 failed, 1,366 passed | 24 failed (**identical set**) |
| Browser (`scripts/ask-search-r1-browser.cjs`) | — | 6/6 configurations pass every assertion on the final build |

**Tests added:**

- `searchComputeRequestCount.spec.ts` (19)
- `askDockRequestCount.spec.ts` (6)
- `homeClickContract.spec.ts` (113)
- `evidenceDisclosureR1.spec.ts` (12)
- backend: `derive-generic-news-query.util.spec.ts` (+1) and `natural-query-routing.spec.ts` (+3)

- The pre-existing failures are outside this lane: visual-authority byte identity, the admin provenance registry, market TS typing, `m51PhaseB` storyContext POST shape, and two `natural-query-routing` cases that attach provider failures as a plain property rather than the carrier Symbol. They are listed in the delivery note.
- **Changed accepted specs (deliberately, because the contract changed):**
  - `checkpointDAiActionSemantics.spec`: "IT AUTO-EXECUTES" becomes "arrival executes nothing".
  - `m52aHardening.spec`, `staleResponseProtection.spec`, `articleAnchorParity.spec`: the dependency array gains `requestKey, consentedKey`, and the React import gains `useRef`.
  - `searchWorkspace.spec`: the submit now records consent before pushing the same URL.

---

## 7. Remaining blockers

1. **Alpha artifact drift (Gate 0).** Alpha does not run the release head. Authorize a Git-triggered frontend build before any Alpha acceptance.
2. **Real iPhone keyboard proof** for the dock composer and second turn (360/390/430 class).
3. **CTO rulings:**
   - whether a language switch after a run should re-stage rather than re-spend;
   - the "Open full analysis" wording;
   - whether any Map or Today "Analyse" control should be promoted to a consent-granting explicit action.
4. **Open retrieval items D4, D6–D8 and Q2–Q4** (§3).
5. **Nothing is merged, pushed or deployed.** Production stays on HOLD.
