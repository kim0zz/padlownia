---
name: rag-evaluation
description: Evaluate SQL/full-text/vector retrieval and grounded responses across models and languages with quality-cost metrics.
---
# RAG evaluation

## Inputs
Versioned golden questions, expected racket IDs, evidence IDs, ground-truth criteria, retrieval/gateway config, model prices.

## Workflow
1. Record snapshot hashes, prompt version, embedding/retrieval settings and all model IDs.
2. Compare resolved entities, retrieval recall@k, citation validity, claim support, response schema, latency and cost.
3. Separate retrieval failure from reasoning failure; inspect both retrieved evidence and the final answer.
4. Test Polish questions about French/Spanish evidence, disambiguation, missing data and explicitly contradictory reviews.
5. Maintain cheap baseline; compare alternatives on same cases. Do not use LLM-as-judge without checking reliability against a human-labelled sample.
6. Produce actionable failure examples, regression changes and quality-vs-cost comparison.

## Acceptance
Results reproducible from fixed test versions; no unsupported claims of evidence support; budget ceiling obeyed.
