Zastąpione przez [UX v3](UX_V3_RESULTS.md).

# Sprint 02 comparison and shared UI

Update 2026-10-15: the owner-requested [compact UX refinement](COMPARISON_UX_REFINEMENT.md) replaces the large comparison hero, native selectors and spacious rows below. That document and the current screenshots describe the latest UI; this receipt retains the initial implementation and verification context.

Implemented 2026-10-15 within the owner-approved [Sprint 02 scope](../development/SPRINT_02_BRIEF.md). These are reversible implementation choices under [ADR-005](../adr/005-comparison-and-structured-view-contract.md), not acceptance of unrelated product proposals.

## Design workflow and continuity

The implementation used the vendored [UI UX Pro Max skill](../../.agents/skills/ui-ux-pro-max/SKILL.md). An initial sports-oriented design-system search suggested a marketing hero and red treatment that did not fit the existing evidence-rich catalogue. The narrower query `data comparison table catalogue accessible minimal` returned a minimal Swiss direction. Applicable guidance was clear hierarchy, restrained decoration, keyboard focus and responsive reading; the established Sprint 01 olive/lime palette and Arial system stack were retained. Targeted UX guidance informed visible keyboard focus and controls that remain usable on narrow screens. No remote fonts, product photographs or paid design services were introduced.

Before this sprint, the catalogue and profile already exposed source citations, raw context, unknowns and source-specific scores. After this sprint, those screens retain their visual direction and evidence while gaining selection controls. `/porownaj` presents two exact identities; `/komponenty` makes shared evidence states inspectable on synthetic data. The change does not introduce a separate visual language for a future assistant.

Impeccable was absent from the local skill inventory on 2026-10-15 and remains a planned reviewer. The ordinary independent code review and automated accessibility checks below are not an Impeccable audit.

## Shared foundation and components

The root layout loads [tokens.css](../../apps/web/app/tokens.css), the existing [globals.css](../../apps/web/app/globals.css) and new [components.css](../../apps/web/app/components.css). The catalogue/profile layout stays in the existing stylesheet; shared semantic values now live in the token file.

| Foundation | Implemented values |
|---|---|
| Surfaces and text | Paper `#f7f8f4`, white surface, ink `#142e32`, secondary text `#536467`, soft surface `#edf1e9` |
| Actions and states | Accent `#d2ef79`, hover `#c3e65c`, focus `#336eaa`, warning text `#714b18` on `#fff4de` |
| Borders | Surface line `#d8ded9`, control line `#83918c`, radii 6/12 px |
| Type | Arial/Helvetica/system fallback; shared 0.8125/1/1.25 rem text sizes, existing responsive heading scales |
| Spacing and controls | 4/8/12/16/24/32/48 px scale, 48 px primary controls, 44 px text controls, content width up to 1328 px |
| Interaction | Visible 3 px focus outline; 150 ms feedback token; existing reduced-motion rule removes transitions |

| Module | Shared responsibility |
|---|---|
| [catalogue.tsx](../../apps/web/components/catalogue.tsx) | Summary cards and selected specifications; existing fixture, setup and unavailable states |
| [evidence.tsx](../../apps/web/components/evidence.tsx) | Source/rating citations and licence notices, including methodology links with their remaining caveats |
| [racket-details.tsx](../../apps/web/components/racket-details.tsx) | Specification lists, individual observations, conflicts and source rating cards |
| [racket-comparison.tsx](../../apps/web/components/racket-comparison.tsx) | Two exact identities, aligned specification rows, observation details, independent source rating groups and release evidence |
| [structured-view.tsx](../../apps/web/components/structured-view.tsx) | Validate reference-only blocks, resolve catalogue entries and invoke the same card/specification/comparison components |
| [comparison-selection.tsx](../../apps/web/components/comparison-selection.tsx) | Add/remove controls, accessible selection tray, count, live feedback and navigation/session context |
| [comparison-state.tsx](../../apps/web/components/comparison-state.tsx) | Empty/partial selection and invalid/stale feedback shared by the comparison route and selected gallery examples |

The classic comparison route constructs the same `racket_comparison` block accepted by the structured renderer. The gallery's `racket_specs` example uses that renderer too. The renderer supplies actual values and provenance from the validated catalogue; the contract cannot provide replacement scores, source links or markup. All three block types have rendering tests, but the gallery does not demonstrate all three as separate panels. No model endpoint or AI interaction is present.

## Comparison interaction and evidence

Selection is limited to two different exact IDs. Add buttons have a product-specific accessible name and `aria-pressed`; the named tray exposes removal, clearing and a comparison link once two items are selected. A third addition produces feedback rather than silently replacing a product. The header count and the form show the current selection state.

The complete URL carries `left`, `right` and `release`. `sessionStorage` retains only bounded IDs, release and display labels across profile/search navigation in the same tab. It is untrusted navigation context, not a cache of specifications or a source of identity truth. A validated complete URL supersedes an older saved pair. Clearing selection does not immediately restore the pair from the still-open view. When browser storage is unavailable, in-memory selection still works.

The server validates both IDs against one current published catalogue. Empty, partial, duplicate, unknown, malformed and stale selections have explicit states. A stale release requires an explicit transition to the current version; historical facts are not silently replaced. Native GET selectors use visible labels for each model/variant/year and a form key derived from validated parameters, so same-route navigation also resets uncontrolled select values correctly.

Both columns retain exact variant and year, including unknown year. Each specification row names the field and repeats the column identity label. Unknown values and conflicts stay visible. Expandable observations retain the source, raw value, measurement context and release evidence. A specimen with an overgrip does not become a nominal specification; a value such as `~26.5` without a known unit stays unresolved. Ratings remain grouped by source with original scale and methodology. The interface does not average different scales or declare a winner.

At desktop widths, comparison identities and values remain in two aligned columns. Below 640 px the picker becomes one column and the tray stacks; the comparison itself keeps two narrower adjacent columns with wrapped text and repeated labels. The gallery changes from two columns to one. Native disclosure controls keep detailed evidence available without forcing every observation into the initial comparison view.

## Fixture gallery and review evidence

`/komponenty` reads authored synthetic fixtures regardless of the main catalogue mode. It presents complete/missing specifications, unknown year and unit, declared versus specimen values, a conflict, distinct 8/10 and 65/100 scales, a missing score, and simulated empty/error states. It also shows the shared empty-selection component and stale-release feedback; the working recovery form remains on `/porownaj`. Its visible JSON example is specifically `racket_specs`. The gallery does not read private Dev originals or expose Storage paths.

The synthetic screenshot set contains [desktop comparison](screenshots/comparison-desktop.png), [mobile comparison](screenshots/comparison-mobile.png) and [desktop components](screenshots/components-desktop.png). Existing catalogue/profile screenshots provide the Sprint 01 visual reference. Screenshots illustrate fixtures, not proof of a live Supabase read.

Executed verification on 2026-10-15:

- `npm run check`: TypeScript, ESLint, **366 Vitest tests in 21 files**, and the production build passed. The new comparison/contract/component coverage contributes 166 tests: 101 comparison, 56 contract and nine shared-component tests.
- `npm run test:e2e`: **10/10 passed** in local Microsoft Edge, including seven new comparison/gallery tests and three catalogue/profile regressions. The final run took 17.1 seconds.
- Keyboard selection, the two-item limit, profile/search persistence, exact-year URL reproduction, empty/partial/duplicate/unknown/stale inputs, same-route removal, explicit URL precedence and clearing without re-addition are exercised.
- The browser suite checks 375 px portrait and 812 px landscape for overflow and runs axe against comparison/gallery states. These automated checks are a baseline, not a complete manual accessibility certification.
- Independent code review found a P2 same-route form-state regression. Keying the form by the validated release, IDs and state fixed the stale right-hand select; the browser suite now covers that transition.

A separate read-only smoke check passed **11/11 checks** at **2026-10-15 00:32:50 CEST** against the production build and Dev reader on localhost. It read 444 profiles from release `94f807c4-b78f-4394-be11-1d3ab00f3809`, verified a real two-source pair with 23 ratings and separate 0–10/0–100 scales, preserved unknown year/citations/licence/caveats, rejected unknown IDs, exercised explicit stale-link recovery, and checked desktop/mobile accessibility and overflow. Matching rating-category rows aligned within 1 px on mobile; axe reported no violations on the audited desktop/mobile views and no React page errors occurred. The gallery remained synthetic. Private execution evidence is kept outside Git. This is separate evidence from fixture E2E, not a deployment or DB mutation.

Actual mobile inspection prompted a presentation correction: align the same source and rating dimension in each two-column row so a long methodology note cannot offset the next dimension. All results above include that correction and its regression coverage. The [Sprint 02 execution receipt](../development/SPRINT_02_RESULTS.md) records final outcomes and limitations; [TEST_COVERAGE](../development/TEST_COVERAGE.md) maps the executable assertions.
