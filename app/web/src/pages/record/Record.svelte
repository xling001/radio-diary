<script>
  import { onMount } from 'svelte';
  import { LibraryStore } from '../../store/library.js';
  import { getAllCategories, CHECKUP_ITEMS } from '../../core/catalog.js';
  import { ui } from '../../state/ui.svelte.js';
  import { settings } from '../../state/settings.svelte.js';
  import { audioSession } from './audioSession.svelte.js';
  import { paintLivePitch } from './charts.js';

  let canvasEl = $state(null);
  let fileInputEl = $state(null);
  let activeSet = $state(LibraryStore.getSet(audioSession.activeSetId));
  let categories = $state(getAllCategories());

  function refreshLibraryView() {
    audioSession.refreshSet();
    activeSet = LibraryStore.getSet(audioSession.activeSetId);
    categories = getAllCategories();
  }

  function repaintCanvas() {
    if (canvasEl) {
      const unvoiced = audioSession.mode === 'checkup' && activeCheckup && !activeCheckup.requiresVoiced;
      paintLivePitch(canvasEl, audioSession.liveFrames, settings.floorTargetHz, { isUnvoiced: unvoiced });
    }
  }

  function applySubRoute(route) {
    if (!route || route.view !== 'record') return;
    if (route.sub && route.sub.startsWith('checkup/')) {
      const targetCheckId = route.sub.slice('checkup/'.length);
      if (targetCheckId) audioSession.setActiveCheckup(targetCheckId);
      audioSession.setMode('checkup');
    } else if (route.sub === 'checkup') {
      audioSession.setMode('checkup');
    } else if (route.sub && route.sub.startsWith('script/')) {
      const targetId = route.sub.slice('script/'.length);
      if (targetId) audioSession.setActiveSet(targetId);
      audioSession.setMode('script');
    } else if (route.sub === 'script') {
      audioSession.setMode('script');
    }
    refreshLibraryView();
  }

  onMount(() => {
    refreshLibraryView();
    applySubRoute({ view: ui.currentView, sub: ui.subRoute });
    audioSession.setFramePaintHook(() => repaintCanvas());
    repaintCanvas();

    const unsub = ui.subscribe((route) => {
      if (route.view === 'record') {
        applySubRoute(route);
        requestAnimationFrame(repaintCanvas);
      }
    });

    const onTheme = () => requestAnimationFrame(repaintCanvas);
    window.addEventListener('tv-theme-change', onTheme);
    window.addEventListener('resize', repaintCanvas);

    return () => {
      unsub();
      audioSession.setFramePaintHook(null);
      window.removeEventListener('tv-theme-change', onTheme);
      window.removeEventListener('resize', repaintCanvas);
    };
  });

  $effect(() => {
    const _floor = settings.floorTargetHz;
    repaintCanvas();
  });

  function formatTimer(sec) {
    const s = Math.max(0, sec || 0);
    const m = Math.floor(s / 60);
    const rem = (s % 60).toFixed(1).padStart(4, '0');
    return `${String(m).padStart(2, '0')}:${rem}`;
  }

  function catLabel(catId) {
    return categories.find((c) => c.id === catId)?.label || '素材';
  }

  const H1H2_HINTS = [
    { text: '偏紧（多叹一口气）', tone: 'coral' },
    { text: '适中平衡', tone: 'amber' },
    { text: '轻盈舒展', tone: 'mint' },
    { text: '轻柔偏气声', tone: 'sky' },
  ];

  const BRIGHT_HINTS = [
    { text: '前口腔明亮', tone: 'mint' },
    { text: '清晰均衡', tone: 'sky' },
    { text: '温暖偏深', tone: 'amber' },
  ];

  const h1h2Hint = $derived.by(() => {
    const band = audioSession.liveH1H2Band;
    return band != null ? H1H2_HINTS[band] : { text: '等候发声', tone: 'neutral' };
  });

  const brightHint = $derived.by(() => {
    const band = audioSession.liveBalanceBand;
    return band != null ? BRIGHT_HINTS[band] : { text: '等候发声', tone: 'neutral' };
  });

  const activeCheckup = $derived(audioSession.activeCheckup);
  const isUnvoicedCheck = $derived(audioSession.mode === 'checkup' && activeCheckup && !activeCheckup.requiresVoiced);

  const currentLineObj = $derived.by(() => {
    const lines = activeSet?.lines || [];
    if (!lines.length) return { cue: '', text: '', note: '' };
    const raw = lines[audioSession.lineIdx % lines.length];
    if (raw && typeof raw === 'object') {
      return {
        cue: String(raw.cue || '').trim(),
        text: String(raw.text || ''),
        note: String(raw.note || '').trim(),
      };
    }
    return { cue: '', text: String(raw || ''), note: '' };
  });

  function tokenizePromptText(raw) {
    const str = String(raw || '');
    if (!str) return [];
    const re = /(\/换气\/|｜|↗|↘)/g;
    const out = [];
    let last = 0;
    let m;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) out.push({ kind: 'text', value: str.slice(last, m.index) });
      const tok = m[0];
      if (tok === '｜') out.push({ kind: 'pause', value: '·' });
      else if (tok === '/换气/') out.push({ kind: 'breath', value: '换气' });
      else if (tok === '↗') out.push({ kind: 'up', value: '↗' });
      else if (tok === '↘') out.push({ kind: 'down', value: '↘' });
      last = m.index + tok.length;
    }
    if (last < str.length) out.push({ kind: 'text', value: str.slice(last) });
    return out;
  }

  const promptTokens = $derived(tokenizePromptText(currentLineObj.text));

  $effect(() => {
    const _mode = audioSession.mode;
    const _cid = audioSession.activeCheckupId;
    repaintCanvas();
  });

  async function onFilePicked(e) {
    const file = e.target?.files?.[0];
    if (file) {
      await audioSession.importAudioFile(file);
    }
    if (e.target) e.target.value = '';
  }
</script>

<div class="rec-page">
  <!-- 模式切换分段栏 -->
  <div class="mode-tabs" role="tablist" aria-label="练习模式">
    <button
      type="button"
      role="tab"
      aria-selected={audioSession.mode === 'free'}
      class="mode-tab {audioSession.mode === 'free' ? 'active' : ''}"
      onclick={() => audioSession.setMode('free')}
      disabled={audioSession.recording || audioSession.analyzing}
    >
      自由说
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={audioSession.mode === 'script'}
      class="mode-tab {audioSession.mode === 'script' ? 'active' : ''}"
      onclick={() => { audioSession.setMode('script'); refreshLibraryView(); }}
      disabled={audioSession.recording || audioSession.analyzing}
    >
      读素材
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={audioSession.mode === 'checkup'}
      class="mode-tab {audioSession.mode === 'checkup' ? 'active' : ''}"
      onclick={() => audioSession.setMode('checkup')}
      disabled={audioSession.recording || audioSession.analyzing}
    >
      做测试
    </button>
  </div>

  <!-- 第一层：主视觉舞台卡片 -->
  <div class="summary-sheet rec-stage-card">
    {#if audioSession.mode === 'script' && activeSet}
      <div class="script-header">
        <div class="script-meta">
          <span class="cat-badge">{catLabel(activeSet.category)}</span>
          <strong class="script-title">{activeSet.name}</strong>
        </div>
        <button
          type="button"
          class="link-pill"
          onclick={() => ui.navigate('library')}
          disabled={audioSession.recording}
        >
          切换素材 →
        </button>
      </div>

      {#if activeSet.tags && activeSet.tags.length}
        <div class="tag-row">
          {#each activeSet.tags as tag}
            <span class="tag-chip">#{tag}</span>
          {/each}
        </div>
      {/if}

      <div class="prompt-box">
        {#if activeSet.tip}
          <div class="prompt-tip">{activeSet.tip}</div>
        {/if}
        {#if currentLineObj.cue}
          <div class="prompt-cue-pill">{currentLineObj.cue}</div>
        {/if}
        <div class="prompt-line">
          {#each promptTokens as tk}
            {#if tk.kind === 'text'}{tk.value}{:else if tk.kind === 'pause'}<span class="pm-pause" aria-label="轻停顿">{tk.value}</span>{:else if tk.kind === 'breath'}<span class="pm-breath">{tk.value}</span>{:else if tk.kind === 'up'}<span class="pm-up" aria-label="语调微扬">{tk.value}</span>{:else if tk.kind === 'down'}<span class="pm-down" aria-label="语调轻落">{tk.value}</span>{/if}
          {/each}
        </div>
        {#if currentLineObj.note}
          <div class="prompt-note">{currentLineObj.note}</div>
        {/if}
        <div class="prompt-nav">
          <button
            type="button"
            class="mini-nav-btn"
            onclick={() => audioSession.prevLine(activeSet.lines.length)}
          >
            ← 上一句
          </button>
          <span class="tnum prompt-idx">
            {(audioSession.lineIdx % activeSet.lines.length) + 1} / {activeSet.lines.length}
          </span>
          <button
            type="button"
            class="mini-nav-btn"
            onclick={() => audioSession.nextLine(activeSet.lines.length)}
          >
            下一句 →
          </button>
        </div>
      </div>
    {:else if audioSession.mode === 'checkup'}
      <div class="checkup-box">
        <div class="checkup-tabs" role="tablist" aria-label="测试项目">
          {#each CHECKUP_ITEMS as item (item.id)}
            <button
              type="button"
              role="tab"
              aria-selected={audioSession.activeCheckupId === item.id}
              class="checkup-pill {audioSession.activeCheckupId === item.id ? 'active' : ''}"
              onclick={() => audioSession.setActiveCheckup(item.id)}
              disabled={audioSession.recording || audioSession.analyzing}
            >
              {item.shortLabel}
            </button>
          {/each}
        </div>
        <div class="checkup-head">
          <span class="cat-badge cat-mint">{activeCheckup.badge}</span>
          <strong>{activeCheckup.name}</strong>
        </div>
        <div class="checkup-prompt-box">
          <div class="prompt-line">{activeCheckup.prompt}</div>
          <div class="checkup-cue">{activeCheckup.vowelHint}</div>
        </div>
        <div class="checkup-steps">
          <div class="step-pill {audioSession.recording ? 'step-active' : ''}">
            <span class="step-dot" aria-hidden="true"></span>
            <span>{activeCheckup.focus}</span>
          </div>
          {#if activeCheckup.detailTip}
            <details class="checkup-detail-tip">
              <summary>？ 怎么测更准</summary>
              <p>{activeCheckup.detailTip}</p>
            </details>
          {/if}
        </div>
      </div>
    {:else}
      <div class="free-box">
        <span class="cat-badge cat-sky">自然表达</span>
        <p class="free-cue">用舒服自然的音量聊几句话，或读手边一段文字，不用刻意追求高音。</p>
      </div>
    {/if}

    <div
      class="live-canvas-wrap"
      role="img"
      aria-label={isUnvoicedCheck ? '清擦音练习：纯吹气无声带基频曲线' : `实时音高曲线与参考底线（${settings.floorTargetHz} Hz）`}
    >
      <canvas bind:this={canvasEl} class="live-canvas" aria-hidden="true"></canvas>
    </div>

    <!-- 三个简洁实时卡 -->
    <div class="live-tiles">
      {#if isUnvoicedCheck}
        <div class="live-tile">
          <span class="tile-label">实时音高</span>
          <span class="tile-val-sm">不适用</span>
          <span class="tile-sub">纯吹气无基频</span>
        </div>
        <div class="live-tile">
          <span class="tile-label">发声轻重</span>
          <span class="tile-chip tone-neutral">声带不振动</span>
          <span class="tile-sub">专注前唇齿气流</span>
        </div>
        <div class="live-tile">
          <span class="tile-label">高频重心</span>
          <span class="tile-chip tone-neutral">{audioSession.recording ? '采集中' : '结束后测算'}</span>
          <span class="tile-sub">目标 6.0~8.5 kHz</span>
        </div>
      {:else}
        <div class="live-tile">
          <span class="tile-label">实时音高</span>
          {#if audioSession.liveHz}
            <span class="tile-val tnum">{audioSession.liveHz} Hz</span>
            <span class="tile-sub">{audioSession.liveNote}</span>
          {:else}
            <span class="tile-chip tone-neutral">等候发声</span>
            <span class="tile-sub">开口即实时描点</span>
          {/if}
        </div>
        <div class="live-tile">
          <span class="tile-label">发声轻重</span>
          <span class="tile-chip tone-{h1h2Hint.tone}">{h1h2Hint.text}</span>
          <span class="tile-sub tnum">{audioSession.liveH1H2 != null ? `H1-H2 ${audioSession.liveH1H2 > 0 ? '+' : ''}${audioSession.liveH1H2} dB` : 'H1-H2 待测'}</span>
        </div>
        <div class="live-tile">
          <span class="tile-label">音色明暗</span>
          <span class="tile-chip tone-{brightHint.tone}">{brightHint.text}</span>
          <span class="tile-sub">仅供参考</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- 自由照镜一次结果反馈条 -->
  {#if audioSession.mirrorResult}
    <div class="mirror-banner" role="status">
      <span class="mirror-msg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12h3l2.5-6 4 12 3-8 2.5 4 2-2H22"></path>
        </svg>
        <span>{audioSession.mirrorResult.summary}</span>
      </span>
      <button type="button" class="mirror-close" aria-label="关闭提示" onclick={() => { audioSession.mirrorResult = null; }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  {/if}

  <!-- 第三层：规范两列平衡操作区（左侧手帐开关与导入音频，右侧主录音键与状态提示） -->
  <div class="rec-dock">
    <div class="dock-left">
      <button
        type="button"
        role="switch"
        aria-checked={audioSession.saveToJournal}
        class="journal-switch-pill {audioSession.saveToJournal ? 'is-on' : 'is-off'}"
        onclick={() => audioSession.toggleSaveToJournal()}
        disabled={audioSession.recording || audioSession.analyzing}
      >
        <span class="jsw-label">记入手帐</span>
        <span class="jsw-track" aria-hidden="true">
          <span class="jsw-state">{audioSession.saveToJournal ? '开' : '关'}</span>
          <span class="jsw-knob"></span>
        </span>
      </button>

      <button
        type="button"
        class="import-pill"
        onclick={() => fileInputEl?.click()}
        disabled={audioSession.recording || audioSession.analyzing}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>导入音频</span>
      </button>
      <input
        bind:this={fileInputEl}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg"
        class="sr-hidden"
        onchange={onFilePicked}
      />
    </div>

    <div class="dock-right">
      <button
        type="button"
        class="mic-ring-btn {audioSession.recording ? 'is-live' : ''}"
        disabled={audioSession.analyzing}
        onclick={() => audioSession.recording ? audioSession.stopRecording() : audioSession.startRecording()}
        aria-label={audioSession.recording ? '结束录音并分析' : '开始录音'}
      >
        <span class="mic-inner-dot">
          {#if audioSession.recording}
            <span class="stop-square"></span>
          {:else}
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          {/if}
        </span>
      </button>
      <div class="mic-hint tnum {audioSession.recording || audioSession.analyzing ? 'is-live' : ''}">
        {#if audioSession.recording}
          点击结束 · {formatTimer(audioSession.elapsedSec)} / {settings.maxRecSecs}s
        {:else if audioSession.analyzing}
          正在整理手账…
        {:else}
          点击开始录音
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .rec-page {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .mode-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 5px;
    background: var(--paper-card);
    border: 1px solid var(--border-soft);
    border-radius: 999px;
    box-shadow: var(--shadow);
  }

  .mode-tab {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-2);
    font-family: var(--font-ui);
    font-size: var(--fs-13);
    font-weight: 500;
    padding: 8px 6px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
    white-space: nowrap;
  }
  .mode-tab.active {
    background: var(--crayon-coral-soft);
    color: var(--crayon-coral-ink);
    border-color: var(--crayon-coral);
    font-weight: 600;
    box-shadow: var(--shadow);
  }
  .mode-tab:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .rec-stage-card {
    margin-bottom: 0;
  }

  .script-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .script-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .script-title {
    font-size: var(--fs-14);
    color: var(--ink-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cat-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: var(--fs-10);
    font-weight: 600;
    background: var(--crayon-amber-soft);
    color: var(--crayon-amber-ink);
    flex-shrink: 0;
  }
  .cat-badge.cat-mint {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
  }
  .cat-badge.cat-sky {
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
  }

  .link-pill {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 999px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }
  .tag-chip {
    font-size: var(--fs-10);
    color: var(--ink-3);
    background: var(--paper-3);
    padding: 2px 7px;
    border-radius: 999px;
  }

  .prompt-box {
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    margin-bottom: 12px;
    border: 1px solid var(--hairline);
  }
  .prompt-tip {
    font-size: var(--fs-11);
    color: var(--crayon-lavender-ink);
    background: var(--crayon-lavender-soft);
    border-radius: var(--radius-xs);
    padding: 6px 9px;
    line-height: 1.45;
    margin-bottom: 8px;
  }
  .prompt-cue-pill {
    display: inline-block;
    font-size: var(--fs-10);
    font-weight: 600;
    color: var(--crayon-mint-ink);
    background: var(--crayon-mint-soft);
    padding: 2px 8px;
    border-radius: 999px;
    margin-bottom: 5px;
  }
  .prompt-line {
    font-size: var(--fs-15);
    font-weight: 600;
    color: var(--ink-1);
    line-height: 1.55;
    min-height: 44px;
  }
  .prompt-note {
    margin-top: 6px;
    font-size: var(--fs-12);
    color: var(--ink-3);
    line-height: 1.45;
  }
  .pm-pause {
    display: inline-block;
    margin: 0 3px;
    color: var(--ink-3);
    font-weight: 700;
  }
  .pm-breath {
    display: inline-block;
    margin: 0 4px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: var(--fs-10);
    font-weight: 600;
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
    vertical-align: middle;
  }
  .pm-up {
    display: inline-block;
    margin: 0 2px;
    color: var(--crayon-sky-ink);
    font-weight: 700;
  }
  .pm-down {
    display: inline-block;
    margin: 0 2px;
    color: var(--crayon-amber-ink);
    font-weight: 700;
  }
  .checkup-detail-tip {
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    padding: 7px 10px;
    font-size: var(--fs-12);
    color: var(--ink-2);
  }
  .checkup-detail-tip summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--crayon-sky-ink);
  }
  .checkup-detail-tip p {
    margin: 6px 0 0;
    line-height: 1.5;
  }
  .prompt-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  .mini-nav-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-2);
    font-size: var(--fs-12);
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
  }
  .prompt-idx {
    font-size: var(--fs-12);
    color: var(--ink-3);
  }

  .checkup-box {
    margin-bottom: 10px;
  }
  .checkup-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .checkup-pill {
    flex-shrink: 0;
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 999px;
    cursor: pointer;
  }
  .checkup-pill.active {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
    border-color: var(--crayon-mint);
  }
  .checkup-pill:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .checkup-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: var(--fs-14);
    color: var(--ink-1);
    flex-wrap: wrap;
  }
  .checkup-prompt-box {
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    margin-bottom: 8px;
    border: 1px solid var(--hairline);
  }
  .checkup-cue {
    margin-top: 4px;
    font-size: var(--fs-12);
    color: var(--ink-3);
    line-height: 1.45;
  }
  .checkup-steps {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .step-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 11px;
    border-radius: var(--radius-sm);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-12);
    border: 1px solid var(--hairline);
  }
  .step-pill.step-active {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
    border-color: var(--crayon-mint);
    font-weight: 600;
  }
  .step-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--crayon-mint);
    flex-shrink: 0;
  }

  .free-box {
    margin-bottom: 8px;
  }
  .free-cue {
    margin: 6px 0 0;
    font-size: var(--fs-13);
    color: var(--ink-2);
    line-height: 1.5;
  }

  .live-canvas-wrap {
    width: 100%;
    height: 138px;
    margin-bottom: 10px;
  }
  .live-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .live-tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .live-tile {
    background: var(--paper-3);
    border-radius: var(--radius-sm);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    border: 1px solid var(--hairline);
    min-width: 0;
  }
  .tile-label {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }
  .tile-val {
    font-size: var(--fs-16);
    font-weight: 700;
    color: var(--ink-1);
  }
  .tile-val-sm {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-2);
  }
  .tile-sub {
    font-size: var(--fs-10);
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .tile-chip {
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tone-neutral { background: var(--paper-card); color: var(--ink-3); }
  .tone-coral   { background: var(--crayon-coral-soft); color: var(--crayon-coral-ink); }
  .tone-amber   { background: var(--crayon-amber-soft); color: var(--crayon-amber-ink); }
  .tone-mint    { background: var(--crayon-mint-soft); color: var(--crayon-mint-ink); }
  .tone-sky     { background: var(--crayon-sky-soft); color: var(--crayon-sky-ink); }

  .mirror-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
    font-size: var(--fs-13);
    font-weight: 600;
    border: 1px solid var(--border-soft);
  }
  .mirror-msg {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .mirror-close {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .rec-dock {
    width: 100%;
    max-width: 360px;
    margin: 2px auto 4px;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .dock-left {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 7px;
    flex: 0 1 auto;
  }

  .dock-right {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 112px;
    flex-shrink: 0;
  }

  .journal-switch-pill {
    appearance: none;
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-1);
    font-size: var(--fs-13);
    font-weight: 600;
    padding: 6px 8px 6px 13px;
    border-radius: 999px;
    box-shadow: var(--shadow);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    transition: border-color 0.2s ease, transform 0.12s ease;
  }
  .journal-switch-pill:active:not(:disabled),
  .import-pill:active:not(:disabled) {
    transform: scale(0.96);
  }
  .journal-switch-pill.is-on {
    border-color: var(--crayon-mint);
  }
  .journal-switch-pill:disabled,
  .import-pill:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .jsw-label {
    color: var(--ink-1);
    white-space: nowrap;
  }
  .jsw-track {
    position: relative;
    width: 46px;
    height: 24px;
    border-radius: 999px;
    background: var(--paper-groove);
    border: 1px solid var(--border-soft);
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  .journal-switch-pill.is-on .jsw-track {
    background: var(--crayon-mint);
    border-color: var(--crayon-mint);
  }
  .jsw-state {
    font-size: var(--fs-11);
    font-weight: 700;
    line-height: 1;
    width: 100%;
    transition: color 0.2s ease;
  }
  .journal-switch-pill.is-on .jsw-state {
    color: var(--rose-on);
    text-align: left;
  }
  .journal-switch-pill.is-off .jsw-state {
    color: var(--ink-3);
    text-align: right;
  }
  .jsw-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--paper-2);
    box-shadow: var(--shadow);
    transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .journal-switch-pill.is-on .jsw-knob {
    transform: translateX(22px);
  }

  .import-pill {
    appearance: none;
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-2);
    font-size: var(--fs-13);
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 999px;
    box-shadow: var(--shadow);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    transition: transform 0.12s ease, border-color 0.16s ease;
  }

  .mic-ring-btn {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 4px solid var(--paper-card);
    background: var(--crayon-coral-soft);
    padding: 4px;
    box-shadow: var(--shadow-card);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.14s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .mic-ring-btn:active:not(:disabled) {
    transform: scale(0.94);
  }
  .mic-ring-btn.is-live {
    background: var(--crayon-coral);
    box-shadow: var(--shadow-lift);
  }
  .mic-ring-btn.is-live::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px solid var(--crayon-coral-soft);
    animation: micRipple 2.2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes micRipple {
    0%, 100% { transform: scale(0.97); opacity: 0.7; }
    50% { transform: scale(1.09); opacity: 0.22; }
  }

  .mic-inner-dot {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--crayon-coral);
    color: var(--rose-on);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mic-ring-btn.is-live .mic-inner-dot {
    background: var(--paper-card);
    color: var(--crayon-coral);
  }

  .stop-square {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-xs);
    background: var(--crayon-coral);
  }

  .mic-hint {
    font-size: var(--fs-11);
    color: var(--ink-3);
    white-space: nowrap;
  }
  .mic-hint.is-live {
    color: var(--crayon-coral-ink);
    background: var(--crayon-coral-soft);
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 600;
  }

  .sr-hidden {
    display: none;
  }
</style>
