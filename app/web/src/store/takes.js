/* ===========================================================
   store/takes.js — 录音与统计的本地存储（IndexedDB）

   为什么不用 localStorage：录音是 Blob，localStorage 只能存字符串，
   转 base64 会膨胀 33% 且卡主线程。IndexedDB 能直接存 Blob。
   =========================================================== */

import { cleanPitchTrack } from '../dsp/pitch.js';

const DB_NAME = 'transvoice';
const DB_VERSION = 1;
const STORE = 'takes';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const os = t.objectStore(STORE);
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

const listeners = new Set();

/**
 * 订阅 takes 数据变更事件 (put / remove / clear)
 * @param {Function} callback (event, payload) => void
 * @returns {Function} unsubscribe 取消订阅函数
 */
export function subscribeTakes(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyChange(event, payload) {
  for (const fn of listeners) {
    try {
      fn(event, payload);
    } catch (e) {
      console.error('[TakeStore] notify error:', e);
    }
  }
}

/**
 * 递归解包 Svelte 5 $state Proxy，转换为纯 JavaScript 原生对象。
 * IndexedDB 内部 structuredClone 不支持存储任何 Proxy 对象，
 * 遇到 Proxy 会直接抛出 DOMException: #<Object> could not be cloned。
 * 同时保留 Blob、ArrayBuffer、TypedArray 等不可结构化遍历的原生二进制对象。
 */
function unwrap(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof Blob !== 'undefined' && obj instanceof Blob) return obj;
  if (typeof ArrayBuffer !== 'undefined' && (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj))) return obj;
  if (Array.isArray(obj)) return obj.map(unwrap);
  const out = {};
  for (const k of Object.keys(obj)) {
    out[k] = unwrap(obj[k]);
  }
  return out;
}

export const TakeStore = {
  async put(take) {
    const rawTake = unwrap(take);
    await tx('readwrite', (os) => os.put(rawTake));
    notifyChange('put', rawTake);
    return rawTake;
  },

  async all() {
    const rows = await tx('readonly', (os) => os.getAll());
    return (rows || []).sort((a, b) => b.ts - a.ts);
  },

  async get(id) {
    return tx('readonly', (os) => os.get(id));
  },

  async remove(id) {
    const res = await tx('readwrite', (os) => os.delete(id));
    notifyChange('remove', id);
    return res;
  },

  async clear() {
    const res = await tx('readwrite', (os) => os.clear());
    notifyChange('clear', null);
    return res;
  },

  async count() {
    return tx('readonly', (os) => os.count());
  },
};

/** 把逐帧曲线压成够画图的稀疏点（长录音保留至多 800 点），存进记录里，带时间戳与嘎裂标记 */
export function thinCurve(frames, isCreakList = null, target = 800) {
  const clean = cleanPitchTrack(frames);
  const voiced = [];
  for (let i = 0; i < clean.length; i++) {
    const f = clean[i];
    if (f && f.hz != null) {
      const creak = isCreakList && isCreakList[i] ? 1 : 0;
      voiced.push([Number(f.t.toFixed(2)), Math.round(f.hz), creak]);
    }
  }
  if (voiced.length <= target) return voiced;
  const step = voiced.length / target;
  const out = [];
  for (let i = 0; i < target; i++) {
    const f = voiced[Math.floor(i * step)];
    out.push(f);
  }
  return out;
}
