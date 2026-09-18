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
'''  startScheduleReminderWatcher();\n  showUserDialogIfNeeded();\n  render();''',
'''  startScheduleReminderWatcher();\n  installScheduleTodayLifecycle();\n  showUserDialogIfNeeded();\n  render();''',
'init lifecycle hook')

replace_once(
'''function renderScheduleView(schedules) {\n  const rangeLabel = formatScheduleRangeLabel();''',
'''function renderScheduleView(schedules) {\n  syncScheduleTodayAnchor();\n  const rangeLabel = formatScheduleRangeLabel();''',
'render canonical anchor')

replace_once(
'''              <button type=\\"button\\" class=\\"schedule-range ${state.scheduleRange === \\"week\\" ? \\"active\\" : \\"\\"}\\" data-schedule-range=\\"week\\">7日間</button>''',
'''              <button type=\\"button\\" class=\\"schedule-range ${state.scheduleRange === \\"week\\" ? \\"active\\" : \\"\\"}\\" data-schedule-range=\\"week\\" title=\\"今日から7日間を表示します\\">7日間</button>''',
'week title')

replace_once(
'''              <button type=\\"button\\" class=\\"schedule-range\\" data-schedule-move=\\"prev\\">← 前へ</button>\n              <button type=\\"button\\" class=\\"schedule-range\\" data-schedule-move=\\"today\\">今日へ</button>\n              <button type=\\"button\\" class=\\"schedule-range\\" data-schedule-move=\\"next\\">次へ →</button>''',
'''              <button type=\\"button\\" class=\\"schedule-range\\" data-schedule-move=\\"prev\\" ${state.scheduleRange === \\"today\\" ? 'disabled aria-disabled=\\"true\\" title=\\"「今日」表示中は移動できません\\"' : ''}>← 前へ</button>\n              <button type=\\"button\\" class=\\"schedule-range\\" data-schedule-move=\\"today\\">今日へ</button>\n              <button type=\\"button\\" class=\\"schedule-range\\" data-schedule-move=\\"next\\" ${state.scheduleRange === \\"today\\" ? 'disabled aria-disabled=\\"true\\" title=\\"「今日」表示中は移動できません\\"' : ''}>次へ →</button>''',
'Today movement controls')

replace_once(
'''      state.scheduleRange = button.dataset.scheduleRange;\n      if (state.scheduleRange !== \\"month\\" && state.scheduleDisplayMode === \\"calendar\\") state.scheduleDisplayMode = \\"list\\";''',
'''      state.scheduleRange = button.dataset.scheduleRange;\n      if (state.scheduleRange === \\"today\\") syncScheduleTodayAnchor();\n      if (state.scheduleRange !== \\"month\\" && state.scheduleDisplayMode === \\"calendar\\") state.scheduleDisplayMode = \\"list\\";''',
'range selection normalization')

marker = '''function moveScheduleAnchor(direction) {\n'''
helper = '''function syncScheduleTodayAnchor({ rerender = false } = {}) {\n  if (state.scheduleRange !== \\"today\\") return false;\n  const today = todayISO();\n  if (state.scheduleAnchor === today) return false;\n  state.scheduleAnchor = today;\n  localStorage.setItem(scheduleAnchorKey(), state.scheduleAnchor);\n  if (rerender) render();\n  return true;\n}\n\nfunction installScheduleTodayLifecycle() {\n  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === \\"schedule\\" });\n  sync();\n  window.addEventListener(\\"pageshow\\", sync);\n  window.addEventListener(\\"focus\\", sync);\n  document.addEventListener(\\"visibilitychange\\", () => {\n    if (!document.hidden) sync();\n  });\n  setInterval(sync, 60 * 1000);\n}\n\nfunction moveScheduleAnchor(direction) {\n  if (state.scheduleRange === \\"today\\" && [\\"prev\\", \\"next\\"].includes(direction)) {\n    syncScheduleTodayAnchor({ rerender: true });\n    return;\n  }\n'''
replace_once(marker, helper, 'Today lifecycle helpers')

path.write_text(text, encoding='utf-8')
