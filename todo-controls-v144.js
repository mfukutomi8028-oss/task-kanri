// Ver.144: make ToDo completion state obvious without changing the underlying sync logic.
(function installTodoControlsV144() {
  const VERSION = String(window.WORK_BOARD_RELEASE_VERSION || window.WORK_BOARD_VERSION || '144');
  let scheduled = false;

  function setButtonState(input, button) {
    const completed = Boolean(input.checked);
    button.classList.toggle('is-completed', completed);
    button.disabled = Boolean(input.disabled);
    button.setAttribute('aria-pressed', completed ? 'true' : 'false');
    button.setAttribute('aria-label', completed ? '未完了に戻す' : '完了にする');
    button.textContent = completed ? '↶ 未完了に戻す' : '✓ 完了にする';
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
      hint.textContent = input.checked ? '↶ 未完了に戻す' : '✓ 完了にする';
    });
  }

  function patchTodoUi() {
    document.querySelectorAll('#todoView .todo-check').forEach(upgradeWorkspaceCheckbox);
    document.querySelectorAll('#todayView .todo-preview-check').forEach(upgradePreviewCheckbox);
  }

  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchTodoUi();
    });
  }

  function observeRoot(root) {
    if (!root || root.dataset.todoObserverV144 === 'true') return;
    root.dataset.todoObserverV144 = 'true';
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length))) {
        schedulePatch();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function start() {
    observeRoot(document.getElementById('todoView'));
    observeRoot(document.getElementById('todayView'));
    patchTodoUi();
    document.documentElement.dataset.todoControlsVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
