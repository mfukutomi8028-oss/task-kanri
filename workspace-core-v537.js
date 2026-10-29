// Shared read-only domain selectors for Classic and future Modern adapters.
// No DOM, storage, Firebase subscriptions, writes, clocks, or layout imports.
// Existing Classic predicates are injected so group/status/date semantics are unchanged.
import { todoSegment } from './todo-sync-v136.js';

export function selectVisibleTodos(raw, normalizedOwner, localDateISO) {
  // Preserve the exact canonical open-first, completed-today-last segment policy.
  return [
    ...todoSegment(raw, normalizedOwner, 'open', localDateISO),
    ...todoSegment(raw, normalizedOwner, 'completed-today', localDateISO)
  ];
}

export function summarizeTaskCounters(tasks, { today, isCompleted, isMine, parseDueDate }) {
  if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array');
  if (!(today instanceof Date) || !Number.isFinite(today.getTime())) throw new TypeError('today must be a valid local date');
  if ([isCompleted, isMine, parseDueDate].some(fn => typeof fn !== 'function')) {
    throw new TypeError('Classic predicates must be supplied');
  }
  // Match Classic's four independent passes, including "my group" and unusual
  // but legal user status values. Do not turn these counts into sidebar-filter counts.
  const open = tasks.filter(task => !isCompleted(task.status)).length;
  const overdue = tasks.filter(task => !isCompleted(task.status)
    && task.dueDate && parseDueDate(task.dueDate) < today).length;
  const dueToday = tasks.filter(task => !isCompleted(task.status)
    && task.dueDate && parseDueDate(task.dueDate).getTime() === today.getTime()).length;
  const mine = tasks.filter(task => !isCompleted(task.status) && isMine(task.assignee)).length;
  return { open, overdue, today: dueToday, mine };
}
