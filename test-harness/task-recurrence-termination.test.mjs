import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the production recurrence and completion functions in isolation.
// Deliberately extract, rather than copy, the implementation under test.
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const FUNCTION_NAMES = [
  'normalizeRecurrence', 'validRecurrenceDate', 'normalizeRecurrenceRule',
  'clampNumber', 'clampWeekday', 'getRecurringDates',
  'nextRecurringChild', 'applyTaskDraft'
];
function extract(name) {
  const token = 'function ' + name + '(';
  const start = source.indexOf(token);
  assert.ok(start >= 0, 'Missing function ' + name);
  assert.equal(source.indexOf(token, start + 1), -1, 'Duplicate function ' + name);
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start, 'Missing closing brace for ' + name);
  return source.slice(start, end + 3);
}
const iso = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') +
  '-' + String(date.getDate()).padStart(2, '0');
const parse = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
};
const advance = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
function engine() {
  const helpers = {
    SCHEDULE_COPY_MAX: 200,
    todayISO: () => '2026-11-04',
    startOfToday: () => parse('2026-11-04'),
    parseISODate: parse,
    toISODate: iso,
    addDays: advance,
    scheduleCopyDateSerial: date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
    startOfWeekMonday: date => advance(date, -((date.getDay() + 6) % 7)),
    getNthWeekInMonth: () => 1,
    buildScheduleCopyDates: (_source, config) => {
      const start = parse(config.startDate);
      const dates = [];
      for (let i = 0; i < config.count; i += 1) {
        let date;
        if (config.method === 'monthlyDay') {
          date = new Date(start.getFullYear(), start.getMonth() + i * config.interval, config.monthDay);
        } else {
          date = advance(start, i * config.interval);
        }
        dates.push(iso(date));
      }
      return { dates };
    },
    getDefaultOpenStatus: () => '未着手',
    nextRecurringDeadline: () => '',
    normalizeTask: task => task,
    appendHistory: (history, message) => [...(history || []), { text: message }],
    getCurrentUser: () => 'Tester',
    normalizeRevision: value => Number(value) || 0,
    isCompletedStatus: value => value === '完了'
  };
  // Only the named pure/transaction-draft functions run, with no Firebase or DOM.
  const factory = new Function(...Object.keys(helpers),
    FUNCTION_NAMES.map(extract).join('\n') +
    '\nreturn { ' + FUNCTION_NAMES.join(', ') + ' };');
  return factory(...Object.values(helpers));
}
function root(id, recurrence, rule) {
  return {
    id, title: '定期作業', status: '未着手', recurrence,
    recurrenceRule: { anchorDate: '2026-11-01', interval: 1, seriesId: id, ...rule },
    revision: 1, checklist: [], comments: [], history: []
  };
}
function complete(api, records, id) {
  const current = records[id];
  assert.ok(current, 'Missing current task ' + id);
  return api.applyTaskDraft(records, current, { ...current, status: '完了' });
}

test('invalid dates do not silently pass and legacy task series stay unlimited', () => {
  const api = engine();
  assert.equal(api.validRecurrenceDate('2026-11-05'), true);
  assert.equal(api.validRecurrenceDate('2026-02-30'), false);
  assert.equal(api.validRecurrenceDate('not-a-date'), false);
  const old = api.normalizeRecurrenceRule('daily', { anchorDate: '2026-11-01' });
  assert.equal(old.endMode, 'unlimited');
  const capped = api.normalizeRecurrenceRule('daily',
    { anchorDate: '2026-11-01', endMode: 'count', count: 999 });
  assert.equal(capped.count, 200);
});

test('count quota is consumed by committed children and stops before an extra child', () => {
  const api = engine();
  const original = root('count-root', 'daily', { endMode: 'count', count: 2, generatedCount: 0 });
  const first = complete(api, { [original.id]: original }, original.id);
  assert.ok(first.recurring);
  assert.equal(first.records[original.id].recurrenceRule.generatedCount, 1);
  const child1 = first.records[first.recurring.id];
  assert.equal(child1.recurrenceRule.generatedCount, 1);
  const second = complete(api, first.records, child1.id);
  assert.ok(second.recurring);
  const child2 = second.records[second.recurring.id];
  assert.equal(child2.recurrenceRule.generatedCount, 2);
  const third = complete(api, second.records, child2.id);
  assert.equal(third.recurring, null);
  assert.equal(Object.keys(third.records).length, 3); // root plus exactly two children

  // A previously completed parent can be reopened and completed again without
  // making a second child, even if calendar time or settings have changed.
  const doneParent = first.records[original.id];
  const reopened = api.applyTaskDraft(first.records, doneParent,
    { ...doneParent, status: '未着手' });
  const recompleted = complete(api, reopened.records, original.id);
  assert.equal(recompleted.recurring, null);
  assert.equal(Object.keys(recompleted.records).length, 2);
});

test('end date is inclusive, and missing or expired end dates stop generation', () => {
  const api = engine();
  const eligible = root('date-root', 'daily',
    { endMode: 'date', endDate: '2026-11-05' });
  const first = complete(api, { [eligible.id]: eligible }, eligible.id);
  assert.equal(first.recurring?.repeatDate, '2026-11-05');
  const second = complete(api, first.records, first.recurring.id);
  assert.equal(second.recurring, null);
  const expired = root('expired', 'daily',
    { endMode: 'date', endDate: '2026-11-04' });
  assert.equal(complete(api, { expired }, expired.id).recurring, null);
  assert.deepEqual(api.getRecurringDates('daily',
    { anchorDate: '2026-11-01', endMode: 'date', endDate: '' }, '2026-11-04', 12), []);
});

test('selected explicit dates create only the listed future occurrences', () => {
  const api = engine();
  const original = root('manual', 'dates', {
    selectedDates: ['2026-11-06', '2026-11-09']
  });
  const first = complete(api, { manual: original }, original.id);
  assert.equal(first.recurring?.repeatDate, '2026-11-06');
  const second = complete(api, first.records, first.recurring.id);
  assert.equal(second.recurring?.repeatDate, '2026-11-09');
  const third = complete(api, second.records, second.recurring.id);
  assert.equal(third.recurring, null);
  assert.equal(Object.keys(third.records).length, 3);
});

test('a finite 4-item preview never leaks a fifth date', () => {
  const api = engine();
  const rule = { anchorDate: '2026-11-01', endMode: 'count', count: 4, generatedCount: 0 };
  assert.equal(api.getRecurringDates('daily', rule, '2026-11-04', 12).length, 4);
  assert.equal(api.getRecurringDates('daily', { ...rule, generatedCount: 3 }, '2026-11-04', 12).length, 1);
  assert.equal(api.getRecurringDates('daily', { ...rule, generatedCount: 4 }, '2026-11-04', 12).length, 0);
});
