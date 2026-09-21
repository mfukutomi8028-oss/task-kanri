from pathlib import Path
import json
import re


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source block, found {count}")
    return source.replace(old, new, 1)

manifest_path = Path('release-manifest.js')
manifest = manifest_path.read_text(encoding='utf-8')
for old, new, label in [
    ('// Ver.249 のリリース正本。', '// Ver.250 のリリース正本。', 'manifest header'),
    ('installFirstPaintGuardV249', 'installFirstPaintGuardV250', 'first paint function'),
    ("const VERSION = '249';", "const VERSION = '250';", 'manifest VERSION'),
    ("const bootClass = 'wb-first-paint-v249';", "const bootClass = 'wb-first-paint-v250';", 'boot class'),
    ("guardStyle.id = 'wb-first-paint-style-v249';", "guardStyle.id = 'wb-first-paint-style-v250';", 'guard style id'),
    ('version: "249"', 'version: "250"', 'release version'),
]:
    manifest = replace_once(manifest, old, new, label)
manifest_path.write_text(manifest, encoding='utf-8')

inventory_path = Path('patch-responsibilities.json')
inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
inventory['baselineRelease'] = '250'
group = next(item for item in inventory.get('groups', []) if item.get('id') == 'user-and-comments')
addition = ' Ver.250製品ではlocal-only返信をmarker文字列ではなくcanonical app writerへreplyTo datasetで委譲し、構造化replyToとして1件だけ保存する。directed replyではupdatedAt・updatedBy・lastChangeを更新せず全体お知らせ化を防ぎ、保存失敗時は本文と返信先を保持する。Firebase設定済みだがremote-onlineでない場合はsidecarがcanonical submitより前に送信を止め、draft消失を防ぐ。'
if addition.strip() not in group.get('reason', ''):
    group['reason'] = group.get('reason', '') + addition
inventory['priorityCandidates'] = [{
    'order': 1,
    'scope': ['comment-reactions-v191.js'],
    'goal': 'Ver.253監査ではコメントリアクションのlocal-only／remote-degraded境界を対象に、Firebase未設定時の操作可否、接続確認中の誤送信、draft・reaction表示整合性、再接続後の二重反映がないかをProtocol・Browserで確認する。監査段階では製品runtimeを変更しない。',
    'precondition': 'Ver.250オフライン返信製品がPR CI、merge後main Regression、Pagesまでgreenで、directed replyのlocal-only保存と非online draft保持が安全と確認されていること。'
}]
inventory_path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Old audit tests must not lock future releases to exactly 249.
for filename in [
    'test-harness/user-comment-boundary-v249.test.mjs',
    'test-harness/notification-idempotency-v250.test.mjs',
    'test-harness/comment-reply-boundary-v251.test.mjs',
]:
    path = Path(filename)
    source = path.read_text(encoding='utf-8')
    source = source.replace("assert.match(manifest, /const VERSION = '249'/);", "assert.match(manifest, /const VERSION = '(?:249|250)'/);")
    source = source.replace("assert.match(manifest, /VERSION\\s*=\\s*['\"]249['\"]/);", "assert.match(manifest, /VERSION\\s*=\\s*['\"](?:249|250)['\"]/);")
    path.write_text(source, encoding='utf-8')
