# Przekazanie kontekstu — Padłownia (stan na 15.10.2026, 16:15)

Dla nowej sesji Claude Code uruchomionej lokalnie na komputerze właściciela. Przeczytaj ten plik, potem `CLAUDE.md`, `AGENTS.md` i `docs/product/ROADMAP.md`.

## Kim jest właściciel i jak chce pracować
- Właściciel nie jest programistą. Komunikacja po polsku, prosto, bez żargonu; konkretne kroki, gdy musi coś zrobić sam.
- Nie wraca do Codexa. Claude jest tech leadem: planuje, deleguje mniejsze zadania tańszym modelom (subagenci), przegląda każdy wynik, pilnuje testów.
- Chce widzieć efekty: po zakończonym etapie wypychaj na `main` (tak poprosił 15.10). Przed zmianami w bazie Supabase Dev (migracje) zapytaj o zgodę.

## Pierwsze kroki w tej sesji
1. W folderze mogą leżeć niezacommitowane, **starsze** kopie plików na gałęzi `feat/sprint-02-comparison-components` (wgrane ręcznie przed podłączeniem GitHuba). Aktualny stan jest na `origin/main`.
   ```
   git stash push -u -m ux-v3-local
   git switch main
   git pull
   npm ci
   ```
   Po sprawdzeniu, że `main` działa, stash można usunąć (`git stash drop`) — zawiera to samo co `main`, w starszej wersji.
2. Uruchom bramkę: `npm run check` oraz `npm run test:e2e` (domyślnie Edge). Ostatni wynik: **493/493 Vitest, 28/28 e2e**, CI na GitHubie zielone.
3. Aplikacja: `npm run dev` → http://127.0.0.1:3000. Tryb danych bierze z `apps/web/.env.local` (u właściciela: `supabase`).

## Co zostało zrobione 15.10
- **Audyt UI/UX** i **przebudowa UX v3** (plan: `docs/design/UX_OVERHAUL_PLAN.md`, wynik: `docs/design/UX_V3_RESULTS.md`, zrzuty `docs/design/screenshots/v3/`): katalog z podpowiedziami i filtrami, kompaktowe karty, porównanie z oznaczaniem różnic i „Tylko różnice”, oceny obu rakiet w jednym wierszu, profil parametry|oceny, źródło pod ikoną „i” (`SourceInfo`), tokeny CSS i minimum 12 px.
- **Decyzja P-032** (warstwy informacji) i **O-002** (zgoda padel.how: indeksowanie, embeddingi, przetwarzanie modelem, krótkie cytaty z atrybucją) — w `docs/product/DECISIONS.md`.
- **Flaga `SHOW_DEV_DETAILS=1`** — dane techniczne (ID obserwacji, UUID wydania) tylko dla dewelopera.
- **Tryb `CATALOGUE_MODE=snapshot`** + `CATALOGUE_SNAPSHOT_PATH` — aplikacja czyta lokalny eksport `published_catalogue()` (plik w ignorowanym `.local/`), tylko w development.
- **Poprawki z prawdziwych danych:** polskie etykiety twardości/faktury/poziomu, tłumaczenie słowników, „Niezweryfikowane” jako neutralny znaczek (dotyczy ~36% wartości), „Źródła podają różne wartości” zamiast „Brak danych” przy rozbieżności.
- **Audyt backendu:** `docs/architecture/BACKEND_AUDIT_2026_10_15.md`. **Plan:** `docs/product/ROADMAP.md`.

## Najważniejsze fakty o danych (Supabase Dev, projekt `padlownia`, ref `kfdegaowpanatofnqvpy`)
- Aktywne wydanie `94f807c4-b78f-4394-be11-1d3ab00f3809`: 444 profile z 498 rekordów; tylko **54** rakiety mają dane z obu źródeł.
- `published_catalogue()` wykonuje się **~900 ms** i zwraca **5,7 MB**; web woła ją przy każdym żądaniu (nowa pula `pg` + TLS). Render strony z lokalnego eksportu: 20–50 ms.
- Duplikaty marek w danych: „Cork”/„Cork Padel”, „STARVIE”/„StarVie” (+ marki wielkimi literami).
- Projekt Dev jest wyłącznie developerski. Nie dotykaj innych projektów Supabase na koncie właściciela.

## Następny krok: Etap 1 z ROADMAP (szybki odczyt)
1. Zmierz TTFB `/`, `/rakiety/[id]`, `/porownaj` na Dev (baseline).
2. Singleton puli `pg` + cache katalogu kluczowany `active_release_id` (tanie zapytanie o ID wydania).
3. Migracja **addytywna**: osobne funkcje `published_catalogue_list()` i `published_racket(id)`; strony używają właściwej. **Zapytaj właściciela przed zastosowaniem na Dev.**
4. Kanoniczne nazwy wyświetlane i scalenie wariantów nazw marek w domenie/projekcji (`lib/display.ts` zostaje jako fallback).
5. Zmierz po; cel orientacyjny < 300 ms TTFB z ciepłym cache. Raport ≤ 1 strona.

Potem: Etap 2 (kandydaci dopasowań między źródłami + lokalny widok przeglądu), Etap 3 (chunki/embeddingi recenzji — zgoda jest), Etap 4 (asystent, limit 100 PLN/mies., kod zaproszenia, Vercel).

## Pułapki
- e2e nadpisuje śledzone `docs/design/screenshots/*.png`, a build zmienia `apps/web/next-env.d.ts` — przywróć przed commitem (`git checkout -- ...`), dopóki nie zrobisz R8 z audytu.
- Lokatory tekstowe w e2e filtruj `visible: true` (Suspense w trybie dev przejściowo dubluje treść) — helper `visibleText` w `tests/web/comparison.spec.ts`.
- CI działa na Ubuntu z innym fontem niż Windows — sprawdzaj brak poziomego przewijania przy 320/375 px.
- Na Windowsie pliki mają CRLF (autocrlf) — normalne, nie traktuj tego jako zmian.
- Nie commituj `.env*`, `.local/`, `sources/`. Klucze GPG i prywatne manifesty w `.local/` warto zabezpieczyć kopią poza laptopem (do zaproponowania właścicielowi).
