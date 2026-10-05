# T5 Part A: pre-login consent and the guest-trial contract

Branch `claude/stage2-t5-consent-guest-trial`, exact base `5513275ff731936a07c01e937b92c263ba6d6cf9`
(the live Alpha backend and frontend). Part A covers the backend and the contract only. The consent
UI is built in Part B, on top of the T2 global language authority
(`claude/stage2-t2-global-language-foundation`).

Runtime authority (CTO, Railway). Alpha runs `5513275f` with the guest trial deliberately **OFF**
for controlled acceptance. It stays off. This tranche changes no default and does not treat "off"
as a defect. Production runs backend `5b714833f2a036557a022a55c646fdb101ec596e` and frontend
`58f80fd4108d3472e5433c7a50e19295788f2544`. Production facts below come from the code at those SHAs
only, read with `git show` / `git grep`. Flag values cannot be read from code, so every live
Production value is **UNVERIFIED_RUNTIME**.

Product Owner requirement (Public-Beta Production P0):
- first-time users can try at least 3 questions before login;
- before login, users can see privacy, data-handling and cookie information;
- the sign-in boundary is clear;
- guest data and session behaviour is described truthfully.

---

## 1. Measured guest-trial contract

### 1.1 Alpha (`5513275f`)

| Aspect | Measured fact | Where |
|---|---|---|
| Surface | `/ask-v2/guest/*` is a separate controller: `status`, `POST threads`, `GET threads`, `GET threads/:id`, `GET operations/:id`, `POST threads/:id/turns`, `POST claim`. `AskV2EnabledGuard` runs first on every route, so with `ASK_V2_ENABLED !== 'true'` every route returns 404 and private no-store `Vary: Cookie` headers are always sent | `backend/src/modules/ask-v2/guest/ask-v2-guest.controller.ts` |
| Flags (new guest work) | Every flag must be on: (1) `ASK_V2_ENABLED === 'true'` (routes); (2) K-4 `ASK_GUEST_TRIAL_ENABLED`, which has two keys: the deployment value must be the literal `'true'` **and** the audited `OperationalSwitch` row must be `enabled` (unset, `TRUE`, `1`, a missing row or an unreadable store all mean OFF; cached for `ASK_FLAG_CACHE_MS`); (3) for execution, `ASK_R2_ENABLED` and `ASK_PUBLIC_COMPUTE_ENABLED`, each also two-key. The switch gates **new** work only: an existing guest can still read its own rows while its session lives | `compute-controls/operational-switch.service.ts`, `guest-session.service.ts#issue`, `ask-v2.service.ts#guestPreflight` |
| Settings | The 10 spending settings (`ASK_GUEST_ATTEMPTS_PER_SESSION`, `_UNITS_PER_SESSION`, `_POOL_UNITS_PER_HOUR/DAY`, `_SESSIONS_PER_IP_DAY`, `_EXECUTIONS_PER_IP_DAY`, `_EXECUTIONS_PER_DAY`, `_CONCURRENT_PER_SESSION`, `_COOLDOWN_AFTER_NO_ANSWER`, `_COOLDOWN_S`) have **no default**. If any is missing, malformed, or makes three answers impossible within the outer ceilings, the guest path returns `GUEST_TRIAL_NOT_CONFIGURED` (503) and fails closed for guests only. With the code-default `ASK_IP_UNITS_PER_DAY=30000`, three answers cannot fit (they need units/session ≥ 3 × 16000 = 48000 ≤ IP/day), so enabling the trial **requires** an explicit `ASK_IP_UNITS_PER_DAY ≥ 48000` (pinned by the R3 continuation spec "ALPHA AS READ") | `guest-trial.config.ts` |
| Session creation | Created only on the **first explicit guest submission** (`POST /ask-v2/guest/threads` behind `GuestFirstWriteGuard`: same Origin, `X-Requested-With: globalnews-ask`, JSON body, not signed in). Never on page load or on `status`. Token is 32 random bytes; the database stores only its SHA-256. No IP address and no fingerprint is stored on the session | `guest-session.service.ts`, `guest.guards.ts` |
| Guest cookie | `gna_guest` (`__Host-gna_guest` when secure). `HttpOnly`, `SameSite=Lax`, `Secure` in production (same decision as the auth cookies), `Path=/`, no `Domain`, `Max-Age` = remaining **absolute** lifetime. Also sets the CSRF cookie `gna_csrf` (`__Host-` when secure, **not** HttpOnly, same Max-Age). Its value is an HMAC of the guest token hash under a key derived from `OAUTH_FLOW_SECRET`, so it is bound to this one guest | `guest-session.service.ts#setCookies`, `auth/cookie.util.ts` |
| Lifetime | Absolute from creation: `ASK_GUEST_SESSION_LIFETIME_H`, default 168 h, hard cap 168 h (7 days). Activity, reads and cancelled sign-ins never extend it. Expiry is checked on **every** access, independently of the sweep | `guest-trial.config.ts`, `guest-session.service.ts#resolve` |
| Quota (visible) | **3** completed *substantive* answers (`GUEST_ANSWER_ALLOWANCE = 3`, a constant). This meets the PO's ≥ 3. A slot is reserved atomically before any planner or provider work. It is committed only with a durable substantive result (CURRENT_REPORTING, CURRENTLY_VERIFIED, PARTIAL, REFERENCE_BACKGROUND, COMPUTED_RESULT, or RETAINED_RECORD with GOVERNED_RECORD). It is released for INSUFFICIENT, CLARIFICATION_REQUIRED, CAPABILITY_UNAVAILABLE, refusals and failures, so those do not use a visible question. The 4th is refused before any work with `GUEST_TRIAL_EXHAUSTED` (409). A replayed own stored result counts like an answer | `guest-allowance.ts` |
| Quota key | The **guest session** (cookie). It is not keyed by IP, device or fingerprint: every session gets its own 3, and two sessions on one network each get 3. Bounds that do not depend on the cookie: sessions issued per trusted IP scope per UTC day (`guestiss:<ipScope>`), guest executions per IP scope per day (`guestexec:<ipScope>`), all guest executions per day (`guestexec:all`), guest model-unit pool per hour and day, units per session over its lifetime, concurrency per session, attempt ceiling (answers + no-answers), and a cooldown after N consecutive no-answers. The IP scope is a keyed HMAC pseudonym of the IPv4 address or IPv6 /64 that rotates every UTC day (`ip:h:<128-bit hex>`). The raw address is never persisted | `compute-scopes.ts`, `rate-limit-identifier.ts`, `ask-v2.service.ts#guestPreflight` |
| Reset policy | Clearing cookies or opening a private window gives a **new** session with a fresh 3. This is the documented per-session policy. It stays bounded by `ASK_GUEST_SESSIONS_PER_IP_DAY` and `ASK_GUEST_EXECUTIONS_PER_IP_DAY` per network per day. A claimed session is never revived | I6 (below), R3 continuation spec "LOGOUT / RETURN" |
| Rate-limit refusals | `GUEST_TEMPORARILY_LIMITED` (429; any shared or aggregate bound, never phrased as "you used your questions"), `GUEST_COOLDOWN` (429 + `retryAfterS`), `GUEST_ATTEMPTS_EXHAUSTED` / `GUEST_ANSWER_IN_PROGRESS` (409), `GUEST_SIGN_IN_REQUIRED` (409, deeper or quoted work), `SIGNED_IN_USE_ACCOUNT` (409) | `ask-principal.ts` |
| Compute meter | Guest work is metered **inside** the outer controls, never instead of them. Scopes: `guest:<sessionId>` (lifetime units), `guestpool:hour/day`, `conc:guest:<id>`, plus the normal IP, provider and global buckets. At a claim, the guest's lifetime units are written once as an audit record `acctguest:<userId>` with no ceiling. The account's own allowance is **not** debited | `compute-meter.service.ts` |
| Claim to account | Three steps. (1) The guest names its own thread with `POST /guest/claim` (CSRF + Origin), which writes a PENDING claim with a TTL of `ASK_GUEST_CLAIM_TTL_S`, default 600 s. It is refused while an answer is in progress. (2) OAuth start with `intent=ask-guest&returnTo=/ask` puts the claim id into the HMAC-signed, one-time flow cookie, and only if the same browser presents that guest cookie. (3) The callback, after Google proves the account, runs one serializable transaction that requires the claim **and** the same guest cookie, then moves rows to the account. **Measured: it moves *every* thread, operation and stored result of the claimant guest session, not only the named thread.** The named thread is the one the continuation restores (`GET /ask-v2/continuation`, valid for 2 × the claim TTL). Guest slots stay with the session. The session becomes CLAIMED, its cookie is cleared, and the old token reads nothing. The transfer is replay-safe, cannot be consumed by a second account, and never keys on IP. A failed transfer never blocks the sign-in | `guest-claim.service.ts`, `auth/auth.service.ts` |
| Plain sign-in (no claim) | A sign-in that does not come from "Sign in to continue" (for example the nav "Sign in") moves **nothing**. The guest cookie and data stay. While signed in, the guest surface refuses (`SIGNED_IN_USE_ACCOUNT`). After sign-out the guest conversation is visible again in that browser until it expires. `signOut` does not clear the guest cookie | `auth.service.ts#signOut`, `guest.guards.ts` |
| Retention and deletion | Logical expiry happens at `expiresAt` (≤ 7 days), enforced on every access. Physical deletion is done by `GuestMaintenanceService`: an in-process timer (first run 30 s after boot, then every `ASK_GUEST_SWEEP_INTERVAL_S`, default 900 s) holding a transaction-scoped advisory lock. It deletes sessions whose `expiresAt` is more than `ASK_GUEST_PURGE_GRACE_H` (default 24 h, range 1–72) in the past, with cascade to threads, turns, operations, stored results, slots and claims, at most `ASK_GUEST_SWEEP_BATCH` (default 200) per tick. Conversations already moved to an account are untouched. Network-pseudonym meter rows are deleted by `DataRetentionService` 7 days after their window, but **only when `RETENTION_SWEEP_ENABLED === 'true'`** (default OFF). There is no "delete my guest data now" control | `guest-maintenance.service.ts`, `data-retention/*` |
| Maintenance timer while Ask V2 is off | **Verified.** `GuestMaintenanceService` is a provider of `AskV2Module`, which `app.module.ts` always imports. `onApplicationBootstrap` reads no Ask flag; it skips only when `NODE_ENV==='test'`. So on every boot and every replica it runs a ReadCommitted transaction every 15 min: an advisory lock, three bounded SELECTs, and writes **only** if stale claims, stale RESERVED slots or expired sessions exist. It then calls `ComputeMeterService.reapExpired`, which settles any expired unsettled `ComputeReservation`; that meter is used only by Ask. **Assessment: not a defect, and it must not be gated on `ASK_V2_ENABLED`.** With Ask V2 off and no guest rows, it is a read-only no-op. If Ask V2 is turned off after guests existed, the sweep is the **only** mechanism that keeps the published "up to 7 days, then deleted within about 24 hours" promise. Gating it would break the retention claim. Pinned by I8 | `ask-v2.module.ts`, `app.module.ts` |
| Frontend | `useAskR2Conversation({ guestTrial: true })`, used by the Ask frame, Ask dock and Search, makes **one** read on open (`GET /ask-v2/guest/status`), which never mints a session. Guest mode applies only when `!signedIn && available`. The client mirrors the server and keeps no client-side counter. With the trial off, the landed sign-in requirement is shown (frontend `askGuestTrial.spec.ts`, "the guest trial off"). Guest copy exists in **en/pl only** (`askR2Strings.ts`, H+R4-protected) | `frontend/src/lib/ask/useAskR2Conversation.ts`, `askGuestTrial.ts` |

### 1.2 Production (backend `5b714833`, frontend `58f80fd4`)

From the code only. `git diff 5b714833 5513275f` over the guest runtime files is empty:
`ask-v2/guest/*` (non-spec), `compute-meter.service.ts`, `operational-switch.service.ts`,
`compute-controls.config.ts`, `auth/*` and the guest parts of `ask-v2.service.ts`. Production
therefore has **the same guest mechanics** as Alpha: 3 answers, per-session key, the same cookie,
the same 7-day absolute lifetime, the same claim (moves the whole guest session) and the same
maintenance sweep (also always on at `5b714833`, because `AskV2Module` is in `app.module.ts`).

The code differs from Alpha in three places:

| Area | Production code | Alpha code |
|---|---|---|
| Network key in meter rows | **Raw address**: `ip:v4:<address>` / `ip:v6:<prefix>::/64`, persisted in `ComputeMeter` (`guestiss:ip:v4:…`, `guestexec:ip:v4:…`) and in `ComputeReservation.charges` | Keyed, daily-rotating HMAC pseudonym `ip:h:<hex>` |
| Retention of those rows | **No deletion mechanism** (no `data-retention` module at `5b714833`) | `DataRetentionService` (enabled only when `RETENTION_SWEEP_ENABLED=true`) |
| Pre-login disclosure (frontend `58f80fd4`) | No `/cookies` page and no storage inventory. The Privacy page (17 Aug 2026) **does not mention the guest trial**. It says Google sign-in provides "name, email address, and profile image", but the backend scope is `openid email`, so this overstates what is collected. The guest notice says **"Guest conversations stay on this browser for up to 7 days"**, which is false: questions and answers are stored on the server. No privacy or cookies links in the Ask composer | `/cookies` exists and is generated from the inventory. The Privacy Notice (3 Oct 2026) describes the guest trial, the pseudonymous network counter, processors and retention. The guest notice states server storage and processors. Privacy and Cookies links sit under the composer |

**Production guest runtime state: UNVERIFIED_RUNTIME.** None of `ASK_V2_ENABLED`,
`ASK_GUEST_TRIAL_ENABLED` (env and DB row), `ASK_R2_ENABLED`, `ASK_PUBLIC_COMPUTE_ENABLED`, the 10
spending settings or `ASK_IP_UNITS_PER_DAY` can be read from code. If the Production trial is on,
the two Production-only truthfulness defects above (the "stays on this browser" copy and the
undisclosed raw-IP meter rows with no deletion) are **live**. Both are fixed in code at Alpha
`5513275f` and reach Production with the next promotion. Nothing to patch on this branch.

---

## 2. Isolation tests and results

New spec, which extends the R3 suites and edits none of them:
`backend/src/modules/ask-v2/guest/ask-v2-guest.isolation.t5.postgres.spec.ts`. The `ask-v2/guest`
directory is **not** protected. The spec uses the same opt-in harness as the R3 suites
(`ASK_V2_TEST_DATABASE_URL`, loopback `askv2test@127.0.0.1/ask_v2_test`, stubbed execution port,
real Nest guards, cookies, serializable transactions and migrations). Without the URL it is skipped,
like every other `*.postgres.spec.ts` in the baseline.

Live run: a disposable PostgreSQL 16 cluster on port 55435, all 36 migrations applied with
`prisma migrate deploy`.

| Id | Proves | Result |
|---|---|---|
| I1 | Guest B gets the bare owner-404 on guest A's operation (and so its stored result) and on a random id. Each list shows only its own threads. B's allowance is untouched by A's answers. Positive control: A reads its own | PASS |
| I2 | Stored-result replay never crosses owners. An account and two guests ask the identical question (time-independent REFERENCE_BACKGROUND, so replay is reachable): `execute` runs for each owner. The same owner asking again **is** replayed (positive control). The three stored results are distinct, and each result's owner equals its operation's owner | PASS |
| I3 | A signed-in user's thread and operation return 404 on every guest route, including claim, and are absent from the guest list. A browser that presents **both** a valid session and a guest cookie gets 409 `SIGNED_IN_USE_ACCOUNT` on guest reads, and `status` returns exactly `{signedIn:true, available:false}` (no guest data). The account route never serves the guest thread | PASS |
| I4 | A claim moves only the claimant session's rows, and **all** of them: guest A with two threads claims one, and both threads, both operations and both stored results move. The continuation is the named thread. Guest B's rows are untouched and still readable by B. B's thread is 404 via the claimant's account. A's old cookie returns 401 | PASS |
| I5 | A forged 64-hex token, a malformed value, an upper-cased real token or a too-long token is 401 on reads. `status` shows no session and sets no cookie. The session count is unchanged | PASS |
| I6 | The quota key is the session. After 3 answers the 4th gets 409 `GUEST_TRIAL_EXHAUSTED`. A new cookie on the same network gets its own 3, but the per-IP execution bound (set to 4) returns 429 `GUEST_TEMPORARILY_LIMITED`, and the per-IP issuance bound (set to 2) refuses a 3rd session with no cookie and no row. Meter scopes never contain a raw address | PASS |
| I7a | With `ASK_V2_ENABLED` off, every guest route (status, mint, list, submit) returns 404 and sets no cookie | PASS |
| I7b | The guest switch needs two keys. A deployment value of `TRUE`, `1` or unset with the row enabled, or `true` with the row disabled, gives `available:false` and 503 `GUEST_TRIAL_UNAVAILABLE` on mint, with no cookie and no row | PASS |
| I8 | The sweep deletes only sessions past lifetime + grace (with cascade to their threads). It keeps active sessions, sessions within grace, and conversations already moved to an account. It runs (`ran:true`) with `ASK_V2_ENABLED` off | PASS |
| I9 | `gna_guest` is `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, with 0 < Max-Age ≤ 7 days. `gna_csrf` is not HttpOnly and has the same Max-Age. `status` and every read set no cookie | PASS |

Live totals for the guest group (R3 suites + T5): see §8.

Existing coverage, reused rather than duplicated: R3 G1–G10 (thread-level guest↔guest 404,
claim theft, CSRF and Origin, expiry, races, switch off, settings fail-closed, log redaction, no-store
headers), the R3 continuation suite (claim double-charge, logout/return within per-IP bounds), and
frontend `askGuestTrial.spec.ts` / `askSignedOut.spec.ts` (trial off means a sign-in requirement;
404 means unavailable; nothing goes to legacy analysis).

---

## 3. Pre-login storage inventory and truthfulness diff

### 3.1 What the code can set before sign-in (Alpha `5513275f`)

| Name | Kind | Set by | When, before login | Non-essential? |
|---|---|---|---|---|
| `globalnews-ai-language` | cookie, 1 yr, Lax | `persistLanguageSelection` (`lib/i18n/languages.ts`) | When a language is chosen, **and automatically** by `LanguageSync` on `/map` and `/conflict` when the browser language differs from the cookie (no user action) | Preference |
| `globalnews-ai:language` | localStorage | same | same | Preference |
| `globalnews-ai-theme` | cookie, 1 yr, Lax | `themeStore.setThemePreference` | Only when the appearance is changed | Preference |
| `gna_guest` / `__Host-gna_guest` | cookie, HttpOnly, ≤ 7 days | backend guest session | First explicit guest submission only (trial must be on) | Necessary |
| `gna_csrf` / `__Host-gna_csrf` | cookie, ≤ 7 days guest / 30 days account | backend | First guest submission, or sign-in | Necessary |
| `gna_oauth_flow` / `__Host-…` | cookie, 5 min | backend | Pressing Sign in | Necessary |
| `gna_session` / `__Host-…` | cookie, 30 days | backend | After Google sign-in (not pre-login) | Necessary |
| `globalnews-ai:ask-kept-question` | sessionStorage | `askKeptQuestion.ts` | Signing in with a draft in the box | Necessary |
| `gna.storyTask.v1` | sessionStorage | `storyTask.ts` | A story action that needs sign-in | Necessary |
| `gn.map.signInReturn` | sessionStorage | `signInReturnState.ts` | Sign-in from the map | Necessary |
| `gna:analysis-compute-consent` | sessionStorage, 60 s | `analysisComputeConsent.ts` | Confirming an analysis | Necessary |
| `gn-conflict-return-v1` | sessionStorage | `ConflictDashboard.tsx` | Using the Conflict page | Necessary |
| `gna-pwa-v7-precache` / `-runtime` | CacheStorage | `public/sw.js` (production only, after `load`) | Every page load | Necessary (static files only) |

No analytics, advertising, tracking or session-replay SDK exists: not in code, not in
`frontend/package.json` (asserted by `storageInventory.spec.ts`). No consent-like key exists.
**Nothing non-essential is set before a choice**, with one exception: the automatic language
persistence on `/map` and `/conflict`. It is disclosed ("can also be set from your browser's
language"). T2 removes browser-language detection, which removes the exception.

### 3.2 Truthfulness diff: `/privacy` and `/cookies` against the code

| # | Claim | Code | Verdict | Class |
|---|---|---|---|---|
| D1 | `/cookies` said the language cookie and localStorage hold "“en” or “pl”" | `persistLanguageSelection(language: LanguageCode \| DisplayLocale)` writes any of en/pl/fr/de/es/pt/ar (Ask shell, NavBar and others pass all 7) | **False. Fixed on this branch** (`storageInventory.ts` now lists all 7, pinned by `storageInventoryLanguageValues.t5.spec.ts`) | P1, fixed |
| D2 | Privacy: guest limit identifiers "about a week"; usage records 90 days; account conversations 12 months; support 24 months | Enforced by `DataRetentionService` **only if `RETENTION_SWEEP_ENABLED === 'true'`** (default OFF, fail-closed by design) | True only if the runtime flag is on: **UNVERIFIED_RUNTIME**. Public Beta must either enable the sweep or qualify the sentence | **P0** (operational, PO/CTO) |
| D3 | Privacy: guest conversations last up to 7 days, then are deleted within about 24 hours | Absolute lifetime ≤ 168 h. Purge after `PURGE_GRACE_H` (default 24, configurable up to 72) by the always-on sweep (≤ 15-min tick, batch 200) | True at defaults. Would be false if `ASK_GUEST_PURGE_GRACE_H` were set above roughly 24 | P2 (keep the default, or render the configured value: §4.3 `policy`) |
| D4 | Ask guest notice (`askR2Strings` guest.privacy): "kept on our servers for up to 7 days" | Readable ≤ 7 days, physically deleted up to grace later | Slightly short: the page says 7 days + about 24 h | P2: protected-file patch P-2 |
| D5 | Ask exhausted card: "Sign in to continue **this conversation** and keep your answers" | Claim moves **all** of this browser's guest conversations (I4) | Understates what moves. Not harmful, but not exact | P1: PO decision, patch P-3 or code change C-1 |
| D6 | Privacy: guest questions are stored "as one guest conversation" | A guest can open several threads (`POST /guest/threads` with a live session); all are stored | Loose wording | P2: Part B copy |
| D7 | `/cookies` names cookies without the `__Host-` prefix | On https the wire names are `__Host-gna_session`, `__Host-gna_csrf`, `__Host-gna_oauth_flow`, `__Host-gna_guest` | The source comment says so, but the page does not show it | P2: Part B shows "(sent as `__Host-…` on https)" |
| D8 | Nothing tells the user that a **plain** sign-in leaves the guest conversation behind, or that it reappears after sign-out on that browser (shared devices) | §1.1 "Plain sign-in" | Missing disclosure | P1: §4 design rule T3/T4 |
| D9 | Privacy and Cookies pages and guest copy are localized | Privacy dictionary, Cookies page and guest copy exist only in en/pl. fr/de/es/pt/ar readers get English | Gap against the 7-locale requirement | **P0** for Public Beta: Part B via T2 |
| D10 | Footer legal row | `/privacy`, `/terms`, `/source-policy` and `/third-party-notices` are linked from the Footer (`lib/homeContent.ts`). `/cookies` is linked only from `/privacy` and the Ask composer | Discoverability gap | P1: Part B |

Production (`58f80fd4`), for the record (fixed in Alpha code): the false "stay on this browser"
claim, the Privacy page silent on the guest trial, the overstated Google scope, no Cookies page,
and raw-IP meter rows with no deletion on backend `5b714833`.

---

## 4. UX and consent contract for Part B

### 4.1 Principles

1. **No consent banner and no "Accept all".** The product sets no optional storage (§3.1), so there
   is nothing to consent to. A banner would be a false signal and a dark pattern. Pre-login
   transparency is met with **notices** placed where data is first handled, plus the existing
   preference-removal control on `/cookies#settings`.
2. If the PO still wants a dismissible first-visit notice, its dismissal must be stored as
   **`gna.notice.v1`** (localStorage, category PREFERENCES), added to `STORAGE_INVENTORY` and to
   `PREFERENCE_LOCAL_KEYS` so "Remove preferences" clears it. The `storageInventory.spec.ts`
   two-way check enforces this.
3. The client keeps mirroring the server: every count, state and expiry comes from
   `GET /ask-v2/guest/status`.
4. Copy says only what the code does. Every new string is a key. en/pl drafts are marked
   `PENDING_PO_LEGAL_APPROVAL`. fr/de/es/pt/ar have **no invented text**: they are the T2 catalogue
   state `PENDING_PO_LEGAL_APPROVAL` and fall back to English with the T2 declared-fallback notice
   until approved translations land.

### 4.2 Where notices appear

| Moment | Component (new, `frontend/src/components/consent/`) | Mount point | Content (keys in §4.4) |
|---|---|---|---|
| First visit, any page | Footer legal row | `lib/homeContent.ts` Legal links (not protected): add `{ href: '/cookies' }` next to `/privacy`, with a `linkLabels['/cookies']` entry per locale (the Footer tripwire spec must be updated with it) | `consent.footer.cookies` |
| Ask entry, before the first question (signed out) | `PreLoginDataNotice`: inline, non-modal, one line + links | `AskFrameScreen.tsx` entry section (H+R4-protected; patch **P-1**) replacing the current `privacy-links` paragraph | `consent.notice.*` |
| Guest trial available, before the first guest Send | `GuestTrialNotice`: intro, allowance, "sending sets a guest cookie and stores this conversation on our servers until <date>", processors, links | same patch P-1, replacing the `guest-intro` block | `consent.guest.*` |
| During the trial | `GuestQuotaBadge`: "N of 3 guest questions left", cooldown with retry time, expiry date | composer footer (P-1) | `consent.quota.*` |
| Sign-in boundary (exhausted, deeper, or "Sign in to continue") | `SignInBoundaryCard`: what moves, what Google shares, what happens on cancel | P-1, replacing the exhausted card body | `consent.boundary.*` |
| Plain "Sign in" while a guest session exists | `GuestLeftBehindNote` in the account menu or sign-in entry | `useAskR2Conversation` exposes `guest.session`. Mount in the nav sign-in entry (`AskNavShell.tsx` is H+R4: patch P-4) | `consent.boundary.plainSignIn` |
| `/privacy`, `/cookies` | Localized through T2 `surfaceLocale('privacy'|'cookies')`; the pages stay generated from the dictionary and the inventory | `app/privacy/page.tsx`, `app/cookies/page.tsx` (not protected; T2 already rewires the locale) | dictionary `privacyPage.*`, `COOKIES_PAGE.*`, inventory texts become 7-locale |

### 4.3 Backend fields

Existing `GET /ask-v2/guest/status` fields: `signedIn`, `available`, `session.expiresAt`,
`allowance`, `remaining`, `committed`, `reserved`, `state`
(`OPEN|EXHAUSTED|COOLDOWN|ATTEMPTS_EXHAUSTED`), `cooldownUntil`, `csrf`. These are enough for the
quota badge and the expiry date.

Proposed additions for Part B, all in non-protected `ask-v2-guest.controller.ts` /
`guest-session.service.ts`:

- `policy: { allowance: 3, sessionLifetimeH, purgeGraceH }` on `status`, so the notices render the
  **configured** lifetime and grace instead of a hard-coded "7 days / 24 hours" (closes D3 and D4).
  It is read-only and reveals no limits that matter for abuse.
- `POST /ask-v2/guest/forget` (RequireGuestGuard + GuestWriteGuard): deletes the caller's own guest
  session with cascade, clears `gna_guest`, and is refused while an answer is in progress
  (`GUEST_ANSWER_IN_PROGRESS`). This gives guests the "delete now" control that is missing today
  (**P1**, needed before the notice can say "you can delete it at any time"). Acceptance: guest A
  forgets, A's rows are gone, B is untouched, A's cookie returns 401, and the per-IP bounds are
  **not** refunded.
- C-1 (PO decision, optional): make the claim move **only** the named thread to match "this
  conversation", and delete the session's other threads with it at purge. Today all of them move
  (I4). Recommendation: **keep the current behaviour** (it loses nothing the reader made) and
  change the copy (P-3).

### 4.4 Guest to signed-in transition rules (the only continuity promised)

| Rule | Promise (copy may say this) | Must not say |
|---|---|---|
| T1 "Sign in to continue" (claim) | "Your guest conversations from this browser move to your account. The one you were in opens again. Nothing is run again." The guest cookie is removed. Remaining guest questions do not carry over. Guest usage is recorded once, not charged to your account | "Your 3 questions carry over", "everything you did is saved" |
| T2 Cancelled or failed sign-in | "Your conversation is still here." The claim expires after about 10 min. The draft stays in this tab | "Your conversation was saved to an account" |
| T3 Plain sign-in (no claim) | "Guest conversations stay with this browser and are not added to your account. They are deleted after <date>." | "Sign in to keep your answers" |
| T4 Sign-out on a shared device | "Guest conversations on this browser remain visible here until <date>." (Until `forget` exists, say only this) | "Signing out removes your data" |
| T5 After the transfer | Retention follows the account policy (privacy §Retention; conditional on D2) | The guest 7-day promise |
| T6 Unsent draft | Kept in this tab only (sessionStorage), never sent automatically | "Saved" |

### 4.5 String keys (drafts, not approved)

Namespace `consent.*`, delivered as a T2 catalogue surface `consent`. Every value is
`PENDING_PO_LEGAL_APPROVAL`. Bracketed values come from `status`, never literals.

```
consent.notice.line            "We store only what the service needs. No ads, no tracking."   [PENDING_PO_LEGAL_APPROVAL]
consent.notice.privacyLink     "Privacy"                                                      [PENDING_PO_LEGAL_APPROVAL]
consent.notice.cookiesLink     "Cookies"                                                      [PENDING_PO_LEGAL_APPROVAL]
consent.guest.intro            "Ask {allowance} questions without signing in."               [PENDING_PO_LEGAL_APPROVAL]
consent.guest.storage          "Sending your first question sets a guest cookie and stores this conversation on our servers until {expiresAt}, then it is deleted within about {purgeGraceH} hours." [PENDING_PO_LEGAL_APPROVAL]
consent.guest.processors       "To answer, your question goes to an AI provider and search words go to news services." [PENDING_PO_LEGAL_APPROVAL]
consent.guest.network          "To prevent abuse we count guest questions per network with a daily-changing pseudonym." [PENDING_PO_LEGAL_APPROVAL]
consent.quota.remaining        "{remaining} of {allowance} guest questions left"             [PENDING_PO_LEGAL_APPROVAL]
consent.quota.notCounted       "This one didn't use a guest question."                       [PENDING_PO_LEGAL_APPROVAL]
consent.quota.cooldown         "Guest questions are paused until {cooldownUntil}."           [PENDING_PO_LEGAL_APPROVAL]
consent.quota.busy             "Guest questions are busy on this network right now."         [PENDING_PO_LEGAL_APPROVAL]
consent.quota.expires          "Guest conversation kept until {expiresAt}."                  [PENDING_PO_LEGAL_APPROVAL]
consent.boundary.title         "Continue with an account"                                    [PENDING_PO_LEGAL_APPROVAL]
consent.boundary.moves         "Your guest conversations from this browser move to your account; nothing is run again." [PENDING_PO_LEGAL_APPROVAL]
consent.boundary.google        "Google shares only your email address with us."              [PENDING_PO_LEGAL_APPROVAL]
consent.boundary.cancel        "If you cancel, your conversation stays here."                [PENDING_PO_LEGAL_APPROVAL]
consent.boundary.plainSignIn   "Guest conversations stay with this browser and are not added to your account." [PENDING_PO_LEGAL_APPROVAL]
consent.boundary.sharedDevice  "On a shared device, guest conversations stay visible in this browser until {expiresAt}." [PENDING_PO_LEGAL_APPROVAL]
consent.forget.action          "Delete guest conversation"                                   [PENDING_PO_LEGAL_APPROVAL]  (only with POST /guest/forget)
consent.footer.cookies         "Cookies"                                                     [PENDING_PO_LEGAL_APPROVAL]
```

Locale plan: en and pl drafts in `frontend/src/lib/consent/consentStrings.ts`. fr/de/es/pt/ar are
T2 `declaredKeyStates` entries with state `PENDING_PO_LEGAL_APPROVAL`, which renders the English
draft with the T2 fallback notice. Arabic gets `dir="rtl"` through the T2 surface. The legal pages
(`privacyPage`, `COOKIES_PAGE`, inventory `purpose/data/lifetime/whenSet`) move from `{en,pl}` to the
7-locale catalogue with the same state. **No legal translation is authored by engineering.**

### 4.6 Files Part B adds or changes

| File | Protected? | Change |
|---|---|---|
| `frontend/src/lib/consent/consentStrings.ts` (+ spec) | no | keys above, en/pl drafts |
| `frontend/src/components/consent/{PreLoginDataNotice,GuestTrialNotice,GuestQuotaBadge,SignInBoundaryCard,GuestLeftBehindNote}.tsx` (+ specs) | no | presentational, take `AskGuestStatus` and the locale |
| `frontend/src/lib/homeContent.ts` (Footer legal links) + dictionaries `linkLabels` | no | `/cookies` link |
| `frontend/src/lib/privacy/storageInventory.ts`, `cookiesPageStrings.ts`, `app/cookies/page.tsx`, `app/privacy/page.tsx` | no | 7-locale through T2; show `__Host-` wire names (D7) |
| `frontend/src/lib/ask/useAskR2Conversation.ts` | no | expose `guest.policy` once the backend adds it |
| `frontend/src/lib/api/askV2Api.ts` | **H+R4** | `AskGuestStatus.policy?`, `guestForget()`: patch **P-5** |
| `frontend/src/components/ask-frame/AskFrameScreen.tsx` | **H+R4** | mount points: patch **P-1** |
| `frontend/src/lib/ask/askR2Strings.ts` | **H+R4** | P-2, P-3 (until the consent keys replace `guest.privacy` / `exhaustedBody`) |
| `frontend/src/components/ask-nav/AskNavShell.tsx` | **H+R4** | P-4 (plain sign-in note) |
| `backend/src/modules/ask-v2/guest/ask-v2-guest.controller.ts`, `guest-session.service.ts` | no | `status.policy`, `POST /guest/forget` |

### 4.7 Acceptance tests for Part B

Frontend (jest + RTL):
1. Signed out, trial off: the entry shows `PreLoginDataNotice` with working `/privacy` and `/cookies` links, there is no guest intro, and Send shows the sign-in requirement. Exactly one network read happens on open.
2. Trial on: `GuestTrialNotice` renders allowance, expiry and grace **from status**, with no hard-coded 3, 7 or 24.
3. The quota badge follows `remaining` / `state` / `cooldownUntil`. A not-counted answer leaves it unchanged.
4. Exhausted: `SignInBoundaryCard` text is T1. "Sign in to continue" claims first, and the URL carries no id or question.
5. Plain sign-in with a live guest session shows the T3 note. Sign-out shows T4.
6. Every consent key exists for all 7 locales (value or declared `PENDING_PO_LEGAL_APPROVAL`). Arabic renders RTL. No string contains "Accept all".
7. The Footer links `/cookies` in every locale. The `storageInventory.spec.ts` two-way check passes, including `gna.notice.v1` if adopted.
8. Privacy and Cookies render in the T2 effective locale, with the declared fallback notice for unapproved locales.

Backend:

9. `status.policy` equals the resolved lifetimes and never mints a session.
10. `forget`: own rows deleted, another guest untouched, cookie cleared, 401 afterwards, per-IP counts not refunded, refused while an answer is in progress, CSRF and Origin required.
11. The T5 isolation suite (I1–I9) and the R3 suites stay green on live Postgres.

---

## 5. Gaps against the PO requirement

| Requirement | Status (Alpha code) | Gap | Class |
|---|---|---|---|
| ≥ 3 questions before login | **Met in code**: 3 substantive answers per session, and no-answers don't count | Runtime OFF on Alpha by CTO decision (not a defect). Enabling requires all 10 spending settings, both switch keys, `ASK_V2/R2/PUBLIC_COMPUTE` on, and `ASK_IP_UNITS_PER_DAY ≥ 48000` (the code default 30000 fails closed). Shared networks (NAT, campus, carrier-grade NAT) share the per-IP bounds, so some users can get "busy" before their 3rd question; the copy says so truthfully | P0 operational (enablement manifest, PO/CTO) |
| Privacy, data and cookie info before login | Met for en/pl: `/privacy`, `/cookies` (public, allowlisted in Standalone), links under the composer, guest notice | D9 (5 locales get English), D10 (Footer has no `/cookies`), D2 (retention claims depend on a default-OFF sweep) | P0 (D9, D2), P1 (D10) |
| Clear sign-in boundary | Exhausted card, "Sign in to continue", deeper-needs-sign-in, cancel and fail notices | D5 (understates what moves), D8 (plain sign-in and shared device not disclosed) | P1 |
| Truthful guest data and session behaviour | Mostly met at Alpha | D1 **fixed**; D3, D4, D6, D7 wording; no guest self-delete (`forget`); Production frontend still says "stays on this browser" until promotion | P1 (forget, D5, D8), P2 (D3, D4, D6, D7) |
| Isolation | **Met**: I1–I9 + R3 G-tests pass on live Postgres | none found | n/a |

Observations (no action this tranche):
- The `guest:<sessionId>` and `conc:guest:<id>` meter rows (bucket epoch 0) are excluded from
  usage retention (`bucketStart > epoch`) and outlive the purged session. They hold counts only,
  keyed by a deleted UUID. P2: delete them with the session in the sweep.
- The guest CSRF cookie shares the `gna_csrf` name with the account CSRF cookie. A sign-in
  overwrites it, which is intended and harmless.

---

## 6. Specs for protected-file changes (not applied)

Each patch below applies to an H+R4-protected file. None has CRLF at the base (checked with
`git show 5513275f:<path> | grep -c $'\r'` = 0).

**P-2: `frontend/src/lib/ask/askR2Strings.ts` (copy, PENDING_PO_LEGAL_APPROVAL), D4**
```diff
@@ en guest
-    privacy:
-      'Guest questions and answers are kept on our servers for up to 7 days. To answer, your question goes to an AI provider (OpenAI) and search words go to news services. Signing in shares only your email address.',
+    privacy:
+      'Sending your first guest question sets a guest cookie. Guest questions and answers are kept on our servers for up to 7 days and then deleted within about 24 hours. To answer, your question goes to an AI provider (OpenAI) and search words go to news services. Signing in shares only your email address.',
@@ pl guest
-    privacy:
-      'Pytania i odpowiedzi gościa przechowujemy na naszych serwerach do 7 dni. Aby odpowiedzieć, pytanie trafia do dostawcy AI (OpenAI), a słowa wyszukiwania do serwisów informacyjnych. Logowanie udostępnia tylko Twój adres e-mail.',
+    privacy:
+      'Wysłanie pierwszego pytania jako gość ustawia plik cookie gościa. Pytania i odpowiedzi gościa przechowujemy na naszych serwerach do 7 dni, a następnie usuwamy w ciągu około 24 godzin. Aby odpowiedzieć, pytanie trafia do dostawcy AI (OpenAI), a słowa wyszukiwania do serwisów informacyjnych. Logowanie udostępnia tylko Twój adres e-mail.',
```

**P-3: `frontend/src/lib/ask/askR2Strings.ts`, D5 (if C-1 is not adopted)**
```diff
@@ en guest
-      'You’ve used your 3 guest questions. Sign in to continue this conversation and keep your answers.',
+      'You’ve used your 3 guest questions. Sign in to continue: your guest conversations from this browser move to your account.',
@@ pl guest
-      'Wykorzystano 3 pytania gościa. Zaloguj się, aby kontynuować tę rozmowę i zachować odpowiedzi.',
+      'Wykorzystano 3 pytania gościa. Zaloguj się, aby kontynuować: rozmowy gościa z tej przeglądarki zostaną przeniesione na Twoje konto.',
```
The PL literal is asserted in `frontend/src/components/ask-frame/askGuestTrial.spec.ts:377`
(not protected). Update it in the same commit.

**P-1: `frontend/src/components/ask-frame/AskFrameScreen.tsx`, Part B mount points**
1. Replace the `data-ask="guest-intro"` block (currently `{guestMode && (<div data-ask="guest-intro" …>{g.intro}…{g.privacy}</div>)}`) with
   `{guestMode && <GuestTrialNotice status={r2.guest} locale={sevenLocale} />}`. Keep `data-ask="guest-intro"` on the root element of the new component so the existing selectors hold.
2. Replace the `data-ask="privacy-links"` paragraph with `<PreLoginDataNotice signedIn={r2.guest?.signedIn === true} locale={sevenLocale} />`. Keep the two hrefs `/privacy` and `/cookies`.
3. Render `<GuestQuotaBadge status={r2.guest} … />` where `guestRemaining` is rendered today. Keep `guestRemaining` as the badge's fallback.
4. In the exhausted card, render `<SignInBoundaryCard …/>` with `continueAction` → `guestSignInHref()` unchanged.

**P-4: `frontend/src/components/ask-nav/AskNavShell.tsx`.** Next to `signInEntry`, when the
caller passes `guestSessionLive`, render `<GuestLeftBehindNote/>` (T3). It sends no network request.

**P-5: `frontend/src/lib/api/askV2Api.ts`.** Add
`readonly policy?: { readonly allowance: number; readonly sessionLifetimeH: number; readonly purgeGraceH: number }`
to `AskGuestStatus`, and `guestForget() { return call<{ readonly forgotten: true }>('/ask-v2/guest/forget', 'POST', {}, GUEST_FIRST_WRITE); }`,
the same `call(…, GUEST_FIRST_WRITE)` pattern `guestClaim` uses (`call` goes through `accountFetch`, which adds the CSRF header).

No backend protected file needs changing for Part A or Part B. `ask-v2.service.ts` is untouched:
`forget` and `policy` live in the non-protected guest controller and service.

---

## 7. Changed-file manifest

| File | Change |
|---|---|
| `backend/src/modules/ask-v2/guest/ask-v2-guest.isolation.t5.postgres.spec.ts` | **new**: I1–I9 live isolation suite (skipped without `ASK_V2_TEST_DATABASE_URL`) |
| `frontend/src/lib/privacy/storageInventory.ts` | D1 fix: language cookie and localStorage `data` names all 7 display locales (en + pl text) |
| `frontend/src/lib/privacy/storageInventoryLanguageValues.t5.spec.ts` | **new**: pins D1 against `DISPLAY_LOCALES` |
| `docs/convergence/stage2/T5-CONSENT-GUEST-TRIAL.md` | **new**: this dossier |

No protected path touched. No default changed. No runtime flag or setting touched.

---

## 8. Qualification

**Builds.** The backend build (`npm run build`, nest + runtime-data verification) passed. The
frontend build (`next build`) passed. The two were run one after the other, never together.

**Live guest group on PostgreSQL 16** (a disposable loopback cluster, 36 migrations, opt-in URL):
`ask-v2/guest/*` + `auth.guest-continuation` + `ask-r2-guest-meter-parity` + `data-retention`:
**11 suites, 177 tests, all pass.** That includes the new T5 suite (10/10) and the R3 suites (G1–G10,
continuation, continuity).

**Full backend jest** (`t5-be.json`, no test DB URL, so `*.postgres.spec.ts` skipped exactly as in
the baseline) compared with `stage0/r4-be.json` (same base):

| | baseline r4 | T5 |
|---|---|---|
| suites total / failed / pending | 439 / 10 / 37 | 440 / 12 / 38 |
| tests total / failed / passed / pending | 11868 / 33 / 11385 / 450 | 11870 / 34 / 11376 / 460 |

Failure set: **0 baseline failures fixed, and 2 extra entries, both environmental.** Each passes when
re-run on its own (`npx jest <both>`: 2 suites, 26 tests pass):
- `src/modules/analysis/config/analysis-config.service.spec.ts`: suite failed to run because "A jest worker process … was terminated … signal=SIGKILL" (memory pressure on the shared container; no T5 code is involved).
- `src/modules/official-data/pdf/pdf-decompression-bounds.spec.ts › A-3 …`: a wall-clock bound `expect(ms).toBeLessThan(100)` received 2216 ms under load.

Excluding those two non-reproducing environmental entries, the failure set is **identical** to the
baseline. The +1 suite and +10 pending tests are the new opt-in T5 Postgres suite (skipped without a
database). The other count differences come from the SIGKILLed suite's tests not running.

**Full frontend jest** (`t5-fe.json`) compared with `stage0/r4-fe.json`: suites 381 (+1, the new
spec), tests 8301 (+8), failed 21 against 21, runtime-error suites 3 against 3. **The failure set is
identical** (no new failures, none fixed).

Commit: see `git log` on `claude/stage2-t5-consent-guest-trial` (this dossier is in that commit).

---

# Part B: pre-login consent, privacy and guest-trial UI

Branch `claude/stage2-t5b-consent-ui`. Exact base: `c3754bdd` (tip of
`claude/stage2-t2-global-language-foundation`, which sits on H final `266007c`) plus the
cherry-picked Part A commit `638300f3` (originally `ef0e8b95`). Part B builds the UI on the T2
display-locale authority. It does not add a second locale mechanism.

Runtime rules kept: the Alpha guest trial stays **OFF**, because no default changed (no flag,
switch, setting or `RETENTION_SWEEP_ENABLED` was touched). No provider or AI call was added.
There is still no consent banner and no "Accept all" (Part A §4.1). All new and changed legal
copy is **PENDING_PO_LEGAL_APPROVAL**. Engineering wrote drafts in en and pl only, with no
machine translation. fr, de, es, pt and ar render through the T2 declared-fallback rule.

## B1. Backend (non-protected `backend/src/modules/ask-v2/guest/`)

### `GET /ask-v2/guest/status`: new fields

| Field | Value | Notes |
|---|---|---|
| `policy.allowance` | `GUEST_ANSWER_ALLOWANCE` (3, a constant) | in every non-signed-in response |
| `policy.sessionLifetimeH` | resolved `ASK_GUEST_SESSION_LIFETIME_H` (default 168, cap 168) | out-of-range values fall back to the default, same as the runtime |
| `policy.purgeGraceH` | resolved `ASK_GUEST_PURGE_GRACE_H` (default 24, range 1–72) | closes D3/D4: copy renders the configured value |
| `policy.sweepIntervalS` | resolved `ASK_GUEST_SWEEP_INTERVAL_S` (default 900) | deletion can lag `purgeAfter` by one tick |
| `session.purgeAfter` | `expiresAt + purgeGraceH` | live guest only: when the always-on sweep may delete it |

The existing fields `allowance`, `remaining`, `committed` (= answers used), `reserved`, `state`
and `cooldownUntil` are unchanged. A signed-in reader still gets exactly
`{signedIn:true, available:false}`. `status` still mints nothing and sets no cookie (F1, I9).
None of the abuse or spending limits are exposed.

### `POST /ask-v2/guest/forget` (new)

| Property | Behaviour |
|---|---|
| Gate | `AskV2EnabledGuard`, like every guest route, so with Ask V2 off it returns 404 (F7). It is **not** gated by the K-4 guest switch, because the switch gates new work only and a guest must be able to delete what it already has while the trial is off (F7). |
| Request guard (`GuestForgetGuard`) | Requires the same `Origin`, plus `X-Requested-With: globalnews-ask` (a cross-site form cannot send it). A signed-in browser gets 409 `SIGNED_IN_USE_ACCOUNT`, so account data is never in reach (F5). |
| CSRF | When a guest token is presented, the `x-csrf-token` header must equal the `gna_csrf` cookie **and** be the HMAC bound to *this* guest token. Another guest's value returns 403 (F4). |
| Effect | `GuestSessionService.forget(tokenHash)`, one Serializable transaction. If the session is ACTIVE (including expired but not yet purged), it is deleted, cascading exactly as the sweep does: threads, turns, operations, stored results, slots and claims (F2, F8). It then clears `gna_guest` and `gna_csrf` (`__Host-` names on https). Response: `{forgotten:true, deleted:true}`. |
| Idempotent | With no cookie, a dead token, or a CLAIMED session, it returns `{forgotten:true, deleted:false}` with 200 and deletes nothing (F3). A malformed leftover `gna_guest` is cleared. |
| Claimed conversations | Never deleted. Claimed rows have `guestSessionId = null` and belong to the account. A CLAIMED session is left for the sweep (F5). |
| In progress | A RESERVED slot gets 409 `GUEST_ANSWER_IN_PROGRESS`. Nothing is deleted and no cookie is cleared (F6). This matches the claim rule. |
| Shared bounds | `guestiss:`, `guestexec:` and `guestpool` meter rows are **not** refunded, so delete-and-retry cannot bypass the per-network or pool bounds (F2). The per-session `guest:<id>` and `conc:guest:<id>` count rows are left as the sweep leaves them (Part A observation, P2). |

### Tests

- `ask-v2-guest.forget.t5b.postgres.spec.ts`, **new**, F1–F8, live and opt-in like the R3 and T5 suites:
  - F1 `policy` at defaults and overrides; `purgeAfter`; status mints nothing.
  - F2 forget deletes only the caller's rows, across all threads plus a pending claim; guest B is untouched and still reads its own; the old token gives 401; both cookies are cleared; shared meter rows are byte-identical.
  - F3 idempotent.
  - F4 Origin, X-Requested-With and bound CSRF are each required.
  - F5 claimed-to-account rows survive; a signed-in browser gets 409.
  - F6 in progress gives 409.
  - F7 Ask V2 off gives 404; with the switch off, forget still deletes.
  - F8 the sweep agrees.
- `ask-v2-guest.forget.t5b.spec.ts`, **new**, DB-free handler pins (10 tests). These run in every full jest run.
- Live run: a disposable PostgreSQL 16 cluster under `/var/lib/postgresql/t5b-pg` (port 55436), 36 migrations via `prisma migrate deploy`. Guest group: `ask-v2/guest/*` + `auth.guest-continuation` + `ask-r2-guest-meter-parity` + `data-retention`. **12 suites, 185 tests, all pass.** That includes F1–F8, Part A I1–I9 and R3 G1–G10. The cluster was stopped and deleted afterwards.

## B2. Frontend UI (non-protected)

| Item | File | What it does |
|---|---|---|
| Catalogue `consent` | `frontend/src/lib/consent/consentStrings.ts` | 26 keys, en and pl drafts. `CONSENT_KEY_STATES` marks every key `PENDING_PO_LEGAL_APPROVAL`. Numbers are `{placeholders}` filled from `status.policy` / `session`. Before status is known, they are filled from `GUEST_POLICY_BOUNDS` (3 / 168 h / 72 h, the hard code ceilings), and the sentences are worded "at most / within" so they hold for every valid configuration. `LEGAL_COPY_PENDING_APPROVAL` lists the changed Privacy sentences (B3). |
| T2 registration | `qualification/i18n/catalogueCoverage.ts`, `surfaceCoverage.ts` | `consent` is a measured module namespace. It is added to the platform chrome (the Footer label), `privacy` and `cookies`. Manifest regenerated with `scripts/i18n/t2-reconcile-catalogues.cjs`: fr–ar pending keys go from 3525 to 3551 (+26) and namespaces from 60 to 61. **`surfaceRenderable.generated.ts` is unchanged**: no surface changed state (Ask surfaces stay FULL in all seven; Privacy and Cookies stay FULL en/pl and DECLARED_FALLBACK fr–ar). The T2 dossier's §2 per-surface gap counts are now +26 for platform-chrome surfaces. Its table is not edited here; the manifest is authoritative. |
| Guest data section | `components/consent/GuestDataSection.tsx` | "Your guest data", the measured contract: {allowance} answers, and a question we cannot answer does not count. Both guest cookies are set on the first guest question only, last at most {lifetimeDays} days, and are never extended. Data is stored **on our servers** until the session ends, then deleted by the always-on guest clean-up within about {purgeGraceH} h; this does not depend on any other setting. "Sign in to continue" moves **all** guest conversations from this browser. A plain sign-in moves none, and they reappear after sign-out on a shared device. How to delete now. Then a live panel: one `GET /ask-v2/guest/status` on mount, which never mints. It shows one of loading, unavailable (404 or network), signed-in (no guest controls), none, or active (expiry date, purge date, quota badge, delete action). |
| Delete control | `components/consent/GuestForgetControl.tsx` | "Delete my guest data now", then an inline confirmation, then **one** POST. Outcomes: done, nothing, busy (409 `GUEST_ANSWER_IN_PROGRESS`, nothing changed) or failed. No modal and no pre-checked box. Takes `locale` and an injectable client, so the Ask composer can import it (P-1). |
| Quota badge | `components/consent/GuestQuotaBadge.tsx` | "N of {allowance} guest answers left", "All {allowance} used", or "paused until …". Server mirror only, no client counter. Renders nothing without a live guest session. |
| Client | `frontend/src/lib/api/guestPrivacyApi.ts` | `status()` and `forget()` over `accountFetch` (CSRF header), with forget adding `X-Requested-With`. 404 → `UNAVAILABLE`, typed refusal → `REFUSED`+`code`, thrown → `NETWORK`. The protected `askV2Api.ts` is untouched. |
| `/privacy` | `app/privacy/page.tsx` | Mounts `GuestDataSection` with `effectiveWithin(surfaceLocale('privacy'), ['en','pl'])` (the T2 authority). The Cookies link label uses the same effective locale. |
| `/cookies` | `app/cookies/page.tsx` | Mounts `GuestDataSection` with the page's existing T2 effective locale (`effectiveWithin(surfaceLocale('cookies'), ['en','pl'])`). |
| Footer | `lib/homeContent.ts`, `components/layout/Footer.tsx` | `/cookies` added to the Legal links (D10). Its label comes from `consentFooterLinkLabels`, merged under `t.linkLabels`, **not** from a `dict.footer.linkLabels` key. Reason: `dict.footer` is projected into H's protected Ask-shell catalogue (`askShellSource.ts`), so a new key would make the protected fr–ar Ask catalogues incomplete and break H's manifest equality. Tripwires updated: `footerGeometry.spec.ts` (6 destinations, `/cookies` real route, label source, link-row budget) and `footerNavHud.spec.ts` (exact href set, labels in en/pl). |

Declared fallback: in fr, de, es, pt and ar, the `consent`, `dict:privacyPage` and `cookiesPage`
namespaces have no approved copy. The whole Privacy or Cookies surface therefore renders English,
and the root layout shows `DisplayLocaleNotice` in the reader's language (T2 §1.3). Arabic gets
the notice with its own `dir`. This is pinned by `guestConsent.t5b.spec.ts`. The fr–ar Ask
surfaces do not mount these components.

## B3. Legal sentences pending Product Owner / legal approval

Every value below is a draft, marked in source (`/* T5 Part B — PENDING_PO_LEGAL_APPROVAL */`)
and in `LEGAL_COPY_PENDING_APPROVAL` / `CONSENT_KEY_STATES`.

| # | Catalogue / key | Change |
|---|---|---|
| L1 | `privacyPage.lastUpdatedDate` (en, pl) | 3 → **4 October 2026** (the text changed) |
| L2 | `privacyPage.sections["Using Ask without an account"].body` | D6: "guest conversations", not "one guest conversation". At most 7 days, never extended, deleted automatically (pointer to "Your guest data"). D8: the claim moves **all** of this browser's guest conversations; another sign-in moves none, and they stay visible after sign-out. Network identifiers: deletion now points to the retention paragraph (it depends on `RETENTION_SWEEP_ENABLED`), replacing the unconditional "deleted within about a week" |
| L3 | `privacyPage.sections["Your choices"].body` | Adds the guest delete action |
| L4 | `privacyPage.sections["How long information is kept"].body` | **D2.** Guaranteed without any switch: guest conversations (always-on guest sweep, or immediate forget), Ask diagnostics 30 days (their own opportunistic clean-up, `AskObservationRetentionService`, not gated), sign-in sessions expire after 30 days. Stated as **target policy applied by a separate scheduled clean-up that is off unless switched on operationally; while off, not deleted automatically**: account conversations 12 months (account deletion always deletes them), support 24 months, usage/compute 90 days, guest limit identifiers about a week |
| L5 | `consent.*` (26 keys, en + pl) | New: guest section, panel, quota, forget control, footer label |

Removed claims: "Guest limit identifiers: about a week" as an unconditional promise, "Detailed
usage and compute records: 90 days" as an unconditional promise, and the same for account
conversations and support messages. Each is now conditional on the retention sweep. No new legal
claim was invented. Every sentence restates measured code behaviour (§1.1, `retention-policy.ts`,
`ask-observation-retention.service.ts`).

## B4. Protected-file specs (updated, not applied)

Re-checked at `c3754bdd`: `AskFrameScreen.tsx`, `askV2Api.ts`, `askR2Strings.ts` and
`AskNavShell.tsx` have **no CR** at base (`git show c3754bdd:<path> | grep -c $'\r'` = 0), so
these specs apply as plain LF edits.

**P-1 (`frontend/src/components/ask-frame/AskFrameScreen.tsx`, H+R4), revised for the Part B components that exist now:**
1. Replace the `data-ask="guest-intro"` block with the **text** of `GuestDataSection` for guests.
   The section is page-sized, so do not mount it whole. Render the keys
   `consent.guest.questions` and `consent.guest.storage`, filled with `fillConsent(…, { allowance,
   lifetimeDays, purgeGraceH })` from `r2.guest.policy` (P-5), with `GUEST_POLICY_BOUNDS` as the
   fallback, plus links to `/privacy#guest-data` and `/cookies#guest-data`. Keep
   `data-ask="guest-intro"` on the root.
2. Keep the `data-ask="privacy-links"` paragraph and its hrefs `/privacy` and `/cookies`. Add `#guest-data` to the Privacy href when `guestMode`.
3. Where `guestRemaining` is rendered, render
   `<GuestQuotaBadge status={r2.guest} locale={effectiveConsentLocale} />` from
   `@/components/consent/GuestQuotaBadge`. `effectiveConsentLocale` = `sevenLocale` when it is
   `en` or `pl`. Otherwise keep the existing `guestRemaining` string, because the `consent`
   catalogue has no fr–ar copy and the Ask surface is FULL in seven. Never show English consent
   copy on a French Ask page.
4. In the composer footer, for a guest with a live session, render
   `<GuestForgetControl locale={effectiveConsentLocale} onForgotten={() => r2.resetGuest()} />`
   from `@/components/consent/GuestForgetControl` (en/pl only, same rule as above). After
   `deleted:true` the conversation view must drop the guest thread. `useAskR2Conversation`
   (non-protected) needs a `resetGuest()` that re-reads `status` once.
5. Exhausted card: body becomes `consent.boundary.moves`-equivalent wording (P-3). `continueAction` → `guestSignInHref()` unchanged.

**P-2 / P-3 (`frontend/src/lib/ask/askR2Strings.ts`, H+R4).** Unchanged from Part A §6. In P-2,
instead of hard-coding "7 days … 24 hours", prefer interpolating `{lifetimeDays}` and `{purgeGraceH}`
from `status.policy`. If the H catalogue cannot interpolate, keep Part A's literal diff, which is
true at defaults. The PL literal in `askGuestTrial.spec.ts:377` changes with P-3.

**P-4 (`frontend/src/components/ask-nav/AskNavShell.tsx`, H+R4).** Next to `signInEntry`, when
the caller passes `guestSessionLive`, render a one-line note using the en/pl key
`consent.guest.plainSignIn`, linking to `/privacy#guest-data`, where the delete action now
exists. With fr–ar there is no note until approved copy lands, which is a P1 gap. It sends no request.

**P-5 (`frontend/src/lib/api/askV2Api.ts`, H+R4), revised.** Add to `AskGuestStatus`:
```ts
readonly policy?: { readonly allowance: number; readonly sessionLifetimeH: number; readonly purgeGraceH: number; readonly sweepIntervalS: number };
readonly session?: { readonly expiresAt: string; readonly purgeAfter?: string } | null;
```
No `guestForget()` is needed in `askV2Api.ts` any more. The non-protected
`lib/api/guestPrivacyApi.ts` (`guestPrivacyApi.forget()`) is the client, and `GuestForgetControl`
uses it. The type addition is optional: `GuestPrivacyStatus` in `guestPrivacyApi.ts` already
types the same payload.

Backend: no protected backend file was needed. `ask-v2.service.ts` is untouched.

## B5. Changed-file manifest (Part B, against `638300f3`)

| File | Change |
|---|---|
| `backend/src/modules/ask-v2/guest/ask-v2-guest.controller.ts` | `status.policy`, `session.purgeAfter`; `POST forget` |
| `backend/src/modules/ask-v2/guest/guest-session.service.ts` | `policy()`, `purgeAfter()`, `forget()`, `clearGuestCookies()` |
| `backend/src/modules/ask-v2/guest/guest.guards.ts` | `GuestForgetGuard` |
| `backend/src/modules/ask-v2/guest/ask-v2-guest.forget.t5b.postgres.spec.ts` | **new**, F1–F8 (opt-in live) |
| `backend/src/modules/ask-v2/guest/ask-v2-guest.forget.t5b.spec.ts` | **new**, DB-free handler pins |
| `frontend/src/lib/consent/consentStrings.ts` | **new**, `consent` catalogue + approval metadata |
| `frontend/src/lib/api/guestPrivacyApi.ts` | **new**, guest privacy client |
| `frontend/src/components/consent/GuestDataSection.tsx`, `GuestForgetControl.tsx`, `GuestQuotaBadge.tsx` | **new** |
| `frontend/src/components/consent/guestConsent.t5b.spec.ts` | **new**, 23 tests |
| `frontend/src/app/privacy/page.tsx`, `frontend/src/app/cookies/page.tsx` | mount the guest section (T2 effective locale) |
| `frontend/src/lib/i18n/dictionaries/en.ts`, `pl.ts` | Privacy L1–L4 |
| `frontend/src/lib/i18n/dictionaries/index.spec.ts` | Privacy date pin (CRLF kept) |
| `frontend/src/lib/homeContent.ts`, `frontend/src/components/layout/Footer.tsx` | `/cookies` footer link (Footer.tsx CRLF kept) |
| `frontend/src/components/layout/footerGeometry.spec.ts`, `frontend/src/components/navigation/footerNavHud.spec.ts` | tripwires (footerNavHud CRLF kept) |
| `frontend/src/qualification/i18n/catalogueCoverage.ts`, `surfaceCoverage.ts` | `consent` namespace |
| `docs/convergence/stage2/t2/translation-manifest.json`, `reconciliation-summary.json` | regenerated |
| `docs/convergence/stage2/T5-CONSENT-GUEST-TRIAL.md` | this section |

CRLF: three changed files carry CR at base: `Footer.tsx` (246 CR), `footerNavHud.spec.ts` (292)
and `index.spec.ts` (803). Their edits were made with CRLF line endings, and they were staged with
`git hash-object -w --no-filters` + `git update-index --cacheinfo`. `HEAD:<path>` equals the
unfiltered working file. Protected paths touched: **none**, checked against `protected-files.tsv`
column 2.

## B6. Qualification

All runs on this worktree, one after another, never two at once.

| Step | Result |
|---|---|
| `npm run build:shared` | pass |
| `npm run build:backend` | pass |
| `npm run build:frontend` (`next build`) | pass. Only the 2 `react-hooks/exhaustive-deps` warnings in map files, which also appear at T2 |
| Live guest group (PostgreSQL 16, opt-in) | 12 suites, 185 tests, all pass (B1) |
| Focused frontend (`guestConsent.t5b.spec.ts`) | 23/23 |
| Focused backend (`ask-v2-guest.forget.t5b.spec.ts`) | 10/10 |

**Full frontend jest** (`scratchpad/t5b-fe.json`) compared with the T2 tip (`scratchpad/t2-fe.json`):
- Suites 393 (T2: 391). The +2 are the Part A `storageInventoryLanguageValues.t5.spec.ts` and the Part B `guestConsent.t5b.spec.ts`.
- Tests 9167 (T2: 9130): 9131 passed, 23 failed, 13 pending.
- **Failure set identical: 0 new, 0 fixed.** That includes the known `lib/ask/askSevenLanguage.spec.ts` "H-4 · Arabic RTL …", where H must apply SPEC-T2-H-3.
- The same 3 suites fail to run as at T2: `askDockGeography`, `marketSyntheticHarness` and `mktRetained`.

**Full backend jest** (`scratchpad/t5b-be.json`, no test DB URL, so `*.postgres.spec.ts` are
skipped as in the baseline) compared with the T2 tip (`scratchpad/t2-be.json`, post-change, present):
- Suites 444 (T2: 441). The +3 are the Part A isolation spec and the Part B forget specs, live and unit.
- Tests 11952 (T2: 11924): 11451 passed, 33 failed, 468 pending.
- **Failure set identical: 0 new, 0 fixed**, and no suite failed to run.
- No suite was OOM-killed in this run.

## B7. Remaining gaps against the PO requirement

| # | Gap | Class | Owner / next step |
|---|---|---|---|
| G1 | fr/de/es/pt/ar have no approved copy for `consent`, `privacyPage` or `cookiesPage`. Those readers see English Privacy and Cookies pages with the declared fallback notice. That is truthful, but it is not localized | **P0** for Public Beta (D9) | Claude L / legal translation from `translation-manifest.json` (namespace `consent` +26 keys) |
| G2 | Every new and changed legal sentence (L1–L5) is a draft | **P0** | PO / legal approval, then drop the PENDING markers |
| G3 | The retention periods in L4 depend on `RETENTION_SWEEP_ENABLED` (default OFF). The copy is now truthful either way, but the promised periods are not enforced until the sweep is on | **P0** operational | PO/CTO: enable the sweep in Production, or approve the qualified wording |
| G4 | The Ask composer (protected) does not yet mount the quota badge, the delete control or the T3 plain-sign-in note | P1 | H: apply P-1, P-4 and P-5 (B4). For fr–ar, keep the existing H strings until approved consent copy exists |
| G5 | Exhausted-card wording understates what moves (D5) | P1 | H: P-3 |
| G6 | `useAskR2Conversation` has no `resetGuest()` for the P-1 delete flow | P1 | non-protected, lands with P-1 |
| G7 | A stale RESERVED slot (crashed worker) blocks `forget` for up to the 10-minute lease grace plus one sweep tick, returning 409 busy | P2 | acceptable. The copy says "try again in a minute" |
| G8 | `guest:<id>` and `conc:guest:<id>` count rows outlive a forgotten or purged session. They hold counts only, keyed by a deleted UUID | P2 | sweep follow-up (Part A observation) |
| G9 | `/cookies` does not show the `__Host-` wire names (D7) | P2 | inventory text follow-up |
| G10 | Guest trial runtime OFF on Alpha, by decision | n/a (not a defect) | PO/CTO enablement manifest (Part A §5) |

Commits: see `git log` on `claude/stage2-t5b-consent-ui` (backend, frontend and this dossier).
