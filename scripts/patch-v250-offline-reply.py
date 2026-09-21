from pathlib import Path


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one source block, found {count}")
    return source.replace(old, new, 1)

app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")

old_submit = '''  $("commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("commentText").value.trim();
    const type = $("commentType").value;
    if (!text) return;
    await addComment(task.id, text, type);
    $("commentText").value = "";
  });'''
new_submit = '''  $("commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textarea = $("commentText");
    const text = textarea.value.trim();
    const type = $("commentType").value;
    if (!text) return;
    const replyTo = String(textarea.dataset.commentReplyTargetV250 || "").trim();
    const result = await addComment(task.id, text, type, { replyTo });
    if (!result?.ok) return;
    textarea.value = "";
    delete textarea.dataset.commentReplyTargetV250;
    if (replyTo) {
      document.dispatchEvent(new CustomEvent('workboard:local-reply-saved-v250', {
        detail: { taskId: task.id, replyTo }
      }));
    }
  });'''

old_add = '''async function addComment(id, text, type = "作業メモ") {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const draft = cloneTask(task);
  draft.comments = [...(draft.comments || []), { id: generateId(), author: getCurrentUser(), type, text, createdAt: Date.now() }];
  draft.lastChange = makeActivityChange(`${type}追加`, [`${type}: ${shortText(text, 48)}`], { summary: `${type}が追加されました` });
  draft.history = appendHistory(draft.history, `${type}を追加しました。`);
  draft.updatedAt = Date.now(); draft.updatedBy = getCurrentUser();
  const result = await persistTask(draft);
  if (!result.ok) showWriteFailure(result, `${type}を保存できませんでした。`);
}'''
new_add = '''async function addComment(id, text, type = "作業メモ", options = {}) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return { ok: false, error: 'not-found' };
  const body = String(text || '').trim();
  const requestedReplyTo = String(options?.replyTo || '').trim().slice(0, 120);
  const replyTo = state.connectionMode === 'local-only' ? requestedReplyTo : '';
  if (replyTo && !(task.comments || []).some(comment => String(comment?.id || '') === replyTo)) {
    const failure = { ok: false, error: 'revision-or-relation-mismatch' };
    showWriteFailure(failure, `${type}を保存できませんでした。`);
    return failure;
  }
  const draft = cloneTask(task);
  const comment = { id: generateId(), author: getCurrentUser(), type, text: body, createdAt: Date.now() };
  if (replyTo) comment.replyTo = replyTo;
  draft.comments = [...(draft.comments || []), comment];
  draft.history = appendHistory(draft.history, `${type}を追加しました。`);
  if (!replyTo) {
    draft.lastChange = makeActivityChange(`${type}追加`, [`${type}: ${shortText(body, 48)}`], { summary: `${type}が追加されました` });
    draft.updatedAt = Date.now();
    draft.updatedBy = getCurrentUser();
  }
  const result = await persistTask(draft);
  if (!result.ok) showWriteFailure(result, `${type}を保存できませんでした。`);
  return result;
}'''

app = replace_once(app, old_submit, new_submit, "comment submit handler")
app = replace_once(app, old_add, new_add, "addComment writer")
app_path.write_text(app, encoding="utf-8")

side_path = Path("comment-reactions-v191.js")
side = side_path.read_text(encoding="utf-8")
old_local = '''      // Explicit local-only mode stays writable. Delegate to the canonical app
      // writer using the compatibility marker; Ver.250 app.js converts it back
      // to a structured directed reply without task-wide update metadata churn.
      if (textarea) textarea.value = `[[wb-reply:${replyTarget.commentId}]] ${text}`;
      const targetId = replyTarget.commentId;
      setTimeout(() => {
        if (replyTarget?.commentId === targetId) cancelReply();
        schedulePatch(120);
      }, 0);
      return false;'''
new_local = '''      // Explicit local-only mode stays writable. Hand the directed parent to the
      // canonical app writer without embedding protocol markers into the body.
      if (textarea) textarea.dataset.commentReplyTargetV250 = replyTarget.commentId;
      return false;'''
side = replace_once(side, old_local, new_local, "local-only reply delegation")

old_start = '''    bindGlobalEvents();
    schedulePatch(0);'''
new_start = '''    bindGlobalEvents();
    document.addEventListener('workboard:local-reply-saved-v250', event => {
      const detail = event.detail || {};
      if (replyTarget?.taskId === String(detail.taskId || '') && replyTarget?.commentId === String(detail.replyTo || '')) {
        cancelReply();
      }
      schedulePatch(0);
    });
    schedulePatch(0);'''
side = replace_once(side, old_start, new_start, "local reply saved listener")
side_path.write_text(side, encoding="utf-8")
