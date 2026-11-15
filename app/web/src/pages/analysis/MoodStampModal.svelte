<script>
  import Sheet from '../../ui/Sheet.svelte';

  let {
    open = false,
    initialStamp = null,
    onsave = null,
    onclose = null,
  } = $props();

  const MOODS = [
    { emoji: '😊', label: '轻松', tone: 'mint' },
    { emoji: '😌', label: '平稳', tone: 'sky' },
    { emoji: '✨', label: '顺畅满意', tone: 'mint' },
    { emoji: '🌸', label: '很喜欢', tone: 'coral' },
    { emoji: '🤔', label: '摸索中', tone: 'lavender' },
    { emoji: '😮‍💨', label: '有点累', tone: 'indigo' },
    { emoji: '💧', label: '略干紧', tone: 'lavender' },
    { emoji: '🫂', label: '抱抱自己', tone: 'coral' },
  ];

  const THROATS = [
    '喉部松弛',
    '气息顺畅',
    '前口腔明亮',
    '声音轻盈',
    '语调自然',
    '开口轻松',
    '微微发紧',
    '有点干哑',
    '声音偏低',
    '有点挤卡',
    '共鸣偏后',
    '句尾滑落',
  ];

  let mood = $state('😌 平稳');
  let selectedThroats = $state(['喉部松弛']);
  let note = $state('');

  function normalizeMoodValue(raw) {
    if (!raw) return '😌 平稳';
    const str = String(raw).trim();
    const direct = MOODS.find((m) => `${m.emoji} ${m.label}` === str);
    if (direct) return `${direct.emoji} ${direct.label}`;
    const stripped = str.replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D\s]+/gu, '').trim();
    const byLabel = MOODS.find((m) => m.label === stripped);
    if (byLabel) return `${byLabel.emoji} ${byLabel.label}`;
    return str;
  }

  function normalizeThroats(stamp) {
    if (Array.isArray(stamp?.throats) && stamp.throats.length) {
      return stamp.throats.filter(Boolean);
    }
    if (stamp?.throat) {
      const parts = String(stamp.throat).split(/[·、,，]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts;
    }
    return ['喉部松弛'];
  }

  const activeMoodObj = $derived.by(() => {
    return MOODS.find((m) => `${m.emoji} ${m.label}` === mood) || { emoji: '😌', label: mood, tone: 'sky' };
  });

  $effect(() => {
    if (open) {
      mood = normalizeMoodValue(initialStamp?.mood);
      selectedThroats = normalizeThroats(initialStamp);
      note = initialStamp?.note || '';
    }
  });

  function toggleThroat(tag) {
    if (selectedThroats.includes(tag)) {
      selectedThroats = selectedThroats.filter((t) => t !== tag);
    } else if (selectedThroats.length < 4) {
      selectedThroats = [...selectedThroats, tag];
    } else {
      selectedThroats = [...selectedThroats.slice(1), tag];
    }
  }

  function handleSave() {
    onsave?.({
      mood,
      tone: activeMoodObj.tone,
      throats: selectedThroats,
      throat: selectedThroats.join(' · '),
      note: note.trim(),
      updatedAt: Date.now(),
    });
    onclose?.();
  }
</script>

<Sheet {open} title="贴一枚体感印章" {onclose}>
  <div class="stamp-body">
    <div class="stamp-preview tone-{activeMoodObj.tone}">
      <div class="seal-circle" aria-hidden="true">{activeMoodObj.emoji}</div>
      <div class="seal-meta">
        <div class="seal-title">{activeMoodObj.label}</div>
        <div class="seal-tags">
          {selectedThroats.length ? selectedThroats.join(' · ') : '点下方可选多个体感标签'}
        </div>
      </div>
    </div>

    <div class="stamp-sec">
      <div class="stamp-lbl">现在的心情</div>
      <div class="stamp-chips">
        {#each MOODS as m}
          {@const val = `${m.emoji} ${m.label}`}
          <button
            type="button"
            class="stamp-chip {mood === val ? `active tone-${m.tone}` : ''}"
            onclick={() => { mood = val; }}
          >
            <span class="chip-emoji" aria-hidden="true">{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="stamp-sec">
      <div class="stamp-lbl">发声与身体体感（可多选，最多 4 个）</div>
      <div class="stamp-chips">
        {#each THROATS as t}
          <button
            type="button"
            class="stamp-chip {selectedThroats.includes(t) ? 'active-mint' : ''}"
            onclick={() => toggleThroat(t)}
          >
            {t}
          </button>
        {/each}
      </div>
    </div>

    <div class="stamp-sec">
      <label class="stamp-lbl" for="stamp-note-input">小纸条备忘（可选）</label>
      <input
        id="stamp-note-input"
        type="text"
        class="dsh-input"
        placeholder="比如：半打哈欠之后声音顺很多"
        maxlength="80"
        bind:value={note}
      />
    </div>

    <button type="button" class="save-stamp-btn" onclick={handleSave}>
      盖上体感印章
    </button>
  </div>
</Sheet>

<style>
  .stamp-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 4px;
  }

  .stamp-preview {
    --seal-tone: var(--crayon-sky);
    --seal-tone-soft: var(--crayon-sky-soft);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 13px;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--seal-tone) 34%, transparent);
    background: linear-gradient(135deg, var(--paper-card) 0%, var(--seal-tone-soft) 100%);
    box-shadow: inset 0 1px 0 var(--seal-highlight), var(--seal-shadow);
  }
  .stamp-preview.tone-mint     { --seal-tone: var(--crayon-mint); --seal-tone-soft: var(--crayon-mint-soft); }
  .stamp-preview.tone-sky      { --seal-tone: var(--crayon-sky); --seal-tone-soft: var(--crayon-sky-soft); }
  .stamp-preview.tone-lavender { --seal-tone: var(--crayon-lavender); --seal-tone-soft: var(--crayon-lavender-soft); }
  .stamp-preview.tone-amber    { --seal-tone: var(--crayon-amber); --seal-tone-soft: var(--crayon-amber-soft); }
  .stamp-preview.tone-indigo   { --seal-tone: var(--crayon-indigo); --seal-tone-soft: var(--crayon-indigo-soft); }
  .stamp-preview.tone-coral    { --seal-tone: var(--crayon-coral); --seal-tone-soft: var(--crayon-coral-soft); }

  .seal-circle {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--seal-tone-soft);
    border: 1px solid color-mix(in srgb, var(--seal-tone) 32%, transparent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-19);
    flex-shrink: 0;
    transform: rotate(-4deg);
    box-shadow: inset 0 0 0 2.5px var(--paper-card), var(--shadow);
  }
  .seal-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .seal-title {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .seal-tags {
    font-size: var(--fs-11);
    color: var(--ink-2);
    line-height: 1.4;
  }

  .stamp-sec {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stamp-lbl {
    font-size: var(--fs-12);
    font-weight: 600;
    color: var(--ink-2);
  }

  .stamp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .stamp-chip {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 500;
    padding: 7px 11px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: transform 0.1s ease, background-color 0.15s ease;
  }
  .stamp-chip:active {
    transform: scale(0.96);
  }
  .chip-emoji {
    font-size: var(--fs-13);
    line-height: 1;
  }
  .stamp-chip.active {
    font-weight: 600;
  }
  .stamp-chip.active.tone-mint     { background: var(--crayon-mint-soft); border-color: var(--crayon-mint); color: var(--crayon-mint-ink); }
  .stamp-chip.active.tone-sky      { background: var(--crayon-sky-soft); border-color: var(--crayon-sky); color: var(--crayon-sky-ink); }
  .stamp-chip.active.tone-lavender { background: var(--crayon-lavender-soft); border-color: var(--crayon-lavender); color: var(--crayon-lavender-ink); }
  .stamp-chip.active.tone-amber    { background: var(--crayon-amber-soft); border-color: var(--crayon-amber); color: var(--crayon-amber-ink); }
  .stamp-chip.active.tone-indigo   { background: var(--crayon-indigo-soft); border-color: var(--crayon-indigo); color: var(--crayon-indigo-ink); }
  .stamp-chip.active.tone-coral    { background: var(--crayon-coral-soft); border-color: var(--crayon-coral); color: var(--crayon-coral-ink); }

  .stamp-chip.active-mint {
    background: var(--crayon-mint-soft);
    border-color: var(--crayon-mint);
    color: var(--crayon-mint-ink);
    font-weight: 600;
  }

  .save-stamp-btn {
    width: 100%;
    min-height: 44px;
    border: none;
    border-radius: 999px;
    background: var(--crayon-coral);
    color: var(--rose-on);
    font-size: var(--fs-14);
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow);
  }
</style>
