import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('catalogue exposes fixture state, exact profiles and keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Pochodzenie danych' }).getByText('Dane demonstracyjne.', { exact: true })).toBeVisible();
  await expect(page.locator('.racket-card')).toHaveCount(6);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Przejdź do treści' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByLabel('Szukaj marki, modelu lub wariantu').fill('orbit control');
  await page.getByLabel('Rocznik', { exact: true }).selectOption('2026');
  await page.getByRole('button', { name: 'Szukaj' }).click();
  await expect(page).toHaveURL(/q=orbit\+control/);
  await expect(page.locator('.racket-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Zobacz profil TESTLAB Orbit Control 2026' }).click();
  await expect(page.getByRole('heading', { name: 'Orbit', exact: true, level: 1 })).toBeVisible();
  // The parameter table shows the catalogue value; the original observations sit in one section that starts collapsed.
  await expect(page.locator('.spec-row[data-spec="weight"] .comparison-value strong')).toHaveText('360–370 g');
  const observations = page.locator('.profile-observations');
  await expect(observations).not.toHaveAttribute('open', '');
  await observations.locator(':scope > summary').click();
  await expect(observations.getByText('Pomiar egzemplarza', { exact: true })).toBeVisible();
  await expect(observations.getByText('372 g with one overgrip', { exact: true })).toBeVisible();
  await expect(observations.getByText('360–370 g', { exact: true })).toBeVisible();
  // Developer-only trail (SHOW_DEV_DETAILS=1 in playwright.config.ts).
  await observations.getByText('Ślad pochodzenia danych', { exact: true }).first().click();
  await expect(page.getByText('fixture-release-01').first()).toBeVisible();
});

test('empty search, unknown year and conflict remain explicit', async ({ page }) => {
  await page.goto('/?q=nieistniejaca');
  await expect(page.getByRole('heading', { name: 'Tym razem bez wyników.' })).toBeVisible();
  await page.getByRole('link', { name: 'Pokaż cały katalog' }).click();
  await page.goto('/rakiety/fixture-arc-unknown');
  await expect(page.getByText('Rocznik nieznany', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Parametry jeszcze nieustalone.' })).toBeVisible();
  await page.goto('/rakiety/fixture-orbit-pro-2026');
  await expect(page.getByText('Źródła podają rozbieżne parametry.', { exact: true })).toBeVisible();
  await expect(page.locator('.spec-row[data-spec="shape"]').getByText('Rozbieżne źródła', { exact: true })).toBeVisible();
  await expect(page.locator('.observation').filter({ hasText: 'Kształt' })).toHaveCount(2);
  await expect(page.getByRole('navigation', { name: 'Inne wersje' }).getByRole('link', { name: 'Control · 2026', exact: true })).toHaveAttribute('href', '/rakiety/fixture-orbit-control-2026');
  await page.goto('/rakiety/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Nie znaleźliśmy tej rakiety.' })).toBeVisible();
});

test('desktop and mobile screenshots, no horizontal overflow, WCAG AA automated audit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/');
  await expect(page.locator('.racket-card')).toHaveCount(6);
  // Streamed Next.js content can exist in a hidden boundary before it is shown.
  await expect(page.locator('.racket-card').first()).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Pochodzenie danych' }).getByText('Dane demonstracyjne.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/design/screenshots/catalogue-desktop.png', fullPage: true, caret: 'initial' });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.goto('/rakiety/fixture-orbit-control-2026');
  await expect(page.getByRole('heading', { name: 'Parametry', exact: true, level: 2 })).toBeVisible();
  await page.screenshot({ path: 'docs/design/screenshots/profile-desktop.png', fullPage: true, caret: 'initial' });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByLabel('Szukaj marki, modelu lub wariantu')).toBeVisible();
  await expect(page.locator('.racket-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/design/screenshots/catalogue-mobile.png', fullPage: true, caret: 'initial' });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.goto('/rakiety/fixture-orbit-pro-2026');
  await expect(page.getByText('Źródła podają rozbieżne parametry.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/design/screenshots/profile-mobile.png', fullPage: true, caret: 'initial' });
  await page.setViewportSize({ width: 812, height: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

// In dev mode app/loading.tsx can leave the real content in a hidden Suspense div next to the visible fallback.
const visibleCards = (page: Page) => page.locator('.racket-card').filter({ visible: true });
const searchBox = (page: Page) => page.getByRole('combobox', { name: 'Szukaj marki, modelu lub wariantu' });
// The form is a plain GET form until hydration; interactions that rely on JavaScript must wait for AutoSubmit to attach.
const hydrated = (page: Page) => expect(page.locator('form[data-auto-submit="ready"]').filter({ visible: true })).toHaveCount(1);
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations;

test('on a phone the first racket card starts in the upper half of the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const first = visibleCards(page).first();
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  expect(box!.y).toBeLessThan(420);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('typing shows suggestions; ArrowDown + Enter opens the profile', async ({ page }) => {
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  const input = searchBox(page);
  await input.click();
  await input.pressSequentially('orb');
  const list = page.getByRole('listbox', { name: 'Podpowiedzi rakiet' });
  await expect(list).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  // Three Orbit rackets plus the "show all results" row.
  await expect(list.getByRole('option')).toHaveCount(4);
  await expect(list.getByRole('option').last()).toHaveText('Pokaż wszystkie wyniki dla „orb” (3)');
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /.+/);
  await expect(list.getByRole('option', { selected: true })).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/rakiety\/fixture-orbit-/);
  await expect(page.getByRole('heading', { name: 'Orbit', exact: true, level: 1 })).toBeVisible();
});

test('one character shows no suggestions, Escape closes them and Enter without a choice is a normal search', async ({ page }) => {
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  const input = searchBox(page);
  await input.click();
  await input.pressSequentially('o');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await input.pressSequentially('rb');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.pressSequentially('i');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/\?.*q=orbi/);
  await expect(page.getByRole('status').filter({ hasText: 'dla „orbi”' })).toBeVisible();
});

test('the "show all results" row submits the search', async ({ page }) => {
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  await searchBox(page).click();
  await searchBox(page).pressSequentially('vector');
  await page.getByRole('option', { name: /Pokaż wszystkie wyniki dla „vector”/ }).click();
  await expect(page).toHaveURL(/q=vector/);
  await expect(visibleCards(page)).toHaveCount(2);
});

test('suggestions work and stay accessible on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  await searchBox(page).click();
  await searchBox(page).pressSequentially('orb');
  await expect(page.getByRole('listbox', { name: 'Podpowiedzi rakiet' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await axe(page)).toEqual([]);
});

test('changing a filter submits the form without pressing "Szukaj"', async ({ page }) => {
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  await page.getByLabel('Kształt', { exact: true }).selectOption('diamond');
  await expect(page).toHaveURL(/shape=diamond/);
  await expect(visibleCards(page)).toHaveCount(1);
  await expect(page.getByLabel('Kształt', { exact: true })).toHaveValue('diamond');
});

test('weight, year and shape filters combine, with sorting and the clear link', async ({ page }) => {
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  await page.getByLabel('Masa', { exact: true }).selectOption('lt355');
  await expect(page).toHaveURL(/weight=lt355/);
  // Only Vector Lite (345–355 g) reaches the "up to 355 g" range; Orbit Control 2025 starts exactly at 355 g.
  await expect(visibleCards(page)).toHaveCount(1);
  await expect(visibleCards(page).first().getByRole('link', { name: 'Zobacz profil TESTLAB Vector Lite 2026' })).toBeVisible();
  await hydrated(page);
  // 355–365 g includes both boundaries: Lite (ends at 355), Attack (starts at 365) and every range in between; Control 2025 drops out with the year.
  await page.getByLabel('Masa', { exact: true }).selectOption('355-365');
  await expect(visibleCards(page)).toHaveCount(5);
  await hydrated(page);
  await page.getByLabel('Rocznik', { exact: true }).selectOption('2026');
  await expect(visibleCards(page)).toHaveCount(4);
  await hydrated(page);
  await page.getByLabel('Kształt', { exact: true }).selectOption('teardrop');
  await expect(visibleCards(page)).toHaveCount(2);
  await page.getByRole('link', { name: 'Wyczyść filtry' }).click();
  await expect(visibleCards(page)).toHaveCount(6);
});

test('"Tylko z ocenami" and sorting are applied from the URL and from the controls', async ({ page }) => {
  await page.goto('/?rated=1');
  await expect(visibleCards(page)).toHaveCount(1);
  await expect(page.getByLabel('Tylko z ocenami').filter({ visible: true })).toBeChecked();
  await page.goto('/');
  await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
  await page.getByLabel('Sortuj').selectOption('weight');
  await expect(page).toHaveURL(/sort=weight/);
  const firstLink = visibleCards(page).first().getByRole('link').first();
  await expect(firstLink).toHaveAccessibleName('Zobacz profil TESTLAB Vector Lite 2026');
  await page.goto('/?sort=nonsense&weight=999');
  await expect(visibleCards(page)).toHaveCount(6);
  await expect(page.getByLabel('Sortuj').filter({ visible: true })).toHaveValue('newest');
});

test('the whole card opens the profile, while the source popover and the comparison button stay independent', async ({ page }) => {
  await page.goto('/?q=orbit control&year=2026');
  const card = visibleCards(page).first();
  await expect(card).toBeVisible();
  await expect(card.getByText('Okrągła · 360–370 g')).toBeVisible();
  await expect(card.getByText('Oceny: Syntetyczna redakcja')).toBeVisible();
  const source = card.locator('details.source-info > summary');
  await source.click();
  await expect(page).toHaveURL(/q=orbit/);
  await expect(card.getByText('Pobrano', { exact: false }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card.getByText('Pobrano', { exact: false }).first()).toBeHidden();
  await card.getByRole('button', { name: /^Dodaj do porównania/ }).click();
  await expect(page).toHaveURL(/q=orbit/);
  await expect(card.getByRole('button', { name: /^Usuń z porównania/ })).toHaveAttribute('aria-pressed', 'true');
  const box = (await card.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 24);
  await expect(page).toHaveURL(/\/rakiety\/fixture-orbit-control-2026/);
});

test('cards show a thumbnail only for approved images, with no placeholder and no ordinal number', async ({ page }) => {
  await page.goto('/?q=orbit');
  await expect(visibleCards(page)).toHaveCount(3);
  await expect(visibleCards(page).getByRole('img')).toHaveCount(2);
  await expect(page.getByText('Zdjęcie niedostępne')).toHaveCount(0);
  await expect(page.locator('.card-number')).toHaveCount(0);
});

test('an unknown year is a warning badge on the card; the footer carries the data attribution', async ({ page }) => {
  await page.goto('/?year=unknown');
  await expect(visibleCards(page)).toHaveCount(1);
  await expect(visibleCards(page).first().locator('.badge-warning', { hasText: 'Rok nieznany' })).toBeVisible();
  await expect(visibleCards(page).first().getByText('Kształt i masa nieustalone')).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'CC BY 4.0' })).toBeVisible();
  await expect(page.locator('.source-licence')).toHaveCount(0);
});

test('catalogue grid uses 4, 3, 2 columns and a single list column on a phone', async ({ page }) => {
  const columns = async () => visibleCards(page).evaluateAll((nodes) => new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left))).size);
  for (const [width, expected] of [[1440, 4], [1000, 3], [700, 2], [375, 1]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(visibleCards(page).first()).toBeVisible();
  await hydrated(page);
    expect(await columns()).toBe(Math.min(expected, 6));
  }
});

test('profile: parameters and ratings sit side by side and the ratings start above the fold on a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/rakiety/fixture-orbit-control-2026');
  const heading = page.locator('.rating-group-header').filter({ visible: true }).first();
  await expect(heading).toBeVisible();
  const box = (await heading.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(900);
  const specs = (await page.locator('.profile-specs').filter({ visible: true }).boundingBox())!;
  const ratings = (await page.locator('.profile-ratings').filter({ visible: true }).boundingBox())!;
  expect(ratings.x).toBeGreaterThan(specs.x + specs.width - 1);
  expect(Math.abs(ratings.y - specs.y)).toBeLessThan(2);
  // Below 1024 px the ratings follow the parameters in one column.
  await page.setViewportSize({ width: 900, height: 900 });
  const narrowSpecs = (await page.locator('.profile-specs').filter({ visible: true }).boundingBox())!;
  const narrowRatings = (await page.locator('.profile-ratings').filter({ visible: true }).boundingBox())!;
  expect(narrowRatings.y).toBeGreaterThan(narrowSpecs.y + narrowSpecs.height - 1);
  expect(narrowRatings.x).toBeCloseTo(narrowSpecs.x, 0);
});

test('profile: rating source popover, open observations and a conflicting variant stay accessible on desktop and phone', async ({ page }) => {
  for (const size of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    await page.goto('/rakiety/fixture-orbit-control-2026');
    await page.locator('.rating-row[data-dimension="control"] .source-info > summary').filter({ visible: true }).click();
    await expect(page.getByText('Skala źródła: 0–10. Oryginał: 8/10.', { exact: true })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.goto('/rakiety/fixture-orbit-pro-2026');
    await page.locator('.profile-observations > summary').filter({ visible: true }).click();
    await expect(page.locator('.profile-observations').getByText('Diamond', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await axe(page)).toEqual([]);
  }
});
