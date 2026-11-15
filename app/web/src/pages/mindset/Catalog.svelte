<script>
  import { GUIDE_CHAPTERS } from './mindsetData.js';
  import { ui } from '../../state/ui.svelte.js';

  let activeGroup = $state('ALL');

  const groupNames = $derived.by(() => {
    const out = [];
    for (const ch of GUIDE_CHAPTERS) {
      const g = String(ch.group || ch.stage || '').trim();
      if (g && !out.includes(g)) out.push(g);
    }
    return out;
  });

  const visibleChapters = $derived(
    activeGroup === 'ALL'
      ? GUIDE_CHAPTERS
      : GUIDE_CHAPTERS.filter((ch) => (ch.group || ch.stage) === activeGroup)
  );
</script>

<div class="cat-page">
  <div class="guide-intro">
    先软件上手与实操技巧，再读指标与安全，最后解剖选读。挑今天最有共鸣的一节，顺手练两句就好。
  </div>

  {#if groupNames.length > 0}
    <div class="group-bar" role="tablist" aria-label="指南分组">
      <button
        type="button"
        role="tab"
        aria-selected={activeGroup === 'ALL'}
        class="group-pill {activeGroup === 'ALL' ? 'active' : ''}"
        onclick={() => { activeGroup = 'ALL'; }}
      >
        全部
      </button>
      {#each groupNames as g (g)}
        <button
          type="button"
          role="tab"
          aria-selected={activeGroup === g}
          class="group-pill {activeGroup === g ? 'active' : ''}"
          onclick={() => { activeGroup = g; }}
        >
          {g}
        </button>
      {/each}
    </div>
  {/if}

  <div class="guide-list">
    {#each visibleChapters as ch (ch.id)}
      <button
        type="button"
        class="summary-sheet guide-card"
        onclick={() => ui.navigate(`mindset/${ch.id}`)}
      >
        <div class="guide-card-top">
          <div class="guide-badges">
            <span class="cat-pill tone-{ch.tone}">{ch.cat}</span>
            {#if ch.readMin}
              <span class="read-min">约 {ch.readMin} 分钟</span>
            {/if}
          </div>
          <span class="read-arrow">阅读与动作 →</span>
        </div>
        <h3 class="guide-title">{ch.title}</h3>
        <p class="guide-summary">{ch.summary}</p>
        <ul class="guide-bullets">
          {#each ch.bullets as b}
            <li>{b}</li>
          {/each}
        </ul>
      </button>
    {/each}
  </div>
</div>

<style>
  .cat-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .guide-intro {
    font-size: var(--fs-13);
    color: var(--ink-2);
    background: var(--paper-card);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 11px 14px;
    box-shadow: var(--shadow);
  }

  .group-bar {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 0;
  }
  .group-pill {
    flex-shrink: 0;
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-2);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: var(--shadow);
  }
  .group-pill.active {
    background: var(--crayon-coral-soft);
    color: var(--crayon-coral-ink);
    border-color: var(--crayon-coral);
  }

  .guide-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .guide-card {
    appearance: none;
    width: 100%;
    text-align: left;
    margin-bottom: 0;
    cursor: pointer;
    transition: transform 0.12s ease;
  }
  .guide-card:active {
    transform: scale(0.985);
  }

  .guide-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .guide-badges {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .read-min {
    font-size: var(--fs-10);
    color: var(--ink-3);
  }

  .cat-pill {
    padding: 3px 9px;
    border-radius: 999px;
    font-size: var(--fs-11);
    font-weight: 600;
  }
  .tone-mint     { background: var(--crayon-mint-soft); color: var(--crayon-mint-ink); }
  .tone-sky      { background: var(--crayon-sky-soft); color: var(--crayon-sky-ink); }
  .tone-coral    { background: var(--crayon-coral-soft); color: var(--crayon-coral-ink); }
  .tone-amber    { background: var(--crayon-amber-soft); color: var(--crayon-amber-ink); }
  .tone-indigo   { background: var(--crayon-indigo-soft); color: var(--crayon-indigo-ink); }
  .tone-lavender { background: var(--crayon-lavender-soft); color: var(--crayon-lavender-ink); }

  .read-arrow {
    font-size: var(--fs-11);
    color: var(--ink-3);
    font-weight: 600;
  }

  .guide-title {
    margin: 0 0 6px;
    font-size: var(--fs-16);
    font-weight: 700;
    color: var(--ink-1);
    line-height: 1.35;
  }

  .guide-summary {
    margin: 0 0 10px;
    font-size: var(--fs-13);
    color: var(--ink-2);
    line-height: 1.5;
  }

  .guide-bullets {
    margin: 0;
    padding: 10px 12px 10px 26px;
    background: var(--paper-3);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
