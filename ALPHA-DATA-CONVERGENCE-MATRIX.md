# ALPHA DATA CONVERGENCE MATRIX

**Round:** ALPHA FINAL DATA-FED CONVERGENCE R2 *(supersedes ALPHA MAJOR CONVERGENCE R1)*
**Branch:** `integration/alpha-major-convergence-r1`
**Required remote parent:** `0552c3c7865c644716af64a28f1c743dd08d20e7`
**Watched release:** `daf2bd97045fc3f74d894f01f943c85d92ef910e` (`release/alpha-m08-integrated-r1`) — **UNCHANGED, not merged into, not pushed**
**Authority:** H-SHARED-NAV-DATA-BINDING-READINESS-R1 §3, verified against this tree
**Date:** 2026-09-20

> **WHAT CHANGED SINCE R1, IN ONE LINE.** Economy stopped being a literal. One real
> NISR CPI observation — All Rwanda, year on year, **15.9 PERCENT** for **2026-08**,
> published **2026-09-10** — is durably retained and served to the Economy frontend at
> both widths, with its licence, index base, content address, parser and extractor
> beside it. **Seven of the eight surfaces are unchanged and still truthful.** No card
> anywhere was filled to look populated.

---

## HOW TO READ THIS

One row per governed surface: **surface → owner component → current source → canonical
read expected → empty-state truth**, plus a classification.

**No adapter was fabricated and no card was filled with fixture or demo values.** Where a
surface has no backend read model, this matrix says so; it does not invent one. That is
the point of the document — it is the Product Owner's map of what is genuinely bound
before the next test round, so that an empty surface can be read as *honest* rather than
*broken*.

### Classifications

| class | meaning |
|---|---|
| **REAL DATA BOUND** | a live read reaches the surface and renders real observations today |
| **READ MODEL READY — NO PROVIDER** | the read model and its result type exist and are called; the reader itself is explicitly unwired (`null`), so the surface renders a governed absence |
| **CANONICAL MODEL ONLY** | the vocabulary/model exists and is governed, but no read model is called from the route at all — the seam is a missing prop or a literal |
| **PROVIDER/RIGHTS HOLD** | a source exists but is withheld on rights, egress or identity grounds |
| **IMPLEMENTATION HOLD** | blocked on an implementation that has not been delivered |

---

## THE MATRIX

### 1 · COUNTRY

| | |
|---|---|
| **owner component** | `components/map/shell/GlobalMapShell.tsx` (modern, **active in Alpha**) · `components/map/CountryPanel.tsx` (legacy) |
| **current source** | explicit reader-initiated read: `countryReadRequestFor` → `performCountryRead` → `countryReadState` → `countryReadPresentationFrom`; plus `retainedCountryCorpora()` TTL cache for a country already analysed in this tab |
| **canonical read expected** | already written and already wired on the modern shell — governed by `MAIN-COUNTRY-READER-RETRIEVAL-CONTRACT-R1` §2 |
| **empty-state truth** | governed: `countryReadState` orders `isLoading` → `failure` → `!response`; one governed sentence, never a stack or a status code |
| **class** | **REAL DATA BOUND** (on the modern shell, behind the explicit load action) |

**Retrieval boundary — unchanged by this round.** Selecting a country consumes **0 GNews
requests**. `loadCountry()` remains *deleted* rather than dormant, so the Map has no path
to a news provider at all; the explicit Country load action is the only retrieval gate,
and Open Analysis carries a selection to `/search` under `EXPLICIT_ANALYSIS_REQUEST`.

**Compatibility debt, recorded per §5 and deliberately NOT closed.** `CountryPanelProps`
has no `countryRead` prop, so the legacy path cannot offer the explicit read. Alpha runs
`NEXT_PUBLIC_MAP_SHELL=true` and the Product Owner has visibly confirmed the modern right
rail and explicit load action, so **modern Alpha is the authority**. Building a second
Country retrieval implementation to serve the legacy shell would create exactly the
duplicate path the contract forbids. Logged as debt; not a defect against this release.

---

### 2 · ECONOMY

| | |
|---|---|
| **owner component** | `components/economy/EconomyScreen.tsx` · `components/economy/compact/EconomyCompactScreen.tsx` |
| **current source** | **a live read of retained evidence.** `GET /economy/observations/rw-nisr-cpi` opens the NISR CPI artifact the snapshot store already holds, decodes it with the recorded extractor, and returns one observation plus its provenance. `readEconomyObservations()` calls it from the **server component**, so the browser issues no request on load |
| **canonical read expected** | **landed.** The reader is the nullable function on the Market shape, returning `OBSERVATIONS \| UNAVAILABLE(reason)` with **three distinguishable absences** — no reader · none retained · none displayable. `numericObservations` is now `economyCapabilityFrom(read)`, **derived**, so it cannot say OBSERVED unless something was observed |
| **the seam** | `lib/economy/economyConfig.ts` → `lib/economy/economyObservationRead.ts`. **The seam did not move**: it is still a nullable function, and setting it back to `null` restores the previous behaviour with no other change |
| **what the reader actually sees** | **All Rwanda headline CPI, year on year, 15.9 PERCENT, reference period 2026-08, published 2026-09-10**, with institution, licence (`CC BY 4.0`), index base (`Feb 2014=100`), edition language, artifact `sha256 4ba5193b…`, and the parser and extractor that read it. At 1512px and at 390px |
| **what was NOT populated, deliberately** | GDP, unemployment, debt, the change-state chip, the assessment, the triad, the corridor. **Only the semantically-corresponding card is filled.** Every other card renders the governed absence it rendered before |
| **empty-state truth** | unchanged and still governed. `FIXTURE_DATA_CAPABILITY` exists and is **still never assigned** — `ECON-UI-1`: *"fixtures are illustrative, never production facts"* — and no branch of the derived capability can return it |
| **and `/economy` is still not open** | `app/economy/` does not exist, the eligibility predicate still returns **NOT ELIGIBLE** on three DATA conditions, and the tripwire asserting the directory’s absence is untouched and still passes. The Product Owner sees this on the preview routes |
| **class** | **REAL DATA BOUND** (one series; the rest of the surface is CANONICAL MODEL ONLY and says so) |

---

### 3 · MARKET

| | |
|---|---|
| **owner component** | `components/market/MarketScreen.tsx` · `MarketCompactScreen.tsx` |
| **current source** | `readMarketObservations()`, awaited in `app/market/page.tsx`, passed as `read` |
| **canonical read expected** | **already the expected shape.** Only `activatedObservationReader()` changes, from `null` to the canonical store's reader |
| **the seam** | `lib/market/mktReadModel.ts` — one function body |
| **empty-state truth** | three *distinguishable* absences — no reader · none stored · none displayable. The headline does not retitle itself and the status badge counts records, not prices |
| **class** | **READ MODEL READY — NO PROVIDER** |

> **Market is the reference shape for the other seven**, and it is worth naming why: the
> reader is a *nullable function, not a flag*; absence is three values rather than one; the
> absence reason names the **platform** gap (*"the ingest module ships a scheduler, a
> repository and two adapters but no controller"*) rather than implying the market is
> quiet; and it is called from a **server** component, so the browser issues no request on
> load.

---

### 4 · HUMANITARIAN

| | |
|---|---|
| **owner component** | `components/humanitarian/HumanitarianScreen.tsx` · `HumanitarianCompactScreen.tsx` |
| **current source** | **none** — the route passes only `locale` |
| **canonical read expected** | a humanitarian observation reader on the Market shape, awaited in the server component and passed beside `locale` |
| **the seam** | `app/humanitarian/page.tsx` — the call site takes one more prop |
| **empty-state truth** | already composed from `humDegraded.ts` / `humState.ts`; the absence vocabulary exists and needs a source to report *about*, not a new vocabulary |
| **class** | **CANONICAL MODEL ONLY** |

---

### 5 · CONFLICT

| | |
|---|---|
| **owner component** | `lib/map/d1/conflictDomainBind.ts` → `bindConflictD1(entry, variant, labels)`, consumed by `GlobalMapShell` as `contextQueue` |
| **current source** | **a pure function over no input** — *"is built empty by `bindConflictD1` from no input"* |
| **canonical read expected** | a conflict observation read supplying the queue items `bindConflictD1` currently constructs empty |
| **the seam** | `bindConflictD1`'s parameter list — entry, variant, labels, and **no data** |
| **empty-state truth** | correct *by construction*: there is no severity field to fabricate — `ConflictSeverity` is not imported and cannot be — so the queue renders empty as a consequence rather than as a placeholder |
| **class** | **CANONICAL MODEL ONLY** |

> **The narrowest seam of the eight**, because the module was written so the wrong thing is
> *unrepresentable* rather than merely forbidden.

---

### 6 · POLITICS

| | |
|---|---|
| **owner component** | `components/politics/PoliticsScreen.tsx` · `PoliticsCompactScreen.tsx` |
| **current source** | **none** — vocabularies only (`politicsDomain.ts`, `politicsStrings.ts`, `politicsSubject.ts`) |
| **canonical read expected** | a politics observation read over the three subject types (`ELECTION` as Part VIII object O2, `LEGISLATIVE_SUBJECT`, `PROTEST_CAMPAIGN`) |
| **the seam** | `app/politics-visual-preview/page.tsx` — the call site |
| **empty-state truth** | the four axes render as four independent slots and **may not merge**; absence renders through `Absent` (`PolParts.tsx`) with an accessible label, because *"a lone em-dash announces as nothing at all"* |
| **class** | **CANONICAL MODEL ONLY** |

**Two binding constraints carried forward.** `POLITICS` is **not** a `SpecialistDomainId`,
and `politicsDomain.ts` deliberately leaves `POLITICS_DOMAIN_SEAM` unregistered — a data
binding must not close that seam as a side effect (`S-4 · SAFE TO DEFER`). And **no
election subject type is registered on the Watch platform**: `WATCH_SUBJECT_TYPES_BY_SURFACE.POLITICS`
is `[]`, now asserted as empty with a mutation control proving the guard fails if
`ELECTION` is registered (§12).

---

### 7 · SECURITY

| | |
|---|---|
| **owner component** | `components/security/SecurityScreen.tsx` · `SecurityCompactScreen.tsx` |
| **current source** | **none** — `<SecurityScreen locale={locale} />` |
| **canonical read expected** | a security observation read. Region A's `A2` label is *fixed rather than derived*, so a read must fill it explicitly rather than the label learning to vary |
| **the seam** | `app/security-visual-preview/page.tsx` — the call site |
| **empty-state truth** | *"Not assessed. This is not a statement about…"* already renders; zone geometry is fixed-height (`g.stateHeightPx[1]`), so an arriving read cannot change the chrome |
| **class** | **CANONICAL MODEL ONLY** |

---

### 8 · ENERGY

| | |
|---|---|
| **owner component** | `components/energy/EnergyShell.tsx` |
| **current source** | `ENERGY_GOVERNED_FRAME` — every collection empty (`subjects: []`, `feed: []`, `changeRows: []`, `flowNodes: []`, `flowLinks: []`), each emptiness explained by a zone entry |
| **canonical read expected** | a governed energy frame whose collections are populated by the canonical read, **with `source: 'governed'` unchanged** |
| **the seam** | `lib/energy/energyGoverned.ts` — the literal becomes the return of a reader |
| **empty-state truth** | **the most complete of the eight.** Four absence states separated by border treatment and label; the M08 7→3 reader projection; `NOT_CONNECTED` / `TEMPORARILY_UNAVAILABLE` never reaching a reader as themselves |
| **class** | **CANONICAL MODEL ONLY** |

> `ENERGY_DESIGN_FIXTURE_FRAME` is reachable **only** via `?frame=design-fixture`.

---

## SUMMARY

| surface | class |
|---|---|
| Country | **REAL DATA BOUND** (modern shell, explicit action) |
| Market | **READ MODEL READY — NO PROVIDER** |
| Economy | **REAL DATA BOUND** (headline CPI; the rest of the surface unchanged) |
| Humanitarian | CANONICAL MODEL ONLY |
| Conflict | CANONICAL MODEL ONLY |
| Politics | CANONICAL MODEL ONLY |
| Security | CANONICAL MODEL ONLY |
| Energy | CANONICAL MODEL ONLY |

### The shape of the remaining work

```
seam is BOUND to real retained evidence ............. Economy  <- this round
seam is FINISHED and only the reader is null ........ Market
seam is WRITTEN but the legacy shell cannot reach it  Country (debt), Conflict
seam is a LITERAL that must become a reader ......... Energy
seam is a MISSING PROP at the route call site ....... Humanitarian, Politics, Security
```

**Economy is now the worked example for the other four.** It went from a literal to a
derived capability without a redesign, without a new absence vocabulary and without a
fixture: one nullable reader, one server-component call, one backend route over bytes
already retained. The remaining surfaces need that same shape and a source with rights.

**Five of the eight need the same one-line change**: a nullable reader called from the
server component, returning a discriminated result whose absence branch names the
*platform* gap. **None of the eight needs a new absence vocabulary** — every one already
has a governed empty state, and three (Energy, Market, Politics) are stricter than
anything newly written would be.

### The fixture rule, which this round did not relax

Two surfaces carry an explicitly-named demo mode that is **deliberately never assigned** —
`FIXTURE_DATA_CAPABILITY` (Economy) and `ENERGY_DESIGN_FIXTURE_FRAME` (Energy, reachable
only by an explicit URL parameter).

> **That is the pattern: a fixture that exists must be unreachable from the production path
> by construction, not by discipline.**

No surface in this matrix was given a fixture to make its seam look finished.

---

## NAVIGATION IS NOT RETRIEVAL — VERIFIED THIS ROUND

| behaviour | status |
|---|---|
| Home navigation triggers a new GNews call | **NO** |
| Map movement or country *selection* alone triggers GNews | **NO** — `loadCountry()` is deleted |
| Energy / Market / Humanitarian / Politics / Security previews trigger a provider | **NO** |
| The shared Back/Return control issues any request | **NO** — no fetch on mount, render or press |
| Pressing Back on `/map` with a country selected triggers GNews | **NO** — it clears through the single governed selection handler, and the country read is gated on a non-null request |
| Pressing Back on `/energy` triggers a provider | **NO** — the ladder is pure state, and its `false` branch navigates |
| Rendering the Economy surface (either width, any number of times) reaches NISR | **NO** — the read opens retained bytes; there is no transport in its dependency graph |
| Anything auto-fetches on mount to make an empty preview look populated | **NO** |

Only explicit governed retrieval actions may initiate provider work. Where a surface has
no data, it renders a truthful *unavailable / not-assessed* state.

---

## OFFICIAL-DOCUMENT PIPE — SEPARATE FROM THE EIGHT

| item | status |
|---|---|
| parser dispatch (`ParserBinding` carries its decoder) | **LANDED** |
| a binding with no decoder | **fails at compile time** |
| a PDF binding wired to `parseStrictJson` | **fails at compile time** |
| JSON path byte/semantic behaviour | **preserved** — the rows name the landed `parseStrictJson` |
| PDF reaching `BODY_NOT_JSON_SHAPED` | **impossible** — the leading-byte sniff is media-aware |
| JSON allowlist | **not widened** — `ALPHA_ADMITTED_MEDIA_TYPES = ['application/json']` |
| XLS / XLSX / CSV | **unavailable** — no governed decoder exists, so no row is registered |
| NISR normalized observation | **LANDED AND DURABLY RETAINED** — 15.9 PERCENT, 2026-08, from the artifact, never a literal |
| production PDF text extractor (synchronous, in process, no OCR, no subprocess) | **LANDED** — `pdf-sync-text.ts` + `nisr-cpi-pdf.extractor.ts` |
| production safe-fetch wire driver (`dns.resolve4`/`resolve6`, address-bound connect, governed SNI/Host) | **LANDED** — `safe-wire-fetch.node.ts`, and it has **no call site under `src/`** |
| lineage persistence (referencePeriod, sourceLanguage, extractorId, extractorVersion) | **LANDED** — one additive migration, four `ADD COLUMN`, zero `UPDATE`, zero destructive DDL, existing rows NULL |
| boot gate — a missing extractor refuses to become runnable *before* any fetch | **LANDED** — runs before `NestFactory.create` |
| `rw-nisr` activation | **DORMANT** — `enabled: false`, `ingestionMethod: none`, no scheduler, asserted by 19 CI tests |
| any other official source | **NONE ACTIVATED** — `eurostat` remains `enabled: false`; NISR is the only real-data pipeline |

---

## SHARED BACK / RETURN — H’S MEASURED HOST INVENTORY, COMPLETE

H probed fourteen surfaces across two viewports and found **one** return affordance —
Energy, compact only, and bespoke. The major convergence landed six hosts; this round
landed the remaining seven, and removed the bespoke one rather than leaving it beside
the shared control.

| host | variant | notes |
|---|---|---|
| `navigation/NavBar.tsx` | navbar | host A — the existing 62px desktop row, unchanged |
| `market/MarketScreen.tsx` | microline | R1 |
| `market/MarketCompactScreen.tsx` | microline · icon only | **R2** |
| `politics/PoliticsScreen.tsx` | microline | R1 |
| `politics/PoliticsCompactScreen.tsx` | microline · icon only | R1 |
| `humanitarian/HumanitarianScreen.tsx` | microline | R1 |
| `humanitarian/HumanitarianCompactScreen.tsx` | microline · icon only | **R2** |
| `security/SecurityScreen.tsx` | microline | R1 |
| `security/SecurityCompactScreen.tsx` | microline · icon only | **R2** |
| `economy/EconomicStateHeader.tsx` | microline | **R2** — the desktop state-header row |
| `economy/compact/EconomyCompactScreen.tsx` | microline · icon only | **R2** |
| `energy/EnergyShell.tsx` | microline ×2 | **R2** — two mutually exclusive viewport branches; a reader sees one |
| `map/MapPageClient.tsx` | microline · sub-state exit | **R2** — H’s authorised first-return semantics |

**Measured on the running server:** every one of twelve routes serves **exactly one**
`microline` control, and the surfaces that carry the NavBar serve its `navbar` control
beside it. **No surface gained a row** — each control is the leading item of a row that
already rendered, and the control declares no height, padding or margin of its own.

**No bespoke arrows remain in a host.** The glyph is declared once, as
`RETURN_GLYPH` in `ReturnControl.tsx`; a guard sweeps every host for a local arrow
literal, and a second guard asserts set equality between the declared inventory and
every `.tsx` in the tree that renders the control.

**Two surfaces may answer a first press without leaving, and only two.** `/map` clears
the selection; `/energy` walks its own Escape ladder — HUD → drawer → lens → Ask →
subject → substrate. Both have a reachable `false` branch, so neither is a Back button
that can never leave, and neither can start a retrieval.

---

## WHAT THIS ROUND DID NOT DO

| | |
|---|---|
| deploy anything | **NO** — production is on HOLD, no Railway change was made |
| touch `release/alpha-m08-integrated-r1` | **NO** — not merged into, not pushed, unchanged |
| activate a second data source | **NO** — NISR is the only real-data pipeline |
| promote coverage accounting (0/11 or otherwise) | **NO** — East Africa evidence is preserved and unchanged; no coverage claim is made from it |
| integrate Imihigo R2 | **NOT PRESENT** — no Imihigo R2 implementation exists in this repository or on any branch reachable from it. The existing Imihigo vocabulary (domain mapping, workspace copy, platform-neutrality guard, capability tree) is preserved byte-for-byte |
| manufacture a figure to fill a card | **NO** |

```
ALPHA DATA CONVERGENCE MATRIX = RECORDED
```
