# Padłownia — Padel Racket AI

Projekt edukacyjny i prywatne demo porównywarki rakiet do padla, wzbogaconej o konwersacyjnego asystenta AI.

**Cel:** zbudować funkcjonalną aplikację, ucząc się architektury AI, data quality, entity resolution, hybrid retrieval, context engineering, ewaluacji modeli oraz optymalizacji jakości względem kosztu. Implementacja jest AI-first: kod tworzy przede wszystkim agent, a decyzje projektowe i kryteria akceptacji pozostają jawne i wersjonowane.

## Źródła prawdy

- [Produkt i granice funkcji](docs/product/PRODUCT.md)
- [Zakres MVP i kolejność prac](docs/product/MVP.md)
- [Rejestr decyzji: accepted / proposed / open](docs/product/DECISIONS.md)
- [Architektura — koncepcja, jeszcze nie implementacja](docs/architecture/OVERVIEW.md)
- [Canonical Data Model v0.1 — propozycja](docs/architecture/DATA_MODEL_V0_1.md)
- [Ingestion Design v0.1 — kontrakty i state machine](docs/architecture/INGESTION_DESIGN_V0_1.md)
- [Ingestion — scenariusze testowe](docs/architecture/INGESTION_TEST_SCENARIOS.md)
- [Sprint 01 — gotowy brief do przeglądu](docs/development/SPRINT_01_BRIEF.md)
- [Instrukcje dla Codexa](AGENTS.md)
- [Role robocze agentów](docs/ai/ROLES.md)
- [ADR: odroczenie frameworka agentowego](docs/adr/001-defer-agent-framework.md)

## Uzgodniony kierunek

- Next.js + TypeScript (frontend i API), osobny worker w tym samym repozytorium.
- Supabase Cloud Free: PostgreSQL + pgvector; lokalnie aplikacja i worker, baza w chmurze.
- Vercel dopiero przy udostępnianiu prywatnego demo.
- PadelTrue + padel.how jako źródła strukturalne; pilotaż 20–30 modeli z dłuższymi recenzjami.
- Katalog, klasyczna porównywarka oraz osobny asystent AI ze wspólnym kontekstem.
- AI odpowiada **wyłącznie z naszej bazy**, interpretuje dane, nie dopowiada faktów ani nie korzysta z sieci w czasie rozmowy.
- Hybrid retrieval: SQL + full-text + vectors. Domyślnie tani model przez OpenRouter i własny gateway.
- Golden set, automatyczne evals, śledzenie kosztów. Limit API AI: **100 PLN/miesiąc**.
- DataOps Smart C: automatyczna walidacja + kolejka wyjątków, raporty uruchomień i jakości, rozwijane etapowo.

> Repozytorium jest publiczne. Nie commitujemy kluczy, haseł, kopii zewnętrznych recenzji, surowych baz wymagających zgody ani danych użytkowników.

## Status

**Discovery zatwierdzone; technical design i kod jeszcze do wykonania.** Ten commit rozpoczyna dokumentację projektu, nie oznacza działającej aplikacji.

Gdy implementacja się zacznie, najpierw dostarczamy pionowy wycinek: import źródeł → identyfikacja modeli → katalog → ekran porównania. Dopiero potem rozszerzamy o tekstowy RAG, chat i pełniejsze DataOps.
