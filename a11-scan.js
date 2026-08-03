/* eslint-env node */
import { chromium } from 'playwright';
import { getCompliance, close } from 'accessibility-checker';

const baseUrl = 'https://ever6bmc.aus.stglabs.ibm.com';
const username = process.env.BMC_USER || 'service';
const password = process.env.BMC_PASS || 'G3tR3ady4W0rldCup!';

const routes = [
  '/',
  '/#/operations/server-power-operations',
  '/#/operations/firmware',
  '/#/resource-management/memory',
];

// Wait for the loading bar to appear then disappear, or timeout gracefully.
// BProgressBar renders as [role="progressbar"]; the parent is hidden via v-if
// once isLoadingComplete becomes true.
async function waitForLoadingBar(page, timeout = 30000) {
  try {
    // If a progress bar appears, wait for it to be removed from the DOM
    await page.waitForSelector('[role="progressbar"]', {
      state: 'attached',
      timeout: 3000,
    });
    await page.waitForSelector('[role="progressbar"]', {
      state: 'detached',
      timeout,
    });
  } catch {
    // No loading bar appeared (fast page or already gone) — that's fine
  }
  // Extra settle time after loading completes
  await page.waitForTimeout(5000);
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreHTTPSErrors: true,
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // ── Login ──────────────────────────────────────────────────────────────────
  await page.goto(`${baseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-test-id="login-input-username"]');
  await page.fill('[data-test-id="login-input-username"]', username);
  await page.fill('[data-test-id="login-input-password"]', password);
  await page.click('[data-test-id="login-button-submit"]');
  // Wait until the app navigates away from the login page
  await page.waitForURL((url) => !url.hash.includes('/login'), {
    timeout: 20000,
  });
  await waitForLoadingBar(page);
  console.log('Logged in successfully');
  // ──────────────────────────────────────────────────────────────────────────

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForLoadingBar(page);
    const html = await page.content();
    await getCompliance(html, route.replace(/\//g, '_') || 'home');
    console.log(`Scanned: ${route}`);
  }

  await context.close();
  await browser.close();
  await close();
})();
