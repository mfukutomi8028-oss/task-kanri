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
