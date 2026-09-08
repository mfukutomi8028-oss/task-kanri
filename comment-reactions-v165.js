// Ver.165: lightweight reactions for task comments.
(function installCommentReactionsV165() {
  const REACTIONS = [
    { emoji: "👍", label: "了解・賛同" },
    { emoji: "✅", label: "確認・対応済み" },
    { emoji: "👀", label: "確認中・見ています" },
    { emoji: "🙏", label: "ありがとう・お願いします" },
    { emoji: "🎉", label: "完了・お疲れさま" }
  ];
  const ALLOWED = new Set(REACTIONS.map(item => item.emoji));
  const FIREBASE_VERSION = "10.12.5";
  const busy = new Set();
  let patchTimer = 0;
  let firebasePromise = null;

  function sanitizeRoomId(value) {
    return String(value || "default").replace(/[.#$/\[\]]/g, "-").slice(0, 60);
  }

  function roomId() {
    const query = new URLSearchParams(location.search).get("room");
    return sanitizeRoomId(query || localStorage.getItem("systemTaskRoomId") || "default");
  }

  function currentUser() {
    const select = document.getElementById("currentUserSelect");
    return String(select?.value || localStorage.getItem("systemTaskUser") || "").normalize("NFKC").replace(/\s+/g, "").slice(0, 12);
  }

  function tasksCacheKey() {
    return `system-task-tasks:${roomId()}`;
  }

  function readCachedTasks() {
    try {
      const value = JSON.parse(localStorage.getItem(tasksCacheKey()) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeCachedTask(taskId, record) {
    if (!record) return;
    try {
      const tasks = readCachedTasks();
      const index = tasks.findIndex(item => String(item?.id || "") === taskId);
      const next = { id: taskId, ...record };
      if (index >= 0) tasks[index] = next;
      else tasks.unshift(next);
      localStorage.setItem(tasksCacheKey(), JSON.stringify(tasks));
    } catch {}
  }

  function detailTaskId() {
    const detail = document.getElementById("detailBody");
    const key = detail?.querySelector?.('[data-action="delete"]')?.dataset?.operationKey || "";
    return key.startsWith("task-delete:") ? key.slice(12) : "";
  }

  function normalizeReactionUsers(value) {
    const source = Array.isArray(value) ? value : Object.values(value && typeof value === "object" ? value : {});
    const result = [];
    source.forEach(item => {
      const user = String(item || "").normalize("NFKC").replace(/\s+/g, "").slice(0, 12);
      if (user && !result.includes(user)) result.push(user);
    });
    return result;
  }

  function reactionMap(comment) {
    const input = comment?.reactions && typeof comment.reactions === "object" ? comment.reactions : {};
    const output = {};
    REACTIONS.forEach(({ emoji }) => {
      const users = normalizeReactionUsers(input[emoji]);
      if (users.length) output[emoji] = users;
    });
    return output;
  }

  function sortedComments(task) {
    return [...(Array.isArray(task?.comments) ? task.comments : [])]
      .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
  }

  function createChip(commentId, emoji, users, user) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "comment-reaction-chip-v165";
    button.dataset.commentReactionId = commentId;
    button.dataset.commentReactionEmoji = emoji;
    button.setAttribute("aria-pressed", users.includes(user) ? "true" : "false");
    button.title = users.length ? `${users.join("、")}：${emoji}` : `${emoji} を追加`;
    button.append(document.createTextNode(emoji));
    if (users.length) {
      const count = document.createElement("span");
      count.textContent = String(users.length);
      button.append(count);
    }
    return button;
  }

  function createPicker(commentId) {
    const picker = document.createElement("div");
    picker.className = "comment-reaction-picker-v165";
    picker.hidden = true;
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "リアクションを選択");
    REACTIONS.forEach(({ emoji, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "comment-reaction-choice-v165";
      button.dataset.commentReactionId = commentId;
      button.dataset.commentReactionEmoji = emoji;
      button.title = label;
      button.setAttribute("aria-label", `${emoji} ${label}`);
      button.textContent = emoji;
      picker.append(button);
    });
    return picker;
  }

  function buildReactionUi(comment) {
    const commentId = String(comment?.id || "");
    if (!commentId) return null;
    const user = currentUser();
    const map = reactionMap(comment);
    const wrap = document.createElement("div");
    wrap.className = "comment-reactions-v165";
    wrap.dataset.commentReactionsFor = commentId;

    const chips = document.createElement("div");
    chips.className = "comment-reaction-chips-v165";
    REACTIONS.forEach(({ emoji }) => {
      const users = map[emoji] || [];
      if (users.length) chips.append(createChip(commentId, emoji, users, user));
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "comment-reaction-add-v165";
    add.dataset.commentReactionPicker = commentId;
    add.setAttribute("aria-expanded", "false");
    add.textContent = "＋ リアクション";

    const picker = createPicker(commentId);
    wrap.append(chips, add, picker);
    return wrap;
  }

  function patch() {
    const detail = document.getElementById("detailBody");
    if (!detail || detail.classList.contains("empty")) return;
    const taskId = detailTaskId();
    if (!taskId) return;
    const task = readCachedTasks().find(item => String(item?.id || "") === taskId);
    if (!task) return;
    const comments = sortedComments(task);
    const nodes = [...detail.querySelectorAll(".activity-comment")];
    nodes.forEach((node, index) => {
      const comment = comments[index];
      if (!comment?.id) return;
      const previous = node.querySelector(":scope > .comment-reactions-v165");
      const ui = buildReactionUi(comment);
      if (!ui) return;
      if (previous) previous.replaceWith(ui);
      else node.querySelector(":scope > .activity-text")?.insertAdjacentElement("afterend", ui);
    });
  }

  function schedulePatch(delay = 40) {
    if (patchTimer) clearTimeout(patchTimer);
    patchTimer = setTimeout(() => {
      patchTimer = 0;
      patch();
    }, delay);
  }

  async function firebase() {
    if (firebasePromise) return firebasePromise;
    firebasePromise = (async () => {
      if (!window.firebaseConfig) throw new Error("firebase-config-unavailable");
      const [appModule, databaseModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js`)
      ]);
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(window.firebaseConfig);
      return {
        db: databaseModule.getDatabase(app),
        ref: databaseModule.ref,
        runTransaction: databaseModule.runTransaction
      };
    })();
    return firebasePromise;
  }

  function showMessage(text, error = false) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.toggle("error", Boolean(error));
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => { toast.hidden = true; toast.classList.remove("error"); }, 2200);
  }

  async function toggleReaction(taskId, commentId, emoji) {
    if (!taskId || !commentId || !ALLOWED.has(emoji)) return;
    const user = currentUser();
    if (!user) return showMessage("現在のユーザーを選択してください", true);
    const operation = `${taskId}:${commentId}:${emoji}:${user}`;
    if (busy.has(operation)) return;
    busy.add(operation);
    document.querySelectorAll(`[data-comment-reaction-id="${CSS.escape(commentId)}"]`).forEach(button => { button.disabled = true; });

    try {
      const api = await firebase();
      let missing = false;
      const target = api.ref(api.db, `rooms/${roomId()}/tasks/${taskId}`);
      const result = await api.runTransaction(target, current => {
        if (!current || !Array.isArray(current.comments)) { missing = true; return; }
        const index = current.comments.findIndex(item => String(item?.id || "") === commentId);
        if (index < 0) { missing = true; return; }
        const comments = current.comments.map(item => item && typeof item === "object" ? { ...item } : item);
        const comment = { ...comments[index] };
        const reactions = comment.reactions && typeof comment.reactions === "object" ? { ...comment.reactions } : {};
        const users = normalizeReactionUsers(reactions[emoji]);
        const found = users.indexOf(user);
        if (found >= 0) users.splice(found, 1);
        else users.push(user);
        if (users.length) reactions[emoji] = users;
        else delete reactions[emoji];
        comment.reactions = reactions;
        comments[index] = comment;
        const revision = Number.isSafeInteger(Number(current.revision)) && Number(current.revision) >= 0 ? Number(current.revision) : 0;
        return { ...current, comments, revision: revision + 1 };
      }, { applyLocally: false });

      if (!result.committed || missing) throw new Error("reaction-conflict");
      writeCachedTask(taskId, result.snapshot?.val());
      schedulePatch(0);
    } catch (error) {
      console.warn("Comment reaction save failed", error);
      showMessage("リアクションを保存できませんでした。もう一度お試しください。", true);
    } finally {
      busy.delete(operation);
      document.querySelectorAll(`[data-comment-reaction-id="${CSS.escape(commentId)}"]`).forEach(button => { button.disabled = false; });
    }
  }

  function closePickers(except = null) {
    document.querySelectorAll(".comment-reaction-picker-v165:not([hidden])").forEach(picker => {
      if (picker === except) return;
      picker.hidden = true;
      picker.parentElement?.querySelector("[data-comment-reaction-picker]")?.setAttribute("aria-expanded", "false");
    });
  }

  function bindGlobalEvents() {
    document.addEventListener("click", event => {
      const pickerButton = event.target.closest("[data-comment-reaction-picker]");
      if (pickerButton) {
        event.preventDefault();
        event.stopPropagation();
        const wrap = pickerButton.closest(".comment-reactions-v165");
        const picker = wrap?.querySelector(".comment-reaction-picker-v165");
        if (!picker) return;
        const opening = picker.hidden;
        closePickers(picker);
        picker.hidden = !opening;
        pickerButton.setAttribute("aria-expanded", opening ? "true" : "false");
        return;
      }

      const reactionButton = event.target.closest("[data-comment-reaction-id][data-comment-reaction-emoji]");
      if (reactionButton) {
        event.preventDefault();
        event.stopPropagation();
        const taskId = detailTaskId();
        closePickers();
        toggleReaction(taskId, reactionButton.dataset.commentReactionId, reactionButton.dataset.commentReactionEmoji);
        return;
      }

      if (!event.target.closest(".comment-reactions-v165")) closePickers();
    }, true);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closePickers();
    });
  }

  function start() {
    const root = document.getElementById("detailBody");
    if (!root) return;
    new MutationObserver(mutations => {
      if (mutations.some(item => item.addedNodes.length || item.removedNodes.length)) schedulePatch();
    }).observe(root, { childList: true, subtree: true });
    bindGlobalEvents();
    schedulePatch(0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
