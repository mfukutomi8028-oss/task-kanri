// Firebase設定
// Firebase Consoleで取得したコードをそのまま貼るのではなく、
// このサイトでは window.firebaseConfig に設定値だけを入れます。
// import / initializeApp / getAnalytics は app.js 側で処理するため不要です。

window.firebaseConfig = {
  apiKey: "AIzaSyAswXx5jJ5b1v1BdIjri1ELvj0q3YBMvLM",
  authDomain: "task-kanri-2ad16.firebaseapp.com",

  // Realtime Databaseを使うため必須です。
  // Firebase Console > Realtime Database > データ に表示されるURLと違う場合は、
  // この1行だけ実際のURLへ置き換えてください。
  databaseURL: "https://task-kanri-2ad16-default-rtdb.firebaseio.com",

  projectId: "task-kanri-2ad16",
  storageBucket: "task-kanri-2ad16.firebasestorage.app",
  messagingSenderId: "872313738387",
  appId: "1:872313738387:web:5adcc567025b4945cd2966",
  measurementId: "G-R0GQ65214Z"
};

// v91: 表示バージョンとタブアイコンを補正
// index.html 側に古い Ver / favicon 参照が残っていても、読み込み後に最新表示へ差し替えます。
(function applyWorkBoardUiPatch() {
  const VERSION = "91";
  const FAVICON_HREF = `assets/favicon.svg?v=${VERSION}`;

  function upsertIconLink(rel, attributes = {}) {
    const selector = `link[rel="${rel}"]`;
    let link = document.querySelector(selector);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    Object.entries(attributes).forEach(([key, value]) => link.setAttribute(key, value));
    link.href = FAVICON_HREF;
  }

  function applyPatch() {
    document.querySelectorAll(".app-version").forEach((element) => {
      element.textContent = `Ver.${VERSION}`;
      element.title = `現在のバージョン Ver.${VERSION}`;
    });

    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => link.remove());
    upsertIconLink("icon", { type: "image/svg+xml" });
    upsertIconLink("shortcut icon", { type: "image/svg+xml" });

    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.name = "theme-color";
      document.head.appendChild(theme);
    }
    theme.content = "#255f9f";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPatch, { once: true });
  } else {
    applyPatch();
  }
})();
