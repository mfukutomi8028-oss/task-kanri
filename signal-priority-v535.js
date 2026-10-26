/* Ver.535: Read-only D3 SIGNAL priority preview.
 * Uses existing Today cards and click handlers; never writes or moves business data.
 */
(function installSignalPriorityV535() {
  'use strict';
  const root = document.getElementById('todayView');
  if (!root || root.dataset.signalPriorityInstalledV535 === 'true') return;
  root.dataset.signalPriorityInstalledV535 = 'true';

  function canonicalOverduePanel() {
    return [...root.querySelectorAll('.today-grid > .today-panel')].find(panel =>
      panel.querySelector('h4')?.textContent?.trim() === '期限超過'
    ) || null;
  }

  function makeRow(card, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'signal-focus-row-v535';
    const num = document.createElement('span');
    num.className = 'signal-focus-index-v535';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(index + 1).padStart(2, '0');
    const body = document.createElement('span');
    body.className = 'signal-focus-copy-v535';
    const title = document.createElement('strong');
    title.textContent = card.querySelector('.task-title')?.textContent?.trim()
      || card.getAttribute('aria-label')?.replace(/の詳細を開く$/, '') || '期限超過タスク';
    const note = document.createElement('small');
    note.textContent = 'タスクの詳細を確認';
    body.append(title, note);
    const arrow = document.createElement('span');
    arrow.className = 'signal-focus-arrow-v535';
    arrow.textContent = '›';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(num, body, arrow);
    button.addEventListener('click', () => {
      if (card.isConnected) card.click();
    });
    return button;
  }

  function refresh() {
    const panel = canonicalOverduePanel();
    if (!panel || root.querySelector(':scope > .signal-focus-v535')) return;
    const cards = [...panel.querySelectorAll('.task-card[data-task-id]')];
    const section = document.createElement('section');
    section.className = 'signal-focus-v535';
    section.setAttribute('aria-label', '優先対応');
    section.dataset.empty = cards.length ? 'false' : 'true';
    const head = document.createElement('div');
    head.className = 'signal-focus-head-v535';
    const intro = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'signal-focus-eyebrow-v535';
    eyebrow.textContent = 'PRIORITY / TODAY';
    const heading = document.createElement('h3');
    heading.textContent = '先に確認したい対応';
    const count = document.createElement('span');
    count.className = 'signal-focus-count-v535';
    count.textContent = `${cards.length}件`;
    heading.append(count);
    intro.append(eyebrow, heading);
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'signal-focus-jump-v535';
    jump.textContent = '期限超過の一覧へ';
    jump.addEventListener('click', () => panel.scrollIntoView({ block: 'start', behavior: 'auto' }));
    head.append(intro, jump);
    const list = document.createElement('div');
    list.className = 'signal-focus-list-v535';
    if (cards.length) cards.slice(0, 2).forEach((card, index) => list.append(makeRow(card, index)));
    else {
      const empty = document.createElement('p');
      empty.className = 'signal-focus-empty-v535';
      empty.textContent = '期限超過のタスクはありません。';
      list.append(empty);
    }
    section.append(head, list);
    root.prepend(section);
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node =>
      node.nodeType === 1 && (node.classList?.contains('today-grid') || node.querySelector?.('.today-grid'))
    ))) refresh();
  });
  observer.observe(root, { childList: true });
  refresh();
})();
