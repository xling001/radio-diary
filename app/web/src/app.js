import './style/tokens.css';
import './style/app.css';
import './main.js';

import { mount } from 'svelte';
import { ui } from './state/ui.svelte.js';

import Record from './pages/record/Record.svelte';
import Analysis from './pages/analysis/Analysis.svelte';
import History from './pages/history/History.svelte';
import Mindset from './pages/mindset/Mindset.svelte';
import Library from './pages/library/Library.svelte';
import Settings from './pages/settings/Settings.svelte';

const mounts = [
  ['svelte-record-root', Record],
  ['svelte-analysis-root', Analysis],
  ['svelte-history-root', History],
  ['svelte-mindset-root', Mindset],
  ['svelte-library-root', Library],
  ['svelte-settings-root', Settings],
];

for (const [id, Comp] of mounts) {
  const el = document.getElementById(id);
  if (el) mount(Comp, { target: el });
}

if (typeof window !== 'undefined') {
  window.__ui = ui;

  // 仅在独立 Web PWA 环境（非 Android 离线壳）注册静态资源离线缓存，支持 iOS/桌面端断网二次打开
  const isAndroidShell = Boolean(window.DshFile) || window.location.hostname === 'appassets.local';
  const isSecureContextForSw =
    window.location.protocol === 'https:'
    || window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1';

  if (!isAndroidShell && isSecureContextForSw && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
  }
}
