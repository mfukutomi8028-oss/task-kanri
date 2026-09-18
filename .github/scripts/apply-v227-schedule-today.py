from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    text = text.replace(old, new, 1)

replace_once(
'''  startScheduleReminderWatcher();
  showUserDialogIfNeeded();
  render();''',
'''  startScheduleReminderWatcher();
  installScheduleTodayLifecycle();
  showUserDialogIfNeeded();
  render();''',
'init lifecycle hook')

replace_once(
'''function renderScheduleView(schedules) {
  const rangeLabel = formatScheduleRangeLabel();''',
'''function renderScheduleView(schedules) {
  syncScheduleTodayAnchor();
  const rangeLabel = formatScheduleRangeLabel();''',
'render canonical anchor')

replace_once(
'''              <button type="button" class="schedule-range ${state.scheduleRange === "week" ? "active" : ""}" data-schedule-range="week">7日間</button>''',
'''              <button type="button" class="schedule-range ${state.scheduleRange === "week" ? "active" : ""}" data-schedule-range="week" title="今日から7日間を表示します">7日間</button>''',
'week title')

replace_once(
'''              <button type="button" class="schedule-range" data-schedule-move="prev">← 前へ</button>
              <button type="button" class="schedule-range" data-schedule-move="today">今日へ</button>
              <button type="button" class="schedule-range" data-schedule-move="next">次へ →</button>''',
'''              <button type="button" class="schedule-range" data-schedule-move="prev" ${state.scheduleRange === "today" ? 'disabled aria-disabled="true" title="「今日」表示中は移動できません"' : ''}>← 前へ</button>
              <button type="button" class="schedule-range" data-schedule-move="today">今日へ</button>
              <button type="button" class="schedule-range" data-schedule-move="next" ${state.scheduleRange === "today" ? 'disabled aria-disabled="true" title="「今日」表示中は移動できません"' : ''}>次へ →</button>''',
'Today movement controls')

replace_once(
'''      state.scheduleRange = button.dataset.scheduleRange;
      if (state.scheduleRange !== "month" && state.scheduleDisplayMode === "calendar") state.scheduleDisplayMode = "list";''',
'''      state.scheduleRange = button.dataset.scheduleRange;
      if (state.scheduleRange === "today") syncScheduleTodayAnchor();
      if (state.scheduleRange !== "month" && state.scheduleDisplayMode === "calendar") state.scheduleDisplayMode = "list";''',
'range selection normalization')

marker = '''function moveScheduleAnchor(direction) {
'''
helper = '''function syncScheduleTodayAnchor({ rerender = false } = {}) {
  if (state.scheduleRange !== "today") return false;
  const today = todayISO();
  if (state.scheduleAnchor === today) return false;
  state.scheduleAnchor = today;
  localStorage.setItem(scheduleAnchorKey(), state.scheduleAnchor);
  if (rerender) render();
  return true;
}

function installScheduleTodayLifecycle() {
  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === "schedule" });
  sync();
  window.addEventListener("pageshow", sync);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sync();
  });
  setInterval(sync, 60 * 1000);
}

function moveScheduleAnchor(direction) {
  if (state.scheduleRange === "today" && ["prev", "next"].includes(direction)) {
    syncScheduleTodayAnchor({ rerender: true });
    return;
  }
'''
replace_once(marker, helper, 'Today lifecycle helpers')

path.write_text(text, encoding='utf-8')
