import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const manifest = read('release-manifest.js');
const dynamic = manifest.match(/dynamicStyles:\s*\[([^\]]+)\]/)[1];
const styles = ['style.css', 'todo-ui-v142.css', 'mine-icon-fix-v121.css',
  ...[...dynamic.matchAll(/"([^"]+)"/g)].map(match => match[1])];

for (const width of [390, 860, 861, 1366]) {
  test(`Ver.373 mobile layout cannot reveal hidden, archived or reserved task rows (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/*', route => route.abort('blockedbyclient'));
    // Isolated cascade test, not an application/Firebase test. Load actual assets.
    await page.setContent(`<div class="list-view"><table class="task-table"><tbody>
      <tr id="normal"><td>Normal row</td></tr>
      <tr id="hidden" hidden><td>Hidden row</td></tr>
      <tr id="archived" hidden class="workflow-task-archived-v152"><td>Archived row</td></tr>
      <tr id="archive-class" class="workflow-task-archived-v152"><td>Archive class</td></tr>
      <tr id="reserved" class="future-task-v167-hidden"><td>Reserved row</td></tr>
      </tbody></table></div>`);
    for (const name of styles) await page.addStyleTag({ content: read(name) });
    const display = width <= 860 ? 'grid' : 'table-row';
    await expect(page.locator('#normal')).toBeVisible();
    await expect(page.locator('#normal')).toHaveCSS('display', display);
    for (const id of ['hidden', 'archived', 'archive-class', 'reserved']) {
      await expect(page.locator(`#${id}`)).toBeHidden();
      await expect(page.locator(`#${id}`)).toHaveCSS('display', 'none');
    }
    // Show again only when the real owner removes every exclusion marker.
    await page.locator('#archived').evaluate(node => { node.hidden = false; });
    await expect(page.locator('#archived')).toBeHidden();
    await page.locator('#archived').evaluate(node => node.classList.remove('workflow-task-archived-v152'));
    await page.locator('#reserved').evaluate(node => node.classList.remove('future-task-v167-hidden'));
    await expect(page.locator('#archived')).toBeVisible();
    await expect(page.locator('#reserved')).toHaveCSS('display', display);
    // Responsive transitions must not resurrect excluded rows.
    await page.setViewportSize({ width: width <= 860 ? 861 : 390, height: 900 });
    await expect(page.locator('#hidden')).toBeHidden();
    await expect(page.locator('#archive-class')).toBeHidden();
    await expect(page.locator('#normal')).toBeVisible();
  });
}
