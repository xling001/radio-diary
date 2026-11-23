/* ===========================================================
   main.js — 清籁手帐 v2.0 全局壳层逻辑（主题、提示、路由同步）
   =========================================================== */

import { extractAudioFrames, normalizeStats, summarize } from './core/index.js';
import { ui } from './state/ui.svelte.js';
import { settings } from './state/settings.svelte.js';

// CanvasRenderingContext2D.roundRect 兼容补丁（救 Android WebView < 99 与 iOS Safari < 15.4）
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii = 0) {
    const r = Array.isArray(radii)
      ? [radii[0] || 0, radii[1] ?? radii[0] ?? 0, radii[2] ?? radii[0] ?? 0, radii[3] ?? radii[1] ?? radii[0] ?? 0]
      : [radii || 0, radii || 0, radii || 0, radii || 0];
    const maxR = Math.max(0, Math.min(Math.abs(w) / 2, Math.abs(h) / 2));
    const [tl, tr, br, bl] = r.map((v) => Math.max(0, Math.min(Number(v) || 0, maxR)));
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

export const BASELINE_STEPS = [150, 155, 160, 165];

const GREETINGS = [
  ['(｡･ω･｡)ﾉ', '喝口温水，先轻轻叹口气吧～'],
  ['(｡•ᴗ•｡)♡', '不用刻意捏嗓子，舒服自然就好～'],
  ['( ´ ▽ ` )ﾉ', '音高和亮度分开练，今天挑一个小点吧'],
  ['(ˊ˘ˋ*)♡', '嗓子有点紧就歇会儿，做个半打哈欠呀'],
  ['( *・ω・)ノ', '每天练几分钟，比硬练半小时更稳哦'],
  ['(´-ω-`)', '数据起伏很正常，你的舒适体感更重要～'],
  ['(っ´ω`)ﾉ', '不用急着一次到位，今天比昨天松一点就好'],
  ['(●´ω`●)', '肩膀和下巴有没有悄悄紧着？先垂下来呀'],
  ['(๑•̀ㅂ•́)و✧', '就算今天只练了三十秒，也值得给自己鼓掌！'],
  ['(つд⊂)', '觉得有点累就先合上手账，去喝杯温热的吧'],
  ['(✿◠‿◠)', '声音和春天一样都在慢慢长，不用催它呀～'],
  ['(｡ì _ í｡)', '前五分钟有点散很正常，先找回轻松感再说'],
  ['(´,,•ω•,,)♡', '记住你不是在考级，是在温柔陪伴自己的声音'],
  ['(ﾉ◕ヮ◕)ﾉ*:･ﾟ', '状态好时多说几句，状态一般就早点休息哦'],
  ['(˘⌣˘)ʃ', '空调房或天冷的时候，先闭唇轻哼两声热热身～'],
  ['( ´･･)ﾉ(._.`)', '偶尔沙哑或掉音没关系，明天依然会更好的'],
  ['(♡˙︶˙♡)', '别去和别人比较啦，最适合你的声线才最珍贵'],
  ['(￣▽￣)~*', '记得按时吃饭早点睡觉，休息够了声音才稳呀'],
  ['(ง •̀_•́)ง', '小步慢跑最持久，加油，你已经做得很棒啦！'],
  ['( *˘ ³˘)♡', '点这里可以换一句，今天也要好好照顾自己呀～'],
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

let greetingIdx = Math.floor(Math.random() * GREETINGS.length);

function renderGreeting(view, sub = null) {
  const bar = $('page-greeting');
  if (!bar) return;
  const show = (view === 'record' || view === 'mindset') && !sub;
  bar.hidden = !show;
  if (!show) return;
  const [kaomoji, text] = GREETINGS[greetingIdx % GREETINGS.length];
  const kEl = $('greeting-kaomoji');
  const tEl = $('greeting-text');
  if (kEl) kEl.textContent = kaomoji;
  if (tEl) tEl.textContent = text;
}

function syncViewChrome(view, sub = null) {
  let [title, subTitle] = VIEW_TITLES[view] || VIEW_TITLES.record;
  if (view === 'history' && sub === 'selfcheck') {
    title = '每周自评';
    subTitle = '状态觉察 · 百字周记 · 本地备份';
  }
  const tEl = $('page-title');
  const sEl = $('page-sub');
  if (tEl) tEl.textContent = title;
  if (sEl) sEl.textContent = subTitle;

  document.querySelectorAll('.view[data-view]').forEach((sec) => {
    sec.classList.toggle('active', sec.dataset.view === view);
  });

  document.querySelectorAll('.nav button[data-go]').forEach((btn) => {
    const isActive = btn.dataset.go === view;
    btn.classList.toggle('active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  renderGreeting(view, sub);
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
      renderGreeting(ui.currentView, ui.subRoute);
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
    syncViewChrome(route.view, route.sub);
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
