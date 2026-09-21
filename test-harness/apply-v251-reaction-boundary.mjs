import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceExact(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: target not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: target is not unique`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

{
  const path = 'comment-reactions-v191.js';
  let source = read(path);
  source = replaceExact(
    source,
    '// Ver.250: task comment interactions. Reaction writes keep expected-base protection; reply fallback preserves drafts until a writable mode is available.',
    '// Ver.251: task comment interactions. Reaction writes keep expected-base protection, block non-online writes, and retry Firebase initialization after transient failures.',
    'comment header'
  );

  const firebaseBefore = `  async function firebase() {\n    if (firebasePromise) return firebasePromise;\n    firebasePromise = (async () => {\n      if (!window.firebaseConfig) throw new Error("firebase-config-unavailable");\n      const [appModule, databaseModule] = await Promise.all([\n        import(\`https://www.gstatic.com/firebasejs/\${FIREBASE_VERSION}/firebase-app.js\`),\n        import(\`https://www.gstatic.com/firebasejs/\${FIREBASE_VERSION}/firebase-database.js\`)\n      ]);\n      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(window.firebaseConfig);\n      return {\n        db: databaseModule.getDatabase(app),\n        ref: databaseModule.ref,\n        runTransaction: databaseModule.runTransaction\n      };\n    })();\n    return firebasePromise;\n  }`;
  const firebaseAfter = `  async function firebase() {\n    if (firebasePromise) return firebasePromise;\n    const pending = (async () => {\n      if (!window.firebaseConfig) throw new Error("firebase-config-unavailable");\n      const [appModule, databaseModule] = await Promise.all([\n        import(\`https://www.gstatic.com/firebasejs/\${FIREBASE_VERSION}/firebase-app.js\`),\n        import(\`https://www.gstatic.com/firebasejs/\${FIREBASE_VERSION}/firebase-database.js\`)\n      ]);\n      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(window.firebaseConfig);\n      return {\n        db: databaseModule.getDatabase(app),\n        ref: databaseModule.ref,\n        runTransaction: databaseModule.runTransaction\n      };\n    })();\n    firebasePromise = pending;\n    try {\n      return await pending;\n    } catch (error) {\n      if (firebasePromise === pending) firebasePromise = null;\n      throw error;\n    }\n  }`;
  source = replaceExact(source, firebaseBefore, firebaseAfter, 'firebase loader');

  const toggleBefore = `    const user = currentUser();\n    if (!user) return showMessage("現在のユーザーを選択してください", true);\n    const operation = \`\${taskId}:\${commentIdValue}:\${emoji}:\${user}\`;`;
  const toggleAfter = `    const user = currentUser();\n    if (!user) return showMessage("現在のユーザーを選択してください", true);\n    if (!window.firebaseConfig) {\n      showMessage("リアクションは共同編集ONで利用できます。", true);\n      return;\n    }\n    if (!isRemoteOnline()) {\n      showMessage("共同データを保存できる状態ではありません。リアクションは変更していません。", true);\n      return;\n    }\n    const operation = \`\${taskId}:\${commentIdValue}:\${emoji}:\${user}\`;`;
  source = replaceExact(source, toggleBefore, toggleAfter, 'reaction writable guard');
  write(path, source);
}

{
  const path = 'release-manifest.js';
  let source = read(path);
  const replacements = [
    ['// Ver.250 のリリース正本。', '// Ver.251 のリリース正本。'],
    ['installFirstPaintGuardV250', 'installFirstPaintGuardV251'],
    ["const VERSION = '250';", "const VERSION = '251';"],
    ['wb-first-paint-v250', 'wb-first-paint-v251'],
    ['wb-first-paint-style-v250', 'wb-first-paint-style-v251'],
    ['__WB_LEGACY_ICON_OBSERVER_V250__', '__WB_LEGACY_ICON_OBSERVER_V251__'],
    ['version: "250"', 'version: "251"']
  ];
  for (const [before, after] of replacements) source = replaceExact(source, before, after, `manifest ${before}`);
  write(path, source);
}

{
  const path = 'patch-responsibilities.json';
  const inventory = JSON.parse(read(path));
  if (inventory.baselineRelease !== '250') throw new Error(`unexpected baselineRelease: ${inventory.baselineRelease}`);
  inventory.baselineRelease = '251';
  const group = inventory.groups?.find(item => item.id === 'user-and-comments');
  if (!group) throw new Error('user-and-comments group not found');
  const note = 'Ver.251製品ではVer.253監査で確認した接続境界を修正し、リアクションはFirebase未設定のlocal-onlyでは共同編集ONが必要と明示してno-op、Firebase設定済みでも共同編集ON表示でないloading/degraded時はtransactionへ入らずno-opとした。オンライン時のVer.249 expected-base transactionは維持し、Firebase SDK初期化が失敗した場合はcached promiseを破棄して同一ページの次回操作で再試行できる。';
  if (!String(group.reason || '').includes('Ver.251製品ではVer.253監査')) group.reason = `${String(group.reason || '').trim()} ${note}`.trim();
  inventory.priorityCandidates = [{
    order: 1,
    scope: ['comment-reactions-v191.js'],
    goal: 'Ver.254監査ではリアクションの接続復帰直後境界を対象に、degraded/loadingから共同編集ONへ戻った後も描画済みexpected stateとserver currentの不一致がVer.249 conflict保護で安全に収束し、二重反映・誤通知・ghost reactionを起こさないことをProtocol・Browser・Firebase Emulatorで確認する。監査段階では製品runtimeを変更しない。',
    precondition: 'Ver.251リアクション接続境界製品がPR CI、merge後main Regression、Pagesまでgreenで、非online no-opとFirebase loader再試行契約が固定されていること。'
  }];
  write(path, `${JSON.stringify(inventory, null, 2)}\n`);
}

{
  const path = 'test-harness/comment-reply-offline-v252.test.mjs';
  let source = read(path);
  source = replaceExact(
    source,
    "  assert.match(manifest, /const VERSION = '250'/);",
    "  const release = Number(manifest.match(/const VERSION = '(\\d+)'/)?.[1] || 0);\n  assert.ok(release >= 250, `offline reply hardening must remain in release >= 250, got ${release}`);",
    'Ver.250 historical release assertion'
  );
  write(path, source);
}

console.log('Ver.251 reaction connection-boundary patch applied successfully.');
