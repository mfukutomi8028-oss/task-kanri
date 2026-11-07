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

test('Classic ToDo keeps another dirty row while saving a separate item', async ({ page }) => {
  const now = Date.now();
  const room = 'test-v527-classic-draft-preservation';
  await page.setViewportSize({ width: 390, height: 812 });
  await boot(page, room, {
    historical: [
      { id: 'v527-draft', text: '編集中のToDo', memo: '旧メモ', completed: false, completedAt: 0,
        order: 0, owner: '福冨', revision: 1, createdAt: now, updatedAt: now },
      { id: 'v527-other', text: '保存する別のToDo', memo: '', completed: false, completedAt: 0,
        order: 1024, owner: '福冨', revision: 1, createdAt: now, updatedAt: now }
    ]
  });
  await page.locator('#todayView [data-layout-jump="todos"]').first().click();
  const draft = page.locator('#todoView [data-todo-id="v527-draft"]');
  const other = page.locator('#todoView [data-todo-id="v527-other"]');
  await draft.locator('.todo-summary-button').click();
  await draft.locator('.todo-detail input').fill('まだ保存しない変更');
  await draft.locator('.todo-detail textarea').fill('下書きを維持');
  await other.locator('.todo-summary-button').click();
  await other.locator('.todo-detail input').fill('別件を先に保存');
  await other.locator('.todo-detail-save').click();
  await expect(other.locator('.todo-text')).toHaveText('別件を先に保存');
  await expect(draft.locator('.todo-detail input')).toHaveValue('まだ保存しない変更');
  await expect(draft.locator('.todo-detail textarea')).toHaveValue('下書きを維持');
  await expect(draft.locator('.todo-edit-conflict-v527')).toHaveCount(0);
  await draft.locator('.todo-detail-save').click();
  await expect(draft.locator('.todo-text')).toHaveText('まだ保存しない変更');
});


for (const width of [320, 390]) {
  test('Classic ToDo keeps unsaved drafts across menus without persisting them at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const room = 'test-v532-todo-navigation-' + width;
    const historical = Array.from({ length: 24 }, (_, index) => ({
      id: 'v532-nav-' + index,
      text: '一覧ToDo ' + index,
      memo: '既存メモ ' + index,
      completed: false, completedAt: 0, order: index * 1024,
      owner: '福冨', revision: 1,
      createdAt: now - index * 1000, updatedAt: now - index * 1000
    }));
    await page.setViewportSize({ width, height: 812 });
    await boot(page, room, { historical });
    await page.locator('#todayView [data-layout-jump="todos"]').first().click();
    const row = page.locator('#todoView [data-todo-id="v532-nav-12"]');
    await row.locator('.todo-summary-button').click();
    await row.locator('.todo-detail input').fill('未保存の件名532');
    await row.locator('.todo-detail textarea').fill('未保存の重要メモ532');
    await page.locator('#todayTodoInput').fill('まだ作成していないToDo532');
    await page.locator('.todo-compose-details').evaluate(node => { node.open = true; });
    await page.locator('#todayTodoMemo').fill('作成途中のメモ532');
    await page.evaluate(() => {
      document.scrollingElement.scrollTop = 320;
      document.getElementById('mainContent').scrollTop = 180;
      document.querySelector('.nav-item[data-layout="tasks"]').click();
    });
    await expect(page.locator('#todoView .todo-page')).toHaveCount(0);
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(row.locator('.todo-detail input')).toHaveValue('未保存の件名532');
    await expect(row.locator('.todo-detail textarea')).toHaveValue('未保存の重要メモ532');
    await expect(row.locator('.todo-detail')).toBeVisible();
    await expect(page.locator('#todayTodoInput')).toHaveValue('まだ作成していないToDo532');
    await expect(page.locator('#todayTodoMemo')).toHaveValue('作成途中のメモ532');
    await expect(page.locator('.todo-compose-details')).toHaveAttribute('open', '');
    const persisted = await page.evaluate(() =>
      Object.keys(localStorage).some(key =>
        /未保存の件名532|まだ作成していないToDo532/.test(localStorage.getItem(key) || '')));
    expect(persisted, 'navigation drafts must remain in page memory only').toBe(false);

    // Changing accounts may not show another user's unsaved editor.
    await page.locator('#currentUserSelect').selectOption('森井');
    await expect(page.locator('#todoView [data-todo-id="v532-nav-12"]')).toHaveCount(0);
    await expect(page.locator('#todayTodoInput')).toHaveValue('');
    await page.locator('#currentUserSelect').selectOption('福冨');
    await expect(row.locator('.todo-detail input')).toHaveValue('未保存の件名532');
    await expect(page.locator('#todayTodoInput')).toHaveValue('まだ作成していないToDo532');

    // This is not persistent autosave: a full reload returns to canonical data.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(row.locator('.todo-detail input')).toHaveValue('一覧ToDo 12');
    await expect(page.locator('#todayTodoInput')).toHaveValue('');
  });
}


for (const width of [320, 390]) {
  test('Classic ToDo restores actual editor caret after a focused navigation button at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const room = 'test-v534-focus-return-' + width;
    await page.setViewportSize({ width, height: 812 });
    await boot(page, room, {
      historical: [{
        id: 'v534-editor-' + width, text: '元の件名', memo: '元のメモ',
        completed: false, completedAt: 0, order: 0, owner: '福冨',
        revision: 1, createdAt: now, updatedAt: now
      }]
    });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    const row = page.locator('#todoView [data-todo-id="v534-editor-' + width + '"]');
    await row.locator('.todo-summary-button').click();
    const editor = row.locator('.todo-detail textarea');
    await editor.fill('未保存メモの選択文字列');
    await editor.evaluate(node => {
      node.focus();
      node.setSelectionRange(3, 8);
    });
    // Focus changes to a sidebar control before renderCore captures the draft.
    // This is the failure path in the old implementation.
    await page.evaluate(() => {
      const nav = document.querySelector('.nav-item[data-layout="tasks"]');
      nav.focus({ preventScroll: true });
      nav.click();
    });
    await expect(page.locator('#todoView .todo-page')).toHaveCount(0);
    await page.evaluate(() => {
      const nav = document.querySelector('.nav-item[data-layout="todos"]');
      nav.focus({ preventScroll: true });
      nav.click();
    });
    await expect(editor).toHaveValue('未保存メモの選択文字列');
    await expect(editor).toBeFocused();
    expect(await editor.evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([3, 8]);

    const compose = page.locator('#todayTodoInput');
    await compose.fill('新規作成中の文章');
    await compose.evaluate(node => {
      node.focus();
      node.setSelectionRange(2, 6);
    });
    await page.evaluate(() => {
      const nav = document.querySelector('.nav-item[data-layout="today"]');
      nav.focus({ preventScroll: true });
      nav.click();
    });
    await page.evaluate(() => {
      const nav = document.querySelector('.nav-item[data-layout="todos"]');
      nav.focus({ preventScroll: true });
      nav.click();
    });
    await expect(compose).toHaveValue('新規作成中の文章');
    await expect(compose).toBeFocused();
    expect(await compose.evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([2, 6]);
  });
}


for (const width of [320, 390]) {
  test('Classic ToDo search, selected query cursor and filtered list anchor survive menu navigation at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const room = 'test-v536-search-return-' + width;
    const historical = Array.from({ length: 30 }, (_, index) => ({
      id: 'v536-filter-' + index, text: '検索対象・一覧行 ' + index,
      memo: '連絡の補足 ' + index, owner: '福冨', completed: false, completedAt: 0,
      order: index * 1024, revision: 1,
      createdAt: now - index * 1000, updatedAt: now - index * 1000
    }));
    historical.push({
      id: 'v536-unmatched', text: '対象外の確認', memo: '',
      owner: '福冨', completed: false, completedAt: 0,
      order: 40000, revision: 1, createdAt: now, updatedAt: now
    });
    await page.setViewportSize({ width, height: 812 });
    await boot(page, room, { historical });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    const search = page.locator('#todoView .todo-search-input-v145');
    await search.fill('検索対象');
    await expect(search).toHaveValue('検索対象');
    await expect(page.locator('#todoView [data-todo-id="v536-unmatched"]')).toBeHidden();
    const row = page.locator('#todoView [data-todo-id="v536-filter-17"]');
    await row.locator('.todo-summary-button').scrollIntoViewIfNeeded();
    const before = await row.evaluate(node => node.getBoundingClientRect().top);
    await search.evaluate(input => { input.focus({ preventScroll: true }); input.setSelectionRange(1, 3); });

    await page.evaluate(() => {
      const nav = document.querySelector('.nav-item[data-layout="tasks"]');
      nav.focus({ preventScroll: true });
      nav.click();
    });
    await expect(page.locator('#todoView .todo-page')).toHaveCount(0);
    // The shared JOURNAL search bridge can change while Classic is hidden;
    // returning to Classic must restore its own last search.
    await page.evaluate(() => window.WorkBoardTodoSearchBridgeV393.setQuery('別の検索'));
    await page.evaluate(() => {
      const nav = document.querySelector('.nav-item[data-layout="todos"]');
      nav.focus({ preventScroll: true });
      nav.click();
    });
    await expect(search).toHaveValue('検索対象');
    await expect(search).toBeFocused();
    expect(await search.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([1, 3]);
    await expect(row).toBeVisible();
    await expect(page.locator('#todoView [data-todo-id="v536-unmatched"]')).toBeHidden();
    const after = await row.evaluate(node => node.getBoundingClientRect().top);
    expect(Math.abs(after - before), 'the same filtered ToDo stays near its previous viewport position').toBeLessThan(40);

    // Zero-result recovery remains available after leaving and returning.
    await search.fill('該当しない検索語536');
    await expect(page.locator('#todoView .todo-search-reset-v145')).toBeVisible();
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]').click());
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(search).toHaveValue('該当しない検索語536');
    await expect(page.locator('#todoView .todo-search-reset-v145')).toBeVisible();
    await page.locator('#todoView .todo-search-reset-v145').click();
    await expect(search).toHaveValue('');
    await expect(row).toBeVisible();
  });
}


for (const width of [320, 390]) {
  test('Classic ToDo search is scoped to each account and restored after switching at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    const now = Date.now();
    await boot(page, 'test-v539-todo-account-search-' + width, {
      historical: [
        { id: 'v539-f', owner: '福冨', text: '福冨だけの確認', memo: '', completed: false,
          completedAt: 0, order: 1024, revision: 1, createdAt: now, updatedAt: now },
        { id: 'v539-m', owner: '森井', text: '森井だけの確認', memo: '', completed: false,
          completedAt: 0, order: 2048, revision: 1, createdAt: now, updatedAt: now }
      ]
    });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    const search = page.locator('#todoView .todo-search-input-v145');
    await search.fill('福冨だけ');
    await expect(page.locator('#todoView [data-todo-id="v539-f"]')).toBeVisible();

    await page.locator('#currentUserSelect').selectOption('森井');
    await expect(search).toHaveValue('');
    await expect(page.locator('#todoView [data-todo-id="v539-m"]')).toBeVisible();
    await search.fill('森井だけ');
    await expect(page.locator('#todoView [data-todo-id="v539-m"]')).toBeVisible();

    await page.locator('#currentUserSelect').selectOption('福冨');
    await expect(search).toHaveValue('福冨だけ');
    await expect(page.locator('#todoView [data-todo-id="v539-f"]')).toBeVisible();
    await page.locator('#currentUserSelect').selectOption('森井');
    await expect(search).toHaveValue('森井だけ');

    // Switching accounts from another menu must also keep filters separated.
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]').click());
    await page.locator('#currentUserSelect').selectOption('福冨');
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(search).toHaveValue('福冨だけ');

    // Search terms are ephemeral, not written to persistent browser storage.
    const persisted = await page.evaluate(() => Object.entries(localStorage)
      // The fixture seeds canonical ToDo data under a room name that itself
      // contains 'search'. Data records are not saved filter preferences.
      .some(([key, value]) => !key.startsWith('system-task-todos:')
        && (value.includes('福冨だけ') || value.includes('森井だけ'))));
    expect(persisted).toBe(false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(search).toHaveValue('');
  });
}


for (const width of [320, 390]) {
  test('Classic keeps search selection and list position per account at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const historical = ['福冨', '森井'].flatMap((owner, accountIndex) =>
      Array.from({ length: 30 }, (_, index) => ({
        id: 'v540-account-' + accountIndex + '-' + index,
        text: (accountIndex ? 'アカウントB' : 'アカウントA') + ' のToDo ' + index,
        memo: '編集内容 ' + index, owner, completed: false, completedAt: 0,
        order: index * 1024, revision: 1, createdAt: now - index * 1000, updatedAt: now - index * 1000
      }))
    );
    await page.setViewportSize({ width, height: 812 });
    await boot(page, 'test-v540-account-viewport-' + width, { historical });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());

    const search = page.locator('#todoView .todo-search-input-v145');
    await search.fill('アカウントA');
    const aRow = page.locator('#todoView [data-todo-id="v540-account-0-16"]');
    await aRow.locator('.todo-summary-button').scrollIntoViewIfNeeded();
    const aTop = await aRow.evaluate(node => node.getBoundingClientRect().top);
    await search.evaluate(node => {
      node.focus({ preventScroll: true });
      node.setSelectionRange(1, 4);
    });

    await page.locator('#currentUserSelect').selectOption('森井');
    await expect(search).toHaveValue('');
    // No prior state for this account: a newly selected user starts at the top,
    // not at the previous user's scroll position or search focus.
    await page.waitForFunction(() =>
      (document.getElementById('mainContent')?.scrollTop || 0) === 0
      && (document.scrollingElement?.scrollTop || 0) === 0);
    await expect(search).not.toBeFocused();
    await expect(page.locator('#todoView [data-todo-id="v540-account-1-16"]')).toBeVisible();

    await search.fill('アカウントB');
    const bRow = page.locator('#todoView [data-todo-id="v540-account-1-19"]');
    await bRow.locator('.todo-summary-button').scrollIntoViewIfNeeded();
    const bTop = await bRow.evaluate(node => node.getBoundingClientRect().top);
    await search.evaluate(node => {
      node.focus({ preventScroll: true });
      node.setSelectionRange(2, 6);
    });

    await page.locator('#currentUserSelect').selectOption('福冨');
    await expect(search).toHaveValue('アカウントA');
    await expect(search).toBeFocused();
    expect(await search.evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([1, 4]);
    await expect(aRow).toBeVisible();
    const aReturnTop = await aRow.evaluate(node => node.getBoundingClientRect().top);
    expect(Math.abs(aReturnTop - aTop), 'first account scroll anchor').toBeLessThan(42);

    await page.locator('#currentUserSelect').selectOption('森井');
    await expect(search).toHaveValue('アカウントB');
    await expect(search).toBeFocused();
    expect(await search.evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([2, 6]);
    await expect(bRow).toBeVisible();
    const bReturnTop = await bRow.evaluate(node => node.getBoundingClientRect().top);
    expect(Math.abs(bReturnTop - bTop), 'second account scroll anchor').toBeLessThan(42);
  });
}


for (const width of [320, 390]) {
  test('Classic returns near a removed ToDo and keeps zero-result reset accessible at ' + width + 'px', async ({ page }) => {
    const now = Date.now();
    const room = 'test-v542-deleted-todo-return-' + width;
    const historical = Array.from({ length: 30 }, (_, index) => ({
      id: 'v542-todo-' + index, text: '復帰対象のToDo ' + index, memo: '',
      owner: '福冨', completed: false, completedAt: 0, order: index * 1024,
      revision: 1, createdAt: now - index * 1000, updatedAt: now - index * 1000
    }));
    await page.setViewportSize({ width, height: 812 });
    await boot(page, room, { historical });
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    const search = page.locator('#todoView .todo-search-input-v145');
    await search.fill('復帰対象');
    await page.locator('#todoView [data-todo-id="v542-todo-17"] .todo-summary-button')
      .scrollIntoViewIfNeeded();
    const anchor = await page.locator('#todoView').evaluate(root => {
      const visible = [...root.querySelectorAll('.todo-list .todo-item[data-todo-id]')]
        .filter(node => !node.hidden && !node.closest('.todo-list')?.hidden && node.getClientRects().length);
      const index = visible.findIndex(node => {
        const box = node.getBoundingClientRect();
        return box.bottom > 0 && box.top < innerHeight;
      });
      return { id: visible[index]?.dataset.todoId, nextId: visible[index + 1]?.dataset.todoId,
        top: visible[index]?.getBoundingClientRect().top };
    });
    expect(anchor.id).toBeTruthy();
    expect(anchor.nextId).toBeTruthy();

    await page.evaluate(() => document.querySelector('.nav-item[data-layout="tasks"]').click());
    page.once('dialog', dialog => dialog.accept());
    const removed = await page.evaluate(id => window.WorkBoardPaletteBridge.dispatch({
      type: 'todo.delete', id
    }), anchor.id);
    expect(removed?.ok).toBe(true);
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(page.locator('#todoView [data-todo-id="' + anchor.id + '"]')).toHaveCount(0);
    const next = page.locator('#todoView [data-todo-id="' + anchor.nextId + '"]');
    await expect(next).toBeVisible();
    await expect.poll(async () => Math.abs(
      await next.evaluate(node => node.getBoundingClientRect().top) - anchor.top
    ) < 80, { timeout: 5000 }).toBe(true);

    // A zero-result query must not be cleared by navigation or a stale anchor.
    await search.fill('該当しない検索語542');
    const reset = page.locator('#todoView .todo-search-reset-v145');
    await expect(reset).toBeVisible();
    const adjacent = await reset.evaluate(node => {
      const empty = node.closest('.todo-search-empty-v145');
      return empty?.previousElementSibling?.matches('.todo-tools-v145') === true;
    });
    expect(adjacent).toBe(true);
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="today"]').click());
    await page.evaluate(() => document.querySelector('.nav-item[data-layout="todos"]').click());
    await expect(search).toHaveValue('該当しない検索語542');
    await expect(reset).toBeVisible();
    const rect = await reset.evaluate(node => ({
      top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom
    }));
    expect(rect.top).toBeGreaterThanOrEqual(-8);
    expect(rect.bottom).toBeLessThanOrEqual(820);
    await reset.click();
    await expect(search).toHaveValue('');
    await expect(next).toBeVisible();
  });
}
