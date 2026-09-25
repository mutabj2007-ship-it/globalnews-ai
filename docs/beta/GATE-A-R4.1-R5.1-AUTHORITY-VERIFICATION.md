# GATE A — R4.1 + R5.1 AUTHORITY VERIFICATION

Issue #28, resumed under **CTO ruling C-2**. Branch `feature/beta-shell-r5-1`.
Base `408edb0d7d09256d526c6f524b939fb57a4ba279`. Date 2026-09-25.

Docs-only. **No source file modified by this commit.** Written before any source edit, as
C-2 requires.

C-1 (HOLD) is **resolved**: the two R4.1 packages named as missing in
`GATE-A-R5.1-AUTHORITY-CONFLICT-NOTE.md` §4 are present on disk under non-obvious outer
filenames, and both verify against the hashes the R5.1 register already recorded.

---

## 1. All four package hashes, as measured on disk

Directory: `D:\Desktop\GlobalNewsAI\Claude_Output`.

| Tier | Outer filename on disk | Bytes | Modified | SHA256 |
|---|---|---|---|---|
| **R5.1 desktop/tablet** | `desktop or tablet R5.1.zip` | 59,502,997 | 2026-09-25 08:18:32 | `a90954d1871293a202e9767cd12b3429b7dfda34099b7b354db22c6c3aa2c9bb` |
| **R5.1 phone** | `phone R5.1.zip` | 44,397,374 | 2026-09-25 08:19:42 | `85ecda572b1f64bb7e60beb1bf7451883578c1f8ca2b44b5989f090c6c6362be` |
| **R4.1 desktop/tablet** | `R1 review ZIPs and navigation conflicts26.zip` | 32,805,653 | 2026-09-25 06:32:57 | `9da210532e77968d1ac8cff3501f317dfc43fafc4a9dcf08a37e09dccf2494bc` |
| **R4.1 phone** | `R1 review ZIPs and navigation conflicts27.zip` | 24,322,854 | 2026-09-25 06:33:08 | `f843483c910ddc10a0540de3b71dab54ed7214d68622529d76aac2870878ffe0` |

### Internal roots — one top-level directory per ZIP

| ZIP | Internal root |
|---|---|
| `desktop or tablet R5.1.zip` | `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R5.1/` |
| `phone R5.1.zip` | `GNAI_BETA_LAUNCH_PHONE_DESIGN_R5.1/` |
| `R1 review ZIPs and navigation conflicts26.zip` | **`GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4/`** |
| `R1 review ZIPs and navigation conflicts27.zip` | **`GNAI_BETA_LAUNCH_PHONE_DESIGN_R4/`** |

---

## 2. SHA-over-filename matching

The authority record's filenames do not match the artifacts. **The hashes and the internal
roots do**, and per Issue #28 — *"Do not infer authority from filenames alone"* — the hash
is the identity. Resolution, stated once so it is not re-derived later:

| Authority record says | Actual carrier of that content | Basis |
|---|---|---|
| `R1 review ZIPs and navigation conflicts THIS.zip` = R5.1 desktop/tablet, sha `a90954d1…c2a9bb` | **`desktop or tablet R5.1.zip`** | sha256 matches byte-exactly; root `…DESKTOP_TABLET_DESIGN_R5.1` |
| `R1 review ZIPs and navigation conflicts THAT.zip` = R5.1 phone, sha `85ecda57…6362be` | **`phone R5.1.zip`** | sha256 matches byte-exactly; root `…PHONE_DESIGN_R5.1` |
| `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4/MANIFEST.txt`, 6128 B, `586e31c5c8aa4e93…` (`AUTHORITY_DELTA_REGISTER.md:21`) | **`R1 review ZIPs and navigation conflicts26.zip`** | internal manifest matches, below |
| `GNAI_BETA_LAUNCH_PHONE_DESIGN_R4/MANIFEST.txt`, 5239 B, `bfc96619aaa42e95…` (`AUTHORITY_DELTA_REGISTER.md:20`) | **`R1 review ZIPs and navigation conflicts27.zip`** | internal manifest matches, below |

**The two `…conflicts26/27.zip` files are the R4.1 packages, not stray review archives.**
The earlier note excluded them correctly on the evidence then available — they do not carry
an R5.1 hash — but they were never R5.1 candidates.

### Manifest verification — the R4.1 anchor

`AUTHORITY_DELTA_REGISTER.md:20-21` records the only upstream hashes that exist for R4.1
(the register at `:23` states the R4 authorities *"arrived as extracted folders, not as the
ZIP files"*, so no outer R4 ZIP hash was ever published). Both anchors verify:

| File | Expected bytes | Actual | Expected sha256 | Actual | Verdict |
|---|---|---|---|---|---|
| `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4/MANIFEST.txt` | 6128 | 6128 | `586e31c5c8aa4e93…` | `586e31c5c8aa4e93bb1d23001456eb7e5fbc870fdbd33a7e4177a2c6b124a4e4` | **MATCH** |
| `GNAI_BETA_LAUNCH_PHONE_DESIGN_R4/MANIFEST.txt` | 5239 | 5239 | `bfc96619aaa42e95…` | `bfc96619aaa42e95a10bc601fa4469285ab55336a3ac0341844f9a5208703842` | **MATCH** |

### Full manifest verification — every file in all four packages

Each package's `MANIFEST.txt` lists `sha256  path  (size)` per file. All were recomputed:

| Package | Files verified | Mismatched | Missing |
|---|---|---|---|
| R4.1 desktop/tablet | **51** | 0 | 0 |
| R4.1 phone | **45** | 0 | 0 |
| R5.1 desktop/tablet | **77** | 0 | 0 |
| R5.1 phone | **73** | 0 | 0 |
| **Total** | **246** | **0** | **0** |

### The baseline link, proved rather than asserted

`prototype/GNAI_Beta_Prototype.html` is byte-identical in **all four** packages:

```
d7bf7a4ceb7ba4a5c657935407b9c46fbb9c917460f6696228169bad9b9771c8   4,161,955 B
```

matching `R5.1 MANIFEST.txt:31`. R5.1's stated baseline and R4.1's own shipped Home
prototype are therefore the same bytes, so the delta chain is closed end to end.

---

## 3. R4.1 baseline / R5.1 delta precedence

Precedence in force for Gate A, from `AUTHORITY_DELTA_REGISTER.md:25`:

> Spatial v1.7 (Part I/II) > Part IV v1.2 R2 > Part V v1.0 R2 (§15 matrix wins over prose)
> > Ask v1.0 package > **R4.1 Beta package for Home and navigation**.
> Beta runtime capability claims follow **R4.1 ROUTE_MODULE_MATRIX.md**.

Applied to Home:

1. **R4.1 is the Home and navigation baseline.** `NAVIGATION.md:6` (R5.1): *"R4.1 approved
   Home styling."* `AUTHORITY_DELTA_REGISTER.md:45` (D16): *"R4.1 Home approved and
   frozen."*
2. **R5.1 changes only what `HOME_R4.1_DELTA.md` lists.** `HOME_R4.1_DELTA.md:3`: *"Only
   the items below differ. Hero, World Pulse, header, bottom bar, tokens, spacing and card
   styling are untouched."* That delta is the Intelligence-modules section, plus PROPOSED
   P1/P2 and a prototype-only image-loading fix.
3. **Tokens compose the same way.** `COMPONENTS_AND_TOKENS.md:2` (R5.1): *"Base: R4 token
   set"*, then delta R4→R5 and delta R5→R5.1. The R4 token set is now available, so the
   composition resolves.
4. **Runtime route claims follow R4.1 `ROUTE_MODULE_MATRIX.md`**, not the prototypes.

### Closure of the five missing artifacts from the conflict note §4

| # | Artifact required | Now available | Where |
|---|---|---|---|
| 1 | `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4` full package | **YES** — 51 files, manifest-verified | `README.txt`, `SPEC.md`, `NAVIGATION.md`, `COMPONENTS_AND_TOKENS.md`, `INTERACTIONS_AND_STATES.md`, `IMAGERY_SPEC.md`, `ROUTE_MODULE_MATRIX.md`, `CONTRACT_CONFLICTS.md`, `QA_LOG.md`, `REFERENCE_COMPARISON.md`, `R4_CHANGE_LOG.md`, `i18n/`, `tokens/`, `assets/`, `prototype/`, 12 desktop + tablet screenshots |
| 2 | `GNAI_BETA_LAUNCH_PHONE_DESIGN_R4` full package | **YES** — 45 files, manifest-verified | same document set, phone screenshots |
| 3 | R4.1 `ROUTE_MODULE_MATRIX.md` | **YES** | both R4.1 packages, 5,564 B, sha `2de173d8…f4cd` |
| 4 | R4 token set | **YES** | `tokens/tokens.css`, `tokens/tokens.json` in both R4.1 packages — the "Base: R4 token set" that `COMPONENTS_AND_TOKENS.md:2` composes from |
| 5 | Ruling on the implemented-Home divergence | **YES — and the premise was wrong** | R4.1 was authored against tree `00f974dcc601` of this branch and audited this Home’s own component set, so there is no divergence to rule on. See below |

### R4.1 was authored against this branch

`GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4/README.txt:8` and `MANIFEST.txt:3`:
*"SOURCE AUTHORITY: mutabj2007-ship-it/globalnews-ai, integration/beta-launch-convergence-r1
(tree 00f974dcc601)."*

`NAVIGATION.md §1` (R4.1) records the Home inventory it audited:
*"Home (Hero, GlobalDevelopments, HomepageSituationMap, Intelligence modules, HowItWorks,
Trust, Footer)"* — the component set this branch renders. R4.1 is therefore a design
direction **for this Home**, and "untouched" in `HOME_R4.1_DELTA.md:3` resolves against
R4.1's own frames, which are now in hand. Nothing is inferred from the M66 implementation.

### Package "DO NOT IMPLEMENT" banners

Both tiers carry them — R5.1 `README.txt:2` / `MANIFEST.txt:4`, and R4.1
`README.txt:4`: *"STATUS: REVIEW ONLY. DO NOT IMPLEMENT. Not a Beta handoff; coding agents
must not build from this package."*

These are **superseded for Gate A only**, by the Product Owner's registration in
`docs/beta/BETA-DESIGN-AUTHORITY-R5.1.md` (committed at `408edb0`) §7 "First implementation
gate" and by CTO ruling C-2. They are recorded here so the supersession is explicit and
bounded: it authorises Gate A implementation and nothing else. Every non-visual guard named
in §3 of that authority — evidence, provenance, source rights, data semantics, security,
quota, EN/PL integrity, route truthfulness, no-fabrication — remains in force.

R4.1 `README.txt:9` additionally records *"BLOCKED: Map, Conflict and Ask/Analysis design
parity"*, which is outside Gate A and stays blocked.

---

## 4. Precise Gate A scope

From `BETA-DESIGN-AUTHORITY-R5.1.md` §7 and Issue #28, with the authority now complete.

| # | Scope item | Status | Governing authority |
|---|---|---|---|
| 1 | Home / Beta Launch **desktop/tablet** | **IN** | R4.1 desktop frames (1440×900, 1920×1080, 1024×768, 768×1024) + R5.1 module delta |
| 2 | Home / Beta Launch **phone** | **IN** | R4.1 phone frames (360×800, 390×844, 430×932) + R5.1 module delta |
| 3 | Shared header / navigation **required by approved Home** | **IN, constrained** | Four destinations preserved exactly as they are. **N1 stays OPEN** → desktop header keeps its current two routable destinations; the 4-at-all-sizes proposal is not implemented |
| 4 | Footer | **IN** | R4.1 Home frames |
| 5 | Mobile navigation | **IN, constrained** | Existing four destinations and routes unchanged. **N11 (13/16px labels) and N2 (bar on every route) stay OPEN** |
| 6 | Module cards and approved states/destinations | **IN** | `INTELLIGENCE_MODULE_MATRIX.md` (registry-derived) + `HOME_R4.1_DELTA.md`. **P1 → Beta-parity fallback "Coming soon"**, **M3 icons OPEN** |
| 7 | Search / Ask entry presentation on Home | **IN, constrained** | Presentation only. **N4 (desktop search pill action) stays OPEN** — the pill's behaviour is not changed |
| 8 | Responsive at ≥1440, 430×932, 390×844, 360×800 | **IN** | R4.1 per-device tables (`NAVIGATION.md §4`) + R5.1 geometry |
| 9 | EN and PL | **IN** | Platform dictionary; R4.1 `i18n/i18n_en_pl.json` as reference. PL card descriptions in the R5.1 prototype are **drafts, not authority** |
| 10 | Real / governed Home data path only | **IN** | `lib/homeFeed.ts` unchanged; no fixture, no illustrative headline, no sample map mark, no sample credit value, no prototype geography, no prototype renderer code |

**Explicitly OUT:** Conflict, Economy, Energy, Market, Security, Humanitarian, Politics,
Country/Map and Ask/Analysis visual rewrites; any new route; any change to `/ask` vs
`/search` behaviour; Watch activation; Alpha or Production deploy; `globalnewsai.live`
binding; provider activation.

### Preserved by rule

- **Four navigation destinations**, unchanged: `/` · `/map` · `/ask` ·
  `#intelligence-modules` (`MobileBottomNav.tsx:29-32`).
- **`/ask` and `/search` stay distinct.** `/ask` = idle draft entry, 0 AI on arrival;
  `/search?q=` = explicit-query auto-run. N3 is the one closed navigation decision
  (`NAVIGATION.md:41`, R5.1; `CONTRACT_CONFLICTS.md` C2, R4.1) and is already conformant.
- **Ordinary browsing starts no metered AI.** Measured at 0 metered requests across eight
  before-captures; the same check gates the after-captures.

---

## 5. OPEN items — all still open, none closed by this commit

Canonical R5.1 list, `MANIFEST.txt:6`. R4.1 adds its own `CONTRACT_CONFLICTS.md` rows.

### Blocking or constraining a Gate A item

| ID | Source | Item | Effect on Gate A |
|---|---|---|---|
| N1 | `NAVIGATION.md:39` (R5.1), C12 (R4.1) | Desktop 2 destinations vs 4 at all sizes | Item 3 constrained — desktop header unchanged |
| N2 | `NAVIGATION.md:40` | Bottom bar on every primary route <1024 | Item 5 constrained — bar stays Home-only |
| N4 | `NAVIGATION.md:42` | Desktop search pill action | Item 7 constrained — presentation only |
| N11 | `NAVIGATION.md:49`, C14 (R4.1) | Bottom-nav labels 10px → 13/16px | Item 5 constrained — label size unchanged |
| P1 / M1 | `PROPOSED_DELTAS.md:6`, `INTELLIGENCE_MODULE_MATRIX.md:34` | Badge text "Coming soon" vs "Unavailable" | Item 6 — **Beta-parity fallback applied** |
| P2 | `PROPOSED_DELTAS.md:7`, `CATEGORY_COLOUR_TOKENS.md:2` | Category colour palette | Items 1/2/6 — **fallback applied**, R4.1 treatment |
| CC1–CC4 | `PROPOSED_DELTAS.md:9` | Security orange vs amber; Energy vs Developing amber; Politics violet; Science lime | sub-decisions of P2 |
| M2 | `INTELLIGENCE_MODULE_MATRIX.md:35` | Conflict destination `/conflict` vs `/map?domain=conflict` | Item 6 — registry default `/conflict` kept |
| M3 | `INTELLIGENCE_MODULE_MATRIX.md:36` | Icons: registry lucide-by-slot vs R4.1 Material Symbols | Item 6 — **see implementation note** |
| S1 | `NAVIGATION.md:50` | Intelligence tab active on module routes | Item 3 — not implemented |
| C11 | `CONTRACT_CONFLICTS.md` (R4.1) | Module cards pointing at `*-visual-preview` | Item 6 — destinations unchanged from the registry |

### Open elsewhere, untouched

D2 (Ask PEEK, `AUTHORITY_DELTA_REGISTER.md:31`) · **D6 / Spatial D1 map golden-frame
parity** (`:35`; needs `GOLDEN-01-world-evidence.png`, `GOLDEN-02-rwanda-selected.png` +
revision id + SHA256) · **D7 / Ask D6 alert-aware answer** (`:36`) · D17 (`:46`) ·
D18 (`:47`) · N5 · N6 · N7 · N8 · N9 (`NAVIGATION.md:43-47`) · S2 (`:52`) · F1 (`:51`) ·
R4.1 C3, C4, C6, C7, C8, C13.

Closed already, not by this commit: **N3** RESOLVED by CTO ruling; **N10** closed as
reference only; R4.1 C1, C2, C5, C10 resolved in R4; C9, C15 consistent.

**Ask D6, Spatial D1 and every navigation OPEN item remain open.** No OPEN decision is
answered anywhere in this work.

---

## 6. Implementation note carried into the next commit

`M3` (icon set) is OPEN and a module card cannot render without icons. The resolution that
answers no open question: **keep the icons already shipping on this branch**
(`IntelligenceModuleCard.tsx`, lucide names from `lib/intelligenceModules.ts`). That is the
current Beta state, so choosing it decides nothing — where M3 is later ruled for R4.1
Material Symbols, it is a one-map change. The same principle applies to P1 and P2: the
Beta-parity fallback is the status quo, and adopting the proposal remains a one-commit
change once the Product Owner rules.

---

## 7. Status

Verified at this commit: no file under `frontend/`, `backend/` or `shared/` modified; no
visual test deleted; no OPEN decision answered; no deploy; no domain binding; no provider
activation.

Prior Gate A analysis and the eight before-captures are in
`docs/beta/GATE-A-R5.1-IMPLEMENTATION-DELTA-R1.md`,
`docs/beta/GATE-A-R5.1-AUTHORITY-CONFLICT-NOTE.md` and
`docs/beta/evidence/gate-a-r5.1/`.
