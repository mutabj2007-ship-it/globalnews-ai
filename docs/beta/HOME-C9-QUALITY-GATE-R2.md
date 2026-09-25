# BETA HOME CLOSURE R2 — FINAL QUALITY GATE AND REPORT

Branch `feature/beta-home-closure-r2`. Base `91a3b3105b6012e7cec3f429ac5ae90b67132ce2`.
Date 2026-09-25.

---

## 1. Increments

| # | SHA | What |
|---|---|---|
| C0 | `30158d0` | prototype reconciliation and the implementation matrix (no source change) |
| C1 | `f9e276f` | hero at prototype scale, three actions, the tier boundary |
| C2 | `29a645e` | category chips, story rail, card interactions |
| C3 | `0dbc803` | the Global Situation Map returns, with a module legend |
| C4 | `a8392f1` | Explore by topic, read out of the module registry |
| C5 | `d4b2b6d` | the intelligence-energy field behind the nine cards |
| C6 | `37b5e67` | How it works and Built on trust return |
| C7 | `6dcb12f` | account state, and a brief allocation that cannot starve |
| C8 | `00c80f9` | phone pass at 430, 390 and 360, both locales |
| C9 | `bdb3b4a` | the page title stops advertising the superseded headline |

## 2. Tests and build

| Command | Result |
|---|---|
| `npx jest` (frontend) | 10 suites / 15 tests fail · **284 suites / 6526 tests pass** · 13 skipped |
| `npm run test:shared` | **13 suites / 523 tests pass** |
| `npm run build:shared` | exit 0 |
| `npm run build:frontend` | exit 0, compiled successfully |

| | Suites failed | Tests failed | Tests passed |
|---|---|---|---|
| Base `91a3b31` | 10 | 15 | 6526 |
| Final `bdb3b4a` | **10** | **15** | **6526** |

**Zero new failures.** The ten are the identical pre-existing set: `adminOperationalSurface`,
`adminSupportSurface`, `c911RequestEconomy`, `m51PhaseB`, `adminProvenance`,
`evidence/visualAuthority`, `mapShellRouteWiring`, `marketSyntheticHarness`, `mktRetained`,
`market/visualAuthorityCorrection`.

## 3. Quota — ordinary Home browsing still starts no metered AI

**0 metered AI or provider requests** across every capture set (C1, C2, C3, C6, C7, C8 —
14 frames each, seven widths × EN/PL).

Comment-stripped scan of all ten live Home components:

| Check | Result |
|---|---|
| executable `getHomeFeed(` calls | **1**, in `page.tsx` |
| direct `fetch(` on the Home path | **0** |
| `analyzeNews` on the Home path | **0** |
| `/search` in live Home code | **0** |

The hero Ask entry is still a native GET form to `/ask`. C8 raised its height to a 44px
touch target and changed nothing else about it, so the N3 quota fix is intact.

**C2 adds interaction without adding a bundle.** The category filter is hidden radios plus
an emitted stylesheet, so the section has no client JavaScript at all and cannot issue a
request under any code path. Measured: pressing a chip causes **0** requests.

**C3 adds a map without adding a provider read.** `HomepageSituationMap` performs zero
provider-capable country reads on mount and on selection, and lazy-loads MapLibre behind
`ssr:false` so it is never in the initial bundle.

## 4. Truth — nothing from the review build reached the product

Comment-stripped scan for `fixture`, `SAMPLE_`, `DEMO_`, `mockData`, `ILLUSTRATIVE`,
`Illustration`, `not a news photograph`, `STUB` across every live Home component: **0 in
all eight new or changed files.**

Deliberately not reproduced from the rendered prototype: the "ILLUSTRATIVE SAMPLE · NOT
LIVE COVERAGE" ribbon, the per-image "Illustration" badge, the licensed-image credit line,
the sample headlines, the sample map marks and the frames' sample Ask prompts.

**The C2 capture stub never entered the repository.** Local captures needed a populated
feed, and this environment has no backend, so a stub stood in on `127.0.0.1:3399` as an
external process. Its strings are prefixed `STUB` precisely so no screenshot could be
mistaken for coverage, and no fixture file exists under `frontend/src`.

## 5. Scope discipline and the hard holds

`git diff 91a3b31..HEAD` over `components/{conflict,economy,energy,market,security,`
`humanitarian,politics,map,ask-frame}`, `app/{conflict,energy,market,map,ask,search}` and
all of `backend/` returns **0 files**.

| Hold | State |
|---|---|
| Production deploy | not performed |
| `globalnewsai.live` bind | not performed |
| Conflict / Economy / Energy / Market / Security / Humanitarian / Politics | not started |
| specialist Map redesign | not touched |
| Watch | `WATCH_RUNTIME_ACTIVE = false`, unchanged |
| payments | none; the tier boundary has no CTA and no price |
| new providers | none activated |
| indexing policy | unchanged — `/` still emits `index, follow` in both locales |

**Gate A preserved.** `IntelligenceModulesSection.tsx` is byte-identical to `c3dd01a`:
`git diff c3dd01a..HEAD` over it is empty. C5 put the energy field *behind* it rather than
inside it, for exactly that reason.

## 6. Spec pins re-pointed — ten assertions, none deleted

Per `BETA-DESIGN-AUTHORITY-R5.1.md` §3. Every one keeps its subject; only what it points at
moved, and each carries a comment saying why.

| Suite | Pin | Now |
|---|---|---|
| `HomepageSituationMap` | the English sentence as a source literal | the governed `selectionScopeNote` key |
| `homepage.architecture` | situation map is retired | situation map is mounted, exactly once |
| `homepage.architecture` | order list without the map | marker restored to its pre-M66.8c position |
| `claudeDesignFoundation` | canvas must NOT parent the map | canvas parents the map |
| `claudeDesignFoundation` | order list without the map | marker restored |
| `trustGeometry` | Trust and HowItWorks retired | both mounted, both files kept |
| `howItWorksDesktop` | HowItWorks retired | mounted, file kept |
| `homepage.architecture` ×2, `TodaySection`, `claudeDesignFoundation` | `latestUpdates={feed.latestUpdates}` | `feed.briefUpdates` |
| `homepageLocalization` | the old English title literal | the new title, **plus** a new rule that each locale's title must contain its own rendered hero lines |

## 7. Responsive

14 captures per increment at **1920×1080, 1440×900, 1024×768, 768×1024, 430×932, 390×844,
360×800**, each in EN and PL. Every frame: HTTP 200, **no horizontal overflow**, correct
`<html lang>`, `#intelligence-modules` present, all nine module titles visible.

C8 added a dedicated phone audit at the three widths the contract names, in both locales,
measuring tap targets and text size rather than overflow alone. **Six targets under 44px
were found and fixed**, all introduced by this closure. Three remain and are recorded in
§9 rather than fixed, because each belongs to a surface this closure must not modify.

## 8. EN / PL

Both locales render the whole Home. 21 new copy keys were added across C1, C2, C3, C4 and
C7.

**The Polish for these keys was written for this repository**, not quoted from the R4.1
catalogue — that catalogue does not contain these zones, because most of them come from the
R2 contract's prose rather than from a drawn frame. Every one is marked **FOR REVIEW** in
the dictionary beside the string. This is the same standing flag R1 raised for the design
lane's own draft Polish.

## 9. Known defects and open questions, recorded rather than hidden

1. **The R2 prototype was never supplied.** "Explore World", "Go further", "Explore by
   topic", "View all topics" and "metered compute" appear in **none** of the three
   R4.1/R5.1 prototypes, no branch, and not in the C2.1 working tree. Those zones were
   built from the contract's prose plus the repository's own retired components. If a newer
   desktop prototype exists, it has not reached this repository. **Needs confirmation.**
2. **"View all" clears the filter rather than linking.** There is no all-stories route:
   `/search` runs `analyzeNews`, `/story/:id` is N6 and open, `/map` is country coverage.
   **Flagged in case a route was intended.**
3. **The tier boundary has no CTA**, because no plans, pricing, billing or checkout route
   exists and `/account` has a layout but no page. Deliberate, and consistent with the
   contract's own ban on prices and checkout.
4. **`/api/users/me` is now requested twice per page** — the header's `AccountControl` and
   the new account panel each call `useAccount`, and there is no shared session context.
   Not metered AI, but a duplicate call and a candidate for a small provider later.
5. **Three tap targets remain under 44px**: the header logo (29px, NavBar — navigation is
   held under N1/N4), MapLibre's own +/- controls (29px, inside the shared `WorldMap`), and
   the category radios (1px, `sr-only` by design — their labels are the real 44px targets).
6. **Polish for the 21 new keys is new copy**, not catalogue-quoted (§8).
7. **The account panel renders nothing while it resolves.** Session state is in an httpOnly
   cookie, so the alternative was flashing "Sign in" at every signed-in reader on every
   load. A brief empty slot is the cost.

## 10. OPEN items — none closed

N1 · N2 · N4 · N5 · N6 · **N7** · N9 · N11 · S1 · S2 · F1 · M2 · M3 · P1 · CC1–CC4 ·
Ask D6 · Spatial D1 · D2 · D17 · D18 · R4.1 C3, C4, C6, C7, C8, C11, C13 · plans/billing.

**N7 in particular stays open.** The chips ship from the governed `map.categories`
vocabulary only, and only for categories the feed actually returned, so the approved
interaction lands without deciding the taxonomy N7 reserves.

## 11. Evidence

```
docs/beta/evidence/home-r2/prototype/  the rendered Product Owner prototype + harness
docs/beta/evidence/home-r2/c1/         14 frames
docs/beta/evidence/home-r2/c2/         14 frames + behaviour log + check script
docs/beta/evidence/home-r2/c3/         14 frames
docs/beta/evidence/home-r2/c6/         14 frames
docs/beta/evidence/home-r2/c7/         14 frames
docs/beta/evidence/home-r2/c8/         14 frames + phone audit + audit script
```
