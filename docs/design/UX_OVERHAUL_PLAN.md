# Plan przebudowy UI/UX — Padłownia v3

Status: **zatwierdzony przez właściciela 2026-10-15** do wdrożenia etapami.
Autor planu: tech lead (Claude). Wykonawca: model implementujący. Recenzja po każdym etapie: tech lead.

Ten dokument jest **jedynym źródłem prawdy** dla przebudowy. Jeśli coś jest niejasne albo sprzeczne z kodem — zatrzymaj się i zapytaj, nie zgaduj. Nie rozszerzaj zakresu.

---

## 0. Dlaczego i co jest celem

Obecny UI odpowiada na pytanie „skąd są te dane?”, a nie „która rakieta jest dla mnie?”. Pochodzenie danych zostaje (to wyróżnik produktu), ale schodzi do **drugiej warstwy**. Na pierwszym planie mają być parametry, różnice i oceny.

### Zadania użytkownika (kryteria akceptacji całej przebudowy)

| # | Zadanie | Gdzie | Mierzalny warunek |
|---|---|---|---|
| U1 | „Znajdź NOX ML10 2027 po kilku literach” | Katalog | Podpowiedzi pojawiają się po wpisaniu 2 znaków; Enter/klik na podpowiedzi otwiera profil |
| U2 | „Pokaż lekkie rakiety diamentowe z 2026” | Katalog | Filtry masa + kształt + rok działają razem; wynik bez przeładowania przycisku (auto-submit) |
| U3 | „Czym różnią się te dwie rakiety?” | Porównanie | Wiersze z różnicą są oznaczone; przełącznik „Tylko różnice”; oceny obu rakiet w jednym wierszu |
| U4 | „Jakie ma oceny i od kogo?” | Profil | Oceny pogrupowane według źródła, jedna skala na grupę, zastrzeżenie metodologii raz na grupę |
| U5 | „Skąd jest ta wartość?” | Wszędzie | Każda wartość ma ikonę źródła; 1 klik/Enter pokazuje: rodzaj informacji, źródło (link), datę pobrania |

### Zasady, których NIE wolno złamać (z DECISIONS.md i Sprintu 02)

1. Każda pokazana wartość ma dostęp do źródła (teraz: przez `SourceInfo`, patrz §2.2). **Nigdy nie usuwaj cytowania** — przenosisz je do popovera.
2. Rozbieżności (`spec.conflict`), brak weryfikacji producenta, nieznany rok/wariant, niepełne dane modelu oceny — **pozostają widoczne na pierwszym planie** jako badge.
3. Nie uśredniamy skal różnych źródeł. Nie wyliczamy własnej oceny. **Nie wskazujemy „zwycięzcy”** (żadnego zielonego „lepsza”, pucharów, sumy punktów).
4. Oryginalna wartość źródła (`rawValue`) pozostaje dostępna (w szczegółach obserwacji).
5. Dane syntetyczne (`mode === 'fixture'`) **zawsze** mają widoczny komunikat „Dane demonstracyjne”.
6. Kontrakt `racket_comparison` / `racket_specs` / `racket_card` w `lib/view-contract.ts` — **bez zmian**.
7. Testy bezpieczeństwa (XSS, `__proto__`, `javascript:` w linkach, `safeSourceUrl`) — **bez zmian, muszą przechodzić**.
8. Nie ruszaj: `packages/**`, `apps/worker/**`, `supabase/**`, `lib/config.ts`, `lib/catalogue-server.ts`, `lib/view-contract.ts`, `lib/comparison-request.ts`, `lib/comparison-selection.ts`, `lib/catalogue-images*.ts`.
9. **Zero nowych zależności npm.** Zero zdalnych fontów. Zero wywołań LLM.
10. Nigdy nie raportuj testów jako zaliczonych, jeśli ich nie uruchomiłeś.

---

## 1. Kolejność etapów

Każdy etap to osobny commit (lub PR) i kończy się **bramką** (§9). Nie zaczynaj kolejnego etapu przed recenzją poprzedniego.

| Etap | Zakres | Ryzyko |
|---|---|---|
| E0 | Decyzja P-032 + flaga trybu deweloperskiego | niskie |
| E1 | Fundament: tokeny, struktura CSS, komponenty `ui/` | średnie (wizualne regresje) |
| E2 | Formatowanie nazw i wartości (`lib/display.ts`) | niskie |
| E3 | Porównanie | wysokie (dużo testów) |
| E4 | Katalog | średnie |
| E5 | Profil | średnie |
| E6 | Galeria komponentów, sprzątanie, zrzuty, dokumentacja | niskie |

---

## 2. Etap E0 — decyzja i tryb deweloperski

### 2.1 Wpis do `docs/product/DECISIONS.md`

Dodaj wiersz po `P-031` (właściciel zaakceptował to wprost 2026-10-15):

```
| P-032 | Accepted | UX information layering | Values, differences and badges for conflicts/unknowns/unverified data are first-layer. Source name, claim type, retrieval date and methodology sit one interaction away (source icon → popover). Technical provenance (observation ID, source path, release UUID, environment/sprint labels) is shown only in developer mode. Citation remains reachable for every displayed value. |
```

### 2.2 Flaga trybu deweloperskiego

Nowy plik `apps/web/lib/dev-ui.ts`:

```ts
import 'server-only';
/** Developer-only UI details (provenance IDs, release UUID, environment labels). */
export function showDevDetails(): boolean {
  return process.env.SHOW_DEV_DETAILS === '1';
}
```

- Dodaj `SHOW_DEV_DETAILS=` (pusty) do `.env.example` z komentarzem po polsku.
- Komponenty serwerowe wołają `showDevDetails()`; komponenty klienckie dostają `dev: boolean` jako prop.
- **Co chowamy za flagą** (renderuj tylko gdy `dev === true`):
  - `.provenance-details` (observationId, path, releaseId) w `ObservationDetails` — cały `<details>` „Ślad pochodzenia danych”,
  - `details.comparison-release` („Wersja porównywanych danych” z UUID),
  - `ModeNotice` w trybie `supabase` („Supabase Dev. Wyświetlamy…”),
  - `.environment-label` „Wersja developerska” w nagłówku,
  - w stopce: link „Galeria komponentów” i tekst „Katalog i porównania • Sprint 02”.
- **Co zostaje zawsze:** `ModeNotice` w trybie `fixture`, komunikat o nieaktualnym wydaniu (`stale_release`) i przycisk „Porównaj w aktualnej wersji” — to funkcja, nie informacja techniczna.
- `/komponenty` nadal działa bez flagi (tylko link w stopce znika).

Testy: w `playwright.config.ts` ustaw `SHOW_DEV_DETAILS: '1'` w `webServer.env`, żeby istniejące asercje e2e na `fixture-release-01` itd. dalej działały. Dodaj **jeden** nowy test Vitest renderujący `ObservationDetails` z `dev={false}` → markup **nie** zawiera `provenance-details` ani observationId, i z `dev={true}` → zawiera.

---

## 3. Etap E1 — fundament (tokeny, CSS, komponenty bazowe)

### 3.1 Tokeny — zastąp `apps/web/app/tokens.css`

Zachowaj istniejące kolory (paleta jest OK). Dodaj skalę typografii, kolory semantyczne i kolumny porównania. **Minimum tekstu: 12 px.**

```css
:root {
  /* kolory bazowe (bez zmian wartości) */
  --ink: #142e32; --muted: #536467; --paper: #edf4e8; --surface: #fff;
  --line: #d8ded9; --input-line: #83918c; --soft: #dfead6;
  --forest: #194d3b; --forest-soft: #e2eed8;
  --accent: #d2ef79; --accent-hover: #c3e65c; --focus: #336eaa;
  --warning: #714b18; --warning-bg: #fff4de;

  /* kolumny porównania (neutralne, NIE oznaczają „lepszej”) */
  --col-a: #194d3b;      /* rakieta 1: pasek, obramowanie */
  --col-a-soft: #edf2ee;
  --col-b: #5f7d1f;      /* rakieta 2 — ciemna oliwka, kontrast ≥ 4.5:1 na białym */
  --col-b-soft: #eef5dc;
  --diff-marker: #336eaa; /* kropka „różnica” */
  --meter-track: #dfe6dc;

  /* typografia */
  --font-body: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
  --text-xs: 0.75rem;    /* 12 px — minimum, etykiety, metadane */
  --text-sm: 0.875rem;   /* 14 px — tekst pomocniczy, komórki tabel */
  --text-md: 1rem;       /* 16 px — tekst podstawowy */
  --text-lg: 1.125rem;   /* 18 px — wartości w tabelach, nagłówki sekcji kart */
  --text-xl: 1.375rem;   /* 22 px — nagłówki sekcji */
  --text-2xl: 1.75rem;   /* 28 px — tytuł strony mobile */
  --text-3xl: 2.25rem;   /* 36 px — tytuł strony desktop */
  --leading-tight: 1.2; --leading-body: 1.5;
  --weight-regular: 400; --weight-semibold: 600; --weight-bold: 700;

  /* odstępy, promienie, kontrolki (bez zmian) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px;
  --radius-small: 6px; --radius: 12px;
  --control-height: 44px;   /* było 48 — kompaktowo, nadal ≥ 44 */
  --tap-min: 24px;          /* minimalny obszar klikalny linków inline (WCAG 2.5.8) */
  --content-width: 1328px;
  --header-height: 60px;
  --motion-feedback: 150ms;
}
```

Usuń stare `--text-small/--text-body/--text-large`, `--comparison-left/right` — zastąp użycia nowymi tokenami.

### 3.2 Struktura CSS

Docelowe pliki w `apps/web/app/styles/` (importowane w `layout.tsx` w tej kolejności):

| Plik | Zawartość |
|---|---|
| `tokens.css` | §3.1 (przenieś z `app/tokens.css`) |
| `base.css` | reset, `body`, nagłówki, linki, `:focus-visible`, `.skip-link`, `.main-shell`, `.site-header`, `.site-footer`, `.button*`, pola formularzy, `.sr-only`, reduced-motion |
| `ui.css` | style komponentów z §3.3 (`.badge`, `.source-info`, `.stat-bar`, `.spec-table`, `.page-header`, `.notice`) |
| `catalogue.css` | strona `/` |
| `profile.css` | `/rakiety/[id]` |
| `comparison.css` | `/porownaj` + picker + combobox |
| `gallery.css` | `/komponenty` (jeśli potrzeba) |

Zasady:
- **`comparison-ux.css` usuń całkowicie.** `globals.css` i `components.css` rozbij do plików powyżej i usuń.
- Każdy selektor zdefiniowany **w jednym pliku**. Bez nadpisywania tego samego selektora w dwóch plikach.
- `font-size` **tylko** przez `var(--text-*)`. Kolory tylko przez tokeny (wyjątek: `transparent`, `currentColor`, `white` w `.button`).
- Usuń reguły dla klas, które znikają w E3–E5 (lista w każdym etapie). W E1 tylko przenosisz; usuwanie martwych reguł w E6.
- Nagłówki: `h1` = `--text-3xl` desktop / `--text-2xl` < 640 px; `h2` = `--text-xl`; `h3` = `--text-lg`. `letter-spacing` max `-0.02em`, bez wartości w px.
- Liczby (masa, oceny): `font-variant-numeric: tabular-nums`.

**Strażnik w testach** — nowy `tests/web/css-guard.test.ts`:
- czyta wszystkie `apps/web/app/styles/*.css`,
- fail, jeśli znajdzie `font-size:` z wartością inną niż `var(--text-…)` lub `inherit`,
- fail, jeśli w `tokens.css` jakikolwiek `--text-*` < `0.75rem`,
- fail, jeśli istnieje `apps/web/app/comparison-ux.css` lub `globals.css`.

### 3.3 Komponenty bazowe — `apps/web/components/ui/`

Wszystkie bez nowych zależności. Server components, chyba że zaznaczono `'use client'`.

#### `badge.tsx`
```tsx
type Tone = 'neutral' | 'warning' | 'info';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode })
// <span className={`badge badge-${tone}`}>{children}</span>
```
Mapowanie istniejących klas: `.conflict-label` → `<Badge tone="warning">`, `.year-badge` → `<Badge>`, `.selected-badge` → `<Badge tone="info">`. Font `--text-xs`, `font-weight: 600`, padding `2px 8px`, radius `--radius-small`.

#### `source-info.tsx` — kluczowy komponent warstwy 2

Native `<details>` jako popover (działa bez JS, SSR, klawiatura, a markup jest w HTML — testy renderujące dalej znajdą treść).

```tsx
export function SourceInfo({ items, dev = false, label }: {
  items: { evidence: CatalogueEvidence; claim: string }[]; // 1..n wpisów (np. kształt + masa na karcie)
  label: string;   // np. "Źródło: Masa" — dla aria
  dev?: boolean;
})
```
Markup:
```html
<details class="source-info">
  <summary aria-label="{label}: {nazwy źródeł}">  <!-- ikona "i" w kółku, SVG 16px, aria-hidden -->
  </summary>
  <div class="source-info-panel" role="group" aria-label="{label}">
    <!-- dla każdego item -->
    <p class="source-info-claim">{claim}</p>              <!-- np. "Informacja sprzedawcy" -->
    <SourceCitation evidence={…} />                        <!-- istniejący komponent z evidence.tsx -->
    <p class="source-info-date">Pobrano {formatDate}</p>
    {dev && <p class="source-info-dev">{observationId} · {path}</p>}
  </div>
</details>
```
CSS: `summary` 24×24 px obszar (min `--tap-min`), ikona 16 px, kolor `--muted`, hover `--ink`, `list-style: none` + `::-webkit-details-marker{display:none}`. Panel: `position: absolute; z-index: 20; min-width: 240px; max-width: min(320px, 90vw)`, tło `--surface`, cień `0 6px 24px rgb(20 46 50 / .15)`, padding `--space-3`, tekst `--text-sm`. Kontener `.source-info { position: relative; display: inline-block; }`.

Mały komponent kliencki `source-info-closer.tsx` (`'use client'`), montowany **raz** w `layout.tsx`: zamyka otwarte `details.source-info` przy kliknięciu poza nim i przy `Escape` (przywraca focus na `summary`). Jeden `document.addEventListener`, bez stanu React.

#### `stat-bar.tsx`
```tsx
export function StatBar({ value, min, max, tone, label }: {
  value: number; min: number; max: number; tone: 'a' | 'b'; label: string;
})
// <meter class="stat-bar stat-bar-{tone}" min max value aria-label={label} />
```
Wysokość 8 px, radius 4 px, tor `--meter-track`, wypełnienie `--col-a` / `--col-b`. Style dla `::-webkit-meter-*` i `::-moz-meter-bar`. Używaj **tylko** gdy `ratingPosition(rating) !== null` (istniejąca funkcja w `racket-details.tsx` — przenieś ją do `lib/ratings.ts`, patrz E3).

#### `page-header.tsx`
```tsx
export function PageHeader({ title, meta, actions, back }: {
  title: string; meta?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string };
})
```
Jeden wzorzec nagłówka strony dla katalogu, profilu i porównania. Bez „eyebrow”, bez wielkich liter z rozstrzelonym kerningiem.

#### `notice.tsx`
Zastępuje `.mode-notice`, `.conflict-notice`. `tone: 'info' | 'warning'`, jedna linia, `--text-sm`.

### 3.4 Nagłówek i stopka (`layout.tsx`)

- Wysokość nagłówka `--header-height` (60 px), `position: sticky; top: 0; z-index: 30` na wszystkich stronach.
- Zawartość: logo | nawigacja „Katalog” · „Porównaj (n/2)” | (dev) „Wersja developerska”.
- Stopka: wordmark + jedno zdanie „Dane: PadelTrue (CC BY 4.0), padel.how.” + (dev) link do galerii. Usuń „Rakieta to szczegóły…” i „Sprint 02”.
- `ComparisonTray` — **zostaje**, ale zmienia formę: przyklejony pasek na dole ekranu (`position: sticky; bottom: 0`) widoczny tylko gdy `selection` istnieje i nie jesteśmy na `/porownaj`. Wysokość ≤ 64 px. Zawartość: „Do porównania: {nazwa 1} · {nazwa 2 | „wybierz drugą”}” + przycisk „Porównaj” + „Wyczyść”. Na mobile nazwy skrócone `text-overflow: ellipsis`.

**Zakaz w E1:** nie zmieniaj jeszcze układu stron — tylko przeniesienie CSS na tokeny/pliki i nowe komponenty (niewpięte, poza `layout.tsx`). Wizualnie strony mają wyglądać prawie tak samo (dopuszczalne: większy minimalny tekst, sticky header).

---

## 4. Etap E2 — wyświetlanie nazw i wartości (`apps/web/lib/display.ts`)

Czyste funkcje, pełne testy jednostkowe w `tests/web/display.test.ts`. **Nie zmieniają danych**, tylko prezentację. Oryginał zostaje w `ObservationDetails`.

```ts
/** "adidas Arrow Hit 2026" + brand "Adidas" + year 2026 → "Arrow Hit" */
export function displayModel(entry: Pick<CatalogueEntry,'brand'|'model'|'modelYear'>): string
```
1. Jeśli `model` zaczyna się od `brand` (porównanie case-insensitive, `toLocaleLowerCase('pl')`) + spacja → utnij.
2. Jeśli `modelYear !== null` i model kończy się na ` ${modelYear}` → utnij.
3. `trim()`. Jeśli wynik pusty → zwróć oryginalny `model`.

```ts
/** "ctrl pro" → "CTRL Pro", "" → null */
export function displayVariant(variant: string): string | null
/** "hr3 eva" → "HR3 EVA", "aluminised fibreglass (fiber glass silver)" → "Aluminised fibreglass (fiber glass silver)" */
export function displayMaterial(value: string | null): string | null
export function displayBrand(brand: string): string  // pierwsza litera wielka, reszta bez zmian; wyjątek: zachowaj w całości, jeśli brand jest w całości wielkimi literami ("NOX", "TESTLAB")
```
Reguła tokenów (wspólna): słowo jest akronimem i idzie wielkimi literami, jeśli pasuje do `/^(eva|ctrl|edt|mtw|fx|hr\d+|\d+k)$/i` (np. `eva`→`EVA`, `hr3`→`HR3`, `12k`→`12K`). Wszystko inne (np. `pro`) → zwykła wielka pierwsza litera. `displayVariant`: każde słowo z wielkiej litery (poza akronimami). `displayMaterial`: tylko pierwsza litera zdania wielka + akronimy.

```ts
/** "NOX · ML10 Pro Cup COORP by Miguel Lamperti · Pro · 2027" — do aria-label i tray */
export function displayLabel(entry): string
```
`racketLabel` w `lib/comparison.ts` zostaje (używany w sessionStorage i testach) — **nie zmieniaj go**. `displayLabel` jest nowym, ładnym wariantem do UI.

Gdzie wpiąć w E2: tylko wewnątrz nowych/przebudowanych komponentów w E3–E5. W E2 same funkcje + testy (min. 15 przypadków, w tym: brand w innej wielkości liter, model = brand, rok w środku nazwy — nie ucinaj, rok `null`, pusty wariant, `__proto__` jako wartość nie psuje funkcji).

---

## 5. Etap E3 — porównanie (`/porownaj`)

### 5.1 Docelowy układ (desktop 1440)

```
┌ sticky header 60 ────────────────────────────────────────────────┐
├ ComparisonHeader (sticky pod nagłówkiem, top: 60px, h ≤ 72) ─────┤
│ Porównanie            │ ■ NOX  ML10 Pro Cup…  Pro · 2027  [×] │ ■ Adidas Metalbone Carbon  — · 2026 [×] │ [Zmień]
├──────────────────────────────────────────────────────────────────┤
│ [☐ Tylko różnice]                                     (legenda) │
│ PARAMETRY                                                        │
│ ● Kształt     │ Okrągła (i)                │ Diament (i)          │
│   Masa        │ 360–375 g (i)              │ 360–375 g (i)        │
│ ● Balans      │ —  brak danych             │ Na główkę (i)        │
│ ● Rdzeń       │ HR3 EVA (i) [Niezweryf.]   │ EVA Soft Performance │
│ …                                                                │
│ OCENY · padel.how · skala 0–10 · ocena redakcyjna · Metodologia ↗│
│   (zastrzeżenie wspólne, jeśli jest — raz)                       │
│   Ocena ogólna │ ███████░░ 7.2              │ ██████░░░ 6.5        │
│   Kontrola     │ ████████░ 7.5              │ —                    │
│ OCENY · PadelTrue · skala 0–100 · wynik algorytmu · Metodologia ↗│
│   …                                                              │
│ ▸ Wszystkie obserwacje źródeł (n)                                │
└──────────────────────────────────────────────────────────────────┘
```
`●` = kropka różnicy (`--diff-marker`) przy etykiecie wiersza + tekst sr-only „różnica”.

Siatka: `grid-template-columns: minmax(140px, 220px) 1fr 1fr`. Pierwsza kolumna kolumn A/B ma 3 px lewy border `--col-a` / `--col-b`.

### 5.2 Mobile (< 640 px)

- `ComparisonHeader`: dwie kolumny po 50%, w każdej: kolorowy znacznik, nazwa (max 2 linie, ellipsis), rok; `[×]` 32×32. „Zmień” jako ikona/link pod spodem. Sticky jak desktop.
- Wiersz parametru: etykieta na pełną szerokość (`grid-column: 1 / -1`, `--text-xs`, uppercase **niedozwolony**), pod nią dwie kolumny wartości.
- Oceny: tak samo — etykieta wymiaru nad dwiema kolumnami z paskami.
- Brak poziomego scrolla przy 375 px (test istnieje).

### 5.3 Logika — `apps/web/lib/comparison.ts` (rozszerzenie, nie zmiana istniejących eksportów)

```ts
/** true, gdy wyświetlane wartości wybrane dla obu rakiet się różnią lub jedna strona ma brak. */
export function rowDiffers(row: ReturnType<typeof comparisonRows>[number]): boolean
```
Porównuj `specDisplayValue` wybranych (`selected`) wartości po obu stronach (posortowane, złączone `|`). Brak po jednej stronie i wartość po drugiej = różnica. Brak po obu = brak różnicy.

```ts
/** Kolejność wierszy: shape, weight, balance, core, surface, frame, thickness, player_level, potem reszta alfabetycznie po etykiecie. */
export const SPEC_ORDER: readonly string[]
```
`comparisonRows` — zastosuj `SPEC_ORDER` (obecnie kolejność to insertion order Setu; testy nie zależą od kolejności — sprawdź i jeśli zależą, dostosuj test).

Nowy plik `apps/web/lib/ratings.ts`:
```ts
export { ratingPosition } // przeniesione z racket-details.tsx (zostaw re-export w racket-details.tsx)
export const RATING_ORDER = ['overall','power','control','handling','maneuverability','comfort','forgiveness','sweet_spot','off_center_stability','spin_generation','power_accessibility','power_ceiling','defensive_output','net_performance','value'] as const;
export function sortDimensions(dims: string[]): string[] // wg RATING_ORDER, nieznane na końcu alfabetycznie
/** Wspólna notatka metodologii dla grupy: zwraca { url, sharedNote, perRatingNotes } */
export function groupMethodology(ratings: CatalogueRating[]): { url: string | null; sharedNote: string | null; hasDistinctNotes: boolean }
/** Opis skali grupy: "skala 0–10" albo "skale różne" (gdy oceny jednego źródła mają różne skale). */
export function groupScaleLabel(ratings: CatalogueRating[]): string
export function groupKindLabel(ratings: CatalogueRating[]): string // np. "ocena redakcyjna" / "wynik algorytmu" / "różne rodzaje"
```
`groupMethodology`: dla każdej oceny `methodologyCitation(rating.methodology)`. Jeśli wszystkie `note` są identyczne i niepuste → `sharedNote`. Jeśli różne → `hasDistinctNotes = true` i notatki pokazujesz per wiersz w popoverze. `ratingDimensionLabels` przenieś do `lib/ratings.ts` (re-export z `racket-details.tsx`).

Badge „Niepełne dane modelu” (obecny regex `/brakuj|niepełne|missing|neutral/i`) → przenieś do `ratings.ts` jako `isIncompleteModel(rating)`. Pokazuj **raz w nagłówku grupy**, jeśli dotyczy którejkolwiek oceny grupy, plus `*` przy wartości tej oceny z sr-only „niepełne dane”.

### 5.4 Komponenty — przepisz `components/racket-comparison.tsx`

Podziel na:
- `ComparisonHeader` (`'use client'` tylko jeśli potrzebny dla `RemoveComparisonItem` — ten już jest kliencki, więc header może być serwerowy i osadzać kliencki przycisk).
  - nazwa: `displayBrand(brand)` + `displayModel(entry)`; link do profilu na nazwie,
  - meta: `displayVariant(variant) ?? 'wariant nieustalony'` · `modelYear ?? 'rok nieznany'`; gdy `modelYear === null` → `<Badge tone="warning">Rocznik niepotwierdzony</Badge>` (tekst zachowaj — test),
  - zdjęcie: **tylko jeśli** `approvedImageFor(entry)` istnieje → miniatura 48×64. Brak zdjęcia → nic (bez placeholdera „Zdjęcie niedostępne” w nagłówku porównania). Uwaga: test e2e `approved fixture visual loads and failed images become an explicit fallback` — fallback po błędzie ładowania zostaje w `RacketVisual`; zmienia się tylko to, że przy braku zatwierdzonego zdjęcia nie renderujemy `RacketVisual` w ogóle. Zaktualizuj test, jeśli sprawdzał placeholder w porównaniu.
  - przycisk „Zmień” otwiera `details.comparison-change` (przenieś picker **na górę**, bezpośrednio pod nagłówkiem, domyślnie zwinięty, `id="change-pair"`; przycisk to `<a href="#change-pair">` + mały skrypt otwierający details, albo sam `summary` stylizowany jak przycisk).
- `SpecComparisonTable` — wiersze z §5.1:
  - komórka: wartość (`--text-lg`, semibold, tabular-nums) + `<SourceInfo>` + badge’e: konflikt („Rozbieżne źródła” — tekst zachowaj), `Przypisane producentowi — niezweryfikowane` → krótki badge „Niezweryfikowane” z pełnym tekstem w popoverze **i** w `title`/sr-only (test szuka pełnego tekstu w markupie — będzie w popoverze, OK),
  - brak: „—” + sr-only „Brak danych” (test szuka „Brak danych” — zostaw jako widoczny tekst `--text-sm --muted` „brak danych”? → **zostaw widoczny tekst „Brak danych”**, bez „—”),
  - `data-differs="true"` na wierszu gdy `rowDiffers`,
  - `aria-label` wiersza i komórki — zachowaj obecne (`row.label`, `${row.label}: ${racketLabel(entry)}`) — testy e2e używają `.comparison-row[aria-label="Powierzchnia"]`.
  - **zachowaj klasy** `.comparison-row`, `.comparison-cell`, `.comparison-value` (testy).
- Przełącznik „Tylko różnice”: `<label><input type="checkbox" id="only-diff" class="only-diff-toggle"> Tylko różnice</label>` przed tabelą. CSS bez JS:
  `.racket-comparison:has(.only-diff-toggle:checked) .comparison-row:not([data-differs="true"]) { display: none; }`. Gdy żaden wiersz się nie różni — pokaż pod przełącznikiem tekst „Parametry są takie same” tylko gdy zaznaczony (też przez `:has`).
- `RatingComparison` — jedna sekcja na źródło (`aria-label="Oceny: {sourceName}"` — **zachowaj**, test):
  - nagłówek grupy: `{sourceName}` · `groupScaleLabel` · `groupKindLabel` · link „Metodologia ↗” (jeśli `url`) · badge „Niepełne dane modelu” (jeśli dotyczy),
  - `sharedNote` raz, `--text-sm --muted`, pod nagłówkiem,
  - wiersz na wymiar (`sortDimensions`): etykieta | komórka A | komórka B. Komórka: `StatBar` (tone a/b) + wartość `7.5` + ` / 10` (`--text-xs`) + `SourceInfo` z: claim = `ratingLabels[kind]`, evidence, „Skala źródła: 0–10. Oryginał: 8/10.” (**zachowaj ten tekst** — test), notatka metodologii jeśli `hasDistinctNotes`.
  - Gdy rakieta ma kilka ocen tego samego wymiaru z tego samego źródła — pokaż wszystkie jedna pod drugą w komórce (nie ukrywaj).
  - Brak oceny: tekst „brak oceny” `--muted` (zastępuje „Brak ocen z tego źródła dla tej kategorii.”; zaktualizuj test jeśli sprawdza stary tekst).
  - Ocena `validationStatus !== 'valid'`: wartość „Nieustalona” + w popoverze „Interpretacja oceny niepotwierdzona.” (**zachowaj tekst** — test).
- `AllObservations` — na końcu: `<details class="comparison-all-observations"><summary>Wszystkie obserwacje źródeł ({n})</summary>` → dla każdego wiersza parametru dwie kolumny z istniejącym `ObservationDetails` (z propem `dev`). To zachowuje w markupie: oryginały, kontekst pomiaru („Jeden overgrip; pojedynczy egzemplarz”), „Pomiar egzemplarza”, „Pobrano …”. Usuń `details.comparison-observations` per komórka.
- `comparison-release` → tylko `dev`.

`RacketComparison` przyjmuje nowy prop `dev: boolean`. `StructuredView` przyjmuje `dev` i przekazuje dalej. `porownaj/page.tsx` i `komponenty/page.tsx` wołają `showDevDetails()`.

### 5.5 `porownaj/page.tsx`

- Usuń `<h1>Porównanie rakiet</h1>` z dużym odstępem → `PageHeader` z tytułem „Porównanie” (h1 `--text-2xl`), `back` do katalogu, `actions` = `ClearComparison`.
- Stan pusty/częściowy (`EmptyComparison`, picker) — bez zmian logiki; picker na górze, wyraźny.
- `ModeNotice supabase` na dole → tylko `dev`.

### 5.6 Testy do aktualizacji w E3

- `tests/web/comparison-render.test.ts`: asercje treści w większości zostają (markup `details` jest w HTML). Zmiany:
  - `class="provenance-details"`, observationId, `release` w markupie → renderuj z `dev: true` w tych przypadkach **albo** zmień oczekiwanie na brak przy `dev: false`. Zrób oba: istniejące przypadki dostają `dev: true`, dodaj 1 przypadek `dev: false`.
  - `RAKIETA 1 · 2026` → nowy nagłówek nie ma tego tekstu. Zastąp asercją na `data-column="a"` i rok `2026` w `.comparison-identity-meta`. **Zachowaj** `ROK NIEZNANY`? → zmień na „rok nieznany” i zaktualizuj asercję.
  - `<strong>Łezka</strong>` itd. — zachowaj `<strong>` wokół wartości w `.comparison-value`.
  - Dodaj: wiersz z różnicą ma `data-differs="true"`, wiersz identyczny nie ma.
  - Dodaj: przy wspólnej notatce metodologii tekst występuje **raz** w sekcji źródła (`split(note).length - 1 === 1`).
- `tests/web/comparison-ux.test.ts` — przejrzyj i dostosuj tylko asercje dotyczące usuniętych elementów.
- `tests/web/comparison.spec.ts`:
  - geometria (linia ~261–274): zamień na: przy 1440×900 dolna krawędź `ComparisonHeader` < 160 px **i** wiersz `Powierzchnia` < 600 px **i** nagłówek pierwszej grupy ocen < 900 px.
  - test sticky: po przewinięciu o 1500 px `ComparisonHeader` nadal ma `boundingBox().y` między 55 a 70.
  - test „Tylko różnice”: klik checkbox → liczba widocznych `.comparison-row` maleje (fixture: Orbit Control vs Orbit Pro różnią się kształtem i masą, więc ≥ 1 zostaje).
  - test `SourceInfo`: Tab do ikony źródła przy „Masa”, Enter → panel widoczny z „Pobrano”; Escape → panel zamknięty, focus na `summary`.
  - testy, które `getByText(...).toBeVisible()` na treści przeniesionej do `details` — najpierw otwórz właściwe `details` (`.comparison-all-observations summary` lub `SourceInfo`).
  - axe bez wyłączania reguł — musi przejść.

### 5.7 CSS do usunięcia po E3
`.comparison-identities`, `.comparison-identity*` (zastąpione `.comparison-header*`), `.comparison-observations`, `.comparison-rating-source > .comparison-pair > .comparison-column-label`, `.rating-compact*`, `.comparison-column-label` (jeśli nieużywane), `.comparison-data-note`.

---

## 6. Etap E4 — katalog (`/`)

### 6.1 Docelowy układ

```
sticky header
PageHeader: "Katalog rakiet"   meta: "444 rakiety · dane PadelTrue i padel.how"
┌ Wyszukiwarka (pełna szerokość, autouzupełnianie) ────────────────┐
│ 🔍 Szukaj marki, modelu, wariantu lub roku…                      │
└──────────────────────────────────────────────────────────────────┘
[Marka ▾] [Rocznik ▾] [Kształt ▾] [Masa ▾] [☐ Tylko z ocenami]    Sortuj: [Najnowsze ▾]
"128 wyników dla „nox”"   [Wyczyść filtry ×]
┌ karta ┐ ┌ karta ┐ ┌ karta ┐ ┌ karta ┐      (4 kolumny ≥1200, 3 ≥900, 2 ≥640, 1 lista <640)
paginacja: ← Poprzednia  Strona 1 z 19  Następna →
```

Usuń z `page.tsx`: `.catalogue-intro` (hero „Poznaj rakietę…”, „Dobre decyzje…”), `.section-heading` z „ODKRYWAJ ŚWIADOMIE”, `.evidence-explainer` („Każdy parametr ma swoją historię…”). `SourceLicenceNotice` → przenieś treść do stopki (§3.4) i usuń z katalogu (atrybucja CC BY 4.0 nadal jest na każdej stronie — w stopce). **Sprawdź z testem** `comparison-render.test.ts` oczekującym `CC BY 4.0` w `StructuredView` — tam `SourceLicenceNotice` **zostaje**.

`ModeNotice fixture` — zostaje, pod `PageHeader`, kompaktowy `Notice`.

### 6.2 Wyszukiwarka z podpowiedziami — `components/catalogue-search.tsx` (`'use client'`)

- Props: `options: RacketOption[]` (id, label = `displayLabel`, brand, year), `initialQuery: string`.
- Formularz GET na `/` zostaje (`name="q"`) — bez JS działa jak dziś.
- Po wpisaniu ≥ 2 znaków: lista max 8 podpowiedzi (`searchRacketOptions` z `racket-combobox.tsx` — przenieś funkcję do `lib/search.ts` i importuj w obu miejscach).
- Wzorzec ARIA jak w `RacketCombobox` (combobox + listbox, strzałki, Enter, Escape). **Różnica:** wybór podpowiedzi = `router.push('/rakiety/' + encodeURIComponent(id))`. Enter bez aktywnej podpowiedzi = zwykły submit (`q`).
- Ostatnia pozycja listy: „Pokaż wszystkie wyniki dla „{q}” ({n})” → submit.
- Przekazywanie opcji: `page.tsx` buduje `options` z `entries` (444 × ~80 B — OK).

### 6.3 Filtry i sortowanie — `lib/catalogue.ts`

Rozszerz `CatalogueFilters` o `weight: '' | 'lt355' | '355-365' | '365-375' | 'gt375'`, `rated: '' | '1'`, `sort: 'newest' | 'name' | 'weight' | 'ratings'` (domyślnie `newest`).

- `weight`: rakieta pasuje, gdy jej przedział `[weightMinG, weightMaxG]` **nachodzi** na przedział filtra (`lt355` = [0, 354.99], `gt375` = [375.01, ∞]; granice: `355-365` = [355, 365], `365-375` = [365, 375] — nachodzenie włącza obie). Rakieta bez masy **nie** pasuje do żadnego filtra masy. Etykiety: „do 355 g”, „355–365 g”, „365–375 g”, „ponad 375 g”.
- `rated=1`: `entry.ratings.length > 0`.
- `sort`:
  - `newest`: `modelYear` malejąco (`null` na końcu), potem brand, model, id,
  - `name`: obecne sortowanie,
  - `weight`: środek przedziału masy rosnąco (`null` na końcu), potem name,
  - `ratings`: liczba ocen malejąco, potem name.
- `parseFilters`: waliduj wartości do listy dozwolonych, inne → domyślne. `catalogueUrl` uwzględnia nowe pola (pomijaj domyślne).
- `PAGE_SIZE = 24`.
- Testy w `tests/web/catalogue.test.ts`: dopisz przypadki dla każdego filtra, granic masy, sortowań, walidacji złych wartości. **Uwaga:** istniejące testy mogą zakładać sortowanie alfabetyczne przy braku `sort` — dostosuj, przekazując `sort: 'name'` jawnie albo zmieniając oczekiwanie.

UI filtrów: natywne `<select>` (zostają — dostępne i proste) w jednym rzędzie, `height: var(--control-height)`. Komponent kliencki `components/auto-submit.tsx`: `<AutoSubmit />` w formularzu — na `change` dowolnego `select`/checkboxa wywołuje `form.requestSubmit()`. Przycisk „Szukaj” zostaje dla no-JS, ale wizualnie jako ikona w polu wyszukiwania. Licznik wyników `role="status"` — zostaje.

### 6.4 Karta rakiety — przepisz `RacketCard`

```
┌──────────────────────────────┐
│ NOX                 [2027]   │   brand --text-xs semibold muted; rok Badge (lub „rok nieznany” Badge warning)
│ ML10 Pro Cup COORP by…       │   displayModel, --text-lg bold, max 2 linie (line-clamp), link na całą kartę
│ Pro                          │   displayVariant; brak → „wariant nieustalony” --text-xs muted
│ ──────────────────────────── │
│ Okrągła · 360–375 g     (i)  │   kluczowe fakty w jednej linii; SourceInfo z 2 itemami (kształt, masa)
│ Oceny: padel.how, PadelTrue  │   lub „Brak ocen”; --text-sm muted
│ [Rozbieżne źródła]           │   tylko gdy konflikt
│ [ + Porównaj ]               │   AddToComparison, wariant kompaktowy (h 36, pełna szer.)
└──────────────────────────────┘
```
- Usuń: numer porządkowy (`.card-number`), `.card-bottom` z „Parametry ze źródłami” i okrągłą strzałką, dwa `SourceCitation` per spec.
- Zdjęcie: tylko jeśli `approvedImageFor(entry)`; wtedy miniatura 72×96 po prawej od nazwy. Brak → nic.
- Cała karta klikalna: link na `h3 a` z `::after { content:''; position:absolute; inset:0 }`, karta `position: relative`; `SourceInfo` i `AddToComparison` mają `position: relative; z-index: 1`.
- **Zachowaj** `aria-label` linku profilu w formie `Zobacz profil {brand} {model} {variant} {rok}` (test e2e: `'Zobacz profil TESTLAB Orbit Control 2026'`) — przenieś go na link `h3 a`.
- Zachowaj klasę `.racket-card` (testy).
- „Wariant nieustalony” i „Rok nieznany”/„Rocznik nieznany” — zachowaj dokładne teksty, których szukają testy (`catalogue.spec.ts:30` szuka „Rocznik nieznany” — to profil, nie karta).
- Mobile < 640 px: karta jako wiersz listy, padding `--space-3`, wysokość docelowo ≤ 180 px.

### 6.5 Testy E4

- `catalogue.spec.ts`: przycisk „Szukaj” może stać się ikoną — zachowaj **dostępną nazwę** „Szukaj” (`aria-label`), test zostaje.
- Nowy e2e: 375×812 → górna krawędź pierwszej `.racket-card` < 420 px.
- Nowy e2e: wpisz „orb” w wyszukiwarkę → widoczna lista podpowiedzi → ArrowDown + Enter → URL `/rakiety/…`.
- Nowy e2e: zmiana selecta „Kształt” bez klikania „Szukaj” → URL zawiera `shape=`.
- axe desktop + mobile bez naruszeń.

---

## 7. Etap E5 — profil (`/rakiety/[id]`)

### 7.1 Docelowy układ

```
PageHeader: back "Katalog"
┌──────────────────────────────────────────────────────────────────┐
│ NOX · 2027                                       [+ Porównaj]    │
│ ML10 Pro Cup COORP by Miguel Lamperti   (h1, displayModel)       │
│ Pro                                                              │
│ Inne wersje: [Pro · 2026] [Light · 2027]   (chipy, jeśli related) │
├────────── Parametry ─────────────┬──────── Oceny ────────────────┤
│ Kształt    Okrągła (i)           │ padel.how · 0–10 · redakcyjna │
│ Masa       360–375 g (i) [Rozb.] │  Ocena ogólna ███████░ 7.2 (i)│
│ Balans     brak danych           │  Kontrola     ████████ 7.5 (i)│
│ Rdzeń      HR3 EVA (i)           │ PadelTrue · 0–100 · algorytm  │
│ Powierzch. …                     │  (zastrzeżenie raz)           │
│ Rama …                           │  Moc          ████████ 83  (i)│
└──────────────────────────────────┴───────────────────────────────┘
[Notice warning] Źródła podają rozbieżne parametry. … (gdy konflikt — tekst zachowaj, test)
▸ Wszystkie obserwacje źródeł (n)     ← istniejąca lista ObservationDetails, zwinięta
   (krótka legenda u góry: Deklaracja producenta / Pomiar egzemplarza / Ocena redakcyjna — 1 linia każda)
```
Desktop ≥ 1024: dwie kolumny 1fr / 1fr. Poniżej: jedna kolumna, oceny pod parametrami.

### 7.2 Zmiany w kodzie

- `rakiety/[id]/page.tsx`:
  - usuń `.profile-hero` w obecnej formie, `.profile-description` („Ten profil dotyczy dokładnie…”), ciemny `.profile-key-specs`, sidebar `.reading-guide` i `.missing-specs`, eyebrows „FAKTY Z KONTEKSTEM”, „PERSPEKTYWA ŹRÓDŁA”,
  - **zachowaj** h1 = nazwa modelu (test: `heading { name: 'Orbit', level: 1 }` — przy fixture `displayModel` dla „Orbit” zwraca „Orbit”; sprawdź),
  - „Rocznik nieznany” — zachowaj ten tekst w meta, gdy `modelYear === null`,
  - `related` → chipy „Inne wersje”, etykieta chipa `displayVariant ?? 'wariant nieustalony'` · rok.
- Nowy komponent `components/spec-table.tsx` (`SpecTable`): dla jednej rakiety, te same wiersze co porównanie (`comparisonRows(entry, entry)` nie — napisz `entrySpecRows(entry)` w `lib/comparison.ts` z `SPEC_ORDER`, zwraca `{ key, label, selected[], observations[] }`). Komórka identyczna jak w porównaniu (wydziel `SpecValueCell` i używaj w obu).
- Nowy `components/rating-groups.tsx` (`RatingGroups`): ten sam nagłówek grupy i wiersz co w porównaniu, ale jedna kolumna (`columns={1}`). Wydziel wspólne `RatingGroupHeader` i `RatingValue` używane w porównaniu i profilu.
- Pusta lista ocen: „Brak opublikowanych ocen dla tego wariantu. Nie wyliczamy własnej oceny liczbowej.” — zachowaj.
- `RatingCard` (duże karty) — zostaje **tylko** w `/komponenty`, jeśli galeria go używa; w profilu i porównaniu nie.
- `ObservationDetails`: `h3` z etykietą; jako **główna** wartość pokaż `specDisplayValue(spec)`, a `rawValue` jako drugą linię „Oryginał: {raw}” (`--text-sm --muted`). Test e2e szuka `'372 g with one overgrip'` i `'360–370 g'` widocznych — po otwarciu `details` oba będą widoczne. Badge’e „Wartość katalogowa” / „Rozbieżność” → `Badge`.
- `ConflictNotice` → `Notice tone="warning"`, tekst bez zmian.

### 7.3 Testy E5
- `profile-render.test.ts`, `catalogue.spec.ts` (sekcja profilu): otwórz `Wszystkie obserwacje źródeł` przed asercjami na „Pomiar egzemplarza”, „372 g with one overgrip”; `Ślad pochodzenia danych` i `fixture-release-01` — tylko z `SHOW_DEV_DETAILS=1` (ustawione w playwright config w E0).
- `heading 'Parametry i źródła'` (catalogue.spec.ts:49) → zmień na nowy nagłówek „Parametry”.
- Nowy e2e: profil 1440×900 → sekcja ocen (pierwszy nagłówek grupy) widoczna nad zgięciem (< 900 px) dla rakiety fixture z ocenami.

---

## 8. Etap E6 — galeria, sprzątanie, dokumentacja

1. `/komponenty`: dostosuj do nowych komponentów (Badge, SourceInfo, StatBar, SpecValueCell, RatingGroups, ComparisonHeader). Zachowaj wszystkie stany: konflikt, nieznany rok/jednostka, deklaracja vs pomiar, skale 8/10 i 65/100, brak oceny, pusty/błąd. Test e2e galerii zaktualizuj.
2. Usuń martwy CSS (każda klasa w CSS musi występować w `apps/web/**/*.tsx` — sprawdź prostym skryptem `grep`, zapisz wynik w raporcie).
3. Teksty — zastąp/usuń wszystkie wystąpienia (grep po `apps/web`): „TWÓJ NASTĘPNY MECZ”, „Poznaj rakietę”, „Graj po swojemu”, „Dobre decyzje”, „ODKRYWAJ ŚWIADOMIE”, „FAKTY Z KONTEKSTEM”, „PERSPEKTYWA ŹRÓDŁA”, „JAK CZYTAĆ DANE”, „ŹRÓDŁA, NIE DOMYSŁY”, „Rakieta to szczegóły”, „Każdy parametr ma swoją historię”, „Różnice i braki pozostają widoczne”, „Pasek pokazuje pozycję w skali źródła…”. Zasada: żadnych nagłówków-ozdobników wersalikami. `section-kicker` i `eyebrow` usuń z kodu i CSS.
4. Zrzuty: `docs/design/screenshots/v3/` — catalogue-desktop, catalogue-mobile, profile-desktop, profile-mobile, comparison-desktop, comparison-mobile, comparison-only-diff, source-popover. Fixture, `SHOW_DEV_DETAILS` **wyłączone** (żeby było widać wersję użytkownika).
5. Dokumentacja: nowy `docs/design/UX_V3_RESULTS.md` — co zmieniono, tabela U1–U5 z wynikiem (spełnione / nie + dlaczego), wyniki testów **faktycznie uruchomionych**, znane ograniczenia. Zaktualizuj odnośniki w `README.md` (sekcja „Porównywarka i wspólne UI”) i dopisz `SHOW_DEV_DETAILS` w `docs/development/SETUP.md`. `SPRINT_02_DESIGN.md` i `COMPARISON_UX_REFINEMENT.md` — dopisz na górze jedną linię „Zastąpione przez UX v3 (link)”. Nie przepisuj ich historii.

---

## 9. Bramka po każdym etapie (obowiązkowa)

1. `npm run check` (typecheck, lint, Vitest, build) — zielone.
2. `npm run test:e2e` — zielone (Edge lokalnie albo `PLAYWRIGHT_CHANNEL=chromium`).
3. Zrzuty ekranu zmienionych stron (desktop 1440×900 + mobile 375×812) do `.local/ux-v3/E{n}/` (ignorowane przez git) — do recenzji.
4. Raport w odpowiedzi (nie w repo, poza E6): lista zmienionych plików, testy dodane/zmienione z uzasadnieniem **każdej** zmienionej asercji, co nie zostało zrobione i dlaczego, wynik komend (liczby testów).
5. Commit: `feat(web): UX v3 E{n} — {krótki opis}`. Bez merge’a, bez push na main.

Zakazane obejścia: `test.skip`, `.only`, wyłączanie reguł axe, `// @ts-ignore`, `eslint-disable`, usuwanie asercji bez zastąpienia równoważną, zwiększanie timeoutów zamiast naprawy.

---

## 10. Prompt startowy dla modelu wykonującego

Wklej przy każdym etapie (podmień `{n}`):

```
Jesteś wykonawcą planu docs/design/UX_OVERHAUL_PLAN.md w repozytorium Padłownia.
Realizuj WYŁĄCZNIE etap E{n}. Przeczytaj najpierw: sekcję 0 (zasady), sekcję etapu E{n}, sekcję 9 (bramka),
a także pliki, które etap wymienia. Nie zmieniaj plików z listy zakazanej (sekcja 0, punkt 8).
Gdy plan jest niejasny lub kod nie zgadza się z opisem — zatrzymaj się i opisz rozbieżność zamiast zgadywać.
Na końcu wykonaj bramkę z sekcji 9 i zwróć raport z punktu 9.4. Nie twierdź, że testy przeszły, jeśli ich nie uruchomiłeś.
```

Po każdym etapie raport + zrzuty wracają do tech leada do recenzji przed kolejnym etapem.
