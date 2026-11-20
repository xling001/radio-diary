/**
 * selfCheck.js — 主观周自评本地存储（IndexedDB 主存储 + localStorage 镜像迁移与灾备）
 * 参考性别肯定言语治疗 (GAVT) 与 TVQ-MtF 去病理化自我觉察原则：不求总分、不贴等级、全可跳过。
 */

import { txStore } from './db.js';

const STORE = 'selfChecks';
const MIRROR_KEY = 'tv.selfChecks.v1';
const MAX_ENTRIES = 200;

export const SELF_MOODS = [
  { emoji: '😊', label: '轻松', tone: 'mint' },
  { emoji: '😌', label: '平稳', tone: 'sky' },
  { emoji: '✨', label: '满意', tone: 'mint' },
  { emoji: '🌸', label: '很喜欢', tone: 'coral' },
  { emoji: '🤔', label: '摸索中', tone: 'lavender' },
  { emoji: '😮‍💨', label: '有点累', tone: 'amber' },
  { emoji: '🫂', label: '抱抱自己', tone: 'coral' },
];

export const SELF_CHECK_QUESTIONS = [
  {
    key: 'throatLoad',
    title: '1. 嗓音负荷与舒适感',
    prompt: '这周聊久一点或练完后，脖子与嗓子容易紧、干或累吗？',
    options: [
      '轻松省力',
      '偶尔微紧，喝水可缓',
      '说久容易累或干',
      '有明显疼痛或持续沙哑',
    ],
    redlineOption: '有明显疼痛或持续沙哑',
  },
  {
    key: 'socialEase',
    title: '2. 日常生活开口自在度',
    prompt: '这周接外卖/快递电话、点单或日常交流时，开口自在吗？',
    options: [
      '挺自然顺手',
      '能稳住，但心里会绷着',
      '还是容易紧张或回避',
      '这周主要自己练，暂未社交使用',
    ],
  },
  {
    key: 'listenerFeel',
    title: '3. 听者反馈感受（可跳过）',
    prompt: '这周在电话或陌生场合开口后，别人的称呼或反应让你感觉舒服吗？',
    options: [
      '大多让人开心舒服',
      '一半一半，看场合',
      '仍常被误认，有点失落',
      '这周先跳过这题',
    ],
  },
  {
    key: 'carryover',
    title: '4. 从练到说的迁移稳定度',
    prompt: '从「读素材」换回平时语速说话时，声音容易一下掉回原本低位吗？',
    options: [
      '基本能稳在舒适位置',
      '一赶时间或激动还是会掉',
      '需刻意托着，有点费脑',
      '这周主要靠自由照镜摸索',
    ],
  },
  {
    key: 'selfFit',
    title: '5. 声音自我接纳度',
    prompt: '隔天回听手账里的录音，这声音像你喜欢且接纳的自己吗？',
    options: [
      '很喜欢，越来越贴近自己',
      '还在慢慢熟悉磨合',
      '听回放还是有点别扭',
      '这周还没回听录音',
    ],
  },
];

export const SELF_CONTEXTS = [
  '自由照镜',
  '读素材',
  '做测试',
  '点单问路',
  '外卖快递电话',
  '职场通话会议',
  '熟人聊天',
  '故事连读',
];

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
