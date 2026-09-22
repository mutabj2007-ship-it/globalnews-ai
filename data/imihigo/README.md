# Imihigo retained evidence R1

This corpus is bounded to one NISR publication and cycle (2024/2025). It has no schedule, automatic refresh, backfill, person-level subject, sector-level commitment, derived score, ranking, trend, or sentiment calculation. Expansion requires a separately reviewed source/decoder authority; no further capture is authorized by opening the UI.

The official PDF is retained unmodified under CC BY 4.0 (PDF page 2). Attribution: National Institute of Statistics of Rwanda (NISR), Imihigo Evaluation Report, 2024/2025. Admission selects 27 district Final Score entries from PDF page 9 (printed page 7) and the combined City of Kigali and affiliated districts result from PDF page 8 (printed page 6). The publisher's rank column remains in raw evidence but is not promoted into a ranking field or rendered as row order. UI order is lexical by entity name, supplied by the offline decoder. No official result values are transformed.

The capture timestamp is acquisition time, not publisher vintage. Evaluation is August 2025 at month precision, explicitly stated on PDF page 11. Exact publication date and publisher revision number are not stated in the admitted evidence; neither is inferred from URL, copyright year, or capture time. English is the source language, separately preserved from EN/PL display locale. City of Kigali's score is not assigned to its individual districts. Ministry/board classes exist in the model but no individual scores are inferred from cluster averages or favourable mentions. Targets, indicators and evaluation statuses remain null in this selection.

## Reproduce offline

Run with Python and pypdf (decoder version recorded in retained.json):

    python scripts/imihigo/decode.py --authorize-offline-decode --check
    python -m unittest discover -s scripts/imihigo -p test_governance.py

Acquisition is a separate command, `capture.py --authorize-one-capture`, and refuses while any capture already exists. It has an exact source URL, TLS verification, a 5 MiB limit, request timeout and no retry loop. The first www-host attempt failed TLS without returning document bytes; the successful official bare-domain URL is the retained source identity. No TLS verification was bypassed.

The frontend reader imports retained JSON and an explicit reviewed content authority. It never imports or invokes either Python command and never requests source bytes. It rejects changes to source identity, score, qualifier, language, provenance, null fields, or any other unreviewed content. Adding a publisher revision requires an independently decoded and reviewed authority entry. Revision history is append-only; identical captures are idempotent and orphan/fork/backdated revisions are refused. The current corpus contains no publisher revisions; revision tests use synthetic fixtures only.

## UI recovery

H-IMIHIGO-KENYA-ELECTIONS-PLAN-B-IMPLEMENTATION-R2 supplied the delivery preview, local parts, strings and four-region layout. MAIN R3 supplied the unranked list corrections. E1 sensitivity and L multilingual rulings were inspected. Only delivery files were recovered; Kenya Elections and unrelated Politics patches were not applied.

The real retained reader at `/imihigo` and `/imihigo/compact` uses the same panels, HUD, neutral subject rows, spacing, token family and four-region order. Row wrapping and optional source details are the only local-parts extensions. The archived provider-free preview stays at `/delivery-visual-preview`. The broader `/delivery` activation gates are not claimed satisfied; no sensitive commitment precision or provider activation is introduced. The user's R1 authorization opens only this bounded specialist retained-evidence route. All routes are noindex. Production HOLD remains.
