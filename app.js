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
const RECURRENCE_LABELS = { none: "なし", daily: "毎日", weekly: "毎週", monthly: "毎月", monthlyDay: "毎月", monthlyNth: "毎月 第n曜日", yearly: "毎年" };
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
  scheduleReminderTimer: null,
  favoriteTaskIds: [],
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
  statButtons: [...document.querySelectorAll("[data-stat-layout]")],
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
  favoriteOnly: $("favoriteOnly"),
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
  timelineMoveDialog: $("timelineMoveDialog"),
  timelineMoveTaskTitle: $("timelineMoveTaskTitle"),
  timelineMoveStatus: $("timelineMoveStatus"),
  timelineMoveDueDate: $("timelineMoveDueDate"),
  confirmTimelineMove: $("confirmTimelineMove"),
  cancelTimelineMove: $("cancelTimelineMove"),
  closeTimelineMoveDialog: $("closeTimelineMoveDialog"),
  activityDialog: $("activityDialog"),
  activityDialogBody: $("activityDialogBody"),
  closeActivityDialog: $("closeActivityDialog"),
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
  document.title = "業務管理ボード";
  setupEvents();
  state.favoriteTaskIds = loadFavoriteTaskIds();
  syncCurrentUserStatuses({ persist: false, silent: true });
  syncUserUi();
  syncRoomUi();
  setupFirebase();
  startScheduleReminderWatcher();
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

function activityReadAtKey() {
  return `system-task-activity-read-at:${ROOM_ID}:${getCurrentUser()}`;
}

function scheduleReminderSeenKey() {
  return `system-task-schedule-reminders:${ROOM_ID}:${getCurrentUser()}`;
}

function favoriteTaskIdsKey(user = getCurrentUser()) {
  return `system-task-favorites:${ROOM_ID}:${sanitizeUser(user)}`;
}

function loadFavoriteTaskIds(user = getCurrentUser()) {
  try {
    const saved = JSON.parse(localStorage.getItem(favoriteTaskIdsKey(user)) || "[]");
    if (Array.isArray(saved)) {
      return [...new Set(saved.map(id => String(id || "")).filter(Boolean))];
    }
  } catch {}
  return [];
}

function saveFavoriteTaskIds() {
  state.favoriteTaskIds = [...new Set((state.favoriteTaskIds || []).map(id => String(id || "")).filter(Boolean))];
  localStorage.setItem(favoriteTaskIdsKey(), JSON.stringify(state.favoriteTaskIds));
}

function isTaskStarred(taskId) {
  return (state.favoriteTaskIds || []).includes(String(taskId || ""));
}

function favoriteButton(task, extraClass = "") {
  const starred = isTaskStarred(task.id);
  return `<button type="button" class="favorite-button ${extraClass} ${starred ? "starred" : ""}" data-star-task="${escapeHtml(task.id)}" aria-pressed="${starred ? "true" : "false"}" title="${starred ? "スターを外す" : "スターを付ける"}">${starred ? "★" : "☆"}</button>`;
}

function bindFavoriteButtons(root) {
  if (!root) return;
  root.querySelectorAll("[data-star-task]").forEach(button => {
    if (button.dataset.favoriteBound === "true") return;
    button.dataset.favoriteBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleTaskFavorite(button.dataset.starTask);
    });
    button.addEventListener("dblclick", event => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("mousedown", event => event.stopPropagation());
    button.addEventListener("dragstart", event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
}

function toggleTaskFavorite(taskId) {
  const id = String(taskId || "");
  if (!id) return;
  const starred = isTaskStarred(id);
  state.favoriteTaskIds = starred
    ? state.favoriteTaskIds.filter(item => item !== id)
    : [...state.favoriteTaskIds, id];
  saveFavoriteTaskIds();
  render();
  toast(starred ? "スターを外しました" : "スターを付けました");
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
      checkScheduleReminders();
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
  document.addEventListener("dragend", () => {
    if (state.draggingTaskId || document.body.classList.contains("task-dragging")) cleanupTaskDragUi();
  });
  document.addEventListener("drop", () => {
    if (state.draggingTaskId || document.body.classList.contains("task-dragging")) {
      setTimeout(cleanupTaskDragUi, 0);
    }
  });

  elements.navItems.forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.layout) {
        state.layout = button.dataset.layout;
        if (state.layout !== "tasks") closeDetail();
      }
      if (button.dataset.filter) {
        if (button.dataset.filter === "favorite") {
          if (elements.favoriteOnly) elements.favoriteOnly.checked = !elements.favoriteOnly.checked;
          state.layout = "tasks";
          closeDetail();
        } else {
          state.scope = toggleScopeFilter(state.scope, button.dataset.filter);
        }
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

  (elements.statButtons || []).forEach(button => {
    button.addEventListener("click", () => {
      state.layout = button.dataset.statLayout || "dashboard";
      closeDetail();
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

  [elements.searchInput, elements.assigneeFilter, elements.statusFilter, elements.priorityFilter, elements.categoryFilter, elements.overdueOnly, elements.todayOnly, elements.pinOnly, elements.favoriteOnly, elements.sortSelect]
    .forEach(el => el?.addEventListener("input", render));

  elements.statusFilter.addEventListener("input", () => {
    // 詳細絞り込みで「完了」を選んだ場合も、上の完了ボタンと同じ扱いにする。
    if (isCompletedStatus(elements.statusFilter.value)) {
      state.scope = makeScope(scopeHasMine(), true);
    } else if (scopeHasDone()) {
      state.scope = makeScope(scopeHasMine(), false);
    }
    render();
  });

  elements.resetFilters.addEventListener("click", () => {
    state.scope = "all";
    elements.searchInput.value = "";
    elements.assigneeFilter.value = "";
    elements.statusFilter.value = "";
    elements.priorityFilter.value = "";
    elements.categoryFilter.value = "";
    elements.overdueOnly.checked = false;
    elements.todayOnly.checked = false;
    elements.pinOnly.checked = false;
    if (elements.favoriteOnly) elements.favoriteOnly.checked = false;
    render();
  });

  elements.scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveScheduleFromForm();
  });
  elements.confirmTimelineMove?.addEventListener("click", () => confirmTimelineMove());
  elements.cancelTimelineMove?.addEventListener("click", () => elements.timelineMoveDialog.close());
  elements.closeTimelineMoveDialog?.addEventListener("click", () => elements.timelineMoveDialog.close());

  elements.closeActivityDialog?.addEventListener("click", () => elements.activityDialog.close());

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
  $("taskRecurrence")?.addEventListener("change", () => syncRecurrenceUi());
  $("taskDueDate")?.addEventListener("change", () => {
    applyRecurrenceDefaultsFromDueDate();
    syncRecurrenceUi();
  });
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
    recurrence: normalizeRecurrence(task.recurrence),
    recurrenceRule: normalizeRecurrenceRule(normalizeRecurrence(task.recurrence), task.recurrenceRule, task.dueDate),
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
    knowledgeId: String(task.knowledgeId || ""),
    lastChange: normalizeActivityChange(task.lastChange)
  };
}

function normalizeRecurrence(value) {
  const raw = String(value || "none");
  if (raw === "monthly") return "monthlyDay";
  return ["none", "daily", "weekly", "monthlyDay", "monthlyNth", "yearly"].includes(raw) ? raw : "none";
}

function normalizeRecurrenceRule(recurrence, rule = {}, dueDate = "") {
  const base = parseISODate(dueDate) || startOfToday();
  const interval = clampNumber(rule?.interval, 1, 36, 1);
  const weekday = clampWeekday(rule?.weekday ?? base.getDay());
  const weekdays = Array.isArray(rule?.weekdays)
    ? [...new Set(rule.weekdays.map(value => clampWeekday(value)).filter(value => value >= 0))]
    : [base.getDay()];
  const nth = ["1", "2", "3", "4", "5", "last"].includes(String(rule?.nth)) ? String(rule.nth) : String(getNthWeekInMonth(base));
  const monthDay = clampNumber(rule?.monthDay ?? base.getDate(), 1, 31, base.getDate());

  return {
    interval,
    weekdays: weekdays.length ? weekdays : [base.getDay()],
    nth,
    weekday,
    monthDay
  };
}

function clampNumber(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampWeekday(value) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return 1;
  return Math.min(6, Math.max(0, num));
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

async function unlinkKnowledgeFromTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !task.knowledgeId) return;
  if (!confirm("このタスクのナレッジ化を解除しますか？\n作成済みのナレッジも一覧から削除されます。")) return;

  const knowledgeId = task.knowledgeId;
  if (state.firebaseReady && state.dbApi) {
    await remove(ref(state.db, `rooms/${ROOM_ID}/knowledge/${knowledgeId}`));
  } else {
    state.knowledge = state.knowledge.filter(item => item.id !== knowledgeId);
    localStorage.setItem(knowledgeKey(), JSON.stringify(state.knowledge));
  }

  task.knowledgeId = "";
  task.history = appendHistory(task.history, "ナレッジ化を解除しました。");
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
  toast("ナレッジ化を解除しました");
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
    lastChange: makeActivityChange("新規タスク", [`「${source.title}」を複製`], { summary: "既存タスクから複製して作成" }),
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
    lastChange: makeActivityChange("新規タスク", ["クイック追加で作成", `担当: ${getCurrentUser()}`, "状態: 未着手"], { summary: "クイック追加で新しいタスクを作成" }),
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
    favorite: Boolean(elements.favoriteOnly?.checked),
    q: elements.searchInput.value,
    sort: elements.sortSelect.value
  };
}

function applyFilterValues(filter) {
  state.scope = ["all", "mine", "done", "mineDone"].includes(filter.scope) ? filter.scope : "all";
  elements.assigneeFilter.value = filter.assignee || "";
  elements.statusFilter.value = filter.status || "";
  elements.priorityFilter.value = filter.priority || "";
  elements.categoryFilter.value = filter.category || "";
  elements.overdueOnly.checked = Boolean(filter.overdue);
  elements.todayOnly.checked = Boolean(filter.today);
  elements.pinOnly.checked = Boolean(filter.pin);
  if (elements.favoriteOnly) elements.favoriteOnly.checked = Boolean(filter.favorite);
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
  toast("表示条件を保存しました");
}

async function deleteSavedFilter(id) {
  state.savedFilters = state.savedFilters.filter(filter => filter.id !== id);
  await saveSavedFilters();
}

function syncHeroUi() {
  const eyebrow = document.querySelector(".hero .eyebrow");
  const title = document.querySelector(".hero h2");
  if (!eyebrow || !title) return;

  const map = {
    today: {
      eyebrow: "TODAY WORK HUB",
      title: "本日の業務確認"
    },
    tasks: {
      eyebrow: state.taskLayout === "timeline" ? "TASK TIMELINE" : state.taskLayout === "list" ? "TASK LIST" : "TASK BOARD",
      title: "タスク進行管理"
    },
    dashboard: {
      eyebrow: "TASK INSIGHT",
      title: "進捗ダッシュボード"
    },
    schedule: {
      eyebrow: "SCHEDULE MANAGEMENT",
      title: "予定・スケジュール管理"
    }
  };

  const current = map[state.layout] || map.today;
  eyebrow.textContent = current.eyebrow;
  title.textContent = current.title;
}

function syncToolbarUi() {
  if (!elements.searchInput) return;
  if (state.layout === "schedule") {
    elements.searchInput.placeholder = "予定名・メモ・場所・分類で検索";
  } else {
    elements.searchInput.placeholder = "件名・内容・依頼元・タグで検索";
  }
}


function scopeHasMine(scope = state.scope) {
  return scope === "mine" || scope === "mineDone";
}

function scopeHasDone(scope = state.scope) {
  return scope === "done" || scope === "mineDone";
}

function makeScope(mine, done) {
  if (mine && done) return "mineDone";
  if (mine) return "mine";
  if (done) return "done";
  return "all";
}

function toggleScopeFilter(scope, filter) {
  const mine = scopeHasMine(scope);
  const done = scopeHasDone(scope);
  if (filter === "mine") return makeScope(!mine, done);
  if (filter === "done") return makeScope(mine, !done);
  return scope || "all";
}

function normalizeScopeForLayout() {
  // 今日ビュー・スケジュールには「完了」の概念を出さないため、非表示中の完了絞り込みは解除する。
  if ((state.layout === "today" || state.layout === "schedule") && scopeHasDone()) {
    state.scope = makeScope(scopeHasMine(), false);
  }

  // スケジュールでは状態・優先度・期限系フィルターは使わないため、裏で効いたままにしない。
  if (state.layout === "schedule") {
    if (elements.statusFilter) elements.statusFilter.value = "";
    if (elements.priorityFilter) elements.priorityFilter.value = "";
    if (elements.overdueOnly) elements.overdueOnly.checked = false;
    if (elements.todayOnly) elements.todayOnly.checked = false;
    if (elements.pinOnly) elements.pinOnly.checked = false;
    if (elements.favoriteOnly) elements.favoriteOnly.checked = false;
  }
}

function syncNavigationUi() {
  elements.navItems.forEach(item => {
    if (item.dataset.layout) {
      const active = item.dataset.layout === "tasks"
        ? ["tasks", "dashboard"].includes(state.layout)
        : item.dataset.layout === state.layout;
      item.classList.toggle("active", active);
    }
    if (item.dataset.filter === "mine") item.classList.toggle("active", scopeHasMine());
    if (item.dataset.filter === "favorite") item.classList.toggle("active", Boolean(elements.favoriteOnly?.checked));
    if (item.dataset.filter === "done") item.classList.toggle("active", scopeHasDone());
  });
  (elements.taskViewButtons || []).forEach(item => {
    item.classList.toggle("active", item.dataset.taskLayout === state.taskLayout && state.layout === "tasks");
  });
  (elements.statButtons || []).forEach(item => {
    item.classList.toggle("active", item.dataset.statLayout === state.layout);
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
  normalizeScopeForLayout();
  syncNavigationUi();
  syncToolbarUi();
  syncHeroUi();

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
  const mine = tasks.filter(t => !isCompletedStatus(t.status) && isCurrentUserOrGroupAssignee(t.assignee)).length;
  elements.openCount.textContent = `${open}件`;
  elements.overdueCount.textContent = `${overdue}件`;
  elements.todayCount.textContent = `${today}件`;
  elements.myCount.textContent = `${mine}件`;
}




function getActivityReadAt() {
  const key = activityReadAtKey();
  const saved = Number(localStorage.getItem(key));
  if (saved > 0) return saved;

  // 初回だけは現在時刻を基準にする。
  // 既存タスク・過去データを大量にお知らせしないため。
  const now = Date.now();
  localStorage.setItem(key, String(now));
  return now;
}

function setActivityReadAt(value = Date.now()) {
  localStorage.setItem(activityReadAtKey(), String(value));
}

function isTomorrowDue(dateString) {
  if (!dateString) return false;
  return dateString === toISODate(addDays(startOfToday(), 1));
}

function isScheduleTodayOrTomorrow(schedule) {
  const date = scheduleLocalDate(schedule);
  return date === todayISO() || date === toISODate(addDays(startOfToday(), 1));
}

function isTaskActivityImportant(task) {
  return isCurrentUserOrGroupAssignee(task.assignee)
    || isOverdue(task)
    || isDueToday(task)
    || isTomorrowDue(task.dueDate)
    || ["緊急", "高"].includes(task.priority);
}

function isScheduleActivityImportant(schedule) {
  return isCurrentUserOrGroupAssignee(schedule.assignee) || isScheduleTodayOrTomorrow(schedule);
}


function formatTaskActivityMeta(task) {
  return [
    `担当: ${task.assignee}`,
    task.status,
    `優先度: ${task.priority}`,
    task.dueDate ? `期限 ${formatDueForChange(task)}` : "期限なし"
  ].filter(Boolean).join(" / ");
}

function formatScheduleActivityMeta(schedule) {
  return [
    formatActivityScheduleTime(schedule),
    schedule.assignee ? `担当: ${schedule.assignee}` : "",
    schedule.location
  ].filter(Boolean).join(" / ");
}

function getActivityItems() {
  const since = getActivityReadAt();
  const current = getCurrentUser();
  const items = [];

  state.tasks.forEach(task => {
    const created = Number(task.createdAt) || 0;
    const updated = Number(task.updatedAt) || 0;
    const createdByOther = task.createdBy && task.createdBy !== current;
    const updatedByOther = task.updatedBy && task.updatedBy !== current;

    if (created > since && createdByOther) {
      const change = normalizeActivityChange(task.lastChange);
      items.push({
        kind: "task",
        action: change.label || "新規タスク",
        changeSummary: "",
        important: true,
        at: created,
        id: task.id,
        title: task.title,
        meta: formatTaskActivityMeta(task)
      });
    } else if (updated > since && updatedByOther) {
      const important = isTaskActivityImportant(task);
      const change = normalizeActivityChange(task.lastChange);
      items.push({
        kind: "task",
        action: change.label || (important ? "重要更新" : "更新"),
        changeSummary: change.summary || latestActivitySummary(task),
        important,
        at: updated,
        id: task.id,
        title: task.title,
        meta: formatTaskActivityMeta(task)
      });
    }
  });

  state.schedules.forEach(schedule => {
    const created = Number(schedule.createdAt) || 0;
    const updated = Number(schedule.updatedAt) || 0;
    const createdByOther = schedule.createdBy && schedule.createdBy !== current;
    const updatedByOther = schedule.updatedBy && schedule.updatedBy !== current;

    if (created > since && createdByOther) {
      const change = normalizeActivityChange(schedule.lastChange);
      items.push({
        kind: "schedule",
        action: change.label || "新規予定",
        changeSummary: "",
        important: true,
        at: created,
        id: schedule.id,
        title: schedule.title,
        meta: formatScheduleActivityMeta(schedule)
      });
    } else if (updated > since && updatedByOther) {
      const important = isScheduleActivityImportant(schedule);
      const change = normalizeActivityChange(schedule.lastChange);
      items.push({
        kind: "schedule",
        action: change.label || (important ? "重要更新" : "更新"),
        changeSummary: change.summary || latestActivitySummary(schedule, "予定の内容が更新されました"),
        important,
        at: updated,
        id: schedule.id,
        title: schedule.title,
        meta: formatScheduleActivityMeta(schedule)
      });
    }
  });

  return items.sort((a, b) => b.at - a.at);
}

function formatActivityScheduleTime(schedule) {
  const start = new Date(schedule.startAt);
  if (Number.isNaN(start.getTime())) return "";
  return `${toISODate(start)} ${formatScheduleTime(schedule.startAt)}〜${formatScheduleTime(schedule.endAt)}`;
}

function renderActivityPanel() {
  const items = getActivityItems();
  const importantItems = items.filter(item => item.important);
  const visibleItems = importantItems.slice(0, 10);
  const hiddenImportantCount = Math.max(0, importantItems.length - visibleItems.length);
  const otherCount = items.filter(item => !item.important).length;
  const unreadCount = items.length;
  const lastRead = Number(localStorage.getItem(activityReadAtKey())) || 0;

  return `<section class="today-panel activity-panel">
    <div class="activity-head">
      <div>
        <h4 class="activity-title activity-title-emoji">
          <span class="activity-title-bell" aria-hidden="true">🔔</span>
          <span class="activity-title-text">お知らせ</span>
          ${unreadCount ? `<span class="activity-count">${unreadCount}件</span>` : ""}
        </h4>
        <p>新規追加と、見落としやすい重要更新をここで確認できます。</p>
      </div>
      <div class="activity-actions">
        ${renderNotificationPermissionButton()}
        <button class="ghost-button activity-read-button" type="button" data-mark-activity-read ${unreadCount ? "" : "disabled"}>確認済みにする</button>
      </div>
    </div>

    ${visibleItems.length ? `
      <div class="activity-list">
        ${visibleItems.map(renderActivityItem).join("")}
      </div>
    ` : `
      <div class="activity-empty">
        <strong>新しい重要なお知らせはありません。</strong>
        <p>${lastRead ? `最終確認：${escapeHtml(formatDateTime(lastRead))}` : "確認済みの情報はありません。"}</p>
      </div>
    `}

    ${(hiddenImportantCount || otherCount) ? `
      <div class="activity-more-row">
        <p>${hiddenImportantCount ? `未表示の重要なお知らせが ${hiddenImportantCount}件 あります。` : ""}${otherCount ? ` 重要度が低い更新が ${otherCount}件 あります。` : ""}</p>
        <button class="ghost-button" type="button" data-open-activity-dialog>すべて見る</button>
      </div>
    ` : ""}
  </section>`;
}

function renderActivityItem(item) {
  const badgeClass = item.kind === "schedule" ? "schedule" : "task";
  const targetAttr = item.kind === "schedule"
    ? `data-activity-schedule="${escapeHtml(item.id)}"`
    : `data-activity-task="${escapeHtml(item.id)}"`;

  return `<button type="button" class="activity-item ${badgeClass} ${item.changeSummary ? "" : "no-change-summary"}" ${targetAttr}>
    <span class="activity-kind">${escapeHtml(item.action)}</span>
    <strong>${escapeHtml(item.title)}</strong>
    ${item.changeSummary ? `<small class="activity-change">${escapeHtml(item.changeSummary)}</small>` : ""}
    <small class="activity-meta">${escapeHtml(item.meta)}</small>
    <time>${escapeHtml(formatDateTime(item.at))}</time>
  </button>`;
}

function renderNotificationPermissionButton() {
  if (!("Notification" in window)) {
    return `<span class="notification-status unsupported">通知非対応</span>`;
  }
  if (Notification.permission === "granted") {
    return `<span class="notification-status granted">予定通知ON</span>`;
  }
  if (Notification.permission === "denied") {
    return `<span class="notification-status denied">通知ブロック中</span>`;
  }
  return `<button class="ghost-button notification-enable-button" type="button" data-enable-schedule-notifications>予定通知ON</button>`;
}

function bindActivityPanel(root) {
  root.querySelector("[data-mark-activity-read]")?.addEventListener("click", () => {
    setActivityReadAt(Date.now());
    render();
    toast("お知らせを確認済みにしました");
  });

  root.querySelector("[data-enable-schedule-notifications]")?.addEventListener("click", requestScheduleNotificationPermission);
  root.querySelector("[data-open-activity-dialog]")?.addEventListener("click", openActivityDialog);
  bindActivityItemActions(root);
}

function bindActivityItemActions(root) {
  root.querySelectorAll("[data-activity-task]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.__activityClickTimer) clearTimeout(button.__activityClickTimer);
      button.__activityClickTimer = setTimeout(() => {
        button.__activityClickTimer = null;
        const task = state.tasks.find(item => item.id === button.dataset.activityTask);
        if (!task) return;
        if (elements.activityDialog?.open) elements.activityDialog.close();
        selectTask(task.id);
      }, 220);
    });

    button.addEventListener("dblclick", event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.__activityClickTimer) {
        clearTimeout(button.__activityClickTimer);
        button.__activityClickTimer = null;
      }
      const task = state.tasks.find(item => item.id === button.dataset.activityTask);
      if (!task) return;
      if (elements.activityDialog?.open) elements.activityDialog.close();
      openTaskEditorById(task.id);
    });
  });

  root.querySelectorAll("[data-activity-schedule]").forEach(button => {
    button.addEventListener("click", () => {
      const schedule = state.schedules.find(item => item.id === button.dataset.activitySchedule);
      if (!schedule) return;
      if (elements.activityDialog?.open) elements.activityDialog.close();
      openScheduleDialog(schedule);
    });
  });
}

function openActivityDialog() {
  const items = getActivityItems();
  const importantItems = items.filter(item => item.important);
  const otherItems = items.filter(item => !item.important);

  elements.activityDialogBody.innerHTML = `
    <div class="activity-dialog-summary">
      <strong>${items.length}件のお知らせ</strong>
      <span>重要 ${importantItems.length}件 / その他 ${otherItems.length}件</span>
    </div>

    ${importantItems.length ? `
      <section class="activity-dialog-section">
        <h3>重要なお知らせ</h3>
        <div class="activity-dialog-list">${importantItems.map(renderActivityItem).join("")}</div>
      </section>
    ` : ""}

    ${otherItems.length ? `
      <section class="activity-dialog-section">
        <h3>その他の更新</h3>
        <div class="activity-dialog-list">${otherItems.map(renderActivityItem).join("")}</div>
      </section>
    ` : ""}

    ${!items.length ? `<div class="activity-empty"><strong>お知らせはありません。</strong><p>確認が必要な追加・更新はありません。</p></div>` : ""}
  `;
  bindActivityItemActions(elements.activityDialogBody);
  elements.activityDialog.showModal();
}

function renderTodayView() {
  const today = startOfToday();
  const todayIso = todayISO();
  const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status));
  const schedules = state.schedules
    .filter(s => scheduleLocalDate(s) === todayIso)
    .filter(s => !scopeHasMine() || s.assignee === getCurrentUser())
    .sort((a,b) => new Date(a.startAt) - new Date(b.startAt));

  const overdue = openTasks.filter(isOverdue).sort(compareSmartTasks);
  const dueToday = openTasks.filter(isDueToday).sort(compareSmartTasks);
  const unsorted = openTasks.filter(isUnsortedTask).sort(compareSmartTasks);
  const spare = openTasks.filter(t => !t.dueDate && !isUnsortedTask(t)).sort(compareSmartTasks).slice(0, 10);

  elements.todayView.innerHTML = `
    ${renderActivityPanel()}

    <section class="today-head today-head-after-activity">
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
  bindActivityPanel(elements.todayView);
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
      <div class="schedule-title-block">
        <div class="schedule-title-line">
          <h3>スケジュール</h3>
          <span class="schedule-range-label">${escapeHtml(rangeLabel)}</span>
        </div>
        <p>${escapeHtml(modeLabel)}で予定を確認できます。タスクとは別に、開始・終了時間で管理します。</p>
      </div>
      <div class="schedule-actions">
        <div class="schedule-control-group">
          <span>表示期間</span>
          <div class="segmented-buttons">
            <button type="button" class="schedule-range ${state.scheduleRange === "today" ? "active" : ""}" data-schedule-range="today">今日</button>
            <button type="button" class="schedule-range ${state.scheduleRange === "week" ? "active" : ""}" data-schedule-range="week">7日間</button>
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


function startScheduleReminderWatcher() {
  if (state.scheduleReminderTimer) return;
  state.scheduleReminderTimer = setInterval(checkScheduleReminders, 30000);
  setTimeout(checkScheduleReminders, 1200);
}

function getScheduleReminderMap() {
  try {
    const saved = JSON.parse(localStorage.getItem(scheduleReminderSeenKey()) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function setScheduleReminderMap(map) {
  localStorage.setItem(scheduleReminderSeenKey(), JSON.stringify(map || {}));
}

function scheduleReminderKey(schedule) {
  return `${schedule.id}:${schedule.startAt}`;
}

function shouldScheduleReminderNotify(schedule) {
  if (!schedule?.startAt) return false;
  if (!schedule.assignee) return true;
  if (isCurrentUserOrGroupAssignee(schedule.assignee)) return true;
  return ["システム", "全員", "共通"].includes(schedule.assignee);
}

function checkScheduleReminders() {
  if (!Array.isArray(state.schedules) || !state.schedules.length) return;

  const now = Date.now();
  const reminderBeforeMs = 15 * 60 * 1000;
  const seen = getScheduleReminderMap();
  let changed = false;

  // 古い通知済み記録は肥大化防止のため削除
  Object.keys(seen).forEach(key => {
    if (now - Number(seen[key]) > 7 * 24 * 60 * 60 * 1000) {
      delete seen[key];
      changed = true;
    }
  });

  state.schedules.forEach(schedule => {
    if (!shouldScheduleReminderNotify(schedule)) return;

    const start = new Date(schedule.startAt).getTime();
    if (Number.isNaN(start)) return;

    const diff = start - now;
    const key = scheduleReminderKey(schedule);

    if (diff > 0 && diff <= reminderBeforeMs && !seen[key]) {
      seen[key] = now;
      changed = true;
      fireScheduleReminder(schedule);
    }
  });

  if (changed) setScheduleReminderMap(seen);
}

async function requestScheduleNotificationPermission() {
  if (!("Notification" in window)) {
    toast("このブラウザは通知に対応していません", true);
    return;
  }

  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      toast("予定通知をONにしました");
      checkScheduleReminders();
    } else {
      toast("通知が許可されませんでした。ブラウザ設定を確認してください", true);
    }
    render();
  } catch {
    toast("通知許可を取得できませんでした", true);
  }
}

function fireScheduleReminder(schedule) {
  const title = `予定15分前：${schedule.title}`;
  const body = [
    `${formatScheduleTime(schedule.startAt)}〜${formatScheduleTime(schedule.endAt)}`,
    schedule.location ? `場所：${schedule.location}` : "",
    schedule.assignee ? `担当：${schedule.assignee}` : ""
  ].filter(Boolean).join(" / ");

  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      tag: scheduleReminderKey(schedule),
      icon: "assets/brand.png",
      renotify: true
    });
    notification.onclick = () => {
      window.focus();
      openScheduleDialog(schedule);
      notification.close();
    };
  } else {
    toast(`${title} ${body}`);
  }

  flashReminderTitle(title);
  playReminderBeep();
}

function flashReminderTitle(message) {
  const original = document.title;
  document.title = `🔔 ${message}`;
  setTimeout(() => {
    document.title = original || "業務管理ボード";
  }, 15000);
}

function playReminderBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 180);
  } catch {}
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
      if (scopeHasMine() && !isCurrentUserOrGroupAssignee(schedule.assignee)) return false;
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
    const start = new Date(anchor);
    start.setHours(0,0,0,0);
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
  syncAssigneeOptions($("scheduleAssignee"));
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

  const changeInfo = makeScheduleChangeInfo(existing, schedule);
  schedule.lastChange = changeInfo;
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

  state.scope = makeScope(isCurrentUserOrGroupAssignee(task.assignee), isCompletedStatus(task.status));

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
    updatedBy: schedule.updatedBy || getCurrentUser(),
    lastChange: normalizeActivityChange(schedule.lastChange)
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
  checkScheduleReminders();
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
    return `<section class="board-column" data-drop-kind="status" data-drop-value="${escapeHtml(status)}" data-status="${escapeHtml(status)}" data-task-drop-status="${escapeHtml(status)}">
      <div class="column-head">
        <span class="column-title">
          <span class="column-drag-handle" draggable="true" data-drag-kind="status" data-drag-value="${escapeHtml(status)}" title="ドラッグして状態の順番を変更">☰</span>
          <span>${escapeHtml(status)}</span>
        </span>
        <em>${list.length}</em>
      </div>
      <div class="task-list">${list.map(taskCard).join("") || emptyColumn(status)}</div>
      <div class="board-drop-zone" aria-hidden="true">ここへ移動</div>
    </section>`;
  }).join("");

  const addColumn = state.scope === "done" ? "" : `<section class="board-column add-status-column">
    <button type="button" data-add-status>＋ セクション追加</button>
    <p>新しい状態を追加できます。</p>
  </section>`;

  elements.boardView.innerHTML = columns + addColumn;
  bindTaskCards(elements.boardView);
  bindBoardTaskDrops(elements.boardView);
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

    <section class="timeline-undated" data-timeline-undated-drop="true">
      <div class="timeline-undated-head">
        <strong>期限なし</strong>
        <span>${undated.length}件</span>
      </div>
      <div class="timeline-undated-list">
        ${undated.length ? undated.map(timelineTask).join("") : `<p>期限なしのタスクはありません。</p>`}
      </div>
    </section>
  `;

  bindTaskDragSources(elements.timelineView);
  bindTimelineTaskDrops(elements.timelineView);
  elements.timelineView.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", (event) => {
      if (event.target.closest("button,input,select,textarea")) return;
      if (Date.now() - lastTaskDragEndAt < 260) return;
      selectTask(el.dataset.taskId);
    });
    el.addEventListener("dblclick", (event) => {
      if (event.target.closest("button,input,select,textarea")) return;
      if (Date.now() - lastTaskDragEndAt < 260) return;
      event.stopPropagation();
      openTaskEditorById(el.dataset.taskId);
    });
    el.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTask(el.dataset.taskId);
      }
    });
  });
  elements.timelineView.querySelectorAll("[data-move-to-timeline]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      openTimelineMoveDialog(button.dataset.moveToTimeline);
    });
    button.addEventListener("dblclick", event => event.stopPropagation());
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

function taskStateClasses(task) {
  return [
    task?.pinned ? "pinned" : "",
    isOverdue(task) ? "overdue" : "",
    isDueToday(task) ? "due-today" : "",
    isStale(task) ? "stale" : ""
  ].filter(Boolean).join(" ");
}

function timelineTask(task) {
  return `<article role="button" tabindex="0" class="timeline-task timeline-task-compact ${isTaskStarred(task.id) ? "favorite-task" : ""} priority-line-${escapeHtml(task.priority)} ${taskStateClasses(task)}" draggable="true" data-task-drag-id="${escapeHtml(task.id)}" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(task.title)}">
    <span class="timeline-task-line">
      ${userAvatarOnly(task.assignee)}
      ${priorityBadge(task.priority)}
      <strong>${escapeHtml(task.title)}</strong>
    </span>
    <button type="button" class="timeline-move-button" data-move-to-timeline="${escapeHtml(task.id)}" title="タイムラインへ移動">移動</button>
  </article>`;
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
      <thead><tr><th class="bulk-check-cell"><input type="checkbox" data-bulk-all /></th><th class="star-cell">★</th><th>件名</th><th>担当</th><th>状態</th><th>優先度</th><th>分類</th><th>期限</th><th>更新</th></tr></thead>
      <tbody>${tasks.length ? tasks.map(t => `<tr class="priority-row priority-${escapeHtml(t.priority)} ${isTaskStarred(t.id) ? "favorite-task" : ""} ${taskStateClasses(t)}" data-task-id="${escapeHtml(t.id)}">
        <td class="bulk-check-cell"><input type="checkbox" data-bulk-id="${escapeHtml(t.id)}" /></td>
        <td class="star-cell">${favoriteButton(t, "list-star")}</td>
        <td><strong>${escapeHtml(t.title)}</strong><br><small>${escapeHtml(t.requester || "依頼元未入力")}</small></td>
        <td>${userBadge(t.assignee)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td>${dueLabel(t)}</td>
        <td>${formatDateTime(t.updatedAt)}</td>
      </tr>`).join("") : `<tr><td colspan="9"><div class="today-empty"><strong>対象タスクはありません。</strong><p>条件を変更するか、新しいタスクを追加してください。</p><button type="button" class="ghost-button" data-new-task-empty>＋ 新しいタスク</button></div></td></tr>`}</tbody>
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

function bindTaskDragSources(root) {
  if (!root) return;

  root.querySelectorAll("[data-task-drag-id]").forEach(source => {
    if (source.dataset.taskDragSourceBound === "true") return;
    source.dataset.taskDragSourceBound = "true";
    source.setAttribute("draggable", "true");

    source.addEventListener("dragstart", event => {
      const id = source.dataset.taskDragId;
      if (!id || !event.dataTransfer) return;

      state.draggingTaskId = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({ kind: "task", id }));
      if (event.dataTransfer.setDragImage) {
        event.dataTransfer.setDragImage(source, Math.min(80, source.offsetWidth / 2), 20);
      }
      source.classList.add("is-task-dragging");
      document.body.classList.add("task-dragging");
    });

    source.addEventListener("dragend", () => cleanupTaskDragUi());
  });
}

function cleanupTaskDragUi() {
  lastTaskDragEndAt = Date.now();
  state.draggingTaskId = "";
  document.body.classList.remove("task-dragging");
  document.querySelectorAll(".is-task-dragging, .task-drop-over").forEach(el => {
    el.classList.remove("is-task-dragging", "task-drop-over");
  });
}

function bindBoardTaskDrops(root) {
  if (!root || root.dataset.boardDropBound === "true") return;
  root.dataset.boardDropBound = "true";

  root.addEventListener("dragover", event => {
    if (!isTaskDragEvent(event)) return;
    const column = event.target.closest("[data-task-drop-status]");
    if (!column || !root.contains(column)) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    root.querySelectorAll(".task-drop-over").forEach(el => {
      if (el !== column) el.classList.remove("task-drop-over");
    });
    column.classList.add("task-drop-over");
  });

  root.addEventListener("dragleave", event => {
    const column = event.target.closest("[data-task-drop-status]");
    if (!column || !root.contains(column)) return;
    if (column.contains(event.relatedTarget)) return;
    column.classList.remove("task-drop-over");
  });

  root.addEventListener("drop", async event => {
    const payload = getTaskDragPayload(event);
    if (!payload) return;

    const column = event.target.closest("[data-task-drop-status]");
    if (!column || !root.contains(column)) return;

    event.preventDefault();
    event.stopPropagation();
    column.classList.remove("task-drop-over");

    try {
      await moveTaskByDrag(payload.id, {
        status: column.dataset.taskDropStatus,
        source: "board"
      });
    } finally {
      cleanupTaskDragUi();
    }
  });
}

function bindTimelineTaskDrops(root) {
  if (!root || root.dataset.timelineDropBound === "true") return;
  root.dataset.timelineDropBound = "true";

  root.addEventListener("dragover", event => {
    if (!isTaskDragEvent(event)) return;
    const target = event.target.closest("[data-timeline-date][data-timeline-status], [data-timeline-undated-drop]");
    if (!target || !root.contains(target)) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    root.querySelectorAll(".task-drop-over").forEach(el => {
      if (el !== target) el.classList.remove("task-drop-over");
    });
    target.classList.add("task-drop-over");
  });

  root.addEventListener("dragleave", event => {
    const target = event.target.closest("[data-timeline-date][data-timeline-status], [data-timeline-undated-drop]");
    if (!target || !root.contains(target)) return;
    if (target.contains(event.relatedTarget)) return;
    target.classList.remove("task-drop-over");
  });

  root.addEventListener("drop", async event => {
    const payload = getTaskDragPayload(event);
    if (!payload) return;

    const target = event.target.closest("[data-timeline-date][data-timeline-status], [data-timeline-undated-drop]");
    if (!target || !root.contains(target)) return;

    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("task-drop-over");

    try {
      if (target.dataset.timelineUndatedDrop === "true") {
        await moveTaskByDrag(payload.id, {
          dueDate: "",
          source: "timeline-undated"
        });
        return;
      }

      await moveTaskByDrag(payload.id, {
        status: target.dataset.timelineStatus,
        dueDate: target.dataset.timelineDate,
        source: "timeline"
      });
    } finally {
      cleanupTaskDragUi();
    }
  });
}

function isTaskDragEvent(event) {
  if (state.draggingTaskId) return true;
  if (!event.dataTransfer) return false;
  const types = [...(event.dataTransfer.types || [])];
  if (!types.includes("text/plain")) return true;
  const raw = event.dataTransfer.getData("text/plain");
  return !raw || raw.includes('"kind":"task"');
}

function getTaskDragPayload(event) {
  const fallback = state.draggingTaskId ? { kind: "task", id: state.draggingTaskId } : null;
  if (!event.dataTransfer) return fallback;
  const raw = event.dataTransfer.getData("text/plain");
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.kind === "task" && parsed.id ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function moveTaskByDrag(id, { status, dueDate, source = "board" } = {}) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;

  const nextStatus = status ? normalizeStatus(status) : task.status;
  const nextDueDate = dueDate === undefined ? task.dueDate : String(dueDate || "");
  const statusChanged = task.status !== nextStatus;
  const dueChanged = task.dueDate !== nextDueDate;
  if (!statusChanged && !dueChanged) {
    cleanupTaskDragUi();
    return;
  }

  const beforeStatus = task.status;
  const beforeDueDate = task.dueDate || "期限なし";
  const wasCompleted = isCompletedStatus(task.status);

  task.status = nextStatus;
  task.dueDate = nextDueDate;
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();

  if (isCompletedStatus(nextStatus)) {
    task.completedAt = task.completedAt || Date.now();
  } else {
    task.completedAt = 0;
    task.completedMemo = "";
  }

  const changes = [];
  if (statusChanged) changes.push(`状態: ${beforeStatus} → ${nextStatus}`);
  if (dueChanged) changes.push(`期限: ${beforeDueDate} → ${nextDueDate || "期限なし"}`);
  task.lastChange = makeActivityChange(dueChanged ? "期限変更" : "状態変更", changes, {
    historyText: `ドラッグ操作で${changes.join("、")}しました。`
  });
  task.history = appendHistory(task.history, task.lastChange.historyText);

  await persistTask(task);
  if (!wasCompleted && isCompletedStatus(nextStatus)) await maybeCreateNextRecurringTask(task);

  cleanupTaskDragUi();
  render();
  toast(source === "timeline" ? "状態と期限を変更しました" : source === "timeline-undated" ? "期限なしに変更しました" : "状態を変更しました");
}

let lastTaskDragEndAt = 0;

function bindTaskCards(root) {
  bindFavoriteButtons(root);
  bindTaskDragSources(root);
  root.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", () => {
      if (Date.now() - lastTaskDragEndAt < 260) return;
      selectTask(el.dataset.taskId);
    });
    el.addEventListener("dblclick", (event) => {
      if (Date.now() - lastTaskDragEndAt < 260) return;
      event.stopPropagation();
      openTaskEditorById(el.dataset.taskId);
    });
  });
}

function bindTaskRows(root) {
  bindFavoriteButtons(root);
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

  if (action === "assignee") {
    const values = getAssigneeOptions();
    target.innerHTML = values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(assigneeOptionLabel(value))}</option>`).join("");
    target.hidden = false;
    return;
  }

  const values = action === "status" ? getStatusList() : state.categories;
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
    const beforeTask = { ...task, checklist: [...(task.checklist || [])], tags: [...(task.tags || [])], recurrenceRule: { ...(task.recurrenceRule || {}) } };
    if (action === "status") task.status = normalizeStatus(target);
    if (action === "assignee") task.assignee = normalizeUser(target);
    if (action === "category") task.category = normalizeCategory(target);
    if (action === "complete") {
      task.status = COMPLETED_STATUS;
      task.completedAt = Date.now();
    }
    task.updatedAt = Date.now();
    task.updatedBy = getCurrentUser();
    const changeInfo = makeTaskChangeInfo(beforeTask, task);
    task.lastChange = changeInfo;
    task.history = appendHistory(task.history, `一括操作で${bulkActionLabel(action)}しました。${changeInfo.summary && changeInfo.summary !== bulkActionLabel(action) ? `（${changeInfo.summary}）` : ""}`);
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
  return `<article class="task-card priority-card priority-${escapeHtml(task.priority)} ${isTaskStarred(task.id) ? "favorite-task" : ""} ${task.pinned ? "pinned" : ""} ${overdue ? "overdue" : ""} ${dueToday ? "due-today" : ""} ${stale ? "stale" : ""}" draggable="true" data-task-drag-id="${escapeHtml(task.id)}" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(colorHint)}">
    ${favoriteButton(task, "card-star")}
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

  elements.detailBody.innerHTML = `
    <h3 class="detail-title">${escapeHtml(task.title)}</h3>
    <div class="task-meta">${statusBadge(task.status)}${priorityBadge(task.priority)}${categoryBadge(task.category)}${task.pinned ? `<span class="badge priority-中">固定</span>` : ""}${task.recurrence && task.recurrence !== "none" ? `<span class="badge recurrence-badge">${escapeHtml(describeRecurrence(task))}</span>` : ""}</div>
    ${detailAlerts(task)}

    <div class="detail-actions detail-actions-v2">
      <div class="main-actions">
        <button class="primary-button" data-action="edit">編集する</button>
        ${!isCompletedStatus(task.status) ? `<button class="complete-button" data-action="done">✓ 完了にする</button>` : `<button class="ghost-button" data-action="reopen">未着手に戻す</button>`}
      </div>
      <div class="sub-actions">
        <button class="ghost-button detail-favorite-button ${isTaskStarred(task.id) ? "starred" : ""}" data-action="favorite">${isTaskStarred(task.id) ? "★ スター解除" : "☆ スター"}</button>
        <button class="ghost-button" data-action="make-schedule">予定を作成</button>
        <button class="ghost-button" data-action="duplicate">複製</button>
        <button class="ghost-button danger-text" data-action="delete">削除</button>
      </div>
    </div>

    <section class="detail-section">
      <div class="detail-grid">
        <div class="field-card"><small>担当者</small>${userBadge(task.assignee)}</div>
        <div class="field-card"><small>依頼元</small><strong>${escapeHtml(task.requester || "未入力")}</strong></div>
        <div class="field-card"><small>期限</small><strong>${dueLabel(task)}</strong></div>
        <div class="field-card"><small>繰り返し</small><strong>${escapeHtml(describeRecurrence(task))}</strong></div>
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
  elements.detailBody.querySelector('[data-action="favorite"]')?.addEventListener("click", () => toggleTaskFavorite(task.id));
  elements.detailBody.querySelector('[data-action="make-schedule"]')?.addEventListener("click", () => openScheduleDialogFromTask(task));
  elements.detailBody.querySelector('[data-action="duplicate"]')?.addEventListener("click", () => duplicateTask(task.id));
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
    const mineActive = scopeHasMine();
    const doneActive = scopeHasDone() || isCompletedStatus(elements.statusFilter.value);
    if (mineActive && !isCurrentUserOrGroupAssignee(task.assignee)) return false;
    if (doneActive && !isCompletedStatus(task.status)) return false;
    if (!doneActive && isCompletedStatus(task.status)) return false;
    if (elements.assigneeFilter.value && task.assignee !== elements.assigneeFilter.value) return false;
    if (elements.statusFilter.value && task.status !== elements.statusFilter.value) return false;
    if (elements.priorityFilter.value && task.priority !== elements.priorityFilter.value) return false;
    if (elements.categoryFilter.value && task.category !== elements.categoryFilter.value) return false;
    if (elements.pinOnly.checked && !task.pinned) return false;
    if (elements.favoriteOnly?.checked && !isTaskStarred(task.id)) return false;
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
  // ダッシュボードでは検索欄を表示しないため、検索文字列では絞り込まない。
  // 左メニューの担当者・状態・優先度・分類などの絞り込みだけを反映する。
  const q = "";
  const now = startOfToday();

  return state.tasks.filter(task => {
    // ダッシュボードでは「自分の担当」でも完了済みタスクを残す。
    // そうしないと「今月完了」が0件になってしまう。
    const mineActive = scopeHasMine();
    const doneActive = scopeHasDone() || isCompletedStatus(elements.statusFilter.value);
    if (mineActive && !isCurrentUserOrGroupAssignee(task.assignee)) return false;
    if (doneActive && !isCompletedStatus(task.status)) return false;

    if (elements.assigneeFilter.value && task.assignee !== elements.assigneeFilter.value) return false;
    if (elements.statusFilter.value && task.status !== elements.statusFilter.value) return false;
    if (elements.priorityFilter.value && task.priority !== elements.priorityFilter.value) return false;
    if (elements.categoryFilter.value && task.category !== elements.categoryFilter.value) return false;
    if (elements.pinOnly.checked && !task.pinned) return false;
    if (elements.favoriteOnly?.checked && !isTaskStarred(task.id)) return false;

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



function openTimelineMoveDialog(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return toast("対象タスクが見つかりません", true);

  state.pendingTimelineMoveTaskId = task.id;
  elements.timelineMoveTaskTitle.textContent = task.title;
  syncStatusOptions(elements.timelineMoveStatus);
  elements.timelineMoveStatus.value = task.status || getDefaultOpenStatus();
  elements.timelineMoveDueDate.value = task.dueDate || todayISO();
  elements.timelineMoveDialog.showModal();
}

async function confirmTimelineMove() {
  const task = state.tasks.find(item => item.id === state.pendingTimelineMoveTaskId);
  if (!task) return toast("対象タスクが見つかりません", true);

  const dueDate = elements.timelineMoveDueDate.value;
  if (!dueDate) {
    toast("期限日を選択してください", true);
    return;
  }

  const beforeStatus = task.status;
  const beforeDueDate = task.dueDate || "期限なし";
  const nextStatus = normalizeStatus(elements.timelineMoveStatus.value || task.status);
  const statusChanged = task.status !== nextStatus;
  const dueChanged = task.dueDate !== dueDate;
  if (!statusChanged && !dueChanged) {
    elements.timelineMoveDialog.close();
    return;
  }

  const wasCompleted = isCompletedStatus(task.status);
  task.status = nextStatus;
  task.dueDate = dueDate;
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();

  if (isCompletedStatus(nextStatus)) {
    task.completedAt = task.completedAt || Date.now();
  } else {
    task.completedAt = 0;
    task.completedMemo = "";
  }

  const changes = [];
  if (statusChanged) changes.push(`状態: ${beforeStatus} → ${nextStatus}`);
  if (dueChanged) changes.push(`期限: ${beforeDueDate} → ${dueDate}`);
  task.lastChange = makeActivityChange(dueChanged ? "期限変更" : "状態変更", changes, {
    historyText: `タイムライン移動ボタンで${changes.join("、")}しました。`
  });
  task.history = appendHistory(task.history, task.lastChange.historyText);

  await persistTask(task);
  if (!wasCompleted && isCompletedStatus(nextStatus)) await maybeCreateNextRecurringTask(task);

  elements.timelineMoveDialog.close();
  state.pendingTimelineMoveTaskId = "";
  render();
  toast("タイムラインへ移動しました");
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
  $("taskRecurrence").value = normalizeRecurrence(task?.recurrence || "none");
  setRecurrenceFields(task);
  $("taskTemplate").value = "";
  $("taskRequester").value = task?.requester || "";
  $("taskTags").value = task?.tags?.join(", ") || "";
  $("taskDescription").value = task?.description || "";
  $("taskChecklist").value = task?.checklist?.map(i => `${i.done ? "[x] " : ""}${i.text}`).join("\n") || "";
  $("taskPinned").checked = Boolean(task?.pinned);
  syncRecurrenceUi();
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
    recurrence: normalizeRecurrence($("taskRecurrence").value),
    recurrenceRule: getRecurrenceRuleFromForm(),
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

  const changeInfo = makeTaskChangeInfo(existing, task);
  task.lastChange = changeInfo;
  task.history = appendHistory(task.history, existing ? (changeInfo.historyText || summarizeTaskChanges(existing, task)) : "タスクを作成しました。");
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
  task.lastChange = makeActivityChange("状態変更", [`状態: ${beforeStatus} → ${status}`, memo ? `完了メモ: ${shortText(memo, 40)}` : ""], {
    historyText: `状態を「${beforeStatus}」から「${status}」へ変更しました。${memo ? " 完了メモ：" + memo : ""}`
  });
  task.history = appendHistory(task.history, task.lastChange.historyText);
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
  task.lastChange = makeActivityChange("チェックリスト更新", [`${done ? "完了" : "未完了"}: ${shortText(task.checklist[index].text, 42)}`]);
  task.history = appendHistory(task.history, `チェックリスト「${task.checklist[index].text}」を${done ? "完了" : "未完了"}にしました。`);
  task.updatedAt = Date.now();
  task.updatedBy = getCurrentUser();
  await persistTask(task);
}

async function addComment(id, text, type = "作業メモ") {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.comments = [...(task.comments || []), { id: generateId(), author: getCurrentUser(), type, text, createdAt: Date.now() }];
  task.lastChange = makeActivityChange(`${type}追加`, [`${type}: ${shortText(text, 48)}`], { summary: `${type}が追加されました` });
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


function getGroupAssignee() {
  return sanitizeUser(state.roomName || "");
}

function isGroupAssignee(value) {
  const group = getGroupAssignee();
  return Boolean(group && normalizeText(value) === normalizeText(group));
}

function isCurrentUserOrGroupAssignee(value) {
  return normalizeText(value) === normalizeText(getCurrentUser()) || isGroupAssignee(value);
}

function getAssigneeOptions() {
  const result = [...state.users];
  const group = getGroupAssignee();
  if (group && !result.some(user => normalizeText(user) === normalizeText(group))) {
    result.unshift(group);
  }
  return result;
}

function assigneeOptionLabel(value) {
  return isGroupAssignee(value) ? `共有ルーム：${value}` : value;
}

function syncAssigneeOptions(select, includeAll = false) {
  if (!select) return;
  const currentValue = select.value;
  const options = getAssigneeOptions();
  select.innerHTML = `${includeAll ? '<option value="">すべて</option>' : ""}${options.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(assigneeOptionLabel(value))}</option>`).join("")}`;
  if ([...select.options].some(opt => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

function syncAssigneeUi() {
  syncAssigneeOptions($("taskAssignee"));
  syncAssigneeOptions($("scheduleAssignee"));
  syncAssigneeOptions(elements.assigneeFilter, true);
}

function syncUserUi() {
  const current = getCurrentUser();
  syncUserOptions(elements.currentUserSelect);
  syncUserOptions(elements.startupUser);
  syncAssigneeUi();
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
  const group = typeof state !== "undefined" ? getGroupAssignee() : "";
  if (group && normalizeText(raw) === normalizeText(group)) return group;
  return state.users.find(u => normalizeText(u) === normalizeText(raw)) || raw || state.users[0] || DEFAULT_USERS[0];
}
function getCurrentUser() {
  return normalizeUser(state.currentUser || localStorage.getItem("systemTaskUser") || state.users[0]);
}
function setCurrentUser(value) {
  state.currentUser = normalizeUser(value);
  localStorage.setItem("systemTaskUser", state.currentUser);
  state.favoriteTaskIds = loadFavoriteTaskIds();
  syncCurrentUserStatuses({ persist: false, silent: true });
  syncUserUi();
  render();
}
function userColor(name) {
  const user = normalizeUser(name);
  if (isGroupAssignee(user)) return "#2e9ab7";
  return state.userColors[user] || DEFAULT_COLORS[user] || "#7c5cff";
}
function userBadge(name) {
  const user = normalizeUser(name);
  const group = isGroupAssignee(user);
  const initial = group ? "共" : user.slice(0,1);
  return `<span class="user-badge ${group ? "group-badge" : ""}" title="${group ? "共有ルーム担当" : "担当者"}" style="--user-color:${escapeHtml(userColor(user))}"><span class="tiny-avatar">${escapeHtml(initial)}</span>${escapeHtml(user)}</span>`;
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
  syncAssigneeUi();
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


function normalizeActivityChange(change) {
  if (!change || typeof change !== "object") {
    return { label: "", summary: "", details: [] };
  }
  const details = Array.isArray(change.details)
    ? change.details.map(item => String(item || "").trim()).filter(Boolean).slice(0, 6)
    : [];
  return {
    label: String(change.label || "").trim().slice(0, 18),
    summary: String(change.summary || "").trim().slice(0, 140),
    details
  };
}

function shortText(value, length = 42) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function formatDueForChange(task) {
  if (!task?.dueDate) return "期限なし";
  return `${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}`;
}

function makeActivityChange(label, details = [], options = {}) {
  const cleanDetails = (Array.isArray(details) ? details : [details])
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const summary = options.summary || cleanDetails.slice(0, 2).join(" / ") || label;
  return {
    label,
    summary,
    details: cleanDetails,
    historyText: options.historyText || `${label}：${cleanDetails.join("、") || summary}`
  };
}

function makeTaskChangeInfo(before, after) {
  if (!before) {
    return makeActivityChange("新規タスク", [
      `担当: ${after.assignee}`,
      `状態: ${after.status}`,
      `優先度: ${after.priority}`,
      `期限: ${formatDueForChange(after)}`
    ], { summary: [after.assignee, after.status, after.priority, formatDueForChange(after)].filter(Boolean).join(" / "), historyText: "タスクを作成しました。" });
  }

  const details = [];
  const labels = [];

  if (before.dueDate !== after.dueDate || before.dueTime !== after.dueTime) {
    labels.push("期限変更");
    details.push(`期限: ${formatDueForChange(before)} → ${formatDueForChange(after)}`);
  }
  if (before.assignee !== after.assignee) {
    labels.push("担当変更");
    details.push(`担当: ${before.assignee} → ${after.assignee}`);
  }
  if (before.status !== after.status) {
    labels.push("状態変更");
    details.push(`状態: ${before.status} → ${after.status}`);
  }
  if (before.priority !== after.priority) {
    labels.push("優先度変更");
    details.push(`優先度: ${before.priority} → ${after.priority}`);
  }
  if (before.title !== after.title) {
    labels.push("件名変更");
    details.push(`件名: ${shortText(before.title, 24)} → ${shortText(after.title, 24)}`);
  }
  if (before.category !== after.category) {
    labels.push("分類変更");
    details.push(`分類: ${before.category} → ${after.category}`);
  }
  if (before.requester !== after.requester) {
    labels.push("依頼元変更");
    details.push(`依頼元: ${before.requester || "未入力"} → ${after.requester || "未入力"}`);
  }
  if (JSON.stringify(before.tags || []) !== JSON.stringify(after.tags || [])) {
    labels.push("タグ変更");
    details.push("タグを変更");
  }
  if (before.description !== after.description) {
    labels.push("内容更新");
    details.push("内容・メモを更新");
  }
  if (JSON.stringify(before.checklist || []) !== JSON.stringify(after.checklist || [])) {
    labels.push("チェックリスト更新");
    details.push("チェックリストを更新");
  }
  if (before.recurrence !== after.recurrence || JSON.stringify(before.recurrenceRule || {}) !== JSON.stringify(after.recurrenceRule || {})) {
    labels.push("繰り返し変更");
    details.push(`繰り返し: ${describeRecurrence(before)} → ${describeRecurrence(after)}`);
  }
  if (Boolean(before.pinned) !== Boolean(after.pinned)) {
    labels.push("固定変更");
    details.push(after.pinned ? "固定表示を有効化" : "固定表示を解除");
  }

  if (!details.length) {
    return makeActivityChange("保存", ["変更なしで保存"], { historyText: "タスクを保存しました。" });
  }

  const priority = ["期限変更", "担当変更", "状態変更", "優先度変更", "件名変更", "分類変更", "内容更新", "チェックリスト更新", "繰り返し変更", "固定変更"];
  const label = priority.find(item => labels.includes(item)) || labels[0] || "更新";
  return makeActivityChange(label, details, {
    historyText: `タスクを編集しました（${details.join("、")}）。`
  });
}

function makeScheduleChangeInfo(before, after) {
  if (!before) {
    return makeActivityChange("新規予定", [
      `日時: ${formatScheduleDateTimeRange(after)}`,
      `担当: ${after.assignee}`,
      after.location ? `場所: ${after.location}` : ""
    ], { summary: [formatScheduleDateTimeRange(after), after.assignee, after.location].filter(Boolean).join(" / ") });
  }

  const details = [];
  const labels = [];

  if (before.startAt !== after.startAt || before.endAt !== after.endAt) {
    labels.push("日時変更");
    details.push(`日時: ${formatScheduleDateTimeRange(before)} → ${formatScheduleDateTimeRange(after)}`);
  }
  if (before.assignee !== after.assignee) {
    labels.push("担当変更");
    details.push(`担当: ${before.assignee} → ${after.assignee}`);
  }
  if (before.location !== after.location) {
    labels.push("場所変更");
    details.push(`場所: ${before.location || "未入力"} → ${after.location || "未入力"}`);
  }
  if (before.title !== after.title) {
    labels.push("件名変更");
    details.push(`件名: ${shortText(before.title, 24)} → ${shortText(after.title, 24)}`);
  }
  if (before.category !== after.category) {
    labels.push("分類変更");
    details.push(`分類: ${before.category} → ${after.category}`);
  }
  if (before.relatedTaskId !== after.relatedTaskId) {
    labels.push("関連タスク変更");
    details.push("関連タスクを変更");
  }
  if (before.memo !== after.memo) {
    labels.push("メモ更新");
    details.push("メモを更新");
  }

  if (!details.length) {
    return makeActivityChange("保存", ["変更なしで保存"], { historyText: "予定を保存しました。" });
  }

  const priority = ["日時変更", "担当変更", "場所変更", "件名変更", "分類変更", "関連タスク変更", "メモ更新"];
  const label = priority.find(item => labels.includes(item)) || labels[0] || "予定更新";
  return makeActivityChange(label, details, {
    historyText: `予定を編集しました（${details.join("、")}）。`
  });
}

function latestActivitySummary(item, fallback = "更新内容を確認してください") {
  const change = normalizeActivityChange(item?.lastChange);
  if (change.summary) return change.summary;
  const history = Array.isArray(item?.history) ? item.history : [];
  const latest = history.length ? history[history.length - 1]?.text : "";
  return latest ? shortText(latest, 90) : fallback;
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
  if (before.recurrence !== after.recurrence || JSON.stringify(before.recurrenceRule || {}) !== JSON.stringify(after.recurrenceRule || {})) changes.push(`繰り返しを「${describeRecurrence(before)}」から「${describeRecurrence(after)}」へ変更`);
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


function setRecurrenceFields(task = null) {
  const recurrence = normalizeRecurrence(task?.recurrence || "none");
  const dueDate = task?.dueDate || $("taskDueDate")?.value || todayISO();
  const rule = normalizeRecurrenceRule(recurrence, task?.recurrenceRule || {}, dueDate);
  const intervalInput = $("taskRecurrenceInterval");
  if (intervalInput) intervalInput.value = String(rule.interval || 1);

  document.querySelectorAll("[data-repeat-weekday]").forEach(input => {
    input.checked = (rule.weekdays || []).map(Number).includes(Number(input.value));
  });

  const nth = $("taskRecurrenceNth");
  const weekday = $("taskRecurrenceWeekday");
  if (nth) nth.value = rule.nth || "1";
  if (weekday) weekday.value = String(rule.weekday ?? 1);
}

function applyRecurrenceDefaultsFromDueDate() {
  const due = parseISODate($("taskDueDate")?.value);
  if (!due) return;

  const recurrence = normalizeRecurrence($("taskRecurrence")?.value);
  if (recurrence === "weekly") {
    const selected = [...document.querySelectorAll("[data-repeat-weekday]:checked")];
    if (!selected.length) {
      const input = document.querySelector(`[data-repeat-weekday][value="${due.getDay()}"]`);
      if (input) input.checked = true;
    }
  }

  if (recurrence === "monthlyNth") {
    const nth = $("taskRecurrenceNth");
    const weekday = $("taskRecurrenceWeekday");
    if (nth) nth.value = String(getNthWeekInMonth(due));
    if (weekday) weekday.value = String(due.getDay());
  }
}

function syncRecurrenceUi() {
  const recurrence = normalizeRecurrence($("taskRecurrence")?.value || "none");
  const options = $("recurrenceOptions");
  const weekly = $("weeklyOptions");
  const nth = $("monthlyNthOptions");
  const preview = $("recurrencePreview");
  if (!options) return;

  options.hidden = recurrence === "none";
  if (weekly) weekly.hidden = recurrence !== "weekly";
  if (nth) nth.hidden = recurrence !== "monthlyNth";

  if (recurrence !== "none") applyRecurrenceDefaultsFromDueDate();
  if (preview) {
    preview.textContent = describeRecurrence({
      recurrence,
      recurrenceRule: getRecurrenceRuleFromForm(),
      dueDate: $("taskDueDate")?.value || todayISO()
    });
  }
}

function getRecurrenceRuleFromForm() {
  const recurrence = normalizeRecurrence($("taskRecurrence")?.value || "none");
  const base = parseISODate($("taskDueDate")?.value) || startOfToday();
  const rule = {
    interval: clampNumber($("taskRecurrenceInterval")?.value, 1, 36, 1),
    weekdays: [...document.querySelectorAll("[data-repeat-weekday]:checked")].map(input => Number(input.value)),
    nth: $("taskRecurrenceNth")?.value || String(getNthWeekInMonth(base)),
    weekday: clampWeekday($("taskRecurrenceWeekday")?.value ?? base.getDay()),
    monthDay: base.getDate()
  };

  if (recurrence === "weekly" && !rule.weekdays.length) rule.weekdays = [base.getDay()];
  return rule;
}

function describeRecurrence(task) {
  const recurrence = normalizeRecurrence(task?.recurrence || "none");
  if (recurrence === "none") return "なし";

  const due = parseISODate(task?.dueDate || "") || startOfToday();
  const rule = normalizeRecurrenceRule(recurrence, task?.recurrenceRule || {}, task?.dueDate || todayISO());
  const interval = rule.interval || 1;
  const intervalPrefix = interval > 1 ? `${interval}回ごと・` : "";
  const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];

  if (recurrence === "daily") return interval > 1 ? `${interval}日ごと` : "毎日";
  if (recurrence === "weekly") {
    const days = (rule.weekdays || [due.getDay()]).map(day => weekdayNames[Number(day)]).join("・");
    return `${intervalPrefix}毎週 ${days}`;
  }
  if (recurrence === "monthlyDay") {
    const day = rule.monthDay || due.getDate();
    return `${intervalPrefix}毎月 ${day}日`;
  }
  if (recurrence === "monthlyNth") {
    const nthLabel = rule.nth === "last" ? "最終" : `第${rule.nth}`;
    return `${intervalPrefix}毎月 ${nthLabel}${weekdayNames[rule.weekday]}曜`;
  }
  if (recurrence === "yearly") {
    return interval > 1 ? `${interval}年ごと ${due.getMonth()+1}/${due.getDate()}` : `毎年 ${due.getMonth()+1}/${due.getDate()}`;
  }
  return RECURRENCE_LABELS[recurrence] || "定期";
}

async function maybeCreateNextRecurringTask(task) {
  if (!task || !task.recurrence || task.recurrence === "none" || task.nextRecurringTaskId) return;
  if (!task.dueDate) return;

  const nextDueDate = getNextRecurringDueDate(task.dueDate, task.recurrence, task.recurrenceRule);
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

function getNextRecurringDueDate(dueDate, recurrence, rule = {}) {
  const base = parseISODate(dueDate);
  const normalized = normalizeRecurrence(recurrence);
  if (!base || normalized === "none") return "";

  const recurrenceRule = normalizeRecurrenceRule(normalized, rule, dueDate);
  const interval = recurrenceRule.interval || 1;

  if (normalized === "daily") return toISODate(addDays(base, interval));

  if (normalized === "weekly") {
    const selected = (recurrenceRule.weekdays || [base.getDay()]).map(Number);
    for (let offset = 1; offset <= 7 * interval + 7; offset += 1) {
      const candidate = addDays(base, offset);
      if (!selected.includes(candidate.getDay())) continue;
      if (interval <= 1 || Math.floor((offset - 1) / 7) % interval === 0) return toISODate(candidate);
    }
    return toISODate(addDays(base, 7 * interval));
  }

  if (normalized === "monthlyDay") {
    const targetDay = recurrenceRule.monthDay || base.getDate();
    return toISODate(addMonthsKeepDay(base, interval, targetDay));
  }

  if (normalized === "monthlyNth") {
    const monthBase = new Date(base.getFullYear(), base.getMonth() + interval, 1);
    return toISODate(getNthWeekdayOfMonth(monthBase.getFullYear(), monthBase.getMonth(), recurrenceRule.weekday, recurrenceRule.nth));
  }

  if (normalized === "yearly") {
    return toISODate(addYearsKeepDay(base, interval));
  }

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

function addMonthsKeepDay(date, months, preferredDay = date.getDate()) {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const max = daysInMonth(first);
  return new Date(first.getFullYear(), first.getMonth(), Math.min(preferredDay, max));
}

function addYearsKeepDay(date, years) {
  const target = new Date(date.getFullYear() + years, date.getMonth(), 1);
  const max = daysInMonth(target);
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), max));
}

function getNthWeekInMonth(date) {
  return Math.ceil(date.getDate() / 7);
}

function getNthWeekdayOfMonth(year, month, weekday, nth) {
  const targetWeekday = clampWeekday(weekday);
  if (String(nth) === "last") {
    const last = new Date(year, month + 1, 0);
    while (last.getDay() !== targetWeekday) last.setDate(last.getDate() - 1);
    return last;
  }

  const n = clampNumber(nth, 1, 5, 1);
  const first = new Date(year, month, 1);
  const offset = (targetWeekday - first.getDay() + 7) % 7;
  const candidate = new Date(year, month, 1 + offset + (n - 1) * 7);
  if (candidate.getMonth() !== month) {
    return getNthWeekdayOfMonth(year, month, targetWeekday, "last");
  }
  return candidate;
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
