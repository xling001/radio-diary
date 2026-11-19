<script>
  import { onMount } from 'svelte';
  import { exportBatchMarkdown, normalizeStats, pitchName } from '../../core/index.js';
  import { TakeStore, subscribeTakes } from '../../store/takes.js';
  import { SelfCheckStore } from '../../store/selfCheck.js';
  import { ui } from '../../state/ui.svelte.js';
  import { settings } from '../../state/settings.svelte.js';
  import { confirmDlg } from '../../ui/dialog.js';
  import Empty from '../../ui/Empty.svelte';
  import { audioSession } from '../record/audioSession.svelte.js';
  import { paintHeatmap, paintTrendChart } from './charts.js';
  import SelfCheckModal from './SelfCheckModal.svelte';

  const OPEN_MAP_KEY = 'tv.jGroupOpenMap';

  let takes = $state([]);
  let loading = $state(true);
  let filterFav = $state(false);
  let trendMetric = $state('pitch'); // 'pitch' | 'weight'
  let batchMode = $state(false);
  let selectedIds = $state(new Set());
  let groupOpenMap = $state(loadOpenMap());

  let heatmapCanvas = $state(null);
  let trendCanvas = $state(null);

  let selfChecks = $state(SelfCheckStore.all());
  let showSelfCheckModal = $state(false);
  let showSelfHistory = $state(false);

  const latestSelfCheck = $derived(selfChecks[0] || null);
  const selfCycleHint = $derived.by(() => {
    if (!selfChecks.length) return '建议每周记一次';
    const days = SelfCheckStore.daysSinceLatest();
    if (days === 0) return '今天已记录 ✓';
    if (days !== null && days < 7) return `距上次 ${days} 天`;
    return `距上次 ${days ?? 7} 天 · 可记一次`;
  });

  function reloadSelfChecks() {
    selfChecks = SelfCheckStore.all();
  }

  function handleSaveSelfCheck(entry) {
    SelfCheckStore.add(entry);
    reloadSelfChecks();
    showMsg('已将这次主观自评收进手帐');
  }

  async function handleDeleteSelfCheck(item) {
    const ok = await confirmDlg('删掉这条主观自评？', '删掉后无法恢复，录音记录不会受影响。', '删掉', '先留着', true);
    if (!ok) return;
    selfChecks = SelfCheckStore.remove(item.id);
    if (!selfChecks.length) showSelfHistory = false;
    showMsg('已删除一条主观自评');
  }

  function loadOpenMap() {
    try {
      return JSON.parse(localStorage.getItem(OPEN_MAP_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function saveOpenMap(map) {
    try {
      localStorage.setItem(OPEN_MAP_KEY, JSON.stringify(map));
    } catch {}
  }

  async function refreshTakes() {
    loading = true;
    try {
      takes = await TakeStore.all();
    } finally {
      loading = false;
      requestAnimationFrame(drawCharts);
    }
  }

  function drawCharts() {
    if (heatmapCanvas) paintHeatmap(heatmapCanvas, takes);
    if (trendCanvas) paintTrendChart(trendCanvas, takes, trendMetric, settings.floorTargetHz);
  }

  onMount(() => {
    refreshTakes();
    const unsubUi = ui.subscribe((route) => {
      if (route.view === 'history') {
        refreshTakes();
        reloadSelfChecks();
      }
    });
    const unsubTakes = subscribeTakes(() => refreshTakes());
    const onTheme = () => requestAnimationFrame(drawCharts);
    window.addEventListener('tv-theme-change', onTheme);
    window.addEventListener('resize', drawCharts);
    return () => {
      unsubUi();
      unsubTakes();
      window.removeEventListener('tv-theme-change', onTheme);
      window.removeEventListener('resize', drawCharts);
    };
  });

  $effect(() => {
    const _m = trendMetric;
    const _f = settings.floorTargetHz;
    requestAnimationFrame(drawCharts);
  });

  function showMsg(msg) {
    if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
      window.showNotice(msg);
    }
  }

  function dayKey(ts) {
    const d = new Date(ts || Date.now());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDayTitle(key) {
    const todayKey = dayKey(Date.now());
    const yestKey = dayKey(Date.now() - 86400000);
    if (key === todayKey) return `${key} · 今天`;
    if (key === yestKey) return `${key} · 昨天`;
    return key;
  }

  function formatTimeOnly(ts) {
    const d = new Date(ts || Date.now());
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const streakDays = $derived.by(() => {
    const days = new Set(takes.map((t) => dayKey(t.ts)));
    if (!days.size) return 0;
    let count = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!days.has(dayKey(cursor.getTime()))) {
      cursor = new Date(cursor.getTime() - 86400000);
    }
    while (days.has(dayKey(cursor.getTime()))) {
      count += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return count;
  });

  const favCount = $derived(takes.filter((t) => t.fav).length);

  const visibleTakes = $derived(filterFav ? takes.filter((t) => t.fav) : takes);

  const groupedDays = $derived.by(() => {
    const groups = new Map();
    for (const t of visibleTakes) {
      const k = dayKey(t.ts);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    return [...groups.entries()].map(([key, items], idx) => ({
      key,
      items,
      isOpen: groupOpenMap[key] !== undefined ? groupOpenMap[key] : idx === 0,
    }));
  });

  function toggleGroup(key, current) {
    const next = { ...groupOpenMap, [key]: !current };
    groupOpenMap = next;
    saveOpenMap(next);
  }

  function openTakeAnalysis(t) {
    if (batchMode) {
      const next = new Set(selectedIds);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      selectedIds = next;
      return;
    }
    audioSession.selectedTakeId = t.id;
    ui.navigate(`analysis/${t.id}`);
  }

  async function toggleFav(e, t) {
    e.stopPropagation();
    await TakeStore.put({ ...t, fav: !t.fav });
  }

  async function handleBatchExportAi() {
    const chosen = takes.filter((t) => selectedIds.has(t.id));
    if (chosen.length < 2) {
      showMsg('请至少勾选 2 条录音进行横向对比');
      return;
    }
    await exportBatchMarkdown(chosen);
    showMsg(`已导出 ${chosen.length} 条对比手账给 AI`);
    batchMode = false;
    selectedIds = new Set();
  }

  async function handleBatchDelete() {
    const count = selectedIds.size;
    if (!count) return;
    const ok = await confirmDlg(`删除选中的 ${count} 条录音？`, '删除后将无法恢复。', '删除', '先留着', true);
    if (!ok) return;
    for (const id of selectedIds) {
      await TakeStore.remove(id);
    }
    await settings.refreshMetrics();
    selectedIds = new Set();
    batchMode = false;
    showMsg(`已删除 ${count} 条记录`);
  }
  const MOOD_EMOJI_FALLBACK = {
    '轻松': '😊',
    '平稳': '😌',
    '顺畅满意': '✨',
    '很喜欢': '🌸',
    '摸索中': '🤔',
    '有点累': '😮‍💨',
    '略干紧': '💧',
    '抱抱自己': '🫂',
  };

  const MOOD_TONE_MAP = {
    '轻松': 'mint',
    '平稳': 'sky',
    '顺畅满意': 'mint',
    '很喜欢': 'coral',
    '摸索中': 'lavender',
    '有点累': 'indigo',
    '略干紧': 'lavender',
    '抱抱自己': 'coral',
  };

  function parseMoodSeal(stamp) {
    const raw = String(stamp?.mood || '').trim();
    if (!raw) return null;
    const labelOnly = raw.replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D\s]+/gu, '').trim() || raw;
    const tone = stamp?.tone || MOOD_TONE_MAP[labelOnly] || 'mint';
    if (/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(raw)) return { text: raw, tone };
    const emoji = MOOD_EMOJI_FALLBACK[raw] || '';
    return { text: emoji ? `${emoji} ${raw}` : raw, tone };
  }
</script>

<div class="hist-page">
  {#if loading && !takes.length}
    <div class="summary-sheet empty-wrap">正在翻开你的声音手账…</div>
  {:else if !takes.length}
    <div class="summary-sheet">
      <Empty
        title="手账还是空白的"
        desc="开始录第一段声音，每天的点滴变化都会温柔地沉淀在这里。"
        actionText="去练习"
        onaction={() => ui.navigate('record')}
      />
    </div>
  {:else}
    <!-- 第一层：热力图与趋势舞台卡 -->
    <div class="summary-sheet hist-stage">
      <div class="hist-stats-row">
        <div class="stat-box">
          <span class="stat-val tnum">{takes.length}</span>
          <span class="stat-lbl">总记录</span>
        </div>
        <div class="stat-box">
          <span class="stat-val tnum">{streakDays} 天</span>
          <span class="stat-lbl">连续练习</span>
        </div>
        <div class="stat-box">
          <span class="stat-val tnum">{favCount}</span>
          <span class="stat-lbl">已收藏</span>
        </div>
      </div>

      <canvas bind:this={heatmapCanvas} class="heatmap-canvas"></canvas>

      <div class="trend-head">
        <span class="trend-title">练习走势</span>
        <div class="trend-tabs">
          <button
            type="button"
            class="trend-tab {trendMetric === 'pitch' ? 'active' : ''}"
            onclick={() => { trendMetric = 'pitch'; requestAnimationFrame(drawCharts); }}
          >
            <span class="trend-dot dot-sky" aria-hidden="true"></span>
            <span>音高 Hz</span>
          </button>
          <button
            type="button"
            class="trend-tab {trendMetric === 'weight' ? 'active' : ''}"
            onclick={() => { trendMetric = 'weight'; requestAnimationFrame(drawCharts); }}
          >
            <span class="trend-dot dot-amber" aria-hidden="true"></span>
            <span>发声轻重 H1-H2</span>
          </button>
        </div>
      </div>

      <canvas bind:this={trendCanvas} class="trend-canvas"></canvas>
    </div>
  {/if}

  <!-- 主观自评小记（无录音时也可独立记录，建议每周一次） -->
  <div class="summary-sheet self-card">
    <div class="self-head">
      <div>
        <div class="self-title-row">
          <span class="self-title">每周主观自评</span>
          <span class="self-cycle-pill">{selfCycleHint}</span>
        </div>
        <div class="self-sub">不看曲线，只记当下嗓音松弛度与说话自在感</div>
      </div>
      <button type="button" class="self-add-btn" onclick={() => { showSelfCheckModal = true; }}>
        + 写自评
      </button>
    </div>

    {#if latestSelfCheck}
      <div class="self-latest">
        <div class="self-latest-top">
          <span class="mood-tag tone-{latestSelfCheck.tone || 'sky'}">{latestSelfCheck.mood}</span>
          <span class="self-date tnum">{dayKey(latestSelfCheck.ts)} {formatTimeOnly(latestSelfCheck.ts)}</span>
          {#if selfChecks.length > 1}
            <button type="button" class="self-hist-toggle" onclick={() => { showSelfHistory = !showSelfHistory; }}>
              {showSelfHistory ? '收起历史' : `全部 ${selfChecks.length} 条`}
            </button>
          {:else}
            <button type="button" class="self-del-link" onclick={() => handleDeleteSelfCheck(latestSelfCheck)}>
              删除
            </button>
          {/if}
        </div>
        <div class="self-scores tnum">
          <span>舒适 {latestSelfCheck.comfort}/5</span>
          <span>·</span>
          <span>专注 {latestSelfCheck.focus}/5</span>
          <span>·</span>
          <span>自在 {latestSelfCheck.ease}/5</span>
        </div>
        {#if latestSelfCheck.note}
          <div class="self-note">{latestSelfCheck.note}</div>
        {/if}
      </div>

      {#if showSelfHistory && selfChecks.length > 1}
        <div class="self-hist-list">
          {#each selfChecks as sc (sc.id)}
            <div class="self-hist-row">
              <div class="self-hist-main">
                <div class="self-latest-top">
                  <span class="mood-tag tone-{sc.tone || 'sky'}">{sc.mood}</span>
                  <span class="self-date tnum">{dayKey(sc.ts)} {formatTimeOnly(sc.ts)}</span>
                </div>
                <div class="self-scores tnum">
                  <span>舒适 {sc.comfort}/5</span>
                  <span>·</span>
                  <span>专注 {sc.focus}/5</span>
                  <span>·</span>
                  <span>自在 {sc.ease}/5</span>
                </div>
                {#if sc.note}
                  <div class="self-note">{sc.note}</div>
                {/if}
              </div>
              <button type="button" class="self-del-link" onclick={() => handleDeleteSelfCheck(sc)}>
                删除
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if !loading && takes.length}
    <!-- 第二层：筛选与批量对比条 -->
    <div class="filter-bar">
      <div class="row-gap-sm">
        <button
          type="button"
          class="pill-toggle {!filterFav ? 'active' : ''}"
          onclick={() => { filterFav = false; }}
        >
          全部 ({takes.length})
        </button>
        <button
          type="button"
          class="pill-toggle {filterFav ? 'active' : ''}"
          onclick={() => { filterFav = true; }}
        >
          收藏 ({favCount})
        </button>
      </div>

      <button
        type="button"
        class="pill-toggle {batchMode ? 'active-sky' : ''}"
        onclick={() => {
          batchMode = !batchMode;
          selectedIds = new Set();
        }}
      >
        {batchMode ? '完成选择' : '多选对比'}
      </button>
    </div>

    {#if batchMode}
      <div class="batch-bar">
        <span class="batch-cnt">已选 {selectedIds.size} 条</span>
        <div class="row-gap-sm">
          <button
            type="button"
            class="batch-btn btn-sky"
            disabled={selectedIds.size < 2}
            onclick={handleBatchExportAi}
          >
            导出对比 (.md)
          </button>
          <button
            type="button"
            class="batch-btn btn-danger"
            disabled={selectedIds.size < 1}
            onclick={handleBatchDelete}
          >
            删除
          </button>
        </div>
      </div>
    {/if}

    <!-- 第三层：按天折叠的手账列表 -->
    <div class="day-groups">
      {#each groupedDays as grp (grp.key)}
        <div class="summary-sheet day-card">
          <button
            type="button"
            class="day-head {grp.isOpen ? 'is-open' : ''}"
            onclick={() => toggleGroup(grp.key, grp.isOpen)}
          >
            <span class="day-title">{formatDayTitle(grp.key)}</span>
            <span class="day-meta">
              <span>{grp.items.length} 条</span>
              <svg class="day-chev {grp.isOpen ? 'open' : ''}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
          </button>

          {#if grp.isOpen}
            <div class="take-list">
              {#each grp.items as t (t.id)}
                {@const tNorm = normalizeStats(t)}
                {@const f0 = tNorm.medianF0}
                {@const h12 = tNorm.h1h2}
                {@const checked = selectedIds.has(t.id)}
                {@const seal = t.stamp?.mood ? parseMoodSeal(t.stamp) : null}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="take-item {checked ? 'is-selected' : ''}"
                  role="button"
                  tabindex="0"
                  onclick={() => openTakeAnalysis(t)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openTakeAnalysis(t); }}
                >
                  {#if batchMode}
                    <span class="check-dot {checked ? 'checked' : ''}">{checked ? '✓' : ''}</span>
                  {/if}

                  <div class="take-main">
                    <div class="take-top">
                      <strong class="take-name">{t.setName || '自由表达'}</strong>
                      <span class="take-time tnum">{formatTimeOnly(t.ts)}</span>
                      {#if seal}
                        <span class="mood-tag tone-{seal.tone}" title={t.stamp.throat || ''}>{seal.text}</span>
                      {/if}
                    </div>
                    <div class="take-metrics tnum">
                      <span>{f0 ? `${Math.round(f0)} Hz (${pitchName(f0)})` : '音高未测出'}</span>
                      <span>·</span>
                      <span>{h12 != null ? `H1-H2 ${h12 > 0 ? '+' : ''}${h12.toFixed(1)} dB` : '开商待测'}</span>
                    </div>
                  </div>

                  {#if !batchMode}
                    <button
                      type="button"
                      class="fav-btn {t.fav ? 'is-fav' : ''}"
                      onclick={(e) => toggleFav(e, t)}
                      aria-label="切换收藏"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={t.fav ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<SelfCheckModal
  open={showSelfCheckModal}
  onsave={handleSaveSelfCheck}
  onclose={() => { showSelfCheckModal = false; }}
/>

<style>
  .hist-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .empty-wrap {
    text-align: center;
    padding: 32px 16px;
    color: var(--ink-3);
  }

  .hist-stage {
    margin-bottom: 0;
  }

  .hist-stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .stat-box {
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 9px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-val {
    font-size: var(--fs-18);
    font-weight: 700;
    color: var(--ink-1);
  }
  .stat-lbl {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }

  .heatmap-canvas {
    width: 100%;
    height: 116px;
    display: block;
    margin-bottom: 12px;
  }

  .trend-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .trend-title {
    font-size: var(--fs-13);
    font-weight: 700;
    color: var(--ink-1);
  }
  .trend-tabs {
    display: inline-flex;
    background: var(--paper-3);
    padding: 3px;
    border-radius: 999px;
    gap: 2px;
  }
  .trend-tab {
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-2);
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .trend-tab.active {
    background: var(--paper-card);
    color: var(--ink-1);
    border-color: var(--border-soft);
    box-shadow: var(--shadow);
  }
  .trend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    opacity: 0.45;
    flex-shrink: 0;
  }
  .trend-tab.active .trend-dot {
    opacity: 1;
  }
  .trend-dot.dot-sky { background: var(--crayon-sky); }
  .trend-dot.dot-amber { background: var(--crayon-amber); }

  .trend-canvas {
    width: 100%;
    height: 152px;
    display: block;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .pill-toggle {
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: var(--shadow);
  }
  .pill-toggle.active {
    background: var(--crayon-coral-soft);
    color: var(--crayon-coral-ink);
    border-color: var(--crayon-coral);
  }
  .pill-toggle.active-sky {
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
    border-color: var(--crayon-sky);
  }

  .batch-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    background: var(--crayon-sky-soft);
    border-radius: var(--radius-md);
  }
  .batch-cnt {
    font-size: var(--fs-13);
    font-weight: 600;
    color: var(--crayon-sky-ink);
  }
  .batch-btn {
    border: none;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: var(--fs-12);
    font-weight: 600;
    cursor: pointer;
  }
  .batch-btn.btn-sky {
    background: var(--crayon-sky);
    color: var(--rose-on);
  }
  .batch-btn.btn-danger {
    background: var(--crayon-coral-soft);
    color: var(--danger-ink);
  }
  .batch-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .day-groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .day-card {
    margin-bottom: 0;
    padding: 12px 14px;
  }
  .day-head {
    width: 100%;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    padding: 2px 0;
    text-align: left;
  }
  .day-head.is-open {
    border-bottom: 1px dashed var(--border-soft);
    padding-bottom: 8px;
  }
  .day-title {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .day-title::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 3px;
    background: var(--crayon-mint);
    flex-shrink: 0;
  }
  .day-meta {
    font-size: var(--fs-12);
    color: var(--ink-3);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .day-chev {
    transition: transform 0.2s ease;
  }
  .day-chev.open {
    transform: rotate(90deg);
  }

  .take-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .take-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 11px 12px;
    border: 1px solid var(--hairline);
    cursor: pointer;
  }
  .take-item.is-selected {
    border-color: var(--crayon-sky);
    background: var(--crayon-sky-soft);
  }

  .check-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid var(--ink-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-12);
    flex-shrink: 0;
  }
  .check-dot.checked {
    background: var(--crayon-sky);
    border-color: var(--crayon-sky);
    color: var(--rose-on);
  }

  .take-main {
    flex: 1;
    min-width: 0;
  }
  .take-top {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }
  .take-name {
    font-size: var(--fs-13);
    color: var(--ink-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .take-time {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }
  .mood-tag {
    font-size: var(--fs-10);
    font-weight: 600;
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
    border: 1px solid var(--hairline);
    box-shadow: inset 0 1px 0 var(--seal-highlight);
    padding: 2px 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .mood-tag.tone-coral {
    background: var(--crayon-coral-soft);
    color: var(--crayon-coral-ink);
  }
  .mood-tag.tone-sky {
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
  }
  .mood-tag.tone-lavender {
    background: var(--crayon-lavender-soft);
    color: var(--crayon-lavender-ink);
  }
  .mood-tag.tone-indigo {
    background: var(--crayon-indigo-soft);
    color: var(--crayon-indigo-ink);
  }
  .take-metrics {
    display: flex;
    gap: 6px;
    font-size: var(--fs-11);
    color: var(--ink-2);
  }

  .fav-btn {
    border: none;
    background: transparent;
    font-size: var(--fs-18);
    color: var(--ink-3);
    cursor: pointer;
    padding: 4px;
  }
  .fav-btn.is-fav {
    color: var(--crayon-amber);
  }

  .self-card {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .self-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .self-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }
  .self-title {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .self-cycle-pill {
    font-size: var(--fs-10);
    font-weight: 600;
    color: var(--crayon-lavender-ink);
    background: var(--crayon-lavender-soft);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .self-sub {
    font-size: var(--fs-11);
    color: var(--ink-3);
    margin-top: 3px;
  }
  .self-add-btn {
    border: none;
    background: var(--crayon-coral-soft);
    color: var(--crayon-coral-ink);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .self-latest {
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .self-latest-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .self-date {
    font-size: var(--fs-11);
    color: var(--ink-3);
    margin-right: auto;
  }
  .self-scores {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-12);
    font-weight: 600;
    color: var(--ink-2);
  }
  .self-note {
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.5;
  }
  .self-hist-toggle,
  .self-del-link {
    border: none;
    background: transparent;
    font-size: var(--fs-11);
    font-weight: 600;
    cursor: pointer;
    padding: 2px 4px;
  }
  .self-hist-toggle {
    color: var(--crayon-sky-ink);
  }
  .self-del-link {
    color: var(--ink-3);
  }
  .self-hist-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--hairline);
    padding-top: 8px;
  }
  .self-hist-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--paper-3);
    border: 1px solid var(--hairline);
  }
  .self-hist-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }
</style>
