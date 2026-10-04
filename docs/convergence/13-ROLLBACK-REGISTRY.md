# 13 — Rollback Registry

Read-only inventory of every release and rollback ref at measurement time (2026-10-04). Source: `stage0/workstreams.json` → `release_rollback`.

**Rule for any future promotion (contract Definition of Done #10):** promote only an exact Alpha-tested SHA, and record its rollback ref here **before** promotion.

## Current anchors

| Role | Ref | SHA | Date | Note |
|---|---|---|---|---|
| Alpha line head (measurement authority) | `release/alpha-r4-search-conversation-5513275` | `5513275f` | 2026-10-04 | deployed? **UNVERIFIED** |
| Previous Alpha release | `release/alpha-trust-r3-livefix-c7e8c03` | `c7e8c034` | 2026-10-03 | ancestor of `5513275f` (21 behind) |
| Explicit Alpha rollback | `rollback/alpha-pre-home-discussions-alerts-r1` | `58f80fd4` | 2026-10-01 | **the only `rollback/*` ref**; pre Home/Discussions/Alerts |
| Production | `release/production-c908` | `a9cf8a89` | 2026-09-14 | deployed? **UNVERIFIED**; strict ancestor of Alpha |
| `main` | `main` | `5149276f` | 2026-08-17 | stale, not on the Alpha line |
| Safety base | `safety/i3-mvp-release-base-20260821` | `0deebe57` | 2026-08-21 | historical |

## Release refs (all ancestors of `5513275f` unless marked)

| Ref | SHA | Date |
|---|---|---|
| `release/alpha-c903-final` (**not ancestor**) | `26c50c1c` | 09-12 |
| `release/alpha-c905-final` (**not ancestor**) | `0d8ab961` | 09-12 |
| `release/alpha-c907-r1-validation` (**not ancestor**) | `0d8ab961` | 09-12 |
| `release/alpha-c907-r1-frozen` | `c9473e32` | 09-13 |
| `release/alpha-c907-r2-final-static` | `3afa7435` | 09-13 |
| `release/alpha-c907-r2-lint1` | `b9ab621c` | 09-13 |
| `release/alpha-c907-r2-mobile1` | `8016dd6b` | 09-13 |
| `release/alpha-c907-r2-ask-analysis1` | `643bfdb5` | 09-13 |
| `release/alpha-c907-r2-pre-user1` | `14713b5e` | 09-14 |
| `release/alpha-c907-r2-natural-source1` | `e3e7fcb2` | 09-14 |
| `release/alpha-c907-r2-retrieval-resilience1` | `e3e7fcb2` | 09-14 |
| `release/production-c908` | `a9cf8a89` | 09-14 |
| `release/alpha-b5-previsual-1` | `7674c5d0` | 09-18 |
| `release/alpha-b5-previsual-mapquota1` | `d71bbcb4` | 09-18 |
| `release/alpha-b5-previsual-hudorigin1` | `866e8c27` | 09-18 |
| `release/alpha-b5-previsual-nonexecmap1` | `fbd37fbb` | 09-18 |
| `release/alpha-b5-previsual-zoom1` | `f36695ae` | 09-18 |
| `release/alpha-m08-integrated-r1` | `6d8b736d` | 09-30 |
| `release/ask-public-beta-r1` | `6ba220f7` | 10-01 |
| `release/alpha-home-discussions-alerts-paid-r1-candidate` | `6044c164` | 10-01 |
| `release/alpha-trust-r1-cd7abbc` | `cd7abbcb` | 10-03 |
| `release/alpha-trust-r2-c72820f` | `c72820f1` | 10-03 |
| `release/alpha-trust-r3-8f44abd` | `8f44abd8` | 10-03 |
| `release/alpha-trust-r3-livefix-c7e8c03` | `c7e8c034` | 10-03 |
| `release/alpha-r4-search-conversation-5513275` | `5513275f` | 10-04 |

## Rollback hazards found in Stage 0

- **Prisma migrations ship with the Alpha line.** Between c908 and `5513275f` there are 41 files under `prisma/migrations`. A frontend-only rollback is safe, but rolling the backend back past a migration needs a forward-compatible schema check. This programme does not perform destructive migrations (contract stop condition).
- **The Politics lane adds migration `20261004120000_politics_observation_store`**, not yet on the Alpha line. Record a rollback ref when it lands.
- **Only one explicit `rollback/*` ref exists.** Every future promotion should create its own `rollback/<release>` ref pointing at the SHA it replaces.

This programme has created no release or rollback refs. It created only `claude/whole-product-convergence-r1`, which is docs-only.
