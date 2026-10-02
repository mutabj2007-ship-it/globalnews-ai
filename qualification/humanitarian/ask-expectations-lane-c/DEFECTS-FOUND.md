# DEFECTS FOUND IN THIS PACKAGE — RECORDED, NOT QUIETLY FIXED

The corpus and the probes passed **18/18 and 39/39 on their first run**. That is not evidence of
correctness; it is the condition under which weak tests look identical to strong ones. **The
mutation campaign then found four real defects, and every one of them was a test that could not
fail.** All four are fixed in source or in the fixtures. No expectation was relaxed and no
mutation was weakened to make it appear to bite.

---

## D-1 · The observation-key normalisation was done twice, so each copy masked the other

**Found by:** `MU-8` SURVIVED. The mutation removed `.sort()`/dedupe from `buildIdentity`, and
probe `I-5` — whose entire job is to assert that key order and duplicates cannot change identity —
**kept passing.**

**Cause.** `buildIdentity` sorted and deduplicated, and `identityMaterial` sorted and deduplicated
again. Redundant normalisation is not belt-and-braces; it is two places where a defect is
invisible, because breaking either one leaves the other to clean up after it.

**Fix.** Normalise in **one** place, `buildIdentity`, named as the only sanctioned constructor;
`identityMaterial` now joins the already-normalised list verbatim. New probe `I-9` pins the
normalisation point by asserting `buildIdentity`'s own output is sorted and deduplicated, and
`M-1` now requires `I-9` as `I-5`'s control. `MU-8` bites.

---

## D-2 · The ungoverned-store probe could not distinguish a refusal from a pass-through

**Found by:** `MU-2` SURVIVED. The mutation deleted the `if (!port.governed)` check — the single
line that keeps an unbound humanitarian store from answering Ask — and probe `B-3` **kept
passing.**

**Cause, and it is the more interesting half.** The fixture for an ungoverned store politely
returned `NOT_CONNECTED / SPECIALIST_NOT_BOUND`. So with the check in place the adapter refused
with those values, and with the check removed the *port's own* refusal flowed through the
non-`AVAILABLE` branch and produced **byte-identical output**. The probe was comparing a result
that was the same either way.

**Fix.** The fixture is now the **dangerous** stub: an ungoverned store that answers `AVAILABLE`
with claims. `B-3` first asserts the fixture really is that — returning *"probe is vacuous"* if
not — then asserts the adapter refuses anyway and that no stub claim reached the caller. `MU-2`
bites, and `MU-22` was re-pointed to make the fixture polite again, which now correctly fails
`B-3` as vacuous.

This is the same failure E1 named for the humanitarian authority itself: *"an empty dark set
protects nothing while looking exactly like one that protects everything."* The test had the same
shape as the bug.

---

## D-3 · `some` and `every` are equivalent on a one-element fixture

**Found by:** `MU-9` SURVIVED. The mutation changed the unsourced-claim guard from
`claims.some(...)` to `claims.every(...)` — which would let a partially-sourced answer through —
and probe `V-1` **kept passing**, because the fixture returned exactly one claim, and over one
element the two quantifiers agree.

**Fix.** The fixture now returns a **mixed** set: one sourced claim and one unsourced. That is also
the realistic failure — a mostly-sourced humanitarian answer with one bare assertion in it is what
actually ships, not an answer with no sources at all. `MU-9` bites.

---

## D-4 · A coverage probe was defeated by redundant coverage

**Found by:** `MU-20` SURVIVED. The mutation relabelled a `G8` row's `contractTest`, and probe
`C-1` — which asserts all eight of §G's named tests have a row — **kept passing**, because `G8`
had two rows and the other still covered it.

**Fix.** The mutation was re-pointed at `G6`, which has exactly one row, so it now removes real
coverage. **The mutation was retargeted and the probe was not weakened**; the probe's assertion is
correct as written, and the defect was that the mutation never tested it.

---

## A note on what this round did NOT find

No defect was found in the refusal ordering, the identity material, the scope ceiling or the
registration rule — those bit on the first campaign. The four above are all **test** defects, and
three of the four were tests that had the same blind spot as the code they guarded. That is the
argument for running the campaign even when everything is green: a green run looks identical
either way.

---

## R2 · D-5 · A separator probe that passed on the wrong separator

**Found by:** `MU-35` SURVIVED. The mutation changed `compositeIdentityMaterial`'s outer join from
`U+001F` to `''` — reintroducing exactly the collision Main's transport ruling exists to prevent —
and probe `XD-8` **kept passing**.

**Cause.** `XD-8` asserted `material.includes('\u001F')`. But each leg is *already* encoded with the
separator internally (`[domainId, identity, requiredness].join(UNIT_SEPARATOR)`), so the character
was present in the output no matter what the **outer** join did. The probe was asserting the presence
of a character, not the structure that character is there to create.

**Fix.** `XD-8` now asserts the outer structure: the material starts with `legs:N` **followed by the
separator**, and splitting on the separator yields exactly `1 + 3 × legs` fields. `MU-35` bites.

**Why this is the same class of defect as D-1 through D-4.** Four of the five defects this package
has found were tests that could not fail, and in each case the test was checking something
*adjacent* to the property it claimed: a character instead of a structure, a quantifier over one
element, a polite fixture instead of a dangerous one, a coverage count with a spare row. None was
found by reading the test. All were found by breaking the code and watching the test not notice.
