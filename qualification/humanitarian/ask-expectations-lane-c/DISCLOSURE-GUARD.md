# DISCLOSURE GUARD — HUMANITARIAN ASK R2

**Requirement:** prove that `INTERNAL_ONLY` / protected / withheld evidence cannot enter model
context, sources, durable contribution, StoredResult, or Saved/Recent.

## 1 · One partition, five projections — not five filters

`src/disclosure.ts`. The retained read port hands over **classified** evidence. The adapter
partitions it once, and every sink payload is built from `partition.releasable` alone. The withheld
partition is **never passed to a sink constructor**.

Five independent filters would be five places to forget one. One partition with five projections
over it means a sink cannot see what it was never handed.

**The admission rule is not per-sink**, deliberately. A per-sink table invites a future row that
admits `INTERNAL_ONLY` to one sink "because it is only internal" — and the five sinks are not
independent: a StoredResult is reopened into Saved/Recent and quoted back into model context. Admitting
a class to one sink admits it to all. `admissibleToSink(cls)` takes no sink argument at all.

## 2 · The type split the compiler enforces

`RetainedReadOutput` (what the port returns, carrying `classified`) is a **different type** from
`HumanitarianReadResult` (what callers get, carrying reader-safe `claims` and `sinks`). Because the
two differ, a port output **cannot be returned to a caller by accident** — `tsc` refuses it. This was
not decorative: splitting the types produced eight compile errors that were each a place classified
evidence would have flowed straight through.

## 3 · Proven by canary, not by counting

Every non-reader-safe claim in the fixtures carries the token `ZZCANARYZZ-do-not-disclose-7f3a91`
in its text, its source ref and its as-of field. Probe **`DG-1`** serialises **all five sink
payloads, the reader-safe claim list, and the entire result envelope** for **every corpus row** and
asserts the token appears in none.

A canary is used instead of a structural assertion because it survives refactoring: if someone adds
a sixth projection, widens one, or stringifies a claim into a diagnostic, the token travels with the
leak. A `claims.length` check would not.

| Probe | Asserts |
|---|---|
| `DG-1` | the canary reaches none of the five sinks, nor claims, nor the envelope |
| `DG-2` | **CONTROL** — the canary IS present upstream, with exactly 3 blocked claims, so `DG-1` is not vacuous |
| `DG-3` | only `READER_SAFE` is admissible, and the rule takes no sink argument |
| `DG-4` | the audit count never appears inside a sink payload |
| `DG-5` | every refusal hands every sink nothing |
| `DG-6` | **STATED LIMIT** — classification is trusted; a mislabelled claim IS served |
| `DG-7` | the adapter attempts no content-based re-classification |

Mutations `MU-27` (admit `PROTECTED_LOCATION`), `MU-28` (push everything into `releasable`),
`MU-30` (leak the audit count into `SAVED_RECENT`) and `MU-39` (non-empty sinks on refusal) all bite.

## 4 · THE ONE DELIBERATE TRADE — and it needs E1 ratification

**If every matching claim is withheld, the reader sees the same thing as if there were no claims.**

This is forced, and the reasoning should be checked rather than taken on trust. E1's accepted rule is
byte-identity between a protected aggregation and an ordinary one. A reader-facing signal saying
"2 records withheld for Location X" would **break** that identity: it discloses that something
protected exists at X, which is the precise inference the rule exists to prevent. Even a boolean
leaks it. So the guard emits **no reader-facing signal derived from withheld content** — not a count,
not a flag, not a class name. `WITHHELD_SIGNAL_IS_READER_FACING = false`.

**The cost, named rather than buried:** a protected-only situation is indistinguishable to a reader
from an empty one, so the reader-facing output is less informative than the data. It fails closed,
which is the correct default, but it is a real loss.

**And there is nowhere truthful to put it.** The five accepted absence states contain **no member
meaning "present but not disclosable"**. The guard therefore maps this case onto
`NO_DATA_FOR_GEOGRAPHY` / `NOT_ASSESSED`, and the real reason lives **only** on the audit count.
Row `R2-DG2`, mutation `MU-29`.

### E1 HAS NOW RULED, AND IT CHOSE OPTION 3

`E1-HUMANITARIAN-ASK-DISCLOSURE-RULING-R2` **D-5**: geometry is not in the chain, and
`GEOMETRY_WITHHELD_SOURCE_CENTROID` is *"the disclosure that says so, so a reader is told the
location is not shown rather than being shown a point we manufactured confidence in."*

So a withheld signal **is** reader-facing — but as a **constant** disclosure carried on every
Humanitarian answer, not a per-record one. It does not vary with whether a protected record matched,
so it discloses nothing about any particular place. That is precisely option 3 of the three I set out,
and it is the right answer: it keeps the reader informed **and** preserves byte-identity, which I had
treated as mutually exclusive.

**I was wrong to frame this as a binary.** I assumed any reader-facing withheld signal would break
byte-identity, and concluded that silence was the only safe direction. The grain of the signal was
the free variable I missed. Recorded rather than quietly corrected, because the reasoning error is
the useful part: *a signal that is always present carries no information about whether it applies*.

**What this changes in lane C's expectations.** `WITHHELD_SIGNAL_IS_READER_FACING = false` remains
correct for the reference oracle, which emits no disclosure codes at all. But the canonical adapter
must carry the six required codes (`E1-COMPLIANCE.md`), and `GEOMETRY_WITHHELD_SOURCE_CENTROID` is
the one that discharges this section. The portable expectations now assert all six as
`SEMANTIC_INVARIANT`.

**What remains open, narrowed.** D-5 settles **geometry**. It does not settle the case where every
matching *claim* is withheld — a protected-only read still returns `NO_DATA_FOR_GEOGRAPHY` with the
truth only on the audit count. By D-5's own logic the fix is the same shape: a constant disclosure
carried on every Humanitarian answer saying that protected material is excluded from all answers,
rather than a signal that fires only when something was excluded. **Lane C recommends that and does
not implement it**, since the disclosure vocabulary is E1's.

## 5 · The stated limit: classification is trusted

The guard is **label-driven**. It cannot detect evidence whose disclosure class is wrong upstream,
and it deliberately does **not** attempt content-based re-classification — guessing at
protectedness from claim text would be its own fabrication, and would quietly become a second,
weaker protection authority competing with E1's.

Probe `DG-6` records this with a passing assertion so it is visible in the suite rather than only in
prose: a mislabelled protected claim **is** served. **If `DG-6` ever fails, the guard has started
second-guessing labels** — a behaviour change needing a ruling, not a silent improvement. `DG-7`
backs it by asserting no regex or text-scanning construct exists in `src/`.

**Consequence for convergence: correct classification is the retained store's responsibility**, and
this guard is the second line, not the first.

## 6 · What the guard does not cover

- **The model's own output.** The guard controls what enters the prompt; it cannot control what a
  model infers from reader-safe material. Aggregation-level inference risk is E1's domain.
- **Any sink not in the five.** Logs, metrics and traces are out of scope here, and the programme
  rule already forbids logging raw context. If a sixth sink is added, it must be added to
  `DISCLOSURE_SINKS` — `DG-1` iterates that array, so a sink added there is covered automatically
  and a sink added *elsewhere* is not.
- **Mislabelled evidence**, per §5.
