import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('catalogue exposes fixture state, exact profiles and keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Dane demonstracyjne.', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Orbit', exact: true })).toBeVisible();
  await expect(page.getByText('Pomiar egzemplarza', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('372 g with one overgrip', { exact: true })).toBeVisible();
  await expect(page.getByText('360–370 g', { exact: true })).toBeVisible();
  await page.getByText('Ślad pochodzenia danych', { exact: true }).first().click();
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
  await expect(page.locator('.observation').filter({ hasText: 'Kształt' })).toHaveCount(2);
  await page.goto('/rakiety/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Nie znaleźliśmy tej rakiety.' })).toBeVisible();
});

test('desktop and mobile screenshots, no horizontal overflow, WCAG AA automated audit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/');
  await expect(page.locator('.racket-card')).toHaveCount(6);
  await page.screenshot({ path: 'docs/design/screenshots/catalogue-desktop.png', fullPage: true, caret: 'initial' });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.goto('/rakiety/fixture-orbit-control-2026');
  await expect(page.getByRole('heading', { name: 'Parametry i źródła', exact: true })).toBeVisible();
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
