from pathlib import Path
import re

path = Path('app.js')
text = path.read_text(encoding='utf-8')
pattern = re.compile(r"async function copyScheduleOccurrences\(source, dates\) \{[\s\S]*?\n\}\n\nasync function submitScheduleCopy\(\)")
replacement = '''async function copyScheduleOccurrences(source, dates) {
  const timestamp = Date.now();
  const items = dates.map((date, index) => scheduleCopyDraftForDate(source, date, generateScheduleId(), timestamp + index)).filter(Boolean);
  if (items.length !== dates.length) return { ok: false, error: "invalid-copy-date" };
  const affectedPaths = items.map(item => `rooms/${ROOM_ID}/schedules/${item.id}`);

  return executeWrite("schedule-copy", source.id, async () => {
    if (state.connectionMode === "local-only") {
      return transactionRoom(root => {
        const currentSource = root.schedules?.[source.id];
        if (!currentSource || normalizeRevision(currentSource.revision) !== normalizeRevision(source.revision)) throw new Error("conflict");
        root.schedules ||= {};
        for (const item of items) {
          if (root.schedules[item.id]) throw new Error("conflict");
          root.schedules[item.id] = { ...item, revision: 1 };
        }
        return root;
      }, affectedPaths);
    }

    // Schedule synchronization is collection-scoped, so keep this atomic copy
    // transaction on the same schedules collection instead of the whole room.
    // This preserves source revision checks without depending on an unwarmed
    // room-root transaction cache in a fresh remote session.
    await get(state.schedulesRef);
    let conflict = false;
    const remote = await runTransaction(state.schedulesRef, current => {
      const schedules = current && typeof current === "object" ? { ...current } : {};
      try {
        const currentSource = schedules[source.id];
        if (!currentSource || normalizeRevision(currentSource.revision) !== normalizeRevision(source.revision)) throw new Error("conflict");
        for (const item of items) {
          if (schedules[item.id]) throw new Error("conflict");
          schedules[item.id] = { ...item, revision: 1 };
        }
        return schedules;
      } catch (error) {
        conflict = error.message === "conflict";
        return;
      }
    });
    if (!remote.committed) throw new Error(conflict ? "revision-or-relation-mismatch" : "transaction-aborted-or-invariant-failure");

    const committedSchedules = remote.snapshot?.val() || {};
    const snapshot = { schedules: committedSchedules };
    applyCommittedResult({ snapshot, affectedPaths, mutationKind: "schedule-copy" });
    return { committed: true, snapshot, snapshotScope: "root", affectedPaths, mutationKind: "schedule-copy" };
  });
}

async function submitScheduleCopy()'''
updated, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'copyScheduleOccurrences block expected once, got {count}')
path.write_text(updated, encoding='utf-8')
