# Padłownia — katalog rakiet do padla

Polski katalog z wyszukiwaniem, profilami dokładnego wariantu i rocznika oraz pochodzeniem parametrów i ocen. Sprint 01 dostarczył aplikację Next.js, osobny worker TypeScript i wersjonowany pipeline ingestion. Sprint 02 dodaje klasyczną porównywarkę dwóch rakiet, wspólne komponenty i tokeny oraz walidowany kontrakt widoku. Chat AI pozostaje kolejnym etapem; obecne funkcje nie wykonują wywołań LLM.

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

## Porównywarka i wspólne UI

Na karcie katalogu lub w profilu wybierz „Dodaj do porównania”. Można wybrać maksymalnie dwie różne rakiety; przed dodaniem trzeciej usuń jedną z pary. [Porównywarka](http://127.0.0.1:3000/porownaj) pozwala też wybrać oba dokładne modele, warianty i roczniki w formularzu. Zestawienie zachowuje braki, rozbieżności, obserwacje egzemplarza i odrębne skale ocen źródeł; nie wylicza zbiorczej punktacji.

Odnośnik `/porownaj?left=ID&right=ID&release=RELEASE_ID` przypina parę do jednego wydania. Dane są odczytywane z aktualnie opublikowanego katalogu; starsze wydanie wymaga jawnego „Porównaj w aktualnej wersji”. Nie następuje cicha podmiana danych. Wybór przetrwa przejście przez profil, wyszukiwanie i odświeżenie w tej samej karcie dzięki `sessionStorage`, które przechowuje tylko ID, release i etykiety do wyświetlenia. Fakty i pochodzenie zawsze pochodzą z ponownie zweryfikowanego odczytu. Poprawny jawny URL kompletnej pary ma pierwszeństwo nad starszą sesją; po wyczyszczeniu koszyka otwarty widok nie dodaje sam pary ponownie.

[Galeria komponentów](http://127.0.0.1:3000/komponenty) pokazuje syntetyczne parametry, pomiary, konflikty, skale ocen i stany braków/błędu. Działa na fixture także wtedy, gdy katalog czyta Supabase. Zawiera przykład `racket_specs` przez ten sam renderer, którego klasyczna porównywarka używa dla `racket_comparison`. Kontrakt v1 obsługuje również `racket_card`; przyjmuje wyłącznie referencje ID i `datasetVersion`, bez dostarczonych przez model wartości, HTML czy cytowań. Nie uruchamia to chatu, modelu ani płatnego API.

Zakres i wybory techniczne: [brief Sprintu 02](docs/development/SPRINT_02_BRIEF.md), [ADR-005](docs/adr/005-comparison-and-structured-view-contract.md), [projekt wspólnego UI](docs/design/SPRINT_02_DESIGN.md). [Raport wyników Sprintu 02](docs/development/SPRINT_02_RESULTS.md) dokumentuje zaliczone 366 testów Vitest, 10 testów przeglądarkowych oraz 11 oddzielnych sprawdzeń bieżącego Supabase Dev.

## Supabase Dev i źródła

Właściciel potwierdził projekt **padlownia**, ref `kfdegaowpanatofnqvpy`, jako wyłącznie developerski. Zastosowano wersjonowany schemat, prywatne buckety `source-snapshots` i `review-originals` oraz dedykowane loginy aplikacji/workera. Zweryfikowano połączenie DB przez ograniczone role i TLS oraz rzeczywisty zapis, odczyt z kontrolą SHA-256, replay i odmowę publicznego dostępu do obu bucketów. Instrukcje połączenia, importu, release gate, backupu i resetu: [SETUP](docs/development/SETUP.md).

Next.js korzysta z dedykowanego readera i pokazuje wyłącznie aktywny, zatwierdzony release. Katalog Dev zawiera **444 profile z 498 rekordów źródłowych**; wszystkie 320 pierwotnych wyjątków mają rozstrzygnięcie. Wynik ponownego przetwarzania, publikacji i testów: [raport przeglądu źródeł](docs/development/SOURCE_REVIEW_RESULTS_2026_10_14.md). [Raport importu](docs/development/SOURCE_IMPORT_RESULTS_2026_10_14.md) i [raport Sprintu 01](docs/development/SPRINT_01_RESULTS.md) zachowują wyniki wcześniejszych etapów.

Właściciel dostarczył rzeczywiste snapshoty do ignorowanego `sources/`: **281 rekordów PadelTrue i 217 padel.how**. Adaptery `1.2.0` uwzględniają ich rzeczywiste struktury, jawne definicje jednostek oraz oryginalne wartości i kontekst pomiaru. To liczby rekordów wejściowych, nie potwierdzonych unikalnych lub opublikowanych produktów. Szczegółowy eksport padel.how jest wybranym wejściem; jego kopii i lżejszego eksportu nie importujemy jako dodatkowych rakiet. Pliki źródłowe są tylko do odczytu i nie trafiają do publicznego repozytorium.

Przejrzano wszystkie **320 pozycji pierwotnej kolejki**: 48 otrzymało korekty normalizacji, a 272 udokumentowane ograniczenia. Akceptacja ograniczenia zachowuje nieznany rok, konfigurację lub rozbieżność; nie tworzy brakujących faktów. Rozstrzygnięcie pojedynczego rekordu zapisuje uzasadnienie, lokalizacje dowodów i hashe, zachowując oryginalne dane. Poprawiona interpretacja powstaje w nowym runie, a zastąpiony nieopublikowany run nie może później zostać opublikowany.

Odnaleziono pisemną zgodę padel.how na opisany katalog porównawczy i potwierdzono CC BY 4.0 dla danych PadelTrue. [Przegląd praw](docs/development/SOURCE_PERMISSION_REVIEW.md) określa zakres i atrybucję; ponowna zgoda właściciela na sam katalog nie jest blokadą. Pełne teksty, zdjęcia i przyszłe przetwarzanie modeli mają odrębny zakres. Przegląd danych i praw nie zastępuje technicznych bramek release ani jawnej publikacji.

Dwa pliki „LLM” zawierają indeks źródła i **588 dokumentów**, w tym wszystkie 217 recenzji. Przeprowadzono [audyt treści, powiązań i ograniczeń](docs/development/KNOWLEDGE_SOURCE_AUDIT.md), pobrano 29 wskazanych szczegółowych JSON-ów i zapisano prywatnie oryginały oraz manifesty 31 zasobów / 618 dokumentów. Worker `npm run knowledge -- --help` udostępnia profilowanie, lokalne wyszukiwanie z cytowaniami, kontrolowane pobieranie i staging. Jest to materiał do przeglądu; nie jest jeszcze bazą opublikowanego chatu ani embeddingów.

## Sprawdzenie zmian

Poprawka UX porównania dodaje tekstowe wyszukiwanie z podpowiedziami i zwarty ekran obu rakiet z kolorami/paskami ocen. [Opis i wyniki](docs/design/COMPARISON_UX_REFINEMENT.md). Rzeczywiste fotografie czekają na potwierdzenie praw; [dokładny brakujący zakres i gotowy tekst prośby](docs/development/IMAGE_ASSET_POLICY.md). Opcjonalny serwerowy `CATALOGUE_IMAGE_MANIFEST` pozwala dołączyć zatwierdzone zdjęcia bez zmiany układu. Fixture używa własnej ilustracji CC0, wyraźnie opisanej jako syntetyczna.

```sh
npm run check
npm run test:e2e
```

`check` uruchamia typecheck, lint, testy Vitest i build Next.js. Testy przeglądarkowe domyślnie korzystają z zainstalowanego Microsoft Edge; alternatywa Chromium i konfiguracja CI są opisane w [SETUP](docs/development/SETUP.md#testy). CI nie potrzebuje sekretów ani dostępu do Supabase. Mapa scenariuszy i ograniczeń: [TEST_COVERAGE](docs/development/TEST_COVERAGE.md).

## Struktura

| Katalog | Odpowiedzialność |
|---|---|
| `apps/web` | Next.js App Router, katalog, profile, porównania, galeria fixture i wspólny kontrakt widoku; odczyt DB wyłącznie po stronie serwera |
| `apps/worker` | CLI: profilowanie plików, prywatne snapshoty, staging i jawne operacje publikacji |
| `packages/domain` | Kontrakty, connectory, normalizacja, Entity Resolution i wybór parametrów |
| `packages/database` | PostgreSQL, read model, release gate, lokalny PGlite |
| `supabase/migrations` | Schemat, RLS, role i prywatny Storage |
| `tests` | Testy domeny, workera, DB i UI; wyłącznie syntetyczne fixture'y |

## Dokumentacja i zasady

- [Decyzje produktowe](docs/product/DECISIONS.md), [produkt](docs/product/PRODUCT.md) i [MVP](docs/product/MVP.md).
- [Sprint 01](docs/development/SPRINT_01_BRIEF.md) i [techniczne decyzje implementacji](docs/adr/002-sprint-01-implementation.md).
- [Sprint 02](docs/development/SPRINT_02_BRIEF.md), [kontrakt porównania](docs/adr/005-comparison-and-structured-view-contract.md) i [wspólny UI](docs/design/SPRINT_02_DESIGN.md).
- [Proponowana architektura całości](docs/architecture/OVERVIEW.md), [model danych](docs/architecture/DATA_MODEL_V0_1.md) i [kontrakty ingestion](docs/architecture/INGESTION_DESIGN_V0_1.md).
- [Rzeczywisty kontrakt connectorów](packages/domain/README.md), [operacje bazodanowe](supabase/README.md), [projekt UI](docs/design/SPRINT_01_DESIGN.md) i [AGENTS.md](AGENTS.md).

Repozytorium jest publiczne. Sekrety, prawdziwe `.env`, prywatne eksporty bazy i zewnętrzne zbiory/artykuły pozostają poza Git. Surowe dane i historia ingestion nie są publicznym API. Import nie publikuje danych automatycznie; niepewne dopasowania, brak zgody źródła lub niekompletny snapshot blokują release. Sprint 01 nie wykonuje płatnych wywołań LLM, nie wdraża produkcji i nie scala PR automatycznie.
