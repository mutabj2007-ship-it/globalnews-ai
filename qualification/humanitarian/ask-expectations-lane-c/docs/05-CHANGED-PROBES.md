# CHANGED EXPECTATIONS AND PROBES — RECORDED, NOT QUIETLY EDITED

Ruling 8's standing instruction is to correct the code rather than the expectation, and to record
any expectation that does change. Two changed in this revision, both because the programme
authority moved, and neither to make a failing test pass.

## 1 · `AS-2` was rewritten — `NOT_ASSESSED` is legitimate on the assessment axis

**Was:** *"`NOT_ASSESSED` was not minted as a seventh word"* — asserting the string appeared
nowhere in `src/`.

**Now:** *"`NOT_ASSESSED` is on the assessment axis only, never an availability state."*

**Why.** The original assertion was correct under Development II's absence-state ruling, and
obsolete under Development III: `CONTRACT 2 §E` establishes `NOT_ASSESSED` as one of four
**assessment** values, and the programme instructions treat it as a first-class distinction that
*"must never silently become 'nothing happened'"*. The guarantee worth keeping is that the two
axes stay separate — `NOT_ASSESSED` must not become a sixth **absence** word — and that is what
the probe now asserts.

**This was a real correction to my previous position.** The earlier register entry reported
`NOT_ASSESSED` as blocker C-H2 on the grounds that it was not an accepted absence state. That
reasoning was right about availability and wrong about the question being asked. C-H2 is
**downgraded from a blocker to a resolved two-axis design**, and the resolution is recorded in
`01-CONFLICTS.md`.

**Backed by:** `AS-1` plus `MU-14`, which adds `NOT_ASSESSED` to `AvailabilityState` and is
rejected by `tsc` because `AVAILABILITY_EXHAUSTIVE` would no longer be total. The guarantee is
enforced by the compiler; `AS-2` is the runtime restatement.

## 2 · `expectAssessment` was added to every corpus row, authored rather than derived

Each row names its expected assessment **independently** of `assessmentFor()`. Deriving it would
have made the corpus agree with whatever the mapping said, so a wrong mapping would be invisible.
`MU-24` changes the mapping for `NO_DATA_FOR_GEOGRAPHY` and the **corpus** fails — which is only
possible because the two are authored separately.

## 3 · Three mutation anchors were repaired after the refactor

`MU-13`, `MU-22` and `MU-20`'s anchors no longer matched once `assessment` was threaded through
the result objects. Repaired to bite their named probes again. **A lost anchor is reported as
`ANCHOR LOST`, not silently skipped**, because a mutation that no longer applies leaves its probe
unproven — the campaign's own failure mode.

---

# R2 CHANGES

## 4 · Two expectations changed because C-H1 CLOSED, not to make a test pass

Main landed the `observationKey` identity, so the R1 refusal became wrong. Both changes are
recorded here and **both were driven by a failing run that I let fail first**: the corpus reported
`G2d` red immediately after the refactor, which is how it should go.

| | Was (R1) | Now (R2) |
|---|---|---|
| **row `G2d`** | `OBSERVATION_KEY_CONSTRUCT_ABSENT` — a supplied key refused, because Main had not landed the identity and the ruling forbade inventing one | **renamed** `G2d-observation-key-accepted-opaquely`; the key is accepted and the read serves |
| **probe `V-4`** | *"an observation key is refused even against a governed store"* | *"an observation key is accepted AND reaches identity, never silently dropped"* |

`V-4`'s rewrite keeps a real guarantee rather than deleting one. The new failure mode, once keys are
accepted, is that a key is **silently ignored** — accepted at the boundary and dropped before
identity, so two different observation questions share a cache entry. `V-4` now asserts the key
reaches `identity.observationKeys` **and** changes `identityMaterial`. `OK-3` separately asserts the
retired code is emitted by no path, and the code is **kept in the union** so a reintroduced
key-format check would have to add a new code instead of quietly reusing this one.

## 5 · `SA-2`'s detector was too broad and was corrected

`SA-2` asserts no surface input exists in `src/`. Its first form matched `/alpha/i` and failed on
`CLEARED_FOR_ALPHA_RUNTIME` — **E1's clearance vocabulary, not a surface parameter.**

The detector was wrong, so the detector was fixed: the clearance constants are stripped before
scanning and the pattern now matches surface-shaped identifiers only. **The code was not renamed to
satisfy a bad probe.** Recorded because the opposite choice — renaming E1's constant to get a green
run — is the tempting one and would have corrupted another lane's vocabulary.

## 6 · Five mutation anchors were repaired after the R2 refactor

`MU-1`, `MU-9`, `MU-11`, `MU-13` and `MU-22` lost their anchors when the port output type was split
and the fixtures were rewritten. All five are repaired and bite their named probes again. `MU-1` was
**retargeted** rather than repaired: the code it mutated no longer exists, so it now re-introduces
the retired key refusal and must be caught by `OK-3`.

**A lost anchor is reported as `ANCHOR LOST`, never silently skipped.** A mutation that no longer
applies leaves its probe unproven, and the campaign's own failure mode is reporting a clean sweep
while several mutations quietly did nothing.
