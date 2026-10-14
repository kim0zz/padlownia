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

`profile` oraz `import --dry-run` nie zapisują bazy ani Storage. `import` bez `--stage` także wykonuje dry run. `--file` przyjmuje autoryzowany lokalny plik do 50 MiB; ścieżkę ze spacjami ujmij w cudzysłowy. Nie ma pobierania źródeł z sieci ani wywołań LLM.

`demo` tworzy wyłącznie lokalny syntetyczny dataset w `.local/worker`: PGlite wykonuje migracje, zapisuje oryginalne bajty, normalizuje rekordy, ocenia gate i publikuje demonstrację. Ponowne uruchomienie demonstruje idempotencję. Polecenie odrzuca `--target dev`. Domyślny target pozostałych operacji to `local`.

Fixture'y `padeltrue.synthetic.json` i `padelhow.synthetic.json` zawierają celowe przypadki wymagające review; nie każdy przykład ma przejść gate. Czysta demonstracja używa `demo-clean.synthetic.json`. Fixture UI jest osobny od bazy workera, a UI nie ma trybu odczytu tej lokalnej bazy.

Pełne autoryzowane snapshoty nie były dostępne przy tworzeniu connectorów. Przed rzeczywistym importem sprawdź [obsługiwany kontrakt](../../packages/domain/README.md), uruchom profiler i dopasuj/versionuj adapter, jeśli źródło ma inną strukturę. Syntetyczne testy nie potwierdzają obsługi aktualnego feedu ani historycznych liczb rekordów.

## Połączenie z potwierdzonym Supabase Dev

Właściciel potwierdził **padlownia**, ref **`kfdegaowpanatofnqvpy`**, jako środowisko developerskie. Nie przenoś tej autoryzacji na inny projekt. Schemat i dwa prywatne buckety zostały zastosowane w tym Dev. Dedykowane loginy zostały bezpiecznie skonfigurowane, a `worker check-dev` potwierdził rzeczywiste połączenie z ograniczoną rolą i weryfikacją TLS. Credentials są w ignorowanych lokalnych plikach, nie w Git. Dostęp administracyjny, odczyt DB, zapis Storage oraz publikacja danych są osobnymi krokami weryfikacji. Brak runtime credentialu Storage i pełnych autoryzowanych snapshotów blokuje rzeczywisty cloud import i publikację; migracje nie rozwiązują tych braków.

Next.js z loginem readera zwrócił HTTP 200 i pusty katalog Dev bez fallbacku do fixture. Ten wynik potwierdza odczyt aplikacyjny; nie potwierdza importu ani publikacji rakiet. Testu HTTP Storage (odmowy dostępu i upload/readback) jeszcze nie wykonano. Stan wykonanych sprawdzeń: [SPRINT_01_RESULTS](SPRINT_01_RESULTS.md).

### Role i credentials

| Proces | Login bezpośredni | Rola uprawnień | Dostęp |
|---|---|---|---|
| Next.js server | `padlownia_web` | `padlownia_reader` | Marker Dev i funkcja opublikowanego katalogu |
| Worker | `padlownia_ingest` | `padlownia_worker` | Staging i kontrolowane funkcje review/release |
| Storage workera | Oddzielny credential Storage | Uprawnienia do prywatnych bucketów | Zapis i odczyt dla weryfikacji SHA-256 |

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

Aktualny adapter Storage wysyła credential jako `apikey` i Bearer; wybierz klucz zgodny z tym trybem oraz rzeczywistymi uprawnieniami projektu, a następnie sprawdź upload/readback. Klucz publiczny/anon nie daje dostępu do prywatnych obiektów. Credentials muszą pozostać poza browser bundle i zmiennymi `NEXT_PUBLIC_`.

### Weryfikacja przed importem

```sh
npm run worker -- check-dev
npm run worker -- catalogue --target dev
```

`check-dev` tylko odczytuje DB: sprawdza konfigurację, niezmienny marker `padlownia.environment_identity` i brak `BYPASSRLS` aktualnego loginu. Nie jest testem Storage. `catalogue` czyta tylko zaakceptowany release; brak danych może być prawidłowym wynikiem. Web również sprawdza marker Dev. Błąd konfiguracji daje stan setup, błąd połączenia stan niedostępności; nie ma cichego fallbacku do fixture.

## Migracje, staging i publikacja

Migracje w `supabase/migrations/` stosuje się w kolejności nazw przez uprawniony proces administracyjny wyłącznie w potwierdzonym Dev. Przed zapisem porównaj project ref, historię migracji i stan schematu. Zastosowanych plików nie edytuj; dodaj migrację. Shim Supabase z lokalnego PGlite nie może być uruchamiany w chmurze. Szczegóły: [supabase/README.md](../../supabase/README.md).

Snapshoty trafiają pod `source-snapshots/SOURCE/SHA256.json`; osobny prywatny bucket `review-originals` przeznaczono na przyszłe oryginały recenzji. Worker sprawdza prywatność bucketa i hash pobranych bajtów przed stagingiem. Skonfigurowane polityki SQL odmawiają `anon` i `authenticated` dostępu do tych obiektów; rzeczywisty test odmowy przez HTTP pozostaje do wykonania.

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

Zgodę źródła i jej rzeczywisty zakres należy wcześniej udokumentować kontrolowaną operacją DB; CLI nie ma polecenia nadawania zgody. Syntetyczna zgoda z lokalnego `demo` nie uprawnia do importowania prawdziwych katalogów. Niekompletne snapshoty, błędy, niepewne dopasowania i niezaakceptowane review blokują release. Review to obecnie audytowana operacja DB, bez panelu admina; nie zmieniaj historycznych rekordów, aby ominąć gate.

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

## Testy

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Łączny skrót to `npm run check`. Vitest obejmuje domenę, konfigurację/workera i rzeczywiste SQL w izolowanym PGlite. Ten zestaw nie potwierdza sieciowego połączenia z Supabase, HTTP Storage ani zgodności pełnych feedów. Mapa ING-001–ING-032: [TEST_COVERAGE](TEST_COVERAGE.md).

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
