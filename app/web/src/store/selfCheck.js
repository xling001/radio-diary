/**
 * selfCheck.js — 主观周自评本地手账存储（纯粹去病理化感知记录，不出设备）
 */

const SELF_CHECK_KEY = 'tv.selfChecks.v1';
const MAX_ENTRIES = 120;

export const SELF_MOODS = [
  { emoji: '😊', label: '轻松', tone: 'mint' },
  { emoji: '😌', label: '平稳', tone: 'sky' },
  { emoji: '✨', label: '满意', tone: 'mint' },
  { emoji: '🌸', label: '很喜欢', tone: 'coral' },
  { emoji: '🤔', label: '摸索中', tone: 'lavender' },
  { emoji: '😮‍💨', label: '有点累', tone: 'amber' },
  { emoji: '🫂', label: '抱抱自己', tone: 'coral' },
];

export const COMFORT_LABELS = ['偏紧费力', '略微发紧', '基本平稳', '比较松弛', '轻松顺畅'];
export const FOCUS_LABELS = ['随手聊聊', '稍微留意', '比较专心', '状态不错', '非常投入'];
export const EASE_LABELS = ['还有顾虑', '还在适应', '比较自然', '挺自在的', '很喜欢'];

function readList() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SELF_CHECK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x.id === 'string').sort((a, b) => (b.ts || 0) - (a.ts || 0))
      : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SELF_CHECK_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // 忽略 localStorage 容量受限异常
  }
}

function clampScore(v, fb = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.max(1, Math.min(5, Math.round(n)));
}

export const SelfCheckStore = {
  all() {
    return readList();
  },

  add(entry = {}) {
    const item = {
      id: `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      ts: Number(entry.ts) || Date.now(),
      mood: String(entry.mood || '😌 平稳').trim(),
      tone: String(entry.tone || 'sky').trim(),
      comfort: clampScore(entry.comfort, 3),
      focus: clampScore(entry.focus, 3),
      ease: clampScore(entry.ease, 3),
      note: String(entry.note || '').trim().slice(0, 120),
    };
    const next = [item, ...readList()];
    writeList(next);
    return item;
  },

  remove(id) {
    if (!id) return [];
    const next = readList().filter((x) => x.id !== id);
    writeList(next);
    return next;
  },

  clear() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SELF_CHECK_KEY);
    } catch {}
  },

  daysSinceLatest() {
    const list = readList();
    if (!list.length) return null;
    const diffMs = Math.max(0, Date.now() - (list[0].ts || Date.now()));
    return Math.floor(diffMs / 86400000);
  },
};
