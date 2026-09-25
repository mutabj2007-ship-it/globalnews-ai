# GATE A — R5.1 AUTHORITY CONFLICT NOTE

Issue #28. Branch `feature/beta-shell-r5-1`, base `408edb0d7d09256d526c6f524b939fb57a4ba279`.
Date 2026-09-25.

**CTO ruling applied: C-1 HOLD.** No R5.1 Home visual change implemented. The task was
**not** narrowed to the module section, and no "untouched" Home area was inferred from the
current M66 implementation. **All source preserved unchanged.**

Line references are to the extracted package documents. The six documents cited below are
**byte-identical in both approved ZIPs** (verified by sha256): `HOME_R4.1_DELTA.md`,
`README.txt`, `AUTHORITY_DELTA_REGISTER.md`, `PROPOSED_DELTAS.md`, `NAVIGATION.md`,
`INTELLIGENCE_MODULE_MATRIX.md`. Package roots:
`GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R5.1/` and `GNAI_BETA_LAUNCH_PHONE_DESIGN_R5.1/`.

---

## 1. Exact R5.1 files and lines stating DO NOT IMPLEMENT

Present in **both** packages at the same lines.

| File : line | Text |
|---|---|
| `README.txt:2` | `REVIEW ONLY. DO NOT IMPLEMENT. NO DEPLOYMENT.` |
| `MANIFEST.txt:4` | `status: REVIEW ONLY. DO NOT IMPLEMENT. NO DEPLOYMENT` |
| `R5_1_CHANGE_LOG.md:3` | "Corrections to R5 before coding-agent handoff. **Review only. No implementation or deployment.**" |
| `SPEC.md:2` | "**Review only.** Home review destination = `prototype/GNAI_Beta_Home_R5.1.html` …" |

Supporting statements that the Home artifact is a *review destination*, not an
implementation target:

| File : line | Text |
|---|---|
| `README.txt:5` | "**Review destination** for Home: `prototype/GNAI_Beta_Home_R5.1.html` … **Reference only**: `prototype/GNAI_Beta_Prototype.html` (R4.1, unchanged, byte-identical)." |
| `MANIFEST.txt:5` | "Home **review destination**: `prototype/GNAI_Beta_Home_R5.1.html` … **Reference**: `prototype/GNAI_Beta_Prototype.html` = R4.1, unchanged, byte-identical" |
| `AUTHORITY_DELTA_REGISTER.md:45` (D16) | "Home tab opens the Home R5.1 copy (**review destination**). R4.1 file ships unchanged as reference." |
| `HOME_R4.1_DELTA.md:3` | "**Review destination** (corrected copy): `prototype/GNAI_Beta_Home_R5.1.html`" |
| `R5_1_CHANGE_LOG.md:37` (#14) | "Every Home handoff statement now names `prototype/GNAI_Beta_Home_R5.1.html` as the **review destination** and R4.1 as unchanged reference." |

Two further constraints on treating the prototype as an implementation source:

| File : line | Text |
|---|---|
| `README.txt:12` | "**All data, marks, figures and places are illustrative samples.** Map geography is Natural Earth 1:110m outlines, NOT the D1 basemap." |
| `MODULE_COVERAGE.md:2` | "**Home styling approval does not approve any specialist view below.**" |

---

## 2. Exact statements defining R5.1 as a delta relative to R4.1

| File : line | Text |
|---|---|
| `HOME_R4.1_DELTA.md:1` | "# Home **delta from the R4.1 baseline** · R5.1" |
| `HOME_R4.1_DELTA.md:2` | "**Baseline:** `prototype/GNAI_Beta_Prototype.html` — R4.1, byte-identical (SHA256 in MANIFEST.txt matches R4). Kept unchanged in this package as the reference." |
| `HOME_R4.1_DELTA.md:3` | "**Only the items below differ.** Hero, World Pulse, header, bottom bar, tokens, spacing and card styling are **untouched**." |
| `HOME_R4.1_DELTA.md:6` | Column headers of the delta table: `\| Element \| R4.1 \| R5.1 \|` — the entire Home authority is expressed as a two-column comparison against R4.1 |
| `HOME_R4.1_DELTA.md:23` | Review-panel label: `"HOME R5.1 = R4.1 + MODULE DELTA …"` |
| `README.txt:6` | "`GNAI_Beta_Home_R5.1.html` = **R4.1 plus** the Intelligence-module delta, proposed category colours and an image-loading fix" |
| `AUTHORITY_DELTA_REGISTER.md:45` (D16) | "**R4.1 Home approved and frozen** … Home R5.1 **differs from R4.1 only as listed in** HOME_R4.1_DELTA.md" |
| `AUTHORITY_DELTA_REGISTER.md:25` | "Precedence used: … Ask v1.0 package **> R4.1 Beta package for Home and navigation.** Beta runtime capability claims **follow R4.1 ROUTE_MODULE_MATRIX.md**." |
| `NAVIGATION.md:3` | "## Destinations (**unchanged from R4.1**)" |
| `NAVIGATION.md:6` | Home destination: "**R4.1 approved Home styling.** In the review prototype: opens `GNAI_Beta_Home_R5.1.html` (**R4.1 + module delta**)" |
| `NAVIGATION.md:22` | "`GNAI_Beta_Prototype.html` (**R4.1 baseline**, byte-identical, reference only)" |
| `NAVIGATION.md:26` | "Home Country card → World Map inside the Home prototype (**R4.1 behaviour**)." |
| `COMPONENTS_AND_TOKENS.md:2` | "**Base: R4 token set.** Delta R5→R5.1: … Delta R4→R5: …" — the token system is also defined only as a delta |
| `PROPOSED_DELTAS.md:7` (P2) | Fallback if rejected: "**R4.1 treatment:** labels `--mut`, module icon/title by status" |
| `CATEGORY_COLOUR_TOKENS.md:2` | "Beta-parity fallback: **R4.1 grey category labels (--mut)**." |
| `INTELLIGENCE_MODULE_MATRIX.md:23` | "**Removed since R4.1** (no longer cards …): AI Research Assistant …; Evidence & Source Comparison …; Timeline …; Forecast → not present." |
| `INTELLIGENCE_MODULE_MATRIX.md:36` (M3) | "prototype keeps **R4.1 Material Symbols** chosen by meaning" |
| `AUTHORITY_DELTA_REGISTER.md:32` (D3) | "Shell below 1024 keeps the **R4.1 bottom bar** and a 46px top bar" |
| `AUTHORITY_DELTA_REGISTER.md:34` (D5) | "Not adopted. **R4.1 four-tab bar**" |
| `MODULE_COVERAGE.md:4` | Column header: "Current Beta presence (**R4.1 matrix**)" |

**Scope gap this creates.** `SPEC.md:2` states its own coverage: *"This spec covers the
shell, Ask AI, World Map/Spatial and Conflict."* **`SPEC.md` does not specify Home.** Home's
only authority in the package is the delta table in `HOME_R4.1_DELTA.md`, which is
meaningless without R4.1, plus a prototype marked review-only.

---

## 3. All OPEN items that block Gate A

The package's own canonical OPEN list, `MANIFEST.txt:6`, verbatim:

> `OPEN: Ask D6 alert-aware answer (not drawn); D1 map golden-frame parity (needs GOLDEN-01-world-evidence.png, GOLDEN-02-rwanda-selected.png + revision + SHA256); P1; P2; D2; D17; D18; M1–M3; CC1–CC4; N1–N11 except N3; S1, S2, F1`

`README.txt:24`: *"**Every N1–N11 item except N3 remains an owner decision.** No route is
added or approved."*

### 3.1 OPEN items that directly block a numbered Gate A scope item

| ID | File : line | Item | Gate A item blocked |
|---|---|---|---|
| **N1** | `NAVIGATION.md:39` | Desktop header shows 2 destinations; proposed 4 at all sizes. Fallback: "Keep 2 on desktop; **R5 desktop frames then need the header reworked**" | **3 — shared header/navigation** |
| **N4** | `NAVIGATION.md:42` | Desktop search pill has no action; proposed opens Ask focused. Fallback: hide the pill | **7 — Search/Ask entry on Home** |
| **N11** | `NAVIGATION.md:49` | Bottom-bar labels 10px → 13/16px, wrap to 2 lines. "OPEN (owner sign-off)" | **5 — mobile navigation** |
| **N2** | `NAVIGATION.md:40` | Bottom bar on every primary route below 1024px | **5 — mobile navigation** |
| **P1 / M1** | `PROPOSED_DELTAS.md:6`, `INTELLIGENCE_MODULE_MATRIX.md:34` | Badge text for `comingSoon`: registry "Coming soon" vs requested "Unavailable"; also the summary line wording | **6 — module cards and approved states** |
| **P2** | `PROPOSED_DELTAS.md:7`, `CATEGORY_COLOUR_TOKENS.md:2` | Category colour on story labels, briefing rows, module icon + title. "**PROPOSED … Not Beta parity**" | **1, 2, 6 — Home appearance and module cards** |
| **CC1–CC4** | `PROPOSED_DELTAS.md:9` | CC1 Security orange vs Beta amber; CC2 Energy amber vs Developing/Preview amber; CC3 Politics violet vs Humanitarian/Ask; CC4 Science lime (no Beta colour) | sub-decisions of P2 |
| **M3** | `INTELLIGENCE_MODULE_MATRIX.md:36` | Icons: registry lucide inherited by slot (Security uses `Search`) vs prototype R4.1 Material Symbols. No card can render without an icon set | **6 — module cards** |
| **M2** | `INTELLIGENCE_MODULE_MATRIX.md:35` | Conflict destination `/conflict` vs `/map?domain=conflict` | 6 — card destinations |
| **S1** | `NAVIGATION.md:50` | Intelligence tab active state on module routes | 3 — shared header |

### 3.2 OPEN items outside Gate A, recorded for completeness

| ID | File : line | Item |
|---|---|---|
| D6 / D1 parity | `README.txt:21`, `AUTHORITY_DELTA_REGISTER.md:35` | Map golden-frame parity; needs `GOLDEN-01-world-evidence.png`, `GOLDEN-02-rwanda-selected.png` + revision id + SHA256 |
| D7 / Ask D6 | `README.txt:19`, `AUTHORITY_DELTA_REGISTER.md:36` | Ask alert-aware answer not drawn; depends on Watch, inactive in Beta |
| D2 | `AUTHORITY_DELTA_REGISTER.md:31` | Ask PEEK content — CTO ruling |
| D17 | `README.txt:22`, `AUTHORITY_DELTA_REGISTER.md:46` | 861–1023 Ask split |
| D18 | `AUTHORITY_DELTA_REGISTER.md:47` | Ask credit pill — owner to confirm |
| N5–N9 | `NAVIGATION.md:43-47` | `/saved`; `/story/:id`; Explore chips; map below 1024; notifications |
| S2 | `NAVIGATION.md:52` | Ask phone 46px top bar vs Home brand bar |
| F1 | `NAVIGATION.md:51` | Withhold Follow in Part V NEW |

**Only one navigation decision is closed:** N3, `NAVIGATION.md:41` — "`/ask` idle + draft;
`/search` keeps auto-run — **RESOLVED (CTO)**". Verified already conformant in the
codebase; unchanged. N10, `NAVIGATION.md:48`, is "CLOSED as reference only".

**Count: 23 OPEN items. Ten of them block Gate A scope items 1, 2, 3, 5, 6 and 7.**
Gate A items **1, 2 and 4** are blocked separately by the missing R4.1 authority in §4.

---

## 4. Exact missing R4.1 artifacts needed

`AUTHORITY_DELTA_REGISTER.md:20-21` lists what the design lane actually read of R4 — the
two **MANIFEST files only**, not the packages:

| File (as cited) | Bytes | SHA256 (first 16, as recorded) |
|---|---|---|
| `GNAI_BETA_LAUNCH_PHONE_DESIGN_R4/MANIFEST.txt` | 5239 | `bfc96619aaa42e95…` |
| `GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4/MANIFEST.txt` | 6128 | `586e31c5c8aa4e93…` |

`AUTHORITY_DELTA_REGISTER.md:23` also records that **the upstream authorities were never
hash-verifiable at ZIP level**: *"The two authorities arrived as extracted folders, not as
the ZIP files. The ZIP-level hashes you supplied … cannot be re-computed here."*

### Required and absent

| # | Missing artifact | Why Gate A needs it | Verified absent |
|---|---|---|---|
| 1 | **`GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4`** — full package with SPEC, COMPONENTS_AND_TOKENS, NAVIGATION, screenshots, tokens, MANIFEST + SHA256 | The desktop/tablet Home appearance target for everything `HOME_R4.1_DELTA.md:3` calls "untouched": hero, World Pulse, header, bottom bar, tokens, spacing, card styling | Not in either approved ZIP (each has exactly one top-level `…_R5.1` directory); no match under `D:\Desktop\GlobalNewsAI` |
| 2 | **`GNAI_BETA_LAUNCH_PHONE_DESIGN_R4`** — same set | The phone Home appearance target, same reason | Same |
| 3 | **`R4.1 ROUTE_MODULE_MATRIX.md`** | `AUTHORITY_DELTA_REGISTER.md:25`: "Beta runtime capability claims **follow R4.1 ROUTE_MODULE_MATRIX.md**". `INTELLIGENCE_MODULE_MATRIX.md:24` also defers to it for Ask/Analysis/Election/Delivery/Imihigo/Workspace route status | Not present in either ZIP |
| 4 | **R4 token set** (`tokens.css` / `tokens.json` at R4) | `COMPONENTS_AND_TOKENS.md:2`: "**Base: R4 token set**", then two deltas on top. The R5.1 files give only the delta, so the base values are unresolvable | Only R5.1 tokens ship |
| 5 | **A ruling on the implemented-Home divergence** | R5.1's baseline is R4.1 throughout. The implemented Home is the M66 / GN-CD lineage (`app/page.tsx` renders `Hero`, `LiveStatusStrip`, `GlobalDevelopments`, `TodayWorkspace`, `IntelligenceEngineSection`, `HowItWorks`, `TrustSection`). No R5.1 document compares the two, so "untouched" cannot be resolved against this codebase — and per the CTO ruling it must not be inferred from it | n/a — requires Design/CTO authority, not a file |

The only R4.1 artifact actually supplied is the prototype, which is review-only:
`prototype/GNAI_Beta_Prototype.html`, 4,161,955 B, sha256
`d7bf7a4ceb7ba4a5c657935407b9c46fbb9c917460f6696228169bad9b9771c8`
(`MANIFEST.txt:31`). It carries no spec, no token document and no screenshots, and
`README.txt:13` marks all its data as illustrative samples.

---

## 5. Status

**STOPPED, awaiting CTO / Design authority resolution.**

Verified unchanged at the time of writing: no file under `frontend/`, `backend/` or
`shared/` modified on this branch; no visual test deleted or edited; no OPEN decision
answered; no Alpha or Production deploy; no `globalnewsai.live` binding; no provider
activation; no specialist module started.

Both approved ZIP SHA256 values were verified byte-exact before any package was read
(`GATE-A-R5.1-IMPLEMENTATION-DELTA-R1.md` §1), under filenames that differ from those
recorded in `BETA-DESIGN-AUTHORITY-R5.1.md` §1 — a correction to the authority record that
remains outstanding.

To resume Gate A, the four items in §4 and the ten Gate-A-blocking OPEN items in §3.1 need
resolution. Prior analysis, the R4.1→R5.1 delta table and the eight before-captures are in
`docs/beta/GATE-A-R5.1-IMPLEMENTATION-DELTA-R1.md` and
`docs/beta/evidence/gate-a-r5.1/`.
