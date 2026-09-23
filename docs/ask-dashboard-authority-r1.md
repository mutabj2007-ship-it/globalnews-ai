# Ask AI dashboard authority integration R1

Date: 2026-09-23. Status: IMPLEMENTED FOR CTO REVIEW, with the explicit gaps below. Production HOLD.

Branch: `feature/ask-ai-dashboard-authority-r1`.
Base: `e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a`.
Worktree: `D:\Desktop\GlobalNewsAI\Worktrees\codex-ask-ai-dashboard-authority-r1`.

## Routing ruling and scope

The user's CTO ruling supersedes the initial route escalation: `/ask` is the dedicated, idle dashboard. A URL question is a draft, never an auto-run trigger. Mobile Ask navigates to `/ask`. The global AskAiDock keeps its existing lightweight flow and gains a dashboard link carrying bounded question/story context. `/search` remains the full Analysis Workspace and retains its explicit-question auto-run behavior. Complete analysis uses the existing fullAnalysisHref contract to preserve question, subject, article ID and country code. No specialist card taxonomy was changed; no Security card was removed.

There is one new controller call site using existing `analyzeNews()` and its `POST /analysis/news` transport. A synchronous in-flight ref rejects duplicate pending submissions. Conversation history is display-only; transport carries only the immediate previous USER question when the bounded story identity is unchanged. Prior answers never become evidence. Existing source-backed compact projection, comparison coverage, errors and full-analysis links are reused. There is no new backend, provider, subscription, polling path, or AI engine.

The user's Plan B override resolves unsupported-field gaps through existing slots and absence states. It does not authorize a visual redesign. Composition uses the recovered frame, shared map split/detent contracts, shared control components and bundled request-free EvidenceMapCanvas. Reference raster mockups are not shipped and intelligence is not baked into map imagery.

## State coverage

| Authority state | Implemented behavior and bounded gaps |
|---|---|
| D1 welcome | Idle map and composer; existing suggestion rows show absence, with no retrieval on open. No cached digest is invented. |
| D2 selected/question | Country selection sets context and camera; context is removable; question mode uses shared split. Selection never becomes evidence. |
| D3 computing | Shared LoadingStages and pending question; composer blocks duplicate sends. No unsupported refund, billing, cancellation or provider-progress claims. |
| D4 answer | Internally scrolling conversational turns, concise native result, sources and Q comparison coverage; composer remains outside scroller. Map uses qualified native article geography. |
| D5 Watch | Existing WatchCta opens shared unavailable activation treatment. No Watch is created when no supported activation contract exists. |
| D6 alerts | Existing alert absence slot; no new alert engine or synthetic alerts. |
| D7 complete analysis | Existing URL context contract hands off to `/search?q=...`, whose normal explicit-query execution is retained. |
| D8 disputed | Native result uncertainty/source representation is reused; no synthetic disputed classification or unsupported dedicated backend status. |
| D9 no material change | Shared empty change strip and honest absence. No invented change score, prior baseline or inferred no-change finding. |
| M1 peek | Shared compact detent, persistent composer and map context. |
| M2 half | Explicit detent controls and country context; bounded phone layout. |
| M3 computing | Full compact reader with existing loading stages and pinned composer. |
| M4 answer | Answer/Sources/Map tabs; native coverage remains available; existing canvas serves mini-map. |
| M5 Watch | Same unavailable shared activation treatment as desktop. |
| M6 handoff | Same full-analysis URL semantics on phone. |

Desktop uses shared Explore/Question/Answer/Full-map modes, 70/30, 50/50 and 35/65 contracts; pointer/keyboard resizer is bounded to 35–70 map percent and stored per session. Compact uses shared peek/half/full detents with minimum content constraints. Canvas camera survives mode changes. Shared label detail ladder, collision implementation, globe/Layers/3D separation and legend are reused. No new terrain provider is configured. EN and PL catalogues are complete for the added surface.

## Validation and evidence

- Browser acceptance: **4/4 passed**, EN and PL at 1440×900 and 390×844 in headless Edge. Test responses are intercepted existing fixtures, not production data.
- `/ask` with a question and story context: **0 analysis calls, 0 evidence acquisition calls** before submit. First explicit question: 1 request. Follow-up: 1 additional request with previous user question and unchanged bounded context. Complete-analysis navigation: existing `/search` performs exactly one additional request. Opening the global dock adds none.
- Exact native payload keys checked: query, requestedLanguage, storyContext, priorQuestion. Coverage remains present for both displayed answers. Article ID, original subject and follow-up survive the handoff.
- Dashboard has no horizontal overflow in all four cases; conversation stays above composer, which fits viewport. Phone also checked at 390×500 (composer bottom 444). This is a reduced viewport test, not a physical software-keyboard/device test.
- Captures: `D:\Desktop\GlobalNewsAI\Codex_Output\Y\ask-dashboard-r1-evidence`: `en-1440`, `en-390`, `pl-1440`, `pl-390` idle, conversation and geometry PNGs; compact Sources and Map PNGs; `browser-results.json` records requests and geometry.
- Full frontend Jest: **272 suites passed, 6 failed; 6,381 tests passed, 8 failed, 13 skipped**. All eight failures reproduced on an untouched git-archive baseline: accountProxy (2), adminProvenance (2), adminOperationalSurface (1), c911RequestEconomy (1), m51PhaseB (1), pwaGenerationAuthority (1). Logs: `logs/ask-final-tests.json`, `logs/ask-final-tests.log`, `logs/ask-base-failures.json`, `logs/ask-base-failures.log`.
- TypeScript noEmit passed. Spatial token gate: 42/42 resolved. Spatial structure gate: 100/100 passed.
- Production build passed (54 pages generated), including `/ask`. Changed dashboard files pass ESLint without warnings. Build reports two pre-existing hook-dependency warnings in MapPageClient and GlobalMapShell. `git diff --check` passes. No deployment performed.

## Remaining gaps and limits

Polish global NavBar overflows at desktop 1440px. The comparator reproduces the same overflow on `/search`; dashboard frame itself does not overflow. Shared global navigation was not redesigned in this lane. Real-provider/live-backend verification was deliberately not performed: browser analysis responses are test-only intercepted fixtures. Local font requests experienced timeouts, so screenshot font fallback is possible; these captures establish composition and operation, not pixel-identical typography approval. Recovered board was inspected as authority markup and shared structural guards passed, but no automated pixel-diff against its raster references is claimed.

No supported digest means no live ranked suggestions; no compatible Watch activation means no activation; no supported status contract means no manufactured disputed/no-material-change state. Basemap uses the accepted existing bundled vector substrate and components, not the photographic reference image. These are explicit Plan B WITHHOLD decisions, not completed data integrations. D3 cancellation/refunds are not implemented. No production merge or deployment is authorized or performed.

## Files

Added: `frontend/src/app/ask/page.tsx`; `frontend/src/components/ask-frame/{AskFrameScreen.tsx,AskMapColumn.tsx,AskParts.tsx,askDashboard.module.css}`; `frontend/src/lib/ask/{askFrame.ts,askStrings.ts,dashboardContext.ts,dashboardContext.spec.ts,useAskConversation.ts}`; `scripts/ask-dashboard-browser.spec.cjs`.

Changed: `AskAiDock.tsx` (entry link only); `MobileBottomNav.tsx` (route); routing/publisher/SEO guard expectations in `askAiRevA.spec.ts`, `checkpointMAskAiParity.spec.ts`, `footerNavHud.spec.ts`, `seoFoundation.spec.ts`. Route is noindex. Existing SearchPageClient and analysis transport are unchanged. Recovery and implementation evidence is copied to `docs/ask-dashboard-authority-r1.md` for branch review.

## Recovered authority evidence

The following recovery inventory remains valid. Its original route conflict was resolved by the subsequent explicit CTO ruling above.

## 1. Recovery result

The visual authority IS found. Do not classify this as VISUAL AUTHORITY NOT FOUND.

Exact package: `D:\Desktop\GlobalNewsAI\Claude_Output\Scope and layout format.zip`
Size: 3,102,001 bytes.
SHA256: `194977b4515954b2828129bf83db26bc0b3d5f2e6a39b407e0958e13de6c7450`.

It contains Ask AI Implementation Spec v1.0, text specification v1.1, and Visual Spec Board v1.8 (5 September 2026). This is the latest Ask board located. Its identity matches the later visual-convergence package's authority verification, and the current repository's `frontend/src/lib/map/d1/mapComposition.ts` explicitly names this same authority.

Archive-internal paths and SHA256, measured from entry bytes during this task:

| Path within ZIP | SHA256 |
|---|---|
| handoff/00-START-HERE.md | 4d48443646424863ccee6f989294da2c8d9246b364ab15ab0185725c36f0d357 |
| handoff/01-PACKAGE-MANIFEST.md | 036a8e7612bf303a58d57ed140c6b23180e4f911435576acb35f2e3a6614bfef |
| handoff/AI-COST-MAP.md | ed62cdf83df521f9d97524318fb5e47747619fdee9169d0c2f9ea4dd212ba030 |
| handoff/ASK-AI-IMPLEMENTATION-MATRIX.md | c3610c09e655574cbad80b59eab782eef4df1f264f1c03b29da137b5ffa8e0f6 |
| handoff/ASK-AI-SPECIFICATION.md | e8c8f3da69d910c7e648654a9f4e69f91fb40b3c6106b357f3f5558fce234e6b |
| handoff/Ask AI - Visual Spec Board.dc.html | ac2beee54814bebb5de5060cc9fa32490cdc30542661f005f920507504fa711f |
| handoff/CHANGELOG.md | 419ba12e051d49737a2ac89efb358a42d6f3c1d006b37c025e4a631aedaa05b1 |

The text specification, start document, matrix and changelog were read; board markup was inspected. At recovery time no browser visual comparison was performed. Implementation screenshots and geometry checks were subsequently captured as described above. Hashing a file is not a visual acceptance test.

### Search coverage and limits

Recursively enumerated Claude_Output filenames; searched Ask/AI Research, golden, design and board/package names, and content terms including D2-D9, M1-M6, golden frame and REFERENCE APPEARANCE ONLY. Scanned the entry inventories of 1,345 recursively located ZIPs for Ask specifications, boards and scope/routing authority. Only Scope and layout format.zip contained the matching Ask specification/board filenames. Read the relevant Ask package READMEs and authority records, the current repository contracts, the Main context ruling, convergence inventory, and relevant later taxonomy comments.

Limitations: three archives could not be opened as ZIPs: CONVERGENCE-PACKAGE.zip, CONVERGENCE-PACKAGE-v2.zip, MAIN-ADMIN-ACCESS-1.zip. Two trailing-dot directories produced enumeration errors: C2-CONVERGENCE-20260831114500. and C2-CONVERGENCE-20260831114652. Nested archive payloads were not recursively unpacked. Therefore this is the latest positively identified board, not a claim that every byte of every historical package was searchable.

### Superseded material

The package changelog records v1.0-v1.7 as history. v1.8 uses the unmodified CTO prototype reference in D1 and crops of that same substrate in D2-D9/M1-M6. Earlier procedural terrain, healed raster and placeholder/tile treatments are not current build inputs. The start document explicitly excludes earlier drafts from authority.

Neither reference raster may ship, be sampled/cropped into production, or be treated as intelligence/geographic data. Board annotations such as REFERENCE APPEARANCE ONLY must not appear in product HUDs.

## 2. Related packages are not interchangeable authority

All paths below are under `D:\Desktop\GlobalNewsAI\Claude_Output\`.

| File | SHA256 | Role |
|---|---|---|
| H-ASK-AI-RESEARCH-ALPHA-VISUAL-R1.zip | 65b3428425a5adbd968580cc01dd5425167031453f15f85d7b969b8076da2be4 | Later structural visual preview using the recovered v1.8 authority |
| H-ASK-AI-REV-A-DESKTOP-MOBILE-R2.zip | 12612a3a1795434a4631436f801cc6ea69d77dbee0926e8e3117722fa02b5c1e | Compact dock/context and workspace corrections; not the dedicated board |
| H-LIVE-ASK-AI-DASHBOARD-1-R2.zip | 2ec6a95a6950976940b69b28630a84714cd9c42bef5847b8345019eb4a57d158 | Phase-1 dock; its README explicitly says approved visual authority was unavailable |
| MAIN-ASK-AI-CONTEXT-PRESENTATION-CONTRACT-1.md | a84bc6b973c42427059186f8c7106d9d9dad289d628622c927a63897636cf549 | Rev A subject/question and compact presentation contract |
| MAIN-FINAL-CORRECTED-CONVERGENCE-INVENTORY-1.md | b2720ec70059d82745048dadc9f0fe2ad6ee1d52e0fb12f734d4b63d14c00df8 | Historical scope and map decisions; not assumed to override newer user instructions |

H-LIVE R2 supersedes R1's faulty packaging. H-ASK-REV-A R2 corrects R1's scroll, launcher placement and malformed storyTitle behavior. Neither supersedes the dedicated board visually.

The visual-preview package provides five structural states at `/ask-visual-preview` and `/ask-visual-preview/compact`. Its README explicitly leaves `/search` unchanged, requires a routing/auto-run ruling before mounting there, and lists the future convergence work. Its composer has no submit handler; product controls are disabled; suggested-question and evidence rows are empty slots; map substrate is a graticule. It cannot be promoted as a functioning dashboard or used as proof of the requested current acceptance tests. Its historical test and screenshot claims have not been rerun here.
