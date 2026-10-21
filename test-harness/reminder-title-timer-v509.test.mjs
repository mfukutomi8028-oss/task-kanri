import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = app.indexOf('// Only the newest reminder owns title restoration;');
const end = app.indexOf('function playReminderBeep()', start);
assert.ok(start >= 0 && end > start, 'reminder title lifecycle section must exist');
const source = app.slice(start, end);

function harness(initialTitle = '業務管理ボード') {
  let now = 0, next = 0;
  const tasks = new Map();
  const document = { title: initialTitle };
  const context = vm.createContext({
    document,
    setTimeout(fn, delay) { const id = ++next; tasks.set(id, { fn, due: now + delay }); return id; },
    clearTimeout(id) { tasks.delete(id); }
  });
  vm.runInContext(source, context);
  const trigger = msg => vm.runInContext('flashReminderTitle(' + JSON.stringify(msg) + ')', context);
  function advance(ms) {
    const target = now + ms;
    while (true) {
      const entries = [...tasks.entries()].filter(([,t]) => t.due <= target).sort((a,b)=>a[1].due-b[1].due);
      if (!entries.length) break;
      const [id, task] = entries[0];
      tasks.delete(id); now = task.due; task.fn();
    }
    now=target;
  }
  return {document,trigger,advance,pending:()=>tasks.size};
}

test('Ver.509 consecutive reminders do not restore stale title at the first notification deadline', () => {
  const h=harness('Schedule — Board');
  h.trigger('A');
  h.advance(10000);
  h.trigger('B');
  assert.equal(h.pending(),1,'exactly one title restoration timer is owned');
  h.advance(5000);
  assert.equal(h.document.title,'🔔 B','first alert deadline cannot erase second');
  h.advance(10000);
  assert.equal(h.document.title,'Schedule — Board','restore pre-notification title, not earlier alert');
  assert.equal(h.pending(),0);
});

test('Ver.509 a single reminder restores the original title after 15 seconds', () => {
  const h=harness();
  h.trigger('A');
  h.advance(14999);
  assert.equal(h.document.title,'🔔 A');
  h.advance(1);
  assert.equal(h.document.title,'業務管理ボード');
  assert.equal(h.pending(),0);
});

test('Ver.509 repeated reminders extend the window without accumulating timers', () => {
  const h=harness('Custom title');
  for (let i=0;i<6;i++) {
    h.trigger('R'+i);
    assert.equal(h.pending(),1);
    if (i<5) h.advance(4000);
  }
  h.advance(15000);
  assert.equal(h.document.title,'Custom title');
  assert.equal(h.pending(),0);
});
