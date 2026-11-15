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
}
