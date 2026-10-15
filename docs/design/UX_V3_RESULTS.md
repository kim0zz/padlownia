# UX v3 — wyniki

Plan: [UX_OVERHAUL_PLAN.md](UX_OVERHAUL_PLAN.md). Zrzuty: `docs/design/screenshots/v3/` (fixture, serwer produkcyjny, bez `SHOW_DEV_DETAILS`).

## Co zmieniono

| Etap | Zakres |
|---|---|
| E0 | Flaga `SHOW_DEV_DETAILS` (`lib/dev-ui.ts`): ślad pochodzenia danych, identyfikatory obserwacji i wersji danych tylko w trybie deweloperskim. |
| E1 | Tokeny (`styles/tokens.css`), podział CSS na `base`, `ui`, `catalogue`, `profile`, `comparison`, `gallery`; komponenty `ui/`: `Badge`, `Notice`, `PageHeader`, `SourceInfo`, `StatBar`. |
| E2 | `lib/display.ts` i `lib/ratings.ts`: nazwy marki, modelu, wariantu i materiałów; skala i pozycja oceny. |
| E3 | Porównanie: nagłówek z tożsamością obu rakiet, wiersze z oznaczoną różnicą, „Tylko różnice”, oceny obu rakiet w jednym wierszu, grupy ocen według źródła. |
| E4 | Katalog: wyszukiwanie z podpowiedziami od 2 znaków, filtry z automatycznym wysłaniem, gęsta karta z ikoną źródła. |
| E5 | Profil: parametry i oceny obok siebie (`SpecTable`, `RatingGroups`), wszystkie obserwacje w sekcji rozwijanej. |
| E6 | Galeria `/komponenty` na nowych komponentach; usunięcie `SpecSummary`, `RatingCard`, `RatingCitation` i martwego CSS; `section-kicker` i `eyebrow` usunięte; `loading`, `not-found`, `error` w nowym wyglądzie; blok `racket_specs` widoku strukturalnego renderuje `SpecTable`; zrzuty i dokumentacja. |

## Zadania użytkownika

| # | Wynik | Dowód (test e2e) |
|---|---|---|
| U1 | spełnione | `catalogue.spec.ts`: „typing shows suggestions; ArrowDown + Enter opens the profile”, „one character shows no suggestions…” |
| U2 | spełnione | `catalogue.spec.ts`: „changing a filter submits the form without pressing "Szukaj"”, „weight, year and shape filters combine, with sorting and the clear link” |
| U3 | spełnione | `comparison.spec.ts`: „"Tylko różnice" hides identical rows…”, „comparison preserves source observations, specimen context, conflicts and unknown years” |
| U4 | spełnione | `catalogue.spec.ts`: „profile: parameters and ratings sit side by side…”, „profile: rating source popover, open observations…” |
| U5 | spełnione | `comparison.spec.ts`: „source popovers open from the keyboard, close with Escape…”; `catalogue.spec.ts`: „the whole card opens the profile, while the source popover…”; galeria: „fixture gallery exposes source scales…” |

## Wyniki uruchomionych testów (Chromium, nie Edge)

- `npm run check`: typecheck, lint i build bez błędów; Vitest 27 plików, 489 testów zaliczonych.
- `npx playwright test`: 28 zaliczonych.
- `npx playwright test --repeat-each 2`: 56 zaliczonych.

## Odstępstwa od planu i ograniczenia

- Geometria porównania: wysokość pierwszego ekranu mierzona progami 330 px (nagłówek) i 700 px (parametry) zamiast 160/600 — wymusza to komunikat „Dane demonstracyjne” w fixture i formularz wyboru rakiet.
- Karta katalogu na telefonie ma 195–246 px wysokości zamiast ≤180 px.
- Filtry katalogu na telefonie są jednym wierszem przewijanym poziomo.
- Przycisk w karcie i profilu nazywa się „Dodaj do porównania”, nie „+ Porównaj” (WCAG 2.5.3: nazwa dostępna musi zawierać widoczny tekst).
- Miniatury w karcie nie mają podpisu; kredyt zdjęcia jest w popoverze źródła.
- E2E uruchomiono w tym środowisku na Chromium (`PLAYWRIGHT_CHANNEL=chromium`), nie na Edge.
- Galeria nie pokazuje przycisku wyboru do porównania na kartach (`RacketCard comparable={false}`), żeby nie zmieniać wyboru użytkownika. Odnośnik „Zmień” w nagłówku porównania w galerii prowadzi do kotwicy, której na tej stronie nie ma.
