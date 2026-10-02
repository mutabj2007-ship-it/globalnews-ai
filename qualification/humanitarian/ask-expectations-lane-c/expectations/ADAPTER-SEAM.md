# BINDING LANE C'S EXPECTATIONS TO THE CANONICAL ADAPTER

Lane C's corpus is **regression material for your adapter**. It does not define canonical Ask
semantics, and nothing here should be copied into the canonical module.

`src/` in this package is a **reference oracle**: the smallest adapter that satisfies the
expectations, used to prove the runner and the mutation campaign actually bite. **It is not a
candidate implementation.** If it disagrees with the canonical leak-safe adapter, the canonical
adapter is right and the disagreement is a finding to report back, not a patch to apply.

## Run it

```sh
node expectations/run-against-adapter.mjs ./path/to/your-binding.mjs
```

Proven first against the reference oracle, so a failure is about your adapter, not the runner:

```sh
tsc -p tsconfig.json
node expectations/run-against-adapter.mjs ./expectations/binding.reference.mjs   # 18/18
```

## The binding module

Two required exports, three optional. `expectations/binding.reference.mjs` is a working copy.

```js
export function makeStore(fixtureName) { /* → a store handle */ }
export function read(store, request)   { /* → the shape below */ }
```

`fixtureName` is one of four store conditions the expectations exercise. Bind each to whatever
produces that condition in your harness:

| fixture | condition |
|---|---|
| `UNBOUND_NO_GOVERNED_BINDING` | **no governed retained store.** This is the state today |
| `GOVERNED_WITH_SDN_ROWS` | governed and bound, holding retained SDN rows |
| `GOVERNED_EMPTY_FOR_GEOGRAPHY` | governed and bound, holding nothing for the asked country |
| `GOVERNED_READ_FAILING` | governed and bound, the read cannot be served this time |

`read()` returns, with extra fields ignored:

```js
{
  availability: 'AVAILABLE' | 'NOT_BUILT' | 'NOT_CONNECTED'
              | 'NO_DATA_FOR_GEOGRAPHY' | 'TIER_RESTRICTED' | 'TEMPORARILY_UNAVAILABLE',
  assessment:   'CURRENT_PROVIDER_OBSERVATION' | 'RETAINED_REPORTING'
              | 'NOT_ASSESSED' | 'SOURCE_UNAVAILABLE',
  claims:       [...],          // or claimsNonEmpty: boolean
  refusal:      string | null,  // your vocabulary
  executionPlannable: boolean,  // optional; omitted → reported as a NOTE
}
```

Optional:

- `identityMaterial(request) → string` — **supply this.** Without it the §E identity checks
  (Sudan vs Kenya, window participation) are skipped and reported `UNVERIFIED`, which is the
  single most valuable thing the corpus can prove about your adapter.
- `refusalAliases` — maps lane C's refusal codes to yours. Without it, refusal mismatches are
  `NOTE`, never `FAIL`, because lane C does not own that vocabulary.
- `skipRows` / `skipReasons` — rows your adapter deliberately answers differently. A skip with a
  stated reason is a legitimate outcome; a silent disagreement is not.

## Two assertion classes

- **`SEMANTIC_INVARIANT`** — availability, assessment, whether claims were served, and whether an
  execution may be planned. These must hold for any correct adapter. A mismatch is a `FAIL`.
- **`PACKAGE_CONVENTION`** — currently only the refusal-code spelling. `NOTE` unless you supply
  aliases.

## Rows that are expected to fail today, and why that is informative

Nine rows are `provenance: COUNTERFACTUAL`: they describe a **governed retained humanitarian
store, which does not exist yet** (E1 records activation as blocked). Against today's product
those rows cannot pass, and that is not a regression — it is the corpus stating what must become
true when a store is bound. The nine `MEASURED_STATE_TODAY` rows are the ones that should pass
now. Probe `C-2` fails the run if either class is ever emptied, because a corpus with only
today's rows would be satisfied by an adapter that refuses forever.

## The four invariants most worth wiring into CI

1. **An ungoverned store must not answer.** Bind `UNBOUND_NO_GOVERNED_BINDING` to a store that
   returns data, not one that politely refuses — otherwise the test passes whether or not the
   adapter checks. Lane C's defect `D-2` was exactly this mistake.
2. **`NOT_ASSESSED` must never stand in for an unreachable store.** `NOT_CONNECTED` and
   `TEMPORARILY_UNAVAILABLE` are `SOURCE_UNAVAILABLE`. Reporting "nothing was assessed" when the
   truth is "we could not look" is the collapse the programme rule forbids.
3. **`CURRENT_PROVIDER_OBSERVATION` is unreachable from any Ask read that performs no provider
   fetch.** Retained rows are `RETAINED_REPORTING` however fresh they are.
4. **Identity must separate by country and by stated window** before a store is bound, not after —
   otherwise a cached refusal serves the wrong country today and a cached *answer* does tomorrow.
