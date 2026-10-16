# Pary do połączenia: rekord bez rocznika → rakieta z rocznikiem (16.10.2026)

Wydanie 1.3.0 ma 24 rekordy bez rocznika, które mają tę samą markę, model i wariant co rakieta z rocznikiem. Analiza (parametry, strony źródłowe, numery produktów, sklepy) wykazała, że to **ta sama rakieta**, której rocznika źródło nie opisało. Połączenie: rekord bez rocznika (zawsze PadelTrue) zostaje przypisany do rakiety z rocznikiem. Rakieta dostaje wtedy dane i oceny z obu źródeł, a duplikat znika. Zasada P-008: nic nie łączy się bez zatwierdzenia właściciela. Identyfikatory do wykonania są w `.local/adjudication/twin-merge-candidates.json`.

Pewność: **M** (mocna) = numer produktu, kod lub data premiery potwierdzają rocznik; **Ś** (średnia) = bieżąca strona producenta lub sklepu i zgodne parametry.

| # | Rakieta | Rocznik | Pewność | Dowód |
|---|---|---|---|---|
| 1 | Adidas Metalbone Superlight | 2026 | Ś | Oba rekordy z PadelTrue; oficjalna masa 2026 to 315–330 g (zgodna z rekordem bez roku). Po połączeniu widoczna rozbieżność masy (345–360 g ze sklepu). |
| 2 | Babolat Air Veron 2.6 | 2026 | M | babolat.com 150180, seria 2.6 = 2026; parametry identyczne |
| 3 | Babolat Air Vertuo 2.6 | 2026 | M | babolat.com 150184; parametry identyczne |
| 4 | Babolat Air Viper 2.6 | 2026 | M | babolat.com 150176; sklepy: „Air Viper 2.6 2026” |
| 5 | Babolat Counter Veron 2.6 | 2026 | M | babolat.com 150181; parametry identyczne |
| 6 | Babolat Counter Viper 2.6 | 2026 | M | babolat.com 150177; parametry identyczne |
| 7 | Babolat Dyna Energy | 2023 | M | babolat.com 150126 (seria Energy 2023); parametry identyczne |
| 8 | Babolat Stima Energy | 2023 | M | babolat.com 150127; sklepy: „Stima Energy 2023” |
| 9 | Babolat Technical Origin+ | 2026 | M | babolat.com 150188 (ta sama kolekcja co 2.6) |
| 10 | Babolat Technical Viper Soft 3.0 | 2026 | M | babolat.com 150179 (ta sama kolekcja) |
| 11 | Kuikma Hybrid Pro Coki Nieto | 2026 | Ś | Decathlon, bieżący produkt; parametry zgodne |
| 12 | Kuikma PR Hybrid Carbon Coki Nieto | 2025 | Ś | Decathlon; masa, kształt, grubość zgodne |
| 13 | Nox X-ONE Silhouette | 2026 | M | noxsport.com: kod PSILHOUET26 = sklepowa wersja 2026 |
| 14 | Oxdog Hyper Woman Air 2.0 | 2026 | Ś | oxdog.net, linia 2.0; parametry identyczne |
| 15 | Royal Padel 36 Aniversario Light | 2026 | M | Marka z 1990 → 36. rocznica = 2026; parametry zgodne |
| 16 | Royal Padel 36 Aniversario Poly | 2026 | M | jw. |
| 17 | StarVie Arkos | 2026 | Ś | starvie.com, bieżący produkt; parametry zgodne |
| 18 | StarVie Black Titan | 2026 | Ś | starvie.com; kształt „hybrydowa” vs „łezka” to różnica klasyfikacji (sklepy: hybrydowa) |
| 19 | StarVie Nyra | 2026 | Ś | starvie.com; parametry zgodne |
| 20 | Varlion Bourne Cube Elbowcare W | 2026 | M | varlion.com „-25” = sezon 2025–2026 (tak opisuje padel.how) |
| 21 | Varlion LW Cube Elbowcare W | 2026 | M | jw. |
| 22 | Varlion Maxima Cube Elbowcare W | 2026 | M | jw. |
| 23 | Wilson Bela LS V3 | 2025 | M | Premiera 13.06.2025; masa 355 g zgodna; kształt różnie klasyfikowany |
| 24 | Wilson Endure LS V1 | 2026 | Ś | Sklep padelnuestro; masa 355 g i kształt zgodne |

**Do zatwierdzenia przez właściciela:** wszystkie, albo z wyłączeniem wskazanych numerów. Wykonanie wymaga zapisu w Supabase Dev (decyzje przeglądu i nowe wydanie danych; poprzednie wydanie zostaje do cofnięcia).
