# 08 — Source Coverage Matrix

Authority `5513275f`. Source records: `07-SOURCE-ADMISSION-REGISTRY.json` (348). Per-country raw data: `stage0/source-coverage.json`.

**Rule applied (contract Part V):** a country with no qualified local source that is *active and rights-cleared* is **COVERAGE_GAP**. International sources may supplement local coverage, but must not silently replace it.

## Result

- **All 54 priority countries are COVERAGE_GAP.** Active-and-rights-cleared local sources: **0**.
- **The only active news source is GNews,** an international aggregator with **no rights record** in the repository. It answers every country read, and the news path and frontend show **no "no local coverage" disclosure**. This is P0-SRC-01.
- **The system's own coverage function mislabels these countries.** `accountSourceCoverage` (`shared/src/global-reach.ts:304-310`) labels all 54 countries `UNVERIFIED` rather than `COVERAGE_GAP`, and only the admin controller exposes it.
- **Poland (EU deep reference) has 8 listed local sources** (6 canonical plus 2 feeds) and 0 active.
- **The listed sources are disabled.** 290 global-reach entries across the three packs are all `DISABLED`. All 6 curated feeds ship `enabled: false`. Rights-restricted local entries recorded in the East Africa raw pack: 31. The normaliser turns 30 of them into `UNKNOWN` (`scripts/global-reach/normalize-regional-packs.mjs:189`).

Not present anywhere in code: ReliefWeb, HDX, OCHA and ACLED (Humanitarian programme lane).

<!-- GENERATED:BEGIN -->
## Regional roll-up

| Region | Countries | COVERAGE_GAP | Active qualified local | Listed local | Listed local news | International active |
|---|---|---|---|---|---|---|
| East Africa | 11 | 11 | 0 | 84 | 34 | GNews only |
| EU-27 (Poland deep reference) | 27 | 27 | 0 | 164 | 81 | GNews only |
| Middle East | 16 | 16 | 0 | 48 | 31 | GNews only |

## Per country

### East Africa

| Country | Active qualified local | Listed local | Listed local news | Listed disabled | Rights-restricted (raw) | International active | State |
|---|---|---|---|---|---|---|---|
| BDI | 0 | 7 | 3 | 7 | 2 | gnews | **COVERAGE_GAP** |
| COD | 0 | 7 | 3 | 7 | 4 | gnews | **COVERAGE_GAP** |
| DJI | 0 | 5 | 2 | 5 | 3 | gnews | **COVERAGE_GAP** |
| ERI | 0 | 2 | 1 | 2 | 1 | gnews | **COVERAGE_GAP** |
| ETH | 0 | 7 | 3 | 7 | 2 | gnews | **COVERAGE_GAP** |
| KEN | 0 | 14 | 5 | 14 | 7 | gnews | **COVERAGE_GAP** |
| RWA | 0 | 16 | 6 | 16 | 1 | gnews | **COVERAGE_GAP** |
| SOM | 0 | 7 | 3 | 7 | 5 | gnews | **COVERAGE_GAP** |
| SSD | 0 | 5 | 2 | 5 | 3 | gnews | **COVERAGE_GAP** |
| TZA | 0 | 7 | 3 | 7 | 1 | gnews | **COVERAGE_GAP** |
| UGA | 0 | 7 | 3 | 7 | 2 | gnews | **COVERAGE_GAP** |

### EU-27 (Poland deep reference)

| Country | Active qualified local | Listed local | Listed local news | Listed disabled | Rights-restricted (raw) | International active | State |
|---|---|---|---|---|---|---|---|
| AUT | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| BEL | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| BGR | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| CYP | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| CZE | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| DEU | 0 | 6 | 3 | 6 | 1 | gnews | **COVERAGE_GAP** |
| DNK | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| EST | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| ESP | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| FIN | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| FRA | 0 | 6 | 3 | 6 | 1 | gnews | **COVERAGE_GAP** |
| GRC | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| HRV | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| HUN | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| IRL | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| ITA | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| LTU | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| LUX | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| LVA | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| MLT | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| NLD | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| POL | 0 | 8 | 3 | 8 | 1 | gnews | **COVERAGE_GAP** |
| PRT | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| ROU | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| SWE | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| SVN | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |
| SVK | 0 | 6 | 3 | 6 | 0 | gnews | **COVERAGE_GAP** |

### Middle East

| Country | Active qualified local | Listed local | Listed local news | Listed disabled | Rights-restricted (raw) | International active | State |
|---|---|---|---|---|---|---|---|
| BHR | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| EGY | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| IRN | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| IRQ | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| ISR | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| JOR | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| KWT | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| LBN | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| OMN | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| PSE | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| QAT | 0 | 3 | 1 | 3 | 0 | gnews | **COVERAGE_GAP** |
| SAU | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| SYR | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| TUR | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| ARE | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |
| YEM | 0 | 3 | 2 | 3 | 0 | gnews | **COVERAGE_GAP** |

<!-- GENERATED:END -->
