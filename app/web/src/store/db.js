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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export function txStore(storeName, mode, fn) {
  return openAppDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const os = t.objectStore(storeName);
    let out;
    try {
      out = fn(os);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}
