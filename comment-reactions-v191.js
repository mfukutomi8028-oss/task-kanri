// Ver.215: task comment interactions. Reactions and one-level threaded replies share comment-id based ownership.
(function installCommentInteractionsV215() {
  const REACTIONS = [
    { emoji: "👍", label: "了解・賛同" },
    { emoji: "✅", label: "確認・対応済み" },
    { emoji: "👀", label: "確認中・見ています" },
    { emoji: "🙏", label: "ありがとう・お願いします" },
    { emoji: "🎉", label: "完了・お疲れさま" }
  ];
  const ALLOWED = new Set(REACTIONS.map(item => item.emoji));
  const FIREBASE_VERSION = "10.12.5";
  const LOCAL_REPLY_PREFIX = "[[wb-reply:";
  const busy = new Set();
  let patchTimer = 0;
  let firebasePromise = null;
  let replyTarget = null;

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

  function decodeReply(comment) {
    const rawText = String(comment?.text || "");
    const direct = String(comment?.replyTo || "").trim();
    if (direct) return { replyTo: direct, text: rawText };
    const match = rawText.match(/^\[\[wb-reply:([A-Za-z0-9_-]{1,120})\]\]\s*/);
    return match ? { replyTo: match[1], text: rawText.slice(match[0].length) } : { replyTo: "", text: rawText };
  }

  function commentId(comment) {
    return String(comment?.id || "");
  }

  function commentsForTask(task) {
    return [...(Array.isArray(task?.comments) ? task.comments : [])]
      .filter(comment => comment && typeof comment === "object" && commentId(comment))
      .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
  }

  function commentMap(task) {
    return new Map(commentsForTask(task).map(comment => [commentId(comment), comment]));
  }

  function reactionSignature(comment, user = currentUser()) {
    const map = reactionMap(comment);
    return `${commentId(comment)}|${user}|${REACTIONS.map(({ emoji }) => `${emoji}:${(map[emoji] || []).join(",")}`).join("|")}`;
  }

  function createChip(commentIdValue, emoji, users, user) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "comment-reaction-chip-v165";
    button.dataset.commentReactionId = commentIdValue;
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

  function createPicker(commentIdValue) {
    const picker = document.createElement("div");
    picker.className = "comment-reaction-picker-v165";
    picker.hidden = true;
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "リアクションを選択");
    REACTIONS.forEach(({ emoji, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "comment-reaction-choice-v165";
      button.dataset.commentReactionId = commentIdValue;
      button.dataset.commentReactionEmoji = emoji;
      button.title = label;
      button.setAttribute("aria-label", `${emoji} ${label}`);
      button.textContent = emoji;
      picker.append(button);
    });
    return picker;
  }

  function buildReactionUi(comment) {
    const id = commentId(comment);
    if (!id) return null;
    const user = currentUser();
    const map = reactionMap(comment);
    const wrap = document.createElement("div");
    wrap.className = "comment-reactions-v165";
    wrap.dataset.commentReactionsFor = id;
    wrap.dataset.reactionSignature = reactionSignature(comment, user);

    const chips = document.createElement("div");
    chips.className = "comment-reaction-chips-v165";
    REACTIONS.forEach(({ emoji }) => {
      const users = map[emoji] || [];
      if (users.length) chips.append(createChip(id, emoji, users, user));
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "comment-reaction-add-v165";
    add.dataset.commentReactionPicker = id;
    add.setAttribute("aria-expanded", "false");
    add.textContent = "＋ リアクション";

    const picker = createPicker(id);
    wrap.append(chips, add, picker);
    return wrap;
  }

  function getCommentFeed(detail) {
    return detail?.querySelector('.task-comments-panel-v149 .history-list, .activity-comments-panel .history-list');
  }

  function assignCommentIds(feed, comments) {
    const nodes = [...feed.querySelectorAll('.activity-comment')];
    const unassigned = nodes.filter(node => !node.dataset.commentId);
    const unused = comments.filter(comment => !feed.querySelector(`.activity-comment[data-comment-id="${CSS.escape(commentId(comment))}"]`));
    if (unassigned.length === unused.length) {
      unassigned.forEach((node, index) => { node.dataset.commentId = commentId(unused[index]); });
    } else if (nodes.length === comments.length && nodes.every(node => !node.dataset.commentId)) {
      nodes.forEach((node, index) => { node.dataset.commentId = commentId(comments[index]); });
    }
  }

  function patchReactionUi(node, comment) {
    const expectedSignature = reactionSignature(comment);
    const previous = node.querySelector(":scope > .comment-reactions-v165");
    if (previous?.dataset.reactionSignature === expectedSignature) return;
    const ui = buildReactionUi(comment);
    if (!ui) return;
    if (previous) previous.replaceWith(ui);
    else node.querySelector(":scope > .activity-text")?.insertAdjacentElement("afterend", ui);
  }

  function rootIdFor(comment, map) {
    let current = comment;
    const visited = new Set();
    for (let depth = 0; depth < 8; depth += 1) {
      const id = commentId(current);
      if (!id || visited.has(id)) return commentId(comment);
      visited.add(id);
      const parentId = decodeReply(current).replyTo;
      if (!parentId || !map.has(parentId)) return id;
      current = map.get(parentId);
    }
    return commentId(comment);
  }

  function makeReplyAction(comment, repliesCount = 0) {
    const id = commentId(comment);
    const row = document.createElement('div');
    row.className = 'comment-thread-actions-v215';
    row.dataset.replyActionSignatureV215 = `${id}:${repliesCount}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'comment-reply-button-v215';
    button.dataset.commentReplyTarget = id;
    button.setAttribute('aria-label', `${String(comment?.author || 'コメント')}へ返信`);
    button.textContent = '返信';
    row.append(button);
    if (repliesCount > 0) {
      const count = document.createElement('span');
      count.className = 'comment-reply-count-v215';
      count.textContent = `返信 ${repliesCount}件`;
      row.append(count);
    }
    return row;
  }

  function patchCommentNode(node, comment, map, repliesCount = 0) {
    const id = commentId(comment);
    node.dataset.commentId = id;
    node.classList.toggle('comment-reply-item-v215', Boolean(decodeReply(comment).replyTo));
    const actionSignature = `${id}:${repliesCount}`;
    const oldAction = node.querySelector(':scope > .comment-thread-actions-v215');
    if (oldAction?.dataset.replyActionSignatureV215 !== actionSignature) {
      const action = makeReplyAction(comment, repliesCount);
      if (oldAction) oldAction.replaceWith(action);
      else node.append(action);
    }

    const reply = decodeReply(comment);
    let quote = node.querySelector(':scope > .comment-reply-context-v215');
    if (reply.replyTo) {
      const parent = map.get(reply.replyTo);
      const parentText = decodeReply(parent || {}).text;
      const preview = shortPreview(parentText, 58);
      const contextSignature = `${reply.replyTo}|${String(parent?.author || '')}|${preview}`;
      if (!quote) {
        quote = document.createElement('div');
        quote.className = 'comment-reply-context-v215';
        const text = node.querySelector(':scope > .activity-text');
        if (text) node.insertBefore(quote, text);
        else node.prepend(quote);
      }
      if (quote.dataset.replyContextSignatureV215 !== contextSignature) {
        quote.dataset.replyContextSignatureV215 = contextSignature;
        quote.innerHTML = `<strong>${escapeHtml(String(parent?.author || '元コメント'))}</strong><span>${escapeHtml(preview)}</span>`;
      }
    } else if (quote) {
      quote.remove();
    }

    if (!comment.replyTo && reply.replyTo && String(comment.text || '').startsWith(LOCAL_REPLY_PREFIX)) {
      const textNode = node.querySelector(':scope > .activity-text');
      if (textNode && textNode.textContent !== reply.text) textNode.textContent = reply.text;
    }

    patchReactionUi(node, comment);
  }

  function shortPreview(value, max = 72) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function patchThreads(detail, task) {
    const feed = getCommentFeed(detail);
    if (!feed) return;
    const comments = commentsForTask(task);
    if (!comments.length) return;
    assignCommentIds(feed, comments);

    const map = new Map(comments.map(comment => [commentId(comment), comment]));
    const nodeMap = new Map([...feed.querySelectorAll('.activity-comment[data-comment-id]')].map(node => [node.dataset.commentId, node]));
    if (!nodeMap.size) return;

    const roots = [];
    const repliesByRoot = new Map();
    comments.forEach(comment => {
      const reply = decodeReply(comment);
      const rootId = reply.replyTo && map.has(reply.replyTo) ? rootIdFor(comment, map) : commentId(comment);
      if (rootId === commentId(comment)) roots.push(comment);
      else {
        const list = repliesByRoot.get(rootId) || [];
        list.push(comment);
        repliesByRoot.set(rootId, list);
      }
    });
    repliesByRoot.forEach(list => list.sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0)));

    const structureSignature = comments.map(comment => `${commentId(comment)}>${decodeReply(comment).replyTo}`).join('|');
    const alreadyThreaded = feed.dataset.commentThreadSignatureV215 === structureSignature
      && feed.querySelectorAll('.comment-thread-v215').length > 0
      && nodeMap.size === comments.length;

    if (alreadyThreaded) {
      roots.forEach(root => {
        const node = nodeMap.get(commentId(root));
        if (node) patchCommentNode(node, root, map, (repliesByRoot.get(commentId(root)) || []).length);
      });
      repliesByRoot.forEach(replies => replies.forEach(reply => {
        const node = nodeMap.get(commentId(reply));
        if (node) patchCommentNode(node, reply, map, 0);
      }));
      return;
    }

    const used = new Set();
    const fragment = document.createDocumentFragment();
    roots.forEach(root => {
      const rootId = commentId(root);
      const rootNode = nodeMap.get(rootId);
      if (!rootNode) return;
      used.add(rootId);
      const replies = repliesByRoot.get(rootId) || [];
      patchCommentNode(rootNode, root, map, replies.length);
      const thread = document.createElement('section');
      thread.className = 'comment-thread-v215';
      thread.dataset.threadRoot = rootId;
      thread.append(rootNode);
      if (replies.length) {
        const replyList = document.createElement('div');
        replyList.className = 'comment-reply-list-v215';
        replyList.setAttribute('aria-label', `${String(root?.author || 'コメント')}への返信`);
        replies.forEach(reply => {
          const replyId = commentId(reply);
          const node = nodeMap.get(replyId);
          if (!node) return;
          used.add(replyId);
          patchCommentNode(node, reply, map, 0);
          replyList.append(node);
        });
        if (replyList.childElementCount) thread.append(replyList);
      }
      fragment.append(thread);
    });

    comments.forEach(comment => {
      const id = commentId(comment);
      if (used.has(id)) return;
      const node = nodeMap.get(id);
      if (!node) return;
      patchCommentNode(node, comment, map, 0);
      const thread = document.createElement('section');
      thread.className = 'comment-thread-v215 comment-thread-orphan-v215';
      thread.dataset.threadRoot = id;
      thread.append(node);
      fragment.append(thread);
    });

    feed.replaceChildren(fragment);
    feed.dataset.commentThreadSignatureV215 = structureSignature;
  }

  function patchComposer(detail, task) {
    const form = detail.querySelector('.task-comments-panel-v149 .comment-form, #commentForm');
    if (!form) return;
    const textarea = form.querySelector('textarea');
    if (!textarea) return;
    textarea.placeholder = replyTarget?.taskId === String(task?.id || '') ? '返信内容を入力' : '対応状況や申し送りを入力';
    textarea.dataset.commentReplyComposerV215 = 'true';

    let hint = form.querySelector('.comment-submit-hint-v215');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'comment-submit-hint-v215';
      hint.textContent = 'Ctrl / ⌘ + Enterで送信';
      form.append(hint);
    }

    const compose = form.closest('.task-comment-compose-v149') || form.parentElement;
    if (!compose) return;
    let banner = compose.querySelector(':scope > .comment-reply-compose-v215');
    const active = replyTarget?.taskId === String(task?.id || '');
    if (!active) {
      banner?.remove();
      return;
    }
    const target = commentMap(task).get(replyTarget.commentId);
    if (!target) {
      cancelReply();
      banner?.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'comment-reply-compose-v215';
      compose.insertBefore(banner, form);
    }
    const preview = shortPreview(decodeReply(target).text, 88);
    const bannerSignature = `${commentId(target)}|${String(target.author || '')}|${preview}`;
    if (banner.dataset.replyComposeSignatureV215 !== bannerSignature) {
      banner.dataset.replyComposeSignatureV215 = bannerSignature;
      banner.innerHTML = `<div><small>REPLY</small><strong>${escapeHtml(String(target.author || 'コメント'))}さんへ返信</strong><span>${escapeHtml(preview)}</span></div><button type="button" data-cancel-comment-reply-v215 aria-label="返信をキャンセル">×</button>`;
    }
  }

  function patch() {
    const detail = document.getElementById("detailBody");
    if (!detail || detail.classList.contains("empty")) return;
    const taskId = detailTaskId();
    if (!taskId) return;
    const task = readCachedTasks().find(item => String(item?.id || "") === taskId);
    if (!task) return;
    patchThreads(detail, task);
    patchComposer(detail, task);
  }

  function schedulePatch(delay = 40) {
    if (patchTimer) return;
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

  async function toggleReaction(taskId, commentIdValue, emoji) {
    if (!taskId || !commentIdValue || !ALLOWED.has(emoji)) return;
    const user = currentUser();
    if (!user) return showMessage("現在のユーザーを選択してください", true);
    const operation = `${taskId}:${commentIdValue}:${emoji}:${user}`;
    if (busy.has(operation)) return;
    busy.add(operation);
    document.querySelectorAll(`[data-comment-reaction-id="${CSS.escape(commentIdValue)}"]`).forEach(button => { button.disabled = true; });

    try {
      const api = await firebase();
      let missing = false;
      const target = api.ref(api.db, `rooms/${roomId()}/tasks/${taskId}`);
      const result = await api.runTransaction(target, current => {
        if (!current || !Array.isArray(current.comments)) { missing = true; return; }
        const index = current.comments.findIndex(item => String(item?.id || "") === commentIdValue);
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
      document.querySelectorAll(`[data-comment-reaction-id="${CSS.escape(commentIdValue)}"]`).forEach(button => { button.disabled = false; });
    }
  }

  function openReply(commentIdValue) {
    const taskId = detailTaskId();
    const task = readCachedTasks().find(item => String(item?.id || '') === taskId);
    const target = task ? commentMap(task).get(String(commentIdValue || '')) : null;
    if (!taskId || !target) return;
    replyTarget = { taskId, commentId: commentId(target) };
    schedulePatch(0);
    requestAnimationFrame(() => {
      const textarea = document.querySelector('#detailBody .task-comments-panel-v149 textarea, #detailBody #commentText');
      if (!textarea) return;
      textarea.dataset.allowProgrammaticFocusV156 = 'true';
      try { textarea.focus({ preventScroll: true }); } finally { delete textarea.dataset.allowProgrammaticFocusV156; }
    });
  }

  function cancelReply() {
    replyTarget = null;
    schedulePatch(0);
  }

  function generateReplyId() {
    if (globalThis.crypto?.randomUUID) return `reply-${crypto.randomUUID()}`;
    return `reply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function isRemoteOnline() {
    return Boolean(window.firebaseConfig) && String(document.getElementById('connectionPill')?.textContent || '').includes('共同編集ON');
  }

  async function saveRemoteReply(taskId, parentId, text, type) {
    const user = currentUser();
    if (!user) throw new Error('current-user-missing');
    const api = await firebase();
    let missing = false;
    const target = api.ref(api.db, `rooms/${roomId()}/tasks/${taskId}`);
    const replyId = generateReplyId();
    const createdAt = Date.now();
    const result = await api.runTransaction(target, current => {
      if (!current || !Array.isArray(current.comments)) { missing = true; return; }
      if (!current.comments.some(comment => String(comment?.id || '') === parentId)) { missing = true; return; }
      const comments = current.comments.map(comment => comment && typeof comment === 'object' ? { ...comment } : comment);
      comments.push({ id: replyId, author: user, type: String(type || '作業メモ'), text, createdAt, replyTo: parentId });
      const revision = Number.isSafeInteger(Number(current.revision)) && Number(current.revision) >= 0 ? Number(current.revision) : 0;
      return { ...current, comments, revision: revision + 1, updatedAt: createdAt, updatedBy: user };
    }, { applyLocally: false });
    if (!result.committed || missing) throw new Error('reply-conflict');
    writeCachedTask(taskId, result.snapshot?.val());
    return replyId;
  }

  async function handleReplySubmit(form, event) {
    if (!replyTarget) return false;
    const taskId = detailTaskId();
    if (!taskId || replyTarget.taskId !== taskId) { cancelReply(); return false; }
    const textarea = form.querySelector('textarea');
    const text = String(textarea?.value || '').trim();
    if (!text) return false;

    if (!isRemoteOnline()) {
      if (textarea) textarea.value = `[[wb-reply:${replyTarget.commentId}]] ${text}`;
      const targetId = replyTarget.commentId;
      setTimeout(() => {
        if (replyTarget?.commentId === targetId) cancelReply();
        schedulePatch(120);
      }, 0);
      return false;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const type = form.querySelector('select')?.value || '作業メモ';
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await saveRemoteReply(taskId, replyTarget.commentId, text, type);
      if (textarea) textarea.value = '';
      cancelReply();
      showMessage('返信を追加しました');
      schedulePatch(0);
    } catch (error) {
      console.warn('Comment reply save failed', error);
      showMessage('返信を保存できませんでした。もう一度お試しください。', true);
    } finally {
      if (submit) submit.disabled = false;
    }
    return true;
  }

  function closePickers(except = null) {
    document.querySelectorAll(".comment-reaction-picker-v165:not([hidden])").forEach(picker => {
      if (picker === except) return;
      picker.hidden = true;
      picker.parentElement?.querySelector("[data-comment-reaction-picker]")?.setAttribute("aria-expanded", "false");
    });
  }

  function bindGlobalEvents() {
    document.addEventListener('submit', event => {
      const form = event.target.closest?.('#detailBody .comment-form, #detailBody #commentForm');
      if (!form || !replyTarget) return;
      handleReplySubmit(form, event);
    }, true);

    document.addEventListener("click", event => {
      const replyButton = event.target.closest('[data-comment-reply-target]');
      if (replyButton) {
        event.preventDefault();
        event.stopPropagation();
        openReply(replyButton.dataset.commentReplyTarget);
        return;
      }
      if (event.target.closest('[data-cancel-comment-reply-v215]')) {
        event.preventDefault();
        cancelReply();
        return;
      }

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

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (replyTarget) cancelReply();
        closePickers();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const textarea = event.target.closest?.('#detailBody .comment-form textarea, #detailBody #commentText');
        if (!textarea) return;
        event.preventDefault();
        textarea.closest('form')?.requestSubmit();
      }
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
