/**
 * selfCheck.js — 主观周自评本地存储（IndexedDB 主存储 + localStorage 镜像迁移与灾备）
 * 参考性别肯定言语治疗 (GAVT) 与 TVQ-MtF 去病理化自我觉察原则：不求总分、不贴等级、全可跳过。
 */

import { txStore } from './db.js';
import { SELF_MOODS, SELF_CHECK_QUESTIONS, SELF_CONTEXTS } from '../core/selfCheckSchema.js';

export { SELF_MOODS, SELF_CHECK_QUESTIONS, SELF_CONTEXTS };

const STORE = 'selfChecks';
const MIRROR_KEY = 'tv.selfChecks.v1';
const MAX_ENTRIES = 200;

const listeners = new Set();

export function subscribeSelfChecks(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(event, payload) {
  for (const fn of listeners) {
    try {
      fn(event, payload);
    } catch {}
  }
}

function readMirror() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x.id === 'string').sort((a, b) => (b.ts || 0) - (a.ts || 0))
      : [];
  } catch {
    return [];
  }
}

function writeMirror(list) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify((list || []).slice(0, MAX_ENTRIES)));
  } catch {
    // 忽略容量受限异常
  }
}

function normalizeAnswers(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const q of SELF_CHECK_QUESTIONS) {
    const v = raw[q.key];
    if (typeof v === 'string' && v.trim()) {
      out[q.key] = v.trim().slice(0, 60);
    }
  }
  return out;
}

export function normalizeSelfCheckEntry(raw = {}) {
  const ts = Number(raw.ts) || Date.now();
  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `sc_${ts.toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const contexts = Array.isArray(raw.contexts)
    ? raw.contexts.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const legacyComfort = Number(raw.comfort);
  const legacyFocus = Number(raw.focus);
  const legacyEase = Number(raw.ease);
  const hasLegacyScores = [legacyComfort, legacyFocus, legacyEase].some((n) => Number.isFinite(n) && n > 0);

  return {
    id,
    ts,
    mood: String(raw.mood || '😌 平稳').trim(),
    tone: String(raw.tone || 'sky').trim(),
    answers: normalizeAnswers(raw.answers),
    contexts,
    note: String(raw.note || '').trim().slice(0, 100),
    ...(hasLegacyScores ? {
      legacyScores: {
        comfort: Math.max(1, Math.min(5, Math.round(legacyComfort || 3))),
        focus: Math.max(1, Math.min(5, Math.round(legacyFocus || 3))),
        ease: Math.max(1, Math.min(5, Math.round(legacyEase || 3))),
      },
    } : {}),
    ...(raw.legacyScores && !hasLegacyScores ? { legacyScores: raw.legacyScores } : {}),
  };
}

let migratedOnce = false;

async function ensureMigrated() {
  if (migratedOnce || typeof indexedDB === 'undefined') return;
  migratedOnce = true;
  const mirror = readMirror();
  if (!mirror.length) return;
  try {
    const existing = await txStore(STORE, 'readonly', (os) => os.getAll());
    const existIds = new Set((existing || []).map((x) => x.id));
    for (const item of mirror) {
      if (!existIds.has(item.id)) {
        await txStore(STORE, 'readwrite', (os) => os.put(normalizeSelfCheckEntry(item)));
      }
    }
  } catch {
    migratedOnce = false;
  }
}

/** 获取本周一 00:00:00 的本地时间戳 */
export function getWeekStartTs(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const day = d.getDay(); // 0=周日, 1=周一...
  const diffToMon = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMon);
  return d.getTime();
}

export const SelfCheckStore = {
  allCached() {
    return readMirror().map(normalizeSelfCheckEntry);
  },

  async all() {
    if (typeof indexedDB === 'undefined') {
      return this.allCached();
    }
    try {
      await ensureMigrated();
      const rows = await txStore(STORE, 'readonly', (os) => os.getAll());
      const sorted = (rows || []).map(normalizeSelfCheckEntry).sort((a, b) => b.ts - a.ts);
      writeMirror(sorted);
      return sorted;
    } catch {
      return this.allCached();
    }
  },

  async add(entry = {}) {
    const clean = normalizeSelfCheckEntry(entry);
    if (typeof indexedDB !== 'undefined') {
      try {
        await ensureMigrated();
        await txStore(STORE, 'readwrite', (os) => os.put(clean));
      } catch {}
    }
    const mirror = [clean, ...readMirror().filter((x) => x.id !== clean.id)];
    writeMirror(mirror);
    notify('add', clean);
    return clean;
  },

  async remove(id) {
    if (!id) return this.all();
    if (typeof indexedDB !== 'undefined') {
      try {
        await ensureMigrated();
        await txStore(STORE, 'readwrite', (os) => os.delete(id));
      } catch {}
    }
    const next = readMirror().filter((x) => x.id !== id);
    writeMirror(next);
    notify('remove', id);
    return next.map(normalizeSelfCheckEntry);
  },

  async mergeImported(rawList = []) {
    if (!Array.isArray(rawList)) return { added: 0, total: (await this.all()).length };
    const existing = await this.all();
    const existIds = new Set(existing.map((x) => x.id));
    let added = 0;
    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue;
      const item = normalizeSelfCheckEntry(raw);
      if (!existIds.has(item.id)) {
        existIds.add(item.id);
        if (typeof indexedDB !== 'undefined') {
          try {
            await txStore(STORE, 'readwrite', (os) => os.put(item));
          } catch {}
        }
        added += 1;
      }
    }
    const all = await this.all();
    notify('import', { added });
    return { added, total: all.length };
  },

  isDoneThisWeek(list = null) {
    const rows = Array.isArray(list) ? list : this.allCached();
    if (!rows.length) return false;
    const weekStart = getWeekStartTs();
    return (rows[0].ts || 0) >= weekStart;
  },

  daysSinceLatest(list = null) {
    const rows = Array.isArray(list) ? list : this.allCached();
    if (!rows.length) return null;
    const diffMs = Math.max(0, Date.now() - (rows[0].ts || Date.now()));
    return Math.floor(diffMs / 86400000);
  },
};
