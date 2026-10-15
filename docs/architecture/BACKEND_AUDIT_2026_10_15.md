# Audyt backendu — 15.10.2026

Zakres: `packages/domain`, `packages/database`, `apps/worker`, `supabase/migrations`, ścieżka odczytu w `apps/web/lib`, CI i dokumentacja. Audyt oparty na lekturze kodu oraz uruchomieniu testów lokalnie (PGlite, fixture). Nie łączyłem się z Supabase Dev i nie mierzyłem czasów odpowiedzi na prawdziwych danych — miejsca, gdzie to ma znaczenie, są oznaczone jako hipotezy do zmierzenia.

## Werdykt

Fundament danych jest **solidny i bezpieczny**, ale **przeinwestowany względem celu** (prywatne demo dla kilku znajomych) i zbudowany kosztem tego, co miało produkt wyróżniać. Po dwóch sprintach istnieje dojrzały pipeline z bramkami publikacji, a nie istnieje ani jedna linijka retrievalu, modelu ani asystenta — czyli ścieżki nr 2 z `PRODUCT.md`.

## Co jest dobre (zostawić)

- **Proweniencja od rekordu do ekranu.** Niezmienne snapshoty z SHA-256, wyniki przetwarzania wersjonowane per run, obserwacje z oryginałem i kontekstem pomiaru, wydania z atomową aktywacją i rollbackiem. To realny wyróżnik i dobra baza pod cytowania w czacie.
- **Bezpieczeństwo dostępu.** Prywatny schemat, RLS, osobne role (reader / worker), funkcje `security definer` z jawnym `search_path`, walidacja URL-i połączeń (`sslmode=verify-full`, brak nadpisań hosta/użytkownika), prywatne buckety. Web nie ma dostępu do surowych tabel.
- **Uczciwe traktowanie niepewności.** Nieznany rok, brak jednostki, rozbieżności i niezweryfikowana atrybucja producenta nie są „naprawiane” zgadywaniem.
- **Kontrakt widoku (`view-contract.ts`).** Bloki `racket_card` / `racket_specs` / `racket_comparison` przyjmują tylko ID — to gotowy, bezpieczny format wyjścia dla przyszłego asystenta.
- **Testy domenowe i bazodanowe na prawdziwym PostgreSQL (PGlite)** bez Dockera i chmury. CI bez sekretów.

## Problemy — od najważniejszego

### B1. Brak ścieżki AI, a dokumenty tekstowe są gotowe od tygodnia
217 recenzji padel.how jest zmapowanych 1:1 na produkty (`KNOWLEDGE_SOURCE_AUDIT.md`), ale w bazie są tylko manifesty: zero chunków, zero embeddingów, brak `pgvector`, brak `packages/ai`, brak `evals/`. **Blokada formalna:** O-002 (zakres zgody padel.how na przetwarzanie modelem/embeddingi) jest nadal otwarta — to musi rozstrzygnąć właściciel, zanim zaindeksujemy pełne teksty.

### B2. Ścieżka odczytu: każdy widok czyta i przesyła cały katalog
`getCatalogue()` przy **każdym** żądaniu tworzy nową pulę `pg`, wykonuje zapytanie o tożsamość środowiska, a potem `published_catalogue()` — jedną funkcję zwracającą **wszystkie 444 rakiety ze wszystkimi obserwacjami i ocenami** jako JSON (skorelowane podzapytania per rakieta i per obserwacja). Następnie zamyka pulę. Profil jednej rakiety i porównanie dwóch też ściągają całość i filtrują w JS. Strony są `force-dynamic`, bez żadnego cache.
- Skutek (hipoteza do zmierzenia): czas odpowiedzi rzędu sekund na Supabase Free, który będzie rósł z katalogiem, oraz zbędne zestawianie TLS przy każdym wejściu.
- Dane zmieniają się wyłącznie przy publikacji wydania — idealny przypadek dla cache kluczowanego `active_release_id`.

### B3. Słabe łączenie źródeł — porównywanie „dwóch źródeł tej samej rakiety” prawie nie występuje
498 rekordów → 444 profile, czyli **co najwyżej 54 rakiety** mają dane z PadelTrue i padel.how jednocześnie. Dopasowanie jest wyłącznie dokładne (`exact-identity-v1`) — zgodnie z P-008 i słusznie bez automatycznych fuzzy-merge'y — ale nie ma też **podpowiadania kandydatów** do przeglądu. Wartość „widać rozbieżności między źródłami” jest więc dziś w dużej mierze teoretyczna.

### B4. Kanoniczne nazwy dziedziczą bałagan źródeł
`rackets.model` zawiera markę i rok w różnych wariantach wielkości liter („adidas 2026 World Cup…”, „Adidas Arrow Hit 2026”), warianty są małymi literami („ctrl pro”), materiały surowe („hr3 eva”). Normalizacja istnieje tylko dla klucza dopasowania (`resolution.ts`), nie dla nazwy wyświetlanej. W UX v3 obeszliśmy to warstwą prezentacji (`lib/display.ts`), ale miejsce na to jest w danych — inaczej asystent i każdy przyszły widok będą powtarzać tę logikę.

### B5. Kluczowa praca przeglądowa żyje poza repozytorium
Rozstrzygnięcia 320 wyjątków powstały skryptami w `.local/adjudication/*.ts` (`apply-review.ts`, `build-identity-decisions.ts`, …), a `.local/` jest w `.gitignore`. Decyzje są w bazie (z uzasadnieniem i hashami), ale **narzędzia**, które je wygenerowały, istnieją tylko na jednym laptopie. Tam też leżą prywatne klucze GPG bootstrapu i lokalne bazy PGlite. Brak kopii = ryzyko utraty i brak powtarzalności przy kolejnym imporcie.

### B6. Operacje wyłącznie z CLI, bez widoku przeglądu
Kolejka przeglądu, gate, approve, publish — tylko komendy workera. Przy następnym imporcie (nowe roczniki co sezon) każdy wyjątek znów oznacza ręczne skrypty. Nie trzeba od razu „Smart DataOps”, ale minimalny lokalny widok kolejki zwróci się przy pierwszej aktualizacji danych.

### B7. Przerost dokumentacji i procesu
~310 KB Markdownu w `docs/` przy ~2,7 tys. linii kodu backendu i ~2 tys. linii frontu. Raporty sprintów powtarzają wyniki testów, dowody i zastrzeżenia na kilku stronach; `TEST_COVERAGE.md` ma 33 KB. To był efekt pracy z agentem, który dokumentował każdy krok jako dowód. Koszt: trudno znaleźć aktualny stan, a każda zmiana wymaga aktualizacji wielu plików.

### B8. Drobne, ale uciążliwe
- Testy e2e zapisują zrzuty do **śledzonego** `docs/design/screenshots/*.png`, a `next build` modyfikuje śledzony `next-env.d.ts` — każde uruchomienie brudzi drzewo gita.
- `playwright.config.ts` domyślnie wymaga Edge; dodałem `PLAYWRIGHT_EXECUTABLE`, ale CI i lokalne środowiska nadal się rozjeżdżają.
- Brak mechanizmu dostępu (D-003 „kod zaproszenia + limity” jest tylko propozycją) — przed wystawieniem demo znajomym to blokada.
- Kopia zapasowa i retencja (O-005) — nieopisane w praktyce poza dokumentem SETUP.

## Ryzyka, których NIE widzę
- Wycieku sekretów do repo (`.env*` i `.local/` ignorowane, `.env.example` z placeholderami).
- Dostępu przeglądarki do surowych danych lub bucketów.
- Cichego nadpisywania danych — wszystko append-only z jawnym superseded.

## Rekomendacje (szczegóły i kolejność w `docs/product/ROADMAP.md`)

| # | Działanie | Rozwiązuje | Wysiłek |
|---|---|---|---|
| R1 | Pula `pg` jako singleton modułu + cache katalogu kluczowany `active_release_id` (tanie zapytanie o ID wydania, pełny odczyt tylko przy zmianie) | B2 | S |
| R2 | Osobne funkcje SQL: lista (lekka projekcja) vs szczegół jednej rakiety; pomiar przed/po | B2 | M |
| R3 | Kanoniczne `display_brand` / `display_model` / `display_variant` w domenie + migracja addytywna; `lib/display.ts` jako fallback | B4 | M |
| R4 | Skrypty z `.local/adjudication` → `apps/worker/src/review/` (bez danych), dane prywatne → zaszyfrowana kopia poza laptopem | B5 | S |
| R5 | Podpowiadanie kandydatów dopasowania (podobieństwo nazwy w obrębie marki i rocznika) do kolejki przeglądu — **bez** automatycznego łączenia | B3 | M |
| R6 | Lokalny widok `/admin/przeglad` (tylko `APP_ENV=development`, za flagą) do akceptacji/odrzucenia kandydatów | B3, B6 | M |
| R7 | Zgoda padel.how na przetwarzanie modelem → chunki + embeddingi + hybrydowy retrieval + zestaw ewaluacyjny | B1 | L |
| R8 | Higiena repo: zrzuty e2e do `test-results/`, `next-env.d.ts` do `.gitignore`, jedna konfiguracja przeglądarki dla CI i lokalnie | B8 | S |
| R9 | Dieta dokumentacji: jeden aktualny „stan projektu”, raport sprintu max 1 strona, historię zostawia git | B7 | S |
