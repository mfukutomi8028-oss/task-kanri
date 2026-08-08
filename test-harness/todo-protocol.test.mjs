import assert from 'node:assert/strict';
import test from 'node:test';
import { canPromoteTodo, canonicalTodoMap, isCanonicalTodoId, reduceTodoSync, sortTodos, todoSegment } from '../todo-sync-v136.js';

const todo = (id, revision = 1, extra = {}) => ({ id, text: id, owner: 'A', order: revision * 1024, revision, createdAt: revision, ...extra });

test('map key is canonical: mismatched and unsafe embedded ids cannot redirect a write', () => {
  const records = canonicalTodoMap({ safeKey: todo('victimKey'), 'bad/key': todo('safeKey'), empty: { id: 'other', text: '' } });
  assert.deepEqual(Object.keys(records), ['safeKey']);
  assert.equal(records.safeKey.id, 'safeKey');
  assert.equal(isCanonicalTodoId('bad/key'), false);
});

test('sort is deterministic and visible segments do not include hidden past completion', () => {
  const records = {
    b: todo('b', 1, { order: 10 }), a: todo('a', 1, { order: 10 }), c: todo('c', 1, { owner: 'B' }),
    old: todo('old', 1, { completed: true, completedAt: Date.parse('2026-08-07T12:00:00') }),
    done: todo('done', 1, { completed: true, completedAt: Date.parse('2026-08-08T12:00:00') })
  };
  assert.deepEqual(sortTodos(records, 'A').map(x => x.id), ['a', 'b', 'done', 'old']);
  assert.deepEqual(todoSegment(records, 'A', 'open', '2026-08-08').map(x => x.id), ['a', 'b']);
  assert.deepEqual(todoSegment(records, 'A', 'completed-today', '2026-08-08').map(x => x.id), ['done']);
});

test('upsert barrier ignores one stale revision, then acknowledges expected record without replacing other todos', () => {
  let state = reduceTodoSync({ roomId: 'r', raw: { keep: todo('keep') }, barriers: {} }, { type: 'apply-commit', roomId: 'r', changes: [{ id: 'a', record: todo('a', 3), baseRevision: 2 }] });
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: { a: todo('a', 2), keep: todo('keep', 2) } });
  assert.equal(state.raw.a.revision, 3); assert.equal(state.raw.keep.revision, 2); assert.ok(state.barriers.a);
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: { a: todo('a', 3), keep: todo('keep', 2) } });
  assert.equal(state.barriers.a, undefined); assert.equal(state.raw.a.revision, 3);
});

test('delete barrier never revives a delayed pre-delete snapshot and accepts authoritative absence', () => {
  let state = reduceTodoSync({ roomId: 'r', raw: { a: todo('a', 4) }, barriers: {} }, { type: 'apply-commit', roomId: 'r', changes: [{ id: 'a', record: null, baseRevision: 4 }] });
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: { a: todo('a', 4) } });
  assert.equal(state.raw.a, undefined); assert.ok(state.barriers.a);
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: {} });
  assert.equal(state.raw.a, undefined); assert.equal(state.barriers.a, undefined);
});

test('barriers are finite: a later authoritative deletion is accepted and stale records only release protection', () => {
  let state = reduceTodoSync({ roomId: 'r', raw: { a: todo('a', 3) }, barriers: {} }, { type: 'apply-commit', roomId: 'r', changes: [{ id: 'a', record: todo('a', 4), baseRevision: 3 }] });
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: {} });
  assert.ok(state.barriers.a); assert.equal(state.raw.a.revision, 4);
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: {} });
  assert.equal(state.raw.a, undefined); assert.equal(state.barriers.a, undefined);
  state = reduceTodoSync({ roomId: 'r', raw: { a: todo('a', 2) }, barriers: {} }, { type: 'apply-commit', roomId: 'r', changes: [{ id: 'a', record: null, baseRevision: 2 }] });
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: { a: todo('a', 2) } });
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: { a: todo('a', 2) } });
  assert.equal(state.raw.a, undefined); assert.equal(state.barriers.a, undefined);
});

test('a newer remote record after delete is an authoritative new state, and room reset clears all', () => {
  let state = reduceTodoSync({ roomId: 'r', raw: { a: todo('a', 2) }, barriers: {} }, { type: 'apply-commit', roomId: 'r', changes: [{ id: 'a', record: null, baseRevision: 2 }] });
  state = reduceTodoSync(state, { type: 'receive-authoritative-snapshot', roomId: 'r', value: { a: todo('a', 3) } });
  assert.equal(state.raw.a.revision, 3); assert.equal(state.barriers.a, undefined);
  assert.deepEqual(reduceTodoSync(state, { type: 'reset-room', roomId: 'next' }), { roomId: 'next', raw: {}, barriers: {} });
});

test('promotion is allowed only for the exact current id, owner, and revision', () => {
  const current = todo('a', 4); assert.equal(canPromoteTodo({ todoId: 'a', owner: 'A', baseRevision: 4 }, current), true);
  assert.equal(canPromoteTodo({ todoId: 'a', owner: 'A', baseRevision: 3 }, current), false);
  assert.equal(canPromoteTodo({ todoId: 'a', owner: 'B', baseRevision: 4 }, current), false);
});
