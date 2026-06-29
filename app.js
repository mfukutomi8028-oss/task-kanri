import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, push, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_STATUSES = ["未着手", "対応中", "確認待ち", "保留", "完了"];
const COMPLETED_STATUS = "完了";
const TIMELINE_RANGES = { "14": 14, "month": 31 };
const PRIORITY_ORDER = { "緊急": 0, "高": 1, "中": 2, "低": 3 };
const DEFAULT_CATEGORIES = ["PC", "プリンタ", "ネットワーク", "電子カルテ", "Web/HP", "アカウント", "業者対応", "定期作業", "その他"];
const DEFAULT_USERS = ["福冨", "森井"];
const STALE_DAYS = 7;
const RECURRENCE_LABELS = { none: "なし", weekly: "毎週", monthly: "毎月", yearly: "毎年" };
const DEFAULT_TASK_TEMPLATES = [
  {
    id: "printer",
    name: "プリンタ不具合",
    title: "プリンタ不具合対応",
    category: "プリンタ",
    priority: "中",
    tags: "現地確認, 印刷",
    description: "現象：\n対象端末：\n対象プリンタ：\n確認したこと：",
    checklist: "現地確認\nプリンタ電源・紙詰まり確認\nIPアドレス確認\nping確認\n印刷キュー確認\nドライバ確認\nテスト印刷\n依頼元へ確認"
  },
  {
    id: "pc-setup",
    name: "PCキッティング",
    title: "PCキッティング",
    category: "PC",
    priority: "中",
    tags: "キッティング, 端末",
    description: "用途：\n設置場所：\n利用者：",
    checklist: "初期設定\nPC名設定\nドメイン参加\n必要ソフト導入\nプリンタ設定\n電子カルテ接続確認\n現地設置\n利用者確認"
  },
  {
    id: "account",
    name: "アカウント作成",
    title: "アカウント作成",
    category: "アカウント",
    priority: "中",
    tags: "アカウント",
    description: "対象者：\n所属：\n必要な権限：",
    checklist: "申請内容確認\nアカウント作成\n権限設定\n初期パスワード連絡\nログイン確認"
  },
  {
    id: "karte",
    name: "電子カルテ端末確認",
    title: "電子カルテ端末確認",
    category: "電子カルテ",
    priority: "高",
    tags: "電子カルテ, 現地確認",
    description: "対象端末：\n場所：\n症状：",
    checklist: "端末起動確認\nネットワーク確認\nMALL接続確認\nプリンタ確認\n資格確認関連の影響確認\n利用者確認"
  },
  {
    id: "web",
    name: "Web/HP修正",
    title: "ホームページ修正",
    category: "Web/HP",
    priority: "中",
    tags: "Web, HP",
    description: "対象ページ：\n修正内容：\n確認者：",
    checklist: "修正内容確認\nテスト反映\n表示確認\nスマホ表示確認\n本番反映\n依頼元へ報告"
  },
  {
    id: "vendor",
    name: "業者問い合わせ",
    title: "業者問い合わせ",
    category: "業者対応",
    priority: "中",
    tags: "業者待ち",
    description: "業者名：\n問い合わせ内容：\n回答期限：",
    checklist: "問い合わせ内容整理\n業者へ連絡\n回答確認\n院内共有\n必要に応じて再依頼"
  }
];
const DEFAULT_COLORS = { "福冨": "#3c92df", "森井": "#4ebd69" };
const ROOM_ID = getRoomId();

const state = {
  firebaseReady: false,
  db: null,
  dbApi: null,
  roomRef: null,
  tasksRef: null,
  schedulesRef: null,
  knowledgeRef: null,
  metaRef: null,
  tasks: [],
  schedules: [],
  knowledge: [],
  users: loadUsers(),
  userColors: loadUserColors(),
  categories: loadCategories(),
  taskTemplates: loadTaskTemplates(),
  savedFilters: loadSavedFilters(),
  statusesByUser: loadStatusesByUser(),
  statuses: loadStatuses(),
  timelineStart: localStorage.getItem(timelineStartKey()) || todayISO(),
  timelineRange: localStorage.getItem(timelineRangeKey()) || "14",
  currentUser: localStorage.getItem("systemTaskUser") || "",
  selectedId: "",
  layout: "today",
  taskLayout: normalizeTaskLayout(localStorage.getItem(taskLayoutKey()) || "board"),
  scheduleRange: localStorage.getItem(scheduleRangeKey()) || "today",
  scheduleDisplayMode: normalizeScheduleDisplayMode(localStorage.getItem(scheduleDisplayModeKey()) || "list"),
  scheduleAnchor: localStorage.getItem(scheduleAnchorKey()) || todayISO(),
  pendingScheduleTaskLink: "",
  scope: "all",
  roomName: localStorage.getItem(roomNameKey()) || "",
  unsubscribed: false
};

const elements = {
  appShell: document.querySelector(".app-shell"),
  mainContent: $("mainContent"),
  detailPanel: document.querySelector(".detail-panel"),
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
  taskViewButtons: [...document.querySelectorAll("[data-task-layout]")],
  todayView: $("todayView"),
  boardView: $("boardView"),
  listView: $("listView"),
  timelineView: $("timelineView"),
  dashboardView: $("dashboardView"),
  scheduleView: $("scheduleView"),
  detailBody: $("detailBody"),
  closeDetail: $("closeDetail"),
  searchInput: $("searchInput"),
  assigneeFilter: $("assigneeFilter"),
  statusFilter: $("statusFilter"),
  manageStatuses: $("manageStatuses"),
  statusManageDialog: $("statusManageDialog"),
  statusManageForm: $("statusManageForm"),
  closeStatusManage: $("closeStatusManage"),
  newStatusName: $("newStatusName"),
  statusList: $("statusList"),
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
  quickAddInput: $("quickAddInput"),
  quickAddButton: $("quickAddButton"),
  saveCurrentFilter: $("saveCurrentFilter"),
  savedFilterList: $("savedFilterList"),
  newTask: $("newTask"),
  scheduleDialog: $("scheduleDialog"),
  scheduleForm: $("scheduleForm"),
  closeScheduleDialog: $("closeScheduleDialog"),
  scheduleDialogTitle: $("scheduleDialogTitle"),
  openRelatedTaskFromSchedule: $("openRelatedTaskFromSchedule"),
  createTaskFromSchedule: $("createTaskFromSchedule"),
  deleteSchedule: $("deleteSchedule"),
  taskDialog: $("taskDialog"),
  taskForm: $("taskForm"),
  closeTaskDialog: $("closeTaskDialog"),
  taskDialogTitle: $("taskDialogTitle"),
  taskTemplate: $("taskTemplate"),
  manageTemplates: $("manageTemplates"),
  templateManageDialog: $("templateManageDialog"),
  templateManageForm: $("templateManageForm"),
  closeTemplateManage: $("closeTemplateManage"),
  newTemplateButton: $("newTemplateButton"),
  templateList: $("templateList"),
  templateEditTitle: $("templateEditTitle"),
  templateIdField: $("templateIdField"),
  templateName: $("templateName"),
  templateTitle: $("templateTitle"),
  templatePriority: $("templatePriority"),
  templateCategory: $("templateCategory"),
  templateTags: $("templateTags"),
  templateDescription: $("templateDescription"),
  templateChecklist: $("templateChecklist"),
  deleteTemplateButton: $("deleteTemplateButton"),
  saveTemplateButton: $("saveTemplateButton"),
  deleteTask: $("deleteTask"),
  copyRoomLink: $("copyRoomLink"),
  toast: $("toast"),
  openCount: $("openCount"),
  overdueCount: $("overdueCount"),
  todayCount: $("todayCount"),
  myCount: $("myCount")
};

function init() {
  setupEvents();
  syncCurrentUserStatuses({ persist: false, silent: true });
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
function schedulesKey() {
  return `system-task-schedules:${ROOM_ID}`;
}
function knowledgeKey() {
  return `system-task-knowledge:${ROOM_ID}`;
}
function savedFiltersKey() {
  return `system-task-saved-filters:${ROOM_ID}`;
}
function taskLayoutKey() {
  return `system-task-layout:${ROOM_ID}`;
}
function scheduleRangeKey() {
  return `system-task-schedule-range:${ROOM_ID}`;
}
function scheduleDisplayModeKey() {
  return `system-task-schedule-display-mode:${ROOM_ID}`;
}
function scheduleAnchorKey() {
  return `system-task-schedule-anchor:${ROOM_ID}`;
}

async function setupFirebase() {
  const config = window.firebaseConfig || {};
  if (!config.apiKey || !config.databaseURL) {
    loadLocalTasks();
    loadLocalSchedules();
    loadLocalKnowledge();
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
    state.schedulesRef = ref(db, `rooms/${ROOM_ID}/schedules`);
    state.knowledgeRef = ref(db, `rooms/${ROOM_ID}/knowledge`);
    state.metaRef = ref(db, `rooms/${ROOM_ID}/meta`);

    onValue(state.metaRef, (snapshot) => {
      const meta = snapshot.val() || {};
      if (Array.isArray(meta.users)) setUsers(meta.users, { persist: false, silent: true });
      if (meta.userColors && typeof meta.userColors === "object") setUserColors(meta.userColors, { persist: false, silent: true });
      if (Array.isArray(meta.categories)) setCategories(meta.categories, { persist: false, silent: true });
      if (Array.isArray(meta.taskTemplates)) setTaskTemplates(meta.taskTemplates, { persist: false, silent: true });
      if (Array.isArray(meta.savedFilters)) setSavedFilters(meta.savedFilters, { persist: false, silent: true });
      if (meta.statusesByUser && typeof meta.statusesByUser === "object") {
        setStatusesByUser(meta.statusesByUser, { persist: false, silent: true });
      } else if (Array.isArray(meta.statuses)) {
        setStatuses(meta.statuses, { persist: false, silent: true });
      }
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
      syncStatusOptions($("taskStatus"));
      syncStatusOptions(elements.statusFilter, true);
      syncScheduleRelatedTaskOptions();
      setConnection("共同編集ON", "online");
      render();
    }, (error) => {
      console.warn(error);
      loadLocalTasks();
      setConnection("Firebase接続エラー・ローカル保存", "local");
    });

    onValue(state.schedulesRef, (snapshot) => {
      const value = snapshot.val() || {};
      state.schedules = Object.entries(value).map(([id, schedule]) => normalizeSchedule({ id, ...schedule }));
      localStorage.setItem(schedulesKey(), JSON.stringify(state.schedules));
      render();
    }, (error) => {
      console.warn(error);
      loadLocalSchedules();
      setConnection("Firebase接続エラー・ローカル保存", "local");
    });

    onValue(state.knowledgeRef, (snapshot) => {
      const value = snapshot.val() || {};
      state.knowledge = Object.entries(value).map(([id, item]) => normalizeKnowledge({ id, ...item }));
      localStorage.setItem(knowledgeKey(), JSON.stringify(state.knowledge));
      render();
    }, (error) => {
      console.warn(error);
      loadLocalKnowledge();
    });
  } catch (error) {
    console.warn(error);
    loadLocalTasks();
    loadLocalSchedules();
    loadLocalKnowledge();
    setConnection("Firebase未設定・ローカル保存", "local");
  }
}

function setupEvents() {
  elements.navItems.forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.layout) {
        state.layout = button.dataset.layout;
        if (state.layout !== "tasks") closeDetail();
      }
      if (button.dataset.filter) {
        state.scope = state.scope === button.dataset.filter ? "all" : button.dataset.filter;
      }
      syncNavigationUi();
      render();
    });
  });

  (elements.taskViewButtons || []).forEach(button => {
    button.addEventListener("click", () => {
      state.layout = "tasks";
      state.taskLayout = normalizeTaskLayout(button.dataset.taskLayout);
      localStorage.setItem(taskLayoutKey(), state.taskLayout);
      syncNavigationUi();
      render();
    });
  });

  elements.quickAddButton?.addEventListener("click", () => quickAddTask());
  elements.quickAddInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      quickAddTask();
    }
  });
  elements.saveCurrentFilter?.addEventListener("click", () => saveCurrentFilterFromPrompt());
  elements.savedFilterList?.addEventListener("click", (event) => {
    const applyButton = event.target.closest("[data-apply-filter]");
    const deleteButton = event.target.closest("[data-delete-filter]");
    if (applyButton) applySavedFilter(applyButton.dataset.applyFilter);
    if (deleteButton) deleteSavedFilter(deleteButton.dataset.deleteFilter);
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

  elements.scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveScheduleFromForm();
  });
  elements.closeScheduleDialog.addEventListener("click", () => elements.scheduleDialog.close());
  $("scheduleStart").addEventListener("input", syncScheduleEndFromStart);
  $("scheduleStart").addEventListener("change", syncScheduleEndFromStart);
  elements.openRelatedTaskFromSchedule.addEventListener("click", () => {
    const taskId = $("scheduleRelatedTask").value;
    if (!taskId) return toast("関連タスクが選択されていません", true);
    elements.scheduleDialog.close();
    navigateToTask(taskId);
  });
  elements.createTaskFromSchedule.addEventListener("click", () => {
    const id = $("scheduleId").value;
    const schedule = state.schedules.find(s => s.id === id);
    if (!schedule) return toast("保存済みの予定から作成できます", true);
    openTaskDialogFromSchedule(schedule);
  });
  elements.deleteSchedule.addEventListener("click", async () => {
    const id = $("scheduleId").value;
    if (!id) return elements.scheduleDialog.close();
    if (!confirm("この予定を削除しますか？")) return;
    await deleteSchedule(id);
    elements.scheduleDialog.close();
  });

  elements.newTask.addEventListener("click", () => openTaskDialog());
  elements.taskTemplate.addEventListener("change", () => applyTemplate(elements.taskTemplate.value));
  elements.manageTemplates.addEventListener("click", () => {
    renderTemplateManager();
    elements.templateManageDialog.showModal();
  });
  elements.closeTemplateManage.addEventListener("click", () => elements.templateManageDialog.close());
  elements.newTemplateButton.addEventListener("click", () => clearTemplateEditor());
  elements.templateManageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveTemplateFromForm();
  });
  elements.deleteTemplateButton.addEventListener("click", async () => deleteSelectedTemplate());

  elements.manageStatuses.addEventListener("click", () => {
    renderStatusManager();
    elements.statusManageDialog.showModal();
  });
  elements.closeStatusManage.addEventListener("click", () => elements.statusManageDialog.close());
  elements.statusManageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addStatusFromForm();
  });

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
  elements.closeDetail.addEventListener("click", closeDetail);

  elements.mainContent.addEventListener("click", (event) => {
    if (!state.selectedId) return;
    const interactiveSelector = [
      "[data-task-id]",
      "button",
      "input",
      "select",
      "textarea",
      "label",
      "a",
      "dialog",
      ".dialog",
      ".timeline-actions"
    ].join(",");
    if (event.target.closest(interactiveSelector)) return;
    closeDetail();
  });
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
    status: normalizeStatus(task.status),
    priority: ["緊急", "高", "中", "低"].includes(task.priority) ? task.priority : "中",
    assignee: normalizeUser(task.assignee),
    category: normalizeCategory(task.category || "その他"),
    requester: task.requester || "",
    tags: Array.isArray(task.tags) ? task.tags : splitTags(task.tags || ""),
    checklist: normalizeChecklist(task.checklist),
    comments: normalizeComments(task.comments),
    history: Array.isArray(task.history) ? task.history : [],
    recurrence: ["none", "weekly", "monthly", "yearly"].includes(task.recurrence) ? task.recurrence : "none",
    nextRecurringTaskId: task.nextRecurringTaskId || "",
    dueDate: task.dueDate || "",
    dueTime: task.dueTime || "",
    pinned: Boolean(task.pinned),
    createdBy: normalizeUser(task.createdBy || task.assignee),
    createdAt: Number(task.createdAt || Date.now()),
    updatedBy: normalizeUser(task.updatedBy || task.createdBy || task.assignee),
    updatedAt: Number(task.updatedAt || Date.now()),
    completedAt: task.completedAt ? Number(task.completedAt) : 0,
    completedMemo: String(task.completedMemo || ""),
    knowledgeId: String(task.knowledgeId || "")
  };
}


function normalizeComments(comments) {
  return (Array.isArray(comments) ? comments : []).map(comment => ({
    id: comment.id || generateId(),
    author: normalizeUser(comment.author || getCurrentUser()),
    type: comment.type || "作業メモ",
    text: String(comment.text || ""),
    createdAt: Number(comment.createdAt || Date.now())
  }));
}

function normalizeKnowledge(item) {
  return {
    id: item.id || generateKnowledgeId(),
    taskId: String(item.taskId || ""),
    title: String(item.title || "名称未設定のナレッジ"),
    summary: String(item.summary || ""),
    symptom: String(item.symptom || ""),
    action: String(item.action || ""),
    checkpoint: String(item.checkpoint || ""),
    author: normalizeUser(item.author || getCurrentUser()),
    createdAt: Number(item.createdAt || Date.now())
  };
}

function generateKnowledgeId() {
  if (state.firebaseReady && state.dbApi && state.knowledgeRef) return push(state.knowledgeRef).key;
  return `knowledge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

async function persistKnowledge(item) {
  if (state.firebaseReady && state.dbApi) {
    await set(ref(state.db, `rooms/${ROOM_ID}/knowledge/${item.id}`), item);
  } else {
    const index = state.knowledge.findIndex(k => k.id === item.id);
    if (index >= 0) state.knowledge[index] = item;
    else state.knowledge.unshift(item);
    localStorage.setItem(knowledgeKey(), JSON.stringify(state.knowledge));
    render();
  }
}

async function createKnowledgeFromTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const action = prompt("ナレッジとして残す対応内容を入力してください。", task.completedMemo || task.description || "");
  if (action === null) return;
  const item = normalizeKnowledge({
    id: task.knowledgeId || generateKnowledgeId(),
    taskId: task.id,
    title: task.title,
    summary: task.description,
    symptom: task.description,
    action: action.trim(),
    checkpoint: (task.checklist || []).map(i => i.text).join(" / "),
    author: getCurrentUser(),
    createdAt: Date.now()
  });
  await persistKnowledge(item);
  task.knowledgeId = item.id;
  task.history = appendHistory(task.history, "タスクをナレッジ化しました。");
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
  toast("ナレッジを作成しました");
}

function getSchedulesForTask(taskId) {
  return state.schedules
    .filter(schedule => schedule.relatedTaskId === taskId)
    .sort((a,b) => new Date(a.startAt) - new Date(b.startAt));
}

function renderActivity(task, mode = "comments") {
  const history = (Array.isArray(task.history) ? task.history : []).map(item => ({ ...item, kind: "history", type: "履歴" }));
  const comments = (Array.isArray(task.comments) ? task.comments : []).map(item => ({ ...item, kind: "comment", type: item.type || "作業メモ" }));
  const items = (mode === "history" ? history : comments).sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (!items.length) {
    return mode === "history"
      ? `<p class="description compact-empty">対応履歴はまだありません。</p>`
      : `<p class="description compact-empty">コメントはまだありません。</p>`;
  }
  return items.map(item => {
    const label = item.kind === "comment" ? (item.type || "作業メモ") : "履歴";
    return `<div class="history-item activity-${item.kind}">
      <div class="comment-head compact-comment-head">
        <span class="activity-left">${userBadge(item.author)}<span class="activity-label inline-label">${escapeHtml(label)}</span></span>
        <span class="activity-time">${formatDateTime(item.createdAt)}</span>
      </div>
      <div class="activity-text">${escapeHtml(item.text)}</div>
    </div>`;
  }).join("");
}

async function duplicateTask(id) {
  const source = state.tasks.find(t => t.id === id);
  if (!source) return;
  const now = Date.now();
  const copy = normalizeTask({
    ...source,
    id: generateId(),
    title: `コピー：${source.title}`,
    status: getDefaultOpenStatus(),
    pinned: false,
    completedAt: 0,
    completedMemo: "",
    knowledgeId: "",
    comments: [],
    history: appendHistory([], `「${source.title}」を複製して作成しました。`),
    createdBy: getCurrentUser(),
    createdAt: now,
    updatedBy: getCurrentUser(),
    updatedAt: now
  });
  await persistTask(copy);
  state.selectedId = copy.id;
  state.layout = "tasks";
  render();
  toast("タスクを複製しました");
}

function openTaskDialogWithSeed(seed = {}) {
  openTaskDialog();
  if (seed.title) $("taskTitle").value = seed.title;
  if (seed.status && [...$("taskStatus").options].some(opt => opt.value === seed.status)) $("taskStatus").value = seed.status;
  if (seed.category && [...$("taskCategory").options].some(opt => opt.value === seed.category)) $("taskCategory").value = seed.category;
  if (seed.tags) $("taskTags").value = Array.isArray(seed.tags) ? seed.tags.join(", ") : seed.tags;
  if (seed.dueDate) $("taskDueDate").value = seed.dueDate;
}

async function quickAddTask() {
  const title = elements.quickAddInput?.value.trim();
  if (!title) return toast("件名を入力してください", true);
  const now = Date.now();
  const task = normalizeTask({
    id: generateId(),
    title,
    assignee: getCurrentUser(),
    status: getDefaultOpenStatus(),
    priority: "中",
    category: "未整理",
    requester: "未整理",
    tags: ["未整理"],
    description: "",
    checklist: [],
    comments: [],
    history: appendHistory([], "クイック追加で未整理タスクを作成しました。"),
    createdBy: getCurrentUser(),
    createdAt: now,
    updatedBy: getCurrentUser(),
    updatedAt: now
  });
  await persistTask(task);
  elements.quickAddInput.value = "";
  state.selectedId = task.id;
  toast("未整理タスクを追加しました");
}

const DEFAULT_SAVED_FILTERS = [
  { id: "default-mine", name: "自分の未完了", system: true, filter: { scope: "mine", assignee: "", status: "", priority: "", category: "", overdue: false, today: false, pin: false, q: "" } },
  { id: "default-urgent", name: "緊急対応", system: true, filter: { scope: "all", priority: "緊急", q: "" } },
  { id: "default-overdue", name: "期限超過", system: true, filter: { scope: "all", overdue: true, q: "" } },
  { id: "default-unsorted", name: "未整理", system: true, filter: { scope: "all", category: "", q: "未整理" } },
  { id: "default-vendor", name: "業者待ち", system: true, filter: { scope: "all", q: "業者待ち" } },
  { id: "default-today", name: "今日まで", system: true, filter: { scope: "all", today: true, q: "" } }
];

function loadSavedFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(savedFiltersKey()) || "[]");
    return Array.isArray(saved) ? saved.map(normalizeSavedFilter).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeSavedFilter(item) {
  if (!item || !item.name || !item.filter) return null;
  return {
    id: String(item.id || `filter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`),
    name: String(item.name || "表示条件").slice(0, 20),
    system: Boolean(item.system),
    filter: item.filter || {}
  };
}

function setSavedFilters(filters, options = {}) {
  state.savedFilters = (Array.isArray(filters) ? filters : []).map(normalizeSavedFilter).filter(Boolean);
  localStorage.setItem(savedFiltersKey(), JSON.stringify(state.savedFilters));
  if (options.persist !== false) saveSavedFilters();
  if (!options.silent) render();
}

async function saveSavedFilters() {
  localStorage.setItem(savedFiltersKey(), JSON.stringify(state.savedFilters));
  if (state.firebaseReady && state.dbApi) {
    await update(state.metaRef, { savedFilters: state.savedFilters, savedFiltersUpdatedAt: Date.now() });
  }
}

function allSavedFilters() {
  const customIds = new Set(state.savedFilters.map(f => f.id));
  return [...DEFAULT_SAVED_FILTERS.filter(f => !customIds.has(f.id)), ...state.savedFilters];
}

function renderSavedFilters() {
  if (!elements.savedFilterList) return;
  elements.savedFilterList.innerHTML = allSavedFilters().map(filter => `<div class="saved-filter-item">
    <button type="button" data-apply-filter="${escapeHtml(filter.id)}">${escapeHtml(filter.name)}</button>
    ${filter.system ? "" : `<button type="button" class="delete-saved-filter" data-delete-filter="${escapeHtml(filter.id)}">×</button>`}
  </div>`).join("");
}

function captureCurrentFilter() {
  return {
    scope: state.scope,
    assignee: elements.assigneeFilter.value,
    status: elements.statusFilter.value,
    priority: elements.priorityFilter.value,
    category: elements.categoryFilter.value,
    overdue: elements.overdueOnly.checked,
    today: elements.todayOnly.checked,
    pin: elements.pinOnly.checked,
    q: elements.searchInput.value,
    sort: elements.sortSelect.value
  };
}

function applyFilterValues(filter) {
  state.scope = filter.scope || "all";
  elements.assigneeFilter.value = filter.assignee || "";
  elements.statusFilter.value = filter.status || "";
  elements.priorityFilter.value = filter.priority || "";
  elements.categoryFilter.value = filter.category || "";
  elements.overdueOnly.checked = Boolean(filter.overdue);
  elements.todayOnly.checked = Boolean(filter.today);
  elements.pinOnly.checked = Boolean(filter.pin);
  elements.searchInput.value = filter.q || "";
  if (filter.sort) elements.sortSelect.value = filter.sort;
}

function applySavedFilter(id) {
  const item = allSavedFilters().find(filter => filter.id === id);
  if (!item) return;
  applyFilterValues(item.filter);
  render();
}

async function saveCurrentFilterFromPrompt() {
  const name = prompt("この表示条件の名前を入力してください。", "自分用フィルター");
  if (name === null) return;
  const clean = String(name).trim().slice(0, 20);
  if (!clean) return toast("名前を入力してください", true);
  state.savedFilters.push({ id: `filter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`, name: clean, filter: captureCurrentFilter() });
  await saveSavedFilters();
  renderSavedFilters();
  toast("表示条件を保存しました");
}

async function deleteSavedFilter(id) {
  state.savedFilters = state.savedFilters.filter(filter => filter.id !== id);
  await saveSavedFilters();
  renderSavedFilters();
}

function syncNavigationUi() {
  elements.navItems.forEach(item => {
    if (item.dataset.layout) item.classList.toggle("active", item.dataset.layout === state.layout);
    if (item.dataset.filter) item.classList.toggle("active", item.dataset.filter === state.scope);
  });
  (elements.taskViewButtons || []).forEach(item => {
    item.classList.toggle("active", item.dataset.taskLayout === state.taskLayout && state.layout === "tasks");
  });
}

function normalizeTaskLayout(layout) {
  return ["board", "list", "timeline"].includes(layout) ? layout : "board";
}

function render() {
  try {
    renderCore();
  } catch (error) {
    console.error("render failed", error);
    showRenderError(error);
  }
}

function renderCore() {
  syncUserUi();
  syncRoomUi();
  syncNavigationUi();
  renderSavedFilters();

  const isToday = state.layout === "today";
  const isTasks = state.layout === "tasks";
  const isDashboard = state.layout === "dashboard";
  const isSchedule = state.layout === "schedule";
  document.body.classList.toggle("today-mode", isToday);
  document.body.classList.toggle("task-mode", isTasks);
  document.body.classList.toggle("dashboard-mode", isDashboard);
  document.body.classList.toggle("schedule-mode", isSchedule);
  renderSummary();

  const tasks = getFilteredTasks();
  elements.todayView.hidden = !isToday;
  elements.boardView.hidden = !(isTasks && state.taskLayout === "board");
  elements.listView.hidden = !(isTasks && state.taskLayout === "list");
  elements.timelineView.hidden = !(isTasks && state.taskLayout === "timeline");
  elements.dashboardView.hidden = !isDashboard;
  elements.scheduleView.hidden = !isSchedule;

  if (isToday) {
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTodayView();
  } else if (isTasks && state.taskLayout === "list") {
    elements.todayView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderList(tasks);
  } else if (isTasks && state.taskLayout === "timeline") {
    elements.todayView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTimeline(tasks);
  } else if (isDashboard) {
    elements.todayView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderDashboard(getDashboardFilteredTasks());
  } else if (isSchedule) {
    elements.todayView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    renderScheduleView(getFilteredSchedules());
  } else if (isTasks && state.taskLayout === "board") {
    elements.todayView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderBoard(tasks);
  } else {
    state.layout = "today";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTodayView();
  }

  if (state.layout === "tasks") renderDetail();
}

function showRenderError(error) {
  const message = error?.message || String(error || "不明なエラー");
  const target = elements.todayView || elements.boardView || elements.mainContent;
  if (!target) return;

  [elements.todayView, elements.boardView, elements.listView, elements.timelineView, elements.dashboardView, elements.scheduleView].forEach(view => {
    if (!view) return;
    view.hidden = true;
    view.innerHTML = "";
  });

  target.hidden = false;
  target.innerHTML = `<section class="render-error">
    <h3>画面の描画中にエラーが発生しました</h3>
    <p>再読み込みしても改善しない場合は、今回の更新ファイルを確認してください。</p>
    <code>${escapeHtml(message)}</code>
  </section>`;
}

function renderSummary() {
  const now = startOfToday();
  const tasks = state.tasks;
  const open = tasks.filter(t => !isCompletedStatus(t.status)).length;
  const overdue = tasks.filter(t => !isCompletedStatus(t.status) && t.dueDate && toDate(t.dueDate) < now).length;
  const today = tasks.filter(t => !isCompletedStatus(t.status) && t.dueDate && toDate(t.dueDate).getTime() === now.getTime()).length;
  const mine = tasks.filter(t => !isCompletedStatus(t.status) && t.assignee === getCurrentUser()).length;
  elements.openCount.textContent = `${open}件`;
  elements.overdueCount.textContent = `${overdue}件`;
  elements.todayCount.textContent = `${today}件`;
  elements.myCount.textContent = `${mine}件`;
}



function renderTodayView() {
  const today = startOfToday();
  const todayIso = todayISO();
  const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status));
  const schedules = state.schedules
    .filter(s => scheduleLocalDate(s) === todayIso)
    .filter(s => state.scope !== "mine" || s.assignee === getCurrentUser())
    .sort((a,b) => new Date(a.startAt) - new Date(b.startAt));

  const overdue = openTasks.filter(isOverdue).sort(compareSmartTasks);
  const dueToday = openTasks.filter(isDueToday).sort(compareSmartTasks);
  const unsorted = openTasks.filter(isUnsortedTask).sort(compareSmartTasks);
  const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t)).sort(compareSmartTasks).slice(0, 10);

  elements.todayView.innerHTML = `
    <section class="today-head">
      <div>
        <h3>今日やること</h3>
        <p>${formatDateForDisplay(today)}の予定・期限・未整理をまとめて確認できます。</p>
      </div>
      <div class="today-head-actions">
        <button class="ghost-button" type="button" data-layout-jump="schedule">スケジュールを見る</button>
        <button class="primary-button" type="button" data-new-task>＋ 新しいタスク</button>
      </div>
    </section>

    <div class="today-grid">
      ${todayPanel("今日の予定", schedules.length ? schedules.map(scheduleCard).join("") : todayEmpty("今日の予定はありません。", "時間指定の説明会・打合せ・立会いはスケジュールへ登録します。", "予定を追加", "schedule"))}
      ${todayPanel("期限超過", overdue.length ? overdue.map(taskCard).join("") : todayEmpty("期限超過はありません。", "今すぐ対応すべき滞留タスクはありません。"))}
      ${todayPanel("今日までのタスク", dueToday.length ? dueToday.map(taskCard).join("") : todayEmpty("今日までのタスクはありません。", "本日締切のタスクはありません。"))}
      ${todayPanel("未整理ボックス", unsorted.length ? unsorted.map(taskCard).join("") : todayEmpty("未整理はありません。", "急ぎのメモや依頼はクイック追加で一旦ここへ入れられます。", "クイック追加", "quick"))}
      ${todayPanel("空き時間にやるタスク", spare.length ? spare.map(taskCard).join("") : todayEmpty("期限なしの作業はありません。", "急がない作業が出たら、期限なしで登録しておくと便利です。"))}
    </div>
  `;

  bindTaskCards(elements.todayView);
  bindScheduleCardsInRoot(elements.todayView);
  elements.todayView.querySelector("[data-new-task]")?.addEventListener("click", () => openTaskDialog());
  elements.todayView.querySelector("[data-layout-jump='schedule']")?.addEventListener("click", () => {
    state.layout = "schedule";
    render();
  });
  elements.todayView.querySelectorAll("[data-empty-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.emptyAction;
      if (action === "schedule") openScheduleDialog();
      else if (action === "quick") elements.quickAddInput?.focus();
      else openTaskDialog();
    });
  });
}

function todayPanel(title, body) {
  return `<section class="today-panel">
    <h4>${escapeHtml(title)}</h4>
    <div class="today-panel-body">${body}</div>
  </section>`;
}

function todayEmpty(title, desc, buttonText = "", action = "task") {
  return `<div class="today-empty">
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(desc)}</p>
    ${buttonText ? `<button type="button" class="ghost-button" data-empty-action="${escapeHtml(action)}">${escapeHtml(buttonText)}</button>` : ""}
  </div>`;
}

function isUnsortedTask(task) {
  const tokens = [task.category, task.requester, ...(task.tags || [])].map(normalizeText);
  return tokens.includes(normalizeText("未整理"));
}

function formatDateForDisplay(date) {
  return `${toISODate(date)}${formatWeekdaySuffix(date)}`;
}

function renderScheduleView(schedules) {
  const rangeLabel = formatScheduleRangeLabel();
  const modeLabel = SCHEDULE_DISPLAY_LABELS[state.scheduleDisplayMode] || "一覧";
  const body = state.scheduleDisplayMode === "calendar"
    ? renderScheduleCalendar(schedules)
    : renderScheduleList(schedules);

  elements.scheduleView.innerHTML = `
    <div class="schedule-head">
      <div>
        <h3>スケジュール</h3>
        <p>${escapeHtml(rangeLabel)} / ${escapeHtml(modeLabel)}で予定を確認できます。タスクとは別に、開始・終了時間で管理します。</p>
      </div>
      <div class="schedule-actions">
        <div class="schedule-control-group">
          <span>表示期間</span>
          <div class="segmented-buttons">
            <button type="button" class="schedule-range ${state.scheduleRange === "today" ? "active" : ""}" data-schedule-range="today">今日</button>
            <button type="button" class="schedule-range ${state.scheduleRange === "week" ? "active" : ""}" data-schedule-range="week">今週</button>
            <button type="button" class="schedule-range ${state.scheduleRange === "month" ? "active" : ""}" data-schedule-range="month">今月</button>
          </div>
        </div>

        <div class="schedule-control-group">
          <span>表示日を移動</span>
          <div class="segmented-buttons">
            <button type="button" class="schedule-range" data-schedule-move="prev">← 前へ</button>
            <button type="button" class="schedule-range" data-schedule-move="today">今日へ</button>
            <button type="button" class="schedule-range" data-schedule-move="next">次へ →</button>
          </div>
        </div>

        <div class="schedule-control-group">
          <span>表示形式</span>
          <div class="segmented-buttons">
            <button type="button" class="schedule-range ${state.scheduleDisplayMode === "list" ? "active" : ""}" data-schedule-mode="list">一覧</button>
            <button type="button" class="schedule-range ${state.scheduleDisplayMode === "calendar" ? "active" : ""}" data-schedule-mode="calendar">月カレンダー</button>
          </div>
        </div>

        <button type="button" class="primary-button schedule-new-button" data-new-schedule>＋ 新しい予定</button>
      </div>
    </div>

    ${body}
  `;

  elements.scheduleView.querySelectorAll("[data-schedule-range]").forEach(button => {
    button.addEventListener("click", () => {
      state.scheduleRange = button.dataset.scheduleRange;
      if (state.scheduleRange !== "month" && state.scheduleDisplayMode === "calendar") state.scheduleDisplayMode = "list";
      localStorage.setItem(scheduleRangeKey(), state.scheduleRange);
      localStorage.setItem(scheduleDisplayModeKey(), state.scheduleDisplayMode);
      render();
    });
  });
  elements.scheduleView.querySelectorAll("[data-schedule-move]").forEach(button => {
    button.addEventListener("click", () => moveScheduleAnchor(button.dataset.scheduleMove));
  });
  elements.scheduleView.querySelectorAll("[data-schedule-mode]").forEach(button => {
    button.addEventListener("click", () => setScheduleDisplayMode(button.dataset.scheduleMode));
  });
  elements.scheduleView.querySelector("[data-new-schedule]")?.addEventListener("click", () => openScheduleDialog());
  elements.scheduleView.querySelectorAll("[data-new-schedule-empty]").forEach(button => button.addEventListener("click", () => openScheduleDialog()));
  bindScheduleCardEvents();
}

function renderScheduleList(schedules) {
  const grouped = groupSchedulesByDate(schedules);
  return `<div class="schedule-list">
    ${schedules.length ? Object.entries(grouped).map(([date, items]) => scheduleDayGroup(date, items)).join("") : emptyScheduleMessage()}
  </div>`;
}

function renderScheduleCalendar(schedules) {
  const range = getScheduleRange();
  const monthStart = range.start;
  const monthEnd = range.end;
  const firstDay = monthStart.getDay();
  const totalDays = daysInMonth(monthStart);
  const today = todayISO();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(`<div class="calendar-cell muted"></div>`);
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const iso = toISODate(date);
    const items = schedules.filter(schedule => scheduleLocalDate(schedule) === iso);
    const dayClass = dayKindClass(date);
    const holidayName = getJapaneseHolidayName(date);
    cells.push(`<div class="calendar-cell ${iso === today ? "today" : ""} ${dayClass}" data-calendar-date="${escapeHtml(iso)}">
      <div class="calendar-date ${dayClass}">${day}${holidayName ? `<small>${escapeHtml(holidayName)}</small>` : ""}</div>
      <div class="calendar-items">
        ${items.slice(0, 4).map(schedule => `<button type="button" class="calendar-schedule" data-schedule-id="${escapeHtml(schedule.id)}">
          <span>${escapeHtml(formatScheduleTime(schedule.startAt))}</span>${escapeHtml(schedule.title)}
        </button>`).join("")}
        ${items.length > 4 ? `<small>＋${items.length - 4}件</small>` : ""}
      </div>
    </div>`);
  }

  return `<section class="schedule-calendar">
    <div class="calendar-head">
      <h4>${monthStart.getFullYear()}年 ${monthStart.getMonth()+1}月</h4>
      <span>${schedules.filter(s => {
        const start = new Date(s.startAt);
        return start >= monthStart && start < monthEnd;
      }).length}件</span>
    </div>
    <div class="calendar-weekdays">
      ${["日","月","火","水","木","金","土"].map((d, index) => `<span class="${index === 0 ? "sunday" : index === 6 ? "saturday" : ""}">${d}</span>`).join("")}
    </div>
    <div class="calendar-grid">${cells.join("")}</div>
  </section>`;
}

function setScheduleDisplayMode(mode) {
  state.scheduleDisplayMode = normalizeScheduleDisplayMode(mode);
  if (state.scheduleDisplayMode === "calendar") state.scheduleRange = "month";
  localStorage.setItem(scheduleDisplayModeKey(), state.scheduleDisplayMode);
  localStorage.setItem(scheduleRangeKey(), state.scheduleRange);
  render();
}

function normalizeScheduleDisplayMode(mode) {
  return ["list", "calendar"].includes(mode) ? mode : "list";
}

function bindScheduleCardsInRoot(root) {
  root.querySelectorAll("[data-related-task-id]").forEach(button => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      navigateToTask(button.dataset.relatedTaskId);
    });
  });
  root.querySelectorAll("[data-schedule-id]").forEach(card => {
    card.addEventListener("click", () => {
      const schedule = state.schedules.find(s => s.id === card.dataset.scheduleId);
      if (schedule) openScheduleDialog(schedule);
    });
  });
}

function bindScheduleCardEvents() {
  elements.scheduleView.querySelectorAll("[data-related-task-id]").forEach(button => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      navigateToTask(button.dataset.relatedTaskId);
    });
  });
  elements.scheduleView.querySelectorAll("[data-schedule-id]").forEach(card => {
    card.addEventListener("click", () => {
      const schedule = state.schedules.find(s => s.id === card.dataset.scheduleId);
      if (schedule) openScheduleDialog(schedule);
    });
  });
  elements.scheduleView.querySelectorAll("[data-calendar-date]").forEach(cell => {
    cell.addEventListener("dblclick", (event) => {
      if (event.target.closest("[data-schedule-id]")) return;
      openScheduleDialog(newScheduleSeedForDate(cell.dataset.calendarDate));
    });
  });
}

function moveScheduleAnchor(direction) {
  if (direction === "today") {
    state.scheduleAnchor = todayISO();
  } else {
    const base = getScheduleAnchorDate();
    if (state.scheduleRange === "month") {
      state.scheduleAnchor = toISODate(addMonths(startOfMonth(base), direction === "next" ? 1 : -1));
    } else if (state.scheduleRange === "week") {
      state.scheduleAnchor = toISODate(addDays(base, direction === "next" ? 7 : -7));
    } else {
      state.scheduleAnchor = toISODate(addDays(base, direction === "next" ? 1 : -1));
    }
  }
  localStorage.setItem(scheduleAnchorKey(), state.scheduleAnchor);
  render();
}


function scheduleDayGroup(date, items, options = {}) {
  const day = parseISODate(date);
  const dayClass = day ? dayKindClass(day) : "";
  const holidayName = day ? getJapaneseHolidayName(day) : "";
  const dayLabel = day ? `${date}（${["日","月","火","水","木","金","土"][day.getDay()]}）` : date;
  return `<section class="schedule-day ${options.showEmpty ? "day-expanded" : ""}">
    <h4><span class="schedule-day-label ${dayClass}">${escapeHtml(dayLabel)}${holidayName ? `<small>${escapeHtml(holidayName)}</small>` : ""}</span><span>${items.length}件</span></h4>
    <div class="schedule-cards">${items.length ? items.map(scheduleCard).join("") : (options.showEmpty ? emptyScheduleMessage("この日の予定はありません。") : "")}</div>
  </section>`;
}

function scheduleCard(schedule) {
  const related = getRelatedTaskTitle(schedule.relatedTaskId);
  return `<article class="schedule-card" data-schedule-id="${escapeHtml(schedule.id)}">
    <div class="schedule-time">
      <strong>${escapeHtml(formatScheduleTime(schedule.startAt))}</strong>
      <span>${escapeHtml(formatScheduleTime(schedule.endAt))}</span>
    </div>
    <div class="schedule-main">
      <h5>${escapeHtml(schedule.title)}</h5>
      <div class="task-meta">
        ${userBadge(schedule.assignee)}
        ${categoryBadge(schedule.category)}
        ${schedule.location ? `<span class="badge location-badge">📍 ${escapeHtml(schedule.location)}</span>` : ""}
        ${relatedTaskButton(schedule)}
      </div>
      ${schedule.memo ? `<p>${escapeHtml(schedule.memo)}</p>` : ""}
    </div>
  </article>`;
}

function emptyScheduleMessage(title = "予定はありません。") {
  return `<div class="empty-schedule">
    <strong>${escapeHtml(title)}</strong>
    <p>日時が決まっている説明会・打合せ・立会いなどは、ここに登録できます。</p>
    <button type="button" class="ghost-button" data-new-schedule-empty>＋ 予定を追加</button>
  </div>`;
}

function getFilteredSchedules() {
  const range = getScheduleRange();
  return state.schedules
    .filter(schedule => {
      const start = new Date(schedule.startAt);
      if (Number.isNaN(start.getTime())) return false;
      if (start < range.start || start >= range.end) return false;
      if (state.scope === "mine" && schedule.assignee !== getCurrentUser()) return false;
      if (elements.assigneeFilter.value && schedule.assignee !== elements.assigneeFilter.value) return false;
      if (elements.categoryFilter.value && schedule.category !== elements.categoryFilter.value) return false;
      const q = normalizeText(elements.searchInput.value);
      if (q) {
        const hay = normalizeText([schedule.title, schedule.memo, schedule.location, schedule.category, schedule.assignee, getRelatedTaskTitle(schedule.relatedTaskId)].join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

function getScheduleRange() {
  const anchor = getScheduleAnchorDate();
  if (state.scheduleRange === "week") {
    const start = startOfWeekMonday(anchor);
    return { start, end: addDays(start, 7) };
  }
  if (state.scheduleRange === "month") {
    const start = startOfMonth(anchor);
    return { start, end: addMonths(start, 1) };
  }
  const start = new Date(anchor);
  start.setHours(0,0,0,0);
  return { start, end: addDays(start, 1) };
}

function groupSchedulesByDate(schedules) {
  return schedules.reduce((acc, schedule) => {
    const key = schedule.startAt ? scheduleLocalDate(schedule) : "日付未設定";
    if (!acc[key]) acc[key] = [];
    acc[key].push(schedule);
    return acc;
  }, {});
}

function openScheduleDialog(schedule = null) {
  const editing = Boolean(schedule?.id);
  elements.scheduleDialogTitle.textContent = editing ? "予定を編集" : "新しい予定";
  syncUserOptions($("scheduleAssignee"));
  syncCategoryOptions($("scheduleCategory"));
  syncScheduleRelatedTaskOptions();

  $("scheduleId").value = schedule?.id || "";
  $("scheduleTitle").value = schedule?.title || "";
  $("scheduleStart").value = toDateTimeLocalValue(schedule?.startAt || defaultScheduleStart());
  $("scheduleEnd").value = toDateTimeLocalValue(schedule?.endAt || getOneHourAfter(schedule?.startAt || defaultScheduleStart()));
  $("scheduleAssignee").value = schedule?.assignee || getCurrentUser();
  $("scheduleLocation").value = schedule?.location || "";
  $("scheduleCategory").value = schedule?.category || state.categories[0] || "その他";
  $("scheduleMemo").value = schedule?.memo || "";
  $("scheduleRelatedTask").value = schedule?.relatedTaskId || "";
  elements.openRelatedTaskFromSchedule.hidden = !schedule?.relatedTaskId;
  elements.createTaskFromSchedule.hidden = !editing;
  elements.deleteSchedule.hidden = !editing;
  elements.scheduleDialog.showModal();
  $("scheduleTitle").focus();
}

async function saveScheduleFromForm() {
  const id = $("scheduleId").value || generateScheduleId();
  const existing = state.schedules.find(s => s.id === id);
  const schedule = normalizeSchedule({
    id,
    title: $("scheduleTitle").value.trim(),
    startAt: new Date($("scheduleStart").value).toISOString(),
    endAt: new Date($("scheduleEnd").value).toISOString(),
    assignee: $("scheduleAssignee").value,
    location: $("scheduleLocation").value.trim(),
    category: $("scheduleCategory").value,
    memo: $("scheduleMemo").value.trim(),
    relatedTaskId: $("scheduleRelatedTask").value,
    createdAt: existing?.createdAt || Date.now(),
    createdBy: existing?.createdBy || getCurrentUser(),
    updatedAt: Date.now(),
    updatedBy: getCurrentUser()
  });

  if (!schedule.title) return toast("予定の件名を入力してください", true);
  if (!schedule.startAt || !schedule.endAt) return toast("開始日時と終了日時を入力してください", true);
  if (new Date(schedule.endAt) <= new Date(schedule.startAt)) return toast("終了日時は開始日時より後にしてください", true);

  const conflicts = getScheduleConflicts(schedule);
  if (conflicts.length) {
    const conflictText = conflicts.slice(0, 3).map(item => `・${formatScheduleTime(item.startAt)}〜${formatScheduleTime(item.endAt)} ${item.title}`).join("\n");
    if (!confirm(`同じ担当者の予定と時間が重なっています。\n\n${conflictText}\n\nこのまま保存しますか？`)) return;
  }

  await persistSchedule(schedule);
  elements.scheduleDialog.close();
  toast("予定を保存しました");
}

function syncScheduleEndFromStart() {
  const startValue = $("scheduleStart").value;
  if (!startValue) return;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return;

  const endValue = $("scheduleEnd").value;
  const end = endValue ? new Date(endValue) : null;

  // 終了日時が未入力、または開始日時以前になってしまう場合だけ、
  // 開始日時の1時間後へ自動補正する。
  // 既に終了日時が開始日時より未来なら、長時間予定として扱い、終了日時は動かさない。
  if (!end || Number.isNaN(end.getTime()) || end <= start) {
    $("scheduleEnd").value = toDateTimeLocalValue(addHours(start, 1).toISOString());
  }
}

function getScheduleAnchorDate() {
  return parseISODate(state.scheduleAnchor) || startOfToday();
}

function startOfWeekMonday(date) {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  start.setHours(0,0,0,0);
  return start;
}

function datesBetween(start, end) {
  const dates = [];
  for (let d = new Date(start); d < end; d = addDays(d, 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

function formatScheduleRangeLabel() {
  const range = getScheduleRange();
  const start = toISODate(range.start);
  const endDate = addDays(range.end, -1);
  const end = toISODate(endDate);
  if (state.scheduleRange === "today") return start;
  if (state.scheduleRange === "week") return `${start} - ${end}`;
  if (state.scheduleRange === "month") return `${range.start.getFullYear()}年${range.start.getMonth()+1}月`;
  return start;
}

function scheduleLocalDate(schedule) {
  const date = new Date(schedule.startAt);
  return Number.isNaN(date.getTime()) ? "" : toISODate(date);
}

function newScheduleSeedForDate(isoDate) {
  const start = new Date(`${isoDate}T09:00`);
  const startAt = Number.isNaN(start.getTime()) ? defaultScheduleStart() : start.toISOString();
  return {
    title: "",
    startAt,
    endAt: getOneHourAfter(startAt),
    assignee: getCurrentUser(),
    location: "",
    category: state.categories[0] || "その他",
    memo: "",
    relatedTaskId: ""
  };
}

function relatedTaskButton(schedule) {
  const related = getRelatedTaskTitle(schedule.relatedTaskId);
  return related ? `<button type="button" class="badge related-badge related-task-button" data-related-task-id="${escapeHtml(schedule.relatedTaskId)}">関連：${escapeHtml(related)}</button>` : "";
}

function navigateToTask(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return toast("関連タスクが見つかりません", true);

  elements.searchInput.value = task.title;
  elements.assigneeFilter.value = "";
  elements.statusFilter.value = "";
  elements.priorityFilter.value = "";
  elements.categoryFilter.value = "";
  elements.overdueOnly.checked = false;
  elements.todayOnly.checked = false;
  elements.pinOnly.checked = false;

  if (isCompletedStatus(task.status)) state.scope = "done";
  else if (task.assignee === getCurrentUser()) state.scope = "mine";
  else state.scope = "all";

  state.layout = "tasks";
  state.taskLayout = "list";
  localStorage.setItem(taskLayoutKey(), state.taskLayout);
  state.selectedId = task.id;
  render();
  toast("関連タスクを表示しました");
}

function getScheduleConflicts(schedule) {
  const start = new Date(schedule.startAt);
  const end = new Date(schedule.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  return state.schedules.filter(item => {
    if (item.id === schedule.id) return false;
    if (item.assignee !== schedule.assignee) return false;
    const otherStart = new Date(item.startAt);
    const otherEnd = new Date(item.endAt);
    if (Number.isNaN(otherStart.getTime()) || Number.isNaN(otherEnd.getTime())) return false;
    return start < otherEnd && end > otherStart;
  });
}

function openTaskDialogFromSchedule(schedule) {
  if (!schedule) return;
  elements.scheduleDialog.close();
  state.pendingScheduleTaskLink = schedule.id;
  openTaskDialog();
  $("taskTitle").value = `${schedule.title}の準備`;
  $("taskAssignee").value = schedule.assignee || getCurrentUser();
  $("taskPriority").value = "中";
  if ([...$("taskCategory").options].some(opt => opt.value === schedule.category)) $("taskCategory").value = schedule.category;
  const start = new Date(schedule.startAt);
  if (!Number.isNaN(start.getTime())) {
    $("taskDueDate").value = toISODate(start);
    $("taskDueTime").value = `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}`;
  }
  $("taskTags").value = "予定関連";
  $("taskDescription").value = [
    `関連予定：${schedule.title}`,
    `日時：${formatScheduleDateTimeRange(schedule)}`,
    schedule.location ? `場所：${schedule.location}` : "",
    schedule.memo ? `メモ：${schedule.memo}` : ""
  ].filter(Boolean).join("\n");
  $("taskChecklist").value = ["準備内容確認", "関係者へ連絡", "当日対応", "完了確認"].join("\n");
}

function openScheduleDialogFromTask(task) {
  if (!task) return;
  let startAt = defaultScheduleStart();
  if (task.dueDate) {
    const time = task.dueTime || "09:00";
    startAt = new Date(`${task.dueDate}T${time}`).toISOString();
  }
  openScheduleDialog({
    title: task.title,
    startAt,
    endAt: getOneHourAfter(startAt),
    assignee: task.assignee,
    location: "",
    category: task.category,
    memo: [
      task.requester ? `依頼元：${task.requester}` : "",
      task.description || ""
    ].filter(Boolean).join("\n"),
    relatedTaskId: task.id
  });
}

function formatScheduleDateTimeRange(schedule) {
  const start = new Date(schedule.startAt);
  const end = new Date(schedule.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return `${toISODate(start)} ${formatScheduleTime(schedule.startAt)}〜${formatScheduleTime(schedule.endAt)}`;
}

function getOneHourAfter(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return defaultScheduleEnd();
  return addHours(date, 1).toISOString();
}

function normalizeSchedule(schedule) {
  const startAt = schedule.startAt && !Number.isNaN(new Date(schedule.startAt).getTime()) ? schedule.startAt : defaultScheduleStart();
  const endAt = schedule.endAt && !Number.isNaN(new Date(schedule.endAt).getTime()) ? schedule.endAt : defaultScheduleEnd();
  return {
    id: schedule.id || generateScheduleId(),
    title: String(schedule.title || "").trim() || "名称未設定の予定",
    startAt,
    endAt,
    assignee: normalizeUser(schedule.assignee || getCurrentUser()),
    location: String(schedule.location || "").trim(),
    category: state.categories.includes(schedule.category) ? schedule.category : (schedule.category || state.categories[0] || "その他"),
    memo: String(schedule.memo || "").trim(),
    relatedTaskId: String(schedule.relatedTaskId || ""),
    createdAt: Number(schedule.createdAt) || Date.now(),
    createdBy: schedule.createdBy || getCurrentUser(),
    updatedAt: Number(schedule.updatedAt) || Date.now(),
    updatedBy: schedule.updatedBy || getCurrentUser()
  };
}

async function persistSchedule(schedule) {
  if (state.firebaseReady && state.dbApi) {
    await set(ref(state.db, `rooms/${ROOM_ID}/schedules/${schedule.id}`), schedule);
  } else {
    const index = state.schedules.findIndex(s => s.id === schedule.id);
    if (index >= 0) state.schedules[index] = schedule;
    else state.schedules.unshift(schedule);
    localStorage.setItem(schedulesKey(), JSON.stringify(state.schedules));
    render();
  }
}

async function deleteSchedule(id) {
  if (state.firebaseReady && state.dbApi) {
    await remove(ref(state.db, `rooms/${ROOM_ID}/schedules/${id}`));
  } else {
    state.schedules = state.schedules.filter(s => s.id !== id);
    localStorage.setItem(schedulesKey(), JSON.stringify(state.schedules));
    render();
  }
  toast("予定を削除しました");
}

function loadLocalSchedules() {
  try {
    state.schedules = JSON.parse(localStorage.getItem(schedulesKey()) || "[]").map(normalizeSchedule);
  } catch {
    state.schedules = [];
  }
  render();
}

function syncScheduleRelatedTaskOptions() {
  const select = $("scheduleRelatedTask");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">関連タスクなし</option>${state.tasks.map(task => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join("")}`;
  if ([...select.options].some(opt => opt.value === current)) select.value = current;
}

function getRelatedTaskTitle(id) {
  if (!id) return "";
  return state.tasks.find(task => task.id === id)?.title || "";
}

function generateScheduleId() {
  if (state.firebaseReady && state.dbApi && state.schedulesRef) return push(state.schedulesRef).key;
  return `schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

function defaultScheduleStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function defaultScheduleEnd() {
  const d = new Date(defaultScheduleStart());
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function toDateTimeLocalValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduleTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const SCHEDULE_RANGE_LABELS = { today: "今日", week: "今週", month: "今月" };
const SCHEDULE_DISPLAY_LABELS = { list: "一覧", day: "日別", calendar: "月カレンダー" };

function dashboardScopeText() {
  if (state.scope === "mine") return `${getCurrentUser()}さん担当`;
  if (state.scope === "done") return "完了タスク";
  const parts = [];
  if (elements.assigneeFilter?.value) parts.push(`${elements.assigneeFilter.value}さん担当`);
  if (elements.statusFilter?.value) parts.push(`状態：${elements.statusFilter.value}`);
  if (elements.priorityFilter?.value) parts.push(`優先度：${elements.priorityFilter.value}`);
  if (elements.categoryFilter?.value) parts.push(`分類：${elements.categoryFilter.value}`);
  if (elements.overdueOnly?.checked) parts.push("期限超過");
  if (elements.todayOnly?.checked) parts.push("今日まで");
  if (elements.pinOnly?.checked) parts.push("固定のみ");
  return parts.length ? parts.join(" / ") : "全体";
}

function renderDashboard(tasks) {
  // ダッシュボードも、左メニューの「自分の担当」「完了」や各種絞り込みを反映する。
  // 以前は state.tasks を直接参照していたため、常に全体集計になっていた。
  const sourceTasks = Array.isArray(tasks) ? tasks : [];
  const open = sourceTasks.filter(t => !isCompletedStatus(t.status));
  const completed = sourceTasks.filter(t => isCompletedStatus(t.status));
  const stale = open.filter(isStale);
  const completedThisMonth = completed.filter(isCompletedThisMonth);
  const byAssignee = countBy(open, "assignee");
  const byCategory = countBy(open, "category");
  const byStatus = countBy(open, "status");
  const scopeText = dashboardScopeText();

  elements.dashboardView.innerHTML = `
    <div class="dashboard-head">
      <div>
        <h3>ダッシュボード</h3>
        <p>${escapeHtml(scopeText)}の未完了・滞留・担当別の状況をまとめて確認できます。</p>
      </div>
      <button class="ghost-button" type="button" data-dashboard-refresh>更新</button>
    </div>

    <div class="dashboard-kpis">
      ${dashboardKpi("未完了", `${open.length}件`, "対応が必要なタスク")}
      ${dashboardKpi("期限超過", `${open.filter(isOverdue).length}件`, "期限を過ぎています", "danger")}
      ${dashboardKpi("今日まで", `${open.filter(isDueToday).length}件`, "本日中に確認")}
      ${dashboardKpi("放置気味", `${stale.length}件`, `${STALE_DAYS}日以上更新なし`, "warning")}
      ${dashboardKpi("今月完了", `${completedThisMonth.length}件`, "今月完了したタスク", "success")}
    </div>

    <div class="dashboard-grid">
      ${dashboardPanel("担当者別 未完了", renderCountBars(byAssignee, open.length, "user"))}
      ${dashboardPanel("分類別 未完了", renderCountBars(byCategory, open.length))}
      ${dashboardPanel("状態別 未完了", renderCountBars(byStatus, open.length))}
      ${dashboardPanel("見落とし注意", renderAttentionList(open))}
      ${dashboardPanel("未整理ボックス", renderUnsortedList(open))}
      ${dashboardPanel("最近のナレッジ", renderKnowledgeList())}
    </div>
  `;

  elements.dashboardView.querySelector("[data-dashboard-refresh]")?.addEventListener("click", render);
  elements.dashboardView.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", () => selectTask(el.dataset.taskId));
    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      openTaskEditorById(el.dataset.taskId);
    });
  });
  elements.dashboardView.querySelectorAll("[data-knowledge-task]").forEach(el => {
    el.addEventListener("click", () => navigateToTask(el.dataset.knowledgeTask));
  });
}

function dashboardKpi(label, value, note, type = "") {
  return `<article class="dashboard-kpi ${type}">
    <small>${escapeHtml(label)}</small>
    <strong>${escapeHtml(value)}</strong>
    <span>${escapeHtml(note)}</span>
  </article>`;
}

function dashboardPanel(title, body) {
  return `<section class="dashboard-panel">
    <h4>${escapeHtml(title)}</h4>
    ${body}
  </section>`;
}

function renderCountBars(counts, total, mode = "") {
  const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  if (!entries.length) return `<p class="dashboard-empty">対象はありません。</p>`;
  return `<div class="count-bars">${entries.map(([name, count]) => {
    const percent = total ? Math.round(count / total * 100) : 0;
    return `<div class="count-row">
      <div class="count-label">${mode === "user" ? userBadge(name) : `<strong>${escapeHtml(name)}</strong>`}<span>${count}件</span></div>
      <div class="count-bar"><span style="width:${percent}%"></span></div>
    </div>`;
  }).join("")}</div>`;
}

function renderAttentionList(tasks) {
  const important = [...tasks]
    .filter(t => isOverdue(t) || isDueToday(t) || isStale(t) || t.priority === "緊急")
    .sort(compareSmartTasks)
    .slice(0, 8);
  if (!important.length) return `<p class="dashboard-empty">注意が必要なタスクはありません。</p>`;
  return `<div class="attention-list">${important.map(task => `<button type="button" class="attention-item" data-task-id="${escapeHtml(task.id)}">
    <strong>${escapeHtml(task.title)}</strong>
    <span>${priorityBadge(task.priority)} ${isOverdue(task) ? `<span class="badge priority-緊急">期限超過</span>` : ""}${isDueToday(task) ? `<span class="badge due-today-badge">今日まで</span>` : ""}${isStale(task) ? `<span class="badge stale-badge">放置気味</span>` : ""}</span>
  </button>`).join("")}</div>`;
}

function renderUnsortedList(tasks) {
  const items = tasks.filter(isUnsortedTask).slice(0, 8);
  if (!items.length) return `<p class="dashboard-empty">未整理のタスクはありません。</p>`;
  return `<div class="attention-list">${items.map(task => `<button type="button" class="attention-item" data-task-id="${escapeHtml(task.id)}">
    <strong>${escapeHtml(task.title)}</strong>
    <span>${userBadge(task.assignee)} ${priorityBadge(task.priority)}</span>
  </button>`).join("")}</div>`;
}

function renderKnowledgeList(limit = 6) {
  const items = [...state.knowledge].sort((a,b) => b.createdAt - a.createdAt).slice(0, limit);
  if (!items.length) return `<p class="dashboard-empty">ナレッジはまだありません。</p>`;
  return `<div class="knowledge-list">${items.map(item => `<article class="knowledge-card" data-knowledge-task="${escapeHtml(item.taskId)}">
    <strong>${escapeHtml(item.title)}</strong>
    <p>${escapeHtml(item.action || item.summary || "対応内容未入力")}</p>
    <small>${formatDateTime(item.createdAt)} / ${escapeHtml(item.author)}</small>
  </article>`).join("")}</div>`;
}

function countBy(tasks, key) {
  return tasks.reduce((acc, task) => {
    const value = task[key] || "未入力";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}


function renderBoard(tasks) {
  const statuses = getStatusList();
  const visibleStatuses = state.scope === "done"
    ? statuses.filter(isCompletedStatus)
    : statuses.filter(status => !isCompletedStatus(status));

  const columns = visibleStatuses.map(status => {
    const list = tasks.filter(t => t.status === status);
    return `<section class="board-column" data-drop-kind="status" data-drop-value="${escapeHtml(status)}" data-status="${escapeHtml(status)}">
      <div class="column-head">
        <span class="column-title">
          <span class="column-drag-handle" draggable="true" data-drag-kind="status" data-drag-value="${escapeHtml(status)}" title="ドラッグして状態の順番を変更">☰</span>
          <span>${escapeHtml(status)}</span>
        </span>
        <em>${list.length}</em>
      </div>
      <div class="task-list">${list.map(taskCard).join("") || emptyColumn(status)}</div>
    </section>`;
  }).join("");

  const addColumn = state.scope === "done" ? "" : `<section class="board-column add-status-column">
    <button type="button" data-add-status>＋ セクション追加</button>
    <p>新しい状態を追加できます。</p>
  </section>`;

  elements.boardView.innerHTML = columns + addColumn;
  bindTaskCards(elements.boardView);
  elements.boardView.querySelectorAll("[data-empty-status]").forEach(button => {
    button.addEventListener("click", () => openTaskDialogWithSeed({ status: button.dataset.emptyStatus }));
  });
  elements.boardView.querySelector("[data-add-status]")?.addEventListener("click", () => {
    renderStatusManager();
    elements.statusManageDialog.showModal();
    elements.newStatusName.focus();
  });

  bindReorder(elements.boardView, {
    kind: "status",
    handleSelector: "[data-drag-kind='status']",
    dropSelector: "[data-drop-kind='status']",
    onReorder: reorderStatuses
  });
}


function openTaskDialogFromTimeline(date, status) {
  state.layout = "tasks";
  state.taskLayout = "timeline";
  localStorage.setItem(taskLayoutKey(), state.taskLayout);
  openTaskDialog();
  if ([...$("taskStatus").options].some(opt => opt.value === status)) $("taskStatus").value = status;
  $("taskAssignee").value = getCurrentUser();
  $("taskDueDate").value = date || "";
  $("taskDueTime").value = "";
  $("taskTitle").placeholder = `${date || ""} / ${status || ""} のタスク`;
  toast("日付と状態を反映しました");
}

function renderTimeline(tasks) {
  const start = getTimelineStartDate();
  const timelineDays = getTimelineDays(start);
  const dates = Array.from({ length: timelineDays }, (_, index) => addDays(start, index));
  const statuses = state.scope === "done"
    ? getStatusList().filter(isCompletedStatus)
    : getStatusList().filter(status => !isCompletedStatus(status));

  const dateHeaders = dates.map(date => {
    const dayClass = dayKindClass(date);
    const holidayName = getJapaneseHolidayName(date);
    return `<div class="timeline-date ${isTodayDate(date) ? "today" : ""} ${dayClass}">
      <strong>${date.getDate()}</strong>
      <span>${["日","月","火","水","木","金","土"][date.getDay()]}${holidayName ? "・" + escapeHtml(holidayName) : ""}</span>
    </div>`;
  }).join("");

  const rows = statuses.map(status => {
    const cells = dates.map(date => {
      const iso = toISODate(date);
      const dayTasks = tasks.filter(task => task.status === status && task.dueDate === iso);
      const dayClass = dayKindClass(date);
      return `<div class="timeline-cell ${isTodayDate(date) ? "today" : ""} ${dayClass}" data-timeline-date="${escapeHtml(iso)}" data-timeline-status="${escapeHtml(status)}">
        ${dayTasks.map(timelineTask).join("")}
      </div>`;
    }).join("");
    return `<div class="timeline-row-label">${escapeHtml(status)}<em>${tasks.filter(task => task.status === status).length}</em></div>${cells}`;
  }).join("");

  const undated = tasks.filter(task => !task.dueDate);
  const rangeLabel = `${formatMonthDay(dates[0])} - ${formatMonthDay(dates[dates.length - 1])}`;

  elements.timelineView.innerHTML = `
    <div class="timeline-toolbar">
      <div>
        <strong>タイムライン</strong>
        <span>${escapeHtml(rangeLabel)}</span>
      </div>
      <div class="timeline-actions">
        <select class="timeline-range-select" data-timeline-range aria-label="タイムライン表示範囲">
          <option value="14" ${state.timelineRange === "14" ? "selected" : ""}>14日</option>
          <option value="month" ${state.timelineRange === "month" ? "selected" : ""}>1か月</option>
        </select>
        <button type="button" data-timeline-prev>← 前へ</button>
        <button type="button" data-timeline-today>今日</button>
        <button type="button" data-timeline-next>次へ →</button>
      </div>
    </div>

    <div class="timeline-scroller">
      <div class="timeline-grid" style="--timeline-days:${timelineDays}">
        <div class="timeline-corner">状態</div>
        ${dateHeaders}
        ${rows || `<div class="timeline-empty">表示対象の状態がありません。</div>`}
      </div>
    </div>

    <section class="timeline-undated">
      <div class="timeline-undated-head">
        <strong>期限なし</strong>
        <span>${undated.length}件</span>
      </div>
      <div class="timeline-undated-list">
        ${undated.length ? undated.map(timelineTask).join("") : `<p>期限なしのタスクはありません。</p>`}
      </div>
    </section>
  `;

  elements.timelineView.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", () => selectTask(el.dataset.taskId));
    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      openTaskEditorById(el.dataset.taskId);
    });
  });
  elements.timelineView.querySelectorAll("[data-timeline-date][data-timeline-status]").forEach(cell => {
    cell.addEventListener("dblclick", (event) => {
      if (event.target.closest("[data-task-id]")) return;
      openTaskDialogFromTimeline(cell.dataset.timelineDate, cell.dataset.timelineStatus);
    });
  });
  elements.timelineView.querySelector("[data-timeline-prev]")?.addEventListener("click", () => shiftTimeline(-1));
  elements.timelineView.querySelector("[data-timeline-today]")?.addEventListener("click", () => setTimelineStart(state.timelineRange === "month" ? toISODate(startOfMonth(startOfToday())) : todayISO()));
  elements.timelineView.querySelector("[data-timeline-next]")?.addEventListener("click", () => shiftTimeline(1));
  elements.timelineView.querySelector("[data-timeline-range]")?.addEventListener("change", (event) => setTimelineRange(event.target.value));
}

function timelineTask(task) {
  return `<button type="button" class="timeline-task timeline-task-compact priority-line-${escapeHtml(task.priority)}" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(task.title)}">
    <span class="timeline-task-line">
      ${userAvatarOnly(task.assignee)}
      ${priorityBadge(task.priority)}
      <strong>${escapeHtml(task.title)}</strong>
    </span>
  </button>`;
}

function userAvatarOnly(name) {
  const user = normalizeUser(name);
  return `<span class="timeline-user-avatar" style="--user-color:${escapeHtml(userColor(user))}" title="${escapeHtml(user)}">${escapeHtml(user.slice(0,1))}</span>`;
}

function getTimelineStartDate() {
  const base = parseISODate(state.timelineStart) || startOfToday();
  return state.timelineRange === "month" ? startOfMonth(base) : base;
}

function getTimelineDays(startDate = getTimelineStartDate()) {
  if (state.timelineRange === "month") return daysInMonth(startDate);
  return TIMELINE_RANGES["14"];
}

function getTimelineStepDays() {
  return state.timelineRange === "month" ? daysInMonth(getTimelineStartDate()) : 7;
}

function setTimelineRange(value) {
  state.timelineRange = TIMELINE_RANGES[value] ? value : "14";
  if (state.timelineRange === "month") {
    state.timelineStart = toISODate(startOfMonth(parseISODate(state.timelineStart) || startOfToday()));
    localStorage.setItem(timelineStartKey(), state.timelineStart);
  }
  localStorage.setItem(timelineRangeKey(), state.timelineRange);
  render();
}


function shiftTimeline(direction) {
  const base = getTimelineStartDate();
  if (state.timelineRange === "month") {
    setTimelineStart(toISODate(addMonths(base, direction)));
    return;
  }
  setTimelineStart(toISODate(addDays(base, direction * 7)));
}

function setTimelineStart(value) {
  const date = parseISODate(value) || startOfToday();
  state.timelineStart = state.timelineRange === "month" ? toISODate(startOfMonth(date)) : toISODate(date);
  localStorage.setItem(timelineStartKey(), state.timelineStart);
  render();
}


function renderList(tasks) {
  elements.listView.innerHTML = `
    <div class="bulk-bar" data-bulk-bar hidden>
      <strong><span data-bulk-count>0</span>件選択中</strong>
      <select data-bulk-action>
        <option value="">操作を選択</option>
        <option value="status">状態を変更</option>
        <option value="assignee">担当者を変更</option>
        <option value="category">分類を変更</option>
        <option value="complete">完了にする</option>
        <option value="delete">削除</option>
      </select>
      <select data-bulk-target hidden></select>
      <button class="primary-button" type="button" data-bulk-apply>適用</button>
    </div>
    <table class="task-table">
      <thead><tr><th class="bulk-check-cell"><input type="checkbox" data-bulk-all /></th><th>件名</th><th>担当</th><th>状態</th><th>優先度</th><th>分類</th><th>期限</th><th>更新</th></tr></thead>
      <tbody>${tasks.length ? tasks.map(t => `<tr class="priority-row priority-${escapeHtml(t.priority)}" data-task-id="${escapeHtml(t.id)}">
        <td class="bulk-check-cell"><input type="checkbox" data-bulk-id="${escapeHtml(t.id)}" /></td>
        <td><strong>${escapeHtml(t.title)}</strong><br><small>${escapeHtml(t.requester || "依頼元未入力")}</small></td>
        <td>${userBadge(t.assignee)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td>${dueLabel(t)}</td>
        <td>${formatDateTime(t.updatedAt)}</td>
      </tr>`).join("") : `<tr><td colspan="8"><div class="today-empty"><strong>対象タスクはありません。</strong><p>条件を変更するか、新しいタスクを追加してください。</p><button type="button" class="ghost-button" data-new-task-empty>＋ 新しいタスク</button></div></td></tr>`}</tbody>
    </table>`;

  bindTaskRows(elements.listView);
  elements.listView.querySelector("[data-new-task-empty]")?.addEventListener("click", () => openTaskDialog());
  elements.listView.querySelector("[data-bulk-all]")?.addEventListener("change", (event) => {
    elements.listView.querySelectorAll("[data-bulk-id]").forEach(input => input.checked = event.target.checked);
    updateBulkBar();
  });
  elements.listView.querySelectorAll("[data-bulk-id]").forEach(input => input.addEventListener("change", updateBulkBar));
  elements.listView.querySelector("[data-bulk-action]")?.addEventListener("change", updateBulkTarget);
  elements.listView.querySelector("[data-bulk-apply]")?.addEventListener("click", applyBulkAction);
}

function bindTaskCards(root) {
  root.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", () => selectTask(el.dataset.taskId));
    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      openTaskEditorById(el.dataset.taskId);
    });
  });
}

function bindTaskRows(root) {
  root.querySelectorAll("tr[data-task-id]").forEach(row => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("input,button,select")) return;
      selectTask(row.dataset.taskId);
    });
    row.addEventListener("dblclick", (event) => {
      if (event.target.closest("input,button,select")) return;
      event.stopPropagation();
      openTaskEditorById(row.dataset.taskId);
    });
  });
}

function selectedBulkIds() {
  return [...elements.listView.querySelectorAll("[data-bulk-id]:checked")].map(input => input.dataset.bulkId);
}

function updateBulkBar() {
  const ids = selectedBulkIds();
  const bar = elements.listView.querySelector("[data-bulk-bar]");
  if (!bar) return;
  bar.hidden = !ids.length;
  bar.querySelector("[data-bulk-count]").textContent = ids.length;
}

function updateBulkTarget() {
  const action = elements.listView.querySelector("[data-bulk-action]")?.value;
  const target = elements.listView.querySelector("[data-bulk-target]");
  if (!target) return;
  if (!["status", "assignee", "category"].includes(action)) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  const values = action === "status" ? getStatusList() : action === "assignee" ? state.users : state.categories;
  target.innerHTML = values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  target.hidden = false;
}

async function applyBulkAction() {
  const ids = selectedBulkIds();
  const action = elements.listView.querySelector("[data-bulk-action]")?.value;
  const target = elements.listView.querySelector("[data-bulk-target]")?.value;
  if (!ids.length) return toast("タスクを選択してください", true);
  if (!action) return toast("操作を選択してください", true);
  if (action === "delete" && !confirm(`${ids.length}件のタスクを削除しますか？`)) return;

  for (const id of ids) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) continue;
    if (action === "delete") {
      await deleteTask(id, { silent: true });
      continue;
    }
    if (action === "status") task.status = normalizeStatus(target);
    if (action === "assignee") task.assignee = normalizeUser(target);
    if (action === "category") task.category = normalizeCategory(target);
    if (action === "complete") {
      task.status = COMPLETED_STATUS;
      task.completedAt = Date.now();
    }
    task.updatedAt = Date.now();
    task.updatedBy = getCurrentUser();
    task.history = appendHistory(task.history, `一括操作で${bulkActionLabel(action)}しました。`);
    await persistTask(task);
  }
  toast("一括操作を実行しました");
  render();
}

function bulkActionLabel(action) {
  return ({ status: "状態を変更", assignee: "担当者を変更", category: "分類を変更", complete: "完了", delete: "削除" })[action] || "更新";
}


function taskCard(task) {
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const stale = isStale(task);
  const checklist = checklistProgress(task);
  const colorHint = `左端の色：優先度 ${task.priority}${dueToday ? " / 今日まで" : ""}${overdue ? " / 期限超過" : ""}${stale ? " / 放置気味" : ""}${task.pinned ? " / 固定" : ""}`;
  return `<article class="task-card priority-card priority-${escapeHtml(task.priority)} ${task.pinned ? "pinned" : ""} ${overdue ? "overdue" : ""} ${dueToday ? "due-today" : ""} ${stale ? "stale" : ""}" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(colorHint)}">
    <p class="task-title">${task.pinned ? `<span class="pin">★</span>` : ""}<span>${escapeHtml(task.title)}</span></p>
    <div class="task-meta">${priorityBadge(task.priority)}${categoryBadge(task.category)}${overdue ? `<span class="badge priority-緊急">期限超過</span>` : ""}${dueToday ? `<span class="badge due-today-badge">今日まで</span>` : ""}${stale ? `<span class="badge stale-badge">放置気味</span>` : ""}${task.recurrence && task.recurrence !== "none" ? `<span class="badge recurrence-badge">定期</span>` : ""}</div>
    <div class="due-line"><span>${userBadge(task.assignee)}</span><span>${dueLabel(task)}</span></div>
    ${task.checklist.length ? `<div class="progress" title="${checklist.done}/${checklist.total}"><span style="width:${checklist.percent}%"></span></div>` : ""}
  </article>`;
}

function renderDetail() {
  const task = state.tasks.find(t => t.id === state.selectedId);
  if (!task) {
    state.selectedId = "";
    elements.appShell.classList.remove("detail-open");
    elements.detailPanel.classList.remove("open");
    elements.detailBody.className = "detail-body empty";
    elements.detailBody.innerHTML = "";
    return;
  }

  elements.appShell.classList.add("detail-open");
  elements.detailPanel.classList.add("open");
  elements.detailBody.className = "detail-body";
  const progress = checklistProgress(task);
  const relatedSchedules = getSchedulesForTask(task.id);
  const knowledge = task.knowledgeId ? state.knowledge.find(k => k.id === task.knowledgeId) : null;

  elements.detailBody.innerHTML = `
    <h3 class="detail-title">${escapeHtml(task.title)}</h3>
    <div class="task-meta">${statusBadge(task.status)}${priorityBadge(task.priority)}${categoryBadge(task.category)}${task.pinned ? `<span class="badge priority-中">固定</span>` : ""}${task.recurrence && task.recurrence !== "none" ? `<span class="badge recurrence-badge">${escapeHtml(RECURRENCE_LABELS[task.recurrence] || "定期")}</span>` : ""}</div>
    ${detailAlerts(task)}

    <div class="detail-actions detail-actions-v2">
      <div class="main-actions">
        <button class="primary-button" data-action="edit">編集する</button>
        ${!isCompletedStatus(task.status) ? `<button class="complete-button" data-action="done">✓ 完了にする</button>` : `<button class="ghost-button" data-action="reopen">未着手に戻す</button>`}
      </div>
      <div class="sub-actions">
        <button class="ghost-button" data-action="make-schedule">予定を作成</button>
        <button class="ghost-button" data-action="duplicate">複製</button>
        <button class="ghost-button" data-action="knowledge">ナレッジ化</button>
        <button class="ghost-button danger-text" data-action="delete">削除</button>
      </div>
    </div>

    <section class="detail-section">
      <div class="detail-grid">
        <div class="field-card"><small>担当者</small>${userBadge(task.assignee)}</div>
        <div class="field-card"><small>依頼元</small><strong>${escapeHtml(task.requester || "未入力")}</strong></div>
        <div class="field-card"><small>期限</small><strong>${dueLabel(task)}</strong></div>
        <div class="field-card"><small>繰り返し</small><strong>${escapeHtml(RECURRENCE_LABELS[task.recurrence] || "なし")}</strong></div>
        <div class="field-card"><small>作成日</small><strong>${formatDateTime(task.createdAt)}</strong></div>
        <div class="field-card"><small>最終更新</small><strong>${formatDateTime(task.updatedAt)}</strong></div>
        <div class="field-card"><small>更新者</small>${userBadge(task.updatedBy)}</div>
        ${task.completedMemo ? `<div class="field-card wide"><small>完了メモ</small><strong>${escapeHtml(task.completedMemo)}</strong></div>` : ""}
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

    ${relatedSchedules.length ? `<section class="detail-section">
      <h4>関連予定</h4>
      <div class="related-schedules">${relatedSchedules.map(schedule => `<button type="button" class="related-schedule-card" data-related-schedule="${escapeHtml(schedule.id)}">
        <strong>${escapeHtml(schedule.title)}</strong>
        <span>${escapeHtml(formatScheduleDateTimeRange(schedule))}${schedule.location ? " / " + escapeHtml(schedule.location) : ""}</span>
      </button>`).join("")}</div>
    </section>` : ""}

    ${knowledge ? `<section class="detail-section">
      <h4>ナレッジ</h4>
      <div class="knowledge-card detail-knowledge">
        <strong>${escapeHtml(knowledge.title)}</strong>
        <p>${escapeHtml(knowledge.action || knowledge.summary || "")}</p>
        <small>${formatDateTime(knowledge.createdAt)} / ${escapeHtml(knowledge.author)}</small>
      </div>
    </section>` : ""}

    <section class="detail-section activity-section">
      <h4>対応履歴・コメント</h4>
      <form class="comment-form" id="commentForm">
        <select id="commentType">
          <option>作業メモ</option>
          <option>業者回答</option>
          <option>確認依頼</option>
          <option>申し送り</option>
        </select>
        <textarea id="commentText" placeholder="対応状況や申し送りを入力"></textarea>
        <button class="ghost-button" type="submit">追加</button>
      </form>

      <div class="activity-tabs">
        <input type="radio" name="activityTab-${escapeHtml(task.id)}" id="activityComments-${escapeHtml(task.id)}" checked>
        <input type="radio" name="activityTab-${escapeHtml(task.id)}" id="activityHistory-${escapeHtml(task.id)}">
        <div class="activity-tab-buttons">
          <label for="activityComments-${escapeHtml(task.id)}">コメント <span>${(task.comments || []).length}</span></label>
          <label for="activityHistory-${escapeHtml(task.id)}">対応履歴 <span>${(task.history || []).length}</span></label>
        </div>
        <div class="activity-tab-panel activity-comments-panel">
          <div class="history-list compact-activity-list">${renderActivity(task, "comments")}</div>
        </div>
        <div class="activity-tab-panel activity-history-panel">
          <div class="history-list compact-activity-list">${renderActivity(task, "history")}</div>
        </div>
      </div>
    </section>
  `;

  elements.detailBody.querySelector('[data-action="edit"]')?.addEventListener("click", () => openTaskDialog(task));
  elements.detailBody.querySelector('[data-action="make-schedule"]')?.addEventListener("click", () => openScheduleDialogFromTask(task));
  elements.detailBody.querySelector('[data-action="duplicate"]')?.addEventListener("click", () => duplicateTask(task.id));
  elements.detailBody.querySelector('[data-action="knowledge"]')?.addEventListener("click", () => createKnowledgeFromTask(task.id));
  elements.detailBody.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
    if (!confirm("このタスクを削除しますか？")) return;
    await deleteTask(task.id);
    closeDetail();
  });
  elements.detailBody.querySelector('[data-action="done"]')?.addEventListener("click", () => completeTaskWithMemo(task.id));
  elements.detailBody.querySelector('[data-action="reopen"]')?.addEventListener("click", () => changeStatus(task.id, getDefaultOpenStatus()));
  elements.detailBody.querySelectorAll("[data-related-schedule]").forEach(button => {
    button.addEventListener("click", () => {
      const schedule = state.schedules.find(s => s.id === button.dataset.relatedSchedule);
      if (schedule) openScheduleDialog(schedule);
    });
  });
  elements.detailBody.querySelectorAll("[data-check-index]").forEach(input => {
    input.addEventListener("change", () => toggleChecklist(task.id, Number(input.dataset.checkIndex), input.checked));
  });
  $("commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = $("commentText").value.trim();
    const type = $("commentType").value;
    if (!text) return;
    await addComment(task.id, text, type);
    $("commentText").value = "";
  });
}


function getFilteredTasks() {
  const q = normalizeText(elements.searchInput.value);
  const now = startOfToday();
  let tasks = state.tasks.filter(task => {
    if (state.scope === "mine" && task.assignee !== getCurrentUser()) return false;
    if (state.scope === "done" && !isCompletedStatus(task.status)) return false;
    if (state.scope !== "done" && isCompletedStatus(task.status)) return false;
    if (elements.assigneeFilter.value && task.assignee !== elements.assigneeFilter.value) return false;
    if (elements.statusFilter.value && task.status !== elements.statusFilter.value) return false;
    if (elements.priorityFilter.value && task.priority !== elements.priorityFilter.value) return false;
    if (elements.categoryFilter.value && task.category !== elements.categoryFilter.value) return false;
    if (elements.pinOnly.checked && !task.pinned) return false;
    if (elements.overdueOnly.checked && !isOverdue(task)) return false;
    if (elements.todayOnly.checked && (!task.dueDate || toDate(task.dueDate).getTime() > now.getTime())) return false;
    if (q) {
      const hay = normalizeText([task.title, task.description, task.completedMemo, task.requester, task.category, task.assignee, task.status, task.priority, task.tags.join(" "), (task.comments || []).map(c => `${c.type || ""} ${c.text}`).join(" ")].join(" "));
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
    return compareSmartTasks(a, b);
  });
  return tasks;
}

function getDashboardFilteredTasks() {
  const q = normalizeText(elements.searchInput.value);
  const now = startOfToday();

  return state.tasks.filter(task => {
    // ダッシュボードでは「自分の担当」でも完了済みタスクを残す。
    // そうしないと「今月完了」が0件になってしまう。
    if (state.scope === "mine" && task.assignee !== getCurrentUser()) return false;
    if (state.scope === "done" && !isCompletedStatus(task.status)) return false;

    if (elements.assigneeFilter.value && task.assignee !== elements.assigneeFilter.value) return false;
    if (elements.statusFilter.value && task.status !== elements.statusFilter.value) return false;
    if (elements.priorityFilter.value && task.priority !== elements.priorityFilter.value) return false;
    if (elements.categoryFilter.value && task.category !== elements.categoryFilter.value) return false;
    if (elements.pinOnly.checked && !task.pinned) return false;

    // 期限系フィルターは未完了タスク向け。
    // ただしダッシュボード集計の整合性のため、ONの時だけ対象を絞る。
    if (elements.overdueOnly.checked && !isOverdue(task)) return false;
    if (elements.todayOnly.checked && (!task.dueDate || toDate(task.dueDate).getTime() > now.getTime())) return false;

    if (q) {
      const hay = normalizeText([
        task.title,
        task.description,
        task.completedMemo,
        task.requester,
        task.category,
        task.assignee,
        task.status,
        task.priority,
        task.tags.join(" "),
        (task.comments || []).map(c => `${c.type || ""} ${c.text}`).join(" ")
      ].join(" "));
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function openTaskDialog(task = null) {
  if (task || !state.pendingScheduleTaskLink) state.pendingScheduleTaskLink = "";
  elements.taskDialogTitle.textContent = task ? "タスクを編集" : "新しいタスク";
  syncTemplateOptions();
  $("taskId").value = task?.id || "";
  $("taskTitle").value = task?.title || "";
  $("taskAssignee").value = task?.assignee || getCurrentUser();
  syncStatusOptions($("taskStatus"));
  $("taskStatus").value = task?.status || getDefaultOpenStatus();
  $("taskPriority").value = task?.priority || "中";
  syncCategoryOptions($("taskCategory"));
  $("taskCategory").value = task?.category || (state.categories[0] || "PC");
  $("taskDueDate").value = task?.dueDate || "";
  $("taskDueTime").value = task?.dueTime || "";
  $("taskRecurrence").value = task?.recurrence || "none";
  $("taskTemplate").value = "";
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
    recurrence: $("taskRecurrence").value,
    requester: $("taskRequester").value.trim(),
    tags: splitTags($("taskTags").value),
    description: $("taskDescription").value.trim(),
    checklist: parseChecklist($("taskChecklist").value, existing?.checklist || []),
    pinned: $("taskPinned").checked,
    comments: existing?.comments || [],
    history: existing?.history || [],
    nextRecurringTaskId: existing?.nextRecurringTaskId || "",
    createdBy: existing?.createdBy || getCurrentUser(),
    createdAt: existing?.createdAt || now,
    updatedBy: getCurrentUser(),
    updatedAt: now,
    completedAt: isCompletedStatus(status) ? (existing?.completedAt || now) : 0,
    completedMemo: isCompletedStatus(status) ? (existing?.completedMemo || "") : "",
    knowledgeId: existing?.knowledgeId || ""
  });

  task.history = appendHistory(task.history, existing ? summarizeTaskChanges(existing, task) : "タスクを作成しました。");
  await persistTask(task);

  if (state.pendingScheduleTaskLink) {
    const schedule = state.schedules.find(item => item.id === state.pendingScheduleTaskLink);
    if (schedule && !schedule.relatedTaskId) {
      schedule.relatedTaskId = id;
      schedule.updatedAt = Date.now();
      schedule.updatedBy = getCurrentUser();
      await persistSchedule(schedule);
    }
    state.pendingScheduleTaskLink = "";
  }

  if (existing && !isCompletedStatus(existing.status) && isCompletedStatus(task.status)) {
    await maybeCreateNextRecurringTask(task);
  }

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

async function deleteTask(id, options = {}) {
  if (state.firebaseReady && state.dbApi) {
    await remove(ref(state.db, `rooms/${ROOM_ID}/tasks/${id}`));
  } else {
    state.tasks = state.tasks.filter(t => t.id !== id);
    localStorage.setItem(tasksKey(), JSON.stringify(state.tasks));
    if (!options.silent) render();
  }
  if (state.selectedId === id) {
    state.selectedId = "";
    closeDetail();
  }
  if (!options.silent) toast("削除しました");
}

async function changeStatus(id, status, memo = "") {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const beforeStatus = task.status;
  const wasCompleted = isCompletedStatus(task.status);
  task.status = status;
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  if (isCompletedStatus(status)) {
    task.completedAt = task.completedAt || Date.now();
    if (memo) task.completedMemo = memo;
  } else {
    task.completedAt = 0;
    task.completedMemo = "";
  }
  task.history = appendHistory(task.history, `状態を「${beforeStatus}」から「${status}」へ変更しました。${memo ? " 完了メモ：" + memo : ""}`);
  await persistTask(task);
  if (!wasCompleted && isCompletedStatus(status)) await maybeCreateNextRecurringTask(task);
}

async function completeTaskWithMemo(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const memo = prompt("完了メモを残しますか？\n再発時の確認点や対応内容があれば入力してください。", task.completedMemo || "");
  if (memo === null) return;
  await changeStatus(id, COMPLETED_STATUS, memo.trim());
}

async function toggleChecklist(id, index, done) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !task.checklist[index]) return;
  task.checklist[index].done = done;
  task.history = appendHistory(task.history, `チェックリスト「${task.checklist[index].text}」を${done ? "完了" : "未完了"}にしました。`);
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
}

async function addComment(id, text, type = "作業メモ") {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.comments = [...(task.comments || []), { id: generateId(), author: getCurrentUser(), type, text, createdAt: Date.now() }];
  task.history = appendHistory(task.history, `${type}を追加しました。`);
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
}

function loadLocalKnowledge() {
  try {
    state.knowledge = JSON.parse(localStorage.getItem(knowledgeKey()) || "[]").map(normalizeKnowledge);
  } catch {
    state.knowledge = [];
  }
  render();
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
  syncUserOptions($("scheduleAssignee"));
  syncUserOptions(elements.assigneeFilter, true);
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions($("scheduleCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
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
  syncCurrentUserStatuses({ persist: false, silent: true });
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


function bindReorder(container, { kind, handleSelector, dropSelector, onReorder }) {
  if (!container) return;

  container.querySelectorAll(handleSelector).forEach(handle => {
    handle.addEventListener("dragstart", event => {
      const value = handle.dataset.dragValue;
      if (!value || !event.dataTransfer) return;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({ kind, value }));
      handle.closest(dropSelector)?.classList.add("is-dragging");
    });

    handle.addEventListener("dragend", () => {
      container.querySelectorAll(".is-dragging, .is-drag-over").forEach(el => {
        el.classList.remove("is-dragging", "is-drag-over");
      });
    });
  });

  container.querySelectorAll(dropSelector).forEach(dropTarget => {
    dropTarget.addEventListener("dragover", event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      dropTarget.classList.add("is-drag-over");
    });

    dropTarget.addEventListener("dragleave", () => {
      dropTarget.classList.remove("is-drag-over");
    });

    dropTarget.addEventListener("drop", async event => {
      event.preventDefault();
      dropTarget.classList.remove("is-drag-over");

      const payload = getReorderPayload(event);
      if (!payload || payload.kind !== kind) return;

      const target = dropTarget.dataset.dropValue;
      if (!target || payload.value === target) return;

      await onReorder(payload.value, target);
    });
  });
}

function getReorderPayload(event) {
  if (!event.dataTransfer) return null;
  const raw = event.dataTransfer.getData("text/plain");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.kind && parsed.value ? parsed : null;
  } catch {
    return null;
  }
}

function reorderValues(list, source, target) {
  const next = [...list];
  const from = next.indexOf(source);
  const to = next.indexOf(target);
  if (from < 0 || to < 0 || from === to) return null;

  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

async function reorderUsers(source, target) {
  const next = reorderValues(state.users, source, target);
  if (!next) return;

  state.users = uniqueUsers(next);
  await saveUserSettings(true);
  syncUserUi();
  renderUserManager();
  render();
  toast("ユーザーの順番を変更しました");
}

async function reorderStatuses(source, target) {
  const next = reorderValues(getStatusList(), source, target);
  if (!next) return;

  state.statuses = uniqueStatuses(next);
  await saveStatusSettings(true);
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  renderStatusManager();
  render();
  toast("状態の順番を変更しました");
}

async function reorderCategories(source, target) {
  const next = reorderValues(state.categories, source, target);
  if (!next) return;

  state.categories = uniqueCategories(next);
  await saveCategorySettings(true);
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions($("scheduleCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  renderCategoryManager();
  render();
  toast("分類の順番を変更しました");
}


function renderUserManager() {
  elements.userList.innerHTML = state.users.map(user => `<div class="user-list-item" data-drop-kind="user" data-drop-value="${escapeHtml(user)}">
    <span class="drag-handle" draggable="true" data-drag-kind="user" data-drag-value="${escapeHtml(user)}" title="ドラッグしてユーザーの順番を変更">☰</span>
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

  bindReorder(elements.userList, {
    kind: "user",
    handleSelector: "[data-drag-kind='user']",
    dropSelector: "[data-drop-kind='user']",
    onReorder: reorderUsers
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



function statusesKey(user = null) {
  const safeUser = sanitizeStatusOwner(user || localStorage.getItem("systemTaskUser") || state?.currentUser || "");
  return `system-task-statuses:${ROOM_ID}:${safeUser || "default"}`;
}
function statusesByUserKey() {
  return `system-task-statuses-by-user:${ROOM_ID}`;
}
function timelineStartKey() {
  return `system-task-timeline-start:${ROOM_ID}`;
}
function timelineRangeKey() {
  return `system-task-timeline-range:${ROOM_ID}`;
}
function sanitizeStatusOwner(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").slice(0, 12);
}
function sanitizeStatus(value) {
  return String(value || "").normalize("NFKC").trim().slice(0, 20);
}
function uniqueStatuses(list) {
  const result = [];
  for (const item of Array.isArray(list) ? list : []) {
    const name = sanitizeStatus(item);
    if (name && !result.includes(name)) result.push(name);
  }
  if (!result.length) result.push(...DEFAULT_STATUSES);
  if (!result.includes(COMPLETED_STATUS)) result.push(COMPLETED_STATUS);
  return result;
}
function loadStatusesByUser() {
  try {
    const saved = JSON.parse(localStorage.getItem(statusesByUserKey()) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return normalizeStatusesByUser(saved);
  } catch {
    return {};
  }
}
function normalizeStatusesByUser(value) {
  const result = {};
  for (const [user, statuses] of Object.entries(value || {})) {
    const safeUser = sanitizeStatusOwner(user);
    if (safeUser && Array.isArray(statuses)) result[safeUser] = uniqueStatuses(statuses);
  }
  return result;
}
function loadStatuses() {
  const current = sanitizeStatusOwner(localStorage.getItem("systemTaskUser") || "");
  try {
    const byUser = JSON.parse(localStorage.getItem(statusesByUserKey()) || "{}");
    if (current && Array.isArray(byUser?.[current])) return uniqueStatuses(byUser[current]);
  } catch {}

  try {
    const list = JSON.parse(localStorage.getItem(statusesKey(current)) || "null");
    if (Array.isArray(list)) return uniqueStatuses(list);
  } catch {}

  try {
    const legacy = JSON.parse(localStorage.getItem(`system-task-statuses:${ROOM_ID}`) || "null");
    if (Array.isArray(legacy)) return uniqueStatuses(legacy);
  } catch {}

  return [...DEFAULT_STATUSES];
}
function getStatusOwner() {
  return sanitizeStatusOwner(getCurrentUser());
}
function getStatusesForUser(user) {
  const owner = sanitizeStatusOwner(user);
  if (owner && Array.isArray(state.statusesByUser?.[owner])) return uniqueStatuses(state.statusesByUser[owner]);

  try {
    const list = JSON.parse(localStorage.getItem(statusesKey(owner)) || "null");
    if (Array.isArray(list)) return uniqueStatuses(list);
  } catch {}

  return uniqueStatuses(state.statuses?.length ? state.statuses : DEFAULT_STATUSES);
}
function getTaskStatusesNotIn(list) {
  const result = [];
  for (const task of state.tasks || []) {
    const name = sanitizeStatus(task.status);
    if (name && !list.includes(name) && !result.includes(name)) result.push(name);
  }
  return result;
}
function getStatusList(options = {}) {
  const base = uniqueStatuses(state.statuses?.length ? state.statuses : getStatusesForUser(getStatusOwner()));
  if (options.includeTaskOnly === false) return base;

  const taskOnly = getTaskStatusesNotIn(base);
  if (!taskOnly.length) return base;

  const withoutComplete = base.filter(status => !isCompletedStatus(status));
  const complete = base.find(isCompletedStatus) || COMPLETED_STATUS;
  return uniqueStatuses([...withoutComplete, ...taskOnly, complete]);
}
function syncCurrentUserStatuses(options = {}) {
  const owner = getStatusOwner();
  state.statuses = uniqueStatuses(getStatusesForUser(owner));
  if (owner) {
    state.statusesByUser[owner] = state.statuses;
    localStorage.setItem(statusesKey(owner), JSON.stringify(state.statuses));
    localStorage.setItem(statusesByUserKey(), JSON.stringify(state.statusesByUser));
  }
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  if (options.persist) saveStatusSettings(true);
  if (!options.silent) render();
}
function isCompletedStatus(status) {
  return normalizeText(status) === normalizeText(COMPLETED_STATUS);
}
function getDefaultOpenStatus() {
  return getStatusList({ includeTaskOnly: false }).find(status => !isCompletedStatus(status)) || "未着手";
}
function normalizeStatus(value) {
  const raw = sanitizeStatus(value);
  if (!raw) return getDefaultOpenStatus();
  const exact = getStatusList().find(status => normalizeText(status) === normalizeText(raw));
  return exact || raw;
}
function syncStatusOptions(select, includeAll = false) {
  if (!select) return;
  const currentValue = select.value;
  const statuses = getStatusList();
  select.innerHTML = `${includeAll ? '<option value="">すべて</option>' : ""}${statuses.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}`;
  if ([...select.options].some(opt => opt.value === currentValue)) select.value = currentValue;
}
function renderStatusManager() {
  const statuses = getStatusList({ includeTaskOnly: false });
  elements.statusList.innerHTML = statuses.map(status => {
    const protectedStatus = isCompletedStatus(status);
    return `<div class="status-list-item ${protectedStatus ? "is-protected" : ""}" data-drop-kind="status" data-drop-value="${escapeHtml(status)}">
      <span class="drag-handle" draggable="true" data-drag-kind="status" data-drag-value="${escapeHtml(status)}" title="ドラッグして状態の順番を変更">☰</span>
      <input class="status-name-input" value="${escapeHtml(status)}" maxlength="20" data-status-old="${escapeHtml(status)}" ${protectedStatus ? "readonly" : ""} />
      <div class="status-list-actions">
        ${protectedStatus ? `<span class="protected-chip">固定</span>` : `<button class="mini-button" type="button" data-save-status="${escapeHtml(status)}">保存</button>`}
        <button class="mini-button danger" type="button" data-delete-status="${escapeHtml(status)}" ${protectedStatus || statuses.length <= 1 ? "disabled" : ""}>削除</button>
      </div>
    </div>`;
  }).join("");

  elements.statusList.querySelectorAll("[data-save-status]").forEach(button => {
    button.addEventListener("click", async () => {
      const oldName = button.dataset.saveStatus;
      const input = elements.statusList.querySelector(`[data-status-old="${cssEscape(oldName)}"]`);
      await renameStatus(oldName, input?.value || "");
    });
  });
  elements.statusList.querySelectorAll("[data-delete-status]").forEach(button => {
    button.addEventListener("click", async () => deleteStatus(button.dataset.deleteStatus));
  });

  bindReorder(elements.statusList, {
    kind: "status",
    handleSelector: "[data-drag-kind='status']",
    dropSelector: "[data-drop-kind='status']",
    onReorder: reorderStatuses
  });
}
async function addStatusFromForm() {
  const name = sanitizeStatus(elements.newStatusName.value);
  if (!name) return toast("状態名を入力してください", true);
  if (getStatusList({ includeTaskOnly: false }).some(status => normalizeText(status) === normalizeText(name))) return toast("同じ状態が既にあります", true);
  const completeIndex = state.statuses.findIndex(isCompletedStatus);
  if (completeIndex >= 0) state.statuses.splice(completeIndex, 0, name);
  else state.statuses.push(name);
  elements.newStatusName.value = "";
  await saveStatusSettings(true);
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  renderStatusManager();
  render();
  toast("状態を追加しました");
}
async function renameStatus(oldName, newValue) {
  const next = sanitizeStatus(newValue);
  if (!next) return toast("状態名を入力してください", true);
  if (isCompletedStatus(oldName)) return toast("完了は名称変更できません", true);
  if (next !== oldName && getStatusList({ includeTaskOnly: false }).some(status => normalizeText(status) === normalizeText(next))) return toast("同じ状態が既にあります", true);
  state.statuses = getStatusList({ includeTaskOnly: false }).map(status => status === oldName ? next : status);
  const changedTasks = state.tasks.filter(task => task.status === oldName);
  for (const task of changedTasks) {
    task.status = next;
    task.updatedAt = Date.now();
    task.updatedBy = getCurrentUser();
    await persistTask(task);
  }
  await saveStatusSettings(true);
  renderStatusManager();
  render();
  toast("状態を更新しました");
}
async function deleteStatus(name) {
  if (isCompletedStatus(name)) return toast("完了は削除できません", true);
  const statuses = getStatusList({ includeTaskOnly: false });
  if (statuses.length <= 1) return;
  const used = state.tasks.some(task => task.status === name);
  const fallback = getDefaultOpenStatus() === name
    ? (statuses.find(status => status !== name && !isCompletedStatus(status)) || COMPLETED_STATUS)
    : getDefaultOpenStatus();
  const message = used
    ? `${name}を削除しますか？\nこの状態を使っているタスクは「${fallback}」に変更されます。`
    : `${name}を削除しますか？`;
  if (!confirm(message)) return;
  state.statuses = statuses.filter(status => status !== name);
  const changedTasks = state.tasks.filter(task => task.status === name);
  for (const task of changedTasks) {
    task.status = fallback;
    task.updatedAt = Date.now();
    task.updatedBy = getCurrentUser();
    await persistTask(task);
  }
  await saveStatusSettings(true);
  renderStatusManager();
  render();
  toast("状態を削除しました");
}
function setStatuses(statuses, options = {}) {
  state.statuses = uniqueStatuses(statuses);
  const owner = getStatusOwner();
  if (owner) state.statusesByUser[owner] = state.statuses;
  localStorage.setItem(statusesKey(owner), JSON.stringify(state.statuses));
  localStorage.setItem(statusesByUserKey(), JSON.stringify(state.statusesByUser));
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  renderStatusManager();
  if (options.persist !== false) saveStatusSettings(true);
  if (!options.silent) render();
}
function setStatusesByUser(value, options = {}) {
  state.statusesByUser = normalizeStatusesByUser(value);
  syncCurrentUserStatuses({ persist: false, silent: true });
  localStorage.setItem(statusesByUserKey(), JSON.stringify(state.statusesByUser));
  if (options.persist !== false) saveStatusSettings(true);
  if (!options.silent) render();
}
async function saveStatusSettings(remote = true) {
  const owner = getStatusOwner();
  state.statuses = uniqueStatuses(state.statuses);
  if (owner) {
    state.statusesByUser[owner] = state.statuses;
    localStorage.setItem(statusesKey(owner), JSON.stringify(state.statuses));
  }
  localStorage.setItem(statusesByUserKey(), JSON.stringify(state.statusesByUser));
  if (remote && state.firebaseReady && state.dbApi) {
    await update(state.metaRef, {
      statusesByUser: state.statusesByUser,
      statuses: state.statuses,
      statusesUpdatedAt: Date.now()
    });
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
  elements.categoryList.innerHTML = state.categories.map(category => `<div class="category-list-item" data-drop-kind="category" data-drop-value="${escapeHtml(category)}">
    <span class="drag-handle" draggable="true" data-drag-kind="category" data-drag-value="${escapeHtml(category)}" title="ドラッグして分類の順番を変更">☰</span>
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

  bindReorder(elements.categoryList, {
    kind: "category",
    handleSelector: "[data-drag-kind='category']",
    dropSelector: "[data-drop-kind='category']",
    onReorder: reorderCategories
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
  syncCategoryOptions($("scheduleCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
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
  syncCategoryOptions($("scheduleCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
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
}

function closeDetail() {
  state.selectedId = "";
  elements.appShell.classList.remove("detail-open");
  elements.detailPanel.classList.remove("open");
  elements.detailBody.className = "detail-body empty";
  elements.detailBody.innerHTML = "";
}

function openTaskEditorById(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  state.selectedId = id;
  renderDetail();
  openTaskDialog(task);
}

function setConnection(text, type) {
  elements.connectionPill.textContent = text;
  elements.connectionPill.className = `connection-pill ${type || ""}`;
}

function emptyColumn(status) {
  return `<div class="empty-state column-empty">
    <p>${escapeHtml(status)}のタスクはありません。</p>
    <button type="button" class="ghost-button" data-empty-status="${escapeHtml(status)}">この状態で追加</button>
  </div>`;
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

function taskTemplatesKey() {
  return `system-task-templates:${ROOM_ID}`;
}

function sanitizeTemplate(value) {
  return String(value || "").normalize("NFKC").trim();
}

function normalizeTemplate(template) {
  const id = sanitizeTemplate(template?.id) || generateTemplateId();
  return {
    id,
    name: sanitizeTemplate(template?.name).slice(0, 30) || "名称未設定",
    title: sanitizeTemplate(template?.title).slice(0, 80) || sanitizeTemplate(template?.name).slice(0, 80) || "新しいタスク",
    priority: ["緊急", "高", "中", "低"].includes(template?.priority) ? template.priority : "中",
    category: sanitizeTemplate(template?.category).slice(0, 20) || "その他",
    tags: Array.isArray(template?.tags) ? template.tags.join(", ") : String(template?.tags || ""),
    description: String(template?.description || ""),
    checklist: Array.isArray(template?.checklist)
      ? template.checklist.map(item => typeof item === "string" ? item : item?.text).filter(Boolean).join("\n")
      : String(template?.checklist || "")
  };
}

function uniqueTemplates(list) {
  const result = [];
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const template = normalizeTemplate(item);
    if (!seen.has(template.id)) {
      seen.add(template.id);
      result.push(template);
    }
  }
  return result.length ? result : DEFAULT_TASK_TEMPLATES.map(normalizeTemplate);
}

function loadTaskTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(taskTemplatesKey()) || "null");
    if (Array.isArray(saved)) return uniqueTemplates(saved);
  } catch {}
  return DEFAULT_TASK_TEMPLATES.map(normalizeTemplate);
}

function setTaskTemplates(templates, options = {}) {
  state.taskTemplates = uniqueTemplates(templates);
  localStorage.setItem(taskTemplatesKey(), JSON.stringify(state.taskTemplates));
  syncTemplateOptions();
  if (options.persist !== false) saveTemplateSettings(true);
  if (!options.silent) render();
}

async function saveTemplateSettings(remote = true) {
  localStorage.setItem(taskTemplatesKey(), JSON.stringify(state.taskTemplates));
  if (remote && state.firebaseReady && state.dbApi) {
    await update(state.metaRef, { taskTemplates: state.taskTemplates, taskTemplatesUpdatedAt: Date.now() });
  }
}

function generateTemplateId() {
  return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncTemplateOptions() {
  if (!elements.taskTemplate) return;
  const current = elements.taskTemplate.value;
  elements.taskTemplate.innerHTML = `<option value="">テンプレートなし</option>${state.taskTemplates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("")}`;
  if ([...elements.taskTemplate.options].some(opt => opt.value === current)) elements.taskTemplate.value = current;
}

function applyTemplate(templateId) {
  const template = state.taskTemplates.find(t => t.id === templateId);
  if (!template) return;
  const hasInput = $("taskTitle").value.trim() || $("taskDescription").value.trim() || $("taskChecklist").value.trim();
  if (hasInput && !confirm("現在の入力内容にテンプレートを反映しますか？")) {
    elements.taskTemplate.value = "";
    return;
  }

  // 担当者はテンプレートでは変更しない。現在のユーザーを優先。
  $("taskAssignee").value = getCurrentUser();
  $("taskTitle").value = template.title;
  $("taskPriority").value = template.priority;
  if ([...$("taskCategory").options].some(opt => opt.value === template.category)) $("taskCategory").value = template.category;
  $("taskTags").value = template.tags;
  $("taskDescription").value = template.description;
  $("taskChecklist").value = template.checklist;
}

function renderTemplateManager(selectedId = null) {
  syncTemplateOptions();
  const selected = selectedId === null ? (elements.templateIdField.value || state.taskTemplates[0]?.id || "") : selectedId;
  elements.templateList.innerHTML = state.taskTemplates.map(template => `<button type="button" class="template-list-item ${template.id === selected ? "active" : ""}" data-template-id="${escapeHtml(template.id)}">
    <strong>${escapeHtml(template.name)}</strong>
    <span>${escapeHtml(template.category)} / ${escapeHtml(template.priority)}</span>
  </button>`).join("");

  elements.templateList.querySelectorAll("[data-template-id]").forEach(button => {
    button.addEventListener("click", () => selectTemplateForEdit(button.dataset.templateId));
  });

  if (selected) selectTemplateForEdit(selected, false);
  else clearTemplateEditor(false);
}

function selectTemplateForEdit(id, rerenderList = true) {
  const template = state.taskTemplates.find(t => t.id === id);
  if (!template) return clearTemplateEditor(rerenderList);
  elements.templateEditTitle.textContent = "テンプレートを編集";
  elements.templateIdField.value = template.id;
  elements.templateName.value = template.name;
  elements.templateTitle.value = template.title;
  elements.templatePriority.value = template.priority;
  elements.templateCategory.value = template.category;
  elements.templateTags.value = template.tags;
  elements.templateDescription.value = template.description;
  elements.templateChecklist.value = template.checklist;
  elements.deleteTemplateButton.hidden = false;
  if (rerenderList) renderTemplateManager(id);
}

function clearTemplateEditor(rerenderList = true) {
  elements.templateEditTitle.textContent = "新しいテンプレート";
  elements.templateIdField.value = "";
  elements.templateName.value = "";
  elements.templateTitle.value = "";
  elements.templatePriority.value = "中";
  elements.templateCategory.value = "";
  elements.templateTags.value = "";
  elements.templateDescription.value = "";
  elements.templateChecklist.value = "";
  elements.deleteTemplateButton.hidden = true;
  if (rerenderList) renderTemplateManager("");
}

async function saveTemplateFromForm() {
  const name = sanitizeTemplate(elements.templateName.value).slice(0, 30);
  const title = sanitizeTemplate(elements.templateTitle.value).slice(0, 80);
  if (!name) return toast("テンプレート名を入力してください", true);
  if (!title) return toast("件名を入力してください", true);

  const id = elements.templateIdField.value || generateTemplateId();
  const template = normalizeTemplate({
    id,
    name,
    title,
    priority: elements.templatePriority.value,
    category: elements.templateCategory.value,
    tags: elements.templateTags.value,
    description: elements.templateDescription.value,
    checklist: elements.templateChecklist.value
  });

  const index = state.taskTemplates.findIndex(t => t.id === id);
  if (index >= 0) state.taskTemplates[index] = template;
  else state.taskTemplates.push(template);

  await saveTemplateSettings(true);
  syncTemplateOptions();
  renderTemplateManager(id);
  toast("テンプレートを保存しました");
}

async function deleteSelectedTemplate() {
  const id = elements.templateIdField.value;
  const template = state.taskTemplates.find(t => t.id === id);
  if (!template) return;
  if (!confirm(`${template.name}を削除しますか？`)) return;
  state.taskTemplates = state.taskTemplates.filter(t => t.id !== id);
  if (!state.taskTemplates.length) state.taskTemplates = DEFAULT_TASK_TEMPLATES.map(normalizeTemplate);
  await saveTemplateSettings(true);
  syncTemplateOptions();
  renderTemplateManager(state.taskTemplates[0]?.id || "");
  toast("テンプレートを削除しました");
}


function normalizeChecklist(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === "string" ? { text: item, done: false } : { text: String(item?.text || "").trim(), done: Boolean(item?.done) })
    .filter(item => item.text);
}

function appendHistory(history, text) {
  const message = String(text || "").trim();
  if (!message) return Array.isArray(history) ? history : [];
  return [...(Array.isArray(history) ? history : []), {
    id: generateId(),
    author: getCurrentUser(),
    text: message,
    createdAt: Date.now()
  }].slice(-80);
}

function summarizeTaskChanges(before, after) {
  const changes = [];
  if (before.title !== after.title) changes.push("件名");
  if (before.assignee !== after.assignee) changes.push(`担当者を「${before.assignee}」から「${after.assignee}」へ変更`);
  if (before.status !== after.status) changes.push(`状態を「${before.status}」から「${after.status}」へ変更`);
  if (before.priority !== after.priority) changes.push(`優先度を「${before.priority}」から「${after.priority}」へ変更`);
  if (before.category !== after.category) changes.push(`分類を「${before.category}」から「${after.category}」へ変更`);
  if (before.dueDate !== after.dueDate || before.dueTime !== after.dueTime) changes.push("期限");
  if (before.recurrence !== after.recurrence) changes.push(`繰り返しを「${RECURRENCE_LABELS[before.recurrence] || "なし"}」から「${RECURRENCE_LABELS[after.recurrence] || "なし"}」へ変更`);
  if (before.description !== after.description) changes.push("内容・メモ");
  if (JSON.stringify(before.checklist || []) !== JSON.stringify(after.checklist || [])) changes.push("チェックリスト");
  if (Boolean(before.pinned) !== Boolean(after.pinned)) changes.push(after.pinned ? "固定表示を有効化" : "固定表示を解除");
  if (!changes.length) return "タスクを保存しました。";
  return `タスクを編集しました（${changes.join("、")}）。`;
}

function renderHistory(task) {
  const history = Array.isArray(task.history) ? [...task.history].reverse() : [];
  if (!history.length) return `<p class="description">履歴はまだありません。</p>`;
  return history.map(item => `<div class="history-item">
    <div class="comment-head"><span>${userBadge(item.author)}</span><span>${formatDateTime(item.createdAt)}</span></div>
    <div>${escapeHtml(item.text)}</div>
  </div>`).join("");
}

function detailAlerts(task) {
  const alerts = [];
  if (isOverdue(task)) alerts.push(`<div class="detail-alert danger">期限を過ぎています。対応状況を確認してください。</div>`);
  else if (isDueToday(task)) alerts.push(`<div class="detail-alert warning">今日が期限です。</div>`);
  if (isStale(task)) alerts.push(`<div class="detail-alert muted">${STALE_DAYS}日以上更新されていません。放置タスクの可能性があります。</div>`);
  return alerts.join("");
}

async function maybeCreateNextRecurringTask(task) {
  if (!task || !task.recurrence || task.recurrence === "none" || task.nextRecurringTaskId) return;
  if (!task.dueDate) return;

  const nextDueDate = getNextRecurringDueDate(task.dueDate, task.recurrence);
  if (!nextDueDate) return;

  const nextId = generateId();
  const now = Date.now();
  const nextTask = normalizeTask({
    ...task,
    id: nextId,
    status: getDefaultOpenStatus(),
    dueDate: nextDueDate,
    completedAt: 0,
    completedMemo: "",
    knowledgeId: "",
    pinned: false,
    comments: [],
    checklist: (task.checklist || []).map(item => ({ text: item.text, done: false })),
    history: appendHistory([], `定期タスクとして「${task.title}」から作成されました。`),
    createdBy: getCurrentUser(),
    createdAt: now,
    updatedBy: getCurrentUser(),
    updatedAt: now,
    nextRecurringTaskId: "",
    recurringParentId: task.id
  });

  task.nextRecurringTaskId = nextId;
  task.history = appendHistory(task.history, `次回の定期タスクを作成しました（期限：${nextDueDate}）。`);
  await persistTask(task);
  await persistTask(nextTask);
  toast("次回の定期タスクを作成しました");
}

function getNextRecurringDueDate(dueDate, recurrence) {
  const base = parseISODate(dueDate);
  if (!base) return "";
  if (recurrence === "weekly") return toISODate(addDays(base, 7));
  if (recurrence === "monthly") return toISODate(addMonths(base, 1));
  if (recurrence === "yearly") return toISODate(new Date(base.getFullYear() + 1, base.getMonth(), base.getDate()));
  return "";
}

function isDueToday(task) {
  if (!task.dueDate || isCompletedStatus(task.status)) return false;
  return toDate(task.dueDate).getTime() === startOfToday().getTime();
}

function isStale(task) {
  if (isCompletedStatus(task.status)) return false;
  const updated = Number(task.updatedAt || task.createdAt || 0);
  if (!updated) return false;
  return Date.now() - updated >= STALE_DAYS * 24 * 60 * 60 * 1000;
}

function isCompletedThisMonth(task) {
  if (!task.completedAt) return false;
  const d = new Date(task.completedAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
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

function formatWeekdaySuffix(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `（${["日","月","火","水","木","金","土"][date.getDay()]}）`;
}

function dayKindClass(date) {
  const holiday = getJapaneseHolidayName(date);
  if (holiday || date.getDay() === 0) return "holiday";
  if (date.getDay() === 6) return "saturday";
  return "";
}

function getJapaneseHolidayName(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const iso = toISODate(date);

  const fixed = {
    [`${y}-01-01`]: "元日",
    [`${y}-02-11`]: "建国記念の日",
    [`${y}-02-23`]: "天皇誕生日",
    [`${y}-04-29`]: "昭和の日",
    [`${y}-05-03`]: "憲法記念日",
    [`${y}-05-04`]: "みどりの日",
    [`${y}-05-05`]: "こどもの日",
    [`${y}-08-11`]: "山の日",
    [`${y}-11-03`]: "文化の日",
    [`${y}-11-23`]: "勤労感謝の日"
  };
  if (fixed[iso]) return fixed[iso];

  const nthMonday = (month, nth) => {
    const first = new Date(y, month - 1, 1);
    const offset = (8 - first.getDay()) % 7;
    return 1 + offset + (nth - 1) * 7;
  };

  if (m === 1 && d === nthMonday(1, 2)) return "成人の日";
  if (m === 7 && d === nthMonday(7, 3)) return "海の日";
  if (m === 9 && d === nthMonday(9, 3)) return "敬老の日";
  if (m === 10 && d === nthMonday(10, 2)) return "スポーツの日";

  if (m === 3 && d === springEquinoxDay(y)) return "春分の日";
  if (m === 9 && d === autumnEquinoxDay(y)) return "秋分の日";

  // 振替休日・国民の休日の簡易判定
  const holidayMap = buildJapaneseHolidayMap(y);
  return holidayMap[iso] || "";
}

function buildJapaneseHolidayMap(year) {
  const key = `jp-holidays-${year}`;
  if (!buildJapaneseHolidayMap.cache) buildJapaneseHolidayMap.cache = {};
  if (buildJapaneseHolidayMap.cache[key]) return buildJapaneseHolidayMap.cache[key];

  const map = {};
  const add = (month, day, name) => {
    const iso = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    map[iso] = name;
  };
  add(1, 1, "元日");
  add(2, 11, "建国記念の日");
  add(2, 23, "天皇誕生日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(8, 11, "山の日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  const nthMonday = (month, nth) => {
    const first = new Date(year, month - 1, 1);
    const offset = (8 - first.getDay()) % 7;
    return 1 + offset + (nth - 1) * 7;
  };
  add(1, nthMonday(1, 2), "成人の日");
  add(7, nthMonday(7, 3), "海の日");
  add(9, nthMonday(9, 3), "敬老の日");
  add(10, nthMonday(10, 2), "スポーツの日");
  add(3, springEquinoxDay(year), "春分の日");
  add(9, autumnEquinoxDay(year), "秋分の日");

  // 振替休日
  Object.keys({ ...map }).sort().forEach(iso => {
    const date = parseISODate(iso);
    if (date?.getDay() === 0) {
      let substitute = addDays(date, 1);
      while (map[toISODate(substitute)]) substitute = addDays(substitute, 1);
      map[toISODate(substitute)] = "振替休日";
    }
  });

  // 国民の休日：祝日と祝日に挟まれた平日
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  for (let date = new Date(yearStart); date < yearEnd; date = addDays(date, 1)) {
    const iso = toISODate(date);
    if (map[iso]) continue;
    const prev = toISODate(addDays(date, -1));
    const next = toISODate(addDays(date, 1));
    if (map[prev] && map[next] && date.getDay() !== 0) map[iso] = "国民の休日";
  }

  buildJapaneseHolidayMap.cache[key] = map;
  return map;
}

function springEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function dueLabel(task) {
  if (!task.dueDate) return "期限なし";
  const date = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`);
  const text = `${task.dueDate}${formatWeekdaySuffix(date)}${task.dueTime ? " " + task.dueTime : ""}`;
  if (!isCompletedStatus(task.status) && isOverdue(task)) return `⚠ ${text}`;
  return text;
}
function isOverdue(task) {
  if (!task.dueDate || isCompletedStatus(task.status)) return false;
  return toDate(task.dueDate) < startOfToday();
}
function dueScore(task) {
  if (!task.dueDate) return 9999999999999;
  return new Date(`${task.dueDate}T${task.dueTime || "23:59"}`).getTime();
}
function smartScore(task) {
  const today = startOfToday();
  const taskDueDate = task.dueDate ? toDate(task.dueDate) : null;

  // おすすめ順：
  // 1. 固定
  // 2. 期限超過
  // 3. 今日まで
  // 4. 優先度
  // 5. 期限が近い
  // 6. 更新が新しい
  // 7. 期限なし
  const pinnedRank = task.pinned ? 0 : 1;
  const dueRank = !taskDueDate
    ? 3
    : taskDueDate < today
      ? 0
      : taskDueDate.getTime() === today.getTime()
        ? 1
        : 2;
  const priorityRank = PRIORITY_ORDER[task.priority] ?? 9;
  const dueTimeRank = task.dueDate ? new Date(`${task.dueDate}T${task.dueTime || "23:59"}`).getTime() : 9999999999999;
  const updatedRank = -(Number(task.updatedAt) || 0);

  return [
    pinnedRank,
    dueRank,
    priorityRank,
    dueTimeRank,
    updatedRank
  ];
}

function compareSmartTasks(a, b) {
  const left = smartScore(a);
  const right = smartScore(b);

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }

  return String(a.title || "").localeCompare(String(b.title || ""), "ja");
}
function toDate(value) {
  return new Date(`${value}T00:00:00`);
}
function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function todayISO() {
  return toISODate(startOfToday());
}
function parseISODate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0,0,0,0);
  return next;
}
function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
function isTodayDate(date) {
  return toISODate(date) === todayISO();
}
function formatMonthDay(date) {
  return `${date.getMonth()+1}/${date.getDate()}`;
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
  const openDialogs = [...document.querySelectorAll("dialog[open]")];
  const topDialog = openDialogs[openDialogs.length - 1];
  if (topDialog) {
    topDialog.appendChild(elements.toast);
    elements.toast.classList.add("in-dialog");
  } else {
    document.body.appendChild(elements.toast);
    elements.toast.classList.remove("in-dialog");
  }
  elements.toast.textContent = message;
  elements.toast.style.background = error ? "#b91c2b" : "#132b40";
  elements.toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => elements.toast.hidden = true, 3200);
}

// v31: すべての定義が完了してから初期化する
init();
