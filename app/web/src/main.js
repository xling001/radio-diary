/* ===========================================================
   main.js — 清籁手帐 v2.0 全局壳层逻辑（主题、提示、路由同步）
   =========================================================== */

import { extractAudioFrames, normalizeStats, summarize } from './core/index.js';
import { ui } from './state/ui.svelte.js';
import { settings } from './state/settings.svelte.js';

export const BASELINE_STEPS = [150, 155, 160, 165];

const GREETINGS = [
  ['(｡･ω･｡)ﾉ', '喝口温水，先轻轻叹口气吧～'],
  ['(｡•ᴗ•｡)♡', '不用刻意捏嗓子，舒服自然就好～'],
  ['( ´ ▽ ` )ﾉ', '音高和亮度分开练，今天挑一个小点吧'],
  ['(ˊ˘ˋ*)♡', '嗓子有点紧就歇会儿，做个半打哈欠呀'],
  ['( *・ω・)ノ', '每天练几分钟，比硬练半小时更稳哦'],
  ['(´-ω-`)', '数据起伏很正常，你的舒适体感更重要～'],
];

const VIEW_TITLES = {
  record:   ['练习', '自由说 · 读素材 · 做测试'],
  analysis: ['分析', '音高 · 音色 · 共振指标'],
  history:  ['手账', '练习记录 · 趋势 · 对比导出'],
  mindset:  ['指南', '发声动作与练习思路'],
  library:  ['素材库', '分类 · 标签 · 自定义导入'],
  settings: ['设置', '偏好 · 外观 · 本地数据'],
};

const $ = (id) => document.getElementById(id);

let _cssVarCache = null;

export function invalidateCssVarCache() {
  _cssVarCache = null;
}

export function cssVar(name, fallback = '') {
  if (!_cssVarCache) {
    _cssVarCache = getComputedStyle(document.documentElement);
  }
  const val = _cssVarCache.getPropertyValue(name);
  return val ? val.trim() : fallback;
}

let toastTimer = null;
export function showNotice(msg, ms = 2400) {
  const el = $('dsh-toast');
  if (!el || !msg) return;
  el.textContent = String(msg);
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

const MOON_SVG = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
const SUN_SVG = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';

function syncThemeIcon(theme) {
  const icon = $('theme-icon');
  if (icon) icon.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
}

export function applyTheme(theme, persist = true) {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolved);
  invalidateCssVarCache();
  settings.themePref = resolved;
  if (persist) {
    try { localStorage.setItem('tv.theme', resolved); } catch {}
  }
  syncThemeIcon(resolved);
  const bg = resolved === 'dark' ? '#141921' : '#F4F1EC';
  try {
    if (window.DshFile && typeof window.DshFile.setBars === 'function') {
      window.DshFile.setBars(bg);
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('tv-theme-change', { detail: { theme: resolved } }));
}

let greetingIdx = new Date().getDate() % GREETINGS.length;

function renderGreeting(view) {
  const bar = $('page-greeting');
  if (!bar) return;
  const show = view === 'record' || view === 'mindset';
  bar.hidden = !show;
  if (!show) return;
  const [kaomoji, text] = GREETINGS[greetingIdx % GREETINGS.length];
  const kEl = $('greeting-kaomoji');
  const tEl = $('greeting-text');
  if (kEl) kEl.textContent = kaomoji;
  if (tEl) tEl.textContent = text;
}

function syncViewChrome(view) {
  const [title, sub] = VIEW_TITLES[view] || VIEW_TITLES.record;
  const tEl = $('page-title');
  const sEl = $('page-sub');
  if (tEl) tEl.textContent = title;
  if (sEl) sEl.textContent = sub;

  document.querySelectorAll('.view[data-view]').forEach((sec) => {
    sec.classList.toggle('active', sec.dataset.view === view);
  });

  document.querySelectorAll('.nav button[data-go]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.go === view);
  });

  renderGreeting(view);
}

/** 保持核芯分析一致性导出 */
export function runAcousticAnalysis(pcm, sampleRate, mode = 'free', floorF0 = null) {
  const frames = extractAudioFrames(pcm, sampleRate);
  const res = summarize(frames, pcm, sampleRate, mode, floorF0);
  return {
    ...res,
    normalized: normalizeStats(res.stats),
  };
}

function bindGlobalChrome() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(currentTheme, false);

  const themeBtn = $('theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  const greetingBar = $('page-greeting');
  if (greetingBar) {
    const cycle = () => {
      greetingIdx = (greetingIdx + 1) % GREETINGS.length;
      renderGreeting(ui.currentView);
    };
    greetingBar.addEventListener('click', cycle);
    greetingBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycle();
      }
    });
  }

  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.dataset.go;
      if (target) ui.navigate(target);
    });
  });

  ui.subscribe((route) => {
    syncViewChrome(route.view);
  });

  if (typeof window !== 'undefined') {
    window.showNotice = showNotice;
    window.__toast = showNotice;
    window.__back = () => ui.handleBack();
    window.cssVar = cssVar;
    window.invalidateCssVarCache = invalidateCssVarCache;
  }
}

bindGlobalChrome();
