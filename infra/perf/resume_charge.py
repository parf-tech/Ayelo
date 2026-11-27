"""Résume les passages de charge alternés (comparer.sh, PERF_LOAD=1).

Usage : python3 -I resume_charge.py <dossier>
Lit charge-<version>-<échelle>-<tour>.json (résumés k6) et affiche, par échelle et version, la médiane des tours.
"""
import json
import pathlib
import statistics
import sys

runs = {}
for path in sorted(pathlib.Path(sys.argv[1]).glob("charge-*.json")):
    _, version, scale, _round = path.stem.split("-")
    metrics = json.loads(path.read_text(encoding="utf-8"))["metrics"]

    def value(name, key):
        return metrics.get(name, {}).get(key, 0)

    runs.setdefault((float(scale), version), []).append({
        "rps": value("http_reqs", "rate"),
        "med": value("http_req_duration", "med"),
        "p95": value("http_req_duration", "p(95)"),
        "send": value("http_req_duration{name:send}", "p(95)"),
        "dropped": value("dropped_iterations", "count"),
        # Dans un taux k6, « passes » compte les valeurs vraies : ici, les requêtes en échec.
        "failed": value("http_req_failed", "passes"),
    })

if not runs:
    sys.exit("aucun résumé de charge")

print(f"{'échelle':8} {'version':10} {'tours':>5} {'req/s':>7} {'médiane ms':>11} {'p95 ms':>9} {'p95 envoi':>10} {'abandons':>9} {'échecs':>7}   p95 de chaque tour")
for scale in sorted({s for s, _ in runs}):
    for version in ("reference", "present"):
        rows = runs.get((scale, version))
        if not rows:
            continue

        def middle(key):
            return statistics.median(row[key] for row in rows)

        each = " ".join(f"{row['p95']:.0f}" for row in rows)
        print(f"{scale:<8} {version:10} {len(rows):5d} {middle('rps'):7.1f} {middle('med'):11.0f} {middle('p95'):9.0f} {middle('send'):10.0f} "
              f"{sum(row['dropped'] for row in rows):9.0f} {sum(row['failed'] for row in rows):7.0f}   {each}")
