// Ver.573: Node-only Firebase Admin adapter for an isolated DEMO project.
// This cannot connect to production; never import into browser code.
import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
export const DEMO_PROJECT_V573 = 'demo-task-kanri-v568';
export const DEMO_DB_URL_V573 = 'https://demo-task-kanri-v568-default-rtdb.firebaseio.com';
const ROOM_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export function createDemoAdminServiceV573(app) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
    || process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9001'
    || app?.options?.projectId !== DEMO_PROJECT_V573
    || app?.options?.databaseURL !== DEMO_DB_URL_V573) {
    throw new Error('Firebase検証用の接続条件に一致しません');
  }
  const auth = getAuth(app), db = getDatabase(app);
  return Object.freeze({
    expectedProjectId: DEMO_PROJECT_V573,
    verifyIdToken: (token, checkRevoked) => auth.verifyIdToken(token, checkRevoked),
    makeTaskId: () => 'task_' + randomUUID().replaceAll('-', ''),
    now: () => Date.now(),
    async transactRoom(roomId, updateRoom) {
      if (typeof roomId !== 'string' || !ROOM_ID.test(roomId)
        || ['constructor','prototype','__proto__'].includes(roomId)
        || typeof updateRoom !== 'function') throw new Error('不正なルーム保存要求');
      const roomRef = db.ref('roomsV2/' + roomId);
      let observer;
      try {
        // Keep a warm read listener until the atomic transaction finishes.
        await new Promise((resolve, reject) => {
          observer = () => resolve();
          roomRef.on('value', observer, reject);
        });
        return await roomRef.transaction(updateRoom, undefined, false);
      } finally {
        if (observer) roomRef.off('value', observer);
      }
    }
  });
}
