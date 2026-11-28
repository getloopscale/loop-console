import { expect, test } from '@playwright/test';

/**
 * The sidebar on a window shorter than its menu.
 *
 * Found on staging at 937px of height: the root menu is taller than the window, the whole
 * sidebar scrolled, the team switcher left the screen and the footer was drawn past the end of
 * the sidebar, over the status bar's row. The unit test pins the structure; only a browser can
 * say where the boxes land.
 */
test.describe('sidebar on a short window', () => {
  test.use({ viewport: { width: 1280, height: 620 } });

  test('pins the header and the footer, and scrolls the list between them', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('complementary');
    const nav = sidebar.getByRole('navigation', { name: 'LoopScale' });
    await expect(nav).toBeVisible();

    const box = async (locator: ReturnType<typeof page.locator>) => {
      const b = await locator.boundingBox();
      if (!b) throw new Error('element has no box');
      return { top: Math.round(b.y), bottom: Math.round(b.y + b.height) };
    };
    const aside = await box(sidebar);
    const switcher = await box(sidebar.getByRole('button', { name: /switch team/i }));
    const docs = await box(sidebar.getByRole('link', { name: /documentation/i }));
    const list = await box(nav);

    // The team switcher is a few pixels taller than the 48px row it is centered in, so the
    // header is located by the middle of the switcher and not by its edges.
    const middle = (b: { top: number; bottom: number }) => (b.top + b.bottom) / 2;
    expect(aside).toEqual({ top: 0, bottom: 620 });
    expect(middle(switcher)).toBeGreaterThan(0);
    expect(middle(switcher)).toBeLessThan(list.top);
    expect(docs.bottom).toBeLessThanOrEqual(620);
    expect(list.bottom).toBeLessThanOrEqual(docs.top);

    // The list is what scrolls: its content is taller than its box, and the last entry is
    // reached by scrolling it, with the header where it was.
    const overflow = await nav.evaluate((n) => n.scrollHeight - n.clientHeight);
    expect(overflow).toBeGreaterThan(0);
    await sidebar.getByRole('link', { name: 'Profile' }).scrollIntoViewIfNeeded();
    await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeInViewport();
    expect((await box(sidebar.getByRole('button', { name: /switch team/i }))).top).toBe(switcher.top);
  });
});
