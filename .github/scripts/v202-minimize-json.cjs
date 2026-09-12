const fs = require('fs');
const { execFileSync } = require('child_process');
const path = 'patch-responsibilities.json';
let s = execFileSync('git', ['show', 'origin/main:' + path], { encoding: 'utf8' });

function exact(from, to, label) {
  const count = s.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, got ${count}`);
  s = s.replace(from, to);
}

exact('"baselineRelease": "201"', '"baselineRelease": "202"', 'baseline');

const marker = 'Ver.201ではTodayの最終可視性契約を追加した監査で、toggleAttributeにより空値となるdata-v108-hidden markerとCSSの[data-v108-hidden=\\"true\\"] selectorの不一致を発見し、[data-v108-hidden]へ最小修正した。Today状態除外はstable/mobileでまだ重複し、mine/group判定はstable固有のため、次工程で重複所有のみを整理する。';
const replacement = 'Ver.201ではTodayの最終可視性契約を追加した監査で、toggleAttributeにより空値となるdata-v108-hidden markerとCSSの[data-v108-hidden=\\"true\\"] selectorの不一致を発見し、[data-v108-hidden]へ最小修正した。Ver.202でmobile側のToday状態除外・storage fallback・auto-hidden markerを退役し、状態除外とmine/groupを含む最終可視性をstable単独所有へ統一。';
exact(marker, replacement, 'legacy foundation reason');

const start = s.indexOf('  "priorityCandidates": [');
if (start < 0) throw new Error('priority start missing');
const end = s.lastIndexOf('\n}');
if (end < start) throw new Error('json end missing');
const priority = `  "priorityCandidates": [
    {
      "order": 1,
      "scope": ["mobile-fixes.js"],
      "goal": "Ver.202でToday重複を退役したため、次はschedule-today-lock-v129.jsとmobile-fixes.jsに残る7日間表示補正の重複を監査し、schedule側を正本としてmobile側補正を退役できるか確認する。モバイル状態タブ・ヘッダー・メニュー・body-wide Observerは同時に変更しない。",
      "precondition": "Ver.202のstatic contract 67件、通常ブラウザ67件、Firebase Emulator 19件がgreenで、release-manifestがVer.202、mainのRegressionとPagesが成功していること。"
    }
  ]`;
s = s.slice(0, start) + priority + s.slice(end);
JSON.parse(s);
fs.writeFileSync(path, s);
