# Phase 2.2 — Master Capability / Convergence Tree

The *"nothing we did earlier is forgotten"* inventory. **Mandatory before final
convergence sign-off.**

Every entry is classified from measured evidence — module registration, route
existence, call sites, flags — not from intent or from a milestone name. Where a
capability has substrate but no way in, that is recorded as **IMPLEMENTED BUT
HIDDEN** rather than as either "done" or "missing", because both of those would
be false.

**Classification key:** VISIBLE + WORKING · VISIBLE + PARTIAL · IMPLEMENTED BUT
HIDDEN · DESIGNED ONLY · DATA BLOCKED · NOT IMPLEMENTED · DEFERRED

Source basis: L2 (`2c4b6ce`) plus this convergence branch. Runtime behaviour on
the live Production deployment is **UNVERIFIED** throughout — see the parity
matrix.

---

## 1 · Home / Public Today

**VISIBLE + WORKING**

Home renders the feed, the hero, the intelligence modules and the live status
strip. `TodayWorkspace`, `TodayGeographyPanel`, `SituationRow` and `AnalysePanel`
exist and mount.

The home **feed cache** is the entire L1→L2 delta (`news.service.ts`, +236/−2,
with a 726-line spec). Checkpoint B-2A narrowed the Map's shared use of it from
50 to 24 items at the caller, preserving the ratified C2/C7 cache contract rather
than rewriting it.

---

## 2 · Analysis

**VISIBLE + WORKING**, with two semantic contracts pending live validation.

One client, one route, one service — `analyzeNews()` → `POST /analysis/news` —
shared by `/search`, the Ask AI dock and the workspace. No second engine exists.

| item | state |
| ---- | ----- |
| J · dimension semantic contract | **PASS / live-Alpha validation pending** |
| K · source admission | **PASS / live-Alpha validation pending** |
| `ANALYSIS-NON-ENGLISH-MATERIAL-RELEVANCE-1` | **DATA BLOCKED** — needs multilingual demonym/locative data |
| `ANALYSIS-METRIC-VOCABULARY-1` | **DEFERRED** to Claude Design |
| `ANALYSIS-ITEM-COUNT-SEMANTICS-1` | **DEFERRED** to Claude Design |

---

## 3 · Complete Analysis Record

**VISIBLE + WORKING** structurally; **DEFERRED** visually.

It reuses `AnalysisResultView` and `buildAnalysisWorkspaceModel` rather than
reimplementing them, so fidelity is structural. Checkpoint L-5 proves same
object → same dimensions, same citations, same sources, same counts.

`ANALYSIS-RECORD-VISUAL-1` — the audit-page redesign — is **DEFERRED** to Claude
Design by ruling.

---

## 4 · Spatial

**VISIBLE + PARTIAL.**

| part | state |
| ---- | ----- |
| World/evidence canvas, camera, breadcrumbs | VISIBLE + WORKING |
| Layer rail (EVID · SRC · WATCH · SITU · WATER · LABEL · GRID) | VISIBLE + WORKING |
| Graticule | VISIBLE + WORKING (corrected in C907 §4, guarded in E-3) |
| Place search over the full ladder | VISIBLE + WORKING (corrected in G) |
| Language control on the map | VISIBLE + WORKING (added in F) |
| Product escape from the map | VISIBLE + WORKING (brand mark) |
| EVIDENCE mode as a distinct view | **DATA BLOCKED** — E-4 |
| Point-precision evidence layer | **DATA BLOCKED** — E-5, producer absent |
| Admin-1 / admin-2 geometry | **NOT IMPLEMENTED** — no dataset in the product |
| Rivers, populated places | **NOT IMPLEMENTED** — no dataset wired |
| `SPATIAL-GEOGRAPHY-COUNT-SEMANTICS-1` | **DEFERRED** |

E-4 and E-5 share one blocker: no producer emits point-precision evidence
(`PRODUCIBLE_SPATIAL_PRECISION` is `['COUNTRY','UNKNOWN']`).

---

## 5 · Watch / Follow

**Follow — VISIBLE + WORKING.** `FollowsModule` is registered, has a controller,
and Follow is offered only where the account holds the relationship.

**Watch — NOT IMPLEMENTED.** `WATCH_RUNTIME_ACTIVE = false`. `app.module.ts`
states it plainly: *"nothing here reaches Watch: no WatchModule, no scheduler, no
route."* The watchboard icon is **withheld, not greyed**, and the `watch` layer is
GATED with the reason recorded. The composer and activation panel exist as
surfaces over a runtime that does not.

---

## 6 · Economy · 7 · Market · 8 · Security

**NOT IMPLEMENTED.**

No module, no route, no registry entry and no surface for any of the three. They
are named in planning, and nothing in the product implements them. Recorded so
the absence is deliberate rather than assumed.

---

## 9 · Conflict

**IMPLEMENTED BUT HIDDEN.**

`ConflictClaimModule` is registered in `app.module.ts` and has **3 files and 0
controllers** — substrate with no route. `SpecialistDomainId` includes
`'CONFLICT'`, and `registerSpecialistDomain()` is **never called**, so no conflict
domain is registered into the platform layer either.

---

## 10 · Imihigo (Delivery)

**DESIGNED ONLY.**

`SpecialistDomainId` includes `'DELIVERY'`. There is a platform layer
(`lib/specialist/specialistDomain.ts`, `attentionQueue.ts`) and no domain
implementation, no registration, no route and no surface.

---

## 11 · Kenya Elections

**DESIGNED ONLY.**

`SpecialistDomainId` includes `'ELECTION'`, with the same state as Delivery: the
slot exists in the vocabulary, nothing occupies it.

---

## 12 · Situations

**IMPLEMENTED BUT HIDDEN.**

`SituationModule` is registered and carries **16 files and 0 controllers**. The
layer registry records the gate in the substrate's own words: *"the Situation
substrate is now registered (PO ruling 1) but serves NO route — SituationModule
declares no controller — and its identity port is bound to
`UNWIRED_SITUATION_IDENTITY_PORT`, which throws."*

The SITUATIONS map mode is therefore `NOT_BUILT`, and E-3 now derives that reason
from this evidence rather than printing "No data yet".

---

## 13 · Signals (GDELT / Event Registry backbone)

**IMPLEMENTED BUT HIDDEN.**

`SignalsModule` is registered with **13 files and 0 controllers**. The GDELT and
Event Registry signal providers exist; nothing routes to them.

---

## 14 · Admin

**VISIBLE + WORKING.**

Nine areas — `ai`, `analytics`, `audit`, `news`, `payments`, `settings`,
`support`, `system`, `users` — behind `AdminGuard`, which runs on every admin
request regardless of how the browser arrived.

---

## 15 · Support

**VISIBLE + PARTIAL.**

Seven categories; exactly one (`NEWS_QUESTION`) may reach `AnalysisService`; the
other six go to a human. The form defaults to **no category** and refuses to
submit without one, so nothing is silently classified.

`SUPPORT-PRODUCT-KNOWLEDGE-ROUTING-1` — **DEFERRED to Claude F.** No category
means *"ask the product about itself"*, so a product question has nowhere correct
to go. Claude F is the Support domain authority.

---

## 16 · Multilingual backbone

**VISIBLE + WORKING**, with one data gap.

EN and PL dictionaries throughout; one cookie, one `localStorage` key, one
`persistLanguageSelection`. Checkpoint I made the reconciliation route-agnostic so
PL survives a refresh away from the homepage, and Checkpoint F gave the map its
own EN/PL control.

**DATA BLOCKED:** `COUNTRY_DEMONYMS_BY_ISO3` is English-only, so corpus admission
cannot assess material relevance for non-English articles. The gate is
language-aware and admits rather than rejects — `ANALYSIS-NON-ENGLISH-MATERIAL-RELEVANCE-1`.

---

## 17 · Local-source / provider backbone

**VISIBLE + WORKING.**

GNews, GDELT (`GdeltDocProvider`), RSS (`RssFeedProvider`, 7 curated feed sources)
and a Mock provider that is never mixed with a real one. `NEWS_PROVIDERS` is the
active set; `ALL_NEWS_PROVIDERS` is what admin health iterates.

**INTENTIONAL, PRESERVED:** separate GNews credentials per environment; GDELT
enabled on Alpha and historically not on Production.

---

## 18 · PWA / offline

**VISIBLE + WORKING.** `public/sw.js`, `ServiceWorkerRegistrar` mounted in the
root layout, contract pinned by `pwaContract.spec.ts`.

---

## 19 · Domain / SEO

**VISIBLE + WORKING** for SEO: `robots.ts`, `sitemap.ts`, `buildPageMetadata`,
language-aware metadata via `generateMetadata()`.

**DEFERRED** for domain binding: Production is HOLD, `alpha.globalnewsai.live` is
not bound, and no DNS record has been changed. See Phase 3.

---

## Summary

| classification | count | entries |
| -------------- | ----- | ------- |
| VISIBLE + WORKING | 8 | Home, Analysis, Complete Record (structural), Follow, Admin, Multilingual, Providers, PWA/SEO |
| VISIBLE + PARTIAL | 3 | Spatial, Support, (Complete Record visually deferred) |
| IMPLEMENTED BUT HIDDEN | 3 | Conflict, Situations, Signals |
| DESIGNED ONLY | 2 | Imihigo, Kenya Elections |
| DATA BLOCKED | 3 | EVIDENCE mode, point evidence, non-English relevance |
| NOT IMPLEMENTED | 4 | Watch runtime, Economy, Market, Security |
| DEFERRED | 4 | Record visual, metric vocabulary, item-count semantics, geography-count semantics |

**Nothing in this tree is closed by assertion.** Every "hidden" entry names the
module, the file count and the missing route; every "blocked" entry names the
producer or dataset it waits on.
