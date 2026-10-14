# Uruchomienie i operacje developerskie

Polecenia wykonuj z katalogu repozytorium w Node.js **22 LTS od wersji 22.13** albo **24 LTS**. Nieparzyste gałęzie Node.js nie są wspierane przez zestaw zależności projektu. `npm ci` korzysta z `package-lock.json`; nie wymaga konta Supabase ani klucza AI. W PowerShell, jeśli polityka wykonywania blokuje `npm.ps1`, użyj `npm.cmd` i `npx.cmd` w miejsce `npm` i `npx`.

## Szybki start bez chmury

```sh
npm ci
```

PowerShell:

```powershell
$env:CATALOGUE_MODE = 'fixture'
$env:APP_ENV = 'development'
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run dev
```

macOS / Linux:

```sh
CATALOGUE_MODE=fixture APP_ENV=development NEXT_TELEMETRY_DISABLED=1 npm run dev
```

Aplikacja słucha na [127.0.0.1:3000](http://127.0.0.1:3000). Pokazuje fikcyjne modele z oznaczeniem demonstracji, wyszukiwanie, filtry i profile z pochodzeniem danych. Dla wersji z buildem użyj `npm run build` i `npm start`, przekazując te same zmienne środowiskowe. Skrypty wiążą serwer z loopback; udostępnianie demo wymaga osobno uzgodnionej kontroli dostępu.

Zamiast zmiennych procesu można utworzyć **ignorowany** plik `apps/web/.env.local` z ustawieniami weba. Next.js uruchamia się w workspace aplikacji i nie czyta automatycznie `.env` z katalogu głównego. Worker czyta `.env` z katalogu głównego repozytorium. Nie kopiuj sekretu Storage ani danych workera do środowiska weba. `.env.example` jest szablonem z placeholderami.

## Lokalny worker i profilowanie

```sh
npm run worker -- --help
npm run worker -- profile --source padeltrue --file tests/fixtures/padeltrue.synthetic.json
npm run worker -- import --source padelhow --file tests/fixtures/padelhow.synthetic.json --dry-run
npm run worker -- demo
npm run worker -- catalogue
```

`profile` oraz `import --dry-run` nie zapisują bazy ani Storage. `import` bez `--stage` także wykonuje dry run. `--file` przyjmuje autoryzowany lokalny plik do 50 MiB; ścieżkę ze spacjami ujmij w cudzysłowy. Ten import katalogu nie pobiera źródeł z sieci ani nie wywołuje LLM. Osobne, jawne `knowledge fetch-reviews` pobiera wyłącznie wskazane adresy szczegółowych JSON-ów opisane niżej.

`demo` tworzy wyłącznie lokalny syntetyczny dataset w `.local/worker`: PGlite wykonuje migracje, zapisuje oryginalne bajty, normalizuje rekordy, ocenia gate i publikuje demonstrację. Ponowne uruchomienie demonstruje idempotencję. Polecenie odrzuca `--target dev`. Domyślny target pozostałych operacji to `local`.

Fixture'y `padeltrue.synthetic.json` i `padelhow.synthetic.json` zawierają celowe przypadki wymagające review; nie każdy przykład ma przejść gate. Czysta demonstracja używa `demo-clean.synthetic.json`. Fixture UI jest osobny od bazy workera, a UI nie ma trybu odczytu tej lokalnej bazy.

Właściciel dostarczył rzeczywiste pliki do `sources/`. PadelTrue ma 281 rekordów, a szczegółowy padel.how 217; adaptery `1.2.0` obejmują korekty wynikające z przeglądu tych plików. Są to liczebności wejścia, nie opublikowanego katalogu. `rackets.json` i `padel how base.txt` są identycznymi kopiami, a `data rackets.json` reprezentuje te same 217 modeli w lżejszym formacie. Wybierz szczegółowy `rackets.json` jako jedno wejście padel.how. Nie edytuj oryginałów ani nie dodawaj `sources/` do Git.

```sh
npm run worker -- profile --source padeltrue --file "sources/rackets padel true.txt"
npm run worker -- profile --source padelhow --file sources/rackets.json
```

Dla kolejnego snapshotu ponownie sprawdź [obsługiwany kontrakt](../../packages/domain/README.md), profil i hash; zmiana struktury wymaga jawnej wersji parsera. Aktualny wynik wykonania opisuje [raport przeglądu źródeł](SOURCE_REVIEW_RESULTS_2026_10_14.md), a [raport importu](SOURCE_IMPORT_RESULTS_2026_10_14.md) zachowuje wcześniejszy stan. Syntetyczne regresje pozostają niezależną, bezpieczną podstawą CI.

## Połączenie z potwierdzonym Supabase Dev

Właściciel potwierdził **padlownia**, ref **`kfdegaowpanatofnqvpy`**, jako środowisko developerskie. Nie przenoś tej autoryzacji na inny projekt. Schemat i dwa prywatne buckety zostały zastosowane w tym Dev. Dedykowane loginy zostały bezpiecznie skonfigurowane, a `worker check-dev` potwierdził rzeczywiste połączenie z ograniczoną rolą i weryfikacją TLS. Credentials są w ignorowanych lokalnych plikach, nie w Git. Dostęp administracyjny, odczyt DB, zapis Storage oraz publikacja danych są osobnymi krokami weryfikacji. Klucz Storage i rzeczywiste snapshoty są dostępne; [dowody praw katalogowych](SOURCE_PERMISSION_REVIEW.md) obu źródeł zostały sprawdzone. Gate wymaga ich zapisu oraz rozstrzygnięcia danych dla konkretnego release; sam import nie przyznaje praw.

Pierwsza próba Next.js z loginem readera zwróciła HTTP 200 i pusty katalog Dev bez fallbacku do fixture. Potwierdziła odczyt aplikacyjny, nie publikację rakiet. Web zawsze czyta wyłącznie aktywny release; bieżący stan publikacji i jego sprawdzenia opisuje [raport przeglądu](SOURCE_REVIEW_RESULTS_2026_10_14.md). Testy HTTP obu prywatnych bucketów potwierdziły zapis/odczyt z SHA-256, idempotentny replay, odmowę dostępu bez klucza i dla anonimowego klienta oraz usunięcie własnego obiektu testowego. Wyniki wcześniejszych etapów pozostają w [raporcie importu](SOURCE_IMPORT_RESULTS_2026_10_14.md) i [SPRINT_01_RESULTS](SPRINT_01_RESULTS.md).

### Role i credentials

| Proces | Login bezpośredni | Rola uprawnień | Dostęp |
|---|---|---|---|
| Next.js server | `padlownia_web` | `padlownia_reader` | Marker Dev i funkcja opublikowanego katalogu |
| Worker | `padlownia_ingest` | `padlownia_worker` | Staging i kontrolowane funkcje review/release |
| Storage workera | Uprzywilejowany secret key projektu | Uprawnienia serwerowe projektu; klucz nie jest ograniczony do bucketa | Worker wykorzystuje go do prywatnych obiektów i kontroli SHA-256 |

Migracja tworzy loginy jako `NOLOGIN`, bez haseł. Zaufany proces konfiguracji konkretnego Dev musi bezpiecznie nadać oddzielne sekrety i włączyć `LOGIN` — wykonano to w potwierdzonym projekcie, lecz nie będzie automatycznie wykonane na świeżej bazie. Nie używaj konta `postgres` ani loginu z `BYPASSRLS` dla aplikacji/workera. Nie zapisuj hasła w SQL w repozytorium, argumentach powłoki, logach ani treści PR.

Web potrzebuje wyłącznie ustawień readera:

```dotenv
APP_ENV=development
CATALOGUE_MODE=supabase
DEV_SUPABASE_PROJECT_REF=YOUR_CONFIRMED_DEV_PROJECT_REF
WEB_DATABASE_URL=postgresql://padlownia_web:YOUR_URL_ENCODED_READER_PASSWORD@db.YOUR_CONFIRMED_DEV_PROJECT_REF.supabase.co:5432/postgres?sslmode=verify-full
```

Worker potrzebuje osobnego środowiska:

```dotenv
APP_ENV=development
DEV_SUPABASE_CONFIRMED=true
DEV_SUPABASE_PROJECT_REF=YOUR_CONFIRMED_DEV_PROJECT_REF
SUPABASE_URL=https://YOUR_CONFIRMED_DEV_PROJECT_REF.supabase.co
DEV_DATABASE_URL=postgresql://padlownia_ingest:YOUR_URL_ENCODED_WORKER_PASSWORD@db.YOUR_CONFIRMED_DEV_PROJECT_REF.supabase.co:5432/postgres?sslmode=verify-full
SUPABASE_STORAGE_KEY=YOUR_AUTHORIZED_DEV_STORAGE_KEY
```

Wypełnij placeholdery tylko w bezpiecznym środowisku/ignorowanym pliku. Znaki specjalne hasła w URI wymagają percent-encoding. Jeśli sieć nie obsługuje bezpośredniego hosta DB, użyj dokładnego hosta Supabase poolera ze zweryfikowanego panelu i loginu `padlownia_web.PROJECT_REF` lub `padlownia_ingest.PROJECT_REF`; nie zgaduj regionu. Zachowaj `sslmode=verify-full`; dodatkowe parametry URL i osłabienie TLS są odrzucane. Nie ustawiaj `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Jeśli CA projektu nie znajduje się w systemowym magazynie Node, ustaw opcjonalne `SUPABASE_DB_CA_PEM` w środowisku weba/workera na publiczny certyfikat CA pobrany z panelu zweryfikowanego projektu. Certyfikat nie jest sekretem, ale jego pochodzenie musi być zaufane; nie akceptuj dowolnego certyfikatu tylko po to, żeby połączenie przeszło. W pliku `.env` użyj wartości PEM w cudzysłowach z zachowanymi rzeczywistymi podziałami wierszy. Pozostaw włączoną weryfikację łańcucha certyfikatów i nazwy hosta.

`SUPABASE_STORAGE_KEY` przyjmuje uprzywilejowany **secret key projektu** `sb_secret_…`; nie jest to klucz ograniczony do jednego bucketa. Adapter wysyła taki nie-JWT klucz wyłącznie w nagłówku `apikey`. Obsługiwany starszy klucz JWT jest wysyłany jako `apikey` oraz Bearer. Nie umieszczaj opaque secret w Bearer. Klucz publiczny/anon nie daje dostępu do prywatnych obiektów. Credentials muszą pozostać poza browser bundle, środowiskiem weba i zmiennymi `NEXT_PUBLIC_`.

Opcjonalny `SUPABASE_PUBLISHABLE_KEY` służy wyłącznie do testu odmowy dostępu anonimowej roli. Użyj publicznego publishable key tego samego projektu (albo starszego JWT roli `anon`); brak tej zmiennej jest raportowany jako pominięcie tego jednego testu. Nigdy nie przypisuj do niej secret key.

### Weryfikacja przed importem

```sh
npm run worker -- check-dev
npm run worker -- check-storage
npm run worker -- catalogue --target dev
```

`check-dev` tylko odczytuje DB: sprawdza konfigurację, niezmienny marker `padlownia.environment_identity` i brak `BYPASSRLS` aktualnego loginu. Nie jest testem Storage. `catalogue` czyta tylko zaakceptowany release; brak danych może być prawidłowym wynikiem. Web również sprawdza marker Dev. Błąd konfiguracji daje stan setup, błąd połączenia stan niedostępności; nie ma cichego fallbacku do fixture.

`check-storage` jest jawną operacją Dev: po sprawdzeniu markera bazy kolejno sprawdza `source-snapshots` i `review-originals`. W każdym tworzy własny unikalny obiekt syntetyczny, weryfikuje bajty i replay, sprawdza odmowę pobrania, a następnie usuwa wyłącznie ten obiekt i potwierdza jego brak. Nie uruchamiaj go z credentialami innego projektu. Szczegółowe wyniki wskazują sprawdzony bucket i ewentualnie pominięty test anonimowej roli.

## Migracje, staging i publikacja

Migracje w `supabase/migrations/` stosuje się w kolejności nazw przez uprawniony proces administracyjny wyłącznie w potwierdzonym Dev. Przed zapisem porównaj project ref, historię migracji i stan schematu. Zastosowanych plików nie edytuj; dodaj migrację. Shim Supabase z lokalnego PGlite nie może być uruchamiany w chmurze. Szczegóły: [supabase/README.md](../../supabase/README.md).

Snapshoty trafiają pod `source-snapshots/SOURCE/SHA256.json`; `review-originals/SOURCE/SHA256.txt` lub `.json` przechowuje oryginały wiedzy i szczegółów recenzji. Worker sprawdza prywatność bucketa i hash pobranych bajtów przed stagingiem. Polityki SQL odmawiają `anon` i `authenticated` dostępu; testy HTTP w potwierdzonym Dev dodatkowo sprawdziły brak publicznego i anonimowego odczytu.

Kontrolowany staging po profilowaniu autoryzowanego pliku:

```sh
npm run worker -- profile --source padeltrue --file /PRIVATE/PATH/snapshot.json
npm run worker -- import --source padeltrue --file /PRIVATE/PATH/snapshot.json --stage --target dev
```

Ścieżki i identyfikatory w przykładach są placeholderami. Import raportuje run/release ID i wyniki rekordów. **Nie publikuje.** Dla szczegółowego padel.how użyj `--source padelhow`.

```sh
npm run worker -- release --runs RUN_ID_PADELTRUE,RUN_ID_PADELHOW --target dev
npm run worker -- gate --release RELEASE_ID --target dev
```

Zgodę źródła i jej rzeczywisty zakres zapisuje kontrolowana funkcja DB `setSourcePermission`; CLI nie ma polecenia nadawania zgody. Dla obecnego katalogu istnieje pisemna zgoda padel.how oraz potwierdzona licencja PadelTrue — nie wymagają ponownego pytania właściciela. Prywatny manifest `.local/adjudication/source-permissions.json` zawiera `decisions[].permission` z referencją i zakresem; nie jest częścią świeżego klonu. Korespondencja pozostaje prywatna. Syntetyczna zgoda z lokalnego `demo` nie uprawnia do używania prawdziwych katalogów. Niekompletne snapshoty, błędy, niepewne dopasowania i niezaakceptowane review nadal blokują release.

### Przegląd pojedynczych rekordów i ponowne przetwarzanie

Pierwotne 320 pozycji kolejki przejrzano na podstawie źródeł: 48 zakwalifikowano do korekt normalizacji, a 272 do zachowania z opisanym ograniczeniem. Nie oznacza to 320 nowych produktów ani niezależnej weryfikacji każdego twierdzenia źródłowego. Nieznanego roku lub konfiguracji nie uzupełnia się domysłem; jawna akceptacja ograniczenia może zachować `null` i odrębną tożsamość.

Review pozostaje kontrolowaną operacją DB bez panelu admina i bez osobnego polecenia CLI. [`applySourceReview`](../../packages/database/src/review.ts) przyjmuje konkretny run/result, external ID, oczekiwany stan dopasowania, SHA-256 snapshotu, osobę przeglądającą, uzasadnienie i dowody `{sourceUrl, snapshotSha256, path, finding}`; zmiana tożsamości wymaga jawnego `identity`. Funkcja w transakcji sprawdza zgodność celu i głównego dowodu, odrzuca nieaktualny zapis oraz run przypięty do zatwierdzonego release. Zachowuje surowe i znormalizowane obserwacje, zapisując rozstrzygnięcie w kolejce i zdarzenie audytu. Dokładne powtórzenie tej samej decyzji jest idempotentne.

Korekta parsera/normalizatora wymaga nowej wersji i ponownego `import --stage` tych samych, niezmienionych bajtów. Wersja `1.2.0` tworzy własne wyniki; historia `1.1.0` pozostaje. Po pełnym przetworzeniu tego samego snapshotu `supersedeReviewedRun` może wycofać wyłącznie wcześniejszy niezatwierdzony run, wskazując jego następcę. Migracja chroni stan `superseded`: stary run nie może wrócić do przetwarzania ani przejść publikacji, a jego zamknięte pozycje mają dyspozycję `superseded_interpretation`. Nie jest to akceptacja wszystkich wyników następcy. Każdy jego wyjątek nadal wymaga własnego rozstrzygnięcia, a nowy draft pełnej oceny gate.

Prywatne plany i dowody przeglądu są w `.local/adjudication/`; nie publikuj ich wraz ze źródłami. Wynik zastosowania decyzji, ponownego przetwarzania Dev i ewentualnej aktywacji znajduje się w [bieżącym raporcie](SOURCE_REVIEW_RESULTS_2026_10_14.md). Nie zamieniaj tych kroków na masowe ustawienie statusów kolejki.

Po rzeczywistym przeglądzie liczebności, wyjątków, tożsamości modeli, pochodzenia i diffu:

```sh
npm run worker -- approve --release RELEASE_ID --actor REVIEWER --note "Reason and evidence for accepting this release" --explicit-yes --target dev
npm run worker -- publish --release RELEASE_ID --expected PRIOR_RELEASE_ID --actor REVIEWER --explicit-yes --target dev
npm run worker -- catalogue --target dev
```

Dla pierwszej publikacji użyj `--expected none`. Dla kolejnych podaj dokładny aktywny identyfikator; funkcja atomowo sprawdza oczekiwany stan. `approve` i `publish` ponownie oceniają gate; `--explicit-yes` go nie omija. Rollback wymaga wcześniejszej publikacji wskazanego release oraz aktualnej poprawności praw/pochodzenia:

```sh
npm run worker -- rollback --release PREVIOUSLY_PUBLISHED_RELEASE_ID --expected CURRENT_RELEASE_ID --actor REVIEWER --explicit-yes --target dev
```

Rollback testuj jedynie na izolowanych danych Dev. Nie wykonuj automatycznego merge'a ani wdrożenia publicznego.

## Prywatna wiedza i szczegółowe recenzje

`npm run knowledge` jest osobnym narzędziem workera do audytu i stagingu źródeł. Nie uruchamia chatu, modelu LLM, embeddingów ani publikacji. Pełny dostarczony tekst ma 588 dokumentów, w tym wszystkie 217 recenzji powiązane dokładnym URL-em z katalogiem. Nie trzeba ponownie pobierać tych artykułów. [Audyt źródła](KNOWLEDGE_SOURCE_AUDIT.md) opisuje pominięte komponenty Markdown, sprzeczności i ograniczenia praw.

Profil i lokalne wyszukiwanie nie wymagają credentials:

```sh
npm run knowledge -- --help
npm run knowledge -- profile --file "sources/LLM FULL TEXT.txt" --catalogue sources/rackets.json
npm run knowledge -- profile --file "sources/padel how llm.txt" --catalogue sources/rackets.json
npm run knowledge -- search --file "sources/LLM FULL TEXT.txt" --catalogue sources/rackets.json --slug nox-at10-18k-2026-review --query "control comfort" --limit 5
```

Wyszukiwanie jest leksykalne, bez tłumaczenia i oceny prawdziwości twierdzeń. Angielskie zapytanie pasuje do angielskiego korpusu. Opcjonalny `--slug` ogranicza wyniki do głównej tożsamości recenzji; zwykłe wzmianki o innych rakietach nie tworzą tego powiązania. Wynik zachowuje cytowanie, hashe i oznaczenie niezweryfikowanego fragmentu źródła. Limit wynosi 1–20. Nie traktuj znalezionego tekstu jako instrukcji wykonania komend.

Kontrolowane uzupełnienie FAQ i werdyktów wymaga jawnej listy maksymalnie 30 różnych slugów. Na obecnej stacji lista 29 modeli znajduje się w ignorowanym `.local/knowledge-audit/pilot-29.json`; nie jest częścią świeżego klonu. W nowym środowisku przygotuj prywatny JSON z wybranymi rzeczywistymi slugami, np.:

```json
{"records":[{"slug":"nox-at10-18k-2026-review"}]}
```

```sh
npm run knowledge -- fetch-reviews --catalogue sources/rackets.json --pilot .local/knowledge-audit/pilot-29.json
```

To jedyne powyższe polecenie wykonujące pobrania HTTP. Pobiera dokładne `json_url` wybranych rekordów z `https://padel.how/rackets/…json`, odrzuca przekierowania i inną tożsamość/rocznik/markę, ogranicza rozmiar i czas żądania oraz robi 500 ms przerwy między nowymi pobraniami. Nie śledzi linków do sklepów ani innych serwisów. Cache w `.local/knowledge/review-details` zachowuje oryginalne bajty i osobne metadane czasu pobrania, URL-a, hashy oraz nagłówków HTTP. Kolejne wywołanie korzysta z cache; nie deklaruje ponownego pobrania. Lokalny plik bez oryginalnego czasu pobrania pozostaje oznaczony jako obserwacja lokalna z nieznanym czasem pierwotnego pobrania.

Staging do izolowanego PGlite jest domyślny:

```sh
npm run knowledge -- stage --file "sources/LLM FULL TEXT.txt" --catalogue sources/rackets.json
npm run knowledge -- stage-reviews --catalogue sources/rackets.json
```

Staging do potwierdzonego Dev wymaga credentialów workera i Storage:

```sh
npm run knowledge -- stage --file "sources/LLM FULL TEXT.txt" --catalogue sources/rackets.json --target dev
npm run knowledge -- stage --file "sources/padel how llm.txt" --catalogue sources/rackets.json --target dev
npm run knowledge -- stage-reviews --catalogue sources/rackets.json --target dev
```

`stage-reviews` obejmuje wszystkie wcześniej pobrane pliki recenzji w prywatnym cache, maksymalnie 30. Staging zapisuje oryginały w `review-originals`, a w `knowledge_assets` / `knowledge_documents` wyłącznie niezmienne manifesty: lokalizacje, granice dokumentów, hashe i powiązania. Nie zapisuje pełnych artykułów w tabelach ani nie udostępnia manifestów readerowi weba. Replay jest idempotentny; zmieniona interpretacja wymaga nowej wersji parsera. Stan pozostaje `private_staging_unreviewed` i nie nadaje praw źródłu ani nie aktywuje katalogu.

Wykonany staging wiedzy obejmuje 31 zasobów / 618 dokumentów: dwa pliki LLM oraz 29 szczegółowych JSON-ów. Szczegóły dostarczyły 29 werdyktów, 137 odpowiedzi FAQ i 93 odnośniki porównań. Są to wyniki przetworzenia źródła, nie dowód poprawności wszystkich twierdzeń. [Raport tego importu](SOURCE_IMPORT_RESULTS_2026_10_14.md) oddziela tę część od katalogu; aktualny wynik przeglądu i release wskazuje [nowszy raport](SOURCE_REVIEW_RESULTS_2026_10_14.md).

Lokalna baza, lock i Storage wiedzy znajdują się w `.local/knowledge`, oddzielnie od `.local/worker`. Nie używaj jednego katalogu PGlite w równoległych procesach. Przy backupie zachowaj bazę, cache, metadane i oryginały. Nie publikuj tych plików w Git, logach ani artefaktach CI.

## Testy

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Łączny skrót to `npm run check`. Vitest obejmuje domenę, konfigurację/workera, profilowane formaty źródeł na wymyślonych rekordach, prywatne manifesty wiedzy, rozstrzyganie rekordów i ochronę zastąpionych runów w rzeczywistym SQL izolowanego PGlite. Sam zestaw lokalny nie potwierdza sieciowego połączenia z Supabase ani aktualnego stanu HTTP Storage. Wykonane kontrole chmury i pełnych prywatnych plików mają osobne wyniki w [bieżącym raporcie przeglądu](SOURCE_REVIEW_RESULTS_2026_10_14.md). Mapa ING-001–ING-032: [TEST_COVERAGE](TEST_COVERAGE.md).

Testy przeglądarki uruchamiają własny serwer fixture na porcie 3100; port musi być wolny. Domyślnie wymagają zainstalowanego Microsoft Edge:

```sh
npm run test:e2e
```

Alternatywnie zainstaluj Chromium Playwright:

```sh
npx playwright install chromium
```

PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm run test:e2e
```

macOS / Linux:

```sh
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

CI używa Ubuntu, Node 22 i `npx playwright install --with-deps chromium`, potem E2E z `PLAYWRIGHT_CHANNEL=chromium`. Nie przekazuje sekretów i nie łączy się z chmurą. Testy obejmują wyszukiwanie, profile, klawiaturę, stany puste/brak danych, responsive layout i automatyczny axe. Zrzuty powstają w `docs/design/screenshots/`; ponowne generowanie może zmienić śledzone pliki. Wyniki lokalne raportuj oddzielnie od GitHub Actions.

## Backup i reset

Zatrzymaj worker przed kopiowaniem `.local/worker`; PGlite nie powinien mieć dwóch procesów używających tego samego katalogu. Kopiuj cały katalog (baza i Storage) do prywatnego miejsca poza Git. Nie publikuj kopii ani prawdziwych snapshotów w artefaktach CI.

Lokalny reset można wykonać przez zachowanie starego katalogu pod nową nazwą i ponowne uruchomienie `demo`. Przykład PowerShell z jawną kontrolą położenia, wykonywany z katalogu repozytorium:

```powershell
$repoPath = (Resolve-Path '.').Path
$workerPath = Join-Path $repoPath '.local/worker'
$backupPath = Join-Path $repoPath ('.local/worker-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $workerPath) {
    $resolvedWorkerPath = (Resolve-Path -LiteralPath $workerPath).Path
    if ($resolvedWorkerPath -ne [IO.Path]::GetFullPath($workerPath)) { throw 'Unexpected local worker path' }
    Move-Item -LiteralPath $resolvedWorkerPath -Destination $backupPath
}
npm run worker -- demo
```

Nie usuwaj lockfile, gdy proces nadal działa. Po awarii potwierdź brak aktywnego procesu i zachowaj backup, zanim naprawisz osierocony lock. Edycja zastosowanej migracji powoduje `LOCAL_MIGRATION_CHECKSUM_MISMATCH`; dodaj migrację albo odtwórz wyłącznie jednorazową lokalną bazę.

Backup Dev wymaga prywatnego eksportu PostgreSQL, osobnego inwentarza/kopii obiektów Storage oraz checksum i identyfikatorów release. Użyj zaufanego narzędzia backupu i bezpiecznego przekazania credentials, bez hasła w linii polecenia. Nie wykonuj zdalnego resetu. Przywracanie testuj w nowym, jawnie potwierdzonym Dev; nie nadpisuj istniejących danych ani produkcji. Repozytorium nie konfiguruje płatnego backupu/PITR.
