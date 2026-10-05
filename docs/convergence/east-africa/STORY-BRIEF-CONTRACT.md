# Canonical Story Brief: backend/data contract (EA-STORY-BRIEF-01)

Status: **R1 implemented dark** (persistence, state machine, dedup, zero-compute reopen, stale detection, Discussion anchoring, endpoints behind a default-OFF gate). **Generation binding is BLOCKED on spend authority** (see §8). Base: `integration/r4-east-africa-convergence-r1`.

## 1. Inventory (read before designing; facts with file refs)

| Existing artifact | What it is | Why it is NOT the Story Brief |
|---|---|---|
| `Story` (schema `Story`) | Canonical cluster id, alias redirect (`status MERGED`, `mergedIntoId`, depth ≤ 16), `briefVersion` | Has no content column. `briefVersion` is the **alert dedup key** (`StoryAlertEvent @@unique([alertId, briefVersion])`) and a Discussion continuity stamp. It rises only on a **new source host** (`bringsNewEvidence`, story-identity.rules.ts:37-40) or **unconditionally on merge**. A same-publisher update does not raise it. Its meaning is not changed here. |
| `StoryArticle` / `StoryIdentityEvent` | Membership (`articleRef` unique) and identity audit (CREATE/JOIN/MERGE/SPLIT/VERSION) | Evidence-set source for the Brief (§3), not a Brief |
| Ask `Briefing` / `BriefingVersion` | **Private**, per-user, append-only saved Ask answers (`userId` scoped, 404 for others) | User-owned and private. Overloading it into a shared Story cache is forbidden. |
| `StoredResult` | Per-owner (user or guest) expiring Ask result cache keyed by request fingerprint | Owner-scoped and expiring. Story context is keyed by articleRef, not canonical storyId. |
| `ComputeOperation` / ledger / meter | Governed compute: quote → accept → reserve → execute, budgets (`BUDGET_*`), provider failures (`MODEL_*`) | The only governed way to spend. A Brief generation must go through it (§8). |
| `StoryComment` | Discussion on the canonical story, stamped with `briefVersion` (continuity) | Gains an optional link to the Brief **version** it was written against (§6). Never evidence. |
| No `/stories/:id` brief endpoint, no `StoryBrief` symbol, frontend "Not available — no brief is held for this story." | — | Confirms the gap (H0 finding) |

## 2. Model (migration `20261006100000_story_brief_r1`, additive only)

**`StoryBriefVersion`** is immutable and append-only (a DB trigger refuses UPDATE and DELETE):
- `storyId` (canonical, FK Restrict), `version` (≥ 1, `@@unique([storyId, version])`)
- `evidenceRevision` (§3), `@@unique([storyId, evidenceRevision])`: **one persisted Brief per evidence revision**, so a reopen never recomputes
- `materialVersion`: the `Story.briefVersion` at generation, kept for continuity with Alerts and Discussion. It is never used as the staleness key.
- `state`: `READY | PARTIAL | INSUFFICIENT` (CHECK). Only conclusions are persisted as Brief versions.
- `blocks` (the `briefing-blocks/1` shape, including `intelligence` = `payload.intelligence` as kept by afeedc9), `evidenceRefs` (**references only**, never publisher full text), `coverageGaps`, `uncertainty`
- `asOf`, `generatedAt`, `sourceOperationId` (lineage to the governed `ComputeOperation`; plain id, no user relation, so the shared Brief carries no requester identity)

**`StoryBriefAttempt`** is one row per generation attempt (dedup claim and failure record):
- `storyId`, `evidenceRevision`, `status`: `CHECKING | DONE | FAILED` (CHECK), `failureKind`: `PROVIDER_DEGRADED | BUDGET_REFUSED | CAPABILITY_UNAVAILABLE | EXECUTION_FAILED | OUTCOME_UNKNOWN` (CHECK), `failureCode`, `operationId?`, `leaseExpiresAt`, `briefVersionId?`
- **Partial unique index**: at most one `CHECKING` row per `(storyId, evidenceRevision)`. Concurrent Read Brief / Discuss calls collapse into one attempt; the losers observe `CHECKING`.
- An expired `CHECKING` lease becomes `FAILED / OUTCOME_UNKNOWN` and is **never re-run** (same rule as Ask execute).

**`StoryComment.storyBriefVersionId?`** (FK Restrict, nullable): the Brief version on screen when the comment was written.

## 3. Evidence revision (staleness key)

`evidenceRevision = sha256('story-brief-evidence/1' + sorted articleRefs of the canonical story's alias set)`.

- Any change to the admitted evidence set changes it: a new article from a **known** publisher (a same-publisher update, which `briefVersion` ignores), a new publisher, a merge, or a split.
- Staleness is therefore an **evidence-set** fact. It does **not** claim the change is material. The contract §11 change classes (decision/status, amount/date/location, correction/retraction, corroboration, syndication) are **not** classified in R1. A stale Brief shows "the evidence set changed since this Brief", never "something material happened". Syndication and wire copies still change the set; refresh is explicit, so no compute is spent automatically.
- Host count alone is never the authority.

## 4. Read state (GET: zero compute, no spend path touched)

| Condition | State returned |
|---|---|
| No version, no attempt for the current revision | `NOT_GENERATED` (Read Brief may be offered when generation is available) |
| A live `CHECKING` attempt for the current revision | `CHECKING` (plus the latest version, if any, for inspection) |
| A version exists for the current revision | that version's `READY` / `PARTIAL` / `INSUFFICIENT` |
| The latest version's revision ≠ current revision | `STALE`: the old version stays fully inspectable, with `changedSince` |
| The latest attempt for the current revision `FAILED` and no version for it | `FAILED` with `failureKind` (e.g. `PROVIDER_DEGRADED`). **Never** `INSUFFICIENT`. If an older version exists, the state is `STALE` with `lastAttempt: FAILED` |

States are kept apart: a provider failure is not an insufficient-evidence conclusion; budget refusal is its own kind; "no evidence" is not "nothing happened".

## 5. Read Brief (POST: explicit, the only path that may start compute)

1. Resolve the canonical story (alias redirect) and compute the current `evidenceRevision`.
2. If a version exists for that revision, return it: **zero compute**.
3. Claim an attempt (`CHECKING`, lease). If one is live, return `CHECKING` (dedup).
4. Call the `StoryBriefGenerator` port with the canonical story's evidence refs only: no user text, no discussion content.
5. Outcome:
   - `READY` / `PARTIAL` / `INSUFFICIENT`: append a new immutable version (`version = max + 1`). A refresh never rewrites the old version.
   - Otherwise: the attempt becomes `FAILED` with its `failureKind`.

## 6. Discussion against a Brief version

A comment may carry `storyBriefVersionId` (validated: the version must belong to the comment's canonical story or its alias set). `briefVersion` (material continuity) is unchanged. Discussion is still never evidence: the generator port receives no discussion content (structure spec).

## 7. Privacy and ownership

The Brief is **shared and story-owned**: it has no `userId`, and the requester is never recorded on the version (the lineage is only `sourceOperationId`). Private Ask Briefings stay private and untouched. Nothing is stored in browser storage.

## 8. Generation binding: BLOCKED (spend authority)

The production generator must run through the governed Ask compute path (`ComputeOperation`: quote, consent, budgets, ledger, breaker). That is **new provider spend** on a **shared** artifact, which raises an unresolved authority question: whose budget pays for a Brief every reader then reopens free, and does a guest Read Brief spend? The implementation contract forbids new provider spend without approval.

R1 therefore ships the `StoryBriefGenerator` port with **one** production binding, `UnavailableStoryBriefGenerator`. It records `FAILED / CAPABILITY_UNAVAILABLE` and spends nothing. Design R1 can bind every state truthfully, and no surface may present Read Brief as working while the register says unavailable.

**Decision needed (CTO/PO):** the compute owner and quota for shared Story Brief generation (requesting account vs a product pool), guest eligibility, and the per-story refresh limit.

## 9. Gate

`STORY_BRIEF_ENABLED` (server literal `'true'`, default OFF). When OFF, both endpoints return 404. It is **not** an Ask spend switch, and the Ask spend path never reads it.
