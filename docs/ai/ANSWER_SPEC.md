# Specyfikacja odpowiedzi asystenta — wersja robocza v0 (15.10.2026)

Dla każdego typu pytania opisuję, co asystent rozpoznaje, co pobiera, co pokazuje i jak brzmi odpowiedź. Podstawa: decyzje P-002–P-005, P-011, P-024, P-032–P-039. **Status: do Twojej akceptacji.** Pytania otwarte są na końcu.

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
  Progi do ustalenia na danych (pytanie A).
- **Pokazujemy:** 3–8 kart `racket_card`, posortowanych według zadanej cechy w **jednej** skali (tej, którą wybrał filtr) + informacja, ile rakiet pominięto, bo nie mają tej oceny.
- **Tekst:** 1–2 zdania, jak rozumiemy „miękka” i skąd to wiemy („wg indeksu sztywności padel.how, to model redakcji, nie pomiar”).
- **Brak wyników:** mówimy, który filtr eliminuje wszystko, i proponujemy jego poluzowanie.

### I5. Rekomendacja dla gracza (P-033)
*„Gram z lewej strony, lubię atakować, poziom średni, boli mnie łokieć — co polecisz?”*
- **Rozpoznanie:** profil gracza → cele w kategoriach ocen, np.:
  - „łokieć” → wysoki komfort, niska sztywność;
  - „atak / lewa strona” → `power_ceiling`, rotacja;
  - „obrona / prawa strona” → kontrola, obrona;
  - poziom → `player_level`, `demand`.
- **Ranking (proponowane ograniczenie, czeka na potwierdzenie):** dopasowanie liczone z **ocen podawanych przez jedno źródło** i wag wynikających z profilu. Nie powstaje żadna „ocena Padłowni” pokazywana jako liczba; pokazujemy kolejność i powody. Rakiety bez ocen w wybranym źródle są pominięte, z informacją o tym.
- **Pokazujemy:** 3–5 kart w kolejności dopasowania, przy każdej 2–3 powody („komfort 8/10 i sztywność 38/100 wg padel.how”) i jeden fragment recenzji.
- **Tekst:** jak zrozumieliśmy Twój profil (żeby można było poprawić: „Zakładam poziom średni i ból łokcia — czy dobrze?”) i ograniczenia („nie testowaliśmy rakiet sami; ranking opiera się na ocenach padel.how”).
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
- **Ceny:** w danych są tylko ceny z dnia pobrania (snapshot). Na razie nie odpowiadamy o ceny (pytanie C).
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

## Pytania otwarte do Ciebie

| # | Pytanie | Moja rekomendacja |
|---|---|---|
| A | **Ranking i „miękka / mocna”:** które źródło ocen jest domyślne? padel.how (217 rakiet, 10 kategorii, ocena redakcji) czy PadelTrue (281 rakiet, 5 kategorii, wyliczane z parametrów)? | padel.how domyślnie (bogatsze, z recenzją), PadelTrue jako druga lista „inne rakiety wg PadelTrue”. Nigdy nie mieszamy obu w jednym rankingu. |
| B | **Potwierdzenie ograniczenia do P-033:** ranking z ocen źródeł i dopasowania, bez własnej liczbowej „oceny Padłowni”? | Tak. Inaczej łamiemy zasadę „nie wymyślamy ocen” z `AGENTS.md`. |
| C | **Ceny:** pokazywać ceny z dnia pobrania (z datą) czy pomijać? | Na razie pomijać. Ceny szybko się starzeją, a nie mamy aktualizacji. |
| D | **Poradniki padel.how** (371 dokumentów: technika, zasady, taktyka): włączyć później do asystenta? | Później, jako osobny tryb. Na start skupiamy się na rakietach. |
| E | **Ile wyników** w wyszukiwaniu i rekomendacji? | Wyszukiwanie: do 8 kart. Rekomendacja: 3–5 z powodami. |
| F | **Profil gracza:** dopytywać o brakujące informacje (poziom, strona kortu) przed rekomendacją czy zgadywać i pokazać założenia? | Pokazać założenia i od razu dać wynik. Dopytać tylko, gdy nie wiemy nic. |
| 1 | **Prawdziwe pytania znajomych** (20–30) | Nadal najważniejsze. Każde przypiszę do typu I1–I9 i zrobię z nich zestaw testowy. |
