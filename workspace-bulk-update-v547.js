// Ver.547: one canonical non-delete bulk update transaction and recurrence rule owner.
// The Classic controller keeps selection, notifications, remote session, UI and canonical deletion.
// No extra Firebase subscription, browser persistence, DOM or room-root transaction.
(function installBulkUpdateV547(root) {
  'use strict';
  if (root.WorkBoardBulkUpdateV547) return;
  const COMPLETE = '完了';

  function normalizeRevision(value) {
    const revision = Number(value);
    return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
  }

  function normalizeRecurrence(value) {
    const raw = String(value || 'none');
    if (raw === 'monthly') return 'monthlyDay';
    return ['none', 'daily', 'weekly', 'monthlyDay', 'monthlyNth', 'yearly'].includes(raw) ? raw : 'none';
  }

  function parseISODate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function addMonthsKeepDay(date, months, preferredDay = date.getDate()) {
    const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
    return new Date(first.getFullYear(), first.getMonth(), Math.min(preferredDay, daysInMonth(first)));
  }

  function addYearsKeepDay(date, years) {
    const first = new Date(date.getFullYear() + years, date.getMonth(), 1);
    return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), daysInMonth(first)));
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function clampWeekday(value) {
    return clampNumber(value, 0, 6, 1);
  }

  function getNthWeekInMonth(date) {
    return Math.ceil(date.getDate() / 7);
  }

  function getNthWeekdayOfMonth(year, month, weekday, nth) {
    const target = clampWeekday(weekday);
    if (String(nth) === 'last') {
      const last = new Date(year, month + 1, 0);
      while (last.getDay() !== target) last.setDate(last.getDate() - 1);
      return last;
    }
    const index = clampNumber(nth, 1, 5, 1);
    const first = new Date(year, month, 1);
    const offset = (target - first.getDay() + 7) % 7;
    const candidate = new Date(year, month, 1 + offset + (index - 1) * 7);
    if (candidate.getMonth() !== month) return getNthWeekdayOfMonth(year, month, target, 'last');
    return candidate;
  }

  function recurrenceRule(task) {
    const due = parseISODate(task?.dueDate || '') || new Date();
    const rule = task?.recurrenceRule && typeof task.recurrenceRule === 'object' ? task.recurrenceRule : {};
    const weekdays = Array.isArray(rule.weekdays)
      ? [...new Set(rule.weekdays.map(clampWeekday))]
      : [due.getDay()];
    return {
      interval: clampNumber(rule.interval, 1, 36, 1),
      weekdays: weekdays.length ? weekdays : [due.getDay()],
      nth: ['1', '2', '3', '4', '5', 'last'].includes(String(rule.nth)) ? String(rule.nth) : String(getNthWeekInMonth(due)),
      weekday: clampWeekday(rule.weekday ?? due.getDay()),
      monthDay: clampNumber(rule.monthDay ?? due.getDate(), 1, 31, due.getDate())
    };
  }

  function nextRecurringDueDate(task) {
    const base = parseISODate(task?.dueDate || '');
    const recurrence = normalizeRecurrence(task?.recurrence);
    if (!base || recurrence === 'none') return '';
    const rule = recurrenceRule(task);
    if (recurrence === 'daily') return toISODate(addDays(base, rule.interval));
    if (recurrence === 'weekly') {
      for (let offset = 1; offset <= 7 * rule.interval + 7; offset += 1) {
        const candidate = addDays(base, offset);
        if (!rule.weekdays.includes(candidate.getDay())) continue;
        if (rule.interval <= 1 || Math.floor((offset - 1) / 7) % rule.interval === 0) return toISODate(candidate);
      }
      return toISODate(addDays(base, 7 * rule.interval));
    }
    if (recurrence === 'monthlyDay') return toISODate(addMonthsKeepDay(base, rule.interval, rule.monthDay));
    if (recurrence === 'monthlyNth') {
      const month = new Date(base.getFullYear(), base.getMonth() + rule.interval, 1);
      return toISODate(getNthWeekdayOfMonth(month.getFullYear(), month.getMonth(), rule.weekday, rule.nth));
    }
    if (recurrence === 'yearly') return toISODate(addYearsKeepDay(base, rule.interval));
    return '';
  }


  function create({currentUser,defaultOpenStatus}) {
    if ([currentUser,defaultOpenStatus].some(fn=>typeof fn!=='function')) {
      throw new TypeError('Current user and open status dependencies are required');
    }
  function appendHistory(history, text, api, at = Date.now()) {
    let id = `history-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const key = api?.push?.(api.ref(api.db, `rooms/${api.roomId}/tasks`))?.key;
      if (key) id = key;
    } catch (_) {}
    return [...(Array.isArray(history) ? history : []), {
      id,
      author: currentUser(),
      text: String(text || ''),
      createdAt: at
    }].slice(-80);
  }

  function changeInfo(before, after) {
    if (before.status !== after.status) {
      const detail = `状態: ${before.status} → ${after.status}`;
      return { label: '状態変更', summary: detail, details: [detail] };
    }
    if (before.assignee !== after.assignee) {
      const detail = `担当: ${before.assignee} → ${after.assignee}`;
      return { label: '担当変更', summary: detail, details: [detail] };
    }
    if (before.category !== after.category) {
      const detail = `分類: ${before.category} → ${after.category}`;
      return { label: '分類変更', summary: detail, details: [detail] };
    }
    return { label: '保存', summary: '変更なしで保存', details: ['変更なしで保存'] };
  }

  function bulkActionLabel(action) {
    return ({ status: '状態を変更', assignee: '担当者を変更', category: '分類を変更', complete: '完了' })[action] || '更新';
  }

  function applyOneTask(records, original, action, target, api) {
    const current = records?.[original.id];
    if (!current || normalizeRevision(current.revision) !== normalizeRevision(original.revision)) throw new Error('revision-or-relation-mismatch');

    const before = JSON.parse(JSON.stringify(current));
    const now = Date.now();
    let saved = { ...current };
    if (action === 'status') saved.status = String(target || '');
    if (action === 'assignee') saved.assignee = String(target || '');
    if (action === 'category') saved.category = String(target || '');
    if (action === 'complete') saved.status = COMPLETE;

    if (String(saved.status || '') === COMPLETE) saved.completedAt = Number(saved.completedAt || 0) || now;
    else {
      saved.completedAt = 0;
      saved.completedMemo = '';
    }
    saved.updatedAt = now;
    saved.updatedBy = currentUser();
    saved.lastChange = changeInfo(before, saved);
    saved.history = appendHistory(saved.history, `一括操作で${bulkActionLabel(action)}しました。`, api, now);
    saved.revision = normalizeRevision(current.revision) + 1;

    const becameCompleted = String(before.status || '') !== COMPLETE && String(saved.status || '') === COMPLETE;
    const nextDueDate = becameCompleted ? nextRecurringDueDate(saved) : '';
    if (nextDueDate) {
      const childId = `rec-${original.id}-${nextDueDate}`;
      const child = records[childId];
      if (current.nextRecurringTaskId && current.nextRecurringTaskId !== childId) throw new Error('revision-or-relation-mismatch');
      if (child && (String(child.recurringParentId || '') !== original.id || String(child.dueDate || '') !== nextDueDate)) throw new Error('revision-or-relation-mismatch');
      if (!child) {
        records[childId] = {
          ...saved,
          id: childId,
          status: defaultOpenStatus(api.roomId),
          dueDate: nextDueDate,
          completedAt: 0,
          completedMemo: '',
          knowledgeId: '',
          pinned: false,
          comments: [],
          checklist: (Array.isArray(saved.checklist) ? saved.checklist : []).map(item => ({ ...item, done: false })),
          history: appendHistory([], `定期タスクとして「${saved.title || ''}」から作成されました。`, api, now),
          createdBy: currentUser(),
          createdAt: now,
          updatedBy: currentUser(),
          updatedAt: now,
          nextRecurringTaskId: '',
          recurringParentId: original.id,
          revision: 1,
          operationId: childId
        };
      }
      saved.nextRecurringTaskId = childId;
      saved.history = appendHistory(saved.history, `次回の定期タスクを作成しました（期限：${nextDueDate}）。`, api, now);
    }

    records[original.id] = saved;
    return saved;
  }


    async function commit(api,selected,action,target) {
    const tasksRef = api.ref(api.db, `rooms/${api.roomId}/tasks`);

    // This helper client does not subscribe to tasks. Warm the same collection
    // before starting a transaction so the first callback never sees an empty
    // parent cache and aborts a valid bulk operation.
    await api.get(tasksRef);
    let conflict = false;
    const result = await api.runTransaction(tasksRef, current => {
      try {
        const records = current && typeof current === 'object' ? { ...current } : {};
        for (const original of selected) applyOneTask(records, original, action, target, api);
        return records;
      } catch (error) {
        conflict = true;
        return;
      }
    }, { applyLocally: false });
    if (!result.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');

    const committed = result.snapshot?.val() || {};
    const expected = new Map(selected.map(task => [task.id, normalizeRevision(committed[task.id]?.revision)]));
      return expected;
    }
    return Object.freeze({normalizeRevision,nextRecurringDueDate,applyOneTask,commit});
  }
  root.WorkBoardBulkUpdateV547=Object.freeze({create,normalizeRevision,nextRecurringDueDate});
})(window);
