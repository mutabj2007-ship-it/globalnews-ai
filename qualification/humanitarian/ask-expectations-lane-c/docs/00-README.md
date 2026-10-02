# HUMANITARIAN CANONICAL ASK TOOL / ROUTER BINDING R1 — CANDIDATE PACKAGE

**Lane:** Claude C — core intel router and tool engine (`ask-router/frozen-c`).
**Class:** CANDIDATE. Not authorised for repository integration, merge, deployment, promotion or
canonical advance. **Production: HOLD.**
**Instruction:** Contract 4 — make Humanitarian data usable by the **same canonical Ask V2
engine** that serves Standalone Ask and Alpha. No separate chatbot. No OpenAI call from the module.

```
CORPUS      18 rows        18 PASS   0 FAIL
CONTRACT    8/8 of the §G named tests covered, asserted from the corpus data
STATES      4/6 availability states reached — the two unreachable ones are named and justified
PROBES      39             39 PASS   0 FAIL
MUTATIONS   23             23 BIT    0 SURVIVED   (18 behaviourally, 5 rejected by tsc)
DETERMINISM two separate processes, byte-identical output
```

## 0 · STATUS — THREE BLOCKERS, AND §B IS SELF-ANSWERING TODAY

**This package does not register the Humanitarian tool, and that is the correct outcome.**
E1 records humanitarian activation as blocked — no DB binding, producer uncommitted,
`gx14-authority-store.sql` unapplied — so there is no governed retained store, and the truthful
answer is `NOT_CONNECTED` / `SPECIALIST_NOT_BOUND`. The adapter is built so that this becomes a
registration the moment a real governed store is bound, and the counterfactual rows prove that is a
rule rather than a dead end.

Three blockers prevent Contract 4 being delivered as written. **Read `docs/01-CONFLICTS.md`
first.**

| | Blocker | Owner |
|---|---|---|
| **C-H1** | Part A's observation/event key has **no landed construct**, and Main ruled "neither surface should invent its own" | Main |
| **C-H2** | Part B's `NOT_ASSESSED` is **not one of the five accepted absence states**, which must not collapse | CTO |
| **C-H3** | An Ask humanitarian reader is a **new protected-location disclosure channel** — model-visible text plus a durable stored payload, not covered by the accepted frontend proofs | E1 |

One supersession is also reported rather than reconciled: **C-H6**, Main ruling 3's
`PLAN_NOT_SATISFIABLE` versus the frozen router's `CAPABILITY_UNAVAILABLE`.

## 1 · What this is, and what it deliberately is not

It answers one question: **may canonical Ask V2 consult Humanitarian for this question, and if
not, what is the truthful refusal?**

- **It is not a Humanitarian chatbot.** There is no engine here. One read port, one registration
  rule, one identity contribution.
- **It calls nothing.** No provider, no model, no OpenAI, no socket, no database, no clock, no
  randomness, no environment variable. Probe `N-1` asserts no such symbol exists in `src/`.
- **It computes no hash.** It emits separated identity material; the platform hashes it.
- **It takes no surface, role, tier or entitlement.** Standalone Ask and the Alpha dashboard reach
  the identical result, which is how §C and §D are satisfied without making the dashboard public.
- **It is language-neutral by construction** — ISO3 and a declared `questionKind`, never question
  text. That does **not** close L's English-only upstream finding (C-H4).
- **It fabricates nothing.** No severity, count, location, coordinate or geometry; a scope finer
  than COUNTRY/REGION is refused rather than clamped; a non-`AVAILABLE` result carries no claim at
  all.

## 2 · How to run

```sh
tsc -p tsconfig.json              # no install step; zero dependencies
node build/probes/run-corpus.js
node probes/probe.mjs
node probes/mutations.mjs         # copies the tree per mutation; never writes to it
```

## 3 · Read these before reviewing

| Doc | Why |
|---|---|
| `docs/01-CONFLICTS.md` | **Start here.** Three blockers, one supersession, five further conflicts |
| `docs/02-LIMITS.md` | What was carried versus measured; the governed store is a **fixture**, so integration is **UNMEASURED** |
| `docs/03-DEFECTS-FOUND.md` | **Four defects the mutation campaign found — every one a test that could not fail**, after the corpus and probes passed 18/18 and 39/39 on their first run |
| `docs/04-INTEGRATION.md` | The five wiring steps, what must not be done, and the acceptance test for each contract part |

## 4 · Layout

| Path | What it is |
|---|---|
| `src/ports.ts` | Vocabulary: the six availability states bound to their runtime array, refusal codes, the read request and result, the read port, identity and the U+001F material |
| `src/reader.ts` | The adapter — one decision per line; refusal ordering, port-answer validation, the scope ceiling, registration |
| `src/index.ts` | The single entry point Ask V2 consults |
| `corpus/corpus.ts` | 18 rows, each carrying its contract test and its provenance (`MEASURED_STATE_TODAY` or `COUNTERFACTUAL`) |
| `fixtures/store.fixture.ts` | Four store stand-ins plus three port-violation fixtures used only by probes |
| `probes/` | 39 probes with negative controls, and a 23-mutation campaign |
| `evidence/` | Captured runs |
