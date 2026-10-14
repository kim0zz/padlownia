# Przegląd uprawnień źródeł — 14 października 2026

**Wynik: istnieje pisemna zgoda padel.how na opisany katalog porównawczy. Nie trzeba ponownie pytać właściciela Padłowni o zgodę na tę samą funkcję.** P-021 pozostaje przyjęte. Poniższy zakres nie zatwierdza publikowania pełnych recenzji, zdjęć ani eksportu bazy źródłowej.

## Dowody i zakres bieżącej funkcji

| Źródło | Sprawdzone dowody | Zalecany zapis w bazie |
| --- | --- | --- |
| padel.how | Odczytano oryginalny wątek w połączonym Gmailu: pozytywna odpowiedź autora z 13.10.2026 zawiera cytowaną prośbę o użycie danych na polskiej stronie porównującej informacje o rakietach z różnych źródeł, w tym parametry producentów i odczucia graczy. Prośba zobowiązuje do atrybucji i hiperłączy. | `rights_status=approved`, `catalogue_display_allowed=true`; zakres ograniczony do opisanego katalogu i porównań, z zachowaniem warunków atrybucji. |
| PadelTrue | Dostarczony eksport deklaruje CC BY 4.0; potwierdzają to aktualne [Open data](https://padeltrue.com/data) oraz [Terms of use](https://padeltrue.com/terms). | `rights_status=approved`, `catalogue_display_allowed=true`; CC BY 4.0 dla danych, z atrybucją, linkiem licencji i wskazaniem zmian. |

Przeszukanie poczty było ograniczone do padel.how i kontaktu tego źródła; znaleziono jedną rozmowę z odpowiedzią oraz podziękowaniem. Nie wysłano wiadomości, nie tworzono szkicu i nie zmieniano etykiet. W nazwach dostarczonych plików `sources/` nie znaleziono korespondencji. Oryginał pozostaje w Gmailu; minimalna kopia dowodu, dokładny identyfikator wiadomości, data i SHA-256 są wyłącznie w ignorowanym `.local/adjudication/`. Publiczne repo nie zawiera tekstu ani danych osobowych z poczty.

Powyższy zapis jest realizacją już przyjętej P-021 na podstawie sprawdzonego dowodu, nie nową decyzją produktową ani nieograniczoną licencją. Zakres wiadomości obejmuje stronę internetową; wzmianka, że projekt był wtedy lokalny i bez domeny, nie została sformułowana jako warunek ograniczający zgodę wyłącznie do lokalnego komputera.

## Warunki publikacji danych

[padel.how Copyright and Data Reuse](https://padel.how/copyright/) wymaga wskazania źródła, modelu, konkretnej recenzji, daty pobrania oraz skali i metodologii przy ocenach poza pierwotnym kontekstem. Dopuszcza krótkie cytaty i indywidualne parametry/oceny; pełne recenzje, mirroring katalogu i redystrybucja zbioru wymagają pisemnej zgody. Znaleziona korespondencja dokumentuje zgodę na użycie danych w opisanej stronie porównawczej. Nie interpretujemy jej jako zgody na udostępnienie pobieralnej kopii całej bazy lub pełnych artykułów.

[Dokumentacja API padel.how](https://padel.how/api/) udostępnia JSON, Markdown i pliki LLM do pracy programów i kontekstu agentów, z zachowaniem atrybucji. To wspiera dotychczasowy prywatny audyt i odczyt dostarczonych materiałów; sam dostęp techniczny nie rozszerza zakresu publikacji. Specyfikacje i fotografie pochodzące od producentów zachowują odrębne prawa.

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) pozwala korzystać i adaptować dane, również komercyjnie, przy atrybucji, linku licencji i informacji o zmianach, bez sugerowania poparcia autora. PadelTrue wyłącza zdjęcia oraz prawa do nazw marek/modeli ze swojej licencji; nie wyprowadzamy z niej uprawnień do zdjęć lub znaków towarowych. Jego oceny należy przedstawiać jako wyniki modelu specyfikacji, nie testy na korcie.

Kontrola UI wykazała istniejące nazwy źródeł, linki do produktu, skale ocen i daty parametrów. Uzupełniono datę przy ocenach, klikalny bezpieczny link metodologii oraz informację CC BY 4.0 ze wskazaniem normalizacji PadelTrue, widoczną tylko przy danych tego źródła. Dopiski o brakujących wejściach modelu i walucie pozostają w całości widoczne obok linku. Dane syntetyczne zachowują własne oznaczenie i nie otrzymują rzeczywistej licencji źródła.

Przeszło 16 testów renderowania/logiki web, TypeScript web oraz ESLint zmienionych plików. Trzy E2E w Edge sprawdziły tryb fixture, klawiaturę, układ desktop/mobile i automatyczny audyt WCAG AA; obejrzano odświeżony zrzut profilu. Linki i warunkowa licencja rzeczywistych źródeł mają regresje renderowania na danych syntetycznych. Po publikacji osobna próba rzeczywistego katalogu Supabase zaliczyła 8/8 kontroli, w tym linki obu metodologii i recenzji, daty, skale, licencję oraz pełne zastrzeżenie modelu. Ten wynik jest oddzielny od fixture E2E.

## Czego nadal nie potwierdza korespondencja

- Publikacji pełnych tekstów lub ich pełnych tłumaczeń oraz dystrybucji osobnego eksportu bazy padel.how.
- Zakresu praw do zdjęć producentów i innych podmiotów.
- Trwałych embeddingów, treningu/fine-tuningu oraz przekazywania pełnych recenzji zewnętrznym dostawcom modeli. Wiadomość nie omawia tych operacji; nie jest to dowód ich zakazu.

Te kwestie należy rozstrzygać przed wdrożeniem danej przyszłej funkcji. **Nie stanowią warunku obecnego katalogu specyfikacji i ocen.** O-002 może pozostać otwarte w tym węższym zakresie. Nie ma tu aktualnego pytania o ponowne udzielenie zgody katalogowej.

Prywatny manifest `source-permissions.json` zawiera wersję schematu, czas przeglądu i `decisions[]`, gdzie każdy wpis ma `source`, statusy oraz `permission: {reference, scope}` zgodne z funkcją `setSourcePermission`. Wpisy zastosowano w potwierdzonym Dev po przeglądzie dowodów. Oba źródła mają `approved`; 15.10.2026 o 00:02 czasu Warszawy opublikowano katalog po przejściu wszystkich bramek. [Raport rozstrzygnięć](SOURCE_REVIEW_RESULTS_2026_10_14.md) zawiera identyfikatory i weryfikację. Prywatna wiedza tekstowa nadal nie jest publicznym endpointem ani zaakceptowaną bazą chatu.
