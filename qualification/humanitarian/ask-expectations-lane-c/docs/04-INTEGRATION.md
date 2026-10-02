# WHAT CLAUDE CODE MUST INTEGRATE

This package is additive and self-contained. It touches no existing path; every file is new.

## 1 · Placement

Suggested location, consistent with the existing frozen-c lane:
`backend/src/modules/ask-router/humanitarian-tool/` — `src/`, `corpus/`, `fixtures/`, `probes/`,
`docs/`. Zero dependencies; compiles with `tsc` alone; installs nothing.

## 2 · The five wiring steps, in order

1. **Bind the real governed retained humanitarian read behind `HumanitarianRetainedReadPort`.**
   `governed` must be `true` **only** for a real governed bound store — never for a stub, an empty
   authority, or a fixture. Probe `B-3` and defect `D-2` exist because that distinction is exactly
   where this has gone wrong before. **Today no such store exists (C-H9), so the correct wiring
   today is a port with `governed: false`, which registers nothing and refuses truthfully.**
2. **Re-run this corpus against the real port.** `node build/probes/run-corpus.js`. Rows that fail
   are integration defects; the counterfactual rows will fail until a governed store exists, and
   that failure is informative rather than a regression — see `02-LIMITS.md` §2.
3. **Join `identityMaterial(identity)` into Ask V2's existing identity chain** —
   `requestHash`, `fingerprint`, and the durable plan — and join `readerRevision` into
   `planRevision` so `ASK_PLAN_REVISION_MISMATCH` fires when the reader contract changes.
   **This module computes no hash** (probe `I-3`); it emits deterministic separated material and
   the platform hashes it, because a second hash would be a second identity space.
4. **Register the tool from `resolveBinding(port)`, not from a constant.** Registration must follow
   the binding, so an unbound store cannot present as a registered capability.
5. **Consult the same tool from both callers** — Standalone Ask on `globalnewsai.live` and the
   Alpha Humanitarian dashboard context. The adapter takes no surface, role or entitlement input
   (probe `S-1`), so reachability is a property of canonical Ask V2 and **not** of dashboard
   visibility, which is what Contract 4 §C requires.

## 3 · What must NOT be done while integrating

- **Do not turn on `ASK_V2_ENABLED`** to land this (C-H8). Registering a specialist tool is
  orthogonal to enabling Ask V2.
- **Do not register the tool before E1 rules on the new disclosure channel** (C-H3). Model-visible
  text and a durable stored payload are not covered by the accepted frontend protected-location
  proofs.
- **Do not mint an observation-key format** (C-H1). Main ruled neither surface may invent one.
- **Do not add `NOT_ASSESSED`** (C-H2) without a CTO ruling on where it sits relative to the five
  accepted absence states.
- **Do not add a provider fetch, a model call or a cache-warm path** to this module. §F separates
  acquisition from Ask execution, and the guarantee is currently structural: `src/` contains no
  network, provider or model symbol at all (probe `N-1`). A single `fetch` added here converts a
  proof into a promise.
- **Do not reconcile the `PLAN_NOT_SATISFIABLE` supersession inside this package** (C-H6). It is
  reported for decision; this adapter emits neither terminal name.

## 4 · Acceptance tests already in the package

| Requirement | Row / probe |
|---|---|
| §A retained read against stable identifiers | `G1a`, `G1c`, `V-5` |
| §B registration only on real governed data | `G1b`, `B-1`, `B-2`, `B-3` |
| §C standalone reach without a public dashboard | `G4a`, `S-1` |
| §D one tool for the dashboard context | `G5a`, `G5b`, `S-2` |
| §E identity participation, no cross-country reuse | `G3a`–`G3c`, `I-1`…`I-9` |
| §F retained-first, no provider fetch per Ask | `G7b`, `N-1`, `N-4` |
| §G eight named tests | `C-1` asserts all eight are covered from the data |
