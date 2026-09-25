# H0 — FULL HOME AUTHORITY RECONCILIATION

Issue #29, `BETA-HOME-FULL-CONVERGENCE-R1.md` §4 H0.
Branch `feature/beta-home-full-convergence-r1`, authority commit `c9610e6`, base `c3dd01a`.
Date 2026-09-25.

Docs-only. **No visible code changed by this commit**, as H0 requires.

---

## 1. Authority re-verified

All four packages re-checked against the SHA256 values in `§1` of the contract. Matched by
hash, not filename, as instructed.

| Tier | SHA256 | Outer filename | Internal root | Verdict |
|---|---|---|---|---|
| R4.1 desktop/tablet | `9da21053…94bc` | `R1 review ZIPs and navigation conflicts26.zip` | `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4` | MATCH |
| R4.1 phone | `f843483c…ffe0` | `R1 review ZIPs and navigation conflicts27.zip` | `GNAI_BETA_LAUNCH_PHONE_DESIGN_R4` | MATCH |
| R5.1 desktop/tablet | `a90954d1…c2a9bb` | `desktop or tablet R5.1.zip` | `…DESIGN_R5.1` | MATCH |
| R5.1 phone | `85ecda57…6362be` | `phone R5.1.zip` | `…DESIGN_R5.1` | MATCH |

246 files re-verified against their manifests: 0 mismatched, 0 missing.

### Authority material read for H0

R4.1 (both tiers): `README.txt`, `SPEC.md`, `NAVIGATION.md`, `COMPONENTS_AND_TOKENS.md`,
`INTERACTIONS_AND_STATES.md`, `IMAGERY_SPEC.md`, `ROUTE_MODULE_MATRIX.md`,
`CONTRACT_CONFLICTS.md`, `QA_LOG.md`, `R4_CHANGE_LOG.md`, `i18n/i18n_en_pl.json`,
`tokens/`, and the Home frames: desktop `1440x900` and `1920x1080` states 01/02/03, tablet
`1024x768` and `768x1024`, phone `430x932`, `390x844`, `360x800`.

R5.1 (both tiers): `HOME_R4.1_DELTA.md`, `INTELLIGENCE_MODULE_MATRIX.md`,
`PROPOSED_DELTAS.md`, `CATEGORY_COLOUR_TOKENS.md`, `AUTHORITY_DELTA_REGISTER.md`,
`NAVIGATION.md`, `SPEC.md`, `COMPONENTS_AND_TOKENS.md`, `MODULE_COVERAGE.md`,
`R5_1_CHANGE_LOG.md`, `MANIFEST.txt`, and the Home frames `H1`/`H3`/`H4`.

---

## 2. The approved Home, as the authority actually defines it

Reading the frames and the 139-key `i18n_en_pl.json` Home catalogue together, the approved
Home composition is:

**Desktop/tablet, top to bottom:** header (logo+BETA · 4 destinations · search pill ·
language · account/Sign In) → hero left column (headline two lines, second line accent;
subheadline; Ask input + Ask button; metered note; two CTAs) with globe visual right →
"Your world in 60 seconds" panel overlapping the globe (meta line, image-led lead item with
status chip, two follow-up rows) → "What's happening now" (heading, updated stamp, category
chips, no-AI note) → lead story card → 4-up story grid → "For you" (signed in) → right rail
(first-visit/sign-in card, World Pulse preview + note, Following chips + Manage, "Ask AI
about today" suggestions) → Intelligence modules → footer (privacy, terms, footer note).

**Phone:** same zones recomposed to one column — 46px top bar, hero, Ask, CTA pair,
60-second brief, what's-happening, stories, modules, footer, 4-tab bottom bar.

---

## 3. Design Zone → current component → classification

| # | Design zone | Authority | Current component | Action | Note |
|---|---|---|---|---|---|
| Z1 | Sample ribbon | `beta.sample`, SPEC §6 | — | **RETIRE (never build)** | Review-only. *"production removes the ribbon, and must never show sample content."* |
| Z2 | Header / top nav | R4.1 NAVIGATION §3–4, frames 01 | `NavBar.tsx` (493 ln) | **RESTYLE + HOLD** | Restyle to authority. Destination count is **N1 OPEN** → keep current routable set. See §4.1. |
| Z3 | Header search pill | `searchShort`, `searchAria` | `NavBar` search icon | **HOLD** | **N4 OPEN** — pill has no action today; authority proposes opening Ask. Presentation only. |
| Z4 | Language / account | `language`, `langAria`, `signIn`, `account` | `NavBar` + `AccountControl` | **KEEP** | Already matches; approved-from-repo strings. |
| Z5 | Live/data status strip | not in R4.1 Home frames | `LiveStatusStrip.tsx` (113 ln) | **RECOMPOSE** | No approved Home strip. Its truthful degraded-state role is required by §6; fold into the feed area rather than a separate band. |
| Z6 | Hero headline/sub | `heroA`,`heroB`,`heroSub` | `Hero.tsx` (691 ln) | **RECOMPOSE** | Copy, two-line accent treatment and layout all differ. |
| Z7 | Hero Ask entry | `askPh`,`askAria`,`askBtn`,`askHint` | `Hero` input | **RESTYLE** | Input exists and is already draft-only. Add the metered note; keep `/ask` semantics. |
| Z8 | Hero CTA pair | `askToday`,`askTodaySub`,`openMap`,`openMapSub` | partial ("View World Map") | **RECOMPOSE** | Two titled+subtitled CTAs, violet and teal. |
| Z9 | Hero globe visual | IMAGERY_SPEC, frames | `HeroWorldVisual*` | **RESTYLE** | Explanatory globe. ≤156px phone / 220px tablet per SPEC §4.A. |
| Z10 | "Your world in 60 seconds" | `brief`,`briefMeta`,`new4` | **absent** | **REPLACE (new)** | Image-led lead + 2 rows, "no AI used" meta. |
| Z11 | "What's happening now" heading + updated | `now`,`updated` | `GlobalDevelopments.tsx` (411 ln) | **RECOMPOSE** | Heading/stamp exist in different form. |
| Z12 | Category chips | `categories`,`noAi`,`emptyCat`,`emptyCatBody` | **absent** | **HOLD** | **N7 OPEN (taxonomy)** — see §4.2. |
| Z13 | Lead story card | frames 03, IMAGERY_SPEC | `GlobalDevelopments` items | **RECOMPOSE** | Image, category, headline, dek, provenance, place·sources·time. |
| Z14 | 4-up story grid | frames 03 | `GlobalDevelopments` list | **RECOMPOSE** | Status chips (`breaking`,`developing`) where the feed supports them. |
| Z15 | Story destination | `readAt`, N6 | links out to publisher | **KEEP** | **N6 OPEN** — no `/story/:id`. Keep linking out. |
| Z16 | "For you" | `forYou`,`forYouMeta`,`newTag` | `TodayWorkspace.tsx` (423 ln) partial | **RECOMPOSE** | Signed-in only; depends on follow state. |
| Z17 | First-visit / sign-in card | `firstVisit`,`chooseTopics`,`notNow`,`signInFollow` | `AuthErrorBanner` only | **REPLACE (new)** | Signed-out right-rail card. |
| Z18 | World Pulse | `pulse`,`pulseNote` | `HomepageSituationMap` (retired) | **REPLACE (new)** | Explanatory preview + "open the map" note. No live marks — see §4.3. |
| Z19 | Following chips | `following`,`manage` | `useCountryFollows.ts`, `CountryFollowControl` | **RECOMPOSE** | Real FollowsModule state. Follow ≠ Watch. |
| Z20 | "Ask AI about today" suggestions | `suggested`,`fillNote` | absent on Home | **REPLACE (new)** | Prefill only; *"Nothing runs until you press Send."* |
| Z21 | Intelligence modules | R5.1 delta | `IntelligenceModulesSection.tsx` | **KEEP EXACT** | H4, accepted at `c3dd01a`. Regression-test only. |
| Z22 | How it works | **not in any approved Home frame** | `HowItWorks.tsx` (340 ln) | **RETIRE FROM HOME** | See §4.4. |
| Z23 | Trust / methodology | **not in any approved Home frame** | `TrustSection.tsx` (235 ln) | **RETIRE FROM HOME** | See §4.4. |
| Z24 | Today workspace panel | not in approved Home | `TodayWorkspace.tsx` | **RETIRE FROM HOME** | Its useful parts fold into Z16. |
| Z25 | Footer | `privacy`,`terms`,`footerNote` | `Footer.tsx` (259 ln) | **RESTYLE** | Authority footer is a thin rule + three items. |
| Z26 | Mobile bottom nav | R4.1 NAVIGATION §4 | `MobileBottomNav.tsx` (59 ln) | **KEEP + HOLD** | Four destinations correct. Label size is **N11 OPEN**. |
| Z27 | Plans / tier boundary | `plans`,`plansSub` | absent | **HOLD** | *"OPEN DECISION: no billing exists."* Not built. |
| Z28 | Notifications | `notifications`,`pushOff`,`unread` | absent | **HOLD** | **N9 OPEN.** Not built. |
| Z29 | Saved route | `savedTab`,`followTab`,… | absent | **HOLD** | **N5 OPEN.** Not built; not a Home zone. |

**Totals:** KEEP 3 · RESTYLE 4 · RECOMPOSE 8 · REPLACE 4 · RETIRE 4 · HOLD 6.

---

## 4. Where current Alpha diverges from the approved Home, and the OPEN items that bound it

### 4.1 Desktop header destinations — N1 OPEN

The approved desktop frame draws **four** destinations. The branch ships **two** routable
(`/`, `/map`) plus **seven inert editorial items** (World, Politics, Business, Technology,
Science, Health, About) from the superseded M65 prototype. R4.1's own audit records the
gap: *"Desktop `navigation.ts` on the branch still lists Home and World Map only (N1
open)"*, and `CONTRACT_CONFLICTS.md` C12 keeps it **OPEN (N1)**.

C-3 ruled that preserving current navigation behaviour satisfies Gate A. The contract's H1
repeats it. So the **destination count is HELD**.

The seven inert items are a different question: they appear in **no** approved Home frame,
and they are not destinations but non-routing labels. Removing them is RESTYLE-to-authority,
not a navigation change, and it removes seven dead controls from the Beta first screen.
**Proposed for H1, flagged here** so the CTO can veto before it lands.

### 4.2 Category chips — N7 OPEN

The approved Home shows chips, and SPEC §4.B defines them as a **client-side filter of the
already-fetched feed, no request and no AI**. But `NAVIGATION.md:45` records N7 as
**OPEN DECISION (taxonomy)**, and `MODULE_COVERAGE.md` says a category route exists only
*"if N7 approves"*.

Reading: the chips as drawn add no route and spend nothing, and the OPEN half is the
**taxonomy** — which categories exist. The branch already has a governed category
vocabulary (`homepageLocalization.spec.ts` enforces one canonical mapping). **Held in H0**;
H3 will implement chips only if they can be driven from the existing governed vocabulary
with no new taxonomy invented. If not, the zone stays HOLD and is reported.

### 4.3 World Pulse and story imagery — the truth constraint

R4.1's frames use illustrative locator images and an explanatory globe, every one badged
`Illustration`, and SPEC §7 lists exactly what must come from real data instead:
headlines, deks, times and source counts from `getHomeFeed`/`fetchTopHeadlines`; country
positions from `WorldMap` + `countryStoryCounts`; publisher names from `article.source`.
§6 also records that **licensed editorial photography is not available** and photo-led
cards are REVISE pending assets.

So: Z18 World Pulse renders as an explanatory preview with its own note — never sample
incident marks. Story cards use feed images through `SafeImage` with publisher credit, and
fall back to the governed "image unavailable" treatment. **No illustrative image ships.**

### 4.4 How it works / Trust — retire from Home

`HowItWorks` and `TrustSection` appear in **no** R4.1 or R5.1 Home frame and have **no key**
in the 139-key Home catalogue. Under precedence rule 4 — *"current implementation only as
code to modify, never as missing design authority"* — their presence on Home is not
evidence that the approved Home contains them.

They are **RETIRED FROM HOME**, not deleted, following this repository's existing convention
(`TodaySection`, `LatestNowRail`, `HomepageSituationMap`, `IntelligenceModulesDesktop`). The
files stay on disk and their specs keep their subject.

### 4.5 PL is DRAFT — the H7 constraint, recorded now

`i18n_en_pl.json` states: *"PL strings are DRAFT FOR REVIEW except those marked approved
(copied from repo)"*. Of 139 Home keys, **9 are `APPROVED (repo)`** — `nav_home`,
`nav_map`, `nav_ask`, `nav_intel`, `signIn`, `history`, `signOut`, `askPh`, `mapSearch` —
and they are approved precisely because they came **from this codebase**. Every other PL
string is the design lane's draft.

H7 therefore cannot treat the package's PL as approved product copy. The only
non-inventing options are to use the design lane's own draft PL, or ship no PL for new
copy. Shipping no PL breaks EN/PL parity, which §2 requires. **Decision: use the design
lane's draft PL for new Home copy, marked FOR REVIEW in the final report**, and never
author new Polish beyond it. This is flagged for Product Owner review with the visual pass.

### 4.6 Zones that depend on account state

Z16 "For you", Z19 Following and Z17 sign-in card are signed-in/signed-out variants. The
account and follow endpoints (`/api/users/me`, `/api/follows/countries`) **500 in the local
evidence environment** because no backend runs there — classified environmental in Issue #28
C-3. H8 requires verification *"against a real backend environment where possible"*; Alpha
provides it, so these states are verified there rather than locally.

---

## 5. Sequencing decided for H1–H8

| Increment | Zones | Scope |
|---|---|---|
| H1 | Z2, Z3, Z4, Z5, Z25, Z26 | Shell, header, footer, bottom nav, first-fold framing |
| H2 | Z6–Z9 | Hero as one responsive feature |
| H3 | Z10–Z15, Z12 if N7 permits | 60-second brief, what's-happening, story cards |
| H4 | Z21 | Preserve + regression-test only |
| H5 | Z16–Z20, Z22–Z24 | Right rail, For you, retirements |
| H6 | all | Whole-page responsive at 7 widths |
| H7 | all | EN/PL full-page |
| H8 | all | Tests, build, captures, quota, truth gate |

---

## 6. STOP conditions — none triggered

No authority conflict requires a stop. The six HOLD zones are OPEN items the contract
tells me to leave open, not blockers: N1, N4, N5, N7, N9, N11 and the plans/billing
decision. Every other zone has sufficient authority to implement.

Recorded for the CTO, not acted on: the seven inert header items (§4.1) and the draft PL
status (§4.5).

No Production. No `globalnewsai.live`. No provider activation. No specialist module.
