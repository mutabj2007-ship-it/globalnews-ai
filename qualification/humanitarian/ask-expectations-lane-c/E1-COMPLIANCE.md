# E1 RULING COMPLIANCE — LANE C

Two E1 R2 rulings landed after lane C's R2 package was built. Both were read before this
materialization, and this file states lane C's position against each — including where lane C is
**not** compliant.

Source: `E1-HUMANITARIAN-ASK-DISCLOSURE-RULING-R2` and `E1-HUMANITARIAN-READER-CLEARANCE-R2`,
both base `58f80fd4`, HEAD `340182c`.

---

## 1 · THE GAP — lane C's reference oracle carries no disclosure codes

**E1 D-1:** every hop that displays or persists a Humanitarian answer carries the six required
codes; a hop that cannot carry them **may not display Humanitarian evidence**.
**E1 D-4:** `IMPACT_NOT_ASSESSED` is mandatory on **every** Humanitarian answer, including ones that
successfully use retained rows, because silence about impact reads as *no impact reported*.

```
IMPACT_NOT_ASSESSED                  RETAINED_NOT_CURRENT
SEVERITY_NOT_ASSESSED                COUNTRY_SCOPE_NOT_STATED_BY_SOURCE
PUBLISHER_TIME_ZONE_NOT_STATED       GEOMETRY_WITHHELD_SOURCE_CENTROID
```

**Lane C's reference oracle emits none of them, and was not changed to.** The standing instruction
for this round is materialization, not adapter redesign, and adding a disclosure producer would be a
redesign — of the wrong artifact, since the canonical adapter is the one that must comply.

**What lane C did instead, inside its own authority:** encoded the six codes as a
`SEMANTIC_INVARIANT` in the portable expectations. `expectations/run-against-adapter.mjs` now
asserts, against **your** adapter:

- all six codes present on every answer whose availability is `AVAILABLE` (D-1);
- `IMPACT_NOT_ASSESSED` present on **every** answer (D-4).

If your binding does not report `disclosures`, the runner says so explicitly —
*"E1's six required codes (D-1) and the IMPACT_NOT_ASSESSED mandate (D-4) are UNVERIFIED against
your adapter"* — rather than passing silently. **Verified: that note fires against lane C's own
reference binding**, which is the honest result and proves the check is not vacuous.

**Consequence to act on at convergence.** Under D-1, a hop that cannot carry the six codes may not
display Humanitarian evidence. Lane C's reference oracle is therefore **not a hop that may display
Humanitarian evidence**, which is consistent with what it is: a test oracle, never runtime code.
That distinction should be stated wherever the oracle is placed, so nobody promotes it.

## 2 · D-2 is a finding lane C should have caught and did not

**E1 D-2:** no hop may assume a previous hop's disclosure; a code that reaches no consumer is a
defect at the **emitting** lane.

E1 measured `AskContribution.disclosures` as an **open** `readonly string[]` producer against
`governedPrompt`'s **closed** five-code if-chain, so `RETAINED_NOT_CURRENT` was being dropped on the
path where humanitarian evidence is actually **used**, and `SEVERITY_NOT_ASSESSED` was arriving
describing the records as *conflict* records.

**Lane C's R2 disclosure guard does not check this, and it is the same class of defect lane C has
been hunting all round**: an open producer against a closed consumer with nothing comparing them,
which is structurally identical to the "test that could not fail" pattern in `DEFECTS-FOUND.md` —
two sides that agree by coincidence rather than by construction. E1's
`assertDisclosuresRecognised(emitted, recognisedByConsumer)` is the right mechanism and it belongs
at the emitting lane. The portable expectations carry the rule as
`requiredDisclosures.consumerRecognitionRule` so it travels with the corpus, but **lane C did not
implement the assertion**, because the emitted set belongs to the canonical adapter.

## 3 · D-5 answered an open question, and corrected a reasoning error of mine

`DISCLOSURE-GUARD.md` §4 asked for a ruling on whether a withheld signal may be reader-facing, and
set out three options. **E1 chose option 3**: `GEOMETRY_WITHHELD_SOURCE_CENTROID` is reader-facing,
as a **constant** disclosure on every answer rather than a per-record one — so it informs the reader
while disclosing nothing about any particular place.

I had framed reader-information and byte-identity as mutually exclusive. They are not; the **grain**
of the signal was the free variable I missed. The corrected reasoning is recorded in
`DISCLOSURE-GUARD.md` §4 rather than silently replaced, because the error is the instructive part.

**Narrowed remainder:** D-5 settles geometry. It does not settle the case where every matching
*claim* is withheld, which still returns `NO_DATA_FOR_GEOGRAPHY` with the reason only on the audit
count. By D-5's own logic the fix has the same shape — a constant disclosure stating that protected
material is excluded from all answers — and lane C **recommends that without implementing it**, since
the vocabulary is E1's.

## 4 · D-6 confirms lane C's scope ceiling

**E1 D-6:** severity and alert level stay internal across all five hops, and the C-H3 adapter's
refusal to carry the severity string is **confirmed, not widened**.

Lane C is compliant by construction: `SourcedHumClaim` has no severity field, `PRODUCIBLE_SCOPES` is
`['COUNTRY', 'REGION']` and a finer scope is **refused rather than clamped** (`V-2`, `MU-10`), and
no coordinate, geometry or role field exists anywhere in the result (`A-4`).

## 5 · The clearance matrix was corrected, and it changed which authority is blocking

`E1-HUMANITARIAN-READER-CLEARANCE-R2`:

| Source | R1 | **R2** | reader-cleared |
|---|---|---|---|
| GDACS | `CLEARED_FOR_DEV_CAPTURE` | **`RIGHTS_CONFIRMATION_REQUIRED`** | no |
| ReliefWeb | `CREDENTIAL_REQUIRED` | `CREDENTIAL_REQUIRED` | no |
| Copernicus EMS | `PROTECTION_AUTHORITY_REQUIRED` | `PROTECTION_AUTHORITY_REQUIRED` | no |

**No source is `CLEARED_FOR_ALPHA_RUNTIME`; `READER_CLEARED_SOURCE_IDS` is `[]`.**

This **confirms lane C's binding predicate** — including the distinction `BP-2` exists to protect:
`CLEARED_FOR_DEV_CAPTURE` does not reader-clear a source. E1 has now moved GDACS off that clearance
entirely, noting it *"would describe a permission already spent and hide the gate that actually
stands."*

**Lane C corrected one fixture.** `MEASURED_INPUTS_TODAY.clearance` was `NOT_CLEARED` and is now
`RIGHTS_CONFIRMATION_REQUIRED`. The conclusion was already right — not registered — but
`NOT_CLEARED` **hid which authority stands in the way**, and that is the difference between a
question for the Product Owner (rights) and one for an engineer (credentials, protection). Probes
`BP-6` and `BP-7` pin it; mutations `MU-40`…`MU-42` bite.

**Product-shape fact worth carrying into convergence**, measured by E1 and not by lane C: GDACS
yields **0 impact claims in 100 records**, and ReliefWeb's report *text* — where impact figures live
— is withheld at admission. So **no source in this programme can currently supply an impact figure a
reader may see.** A humanitarian Ask answer can truthfully say *what hazard, where (country at best),
when*, and must say `NOT_ASSESSED` about people. That is a product decision, not a technical gap, and
it is why D-4 makes `IMPACT_NOT_ASSESSED` mandatory rather than conditional.
