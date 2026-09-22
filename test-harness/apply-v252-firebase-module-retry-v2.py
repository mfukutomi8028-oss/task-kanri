from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
changed = False

def write_if_changed(path, before, after):
    global changed
    if before != after:
        (ROOT / path).write_text(after, encoding='utf-8')
        changed = True

def replace_once(text, old, new, label):
    if new in text:
        return text
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected one match, found {text.count(old)}')
    return text.replace(old, new, 1)

# Runtime loader hardening.
path = 'comment-reactions-v191.js'
p = ROOT / path
before = p.read_text(encoding='utf-8')
text = before
text = replace_once(
    text,
    '// Ver.251: task comment interactions. Reaction writes keep expected-base protection, block non-online writes, and retry Firebase initialization after transient failures.',
    '// Ver.252: task comment interactions. Reaction writes keep expected-base protection, block non-online writes, and retry transient Firebase module failures with a fresh module specifier.',
    'runtime header'
)
text = replace_once(text, '  let firebasePromise = null;\n  let replyTarget = null;', '  let firebasePromise = null;\n  let firebaseImportRetry = 0;\n  let replyTarget = null;', 'runtime declarations')
old = '''  async function firebase() {
    if (firebasePromise) return firebasePromise;
    const pending = (async () => {
      if (!window.firebaseConfig) throw new Error("firebase-config-unavailable");
      const [appModule, databaseModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js`)
      ]);
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(window.firebaseConfig);
      return {
        db: databaseModule.getDatabase(app),
        ref: databaseModule.ref,
        runTransaction: databaseModule.runTransaction
      };
    })();
    firebasePromise = pending;
    try {
      return await pending;
    } catch (error) {
      if (firebasePromise === pending) firebasePromise = null;
      throw error;
    }
  }
'''
new = '''  async function firebase() {
    if (firebasePromise) return firebasePromise;
    const importRetry = firebaseImportRetry;
    const pending = (async () => {
      if (!window.firebaseConfig) throw new Error("firebase-config-unavailable");
      const retrySuffix = importRetry > 0 ? `?wb-retry=${importRetry}` : "";
      let appModule;
      let databaseModule;
      try {
        [appModule, databaseModule] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js${retrySuffix}`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js${retrySuffix}`)
        ]);
      } catch (error) {
        if (firebaseImportRetry === importRetry) firebaseImportRetry += 1;
        throw error;
      }
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(window.firebaseConfig);
      return {
        db: databaseModule.getDatabase(app),
        ref: databaseModule.ref,
        runTransaction: databaseModule.runTransaction
      };
    })();
    firebasePromise = pending;
    try {
      return await pending;
    } catch (error) {
      if (firebasePromise === pending) firebasePromise = null;
      throw error;
    }
  }
'''
text = replace_once(text, old, new, 'firebase()')
write_if_changed(path, before, text)

# Browser test flips the audited failure into the product success contract.
path = 'tests/comment-reaction-firebase-retry-audit-v255.spec.mjs'
p = ROOT / path
before = p.read_text(encoding='utf-8')
text = before
text = replace_once(text,
    "test('failed Firebase module specifiers stay cached in-page so a second reaction attempt cannot refetch, but no ghost state remains', async ({ page }) => {",
    "test('Ver.252 retries transient Firebase module failure with a fresh specifier and commits the second reaction attempt', async ({ page }) => {",
    'browser title')
text = replace_once(text, '  await page.route(APP_URL, async route => {', r"  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-app\.js(?:\?wb-retry=\d+)?$/, async route => {", 'app route')
text = replace_once(text, '  await page.route(DB_URL, async route => {', r"  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js(?:\?wb-retry=\d+)?$/, async route => {", 'db route')
old = '''  await choice.evaluate(node => node.click());
  await page.waitForTimeout(100);
  await expect(page.locator('#toast')).toContainText('リアクションを保存できませんでした');
  await expect(choice).toBeEnabled();

  cached = await cachedTask(page, taskId);
  expect(cached.revision).toBe(10);
  expect(cached.comments[0].reactions || {}).toEqual({});
  expect(await page.evaluate(() => window.__WB_V255_REMOTE_TASK__.revision)).toBe(10);
  expect(requestCounts).toEqual({ app: 1, database: 1 });
  expect(pageErrors).toEqual([]);
'''
new = '''  await choice.evaluate(node => node.click());
  await expect.poll(async () => Number((await cachedTask(page, taskId))?.revision || 0), { timeout: 8_000 }).toBe(11);
  await expect(choice).toBeEnabled();

  cached = await cachedTask(page, taskId);
  expect(cached.revision).toBe(11);
  expect(cached.comments[0].reactions['👍']).toEqual(['福冨']);
  expect(await page.evaluate(() => window.__WB_V255_REMOTE_TASK__.revision)).toBe(11);
  expect(requestCounts).toEqual({ app: 2, database: 2 });
  await expect(page.locator('.comment-reaction-chip-v165[data-comment-reaction-emoji="👍"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
'''
text = replace_once(text, old, new, 'browser second attempt')
write_if_changed(path, before, text)

# Static Ver.255 evidence becomes the Ver.252 repaired contract without brittle regex-source matching.
path = 'test-harness/firebase-module-retry-v255.test.mjs'
p = ROOT / path
before = p.read_text(encoding='utf-8')
text = before
old_start = "test('Ver.255 audit keeps the formal product release at Ver.251', () => {"
start = text.find(old_start)
if start >= 0:
    end = text.find("\ntest('Firebase loader clears", start)
    if end < 0:
        raise SystemExit('v255 static release boundary missing')
    text = text[:start] + "test('Ver.252 product publishes the Firebase module retry hardening release', () => {\n  assert.match(read('release-manifest.js'), /const VERSION = '252'/);\n});\n" + text[end+1:]
elif "Ver.252 product publishes the Firebase module retry hardening release" not in text:
    raise SystemExit('v255 static release test drifted')

old_title = "test('Firebase loader clears its JS promise cache but reuses the same module specifiers after failure', () => {"
start = text.find(old_title)
if start >= 0:
    end = text.find("\ntest('reaction import failure", start)
    if end < 0:
        raise SystemExit('v255 static loader boundary missing')
    replacement = '''test('Firebase loader changes only the retry module specifier after an import failure', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncFunctionBlock(source, 'firebase', 'showMessage');
  assert.match(source, /let firebaseImportRetry = 0/);
  assert.match(block, /const importRetry = firebaseImportRetry/);
  assert.match(block, /retrySuffix = importRetry > 0/);
  assert.match(block, /firebase-app\\.js\\$\\{retrySuffix\\}/);
  assert.match(block, /firebase-database\\.js\\$\\{retrySuffix\\}/);
  assert.match(block, /firebaseImportRetry === importRetry/);
  assert.match(block, /firebaseImportRetry \\+= 1/);
  assert.match(block, /if \\(firebasePromise === pending\\) firebasePromise = null/);
});
'''
    text = text[:start] + replacement + text[end+1:]
elif "Firebase loader changes only the retry module specifier" not in text:
    raise SystemExit('v255 static loader test drifted')
write_if_changed(path, before, text)

# Historical 251 contracts remain valid after the next product release.
for path in ['test-harness/comment-reaction-offline-v253.test.mjs', 'test-harness/reaction-reconnect-v254.test.mjs']:
    p = ROOT / path
    before = p.read_text(encoding='utf-8')
    text = before.replace("assert.match(manifest, /const VERSION = '251'/);", "assert.match(manifest, /const VERSION = '(?:251|252)'/);")
    text = text.replace("assert.match(manifest, /version:\\s*\"251\"/);", "assert.match(manifest, /version:\\s*\"(?:251|252)\"/);")
    write_if_changed(path, before, text)

# Formal release bump; asset inventory is unchanged.
path = 'release-manifest.js'
p = ROOT / path
before = p.read_text(encoding='utf-8')
text = before
if "const VERSION = '251'" in text:
    text = text.replace('251', '252')
elif "const VERSION = '252'" not in text:
    raise SystemExit('manifest version drifted')
write_if_changed(path, before, text)

# Ledger records both the discovered browser boundary and the product repair.
path = 'patch-responsibilities.json'
p = ROOT / path
before = p.read_text(encoding='utf-8')
data = json.loads(before)
data['baselineRelease'] = '252'
group = next((g for g in data.get('groups', []) if g.get('id') == 'user-and-comments'), None)
if not group:
    raise SystemExit('user-and-comments group missing')
if 'Ver.255監査では' not in group.get('reason', ''):
    group['reason'] += (' Ver.255監査では、Firebase browser moduleの初回取得失敗後にJavaScript側のfirebasePromiseを破棄しても、ChromiumのES Module mapが失敗した同一specifierを保持するため、同一ページの次回リアクション操作ではnetwork再取得自体が行われず回復できないことをBrowserで固定した。失敗操作はrevision・reaction・remote stateを変更せずbusy解除とcontrol再有効化まで成立する。 Ver.252製品では初回は従来のFirebase CDN URLを維持し、module import失敗時だけretry generationを進め、次回操作では?wb-retry=<連番>を付与した別specifierで再取得する。初期化後エラーではgenerationを進めず、firebasePromise single-flight、Ver.249 expected-base transaction、非online guard、ghost state防止を維持する。')
data['priorityCandidates'] = [{
    'order': 1,
    'scope': ['comment-reactions-v191.js'],
    'goal': 'Ver.256監査：Firebase module再試行時のsingle-flight／二重初期化境界。transient import失敗後にreactionとreply等の近接操作が再試行しても同一retry generationではfirebasePromiseを共有し、initializeApp・getDatabaseの二重初期化や二重transactionを起こさず、各expected-base意味論を維持するかをProtocol・Browser・Firebase Emulatorで確認する。監査段階では製品runtimeを変更しない。',
    'precondition': 'Ver.252製品のPR Regressionがgreenでmerge済み、main RegressionとPagesがgreen、release manifest / baselineReleaseが252で一致していること。'
}]
after = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
write_if_changed(path, before, after)

print('changed' if changed else 'already-applied')
