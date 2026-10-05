# T6 — Module → Shared Ask Binding Matrix (Stage 2)

Measured at Alpha runtime `5513275f` (Railway-verified), using the Stage 0 binding measurement (`../stage0/search-binding.json`) plus a Stage 2 seam inspection. This is a **measure-and-contract** tranche. No module implementation is duplicated here: Politics and Humanitarian stay with their lanes.

## The one binding chain every module must prove

```
stored evidence ──► searchable projection ──► shared retrieval ──► Ask ──► citation
(retained store,     (governed reader:          (selectContributors     (governed    (evidenceId /
 rights-admitted)     scope → observations)      keyed on SemanticTurnIR prompt)     contribution
                                                 domain facet)                        reference)
```

There is **one** chain and **one** seam. Every module plugs into `backend/src/modules/ask-intelligence`, which has these parts:

| Part | File | Role |
|---|---|---|
| Contract | `ask-contribution.contract.ts` | `ASK_CONTRIBUTOR_IDS` (today: CONFLICT, MARKET_PROCUREMENT, ECONOMY_CPI, IMIHIGO, GEOGRAPHY, HUMANITARIAN); `AskContributionStatus` (USED · NO_MATCH · NO_DATA · NOT_ASSESSED · DEGRADED · REFUSED); `AskTemporalBasis` |
| Selection | `contributor-selection.ts` | Decides which contributors apply to a turn |
| Read | `ask-specialist-read.coordinator.ts` | One `case` per contributor, reading the module's governed store |
| Answer | `governed-answer.ts` | Governed prompt and citation rules (e.g. G5: NOT_ASSESSED is never support) |

Rules that apply to every module:

- No module-specific Ask engine, conversation store or country registry.
- Geography always resolves through the one `GEOGRAPHY` contributor and the shared country registry.
- **A country match alone is never domain relevance** (T3).

## Seam ownership (why bindings are sequenced, not parallel)

| Seam file | Current owner | Consequence |
|---|---|---|
| `contributor-selection.ts`, `ask-specialist-read.coordinator.ts` | R4 earlier-turn continuity repair (contract R2 §T3) | No binding edits until final R4 exists |
| `ask-contribution.contract.ts`, `governed-answer.ts` | Humanitarian lane (edits both) | New contributor IDs and answer rules are reconciled after the Humanitarian convergence gate |

**Order:** final R4 → T3 fix (domain-facet selection) → Humanitarian contributor (its lane) → Politics contributor (its lane, onto final R4) → Energy / Security / Eurostat-Economy / Election contributors (Cloud, after the seam is free).

## Per-module matrix (Alpha `5513275f`)

| Module | Stored evidence | Searchable projection | Shared retrieval | Ask | Citation | Binding state | Owner of the next step |
|---|---|---|---|---|---|---|---|
| **Conflict / Security** | `ConflictObservation` (UCDP Candidate, retained, rights E-5) · `SecurityObservation` (no producer imported) | governed `readConflict` | CONFLICT contributor (**over-selects**, T3) | yes | contribution reference + evidenceId | **ASK_BOUND** (Conflict) · RETAINED_ONLY (Security) | T3 after final R4; Security via the CONFLICT domain contributor, never a second engine |
| **Economy** | NISR CPI retained (RWA, rights **unresolved**) · Eurostat producer unbound | governed `readCpi` | ECONOMY_CPI | yes (RWA only) | yes | **ASK_BOUND** (narrow) | Cloud: rights record for rw-nisr (T7) + Eurostat reader after seam free |
| **Market** | TED notices retained (E-5) · Comext `MarketObservation` unbound | `readProcurement` (**newest-20-then-filter defect**, false NO_MATCH) | MARKET_PROCUREMENT | yes | yes | **ASK_BOUND** | Cloud after seam free: filter-then-limit (P1-MKT-01) |
| **Official data** | NISR CPI, Imihigo (self-declared CC BY), Eurostat | governed readers (NISR) | ECONOMY_CPI / IMIHIGO | yes | yes | **ASK_BOUND** (NISR) · RETAINED_ONLY (Eurostat) | rights records (T7) |
| **Energy** | Eurostat `nrg_cb_pem` retained (one capture) | none | — (energy questions **select CONFLICT** today) | no | no | **RETAINED_ONLY** | Cloud after seam free: ENERGY contributor + governed reader |
| **Election** | IEBC KE bundle (reader flag off; no rights record) | none | — | no | no | **RETAINED_ONLY** (narrow, Kenya) | Election authority; stays separate from Politics |
| **Politics** | Alpha: ledger `[]` → NOT_ASSESSED · Lane `d920893`: `PoliticsObservation` store linked to the shared retained-capture store (`snapshotRetrievalId`, `artifactSha256`) | lane repository (`politics-observation.repository.ts`) | — | no | no | **RETAINED_ONLY** (lane) | **Politics lane**; Cloud provides the contract below, no implementation |
| **Humanitarian** | Alpha: constant NOT_ASSESSED · Lane `05e6c23e`: humanitarian specialist adapter + disclosure chain | lane adapter | HUMANITARIAN (NOT_ASSESSED) | honest absence | — | **ABSENT** on Alpha | **Humanitarian lane** (convergence gate) |
| **My Intelligence** | `SavedStory`, interests, follows | explicit SELECTION only | Ask V2 `executeSelection` | yes | yes | **ASK_BOUND** (selection) · RETAINED_ONLY (`SavedStory` free text) | keep selection-only; no free-text injection |
| **Briefings** | snapshot store | n/a (output sink) | n/a | n/a | **drops `payload.intelligence`** | RETAINED_ONLY | Cloud T-briefing after R4 (P1-BRF-01) |

## Integration contract for a new contributor (Politics, Energy, …)

A module is **ASK_BOUND** only when all eight items hold, each proved by a test:

1. **Retained store** admitted through the shared rights/admission path, with every record traceable to a retained artifact (content address).
2. **Governed reader** `read<Module>(scope)` → `AskContributionObservation[]` with `reference`, `kind`, source and temporal basis. No reader question text, no account, no model output.
3. **Contributor id** added to `ASK_CONTRIBUTOR_IDS`, with an `AskTemporalBasis` that never relabels retained data as current.
4. **Selection** keyed on a SemanticTurnIR domain facet (`politics`, `energy`, …) plus scope. **Country alone never selects.** Negative controls are mandatory, for example:
   - politics data must not answer weather;
   - energy data must not answer conflict;
   - a module's data must not answer generic country background.
5. **Statuses** are truthful: an empty store is NO_DATA, a non-matching scope is NO_MATCH, a missing reader is NOT_ASSESSED. None of these is ever a zero or evidence.
6. **Citation:** every claim drawn from the contribution carries its reference into the governed prompt and the answer's source list. Briefings preserve it (D-013).
7. **Freshness:** the answer states the observation's own date or reference period, and "current" only when the basis is current.
8. **Locale:** contribution codes are rendered by frontend catalogues in all seven display locales (T2). The backend emits codes, never words.

**Politics specifically.** The lane's `PoliticsObservation` already carries `upstreamAuthority`, `observationKind`, `temporal`, `provenance`, `revision` and the shared-capture link. The binding needs:
- a `POLITICS` contributor id;
- a governed reader over the repository;
- a politics domain facet in selection.

The no-person-channel rule is already pinned by the lane test `politics-no-person-channel.spec.ts`. That rule must survive into the contributor: institutions, legislatures and decisions only.

## Contract negative controls — status

| Control | Status at `5513275f` | Where it will be proven |
|---|---|---|
| Matching country ≠ matching domain | **FAIL** (T3 reproduces) | T3 regression spec, `test.failing` cases flip on the fix |
| Politics data must not answer weather | UNPROVEN (no politics contributor) | Politics contributor tests (lane) |
| Economy data must not answer unrelated politics | PROVEN (governed CPI) | existing `governed-answer.spec.ts` |
| Conflict data must not answer general travel | **FAIL** | T3 |
| Humanitarian must not answer generic country background | PROVEN by absence | Humanitarian lane, once data exists |
