/* ===========================================================
   state/settings.svelte.js — 全局设置状态管理 (Svelte 5 Runes)
   =========================================================== */

import { micSupportCheck } from '../audio/capture.js';
import { TakeStore } from '../store/takes.js';

const AUTO_JUMP_KEY = 'tv.autoJump';
const MAX_DUR_KEY = 'tv.maxDur';
const FLOOR_HZ_KEY = 'tv.floorHz';
const THEME_KEY = 'tv.theme';

class SettingsState {
  autoJump = $state(true);
  maxRecSecs = $state(120);
  floorTargetHz = $state(160);
  themePref = $state('system');
  takeCount = $state(0);
  takeBytes = $state(0);
  micOk = $state(true);
  micDesc = $state('默认麦克风 · 按需授权');

  constructor() {
    if (typeof window !== 'undefined') {
      this.load();
    }
  }

  load() {
    try {
      const aj = localStorage.getItem(AUTO_JUMP_KEY);
      this.autoJump = aj !== null ? aj !== 'false' : true;

      const md = Number(localStorage.getItem(MAX_DUR_KEY) || 120);
      this.maxRecSecs = [60, 90, 120, 180].includes(md) ? md : 120;

      const fh = Number(localStorage.getItem(FLOOR_HZ_KEY) || 160);
      this.floorTargetHz = [150, 155, 160, 165].includes(fh) ? fh : 160;

      const tp = localStorage.getItem(THEME_KEY) || 'system';
      this.themePref = ['system', 'dark', 'light'].includes(tp) ? tp : 'system';
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
    this.refreshMetrics();
  }

  async refreshMetrics() {
    try {
      const support = micSupportCheck();
      this.micOk = support.ok;
      this.micDesc = support.ok ? '默认设备 · 按需授权' : (support.message || '不可用');
      const rows = await TakeStore.all();
      this.takeCount = rows.length;
      let bytes = 0;
      for (const r of rows) {
        if (r?.blob && typeof r.blob.size === 'number') bytes += r.blob.size;
      }
      this.takeBytes = bytes;
    } catch {
      this.takeCount = 0;
      this.takeBytes = 0;
    }
  }

  toggleAutoJump() {
    this.autoJump = !this.autoJump;
    try { localStorage.setItem(AUTO_JUMP_KEY, String(this.autoJump)); } catch {}
  }

  cycleMaxDuration() {
    const steps = [60, 90, 120, 180];
    const idx = steps.indexOf(this.maxRecSecs);
    this.maxRecSecs = steps[(idx + 1) % steps.length];
    try { localStorage.setItem(MAX_DUR_KEY, String(this.maxRecSecs)); } catch {}
  }

  cycleFloorHz() {
    const steps = [150, 155, 160, 165];
    const idx = steps.indexOf(this.floorTargetHz);
    this.floorTargetHz = steps[(idx + 1) % steps.length];
    try { localStorage.setItem(FLOOR_HZ_KEY, String(this.floorTargetHz)); } catch {}
  }

  cycleTheme() {
    const steps = ['system', 'light', 'dark'];
    const idx = steps.indexOf(this.themePref);
    this.themePref = steps[(idx + 1) % steps.length];
    try { localStorage.setItem(THEME_KEY, this.themePref); } catch {}
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(this.themePref);
    }
  }
}

export const settings = new SettingsState();
