import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function extract(start, end) {
  const begin = app.indexOf('function ' + start + '(');
  const finish = app.indexOf('function ' + end + '(', begin + 1);
  expect(begin, 'missing function ' + start).toBeGreaterThanOrEqual(0);
  expect(finish, 'missing following function ' + end).toBeGreaterThan(begin);
  return app.slice(begin, finish);
}

// Load only the date/holiday calculation into an isolated VM. Do not start the
// application, connect to Firebase, or touch users' saved schedules.
const holidaySource = extract('getNthMondayDayOfMonth', 'springEquinoxDay') +
  extract('springEquinoxDay', 'autumnEquinoxDay') +
  extract('autumnEquinoxDay', 'dueLabel');
const context = runInNewContext(`(() => {
  function toISODate(d) {
    return \`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}\`;
  }
  function parseISODate(v) {
    const d = new Date(v + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function addDays(d, amount) {
    const next = new Date(d);
    next.setDate(next.getDate() + amount);
    next.setHours(0, 0, 0, 0);
    return next;
  }
  ${holidaySource}
  return { getNthMondayDayOfMonth, getJapaneseHolidayName, buildJapaneseHolidayMap };
})()`);

function originalNthMonday(year, month, nth) {
  const first = new Date(year, month - 1, 1);
  const offset = (8 - first.getDay()) % 7;
  return 1 + offset + (nth - 1) * 7;
}
function iso(year, month, day) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

test('Ver.452: shared holiday Monday matches both former call sites for years 1900-2100', () => {
  expect(app.match(/function getNthMondayDayOfMonth\(/g)).toHaveLength(1);
  expect(app).not.toContain('const nthMonday =');
  for (let year = 1900; year <= 2100; year++) {
    for (const [month, nth, label] of [[1, 2, '成人の日'], [7, 3, '海の日'], [9, 3, '敬老の日'], [10, 2, 'スポーツの日']]) {
      const day = originalNthMonday(year, month, nth);
      expect(context.getNthMondayDayOfMonth(year, month, nth)).toBe(day);
      const holidayMap = context.buildJapaneseHolidayMap(year);
      expect(holidayMap[iso(year, month, day)]).toBe(label);
      expect(context.getJapaneseHolidayName(new Date(year, month - 1, day))).toBe(label);
    }
  }
});

test('Ver.452: holiday map remains stable across caching, substitute holidays and year boundaries', () => {
  for (const year of [1900, 1948, 1999, 2000, 2024, 2025, 2026, 2030, 2050, 2100]) {
    const first = context.buildJapaneseHolidayMap(year);
    const second = context.buildJapaneseHolidayMap(year);
    expect(second).toBe(first);
    expect(first[iso(year, 1, 1)]).toBe('元日');
    expect(first[iso(year, 5, 3)]).toBe('憲法記念日');
    expect(first[iso(year, 9, originalNthMonday(year, 9, 3))]).toBe('敬老の日');
  }
  expect(context.buildJapaneseHolidayMap(2026)['2026-05-06']).toBe('振替休日');
  expect(context.getJapaneseHolidayName(new Date(2026, 4, 6))).toBe('振替休日');
  expect(context.getJapaneseHolidayName(new Date(NaN))).toBe('');
  expect(context.getJapaneseHolidayName(null)).toBe('');
});
