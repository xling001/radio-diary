<script>
  import { onMount } from 'svelte';
  import {
    LibraryStore,
    getAllCategories,
    addCustomCategory,
    removeCustomCategory,
    updateSetMeta,
  } from '../../core/catalog.js';
  import { ui } from '../../state/ui.svelte.js';
  import { confirmDlg } from '../../ui/dialog.js';
  import { audioSession } from '../record/audioSession.svelte.js';

  let categories = $state(getAllCategories());
  let allSets = $state(LibraryStore.getAllSets());
  let allTags = $state(LibraryStore.getAllTags());
  let activeSetId = $state(LibraryStore.getActiveSetId());

  let selectedCat = $state('all');
  let selectedTag = $state('all');

  let showNewCat = $state(false);
  let newCatLabel = $state('');

  let showCreator = $state(false);
  let draftName = $state('');
  let draftCategory = $state('custom');
  let draftTags = $state('');
  let draftLines = $state('');
  let txtFileEl = $state(null);

  let editingSetId = $state(null);
  let editCat = $state('custom');
  let editTags = $state('');

  function reloadData() {
    categories = getAllCategories();
    allSets = LibraryStore.getAllSets();
    allTags = LibraryStore.getAllTags();
    activeSetId = LibraryStore.getActiveSetId();
  }

  onMount(() => {
    reloadData();
    const unsub = ui.subscribe((route) => {
      if (route.view === 'library') reloadData();
    });
    return unsub;
  });

  function catLabel(catId) {
    return categories.find((c) => c.id === catId)?.label || '未分类';
  }

  const visibleTags = $derived.by(() => {
    const pool = selectedCat === 'all' ? allSets : allSets.filter((s) => s.category === selectedCat);
    const set = new Set();
    for (const item of pool) {
      for (const t of item.tags || []) set.add(t);
    }
    return [...set];
  });

  function selectCategory(catId) {
    selectedCat = catId;
    if (selectedTag !== 'all') {
      const pool = catId === 'all' ? allSets : allSets.filter((s) => s.category === catId);
      const hasTag = pool.some((s) => (s.tags || []).includes(selectedTag));
      if (!hasTag) selectedTag = 'all';
    }
  }

  function previewLineText(line) {
    const raw = typeof line === 'string' ? line : (line?.text || '');
    return raw.replace(/\/换气\/\s*/g, '').replace(/｜/g, '');
  }

  const filteredSets = $derived.by(() => {
    return allSets.filter((s) => {
      if (selectedCat !== 'all' && s.category !== selectedCat) return false;
      if (selectedTag !== 'all' && !(s.tags || []).includes(selectedTag)) return false;
      return true;
    });
  });

  function showToast(msg) {
    if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
      window.showNotice(msg);
    }
  }

  function handleAddCategory() {
    const clean = newCatLabel.trim();
    if (!clean) return;
    const cat = addCustomCategory(clean);
    newCatLabel = '';
    showNewCat = false;
    reloadData();
    if (cat) {
      selectedCat = cat.id;
      draftCategory = cat.id;
      showToast(`已创建分类「${cat.label}」`);
    }
  }

  async function handleDeleteCategory(cat) {
    const ok = await confirmDlg(
      `删除自定义分类「${cat.label}」？`,
      '原属于这个分类的素材不会被删掉，会自动归入「我的素材」。',
      '删掉分类',
      '先留着',
      true
    );
    if (!ok) return;
    removeCustomCategory(cat.id);
    if (selectedCat === cat.id) selectedCat = 'all';
    reloadData();
    showToast(`已删除分类「${cat.label}」`);
  }

  function onTxtPicked(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const lines = LibraryStore.parseText(content);
      if (lines.length) {
        draftLines = lines.join('\n');
        if (!draftName.trim()) {
          draftName = file.name.replace(/\.[^.]+$/, '');
        }
        showToast(`已读入 ${lines.length} 句素材`);
      }
    };
    reader.readAsText(file, 'utf-8');
    if (e.target) e.target.value = '';
  }

  function handleSaveSet() {
    const lines = LibraryStore.parseText(draftLines);
    if (!lines.length) {
      showToast('请至少输入一行练习句子');
      return;
    }
    const created = LibraryStore.addCustomSet({
      name: draftName.trim() || '我的自定义素材',
      lines,
      category: draftCategory || 'custom',
      tags: draftTags,
    });
    if (created) {
      draftName = '';
      draftTags = '';
      draftLines = '';
      showCreator = false;
      reloadData();
      selectedCat = created.category;
      showToast(`已保存到「${catLabel(created.category)}」`);
    }
  }

  function startEditMeta(s) {
    editingSetId = editingSetId === s.id ? null : s.id;
    editCat = s.category || 'custom';
    editTags = (s.tags || []).join(', ');
  }

  function saveEditMeta(setId) {
    updateSetMeta(setId, { category: editCat, tags: editTags });
    editingSetId = null;
    reloadData();
    showToast('分类与标签已更新');
  }

  function useSetForPractice(setId) {
    audioSession.setActiveSet(setId);
    audioSession.setMode('script');
    activeSetId = setId;
    ui.navigate('record');
  }

  async function handleDeleteSet(s) {
    const ok = await confirmDlg(
      `删掉「${s.name}」？`,
      '删掉后无法恢复，但之前录过的手账记录会保留。',
      '删掉',
      '再留着',
      true
    );
    if (!ok) return;
    LibraryStore.deleteCustomSet(s.id);
    reloadData();
    showToast('已删除素材');
  }
</script>

<div class="lib-page">
  <!-- 顶部动作条 -->
  <div class="lib-top-bar">
    <button type="button" class="pill-btn" onclick={() => ui.navigate('record')}>
      ← 返回练习
    </button>
    <button
      type="button"
      class="pill-btn pill-primary"
      onclick={() => {
        if (selectedCat !== 'all') draftCategory = selectedCat;
        showCreator = !showCreator;
      }}
    >
      {showCreator ? '收起新建' : '+ 新建 / 导入素材'}
    </button>
  </div>

  <!-- 分类过滤 + 自定义分类管理 -->
  <div class="summary-sheet lib-filter-card">
    <div class="filter-head">
      <span class="filter-title">素材分类</span>
      <button type="button" class="mini-text-btn" onclick={() => { showNewCat = !showNewCat; }}>
        {showNewCat ? '取消' : '+ 新建分类'}
      </button>
    </div>

    {#if showNewCat}
      <div class="new-cat-row">
        <input
          type="text"
          class="dsh-input"
          placeholder="输入新分类名称（如：声线扮演）"
          maxlength="16"
          bind:value={newCatLabel}
          onkeydown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
        />
        <button type="button" class="pill-btn pill-mint" onclick={handleAddCategory}>
          添加
        </button>
      </div>
    {/if}

    <div class="chip-scroll">
      <button
        type="button"
        class="filter-chip {selectedCat === 'all' ? 'active' : ''}"
        onclick={() => selectCategory('all')}
      >
        全部 ({allSets.length})
      </button>
      {#each categories as cat (cat.id)}
        <div class="chip-wrap">
          <button
            type="button"
            class="filter-chip {selectedCat === cat.id ? 'active' : ''}"
            onclick={() => selectCategory(cat.id)}
          >
            {cat.label}
          </button>
          {#if !cat.builtin}
            <button
              type="button"
              class="chip-del"
              aria-label="删除分类 {cat.label}"
              onclick={() => handleDeleteCategory(cat)}
            >
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>

    {#if visibleTags.length}
      <div class="tag-filter-row">
        <span class="tag-label">标签</span>
        <button
          type="button"
          class="tag-filter-pill {selectedTag === 'all' ? 'active' : ''}"
          onclick={() => { selectedTag = 'all'; }}
        >
          不限
        </button>
        {#each visibleTags as t}
          <button
            type="button"
            class="tag-filter-pill {selectedTag === t ? 'active' : ''}"
            onclick={() => { selectedTag = selectedTag === t ? 'all' : t; }}
          >
            #{t}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 新建 / 导入自定义素材卡 -->
  {#if showCreator}
    <div class="summary-sheet creator-card">
      <div class="row-between">
        <h3 class="summary-sheet-title creator-h">添加练习素材</h3>
        <button type="button" class="pill-btn lib-icon-btn" onclick={() => txtFileEl?.click()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>读取 .txt 文件</span>
        </button>
        <input bind:this={txtFileEl} type="file" accept=".txt,text/plain" class="sr-hidden" onchange={onTxtPicked} />
      </div>

      <div class="form-stack">
        <label class="field-lbl">
          <span>素材名称</span>
          <input type="text" class="dsh-input" placeholder="例如：睡前轻语 / 游戏语音包" bind:value={draftName} />
        </label>

        <div class="two-col">
          <label class="field-lbl">
            <span>放进哪个分类</span>
            <select class="dsh-select" bind:value={draftCategory}>
              {#each categories as cat (cat.id)}
                <option value={cat.id}>{cat.label}</option>
              {/each}
            </select>
          </label>
          <label class="field-lbl">
            <span>自定义标签（逗号分隔）</span>
            <input type="text" class="dsh-input" placeholder="如：柔和, 气泡音保护" bind:value={draftTags} />
          </label>
        </div>

        <label class="field-lbl">
          <span>练习句子（每行一句）</span>
          <textarea class="dsh-textarea" placeholder="第一行句子&#10;第二行句子..." bind:value={draftLines}></textarea>
        </label>

        <button type="button" class="pill-btn pill-primary full-w" onclick={handleSaveSet}>
          保存到素材库
        </button>
      </div>
    </div>
  {/if}

  <!-- 素材列表卡片 -->
  <div class="set-list">
    {#each filteredSets as s (s.id)}
      <div class="summary-sheet set-card {activeSetId === s.id ? 'is-current' : ''}">
        <div class="set-card-head">
          <div class="set-card-titles">
            <span class="cat-badge">{catLabel(s.category)}</span>
            <h4 class="set-name">{s.name}</h4>
          </div>
          <span class="line-count tnum">{s.lines.length} 句</span>
        </div>

        {#if s.tags && s.tags.length}
          <div class="tag-row">
            {#each s.tags as tag}
              <span class="tag-pill">#{tag}</span>
            {/each}
          </div>
        {/if}

        {#if s.tip}
          <div class="set-tip">{s.tip}</div>
        {/if}

        <div class="set-preview">
          {#each s.lines.slice(0, 2) as line}
            <div class="preview-line">· {previewLineText(line)}</div>
          {/each}
        </div>

        {#if editingSetId === s.id}
          <div class="meta-editor">
            <label class="field-lbl">
              <span>移动分类</span>
              <select class="dsh-select" bind:value={editCat}>
                {#each categories as cat (cat.id)}
                  <option value={cat.id}>{cat.label}</option>
                {/each}
              </select>
            </label>
            <label class="field-lbl">
              <span>编辑标签（逗号/空格分隔）</span>
              <input type="text" class="dsh-input" bind:value={editTags} placeholder="例如：日常, 上扬" />
            </label>
            <div class="row-gap-sm">
              <button type="button" class="pill-btn pill-mint" onclick={() => saveEditMeta(s.id)}>保存修改</button>
              <button type="button" class="pill-btn" onclick={() => { editingSetId = null; }}>取消</button>
            </div>
          </div>
        {/if}

        <div class="set-actions">
          <button
            type="button"
            class="pill-btn {activeSetId === s.id ? 'pill-mint' : 'pill-primary'}"
            onclick={() => useSetForPractice(s.id)}
          >
            {activeSetId === s.id ? '✓ 当前使用中 · 去练习' : '练这组'}
          </button>
          <button type="button" class="pill-btn" onclick={() => startEditMeta(s)}>
            改分类·标签
          </button>
          {#if !s.builtin}
            <button type="button" class="pill-btn pill-danger" onclick={() => handleDeleteSet(s)}>
              删除
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <div class="summary-sheet empty-lib">
        这个分类或标签下还没有素材，可以点右上角新建一组，或者换个分类看看～
      </div>
    {/each}
  </div>
</div>

<style>
  .lib-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lib-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .lib-filter-card,
  .creator-card,
  .set-card {
    margin-bottom: 0;
  }

  .filter-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .filter-title {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .mini-text-btn {
    border: none;
    background: var(--paper-3);
    color: var(--crayon-sky-ink);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
  }

  .new-cat-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }

  .chip-scroll {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip-wrap {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .filter-chip {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
  }
  .filter-chip.active {
    background: var(--crayon-coral);
    color: var(--rose-on);
    border-color: var(--crayon-coral);
    font-weight: 600;
  }
  .chip-del {
    border: none;
    background: transparent;
    color: var(--ink-3);
    font-size: var(--fs-14);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
  }

  .tag-filter-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--hairline);
  }
  .tag-label {
    font-size: var(--fs-11);
    color: var(--ink-3);
    margin-right: 2px;
  }
  .tag-filter-pill {
    border: 1px solid var(--border-soft);
    background: transparent;
    color: var(--ink-2);
    font-size: var(--fs-11);
    padding: 3px 9px;
    border-radius: 999px;
    cursor: pointer;
  }
  .tag-filter-pill.active {
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
    border-color: var(--crayon-sky);
    font-weight: 600;
  }

  .creator-h {
    margin: 0;
  }
  .lib-icon-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .field-lbl {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--fs-12);
    color: var(--ink-2);
    font-weight: 500;
  }

  .set-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .set-card.is-current {
    border-color: var(--crayon-mint);
  }
  .set-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .set-card-titles {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .cat-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: var(--fs-10);
    font-weight: 600;
    background: var(--crayon-amber-soft);
    color: var(--crayon-amber-ink);
    flex-shrink: 0;
  }
  .set-name {
    margin: 0;
    font-size: var(--fs-15);
    font-weight: 700;
    color: var(--ink-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .line-count {
    font-size: var(--fs-11);
    color: var(--ink-3);
    flex-shrink: 0;
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }
  .tag-pill {
    font-size: var(--fs-10);
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--paper-3);
    color: var(--ink-2);
  }

  .set-tip {
    font-size: var(--fs-11);
    color: var(--crayon-lavender-ink);
    background: var(--crayon-lavender-soft);
    border-radius: var(--radius-xs);
    padding: 7px 10px;
    line-height: 1.45;
    margin-bottom: 8px;
  }

  .set-preview {
    background: var(--paper-3);
    border-radius: var(--radius-sm);
    padding: 9px 11px;
    margin-bottom: 10px;
  }
  .preview-line {
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta-editor {
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 12px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid var(--border-soft);
  }

  .set-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pill-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 7px 13px;
    border-radius: 999px;
    cursor: pointer;
  }
  .pill-btn.pill-primary {
    background: var(--crayon-coral);
    color: var(--rose-on);
    border-color: var(--crayon-coral);
  }
  .pill-btn.pill-mint {
    background: var(--crayon-mint);
    color: var(--sage-on);
    border-color: var(--crayon-mint);
  }
  .pill-btn.pill-danger {
    background: var(--crayon-coral-soft);
    color: var(--danger-ink);
    border-color: transparent;
  }
  .pill-btn.full-w {
    width: 100%;
    padding: 11px 16px;
    font-size: var(--fs-14);
  }

  .empty-lib {
    text-align: center;
    color: var(--ink-3);
    font-size: var(--fs-13);
    padding: 28px 16px;
  }

  .sr-hidden {
    display: none;
  }
</style>
