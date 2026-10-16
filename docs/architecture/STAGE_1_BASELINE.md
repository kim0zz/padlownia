# Etap 1 — pomiar bazowy odczytu (15.10.2026)

**Jak mierzone:** produkcyjny build (`next build` + `next start`) na laptopie właściciela, `CATALOGUE_MODE=supabase` (Supabase Dev, aktywne wydanie `94f807c4…`). Skrypt: `node scripts/measure-ttfb.mjs http://127.0.0.1:3200 20` z `MEASURE_RELEASE=<id wydania>`. Każda strona: 1 zapytanie „zimne” + 20 kolejnych, po kolei.

| Strona | Pełny czas — mediana | p90 | HTML |
|---|---|---|---|
| `/` (katalog) | **1603 ms** | 1676 ms | 237 KB |
| `/rakiety/[id]` (profil) | **1549 ms** | 1630 ms | 93 KB |
| `/porownaj` (2 rakiety) | **~1550 ms** | — | 257 KB |

(`/porownaj`: mediana z przebiegu 15 prób; przebieg 20-próbowy przerwała awaria serwera — niżej.)

**TTFB nie jest tu dobrą miarą.** Strony najpierw wysyłają szkielet ładowania (`loading.tsx`), więc pierwszy bajt przychodzi po 3–6 ms. Użytkownik czeka na właściwą treść: ~1,6 s. Cel Etapu 1 liczymy więc na **pełnym czasie odpowiedzi** (cel orientacyjny: < 300 ms z ciepłym cache).

**Wniosek:** wszystkie trzy strony kosztują tyle samo, bo każda pobiera cały katalog (`published_catalogue()`, ~900 ms w bazie + 5,7 MB JSON + nowa pula `pg` i TLS). Profil jednej rakiety nie jest tańszy od listy 444 — to potwierdza R1/R2 z audytu.

**Awaria podczas pomiaru:** po ~95 zapytaniach z rzędu proces `next start` zakończył się błędem natywnym Windows `0xC0000409`. Powtórka: 150 zapytań na `/`, pamięć stabilna (190→260 MB), uchwyty stałe (~310), bez awarii. Nie odtworzone — do obserwacji. Hipoteza: tworzenie i zamykanie nowej puli TLS przy każdym żądaniu; R1 (singleton puli) usuwa tę ścieżkę, więc po R1 powtórzyć test 300 zapytań.

## Po R1 (15.10.2026, gałąź `perf/r1-pool-cache`)

**Co zmienione:** jedna współdzielona pula `pg` na proces (`sharedPgExecutor`, bez nowego TLS na żądanie; obsługa błędów bezczynnych połączeń), sprawdzenie tożsamości bazy raz na pulę, katalog w pamięci serwera przez 60 s, potem odświeżany w tle (odwiedzający dostaje kopię z pamięci); jeden odczyt naraz zamiast równoległych; po 10 min bez udanego odświeżenia — strona czeka na świeże dane albo pokazuje „niedostępne”.

| Strona | Pełny czas — mediana przed → po | p90 po | HTML |
|---|---|---|---|
| `/` (katalog) | 1603 ms → **16 ms** | 21 ms | 234 KB |
| `/rakiety/[id]` (profil) | 1549 ms → **7 ms** | 9 ms | 92 KB |
| `/porownaj` (2 rakiety) | ~1550 ms → **14 ms** | 27 ms | 255 KB |

Ten sam skrypt i wydanie (`94f807c4…`, 444 rakiety, dane z Supabase Dev — sprawdzone w HTML). **Pierwsze żądanie po starcie serwera** nadal trwa ~1,56 s (pusta pamięć: nowa pula + pełny odczyt); każde kolejne ~10–25 ms. Cel < 300 ms z ciepłym cache: spełniony.

**Stabilność:** 300 żądań (rotacja 3 stron) co 0,4 s przez 125 s — 0 błędów, mediana 15 ms, max 29 ms, w tym odświeżenia w tle po 60 s; potem 300 żądań bez przerw — 0 błędów, max 33 ms. Uchwyty stałe (306), pamięć 112 → 272 MB (katalog w pamięci ~ kilka MB + rozgrzany Next). Awarii `0xC0000409` nie było.

**Ograniczenie i następny krok (wymaga zgody — migracja):** rola `padlownia_web` nie ma prawa czytać `catalog_state` ani `catalog_releases` (sprawdzone: `permission denied`), więc „tanie zapytanie o ID aktywnego wydania” nie jest możliwe bez migracji. Dlatego świeżość liczona jest czasem: nowe wydanie albo wycofanie źródła pojawia się na stronie najpóźniej po ~60 s (+ czas odczytu). Propozycja: addytywna funkcja `padlownia.published_release_id()` (`security definer`, ten sam warunek co CTE `active` w `published_catalogue()`, w tym prawa źródeł; `grant execute` dla `padlownia_reader`) — wtedy cache będzie kluczowany ID wydania i odświeżany natychmiast po zmianie. Można to połączyć z R2.

## R3 — jedna nazwa na markę (16.10.2026)

Źródła zapisują marki różnie („Cork” / „Cork Padel”, „STARVIE” / „StarVie”, „QUAD”, „SANE”, „VOLT”), przez co jedna marka była kilkoma pozycjami w filtrze. Tabela nazw kanonicznych w `packages/domain/src/brands.ts` jest stosowana przy wczytaniu katalogu (Supabase i snapshot); nazwa modelu jest skracana o każdą znaną pisownię marki, a stare linki z `?brand=STARVIE` trafiają do „StarVie”. Na wydaniu 1.3.0: **36 → 34 marki** (Cork 9, StarVie 25). Bez migracji i bez zmiany kluczy dopasowania — te zostają do R5 (kandydaci dopasowań), żeby nie zmieniać zapisanych tożsamości. Nieznane marki wyświetlane bez zmian; nową pisownię dopisuje się w tabeli.
