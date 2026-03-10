import type { Page } from '@playwright/test';

/**
 * Pre-written demo script used for integration testing.
 * Demonstrates the "Virtual Try-On" feature on the test product page.
 */
export async function demo(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Click "Add to Cart" to show the counter incrementing
  await page.click('#add-to-cart');
  await page.waitForTimeout(400);
  await page.click('#add-to-cart');
  await page.waitForTimeout(600);

  // Open the Virtual Try-On modal
  await page.click('#try-on-btn');
  await page.waitForSelector('#modal.open', { state: 'visible' });
  await page.waitForTimeout(800);

  // Close the modal
  await page.click('#close-modal');
  await page.waitForTimeout(400);
}
