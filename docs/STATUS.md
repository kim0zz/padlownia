# Stan projektu (16.10.2026)

Jedno źródło odpowiedzi na pytanie „co działa teraz”. Starsze raporty zostają jako historia.

## Działa

- **Katalog, profil, porównanie** na danych Supabase Dev: wydanie `48dfe3eb…`, 420 rakiet, w tym 76 z danymi z dwóch źródeł. Poprzednie wydanie `9fd4b742…` jest zachowane do cofnięcia.
- **Szybkość:** 7–16 ms na stronę dzięki katalogowi w pamięci (R1). Nowe wydanie pojawia się na stronie najpóźniej po ~60 s.
- **Wygląd (P-046):** bez „wariant nieustalony” i „rok nieznany”. Pola padel.how są po polsku, puste wiersze ukryte.
- **Jedna nazwa na markę (R3):** 34 marki.
- **Oceny PadelTrue jako „Profil konstrukcji”:** to wzór z kształtu, balansu i wagi, a nie ocena jakości. Pokazujemy je słownie (niski … wysoki poziom), bez paska. „Stosunek jakości do ceny” jest ukryty.
- **Parser 1.3.0** i ponowny przegląd tego samego pliku (`--reprocess-tag`); tak opublikowano połączenie 24 bliźniaków.
- **Etap 2:** generator kandydatów dopasowań (`npm run candidates`) i lokalny widok przeglądu `/przeglad-dopasowan` (tylko tryb deweloperski).
- **Asystent, wersja 1 (podgląd):** `/asystent` w trybie deweloperskim. Dwie intencje i doprecyzowanie, odpowiedzi tylko z danych katalogu z przypisami, bez modelu językowego.
- **Zdjęcia:** obsługa w aplikacji gotowa. Brak zgód (`docs/product/IMAGE_OUTREACH.md`).

## Czeka na decyzję właściciela

| # | Decyzja | Gdzie | Rekomendacja |
|---|---|---|---|
| 1 | Wysłać maile do 10 marek o zdjęcia | `docs/product/IMAGE_OUTREACH.md` | Tak, z własnej skrzynki |
| 2 | Zarejestrować się w programach partnerskich (Padel Nuestro / CJ, Padel Market / Awin) | jw. | Tak, po publicznym starcie strony albo z opisem projektu |
| 3 | Rozstrzygnąć 11 par kandydatów (7 wysokiej pewności) | `/przeglad-dopasowan` | Przejrzeć; zatwierdzone połączę nowym wydaniem jak 1.3.1 |
| 4 | 9 par „ta sama nazwa, inny rocznik” | jw., sekcja na dole | Tylko do wglądu; ewentualnie zgłosić źródłu |
| 5 | Migracja `knowledge_chunks` + `pgvector` + `ai_usage` na Dev | `docs/ai/AI_ENGINEERING_PLAN.md` (B, D) | Tak, addytywna; daje asystentowi cytaty z recenzji |
| 6 | Pobranie lokalnego rerankera (kilkaset MB) do pomiaru | jw. | Dopiero po migracji; tylko jeśli pomiar pokaże zysk |
| 7 | Konto OpenRouter i benchmark do 5 zł (P-039) | jw. | Po kroku 5; wtedy model zastąpi autora deterministycznego |
| 8 | Kopia zapasowa `.local` poza laptopem (R4) | — | Pilnie: są tam klucze, decyzje przeglądu i skrypty wydań |

## Znane braki

- Część wartości w dowodach asystenta jest po angielsku (np. „diamond”, „head_heavy”).
- Testy e2e nadpisują zrzuty w repozytorium (R8). Przed commitem trzeba je przywracać.
- Strona nie jest publiczna (Vercel, kod zaproszenia: Etap 4).
