# CROSS-DOMAIN ASK — HUMANITARIAN R2

Conflict + Humanitarian · geography + Humanitarian · retained story + Humanitarian.

## 1 · The risk being guarded is identity reuse, not answer quality

Two domains answering together is not the hazard. The hazard is that a plan assembled from a
**different set of contributing legs** reuses a cached identity — so a Conflict-only answer is
served to a Conflict+Humanitarian question, or a Sudan humanitarian leg is served under a Kenya
conflict question. That failure is silent, survives reopen, and looks like a cache hit.

So composite identity must be a function of the **whole** contributing set:

| property | why | probe | mutation |
|---|---|---|---|
| **order-independent** | leg order is an implementation detail; two identical plans must share an identity | `XD-1` | `MU-34` |
| **membership-sensitive** | dropping any leg must change identity — this is the actual guard | `XD-2` | — |
| **separated, not concatenated** | `legs:2` + legA + legB must not collide with another decomposition | `XD-8` | `MU-35` |
| **count-prefixed** | a dropped leg cannot be masked by a coincidental concatenation | `XD-8` | `MU-35` |

`src/crossdomain.ts` · `compositeIdentityMaterial()`. Legs are sorted by their encoded form and each
leg is encoded with the **U+001F** separator Main ruled load-bearing — the same discipline, extended
to a new dimension rather than a new scheme.

## 2 · The three combinations

**Conflict + Humanitarian** (`XD-3`). Adding a humanitarian leg to a conflict plan must change the
identity. Both are REQUIRED legs, so neither may be answered from the other's reporting — see §3.

**Geography + Humanitarian** (`XD-4`). The same humanitarian leg under two different geography legs
must produce two identities. This is the composite form of the R1 Sudan-vs-Kenya rule: it is not
enough for the humanitarian leg to carry its country if the geography leg can vary independently.
Note the geography leg is SUPPLEMENTARY and **still** participates in identity — requiredness governs
whether a leg must be *satisfied*, never whether it counts toward identity. A supplementary leg that
did not affect identity would let two differently-scoped plans share a cache entry.

**Retained story + Humanitarian** (`XD-5`). A story anchor must change the identity, because the same
humanitarian question asked against a specific retained story is a different question.

`XD-7` asserts the contributing domain set is sorted and deduplicated, so a repeated leg cannot
inflate the set.

## 3 · Substitution stays forbidden

Carried from the accepted router ruling `reportingSubstitutionForbidden`: a **REQUIRED** humanitarian
leg may not be answered from another domain's reporting with a disclosure attached. `XD-6` asserts
it is forbidden for a required leg and **not** asserted for a supplementary one — the negative half
matters, because a rule that fired for every leg would be indistinguishable from a constant.

`substitutionForbidden()`, mutation `MU-36`.

## 4 · What cross-domain does NOT do here

- **It does not merge evidence across domains.** Each leg carries its own opaque identity; this
  module composes identities and nothing else. No claim from one domain is restated as another's.
- **It does not rank or arbitrate between domains.** Precedence belongs to the frozen router's
  declared ranks, which this lane does not reopen.
- **It does not create a second plan space.** The composite material feeds the existing
  `requestHash` / `fingerprint` / durable plan; lane C computes no hash.
- **It does not extend the disclosure guard across domains.** A Conflict leg's disclosure
  classification is Conflict's responsibility. The humanitarian guard governs humanitarian evidence
  only, and **a cross-domain answer is only as leak-safe as its weakest leg** — stated as a gap for
  convergence, not papered over.

## 5 · Unmeasured

The leg identities in the corpus are **fixtures**. Whether the Conflict, geography and retained-story
lanes expose an identity string at all, and in what form, was not measured — this session has no
repository access. `ContributingLeg.identity` is deliberately an opaque string so any lane's
identity can be carried without this module knowing its shape, but **the join itself is unverified
until those lanes' identities are wired**. Recorded in HANDOFF.md.
