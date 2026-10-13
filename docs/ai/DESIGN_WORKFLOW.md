# UI/UX skill workflow — Padłownia

**Status:** Approved: use UI UX Pro Max first, later review with Impeccable. This document describes intended workflow, not completed interface implementation.

## Installed in this repository
- UI UX Pro Max project skill: `.agents/skills/ui-ux-pro-max/SKILL.md`, `scripts/`, `data/`, `references/`.
- Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- License: MIT; vendored license at `.agents/skills/ui-ux-pro-max/LICENSE`.
- Installed project copy of production assets (upstream `.claude/skills/ui-ux-pro-max/`); test fixtures omitted; script paths adapted for project-level Codex use. **Version is pinned by this project's git commit rather than auto-updated.** Review diffs before upstream updates.
- Python 3.x is required **only for the skill's local search scripts**; no API key or subscription required for the search. Run from repository root:

```bash
python .agents/skills/ui-ux-pro-max/scripts/search.py "sports comparison dashboard evidence citations" --design-system -p "Padlownia"
python .agents/skills/ui-ux-pro-max/scripts/search.py "responsive racket comparison table" --stack nextjs
python .agents/skills/ui-ux-pro-max/scripts/search.py "keyboard focus visible filtering" --domain ux
```

On Windows, use `py -3` if `python` is unavailable. Scripts are third-party code: review when updating. The skill is automatically discoverable in compatible Codex setups after checking out this repo; restart Codex after adding skills.

## Workflow
1. **Design input:** read `PRODUCT.md`, `MVP.md`, `DECISIONS.md` and current UI flows. Avoid replacing requirements with generic design trends.
2. **Design direction:** query UI UX Pro Max for a design system using product context (sports equipment catalogue, evidence-rich comparison, separate classic search and AI, Polish-first, mobile accessible).
3. **Implementation:** Codex creates shared tokens/components, implements one vertical slice with screenshots / verifiable UI behavior, and tests responsiveness, focus, loading/empty/error states and accessibility.
4. **Independent review after screen exists:** introduce **Impeccable** for audit / critique / polish. Keep its review output as concrete issues with priority and reproduction steps. Install only when entering UI review stage.
5. **Evaluate iteration:** compare usability, accessibility and visual quality before/after fixes. Document substantive design choices and intentional deviations.

## Future Impeccable install (NOT installed now)
Official upstream: https://github.com/pbakaus/impeccable

From local project root, after reviewing installer changes:

```bash
npx impeccable install --providers=codex --scope=project
```

Reload Codex. If hooks were installed, review and explicitly approve trusted project hooks in Codex `/hooks` before enabling them. Run Impeccable initialization/review only after the app has a real screen. It may generate project metadata; align it with our existing `docs/product/PRODUCT.md` instead of creating competing sources of truth.

## Safety
- Vendor no third-party branding assets unless separately licensed; font files should be fetched through normal deployment channels, not committed without rights.
- Do not commit source-data snapshots, API keys or actual user data.
- Avoid launching unreviewed auto-edit hooks or turning on paid model calls by installing design guidance.
