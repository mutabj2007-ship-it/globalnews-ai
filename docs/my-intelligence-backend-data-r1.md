# My Intelligence Backend + Data R1 — integration hand-off

Base: `release/alpha-m08-integrated-r1` @ `6a6a68a59af0a586515a7210398eb9a8781c4f1a`.
Branch: `engineering/my-intelligence-backend-data-r1`.
The visible My Intelligence UI is Claude H's (`517e450…`, not yet on the remote). This branch adds data, endpoints and non-visual seams only.

## Endpoints (all authenticated; mutations use the existing double-submit CSRF guard)

| Method | Path | Purpose | Cost |
|---|---|---|---|
| GET | `/users/me/intelligence/feed` | Following / For You / New Since from retained reporting, plus the stable `previousSeenAt` | DB only |
| GET | `/users/me/saved/stories` | Saved Stories (newest first, ≤200) | DB only |
| POST | `/users/me/saved/stories` | Save by `{ url, providerArticleId? }`; metadata resolved server-side; idempotent | DB only |
| DELETE | `/users/me/saved/stories/:articleRef` | Unsave; idempotent | DB only |
| POST | `/users/me/seen` | Existing route. The visit boundary is now repaired (see below) | DB only |
| GET/DELETE | `/history` | Existing routes. The list is now bounded to 50 | DB only |
| POST | `/analysis/news` | Existing route. Adds an optional `selection` and the one history writer | the only AI boundary |

**Routing note.** The contract named Saved Stories `/saved/stories`. It is mounted at `/users/me/saved/stories` because `frontend/next.config.mjs` states the authenticated `/api` family set as exactly seven ("NOT ONE MORE"). The resource, semantics and guards are otherwise as contracted, and the prefix can be moved if the CTO prefers a new family.

## Frontend seams (non-visual) — `frontend/src/lib/myIntelligence/`

- `myIntelligenceApi.ts`: `fetchMyIntelligenceFeed`, `fetchSavedStories`, `saveStory`, `removeSavedStory`, `fetchQuestionHistory`.
- `hooks.ts`: `useMyIntelligenceFeed`, `useSavedStories` (`save` / `remove` / `isSaved`), `useQuestionHistory` (`stage` → `openGlobalAsk`, 0 AI).
- `selection.ts`: `useStorySelection` (≤8, `canRun(action)`), `runSelectionAction(action, stories, language, question?)`. This is the only compute call.
- `lib/api/analysisApi.ts`: `analyzeNews(..., selection?)`, additive fifth parameter.
- Shared contract: `shared/src/my-intelligence.ts`. It holds `isNewSince`, the types, `MAX_SELECTED_STORIES`, `MULTI_STORY_MIN_STORIES` and the history limits.

## Rules the UI must keep

- **New Since:** `isNewSince(firstSeenAt, previousSeenAt)` from `@globalnews-ai/shared`. H's `newSince.ts` must delegate to it or match it exactly. The feed already stamps `newSince` per story.
- **Zero compute:** only `runSelectionAction` and the existing Ask Send/Run reach `analyzeNews`. Opening the page, changing tabs, save/unsave, follow/unfollow, select/deselect, filters, language, history and reopening a question are 0 AI.

## Files that will need H-frontend convergence when `517e450…` lands

1. **The `/my-intelligence` route (`frontend/src/app/my-intelligence/page.tsx`)** is H's. The OAuth allowlist already contains the exact `/my-intelligence`.
2. **H's Saved / Following / For You / Recent cards** switch from fixtures to `useSavedStories` / `useMyIntelligenceFeed` / `useQuestionHistory`.
3. **H's `newSince.ts`** delegates to the shared `isNewSince`.
4. **H's selection rail and the six action buttons** use `useStorySelection` and call `runSelectionAction` only from the final Run/Confirm.
5. **H's visit-boundary read** uses `POST /users/me/seen` (a mount-time touch, as `useReturnState` does) and `feed.previousSeenAt`. There is no client clock.
6. **Rendering the result** of a selection analysis reuses the existing compact/analysis result components. `retrievalContext.selection` reports resolved and unresolved stories.

No visual file was modified on this branch.
