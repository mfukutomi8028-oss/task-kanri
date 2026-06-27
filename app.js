import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, push, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const $ = (id) => document.getElementById(id);

const STATUSES = ["未着手", "対応中", "確認待ち", "保留", "完了"];
const PRIORITY_ORDER = { "緊急": 0, "高": 1, "中": 2, "低": 3 };
const DEFAULT_CATEGORIES = ["PC", "プリンタ", "ネットワーク", "電子カルテ", "Web/HP", "アカウント", "業者対応", "定期作業", "その他"];
const DEFAULT_USERS = ["福冨", "森井"];
const DEFAULT_COLORS = { "福冨": "#3c92df", "森井": "#4ebd69" };
const ROOM_ID = getRoomId();

const state = {
  firebaseReady: false,
  db: null,
  dbApi: null,
  roomRef: null,
  tasksRef: null,
  metaRef: null,
  tasks: [],
  users: loadUsers(),
  userColors: loadUserColors(),
  categories: loadCategories(),
  currentUser: localStorage.getItem("systemTaskUser") || "",
  selectedId: "",
  layout: "board",
  scope: "all",
  roomName: localStorage.getItem(roomNameKey()) || "",
  unsubscribed: false
};

const elements = {
  currentUserDot: $("currentUserDot"),
  currentUserLabel: $("currentUserLabel"),
  currentUserSelect: $("currentUserSelect"),
  startupUser: $("startupUser"),
  userDialog: $("userDialog"),
  userForm: $("userForm"),
  manageUsers: $("manageUsers"),
  userManageDialog: $("userManageDialog"),
  userManageForm: $("userManageForm"),
  closeUserManage: $("closeUserManage"),
  newUserName: $("newUserName"),
  newUserColor: $("newUserColor"),
  userList: $("userList"),
  roomNameInput: $("roomNameInput"),
  roomNameBadge: $("roomNameBadge"),
  connectionPill: $("connectionPill"),
  navItems: document.querySelectorAll(".nav-item"),
  boardView: $("boardView"),
  listView: $("listView"),
  detailBody: $("detailBody"),
  closeDetail: $("closeDetail"),
  searchInput: $("searchInput"),
  assigneeFilter: $("assigneeFilter"),
  statusFilter: $("statusFilter"),
  priorityFilter: $("priorityFilter"),
  categoryFilter: $("categoryFilter"),
  manageCategories: $("manageCategories"),
  categoryManageDialog: $("categoryManageDialog"),
  categoryManageForm: $("categoryManageForm"),
  closeCategoryManage: $("closeCategoryManage"),
  newCategoryName: $("newCategoryName"),
  categoryList: $("categoryList"),
  overdueOnly: $("overdueOnly"),
  todayOnly: $("todayOnly"),
  pinOnly: $("pinOnly"),
  resetFilters: $("resetFilters"),
  sortSelect: $("sortSelect"),
  newTask: $("newTask"),
  taskDialog: $("taskDialog"),
  taskForm: $("taskForm"),
  closeTaskDialog: $("closeTaskDialog"),
  taskDialogTitle: $("taskDialogTitle"),
  deleteTask: $("deleteTask"),
  copyRoomLink: $("copyRoomLink"),
  toast: $("toast"),
  openCount: $("openCount"),
  overdueCount: $("overdueCount"),
  todayCount: $("todayCount"),
  myCount: $("myCount")
};

init();

function init() {
  setupEvents();
  syncUserUi();
  syncRoomUi();
  setupFirebase();
  showUserDialogIfNeeded();
  render();
}

function getRoomId() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("room");
  if (fromQuery) return sanitizeRoomId(fromQuery);
  const saved = localStorage.getItem("systemTaskRoomId");
  if (saved) return sanitizeRoomId(saved);
  const generated = `sys-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-4)}`;
  localStorage.setItem("systemTaskRoomId", generated);
  history.replaceState(null, "", `${location.pathname}?room=${encodeURIComponent(generated)}`);
  return generated;
}

function sanitizeRoomId(value) {
  return String(value || "default").replace(/[.#$/\[\]]/g, "-").slice(0, 60);
}

function roomNameKey() {
  return `system-task-room-name:${ROOM_ID}`;
}
function usersKey() {
  return `system-task-users:${ROOM_ID}`;
}
function colorsKey() {
  return `system-task-user-colors:${ROOM_ID}`;
}
function tasksKey() {
  return `system-task-tasks:${ROOM_ID}`;
}

async function setupFirebase() {
  const config = window.firebaseConfig || {};
  if (!config.apiKey || !config.databaseURL) {
    loadLocalTasks();
    setConnection("ローカル保存", "local");
    return;
  }
  try {
    const app = initializeApp(config);
    const db = getDatabase(app);
    state.firebaseReady = true;
    state.db = db;
    state.dbApi = { ref, onValue, set, update, push, remove, serverTimestamp };
    state.roomRef = ref(db, `rooms/${ROOM_ID}`);
    state.tasksRef = ref(db, `rooms/${ROOM_ID}/tasks`);
    state.metaRef = ref(db, `rooms/${ROOM_ID}/meta`);

    onValue(state.metaRef, (snapshot) => {
      const meta = snapshot.val() || {};
      if (Array.isArray(meta.users)) setUsers(meta.users, { persist: false, silent: true });
      if (meta.userColors && typeof meta.userColors === "object") setUserColors(meta.userColors, { persist: false, silent: true });
      if (Array.isArray(meta.categories)) setCategories(meta.categories, { persist: false, silent: true });
      if (typeof meta.roomName === "string") {
        state.roomName = meta.roomName;
        localStorage.setItem(roomNameKey(), state.roomName);
        syncRoomUi();
      } else if (state.roomName) {
        saveRoomName();
      }
    });

    onValue(state.tasksRef, (snapshot) => {
      const value = snapshot.val() || {};
      state.tasks = Object.entries(value).map(([id, task]) => normalizeTask({ id, ...task }));
      localStorage.setItem(tasksKey(), JSON.stringify(state.tasks));
      setConnection("共同編集ON", "online");
      render();
    }, (error) => {
      console.warn(error);
      loadLocalTasks();
      setConnection("Firebase接続エラー・ローカル保存", "local");
    });
  } catch (error) {
    console.warn(error);
    loadLocalTasks();
    setConnection("Firebase未設定・ローカル保存", "local");
  }
}

function setupEvents() {
  elements.navItems.forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.layout) {
        state.layout = button.dataset.layout;
      }
      if (button.dataset.filter) {
        state.scope = state.scope === button.dataset.filter ? "all" : button.dataset.filter;
      }
      syncNavigationUi();
      render();
    });
  });

  elements.currentUserSelect.addEventListener("change", () => setCurrentUser(elements.currentUserSelect.value));
  elements.userForm.addEventListener("submit", (event) => {
    event.preventDefault();
    setCurrentUser(elements.startupUser.value);
    elements.userDialog.close();
  });

  elements.manageUsers.addEventListener("click", () => {
    renderUserManager();
    elements.userManageDialog.showModal();
  });
  elements.closeUserManage.addEventListener("click", () => elements.userManageDialog.close());
  elements.userManageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addUserFromForm();
  });

  let roomTimer = null;
  elements.roomNameInput.addEventListener("input", () => {
    state.roomName = elements.roomNameInput.value.trim();
    syncRoomUi(false);
    clearTimeout(roomTimer);
    roomTimer = setTimeout(saveRoomName, 400);
  });

  [elements.searchInput, elements.assigneeFilter, elements.statusFilter, elements.priorityFilter, elements.categoryFilter, elements.overdueOnly, elements.todayOnly, elements.pinOnly, elements.sortSelect]
    .forEach(el => el.addEventListener("input", render));

  elements.resetFilters.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.assigneeFilter.value = "";
    elements.statusFilter.value = "";
    elements.priorityFilter.value = "";
    elements.categoryFilter.value = "";
    elements.overdueOnly.checked = false;
    elements.todayOnly.checked = false;
    elements.pinOnly.checked = false;
    render();
  });

  elements.newTask.addEventListener("click", () => openTaskDialog());

  elements.manageCategories.addEventListener("click", () => {
    renderCategoryManager();
    elements.categoryManageDialog.showModal();
  });
  elements.closeCategoryManage.addEventListener("click", () => elements.categoryManageDialog.close());
  elements.categoryManageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addCategoryFromForm();
  });
  elements.closeTaskDialog.addEventListener("click", () => elements.taskDialog.close());
  elements.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveTaskFromForm();
  });
  elements.deleteTask.addEventListener("click", async () => {
    const id = $("taskId").value;
    if (!id) return;
    if (!confirm("このタスクを削除しますか？")) return;
    await deleteTask(id);
    elements.taskDialog.close();
  });
  elements.closeDetail.addEventListener("click", () => document.querySelector(".detail-panel").classList.remove("open"));
  elements.copyRoomLink?.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(ROOM_ID)}`;
    await navigator.clipboard?.writeText(url);
    toast("共有リンクをコピーしました");
  });
}

function normalizeTask(task) {
  return {
    id: task.id,
    title: task.title || "",
    description: task.description || "",
    status: STATUSES.includes(task.status) ? task.status : "未着手",
    priority: ["緊急", "高", "中", "低"].includes(task.priority) ? task.priority : "中",
    assignee: normalizeUser(task.assignee),
    category: normalizeCategory(task.category || "その他"),
    requester: task.requester || "",
    tags: Array.isArray(task.tags) ? task.tags : splitTags(task.tags || ""),
    checklist: Array.isArray(task.checklist) ? task.checklist : [],
    comments: Array.isArray(task.comments) ? task.comments : [],
    dueDate: task.dueDate || "",
    dueTime: task.dueTime || "",
    pinned: Boolean(task.pinned),
    createdBy: normalizeUser(task.createdBy || task.assignee),
    createdAt: Number(task.createdAt || Date.now()),
    updatedBy: normalizeUser(task.updatedBy || task.createdBy || task.assignee),
    updatedAt: Number(task.updatedAt || Date.now()),
    completedAt: task.completedAt ? Number(task.completedAt) : 0
  };
}


function syncNavigationUi() {
  elements.navItems.forEach(item => {
    if (item.dataset.layout) item.classList.toggle("active", item.dataset.layout === state.layout);
    if (item.dataset.filter) item.classList.toggle("active", item.dataset.filter === state.scope);
  });
}

function render() {
  syncUserUi();
  syncRoomUi();
  syncNavigationUi();
  renderSummary();
  const tasks = getFilteredTasks();
  elements.boardView.hidden = state.layout === "list";
  elements.listView.hidden = state.layout !== "list";
  if (state.layout === "list") {
    elements.boardView.innerHTML = "";
    renderList(tasks);
  } else {
    elements.listView.innerHTML = "";
    renderBoard(tasks);
  }
  renderDetail();
}

function renderSummary() {
  const now = startOfToday();
  const tasks = state.tasks;
  const open = tasks.filter(t => t.status !== "完了").length;
  const overdue = tasks.filter(t => t.status !== "完了" && t.dueDate && toDate(t.dueDate) < now).length;
  const today = tasks.filter(t => t.status !== "完了" && t.dueDate && toDate(t.dueDate).getTime() === now.getTime()).length;
  const mine = tasks.filter(t => t.status !== "完了" && t.assignee === getCurrentUser()).length;
  elements.openCount.textContent = `${open}件`;
  elements.overdueCount.textContent = `${overdue}件`;
  elements.todayCount.textContent = `${today}件`;
  elements.myCount.textContent = `${mine}件`;
}

function renderBoard(tasks) {
  const visibleStatuses = state.scope === "done" ? ["完了"] : STATUSES.filter(s => s !== "完了");
  elements.boardView.innerHTML = visibleStatuses.map(status => {
    const list = tasks.filter(t => t.status === status);
    return `<section class="board-column" data-status="${escapeHtml(status)}">
      <div class="column-head"><span>${escapeHtml(status)}</span><em>${list.length}</em></div>
      <div class="task-list">${list.map(taskCard).join("") || emptyColumn(status)}</div>
    </section>`;
  }).join("");
  elements.boardView.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", () => selectTask(el.dataset.taskId));
  });
}

function renderList(tasks) {
  elements.listView.innerHTML = `<table class="task-table">
    <thead><tr><th>件名</th><th>担当</th><th>状態</th><th>優先度</th><th>分類</th><th>期限</th><th>更新</th></tr></thead>
    <tbody>${tasks.map(t => `<tr data-task-id="${escapeHtml(t.id)}">
      <td><strong>${escapeHtml(t.title)}</strong><br><small>${escapeHtml(t.requester || "依頼元未入力")}</small></td>
      <td>${userBadge(t.assignee)}</td>
      <td>${statusBadge(t.status)}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${dueLabel(t)}</td>
      <td>${formatDateTime(t.updatedAt)}</td>
    </tr>`).join("")}</tbody>
  </table>`;
  elements.listView.querySelectorAll("[data-task-id]").forEach(el => el.addEventListener("click", () => selectTask(el.dataset.taskId)));
}

function taskCard(task) {
  const overdue = isOverdue(task);
  const checklist = checklistProgress(task);
  return `<article class="task-card ${task.pinned ? "pinned" : ""} ${overdue ? "overdue" : ""}" data-task-id="${escapeHtml(task.id)}">
    <p class="task-title">${task.pinned ? `<span class="pin">★</span>` : ""}<span>${escapeHtml(task.title)}</span></p>
    <div class="task-meta">${priorityBadge(task.priority)}${categoryBadge(task.category)}${overdue ? `<span class="badge priority-緊急">期限超過</span>` : ""}</div>
    <div class="due-line"><span>${userBadge(task.assignee)}</span><span>${dueLabel(task)}</span></div>
    ${task.checklist.length ? `<div class="progress" title="${checklist.done}/${checklist.total}"><span style="width:${checklist.percent}%"></span></div>` : ""}
  </article>`;
}

function renderDetail() {
  const task = state.tasks.find(t => t.id === state.selectedId);
  if (!task) {
    elements.detailBody.className = "detail-body empty";
    elements.detailBody.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><p>タスクを選択すると詳細が表示されます。</p></div>`;
    return;
  }
  elements.detailBody.className = "detail-body";
  const progress = checklistProgress(task);
  elements.detailBody.innerHTML = `
    <h3 class="detail-title">${escapeHtml(task.title)}</h3>
    <div class="task-meta">${statusBadge(task.status)}${priorityBadge(task.priority)}${categoryBadge(task.category)}${task.pinned ? `<span class="badge priority-中">固定</span>` : ""}</div>
    <div class="detail-actions">
      <button class="primary-button" data-action="edit">編集する</button>
      ${task.status !== "完了" ? `<button class="complete-button" data-action="done">✓ 完了にする</button>` : `<button class="ghost-button" data-action="reopen">未着手に戻す</button>`}
    </div>

    <section class="detail-section">
      <div class="detail-grid">
        <div class="field-card"><small>担当者</small>${userBadge(task.assignee)}</div>
        <div class="field-card"><small>依頼元</small><strong>${escapeHtml(task.requester || "未入力")}</strong></div>
        <div class="field-card"><small>期限</small><strong>${dueLabel(task)}</strong></div>
        <div class="field-card"><small>作成日</small><strong>${formatDateTime(task.createdAt)}</strong></div>
        <div class="field-card"><small>最終更新</small><strong>${formatDateTime(task.updatedAt)}</strong></div>
        <div class="field-card"><small>更新者</small>${userBadge(task.updatedBy)}</div>
      </div>
    </section>

    ${task.description ? `<section class="detail-section"><h4>内容・メモ</h4><div class="description">${escapeHtml(task.description)}</div></section>` : ""}

    <section class="detail-section">
      <h4>チェックリスト ${task.checklist.length ? `(${progress.done}/${progress.total})` : ""}</h4>
      <div class="checklist">
        ${task.checklist.length ? task.checklist.map((item, index) => `<label class="check-item ${item.done ? "done" : ""}">
          <input type="checkbox" data-check-index="${index}" ${item.done ? "checked" : ""} />
          <span>${escapeHtml(item.text)}</span>
        </label>`).join("") : `<p class="description">チェック項目はありません。</p>`}
      </div>
    </section>

    <section class="detail-section">
      <h4>コメント</h4>
      <div class="comment-list">${task.comments.length ? task.comments.map(comment => `<div class="comment">
        <div class="comment-head"><span>${userBadge(comment.author)}</span><span>${formatDateTime(comment.createdAt)}</span></div>
        <div>${escapeHtml(comment.text)}</div>
      </div>`).join("") : `<p class="description">コメントはまだありません。</p>`}</div>
      <form class="comment-form" id="commentForm">
        <textarea id="commentText" placeholder="対応状況や申し送りを入力"></textarea>
        <button class="ghost-button" type="submit">コメント追加</button>
      </form>
    </section>
  `;

  elements.detailBody.querySelector('[data-action="edit"]')?.addEventListener("click", () => openTaskDialog(task));
  elements.detailBody.querySelector('[data-action="done"]')?.addEventListener("click", () => changeStatus(task.id, "完了"));
  elements.detailBody.querySelector('[data-action="reopen"]')?.addEventListener("click", () => changeStatus(task.id, "未着手"));
  elements.detailBody.querySelectorAll("[data-check-index]").forEach(input => {
    input.addEventListener("change", () => toggleChecklist(task.id, Number(input.dataset.checkIndex), input.checked));
  });
  $("commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("commentText").value.trim();
    if (!text) return;
    await addComment(task.id, text);
    $("commentText").value = "";
  });
}

function getFilteredTasks() {
  const q = normalizeText(elements.searchInput.value);
  const now = startOfToday();
  let tasks = state.tasks.filter(task => {
    if (state.scope === "mine" && task.assignee !== getCurrentUser()) return false;
    if (state.scope === "done" && task.status !== "完了") return false;
    if (state.scope !== "done" && task.status === "完了") return false;
    if (elements.assigneeFilter.value && task.assignee !== elements.assigneeFilter.value) return false;
    if (elements.statusFilter.value && task.status !== elements.statusFilter.value) return false;
    if (elements.priorityFilter.value && task.priority !== elements.priorityFilter.value) return false;
    if (elements.categoryFilter.value && task.category !== elements.categoryFilter.value) return false;
    if (elements.pinOnly.checked && !task.pinned) return false;
    if (elements.overdueOnly.checked && !isOverdue(task)) return false;
    if (elements.todayOnly.checked && (!task.dueDate || toDate(task.dueDate).getTime() > now.getTime())) return false;
    if (q) {
      const hay = normalizeText([task.title, task.description, task.requester, task.category, task.assignee, task.tags.join(" ")].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sort = elements.sortSelect.value;
  tasks.sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === "updated") return b.updatedAt - a.updatedAt;
    if (sort === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || dueScore(a) - dueScore(b);
    if (sort === "due") return dueScore(a) - dueScore(b);
    return smartScore(a) - smartScore(b);
  });
  return tasks;
}

function openTaskDialog(task = null) {
  elements.taskDialogTitle.textContent = task ? "タスクを編集" : "新しいタスク";
  $("taskId").value = task?.id || "";
  $("taskTitle").value = task?.title || "";
  $("taskAssignee").value = task?.assignee || getCurrentUser();
  $("taskStatus").value = task?.status || "未着手";
  $("taskPriority").value = task?.priority || "中";
  $("taskCategory").value = task?.category || "PC";
  $("taskDueDate").value = task?.dueDate || "";
  $("taskDueTime").value = task?.dueTime || "";
  $("taskRequester").value = task?.requester || "";
  $("taskTags").value = task?.tags?.join(", ") || "";
  $("taskDescription").value = task?.description || "";
  $("taskChecklist").value = task?.checklist?.map(i => `${i.done ? "[x] " : ""}${i.text}`).join("\n") || "";
  $("taskPinned").checked = Boolean(task?.pinned);
  elements.deleteTask.hidden = !task;
  elements.taskDialog.showModal();
  $("taskTitle").focus();
}

async function saveTaskFromForm() {
  const id = $("taskId").value || generateId();
  const existing = state.tasks.find(t => t.id === id);
  const status = $("taskStatus").value;
  const now = Date.now();
  const task = normalizeTask({
    id,
    title: $("taskTitle").value.trim(),
    assignee: $("taskAssignee").value,
    status,
    priority: $("taskPriority").value,
    category: $("taskCategory").value,
    dueDate: $("taskDueDate").value,
    dueTime: $("taskDueTime").value,
    requester: $("taskRequester").value.trim(),
    tags: splitTags($("taskTags").value),
    description: $("taskDescription").value.trim(),
    checklist: parseChecklist($("taskChecklist").value, existing?.checklist || []),
    pinned: $("taskPinned").checked,
    comments: existing?.comments || [],
    createdBy: existing?.createdBy || getCurrentUser(),
    createdAt: existing?.createdAt || now,
    updatedBy: getCurrentUser(),
    updatedAt: now,
    completedAt: status === "完了" ? (existing?.completedAt || now) : 0
  });
  await persistTask(task);
  state.selectedId = id;
  elements.taskDialog.close();
  toast("保存しました");
}

async function persistTask(task) {
  if (state.firebaseReady && state.dbApi) {
    await set(ref(state.db, `rooms/${ROOM_ID}/tasks/${task.id}`), task);
  } else {
    const index = state.tasks.findIndex(t => t.id === task.id);
    if (index >= 0) state.tasks[index] = task;
    else state.tasks.unshift(task);
    localStorage.setItem(tasksKey(), JSON.stringify(state.tasks));
    render();
  }
}

async function deleteTask(id) {
  if (state.firebaseReady && state.dbApi) {
    await remove(ref(state.db, `rooms/${ROOM_ID}/tasks/${id}`));
  } else {
    state.tasks = state.tasks.filter(t => t.id !== id);
    localStorage.setItem(tasksKey(), JSON.stringify(state.tasks));
    render();
  }
  if (state.selectedId === id) state.selectedId = "";
  toast("削除しました");
}

async function changeStatus(id, status) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.status = status;
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  task.completedAt = status === "完了" ? Date.now() : 0;
  await persistTask(task);
}

async function toggleChecklist(id, index, done) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !task.checklist[index]) return;
  task.checklist[index].done = done;
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
}

async function addComment(id, text) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.comments = [...(task.comments || []), { id: generateId(), author: getCurrentUser(), text, createdAt: Date.now() }];
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
}

function loadLocalTasks() {
  try {
    state.tasks = JSON.parse(localStorage.getItem(tasksKey()) || "[]").map(normalizeTask);
  } catch {
    state.tasks = [];
  }
  render();
}

function syncUserUi() {
  const current = getCurrentUser();
  syncUserOptions(elements.currentUserSelect);
  syncUserOptions(elements.startupUser);
  syncUserOptions($("taskAssignee"));
  syncUserOptions(elements.assigneeFilter, true);
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  elements.currentUserSelect.value = current;
  elements.startupUser.value = current;
  elements.currentUserLabel.textContent = current;
  elements.currentUserDot.textContent = current.slice(0, 1);
  elements.currentUserDot.style.setProperty("--user-color", userColor(current));
}

function syncUserOptions(select, includeAll = false) {
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `${includeAll ? '<option value="">すべて</option>' : ""}${state.users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("")}`;
  if ([...select.options].some(opt => opt.value === currentValue)) select.value = currentValue;
}

function loadUsers() {
  try {
    const list = JSON.parse(localStorage.getItem(usersKey()) || "null");
    if (Array.isArray(list)) return uniqueUsers(list);
  } catch {}
  return [...DEFAULT_USERS];
}

function loadUserColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(colorsKey()) || "{}");
    return { ...DEFAULT_COLORS, ...saved };
  } catch {
    return { ...DEFAULT_COLORS };
  }
}

function uniqueUsers(list) {
  const result = [];
  for (const item of Array.isArray(list) ? list : []) {
    const name = sanitizeUser(item);
    if (name && !result.includes(name)) result.push(name);
  }
  return result.length ? result : [...DEFAULT_USERS];
}

function sanitizeUser(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").slice(0, 12);
}
function normalizeUser(value) {
  const raw = sanitizeUser(value);
  return state.users.find(u => normalizeText(u) === normalizeText(raw)) || raw || state.users[0] || DEFAULT_USERS[0];
}
function getCurrentUser() {
  return normalizeUser(state.currentUser || localStorage.getItem("systemTaskUser") || state.users[0]);
}
function setCurrentUser(value) {
  state.currentUser = normalizeUser(value);
  localStorage.setItem("systemTaskUser", state.currentUser);
  syncUserUi();
  render();
}
function userColor(name) {
  const user = normalizeUser(name);
  return state.userColors[user] || DEFAULT_COLORS[user] || "#7c5cff";
}
function userBadge(name) {
  const user = normalizeUser(name);
  return `<span class="user-badge" style="--user-color:${escapeHtml(userColor(user))}"><span class="tiny-avatar">${escapeHtml(user.slice(0,1))}</span>${escapeHtml(user)}</span>`;
}

function renderUserManager() {
  elements.userList.innerHTML = state.users.map(user => `<div class="user-list-item">
    ${userBadge(user)}
    <div class="user-list-actions">
      <input class="user-color-input" type="color" value="${escapeHtml(userColor(user))}" data-user-color="${escapeHtml(user)}" />
      <button class="mini-button" type="button" data-select-user="${escapeHtml(user)}">選択</button>
      <button class="mini-button danger" type="button" data-delete-user="${escapeHtml(user)}" ${state.users.length <= 1 ? "disabled" : ""}>削除</button>
    </div>
  </div>`).join("");
  elements.userList.querySelectorAll("[data-select-user]").forEach(button => button.addEventListener("click", () => setCurrentUser(button.dataset.selectUser)));
  elements.userList.querySelectorAll("[data-delete-user]").forEach(button => button.addEventListener("click", () => deleteUser(button.dataset.deleteUser)));
  elements.userList.querySelectorAll("[data-user-color]").forEach(input => {
    input.addEventListener("input", () => {
      state.userColors[input.dataset.userColor] = input.value;
      saveUserSettings(false);
      syncUserUi();
      render();
    });
    input.addEventListener("change", () => saveUserSettings(true));
  });
}

async function addUserFromForm() {
  const name = sanitizeUser(elements.newUserName.value);
  if (!name) return toast("ユーザー名を入力してください", true);
  if (state.users.some(u => normalizeText(u) === normalizeText(name))) return toast("同じユーザーが既にあります", true);
  state.users.push(name);
  state.userColors[name] = elements.newUserColor.value || "#7c5cff";
  elements.newUserName.value = "";
  setUsers(state.users);
  await saveUserSettings(true);
  renderUserManager();
}

async function deleteUser(name) {
  if (state.users.length <= 1) return;
  const target = sanitizeUser(name);
  if (!confirm(`${target}を削除しますか？既存タスクの担当者名は残ります。`)) return;
  const wasCurrent = sanitizeUser(state.currentUser || localStorage.getItem("systemTaskUser")) === target;
  state.users = state.users.filter(u => u !== target);
  delete state.userColors[target];
  if (wasCurrent) {
    state.currentUser = state.users[0] || "";
    localStorage.setItem("systemTaskUser", state.currentUser);
  }
  await saveUserSettings(true);
  syncUserUi();
  renderUserManager();
  render();
}

function setUsers(users, options = {}) {
  state.users = uniqueUsers(users);
  localStorage.setItem(usersKey(), JSON.stringify(state.users));
  syncUserUi();
  if (options.persist !== false) saveUserSettings(true);
  if (!options.silent) render();
}

function setUserColors(colors, options = {}) {
  state.userColors = { ...state.userColors, ...colors };
  localStorage.setItem(colorsKey(), JSON.stringify(state.userColors));
  syncUserUi();
  if (options.persist !== false) saveUserSettings(true);
  if (!options.silent) render();
}

async function saveUserSettings(remote = true) {
  localStorage.setItem(usersKey(), JSON.stringify(state.users));
  localStorage.setItem(colorsKey(), JSON.stringify(state.userColors));
  if (remote && state.firebaseReady && state.dbApi) {
    await update(state.metaRef, { users: state.users, userColors: state.userColors, usersUpdatedAt: Date.now() });
  }
}


function categoriesKey() {
  return `system-task-categories:${ROOM_ID}`;
}
function sanitizeCategory(value) {
  return String(value || "").normalize("NFKC").trim().slice(0, 20);
}
function uniqueCategories(list) {
  const result = [];
  for (const item of Array.isArray(list) ? list : []) {
    const name = sanitizeCategory(item);
    if (name && !result.includes(name)) result.push(name);
  }
  return result.length ? result : [...DEFAULT_CATEGORIES];
}
function loadCategories() {
  try {
    const list = JSON.parse(localStorage.getItem(categoriesKey()) || "null");
    if (Array.isArray(list)) return uniqueCategories(list);
  } catch {}
  return [...DEFAULT_CATEGORIES];
}
function normalizeCategory(value) {
  const raw = sanitizeCategory(value);
  if (!raw) return state.categories[0] || "その他";
  const exact = state.categories.find(c => normalizeText(c) === normalizeText(raw));
  return exact || raw;
}
function syncCategoryOptions(select, includeAll = false) {
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `${includeAll ? '<option value="">すべて</option>' : ""}${state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
  if ([...select.options].some(opt => opt.value === currentValue)) select.value = currentValue;
}
function renderCategoryManager() {
  elements.categoryList.innerHTML = state.categories.map(category => `<div class="category-list-item">
    <input class="category-name-input" value="${escapeHtml(category)}" maxlength="20" data-category-old="${escapeHtml(category)}" />
    <div class="category-list-actions">
      <button class="mini-button" type="button" data-save-category="${escapeHtml(category)}">保存</button>
      <button class="mini-button danger" type="button" data-delete-category="${escapeHtml(category)}" ${state.categories.length <= 1 ? "disabled" : ""}>削除</button>
    </div>
  </div>`).join("");

  elements.categoryList.querySelectorAll("[data-save-category]").forEach(button => {
    button.addEventListener("click", async () => {
      const oldName = button.dataset.saveCategory;
      const input = elements.categoryList.querySelector(`[data-category-old="${cssEscape(oldName)}"]`);
      await renameCategory(oldName, input?.value || "");
    });
  });
  elements.categoryList.querySelectorAll("[data-delete-category]").forEach(button => {
    button.addEventListener("click", async () => deleteCategory(button.dataset.deleteCategory));
  });
}
async function addCategoryFromForm() {
  const name = sanitizeCategory(elements.newCategoryName.value);
  if (!name) return toast("分類名を入力してください", true);
  if (state.categories.some(c => normalizeText(c) === normalizeText(name))) return toast("同じ分類が既にあります", true);
  state.categories.push(name);
  elements.newCategoryName.value = "";
  await saveCategorySettings(true);
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  renderCategoryManager();
  render();
}
async function renameCategory(oldName, newValue) {
  const next = sanitizeCategory(newValue);
  if (!next) return toast("分類名を入力してください", true);
  if (next !== oldName && state.categories.some(c => normalizeText(c) === normalizeText(next))) return toast("同じ分類が既にあります", true);
  state.categories = state.categories.map(c => c === oldName ? next : c);
  const changedTasks = state.tasks.filter(t => t.category === oldName);
  for (const task of changedTasks) {
    task.category = next;
    task.updatedAt = Date.now();
    task.updatedBy = getCurrentUser();
    await persistTask(task);
  }
  await saveCategorySettings(true);
  renderCategoryManager();
  render();
  toast("分類を更新しました");
}
async function deleteCategory(name) {
  if (state.categories.length <= 1) return;
  const used = state.tasks.some(t => t.category === name);
  const message = used
    ? `${name}を削除しますか？\nこの分類を使っているタスクは「その他」に変更されます。`
    : `${name}を削除しますか？`;
  if (!confirm(message)) return;
  state.categories = state.categories.filter(c => c !== name);
  const fallback = state.categories.includes("その他") ? "その他" : state.categories[0];
  const changedTasks = state.tasks.filter(t => t.category === name);
  for (const task of changedTasks) {
    task.category = fallback;
    task.updatedAt = Date.now();
    task.updatedBy = getCurrentUser();
    await persistTask(task);
  }
  await saveCategorySettings(true);
  renderCategoryManager();
  render();
  toast("分類を削除しました");
}
function setCategories(categories, options = {}) {
  state.categories = uniqueCategories(categories);
  localStorage.setItem(categoriesKey(), JSON.stringify(state.categories));
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  renderCategoryManager();
  if (options.persist !== false) saveCategorySettings(true);
  if (!options.silent) render();
}
async function saveCategorySettings(remote = true) {
  localStorage.setItem(categoriesKey(), JSON.stringify(state.categories));
  if (remote && state.firebaseReady && state.dbApi) {
    await update(state.metaRef, { categories: state.categories, categoriesUpdatedAt: Date.now() });
  }
}
function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}


function syncRoomUi(updateInput = true) {
  if (updateInput && document.activeElement !== elements.roomNameInput) elements.roomNameInput.value = state.roomName;
  elements.roomNameBadge.hidden = !state.roomName;
  elements.roomNameBadge.textContent = state.roomName ? `共有ルーム：${state.roomName}` : "";
}
async function saveRoomName() {
  localStorage.setItem(roomNameKey(), state.roomName);
  syncRoomUi(false);
  if (state.firebaseReady && state.dbApi) await update(state.metaRef, { roomName: state.roomName, roomNameUpdatedAt: Date.now() });
}

function showUserDialogIfNeeded() {
  if (localStorage.getItem("systemTaskUser")) return;
  elements.userDialog.showModal();
}

function selectTask(id) {
  state.selectedId = id;
  renderDetail();
  document.querySelector(".detail-panel").classList.add("open");
}

function setConnection(text, type) {
  elements.connectionPill.textContent = text;
  elements.connectionPill.className = `connection-pill ${type || ""}`;
}

function emptyColumn(status) {
  return `<div class="empty-state" style="padding:20px 6px"><p>${escapeHtml(status)}のタスクはありません。</p></div>`;
}

function priorityBadge(priority) {
  return `<span class="badge priority-${escapeHtml(priority)}">${escapeHtml(priority)}</span>`;
}
function statusBadge(status) {
  return `<span class="badge status-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}
function categoryBadge(category) {
  return `<span class="badge status-未着手">${escapeHtml(category)}</span>`;
}

function splitTags(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value || "").split(/[,\n、]/).map(s => s.trim()).filter(Boolean);
}
function parseChecklist(value, existing = []) {
  const existingByText = new Map(existing.map(item => [normalizeText(item.text), item]));
  return String(value || "").split("\n").map(line => line.trim()).filter(Boolean).map(text => {
    const done = /^\[x\]\s*/i.test(text);
    const clean = text.replace(/^\[(x| )\]\s*/i, "").trim();
    const old = existingByText.get(normalizeText(clean));
    return { id: old?.id || generateId(), text: clean, done: done || Boolean(old?.done) };
  });
}
function checklistProgress(task) {
  const total = task.checklist.length;
  const done = task.checklist.filter(i => i.done).length;
  return { total, done, percent: total ? Math.round(done / total * 100) : 0 };
}

function dueLabel(task) {
  if (!task.dueDate) return "期限なし";
  const date = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`);
  const text = `${task.dueDate}${task.dueTime ? " " + task.dueTime : ""}`;
  if (task.status !== "完了" && isOverdue(task)) return `⚠ ${text}`;
  return text;
}
function isOverdue(task) {
  if (!task.dueDate || task.status === "完了") return false;
  return toDate(task.dueDate) < startOfToday();
}
function dueScore(task) {
  if (!task.dueDate) return 9999999999999;
  return new Date(`${task.dueDate}T${task.dueTime || "23:59"}`).getTime();
}
function smartScore(task) {
  return (task.pinned ? -10000000000000 : 0) + PRIORITY_ORDER[task.priority] * 100000000000 + dueScore(task);
}
function toDate(value) {
  return new Date(`${value}T00:00:00`);
}
function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function normalizeText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}
function generateId() {
  if (state.firebaseReady && state.dbApi) return push(state.tasksRef).key;
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}
function toast(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.style.background = error ? "#b91c2b" : "#132b40";
  elements.toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => elements.toast.hidden = true, 2600);
}
