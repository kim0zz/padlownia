---
name: source-profiling
description: Profile a new padel racket source snapshot, compare schema and cleanliness, and report import risks before implementation.
---
# Source profiling

## Inputs
Snapshot location, declared publisher/version/license, intended source ID; never assume a retrieved page equals a downloadable dataset.

## Workflow
1. Inspect complete snapshot **programmatically**; count real records, fields, null/unknown semantic values, duplicates, types, categories and inconsistent units.
2. Describe unknown/missing units separately from plain empty strings. Preserve verbatim values; identify configurations (grip/overgrip, custom weights).
3. Contrast with source schema and established canonical entities. Compute cautious candidate overlaps; never claim fuzzy pairs are verified.
4. Sample actual anomalies with identifiers and exact source values. Separate facts from parser heuristics.
5. Write source rights/attribution and extraction limits; avoid committing third-party raw payloads unless rights explicitly permit it.
6. Output structured profile: counts, coverage, anomalies, match confidence and recommendations with reproducible command/test.

## Acceptance
No claims of full profiling without reading whole dataset; no unsupported overlap percentages; all metrics state denominator and methodology.
