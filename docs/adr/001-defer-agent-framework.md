# ADR-001 — Defer Agent Framework Adoption

- **Status:** Accepted (decision approved in conversation)
- **Date:** 2026-10-13
- **Scope:** Runtime agent orchestration for Padłownia, **not** rules for Codex development assistants.

## Context
Our first production flow is primarily deterministic: importer, validation, entity resolution, retrieval, structured outputs and measured evaluations. Adding LangGraph/LangChain or another agent orchestration framework prematurely would increase conceptual/operational complexity before we have evidence of need. The owner wants to learn agent/context engineering through concrete trade-offs and experiments, not framework-specific syntax.

## Decision
Do **not** adopt an orchestration framework for initial ingestion and assistant MVP. Implement clear module boundaries, typed tools and state transitions using ordinary TypeScript. Keep interfaces replaceable; compare agentic retrieval and wave-based research agents only after baseline pipelines have golden evals, tracing and cost data.

## Consequences
- Simpler cost debugging, reproducible test runs, fewer dependencies.
- Own responsibility for straightforward orchestration, retries, timeouts and state handling.
- Review this decision if multi-step plans, durable complex agent state or long-running branches measurably require more tooling.

## Reconsideration trigger
A documented experiment shows a framework improves quality, maintainability or operational reliability enough to justify added complexity and cost. Record new decision in a superseding ADR.
