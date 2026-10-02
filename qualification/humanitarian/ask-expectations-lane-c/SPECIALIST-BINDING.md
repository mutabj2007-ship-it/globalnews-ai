# SPECIALIST BINDING — HUMANITARIAN ASK R2

## 1 · The predicate

Humanitarian binds as a registered Ask specialist only when **all three** conjuncts hold:

```
governed                      a real governed bound retained store, not a stub that answers
readerSafeRetainedDataExists  rows that SURVIVE the disclosure partition, not merely rows
readerClears(clearance)       E1 reader-cleared the source behind them
```

`src/binding.ts` · `resolveSpecialistBinding()`. Probes `BP-1`…`BP-5`, mutations `MU-31`…`MU-33`.

**The AND is the point.** Each conjunct alone has shipped a leak somewhere: data without clearance
discloses un-cleared source material; clearance without data registers a capability that answers
nothing; either without `governed` lets a stub stand in for a store. Probe `BP-3` removes one
conjunct at a time and requires that binding fails each time, with that conjunct **named** —
`refusedBecause` carries every failed conjunct, not just the first, because an operator needs the
whole list to know what to fix.

## 2 · Reader clearance is narrower than clearance, and conflating them is the bug

E1 returns one of six values per source. **Exactly one reader-clears it:**

| E1 clearance | reader-clears? |
|---|---|
| `CLEARED_FOR_ALPHA_RUNTIME` | **yes** |
| `CLEARED_FOR_DEV_CAPTURE` | **no** — capture is not disclosure |
| `NOT_CLEARED` · `CREDENTIAL_REQUIRED` · `RIGHTS_CONFIRMATION_REQUIRED` · `PROTECTION_AUTHORITY_REQUIRED` | no |

`CLEARED_FOR_DEV_CAPTURE` permits **capture**. An Ask answer is **disclosure to a reader**, on the
public Standalone surface. Treating "cleared" as one idea would bind the tool on a dev-capture
clearance and publish material E1 cleared only for a developer's database. `MU-31` admits dev
capture and must be caught; `BP-2` names the confusion explicitly.

**E1's vocabulary is consumed, not invented.** `src/binding.ts` holds the single union to change if
E1 lands different spellings.

## 3 · Today's measured answer: NOT REGISTERED

`MEASURED_INPUTS_TODAY` carries what the register records, not a guess:

```
governed                      false   activation blocked: DB binding not implemented,
                                      producer uncommitted, gx14-authority-store.sql unapplied
readerSafeRetainedDataExists  false   HumanitarianRetainedRead.observations is `readonly never[]`;
                                      NO_RETAINED_CAPTURE_APPROVAL means nothing can be admitted
clearance                     NOT_CLEARED   Copernicus remains uncleared
```

All three fail. **The tool is not registered**, Ask reports capability unavailable, and that is the
truthful answer. `BP-1` asserts all three are reported.

## 4 · `registered` follows the binding, never the question

Registration is **not** per country. Registering per geography would make the registry vary by
question — which no landed registry does — and would **leak which countries hold humanitarian
rows** through the registry itself. Per-geography emptiness is a read-time fact
(`NO_DATA_FOR_GEOGRAPHY`), not a registration fact.

## 5 · The Ask terminal is FROZEN at `CAPABILITY_UNAVAILABLE`

Ruled for R2 and **not reopened here.** When Humanitarian is unavailable the Ask terminal is
`CAPABILITY_UNAVAILABLE`. Lane C emits no competing terminal: probe `BP-5` fails the run if
`PLAN_NOT_SATISFIABLE` or `INSUFFICIENT_EVIDENCE` appears anywhere in `src/`, and every corpus row
asserts its expected terminal independently.

This closes the R1 supersession report (C-H6) **in the direction the ruling chose**. The frozen
router's `CAPABILITY_UNAVAILABLE` stands for the humanitarian unavailability path.

## 6 · Two axes, carried separately

```
AvailabilityState  can the capability be read at all?   five accepted absence states + AVAILABLE
AssessmentState    did an admitted source assess this?  Contract 2 §E's four values
```

Two invariants, both probed and mutated:

- **An unreachable store is `SOURCE_UNAVAILABLE`, never `NOT_ASSESSED`.** "No source assessed this"
  when the truth is "we could not look" is the sentence a reader hears as *nothing happened*.
  `AX-2`, `MU-25`.
- **`CURRENT_PROVIDER_OBSERVATION` is unreachable from this adapter**, which performs no provider
  read. Retained rows are `RETAINED_REPORTING` **however fresh they are**. `AX-3`, `MU-26`.
  **Lanes G and H must not render an Ask answer as a current observation.**

## 7 · Main's `observationKey`, consumed opaquely

C-H1 is closed. The adapter **never parses, splits, normalises, lowercases or validates** a key —
it compares and orders by exact bytes. Opacity is what lets lane C use an identity whose *format*
belongs to Main without re-deriving it, and it means whatever spelling Main landed works unchanged.
Probe `OK-2` asserts no parsing construct exists in `src/`; `OK-1` asserts no-key, one-key and
two-key requests are three distinct identities; `OK-3` asserts the retired R1 refusal code is
emitted by no path.

**Dependency:** Main's definition was not discoverable from this session (not in the project, no
repository access), so the key is consumed as an opaque string rather than validated. **If Main's
identity requires normalisation before comparison — case folding, or a canonical ordering other
than byte order — that normalisation belongs in Main's construct and must be applied before the key
reaches this adapter.** Stated so the assumption is reviewable rather than buried.
