# Sprint 02 — porównanie dwóch rakiet i wspólne komponenty

**Status:** zatwierdzony zakres zaimplementowany; końcowy check, fixture E2E i odczyt bieżącego Dev zaliczone po korekcie wyrównania ocen na mobile.

**Data:** 2026-10-15.

**Gałąź:** `feat/sprint-02-comparison-components`.

**Rezultat:** działająca klasyczna porównywarka, wspólne komponenty i tokeny, galeria stanów oraz walidowany kontrakt widoku do przyszłej integracji AI. PR do przeglądu; bez automatycznego merge'a.

Źródła wymagań: [AGENTS](../../AGENTS.md), [DECISIONS](../product/DECISIONS.md), [PRODUCT](../product/PRODUCT.md), [MVP](../product/MVP.md), [aktualny przegląd źródeł](SOURCE_REVIEW_RESULTS_2026_10_14.md), [zakres zgód](SOURCE_PERMISSION_REVIEW.md). Decyzje implementacyjne: [ADR-005](../adr/005-comparison-and-structured-view-contract.md).

## Punkt wyjścia i granice zgody

Sprint 01 opublikował w potwierdzonym Dev 444 profile z 498 rekordów obu źródeł, bez oczekujących wyjątków; to wynik konkretnego wydania opisany w raporcie, nie stała liczba produktów do zakodowania w aplikacji. Dane mają dokładne tożsamości, wersję wydania i pochodzenie. Brakujący rok nadal jest brakiem, nie zadaniem dla użytkownika do zgadnięcia.

Właściciel zatwierdził ten ograniczony następny krok: **dwie dokładne rakiety, wspólne UI, galeria fixture i ścisły kontrakt widoku**. Porównania, oddzielenie klasycznej ścieżki od AI, cytowania i zachowanie wariantów/roczników wynikają z przyjętych P-001/P-002/P-005/P-011/P-023–P-027. Nie zmieniamy statusów innych propozycji w rejestrze decyzji. Szerokiej listy przyszłych prac z końca briefu Sprintu 01 nie traktujemy jako zakresu tego sprintu.

**Nie ma decyzji właściciela blokującej ten zakres.** Sprawdzone zgody obejmują opisany katalog i porównania z atrybucją. Prawa do pełnych recenzji/tłumaczeń, eksportów źródeł, zdjęć, trwałych embeddingów i przekazywania pełnych tekstów zewnętrznym modelom pozostają do ustalenia przed odpowiednimi przyszłymi funkcjami. Nie są warunkiem porównania obecnych parametrów i ocen.

## Zakres

1. **Klasyczne porównanie dwóch tożsamości.** Wybór z katalogu/profilu oraz ekran `/porownaj` z parametrami `left`, `right`, `release`. Gotowe porównanie ma dwa różne dokładne ID i jedno wydanie. Nie wybieramy produktu wyłącznie po marce, nazwie rodziny czy podobieństwie tekstu. Limit wynosi dwa; trzeci wybór wymaga jawnej zmiany istniejącej pary.
2. **Czytelne zestawienie.** Marka, model, wariant i rok są zawsze rozpoznawalne. Parametry, źródłowe oceny, zakresy/jednostki, braki i konflikty mają wspólny układ desktop/mobile. Różne skale lub metodologie nie tworzą wspólnej średniej, rankingu ani nieuzasadnionego „zwycięzcy”. Pomiar egzemplarza i opinia nie zastępują po cichu deklarowanej specyfikacji.
3. **Wspólne komponenty i tokeny.** Katalog, profil, porównanie i galeria używają tej samej rodziny kart, parametrów, ocen, cytowań oraz komunikatów stanów. Tokeny kolorów, typografii, odstępów, obramowań, focusu i kontrolek są wspólne. Zachowujemy istniejący kierunek wizualny i atrybucję; nie tworzymy osobnego systemu wyłącznie dla przyszłego AI.
4. **Galeria `/komponenty`.** Przeglądalny zestaw wariantów i stanów na jawnie oznaczonych syntetycznych danych: dane pełne, nieznany rok/brak wartości/jednostki, konflikt, odrębne oceny źródeł oraz komunikaty braku parametrów i błędu odczytu. Pokazuje przykład kontraktu `racket_specs`; pozostałe typy mają pokrycie renderera, a porównanie działa na `/porownaj`. Demonstruje też wspólne komponenty pustego wyboru i komunikatu nieaktualnego wydania; działające formularze wyboru i ponowienia porównania pozostają na `/porownaj`. Galeria nie udostępnia prywatnych materiałów ani surowych danych Dev.
5. **Kontrakt widoku v1.** Runtime validation obejmuje `datasetVersion` i zamknięty zbiór bloków `racket_card`, `racket_specs`, `racket_comparison`. Bloki odnoszą się do ID; rzeczywiste wartości i pochodzenie uzupełnia aplikacja z zaakceptowanego katalogu. Kontrakt nie przyjmuje własnych parametrów, ocen, adresów źródeł, HTML lub wykonywalnych instrukcji od przyszłego producenta payloadu.

Nie dodajemy LLM, chatu, gatewaya modelowego, embeddingów, nowego importu ani schematu DB. Nie zmieniamy produkcji, nie wdrażamy publicznego hostingu i nie wykonujemy płatnych wywołań. Odczyt bieżącego katalogu Dev korzysta z istniejącego ograniczonego readera. Autoryzacja merge'a wcześniejszego PR nie stanowi automatycznej autoryzacji merge'a tego sprintu.

## Kolejność i zależności

| Etap | Praca | Zależność i oczekiwany dowód |
|---|---|---|
| 1 | Przeczytać istniejące komponenty, read model i zachowanie filtrów; zastosować projektowy UI UX Pro Max | Zachowany wygląd i ustalone zasady źródłowe; jawne granice refaktoru |
| 2 | Zdefiniować czysty kontrakt v1 oraz walidację ID/wydania | Testy walidacji przed renderowaniem; brak zaufania do TypeScript cast lub danych URL |
| 3 | Wydzielić współdzielone komponenty i tokeny | Katalog/profil nadal zachowują pochodzenie, skale i obsługę braków |
| 4 | Dodać wybór do dwóch rakiet i `/porownaj` | URL odtwarza dokładną parę; brak cichego zastępowania wariantu lub wydania |
| 5 | Dodać galerię fixture i wspólny renderer bloków | Te same komponenty pokazują wartości uzupełnione z kontrolowanego katalogu |
| 6 | Sprawdzić regresje, klawiaturę, mobile, dostępność i bieżący Dev | Wyniki wykonanych komend oraz oddzielny dowód rzeczywistego odczytu; naprawa wykrytych błędów |

Wybór jest małym kontekstem nawigacji, nie nowym modelem domenowym. URL pozostaje źródłem odtwarzalnej pary. Zaimplementowane `sessionStorage` zapisuje do dwóch ID, release i etykiety do wyświetlenia; przetrwa pełną nawigację formularza GET. Walidacja danych sesji nie zastępuje sprawdzenia ID/wydania przez serwer. Poprawny jawny URL kompletnej pary aktualizuje kontekst starszej sesji, a wyczyszczenie wyboru nie dodaje pary ponownie bez zmiany zweryfikowanych parametrów. Bez dostępu do Storage przeglądarki działa pamięć bieżącej strony. Nie zapisujemy tam parametrów, ocen, credentials ani kopii źródeł.

## Niezmienniki i obsługa stanów

- Porównywane obiekty pochodzą z tego samego aktualnie opublikowanego wydania. `release` w URL i `datasetVersion` kontraktu identyfikują tę samą wersję danych; nie są dowolnym wyborem tabeli/draftu.
- Nieaktualne wydanie zatrzymuje renderowanie danych i daje jawny komunikat/ścieżkę ponownego wyboru. Nie podmieniamy faktów na nowsze pod starym identyfikatorem wydania. Sprint nie dodaje czytnika historycznych wydań.
- Zero lub jeden wybór daje stan wymagający uzupełnienia pary. Dwa identyczne ID, nieznane ID, zła struktura, nadmiarowe niedozwolone pola i nieobsługiwane wersje nie tworzą pozornego porównania.
- Dane w payloadzie/URL są niezaufane. Renderer przyjmuje wynik ścisłej walidacji i uzupełnia wartości wyłącznie z opublikowanego read modelu albo jawnego katalogu fixture.
- Brak wyniku DB, brak konfiguracji i błąd połączenia pozostają osobnymi stanami; nie uruchamiają cichego fallbacku. Galeria jest celowo syntetyczna niezależnie od trybu głównego katalogu.
- Rok `null`, nieznana jednostka, różnice kontekstu pomiaru i konflikty pozostają widoczne. Nie dopowiadamy informacji ani nie porównujemy niezgodnych skal jako jednej miary.
- Obok danych pozostają konkretne źródła, skale/metodologie, daty i wymagane informacje licencyjne. Prywatne pliki, ścieżki Storage, notatki audytu i credentials nie trafiają do kontraktu ani klienta.

## Weryfikacja i kryteria odbioru

Poniższe punkty są kryteriami odbioru. Końcowy `npm run check` zaliczył TypeScript, ESLint, 366 testów Vitest w 21 plikach oraz build. `npm run test:e2e` zaliczył 10/10 testów w lokalnym Edge (17,1 s), w tym siedem nowych testów porównania/galerii. Oddzielna próba rzeczywistego Dev zaliczyła 11/11 sprawdzeń na buildzie produkcyjnym z ograniczonym readerem i bieżącym wydaniem 444 profili. Wyniki obejmują korektę wyrównania tych samych wymiarów ocen w wierszach i pomiar ich położenia na mobile z tolerancją 1 px. Szczegółowa mapa: [TEST_COVERAGE](TEST_COVERAGE.md). [Raport Sprintu 02](SPRINT_02_RESULTS.md) zapisuje finalne komendy, środowisko, ograniczenia i dowody.

| Warstwa | Wymagane sprawdzenia |
|---|---|
| Kontrakt runtime | Dopuszczalne trzy typy bloków; odrzucanie obcych pól/typów/wersji; nieistniejące ID, powtórzony produkt w parze, błędne lub nieaktualne `datasetVersion`; brak możliwości narzucenia faktu/oceny/cytowania przez payload |
| Porównanie | 0/1/2 wyborów, limit dwóch, jawna zamiana/usunięcie, odtwarzanie URL, rozróżnienie roczników i wariantów, stale release; wartości i provenance zgodne z wybranym wydaniem |
| Komponenty | Wspólne renderowanie karty/specyfikacji/ocen/porównania; zachowanie zera i `null`, braków, konfliktów, surowego kontekstu, atrybucji i odrębnych skal; regresja obecnego katalogu/profilu |
| Bezpieczeństwo UI | Niezaufane teksty i nazwy pól pozostają danymi; linki mają istniejącą walidację; brak dowolnego HTML/JS i sekretów w payloadzie/bundlu |
| Przeglądarka | Klawiatura i widoczny focus; dostępne nazwy kontrolek; wybór na katalogu/profilu; link do porównania; mobile portrait/landscape bez przepełnienia strony; czytelne powiązanie etykiety z obiema wartościami; axe i ręczna inspekcja zrzutów |
| Galeria | Jawne oznaczenie fixture, dostępne warianty/komunikaty, brak zapytań o prywatne surowe źródła; zgodność z komponentami aplikacji |
| Rzeczywisty Dev | Odczyt bieżącego opublikowanego katalogu i porównanie dwóch istniejących ID; sprawdzenie źródeł, skali oraz aktualnego release. Bez zapisu DB/Storage i bez kopiowania rzeczywistych źródeł do repo |

Standardowe komendy: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` oraz `npm run test:e2e`; `npm run check` łączy pierwsze cztery. Oddzielnie raportujemy fixture E2E i rzeczywistą próbę Dev. Udane testy Sprintu 01 nie są wynikami nowego sprintu. Liczbę profili w próbie Dev odczytujemy dynamicznie.

Stosujemy [projektowy workflow UI](../ai/DESIGN_WORKFLOW.md) i UI UX Pro Max. Lokalna inwentaryzacja 15.10.2026 nie znalazła Impeccable: jest opisane jako planowany, jeszcze niezainstalowany niezależny reviewer. Nie instalujemy go w ramach przygotowania tego briefu i nie przedstawiamy zwykłej kontroli UI jako wykonanego audytu Impeccable.

Do przeglądu należy dostarczyć zakres zmian, odwracalne wybory techniczne, uruchomione komendy i wyniki, zauważone ograniczenia oraz zrzuty syntetycznych stanów. Właściciel nie musi ponownie potwierdzać dostępu do Dev ani zgody na katalog/porównania. Pytania dotyczące późniejszego AI, praw tekstowych lub publicznego udostępnienia pozostają poza tym krokiem.
