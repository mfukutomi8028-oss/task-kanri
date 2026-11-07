import { test, expect } from '@playwright/test';

const ROOM = 'test-mobile-regression-v187';

async function installProductionSafetyBoundary(page) {
  await page.addInitScript(({ room }) => {
    try {
      localStorage.clear();
      localStorage.setItem('systemTaskUser', '福冨');
      localStorage.setItem('systemTaskRoomId', room);
    } catch {}

    Object.defineProperty(window, 'firebaseConfig', {
      configurable: true,
      get() { return null; },
      set() {}
    });
  }, { room: ROOM });

  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort('blockedbyclient'));
  await page.route(/https:\/\/[^/]*(?:firebaseio\.com|firebasedatabase\.app)\//i,
    route => route.abort('blockedbyclient'));
}

async function boot(page, width, height) {
  await page.setViewportSize({ width, height });
  await installProductionSafetyBoundary(page);
  await page.goto(`/?room=${ROOM}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const version = String(window.WORK_BOARD_RELEASE?.version || '');
    return Boolean(version) && document.documentElement.dataset.firstPaintVersion === version;
  }, undefined, { timeout: 8_000 });
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
    .mobile-v187-stage { box-sizing:border-box; width:min(100%,720px); margin:16px auto; padding:14px; border:1px solid #d8e5ed; border-radius:18px; background:#f8fbfd; }
    .mobile-v187-stage table { width:100%; border-collapse:collapse; }
    .mobile-v187-stage td { padding:10px; border-bottom:1px solid #dfe8ee; }
    .mobile-v187-stage .detail-actions-v2 { margin-top:12px; }
    .mobile-v187-stage .main-actions, .mobile-v187-stage .sub-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .mobile-v187-stage button { border:1px solid #cadde7; border-radius:10px; background:#fff; padding:6px 10px; }
  ` });
}

async function installMentionFixture(page) {
  await page.evaluate(() => {
    document.querySelector('.workflow-mention-shell-v156')?.remove();
    const shell = document.createElement('div');
    shell.className = 'workflow-mention-shell-v156';
    shell.innerHTML = `
      <div class="workflow-mention-backdrop-v156"></div>
      <section class="workflow-mention-dialog-v156">
        <header><div><small>MENTION</small><h3>メンションするユーザー</h3><p>複数選択できます。</p></div><button type="button">×</button></header>
        <div class="workflow-mention-search-v156"><label>ユーザーを検索</label><input value="" /></div>
        <div class="workflow-mention-summary-v156"><span>3人</span><strong>1人選択</strong></div>
        <div class="workflow-mention-users-v156">
          <button class="workflow-mention-user-v156 is-selected"><span class="workflow-mention-check-v156">✓</span><span class="workflow-mention-name-v156">@森井</span></button>
          <button class="workflow-mention-user-v156"><span class="workflow-mention-check-v156"></span><span class="workflow-mention-name-v156">@土屋</span></button>
          <button class="workflow-mention-user-v156"><span class="workflow-mention-check-v156"></span><span class="workflow-mention-name-v156">@上田</span></button>
        </div>
        <footer><button type="button">キャンセル</button><button type="button">選択したユーザーを追加</button></footer>
      </section>`;
    document.body.appendChild(shell);
  });
}

async function installTaskFixture(page) {
  await page.evaluate(() => {
    document.querySelector('.mobile-v187-stage')?.remove();
    const stage = document.createElement('section');
    stage.className = 'mobile-v187-stage';
    stage.innerHTML = `
      <table class="task-table"><tbody><tr><td>業務</td><td>確認</td><td>福冨<span class="workflow-time-inline-v148">2日前</span></td></tr></tbody></table>
      <div class="detail-actions-v2">
        <div class="main-actions"><button type="button">完了</button><button type="button">更新</button></div>
        <div class="sub-actions"><button type="button">関連</button></div>
      </div>
      <button type="button" class="task-detail-tab-v149">コメント</button>
      <div id="toast" class="toast" style="position:fixed;right:12px;bottom:12px">保存しました</div>`;
    document.body.appendChild(stage);
  });
}

for (const view of [
  { label: 'mobile-boundary-860', width: 860, height: 900, expectedTimeMargin: '10px' },
  { label: 'mobile-430', width: 430, height: 900, expectedTimeMargin: '10px' },
  { label: 'mobile-390', width: 390, height: 844, expectedTimeMargin: '8px' }
]) {
  test(`Ver.186 mobile workflow and task regression baseline: ${view.label}`, async ({ page }) => {
    test.slow();
    await boot(page, view.width, view.height);

    await installMentionFixture(page);
    const mentionShell = page.locator('.workflow-mention-shell-v156');
    await expect(mentionShell).toBeVisible();
    const mentionMetrics = await page.evaluate(() => ({
      shellZ: getComputedStyle(document.querySelector('.workflow-mention-shell-v156')).zIndex,
      usersOverscroll: getComputedStyle(document.querySelector('.workflow-mention-users-v156')).overscrollBehavior,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    expect(mentionMetrics.shellZ).toBe('1440');
    expect(mentionMetrics.usersOverscroll).toBe('contain');
    expect(mentionMetrics.scrollWidth).toBeLessThanOrEqual(mentionMetrics.innerWidth + 2);
    await expect(page.locator('.workflow-mention-dialog-v156')).toHaveScreenshot(`mobile-v187-${view.label}-mention.png`, { animations: 'disabled' });
    await mentionShell.evaluate(node => node.remove());

    await installTaskFixture(page);
    const taskMetrics = await page.evaluate(() => {
      const time = document.querySelector('.workflow-time-inline-v148');
      const mainButton = document.querySelector('.detail-actions-v2 .main-actions > button');
      const tab = document.querySelector('.task-detail-tab-v149');
      const toast = document.querySelector('#toast.toast');
      return {
        timeMarginLeft: getComputedStyle(time).marginLeft,
        timeMarginTop: getComputedStyle(time).marginTop,
        mainButtonMinHeight: getComputedStyle(mainButton).minHeight,
        tabMinHeight: getComputedStyle(tab).minHeight,
        toastZ: getComputedStyle(toast).zIndex,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      };
    });
    expect(taskMetrics.timeMarginLeft).toBe(view.expectedTimeMargin);
    expect(taskMetrics.timeMarginTop).toBe('3px');
    expect(taskMetrics.mainButtonMinHeight).toBe('44px');
    expect(taskMetrics.tabMinHeight).toBe('44px');
    expect(taskMetrics.toastZ).toBe('1500');
    expect(taskMetrics.scrollWidth).toBeLessThanOrEqual(taskMetrics.innerWidth + 2);
    await expect(page.locator('.mobile-v187-stage')).toHaveScreenshot(`mobile-v187-${view.label}-task.png`, { animations: 'disabled' });
  });
}


for (const width of [320, 390]) {
  test('Classic schedule dialog keeps every action readable at ' + width + 'px', async ({ page }) => {
    await boot(page, width, 812);
    await page.evaluate(() => {
      const dialog = document.querySelector('#scheduleDialog');
      // Display the complete edit-action set; new schedules hide some of
      // these controls. The test must also cover the most crowded edit state.
      for (const button of dialog.querySelectorAll('.dialog-actions > button')) {
        button.hidden = false;
        button.style.removeProperty('display');
      }
      dialog.showModal();
    });
    await expect(page.locator('#scheduleDialog')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector('#scheduleDialog');
      const actions = dialog.querySelector('.dialog-actions');
      const buttons = [...actions.querySelectorAll(':scope > button')];
      const box = el => {
        const r = el.getBoundingClientRect();
        return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right };
      };
      return {
        columnCount: getComputedStyle(actions).gridTemplateColumns.split(' ').length,
        actionBox: box(actions),
        dialogOverflow: dialog.scrollWidth - dialog.clientWidth,
        actionOverflow: actions.scrollWidth - actions.clientWidth,
        buttons: buttons.map(button => ({
          id:button.id || 'submit', text:button.textContent.trim(), box:box(button),
          minHeight:getComputedStyle(button).minHeight
        }))
      };
    });
    expect(geometry.columnCount, 'two equally usable secondary columns').toBe(2);
    expect(geometry.buttons).toHaveLength(5);
    expect(geometry.dialogOverflow, 'dialog must not scroll sideways').toBeLessThanOrEqual(1);
    expect(geometry.actionOverflow, 'actions must fit the form').toBeLessThanOrEqual(1);
    const [related, create, copy, remove, save] = geometry.buttons.map(button => button.box);
    expect(Math.abs(related.y - create.y), 'first two operations share a row').toBeLessThan(2);
    expect(Math.abs(copy.y - remove.y), 'second two operations share a row').toBeLessThan(2);
    expect(save.y, 'Save follows all supporting actions').toBeGreaterThanOrEqual(Math.max(copy.bottom, remove.bottom) - 1);
    expect(save.width, 'Save uses both columns').toBeGreaterThan(related.width * 1.8);
    for (const { id, box: button } of geometry.buttons) {
      expect(button.height, id + ' touch target').toBeGreaterThanOrEqual(44);
      expect(button.x, id + ' left edge').toBeGreaterThanOrEqual(geometry.actionBox.x - 1);
      expect(button.right, id + ' right edge').toBeLessThanOrEqual(geometry.actionBox.right + 1);
    }
    await page.locator('#scheduleDialog .dialog-actions > button[type="submit"]').focus();
    await expect(page.locator('#scheduleDialog .dialog-actions > button[type="submit"]')).toBeFocused();
    await page.evaluate(() => document.querySelector('#scheduleDialog').close());
  });
}


for (const width of [320, 390]) {
  test('Classic ToDo and task detail touch targets stay legible at ' + width + 'px', async ({ page }) => {
    test.slow();
    await boot(page, width, 812);
    const metrics = await page.evaluate(() => {
      document.body.classList.add('todo-mode');
      const stage = document.createElement('section');
      stage.id = 'classic-touch-audit';
      stage.className = 'todo-workspace';
      stage.style.cssText = 'box-sizing:border-box;width:calc(100% - 24px);margin:12px;max-width:none';
      stage.innerHTML = [
        '<div class="todo-item is-expanded"><div class="todo-content">',
        '<button type="button" class="todo-summary-button">詳細・メモ</button>',
        '<div class="todo-detail"><div class="todo-detail-grid">',
        '<label><span>やること</span><input type="text" value="通常のToDo" /></label>',
        '<label><span>メモ</span><textarea>確認内容を記録します</textarea></label>',
        '</div><div class="todo-detail-footer"><span>タスク化でメモを引き継ぎます</span>',
        '<button type="button" class="todo-detail-save">内容を保存</button></div></div></div>',
        '<div class="todo-state-control-v144"><button type="button" class="todo-state-toggle-v144">完了にする</button></div>',
        '<div class="todo-actions"><div class="todo-move-actions">',
        '<button type="button" class="todo-move-button">▲</button><button type="button" class="todo-move-button">▼</button>',
        '</div><button type="button" class="todo-action todo-promote-button">タスクにする</button>',
        '<button type="button" class="todo-action todo-delete-button">削除</button></div></div>'
      ].join('');
      document.body.append(stage);

      const rect = element => {
        const b = element.getBoundingClientRect();
        return { x:b.x, right:b.right, width:b.width, height:b.height };
      };
      const sample = selector => {
        const element = stage.querySelector(selector);
        const style = getComputedStyle(element);
        return { ...rect(element), fontSize:parseFloat(style.fontSize), minHeight:style.minHeight };
      };
      const todo = {
        stage:rect(stage),
        input:sample('.todo-detail input'),
        memo:sample('.todo-detail textarea'),
        save:sample('.todo-detail-save'),
        expand:sample('.todo-summary-button'),
        state:sample('.todo-state-toggle-v144'),
        move:sample('.todo-move-button'),
        promote:sample('.todo-promote-button'),
        remove:sample('.todo-delete-button'),
        overflow:stage.scrollWidth - stage.clientWidth
      };

      // The canonical editor is a dialog, not a second synthetic task form.
      // Only append representative view tabs/actions; never invoke writers.
      const dialog = document.getElementById('taskDialog');
      const wasTabbed = dialog.classList.contains('task-dialog-tabs-enabled-v319');
      const wasOpen = dialog.open;
      dialog.classList.add('task-dialog-tabs-enabled-v319');
      const fixture = document.createElement('section');
      fixture.className = 'classic-task-touch-audit';
      fixture.innerHTML = [
        '<div class="task-dialog-view-tabs-v319">',
        '<button type="button" class="task-dialog-view-tab-v319">詳細を確認</button>',
        '<button type="button" class="task-dialog-view-tab-v319">編集する</button></div>',
        '<div class="task-dialog-detail-panel-v319"><div class="detail-actions-v2">',
        '<div class="main-actions"><button type="button">更新内容を確認</button>',
        '<button type="button">作業を完了する</button></div>',
        '<div class="sub-actions"><button type="button">関連する予定を開く</button></div>',
        '</div></div>'
      ].join('');
      dialog.append(fixture);
      if (!dialog.open) dialog.showModal();
      const tabs = [...fixture.querySelectorAll('.task-dialog-view-tab-v319')];
      const actions = [...fixture.querySelectorAll('.detail-actions-v2 button')];
      const task = {
        tabs:tabs.map(rect), actions:actions.map(rect),
        tabOverflow:fixture.querySelector('.task-dialog-view-tabs-v319').scrollWidth
          - fixture.querySelector('.task-dialog-view-tabs-v319').clientWidth,
        buttonOverflow:[...tabs,...actions].map(el => el.scrollWidth - el.clientWidth)
      };
      if (!wasOpen) dialog.close();
      fixture.remove();
      if (!wasTabbed) dialog.classList.remove('task-dialog-tabs-enabled-v319');
      stage.remove();
      return {todo,task};
    });
    const {todo,task} = metrics;
    expect(todo.overflow, 'ToDo editor should not scroll horizontally').toBeLessThanOrEqual(1);
    for (const name of ['input','save','expand','state','move','promote','remove']) {
      const item = todo[name];
      expect(item.height, name + ' minimum touch height').toBeGreaterThanOrEqual(44);
      expect(item.x, name + ' stays inside ToDo panel left').toBeGreaterThanOrEqual(todo.stage.x - 1);
      expect(item.right, name + ' stays inside ToDo panel right').toBeLessThanOrEqual(todo.stage.right + 1);
    }
    expect(todo.input.fontSize, 'iOS input font should avoid focus zoom').toBeGreaterThanOrEqual(16);
    expect(todo.memo.fontSize, 'iOS textarea font should avoid focus zoom').toBeGreaterThanOrEqual(16);
    expect(task.tabs).toHaveLength(2);
    expect(task.actions).toHaveLength(3);
    expect(task.tabOverflow, 'task view tabs should not spill horizontally').toBeLessThanOrEqual(1);
    for (const item of [...task.tabs, ...task.actions]) {
      expect(item.height, 'task detail dialog touch target').toBeGreaterThanOrEqual(44);
    }
    for (const overflow of task.buttonOverflow) {
      expect(overflow, 'task dialog action text should wrap without clipping').toBeLessThanOrEqual(1);
    }
  });
}
