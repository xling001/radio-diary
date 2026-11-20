<script>
  import { onMount } from 'svelte';
  import { exportSelfChecksMarkdown, exportDiaryBackupJson } from '../../core/export.js';
  import {
    SelfCheckStore,
    SELF_MOODS,
    SELF_CHECK_QUESTIONS,
    SELF_CONTEXTS,
    subscribeSelfChecks,
  } from '../../store/selfCheck.js';
  import { TakeStore } from '../../store/takes.js';
  import { ui } from '../../state/ui.svelte.js';
  import { confirmDlg } from '../../ui/dialog.js';
  import Sheet from '../../ui/Sheet.svelte';

  let entries = $state(SelfCheckStore.allCached());
  let loading = $state(true);
  let formOpen = $state(false);

  let answers = $state({});
  let contexts = $state([]);
  let mood = $state('😌 平稳');
  let note = $state('');

  let detailEntry = $state(null);
  let backupInputEl = $state(null);

  const isThisWeekDone = $derived(SelfCheckStore.isDoneThisWeek(entries));
  const activeMoodObj = $derived(
    SELF_MOODS.find((m) => `${m.emoji} ${m.label}` === mood) || SELF_MOODS[1]
  );
  const showRedlineTip = $derived(answers.throatLoad === SELF_CHECK_QUESTIONS[0].redlineOption);

  async function refreshList() {
    loading = true;
    try {
      entries = await SelfCheckStore.all();
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    refreshList();
    const unsub = subscribeSelfChecks(() => refreshList());
    return unsub;
  });

  function showMsg(msg) {
    if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
      window.showNotice(msg);
    }
  }

  function formatDateTime(ts) {
    const d = new Date(ts || Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  function pickOption(qKey, opt) {
    if (answers[qKey] === opt) {
      const next = { ...answers };
      delete next[qKey];
      answers = next;
    } else {
      answers = { ...answers, [qKey]: opt };
    }
  }

  function toggleContext(tag) {
    if (contexts.includes(tag)) {
      contexts = contexts.filter((t) => t !== tag);
    } else if (contexts.length < 6) {
      contexts = [...contexts, tag];
    } else {
      contexts = [...contexts.slice(1), tag];
    }
  }

  async function handleSubmit() {
    const hasAny = Object.keys(answers).length > 0 || contexts.length > 0 || note.trim().length > 0;
    if (!hasAny) {
      showMsg('点选任意一题或写一句小记再收进手帐呀～');
      return;
    }
    await SelfCheckStore.add({
      mood,
      tone: activeMoodObj.tone,
      answers: { ...answers },
      contexts: [...contexts],
      note: note.trim().slice(0, 100),
      ts: Date.now(),
    });
    answers = {};
    contexts = [];
    mood = '😌 平稳';
    note = '';
    formOpen = false;
    await refreshList(false);
    showMsg('本周自评已稳妥保存在本机');
  }

  async function handleDelete(item) {
    const ok = await confirmDlg('删掉这条自评记录？', '删掉后无法恢复，建议重要内容先导出备份。', '删掉', '先留着', true);
    if (!ok) return;
    entries = await SelfCheckStore.remove(item.id);
    if (detailEntry && detailEntry.id === item.id) detailEntry = null;
    showMsg('已删除该条自评');
  }

  async function handleExportMarkdown() {
    if (!entries.length) {
      showMsg('还没有可导出的自评记录');
      return;
    }
    const res = await exportSelfChecksMarkdown(entries);
    if (res?.cancelled) return;
    showMsg(res?.path ? `已保存：${res.path}` : `已导出 ${res.fileName}`);
  }

  async function handleExportBackup() {
    let takes = [];
    try { takes = await TakeStore.all(); } catch {}
    if (!entries.length && !takes.length) {
      showMsg('手账里暂时还没有可备份的数据');
      return;
    }
    const res = await exportDiaryBackupJson({ selfChecks: entries, takes });
    if (res?.cancelled) return;
    showMsg(res?.path ? `备份已存至：${res.path}` : `已导出备份 ${res.fileName}`);
  }

  function onBackupPicked(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (parsed && !Array.isArray(parsed) && typeof parsed === 'object' && parsed.schema && parsed.schema !== 'radiodiary-backup-v1') {
          showMsg(`备份版本暂不兼容（${parsed.schema}）`);
          return;
        }
        const scList = Array.isArray(parsed)
          ? parsed
          : (Array.isArray(parsed?.selfChecks) ? parsed.selfChecks : []);
        const takesList = (!Array.isArray(parsed) && Array.isArray(parsed?.takesSummary))
          ? parsed.takesSummary
          : [];
        if (!Array.isArray(parsed) && !Array.isArray(parsed?.selfChecks) && !Array.isArray(parsed?.takesSummary)) {
          showMsg('未在文件里找到可用的手账备份数据');
          return;
        }
        const scRes = scList.length ? await SelfCheckStore.mergeImported(scList) : { added: 0, total: entries.length };
        const takeRes = takesList.length ? await TakeStore.mergeImportedSummaries(takesList) : { added: 0, total: 0 };
        await refreshList();
        const parts = [];
        if (scRes.added > 0) parts.push(`${scRes.added} 条新自评`);
        if (takeRes.added > 0) parts.push(`${takeRes.added} 条练习记录统计`);
        if (parts.length > 0) {
          showMsg(`已恢复导入 ${parts.join('、')}（现有自评 ${scRes.total} 条）`);
        } else {
          showMsg('备份里的记录均已存在，未重复导入');
        }
      } catch {
        showMsg('备份文件格式不对，请确认是 .json 备份文件');
      }
    };
    reader.readAsText(file, 'utf-8');
    if (e.target) e.target.value = '';
  }
</script>

<div class="sc-page">
  <!-- 顶部返回与备份动作条 -->
  <div class="sc-topbar">
    <button type="button" class="pill-btn" onclick={() => ui.navigate('history')}>
      ← 返回手账
    </button>
    <div class="row-gap-sm">
      <button type="button" class="pill-btn" onclick={handleExportBackup}>
        导出备份
      </button>
      <button type="button" class="pill-btn" onclick={() => backupInputEl?.click()}>
        恢复
      </button>
      <button type="button" class="pill-btn pill-sky" onclick={handleExportMarkdown}>
        导出 .md
      </button>
      <input
        bind:this={backupInputEl}
        type="file"
        accept=".json,application/json"
        class="sr-hidden"
        onchange={onBackupPicked}
      />
    </div>
  </div>

  <!-- 顶部测试填写区（不求总分、全可跳过） -->
  <section class="summary-sheet sc-form-card">
    <div class="sc-form-head">
      <div>
        <div class="sc-title-row">
          <h2 class="sc-h2">本周状态自评</h2>
          <span class="sc-status-pill {isThisWeekDone ? 'is-done' : 'is-pending'}">
            {isThisWeekDone ? '本周已记 ✓' : '本周待记'}
          </span>
        </div>
        <p class="sc-hint">不打分、不评等级、全部可跳过；用 30 秒记录声音用不用得出去、舒不舒服。</p>
      </div>
      <button
        type="button"
        class="toggle-form-btn"
        onclick={() => { formOpen = !formOpen; }}
      >
        {formOpen ? '收起' : '+ 写一次'}
      </button>
    </div>

    {#if formOpen}
      <div class="sc-form-body">
        {#each SELF_CHECK_QUESTIONS as q (q.key)}
          <div class="q-block">
            <div class="q-title">{q.title}</div>
            <div class="q-prompt">{q.prompt}</div>
            <div class="q-opts">
              {#each q.options as opt}
                <button
                  type="button"
                  class="q-opt-btn {answers[q.key] === opt ? (q.redlineOption === opt ? 'active-warn' : 'active') : ''}"
                  onclick={() => pickOption(q.key, opt)}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>
        {/each}

        {#if showRedlineTip}
          <div class="redline-alert" role="alert">
            红线提醒：先歇一两天、多喝温水、暂停练习；如果沙哑或不适持续超过两周，请去三甲医院耳鼻喉科/嗓音门诊做一次声带检查。
          </div>
        {/if}

        <div class="q-block">
          <div class="q-title">6. 本周主要用声与练习场合（可多选）</div>
          <div class="q-opts">
            {#each SELF_CONTEXTS as ctx}
              <button
                type="button"
                class="q-opt-btn {contexts.includes(ctx) ? 'active-mint' : ''}"
                onclick={() => toggleContext(ctx)}
              >
                {ctx}
              </button>
            {/each}
          </div>
        </div>

        <div class="q-block">
          <div class="q-title">7. 心情贴纸</div>
          <div class="q-opts">
            {#each SELF_MOODS as m}
              {@const val = `${m.emoji} ${m.label}`}
              <button
                type="button"
                class="q-opt-btn {mood === val ? 'active-coral' : ''}"
                onclick={() => { mood = val; }}
              >
                <span aria-hidden="true">{m.emoji}</span> {m.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="q-block">
          <div class="note-head">
            <label class="q-title" for="sc-weekly-note">8. 一句话微周记（选填，限 100 字）</label>
            <span class="note-cnt tnum">{note.length}/100</span>
          </div>
          <textarea
            id="sc-weekly-note"
            class="dsh-textarea sc-note-area"
            maxlength="100"
            placeholder="比如：这周常读《林间晨光与微风》，接外卖前先轻呼一口气再说「喂您好」稳了很多。"
            bind:value={note}
          ></textarea>
        </div>

        <button type="button" class="sc-submit-btn" onclick={handleSubmit}>
          收进本地手帐
        </button>
      </div>
    {/if}
  </section>

  <!-- 下方历史记录列表（点击卡片可看全部问答详情） -->
  <section class="sc-list-sec">
    <div class="sc-list-head">
      <strong class="sc-list-title">自评记录 ({entries.length})</strong>
      <span class="sc-list-tip">点卡片可看当时详细问答 · 已存于本地数据库</span>
    </div>

    {#if loading && !entries.length}
      <div class="summary-sheet sc-empty">正在读取自评记录…</div>
    {:else if !entries.length}
      <div class="summary-sheet sc-empty">
        还没有自评记录。每周花 30 秒记录一次体感与生活开口感受，几个月后回头看会很有力量。
      </div>
    {:else}
      <div class="sc-cards">
        {#each entries as item (item.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="summary-sheet sc-item-card"
            role="button"
            tabindex="0"
            onclick={() => { detailEntry = item; }}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') detailEntry = item; }}
          >
            <div class="sc-item-top">
              <span class="mood-pill tone-{item.tone || 'sky'}">{item.mood}</span>
              <span class="sc-item-date tnum">{formatDateTime(item.ts)}</span>
              <span class="sc-detail-hint">详情 ›</span>
            </div>

            {#if item.answers?.throatLoad || item.answers?.socialEase || item.answers?.selfFit}
              <div class="sc-item-pills">
                {#if item.answers?.throatLoad}<span class="mini-ans-pill">负荷：{item.answers.throatLoad}</span>{/if}
                {#if item.answers?.socialEase}<span class="mini-ans-pill">社交：{item.answers.socialEase}</span>{/if}
                {#if item.answers?.selfFit}<span class="mini-ans-pill">认同：{item.answers.selfFit}</span>{/if}
              </div>
            {:else if item.legacyScores}
              <div class="sc-item-pills tnum">
                <span class="mini-ans-pill">舒适 {item.legacyScores.comfort}/5</span>
                <span class="mini-ans-pill">专注 {item.legacyScores.focus}/5</span>
                <span class="mini-ans-pill">自在 {item.legacyScores.ease}/5</span>
              </div>
            {/if}

            {#if item.contexts?.length}
              <div class="sc-ctx-line">{item.contexts.join(' · ')}</div>
            {/if}

            {#if item.note}
              <p class="sc-item-note">{item.note}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<Sheet
  open={Boolean(detailEntry)}
  title={detailEntry ? `${detailEntry.mood} · 自评详情` : '自评详情'}
  onclose={() => { detailEntry = null; }}
>
  {#if detailEntry}
    <div class="detail-body">
      <div class="detail-meta tnum">记录时间：{formatDateTime(detailEntry.ts)}</div>

      {#each SELF_CHECK_QUESTIONS as q (q.key)}
        {#if detailEntry.answers?.[q.key]}
          <div class="detail-row">
            <div class="detail-q">{q.title}</div>
            <div class="detail-a">{detailEntry.answers[q.key]}</div>
          </div>
        {/if}
      {/each}

      {#if detailEntry.legacyScores && !Object.keys(detailEntry.answers || {}).length}
        <div class="detail-row tnum">
          <div class="detail-q">旧版主观刻度记录</div>
          <div class="detail-a">
            舒适 {detailEntry.legacyScores.comfort}/5 · 专注 {detailEntry.legacyScores.focus}/5 · 自在 {detailEntry.legacyScores.ease}/5
          </div>
        </div>
      {/if}

      {#if detailEntry.contexts?.length}
        <div class="detail-row">
          <div class="detail-q">本周主要用声与练习场合</div>
          <div class="detail-a">{detailEntry.contexts.join('、')}</div>
        </div>
      {/if}

      {#if detailEntry.note}
        <div class="detail-row">
          <div class="detail-q">微周记</div>
          <div class="detail-a">{detailEntry.note}</div>
        </div>
      {/if}

      <button type="button" class="detail-del-btn" onclick={() => handleDelete(detailEntry)}>
        删除这条自评
      </button>
    </div>
  {/if}
</Sheet>

<style>
  .sc-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sc-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .pill-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    box-shadow: var(--shadow);
    cursor: pointer;
  }
  .pill-sky {
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
    border-color: var(--crayon-sky);
  }
  .sr-hidden {
    display: none;
  }

  .sc-form-card {
    margin-bottom: 0;
  }
  .sc-form-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .sc-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sc-h2 {
    margin: 0;
    font-size: var(--fs-16);
    font-weight: 700;
    color: var(--ink-1);
  }
  .sc-status-pill {
    font-size: var(--fs-10);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .sc-status-pill.is-done {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
  }
  .sc-status-pill.is-pending {
    background: var(--crayon-lavender-soft);
    color: var(--crayon-lavender-ink);
  }
  .sc-hint {
    margin: 4px 0 0;
    font-size: var(--fs-11);
    color: var(--ink-3);
    line-height: 1.5;
  }
  .toggle-form-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 999px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .sc-form-body {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--hairline);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .q-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .q-title {
    font-size: var(--fs-12);
    font-weight: 700;
    color: var(--ink-1);
  }
  .q-prompt {
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.45;
  }
  .q-opts {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .q-opt-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 500;
    padding: 6px 11px;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 0.1s ease, background-color 0.15s ease;
  }
  .q-opt-btn:active {
    transform: scale(0.97);
  }
  .q-opt-btn.active {
    background: var(--crayon-sky-soft);
    border-color: var(--crayon-sky);
    color: var(--crayon-sky-ink);
    font-weight: 600;
  }
  .q-opt-btn.active-mint {
    background: var(--crayon-mint-soft);
    border-color: var(--crayon-mint);
    color: var(--crayon-mint-ink);
    font-weight: 600;
  }
  .q-opt-btn.active-coral {
    background: var(--crayon-coral-soft);
    border-color: var(--crayon-coral);
    color: var(--crayon-coral-ink);
    font-weight: 600;
  }
  .q-opt-btn.active-warn {
    background: var(--crayon-coral-soft);
    border-color: var(--crayon-coral);
    color: var(--crayon-coral-ink);
    font-weight: 700;
  }

  .redline-alert {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--crayon-coral-soft);
    border: 1px solid var(--crayon-coral);
    color: var(--crayon-coral-ink);
    font-size: var(--fs-12);
    font-weight: 600;
    line-height: 1.5;
  }

  .note-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .note-cnt {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }
  .sc-note-area {
    min-height: 76px;
  }

  .sc-submit-btn {
    width: 100%;
    min-height: 44px;
    border: none;
    border-radius: 999px;
    background: var(--crayon-coral-solid);
    color: var(--rose-on);
    font-size: var(--fs-14);
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow);
  }

  .sc-list-sec {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sc-list-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px;
  }
  .sc-list-title {
    font-size: var(--fs-14);
    color: var(--ink-1);
  }
  .sc-list-tip {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }
  .sc-empty {
    margin-bottom: 0;
    font-size: var(--fs-12);
    color: var(--ink-3);
    line-height: 1.6;
    text-align: center;
    padding: 20px 14px;
  }
  .sc-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sc-item-card {
    margin-bottom: 0;
    padding: 14px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sc-item-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mood-pill {
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
  }
  .mood-pill.tone-mint     { background: var(--crayon-mint-soft); color: var(--crayon-mint-ink); }
  .mood-pill.tone-coral    { background: var(--crayon-coral-soft); color: var(--crayon-coral-ink); }
  .mood-pill.tone-lavender { background: var(--crayon-lavender-soft); color: var(--crayon-lavender-ink); }
  .mood-pill.tone-amber    { background: var(--crayon-amber-soft); color: var(--crayon-amber-ink); }

  .sc-item-date {
    font-size: var(--fs-11);
    color: var(--ink-3);
    margin-right: auto;
  }
  .sc-detail-hint {
    font-size: var(--fs-11);
    color: var(--crayon-sky-ink);
    font-weight: 600;
  }
  .sc-item-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mini-ans-pill {
    font-size: var(--fs-11);
    color: var(--ink-2);
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .sc-ctx-line {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }
  .sc-item-note {
    margin: 0;
    font-size: var(--fs-12);
    color: var(--ink-1);
    line-height: 1.55;
    padding: 7px 10px;
    background: var(--paper-3);
    border-radius: var(--radius-sm);
  }

  .detail-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .detail-meta {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }
  .detail-row {
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .detail-q {
    font-size: var(--fs-11);
    font-weight: 600;
    color: var(--ink-3);
  }
  .detail-a {
    font-size: var(--fs-13);
    color: var(--ink-1);
    line-height: 1.5;
  }
  .detail-del-btn {
    border: none;
    background: var(--crayon-coral-soft);
    color: var(--danger-ink);
    font-size: var(--fs-13);
    font-weight: 600;
    padding: 10px 14px;
    border-radius: 999px;
    cursor: pointer;
    margin-top: 4px;
  }
</style>
