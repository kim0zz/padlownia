# Padłownia — katalog rakiet do padla

Polski katalog z wyszukiwaniem, profilami dokładnego wariantu i rocznika oraz pochodzeniem parametrów i ocen. Sprint 01 dostarcza aplikację Next.js, osobny worker TypeScript, wspólne kontrakty danych i wersjonowany pipeline ingestion. Chat AI i porównywarka są kolejnymi etapami.

## Uruchomienie bez sekretów

Wymagany Node.js **22 LTS od wersji 22.13** albo **24 LTS**, oraz npm. Nie używaj nieparzystych gałęzi Node.js. W katalogu repozytorium:

```sh
npm ci
```

PowerShell:

```powershell
$env:CATALOGUE_MODE = 'fixture'
$env:APP_ENV = 'development'
npm run dev
```

macOS / Linux:

```sh
CATALOGUE_MODE=fixture APP_ENV=development npm run dev
```

Otwórz [lokalny katalog](http://127.0.0.1:3000). Tryb `fixture` wyraźnie oznacza fikcyjne dane demonstracyjne. Bez wybranego trybu aplikacja wyświetla instrukcję konfiguracji. Błąd połączenia z Supabase lub pusty opublikowany katalog nie przełącza aplikacji na przykłady.

Osobna demonstracja całego lokalnego pipeline'u:

```sh
npm run worker -- demo
npm run worker -- catalogue
```

`demo` zapisuje syntetyczny snapshot, wykonuje staging, walidację i publikację w lokalnym PostgreSQL PGlite w `.local/worker`. Nie łączy się z chmurą. Fixture UI i lokalny dataset workera są oddzielnymi demonstracjami; serwer aplikacji czyta opublikowane dane dopiero w trybie `supabase`.

## Supabase Dev i źródła

Właściciel potwierdził projekt **padlownia**, ref `kfdegaowpanatofnqvpy`, jako wyłącznie developerski. Zastosowano wersjonowany schemat, prywatne buckety `source-snapshots` i `review-originals` oraz dedykowane loginy aplikacji/workera. Rzeczywisty `worker check-dev` potwierdził połączenie przez ograniczoną rolę i zweryfikowany TLS. Instrukcje połączenia, importu, release gate, backupu i resetu: [SETUP](docs/development/SETUP.md). Dostęp do DB nie daje sam w sobie credentialu do Storage; jego brak nadal blokuje pełny cloud import.

Next.js przez dedykowany reader zwrócił HTTP 200 i rzeczywiście pusty katalog Dev, bez podstawiania fixture. Nie ma jeszcze opublikowanego rzeczywistego datasetu ani wykonanego testu HTTP Storage. Dokładne wyniki i pozostałe blokady: [raport Sprintu 01](docs/development/SPRINT_01_RESULTS.md).

**Pełne pliki PadelTrue i szczegółowy `rackets.json` padel.how nie były dostępne przy implementacji.** Connectory są sprawdzone na autorskich syntetycznych kontraktach; zgodność z rzeczywistymi feedami oraz import pełnych katalogów wymagają weryfikacji na autoryzowanych plikach. Historyczne liczby 268/217 nie są osiągniętymi wynikami importu.

## Sprawdzenie zmian

```sh
npm run check
npm run test:e2e
```

`check` uruchamia typecheck, lint, testy Vitest i build Next.js. Testy przeglądarkowe domyślnie korzystają z zainstalowanego Microsoft Edge; alternatywa Chromium i konfiguracja CI są opisane w [SETUP](docs/development/SETUP.md#testy). CI nie potrzebuje sekretów ani dostępu do Supabase. Mapa scenariuszy i ograniczeń: [TEST_COVERAGE](docs/development/TEST_COVERAGE.md).

## Struktura

| Katalog | Odpowiedzialność |
|---|---|
| `apps/web` | Next.js App Router, wyszukiwanie i profile; odczyt DB wyłącznie po stronie serwera |
| `apps/worker` | CLI: profilowanie plików, prywatne snapshoty, staging i jawne operacje publikacji |
| `packages/domain` | Kontrakty, connectory, normalizacja, Entity Resolution i wybór parametrów |
| `packages/database` | PostgreSQL, read model, release gate, lokalny PGlite |
| `supabase/migrations` | Schemat, RLS, role i prywatny Storage |
| `tests` | Testy domeny, workera, DB i UI; wyłącznie syntetyczne fixture'y |

## Dokumentacja i zasady

- [Decyzje produktowe](docs/product/DECISIONS.md), [produkt](docs/product/PRODUCT.md) i [MVP](docs/product/MVP.md).
- [Sprint 01](docs/development/SPRINT_01_BRIEF.md) i [techniczne decyzje implementacji](docs/adr/002-sprint-01-implementation.md).
- [Proponowana architektura całości](docs/architecture/OVERVIEW.md), [model danych](docs/architecture/DATA_MODEL_V0_1.md) i [kontrakty ingestion](docs/architecture/INGESTION_DESIGN_V0_1.md).
- [Rzeczywisty kontrakt connectorów](packages/domain/README.md), [operacje bazodanowe](supabase/README.md), [projekt UI](docs/design/SPRINT_01_DESIGN.md) i [AGENTS.md](AGENTS.md).

Repozytorium jest publiczne. Sekrety, prawdziwe `.env`, prywatne eksporty bazy i zewnętrzne zbiory/artykuły pozostają poza Git. Surowe dane i historia ingestion nie są publicznym API. Import nie publikuje danych automatycznie; niepewne dopasowania, brak zgody źródła lub niekompletny snapshot blokują release. Sprint 01 nie wykonuje płatnych wywołań LLM, nie wdraża produkcji i nie scala PR automatycznie.
