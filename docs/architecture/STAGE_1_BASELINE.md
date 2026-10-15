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
