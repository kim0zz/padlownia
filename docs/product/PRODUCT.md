# Product Definition — Padłownia

Status: **Product decisions consolidated from the conversation; 2026-10-13**.

## Vision
A Polish-first, future PL/EN-capable padel racket discovery and comparison application. Private learning-oriented demo for the owner and a few friends. Distinguishing quality: source-grounded technical and editorial evidence, clear conflicts, practical UI and conversational interpretation.

## Two connected interaction paths
1. **Classic search**: fast text search/autocomplete, filters, catalogue, racket profile, selecting two rackets and visual comparison **without LLM cost**.
2. **AI assistant**: distinct prompt/chat input; natural-language racket lookup and characteristic filtering, profile/stats presentation, two-racket comparison, and multi-turn follow-ups. Results render **predefined dynamic UI components** (racket cards, stats, comparison, cited explanation); not model-authored arbitrary UI. Both paths share currently selected racket(s)/comparison context.

Example intents:
- “Szukam miękkiej rakiety NOX” -> grounded candidate cards, explanation of how softness was assessed, with uncertainty if needed.
- “Pokaż statystyki NOX 18K” -> disambiguate actual model, variant and year; show source-specific stats.
- “Porównaj HEAD Extreme Motion i Babolat Air Viper” -> disambiguate, render same comparison component as classic flow, add source-backed insights.
- “A która lepiej broni?” -> resolve conversation references to selected models.

This is **not** yet a general personalized shopping adviser producing rankings solely from a player biography, nor unrestricted autonomous web research.

## Evidence and truthfulness
- AI conversation only accesses imported, approved database content: specs, original source ratings and relevant review evidence. The assistant must not browse externally during chat.
- Separate **factual spec**, **reviewer observation**, **AI interpretation**. Interpret available data cautiously; do not fabricate testing or quantitative ratings.
- Source near each substantive claim/rating. Link to original article/review and author/section/timestamp where known; concise synthesis, not copy-pasted replacement for full articles.
- Conflicts between sources remain visible; uncertain claims qualified.

## Product scope and access
- Private demo for owner and a few friends, preferably access code without full accounts initially, with rate limits and spend caps; protect server-side endpoints and secrets.
- No requirement for production-grade payments, marketplace, nationwide offer aggregation, profiles/accounts or automatic product recommendations.
- Multi-language-friendly identifiers and content provenance; Polish UX first.

## Data and sourcing
- Full structured catalogues initially: PadelTrue snapshot 268 and padel.how snapshot 217 **source records**, not 485 confirmed unique rackets.
- PadelTrue CC BY 4.0 dataset with attribution and separation of image rights; padel.how owner verbally/electronically permitted portal data use per project owner. **Retain written permission; confirm details for full-text republication, model processing and future publication if needed**.
- Begin with reviews covering 20–30 chosen rackets; exact articles and rights evaluated individually.
- Padel Magazine, Time2Padel, PadelZoom: **candidate pilots, not accepted production source integrations**. Pádel Nuestro and other sites likewise undecided.
- Later experimental researcher agent can propose new source documents in controlled waves, but validation gate remains deterministic and auditable.

## UX quality
- Both standard and AI routes useful, source-linked and visually comparable.
- Display absent/unknown data explicitly and source-specific rating scales clearly.
- No invisible auto-merging of variants and no false “tested” labels without evidence.
