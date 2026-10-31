// Production pilot: one Classic data owner, one read gate, no new Firebase or writer.
// Only the Classic parent can activate this route following an explicit user choice.
export function productionClassicOwnerV580(view) {
  try {
    const host = window.parent;
    if (!host || host === window || host.location.origin !== location.origin) return null;
    const gate = host.WorkBoardModernProductionV580;
    if (!gate || gate.allowRead(view, location.origin) !== true) return null;
    if (!['today','todos','tasks','schedules','memos'].includes(view)) return null;
    const mode = view === 'schedules' ? 'classic-actions' : 'readonly';
    if (document.body.dataset.modernProductionV580 !== mode) {
      document.body.dataset.modernProductionV580 = mode;
      const tag = document.querySelector('.preview-tag');
      if (tag) tag.textContent = '先行公開';
      const notice = document.querySelector('.readonly-mobile-note, .readonly-mobile-label');
      if (notice) notice.textContent = view === 'schedules'
        ? 'Modern v2先行公開：予定の追加・編集・繰り返しコピーはClassicの既存入力フォームを開きます。削除は確認後に処理します。'
        : 'Modern v2先行公開：閲覧・確認はこちら、追加や編集は「クラシックへ戻る」から操作してください。';
      document.title = document.title.replace(/読取専用検証|テストルーム検証|検証|読取専用/g, '先行公開');
    }
    return host;
  } catch {
    return null;
  }
}

export function readProductionClassicV580(view) {
  const host = productionClassicOwnerV580(view);
  if (!host) return null;
  try {
    const facade = host.WorkBoardReadV550;
    if (!facade || typeof facade.read !== 'function') return { ready:false, reason:'loading' };
    const snapshot = facade.read();
    if (!snapshot || typeof snapshot !== 'object'
      || (snapshot.ready && snapshot.roomId !== host.WorkBoardModernProductionV580.roomId)) {
      return { ready:false, reason:'invalid-snapshot' };
    }
    return snapshot;
  } catch {
    return { ready:false, reason:'invalid-owner-state' };
  }
}
