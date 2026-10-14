# Rzeczywiste źródła — raport wykonania 2026-10-14

Kontynuacja Sprintu 01 po dostarczeniu plików przez właściciela. Ten raport zastępuje wcześniejsze blokady braku plików i dostępu do Storage z [pierwszego raportu](SPRINT_01_RESULTS.md), zachowując go jako historię. Nie oznacza ukończenia publikacji katalogu.

**Wynik:** oba pełne katalogi są w prywatnym stagingu potwierdzonego Supabase Dev. Przeanalizowano oba pliki LLM, zachowano oryginały i uzupełniono 29 recenzji przez bezpośrednie JSON-y. Aplikacja łączy się z Dev; opublikowany katalog pozostaje pusty, ponieważ zgody źródłowe i wyjątki danych nie zostały zatwierdzone. Gate nie został ominięty.

## Pliki wejściowe i wersje

`sources/` jest materiałem tylko do odczytu i pozostaje poza publicznym Git. Nie zmieniano dostarczonych plików. Prywatne cache, oryginały, analizy i konfiguracja również nie są commitowane.

| Plik | Znaczenie | Bajty | SHA-256 |
|---|---|---:|---|
| `rackets padel true.txt` | PadelTrue, 281 rekordów | 736784 | `a6fe01ecab918b5ecfd8fc82e1d68fdfe3cadac34f0987b86f2c29cddd72a3ac` |
| `rackets.json` | Szczegółowy padel.how, 217 rekordów | 441033 | `ecf76cf5d253edce5dcbfa8febd5ede830857e73b517cba2ba1556e532533e48` |
| `padel how base.txt` | Identyczna bajtowo kopia powyższego; bez drugiego importu | 441033 | `ecf76cf5d253edce5dcbfa8febd5ede830857e73b517cba2ba1556e532533e48` |
| `data rackets.json` | Lżejszy eksport tych samych 217 slugów; porównanie kontrolne | 298769 | `699a87d91291e44676b4a0409e1d14cc976231ac939d90bca8da03c376bcbbd9` |
| `padel how llm.txt` | Skrócony indeks odkrywania treści | 8153 | `1e73310f5d5ddc00d15524c980baf602ad45b2573effbaf01e184a24ca429a78` |
| `LLM FULL TEXT.txt` | Korpus 588 dokumentów | 4870362 | `4c63fd9e20badacd571617d64cf9231e90b881cee0cbcc19bf43286b342c6a45` |

Parser i normalizer: `1.1.0`; wspólny kontrakt: `1.0.0`; reguła tożsamości: `exact-identity-v1`; parser wiedzy: `knowledge-v1`. Liczba rekordów wynika z pliku, nie z historycznych 268 wpisów w briefie.

## Import katalogów do Dev

| Miara | PadelTrue | padel.how |
|---|---:|---:|
| Deklarowane / przetworzone rekordy | 281 / 281 | 217 / 217 |
| Poprawne po normalizacji | 69 | 144 |
| Wymagające przeglądu normalizacji | 212 | 73 |
| Niepoprawne całe rekordy / utracone rekordy | 0 / 0 | 0 / 0 |
| Nowe dokładne tożsamości | 178 | 140 |
| Dopasowania do istniejącej dokładnej tożsamości | 0 | 42 |
| Nierozstrzygnięte tożsamości | 103 | 35 |
| Rekordy w kolejce po normalizacji i dopasowaniu | 227 | 93 |
| Obserwacje parametrów | 1955 | 1736 |
| Obserwacje ocen, w tym jawne null | 1686 | 2387 |

„Poprawny po normalizacji” nie oznacza dopuszczonego do publikacji: nadal może wymagać rozstrzygnięcia tożsamości. Miary normalizacji i kolejki nakładają się. Wszystkie 498 rekordów zachowano; powstało 318 kanonicznych tożsamości, a 138 rekordów pozostaje bez zaakceptowanego powiązania. Nie utożsamiaj liczby rekordów źródłowych z liczbą produktów ani dokładnych dopasowań z pomiarem precision/recall.

Łącznie: **2 snapshoty, 2 runy, 498 surowych rekordów, 498 wyników przetwarzania, 3691 obserwacji parametrów i 4073 obserwacje ocen**. Oryginały zajmują dwa prywatne obiekty `source-snapshots`. Kolejka obejmuje 320 rekordów: 138 `IDENTITY_REVIEW` i 182 `NORMALIZATION_REVIEW`.

Identyfikatory do powtórzenia kontroli:

- PadelTrue run: `bc21e6ba-3541-40b1-b428-85d4f62d6a00`; draft: `e15230e4-96b6-4422-a8c9-bbd5a67a0dda`.
- padel.how run: `0443c7a2-cbfd-406e-9c78-0cd8c499842e`; draft: `6ed030fb-851f-4c65-8347-1413124fd633`.
- Wspólny draft obu runów: `12271406-069c-4683-9b50-75ae94e74679`; gate potwierdził 2 źródła, 498 rekordów i 318 projekcji rakiet, `allowed=false` z tymi samymi trzema blokadami. Aktywny release pozostał pusty, a `worker catalogue --target dev` zwrócił `entries: []`.

Oba runy zakończyły się statusem `review_required`. Gate każdego draftu zwraca `allowed=false` oraz `SOURCE_PERMISSION_REQUIRED`, `UNACCEPTED_IDENTITY`, `UNRESOLVED_REVIEW`. Nie wykonano approve/publish/rollback na rzeczywistych danych.

Rzeczywisty ponowny import pełnego pliku PadelTrue zwrócił `replayed=true`, ten sam run i ten sam draft. Kontrola SQL/Storage potwierdziła niezmienione liczby: 2 snapshoty/runy/obiekty źródłowe, 498 surowych rekordów/wyników, 3691 parametrów i 4073 ocen. Dodany został wyłącznie oczekiwany wpis zdarzenia replay, a projekcja draftu została przebudowana. Pełnego ponownego importu padel.how nie uruchamiano; nie przypisuje mu się tej konkretnej próby chmurowej.

### Najważniejsze problemy danych

- PadelTrue: 70 rekordów bez roku; 188 rekordów ma niepełne wejścia modelu ocen; 5 jawnych konfliktów wejściowych; 24 nieznane punkty odniesienia balansu. 10 brakujących ocen wartości dotyczy innych walut niż EUR. 44 rekordy deklarują rok 2027 — zachowany jako twierdzenie źródła, nie samodzielnie potwierdzona premiera.
- padel.how: 2 brakujące lata; 13 wartości `women`/`junior` błędnie umieszczonych w kategorii poziomu gry; 2 pola z powierzchnią pola zamiast materiału/tekstury; 25 rekordów z nieparsowalnym zapisem liczbowym; 26 z jakościowym balansem bez liczbowego odpowiednika; 18 z nieznaną konfiguracją pomiaru.
- `issueCounts` z profilu liczy wystąpienia, a `affectedRecordCounts` unikalne rekordy dla kodu błędu. Przykładowo `unknown_year` występuje na etapie parsera i normalizacji: 140 wystąpień oznacza 70 rekordów, nie 140 rakiet.
- Nie nadpisano parametrów nominalnych pomiarami egzemplarza. Oceny PadelTrue pozostają wynikiem modelu regułowego, a padel.how ocenami redakcyjnymi. Nie utworzono wspólnej średniej ani nowych punktacji.

## Pliki LLM i bezpośrednie recenzje

[Pełny audyt](KNOWLEDGE_SOURCE_AUDIT.md) opisuje metody, konkretne sprzeczności i granice weryfikacji. Korpus ma **588 dokumentów**, około 714 tys. słów i **217 recenzji powiązanych jeden do jednego z dokładnymi URL-ami katalogu**. Wszystkie granice dokumentów i mapowania sprawdzono programowo; analiza semantyczna objęła metodologię, prawa, sekcje dokumentów i próbę recenzji. Nie jest to niezależne potwierdzenie każdego zdania.

Praktyczne ustalenia:

- Mały plik LLM jest indeksem z częściowo nieaktualnymi licznikami, nie drugim katalogiem ani zbiorem zweryfikowanych faktów.
- Duży plik zawiera recenzje, metodologię, poradniki i inne kategorie sprzętu. 149 recenzji ma pustą sekcję dynamicznie renderowanych parametrów; Markdown nie zastępuje szczegółowego JSON-a.
- Zachowano różne dokumenty z tym samym kanonicznym URL-em, powtórzenia i sprzeczności tekst/JSON. Wzmianki o konkurencyjnej rakiecie nie przenoszą na nią wszystkich twierdzeń recenzji.
- Wybrano pilot 29 modeli, po jednym na markę, według dostępności danych/tekstu i znanego roku. Z dokładnych odnośników `json_url` pobrano **29 JSON-ów: 29 werdyktów, 137 odpowiedzi FAQ i 93 linki porównań**. Wszystkie pola wspólne z bazowym JSON-em były zgodne we wszystkich 29 plikach. Nie jest to sprawdzenie prawdziwości ocen.
- W prywatnym `review-originals` zapisano **31 zasobów**, a w metadanych **618 dokumentów**: 588 z korpusu, 1 indeks i 29 szczegółowych JSON-ów. Pełna treść pozostaje w Storage, nie w tabelach manifestów. Reader katalogu nie ma dostępu do tych tabel.
- Replay pełnego korpusu zwrócił ten sam asset `e9567ba0-7a4c-4db0-baa4-0318bd5b2adf`, `replayed=true` i nie dodał dokumentów. Indeks ma asset `ce9d801e-8291-4ef8-a60c-6dc31625ae38`.

Dodano prywatne wyszukiwanie leksykalne z dokładnym slugiem, ograniczonym fragmentem, cytowaniem i hashami. Wynik ma status niezweryfikowanego materiału źródłowego. Nie uruchomiono chatu, modelu, embeddingów ani wektorowego retrievera. Źródłowe instrukcje są traktowane jako tekst, nie polecenia.

## Supabase i bezpieczeństwo

Jedyny zmieniany projekt: potwierdzony przez właściciela **Dev `padlownia`, `kfdegaowpanatofnqvpy`, Free**. Produkcji nie modyfikowano.

- Działa połączenie TLS z weryfikacją certyfikatu i hosta. Worker używa `padlownia_ingest`, web `padlownia_web`; oba role bez superuser/BYPASSRLS. Marker środowiska sprawdzany przed operacjami Dev.
- Zastosowano addytywną migrację `20261014180244_sprint01_knowledge_staging.sql`. Historia ma 7 migracji schematu i 2 jawne markery wcześniejszego provisioningu. Wszystkie 7 treści SQL porównano z Dev po normalizacji CRLF i końcowych białych znaków; zgodne. Markerów operacyjnych nie przedstawia się jako odtwarzalnych credentialów.
- **21/21 tabel aplikacji ma RLS**, oba buckety są prywatne; Supabase security advisor zwrócił pustą listę uwag.
- Rzeczywiste próby Storage sprawdziły zapis/odczyt/hash/replay, odmowę odczytu istniejącego obiektu bez klucza i przez publiczną ścieżkę oraz usunięcie wyłącznie własnych danych testowych. Osobny wcześniejszy test anonimowego klienta z publishable key również odmówił odczytu w obu bucketach. Obsługa JSON w `review-originals` została sprawdzona oddzielnie. HTTP 400 oznaczało brak treści źródłowej, nie deklarowane HTTP 403.
- Końcowe `worker check-storage` powtórzyło kontrole bez klucza; jawnie zgłosiło pominięcie opcjonalnego testu publishable key, którego nie ma w lokalnym env. Nie mylić tego powtórzenia z osobno wykonaną próbą anonimową.
- Opaque `sb_secret_…` idzie wyłącznie w nagłówku `apikey`; legacy JWT ma również Bearer. Klucz Storage jest uprzywilejowanym sekretem projektu, nie credentialem ograniczonym do jednego bucketa. Nie trafia do klienta ani Git.
- Skan 157 plików przygotowanych w indeksie Git oraz 13 plików bundla klienta nie znalazł wartości sekretów runtime, kluczy prywatnych ani wzorców tokenów. Pliki `.env`, `sources/` i `.local/` nie są śledzone.
- Supabase CLI nie ma skonfigurowanego konta/linku; migracje zastosowano management connectorem, a worker/web używają osobnych połączeń runtime.

## Wykonane testy

- `npm run check`: **171 testów / 16 plików**, TypeScript, ESLint i build Next.js zakończone powodzeniem.
- `npm run test:e2e`: **3/3** w Edge; wyszukiwanie, profile, klawiatura, responsive layout i axe WCAG AA. Poprawiono oczekiwanie testu na widoczne karty po streamingu Next.js; zrzut desktopu został obejrzany po ponownym wygenerowaniu. To automatyczny audyt, nie pełna certyfikacja dostępności.
- Rzeczywista aplikacja w trybie Supabase zwróciła **HTTP 200**, jawny stan „Pierwsza publikacja jeszcze przed nami.”, bez cichego fallbacku do fixture. Połączenie jest sprawdzone; wyświetlenie zatwierdzonych rzeczywistych kart pozostaje niewykonane.
- Niezależny przegląd kodu wykrył i naprawił powiązanie recenzji pod niespójnym slugiem; regresja wymusza dokładną ścieżkę produktu i odrzuca duplikaty. Ponowne profilowanie korpusu zachowało 588 dokumentów / 217 mapowań.
- Nowe regresje obejmują rzeczywiste kształty kontraktów na wymyślonych danych, liczenie rekordów z błędami, zachowanie JSON null przy batch INSERT, rollback nieudanego zapisu ocen, prywatny/replayowalny manifest, kontrolę URL/rozmiaru/redirectów oraz numeryczne różnice w deduplikacji fragmentów.

SQL lokalny wykonuje rzeczywisty PostgreSQL w PGlite z minimalnym shimem Storage; nie jest emulatorem Supabase. Cloud Auth, pełne przerwanie procesu między Storage a SQL, usuwanie źródła wraz z pochodnymi oraz rollback rzeczywistego opublikowanego release nie były sprawdzone. Publikacja i rollback zostały sprawdzone na izolowanych syntetycznych danych lokalnych. Szczegółowa mapa: [TEST_COVERAGE](TEST_COVERAGE.md).

## Powtórzenie i dalsze decyzje

Komendy konfiguracji, profilowania, importu i prywatnego wyszukiwania: [SETUP](SETUP.md). Dokumentacja rozróżnia tryb fixture od Supabase. Techniczne wybory: [ADR-003](../adr/003-private-source-knowledge-staging.md).

Właściciel nie musi ponownie dostarczać plików ani potwierdzać dostępu Dev. Do ukończenia publikacji potrzebne są:

1. Zachowanie korespondencji z padel.how i zapis zakresu zgody na wyświetlanie katalogu. Zakres dotyczący fragmentów recenzji, indeksowania i embeddingów należy ustalić przed tymi późniejszymi funkcjami; nie jest warunkiem samego katalogu. P-021 nie został cofnięty; O-002 pozostaje otwarte. PadelTrue deklaruje CC BY 4.0 w eksporcie, ale rekordy praw do publikacji w bazie nie zostały automatycznie zatwierdzone przez sam import.
2. Przegląd/adjudykacja wyjątków tożsamości i normalizacji, potem ponowne zbudowanie draftu i przejście gate. Samo zatwierdzenie release nie kasuje wyjątków i nie uruchamia częściowego katalogu.

**Wywołania LLM aplikacji/ingestion: 0; koszt tych wywołań: 0.** Brak płatnych usług, zmian produkcyjnych i automatycznego merge. [PR #2](https://github.com/kim0zz/padlownia/pull/2) pozostaje do przeglądu; część dotycząca opublikowanych rzeczywistych danych jest jawnie nieukończona. Wynik bieżącego CI jest widoczny w checks PR-a; powyższe liczby testów dotyczą rzeczywiście wykonanego przebiegu lokalnego.
