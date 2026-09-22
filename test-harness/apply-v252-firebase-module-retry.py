from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def replace_exact(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    return True

changed = False

# Runtime: use the stable URL on the first attempt, then a unique module specifier
# after an import failure so Chromium's failed module-map entry cannot poison the
# next in-page attempt. Initialization errors after successful imports do not bump
# the import retry generation.
p = ROOT / 'comment-reactions-v191.js'
text = p.read_text(encoding='utf-8')
old_header = '// Ver.251: task comment interactions. Reaction writes keep expected-base protection, block non-online writes, and retry Firebase initialization after transient failures.'
new_header = '// Ver.252: task comment interactions. Reaction writes keep expected-base protection, block non-online writes, and retry transient Firebase module failures with a fresh module specifier.'
if old_header in text:
    text = text.replace(old_header, new_header, 1)
    changed = True
elif new_header not in text:
    raise SystemExit('comment-reactions-v191.js: unexpected header')

old_decl = '  let firebasePromise = null;\n  let replyTarget = null;'
new_decl = '  let firebasePromise = null;\n  let firebaseImportRetry = 0;\n  let replyTarget = null;'
if old_decl in text:
    text = text.replace(old_decl, new_decl, 1)
    changed = True
elif new_decl not in text:
    raise SystemExit('comment-reactions-v191.js: firebase declarations drifted')

old_firebase = '''  async function firebase() {
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
new_firebase = '''  async function firebase() {
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
if old_firebase in text:
    text = text.replace(old_firebase, new_firebase, 1)
    changed = True
elif new_firebase not in text:
    raise SystemExit('comment-reactions-v191.js: firebase() block drifted')
p.write_text(text, encoding='utf-8')

# Browser regression: the first stable specifier fails; the second click must issue
# query-suffixed module requests and complete the expected-base transaction.
p = ROOT / 'tests/comment-reaction-firebase-retry-audit-v255.spec.mjs'
text = p.read_text(encoding='utf-8')
text2 = text.replace(
    "test('failed Firebase module specifiers stay cached in-page so a second reaction attempt cannot refetch, but no ghost state remains', async ({ page }) => {",
    "test('Ver.252 retries transient Firebase module failure with a fresh specifier and commits the second reaction attempt', async ({ page }) => {"
)
text2 = text2.replace(
    "  await page.route(APP_URL, async route => {",
    "  await page.route(/https:\\/\\/www\\.gstatic\\.com\\/firebasejs\\/10\\.12\\.5\\/firebase-app\\.js(?:\\?wb-retry=\\d+)?$/, async route => {"
)
text2 = text2.replace(
    "  await page.route(DB_URL, async route => {",
    "  await page.route(/https:\\/\\/www\\.gstatic\\.com\\/firebasejs\\/10\\.12\\.5\\/firebase-database\\.js(?:\\?wb-retry=\\d+)?$/, async route => {"
)
old_second = '''  await choice.evaluate(node => node.click());
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
new_second = '''  await choice.evaluate(node => node.click());
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
if old_second in text2:
    text2 = text2.replace(old_second, new_second, 1)
elif new_second not in text2:
    raise SystemExit('v255 browser test: second-attempt block drifted')
if text2 == text and 'Ver.252 retries transient Firebase module failure' not in text:
    raise SystemExit('v255 browser test: no expected changes applied')
if text2 != text:
    p.write_text(text2, encoding='utf-8')
    changed = True

# Static contract: publish Ver.252 and require retry generation/specifier semantics.
p = ROOT / 'test-harness/firebase-module-retry-v255.test.mjs'
text = p.read_text(encoding='utf-8')
text2 = text.replace(
    "test('Ver.255 audit keeps the formal product release at Ver.251', () => {\n  assert.match(read('release-manifest.js'), /const VERSION = '251'/);\n});",
    "test('Ver.252 product publishes the Firebase module retry hardening release', () => {\n  assert.match(read('release-manifest.js'), /const VERSION = '252'/);\n});"
)
old_loader_test = '''test('Firebase loader clears its JS promise cache but reuses the same module specifiers after failure', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncFunctionBlock(source, 'firebase', 'showMessage');
  assert.match(block, /if \\(firebasePromise\\) return firebasePromise/);
  assert.match(block, /const pending = \\(async \\(\\) => \\{/);
  assert.match(block, /import\\(`https:\\\/\\\\/www\\.gstatic\\.com\\/firebasejs\\/\\$\\{FIREBASE_VERSION\\}\\/firebase-app\\.js`\\)/);
  assert.match(block, /import\\(`https:\\\/\\\\/www\\.gstatic\\.com\\/firebasejs\\/\\$\\{FIREBASE_VERSION\\}\\/firebase-database\\.js`\\)/);
  assert.match(block, /firebasePromise = pending/);
  assert.match(block, /catch \\(error\\) \\{[\\s\\S]*if \\(firebasePromise === pending\\) firebasePromise = null;[\\s\\S]*throw error;/);
});'''
new_loader_test = '''test('Firebase loader keeps first-load URLs stable and changes only the retry specifier after an import failure', () => {
  const source = read('comment-reactions-v191.js');
  const block = asyncFunctionBlock(source, 'firebase', 'showMessage');
  assert.match(source, /let firebaseImportRetry = 0/);
  assert.match(block, /const importRetry = firebaseImportRetry/);
  assert.match(block, /const retrySuffix = importRetry > 0 \\? `\\?wb-retry=\\$\\{importRetry\\}` : ""/);
  assert.match(block, /firebase-app\\.js\\$\\{retrySuffix\\}/);
  assert.match(block, /firebase-database\\.js\\$\\{retrySuffix\\}/);
  assert.match(block, /catch \\(error\\) \\{[\\s\\S]*firebaseImportRetry === importRetry[\\s\\S]*firebaseImportRetry \\+= 1/);
  assert.match(block, /if \\(firebasePromise === pending\\) firebasePromise = null/);
});'''
if old_loader_test in text2:
    text2 = text2.replace(old_loader_test, new_loader_test, 1)
elif new_loader_test not in text2:
    raise SystemExit('v255 static test: loader contract drifted')
if text2 != text:
    p.write_text(text2, encoding='utf-8')
    changed = True

# Earlier release contracts remain valid after Ver.252; stop freezing future releases.
for path in ['test-harness/comment-reaction-offline-v253.test.mjs', 'test-harness/reaction-reconnect-v254.test.mjs']:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    text2 = text.replace("assert.match(manifest, /const VERSION = '251'/);", "assert.match(manifest, /const VERSION = '(?:251|252)'/);")
    text2 = text2.replace("assert.match(manifest, /version:\\s*\"251\"/);", "assert.match(manifest, /version:\\s*\"(?:251|252)\"/);")
    if text2 != text:
        p.write_text(text2, encoding='utf-8')
        changed = True

# Release manifest: no asset ownership change, only the formal release identifier.
p = ROOT / 'release-manifest.js'
text = p.read_text(encoding='utf-8')
if "const VERSION = '251'" in text:
    text = text.replace('251', '252')
    p.write_text(text, encoding='utf-8')
    changed = True
elif "const VERSION = '252'" not in text:
    raise SystemExit('release-manifest.js: unexpected version')

# Responsibility ledger: record audit + repair and advance to the next isolated audit.
p = ROOT / 'patch-responsibilities.json'
data = json.loads(p.read_text(encoding='utf-8'))
data['baselineRelease'] = '252'
group = next((item for item in data.get('groups', []) if item.get('id') == 'user-and-comments'), None)
if not group:
    raise SystemExit('patch-responsibilities.json: user-and-comments missing')
append = (' Ver.255監査では、Firebase browser moduleの初回取得失敗後にJavaScript側のfirebasePromiseを破棄しても、ChromiumのES Module mapが失敗した同一specifierを保持するため、同一ページの次回リアクション操作ではnetwork再取得自体が行われず回復できないことをBrowserで固定した。失敗操作はrevision・reaction・remote stateを変更せずbusy解除とcontrol再有効化まで成立する。 Ver.252製品では初回は従来のFirebase CDN URLを維持し、module import失敗時だけretry generationを進め、次回操作では?wb-retry=<連番>を付与した別specifierで再取得する。初期化後エラーではgenerationを進めず、firebasePromise single-flight、Ver.249 expected-base transaction、非online guard、ghost state防止を維持する。')
if 'Ver.255監査では' not in group.get('reason', ''):
    group['reason'] = group.get('reason', '') + append

data['priorityCandidates'] = [{
    'order': 1,
    'scope': ['comment-reactions-v191.js'],
    'goal': 'Ver.256監査：Firebase module再試行時のsingle-flight／二重初期化境界。transient import失敗後にreactionとreply等の近接操作が再試行しても同一retry generationではfirebasePromiseを共有し、initializeApp・getDatabaseの二重初期化や二重transactionを起こさず、各expected-base意味論を維持するかをProtocol・Browser・Firebase Emulatorで確認する。監査段階では製品runtimeを変更しない。',
    'precondition': 'Ver.252製品のPR Regressionがgreenでmerge済み、main RegressionとPagesがgreen、release manifest / baselineReleaseが252で一致していること。'
}]
new_json = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
if p.read_text(encoding='utf-8') != new_json:
    p.write_text(new_json, encoding='utf-8')
    changed = True

print('changed' if changed else 'already-applied')
