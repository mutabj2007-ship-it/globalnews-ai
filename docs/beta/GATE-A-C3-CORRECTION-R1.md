# GATE A — C-3 BOUNDED CORRECTION

Issue #28, CTO review C-3. Branch `feature/beta-shell-r5-1`.
Corrects `df48cf2`; `6dde9bf` and `df48cf2` are **not** amended or rewritten.
Date 2026-09-25.

---

## 1. Blocking correction 1 — category TITLE colours

### 1.1 Authority citation

`CATEGORY_COLOUR_TOKENS.md`, verified R5.1 package (both tiers, byte-identical).

**Rule**, line 5: *"Category colour identifies the SUBJECT only. It is applied to … the
module icon + module title in Intelligence modules."* C-3 closes the **title** half only,
so the icon keeps its status colour.

**Mapping table**, module column — the whole of the mapping applied:

| Module | Token | Hue |
|---|---|---|
| Security Intelligence | `--c-security` | orange |
| World Intelligence | `--c-economy` | emerald ("Economy Intelligence; World Intelligence (registry: emerald)") |
| Country Intelligence | `--c-country` | blue |
| Politics Intelligence | `--c-politics` | violet |
| Economy Intelligence | `--c-economy` | emerald |
| Conflict Intelligence | `--c-conflict` | red |
| Market Intelligence | `--c-market` | cyan |
| Humanitarian Intelligence | `--c-humanitarian` | purple |
| Energy Intelligence | `--c-energy` | amber |

`--c-science` maps to **"(no module)"** and is therefore not shipped.

### 1.2 The form the values take, and why

`CATEGORY_COLOUR_TOKENS.md` line 3 states its own derivation: *"Dark values are the exact
Tailwind -300 text shades the branch uses (`text-amber-300` etc.)."* Verified against
`tailwindcss/colors` — **8 of 8 match byte-for-byte**:

```
--c-security #FDBA74 = orange-300      --c-conflict     #FCA5A5 = red-300
--c-economy  #6EE7B7 = emerald-300     --c-market       #67E8F9 = cyan-300
--c-country  #93C5FD = blue-300        --c-humanitarian #D8B4FE = purple-300
--c-politics #C4B5FD = violet-300      --c-energy       #FCD34D = amber-300
```

**A conflict with an accepted NON-NEGOTIABLE, and how it was resolved without weakening
either authority.** `GN-CD-300 §W.4` rules that `#fcd34d` *"does not exist and must not
appear"*, enforced tree-wide by `claudeDesignFoundation.spec.ts:302`. That hex is exactly
R5.1's approved Energy value. Writing it as a literal put the repository in breach — the
first attempt did, and the foundation spec caught it.

The shipped form names the Tailwind shade instead of the literal. This is R5.1's own
derivation rather than a substitution: the rendered colour is identical, the branch already
paints it through `moduleAccentClasses.ts`'s `text-amber-300`, and the banned literal never
enters source. Both authorities hold, and no test was weakened or deleted.

Measured on the rendered page (`AFTER-report.json`, `titleColours`): **9 of 9 titles
compute to the approved value**, e.g. Energy `rgb(252, 211, 77)` = `#fcd34d`.

### 1.3 Scope held to titles

C-3: *"Do not infer or expand the palette to icons, borders, badges, other pages or other
OPEN proposals."*

| Element | Treatment |
|---|---|
| Module **title** | **category colour** (this correction) |
| Module icon | status colour — unchanged |
| Card border | status rule — dashed for coming-soon only |
| Status badge | status colour — unchanged |
| Description, route line, note | `--mut` — unchanged |
| Story labels, 60-second briefing rows, briefing image word, any other page | **not touched** |

`CATEGORY_COLOUR_TOKENS.md`'s Rule requires the same: *"Status keeps its own label, icon
and pill colour and is never replaced by category colour."* Weight stays ≥600, which the
same Rule requires of category-coloured text.

Still OPEN and untouched: the broader P2 palette, CC1 (Security orange vs registry amber),
CC2, CC3, CC4.

### 1.4 Spec updated

`intelligenceModulesR51.spec.ts` no longer asserts that no `--c-*` token ships. It now
asserts the approved mapping: every registry module resolves to a title colour (the map is
total), each is the `-300` step of the hue the package names, the hue exists in Tailwind's
palette, the colour is applied to the title and nowhere else, no science colour ships, and
no raw hex literal is introduced at all.

---

## 2. Blocking correction 2 — the HTTP 500s, named and reclassified

### 2.1 Probe enhanced

`capture-home.mjs` now records every response with status ≥400 (`url`, `status`,
`resourceType`) and every failed request, and prints a per-endpoint tally. A console "500"
with no URL is no longer possible.

### 2.2 The endpoints

Identical in all eight after-captures:

| Count | Status | Type | Path | Owner |
|---|---|---|---|---|
| 8× | 500 | fetch | `/api/users/me` | `components/navigation/AccountControl.tsx` via `useAccount.ts` |
| 8× | 500 | fetch | `/api/follows/countries` | `components/home/useCountryFollows.ts` |

### 2.3 Environmental, not a Gate A regression — four independent proofs

1. **Pre-existing.** The BEFORE captures, taken before any Gate A source change, carry the
   same two console errors in every one of the eight frames, with the identical message.
   The count did not change: 2 before, 2 after.
2. **No backend is running.** The configured API base (`127.0.0.1:3001/health`) is
   unreachable in the evidence environment, which has no `DATABASE_URL`. This is the same
   condition recorded in `BETA-PREFLIGHT-AUDIT-R1.md` §G-3, where 53 backend test failures
   trace to the same absent database.
3. **Reproducible outside the browser.** `curl` against both paths returns 500 directly,
   with no page involved.
4. **Outside the Gate A change surface.** Both are account/follow surfaces. The Gate A
   section issues **no request at all** — `IntelligenceModulesSection.tsx` contains zero
   `fetch`, zero `useEffect` and no client boundary, asserted by the spec.

**Ownership:** account and follow runtime, not Gate A. Nothing was suppressed — the errors
are still captured and reported, now with their endpoints named.

---

## 3. Evidence-strengthening — all nine modules, both locales

The probe checked four of nine modules. It now checks **all nine**, by title and by route
line, in EN and PL, DOM and visible:

```
all nine module titles visible in every frame: true      (8/8 frames, mods=9/9)
```

`intelligenceModulesR51.spec.ts` gained the matching gates: a per-module case over all nine
ids asserting distinct EN and PL title and description (a PL string identical to its EN
twin is an untranslated fallback and fails), and a check that all nine titles match
`INTELLIGENCE_MODULE_MATRIX.md`'s exact display names in both locales. The five previously
un-automated cards are no longer covered by manual inspection alone.

---

## 4. Gate A completeness — updated per C-3

C-3 rules that C-2's *"Preserve the existing four navigation destinations and current route
behaviour"* **is** the Gate A requirement for items 3, 5 and 7, so preserving current
behaviour satisfies them. N1/N2/N4/N11/S1 remain OPEN as future alternative proposals and
are **not** implemented.

| # | Gate A item | Status |
|---|---|---|
| 1 | Home / Beta Launch desktop/tablet | **COMPLETE** |
| 2 | Home / Beta Launch phone | **COMPLETE** |
| 3 | Shared header/navigation | **COMPLETE** — current behaviour preserved, unchanged |
| 4 | Footer | **COMPLETE** — unchanged |
| 5 | Mobile navigation | **COMPLETE** — four destinations preserved, unchanged |
| 6 | Module cards and approved states/destinations | **COMPLETE** — with P1/M3 on documented fallbacks |
| 7 | Search / Ask entry presentation on Home | **COMPLETE** — current behaviour preserved, unchanged |
| 8 | Responsive at ≥1440, 430×932, 390×844, 360×800 | **COMPLETE** — no overflow in either locale |
| 9 | EN and PL | **COMPLETE** — all nine modules gated in both |
| 10 | Real/governed Home data path only | **COMPLETE** — no fetch, no fixture, 0 metered AI |

**All ten Gate A items are complete.** The earlier report listed 3, 5 and 7 as incomplete;
that classification is withdrawn on C-3's ruling. Nothing was inferred to close them — they
are satisfied by preserving behaviour that was already correct, and no navigation proposal
was implemented.

---

## 5. Verification

| Check | Result |
|---|---|
| `npx jest` (frontend) | 10 suites / 15 tests fail — the identical set already failing on base `408edb0`; **284 suites / 6526 tests pass** |
| `npm run build:shared` | exit 0 |
| `npm run build:frontend` | exit 0, compiled successfully |
| Metered AI on ordinary Home browse | **0** across all 8 captures |
| Horizontal overflow | none, four widths, both locales |
| `<html lang>` | correct on all 8 |
| All nine module titles visible | **true in 8/8 frames** |
| Title colours | **9/9 match the approved R5.1 values** |
| Failing responses | 2 per frame, both named, both environmental |

Two failures found and fixed during this correction, both caught by the repository's own
gates rather than assumed away: the `#fcd34d` literal breaching `GN-CD-300 §W.4`, and a
`const module` binding in the new spec that `@next/next/no-assign-module-variable` rejects
during the production build.

No Alpha deploy. No Production deploy. No domain binding. No provider activation. No
specialist-module work. No OPEN decision answered beyond the title-colour treatment C-3
explicitly closed.
