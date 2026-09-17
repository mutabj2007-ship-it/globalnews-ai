# Alpha Convergence R1 — Open Items Register

Findings that were **deliberately not fixed** during Alpha Convergence R1, each
with the reason it was left open and where its evidence lives. Nothing here is a
forgotten defect: every entry was found, traced, and consciously deferred under
a ruling.

This register exists because these items were previously carried only in review
correspondence, which is not a place a future contributor will look.

---

## Deferred to Claude Design (presentation / vocabulary)

### `ANALYSIS-METRIC-VOCABULARY-1` — "moderate" means two unrelated things

**Status:** OPEN — recorded for the Claude Design redesign, not renamed.

Two independent scales share a token:

| scale               | values                                          |
| ------------------- | ----------------------------------------------- |
| `TrustLevel`        | high \| **moderate** \| limited \| insufficient  |
| `SignificanceLevel` | minor \| **moderate** \| major \| critical       |

`TrustLevel` answers *how well does the evidence support this analysis* and is
derived by the backend from grounded citations. `SignificanceLevel` answers *how
big is this event* and is supplied by the model with a cited rationale beside it.
Both can appear on one screen, so a reader can meet the same word twice meaning
two different things.

**Why not fixed here:** these are API-contract enums. Renaming one is a redesign
with a migration, not a convergence fix.

**What was verified instead:** the metrics are genuinely distinct — they come
from different fields, have different producers, and *disagree on a single
response* (MODERATE support alongside MAJOR significance). Varying either one
leaves the other unmoved. This is a vocabulary collision, **not** a conflicting
mapping, and no metric was removed.

**Evidence:** `frontend/src/components/search/metricSemantics.spec.ts`

---

### `ANALYSIS-ITEM-COUNT-SEMANTICS-1` — "N ITEMS" names no quantity

**Status:** OPEN — recorded for the Claude Design redesign. Wording deliberately
left untouched.

The Complete Record button renders `completeRecordCount: '{n} ITEMS'`, bound to
`AnalysisFrame.tsx` → `model.sourceSupport.length` → `response.articles.length`.
That is a precise quantity: the **final evidence set** — post-de-duplication,
post-cap — the exact array the model was shown.

The problem is that the screen never says so, while a *different* article count
sits nearby:

| rendered      | field                                    | measures                                |
| ------------- | ---------------------------------------- | --------------------------------------- |
| "N articles"  | `sourceDiversity.retrievedArticleCount`  | the **pre**-dedup, pre-cap retrieved pool |
| "N ITEMS"     | `sourceSupport.length`                   | the **post**-dedup final set             |

Both are correct and they legitimately differ, so a reader can see "12 articles"
and "7 ITEMS" with nothing on screen explaining the gap. "ITEMS" names neither
articles, nor sources, nor clusters.

A second reason the label misleads: an article the analysis never cites is still
an ITEM. The figure is *not* "sources used".

**Why the counts differ by design:** `computeSourceDiversity` is called with the
pre-dedup `articles`, never `deduped` — computing it from the deduped array would
make duplicate concentration invisible by construction, which is the very thing
the metric exists to expose.

**Why not fixed here:** the ruling is explicit — *"record that for the future
Claude Design redesign rather than inventing new wording now."*

**Evidence:**
- `frontend/src/components/search/metricSemantics.spec.ts`
- `backend/src/modules/analysis/duplicates/source-diversity-basis.spec.ts`
  (pins the pre-dedup basis, so a future change to the call site fails loudly)

---

### `ANALYSIS-RECORD-VISUAL-1` — Complete Record visual redesign

**Status:** OPEN — deferred to Claude Design by ruling.

Checkpoint L closed the **structural and data** defects only (paragraph
boundaries, body-prose justification, confidence scale). The broader audit-page
presentation was explicitly out of scope: *"no redesign"*.

---

## Blocked on a backend producer

Both of these are Checkpoint E items, both were **classified rather than
corrected**, and both are closed by the *same* backend capability: a producer
that emits point-precision evidence.

### `SPATIAL-EVIDENCE-MODE-AFFORDANCE-1` — EVIDENCE mode equals WORLD

**Status:** OPEN — needs a product decision, not a convergence fix.

Measured, not argued: `qualifyingRecords` switches on the mode, and WORLD and
EVIDENCE share one `default: return true` arm. Given identical input the two
**live** modes return the same records, so switching between them changes
nothing a reader can see. The other four modes genuinely do discriminate, which
is what makes that equality meaningful rather than vacuous.

**The cause is a producer gate, not a missing design.** The registry already
declares the distinction — `evidencePoints` applies in EVIDENCE and CHANGE and
not in WORLD, so EVIDENCE is meant to be the mode that draws point-precision
evidence. That layer is GATED: *"no producer emits point-precision evidence;
`PRODUCIBLE_SPATIAL_PRECISION` is ['COUNTRY','UNKNOWN']"*. The difference cannot
manifest. EVIDENCE is not empty of intent; it is waiting on a backend that does
not emit what it exists to show.

**Why not corrected here:** the ways forward — merge the modes, relabel EVIDENCE
as pending, or wait for the producer — are product decisions with different
costs, and the ruling forbids inventing.

**Evidence:** `frontend/src/components/map/checkpointEEvidenceMode.spec.ts`

---

### `SPATIAL-COUNTRY-EVIDENCE-LAYER-TOGGLE-1` — EVID governs two of four layers

**Status:** OPEN — latent, guarded.

The canvas binds four evidence layers to two different keys:

| layers | key | control |
| ------ | --- | ------- |
| FILL, EVIDENCE_LINE | `layers.countryEvidence` | the EVID chip |
| HALO, MARK | `layers.evidencePoints` | **none exists** |

`evidencePoints` is not in `RAIL_EVIDENCE_LAYERS`, so no rail control can ever
set it, and `layers.evidencePoints !== false` means an unset key reads as
**visible**. Both keys even share the same glyph, so they would read as one
layer.

Invisible today because `evidencePoints` is gated and draws nothing — turning
EVID off does remove all *visible* evidence. The moment a producer emits
point-precision evidence, marks appear that the EVID chip does not govern and no
control can switch off.

**Evidence:** `frontend/src/components/map/checkpointEEvidenceMode.spec.ts`

---

## Deferred for cause (behaviour)

### `ANALYSIS-NON-ENGLISH-MATERIAL-RELEVANCE-1`

**Status:** OPEN. Do not attempt an ad-hoc multilingual fix.

`COUNTRY_DEMONYMS_BY_ISO3` is English-only (e.g. `POL: ['polish']`), so the
corpus-admission gate cannot assess material relevance for non-English articles.
The gate is therefore **language-aware**: when the article language is not
English it admits rather than rejects, because rejecting on evidence the matcher
cannot read would discard an entire non-English corpus.

This was found by regression — an earlier, language-blind version of the gate
admitted **zero** articles for a Polish query.

**Why not fixed here:** a real fix needs multilingual demonym and locative data,
which is a data-sourcing task, not a convergence patch.

**Evidence:** `backend/src/modules/news/country/country-development-eligibility.util.ts`,
`polish-query-routing.spec.ts`

---

### `SPATIAL-GEOGRAPHY-COUNT-SEMANTICS-1`

**Status:** OPEN, carried from Checkpoint A2.

Geography counts on the spatial surface need a stated contract distinguishing
*resolved* from *retained* from *displayed*. Related in kind to
`ANALYSIS-ITEM-COUNT-SEMANTICS-1`: a number rendered without a noun that says
what it counts.

---

## Pending live-Alpha validation

These landed with passing structural tests and still need observation against a
running Alpha, because their inputs are model- and provider-dependent:

| item | what needs watching |
| ---- | ------------------- |
| J-1  | dimension semantic contract — that the model honours the declared classes |
| J    | grounding census — empty-dimension reasons against real generations |
| K    | corpus admission — that tightening did not silently narrow real queries |

---

## Protected throughout

Production remained HOLD. No Alpha deployment, no domain, DNS, or OAuth
mutation, and no change to Production GNews settings. Evidence thresholds were
not weakened at any point; where a test could only pass by loosening an
assertion, the cause was fixed instead.
