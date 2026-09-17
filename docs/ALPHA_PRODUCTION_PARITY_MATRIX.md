# Phase 2.1 — Alpha ↔ Production Parity Matrix

## The baseline ruling, and what it changed

The CTO ruling for this phase is explicit: **do not use local `main` as the
Production proxy.** That ruling is load-bearing, and following it overturned a
conclusion reached without it — see *Correction* at the end.

### Three source layers, all provable

| layer | what | identity | evidence |
| ----- | ---- | -------- | -------- |
| **L1** | **Governed Production source baseline — C911-V1** | commit `fc162e2`, tree `64f42a52` | 1086 entries verified against `SHA256-MANIFEST-C911-V1-full-tree.txt` (1086/1086 OK), recovered in Phase 0 |
| **L2** | **Deployed Alpha candidate** | commit `2c4b6ce`, tree `654be554` | 1087/1087 files byte-identical, recovered under DOMAIN-1 |
| **L3** | This convergence candidate | branch `convergence/alpha-r1` | L2 + Phase 1 corrections |

`git merge-base fc162e2 2c4b6ce` returns **`fc162e2`**, so **L2 descends directly
from L1**. The comparison is exact rather than inferred.

### Live runtime

| | |
| --- | --- |
| Railway frontend deployment | `d1d564d3-3416-454e-8963-2216c9f30d32` |
| Railway backend deployment | `241e7157-7fec-47a6-b2d5-e3ca0d4d84c0` |
| **Live deployment commit** | **UNVERIFIED** |

Railway exposes no commit hash for these deployments. **No Git ref is
manufactured for them.** Every row below separates *source evidence* from
*live-runtime evidence*, and no row claims runtime knowledge that was not
measured.

---

## The headline finding

**L1 → L2 is two files.**

```
git diff --stat fc162e2 2c4b6ce
  backend/src/modules/news/news.service.ts                +236 -2
  backend/src/modules/news/news.service.home-cache.spec.ts  +726
  2 files changed, 960 insertions(+), 2 deletions(-)
```

Everything else in the deployed Alpha candidate is **byte-identical** to the
governed Production source baseline.

So at source level the Alpha/Production divergence that is perceived in the
product is **not in the source at all**, with the single exception of the home
cache. What differs is **environment and configuration** — provider credentials,
provider enablement, and the map-shell flag — plus whatever the unverified live
Production deployment actually contains.

That is the most important result in this phase, and it reframes every row below.

---

## Matrix

**Classification key:** SAME · ALPHA ONLY · PRODUCTION ONLY · INTENTIONAL
DIFFERENCE · REGRESSION · IMPLEMENTED BUT HIDDEN · NOT IMPLEMENTED · UNKNOWN

"Source" compares **L1 vs L2**. "Runtime" states what was actually measured;
`UNKNOWN` there is an honest report, not a gap in effort — Production was not
touched, by ruling.

| # | capability | source (L1 vs L2) | runtime | notes |
|---|-----------|-------------------|---------|-------|
| 1 | Home / Public Today | **SAME** | UNKNOWN | outside the two-file delta |
| 2 | Home feed **cache** | **ALPHA ONLY** | UNKNOWN | the whole of the L1→L2 delta; `news.service.ts` +236/−2 with a 726-line spec |
| 3 | Map / Spatial shell | **SAME** | UNKNOWN | gated at runtime by `NEXT_PUBLIC_MAP_SHELL` — a config difference, not a source one |
| 4 | Geography hierarchy / selection | **SAME** | UNKNOWN | `/geo/search` navigator present in both |
| 5 | Region highlighting / extents | **SAME** | UNKNOWN | RSC-1 region selection present in both |
| 6 | Search / Kigali identity | **SAME** | UNKNOWN | the G defects existed in **both** — see below |
| 7 | EN / PL | **SAME** | UNKNOWN | both dictionaries in both layers |
| 8 | Support | **SAME** | UNKNOWN | 7 categories, 1 analysis-eligible, in both |
| 9 | OAuth / auth | **SAME** | UNKNOWN | allowlist + HMAC flow-state in both |
| 10 | Ask AI | **SAME** | UNKNOWN | **corrected** — `components/ask/` is present in L1 |
| 11 | Analysis | **SAME** | UNKNOWN | one client, one route, one service |
| 12 | Complete Analysis Record | **SAME** | UNKNOWN | reuses the accepted components in both |
| 13 | Sources | **SAME** | UNKNOWN | |
| 14 | Watch | **NOT IMPLEMENTED** (both) | n/a | `WATCH_RUNTIME_ACTIVE = false`; no `WatchModule`, no scheduler, no route |
| 15 | Follow | **SAME** | UNKNOWN | `FollowsModule` registered, 1 controller — the one shipped relationship |
| 16 | Admin | **SAME** | UNKNOWN | 9 admin areas in both; RBAC unchanged |
| 17 | PWA | **SAME** | UNKNOWN | `public/sw.js` + `pwaContract.spec.ts` in both |
| 18 | SEO | **SAME** | UNKNOWN | `robots.ts`, `sitemap.ts`, `buildPageMetadata` in both |
| 19 | GNews | **SAME** (source) / **INTENTIONAL DIFFERENCE** (config) | UNKNOWN | separate credentials per environment — preserved, not changed |
| 20 | RSS | **SAME** | UNKNOWN | `RssFeedProvider`, 7 curated feed sources, env-gated by `isRssFeedsEnabled` |
| 21 | GDELT | **SAME** (source) / **INTENTIONAL DIFFERENCE** (config) | UNKNOWN | `GdeltDocProvider` present in both; Alpha enabled, Production historically not — preserved |
| 22 | Feature flags | **SAME** | UNKNOWN | `NEXT_PUBLIC_MAP_SHELL`, `WATCH_RUNTIME_ACTIVE` |
| 23 | Specialist-dashboard entry points | **NOT IMPLEMENTED** (both) | n/a | `registerSpecialistDomain()` is never called |
| 24 | Implemented-but-hidden capabilities | **SAME** | UNKNOWN | see the capability tree |

### Rows that deserve their sentence

**#2 — the home cache is the entire Alpha delta.** Everything the Alpha
candidate has that the governed baseline does not is in those two files. Any
statement of the form "Alpha has X and Production does not" is false for every X
except this one, *at source level*.

**#6 — the Kigali defects were never Alpha-only.** The three-row search result,
the `region:kigali` mis-typing and the unconditional selection clearing all exist
in L1 as well as L2, because the files are identical. Checkpoint G's corrections
therefore fix the governed Production baseline too, and are not Alpha-only repairs.

**#14 — Watch is absent at runtime in both.** `WATCH_RUNTIME_ACTIVE = false` and
`app.module.ts` states it directly: *"nothing here reaches Watch: no WatchModule,
no scheduler, no route."* The rail's watchboard icon is withheld rather than
greyed. This is NOT IMPLEMENTED, not a difference.

**#19 / #21 — the two intentional provider differences are configuration.** Both
providers exist in both source layers. Alpha and Production hold separate GNews
credentials; Alpha has GDELT enabled and Production historically does not. Both
are **preserved unchanged**, per the standing ruling.

**#23 — the specialist registry has no registrations.** `SpecialistDomainId` is
`'CONFLICT' | 'ELECTION' | 'DELIVERY'`, and `registerSpecialistDomain()` is
called from nowhere in the product. The platform layer exists; no domain occupies
it.

---

## Correction

Checkpoint M originally classified the **Ask AI dock** and the **SourceCard ask
action** as `ALPHA-ONLY UNPROMOTED`, comparing against local `main`.

**That comparison was wrong, and the ruling is the reason it was caught.** `main`
(`41428ea`) is a different lineage with no `components/ask/` directory at all, so
comparing against it manufactured differences that do not exist.

Measured against the governed baseline:

- `components/ask/` — **all six files present in C911-V1**, and `AskAiDock` is
  mounted in its `app/layout.tsx`. → **SAME**, not Alpha-only.
- `askAiShort` — absent from **both** L1 and L2. It was added by **Checkpoint D
  on this convergence branch**, so it is a convergence addition and not an
  Alpha/Production parity difference at all.

The conclusion that nothing needs restoring survives, and is now better
supported: the Ask AI entry controls are the *same source* in both, so no button
was lost in either direction and none was ever Alpha-only.

The Checkpoint M spec has been corrected in place rather than left to disagree
with this matrix.
