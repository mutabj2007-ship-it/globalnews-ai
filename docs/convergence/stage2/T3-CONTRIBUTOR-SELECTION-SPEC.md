# Stage 2 · T3: Shared Ask contributor-selection defect (reproduce and spec only)

- **Branch:** `claude/stage2-t3-contributor-selection-spec`
- **Exact base:** `5513275ff731936a07c01e937b92c263ba6d6cf9` (live Alpha)
- **Scope:** reproduce the defect, pin it in a spec, and propose a patch. **No production source is changed in this commit.** `contributor-selection.ts`, ask-v2, ask-router and the coordinator are untouched. The fix lands only after the final R4 SHA exists (see the integration rule in §7).

## 1. Defect

`backend/src/modules/ask-intelligence/contributor-selection.ts` has two parts that combine into the defect.

- **:27-45.** `CONTRIBUTOR_SCOPE_TERMS.SITUATION` includes generic nouns: `situation`, `crisis`, `sytuacja`, `sytuacji` and `kryzys`.
- **:224-236.** The CONFLICT contributor is selected on `countryIso3 !== null && (security || (!dataScoped && namesScope(question, SITUATION)))`.

As a result, any typed country plus one of those generic nouns selects CONFLICT. The coordinator (`ask-specialist-read.coordinator.ts` `readConflict`, around :331-360) then reads up to `CONFLICT_MAX_OBSERVATIONS = 10` retained UCDP records for that country. Those records go into the governed prompt as specialist evidence for questions about travel, visas, politics, energy, the economy, weather, unemployment or refugees. The same selection also feeds `deterministicGovernedSelection` in `ask-v2/ask-r2-execution.adapter.ts:957`.

## 2. Reproduction across the three SHAs

Every row below was produced by the real `routeAskR2`, which runs qualified reading, then SemanticTurnIR `interpretTurn`, then the frozen-C plan, followed by the real `selectContributors`. Nothing was mocked.

The registry port used was `landedSpecialistRegistryPort(() => ['CONFLICT'], ['CONFLICT'])`, the same port the existing ask-intelligence specs use. The request instant was 2026-10-04T12:00Z.

The SHAs tested were:
- `5513275f`: this branch.
- `5699eb7`: the R4 handoff, run in a detached scratch worktree.
- `266007c`: the H final, run in a detached scratch worktree.

**All three SHAs produce byte-identical results for every field on all 53 questions.** The seam files have no diff between `5513275f`, `5699eb7` and `266007c`. Those files are `contributor-selection.ts`, `ask-specialist-read.coordinator.ts`, `detect-analytical-domains.util.ts`, `ask-router/normalization/*` and the existing ask-intelligence specs. `5513275f` is an ancestor of `5699eb7`, and `5699eb7` is an ancestor of `266007c`.

The new spec `contributor-selection.domain-leak.spec.ts` was run unpatched at all three SHAs. It was green at each one, including the `REPRODUCED today` lock and every `test.failing`. That means **the defect reproduces at 5513275f, 5699eb7 and 266007c**.

Column key for the table:
- **Typed** is the typed geography country.
- **Domains** is `route.envelope.domains.domains`.
- **Legs** is `route.plan.specialistLegs`.
- **SITUATION term hit** is the term from the list that matched.
- **Verdict** says whether the CONFLICT selection is wrong.

| Question | lang | Typed | Domains | Legs | SITUATION term hit | CONFLICT selected (5513275f / 5699eb7 / 266007c) | Verdict |
|---|---|---|---|---|---|---|---|
| What is the travel situation in Kenya? | en | KEN | ∅ | ∅ | situation | CONFLICT/KEN (all 3) | **WRONG** |
| What is the visa situation for travelling to Ukraine? | en | UKR | ∅ | ∅ | situation | CONFLICT/UKR (all 3) | **WRONG** |
| What is the political situation in Poland? | en | POL | political | political:SUPPL | situation | CONFLICT/POL (all 3) | **WRONG** |
| What is the energy situation in Poland? | en | POL | infrastructure | infrastructure:SUPPL | situation | CONFLICT/POL (all 3) | **WRONG** |
| What is the economic situation in Poland and who is the president? | en | POL | economic,political | economic,political:SUPPL | situation | CONFLICT/POL (all 3) | **WRONG** |
| Jaka jest sytuacja w Polsce? | pl | POL | ∅ | ∅ | sytuacja | CONFLICT/POL (all 3) | **WRONG** |
| What is the situation in Poland? | en | POL | ∅ | ∅ | situation | CONFLICT/POL (all 3) | **WRONG** (see §4) |
| What is the weather situation in Kenya? | en | KEN | ∅ | ∅ | situation | CONFLICT/KEN (all 3) | **WRONG** |
| What is the unemployment situation in Kenya? | en | KEN | ∅ | ∅ | situation | CONFLICT/KEN (all 3) | **WRONG** |
| What is the economic crisis in Poland? | en | POL | economic | economic:SUPPL | crisis | CONFLICT/POL (all 3) | **WRONG** |
| What is the crisis in Sudan? | en | SDN | ∅ | ∅ | crisis | CONFLICT/SDN (all 3) | **WRONG** (generic noun) |
| What is the humanitarian situation in Sudan? | en | SDN | social | social:SUPPL | situation | CONFLICT/SDN and HUMANITARIAN (all 3) | **WRONG** (Conflict part) |
| What is the refugee situation in Poland? | en | POL | ∅ | ∅ | situation | CONFLICT/POL and HUMANITARIAN (all 3) | **WRONG** (Conflict part) |
| What is the humanitarian situation in eastern DRC? | en | COD | social | social:SUPPL | situation | CONFLICT/COD and HUMANITARIAN (all 3) | **WRONG** (Conflict part) |
| Jaka jest sytuacja polityczna w Polsce? | pl | POL | political | political:SUPPL | sytuacja | CONFLICT/POL (all 3) | **WRONG** |
| Jaka jest sytuacja gospodarcza w Polsce? | pl | POL | economic | economic:SUPPL | sytuacja | CONFLICT/POL (all 3) | **WRONG** |
| Jaka jest sytuacja energetyczna w Polsce? | pl | POL | infrastructure | infrastructure:SUPPL | sytuacja | CONFLICT/POL (all 3) | **WRONG** |
| Jaka jest sytuacja wizowa dla podróżujących na Ukrainę? | pl | UKR | ∅ | ∅ | sytuacja | CONFLICT/UKR (all 3) | **WRONG** |
| Jaki jest kryzys energetyczny w Polsce? | pl | POL | infrastructure | infrastructure:SUPPL | kryzys | CONFLICT/POL (all 3) | **WRONG** |
| How serious is the situation in eastern DRC? | en | COD | ∅ | ∅ | situation | CONFLICT/COD (all 3) | **WRONG by contract** (see §4) |
| How serious is the situation in DRC? | en | COD | ∅ | ∅ | situation | CONFLICT/COD (all 3) | **WRONG by contract** |
| Jaka jest sytuacja we wschodniej Ukrainie? | pl | UKR | ∅ | ∅ | sytuacja | CONFLICT/UKR (all 3) | **WRONG by contract** |
| What is the security situation in Somalia? | en | SOM | security | security:SUPPL | situation | CONFLICT/SOM (all 3) | correct (facet) |
| What is the security situation in Kenya? | en | KEN | security | security:SUPPL | situation | CONFLICT/KEN (all 3) | correct (facet) |
| Jaka jest sytuacja bezpieczeństwa w Ukrainie? | pl | UKR | security | security:SUPPL | sytuacja | CONFLICT/UKR (all 3) | correct (facet) |
| Jaka jest sytuacja bezpieczeństwa w Kenii? | pl | KEN | security | security:SUPPL | sytuacja | CONFLICT/KEN (all 3) | correct (facet) |
| Jaka jest sytuacja bezpieczeństwa w Somalii? | pl | SOM | security | security:SUPPL | sytuacja | CONFLICT/SOM (all 3) | correct (facet) |
| What is the conflict in Sudan about? | en | SDN | security | security:SUPPL | — | CONFLICT/SDN (all 3) | correct (facet) |
| Jaki jest konflikt na Ukrainie? | pl | UKR | security | security:SUPPL | — | CONFLICT/UKR (all 3) | correct (facet) |
| Is there violence in Haiti? | en | HTI | security | security:SUPPL | violence | CONFLICT/HTI (all 3) | correct (facet) |
| Czy w Haiti jest przemoc? | pl | HTI | security | security:SUPPL | przemoc | CONFLICT/HTI (all 3) | correct (facet) |
| What is the security situation for tourists travelling to Kenya? | en | KEN | security | security:SUPPL | situation | CONFLICT/KEN (all 3) | correct (the reader named security) |
| Any travel advice for Kenya? Is there a threat to visitors? | en | KEN | security | security:SUPPL | — | CONFLICT/KEN (all 3) | correct (the reader named a threat) |
| Is there fighting in eastern DRC? | en | COD | ∅ | ∅ | fighting | CONFLICT/COD (all 3) | correct (armed-conflict term) |
| Are there clashes between armed groups in Sudan? | en | SDN | ∅ | ∅ | clashes, armed groups | CONFLICT/SDN (all 3) | correct (armed-conflict term) |
| Is there an insurgency in Mozambique? | en | MOZ | ∅ | ∅ | insurgency | CONFLICT/MOZ (all 3) | correct (armed-conflict term) |
| Is there unrest in Kenya? | en | KEN | ∅ | ∅ | unrest | CONFLICT/KEN (all 3) | correct (armed-conflict term) |
| Czy na Ukrainie trwają walki? | pl | UKR | ∅ | ∅ | walki | CONFLICT/UKR (all 3) | correct (armed-conflict term) |
| Czy w Kenii są starcia? | pl | KEN | ∅ | ∅ | starcia | CONFLICT/KEN (all 3) | correct (armed-conflict term) |
| What is the inflation situation in Poland? | en | POL | ∅ | ∅ | situation | — (ECONOMY_CPI only) | correct (data-scoped guard) |
| What is the procurement situation in Poland? | en | POL | ∅ | ∅ | situation | — (MARKET_PROCUREMENT only) | correct (data-scoped guard) |
| Tell me about Rwanda / Opowiedz mi o Rwandzie | en/pl | RWA | ∅ | ∅ | — | — (all 3) | correct |
| What is the history and background of DR Congo? | en | COD | ∅ | ∅ | — | — (all 3) | correct |
| Is it safe to travel to Kenya? / weather in Kenya this week / Jaka jest pogoda w Polsce? | en/pl | KEN/POL | ∅ | ∅ | — | — (all 3) | correct |
| How does social security work in Poland? | en | POL | ∅ (knowledge-decoupled) | ∅ | — | — (all 3) | correct |
| Is there fighting in eastern Congo? | en | **—** | ∅ | ∅ | fighting | — (all 3) | out of scope (geography; see §6) |
| Czy w Sudanie trwają walki? / Jaki jest konflikt w Sudanie? / Jaka jest sytuacja humanitarna w Sudanie? | pl | **—** | ∅ / security / social | — | — | — (all 3) | out of scope (PL locative geography; see §6) |
| What is the food insecurity situation in Somalia? | en | SOM | **security** | security:SUPPL | situation | CONFLICT/SOM and HUMANITARIAN (all 3) | out of scope (reading substring defect; see §6) |

## 3. First incorrect transition

The transition chain for each question is:

question → `normalizeTurn` → qualified reading (`readingDomains`) → SemanticTurnIR (`primaryJob`, entities) → `envelope.domains` and the typed geography → `plan.specialistLegs` → `selectContributors` → coordinator `readConflict` → governed prompt.

The intermediate values for the Stage 0 probes at all three SHAs:

| Question | normalized | readingDomains | IR primaryJob / entities | envelope.domains | typed | questionClass | specialistLegs | selectContributors |
|---|---|---|---|---|---|---|---|---|
| travel situation in Kenya | unchanged | [] | CURRENT_REPORTING / COUNTRY:Kenya | [] | KEN | CURRENT_REPORTING | [] | **CONFLICT/security/SUPPLEMENTARY/KEN** |
| visa situation … Ukraine | unchanged | [] | CURRENT_REPORTING / COUNTRY:Ukraine | [] | UKR | CURRENT_REPORTING | [] | **CONFLICT/…/UKR** |
| political situation in Poland | unchanged | [political] | CURRENT_REPORTING / COUNTRY:Poland | [political] | POL | SPECIALIST_DOMAIN | [political:SUPPLEMENTARY] | **CONFLICT/…/POL** |
| energy situation in Poland | unchanged | [infrastructure] | CURRENT_REPORTING / COUNTRY:Poland | [infrastructure] | POL | SPECIALIST_DOMAIN | [infrastructure:SUPPLEMENTARY] | **CONFLICT/…/POL** |
| economic situation in Poland and who is the president | unchanged | [economic, political] | CURRENT_REPORTING / COUNTRY:Poland | [economic, political] | POL | SPECIALIST_DOMAIN | [economic, political: SUPPLEMENTARY] | **CONFLICT/…/POL** |
| Jaka jest sytuacja w Polsce? | unchanged | [] | CURRENT_REPORTING / COUNTRY:Polsce | [] | POL | CURRENT_REPORTING | [] | **CONFLICT/…/POL** |

The first incorrect transition is the step into `selectContributors`, at `contributor-selection.ts:227`:

```ts
(security || (!dataScoped && namesScope(question, CONTRIBUTOR_SCOPE_TERMS.SITUATION)))
```

Every value upstream of that line is correct for these probes:
- Normalization leaves the text unchanged.
- The reading produces the correct domain set, with no `security`.
- SemanticTurnIR produces the correct job and the correct country entity.
- The plan carries **no** security specialist leg.

So the router did not produce a wrong `security` domain. The domain is correct, and the `SITUATION` term net is the first wrong step: `security === false`, yet the bare generic noun matched and CONFLICT was pushed.

The spec pins this. The `upstream is correct` block asserts the typed country, the exact domains and the absence of a security facet for every probe, and those tests pass today.

## 4. Decision: should a bare "situation in X" select Conflict?

**No.** There are four reasons.

1. The contract says a country match plus a generic noun is never sufficient domain relevance. "Situation", "crisis", "sytuacja" and "kryzys" carry no domain. Each is the head noun of travel, visa, political, energy, economic, weather, unemployment and humanitarian questions alike.
2. The binding contract already treats the equivalent question this way. `What is happening in Kenya?` must select **no** contributor (`ask-intelligence.spec.ts` §10/11/12). "What is the situation in Kenya?" is the same question.
3. The router can already express real security intent. The reading's security lexicon (EN `detectRequestedDomains`, PL `PL_DOMAIN_FORMS.security`) produces the `security` domain and a bound security leg for "security", "conflict", "violence", "threat", "bezpieczeństwo", "konflikt", "przemoc", "zagrożenie" and similar words. A question with security intent therefore still reaches Conflict through the facet.
4. Deciding that "the situation in eastern DRC" means armed conflict would need knowledge about the country. That is a phrase-specific or country-specific patch, which is not allowed.

**Consequence to flag for the CTO.** The existing live wording G1, "How serious is the situation in eastern DRC?" (in `ask-intelligence.spec.ts` and `governed-answer.spec.ts`), is itself an instance of the leak. After the fix, G1 as worded selects no Conflict contributor and takes the ordinary reporting path.

The patch updates the affected existing proofs, marked "SUPERSEDED WITH UPDATED PROOF". It keeps their intent (the reader never names the module) with armed-conflict wording:
- "How serious is the fighting in eastern DRC?"
- "What is the humanitarian situation and the fighting in eastern DRC?"

`G.G1` stays as the recorded live question. G1 deterministic eligibility is unchanged (still `false`).

## 5. Regression cases

The cases live in `backend/src/modules/ask-intelligence/contributor-selection.domain-leak.spec.ts`. The suite has 96 tests: 93 pass and 3 are todo.

| Block | Kind | Count | Today | After the fix |
|---|---|---|---|---|
| first incorrect transition: upstream is correct (19 defect probes: country, exact domains, no security facet or leg) | `test` | 19 | pass | pass |
| reproduction lock: `REPRODUCED today … → CONFLICT/<iso3>` | `test` | 19 | pass | **deleted by the patch** |
| negative: 19 defect probes do not select CONFLICT (EN and PL: travel, visa, politics, energy, economy, weather, unemployment, crisis, bare situation, G1 wording) | `test.failing` | 19 | pass (the assertion fails) | **becomes `test`**, pass |
| negative, already correct: weather EN/PL, safe-to-travel, Tell me about Rwanda EN/PL, DR Congo background, population, PM, election, "What is happening in Kenya?" | `test` | 11 | pass | pass |
| data-scoped: inflation situation → ECONOMY_CPI only; procurement situation → MARKET_PROCUREMENT only | `test` | 2 | pass | pass |
| humanitarian (Sudan, refugee Poland, eastern DRC) selects HUMANITARIAN | `test` | 3 | pass | pass |
| humanitarian does not select CONFLICT | `test.failing` | 3 | pass (the assertion fails) | **becomes `test`**, pass |
| positive by security facet: security situation in Somalia/Kenya, conflict in Sudan, violence in Haiti, tourists' security in Kenya, threat to visitors, PL bezpieczeństwa Ukraina/Kenia/Somalia, PL konflikt na Ukrainie, PL przemoc Haiti | `test` | 11 | pass | pass |
| positive by armed-conflict term: fighting in eastern DRC, clashes between armed groups, insurgency, unrest, PL walki, PL starcia | `test` | 6 | pass | pass |
| out-of-scope gaps (§6) | `test.todo` | 3 | todo | todo |

**`test.failing` rule.** When the fix lands, every `test.failing` in this file MUST become `test`, and the reproduction-lock block MUST be removed. The patch does both. If the fix lands without the conversion, the `test.failing` cases go red. That is the intended tripwire.

Positive-control note: the task suggested "Is there fighting in eastern Congo?", but the router types **no country** for it (Congo ambiguity), so CONFLICT is not selected before or after the fix. The spec uses "Is there fighting in eastern DRC?" and records the Congo case as a todo.

## 6. Residual findings outside T3 (each has a different first incorrect transition)

1. **Geography: "Congo".** "Is there fighting in eastern Congo?" yields no `TYPED_GEOGRAPHY`, so no country-scoped contributor can be selected.
2. **Geography: PL locative "Sudanie".** "Czy w Sudanie trwają walki?", "Jaki jest konflikt w Sudanie?" and "Jaka jest sytuacja humanitarna w Sudanie?" yield no typed country. Compare "w Kenii" (KEN) and "na Ukrainie" (UKR), which resolve.
3. **Reading: EN substring domain detection.** `detectRequestedDomains` (`analysis/query/detect-analytical-domains.util.ts`) uses `indexOf` substring matching, so "food **insecurity**" yields the `security` domain and a security leg. The T3 patch keys on that facet, so this question still selects CONFLICT. The first wrong value is in the reading, which belongs to the router and R4, not this seam.
4. **Reading: a multi-domain question loses its geography.** "What is the humanitarian and security situation in eastern DRC?" yields `envelope.domains = []` and no typed country. This was observed while choosing fixture wording and was not investigated further.

## 7. Proposed patch

**File:** `docs/convergence/stage2/T3-contributor-selection.patch`. It is **not applied** in this commit.

It changes four files:

1. **`contributor-selection.ts`** (production):
   - Rename `SITUATION` to `ARMED_CONFLICT` and remove the generic nouns `situation`, `crisis`, `sytuacja`, `sytuacji` and `kryzys`.
   - Keep the armed-conflict domain words that the reading's security lexicon does not yet carry: `fighting`, `clashes`, `violence`, `unrest`, `insurgency`, `rebels`, `armed groups`, `walki`, `przemoc` and `starcia`. These are domain evidence, not generic nouns. PL and EN are symmetric: removing `sytuacja`/`sytuacji`/`kryzys` mirrors removing `situation`/`crisis`.
   - Key `security` on the router facet: `domains.includes('security') || plan.specialistLegs has a 'security' leg`.
   - Update the header comment.

   The new selection condition is:

   ```ts
   const leg = route.plan.specialistLegs.find((l) => l.domain === 'security');
   const security = domains.includes('security') || leg !== undefined;
   if (countryIso3 !== null &&
       (security || (!dataScoped && namesScope(question, CONTRIBUTOR_SCOPE_TERMS.ARMED_CONFLICT)))) {
   ```

   No country-specific or phrase-specific rule is added. Nothing outside `contributor-selection.ts` reads `CONTRIBUTOR_SCOPE_TERMS` (checked by grep across backend, frontend and shared).
2. **`contributor-selection.domain-leak.spec.ts`:** `test.failing.each` becomes `test.each` (2 places), and the reproduction-lock block is removed.
3. **`ask-intelligence.spec.ts`:** the G1-wording Conflict proofs are superseded with armed-conflict wording (4 call sites, plus 2 humanitarian-and-Conflict sites).
4. **`governed-answer.spec.ts`:** the batched-detail proof reads `G1_CONFLICT = 'How serious is the fighting in eastern DRC?'`. `G.G1` is kept.

**Follow-up (not in this patch, owned by R4/router).** Moving the armed-conflict words into the reading's security lexicon (EN `DOMAIN_KEYWORDS.security`, PL `PL_DOMAIN_FORMS.security`) would make Conflict selection purely facet-keyed. The `ARMED_CONFLICT` list could then be deleted. That change alters routing and legs broadly, so it is out of T3 authority.

### Patch verification

Each verification ran in a scratch worktree. All scratch worktrees were discarded afterwards.

| Where | Check | Result |
|---|---|---|
| `5513275f` and the T3 spec (this branch) | `git apply --check` | OK |
| `5699eb7` bare (excluding the new spec) and with the spec | `git apply --check` | OK and OK |
| `266007c` bare (excluding the new spec) and with the spec | `git apply --check` | OK and OK |
| `5513275f` patched | `jest src/modules/ask-intelligence` (3 suites) | **3/3 suites, 139 passed, 3 todo, 0 failed** |
| `5699eb7` patched | `jest src/modules/ask-intelligence` | **3/3 suites, 139 passed, 3 todo, 0 failed** |
| `266007c` patched | `jest src/modules/ask-intelligence` | **3/3 suites, 139 passed, 3 todo, 0 failed** |
| `5513275f` patched | full backend `jest` | failure set identical to the baseline (33 failed, 0 new, 0 fixed); see §9 |

For comparison, unpatched `jest src/modules/ask-intelligence` passes 3/3 suites with 158 passed and 3 todo at each of `5513275f`, `5699eb7` and `266007c`. The difference of 19 is the reproduction-lock block that the patch deletes.

With the patch applied, all 22 converted `test.failing` cases pass as plain `test`s, and all 17 positive controls stay green, including PL parity.

## 8. Integration rule

1. Do not apply the patch while R4 earlier-turn continuity work is in flight on this seam.
2. Once the final R4 SHA exists, reconcile once against that lineage:
   - Run `contributor-selection.domain-leak.spec.ts` **unpatched** on the final R4 SHA.
   - If the `REPRODUCED today` block and the `test.failing` cases are still green, the defect still reproduces. In that case, apply `T3-contributor-selection.patch` (`git apply --check` first). If the seam moved, re-derive the same semantic change: key on the security facet or leg, remove the generic nouns, keep the armed-conflict words, and keep EN/PL parity.
   - If any `test.failing` case now fails (it passes for real), R4 already fixed that case. Convert only those cases, and implement the rest only if they still reproduce.
3. After applying, all `test.failing` cases must be `test`, the lock block must be gone, and the full backend failure set must equal the baseline.
4. The G1 wording consequence (§4) needs explicit CTO acknowledgement in the fix PR.

## 9. Changed-file manifest and test totals

This commit adds no production change. It contains:

- `backend/src/modules/ask-intelligence/contributor-selection.domain-leak.spec.ts` (new spec)
- `docs/convergence/stage2/T3-CONTRIBUTOR-SELECTION-SPEC.md` (this dossier)
- `docs/convergence/stage2/T3-contributor-selection.patch` (proposed patch, not applied)

Test totals:

- **New spec on this branch:** 1 suite, 96 tests (93 passed, 3 todo).
- **ask-intelligence suites on this branch:** 3 suites, 161 tests (158 passed, 3 todo).
- **Full backend on this branch:** the run was `jest --maxWorkers=2`, compared against `stage0/r4-be.json` (the same base, 439 suites, 33 failed tests in 10 suites).
  - Result: 441 suites (12 failed), 11,956 tests (11,470 passed, 33 failed, 450 pending, 3 todo).
  - **The 33 failed tests are exactly the baseline failure set. There are no new failed tests.**
  - The two extra failed suites are not regressions. One is `analysis-config.service.spec.ts`, where a jest worker was SIGKILLed (memory pressure in the container); rerun alone it passes 8/8. The other is a temporary trace harness that was accidentally present during the run and has been deleted (it is not in this commit).
  - Corrected for both, this branch has 440 suites and the baseline failure set plus the new suite, all green.
- **Full backend on 5513275f with the patch applied:** 440 suites (10 failed), 11,945 tests (11,459 passed, 33 failed, 450 pending, 3 todo).
  - **The failure set is identical to the baseline:** 0 new failures and 0 fixed. The 33 baseline failures are in analysis, news, official-data and h-handoff qualification, none in ask-intelligence.
  - The patched total is 11 lower than the branch total because the patch deletes the 19-test reproduction lock and the branch run also counted the 8 tests of the SIGKILLed suite.
