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
