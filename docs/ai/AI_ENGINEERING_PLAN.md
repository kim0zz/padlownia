# Asystent AI — rozkminy techniczne, wnioski i pytania (15.10.2026)

Dokument roboczy przygotowany pod nieobecność właściciela. Nic tu nie zmienia przyjętych decyzji (`docs/product/DECISIONS.md`). Rekomendacje są oznaczone jako moje i czekają na Twoją decyzję. Kod opisany niżej jest na gałęzi `feat/ai-foundations`: nie dotyka bazy Supabase, nie wywołuje płatnych modeli i nie zmienia działania aplikacji.

## W skrócie

1. **Większość pytań do asystenta to nie „AI”, tylko wyszukiwanie po parametrach.** „Szukam miękkiej rakiety NOX” to filtr: marka = NOX, sztywność z oceny padel.how. Recenzje (RAG) są potrzebne do pytań „jak gra / dlaczego / czym się różni”. Asystent powinien więc być **dyspozytorem**: rozpoznaje, o co chodzi, wywołuje gotowe zapytania do bazy i dobiera fragmenty recenzji, a model tylko składa z tego odpowiedź.
2. **Najważniejszy element to rozpoznanie, o którą rakietę chodzi.** W pomiarze samo oddzielenie nazwy rakiety od tematu pytania podniosło trafność z 18% do 55% (pierwszy wynik). Pomyłka rocznika albo wersji (12K/18K, S/W, Pro/Light) psuje całą odpowiedź, nawet z idealnym modelem. Zbudowałem pierwszą wersję tego modułu (bez AI): na moich 32 pytaniach-pułapkach trafia w 100%, ale pisałem je razem z modułem, więc to wynik zawyżony. Prawdziwy test to Twoje pytania.
3. **Pieniądze nie są ograniczeniem, jakość jest.** Zamiana wszystkich recenzji na wektory (embeddingi) to ~480 tys. tokenów, czyli grosze. Jedno pytanie do taniego modelu to rząd 1–2 groszy, więc 100 zł to tysiące pytań. Limit kosztów jest już zaimplementowany i sprawdzany przed każdym wywołaniem.
4. **Pytania są po polsku, recenzje po angielsku.** Proste wyszukiwanie słów bez pomocy daje ~45% trafności w top 5. Z małym słowniczkiem PL→EN i usunięciem nazwy rakiety: 73%. Kolejny krok to wektory wielojęzyczne albo tłumaczenie pytania. Wybierzemy na podstawie pomiaru, a nie intuicji.
5. **Odpowiedź modelu musi być sprawdzalna automatycznie.** Zrobiłem kontrakt odpowiedzi: model zwraca ID rakiet i krótkie zdania oznaczone jako fakt, opinia recenzenta, wniosek AI albo niepewność, każde z cytatami. Serwer odrzuca odpowiedź z cytatem, którego model nie dostał, z liczbą, której nie ma w źródłach, albo ze zbyt długim cytatem.

## Pytania do Ciebie

**Odpowiedzi właściciela z 15.10.2026** (zapisane jako P-033…P-039 w `DECISIONS.md`):
- **2 → pełne rekomendacje**, także rankingi dla opisanego gracza. Proponowane ograniczenie do Twojego potwierdzenia: ranking z ocen podawanych przez źródła i dopasowania do cech, bez wymyślonej „oceny Padłowni”.
- **3 →** zgodnie z rekomendacją. **4 →** zgodnie z rekomendacją. **5 →** zgodnie z rekomendacją.
- **6 →** zgoda na benchmark do 5 zł, ale **dopiero po dopracowaniu zachowania asystenta i wyszukiwania** bez płatnych modeli. **7 →** konto OpenRouter później.
- **8 →** zgodnie z rekomendacją. **9 →** zgodnie z rekomendacją. **10 →** stały pipeline.
- **1 → otwarte.** Następny krok: specyfikacja odpowiedzi (`docs/ai/ANSWER_SPEC.md`).

Pierwotna lista pytań z moimi rekomendacjami:

| # | Pytanie | Moja rekomendacja |
|---|---|---|
| 1 | **Jakie pytania naprawdę zadadzą Twoi znajomi?** Napisz 20–30 prawdziwych, tak jak by je wpisali (z literówkami, skrótami typu „AT10 18K”, nawiązaniami do poprzedniego pytania). | To najcenniejszy wkład, jaki możesz dać. Zastąpią moje 33 pytania testowe, które są „ładne” i pewnie łatwiejsze niż prawdziwe. |
| 2 | Czy asystent może mówić **„dla Ciebie lepsza będzie X”**? `PRODUCT.md` wyklucza rekomendacje z samej biografii gracza, ale pytanie „która lepiej broni?” jest porównaniem opartym na źródłach. | Tak dla porównań i dopasowania do opisanych cech („lubię grać z obrony, mam słaby łokieć”), z widocznym uzasadnieniem i źródłami. Bez rankingu „najlepsza rakieta”. |
| 3 | Co robić, **gdy recenzja nie opisuje** danego aspektu (np. recenzja Metalbone nie mówi nic o rotacji)? | Uczciwie powiedzieć „źródło tego nie opisuje”. Można dodać ostrożny wniosek z parametrów (kształt, twardość, powierzchnia), wyraźnie oznaczony jako wniosek AI. |
| 4 | Cytaty: **oryginał angielski czy polskie streszczenie**? | Polska parafraza w treści odpowiedzi plus krótki angielski cytat w okienku źródła (do 25 słów, zgodnie ze zgodą O-002). |
| 5 | Rakiety **bez recenzji** (PadelTrue i część padel.how): czy asystent ma o nich mówić? | Tak, ale tylko parametry i oceny, z jasną informacją „brak recenzji tekstowej”. |
| 6 | **Model i embeddingi (O-004):** zgoda na benchmark 2–3 tanich modeli przez OpenRouter? Koszt testu: < 5 zł. | Tak. Wybór na podstawie zestawu testowego, zgodnie z P-015. |
| 7 | **Konto OpenRouter:** założysz je i ustawisz twardy limit na koncie (np. 10 USD)? | Tak. To druga warstwa ochrony obok naszego limitu w kodzie. Klucz trafia tylko do `.env` na serwerze, nigdy do repo. |
| 8 | **Pamięć rozmowy:** jak długo asystent pamięta kontekst? | Do zamknięcia karty, maks. ~10 tur. Pamiętamy wybrane rakiety i ostatnią intencję, a nie całą historię (taniej i mniej pomyłek). |
| 9 | Odpowiedź **na raz czy „pisana na żywo”** (streaming)? | Na raz, z widocznymi krokami („szukam rakiet… czytam recenzje…”). Streaming tekstu uniemożliwia sprawdzenie odpowiedzi przed pokazaniem. |
| 10 | **Agent czy stały pipeline?** Agent sam decyduje, czego szukać i ile razy wołać model. Pipeline to stałe kroki. | Stały pipeline z jednym wywołaniem modelu na odpowiedź (najwyżej dwa, gdy pytanie jest niejasne). Agent jako eksperyment później (MVP slice 6, ADR-001). |

**Pytania o design** (na później, jak mówiłeś): gdzie stoi czat względem katalogu (osobna strona czy panel), jak wyglądają cytaty w odpowiedzi, jak pokazać „wniosek AI” inaczej niż „opinia recenzenta”, jak wygląda pytanie doprecyzowujące („Którą AT10 masz na myśli?” z kartami do kliknięcia), co widać, gdy limit miesięczny się wyczerpie.

## Jak asystent będzie działał (propozycja)

```text
pytanie ─► 1. rozpoznanie rakiet i intencji ─► 2. dane strukturalne (SQL)  ─┐
              (deterministycznie; model tylko      3. fragmenty recenzji     ├─► 4. model składa odpowiedź (JSON)
               przy niejasności → pytanie              (tylko tych rakiet)  ─┘        │
               doprecyzowujące)                                                       ▼
                                                     6. log kosztu/czasu ◄── 5. walidacja serwera ─► komponenty UI
```

1. **Rozpoznanie** (pierwsza wersja jest, `packages/ai/src/resolver.ts`): dopasowanie tekstu do katalogu (marka, model, rocznik, wariant). Jeśli pasuje kilka rakiet, zadajemy pytanie z listą do kliknięcia zamiast zgadywać (P-024: każdy wariant i rocznik to osobny produkt). Intencje z P-003: wyszukiwanie po cechach, statystyki, porównanie dwóch, kontynuacja.
2. **Dane strukturalne:** te same funkcje bazy co klasyczny katalog (Etap 1 je przyspieszy). „Miękka NOX” → filtr. „Statystyki AT10” → karta profilu. Model nie wymyśla liczb, tylko je dostaje.
3. **Fragmenty recenzji:** wyszukiwanie zawsze **zawężone do rozpoznanych rakiet**. Wzmianka o innej rakiecie w recenzji nie jest dowodem o niej (zasada z audytu źródła: mention is not identity).
4. **Model** dostaje: pytanie, dane rakiet, 6–12 fragmentów z ID i instrukcję zwrotu JSON w kontrakcie (`packages/ai/src/answer.ts`). Tekst recenzji jest oznaczony jako dane, nie polecenia (ochrona przed wstrzyknięciem instrukcji, tzw. prompt injection).
5. **Walidacja:** schemat, ID rakiet, cytaty, liczby, długość cytatów. Przy błędzie robimy jedną poprawkę z listą błędów. Jeśli i ona nie przejdzie, pokazujemy same komponenty (karty, porównanie) z komunikatem „nie mam pewnej odpowiedzi”.
6. **Log:** każde wywołanie (także odrzucone przez limit) ma model, tokeny, koszt w zł i czas.

## Co już jest w repo (gałąź `feat/ai-foundations`)

| Element | Plik | Co robi |
|---|---|---|
| Podział recenzji na fragmenty | `packages/ai/src/chunking.ts` | Dzieli recenzję po nagłówkach na ~3000 fragmentów. Każdy ma typ sekcji (moc, obrona, sweet spot…), dokładne położenie w oryginale do cytowania i listę wspomnianych innych rakiet. Pomija sekcje sklepowe, puste i ogólnikowe. Wynik jest zawsze taki sam (deterministyczny). |
| Wyszukiwanie bazowe | `packages/ai/src/lexical.ts` | Klasyczne BM25 (ranking po słowach) ze słowniczkiem PL→EN, usuwaniem nazwy rakiety i równym podziałem przy porównaniach. Darmowe. To poprzeczka, którą muszą przeskoczyć droższe metody. |
| Zestaw testowy | `evals/retrieval/golden-v0.jsonl` | 33 pytania po polsku (i 2 po angielsku), z oczekiwanymi sekcjami. **Ułożone przeze mnie, do Twojego przeglądu.** |
| Pomiar | `apps/worker/src/eval-retrieval.ts` | `npx tsx apps/worker/src/eval-retrieval.ts`: liczy trafność na lokalnym korpusie. Zapisuje tylko liczby, bez tekstu recenzji. |
| Rozpoznawanie rakiet | `packages/ai/src/resolver.ts`, `evals/resolver/golden-v0.jsonl`, `apps/worker/src/eval-resolver.ts` | Zamienia tekst („AT10 18K”, „starvie raptor plus”, „metalbon hrd”) na dokładne ID z katalogu. Pilnuje rocznika (nigdy nie wybiera go po cichu), wariantów (S/W, 12K/18K, Pro/Light, „+”), literówek (1 znak) i porównań („X i Y”, „X 12K czy 18K”). Gdy pasuje kilka rakiet, zwraca listę do wyboru. Gdy jedna pasuje najlepiej, ale są bardziej szczegółowe wersje, zwraca ją z alternatywami. |
| Bramka modelu | `packages/ai/src/gateway.ts`, `budget.ts` | Jedno miejsce wywołań modeli. Lista dozwolonych modeli z cenami, limit miesięczny i limit na pojedyncze wywołanie sprawdzane **przed** wywołaniem, rezerwacja najgorszego przypadku (równoległe pytania nie przebiją limitu), timeout, log. Dostawca OpenRouter jest gotowy, ale bez klucza nic nie wywoła. |
| Kontrakt odpowiedzi | `packages/ai/src/answer.ts` | Format odpowiedzi modelu i automatyczna kontrola (cytaty, liczby, ID, długość cytatów). |
| Testy | `tests/ai/*.test.ts` | 37 testów na syntetycznych danych (żaden tekst recenzji nie trafia do publicznego repo). |

## Rozpoznawanie rakiet: wynik i ograniczenia

32 przypadki (dokładne nazwy, literówki, niejasne „AT10 18K” / „Babolat Viper”, rocznik spoza katalogu, rakieta tenisowa, pary do porównania): **32/32**. Wynik: `evals/results/resolver-2026-10-15.json`. Na pytaniach, których moduł nie widział, zachowuje się rozsądnie: „head speed” → 5 opcji do wyboru, „royal m27” → Light albo Poly, „wilson blade” → Blade V4 plus 3 alternatywy.

Znane ograniczenia (do dalszej pracy):
- Marka spoza katalogu nie wyklucza dopasowania („Wilson Pure Court”, gdy w katalogu nie ma Wilsona, trafi w inną rakietę ze słowem „Pure”).
- Sama marka („NOX”) to dziś „nie znaleziono”. Powinna przejść do wyszukiwania po cechach z filtrem marki.
- Nawiązania w rozmowie („a ta druga?”, „poprzednia wersja”) wymagają pamięci wybranych rakiet, czego jeszcze nie ma.
- Słowa wariantów są na sztywnej liście. Nowe serie z innymi oznaczeniami trzeba będzie dopisać.
- Nazwy biorę dziś z pliku padel.how. Docelowo resolver musi pracować na kanonicznym katalogu z bazy (444 profile, oba źródła), czyli po R3 z Etapu 1.

## Pierwszy pomiar wyszukiwania (bez AI, koszt 0 zł)

217 recenzji → 3053 fragmenty (~480 tys. tokenów), w tym 29 werdyktów i 137 FAQ z plików szczegółowych. Trafienie = właściwa sekcja właściwej rakiety. Przy porównaniach obie rakiety muszą mieć trafienie.

| Wariant | Trafienie na 1. miejscu | W top 3 | W top 5 |
|---|---|---|---|
| Pytanie jak jest | 18% | 30% | 45% |
| + słowniczek PL→EN | 18% | 33% | 52% |
| + bez nazwy rakiety (sam temat) | 18% | 21% | 21% |
| **+ oba (obecny wybór)** | **55%** | **70%** | **73%** |

Pytania o jedną rakietę: 78% w top 5. Porównania dwóch rakiet: 50%. (Liczby sprzed poprawki zestawu testowego. Aktualne są w sekcji o hybrydzie niżej.)

**Wnioski z pomiaru:**
- Nazwa rakiety w pytaniu „przyciąga” sekcje, które ją powtarzają (wstęp, porównania), zamiast sekcji o tym, o co pytasz. Dlatego rozpoznanie rakiety i wyszukiwanie tematu muszą być osobnymi krokami.
- Bez tłumaczenia polskie słowa praktycznie nie trafiają w angielski tekst. Słowniczek to tania łatka, ale nie pokryje slangu („bandeja”, „wytrzymała”).
- Część „pudeł” to pytania, na które recenzja po prostu nie odpowiada (rotacja w Metalbone, wytrzymałość). Asystent musi umieć to powiedzieć, a zestaw testowy potrzebuje osobnej kategorii „brak odpowiedzi w źródle”.
- Część pudeł może wynikać z moich zbyt wąskich oczekiwań (np. obrona Viper opisana w „praktycznych wnioskach”, a nie w sekcji obrony). Dlatego zestaw potrzebuje Twojego przeglądu.
- Zauważone przy okazji: w porównaniach wybieramy fragmenty po równo dla obu rakiet, inaczej dłuższa recenzja zagłusza drugą.

## Wyszukiwanie hybrydowe: lokalne embeddingi + RRF (15.10.2026, koszt 0 zł)

Wzorowane na kursie [ai-engineer-notebooks, 03-rag/02 i 04](https://github.com/calmrocks/ai-engineer-notebooks). Model `Xenova/multilingual-e5-small` (129 MB) działa lokalnie, bez API. Pobrany raz do `.local/models`. Wektory 3053 fragmentów liczą się w ~70 s i są zapisywane w `.local/embeddings` (prywatnie, poza Gitem). Łączenie list metodą RRF (k = 60, po pozycjach, a nie po punktach). Dla każdej rakiety osobno: pula 50 z BM25 + 50 z wektorów.

**Poprawka zestawu testowego:** 3 pytania o obronę oczekiwały sekcji „obrona”, której te recenzje (Viper, Veron, ML10) nie mają. Obrona jest tam opisana we wnioskach, pozycjonowaniu i stabilności. Poprawiłem oczekiwania i zmierzyłem **wszystkie** warianty na poprawionym zestawie.

| Wariant | 1. miejsce | top 3 | top 5 | top 20 | 1 rakieta, top 5 | Porównania, top 5 |
|---|---|---|---|---|---|---|
| BM25, pytanie jak jest | 18% | 33% | 49% | 94% | 48% | 50% |
| BM25 + słowniczek + bez nazwy | 55% | 73% | 79% | 88% | 82% | 67% |
| Same wektory (bez nazwy) | 42% | 67% | 79% | 97% | 89% | 33% |
| **Hybryda (BM25 + wektory, RRF)** | **55%** | **79%** | **88%** | **100%** | **93%** | **67%** |
| Hybryda, wektory ×2 | 52% | 76% | 88% | 100% | 93% | 67% |

Raport: `evals/results/retrieval-2026-10-15-hybrid-e5small.json`.

**Wnioski:**
- Hybryda jest najlepsza i każda jej część ma znaczenie. Słowa trafiają nazwy i rzadkie terminy, wektory rozumieją polskie pytanie bez słowniczka. Sam wektor przegrywa na porównaniach, BM25 przegrywa na polskim słownictwie.
- **Wszystkie 4 pozostałe pudła są „utopione”, a nie zgubione:** właściwy fragment jest na miejscach 6–9, a w top 20 jest zawsze (100%). Według diagnozy z kursu to dokładnie przypadek dla **rerankera**. Teraz się opłaca, a przed hybrydą nie (wtedy większość pudeł to fragmenty nieznalezione).
- Ważenie wektorów ×2 nic nie daje, zostajemy przy równych wagach (bez „pokrętła” bez pomiaru).
- Ostrożnie z liczbami: 33 pytania to mały zestaw, a 1 pytanie to 3 punkty procentowe. Różnice 3–6 pkt to sygnał, nie dowód.

**Następny krok (do decyzji):** lokalny reranker typu cross-encoder (również darmowy, np. wielojęzyczny model mMiniLM / bge-reranker), który przestawia top 20 → top 5. Mierzymy, czy pudła z miejsc 6–9 wchodzą do top 5. Przy okazji trzeba poprawić tokenizer, który rozbija „2.6” na „2” i „6”.

## Decyzje techniczne do podjęcia (z rekomendacją)

**A. Wektory (embeddingi) i polski.** ✅ Zmierzone (sekcja wyżej): lokalny model wielojęzyczny + RRF wygrywa i nic nie kosztuje. Do sprawdzenia przy benchmarku (P-039): czy płatny model embeddingów albo tłumaczenie pytania da więcej niż lokalny reranker. W produkcji wektory fragmentów liczy worker raz na wydanie danych. Wektor pytania liczy serwer przy każdym pytaniu (~50 ms na CPU); trzeba sprawdzić, czy to się zmieści w limitach Vercela.

**B. Gdzie trzymać fragmenty i wektory.** Supabase ma `pgvector` (P-012). Lokalna baza testowa (PGlite 0.5.9) go nie ma, więc migracji z wektorami **celowo jeszcze nie pisałem**: nie dałoby się jej przetestować lokalnie. Do ustalenia: aktualizacja PGlite z rozszerzeniem `vector` albo testy wektorów tylko na Dev. Tabela fragmentów musi mieć wersję chunkera, hash dokumentu i usuwanie kaskadowe po źródle (wymóg z `AGENTS.md`). *Rekomendacja:* nowa tabela `knowledge_chunks` (prywatna, tylko dla roli workera i funkcji serwera), migracja addytywna, za Twoją zgodą na Dev.

**C. Jeden „strzał” modelu czy narzędzia (tool calling).** *Rekomendacja:* jeden strzał z gotowym kontekstem. Pipeline sam decyduje, co pobrać, a model tylko pisze. Tanio, przewidywalnie, łatwo testować. Narzędzia i agent dopiero, gdy pomiar pokaże pytania, których pipeline nie obsłuży.

**D. Limit kosztów w środowisku z wieloma instancjami.** Obecny rejestr kosztów działa w jednym procesie (lokalnie i w testach). Na Vercelu (wiele instancji) ta sama logika musi siedzieć w bazie: tabela `ai_usage` plus rezerwacja w jednej transakcji z blokadą. Kontrakt (`UsageLedger`) jest już na to przygotowany.

**E. Kolejność ewaluacji.** Trzy warstwy, każda z własnym zestawem: (1) rozpoznanie rakiet (czy „AT10 18K” trafia we właściwy produkt, czy pyta przy niejasności), (2) wyszukiwanie fragmentów (jest), (3) odpowiedź: automatyczna walidacja plus Twoja ocena próbki. LLM-as-judge dopiero po porównaniu z Twoimi ocenami (P-016).

**F. Szacunek kosztu pytania** (do potwierdzenia przy wyborze modelu, ceny się zmieniają): ~3–5 tys. tokenów wejścia (dane rakiet + 6–12 fragmentów) i ~500 wyjścia. Przy modelu za ~0,5 USD / 1,5 USD za milion tokenów to ~0,3 grosza USD, czyli ~1 grosz. Nawet 10× droższy model mieści tysiące pytań w 100 zł.

## Proponowana kolejność dalszej pracy

1. Ty: przegląd 33 pytań i dopisanie prawdziwych (pytanie 1), decyzje 2–10.
2. Rozpoznawanie rakiet na kanonicznym katalogu z bazy (po R3) + Twoje prawdziwe pytania jako test. Pierwsza wersja modułu już jest.
3. ✅ Lokalne embeddingi + RRF zmierzone. Następny jest lokalny reranker. Płatne warianty przy benchmarku (P-039).
4. Migracja `knowledge_chunks` + `pgvector` + `ai_usage` (za zgodą na Dev).
5. Pierwszy działający asystent dla dwóch intencji („statystyki X” i „porównaj X i Y”) w trybie developerskim, bez publikacji.
6. Pozostałe intencje, pamięć rozmowy, dostęp kodem zaproszenia (D-003), Vercel.

Równolegle warto dokończyć Etap 1 (szybki odczyt). Asystent też będzie czytał katalog, a dziś każde wczytanie strony kosztuje ~1,6 s (`docs/architecture/STAGE_1_BASELINE.md`).
