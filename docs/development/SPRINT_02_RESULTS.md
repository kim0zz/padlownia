# Sprint 02 — wynik wykonania

**Data:** 2026-10-15, Europe/Warsaw. **Gałąź:** `feat/sprint-02-comparison-components`. Zakres: [brief](SPRINT_02_BRIEF.md), decyzje techniczne: [ADR-005](../adr/005-comparison-and-structured-view-contract.md).

## Dostarczony przepływ

Katalog i profil pozwalają wybrać dwie dokładne rakiety. Wybór zachowuje wariant, rok i wersję publikacji; można go usunąć lub wyczyścić. Trzecia rakieta nie zastępuje żadnej bez działania użytkownika. W tej samej karcie przeglądarki `sessionStorage` pamięta wyłącznie ID, identyfikator wydania i etykiety wyboru. Fakty nadal pochodzą z serwerowego odczytu zatwierdzonego katalogu.

`/porownaj` ma formularz dwóch rakiet i odtwarzalny adres z `left`, `right`, `release`. Wyświetla parametry, oryginalne obserwacje, konflikty, kontekst pomiarów oraz oceny z odrębnych źródeł i skal. Te same kategorie ocen mają wyrównane wiersze, również przy różnych długościach metodologii. Interfejs nie oblicza wspólnego rankingu. Stary release blokuje wyświetlenie wartości do jawnego odświeżenia; nieznane ID, powtórzona rakieta i niedozwolone parametry nie tworzą porównania.

Wspólne komponenty obsługują karty, obserwacje, oceny, cytowania, licencje i stany. Plik `tokens.css` zbiera kolory, typografię, odstępy, promienie i podstawowe parametry interakcji. `/komponenty` pokazuje syntetyczne dane pełne, braki, konflikty, różne skale i komunikaty stanów. Pozostaje syntetyczna również wtedy, gdy katalog czyta Supabase.

Ścisły kontrakt v1 pozwala wskazać `racket_card`, `racket_specs` i `racket_comparison`. Przyjmuje wyłącznie wersję i referencje do rakiet. Renderer sprawdza strukturę, limity, przynależność ID i jedno aktualne wydanie, a wartości uzupełnia z kontrolowanego katalogu. Klasyczna porównywarka korzysta z tego samego renderera; galeria demonstruje blok parametrów. Jest to przygotowanie interfejsu pod przyszłe AI, bez uruchomionego modelu, chatu ani endpointu przyjmującego zewnętrzne payloady.

## Weryfikacja

| Sprawdzenie | Wynik |
|---|---|
| `npm run check` | **PASS**: TypeScript, ESLint, **366 testów Vitest w 21 plikach**, build Next.js |
| `npm run test:e2e` | **10/10 PASS**, lokalny Microsoft Edge, 17,1 s |
| Kontrakt i prezentacja | 166 nowych testów: 56 kontraktu, 101 porównania/wyboru/renderowania, 9 komponentów |
| Fixture UI | Klawiatura, focus, limit dwóch, usuwanie, sesja po formularzu GET, dokładne roczniki, odtwarzanie URL, błędne/stare adresy, galeria |
| Dostępność i rozmiary | Axe A/AA bez wykrytych naruszeń w sprawdzonych stanach; 1440 px desktop, 375 px mobile, 812 px landscape, reduced motion i brak poziomego przepełnienia strony |
| Rzeczywisty Dev | **11/11 PASS**, ograniczony reader, wyłącznie odczyt; szczegóły poniżej |
| Kontrola sekretów | Skan 190 plików indeksu Git i 14 plików klienta nie znalazł wartości używanych credentials ani wzorców kluczy prywatnych/tokenów |

Pełna mapa scenariuszy i granic dowodu: [TEST_COVERAGE](TEST_COVERAGE.md). Testy DB wykorzystują izolowany lokalny PostgreSQL PGlite. Nie uruchamiano nowych migracji ani zapisów DB/Storage w tym sprincie. CI korzysta z fixture i nie wymaga sekretów; stan konkretnego przebiegu jest widoczny przy PR.

Niezależny przegląd kodu wykrył nieaktualną wartość natywnego selecta po nawigacji między parametrami tej samej trasy. Formularz jest teraz kluczowany zatwierdzonym wydaniem, ID i stanem, a regresja obejmuje usunięcie drugiej rakiety i przejście do wyboru 1/2. Inspekcja rzeczywistych danych mobilnych doprowadziła do wyrównania kategorii ocen. Poprawki przeszły ponowne testy i odczyt Dev.

W pierwszych uruchomieniach E2E ujawniły się selektory obejmujące również chwilowe, ukryte kopie DOM podczas streamingu Next.js. Testy odwołują się teraz do widocznych landmarków, właściwego poziomu nagłówka i zatwierdzonej nawigacji; nie używają arbitralnych opóźnień. Pomocniczy Dev smoke skorygowano do rzeczywistych skal 0–10/0–100 i oryginalnego brzmienia zastrzeżenia źródła. Te korekty testów nie zmieniały danych katalogu.

## Odczyt Supabase Dev

Końcowy odczyt: **15.10.2026 00:32:50 CEST**. Projekt wcześniej potwierdzony przez właściciela: `kfdegaowpanatofnqvpy`. Lokalny serwer uruchomiony z zoptymalizowanego buildu korzystał z istniejącego ograniczonego readera i TLS.

- Odczytano **444 profile** z aktywnego wydania `94f807c4-b78f-4394-be11-1d3ab00f3809`.
- Rzeczywista para pokazała **23 oceny**, obydwa źródła oraz skale 0–10 i 0–100 bez agregacji.
- Zachowano nieznany rok, cytowania przy wartościach, informację CC BY 4.0 i pełne zastrzeżenie źródła o niepełnych danych wejściowych algorytmu.
- Zweryfikowano blokadę starego wydania, jawne odświeżenie i odrzucenie nieistniejącego ID.
- Axe desktop/mobile nie wykrył naruszeń w sprawdzonych stanach. Na mobile pasujące kategorie zaczynały się w jednej linii mimo różnych długości opisów. Nie było poziomego przepełnienia ani błędów JavaScript strony.
- Galeria nadal wyświetlała wyłącznie przykłady syntetyczne.

Prywatne, lokalne dowody wykonania: `.local/sprint02-dev/report.json` i zrzuty w tym samym ignorowanym katalogu. Do Git trafiają tylko [syntetyczne zrzuty interfejsu](../design/screenshots/) i podsumowanie wyników. Nie kopiowano surowych źródeł, rzeczywistych recenzji, credentials ani plików środowiska.

## Jak sprawdzić

Uruchomienie fixture lub potwierdzonego Dev jest opisane w [README](../../README.md). Po `npm run dev`:

1. W katalogu wybierz dwie rakiety z różnymi rocznikami lub wariantami i użyj „Porównaj rakiety”.
2. Rozwiń „Obserwacje” przy parametrze; sprawdź źródło, pomiar egzemplarza i ślad pochodzenia.
3. Skopiuj adres porównania. Po zmianie samego `release` na nieaktualną wartość aplikacja zatrzyma dane i zaproponuje jawne odświeżenie.
4. Otwórz `/komponenty`, aby obejrzeć stany komponentów i przykład kontraktu bez dostępu do prywatnych źródeł.

## Granice i dalsze prace

**Koszt wywołań LLM: 0 PLN.** Nie dodano płatnych usług, publicznego wdrożenia, zmian produkcyjnych ani automatycznego merge'a. Impeccable pozostaje niezainstalowane; wykonany niezależny przegląd kodu i axe nie są audytem tego skilla ani pełną certyfikacją dostępności. Zrzuty służą przeglądowi wizualnemu, nie są automatycznym testem zgodności pikseli.

Nie ma decyzji właściciela blokującej ten zakres. Przed przyszłym chatem potrzebne będą osobne prace nad retrieval, cytowaniami/evalami i kontrolą kosztów; zakres praw do pełnych tekstów, embeddingów lub wysyłania ich do dostawcy modelu nie wynika z samego kontraktu UI. Historyczne wydania porównań i publiczny dostęp również pozostają poza tym sprintem.
