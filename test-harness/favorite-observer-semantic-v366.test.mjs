import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('favorite-ui-v237.js');
const manifest = read('release-manifest.js');
const responsibility = JSON.parse(read('patch-responsibilities.json'));

const predicate = String.raw\`
  const favoriteSelectorsV366 = [
    '.nav-item[data-filter="favorite"]', '#favoriteOnly',
    '.detail-favorite-button[data-action="favorite"]',
    '.favorite-button[data-star-task]', '#roomCacheHelp', '#clearRoomCache',
    'label.check-row'
  ].join(', ');
  function favoriteNodeV366(node) {
    if (node?.nodeType === 3) return favoriteNodeV366(node.parentElement);
    if (node?.nodeType !== 1) return false;
    return Boolean(
      node.matches?.(favoriteSelectorsV366) ||
      node.querySelector?.(favoriteSelectorsV366) ||
      node.closest?.(favoriteSelectorsV366)
    );
  }
  function favoriteMutationV366(records) {
    return records.some(record => [...record.addedNodes, ...record.removedNodes].some(favoriteNodeV366));
  }
\`;

function candidateSource() {
  const target = 'if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedulePatch();';
  assert.equal(source.split(target).length, 2, 'audit injection matches one existing observer only');
  return source.replace('  function installObservers() {', predicate + '\n  function installObservers() {')
    .replace(target, 'if (favoriteMutationV366(records)) schedulePatch();');
}

function element(name, { selectors = [], text = '', starred = false, descendants = [] } = {}) {
  const attributes = new Map();
  const classes = new Set(starred ? ['starred'] : []);
  const matches = selector => selector.split(',').some(part => selectors.includes(part.trim()));
  const node = {
    nodeType: 1, name,
    textContent: text,
    hidden: false,
    childNodes: [],
    descendants,
    style: { setProperty() {} },
    classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value) },
    matches,
    querySelector: selector => descendants.find(child => child.matches?.(selector)) || null,
    querySelectorAll: selector => descendants.filter(child => child.matches?.(selector)),
    closest: selector => matches(selector) ? node : null,
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    append: child => { node.childNodes.push(child); },
    remove: () => { node.removed = true; }
  };
  return node;
}

function boot({ candidate = false } = {}) {
  const roots = {
    sidebar: element('sidebar'),
    main: element('mainContent'),
    detail: element('detailBody'),
    toast: element('toast')
  };
  const elements = [];
  const listeners = new Map();
  const frames = [];
  const observers = [];
  let favoriteQueries = 0;
  const byId = { mainContent: roots.main, detailBody: roots.detail, toast: roots.toast };
  const document = {
    readyState: 'complete',
    querySelector: selector => selector === '.sidebar' ? roots.sidebar : null,
    querySelectorAll: selector => elements.filter(node => node.matches?.(selector)),
    getElementById: id => {
      if (id === 'favoriteOnly') favoriteQueries++;
      return byId[id] || null;
    },
    createTextNode: text => ({ nodeType: 3, textContent: text }),
    addEventListener: (event, callback) => listeners.set(event, callback)
  };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(root, options) { this.root = root; this.options = options; }
  }
  vm.runInNewContext(candidate ? candidateSource() : source,
    { window: {}, document, MutationObserver: Observer, requestAnimationFrame: callback => { frames.push(callback); return frames.length; } },
    { filename: candidate ? 'favorite-v366-audit-candidate.js' : 'favorite-ui-v237.js' });
  return {
    roots, elements, observers, frames,
    get favoriteQueries() { return favoriteQueries; },
    addElement: node => { elements.push(node); return node; },
    fire: (root, addedNodes = [], removedNodes = []) => {
      const observer = observers.find(item => item.root === root);
      assert.ok(observer, 'observer for root must exist');
      observer.callback([{ type: 'childList', target: root, addedNodes, removedNodes }]);
    },
    drain: () => { while (frames.length) frames.shift()(); },
    click: target => listeners.get('click')?.({ target })
  };
}

test('Ver.366: real product owns three broad childList observers plus one toast text observer', () => {
  const b = boot();
  assert.equal(b.observers.length, 4);
  const [sidebar, main, detail, toast] = b.observers;
  assert.equal(sidebar.root, b.roots.sidebar);
  assert.equal(main.root, b.roots.main);
  assert.equal(detail.root, b.roots.detail);
  for (const owner of [sidebar, main, detail]) {
    assert.equal(owner.options.childList, true);
    assert.equal(owner.options.subtree, true);
    assert.equal(Boolean(owner.options.attributes), false);
  }
  assert.equal(toast.root, b.roots.toast);
  assert.equal(toast.options.characterData, true);
});

test('Ver.366: unrelated childList insertions currently wake one full document patch per frame', () => {
  const b = boot();
  const baseline = b.favoriteQueries;
  for (const root of [b.roots.sidebar, b.roots.main, b.roots.detail]) {
    b.fire(root, [element('unrelated')]);
  }
  assert.equal(b.frames.length, 1, 'product already deduplicates via animation frame');
  b.drain();
  assert.ok(b.favoriteQueries > baseline, 'broad unrelated changes re-scan document');
  b.fire(b.roots.main, [element('another unrelated')]);
  assert.equal(b.frames.length, 1, 'next unrelated change wakes another full pass');
});

test('Ver.366 candidate ignores unrelated childList mutations while preserving the same observers', () => {
  const b = boot({ candidate: true });
  assert.equal(b.observers.length, 4);
  const baseline = b.favoriteQueries;
  for (const root of [b.roots.sidebar, b.roots.main, b.roots.detail]) {
    b.fire(root, [element('unrelated')], [element('removed unrelated')]);
  }
  assert.equal(b.frames.length, 0);
  assert.equal(b.favoriteQueries, baseline);
  assert.equal(b.roots.toast.textContent, '');
});

test('Ver.366 candidate still recognizes direct favorite nodes and nested favorite descendants', () => {
  const b = boot({ candidate: true });
  const nav = b.addElement(element('nav', { selectors: ['.nav-item[data-filter="favorite"]'] }));
  b.fire(b.roots.sidebar, [nav]);
  assert.equal(b.frames.length, 1);
  b.drain();
  assert.equal(nav.childNodes[0].textContent, 'お気に入り');

  const detail = b.addElement(element('detail-favorite', {
    selectors: ['.detail-favorite-button[data-action="favorite"]'],
    text: '★', starred: true
  }));
  const wrapper = element('detail-wrapper', { descendants: [detail] });
  b.fire(b.roots.detail, [wrapper]);
  assert.equal(b.frames.length, 1);
  b.drain();
  assert.equal(detail.textContent, 'お気に入り解除');
  assert.equal(detail.getAttribute('aria-label'), 'お気に入りを解除');
  assert.equal(detail.getAttribute('title'), 'お気に入りを解除');

  const list = b.addElement(element('list-favorite', { selectors: ['.favorite-button[data-star-task]'] }));
  b.fire(b.roots.main, [list]);
  b.drain();
  assert.equal(list.getAttribute('aria-label'), 'お気に入りに追加');
  assert.equal(list.getAttribute('title'), 'お気に入りに追加');
});

test('Ver.366 candidate retains click-only favorite toggles, removed nodes and separate toast translations', () => {
  const b = boot({ candidate: true });
  const star = b.addElement(element('star', { selectors: ['.favorite-button[data-star-task]'] }));
  b.fire(b.roots.main, [star]);
  b.drain();
  assert.equal(star.getAttribute('title'), 'お気に入りに追加');
  star.classList.add('starred');
  b.click(star);
  assert.equal(b.frames.length, 1, 'canonical favorite click still schedules repair');
  b.drain();
  assert.equal(star.getAttribute('title'), 'お気に入りを解除');

  b.fire(b.roots.main, [], [star]);
  assert.equal(b.frames.length, 1, 'removed favorite nodes must trigger a patch');
  b.drain();

  b.roots.toast.textContent = 'スターを付けました';
  b.fire(b.roots.toast, [{ nodeType: 3, textContent: 'スターを付けました' }]);
  assert.equal(b.roots.toast.textContent, 'お気に入りに追加しました');
  b.roots.toast.textContent = 'スターを外しました';
  b.fire(b.roots.toast, [{ nodeType: 3, textContent: 'スターを外しました' }]);
  assert.equal(b.roots.toast.textContent, 'お気に入りから外しました');
});

test('Ver.366 decision gate: audit only, baseline synced and canonical runtime unchanged', () => {
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 296);
  assert.equal(String(responsibility.baselineRelease), String(release));
  assert.match(source, /function schedulePatch\(\)/);
  assert.match(source, /requestAnimationFrame\(runPatch\)/);
  assert.match(source, /patchFavoriteLabels\(document\)/);
  assert.match(source, /new MutationObserver\(patchFavoriteToast\)/);
  assert.match(source, /document\.addEventListener\('click'/);
  assert.doesNotMatch(source, /favoriteMutationV366/);
  assert.match(manifest, /"favorite-ui-v237\.js"/);
});
