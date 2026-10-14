# Przegląd 320 rekordów — 14–15 października 2026

Właściciel zlecił samodzielne rozstrzygnięcie wyjątków na podstawie źródeł. Przejrzano **wszystkie 320 rekordów**; żadnego nie pozostawiono bez rozstrzygnięcia. Braki faktyczne pozostają jawne. **Nie ma aktualnej decyzji właściciela blokującej katalog parametrów i ocen.**

**Katalog Dev opublikowany: 444 profile z 498 rekordów obu źródeł, zero oczekujących wyjątków.** Publikacja zakończyła się 15.10.2026 o 00:02 czasu Warszawy; audyt rozpoczął się poprzedniego dnia.

## Wynik audytu

| Zakres | Wynik |
|---|---:|
| Oryginalna kolejka | 320 rekordów: 227 PadelTrue + 93 padel.how |
| Rekordy z poprawioną interpretacją | 48 |
| Rekordy zaakceptowane z zachowanymi ograniczeniami | 272 |
| Tożsamości wymagające indywidualnej decyzji | 138 |
| Pozostałe, już poprawnie przypisane tożsamości | 182 |
| Brakujący rok zachowany jako `null` | 72 |
| Potwierdzone połączenia różnych nazw | 7 |
| Rekordy, które po korekcie nie potrzebują już kolejki | 25 |
| Indywidualne decyzje zapisane po reprocessingu | 295 |
| Sprawdzone wskaźniki do pól źródłowych | 2026 |
| Sprawdzone odwołania do konkretnych dokumentów recenzji | 100 |
| Sprawdzone precyzyjne fragmenty dowodzące aliasów | 7 |

48 + 272 to rozłączne wyniki przeglądu normalizacji. Przegląd tożsamości jest drugim wymiarem tych samych 320 rekordów, więc jego liczb nie należy dodawać do pierwszego podziału. 48 korekt nie oznacza 48 całkowicie kompletnych rekordów: część nadal zawiera uczciwie zachowane braki.

Parser i normalizer `1.2.0` odtwarzają 281 + 217 rekordów z tych samych dwóch snapshotów. Dodatkowe 52 obserwacje dają się bezpiecznie znormalizować dzięki jawnym jednostkom, punktowi odniesienia, oznaczeniu przybliżenia i konfiguracji pomiaru. Sprzeczności nie są wyborem „wygodniejszej” wartości. Przykładowo sprzeczne twierdzenia o powierzchni HEAD Extreme Motion 2025 pozostają poza głównym parametrem. Konflikt twardości NOX nie usuwa osobno potwierdzonego oznaczenia pianki MLD.

Nie uzupełniano lat z daty publikacji, pozycji w kolekcji czy podobieństwa nazwy. Zachowano oddzielnie niepotwierdzone roczniki, warianty i kolory, m.in. Oxdog Classics, Metalbone CTRL 3.5 oraz niewskazany jednoznacznie kolor SIUX Pegasus. Nie wybrano Lava Orange na podstawie ogólnego tytułu, gdy link recenzji prowadzi do Storm Grey.

Potwierdzone aliasy dotyczą Hack 04 Comfort 26/2026, Vertex 05 W/Woman 2026, czterech zgodnych modeli NOX z dopiskiem nazwiska zawodnika oraz SIUX Electra STUPA Pro/Pro 2026 **Shadow Red**. Dowody obejmują konkretny model, wariant i rok oraz wskazania produktu w recenzji lub odnośniku producenta. Fire Red, Attack, wersje włókna i inne warianty nie są usuwane z tożsamości.

W 188 rekordach PadelTrue brakujące wejścia modelu są wyjaśnione przy ocenach; źródłowa wartość domyślna nie udaje pomiaru. W 10 przypadkach bez zgodnej waluty ocena opłacalności pozostaje bez wartości. Oceny obu źródeł zachowują odrębne skale, metodologię, link i datę pobrania. CC BY 4.0 i informacja o normalizacji są widoczne przy rzeczywistych danych PadelTrue.

## Zgoda padel.how — co jest, a czego nie potwierdzono

Odczytano oryginalną pozytywną odpowiedź autora z 13.10.2026 wraz z cytowaną prośbą o wykorzystanie danych na polskiej stronie porównującej rakiety, z atrybucją i linkami. **Wcześniejsza blokada braku dowodu zgody dla katalogu została rozstrzygnięta.** Nie trzeba pytać ponownie o tę samą funkcję. Dokładna referencja i hash dowodu pozostają prywatne; publiczne repo nie zawiera korespondencji ani danych osobowych.

Korespondencja nie określa osobno:

1. Publikacji pełnych recenzji lub ich pełnych tłumaczeń.
2. Udostępniania pobieralnej kopii/eksportu bazy źródłowej.
3. Praw do zdjęć producentów i innych podmiotów.
4. Trwałych embeddingów, treningu/fine-tuningu oraz przekazywania pełnych tekstów zewnętrznym dostawcom modeli.

To zakresy do potwierdzenia **przed wdrożeniem odpowiedniej przyszłej funkcji**, nie aktualne blokady katalogu. Brak wzmianki nie jest równoznaczny z zakazem. Dostępność plików LLM/API nie jest nieograniczoną licencją publikacyjną. Pełny przegląd dowodów i warunków: [SOURCE_PERMISSION_REVIEW.md](SOURCE_PERMISSION_REVIEW.md), [padel.how Copyright and Data Reuse](https://padel.how/copyright/).

## Zapis w Dev i kontrola wykonania

Wszystkie operacje dotyczyły wyłącznie potwierdzonego projektu `kfdegaowpanatofnqvpy`.

| Element | Potwierdzony wynik |
|---|---|
| Nowy run PadelTrue `1.2.0` | `81554a8d-7ff3-4bd0-80bc-cadfe2b966da`, 281/281 rekordów |
| Nowy run padel.how `1.2.0` | `6585d102-e532-4605-8b75-4bb7fa1d4a0e`, 217/217 rekordów |
| Wspólny release nr 6 | `94f807c4-b78f-4394-be11-1d3ab00f3809` — `published` |
| Gate przed publikacją | `allowed=true`, `blockers=[]`, 2 źródła / 498 rekordów / 444 profile |
| Diff pierwszej publikacji | 444 dodane / 0 zmienionych / 0 usuniętych |
| Odczyt dedykowanego readera | 444 profile, wszystkie z aktywnego release; 72 mają nieznany rok |
| Nierozstrzygnięte wyjątki / nieprzypisane tożsamości nowych runów | 0 / 0 |
| Historia | 2 snapshoty, 498 niezmiennych raw rows, 996 wersjonowanych wyników, 2 wycofane runy |
| Prawa do katalogu | oba źródła `approved`, `catalogue_display_allowed=true` |
| Replay decyzji | po jednej decyzji z każdego nowego runu: `replayed=true`, bez nowego zapisu |
| Prywatny Storage | 2 obiekty `source-snapshots`, 31 `review-originals`; oba buckety `public=false` |
| Izolacja readera | odmowa odczytu `source_records`, `source_snapshots`, `review_queue`, `data_sources`, `knowledge_documents` |
| Publiczny read model | brak raw payloadów, ścieżek Storage, korespondencji i notatek przeglądu |

Po zbudowaniu draftu proces kliencki nie zakończył odczytu odpowiedzi. Niezależne sprawdzenie bazy potwierdziło commit 444 projekcji i dodatni gate; wznowienie odnalazło **ten sam** release po jego dwóch runach. Nie powtórzono importu ani nie utworzono drugiego wydania. Dopiero potem wykonano jawne approval i atomowe przełączenie z `active_release_id=null`; istnieje dokładnie jedno zdarzenie publikacji. Stary wspólny draft nadal blokują `IMPORT_NOT_STAGED` i historyczne `UNACCEPTED_IDENTITY`.

Prywatne manifesty `identity-decisions.json` i `normalization-decisions.json` obejmują każdy oryginalny wynik. Plan wykonania przypina nowe ID wyniku, oryginalny raw row, indeks, źródło, URL, SHA-256 i oczekiwany match; używa odtwarzalnych decyzji zamiast zbiorczego „zaakceptuj wszystko”. Wyniki i dowody nie zmieniają oryginalnych obserwacji. Stare interpretacje są zachowywane jako `superseded` i nie mogą zostać opublikowane. Zastąpienie importu samo w sobie nie akceptuje nowego — jego bramki nadal obowiązują.

W repo jest dziewięć migracji schematu oraz dwa jawnie opisane znaczniki historii provisioningu. Prywatne buckety i RLS pozostają włączone; po migracjach zabezpieczających cykl importu Supabase Security Advisor nie zgłosił uwag. Testy PGlite sprawdzają oba dopuszczalne porządki zatwierdzenia/wycofania, ale nie zastępują testu wyścigu dwóch niezależnych połączeń PostgreSQL; takiego testu nie wykonano.

## Weryfikacja

- `npm run check`: **200/200 testów w 17 plikach**, TypeScript, ESLint i build Next.js — zaliczone.
- Testy bazy: **59/59**, w tym 10 przypadków przeglądu/wycofania, replay, rozdzielenia nieznanego i znanego roku, zamrożenia opublikowanego wydania, uprawnień i kolejności operacji.
- `npm run test:e2e`: **3/3** — syntetyczne dane, klawiatura, desktop/mobile/landscape i axe WCAG AA. Próba rzeczywistego wydania jest raportowana oddzielnie poniżej.
- Walidacja prywatnego audytu: 320/320 tożsamości zgodnych z planem, 2026 wskaźników do pól, 100 dokumentów i 7 dokładnych fragmentów sprawdzonych względem hashy i bajtów dostarczonych plików. Źródła niezmienione.
- Skan indeksu Git i klienta: **164 pliki repo + 13 plików klienta**, bez znalezionych sekretów. Surowe źródła, dowody korespondencji i prywatne manifesty nie są w Git.

Rzeczywisty Next.js w trybie Supabase, Edge, 15.10.2026 o 00:02 czasu Warszawy: **8/8 kontroli zaliczonych**. Katalog pokazuje 444 profile; dwie strony po 12 różnych UUID, wyszukiwanie z marką, filtr nieznanego roku i profil bez roku działają. Profil wspólny zawiera 11 ocen padel.how i 6 PadelTrue z odrębnymi skalami, datami, właściwymi linkami recenzji/metodologii i CC BY 4.0. Osobno sprawdzono widoczne zastrzeżenie brakujących wejść modelu. Zero błędów JavaScript, konsoli i HTTP 5xx; brak poziomego przepełnienia na 375 px i 812 px. Obejrzano osiem prywatnych zrzutów; nie commitowano rzeczywistych treści źródłowych. Część nazw wymiarów ocen zachowuje angielskie oznaczenie źródła; nie wpływa to na skale ani pochodzenie danych.

Cloud rollback rzeczywistych danych nie był wykonywany; jego zachowanie jest sprawdzone lokalnie na izolowanych danych syntetycznych. Publiczny hosting i porównywarka/chat nie należą do tego wykonania.

Na skonfigurowanym komputerze `npm run dev` otwiera rzeczywisty katalog pod `http://127.0.0.1:3000`; aplikacja ma już prywatną konfigurację readera. Świeży klon bez sekretów uruchamia odrębny tryb demonstracyjny zgodnie z [SETUP](SETUP.md). Szczegółowe prywatne dowody i pokwitowania są w ignorowanym `.local/adjudication/`, a wynik UI w `published-smoke/report.json`.

Koszt płatnych wywołań LLM: **0**. Nie zmieniano produkcji ani zaakceptowanych decyzji produktowych. Nie wykonano merge'a. Szczegóły techniczne: [ADR-004](../adr/004-evidence-review-and-import-supersession.md).
