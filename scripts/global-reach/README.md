# Dormant regional source normalization

CTO integration order: M R2 authority, then N (East Africa), O (Middle East), P (EU27).
Original evidence manifests remain in their donor locations and must not be overwritten.

Run after installing dependencies and building shared/backend:

    node scripts/global-reach/normalize-regional-packs.mjs --check
    node --test scripts/global-reach/normalize-regional-packs.test.mjs

To regenerate after an explicitly reviewed evidence change, use --write. There is no network
mode. The script reads research metadata, validates canonical output with M's shared loader,
and writes only backend/src/modules/global-reach/data/*.json. Existing Nest JSON asset rules
package those snapshots. --check requires byte-for-byte deterministic reproduction.

The n/o/p canonical files are runtime data; regional-admission.json is the product admission
index used by offline replay tests to account for every admitted or withheld source and input
hash. It is not a delivery report. Review reports and test logs belong outside Git under B.

Mapping boundaries:
- Region authority comes from M R2: East Africa, Middle East, European Union (EU27).
  Navigation Europe/EAC do not define completeness.
- Canonical country pairs use shared COUNTRIES. M rejects countries outside each programme.
- Every original source object and manifest SHA is retained in canonical provenance.
  Original names/scripts remain unchanged; no translation is performed.
- N feed language is preserved as declared metadata, never called detected article language.
  O languages enter the language list only when marked observed; P expected language targets
  stay in provenance, not an observed-language list.
- All dates/check outcomes/feed URLs remain in original evidence. Canonical verifiedAt remains
  null because no product-ready source baseline was admitted by this normalization.
- All sources are DISABLED, transport NONE, endpoint null, health UNKNOWN, capture UNKNOWN.
  UNKNOWN rights never become PERMITTED; explicit restrictions remain RESTRICTED.
  No rights binding is invented. Unexpected permission/binding or enabled source is withheld.
- Exact aliases and ambiguous host/name/ID identities are withheld, never given invented IDs
  or selected by first-wins order. Refusals remain in the admission index and country gaps.
- N country-focused sources and national institutional candidates are LOCAL context; exile/
  cross-border sources and the explicit international OCHA/IFRC hosts are INTERNATIONAL.
  This does not assert headquarters, ownership independence or national representativeness.
- Regional coverage labels are ignored. Runtime calls only M's accountSourceCoverage.
  Current result is 54 UNVERIFIED rows with explicit gaps, not 54 validated local baselines.

Admin reads consume a validated immutable snapshot. No request executes this generator,
performs a provider probe, refreshes discovery evidence, or acquires data. Even an enabled
Global Reach flag and allowlisted source cannot acquire these unverified DISABLED entries.
Future operational admission needs separate reviewed evidence, rights, transport and activation
decisions; changing research labels is insufficient.
