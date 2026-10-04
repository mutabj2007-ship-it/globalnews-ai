#!/usr/bin/env python3
"""
WHOLE-PRODUCT CONVERGENCE R1 — registry renderer.

Regenerates the machine-readable registries and the long generated tables from:
  - tools/capabilities.source.py   (hand-maintained capability cells, each with evidence)
  - stage0/*.json                  (raw measurements at the authority SHA)

Outputs (overwritten):
  02-GLOBAL-CAPABILITY-REGISTRY.json / .md
  04-FRONTEND-ROUTE-REGISTRY.md  (generated table section only, between markers)
  05-BACKEND-MODULE-REGISTRY.md  (generated table section only, between markers)
  07-SOURCE-ADMISSION-REGISTRY.json
  08-SOURCE-COVERAGE-MATRIX.md   (generated table section only, between markers)
  09-ALPHA-ACCEPTANCE-MATRIX.md  (generated table section only, between markers)
  status.json                    (roll-up counts — the finish-line metric)

Usage:  python3 docs/convergence/tools/render.py
No network, no repository code executed.
"""
import collections
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
S0 = os.path.join(ROOT, "stage0")

ALLOWED_STATES = {
    "ABSENT", "DESIGN_ONLY", "PREVIEW_ONLY", "LOCAL_ONLY", "RETAINED_ONLY", "SEARCHABLE",
    "ASK_BOUND", "ALPHA_READY", "ALPHA_LIVE", "PRODUCTION_CANDIDATE", "PRODUCTION_LIVE",
    "BLOCKED_RIGHTS", "BLOCKED_CREDENTIAL", "BLOCKED_SECURITY", "BLOCKED_RELIABILITY", "COVERAGE_GAP",
}
CELL_VALUES = {"PASS", "PARTIAL", "FAIL", "ABSENT", "N/A", "UNVERIFIED"}
LOCALES = ["en", "pl", "fr", "de", "es", "pt", "ar"]
ACCEPT_COLS = ["Data", "Search", "Ask", "Citation", "Continuity", "Briefing", "Follow", "Alert"]
TAIL_COLS = ["Mobile", "Desktop", "Rights", "Security"]
LOC_TO_CELL = {"FULL": "PASS", "PARTIAL": "PARTIAL", "EN_FALLBACK": "FAIL", "ABSENT": "ABSENT", "N/A": "N/A"}


def load_source():
    spec = importlib.util.spec_from_file_location("caps", os.path.join(HERE, "capabilities.source.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def row_status(cells):
    applicable = [c for c in cells if c != "N/A"]
    if not applicable:
        return "N/A"
    if all(c == "PASS" for c in applicable):
        return "GREEN"
    if all(c in ("PASS", "PARTIAL", "UNVERIFIED") for c in applicable):
        return "AMBER"
    return "RED"


def validate(caps):
    errors = []
    seen = set()
    for c in caps:
        if c["id"] in seen:
            errors.append(f"duplicate id {c['id']}")
        seen.add(c["id"])
        for k in ("alphaState", "productionState"):
            if c[k] not in ALLOWED_STATES:
                errors.append(f"{c['id']}.{k}={c[k]} not an allowed maturity state")
        for k, v in c["acceptance"].items():
            if v not in CELL_VALUES:
                errors.append(f"{c['id']}.acceptance.{k}={v}")
        missing = [k for k in ACCEPT_COLS + TAIL_COLS if k not in c["acceptance"]]
        if missing:
            errors.append(f"{c['id']} missing acceptance cells {missing}")
        for loc in LOCALES:
            if loc not in c["displayLocales"]:
                errors.append(f"{c['id']} missing locale {loc}")
        for b in c["blockers"]:
            if b["priority"] not in ("P0", "P1", "P2", "P3"):
                errors.append(f"{c['id']} blocker {b['id']} bad priority")
            if not b.get("evidence"):
                errors.append(f"{c['id']} blocker {b['id']} has no evidence")
    by_id = {}
    for c in caps:
        for b in c["blockers"]:
            prev = by_id.setdefault(b["id"], b)
            if (prev["summary"], prev["priority"]) != (b["summary"], b["priority"]):
                errors.append(f"blocker {b['id']} declared with different summary/priority in {c['id']}")
    if errors:
        sys.exit("registry invalid:\n  " + "\n  ".join(errors))


def replace_between(path, body, title_if_new):
    start, end = "<!-- GENERATED:BEGIN -->", "<!-- GENERATED:END -->"
    if os.path.exists(path):
        text = open(path, encoding="utf-8").read()
        if start in text and end in text:
            pre = text.split(start)[0]
            post = text.split(end)[1]
            open(path, "w", encoding="utf-8").write(f"{pre}{start}\n{body}\n{end}{post}")
            return
    open(path, "w", encoding="utf-8").write(f"# {title_if_new}\n\n{start}\n{body}\n{end}\n")


def md_escape(v):
    return str(v).replace("|", "\\|").replace("\n", " ")


def main():
    src = load_source()
    caps = src.CAPABILITIES
    validate(caps)

    for c in caps:
        cells = [c["acceptance"][k] for k in ACCEPT_COLS] + [LOC_TO_CELL.get(c["displayLocales"][l], "FAIL") for l in LOCALES] + [c["acceptance"][k] for k in TAIL_COLS]
        c["acceptance"]["Status"] = row_status(cells)

    registry = {
        "schema": "globalnews-ai/capability-registry/v1",
        "authority": src.AUTH,
        "productionRef": src.PROD_REF,
        "measuredAt": "2026-10-04",
        "deploymentObserved": False,
        "deploymentNote": "Alpha/Production hosts are not reachable from the measuring container (network policy 403). "
                          "Alpha/Production states are derived from refs + code; any cell depending on a deployment flag is UNVERIFIED.",
        "allowedMaturityStates": sorted(ALLOWED_STATES),
        "capabilities": caps,
    }
    json.dump(registry, open(os.path.join(ROOT, "02-GLOBAL-CAPABILITY-REGISTRY.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    # ---------- 02 .md ----------
    lines = [
        "# 02 — Global Capability Registry (human view)",
        "",
        "Generated from `02-GLOBAL-CAPABILITY-REGISTRY.json` by `tools/render.py`. Do not edit by hand; edit `tools/capabilities.source.py`.",
        "",
        f"Authority: `{src.AUTH['branch']}` @ `{src.AUTH['sha']}` · Production ref `{src.PROD_REF['branch']}` @ `{src.PROD_REF['sha']}` · deployment observed: **no**",
        "",
        "| Capability | Alpha state | Production state | Shared search | Citation | Continuity | Briefing | Follow | Alert | Locales (en pl fr de es pt ar) | Blockers |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    abbrev = {"FULL": "F", "PARTIAL": "P", "EN_FALLBACK": "E", "ABSENT": "A", "N/A": "-"}
    for c in caps:
        loc = " ".join(abbrev.get(c["displayLocales"][l], "?") for l in LOCALES)
        bl = ", ".join(f"{b['id']}" for b in c["blockers"]) or "—"
        lines.append("| " + " | ".join(md_escape(x) for x in [
            f"**{c['id']}** {c['name']}", c["alphaState"], c["productionState"], c["sharedSearchBinding"],
            c["citationState"], c["continuityState"], c["briefingState"], c["followState"], c["alertState"], loc, bl]) + " |")
    lines += ["", "Locale key: F full · P partial · E English fallback · A absent · - not applicable.", "", "## Per-capability detail", ""]
    for c in caps:
        lines += [f"### {c['id']} — {c['name']}", "",
                  f"- Surface: {', '.join(c['surface']) or '—'}",
                  f"- Backend owner: {', '.join(c['backendOwner']) or '—'}",
                  f"- Frontend owner: {', '.join(c['frontendOwner']) or '—'}",
                  f"- Authority: `{c['authority']['branch']}` @ `{c['authority']['sha']}`",
                  f"- Alpha: **{c['alphaState']}**" + (f" — {c['alphaNote']}" if c.get('alphaNote') else ""),
                  f"- Production: **{c['productionState']}**" + (f" — {c['productionNote']}" if c.get('productionNote') else ""),
                  f"- Data: {c['dataState']}",
                  f"- Source rights: {c['sourceRightsState']}",
                  f"- Source languages: {', '.join(c['sourceLanguages']) or '—'}",
                  f"- Rollback: {c['rollbackAuthority']}",
                  f"- Evidence: {', '.join(c['evidence'])}"]
        for b in c["blockers"]:
            lines.append(f"- **{b['priority']} {b['id']}** — {b['summary']} _(evidence: {b['evidence']})_")
        lines.append("")
    open(os.path.join(ROOT, "02-GLOBAL-CAPABILITY-REGISTRY.md"), "w", encoding="utf-8").write("\n".join(lines))

    # ---------- 09 acceptance ----------
    header = ["Capability", "Surface"] + ACCEPT_COLS + [l.upper() for l in LOCALES] + TAIL_COLS + ["Status"]
    rows = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for c in caps:
        locs = [LOC_TO_CELL.get(c["displayLocales"][l], "FAIL") for l in LOCALES]
        cells = [c["acceptance"][k] for k in ACCEPT_COLS] + locs + [c["acceptance"][k] for k in TAIL_COLS]
        rows.append("| " + " | ".join(md_escape(x) for x in [c["id"], "; ".join(c["surface"][:2]) or "—"] + cells + [c["acceptance"]["Status"]]) + " |")
    counts = collections.Counter(c["acceptance"]["Status"] for c in caps)
    cell_counts = collections.Counter()
    for c in caps:
        for k in ACCEPT_COLS + TAIL_COLS:
            cell_counts[c["acceptance"][k]] += 1
        for l in LOCALES:
            cell_counts[LOC_TO_CELL.get(c["displayLocales"][l], "FAIL")] += 1
    body = "\n".join(rows) + (
        f"\n\n**Roll-up:** {len(caps)} capabilities — GREEN {counts.get('GREEN',0)} · AMBER {counts.get('AMBER',0)} · RED {counts.get('RED',0)}.  "
        f"\n**Cells:** " + " · ".join(f"{k} {cell_counts[k]}" for k in ["PASS", "PARTIAL", "UNVERIFIED", "FAIL", "ABSENT", "N/A"]) + "."
    )
    replace_between(os.path.join(ROOT, "09-ALPHA-ACCEPTANCE-MATRIX.md"), body, "09 — Alpha Acceptance Matrix")

    # ---------- 04 routes ----------
    routes = json.load(open(os.path.join(S0, "frontend-routes.json"), encoding="utf-8"))
    rrows = ["| Path | Kind | Class | Alpha | Production | Language | Theme | Data source | Auth | Mobile | Ask | Evidence |", "|" + "---|" * 12]
    def short(v, n=70):
        if isinstance(v, (dict, list)):
            v = json.dumps(v, ensure_ascii=False)
        v = str(v)
        return v if len(v) <= n else v[: n - 1] + "…"
    for r in sorted(routes, key=lambda r: (r["classification"], r["path"])):
        rrows.append("| " + " | ".join(md_escape(short(x)) for x in [
            r["path"], r["kind"], r["classification"], r.get("alpha"), r.get("production"), r.get("language"), r.get("theme"),
            r.get("data_source"), r.get("auth"), r.get("mobile_parity"), r.get("ask_integration"), r.get("evidence_state")]) + " |")
    cls = collections.Counter(r["classification"] for r in routes)
    rbody = "\n".join(rrows) + "\n\n**Counts:** " + " · ".join(f"{k} {v}" for k, v in sorted(cls.items())) + f" · total {len(routes)}. Full records: `stage0/frontend-routes.json`."
    replace_between(os.path.join(ROOT, "04-FRONTEND-ROUTE-REGISTRY.md"), rbody, "04 — Frontend Route Registry")

    # ---------- 05 backend ----------
    mods = json.load(open(os.path.join(S0, "backend-modules.json"), encoding="utf-8"))
    mrows = ["| Module | In AppModule | Classification | Routes | Flags | Ask reachability | User usefulness |", "|" + "---|" * 7]
    for m in mods:
        c = m["classification"]
        c = ", ".join(c) if isinstance(c, list) else c
        routes_n = len(m["routes"]) if isinstance(m.get("routes"), list) else short(m.get("routes"), 30)
        flags = m.get("env_flags")
        if isinstance(flags, list):
            flags = ", ".join((f.get("name") if isinstance(f, dict) else str(f)) for f in flags)
        mrows.append("| " + " | ".join(md_escape(short(x, 90)) for x in [m["module"], m["imported_in_app_module"], c, routes_n, flags or "—", m.get("ask_reachability"), m.get("user_usefulness")]) + " |")
    ccount = collections.Counter()
    for m in mods:
        for k in (m["classification"] if isinstance(m["classification"], list) else [m["classification"]]):
            ccount[k] += 1
    mbody = "\n".join(mrows) + "\n\n**Classification counts (multi-label):** " + " · ".join(f"{k} {v}" for k, v in ccount.most_common()) + f" · records {len(mods)}. Full records: `stage0/backend-modules.json`."
    replace_between(os.path.join(ROOT, "05-BACKEND-MODULE-REGISTRY.md"), mbody, "05 — Backend Module Registry")

    # ---------- 07 sources ----------
    sources = json.load(open(os.path.join(S0, "sources.json"), encoding="utf-8"))
    by_reg = collections.Counter(s["registry"] for s in sources)
    reg = {
        "schema": "globalnews-ai/source-admission-registry/v1",
        "authority": src.AUTH,
        "measuredAt": "2026-10-04",
        "fields": ["source_id", "domain_module", "country", "region", "basis", "languages", "rights_status", "credential_status",
                   "security_host_state", "acquisition_state", "last_successful_retrieval", "provenance_quality",
                   "retention_permission", "public_display_permission"],
        "definitions": {
            "is_rights_cleared": "an E-5 grade with a written, code-resolvable instrument; a null rights binding is a refusal",
            "is_active": "fetches or serves at runtime under default + recorded Alpha configuration",
            "last_successful_retrieval": "only when a dated artifact in the repository proves it; else UNKNOWN",
        },
        "totals": {"records": len(sources), "byRegistry": dict(by_reg),
                   "active": sum(1 for s in sources if s.get("is_active")),
                   "rightsCleared": sum(1 for s in sources if s.get("is_rights_cleared")),
                   "activeAndRightsCleared": sum(1 for s in sources if s.get("is_active") and s.get("is_rights_cleared"))},
        "sources": sources,
    }
    json.dump(reg, open(os.path.join(ROOT, "07-SOURCE-ADMISSION-REGISTRY.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    # ---------- 08 coverage ----------
    cov = json.load(open(os.path.join(S0, "source-coverage.json"), encoding="utf-8"))
    crows = []
    summary = []
    for region, label in [("east-africa", "East Africa"), ("eu27", "EU-27 (Poland deep reference)"), ("middle-east", "Middle East")]:
        rr = cov[region]["countries"]
        gaps = sum(1 for x in rr if x.get("active_local_qualified_count", 0) == 0)
        summary.append(f"| {label} | {len(rr)} | {gaps} | {sum(x.get('active_local_qualified_count',0) for x in rr)} | {sum(x.get('listed_local_count',0) for x in rr)} | {sum(x.get('listed_local_news_count',0) for x in rr)} | GNews only |")
        crows += [f"### {label}", "", "| Country | Active qualified local | Listed local | Listed local news | Listed disabled | Rights-restricted (raw) | International active | State |", "|" + "---|" * 8]
        for x in rr:
            state = "COVERAGE_GAP" if x.get("active_local_qualified_count", 0) == 0 else "COVERED"
            crows.append(f"| {x['iso3']} | {x.get('active_local_qualified_count')} | {x.get('listed_local_count')} | {x.get('listed_local_news_count')} | {x.get('listed_local_disabled_count')} | {x.get('listed_local_rights_restricted_raw')} | {', '.join(x.get('international_active', [])) or '—'} | **{state}** |")
        crows.append("")
    cbody = "## Regional roll-up\n\n| Region | Countries | COVERAGE_GAP | Active qualified local | Listed local | Listed local news | International active |\n|---|---|---|---|---|---|---|\n" + "\n".join(summary) + "\n\n## Per country\n\n" + "\n".join(crows)
    replace_between(os.path.join(ROOT, "08-SOURCE-COVERAGE-MATRIX.md"), cbody, "08 — Source Coverage Matrix")

    # ---------- 10 blockers ----------
    agg = collections.OrderedDict()
    for c in caps:
        for b in c["blockers"]:
            e = agg.setdefault(b["id"], {"priority": b["priority"], "summary": b["summary"], "evidence": b["evidence"], "caps": []})
            e["caps"].append(c["id"])
    brows = []
    for pr, label in [("P0", "P0 — product blocker"), ("P1", "P1 — Alpha blocker"), ("P2", "P2 — Production blocker"), ("P3", "P3 — later enhancement")]:
        items = [(k, v) for k, v in agg.items() if v["priority"] == pr]
        brows += [f"### {label} ({len(items)})", "", "| ID | Blocker | Capabilities | Evidence |", "|---|---|---|---|"]
        for k, v in sorted(items):
            brows.append("| " + " | ".join(md_escape(x) for x in [k, v["summary"], ", ".join(v["caps"]), v["evidence"]]) + " |")
        brows.append("")
    replace_between(os.path.join(ROOT, "10-PRODUCTION-BLOCKERS.md"), "\n".join(brows), "10 — Production Blockers")

    # ---------- status.json ----------
    blockers = [dict(b, capability=c["id"]) for c in caps for b in c["blockers"]]
    uniq = {}
    for b in blockers:
        uniq.setdefault(b["id"], b)
    status = {
        "authority": src.AUTH, "measuredAt": "2026-10-04",
        "capabilities": len(caps),
        "rowStatus": dict(counts),
        "cells": dict(cell_counts),
        "blockers": dict(collections.Counter(b["priority"] for b in uniq.values())),
        "finishLine": "every capability row GREEN except explicitly approved Production-only blockers (contract Definition of Done #9)",
    }
    json.dump(status, open(os.path.join(ROOT, "status.json"), "w"), indent=1)
    print(json.dumps(status, indent=1))


if __name__ == "__main__":
    main()
