import { test, expect } from '@playwright/test';

// テスト専用ルームのローカルフォールバックのみを使用し、本番Firebaseに接続しない。
// Wait for the currently shipped canonical owners, not retired V550/V555 APIs.
async function waitForSeededMemos(page, ids) {
  await page.waitForFunction(expected => {
    const board = window.WorkBoardPaletteBridge?.readSnapshot?.();
    const memos = window.WorkBoardPaletteMemoBridgeV369?.readSnapshot?.();
    return board?.connectionMode === 'local-only'
      && Array.isArray(memos)
      && expected.every(id => memos.some(memo => memo.id === id));
  }, ids, { timeout: 30_000 });
}

async function boot(page, room, { historical = [], memos = null } = {}) {
  await page.addInitScript(({ room, historical, memos }) => {
    if (!sessionStorage.getItem('wb-v531-fixture-ready')) {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
      localStorage.setItem('system-task-users:' + room, JSON.stringify(['福冨', '森井']));
      if (historical.length) localStorage.setItem('system-task-todos:' + room, JSON.stringify(historical));
      if (memos) localStorage.setItem('system-business-memos:' + room, JSON.stringify(memos));
      sessionStorage.setItem('wb-v531-fixture-ready', '1');
    }
    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true, get() { return null; }, set() {}
    });
  }, { room, historical, memos });
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
  await page.goto('/?room=' + room, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  if (memos) {
    await waitForSeededMemos(page, Object.keys(memos));
  }
}

// Expanded and collapsed desktop navigation have different vertical geometry.
// The CI trace showed Playwright's memo click landing on another sidebar item
// while the hover-open transition was in flight. Wait on actual UI state and
// computed width, never a fixed sleep or a repeat click.
async function clickDesktopMemo(page) {
  await page.mouse.move(400, 250);
  await page.locator('.sidebar').hover({ position: { x: 25, y: 120 } });
  await expect(page.locator('body')).toHaveAttribute('data-desktop-sidebar-state', 'expanded');
  await expect(page.locator('.sidebar')).toHaveCSS('width', '276px');
  await page.locator('[data-work-memo-layout]').click();
  await expect(page.locator('body')).toHaveClass(/work-memo-mode-v167/);
  await expect(page.locator('#workMemoViewV167')).toBeVisible();
}

test('Today panels move using visible arrows and retain the user-specific order after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, 'test-v531-today-order');
  const panels = page.locator('#todayView .today-grid [data-today-panel-id]');
  await expect(panels).toHaveCount(5);
  await expect(panels.first()).toHaveAttribute('data-today-panel-id', 'schedule');
  await page.locator('#todayView [data-today-panel-id="schedule"] .today-panel-shift-v531').nth(1).click();
  await expect(panels.first()).toHaveAttribute('data-today-panel-id', 'overdue');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await expect(page.locator('#todayView .today-grid [data-today-panel-id]').first())
    .toHaveAttribute('data-today-panel-id', 'overdue');
});

test('Todo shows newest first and supports desktop drag while retaining mobile arrow buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, 'test-v531-todo-order');
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  const input = page.locator('#todayTodoInput');
  await input.fill('先に登録したToDo');
  await page.locator('.todo-create-form [type="submit"]').click();
  await expect(page.locator('#todoView .todo-list:not(.is-completed) [data-todo-id]')).toHaveCount(1);
  await input.fill('後から登録したToDo');
  await page.locator('.todo-create-form [type="submit"]').click();
  const rows = page.locator('#todoView .todo-list:not(.is-completed) [data-todo-id]');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.todo-text')).toHaveText('後から登録したToDo');
  await expect(rows.first().locator('.todo-move-button')).toHaveCount(2);
  await rows.first().locator('.todo-drag-handle-v531').dragTo(rows.nth(1));
  await expect(rows.first().locator('.todo-text')).toHaveText('先に登録したToDo');
});

test('past completed ToDos remain searchable beyond seven days with paged DOM rendering', async ({ page }) => {
  const now = Date.now();
  const historical = Array.from({ length: 85 }, (_, index) => ({
    id: 'old-' + index,
    owner: '福冨',
    text: '古い履歴 ' + index,
    memo: '保存した内容 ' + index,
    completed: true,
    completedAt: now - (index + 8) * 86400000,
    createdAt: now - (index + 9) * 86400000,
    updatedAt: now - (index + 8) * 86400000,
    order: index * 1024,
    revision: 1
  }));
  await boot(page, 'test-v531-todo-history', { historical });
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  await expect(page.locator('.todo-history-v146 .todo-history-item-v146')).toHaveCount(50);
  await expect(page.locator('.todo-history-more-v531')).toHaveCount(1);
  await page.locator('.todo-search-input-v145').fill('古い履歴 84');
  await expect(page.locator('.todo-history-v146 .todo-history-item-v146')).toHaveCount(1);
  await expect(page.locator('.todo-history-v146 .todo-item .todo-text')).toContainText('古い履歴 84');
});

test('business memo order is editable without changing shared memos and remains after reload', async ({ page }) => {
  const memos = {
    memoOlder: { id: 'memoOlder', title: '古い業務メモ', body: '連絡先', category: '定型情報', revision: 1, updatedAt: 1000, pinned: false },
    memoNewer: { id: 'memoNewer', title: '新しい業務メモ', body: '手順', category: '定型情報', revision: 1, updatedAt: 2000, pinned: false }
  };
  await page.setViewportSize({ width: 1366, height: 900 });
  await boot(page, 'test-v531-memo-order', { memos });
  await expect(page.locator('[data-work-memo-layout]')).toBeAttached({ timeout: 20_000 });
  // Memo cards may exist while hidden; this helper verifies the visible route.
  await clickDesktopMemo(page);
  const cards = page.locator('#workMemoViewV167 .work-memo-card-v167');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().locator('h4')).toHaveText('新しい業務メモ');
  const moveOlderFirst = cards.nth(1).locator('.work-memo-move-v531').first();
  await expect(moveOlderFirst).toBeVisible();
  await moveOlderFirst.click();
  await expect(cards.first().locator('h4')).toHaveText('古い業務メモ');
  const savedMemo = await page.evaluate(() => JSON.parse(localStorage.getItem('system-business-memos:test-v531-memo-order') || '{}'));
  expect(savedMemo.memoOlder.revision).toBe(1);
  expect(savedMemo.memoNewer.revision).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await waitForSeededMemos(page, Object.keys(memos));
  await clickDesktopMemo(page);
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').first().locator('h4')).toHaveText('古い業務メモ');

  // A sidebar reconstruction can replace the same-looking button after boot.
  // A memo route must still work without a second, dangling per-button listener.
  await page.locator('.nav-item[data-layout="today"]').first().click();
  await expect(page.locator('body')).not.toHaveClass(/work-memo-mode-v167/);
  await page.evaluate(() => {
    const original = document.querySelector('[data-work-memo-layout]');
    original.replaceWith(original.cloneNode(true));
  });
  await clickDesktopMemo(page);
  await expect(page.locator('#workMemoViewV167 .work-memo-card-v167').first().locator('h4')).toHaveText('古い業務メモ');
});


for (const width of [320, 390]) {
  test('Classic ToDo save keeps the same row, scroll anchor and keyboard focus at ' + width + 'px', async ({ page }) => {
    test.slow();
    const now = Date.now();
    const historical = Array.from({ length: 26 }, (_, index) => ({
      id: 'save-return-' + index,
      text: 'ToDoの一覧行 ' + index,
      memo: '保存前のメモ ' + index,
      completed: false,
      completedAt: 0,
      order: index * 1024,
      owner: '福冨',
      revision: 1,
      createdAt: now - index * 60_000,
      updatedAt: now - index * 60_000
    }));
    await page.setViewportSize({ width, height: 812 });
    await boot(page, 'test-v531-save-return-' + width, { historical });
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    const row = page.locator('#todoView .todo-item[data-todo-id="save-return-12"]');
    await expect(row).toBeVisible();
    await row.locator('.todo-summary-button').click();
    const newTitle = 'ToDoの編集・保存後も同じ位置 ' + width;
    await row.locator('.todo-detail input').fill(newTitle);
    await row.locator('.todo-detail textarea').fill('保存したメモを維持します');
    const save = row.locator('.todo-detail-save');
    await save.scrollIntoViewIfNeeded();
    const oldTop = await save.evaluate(node => node.getBoundingClientRect().top);
    await save.click();
    await expect(row.locator('.todo-text')).toHaveText(newTitle);
    await expect(row.locator('.todo-detail textarea')).toHaveValue('保存したメモを維持します');
    await expect(row.locator('.todo-detail-save')).toBeFocused();
    const newTop = await row.locator('.todo-detail-save').evaluate(node => node.getBoundingClientRect().top);
    expect(Math.abs(newTop - oldTop), 'save should not jump to a different screen position').toBeLessThan(22);

    // Validation failure must not trigger success-only focus/scroll recovery.
    await row.locator('.todo-detail input').fill('');
    await row.locator('.todo-detail-save').click();
    await expect(row.locator('.todo-detail input')).toHaveValue('');
    await expect(row.locator('.todo-text')).toHaveText(newTitle);
    await expect(row.locator('.todo-detail')).toBeVisible();
  });
}

for (const width of [320, 390]) {
  test('Classic searched ToDo remains editable through search-term changes and returns to the list at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const historical = [
      { id: 'search-edited-' + width, text: '備品を確認する', memo: '旧検索キーワードを含むメモ', completed: false,
        completedAt: 0, order: 0, owner: '福冨', revision: 1, createdAt: now, updatedAt: now },
      { id: 'search-other-' + width, text: '別件のToDo', memo: '', completed: false,
        completedAt: 0, order: 1024, owner: '福冨', revision: 1, createdAt: now - 1000, updatedAt: now - 1000 }
    ];
    await page.setViewportSize({ width, height: 812 });
    await boot(page, 'test-v531-search-edit-return-' + width, { historical });
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    const search = page.locator('#todoView .todo-search-input-v145');
    const row = page.locator('#todoView [data-todo-id="search-edited-' + width + '"]');

    await search.fill('旧検索キーワード');
    await expect(row).toBeVisible();
    await row.locator('.todo-summary-button').click();
    await row.locator('.todo-detail textarea').fill('新しく書き直したメモ');
    await expect(row).toBeVisible();
    await expect(page.locator('#todoView .todo-search-result-v145')).toContainText('一時表示');
    await row.locator('.todo-detail-save').click();
    await expect(row.locator('.todo-detail textarea')).toHaveValue('新しく書き直したメモ');
    await expect(row.locator('.todo-detail-save')).toBeFocused();
    await expect(row).toBeVisible();

    await search.fill('一致するToDoがない語句');
    await expect(row).toBeHidden();
    await expect(page.locator('#todoView .todo-search-reset-v145')).toBeVisible();
    await page.locator('#todoView .todo-search-reset-v145').click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(row).toBeVisible();

    // A canonical remote/local refresh while search has focus must restore
    // the search cursor without affecting the editor-save focus behavior.
    await search.fill('備品');
    await search.evaluate(input => { input.focus(); input.setSelectionRange(1, 2); });
    await page.evaluate(() => document.querySelector('#todoView .todo-state-toggle-v144')?.click());
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('備品');
    const caret = await search.evaluate(input => [input.selectionStart, input.selectionEnd]);
    expect(caret).toEqual([1, 2]);
  });
}

for (const width of [320, 390]) {
  test('Classic ToDo completion keeps a nearby action in view at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const historical = Array.from({ length: 26 }, (_, index) => ({
      id: 'toggle-anchor-' + index,
      text: index === 12 ? '切替対象のToDo' : 'ToDo一覧の行 ' + index,
      memo: '',
      completed: false,
      completedAt: 0,
      order: index * 1024,
      owner: '福冨',
      revision: 1,
      createdAt: now - index * 60_000,
      updatedAt: now - index * 60_000
    }));
    historical.push({
      id: 'toggle-already-done',
      text: '別の完了済みToDo',
      memo: '',
      completed: true,
      completedAt: now,
      order: 30_000,
      owner: '福冨',
      revision: 1,
      createdAt: now - 30 * 60_000,
      updatedAt: now
    });
    await page.setViewportSize({ width, height: 812 });
    await boot(page, 'test-v531-toggle-anchor-' + width, { historical });
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    const completedSection = page.locator('#todoView .todo-list.is-completed');
    await page.locator('#todoView .todo-completed-toggle-v145').click();
    await expect(completedSection).toHaveClass(/is-collapsed-v145/);

    const row = page.locator('#todoView [data-todo-id="toggle-anchor-12"]');
    const toggle = row.locator('.todo-state-toggle-v144');
    await toggle.scrollIntoViewIfNeeded();
    const adjacentId = await row.evaluate(node =>
      node.nextElementSibling?.dataset.todoId || node.previousElementSibling?.dataset.todoId);
    expect(adjacentId).toBeTruthy();
    const before = await toggle.evaluate(node => node.getBoundingClientRect().top);
    await toggle.click();
    await expect(row.locator('.todo-check')).toBeChecked();
    await expect(completedSection).toHaveClass(/is-collapsed-v145/);
    const neighboringToggle = page.locator('#todoView [data-todo-id="' + adjacentId + '"] .todo-state-toggle-v144');
    await expect(neighboringToggle).toBeFocused();
    const after = await neighboringToggle.evaluate(node => node.getBoundingClientRect().top);
    expect(Math.abs(after - before), 'the next ToDo action remains near the old viewport position').toBeLessThan(32);

    // Searching reopens completed items; undoing completion should focus the
    // moved ToDo if it is the only visible match.
    const search = page.locator('#todoView .todo-search-input-v145');
    await search.fill('切替対象');
    await expect(row.locator('.todo-state-toggle-v144')).toBeVisible();
    await row.locator('.todo-state-toggle-v144').click();
    await expect(row.locator('.todo-check')).not.toBeChecked();
    await expect(row.locator('.todo-state-toggle-v144')).toBeFocused();
    await expect(row).toBeVisible();
  });
}

for (const width of [320, 390]) {
  test('Classic ToDo keeps unsaved input and existing DOM on unrelated redraw at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    await page.setViewportSize({ width, height: 812 });
    await boot(page, 'test-v525-todo-unrelated-render-' + width, {
      historical: [
        { id: 'v525-first', text: '未編集のToDo', memo: '保存済みメモ', completed: false,
          completedAt: 0, owner: '福冨', order: 0, revision: 1, createdAt: now, updatedAt: now },
        { id: 'v525-second', text: 'もう一つのToDo', memo: '', completed: false,
          completedAt: 0, owner: '福冨', order: 1024, revision: 1, createdAt: now - 5000, updatedAt: now }
      ]
    });
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    const todoPage = page.locator('#todoView .todo-page');
    const row = page.locator('#todoView [data-todo-id="v525-first"]');
    await row.locator('.todo-summary-button').click();
    await row.locator('.todo-detail input').fill('まだ保存していない件名');
    await row.locator('.todo-detail textarea').fill('まだ保存していないメモ');
    await page.locator('#todayTodoInput').fill('作成途中の別のToDo');
    await row.evaluate(node => { node.closest('.todo-page').dataset.testIdentityV525 = 'keep'; });
    const previousScroll = await page.evaluate(() => document.scrollingElement.scrollTop);

    // Clicking the already-active Classic layout calls the same canonical
    // render path as unrelated Firebase collection subscriptions.
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]')?.click());
    await expect(todoPage).toHaveAttribute('data-test-identity-v525', 'keep');
    await expect(row.locator('.todo-detail input')).toHaveValue('まだ保存していない件名');
    await expect(row.locator('.todo-detail textarea')).toHaveValue('まだ保存していないメモ');
    await expect(page.locator('#todayTodoInput')).toHaveValue('作成途中の別のToDo');
    const nextScroll = await page.evaluate(() => document.scrollingElement.scrollTop);
    expect(Math.abs(nextScroll - previousScroll)).toBeLessThan(2);

    // A real ToDo write still redraws and shows committed canonical data.
    await row.locator('.todo-detail-save').click();
    await expect(row.locator('.todo-text')).toHaveText('まだ保存していない件名');
    await expect(row.locator('.todo-detail textarea')).toHaveValue('まだ保存していないメモ');
    await expect(todoPage).not.toHaveAttribute('data-test-identity-v525', 'keep');
  });
}
