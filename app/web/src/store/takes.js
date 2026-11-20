/* ===========================================================
   store/takes.js — 录音与统计的本地存储（IndexedDB）

   为什么不用 localStorage：录音是 Blob，localStorage 只能存字符串，
   转 base64 会膨胀 33% 且卡主线程。IndexedDB 能直接存 Blob。
   =========================================================== */

import { cleanPitchTrack } from '../dsp/pitch.js';
import { txStore } from './db.js';

const STORE = 'takes';

const tx = (mode, fn) => txStore(STORE, mode, fn);

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

  async mergeImportedSummaries(rawTakes = []) {
    if (!Array.isArray(rawTakes) || !rawTakes.length) {
      const total = await this.count();
      return { added: 0, total };
    }
    const existing = await this.all();
    const existingIds = new Set(existing.map((t) => String(t.id)));
    const toInsert = [];

    for (let i = 0; i < rawTakes.length; i++) {
      const item = rawTakes[i];
      if (!item || typeof item !== 'object') continue;
      const ts = Number(item.ts) || Date.now();
      const id = item.id != null ? String(item.id) : `imported_${ts}_${i}`;
      if (existingIds.has(id)) continue;
      existingIds.add(id);

      const durationSec = Number(item.durationSec) || 0;
      const numOrNull = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);

      toInsert.push(unwrap({
        id,
        ts,
        mode: item.mode || 'free',
        setId: item.setId ?? null,
        setName: item.setName || '导入记录',
        durationSec,
        ok: item.ok !== false,
        reasons: Array.isArray(item.reasons) ? item.reasons : [],
        fav: Boolean(item.fav),
        stamp: item.stamp ?? null,
        algoVersion: item.algoVersion || '0.5.0',
        restoredSummary: true,
        blob: null,
        stats: item.stats && typeof item.stats === 'object' ? item.stats : {
          medianF0: numOrNull(item.medianF0),
          p10: numOrNull(item.p10),
          p90: numOrNull(item.p90),
          spanSt: numOrNull(item.spanSt),
          floorSafeRatio: numOrNull(item.floorSafeRatio),
          floorTargetHz: numOrNull(item.floorTargetHz),
          hnr: numOrNull(item.hnr),
          balance: numOrNull(item.balance),
          deltaF: numOrNull(item.deltaF),
          lengthCm: numOrNull(item.lengthCm),
          avgF1: numOrNull(item.avgF1),
          avgF2: numOrNull(item.avgF2),
          avgF3: numOrNull(item.avgF3),
          jitter: numOrNull(item.jitter),
          shimmer: numOrNull(item.shimmer),
          pitchHalving: numOrNull(item.pitchHalving),
          sibilanceCentroid: numOrNull(item.sibilanceCentroid),
          ext: {
            totalSec: durationSec,
            voicedSec: Number(item.voicedSec) || 0,
            jitterPct: numOrNull(item.jitter),
            shimmerPct: numOrNull(item.shimmer),
            pitchHalvingPct: numOrNull(item.pitchHalving),
            sibilanceCentroidHz: numOrNull(item.sibilanceCentroid),
            floorTargetHz: numOrNull(item.floorTargetHz),
          },
          voiceQuality: {
            h1h2Db: numOrNull(item.h1h2),
            hnrDb: numOrNull(item.hnr),
          },
          spectral: {
            h1h2Db: numOrNull(item.h1h2),
          },
          formants: {
            deltaF: numOrNull(item.deltaF),
            lengthCm: numOrNull(item.lengthCm),
          },
        },
      }));
    }

    if (toInsert.length > 0) {
      await tx('readwrite', (os) => {
        for (const rec of toInsert) os.put(rec);
      });
      notifyChange('put', toInsert[0]);
    }
    return { added: toInsert.length, total: existing.length + toInsert.length };
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
