# GATE A — R5.1 IMPLEMENTATION DELTA AND AUTHORITY CONFLICT REGISTER (R1)

Assignment: GitHub Issue #28 — BETA Gate A, R5.1 Home + shell implementation.
Authority: `docs/beta/BETA-DESIGN-AUTHORITY-R5.1.md`, `docs/BETA-LAUNCH-CONVERGENCE-R1.md`,
`docs/beta/BETA-PREFLIGHT-AUDIT-R1.md`.
Branch: `feature/beta-shell-r5-1`. Base: `408edb0d7d09256d526c6f524b939fb57a4ba279` (verified).
Date: 2026-09-25.

**Status: implementation NOT started. Source unmodified. One blocking authority conflict
(C-1) requires a ruling before Home appearance work can proceed.** This document is the
required pre-implementation output of Issue #28 steps 1–5 ("Required implementation
workflow: before editing"), plus the conflict register #28 asks for.

---

## 1. ZIP SHA256 verification — PASS, with a filename discrepancy

Both approved payloads verify **byte-exactly**. Neither declared filename exists.

| Role | Expected SHA256 | Actual file found | Actual SHA256 | Verdict |
|---|---|---|---|---|
| Desktop / tablet | `a90954d1871293a202e9767cd12b3429b7dfda34099b7b354db22c6c3aa2c9bb` | `desktop or tablet R5.1.zip` (59,502,997 B, 2026-09-25 08:18:32) | `a90954d1871293a202e9767cd12b3429b7dfda34099b7b354db22c6c3aa2c9bb` | **MATCH** |
| Phone | `85ecda572b1f64bb7e60beb1bf7451883578c1f8ca2b44b5989f090c6c6362be` | `phone R5.1.zip` (44,397,374 B, 2026-09-25 08:19:42) | `85ecda572b1f64bb7e60beb1bf7451883578c1f8ca2b44b5989f090c6c6362be` | **MATCH** |

Declared in #28 and in `BETA-DESIGN-AUTHORITY-R5.1.md` §1 but **absent from
`D:\Desktop\GlobalNewsAI\Claude_Output`**:
`R1 review ZIPs and navigation conflicts THIS.zip`,
`R1 review ZIPs and navigation conflicts THAT.zip`.

Two other same-day files were hashed and **excluded** — neither is an approved payload:

| File | SHA256 | Verdict |
|---|---|---|
| `R1 review ZIPs and navigation conflicts26.zip` | `9da210532e77968d1ac8cff3501f317dfc43fafc4a9dcf08a37e09dccf2494bc` | not an approved hash |
| `R1 review ZIPs and navigation conflicts27.zip` | `f843483c910ddc10a0540de3b71dab54ed7214d68622529d76aac2870878ffe0` | not an approved hash |

**Why this is not a STOP.** The STOP condition is keyed on the SHA256 ("Verify both ZIP
SHA256 values exactly. If either differs, STOP"). Neither differs, and the two matching
payloads carry the correct roles — the desktop hash resolves to the desktop/tablet package
and the phone hash to the phone package, each confirmed by its internal directory name
(`GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R5.1`, `GNAI_BETA_LAUNCH_PHONE_DESIGN_R5.1`).
#28's own rule — "Do not infer authority from filenames alone" — makes the hash the
identity, and the hash verifies. **Recommended housekeeping: correct the two filenames in
`BETA-DESIGN-AUTHORITY-R5.1.md` §1 so the authority record matches the artifacts.**

---

## 2. R5.1 documents read

Both packages read in a scratch location outside the repo. Desktop/tablet package
(78 files) and phone package (74 files); the seven `.md`/`.txt` authority documents are
byte-identical across the two ZIPs except `SPEC.md` device sections.

Read in the package's own stated read order:

| # | Document | Read |
|---|---|---|
| 0 | `R5_1_CHANGE_LOG.md` | yes — 16 numbered changes |
| 0a | `HOME_R4.1_DELTA.md` | yes — the Home delta table, the only Home authority |
| 0b | `INTELLIGENCE_MODULE_MATRIX.md` | yes — 9 modules, M1/M2/M3 open |
| 0c | `PROPOSED_DELTAS.md` | yes — P1, P2, CC1–CC4 |
| 0d | `CATEGORY_COLOUR_TOKENS.md` | yes — 9 `--c-*` tokens, both themes, measured contrast |
| 1 | `AUTHORITY_DELTA_REGISTER.md` | yes — D1–D20, precedence chain |
| 2 | `NAVIGATION.md` | yes — 4 destinations, shell geometry, N1–N11/S1/S2/F1 |
| 3 | `SPEC.md` | yes — §A shell, §B Ask, §C Map, §D Conflict, §E coverage |
| 4 | `INTERACTIONS_AND_STATES.md` | yes |
| 5 | `COMPONENTS_AND_TOKENS.md` | yes — component sizes, token deltas, contrast table |
| 6 | `MODULE_COVERAGE.md` | yes |
| 7 | `QA_CHECKLIST.md` | yes |
| 8 | `ASSETS_MANIFEST.md` | yes |
| 10 | `MANIFEST.txt` | yes |
| — | `README.txt` (both packages) | yes |
| — | `prototype/GNAI_Beta_Home_R5.1.html` | yes — 8,296,940 chars; 8,100,852 are 39 inlined base64 images; ~196 KB of actual markup analysed |
| — | `prototype/GNAI_Beta_Prototype.html` (R4.1 baseline) | present, byte-identical per MANIFEST |
| — | `tokens/tokens.css`, `tokens/tokens.json` | yes |

---

## 3. R4.1 → R5.1 implementation delta

`HOME_R4.1_DELTA.md` scopes R5.1's change precisely: *"Only the items below differ. Hero,
World Pulse, header, bottom bar, tokens, spacing and card styling are untouched."*
R5.1 therefore changes **the Intelligence-modules section and nothing else**, plus two
PROPOSED items and a prototype-only loading fix.

### 3.1 Approved, non-OPEN (implementable once C-1 is ruled)

| # | Element | R4.1 | R5.1 | Repo state |
|---|---|---|---|---|
| 1 | Card list | 9 cards: AI Research Assistant, World (Active→Home), Country, Evidence & Source Comparison, Economy, Conflict, Market, Timeline, Forecast | 9 cards in registry order: Security, World, Country, Politics, Economy, Conflict, Market, Humanitarian, Energy | **already conformant** — `lib/intelligenceModules.ts` |
| 2 | Statuses | 4 active · 2 preview · 3 coming soon | 1 active · 7 preview · 1 unavailable | **already conformant** |
| 3 | World Intelligence | Active, opened Home | no route, not clickable | **already conformant** (`comingSoon`, no destination) |
| 4 | Card descriptions | design copy | exact Beta EN dictionary strings | **already conformant** |
| 5 | EN / PL titles | — | exact per matrix | **already conformant** — verified all 18 strings |
| 6 | Card route line | none | route in mono, or "No route" | **absent** — to add |
| 7 | Card note | none | "Opens preview" | **absent** — to add |
| 8 | Summary line | none | "9 modules · 1 active · 7 preview · 1 unavailable", computed | **partial** — ring renders "9 modules · 1 active" only |
| 9 | Section subtitle | "Only Active modules open…" | "Active opens a working surface. Preview opens a routed surface whose data and providers are not fully connected…" | **absent** — to add |
| 10 | Badge colours | Preview and Coming soon both muted | Preview uses `--dev` + eye icon; unavailable muted + block icon | **differs** |
| 11 | Card border | dashed for any non-active | dashed **only** for unavailable; solid for Active and Preview | **differs** |
| 12 | Briefing image category word | white | dark-theme category value over scrim | n/a — no briefing section implemented |

Verified already-conformant items, so no change is required for them:
`stateLabels.comingSoon` is already `'Coming soon'` (the P1 fallback), registry order and
states already match the matrix exactly, and all nine EN plus all nine PL module titles
match the matrix strings character-for-character. The matrix was generated by reading this
repository at tree `00f974dcc601`, which is why the data layer already conforms — **the
entire R5.1 delta is presentational.**

### 3.2 PROPOSED — not Beta parity, Product Owner decision

| ID | Item | R5.1 shows | Beta-parity fallback | Action taken |
|---|---|---|---|---|
| P1 | Badge text for `comingSoon` | "Unavailable", block icon, dashed border; summary "1 unavailable" | "Coming soon" from the registry; summary "1 coming soon" | **fallback** — registry text already in place, unchanged |
| P2 | Category colour on story labels, briefing rows, module icon + title | 9 `--c-*` tokens, light + dark, all ≥4.5:1 | R4.1: labels `--mut`, module icon/title by status | **not applied** — see C-2 |

P2 carries four unresolved sub-decisions: CC1 Security orange vs registry amber, CC2
Energy amber vs Developing/Preview amber, CC3 Politics violet vs Humanitarian/Ask, CC4
Science lime (no registry colour).

### 3.3 OPEN items encountered, left untouched

None of these was acted on, and no answer was inferred for any of them.

| ID | Item | Status | Gate A component it touches |
|---|---|---|---|
| N1 | Desktop header 2 destinations vs 4 at all sizes | OPEN | **Shared header** (scope item 3) |
| N2 | Bottom bar on every primary route below 1024 | OPEN | Mobile navigation (item 5) |
| N4 | Desktop search pill action | OPEN | **Search/Ask entry on Home** (item 7) |
| N5 | `/saved` route | OPEN (not drawn) | — |
| N6 | `/story/:id` | OPEN | — |
| N7 | Explore / category chips | OPEN | — |
| N8 | Map below 1024 | OPEN | — |
| N9 | Notifications | OPEN | — |
| N11 | Bottom-bar labels 13/16px, 2 lines | OPEN (owner sign-off) | Mobile navigation (item 5) |
| S1 | Intelligence tab active on module routes | OPEN | Shared header |
| S2 | Ask phone 46px top bar vs brand bar | OPEN | — |
| F1 | Withhold Follow in Part V NEW | OPEN | — |
| M1 | `comingSoon` badge text | OPEN → P1 fallback applied | Module cards (item 6) |
| M2 | Conflict destination `/conflict` vs `/map?domain=conflict` | default `/conflict` = registry, already in place | Module cards |
| M3 | Icons: registry lucide by slot vs prototype Material Symbols | **OPEN** | **Module cards** (item 6) |
| P1 | Badge text | OPEN → fallback | Module cards |
| P2 | Category colours | OPEN → not applied | Module cards |
| CC1–CC4 | Category hue sub-decisions | OPEN | Module cards |
| D2 | Ask PEEK content | OPEN — CTO ruling | — (Ask, not Gate A) |
| D6 | D1 map golden-frame parity | OPEN | — (Map, not Gate A) |
| D7 | Ask D6 alert-aware answer | OPEN | — |
| D17 | 861–1023 Ask split | OPEN | — |
| D18 | Ask credit pill | owner to confirm | — |

N3 is the one RESOLVED navigation decision (`/ask` idle + draft, `/search` keeps
auto-run). **It is already implemented correctly** — see §6.

### 3.4 Explicitly not implementable from this package

`SPEC.md` covers **§A shared shell, §B Ask AI, §C World Map/Spatial, §D Conflict**. It does
**not** specify Home. Home's only authority in the package is `HOME_R4.1_DELTA.md`, which
is a delta *against R4.1*, plus the review-only R5.1 Home prototype.

---

## 4. Exact existing components Gate A would change

Identified and read; none modified.

| Gate A item | Existing file(s) | Current state |
|---|---|---|
| 1–2 Home desktop + phone | `frontend/src/app/page.tsx` | renders `NavBar`, `LiveStatusStrip`, `Hero`, `HeroFocusProvider`, `GlobalDevelopments`, `TodayWorkspace`, `IntelligenceEngineSection`, `HowItWorks`, `TrustSection`, `Footer`, `MobileBottomNav` |
| 6 Module cards | `frontend/src/components/home/IntelligenceEngineSection.tsx` (210 ln), `IntelligenceEngineRing.tsx` (484 ln), `IntelligenceModulePanel.tsx` (387 ln), `IntelligenceModuleCard.tsx`, `moduleAccentClasses.ts`, `intelligenceEngineGeometry.ts` | radial HUD "Intelligence Engine", GN-CD-132→156 geometry |
| 6 Module cards (retired) | `IntelligenceModulesDesktop.tsx`, `IntelligenceModulesMobile.tsx` | **RETIRED and unimported** — `page.tsx:51` records they were "replaced by IntelligenceEngineSection"; still on disk |
| 3 Shared header | `frontend/src/components/navigation/NavBar.tsx`, `lib/navModel.ts`, `lib/navigation.ts` | 9 rendered items, **2 routable** (`/`, `/map`), 7 `kind:'unavailable'` |
| 5 Mobile navigation | `frontend/src/components/navigation/MobileBottomNav.tsx` | **exactly the 4 approved destinations**: `/`, `/map`, `/ask`, `#intelligence-modules` |
| 4 Footer | `frontend/src/components/layout/Footer.tsx` | implemented |
| 6 Registry | `frontend/src/lib/intelligenceModules.ts` | **already matches the matrix** |
| 9 EN/PL | `lib/i18n/dictionaries/en.ts` §intelligenceModules, `pl.ts` | titles already exact; summary/subtitle/route-note keys absent |
| 10 Data path | `lib/homeFeed.ts` | real governed news path; `NewsStartupValidator` fail-closed against mock in production |

**Anchor constraint:** `id="intelligence-modules"` currently lives on
`IntelligenceEngineSection` and is the target of `MobileBottomNav`'s Intelligence tab. Any
replacement must carry it, or destination 4 of the four approved destinations breaks.

---

## 5. Authority conflicts

### C-1 — BLOCKING. The approved Home appearance target does not exist in the supplied authority.

`BETA-DESIGN-AUTHORITY-R5.1.md` §2 directs: *"Use the R5.1 Home copy as the approved
appearance authority for Home / Beta Launch appearance"* and *"R4.1 is not the
implementation target where R5.1 explicitly changes it"* — which makes R4.1 the
implementation target everywhere R5.1 does **not** change it. `HOME_R4.1_DELTA.md` changes
only the Intelligence-modules section. Register **D16** states *"R4.1 Home approved and
frozen"*, and the precedence chain ends *"> R4.1 Beta package for Home and navigation."*

So the approved appearance target for Home is: **R4.1 Home, plus the R5.1 module delta.**

Three measured facts make that target unavailable:

1. **The R4.1 design package is not present.** Neither R5.1 ZIP contains a
   `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4` or `..._PHONE_DESIGN_R4` directory — each
   ZIP contains exactly one top-level `..._R5.1` directory. `AUTHORITY_DELTA_REGISTER.md`
   lists only the two R4 `MANIFEST.txt` files as "authorities read", not the packages
   themselves. A filesystem search of `D:\Desktop\GlobalNewsAI` found no such package.
   The only R4.1 artifact supplied is `prototype/GNAI_Beta_Prototype.html` — a
   review-only prototype with no spec, no token document and no screenshots.
2. **The implemented Home is a different design lineage.** It is the M66 / GN-CD "Claude
   Design" Home (Hero HUD, `LiveStatusStrip`, `GlobalDevelopments`, `TodayWorkspace`,
   radial `IntelligenceEngineSection`, `HowItWorks`, `TrustSection`). The R4.1/R5.1 Home is
   a different product surface: hero A/B, World Pulse, "Your world in 60 seconds" briefing
   with key facts, For-you feed, category chips, story cards with save/follow, plans,
   notifications, saved/following tabs — roughly 150 distinct content keys in the R5.1 Home
   copy. The two are not variants of one design.
3. **R5.1 never compares itself to the implemented Home.** Its baseline is R4.1 throughout,
   and it declares hero, World Pulse, header, bottom bar, tokens, spacing and card styling
   "untouched" — statements about R4.1, not about this codebase.

**Consequence.** Implementing Gate A items 1 and 2 as written means building the R4.1 Home
from a review-only prototype whose README says *"REVIEW ONLY. DO NOT IMPLEMENT"* and whose
*"data, marks, figures and places are illustrative samples"*, using a template dialect
(`sc-for`, `sc-if`, `{{ }}`) that is prototype renderer code. #28 forbids shipping
prototype renderer code, prototype geography and illustrative headlines as live content,
and `BETA-DESIGN-AUTHORITY-R5.1.md` §4 forbids redesigning beyond the R5.1 authority.
There is no approved, non-prototype specification of the surrounding Home to reproduce
faithfully.

**Two readings, materially different work. This is the ruling required.**

- **Narrow** — Gate A changes only the Intelligence-modules section (R5.1's actual delta)
  on the existing Home, leaving hero/feed/header/footer as they are. Bounded and
  well-specified by the delta table in §3.1 plus the prototype's module markup and
  `COMPONENTS_AND_TOKENS.md`. Cost: it replaces the Product-Owner-approved GN-CD radial
  Intelligence Engine with a card grid and breaks 8 accepted spec suites (§5 C-3).
- **Wide** — Gate A replaces the whole Home with R4.1 + module delta. Matches §2's plain
  words, but requires the R4 design package, which is not supplied, and is far beyond the
  ten numbered Gate A items.

Recommendation: **Narrow**, plus supply of the R4 packages if Wide is intended. Narrow is
what `HOME_R4.1_DELTA.md` actually authorises changing; Wide cannot be executed faithfully
from what exists.

### C-2 — P2 category colours: repo authority and package contradict each other

`BETA-DESIGN-AUTHORITY-R5.1.md` §2 names *"category title colours"* as approved appearance
authority. The package marks the same thing **PROPOSED P2, not Beta parity**, a Product
Owner decision with four open sub-decisions (CC1–CC4). §6 of the same repo authority says
*"Anything marked OPEN in the R5.1 package is not engineering discretion"* and *"A
screenshot is not authority for an OPEN decision."*

§6's enumerated list (navigation, Ask PEEK, D1 map parity) does not include P2, which is
why §2 can be read as a ruling that accepts it. Both readings are available from the same
document. **Not applied**, pending the ruling; the Beta-parity fallback is in place. The
nine tokens with measured contrast are ready to apply in one commit if P2 is confirmed.

### C-3 — Stale presentation pins that the narrow reading would break

`BETA-DESIGN-AUTHORITY-R5.1.md` §3 supersedes stale byte/SHA/source-text presentation
freezes where they conflict, and requires obsolete pins be **replaced with behavioural and
rendered gates, not deleted**. Under the narrow reading, eight suites pin the radial engine
on Home and would need replacement gates:

`components/home/homepage.architecture.spec.ts`, `homepageLocalization.spec.ts`,
`intelligenceEngineCanvas.spec.ts`, `intelligenceEngineHud.spec.ts`,
`intelligenceModuleClientBoundary.spec.ts`, `masterRecomposition.spec.ts`,
`components/layout/claudeDesignFoundation.spec.ts`, `components/today/todayWorkspace.spec.ts`.

Additionally `components/home/engineGeometry.spec.ts` reproduces GN-CD-145 row by row, and
`intelligenceEngineGeometry.ts` holds released ring coordinates. Removing the engine from
Home does not delete these files' subject, but it does end their relevance to Home.

No pin has been touched.

### C-4 — Filename discrepancy in the authority record

§1 above. Hashes verify; the two filenames in `BETA-DESIGN-AUTHORITY-R5.1.md` §1 and #28
do not exist on disk.

### C-5 — M3 icons are OPEN but the card grid cannot render without an icon set

The matrix records M3 as open: the registry carries lucide names inherited by ring slot
(Security inherits `Search`, Politics `ScanSearch`, Humanitarian `History`, Energy `Radar`
— semantically wrong for the module that now occupies the slot), while the prototype uses
Material Symbols chosen by meaning (`security`, `public`, `pin_drop`, `account_balance`,
`show_chart`, `shield`, `trending_up`, `volunteer_activism`, `bolt`). The R5.1 default is
Material Symbols. Any card grid must pick one. Flagged, not decided.

---

## 6. Read-only verification performed (no source modified)

| Check | Result |
|---|---|
| Base commit | `408edb0d7d09256d526c6f524b939fb57a4ba279` — matches #28 |
| Four approved destinations | `MobileBottomNav.tsx:29-32` = `/`, `/map`, `/ask`, `#intelligence-modules` — **preserved, unchanged** |
| `#intelligence-modules` anchor | exists on `IntelligenceEngineSection.tsx:85` — live target of destination 4 |
| `/ask` vs `/search` separation | **preserved** — `/ask` renders `AskFrameScreen` and runs only on explicit `onSubmit`; `/search` remains the analysis workspace. Not merged, not redirected |
| N3 (RESOLVED) conformance | already correct: `/ask` opens idle, `/search?q=` auto-runs |
| Registry ↔ matrix | 9 modules, order, states, routes, clickability gate all match |
| EN/PL module titles | all 18 match the matrix character-for-character |
| `stateLabels.comingSoon` | `'Coming soon'` (EN) / `'Wkrótce'` (PL) — P1 fallback already in place |
| Home data path | `lib/homeFeed.ts` → real news pipeline; no fixture import; mock only when zero real providers, and `NewsStartupValidator` refuses to boot production on an unusable key |
| Fixture leak into Home | none — no fixture module is imported by `app/page.tsx` or its component tree |

### 6.1 Build and test baseline (measured)

| Command | Result |
|---|---|
| `npm run build:shared` | **exit 0** |
| `npm run build:frontend` | **exit 0** — 35 routes emitted |
| `npx jest` (frontend) | **10 suites / 15 tests fail**, 283 suites / 6482 tests pass, 13 skipped |

The ten failing suites are the **identical set** recorded on the Beta base in
`BETA-PREFLIGHT-AUDIT-R1.md` §G-2 (`visualAuthority.spec.ts`,
`visualAuthorityCorrection.spec.ts`, `mktRetained`, `marketSyntheticHarness`,
two admin surfaces, `adminProvenance`, `c911RequestEconomy`, `m51PhaseB`,
`mapShellRouteWiring`). This task changed no source, so the baseline is unchanged —
and it confirms C-3's point independently: **the byte and sha256 presentation freezes are
already failing before any R5.1 work begins.**

### 6.2 Before-captures — 8 frames, four approved widths, EN and PL

Built app (`next start`, production build) at `127.0.0.1:3311`.
Harness: `docs/beta/evidence/gate-a-r5.1/capture-home.mjs`.
Frames and machine-readable probe: `docs/beta/evidence/gate-a-r5.1/before/`.

| Measured | Result |
|---|---|
| Captures | 8 — 1440×900, 430×932, 390×844, 360×800, each EN and PL |
| HTTP | 200 on all 8 |
| Locale | `<html lang>` correct on all 8 (`en`/`pl`); EN and PL frames differ in bytes, so the locale genuinely switched |
| **Metered AI / provider requests during ordinary Home browsing** | **0 across all 8 captures** — satisfies §4's "no provider-on-open or AI-on-browse" and #28's quota check |
| Horizontal overflow | **none** at any of the four widths, either locale |
| `#intelligence-modules` anchor | present in all 8 — destination 4 of the four approved destinations resolves |
| Console errors | 2 per capture, both `500` from the Home feed read — the backend is not running locally (no `DATABASE_URL`), so Home renders its degraded path. Not a defect introduced here |

**A finding worth the CTO's attention, independent of C-1.** In every one of the eight
frames the module names, the status badges and the summary line are present in the DOM but
**absent from rendered `innerText`** — measured as `dom-only`, never `dom+visible`:

| R5.1 element | BEFORE state |
|---|---|
| Module titles (Security / World / Country / Energy) | **dom-only — not visible text** |
| "Coming soon" badge | **dom-only** |
| "Preview" badge | **dom-only** |
| Summary line ("9 modules…") | **dom-only** |
| Card route line (`/security-visual-preview` …) | **absent entirely** |

The radial `IntelligenceEngineSection` keeps module identity in hover/focus-revealed
panels, so a first-time reader landing on Home sees no module name as text at any of the
four widths. Definition of Gate A done (§10) requires that a first-time user "understand
the major actions and module choices". That is the gap R5.1's card grid closes, and it is
the strongest independent argument for the narrow reading in C-1.

---

## 7. What is ready to execute the moment C-1 is ruled

Under the **narrow** reading, the implementation is fully specified and can land in one
pass:

1. `IntelligenceModulesSection.tsx` — server component carrying `id="intelligence-modules"`
   and `scroll-mt` for the sticky header: heading, computed summary line, R5.1 subtitle,
   responsive grid, nine cards at `min-height:84px` / `padding:14` / `radius:16` /
   `gap:12`, icon + title, description, route in mono or "No route", "Opens preview" note,
   status pill with icon, dashed border only for `comingSoon`, solid for Active and
   Preview, ≥44px targets, `isModuleNavigable` as the sole clickability gate.
2. Dictionary additions in `en.ts` and `pl.ts`: section title, R5.1 subtitle, `routeNone`,
   `opensPreview`, and invariant plural forms for preview and coming-soon so the summary
   line composes without inventing Polish declensions (`previewForms`,
   `comingSoonForms`), reusing the existing `pluralWithForms` helper.
3. `app/page.tsx` — swap `IntelligenceEngineSection` for the new section.
4. Replacement gates for the eight suites in C-3: rendered/behavioural assertions on the
   R5.1 result (card count, registry order, badge text, border rule, clickability, anchor
   presence, EN/PL parity, no illustrative strings) in place of source-text pins.
5. Responsive verification at the four widths, EN and PL, with after-captures.

Blocked until ruled: P2 token application (C-2), M3 icon set (C-5), and every navigation
item in §3.3 — which together mean Gate A items **3 (shared header)**, **5 (mobile nav
label geometry)** and **7 (search/Ask entry presentation)** cannot be completed as drawn
even under the narrow reading. Items **1, 2, 4** depend on C-1.

---

## 8. Hard-stop compliance

No Alpha deploy. No Production deploy. No `globalnewsai.live` binding. No provider
activation. No specialist module started. No source file modified. No visual test deleted.
No OPEN decision answered.
