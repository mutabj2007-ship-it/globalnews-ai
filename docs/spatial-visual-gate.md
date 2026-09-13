# Spatial Visual Gate — C907 §11

Three parts. **A candidate passes only if all three pass.** No part may be waived
by the person whose change is being gated.

| Part | What it is | Where it lives | Runs |
|---|---|---|---|
| **A** | Structural assertions — layers, controls, token resolution, camera rule, rail geometry | `scripts/verify-spatial-structure.mjs` | every commit, in `next build` |
| **B** | Perceptual comparison of four captured frames against the golden measurements | `scripts/spatial-visual/` | every release candidate |
| **C** | **Mandatory Product Owner visual acceptance** | this document | before Production, every time |

---

## Why three parts and not one

Every defect the C907 audit found was invisible to a full, green Jest suite:

* the `sp-*` token family was never defined — 42 names, 625 usages, zero CSS;
* the map labels were the pre-v1.5 values, hardcoded past the token module;
* the coastline token had no consumer at all;
* the layer registry declared a graticule that no code drew.

None of these is a subtle rendering difference. They are **missing things**, and
a perceptual threshold tuned on a frame that already contains a missing thing
will pass it forever. Part A finds absences directly. Part B finds drift in what
is present. Part C is the only one that can find *"this is not the product we
approved"*.

---

## Part A — structural

`node scripts/verify-spatial-structure.mjs`

47 checks, no browser, no dependencies, milliseconds. Wired into `next build`, so
a candidate that fails it cannot be built. Proven adversarially: it passes C907
and reports **21 distinct failures** on frozen C906.

It fails on, among others: a missing coastline or graticule layer, a coastline
painted with the border token, a reference token that has been "improved", a
hardcoded zoom floor, a rail control that governs nothing, a colour literal in
the label render block, and a label class floor that would admit a wall at world
scale.

---

## Part B — perceptual

Four **protected frames**, each at a fixed viewport, a fixed camera expressed
through the product's own `cam=` URL, pinned fixture evidence and reduced motion:

**V1 WORLD** · **V2 RWANDA / EAST AFRICA** · **V3 SELECTED COUNTRY** · **V4 EVIDENCE MODE**

Each capture is judged on four measured properties rather than on one diff score:

| Measure | Catches |
|---|---|
| Palette occupancy, per approved token, at channel tolerance 2 | palette drift, a missing fill, a wrong opacity |
| Luminance distribution, with a **per-frame** near-black rule | the measured 8/8/16 failure |
| Geographic occupancy and the painted world's span | tiny-world framing, missing geography |
| Label counts per class, read from the **DOM** | label explosion |

**Raw pixel equality is never used**, and text regions are excluded from any
perceptual diff, because glyph rasterisation varies by platform.

**The thresholds are measurements, not preferences.** Every number in
`scripts/spatial-visual/compare-golden-frame.mjs` is annotated with the golden capture it was measured
from. The suite is validated both ways: **each golden frame passes its own
thresholds, and each fails the other's.**

### The near-black rule is per frame, and that is a measurement

    GOLDEN-01 (world)   57.7 % of the map pane below luminance 12   — correct; it is ocean
    GOLDEN-02 (Rwanda)   0.0 % of the map pane below luminance 12   — correct; it is land

The approved ocean `#040a10` has relative luminance 9.2, so "dark" is the right
answer at world scale and the wrong one at regional scale. A single global
threshold could only have been set loose enough to pass the world frame — which
is loose enough to pass the Alpha failure.

---

## Part C — Product Owner visual acceptance

**Required before Production promotion of any Spatial release candidate. Not
waivable by automation.**

1. The four captures from Part B are published beside the two golden captures.
2. The Product Owner, or a delegate the Product Owner names in the register,
   reviews each pair and records an explicit **ACCEPT** or **REJECT** with a date
   and a candidate id.
3. A REJECT names which frame and which row.

For each frame the reviewer is asked to confirm the acceptance statements in
`scripts/spatial-visual/cases.ts`, which are carried with the case so the
question and the fixture can never drift apart. The two that govern everything:

* **WORLD** — the world occupies the usable map frame; geography is recognisable
  *before* intelligence is overlaid; no river, city or lake wall.
* **RWANDA / EAST AFRICA** — the reader sees East Africa geography **first**, then
  intelligence above it. Not a black field, then isolated polygons, then
  intelligence.

---

## Golden capture governance — SC-owned, machine-enforced

Per the C907 §0.1(5) ruling, the whole acceptance mechanism is inside the **SC**
fingerprint: the Playwright spec, the frame/camera/fixture definitions, the
comparator and its thresholds, and the authority manifest all live under
`scripts/`. Narrative documents (this one, the candidate reports) do not execute
or decide acceptance and remain outside C/PA/SC — their hashes are reported in
the handoff where they are relied upon.

The golden PNG binaries stay outside ordinary source scanning; **their identity
does not.** `scripts/spatial-visual/golden-authority.manifest.json` records, for
every protected frame: logical id, filename, width, height, SHA256 and an
authority description.

    V1 WORLD                 APPROVED   GOLDEN-01-world-evidence.png   2048x1190
                                        5d7b24e877b780d7e08328501e1cdc937a35f276306bcfcb3845bcce27ffea11
    V2 RWANDA / EAST AFRICA  APPROVED   GOLDEN-02-rwanda-selected.png  2048x1207
                                        961787f60df3b97e90dbd808f1d0f527fa0d7aa9d00a4609a75a7d0f7bf3c8fa
    V3 SELECTED COUNTRY      PENDING    no approved capture supplied
    V4 EVIDENCE MODE         PENDING    no approved capture supplied

`node scripts/verify-golden-authority.mjs` enforces it:

* a golden PNG changed without a manifest change → **FAIL**, printing both sums;
* a manifest change → **SC moves**, which IS the reviewed identity change;
* an approved golden missing, or its dimensions altered → **FAIL**;
* `--require-all` → **FAIL** while any frame is PENDING. This is the Production
  gate: V3 and V4 cannot be certified until the Product Owner supplies and
  approves their captures. **An absent authority is not a passing one.**

Changing a threshold in the comparator moves SC for the same reason. It is never
a quiet re-baseline when a diff fails.

A gate whose goldens can be updated by the person failing it is not a gate.

---

## Governance supersessions in force for the protected Spatial release

Recorded here so a later reviewer reading an older accepted document does not
"restore" superseded behaviour as a regression fix. Both have been lost once
already by exactly that route.

| Superseded | By | Effect |
|---|---|---|
| **Design v1.7 acceptance item "underzoom below world-fit floor"** | C907 §0.1(4) final ruling | The effective minimum zoom is **viewport-derived** (`log2(max(paneW, paneH) / 512)`, clamped into the product range). One useful world fills the map workspace comparably to the golden frame. **v1.7's free horizontal pan, its ocean-past-the-edge behaviour, `renderWorldCopies: false` and the C906 canonical longitude domain are untouched.** |
| **The Design prototype's canvas draw-loop order** (coast and border stroked last, above the evidence states) | C907 §0.1(1) final ruling, applying D-2 literally | The whole reference band — graticule, land, hydrography, coastline, admin borders, geographic labels — sits **below** every intelligence layer. The evidence fills are translucent washes (.07–.14), so the geographic lines remain perceptible through them. The golden **rendered hierarchy** is the authority, not the prototype's draw order. |

Both are enforced by `scripts/verify-spatial-structure.mjs`, so restoring either
superseded behaviour fails the build rather than reaching a reviewer.
