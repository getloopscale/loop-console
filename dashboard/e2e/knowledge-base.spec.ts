/**
 * Playwright browser-runtime E2E — Knowledge Base (RAG) journeys.
 *
 * Closes the UI dogfood gap: the RAG / Knowledge Base surface (renamed in the sidebar to "Knowledge Base")
 * had no dedicated journey spec. Exercises the sidebar drill-in + every Knowledge Base page against a real
 * browser engine with the dev server running VITE_USE_MOCKS=true (mirrors journeys.spec.ts).
 *
 * Run: npx playwright test knowledge-base
 */
import { expect, test } from '@playwright/test';

// The Knowledge Base sub-pages (route + the sidebar submenu label), from app-sidebar.tsx + app.tsx routes.
const KB_PAGES = [
  { label: 'Overview', path: '/rag' },
  { label: 'Collections', path: '/rag/collections' },
  { label: 'Connectors', path: '/rag/connectors' },
  { label: 'Documents', path: '/rag/documents' },
  { label: 'Ask', path: '/rag/ask' },
  { label: 'Analytics', path: '/rag/analytics' },
] as const;

test.describe('Dashboard — Knowledge Base (RAG) journeys', () => {
  test('sidebar exposes the renamed "Knowledge Base" capability and drills into it', async ({ page }) => {
    await page.goto('/');
    // The capability item was renamed RAG → Knowledge Base (kept the /rag route). It drills into a
    // submenu. It is a link of the sidebar; the Overview grid has a card of the same name.
    const kbItem = page.getByText('Knowledge Base', { exact: true }).first();
    await expect(kbItem).toBeVisible();
    await kbItem.click();
    await expect(page).toHaveURL(/\/rag$/);
    // The drill-in submenu exposes the Knowledge Base sub-pages (links of the sidebar).
    for (const { label } of KB_PAGES) {
      await expect(page.getByRole('complementary').getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }
  });

  test('every Knowledge Base page renders without an error boundary', async ({ page }) => {
    for (const { path } of KB_PAGES) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
      // The route is wrapped in <Boundaried> — a crash renders the boundary fallback. Assert the page
      // rendered real content (a heading) and NOT the error fallback.
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.getByText(/something went wrong|error boundary/i)).toHaveCount(0);
    }
  });

  test('Ask page shows the query surface', async ({ page }) => {
    await page.goto('/rag/ask');
    await expect(page).toHaveURL(/\/rag\/ask$/);
    // The Ask page is the answer/query surface — a textbox to enter a question.
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('Collections page shows a collections surface', async ({ page }) => {
    await page.goto('/rag/collections');
    await expect(page).toHaveURL(/\/rag\/collections$/);
    await expect(page.getByRole('heading').first()).toBeVisible();
    // A create affordance (button) is present on the collections management page.
    await expect(page.getByRole('button').first()).toBeVisible();
  });
});
