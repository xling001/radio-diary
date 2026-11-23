/**
 * db.js — 统一本地 IndexedDB 连接管理 (v2)
 *
 * stores:
 *  - takes: 录音音频 Blob 与声学统计 (keyPath: 'id', index: 'ts')
 *  - selfChecks: 每周主观自评与百字微周记 (keyPath: 'id', index: 'ts')
 */

const DB_NAME = 'transvoice';
const DB_VERSION = 2;

let dbPromise = null;

export function openAppDB() {
  if (dbPromise) return dbPromise;
  let blocked = false;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('takes')) {
        const takesOs = db.createObjectStore('takes', { keyPath: 'id' });
        takesOs.createIndex('ts', 'ts');
      }
      if (!db.objectStoreNames.contains('selfChecks')) {
        const scOs = db.createObjectStore('selfChecks', { keyPath: 'id' });
        scOs.createIndex('ts', 'ts');
      }
    };
    req.onblocked = () => {
      blocked = true;
      dbPromise = null;
      reject(new Error('本地数据库正在升级，请先关闭本应用的其它页面后重试'));
    };
    req.onsuccess = () => {
      const db = req.result;
      if (blocked) {
        try { db.close(); } catch {}
        return;
      }
      db.onversionchange = () => {
        try { db.close(); } catch {}
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export function txStore(storeName, mode, fn, retried = false) {
  return openAppDB().then((db) => new Promise((resolve, reject) => {
    let t;
    let out;
    try {
      t = db.transaction(storeName, mode);
      const os = t.objectStore(storeName);
      out = fn(os);
    } catch (e) {
      if (!retried && e?.name === 'InvalidStateError') {
        dbPromise = null;
        txStore(storeName, mode, fn, true).then(resolve, reject);
        return;
      }
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => {
      if (!retried && t.error?.name === 'InvalidStateError') {
        dbPromise = null;
        txStore(storeName, mode, fn, true).then(resolve, reject);
        return;
      }
      reject(t.error);
    };
    t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
  }));
}
