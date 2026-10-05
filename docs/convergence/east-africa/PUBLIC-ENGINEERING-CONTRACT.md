# Public engineering contract: canonical identities for the visual product and Admin

CTO ruling §8–§10 (2026-10-05). The finished public visual (implemented by the visual lane) and Alpha Admin consume **the same backend identities**. The visual is presentation plus adapters: it holds no second store, no frontend-only coverage registry, no visual-only Story Brief state, and no second Ask state. This document lists the authority for each identity; every row is an existing backend route or contract on `integration/r4-east-africa-convergence-r1`.

## Identity map

| Identity | Authority (backend) | Public read | Admin read | Notes |
|---|---|---|---|---|
| **Article / evidence reference** | `articleRef = sha256(normalizeArticleUrl(url))` (`news/identity/article-ref.util`); Ask sources carry `articleId`, `url`, `publisher`, `publishedAt` | Ask payload `analysis.sources[]`; Brief `evidenceRefs[]` (id, host, url, title, publisher, publishedAt) | same refs inside `/admin/stories/:id/brief` versions | References only: no publisher full text is stored on a Brief |
| **Publisher / source** | evidence ref `host` + `publisher`; StoryArticle `sourceHost` | Brief `evidenceRefs[].host/publisher` | Brief inspection `members[].sourceHost` | Syndicated or co-owned copies are not independent corroboration |
| **Story** | `Story.id` (opaque; alias redirect `mergedIntoId`) | `POST /news/stories/resolve`; `GET /discussion/articles/:articleRef` → `storyId`; `GET /stories/:storyId/brief` → canonical `storyId` | `/admin/stories/by-article/:articleRef`; `/admin/stories/:storyId/brief` (`story.storyId`, `aliasIds`) | An alias id always resolves to its survivor |
| **Story material version** | `Story.briefVersion` (new host / merge; the **alert dedup key**) | Brief `materialVersion`; comment `briefVersion`; alert `createdBriefVersion` | `story.materialVersion` | Continuity only. Never the Brief staleness key. |
| **Evidence revision** | `evidenceRevisionOf(alias-set member articleRefs)` | Brief `currentEvidenceRevision`, `brief.evidenceRevision`, `changedSince` | `currentEvidenceRevision`, per-version `evidenceRevision` | STALE = the evidence set changed. Not a materiality claim. |
| **Story Brief version** | `StoryBriefVersion` (immutable, append-only) | `GET /stories/:storyId/brief` → `state`, `brief.version`, `versions`, `lastAttempt`, `generationAvailable` | `versions[]` with `sourceOperationId`; `attempts[]` with failure kind/code + `operationId` | States: READY / PARTIAL / INSUFFICIENT / STALE / CHECKING / FAILED / NOT_GENERATED. Generation is signed-in only, through governed Ask. |
| **Geography / product scope** | canonical geography (`supranational-membership`); product scopes `PRODUCT_COVERAGE_SCOPES` (shared) | map `DECLARED_PRODUCT_REGIONS[].scopeLabel/scopeDisclosure`; Ask `retrievalContext.requestedScope` (`id`, `label`, `members`, attempted/unreached/live/retained) | coverage-check (`PRIORITY_REGIONS`), source-pack registry | The Middle East 16 is the **"GlobalNewsAI Middle East monitoring scope"**, never agreed geography. **EAC (8)** and **East Africa (11)** are separate retrieval scopes. |
| **Retrieval / coverage state** | Ask payload `retrievalContext` + region coverage (`retrievalOutcome`); per-country register (EA-CAPABILITY-REGISTER) | Ask answer card / coverage lines | Ask Intelligence admin, register | Provider failure ≠ "nothing happened"; international reporting ≠ local coverage |
| **Ask thread / turn / operation** | `AskThread.id`, `AskTurn.id`, `ComputeOperation.id` | `/ask-v2/threads/:id`, `/ask-v2/operations/:id` (operationId, turnId, threadId, status, failureCode, result) | Ask Intelligence admin; Brief `sourceOperationId` | ONE Ask backend. `/ask` (Standalone) and the visual Home's Ask entry use the same routes, router, conversation, evidence, citations and compute controls. |
| **Discussion** | `StoryComment.id`, anchored to canonical `storyId` (+ optional `storyBriefVersionId`) | `GET /discussion/articles/:articleRef` → `ThreadView` (`storyId`, `briefVersion`, comments with `storyBriefVersionId`) | `/admin/stories/*` moderation | Never evidence: no Ask, retrieval or Brief path reads it (structure specs) |
| **Alerts (story follow)** | `StoryAlert` / `StoryAlertEvent` (`@@unique([alertId, briefVersion])`) | `/alerts`, `/alerts/inbox` | — | In-app only; no delivery channel exists (declared OFF) |
| **Watch** | dormant (`WATCH_RUNTIME_ACTIVE = false`) | story follow = Alerts; country follow where it exists | — | **Governed region Watch (East Africa 11, …) is UNAVAILABLE**; pinned by `watch-region-capability.spec.ts`. Never presented as available. |

## Rules for the visual lane (truth-binding review checklist)

1. Every rendered story, Brief, evidence row, region, discussion and Ask element carries the backend id from the table. No locally minted ids, and no client-side caches presented as state.
2. A region selection shows `scopeLabel` (and the disclosure where space allows) for PRODUCT_GOVERNED scopes. Per-country data availability comes from retrieval and coverage state, never from scope membership.
3. Story Brief UI binds to the server `state`:
   - Read Brief only when signed in **and** `generationAvailable`, and only when the state is NOT_GENERATED, STALE, or FAILED with a retryable kind.
   - It never generates on load, render, click-through, map change or Discussion open.
   - FAILED is never shown as "insufficient evidence".
4. Ask from Home calls `/ask-v2/*`, the same endpoints as `/ask`. There is no second Ask client state machine.
5. Admin can open the operational truth for any element through the Admin routes above.

## Gates (all default OFF until Alpha acceptance)

`STORY_BRIEF_ENABLED`, `DISCUSSION_READ_ENABLED`, `DISCUSSION_WRITE_ENABLED`, `ALERTS_IN_APP_ENABLED`, `ASK_BRIEFINGS_ENABLED`. Ask compute keeps its two-key switches (deployment literal + audited DB row).
