<script>
  import { onMount } from 'svelte';
  import { ALGO_VERSION } from '../../core/index.js';
  import { BASELINE_STEPS, applyTheme } from '../../main.js';
  import { settings } from '../../state/settings.svelte.js';
  import { ui } from '../../state/ui.svelte.js';
  import { TakeStore } from '../../store/takes.js';
  import { confirmDlg } from '../../ui/dialog.js';

  const DUR_STEPS = [60, 90, 120, 180];

  onMount(() => {
    settings.refreshMetrics();
    const unsub = ui.subscribe((route) => {
      if (route.view === 'settings') settings.refreshMetrics();
    });
    return unsub;
  });

  function showMsg(msg) {
    if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
      window.showNotice(msg);
    }
  }

  function pickFloorHz(hz) {
    settings.floorTargetHz = hz;
    try { localStorage.setItem('tv.floorHz', String(hz)); } catch {}
    showMsg(`安全托底线已设为 ${hz} Hz`);
  }

  function pickMaxDur(sec) {
    settings.maxRecSecs = sec;
    try { localStorage.setItem('tv.maxDur', String(sec)); } catch {}
    showMsg(`单次最长录音设为 ${sec} 秒`);
  }

  function pickTheme(mode) {
    applyTheme(mode, true);
  }

  async function handleClearHistory() {
    const ok = await confirmDlg(
      '清空全部录音与手账？',
      '所有保存在本机的练习音频和曲线记录都会被清掉，且无法找回。确定吗？',
      '清空全部',
      '先留着',
      true
    );
    if (!ok) return;
    await TakeStore.clear();
    await settings.refreshMetrics();
    showMsg('已清空本机手账数据');
  }
</script>

<div class="set-page">
  <div class="set-top">
    <button type="button" class="back-pill" onclick={() => ui.navigate('record')}>
      ← 返回练习
    </button>
  </div>

  <!-- 发声偏好 -->
  <section class="summary-sheet set-card">
    <h2 class="summary-sheet-title">发声与录制设置</h2>

    <div class="set-block">
      <div class="set-block-head">
        <div>
          <div class="set-lbl">低音托底线</div>
          <div class="set-desc">用来参考说话时有没有掉破设定低音，可按自己的舒适区间随时调整。</div>
        </div>
        <strong class="tnum set-badge">{settings.floorTargetHz} Hz</strong>
      </div>
      <div class="chip-grid-4">
        {#each BASELINE_STEPS as hz}
          <button
            type="button"
            class="opt-chip tnum {settings.floorTargetHz === hz ? 'active' : ''}"
            onclick={() => pickFloorHz(hz)}
          >
            {hz} Hz
          </button>
        {/each}
      </div>
    </div>

    <div class="set-row">
      <div>
        <div class="set-lbl">录完后自动跳转分析页</div>
        <div class="set-desc">关闭后录完会留在当前练习页，适合连续多条跟练</div>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          checked={settings.autoJump}
          onchange={() => settings.toggleAutoJump()}
        />
        <span class="switch-slider"></span>
      </label>
    </div>

    <div class="set-block">
      <div class="set-block-head">
        <div class="set-lbl">单次最长录音时长</div>
        <strong class="tnum set-badge">{settings.maxRecSecs} 秒</strong>
      </div>
      <div class="chip-grid-4">
        {#each DUR_STEPS as sec}
          <button
            type="button"
            class="opt-chip tnum {settings.maxRecSecs === sec ? 'active' : ''}"
            onclick={() => pickMaxDur(sec)}
          >
            {sec} 秒
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- 外观与设备 -->
  <section class="summary-sheet set-card">
    <h2 class="summary-sheet-title">外观与麦克风</h2>

    <div class="set-block">
      <div class="set-lbl">界面外观</div>
      <div class="chip-grid-2">
        <button
          type="button"
          class="opt-chip theme-opt {settings.themePref !== 'dark' ? 'active' : ''}"
          onclick={() => pickTheme('light')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="12" y1="2" x2="12" y2="4"></line>
            <line x1="12" y1="20" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line>
            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="4" y2="12"></line>
            <line x1="20" y1="12" x2="22" y2="12"></line>
            <line x1="6.34" y1="17.66" x2="4.93" y2="19.07"></line>
            <line x1="19.07" y1="4.93" x2="17.66" y2="6.34"></line>
          </svg>
          <span>浅色模式</span>
        </button>
        <button
          type="button"
          class="opt-chip theme-opt {settings.themePref === 'dark' ? 'active' : ''}"
          onclick={() => pickTheme('dark')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span>深色模式</span>
        </button>
      </div>
    </div>

    <div class="set-row">
      <div>
        <div class="set-lbl">麦克风状态</div>
        <div class="set-desc">{settings.micDesc}</div>
      </div>
      <button type="button" class="mini-check-btn" onclick={() => { settings.refreshMetrics(); showMsg('已重新检查设备支持情况'); }}>
        检查
      </button>
    </div>
  </section>

  <!-- 本机手账数据 -->
  <section class="summary-sheet set-card">
    <h2 class="summary-sheet-title">本地数据</h2>
    <div class="set-row">
      <div>
        <div class="set-lbl">全部数据仅存于你的设备本地</div>
        <div class="set-desc tnum">当前共保存 {settings.takeCount} 条练习记录与音频</div>
      </div>
      <button
        type="button"
        class="danger-pill"
        disabled={settings.takeCount === 0}
        onclick={handleClearHistory}
      >
        清空全部
      </button>
    </div>
  </section>

  <div class="ver-foot">
    电波日记 v2.0.3 · 声学内核 v{ALGO_VERSION} · Soft Crayon
  </div>
</div>

<style>
  .set-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-pill {
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 999px;
    box-shadow: var(--shadow);
    cursor: pointer;
  }

  .set-card {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .set-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--hairline);
  }
  .set-block:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .set-block-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--hairline);
  }
  .set-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .set-lbl {
    font-size: var(--fs-14);
    font-weight: 600;
    color: var(--ink-1);
  }
  .set-desc {
    font-size: var(--fs-11);
    color: var(--ink-3);
    margin-top: 2px;
    line-height: 1.45;
  }
  .set-badge {
    font-size: var(--fs-13);
    color: var(--crayon-mint-ink);
    background: var(--crayon-mint-soft);
    padding: 2px 9px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .chip-grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .chip-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .opt-chip {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 8px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: center;
  }
  .opt-chip.theme-opt {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .opt-chip.active {
    background: var(--crayon-coral);
    color: var(--rose-on);
    border-color: var(--crayon-coral);
  }

  .mini-check-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
  }

  .danger-pill {
    border: none;
    background: var(--crayon-coral-soft);
    color: var(--danger-ink);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 999px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .danger-pill:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .ver-foot {
    text-align: center;
    font-size: var(--fs-11);
    color: var(--ink-3);
    padding: 4px 0 8px;
  }
</style>
