Zastąpione przez [UX v3](UX_V3_RESULTS.md).

# Porównanie — gęsty układ i wyszukiwanie

Zlecenie właściciela z 15.10.2026: tekstowe wyszukiwanie z dropdownem, obie rakiety od razu po porównaniu, znacznie więcej parametrów w pierwszym widoku, graficzne oceny i pomocnicza zieleń. Jest to poprawka UX w otwartym PR Sprintu 02; nie wymaga zmiany przyjętych reguł danych ani merge'a wcześniejszej wersji.

## Wykonana zmiana

- Usunięto duży marketingowy nagłówek porównania. Tray wyboru nie jest powtarzany na ekranie porównania; licznik pozostaje w nawigacji. Małe kontrolki usuwania/wyczyszczenia zachowują działanie wyboru.
- Obie tożsamości i miejsce na zdjęcia poprzedzają tabelę danych. W gotowym porównaniu zmiana pary jest dostępnym rozwinięciem. Pusta lub niepełna para od razu pokazuje wyszukiwarki.
- Natywne selecty zastąpiono tekstowym comboboxem: filtr wszystkich wpisanych słów, wariant i rok, lista wyników, strzałki/Enter/Escape oraz wybór myszą. Edycja tekstu zeruje stare ID; sam tekst bez wyboru nie może wysłać poprzedniej rakiety.
- Parametry mają wspólne, zwarte wiersze. Oryginalne obserwacje i ślad pochodzenia są dostępne w rozwinięciu. Tłumaczenie kategorii balansu nie zmienia oryginalnej wartości.
- Oceny pokazują liczbę, oryginalną skalę i pasek `meter` w tej skali. Nieznana/nieprawidłowa skala nie tworzy paska ani zera. Pełna metodologia pozostaje w szczegółach; przy brakujących wejściach modelu jest widoczne ostrzeżenie. Źródła nie są uśredniane.
- Ciemna zieleń nagłówka, jasnozielone powierzchnie i rozróżnienie kolumn korzystają ze wspólnych tokenów. Kolor uzupełnia tekst, nie jest jedynym oznaczeniem.
- Obrazy mają osobny zakres zgód, dopasowanie dokładnego wariantu/wydania i kontrolowany fallback. [Stan praw i podłączenie](../development/IMAGE_ASSET_POLICY.md). Rzeczywiste fotografie pozostają niepodłączone do czasu otrzymania odpowiedniego dowodu; syntetyczna ilustracja służy wyłącznie testom.

## Sprawdzenie i dowody

Zastosowano vendored UI UX Pro Max: zapytanie o gęsty dashboard oraz osobne wskazówki autocomplete/klawiatury. Sugestia marketingowego hero nie pasowała do zadania i została odrzucona zgodnie z wymaganiem właściciela. Zachowano istniejącą typografię i wybrano zieleń wskazaną przez właściciela.

Test przeglądarkowy sprawdza położenie obu kart powyżej 500 px i pięciu głównych parametrów w pierwszym ekranie 1440×900. To realna asercja geometrii, nie samo istnienie tekstu w DOM. Pozostałe scenariusze obejmują autocomplete, nieaktualne ID po edycji, sesję, stare wydania, awarię obrazka, mobile i axe. Wykryty niewystarczający kontrast podpisów zdjęć na zielonym tle poprawiono.

Zrzuty po zmianie są w [screenshots](screenshots/), wcześniejszy układ zachowuje commit Sprintu 02 `eb85e2b`. Pełny check zaliczył **392 testy w 22 plikach**, TypeScript, ESLint i build. Po końcowych zmianach ponownie zaliczono 213 testów warstwy web, TypeScript, ESLint, build oraz **12/12 E2E w Edge (19,3 s)**. Testy nie wyłączają reguł axe; obejmują też otwarcie dropdownu osobnym przyciskiem z klawiatury i awarię obrazu.

**Rzeczywisty Dev: 9/9 sprawdzeń**, 15.10.2026 o 10:15:56 CEST, bez zapisów. Wpisano nazwy modeli z raportu właściciela, wybrano dokładne NOX ML10 Pro Cup COORP 2027 oraz Adidas Metalbone Carbon 2026 i porównano w istniejącym release `94f807c4-b78f-4394-be11-1d3ab00f3809`. Obie rakiety oraz pięć podstawowych wierszy parametrów mieszczą się w ekranie 1381×857; dolna krawędź piątego wiersza wyniosła **850,97 px**. Pojawiło się 12 pasków ocen w ich źródłowych skalach, widoczne ostrzeżenie o niepełnych danych i rozwijana metodologia. Desktop i mobile 375 px zaliczyły axe A/AA bez wykrytych naruszeń; nie było poziomego przepełnienia ani błędów JS strony. Nieaktualny release nadal wymaga jawnego odświeżenia.

Rzeczywiste zdjęcia nie zostały opublikowane. Test potwierdził dwa jawne stany braku fotografii, a obsługę obrazów i awarii sprawdzono na własnej ilustracji fixture. Prywatny raport i zrzuty Dev są w ignorowanym `.local/ux-dev/`; nie kopiujemy realnego korpusu do repo.

Przegląd kodu wykrył problem focusu osobnego przycisku dropdownu; otwarcie przenosi teraz focus do pola i ma regresję klawiatury. Zawężono również przekazywane klientowi metadane obrazu: dowód zgody nie jest serializowany. Impeccable pozostaje niezainstalowane; nie deklarujemy jego audytu. Koszt LLM: 0 PLN.
