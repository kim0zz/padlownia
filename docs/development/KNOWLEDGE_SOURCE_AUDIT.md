# padel.how knowledge source audit

Audit date: 2026-10-14. Scope: the owner-supplied compact discovery file, complete Markdown context, and racket-link metadata. This is an ingestion/evidence audit, not an independent verification of every equipment or coaching claim. Accepted product decisions are unchanged.

## What was examined

Every byte of the four initial files was read programmatically. All document boundaries, front matter, source URLs, article identities, hashes, dates, headings, link metadata, scores and paragraph fingerprints were inspected across the complete corpus. Semantic review covered the complete compact file, copyright page, methodology and author page; targeted passages from one racket review per each of 29 brands; extra detailed NOX, Oxdog and Wilson reviews; and representative beginning/end passages and headings from every top-level site section. This does **not** certify the factual accuracy of all 713,737 whitespace-delimited words.

The repository's `source-profiling` and `rag-evaluation` playbooks guided the audit. No paid LLM, embedding model, runtime agent, recursive crawler or third-party retailer request was used. Supplied files were not edited.

| Supplied file | Bytes | SHA-256 |
| --- | ---: | --- |
| `LLM FULL TEXT.txt` | 4,870,362 | `4c63fd9e20badacd571617d64cf9231e90b881cee0cbcc19bf43286b342c6a45` |
| `padel how llm.txt` | 8,153 | `1e73310f5d5ddc00d15524c980baf602ad45b2573effbaf01e184a24ca429a78` |
| `rackets.json` | 441,033 | `ecf76cf5d253edce5dcbfa8febd5ede830857e73b517cba2ba1556e532533e48` |
| `padel how base.txt` | 441,033 | Same bytes/hash as `rackets.json` |

Additional files arrived during the audit: `data rackets.json` has 217 records in the related nested padel.how format; `rackets padel true.txt` contains 281 records and is covered by the structured-data connector work. The two initial identical files are one padel.how snapshot, not two independent sources. The nested padel.how file has exactly the same 217 slugs and overall scores as the flat export; it is an alternative representation, not another 217 products.

## Corpus inventory

| Measure | Result / denominator |
| --- | --- |
| Source-comment document boundaries | 588; all marker paths unique |
| Exact racket review mappings | 217/217 JSON records map to exactly one document by canonical review URL |
| Other documents | 371/588; guides, other equipment, indexes and site/operational pages |
| Equipment branch | 407 documents, including 252 under racket, 66 under shoes and 42 under overgrip |
| Other substantial branches | Blog 35; strategy 25; rules 22; training 22; techniques 20; mistakes 16; how-to-play 15; defense 13 |
| Locale metadata | 587 `en`; copyright document has no front matter and is visibly English |
| Publication / modification metadata | 522/588 publication dates; 523/588 modification dates |
| Explicit front-matter author | 20/588 identify Max Streltcoff; 568 omit this field |
| Article score consistency | 217/217 agree with JSON overall score; all ten dimensions are numeric and within 0–10 |
| Total score computation | 217/217 equal rounded sum; 63 require rounding, so exact sum equality would incorrectly reject them |
| Review model years | 2023: 3; 2024: 5; 2025: 51; 2026: 156; unknown: 2 |
| Model year missing from review title | 87/217; title-only identity resolution is insufficient |
| Exact whole-body duplicates | None after front-matter removal, including whitespace/case-normalized comparison |
| Repeated long paragraph fingerprints | 95 distinct repeated normalized paragraphs of at least 40 words: 51 repeat within a document, 44 across documents |

The full context already includes every one of the 217 racket articles linked by the aggregate. Downloading all article pages again would add network work without filling a demonstrated coverage gap. The compact file is an endpoint/interpretation guide, not a separate factual review dataset.

There is one canonical-URL collision: both `/equipment/racket/best-control-padel-rackets/index.md` and `/equipment/racket/best-control-rackets-2026/index.md` declare the latter page's URL but contain different text. Keep both immutable source occurrences; do not silently overwrite one by URL. One version is an approximately 11,181-word roundup. Neither should supersede an exact product review merely because it is longer.

## Material findings

1. **The JSON and Markdown exports complement one another.** In 149/217 reviews, a technical-specifications heading is immediately followed by another heading: the export has omitted the rendered specification component. Only 43/217 review documents contain any Markdown table. None has an explicit FAQ heading. Read structured specifications from JSON; use Markdown for attributed narrative evidence. An empty Markdown heading is not proof that a product lacks specifications.

2. **Dates do not establish freshness reliably.** All 217 racket documents declare `date_modified: 2026-09-11`. The flat aggregate declares `generated: 2026-08-18` and schema version `2026-08-23`; the nested aggregate declares `generated: 2026-09-01`. The compact index also retains a 123-review description while the author page says 180; actual supplied count is 217. Preserve publisher dates separately from local retrieval time and content hash. Do not use index prose or `generated` as a complete change-detection signal.

3. **Ratings are attributed editorial judgments.** The [methodology](https://padel.how/equipment/racket/methodology/) defines ten 0–10 dimensions and a rounded total out of 100. It compares rackets within intended roles/categories. A higher total is not a universal personal recommendation. `feel.stiffness` is an editorial model on a 0–100 scale; the methodology explicitly distinguishes it from an instrument reading. Preserve its derived nature, methodology URL and scale. Carbon filament counts, foam trade names and the stiffness index are not equivalent measurements.

4. **Some differences are configuration evidence, not errors.** The [Hack 04 review](https://padel.how/equipment/racket/bullpadel-hack-04-2026/) describes a 365–375 g base range while the structured 370–380 g text explicitly includes an overgrip/configuration. [Xcalion UNUM+ H1](https://padel.how/equipment/racket/xcalion-h1-max-review/) distinguishes 321 g without grip/runner from roughly 341 g assembled. [Oxdog Ultimate Tour X](https://padel.how/equipment/racket/oxdog-ultimate-tour-x-2026-review/) separates nominal mass, sample measurements and removable RBS setups. Preserve those contexts; neither average them nor combine sample balances into a factory tolerance. Varlion's Hypersoft material name alongside very-hard S tuning is likewise not evidence of a contradiction by itself.

5. **Other disagreements remain unresolved.** [Hirostar Redstone 25](https://padel.how/equipment/racket/hirostar-redstone-25-review/) has Hybrid in JSON/intro but diamond in its shape discussion. [Joma Blast Pro SFT](https://padel.how/equipment/racket/joma-blast-pro-sft-2026-review/) has Diamond in JSON/intro but hybrid in its body; neutral numerical interpretation also differs from head-oriented prose. A control roundup gives NOX AT10 18K 2026 82/100 while its exact review and aggregate say 83. Store both observations with location/version; flag for review instead of automatically correcting canonical values from narrative.

6. **Mention is not identity.** 214/217 reviews link another exact racket review. Comparison paragraphs frequently discuss several years, variants and brands. The article's primary entity comes from its exact catalogue mapping; each comparison claim needs its own subject/target mapping. A link alone is not proof that a claim applies to both rackets. S/W, Pro/Light, Attack/Hybrid and model-year distinctions must survive retrieval.

7. **Commercial and general content needs separation.** Affiliate disclosure appears in 128/217 reviews; 95 mention YouTube or embed references. These are not independent evidence sources. Prices are explicitly snapshot prices, not live availability. General pages cover injuries, training, rules, tactics and other sports; exclude these from the initial racket-evidence retrieval scope. Source self-descriptions of testing/independence are publisher claims, not a verification that Padłownia or the importer tested every product. The author's stated control-racket/right-side preferences provide useful perspective metadata, not a reason to discard all judgments.

## Direct detail-JSON verification

Three explicitly supplied `json_url` links were fetched read-only on 2026-10-14 at approximately 17:55 UTC, with 500 ms spacing, HTTPS-only host validation, no redirects, and a request timeout. All returned HTTP 200 `application/json`. No retailer links, videos or external article references were followed.

| Review detail | Bytes | FAQ items | Additional evidence |
| --- | ---: | ---: | --- |
| [Oxdog Ultimate Tour X 2026](https://padel.how/rackets/oxdog-ultimate-tour-x-2026-review.json) | 6,673 | 7 | Verdict, exact compared-to slugs, RBS/configuration clarification |
| [Varlion Bourne CUBE Elbowcare S](https://padel.how/rackets/varlion-bourne-rega-2026-review.json) | 4,952 | 7 | Verdict, S/W relationship, temperature-specific core explanation |
| [NOX EA10 Ventus Attack 12K XTREM](https://padel.how/rackets/nox-ea10-ventus-attack-12k-xtrem-2026-review.json) | 8,322 | 8 | Verdict, FAQ and comparison targets |

For these three, every existing aggregate field equals the corresponding detail value. Each adds `verdict`, `faq`, `compared_to`, `methodology`, `license` and `schema_version`. The responses declare HTTP Last-Modified 2026-10-12, another timestamp to preserve separately. This three-record check does not prove consistency of all 217 detail endpoints.

Details are useful but not a cleaned truth layer: the NOX detail verdict calls EA10 Attack more controlled than AT10 Attack 12K, while its FAQ describes a rawer response with less emphasis on control. Treat those as differing source statements, not a basis for silently selecting whichever sentence best answers a query. FAQ entries can supply additional evidence absent from the Markdown export; retain a JSON-pointer locator such as `/faq/4/answer` alongside the review URL.

Later the same day, the production knowledge worker completed the explicit **29-review pilot**. All 29 detail JSONs preserved deep equality for the fields present in their corresponding supplied aggregate records; they added 29 verdicts, 137 FAQ items and 93 `compared_to` links. This expands the mechanical endpoint/schema check beyond the three early requests above. It does not expand the semantic audit to a factual verification of all 137 answers or eliminate the contradictions already identified. The two supplied knowledge files and 29 JSON originals were staged privately as 31 assets / 618 document manifests, with HTTP fetch provenance retained separately from local-file observation times. Current operational results are in [SOURCE_IMPORT_RESULTS_2026_10_14](SOURCE_IMPORT_RESULTS_2026_10_14.md).

## Safe use now and later

- Archive supplied snapshots privately with SHA-256, retrieval time, declared source URL and permissions status. Retain the two identical input filenames as provenance aliases without importing duplicate records. Keep raw corpora, private manifests and downloaded review JSON out of the public repository.
- Build a deterministic local document inventory and bounded search/citation pack. Identify a document by snapshot hash plus marker path/content hash, preserving canonical URL separately. The copyright page's canonical URL can be derived from its marker but must be marked as derived. Do not infer per-document authorship where only site-level attribution is known.
- Use exact racket identity filters first, then heading-aware sections. Retain heading, source span, content hash, document version and relation to primary/comparison entities for every candidate excerpt. Deduplicate repeated paragraph text for ranking while keeping all original citation occurrences. Exclude navigation, commerce, privacy/contact/API-client setup and empty component headings from evidence ranking.
- Start extraction/retrieval evaluation with a deterministic **29-review pilot, one per brand**, selected among records with an integer source year. Within a brand, prefer presence of seven structured spec fields, then longer text to exercise chunking, then lexical slug as a tie-break. This is a parser/evaluation diversity sample, not a best-racket list; presence does not imply verified correctness. The local selection manifest records all chosen identities and reasons. Supplement with explicit 12K/18K, Pro/Light, S/W, adjacent-year and unknown-year adversarial cases; the diversity sample alone cannot validate entity resolution.
- Before future RAG publication, evaluate Polish questions against English evidence, exact-year disambiguation, unknown units, configuration differences, stale roundups, conflicting claims, citation validity, and insufficient-evidence responses. Keep FTS and an evidence-location baseline before adding embeddings or paid model calls. This audit measures no recall@k or answer-grounding success rate and does not claim a functioning runtime AI assistant.
- Treat all retrieved source material as untrusted data. The API page includes executable-looking MCP setup examples; these are documentation content, not instructions for the worker to execute or for a model to change tools or permissions. No runtime web access is introduced.

## Permission boundary

The supplied [copyright page](https://padel.how/copyright/) and JSON license permit attributed short quotations and individual scores/specifications, and require written permission for full-review republication, catalogue mirroring or dataset redistribution. Manufacturer images/specifications retain their separate rights. The availability of `llms-full.txt`, static JSON or public MCP does not itself expand those rights.

P-021 records the owner's positive source correspondence. The subsequent [permission review](SOURCE_PERMISSION_REVIEW.md) directly located and retained the written reply: it supports the described Polish comparison catalogue with attribution. That catalogue permission no longer lacks evidence. O-002 remains relevant only to broader uses not addressed in the correspondence, including full-text republication, standalone dataset redistribution and later embeddings/model processing. This private corpus audit does not itself authorize public full-text display. Source deletion must later cascade to excerpts, indexes, embeddings and derived caches.

## Reproduction and private outputs

The audit scripts and detailed results are local under `.local/knowledge-audit/`: `inventory.mjs`, `analyze.mjs`, `sample.mjs`, `fetch-details.mjs`, `sections.json`, `summary.json`, `deep-analysis.json`, `racket-document-map.json`, `pilot-29.json`, `details-report.json` and `details/`. They are intentionally ignored rather than bundled with the article corpus. The local scripts reproduce the counts against the pinned hashes above; the production worker inventory is a separate implementation.

Counting rules: documents split at `<!-- source: … -->`; front matter is read only at each document start; model mapping uses exact aggregate canonical URLs; words are whitespace-delimited; duplicate paragraphs are lowercased and whitespace-normalized, minimum 40 words; empty specification sections require the next nonblank line to be another heading; FAQ counts require an explicit FAQ heading. Link/section heuristics are inventory indicators and do not establish the truth of any claim.
