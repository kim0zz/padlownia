# Odpowiedzi z danych liczbowych — mapa aspektów i progi (15.10.2026)

Zmiana akcentów zaproponowana przez właściciela: **najpierw liczby i parametry z katalogu, proza recenzji jako wyjaśnienie i cytat.** Kod: `packages/ai/src/structured.ts`. Test: `apps/worker/src/eval-structured.ts`. Wynik: `evals/results/structured-2026-10-15.json`.

## Jak to działa

1. Resolver rozpoznaje rakietę, a jej nazwa jest usuwana z pytania („Ventus **Control**”, „**Power**+”, „**12K**” to nie pytania o kontrolę, moc czy materiał).
2. Z reszty pytania wykrywamy **aspekty** po słowach kluczowych (polskie i angielskie, bez polskich znaków). Bez modelu.
3. Dla każdego aspektu bierzemy z opublikowanego katalogu oceny i parametry według tabeli niżej. Każda wartość to **dowód z ID obserwacji**, np. `padel.how (ocena redakcji): moc maksymalna 9/10`.
4. Model dostaje te linie razem z fragmentami recenzji. Walidator odrzuca każdą liczbę, której nie ma w cytowanych liniach.

## Wynik na 33 pytaniach testowych

| Miara | Wynik |
|---|---|
| Wykrywanie aspektów: precyzja / kompletność / pełne dopasowanie | 97% / 97% / 94% |
| Pytania w pełni obsłużone z danych | **28 z 33** |
| Częściowo z danych | 1 (strona kortu, której nie ma w bazie) |
| Tylko z prozy | 4 (różnice w linii, porównania z innymi markami, praktyczne wnioski, wytrzymałość) |

Zastrzeżenie: oczekiwane aspekty przypisałem sam (`evals/structured/aspects-v0.jsonl`), a „obsłużone z danych” oznacza, że baza ma wartość dla każdego aspektu każdej rakiety, nie że odpowiedź jest dobra.

## Do Twojego przeglądu: mapa „aspekt → dane”

Sprawdź, czy tak myślą gracze. Najważniejsze są kolumny 2 i 3.

| Aspekt | Słowa w pytaniu (przykłady) | Oceny (źródło) | Parametry | Sekcje recenzji |
|---|---|---|---|---|
| moc | smecz, moc, mocna, power, x3/x4, kończy punkt | padel.how: moc maksymalna, łatwość generowania mocy · PadelTrue: moc | — | moc |
| kontrola | kontrola, precyzja | padel.how: kontrola · PadelTrue: kontrola | — | wnioski, dla kogo, sweet spot |
| obrona | obrona, broni, lob, z tyłu kortu, od szyby | padel.how: obrona | — | obrona, wnioski, dla kogo, stabilność |
| gra przy siatce | siatka, wolej, szybkie wymiany | padel.how: gra przy siatce | — | siatka |
| sweet spot | sweet spot, wybaczająca | padel.how: sweet spot · PadelTrue: wybaczalność | — | sweet spot |
| stabilność | stabilna, poza środkiem, skręca się | padel.how: stabilność poza środkiem · PadelTrue: wybaczalność | — | stabilność, sweet spot |
| rotacja | rotacja, podkręcenie, kick, vibora, bandeja, szorstka, faktura | padel.how: rotacja | faktura | rotacja, moc, konstrukcja |
| zwrotność | zwrotna, w ręce, prowadzenie | padel.how: zwrotność · PadelTrue: prowadzenie | waga, balans | prowadzenie, siatka, kształt |
| komfort | komfort, wygodna, łokieć, ramię, wibracje, ból | padel.how: komfort · PadelTrue: komfort | twardość, rdzeń | odczucie, wnioski |
| twardość | twarda, miękka, sztywna, odczucie | — (indeks sztywności padel.how niezaimportowany) | twardość (PadelTrue), rdzeń | odczucie, konstrukcja |
| poziom gracza | początkujący, zaawansowany, dla kogo, nadaje się dla | padel.how: łatwość mocy, sweet spot | poziom gracza | dla kogo, wnioski |
| kształt / waga / balans / materiały / rdzeń / grubość | kształt, diament, łza; waży, lekka; balans; z czego, karbon, 12K; rdzeń, pianka, EVA; grubość, mm | — | odpowiedni parametr | konstrukcja i inne |
| strona kortu | lewa/prawa strona | — (niezaimportowane) | — | dla kogo, wnioski, werdykt, FAQ |
| wytrzymałość | wytrzymała, trwała, pęka | — | — | konstrukcja, FAQ |

## Do Twojego przeglądu: progi słów potocznych (propozycja z rozkładu danych)

Potrzebne do wyszukiwania po cechach (I4) i rekomendacji (I5). Liczby to rozkład w naszym katalogu: 10% / 50% / 90% rakiet ma wartość co najwyżej taką.

| Słowo | Propozycja | Rozkład w katalogu |
|---|---|---|
| „lekka” | średnia waga ≤ 355 g (najlżejsza ćwiartka) | waga: 347,5 / 362,5 / 370 g |
| „ciężka” | średnia waga ≥ 368 g | jw. |
| „miękka” | PadelTrue twardość = soft **albo** padel.how komfort ≥ 8 | twardość PadelTrue: 77 soft, 64 medium, 32 medium-hard, 31 hard; komfort padel.how: 5,5 / 7 / 8,5 |
| „twarda” | PadelTrue twardość = hard / medium-hard | jw. |
| „mocna” | padel.how moc maksymalna ≥ 8,5 | 5 / 7,5 / 9 |
| „łatwa moc” | padel.how łatwość generowania mocy ≥ 8 | 6,5 / 7,5 / 8,5 |
| „obronna” | padel.how obrona ≥ 8 | 6,5 / 7,5 / 8,5 |
| „wybaczająca / duży sweet spot” | padel.how sweet spot ≥ 8 | 6,5 / 7,5 / 8,5 |
| „dla początkującego” | poziom = beginner **albo** (łatwość mocy ≥ 8 i sweet spot ≥ 8) | poziom: 16 beginner, 79 intermediate, 109 advanced |

Uwaga: oceny padel.how są ściśnięte (większość rakiet ma 6,5–8,5), więc progi typu „≥ 8” wybierają zwykle górne ~20–25%.

## Nowe pola w danych (P-045, parser i normalizator 1.3.0)

Właściciel zdecydował 15.10.2026: pola zachowane wcześniej tylko w archiwum (`raw_payload`) stają się zwykłymi obserwacjami. **Opublikowane na Dev 16.10.2026** (za zgodą właściciela w rozmowie) jako wydanie `9fd4b742…`, które zastąpiło `94f807c4…` (poprzednie zostaje do rollbacku).

**Przebieg wydania:**
1. Import parserem 1.3.0 tych samych snapshotów: 217 + 281 rekordów, 0 błędnych.
2. 259 decyzji przeglądowych z audytu 14.10 odtworzonych po źródle i ID rekordu: 0 rakiet dopasowanych inaczej niż w audycie.
3. Bramka: 0 blokad, **0 rakiet dodanych, 0 usuniętych**.
4. Po publikacji 444/444 rakiet zgrupowanych identycznie jak wcześniej, a 8213 dotychczasowych faktów bez żadnej zmiany.
5. Nowe pola: strona kortu 180, styl gry 217, wymagalność 180, przeznaczenie i junior po 217, indeks sztywności 217, tagi PadelTrue 281.
6. Pokrycie pytań testowych danymi: 29 z 33 (`evals/results/structured-2026-10-16.json`).

Uwaga operacyjna: procesy łączące się z Dev potrafiły zawisnąć po zakończeniu pracy (praca w bazie była już zapisana). Stan zawsze sprawdzaliśmy zapytaniem tylko do odczytu, zanim ruszyliśmy dalej.

| Pole | Źródło | Jak zapisane | Wynik na prawdziwym pliku |
|---|---|---|---|
| strona kortu | padel.how | parametr, ocena redakcji (`editorial_assessment`) | obie 78, lewa 72, prawa 30; 37 pustych pominiętych |
| styl gry (lista) | padel.how | jeden parametr, wartości posortowane (`attacking\|spin`) | 217, wszystkie w słowniku |
| wymagalność | padel.how | parametr, ocena redakcji | wymagająca 87, wybaczająca 54, umiarkowana 39 |
| przeznaczenie / junior | padel.how | parametry, ocena redakcji | unisex 196, damskie 17, juniorskie 4; junior: tak 6 |
| indeks sztywności | padel.how | **ocena** redakcyjna 0–100 z zastrzeżeniem „względna w katalogu padel.how, nie pomiar” | 217 |
| tagi profilu | PadelTrue | jeden parametr, oznaczony jako wynik modelu PadelTrue | 281 (np. „arm-friendly” w 63) |

- `feel.power_on_demand` pominięte: we wszystkich 217 rakietach jest równe ocenie „łatwość generowania mocy”.
- Puste wartości źródła nie tworzą obserwacji, więc nie generują pracy przeglądowej. Nieznane wartości spoza słownika idą do przeglądu, nie są zgadywane.
- Symulacja na obu prawdziwych plikach: 0 błędów, **0 rekordów ze zmienionym statusem** przez nowe pola.
- Klasyfikacje redakcyjne nigdy nie trafiają do kanonicznych wartości fizycznych (waga, kształt). Bramka publikacji to wymusza.
- Mapa aspektów rozszerzona o „styl gry” i „przeznaczenie”. „Strona kortu” i „twardość” korzystają z nowych pól, a „komfort” z tagu „arm-friendly”.

Wynik całości po wydaniu: patrz „Przebieg wydania” wyżej.
