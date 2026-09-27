# Ask Conversational Topic Continuity R1 — Gate D-A trace

Written before any code change. Measured on the untouched Alpha release
`03a5501` through the real `AnalysisService`, with recorded retrieval stubs and
the mock analysis provider (no network, no provider quota).

## The live two-turn conversation, reproduced

| | Turn 1 | Turn 2 |
|---|---|---|
| User text | `Explain the new EU AI regulation in plain English` | `how will this affect GlobalNewsAI in general? Should I be scared?` |
| `priorQuestion` sent by the Ask dock | — | Turn 1 text (user text only; `AskAiDock.tsx`) |
| Normalized query | unchanged | unchanged |
| Subject derivation | `classifyQueryIntent` → `EXPLANATION`, `subject = "EU AI regulation"` (explanation frame + `in plain English` tail + novelty word stripped) | none: no explanation frame, and `deriveGenericNewsQuery` leaves the sentence intact |
| Query sent to retrieval | `EU AI regulation` | `how will this affect GlobalNewsAI in general Should I be scared`, then fallback `will affect GlobalNewsAI general Should I scared` |
| Evidence | EU reporting admitted | 0 articles, `evidenceState = no-relevant-evidence` |
| Provider (OpenAI) calls | 1 | **0** (zero evidence = zero AI call, as governed) |
| What survives the turn | nothing: the service is stateless; the dock keeps display history only | — |

### Why Turn 2 does not resolve

`priorQuestion` is already transported and is used in exactly two places in
`analysis.service.ts`:

1. **Event anchoring (PR #42).** A follow-up is re-routed by the prior question
   only when `isAnaphoricFollowUp(follow-up)` **and**
   `isEventTopic(deriveEventTopic(prior))`. "EU AI regulation" is not an event,
   so R1.1 B3 deliberately leaves the follow-up on its own routing.
2. **Relational follow-up.** An X→Y relation in the prior question plus exactly
   one new country ("What about Rwanda?"). The EU question is not relational.

So the follow-up is routed on its own words. Those words name no subject that
exists in reporting ("GlobalNewsAI", "scared"), the multi-word relevance gate
admits nothing, and the analysis is correctly not attempted. The dock shows
**AI ANALYSIS NOT ATTEMPTED · 0 RETRIEVED REPORTS**.

### The other required shapes, same probe

| Turn 1 → Turn 2 | Turn 2 retrieval today | Result |
|---|---|---|
| Why is inflation high in Poland? → Why does this matter to consumers? | `Why does this matter to consumers` | 0 evidence, 0 calls |
| What are high interest rates doing to the economy? → What about businesses? | `What about businesses` / `businesses` | 0 evidence, 0 calls |
| Explain the sanctions on Russia → How could this affect Poland? | `How could this affect Poland` | 0 evidence, 0 calls |
| (EU AI regulation) → What about inflation in Poland? | `What about inflation in Poland` | fresh question, correct |
| PL: Wyjaśnij nowe unijne przepisy o sztucznej inteligencji → Jak to wpłynie na GlobalNewsAI? | `Jak to wpłynie na GlobalNewsAI` | 0 evidence, 0 calls |

Out of D's scope, recorded for honesty: "What are high interest rates doing to
the economy?" already fails on **Turn 1**. No subject frame matches, so the
whole sentence becomes the provider phrase. That is a Turn-1 recall gap, not a
continuity defect.

## Is the existing `priorQuestion` transport enough?

For one follow-up, yes. It carries only the user's previous words
(`@MaxLength(1000)`, documented as "no AI answer, evidence identity, source list
or retrieval output"), and the subject is derivable from those words
server-side by the existing, deterministic authorities (`classifyQueryIntent`,
`deriveGenericNewsQuery`, country routing).

For a chain (Turn 3 "What about businesses?" after an anaphoric Turn 2), the
immediately preceding question no longer names the subject. No new structured
field is needed. The dock sends, as `priorQuestion`, the user question that
**established** the subject it is continuing. That is still user text and still
one question. Routing re-derives the subject from it exactly as it did the
first time.

## Architecture decision

- **Conversation Subject Anchor, separate from EventAnchor.** Event anchoring is
  evaluated first and is unchanged. The subject path is considered only when the
  event path did not fire and the prior question is not an event.
- **Subject state is derived only from the prior user question.** Routing
  re-runs on the prior user question, the same substitution PR #42 makes for
  events, so no new derivation logic, AI classifier or memory is introduced. The
  model still receives the reader's actual follow-up. Prior AI prose, claims,
  sources and conclusions are never transported.
- **Which follow-ups inherit.** Only a bounded follow-up that refers back with an
  anaphor ("this", "it", "to", "tego"…) or is an audience ellipsis ("What about
  businesses?", "A co z firmami?") and names no event or explanation subject of
  its own. "What about inflation in Poland?" has neither, so it stays a fresh
  question: current user text outranks the inherited subject.
- **Product-specific applicability.** There is no governed product-fact evidence
  channel in the analysis architecture (nothing supplies facts about GlobalNewsAI
  itself). When the follow-up asks about GlobalNewsAI, the backend states that
  exact applicability is not established, and the prompt forbids inventing
  product characteristics while allowing the model to name which requirements
  would be relevant to verify.

## Legal / policy source-authority inspection

`shared/src/source-provenance.ts` defines `EvidenceRole`
(`REPORTING` / `PRIMARY_RECORD` / `REFERENCE_DATA` / `CONTEXT`) and
`shared/src/source-type.ts` a source-type vocabulary. Neither is read by Ask
retrieval or ranking. The Ask evidence pool comes from news providers (GNews,
GDELT DOC, curated RSS), all `REPORTING`. No official-journal or regulator source
is retrievable for a law question today. So no small safe reuse exists: preferring
primary legal sources for policy explanations needs a separate retrieval-authority
lane (an official-source provider plus role-aware ranking). It is not part of D.

## D.1 — follow-up retrieval intent composition

Retrieval meaning = **inherited subject + current-turn evidence-bearing focus**,
never the prior question alone.

- **Focus.** The follow-up's own words, minus anaphors, question/function words
  (the existing `FALLBACK_STOPWORDS` plus a closed EN/PL conversational list),
  framing ("in general", "should I be scared"), the product's own name, and
  words the inherited subject already carries. What remains are targets and
  aspects: `consumers`, `businesses`, `Poland`, `enforcement`, `timing`.
- **Where it acts.** The inherited subject still decides what is fetched, so
  every relevance gate and provider query is unchanged. The focus decides which
  of that evidence reaches the model first, ahead of the 8-report cap (from a
  pool of 20). It is stated on the answer as `retrievalMeaning`, and is also
  passed to the model.
- **Why not append it to the provider phrase.** The generic relevance gate
  compares against the phrase it was sent. "sanctions on Russia Poland" would
  then be required verbatim and admit almost nothing, which is blind
  concatenation.
- **Honesty.** When no retrieved report addresses the focus, the answer carries
  `FOCUS_NOT_IN_EVIDENCE` and the model is told not to present an effect on the
  focus as established.
- **Aspect ellipses.** "What about enforcement and timing?" continues the
  subject. The closed ellipsis list now covers aspects as well as audiences.
  "What about inflation in Poland?" is still a new subject.

| Follow-up | Retrieval meaning |
|---|---|
| EU AI regulation → "how will this affect GlobalNewsAI…? Should I be scared?" | `EU AI regulation` (+ product-applicability disclosure) |
| Why is inflation high in Poland? → "Why does this matter to consumers?" | `inflation high Poland consumers impact` |
| High interest rates…economy? → "What about businesses?" | `high interest rates doing economy businesses` |
| Explain the sanctions on Russia → "How could this affect Poland?" | `sanctions on Russia Poland impact` |

## Known R1 limitation — FOLLOW-UP FOCUS-AWARE ACQUISITION — FUTURE RETRIEVAL IMPROVEMENT

The current-turn focus prioritises evidence inside the corpus retrieved for the
inherited subject. It does not broaden provider acquisition: no additional or
focus-specific provider query is issued. When the subject corpus contains
nothing about the focus, the answer carries `FOCUS_NOT_IN_EVIDENCE` and says so
honestly. Acquiring focus-specific evidence (for example, a bounded second query
gated on subject + focus) is a future retrieval-authority change, deliberately
not made in the R1 convergence.
