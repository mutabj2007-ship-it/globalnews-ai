# STANDALONE ASK — HUMANITARIAN R2

**Requirement:** prove Standalone Ask on `globalnewsai.live` and the Alpha Humanitarian dashboard
use the **same** Humanitarian specialist, without requiring the dashboard to be public.

## 1 · The proof is an absence, which is the strongest form available

The adapter takes **no surface, role, tier, entitlement or viewer input at all.** There is no
parameter to branch on, so there is no branch to get wrong.

- `S-1` — no `surface` / `isAdmin` / `userRole` / `entitlement` / `tier` symbol in `src/`
- `SA-2` — no `callerSurface` / `isDashboard` / `isStandalone` / `isAlpha` / `viewer` symbol either
  (the clearance constants `CLEARED_FOR_ALPHA_RUNTIME` and `CLEARED_FOR_DEV_CAPTURE` are excluded
  before scanning: they are E1's vocabulary, not a surface input — the earlier form of this probe
  matched them and failed, and the **detector was corrected rather than the code bent to fit it**)
- `S-3` — **CONTROL**, proving the detector catches the ordinary form

Reachability is therefore a property of canonical Ask V2's routing, **not** of dashboard visibility.
The dashboard can stay Alpha-only while Standalone reads the same specialist.

## 2 · Byte-identity across the two surfaces, including sink payloads

`SA-1` pairs two corpus rows — `R2-DG1` (`STANDALONE_ASK`) and `R2-SA1`
(`ALPHA_DASHBOARD_CONTEXT`) — with the **same request against the same store**, and asserts the two
results are byte-identical after serialisation, **including their five sink payloads**.

The sink payloads are the part that matters. A surface-neutral availability state with a laxer
disclosure projection on Alpha would pass a naive parity check and still leak: Alpha readers would
see withheld material, and because a StoredResult is reopened into Saved/Recent and quoted back into
model context, that material would then travel. `SA-1` compares the whole envelope so the guard
cannot be laxer on the internal surface than on the public one.

The probe also asserts the two rows **still span two surfaces** — otherwise an edit that set both to
the same surface would make it vacuous while still passing.

## 3 · One engine, no second system

| Prohibition | How it is proven |
|---|---|
| no separate Humanitarian chatbot / AI engine | `N-1` — no `fetch`, `openai`, `gpt`, `anthropic`, `completion`, `embedding`, `provider` symbol in `src/` |
| no second chat / conversation / history system | `NS-1` — no `conversation`, `chatHistory`, `messageHistory`, `threadId`, `turnId` symbol |
| no separate quota / credit / charging system | `NS-1` — no `quota`, `credit`, `sand`, `charge`, `billing` symbol |
| no per-question source fetch | `N-1` plus `G7b` — a read that would need acquisition refuses rather than fetching |
| no legacy `/analysis/news` | `N-2`, with control `N-3` |
| zero AI / zero provider on reopen | `P-1` — an identical read repeated is byte-identical; nothing to re-run |
| no clock, randomness or env read | `N-4` |

`NS-2` is the control proving the second-system detector is not blind.

**Context preparation stays zero compute** by construction: the adapter reads retained rows and
returns data. It contains nothing that could execute a model call, so "AI only after an explicit
Ask/Run" needs no flag here.

## 4 · What is NOT proven, stated plainly

**That routing actually qualifies a humanitarian question on the Standalone surface.** That is Ask
V2's intent routing, not this adapter's: lane C receives a declared `questionKind` and adds no
classifier (the no-seventh-classifier ruling). So this package proves the specialist is **reachable
and surface-neutral** once routing selects it; it does **not** prove routing selects it for
*"What humanitarian emergencies are currently reported in Sudan?"*

**That is the single most important thing left to measure at convergence**, and it cannot be measured
from a session with no repository access. If upstream intent classification does not route that
question to the humanitarian specialist, every guarantee in this package is correct and unreachable.
The EN/PL half of that risk is already measured and open: `L` found the upstream vocabulary
English-only, and this adapter is language-neutral by construction but **does not improve it**.
