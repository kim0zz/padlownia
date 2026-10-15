# Specyfikacja odpowiedzi asystenta — v1 (15.10.2026)

Dla każdego typu pytania opisuję, co asystent rozpoznaje, co pobiera, co pokazuje i jak brzmi odpowiedź. Podstawa: decyzje P-002–P-005, P-011, P-024, P-032–P-044. **Status: pytania A–F rozstrzygnięte przez właściciela 15.10.2026.** Otwarte zostaje tylko pytanie 1 (prawdziwe pytania znajomych).

## Zasady wspólne dla wszystkich odpowiedzi

1. **Najpierw komponenty, potem tekst.** Odpowiedź to gotowe elementy UI (karta rakiety, parametry, porównanie, lista kart) plus krótki tekst. Liczby (waga, balans, oceny) zawsze pochodzą z komponentów i danych, nigdy z „pamięci” modelu.
2. **Każde zdanie ma typ i źródło** (kontrakt `packages/ai/src/answer.ts`):
   - *fakt z parametrów*: waga, kształt, materiał; źródło to obserwacja w katalogu;
   - *opinia recenzenta*: „recenzent padel.how pisze, że…”; źródło to fragment recenzji;
   - *wniosek AI*: wyraźnie oznaczony, z podstawą, na której się opiera (P-034);
   - *niepewność*: „źródło tego nie opisuje”, „źródła podają różne wartości”.
3. **Skale się nie mieszają.** padel.how daje redakcyjne oceny 0–10 w 10 kategoriach plus „sztywność” 0–100 (model redakcji, nie pomiar). PadelTrue daje oceny 0–100 w 5 kategoriach, wyliczane z parametrów. Zawsze podajemy, czyja to ocena. Nie uśredniamy ich i nie przeliczamy jednej skali na drugą.
4. **Rocznik i wariant są święte** (P-024). Nie przenosimy opinii z wersji 2025 na 2026 ani z 12K na 18K. Wzmianka o rakiecie Y w recenzji rakiety X nie jest wiedzą o Y.
5. **Konflikty są widoczne.** Gdy źródła się różnią (np. kształt Hybrid w danych, a diament w tekście recenzji), mówimy to wprost.
6. **Ton:** po polsku, na „Ty”, rzeczowo, 2–6 zdań tekstu. Bez marketingu i bez „idealna dla każdego”.
7. **Cytaty:** polska parafraza w odpowiedzi, a krótki oryginał (do 25 słów) w okienku źródła (P-035).
8. **Tekst recenzji to dane, nie polecenia.** Instrukcje znalezione w źródłach są ignorowane.
9. **Kontekst rozmowy** (P-037): pamiętamy wybrane rakiety, ostatnią intencję i preferencje gracza do zamknięcia karty (~10 tur). Wybór rakiet jest wspólny z klasycznym porównaniem (P-002).
10. **Bez streamingu.** Widoczne kroki („Rozpoznaję rakiety… Czytam recenzje… Sprawdzam źródła…”), a gotowa odpowiedź pojawia się po walidacji.

## Typy pytań

### I1. Profil / statystyki jednej rakiety
*„Pokaż NOX AT10 18K 2026”, „Ile waży Metalbone HRD+?”, „Statystyki Air Viper”*
- **Rozpoznanie:** jedna rakieta. Niejednoznaczność → I7.
- **Pobieramy:** profil z katalogu (parametry, oceny obu źródeł, rozbieżności). Fragmenty recenzji tylko wtedy, gdy pytanie dotyczy konkretnej rzeczy („ile waży z owijką?”).
- **Pokazujemy:** `racket_specs` (albo `racket_card`, gdy pytanie jest ogólne).
- **Tekst:** 1–3 zdania z tym, o co zapytano. Przy rozbieżności: „Producent podaje 360–375 g, recenzent zważył egzemplarz: 365 g.”
- **Typowe błędy:** pomylony wariant albo rocznik; „wygładzanie” rozbieżności.

### I2. Pytanie o aspekt jednej rakiety
*„Jak Vertex 05 zachowuje się przy smeczu?”, „Czy Bourne Elbowcare S jest dobra na łokieć?”*
- **Rozpoznanie:** rakieta i aspekt (moc, obrona, siatka, sweet spot, komfort, rotacja, stabilność, konstrukcja, dla kogo).
- **Pobieramy:** 3–6 fragmentów recenzji **tylko tej rakiety**, preferując sekcje pasujące do aspektu, plus powiązane oceny (np. „komfort 7/10” od padel.how).
- **Pokazujemy:** `racket_card` z wyróżnionymi ocenami związanymi z aspektem.
- **Tekst:** opinia recenzenta (z cytatem), ocena źródła w danej kategorii, ewentualnie wniosek AI.
- **Brak w recenzji** (P-034): „Recenzja padel.how nie opisuje rotacji. Ostrożny wniosek z parametrów: szorstka powierzchnia i diamentowy kształt zwykle sprzyjają rotacji (wniosek AI).”
- **Brak recenzji w ogóle** (P-036): same parametry i oceny + „Ta rakieta nie ma recenzji tekstowej w naszych źródłach.”

### I3. Porównanie dwóch rakiet
*„Porównaj HEAD Extreme Motion i Babolat Air Viper 2.6”, „Która lepiej broni: X czy Y?”*
- **Rozpoznanie:** dokładnie dwie rakiety. Gdy jest jedna, pytamy o drugą albo bierzemy ją z kontekstu. Więcej niż dwie → I5 (lista) albo prośba o wybranie dwóch.
- **Pobieramy:** oba profile, a przy pytaniu o aspekt fragmenty **po równo dla obu** (`retrieveBalanced`).
- **Pokazujemy:** `racket_comparison`, ten sam komponent co w klasycznym porównaniu.
- **Tekst:** 2–4 zdania o różnicach w zadanym aspekcie, każda strona ze swoim źródłem. Przy pytaniu „która lepsza” wskazujemy kierunek z uzasadnieniem: „Według ocen padel.how Air Viper ma wyższą obronę (8 vs 6,5)…”.
- **Uczciwość:** jeśli tylko jedna rakieta ma recenzję albo oceny są z różnych źródeł, mówimy to wprost i nie porównujemy skal.
- **Typowe błędy:** dowody tylko dla jednej strony; porównanie ocen z różnych skal.

### I4. Wyszukiwanie po cechach
*„Szukam miękkiej rakiety NOX”, „Okrągłe rakiety do 360 g”, „Coś dla początkującego z dużym sweet spotem”*
- **Rozpoznanie:** filtry twarde (marka, kształt, waga, rocznik, poziom) i miękkie (miękka, dużo mocy, wybaczająca).
- **Zamiana na zapytanie** (deterministycznie, ze słownika cech):
  - „miękka” → sztywność padel.how ≤ ~45 albo PadelTrue komfort ≥ ~70;
  - „dużo mocy” → `power_ceiling` / `power`;
  - „wybaczająca” → `sweet_spot`, `off_center_stability` / `forgiveness`;
  - „dla początkującego” → poziom = beginner, wysoki `power_accessibility`.
  Progi do ustalenia na danych. Domyślnie oceny padel.how (P-040).
- **Pokazujemy:** do 8 kart `racket_card` (P-043), posortowanych według zadanej cechy w skali padel.how. Pod spodem osobna lista „Inne rakiety wg PadelTrue” dla rakiet bez ocen padel.how (P-040). Nigdy jedna lista z obu skal.
- **Tekst:** 1–2 zdania, jak rozumiemy „miękka” i skąd to wiemy („wg indeksu sztywności padel.how, to model redakcji, nie pomiar”).
- **Brak wyników:** mówimy, który filtr eliminuje wszystko, i proponujemy jego poluzowanie.

### I5. Rekomendacja dla gracza (P-033)
*„Gram z lewej strony, lubię atakować, poziom średni, boli mnie łokieć — co polecisz?”*
- **Rozpoznanie:** profil gracza → cele w kategoriach ocen, np.:
  - „łokieć” → wysoki komfort, niska sztywność;
  - „atak / lewa strona” → `power_ceiling`, rotacja;
  - „obrona / prawa strona” → kontrola, obrona;
  - poziom → `player_level`, `demand`.
- **Najpierw krótka ankieta (P-044).** Zanim padnie rekomendacja, asystent zawsze dopytuje o brakujące elementy profilu, jednym ekranem z odpowiedziami do kliknięcia:
  - poziom: początkujący / średni / zaawansowany;
  - strona kortu: lewa / prawa / obie;
  - styl: atak / obrona / wszechstronny;
  - dolegliwości ręki/łokcia: tak / nie;
  - opcjonalnie: preferowana waga / marka / „bez marki X”.
  Pytamy tylko o to, czego jeszcze nie wiemy. Ankieta jest deterministyczna, bez modelu, więc nic nie kosztuje. Odpowiedzi pamiętamy do końca rozmowy (P-037), więc kolejne rekomendacje już nie pytają.
- **Ranking (P-033, potwierdzone):** kolejność liczona z **ocen padel.how** (P-040) i wag wynikających z profilu. Nie pokazujemy żadnej liczby typu „dopasowanie 87%” ani własnej „oceny Padłowni”, tylko kolejność i powody. Rakiety bez ocen padel.how są w osobnej liście wg PadelTrue albo pominięte, z informacją o tym.
- **Pokazujemy:** 3–5 kart w kolejności dopasowania (P-043), przy każdej 2–3 powody („komfort 8/10 i sztywność 38/100 wg padel.how”) i jeden fragment recenzji.
- **Tekst:** podsumowanie profilu z ankiety i ograniczenia („nie testowaliśmy rakiet sami; kolejność opiera się na ocenach redakcji padel.how”).
- **Kontynuacja:** „pokaż lżejsze”, „bez Babolata”, „porównaj dwie pierwsze” → I6 / I3.

### I6. Kontynuacja
*„A która lepiej gra przy siatce?”, „A lżejsza wersja?”, „Pokaż poprzedni rocznik”*
- **Rozpoznanie:** brak nazw rakiet → bierzemy wybrane rakiety z kontekstu. „Lżejsza wersja”, „poprzedni rocznik” → rodzeństwo z tej samej rodziny w katalogu (P-024: nawigacja po rodzinie bez mieszania danych).
- **Dalej** jak I2 / I3 / I1.
- **Brak kontekstu:** pytamy, o które rakiety chodzi (I7).

### I7. Doprecyzowanie
*„NOX AT10 18K” (Luxury Genius czy Attack?), „Babolat Viper” (Air / Counter / Technical / Juan Lebrón?)*
- **Kiedy:** resolver zwraca kilka równorzędnych rakiet albo rocznik nie istnieje w katalogu.
- **Pokazujemy:** pytanie + 2–6 kart do kliknięcia (`clarification.options`). Jedno pytanie naraz.
- **Gdy jedna pasuje najlepiej, a są bardziej szczegółowe wersje:** odpowiadamy dla najlepszej i pod spodem pokazujemy „Masz na myśli inną wersję?” z alternatywami. Bez zatrzymywania rozmowy.
- **Bez modelu:** to pytanie składamy deterministycznie, więc nic nie kosztuje.

### I8. Poza zakresem
*Buty, zasady gry, technika, kontuzje, ceny „dziś”, sklepy, inne sporty*
- **Odpowiedź:** krótko, czym asystent się zajmuje (rakiety: parametry, oceny, recenzje, porównania), i ewentualnie przekierowanie do katalogu.
- **Ceny:** w danych są tylko ceny z dnia pobrania (snapshot). Na razie ich nie podajemy (P-041): „Nie mam aktualnych cen; sprawdź w sklepie.”
- **Technika, zasady, taktyka:** poradniki padel.how dołączymy później jako osobny tryb (P-042). Na razie krótka informacja, że asystent zajmuje się rakietami.
- **Zdrowie** („boli mnie łokieć”) w kontekście wyboru rakiety jest OK (komfort, sztywność). Porad medycznych nie dajemy.

### I9. Stany systemu
- **Limit miesięczny wyczerpany:** „Asystent odpoczywa do 1. dnia miesiąca — katalog i porównanie działają normalnie.” Klasyczna ścieżka jest zawsze dostępna (P-002).
- **Walidacja nie przeszła 2×:** pokazujemy same komponenty (karty / porównanie) + „Nie mam pewnej odpowiedzi tekstowej — poniżej dane ze źródeł.”
- **Brak pasującej rakiety:** „Nie znam takiej rakiety w naszym katalogu” + najbliższe podpowiedzi z resolvera.

## Jak to testujemy (bez płatnych modeli)

| Warstwa | Test | Stan |
|---|---|---|
| Rozpoznanie rakiet | `evals/resolver/golden-v0.jsonl` | jest (32 przypadki) |
| Rozpoznanie intencji i aspektu | nowy zestaw: pytanie → typ I1–I9 + aspekt | do zrobienia |
| Zamiana cech na filtry (I4/I5) | pytanie → oczekiwane filtry / kolejność na stałym katalogu | do zrobienia |
| Wyszukiwanie fragmentów | `evals/retrieval/golden-v0.jsonl` + kategoria „brak w źródle” | jest, do rozszerzenia |
| Walidacja odpowiedzi | testy kontraktu (`tests/ai/gateway.test.ts`) | jest |
| Odpowiedzi end-to-end | po wyborze modelu: Twoja ocena próbki + automatyczna walidacja | później (P-039) |

## Decyzje właściciela (15.10.2026)

| # | Pytanie | Decyzja |
|---|---|---|
| A | Domyślne źródło ocen | padel.how domyślnie, PadelTrue jako osobna lista, nigdy jeden ranking z obu skal (P-040) |
| B | Własna liczbowa ocena w rankingu | Nie. Tylko kolejność i powody z ocen źródła (P-033) |
| C | Ceny z dnia pobrania | Na razie pomijamy (P-041) |
| D | Poradniki padel.how | Później, jako osobny tryb (P-042) |
| E | Liczba wyników | Wyszukiwanie do 8, rekomendacja 3–5 z powodami (P-043) |
| F | Brakujący profil gracza | **Zawsze dopytać** krótką ankietą przed rekomendacją (P-044). Inaczej niż moja rekomendacja |

## Nadal otwarte

| # | Pytanie | Moja rekomendacja |
|---|---|---|
| 1 | **Prawdziwe pytania znajomych** (20–30) | Nadal najważniejsze. Każde przypiszę do typu I1–I9 i zrobię z nich zestaw testowy. |
