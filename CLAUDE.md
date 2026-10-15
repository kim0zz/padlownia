# CLAUDE.md

Read `AGENTS.md` first — its rules are binding. Current priorities: `docs/product/ROADMAP.md`. Latest audits: `docs/architecture/BACKEND_AUDIT_2026_10_15.md`, `docs/design/UX_V3_RESULTS.md`.

## Practical notes
- Gate before any hand-off: `npm run check` and `npm run test:e2e`. Report exact counts; never claim unrun checks.
- Browser: `PLAYWRIGHT_CHANNEL=chromium` (CI) or installed Edge (default). Optional `PLAYWRIGHT_EXECUTABLE=/path/to/chrome`.
- `SHOW_DEV_DETAILS=1` shows technical provenance (observation IDs, release UUID); Playwright sets it automatically.
- UI rules (P-032): values and warnings first; source one click away via `SourceInfo`; font sizes only via `var(--text-*)` (enforced by `tests/web/css-guard.test.ts`); no winner/aggregate scores in comparisons.
- e2e runs overwrite `docs/design/screenshots/*.png` and builds touch `apps/web/next-env.d.ts` — restore them before committing until roadmap item R8 is done.
- Keep docs short: one plan and one ≤1-page result per stage.
