<script>
  import Sheet from '../../ui/Sheet.svelte';
  import {
    SELF_MOODS,
    COMFORT_LABELS,
    FOCUS_LABELS,
    EASE_LABELS,
  } from '../../store/selfCheck.js';

  let {
    open = false,
    onsave = null,
    onclose = null,
  } = $props();

  let mood = $state('😌 平稳');
  let comfort = $state(3);
  let focus = $state(3);
  let ease = $state(3);
  let note = $state('');

  const activeMoodObj = $derived.by(() => {
    return SELF_MOODS.find((m) => `${m.emoji} ${m.label}` === mood) || SELF_MOODS[1];
  });

  $effect(() => {
    if (open) {
      mood = '😌 平稳';
      comfort = 3;
      focus = 3;
      ease = 3;
      note = '';
    }
  });

  function handleSave() {
    onsave?.({
      mood,
      tone: activeMoodObj.tone,
      comfort,
      focus,
      ease,
      note: note.trim(),
      ts: Date.now(),
    });
    onclose?.();
  }
</script>

<Sheet {open} title="写一页主观自评" {onclose}>
  <div class="sc-body">
    <p class="sc-intro">
      不用对照打分，只需要温柔记录一下这几天说话时的舒适度和自在感（建议每周记一次，全部保存在本机）。
    </p>

    <div class="sc-sec">
      <div class="sc-lbl">最近的心情贴纸</div>
      <div class="sc-chips">
        {#each SELF_MOODS as m}
          {@const val = `${m.emoji} ${m.label}`}
          <button
            type="button"
            class="sc-chip {mood === val ? `active tone-${m.tone}` : ''}"
            onclick={() => { mood = val; }}
          >
            <span aria-hidden="true">{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="sc-sec">
      <div class="sc-row-head">
        <span class="sc-lbl">嗓音舒适度（是否松弛省力）</span>
        <span class="sc-val-pill tone-mint tnum">{comfort}/5 · {COMFORT_LABELS[comfort - 1]}</span>
      </div>
      <div class="scale-row" role="radiogroup" aria-label="嗓音舒适度">
        {#each [1, 2, 3, 4, 5] as n}
          <button
            type="button"
            role="radio"
            aria-checked={comfort === n}
            class="scale-btn tnum {comfort === n ? 'active tone-mint' : ''}"
            onclick={() => { comfort = n; }}
          >
            {n}
          </button>
        {/each}
      </div>
    </div>

    <div class="sc-sec">
      <div class="sc-row-head">
        <span class="sc-lbl">练习专注度</span>
        <span class="sc-val-pill tone-sky tnum">{focus}/5 · {FOCUS_LABELS[focus - 1]}</span>
      </div>
      <div class="scale-row" role="radiogroup" aria-label="练习专注度">
        {#each [1, 2, 3, 4, 5] as n}
          <button
            type="button"
            role="radio"
            aria-checked={focus === n}
            class="scale-btn tnum {focus === n ? 'active tone-sky' : ''}"
            onclick={() => { focus = n; }}
          >
            {n}
          </button>
        {/each}
      </div>
    </div>

    <div class="sc-sec">
      <div class="sc-row-head">
        <span class="sc-lbl">开口说话的自在感</span>
        <span class="sc-val-pill tone-coral tnum">{ease}/5 · {EASE_LABELS[ease - 1]}</span>
      </div>
      <div class="scale-row" role="radiogroup" aria-label="开口说话的自在感">
        {#each [1, 2, 3, 4, 5] as n}
          <button
            type="button"
            role="radio"
            aria-checked={ease === n}
            class="scale-btn tnum {ease === n ? 'active tone-coral' : ''}"
            onclick={() => { ease = n; }}
          >
            {n}
          </button>
        {/each}
      </div>
    </div>

    <div class="sc-sec">
      <label class="sc-lbl" for="sc-note-input">给自己的小纸条（可选）</label>
      <input
        id="sc-note-input"
        type="text"
        class="dsh-input"
        placeholder="比如：这周三声落音轻了些，喝完温水更稳"
        maxlength="120"
        bind:value={note}
      />
    </div>

    <button type="button" class="sc-save-btn" onclick={handleSave}>
      收进我的手帐
    </button>
  </div>
</Sheet>

<style>
  .sc-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 2px;
  }

  .sc-intro {
    margin: 0;
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.55;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    background: var(--paper-3);
    border: 1px solid var(--hairline);
  }

  .sc-sec {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .sc-row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .sc-lbl {
    font-size: var(--fs-12);
    font-weight: 600;
    color: var(--ink-2);
  }

  .sc-val-pill {
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .sc-val-pill.tone-mint  { background: var(--crayon-mint-soft); color: var(--crayon-mint-ink); }
  .sc-val-pill.tone-sky   { background: var(--crayon-sky-soft); color: var(--crayon-sky-ink); }
  .sc-val-pill.tone-coral { background: var(--crayon-coral-soft); color: var(--crayon-coral-ink); }

  .sc-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .sc-chip {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 500;
    padding: 6px 11px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .sc-chip.active {
    font-weight: 600;
  }
  .sc-chip.active.tone-mint     { background: var(--crayon-mint-soft); border-color: var(--crayon-mint); color: var(--crayon-mint-ink); }
  .sc-chip.active.tone-sky      { background: var(--crayon-sky-soft); border-color: var(--crayon-sky); color: var(--crayon-sky-ink); }
  .sc-chip.active.tone-lavender { background: var(--crayon-lavender-soft); border-color: var(--crayon-lavender); color: var(--crayon-lavender-ink); }
  .sc-chip.active.tone-amber    { background: var(--crayon-amber-soft); border-color: var(--crayon-amber); color: var(--crayon-amber-ink); }
  .sc-chip.active.tone-coral    { background: var(--crayon-coral-soft); border-color: var(--crayon-coral); color: var(--crayon-coral-ink); }

  .scale-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
  }
  .scale-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-2);
    font-size: var(--fs-13);
    font-weight: 600;
    padding: 8px 4px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: transform 0.1s ease, background-color 0.15s ease;
  }
  .scale-btn:active {
    transform: scale(0.96);
  }
  .scale-btn.active.tone-mint  { background: var(--crayon-mint-soft); border-color: var(--crayon-mint); color: var(--crayon-mint-ink); }
  .scale-btn.active.tone-sky   { background: var(--crayon-sky-soft); border-color: var(--crayon-sky); color: var(--crayon-sky-ink); }
  .scale-btn.active.tone-coral { background: var(--crayon-coral-soft); border-color: var(--crayon-coral); color: var(--crayon-coral-ink); }

  .sc-save-btn {
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
</style>
