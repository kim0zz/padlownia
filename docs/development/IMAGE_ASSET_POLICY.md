# Zdjęcia rakiet — źródła, brakująca zgoda i podłączenie

Sprawdzono 15.10.2026. **Obecne uprawnienia do katalogu danych nie potwierdzają uprawnień do zdjęć.** Dostępny URL pliku jest lokalizatorem, nie dowodem licencji.

## Skąd zdjęcia w istniejących serwisach

[padel.how Copyright and Data Reuse](https://padel.how/copyright/) rozróżnia fotografie własne oraz zdjęcia produktowe producentów. Dla materiałów własnych podaje „All rights reserved”. Fotografii producentów nie może udzielać na własnej licencji; obowiązują warunki właściciela. Dostarczone JSON-y zawierają pola `image`, ale nie stanowi to dodatkowej zgody na ich publikowanie w Padłowni.

[PadelTrue Terms of use](https://padeltrue.com/terms), aktualizacja 14.10.2026, wyraźnie wyłącza fotografie z CC BY 4.0 obejmującej zbiór danych. Zdjęcia, nazwy marek i modeli należą do ich właścicieli. [Open data](https://padeltrue.com/data) udostępnia parametry i wyniki modelu; nie rozszerza licencji na fotografie.

Dokumentacja dotychczasowej zgody padel.how dotyczy danych w polskiej stronie porównawczej, a nie fotografii. Szczegóły korespondencji pozostają prywatne; [przegląd zakresu](SOURCE_PERMISSION_REVIEW.md) nie został zmieniony w zgodę na zdjęcia. Nie można na tej podstawie uznać, że wszystkie zdjęcia widoczne w innym serwisie są dostępne dla Padłowni.

## Co dokładnie jest potrzebne

Jedna z poniższych podstaw dla **konkretnego zdjęcia lub określonego zbioru**:

- pisemna zgoda właściciela fotografii, obejmująca polski katalog i porównywarkę;
- warunki oficjalnego pakietu medialnego/partnerskiego producenta, które obejmują taki sposób użycia;
- właściwa otwarta licencja fotografii z atrybucją;
- własne zdjęcie lub zdjęcie przekazane przez autora z odpowiednią zgodą.

Trzeba ustalić autora/właściciela, dozwolone modele i roczniki, podpis, możliwość osadzania, pobierania/przechowywania i tworzenia miniaturek oraz ewentualne ograniczenia użycia komercyjnego. Zgoda padel.how na fotografie własne nie obejmuje automatycznie zdjęć producenta. Sam hotlink lub miniatura nie stanowi w tym procesie zastępczego dowodu uprawnienia.

Gotowy zakres prośby do właściciela zdjęć (nie wysłano żadnej wiadomości):

> Proszę o zgodę na użycie wskazanych zdjęć rakiet w polskim katalogu i porównywarce Padłownia. Czy zgoda obejmuje wyświetlanie zdjęć, przechowywanie ich kopii i przygotowanie pomniejszonych/skomprymowanych wersji na potrzeby strony, również w przypadku późniejszego użycia komercyjnego? Proszę wskazać wymagany podpis i link, ewentualne ograniczenia oraz potwierdzić, które zdjęcia są Państwa własnością lub mogą być przez Państwa sublicencjonowane. Materiały producentów, do których nie mogą Państwo udzielić praw, proszę wyraźnie wyłączyć.

To brakujący dowód od właściciela zdjęć, nie pytanie o ponowne zatwierdzenie dostępu do Supabase czy katalogu danych. Nie zarejestrowano kont partnerskich, nie zaakceptowano cudzych warunków w imieniu właściciela Padłowni i nie wysłano korespondencji.

## Co działa w aplikacji

`RacketVisual` wyświetla zatwierdzony obraz z tekstem alternatywnym i podpisem/linkiem. Obsługuje błąd pobrania i wyraźny stan „Zdjęcie niedostępne”. Ilustracja zastępcza nie udaje fotografii konkretnego produktu. W fixture znajduje się własna, syntetyczna ilustracja TESTLAB na CC0; nie opisuje wyglądu rzeczywistej rakiety.

Opcjonalny `CATALOGUE_IMAGE_MANIFEST` wskazuje **serwerową ścieżkę do lokalnego pliku JSON**. Brak pliku, błędny schemat, niezatwierdzony status, niepasujący release/ID lub dwa wpisy dla tej samej pozycji nie dodają zdjęcia. Reader katalogu nadal korzysta wyłącznie z obecnego opublikowanego wydania i nie pobiera snapshotów. Nie zmieniono DB ani Storage.

Schemat manifestu ma `version: 1` i listę `images`. Każdy wpis zawiera dokładne `racketId`, `releaseId`, `url`, `alt`, `credit`, `sourceUrl`, `rightsStatus: "approved"`, `licence` (`CC0`, `CC-BY-4.0` albo `written-permission`) oraz `permissionReference`: niejawny identyfikator dowodu, np. `photo-permission-2026-10-15`, lub publiczny URL warunków. Prywatne wiadomości, tokeny i linki z credentials nie mogą trafiać do tego pliku. Własne ilustracje mogą używać ścieżek `/media/rackets/...`; zdalny asset i publiczne odnośniki muszą mieć bezpieczny HTTPS URL bez credentials, query i fragmentu.

Operator dodaje wpis dopiero po sprawdzeniu dowodu. Walidator kontroluje strukturę i dopasowanie; nie potrafi sam potwierdzić autorstwa ani zakresu praw. Plik powinien pozostać poza Git, o ile zawiera rzeczywiste zbiory lub prywatne metadane. Do przeglądarki trafiają wyłącznie `url`, `alt`, `credit`, `sourceUrl` i publiczna nazwa licencji. Dowód zgody pozostaje na serwerze. Pełny katalog nie jest serializowany do komponentu zdjęcia. Przy otwartej licencji wyświetlamy również odnośnik CC0 lub CC BY 4.0.

**Aktualny wynik:** rzeczywiste zdjęcia w Dev pozostają niepodłączone z powodu braku potwierdzonego zakresu praw. Obsługa obrazów, testowy asset, stan braku i awarii są gotowe. Podłączenie zatwierdzonych pozycji nie wymaga kolejnej zmiany układu UI.
