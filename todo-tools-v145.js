// Ver.145: lightweight ToDo search and completed-section visibility control.
(function installTodoToolsV145() {
  const STORAGE_KEY = 'workBoardTodoCompletedCollapsed';
  let query = '';
  let scheduled = false;
  let completedCollapsed = false;

  try {
    completedCollapsed = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {}

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function todoHaystack(item) {
    const title = item.querySelector('.todo-text')?.textContent || '';
    const editedTitle = item.querySelector('.todo-detail input')?.value || '';
    const memo = item.querySelector('.todo-detail textarea')?.value || '';
    return normalize(`${title} ${editedTitle} ${memo}`);
  }

  function persistCompletedState() {
    try {
      localStorage.setItem(STORAGE_KEY, completedCollapsed ? '1' : '0');
    } catch (_) {}
  }

  function createTools(page) {
    let tools = page.querySelector('.todo-tools-v145');
    if (tools) return tools;

    tools = document.createElement('section');
    tools.className = 'todo-tools-v145';
    tools.setAttribute('aria-label', 'ToDo検索');
    tools.innerHTML = `
      <label class="todo-search-box-v145">
        <span class="todo-search-icon-v145" aria-hidden="true">⌕</span>
        <input class="todo-search-input-v145" type="search" autocomplete="off" placeholder="ToDo・メモを検索" aria-label="ToDoとメモを検索" />
        <button class="todo-search-clear-v145" type="button" aria-label="検索をクリア" hidden>×</button>
      </label>
      <span class="todo-search-result-v145" aria-live="polite"></span>
    `;

    const stats = page.querySelector('.todo-page-stats');
    if (stats) stats.insertAdjacentElement('afterend', tools);
    else page.prepend(tools);

    const input = tools.querySelector('.todo-search-input-v145');
    const clear = tools.querySelector('.todo-search-clear-v145');
    input.value = query;
    clear.hidden = !query;

    input.addEventListener('input', () => {
      query = input.value;
      clear.hidden = !query;
      applySearch(page);
    });

    clear.addEventListener('click', () => {
      query = '';
      input.value = '';
      clear.hidden = true;
      applySearch(page);
      input.focus();
    });

    return tools;
  }

  function ensureCompletedToggle(page) {
    const section = page.querySelector('.todo-list.is-completed');
    if (!section) return;
    const heading = section.querySelector('.todo-list-heading');
    if (!heading) return;

    let actions = heading.querySelector('.todo-list-heading-actions-v145');
    if (!actions) {
      actions = document.createElement('span');
      actions.className = 'todo-list-heading-actions-v145';
      const count = heading.querySelector('.todo-count');
      if (count) actions.appendChild(count);
      heading.appendChild(actions);
    }

    let button = actions.querySelector('.todo-completed-toggle-v145');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'todo-completed-toggle-v145';
      actions.appendChild(button);
      button.addEventListener('click', () => {
        completedCollapsed = !completedCollapsed;
        persistCompletedState();
        applySearch(page);
      });
    }
  }

  function applySearch(page) {
    if (!page?.isConnected) return;
    const tools = createTools(page);
    ensureCompletedToggle(page);

    const needle = normalize(query);
    const items = [...page.querySelectorAll('.todo-list .todo-item')];
    let visible = 0;

    for (const item of items) {
      const match = !needle || todoHaystack(item).includes(needle);
      item.hidden = !match;
      if (match) visible += 1;
    }

    page.querySelectorAll('.todo-list').forEach(section => {
      const sectionItems = [...section.querySelectorAll('.todo-item')];
      const sectionMatches = sectionItems.filter(item => !item.hidden).length;
      section.hidden = Boolean(needle) && sectionMatches === 0;
    });

    const completed = page.querySelector('.todo-list.is-completed');
    const completedToggle = completed?.querySelector('.todo-completed-toggle-v145');
    if (completed && completedToggle) {
      const collapsedNow = !needle && completedCollapsed;
      completed.classList.toggle('is-collapsed-v145', collapsedNow);
      completedToggle.textContent = collapsedNow ? '完了済みを表示' : '完了済みを隠す';
      completedToggle.setAttribute('aria-expanded', collapsedNow ? 'false' : 'true');
      completedToggle.title = needle ? '検索中は完了済みも検索対象として表示します' : '';
      completedToggle.disabled = Boolean(needle);
    }

    let empty = page.querySelector('.todo-search-empty-v145');
    if (needle && visible === 0) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'todo-search-empty-v145';
        const workspace = page.querySelector('.todo-workspace');
        workspace?.appendChild(empty);
      }
      empty.textContent = `「${query.trim()}」に一致するToDoはありません。`;
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }

    const result = tools.querySelector('.todo-search-result-v145');
    if (result) result.textContent = needle ? `${visible}件 / ${items.length}件` : `全${items.length}件`;
    const clear = tools.querySelector('.todo-search-clear-v145');
    if (clear) clear.hidden = !query;
  }

  function patch() {
    const root = document.getElementById('todoView');
    const page = root?.querySelector('.todo-page');
    if (!page) return;
    createTools(page);
    ensureCompletedToggle(page);
    applySearch(page);
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patch();
    });
  }

  function start() {
    const root = document.getElementById('todoView');
    if (!root) return;

    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length))) {
        schedulePatch();
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    root.addEventListener('input', event => {
      if (!query) return;
      if (event.target?.matches?.('.todo-detail input, .todo-detail textarea')) schedulePatch();
    });

    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== '/' || !document.body.classList.contains('todo-mode')) return;
      const active = document.activeElement;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      const input = root.querySelector('.todo-search-input-v145');
      if (!input) return;
      event.preventDefault();
      input.focus();
    });

    patch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
