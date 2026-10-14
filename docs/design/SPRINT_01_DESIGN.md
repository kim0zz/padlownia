# Sprint 01 catalogue design

Implemented 2026-10-13. This document records reversible implementation choices, not new accepted product decisions.

## Skill verification

Read `.agents/skills/ui-ux-pro-max/SKILL.md`, `references/quick-reference.md` and `references/pro-rules.md` before implementation. Ran the vendored Python search without remote services:

```text
search.py "sports equipment catalogue evidence" --design-system -p Padlownia -f markdown
search.py "product catalogue data research" --design-system -p Padlownia -f markdown
search.py "search loading server components" --stack nextjs
search.py "keyboard focus visible filtering" --domain ux
```

The first design-system match proposed a sports marketing hero, red palette and animated blocks. The one permitted narrower retry proposed scroll storytelling and wellness styling. Neither pattern matched a source-rich racket catalogue; neither output was persisted as an authoritative design system. The applicable stack results were Next.js server components, server fetching and `loading.tsx`; the UX results were visible keyboard focus and unobscured focus. These were verified against this implementation. Other visual choices below are explicitly a custom fallback applying the skill's built-in accessibility, typography and spacing requirements.

## Implemented design system

- Editorial, restrained sporting character: warm off-white `#f7f8f4`, deep ink `#142e32`, lime action `#d2ef79`, white card surface, secondary text `#536467`.
- Semantic tokens centralized in `apps/web/app/globals.css`. One light theme; no untested dark-theme claim.
- Local Arial/Helvetica system stack. No remote font/image requests, no scraped racket photographs or fabricated brand assets.
- 4/8 px spacing rhythm, 12 px panel radius, 48 px primary controls, 44 px profile links, visible 3 px blue keyboard focus, native form controls.
- Responsive grid: three cards desktop, two tablet, one phone. Source strings and identity values wrap; native document scrolling. Reduced-motion media rule removes transitions.
- One classic GET search with brand, year and shape filters. The URL retains search state. Profile links preserve exact variant/year identities; missing year is explicit. No AI input or comparison action in this sprint.
- All data lives in server components, with a server-only PostgreSQL reader. The browser receives only published projections. Runtime database errors show an unavailable state and cannot trigger fixtures.
- Explicit `CATALOGUE_MODE=fixture` renders six CC0 authored synthetic examples with prominent notices on catalogue and profile. They use fictional TESTLAB products and unlinked `.invalid` evidence URLs. They are not real imported catalogue metrics.
- Source links beside each selected card value; profile includes raw observation, declaration/personal measurement/editorial distinction, provenance details, validation unknowns, conflicts and rating methodologies/scales. Manufacturer attribution must be marked verified before the unqualified declaration label appears.

## Before / after and verification

Before: documentation-only repository; no visible product screen. After: catalogue, shareable classic search, exact profile routes, publication/fixture notices, loading, setup, error, empty and missing-profile states.

Automated checks cover identity/year filtering, query bounds, source URL sanitation, raw zero/object rendering, manufacturer attribution, secure project/role/TLS configuration, fail-closed reads and no implicit fixture fallback. Browser screenshots and accessibility results are recorded in the sprint report after execution; this document does not claim unrun checks passed.

Executed locally on 2026-10-13:

- `npm run typecheck --workspace @padlownia/web`: passed.
- `npm exec eslint -- apps/web tests/web playwright.config.ts`: passed.
- `npm run build --workspace @padlownia/web`: passed with Next.js 16.4 and React 19.3. An initial failure exposed `.js` package re-export resolution in Turbopack; explicit `@padlownia/database/catalogue` and `/executor` runtime subpaths fixed it and avoid importing the local database/worker graph into the web application.
- `npm test -- tests/web/catalogue.test.ts tests/web/catalogue-server.test.ts`: 14 passed at first verification; later additions are recorded in the final sprint report.
- `npm run test:e2e`: 3 passed in local Microsoft Edge (Playwright Chromium), with fixture mode. Search, keyboard skip link, profile/year/variant disambiguation, measurement context, conflicts, empty and not-found states passed.
- axe automated WCAG 2/2.1 A/AA checks: zero reported violations for desktop catalogue, desktop profile and mobile catalogue after fixing definition-list child markup identified on the first audit. This is an automated baseline, not a complete manual accessibility certification.
- 375 px portrait and 812 px landscape: no horizontal overflow. Reduced-motion mode exercised. The interface has no continuous animation.
- Captured and visually inspected `screenshots/catalogue-desktop.png`, `catalogue-mobile.png`, `profile-desktop.png`, `profile-mobile.png`. Screenshots use clearly labelled synthetic fixtures; they are not evidence of a live cloud connection.

The Playwright config uses installed Edge by default on this Windows development machine. Set `PLAYWRIGHT_CHANNEL=chromium` after installing Playwright Chromium on another platform.

Impeccable is not installed. Its independent review is not represented as completed. No hooks, subscriptions or AI API calls were added by the UI work.
