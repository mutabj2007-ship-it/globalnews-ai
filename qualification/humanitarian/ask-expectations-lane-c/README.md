# LANE C — HUMANITARIAN ASK R2 · MATERIALIZED PACKAGE

```
BASE SHA    58f80fd4108d3472e5433c7a50e19295788f2544   declared; NOT verifiable from this session
BRANCH      feature/humanitarian-ask-tool-r2
FINAL HEAD  c11e2f3c7613d665cdc05678af42270efa1ee3aa   in the bundle below
PUSH        NOT PUSHED — no repository access from this session
WORKTREE    clean at HEAD
CONVERGENCE integration/humanitarian-data-r1-convergence @ 56afaa6 NOT touched
```

```
CORPUS       22 rows   22 PASS  0 FAIL     8/8 of Contract 4 §G's named tests covered
PROBES       73        73 PASS  0 FAIL
MUTATIONS    42        42 BIT   0 SURVIVED   (37 behaviourally, 5 rejected by tsc)
PORTABLE RUN 22/22 against the reference binding
DETERMINISM  two separate processes, byte-identical
```

## This folder is browsable AND runnable — the bundle is a convenience, not the only copy

Everything is materialized here as real files. From this folder, with no bundle and no install:

```sh
tsc -p tsconfig.json
node build/probes/run-corpus.js                                          # 22/22
node probes/probe.mjs                                                    # 73/73
node probes/mutations.mjs                                                # 42/42 BIT
node expectations/run-against-adapter.mjs ./expectations/binding.reference.mjs
```

**Verified:** these files are byte-identical to the ones in the bundle commit, and all four
commands were re-run from a copy of this folder alone.

## What this is — and what it is not

**Regression material for the canonical leak-safe Ask specialist adapter that Claude Code holds.**
It does not define canonical Ask semantics and must not overwrite them.

`src/` is a **reference oracle**: the smallest adapter that satisfies the expectations, used to prove
the portable runner works and the mutations bite. **It is not a candidate implementation and must not
be promoted.** Under E1 D-1, a hop that cannot carry the six required disclosure codes may not display
Humanitarian evidence — the oracle carries none, so it is not such a hop. If it disagrees with the
canonical adapter, **the canonical adapter is right** and the disagreement is a finding to report.

## Read in this order

| File | Why |
|---|---|
| `E1-COMPLIANCE.md` | **Start here.** Lane C against both E1 R2 rulings, **including where lane C is not compliant** |
| `HANDOFF.md` | The ten required items, dependencies, what Claude Code must integrate |
| `expectations/ADAPTER-SEAM.md` | How to bind your adapter; the four invariants worth putting in CI |
| `DISCLOSURE-GUARD.md` | The five-sink proof, and §4 where E1's D-5 corrected a reasoning error of mine |
| `SPECIALIST-BINDING.md` | The three-conjunct predicate; why dev-capture clearance is not reader clearance |
| `CROSS-DOMAIN-ASK.md` | Conflict / geography / retained-story identity composition |
| `STANDALONE-ASK.md` | One specialist, both surfaces — and what is **not** proven |
| `DEFECTS-FOUND.md` | Five defects the campaign found; every one a test that could not fail |
| `CHANGED-EXPECTATIONS.md` | Every expectation and probe that changed, and why |

## Layout

| Path | What it is |
|---|---|
| `corpus/corpus.ts` | 22 rows, each carrying its §G contract test and its provenance |
| `probes/probe.mjs` | 73 probes with negative controls |
| `probes/mutations.mjs` | 42-mutation campaign; copies the tree per mutation, never writes to it |
| `expectations/humanitarian-ask-expectations.json` | **the portable deliverable** — adapter-agnostic, generated from the corpus |
| `expectations/run-against-adapter.mjs` | binds to any adapter through four functions |
| `expectations/binding.reference.mjs` | worked binding, so the runner is proven before you aim it |
| `src/` | reference oracle — ports, reader, disclosure guard, binding predicate, cross-domain identity |
| `fixtures/store.fixture.ts` | six store conditions + four port-violation fixtures, and the leak canary |
| `evidence/` | captured runs |
| `docs/` | method, limits, defects, changed expectations |
| `lane-c-humanitarian-ask-r2.bundle` · `0001-*.patch` | git transport; the patch applies on any base |

**READY FOR CTO HUMANITARIAN C ASK R2 REVIEW**
