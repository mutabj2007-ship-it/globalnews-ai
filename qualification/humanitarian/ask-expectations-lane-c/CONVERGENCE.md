# Lane C R2 — how this package is consumed by convergence

This is lane C's Humanitarian Ask R2 regression package. It was delivered as
`HUMANITARIAN-DATA-R1-C-R2.zip` (sha256 `e60bb1cc…`), and every entry in `SHA256SUMS.txt`
verified on intake. Its bundle head is `c11e2f3c`. The bundle and patch were transport only and
are not committed. Every other file is byte-identical to the delivery.

**This is not runtime code.** `src/` is lane C's reference oracle, and nothing under
`backend/src` imports this folder; a spec asserts that.

## Binding to the canonical adapter

`backend/src/modules/ask-intelligence/humanitarian-specialist.lane-c-corpus.spec.ts` runs all
22 rows of `expectations/humanitarian-ask-expectations.json` against
`humanitarianContribution`, the canonical C-H3 adapter.

- C's availability/assessment axes are translated inside that spec only. The source is the
  settled canonical states (`UNAVAILABLE | NO_RETAINED_EVIDENCE | RETAINED`, then the contribution
  status). No runtime vocabulary is added.
- The leak canary is checked on all five sinks: MODEL_CONTEXT, SOURCES_RAIL,
  DURABLE_CONTRIBUTION, STORED_RESULT and SAVED_RECENT (stored result reopened).
- The non-vacuity mutations, each confirmed to fail the spec:
  - reader-admission bypass;
  - geometry check removed;
  - `IMPACT_NOT_ASSESSED` dropped;
  - the pre-fix row-derived disclosure set.

### Pinned divergences (canonical wins, by ruling)

The spec asserts that this set is exact.

| Rows | Canonical | Ruling |
|---|---|---|
| G1b, G2c, G4a, G6a (unbound store) | `NOT_ASSESSED` (no governed reader) | CTO absence semantics. C's NOT_CONNECTED/SOURCE_UNAVAILABLE is not adopted |
| R2-DG1, R2-SA1 (mixed disclosure) | whole contribution `REFUSED` | C-H3 / E1 D-1 / G R2 gate: never silently thinned to the safe subset |
| R2-DG2 (all withheld) | `REFUSED` (C: NO_DATA_FOR_GEOGRAPHY) | same |

## A defect C found, and its fix

The adapter derived three of E1's six required codes from the rows. A USED answer whose rows all
stated a country therefore dropped `COUNTRY_SCOPE_NOT_STATED_BY_SOURCE`, which violates E1 D-1.
Fixed in convergence commit `68b3e4f`: a USED contribution carries E1's full list, and the
governed-prompt wording is now conditional.

## Recorded and not adopted

- C's statements about `originatingAgency` and about two absence vocabularies are stale. The
  first is in Main's contract and carried by the adapter; the second is settled by the CTO.
- C's type split (`RetainedReadOutput` vs `HumanitarianReadResult`) is not adopted. Main's read
  constructor and the adapter's per-row re-check already refuse classified rows.

## Still UNVERIFIED, at binding time and not now

These belong to platform Ask V2, and the specialist is `SPECIALIST_NOT_BOUND`:

- `identityMaterial` §E: window participation and cross-country cache separation in
  `requestHash`/fingerprint;
- `readerRevision` joining `planRevision`.

The spec proves only that country scope separates the contribution (`geographyBasis`).

C also recommends a constant disclosure that protected material is excluded from all answers,
because a protected-only read is indistinguishable from an empty one. That needs an E1
vocabulary ruling and is not implemented here.
