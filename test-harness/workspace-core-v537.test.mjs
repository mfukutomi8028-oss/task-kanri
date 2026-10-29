import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectVisibleTodos, summarizeTaskCounters } from '../workspace-core-v537.js';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const parseLocal = value => new Date(value + 'T00:00:00');
const owner = '佐藤';
const isMine = assignee => assignee === owner || assignee === '共有ルーム';
const isCompleted = status => String(status || '').trim() === '完了';

test('shared task counters preserve the four Classic room-wide meanings', () => {
  const today = new Date(2026, 9, 29); // Local midnight, never UTC-string comparison.
  const tasks = [
    { id:'a', status:'未着手', dueDate:'2026-10-28', assignee:'佐藤' },
    { id:'b', status:'確認待ち', dueDate:'2026-10-29', assignee:'共有ルーム' },
    { id:'c', status:'保留', dueDate:'2026-10-30', assignee:'福冨' },
    { id:'d', status:'完了', dueDate:'2026-10-20', assignee:'佐藤' },
    { id:'e', status:'未着手', dueDate:'', assignee:'佐藤' },
    { id:'f', status:'未着手', dueDate:'invalid-date', assignee:'福冨' }
  ];
  const frozenInput = structuredClone(tasks);
  const result = summarizeTaskCounters(tasks,{today,isCompleted,isMine,parseDueDate:parseLocal});
  assert.deepEqual(result,{open:5,overdue:1,today:1,mine:3});
  assert.deepEqual(tasks,frozenInput,'selector must not mutate canonical task records');
  // Independent reference keeps the precise old renderSummary behavior.
  const baseline = {
    open: tasks.filter(t=>!isCompleted(t.status)).length,
    overdue:tasks.filter(t=>!isCompleted(t.status)&&t.dueDate&&parseLocal(t.dueDate)<today).length,
    today:tasks.filter(t=>!isCompleted(t.status)&&t.dueDate&&parseLocal(t.dueDate).getTime()===today.getTime()).length,
    mine:tasks.filter(t=>!isCompleted(t.status)&&isMine(t.assignee)).length
  };
  assert.deepEqual(result,baseline);
  assert.deepEqual(summarizeTaskCounters([], {today,isCompleted,isMine,parseDueDate:parseLocal}),{open:0,overdue:0,today:0,mine:0});
  assert.throws(()=>summarizeTaskCounters([], {today:'2026-10-29',isCompleted,isMine,parseDueDate:parseLocal}),/local date/);
  assert.throws(()=>summarizeTaskCounters({}, {today,isCompleted,isMine,parseDueDate:parseLocal}),/array/);
});

test('shared ToDo selector delegates to the canonical revision-safe segments', () => {
  const now = new Date(2026,9,29,10,0,0).getTime();
  const yesterday = new Date(2026,9,28,10,0,0).getTime();
  const raw = {
    a:{id:'a',owner:'佐藤',text:'新しい未完了',order:1024,createdAt:20,revision:1,completed:false},
    b:{id:'b',owner:'佐藤',text:'先に表示する未完了',order:0,createdAt:10,revision:1,completed:false},
    c:{id:'c',owner:'佐藤',text:'本日完了',order:0,createdAt:5,revision:1,completed:true,completedAt:now},
    d:{id:'d',owner:'佐藤',text:'過去完了',order:0,createdAt:5,revision:1,completed:true,completedAt:yesterday},
    e:{id:'e',owner:'福冨',text:'別利用者',order:0,createdAt:4,revision:1,completed:false},
    bad:{id:'different',owner:'佐藤',text:'',order:-10,revision:1,completed:false}
  };
  const before=structuredClone(raw);
  assert.deepEqual(selectVisibleTodos(raw,'佐藤','2026-10-29').map(t=>t.id),['b','a','c']);
  assert.deepEqual(selectVisibleTodos(raw,'福冨','2026-10-29').map(t=>t.id),['e']);
  assert.deepEqual(raw,before);
  assert.deepEqual(selectVisibleTodos({},'佐藤','2026-10-29'),[]);
});

test('Classic alone calls shared selectors; Modern remains independent and unpublished', () => {
  const app=read('app.js'), manifest=read('release-manifest.js');
  const modern=read('modern/preview/index.html');
  assert.match(app,/import \{ selectVisibleTodos, summarizeTaskCounters \} from '\.\/workspace-core-v537\.js';/);
  assert.match(app,/return selectVisibleTodos\(state\.todoRaw, normalizeUser\(getCurrentUser\(\)\), todayISO\(\)\)/);
  assert.match(app,/const \{ open, overdue, today, mine \} = summarizeTaskCounters\(state\.tasks/);
  assert.equal((manifest.match(/"workspace-core-v537\.js"/g)||[]).length,1);
  assert.doesNotMatch(modern,/workspace-core-v537/,'Modern preview uses mock-only records until core integration');
  assert.doesNotMatch(read('index.html'),/modern\/preview/);
});
