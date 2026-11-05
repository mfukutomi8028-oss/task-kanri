import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'Missing ' + name);
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start, 'No function close for ' + name);
  return source.slice(start, end + 3);
}
function draftFactory() {
  const context = {
    parseISODate: value => new Date(value + 'T00:00:00'),
    normalizeSchedule: item => item,
    getCurrentUser: () => 'Tester',
    makeScheduleChangeInfo: () => ({ label:'コピー' })
  };
  return new Function(...Object.keys(context),
    extract('scheduleCopyDraftForDate') + '\nreturn scheduleCopyDraftForDate;')(...Object.values(context));
}
test('schedule-copy: all occurrences in a batch carry one immutable series key and planned date', () => {
  const draft = draftFactory();
  const source = {
    id:'original',title:'月次会議',startAt:'2026-11-04T01:00:00Z',endAt:'2026-11-04T02:00:00Z',
    assignee:'Tester',category:'会議',memo:'会場A',relatedTaskId:'task-1',
    recurrenceSeriesId:'old-group',recurrenceDate:'2026-11-04'
  };
  const group = 'copy-new-group';
  const december = draft(source, '2026-12-04', 'sch-a', 100, group);
  const january = draft(source, '2027-01-04', 'sch-b', 101, group);
  assert.equal(december.recurrenceSeriesId, group);
  assert.equal(january.recurrenceSeriesId, group);
  assert.equal(december.recurrenceDate, '2026-12-04');
  assert.equal(january.recurrenceDate, '2027-01-04');
  assert.equal(december.relatedTaskId, source.relatedTaskId);
  assert.equal(january.relatedTaskId, source.relatedTaskId);
  assert.notEqual(december.recurrenceSeriesId, source.recurrenceSeriesId);
  assert.equal(source.recurrenceSeriesId, 'old-group');
  const single = draft(source, '2026-11-05', 'sch-single');
  assert.equal(single.recurrenceSeriesId, '');
  assert.equal(single.recurrenceDate, '');
});

test('schedule editing: save preserves occurrence membership and original recurrence date', () => {
  const input = new Map([
    ['scheduleStart','2027-02-01T10:00'],
    ['scheduleEnd','2027-02-01T11:00'],
    ['scheduleTitle','名称変更'],
    ['scheduleAssignee','Tester'],
    ['scheduleLocation','会議室'],
    ['scheduleCategory','会議'],
    ['scheduleMemo','詳細'],
    ['scheduleRelatedTask','task-1']
  ]);
  const env = {
    $: id => ({ value: input.get(id) }),
    normalizeSchedule: value => value,
    getCurrentUser: () => 'Tester'
  };
  const read = new Function(...Object.keys(env),
    extract('buildScheduleDraftFromValuesV372') + '\n' +
    extract('readScheduleDraftFromForm') + '\nreturn readScheduleDraftFromForm;')(...Object.values(env));
  const existing = {
    createdAt: 100,createdBy:'Tester',
    recurrenceSeriesId:'copy-group',recurrenceDate:'2026-12-04'
  };
  const result = read('existing-1', existing, 7);
  assert.ok(!result.error);
  assert.equal(result.schedule.id, 'existing-1');
  assert.equal(result.schedule.revision, 7);
  assert.equal(result.schedule.recurrenceSeriesId, 'copy-group');
  assert.equal(result.schedule.recurrenceDate, '2026-12-04');
});

test('schedule-copy: batch metadata is written only for multi-occurrence operations', () => {
  assert.match(source, /const seriesId = dates\.length > 1 \?/);
  assert.match(source, /scheduleCopyDraftForDate\(source, date, generateScheduleId\(\), timestamp \+ index, seriesId\)/);
});
