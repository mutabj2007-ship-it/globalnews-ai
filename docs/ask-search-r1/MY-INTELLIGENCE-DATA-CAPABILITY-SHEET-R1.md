# MY INTELLIGENCE — DATA CAPABILITY SHEET R1

**Revision:** R1 closure (CTO continuation). §0.2, row 5, the New Since Last Visit row, §3, §4 and §5 are amended.
**Type:** inspection and architecture only. Nothing in this sheet was built, and no flag was changed.
**Source authority:** `release/alpha-m08-integrated-r1` @ `7e87ec1f59350ba513d00a8cd824a584ad34a8fb`. Paths are relative to the repo root.
**Alpha runtime check (read-only, 2026-09-26):** on the Alpha backend service, `ASK_V2_ENABLED`, `SAND_LEDGER_ENABLED` and `SAND_CHARGING_ENABLED` are all **unset**. `AskV2EnabledGuard` requires the exact string `'true'`, so Ask V2 is off on Alpha.

---

## CTO-RULINGS-CLOSURE

1. **Language switching after a run** is presentation, not compute consent. My Intelligence surfaces must inherit this: a language or filter change never re-runs Compare, Summarize or Briefing.
2. **Compute-triggering controls say Run, never Open.** This covers the future `Compare`, `Summarize`, `Ask About Selected`, `Explain Disagreements` and `Create Briefing` actions.
3. **Map Analysis only navigates and stages.** Selection on My Intelligence is likewise zero-cost until an explicit Run.

**Amended here:** previous-visit support is **REUSE WITH ADDITIVE VISIT-BOUNDARY REPAIR** (§0.2, §4). The Saved Story canonical reference contract is §5.

## 0. Three corrections to the CTO inspection premises

1. **Search History has no writer.**
   - `SearchHistoryEntry` and `GET/POST/DELETE /history` exist.
   - No frontend code and no backend service calls `POST /history`. In the frontend, only `GET` (`frontend/src/app/history/page.tsx:38`) and `DELETE` (`:46`) are called.
   - The History page therefore only shows rows that nothing writes today.
2. **The previous-visit contract has no live caller, and it has a refresh quirk.**
   - `POST /users/me/seen` is called only by `frontend/src/components/today/useReturnState.ts:53`, used by `TodayWorkspace`. `TodayWorkspace` appears in `frontend/src/app/page.tsx` only inside comments, where it is marked retired; no route mounts it.
   - **Classification: REUSE WITH ADDITIVE VISIT-BOUNDARY REPAIR** (see §4). It is not REUSE AS-IS.
   - Defect (a): writes are throttled to one per 30 minutes (`RETURN_VISIT_MIN_INTERVAL_MS`). A reload or second surface within 30 minutes of the visit's first write therefore gets the **current** visit's own timestamp as `previousSeenAt`, and the prior-visit boundary is lost (`backend/src/modules/users/users.service.ts:86-128`).
   - Defect (b): there is no sliding activity window. A surface opened more than 30 minutes into one continuous visit rotates the boundary to the current visit's start.
3. **`Article.id` is not a safe Saved-Stories key.**
   - It is a 32-bit rolling hash of the URL (`backend/src/modules/news/providers/gnews.provider.ts:703-709`).
   - Persistence upserts on `Article.url @unique` (`backend/src/modules/news/persistence/article-persistence.service.ts:124-127`).
   - The shared contract itself says to pair the id with `url` (`shared/src/news.ts:220-224`).

The other premises are confirmed: authenticated Country Follow APIs, OAuth return-path support, Home and retained evidence, the `User.lastSeenAt` + `POST /users/me/seen` mechanism, **no** bookmark or saved-story persistence, and **no** `/my-intelligence` route.

---

## 1. Capability inventory (verified)

| # | Capability | State | Evidence |
|---|---|---|---|
| 1 | Country Follow | **REUSE AS-IS** | Model `CountryFollow`, with `@@unique([userId,countryCode])` and cascade on User (`backend/prisma/schema.prisma:183-201`). `GET/POST/DELETE /follows/countries` uses `RequireAuthGuard` plus `CsrfGuard` on mutations (`backend/src/modules/follows/follows.controller.ts:31-64`). Codes are ISO-3, validated `@IsIn`. The cap is `MAX_FOLLOWED_COUNTRIES = 50` (`shared/src/follows.ts:47`), enforced by a SERIALIZABLE count-then-insert that returns 409 over the cap. Client: `frontend/src/components/home/useCountryFollows.ts`. |
| 2 | Search History | **REUSE WITH ADAPTER** | `SearchHistoryEntry {id,userId,query,countryCode?,createdAt}` (`schema.prisma:360-371`). `backend/src/modules/history/history.controller.ts` requires auth and CSRF on writes. It stores only the query and country: no AI output, evidence or article data. There is no writer, no `take` bound on `listForUser`, and no retention job. |
| 3 | OAuth return path | **REUSE WITH ADAPTER** | `GET /auth/google?returnTo=` goes through `validateReturnDestination`, travels in an HMAC-signed flow-state cookie, and is revalidated same-origin on callback (`backend/src/modules/auth/auth.service.ts:176, 298`). The allowlist is exact: `/ /history /support /map /search /workspace` plus `/admin…` (`backend/src/modules/auth/return-destination.util.ts:62-69, 90`). Query strings are forbidden (`:109`). Frontend helper: `accountSignInUrl()` (`frontend/src/lib/api/accountLinks.ts:25`). `/my-intelligence` is not allowlisted. |
| 4 | Home feed and retained evidence | **REUSE AS-IS** (read paths) | Home uses `GET /news/top-headlines`, which has a 300 s in-memory cache and a PostgreSQL fallback marked `dataMode:'cached'`. The retained-only `GET /news/top-headlines/retained` never executes a provider. Per-response `dataMode: live\|cached\|mock\|unavailable` plus `fallbackReason` (`shared/src/news.ts:287-291, 360-378`). Per-article `firstSeenAt` comes from `Article.fetchedAt`, which is immutable. |
| 5 | Previous visit | **REUSE WITH ADDITIVE VISIT-BOUNDARY REPAIR** | `User.lastSeenAt` (`schema.prisma:154`). `POST /users/me/seen` requires auth and CSRF and returns `{previousSeenAt, firstVisit, recorded}` (`backend/src/modules/users/users.controller.ts:44-49`). It reads before writing, and advances `lastSeenAt` only when 30 minutes have passed since the last write (`users.service.ts:86-128`). **It is not REUSE AS-IS.** (a) A reload or second surface inside that window receives the *current* visit's own start as `previousSeenAt`, so the prior-visit boundary is lost. (b) There is no sliding activity window, so a surface opened more than 30 minutes into the same visit rotates the boundary to the current visit. (c) Nothing calls it today. `GET /users/me` does not expose the boundary. The repair is specified in §4. |
| 6 | Saved Stories / bookmarks | **NOT PRESENT** | Searched case-insensitively for `bookmark\|saved\|favou?rite\|savedstory\|readinglist\|readlater\|starred` across `schema.prisma`, `backend/src`, `shared/src` and `frontend/src`. There are no model, route or client matches. `SnapshotPin` is official-source citation pinning and is unrelated. |
| 7 | `/my-intelligence` route | **NOT PRESENT** | No `frontend/src/app/my-intelligence`. No match for `my-intelligence\|MyIntelligence` in any source tree. Not in `frontend/src/lib/seo/routes.ts`, and not in the `returnTo` allowlist. |
| 8 | Watch | **DORMANT/HOLD** | `WATCH_RUNTIME_ACTIVE = false` is a source constant in two places: `backend/src/modules/watch/watch-runtime.policy.ts:2` and `frontend/src/lib/map/monetization/watchRuntimeGate.ts:35`. The `WatchSubscription` model defaults to `PAUSED`; `WatchRun` and `WatchObservation` are also defined (`schema.prisma:1419-1493`). There is no Nest module registered, no controller, no cron and no delivery. **It must remain false.** |
| 9 | Ask V2 / Compute / Sand | **DORMANT/HOLD** | `ASK_V2_ENABLED=false` (`.env.example:704`; unset on Alpha), and the guard 404s unless the value is exactly `'true'`. `ASK_EXECUTION_PORT` is bound to `UNWIRED_ASK_EXECUTION_PORT`, which returns 503 `ASK_EXECUTION_PORT_NOT_BOUND`. `SAND_CHARGING_ENABLED = false as const` (`backend/src/modules/ask-v2/ask-compute.contract.ts:4`). A SQL CHECK constrains reserved and final Sand to 0. The ledger is off (`SAND_LEDGER_ENABLED=false`). **`SAND_QUOTES` (0/0/0/24/120) are design fixtures, not prices, and must not be displayed.** The frontend has zero references. |
| 10 | Notifications | **NOT PRESENT** | There are no mail, push or scheduler dependencies. There is no push handler: `frontend/public/sw.js` has only `install`, `activate` and `fetch` listeners. There is no notification model and no cron that notifies users. A PWA manifest and service worker exist, but they are not a notification capability. **Absence must not be presented as a future alert that already works.** |
| 11 | Article/evidence identity | **REUSE WITH ADAPTER** | The stable key is `Article.url @unique` (the provider URL as received). `normalizeArticleUrl` (`shared/src/storyIdentity.ts:193`) removes tracking parameters and is used for deduplication. Display metadata includes title, sourceName, publishedAt with `publishedAtBasis`, imageUrl, and country. **No full bodies are stored**: `summary` is the provider description. There is no public `GET /news/:id`. |
| 12 | Per-user analysis history | **NOT PRESENT** (live) / **DORMANT** (Ask V2) | `AnalysisRun` has no `userId` by design, and `POST /analysis/news` persists nothing per user. `AskThread`, `AskTurn`, `StoredResult` and `ComputeOperation` exist only behind the disabled Ask V2 flag. `ProductEvent` is telemetry and must not be used as a product surface. |
| 13 | Multi-story analysis input | **NOT PRESENT** | `AnalyzeNewsDto.storyContext` is a single object (`backend/src/modules/analysis/dto/analyze-news.dto.ts:26-50, 106-110`). `AnalysisMode` is `'live-ai' \| 'mock-ai'` only. |
| 14 | Single-analysis sub-products | **REUSE WITH ADAPTER** | Each analysis already carries `summary`, `agreements`, `differences` (disagreements), `timeline`, `briefState` (executive brief) and `watchNext` (`shared/src/analysis.ts:487-530`). |
| 15 | Explicit compute consent | **REUSE AS-IS** (after this R1 lane) | `frontend/src/lib/analysis/analysisComputeConsent.ts` (Ask/Search R1) is the governed one-shot grant. Every My Intelligence compute action must go through it or through the dock's explicit Send. |

---

## 2. Feature matrix

| Feature | Classification | Minimal additive work | Must NOT |
|---|---|---|---|
| **Saved Stories** | Persistence: **ADDITIVE IMPLEMENTATION REQUIRED**. Auth, CSRF and cap pattern: **REUSE AS-IS** (follows template). Article metadata: **REUSE WITH ADAPTER**. | Add `SavedStory {id, userId (cascade), articleUrl, articleId? (hint), title, sourceName, sourceId?, publishedAt, publishedAtBasis, imageUrl?, countryCode?, savedAt}` with `@@unique([userId, articleUrl])` and `@@index([userId, savedAt])`. The snapshot must survive `Article` row churn. Add `GET/POST/DELETE /saved/stories` behind `RequireAuthGuard` + `CsrfGuard`, with a cap and SERIALIZABLE count-then-insert. On POST, resolve display metadata **server-side from `Article` by URL** and never trust client text. Add a `User.savedStories` relation so account deletion covers it. | Store `summary`, body or any full text. Key on `Article.id`. Use `localStorage`. |
| **New Since Last Visit** | **REUSE WITH ADDITIVE VISIT-BOUNDARY REPAIR** | Apply §4: one nullable column, plus corrected `recordSeen` semantics on the **same** endpoint and the **same** clock. Every surface then reads one stable `previousSeenAt` for the whole visit. Count new items with `firstSeenAt > previousSeenAt`, never `publishedAt`. | Build a second last-visit mechanism (localStorage, a client-held session stamp, a per-surface clock, or anything derived from `publishedAt`). Treat `firstVisit` as "everything is new". Ship the surface on the unrepaired endpoint. |
| **Dedicated For You** | Follows: **REUSE AS-IS**. Client filter: **REUSE WITH ADAPTER**. Server feed: **NOT PRESENT**. | Minimal version: filter the Home or retained feed by follows on the client (`HomeAccountPanel` already does this), converting ISO-3 to ISO-2. Richer version (**ADDITIVE**): an authenticated `GET /news/for-you` that reads `Article`/`ArticleCountry` by followed country through the existing retained read path and **never executes a provider**. | Create a second follow system or a preference JSON column. Spend provider quota per user. |
| **Recent Intelligence** | **REUSE WITH ADAPTER** (`SearchHistoryEntry`). Ask V2 threads: **DORMANT/HOLD**. | Write `POST /history` on an **explicit** Send or Run: query and country only, no results. Add a `take` bound and a retention policy. | Enable `ASK_V2_ENABLED`. Persist AI output. Read `ProductEvent` for user surfaces. |
| **Story selection** | **ADDITIVE IMPLEMENTATION REQUIRED** (client state only) | Client-side selection of saved or feed items keyed by URL. Nothing is persisted beyond Saved Stories. | Encode selections in `returnTo`, which forbids `?`. |
| **Compare** | Output fields: **REUSE WITH ADAPTER**. Multi-story input: **ADDITIVE**. | Add a bounded `storyContexts[] ≤ N` to `AnalyzeNewsDto`, or add an analysis mode. This needs CTO interface review. Run it only on an explicit, consented action. | Auto-run. Route through Ask V2 or Sand. Charge. |
| **Summarize** | Single story: **REUSE AS-IS** (`storyContext` via the dock). Multiple stories: **ADDITIVE**. | Same DTO extension as Compare. | Run without explicit Send. Store output as evidence. |
| **Ask About Selected** | Single story: **REUSE AS-IS**. Multiple stories: **ADDITIVE**. | Pass `{title, articleId, countryCode}` as `storyContext` (this is what `transportableContext` already bounds). | Bind `ASK_EXECUTION_PORT`. |
| **Explain Disagreements** | **REUSE WITH ADAPTER** | A presentation adapter over `differences[].positions[].sourceArticleIds` from an explicitly requested analysis. | Invent disagreement when `differences` is empty. |
| **What Changed** | Honest minimum: **REUSE WITH ADAPTER** (`firstSeenAt` vs `previousSeenAt`). Real change analysis: **DORMANT/HOLD** (Situation memory is unwired; `WatchObservation` makes no change assessment). | Present "new reporting in followed countries since your last visit", worded as a count of new reports. | Enable Watch or Situation. Present an article count as "what changed in the world". |
| **Create Briefing** | Single analysis `briefState`: **REUSE WITH ADAPTER**. Multi-story: **NOT PRESENT**. `RESEARCH_REPORT`: **DORMANT/HOLD**. | An additive multi-story mode (as for Compare), with explicit consent. | Use the Ask V2 `RESEARCH_REPORT` path, Sand, or charging. |
| **Notifications** | **NOT PRESENT** | Out of scope unless separately authorized. | Treat `sw.js` as push capability, or show "we'll alert you". |
| **Sign-in return to `/my-intelligence`** | **REUSE WITH ADAPTER** | Add `'/my-intelligence'` to `ALLOWED_EXACT_DESTINATIONS` and its spec. Add a noindex, user-dependent entry in `frontend/src/lib/seo/routes.ts`. | Loosen the validator (prefix or query matching). |

## 3. Hard constraints for the build lane

- **One follow system** (`CountryFollow`) and **one last-visit mechanism**: `User.lastSeenAt` via `POST /users/me/seen`, with the §4 boundary repair. The repair adds a column to that same mechanism; it is not a second clock.
- `WATCH_RUNTIME_ACTIVE` stays `false` in both copies. `ASK_V2_ENABLED` and `SAND_LEDGER_ENABLED` stay off. `SAND_CHARGING_ENABLED` stays literally `false`. `ASK_EXECUTION_PORT` stays unbound. Fixture Sand numbers are never shown.
- **Compute actions** (Compare, Summarize, Ask About Selected, Explain, Briefing) run only on an explicit Send, Run or accepted transition through the governed consent mechanism, never on page load, selection or navigation.
- **Saved Stories** persist URL-keyed references plus permitted display metadata only, and never publisher bodies.
- **Notifications** are reported as absent until they exist.

## 4. Visit-boundary repair (minimum architecture)

**Classification:** REUSE WITH ADDITIVE VISIT-BOUNDARY REPAIR.

**Goal:** one stable "previous visit" boundary, identical across refreshes, tabs and surfaces for the whole visit, without a second personalization clock.

### Data: one additive column on the existing mechanism

- **`User.visitBoundaryAt DateTime?`** (nullable, no default). It holds the value of `lastSeenAt` **at the moment the current visit began**, which is the previous visit's last activity.
- **`User.lastSeenAt` stays the only clock** (last activity). `visitBoundaryAt` is only ever a snapshot of that clock; it is never written from any other source.
- **The migration is additive**, with no backfill (NULL means "no claim"). The existing account-deletion cascade covers `User` columns.

### Semantics: the same endpoint, `POST /users/me/seen`, corrected

`VISIT_GAP` reuses the existing `RETURN_VISIT_MIN_INTERVAL_MS` (30 minutes).

| Stored state at the call | Classification | Write | Returns `previousSeenAt` |
|---|---|---|---|
| `lastSeenAt` is NULL | first visit ever | `lastSeenAt = now`, `visitBoundaryAt = NULL` | `null` (`firstVisit: true`) |
| `now - lastSeenAt >= VISIT_GAP` | **new visit** | `visitBoundaryAt = lastSeenAt`, `lastSeenAt = now` (compare-and-set) | the old `lastSeenAt` |
| `now - lastSeenAt < VISIT_GAP` | **same visit** (reload, second tab, second surface) | sliding touch: `lastSeenAt = now`, at most once per 5 minutes. `visitBoundaryAt` is **untouched**. | the stored `visitBoundaryAt` (stable) |

- **The sliding touch** stops a visit longer than 30 minutes from being split. That split is defect (b) and happens today.
- **Compare-and-set** prevents double rotation when two tabs start a visit at once:
  `UPDATE "User" SET "visitBoundaryAt" = $old, "lastSeenAt" = $now WHERE id = $id AND "lastSeenAt" = $old`.
  If 0 rows are updated, another request rotated first; re-read and return its `visitBoundaryAt`. This needs no new lock or table.
- **Telemetry:** `return_visit` is emitted only on the new-visit row, which keeps today's event meaning.
- **Optional read-only accessor:** `GET /users/me/visit` returns `{ previousSeenAt, firstVisit }` without writing. It is for surfaces that must not advance activity. Recommended wiring: the app shell makes one `POST` per authenticated page load, and surfaces read with `GET`. Both read the same two columns.

### Required tests before any surface ships

- A reload inside a visit returns the same boundary.
- A second surface inside a visit returns the same boundary.
- A call more than 30 minutes into a continuously active visit does not rotate.
- A gap of 30 minutes or more rotates exactly once.
- Two concurrent new-visit calls rotate exactly once.
- A NULL `lastSeenAt` is treated as a first visit.
- Account deletion removes the column.

### Explicitly not

- localStorage or sessionStorage.
- A client-held "first previousSeenAt of the session". The earlier adapter idea is superseded because it breaks across tabs, devices and surfaces.
- A per-surface clock.
- Anything derived from `ProductEvent`.

## 5. Saved Story canonical reference contract (no publisher bodies)

`Article.id` is a 32-bit rolling hash (`gnews-${abs(hash)}`, `gnews.provider.ts:703-709`). It can collide and is provider-specific, and because `Article` upserts on `url`, the first provider's id wins. It cannot be the identity.

| Field | Contract |
|---|---|
| `articleRef` | **The identity.** `sha256(normalizeArticleUrl(url))`, lowercase hex, 64 characters, with `@@unique([userId, articleRef])`. `normalizeArticleUrl` is the existing shared function (`shared/src/storyIdentity.ts:193`), so frontend and backend derive the same reference. |
| `canonicalUrl` | `normalizeArticleUrl(url)`. The link-out target, and the input that makes `articleRef` re-derivable. |
| `sourceUrl` | The provider URL as received (`Article.url`), kept for audit and as a link-out fallback. |
| `providerArticleId?` | The current `Article.id`, as a **non-authoritative** hint only. It is never unique and never used for lookup. |

**Permitted display metadata.** This is a snapshot taken at save time, resolved **server-side** from `Article` by URL; client-supplied text is never trusted.

- `title` (bounded, e.g. at most 300 characters)
- `sourceName` and `sourceDomain`
- `publishedAt` and `publishedAtBasis`
- `imageUrl?`: a URL string only; no bytes are stored
- `countryCodes?`: ISO-3, from `ArticleCountry`
- `savedAt`

**Forbidden:**

- `summary`, an excerpt, the body, full text, or any publisher prose beyond the title
- image bytes
- any AI output about the story

Removal keeps no copy.

**Resilience:**

- The snapshot survives `Article` row churn and retention purges.
- The saved item still links out via `canonicalUrl`.
- If the URL is no longer in `Article`, the UI says the reporting is no longer in the retained corpus. It never re-fetches from the publisher.
