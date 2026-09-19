// Ver.239 preparation: quick task-status control only. Dialog lifecycle moved to dialog-lifecycle-v239.js.
(function installTaskUxV146() {
  const STATUS_SELECTOR_CLASS = 'detail-status-select-v146';
  let statusPatchScheduled = false;

  function normalize(value) {
    return String(value || '').normalize('NFKC').trim();
  }

  function availableStatuses() {
    const source = document.getElementById('taskStatus') || document.getElementById('statusFilter');
    if (!source) return [];
    return [...source.options]
      .map(option => normalize(option.value || option.textContent))
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index);
  }

  function currentDetailStatus(detail, statuses) {
    const badges = [...detail.querySelectorAll(':scope > .task-meta .badge')];
    for (const badge of badges) {
      const text = normalize(badge.textContent);
      if (statuses.includes(text)) return text;
    }
    return '';
  }

  function detailTaskId(detail) {
    const key = detail.querySelector('[data-action="delete"]')?.dataset?.operationKey || '';
    return key.startsWith('task-delete:') ? key.slice('task-delete:'.length) : '';
  }

  function cleanupSilentStatusSave() {
    document.body.classList.remove('v146-quick-status-saving');
  }

  function submitStatusViaExistingEditor(detail, select, targetStatus) {
    const editButton = detail.querySelector('[data-action="edit"]');
    const dialog = document.getElementById('taskDialog');
    const taskForm = document.getElementById('taskForm');
    const taskStatus = document.getElementById('taskStatus');
    const expectedId = detailTaskId(detail);
    if (!editButton || !dialog || !taskForm || !taskStatus || !expectedId) {
      select.disabled = false;
      return;
    }

    document.body.classList.add('v146-quick-status-saving');
    select.disabled = true;
    select.setAttribute('aria-busy', 'true');
    editButton.click();

    const revealTimer = window.setTimeout(() => {
      if (dialog.open) cleanupSilentStatusSave();
    }, 2500);

    const finish = () => {
      window.clearTimeout(revealTimer);
      cleanupSilentStatusSave();
      select.removeAttribute('aria-busy');
    };
    dialog.addEventListener('close', finish, { once: true });

    requestAnimationFrame(() => {
      const currentId = document.getElementById('taskId')?.value || '';
      if (!dialog.open || currentId !== expectedId || ![...taskStatus.options].some(option => option.value === targetStatus)) {
        finish();
        select.disabled = false;
        if (dialog.open) dialog.querySelector('#closeTaskDialog')?.click();
        return;
      }
      taskStatus.value = targetStatus;
      taskStatus.dispatchEvent(new Event('input', { bubbles: true }));
      taskStatus.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof taskForm.requestSubmit === 'function') taskForm.requestSubmit();
      else taskForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }

  function handleStatusChange(detail, select, previousStatus) {
    const targetStatus = normalize(select.value);
    if (!targetStatus || targetStatus === previousStatus) return;

    const completeButton = detail.querySelector('[data-action="done"]');
    if (targetStatus === '完了' && completeButton) {
      select.value = previousStatus;
      completeButton.click();
      return;
    }

    const reopenButton = detail.querySelector('[data-action="reopen"]');
    if (reopenButton) {
      const reopenStatus = normalize(reopenButton.textContent).replace(/に戻す$/, '');
      if (reopenStatus === targetStatus) {
        select.value = previousStatus;
        reopenButton.click();
        return;
      }
    }

    submitStatusViaExistingEditor(detail, select, targetStatus);
  }

  function patchDetailStatusControl() {
    const detail = document.getElementById('detailBody');
    if (!detail || detail.classList.contains('empty') || !detail.querySelector('[data-action="edit"]')) return;
    const statuses = availableStatuses();
    if (!statuses.length) return;
    const currentStatus = currentDetailStatus(detail, statuses);
    if (!currentStatus) return;

    let control = detail.querySelector('.detail-status-control-v146');
    if (!control) {
      control = document.createElement('div');
      control.className = 'detail-status-control-v146';
      control.innerHTML = `
        <div class="detail-status-label-v146">
          <strong>状態を変更</strong>
          <span>編集画面を開かずに更新</span>
        </div>
        <select class="${STATUS_SELECTOR_CLASS}" aria-label="タスクの状態を変更"></select>
      `;
      const meta = detail.querySelector(':scope > .task-meta');
      if (meta) meta.insertAdjacentElement('afterend', control);
      else detail.prepend(control);
    }

    const select = control.querySelector(`.${STATUS_SELECTOR_CLASS}`);
    if (!select || select.dataset.boundV146 === 'true' && select.dataset.currentStatus === currentStatus) return;
    const previousValue = select.value;
    select.innerHTML = statuses.map(status => `<option value="${status.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">${status.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</option>`).join('');
    select.value = statuses.includes(previousValue) && previousValue === currentStatus ? previousValue : currentStatus;
    select.dataset.currentStatus = currentStatus;
    if (select.dataset.boundV146 !== 'true') {
      select.dataset.boundV146 = 'true';
      select.addEventListener('change', () => handleStatusChange(detail, select, select.dataset.currentStatus || currentStatus));
    }
  }

  function scheduleStatusPatch() {
    if (statusPatchScheduled) return;
    statusPatchScheduled = true;
    requestAnimationFrame(() => {
      statusPatchScheduled = false;
      patchDetailStatusControl();
    });
  }

  function start() {
    const detail = document.getElementById('detailBody');
    if (detail) new MutationObserver(scheduleStatusPatch).observe(detail, { childList: true, subtree: true });
    scheduleStatusPatch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
