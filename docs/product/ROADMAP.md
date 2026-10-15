# Plan działania — od 15.10.2026

Stan wyjściowy: katalog, profile i porównanie działają na danych Dev (444 profile, 2 źródła), UI po przebudowie UX v3. Asystent AI — główny wyróżnik produktu — nie istnieje. Podstawa diagnozy: [audyt backendu](../architecture/BACKEND_AUDIT_2026_10_15.md), [wyniki UX v3](../design/UX_V3_RESULTS.md).

**Zasada priorytetów:** najpierw to, co znajomi faktycznie zobaczą i czego użyją (szybki katalog → asystent), potem narzędzia operacyjne. „Smart DataOps” (slice 5 z MVP) dopiero, gdy pierwsza aktualizacja danych pokaże realny ból.

## Decyzje, które musi podjąć właściciel (blokują kolejne etapy)

| ID | Decyzja | Blokuje | Moja rekomendacja |
|---|---|---|---|
| O-002 | Pisemna zgoda padel.how na: indeksowanie, embeddingi, przetwarzanie modelem, wyświetlanie krótkich cytatów w prywatnym demo | Etap 3 i 4 | Napisać do właściciela padel.how teraz — to najdłuższa ścieżka krytyczna |
| D-003 | Dostęp do demo: kod zaproszenia + limit zapytań | Etap 4 (wystawienie) | Przyjąć: jeden kod na osobę, limit dzienny, bez kont |
| O-004 | Model czatu i embeddingów | Etap 3–4 | Embeddingi wielojęzyczne (recenzje są po angielsku, pytania po polsku); model czatu tani, wybrany benchmarkiem na zestawie ewaluacyjnym |
| P-022 | Workflow designu (UI UX Pro Max + Impeccable) | — | Zrewidować: w praktyce skill był za każdym razem odrzucany. Zastąpić krótką listą zasad z UX v3 + przeglądem przez tech leada |
| — | Nowy podział ról: Claude jako tech lead/wykonawca zamiast Codexa | — | Zaktualizowane w `AGENTS.md` / `CLAUDE.md` |

## Etap 0 — domknięcie UX v3 i porządki (1–2 sesje)

1. Właściciel: uruchomić `CATALOGUE_MODE=supabase` lokalnie i obejrzeć katalog / profil / porównanie na **prawdziwych** danych (długie nazwy, 11+ ocen, dwa źródła). UX v3 był testowany na fixture. Zgłosić rzeczy do poprawy.
2. Commit UX v3 na gałęzi i merge po akceptacji. Usunąć 4 puste pliki CSS (`apps/web/app/{comparison-ux,components,globals,tokens}.css`).
3. R8 — higiena repo (zrzuty e2e poza śledzonymi plikami, `next-env.d.ts`, jedna konfiguracja przeglądarki).
4. R4 — skrypty przeglądu z `.local/` do repo; kopia zapasowa `.local/` (klucze, prywatne manifesty) poza laptopem.
5. R9 — `docs/STATUS.md` jako jedno źródło „co działa teraz”; stare raporty zostają jako historia, nie są aktualizowane.

## Etap 1 — szybki i poprawny odczyt (1 sprint)

1. Zmierzyć baseline: czas TTFB `/`, `/rakiety/[id]`, `/porownaj` na Dev.
2. R1 — singleton puli + cache po `active_release_id`.
3. R2 — funkcje SQL `published_catalogue_list()` i `published_racket(id)`; strony list/szczegółów korzystają z właściwej. Migracja addytywna.
4. R3 — kanoniczne nazwy wyświetlane w domenie (normalizer) i w projekcji; `lib/display.ts` zostaje jako fallback.
5. Zmierzyć po. Cel orientacyjny: < 300 ms TTFB z ciepłym cache.

## Etap 2 — więcej rakiet z dwóch źródeł (1 sprint)

1. R5 — generator kandydatów dopasowania (ta sama marka, zgodny rok, podobny model po normalizacji) → kolejka przeglądu z uzasadnieniem. Zgodnie z P-008: nic nie łączy się automatycznie.
2. R6 — lokalny widok przeglądu kandydatów (dev-only, za flagą), który wywołuje istniejące `applySourceReview()`.
3. Przegląd kandydatów, nowe wydanie. Miara sukcesu: liczba rakiet z danymi z obu źródeł (dziś ≤ 54).

## Etap 3 — wiedza z recenzji (slice 3 z MVP; wymaga O-002)

1. Chunking 217 recenzji po sekcjach (werdykt, mocne/słabe strony, FAQ) z zachowaniem `knowledge_documents`, offsetów i ID rakiety.
2. `pgvector` + kolumny FTS; embeddingi liczone przez workera wsadowo, z logiem kosztu.
3. Hybrydowy retrieval (SQL po ID rakiety + FTS + wektor) zawsze ograniczony do rozpoznanych rakiet.
4. `evals/`: 30–50 pytań z oczekiwanymi źródłami (skill `rag-evaluation` już jest). Baseline trafności przed jakimkolwiek modelem czatu.
5. Usuwanie zależne od źródła (chunki, embeddingi) — wymagane przez AGENTS.md, zaimplementować razem z indeksem, nie później.

## Etap 4 — asystent (slice 4 z MVP)

1. `packages/ai`: bramka modelu (OpenRouter), twardy limit miesięczny 100 PLN sprawdzany **przed** wywołaniem, log tokenów/kosztu/opóźnienia.
2. Intencje: wyszukiwanie po cechach, statystyki rakiety, porównanie dwóch, follow-up. Wyjście = istniejący kontrakt widoku (`view-contract.ts`) + tekst z cytatami do ID chunków. Walidacja po stronie serwera.
3. Wspólny kontekst z klasycznym porównaniem (wybrane rakiety w sesji) — P-002.
4. Dostęp: kod zaproszenia + limity (D-003), wdrożenie na Vercel.
5. Eval end-to-end: poprawność cytatów, brak zmyślonych liczb, ujednoznacznianie modelu/rocznika.

## Później (świadomie odłożone)

Panel kosztów i porównania modeli, harmonogram importów, nowe źródła recenzji (O-001), agent wyszukujący źródła, zdjęcia (czekają na prawa — `IMAGE_ASSET_POLICY.md`), wersja EN.

## Jak pracujemy

- Tech lead (Claude): plan etapu, podział na zadania, przegląd każdego diffu i zrzutów, bramka testów. Wykonawcy: tańsze modele dla zadań mechanicznych, mocniejsze dla zmian w danych i testach.
- Każdy etap: krótki plan w `docs/` (max 2 strony), testy, jeden raport ≤ 1 strona. Bez powielania wyników testów w wielu dokumentach.
- Twarde zasady z `AGENTS.md` (proweniencja, brak zmyślonych ocen, brak sekretów w repo, limit kosztów) obowiązują bez zmian.
