from pathlib import Path
import json

ROOT = Path('.')


def replace_once(path, old, new, label):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'tests/schedule-copy-v225.spec.mjs',
    'await page.addInitScript(({ room, source }) => {',
    'await page.addInitScript(({ room, source, extraSchedules }) => {',
    'browser test init-script args'
)
replace_once(
    'release-manifest.js',
    '// Ver.226 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。',
    '// Ver.227 のリリース正本。全配布資産と動的 loader はこの inventory を参照する。',
    'release manifest heading'
)

responsibility_path = ROOT / 'patch-responsibilities.json'
responsibility = json.loads(responsibility_path.read_text(encoding='utf-8'))
for candidate in responsibility.get('priorityCandidates', []):
    if 'schedule-today-lock-v129.js' in candidate.get('scope', []):
        candidate['goal'] = 'Ver.227コピーUX完了後、Schedule Today固定sidecarのapp.js統合可否を製品コード無変更の監査から再開する。'
        candidate['precondition'] = 'スケジュールコピーの日付生成・重複確認・Firebase書込モデルとは分離し、Today表示・anchor復元・7日間表記・復帰時補正を変更しないこと。'
        break
else:
    raise RuntimeError('schedule-today-lock priority candidate not found')
responsibility_path.write_text(json.dumps(responsibility, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Ver.227 correction pass applied successfully')
