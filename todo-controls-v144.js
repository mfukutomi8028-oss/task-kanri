// Ver.265: keep ToDo completion affordances while adopting only newly rendered view subtrees.
(function installTodoControlsV144() {
  const VERSION = String(window.WORK_BOARD_RELEASE_VERSION || window.WORK_BOARD_VERSION || '144');

  function setButtonState(input, button) {
    const completed = Boolean(input.checked);
    button.classList.toggle('is-completed', completed);
    button.disabled = Boolean(input.disabled);
    button.setAttribute('aria-pressed', completed ? 'true' : 'false');
    button.setAttribute('aria-label', completed ? '未完了に戻す' : '完了にする');
    const label = completed ? '↶ 未完了に戻す' : '✓ 完了にする';
    if (button.textContent !== label) button.textContent = label;
  }

  function upgradeWorkspaceCheckbox(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.todoControlV144 === 'true') return;
    input.dataset.todoControlV144 = 'true';
    input.classList.add('todo-state-source-v144');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');

    const wrapper = document.createElement('div');
    wrapper.className = 'todo-state-control-v144';
    input.parentNode?.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'todo-state-toggle-v144';
    button.dataset.todoStateControlV144 = 'true';
    setButtonState(input, button);
    wrapper.appendChild(button);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (input.disabled || button.disabled) return;
      input.checked = !input.checked;
      setButtonState(input, button);
      button.disabled = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    input.addEventListener('change', () => setButtonState(input, button));
  }

  function upgradePreviewCheckbox(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.todoPreviewControlV144 === 'true') return;
    input.dataset.todoPreviewControlV144 = 'true';
    const label = input.closest('.todo-preview-checkline');
    if (!label) return;
    const hint = document.createElement('span');
    hint.className = 'todo-preview-state-hint-v144';
    hint.textContent = input.checked ? '↶ 未完了に戻す' : '✓ 完了にする';
    input.insertAdjacentElement('afterend', hint);
    input.addEventListener('change', () => {
      const text = input.checked ? '↶ 未完了に戻す' : '✓ 完了にする';
      if (hint.textContent !== text) hint.textContent = text;
    });
  }

  function adoptWorkspaceNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('.todo-check')) upgradeWorkspaceCheckbox(node);
    node.querySelectorAll?.('.todo-check').forEach(upgradeWorkspaceCheckbox);
  }

  function adoptPreviewNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('.todo-preview-check')) upgradePreviewCheckbox(node);
    node.querySelectorAll?.('.todo-preview-check').forEach(upgradePreviewCheckbox);
  }

  function observeRoot(root, adoptNode) {
    if (!root || root.dataset.todoObserverV144 === 'true') return;
    root.dataset.todoObserverV144 = 'true';
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        mutation.addedNodes.forEach(adoptNode);
      }
    }).observe(root, { childList: true });
  }

  function start() {
    const todoRoot = document.getElementById('todoView');
    const todayRoot = document.getElementById('todayView');
    todoRoot?.querySelectorAll('.todo-check').forEach(upgradeWorkspaceCheckbox);
    todayRoot?.querySelectorAll('.todo-preview-check').forEach(upgradePreviewCheckbox);
    observeRoot(todoRoot, adoptWorkspaceNode);
    observeRoot(todayRoot, adoptPreviewNode);
    document.documentElement.dataset.todoControlsVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
