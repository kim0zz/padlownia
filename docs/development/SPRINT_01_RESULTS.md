# Sprint 01 — raport wykonania

Stan: 2026-10-14. Gałąź `feat/sprint-01-foundation-catalogue`. Kod przygotowany do przeglądu; **Sprint nie jest w pełni zamknięty**, ponieważ rzeczywisty import źródeł i publikacja katalogu Dev pozostają zablokowane. Issue #1 pozostaje otwarte. Bez automatycznego merge'a.

## Dostarczony zakres

- Next.js + TypeScript, npm workspaces, osobny worker oraz wspólne moduły domeny i bazy.
- Dwa adaptery plikowe, wspólny kontrakt, walidacja, normalizacja, dokładne Entity Resolution i kolejka wyjątków. Weryfikacja adapterów obejmuje **syntetyczne fixture'y**, nie rzeczywiste feedy.
- Niezmienne snapshoty, przetwarzanie wersjonowane per run, idempotentne wznowienia, drafty, release gate, jawna akceptacja, atomowe przełączenie i rollback. Ponowne parsowanie wersjonuje także identyfikator i URL źródła.
- Wyszukiwanie, filtry oraz profile wariantu/rocznika z pochodzeniem parametrów, rozbieżnościami i osobnymi ocenami źródeł. UI UX Pro Max zastosowano zgodnie z [notatką projektową](../design/SPRINT_01_DESIGN.md); dostępne są [zrzuty desktop/mobile](../design/screenshots/).
- Zweryfikowane połączenia workera i serwera Next.js z rzeczywistym Supabase Dev. Zasady produktowe pozostają niezmienione; odwracalne decyzje techniczne opisuje [ADR-002](../adr/002-sprint-01-implementation.md).

Kolejność prac wynikała z zależności: kontrakty i normalizacja → model danych/provenance → staging i release gate → ograniczony reader → UI. Model rozdziela surowy rekord od interpretacji konkretnej wersji parsera; dzięki temu poprawka parsera nie nadpisuje wcześniejszej publikacji. Nie przyjęto fikcyjnego progu dopasowania ani nie scalono wariantów bez dowodu.

## Wyniki wykonanych kontroli

Środowisko lokalne: Windows, Node.js 24.15.0, npm, Next.js 16.4.0. Testy bazy używają PostgreSQL PGlite z minimalnym lokalnym shimem Storage; nie są testami Supabase Storage HTTP.

| Polecenie / kontrola | Wynik |
|---|---|
| `npm run check` | PASS: typecheck, ESLint, **119 testów w 11 plikach**, build Next.js |
| `npm run test:e2e` | PASS: **3/3**, Microsoft Edge przez Playwright; klawiatura, profile, filtry, stany danych, brak poziomego overflow i axe WCAG A/AA |
| `npm install --package-lock-only --ignore-scripts` | Lockfile aktualny, audit: **0 znanych podatności** w chwili wykonania |
| `npm run worker -- demo` | Lokalna pełna ścieżka: 2/2 poprawne, 0 błędnych, gate PASS, 2 opublikowane syntetyczne rakiety |
| Ponowne `npm run worker -- demo` | `replayed=true`, te same run/release ID, 2 rekordy; diff 0 dodanych / 0 zmienionych / 0 usuniętych |
| `npm run worker -- check-dev` | Rzeczywiste połączenie Dev; `padlownia_ingest`, `can_bypass_rls=false`, poprawny marker projektu |
| `npm run worker -- catalogue --target dev` | Poprawny odczyt, `entries=[]`; brak opublikowanych danych, bez fallbacku |
| Przeglądarka → Next.js → reader Dev | HTTP 200, tryb `supabase`, komunikat „Pierwsza publikacja jeszcze przed nami.”; bez fixture |
| Supabase security advisor po ostatniej migracji | 0 zgłoszonych problemów |
| Kontrola sekretów przed commitem | 143 pliki w indeksie Git i 13 plików client build: brak znanych haseł runtime, wzorców tokenów i kluczy prywatnych; env pozostają ignorowane |
| Zgodność SQL schematu z Dev | Wszystkie 6 sum znormalizowanego SQL zgodne z zapisanymi migracjami Dev; dwa jawne markery operacyjne wyłączone z porównania treści |

Pierwsza końcowa próba E2E zatrzymała się na blokadzie drugiego serwera Next.js (w tle działał test połączenia Dev). Zatrzymano własny serwer i powtórzono cały zestaw E2E: 3/3 PASS. Nie pominięto testów. Automatyczny axe nie zastępuje pełnego audytu dostępności; Impeccable nie był zainstalowany ani uruchomiony.

Szczegóły scenariuszy ING-001–ING-032, pokrycie częściowe i niewykonane granice: [TEST_COVERAGE](TEST_COVERAGE.md). Testy obejmują m.in. niekompletny import, odmowę publikacji, niejednoznaczne identity, atomowość przy wstrzykniętym błędzie SQL, rollback, ochronę historii, uprawnienia oraz poprawkę provenance przy zmianie parsera.

## Faktyczne metryki profili syntetycznych

| Plik / komenda | Deklarowane / rzeczywiste / sparsowane | Poprawne / błędne / do review | Uwagi |
|---|---|---|---|
| `padeltrue.synthetic.json`, `worker profile --source padeltrue --file tests/fixtures/padeltrue.synthetic.json` | 2 / 2 / 2 | 2 / 0 / 0 | Brak zgłoszonych problemów kontraktu |
| `padelhow.synthetic.json`, `worker import --source padelhow --file tests/fixtures/padelhow.synthetic.json --dry-run` | 2 / 2 / 2 | 0 / 0 / 2 | `unknown_unit=1`, `invalid_level_category=1`, `wrong_semantic_field=1` |

SHA-256 PadelTrue fixture: `9a01aa2b867f48cdf7eb527ad3bce91c7fd613253b0b9e8fa899618a05272a1d`.
SHA-256 padel.how fixture: `d1bbadafc13f7a490e87ea95b525e9b6b97f28a1c0993765c3f95817d9978695`.
Parser/normalizer: `1.0.0`. Gold ER: 12 pozytywnych i 14 trudnych negatywnych par; testy nie wykryły fałszywego scalenia w tym **syntetycznym** zbiorze. Historyczne 268/217 nie są wynikami tego sprintu.

## Zmienione zasoby Supabase Dev

Właściciel jawnie potwierdził projekt `padlownia`, ref `kfdegaowpanatofnqvpy`, jako Dev. Projekt był aktywny, plan Free. Modyfikowano wyłącznie ten projekt; bez zmian produkcji, planu i rozliczeń.

- Schemat `padlownia`: **19 tabel, RLS włączone na wszystkich**.
- Prywatne buckety `source-snapshots` oraz `review-originals`, limit 50 MiB. `public=false`; restrykcyjne polityki dla ról browserowych.
- Dedykowane role `padlownia_web` i `padlownia_ingest`: LOGIN, bez superuser i BYPASSRLS. Anon nie ma USAGE schematu. Reader ma EXECUTE ustalonego read modelu, bez SELECT surowych rekordów. Worker nie ma bezpośredniego UPDATE aktywnego wskaźnika.
- Niezmienny marker środowiska `development` z potwierdzonym ref. Weryfikacja TLS i hosta pozostaje włączona; publiczny certyfikat CA pochodzi z oficjalnego źródła Supabase.
- Osobne credentials zapisano wyłącznie w ignorowanych lokalnych env. Tymczasową tabelę zaszyfrowanego przekazania credentials usunięto; usunięto także lokalny tymczasowy klucz prywatny i kopię kopert. Nie wypisywano haseł.
- **0 cloud ingestion runs, 0 opublikowanych rekordów** w chwili raportu. Zgody źródeł nie zostały samodzielnie rozszerzone.

| Wersja historii Dev | Zmiana |
|---|---|
| `20261013210945` | foundation |
| `20261013210947` | publication |
| `20261013210948` | worker privileges |
| `20261014052751` | runtime access i marker środowiska |
| `20261014052753` | indeksy |
| `20261014052903` | operacyjny provisioning loginów — marker historii w repo |
| `20261014053339` | usunięcie tymczasowych kopert — marker historii w repo |
| `20261014053715` | wersjonowane identyfikatory i URL źródła przy reprocessingu |

Sześć migracji schematu i dwa jawne markery operacyjne mają numery zgodne z historią Dev. Markery celowo nie odtwarzają oryginalnego operacyjnego SQL provisioningu; świeże środowisko wymaga osobnego bezpiecznego nadania credentials. Szczegóły i ograniczenie `supabase link`: [operacje bazy](../../supabase/README.md#migration-history-and-runtime-provisioning).

## Pozostałe blokady i decyzje właściciela

1. **Autoryzowane pełne snapshoty PadelTrue i szczegółowy padel.how `rackets.json`** wraz z pochodzeniem i zakresem zgody na prezentację. Nie są częścią repo ani nie były dostępne podczas implementacji. Potrzebne do sprawdzenia rzeczywistego formatu, aktualizacji adapterów w razie różnic oraz profilowania pełnego zbioru.
2. **Credential do prywatnego Storage**, przekazany bezpiecznie jako lokalne `SUPABASE_STORAGE_KEY`. Dostępny management connector i ograniczone loginy PostgreSQL nie udostępniają takiego klucza. Nie przesyłać go w Issue, PR ani wiadomości. Brak klucza zatrzymuje cloud import przed otwarciem połączenia DB.
3. Po odblokowaniu powyższego: hash-verified upload/readback, rzeczywisty test odmowy HTTP dla istniejącego prywatnego obiektu, staging pełnych plików, rozstrzygnięcie wyjątków/zgód, przegląd diff i jawna publikacja Dev. Dopiero wtedy można potwierdzić katalog zawierający rzeczywiste opublikowane dane.

Same flagi prywatności i RLS w SQL **nie są** testem odmowy pobrania istniejącego obiektu przez HTTP. Tego testu, cloud importu, cloud rollbacku i wyświetlenia realnych rekordów nie wykonano. Nie wyłączano zabezpieczeń, aby obejść blokadę.

## Odtworzenie i koszty

Instrukcje: [SETUP](SETUP.md). Na tym komputerze `npm run dev` korzysta z lokalnego pliku env i pustego read modelu Dev. Aby obejrzeć przykładowe profile, ustaw jawnie `CATALOGUE_MODE=fixture` w środowisku procesu. `npm run worker -- demo` pokazuje oddzielną lokalną ścieżkę DB od importu do publikacji.

Nie wykonano płatnych wywołań LLM ani scrapingu artykułów; nie dodano płatnej infrastruktury. Nie uruchomiono autonomicznych harmonogramów i nie wykonano merge'a. Ten raport nie zakłada, że lokalny PASS oznacza PASS GitHub Actions — wynik zdalnego CI należy sprawdzić przy PR.
