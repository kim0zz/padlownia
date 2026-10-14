# ADR-005 — Versioned comparison context and shared structured views

- **Status:** Implemented reversible technical choices within the owner-authorized Sprint 02 scope; final automated check, fixture browser suite and read-only Dev smoke passed after the mobile rating-row alignment correction. This status does not accept other proposed product decisions.
- **Date:** 2026-10-15.
- **Authority:** [Sprint 02 brief](../development/SPRINT_02_BRIEF.md), accepted P-002/P-005/P-011/P-023–P-027 in [DECISIONS](../product/DECISIONS.md), and the owner's explicit approval of two-racket comparison, shared components/tokens, a fixture gallery and a strict view contract.

## Context

The catalogue now has a published development dataset with exact product identities and source-aware specifications and ratings. A classic comparison must reuse that evidence without merging years/variants or manufacturing a common score. The eventual assistant should request the same established components rather than supply arbitrary markup or new factual values.

Sprint 02 implements the deterministic UI boundary only. It does not connect a model, add chat, create a database schema, mutate source records, deploy publicly or authorize paid calls. The delivery order in the broader MVP remains a proposal; approval of this bounded sprint does not accept every future milestone or unresolved decision.

## Decisions

### 1. A comparison is two exact IDs in one published release

Use `/porownaj` with `left`, `right` and `release` query parameters for a completed comparison. The values identify two distinct catalogue entries and one dataset version; model names, family names and guessed years are not identifiers. Empty/incomplete selection is a visible navigation state, not a comparison with inferred products.

Keep selection limited to two IDs. The URL is the reproducible representation of a complete comparison. `ComparisonProvider` also stores `releaseId` and up to two `{ id, label }` entries in `sessionStorage` under `padlownia:comparison:v1` so native GET search navigation does not lose selection. Labels are display hints, not authoritative identities or facts. Stored input is strictly parsed, bounded and treated as untrusted; actual ID membership and release validity remain server checks. If browser storage is unavailable, selection continues in memory.

A server-validated complete URL replaces an older session pair through `RememberComparison`. Removing or clearing items does not immediately re-add them from the still-open comparison: remembering responds to the validated URL props, not every context change. A stale saved release is retained for explicit recovery rather than silently mixed with new items. No account, server-side selection table, source-value cache or new schema is involved.

The comparison reader uses the existing published catalogue boundary. Validate both IDs and the requested release against one current catalogue result before rendering. Never query staging or select an arbitrary historical release because a client supplied its ID. If publication changes, a stale comparison shows an explicit recovery state; it must not silently combine old selection metadata with new factual values. Historical-release rendering can be designed separately if later required.

### 2. Contract v1 contains references; the application supplies facts

The runtime schema in `apps/web/lib/view-contract.ts` uses `version: 1`, `datasetVersion` and one to twelve blocks. IDs are exact, untrimmed opaque tokens up to 128 characters. Version 1 allows only:

| Block type | Meaning |
|---|---|
| `racket_card` | Render the shared summary of `racketId` |
| `racket_specs` | Render the shared specification/evidence view of `racketId` |
| `racket_comparison` | Render exactly two distinct `racketIds` |

Blocks carry only their permitted identifying fields. Producer-supplied specifications, scores, source URLs, citations, HTML, JavaScript and arbitrary component names are rejected. Strict object validation rejects extra properties and unsupported versions/types rather than silently stripping material that could conceal an incorrect contract. Bounds are executable constants with regression tests.

TypeScript types alone do not validate input. Parse the payload at runtime, then resolve its IDs against the current published catalogue and require matching `datasetVersion` before passing hydrated values to React. A valid syntactic ID that is absent from the dataset remains invalid. A valid old release does not authorize rendering old or draft data through this route. Fixture examples resolve exclusively against their explicitly labelled synthetic catalogue and version.

This prevents a future model from inventing values inside these three blocks. It does not claim to solve future free-text grounding, retrieval selection or model safety: those features are absent and need their own contracts/evaluations. No future AI endpoint is enabled by adding the schema.

### 3. Share renderers, evidence presentation and semantic tokens

Catalogue, profile, comparison and structured-view rendering use common components for product identity, summary cards, specifications, source ratings, citations and states. Keep colors, typography, spacing, borders and focus behavior in the shared token layer. Preserve the current visual direction; extracting components is a refactor of presentation, not a second source of product facts.

Hydrated components receive approved catalogue values and their provenance. They preserve raw/contextual observations, missing values, conflicts, distinction between manufacturer declarations and specimen measurements, source-specific scales/methodologies and license/attribution requirements. Unknown year remains explicit. A side-by-side view does not justify averaging ratings, unit guessing, cross-source ranking or declaring a winner.

Mobile presentation must preserve which product each value belongs to while keeping controls keyboard accessible and text readable. Verify contrast, visible/unobscured focus, reduced-motion behavior and lack of page-level overflow. Use the vendored UI UX Pro Max guidance and the existing design workflow; recommendations cannot replace accepted source/evidence rules.

### 4. Make component states inspectable without private source data

`/komponenty` is a labelled fixture gallery using the same evidence/detail components and structured renderer. It demonstrates complete/missing parameters, unknown year/unit, declaration versus specimen measurement, conflicts, independent rating scales and missing/error states. Its visible structured payload example is specifically `racket_specs`; it is not a gallery of every block. The real `/porownaj` route exercises `racket_comparison`, while renderer tests cover all three supported types. The gallery also demonstrates the shared empty-selection component and stale-release message; the actual selection and recovery forms remain on the comparison route.

No real source snapshot, correspondence, private document or database credential is needed to view the gallery. It does not read Dev, including when the main catalogue is in Supabase mode. It is not a raw-data explorer or an editor for published facts.

The gallery helps detect drift between classical and future structured UI paths. It is a lightweight page in the existing app, not another hosted service or a new paid tool. Test fixture demonstrations separately from a read-only smoke check of the real Dev catalogue.

## Validation plan

Contract tests cover allowed blocks, exact field sets, version checks, invalid/unknown IDs, duplicate comparison IDs, input limits and stale releases. Comparison tests cover selection transitions and URL reproduction, precise year/variant separation, source scales, unknowns and conflict/provenance preservation. Shared-component tests protect existing catalogue/profile behavior and untrusted-label rendering.

Browser checks cover keyboard navigation, visible focus, selection/removal, mobile portrait/landscape, empty/error/stale states and automated axe checks; representative screenshots use synthetic data. A separate read-only Dev check verifies a pair from the currently published dataset without staging, publishing or changing DB/Storage. The [Sprint 02 execution receipt](../development/SPRINT_02_RESULTS.md) records final results separately from this architecture record; [test coverage](../development/TEST_COVERAGE.md) maps the assertions.

Independent read-only code review found a P2 form-state defect: after removing the right racket and following a same-route Next link, an uncontrolled select could retain the old right-hand value despite new partial-selection props. The form is now keyed by the validated release, IDs and state. A browser regression exercises this transition, explicit URL precedence over a saved pair and clearing selection without automatic re-addition. This was ordinary independent code review, not an Impeccable audit.

## Consequences and deferred questions

The reference-only contract reduces duplicate presentation and limits where factual values enter the UI. Dataset pinning makes changed-publication behavior explicit, but old comparison links require recovery rather than silently displaying newer facts. URLs store product IDs/version, not credentials or copied content. No schema migration or server-side selection persistence is needed.

The verified permission review covers the current attributed catalogue/comparison. No owner decision blocks this bounded implementation. Full-text republication, photos, downloadable source datasets, persistent embeddings and full-text transfers to external providers remain future scope questions; see [SOURCE_PERMISSION_REVIEW](../development/SOURCE_PERMISSION_REVIEW.md). Model choice, retrieval/eval thresholds and public-demo access design likewise remain unresolved outside this sprint.

Impeccable is not installed in the project as inspected on 2026-10-15. A later independent Impeccable review must not be claimed until the skill is available and actually used. No installer or hooks are introduced by this ADR. Final implementation differences should update this document without silently changing accepted product decisions.
