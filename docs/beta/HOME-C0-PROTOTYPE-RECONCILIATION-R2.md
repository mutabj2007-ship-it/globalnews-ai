# C0 — BETA HOME CLOSURE R2: AUTHORITY / PROTOTYPE RECONCILIATION

Contract: **CLAUDE CODE CONTRACT — BETA HOME CLOSURE R2**, increment C0.
Branch `feature/beta-home-closure-r2`, base `91a3b3105b6012e7cec3f429ac5ae90b67132ce2`.
Date 2026-09-25.

C0 is a **reconciliation increment**. No source file is changed by it. Its purpose is the
one the contract states: compare the Product Owner-selected desktop prototype, the phone
authority, the current live Alpha, and the Home components already in this repository,
then produce an implementation matrix **before** source changes, so that nothing is
recreated that already exists and nothing is invented that has no authority.

---

## 1. Base verification

| Field | Value |
|---|---|
| Branch | `feature/beta-home-closure-r2` |
| Base SHA | `91a3b3105b6012e7cec3f429ac5ae90b67132ce2` |
| What the base is | the R1 tip — the docs/evidence commit on top of final Home commit `1f735ce` |
| Ancestry | `1f735ce` ✔ ancestor · `c3dd01a` (Gate A) ✔ ancestor · `935b865` (C2.1) ✘ **not** an ancestor |
| Worktree | `../beta-home-closure-r2`, created fresh; the primary tree is untouched |

The primary working tree remains at `935b865` with its C2.1 WIP intact (97 modified paths,
0 stashes). It was read from, never written to.

---

## 2. Which prototype is the desktop authority

No design package has arrived since the R4.1/R5.1 set. The Product Owner-selected desktop
prototype is therefore the R5.1 Home prototype, which is present in **both** R5.1 packages:

```
<R5.1 desktop/tablet>/prototype/GNAI_Beta_Home_R5.1.html
<R5.1 phone>/prototype/GNAI_Beta_Home_R5.1.html
```

Both copies are **byte-identical** (8,297,464 bytes;
SHA256 `d8a59a76dc99f20061c7772e57a9635724997cb13692a1d296b8cae2957b9aad`). The phone
authority is the same file driven to phone widths, which is how the harness is built — so
"the corresponding phone authority" is a state of this prototype, not a separate artifact.

### It was rendered, not read

R1 inferred Home zones from the R4.1 **screenshots**. That is how the drift the contract
describes became possible. For R2 the prototype was executed in Chromium and captured, so
every zone below is something that was *seen*.

Two mechanical obstacles are recorded because they will recur:

1. The scratchpad path is 279 characters, past the Windows `MAX_PATH` limit of 260.
   Chromium returned `net::ERR_FILE_NOT_FOUND` for a file `test -f` confirmed exists. The
   prototype directories were copied to `C:/Users/dell/AppData/Local/Temp/gnp` (63-char
   paths) before rendering.
2. The prototype is a **review harness**, not a page: a 360px control column plus a scaled
   device frame, booting to phone 390×844. It is driven by hash parameters —
   `#dev=<width>&fit=0&lang=<en|pl>&auth=<out|in|first>` — and exposes `window.__gnProto`.
   The frame is clipped by a transformed scroll pane, so every ancestor is un-clipped
   before capture.

The harness and the captures are committed at
`docs/beta/evidence/home-r2/prototype/` (`shoot-frame.mjs`, plus 1440/1920 signed-out,
1440 signed-in, 1440 PL, 390 phone) so this is reproducible rather than asserted.

### What the prototype actually contains (desktop 1440, signed out)

1. **Hero** — two-line display headline ("Understand / what's changing.", second line
   teal), subheadline, Ask box with inline **Ask** button, the metered-AI hint
   *"Ask runs an AI analysis. Browsing, sources and the map are free."*, and **two**
   actions: violet **Ask AI about today** / *Source-backed answers*, teal
   **Open World Map** / *Country coverage and sources*.
2. **A large, glowing globe** occupying the hero's right half, with the
   **"Your world in 60 seconds"** panel overlapping it.
3. **"What's happening now"** — heading, *Updated 20 min ago*, **interactive category
   chips** (All · Energy · Economy · Security · Humanitarian · Politics · Science), and the
   note *"Choosing a category or opening a story never starts an AI analysis."*
4. **Lead story card** (image left, text right, bookmark control) then a **4-up card grid**.
5. **Right rail** — **World Pulse** (map thumbnail + *Open World Map* + explanatory note)
   and an **Ask AI about today** card with three suggestion rows.
6. **"For you"** — signed out: *"Sign in to follow countries and topics and get a personal
   feed."* + **Sign In**. Signed in: personal rows plus **Following** chips and **Manage**.
7. **Intelligence modules** — nine cards, 3×3, category-coloured titles, route lines,
   state pills.
8. **Footer** — Privacy Policy · Terms · GlobalNewsAI Beta.

---

## 3. AUTHORITY GAP — recorded, not silently resolved

Contract §5–§12 name zones that **do not exist in any supplied prototype and do not exist
anywhere in this repository**. Measured, not assumed — searched across all three R4.1/R5.1
prototype HTML files, every branch, and the C2.1 working tree:

| String | R5.1 Home prototype | Other 2 prototypes | Any branch | C2.1 WIP tree |
|---|---|---|---|---|
| `Explore World` | 0 | 0 | 0 | 0 |
| `Go further` | 0 | 0 | 0 | 0 |
| `Explore by topic` | 0 | 0 | 0 | 0 |
| `View all topics` | 0 | 0 | 0 | 0 |
| `metered compute` | 0 | 0 | 0 | 0 |

The prototype also has **no** third hero action, **no** premium teaser, **no** Global
Situation Map legend, **no** glowing ring, **no** How-it-works and **no** Built-on-trust
section.

**Resolution taken, so the assignment is not blocked.** The contract text is treated as the
authority for the zones it describes, because it describes them concretely enough to build
(placement, wording, colour meaning, destinations, prohibitions); the rendered prototype is
the authority for the visual language and for every zone it does cover; and the
repository's retired Claude Design components are the authority for the visual technology
the contract says to restore rather than redraw. Where the two disagree, the contract wins,
since it is the later instruction.

This is flagged for the Product Owner: **if a newer desktop prototype exists, it has not
reached this repository**, and the zones in §3 above are being built from the contract's
prose rather than from a drawn frame.

---

## 4. Current live Alpha

`https://frontend-alpha-4560.up.railway.app/` → **200**. Deployment
`39c4a7cc-6e3c-49e1-ab78-8a5f32eb0f23`, the R1 result.

Composition at the base: `SiteStructuredData · NavBar · BetaHero(+SixtySecondBrief) ·
WhatsHappeningNow | HomeSideRail · IntelligenceModulesSection · Footer · MobileBottomNav`.

Backend endpoints verified live, signed out: `GET /api/users/me` → **401**,
`GET /api/follows/countries` → **401**. Both are real and correctly reject a guest.

---

## 5. Reusable code already in this repository

All present on disk at the base, unimported by any route ("retired, not deleted"). Nothing
in this list needs to be recreated.

| Component | Lines | Serves |
|---|---|---|
| `home/HeroIntelligenceField.tsx` | 556 | layered dark-blue intelligence background (C1) |
| `home/HeroWorldVisual.tsx` | 231 | hero world visual (C1) |
| `home/WorldMapAnimatedVisual.tsx` | 104 | ambient animated globe (C1) |
| `home/HeroHud.tsx` | 123 | hero HUD framing (C1) |
| `home/HomepageSituationMap.tsx` | 163 | **Global Situation Map card (C3)** |
| `home/IntelligenceEngineSection.tsx` | 210 | engine section wrapper (C5) |
| `home/IntelligenceEngineRing.tsx` | 484 | **the glowing ring identity (C5)** |
| `home/intelligenceEngineGeometry.ts` | 470 | ring geometry (C5) |
| `home/HowItWorks.tsx` | 340 | **How it works (C6)** |
| `home/TrustSection.tsx` | 235 | **Built on trust (C6)** |
| `home/LatestNowRail.tsx` | 102 | rail with `snap-start` items (C2 carousel) |
| `home/GlobalDevelopments.tsx` | 411 | editorial cards, `overflow-x-auto` rail (C2) |
| `home/useCountryFollows.ts` | — | **follow state hook (C7)** |
| `lib/hooks/useAccount.ts` | — | `user | null` + `isLoading` (C7) |
| `home/Hero.tsx` | 691 | superseded hero; source of hero mechanics |

`HomepageSituationMap` is already quota-safe by construction: it reuses `/map`'s own
`WorldMap` via `next/dynamic({ssr:false})`, holds `countryStoryCounts` empty, and performs
**zero** provider-capable reads on load or on selection. It is the right C3 component and
needs no data work — only the legend.

`useCountryFollows` carries a load-bearing detail for C7: **follows are ISO-3**
(`CountryFollowView.countryCode`) while **`NewsArticle.countryCode` is ISO-2**. Conversion
must go through `findCountryByIso3`; a `slice(0, 2)` is explicitly ruled out.

---

## 6. Destinations that actually exist

Checked against `frontend/src/app/**` and `lib/intelligenceModules.ts` before any CTA is
assigned, as the contract requires.

**No public plans, pricing, billing, upgrade or checkout route exists.** The only
account-adjacent routes are `/account/settings` (a real page) and `/admin/users/subscriptions`
(admin-only). `/account` has a `layout.tsx` but **no `page.tsx`**, so `/account` itself does
not resolve. Consequence for C1: the "Go further with GlobalNewsAI" teaser has **no
purchase destination to link to**, which agrees with the contract's own prohibition on
prices, credits and checkout. It will be presented as a non-transacting tier boundary.

Module registry, which C4 and C3 must use rather than a new list:

| Contract topic | Registry id | State | Destination |
|---|---|---|---|
| World | `world-intelligence` | comingSoon | **none** — cannot be a link |
| Economy | `economy` | preview | `/economy-visual-preview` |
| Energy | `energy` | preview | `/energy` |
| Security | `security` | preview | `/security-visual-preview` |
| Humanitarian | `humanitarian` | preview | `/humanitarian` |
| Markets | `market` | preview | `/market` |
| (also registered) | `country-intelligence` | **active** | `/map` |
| (also registered) | `politics` | preview | `/politics-visual-preview` |
| (also registered) | `conflict` | preview | `/conflict` |

Five of the six C4 topics have real routes; **World has none** and must render as a
non-routing entry rather than being given an invented destination. "View all topics" →
`#intelligence-modules`, an existing anchor.

C3's legend — Energy · Conflict · Humanitarian · Economy — has **no corresponding map
layer**. The map's real vocabulary is country coverage, and the governed news taxonomy is
`world, politics, business, technology, science, health, sports, entertainment`. The four
legend names are **module ids**, not layers. The only truthful reading of "must map to real
layers" is therefore: each legend entry links to its real module surface
(`/energy`, `/conflict`, `/humanitarian`, `/economy-visual-preview`). **No dots, no
severity, no counts are drawn.**

---

## 7. The governed taxonomy unblocks category chips

`getDictionary(l).map.categories` = `all, world, politics, business, technology, science,
health, sports, entertainment` — the shared `NewsCategory` union plus `all`.

R1 withheld chips under **N7** because the *drawn* labels (Energy, Economy, Security,
Humanitarian) are not in this vocabulary; rendering them would have invented the taxonomy
N7 reserves. The contract now approves the chip **UI** and states it is driven by the
**governed taxonomy**. Both hold together only one way: build the chips from
`map.categories`, filtering the already-fetched feed by `article.category`. That ships the
approved interaction without inventing a single label. **N7 stays open** — the taxonomy
itself is not being decided here.

---

## 8. IMPLEMENTATION MATRIX

Prototype/contract zone → current Alpha → existing reusable code → required final behaviour.

| # | Zone | Current Alpha (base) | Reusable code | Required final behaviour | Inc |
|---|---|---|---|---|---|
| 1 | Layered dark-blue intelligence background | flat `PageCanvas` | `HeroIntelligenceField` | RESTORE behind the hero; decorative only, `aria-hidden`, honours `prefers-reduced-motion` | C1 |
| 2 | Large hero + world/globe visual | `BetaHero` + small `HeroWorldVisual` | `HeroWorldVisual`, `WorldMapAnimatedVisual`, `HeroHud` | RESTYLE to prototype scale: display headline with teal second line, large glowing globe on the right half | C1 |
| 3 | Ask box + metered hint | present, native GET → `/ask` | `BetaHero` | **KEEP EXACTLY.** Native GET form, no client boundary, no `/search?q=`. The quota fix is not to be regressed | C1 |
| 4 | Hero actions | 2 (`/ask`, `/map`) | — | RECOMPOSE to **3**: Explore World, Ask GlobalNewsAI, Open Map. Prototype shows 2; contract requires 3 — contract wins | C1 |
| 5 | "Go further with GlobalNewsAI" teaser | absent | — | **NEW**, upper-right. Violet = tier boundary, sand = metered compute. No price, no credit balance, no checkout, **no CTA to a route that does not exist** (§6) | C1 |
| 6 | "Your world in 60 seconds" | `SixtySecondBrief`, `return null` when empty | `SixtySecondBrief` | Overlap the globe as drawn; replace `return null` with a truthful allocation rule and document it | C1/C7 |
| 7 | "What's happening now" heading + freshness | present, understated | `WhatsHappeningNow` | RESTYLE prominent; keep `DataModeLabel`, `updatedStamp`, `noAiNote` | C2 |
| 8 | Category chips | **absent** (N7) | `map.categories` | **NEW**, interactive, from the governed taxonomy only; filters the already-fetched feed; starts 0 requests | C2 |
| 9 | Lead + editorial cards | flat 4-up grid | `GlobalDevelopments` | RESTYLE to prototype: image-led lead, then cards with hover zoom/lift | C2 |
| 10 | Carousel / rail | none | `LatestNowRail` (`snap-start`), `GlobalDevelopments` (`overflow-x-auto`) | RECOMPOSE: horizontal scroll, swipe, scroll-snap, keyboard a11y; autoplay only if disciplined and `prefers-reduced-motion`-aware | C2 |
| 11 | "View all" | absent | — | NEW, to an existing destination only | C2 |
| 12 | Global Situation Map card | absent | **`HomepageSituationMap`** | RESTORE unchanged in data terms (0 provider reads); add legend Energy · Conflict · Humanitarian · Economy linking to real module routes. **No dots** | C3 |
| 13 | Ask suggestion card (right) | in `HomeSideRail` | `HomeSideRail` | RESTYLE to the prototype's card; keep `/ask?q=` links that only stage a draft | C3 |
| 14 | World Pulse | present, capped 320px | `HomeSideRail` | KEEP incl. the H6 height cap | C3 |
| 15 | Explore by topic | absent | `INTELLIGENCE_MODULES` | **NEW**: World, Economy, Energy, Security, Humanitarian, Markets from the registry; World non-routing; "View all topics" → `#intelligence-modules` | C4 |
| 16 | Engine Intelligence — nine cards | present, byte-unchanged since Gate A | `IntelligenceModulesSection` | **KEEP all nine visible.** Gate A result and its spec must keep passing | C5 |
| 17 | Engine glow / ring identity | absent | **`IntelligenceEngineRing`, `IntelligenceEngineSection`, `intelligenceEngineGeometry`** | RESTORE the glowing ring around/behind the nine cards. Do not replace the cards with it | C5 |
| 18 | How it works | retired R1 | **`HowItWorks`** | **RESTORE** — supersedes the R1 retirement | C6 |
| 19 | Built on trust | retired R1 | **`TrustSection`** | **RESTORE** — supersedes the R1 retirement | C6 |
| 20 | Signed-out state | sign-in card | `useAccount` | Keep; never show "Sign in" to an authenticated reader | C7 |
| 21 | Signed-in: For you / Following / Manage | **held** in R1 | `useCountryFollows`, `useAccount` | Following + Manage are supported by a real API (401 verified). "For you" has **no** backend; derive it from the one already-fetched feed filtered by followed countries via `findCountryByIso3` — 0 extra requests | C7 |
| 22 | Phone / responsive | 7 widths pass | — | Re-verify 430×932, 390×844, 360×800 after every new zone | C8 |
| 23 | `<title>` / OG / Twitter | still "Understand today's world in seconds." | `homeMetaTitle` | REPLACE in EN and PL. **Do not change indexing policy** | C9 |

---

## 9. What C0 changes

Nothing in `frontend/`, `backend/` or `shared/`. This document and the prototype evidence
only.

## 10. Hard holds carried into every later increment

No Production deploy · no `globalnewsai.live` bind · no Conflict, Economy, Energy, Market,
Security, Humanitarian or Politics module started · no specialist Map redesign · no Watch
activation (`WATCH_RUNTIME_ACTIVE` stays `false`) · no payments · no new providers.

No illustrative headline, sample map point, fake metric, fake credit balance, fake price,
prototype geography or prototype-only renderer code from the review build reaches the
product. The prototype's own ribbon says it: *"Every headline, count, source and map label
is an illustrative sample, not live coverage."*

Open items untouched: N1 · N2 · N4 · N5 · N6 · **N7** · N9 · N11 · S1 · S2 · F1 · M2 · M3 ·
P1 · CC1–CC4 · Ask D6 · Spatial D1 · D2 · D17 · D18 · R4.1 C3, C4, C6, C7, C8, C11, C13 ·
plans/billing.
