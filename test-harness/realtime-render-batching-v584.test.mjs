import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('remote snapshots schedule one paint, while local edits remain synchronous', () => {
  const start = app.indexOf('let subscriptionRenderFrame = null;');
  const end = app.indexOf('\nfunction renderCore()', start);
  assert.ok(start > 0 && end > start);
  let paints = 0, nextId = 1, rafCalls = 0;
  const pending = new Map();
  const context = {
    requestAnimationFrame(callback) {
      const id = nextId++;
      pending.set(id, callback);
      rafCalls++;
      return id;
    },
    cancelAnimationFrame(id) { pending.delete(id); },
    renderCore() { paints++; },
    showRenderError(error) { throw error; },
    console
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);

  vm.runInContext('scheduleSubscribedRender(); scheduleSubscribedRender(); scheduleSubscribedRender();', context);
  assert.equal(paints, 0);
  assert.equal(rafCalls, 1);
  assert.equal(pending.size, 1);
  const frame = [...pending.values()][0];
  pending.clear();
  frame();
  assert.equal(paints, 1);

  vm.runInContext('scheduleSubscribedRender(); render();', context);
  assert.equal(paints, 2, 'a user render must run immediately');
  assert.equal(pending.size, 0, 'the pending redundant snapshot paint must be cancelled');
  vm.runInContext('scheduleSubscribedRender();', context);
  assert.equal(pending.size, 1, 'next remote change still schedules a fresh frame');
});

test('all four Firebase collection callbacks defer painting and do not duplicate task work', () => {
  const between = (start, end) => {
    const from = app.indexOf(start), to = app.indexOf(end, from + 1);
    assert.ok(from > 0 && to > from, start);
    return app.slice(from, to);
  };
  const tasks = between('onValue(state.tasksRef,', 'onValue(state.schedulesRef,');
  const schedules = between('onValue(state.schedulesRef,', 'onValue(state.knowledgeRef,');
  const knowledge = between('onValue(state.knowledgeRef,', 'onValue(state.todosRef,');
  assert.doesNotMatch(tasks, /\brender\(\);/);
  assert.doesNotMatch(tasks, /\bsyncScheduleRelatedTaskOptions\(\);/);
  assert.doesNotMatch(schedules, /\brender\(\);/);
  assert.doesNotMatch(knowledge, /\brender\(\);/);
  const subscribed = between("function applyDeleteSyncAction(", "function applyCommittedResult(");
  assert.match(subscribed, /action\.type === 'receive-subscription'\) scheduleSubscribedRender\(\)/);
  const todo = between('function applyTodoSync(action)', 'function loadLocalTodos()');
  assert.match(todo, /action\.type === 'receive-authoritative-snapshot'\) scheduleSubscribedRender\(\)/);
  assert.match(todo, /else render\(\);/);
  const localWrite = between('function applyCommittedResult(', 'function mergeSubscribedCollection(');
  assert.match(localWrite, /\brender\(\);/);
  assert.match(app, /function init\(\) \{[\s\S]*?showUserDialogIfNeeded\(\);\s*render\(\);/);
});
