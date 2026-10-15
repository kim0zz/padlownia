import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Authored fixture IDs only. This suite must never capture real source content.
const release = 'fixture-release-01';
const control2026 = 'fixture-orbit-control-2026';
const control2025 = 'fixture-orbit-control-2025';
const pro2026 = 'fixture-orbit-pro-2026';
const unknownYear = 'fixture-arc-unknown';
const labels = {
  control2026: 'TESTLAB Orbit · Control · 2026',
  control2025: 'TESTLAB Orbit · Control · 2025',
  pro2026: 'TESTLAB Orbit · Pro · 2026',
};

function comparisonPath(left: string, right?: string, datasetVersion = release) {
  const params = new URLSearchParams({ release: datasetVersion, left });
  if (right !== undefined) params.set('right', right);
  return `/porownaj?${params}`;
}

const add = (page: Page, label: string) => page.getByRole('button', { name: `Dodaj do porównania: ${label}`, exact: true });
const tray = (page: Page) => page.getByRole('complementary', { name: 'Wybrane rakiety' });
const comparison = (page: Page) => page.getByRole('region', { name: 'Zestawienie dwóch rakiet' });
const comparisonPicker = (page: Page) => page.getByRole('form', { name: 'Wybierz dwie rakiety' });
const fixtureNotice = (page: Page) => page.getByRole('complementary', { name: 'Pochodzenie danych' }).getByText('Dane demonstracyjne.', { exact: true });

// In dev mode app/loading.tsx streams the page as a Suspense boundary: right after `load` the real content may
// still sit in a hidden `div[hidden]#S:n` next to the visible fallback. Page-level text lookups count visible nodes only.
const visibleText = (page: Page, text: string, options?: { exact?: boolean }) => page.getByText(text, options).filter({ visible: true });

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function expectAccessible(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
}

test('text search and dropdown select precise IDs with keyboard, and editing never submits a stale ID', async ({ page }) => {
  await page.goto('/porownaj');
  const left = comparisonPicker(page).getByRole('combobox', { name: 'Rakieta 1 · model, wariant i rok', exact: true });
  const right = comparisonPicker(page).getByRole('combobox', { name: 'Rakieta 2 · model, wariant i rok', exact: true });
  await page.getByRole('button', { name: 'Pokaż podpowiedzi: Rakieta 1 · model, wariant i rok', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(left).toBeFocused();
  await expect(left).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(left).toHaveAttribute('aria-activedescendant', /-1$/);
  await page.keyboard.press('Escape');
  await left.fill('orbit control 2026');
  await expect(page.getByRole('option')).toHaveCount(1);
  await left.press('ArrowDown');
  await left.press('Enter');
  await expect(left).toHaveValue(labels.control2026);
  await expect(comparisonPicker(page).locator('input[name="left"]')).toHaveValue(control2026);
  await right.fill('orbit pro');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expectAccessible(page);
  await page.getByRole('option').click();
  await comparisonPicker(page).getByRole('button', { name: 'Porównaj rakiety', exact: true }).click();
  await expect(comparison(page)).toBeVisible();
  await page.getByRole('link', { name: 'Zmień porównywane rakiety' }).click();
  await left.fill('no-such-model');
  await expect(visibleText(page, 'Brak wyników. Spróbuj innej nazwy.', { exact: true })).toBeVisible();
  await expect(comparisonPicker(page).locator('input[name="left"]')).toHaveValue('');
  await left.press('Escape');
  await expect(left).toHaveAttribute('aria-expanded', 'false');
  await comparisonPicker(page).getByRole('button', { name: 'Porównaj rakiety', exact: true }).click();
  expect(await left.evaluate((node: HTMLInputElement) => node.validity.valid)).toBe(false);
  await expect(page).toHaveURL((url) => url.searchParams.get('left') === control2026);
  await left.fill('orbit control 2025');
  await left.press('Enter');
  await comparisonPicker(page).getByRole('button', { name: 'Porównaj rakiety', exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('left') === control2025 && url.searchParams.get('right') === pro2026);
});

test('approved fixture visual loads and failed images become an explicit fallback', async ({ page }) => {
  await page.goto(comparisonPath(control2026, pro2026));
  const images = comparison(page).getByRole('img');
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await expect(image).toHaveJSProperty('complete', true);
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  }
  await page.route('**/media/rackets/fixture-orbit.svg', (route) => route.fulfill({ status: 404, body: 'missing fixture image' }));
  await page.reload();
  await expect(comparison(page).getByText('Zdjęcie niedostępne', { exact: true })).toHaveCount(2);
  await expect(comparison(page).getByRole('img')).toHaveCount(0);
  await expectAccessible(page);
});

test('selection is keyboard operable, limited to two precise rackets and removable', async ({ page }) => {
  await page.goto('/');
  await expect(fixtureNotice(page)).toBeVisible();
  const first = add(page, labels.control2026);
  await expect(first).toBeEnabled();
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: `Usuń z porównania: ${labels.control2026}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(tray(page).getByRole('listitem')).toHaveCount(1);

  await add(page, labels.control2025).click();
  await expect(tray(page).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('navigation', { name: 'Nawigacja główna' }).getByRole('link', { name: 'Porównaj (2/2)', exact: true })).toBeVisible();
  await add(page, labels.pro2026).click();
  await expect(visibleText(page, 'Wybrano już dwie rakiety. Usuń jedną z wyboru przed dodaniem kolejnej.', { exact: true })).toBeVisible();
  await expect(tray(page).getByRole('listitem')).toHaveCount(2);
  await expect(tray(page).getByText(labels.pro2026, { exact: true })).toHaveCount(0);
  await expect(add(page, labels.pro2026)).toHaveAttribute('aria-pressed', 'false');

  await tray(page).getByRole('button', { name: `Usuń z wyboru: ${labels.control2025}`, exact: true }).click();
  await expect(tray(page).getByRole('listitem')).toHaveCount(1);
  await expect(add(page, labels.control2025)).toHaveAttribute('aria-pressed', 'false');
  await add(page, labels.pro2026).click();
  await expect(tray(page).getByText(labels.pro2026, { exact: true })).toBeVisible();
  await expect(tray(page).getByRole('listitem')).toHaveCount(2);
  await tray(page).getByRole('button', { name: 'Wyczyść wybór', exact: true }).click();
  await expect(tray(page)).toHaveCount(0);
  await expect(add(page, labels.control2026)).toHaveAttribute('aria-pressed', 'false');
  await expect(add(page, labels.pro2026)).toHaveAttribute('aria-pressed', 'false');
});

test('profile and GET search navigation retain selection and the URL reproduces exact years', async ({ page }) => {
  await page.goto('/');
  await add(page, labels.control2026).click();
  await page.getByRole('link', { name: 'Zobacz profil TESTLAB Orbit Control 2025', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === `/rakiety/${control2025}`);
  await expect(page.getByRole('heading', { name: 'Orbit', level: 1, exact: true })).toBeVisible();
  await expect(tray(page).getByText(labels.control2026, { exact: true })).toBeVisible();
  await add(page, labels.control2025).click();
  await page.getByRole('main').getByRole('link', { name: 'Katalog', exact: true }).click();

  // The native GET form performs a document navigation, exercising session restore.
  await page.getByLabel('Szukaj marki, modelu lub wariantu').fill('orbit');
  await page.getByRole('button', { name: 'Szukaj', exact: true }).click();
  await expect(page).toHaveURL(/q=orbit/);
  await expect(page.locator('.racket-card')).toHaveCount(3);
  await expect(tray(page).getByRole('listitem')).toHaveCount(2);
  await expect(tray(page).getByText(labels.control2026, { exact: true })).toBeVisible();
  await expect(tray(page).getByText(labels.control2025, { exact: true })).toBeVisible();
  await tray(page).getByRole('link', { name: 'Porównaj rakiety', exact: true }).click();
  await expect(comparison(page)).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/porownaj'
    && url.searchParams.get('left') === control2026
    && url.searchParams.get('right') === control2025
    && url.searchParams.get('release') === release);

  await page.reload();
  await expect(comparison(page)).toBeVisible();
  await expect(tray(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Zmień porównywane rakiety' }).click();
  await expect(comparisonPicker(page).getByLabel('Rakieta 1 · model, wariant i rok', { exact: true })).toHaveValue(labels.control2026);
  await expect(comparisonPicker(page).getByLabel('Rakieta 2 · model, wariant i rok', { exact: true })).toHaveValue(labels.control2025);
  const identities = comparison(page).locator('.comparison-header-cell');
  await expect(identities).toHaveCount(2);
  await expect(identities.nth(0).locator('.comparison-identity-meta')).toContainText('2026');
  await expect(identities.nth(1).locator('.comparison-identity-meta')).toContainText('2025');
  await expect(identities.nth(0).getByRole('link', { name: 'Orbit', exact: true })).toHaveAttribute('href', `/rakiety/${control2026}`);
  await expect(identities.nth(1).getByRole('link', { name: 'Orbit', exact: true })).toHaveAttribute('href', `/rakiety/${control2025}`);
  const mass = comparison(page).locator('.comparison-row[aria-label="Masa"] .comparison-cell');
  await expect(mass.nth(0).locator('.comparison-value strong')).toHaveText('360–370 g');
  await expect(mass.nth(1).locator('.comparison-value strong')).toHaveText('355–365 g');
});

test('direct links expose incomplete, invalid and stale choices without silently substituting data', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/porownaj');
  await expect(page.getByRole('heading', { name: 'Co chcesz porównać?', exact: true })).toBeVisible();
  await expect(comparison(page)).toHaveCount(0);

  await page.goto(comparisonPath(control2026));
  await expect(page.getByRole('heading', { name: 'Dodaj drugą rakietę.', exact: true })).toBeVisible();
  await expect(comparisonPicker(page).getByLabel('Rakieta 1 · model, wariant i rok', { exact: true })).toHaveValue(labels.control2026);
  await expect(comparison(page)).toHaveCount(0);

  await page.goto(comparisonPath(control2026, control2026));
  await expect(visibleText(page, 'Nieprawidłowy wybór. Porównanie wymaga dwóch różnych rakiet i poprawnego odnośnika.', { exact: true })).toBeVisible();
  await expect(comparison(page)).toHaveCount(0);

  await page.goto(comparisonPath(control2026, 'unknown-racket-id'));
  await expect(visibleText(page, 'Co najmniej jedna rakieta nie jest dostępna w tej publikacji. Wybierz dokładny model z aktualnego katalogu.', { exact: true })).toBeVisible();
  await expect(comparison(page)).toHaveCount(0);

  await page.goto(`${comparisonPath(control2026, control2025)}&left=${pro2026}`);
  await expect(visibleText(page, 'Nieprawidłowy wybór. Porównanie wymaga dwóch różnych rakiet i poprawnego odnośnika.', { exact: true })).toBeVisible();
  await expect(comparison(page)).toHaveCount(0);

  await page.goto(comparisonPath(control2026, control2025, 'fixture-release-old'));
  await expect(visibleText(page, 'Wersja danych w tym odnośniku nie jest już aktualna.', { exact: false })).toBeVisible();
  await expect(comparison(page)).toHaveCount(0);
  const refresh = page.getByRole('button', { name: 'Porównaj w aktualnej wersji', exact: true });
  await refresh.focus();
  await page.keyboard.press('Enter');
  await expect(comparison(page)).toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get('release') === release
    && url.searchParams.get('left') === control2026 && url.searchParams.get('right') === control2025);
});

test('same-route removal clears the search selection and explicit URLs replace session context without undoing clear', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: 'Nawigacja główna' });
  const leftSelect = comparisonPicker(page).getByLabel('Rakieta 1 · model, wariant i rok', { exact: true });
  const rightSelect = comparisonPicker(page).getByLabel('Rakieta 2 · model, wariant i rok', { exact: true });
  await page.goto(comparisonPath(control2026, control2025));
  await expect(comparison(page)).toBeVisible();
  await expect(tray(page)).toHaveCount(0);
  await comparison(page).getByRole('link', { name: `Usuń z wyboru: ${labels.control2025}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dodaj drugą rakietę.', exact: true })).toBeVisible();
  await expect(visibleText(page, 'Wybrano 1 z 2.')).toBeVisible();
  await expect(leftSelect).toHaveValue(labels.control2026);
  await expect(rightSelect).toHaveValue('');
  await expect(comparison(page)).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Porównaj (1/2)', exact: true })).toBeVisible();

  // Establish A/B as the saved pair, then open an explicit different pair C/D.
  await page.goto(comparisonPath(control2026, control2025));
  await expect(navigation.getByRole('link', { name: 'Porównaj (2/2)', exact: true })).toBeVisible();
  await page.goto(comparisonPath(pro2026, unknownYear));
  await expect(comparison(page)).toBeVisible();
  await page.getByRole('link', { name: 'Zmień porównywane rakiety' }).click();
  await expect(leftSelect).toHaveValue(labels.pro2026);
  await expect(rightSelect).toHaveValue('TESTLAB Arc · Standard · Rok nieznany');
  const selected = await page.evaluate(() => JSON.parse(sessionStorage.getItem('padlownia:comparison:v1')!));
  expect(selected.items.map((item: { id: string }) => item.id)).toEqual([pro2026, unknownYear]);

  await page.getByRole('link', { name: 'Wyczyść wybór', exact: true }).click();
  await expect(tray(page)).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Porównaj', exact: true })).toHaveAttribute('href', '/porownaj');
  await expect(page.getByRole('heading', { name: 'Co chcesz porównać?', exact: true })).toBeVisible();
  await expect(comparison(page)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('padlownia:comparison:v1'))).toBeNull();
});

test('comparison preserves source observations, specimen context, conflicts and unknown years', async ({ page }) => {
  await page.goto(comparisonPath(control2026, pro2026));
  await expect(comparison(page)).toBeVisible();
  const shape = comparison(page).locator('.comparison-row[aria-label="Kształt"]');
  await expect(shape.locator('.comparison-cell')).toHaveCount(2);
  await expect(shape.locator('.comparison-value strong')).toHaveText(['Okrągła', 'Łezka']);
  await expect(shape.getByText('Rozbieżne źródła', { exact: true })).toBeVisible();
  // Original observations moved from per-cell <details> to one "all observations" section.
  const observations = comparison(page).locator('.comparison-all-observations');
  await observations.locator(':scope > summary').click();
  const shapeObservations = observations.locator('.all-observations-row[data-spec="shape"]');
  await expect(shapeObservations.getByText('Diamond', { exact: true })).toBeVisible();
  await expect(shapeObservations.getByText('Ocena redakcyjna', { exact: true })).toBeVisible();

  const mass = comparison(page).locator('.comparison-row[aria-label="Masa"] .comparison-cell');
  await expect(mass.nth(0).locator('.comparison-value strong')).toHaveText('360–370 g');
  const massObservations = observations.locator('.all-observations-row[data-spec="weight"]');
  await expect(massObservations.getByText('372 g with one overgrip', { exact: true })).toBeVisible();
  await expect(massObservations.getByText('Pomiar egzemplarza', { exact: true })).toBeVisible();
  await expect(massObservations.getByText('Jeden overgrip; pojedynczy egzemplarz', { exact: false })).toBeVisible();

  // The scale and original value of a rating live in its source popover; a missing rating is stated in the cell.
  const control = comparison(page).locator('.comparison-rating-row[data-dimension="control"] .comparison-rating-cell');
  await control.nth(0).locator('.source-info > summary').click();
  await expect(comparison(page).getByText('Skala źródła: 0–10. Oryginał: 8/10.', { exact: true })).toBeVisible();
  await expect(control.nth(1).getByText('brak oceny', { exact: true })).toBeVisible();
  await comparison(page).getByText('Wersja porównywanych danych', { exact: true }).click();
  await expect(comparison(page).locator('.comparison-release').getByText(release, { exact: true })).toBeVisible();

  await page.goto(comparisonPath(control2026, unknownYear));
  await expect(comparison(page).getByText('Rocznik niepotwierdzony', { exact: true })).toBeVisible();
  await expect(comparison(page).locator('.comparison-row[aria-label="Kształt"] .comparison-cell').nth(1).getByText('Brak danych', { exact: true })).toBeVisible();
  await expect(comparison(page).locator('.comparison-row[aria-label="Masa"] .comparison-cell').nth(1).getByText('Brak danych', { exact: true })).toBeVisible();
});

test('source popovers open from the keyboard, close with Escape and stay inside the viewport in both columns', async ({ page }) => {
  await page.goto(comparisonPath(control2026, pro2026));
  await expect(comparison(page)).toBeVisible();
  const cell = (label: string, index: number) => comparison(page).locator(`.comparison-row[aria-label="${label}"] .comparison-cell`).nth(index);
  const shapeB = cell('Kształt', 1).locator('.source-info > summary');
  const massA = cell('Masa', 0).locator('.source-info > summary');
  await shapeB.focus();
  await page.keyboard.press('Tab');
  await expect(massA).toBeFocused();
  await page.keyboard.press('Enter');
  const panel = cell('Masa', 0).locator('.source-info-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Pobrano', { exact: false })).toBeVisible();
  await expect(panel.getByText('Deklaracja producenta', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(massA).toBeFocused();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    for (const index of [0, 1]) {
      const info = cell('Masa', index).locator('.source-info');
      await info.locator(':scope > summary').click();
      const box = (await info.locator('.source-info-panel').boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await expectNoPageOverflow(page);
      await page.keyboard.press('Escape');
    }
  }
});

test('"Tylko różnice" hides identical rows and the identity header stays under the site header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(comparisonPath(control2026, pro2026));
  const rows = comparison(page).locator('.comparison-row:visible');
  const before = await rows.count();
  await page.getByRole('checkbox', { name: 'Tylko różnice' }).check();
  // Orbit Control and Orbit Pro differ in shape and mass; balance, core and surface are empty on both sides.
  await expect(rows).toHaveCount(2);
  expect(before).toBeGreaterThan(2);
  for (const row of await rows.all()) await expect(row).toHaveAttribute('data-differs', 'true');
  await page.getByRole('checkbox', { name: 'Tylko różnice' }).uncheck();
  await expect(rows).toHaveCount(before);

  await page.evaluate(() => window.scrollTo(0, 1500));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const header = (await comparison(page).locator('.comparison-header').boundingBox())!;
  expect(header.y).toBeGreaterThanOrEqual(55);
  expect(header.y).toBeLessThanOrEqual(70);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 400));
  const mobileHeader = (await comparison(page).locator('.comparison-header').boundingBox())!;
  expect(mobileHeader.y).toBeGreaterThanOrEqual(55);
  expect(mobileHeader.y).toBeLessThanOrEqual(70);
});

test('comparison is accessible on keyboard, desktop and mobile with synthetic screenshots', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(comparisonPath(control2026, pro2026));
  await expect(comparison(page)).toBeVisible();
  await expect(fixtureNotice(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Przejdź do treści', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expectNoPageOverflow(page);
  // Above the fold at 1440x900: site header, page title, the mandatory fixture notice and the collapsed picker (about 240 px),
  // then the identity bar, the key parameters and the first ratings.
  const identityBar = (await comparison(page).locator('.comparison-header').boundingBox())!;
  expect(identityBar.y + identityBar.height).toBeLessThan(330);
  expect(identityBar.height).toBeLessThanOrEqual(80);
  const lastCoreRow = (await comparison(page).locator('.comparison-row[aria-label="Powierzchnia"]').boundingBox())!;
  expect(lastCoreRow.y + lastCoreRow.height).toBeLessThan(700);
  const firstRatingGroup = (await comparison(page).locator('.rating-group-header').first().boundingBox())!;
  expect(firstRatingGroup.y + firstRatingGroup.height).toBeLessThan(900);
  await expect(comparison(page).getByRole('meter')).toHaveCount(1);
  await expectAccessible(page);
  await page.screenshot({ path: 'docs/design/screenshots/comparison-desktop.png', fullPage: true, caret: 'initial' });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('heading', { name: 'Porównanie', level: 1, exact: true })).toBeVisible();
  await expect(comparison(page).locator('.comparison-header-cell')).toHaveCount(2);
  await expectNoPageOverflow(page);
  await expectAccessible(page);
  await page.screenshot({ path: 'docs/design/screenshots/comparison-mobile.png', fullPage: true, caret: 'initial' });
  await page.setViewportSize({ width: 812, height: 375 });
  await expectNoPageOverflow(page);
});

test('fixture gallery exposes source scales and unknown states with accessible responsive layout', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/komponenty');
  await expect(page.getByRole('heading', { name: 'Galeria komponentów', exact: true })).toBeVisible();
  await expect(fixtureNotice(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deklaracja, pomiar i brak jednostki', exact: true })).toBeVisible();
  const values = page.getByRole('region', { name: 'Wartość parametru', exact: true });
  await expect(values.getByText('Brak danych', { exact: true })).toBeVisible();
  await expect(values.getByText('Rozbieżne źródła', { exact: true })).toBeVisible();
  await expect(values.getByText('Niezweryfikowane', { exact: true })).toBeVisible();
  await expect(values.getByText('Brak potwierdzonej wartości', { exact: true })).toBeVisible();
  const ratings = page.getByRole('region', { name: 'Oceny źródłowe', exact: true });
  await expect(ratings.getByText('skala 0–10', { exact: true })).toBeVisible();
  await expect(ratings.getByText('skala 0–100', { exact: true })).toBeVisible();
  await expect(ratings.getByText('Niepełne dane modelu', { exact: true })).toBeVisible();
  await expect(ratings.getByText('Nieustalona', { exact: true })).toBeVisible();
  // The scale and original value moved from the rating card into the source popover: open it with the keyboard.
  for (const [dimension, text] of [['Kontrola', 'Skala źródła: 0–10. Oryginał: 8/10.'], ['Łatwość uzyskania mocy', 'Skala źródła: 0–100. Oryginał: 65/100.']] as const) {
    const summary = ratings.locator(`summary[aria-label^="Źródło oceny: ${dimension}"]`);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(ratings.getByText(text, { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(ratings.getByText(text, { exact: true })).toBeHidden();
  }
  await expect(page.getByRole('region', { name: 'Zestawienie dwóch rakiet' }).locator('.comparison-header-cell')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Brak danych i błąd odczytu', exact: true }).getByRole('heading', { name: 'Nie udało się pobrać katalogu.', exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
  await expectAccessible(page);
  await page.screenshot({ path: 'docs/design/screenshots/components-desktop.png', fullPage: true, caret: 'initial' });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectNoPageOverflow(page);
  await expectAccessible(page);
  const ratingsLink = page.getByRole('navigation', { name: 'Sekcje galerii' }).getByRole('link', { name: 'Oceny', exact: true });
  await ratingsLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#gallery-ratings$/);
  await page.setViewportSize({ width: 812, height: 375 });
  await expectNoPageOverflow(page);
});
