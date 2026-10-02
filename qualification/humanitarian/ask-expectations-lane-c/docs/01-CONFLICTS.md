# HUMANITARIAN ASK TOOL R1 — CONFLICTS AND BLOCKERS

## REVISION NOTE — WHAT CHANGED SINCE THE FIRST ISSUE OF THIS DOC

Three statuses moved, and two of them because **I was working from the wrong authority**, not
because the facts changed. Recorded as corrections rather than edited away.

| | Was | Now |
|---|---|---|
| **C-H2** `NOT_ASSESSED` | **BLOCKER** — not one of the five accepted absence states | **RESOLVED.** `CONTRACT 2 §E` establishes it on a second, orthogonal **assessment** axis. Both axes are now carried. My original objection was right about availability and wrong about the question being asked |
| **C-H3** protected-location disclosure | **BLOCKER** — a new disclosure channel, E1's call | **RESOLVED UPSTREAM.** Claude Code already holds the leak-safe adapter. Lane C's corpus now serves as its regression proof. **I have not seen that adapter, so I assert nothing about its leak-safety** — the rows are expectations it should satisfy |
| **C-H1** observation key | BLOCKER | **STILL A BLOCKER**, owner Main |

The programme base also moved to `58f80fd4108d3472e5433c7a50e19295788f2544`, superseding the
`60d4aa9` baseline cited in the Development II entry. **This session could not verify either SHA.**

---

Reported, not resolved. The operating rule is explicit: *"If your chat history, project memory,
or another document conflicts with the Master Authority or a newer accepted register entry, STOP
and report the conflict rather than guessing."*

Three of these are **blockers on Contract 4 as written**. The rest are conflicts that must be
closed by their owning lane before this adapter is wired.

---

## C-H1 · BLOCKER — Part A's stable identifier has no landed construct

Contract 4 §A asks the adapter to read the canonical retained Humanitarian read using
*"stable identifiers (observation/event key, country ISO3, bounded time window)"*.

**Two of the three exist. The observation key does not.**
`MAIN-COUNTRY-INTELLIGENCE-CANONICAL-REUSE-AUDIT-R1` measured that `DomainObservation`,
`CanonicalOccurrence`, `facetKey` and `assertSingleOccurrenceAcrossDomains` are **not landed in
`shared/src`** — *"the join key exists; the rows do not"* — and ruled **"neither surface should
invent its own."**

**What this package did.** Accepted the field, defined no format for it, and refused any request
carrying one with `OBSERVATION_KEY_CONSTRUCT_ABSENT` — including against a governed store
(row `G2d`, probes `V-4`/`V-5`, mutation `MU-1`). Minting a key format here is precisely the
invention Main forbade.

**What must happen.** Main lands the canonical observation construct in `shared/src`, or rules
that `countryIso3` plus a stated window is the whole of the Ask join key for R1. Until one of
those, per-observation Ask routing cannot be built, and §E's "no cross-observation reuse"
cannot be satisfied for a key that does not exist.

---

## C-H2 · RESOLVED — `NOT_ASSESSED` belongs to a second axis, not the absence vocabulary

Contract 4 §B asks the tool to *"return NOT_ASSESSED / capability unavailable truthfully"* when
there is no data.

**`NOT_ASSESSED` is not in the accepted vocabulary.** The standing CTO ruling carried in
`MAIN-COUNTRY-INTELLIGENCE-CANONICAL-REUSE-AUDIT-R1` names five absence states —
`NOT_BUILT · NOT_CONNECTED · NO_DATA_FOR_GEOGRAPHY · TIER_RESTRICTED ·
TEMPORARILY_UNAVAILABLE` — plus `AVAILABLE`, **and requires that they must not collapse into one
word.** Adding a sixth absence word for a state the vocabulary already distinguishes is that
collapse in reverse.

**What this package did.** Used the accepted six, and measured today's Humanitarian state as
**`NOT_CONNECTED`** — the shared contract is present, the governed rows are not. Probe `AS-2`
fails the run if `NOT_ASSESSED` appears in `src/`; `AS-1` binds the runtime array to the type
union so neither can drift.

**RESOLUTION.** `CONTRACT 2 §E` settles it: `NOT_ASSESSED` is one of four **assessment** values
(`CURRENT_PROVIDER_OBSERVATION · RETAINED_REPORTING · NOT_ASSESSED · SOURCE_UNAVAILABLE`), which
is a different axis from availability. The adapter now carries both, and conflating them was the
collapse I was right to fear and wrong to locate:

```
AvailabilityState  — can the capability be read at all?   (platform / binding axis)
AssessmentState    — did an admitted source assess this?  (humanitarian evidence axis)
```

**Two invariants fall out, and both are new findings rather than restatements.**

1. **An unreachable store is `SOURCE_UNAVAILABLE`, never `NOT_ASSESSED`.** Saying "no source
   assessed this" when the truth is "we could not look" is precisely the sentence the programme
   rule forbids — the one a reader hears as *nothing happened*. Probe `AX-2`, mutation `MU-25`.
2. **`CURRENT_PROVIDER_OBSERVATION` is unreachable from this adapter by construction**, and
   should be unreachable from any Ask read that performs no provider fetch. §F separates
   acquisition from Ask execution, so an answer assembled from retained rows is
   `RETAINED_REPORTING` **however fresh those rows are**. Labelling it a current provider
   observation would claim a live reading no Ask turn performed. Probe `AX-3`, mutation `MU-26`.
   **Lanes G and H should not render an Ask answer as a current observation.**

The four values are consumed as a documented fixture because **Claude A's lane owns that
vocabulary** — `src/ports.ts` has the single union to change if A lands a different spelling.

---

## C-H3 · BLOCKER — an Ask humanitarian reader is a new protected-location disclosure channel

The accepted Humanitarian protected-location rules are: byte-identity between protected and
ordinary aggregation; role and admin-precision invariance; no geometry path; no fabricated
severity, count or location; and the per-record protected member removed (E1 CG-1).

**Those proofs were taken over the frontend rendering path.** Routing humanitarian data through
Ask produces two things they do not cover: **model-visible text** and a **stored result payload**
that is addressable, reopenable and quotable.

**What this package did.** Carried the rules structurally as far as this layer allows — the
reader has no role parameter, no geometry field and no coordinate field (probes `A-4`, `S-1`,
`L-1`); any scope finer than COUNTRY/REGION is refused rather than clamped (`V-2`, `MU-10`);
non-`AVAILABLE` carries no claim at all (`A-1`, `MU-12`).

**STATUS CHANGE.** Claude Code already holds the C-H3 leak-safe adapter, so this is no longer a
blocker on the programme. What lane C contributes is the **regression proof**: the rows and probes
above become standing assertions against that adapter via
`expectations/run-against-adapter.mjs`.

**What I still do not assert.** I have not seen the canonical adapter. Nothing here claims it is
leak-safe; these are expectations it should satisfy, and if it disagrees with lane C's reference
oracle, **the canonical adapter is right** and the disagreement is a finding to report, not a
patch to apply. Structural neutrality at this layer was never a disclosure proof and is not being
offered as one.

---

## C-H4 · EN/PL parity here is structural only — it does not close L's finding

Contract 4 §G asks for an EN/PL compatibility test. **This adapter is language-neutral by
construction**: it accepts `countryIso3` and a declared `questionKind`, never question text, so
probe `L-1` can assert that no language, locale or question-text symbol exists in `src/` at all.

**That is the strongest form available at this layer and it is not the whole problem.**
`L-ASK-R2-MULTILINGUAL-INTENT-AND-EVIDENCE-R1` measured the upstream vocabulary as English-only
(59/59 keywords and 24/24 patterns ASCII, accidental PL coverage 4/8). A Polish humanitarian
question still has to be classified upstream before this adapter is reached, and **nothing in
this package improves that.** Rows `G8a`/`G8b` prove the adapter does not make it worse.

---

## C-H5 · One refusal code was minted beyond the contract's vocabulary

`READ_CONTRACT_VIOLATION`, for a port that returns something its own contract forbids —
principally an unsourced claim. The reasoning, recorded so it can be overruled: a port is an
integration seam, a TypeScript type does not bind it at runtime, and the two alternatives were
to **drop the offending claim silently** (forbidden by ruling 2's no-silent-narrowing) or to
**serve an unsourced humanitarian claim** (forbidden outright). It maps to the accepted state
`TEMPORARILY_UNAVAILABLE` and mints no new absence word. Probe `V-1`, mutation `MU-9`.

---

## C-H6 · SUPERSESSION — `PLAN_NOT_SATISFIABLE` versus the frozen package's terminal

`H-ASK-R2-ANALYSIS-RESULT-ADDRESS-HANDOFF-CLOSURE-R1` carries Main ruling 3: **`PLAN_NOT_SATISFIABLE`
is the planning terminal**, while `INSUFFICIENT_EVIDENCE` keeps its name as the post-execution
verification outcome.

**The frozen router package routes planning-time inability to `CAPABILITY_UNAVAILABLE` instead.**
That was correct under the freeze-pass semantics it was built to and is **superseded** by Main
ruling 3. It is reported here rather than reconciled, because the frozen artifact is accepted at a
verified SHA and this lane is not authorised to amend it. **Whoever integrates must decide
whether the frozen router is re-issued against ruling 3 or the ruling is applied at the Ask V2
boundary.** This Humanitarian adapter emits neither name — it returns availability states and
refusal codes only — so it is unaffected either way.

---

## C-H7 · The instructed branch could not be created

Contract 4 names `feature/humanitarian-ask-tool-r1`. **No Git operation of any kind was performed
and none was possible.** Re-verified at the start of this round rather than carried: this session
has no clone, the GitHub API refuses every repository path with *"GitHub access to this
repository is not enabled for this session"*, and no device bridge tool exists here. The handoff
block states this in the fields that ask for branch and HEAD rather than supplying a plausible
value.

---

## C-H8 · `ASK_V2_ENABLED` must not be flipped to land this

Carried from E1: `ASK_V2_ENABLED` is default-off and **must not be enabled until the canonical
origin is settled and measured**. This package requires no flag change: registering a specialist
tool is orthogonal to enabling Ask V2, and today the correct registration result is *not
registered* anyway (C-H9). Nothing here is a reason to turn it on.

---

## C-H9 · Contract 4 §B is self-answering today — the honest answer is "not registered"

`E1-HUMANITARIAN-FINAL-ACTIVATION-R2` records Humanitarian activation as **blocked**: the real
database binding is not implemented, the producer is not committed, and `gx14-authority-store.sql`
has not been applied as a DBA action.

**So there is no bound governed retained humanitarian store, and the truthful answer today is
that the tool is NOT registered and Ask reports capability unavailable** — state `NOT_CONNECTED`,
refusal `SPECIALIST_NOT_BOUND`. Rows `G1b`, `G2c`, `G4a`, `G6a`; probes `B-1`, `B-3`, `AS-3`;
mutations `MU-2`, `MU-3`, `MU-22`, `MU-23`.

The counterfactual rows exist so this is provably a **rule** and not an unconditional dead end:
remove the governed-store rows and a reader that refuses everything forever would pass the whole
corpus and look correct.
