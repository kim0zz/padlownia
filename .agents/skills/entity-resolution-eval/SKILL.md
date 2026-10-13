---
name: entity-resolution-eval
description: Run and interpret entity matching evaluations for racket brands, models, variants and years.
---
# Entity resolution evaluation

## Inputs
Normalized source candidates, gold labels (same product, different product, uncertain), matching version and thresholds.

## Workflow
1. Build deterministic exact-match and candidate-blocking baseline, keyed by brand/model/year where reliable.
2. Account for high-risk near-names: Control vs Attack, Pro vs Pro+, Lite vs regular, Soft vs regular, 12K vs 18K, prior/new year.
3. Score precision, recall and especially false-positive merges. Show a confusion matrix and examples.
4. Route unknown/ambiguous cases to human review; LLM suggestions may be measured but are not unconditional authority.
5. Never overwrite raw records. Keep algorithm version and reviewer decision trace.

## Acceptance
Tests reproduce all labelled cases; false merges surfaced individually and rollback path defined.
