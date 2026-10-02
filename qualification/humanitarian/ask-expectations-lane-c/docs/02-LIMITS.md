# HUMANITARIAN ASK TOOL R1 — METHOD, LIMITS, AND WHAT IS UNMEASURED

`G-REPORT-1` is binding: every claim in the narrowest true form. Limits before results, so no
result is read more widely than it should be.

---

## 1 · NOTHING IN THE TREE WAS MEASURED BY THIS SESSION

Every fact about landed code in this package is **carried** from register artefacts, not measured
here. This session has no repository access — re-verified this round, not assumed.

| Carried from | Subject |
|---|---|
| `MAIN-COUNTRY-INTELLIGENCE-CANONICAL-REUSE-AUDIT-R1` | the five absence states and the no-collapse ruling; `DomainObservation`/`CanonicalOccurrence`/`facetKey` not landed in `shared/src`; "neither surface should invent its own"; humanitarian has a shared contract → `NOT_CONNECTED` |
| `E1-HUMANITARIAN-FINAL-ACTIVATION-R2` | activation blocked: DB binding not implemented, producer uncommitted, `gx14-authority-store.sql` unapplied |
| `E1` humanitarian protected-location rulings | byte-identity of protected and ordinary aggregation, role/admin precision invariance, no geometry path, no fabricated severity/count/location, CG-1 |
| `E1-ASK-R2-INDEPENDENT-POST-INTEGRATION-VERIFICATION-R1` | `ask-router/frozen-c/` reported in-tree; `AUTHENTICATED_API_FAMILIES` drift |
| `H-ASK-R2-ANALYSIS-RESULT-ADDRESS-HANDOFF-CLOSURE-R1` | Main ruling 3 — `PLAN_NOT_SATISFIABLE` as the planning terminal |
| `H-ASK-R2-ANALYSIS-WORKSPACE-HANDOFF-CONTRACT-R1` | the `SPECIALIST` body shape `{ domainId, questionKind, assessment, registryState }` |
| `MAIN-ASK-INTELLIGENCE-ENGINE-R2` | no classifier #7; the envelope is server-derived; intent classification is a separate contract |
| `MAIN-TRANSPORT-RECORD-ROUTING-AND-SCOPE-R1` | the U+001F separator is load-bearing; new dimensions go through the same separated encoding |
| `L-ASK-R2-MULTILINGUAL-INTENT-AND-EVIDENCE-R1` | English-only vocabulary; `region` matches in Polish, `région` fails on a diacritic |
| E1 Ask V2 enablement finding | `ASK_V2_ENABLED` default-off and must not be enabled until the canonical origin is settled |

**`ask-router/frozen-c/` was not read.** Its presence in-tree is E1's measurement, not mine.

## 2 · THE CORPUS EXERCISES THE ADAPTER, NOT THE HUMANITARIAN STORE

The most important limit, stated as plainly as possible.

**The governed store is a fixture.** `18/18 PASS` means: *given a port that behaves this way, the
adapter refuses and serves as the contract says it must.* It does **not** mean a humanitarian
store exists, nor that one would behave this way. Today none does (C-H9), which is why half the
corpus is labelled `COUNTERFACTUAL` in the data itself and probe `C-2` fails the run if either
provenance class disappears.

**So integration is UNMEASURED and no PASS is claimed for it.** Specifically unmeasured:

- whether the canonical retained humanitarian read, once bound, exposes `countryIso3` at the shape
  this port assumes;
- whether its rows carry source references at all, which `A-3` requires of anything served;
- whether its natural scope is COUNTRY, REGION, or something finer that `V-2` would refuse;
- whether Ask V2's `requestHash`/`fingerprint` actually consume externally supplied identity
  material, or compute identity from a fixed field list that this tool cannot join;
- whether `planRevision` invalidation fires on `readerRevision` change.

**The first integration step is therefore to bind the real retained read behind
`HumanitarianRetainedReadPort` and re-run this corpus.** Rows that then fail are the integration
defects the corpus exists to find.

## 3 · TWO ABSENCE STATES ARE UNREACHABLE FROM THIS ADAPTER, AND THAT IS DELIBERATE

The corpus reaches `AVAILABLE`, `NOT_CONNECTED`, `NO_DATA_FOR_GEOGRAPHY` and
`TEMPORARILY_UNAVAILABLE` — **4 of 6**.

`NOT_BUILT` and `TIER_RESTRICTED` are **not reachable from this adapter and no row pretends they
are.** `NOT_BUILT` is a statement about a surface that does not exist, which Humanitarian is not —
it has a shared contract. `TIER_RESTRICTED` is an entitlement fact, and this adapter deliberately
takes no role, tier or entitlement input (probe `S-1`), because a reader whose precision varied by
role would breach the accepted role-invariance rule. Both remain in the union because the
no-collapse ruling keeps them distinct for the surfaces that do produce them.

## 4 · WHAT WAS ACTUALLY MEASURED HERE

Properties of this package's own code only, reproducible by the commands in `00-README.md`:

```
CORPUS      18 rows        18 PASS   0 FAIL
CONTRACT    8/8 of §G's named tests covered, asserted from the data
STATES      4/6 reached — the two unreachable ones named in §3
PROBES      39             39 PASS   0 FAIL
MUTATIONS   23             23 BIT    0 SURVIVED
DETERMINISM two separate processes, byte-identical output
```

## 5 · LIMITS OF THE PROBES AND THE CAMPAIGN THEMSELVES

- **Five of the 23 mutations were rejected by `tsc` rather than caught by their named probe**
  (`MU-12`, `MU-14`, `MU-16`, `MU-17`, `MU-18`). That is a *stronger* guarantee — the rule is
  enforced by the type system — but it means those five did not demonstrate the named probe firing
  behaviourally. The probes keep their own negative controls (`N-3`, `L-3`, `A-2`), which prove the
  detector catches the straightforward form, and that is all a control can establish.
  **Eighteen of 23 bit behaviourally.**
- `N-1`, `N-2`, `L-1`, `S-1`, `I-3` and `AS-2` are **source-text** probes over comment-stripped
  code. They can be defeated by an obfuscated construction.
- The campaign is **23 hand-written mutations, not a generated campaign**. It shows that 23
  specific rules bind. It does not measure a mutation score.
- `M-1` checks that absence probes still have controls, by naming convention. It guards against a
  later edit dropping one; it is not a proof of probe completeness.
- The counterfactual fixtures describe **nothing** about the product. They exist only to prove the
  refusal rules are conditional.

## 6 · NON-ACTIONS

No Git operation of any kind — no clone, branch, worktree, commit, push, tag or history rewrite;
the instructed branch could not be created (C-H7). No repository integration. Nothing merged,
promoted, deployed or tagged. No canonical advance. **No separate Humanitarian chatbot and no
second engine.** **No OpenAI or other model call from this module, and no provider fetch** —
probe `N-1` asserts no such symbol exists in `src/`. No database opened. No socket. No clock, no
randomness, no environment variable read (`N-4`). No legacy `/analysis/news` path (`N-2`). No
feature flag changed; `ASK_V2_ENABLED` untouched. No accepted authority modified — the frozen
router artifact was not altered, re-issued or re-zipped. No reader-facing copy: every refusal is a
**code** and the frontend owns every word. No geometry, coordinate, role or entitlement field. No
dependency added; the package installs nothing. No upload path and no code execution.
