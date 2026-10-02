# HANDOFF — LANE C → CLAUDE CODE · HUMANITARIAN ASK R2 (MATERIALIZED)

## 0 · The ten required items

| # | Item | Value |
|---|---|---|
| 1 | **Exact base SHA** | `58f80fd4108d3472e5433c7a50e19295788f2544` — the declared programme base. **Not verifiable from this session**: no clone, GitHub 403 on every repository path, no device bridge. Re-checked this round. The commit below is a **root commit with no ancestry to it**, which is sound because every file is new |
| 2 | **Branch** | `feature/humanitarian-ask-tool-r2` — exists **inside the bundle**, not on any remote |
| 3 | **Final HEAD** | `c11e2f3c7613d665cdc05678af42270efa1ee3aa` — reachable by fetching the bundle, **and every file is also materialized in this folder, byte-identical** |
| 4 | **Changed files** | **Zero existing files changed.** 36 files added, 5,660 insertions |
| 5 | **Tests run** | corpus 22/22 · probes 73/73 · mutations 42/42 BIT · portable runner 22/22 · byte-identical across processes · **re-run green both from the fetched bundle and from a copy of this folder alone** |
| 6 | **Failures versus baseline** | **None measured; none measurable here** — no repository to run a baseline against. The package cannot regress what it does not touch: no dependency, no existing file, no env read, no flag, no provider, no code outside its own directory. **Integration is UNMEASURED** |
| 7 | **Dependencies on other lanes** | §3 |
| 8 | **What Claude Code must integrate** | §4 |
| 9 | **No merge / no deploy** | Confirmed, §5 |
| 10 | **Marker** | end of this file |

## 1 · This round's requirement: materialization, adapter not redesigned

The corpus, probes, mutations, fixtures, reference oracle, portable expectations, evidence and docs
are **real files in this folder**, not only contents of a bundle. Verified: byte-identical to the
bundle commit, and all four suites re-run green from a copy of the folder with no git involved.

**The adapter was not redesigned.** The only code changes were a fixture correction forced by E1's
new matrix (§2) and two probes covering it.

## 2 · E1's two R2 rulings were read before materializing — including where lane C fails them

`E1-COMPLIANCE.md` is the full statement. In short:

- **D-1 / D-4 — lane C is NOT compliant, and was not changed to be.** The reference oracle emits none
  of the six required disclosure codes (`IMPACT_NOT_ASSESSED`, `RETAINED_NOT_CURRENT`,
  `SEVERITY_NOT_ASSESSED`, `COUNTRY_SCOPE_NOT_STATED_BY_SOURCE`, `PUBLISHER_TIME_ZONE_NOT_STATED`,
  `GEOMETRY_WITHHELD_SOURCE_CENTROID`). Adding a disclosure producer would be an adapter redesign,
  which this round forbids — and of the wrong artifact, since the canonical adapter is the one that
  must comply. Instead the six are encoded as a `SEMANTIC_INVARIANT` in the portable expectations and
  asserted **against your adapter**. A binding that does not report `disclosures` is told they are
  `UNVERIFIED` rather than passing silently; **verified that the note fires against lane C's own
  binding**, which is the honest result and proves the check is not vacuous.
- **D-2** — the open-producer / closed-consumer defect E1 measured (`RETAINED_NOT_CURRENT` dropped on
  the **used** path; `SEVERITY_NOT_ASSESSED` arriving worded for conflict records) is the same class as
  every defect in `DEFECTS-FOUND.md`: two sides agreeing by coincidence rather than by construction.
  Carried as a rule in the expectations; the assertion belongs at the **emitting** lane, which is not
  lane C.
- **D-5 — answered the open question in `DISCLOSURE-GUARD.md` §4 and corrected a reasoning error of
  mine.** I had framed reader-information and byte-identity as mutually exclusive; the **grain** of the
  signal was the free variable I missed — a disclosure carried on *every* answer informs the reader
  while disclosing nothing about any particular place. Recorded rather than silently replaced.
- **D-6** — lane C compliant by construction: no severity, geometry, coordinate or role field exists
  anywhere in the result, and a scope finer than COUNTRY/REGION is refused rather than clamped.
- **Reader clearance R2** — GDACS moved `CLEARED_FOR_DEV_CAPTURE` → `RIGHTS_CONFIRMATION_REQUIRED`;
  `READER_CLEARED_SOURCE_IDS` is `[]`. This **confirms** the binding predicate, including the
  distinction `BP-2` exists to protect. One fixture corrected: `MEASURED_INPUTS_TODAY.clearance` from
  `NOT_CLEARED` to `RIGHTS_CONFIRMATION_REQUIRED`, because the generic word hid **which** authority is
  blocking — rights is a Product Owner question, not an engineering one. Probes `BP-6`/`BP-7`,
  mutations `MU-40`…`MU-42`.

### The one thing still needing a ruling, now narrowed

D-5 settles **geometry**. It does not settle the case where every matching **claim** is withheld: a
protected-only read still returns `NO_DATA_FOR_GEOGRAPHY` with the reason only on an audit count, so a
protected-only situation is indistinguishable to a reader from an empty one. By D-5's own logic the fix
has the same shape — a constant disclosure on every Humanitarian answer stating that protected material
is excluded from all answers. **Lane C recommends that and does not implement it**, because the
disclosure vocabulary is E1's.

## 3 · Dependencies on other lanes

| Lane | Dependency | How lane C handled it |
|---|---|---|
| **Main** | `observationKey` — **definition not discoverable from this session** | Consumed as an **opaque byte string**: compared and ordered, never parsed, split, normalised or validated. Works whatever format Main landed. **If the identity needs normalisation before comparison, that belongs in Main's construct, upstream of this adapter** |
| **Main / A** | **Two absence vocabularies conflict.** Contract 1 §C (`NOT_ASSESSED · SOURCE_TEMPORARILY_UNAVAILABLE · COVERAGE_GAP · NO_RETAINED_EVIDENCE`) overlaps but does not equal Contract 2/3 §E (`CURRENT_PROVIDER_OBSERVATION · RETAINED_REPORTING · NOT_ASSESSED · SOURCE_UNAVAILABLE`) | **Reported, not reconciled.** Lane C uses §E, the axis Ask answers sit on. **Agree one spelling before convergence**, or the collapse both rulings forbid happens at the seam between them |
| **E1** | the six-value clearance vocabulary; the six required disclosure codes; the narrowed ruling above | Vocabulary consumed as fixtures with a single union to change; the codes asserted against your adapter |
| **Conflict / geography / retained-story lanes** | whether each exposes an identity string, and in what form | `ContributingLeg.identity` is opaque so any form carries. **The join is unverified until those identities are wired** |
| **Ask V2 / platform** | identity material must be consumable. **H measured the turn DTO as exactly four fields** (`idempotencyKey, question, language, intent`), frozen by string equality | So humanitarian context **cannot ride on the DTO** and must be server-derived. Lane C emits separated material and computes no hash. If the platform derives identity from a fixed field list, §E fails **silently** — the worst mode, since a cached refusal serves the wrong country today and a cached **answer** does tomorrow |
| **L** | upstream vocabulary measured English-only | This adapter is language-neutral by construction and **does not improve it** |

No other lane's worktree, branch or implementation was read, copied or modified.

## 4 · What Claude Code must integrate

**Regression material, not runtime code.** `src/` is a reference oracle proving the runner works and
the mutations bite. Under E1 D-1 a hop that cannot carry the six codes may not display Humanitarian
evidence — the oracle carries none, so **it must not be promoted to runtime**. If it disagrees with the
canonical adapter, **the canonical adapter is right**.

```sh
# option A — no git at all; this folder runs standalone
tsc -p tsconfig.json && node build/probes/run-corpus.js && node probes/probe.mjs

# option B — git transport
git fetch /path/to/lane-c-humanitarian-ask-r2.bundle 'refs/heads/*:refs/remotes/lane-c/*'
git checkout -b lane-c-r2 lane-c/feature/humanitarian-ask-tool-r2
# or, on any base, since every file is new:
git apply 0001-lane-c-humanitarian-ask-r2.patch
```

Suggested placement `backend/test/humanitarian/ask-expectations-lane-c/`. Relocatable: no absolute
paths, no imports outside itself, zero dependencies, no install step.

1. **Write a binding** per `expectations/ADAPTER-SEAM.md`. **Expose `sinks` + `leakCanary`** (the
   five-sink leak check is the most valuable assertion here), **`identityMaterial`** (§E separation),
   and **`disclosures`** (E1 D-1/D-4). Each is reported `UNVERIFIED` without the corresponding export.
2. **Wire the four CI invariants** at the end of `ADAPTER-SEAM.md`. The first still matters most: bind
   `UNBOUND_NO_GOVERNED_BINDING` to a store that **answers with data**, not one that politely refuses —
   defect `D-2` was exactly that mistake and it turned a probe into decoration.
3. **Expect the counterfactual rows to fail until a governed store is bound.** That is the corpus
   stating what must become true, not a regression.
4. **Consider adopting the type split.** `RetainedReadOutput` (classified) vs `HumanitarianReadResult`
   (reader-safe) turned eight potential pass-throughs of classified evidence into compile errors — a
   stronger guarantee than any probe here, and free.
5. **Add `assertDisclosuresRecognised` at the emitting lane** (E1 D-2). Lane C carries the rule but
   cannot run it: the emitted set is the canonical adapter's.
6. **Re-export if you change the corpus:** `node build/expectations/export.js > expectations/humanitarian-ask-expectations.json`.

### Must not

- Do **not** turn on `ASK_V2_ENABLED` to land this.
- Do **not** register the specialist. **No source is reader-cleared** (E1 R2), so all three conjuncts
  fail and the truthful state is *not registered*. `CLEARED_FOR_DEV_CAPTURE` is not reader clearance.
- Do **not** promote `src/` to runtime (E1 D-1, above).
- Do **not** adopt lane C's refusal-code spellings as canonical — `PACKAGE_CONVENTION`; supply
  `refusalAliases`.
- Do **not** add a provider fetch, model call or cache-warm path to the Ask read path. The §F guarantee
  is **structural** today — `src/` contains no network, provider or model symbol at all — and one
  `fetch` converts a proof into a promise.
- Do **not** let the guard re-classify by content. If `DG-6` starts failing, the guard has become a
  second, weaker protection authority competing with E1's.
- Do **not** add a sink outside `DISCLOSURE_SINKS`. `DG-1` iterates that array, so a sink added there
  is covered automatically and one added elsewhere is not.

## 5 · Push status, clean worktree, and the one hop this session cannot perform

```
PUSH STATUS   NOT PUSHED. No repository access: no clone, GitHub 403 on every repository path,
              no device bridge. No remote configured; no push attempted.
WORKTREE      CLEAN. `git status --porcelain` empty at HEAD c11e2f3c…; build/ and node_modules/
              gitignored and build output removed before committing.
CONVERGENCE   integration/humanitarian-data-r1-convergence @ 56afaa6 NOT touched, not fetched,
              not modified.
NO MERGE      Nothing merged, promoted, deployed, tagged or pushed. No canonical advance. No
              Production or Alpha action. No Railway, OperationalSwitch, Sand, quota, guest-policy
              or navigation change. No Prisma migration. No provider enabled; Copernicus untouched;
              no ReliefWeb appname or credential. No second Ask engine, chat, history or quota
              system. No Humanitarian data fabricated. No reader-facing copy — every refusal is a
              code and the frontend owns every word. No other lane's authority taken.
```

**The programme requires this at `D:/Desktop/GlobalNewsAI/Claude_Output/HUMANITARIAN-DATA-R1/C/`.
This session cannot write there** — that path is on the Product Owner's Windows machine and there is no
bridge to it, verified by search (`/mnt/d` and `/mnt/c` absent, no `drvfs`/`cifs`/`9p` mount, no
remote-device tool) rather than assumed. The package is delivered under the identical relative layout
`HUMANITARIAN-DATA-R1/C/`, so the final hop is an unzip into `Claude_Output`. **Nothing was substituted
to work around it, and no SHA is reported that the bundle does not contain.**

---

**READY FOR CTO HUMANITARIAN C ASK R2 REVIEW**
