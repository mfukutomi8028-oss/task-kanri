// Firebase is loaded only after configuration is confirmed.  A failed SDK load must
// leave the board usable in explicit local-only mode instead of failing module load.
import {
  captureDeleteBaseFromRoot as captureDeleteBaseFromProtocol,
  classifyDeleteConflict as classifyDeleteConflictProtocol,
  planDeleteMutation,
  reduceDeleteSync
} from './task-delete-v134.js';
import { selectVisibleTodos, summarizeTaskCounters } from './workspace-core-v537.js';
import {
  captureRecurringDelete, recurringDeleteTargets, planRecurringDelete,
  isRecurringDeleteCandidate
} from './recurrence-series-v354.js';
import { createWorkspaceWriteCoordinator } from "./workspace-write-v538.js";
import { TODO_MAX_LENGTH, TODO_MEMO_MAX_LENGTH, canonicalTodoRecord, isCanonicalTodoId, normalizeTodo, reduceTodoSync, sortTodos, todoSegment, canPromoteTodo, todoDataSignature } from './todo-sync-v136.js';

let initializeApp, getDatabase, connectDatabaseEmulator, ref, get, onValue, set, update, push, remove, serverTimestamp, runTransaction;

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
  connectionMode: "initializing", // local-only | remote-loading | remote-online | remote-degraded
  collectionState: { tasks: "loading", schedules: "loading", knowledge: "loading", todos: "loading", meta: "loading" },
  metaRevisions: {},
  inFlightOperations: new Map(),
  db: null,
  dbApi: null,
  roomRef: null,
  tasksRef: null,
  schedulesRef: null,
  knowledgeRef: null,
  todosRef: null,
  metaRef: null,
  tasks: [],
  schedules: [],
  knowledge: [],
  todos: [],
  expandedTodoIds: new Set(),
  todoRaw: {},
  todoBarriers: {},
  todoPromotionContext: null,
  scheduleReminderTimer: null,
  favoriteTaskIds: [],
  users: loadUsers(),
  userColors: loadUserColors(),
  categories: loadCategories(),
  taskTemplates: loadTaskTemplates(),
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
  unsubscribed: false,
  committedRevisions: new Map(),
  deleteTombstones: new Map(),
  // Deletion compares raw RTDB records. Display collections are normalized and
  // must not be used as the base for a raw transaction callback.
  deleteBaseRoot: { tasks: {}, schedules: {}, knowledge: {} },
  deleteBarrier: null,
  detailDeleteBase: null,
  deleteControllers: new Map()
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
  todoView: $("todoView"),
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
  deleteConflictDialog: $("deleteConflictDialog"),
  deleteConflictSummary: $("deleteConflictSummary"),
  deleteConflictChanges: $("deleteConflictChanges"),
  viewLatestDeleteConflict: $("viewLatestDeleteConflict"),
  cancelDeleteConflict: $("cancelDeleteConflict"),
  copyRoomLink: $("copyRoomLink"),
  toast: $("toast"),
  openCount: $("openCount"),
  overdueCount: $("overdueCount"),
  todayCount: $("todayCount"),
  myCount: $("myCount")
};

function init() {
  document.title = "業務管理ボード";
  installDialogFallback();
  setupEvents();
  state.favoriteTaskIds = loadFavoriteTaskIds();
  syncCurrentUserStatuses({ persist: false, silent: true });
  syncUserUi();
  syncRoomUi();
  setupFirebase();
  startScheduleReminderWatcher();
  installScheduleTodayLifecycle();
  showUserDialogIfNeeded();
  render();
  window.WORK_BOARD_CORE_READY = true;
  window.dispatchEvent(new Event("workboard:core-ready"));
}

function installDialogFallback() {
  document.querySelectorAll('dialog').forEach(dialog => {
    if (typeof dialog.showModal !== 'function') {
      dialog.showModal = function () { this.setAttribute('open', ''); this.setAttribute('role', 'dialog'); this.setAttribute('aria-modal', 'true'); };
    }
    if (typeof dialog.close !== 'function') {
      dialog.close = function () { this.removeAttribute('open'); };
    }
  });
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
function todosKey() {
  return `system-task-todos:${ROOM_ID}`;
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
    setConnectionMode("local-only");
    loadLocalTasks();
    loadLocalSchedules();
    loadLocalKnowledge();
    loadLocalTodos();
    return;
  }
  try {
    await loadFirebaseAdapter();
    const app = initializeApp(config);
    const db = getDatabase(app);
    const test = window.WORK_BOARD_TEST;
    if (test?.emulator === true) {
      const host = String(test.host || '127.0.0.1');
      const port = Number(test.port || 9000);
      const isLocalHost = host === '127.0.0.1' || host === 'localhost';
      const productionUrl = /firebaseio\.com|firebasedatabase\.app/i.test(String(config.databaseURL || ''));
      if (!isLocalHost || !Number.isInteger(port) || port < 1 || port > 65535 || productionUrl || !String(ROOM_ID).startsWith('test-')) {
        throw new Error('test-emulator-configuration-rejected');
      }
      connectDatabaseEmulator(db, host, port);
    }
    state.db = db;
    state.dbApi = { ref, get, onValue, set, update, push, remove, serverTimestamp, runTransaction };
    state.roomRef = ref(db, `rooms/${ROOM_ID}`);
    state.tasksRef = ref(db, `rooms/${ROOM_ID}/tasks`);
    state.schedulesRef = ref(db, `rooms/${ROOM_ID}/schedules`);
    state.knowledgeRef = ref(db, `rooms/${ROOM_ID}/knowledge`);
    state.todosRef = ref(db, `rooms/${ROOM_ID}/todos`);
    state.metaRef = ref(db, `rooms/${ROOM_ID}/meta`);
    setConnectionMode("remote-loading");

    onValue(state.metaRef, (snapshot) => {
      const meta = snapshot.val() || {};
      state.metaRevisions = (meta._revisions && typeof meta._revisions === 'object') ? meta._revisions : {};
      if (Array.isArray(meta.users)) setUsers(meta.users, { persist: false, silent: true });
      if (meta.userColors && typeof meta.userColors === "object") setUserColors(meta.userColors, { persist: false, silent: true });
      if (Array.isArray(meta.categories)) setCategories(meta.categories, { persist: false, silent: true });
      if (Array.isArray(meta.taskTemplates)) setTaskTemplates(meta.taskTemplates, { persist: false, silent: true });
      if (meta.statusesByUser && typeof meta.statusesByUser === "object") {
        setStatusesByUser(meta.statusesByUser, { persist: false, silent: true });
      } else if (Array.isArray(meta.statuses)) {
        setStatuses(meta.statuses, { persist: false, silent: true });
      }
      if (typeof meta.roomName === "string") {
        state.roomName = meta.roomName;
        localStorage.setItem(roomNameKey(), state.roomName);
        syncRoomUi();
      }
      markCollectionReady("meta");
    }, error => markCollectionError("meta", error));

    onValue(state.tasksRef, (snapshot) => {
      const value = snapshot.val() || {};
      mergeSubscribedCollection('tasks', value);
      syncStatusOptions($("taskStatus"));
      syncStatusOptions(elements.statusFilter, true);
      // The subscription reducer already refreshes related choices and queues
      // one canonical paint for the incoming task snapshot.
      markCollectionReady("tasks");
    }, (error) => {
      loadLocalTasks();
      markCollectionError("tasks", error);
    });

    onValue(state.schedulesRef, (snapshot) => {
      const value = snapshot.val() || {};
      mergeSubscribedCollection('schedules', value);
      syncScheduleReminderWatcher();
      markCollectionReady("schedules");
    }, (error) => {
      loadLocalSchedules();
      markCollectionError("schedules", error);
    });

    onValue(state.knowledgeRef, (snapshot) => {
      const value = snapshot.val() || {};
      mergeSubscribedCollection('knowledge', value);
      markCollectionReady("knowledge");
    }, (error) => {
      loadLocalKnowledge();
      markCollectionError("knowledge", error);
    });
    onValue(state.todosRef, (snapshot) => {
      applyTodoSync({ type: 'receive-authoritative-snapshot', roomId: ROOM_ID, value: snapshot.val() || {} });
      markCollectionReady('todos');
    }, (error) => {
      loadLocalTodos();
      markCollectionError('todos', error);
    });
  } catch (error) {
    console.warn(error);
    state.firebaseReady = false;
    state.dbApi = null;
    setConnectionMode("remote-degraded", "Firebase SDKまたは共同データの読込に失敗しました。キャッシュは閲覧のみです");
    loadLocalTasks();
    loadLocalSchedules();
    loadLocalKnowledge();
    loadLocalTodos();
  }
}

async function loadFirebaseAdapter() {
  if (initializeApp && runTransaction) return;
  const [appModule, databaseModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js")
  ]);
  ({ initializeApp } = appModule);
  ({ getDatabase, connectDatabaseEmulator, ref, get, onValue, set, update, push, remove, serverTimestamp, runTransaction } = databaseModule);
}

function markCollectionReady(name) {
  state.collectionState[name] = "ready";
  if (Object.values(state.collectionState).every(value => value === "ready")) {
    state.firebaseReady = true;
    setConnectionMode("remote-online");
  } else if (state.connectionMode !== "remote-degraded") {
    setConnectionMode("remote-loading");
  }
}

function markCollectionError(name, error) {
  console.warn(`Firebase ${name} subscription failed`, error);
  state.collectionState[name] = "error";
  state.firebaseReady = false;
  setConnectionMode("remote-degraded", `${name}の読込に失敗しました。キャッシュは閲覧のみです`);
}

function setConnectionMode(mode, detail = "") {
  state.connectionMode = mode;
  const labels = {
    "local-only": "端末内保存（共有されません）",
    "remote-loading": "共同データを確認中（保存不可）",
    "remote-online": "共同編集ON",
    "remote-degraded": "共同データ読込エラー（保存不可）"
  };
  setConnection(detail || labels[mode] || "接続状態を確認中", mode);
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

  // Only search needs an IME guard; keep every other filter's canonical
  // "input -> render" binding unchanged, including the primary sort owner.
  let composingMainSearch = false;
  elements.searchInput?.addEventListener('compositionstart', () => { composingMainSearch = true; });
  elements.searchInput?.addEventListener('compositionend', () => {
    composingMainSearch = false;
    render();
  });
  elements.searchInput?.addEventListener("input", event => {
    if (composingMainSearch || event.isComposing) return;
    render();
  });
  [elements.assigneeFilter, elements.statusFilter, elements.priorityFilter, elements.categoryFilter, elements.overdueOnly, elements.todayOnly, elements.pinOnly, elements.favoriteOnly, elements.sortSelect]
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
  elements.scheduleDialog.addEventListener('close',()=>{
    // Closing the edit form to open its copy flow is not a return to the note.
    if(journalNoteDialogReturnV479?.action!=='edit'||$("scheduleCopyDialog")?.open)return;
    journalRestoreNoteV479();
  });
  $("scheduleStart").addEventListener("input", syncScheduleEndFromStart);
  $("scheduleStart").addEventListener("change", syncScheduleEndFromStart);
  $("scheduleEnd").addEventListener("input", () => {
    journalSchedulePresetExplicitV565 = false;
    journalRefreshScheduleDurationButtonsV565();
  });
  elements.scheduleDialog.querySelectorAll('[data-j565-schedule-minutes]').forEach(button =>
    button.addEventListener('click', () => journalApplyScheduleDurationV565(Number(button.dataset.j565ScheduleMinutes))));
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
  $("copySchedule")?.addEventListener("click", () => {
    const id = $("scheduleId").value;
    const source = state.schedules.find(item => item.id === id);
    if (id && !source) return toast("予定が更新されました。開き直してください。", true);
    if (!source && (elements.scheduleForm.dataset.roomId !== ROOM_ID ||
        elements.scheduleForm.dataset.selectedUser !== getCurrentUser())) {
      return toast("ルームまたは利用者が変更されました。予定を開き直してください。", true);
    }
    const draft = source ? null : readScheduleDraftFromForm("draft-" + generateScheduleId());
    if (draft?.error) return toast(draft.error, true);
    elements.scheduleDialog.close();
    openScheduleCopyDialog(source || draft.schedule, { fromNewForm: !source });
  });

  $("closeScheduleCopyDialog")?.addEventListener("click", () => closeScheduleCopyDialog(true));
  $("scheduleCopyBack")?.addEventListener("click", () => closeScheduleCopyDialog(true));
  $("scheduleCopyDialog")?.addEventListener("cancel", event => {
    event.preventDefault();
    closeScheduleCopyDialog(true);
  });
  $("scheduleCopyMethod")?.addEventListener("change", syncScheduleCopyUi);
  $("scheduleCopyStartDate")?.addEventListener("change", syncScheduleCopyPreview);
  $("scheduleCopyInterval")?.addEventListener("input", syncScheduleCopyPreview);
  $("scheduleCopyMonthDay")?.addEventListener("input", syncScheduleCopyPreview);
  $("scheduleCopyNth")?.addEventListener("change", syncScheduleCopyPreview);
  $("scheduleCopyNthWeekday")?.addEventListener("change", syncScheduleCopyPreview);
  $("scheduleCopyEndMode")?.addEventListener("change", syncScheduleCopyUi);
  $("scheduleCopyCount")?.addEventListener("input", syncScheduleCopyPreview);
  $("scheduleCopyEndDate")?.addEventListener("change", syncScheduleCopyPreview);
  document.querySelectorAll("[data-copy-weekday]").forEach(input => input.addEventListener("change", syncScheduleCopyPreview));
  $("scheduleCopyAddDate")?.addEventListener("click", addScheduleCopyDateFromInput);
  $("scheduleCopyDateList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-copy-date]");
    if (!button) return;
    scheduleCopySelectedDates.delete(button.dataset.removeCopyDate);
    renderScheduleCopySelectedDates();
    syncScheduleCopyPreview();
  });
  $("scheduleCopyForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    await submitScheduleCopy();
  });
  elements.deleteSchedule.addEventListener("click", async () => {
    const id = $("scheduleId").value;
    if (!id) return elements.scheduleDialog.close();
    if (elements.scheduleForm.dataset.roomId !== ROOM_ID
      || elements.scheduleForm.dataset.selectedUser !== getCurrentUser()) {
      return toast("ルームまたは利用者が変更されました。予定を開き直してください。", true);
    }
    const result = await requestDeleteWithSeries("schedule", id, {
      expectedRevision: Number(elements.scheduleForm.dataset.baseRevision)
    });
    if (result?.ok) elements.scheduleDialog.close();
  });
  elements.newTask.addEventListener("click", () => openTaskDialog());
  $("taskRecurrence")?.addEventListener("change", () => {
    applyRecurrenceDefaultsFromAnchorDate();
    syncRecurrenceUi();
  });
  $("taskRecurrenceAnchorDate")?.addEventListener("change", () => {
    applyRecurrenceDefaultsFromAnchorDate();
    syncRecurrenceUi();
  });
  ["taskRecurrenceInterval", "taskRecurrenceMonthDay", "taskRecurrenceNth", "taskRecurrenceWeekday"].forEach(id => {
    const input = $(id);
    if (!input) return;
    const update = () => {
      if (id !== "taskRecurrenceInterval") input.dataset.manual = "true";
      syncRecurrenceUi();
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  });
  document.querySelectorAll("[data-repeat-weekday]").forEach(input => input.addEventListener("change", syncRecurrenceUi));
  $("taskRecurrenceEndMode")?.addEventListener("change", syncRecurrenceUi);
  $("taskRecurrenceCount")?.addEventListener("input", syncRecurrenceUi);
  $("taskRecurrenceCount")?.addEventListener("change", syncRecurrenceUi);
  $("taskRecurrenceEndDate")?.addEventListener("change", syncRecurrenceUi);
  $("taskRecurrenceEndDate")?.addEventListener("input", syncRecurrenceUi);
  $("taskRecurrenceAddDate")?.addEventListener("click", addTaskRecurrenceDate);
  $("taskRecurrenceDateList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-task-recurrence-date]");
    if (!button) return;
    renderTaskRecurrenceDates(taskRecurrenceDates().filter(date => date !== button.dataset.taskRecurrenceDate));
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
  document.querySelectorAll('input[name="recurringDeleteScope"]').forEach(input =>
    input.addEventListener("change", updateRecurringDeleteDialog));
  const dismissRecurringDelete = () => {
    if (!recurringDeleteBusy) $("recurringDeleteDialog").close();
  };
  $("closeRecurringDelete")?.addEventListener("click", dismissRecurringDelete);
  $("cancelRecurringDelete")?.addEventListener("click", dismissRecurringDelete);
  $("recurringDeleteDialog")?.addEventListener("cancel", event => {
    if (recurringDeleteBusy) event.preventDefault();
  });
  $("recurringDeleteDialog")?.addEventListener("close", () => { pendingRecurringDelete = null; });
  $("recurringDeleteForm")?.addEventListener("submit", event => event.preventDefault());
  $("confirmRecurringDelete")?.addEventListener("click", confirmRecurringDelete);
  elements.closeTaskDialog.addEventListener("click", () => { clearTaskDialogContexts(); elements.taskDialog.close(); });
  elements.taskDialog.addEventListener('cancel', clearTaskDialogContexts);
  elements.taskDialog.addEventListener('close', clearTaskDialogContexts);
  elements.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveTaskFromForm();
  });
  elements.deleteTask.addEventListener("click", async () => {
    const id = $("taskId").value;
    if (!id) return;
    elements.deleteTask.dataset.operationKey = operationKey('task-delete', id);
    const result = await requestDeleteWithSeries("task", id, {
      base: readTaskDialogBase(id)?.deleteBase
    });
    if (result?.ok) elements.taskDialog.close();
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
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(url);
      toast("共有リンクをコピーしました");
    } catch {
      window.prompt("コピーできなかったため、次のURLを手動でコピーしてください。", url);
      toast("共有リンクを手動コピーしてください", true);
    }
  });
}

function normalizeTask(task) {
  return {
    ...task,
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
    // Legacy recurring tasks used the deadline as the cycle anchor. Preserve
    // that former cadence on read; newly saved rules use their own start date.
    recurrenceRule: normalizeRecurrenceRule(
      normalizeRecurrence(task.recurrence),
      {
        ...(task.recurrenceRule || {}),
        occurrenceDate: task.recurrenceRule?.occurrenceDate ||
          (normalizeRecurrence(task.recurrence) !== "none" && !task.recurrenceRule?.anchorDate ? task.dueDate : ""),
        seriesId: task.recurrenceRule?.seriesId || task.id
      },
      task.recurrenceRule?.anchorDate ||
        (normalizeRecurrence(task.recurrence) !== "none" ? task.dueDate : "") ||
        (task.createdAt ? toISODate(new Date(task.createdAt)) : todayISO())
    ),
    nextRecurringTaskId: task.nextRecurringTaskId || "",
    recurringParentId: String(task.recurringParentId || ""),
    operationId: String(task.operationId || ""),
    dueDate: task.dueDate || "",
    dueTime: task.dueTime || "",
    pinned: Boolean(task.pinned),
    createdBy: normalizeUser(task.createdBy || task.assignee),
    revision: normalizeRevision(task.revision),
    createdAt: finiteTimestamp(task.createdAt, 0),
    updatedBy: normalizeUser(task.updatedBy || task.createdBy || task.assignee),
    updatedAt: finiteTimestamp(task.updatedAt, Date.now()),
    completedAt: task.completedAt ? finiteTimestamp(task.completedAt, 0) : 0,
    completedMemo: String(task.completedMemo || ""),
    knowledgeId: String(task.knowledgeId || ""),
    lastChange: normalizeActivityChange(task.lastChange)
  };
}

function normalizeRevision(value) {
  const revision = typeof value === "number"
    ? value
    : (typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : NaN);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

const RECORD_NORMALIZERS = { tasks: normalizeTask, schedules: normalizeSchedule, knowledge: normalizeKnowledge };
const RECORD_CACHE_KEYS = { tasks: tasksKey, schedules: schedulesKey, knowledge: knowledgeKey };

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function committedKey(collection, id) { return `${collection}:${id}`; }

function persistCollectionCache(collection) {
  const key = RECORD_CACHE_KEYS[collection];
  if (key) localStorage.setItem(key(), JSON.stringify(state[collection]));
}

function affectedCollections(affectedPaths = []) {
  return new Set(affectedPaths.map(path => String(path).split('/')).map(parts => parts.find(part => ['tasks', 'schedules', 'knowledge'].includes(part))).filter(Boolean));
}

function applyDeleteSyncAction(action, { refreshDetail = false } = {}) {
  const previous = {
    roomId: ROOM_ID,
    collections: state.deleteBaseRoot,
    deleteBaseRoot: state.deleteBaseRoot,
    barrier: state.deleteBarrier
  };
  const next = reduceDeleteSync(previous, action);
  if (next === previous) return new Set();
  state.deleteBaseRoot = next.deleteBaseRoot;
  state.deleteBarrier = next.barrier;
  const touched = action.type === 'receive-subscription'
    ? new Set([action.collection])
    : affectedCollections(action.affectedPaths);
  for (const collection of touched) {
    state[collection] = Object.entries(next.collections[collection] || {})
      .map(([id, record]) => RECORD_NORMALIZERS[collection]({ id, ...record }));
    persistCollectionCache(collection);
  }
  if (refreshDetail && state.selectedId && touched.size) state.detailDeleteBase = captureDeleteBase(state.selectedId);
  if (touched.size) {
    syncScheduleRelatedTaskOptions();
    // Coalesce background Firebase updates without delaying user actions.
    if (action.type === 'receive-subscription') scheduleSubscribedRender();
    else render();
  }
  return touched;
}

function applyCommittedResult({ snapshot, snapshotScope = 'root', affectedPaths = [], mutationKind = 'write' }) {
  if (mutationKind === 'task-delete') {
    return applyDeleteSyncAction({ type: 'apply-delete-commit', roomId: ROOM_ID, snapshot, affectedPaths }, { refreshDetail: true });
  }
  const root = snapshotScope === 'root' ? (snapshot || {}) : null;
  const touched = new Set();
  for (const path of affectedPaths) {
    const parts = String(path).split('/');
    const collectionIndex = parts.findIndex(part => ['tasks', 'schedules', 'knowledge'].includes(part));
    if (collectionIndex < 0) continue;
    const collection = parts[collectionIndex];
    const id = parts[collectionIndex + 1] || '';
    const source = snapshotScope === 'record' ? snapshot : root?.[collection]?.[id];
    if (!id) continue; // whole-collection paths are never used for local replacement.
    const rawCollection = state.deleteBaseRoot[collection] || (state.deleteBaseRoot[collection] = {});
    const list = state[collection];
    const index = list.findIndex(item => item.id === id);
    if (source == null) {
      delete rawCollection[id];
      if (index >= 0) list.splice(index, 1);
      state.deleteTombstones.set(committedKey(collection, id), { generation: Date.now(), mutationKind });
      state.committedRevisions.delete(committedKey(collection, id));
    } else {
      rawCollection[id] = source;
      const normalized = RECORD_NORMALIZERS[collection]({ id, ...source });
      const key = committedKey(collection, id);
      if (index >= 0) list[index] = normalized; else list.unshift(normalized);
      state.committedRevisions.set(key, normalized.revision);
      state.deleteTombstones.delete(key);
    }
    touched.add(collection);
  }
  touched.forEach(persistCollectionCache);
  // A locally committed edit becomes the new deletion base.  Subscription data
  // never refreshes this snapshot, so another user's update is still a conflict.
  if (state.selectedId && touched.size) state.detailDeleteBase = captureDeleteBase(state.selectedId);
  if (touched.size) {
    syncScheduleRelatedTaskOptions();
    render();
  }
}

function mergeSubscribedCollection(collection, value) {
  const incoming = { ...(value || {}) };
  for (const [id, record] of Object.entries(incoming)) {
    const key = committedKey(collection, id);
    const committedRevision = state.committedRevisions.get(key);
    const current = state.deleteBaseRoot[collection]?.[id];
    if (committedRevision != null && normalizeRevision(record?.revision) < committedRevision && current) incoming[id] = current;
    if (state.deleteTombstones.has(key)) state.deleteTombstones.delete(key); // a later authoritative snapshot may restore an ID.
  }
  applyDeleteSyncAction({ type: 'receive-subscription', roomId: ROOM_ID, collection, value: incoming, complete: true });
}

function applyTodoSync(action) {
  if (action?.type === 'apply-commit' && action.sourceKind === 'todo-update') {
    // This editor was committed successfully. Render canonical values rather
    // than copying back its pre-commit fields as an unsaved draft.
    for (const change of action.changes || []) classicTodoCommittedEditIds.add(String(change.id));
  }
  const previousSignature = todoDataSignature(state.todoRaw);
  const next = reduceTodoSync({ roomId: ROOM_ID, raw: state.todoRaw, barriers: state.todoBarriers }, action);
  state.todoRaw = next.raw;
  state.todoBarriers = next.barriers;
  // Acknowledging a local write can clear a barrier without changing the
  // canonical ToDo records. Do not redraw or rewrite the cache for such echoes.
  if (previousSignature === todoDataSignature(next.raw)) return;
  state.todos = Object.entries(next.raw).flatMap(([id, record]) => {
    const todo = canonicalTodoRecord(id, record);
    return todo ? [todo] : [];
  });
  localStorage.setItem(todosKey(), JSON.stringify(state.todos));
  if (action.type === 'receive-authoritative-snapshot') scheduleSubscribedRender();
  else render();
}

function loadLocalTodos() {
  try {
    const records = JSON.parse(localStorage.getItem(todosKey()) || '[]');
    state.todoRaw = Object.fromEntries((Array.isArray(records) ? records : []).map(todo => {
      const normalized = normalizeTodo(todo); return [normalized.id, normalized];
    }).filter(([id]) => isCanonicalTodoId(id)));
  } catch { state.todoRaw = {}; }
  state.todoBarriers = {};
  state.todos = Object.values(state.todoRaw).map(normalizeTodo);
  render();
}

function visibleTodos() {
  return selectVisibleTodos(state.todoRaw, normalizeUser(getCurrentUser()), todayISO());
}

function newTodoId() {
  if (state.firebaseReady && state.todosRef && push) return push(state.todosRef).key;
  return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function commitTodoRecord(kind, id, expectedRevision, build) {
  if (!isCanonicalTodoId(id)) throw new Error('invalid-todo-id');
  const path = `rooms/${ROOM_ID}/todos/${id}`;
  return executeWrite(kind, id, async () => {
    let committed;
    if (state.connectionMode === 'local-only') {
      const current = state.todoRaw[id] || null;
      if (current && (current.id !== id || normalizeRevision(current.revision) !== normalizeRevision(expectedRevision))) throw new Error('revision-or-relation-mismatch');
      const candidate = build(current);
      committed = candidate == null ? null : { ...candidate, id, revision: normalizeRevision(current?.revision) + 1 };
    } else {
      let conflict = false;
      const result = await runTransaction(ref(state.db, path), current => {
        if (current && (current.id !== id || normalizeRevision(current.revision) !== normalizeRevision(expectedRevision))) { conflict = true; return; }
        const candidate = build(current);
        return candidate == null ? null : { ...candidate, id, revision: normalizeRevision(current?.revision) + 1 };
      });
      if (!result.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
      committed = result.snapshot?.val() ?? null;
    }
    if (committed != null && !canonicalTodoRecord(id, committed)) throw new Error('invalid-todo-record');
    applyTodoSync({ type: 'apply-commit', roomId: ROOM_ID, sourceKind: kind, changes: [{ id, record: committed, baseRevision: expectedRevision }] });
    return { committed: true, affectedPaths: [path] };
  });
}

function rejectTodoInput(message, field, reason, maxLength) {
  toast(message, true);
  // Public editors need a validation result, not a generic "write-failed".
  // No write has started; the existing form and entered text remain intact.
  return { ok: false, error: 'invalid-input', field, reason, maxLength, affectedPaths: [] };
}

async function createTodo(input, memoInput = '', options = {}) {
  const text = String(input || '').trim();
  const memo = String(memoInput || '').trim();
  if (!text) return rejectTodoInput('やることを入力してください。', 'text', 'required', TODO_MAX_LENGTH);
  if (text.length > TODO_MAX_LENGTH)
    return rejectTodoInput(`やることは${TODO_MAX_LENGTH}文字以内で入力してください。`, 'text', 'too-long', TODO_MAX_LENGTH);
  if (memo.length > TODO_MEMO_MAX_LENGTH)
    return rejectTodoInput(`メモは${TODO_MEMO_MAX_LENGTH}文字以内で入力してください。`, 'memo', 'too-long', TODO_MEMO_MAX_LENGTH);
  const setCompleted = Object.prototype.hasOwnProperty.call(options, 'completed');
  if (setCompleted && typeof options.completed !== 'boolean')
    return { ok: false, error: 'invalid-input', field: 'completed', reason: 'invalid-value' };
  const completed = options.completed === true;
  const owner = normalizeUser(getCurrentUser()); const id = newTodoId(); const now = Date.now();
  if (!isCanonicalTodoId(id)) return { ok: false, error: 'invalid-todo-id', affectedPaths: [] };
  const result = await executeWrite('todo-create', 'form', async () => {
    let record;
    if (state.connectionMode === 'local-only') {
      const orders = sortTodos(state.todoRaw, owner).map(todo => todo.order);
      record = { id, text, memo, completed, completedAt: completed ? now : 0, order: (orders.length ? Math.min(...orders) - 1024 : 0), owner, createdAt: now, updatedAt: now, revision: 1 };
    } else {
      const tx = await runTransaction(state.todosRef, current => {
        const records = current && typeof current === 'object' ? current : {};
        if (records[id]) return;
        const orders = sortTodos(records, owner).map(todo => todo.order);
        record = { id, text, memo, completed, completedAt: completed ? now : 0, order: (orders.length ? Math.min(...orders) - 1024 : 0), owner, createdAt: now, updatedAt: now, revision: 1 };
        return { ...records, [id]: record };
      });
      if (!tx.committed) throw new Error('transaction-aborted-or-invariant-failure');
      record = tx.snapshot.val()?.[id];
    }
    if (!canonicalTodoRecord(id, record)) throw new Error('invalid-todo-record');
    applyTodoSync({ type: 'apply-commit', roomId: ROOM_ID, changes: [{ id, record, baseRevision: 0 }] });
    return { affectedPaths: [`rooms/${ROOM_ID}/todos/${id}`] };
  });
  return result;
}

async function updateTodoDetails(id, textInput, memoInput, options = {}) {
  const text = String(textInput || '').trim();
  const memo = String(memoInput || '').trim();
  if (!text) return rejectTodoInput('やることを入力してください。', 'text', 'required', TODO_MAX_LENGTH);
  if (text.length > TODO_MAX_LENGTH)
    return rejectTodoInput(`やることは${TODO_MAX_LENGTH}文字以内で入力してください。`, 'text', 'too-long', TODO_MAX_LENGTH);
  if (memo.length > TODO_MEMO_MAX_LENGTH)
    return rejectTodoInput(`メモは${TODO_MEMO_MAX_LENGTH}文字以内で入力してください。`, 'memo', 'too-long', TODO_MEMO_MAX_LENGTH);
  const setCompleted = Object.prototype.hasOwnProperty.call(options, 'completed');
  if (setCompleted && typeof options.completed !== 'boolean')
    return { ok: false, error: 'invalid-input', field: 'completed', reason: 'invalid-value' };
  // Origin passes the revision/owner captured when editing began; other views
  // can continue using this function without optional arguments.
  if ((options.ownerRoom !== undefined && String(options.ownerRoom) !== ROOM_ID)
    || (options.ownerUser !== undefined
      && normalizeUser(options.ownerUser) !== normalizeUser(getCurrentUser())))
    return { ok: false, error: 'owner-mismatch' };
  const todo = state.todos.find(item => item.id === id && item.owner === normalizeUser(getCurrentUser()));
  if (!todo) return toast('このやることは見つかりません。', true);
  const expectedRevision = Object.prototype.hasOwnProperty.call(options, 'revision')
    ? Number(options.revision) : todo.revision;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || normalizeRevision(todo.revision) !== expectedRevision)
    return { ok: false, error: 'revision-or-relation-mismatch' };
  // One CAS-checked write updates title, memo and completed state together.
  const result = await commitTodoRecord('todo-update', id, expectedRevision, current => {
    if (!current || current.owner !== todo.owner) throw new Error('revision-or-relation-mismatch');
    const now = Date.now();
    const next = { ...current, text, memo, updatedAt: now };
    if (setCompleted && options.completed !== Boolean(current.completed)) {
      next.completed = options.completed;
      next.completedAt = options.completed ? now : 0;
    }
    return next;
  });
  if (!result.ok) {
    showWriteFailure(result, 'やることの内容を保存できませんでした。');
    return result;
  }
  toast('やることを更新しました');
  return result;
}
async function toggleTodo(id) {
  const todo = state.todos.find(item => item.id === id && item.owner === normalizeUser(getCurrentUser()));
  if (!todo) return toast('このやることは見つかりません。', true);
  const result = await commitTodoRecord('todo-toggle', id, todo.revision, current => {
    if (!current || current.owner !== todo.owner) throw new Error('revision-or-relation-mismatch');
    const completed = !Boolean(current.completed); return { ...current, completed, completedAt: completed ? Date.now() : 0, updatedAt: Date.now() };
  });
  if (!result.ok) showWriteFailure(result, '完了状態を保存できませんでした。');
  return result;
}

async function deleteTodo(id, options = {}) {
  const owner = normalizeUser(getCurrentUser());
  const todo = state.todos.find(item => item.id === id && item.owner === owner);
  if (!todo) return { ok: false, error: 'not-found' };
  // Origin supplies the edit-start revision. Legacy Classic calls without
  // options still use the visible current revision and the same confirmation.
  if ((options.ownerRoom !== undefined && String(options.ownerRoom) !== ROOM_ID)
    || (options.ownerUser !== undefined && normalizeUser(options.ownerUser) !== owner))
    return { ok: false, error: 'owner-mismatch' };
  const guarded = Object.prototype.hasOwnProperty.call(options, 'revision');
  const expectedRevision = guarded ? Number(options.revision) : normalizeRevision(todo.revision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || (guarded && normalizeRevision(todo.revision) !== expectedRevision))
    return { ok: false, error: 'revision-or-relation-mismatch' };
  if (!confirm(`「${todo.text}」を削除しますか？`)) return { ok: false, error: 'cancelled' };
  const result = await commitTodoRecord('todo-delete', id, expectedRevision, current => {
    if (!current || current.owner !== todo.owner) throw new Error('revision-or-relation-mismatch');
    return null;
  });
  if (!result.ok) showWriteFailure(result, 'やることを削除できませんでした。');
  return result;
}

async function reorderTodo(id, direction, segment) {
  const owner = normalizeUser(getCurrentUser());
  const sorted = todoSegment(state.todoRaw, owner, segment, todayISO());
  const index = sorted.findIndex(item => item.id === id); const target = sorted[index + direction]; const todo = sorted[index];
  if (!todo || !target) return;
  const result = await executeWrite('todo-reorder', id, async () => {
    const updateBoth = records => {
      const a = records?.[todo.id], b = records?.[target.id];
      const currentSegment = todoSegment(records, owner, segment, todayISO());
      const currentIndex = currentSegment.findIndex(item => item.id === todo.id);
      if (!a || !b || a.id !== todo.id || b.id !== target.id || a.owner !== owner || b.owner !== owner || currentSegment[currentIndex + direction]?.id !== target.id || normalizeRevision(a.revision) !== todo.revision || normalizeRevision(b.revision) !== target.revision) throw new Error('revision-or-relation-mismatch');
      return { ...records, [todo.id]: { ...a, id: todo.id, order: b.order, revision: normalizeRevision(a.revision) + 1, updatedAt: Date.now() }, [target.id]: { ...b, id: target.id, order: a.order, revision: normalizeRevision(b.revision) + 1, updatedAt: Date.now() } };
    };
    let next;
    if (state.connectionMode === 'local-only') next = updateBoth(state.todoRaw);
    else { const tx = await runTransaction(state.todosRef, updateBoth); if (!tx.committed) throw new Error('revision-or-relation-mismatch'); next = tx.snapshot.val() || {}; }
    applyTodoSync({ type: 'apply-commit', roomId: ROOM_ID, changes: [todo, target].map(item => ({ id: item.id, record: next[item.id], baseRevision: item.revision })) });
    return { affectedPaths: [`rooms/${ROOM_ID}/todos/${todo.id}`, `rooms/${ROOM_ID}/todos/${target.id}`] };
  });
  if (!result.ok) showWriteFailure(result, '並び順を保存できませんでした。');
  return result;
}

// ドロップ位置が行の中央なら、ドラッグ方向から「前/後」を決める。
function shouldDropAfterV531(event, target, sourceId, key) {
  const rect = target.getBoundingClientRect();
  const fraction = (event.clientY - rect.top) / Math.max(1, rect.height);
  if (fraction < 0.4) return false;
  if (fraction > 0.6) return true;
  const siblings = [...(target.parentElement?.children || [])].filter(item => item.dataset?.[key]);
  const sourceIndex = siblings.findIndex(item => item.dataset[key] === sourceId);
  const targetIndex = siblings.indexOf(target);
  return sourceIndex >= 0 && targetIndex >= 0 && sourceIndex < targetIndex;
}

// PC操作用: 既存の▲▼ボタンは維持し、離れた行へは1回のトランザクションで移動する。
function todoDragPlanV531(items, sourceId, targetId, after) {
  const source = items.find(item => item.id === sourceId);
  const target = items.find(item => item.id === targetId);
  if (!source || !target || source.id === target.id) return null;
  const next = items.filter(item => item.id !== sourceId);
  const position = next.findIndex(item => item.id === targetId);
  next.splice(position + (after ? 1 : 0), 0, source);
  if (next.every((item, index) => item.id === items[index].id)) return null;
  const index = next.findIndex(item => item.id === sourceId);
  const before = next[index - 1];
  const following = next[index + 1];
  const low = before ? Number(before.order) : null;
  const high = following ? Number(following.order) : null;
  let order = before && following ? low + (high - low) / 2
    : before ? low + 1024 : following ? high - 1024 : 0;
  if (!Number.isFinite(order) || (before && !(order > low)) || (following && !(order < high))) {
    // 旧データの順序値が重複している場合だけ、現在の表示区分を再採番する。
    return next.map((item, position) => ({ id: item.id, order: position * 1024 }))
      .filter(change => items.find(item => item.id === change.id)?.order !== change.order);
  }
  return [{ id: sourceId, order }];
}

async function moveTodoByDropV531(sourceId, targetId, after, segment) {
  const owner = normalizeUser(getCurrentUser());
  const baseline = todoSegment(state.todoRaw, owner, segment, todayISO());
  const updates = todoDragPlanV531(baseline, sourceId, targetId, after);
  if (!updates?.length) return { ok: false, error: 'no-op' };
  const result = await executeWrite('todo-reorder', sourceId, async () => {
    const updateRecords = records => {
      const fresh = todoSegment(records, owner, segment, todayISO());
      if (fresh.length !== baseline.length || fresh.some((item, index) => item.id !== baseline[index].id || item.revision !== baseline[index].revision)) {
        throw new Error('revision-or-relation-mismatch');
      }
      const next = { ...records };
      const now = Date.now();
      for (const change of updates) {
        const record = records?.[change.id];
        if (!record || record.id !== change.id || record.owner !== owner) throw new Error('revision-or-relation-mismatch');
        next[change.id] = { ...record, order: change.order, revision: normalizeRevision(record.revision) + 1, updatedAt: now };
      }
      return next;
    };
    let next;
    if (state.connectionMode === 'local-only') next = updateRecords(state.todoRaw);
    else {
      const tx = await runTransaction(state.todosRef, updateRecords);
      if (!tx.committed) throw new Error('revision-or-relation-mismatch');
      next = tx.snapshot.val() || {};
    }
    applyTodoSync({ type: 'apply-commit', roomId: ROOM_ID, changes: updates.map(change => ({
      id: change.id, record: next[change.id],
      baseRevision: baseline.find(item => item.id === change.id).revision
    })) });
    return { affectedPaths: updates.map(change => `rooms/${ROOM_ID}/todos/${change.id}`) };
  });
  if (!result.ok) showWriteFailure(result, 'ドラッグによる並び順を保存できませんでした。');
  return result;
}

/* Use the rendered card/row as the native HTML drag preview instead of
   dragging the small grip icon. No cloned DOM, data changes, or ghost listeners. */
function setSortDragPreviewV338(event, source) {
  const transfer = event?.dataTransfer;
  if (!transfer || typeof transfer.setDragImage !== "function" || !(source instanceof Element)) return;
  const rect = source.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const x = Math.round(Math.min(rect.width - 1, Math.max(0, event.clientX - rect.left)));
  const y = Math.round(Math.min(rect.height - 1, Math.max(0, event.clientY - rect.top)));
  try {
    transfer.setDragImage(source, x, y);
  } catch (_) {
    // Unsupported drag images fall back to the browser's default preview.
  }
}
window.WORK_BOARD_SET_SORT_DRAG_PREVIEW_V338 = setSortDragPreviewV338;

function bindTodoDragListV531(list, segment) {
  let sourceId = '';
  const clear = () => list.querySelectorAll('.todo-item').forEach(row => row.classList.remove('todo-drop-before-v531', 'todo-drop-after-v531'));
  list.addEventListener('dragstart', event => {
    const handle = event.target?.closest?.('.todo-drag-handle-v531');
    const row = handle?.closest?.('[data-todo-id]');
    if (!row || row.getAttribute('aria-busy') === 'true') return;
    sourceId = row.dataset.todoId;
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', sourceId); }
    setSortDragPreviewV338(event, row);
  });
  list.addEventListener('dragover', event => {
    const row = event.target?.closest?.('[data-todo-id]');
    if (!sourceId || !row || row.dataset.todoId === sourceId || row.getAttribute('aria-busy') === 'true') return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    clear();
    const rect = row.getBoundingClientRect();
    row.classList.add(shouldDropAfterV531(event, row, sourceId, 'todoId') ? 'todo-drop-after-v531' : 'todo-drop-before-v531');
  });
  list.addEventListener('drop', event => {
    const row = event.target?.closest?.('[data-todo-id]');
    if (!sourceId || !row || row.dataset.todoId === sourceId) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const after = shouldDropAfterV531(event, row, sourceId, 'todoId');
    const source = sourceId;
    sourceId = '';
    clear();
    moveTodoByDropV531(source, row.dataset.todoId, after, segment);
  });
  list.addEventListener('dragend', () => { sourceId = ''; clear(); });
}
function finiteTimestamp(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRecurrence(value) {
  const raw = String(value || "none");
  if (raw === "monthly") return "monthlyDay";
  return ["none", "dates", "daily", "weekdays", "weekly", "monthlyDay", "monthlyNth", "monthEnd", "lastWeekday", "yearly"].includes(raw) ? raw : "none";
}

function validRecurrenceDate(value) {
  const text = String(value || "");
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? parseISODate(text) : null;
  return Boolean(parsed && toISODate(parsed) === text);
}

function normalizeRecurrenceRule(recurrence, rule = {}, fallbackDate = "") {
  const anchorDate = parseISODate(rule?.anchorDate)
    ? String(rule.anchorDate)
    : parseISODate(fallbackDate) ? String(fallbackDate) : todayISO();
  const base = parseISODate(anchorDate) || startOfToday();
  const interval = clampNumber(rule?.interval, 1, 36, 1);
  const weekday = clampWeekday(rule?.weekday ?? base.getDay());
  const weekdays = Array.isArray(rule?.weekdays)
    ? [...new Set(rule.weekdays.map(value => clampWeekday(value)).filter(value => value >= 0))]
    : [base.getDay()];
  const nth = ["1", "2", "3", "4", "5", "last"].includes(String(rule?.nth)) ? String(rule.nth) : String(getNthWeekInMonth(base));
  const monthDay = clampNumber(rule?.monthDay ?? base.getDate(), 1, 31, base.getDate());
  const active = recurrence !== "none";
  // Existing recurring records had no termination fields. Keep their old
  // unlimited behavior until an operator intentionally chooses an end rule.
  // Newly created tasks explicitly default to a bounded 4-child series.
  const endMode = !active ? "count" : recurrence === "dates" ? "dates"
    : ["count", "date", "unlimited"].includes(rule?.endMode) ? rule.endMode : "unlimited";
  const selectedDates = Array.isArray(rule?.selectedDates)
    ? [...new Set(rule.selectedDates.filter(validRecurrenceDate))].sort().slice(0, SCHEDULE_COPY_MAX)
    : [];
  return {
    interval,
    weekdays: weekdays.length ? weekdays : [base.getDay()],
    nth,
    weekday,
    monthDay,
    anchorDate: active ? anchorDate : "",
    occurrenceDate: active && validRecurrenceDate(rule?.occurrenceDate) ? String(rule.occurrenceDate) : "",
    // A stable series ID avoids lengthening IDs on every recurrence cycle.
    seriesId: active ? String(rule?.seriesId || "") : "",
    endMode,
    count: clampNumber(rule?.count, 1, SCHEDULE_COPY_MAX, 4),
    endDate: active && validRecurrenceDate(rule?.endDate) ? String(rule.endDate) : "",
    // Count only children actually committed; skipped calendar dates do not
    // consume the quota. Each child inherits the cumulative counter.
    generatedCount: active ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER,
      clampNumber(rule?.generatedCount, 0, Number.MAX_SAFE_INTEGER, 0))) : 0,
    selectedDates: active && recurrence === "dates" ? selectedDates : []
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
  // RTDB may return sparse numeric-key arrays as objects. Preserve server
  // comment order and IDs instead of silently dropping the entire thread.
  const records = Array.isArray(comments) ? comments
    : comments && typeof comments === "object"
      ? Object.entries(comments).sort(([a], [b]) =>
          /^\d+$/.test(a) && /^\d+$/.test(b) ? Number(a) - Number(b) : a.localeCompare(b)
        ).map(([, item]) => item)
      : [];
  return records.filter(comment => comment && typeof comment === "object").map(comment => ({
    ...comment,
    id: comment.id ? String(comment.id) : '',
    author: normalizeUser(comment.author || getCurrentUser()),
    type: comment.type || "作業メモ",
    text: String(comment.text || ""),
    createdAt: finiteTimestamp(comment.createdAt, 0)
  }));
}

function normalizeKnowledge(item) {
  return {
    ...item,
    id: item.id || generateKnowledgeId(),
    taskId: String(item.taskId || ""),
    title: String(item.title || "名称未設定のナレッジ"),
    summary: String(item.summary || ""),
    symptom: String(item.symptom || ""),
    action: String(item.action || ""),
    checkpoint: String(item.checkpoint || ""),
    author: normalizeUser(item.author || getCurrentUser()),
    revision: normalizeRevision(item.revision),
    createdAt: finiteTimestamp(item.createdAt, 0)
  };
}

function generateKnowledgeId() {
  if (state.firebaseReady && state.dbApi && state.knowledgeRef) return push(state.knowledgeRef).key;
  return `knowledge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

function operationKey(kind, id = "") {
  return `${kind}:${id || "new"}`;
}

// One shared operation lock for Classic.
// UI busy indications and canonical transaction writers remain owned by Classic.
const sharedWriteCoordinator = createWorkspaceWriteCoordinator({
  operationKey,
  inFlightOperations: state.inFlightOperations,
  getConnectionMode: () => state.connectionMode,
  setOperationBusy: setOperationDisabled,
  logFailure: (key, error) => console.warn(`Write failed: ${key}`, error),
  onNetworkFailure: () => setConnectionMode('remote-degraded', '共同保存に失敗しました。再読込後に同じ操作を実行してください'),
  onSettled: kind => { if (String(kind).startsWith('todo-')) render(); }
});

async function executeWrite(kind, id, writer) {
  return sharedWriteCoordinator.execute(kind, id, writer);
}

function setOperationDisabled(key, disabled) {
  document.querySelectorAll(`[data-operation-key="${cssEscape(key)}"]`).forEach(button => {
    button.disabled = disabled;
    button.setAttribute('aria-busy', disabled ? 'true' : 'false');
    if (button.dataset.action === 'delete') {
      if (disabled) {
        button.dataset.originalLabel ||= button.textContent;
        button.textContent = '削除中…';
      } else if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    }
  });
  const kind = String(key).split(':', 1)[0];
  const button = kind.startsWith('schedule')
    ? elements.scheduleForm?.querySelector('[type="submit"]')
    : (kind.startsWith('task') || ['recurring', 'bulk'].includes(kind))
      ? (kind === 'bulk' ? elements.listView?.querySelector('[data-apply-bulk]') : elements.taskForm?.querySelector('[type="submit"]'))
      : null;
  if (button) {
    button.disabled = disabled;
    button.setAttribute('aria-busy', disabled ? 'true' : 'false');
  }
  if (kind === 'todo-create') {
    document.querySelectorAll('[data-todo-form]').forEach(form => {
      form.setAttribute('aria-busy', disabled ? 'true' : 'false');
      form.querySelectorAll('input, button').forEach(control => {
        control.disabled = disabled;
        control.setAttribute('aria-busy', disabled ? 'true' : 'false');
      });
    });
  }
  if (kind.startsWith('todo-') && kind !== 'todo-create') {
    const [, id = ''] = String(key).split(':', 2);
    document.querySelectorAll(`[data-todo-id="${cssEscape(id)}"]`).forEach(row => {
      row.setAttribute('aria-busy', disabled ? 'true' : 'false');
      row.classList.toggle('is-busy', disabled);
      row.querySelectorAll('input, button').forEach(control => {
        control.disabled = disabled;
        control.setAttribute('aria-busy', disabled ? 'true' : 'false');
      });
    });
  }
}

function showWriteFailure(result, fallback = '保存できませんでした。入力内容を確認して再試行してください') {
  if (result?.error === 'remote-content-changed' || result?.error === 'revision-or-relation-mismatch') return toast('他の更新と競合しました。最新内容を確認してください', true);
  if (result?.error === 'already-deleted') return toast('すでに削除されています。画面を更新しました。', true);
  if (result?.error === 'permission-denied') return toast('権限がないため保存できません。競合ではありません。', true);
  if (result?.error === 'network-or-read-failure') return toast('通信を確認できないため保存できません。競合ではありません。', true);
  if (result?.error === 'delete-not-persisted') return toast('共同データ上で削除を確認できなかったため、画面からは削除していません。通信状態を確認して再試行してください。', true);
  if (result?.error === 'transaction-aborted-or-invariant-failure') return toast('保存処理を完了できませんでした。再試行してください。', true);
  if (result?.error === 'write-not-available') return toast('共同データの状態を確認中またはエラーのため保存できません。', true);
  if (result?.error === 'in-flight') return toast('同じ操作を保存中です。', true);
  return toast(fallback, true);
}

async function transactionRecord(collection, id, expectedRevision, nextRecord) {
  const path = `rooms/${ROOM_ID}/${collection}/${id}`;
  if (state.connectionMode === 'local-only') {
    const collectionState = state[collection];
    const index = collectionState.findIndex(item => item.id === id);
    const current = index >= 0 ? collectionState[index] : null;
    if ((!current && normalizeRevision(expectedRevision) > 0)
      || (current && normalizeRevision(current.revision) !== normalizeRevision(expectedRevision))) throw new Error('conflict');
    const next = nextRecord(current);
    const committed = next === null ? null : { ...next, revision: normalizeRevision(current?.revision) + 1 };
    applyCommittedResult({ snapshot: committed, snapshotScope: 'record', affectedPaths: [path], mutationKind: collection });
    return { committed: true, snapshot: committed, snapshotScope: 'record', affectedPaths: [path], mutationKind: collection };
  }
  let conflict = false;
  const result = await runTransaction(ref(state.db, path), current => {
    const currentRevision = normalizeRevision(current?.revision);
    if ((!current && normalizeRevision(expectedRevision) > 0)
      || (current && currentRevision !== normalizeRevision(expectedRevision))) {
      conflict = true;
      return;
    }
    const next = nextRecord(current);
    if (next === null) return null;
    const nextWithRevision = { ...next, revision: currentRevision + 1 };
    Object.assign(next, nextWithRevision);
    return nextWithRevision;
  });
  if (!result.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
  const snapshot = result.snapshot?.val() ?? null;
  applyCommittedResult({ snapshot, snapshotScope: 'record', affectedPaths: [path], mutationKind: collection });
  return { committed: true, snapshot, snapshotScope: 'record', affectedPaths: [path], mutationKind: collection };
}

async function persistMetaFields(fields) {
  const names = Object.keys(fields);
  const expectedRevisions = {...state.metaRevisions};
  if (!names.length) return { ok: true, mode: state.connectionMode, operationId: 'meta:none', affectedPaths: [] };
  const key = names.sort().join(',');
  return executeWrite('meta', key, async () => {
    if (state.connectionMode === 'local-only') {
      const snapshot = { meta: { _revisions: { ...state.metaRevisions } } };
      const revisions = snapshot.meta._revisions;
      names.forEach(name => { revisions[name] = normalizeRevision(revisions[name]) + 1; snapshot.meta[name] = fields[name]; });
      applyCommittedResult({ snapshot, affectedPaths: names.map(name => `rooms/${ROOM_ID}/meta/${name}`), mutationKind: 'meta' });
      applyCommittedMeta(snapshot.meta);
      return { committed: true, snapshot, snapshotScope: 'root', affectedPaths: names.map(name => `rooms/${ROOM_ID}/meta/${name}`), mutationKind: 'meta' };
    }
    let conflict = false;
    const result = await runTransaction(state.metaRef, current => {
      const meta = current && typeof current === 'object' ? current : {};
      const revisions = meta._revisions && typeof meta._revisions === 'object' ? meta._revisions : {};
      for (const name of names) {
        if (normalizeRevision(revisions[name]) !== normalizeRevision(expectedRevisions[name])) {
          conflict = true;
          return;
        }
      }
      const nextRevisions = { ...revisions };
      names.forEach(name => { nextRevisions[name] = normalizeRevision(revisions[name]) + 1; });
      return { ...meta, ...fields, _revisions: nextRevisions };
    });
    if (!result.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
    const snapshot = result.snapshot?.val() || {};
    applyCommittedMeta(snapshot);
    return { committed: true, snapshot: { meta: snapshot }, snapshotScope: 'root', affectedPaths: names.map(name => `rooms/${ROOM_ID}/meta/${name}`), mutationKind: 'meta' };
  });
}

function applyCommittedMeta(meta) {
  state.metaRevisions = meta?._revisions && typeof meta._revisions === 'object' ? meta._revisions : state.metaRevisions;
}

async function transactionRoom(mutator, affectedPaths) {
  if (state.connectionMode === 'local-only') {
    const root = {
      tasks: Object.fromEntries(state.tasks.map(item => [item.id, item])),
      schedules: Object.fromEntries(state.schedules.map(item => [item.id, item])),
      knowledge: Object.fromEntries(state.knowledge.map(item => [item.id, item])),
      todos: { ...state.todoRaw }
    };
    const next = mutator(root);
    applyCommittedResult({ snapshot: next, affectedPaths, mutationKind: 'room' });
    return { committed: true, snapshot: next, snapshotScope: 'root', affectedPaths, mutationKind: 'room' };
  }
  let conflict = false;
  const remote = await runTransaction(state.roomRef, current => {
    try { return mutator(current && typeof current === 'object' ? current : {}); }
    catch (error) { conflict = error.message === 'conflict'; return; }
  });
  if (!remote.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
  const snapshot = remote.snapshot?.val() || {};
  applyCommittedResult({ snapshot, affectedPaths, mutationKind: 'room' });
  return { committed: true, snapshot, snapshotScope: 'root', affectedPaths, mutationKind: 'room' };
}

async function persistKnowledge(item) {
  const expectedRevision = normalizeRevision(item.revision);
  return executeWrite('knowledge', item.id, () => transactionRecord('knowledge', item.id, expectedRevision, () => item));
}

async function createKnowledgeFromTask(id, values = null) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const action = values ? String(values.action||'') : prompt("ナレッジとして残す対応内容を入力してください。", task.completedMemo || task.description || "");
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
    createdAt: Date.now(),
    ...(values?{title:values.title,summary:values.summary,symptom:values.symptom,checkpoint:values.checkpoint}:{})
  });
  const expectedKnowledge = task.knowledgeId ? state.knowledge.find(item => item.id === task.knowledgeId) : null;
  const result = await executeWrite('knowledge-link', task.id, () => transactionRoom(root => {
    const currentTask = root.tasks?.[task.id];
    if (!currentTask || normalizeRevision(currentTask.revision) !== normalizeRevision(task.revision)) throw new Error('conflict');
    if (currentTask.knowledgeId !== (task.knowledgeId || '')) throw new Error('conflict');
    root.knowledge ||= {};
    const existingKnowledge = root.knowledge[item.id];
    if (expectedKnowledge) {
      if (!existingKnowledge || existingKnowledge.taskId !== task.id || normalizeRevision(existingKnowledge.revision) !== normalizeRevision(expectedKnowledge.revision)) throw new Error('conflict');
    } else if (existingKnowledge) {
      throw new Error('conflict');
    }
    root.knowledge[item.id] = { ...item, revision: normalizeRevision(existingKnowledge?.revision) + 1 };
    root.tasks[task.id] = { ...currentTask, knowledgeId: item.id, history: appendHistory(currentTask.history, 'タスクをナレッジ化しました。'), updatedAt: Date.now(), updatedBy: getCurrentUser(), revision: normalizeRevision(currentTask.revision) + 1 };
    return root;
  }, [`rooms/${ROOM_ID}/knowledge/${item.id}`, `rooms/${ROOM_ID}/tasks/${task.id}`]));
  if (!result.ok) return showWriteFailure(result, 'ナレッジを作成できませんでした。');
  toast("ナレッジを作成しました");
  return {ok:true,id:item.id};
}

async function unlinkKnowledgeFromTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !task.knowledgeId) return;
  if (!confirm("このタスクのナレッジ化を解除しますか？\n作成済みのナレッジも一覧から削除されます。")) return;

  const knowledgeId = task.knowledgeId;
  const expectedKnowledge = state.knowledge.find(item => item.id === knowledgeId);
  const result = await executeWrite('knowledge-unlink', task.id, () => transactionRoom(root => {
    const currentTask = root.tasks?.[task.id];
    if (!currentTask || normalizeRevision(currentTask.revision) !== normalizeRevision(task.revision)) throw new Error('conflict');
    if (currentTask.knowledgeId !== knowledgeId) throw new Error('conflict');
    const currentKnowledge = root.knowledge?.[knowledgeId];
    if (!expectedKnowledge || !currentKnowledge || currentKnowledge.taskId !== task.id || normalizeRevision(currentKnowledge.revision) !== normalizeRevision(expectedKnowledge.revision)) throw new Error('conflict');
    delete root.knowledge[knowledgeId];
    root.tasks[task.id] = { ...currentTask, knowledgeId: '', history: appendHistory(currentTask.history, 'ナレッジ化を解除しました。'), updatedAt: Date.now(), updatedBy: getCurrentUser(), revision: normalizeRevision(currentTask.revision) + 1 };
    return root;
  }, [`rooms/${ROOM_ID}/knowledge/${knowledgeId}`, `rooms/${ROOM_ID}/tasks/${task.id}`]));
  if (!result.ok) return showWriteFailure(result, 'ナレッジ化を解除できませんでした。');
  toast("ナレッジ化を解除しました");
  return {ok:true};
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
    // A new record must start at revision zero. Inheriting the source's
    // revision makes transactionRecord reject it as an update to a missing ID.
    revision: 0,
    operationId: "",
    nextRecurringTaskId: "",
    recurringParentId: "",
    title: `コピー：${source.title}`,
    // A duplicate begins an independent series, not a child occurrence.
    recurrenceRule: { ...source.recurrenceRule, anchorDate: todayISO(),
      occurrenceDate: "", seriesId: "", generatedCount: 0,
      selectedDates: source.recurrence === "dates"
        ? (source.recurrenceRule?.selectedDates || []).filter(date => date > todayISO()) : [] },
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
  const result = await persistTask(copy);
  if (!result.ok) return showWriteFailure(result, "タスクを複製できませんでした。元のタスクは変更されていません。");
  state.selectedId = copy.id;
  state.layout = "tasks";
  render();
  toast("タスクを複製しました");
  return {ok:true,id:copy.id};
}

function openTaskDialogWithSeed(seed = {}) {
  openTaskDialog();
  if (seed.title) $("taskTitle").value = seed.title;
  if (seed.description != null) $("taskDescription").value = String(seed.description);
  if (seed.status && [...$("taskStatus").options].some(opt => opt.value === seed.status)) $("taskStatus").value = seed.status;
  if (seed.category && [...$("taskCategory").options].some(opt => opt.value === seed.category)) $("taskCategory").value = seed.category;
  if (seed.tags) $("taskTags").value = Array.isArray(seed.tags) ? seed.tags.join(", ") : seed.tags;
  if (seed.dueDate) $("taskDueDate").value = seed.dueDate;
}

function clearTodoPromotionContext() { state.todoPromotionContext = null; }
function clearTaskDialogContexts() {
  clearTodoPromotionContext();
  state.pendingScheduleTaskLink = "";
}

function promoteTodo(todo) {
  const current = state.todos.find(row => row.id === todo?.id
    && row.owner === normalizeUser(getCurrentUser()));
  if (!current || !canPromoteTodo({ todoId: todo.id, owner: todo.owner, baseRevision: todo.revision }, current)) {
    return { ok: false, error: 'revision-or-relation-mismatch' };
  }
  if (state.inFlightOperations.has(operationKey('todo-promote', current.id))) {
    return { ok: false, error: 'in-flight' };
  }
  openTaskDialogWithSeed({ title: current.text, description: current.memo || '' });
  state.todoPromotionContext = { todoId: current.id, owner: current.owner, baseRevision: current.revision };
  return { ok: true, pending: true };
}

// Ver.559 replaces the old two-write promotion (task first, then ToDo
// completion) with the existing room-level RTDB transaction. A conflict or
// network error leaves BOTH records unchanged and the dialog open.
async function persistPromotedTaskV559(task, context) {
  const todo = state.todos.find(row => row.id === context?.todoId);
  if (!todo || !canPromoteTodo(context, todo)
    || normalizeUser(getCurrentUser()) !== context.owner) {
    return { ok: false, error: 'revision-or-relation-mismatch', affectedPaths: [] };
  }
  const taskPath = 'rooms/' + ROOM_ID + '/tasks/' + task.id;
  const todoPath = 'rooms/' + ROOM_ID + '/todos/' + context.todoId;
  return executeWrite('todo-promote', context.todoId, async () => {
    let stopRoomRead = null;
    try {
      if (state.connectionMode === 'remote-online') {
        // Firebase RTDB may call the update function first with an uncached
        // null root, even when server data exists. A one-shot get() does not
        // keep this parent root in the transaction's live local cache.
        // Maintain a Classic-owned root listener until commit/abort and then
        // detach it. This listener makes no writes and creates no data owner.
        const freshRoot = await new Promise((resolve, reject) => {
          stopRoomRead = onValue(state.roomRef,
            snapshot => resolve(snapshot.val()), error => reject(error));
        });
        if (!canPromoteTodo(context, freshRoot?.todos?.[context.todoId])) {
          throw new Error('revision-or-relation-mismatch');
        }
      }
      const saved = await transactionRoom(root => {
      const source = root.todos?.[context.todoId];
      if (!source || source.id !== context.todoId
        || !canPromoteTodo(context, source)
        || root.tasks?.[task.id]) throw new Error('conflict');
      const now = Date.now();
      root.tasks ||= {};
      root.tasks[task.id] = { ...task, revision: 1 };
      root.todos[context.todoId] = {
        ...source, completed: true, completedAt: now,
        updatedAt: now, revision: normalizeRevision(source.revision) + 1
      };
      return root;
    }, [taskPath, todoPath]);
    const committed = saved.snapshot?.todos?.[context.todoId];
    applyTodoSync({ type: 'apply-commit', roomId: ROOM_ID, changes: [{
      id: context.todoId, record: committed, baseRevision: context.baseRevision
    }] });
      return { committed: true, affectedPaths: [taskPath, todoPath] };
    } finally {
      stopRoomRead?.();
    }
  });
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
    },
    todos: {
      eyebrow: "PERSONAL TODO",
      title: "ToDo・個人メモ管理"
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
  } else if (state.layout === "todos") {
    elements.searchInput.placeholder = "ToDoページでは個人ToDoのみを表示します";
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
  // 今日ビュー・スケジュール・ToDo には「完了」の概念を出さないため、非表示中の完了絞り込みは解除する。
  if ((state.layout === "today" || state.layout === "schedule" || state.layout === "todos") && scopeHasDone()) {
    state.scope = makeScope(scopeHasMine(), false);
  }

  // スケジュール / ToDo では状態・優先度・期限系フィルターは使わないため、裏で効いたままにしない。
  if (state.layout === "schedule" || state.layout === "todos") {
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
    let active = false;
    if (item.dataset.layout) {
      active = item.dataset.layout === "tasks"
        ? ["tasks", "dashboard"].includes(state.layout)
        : item.dataset.layout === state.layout;
      item.classList.toggle("active", active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
    if (item.dataset.filter === "mine") active = scopeHasMine();
    if (item.dataset.filter === "favorite") active = Boolean(elements.favoriteOnly?.checked);
    if (item.dataset.filter === "done") active = scopeHasDone();
    if (item.dataset.filter) {
      item.classList.toggle("active", active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  });
  (elements.taskViewButtons || []).forEach(item => {
    const active = item.dataset.taskLayout === state.taskLayout && state.layout === "tasks";
    item.classList.toggle("active", active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  (elements.statButtons || []).forEach(item => {
    const active = item.dataset.statLayout === state.layout;
    item.classList.toggle("active", active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function normalizeTaskLayout(layout) {
  return ["board", "list", "timeline"].includes(layout) ? layout : "board";
}

// Merge concurrent Firebase collection snapshots into one animation frame.
// Direct user navigation and committed writes still render immediately.
let subscriptionRenderFrame = null;
// JOURNAL V528: transient indication that a render originated in a remote
// subscription. Direct navigation and task saves must keep their own anchors.
let journalSubscribedRenderV528 = false;
// JOURNAL V530: an in-progress Japanese IME conversion must not lose its
// actual input node when a remote snapshot arrives.
let journalSearchComposingV530 = null;
let journalSearchSyncDeferredV530 = false;
function journalFinishSearchCompositionV530(input) {
  if (journalSearchComposingV530 !== input) return;
  journalSearchComposingV530 = null;
  if (journalSearchSyncDeferredV530) {
    journalSearchSyncDeferredV530 = false;
    scheduleSubscribedRender();
  }
}
function scheduleSubscribedRender() {
  if (subscriptionRenderFrame !== null) return;
  subscriptionRenderFrame = requestAnimationFrame(() => {
    subscriptionRenderFrame = null;
    if (journalSearchComposingV530?.isConnected
      && document.activeElement === journalSearchComposingV530
      && journalTaskV411() && state.layout === 'tasks'
      && (state.taskLayout === 'board' || state.taskLayout === 'list')) {
      journalSearchSyncDeferredV530 = true;
      return;
    }
    journalSubscribedRenderV528 = true;
    try { render(); }
    finally { journalSubscribedRenderV528 = false; }
  });
}

function render() {
  // A user-triggered render already includes every queued remote update.
  if (subscriptionRenderFrame !== null) {
    cancelAnimationFrame(subscriptionRenderFrame);
    subscriptionRenderFrame = null;
  }
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
  const isTodos = state.layout === "todos";
  const isTasks = state.layout === "tasks";
  const isDashboard = state.layout === "dashboard";
  const isSchedule = state.layout === "schedule";
  // Classic discards its hidden ToDo DOM when a different layout is shown.
  // Take a page-memory snapshot before it is hidden/removed, not after.
  if (!isTodos && !elements.todoView.hidden
    && document.documentElement.dataset.wbDisplay === 'classic') {
    rememberClassicTodoNavigationDraft();
  }
  document.body.classList.toggle("today-mode", isToday);
  document.body.classList.toggle("todo-mode", isTodos);
  document.body.classList.toggle("task-mode", isTasks);
  document.body.classList.toggle("dashboard-mode", isDashboard);
  document.body.classList.toggle("schedule-mode", isSchedule);
  renderSummary();
  renderScheduleNotificationSidebar();

  const tasks = getFilteredTasks();
  elements.todayView.hidden = !isToday;
  elements.todoView.hidden = !isTodos;
  elements.boardView.hidden = !(isTasks && state.taskLayout === "board");
  elements.listView.hidden = !(isTasks && state.taskLayout === "list");
  elements.timelineView.hidden = !(isTasks && state.taskLayout === "timeline");
  elements.dashboardView.hidden = !isDashboard;
  elements.scheduleView.hidden = !isSchedule;

  if (isToday) {
    elements.todoView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTodayView();
  } else if (isTodos) {
    elements.todayView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTodoView();
  } else if (isTasks && state.taskLayout === "list") {
    elements.todayView.innerHTML = "";
    elements.todoView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderList(tasks);
  } else if (isTasks && state.taskLayout === "timeline") {
    elements.todayView.innerHTML = "";
    elements.todoView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTimeline(tasks);
  } else if (isDashboard) {
    elements.todayView.innerHTML = "";
    elements.todoView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderDashboard(getDashboardFilteredTasks());
  } else if (isSchedule) {
    elements.todayView.innerHTML = "";
    elements.todoView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    renderScheduleView(getFilteredSchedules());
  } else if (isTasks && state.taskLayout === "board") {
    elements.todayView.innerHTML = "";
    elements.todoView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderBoard(tasks);
  } else {
    state.layout = "today";
    elements.todoView.innerHTML = "";
    elements.boardView.innerHTML = "";
    elements.listView.innerHTML = "";
    elements.timelineView.innerHTML = "";
    elements.dashboardView.innerHTML = "";
    elements.scheduleView.innerHTML = "";
    renderTodayView();
  }

  if (state.layout === "tasks") renderDetail();
  notifyPaletteNextSubscribers();
}

function showRenderError(error) {
  const message = error?.message || String(error || "不明なエラー");
  const target = elements.todayView || elements.boardView || elements.mainContent;
  if (!target) return;

  [elements.todayView, elements.todoView, elements.boardView, elements.listView, elements.timelineView, elements.dashboardView, elements.scheduleView].forEach(view => {
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
  // Shared read-only selectors: identical status, due-date and group-assignee semantics.
  const { open, overdue, today, mine } = summarizeTaskCounters(state.tasks, {
    today: startOfToday(),
    isCompleted: isCompletedStatus,
    isMine: isCurrentUserOrGroupAssignee,
    parseDueDate: toDate
  });
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
          <span class="activity-title-bell" aria-hidden="true"><svg class="activity-bell-outline-v337" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9Z"/><path d="M10 20h4"/></svg></span>
          <span class="activity-title-text">お知らせ</span>
          ${unreadCount ? `<span class="activity-count">${unreadCount}件</span>` : ""}
        </h4>
        <p>新規追加と、見落としやすい重要更新をここで確認できます。</p>
      </div>
      <div class="activity-actions">
        <button class="ghost-button activity-read-button" type="button" data-mark-activity-read ${unreadCount ? "" : "disabled"}>確認済みにする</button>
        <span class="today-action-divider-v220" aria-hidden="true"></span>
        <button class="ghost-button today-compact-action-v176" type="button" data-layout-jump="schedule">スケジュールを見る</button>
        <button class="primary-button today-compact-action-v176" type="button" data-new-task>＋ 新しいタスク</button>
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
    <span class="activity-topline-v531">
      <span class="activity-kind">${escapeHtml(item.action)}</span>
      <time>${escapeHtml(formatDateTime(item.at))}</time>
    </span>
    <strong>${escapeHtml(item.title)}</strong>
    ${item.changeSummary ? `<small class="activity-change">${escapeHtml(item.changeSummary)}</small>` : ""}
    <small class="activity-meta">${escapeHtml(item.meta)}</small>
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

function renderScheduleNotificationSidebar() {
  const connection = elements.connectionPill;
  if (!connection) return;

  let host = document.getElementById("scheduleNotificationSidebarV220");
  if (!host) {
    host = document.createElement("div");
    host.id = "scheduleNotificationSidebarV220";
    host.className = "schedule-notification-sidebar-v220";
    host.setAttribute("aria-label", "予定通知");
    connection.insertAdjacentElement("afterend", host);
  } else if (connection.nextElementSibling !== host) {
    connection.insertAdjacentElement("afterend", host);
  }

  host.innerHTML = renderNotificationPermissionButton();
  host.querySelector("[data-enable-schedule-notifications]")?.addEventListener("click", requestScheduleNotificationPermission);
}

function bindActivityPanel(root) {
  root.querySelector("[data-mark-activity-read]")?.addEventListener("click", () => {
    setActivityReadAt(Date.now());
    render();
    toast("お知らせを確認済みにしました");
  });

  root.querySelector("[data-open-activity-dialog]")?.addEventListener("click", openActivityDialog);
  bindActivityItemActions(root);
}

function noteClassicActivityNavigationV317(){
  window.dispatchEvent(new Event('workboard:classic-surface-navigation-v317'));
}

function bindActivityItemActions(root) {
  root.querySelectorAll("[data-activity-task]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.__activityClickTimer) clearTimeout(button.__activityClickTimer);
      button.__activityClickTimer = setTimeout(() => {
        button.__activityClickTimer = null;
        const task = state.tasks.find(item => item.id === button.dataset.activityTask);
        if (!task) return;
        noteClassicActivityNavigationV317();
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
      noteClassicActivityNavigationV317();
      if (elements.activityDialog?.open) elements.activityDialog.close();
      openTaskEditorById(task.id);
    });
  });

  root.querySelectorAll("[data-activity-schedule]").forEach(button => {
    button.addEventListener("click", () => {
      const schedule = state.schedules.find(item => item.id === button.dataset.activitySchedule);
      if (!schedule) return;
      noteClassicActivityNavigationV317();
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

function journalTodayTaskCardV420(task, index) {
  const p=checklistProgress(task);
  const due=task.dueDate?(isOverdue(task)?"期限超過":isDueToday(task)?"今日まで":task.dueDate.slice(5).replace("-","/")):"期限なし";
  return `<article class="j420-work-note ${isOverdue(task)?'is-late':''}" data-task-id="${escapeHtml(task.id)}" data-task-drag-id="${escapeHtml(task.id)}" draggable="true" role="button" tabindex="0" aria-label="${escapeHtml(task.title)}のタスク詳細">
     <svg class="j425-today-card-fastener" aria-hidden="true"><use href="./assets/journal-fasteners-v425.svg#${index%2?'pin':'binder'}"></use></svg><div class="j420-note-top"><span class="j420-note-index">${String(index+1).padStart(2,'0')}</span><span class="j420-note-due">${escapeHtml(due)}</span></div>
     <strong>${escapeHtml(task.title)}</strong>
     <span class="j420-note-category">${escapeHtml(task.category||'未分類')} / ${escapeHtml(task.status)}</span>
     <div class="j420-note-tags"><span>優先 ${escapeHtml(task.priority)}</span><span>担当 ${escapeHtml(task.assignee||'未割当')}</span></div>
     ${p.total?`<div class="j420-note-progress"><span style="width:${p.percent}%"></span></div><small class="j420-note-count">${p.done}/${p.total} 確認</small>`:''}
     ${favoriteButton(task,'j420-note-favorite')}
   </article>`;
}

function journalTodayV420() {
  const today=todayISO();
  const assignee=elements.assigneeFilter?.value||'';
  const category=elements.categoryFilter?.value||'';
  const allowed=x=>(!assignee||x.assignee===assignee)&&(!category||x.category===category)
    &&(!scopeHasMine()||isCurrentUserOrGroupAssignee(x.assignee));
  const schedules=state.schedules.filter(s=>scheduleLocalDate(s)===today&&allowed(s))
    .sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  const all=state.tasks.filter(t=>!isCompletedStatus(t.status)&&allowed(t));
  const late=all.filter(isOverdue).sort(compareSmartTasks);
  const todayTasks=all.filter(isDueToday).sort(compareSmartTasks);
  const important=all.filter(t=>!(/保留/.test(t.status)) && (isOverdue(t)||isDueToday(t)||t.pinned||['緊急','高'].includes(t.priority)))
    .sort(compareSmartTasks);
  const top=important.concat(all.filter(t=>!important.includes(t)).sort(compareSmartTasks)).slice(0,6);
  const alerts=getActivityItems().filter(x=>x.important).slice(0,4);
  const todos=visibleTodos().filter(x=>!x.completed).slice(0,4);
  const waiting=all.filter(t=>/確認待|回答待|承認待|依頼中|材料待|待機/.test(t.status)).slice(0,3);
  const filters=[scopeHasMine()?'自分の担当':'',assignee?'担当：'+assignee:'',category?'分類：'+category:''].filter(Boolean);
  const d=startOfToday();
  const dateLabel=`${d.getMonth()+1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`;
  const agenda=schedules.map(s=>{
    const time=formatScheduleTime(s.startAt),end=formatScheduleTime(s.endAt);
    return `<article class="j420-agenda-item" data-schedule-id="${escapeHtml(s.id)}" role="button" tabindex="0" aria-label="${escapeHtml(s.title)}の予定を編集">
      <time>${escapeHtml(time)}</time><div class="j420-agenda-track"><i></i></div>
      <div class="j420-agenda-paper"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.category||'予定')} ・ 終了 ${escapeHtml(end)}</small>${s.location?`<span>${escapeHtml(s.location)}</span>`:''}</div>
    </article>`;
  }).join('')||'<div class="j420-empty">今日の予定はまだありません。時間が決まったらここへ記録できます。</div>';
  const updateItems=alerts.map(a=>{
    return `<button type="button" class="j420-update-item" data-j420-update-kind="${a.kind}" data-j420-update-id="${escapeHtml(a.id)}"><span class="j420-update-dot"></span><span><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.action)}　${escapeHtml(formatDateTime(a.at))}</small></span></button>`;
  }).join('')||'<p class="j420-pocket-empty">新しい重要なお知らせはありません。</p>';
  const todoItems=todos.map(t=>`<label class="j420-todo-item"><input type="checkbox" data-j420-todo="${escapeHtml(t.id)}" aria-label="${escapeHtml(t.text)}を完了"><span>${escapeHtml(t.text)}</span></label>`).join('')||'<p class="j420-pocket-empty">未完了のToDoはありません。</p>';
  const waitingItems=waiting.map(t=>`<article class="j420-waiting-item" data-task-id="${escapeHtml(t.id)}" data-task-drag-id="${escapeHtml(t.id)}" tabindex="0" role="button"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.status)}</small></article>`).join('')||'<p class="j420-pocket-empty">現在、確認待ちの案件はありません。</p>';
  elements.todayView.innerHTML=`
    <div class="j420-today">
      <header class="j420-masthead">
        <div><span class="j420-eyebrow">01 / TODAY JOURNAL</span><h2>本日の綴り</h2><p>${escapeHtml(dateLabel)}</p></div>
        <div class="j420-masthead-stats" role="group" aria-label="今日の件数">
          <span><small>本日の予定</small><strong>${schedules.length}<em>件</em></strong></span>
          <span><small>今日までのタスク</small><strong>${todayTasks.length}<em>件</em></strong></span>
          <span class="j420-late"><small>期限超過</small><strong>${late.length}<em>件</em></strong></span>
        </div>
      </header>
      ${filters.length?`<div class="j420-filter-summary" role="status">表示条件：${filters.map(escapeHtml).join('・')} <button type="button" data-j420-clear-filters>条件をクリア</button></div>`:''}
      <div class="j420-today-spread">
        <section class="j420-planner" aria-label="今日の流れ">
          <span class="j420-ribbon" aria-hidden="true"></span>
          <div class="j420-paper-head"><div><span>DAY PLAN / ${escapeHtml(dateLabel)}</span><h3>今日の流れ</h3></div><span class="j420-paper-head-icon" aria-hidden="true">✦</span></div>
          <div class="j420-agenda">${agenda}</div>
          <button type="button" class="j420-add-appointment" data-j420-create-schedule>＋ 予定を追加</button>
        </section>
        <section class="j420-focus" aria-label="進行中の案件">
          <div class="j420-paper-head"><div><span>FOCUS / THE WORK IN PROGRESS</span><h3>進行中の案件</h3></div><button type="button" data-j420-to-tasks>すべて見る →</button></div>
          <div class="j420-note-grid">${top.map(journalTodayTaskCardV420).join('')||'<div class="j420-empty">進行中の案件はありません。新しいタスクから登録できます。</div>'}</div>
          <button type="button" class="j420-add-task" data-j420-create-task>＋ 新しい案件を書き込む</button>
          <div class="j420-stationery j425-today-stationery" aria-hidden="true"><img class="j440-today-bookmark" src="./assets/journal-bookmark-seal-v440.svg" alt="" decoding="async"></div>
        </section>
        <aside class="j420-pockets" aria-label="更新・メモ・確認待ち">
          <div class="j420-pocket j420-pocket-activity"><h3><span aria-hidden="true">✉</span> 受信・更新 <small>${alerts.length}</small></h3><div class="j420-pocket-items">${updateItems}</div><button type="button" data-j420-show-activity>お知らせを見る →</button></div>
          <div class="j420-pocket j420-pocket-todos"><h3><span aria-hidden="true">☷</span> メモ・ToDo <small>${todos.length}</small></h3><div class="j420-pocket-items">${todoItems}</div><button type="button" data-j420-to-todos>ToDoを開く →</button></div>
          <div class="j420-pocket j420-pocket-wait"><h3><span aria-hidden="true">⌛</span> 待ち <small>${waiting.length}</small></h3><div class="j420-pocket-items">${waitingItems}</div></div>
        </aside>
      </div>
    </div>`;
  const root=elements.todayView;
  bindTaskCards(root);
  bindScheduleCardsInRoot(root);
  root.querySelectorAll('.j420-agenda-item').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const s=state.schedules.find(x=>x.id===el.dataset.scheduleId);if(s)openScheduleDialog(s)}}));
  root.querySelectorAll('[data-j420-todo]').forEach(el=>el.addEventListener('change',()=>toggleTodo(el.dataset.j420Todo)));
  root.querySelectorAll('[data-j420-update-id]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.j420UpdateKind==='task')selectTask(b.dataset.j420UpdateId);
    else {const s=state.schedules.find(x=>x.id===b.dataset.j420UpdateId);if(s)openScheduleDialog(s)}
  }));
  root.querySelector('[data-j420-create-schedule]')?.addEventListener('click',()=>openScheduleDialog());
  root.querySelector('[data-j420-create-task]')?.addEventListener('click',()=>openTaskDialog());
  root.querySelector('[data-j420-show-activity]')?.addEventListener('click',openActivityDialog);
  root.querySelector('[data-j420-clear-filters]')?.addEventListener('click',()=>elements.resetFilters.click());
  root.querySelector('[data-j420-to-tasks]')?.addEventListener('click',()=>{state.layout='tasks';state.taskLayout='board';render()});
  root.querySelector('[data-j420-to-todos]')?.addEventListener('click',()=>{state.layout='todos';render()});
}

function renderTodayView() {
  if (typeof document !== 'undefined' && document.documentElement?.dataset?.wbDisplay === 'journal') return journalTodayV420();
  const today = startOfToday();
  const todayIso = todayISO();
  // Only the Today schedule/task panels participate in sidebar filtering.
  // Activity notices and personal ToDo have their own independent semantics.
  const todayAssignee = elements.assigneeFilter?.value || "";
  const todayCategory = elements.categoryFilter?.value || "";
  const todayConditions = [
    scopeHasMine() ? "自分の担当" : "",
    todayAssignee ? `担当者：${todayAssignee}` : "",
    todayCategory ? `分類：${todayCategory}` : ""
  ].filter(Boolean);
  const matchesTodaySidebarFilters = item =>
    (!todayAssignee || item.assignee === todayAssignee)
    && (!todayCategory || item.category === todayCategory);
  const emptyTodayPanel = (title, description, buttonText = "", action = "task") =>
    todayConditions.length
      ? todayEmpty("表示条件に該当する項目はありません。", "条件をクリアすると、他の予定・タスクを確認できます。", buttonText, action)
      : todayEmpty(title, description, buttonText, action);
  const filterSummary = todayConditions.length ? `
    <section class="today-filter-summary-v375" data-today-filter-summary-v375 role="status">
      <div>
        <strong>予定・タスクを絞り込み中</strong>
        <p>表示条件：${todayConditions.map(escapeHtml).join("・")}</p>
        <small>お知らせ・個人ToDoには適用しません。</small>
      </div>
      <button type="button" class="ghost-button" data-today-filter-clear-v375>条件をクリア</button>
    </section>` : "";
  const openTasks = state.tasks.filter(t => !isCompletedStatus(t.status) && normalizeText(t.status) !== normalizeText("保留") && (!scopeHasMine() || isCurrentUserOrGroupAssignee(t.assignee)) && matchesTodaySidebarFilters(t));
  const schedules = state.schedules
    .filter(s => scheduleLocalDate(s) === todayIso)
    .filter(s => !scopeHasMine() || isCurrentUserOrGroupAssignee(s.assignee))
    .filter(matchesTodaySidebarFilters)
    .sort((a,b) => new Date(a.startAt) - new Date(b.startAt));

  const overdue = openTasks.filter(isOverdue).sort(compareSmartTasks);
  const dueToday = openTasks.filter(isDueToday).sort(compareSmartTasks);
  const spare = openTasks.filter(t => !t.dueDate && normalizeText(t.status) !== normalizeText("確認待ち")).sort(compareSmartTasks).slice(0, 10);

  elements.todayView.innerHTML = `
    ${renderActivityPanel()}


    ${renderTodayTodoPreview()}

    ${filterSummary}

    <div class="today-grid">
      ${todayPanel("今日の予定", schedules.length ? schedules.map(scheduleCard).join("") : emptyTodayPanel("今日の予定はありません。", "時間指定の説明会・打合せ・立会いはスケジュールへ登録します。", "予定を追加", "schedule"))}
      ${todayPanel("期限超過", overdue.length ? overdue.map(taskCard).join("") : emptyTodayPanel("期限超過はありません。", "今すぐ対応すべき滞留タスクはありません。"))}
      ${todayPanel("今日までのタスク", dueToday.length ? dueToday.map(taskCard).join("") : emptyTodayPanel("今日までのタスクはありません。", "本日締切のタスクはありません。"))}
      ${todayPanel("空き時間にやるタスク", spare.length ? spare.map(taskCard).join("") : emptyTodayPanel("期限なしの作業はありません。", "急がない作業が出たら、期限なしで登録しておくと便利です。"))}
    </div>
  `;

  enableTodayPanelOrderingV531(elements.todayView);
  bindTaskCards(elements.todayView);
  bindScheduleCardsInRoot(elements.todayView);
  bindActivityPanel(elements.todayView);
  bindTodayTodoPreview();
  elements.todayView.querySelector("[data-today-filter-clear-v375]")?.addEventListener("click", () => elements.resetFilters.click());
  elements.todayView.querySelector("[data-new-task]")?.addEventListener("click", () => openTaskDialog());
  elements.todayView.querySelector("[data-layout-jump='schedule']")?.addEventListener("click", () => {
    state.layout = "schedule";
    render();
  });
  elements.todayView.querySelectorAll("[data-empty-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.emptyAction;
      if (action === "schedule") openScheduleDialog();
      else openTaskDialog();
    });
  });
}

function renderTodayTodoPreview() {
  const todos = visibleTodos();
  const open = todos.filter(todo => !todo.completed);
  const completed = todos.filter(todo => todo.completed);
  const previewItems = open.slice(0, 3);
  return `
    <section class="today-todo-preview" aria-labelledby="todayTodoPreviewTitle">
      <div class="today-todo-preview-head">
        <div>
          <span class="todo-section-label">PERSONAL TODO</span>
          <h4 id="todayTodoPreviewTitle">個人ToDo</h4>
          <p>簡易なやることだけをここで確認し、詳しい管理は左メニューの「ToDo」で行います。</p>
        </div>
        <div class="today-todo-preview-actions">
          <div class="today-todo-preview-stats">
            <span class="todo-section-chip">未完了 ${open.length}件</span>
            <span class="todo-section-chip todo-section-chip-muted">本日完了 ${completed.length}件</span>
          </div>
          <button class="ghost-button" type="button" data-layout-jump="todos">ToDoを開く</button>
        </div>
      </div>
      ${previewItems.length ? `
        <ul class="todo-preview-items">
          ${previewItems.map(todo => `
            <li class="todo-preview-item" data-todo-id="${escapeHtml(todo.id)}">
              <label class="todo-preview-checkline">
                <input type="checkbox" class="todo-preview-check" data-todo-preview-toggle="${escapeHtml(todo.id)}" ${todo.completed ? 'checked' : ''} aria-label="「${escapeHtml(todo.text)}」を完了にする" />
                <span class="todo-preview-text">${escapeHtml(todo.text)}</span>
              </label>
              <div class="todo-preview-meta">
                ${todo.memo ? '<span class="todo-preview-badge">メモあり</span>' : ''}
                <button class="todo-preview-open" type="button" data-open-todo="${escapeHtml(todo.id)}">詳細を見る</button>
              </div>
            </li>
          `).join('')}
        </ul>
      ` : `
        <div class="todo-preview-empty">
          <strong>未完了のToDoはありません。</strong>
          <p>軽い個人メモが必要になったら、ToDoページから追加できます。</p>
        </div>
      `}
    </section>
  `;
}

function openTodoWorkspace(todoId = '') {
  state.layout = 'todos';
  if (todoId) state.expandedTodoIds.add(todoId);
  closeDetail();
  render();
  if (!todoId) return;
  requestAnimationFrame(() => {
    elements.todoView?.querySelector(`[data-todo-id="${CSS.escape(todoId)}"] .todo-summary-button`)?.focus();
  });
}

function bindTodayTodoPreview() {
  const root = elements.todayView; if (!root) return;
  root.querySelector("[data-layout-jump='todos']")?.addEventListener('click', () => openTodoWorkspace());
  root.querySelectorAll('[data-todo-preview-toggle]').forEach(input => {
    input.addEventListener('change', () => toggleTodo(input.dataset.todoPreviewToggle));
  });
  root.querySelectorAll('[data-open-todo]').forEach(button => {
    button.addEventListener('click', () => openTodoWorkspace(button.dataset.openTodo));
  });
}

// Local-only presentation controls. All ToDo persistence stays in the canonical CRUD.
let journalTodoFilterV425 = 'all';
let journalTodoSortV425 = 'manual';
let journalTodoQueryV425 = '';
let journalTodoSelectedV425 = '';
const journalTodoCollapsedV430 = new Set(); // Presentation only; no changes to stored ToDo records.

// JOURNAL V491: one existing detail reader moves alongside its selected row on
// phones. No cloned editors, listeners, business writes or persisted view state.
const journalInlineDetailMediaV491=window.matchMedia('(max-width:760px)');
let journalTodoInlineSelectedV491='';
let journalTaskInlineSelectedV491='';
function journalPositionSelectedReaderV491(kind){
  if(document.documentElement.dataset.wbDisplay!=='journal')return;
  const todo=kind==='todo';
  const root=todo?elements.todoView:elements.listView;
  const layout=root?.querySelector(todo?'.j425-todo-layout':'.j425-task-index-layout');
  const reader=root?.querySelector(todo?'#j450TodoNote':'.j425-task-preview');
  if(!layout||!reader)return;
  const selectedId=todo?journalTodoInlineSelectedV491:journalTaskInlineSelectedV491;
  const row=[...root.querySelectorAll(todo?'.j425-todo-record.is-selected':'.j425-index-record.is-selected')]
    .find(node=>todo?node.dataset.j425Todo===selectedId:node.dataset.j425Row===selectedId);
  const inline=Boolean(journalInlineDetailMediaV491.matches&&selectedId&&row&&!row.closest('[hidden]'));
  const focused=reader.contains(document.activeElement)?document.activeElement:null;
  if(inline){
    if(reader.previousElementSibling!==row||reader.parentElement!==row.parentElement)row.after(reader);
  }else if(reader.parentElement!==layout)layout.append(reader);
  reader.classList.toggle('j491-inline-detail',inline);
  focused?.focus({preventScroll:true});
}
journalInlineDetailMediaV491.addEventListener('change',()=>{
  journalPositionSelectedReaderV491('todo');
  journalPositionSelectedReaderV491('task');
});


// Keep one canonical editor. On stacked JOURNAL pages move to its note after selection.
function journalTodoFocusV450(id) {
  requestAnimationFrame(() => {
    const view = elements.todoView;
    const note = view.querySelector('#j450TodoNote');
    if (!note || !view.querySelector('.j425-todo-detail')) return;
    if (window.matchMedia('(max-width:1190px)').matches) {
      const heading = note.querySelector('.j425-todo-detail h3');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      note.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
    }
  });
}

function journalTodoV425() {
  const todos=visibleTodos();
  const open=todos.filter(t=>!t.completed);
  const completed=todos.filter(t=>t.completed);
  const filter=journalTodoFilterV425;
  const q=normalizeText(journalTodoQueryV425);
  let visible=todos.filter(t=>(filter==='all'||filter==='open'&&!t.completed||filter==='memo'&&Boolean(t.memo)||filter==='done'&&t.completed)&&(!q||normalizeText(t.text+' '+(t.memo||'')).includes(q)));
  if(journalTodoSortV425==='title')visible=[...visible].sort((a,b)=>a.text.localeCompare(b.text,'ja'));
  const focus=visible.filter(t=>!t.completed).slice(0,5);
  const later=visible.filter(t=>!t.completed).slice(5);
  const done=visible.filter(t=>t.completed);
  if(!visible.some(t=>t.id===journalTodoSelectedV425))journalTodoSelectedV425=visible[0]?.id||'';
  const selected=visible.find(t=>t.id===journalTodoSelectedV425);
  const groups=[{id:'focus',title:'今日やること',subtitle:'先頭5件を今日の候補として表示',items:focus},{id:'later',title:'このあと',subtitle:'順番に確認して進めるToDo',items:later},{id:'done',title:'完了の控え',subtitle:'完了済みのToDo',items:done}];
  // Empty trays only create extra scrolling; keep one explicit empty state.
  const populatedGroups=groups.filter(group=>group.items.length>0);
  const card=(t,index,section)=>{
    const busy=['todo-toggle','todo-delete','todo-update','todo-reorder','todo-promote'].some(k=>state.inFlightOperations.has(operationKey(k,t.id)));
    const moveAllowed=journalTodoSortV425==='manual';
    return `<article class="j425-todo-record ${t.id===journalTodoSelectedV425?'is-selected':''} ${t.completed?'is-done':''}" data-j425-todo="${escapeHtml(t.id)}">
      <label class="j425-todo-check"><input type="checkbox" data-j425-todo-toggle="${escapeHtml(t.id)}" ${t.completed?'checked':''} ${busy?'disabled':''} aria-label="${escapeHtml(t.text)}を${t.completed?'未完了':'完了'}に変更"></label>
      <button type="button" class="j425-todo-record-title" data-j425-todo-select="${escapeHtml(t.id)}" aria-controls="j450TodoNote" aria-current="${t.id===journalTodoSelectedV425?'true':'false'}" ${busy?'disabled':''}><strong>${escapeHtml(t.text)}</strong><small>${t.memo?'メモあり':'詳細メモなし'}　/　${t.completed?'完了':'未完了'}</small></button>
      <span class="j425-todo-record-state">${t.memo?'メモあり':'ToDo'}</span>
      <div class="j425-todo-record-move"><button type="button" data-j425-todo-move="${escapeHtml(t.id)}" data-direction="-1" data-segment="${t.completed?'completed-today':'open'}" ${!moveAllowed||busy||index===0?'disabled':''} aria-label="上へ移動">↑</button><button type="button" data-j425-todo-move="${escapeHtml(t.id)}" data-direction="1" data-segment="${t.completed?'completed-today':'open'}" ${!moveAllowed||busy?'disabled':''} aria-label="下へ移動">↓</button></div>
    </article>`;
  };
  const note=selected?`<div class="j425-todo-detail">
      <span class="j425-detail-category">PERSONAL NOTE / ${selected.completed?'完了':'未完了'}</span><h3>${escapeHtml(selected.text)}</h3>
      <form data-j425-todo-edit>
        <label>やること<input name="title" maxlength="${TODO_MAX_LENGTH}" required value="${escapeHtml(selected.text)}"></label>
        <label>補足メモ<textarea name="memo" rows="7" maxlength="${TODO_MEMO_MAX_LENGTH}" placeholder="補足・確認事項を記録">${escapeHtml(selected.memo||'')}</textarea></label>
        <p class="j425-todo-data-note">ToDoは個人用の簡易記録です。期限・優先度は正式タスクに切り替えて管理できます。</p>
        <button type="submit" class="j425-action-primary">変更を保存</button>
      </form>
      <div class="j425-todo-detail-actions"><button type="button" data-j425-todo-promote>正式タスクにする</button><button type="button" data-j425-todo-delete>削除</button></div>
    </div>`:'<p class="j425-blank">左のToDoを選択すると、ここにメモと編集欄が表示されます。</p>';
  elements.todoView.innerHTML=`<div class="j425-todo">
    <header class="j425-editorial-head"><div><span>02 / DAILY CHECKLIST</span><h2>ToDo</h2></div>
      <form data-j425-todo-create class="j425-todo-create"><input id="todayTodoInput" type="text" required maxlength="${TODO_MAX_LENGTH}" placeholder="新しいToDoを記入"><button type="submit" class="j425-action-primary">＋ 追加</button><details><summary>メモを添える</summary><textarea id="todayTodoMemo" rows="2" maxlength="${TODO_MEMO_MAX_LENGTH}" placeholder="補足メモ"></textarea></details></form>
    </header>
    <div class="j425-editorial-layout j425-todo-layout">
      <nav class="j425-index-rail" aria-label="ToDoの分類"><h3>ToDo索引</h3><small>PERSONAL INDEX</small><h4>作業のしおり</h4>
        ${[{id:'all',label:'すべて',n:todos.length},{id:'open',label:'未完了',n:open.length},{id:'memo',label:'メモあり',n:todos.filter(t=>t.memo).length},{id:'done',label:'完了',n:completed.length}].map(v=>`<button type="button" class="j425-index-option" data-j425-todo-filter="${v.id}" aria-pressed="${filter===v.id}">${v.label}<span>${v.n}</span></button>`).join('')}
        
      </nav>
      <section class="j425-todo-trays" aria-label="ToDoの作業トレイ"><div class="j425-workbench-toolbar">
        <label>検索<input type="search" data-j425-todo-search value="${escapeHtml(journalTodoQueryV425)}" placeholder="ToDo・メモを検索"></label>
        <label>表示順<select data-j425-todo-sort><option value="manual" ${journalTodoSortV425==='manual'?'selected':''}>手動順</option><option value="title" ${journalTodoSortV425==='title'?'selected':''}>タイトル順</option></select></label>
      </div>
      ${populatedGroups.map(g=>`<section class="j425-todo-tray j425-todo-${g.id} ${journalTodoCollapsedV430.has(g.id)?'is-collapsed':''}">
        <header><div class="j430-todo-ribbon"><span class="j430-todo-ribbon-mark" aria-hidden="true">${g.id==='focus'?'✳':g.id==='later'?'◇':'✓'}</span>
          <h3>${g.title}<span>${g.items.length}</span></h3></div>
          <div class="j430-todo-tray-side"><small>${g.subtitle}</small><button type="button" data-j430-todo-fold="${g.id}" aria-expanded="${!journalTodoCollapsedV430.has(g.id)}" aria-label="${g.title}を${journalTodoCollapsedV430.has(g.id)?'展開':'折りたたむ'}">${journalTodoCollapsedV430.has(g.id)?'開く':'閉じる'}</button></div>
        </header><div class="j425-todo-items" ${journalTodoCollapsedV430.has(g.id)?'hidden':''}>${g.items.map((t,i)=>card(t,i,g)).join('')||'<p class="j425-todo-empty">このトレイのToDoはありません</p>'}</div>
      </section>`).join('')||'<p class="j447-todo-empty-state" role="status">該当するToDoはありません。検索・分類を変更するか、新しく追加してください。</p>'}
      <div class="j425-stationery-row j425-todo-props" aria-hidden="true"><img class="j442-todo-stationery" src="./assets/journal-todo-stationery-v442.svg" alt="" decoding="async"></div>
      </section>
      <aside id="j450TodoNote" class="j425-reading-rail j425-todo-reading" aria-label="選択したToDoの記録"><div class="j425-notebook-holes" aria-hidden="true"></div><div class="j450-todo-note-heading"><h3>ToDoノート</h3><button type="button" class="j450-todo-back" data-j450-todo-back>← 一覧へ戻る</button></div>${note}</aside>
    </div></div>`;
  const root=elements.todoView;
  journalPositionSelectedReaderV491('todo');
  root.querySelector('[data-j425-todo-create]')?.addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,inp=form.querySelector('#todayTodoInput'),memo=form.querySelector('#todayTodoMemo');const result=await createTodo(inp.value,memo?.value||'');
    if(result?.ok){inp.value='';if(memo)memo.value='';inp.focus();}else if(result?.ok===false && result.error!=='invalid-input')showWriteFailure(result,'ToDoを追加できませんでした。');
  });
  root.querySelectorAll('[data-j430-todo-fold]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.j430TodoFold;
    journalTodoCollapsedV430.has(id)?journalTodoCollapsedV430.delete(id):journalTodoCollapsedV430.add(id);
    const section=b.closest('.j425-todo-tray'),list=section?.querySelector('.j425-todo-items');
    section?.classList.toggle('is-collapsed',journalTodoCollapsedV430.has(id));
    if(list)list.hidden=journalTodoCollapsedV430.has(id);
    b.setAttribute('aria-expanded',String(!journalTodoCollapsedV430.has(id)));
    b.setAttribute('aria-label',section?.querySelector('h3')?.textContent+'を'+(journalTodoCollapsedV430.has(id)?'展開':'折りたたむ'));
    b.textContent=journalTodoCollapsedV430.has(id)?'開く':'閉じる';
    journalPositionSelectedReaderV491('todo');
  }));
  root.querySelectorAll('[data-j425-todo-filter]').forEach(b=>b.addEventListener('click',()=>{journalTodoFilterV425=b.dataset.j425TodoFilter;journalTodoV425()}));
  root.querySelector('[data-j425-todo-sort]')?.addEventListener('change',e=>{journalTodoSortV425=e.target.value;journalTodoV425()});
  root.querySelectorAll('[data-j425-todo-toggle]').forEach(b=>b.addEventListener('change',()=>toggleTodo(b.dataset.j425TodoToggle)));
  root.querySelectorAll('[data-j425-todo-select]').forEach(b=>b.addEventListener('click',()=>{journalTodoSelectedV425=b.dataset.j425TodoSelect;journalTodoInlineSelectedV491=journalTodoSelectedV425;journalTodoV425();journalTodoFocusV450(journalTodoSelectedV425)}));
  root.querySelector('[data-j450-todo-back]')?.addEventListener('click',()=>{
    const button=[...elements.todoView.querySelectorAll('[data-j425-todo-select]')].find(el=>el.dataset.j425TodoSelect===journalTodoSelectedV425);
    if(!button)return;
    const list=button.closest('.j425-todo-items');
    if(journalInlineDetailMediaV491.matches){journalTodoInlineSelectedV491='';journalPositionSelectedReaderV491('todo');}
    if(list?.hidden)button.closest('.j425-todo-tray')?.querySelector('[data-j430-todo-fold]')?.click();
    button.focus({preventScroll:true});
    button.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});
  });
  root.querySelectorAll('[data-j425-todo-move]').forEach(b=>b.addEventListener('click',()=>reorderTodo(b.dataset.j425TodoMove,Number(b.dataset.direction),b.dataset.segment)));
  root.querySelector('[data-j425-todo-edit]')?.addEventListener('submit',async e=>{e.preventDefault();if(!journalTodoSelectedV425)return;const f=e.currentTarget;await updateTodoDetails(journalTodoSelectedV425,f.elements.title.value,f.elements.memo.value)});
  root.querySelector('[data-j425-todo-promote]')?.addEventListener('click',()=>{const t=visibleTodos().find(x=>x.id===journalTodoSelectedV425);if(t)promoteTodo(t)});
  root.querySelector('[data-j425-todo-delete]')?.addEventListener('click',()=>deleteTodo(journalTodoSelectedV425));
  const search=root.querySelector('[data-j425-todo-search]');
  if(search){
    let composing=false;
    const apply=()=>{journalTodoQueryV425=search.value;const cursor=search.selectionStart??search.value.length;journalTodoV425();requestAnimationFrame(()=>{const n=elements.todoView.querySelector('[data-j425-todo-search]');if(n){n.focus({preventScroll:true});try{n.setSelectionRange(cursor,cursor)}catch{}}})};
    search.addEventListener('compositionstart',()=>composing=true);search.addEventListener('compositionend',()=>{composing=false;apply()});search.addEventListener('input',e=>{if(!composing&&!e.isComposing)apply()});
  }
}

let classicTodoRenderedPage = null;
let classicTodoRenderedSignature = '';

// Classic keeps unsaved edits in page memory only. No draft is written into
// Firebase or localStorage, and the server remains the canonical data source.
let classicTodoCommittedEditIds = new Set();
let classicTodoRecoveryDrafts = new Map();
let classicTodoRecoveryOwner = '';
// Short-lived in-page snapshots keyed by room and user. No new storage keys,
// observers or Firebase writes: leaving and returning use the same draft logic
// as canonical ToDo redraws.
const classicTodoNavigationDrafts = new Map();
// Only transient search text is retained per room/user. Do not persist it to
// Firebase, localStorage, or sessionStorage, and never share another user's filter.
const classicTodoSearchQueriesByOwner = new Map();
let classicTodoSearchActiveOwnerKey = '';
// A WeakMap avoids holding onto detached ToDo pages after canonical redraws.
// Clicking a navigation button blurs the editor before renderCore() captures it.
const classicTodoBlurredFocus = new WeakMap();
function trackClassicTodoEditorBlur(event) {
  const page = event.currentTarget;
  const field = event.target;
  if (!field?.matches?.('.todo-detail input, .todo-detail textarea, #todayTodoInput, #todayTodoMemo, .todo-search-input-v145')) return;
  const next = event.relatedTarget;
  // A normal move to another editor/action within ToDo is not a navigation
  // return anchor. Page-local layout jump buttons are exceptions.
  if (next && page.contains(next) && !next.closest?.('[data-layout-jump]')) {
    classicTodoBlurredFocus.delete(page);
    return;
  }
  const row = field.closest('.todo-item[data-todo-id]');
  classicTodoBlurredFocus.set(page, {
    ...(row ? { id: row.dataset.todoId, field: field.matches('textarea') ? 'memo' : 'text' }
      : { field: field.matches('.todo-search-input-v145') ? 'search' : field.id }),
    start: field.selectionStart,
    end: field.selectionEnd,
    top: field.getBoundingClientRect().top
  });
}
function classicTodoNavigationKey(owner) {
  return ROOM_ID + ':' + String(owner || '');
}
// Keep just the nearby visible IDs, not the entire long list. If another
// device deletes the current row, the next survivor takes priority.
function captureClassicTodoListAnchor(page) {
  if (!page) return null;
  const rows = [...page.querySelectorAll('.todo-list .todo-item[data-todo-id]')]
    .filter(row => !row.hidden && !row.closest('.todo-list')?.hidden && row.getClientRects().length);
  const index = rows.findIndex(row => {
    const rect = row.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  });
  if (index < 0) return null;
  return {
    id: rows[index].dataset.todoId,
    top: rows[index].getBoundingClientRect().top,
    // Bounded neighboring IDs cover ordinary edits. Progress gives a
    // deterministic fallback if a large batch removes all 101 known rows.
    progress: rows.length > 1 ? index / (rows.length - 1) : 0,
    nextIds: rows.slice(index + 1, index + 51).map(row => row.dataset.todoId),
    previousIds: rows.slice(Math.max(0, index - 50), index).reverse().map(row => row.dataset.todoId)
  };
}
function restoreClassicTodoListAnchor(page, anchor) {
  if (!anchor) {
    // Zero-result searches have no row anchor. Show the existing reset action
    // instead of restoring an unrelated list position.
    const reset = page.querySelector('.todo-search-empty-v145:not([hidden]) .todo-search-reset-v145');
    if (reset?.getClientRects().length) reset.scrollIntoView({ block: 'nearest' });
    return;
  }
  const rows = [...page.querySelectorAll('.todo-list .todo-item[data-todo-id]')]
    .filter(row => !row.hidden && !row.closest('.todo-list')?.hidden && row.getClientRects().length);
  const byId = new Map(rows.map(row => [row.dataset.todoId, row]));
  const candidates = [anchor.id, ...(anchor.nextIds || []), ...(anchor.previousIds || [])];
  const survivingNeighbor = candidates.map(id => byId.get(id)).find(Boolean);
  // Large imports or remote batch deletions may remove the anchor plus every
  // nearby ID. Approximate the same relative reading position in the new list
  // instead of reusing a stale raw scrollTop. No new persistence is required.
  const progress = Number.isFinite(anchor.progress)
    ? Math.max(0, Math.min(1, anchor.progress)) : null;
  const target = survivingNeighbor || (rows.length && progress !== null
    ? rows[Math.round(progress * (rows.length - 1))] : null);
  if (target && Number.isFinite(anchor.top)) {
    alignClassicTodoElementAtViewportPosition(target, anchor.top);
    return;
  }
  // With no matching rows, preserve the query and expose the reset control.
  const reset = page.querySelector('.todo-search-empty-v145:not([hidden]) .todo-search-reset-v145');
  if (reset?.getClientRects().length) reset.scrollIntoView({ block: 'nearest' });
}
function rememberClassicTodoNavigationDraft() {
  if (document.documentElement.dataset.wbDisplay !== 'classic') return;
  const page = elements.todoView?.querySelector('.todo-page');
  const owner = page?.dataset.todoOwner;
  if (!page || !owner) return;
  const snapshot = captureClassicTodoDraftState(page, { departing: true });
  if (!snapshot) return;
  // Both main and page may scroll depending on the viewport and layout.
  snapshot.scrollMain = elements.mainContent?.scrollTop || 0;
  snapshot.scrollDocument = document.scrollingElement?.scrollTop || 0;
  snapshot.searchQuery = page.querySelector('.todo-search-input-v145')?.value
    ?? window.WorkBoardTodoSearchBridgeV393?.getQuery?.() ?? '';
  // Keep the same reader position when data changes on another device.
  snapshot.listAnchor = captureClassicTodoListAnchor(page);
  snapshot.roomId = ROOM_ID;
  snapshot.owner = owner;
  snapshot.recoveryDrafts = classicTodoRecoveryOwner === owner
    ? [...classicTodoRecoveryDrafts.entries()] : [];
  const ownerKey = classicTodoNavigationKey(owner);
  classicTodoNavigationDrafts.set(ownerKey, snapshot);
  classicTodoSearchQueriesByOwner.set(ownerKey, snapshot.searchQuery);
}

function captureClassicTodoDraftState(page, { departing = false } = {}) {
  if (!page) return null;
  const drafts = [];
  page.querySelectorAll('.todo-item[data-todo-id]').forEach(row => {
    if (classicTodoCommittedEditIds.has(row.dataset.todoId)) return;
    const title = row.querySelector('.todo-detail input');
    const memo = row.querySelector('.todo-detail textarea');
    if (!title || !memo || (title.value === row.dataset.todoEditBaseText
      && memo.value === row.dataset.todoEditBaseMemo)) return;
    drafts.push({
      id: row.dataset.todoId,
      text: title.value,
      memo: memo.value,
      baseRevision: Number(row.dataset.todoEditBaseRevision),
      baseText: row.dataset.todoEditBaseText || '',
      baseMemo: row.dataset.todoEditBaseMemo || '',
      expanded: !row.querySelector('.todo-detail')?.hidden,
      compareOpen: Boolean(row.querySelector('.todo-edit-compare-v529')?.open),
      comparedVersion: row.dataset.todoEditComparedVersion || '',
      resolveText: row.querySelector('[data-todo-resolve-field="text"]')?.value || '',
      resolveMemo: row.querySelector('[data-todo-resolve-field="memo"]')?.value || ''
    });
  });
  const active = document.activeElement;
  let focus = null;
  if (active && page.contains(active)) {
    const row = active.closest?.('.todo-item[data-todo-id]');
    if (row && active.matches('.todo-detail input, .todo-detail textarea')) {
      focus = { id: row.dataset.todoId,
        field: active.matches('textarea') ? 'memo' : 'text' };
    } else if (active.id === 'todayTodoInput' || active.id === 'todayTodoMemo') {
      focus = { field: active.id };
    } else if (active.matches('.todo-search-input-v145')) {
      focus = { field: 'search' };
    }
    if (focus) {
      focus.start = active.selectionStart;
      focus.end = active.selectionEnd;
      focus.top = active.getBoundingClientRect().top;
    }
  }
  // The current focus is often the sidebar button by the time we capture.
  // Use the editor's last blur only for deliberate layout/user navigation;
  // ordinary Firebase redraws must not steal focus from unrelated controls.
  if (!focus && departing) focus = classicTodoBlurredFocus.get(page) || null;
  return {
    drafts,
    focus,
    newText: page.querySelector('#todayTodoInput')?.value || '',
    newMemo: page.querySelector('#todayTodoMemo')?.value || '',
    composeOpen: Boolean(page.querySelector('.todo-compose-details')?.open),
    scrollTop: document.scrollingElement?.scrollTop || 0
  };
}

function showClassicTodoEditConflict(row, latest) {
  if (row.querySelector('.todo-edit-conflict-v527')) return;
  const detail = row.querySelector('.todo-detail');
  const save = row.querySelector('.todo-detail-save');
  const title = row.querySelector('.todo-detail input');
  const memo = row.querySelector('.todo-detail textarea');
  if (!detail || !save || !title || !memo) return;
  row.dataset.todoEditConflict = 'true';
  row.dataset.todoEditComparedVersion = JSON.stringify([
    latest.revision, latest.text, latest.memo || ''
  ]);
  save.disabled = true;

  const alert = document.createElement('div');
  alert.className = 'todo-edit-conflict-v527';
  alert.setAttribute('role', 'status');
  const headline = document.createElement('strong');
  headline.textContent = '別の操作で更新されています';
  const message = document.createElement('p');
  message.textContent = '入力中の内容は残っています。最新内容と比較してから編集し直してください。古い改訂番号での保存や自動結合は行いません。';

  const compare = document.createElement('details');
  compare.className = 'todo-edit-compare-v529';
  const summary = document.createElement('summary');
  summary.textContent = '自分の下書きと共有の最新内容を比較';
  const grid = document.createElement('div');
  grid.className = 'todo-edit-compare-columns-v529';
  const column = (label, kind) => {
    const panel = document.createElement('section');
    panel.className = 'todo-edit-version-v529 todo-edit-' + kind + '-v529';
    if (kind === 'latest') panel.classList.add('todo-edit-latest-v527');
    panel.setAttribute('aria-label', label);
    const heading = document.createElement('h6');
    heading.textContent = label;
    const titleLabel = document.createElement('small');
    titleLabel.textContent = 'やること';
    const titleText = document.createElement('p');
    titleText.className = 'todo-edit-compare-title-v529';
    const memoLabel = document.createElement('small');
    memoLabel.textContent = 'メモ';
    const memoText = document.createElement('p');
    memoText.className = 'todo-edit-compare-memo-v529';
    panel.append(heading, titleLabel, titleText, memoLabel, memoText);
    return { panel, titleText, memoText };
  };
  const mine = column('自分の下書き（未保存）', 'mine');
  const remote = column('共有の最新内容', 'latest');
  grid.append(mine.panel, remote.panel);
  const differences = document.createElement('p');
  differences.className = 'todo-edit-differences-v529';
  differences.setAttribute('aria-live', 'polite');
  let refreshSelectionPreview = () => {};
  // The local editor remains editable, but Save is blocked until the user
  // explicitly chooses the latest baseline. No implicit merge or write.
  const differenceLabel = (draft, base, server) => {
    if (draft === server) return '同じ内容';
    if (draft !== base && server !== base) return '両方が変更';
    if (server !== base) return '共有側が変更';
    if (draft !== base) return '自分だけ変更';
    return '差分あり';
  };
  const refreshComparison = () => {
    const current = state.todoRaw[row.dataset.todoId] || latest;
    mine.titleText.textContent = title.value || '（空欄）';
    mine.memoText.textContent = memo.value || '（なし）';
    remote.titleText.textContent = current.text || '（空欄）';
    remote.memoText.textContent = current.memo || '（なし）';
    differences.textContent = 'やること：' +
      differenceLabel(title.value.trim(), row.dataset.todoEditBaseText || '', current.text) +
      '　／　メモ：' +
      differenceLabel(memo.value.trim(), row.dataset.todoEditBaseMemo || '', current.memo || '');
    refreshSelectionPreview();
  };
  title.addEventListener('input', refreshComparison);
  memo.addEventListener('input', refreshComparison);
  refreshComparison();
  compare.append(summary, differences, grid);

  // Selection only revises the local form; it must never write to Firebase.
  // For differing fields the user must make an explicit choice. Identical
  // fields may safely preselect the local value without losing information.
  const resolution = document.createElement('section');
  resolution.className = 'todo-edit-resolution-v530';
  resolution.setAttribute('aria-label', '項目ごとに取り込む内容を選択');
  const resolutionHeading = document.createElement('h6');
  resolutionHeading.textContent = '編集に使う内容を選ぶ';
  const resolutionHelp = document.createElement('p');
  resolutionHelp.textContent = '件名とメモを別々に選択できます。ここでは共有データを保存しません。選択後に内容を確認して、通常の「内容を保存」で確定してください。';
  const choices = document.createElement('div');
  choices.className = 'todo-edit-resolution-choices-v530';
  const createChoice = (field, label, localValue, remoteValue) => {
    const holder = document.createElement('label');
    holder.className = 'todo-edit-resolution-field-v530';
    const caption = document.createElement('span');
    caption.textContent = label;
    const select = document.createElement('select');
    select.dataset.todoResolveField = field;
    select.className = 'todo-edit-resolution-select-v530';
    for (const [value, name] of [
      ['', '取り込む内容を選択'],
      ['mine', '自分の下書き'],
      ['latest', '共有の最新内容']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      select.appendChild(option);
    }
    select.value = localValue === remoteValue ? 'mine' : '';
    holder.append(caption, select);
    choices.appendChild(holder);
    return select;
  };
  const titleChoice = createChoice('text', 'やること', title.value.trim(), latest.text);
  const memoChoice = createChoice('memo', 'メモ', memo.value.trim(), latest.memo || '');
  const preview = document.createElement('div');
  preview.className = 'todo-edit-resolution-preview-v530';
  preview.setAttribute('aria-live', 'polite');
  const previewText = document.createElement('p');
  previewText.className = 'todo-edit-preview-text-v530';
  const previewMemo = document.createElement('p');
  previewMemo.className = 'todo-edit-preview-memo-v530';
  preview.append(previewText, previewMemo);
  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'ghost-button todo-edit-resume-v530';
  resume.textContent = '選択した内容で編集を再開';
  resume.disabled = true;
  const selectedValue = (choice, draft, remote) =>
    choice.value === 'mine' ? draft : (choice.value === 'latest' ? remote : null);
  refreshSelectionPreview = () => {
    const current = state.todoRaw[row.dataset.todoId] || latest;
    const textValue = selectedValue(titleChoice, title.value, current.text);
    const memoValue = selectedValue(memoChoice, memo.value, current.memo || '');
    previewText.textContent = 'やること：' + (textValue === null ? '未選択' : textValue || '（空欄）');
    previewMemo.textContent = 'メモ：' + (memoValue === null ? '未選択' : memoValue || '（なし）');
    resume.disabled = textValue === null || memoValue === null
      || !textValue.trim() || textValue.length > TODO_MAX_LENGTH
      || memoValue.length > TODO_MEMO_MAX_LENGTH;
  };
  titleChoice.addEventListener('change', refreshSelectionPreview);
  memoChoice.addEventListener('change', refreshSelectionPreview);
  refreshSelectionPreview();
  resolution.append(resolutionHeading, resolutionHelp, choices, preview, resume);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'ghost-button todo-edit-copy-v529';
  copy.textContent = '自分の下書きをコピー';
  copy.addEventListener('click', async () => {
    const content = 'やること：' + title.value + '\nメモ：\n' + memo.value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(content);
      toast('下書きをコピーしました');
    } catch {
      // Some browser/privacy settings prohibit clipboard access. Show an
      // explicitly selectable text area instead of losing the recovery path.
      let fallback = alert.querySelector('.todo-edit-copy-fallback-v529');
      if (!fallback) {
        fallback = document.createElement('textarea');
        fallback.className = 'todo-edit-copy-fallback-v529';
        fallback.readOnly = true;
        fallback.rows = 5;
        fallback.setAttribute('aria-label', '手動コピーする下書き');
        alert.appendChild(fallback);
      }
      fallback.value = content;
      fallback.focus();
      fallback.select();
      toast('下書きを選択しました。コピーして保管してください。');
    }
  });

  const applySelectedRevision = (current, nextText, nextMemo) => {
    // A successful rebase changes only the local editor baseline, and existing
    // optimistic-concurrency checks still protect the eventual save.
    title.value = nextText;
    memo.value = nextMemo;
    row.dataset.todoEditBaseText = current.text;
    row.dataset.todoEditBaseMemo = current.memo || '';
    row.dataset.todoEditBaseRevision = String(current.revision);
    delete row.dataset.todoEditConflict;
    delete row.dataset.todoEditComparedVersion;
    if (nextText.trim() !== current.text || nextMemo.trim() !== (current.memo || '')) {
      row.dataset.todoDraftDirtyV527 = 'true';
    } else {
      delete row.dataset.todoDraftDirtyV527;
    }
    save.disabled = false;
    title.removeEventListener('input', refreshComparison);
    memo.removeEventListener('input', refreshComparison);
    alert.remove();
    title.dispatchEvent(new Event('input', { bubbles: true }));
    title.focus({ preventScroll: true });
  };
  resume.addEventListener('click', () => {
    const current = state.todoRaw[row.dataset.todoId];
    if (!row.isConnected || !current || current.owner !== normalizeUser(getCurrentUser())) {
      toast('元のToDoが見つかりません。下書きをコピーしてください。', true);
      return;
    }
    // Do not rebase to a revision that changed after the user reviewed the
    // comparison. Require a fresh review instead of silently picking new text.
    if (Number(current.revision) !== Number(latest.revision)
      || current.text !== latest.text || (current.memo || '') !== (latest.memo || '')) {
      toast('共有データが再度変更されました。最新内容を確認してください。', true);
      render();
      return;
    }
    const nextText = selectedValue(titleChoice, title.value, current.text);
    const nextMemo = selectedValue(memoChoice, memo.value, current.memo || '');
    if (nextText === null || nextMemo === null || !nextText.trim()
      || nextText.length > TODO_MAX_LENGTH || nextMemo.length > TODO_MEMO_MAX_LENGTH) return;
    const fieldName = choice => choice.value === 'mine' ? '自分の下書き' : '共有の最新内容';
    const confirmed = window.confirm('やること：' + fieldName(titleChoice)
      + '\nメモ：' + fieldName(memoChoice)
      + '\nこの組み合わせで編集を再開しますか？'
      + '\nこの操作ではまだ共有データを保存しません。');
    if (!confirmed) return;
    applySelectedRevision(current, nextText, nextMemo);
  });

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'ghost-button todo-edit-reload-v527';
  reload.textContent = '最新の内容で編集し直す';
  reload.addEventListener('click', () => {
    if (!window.confirm('現在入力中の未保存内容を破棄して、最新の内容を読み込みますか？')) return;
    const current = state.todoRaw[row.dataset.todoId];
    if (!current || current.owner !== normalizeUser(getCurrentUser())) {
      toast('元のToDoは表示できません。入力内容をコピーしてください。', true);
      return;
    }
    applySelectedRevision(current, current.text, current.memo || '');
  });
  const actions = document.createElement('div');
  actions.className = 'todo-edit-conflict-actions-v529';
  actions.append(copy, reload);
  alert.append(headline, message, compare, resolution, actions);
  detail.appendChild(alert);
}

function restoreClassicTodoDraftState(page, snapshot, { fromNavigation = false, preserveSearchViewport = false } = {}) {
  if (!page) return;
  const owner = normalizeUser(getCurrentUser());
  if (classicTodoRecoveryOwner !== owner) {
    classicTodoRecoveryDrafts.clear();
    classicTodoRecoveryOwner = owner;
  }
  if (snapshot) {
    const title = page.querySelector('#todayTodoInput');
    const memo = page.querySelector('#todayTodoMemo');
    if (title) title.value = snapshot.newText;
    if (memo) memo.value = snapshot.newMemo;
    const details = page.querySelector('.todo-compose-details');
    if (details) details.open = snapshot.composeOpen;
  }

  // Previously disappeared drafts remain recoverable while this user stays
  // in the current tab. If an item reappears, move its draft back to the row.
  const drafts = new Map(classicTodoRecoveryDrafts);
  for (const [id, draft] of snapshot?.recoveryDrafts || []) drafts.set(id, draft);
  for (const draft of snapshot?.drafts || []) drafts.set(draft.id, draft);
  const recovery = new Map();
  for (const [id, draft] of drafts) {
    const row = page.querySelector('.todo-item[data-todo-id="' + cssEscape(id) + '"]');
    const current = state.todoRaw[id];
    if (!row || !current || current.owner !== owner) {
      recovery.set(id, draft);
      continue;
    }
    const title = row.querySelector('.todo-detail input');
    const memo = row.querySelector('.todo-detail textarea');
    const detail = row.querySelector('.todo-detail');
    if (!title || !memo || !detail) continue;
    // If the draft already equals the newly committed state, use the
    // canonical values and revision rather than presenting a false conflict.
    if (draft.text.trim() === current.text && draft.memo.trim() === (current.memo || '')) continue;
    title.value = draft.text;
    memo.value = draft.memo;
    row.dataset.todoEditBaseRevision = String(draft.baseRevision);
    row.dataset.todoEditBaseText = draft.baseText;
    row.dataset.todoEditBaseMemo = draft.baseMemo;
    row.dataset.todoDraftDirtyV527 = 'true';
    const expanded = draft.expanded || Number(draft.baseRevision) !== Number(current.revision);
    detail.hidden = !expanded;
    row.classList.toggle('is-expanded', expanded);
    row.querySelector('.todo-summary-button')?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const chevron = row.querySelector('.todo-chevron');
    if (chevron) chevron.textContent = expanded ? '⌃' : '⌄';
    if (expanded) state.expandedTodoIds.add(id);
    else state.expandedTodoIds.delete(id);
    if (Number(draft.baseRevision) !== Number(current.revision)
      || draft.baseText !== current.text || draft.baseMemo !== (current.memo || '')) {
      showClassicTodoEditConflict(row, current);
      const compare = row.querySelector('.todo-edit-compare-v529');
      if (compare && draft.compareOpen) compare.open = true;
      // Preserve decisions across unrelated subscribed data changes. A change
      // to this ToDo's latest revision invalidates previous choices.
      const latestVersion = JSON.stringify([
        current.revision, current.text, current.memo || ''
      ]);
      if (draft.comparedVersion && draft.comparedVersion === latestVersion) {
        for (const [field, value] of [['text', draft.resolveText], ['memo', draft.resolveMemo]]) {
          const select = row.querySelector('[data-todo-resolve-field="' + field + '"]');
          if (select && ['mine', 'latest'].includes(value)) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }
    }
  }
  classicTodoRecoveryDrafts = recovery;
  if (recovery.size) {
    const block = document.createElement('section');
    block.className = 'todo-draft-recovery-v527';
    block.setAttribute('aria-label', '一覧から移動・削除されたToDoの下書き');
    const heading = document.createElement('h5');
    heading.textContent = '一覧から移動・削除されたToDoの未保存内容';
    block.appendChild(heading);
    for (const [id, draft] of recovery) {
      const item = document.createElement('article');
      const note = document.createElement('p');
      note.textContent = '対象のToDoは現在の一覧にありません。下書きをコピーして保管してください。';
      const saved = document.createElement('textarea');
      saved.readOnly = true;
      saved.rows = 5;
      saved.value = 'やること：' + draft.text + '\nメモ：\n' + draft.memo;
      saved.setAttribute('aria-label', '回収用の未保存ToDo');
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'ghost-button';
      copy.textContent = '入力内容をコピー';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(saved.value);
          toast('下書きをコピーしました');
        } catch (_) {
          saved.focus();
          saved.select();
          toast('文章を選択しました。コピーして保存してください。');
        }
      });
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'ghost-button';
      dismiss.textContent = '下書きを閉じる';
      dismiss.addEventListener('click', () => {
        if (!window.confirm('この下書きを画面から消しますか？')) return;
        classicTodoRecoveryDrafts.delete(id);
        item.remove();
        if (!block.querySelector('article')) block.remove();
      });
      item.append(note, saved, copy, dismiss);
      block.appendChild(item);
    }
    page.querySelector('.todo-workspace')?.appendChild(block);
  }

  const focus = snapshot?.focus;
  if (focus) requestAnimationFrame(() => {
    const active = document.activeElement;
    const navigationControl = fromNavigation && (
      active?.matches?.('.nav-item[data-layout="todos"], #currentUserSelect')
      || active?.closest?.('[data-layout-jump="todos"], [data-open-todo]')
    );
    if (state.layout !== 'todos' || document.documentElement.dataset.wbDisplay !== 'classic'
      || elements.todoView?.querySelector('.todo-page') !== page
      || (![document.body, document.documentElement].includes(active) && !navigationControl)) return;
    const field = focus.id
      ? page.querySelector('.todo-item[data-todo-id="' + cssEscape(focus.id) + '"] .todo-detail '
          + (focus.field === 'memo' ? 'textarea' : 'input'))
      : (focus.field === 'search'
        ? page.querySelector('.todo-search-input-v145')
        : page.querySelector('#' + focus.field));
    if (!field || !field.getClientRects().length) return;
    // When an item was deleted, the list/recovery reset already owns the
    // viewport. Restore the search caret without undoing the row alignment.
    if (preserveSearchViewport && focus.field === 'search') {
      field.focus({ preventScroll: true });
    } else if (!focusClassicTodoActionAtViewportPosition(field, focus.top)) return;
    if (focus.start != null && focus.end != null) {
      field.setSelectionRange(focus.start, focus.end);
    }
  });
}

function renderTodoView() {
  if(typeof document!=='undefined' && document.documentElement?.dataset?.wbDisplay==='journal') return journalTodoV425();
  // Other collection subscriptions also call renderCore(). Reuse the Classic
  // ToDo DOM when its own canonical data and write state are unchanged, so a
  // background task/schedule update cannot erase an unsaved ToDo draft.
  const isClassicTodo = document.documentElement?.dataset?.wbDisplay === 'classic';
  const signature = isClassicTodo ? JSON.stringify([
    ROOM_ID, normalizeUser(getCurrentUser()), todayISO(),
    todoDataSignature(state.todoRaw, normalizeUser(getCurrentUser())),
    [...state.inFlightOperations.keys()].filter(key => key.startsWith('todo-')).sort()
  ]) : '';
  const currentPage = elements.todoView?.querySelector('.todo-page');
  if (isClassicTodo && currentPage && currentPage === classicTodoRenderedPage
    && signature === classicTodoRenderedSignature) return;
  const currentOwner = isClassicTodo ? normalizeUser(getCurrentUser()) : '';
  const navigationKey = isClassicTodo ? classicTodoNavigationKey(currentOwner) : '';
  const switchingClassicTodoOwner = isClassicTodo && Boolean(currentPage?.dataset.todoOwner)
    && currentPage.dataset.todoOwner !== currentOwner;
  if (isClassicTodo && classicTodoSearchActiveOwnerKey !== navigationKey) {
    // A shared ToDo search bridge must never carry the previous user's query
    // into a newly selected account, including when switching outside ToDo.
    // The previous owner's snapshot was saved before the account changed.
    classicTodoSearchActiveOwnerKey = navigationKey;
    const ownerQuery = classicTodoNavigationDrafts.get(navigationKey)?.searchQuery
      ?? classicTodoSearchQueriesByOwner.get(navigationKey) ?? '';
    window.WorkBoardTodoSearchBridgeV393?.setQuery?.(ownerQuery);
  }
  const navigationDraft = isClassicTodo
    ? classicTodoNavigationDrafts.get(navigationKey) : null;
  const previousDraftState = isClassicTodo && currentPage
    && currentPage.dataset.todoOwner === currentOwner
    ? captureClassicTodoDraftState(currentPage)
    : (navigationDraft?.owner === currentOwner && navigationDraft?.roomId === ROOM_ID
      ? navigationDraft : null);
  // Direct saves and user navigation already own their focus restoration.
  // Capture this anchor only for subscribed updates to the current user's list.
  const subscribedListAnchor = isClassicTodo && journalSubscribedRenderV528
    && currentPage?.dataset.todoOwner === currentOwner && !elements.todoView.hidden
    ? captureClassicTodoListAnchor(currentPage) : null;
  classicTodoCommittedEditIds.clear();
  // Snapshot search focus before canonical rendering replaces the search sidecar.
  // Only restore an actively focused search, never steal focus from a ToDo editor.
  const previousSearch = elements.todoView?.querySelector('.todo-search-input-v145');
  // A focused search in the departing user's page is never the new user's
  // redraw anchor. Navigation snapshots already restore each owner's caret.
  const searchAnchor = previousSearch && !switchingClassicTodoOwner
    && document.activeElement === previousSearch
    ? { start: previousSearch.selectionStart, end: previousSearch.selectionEnd,
        top: previousSearch.getBoundingClientRect().top }
    : null;
  const todos = visibleTodos();
  const open = todos.filter(todo => !todo.completed);
  const completed = todos.filter(todo => todo.completed);
  const memoCount = todos.filter(todo => String(todo.memo || '').trim()).length;

  elements.todoView.innerHTML = `
    <section class="todo-page">
      <header class="todo-page-head">
        <div>
          <span class="todo-section-label">PERSONAL TODO</span>
          <h3>ToDo・個人メモ</h3>
          <p>タスクほど重くない個人用のやることをまとめる専用ページです。詳細メモや並び替え、タスク化もここで行えます。</p>
        </div>
        <div class="todo-page-actions">
          <button class="ghost-button" type="button" data-layout-jump="today">今日ビューに戻る</button>
          <button class="primary-button" type="button" data-layout-jump="tasks">正式タスクを見る</button>
        </div>
      </header>
      <section class="todo-page-stats" aria-label="ToDoの件数サマリー">
        <article class="todo-page-stat-card">
          <small>未完了</small>
          <strong>${open.length}件</strong>
          <span>今日動かす個人ToDo</span>
        </article>
        <article class="todo-page-stat-card">
          <small>本日完了</small>
          <strong>${completed.length}件</strong>
          <span>完了済みの控え</span>
        </article>
        <article class="todo-page-stat-card">
          <small>メモあり</small>
          <strong>${memoCount}件</strong>
          <span>詳細メモを付けたToDo</span>
        </article>
      </section>
      <section class="today-todos todo-workspace" aria-labelledby="todoWorkspaceTitle">
        <div class="today-todos-head todo-workspace-head">
          <div>
            <h4 id="todoWorkspaceTitle">ToDoを追加する</h4>
            <p>簡単なやることはタイトルだけで追加できます。必要ならメモも残せます。</p>
          </div>
          <span class="todo-section-chip">現在のユーザーごとに表示</span>
        </div>
        <form class="todo-create-form" data-todo-form>
          <div class="todo-compose-main">
            <label class="todo-input-stack">
              <span>やること</span>
              <input id="todayTodoInput" maxlength="${TODO_MAX_LENGTH}" autocomplete="off" placeholder="例：備品を確認する" />
            </label>
            <button class="primary-button todo-add-button" type="submit" data-operation-key="todo-create:form">＋ 追加</button>
          </div>
          <details class="todo-compose-details">
            <summary>＋ メモを追加（任意）</summary>
            <label class="todo-input-stack" for="todayTodoMemo">
              <span>メモ</span>
              <textarea id="todayTodoMemo" maxlength="${TODO_MEMO_MAX_LENGTH}" rows="3" placeholder="補足、確認先、注意点など"></textarea>
            </label>
          </details>
        </form>
        <p class="todo-privacy-note">認証による非公開ではありませんが、現在のユーザーごとに表示を分けています。</p>
        <div class="todo-lists" data-todo-lists></div>
      </section>
    </section>
  `;

  bindTodoWorkspace(elements.todoView);
  if (isClassicTodo) {
    classicTodoRenderedPage = elements.todoView?.querySelector('.todo-page');
    classicTodoRenderedPage.dataset.todoOwner = normalizeUser(getCurrentUser());
    classicTodoRenderedPage.addEventListener('focusout', trackClassicTodoEditorBlur);
    classicTodoRenderedSignature = signature;
    const fromNavigation = Boolean(navigationDraft && previousDraftState === navigationDraft);
    if (fromNavigation) {
      classicTodoNavigationDrafts.delete(navigationKey);
      // The search sidecar owns the query. Restore via its existing bridge
      // instead of creating a second filter state or persistent storage.
      const searchBridge = window.WorkBoardTodoSearchBridgeV393;
      if (searchBridge?.getQuery?.() !== navigationDraft.searchQuery) {
        searchBridge?.setQuery?.(navigationDraft.searchQuery ?? '');
      }
      classicTodoSearchQueriesByOwner.set(navigationKey, navigationDraft.searchQuery ?? '');
      const restoredPage = classicTodoRenderedPage;
      // MutationObserver adopts the ToDo search/filter before this frame.
      // Restore scroll, then align the same visible item even when a remote
      // update inserted or removed rows while another menu was open.
      requestAnimationFrame(() => {
        if (state.layout !== 'todos' || document.documentElement.dataset.wbDisplay !== 'classic'
          || elements.todoView?.querySelector('.todo-page') !== restoredPage
          || normalizeUser(getCurrentUser()) !== navigationDraft.owner) return;
        if (elements.mainContent) elements.mainContent.scrollTop = navigationDraft.scrollMain;
        if (document.scrollingElement) document.scrollingElement.scrollTop = navigationDraft.scrollDocument;
        restoreClassicTodoListAnchor(restoredPage, navigationDraft.listAnchor);
      });
    } else if (subscribedListAnchor) {
      const updatedPage = classicTodoRenderedPage;
      requestAnimationFrame(() => {
        if (state.layout !== 'todos' || document.documentElement.dataset.wbDisplay !== 'classic'
          || elements.todoView?.querySelector('.todo-page') !== updatedPage
          || normalizeUser(getCurrentUser()) !== currentOwner) return;
        restoreClassicTodoListAnchor(updatedPage, subscribedListAnchor);
      });
    }
    if (switchingClassicTodoOwner && !fromNavigation) {
      // A first-time account has no saved viewport. Do not reuse the departing
      // account's scroller position, which may open this user's list mid-way.
      const initialPage = classicTodoRenderedPage;
      requestAnimationFrame(() => {
        if (state.layout !== 'todos' || document.documentElement.dataset.wbDisplay !== 'classic'
          || elements.todoView?.querySelector('.todo-page') !== initialPage
          || normalizeUser(getCurrentUser()) !== currentOwner) return;
        if (elements.mainContent) elements.mainContent.scrollTop = 0;
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      });
    }
    restoreClassicTodoDraftState(classicTodoRenderedPage, previousDraftState, {
      fromNavigation, preserveSearchViewport: fromNavigation || Boolean(subscribedListAnchor)
    });
  }
  if (searchAnchor) {
    // ToDo tools adopt the new .todo-page via a root MutationObserver.
    // The next frame runs after that adoption without introducing another observer.
    requestAnimationFrame(() => {
      if (state.layout !== 'todos' || document.documentElement.dataset.wbDisplay !== 'classic'
        || ![document.body, document.documentElement].includes(document.activeElement)) return;
      const search = elements.todoView?.querySelector('.todo-search-input-v145');
      if (!search || !search.getClientRects().length) return;
      // The subscribed list anchor is the scroll owner. Search still retains
      // its focus and selection, but must not reverse that position correction.
      if (!subscribedListAnchor) {
        const delta = search.getBoundingClientRect().top - searchAnchor.top;
        if (Math.abs(delta) > 1) {
          const scroller = document.scrollingElement || document.documentElement;
          scroller.scrollTop += delta;
        }
      }
      search.focus({ preventScroll: true });
      if (searchAnchor.start != null && searchAnchor.end != null) {
        search.setSelectionRange(searchAnchor.start, searchAnchor.end);
      }
    });
  }
  elements.todoView.querySelector("[data-layout-jump='today']")?.addEventListener('click', () => {
    state.layout = 'today';
    render();
  });
  elements.todoView.querySelector("[data-layout-jump='tasks']")?.addEventListener('click', () => {
    state.layout = 'tasks';
    render();
  });
}

// Keep the same visible action at the same viewport position after Classic's
// canonical ToDo redraw. Shared by detail save and completion transitions.
function alignClassicTodoElementAtViewportPosition(element, previousTop) {
  if (!element?.getClientRects().length) return false;
  const delta = element.getBoundingClientRect().top - previousTop;
  if (Math.abs(delta) > 1) {
    let scrollParent = element.parentElement;
    while (scrollParent && scrollParent !== document.documentElement) {
      const style = getComputedStyle(scrollParent);
      if (/auto|scroll/.test(style.overflowY)
        && scrollParent.scrollHeight > scrollParent.clientHeight + 1) break;
      scrollParent = scrollParent.parentElement;
    }
    const scroller = scrollParent || document.scrollingElement || document.documentElement;
    scroller.scrollTop += delta;
  }
  return true;
}

function focusClassicTodoActionAtViewportPosition(control, previousTop) {
  if (!control || control.disabled || !alignClassicTodoElementAtViewportPosition(control, previousTop)) return false;
  control.focus({ preventScroll: true });
  return true;
}

function bindTodoWorkspace(root = elements.todoView) {
  if (!root) return;
  const listRoot = root.querySelector('[data-todo-lists]');
  const form = root.querySelector('[data-todo-form]');
  const input = root.querySelector('#todayTodoInput');
  const memoInput = root.querySelector('#todayTodoMemo');
  const composeDetails = root.querySelector('.todo-compose-details');
  if (!listRoot || !form || !input || !memoInput) return;
  const todos = visibleTodos(); const open = todos.filter(todo => !todo.completed); const completed = todos.filter(todo => todo.completed);

  const buildActionButton = ({ label, action, className = '', disabled = false, title = '', ariaLabel = '', icon = '' }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `todo-action ${className}`.trim();
    button.disabled = disabled;
    button.dataset.todoAction = action;
    if (title) button.title = title;
    if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    if (icon) {
      const mark = document.createElement('span'); mark.className = 'todo-action-icon'; mark.setAttribute('aria-hidden', 'true'); mark.textContent = icon; button.append(mark);
    }
    if (label) { const text = document.createElement('span'); text.className = 'todo-action-label'; text.textContent = label; button.append(text); }
    return button;
  };

  const buildList = (items, label, done) => {
    const section = document.createElement('section'); section.className = `todo-list${done ? ' is-completed' : ''}`;
    const heading = document.createElement('div'); heading.className = 'todo-list-heading';
    const headingTitle = document.createElement('h5'); headingTitle.textContent = label;
    const count = document.createElement('span'); count.className = 'todo-count'; count.textContent = `${items.length}件`;
    heading.append(headingTitle, count); section.append(heading);
    if (!items.length) {
      const empty = document.createElement('p'); empty.className = 'todo-empty'; empty.textContent = done ? '本日完了したやることはありません。' : 'やることを追加するとここに表示されます。'; section.append(empty); return section;
    }
    const ul = document.createElement('ul'); ul.className = 'todo-items';
    items.forEach((todo, index) => {
      const busy = state.inFlightOperations.has(operationKey('todo-toggle', todo.id)) || state.inFlightOperations.has(operationKey('todo-delete', todo.id)) || state.inFlightOperations.has(operationKey('todo-reorder', todo.id)) || state.inFlightOperations.has(operationKey('todo-promote', todo.id)) || state.inFlightOperations.has(operationKey('todo-update', todo.id));
      const expanded = state.expandedTodoIds.has(todo.id);
      const row = document.createElement('li'); row.className = `todo-item${busy ? ' is-busy' : ''}${expanded ? ' is-expanded' : ''}`; row.dataset.todoId = todo.id; row.setAttribute('aria-busy', busy ? 'true' : 'false');
      // The editor's starting revision must not advance with a remote redraw.
      row.dataset.todoEditBaseRevision = String(todo.revision);
      row.dataset.todoEditBaseText = todo.text;
      row.dataset.todoEditBaseMemo = todo.memo || '';

      const dragHandle = document.createElement('span');
      dragHandle.className = 'todo-drag-handle-v531';
      dragHandle.textContent = '⠿';
      dragHandle.title = 'PCではここをドラッグして並べ替え（スマホは▲▼）';
      dragHandle.setAttribute('aria-hidden', 'true');
      dragHandle.draggable = !busy;
      row.append(dragHandle);
      const check = document.createElement('input'); check.className = 'todo-check'; check.type = 'checkbox'; check.checked = todo.completed; check.disabled = busy; check.setAttribute('aria-label', `「${todo.text}」を${todo.completed ? '未完了' : '完了'}にする`); check.addEventListener('change', async () => {
        const sourceControl = row.querySelector('.todo-state-toggle-v144') || check;
        const previousTop = sourceControl.getBoundingClientRect().top;
        const focused = document.activeElement;
        const fromCurrentAction = focused === sourceControl || focused === check
          || focused === document.body || focused === document.documentElement;
        const visibleSiblings = [...(row.parentElement?.children || [])]
          .filter(item => item.classList.contains('todo-item') && !item.hidden && item.getClientRects().length);
        const position = visibleSiblings.indexOf(row);
        const neighborIds = [visibleSiblings[position + 1]?.dataset.todoId,
          visibleSiblings[position - 1]?.dataset.todoId].filter(Boolean);
        const result = await toggleTodo(todo.id);
        // Failed writes and switches to other screens must not move the cursor.
        if (!result?.ok || !fromCurrentAction || state.layout !== 'todos'
          || document.documentElement.dataset.wbDisplay !== 'classic') return;
        // The root observer adds the visible completion buttons after the
        // canonical redraw. Use one frame, not another permanent observer.
        requestAnimationFrame(() => {
          if (state.layout !== 'todos' || document.documentElement.dataset.wbDisplay !== 'classic'
            || ![document.body, document.documentElement].includes(document.activeElement)) return;
          const page = elements.todoView?.querySelector('.todo-page');
          if (!page) return;
          const usable = control => Boolean(control && !control.disabled && control.getClientRects().length);
          const toggleForId = id => page.querySelector(
            `[data-todo-id="${cssEscape(id)}"] .todo-state-toggle-v144`);
          // Continue with the next visible item in the original section.
          // When the section becomes empty, choose the closest usable action.
          const neighbor = neighborIds.map(toggleForId).find(usable);
          const sameTodo = toggleForId(todo.id);
          // If filtering leaves this as the only visible row, keep the
          // completion action focused after it moves between sections.
          // Search/reset controls are fallback actions, not competitors
          // for an available ToDo button just because they are closer.
          const fallbacks = [
            page.querySelector('.todo-list.is-completed .todo-completed-toggle-v145'),
            page.querySelector('.todo-search-reset-v145'),
            page.querySelector('.todo-search-input-v145')
          ].filter(usable);
          const closestFallback = fallbacks.sort((a, b) =>
            Math.abs(a.getBoundingClientRect().top - previousTop)
              - Math.abs(b.getBoundingClientRect().top - previousTop))[0];
          focusClassicTodoActionAtViewportPosition(
            neighbor || (usable(sameTodo) ? sameTodo : closestFallback), previousTop
          );
        });
      }); row.append(check);

      const content = document.createElement('div'); content.className = 'todo-content';
      const summary = document.createElement('button'); summary.type = 'button'; summary.className = 'todo-summary-button'; summary.disabled = busy; summary.setAttribute('aria-expanded', expanded ? 'true' : 'false'); summary.setAttribute('aria-controls', `todo-detail-${todo.id}`);
      const title = document.createElement('span'); title.className = 'todo-text'; title.textContent = todo.text;
      const summaryMeta = document.createElement('span'); summaryMeta.className = 'todo-summary-meta';
      const memoBadge = document.createElement('span'); memoBadge.className = `todo-memo-indicator${todo.memo ? ' has-memo' : ''}`; memoBadge.textContent = todo.memo ? 'メモあり' : '詳細・メモ';
      const chevron = document.createElement('span'); chevron.className = 'todo-chevron'; chevron.setAttribute('aria-hidden', 'true'); chevron.textContent = expanded ? '⌃' : '⌄';
      summaryMeta.append(memoBadge, chevron); summary.append(title, summaryMeta); content.append(summary);

      const detail = document.createElement('div'); detail.className = 'todo-detail'; detail.id = `todo-detail-${todo.id}`; detail.hidden = !expanded;
      const detailGrid = document.createElement('div'); detailGrid.className = 'todo-detail-grid';
      const titleLabel = document.createElement('label'); titleLabel.innerHTML = '<span>やること</span>';
      const titleInput = document.createElement('input'); titleInput.type = 'text'; titleInput.maxLength = TODO_MAX_LENGTH; titleInput.value = todo.text; titleInput.disabled = busy; titleLabel.append(titleInput);
      const memoLabel = document.createElement('label'); memoLabel.className = 'todo-memo-field'; memoLabel.innerHTML = '<span>メモ</span>';
      const note = document.createElement('textarea'); note.rows = 4; note.maxLength = TODO_MEMO_MAX_LENGTH; note.value = todo.memo || ''; note.placeholder = '補足、確認先、注意点など'; note.disabled = busy; memoLabel.append(note);
      detailGrid.append(titleLabel, memoLabel); detail.append(detailGrid);
      const detailFooter = document.createElement('div'); detailFooter.className = 'todo-detail-footer';
      const detailHint = document.createElement('span'); detailHint.textContent = 'タスク化すると、メモは「内容・メモ」へ引き継がれます。';
      const save = document.createElement('button'); save.type = 'button'; save.className = 'todo-detail-save'; save.textContent = '内容を保存'; save.disabled = busy;
      save.dataset.operationKey = operationKey('todo-update', todo.id);
      save.addEventListener('click', async () => {
        // A successful canonical ToDo write redraws this entire list. Restore
        // the same action and its on-screen position instead of losing focus
        // or sending the user back to the beginning of a long mobile list.
        const oldTop = save.getBoundingClientRect().top;
        const baseRevision = Number(row.dataset.todoEditBaseRevision);
        const result = await updateTodoDetails(todo.id, titleInput.value, note.value, { revision: baseRevision });
        if (!result?.ok && result?.error === 'revision-or-relation-mismatch') {
          showWriteFailure(result, 'ほかの端末による変更を確認してください。');
          render(); // Repaint latest data, retaining this unsaved draft.
        }
        if (!result?.ok || state.layout !== 'todos'
          || document.documentElement.dataset.wbDisplay !== 'classic') return;
        const currentRow = elements.todoView?.querySelector(`[data-todo-id="${cssEscape(todo.id)}"]`);
        const currentSave = currentRow?.querySelector('.todo-detail-save');
        if (!currentSave || currentSave.disabled || !currentSave.getClientRects().length) return;

        focusClassicTodoActionAtViewportPosition(currentSave, oldTop);
      });
      detailFooter.append(detailHint, save); detail.append(detailFooter); content.append(detail); row.append(content);

      summary.addEventListener('click', () => {
        const nextExpanded = detail.hidden;
        detail.hidden = !nextExpanded;
        row.classList.toggle('is-expanded', nextExpanded);
        summary.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
        chevron.textContent = nextExpanded ? '⌃' : '⌄';
        if (nextExpanded) state.expandedTodoIds.add(todo.id); else state.expandedTodoIds.delete(todo.id);
      });

      const actions = document.createElement('div'); actions.className = 'todo-actions';
      const segment = done ? 'completed-today' : 'open';
      const move = document.createElement('div'); move.className = 'todo-move-actions'; move.setAttribute('aria-label', '並び替え');
      const up = buildActionButton({ action: 'up', className: 'todo-move-button', disabled: busy || index === 0, title: '上へ移動', ariaLabel: `「${todo.text}」を上へ移動`, icon: '▲' });
      up.dataset.operationKey = operationKey('todo-reorder', todo.id); up.addEventListener('click', () => reorderTodo(todo.id, -1, segment));
      const down = buildActionButton({ action: 'down', className: 'todo-move-button', disabled: busy || index === items.length - 1, title: '下へ移動', ariaLabel: `「${todo.text}」を下へ移動`, icon: '▼' });
      down.dataset.operationKey = operationKey('todo-reorder', todo.id); down.addEventListener('click', () => reorderTodo(todo.id, 1, segment));
      move.append(up, down);
      const promote = buildActionButton({ label: 'タスク化', action: 'promote', className: 'todo-promote-button', disabled: busy, title: '正式タスクへ引き継ぐ', ariaLabel: `「${todo.text}」をタスク化`, icon: '↗' });
      promote.dataset.operationKey = operationKey('todo-promote', todo.id); promote.addEventListener('click', () => promoteTodo(todo));
      const del = buildActionButton({ label: '削除', action: 'delete', className: 'todo-delete-button', disabled: busy, title: 'このやることを削除', ariaLabel: `「${todo.text}」を削除`, icon: '×' });
      del.dataset.operationKey = operationKey('todo-delete', todo.id); del.addEventListener('click', () => deleteTodo(todo.id));
      actions.append(move, promote, del); row.append(actions); ul.append(row);
    });
    bindTodoDragListV531(ul, done ? 'completed-today' : 'open');
    section.append(ul); return section;
  };

  listRoot.replaceChildren(buildList(open, '未完了', false), buildList(completed, '本日完了', true));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const result = await createTodo(input.value, memoInput.value);
    if (result?.ok) {
      const currentInput = root.querySelector('#todayTodoInput');
      const currentMemo = root.querySelector('#todayTodoMemo');
      const currentDetails = root.querySelector('.todo-compose-details');
      if (currentInput) currentInput.value = '';
      if (currentMemo) currentMemo.value = '';
      if (currentDetails) currentDetails.open = false;
      currentInput?.focus();
      toast('やることを追加しました');
    } else if (result?.ok === false && result.error !== 'invalid-input') showWriteFailure(result, 'やることを追加できませんでした。入力は残っています。');
  });
}

const TODAY_PANEL_KEYS_V531 = ['schedule', 'overdue', 'due-today', 'spare'];

function todayPanelOrderKeyV531() {
  return `workBoardTodayPanelOrderV531:${ROOM_ID}:${normalizeUser(getCurrentUser())}`;
}

function readTodayPanelOrderV531() {
  let saved = [];
  try {
    const raw = JSON.parse(localStorage.getItem(todayPanelOrderKeyV531()) || '[]');
    if (Array.isArray(raw)) saved = raw.filter(id => TODAY_PANEL_KEYS_V531.includes(id));
  } catch (_) {}
  return [...new Set([...saved, ...TODAY_PANEL_KEYS_V531])];
}

function moveTodayPanelV531(source, target, after = false) {
  const original = readTodayPanelOrderV531();
  if (source === target || !original.includes(source) || !original.includes(target)) return;
  const next = original.filter(id => id !== source);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, source);
  if (next.every((id, i) => id === original[i])) return;
  try { localStorage.setItem(todayPanelOrderKeyV531(), JSON.stringify(next)); }
  catch (_) { toast('表示順を保存できませんでした。', true); return; }
  renderTodayView();
}

function enableTodayPanelOrderingV531(root) {
  const grid = root?.querySelector('.today-grid');
  if (!grid) return;
  const original = [...grid.children].filter(node => node.classList.contains('today-panel'));
  if (original.length !== TODAY_PANEL_KEYS_V531.length) return;
  const panels = new Map();
  original.forEach((panel, index) => {
    const key = TODAY_PANEL_KEYS_V531[index];
    panel.dataset.todayPanelId = key;
    panels.set(key, panel);
    const heading = panel.querySelector(':scope > h4');
    if (!heading) return;
    const wrap = document.createElement('div');
    wrap.className = 'today-panel-sort-head-v531';
    panel.insertBefore(wrap, heading);
    wrap.appendChild(heading);
    const controls = document.createElement('span');
    controls.className = 'today-panel-sort-controls-v531';
    const button = (direction, label) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'today-panel-shift-v531';
      el.textContent = label;
      el.title = direction < 0 ? 'この項目を上へ移動' : 'この項目を下へ移動';
      el.setAttribute('aria-label', `${heading.textContent}を${direction < 0 ? '前' : '後'}へ移動`);
      el.addEventListener('click', () => {
        const order = readTodayPanelOrderV531();
        const position = order.indexOf(key);
        const neighbor = order[position + direction];
        if (neighbor) moveTodayPanelV531(key, neighbor, direction > 0);
      });
      return el;
    };
    const up = button(-1, '↑');
    const down = button(1, '↓');
    controls.append(up, down);
    const handle = document.createElement('span');
    handle.className = 'today-panel-drag-v531';
    handle.textContent = '⠿';
    handle.title = 'PCではドラッグして表示順を変更できます';
    handle.setAttribute('aria-hidden', 'true');
    handle.draggable = true;
    handle.addEventListener('dragstart', event => {
      grid.dataset.draggingTodayPanel = key;
      event.dataTransfer?.setData('text/plain', key);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      setSortDragPreviewV338(event, panel);
    });
    controls.append(handle);
    wrap.append(controls);
    panel.dataset.todayShiftReady = '1';
    panel._todayShiftButtonsV531 = [up, down];
  });
  const order = readTodayPanelOrderV531();
  order.forEach(key => { const panel = panels.get(key); if (panel) grid.appendChild(panel); });
  order.forEach((key, index) => {
    const buttons = panels.get(key)?._todayShiftButtonsV531;
    if (buttons) { buttons[0].disabled = index === 0; buttons[1].disabled = index === order.length - 1; }
  });
  const clearMarks = () => grid.querySelectorAll('.today-panel').forEach(panel => {
    panel.classList.remove('is-drop-before-v531', 'is-drop-after-v531');
  });
  grid.addEventListener('dragover', event => {
    const target = event.target?.closest?.('[data-today-panel-id]');
    const source = grid.dataset.draggingTodayPanel;
    if (!target || !source || target.dataset.todayPanelId === source) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    clearMarks();
    const rect = target.getBoundingClientRect();
    target.classList.add(shouldDropAfterV531(event, target, source, 'todayPanelId') ? 'is-drop-after-v531' : 'is-drop-before-v531');
  });
  grid.addEventListener('drop', event => {
    const target = event.target?.closest?.('[data-today-panel-id]');
    const source = grid.dataset.draggingTodayPanel;
    if (!target || !source || target.dataset.todayPanelId === source) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const after = shouldDropAfterV531(event, target, source, 'todayPanelId');
    delete grid.dataset.draggingTodayPanel;
    clearMarks();
    moveTodayPanelV531(source, target.dataset.todayPanelId, after);
  });
  grid.addEventListener('dragend', () => { delete grid.dataset.draggingTodayPanel; clearMarks(); });
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

function restoreScheduleSearchFocus(selection) {
  requestAnimationFrame(() => {
    const input = elements.scheduleView?.querySelector('.schedule-search-v176 input');
    if (!input) return;
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(selection.start, selection.end); } catch (_) {}
  });
}

function bindScheduleSearchProxy() {
  const input = elements.scheduleView?.querySelector('.schedule-search-v176 input');
  const original = elements.searchInput;
  if (!input || !original) return;

  let isComposing = false;
  const sync = () => {
    if (isComposing) return;
    const selection = {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length
    };
    original.value = input.value;
    original.dispatchEvent(new Event('input', { bubbles: true }));
    restoreScheduleSearchFocus(selection);
  };

  input.addEventListener('compositionstart', () => { isComposing = true; });
  input.addEventListener('compositionend', () => {
    isComposing = false;
    sync();
  });
  input.addEventListener('input', event => {
    if (event.isComposing || isComposing) return;
    sync();
  });
  input.addEventListener('search', sync);
}

// JOURNAL calendar state does not change Classic's saved date range or display.
const journalScheduleStateV425 = {mode:'week',anchor:''};

let journalScheduleCategoryV430=''; // JOURNAL view-only filter; shared records unchanged.
let journalScheduleOptionsExpandedV451=false; // Only the compact-page calendar/filter fold.
const journalGapDurationV466=30; // Minimum selectable free slot; actual duration is chosen in the schedule editor.
const journalGapStartByDateV469=new Map(); // Temporary per-day selection; never persisted.
const journalGapWindowByDateV470=new Map(); // Unsaved per-day window choice.
const journalExplicitGapDaysV475=new Set(); // Only show a selected block after a real interaction.
const journalMobileGapOpenDaysV475=new Set(); // Keep phone disclosures open after draft handoff.
const journalMobilePrecisionOpenDaysV476=new Set(); // Preserve optional mobile time controls.
let journalSchedulePreviewIdV459=''; // JOURNAL-only reading selection; never persisted.
let journalSchedulePreviewOwnerV459=''; // Clear the selection when room / user changes.
let journalNoteDialogReturnV479=null; // Unpersisted note origin for editor/copy.
let journalExpandedMemoIdV481=''; // Ephemeral long-note disclosure; not a schedule field.
const journalScheduleCompactMediaV451=window.matchMedia('(max-width:760px)');
journalScheduleCompactMediaV451.addEventListener('change',event=>{
  const details=elements.scheduleView?.querySelector('[data-j451-schedule-options]');
  if(details&&document.documentElement.dataset.wbDisplay==='journal')
    details.open=!event.matches||journalScheduleOptionsExpandedV451;
});

// Move the single canonical reading note beside the selected day record on phones
// and tablets. Desktop keeps the same note in its sticky sidebar.
// This moves an existing element, not a second rendered copy or editor.
const journalScheduleInlineMediaV478=window.matchMedia('(max-width:1190px)');
function journalPositionDayPreviewV478(){
  if(document.documentElement.dataset.wbDisplay!=='journal')return;
  const root=elements.scheduleView;
  const preview=root?.querySelector('#j459SchedulePreview');
  if(!preview)return;
  const inline=journalScheduleStateV425.mode==='day'&&journalScheduleInlineMediaV478.matches;
  const row=[...root.querySelectorAll('[data-j459-record]')]
    .find(node=>node.dataset.j459Record===journalSchedulePreviewIdV459);
  const sidebar=root.querySelector('.j425-schedule-sidebar');
  if(inline&&!row)return;
  if(!inline&&!sidebar)return;
  // Moving a focused element can blur it; preserve keyboard control across resize.
  const focused=preview.contains(document.activeElement)?document.activeElement:null;
  if(inline)row.after(preview);
  else{
    const holes=sidebar.querySelector('.j425-notebook-holes');
    if(holes)holes.after(preview);
    else sidebar.prepend(preview);
  }
  preview.classList.toggle('j478-inline-preview',inline);
  focused?.focus({preventScroll:true});
}
journalScheduleInlineMediaV478.addEventListener('change',journalPositionDayPreviewV478);

// Keep the date and actions visible before the memo on narrow paper slips.
// Long notes show a short excerpt, with the full escaped content accessible.
function journalPreviewMemoMarkupV481(memo,expanded=false){
  const source=String(memo??'');
  if(!source.trim())return '';
  const full=escapeHtml(source);
  if(Array.from(source).length<=240)
    return `<section class="j481-memo-block" aria-label="予定のメモ">
      <h4 class="j481-memo-label">メモ</h4>
      <p class="j459-preview-memo">${full}</p>
    </section>`;
  const excerpt=escapeHtml(Array.from(source).slice(0,96).join(''));
  return `<section class="j481-memo-block" aria-label="予定のメモ">
    <details class="j481-memo-details" ${expanded?'open':''}>
      <summary><span class="j481-memo-label">メモ <small class="j488-memo-open-label">全文を見る</small><small class="j488-memo-close-label">折りたたむ</small></span>
        <span class="j481-memo-excerpt">${excerpt}…</span></summary>
      <p class="j459-preview-memo">${full}</p>
      <button type="button" class="j488-memo-collapse" data-j488-memo-collapse>↑ メモを閉じて見出しへ</button>
    </details>
  </section>`;
}

// Only carry the visible day note back through the existing edit/copy dialogs.
// No new editor, persisted field, or write path is created.
function journalPrepareNoteReturnV479(record,action){
  journalNoteDialogReturnV479=record && ['edit','copy'].includes(action)
    && document.documentElement.dataset.wbDisplay==='journal'
    && journalScheduleStateV425.mode==='day'
    && journalSchedulePreviewIdV459===record.id
    ? {id:record.id,room:ROOM_ID,user:getCurrentUser(),action}
    : null;
}
function journalRestoreNoteV479(){
  const context=journalNoteDialogReturnV479;
  journalNoteDialogReturnV479=null;
  if(!context || document.documentElement.dataset.wbDisplay!=='journal'
    || context.room!==ROOM_ID || context.user!==getCurrentUser()
    || journalScheduleStateV425.mode!=='day')return;
  const record=state.schedules.find(item=>item.id===context.id);
  if(record){
    journalScheduleStateV425.anchor=scheduleLocalDate(record);
    journalSchedulePreviewIdV459=record.id;
  }else journalSchedulePreviewIdV459='';
  // The existing note is rebuilt from canonical state; search and filters survive.
  journalScheduleV425();
  requestAnimationFrame(()=>{
    if(document.documentElement.dataset.wbDisplay!=='journal'
      || context.room!==ROOM_ID || context.user!==getCurrentUser())return;
    const root=elements.scheduleView;
    const note=root.querySelector('#j459SchedulePreview');
    const card=[...root.querySelectorAll('[data-j459-review]')]
      .find(item=>item.dataset.j459Review===context.id);
    const target=note||card||root.querySelector('[data-j425-mode="day"]');
    target?.focus({preventScroll:true});
    if(target && window.matchMedia('(max-width:1190px)').matches)
      target.scrollIntoView({behavior:'auto',block:'start'});
  });
}

// JOURNAL-only visible schedule summary for the 08:00-20:00 paper grid.
// Merge intervals before measuring gaps so overlapping meetings do not double-count.
function journalWeekAvailabilityV463(day, records) {
  const opening = new Date(day); opening.setHours(8,0,0,0);
  const closing = new Date(day); closing.setHours(20,0,0,0);
  const start = opening.getTime(), end = closing.getTime();
  const intervals = records.flatMap(entry => {
    const from = new Date(entry.startAt).getTime();
    const until = new Date(entry.endAt).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from
      || from >= end || until <= start) return [];
    return [{start:Math.max(start,from),end:Math.min(end,until)}];
  }).sort((a,b)=>a.start-b.start || a.end-b.end);
  const points = intervals.flatMap(item => [
    {time:item.start,delta:1},{time:item.end,delta:-1}
  ]).sort((a,b)=>a.time-b.time || a.delta-b.delta);
  let concurrent = 0, maxConcurrent = 0;
  for (const point of points) {
    concurrent += point.delta;
    maxConcurrent = Math.max(maxConcurrent,concurrent);
  }
  let cursor = start, busy = 0, largest = null;
  const gaps=[];
  const offerGap = (from,until) => {
    if (until <= from) return;
    gaps.push({start:from,end:until});
    if (!largest || until-from > largest.end-largest.start)
      largest = {start:from,end:until};
  };
  for (const part of intervals) {
    if (part.start > cursor) offerGap(cursor,part.start);
    if (part.end > cursor) {
      busy += part.end-Math.max(part.start,cursor);
      cursor = part.end;
    }
  }
  offerGap(cursor,end);
  return {busyMinutes:Math.round(busy/60000),maxConcurrent,largestGap:largest,gaps};
}

// Build a draft only; the normal schedule dialog owns validation, conflicts and saving.
function journalGapScheduleSeedV464(day, gap, minimumGapMinutes=45) {
  if (!gap || !Number.isFinite(gap.start) || !Number.isFinite(gap.end)
      || gap.end-gap.start < minimumGapMinutes*60000) return null;
  // Round forward to the next minute so a hidden sub-minute overlap is not introduced.
  const startMs = Math.ceil(gap.start/60000)*60000;
  const durationMinutes = Math.min(60,Math.floor((gap.end-startMs)/60000));
  if (durationMinutes < 30) return null;
  const start = new Date(startMs);
  if (toISODate(start)!==toISODate(day)) return null;
  return {...newScheduleSeedForDate(toISODate(day)),
    startAt:start.toISOString(),
    endAt:new Date(startMs+durationMinutes*60000).toISOString()};
}

// The V464 helper remains the single source of gap and start-time validation.
function journalGapScheduleSeedV466(day, gap, minutes) {
  if (minutes !== 30 && minutes !== 60) return null;
  const base = journalGapScheduleSeedV464(day, gap, minutes);
  if (!base) return null;
  const start = new Date(base.startAt).getTime();
  if (!Number.isFinite(start) || gap.end-start < minutes*60000) return null;
  return {...base,endAt:new Date(start+minutes*60000).toISOString()};
}

 
// Only expose starts that fit entirely within the longest unregistered span.
function journalGapStartOptionsV469(gap, minutes) {
  if(!gap || ![30,60].includes(minutes) || !Number.isFinite(gap.start)
      || !Number.isFinite(gap.end))return [];
  const first=Math.ceil(gap.start/60000)*60000;
  const last=gap.end-minutes*60000;
  if(first>last)return [];
  const options=[first], step=30*60000;
  for(let point=Math.ceil((first+1)/step)*step;point<=last;point+=step)
    options.push(point);
  return options;
}

// Reject stale or fabricated choices before opening the normal schedule form.
function journalGapScheduleSeedV469(day, gap, minutes, chosenStart) {
  if(!journalGapStartOptionsV469(gap,minutes).includes(chosenStart))return null;
  const base=journalGapScheduleSeedV466(day,gap,minutes);
  if(!base || chosenStart+minutes*60000>gap.end
      || toISODate(new Date(chosenStart))!==toISODate(day))return null;
  return {...base,startAt:new Date(chosenStart).toISOString(),
    endAt:new Date(chosenStart+minutes*60000).toISOString()};
}

 
// Only include unregistered windows in which the requested duration actually fits.
function journalEligibleGapWindowsV470(summary, minutes) {
  return (summary?.gaps||[]).filter(gap=>journalGapStartOptionsV469(gap,minutes).length>0);
}

// Map a click within a free strip to the nearest feasible start.
// Keyboard activation and invalid pointer positions use the first start.
function journalGridStartFromPointV473(gap,minutes,fraction) {
  const options=journalGapStartOptionsV469(gap,minutes);
  if(!options.length)return null;
  const ratio=Number.isFinite(fraction)?Math.max(0,Math.min(1,fraction)):0;
  const target=gap.start+(gap.end-gap.start)*ratio;
  return options.reduce((nearest,start)=>Math.abs(start-target)<Math.abs(nearest-target)
    ?start:nearest,options[0]);
}

// Clearing a draft selection must not create, update, or delete any records.
function journalClearGapChoiceV476(iso) {
  journalExplicitGapDaysV475.delete(iso);
  journalGapWindowByDateV470.delete(iso);
  journalGapStartByDateV469.delete(iso);
}

function journalScheduleV425(){
 const owner=ROOM_ID+'|'+getCurrentUser();
 if(journalSchedulePreviewOwnerV459!==owner){
   journalSchedulePreviewIdV459='';
   journalNoteDialogReturnV479=null;
   journalExpandedMemoIdV481='';
   journalGapWindowByDateV470.clear();
   journalGapStartByDateV469.clear();
   journalExplicitGapDaysV475.clear();
   journalMobileGapOpenDaysV475.clear();
   journalMobilePrecisionOpenDaysV476.clear();
   journalSchedulePreviewOwnerV459=owner;
 }
 const mode=journalScheduleStateV425.mode;
 const anchor=parseISODate(journalScheduleStateV425.anchor)||startOfToday();
 const weekStart=startOfWeekMonday(anchor),monthStart=startOfMonth(anchor);
 const range=mode==='month'?{start:monthStart,end:addMonths(monthStart,1)}:mode==='day'?{start:anchor,end:addDays(anchor,1)}:{start:weekStart,end:addDays(weekStart,7)};
 const matchesCategory=s=>!journalScheduleCategoryV430||s.category===journalScheduleCategoryV430;
 const canonical=getFilteredSchedules(range);
 const schedules=canonical.filter(matchesCategory);
 const days=mode==='month'?Array.from({length:daysInMonth(monthStart)},(_,i)=>addDays(monthStart,i)):mode==='day'?[anchor]:Array.from({length:7},(_,i)=>addDays(weekStart,i));
 const today=todayISO();
 const targetToday=getFilteredSchedules({start:startOfToday(),end:addDays(startOfToday(),1)}).filter(matchesCategory);
 const upcoming=getFilteredSchedules({start:startOfToday(),end:addDays(startOfToday(),21)}).filter(s=>scheduleLocalDate(s)>today&&matchesCategory(s)).slice(0,6);
 const categories=[...new Set(getFilteredSchedules({start:addDays(startOfToday(),-45),end:addDays(startOfToday(),365)}).map(s=>s.category).filter(Boolean))];
 const related=getFilteredTasks().filter(t=>t.dueDate&&t.dueDate>=toISODate(range.start)&&t.dueDate<toISODate(range.end)).slice(0,5);
 const notes=schedules.filter(s=>s.memo).slice(0,3);
 const monthDates=Array.from({length:42},(_,i)=>addDays(monthStart,i-monthStart.getDay()));
 const monthPanel=`<div class="j425-mini-calendar"><div class="j425-mini-month-head"><button type="button" data-j425-shift-month="-1" aria-label="前の月">‹</button><strong>${anchor.getFullYear()}年${anchor.getMonth()+1}月</strong><button type="button" data-j425-shift-month="1" aria-label="次の月">›</button></div><div class="j425-mini-grid">${'日月火水木金土'.split('').map(d=>`<span class="j425-mini-weekday">${d}</span>`).join('')}${monthDates.map(d=>`<button type="button" data-j425-day="${toISODate(d)}" class="${d.getMonth()!==anchor.getMonth()?'is-muted':''} ${toISODate(d)===today?'is-today':''} ${toISODate(d)===toISODate(anchor)?'is-selected':''}">${d.getDate()}</button>`).join('')}</div></div>`;
 const interval=52,dayHeight=interval*12;
 const byDay=iso=>schedules.filter(s=>scheduleLocalDate(s)===iso);
 // Include older multi-day schedules when calculating a day's registered gaps.
 // getFilteredSchedules retains the existing scope, assignee, category and search filters.
 const weekAnalysisRecordsV463=mode==='week'
   ?getFilteredSchedules({start:new Date(0),end:addDays(weekStart,7)}).filter(matchesCategory):[];
 // The timetable and mobile day slips share precisely the same free windows.
 const weekInsightByDateV473=mode==='week'
   ?new Map(days.map(day=>[toISODate(day),journalWeekAvailabilityV463(day,weekAnalysisRecordsV463)]))
   :new Map();
 const fmtTimeV463=timestamp=>{
   const t=new Date(timestamp);
   return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
 };
 const renderEvent=(s,i)=>{
    const st=new Date(s.startAt),ed=new Date(s.endAt);
    let startMinutes=st.getHours()*60+st.getMinutes(),endMinutes=ed.getHours()*60+ed.getMinutes();
    if(toISODate(ed)!==toISODate(st))endMinutes=20*60;
    const top=Math.min(dayHeight-43,Math.max(0,(Math.max(480,startMinutes)-480)*interval/60));
    const height=Math.max(31,(Math.min(1200,Math.max(endMinutes,startMinutes+30))-Math.max(480,startMinutes))*interval/60-3);
    const palette=['sage','sand','blue','rose'][i%4];
    return `<button type="button" class="j425-week-event is-${palette}" data-schedule-id="${escapeHtml(s.id)}" style="top:${top}px;height:${height}px" title="${escapeHtml(s.title)}"><small>${escapeHtml(formatScheduleTime(s.startAt))}–${escapeHtml(formatScheduleTime(s.endAt))}</small><strong>${escapeHtml(s.title)}</strong>${s.location?`<span>${escapeHtml(s.location)}</span>`:''}</button>`;
 };

 // Overlapping week slots use one readable marker, not superimposed buttons.
 // The original event buttons are still present in the day / compact view.
 const renderJournalDayEventsV456=(items,iso)=>{
   const ordered=[...items].sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)
     || String(a.id).localeCompare(String(b.id)));
   const groups=[];
   let group=null;
   for(const entry of ordered){
     const st=new Date(entry.startAt),ed=new Date(entry.endAt);
     const actualStart=st.getHours()*60+st.getMinutes();
     let actualEnd=ed.getHours()*60+ed.getMinutes();
     if(toISODate(ed)!==toISODate(st))actualEnd=1440;
     const start=Math.max(480,Math.min(1140,actualStart));
     const end=Math.min(1200,Math.max(start+42,actualEnd));
     if(!group||start>=group.end){
       group={start,end,entries:[entry]};
       groups.push(group);
     }else{
       group.entries.push(entry);
       group.end=Math.max(group.end,end);
     }
   }
   return groups.map((cluster,index)=>{
     if(cluster.entries.length===1)return renderEvent(cluster.entries[0],index);
     const top=Math.round((cluster.start-480)*interval/60);
     const first=cluster.entries[0];
     const titles=cluster.entries.map(entry=>entry.title).join('、');
     return `<div class="j456-overlap-cluster" style="--j456-overlap-top:${top}px">
       <button type="button" class="j456-overlap-summary" data-j456-day-focus="${iso}"
         aria-label="${escapeHtml(cluster.entries.length+'件の予定を日別で確認: '+titles)}">
         <small>${escapeHtml(formatScheduleTime(first.startAt))}付近</small>
         <strong>重複・近接 ${cluster.entries.length}件</strong>
         <span>${escapeHtml(first.title)} ほか${cluster.entries.length-1}件</span>
       </button>
       <div class="j456-overlap-entries">${cluster.entries.map((entry,i)=>renderEvent(entry,i)).join('')}</div>
     </div>`;
   }).join('');
 };
 // The original event button continues to open the canonical editor. A separate
 // review action opens the read-only paper slip without creating a second editor.
 const orderJournalDayEventsV460=items=>[...items]
   .sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)
     || String(a.id).localeCompare(String(b.id)));
 const renderJournalDayRecordsV459=items=>orderJournalDayEventsV460(items)
   .map((item,i)=>`<div class="j459-day-record ${journalSchedulePreviewIdV459===item.id?'is-selected':''}"
     data-j459-record="${escapeHtml(item.id)}">
     ${renderEvent(item,i)}
     <button type="button" class="j459-day-review" data-j459-review="${escapeHtml(item.id)}"
       aria-label="${escapeHtml(item.title)}の内容を${journalSchedulePreviewIdV459===item.id?'閉じる':'手帳で確認'}"
       aria-pressed="${journalSchedulePreviewIdV459===item.id}"
       aria-expanded="${journalSchedulePreviewIdV459===item.id}"
       ${journalSchedulePreviewIdV459===item.id?'aria-controls="j459SchedulePreview"':''}>
       ${journalSchedulePreviewIdV459===item.id?'閉じる':'確認'}
     </button>
   </div>`).join('');
 // Desktop: one unobtrusive actionable strip per free window on the timed grid.
 // Phone: retain compact day slips and disclose choices only on demand.
 const renderJournalWeekGapsV473=(day,iso)=>{
   if(mode!=='week')return '';
   const gaps=journalEligibleGapWindowsV470(weekInsightByDateV473.get(iso),journalGapDurationV466);
   if(!gaps.length)return '';
   const opening=new Date(day);opening.setHours(8,0,0,0);
   const openingMs=opening.getTime();
   const explicit=journalExplicitGapDaysV475.has(iso);
   const rememberedGap=journalGapWindowByDateV470.get(iso);
   const rememberedStart=journalGapStartByDateV469.get(iso);
   const desktop=gaps.map(gap=>{
     const top=(gap.start-openingMs)/60000*interval/60;
     const height=(gap.end-gap.start)/60000*interval/60;
     const selected=explicit && rememberedGap===gap.start &&
       journalGapStartOptionsV469(gap,journalGapDurationV466).includes(rememberedStart);
     const slot=selected?`<span class="j475-grid-selection" aria-hidden="true"
       style="top:${(100*(rememberedStart-gap.start)/(gap.end-gap.start)).toFixed(3)}%;
         height:${(100*journalGapDurationV466*60000/(gap.end-gap.start)).toFixed(3)}%">
       ${fmtTimeV463(rememberedStart)}〜${fmtTimeV463(rememberedStart+journalGapDurationV466*60000)}
     </span>`:'';
     return `<button type="button" class="j473-grid-gap" data-j473-free-date="${iso}"
       data-j473-free-start="${gap.start}" data-j473-selected="${selected}"
       style="top:${top}px;height:${height}px"
       aria-label="${escapeHtml((day.getMonth()+1)+'月'+day.getDate()+'日の空き時間 '+fmtTimeV463(gap.start)+'〜'+fmtTimeV463(gap.end)+'を選んで予定を作成')}">
       <span>＋ 予定</span><small>${fmtTimeV463(gap.start)}〜${fmtTimeV463(gap.end)}</small>
       ${slot}
     </button>`;
   }).join('');
   const mobile=gaps.map(gap=>{
     const selected=explicit && rememberedGap===gap.start &&
       journalGapStartOptionsV469(gap,journalGapDurationV466).includes(rememberedStart);
     return `<button type="button" data-j473-free-date="${iso}" data-j473-free-start="${gap.start}"
       data-j475-selected="${selected}">
       ${selected?'選択中 · ':'＋ '}${fmtTimeV463(gap.start)}〜${fmtTimeV463(gap.end)}
     </button>`;
   }).join('');
   const selectedGap=gaps.find(gap=>gap.start===rememberedGap)||gaps[0];
   const starts=journalGapStartOptionsV469(selectedGap,journalGapDurationV466);
   const chosen=starts.includes(rememberedStart)?rememberedStart:starts[0];
   return `<div class="j473-grid-gap-layer">${desktop}</div>
     <details class="j473-mobile-gaps" data-j475-mobile-date="${iso}"
       ${journalMobileGapOpenDaysV475.has(iso)?'open':''}>
       <summary>空き時間から追加 <span>${gaps.length}枠</span></summary>
       <div class="j473-mobile-gap-options">${mobile}</div>
       ${explicit?`<div class="j476-mobile-choice">
         <span>選択中 ${fmtTimeV463(chosen)}〜${fmtTimeV463(chosen+journalGapDurationV466*60000)}</span>
         <button type="button" data-j476-clear-date="${iso}" aria-label="選択を解除">解除</button>
       </div>`:''}
       <details class="j476-mobile-precision" data-j476-mobile-precision="${iso}"
         ${journalMobilePrecisionOpenDaysV476.has(iso)?'open':''}>
         <summary>${explicit?'開始時刻を変更して追加':'開始時刻を指定して追加'}</summary>
         <div class="j476-precision-fields">
           ${gaps.length>1?`<label>空き枠
             <select data-j476-mobile-gap="${iso}" aria-label="${iso}の空き枠">
               ${gaps.map(gap=>`<option value="${gap.start}" ${gap.start===selectedGap.start?'selected':''}>${fmtTimeV463(gap.start)}〜${fmtTimeV463(gap.end)}</option>`).join('')}
             </select>
           </label>`:''}
           <label>開始時刻
             <select data-j476-mobile-start="${iso}" aria-label="${iso}の開始時刻">
               ${starts.map(start=>`<option value="${start}" ${start===chosen?'selected':''}>${fmtTimeV463(start)}</option>`).join('')}
             </select>
           </label>
           <button type="button" data-j476-mobile-create="${iso}">＋ 選んだ時間で作成</button>
         </div>
       </details>
     </details>`;
 };
 const dayColumn=(d,i)=>{const iso=toISODate(d),items=byDay(iso);return `<section class="j425-week-column ${iso===today?'is-today':''}"><header><span>${d.getMonth()+1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）</span><small>${items.length}件</small><button type="button" class="j443-add-on-date" data-j443-add-schedule-date="${iso}" aria-label="${d.getMonth()+1}月${d.getDate()}日に予定を追加">＋ 予定</button></header><div class="j425-week-column-body" data-j425-empty-date="${iso}" style="--day-height:${dayHeight}px">${mode==='day'?renderJournalDayRecordsV459(items):renderJournalDayEventsV456(items,iso)+renderJournalWeekGapsV473(d,iso)}</div></section>`};
 const weekBody=mode==='month'?`<div class="j425-month-grid">${Array.from({length:monthDates.length},(_,i)=>{const d=monthDates[i],iso=toISODate(d),count=byDay(iso).length;return `<button type="button" data-j425-day="${iso}" class="${d.getMonth()!==anchor.getMonth()?'is-outside':''} ${iso===today?'is-today':''}"><span>${d.getDate()}</span><small>${count?count+'件':'　'}</small>${byDay(iso).slice(0,2).map(s=>`<i>${escapeHtml(s.title)}</i>`).join('')}</button>`}).join('')}</div>`:
 mode==='list'?`<div class="j425-schedule-ledger">${days.map(d=>{const iso=toISODate(d);return `<section><h4>${d.getMonth()+1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）</h4>${byDay(iso).map(s=>`<button type="button" data-schedule-id="${escapeHtml(s.id)}"><time>${escapeHtml(formatScheduleTime(s.startAt))}</time><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.category||'予定')}</small></button>`).join('')||'<p>予定なし</p>'}</section>`}).join('')}</div>`:
 `<div class="j425-week-scroll" role="region" aria-label="週間の時間割" tabindex="0"><div class="j425-week-grid ${mode==='day'?'is-single-day':''}"><div class="j425-week-hours"><header>時間</header><div>${Array.from({length:12},(_,i)=>`<span style="top:${i*interval}px">${String(i+8).padStart(2,'0')}:00</span>`).join('')}</div></div>${days.map(dayColumn).join('')}</div></div>`;
 const rangeLabel=mode==='month'?`${monthStart.getFullYear()}年${monthStart.getMonth()+1}月`:
 `${days[0].getMonth()+1}/${days[0].getDate()} 〜 ${days[days.length-1].getMonth()+1}/${days[days.length-1].getDate()}`;
 const todayList=targetToday.map(s=>`<button type="button" data-schedule-id="${escapeHtml(s.id)}"><time>${escapeHtml(formatScheduleTime(s.startAt))}</time><strong>${escapeHtml(s.title)}</strong></button>`).join('')||'<p>今日の予定はありません</p>';
 const orderedDayV460=mode==='day'?orderJournalDayEventsV460(byDay(toISODate(anchor))):[];
 const selectedPositionV460=orderedDayV460.findIndex(s=>s.id===journalSchedulePreviewIdV459);
 const pagingV460=mode==='day'&&selectedPositionV460>=0?`<nav class="j460-preview-paging"
   aria-label="同じ日の予定を前後に確認">
   <button type="button" data-j460-preview-step="-1" aria-label="前の予定へ"
     ${selectedPositionV460===0?'disabled':''}>‹ 前の予定</button>
   <span role="status" aria-live="polite">${selectedPositionV460+1} / ${orderedDayV460.length}件</span>
   <button type="button" data-j460-preview-step="1" aria-label="次の予定へ"
     ${selectedPositionV460===orderedDayV460.length-1?'disabled':''}>次の予定 ›</button>
 </nav>`:'';
 const selectedSchedule=schedules.find(s=>s.id===journalSchedulePreviewIdV459);
 const previewHtml=selectedSchedule?`<section class="j459-schedule-preview" id="j459SchedulePreview"
     tabindex="-1" aria-label="選択した予定の確認">
   <div class="j459-preview-heading"><span>選択中の予定</span>
     <button type="button" class="j478-preview-close" data-j459-back
       aria-label="予定の確認を閉じて一覧に戻る">閉じる</button>
   </div>
   ${pagingV460}
   <h3>${escapeHtml(selectedSchedule.title||'無題の予定')}</h3>
   <div class="j481-date-row">
     <p class="j459-preview-datetime">${escapeHtml(formatScheduleDateTimeRange(selectedSchedule))}</p>
     <span class="j481-category" aria-label="予定の分類">${escapeHtml(selectedSchedule.category||'その他')}</span>
   </div>
   <div class="j459-preview-actions">
     <button type="button" data-j459-edit>編集</button>
     <button type="button" data-j459-copy>コピー</button>
   </div>
   <dl class="j459-preview-meta j481-preview-meta">
     <div><dt>担当</dt><dd>${escapeHtml(selectedSchedule.assignee||'未設定')}</dd></div>
     <div><dt>場所</dt><dd>${escapeHtml(selectedSchedule.location||'未設定')}</dd></div>
   </dl>
   ${journalPreviewMemoMarkupV481(selectedSchedule.memo,journalExpandedMemoIdV481===selectedSchedule.id)}
 </section>`:'';
 elements.scheduleView.innerHTML=`<div class="j425-schedule">
  <header class="j425-editorial-head"><div><span>04 / WEEKLY PLANNER</span><h2>スケジュール</h2></div>
    <div class="j425-schedule-actions"><label>検索<input type="search" data-j425-schedule-query placeholder="予定・場所・分類を検索" value="${escapeHtml(elements.searchInput.value)}"></label><button type="button" class="j425-action-primary" data-j425-add-schedule>＋ 予定を追加</button></div></header>
  <div class="j425-editorial-layout j425-schedule-layout">
    <aside class="j425-index-rail j425-schedule-index"><h3>カレンダー</h3>
      <h4>表示期間</h4><nav>${[['day','日'],['week','週'],['month','月'],['list','一覧']].map(([k,label])=>`<button type="button" class="j425-index-option" data-j425-mode="${k}" aria-pressed="${mode===k}">${label}</button>`).join('')}</nav>
      <details class="j451-schedule-options" data-j451-schedule-options ${!window.matchMedia('(max-width:760px)').matches||journalScheduleOptionsExpandedV451?'open':''}>
      <summary>日付・分類を選ぶ${journalScheduleCategoryV430?'（'+escapeHtml(journalScheduleCategoryV430)+'）':''}</summary>
      <div class="j451-schedule-options-content">${monthPanel}
      <h4>予定の分類</h4><div class="j430-schedule-categories" role="group" aria-label="予定の分類">
        <button type="button" data-j430-schedule-category="" aria-pressed="${!journalScheduleCategoryV430}">すべての予定</button>
        ${categories.map(cat=>`<button type="button" data-j430-schedule-category="${escapeHtml(cat)}" aria-pressed="${journalScheduleCategoryV430===cat}"><span class="j430-category-dot" aria-hidden="true"></span>${escapeHtml(cat)}</button>`).join('')}
      </div></div></details>
    </aside>
    <section class="j425-schedule-planner"><div class="j425-schedule-datebar"><button type="button" data-j425-shift="-1">‹ 前へ</button><strong>${escapeHtml(rangeLabel)}</strong><button type="button" data-j425-shift="1">次へ ›</button><button type="button" data-j425-today>今日</button>${mode==='day'?'<button type="button" class="j459-return-week" data-j459-return-week>週へ戻る</button>':''}</div>
      ${weekBody}
      <div class="j425-schedule-footnotes"><section><h3>関連タスク <small>${related.length}件</small></h3>${related.map(t=>`<button type="button" data-related-task-id="${escapeHtml(t.id)}"><span>□</span>${escapeHtml(t.title)}<small>${escapeHtml(t.dueDate)}</small></button>`).join('')||'<p>表示期間に期限があるタスクはありません</p>'}</section><section><h3>予定のメモ</h3>${notes.map(s=>`<p><strong>${escapeHtml(s.title)}</strong>：${escapeHtml(s.memo)}</p>`).join('')||'<p>表示期間の予定にメモはありません</p>'}</section></div>
      <div class="j425-stationery-row j425-schedule-props" aria-hidden="true"><img class="j442-schedule-botanical" src="./assets/journal-schedule-botanical-v442.svg" alt="" decoding="async"></div>
    </section>
    <aside class="j425-reading-rail j425-schedule-sidebar"><div class="j425-notebook-holes" aria-hidden="true"></div>${previewHtml}<h3>今日の予定</h3><small>${today} / ${targetToday.length}件</small><div class="j425-side-schedule-list">${todayList}</div><h4>今後の予定</h4>${upcoming.map(s=>`<button type="button" data-schedule-id="${escapeHtml(s.id)}"><time>${escapeHtml(scheduleLocalDate(s))}</time><strong>${escapeHtml(s.title)}</strong></button>`).join('')||'<p>近日中の予定はありません</p>'}<h4>今週の関連タスク</h4>${related.slice(0,4).map(t=>`<button type="button" data-related-task-id="${escapeHtml(t.id)}">${escapeHtml(t.title)}</button>`).join('')||'<p>関連タスクはありません</p>'}</aside>
  </div></div>`;
 const root=elements.scheduleView;
 journalPositionDayPreviewV478();
 root.querySelector('#j459SchedulePreview .j481-memo-details')?.addEventListener('toggle',event=>{
   if(!event.currentTarget.isConnected)return;
   journalExpandedMemoIdV481=event.currentTarget.open?journalSchedulePreviewIdV459:'';
 });
 // Use the native details disclosure; closing from the memo foot returns to its summary.
 root.querySelector('#j459SchedulePreview [data-j488-memo-collapse]')?.addEventListener('click',event=>{
   const details=event.currentTarget.closest('.j481-memo-details');
   if(!details||!details.open)return;
   details.open=false;
   journalExpandedMemoIdV481='';
   const summary=details.querySelector('summary');
   summary?.focus({preventScroll:true});
   summary?.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
 });
 const compactOptions=root.querySelector('[data-j451-schedule-options]');
 compactOptions?.addEventListener('toggle',()=>{
   if (window.matchMedia('(max-width:760px)').matches)
     journalScheduleOptionsExpandedV451=compactOptions.open;
 });
 root.querySelectorAll('[data-j430-schedule-category]').forEach(b=>b.addEventListener('click',()=>{
    journalScheduleCategoryV430=b.dataset.j430ScheduleCategory;journalScheduleV425();
  }));
 root.querySelectorAll('[data-j425-mode]').forEach(b=>b.addEventListener('click',()=>{journalScheduleStateV425.mode=b.dataset.j425Mode;journalScheduleV425()}));
 root.querySelector('[data-j425-add-schedule]')?.addEventListener('click',()=>openScheduleDialog());
 root.querySelectorAll('[data-j425-day]').forEach(b=>b.addEventListener('click',()=>{journalScheduleStateV425.anchor=b.dataset.j425Day;journalScheduleStateV425.mode='day';journalScheduleV425()}));
 // Preserve the real timetable's horizontal position and focused control.
 const refreshWeekChoicesV470=focusSelector=>{
  const gridLeft=root.querySelector('.j425-week-scroll')?.scrollLeft||0;
  journalScheduleV425();
  requestAnimationFrame(()=>{
   const nextRoot=elements.scheduleView,grid=nextRoot.querySelector('.j425-week-scroll');
   if(grid)grid.scrollLeft=gridLeft;
   nextRoot.querySelector(focusSelector)?.focus({preventScroll:true});
  });
 };
 // The timed grid and phone day slips share one verified draft path.
 const openJournalGapDraftV473=(dateIso,chosenWindow,chosen,syncGridChoice=false)=>{
   const date=parseISODate(dateIso);
   if(!date || mode!=='week' || date<weekStart || date>=addDays(weekStart,7))return;
   // Recheck immediately before the existing dialog, including overlapping updates.
   const current=getFilteredSchedules({start:new Date(0),end:addDays(weekStart,7)})
     .filter(matchesCategory);
   const eligible=journalEligibleGapWindowsV470(
     journalWeekAvailabilityV463(date,current),journalGapDurationV466);
   const gap=eligible.find(item=>item.start===chosenWindow);
   const suggestion=journalGapScheduleSeedV469(date,gap,journalGapDurationV466,chosen);
   if(!suggestion){
     journalScheduleV425();
     toast("表示条件が変わったため、未登録時間帯を再確認してください。",true);
     return;
   }
   if(syncGridChoice){
     journalGapWindowByDateV470.set(dateIso,chosenWindow);
     journalGapStartByDateV469.set(dateIso,chosen);
     journalExplicitGapDaysV475.add(dateIso);
     if(root.querySelector('[data-j475-mobile-date="'+dateIso+'"]')?.open)
       journalMobileGapOpenDaysV475.add(dateIso);
     const weekLeft=root.querySelector('.j425-week-scroll')?.scrollLeft||0;
     journalScheduleV425();
      const grid=elements.scheduleView.querySelector('.j425-week-scroll');
      if(grid)grid.scrollLeft=weekLeft;
   }
   if(journalScheduleCategoryV430 && state.categories.includes(journalScheduleCategoryV430))
     suggestion.category=journalScheduleCategoryV430;
   openScheduleDialog(suggestion);
   // Save success alone triggers the existing JOURNAL day-note focus.
   elements.scheduleForm.dataset.journalGapFocus='1';
 };
 root.querySelectorAll('[data-j475-mobile-date]').forEach(details=>details.addEventListener('toggle',()=>{
   // A replaced <details> may deliver an old queued toggle after the redraw.
   if(!details.isConnected)return;
   const iso=details.dataset.j475MobileDate;
   if(details.open)journalMobileGapOpenDaysV475.add(iso);
   else journalMobileGapOpenDaysV475.delete(iso);
 }));
 root.querySelectorAll('[data-j476-mobile-precision]').forEach(details=>details.addEventListener('toggle',()=>{
   if(!details.isConnected)return;
   const iso=details.dataset.j476MobilePrecision;
   if(details.open)journalMobilePrecisionOpenDaysV476.add(iso);
   else journalMobilePrecisionOpenDaysV476.delete(iso);
 }));
 const keepMobileChoicesV476=iso=>{
   journalMobileGapOpenDaysV475.add(iso);
   journalMobilePrecisionOpenDaysV476.add(iso);
 };
 // Both phone selects only prepare a draft; common validation and saving remain untouched.
 root.querySelectorAll('[data-j476-mobile-gap]').forEach(picker=>picker.addEventListener('change',()=>{
   const iso=picker.dataset.j476MobileGap;
   const chosenWindow=Number(picker.value);
   const gap=journalEligibleGapWindowsV470(weekInsightByDateV473.get(iso),journalGapDurationV466)
     .find(item=>item.start===chosenWindow);
   if(!gap)return;
   const starts=journalGapStartOptionsV469(gap,journalGapDurationV466);
   if(!starts.length)return;
   journalGapWindowByDateV470.set(iso,chosenWindow);
   journalGapStartByDateV469.set(iso,starts[0]);
   journalExplicitGapDaysV475.add(iso);
   keepMobileChoicesV476(iso);
   refreshWeekChoicesV470('[data-j476-mobile-gap="'+iso+'"]');
 }));
 root.querySelectorAll('[data-j476-mobile-start]').forEach(picker=>picker.addEventListener('change',()=>{
   const iso=picker.dataset.j476MobileStart;
   const start=Number(picker.value);
   const eligible=journalEligibleGapWindowsV470(weekInsightByDateV473.get(iso),journalGapDurationV466);
   // The removed week overview used to seed this map. Use the same first
   // available window shown in the phone picker until a user chooses one.
   const selectedGap=eligible.find(gap=>gap.start===journalGapWindowByDateV470.get(iso))||eligible[0];
   if(!selectedGap || !journalGapStartOptionsV469(selectedGap,journalGapDurationV466).includes(start))return;
   journalGapWindowByDateV470.set(iso,selectedGap.start);
   journalGapStartByDateV469.set(iso,start);
   journalExplicitGapDaysV475.add(iso);
   keepMobileChoicesV476(iso);
   refreshWeekChoicesV470('[data-j476-mobile-start="'+iso+'"]');
 }));
 root.querySelectorAll('[data-j476-mobile-create]').forEach(button=>button.addEventListener('click',()=>{
   const iso=button.dataset.j476MobileCreate;
   const eligible=journalEligibleGapWindowsV470(weekInsightByDateV473.get(iso),journalGapDurationV466);
   const gap=eligible.find(item=>item.start===journalGapWindowByDateV470.get(iso))||eligible[0];
   const chosen=Number(root.querySelector('[data-j476-mobile-start="'+iso+'"]')?.value);
   if(!gap || !journalGapStartOptionsV469(gap,journalGapDurationV466).includes(chosen))return;
   keepMobileChoicesV476(iso);
   openJournalGapDraftV473(iso,gap.start,chosen,true);
 }));
 root.querySelectorAll('[data-j476-clear-date]').forEach(button=>button.addEventListener('click',()=>{
   const iso=button.dataset.j476ClearDate;
   journalClearGapChoiceV476(iso);
    journalMobileGapOpenDaysV475.add(iso);
    refreshWeekChoicesV470('[data-j475-mobile-date="'+iso+'"]>summary');
 }));
 root.querySelectorAll('[data-j473-free-date]').forEach(button=>button.addEventListener('click',event=>{
   const iso=button.dataset.j473FreeDate;
   const start=Number(button.dataset.j473FreeStart);
   const gap=journalEligibleGapWindowsV470(weekInsightByDateV473.get(iso),journalGapDurationV466)
     .find(item=>item.start===start);
   if(!gap)return;
   const rect=button.getBoundingClientRect();
   const fraction=button.classList.contains('j473-grid-gap') && event.detail>0 && rect.height>0
     ?(event.clientY-rect.top)/rect.height:0;
   const chosen=journalGridStartFromPointV473(gap,journalGapDurationV466,fraction);
   if(chosen!==null)openJournalGapDraftV473(iso,start,chosen,true);
 }));

 root.querySelectorAll('[data-j456-day-focus]').forEach(button=>button.addEventListener('click',()=>{
   journalScheduleStateV425.anchor=button.dataset.j456DayFocus;
   journalScheduleStateV425.mode='day';
   journalScheduleV425();
   requestAnimationFrame(()=>{
     const first=elements.scheduleView.querySelector('.j425-week-grid.is-single-day [data-schedule-id]');
     if(!first)return;
     first.focus({preventScroll:true});
     first.scrollIntoView({
       behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',
       block:'center'
     });
   });
 }));
 root.querySelector('[data-j425-today]')?.addEventListener('click',()=>{journalScheduleStateV425.anchor=todayISO();journalScheduleV425()});
 root.querySelector('[data-j459-return-week]')?.addEventListener('click',()=>{
   journalScheduleStateV425.mode='week';
   journalScheduleV425();
   requestAnimationFrame(()=>elements.scheduleView.querySelector('[data-j425-mode="week"]')?.focus({preventScroll:true}));
 });
 root.querySelectorAll('[data-j425-shift]').forEach(b=>b.addEventListener('click',()=>{const step=Number(b.dataset.j425Shift),date=parseISODate(journalScheduleStateV425.anchor)||startOfToday();journalScheduleStateV425.anchor=toISODate(journalScheduleStateV425.mode==='month'?addMonths(date,step):addDays(date,step*(journalScheduleStateV425.mode==='day'?1:7)));journalScheduleV425()}));
 root.querySelectorAll('[data-j425-shift-month]').forEach(b=>b.addEventListener('click',()=>{const date=parseISODate(journalScheduleStateV425.anchor)||startOfToday();journalScheduleStateV425.anchor=toISODate(addMonths(date,Number(b.dataset.j425ShiftMonth)));journalScheduleV425()}));
 root.querySelectorAll('[data-j425-empty-date]').forEach(el=>el.addEventListener('dblclick',e=>{if(!e.target.closest('[data-schedule-id],[data-j456-day-focus],[data-j473-free-date]'))openScheduleDialog(newScheduleSeedForDate(el.dataset.j425EmptyDate))}));
 // A dedicated button works on touch and keyboard; double-click remains an optional shortcut.
 root.querySelectorAll('[data-j443-add-schedule-date]').forEach(button=>button.addEventListener('click',()=>openScheduleDialog(newScheduleSeedForDate(button.dataset.j443AddScheduleDate))));
 bindScheduleCardEvents();
 // Canonical edit/copy functions retain room, owner and revision checks.
 const previewRecord=()=>journalSchedulePreviewOwnerV459===ROOM_ID+'|'+getCurrentUser()
   ? state.schedules.find(s=>s.id===journalSchedulePreviewIdV459):null;
 root.querySelectorAll('[data-j459-review]').forEach(button=>button.addEventListener('click',()=>{
   const id=button.dataset.j459Review;
   if(!schedules.some(s=>s.id===id))return;
   if(journalSchedulePreviewIdV459===id){
     journalSchedulePreviewIdV459='';
     journalScheduleV425();
     requestAnimationFrame(()=>{
       const back=[...elements.scheduleView.querySelectorAll('[data-j459-review]')]
         .find(el=>el.dataset.j459Review===id);
       back?.focus({preventScroll:true});
     });
     return;
   }
   journalSchedulePreviewIdV459=id;
   journalScheduleV425();
   requestAnimationFrame(()=>{
     const preview=elements.scheduleView.querySelector('#j459SchedulePreview');
     if(!preview)return;
     if(journalScheduleInlineMediaV478.matches){
       preview.focus({preventScroll:true});
       // Tall notes must open at their heading, not halfway down the memo.
       preview.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
     } else {
       const selected=[...elements.scheduleView.querySelectorAll('[data-j459-review]')]
         .find(el=>el.dataset.j459Review===id);
       selected?.focus({preventScroll:true});
     }
   });
 }));
 root.querySelectorAll('[data-j460-preview-step]').forEach(button=>button.addEventListener('click',()=>{
   if(mode!=='day')return;
   const current=orderedDayV460.findIndex(item=>item.id===journalSchedulePreviewIdV459);
   const direction=Number(button.dataset.j460PreviewStep);
   if(![-1,1].includes(direction)||current<0)return;
   const next=orderedDayV460[current+direction];
   if(!next)return;
   journalSchedulePreviewIdV459=next.id;
   journalScheduleV425();
   requestAnimationFrame(()=>{
     const preview=elements.scheduleView.querySelector('#j459SchedulePreview');
     if(!preview)return;
     const compact=journalScheduleInlineMediaV478.matches;
     // The previous pager button was destroyed by the render. Keep its
     // direction keyboard-accessible instead of forcing Tab from the top.
     const continueButton=compact?preview.querySelector(
       '[data-j460-preview-step="'+direction+'"]:not([disabled])'):null;
     if(compact){
       // On phones, always reveal the next appointment's heading, even when
       // the old memo was longer than the viewport.
       preview.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
     }
     (continueButton||preview).focus({preventScroll:true});
   });
 }));
 root.querySelector('[data-j459-edit]')?.addEventListener('click',()=>{
   const record=previewRecord();
   if(!record)return;
   journalPrepareNoteReturnV479(record,'edit');
   openScheduleDialog(record);
 });
 root.querySelector('[data-j459-copy]')?.addEventListener('click',()=>{
   const record=previewRecord();
   if(!record)return;
   journalPrepareNoteReturnV479(record,'copy');
   openScheduleCopyDialog(record);
 });
 root.querySelector('[data-j459-back]')?.addEventListener('click',()=>{
   const id=journalSchedulePreviewIdV459;
   journalSchedulePreviewIdV459='';
   journalScheduleV425();
   requestAnimationFrame(()=>{
     const back=[...elements.scheduleView.querySelectorAll('[data-j459-review]')]
       .find(button=>button.dataset.j459Review===id);
     if(!back)return;
     back.focus({preventScroll:true});
     back.scrollIntoView({
       behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',
       block:'center'
     });
   });
 });
 const input=root.querySelector('[data-j425-schedule-query]');
 if(input){let composing=false;const apply=()=>{const cursor=input.selectionStart??input.value.length;elements.searchInput.value=input.value;elements.searchInput.dispatchEvent(new Event('input',{bubbles:true}));requestAnimationFrame(()=>{const next=elements.scheduleView.querySelector('[data-j425-schedule-query]');if(next){next.focus({preventScroll:true});try{next.setSelectionRange(cursor,cursor)}catch{}}})};input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>{composing=false;apply()});input.addEventListener('input',e=>{if(!composing&&!e.isComposing)apply()})}
}

function renderScheduleView(schedules) {
  if(typeof document!=='undefined' && document.documentElement?.dataset?.wbDisplay==='journal')return journalScheduleV425();
  syncScheduleTodayAnchor();
  const rangeLabel = formatScheduleRangeLabel();
  const body = state.scheduleDisplayMode === "calendar"
    ? renderScheduleCalendar(schedules)
    : renderScheduleList(schedules);

  elements.scheduleView.innerHTML = `
    <div class="schedule-head">
      <div class="schedule-toolbar-v176">
        <div class="schedule-toolbar-controls-v176">
          <button type="button" class="primary-button schedule-new-button" data-new-schedule>＋ 新しい予定</button>

          <div class="schedule-control-group">
            <span>表示期間</span>
            <div class="segmented-buttons">
              <button type="button" class="schedule-range ${state.scheduleRange === "today" ? "active" : ""}" data-schedule-range="today">今日</button>
              <button type="button" class="schedule-range ${state.scheduleRange === "week" ? "active" : ""}" data-schedule-range="week" title="今日から7日間を表示します">7日間</button>
              <button type="button" class="schedule-range ${state.scheduleRange === "month" ? "active" : ""}" data-schedule-range="month">今月</button>
            </div>
          </div>

          <div class="schedule-control-group">
            <span>表示日を移動</span>
            <div class="segmented-buttons">
              <button type="button" class="schedule-range" data-schedule-move="prev" ${state.scheduleRange === "today" ? 'disabled aria-disabled="true" title="「今日」表示中は移動できません"' : ''}>← 前へ</button>
              <button type="button" class="schedule-range" data-schedule-move="today">今日へ</button>
              <button type="button" class="schedule-range" data-schedule-move="next" ${state.scheduleRange === "today" ? 'disabled aria-disabled="true" title="「今日」表示中は移動できません"' : ''}>次へ →</button>
            </div>
          </div>

          <div class="schedule-control-group">
            <span>表示形式</span>
            <div class="segmented-buttons">
              <button type="button" class="schedule-range ${state.scheduleDisplayMode === "list" ? "active" : ""}" data-schedule-mode="list">一覧</button>
              <button type="button" class="schedule-range ${state.scheduleDisplayMode === "calendar" ? "active" : ""}" data-schedule-mode="calendar">月カレンダー</button>
            </div>
          </div>
        </div>

        <div class="schedule-toolbar-utility-v176">
          <div class="schedule-date-v176" aria-label="現在の表示日">
            <span class="schedule-range-label">${escapeHtml(rangeLabel)}</span>
          </div>
          <label class="schedule-search-v176">
            <span aria-hidden="true">⌕</span>
            <input type="search" autocomplete="off" aria-label="予定を検索" placeholder="予定名・メモ・場所・分類で検索" value="${escapeHtml(elements.searchInput?.value || '')}" />
          </label>
        </div>
      </div>
    </div>

    ${body}
  `;

  elements.scheduleView.querySelectorAll("[data-schedule-range]").forEach(button => {
    button.addEventListener("click", () => {
      state.scheduleRange = button.dataset.scheduleRange;
      if (state.scheduleRange === "today") syncScheduleTodayAnchor();
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
  bindScheduleSearchProxy();
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

  const journalMonth = document.documentElement.dataset.wbDisplay === 'journal';
  const todayInMonth = today.slice(0,7) === toISODate(monthStart).slice(0,7);
  const todayItems = todayInMonth
    ? schedules.filter(schedule => scheduleLocalDate(schedule) === today) : [];
  // Use the canonical filtered schedules and existing card-click handler, not
  // a second editor or an unfiltered read of the shared room data.
  const dailyPaper = journalMonth ? `<aside class="j-calendar-today-v389" aria-label="今日の予定">
    <div class="j-calendar-today-heading-v389">
      <small>DAILY NOTE / 今日の予定</small>
      <h4>${escapeHtml(today.replace(/-/g,' / '))}</h4>
      <span>${todayInMonth ? todayItems.length + ' 件' : '月を移動中'}</span>
    </div>
    <button type="button" class="j-calendar-go-today-v389" data-schedule-move="today">今日の月へ戻る</button>
    <div class="j-calendar-today-list-v389">
      ${todayInMonth ? (todayItems.length ? todayItems.map(item => `<button type="button" class="j-calendar-today-item-v389" data-schedule-id="${escapeHtml(item.id)}">
        <time>${escapeHtml(formatScheduleTime(item.startAt))}</time>
        <strong>${escapeHtml(item.title || '名称未設定の予定')}</strong>
        ${item.location ? `<span>${escapeHtml(item.location)}</span>` : ''}
      </button>`).join('') : '<p class="j-calendar-today-empty-v389">今日の予定はありません。<br>空いている時間を自由に使えます。</p>')
      : '<p class="j-calendar-today-empty-v389">表示月が異なります。<br>「今日の月へ戻る」で本日の予定を確認できます。</p>'}
    </div>
  </aside>` : '';
  return `${journalMonth ? '<div class="j-calendar-layout-v389">' : ''}<section class="schedule-calendar">
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
  </section>${dailyPaper}${journalMonth ? '</div>' : ''}`;
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

function syncScheduleTodayAnchor({ rerender = false } = {}) {
  if (state.scheduleRange !== "today") return false;
  const today = todayISO();
  if (state.scheduleAnchor === today) return false;
  state.scheduleAnchor = today;
  localStorage.setItem(scheduleAnchorKey(), state.scheduleAnchor);
  if (rerender) render();
  return true;
}

function installScheduleTodayLifecycle() {
  let dayBoundaryTimerV359 = 0;
  const sync = () => syncScheduleTodayAnchor({ rerender: state.layout === "schedule" });
  const clearDayBoundaryV359 = () => {
    if (!dayBoundaryTimerV359) return;
    clearTimeout(dayBoundaryTimerV359);
    dayBoundaryTimerV359 = 0;
  };
  const armDayBoundaryV359 = () => {
    clearDayBoundaryV359();
    if (document.hidden) return;
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const delay = Math.max(1, next.getTime() - now.getTime());
    dayBoundaryTimerV359 = setTimeout(() => {
      dayBoundaryTimerV359 = 0;
      sync();
      armDayBoundaryV359();
    }, delay);
  };
  const resumeDayBoundaryV359 = () => {
    sync();
    armDayBoundaryV359();
  };
  sync();
  armDayBoundaryV359();
  window.addEventListener("pageshow", resumeDayBoundaryV359);
  window.addEventListener("focus", resumeDayBoundaryV359);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearDayBoundaryV359();
    else resumeDayBoundaryV359();
  });
}

function moveScheduleAnchor(direction) {
  if (state.scheduleRange === "today" && ["prev", "next"].includes(direction)) {
    syncScheduleTodayAnchor({ rerender: true });
    return;
  }
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


function clearScheduleReminderTimer() {
  if (!state.scheduleReminderTimer) return;
  clearTimeout(state.scheduleReminderTimer);
  state.scheduleReminderTimer = 0;
}

function nextScheduleReminderBoundary(now = Date.now()) {
  if (!Array.isArray(state.schedules) || !state.schedules.length) return 0;

  const reminderBeforeMs = 15 * 60 * 1000;
  const seen = getScheduleReminderMap();
  let nextAt = 0;

  state.schedules.forEach(schedule => {
    if (!shouldScheduleReminderNotify(schedule)) return;

    const start = new Date(schedule.startAt).getTime();
    if (Number.isNaN(start) || start <= now) return;

    const key = scheduleReminderKey(schedule);
    if (seen[key]) return;

    const boundary = start - reminderBeforeMs;
    if (boundary <= now) return;
    if (!nextAt || boundary < nextAt) nextAt = boundary;
  });

  return nextAt;
}

function armScheduleReminderTimer() {
  clearScheduleReminderTimer();
  const now = Date.now();
  const nextAt = nextScheduleReminderBoundary(now);
  if (!nextAt) return;

  const maxDelay = 2147483647;
  const delay = Math.min(Math.max(1, nextAt - now), maxDelay);
  state.scheduleReminderTimer = setTimeout(() => {
    state.scheduleReminderTimer = 0;
    syncScheduleReminderWatcher();
  }, delay);
}

function syncScheduleReminderWatcher() {
  checkScheduleReminders();
  armScheduleReminderTimer();
}

function startScheduleReminderWatcher() {
  if (state.scheduleReminderWatcherStarted) return;
  state.scheduleReminderWatcherStarted = true;

  setTimeout(syncScheduleReminderWatcher, 1200);
  window.addEventListener("focus", syncScheduleReminderWatcher);
  window.addEventListener("pageshow", syncScheduleReminderWatcher);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncScheduleReminderWatcher();
  });
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
      syncScheduleReminderWatcher();
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

// Only the newest reminder owns title restoration; preserve the original page title.
let reminderTitleRestoreTimer = 0;
let reminderTitleBeforeFlash = "";
function flashReminderTitle(message) {
  if (reminderTitleRestoreTimer) clearTimeout(reminderTitleRestoreTimer);
  else reminderTitleBeforeFlash = document.title;
  document.title = `🔔 ${message}`;
  reminderTitleRestoreTimer = setTimeout(() => {
    reminderTitleRestoreTimer = 0;
    document.title = reminderTitleBeforeFlash || "業務管理ボード";
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

function getFilteredSchedules(range = getScheduleRange()) {
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
  // A fresh dialog never inherits a cancelled JOURNAL free-time navigation.
  delete elements.scheduleForm.dataset.journalGapFocus;
  const editing = Boolean(schedule?.id);
  elements.scheduleDialogTitle.textContent = editing ? "予定を編集" : "新しい予定";
  journalSchedulePresetExplicitV565 = false;
  syncAssigneeOptions($("scheduleAssignee"));
  syncCategoryOptions($("scheduleCategory"));
  syncScheduleRelatedTaskOptions();

  // Capture the form's original revision and identity when it opens.
  // Never replace this with the latest subscribed revision on submit.
  elements.scheduleForm.dataset.roomId = ROOM_ID;
  elements.scheduleForm.dataset.selectedUser = getCurrentUser();
  elements.scheduleForm.dataset.baseRevision = String(editing ? normalizeRevision(schedule.revision) : 0);
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
  $("copySchedule").hidden = false;
  $("copySchedule").textContent = editing ? "コピー" : "まとめて作成";
  elements.deleteSchedule.hidden = !editing;
  elements.scheduleDialog.showModal();
  journalRefreshScheduleDurationButtonsV565();
  $("scheduleTitle").focus();
}

const SCHEDULE_COPY_MAX = 200;
const SCHEDULE_COPY_LARGE_WARNING = 50;
let scheduleCopySourceId = "";
let scheduleCopyDraftSource = null;
let scheduleCopyFromNewForm = false;
let scheduleCopySelectedDates = new Set();
let scheduleCopyBaseRevision = 0;
let scheduleCopyOwnerUser = "";
let scheduleCopyOwnerRoom = ROOM_ID;

function scheduleCopySource() {
  return scheduleCopyFromNewForm
    ? scheduleCopyDraftSource
    : state.schedules.find(item => item.id === scheduleCopySourceId) || null;
}

function scheduleCopyDefaultStart(source, fromNewForm = false) {
  const start = new Date(source?.startAt || defaultScheduleStart());
  return toISODate(fromNewForm ? start : addDays(start, 1));
}

function openScheduleCopyDialog(source, { fromNewForm = false } = {}) {
  if (!source?.id) return;
  scheduleCopyFromNewForm = Boolean(fromNewForm);
  scheduleCopyDraftSource = fromNewForm ? { ...source } : null;
  scheduleCopySourceId = source.id;
  scheduleCopyBaseRevision = normalizeRevision(source.revision);
  scheduleCopyOwnerUser = getCurrentUser();
  scheduleCopyOwnerRoom = ROOM_ID;
  scheduleCopySelectedDates = new Set();

  const sourceStart = new Date(source.startAt);
  const defaultStart = scheduleCopyDefaultStart(source, fromNewForm);
  $("scheduleCopyDialogTitle").textContent = fromNewForm ? "予定をまとめて作成" : "予定をコピー";
  $("scheduleCopySourceLabel").textContent = fromNewForm ? "入力中の予定" : "コピー元";
  $("scheduleCopyBack").textContent = fromNewForm ? "新規予定へ戻る" : "予定詳細へ戻る";
  $("scheduleCopyPreviewHint").textContent = fromNewForm
    ? "元の予定は別途保存せず、指定した日付に予定を作成します。"
    : "実際に作成される日付を確認してからコピーします。";
  $("scheduleCopySourceTitle").textContent = source.title || "名称未設定の予定";
  $("scheduleCopySourceTime").textContent = formatScheduleDateTimeRange(source);
  $("scheduleCopyMethod").value = "once";
  $("scheduleCopyStartDate").value = defaultStart;
  $("scheduleCopyDateInput").value = defaultStart;
  $("scheduleCopyInterval").value = "1";
  $("scheduleCopyCount").value = "4";
  $("scheduleCopyEndMode").value = "count";
  $("scheduleCopyEndDate").value = toISODate(addMonths(parseISODate(defaultStart) || startOfToday(), 3));

  if (!Number.isNaN(sourceStart.getTime())) {
    $("scheduleCopyMonthDay").value = String(sourceStart.getDate());
    $("scheduleCopyNth").value = String(Math.min(5, getNthWeekInMonth(sourceStart)));
    $("scheduleCopyNthWeekday").value = String(sourceStart.getDay());
    document.querySelectorAll("[data-copy-weekday]").forEach(input => {
      input.checked = Number(input.value) === sourceStart.getDay();
    });
  }

  $("scheduleCopySubmit").dataset.operationKey = operationKey("schedule-copy", source.id);
  renderScheduleCopySelectedDates();
  syncScheduleCopyUi();
  $("scheduleCopyDialog").showModal();
}

function closeScheduleCopyDialog(reopenSource = false) {
  const source = scheduleCopySource();
  const fromNewForm = scheduleCopyFromNewForm;
  const returnToJournalNote = !fromNewForm
    && journalNoteDialogReturnV479?.id===scheduleCopySourceId
    && journalNoteDialogReturnV479.room===ROOM_ID
    && journalNoteDialogReturnV479.user===getCurrentUser()
    // Direct note -> copy returns to the note. Edit -> copy -> back still
    // returns to the editor; a completed edit-origin copy returns to the note.
    && (!reopenSource || journalNoteDialogReturnV479.action==='copy');
  $("scheduleCopyDialog")?.close();
  scheduleCopySelectedDates = new Set();
  scheduleCopySourceId = "";
  scheduleCopyDraftSource = null;
  scheduleCopyFromNewForm = false;
  scheduleCopyBaseRevision = 0;
  scheduleCopyOwnerUser = "";
  if(returnToJournalNote){
    journalRestoreNoteV479();
    return;
  }
  if (reopenSource) {
    if (fromNewForm) {
      elements.scheduleDialog.showModal();
      $("scheduleTitle").focus();
    } else if (source) openScheduleDialog(source);
  }
}

function scheduleCopyMethodPresentation(method) {
  const presentations = {
    once: ["指定した日に1件コピー", "下の「コピー先の日付」を選ぶだけでコピーできます。", "設定する項目：コピー先の日付", "コピー先の日付を選んでください。"],
    dates: ["必要な日だけ複数選んでコピー", "日付を1つずつ追加します。連続していない日をまとめて指定したい場合に向いています。", "設定する項目：コピーする日を追加", "日付を選び「この日を追加」を繰り返してください。"],
    daily: ["毎日またはN日おきにコピー", "開始日、何日おきか、何件作るか（または終了日）を順番に設定します。", "設定する項目：開始日 → 間隔 → 終了条件", "開始日から、指定した日数間隔で予定を作成します。"],
    weekdays: ["平日だけコピー", "土日を自動で除外して、月〜金だけ予定を作成します。", "設定する項目：開始日 → 終了条件", "開始日以降の平日だけを対象にします。"],
    weekly: ["毎週、選んだ曜日にコピー", "開始日、何週おきか、対象曜日、終了条件を設定します。複数曜日も選べます。", "設定する項目：開始日 → 間隔 → 曜日 → 終了条件", "曜日は複数選択できます。"],
    monthlyDay: ["毎月、指定した日付にコピー", "例：毎月15日、2か月ごとの25日などを作成できます。存在しない日付はスキップします。", "設定する項目：開始日 → 間隔 → 毎月の日付 → 終了条件", "「毎月の何日」に1〜31を指定してください。"],
    monthlyNth: ["毎月、第n曜日にコピー", "例：毎月第2木曜日、2か月ごとの最終金曜日などを作成できます。", "設定する項目：開始日 → 間隔 → 何週目・曜日 → 終了条件", "何週目と曜日を組み合わせて指定してください。"],
    monthEnd: ["毎月の月末にコピー", "各月の最終日を自動で判定します。2か月ごとなどの間隔指定もできます。", "設定する項目：開始日 → 間隔 → 終了条件", "月末の日付は自動計算されます。"],
    lastWeekday: ["毎月の最終平日にコピー", "月末が土日の場合は直前の金曜日に自動調整します。", "設定する項目：開始日 → 間隔 → 終了条件", "最終平日は自動計算されます。"],
    yearly: ["毎年、コピー元と同じ月日にコピー", "コピー元の月日を維持し、毎年またはN年ごとに予定を作成します。", "設定する項目：開始日 → 間隔 → 終了条件", "月日はコピー元から引き継ぎます。開始日は最初に作る年の基準です。"]
  };
  const [title, text, steps, settings] = presentations[method] || presentations.once;
  return { title, text, steps, settings };
}

function syncScheduleCopyUi() {
  const method = $("scheduleCopyMethod").value;
  const recurring = !["once", "dates"].includes(method);
  const intervalMethods = ["daily", "weekly", "monthlyDay", "monthlyNth", "monthEnd", "lastWeekday", "yearly"];
  const unitMap = { daily: "日ごと", weekly: "週ごと", monthlyDay: "か月ごと", monthlyNth: "か月ごと", monthEnd: "か月ごと", lastWeekday: "か月ごと", yearly: "年ごと" };
  const presentation = scheduleCopyMethodPresentation(method);

  $("scheduleCopyDialog").dataset.copyMethod = method;
  $("scheduleCopyMethodGuideTitle").textContent = presentation.title;
  $("scheduleCopyMethodGuideText").textContent = presentation.text;
  $("scheduleCopyMethodGuideSteps").textContent = presentation.steps;
  $("scheduleCopySettingsHint").textContent = presentation.settings;

  $("scheduleCopyStartRow").hidden = method === "dates";
  const startText = $("scheduleCopyStartRow").childNodes[0];
  if (startText) startText.textContent = method === "once" ? "コピー先の日付 " : method === "yearly" ? "最初に作る年の基準日 " : "開始日 ";
  $("scheduleCopyIntervalRow").hidden = !intervalMethods.includes(method);
  $("scheduleCopyIntervalUnit").textContent = unitMap[method] || "";
  $("scheduleCopyWeekdayRow").hidden = method !== "weekly";
  $("scheduleCopyMonthDayRow").hidden = method !== "monthlyDay";
  $("scheduleCopyNthRow").hidden = method !== "monthlyNth";
  $("scheduleCopyDatesRow").hidden = method !== "dates";
  $("scheduleCopyEndRow").hidden = !recurring;
  const endByDate = $("scheduleCopyEndMode").value === "date";
  $("scheduleCopyCountRow").hidden = !recurring || endByDate;
  $("scheduleCopyEndDateRow").hidden = !recurring || !endByDate;
  syncScheduleCopyPreview();
}
function addScheduleCopyDateFromInput() {
  const value = $("scheduleCopyDateInput").value;
  if (!parseISODate(value)) return toast("追加する日付を選択してください", true);
  if (scheduleCopySelectedDates.has(value)) return toast("この日付はすでに追加されています", true);
  scheduleCopySelectedDates.add(value);
  renderScheduleCopySelectedDates();
  syncScheduleCopyPreview();
}

function renderScheduleCopySelectedDates() {
  const host = $("scheduleCopyDateList");
  if (!host) return;
  const dates = [...scheduleCopySelectedDates].sort();
  host.innerHTML = dates.length
    ? dates.map(date => `<button type="button" class="schedule-copy-date-chip" data-remove-copy-date="${escapeHtml(date)}" title="この日付を外す">${escapeHtml(formatScheduleCopyDate(date))}<span>×</span></button>`).join("")
    : '<span class="schedule-copy-empty">日付を追加するとここに表示されます。</span>';
}

function formatScheduleCopyDate(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return isoDate;
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${isoDate}（${weekday}）`;
}

function scheduleCopyDateSerial(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function scheduleCopyNthWeekday(year, monthIndex, nth, weekday) {
  const lastDay = daysInMonth(new Date(year, monthIndex, 1));
  if (nth === "last") {
    const date = new Date(year, monthIndex, lastDay);
    while (date.getDay() !== weekday) date.setDate(date.getDate() - 1);
    return date;
  }
  const number = clampNumber(nth, 1, 5, 1);
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (number - 1) * 7;
  return day <= lastDay ? new Date(year, monthIndex, day) : null;
}

function scheduleCopyLastWeekday(year, monthIndex) {
  const date = new Date(year, monthIndex, daysInMonth(new Date(year, monthIndex, 1)));
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
  return date;
}

function readScheduleCopyConfig() {
  return {
    method: $("scheduleCopyMethod").value,
    startDate: $("scheduleCopyStartDate").value,
    interval: clampNumber($("scheduleCopyInterval").value, 1, 36, 1),
    weekdays: [...document.querySelectorAll("[data-copy-weekday]:checked")].map(input => Number(input.value)),
    monthDay: clampNumber($("scheduleCopyMonthDay").value, 1, 31, 1),
    nth: $("scheduleCopyNth").value,
    nthWeekday: clampWeekday($("scheduleCopyNthWeekday").value),
    endMode: $("scheduleCopyEndMode").value,
    count: clampNumber($("scheduleCopyCount").value, 1, SCHEDULE_COPY_MAX, 4),
    endDate: $("scheduleCopyEndDate").value,
    selectedDates: [...scheduleCopySelectedDates].sort()
  };
}

function buildScheduleCopyDates(source, config = readScheduleCopyConfig()) {
  const result = { dates: [], truncated: false, error: "" };
  if (!source) {
    result.error = "コピー元の予定が見つかりません";
    return result;
  }

  if (config.method === "dates") {
    result.dates = [...new Set(config.selectedDates.filter(date => parseISODate(date)))].sort();
    if (!result.dates.length) result.error = "コピーする日付を追加してください";
    return result;
  }

  const start = parseISODate(config.startDate);
  if (!start) {
    result.error = "開始日を指定してください";
    return result;
  }
  start.setHours(0, 0, 0, 0);

  if (config.method === "once") {
    result.dates = [toISODate(start)];
    return result;
  }

  const end = config.endMode === "date" ? parseISODate(config.endDate) : null;
  if (config.endMode === "date") {
    if (!end) {
      result.error = "終了日を指定してください";
      return result;
    }
    end.setHours(0, 0, 0, 0);
    if (end < start) {
      result.error = "終了日は開始日以降にしてください";
      return result;
    }
  }

  if (config.method === "weekly" && !config.weekdays.length) {
    result.error = "曜日を1つ以上選択してください";
    return result;
  }

  const seen = new Set();
  const targetCount = config.endMode === "count" ? config.count : SCHEDULE_COPY_MAX + 1;
  const pushCandidate = candidate => {
    if (!candidate || Number.isNaN(candidate.getTime())) return false;
    candidate.setHours(0, 0, 0, 0);
    if (candidate < start) return false;
    if (end && candidate > end) return "stop";
    const iso = toISODate(candidate);
    if (!seen.has(iso)) {
      seen.add(iso);
      result.dates.push(iso);
    }
    if (result.dates.length > SCHEDULE_COPY_MAX) {
      result.truncated = true;
      result.dates = result.dates.slice(0, SCHEDULE_COPY_MAX);
      return "stop";
    }
    if (config.endMode === "count" && result.dates.length >= targetCount) return "stop";
    return false;
  };

  if (config.method === "daily") {
    let cursor = new Date(start);
    for (let guard = 0; guard < 100000; guard += 1) {
      if (pushCandidate(new Date(cursor)) === "stop") break;
      cursor = addDays(cursor, config.interval);
    }
  } else if (config.method === "weekdays") {
    let cursor = new Date(start);
    for (let guard = 0; guard < 100000; guard += 1) {
      if (cursor.getDay() >= 1 && cursor.getDay() <= 5) {
        if (pushCandidate(new Date(cursor)) === "stop") break;
      } else if (end && cursor > end) break;
      cursor = addDays(cursor, 1);
    }
  } else if (config.method === "weekly") {
    const anchorWeek = startOfWeekMonday(start);
    const weekdays = new Set(config.weekdays);
    let cursor = new Date(start);
    for (let guard = 0; guard < 100000; guard += 1) {
      if (end && cursor > end) break;
      const weekStart = startOfWeekMonday(cursor);
      const weekIndex = Math.floor((scheduleCopyDateSerial(weekStart) - scheduleCopyDateSerial(anchorWeek)) / 7);
      if (weekIndex >= 0 && weekIndex % config.interval === 0 && weekdays.has(cursor.getDay())) {
        if (pushCandidate(new Date(cursor)) === "stop") break;
      }
      cursor = addDays(cursor, 1);
    }
  } else if (["monthlyDay", "monthlyNth", "monthEnd", "lastWeekday"].includes(config.method)) {
    let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
    for (let guard = 0; guard < 10000; guard += 1) {
      let candidate = null;
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();
      if (config.method === "monthlyDay") {
        const lastDay = daysInMonth(monthCursor);
        if (config.monthDay <= lastDay) candidate = new Date(year, month, config.monthDay);
      } else if (config.method === "monthlyNth") {
        candidate = scheduleCopyNthWeekday(year, month, config.nth, config.nthWeekday);
      } else if (config.method === "monthEnd") {
        candidate = new Date(year, month, daysInMonth(monthCursor));
      } else {
        candidate = scheduleCopyLastWeekday(year, month);
      }
      const outcome = pushCandidate(candidate);
      if (outcome === "stop") break;
      if (end && monthCursor > end) break;
      monthCursor = addMonths(monthCursor, config.interval);
    }
  } else if (config.method === "yearly") {
    const sourceStart = new Date(source.startAt);
    const month = sourceStart.getMonth();
    const day = sourceStart.getDate();
    let year = start.getFullYear();
    for (let guard = 0; guard < 1000; guard += 1) {
      const candidate = new Date(year, month, day);
      if (candidate.getMonth() === month && candidate.getDate() === day) {
        const outcome = pushCandidate(candidate);
        if (outcome === "stop") break;
      }
      if (end && candidate > end && year > end.getFullYear()) break;
      year += config.interval;
    }
  } else {
    result.error = "コピー方法を選択してください";
  }

  if (!result.error && !result.dates.length) result.error = "条件に該当する日付がありません";
  return result;
}

function scheduleCopyDraftForDate(source, isoDate, id, timestamp = Date.now(), seriesId = "") {
  const sourceStart = new Date(source.startAt);
  const sourceEnd = new Date(source.endAt);
  const day = parseISODate(isoDate);
  if (!day || Number.isNaN(sourceStart.getTime()) || Number.isNaN(sourceEnd.getTime())) return null;
  day.setHours(sourceStart.getHours(), sourceStart.getMinutes(), sourceStart.getSeconds(), sourceStart.getMilliseconds());
  const duration = Math.max(60000, sourceEnd.getTime() - sourceStart.getTime());
  const draft = normalizeSchedule({
    id,
    title: source.title,
    startAt: day.toISOString(),
    endAt: new Date(day.getTime() + duration).toISOString(),
    assignee: source.assignee,
    location: source.location,
    category: source.category,
    memo: source.memo,
    relatedTaskId: source.relatedTaskId,
    // New copies are grouped by this batch only; the source event remains
    // independent, even if it was itself part of another recurring series.
    recurrenceSeriesId: seriesId,
    recurrenceDate: seriesId ? isoDate : "",
    revision: 0,
    createdAt: timestamp,
    createdBy: getCurrentUser(),
    updatedAt: timestamp,
    updatedBy: getCurrentUser()
  });
  draft.lastChange = makeScheduleChangeInfo(null, draft);
  return draft;
}

function scheduleCopyConflicts(source, dates) {
  return dates.flatMap((isoDate, index) => {
    const draft = scheduleCopyDraftForDate(source, isoDate, `preview-copy-${index}`, Date.now());
    if (!draft) return [];
    return getScheduleConflicts(draft).map(conflict => ({ date: isoDate, conflict }));
  });
}

function syncScheduleCopyPreview() {
  const source = scheduleCopySource();
  const result = buildScheduleCopyDates(source);
  const summary = $("scheduleCopyPreviewSummary");
  const datesHost = $("scheduleCopyPreviewDates");
  const note = $("scheduleCopyPreviewNote");
  const allDetails = $("scheduleCopyPreviewAll");
  const allSummary = $("scheduleCopyPreviewAllSummary");
  const allDatesHost = $("scheduleCopyPreviewAllDates");
  const conflictDetails = $("scheduleCopyConflictDetails");
  const conflictSummary = $("scheduleCopyConflictSummary");
  const conflictList = $("scheduleCopyConflictList");
  if (!summary || !datesHost || !note) return;

  const submit = $("scheduleCopySubmit");
  const resetDetails = () => {
    if (allDetails) allDetails.hidden = true;
    if (allDatesHost) allDatesHost.innerHTML = "";
    if (conflictDetails) conflictDetails.hidden = true;
    if (conflictList) conflictList.innerHTML = "";
  };

  if (result.error) {
    summary.textContent = result.error;
    datesHost.innerHTML = "";
    note.textContent = "";
    note.dataset.level = "info";
    resetDetails();
    if (submit) { submit.disabled = true; submit.textContent = "条件を確認してください"; }
    return;
  }

  const conflicts = scheduleCopyConflicts(source, result.dates);
  const conflictsByDate = new Map();
  conflicts.forEach(item => {
    if (!conflictsByDate.has(item.date)) conflictsByDate.set(item.date, []);
    conflictsByDate.get(item.date).push(item);
  });
  const renderDateChip = date => {
    const hasConflict = conflictsByDate.has(date);
    return `<span${hasConflict ? ' class="has-conflict"' : ''} data-copy-preview-date="${escapeHtml(date)}">${escapeHtml(formatScheduleCopyDate(date))}${hasConflict ? '<b>重複</b>' : ''}</span>`;
  };

  summary.textContent = `${result.dates.length}件の予定を作成`;
  if (submit) {
    submit.disabled = result.truncated || result.dates.length < 1 || result.dates.length > SCHEDULE_COPY_MAX;
    submit.textContent = submit.disabled ? "条件を確認してください" : `${result.dates.length}件${scheduleCopyFromNewForm ? "作成する" : "コピーする"}`;
  }

  datesHost.innerHTML = result.dates.slice(0, 8).map(renderDateChip).join("");
  if (allDetails && allSummary && allDatesHost) {
    if (result.dates.length > 8) {
      allDetails.hidden = false;
      allDetails.open = false;
      allSummary.textContent = `すべての日付を確認（${result.dates.length}件）`;
      allDatesHost.innerHTML = result.dates.map(renderDateChip).join("");
    } else {
      allDetails.hidden = true;
      allDetails.open = false;
      allDatesHost.innerHTML = "";
    }
  }

  if (conflictDetails && conflictSummary && conflictList) {
    if (conflictsByDate.size) {
      conflictDetails.hidden = false;
      conflictDetails.open = false;
      conflictSummary.textContent = `重複候補を確認（${conflictsByDate.size}日）`;
      conflictList.innerHTML = [...conflictsByDate.entries()].map(([date, items]) => {
        const titles = [...new Set(items.map(item => String(item.conflict?.title || "既存予定")))];
        return `<div class="schedule-copy-conflict-item"><strong>${escapeHtml(formatScheduleCopyDate(date))}</strong><span>${titles.map(escapeHtml).join(" / ")}</span></div>`;
      }).join("");
    } else {
      conflictDetails.hidden = true;
      conflictDetails.open = false;
      conflictList.innerHTML = "";
    }
  }

  const notes = [];
  if (result.dates.length > 1) {
    notes.push("今回まとめて作成する予定は同じ系列として扱い、削除時に範囲を選べます（コピー元は対象外）。");
  }
  if (result.truncated) notes.push(`最大${SCHEDULE_COPY_MAX}件を超えています。期間または間隔を調整してください。`);
  if (result.dates.length >= SCHEDULE_COPY_LARGE_WARNING) notes.push(`${result.dates.length}件を一括作成します。内容と期間をもう一度確認してください。`);
  if (["monthlyDay", "yearly"].includes($("scheduleCopyMethod").value)) notes.push("存在しない日付（例：2月30日）は自動でスキップします。");
  if (conflictsByDate.size) notes.push(`「重複」表示のコピー先が${conflictsByDate.size}日あります。既存予定を確認してからコピーしてください。`);
  note.textContent = notes.join(" ");
  note.dataset.level = result.dates.length >= SCHEDULE_COPY_LARGE_WARNING || conflictsByDate.size ? "warning" : "info";
}

async function copyScheduleOccurrences(source, dates, sourceIsDraft = false) {
  const timestamp = Date.now();
  // Each batch gets a unique identity, never inferred from matching titles.
  // Single-occurrence copies remain ordinary independent schedules.
  const seriesId = dates.length > 1 ? "copy-" + generateScheduleId() : "";
  const items = dates.map((date, index) =>
    scheduleCopyDraftForDate(source, date, generateScheduleId(), timestamp + index, seriesId)).filter(Boolean);
  if (items.length !== dates.length) return { ok: false, error: "invalid-copy-date" };
  const affectedPaths = items.map(item => `rooms/${ROOM_ID}/schedules/${item.id}`);

  return executeWrite("schedule-copy", source.id, async () => {
    if (state.connectionMode === "local-only") {
      return transactionRoom(root => {
        const currentSource = root.schedules?.[source.id];
        if (!sourceIsDraft && (!currentSource || normalizeRevision(currentSource.revision) !== normalizeRevision(source.revision))) throw new Error("conflict");
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
        if (!sourceIsDraft && (!currentSource || normalizeRevision(currentSource.revision) !== normalizeRevision(source.revision))) throw new Error("conflict");
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

async function submitScheduleCopy() {
  const source = scheduleCopySource();
  const fromNewForm = scheduleCopyFromNewForm;
  if (!source) return toast("予定の入力内容が見つかりません", true);
  if (scheduleCopyOwnerRoom !== ROOM_ID || scheduleCopyOwnerUser !== getCurrentUser()
    || (!fromNewForm && normalizeRevision(source.revision) !== scheduleCopyBaseRevision)) {
    return toast("予定または利用者が更新されました。開き直してください。", true);
  }
  const result = buildScheduleCopyDates(source);
  if (result.error) return toast(result.error, true);
  if (result.truncated || result.dates.length > SCHEDULE_COPY_MAX) return toast(`一度に作成できるのは${SCHEDULE_COPY_MAX}件までです`, true);

  const conflicts = scheduleCopyConflicts(source, result.dates);
  if (conflicts.length) {
    const targetDates = [...new Set(conflicts.map(item => item.date))];
    const details = conflicts.slice(0, 5).map(item => `・${formatScheduleCopyDate(item.date)}：${item.conflict.title}`).join("\n");
    if (!confirm(`既存予定と時間が重なるコピー先が${targetDates.length}日あります。\n\n${details}${conflicts.length > 5 ? `\nほか${conflicts.length - 5}件` : ""}\n\nこのままコピーしますか？`)) return;
  }
  if (scheduleCopyOwnerRoom !== ROOM_ID || scheduleCopyOwnerUser !== getCurrentUser()
    || (!fromNewForm && normalizeRevision(scheduleCopySource()?.revision) !== scheduleCopyBaseRevision)) {
    return toast("予定または利用者が更新されたため作成を中止しました。", true);
  }
  const copyResult = await copyScheduleOccurrences(source, result.dates, fromNewForm);
  if (!copyResult.ok) return showWriteFailure(copyResult, "予定を作成できませんでした。条件はそのままです。");
  const count = result.dates.length;
  closeScheduleCopyDialog(false);
  toast(`${count}件の予定を${fromNewForm ? "作成" : "コピー"}しました`);
}

// The canonical schedule draft construction is shared between the existing form
// and the independent Palette NEXT editor. Never build a second schedule schema.
function buildScheduleDraftFromValuesV372(values, id, existing = null, revision = 0) {
  const start = new Date(values.startAt);
  const end = new Date(values.endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    return { error: "開始日時と終了日時を入力してください" };
  const title = String(values.title || "").trim();
  if (!title) return { error: "予定の件名を入力してください" };
  if (end <= start) return { error: "終了日時は開始日時より後にしてください" };
  const now = Date.now();
  return { schedule: normalizeSchedule({
    id, title, startAt: start.toISOString(), endAt: end.toISOString(),
    assignee: values.assignee,
    location: String(values.location || "").trim(),
    category: values.category,
    memo: String(values.memo || "").trim(),
    relatedTaskId: String(values.relatedTaskId || ""),
    // Editing a single occurrence keeps its existing independent-copy batch.
    recurrenceSeriesId: existing?.recurrenceSeriesId || "",
    recurrenceDate: existing?.recurrenceDate || "",
    revision,
    createdAt: existing?.createdAt || now, createdBy: existing?.createdBy || getCurrentUser(),
    updatedAt: now, updatedBy: getCurrentUser()
  }) };
}

function readScheduleDraftFromForm(id, existing = null, revision = 0) {
  return buildScheduleDraftFromValuesV372({
    title: $("scheduleTitle").value,
    startAt: $("scheduleStart").value, endAt: $("scheduleEnd").value,
    assignee: $("scheduleAssignee").value, location: $("scheduleLocation").value,
    category: $("scheduleCategory").value, memo: $("scheduleMemo").value,
    relatedTaskId: $("scheduleRelatedTask").value
  }, id, existing, revision);
}

async function saveScheduleFromForm() {
  if (elements.scheduleForm.dataset.roomId !== ROOM_ID
    || elements.scheduleForm.dataset.selectedUser !== getCurrentUser()) {
    return toast("ルームまたは利用者が変更されました。予定を開き直してください。", true);
  }
  const editingId = $("scheduleId").value;
  const id = editingId || generateScheduleId();
  const expectedRevision = Number(elements.scheduleForm.dataset.baseRevision);
  const existing = state.schedules.find(s => s.id === editingId);
  if (editingId && (!existing || normalizeRevision(existing.revision) !== expectedRevision)) {
    return showWriteFailure({ error: 'revision-or-relation-mismatch' }, "予定を更新できませんでした。");
  }
  const draftResult = readScheduleDraftFromForm(id, existing, editingId ? expectedRevision : 0);
  if (draftResult.error) return toast(draftResult.error, true);
  const schedule = draftResult.schedule;

  const conflicts = getScheduleConflicts(schedule);
  if (conflicts.length) {
    const conflictText = conflicts.slice(0, 3).map(item => `・${formatScheduleTime(item.startAt)}〜${formatScheduleTime(item.endAt)} ${item.title}`).join("\n");
    if (!confirm(`同じ担当者の予定と時間が重なっています。\n\n${conflictText}\n\nこのまま保存しますか？`)) return;
  }

  const changeInfo = makeScheduleChangeInfo(existing, schedule);
  schedule.lastChange = changeInfo;
  const result = await persistSchedule(schedule);
  if (!result.ok) return showWriteFailure(result, "予定を保存できませんでした。入力内容はそのままです。");
  // This is a display-only follow-up after the canonical write succeeds.
  // Other entry points keep the original save/close/toast behavior.
  const followJournalGapV466 = !editingId
    && elements.scheduleForm.dataset.journalGapFocus === '1'
    && elements.scheduleForm.dataset.roomId === ROOM_ID
    && elements.scheduleForm.dataset.selectedUser === getCurrentUser()
    && document.documentElement.dataset.wbDisplay === 'journal';
  delete elements.scheduleForm.dataset.journalGapFocus;
  elements.scheduleDialog.close();
  if (followJournalGapV466) {
    journalScheduleStateV425.anchor=toISODate(new Date(schedule.startAt));
    journalScheduleStateV425.mode='day';
    journalSchedulePreviewIdV459=schedule.id;
    journalScheduleV425();
    requestAnimationFrame(()=>{
      const view=elements.scheduleView;
      const record=[...view.querySelectorAll('[data-j459-record]')]
        .find(item=>item.dataset.j459Record===schedule.id);
      const note=view.querySelector('#j459SchedulePreview');
      if (record && note) {
        note.focus({preventScroll:true});
        if (window.matchMedia('(max-width:1190px)').matches)
          note.scrollIntoView({
            behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',
            block:'start'
          });
        toast("予定を保存しました。日別ノートで確認できます");
      } else {
        toast("予定を保存しました。表示条件により一覧に見えない場合は検索・担当をご確認ください");
      }
    });
    return;
  }
  toast("予定を保存しました");
}

// JOURNAL duration controls edit only the existing start/end inputs. The
// task and schedule data models and the canonical save path stay unchanged.
const JOURNAL_SCHEDULE_DURATIONS_V565 = [30, 60, 90, 120];
let journalSchedulePresetExplicitV565 = false;
let journalSchedulePresetMinutesV565 = 60;
function journalRefreshScheduleDurationButtonsV565() {
  const start = new Date($("scheduleStart").value);
  const end = new Date($("scheduleEnd").value);
  const elapsed = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
    ? (end.getTime() - start.getTime()) / 60000 : NaN;
  elements.scheduleDialog.querySelectorAll('[data-j565-schedule-minutes]').forEach(button => {
    const selected = elapsed === Number(button.dataset.j565ScheduleMinutes);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function journalApplyScheduleDurationV565(minutes) {
  if (document.documentElement.dataset.wbDisplay !== 'journal'
    || !JOURNAL_SCHEDULE_DURATIONS_V565.includes(minutes)) return;
  const start = new Date($("scheduleStart").value);
  if (!Number.isFinite(start.getTime())) return;
  journalSchedulePresetExplicitV565 = true;
  journalSchedulePresetMinutesV565 = minutes;
  $("scheduleEnd").value = toDateTimeLocalValue(new Date(start.getTime() + minutes * 60000).toISOString());
  journalRefreshScheduleDurationButtonsV565();
}
function syncScheduleEndFromStart() {
  const startValue = $("scheduleStart").value;
  if (!startValue) return;
  const start = new Date(startValue);
  if (!Number.isFinite(start.getTime())) return;

  if (document.documentElement.dataset.wbDisplay === 'journal' && journalSchedulePresetExplicitV565) {
    $("scheduleEnd").value = toDateTimeLocalValue(new Date(start.getTime()
      + journalSchedulePresetMinutesV565 * 60000).toISOString());
    journalRefreshScheduleDurationButtonsV565();
    return;
  }
  const endValue = $("scheduleEnd").value;
  const end = endValue ? new Date(endValue) : null;
  // Preserve a deliberately longer appointment; correct only invalid/end-before-start.
  if (!end || !Number.isFinite(end.getTime()) || end <= start) {
    $("scheduleEnd").value = toDateTimeLocalValue(addHours(start, 1).toISOString());
  }
  journalRefreshScheduleDurationButtonsV565();
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
  if (elements.favoriteOnly) elements.favoriteOnly.checked = false;

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
  clearTaskDialogContexts();
  state.pendingScheduleTaskLink = schedule.id;
  openTaskDialog(null, { preserveScheduleLink: true });
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
    ...schedule,
    id: schedule.id || generateScheduleId(),
    title: String(schedule.title || "").trim() || "名称未設定の予定",
    startAt,
    endAt,
    assignee: normalizeUser(schedule.assignee || getCurrentUser()),
    location: String(schedule.location || "").trim(),
    category: state.categories.includes(schedule.category) ? schedule.category : (schedule.category || state.categories[0] || "その他"),
    memo: String(schedule.memo || "").trim(),
    relatedTaskId: String(schedule.relatedTaskId || ""),
    recurrenceSeriesId: String(schedule.recurrenceSeriesId || ""),
    recurrenceDate: validRecurrenceDate(schedule.recurrenceDate) ? String(schedule.recurrenceDate) : "",
    revision: normalizeRevision(schedule.revision),
    createdAt: finiteTimestamp(schedule.createdAt, 0),
    createdBy: schedule.createdBy || getCurrentUser(),
    updatedAt: finiteTimestamp(schedule.updatedAt, 0),
    updatedBy: schedule.updatedBy || getCurrentUser(),
    lastChange: normalizeActivityChange(schedule.lastChange)
  };
}

async function persistSchedule(schedule) {
  const expectedRevision = normalizeRevision(schedule.revision);
  return executeWrite('schedule', schedule.id, () => transactionRecord('schedules', schedule.id, expectedRevision, () => schedule));
}

async function deleteSchedule(id, expectedRevision = null) {
  const schedule = state.schedules.find(item => item.id === id);
  if (!schedule) return { ok: false, error: 'not-found' };
  const revision = expectedRevision === null ? normalizeRevision(schedule.revision) : expectedRevision;
  if (!Number.isSafeInteger(revision) || revision < 0
    || normalizeRevision(schedule.revision) !== revision) {
    const failure = { ok: false, error: 'revision-or-relation-mismatch' };
    showWriteFailure(failure, '予定を削除できませんでした。');
    return failure;
  }
  const result = await executeWrite('schedule-delete', id,
    () => transactionRecord('schedules', id, revision, () => null));
  if (!result.ok) {
    showWriteFailure(result, '予定を削除できませんでした。');
    return result;
  }
  toast("予定を削除しました");
  return result;
}

// A single dialog is used for both task and schedule occurrence deletion.
// The selected members and their revision/semantic fingerprints are frozen
// before confirmation, then checked again inside the Firebase transaction.
let pendingRecurringDelete = null;
let recurringDeleteBusy = false;
const originRecurringDeleteSelections = new Map();

function rawRecurringDeleteRoot() {
  const records = name => {
    const raw = state.deleteBaseRoot?.[name] || {};
    return Object.keys(raw).length ? { ...raw }
      : Object.fromEntries((state[name] || []).map(item => [item.id, item]));
  };
  return {
    tasks: records("tasks"),
    schedules: records("schedules"),
    knowledge: records("knowledge")
  };
}

function openRecurringDelete(kind, id, { base = null, expectedRevision = null } = {}) {
  const root = rawRecurringDeleteRoot();
  const selection = captureRecurringDelete(kind, root, id);
  if (!selection) return false;
  const fingerprint = selection.fingerprints[id];
  if ((base?.task && classifyDeleteConflictProtocol(base, root).kind !== "ready-to-delete")
    || (base?.task && (base.task.projection !== fingerprint.semantic ||
      base.task.revision !== fingerprint.revision))
    || (expectedRevision != null && Number(expectedRevision) !== fingerprint.revision)) {
    showWriteFailure({ error: "revision-or-relation-mismatch" });
    return true;
  }
  pendingRecurringDelete = {
    selection, user: getCurrentUser(), roomId: ROOM_ID
  };
  const label = kind === "schedule" ? "予定" : "タスク";
  $("recurringDeleteSubject").textContent =
    `${label}「${selection.title || id}」${selection.date ? "／" + selection.date : ""}`;
  const initial = document.querySelector('input[name="recurringDeleteScope"][value="one"]');
  if (initial) initial.checked = true;
  updateRecurringDeleteDialog();
  $("recurringDeleteDialog").showModal();
  return true;
}

function updateRecurringDeleteDialog() {
  const pending = pendingRecurringDelete;
  if (!pending) return;
  const scope = document.querySelector('input[name="recurringDeleteScope"]:checked')?.value || "one";
  const { selection } = pending;
  const targets = recurringDeleteTargets(selection, scope);
  const noun = selection.kind === "schedule" ? "予定" : "タスク";
  $("recurringDeleteImpact").textContent =
    `選択範囲：${targets.length}件の${noun}を削除します。`;
  const note = $("recurringDeleteNote");
  if (selection.kind === "schedule") {
    note.textContent = "このコピー操作で作成された予定のみが対象です。関連タスクは削除されません。" +
      " 元のコピー元や別のコピー操作で作成した予定は削除しません。削除は元に戻せません。";
  } else if (scope === "one") {
    const selected = state.tasks.find(task => task.id === selection.selectedId);
    const next = selected && !isCompletedStatus(selected.status) && !selected.nextRecurringTaskId
      ? nextRecurringChild(selected) : null;
    note.textContent = next
      ? `選択した1件を飛ばし、次の繰り返し日（${next.repeatDate}）のタスクを作成して継続します。関連予定は残し、参照を解除します。削除は元に戻せません。`
      : "ほかのタスクは残ります。すでに後続タスクがある場合、重複作成しません。関連予定は残し、参照を解除します。削除は元に戻せません。";
  } else {
    note.textContent = "選択した範囲のタスクと紐付く業務ナレッジを削除します。" +
      " 関連する予定は残し、タスクへの参照だけ解除します。" +
      " 対象より前のタスクがある場合、その履歴を残します。未作成の後続タスクも生成しません。削除は元に戻せません。";
  }
  const button = $("confirmRecurringDelete");
  button.textContent = `${targets.length}件を削除する`;
  button.disabled = targets.length === 0;
}

async function requestDeleteWithSeries(kind, id, options = {}) {
  const collection = kind === "schedule" ? "schedules" : "tasks";
  const item = state[collection].find(record => record.id === id);
  if (!item) return { ok: false, error: "not-found" };
  if (isRecurringDeleteCandidate(kind, item)) {
    if (openRecurringDelete(kind, id, options)) return { ok: false, pending: true };
    // A missing or incompletely synced series must never silently fall back
    // to single-record deletion, which could terminate a recurring chain.
    toast("繰り返し系列を確認できません。同期後に開き直してください。", true);
    return { ok: false, error: "series-unavailable" };
  }
  if (kind === "schedule") {
    if (!confirm("この予定を削除しますか？")) return { ok: false, error: "cancelled" };
    return deleteSchedule(id, options.expectedRevision ?? null);
  }
  if (!confirm(`「${item.title || id}」を削除しますか？関連予定の参照も解除されます。`)) {
    return { ok: false, error: "cancelled" };
  }
  return requestTaskDelete(id, options.base);
}

async function commitRecurringDelete(selection, scope) {
  const kind = selection.kind;
  const refForSeries = kind === "schedule" ? state.schedulesRef : state.roomRef;
  const createNext = kind === "task" ? current => {
    const task = normalizeTask({ id: selection.selectedId, ...current });
    // A completed occurrence never creates a new child merely by being deleted.
    return isCompletedStatus(task.status) || task.nextRecurringTaskId
      ? null : nextRecurringChild(task);
  } : null;

  return executeWrite("recurring-delete", kind + ":" + selection.selectedId, async () => {
    let committedPlan = null;
    const compute = root => {
      const plan = planRecurringDelete(selection, scope, root, createNext);
      if (plan.action !== "commit") throw new Error("revision-or-relation-mismatch");
      committedPlan = plan;
      return plan;
    };
    const applyCommit = (snapshot, plan) => {
      const affectedPaths = plan.affectedPaths.map(path => `rooms/${ROOM_ID}/${path}`);
      applyCommittedResult({
        snapshot,
        affectedPaths,
        mutationKind: kind === "task" ? "task-delete" : "schedule-delete-series"
      });
      return {
        committed: true, snapshot, snapshotScope: "root",
        affectedPaths, deletedIds: plan.deletedIds,
        createdTaskId: plan.createdTaskId, mutationKind: "recurring-delete"
      };
    };

    if (state.connectionMode === "local-only") {
      const plan = compute(rawRecurringDeleteRoot());
      return applyCommit(plan.nextRoot, plan);
    }
    // A whole-room transaction can see null from a cold RTDB local cache.
    // Warm the authoritative server snapshot before CAS, with no optimistic UI.
    await get(refForSeries);
    let conflict = false;
    const tx = await runTransaction(refForSeries, current => {
      const raw = current && typeof current === "object" ? current : {};
      const root = kind === "schedule" ? { schedules: raw } : raw;
      try {
        const plan = compute(root);
        return kind === "schedule" ? plan.nextRoot.schedules : plan.nextRoot;
      } catch (error) {
        conflict = true;
        return;
      }
    }, { applyLocally: false });
    if (!tx.committed || !committedPlan) {
      throw new Error(conflict ? "revision-or-relation-mismatch" : "transaction-aborted-or-invariant-failure");
    }

    const snapshot = kind === "schedule"
      ? { schedules: tx.snapshot?.val() || {} }
      : tx.snapshot?.val() || {};
    const server = (await get(refForSeries)).val() || {};
    const source = kind === "schedule" ? server : server.tasks || {};
    if (committedPlan.deletedIds.some(id => source[id])) {
      throw new Error("delete-not-persisted");
    }
    if (committedPlan.createdTaskId && !server.tasks?.[committedPlan.createdTaskId]) {
      throw new Error("transaction-aborted-or-invariant-failure");
    }
    return applyCommit(snapshot, committedPlan);
  });
}

async function confirmRecurringDelete() {
  const pending = pendingRecurringDelete;
  if (!pending) return;
  if (pending.roomId !== ROOM_ID || pending.user !== getCurrentUser()) {
    toast("ルームまたは利用者が変更されました。削除をやり直してください。", true);
    $("recurringDeleteDialog").close();
    return;
  }
  const scope = document.querySelector('input[name="recurringDeleteScope"]:checked')?.value || "one";
  const targets = recurringDeleteTargets(pending.selection, scope);
  if (!targets.length) return;
  if (recurringDeleteBusy) return;
  const button = $("confirmRecurringDelete");
  recurringDeleteBusy = true;
  button.disabled = true;
  $("cancelRecurringDelete").disabled = true;
  $("closeRecurringDelete").disabled = true;
  document.querySelectorAll('input[name="recurringDeleteScope"]').forEach(input => { input.disabled = true; });
  try {
    const result = await commitRecurringDelete(pending.selection, scope);
    if (!result.ok) {
      showWriteFailure(result, "一括削除できませんでした。最新状態を確認してやり直してください。");
      if (result.error === "revision-or-relation-mismatch") $("recurringDeleteDialog").close();
      return;
    }
    $("recurringDeleteDialog").close();
    if (pending.selection.kind === "task") {
      if ($("taskId")?.value && result.deletedIds.includes($("taskId").value)) {
        elements.taskDialog.close();
      }
      if (state.selectedId && result.deletedIds.includes(state.selectedId)) {
        state.selectedId = "";
        closeDetail();
      }
    } else if ($("scheduleId")?.value && result.deletedIds.includes($("scheduleId").value)) {
      elements.scheduleDialog.close();
    }
    const summary = `${targets.length}件の${pending.selection.kind === "schedule" ? "予定" : "タスク"}を削除しました。`;
    const outcome = pending.selection.kind === "task" && scope !== "one"
      ? "選択範囲の後続タスクは自動生成されません。"
      : pending.selection.kind === "task" && result.createdTaskId
        ? "次回タスクを作成して繰り返しを継続します。" : "";
    toast(summary + outcome);
  } finally {
    recurringDeleteBusy = false;
    button.disabled = false;
    $("cancelRecurringDelete").disabled = false;
    $("closeRecurringDelete").disabled = false;
    document.querySelectorAll('input[name="recurringDeleteScope"]').forEach(input => { input.disabled = false; });
  }
}

function loadLocalSchedules() {
  try {
    state.schedules = JSON.parse(localStorage.getItem(schedulesKey()) || "[]").map(normalizeSchedule);
  } catch {
    state.schedules = [];
  }
  state.deleteBaseRoot.schedules = Object.fromEntries(state.schedules.map(item => [item.id, item]));
  render();
  syncScheduleReminderWatcher();
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

// JOURNAL shortcuts invoke the existing reserved-task dialog. No separate
// future-task data store or second dialog is introduced.
function journalReservedTaskShortcutV565(){
  return '<button type="button" class="j565-reserved-shortcut" data-j565-reserved-open hidden>'+
    '予約タスク <small data-j565-reserved-count></small></button>';
}
let journalReservedObserverV565=null;
function journalBindReservedTaskShortcutV565(root){
  journalReservedObserverV565?.disconnect();
  const shortcuts=[...root.querySelectorAll('[data-j565-reserved-open]')];
  if(!shortcuts.length)return;
  const update=()=>{
    const source=document.querySelector('[data-reserved-task-open]');
    const count=source?.querySelector('span')?.textContent?.trim()||'0';
    shortcuts.forEach(button=>{
      if(!button.isConnected)return;
      button.hidden=!source||source.hidden;
      const counter=button.querySelector('[data-j565-reserved-count]');
      if(counter)counter.textContent=count+'件';
    });
  };
  shortcuts.forEach(button=>button.addEventListener('click',()=>{
    document.querySelector('[data-reserved-task-open]')?.click();
  }));
  // Restrict observation to the existing reserved-button owner.
  const owner=document.querySelector('.task-control-row');
  if(owner){
    journalReservedObserverV565=new MutationObserver(update);
    journalReservedObserverV565.observe(owner,{attributes:true,subtree:true,
      childList:true,characterData:true,attributeFilter:['hidden']});
  }
  update();
}
function journalDashboardNavigationV565(){
  if(document.documentElement.dataset.wbDisplay!=='journal')return '';
  return '<nav class="j565-dashboard-navigation" aria-label="JOURNALのタスク画面切替">'+
    '<div class="j425-mode-switch" role="group" aria-label="タスク表示形式">'+
    '<button type="button" data-j565-task-layout="board">机上</button>'+
    '<button type="button" data-j565-task-layout="list">一覧</button>'+
    '<button type="button" data-j565-task-layout="timeline">日誌</button>'+
    '<button type="button" aria-pressed="true">ダッシュボード</button></div>'+
    journalReservedTaskShortcutV565()+'</nav>';
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
    ${journalDashboardNavigationV565()}
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
    </div>
  `;

  elements.dashboardView.querySelector("[data-dashboard-refresh]")?.addEventListener("click", render);
  elements.dashboardView.querySelectorAll('[data-j565-task-layout]').forEach(button=>
    button.addEventListener('click',()=>journalSwitchTaskPageV509(button.dataset.j565TaskLayout)));
  journalBindReservedTaskShortcutV565(elements.dashboardView);
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


// JOURNAL read-only presentation state. No duplicate task record writer.
let journalSortV411 = { key:'', dir:1 };
let journalAtelierViewV420 = 'all';
let journalAtelierCategoryV420 = '';
let journalAtelierSelectedV420 = '';
function journalTaskV411(){return document.documentElement.dataset.wbDisplay==='journal'}

// JOURNAL V509: keep only read-position state per task page. No task data,
// Firebase listener or canonical navigation state is duplicated.
const journalTaskPagePositionsV509={board:null,list:null,timeline:null};
let journalTaskPageSwitchTokenV509=0;
// JOURNAL V525: a date remains stable when earlier entries expand or shrink.
// This is transient reading position only, never task data or a second layout state.
let journalChronicleReadAnchorV525=null;
function journalCaptureChronicleReadAnchorV525(view){
  const bookmark=view.querySelector('.j511-chronicle-travel')?.getBoundingClientRect();
  const visibleTop=bookmark&&bookmark.bottom>0&&bookmark.top<window.innerHeight
    ?Math.max(0,bookmark.bottom+8):0;
  const days=[...view.querySelectorAll('.jv-chronicle-day')];
  // An explicitly selected date remains the reading anchor while visible,
  // including near the document end where it cannot reach the top shelf.
  const picked=days.find(element=>element.querySelector('[data-jv-date]')?.dataset.jvDate===journalChronicleSelectedDateV523);
  const pickedRect=picked?.getBoundingClientRect();
  const day=pickedRect&&pickedRect.bottom>visibleTop&&pickedRect.top<window.innerHeight?picked:days.find(element=>{
    const rect=element.getBoundingClientRect();
    const visibleHeight=Math.min(rect.bottom,window.innerHeight)
      -Math.max(rect.top,visibleTop);
    return visibleHeight>=Math.min(32,Math.max(12,rect.height*.2));
  });
  const date=day?.querySelector('.jv-day-records[data-jv-date]')?.dataset.jvDate;
  journalChronicleReadAnchorV525=date?{
    date,top:day.getBoundingClientRect().top,
    width:journalChronicleReadAnchorV525?.date===date
      ?journalChronicleReadAnchorV525.width:window.innerWidth,
    start:toISODate(getTimelineStartDate()),range:state.timelineRange
  }:null;
}
function journalTaskPageV509(layout){
  return layout==='board'?elements.boardView:
    layout==='list'?elements.listView:
    layout==='timeline'?elements.timelineView:null;
}
// JOURNAL V534: one transient user-picked case links desk, index and diary.
// Neither filters nor canonical task records are changed by this view-only handoff.
let journalTaskNavigationSelectionV534={layout:'',id:''};
function journalRememberTaskNavigationV534(layout,id){
  journalTaskNavigationSelectionV534={layout,id};
}
function journalTaskNavigationTargetV534(root,layout,id){
  if(!root||!id)return null;
  const attr=layout==='board'?'data-j420-task-id':
    layout==='list'?'data-j425-row':'data-task-id';
  return [...root.querySelectorAll('['+attr+']')]
    .find(node=>node.getAttribute(attr)===id)||null;
}
function journalTaskNavigationSourceV534(layout,root){
  if(!root||root.hidden)return null;
  const id=layout==='board'?journalAtelierSelectedV420:
    layout==='list'?journalIndexStateV425.selected:
    (journalTaskNavigationSelectionV534.layout==='timeline'
      ?journalTaskNavigationSelectionV534.id:'');
  if(!id||!state.tasks.some(task=>task.id===id))return null;
  const row=journalTaskNavigationTargetV534(root,layout,id);
  const rect=row?.getBoundingClientRect();
  const explicit=journalTaskNavigationSelectionV534.layout===layout
    &&journalTaskNavigationSelectionV534.id===id;
  return {id,follow:Boolean(explicit&&rect&&rect.width>0&&rect.height>0
    &&rect.bottom>32&&rect.top<window.innerHeight-32)};
}
function journalSwitchTaskPageV509(next){
  if(document.documentElement.dataset.wbDisplay!=='journal'
    ||!['tasks','dashboard'].includes(state.layout)
    ||!['board','list','timeline','dashboard'].includes(next))return;
  const previous=state.layout==='dashboard'?'dashboard':state.taskLayout;
  if(previous===next)return;
  const oldView=previous==='dashboard'?elements.dashboardView:journalTaskPageV509(previous);
  const handoffV534=previous==='dashboard'?null:journalTaskNavigationSourceV534(previous,oldView);
  if(oldView&&!oldView.hidden){
    // Relative to the top of this paper page, not the document's absolute Y.
    // This survives differing headers, card counts and responsive layouts.
    journalTaskPagePositionsV509[previous]=Math.max(0,-oldView.getBoundingClientRect().top);
    if(previous==='timeline')journalCaptureChronicleReadAnchorV525(oldView);
  }
  if(handoffV534?.id&&next==='board'&&journalAtelierSelectedV420!==handoffV534.id){
    journalAtelierSelectedV420=handoffV534.id;
    journalAtelierInlineOpenV494=false;
    journalAtelierReturnAnchorV516=null;
  }
  if(handoffV534?.id&&next==='list'&&journalIndexStateV425.selected!==handoffV534.id){
    journalIndexStateV425.selected=handoffV534.id;
    journalTaskInlineSelectedV491='';
    journalIndexReturnAnchorV513=null;
  }
  if(next==='dashboard'){
    state.layout='dashboard';
    closeDetail();
    render();
    requestAnimationFrame(()=>elements.dashboardView
      .querySelector('.j565-dashboard-navigation [aria-pressed="true"]')
      ?.focus({preventScroll:true}));
    return;
  }
  state.layout='tasks';
  state.taskLayout=next;
  localStorage.setItem(taskLayoutKey(),state.taskLayout);
  render();
  const token=++journalTaskPageSwitchTokenV509;
  requestAnimationFrame(()=>{
    if(token!==journalTaskPageSwitchTokenV509||!journalTaskV411()
      ||state.layout!=='tasks'||state.taskLayout!==next)return;
    const view=journalTaskPageV509(next);
    if(!view||view.hidden)return;
    const offset=journalTaskPagePositionsV509[next]??0;
    const pageTop=window.scrollY+view.getBoundingClientRect().top;
    const maxTop=Math.max(0,(document.scrollingElement?.scrollHeight||0)-window.innerHeight);
    let restoredDayV525=null;
    const anchor=next==='timeline'?journalChronicleReadAnchorV525:null;
    if(anchor&&anchor.start===toISODate(getTimelineStartDate())&&anchor.range===state.timelineRange){
      const day=[...view.querySelectorAll('.jv-chronicle-day')]
        .find(element=>element.querySelector('[data-jv-date]')?.dataset.jvDate===anchor.date);
      if(day){
        const heading=day.querySelector('.jv-date');
        if(anchor.width===window.innerWidth){
          const correctedTop=window.scrollY+day.getBoundingClientRect().top-anchor.top;
          window.scrollTo({top:Math.min(maxTop,Math.max(0,correctedTop)),behavior:'auto'});
          restoredDayV525=heading;
        }else if(heading){
          // Width changes alter wrapping and shelf heights; use the date itself.
          heading.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
          restoredDayV525=heading;
        }
      }
    }
    if(!restoredDayV525)
      window.scrollTo({top:Math.min(maxTop,Math.max(0,pageTop+offset)),behavior:'auto'});
    // Follow an explicitly picked, currently visible case only if the target
    // exists in the destination's OWN filters or diary period. Otherwise keep
    // the saved page/day reading position instead of changing any filters.
    const handoffTargetV534=handoffV534
      ?journalTaskNavigationTargetV534(view,next,handoffV534.id):null;
    const handoffVisibleV534=handoffTargetV534
      &&(next==='timeline'||handoffTargetV534.classList.contains('is-selected'));
    if(handoffV534?.follow&&handoffVisibleV534){
      handoffTargetV534.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
      handoffTargetV534.focus({preventScroll:true});
      journalRememberTaskNavigationV534(next,handoffV534.id);
      return;
    }
    // Give the keyboard a useful anchor inside the restored viewport.
    const items=[...view.querySelectorAll(
      '[data-j420-task-id],[data-j425-row],[data-j494-open-task]')];
    const visible=items.find(el=>{
      const rect=el.getBoundingClientRect();
      return rect.top>=0&&rect.bottom<=window.innerHeight&&rect.height>0;
    });
    const active=visible||restoredDayV525||view.querySelector(
      '.j420-atelier-switch [aria-pressed="true"],'+
      '.j425-mode-switch [aria-pressed="true"],'+
      '.j509-chronicle-switch [aria-pressed="true"]');
    if(active&&!active.matches('button,select,input,a,[tabindex]'))active.tabIndex=-1;
    active?.focus({preventScroll:true});
  });
}

// JOURNAL V494: one existing paper note follows its selected case on a phone.
const journalAtelierInlineMediaV494=window.matchMedia('(max-width:760px)');
let journalAtelierInlineOpenV494=false;
// V562: the original note is a dismissible side reader on wide screens.
let journalAtelierDeskNoteOpenV562=false;
// JOURNAL V516: temporary mobile reading anchor; never saved in task data.
let journalAtelierReturnAnchorV516=null;
// V556: remember only the visible part of an open phone note.
// Never persist it to user records, filters, or the shared task store.
let journalAtelierReaderAnchorV556=null;
let journalAtelierReaderScrollFrameV556=null;
let journalAtelierReaderResizeFrameV556=null;
const journalAtelierReaderSectionsV556=[
  '.j553-atelier-pager','.j420-note-lead','.j420-note-description',
  '.j420-note-checks','.j420-next-step'
];
function journalCaptureAtelierReaderAnchorV556(){
  if(!journalTaskV411()||state.layout!=='tasks'||state.taskLayout!=='board'
    ||!journalAtelierInlineMediaV494.matches||!journalAtelierInlineOpenV494
    ||elements.boardView.hidden){
    journalAtelierReaderAnchorV556=null;
    return;
  }
  // Preserve the underlying reading anchor while a detail panel/editor is
  // open; modal scroll/resize activity must not rewrite the source position.
  if(elements.detailPanel?.classList.contains('open')||elements.taskDialog?.open)return;
  const note=elements.boardView.querySelector('#j494AtelierNote.j494-inline-note');
  if(!note){journalAtelierReaderAnchorV556=null;return;}
  // The heading can be far above the viewport in a long memo. Pick the
  // first visible notebook section, and retain its viewport coordinate.
  const section=journalAtelierReaderSectionsV556.find(selector=>{
    const node=note.querySelector(selector);
    if(!node)return false;
    const rect=node.getBoundingClientRect();
    return rect.bottom>72&&rect.top<window.innerHeight-20;
  });
  if(!section){journalAtelierReaderAnchorV556=null;return;}
  const top=note.querySelector(section).getBoundingClientRect().top;
  journalAtelierReaderAnchorV556={
    id:journalAtelierSelectedV420,selector:section,top,width:window.innerWidth
  };
}
window.addEventListener('scroll',()=>{
  if(!journalTaskV411()||state.layout!=='tasks'||state.taskLayout!=='board'
    ||!journalAtelierInlineOpenV494||!journalAtelierInlineMediaV494.matches
    ||journalAtelierReaderScrollFrameV556!==null)return;
  journalAtelierReaderScrollFrameV556=requestAnimationFrame(()=>{
    journalAtelierReaderScrollFrameV556=null;
    // A scroll event caused by width reflow must not replace the old-width
    // anchor before the resize handler can restore it.
    if(journalAtelierReaderAnchorV556
      &&journalAtelierReaderAnchorV556.width!==window.innerWidth)return;
    journalCaptureAtelierReaderAnchorV556();
  });
},{passive:true});
window.addEventListener('resize',()=>{
  const anchor=journalAtelierReaderAnchorV556;
  if(!anchor||anchor.width===window.innerWidth)return;
  if(journalAtelierReaderResizeFrameV556!==null)
    cancelAnimationFrame(journalAtelierReaderResizeFrameV556);
  journalAtelierReaderResizeFrameV556=requestAnimationFrame(()=>{
    journalAtelierReaderResizeFrameV556=null;
    if(anchor!==journalAtelierReaderAnchorV556||!journalTaskV411()
      ||state.layout!=='tasks'||state.taskLayout!=='board'
      ||!journalAtelierInlineMediaV494.matches||!journalAtelierInlineOpenV494
      ||elements.detailPanel?.classList.contains('open')||elements.taskDialog?.open
      ||elements.boardView.hidden||anchor.id!==journalAtelierSelectedV420)return;
    const note=elements.boardView.querySelector('#j494AtelierNote.j494-inline-note');
    const target=note?.querySelector(anchor.selector);
    const current=document.activeElement;
    // Do not move the page when the user is operating outside the note.
    if(!target||(current&&current!==document.body
      &&current!==document.documentElement&&current.isConnected
      &&!note.contains(current)))return;
    const delta=target.getBoundingClientRect().top-anchor.top;
    if(Number.isFinite(delta)&&document.scrollingElement)
      document.scrollingElement.scrollTop+=delta;
    journalCaptureAtelierReaderAnchorV556();
  });
});
// V553: invalidate queued mobile note navigation when the user selects again.
let journalAtelierPageTokenV553=0;
// V554: the pager delegates selection to the existing card click, but owns
// its own focus. Do not also schedule a heading-focus jump during paging.
let journalAtelierPagingV554=false;
// JOURNAL V502: view-only mobile index state; task data and filters stay canonical.
let journalIndexExpandedV502=false;
function journalPositionAtelierNoteV494(root){
  if(!root||!journalTaskV411())return;
  const note=root.querySelector('#j494AtelierNote');
  if(!note)return;
  const card=[...root.querySelectorAll('[data-j420-task-id]')]
    .find(el=>el.dataset.j420TaskId===journalAtelierSelectedV420);
  const inline=Boolean(journalAtelierInlineMediaV494.matches&&journalAtelierInlineOpenV494&&card);
  const desktopOpen=Boolean(!journalAtelierInlineMediaV494.matches&&journalAtelierDeskNoteOpenV562&&card);
  if(inline){
    if(note.previousElementSibling!==card||note.parentElement!==card.parentElement)card.after(note);
  }else{
    const desktop=root.querySelector('.j420-atelier')||root;
    if(note.parentElement!==desktop)desktop.append(note);
  }
  note.classList.toggle('j494-inline-note',inline);
  note.classList.toggle('j562-desk-open',desktopOpen);
  note.hidden=!inline&&!desktopOpen;
  note.setAttribute('aria-hidden',String(note.hidden));
  if(!inline)journalAtelierReaderAnchorV556=null;
  root.querySelectorAll('[data-j420-task-id]').forEach(el=>
    el.setAttribute('aria-expanded',String((inline||desktopOpen)&&el===card)));
  // V553: the real rendered card order, not the filtered task array, owns
  // mobile note paging across the different desk shelves.
  const pager=note.querySelector('.j553-atelier-pager');
  if(pager){
    const cards=[...root.querySelectorAll('[data-j420-task-id]')];
    const index=cards.indexOf(card);
    pager.hidden=!inline;
    const position=pager.querySelector('[data-j553-case-position]');
    if(position)position.textContent=inline?(index+1)+' / '+cards.length+' 件':'';
    pager.querySelectorAll('[data-j553-case-step]').forEach(button=>{
      const step=Number(button.dataset.j553CaseStep);
      button.disabled=!inline||index<0||!cards[index+step];
    });
  }
}
journalAtelierInlineMediaV494.addEventListener('change',()=>{
  if(journalAtelierInlineMediaV494.matches&&journalAtelierDeskNoteOpenV562)
    journalAtelierInlineOpenV494=true;
  journalPositionAtelierNoteV494(elements.boardView?.querySelector('.j420-atelier'));
});

// The existing detail panel remains the single owner of open/close and editing.
// Only the originating journal row is remembered for keyboard focus restoration.
let journalTimelineReturnTaskV494='';
let journalTimelineReturnDateV504='';
let journalTimelineReturnUndatedV504=false;
let journalTimelineReturnTopV505=null;
// V536: a vanished timeline row returns to its original day, not the top.
// The anchor is view-only and cleared along with the existing detail origin.
let journalTimelineReturnDayV536=null;
// JOURNAL V519: one transient origin for desk / index detail modals.
// The existing close observer below handles all three JOURNAL task pages.
let journalTaskNoteReturnV519=null;
function journalOpenTaskNoteV519(id,layout,action,source,edit=false){
  if(!source||!id||!state.tasks.some(task=>task.id===id))return;
  const top=source.getBoundingClientRect().top;
  const root=journalTaskPageV509(layout);
  const rowAttr=layout==='board'?'data-j420-task-id':'data-j425-row';
  const row=journalTaskNavigationTargetV534(root,layout,id);
  const rowTop=row?.getBoundingClientRect().top??null;
  // V538: keep the visible case order only while this folio is open. A
  // completed edit can remove the case from its filter or delete it entirely.
  const order=[...(root?.querySelectorAll('['+rowAttr+']')||[])]
    .map(node=>node.getAttribute(rowAttr));
  // V544: keep the same inline reader active after a successful edit, even
  // when the edited case no longer matches the list's own filters.
  const inlineReader=layout==='list'
    &&journalTaskInlineSelectedV491===id
    &&Boolean(source.closest('.j425-task-preview.j491-inline-detail'));
  // V558: keep the opening button's relative viewport position when the
  // mobile width or height changes while the canonical panel is open.
  journalTaskNoteReturnV519={id,selected:id,order,layout,action,top,rowTop,
    width:window.innerWidth,viewportHeight:window.innerHeight,inlineReader};
  // Only one return owner may be pending for the shared task detail panel.
  journalTimelineReturnTaskV494='';
  journalTimelineReturnDateV504='';
  journalTimelineReturnUndatedV504=false;
  journalTimelineReturnTopV505=null;
  journalTimelineReturnDayV536=null;
  if(edit){
    // A double click bypasses the delayed read click. Keep the edited row
    // selected so a concurrent removal resolves its nearest surviving row.
    if(layout==='list')journalIndexStateV425.selected=id;
    else if(layout==='board')journalAtelierSelectedV420=id;
    openTaskEditorById(id);
  }else selectTask(id);
}
function journalRestoreTaskNoteV519(){
  const origin=journalTaskNoteReturnV519;
  journalTaskNoteReturnV519=null;
  if(!origin||!journalTaskV411()||state.taskLayout!==origin.layout)return;
  const board=origin.layout==='board';
  if(!board&&origin.layout!=='list')return;
  const view=board?elements.boardView:elements.listView;
  if(!view||view.hidden)return;
  const selected=board?journalAtelierSelectedV420:journalIndexStateV425.selected;
  const action=board
    ?(origin.action==='edit'?'[data-j420-note-edit]':'[data-j420-note-detail]')
    :(origin.action==='edit'?'[data-j425-preview-edit]':'[data-j425-preview-detail]');
  const preview=view.querySelector(board?'#j494AtelierNote':'.j425-task-preview');
  const button=origin.action!=='row'&&selected===origin.id?preview?.querySelector(action):null;
  const row=[...view.querySelectorAll(board?'[data-j420-task-id]':'[data-j425-row]')]
    .find(el=>(board?el.dataset.j420TaskId:el.dataset.j425Row)===origin.id);
  // A changed filter or deleted record cannot leave focus in a hidden note.
  const nearRow=view.querySelector(board?'[data-j420-task-id].is-selected':'[data-j425-row].is-selected');
  // If an edited case leaves the filter, announce the new adjacent note
  // rather than focusing the edit action of a different task.
  const continuedReader=!board&&origin.inlineReader
    &&journalTaskInlineSelectedV491===selected
    ?view.querySelector('.j425-task-preview.j491-inline-detail'):null;
  const changedHeading=continuedReader&&selected!==origin.id
    ?continuedReader.querySelector('.j425-index-preview h3'):null;
  const target=(button?.getClientRects().length?button:null)||changedHeading||row||nearRow||
    view.querySelector(board?'[data-j420-search]':'[data-j425-query]')||
    view.querySelector(board?'[data-j420-new-task]':'[data-j425-new-task]');
  if(!target)return;
  // V558: closing a panel may defer this restoration by a frame. If the
  // person has already focused another visible control in the task page,
  // that newer action wins instead of restoring the old detail action.
  const current=document.activeElement;
  if(current&&current!==target&&view.contains(current)&&current.isConnected
    &&current.getClientRects().length
    &&current.matches('button,input,select,textarea,a,[tabindex]')){
    if(board&&journalAtelierInlineOpenV494)
      journalCaptureAtelierReaderAnchorV556();
    return;
  }
  if(!target.matches('button,select,input,a,[tabindex]'))target.tabIndex=-1;
  target.focus({preventScroll:true});
  const scrolling=document.scrollingElement;
  // The action and its case row are different phone anchors. On direct
  // double-click editing, use the row's original position rather than
  // treating the editor as though it had been opened from a note button.
  // The selected replacement stands where the vanished case was. Keep the
  // old row's viewport coordinate on phones instead of jumping to row one.
  const sourceTop=target===button?origin.top:
    target===row||(!row&&target===nearRow)?origin.rowTop:null;
  if(scrolling&&origin.width===window.innerWidth
    &&origin.viewportHeight===window.innerHeight
    &&Number.isFinite(sourceTop)&&sourceTop>=0&&sourceTop<=window.innerHeight){
    scrolling.scrollTop+=target.getBoundingClientRect().top-sourceTop;
  }else if(scrolling&&board&&target===button
    &&Number.isFinite(origin.top)&&origin.top>=0
    &&Number.isFinite(origin.viewportHeight)&&origin.viewportHeight>0){
    // V558: the same note action remains available after a phone rotation
    // or a 390px <-> 320px resize. Restore its *relative* on-screen height
    // rather than sending the reader to an arbitrary edge of the notebook.
    const rect=target.getBoundingClientRect();
    const maxY=Math.max(12,window.innerHeight-rect.height-12);
    const wanted=origin.top/origin.viewportHeight*window.innerHeight;
    const desired=Math.min(maxY,Math.max(12,wanted));
    scrolling.scrollTop+=rect.top-desired;
    const after=target.getBoundingClientRect();
    if(after.bottom<=0||after.top>=window.innerHeight)
      target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
  }else target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
  // Rebase the V556 reading anchor at the final restored location; an old
  // 390px anchor must not override a later 320px scroll or Firebase repaint.
  if(board&&journalAtelierInlineOpenV494)
    journalCaptureAtelierReaderAnchorV556();
}
// JOURNAL V507: transient source for the existing canonical date-change dialog.
let journalTimelineMoveSourceV507=null;
let journalTimelineMoveCommittedV507=false;
// The original row and its viewport offset are owned by the JOURNAL reader,
// not by a separate editor or persistence path.
function journalRememberTimelineSourceV505(id){
  journalRememberTaskNavigationV534('timeline',id);
  journalTaskNoteReturnV519=null;
  journalTimelineReturnTaskV494=id;
  const source=[...elements.timelineView.querySelectorAll('.jv-day-item')]
    .find(row=>row.dataset.taskId===id);
  journalTimelineReturnDateV504=source?.closest('[data-jv-date]')?.dataset.jvDate||'';
  journalTimelineReturnUndatedV504=Boolean(source?.closest('[data-jv-undated]'));
  journalTimelineReturnTopV505=source?source.getBoundingClientRect().top:null;
  const day=source?.closest('.jv-chronicle-day,[data-jv-undated]');
  journalTimelineReturnDayV536=day?{
    top:day.getBoundingClientRect().top,width:window.innerWidth
  }:null;
}
function journalOpenTimelineDetailV494(id){
  journalRememberTimelineSourceV505(id);
  selectTask(id);
  if(elements.detailPanel.classList.contains('open')){
    elements.detailPanel.scrollTop=0;
    const heading=elements.detailBody.querySelector('.detail-title');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
}
function journalOpenTimelineEditorV505(id){
  journalRememberTimelineSourceV505(id);
  openTaskEditorById(id);
}
// JOURNAL V536: one return resolver runs after either the detail panel closes
// or a direct row double-click editor closes. No second modal/data owner.
function journalRestoreTaskOriginV536(){
    if(elements.detailPanel?.classList.contains('open')||elements.taskDialog?.open)return;
    if(journalTaskNoteReturnV519){journalRestoreTaskNoteV519();return;}
    if(!journalTimelineReturnTaskV494)return;
    const id=journalTimelineReturnTaskV494;
    const date=journalTimelineReturnDateV504;
    const undated=journalTimelineReturnUndatedV504;
    const sourceTop=journalTimelineReturnTopV505;
    const dayAnchor=journalTimelineReturnDayV536;
    journalTimelineReturnTaskV494='';
    journalTimelineReturnDateV504='';
    journalTimelineReturnUndatedV504=false;
    journalTimelineReturnTopV505=null;
    journalTimelineReturnDayV536=null;
    if(!journalTaskV411()||elements.timelineView.hidden)return;
    const original=[...elements.timelineView.querySelectorAll('.jv-day-item')]
      .find(row=>row.dataset.taskId===id);
    const originalDay=date?[...elements.timelineView.querySelectorAll('[data-jv-date]')]
      .find(day=>day.dataset.jvDate===date):null;
    const sourceDay=originalDay?.closest('.jv-chronicle-day')
      ||(undated?elements.timelineView.querySelector('[data-jv-undated]'):null);
    const fallback=sourceDay?.querySelector('.jv-date')
      ||sourceDay?.querySelector('h4')
      ||elements.timelineView.querySelector('[data-j505-date-jump]');
    const target=original?.querySelector('[data-j494-open-task]')||original||fallback
      ||elements.timelineView.querySelector('[data-timeline-range]');
    // Fallback headings and date shelves are not normally focusable.
    if(target&&!target.matches('button,select,input,a,[tabindex]'))target.tabIndex=-1;
    target?.focus({preventScroll:true});
    const scrolling=document.scrollingElement;
    if(original&&scrolling&&Number.isFinite(sourceTop)
      &&sourceTop>=0&&sourceTop<=window.innerHeight){
      scrolling.scrollTop+=original.getBoundingClientRect().top-sourceTop;
    }else if(!original&&sourceDay&&scrolling&&dayAnchor
      &&dayAnchor.width===window.innerWidth
      &&Number.isFinite(dayAnchor.top)&&dayAnchor.top>=0&&dayAnchor.top<=window.innerHeight){
      // The task vanished. Preserve the original DAY rather than an unrelated row.
      scrolling.scrollTop+=sourceDay.getBoundingClientRect().top-dayAnchor.top;
    }else target?.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
}
if(typeof MutationObserver!=='undefined'&&elements.detailPanel){
  new MutationObserver(journalRestoreTaskOriginV536)
    .observe(elements.detailPanel,{attributes:true,attributeFilter:['class']});
}
elements.taskDialog?.addEventListener('close',()=>{
  if(!journalTaskNoteReturnV519&&!journalTimelineReturnTaskV494)return;
  // Direct notebook editing returns to its inline note or row. The shared
  // editor's detail preview must not cover that original reading surface.
  if(journalTaskV411()&&journalTaskNoteReturnV519
    &&['edit','row'].includes(journalTaskNoteReturnV519.action))closeDetail();
  requestAnimationFrame(journalRestoreTaskOriginV536);
});
// Escape belongs to JOURNAL's existing folio keyboard handler (v411).
// Detail and direct-editor close events share the same return resolver.

// JOURNAL V500: share the jump into the selected paper note between the
// actual desk cards and the recent-activity log. No editor state is duplicated.
function journalFocusAtelierNoteV500(root,includeDesktop=false){
  if(!includeDesktop&&!journalAtelierInlineMediaV494.matches)return;
  const token=journalAtelierPageTokenV553;
  const activeAtRequestV554=document.activeElement;
  requestAnimationFrame(()=>{
    if(token!==journalAtelierPageTokenV553||!root?.isConnected||!journalTaskV411())return;
    // A new click/Tab/focus after opening a card outranks this queued jump.
    const current=document.activeElement;
    if(current&&current!==activeAtRequestV554
      &&current!==document.body&&current!==document.documentElement
      &&current.isConnected)return;
    const note=root.querySelector('#j494AtelierNote');
    if(!note||(journalAtelierInlineMediaV494.matches&&!note.classList.contains('j494-inline-note'))
      ||(!journalAtelierInlineMediaV494.matches&&!note.classList.contains('j562-desk-open')))return;
    const heading=note.querySelector('.j420-note-lead h4');
    if(!heading)return;
    if(journalAtelierInlineMediaV494.matches)
      note.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
    else note.scrollTop=0;
    heading.tabIndex=-1;
    heading.focus({preventScroll:true});
    journalCaptureAtelierReaderAnchorV556();
  });
}

function journalAtelierCardV420(t) {
  const due=t.dueDate?escapeHtml(t.dueDate.slice(5).replace('-','/')):'期限なし';
  return `<article class="j420-atelier-task ${journalAtelierSelectedV420===t.id?'is-selected':''} ${isOverdue(t)?'is-overdue':''}" data-j420-task-id="${escapeHtml(t.id)}" tabindex="0" role="button" aria-controls="j494AtelierNote" aria-expanded="false" aria-label="${escapeHtml(t.title)}を案件ノートで見る">
    <span class="j420-card-dot" aria-hidden="true"></span>
    <span class="j420-card-content"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.category||'未分類')} / ${escapeHtml(t.status)}</small></span>
    <span class="j420-card-date">${due}</span><span class="j420-card-person" title="${escapeHtml(t.assignee||'未割当')}">${escapeHtml((t.assignee||'―').slice(0,1))}</span>
  </article>`;
}

function journalAtelierNoteV420(t){
  if(!t)return `<div class="j420-note-empty">案件を選択すると、ここに要約と進捗が表示されます。</div>`;
  const p=checklistProgress(t);
  const next=t.checklist.find(x=>!x.done)?.text;
  const lines=t.checklist.slice(0,4).map(x=>`<li class="${x.done?'is-done':''}"><span aria-hidden="true">${x.done?'☑':'□'}</span>${escapeHtml(x.text)}</li>`).join('')
    ||'<li>チェック項目はまだありません。</li>';
  return `<div class="j420-note-card">
    <div class="j420-note-lead"><span>選択中の案件</span><h4>${escapeHtml(t.title)}</h4><small>${escapeHtml(t.category||'未分類')}　/　${escapeHtml(t.status)}　/　${escapeHtml(t.assignee||'未割当')}</small>
      <div class="j420-note-actions"><button type="button" data-j420-note-detail>詳細を開く</button><button type="button" data-j420-note-edit>編集</button></div>
    </div>
    <div class="j420-note-description"><strong>案件の要約</strong><p>${escapeHtml(t.description||'詳しい内容はまだ登録されていません。')}</p></div>
    <div class="j420-note-checks"><strong>チェック項目 ${p.done}/${p.total}</strong><ul>${lines}</ul></div>
    <div class="j420-next-step"><span>次の一手</span><p>${escapeHtml(next||'詳細を開いて次の作業を確認しましょう。')}</p>${t.dueDate?`<small>期限 ${escapeHtml(t.dueDate)}</small>`:''}</div>
  </div>`;
}

function bindJournalAtelierNoteActionsV420(root){
  root.querySelector('[data-j420-note-detail]')?.addEventListener('click',event=>{
    journalOpenTaskNoteV519(journalAtelierSelectedV420,'board','detail',event.currentTarget);
  });
  root.querySelector('[data-j420-note-edit]')?.addEventListener('click',event=>{
    journalOpenTaskNoteV519(journalAtelierSelectedV420,'board','edit',event.currentTarget,true);
  });
}

// JOURNAL V516: keep the tapped index control at its original reading
// position when rebuilding the desk after changing a view or category.
let journalAtelierRefreshTokenV516=0;
// V551: a later user action must outrank a queued desk/search focus restore.
let journalAtelierSearchFocusTokenV551=0;
function journalRefreshAtelierControlV516(tasks,source,locate){
  const top=source.getBoundingClientRect().top;
  const visible=top>=0&&top<=window.innerHeight;
  const token=++journalAtelierRefreshTokenV516;
  journalAtelierReturnAnchorV516=null;
  journalAtelierV420(tasks);
  requestAnimationFrame(()=>{
    if(token!==journalAtelierRefreshTokenV516||!journalTaskV411()||elements.boardView.hidden)return;
    const target=locate();
    if(!target)return;
    const current=document.activeElement;
    if(current&&current!==document.body&&current!==document.documentElement
      &&current.isConnected&&current!==target)return;
    target.focus({preventScroll:true});
    if(visible&&document.scrollingElement){
      document.scrollingElement.scrollTop+=target.getBoundingClientRect().top-top;
    }else target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
  });
}
// JOURNAL V530: one transient reading/focus descriptor serves both the desk
// and the task index; explicit filter/navigation actions keep V515/V516 owners.
let journalTaskSyncTokenV530 = 0;
const journalTaskSyncAttrsV530 = {
  board:['data-j420-task-id','data-j420-search','data-j420-view',
    'data-j565-atelier-sort','data-j565-island-toggle','data-j565-reserved-open',
    'data-j420-category','data-j420-reset-view','data-j502-toggle-index',
    'data-j420-log-task','data-j420-layout','data-j420-new-task',
    'data-j520-empty-reset','data-j520-empty-new','data-j420-note-detail',
    'data-j420-note-edit','data-j494-atelier-back','data-j553-case-step'],
  list:['data-j425-row','data-j425-query','data-j425-sort','data-j565-reserved-open',
    'data-j430-facet','data-j425-due','data-j425-preset',
    'data-j425-task-layout','data-j425-new-task','data-j447-toggle-filters',
    'data-j425-reset','data-j518-empty-reset','data-bulk-id','data-bulk-all',
    'data-bulk-action','data-bulk-apply','data-j425-preview-detail',
    'data-j425-preview-edit','data-j540-case-step','data-j491-task-return']
};
function journalTaskSyncDescriptorV530(root,layout,node){
  if(!node)return null;
  for(const name of journalTaskSyncAttrsV530[layout]){
    if(!node.hasAttribute(name))continue;
    const value=node.getAttribute(name);
    const extra=name==='data-j430-facet'?node.getAttribute('data-j430-value'):null;
    const candidates=[...root.querySelectorAll('['+name+']')]
      .filter(el=>el.getAttribute(name)===value
        &&(extra===null||el.getAttribute('data-j430-value')===extra));
    return {kind:'attr',name,value,extra,index:candidates.indexOf(node)};
  }
  const owner=node.closest(layout==='board'?'[data-j420-task-id]':'[data-j425-row]');
  if(owner)return journalTaskSyncDescriptorV530(root,layout,owner);
  if(layout==='board'&&node.closest('#j494AtelierNote'))
    return {kind:'fixed',selector:node.matches('h4')?'#j494AtelierNote h4':'#j494AtelierNote'};
  if(layout==='list'&&node.closest('.j425-task-preview'))
    return {kind:'fixed',selector:node.matches('h3')?'.j425-task-preview h3':'.j425-task-preview'};
  const fallback=layout==='board'
    ?['.j420-atelier-tools','.j420-atelier-index','.j520-atelier-empty']
    :['.j425-workbench-toolbar','.j425-index-rail','.j518-index-empty'];
  const selector=fallback.find(sel=>node.matches(sel));
  return selector?{kind:'fixed',selector}:null;
}
function journalTaskSyncLocateV530(root,descriptor){
  if(!descriptor)return null;
  if(descriptor.kind==='fixed')return root.querySelector(descriptor.selector);
  const matches=[...root.querySelectorAll('['+descriptor.name+']')]
    .filter(el=>el.getAttribute(descriptor.name)===descriptor.value
      &&(descriptor.extra===null||el.getAttribute('data-j430-value')===descriptor.extra));
  return matches[descriptor.index]||null;
}
function journalCaptureTaskPageSyncAnchorV530(layout){
  const token=++journalTaskSyncTokenV530;
  const root=layout==='board'?elements.boardView:elements.listView;
  if(!journalSubscribedRenderV528||!journalTaskV411()
    ||state.layout!=='tasks'||state.taskLayout!==layout||root.hidden
    ||elements.taskDialog?.open||elements.timelineMoveDialog?.open
    ||elements.detailPanel?.classList.contains('open'))return null;
  const active=root.contains(document.activeElement)?document.activeElement:null;
  // V549: a remote repaint can arrive before V515's pending filter-focus
  // frame. If the user has focused a DIFFERENT control in the meantime,
  // invalidate the old request and let this subscription restore the latest.
  if(layout==='list'&&active&&journalIndexPendingFocusV549
    &&active!==journalIndexPendingFocusV549.findNextControl()){
    ++journalIndexRefreshTokenV515;
    journalIndexPendingFocusV549=null;
  }
  const focus=journalTaskSyncDescriptorV530(root,layout,active);
  const visible=el=>{
    const rect=el.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&rect.bottom>8&&rect.top<window.innerHeight-8;
  };
  const candidates=layout==='board'
    ?'[data-j420-task-id],#j494AtelierNote,.j420-atelier-tools,.j420-atelier-index'
    :'[data-j425-row],.j425-task-preview,.j425-workbench-toolbar,.j425-index-rail';
  const anchorNode=active&&focus&&visible(active)?active:
    [...root.querySelectorAll(candidates)].find(visible);
  const search=active?.matches('[data-j420-search],[data-j425-query]')?{
    value:active.value,start:active.selectionStart,end:active.selectionEnd,
    direction:active.selectionDirection
  }:null;
  // V532: remember the previous order only during remote repaint. IDs remain
  // canonical; deleted items resolve to the following row, then preceding row.
  const rowAttr=layout==='board'?'data-j420-task-id':'data-j425-row';
  const rows=[...root.querySelectorAll('['+rowAttr+']')];
  const order=rows.map(el=>el.getAttribute(rowAttr));
  const selected=layout==='board'?journalAtelierSelectedV420:journalIndexStateV425.selected;
  // V546: the phone's inline reader is a viewing choice. Keep it alive when
  // a remote update removes its selected row but leaves another visible case.
  const inlineReader=layout==='list'&&journalInlineDetailMediaV491.matches
    &&journalTaskInlineSelectedV491===selected
    &&Boolean(root.querySelector('.j425-task-preview.j491-inline-detail'));
  // V552: preserve an explicitly opened phone desk note only for remote
  // snapshots. Local view/search changes still close it as before.
  const atelierInlineReaderV552=layout==='board'&&journalAtelierInlineMediaV494.matches
    &&journalAtelierInlineOpenV494
    &&Boolean(root.querySelector('#j494AtelierNote.j494-inline-note'));
  const selectedRow=inlineReader?rows.find(el=>el.getAttribute(rowAttr)===selected):null;
  // V556: the reading section is a better remote-repaint anchor than an
  // offscreen focused heading when the note contains several screens of text.
  const readerAnchorV556=layout==='board'&&atelierInlineReaderV552
    &&journalAtelierReaderAnchorV556?.id===selected
    &&journalAtelierReaderAnchorV556.width===window.innerWidth
    ?{...journalAtelierReaderAnchorV556}:null;
  return {token,layout,focus,anchor:journalTaskSyncDescriptorV530(root,layout,anchorNode),
    top:anchorNode?.getBoundingClientRect().top??null,width:window.innerWidth,search,
    order,selected,inlineReader,rowTop:selectedRow?.getBoundingClientRect().top??null,
    atelierInlineReaderV552,readerAnchorV556,
    focusWasVisibleV556:Boolean(active&&visible(active))};
}
function journalNearestSurvivingTaskV532(snapshot,available){
  const existing=new Set(available);
  if(existing.has(snapshot.selected))return snapshot.selected;
  const index=snapshot.order.indexOf(snapshot.selected);
  if(index<0)return available[0]||'';
  for(let i=index+1;i<snapshot.order.length;i++)
    if(existing.has(snapshot.order[i]))return snapshot.order[i];
  for(let i=index-1;i>=0;i--)
    if(existing.has(snapshot.order[i]))return snapshot.order[i];
  return available[0]||'';
}
function journalRestoreTaskPageSyncAnchorV530(snapshot){
  if(!snapshot)return;
  requestAnimationFrame(()=>{
    if(snapshot.token!==journalTaskSyncTokenV530||!journalTaskV411()
      ||state.layout!=='tasks'||state.taskLayout!==snapshot.layout)return;
    const root=snapshot.layout==='board'?elements.boardView:elements.listView;
    if(root.hidden)return;
    // If a different control gained focus after the snapshot, leave it alone.
    const current=document.activeElement;
    if(current&&current!==document.body&&current!==document.documentElement
      &&current.isConnected)return;
    const rowAttr=snapshot.layout==='board'?'data-j420-task-id':'data-j425-row';
    // If the last matching case disappears while the phone reader is open,
    // bring its existing empty-state recovery action into the same viewport.
    const emptyReaderV546=snapshot.layout==='list'&&snapshot.inlineReader
      &&!root.querySelector('[data-j425-row]');
    const emptyTargetV546=emptyReaderV546
      ?root.querySelector('[data-j518-empty-reset]')||root.querySelector('.j518-index-empty')
      :null;
    // V552: when the last desk case disappears, the open phone note is
    // hidden. Move to its existing reset/create action instead of a hidden h4.
    const emptyAtelierV552=snapshot.layout==='board'&&snapshot.atelierInlineReaderV552
      &&!root.querySelector('[data-j420-task-id]');
    const emptyTargetV552=emptyAtelierV552
      ?root.querySelector('[data-j520-empty-reset],[data-j520-empty-new]')
        ||root.querySelector('.j520-atelier-empty')
      :null;
    const selectedNode=[...root.querySelectorAll('['+rowAttr+']')]
      .find(el=>el.getAttribute(rowAttr)===snapshot.selected);
    const anchor=emptyTargetV546||emptyTargetV552||journalTaskSyncLocateV530(root,snapshot.anchor)
      ||(snapshot.anchor?.name===rowAttr&&!selectedNode
        ?root.querySelector('['+rowAttr+'].is-selected'):null);
    if(anchor&&document.scrollingElement&&Number.isFinite(snapshot.top)
      &&snapshot.width===window.innerWidth)
      document.scrollingElement.scrollTop+=anchor.getBoundingClientRect().top-snapshot.top;
    else if(anchor)anchor.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    // V556: when the same long phone note survives sync, keep the visible
    // section at its prior reading coordinate even if earlier text reflows.
    const savedReadingV556=snapshot.readerAnchorV556;
    if(savedReadingV556&&savedReadingV556.id===journalAtelierSelectedV420
      &&savedReadingV556.width===window.innerWidth&&document.scrollingElement){
      const section=root.querySelector('#j494AtelierNote.j494-inline-note '+savedReadingV556.selector);
      if(section){
        document.scrollingElement.scrollTop+=section.getBoundingClientRect().top-savedReadingV556.top;
      }
    }
    let target=emptyTargetV546||emptyTargetV552||journalTaskSyncLocateV530(root,snapshot.focus);
    if(target?.matches('[data-j540-case-step]')&&target.disabled){
      // A subscription may leave the reader at the first/last visible case.
      // Never put keyboard focus on a now-disabled navigation button.
      const opposite=String(-Number(target.dataset.j540CaseStep));
      target=root.querySelector('[data-j540-case-step="'+opposite+'"]:not(:disabled)')
        ||root.querySelector('.j425-task-preview h3')
        ||root.querySelector('[data-j425-query]');
    }
    if(target?.matches('[data-j553-case-step]')&&target.disabled){
      // V553: a remote update can move the reader to the first/last case.
      // The old page direction must not receive focus while disabled.
      const opposite=String(-Number(target.dataset.j553CaseStep));
      target=root.querySelector('[data-j553-case-step="'+opposite+'"]:not(:disabled)')
        ||root.querySelector('#j494AtelierNote.j494-inline-note .j420-note-lead h4')
        ||root.querySelector('[data-j420-search]');
    }
    if(!target&&snapshot.focus){
      // A deleted or filtered-out row must not send keyboard focus to a
      // stale note or the first unrelated record.
      target=snapshot.focus.name===rowAttr
        ?root.querySelector('['+rowAttr+'].is-selected')
        :null;
      target ||=journalTaskSyncLocateV530(root,snapshot.anchor)
        ||root.querySelector(snapshot.layout==='board'?'[data-j420-search]':'[data-j425-query]');
    }
    if(!target)return;
    if(!target.matches('button,input,select,a,[tabindex]'))target.tabIndex=-1;
    target.focus({preventScroll:true});
    if(snapshot.search&&target.matches('[data-j420-search],[data-j425-query]')){
      if(target.value!==snapshot.search.value)target.value=snapshot.search.value;
      try{target.setSelectionRange(snapshot.search.start,snapshot.search.end,
        snapshot.search.direction)}catch{}
    }
    const rect=target.getBoundingClientRect();
    // An offscreen heading remains the keyboard focus but must not yank a
    // person reading halfway down a long note back to the beginning.
    const readingOffscreenV556=snapshot.layout==='board'
      &&snapshot.atelierInlineReaderV552&&!snapshot.focusWasVisibleV556
      &&Boolean(target.closest('#j494AtelierNote'));
    if((rect.top<0||rect.bottom>window.innerHeight)&&!readingOffscreenV556)
      target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    if(snapshot.layout==='board'&&journalAtelierInlineOpenV494)
      journalCaptureAtelierReaderAnchorV556();
  });
}
// Collapse state is presentation-only and resets when the room/user changes.
const journalAtelierCollapsedGroupsV565=new Set();
let journalAtelierGroupOwnerV565='';
function journalAtelierV420(tasks){
  const groupOwnerV565=ROOM_ID+'|'+getCurrentUser();
  if(groupOwnerV565!==journalAtelierGroupOwnerV565){
    journalAtelierCollapsedGroupsV565.clear();
    journalAtelierGroupOwnerV565=groupOwnerV565;
  }
  // A new local or subscribed render supersedes all older note-page focus work.
  ++journalAtelierPageTokenV553;
  const syncAnchorV530=journalCaptureTaskPageSyncAnchorV530('board');
  const formerNoteV562=elements.boardView.querySelector('#j494AtelierNote.j562-desk-open');
  const readerScrollV562=formerNoteV562?.scrollTop||0;
  const readerTaskV562=journalAtelierSelectedV420;
  const waitingRe=/確認待|回答待|承認待|レビュー待|検収待/;
  const supplyRe=/材料待|準備待|部品待|資料待|納品待|手配待/;
  const requestRe=/依頼中|対応待|外部依頼/;
  const now=new Date(todayISO()+'T00:00:00').getTime();
  const week=t=>t.dueDate&&!isOverdue(t)&&new Date(t.dueDate+'T00:00:00').getTime()-now<=7*86400000;
  const viewFns={
    all:t=>true,
    focus:t=>isDueToday(t)||isOverdue(t)||t.pinned||['高','緊急'].includes(t.priority),
    waiting:t=>waitingRe.test(t.status),
    material:t=>supplyRe.test(t.status),
    request:t=>requestRe.test(t.status),
    finishing:t=>{const p=checklistProgress(t);return p.total>0&&p.done>0&&p.done<p.total&&p.percent>=70},
  };
  const views=[
    {id:'all',label:'すべての案件'},
    {id:'focus',label:'今日触る'},
    {id:'waiting',label:'確認待ち'},
    {id:'material',label:'材料待ち'},
    {id:'request',label:'依頼中'},
    {id:'finishing',label:'完了間近'},
  ];
  if(!viewFns[journalAtelierViewV420])journalAtelierViewV420='all';
  const viewTasks=tasks.filter(t=>viewFns[journalAtelierViewV420](t)&&(!journalAtelierCategoryV420||t.category===journalAtelierCategoryV420));
  const used=new Set();
  const collect=predicate=>viewTasks.filter(t=>!used.has(t.id)&&predicate(t)&&!!used.add(t.id));
  const groups=[
    {id:'focus',roman:'Ⅰ',title:'今すぐ進める',items:collect(t=>isDueToday(t)||isOverdue(t)||t.pinned||['高','緊急'].includes(t.priority))},
    {id:'waiting',roman:'Ⅱ',title:'確認待ち',items:collect(t=>waitingRe.test(t.status)||requestRe.test(t.status))},
    {id:'materials',roman:'Ⅲ',title:'材料待ち',items:collect(t=>supplyRe.test(t.status))},
    {id:'week',roman:'Ⅳ',title:'今週の締切',items:collect(week)},
    {id:'other',roman:'Ⅴ',title:'その他の案件',items:collect(()=>true)},
  ];
  // JOURNAL V520: leave the decorative four-shelf layout on an unfiltered
  // desktop desk, but never reserve empty shelves on phones or filtered views.
  const compactGroups=journalAtelierViewV420!=='all'
    ||Boolean(journalAtelierCategoryV420)||Boolean(elements.searchInput.value.trim());
  const displayGroups=groups.filter(g=>g.id!=='other'||g.items.length)
    .filter(g=>g.items.length||(!compactGroups&&viewTasks.length>0));
  const activeFilterCountV520=Number(journalAtelierViewV420!=='all')
    +Number(Boolean(journalAtelierCategoryV420))
    +Number(Boolean(elements.searchInput.value.trim()));
  const categories=[...new Set([...(state.categories||[]),...tasks.map(t=>t.category)].filter(Boolean))];
  const counts=views.map(v=>({ ...v,count:tasks.filter(viewFns[v.id]).length }));
  const dueSoon=tasks.filter(t=>t.dueDate&&week(t)).length;
  const activities=[...tasks].filter(t=>Number(t.updatedAt)>0).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,6);
  if(!viewTasks.some(t=>t.id===journalAtelierSelectedV420)){
    const returnAnchorV538=journalTaskNoteReturnV519?.layout==='board'
      &&journalTaskNoteReturnV519.id===journalAtelierSelectedV420
      ?journalTaskNoteReturnV519:null;
    journalAtelierSelectedV420=syncAnchorV530
      ?journalNearestSurvivingTaskV532(syncAnchorV530,viewTasks.map(t=>t.id))
      :returnAnchorV538
        ?journalNearestSurvivingTaskV532(returnAnchorV538,viewTasks.map(t=>t.id))
        :viewTasks[0]?.id||'';
    journalAtelierDeskNoteOpenV562=false;
    journalAtelierInlineOpenV494=Boolean(syncAnchorV530?.atelierInlineReaderV552
      &&journalAtelierSelectedV420);
    journalAtelierReturnAnchorV516=null;
  }
  const chosen=viewTasks.find(t=>t.id===journalAtelierSelectedV420);
  const renderGroup=g=>{
    const expanded=!journalAtelierCollapsedGroupsV565.has(g.id);
    return `<section class="j420-island j420-island-${g.id} ${g.items.length?'':'j520-empty-island'}"
      aria-label="${g.title}" data-j565-island="${g.id}" data-j565-expanded="${expanded}">
      <header><span class="j420-island-roman">${g.roman}</span>
        <button type="button" class="j565-island-toggle" data-j565-island-toggle="${g.id}"
          aria-expanded="${expanded}" aria-controls="j565IslandItems-${g.id}"
          aria-label="${escapeHtml(g.title)}を${expanded?'折りたたむ':'展開する'}">
          <span class="j565-island-title">${g.title}</span>
          <small>${g.items.length} 件</small><span class="j565-island-chevron" aria-hidden="true">⌄</span>
        </button><svg class="j425-island-pin" aria-hidden="true"><use href="./assets/journal-fasteners-v425.svg#pin"></use></svg>
      </header>
      <div class="j420-island-items" id="j565IslandItems-${g.id}" ${expanded?'':'hidden'}>
        ${g.items.map(journalAtelierCardV420).join('')||'<p class="j420-island-empty">この棚の案件はありません</p>'}
      </div>
    </section>`;
  };
  elements.boardView.innerHTML=`<div class="j420-atelier">
    <header class="j420-atelier-hero">
      <div><span class="j420-eyebrow">03 / TASK ATELIER</span><h2>案件アトリエ</h2></div>
      <div class="j420-atelier-stats"><span><small>表示中</small><strong>${viewTasks.length}<em>件</em></strong></span><span><small>今日動かす</small><strong>${counts[1].count}<em>件</em></strong></span><span><small>確認待ち</small><strong>${counts[2].count}<em>件</em></strong></span><span class="j420-late"><small>今週の期限</small><strong>${dueSoon}<em>件</em></strong></span></div>
    </header>
    <div class="j420-atelier-workbench">
      <aside class="j420-atelier-index" aria-label="案件索引" data-j502-index-open="${journalIndexExpandedV502}">
        <span class="j420-ribbon" aria-hidden="true"></span>
        <button type="button" class="j502-index-toggle" data-j502-toggle-index aria-expanded="${journalIndexExpandedV502}" aria-controls="j502IndexContents"><span>案件索引・絞り込み${activeFilterCountV520?'<small class="j520-index-filter-count">'+activeFilterCountV520+'条件適用中</small>':''}</span><span class="j502-index-state">${journalIndexExpandedV502?'閉じる':'開く'}</span></button>
        <div class="j502-index-contents" id="j502IndexContents">
        <h3>案件索引</h3><small>VIEW & CATEGORY</small>
        <h4>作業のしおり</h4>
        <nav aria-label="作業のしおり">${counts.map((v,i)=>`<button type="button" data-j420-view="${v.id}" aria-pressed="${journalAtelierViewV420===v.id}"><span class="j420-index-num">${String(i+1).padStart(2,'0')}</span>${v.label}<strong>${v.count}</strong></button>`).join('')}</nav>
        <h4>案件カテゴリ</h4>
        <nav class="j420-atelier-categories" aria-label="案件カテゴリ">
          <button type="button" data-j420-category="" aria-pressed="${!journalAtelierCategoryV420}">すべての分類</button>
          ${categories.map((c,i)=>`<button type="button" data-j420-category="${escapeHtml(c)}" aria-pressed="${journalAtelierCategoryV420===c}"><span class="j420-index-num">${String(i+1).padStart(2,'0')}</span>${escapeHtml(c)}<strong>${tasks.filter(t=>t.category===c).length}</strong></button>`).join('')}
        </nav>
        <label class="j565-atelier-sort">表示順<select data-j565-atelier-sort>
          ${[['smart','おすすめ順'],['due','期限が近い順'],['updated','更新日時（新しい順）'],['priority','優先度順']].map(([k,v])=>`<option value="${k}" ${elements.sortSelect.value===k?'selected':''}>${v}</option>`).join('')}
        </select></label>
        <button type="button" class="j420-index-reset" data-j420-reset-view>索引をリセット</button>
        </div>
      </aside>
      <section class="j420-atelier-desk" aria-label="案件の作業机">
        <div class="j420-atelier-tools"><span class="j420-desk-flourish" aria-hidden="true">✦</span>
          <button type="button" class="j420-create-task" data-j420-new-task>＋ 新しいタスク</button>
          <label class="j420-atelier-search"><span aria-hidden="true">⌕</span><input type="search" data-j420-search value="${escapeHtml(elements.searchInput.value)}" placeholder="案件・タスクを検索" aria-label="案件を検索"></label>
          <button type="button" data-j420-reset-view>絞り込み解除</button>
          <div class="j420-atelier-switch" role="group" aria-label="タスク表示形式">
            <button type="button" aria-pressed="true" title="アトリエ">机上</button>
            <button type="button" data-j420-layout="list" title="索引一覧">一覧</button>
            <button type="button" data-j420-layout="timeline" title="日付日誌">日誌</button>
            <button type="button" data-j420-layout="dashboard" title="集計ダッシュボード">ダッシュボード</button>
          </div>
          ${journalReservedTaskShortcutV565()}
        </div>
        <div class="j420-island-grid">${displayGroups.map(renderGroup).join('')||`<div class="j420-atelier-empty j520-atelier-empty" role="status">
          <strong>${syncAnchorV530?.atelierInlineReaderV552
            ?'閲覧中の案件が同期更新で表示対象から外れました'
            :activeFilterCountV520?'条件に合う案件がありません':'登録された案件はありません'}</strong>
          <p>${activeFilterCountV520?'表示条件を解除すると、他の案件を確認できます。':'新しいタスクを作成すると、机上に表示されます。'}</p>
          ${activeFilterCountV520?'<button type="button" data-j520-empty-reset>条件を解除して案件を表示</button>':'<button type="button" data-j520-empty-new>＋ タスクを追加</button>'}
        </div>`}</div>
        <div class="j420-stationery j420-atelier-stationery" aria-hidden="true"><img class="j441-atelier-cards" src="./assets/journal-atelier-cards-v441.svg" alt="" decoding="async"><span class="j420-stamp">JOURNAL / TASK ATELIER</span></div>
      </section>
      <aside class="j420-atelier-log" aria-label="進行ログ">
        <span class="j420-clip-top" aria-hidden="true"></span><h3>進行ログ</h3><small>RECENT ACTIVITY</small>
        <div class="j420-log-entries">${activities.map(t=>`<button type="button" data-j420-log-task="${escapeHtml(t.id)}"><time>${escapeHtml(formatDateTime(t.updatedAt))}</time><span><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.lastChange?.label||'更新')} / ${escapeHtml(t.status)}</small></span></button>`).join('')||'<p>最近更新された案件はありません。</p>'}</div>
        <button type="button" class="j420-log-all" data-j420-layout="timeline">日付日誌を開く →</button>
      </aside>
    </div>
    <section class="j420-project-note" id="j494AtelierNote" aria-label="選択中の案件ノート" hidden>
      <div class="j420-note-binding" aria-hidden="true"></div>
      <header><span aria-hidden="true">▣</span><strong>案件ノート</strong><small>PROJECT NOTE</small><button type="button" class="j494-atelier-back" data-j494-atelier-back>← 机上へ戻る</button><button type="button" class="j562-desk-note-close" data-j562-close-desk aria-label="案件ノートを閉じる">閉じる ×</button></header>
      <div class="j553-atelier-pager" role="group" aria-label="案件ノートの前後移動" hidden>
        <button type="button" data-j553-case-step="-1">前の案件</button>
        <span data-j553-case-position aria-live="polite"></span>
        <button type="button" data-j553-case-step="1">次の案件</button>
      </div>
      ${journalAtelierNoteV420(chosen)}
      <svg class="j425-note-pin" aria-hidden="true"><use href="./assets/journal-fasteners-v425.svg#clip"></use></svg>
    </section>
  </div>`;
  const root=elements.boardView;
  root.querySelectorAll('[data-j420-task-id]').forEach(card=>{
    const select=()=>{
      ++journalAtelierPageTokenV553;
      journalAtelierReaderAnchorV556=null;
      journalAtelierSelectedV420=card.dataset.j420TaskId;
      journalRememberTaskNavigationV534('board',journalAtelierSelectedV420);
      journalAtelierReturnAnchorV516=journalAtelierInlineMediaV494.matches
        ?{id:journalAtelierSelectedV420,top:card.getBoundingClientRect().top,width:window.innerWidth}:null;
      journalAtelierInlineOpenV494=journalAtelierInlineMediaV494.matches;
      journalAtelierDeskNoteOpenV562=true;
      root.querySelectorAll('[data-j420-task-id]').forEach(el=>
        el.classList.toggle('is-selected',el.dataset.j420TaskId===journalAtelierSelectedV420));
      const chosenTask=viewTasks.find(t=>t.id===journalAtelierSelectedV420);
      const currentNote=root.querySelector('.j420-note-card,.j420-note-empty');
      if(currentNote)currentNote.outerHTML=journalAtelierNoteV420(chosenTask);
      bindJournalAtelierNoteActionsV420(root);
      journalPositionAtelierNoteV494(root);
      if(!journalAtelierPagingV554)journalFocusAtelierNoteV500(root,true);
    };
    card.addEventListener('click',select);
    card.addEventListener('dblclick',e=>{e.preventDefault();journalOpenTaskNoteV519(card.dataset.j420TaskId,'board','row',card,true)});
    card.addEventListener('keydown',e=>{if(e.target!==card)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
  });
  root.querySelectorAll('[data-j420-log-task]').forEach(btn=>btn.addEventListener('click',()=>{
    const task=tasks.find(t=>t.id===btn.dataset.j420LogTask);
    if(!task)return;
    // The recent log is available even while a view/category hides this task.
    // Clear only the incompatible filters, so the requested record is never
    // silently replaced by the first record in the narrowed view.
    if(!viewFns[journalAtelierViewV420]?.(task))journalAtelierViewV420='all';
    if(journalAtelierCategoryV420&&task.category!==journalAtelierCategoryV420)journalAtelierCategoryV420='';
    journalAtelierSelectedV420=task.id;
    journalRememberTaskNavigationV534('board',task.id);
    journalAtelierReturnAnchorV516=null;
    journalAtelierInlineOpenV494=journalAtelierInlineMediaV494.matches;
    journalAtelierDeskNoteOpenV562=true;
    journalAtelierV420(tasks);
    journalFocusAtelierNoteV500(elements.boardView,true);
  }));
  root.querySelector('[data-j502-toggle-index]')?.addEventListener('click',event=>{
    journalIndexExpandedV502=!journalIndexExpandedV502;
    const toggle=event.currentTarget;
    toggle.setAttribute('aria-expanded',String(journalIndexExpandedV502));
    toggle.closest('.j420-atelier-index').dataset.j502IndexOpen=String(journalIndexExpandedV502);
    toggle.querySelector('.j502-index-state').textContent=journalIndexExpandedV502?'閉じる':'開く';
  });
  root.querySelector('[data-j420-new-task]')?.addEventListener('click',()=>openTaskDialog());
  root.querySelectorAll('[data-j420-view]').forEach(btn=>btn.addEventListener('click',()=>{
    const value=btn.dataset.j420View;
    journalAtelierViewV420=value;
    journalRefreshAtelierControlV516(tasks,btn,()=>[...elements.boardView.querySelectorAll('[data-j420-view]')].find(el=>el.dataset.j420View===value));
  }));
  root.querySelectorAll('[data-j420-category]').forEach(btn=>btn.addEventListener('click',()=>{
    const value=btn.dataset.j420Category;
    journalAtelierCategoryV420=value;
    journalRefreshAtelierControlV516(tasks,btn,()=>[...elements.boardView.querySelectorAll('[data-j420-category]')].find(el=>el.dataset.j420Category===value));
  }));
  root.querySelector('[data-j565-atelier-sort]')?.addEventListener('change',event=>{
    elements.sortSelect.value=event.currentTarget.value;
    journalRefreshAtelierControlV516(getFilteredTasks(),event.currentTarget,
      ()=>elements.boardView.querySelector('[data-j565-atelier-sort]'));
  });
  root.querySelectorAll('[data-j565-island-toggle]').forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.j565IslandToggle;
    const island=button.closest('[data-j565-island]');
    const items=island?.querySelector('.j420-island-items');
    if(!items)return;
    const expanded=items.hidden;
    items.hidden=!expanded;
    island.dataset.j565Expanded=String(expanded);
    button.setAttribute('aria-expanded',String(expanded));
    button.setAttribute('aria-label',island.getAttribute('aria-label')+(expanded?'を折りたたむ':'を展開する'));
    if(expanded)journalAtelierCollapsedGroupsV565.delete(key);
    else{
      journalAtelierCollapsedGroupsV565.add(key);
      // Closing a shelf must not leave the open reader with a hidden origin.
      const current=[...island.querySelectorAll('[data-j420-task-id]')]
        .some(card=>card.dataset.j420TaskId===journalAtelierSelectedV420);
      if(current){
        journalAtelierInlineOpenV494=false;
        journalAtelierDeskNoteOpenV562=false;
        journalPositionAtelierNoteV494(root);
      }
    }
  }));
  // The toolbar and the empty-state recovery share a single reset path.
  const resetAtelierV520=(source,focusSearch)=>{
    const previousTop=source.getBoundingClientRect().top;
    const wasVisible=previousTop>=0&&previousTop<=window.innerHeight;
    const token=++journalAtelierRefreshTokenV516;
    journalAtelierReturnAnchorV516=null;
    journalAtelierViewV420='all';
    journalAtelierCategoryV420='';
    // Capture the explicit reset, not the previous input value, in the
    // subscribed-render focus snapshot.
    const visibleSearch=root.querySelector('[data-j420-search]');
    if(visibleSearch){
      const hadQuery=Boolean(elements.searchInput.value);
      visibleSearch.value='';
      // Bubble through JOURNAL's existing shared-query owner before repaint.
      visibleSearch.dispatchEvent(new Event('input',{bubbles:true}));
      if(!hadQuery)journalAtelierV420(tasks);
    }else if(elements.searchInput.value){
      elements.searchInput.value='';
      elements.searchInput.dispatchEvent(new Event('input',{bubbles:true}));
    }else journalAtelierV420(tasks);
    requestAnimationFrame(()=>{
      if(token!==journalAtelierRefreshTokenV516||!journalTaskV411()||elements.boardView.hidden)return;
      const target=[...elements.boardView.querySelectorAll(focusSearch?'[data-j420-search]':'[data-j420-reset-view]')]
        .find(el=>el.getClientRects().length>0)
        ||elements.boardView.querySelector('[data-j420-new-task]');
      if(!target)return;
      const current=document.activeElement;
      if(current&&current!==document.body&&current!==document.documentElement
        &&current.isConnected&&current!==target)return;
      target.focus({preventScroll:true});
      if(!focusSearch&&wasVisible&&document.scrollingElement){
        document.scrollingElement.scrollTop+=target.getBoundingClientRect().top-previousTop;
      }else target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    });
  };
  root.querySelectorAll('[data-j420-reset-view]').forEach(btn=>btn.addEventListener('click',event=>
    resetAtelierV520(event.currentTarget,false)));
  root.querySelector('[data-j520-empty-reset]')?.addEventListener('click',event=>
    resetAtelierV520(event.currentTarget,true));
  root.querySelector('[data-j520-empty-new]')?.addEventListener('click',()=>openTaskDialog());
  root.querySelectorAll('[data-j420-layout]').forEach(btn=>btn.addEventListener('click',()=>journalSwitchTaskPageV509(btn.dataset.j420Layout)));
  journalBindReservedTaskShortcutV565(root);
  bindJournalAtelierNoteActionsV420(root);
  journalPositionAtelierNoteV494(root);
  if(journalAtelierDeskNoteOpenV562&&readerTaskV562===journalAtelierSelectedV420)
    root.querySelector('#j494AtelierNote.j562-desk-open')?.scrollTo({top:readerScrollV562,behavior:'instant'});
  const closeDeskNoteV562=()=>{
    if(!journalAtelierDeskNoteOpenV562||journalAtelierInlineMediaV494.matches)return;
    journalAtelierDeskNoteOpenV562=false;
    journalPositionAtelierNoteV494(root);
    const source=[...root.querySelectorAll('[data-j420-task-id]')]
      .find(el=>el.dataset.j420TaskId===journalAtelierSelectedV420);
    source?.focus({preventScroll:true});
  };
  root.querySelector('[data-j562-close-desk]')?.addEventListener('click',closeDeskNoteV562);
  root.querySelector('#j494AtelierNote')?.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||journalAtelierInlineMediaV494.matches
      ||elements.detailPanel?.classList.contains('open')||elements.taskDialog?.open)return;
    event.preventDefault();event.stopPropagation();closeDeskNoteV562();
  });
  // V553: reuse the same real card click path as ordinary selection.
  root.querySelectorAll('[data-j553-case-step]').forEach(button=>button.addEventListener('click',()=>{
    if(!journalAtelierInlineMediaV494.matches||!journalAtelierInlineOpenV494
      ||button.disabled)return;
    const cards=[...root.querySelectorAll('[data-j420-task-id]')];
    const index=cards.findIndex(el=>el.dataset.j420TaskId===journalAtelierSelectedV420);
    const step=Number(button.dataset.j553CaseStep);
    const next=index>=0?cards[index+step]:null;
    if(!next)return;
    const top=button.getBoundingClientRect().top;
    const width=window.innerWidth;
    const id=next.dataset.j420TaskId;
    journalAtelierPagingV554=true;
    try{next.click();}
    finally{journalAtelierPagingV554=false;}
    const activeAtRequestV554=document.activeElement;
    const token=journalAtelierPageTokenV553;
    requestAnimationFrame(()=>{
      if(token!==journalAtelierPageTokenV553||!journalTaskV411()
        ||state.layout!=='tasks'||state.taskLayout!=='board'
        ||elements.boardView.hidden||!journalAtelierInlineMediaV494.matches
        ||!journalAtelierInlineOpenV494||journalAtelierSelectedV420!==id)return;
      const note=root.querySelector('#j494AtelierNote.j494-inline-note');
      if(!note)return;
      // A newer action wins even if it focuses a different control *inside*
      // the same notebook; the previous note/heading focus is not queued.
      const current=document.activeElement;
      if(current&&current!==activeAtRequestV554
        &&current!==document.body&&current!==document.documentElement
        &&current.isConnected)return;
      const forward=note.querySelector('[data-j553-case-step="'+step+'"]');
      const reverse=note.querySelector('[data-j553-case-step="'+(-step)+'"]');
      const target=forward&&!forward.disabled?forward:
        reverse&&!reverse.disabled?reverse:note.querySelector('.j420-note-lead h4');
      if(!target)return;
      if(!target.matches('button,input,select,a,[tabindex]'))target.tabIndex=-1;
      target.focus({preventScroll:true});
      if(width===window.innerWidth&&Number.isFinite(top)
        &&top>=0&&top<=window.innerHeight&&document.scrollingElement){
        document.scrollingElement.scrollTop+=target.getBoundingClientRect().top-top;
      }
      const rect=target.getBoundingClientRect();
      if(rect.top<0||rect.bottom>window.innerHeight)
        target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
      journalCaptureAtelierReaderAnchorV556();
    });
  }));
  root.querySelector('[data-j494-atelier-back]')?.addEventListener('click',()=>{
    ++journalAtelierPageTokenV553;
    journalAtelierInlineOpenV494=false;
    // A closed phone notebook must remain closed after returning to a PC width.
    journalAtelierDeskNoteOpenV562=false;
    journalPositionAtelierNoteV494(root);
    const source=[...root.querySelectorAll('[data-j420-task-id]')]
      .find(el=>el.dataset.j420TaskId===journalAtelierSelectedV420);
    const anchor=journalAtelierReturnAnchorV516;
    journalAtelierReturnAnchorV516=null;
    source?.focus({preventScroll:true});
    requestAnimationFrame(()=>{
      if(!source?.isConnected||!journalTaskV411()||elements.boardView.hidden)return;
      if(anchor?.id===journalAtelierSelectedV420&&anchor.width===window.innerWidth
        &&anchor.top>=0&&anchor.top<=window.innerHeight&&document.scrollingElement){
        // Reparenting the notebook changes the page height. Restore the source
        // card's original viewport coordinate instead of centering it.
        document.scrollingElement.scrollTop+=source.getBoundingClientRect().top-anchor.top;
      }else source.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    });
  });
  const input=root.querySelector('[data-j420-search]');
  if(input){
    let composing=false;
    const apply=()=>{
      if(elements.searchInput.value===input.value)return;
      const start=input.selectionStart??input.value.length;
      const end=input.selectionEnd??start;
      const direction=input.selectionDirection||'none';
      const token=++journalAtelierSearchFocusTokenV551;
      elements.searchInput.value=input.value;
      elements.searchInput.dispatchEvent(new Event('input',{bubbles:true}));
      requestAnimationFrame(()=>{
        if(token!==journalAtelierSearchFocusTokenV551||!journalTaskV411()
          ||state.layout!=='tasks'||state.taskLayout!=='board'
          ||elements.boardView.hidden)return;
        const next=elements.boardView.querySelector('[data-j420-search]');
        const current=document.activeElement;
        // The source search was rebuilt; focus only when no newer control won.
        if(!next||(current&&current!==document.body
          &&current!==document.documentElement&&current.isConnected
          &&current!==next))return;
        next.focus({preventScroll:true});
        try{next.setSelectionRange(start,end,direction)}catch{}
      });
    };
    input.addEventListener('compositionstart',()=>{composing=true;journalSearchComposingV530=input});
    input.addEventListener('compositionend',()=>{
      composing=false;apply();journalFinishSearchCompositionV530(input);
    });
    input.addEventListener('blur',()=>journalFinishSearchCompositionV530(input));
    input.addEventListener('input',e=>{if(!composing&&!e.isComposing)apply()});
  }
  journalRestoreTaskPageSyncAnchorV530(syncAnchorV530);
}

// State is view-only, scoped to JOURNAL; business data remains canonical.
const journalIndexStateV425 = {status:'',category:'',assignee:'',due:'all',query:'',sort:'default',selected:''};
// Presentation-only expansion state; never stored in shared task records.
let journalIndexFiltersExpandedV447=false;
// JOURNAL V513: temporary viewport anchor for the currently expanded list note.
let journalIndexReturnAnchorV513=null;

function journalIndexPreviewV425(t,index){
 const p=checklistProgress(t);
 const pending=(t.checklist||[]).find(item=>!item.done);
 const notes=(t.comments||[]).filter(item=>String(item.text||'').trim());
 const note=notes.length?notes[notes.length-1]:null;
 return `<div class="j425-index-preview">
   <button type="button" class="j491-task-return" data-j491-task-return>← 一覧へ戻る</button>
   <span class="j425-preview-ref">SELECTED CASE / No.${String(index).padStart(2,'0')}</span>
   <div class="j540-case-pager" role="group" aria-label="一覧の案件を続けて確認">
     <button type="button" data-j540-case-step="-1">前の案件</button>
     <button type="button" data-j540-case-step="1">次の案件</button>
   </div>
   <h3>${escapeHtml(t.title)}</h3><div class="j425-preview-label">${escapeHtml(t.category||'未分類')}　/　${escapeHtml(t.status)}</div>
   <dl><div><dt>担当</dt><dd>${escapeHtml(t.assignee||'未割当')}</dd></div>
   <div><dt>優先度</dt><dd>${escapeHtml(t.priority)}</dd></div>
   <div><dt>期限</dt><dd class="${isOverdue(t)?'is-overdue':''}">${escapeHtml(t.dueDate||'期限なし')}${isOverdue(t)?'（期限超過）':''}</dd></div>
   <div><dt>進捗</dt><dd>${p.done} / ${p.total}（${p.percent}%）</dd></div></dl>
   <div class="j425-preview-progress" role="progressbar" aria-label="チェックリストの進捗" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p.percent}%"></span></div>
   <section><h4>概要</h4><p>${escapeHtml(t.description||'説明は登録されていません。')}</p></section>
   <section><h4>チェックリスト（${p.done}/${p.total}）</h4>${(t.checklist||[]).slice(0,6).map(item=>`<p class="j425-preview-check ${item.done?'is-done':''}"><span aria-hidden="true">${item.done?'✓':'○'}</span>${escapeHtml(item.text)}</p>`).join('')||'<p>まだチェック項目はありません。</p>'}${p.total>6?`<small>ほか${p.total-6}件は詳細画面で確認できます。</small>`:''}</section>
   <section class="j430-next-work"><h4>次の一手</h4><p>${escapeHtml(pending?.text||'チェックリストの未完了項目はありません。')}</p></section>
   ${note?`<section class="j430-case-note"><h4>直近の作業メモ</h4><p>${escapeHtml(String(note.text).slice(0,220))}</p></section>`:''}
   <p class="j430-case-updated">最終更新：${escapeHtml(formatDateTime(t.updatedAt))}</p>
   <div class="j425-preview-actions"><button type="button" data-j425-preview-detail>詳細を見る</button><button type="button" data-j425-preview-edit>編集する</button></div>
   <button type="button" class="j491-task-return j511-task-return-end" data-j491-task-return>← 一覧へ戻る</button></div>`;
}
// JOURNAL V515: all index controls return to their replacement after the
// canonical paper-list rerender. No extra filter state or saved record is used.
let journalIndexRefreshTokenV515=0;
// V549: only a still-current filter action may restore its control focus.
// The subscription snapshot may cancel it when a later user focus wins.
let journalIndexPendingFocusV549=null;
// V548: a one-render, view-only reading anchor for *explicit* search/filter/
// sort operations. Subscription updates keep their separate V530 owner.
let journalIndexExplicitReaderV548=null;
function journalRefreshIndexV515(tasks,previousControl,findNextControl,onRestore){
  const previousTop=previousControl.getBoundingClientRect().top;
  const wasVisible=previousTop>=0&&previousTop<=window.innerHeight;
  const token=++journalIndexRefreshTokenV515;
  const pendingFocusV549={token,findNextControl};
  journalIndexPendingFocusV549=pendingFocusV549;
  const root=elements.listView;
  const selectedId=journalIndexStateV425.selected;
  const oldRows=[...root.querySelectorAll('[data-j425-row]')];
  const selectedRow=oldRows.find(row=>row.dataset.j425Row===selectedId);
  const readerOpen=Boolean(journalInlineDetailMediaV491.matches&&selectedId
    &&journalTaskInlineSelectedV491===selectedId
    &&root.querySelector('.j425-task-preview.j491-inline-detail'));
  journalIndexExplicitReaderV548=readerOpen?{
    selected:selectedId,order:oldRows.map(row=>row.dataset.j425Row),
    inlineReader:true,rowTop:selectedRow?.getBoundingClientRect().top??null,
    width:window.innerWidth
  }:null;
  try{journalIndexV425(tasks);}
  finally{journalIndexExplicitReaderV548=null;}
  requestAnimationFrame(()=>{
    if(journalIndexPendingFocusV549===pendingFocusV549)
      journalIndexPendingFocusV549=null;
    if(token!==journalIndexRefreshTokenV515||!journalTaskV411()
      ||elements.listView.hidden)return;
    const target=findNextControl();
    if(!target)return;
    // An explicit click/Tab after this filter changed is newer than the
    // scheduled focus recovery. Do not steal it back, even after sync.
    const current=document.activeElement;
    if(current&&current!==document.body&&current!==document.documentElement
      &&current.isConnected&&current!==target)return;
    target.focus({preventScroll:true});
    onRestore?.(target);
    if(wasVisible&&document.scrollingElement){
      document.scrollingElement.scrollTop+=target.getBoundingClientRect().top-previousTop;
    }else target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    // The search/sort control's final scroll correction can move the case
    // row too. Record its FINAL position for the existing "back to list".
    if(readerOpen&&journalTaskInlineSelectedV491===journalIndexStateV425.selected){
      const id=journalIndexStateV425.selected;
      const row=[...root.querySelectorAll('[data-j425-row]')]
        .find(el=>el.dataset.j425Row===id);
      if(row)journalIndexReturnAnchorV513={
        id,top:row.getBoundingClientRect().top,width:window.innerWidth
      };
    }
  });
}
function journalIndexV425(tasks){
  const syncAnchorV530=journalCaptureTaskPageSyncAnchorV530('list');
  const explicitReaderV548=journalIndexExplicitReaderV548;
  const filters=journalIndexStateV425;
  const appliedFilters=[filters.status,filters.category,filters.assignee].filter(Boolean).length+(filters.due!=='all'?1:0);
  const overdue=t=>isOverdue(t),soon=t=>t.dueDate&&!isOverdue(t)&&new Date(t.dueDate+'T00:00:00')<=addDays(startOfToday(),7);
  const has=t=>(!filters.status||t.status===filters.status)&&(!filters.category||t.category===filters.category)&&(!filters.assignee||t.assignee===filters.assignee)
    &&(filters.due==='all'||filters.due==='overdue'&&overdue(t)||filters.due==='week'&&soon(t)||filters.due==='none'&&!t.dueDate)
    &&(!filters.query||normalizeText([t.title,t.description,t.status,t.category,t.assignee,t.tags?.join(' ')||''].join(' ')).includes(normalizeText(filters.query)));
  const ordered=tasks.filter(has);
  if(filters.sort==='due')ordered.sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
  if(filters.sort==='updated')ordered.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  if(filters.sort==='title')ordered.sort((a,b)=>a.title.localeCompare(b.title,'ja'));
  if(filters.sort==='priority'){const rank={緊急:0,高:1,中:2,低:3};ordered.sort((a,b)=>(rank[a.priority]??4)-(rank[b.priority]??4))}
  if(!ordered.some(t=>t.id===filters.selected)){
    const previousSelectedV546=filters.selected;
    const returnAnchorV538=journalTaskNoteReturnV519?.layout==='list'
      &&journalTaskNoteReturnV519.id===filters.selected
      ?journalTaskNoteReturnV519:null;
    filters.selected=syncAnchorV530
      ?journalNearestSurvivingTaskV532(syncAnchorV530,ordered.map(t=>t.id))
      :returnAnchorV538
        ?journalNearestSurvivingTaskV532(returnAnchorV538,ordered.map(t=>t.id))
        :explicitReaderV548?.inlineReader
          ?journalNearestSurvivingTaskV532(explicitReaderV548,ordered.map(t=>t.id))
          :ordered[0]?.id||'';
    // Reuse the V544 edit return and the V532 nearby choice for a remote
    // deletion. Explicit search/filter actions still close the old reader.
    const continueReaderV544=Boolean(filters.selected&&(
      returnAnchorV538?.inlineReader
      ||(syncAnchorV530?.inlineReader&&syncAnchorV530.selected===previousSelectedV546)
      ||(explicitReaderV548?.inlineReader&&explicitReaderV548.selected===previousSelectedV546)));
    const readerAnchorV546=returnAnchorV538?.inlineReader?returnAnchorV538:
      syncAnchorV530?.inlineReader?syncAnchorV530:explicitReaderV548;
    journalTaskInlineSelectedV491=continueReaderV544?filters.selected:'';
    journalIndexReturnAnchorV513=continueReaderV544
      ?{id:filters.selected,top:readerAnchorV546?.rowTop,width:readerAnchorV546?.width}
      :null;
  }
  const selected=ordered.find(t=>t.id===filters.selected);
  const statuses=[...new Set(tasks.map(t=>t.status).filter(Boolean))];
  const categories=[...new Set(tasks.map(t=>t.category).filter(Boolean))];
  const assignees=[...new Set(tasks.map(t=>t.assignee).filter(Boolean))];
  const facet=(key,title,values,selected)=>`<section class="j430-filter-section">
    <h4>${title}</h4><div class="j430-filter-options" role="group" aria-label="${title}">
      ${[{value:'',count:tasks.length},...values.map(value=>({value,count:tasks.filter(t=>String(t[key]||'')===value).length}))].map(({value,count})=>
      `<button type="button" class="j430-filter-option" data-j430-facet="${key}" data-j430-value="${escapeHtml(value)}" aria-pressed="${selected===value}"><span class="j430-option-marker" aria-hidden="true"></span><span>${escapeHtml(value||'すべて')}</span><small>${count}</small></button>`).join('')}
    </div></section>`;
  const preview=selected?journalIndexPreviewV425(selected,ordered.indexOf(selected)+1):'<p class="j425-blank">一覧で案件を選ぶと、詳細の概要をこちらに表示します。</p>';
  const record=(t,i)=>{const p=checklistProgress(t);return `<article class="j425-index-record ${t.id===filters.selected?'is-selected':''}" role="button" tabindex="0" data-j425-row="${escapeHtml(t.id)}">
    <label class="j425-index-checkbox"><input type="checkbox" data-bulk-id="${escapeHtml(t.id)}" aria-label="${escapeHtml(t.title)}を選択"></label>
    <span class="j425-index-record-number">${String(i+1).padStart(2,'0')}</span>
    <div class="j425-index-record-main"><div class="j425-index-record-top"><span>${escapeHtml(t.category||'未分類')}</span><span class="j425-index-record-status">${escapeHtml(t.status)}</span></div>
      <strong>${escapeHtml(t.title)}</strong>${String(t.description||'').trim()?`<p>${escapeHtml(String(t.description).trim().slice(0,115))}</p>`:''}</div>
    <div class="j425-index-record-meta"><small>担当 ${escapeHtml(t.assignee||'未割当')}</small><small>優先 ${escapeHtml(t.priority)}</small><small class="${overdue(t)?'is-overdue':''}">${escapeHtml(t.dueDate||'期限なし')}</small>${p.total?`<div class="j425-index-bar"><span style="width:${p.percent}%"></span></div><small>${p.done}/${p.total} 確認</small>`:''}</div>
    ${favoriteButton(t,'j425-list-star')}
    </article>`};
  // JOURNAL V518: keep a contextual, accessible recovery action next to
  // empty results; do not create another data/filter owner.
  const emptiedReaderV546=Boolean(syncAnchorV530?.inlineReader&&!ordered.length);
  const emptyResultsV518=`<div class="j425-blank j518-index-empty" role="status">
    <strong>${tasks.length?'一致する案件がありません':'登録された案件はありません'}</strong>
    <p>${emptiedReaderV546
      ?(tasks.length
        ?'閲覧中の案件が同期更新で表示対象から外れました。検索条件はそのままです。条件を解除すると他の案件を表示できます。'
        :'閲覧中の案件が同期更新で削除されました。上部の「タスクを追加」から登録できます。')
      :(tasks.length?'検索・絞り込み条件を見直してください。':'上部の「タスクを追加」から登録できます。')}</p>
    ${tasks.length?'<button type="button" data-j518-empty-reset>条件を解除して一覧を表示</button>':''}
  </div>`;
  elements.listView.innerHTML=`<div class="j425-task-index">
    <header class="j425-editorial-head"><div><span>03 / TASK INDEX</span><h2>タスク一覧</h2></div>
    <div class="j425-index-head-controls"><button type="button" class="j425-action-primary" data-j425-new-task>＋ タスクを追加</button>
      <div class="j425-mode-switch"><button type="button" data-j425-task-layout="board">机上</button><button type="button" aria-pressed="true">一覧</button><button type="button" data-j425-task-layout="timeline">日誌</button><button type="button" data-j425-task-layout="dashboard">ダッシュボード</button></div>
      ${journalReservedTaskShortcutV565()}</div></header>
    <div class="j425-editorial-layout j425-task-index-layout">
      <aside class="j425-index-rail" aria-label="案件の絞り込み"><span class="j430-index-edge-tab" aria-hidden="true"></span>
       <div class="j447-task-filter-heading"><h3>絞り込み</h3><button type="button" data-j447-toggle-filters aria-expanded="${journalIndexFiltersExpandedV447}" aria-controls="j447TaskFilterPanel">${journalIndexFiltersExpandedV447?'条件を閉じる':'条件を選ぶ'}${appliedFilters?' ('+appliedFilters+'件適用)':''}</button></div>
       <div id="j447TaskFilterPanel" class="j447-task-filter-panel ${journalIndexFiltersExpandedV447?'is-open':''}"><small>INDEX & FILTER</small>
       ${facet('status','状態',statuses,filters.status)}
       ${facet('category','分類',categories,filters.category)}
       <label class="j565-index-sort">表示順<select data-j425-sort>${[['default','現在の順番'],['updated','更新が新しい順'],['due','期限が近い順'],['priority','優先度順'],['title','タイトル順']].map(([k,v])=>`<option value="${k}" ${filters.sort===k?'selected':''}>${v}</option>`).join('')}</select></label>
       ${facet('assignee','担当',assignees,filters.assignee)}
       <h4>期限</h4>${[{id:'all',label:'すべて'},{id:'week',label:'今週まで'},{id:'overdue',label:'期限超過'},{id:'none',label:'期限なし'}].map(v=>`<button type="button" class="j425-index-option" data-j425-due="${v.id}" aria-pressed="${filters.due===v.id}">${v.label}<span>${v.id==='all'?tasks.length:tasks.filter(t=>v.id==='week'?soon(t):v.id==='overdue'?overdue(t):!t.dueDate).length}</span></button>`).join('')}
       <h4>作業のしおり</h4><button type="button" class="j425-index-option" data-j425-preset="mine">自分の担当</button><button type="button" class="j425-index-option" data-j425-preset="priority">高優先度から</button>
       <button type="button" class="j425-clear-filters" data-j425-reset>絞り込みを解除</button></div>
      </aside>
      <main class="j425-index-workpaper" aria-label="案件の記録一覧">
       <div class="j425-workbench-toolbar"><label>検索<input type="search" data-j425-query value="${escapeHtml(filters.query)}" placeholder="タイトル・内容・分類で検索"></label>

       <span class="j425-index-counter">${ordered.length} 件</span></div>
       <div class="bulk-bar j425-index-bulk" data-bulk-bar hidden><strong><span data-bulk-count>0</span>件選択中</strong><select data-bulk-action><option value="">操作を選択</option><option value="status">状態を変更</option><option value="assignee">担当者を変更</option><option value="category">分類を変更</option><option value="complete">完了にする</option><option value="delete">削除</option></select><select data-bulk-target hidden></select><button type="button" data-bulk-apply>適用</button></div>
       <div class="j425-index-results-head"><label><input type="checkbox" data-bulk-all> すべて選択</label><span>表示 ${ordered.length}件 ／ 全体 ${tasks.length}件</span></div>
       <div class="j425-index-records">${ordered.map(record).join('')||emptyResultsV518}</div>
       <div class="j425-stationery-row j425-list-props" aria-hidden="true"><img class="j430-list-plant" src="./assets/journal-plant-v425.svg" alt=""><span class="j430-list-paper-tag">TASK JOURNAL</span><img class="j430-list-pen" src="./assets/journal-pen-v425.svg" alt=""></div>
      </main>
      <aside class="j425-reading-rail j425-task-preview" aria-label="選択中の案件の概要"><div class="j425-notebook-holes" aria-hidden="true"></div>${preview}</aside>
    </div></div>`;
  const root=elements.listView;
  journalPositionSelectedReaderV491('task');
  root.querySelector('[data-j447-toggle-filters]')?.addEventListener('click',event=>{
    journalIndexFiltersExpandedV447=!journalIndexFiltersExpandedV447;
    const toggle=event.currentTarget;
    toggle.setAttribute('aria-expanded',String(journalIndexFiltersExpandedV447));
    toggle.textContent=(journalIndexFiltersExpandedV447?'条件を閉じる':'条件を選ぶ')
      +(appliedFilters?' ('+appliedFilters+'件適用)':'');
    root.querySelector('#j447TaskFilterPanel')?.classList.toggle('is-open',journalIndexFiltersExpandedV447);
  });
  const bindPreview=()=>{
    // V540: reuse the selected row's existing click path so the filtered
    // order, inline reader placement and return anchor have a single owner.
    root.querySelectorAll('[data-j540-case-step]').forEach(button=>{
      const step=Number(button.dataset.j540CaseStep);
      const index=ordered.findIndex(task=>task.id===filters.selected);
      const adjacent=ordered[index+step];
      button.disabled=!(index>=0&&adjacent);
      button.addEventListener('click',()=>{
        if(!adjacent||filters.selected===adjacent.id)return;
        const row=[...root.querySelectorAll('[data-j425-row]')]
          .find(el=>el.dataset.j425Row===adjacent.id);
        if(!row)return;
        const beforeTop=button.getBoundingClientRect().top;
        const width=window.innerWidth;
        row.click();
        requestAnimationFrame(()=>{
          if(!journalTaskV411()||elements.listView.hidden
            ||journalIndexStateV425.selected!==adjacent.id)return;
          // Keep the same button under the finger for consecutive reading.
          // At the end of the list, focus the available reverse direction.
          const forward=root.querySelector('[data-j540-case-step="'+step+'"]');
          const reverse=root.querySelector('[data-j540-case-step="'+(-step)+'"]');
          const target=forward&&!forward.disabled?forward:
            reverse&&!reverse.disabled?reverse:root.querySelector('.j425-index-preview h3');
          if(!target)return;
          if(!target.matches('button,select,input,a,[tabindex]'))target.tabIndex=-1;
          target.focus({preventScroll:true});
          if(width===window.innerWidth&&Number.isFinite(beforeTop)
            &&beforeTop>=0&&beforeTop<=window.innerHeight
            &&document.scrollingElement){
            document.scrollingElement.scrollTop+=target.getBoundingClientRect().top-beforeTop;
          }
          const rect=target.getBoundingClientRect();
          if(rect.top<0||rect.bottom>window.innerHeight)
            target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
        });
      });
    });
    // Header and footer return controls use the same list-row restoration.
    root.querySelectorAll('[data-j491-task-return]').forEach(button=>button.addEventListener('click',()=>{
      const id=filters.selected;
      const anchor=journalIndexReturnAnchorV513;
      journalIndexReturnAnchorV513=null;
      journalTaskInlineSelectedV491='';
      journalPositionSelectedReaderV491('task');
      requestAnimationFrame(()=>{
        if(!journalTaskV411()||elements.listView.hidden)return;
        const row=[...root.querySelectorAll('[data-j425-row]')].find(node=>node.dataset.j425Row===id);
        const target=row||root.querySelector('[data-j425-query]')||root.querySelector('[data-j425-new-task]');
        if(!target)return;
        target.focus({preventScroll:true});
        if(row&&anchor?.id===id&&anchor.width===window.innerWidth
          &&anchor.top>=0&&anchor.top<=window.innerHeight&&document.scrollingElement){
          // Closing the inline note changes document height; use the clicked
          // row's former viewport position instead of centering every time.
          document.scrollingElement.scrollTop+=row.getBoundingClientRect().top-anchor.top;
        }else target.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
      });
    }));
    root.querySelector('[data-j425-preview-detail]')?.addEventListener('click',event=>{
      journalOpenTaskNoteV519(filters.selected,'list','detail',event.currentTarget);
    });
    root.querySelector('[data-j425-preview-edit]')?.addEventListener('click',event=>{
      journalOpenTaskNoteV519(filters.selected,'list','edit',event.currentTarget,true);
    });
  };
  bindPreview();
  bindFavoriteButtons(root);
  root.querySelectorAll('[data-j425-row]').forEach(row=>{
    const select=()=>{filters.selected=row.dataset.j425Row;
      journalRememberTaskNavigationV534('list',filters.selected);
      journalIndexReturnAnchorV513=journalInlineDetailMediaV491.matches
        ?{id:filters.selected,top:row.getBoundingClientRect().top,width:window.innerWidth}:null;
      journalTaskInlineSelectedV491=filters.selected;root.querySelectorAll('[data-j425-row]').forEach(el=>el.classList.toggle('is-selected',el.dataset.j425Row===filters.selected));
      const candidate=ordered.find(t=>t.id===filters.selected);if(!candidate)return;
      // Only the preview is rebuilt; checked bulk selections stay intact.
      const card=root.querySelector('.j425-task-preview');
      if(card){
        card.innerHTML='<div class="j425-notebook-holes" aria-hidden="true"></div>'+journalIndexPreviewV425(candidate,ordered.indexOf(candidate)+1);
        bindPreview();
        journalPositionSelectedReaderV491('task');
        if(journalInlineDetailMediaV491.matches)requestAnimationFrame(()=>{
          const note=elements.listView.querySelector('.j425-task-preview.j491-inline-detail');
          const heading=note?.querySelector('.j425-index-preview h3');
          if(heading){
            heading.tabIndex=-1;heading.focus({preventScroll:true});
            heading.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
          }
        });
      }
    };
    journalBindReadAndEditPointer(row,select,()=>journalOpenTaskNoteV519(row.dataset.j425Row,'list','row',row,true));
    row.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('input,button,label,select')){e.preventDefault();select()}});
  });
  root.querySelectorAll('[data-j430-facet]').forEach(button=>button.addEventListener('click',()=>{
    const key=button.dataset.j430Facet,value=button.dataset.j430Value;
    filters[key]=value;
    journalRefreshIndexV515(tasks,button,()=>[...root.querySelectorAll('[data-j430-facet]')]
      .find(node=>node.dataset.j430Facet===key&&node.dataset.j430Value===value));
  }));
  root.querySelectorAll('[data-j425-due]').forEach(b=>b.addEventListener('click',()=>{
    const due=b.dataset.j425Due;filters.due=due;
    journalRefreshIndexV515(tasks,b,()=>[...root.querySelectorAll('[data-j425-due]')]
      .find(node=>node.dataset.j425Due===due));
  }));
  root.querySelector('[data-j425-sort]')?.addEventListener('change',e=>{
    filters.sort=e.target.value;
    journalRefreshIndexV515(tasks,e.target,()=>root.querySelector('[data-j425-sort]'));
  });
  root.querySelectorAll('[data-j425-task-layout]').forEach(b=>b.addEventListener('click',()=>journalSwitchTaskPageV509(b.dataset.j425TaskLayout)));
  journalBindReservedTaskShortcutV565(root);
  root.querySelector('[data-j425-new-task]')?.addEventListener('click',()=>openTaskDialog());
  root.querySelectorAll('[data-j425-preset]').forEach(b=>b.addEventListener('click',()=>{
    const preset=b.dataset.j425Preset;
    if(preset==='mine'){filters.assignee=getCurrentUser();filters.sort='default';}else{filters.sort='priority';}
    journalRefreshIndexV515(tasks,b,()=>[...root.querySelectorAll('[data-j425-preset]')]
      .find(node=>node.dataset.j425Preset===preset));
  }));
  const resetIndexFiltersV518=()=>Object.assign(filters,{
    status:'',category:'',assignee:'',due:'all',query:'',sort:'default'
  });
  root.querySelector('[data-j425-reset]')?.addEventListener('click',event=>{
    resetIndexFiltersV518();
    journalRefreshIndexV515(tasks,event.currentTarget,()=>root.querySelector('[data-j425-reset]'));
  });
  root.querySelector('[data-j518-empty-reset]')?.addEventListener('click',event=>{
    resetIndexFiltersV518();
    // The empty-state action disappears after the list redraw. Return to the
    // persistent search field so another query can begin immediately.
    journalRefreshIndexV515(tasks,event.currentTarget,()=>root.querySelector('[data-j425-query]'));
  });
  root.querySelector('[data-bulk-all]')?.addEventListener('change',e=>{root.querySelectorAll('[data-bulk-id]').forEach(input=>input.checked=e.target.checked);updateBulkBar()});
  root.querySelectorAll('[data-bulk-id]').forEach(x=>x.addEventListener('change',updateBulkBar));
  root.querySelector('[data-bulk-action]')?.addEventListener('change',updateBulkTarget);
  root.querySelector('[data-bulk-apply]')?.addEventListener('click',applyBulkAction);
  const input=root.querySelector('[data-j425-query]');
  if(input){let composing=false;const apply=()=>{
    filters.query=input.value;
    const cursor=input.selectionStart??input.value.length;
    journalRefreshIndexV515(tasks,input,()=>root.querySelector('[data-j425-query]'),el=>{
      try{el.setSelectionRange(cursor,cursor)}catch{}
    });
  };
    input.addEventListener('compositionstart',()=>{composing=true;journalSearchComposingV530=input});
    input.addEventListener('compositionend',()=>{
      composing=false;apply();journalFinishSearchCompositionV530(input);
    });
    input.addEventListener('blur',()=>journalFinishSearchCompositionV530(input));
    input.addEventListener('input',e=>{if(!composing&&!e.isComposing)apply()});
  }
  journalRestoreTaskPageSyncAnchorV530(syncAnchorV530);
}

// JOURNAL V504: paging rerenders the toolbar. Re-focus its replacement and
// show the beginning of the selected period rather than losing keyboard context.
function journalNavigateChronicleV504(selector,changePeriod){
  changePeriod();
  requestAnimationFrame(()=>{
    if(!journalTaskV411()||elements.timelineView.hidden)return;
    elements.timelineView.querySelector('.jv-section-head')
      ?.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
    elements.timelineView.querySelector(selector)?.focus({preventScroll:true});
  });
}

// The date-change dialog still uses the canonical task transaction. Only its
// source position, post-save navigation and cancel focus belong to JOURNAL.
function journalOpenTimelineMoveV507(id){
  journalRememberTaskNavigationV534('timeline',id);
  const row=[...elements.timelineView.querySelectorAll('.jv-day-item')]
    .find(item=>item.dataset.taskId===id);
  journalTimelineMoveSourceV507=row?{
    id,fromDate:row.closest('[data-jv-date]')?.dataset.jvDate||'',
    fromStart:toISODate(getTimelineStartDate()),fromRange:state.timelineRange
  }:null;
  journalTimelineMoveCommittedV507=false;
  openTimelineMoveDialog(id);
}
elements.timelineMoveDialog?.addEventListener('close',()=>{
  const source=journalTimelineMoveSourceV507;
  const committed=journalTimelineMoveCommittedV507;
  journalTimelineMoveSourceV507=null;
  journalTimelineMoveCommittedV507=false;
  if(!source||committed||!journalTaskV411()||elements.timelineView.hidden)return;
  requestAnimationFrame(()=>{
    if(!journalTaskV411()||elements.timelineView.hidden)return;
    const row=[...elements.timelineView.querySelectorAll('.jv-day-item')]
      .find(item=>item.dataset.taskId===source.id);
    const target=row?.querySelector('[data-move-to-timeline]');
    target?.focus({preventScroll:true});
    target?.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
  });
});
function journalReturnTimelinePeriodV507(source){
  if(!source||!journalTaskV411()||state.layout!=='tasks'||state.taskLayout!=='timeline')return;
  state.timelineRange=source.fromRange;
  state.timelineStart=source.fromStart;
  localStorage.setItem(timelineRangeKey(),state.timelineRange);
  localStorage.setItem(timelineStartKey(),state.timelineStart);
  render();
  requestAnimationFrame(()=>{
    if(!journalTaskV411()||elements.timelineView.hidden)return;
    const records=[...elements.timelineView.querySelectorAll('[data-jv-date]')]
      .find(day=>day.dataset.jvDate===source.fromDate);
    const target=records?.closest('.jv-chronicle-day')?.querySelector('.jv-date')
      ||(source.fromDate?'':elements.timelineView.querySelector('[data-jv-undated] h4'))
      ||elements.timelineView.querySelector('[data-j505-date-jump]');
    if(!target)return;
    if(!target.matches('button,select,input,a,[tabindex]'))target.tabIndex=-1;
    target.focus({preventScroll:true});
    target.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
  });
}
function journalRevealTimelineMoveV507(source,id,dueDate,dueChanged){
  if(!source||!journalTaskV411()||state.layout!=='tasks'||state.taskLayout!=='timeline')return;
  const start=getTimelineStartDate();
  const first=toISODate(start);
  const last=toISODate(addDays(start,getTimelineDays(start)-1));
  // A moved task outside the current period needs the real destination,
  // not a stale source date or a silently missing row.
  if(dueDate<first||dueDate>last)setTimelineStart(dueDate);
  requestAnimationFrame(()=>{
    if(!journalTaskV411()||elements.timelineView.hidden)return;
    const root=elements.timelineView;
    const row=[...root.querySelectorAll('.jv-day-item')].find(item=>item.dataset.taskId===id);
    const records=[...root.querySelectorAll('[data-jv-date]')].find(day=>day.dataset.jvDate===dueDate);
    const dateHeading=records?.closest('.jv-chronicle-day')?.querySelector('.jv-date');
    if(dueChanged){
      const notice=document.createElement('div');
      notice.className='j507-move-result';
      notice.setAttribute('role','status');
      const label=document.createElement('span');
      label.textContent=row?'期限を'+dueDate+'へ変更しました。':
        '期限を'+dueDate+'へ変更しました。現在の表示条件では対象タスクを表示できません。';
      const back=document.createElement('button');
      back.type='button';
      back.textContent='元の日誌へ戻る';
      back.addEventListener('click',()=>journalReturnTimelinePeriodV507(source));
      const dismiss=document.createElement('button');
      dismiss.type='button';
      dismiss.className='j507-move-dismiss';
      dismiss.textContent='閉じる';
      dismiss.addEventListener('click',()=>notice.remove());
      notice.append(label,back,dismiss);
      if(row)row.after(notice);
      else if(records)records.prepend(notice);
      else root.querySelector('.jv-time-controls')?.after(notice);
    }
    const target=row?.querySelector('[data-j494-open-task]')
      ||dateHeading||root.querySelector('[data-timeline-range]');
    if(target){
      if(!target.matches('button,select,input,a,[tabindex]'))target.tabIndex=-1;
      target.focus({preventScroll:true});
      target.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'});
    }
  });
}

// JOURNAL V522: remember the date action when opening the canonical task
// dialog. Save and cancel both return to the same day without another writer.
let journalChronicleCreateAnchorV522=null;
function journalOpenChronicleCreateV522(source,date,status){
  if(!journalTaskV411())return openTaskDialogFromTimeline(date,status);
  const day=source?.closest('.jv-chronicle-day');
  journalChronicleCreateAnchorV522={
    date,top:day?.getBoundingClientRect().top??null,
    width:window.innerWidth,selectedBefore:state.selectedId
  };
  openTaskDialogFromTimeline(date,status);
}
function journalRestoreChronicleCreateV522(){
  const anchor=journalChronicleCreateAnchorV522;
  journalChronicleCreateAnchorV522=null;
  if(!anchor||!journalTaskV411())return;
  requestAnimationFrame(()=>{
    if(!journalTaskV411()||state.layout!=='tasks'||state.taskLayout!=='timeline'
      ||elements.timelineView.hidden)return;
    const root=elements.timelineView;
    const day=[...root.querySelectorAll('.jv-chronicle-day')]
      .find(el=>el.querySelector('[data-jv-date]')?.dataset.jvDate===anchor.date);
    const saved=state.selectedId!==anchor.selectedBefore
      &&state.tasks.some(task=>task.id===state.selectedId&&task.dueDate===anchor.date);
    const row=saved?[...root.querySelectorAll('.jv-day-item')]
      .find(el=>el.dataset.taskId===state.selectedId):null;
    // Empty days switch to the populated-day '+' button after saving.
    const target=row||day?.querySelector('[data-jv-add-date]')
      ||day?.querySelector('.jv-date')
      ||root.querySelector('[data-j505-date-jump]');
    if(!target)return;
    if(!target.matches('button,select,input,a,[tabindex]'))target.tabIndex=-1;
    const scrolling=document.scrollingElement;
    if(day&&scrolling&&anchor.width===window.innerWidth
      &&Number.isFinite(anchor.top)&&anchor.top>=0&&anchor.top<=window.innerHeight){
      scrolling.scrollTop+=day.getBoundingClientRect().top-anchor.top;
    }else target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    target.focus({preventScroll:true});
    // A new row may sit below several existing entries on a busy day.
    const bounds=target.getBoundingClientRect();
    if(bounds.top<0||bounds.bottom>window.innerHeight){
      target.scrollIntoView({behavior:'auto',block:'nearest',inline:'nearest'});
    }
  });
}
// One close listener serves native Escape, Cancel and successful save.
// Canonical form, persistence and other displays are unchanged.
elements.taskDialog?.addEventListener('close',journalRestoreChronicleCreateV522);

// JOURNAL V523: transient date-index choice survives task-list rerenders, but
// never enters canonical tasks, Firebase or persistent settings.
let journalChronicleSelectedDateV523='';
// JOURNAL V528: preserve the visible day and keyboard control across remote
// snapshots. Unlike explicit page navigation this re-render has no new target.
let journalChronicleSyncRestoreTokenV528=0;
function journalCaptureChronicleSyncAnchorV528(root){
  if(!journalSubscribedRenderV528||!journalTaskV411()||root.hidden
    ||!root.querySelector('.jv-chronicle-day'))return null;
  // Modal and detail actions have their own V522/V519 return owners.
  if(elements.taskDialog?.open||elements.timelineMoveDialog?.open
    ||elements.detailPanel?.classList.contains('open'))return null;
  const active=root.contains(document.activeElement)?document.activeElement:null;
  const attrs=['data-j505-date-jump','data-j511-date-picker',
    'data-timeline-range','data-timeline-prev','data-timeline-today',
    'data-timeline-next','data-jv-add-date','data-j494-open-task',
    'data-move-to-timeline','data-task-id'];
  const focusAttr=attrs.find(attr=>active?.hasAttribute(attr))||'';
  const sticky=root.querySelector('.j511-chronicle-travel')?.getBoundingClientRect();
  const visibleTop=sticky&&sticky.bottom>0&&sticky.top<window.innerHeight
    ?Math.max(0,sticky.bottom):0;
  const day=[...root.querySelectorAll('.jv-chronicle-day')].find(element=>{
    const rect=element.getBoundingClientRect();
    return rect.bottom>visibleTop+12&&rect.top<window.innerHeight-12;
  });
  return {
    date:day?.querySelector('[data-jv-date]')?.dataset.jvDate||'',
    top:day?.getBoundingClientRect().top??null,
    width:window.innerWidth,
    period:toISODate(getTimelineStartDate()),range:state.timelineRange,
    focusAttr,focusValue:focusAttr?active.getAttribute(focusAttr):'',
    focusDate:active?.classList.contains('jv-date')
      ?active.closest('.jv-chronicle-day')?.querySelector('[data-jv-date]')?.dataset.jvDate||'':''
  };
}
function journalRestoreChronicleSyncAnchorV528(anchor,root){
  const token=++journalChronicleSyncRestoreTokenV528;
  if(!anchor)return;
  requestAnimationFrame(()=>{
    if(token!==journalChronicleSyncRestoreTokenV528||!journalTaskV411()
      ||state.layout!=='tasks'||state.taskLayout!=='timeline'||root.hidden
      ||anchor.period!==toISODate(getTimelineStartDate())
      ||anchor.range!==state.timelineRange)return;
    // Do not steal the user's focus if another control has been activated.
    const current=document.activeElement;
    if(current&&current!==document.body&&current!==document.documentElement
      &&current.isConnected)return;
    const day=anchor.date?[...root.querySelectorAll('.jv-chronicle-day')]
      .find(element=>element.querySelector('[data-jv-date]')?.dataset.jvDate===anchor.date):null;
    const scrolling=document.scrollingElement;
    if(day&&scrolling&&anchor.width===window.innerWidth
      &&Number.isFinite(anchor.top)){
      scrolling.scrollTop+=day.getBoundingClientRect().top-anchor.top;
    }else if(day&&anchor.width!==window.innerWidth){
      day.querySelector('.jv-date')?.scrollIntoView({
        behavior:'auto',block:'nearest',inline:'nearest'
      });
    }
    let focus=null;
    if(anchor.focusAttr){
      focus=[...root.querySelectorAll('['+anchor.focusAttr+']')]
        .find(el=>el.getAttribute(anchor.focusAttr)===anchor.focusValue);
    }else if(anchor.focusDate){
      focus=[...root.querySelectorAll('.jv-chronicle-day')]
        .find(el=>el.querySelector('[data-jv-date]')?.dataset.jvDate===anchor.focusDate)
        ?.querySelector('.jv-date');
    }
    if(!focus&&(anchor.focusAttr||anchor.focusDate))
      focus=day?.querySelector('.jv-date')||root.querySelector('[data-j505-date-jump]');
    // V532: when a task is removed or its due date changes, its old
    // action no longer exists. Stay in the original day instead of
    // focusing an unrelated action on another day.
    if(focus&&anchor.focusAttr&&['data-task-id','data-j494-open-task','data-move-to-timeline'].includes(anchor.focusAttr)
      &&anchor.date){
      const owner=focus.closest('.jv-chronicle-day');
      const ownerDate=owner?.querySelector('[data-jv-date]')?.dataset.jvDate;
      if(ownerDate&&ownerDate!==anchor.date)
        focus=day?.querySelector('.jv-date')||focus;
    }
    if(focus){
      if(!focus.matches('button,select,input,a,[tabindex]'))focus.tabIndex=-1;
      focus.focus({preventScroll:true});
    }
  });
}
function journalChronicleV411(tasks){
const syncAnchorV528=journalCaptureChronicleSyncAnchorV528(elements.timelineView);
const start=getTimelineStartDate(),dates=Array.from({length:getTimelineDays(start)},(_,i)=>addDays(start,i));
if(journalChronicleSelectedDateV523&&!dates.some(d=>toISODate(d)===journalChronicleSelectedDateV523))
  journalChronicleSelectedDateV523='';
const selectedDayV523=journalChronicleSelectedDateV523
  ?journalChronicleSelectedDateV523.slice(5).replace('-','/') :'';
const dateRows=dates.map(d=>{const date=toISODate(d),items=tasks.filter(t=>t.dueDate===date);return `<section class="jv-chronicle-day ${isTodayDate(d)?'is-today':''} ${items.length?'':'is-empty'}"><div class="jv-date"><strong>${d.getDate()}</strong><span>${['日','月','火','水','木','金','土'][d.getDay()]}曜</span><small>${d.getMonth()+1}月</small>${items.length?`<button type="button" class="j504-day-add" data-jv-add-date="${date}" aria-label="${date}にタスクを追加" title="この日にタスクを追加"><span aria-hidden="true">＋</span><span aria-hidden="true">追加</span></button>`:""}</div><div class="jv-day-records" data-jv-date="${date}">${items.map(journalDayItemV411).join('')||`<button type="button" class="j434-chronicle-add" data-jv-add-date="${date}">＋ この日にタスクを書く</button>`}</div></section>`}).join('');
const undated=tasks.filter(t=>!t.dueDate);
const dayJumpOptions=dates.map(d=>{
  const date=toISODate(d);
  const count=tasks.filter(t=>t.dueDate===date).length;
  const weekday=['日','月','火','水','木','金','土'][d.getDay()];
  return `<option value="${date}" ${date===journalChronicleSelectedDateV523?'selected':''}>${d.getMonth()+1}/${d.getDate()}（${weekday}） ${count}件</option>`;
}).join('');
elements.timelineView.innerHTML=`<header class="jv-section-head"><span>DAILY CHRONICLE</span><h3>日付日誌 <small>${tasks.length}件</small></h3></header><div class="jv-time-controls"><span>${formatMonthDay(dates[0])} - ${formatMonthDay(dates[dates.length-1])}</span><select aria-label="表示範囲" data-timeline-range><option value="14" ${state.timelineRange==='14'?'selected':''}>14日</option><option value="month" ${state.timelineRange==='month'?'selected':''}>1か月</option></select><label class="j505-date-jump"><span>日付へ移動</span><select data-j505-date-jump aria-label="移動先の日付" id="j523ChronicleDateSelect"><option value="">日付を選ぶ</option>${dayJumpOptions}</select></label><button type="button" data-timeline-prev>← 前</button><button type="button" data-timeline-today>今日</button><button type="button" data-timeline-next>次 →</button></div><nav class="j511-chronicle-travel" aria-label="日誌内の画面切替"><div class="j509-chronicle-switch" role="group" aria-label="タスク表示形式"><button type="button" data-j509-layout="board">机上</button><button type="button" data-j509-layout="list">一覧</button><button type="button" aria-pressed="true">日誌</button><button type="button" data-j509-layout="dashboard">ダッシュボード</button></div>${journalReservedTaskShortcutV565()}<button type="button" class="j511-date-picker" data-j511-date-picker aria-controls="j523ChronicleDateSelect">日付を選ぶ<small class="j523-selected-date">${selectedDayV523}</small></button></nav>${dateRows}<section class="jv-undated" data-jv-undated="true"><h4>期限のない記録 <small>${undated.length}件</small></h4><div>${undated.map(journalDayItemV411).join('')||'<p>期限なしの記録はありません。</p>'}</div></section>`;
bindTaskDragSources(elements.timelineView);
elements.timelineView.querySelectorAll('.jv-day-item').forEach(row=>{journalBindReadAndEditPointer(row,()=>journalOpenTimelineDetailV494(row.dataset.taskId),()=>journalOpenTimelineEditorV505(row.dataset.taskId));row.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button,input,select')){e.preventDefault();journalOpenTimelineDetailV494(row.dataset.taskId)}})});
elements.timelineView.querySelectorAll('[data-j494-open-task]').forEach(b=>b.addEventListener('click',e=>{
  e.stopPropagation();journalOpenTimelineDetailV494(b.dataset.j494OpenTask);
}));
elements.timelineView.querySelectorAll('[data-move-to-timeline]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();journalOpenTimelineMoveV507(b.dataset.moveToTimeline)}));
elements.timelineView.querySelectorAll('[data-jv-date]').forEach(row=>row.addEventListener('dblclick',e=>{if(!e.target.closest('[data-task-id],[data-jv-add-date]'))journalOpenChronicleCreateV522(row,row.dataset.jvDate,getDefaultOpenStatus())}));
// Touch and keyboard entry points share the canonical task dialog and date seed.
elements.timelineView.querySelectorAll('[data-jv-add-date]').forEach(b=>b.addEventListener('click',()=>journalOpenChronicleCreateV522(b,b.dataset.jvAddDate,getDefaultOpenStatus())));
const root=elements.timelineView;
root.querySelectorAll('[data-j509-layout]').forEach(button=>button.addEventListener('click',
  ()=>journalSwitchTaskPageV509(button.dataset.j509Layout)));
journalBindReservedTaskShortcutV565(root);
// The sticky paper bookmark opens the existing native picker directly where
// supported, instead of sending a phone reader back to the top of a long diary.
// Older browsers continue using the same select via a focusable jump.
root.querySelector('[data-j511-date-picker]')?.addEventListener('click',()=>{
  const selector=root.querySelector('[data-j505-date-jump]');
  if(!selector)return;
  selector.focus({preventScroll:true});
  if(typeof selector.showPicker==='function'){
    try{selector.showPicker();return;}catch{} // Unsupported or blocked picker.
  }
  selector.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
  selector.focus({preventScroll:true});
});
root.querySelector('[data-j505-date-jump]')?.addEventListener('change',event=>{
  const date=event.currentTarget.value;
  const records=[...root.querySelectorAll('.jv-day-records[data-jv-date]')]
    .find(day=>day.dataset.jvDate===date);
  const dateHeading=records?.closest('.jv-chronicle-day')?.querySelector('.jv-date');
  if(!dateHeading&&date)return;
  journalChronicleSelectedDateV523=date;
  const badge=root.querySelector('.j523-selected-date');
  if(badge)badge.textContent=date?date.slice(5).replace('-','/'):'';
  if(!dateHeading)return;
  dateHeading.tabIndex=-1;
  dateHeading.scrollIntoView({behavior:'auto',block:'start',inline:'nearest'});
  dateHeading.focus({preventScroll:true});
});
if(root.dataset.jvDropBound!=='true'){
root.dataset.jvDropBound='true';
root.addEventListener('dragover',e=>{if(!isTaskDragEvent(e))return;const zone=e.target.closest('[data-jv-date],[data-jv-undated]');if(zone){e.preventDefault();zone.classList.add('jv-dropping')}});
root.addEventListener('dragleave',e=>{const zone=e.target.closest('[data-jv-date],[data-jv-undated]');if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('jv-dropping')});
root.addEventListener('drop',async e=>{const zone=e.target.closest('[data-jv-date],[data-jv-undated]');if(!zone)return;const payload=getTaskDragPayload(e);if(!payload)return;e.preventDefault();e.stopPropagation();zone.classList.remove('jv-dropping');try{await moveTaskByDrag(payload.id,{dueDate:zone.dataset.jvDate||'',source:'timeline'})}finally{cleanupTaskDragUi()}});
}
root.querySelector('[data-timeline-prev]')?.addEventListener('click',()=>journalNavigateChronicleV504('[data-timeline-prev]',()=>shiftTimeline(-1)));
root.querySelector('[data-timeline-next]')?.addEventListener('click',()=>journalNavigateChronicleV504('[data-timeline-next]',()=>shiftTimeline(1)));
root.querySelector('[data-timeline-today]')?.addEventListener('click',()=>journalNavigateChronicleV504('[data-timeline-today]',()=>setTimelineStart(state.timelineRange==='month'?toISODate(startOfMonth(startOfToday())):todayISO())));
root.querySelector('[data-timeline-range]')?.addEventListener('change',e=>journalNavigateChronicleV504('[data-timeline-range]',()=>setTimelineRange(e.target.value)));
journalRestoreChronicleSyncAnchorV528(syncAnchorV528,root);
}

// Keep the source node alive until a mouse double-click can be distinguished
// from a read click. Touch and keyboard activation remain immediate.
function journalBindReadAndEditPointer(row,read,edit){
  let timer=0;
  const ignored=event=>event.target.closest('button,input,select,label');
  row.addEventListener('click',event=>{
    if(ignored(event))return;
    clearTimeout(timer);
    if(event.detail>1)return;
    if(event.detail===0||event.pointerType==='touch')read();
    else timer=setTimeout(()=>{if(row.isConnected)read()},240);
  });
  row.addEventListener('dblclick',event=>{
    if(ignored(event))return;
    clearTimeout(timer);event.preventDefault();edit();
  });
}
function journalDayItemV411(t){return `<article class="jv-day-item ${taskStateClasses(t)}" role="button" tabindex="0" draggable="true" data-task-drag-id="${escapeHtml(t.id)}" data-task-id="${escapeHtml(t.id)}"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.status)}</span><small>${escapeHtml(t.assignee||'未割当')}</small><div class="j494-day-actions"><button type="button" data-j494-open-task="${escapeHtml(t.id)}" aria-label="${escapeHtml(t.title)}の詳細を見る">詳細を見る</button><button type="button" data-move-to-timeline="${escapeHtml(t.id)}">日付変更</button></div></article>`}

function renderBoard(tasks) {
  if(typeof journalTaskV411 === 'function' && journalTaskV411()) return journalAtelierV420(tasks);
  const statuses = getStatusList();
  const completedView = scopeHasDone() || isCompletedStatus(elements.statusFilter.value);
  const visibleStatuses = completedView
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

  const addColumn = completedView ? "" : `<section class="board-column add-status-column">
    <button type="button" data-add-status>＋ セクション追加</button>
    <p>新しい状態を追加できます。</p>
  </section>`;

  elements.boardView.innerHTML = columns + addColumn;
  if (!tasks.length) elements.boardView.insertAdjacentHTML("afterbegin", renderTaskZeroGuideV374());
  bindTaskZeroActionsV374(elements.boardView);
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
  // Keep the visible segmented-date control in sync with the canonical date input.
  const dueDateInput = $("taskDueDate");
  dueDateInput.value = date || "";
  dueDateInput.dispatchEvent(new Event("input", { bubbles: true }));
  dueDateInput.dispatchEvent(new Event("change", { bubbles: true }));
  $("taskDueTime").value = "";
  $("taskTitle").placeholder = `${date || ""} / ${status || ""} のタスク`;
  toast("日付と状態を反映しました");
}

function renderTimeline(tasks) {
  if(typeof journalTaskV411 === 'function' && journalTaskV411()) return journalChronicleV411(tasks);
  const start = getTimelineStartDate();
  const timelineDays = getTimelineDays(start);
  const dates = Array.from({ length: timelineDays }, (_, index) => addDays(start, index));
  const completedView = scopeHasDone() || isCompletedStatus(elements.statusFilter.value);
  const statuses = completedView
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


// Zero-result guidance uses the existing filter reset; it never modifies task data.
function taskZeroContextV374() {
  const conditions = [scopeHasDone() ? "完了" : "未完了"];
  let canReset = scopeHasMine() || scopeHasDone();
  if (scopeHasMine()) conditions.unshift("自分の担当");
  const search = elements.searchInput.value.trim();
  if (search) {
    conditions.push(`検索「${search.slice(0, 50)}${search.length > 50 ? "…" : ""}」`);
    canReset = true;
  }
  for (const [name, label] of [
    ["assigneeFilter", "担当者"], ["statusFilter", "状態"],
    ["priorityFilter", "優先度"], ["categoryFilter", "分類"]
  ]) {
    const value = elements[name]?.value;
    if (value) { conditions.push(`${label}: ${value}`); canReset = true; }
  }
  for (const [name, label] of [
    ["overdueOnly", "期限超過のみ"], ["todayOnly", "今日のみ"],
    ["pinOnly", "固定のみ"], ["favoriteOnly", "スターのみ"]
  ]) {
    if (elements[name]?.checked) { conditions.push(label); canReset = true; }
  }
  return { conditions, canReset, hasTasks: state.tasks.length > 0 };
}

function renderTaskZeroGuideV374() {
  const { conditions, canReset, hasTasks } = taskZeroContextV374();
  const title = !hasTasks ? "まだタスクがありません。" : canReset
    ? "この条件に一致するタスクはありません。" : "表示できる未完了タスクがありません。";
  const detail = !hasTasks ? "新しいタスクを登録できます。" : canReset
    ? "条件をクリアすると、絞り込み前のタスクを確認できます。"
    : "完了済みのタスクは左メニューの「完了」から確認できます。";
  return `<section class="today-empty task-zero-guide-v374" data-task-zero-guide-v374 role="status">
    <strong>${title}</strong><p>${detail}</p>
    <p class="task-zero-conditions-v374">表示条件: ${conditions.map(escapeHtml).join("・")}</p>
    ${canReset ? '<button type="button" class="ghost-button" data-task-zero-clear-v374>条件をクリア</button>' : ''}
    ${!hasTasks ? '<button type="button" class="ghost-button" data-new-task-empty>＋ 新しいタスク</button>' : ''}
  </section>`;
}

function bindTaskZeroActionsV374(container) {
  container.querySelector('[data-task-zero-clear-v374]')?.addEventListener('click', () => elements.resetFilters.click());
  container.querySelector('[data-new-task-empty]')?.addEventListener('click', () => openTaskDialog());
}

function renderList(tasks) {
  if(typeof journalTaskV411 === 'function' && journalTaskV411()) return journalIndexV425(tasks);
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
      <tbody>${tasks.length ? tasks.map(t => `<tr class="priority-row priority-${escapeHtml(t.priority)} ${isTaskStarred(t.id) ? "favorite-task" : ""} ${taskStateClasses(t)}" data-task-id="${escapeHtml(t.id)}" tabindex="0" aria-label="${escapeHtml(t.title)}の詳細を開く">
        <td class="bulk-check-cell"><input type="checkbox" data-bulk-id="${escapeHtml(t.id)}" /></td>
        <td class="star-cell">${favoriteButton(t, "list-star")}</td>
        <td><strong>${escapeHtml(t.title)}</strong><br><small>${escapeHtml(t.requester || "依頼元未入力")}</small></td>
        <td>${userBadge(t.assignee)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td>${dueLabel(t)}</td>
        <td>${formatDateTime(t.updatedAt)}</td>
      </tr>`).join("") : `<tr class="task-zero-row-v374"><td colspan="9">${renderTaskZeroGuideV374()}</td></tr>`}</tbody>
    </table>`;

  bindTaskRows(elements.listView);
  bindTaskZeroActionsV374(elements.listView);
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
      setSortDragPreviewV338(event, source);
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

  const draft = cloneTask(task);
  const beforeStatus = draft.status;
  const beforeDueDate = task.dueDate || "期限なし";
  draft.status = nextStatus;
  draft.dueDate = nextDueDate;
  draft.updatedAt = Date.now();
  draft.updatedBy = getCurrentUser();

  if (isCompletedStatus(nextStatus)) {
    draft.completedAt = draft.completedAt || Date.now();
  } else {
    draft.completedAt = 0;
    draft.completedMemo = "";
  }

  const changes = [];
  if (statusChanged) changes.push(`状態: ${beforeStatus} → ${nextStatus}`);
  if (dueChanged) changes.push(`期限: ${beforeDueDate} → ${nextDueDate || "期限なし"}`);
  draft.lastChange = makeActivityChange(dueChanged ? "期限変更" : "状態変更", changes, {
    historyText: `ドラッグ操作で${changes.join("、")}しました。`
  });
  draft.history = appendHistory(draft.history, draft.lastChange.historyText);
  const result = await commitTaskDraft('task-drag', task, draft);
  if (!result.ok) return showWriteFailure(result, '状態または期限を変更できませんでした。');

  cleanupTaskDragUi();
  render();
  toast(source === "timeline" ? (statusChanged ? "状態と期限を変更しました" : "期限を変更しました") : source === "timeline-undated" ? "期限なしに変更しました" : "状態を変更しました");
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
    el.addEventListener("keydown", (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('button,input,select,textarea')) return;
      event.preventDefault();
      selectTask(el.dataset.taskId);
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
    row.addEventListener("keydown", (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('button,input,select,textarea')) return;
      event.preventDefault();
      selectTask(row.dataset.taskId);
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

async function applyBulkAction(options = null) {
  // Modern origin invokes this same canonical atomic transaction without
  // synthesizing or touching the hidden Classic list's selection controls.
  const fromOrigin = options?.source === 'origin';
  const ids = fromOrigin ? options.ids : selectedBulkIds();
  const action = fromOrigin ? String(options.action || 'complete')
    : elements.listView.querySelector("[data-bulk-action]")?.value;
  const target = fromOrigin ? String(options.target || '')
    : elements.listView.querySelector("[data-bulk-target]")?.value;
  if (fromOrigin) {
    if (!Array.isArray(ids) || ids.length > 200 || new Set(ids).size !== ids.length)
      return { ok: false, error: 'invalid-bulk-selection' };
    if (!['status', 'assignee', 'category', 'complete', 'delete'].includes(action))
      return { ok: false, error: 'unsupported-bulk-action' };
    const values = action === 'status' ? getStatusList()
      : action === 'assignee' ? getAssigneeOptions()
      : action === 'category' ? state.categories : [];
    if (values.length && !values.includes(target))
      return { ok: false, error: 'invalid-bulk-target' };
  }
  if (!ids.length) {
    if (fromOrigin) return { ok: false, error: 'empty-selection' };
    return toast("タスクを選択してください", true);
  }
  if (!action) return toast("操作を選択してください", true);
  const selected = ids.map(id => state.tasks.find(task => task.id === id)).filter(Boolean);
  if (selected.length !== ids.length) {
    if (fromOrigin) return { ok: false, error: 'not-found' };
    return toast("対象が変わりました。再読込して選び直してください", true);
  }
  if (fromOrigin && selected.some(task =>
    normalizeRevision(task.revision) !== options.expectedRevisions[task.id]))
    return { ok: false, error: 'revision-or-relation-mismatch' };
  if (action === "delete" && selected.some(task => isRecurringDeleteCandidate("task", task))) {
    if (selected.length === 1) {
      // The bulk bar must not bypass the calendar-style scope selector.
      return requestDeleteWithSeries("task", selected[0].id, {
        base: captureDeleteBase(selected[0].id)
      });
    }
    if (fromOrigin) return { ok: false, error: 'recurring-series-requires-individual-delete' };
    return toast("繰り返しタスクを含む複数選択は一括削除できません。繰り返しの削除範囲を個別画面で指定してください。", true);
  }
  // Continue using the current canonical conflict check and one transaction.
  const deleteBases = action === 'delete'
    ? new Map(ids.map(id => [id, captureDeleteBase(id)])) : null;
  if (deleteBases && [...deleteBases.values()].some(base => !base))
    return fromOrigin ? { ok: false, error: 'revision-or-relation-mismatch' }
      : toast("削除対象が変わりました。再読込して選び直してください", true);
  if (action === 'delete' && !confirm(ids.length + "件のタスクを削除しますか？"))
    return fromOrigin ? { ok: false, error: 'cancelled' } : undefined;
  const affectedBulkPaths = snapshot => [
    ...ids.map(id => `rooms/${ROOM_ID}/tasks/${id}`),
    ...(deleteBases
      ? [...deleteBases.values()].flatMap(base=>base.schedules.map(item=>`rooms/${ROOM_ID}/schedules/${item.id}`))
      : Object.keys(snapshot.schedules||{}).map(id=>`rooms/${ROOM_ID}/schedules/${id}`)),
    ...(deleteBases
      ? [...deleteBases.values()].flatMap(base=>base.knowledge.map(item=>`rooms/${ROOM_ID}/knowledge/${item.id}`))
      : Object.keys(snapshot.knowledge||{}).map(id=>`rooms/${ROOM_ID}/knowledge/${id}`))
  ];
  const result = await executeWrite('bulk', [...ids].sort().join(','), async () => {
    const apply = root => {
      let next = { ...(root?.tasks || {}) };
      let schedules = { ...(root?.schedules || {}) };
      let knowledge = { ...(root?.knowledge || {}) };
      for (const original of selected) {
        const current = next[original.id];
        if (!current || normalizeRevision(current.revision) !== normalizeRevision(original.revision)) throw new Error('conflict');
        if (action === 'delete') {
          // Reuse canonical task-delete V134 for each selected task. The whole
          // sequence runs within ONE room transaction; no partial deletion.
          const plan=planDeleteMutation(deleteBases.get(original.id), {
            ...(root||{}),tasks:next,schedules,knowledge
          });
          if(plan.action!=='commit')throw new Error('conflict');
          next=plan.nextRoot.tasks;
          schedules=plan.nextRoot.schedules;
          knowledge=plan.nextRoot.knowledge;
          continue;
        }
        const task = normalizeTask({ ...current, id: original.id });
        const before = cloneTask(task);
        if (action === 'status') task.status = normalizeStatus(target);
        if (action === 'assignee') task.assignee = normalizeUser(target);
        if (action === 'category') task.category = normalizeCategory(target);
        if (action === 'complete') task.status = COMPLETED_STATUS;
        if (isCompletedStatus(task.status)) task.completedAt = task.completedAt || Date.now();
        else { task.completedAt = 0; task.completedMemo = ''; }
        task.updatedAt = Date.now(); task.updatedBy = getCurrentUser();
        task.lastChange = makeTaskChangeInfo(before, task);
        task.history = appendHistory(task.history, `一括操作で${bulkActionLabel(action)}しました。`);
        const applied = applyTaskDraft(next, original, task);
        Object.assign(next, applied.records);
      }
      return { ...(root || {}), tasks: next, schedules, knowledge };
    };
    if (state.connectionMode === 'local-only') {
      const root = { tasks: Object.fromEntries(state.tasks.map(task => [task.id, task])), schedules: Object.fromEntries(state.schedules.map(item => [item.id, item])), knowledge: Object.fromEntries(state.knowledge.map(item => [item.id, item])) };
      const next = apply(root);
      const affectedPaths = affectedBulkPaths(next);
      applyCommittedResult({ snapshot: next, affectedPaths, mutationKind: 'bulk' });
      return { committed: true, snapshot: next, snapshotScope: 'root', affectedPaths, mutationKind: 'bulk' };
    }
    let conflict = false;
    const remote = await runTransaction(state.roomRef, current => {
      try { return apply(current || {}); } catch (error) { conflict = error.message === 'conflict'; return; }
    });
    if (!remote.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
    const snapshot = remote.snapshot?.val() || {};
    const affectedPaths = affectedBulkPaths(snapshot);
    applyCommittedResult({ snapshot, affectedPaths, mutationKind: 'bulk' });
    return { committed: true, snapshot, snapshotScope: 'root', affectedPaths, mutationKind: 'bulk' };
  });
  if(!result.ok){
    showWriteFailure(result,'一括操作は実行されませんでした。再読込して確認してください。');
    return fromOrigin ? result : undefined;
  }
  toast("一括操作を実行しました");
  render();
  if (fromOrigin) return { ok: true };
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
  return `<article class="task-card priority-card priority-${escapeHtml(task.priority)} ${isTaskStarred(task.id) ? "favorite-task" : ""} ${task.pinned ? "pinned" : ""} ${overdue ? "overdue" : ""} ${dueToday ? "due-today" : ""} ${stale ? "stale" : ""}" draggable="true" tabindex="0" role="button" aria-label="${escapeHtml(task.title)}の詳細を開く" data-task-drag-id="${escapeHtml(task.id)}" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(colorHint)}">
    ${favoriteButton(task, "card-star")}
    <p class="task-title">${task.pinned ? `<span class="pin">★</span>` : ""}<span>${escapeHtml(task.title)}</span></p>
    <div class="task-meta">${priorityBadge(task.priority)}${categoryBadge(task.category)}${overdue ? `<span class="badge priority-緊急">期限超過</span>` : ""}${dueToday ? `<span class="badge due-today-badge">今日まで</span>` : ""}${stale ? `<span class="badge stale-badge">放置気味</span>` : ""}${task.recurrence && task.recurrence !== "none" ? `<span class="badge recurrence-badge">定期</span>` : ""}</div>
    <div class="due-line"><span>${userBadge(task.assignee)}</span><span>${dueLabel(task)}</span></div>
    ${task.checklist.length ? `<div class="progress" title="${checklist.done}/${checklist.total}"><span style="width:${checklist.percent}%"></span></div>` : ""}
  </article>`;
}

function renderQuickTaskStatusControl(task) {
  const statuses = getStatusList();
  return `<div class="detail-status-control-v146">
    <div class="detail-status-label-v146">
      <strong>状態を変更</strong>
      <span>編集画面を開かずに更新</span>
    </div>
    <select class="detail-status-select-v146" data-quick-task-status data-operation-key="${escapeHtml(operationKey('task-status', task.id))}" aria-label="タスクの状態を変更">
      ${statuses.map(status => `<option value="${escapeHtml(status)}" ${status === task.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
    </select>
  </div>`;
}

async function handleQuickTaskStatusChange(task, select) {
  const previousStatus = task.status;
  const targetStatus = normalizeStatus(select.value);
  if (!targetStatus || targetStatus === previousStatus) {
    select.value = previousStatus;
    return;
  }

  if (isCompletedStatus(targetStatus)) {
    // Completion keeps the existing memo-confirmation path. Reset first so
    // cancelling the prompt leaves the visible control on the real status.
    select.value = previousStatus;
    await completeTaskWithMemo(task.id);
    return;
  }

  const result = await changeStatus(task.id, targetStatus);
  if (!result?.ok && select.isConnected) select.value = previousStatus;
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

  if (!state.detailDeleteBase || state.detailDeleteBase.id !== task.id) state.detailDeleteBase = captureDeleteBase(task.id);

  elements.appShell.classList.add("detail-open");
  elements.detailPanel.classList.add("open");
  elements.detailBody.className = "detail-body";
  const progress = checklistProgress(task);
  const relatedSchedules = getSchedulesForTask(task.id);

  elements.detailBody.innerHTML = `
    <h3 class="detail-title">${escapeHtml(task.title)}</h3>
    <div class="task-meta">${statusBadge(task.status)}${priorityBadge(task.priority)}${categoryBadge(task.category)}${task.pinned ? `<span class="badge priority-中">固定</span>` : ""}${task.recurrence && task.recurrence !== "none" ? `<span class="badge recurrence-badge">${escapeHtml(describeRecurrence(task))}</span>` : ""}</div>
    ${renderQuickTaskStatusControl(task)}
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
        <button class="ghost-button danger-text" data-action="delete" data-operation-key="${escapeHtml(operationKey('task-delete', task.id))}">削除</button>
      </div>
    </div>

    <section class="detail-section">
      <div class="detail-grid">
        <div class="field-card"><small>担当者</small>${userBadge(task.assignee)}</div>
        <div class="field-card"><small>依頼元</small><strong>${escapeHtml(task.requester || "未入力")}</strong></div>
        <div class="field-card"><small>期限</small><strong>${dueLabel(task)}</strong></div>
        <div class="field-card"><small>繰り返し</small><strong>${escapeHtml(describeRecurrence(task))}</strong></div>
        ${task.recurrence !== "none" ? `<div class="field-card"><small>繰り返し終了条件</small><strong>${escapeHtml(describeRecurrenceEnd(task))}</strong></div>` : ""}
        ${task.recurrence !== "none" && task.recurrenceRule?.occurrenceDate ? `<div class="field-card"><small>繰り返し予定日（期限とは別）</small><strong>${escapeHtml(task.recurrenceRule.occurrenceDate)}</strong></div>` : ""}
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

  const quickStatusSelect = elements.detailBody.querySelector('[data-quick-task-status]');
  quickStatusSelect?.addEventListener("change", () => handleQuickTaskStatusChange(task, quickStatusSelect));
  elements.detailBody.querySelector('[data-action="edit"]')?.addEventListener("click", () => openTaskDialog(task));
  elements.detailBody.querySelector('[data-action="favorite"]')?.addEventListener("click", () => toggleTaskFavorite(task.id));
  elements.detailBody.querySelector('[data-action="make-schedule"]')?.addEventListener("click", () => openScheduleDialogFromTask(task));
  elements.detailBody.querySelector('[data-action="duplicate"]')?.addEventListener("click", () => duplicateTask(task.id));
  elements.detailBody.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
    const result = await requestDeleteWithSeries("task", task.id, {
      base: state.detailDeleteBase
    });
    if (result?.ok) closeDetail();
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

  const draft = cloneTask(task);
  draft.status = nextStatus;
  draft.dueDate = dueDate;
  draft.updatedAt = Date.now();
  draft.updatedBy = getCurrentUser();

  if (isCompletedStatus(nextStatus)) {
    draft.completedAt = draft.completedAt || Date.now();
  } else {
    draft.completedAt = 0;
    draft.completedMemo = "";
  }

  const changes = [];
  if (statusChanged) changes.push(`状態: ${beforeStatus} → ${nextStatus}`);
  if (dueChanged) changes.push(`期限: ${beforeDueDate} → ${dueDate}`);
  draft.lastChange = makeActivityChange(dueChanged ? "期限変更" : "状態変更", changes, {
    historyText: `タイムライン移動ボタンで${changes.join("、")}しました。`
  });
  draft.history = appendHistory(draft.history, draft.lastChange.historyText);
  const result = await commitTaskDraft('timeline-move', task, draft);
  if (!result.ok) return showWriteFailure(result, 'タイムラインへ移動できませんでした。入力内容はそのままです。');

  const journalSource=journalTaskV411()&&state.layout==='tasks'&&state.taskLayout==='timeline'
    &&journalTimelineMoveSourceV507?.id===task.id?{...journalTimelineMoveSourceV507}:null;
  if(journalSource)journalTimelineMoveCommittedV507=true;
  elements.timelineMoveDialog.close();
  state.pendingTimelineMoveTaskId = "";
  render();
  if(journalSource)journalRevealTimelineMoveV507(journalSource,task.id,dueDate,dueChanged);
  toast("タイムラインへ移動しました");
}

function openTaskDialog(task = null, options = {}) {
  clearTodoPromotionContext();
  if (task || !options.preserveScheduleLink) state.pendingScheduleTaskLink = "";
  elements.taskDialogTitle.textContent = task ? "タスクを編集" : "新しいタスク";
  syncTemplateOptions();
  $("taskId").value = task?.id || "";
  elements.taskDialog.dataset.baseRevision = String(normalizeRevision(task?.revision));
  elements.taskDialog.dataset.baseSnapshot = task ? JSON.stringify({ task: cloneTask(task), deleteBase: captureDeleteBase(task.id) }) : '';
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
  if (task) elements.deleteTask.dataset.operationKey = operationKey('task-delete', task.id);
  else delete elements.deleteTask.dataset.operationKey;
  elements.taskDialog.showModal();
  $("taskTitle").focus();
}

async function saveTaskFromForm() {
  const id = $("taskId").value || generateId();
  const baseSnapshot = readTaskDialogBase(id);
  const existing = baseSnapshot?.task || state.tasks.find(t => t.id === id);
  const status = $("taskStatus").value;
  const recurrence = normalizeRecurrence($("taskRecurrence").value);
  const recurrenceRule = getRecurrenceRuleFromForm();
  const recurrenceError = taskRecurrenceValidationMessage(recurrence, recurrenceRule);
  if (recurrenceError) {
    toast(recurrenceError, true);
    $("recurrenceOptions")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const now = Date.now();
  const task = normalizeTask({
    ...existing,
    id,
    title: $("taskTitle").value.trim(),
    assignee: $("taskAssignee").value,
    status,
    priority: $("taskPriority").value,
    category: $("taskCategory").value,
    dueDate: $("taskDueDate").value,
    dueTime: $("taskDueTime").value,
    recurrence,
    recurrenceRule,
    requester: $("taskRequester").value.trim(),
    tags: splitTags($("taskTags").value),
    description: $("taskDescription").value.trim(),
    checklist: parseChecklist($("taskChecklist").value, existing?.checklist || []),
    pinned: $("taskPinned").checked,
    comments: existing?.comments || [],
    history: existing?.history || [],
    nextRecurringTaskId: existing?.nextRecurringTaskId || "",
    revision: existing?.revision || 0,
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
  const linkedSchedule = state.pendingScheduleTaskLink
    ? state.schedules.find(item => item.id === state.pendingScheduleTaskLink)
    : null;
  if (state.todoPromotionContext && state.pendingScheduleTaskLink) {
    clearTaskDialogContexts();
    return showWriteFailure({ error: 'revision-or-relation-mismatch' }, "タスク化と予定連携を同時に保存することはできません。もう一度操作してください。");
  }
  if (state.pendingScheduleTaskLink && (!linkedSchedule || linkedSchedule.relatedTaskId)) {
    return showWriteFailure({ error: 'conflict' }, "予定は既に別のタスクと関連付けられています。");
  }
  const promotion = state.todoPromotionContext;
  if (promotion && existing) {
    return showWriteFailure({ error: 'conflict' }, "タスク化中に既存タスクを上書きすることはできません。");
  }
  const saveResult = promotion
    ? await persistPromotedTaskV559(task, promotion)
    : linkedSchedule && !linkedSchedule.relatedTaskId
      ? await persistTaskWithScheduleLink(task, linkedSchedule)
      : (existing ? await commitTaskDraft('task-form', existing, task) : await persistTask(task));
  if (!saveResult.ok) {
    // Keep the original promotion intent and unsaved form. The user may
    // cancel/reopen on conflict, without accidentally creating a stray task.
    return showWriteFailure(saveResult, "タスクを保存できませんでした。入力内容はそのままです。");
  }
  state.pendingScheduleTaskLink = "";
  state.selectedId = id;
  clearTodoPromotionContext();
  elements.taskDialog.close();
  toast("保存しました");
}

function readTaskDialogBase(id) {
  try {
    const snapshot = JSON.parse(elements.taskDialog.dataset.baseSnapshot || 'null');
    return snapshot?.task?.id === id ? snapshot : null;
  } catch { return null; }
}

function cloneTask(task) {
  return normalizeTask(JSON.parse(JSON.stringify(task)));
}

// Keep a configured deadline at the same day offset from the recurrence cycle.
// The cycle remains independent, and deadline-free tasks remain deadline-free.
function nextRecurringDeadline(parent, rule, repeatDate) {
  if (!parent?.dueDate) return "";
  const due = parseISODate(parent.dueDate);
  const cycle = parseISODate(rule.occurrenceDate || rule.anchorDate);
  const next = parseISODate(repeatDate);
  if (!due || !cycle || !next) return "";
  const dayOffset = scheduleCopyDateSerial(due) - scheduleCopyDateSerial(cycle);
  return toISODate(addDays(next, dayOffset));
}

function nextRecurringChild(parent) {
  if (!parent?.recurrence || parent.recurrence === "none") return null;
  const rule = normalizeRecurrenceRule(parent.recurrence, parent.recurrenceRule,
    parent.createdAt ? toISODate(new Date(parent.createdAt)) : todayISO());
  // Completing early must not duplicate a future occurrence. Completing late
  // skips past cycle dates rather than generating a misleading overdue task.
  const afterDate = rule.occurrenceDate && rule.occurrenceDate > todayISO()
    ? rule.occurrenceDate : todayISO();
  const repeatDate = getRecurringDates(parent.recurrence, rule, afterDate, 1)[0];
  if (!repeatDate) return null;
  const id = "rec-" + (rule.seriesId || parent.id) + "-" + repeatDate;
  const dueDate = nextRecurringDeadline(parent, rule, repeatDate);
  const now = Date.now();
  return {
    id,
    repeatDate,
    task: normalizeTask({
      ...parent,
      id,
      status: getDefaultOpenStatus(),
      dueDate,
      dueTime: dueDate ? String(parent.dueTime || "") : "",
      recurrenceRule: {
        ...rule,
        seriesId: rule.seriesId || parent.id,
        occurrenceDate: repeatDate,
        generatedCount: rule.generatedCount + 1
      },
      completedAt: 0, completedMemo: "",
      knowledgeId: "", pinned: false, comments: [],
      checklist: (parent.checklist || []).map(item => ({ text: item.text, done: false })),
      history: appendHistory([], "定期タスクとして「" + parent.title + "」から作成されました（繰り返し予定日：" + repeatDate + "）。"),
      createdBy: getCurrentUser(), createdAt: now, updatedBy: getCurrentUser(), updatedAt: now,
      nextRecurringTaskId: "", recurringParentId: parent.id
    })
  };
}

function applyTaskDraft(records, original, draft) {
  const current = records?.[original.id];
  if (!current || normalizeRevision(current.revision) !== normalizeRevision(original.revision)) throw new Error('conflict');
  const next = { ...(records || {}) };
  let saved = { ...draft, id: original.id, revision: normalizeRevision(current.revision) + 1 };
  const becameCompleted = !isCompletedStatus(original.status) && isCompletedStatus(saved.status);
  // Reopening and completing the same parent must never spawn another child.
  // The first successful child ID remains an idempotency marker.
  const recurring = becameCompleted && !current.nextRecurringTaskId
    ? nextRecurringChild(saved) : null;
  if (becameCompleted && !recurring && saved.recurrence !== "none" && !current.nextRecurringTaskId) {
    saved = {
      ...saved,
      history: appendHistory(saved.history,
        "繰り返し終了条件に達したか、これ以上の予定日がないため、次回タスクは作成されませんでした。")
    };
  }
  if (recurring) {
    const child = next[recurring.id];
    if (current.nextRecurringTaskId && current.nextRecurringTaskId !== recurring.id) throw new Error('conflict');
    if (child && (child.recurringParentId !== original.id ||
      (child.recurrenceRule?.occurrenceDate || child.dueDate) !== recurring.repeatDate)) throw new Error('conflict');
    if (!child) next[recurring.id] = { ...recurring.task, revision: 1, operationId: recurring.id };
    saved = {
      ...saved,
      recurrenceRule: {
        ...saved.recurrenceRule,
        generatedCount: recurring.task.recurrenceRule.generatedCount
      },
      nextRecurringTaskId: recurring.id,
      history: appendHistory(saved.history, `次回の定期タスクを作成しました（繰り返し予定日：${recurring.repeatDate}）。`)
    };
  }
  next[original.id] = saved;
  return { records: next, recurring };
}

async function commitTaskDraft(kind, original, draft) {
  return executeWrite(kind, original.id, async () => {
    const apply = records => applyTaskDraft(records, original, draft).records;
    if (state.connectionMode === 'local-only') {
      const records = Object.fromEntries(state.tasks.map(item => [item.id, item]));
      const snapshot = { tasks: apply(records) };
      const childId = snapshot.tasks[original.id]?.nextRecurringTaskId;
      const affectedPaths = [`rooms/${ROOM_ID}/tasks/${original.id}`, ...(childId ? [`rooms/${ROOM_ID}/tasks/${childId}`] : [])];
      applyCommittedResult({ snapshot, affectedPaths, mutationKind: kind });
      return { committed: true, snapshot, snapshotScope: 'root', affectedPaths, mutationKind: kind };
    }
    let conflict = false;
    const remote = await runTransaction(state.tasksRef, current => {
      try { return apply(current || {}); } catch (error) { conflict = error.message === 'conflict'; return; }
    });
    if (!remote.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
    const tasks = remote.snapshot?.val() || {};
    const snapshot = { tasks };
    const childId = tasks[original.id]?.nextRecurringTaskId;
    const affectedPaths = [`rooms/${ROOM_ID}/tasks/${original.id}`, ...(childId ? [`rooms/${ROOM_ID}/tasks/${childId}`] : [])];
    applyCommittedResult({ snapshot, affectedPaths, mutationKind: kind });
    return { committed: true, snapshot, snapshotScope: 'root', affectedPaths, mutationKind: kind };
  });
}

async function persistTask(task) {
  const expectedRevision = normalizeRevision(task.revision);
  return executeWrite('task', task.id, () => transactionRecord('tasks', task.id, expectedRevision, () => task));
}

async function persistTaskWithScheduleLink(task, schedule) {
  return executeWrite('task-schedule-link', task.id, () => transactionRoom(root => {
    root.tasks ||= {};
    root.schedules ||= {};
    const currentTask = root.tasks[task.id];
    const currentSchedule = root.schedules[schedule.id];
    if (currentTask || !currentSchedule || normalizeRevision(currentSchedule.revision) !== normalizeRevision(schedule.revision)) throw new Error('conflict');
    if (currentSchedule.relatedTaskId) throw new Error('conflict');
    root.tasks[task.id] = { ...task, revision: 1 };
    root.schedules[schedule.id] = {
      ...currentSchedule, relatedTaskId: task.id, updatedAt: Date.now(), updatedBy: getCurrentUser(),
      revision: normalizeRevision(currentSchedule.revision) + 1
    };
    return root;
  }, [`rooms/${ROOM_ID}/tasks/${task.id}`, `rooms/${ROOM_ID}/schedules/${schedule.id}`]));
}

async function commitMetaAndTaskUpdates(kind, fields, updates) {
  const names = Object.keys(fields);
  const originals = Object.values(updates).map(item => item.original);
  return executeWrite(kind, names.sort().join(','), async () => {
    const apply = root => {
      const next = { ...(root || {}) };
      const meta = next.meta && typeof next.meta === 'object' ? next.meta : {};
      const revisions = meta._revisions && typeof meta._revisions === 'object' ? meta._revisions : {};
      for (const name of names) {
        if (normalizeRevision(revisions[name]) !== normalizeRevision(state.metaRevisions[name])) throw new Error('conflict');
      }
      const tasks = { ...(next.tasks || {}) };
      for (const original of originals) {
        const current = tasks[original.id];
        if (!current || normalizeRevision(current.revision) !== normalizeRevision(original.revision)) throw new Error('conflict');
        tasks[original.id] = { ...updates[original.id].draft, revision: normalizeRevision(current.revision) + 1 };
      }
      const nextRevisions = { ...revisions };
      names.forEach(name => { nextRevisions[name] = normalizeRevision(revisions[name]) + 1; });
      return { ...next, tasks, meta: { ...meta, ...fields, _revisions: nextRevisions } };
    };
    if (state.connectionMode === 'local-only') {
      const root = { tasks: Object.fromEntries(state.tasks.map(item => [item.id, item])), meta: { _revisions: state.metaRevisions } };
      const next = apply(root);
      const affectedPaths = [...originals.map(item => `rooms/${ROOM_ID}/tasks/${item.id}`), ...names.map(name => `rooms/${ROOM_ID}/meta/${name}`)];
      applyCommittedResult({ snapshot: next, affectedPaths, mutationKind: kind });
      applyCommittedMeta(next.meta);
      return { committed: true, snapshot: next, snapshotScope: 'root', affectedPaths, mutationKind: kind };
    }
    let conflict = false;
    const remote = await runTransaction(state.roomRef, current => {
      try { return apply(current || {}); } catch (error) { conflict = error.message === 'conflict'; return; }
    });
    if (!remote.committed) throw new Error(conflict ? 'revision-or-relation-mismatch' : 'transaction-aborted-or-invariant-failure');
    const snapshot = remote.snapshot?.val() || {};
    const affectedPaths = [...originals.map(item => `rooms/${ROOM_ID}/tasks/${item.id}`), ...names.map(name => `rooms/${ROOM_ID}/meta/${name}`)];
    applyCommittedResult({ snapshot, affectedPaths, mutationKind: kind });
    applyCommittedMeta(snapshot.meta);
    return { committed: true, snapshot, snapshotScope: 'root', affectedPaths, mutationKind: kind };
  });
}

function captureDeleteBase(id) {
  const hasRawTask = Object.prototype.hasOwnProperty.call(state.deleteBaseRoot.tasks || {}, id);
  const root = hasRawTask ? state.deleteBaseRoot : {
    tasks: Object.fromEntries(state.tasks.map(item => [item.id, item])),
    schedules: Object.fromEntries(state.schedules.map(item => [item.id, item])),
    knowledge: Object.fromEntries(state.knowledge.map(item => [item.id, item]))
  };
  const base = captureDeleteBaseFromProtocol(id, root);
  return base.task ? base : null;
}

function applyLatestDeleteRoot(id, root) {
  // A conflict read is evidence for this task only.  Collection listeners own
  // normal whole-collection synchronization; never replace them from a
  // failed-delete path.
  applyDeleteSyncAction({
    type: 'apply-delete-target',
    roomId: ROOM_ID,
    snapshot: root,
    affectedPaths: [`rooms/${ROOM_ID}/tasks/${id}`]
  });
  state.detailDeleteBase = captureDeleteBaseFromRoot(id, root);
}

function applyAlreadyDeletedTask(id, root) {
  applyDeleteSyncAction({
    type: 'apply-already-deleted',
    roomId: ROOM_ID,
    snapshot: root,
    affectedPaths: [`rooms/${ROOM_ID}/tasks/${id}`]
  }, { refreshDetail: true });
}

function presentDeleteConflict(id, result) {
  const dialog = elements.deleteConflictDialog;
  if (!dialog) return toast('他の更新と競合しました。最新内容を確認してください', true);
  const root = result.latestRoot || {};
  const latest = root?.tasks?.[id];
  elements.deleteConflictSummary.textContent = latest
    ? `「${latest.title || id}」は他の利用者により更新されています。最新内容を確認してから削除してください。`
    : 'このタスクはすでに削除されています。画面を更新してください。';
  elements.deleteConflictChanges.innerHTML = (result.changes || ['内容']).map(change => `<li>${escapeHtml(change)}</li>`).join('');
  elements.viewLatestDeleteConflict.disabled = false;
  elements.cancelDeleteConflict.disabled = false;
  elements.viewLatestDeleteConflict.onclick = () => {
    applyLatestDeleteRoot(id, root);
    if ($('taskId')?.value === id) elements.taskDialog.close();
    state.selectedId = id;
    state.detailDeleteBase = captureDeleteBase(id);
    renderDetail();
    dialog.close();
    toast('最新内容を詳細画面に表示しました。確認後、削除を改めて選択してください。', true);
  };
  elements.cancelDeleteConflict.onclick = () => {
    dialog.close();
    toast('削除を取り消しました。最新内容を確認してください。', true);
  };
  dialog.showModal();
  elements.viewLatestDeleteConflict.focus();
}

async function readCurrentDeleteTarget() {
  if (state.connectionMode !== 'remote-online' || !get || !state.roomRef) throw new Error('network-or-read-failure');
  try { return (await get(state.roomRef)).val() || {}; }
  catch (error) {
    const code = String(error?.code || '').toLowerCase();
    throw new Error(code.includes('permission') ? 'permission-denied' : 'network-or-read-failure');
  }
}

function finalizeDeletedTask(id) {
  if (state.selectedId === id) { state.selectedId = ''; closeDetail(); }
  if ($('taskId')?.value === id) elements.taskDialog.close();
}

function deleteAffectedPaths(affectedPaths = []) {
  return affectedPaths.map(path => `rooms/${ROOM_ID}/${path}`);
}

function beginDeleteController(id) {
  const existing = state.deleteControllers.get(id);
  if (existing && ['initial-confirmed', 'refreshing', 'reconfirming'].includes(existing.state)) return null;
  const controller = { taskId: id, state: 'initial-confirmed', retryCount: 0 };
  state.deleteControllers.set(id, controller);
  return controller;
}

function finishDeleteController(controller, terminalState) {
  controller.state = terminalState;
  state.deleteControllers.set(controller.taskId, controller);
}

// Firebase abort is intentionally represented as data.  The transaction callback
// never throws and never updates UI/cache/localStorage; those effects occur only
// after a committed snapshot or a separately classified terminal outcome.
async function transactionDeleteRoom(base) {
  const runPlan = root => planDeleteMutation(base, root && typeof root === 'object' ? root : {});
  if (state.connectionMode === 'local-only') {
    const root = {
      tasks: Object.fromEntries(state.tasks.map(item => [item.id, item])),
      schedules: Object.fromEntries(state.schedules.map(item => [item.id, item])),
      knowledge: Object.fromEntries(state.knowledge.map(item => [item.id, item]))
    };
    const plan = runPlan(root);
    if (plan.action !== 'commit') return plan;
    const affectedPaths = deleteAffectedPaths(plan.affectedPaths);
    applyCommittedResult({ snapshot: plan.nextRoot, affectedPaths, mutationKind: 'task-delete' });
    return { action: 'commit', kind: 'committed', committed: true, snapshot: plan.nextRoot, affectedPaths, cleanupWarnings: [] };
  }

  // Ver.143: parent roomRef is not subscribed as a whole. Therefore a room
  // transaction callback can initially receive an incomplete/null local cache.
  // Never classify that first callback as "already deleted". Read the current
  // server room first, then delete the task child with local events disabled.
  const latestRoot = await readCurrentDeleteTarget();
  const plan = runPlan(latestRoot);
  if (plan.action !== 'commit') return plan;

  const taskPath = `rooms/${ROOM_ID}/tasks/${base.id}`;
  const taskRef = ref(state.db, taskPath);
  let taskChanged = false;
  let alreadyAbsentDuringTransaction = false;
  const remote = await runTransaction(taskRef, current => {
    if (!current) {
      alreadyAbsentDuringTransaction = true;
      return null;
    }
    const descriptor = captureDeleteBaseFromProtocol(base.id, { tasks: { [base.id]: current } }).task;
    if (!descriptor
      || descriptor.projection !== base.task?.projection
      || descriptor.revision !== normalizeRevision(base.task?.revision)) {
      taskChanged = true;
      return;
    }
    return null;
  }, { applyLocally: false });

  if (!remote.committed && !alreadyAbsentDuringTransaction) {
    const currentRoot = await readCurrentDeleteTarget();
    const classification = classifyDeleteConflictProtocol(base, currentRoot);
    return {
      action: 'abort',
      kind: classification.kind || (taskChanged ? 'remote-content-changed' : 'transaction-aborted-or-invariant-failure'),
      changes: classification.changes || ['task'],
      latestRoot: currentRoot
    };
  }

  // A successful transaction result is not enough for this bug class. Confirm
  // the child is truly absent from Firebase before changing UI/cache state.
  const taskAfterDelete = await get(taskRef);
  if (taskAfterDelete.exists()) {
    const currentRoot = await readCurrentDeleteTarget();
    const classification = classifyDeleteConflictProtocol(base, currentRoot);
    return {
      action: 'abort',
      kind: classification.kind === 'ready-to-delete' ? 'delete-not-persisted' : classification.kind,
      changes: classification.changes?.length ? classification.changes : ['task'],
      latestRoot: currentRoot
    };
  }

  // The target task is authoritatively absent. Related records are cleaned on
  // their own child refs so concurrent unrelated edits are never overwritten.
  const cleanupRoot = await readCurrentDeleteTarget();
  const scheduleIds = new Set([
    ...(base.schedules || []).map(item => item.id),
    ...Object.entries(cleanupRoot.schedules || {})
      .filter(([, schedule]) => schedule?.relatedTaskId === base.id)
      .map(([id]) => id)
  ]);
  const knowledgeIds = new Set([
    ...(base.knowledge || []).map(item => item.id),
    ...Object.entries(cleanupRoot.knowledge || {})
      .filter(([, item]) => item?.taskId === base.id)
      .map(([id]) => id)
  ]);

  const cleanupErrors = [];
  for (const scheduleId of scheduleIds) {
    const path = `rooms/${ROOM_ID}/schedules/${scheduleId}`;
    try {
      await runTransaction(ref(state.db, path), current => {
        if (!current || current.relatedTaskId !== base.id) return current;
        return {
          ...current,
          relatedTaskId: '',
          updatedAt: Date.now(),
          updatedBy: getCurrentUser(),
          revision: normalizeRevision(current.revision) + 1
        };
      }, { applyLocally: false });
    } catch (error) {
      console.warn(`Related schedule cleanup failed: ${scheduleId}`, error);
      cleanupErrors.push(path);
    }
  }

  for (const knowledgeId of knowledgeIds) {
    const path = `rooms/${ROOM_ID}/knowledge/${knowledgeId}`;
    try {
      await runTransaction(ref(state.db, path), current => {
        if (!current || current.taskId !== base.id) return current;
        return null;
      }, { applyLocally: false });
    } catch (error) {
      console.warn(`Related knowledge cleanup failed: ${knowledgeId}`, error);
      cleanupErrors.push(path);
    }
  }

  const finalRoot = await readCurrentDeleteTarget();
  if (finalRoot.tasks?.[base.id]) {
    return {
      action: 'abort',
      kind: 'delete-not-persisted',
      changes: ['task'],
      latestRoot: finalRoot
    };
  }

  const stillLinkedSchedules = Object.entries(finalRoot.schedules || {})
    .filter(([, schedule]) => schedule?.relatedTaskId === base.id)
    .map(([id]) => `rooms/${ROOM_ID}/schedules/${id}`);
  const stillLinkedKnowledge = Object.entries(finalRoot.knowledge || {})
    .filter(([, item]) => item?.taskId === base.id)
    .map(([id]) => `rooms/${ROOM_ID}/knowledge/${id}`);
  const cleanupWarnings = [...new Set([...cleanupErrors, ...stillLinkedSchedules, ...stillLinkedKnowledge])];

  const relativeAffectedPaths = [`tasks/${base.id}`];
  for (const scheduleId of scheduleIds) {
    const current = finalRoot.schedules?.[scheduleId];
    if (!current || current.relatedTaskId !== base.id) relativeAffectedPaths.push(`schedules/${scheduleId}`);
  }
  for (const knowledgeId of knowledgeIds) {
    const current = finalRoot.knowledge?.[knowledgeId];
    if (!current || current.taskId !== base.id) relativeAffectedPaths.push(`knowledge/${knowledgeId}`);
  }
  const affectedPaths = deleteAffectedPaths([...new Set(relativeAffectedPaths)]);

  // Only a server-verified deletion may enter the local deletion barrier.
  applyCommittedResult({ snapshot: finalRoot, affectedPaths, mutationKind: 'task-delete' });
  return {
    action: 'commit',
    kind: 'committed',
    committed: true,
    snapshot: finalRoot,
    affectedPaths,
    cleanupWarnings
  };
}

async function deleteTaskV134(id, base, options = {}) {
  const controller = beginDeleteController(id);
  if (!controller) return { ok: false, error: 'in-flight', affectedPaths: [] };
  const result = await executeWrite('task-delete', id, async () => {
    let attempt = await transactionDeleteRoom(base);
    if (attempt.committed) return attempt;

    if (attempt.kind === 'stale-local-state') {
      controller.state = 'refreshing';
      controller.retryCount = 1;
      const refreshed = captureDeleteBaseFromProtocol(id, attempt.latestRoot);
      if (!refreshed.task) attempt = { action: 'abort', kind: 'already-deleted', latestRoot: attempt.latestRoot, changes: ['task'] };
      else {
        controller.state = 'reconfirming';
        attempt = await transactionDeleteRoom(refreshed);
      }
    }

    if (attempt.committed) return { ...attempt, retried: controller.retryCount === 1 };
    if (attempt.kind === 'already-deleted') {
      applyAlreadyDeletedTask(id, attempt.latestRoot || {});
      return { alreadyDeleted: true, affectedPaths: [`rooms/${ROOM_ID}/tasks/${id}`] };
    }
    return {
      ok: false,
      error: attempt.kind || 'transaction-aborted-or-invariant-failure',
      changes: attempt.changes || [],
      latestRoot: attempt.latestRoot || null,
      affectedPaths: []
    };
  });

  if (!result.ok) {
    finishDeleteController(controller, 'failed');
    if (result.error === 'remote-content-changed') return result;
    if (!options.silent) showWriteFailure(result, '削除できませんでした。');
    return result;
  }
  finishDeleteController(controller, result.alreadyDeleted ? 'already-deleted' : 'committed');
  if (result.alreadyDeleted) {
    if (!options.silent) toast('すでに削除されています。最新状態を確認してください。', true);
    return result;
  }
  finalizeDeletedTask(id);
  if (!options.silent) toast('削除しました。');
  return result;
}

async function deleteTask(id, options = {}) {
  const base = options.base || captureDeleteBase(id);
  if (!base) return { ok: false, error: 'not-found' };
  return deleteTaskV134(id, base, options);
}

async function requestTaskDelete(id, base, options = {}) {
  const result = await deleteTask(id, { ...options, base: base || captureDeleteBase(id), silent: true });
  if (result?.error === 'remote-content-changed') {
    presentDeleteConflict(id, result);
    return result;
  }
  if (!result?.ok) {
    showWriteFailure(result, '削除できませんでした。');
    return result;
  }
  if (result.cleanupWarnings?.length) {
    toast('タスク本体は削除しましたが、関連情報の解除に失敗した項目があります。再読込後に関連予定を確認してください。', true);
  } else if (!result.alreadyDeleted) {
    toast('削除しました。');
  }
  return result;
}

function captureDeleteBaseFromRoot(id, root) {
  return captureDeleteBaseFromProtocol(id, root);
}

async function changeStatus(id, status, memo = "") {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  return transitionTaskStatus(task, status, memo);
}

async function transitionTaskStatus(task, status, memo = "") {
  status = normalizeStatus(status);
  const draft = cloneTask(task);
  const beforeStatus = draft.status;
  draft.status = status;
  draft.updatedAt = Date.now();
  draft.updatedBy = getCurrentUser();
  if (isCompletedStatus(status)) {
    draft.completedAt = draft.completedAt || Date.now();
    if (memo) draft.completedMemo = memo;
  } else {
    draft.completedAt = 0;
    draft.completedMemo = "";
  }
  draft.lastChange = makeActivityChange("状態変更", [`状態: ${beforeStatus} → ${status}`, memo ? `完了メモ: ${shortText(memo, 40)}` : ""], {
    historyText: `状態を「${beforeStatus}」から「${status}」へ変更しました。${memo ? " 完了メモ：" + memo : ""}`
  });
  draft.history = appendHistory(draft.history, draft.lastChange.historyText);
  const result = await commitTaskDraft('task-status', task, draft);
  if (!result.ok) return showWriteFailure(result, '状態を変更できませんでした。');
  return result;
}

async function completeTaskWithMemo(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return { ok: false, error: 'not-found' };
  const memo = prompt("完了メモを残しますか？\n再発時の確認点や対応内容があれば入力してください。", task.completedMemo || "");
  if (memo === null) return { ok: false, error: 'cancelled' };
  // Keep the revision captured before the prompt. Another browser might
  // have edited the task while the operator was entering a completion memo.
  // commitTaskDraft performs the final remote CAS on this original revision.
  return transitionTaskStatus(task, COMPLETED_STATUS, memo.trim());
}

async function toggleChecklist(id, index, done) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !task.checklist[index]) return;
  const draft = cloneTask(task);
  draft.checklist[index].done = done;
  draft.lastChange = makeActivityChange("チェックリスト更新", [`${done ? "完了" : "未完了"}: ${shortText(draft.checklist[index].text, 42)}`]);
  draft.history = appendHistory(draft.history, `チェックリスト「${draft.checklist[index].text}」を${done ? "完了" : "未完了"}にしました。`);
  draft.updatedAt = Date.now(); draft.updatedBy = getCurrentUser();
  const result = await persistTask(draft);
  if (!result.ok) showWriteFailure(result, 'チェックリストを保存できませんでした。');
}

async function addComment(id, text, type = "作業メモ", options = {}) {
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
}

function loadLocalKnowledge() {
  try {
    state.knowledge = JSON.parse(localStorage.getItem(knowledgeKey()) || "[]").map(normalizeKnowledge);
  } catch {
    state.knowledge = [];
  }
  state.deleteBaseRoot.knowledge = Object.fromEntries(state.knowledge.map(item => [item.id, item]));
  render();
}

function loadLocalTasks() {
  try {
    state.tasks = JSON.parse(localStorage.getItem(tasksKey()) || "[]").map(normalizeTask);
  } catch {
    state.tasks = [];
  }
  state.deleteBaseRoot.tasks = Object.fromEntries(state.tasks.map(item => [item.id, item]));
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
  // A user change redraws the ToDo page without leaving this layout.
  // Save the old user's draft under their own key before changing identity.
  if (state.layout === 'todos' && normalizeUser(value) !== getCurrentUser()) {
    rememberClassicTodoNavigationDraft();
  }
  clearTaskDialogContexts();
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

  const previous = [...state.users];
  state.users = uniqueUsers(next);
  const result = await saveUserSettings(true);
  if (!result?.ok) { state.users = previous; localStorage.setItem(usersKey(), JSON.stringify(previous)); return showWriteFailure(result, 'ユーザーの順番を保存できませんでした。'); }
  syncUserUi();
  renderUserManager();
  render();
  toast("ユーザーの順番を変更しました");
  return result;
}

async function reorderStatuses(source, target) {
  const next = reorderValues(getStatusList(), source, target);
  if (!next) return;

  const previous = [...state.statuses];
  state.statuses = uniqueStatuses(next);
  const result = await saveStatusSettings(true);
  if (!result?.ok) { state.statuses = previous; localStorage.setItem(statusesKey(), JSON.stringify(previous)); return showWriteFailure(result, '状態の順番を保存できませんでした。'); }
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  renderStatusManager();
  render();
  toast("状態の順番を変更しました");
  return result;
}

async function reorderCategories(source, target) {
  const next = reorderValues(state.categories, source, target);
  if (!next) return;

  const previous = [...state.categories];
  state.categories = uniqueCategories(next);
  const result = await saveCategorySettings(true);
  if (!result?.ok) { state.categories = previous; localStorage.setItem(categoriesKey(), JSON.stringify(previous)); return showWriteFailure(result, '分類の順番を保存できませんでした。'); }
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions($("scheduleCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  renderCategoryManager();
  render();
  toast("分類の順番を変更しました");
  return result;
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
    input.addEventListener("change", async () => {
      const previous = { ...state.userColors };
      state.userColors = { ...state.userColors, [input.dataset.userColor]: input.value };
      const result = await saveUserSettings(true);
      if (!result?.ok) {
        state.userColors = previous;
        input.value = userColor(input.dataset.userColor);
        localStorage.setItem(colorsKey(), JSON.stringify(previous));
        return showWriteFailure(result, '色設定を保存できませんでした。');
      }
      syncUserUi();
      render();
    });
  });

  bindReorder(elements.userList, {
    kind: "user",
    handleSelector: "[data-drag-kind='user']",
    dropSelector: "[data-drop-kind='user']",
    onReorder: reorderUsers
  });
}


async function addUserFromForm(rawName = elements.newUserName.value, color = elements.newUserColor.value) {
  const name = sanitizeUser(rawName);
  if (!name) return toast("ユーザー名を入力してください", true);
  if (state.users.some(u => normalizeText(u) === normalizeText(name))) return toast("同じユーザーが既にあります", true);
  const previousUsers = [...state.users]; const previousColors = { ...state.userColors };
  state.users = [...state.users, name];
  state.userColors = { ...state.userColors, [name]: color || "#7c5cff" };
  elements.newUserName.value = "";
  setUsers(state.users,{persist:false});
  const result = await saveUserSettings(true);
  if (!result?.ok) { state.users = previousUsers; state.userColors = previousColors; localStorage.setItem(usersKey(), JSON.stringify(previousUsers)); localStorage.setItem(colorsKey(), JSON.stringify(previousColors)); return showWriteFailure(result, 'ユーザーを追加できませんでした。'); }
  renderUserManager();
  return result;
}

async function deleteUser(name) {
  if (state.users.length <= 1) return;
  const target = sanitizeUser(name);
  if (!confirm(`${target}を削除しますか？既存タスクの担当者名は残ります。`)) return;
  const previousUsers = [...state.users]; const previousColors = { ...state.userColors }; const previousCurrentUser = state.currentUser;
  const wasCurrent = sanitizeUser(state.currentUser || localStorage.getItem("systemTaskUser")) === target;
  state.users = state.users.filter(u => u !== target);
  delete state.userColors[target];
  if (wasCurrent) {
    state.currentUser = state.users[0] || "";
    localStorage.setItem("systemTaskUser", state.currentUser);
  }
  const result = await saveUserSettings(true);
  if (!result?.ok) { state.users = previousUsers; state.userColors = previousColors; state.currentUser = previousCurrentUser; localStorage.setItem(usersKey(), JSON.stringify(previousUsers)); localStorage.setItem(colorsKey(), JSON.stringify(previousColors)); localStorage.setItem("systemTaskUser", previousCurrentUser); return showWriteFailure(result, 'ユーザーを削除できませんでした。'); }
  syncUserUi();
  renderUserManager();
  render();
  return result;
}

function setUsers(users, options = {}) {
  state.users = uniqueUsers(users);
  localStorage.setItem(usersKey(), JSON.stringify(state.users));
  syncUserUi();
  if (options.persist !== false) saveUserSettings(true);
  if (!options.silent) render();
}

function setUserColors(colors, options = {}) {
  const safeColors = Object.fromEntries(Object.entries(colors || {}).filter(([name, color]) => sanitizeUser(name) && isSafeColor(color)));
  state.userColors = { ...state.userColors, ...safeColors };
  localStorage.setItem(colorsKey(), JSON.stringify(state.userColors));
  syncUserUi();
  if (options.persist !== false) saveUserSettings(true);
  if (!options.silent) render();
}

function isSafeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(color) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color);
}

async function saveUserSettings(remote = true) {
  localStorage.setItem(usersKey(), JSON.stringify(state.users));
  localStorage.setItem(colorsKey(), JSON.stringify(state.userColors));
  if (remote) return persistMetaFields({ users: state.users, userColors: state.userColors, usersUpdatedAt: Date.now() });
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
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim().slice(0, 20);
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
function isProtectedDeleteStatus(status) {
  return DEFAULT_STATUSES.some(item => normalizeText(item) === normalizeText(status));
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
    const nameLocked = isCompletedStatus(status);
    const deleteProtected = isProtectedDeleteStatus(status);
    const deleteAttributes = deleteProtected
      ? `disabled aria-disabled="true" title="${escapeHtml(status)}は基本状態のため削除できません"`
      : (statuses.length <= 1 ? "disabled" : "");
    return `<div class="status-list-item ${nameLocked ? "is-protected" : ""}" data-drop-kind="status" data-drop-value="${escapeHtml(status)}">
      <span class="drag-handle" draggable="true" data-drag-kind="status" data-drag-value="${escapeHtml(status)}" title="ドラッグして状態の順番を変更">☰</span>
      <input class="status-name-input" value="${escapeHtml(status)}" maxlength="20" data-status-old="${escapeHtml(status)}" ${nameLocked ? "readonly" : ""} />
      <div class="status-list-actions">
        ${nameLocked ? `<span class="protected-chip">固定</span>` : `<button class="mini-button" type="button" data-save-status="${escapeHtml(status)}">保存</button>`}
        <button class="mini-button danger" type="button" data-delete-status="${escapeHtml(status)}" ${deleteAttributes}>削除</button>
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
async function addStatusFromForm(rawName = elements.newStatusName.value) {
  const name = sanitizeStatus(rawName);
  if (!name) return toast("状態名を入力してください", true);
  if (getStatusList({ includeTaskOnly: false }).some(status => normalizeText(status) === normalizeText(name))) return toast("同じ状態が既にあります", true);
  const previous = [...state.statuses];
  const completeIndex = state.statuses.findIndex(isCompletedStatus);
  if (completeIndex >= 0) state.statuses.splice(completeIndex, 0, name);
  else state.statuses.push(name);
  elements.newStatusName.value = "";
  const result = await saveStatusSettings(true);
  if (!result?.ok) { state.statuses = previous; localStorage.setItem(statusesKey(), JSON.stringify(previous)); return showWriteFailure(result, '状態を追加できませんでした。'); }
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  renderStatusManager();
  render();
  toast("状態を追加しました");
  return result;
}
async function renameStatus(oldName, newValue) {
  const next = sanitizeStatus(newValue);
  if (!next) return toast("状態名を入力してください", true);
  if (isCompletedStatus(oldName)) return toast("完了は名称変更できません", true);
  if (next !== oldName && getStatusList({ includeTaskOnly: false }).some(status => normalizeText(status) === normalizeText(next))) return toast("同じ状態が既にあります", true);
  const nextStatuses = getStatusList({ includeTaskOnly: false }).map(status => status === oldName ? next : status);
  const nextStatusesByUser = { ...state.statusesByUser };
  const owner = getStatusOwner();
  if (owner) nextStatusesByUser[owner] = nextStatuses;
  const updates = Object.fromEntries(state.tasks.filter(task => task.status === oldName).map(original => {
    const draft = cloneTask(original); draft.status = next; draft.updatedAt = Date.now(); draft.updatedBy = getCurrentUser();
    return [original.id, { original, draft }];
  }));
  const result = await commitMetaAndTaskUpdates('status-rename', { statuses: nextStatuses, statusesByUser: nextStatusesByUser, statusesUpdatedAt: Date.now() }, updates);
  if (!result.ok) return showWriteFailure(result, '状態名を更新できませんでした。');
  state.statuses = nextStatuses; state.statusesByUser = nextStatusesByUser;
  localStorage.setItem(statusesKey(owner), JSON.stringify(state.statuses)); localStorage.setItem(statusesByUserKey(), JSON.stringify(state.statusesByUser));
  renderStatusManager();
  render();
  toast("状態を更新しました");
  return result;
}
async function deleteStatus(name) {
  if (isProtectedDeleteStatus(name)) {
    const message = isCompletedStatus(name) ? "完了は削除できません" : `${name}は基本状態のため削除できません`;
    return toast(message, true);
  }
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
  const nextStatuses = statuses.filter(status => status !== name);
  const nextStatusesByUser = { ...state.statusesByUser };
  const owner = getStatusOwner();
  if (owner) nextStatusesByUser[owner] = nextStatuses;
  const updates = Object.fromEntries(state.tasks.filter(task => task.status === name).map(original => {
    const draft = cloneTask(original); draft.status = fallback; draft.updatedAt = Date.now(); draft.updatedBy = getCurrentUser();
    return [original.id, { original, draft }];
  }));
  const result = await commitMetaAndTaskUpdates('status-delete', { statuses: nextStatuses, statusesByUser: nextStatusesByUser, statusesUpdatedAt: Date.now() }, updates);
  if (!result.ok) return showWriteFailure(result, '状態を削除できませんでした。');
  state.statuses = nextStatuses; state.statusesByUser = nextStatusesByUser;
  localStorage.setItem(statusesKey(owner), JSON.stringify(state.statuses)); localStorage.setItem(statusesByUserKey(), JSON.stringify(state.statusesByUser));
  renderStatusManager();
  render();
  toast("状態を削除しました");
  return result;
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
  if (remote) return persistMetaFields({ statusesByUser: state.statusesByUser, statuses: state.statuses, statusesUpdatedAt: Date.now() });
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


async function addCategoryFromForm(rawName = elements.newCategoryName.value) {
  const name = sanitizeCategory(rawName);
  if (!name) return toast("分類名を入力してください", true);
  if (state.categories.some(c => normalizeText(c) === normalizeText(name))) return toast("同じ分類が既にあります", true);
  const previous = [...state.categories];
  state.categories = [...state.categories, name];
  elements.newCategoryName.value = "";
  const result = await saveCategorySettings(true);
  if (!result?.ok) { state.categories = previous; localStorage.setItem(categoriesKey(), JSON.stringify(previous)); return showWriteFailure(result, '分類を追加できませんでした。'); }
  syncCategoryOptions($("taskCategory"));
  syncCategoryOptions($("scheduleCategory"));
  syncCategoryOptions(elements.categoryFilter, true);
  syncStatusOptions($("taskStatus"));
  syncStatusOptions(elements.statusFilter, true);
  renderCategoryManager();
  render();
  return result;
}
async function renameCategory(oldName, newValue) {
  const next = sanitizeCategory(newValue);
  if (!next) return toast("分類名を入力してください", true);
  if (next !== oldName && state.categories.some(c => normalizeText(c) === normalizeText(next))) return toast("同じ分類が既にあります", true);
  const nextCategories = state.categories.map(c => c === oldName ? next : c);
  const updates = Object.fromEntries(state.tasks.filter(task => task.category === oldName).map(original => {
    const draft = cloneTask(original); draft.category = next; draft.updatedAt = Date.now(); draft.updatedBy = getCurrentUser();
    return [original.id, { original, draft }];
  }));
  const result = await commitMetaAndTaskUpdates('category-rename', { categories: nextCategories, categoriesUpdatedAt: Date.now() }, updates);
  if (!result.ok) return showWriteFailure(result, '分類名を更新できませんでした。');
  state.categories = nextCategories; localStorage.setItem(categoriesKey(), JSON.stringify(state.categories));
  renderCategoryManager();
  render();
  toast("分類を更新しました");
  return result;
}
async function deleteCategory(name) {
  if (state.categories.length <= 1) return;
  const used = state.tasks.some(t => t.category === name);
  const message = used
    ? `${name}を削除しますか？\nこの分類を使っているタスクは「その他」に変更されます。`
    : `${name}を削除しますか？`;
  if (!confirm(message)) return;
  const nextCategories = state.categories.filter(c => c !== name);
  const fallback = nextCategories.includes("その他") ? "その他" : nextCategories[0];
  const updates = Object.fromEntries(state.tasks.filter(task => task.category === name).map(original => {
    const draft = cloneTask(original); draft.category = fallback; draft.updatedAt = Date.now(); draft.updatedBy = getCurrentUser();
    return [original.id, { original, draft }];
  }));
  const result = await commitMetaAndTaskUpdates('category-delete', { categories: nextCategories, categoriesUpdatedAt: Date.now() }, updates);
  if (!result.ok) return showWriteFailure(result, '分類を削除できませんでした。');
  state.categories = nextCategories; localStorage.setItem(categoriesKey(), JSON.stringify(state.categories));
  renderCategoryManager();
  render();
  toast("分類を削除しました");
  return result;
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
  if (remote) return persistMetaFields({ categories: state.categories, categoriesUpdatedAt: Date.now() });
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
  return persistMetaFields({ roomName: state.roomName, roomNameUpdatedAt: Date.now() });
}

function showUserDialogIfNeeded() {
  if (localStorage.getItem("systemTaskUser")) return;
  elements.userDialog.showModal();
}

function selectTask(id) {
  state.selectedId = id;
  state.detailDeleteBase = captureDeleteBase(id);
  renderDetail();
}

function closeDetail() {
  state.selectedId = "";
  state.detailDeleteBase = null;
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
  return `<span class="badge status-未着手 category-badge">${escapeHtml(category)}</span>`;
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
  if (remote) return persistMetaFields({ taskTemplates: state.taskTemplates, taskTemplatesUpdatedAt: Date.now() });
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

  const previous = [...state.taskTemplates];
  const index = state.taskTemplates.findIndex(t => t.id === id);
  state.taskTemplates = index >= 0 ? state.taskTemplates.map(item => item.id === id ? template : item) : [...state.taskTemplates, template];
  const result = await saveTemplateSettings(true);
  if (!result?.ok) { state.taskTemplates = previous; localStorage.setItem(taskTemplatesKey(), JSON.stringify(previous)); return showWriteFailure(result, 'テンプレートを保存できませんでした。'); }
  syncTemplateOptions();
  renderTemplateManager(id);
  toast("テンプレートを保存しました");
}

async function deleteSelectedTemplate() {
  const id = elements.templateIdField.value;
  const template = state.taskTemplates.find(t => t.id === id);
  if (!template) return;
  if (!confirm(`${template.name}を削除しますか？`)) return;
  const previous = [...state.taskTemplates];
  state.taskTemplates = state.taskTemplates.filter(t => t.id !== id);
  if (!state.taskTemplates.length) state.taskTemplates = DEFAULT_TASK_TEMPLATES.map(normalizeTemplate);
  const result = await saveTemplateSettings(true);
  if (!result?.ok) { state.taskTemplates = previous; localStorage.setItem(taskTemplatesKey(), JSON.stringify(previous)); return showWriteFailure(result, 'テンプレートを削除できませんでした。'); }
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
    details.push(`繰り返し: ${describeRecurrence(before)}（${describeRecurrenceEnd(before)}） → ${describeRecurrence(after)}（${describeRecurrenceEnd(after)}）`);
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
  if (before.recurrence !== after.recurrence || JSON.stringify(before.recurrenceRule || {}) !== JSON.stringify(after.recurrenceRule || {})) changes.push(`繰り返しを「${describeRecurrence(before)}（${describeRecurrenceEnd(before)}）」から「${describeRecurrence(after)}（${describeRecurrenceEnd(after)}）」へ変更`);
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


// Explicit dates share the schedule-copy concept but retain task's
// completion-triggered, one-at-a-time creation semantics.
function taskRecurrenceDates() {
  return [...document.querySelectorAll("#taskRecurrenceDateList [data-task-recurrence-date]")]
    .map(button => button.dataset.taskRecurrenceDate)
    .filter(validRecurrenceDate).sort();
}

function renderTaskRecurrenceDates(dates = []) {
  const host = $("taskRecurrenceDateList");
  if (!host) return;
  host.replaceChildren();
  const ordered = [...new Set(dates.filter(validRecurrenceDate))].sort().slice(0, SCHEDULE_COPY_MAX);
  if (!ordered.length) {
    const empty = document.createElement("small");
    empty.className = "recurrence-date-empty";
    empty.textContent = "追加した日付はありません。";
    host.appendChild(empty);
    return;
  }
  ordered.forEach(date => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recurrence-date-chip";
    button.dataset.taskRecurrenceDate = date;
    button.title = "この日付を外す";
    button.setAttribute("aria-label", formatScheduleCopyDate(date) + "を削除");
    const label = document.createElement("span");
    label.textContent = formatScheduleCopyDate(date);
    const remove = document.createElement("span");
    remove.textContent = "×";
    remove.setAttribute("aria-hidden", "true");
    button.append(label, remove);
    host.appendChild(button);
  });
}

function addTaskRecurrenceDate() {
  const input = $("taskRecurrenceDateInput");
  const value = input?.value || "";
  if (!validRecurrenceDate(value)) return toast("追加する日付を選択してください。", true);
  if (value <= todayISO()) return toast("今後のタスクには明日以降の日付を指定してください。", true);
  const dates = taskRecurrenceDates();
  if (dates.includes(value)) return toast("この日付は既に追加されています。", true);
  if (dates.length >= SCHEDULE_COPY_MAX) return toast("指定できる日付は200件までです。", true);
  renderTaskRecurrenceDates([...dates, value]);
  input.value = "";
  syncRecurrenceUi();
}

function taskRecurrenceValidationMessage(recurrence, rule) {
  return validateTaskRecurrenceValues(recurrence, {
    ...rule, count: $("taskRecurrenceCount")?.value,
    endDate: $("taskRecurrenceEndDate")?.value || rule.endDate
  }, !$("taskId")?.value);
}

function validateTaskRecurrenceValues(recurrence, rule, isNew) {
  if (recurrence === "none") return "";
  if (recurrence === "dates") {
    if (!rule.selectedDates.length) return "作成する日付を1件以上追加してください。";
    if (isNew && !rule.selectedDates.some(date => date > todayISO())) {
      return "明日以降の作成日を指定してください。";
    }
    return "";
  }
  if (rule.endMode === "count") {
    const value = Number(rule.count);
    if (!Number.isInteger(value) || value < 1 || value > SCHEDULE_COPY_MAX) {
      return "自動作成する件数は1〜200の範囲で指定してください。";
    }
  }
  if (rule.endMode === "date") {
    const endDate = rule.endDate || "";
    if (!validRecurrenceDate(endDate)) return "繰り返しの終了日を指定してください。";
    if (endDate < rule.anchorDate) return "終了日は繰り返し開始日以降にしてください。";
  }
  return "";
}

function setRecurrenceFields(task = null) {
  const recurrence = normalizeRecurrence(task?.recurrence || "none");
  const rule = normalizeRecurrenceRule(recurrence, task?.recurrenceRule || {},
    task?.recurrenceRule?.anchorDate || todayISO());
  $("taskRecurrenceAnchorDate").value = rule.anchorDate || todayISO();
  $("taskRecurrenceInterval").value = String(rule.interval || 1);
  const monthDay = $("taskRecurrenceMonthDay");
  monthDay.value = String(rule.monthDay);
  monthDay.dataset.manual = task?.recurrenceRule?.monthDay != null ? "true" : "false";
  document.querySelectorAll("[data-repeat-weekday]").forEach(input => {
    input.checked = (rule.weekdays || []).map(Number).includes(Number(input.value));
  });
  const nth = $("taskRecurrenceNth");
  const weekday = $("taskRecurrenceWeekday");
  nth.value = rule.nth || "1";
  weekday.value = String(rule.weekday ?? 1);
  nth.dataset.manual = task?.recurrenceRule?.nth != null ? "true" : "false";
  weekday.dataset.manual = task?.recurrenceRule?.weekday != null ? "true" : "false";
  // Old tasks without an end mode intentionally show "unlimited"; new tasks
  // default to four future children rather than an accidental endless chain.
  $("taskRecurrenceEndMode").value = task ? (rule.endMode === "dates" ? "count" : rule.endMode) : "count";
  $("taskRecurrenceCount").value = String(task ? rule.count : 4);
  $("taskRecurrenceEndDate").value = task ? rule.endDate : "";
  $("taskRecurrenceDateInput").value = "";
  renderTaskRecurrenceDates(task ? rule.selectedDates : []);
}

function applyRecurrenceDefaultsFromAnchorDate() {
  const anchor = parseISODate($("taskRecurrenceAnchorDate")?.value);
  if (!anchor) return;
  const recurrence = normalizeRecurrence($("taskRecurrence")?.value);
  if (recurrence === "weekly") {
    const selected = [...document.querySelectorAll("[data-repeat-weekday]:checked")];
    if (!selected.length) {
      const input = document.querySelector('[data-repeat-weekday][value="' + anchor.getDay() + '"]');
      if (input) input.checked = true;
    }
  }
  if (recurrence === "monthlyDay" && $("taskRecurrenceMonthDay").dataset.manual !== "true") {
    $("taskRecurrenceMonthDay").value = String(anchor.getDate());
  }
  if (recurrence === "monthlyNth") {
    const nth = $("taskRecurrenceNth"), weekday = $("taskRecurrenceWeekday");
    if (nth.dataset.manual !== "true") nth.value = String(getNthWeekInMonth(anchor));
    if (weekday.dataset.manual !== "true") weekday.value = String(anchor.getDay());
  }
}

function syncRecurrenceUi() {
  const recurrence = normalizeRecurrence($("taskRecurrence")?.value || "none");
  const options = $("recurrenceOptions"), weekly = $("weeklyOptions"),
    monthDay = $("monthlyDayOptions"), nth = $("monthlyNthOptions"),
    datesOptions = $("taskRecurrenceDatesOptions"), endOptions = $("taskRecurrenceEndOptions"),
    preview = $("recurrencePreview");
  const explicitDates = recurrence === "dates";
  options.hidden = recurrence === "none";
  weekly.hidden = recurrence !== "weekly";
  monthDay.hidden = recurrence !== "monthlyDay";
  nth.hidden = recurrence !== "monthlyNth";
  datesOptions.hidden = !explicitDates;
  endOptions.hidden = explicitDates;
  $("taskRecurrenceAnchorDate").closest(".recurrence-anchor-field").hidden = explicitDates;
  $("taskRecurrenceInterval").closest(".recurrence-interval-field").hidden =
    explicitDates || recurrence === "weekdays";
  const intervalUnit = { daily: "日", weekly: "週", monthlyDay: "か月",
    monthlyNth: "か月", monthEnd: "か月", lastWeekday: "か月", yearly: "年" };
  $("taskRecurrenceIntervalLabel").textContent =
    "間隔（" + (intervalUnit[recurrence] || "日") + "）";
  const endMode = $("taskRecurrenceEndMode").value;
  $("taskRecurrenceCountRow").hidden = endMode !== "count";
  $("taskRecurrenceEndDateRow").hidden = endMode !== "date";
  if (recurrence === "none") {
    preview.textContent = "繰り返しなし";
    return;
  }

  const rule = getRecurrenceRuleFromForm();
  const note = $("taskRecurrenceEndNote");
  if (explicitDates) {
    note.textContent = "";
  } else if (endMode === "count") {
    note.textContent = "元のタスクを除き、今後の自動作成を最大" + rule.count +
      "件までに制限します。";
  } else if (endMode === "date") {
    note.textContent = "終了日を超える日付のタスクは作成しません。";
  } else {
    note.textContent = "無期限です。完了のたびに次の1件が作成されるため、必要に応じて件数または終了日を設定してください。";
  }

  const error = taskRecurrenceValidationMessage(recurrence, rule);
  if (error) {
    preview.textContent = error;
    return;
  }
  const afterDate = rule.occurrenceDate && rule.occurrenceDate > todayISO()
    ? rule.occurrenceDate : todayISO();
  // Preview uses the SAME termination logic as task creation. Infinite series
  // are always bounded to the next 12 dates on this screen.
  const previewCount = 12;
  const dates = getRecurringDates(recurrence, rule, afterDate, previewCount);
  const wasExpanded = Boolean(preview.querySelector(".recurrence-preview-more[open]"));
  const summary = document.createElement("strong");
  summary.className = "recurrence-preview-kind";
  summary.textContent = describeRecurrence({ recurrence, recurrenceRule: rule });
  const scope = document.createElement("small");
  scope.className = "recurrence-preview-scope";
  if (explicitDates) {
    scope.textContent = "指定日" + rule.selectedDates.length + "件のうち、今後" + dates.length + "件を表示";
  } else if (rule.endMode === "count") {
    const remaining = Math.max(0, rule.count - rule.generatedCount);
    scope.textContent = "自動作成上限" + rule.count + "件（作成済み" + rule.generatedCount +
      "件・残り" + remaining + "件、表示は最大12件）";
  } else if (rule.endMode === "date") {
    scope.textContent = "終了日 " + rule.endDate + " まで（表示は最大12件）";
  } else {
    scope.textContent = "無期限（次の12回分だけを表示）";
  }
  const next = document.createElement("span");
  next.className = "recurrence-preview-first";
  next.textContent = dates.length
    ? "次の繰り返し日：" + formatScheduleCopyDate(dates[0])
    : "終了条件に達したか、今後の予定日がないため、次回の自動作成はありません";
  const nodes = [summary, scope, next];
  if (dates.length > 1) {
    const more = document.createElement("details");
    more.className = "recurrence-preview-more";
    more.open = wasExpanded;
    const toggle = document.createElement("summary");
    const showLabel = document.createElement("span");
    showLabel.className = "recurrence-preview-show-label";
    showLabel.textContent = "残り" + (dates.length - 1) + "件を見る";
    const hideLabel = document.createElement("span");
    hideLabel.className = "recurrence-preview-hide-label";
    hideLabel.textContent = "一覧を閉じる";
    toggle.append(showLabel, hideLabel);
    const list = document.createElement("ol");
    list.className = "recurrence-preview-more-dates";
    list.start = 2;
    list.setAttribute("aria-label", "繰り返し予定日：2回目から" + dates.length + "回目");
    dates.slice(1).forEach((date, index) => {
      const item = document.createElement("li");
      const number = document.createElement("span");
      number.className = "recurrence-preview-date-number";
      number.textContent = String(index + 2);
      number.setAttribute("aria-hidden", "true");
      item.append(number, document.createTextNode(" " + formatScheduleCopyDate(date)));
      list.appendChild(item);
    });
    more.append(toggle, list);
    nodes.push(more);
  }
  preview.replaceChildren(...nodes);
}

function getRecurrenceRuleFromForm() {
  const recurrence = normalizeRecurrence($("taskRecurrence")?.value || "none");
  const anchorDate = $("taskRecurrenceAnchorDate")?.value || todayISO();
  const base = parseISODate(anchorDate) || startOfToday();
  const selectedDates = recurrence === "dates" ? taskRecurrenceDates() : [];
  const rule = {
    interval: clampNumber($("taskRecurrenceInterval")?.value, 1, 36, 1),
    weekdays: [...document.querySelectorAll("[data-repeat-weekday]:checked")].map(input => Number(input.value)),
    nth: $("taskRecurrenceNth")?.value || String(getNthWeekInMonth(base)),
    weekday: clampWeekday($("taskRecurrenceWeekday")?.value ?? base.getDay()),
    monthDay: clampNumber($("taskRecurrenceMonthDay")?.value, 1, 31, base.getDate()),
    anchorDate,
    endMode: recurrence === "dates" ? "dates" : $("taskRecurrenceEndMode").value,
    count: clampNumber($("taskRecurrenceCount").value, 1, SCHEDULE_COPY_MAX, 4),
    endDate: $("taskRecurrenceEndDate").value,
    selectedDates
  };
  if (recurrence === "weekly" && !rule.weekdays.length) rule.weekdays = [base.getDay()];
  const existingId = $("taskId")?.value || "";
  const existing = readTaskDialogBase(existingId)?.task;
  return taskRecurrenceRuleFromValues(recurrence, rule, existing, existingId);
}

// Shared calendar-edit semantics for Classic and Origin. Display code never
// resets a series counter merely because its termination condition changed.
function taskRecurrenceRuleFromValues(recurrence, rule, existing, existingId) {
  const anchorDate = rule.anchorDate;
  const selectedDates = rule.selectedDates || [];
  const previous = normalizeRecurrenceRule(recurrence, existing?.recurrenceRule || {},
    existing?.recurrenceRule?.anchorDate || anchorDate);
  // End-mode/count edits do not reset the cycle or previously generated count.
  // Changing the actual calendar cadence starts a new independent series.
  const sameSettings = Boolean(existing) && normalizeRecurrence(existing.recurrence) === recurrence
    && ["interval", "nth", "weekday", "monthDay", "anchorDate"].every(key => String(previous[key]) === String(rule[key]))
    && JSON.stringify([...(previous.weekdays || [])].sort()) === JSON.stringify([...rule.weekdays].sort())
    && JSON.stringify(previous.selectedDates || []) === JSON.stringify(selectedDates);
  return normalizeRecurrenceRule(recurrence, {
    ...rule,
    occurrenceDate: sameSettings ? previous.occurrenceDate : "",
    seriesId: sameSettings ? previous.seriesId || existingId : existingId,
    generatedCount: sameSettings ? previous.generatedCount : 0
  }, anchorDate);
}

function describeRecurrence(task) {
  const recurrence = normalizeRecurrence(task?.recurrence || "none");
  if (recurrence === "none") return "なし";
  const rule = normalizeRecurrenceRule(recurrence, task?.recurrenceRule || {}, todayISO());
  const anchor = parseISODate(rule.anchorDate) || startOfToday();
  const interval = rule.interval || 1;
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  if (recurrence === "dates") return "指定日（" + rule.selectedDates.length + "件）";
  if (recurrence === "daily") return interval > 1 ? interval + "日ごと" : "毎日";
  if (recurrence === "weekdays") return "平日（月〜金）";
  if (recurrence === "weekly") return (interval > 1 ? interval + "週ごと " : "毎週 ") +
    (rule.weekdays || [anchor.getDay()]).map(day => weekdays[day]).join("・") + "曜";
  if (recurrence === "monthlyDay") return (interval > 1 ? interval + "か月ごと " : "毎月 ") + rule.monthDay + "日";
  if (recurrence === "monthlyNth") return (interval > 1 ? interval + "か月ごと " : "毎月 ") +
    (rule.nth === "last" ? "最終" : "第" + rule.nth) + weekdays[rule.weekday] + "曜日";
  if (recurrence === "monthEnd") return (interval > 1 ? interval + "か月ごと " : "毎月 ") + "月末";
  if (recurrence === "lastWeekday") return (interval > 1 ? interval + "か月ごと " : "毎月 ") + "最終平日";
  if (recurrence === "yearly") return (interval > 1 ? interval + "年ごと " : "毎年 ") +
    (anchor.getMonth() + 1) + "/" + anchor.getDate();
  return "定期";
}

function describeRecurrenceEnd(task) {
  const recurrence = normalizeRecurrence(task?.recurrence || "none");
  if (recurrence === "none") return "なし";
  const rule = normalizeRecurrenceRule(recurrence, task?.recurrenceRule || {}, todayISO());
  if (recurrence === "dates") return "指定日 " + rule.selectedDates.length + "件で終了";
  if (rule.endMode === "count") return "自動作成 " + rule.count +
    "件まで（作成済み " + rule.generatedCount + "件）";
  if (rule.endMode === "date") return rule.endDate + " まで";
  return "無期限（終了条件なし）";
}

// Reuse the existing calendar planner while preserving the original cycle
// phase, even when a repeated task is completed ahead of time or late.
function getRecurringDates(recurrence, rule = {}, afterDate = todayISO(), count = 1) {
  const method = normalizeRecurrence(recurrence);
  if (method === "none") return [];
  const normalized = normalizeRecurrenceRule(method, rule, todayISO());
  const after = parseISODate(afterDate) || startOfToday();
  // Both preview and completion use this one limiter. A finite series must
  // never generate beyond its committed count or the specified last date.
  if (normalized.endMode === "date" && !validRecurrenceDate(normalized.endDate)) return [];
  const remaining = normalized.endMode === "count"
    ? Math.max(0, normalized.count - normalized.generatedCount) : SCHEDULE_COPY_MAX;
  const requested = Math.min(clampNumber(count, 1, 20, 1), remaining);
  if (!requested) return [];
  if (method === "dates") {
    return normalized.selectedDates
      .filter(date => date > toISODate(after) && (normalized.endMode !== "date" || date <= normalized.endDate))
      .slice(0, requested);
  }
  const anchor = parseISODate(normalized.anchorDate);
  if (!anchor) return [];
  const lowerBound = new Date(Math.max(anchor.getTime(), addDays(after, 1).getTime()));
  let start = lowerBound;
  const interval = normalized.interval;
  if (method === "daily") {
    const days = Math.max(0, scheduleCopyDateSerial(lowerBound) - scheduleCopyDateSerial(anchor));
    start = addDays(anchor, Math.ceil(days / interval) * interval);
  } else if (method === "weekly") {
    const anchorWeek = startOfWeekMonday(anchor);
    const lowerWeek = startOfWeekMonday(lowerBound);
    const weeks = Math.max(0, Math.round((scheduleCopyDateSerial(lowerWeek) - scheduleCopyDateSerial(anchorWeek)) / 7));
    const alignedWeek = addDays(anchorWeek, Math.ceil(weeks / interval) * interval * 7);
    start = alignedWeek > lowerBound ? alignedWeek : lowerBound;
  } else if (["monthlyDay", "monthlyNth", "monthEnd", "lastWeekday"].includes(method)) {
    const months = Math.max(0, (lowerBound.getFullYear() - anchor.getFullYear()) * 12
      + lowerBound.getMonth() - anchor.getMonth());
    const alignedMonth = new Date(anchor.getFullYear(), anchor.getMonth() + Math.ceil(months / interval) * interval, 1);
    start = alignedMonth > lowerBound ? alignedMonth : lowerBound;
  } else if (method === "yearly") {
    const years = Math.max(0, lowerBound.getFullYear() - anchor.getFullYear());
    const alignedYear = new Date(anchor.getFullYear() + Math.ceil(years / interval) * interval, 0, 1);
    start = alignedYear > lowerBound ? alignedYear : lowerBound;
  }
  const plan = buildScheduleCopyDates({ startAt: normalized.anchorDate + "T12:00:00" }, {
    method,
    startDate: toISODate(start),
    interval,
    weekdays: normalized.weekdays,
    monthDay: normalized.monthDay,
    nth: normalized.nth,
    nthWeekday: normalized.weekday,
    endMode: "count",
    count: requested,
    selectedDates: []
  });
  if (plan.error) return [];
  return normalized.endMode === "date"
    ? plan.dates.filter(date => date <= normalized.endDate) : plan.dates;
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

function getNthMondayDayOfMonth(year, month, nth) {
  const first = new Date(year, month - 1, 1);
  const offset = (8 - first.getDay()) % 7;
  return 1 + offset + (nth - 1) * 7;
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

  if (m === 1 && d === getNthMondayDayOfMonth(y, 1, 2)) return "成人の日";
  if (m === 7 && d === getNthMondayDayOfMonth(y, 7, 3)) return "海の日";
  if (m === 9 && d === getNthMondayDayOfMonth(y, 9, 3)) return "敬老の日";
  if (m === 10 && d === getNthMondayDayOfMonth(y, 10, 2)) return "スポーツの日";

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

  add(1, getNthMondayDayOfMonth(year, 1, 2), "成人の日");
  add(7, getNthMondayDayOfMonth(year, 7, 3), "海の日");
  add(9, getNthMondayDayOfMonth(year, 9, 3), "敬老の日");
  add(10, getNthMondayDayOfMonth(year, 10, 2), "スポーツの日");
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
  // The single shared notification belongs to the current display theme.
  // Clear any older inline background so light, pastel, pure and dark modes
  // all use the same semantic theme surface without a hardcoded blue fill.
  elements.toast.style.removeProperty('background');
  elements.toast.classList.toggle('is-error', Boolean(error));
  elements.toast.setAttribute('role', error ? 'alert' : 'status');
  elements.toast.setAttribute('aria-live', error ? 'assertive' : 'polite');
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => elements.toast.hidden = true, 3200);
}

/* Palette NEXT Phase 1 — narrow public boundary over canonical in-module state.
   The independent Palette DOM never scrapes Classic markup or writes to Firebase.
   Only existing business functions below own validation, revisions and persistence. */
const paletteNextSubscribers = new Set();
let paletteNextNotifyPending = false;

function paletteNextSnapshot() {
  const currentUser = getCurrentUser();
  const todos = visibleTodos();
  const openTasks = state.tasks.filter(task => !isCompletedStatus(task.status)
    && normalizeText(task.status) !== normalizeText("保留"));
  const focusTasks = [...openTasks.filter(task => isOverdue(task) || isDueToday(task)),
    ...openTasks.filter(task => !isOverdue(task) && !isDueToday(task))]
    .sort(compareSmartTasks).slice(0, 3);
  return {
    focusTaskIds: focusTasks.map(task => task.id),
    // One canonical boundary for title/memo limits across all presentations.
    todoTitleMaxLength: TODO_MAX_LENGTH,
    todoMemoMaxLength: TODO_MEMO_MAX_LENGTH,
    roomId: ROOM_ID,
    roomName: state.roomName || '',
    currentUser,
    connectionMode: state.connectionMode,
    today: todayISO(),
    users: state.users.map(user => String(user)),
    assignees: getAssigneeOptions().map(value => String(value)),
    statuses: getStatusList().map(status => String(status)),
    categories: [...state.categories],
    templates: state.taskTemplates.map(item=>({...item})),
    templateRevision: normalizeRevision(state.metaRevisions.taskTemplates),
    management:{users:[...state.users],categories:[...state.categories],statuses:getStatusList({includeTaskOnly:false}),protectedStatuses:getStatusList({includeTaskOnly:false}).filter(isProtectedDeleteStatus),colors:{...state.userColors}},
    knowledge: state.knowledge.map(item=>({...item})),
    tasks: state.tasks.map(task => ({
      id: task.id, title: task.title, status: task.status, priority: task.priority,
      category: task.category, assignee: task.assignee, requester: task.requester || '',
      dueDate: task.dueDate || '', dueTime: task.dueTime || '',
      description: task.description || '', requester: task.requester || '',
      tags: [...(task.tags || [])], checklist: (task.checklist || []).map(item => ({ text: item.text, done: Boolean(item.done) })),
      history: (task.history || []).slice(-5).map(h => ({ text: String(h.text || ''), author: String(h.author || ''), createdAt: Number(h.createdAt) || 0 })),
      recurrence: task.recurrence || 'none', recurrenceRule: {...task.recurrenceRule}, hasSeries:isRecurringDeleteCandidate('task',task),knowledgeId:task.knowledgeId||'', pinned: Boolean(task.pinned),
      favorite: isTaskStarred(task.id), completed: isCompletedStatus(task.status),
      revision: task.revision, updatedAt: task.updatedAt || 0
    })),
    todos: todos.map(todo => ({
      id: todo.id, text: todo.text, memo: todo.memo || '',
      completed: Boolean(todo.completed), completedAt: todo.completedAt || 0,
      order: todo.order, revision: todo.revision
    })),
    schedules: state.schedules.map(item => ({
      id: item.id, title: item.title, startAt: item.startAt,
      endAt: item.endAt, location: item.location || '', memo: item.memo || '',
      category: item.category || '', assignee: item.assignee || '',
      relatedTaskId: item.relatedTaskId || '', revision: item.revision,
      recurrenceSeriesId: item.recurrenceSeriesId || '', recurrenceDate: item.recurrenceDate || ''
    })),
    notices: getActivityItems().slice(0, 16).map(item => ({
      id: item.id, title: item.title, kind: item.kind,
      action: item.action || '', at: item.at || 0,
      important: Boolean(item.important), summary: item.changeSummary || ''
    }))
  };
}

function notifyPaletteNextSubscribers() {
  if (!paletteNextSubscribers.size || paletteNextNotifyPending) return;
  paletteNextNotifyPending = true;
  queueMicrotask(() => {
    paletteNextNotifyPending = false;
    if (!paletteNextSubscribers.size) return;
    const snapshot = paletteNextSnapshot();
    for (const listener of paletteNextSubscribers) {
      try { listener(snapshot); }
      catch (error) { console.error('Palette NEXT subscriber failed', error); }
    }
  });
}

// Palette NEXT schedule adapter: existing state and business functions remain
// the single source of truth for dates, recurrence generation, CAS writes and
// linked-task safety. No Classic form nodes or second Firebase client.
function paletteScheduleOwnerV372(command) {
  return String(command.ownerRoom || "") === ROOM_ID
    && String(command.ownerUser || "") === getCurrentUser();
}

function originTaskRecurrence(command, existing = null) {
  const recurrence = String(command.recurrence ?? existing?.recurrence ?? 'none');
  if (normalizeRecurrence(recurrence) !== recurrence) return {error:'invalid-input'};
  const raw = command.recurrenceRule || existing?.recurrenceRule || {};
  const rule = normalizeRecurrenceRule(recurrence, raw, todayISO());
  if (recurrence !== 'none' && (!validRecurrenceDate(raw.anchorDate)
    || !Number.isInteger(Number(raw.interval)) || raw.interval < 1 || raw.interval > 36
    || !['count','date','unlimited','dates'].includes(raw.endMode)
    || (recurrence === 'weekly' && (!Array.isArray(raw.weekdays) || !raw.weekdays.length
      || raw.weekdays.some(x=>!Number.isInteger(x)||x<0||x>6)))
    || (recurrence === 'dates' && (!Array.isArray(raw.selectedDates)
      || raw.selectedDates.length > SCHEDULE_COPY_MAX || raw.selectedDates.some(x=>!validRecurrenceDate(x))))))
    return {error:'invalid-input'};
  const message = validateTaskRecurrenceValues(recurrence, {...rule,count:raw.count}, !existing);
  if (message) return {error:'invalid-input',detail:message};
  return {recurrence,rule:taskRecurrenceRuleFromValues(recurrence,rule,existing,existing?.id||'')};
}

function paletteScheduleCopyConfigV372(raw = {}) {
  const method = String(raw.method || "once");
  const permitted = ["once","dates","daily","weekdays","weekly",
    "monthlyDay","monthlyNth","monthEnd","lastWeekday","yearly"];
  if (!permitted.includes(method)) return { error: "invalid-method" };
  const interval = Number(raw.interval ?? 1);
  const count = Number(raw.count ?? 4);
  if (!Number.isSafeInteger(interval) || interval < 1 || interval > 36
    || !Number.isSafeInteger(count) || count < 1 || count > SCHEDULE_COPY_MAX)
    return { error: "invalid-copy-count" };
  const startDate = String(raw.startDate || "");
  const endDate = String(raw.endDate || "");
  const validDate = str => /^\d{4}-\d{2}-\d{2}$/.test(str)
    && !!parseISODate(str) && toISODate(parseISODate(str)) === str;
  if (method !== "dates" && !validDate(startDate)) return { error: "invalid-start-date" };
  if (raw.endMode === "date" && !validDate(endDate)) return { error: "invalid-end-date" };
  const selectedDates = String(raw.selectedDates || "")
    .split(/[\s,、，;；]+/).filter(Boolean);
  if (method === "dates" && (!selectedDates.length
    || selectedDates.length > SCHEDULE_COPY_MAX
    || selectedDates.some(date => !validDate(date)))) return { error: "invalid-dates" };
  const weekdays = (Array.isArray(raw.weekdays) ? raw.weekdays : [])
    .map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
  if (method === "weekly" && !weekdays.length) return { error: "invalid-weekdays" };
  const monthDay = Number(raw.monthDay ?? 1);
  const nthWeekday = Number(raw.nthWeekday ?? 1);
  const nth = raw.nth === "last" ? "last" : Number(raw.nth || 1);
  if (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31
    || !Number.isInteger(nthWeekday) || nthWeekday < 0 || nthWeekday > 6
    || (nth !== "last" && (!Number.isInteger(nth) || nth < 1 || nth > 5)))
    return { error: "invalid-copy-config" };
  return {
    config:{
      method, interval, count, startDate, endDate,
      endMode: raw.endMode === "date" ? "date" : "count",
      selectedDates, weekdays, monthDay, nthWeekday, nth
    }
  };
}

function validatePaletteScheduleValuesV372(values, existing = null) {
  const title=String(values.title || "").trim();
  const assignee=String(values.assignee || "");
  const category=String(values.category || "");
  const relatedId=String(values.relatedTaskId || "");
  if (!title || title.length > 80
    || String(values.memo || "").length > 1000
    || String(values.location || "").length > 60
    || !getAssigneeOptions().concat(existing?.assignee || []).includes(assignee)
    || !state.categories.concat(existing?.category || []).includes(category)
    || (relatedId && relatedId !== existing?.relatedTaskId
      && !state.tasks.some(item=>item.id === relatedId)))
    return {ok:false,error:"invalid-input"};
  return {ok:true};
}

function paletteScheduleSourceV372(command) {
  if (!paletteScheduleOwnerV372(command))
    return { error: "owner-mismatch" };
  const type = String(command.type || "");
  const copying = type === "schedule.copy" || type === "schedule.preview-copy";
  const id = String(command.id || "");
  if (copying) {
    const existing = state.schedules.find(item => item.id === id);
    if (!existing) return { error: "not-found" };
    if (!Number.isSafeInteger(Number(command.revision))
      || normalizeRevision(existing.revision) !== Number(command.revision))
      return { error: "revision-or-relation-mismatch" };
    return { source: existing, sourceIsDraft: false };
  }
  if (id) return { error: "invalid-id" };
  const validation=validatePaletteScheduleValuesV372(command.values || {});
  if (!validation.ok) return {error:validation.error};
  const build = buildScheduleDraftFromValuesV372(command.values || {},
    "preview-" + generateScheduleId(), null, 0);
  if (build.error) return { error: "invalid-input", detail: build.error };
  return { source: build.schedule, sourceIsDraft: true };
}

function previewPaletteScheduleCopyV372(command) {
  const parsed = paletteScheduleSourceV372(command);
  if (parsed.error) return { ok: false, error: parsed.error, detail: parsed.detail };
  const config = paletteScheduleCopyConfigV372(command.copyConfig || {});
  if (config.error) return { ok: false, error: config.error };
  const result = buildScheduleCopyDates(parsed.source, config.config);
  if (result.error || result.truncated || result.dates.length > SCHEDULE_COPY_MAX)
    return { ok:false, error:result.error || "too-many-occurrences" };
  const overlaps = scheduleCopyConflicts(parsed.source, result.dates);
  return {
    ok:true, dates:result.dates,
    conflicts:overlaps.map(item=>({
      date:item.date, title:item.conflict?.title || "既存予定"
    })),
    sourceIsDraft:parsed.sourceIsDraft, count:result.dates.length
  };
}

async function writePaletteScheduleV372(command) {
  if (!paletteScheduleOwnerV372(command))
    return { ok:false, error:"owner-mismatch" };
  const editing = command.type === "schedule.update";
  const id = editing ? String(command.id || "") : generateScheduleId();
  const existing = editing ? state.schedules.find(item=>item.id === id) : null;
  const revision = Number(command.revision);
  if (editing && !existing) return { ok:false, error:"not-found" };
  if (!editing && command.id) return { ok:false, error:"invalid-id" };
  if (!Number.isSafeInteger(revision) || revision < 0
    || (editing && normalizeRevision(existing.revision) !== revision)
    || (!editing && revision !== 0))
    return { ok:false, error:"revision-or-relation-mismatch" };
  const values = command.values || {};
  const validation=validatePaletteScheduleValuesV372(values,existing);
  if (!validation.ok) return validation;
  const built = buildScheduleDraftFromValuesV372(values, id, existing, revision);
  if (built.error) return { ok:false, error:"invalid-input",detail:built.error };
  const schedule = built.schedule;
  const conflicts = getScheduleConflicts(schedule);
  if (conflicts.length) {
    const conflictsText = conflicts.slice(0,3)
      .map(item=>formatScheduleTime(item.startAt)+"〜"+formatScheduleTime(item.endAt)+" "+item.title)
      .join("\n");
    if (!confirm("同じ担当者の予定と時間が重なっています。\n\n"
      + conflictsText + "\n\nこのまま保存しますか？"))
      return { ok:false, error:"cancelled" };
  }
  if (!paletteScheduleOwnerV372(command)
    || (editing && normalizeRevision(state.schedules.find(item=>item.id===id)?.revision) !== revision))
    return { ok:false, error:"revision-or-relation-mismatch" };
  schedule.lastChange = makeScheduleChangeInfo(existing, schedule);
  const result = await persistSchedule(schedule);
  return result.ok ? { ok:true, id } : result;
}

async function copyPaletteScheduleV372(command) {
  const preview = previewPaletteScheduleCopyV372({
    ...command,
    type: command.type === "schedule.copy" ? "schedule.preview-copy" : "schedule.preview-batch"
  });
  if (!preview.ok) return preview;
  if (preview.count >= SCHEDULE_COPY_LARGE_WARNING
    || preview.conflicts.length) {
    const samples = preview.conflicts.slice(0, 4)
      .map(item=>item.date+"："+item.title).join("\n");
    const warning = preview.conflicts.length
      ? "\n重複する予定："+preview.conflicts.length+"件\n"+samples : "";
    if (!confirm(preview.count+"件の予定をまとめて登録します。"+warning+"\n実行しますか？"))
      return { ok:false, error:"cancelled" };
  }
  const parsed = paletteScheduleSourceV372({
    ...command,
    type:command.type === "schedule.copy" ? "schedule.preview-copy" : "schedule.preview-batch"
  });
  if (parsed.error) return {ok:false,error:parsed.error};
  if (!paletteScheduleOwnerV372(command)) return {ok:false,error:"owner-mismatch"};
  const result = await copyScheduleOccurrences(parsed.source, preview.dates, parsed.sourceIsDraft);
  return result.ok ? {ok:true,count:preview.count} : result;
}

// Palette NEXT shares the canonical business writers, including optimistic
// revisions, history and recurring-task idempotency; no second data owner.
async function savePaletteNextTaskV370(command) {
  const editing = command.type === 'task.update';
  if (String(command.ownerRoom || '') !== ROOM_ID
    || String(command.ownerUser || '') !== getCurrentUser())
    return { ok: false, error: 'owner-mismatch' };
  const id = editing ? String(command.id || '') : generateId();
  const existing = editing ? state.tasks.find(item => item.id === id) : null;
  if (editing && !existing) return { ok: false, error: 'not-found' };
  if (!editing && command.id) return { ok: false, error: 'invalid-id' };
  const expectedRevision = Number(command.revision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || (editing && normalizeRevision(existing.revision) !== expectedRevision)
    || (!editing && expectedRevision !== 0))
    return { ok: false, error: 'revision-or-relation-mismatch' };
  const title = String(command.title || '').trim();
  const description = String(command.description || '').trim();
  const requester = String(command.requester || '').trim();
  const tagsRaw = String(command.tags || '');
  const checklistText = String(command.checklist || '');
  const assignee = String(command.assignee || getCurrentUser());
  const status = String(command.status || getDefaultOpenStatus());
  const priority = String(command.priority || '中');
  const category = String(command.category || state.categories[0] || 'その他');
  const dueDate = String(command.dueDate || '');
  const dueTime = String(command.dueTime || '');
  const parsedDate = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? parseISODate(dueDate) : null;
  if (!title || title.length > 80 || requester.length > 40 || tagsRaw.length > 80
    || description.length > 6000 || checklistText.length > 6000
    || !getAssigneeOptions().concat(existing?.assignee || []).includes(assignee)
    || !getStatusList().includes(status)
    || !['緊急','高','中','低'].includes(priority)
    || !state.categories.concat(existing?.category || []).includes(category)
    || (dueDate && (!parsedDate || toISODate(parsedDate) !== dueDate))
    || (dueTime && !/^\d{2}:\d{2}$/.test(dueTime)))
    return { ok: false, error: 'invalid-input' };
  const parsedChecklist = parseChecklist(checklistText, existing?.checklist || []);
  if (command.checklistDone !== undefined) {
    if (!Array.isArray(command.checklistDone) || command.checklistDone.length !== parsedChecklist.length
      || command.checklistDone.some(value => typeof value !== 'boolean'))
      return { ok: false, error: 'invalid-input' };
    parsedChecklist.forEach((item,index) => { item.done = command.checklistDone[index]; });
  }
  const recurrenceConfig = command.recurrence === undefined
    ? {recurrence:existing?.recurrence||'none',rule:existing?.recurrenceRule||{}}
    : originTaskRecurrence(command,existing);
  if (recurrenceConfig.error) return {ok:false,...recurrenceConfig};
  const now = Date.now();
  const draft = normalizeTask({
    ...existing, id, title, description, assignee, status, priority, category,
    dueDate, dueTime, requester, tags: splitTags(tagsRaw),
    checklist: parsedChecklist,
    pinned: Boolean(command.pinned),
    recurrence: recurrenceConfig.recurrence,
    recurrenceRule: recurrenceConfig.rule,
    comments: existing?.comments || [], history: existing?.history || [],
    nextRecurringTaskId: existing?.nextRecurringTaskId || '',
    revision: existing?.revision || 0,
    createdBy: existing?.createdBy || getCurrentUser(),
    createdAt: existing?.createdAt || now,
    updatedBy: getCurrentUser(), updatedAt: now,
    completedAt: isCompletedStatus(status) ? (existing?.completedAt || now) : 0,
    completedMemo: isCompletedStatus(status) ? (existing?.completedMemo || '') : '',
    knowledgeId: existing?.knowledgeId || ''
  });
  const change = makeTaskChangeInfo(existing, draft);
  draft.lastChange = change;
  draft.history = appendHistory(draft.history,
    existing ? (change.historyText || summarizeTaskChanges(existing, draft))
      : 'タスクを作成しました。');
  const result = editing
    ? await commitTaskDraft('task-form', existing, draft)
    : await persistTask(draft);
  return result.ok ? { ok: true, id } : result;
}

window.WorkBoardPaletteBridge = Object.freeze({
  readSnapshot: paletteNextSnapshot,
  // Comment UI reads the canonical subscribed task, not an optional browser
  // cache. Return only the needed fields as a copy; Classic owns all writes.
  readCommentTask(taskId) {
    const task = state.tasks.find(item => item.id === String(taskId || ''));
    if (!task) return null;
    return {
      id: task.id,
      revision: task.revision,
      comments: JSON.parse(JSON.stringify(task.comments || []))
    };
  },
  // Delegate Palette's user selector to the existing Classic user lifecycle.
  // This selects an application user, not an authentication identity.
  selectUser(value) {
    const next = String(value || '');
    if (!state.users.includes(next)) return { ok: false, error: 'unknown-user' };
    const previous = getCurrentUser();
    if (next !== previous) setCurrentUser(next);
    return { ok: true, user: getCurrentUser(), changed: next !== previous };
  },
  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('onChange must be a function');
    paletteNextSubscribers.add(listener);
    listener(paletteNextSnapshot());
    return () => { paletteNextSubscribers.delete(listener); };
  },
  async dispatch(command = {}) {
    const id = String(command.id || '');
    let result;
    switch (command.type) {
      case 'todo.create':
        result = await createTodo(command.text, command.memo || '', command);
        break;
      case 'todo.toggle':
        result = await toggleTodo(id);
        break;
      case 'todo.update':
        result = await updateTodoDetails(id, command.text, command.memo || '', command);
        break;
      case 'todo.delete':
        result = await deleteTodo(id, command);
        break;
      case 'todo.move':
        result = await reorderTodo(id, command.direction === 'up' ? -1 : 1,
          command.segment === 'completed' ? 'completed' : 'open');
        break;
      case 'task.create':
      case 'task.update':
        result = await savePaletteNextTaskV370(command);
        break;
      case 'task.preview-recurrence': {
        if (!paletteScheduleOwnerV372(command)) return {ok:false,error:'owner-mismatch'};
        const existing = id ? state.tasks.find(item=>item.id===id) : null;
        if (id && (!existing || normalizeRevision(existing.revision)!==command.revision))
          return {ok:false,error:'revision-or-relation-mismatch'};
        const config=originTaskRecurrence(command,existing);
        if (config.error) return {ok:false,...config};
        const after=config.rule.occurrenceDate>todayISO()?config.rule.occurrenceDate:todayISO();
        return {ok:true,dates:getRecurringDates(config.recurrence,config.rule,after,12),
          description:describeRecurrence({recurrence:config.recurrence,recurrenceRule:config.rule})};
      }
      case 'series.preview-delete': {
        if (!paletteScheduleOwnerV372(command)) return {ok:false,error:'owner-mismatch'};
        const kind=command.kind==='events'?'schedule':'task';
        const selection=captureRecurringDelete(kind,rawRecurringDeleteRoot(),id);
        if(!selection||selection.fingerprints[id]?.revision!==command.revision)
          return {ok:false,error:'revision-or-relation-mismatch'};
        const token=generateId();
        originRecurringDeleteSelections.set(token,{selection,user:getCurrentUser(),room:ROOM_ID});
        if(originRecurringDeleteSelections.size>10)originRecurringDeleteSelections.delete(originRecurringDeleteSelections.keys().next().value);
        return {ok:true,token,counts:Object.fromEntries(['one','following','all'].map(scope=>[scope,recurringDeleteTargets(selection,scope).length]))};
      }
      case 'series.delete': {
        const pending=originRecurringDeleteSelections.get(command.token);
        if(!paletteScheduleOwnerV372(command)||!pending||pending.user!==getCurrentUser()||pending.room!==ROOM_ID)
          return {ok:false,error:'owner-mismatch'};
        if(!['one','following','all'].includes(command.scope))return {ok:false,error:'invalid-input'};
        result=await commitRecurringDelete(pending.selection,command.scope);
        if(result?.ok)originRecurringDeleteSelections.delete(command.token);
        break;
      }
      case 'template.save':
      case 'template.delete': {
        if (!paletteScheduleOwnerV372(command)) return {ok:false,error:'owner-mismatch'};
        if (!Number.isSafeInteger(command.revision)
          || command.revision!==normalizeRevision(state.metaRevisions.taskTemplates))
          return {ok:false,error:'revision-or-relation-mismatch'};
        const existing=state.taskTemplates.find(item=>item.id===id);
        if (id&&!existing) return {ok:false,error:'not-found'};
        const values=command.values||{};
        if (command.type==='template.save' && (!String(values.name||'').trim()
          || !String(values.title||'').trim() || String(values.name).length>30
          || String(values.title).length>80 || String(values.description||'').length>6000
          || String(values.checklist||'').length>6000)) return {ok:false,error:'invalid-input'};
        const template=normalizeTemplate({...values,id:id||generateTemplateId()});
        let templates=command.type==='template.delete'?state.taskTemplates.filter(x=>x.id!==id)
          :existing?state.taskTemplates.map(x=>x.id===id?template:x):[...state.taskTemplates,template];
        if (!templates.length) templates=DEFAULT_TASK_TEMPLATES.map(normalizeTemplate);
        result=await persistMetaFields({taskTemplates:templates,taskTemplatesUpdatedAt:Date.now()});
        if (result?.ok){setTaskTemplates(templates,{persist:false,silent:true});result={ok:true,id:template.id};}
        break;
      }
      case 'knowledge.save': {
        if(!paletteScheduleOwnerV372(command))return {ok:false,error:'owner-mismatch'};
        const raw=command.values||{},v=Object.fromEntries(['title','summary','symptom','action','checkpoint'].map(k=>[k,String(raw[k]||'')])),existing=state.knowledge.find(x=>x.id===id);
        if(!String(v.title||'').trim()||!String(v.action||'').trim()
          ||String(v.title).length>80||['summary','symptom','action','checkpoint'].some(k=>String(v[k]||'').length>6000))return {ok:false,error:'invalid-input'};
        if(id){
          if(!existing||existing.revision!==command.revision)return {ok:false,error:'revision-or-relation-mismatch'};
          result=await persistKnowledge(normalizeKnowledge({...existing,...v,id,taskId:existing.taskId,revision:existing.revision}));
        }else{
          const task=state.tasks.find(x=>x.id===command.taskId);
          if(!task||task.revision!==command.taskRevision||task.knowledgeId)return {ok:false,error:'revision-or-relation-mismatch'};
          result=await createKnowledgeFromTask(task.id,v);
        }
        break;
      }
      case 'knowledge.delete': {
        if(!paletteScheduleOwnerV372(command))return {ok:false,error:'owner-mismatch'};
        const record=state.knowledge.find(x=>x.id===id),task=state.tasks.find(x=>x.knowledgeId===id);
        if(!record||record.revision!==command.revision)return {ok:false,error:'revision-or-relation-mismatch'};
        if(task)result=await unlinkKnowledgeFromTask(task.id);
        else {if(!confirm('このナレッジを削除しますか？'))return {ok:false,error:'cancelled'};result=await executeWrite('knowledge-delete',id,()=>transactionRecord('knowledge',id,command.revision,()=>null));}
        break;
      }
      case 'management.write': {
        if(!paletteScheduleOwnerV372(command))return {ok:false,error:'owner-mismatch'};
        const group=command.group,action=command.action;
        const values=group==='users'?state.users:group==='categories'?state.categories:group==='statuses'?getStatusList({includeTaskOnly:false}):null;
        if(!values||JSON.stringify(values)!==command.base)return {ok:false,error:'revision-or-relation-mismatch'};
        const sanitize=group==='users'?sanitizeUser:group==='categories'?sanitizeCategory:sanitizeStatus;
        const name=sanitize(command.name),next=sanitize(command.next);
        if(action==='add'&&(!name||values.some(x=>normalizeText(x)===normalizeText(name))))return {ok:false,error:'invalid-input'};
        if(action!=='add'&&!values.includes(name))return {ok:false,error:'not-found'};
        if(action==='rename'&&(!next||values.some(x=>x!==name&&normalizeText(x)===normalizeText(next))))return {ok:false,error:'invalid-input'};
        if(group==='statuses'&&((action==='delete'&&isProtectedDeleteStatus(name))||(action==='rename'&&isCompletedStatus(name))))return {ok:false,error:'protected-status'};
        if(action==='delete'&&values.length<=1)return {ok:false,error:'invalid-input'};
        if(action==='add')result=group==='users'?await addUserFromForm(name,'#7c5cff'):group==='categories'?await addCategoryFromForm(name):await addStatusFromForm(name);
        else if(action==='delete')result=group==='users'?await deleteUser(name):group==='categories'?await deleteCategory(name):await deleteStatus(name);
        else if(action==='rename'&&group!=='users')result=group==='categories'?await renameCategory(name,next):await renameStatus(name,next);
        else if(action==='move'&&values.includes(next))result=group==='users'?await reorderUsers(name,next):group==='categories'?await reorderCategories(name,next):await reorderStatuses(name,next);
        else return {ok:false,error:'unsupported-action'};
        break;
      }
      case 'schedule.create':
      case 'schedule.update':
        result = await writePaletteScheduleV372(command);
        break;
      case 'schedule.preview-copy':
      case 'schedule.preview-batch':
        return previewPaletteScheduleCopyV372(command);
      case 'schedule.copy':
      case 'schedule.batch':
        result = await copyPaletteScheduleV372(command);
        break;
      case 'schedule.delete': {
        if (!paletteScheduleOwnerV372(command)) return {ok:false,error:'owner-mismatch'};
        const existing = state.schedules.find(item=>item.id === id);
        if (!existing) return {ok:false,error:'not-found'};
        const revision = Number(command.revision);
        if (!Number.isSafeInteger(revision)
          || normalizeRevision(existing.revision) !== revision)
          return {ok:false,error:'revision-or-relation-mismatch'};
        // Series deletion requires the existing scoped series dialog and its
        // semantic fingerprints. Never silently delete one member here.
        if (isRecurringDeleteCandidate('schedule',existing))
          return {ok:false,error:'series-requires-classic'};
        if (!confirm('「'+existing.title+'」を削除しますか？'))
          return {ok:false,error:'cancelled'};
        result = await deleteSchedule(id,revision);
        break;
      }
      case 'task.star':
        if (!state.tasks.some(item => item.id === id)) return { ok: false, error: 'not-found' };
        toggleTaskFavorite(id);
        result = { ok: true };
        break;
      case 'task.duplicate': {
        if (!paletteScheduleOwnerV372(command)) return {ok:false,error:'owner-mismatch'};
        const task = state.tasks.find(item => item.id === id);
        if (!task || !Number.isSafeInteger(command.revision)
          || normalizeRevision(task.revision) !== command.revision)
          return {ok:false,error:'revision-or-relation-mismatch'};
        result = await duplicateTask(id);
        break;
      }
      case 'task.comment': {
        // Origin owns presentation; the existing comment writer owns persistence.
        if (!paletteScheduleOwnerV372(command)) return {ok:false,error:'owner-mismatch'};
        const task = state.tasks.find(item => item.id === id);
        if (!task || !Number.isSafeInteger(command.revision)
          || normalizeRevision(task.revision) !== command.revision)
          return {ok:false,error:'revision-or-relation-mismatch'};
        const text = String(command.text || '').trim();
        if (!text || text.length > 6000
          || !['作業メモ','業者回答','確認依頼','申し送り'].includes(command.commentType))
          return {ok:false,error:'invalid-input'};
        result = await addComment(id, text, command.commentType, {replyTo:command.replyTo||''});
        break;
      }
      case 'task.bulk.update':
      case 'task.bulk.complete': {
        // Validate the caller's ownership and every original revision before
        // entering the existing atomic, CAS-checked bulk write.
        if (String(command.ownerRoom || '') !== ROOM_ID
          || String(command.ownerUser || '') !== getCurrentUser())
          return { ok: false, error: 'owner-mismatch' };
        const items = Array.isArray(command.items) ? command.items : [];
        if (!items.length || items.length > 200
          || items.some(item => !item || typeof item.id !== 'string'
            || !Number.isSafeInteger(item.revision) || item.revision < 0))
          return { ok: false, error: 'invalid-bulk-selection' };
        const ids = items.map(item => item.id);
        if (new Set(ids).size !== ids.length)
          return { ok: false, error: 'duplicate-bulk-selection' };
        const expectedRevisions = Object.fromEntries(items.map(item =>
          [item.id, item.revision]));
        result = await applyBulkAction({
          source: 'origin', ids, expectedRevisions,
          action: command.type === 'task.bulk.complete' ? 'complete' : command.action,
          target: command.target || ''
        });
        break;
      }
      case 'task.complete':
        result = await completeTaskWithMemo(id);
        break;
      case 'task.reopen':
        result = await changeStatus(id, getDefaultOpenStatus());
        break;
      case 'task.delete': {
        // Canonical recurring-series and relation-aware delete remains the owner.
        const existing = state.tasks.find(task => task.id === id);
        if (String(command.ownerRoom || '') !== ROOM_ID
          || String(command.ownerUser || '') !== getCurrentUser())
          return { ok: false, error: 'owner-mismatch' };
        if (!existing || normalizeRevision(existing.revision) !== Number(command.revision))
          return { ok: false, error: 'revision-or-relation-mismatch' };
        result = await requestDeleteWithSeries('task', id, { base: captureDeleteBase(id) });
        break;
      }
      case 'task.status':
        result = await changeStatus(id, command.status);
        break;
      default:
        return { ok: false, error: 'unsupported-action' };
    }
    if (result?.ok) notifyPaletteNextSubscribers();
    return result || { ok: false, error: 'write-failed' };
  }
});

window.dispatchEvent(new Event('workboard:canonical-bridge-ready'));

// v31: すべての定義が完了してから初期化する
init();
