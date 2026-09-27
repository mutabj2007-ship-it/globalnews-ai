# Retrieval Source Authority Audit R1

| | |
|---|---|
| Base | `release/alpha-m08-integrated-r1` @ `30fd93637094041e9b046df7c6f68e7648c6e354` (unchanged at audit start) |
| Branch | `claude/retrieval-source-authority-audit-r1` |
| Scope | Phase 1: audit only. **No production code changed.** |
| Evidence | `backend/src/modules/analysis/source-authority/source-authority-audit.spec.ts` (29 deterministic tests, offline, no AI call) |

## Summary

GlobalNewsAI has **no authority signal anywhere on the path from provider to prompt**. The
vocabulary exists (`SourceType`, `OfficialSourceClass`, `EvidenceRole`, `NewsArticle.sourceAuthorityClass`,
`NewsArticle.evidencePrecision`, source packs with `CENTRAL_BANK` / `OFFICIAL_STATISTICS` /
`PARLIAMENT_GOVERNMENT` roles), but nothing on the news path writes it and nothing on the analysis
path reads it. So which evidence the model sees is decided by four authority-blind mechanisms, in
this order:

1. a **lexical relevance gate** that admits records whose headline uses the reader's words;
2. **recency order**;
3. **keep-first duplicate collapse** (after recency order, that means keep the latest copy);
4. **position caps** (`limit` = 20 in `NewsService.search`, `maxArticles` = 8 in `AnalysisService`).

The EU AI regulation case reproduces offline exactly. Given the Council's adoption notice, the
Official Journal text, the Commission's entry-into-force notice, an opinion piece and an aggregator
explainer, "Explain the new EU AI regulation" sends the model **the aggregator explainer first, then
the opinion piece, then the Official Journal text last**. The Council and Commission records are
retrieved and then refused by the gate (§3 of the spec).

The mechanism is general, not EU-specific. The same shape is measured for the ECB, a parliamentary
bill, a national statistical release and the Fed. The IPCC class is a counter-example at the gate
and is recorded as such.

---

## 1. Current retrieval architecture

One transport serves every Ask and Search surface.

```
Ask dock / /ask / Home Ask / /search Run
      └─ frontend/src/lib/api/analysisApi.ts  analyzeNews()  → POST /analysis/news
            └─ AnalysisController → AnalysisService.analyzeNews()
                  ├─ route selection (query-intent.util.ts classifyQueryIntent + service logic):
                  │     selection | story anchor | source-attributed | declared region |
                  │     per-side comparison | country feed | relational | generic
                  ├─ retrieval
                  │     generic / relational / anchored / source-attributed:
                  │         NewsService.search(q, SEARCH_POOL_SIZE=20, {type:'generic'|…})
                  │     country:  CountryNewsService.getCountryNews → NewsService.search(countryName, ≥20, none)
                  │     retained: ArticlePersistenceService.findRecent (publishedAt desc)
                  ├─ post-retrieval ordering: anchor prepend → event-linked first → topic focus
                  ├─ clusterDuplicateArticles(articles).slice(0, maxArticles=8)   ← analysis.service.ts:2619
                  └─ AnalysisProvider.analyzeNews({articles, …})  (one model call)
```

**Inside `NewsService.search`** (`backend/src/modules/news/news.service.ts`):

1. `callAllProviders` (l.1568–1635). The primary tier (`gnews`) is called first. The fallback tier
   (`gdelt-doc`, `rss-feeds`) is called **only if the primaries returned zero raw articles**
   (l.1600), or through the post-relevance rescue when zero survive the gate (l.844–876).
2. `buildResponse` (l.1950–2058) runs these steps in order:
   - per-provider `collapseDuplicateStories`;
   - exact-id merge;
   - `collapseCrossProviderDuplicates` (only when 2+ providers responded);
   - **sort by `publishedAt` desc** (l.2036–2040);
   - **`slice(0, limit)`** (l.2042).
3. `applyRelevanceMode` → `scoreGenericRelevance` (l.784–787). This is a pass/fail gate that is
   **applied after the cap** and does no ranking.

**Inside `CountryNewsService.getCountryNews`**
(`backend/src/modules/news/country/country-news.service.ts`), the steps after
`NewsService.search` are:

- scored by `scoreCountryRelevance` (threshold 35);
- sorted by city match, then score, then recency (l.269–285);
- `deduplicateArticles` (keep-first);
- national-development items reordered first;
- `slice(resolvedLimit)`.

This is the only branch where a score, rather than recency or array position, shapes order.

**Ask and Search** use the same endpoint, the same service and the same ranking. The frontend
does not re-sort evidence on either side: Ask shows the first 4 plus cited sources, and Search
shows all, both in backend order. Ask can differ only through its inputs (`priorQuestion`,
`storyContext`). Spec §7 pins that a non-referential Ask follow-up gets byte-identical evidence
order to the bare Search question. `ask-v2` is disabled (404 unless `ASK_V2_ENABLED=true`) and has
no retrieval of its own.

**Official and primary material that is not on this path at all:**

- `official-sources/official-source-registry.ts` has 2 entries (`eurostat`, `rw-nisr`), both disabled.
- `official-data/*` covers NISR CPI and Eurostat snapshots.
- `global-reach/source-pack.registry.ts` has 290 entries across the EU27, East Africa and Middle
  East packs, all `DISABLED`.
- None of these is imported by `news/` or `analysis/`. They serve the economy, security and
  politics lanes and admin coverage accounting.

---

## 2. Exact defect paths

Each is pinned by a named test that passes **because** the defect exists.

### D1 — The gate refuses the institution's own record and admits its echoes

`backend/src/modules/news/relevance/generic-relevance.util.ts:572` `scoreGenericRelevance` (applied
at `news.service.ts:784`).

- **What the rule requires.** A multi-word query is admitted only on the whole phrase, or on
  governed term-parity where every load-bearing term is in the title (or in one summary sentence
  anchored by the headline).
- **Institutions title their own acts institutionally.** Examples: "Monetary policy decisions",
  "Flash estimate of consumer price index…", "Artificial Intelligence Act: Council gives final
  green light…". They do not name themselves in their own headline ("EU", "ECB").
- **Commentary and aggregators write headlines in the reader's words.** So for the same act the
  secondary record is admitted and the primary record is refused, **before any ordering exists
  that could prefer it**.
- **Measured** (spec §2): the primary record is refused and the secondary record admitted for
  EU AI regulation (Council; Commission), the ECB rate decision, bill status, the Polish CPI
  release and the Fed decision.
- **Scope.** The rule is lexical, not anti-official. An institutional record whose headline
  happens to carry the reader's words is admitted (the Official Journal title, the Eurostat
  flash; see the INVARIANT test).
- **IPCC counter-example.** For "IPCC report", the IPCC names itself in its summary, so the
  Synthesis Report passes.

**D1b — question-form queries admit nothing at all.** Question-form input is passed through as
the search phrase: "Did the ECB raise interest rates", "What did the IPCC report say", "What
does the EU AI Act require". Here neither the primary nor the secondary record is admitted, and
the request ends with zero evidence and no model call. This is not an authority inversion, but
it is the same gate. Question-form institutional-fact questions get no evidence of any kind.

### D2 — Admitted evidence is ordered by recency only

`news.service.ts:2036–2040`, carried unchanged through `AnalysisService` to `analysis.service.ts:2619`.

Primary records typically **precede** the commentary about them, so recency puts them last. In
the EU case the model receives the aggregator explainer first and the Official Journal text last
(spec §3). Prompt order matters: `evidenceId` S1…Sn is assigned by position, and later items are
the first truncated or de-emphasised.

### D3 — Duplicate collapse keeps the weaker copy

`backend/src/modules/analysis/duplicates/cluster-articles.util.ts:112–130`: the first member seen
becomes the representative, and the code comment relies on the upstream order.

Combined with D2, a republication filed hours after the original is first, so **the aggregator's
copy survives and the institution's copy is removed before analysis**. Measured with a Eurostat
release and a branded aggregator copy three hours later: the model receives only the aggregator's
copy (spec §4).

The same keep-first rule applies in `news/country/deduplicate-articles.util.ts` (region and side
merges). Across providers, `news/cross-provider-dedup.util.ts:52` picks the winner by
`sourcesCount`, which every real provider hard-codes to `1` (gnews l.664, gdelt-doc l.867,
rss-feed l.385), so the winner is decided by **provider registration order** (D7).

### D4 — Caps drop stronger evidence by position

- **Analysis cap.** `clusterDuplicateArticles(articles).slice(0, 8)` (`analysis.service.ts:2619`).
  Eight newer independent pieces push the primary release out entirely (spec §5). The same holds
  for per-side and region paths, where concatenation order means later sides can be cut to zero.
- **News cap before gate.** `buildResponse` slices to `limit` by recency (`news.service.ts:2042`)
  **before** `applyRelevanceMode` (l.784). An older relevant primary record behind 20 newer
  off-topic items is never scored (spec §5).

### D5 — Authority metadata is lost at the provider boundary, and the prompt has no slot for it

- **The RSS provider drops it.** `rss-feed.provider.ts:372–395` builds each `NewsArticle` from a
  `FeedSourceEntry` that **has** `sourceType: 'OFFICIAL_SOURCE'` (`feed:cbk-ke`, `feed:gus-pl`),
  but copies neither `sourceType` nor an authority class onto the article.
  `NewsArticle.sourceAuthorityClass` and `evidencePrecision` (`shared/src/news.ts:257, 265`) are
  never written on the news path. The only writers set them to `undefined`
  (`signals/providers/gdelt.provider.ts:455`, `event-registry.provider.ts:436`).
- **Persistence can't hold it.** The Prisma `Article` model has no column for it.
- **The prompt can't carry it.** `normalizeArticlesForPrompt`
  (`analysis/prompt/build-analysis-prompt.util.ts:107`) emits exactly `evidenceId`, `title`,
  `summary`, `sourceName`, `publishedAt` and `publishedAtBasis`. An Official Journal record and an
  opinion piece are structurally indistinguishable to the model (spec §3, D5).
- **The corroboration class is never used.** `feed-corroboration.ts` (`OFFICIAL_PUBLIC` /
  `LOCAL_JOURNALISM`) has zero non-spec consumers.

### D6 — No route recognises an institutional-fact question

`QueryIntent` (`analysis/query/query-intent.util.ts:52–68`) has 8 intents, none of them for "what
did institution X adopt, publish, announce, vote, measure, schedule or enact". All six classes land
on `CURRENT_EVENT`, `EXPLANATION` or `GEOGRAPHIC_REGIONAL` (spec §1). The source-attributed frame
(`derive-source-attributed-query.util.ts`) is the only publisher-aware route. It needs "What does
**X report/say/state/publish** about Y", it resolves only against the 6-entry feed registry, and it
never reads `sourceType`.

### D7 — Provider tier and registration order decide authority by accident

- **Official feeds sit in the fallback tier** (`news.module.ts:127–129`, off by default). They are
  consulted only when the primary tier returns zero raw articles (`news.service.ts:1600`), so a
  single relevant commentary piece from GNews means Statistics Poland is never asked (spec §6).
- **Ties go to registration order.** When both fallbacks carry the same release, GDELT's copy wins
  on registration order, and the official feed record is deleted before attribution runs (spec §6;
  also pinned by the existing `news.service.source-constraint-dedup.spec.ts`).

### Checked and not defective

| Checked | Finding |
|---|---|
| Ask vs Search ranking | Identical ranking; spec §7 INVARIANT. |
| Frontend re-ordering | None. |
| Primary retrieved but removed by an explicit authority filter | No such filter exists. Primary records are lost only through D1, D3 and D4, never by an explicit authority rule. |
| Suppression of disagreement | None today. The opinion piece reaches the model alongside the Official Journal text (spec §3 INVARIANT), and any correction must keep that. |

---

## 3. Source-authority metadata currently available

| Where | What | Reaches retrieval? |
|---|---|---|
| `shared/src/source-type.ts` | `SourceType` = `NEWS_PROVIDER` \| `OFFICIAL_SOURCE` \| `PUBLIC_DATA`; `SourceCorroborationClass` = `LOCAL_JOURNALISM` \| `OFFICIAL_PUBLIC` | No |
| `shared/src/officialSources.ts` | `OfficialSourceClass`: `OFFICIAL_ELECTION_AUTHORITY`, `OFFICIAL_STATISTICS`, `CENTRAL_BANK`, `GOVERNMENT`, `COURT`, `INTERNATIONAL_ORGANIZATION`, `NEWS_AGENCY`, `NEWS_PUBLISHER`, `RESEARCH`, `OTHER` | No |
| `shared/src/source-provenance.ts` | `EvidenceRole` = `REPORTING` \| `PRIMARY_RECORD` \| `REFERENCE_DATA` \| `CONTEXT`; `SourceProvenance` | Other lanes only |
| `shared/src/news.ts` `NewsArticle` | `sourceId`, `sourceName`, `providerId`, `publishedAtBasis` (`publisher`/`observed`), and the declared-but-never-written `sourceAuthorityClass?`, `evidencePrecision?` | Identity only |
| `news/providers/feed-source-registry.ts` | 6 curated feeds with `sourceType` and `canonicalHost` (2 `OFFICIAL_SOURCE`); all `enabled:false` | Identity only (`requested-source.util.ts`) |
| `news/providers/feed-corroboration.ts` | per-feed `OFFICIAL_PUBLIC` / `LOCAL_JOURNALISM` | No consumer |
| `official-sources/official-source-registry.ts` | 2 entries with `authorityClass`, `baseUrl` | No |
| `global-reach` source packs | 290 entries with `sourceClass: SourceType`, `canonicalHost`, `basis` (the raw packs also carry `role`: `CENTRAL_BANK`, `OFFICIAL_STATISTICS`, `PARLIAMENT_GOVERNMENT`, `PUBLIC_NEWS`, `DOMESTIC_PUBLISHER`, and `sourceKind`: `NEWS_AGENCY`, `STATISTICS_OFFICE`, …) | No; the canonical form drops `role`/`sourceKind` |
| `shared/src/politics` | `POLITICAL_SOURCE_CLASSES` incl. `PARLIAMENTARY_RECORD`, `OFFICIAL_LEGAL_RECORD`, `JOURNALISM`, `INDEPENDENT_ANALYSIS`, and `syndicationOriginRef` | Politics lane only |
| `news/identity/publisher-identity.util.ts` | registrable domain, publisher-name normalisation | Diversity counting only |

## 4. Source-authority metadata missing

1. **A record-level role on `NewsArticle`, populated.** The slots exist (`sourceAuthorityClass`,
   `evidencePrecision`) but no writer does. GNews and GDELT supply only a free-text source name or
   domain, so a role can only come from joining the article's **registrable domain** against a
   curated registry.
2. **One joinable host registry.** Official hosts are spread over four uncoordinated places (feed
   registry, official-source registry, three source packs, the politics lane). There is no single
   `registrableDomain → {institution, OfficialSourceClass}` lookup the news path can consult.
   Coverage is thin even when joined: there are no entries today for EU institutions
   (`europa.eu`, `consilium`, `eur-lex`), the ECB, the Fed, national parliaments or the IPCC,
   except where a source pack lists a national central bank or statistics office.
3. **Distinctions with no representation at all:**
   - wire vs general news vs specialist publication (only `NEWS_AGENCY` / `NEWS_PUBLISHER`
     exist, and only in the unused registry);
   - first-party corporate;
   - commentary/opinion (there is no detector anywhere);
   - aggregator/republication (the only signals are GDELT's `publishedAtBasis: 'observed'` and
     the documented, unused `NEWS_PROVIDER` doc comment).
4. **Syndication origin.** `SourceDiversity` states it cannot prove wire-copy origin. The
   politics-lane `syndicationOriginRef` has no producer on the news path.
5. **Query-side claim kind.** Nothing distinguishes a question about an institution's own act
   from a question about interpretation, impact or reaction.
6. **Persistence.** `Article` has no role column, so retained evidence would lose any role
   assigned at ingest.

## 5. Examples from deterministic tests

All from `source-authority-audit.spec.ts`: offline, stub providers, a recording mock model.

| # | Query | Retrieved by provider | Sent to model (order) | Lost |
|---|---|---|---|---|
| 1 | Explain the new EU AI regulation | Council adoption, Official Journal, Commission entry-into-force, opinion, aggregator | aggregator → opinion → Official Journal | Council, Commission (gate) |
| 2 | ECB interest rate decision | ECB "Monetary policy decisions", markets reaction | markets reaction | ECB release (gate) |
| 2b | Did the ECB raise interest rates? | same | nothing; **0 model calls** | both (gate, question form) |
| 3 | Online Safety Bill status *(gate unit)* | Royal Assent record, campaign reporting | campaign reporting admitted | Royal Assent record |
| 4 | Polish inflation figures *(gate unit)* | Statistics Poland flash CPI, newsroom | newsroom admitted | flash CPI |
| 5 | Fed cuts rates *(gate unit)* | FOMC statement, newsroom | newsroom admitted | FOMC statement |
| 6 | IPCC report *(gate unit)* | Synthesis Report, reaction | **both admitted** (counter-example) | none at the gate |
| 7 | euro area inflation | Eurostat flash + branded aggregator copy (+3h) | aggregator copy | Eurostat (D3) |
| 8 | euro area inflation | Eurostat flash + 8 newer independent pieces | 8 independent pieces | Eurostat (D4 cap) |
| 9 | euro area inflation, `NewsService.search(…, 20)` | Eurostat flash + 20 newer off-topic | 20 off-topic items (then gated away) | Eurostat (D4 cap before gate) |
| 10 | Polish inflation figures, `NewsService.search` | GNews newsroom (primary); Statistics Poland (fallback) | newsroom | Statistics Poland never asked (D7) |
| 11 | Polish inflation figures, primaries empty | GDELT copy + Statistics Poland feed | GDELT copy | feed record (D7 registration order) |

Fixture texts are written for the audit and use the real headline conventions of each institution.
They are not live captures, so the suite needs no provider.

## 6. Proposed authority / ranking model

The principle is that **authority is a role relative to the question, not a trust score.** No
numeric trust, no "official = true", nothing suppressed.

**(a) Record role — derived only from curated identity, never from free text.**

- **Structure.** `SourceRole` has an `institutional` branch carrying the existing
  `OfficialSourceClass`, plus `WIRE`, `SPECIALIST`, `GENERAL_NEWS`, `COMMENTARY`, `AGGREGATOR`,
  and `UNKNOWN` as the default. It is written into the existing
  `NewsArticle.sourceAuthorityClass` / `evidencePrecision` (`primary` for institutional
  first-party records, `aggregated` for known aggregators), so no new shared contract is needed
  for the first step.
- **Source of truth.** One read-only lookup `registrableDomain → {institutionId, class}`, built
  offline from the registries that already exist (feed registry, official-source registry,
  source-pack canonical hosts, plus a reviewed seed for supranational bodies: EU institutions,
  ECB, Fed, IPCC, UN agencies). It fails closed: unknown means `UNKNOWN`, and a role is never
  inferred from `sourceName`.
- **Commentary.** Flagged only from explicit structural markers (a `/opinion/`-style path, a
  leading "Opinion:" / "Analysis:" / "Comment:" label). **It is labelled, never dropped.**

**(b) Query claim kind — deterministic, no AI.** A closed lexicon classifies the question:

- `INSTITUTIONAL_ACT`: a named institution (via the existing `organization-alias-resolver`, e.g.
  ECB ↔ European Central Bank ↔ Governing Council) plus an act verb (adopted, published,
  announced, voted, measured, scheduled, enacted, decided, status of);
- `INTERPRETATION_OR_REACTION`: impact, criticism, reaction, why, should, will it;
- `NEUTRAL`: everything else.

Only `INSTITUTIONAL_ACT` changes anything below.

**(c) Admission, for `INSTITUTIONAL_ACT` only.** Add a bounded second admission path to the gate:
a record whose host belongs to **the named institution** is admitted when it shares at least one
subject term with the question. This covers the "institutions don't name themselves" gap (D1).
It can only add records, never remove them, which is the same contract as the existing
term-parity path.

**(d) Selection, for `INSTITUTIONAL_ACT` only.**

- **Reserve slots.** A bounded reservation of at most 2 of the 8 `maxArticles` slots for the
  newest first-party records of the named institution, when present.
- **Diversity floor.** The remaining slots keep today's order, with a floor of at least 3
  non-institutional records whenever that many were admitted, so independent reporting and
  disagreement always reach the model. This is the same reservation pattern M63 already uses
  for supplemental domains (`analysis.service.ts:1674–1718`).
- **Other questions.** For `INTERPRETATION_OR_REACTION` and `NEUTRAL`, nothing changes.

**(e) Duplicate representative (all questions).** Within a cluster, choose the representative in
this order:

1. a curated first-party record;
2. `publishedAtBasis: 'publisher'` over `'observed'`;
3. the earliest `publishedAt`;
4. then the current order.

Cluster membership is unchanged, so diversity counts are unaffected. The cross-provider winner
gets the same rule ahead of registration order.

**(f) Prompt.**

- **Label each item.** Add a role label per evidence item (e.g. `[role: primary — European
  Central Bank]`, `[role: commentary]`).
- **Add one instruction.** A primary record establishes what the institution itself did or
  published, not whether it is correct. Interpretation, impact and criticism must be drawn from
  independent reporting and attributed. Primary records never count as independent
  corroboration, which matches the existing `SourceCorroborationClass` rule.

**(g) Not proposed.** Blocking or down-weighting any outlet; a numeric trust score; any AI call;
any change for questions that are not institutional-fact questions.

## 7. Risks

| Risk | Mitigation |
|---|---|
| **Official ≠ true.** Governments and institutions misstate their own acts or frame them favourably. | The role describes *who is speaking*, not truth. The prompt rule says so explicitly. The diversity floor guarantees independent reporting reaches the model on every institutional question. |
| **Suppressing disagreement.** Reserved slots could crowd out critics. | Reservation is capped at 2 of 8, with a floor of at least 3 independent records. An INVARIANT test already pins that the opinion piece survives beside the Official Journal text. |
| **Mislabelling.** A domain look-alike, a subdomain carve-out (cf. NISR's `socioeconomic.` subdomain), or a press office republishing third-party material. | Registrable-domain join against a curated list only; fail closed to `UNKNOWN`; the same host-sanity rule the RSS provider already uses (`canonicalHost`). |
| **Geographic or political bias** from the seed list (e.g. EU-heavy, government-heavy). | The seed must be built from the existing global packs (EU27, East Africa, Middle East) plus supranational bodies. Registry coverage should be reported per region in admin, as global-reach already does. |
| **Behaviour change for ordinary questions.** | Everything except (e) is gated on `INSTITUTIONAL_ACT`. (e) changes only which copy represents a cluster, never the cluster count. Each lane must run a full-suite baseline comparison. |
| **Cost and quota.** | (a)–(f) add no provider or AI calls. Promoting official feeds from the fallback tier (D7) *would* add provider calls and is left as a separate CTO decision (see §8). |
| **Cache.** | The role is derived from the record, and the claim kind from the normalised query already in the cache key, so no cache-key change is needed. |
| **Question-form gap (D1b)** is outside authority. | It is tracked separately; fixing D1 does not fix it. |

## 8. Implementation recommendation

**No production change in this round.** Each candidate fix either depends on authority metadata
that does not exist yet (D1, D3, D5, D6) or changes the evidence set for every question (D4 news
cap, D3's representative rule, D7 tiering). Those are exactly the conditions under which the
contract says to stop at a proposal.

The one change that looked narrow, preferring the earliest publisher-dated copy as the cluster
representative, is still product-wide (it changes which source is shown for every clustered story
in every answer). Its correctness also depends on timestamps that aggregators sometimes back-date.
It belongs in a lane with its own baseline.

Recommended order:

1. **L1 — Authority metadata (prerequisite; no behaviour change).**
   - Build the curated `registrableDomain → institution/class` lookup from the existing
     registries.
   - Populate `NewsArticle.sourceAuthorityClass` / `evidencePrecision` in the providers and
     the RSS mapping.
   - Add a persistence column.
   - No ranking change. Verified by asserting that roles are set and evidence order is
     byte-identical.
2. **L2 — Representative and cross-provider winner rule (D3, D7 tie).** Rule (e). Invert spec
   §4 and the §6 tie test.
3. **L3 — Claim kind + institutional admission path + bounded reservation (D1, D2, D6).** Rules
   (b)–(d). Invert spec §2/§3/§5 (analysis cap) for `INSTITUTIONAL_ACT` queries, and keep every
   INVARIANT test.
4. **L4 — Prompt role labels and instruction (D5).** Rule (f), with the validation-layer checks
   the prompt already relies on.
5. **L5 — News cap before gate (D4).** Gate before slice (or over-fetch then gate). This is
   authority-neutral but changes generic evidence broadly, so it needs its own full baseline.
6. **CTO decision, not a lane yet — official feeds as a parallel supplement (D7 tier).** Ask
   curated official feeds alongside the primary tier for `INSTITUTIONAL_ACT` questions only. It
   adds at most one provider call per explicit Send and none from UI interaction, but it is a
   quota change and needs explicit approval.
7. **Separately — question-form retrieval (D1b).** A query-derivation fix that is independent of
   authority.

## 9. Files that would need modification

| Lane | Files |
|---|---|
| **L1 metadata** | `shared/src/news.ts` (doc only, fields exist); new `backend/src/modules/news/identity/source-authority.registry.ts` (built from `news/providers/feed-source-registry.ts`, `official-sources/official-source-registry.ts`, `global-reach/data/*-canonical-packs.json`); `news/providers/gnews.provider.ts`, `news/providers/gdelt-doc.provider.ts`, `news/providers/rss-feed.provider.ts` (stamp role); `news/persistence/article-persistence.service.ts` + `backend/prisma/schema.prisma` + migration (persist role); `news/identity/publisher-identity.util.ts` (reuse `resolveRegistrableDomain`) |
| **L2 dedup** | `analysis/duplicates/cluster-articles.util.ts` (`computeClusters` representative); `news/cross-provider-dedup.util.ts` (`compareCrossProviderPreference`); `news/country/deduplicate-articles.util.ts` |
| **L3 claim kind / admission / selection** | `analysis/query/query-intent.util.ts` (or a sibling `claim-kind.util.ts`); `news/analysis/organization-alias-resolver.util.ts` (institution aliases); `news/relevance/generic-relevance.util.ts` (bounded institutional admission); `news/news.service.ts` (`RelevanceMode` carries the institution); `analysis/service/analysis.service.ts` (reservation beside the M63 block, before l.2619) |
| **L4 prompt** | `analysis/prompt/build-analysis-prompt.util.ts` (`normalizeArticlesForPrompt`, `buildAnalysisUserPrompt` l.569, system instruction); `analysis/validation/*` if the schema echoes roles |
| **L5 cap order** | `news/news.service.ts` (`buildResponse` l.2036–2042 vs `applyRelevanceMode` l.784) |
| **Tier decision** | `news/news.module.ts` (l.127–129), `news/news.service.ts` `callAllProviders` (l.1600) |
| **Tests** | invert the named DEFECT tests in `analysis/source-authority/source-authority-audit.spec.ts` lane by lane; keep all INVARIANT tests |

## 10. One lane or several?

**Several, sequenced.**

- **L1 must land first and alone.** It is the only way to make the other lanes provider-neutral.
  It is behaviour-neutral, so it can be proven byte-identical against the base.
- **L2 and L4** each touch a single, well-bounded site and can run in parallel after L1.
- **L3** is the substantive ranking change and carries the product-semantics risk. It should be
  one lane with its own CTO review.
- **L5 and the tier decision** are authority-neutral changes to the retrieval economy. They should
  not be bundled with authority work, so that a regression in either is attributable.

A single combined lane would make it impossible to tell whether a change in any answer came from
metadata, dedup, admission, selection, prompt or cap order.
