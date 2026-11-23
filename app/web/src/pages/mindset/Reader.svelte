<script>
  import { onMount } from 'svelte';
  import { GUIDE_CHAPTERS } from './mindsetData.js';
  import { ui } from '../../state/ui.svelte.js';

  let { chapterId = '' } = $props();
  let showTopBtn = $state(false);

  onMount(() => {
    const onScroll = () => {
      showTopBtn = (window.scrollY || 0) > 360;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const chapterIdx = $derived.by(() => {
    const idx = GUIDE_CHAPTERS.findIndex((c) => c.id === chapterId);
    return idx >= 0 ? idx : 0;
  });
  const chapter = $derived(GUIDE_CHAPTERS[chapterIdx] || GUIDE_CHAPTERS[0]);
  const prevChapter = $derived(chapterIdx > 0 ? GUIDE_CHAPTERS[chapterIdx - 1] : null);
  const nextChapter = $derived(chapterIdx < GUIDE_CHAPTERS.length - 1 ? GUIDE_CHAPTERS[chapterIdx + 1] : null);

  async function copyPromptPack() {
    if (!chapter.aiSystemPrompt) return;
    try {
      await navigator.clipboard.writeText(chapter.aiSystemPrompt);
      if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
        window.showNotice('已复制 AI 温和教练开场提示词');
      }
    } catch {}
  }

  async function copyUrl(url) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
        window.showNotice('已复制教程仓库链接');
      }
    } catch {}
  }
</script>

<div class="reader-page">
  <div class="reader-nav">
    <button type="button" class="back-pill" onclick={() => ui.navigate('mindset')}>
      ← 返回指南目录
    </button>
  </div>

  <div class="summary-sheet reader-card">
    <span class="cat-pill tone-{chapter.tone}">{chapter.cat}</span>
    <h2 class="reader-title">{chapter.title}</h2>
    <p class="reader-summary">{chapter.summary}</p>

    <div class="key-points-box">
      <div class="kp-head">{chapter.bulletsTitle || '本节核心要点'}</div>
      <ul class="kp-list">
        {#each chapter.bullets as b}
          <li>{b}</li>
        {/each}
      </ul>
    </div>

    <div class="sec-stack">
      {#each chapter.sections as sec}
        <section class="subcard">
          <h4 class="sec-h">{sec.heading}</h4>
          {#if sec.text}
            <p class="sec-p">{sec.text}</p>
          {/if}
          {#if Array.isArray(sec.steps) && sec.steps.length}
            <ol class="sec-steps">
              {#each sec.steps as step}
                <li>{step}</li>
              {/each}
            </ol>
          {/if}
          {#if sec.callout}
            {@const cTone = typeof sec.callout === 'object' ? (sec.callout.tone || 'lavender') : 'lavender'}
            {@const cTitle = typeof sec.callout === 'object' ? sec.callout.title : ''}
            {@const cText = typeof sec.callout === 'object' ? sec.callout.text : sec.callout}
            <div class="sec-callout tone-{cTone}">
              {#if cTitle}<strong class="callout-title">{cTitle}</strong>{/if}
              <p class="callout-text">{cText}</p>
            </div>
          {/if}
          {#if sec.compare}
            <div class="sec-compare">
              <div class="cmp-box cmp-good">
                <span class="cmp-tag">{sec.compare.goodLabel || '可以这样试'}</span>
                <p class="cmp-text">{sec.compare.good}</p>
              </div>
              <div class="cmp-box cmp-bad">
                <span class="cmp-tag">{sec.compare.badLabel || '容易误区'}</span>
                <p class="cmp-text">{sec.compare.bad}</p>
              </div>
            </div>
          {/if}
          {#if sec.links?.length}
            {#each sec.links as lk (lk.url)}
              <div class="sec-link-card">
                <div class="sec-link-url">{lk.url}</div>
                <div class="sec-link-actions">
                  <a class="sec-link-btn {lk.tone === 'mint' ? 'tone-mint' : ''}" href={lk.url} target="_blank" rel="noopener noreferrer">
                    {lk.label || '打开链接 ↗'}
                  </a>
                  <button type="button" class="sec-link-copy" onclick={() => copyUrl(lk.url)}>
                    复制链接
                  </button>
                </div>
              </div>
            {/each}
          {:else if sec.linkUrl}
            <div class="sec-link-card">
              <div class="sec-link-url">{sec.linkUrl}</div>
              <div class="sec-link-actions">
                <a class="sec-link-btn" href={sec.linkUrl} target="_blank" rel="noopener noreferrer">
                  {sec.linkLabel || '打开链接 ↗'}
                </a>
                <button type="button" class="sec-link-copy" onclick={() => copyUrl(sec.linkUrl)}>
                  复制链接
                </button>
              </div>
            </div>
          {/if}
        </section>
      {/each}
    </div>

    {#if chapter.aiSystemPrompt}
      <div class="prompt-box">
        <pre class="prompt-pre">{chapter.aiSystemPrompt}</pre>
        <button type="button" class="copy-prompt-btn" onclick={copyPromptPack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>复制这段 AI 伴学开场白</span>
        </button>
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="cta-practice-btn"
    onclick={() => ui.navigate(chapter.practiceRoute || 'record')}
  >
    {chapter.practiceLabel || '去练一下这个动作 →'}
  </button>

  <div class="chapter-pager">
    {#if prevChapter}
      <button
        type="button"
        class="pager-btn"
        onclick={() => ui.navigate(`mindset/${prevChapter.id}`)}
      >
        <span class="pager-dir">← 上一节</span>
        <span class="pager-name">{prevChapter.cat}</span>
      </button>
    {:else}
      <button
        type="button"
        class="pager-btn"
        onclick={() => ui.navigate('mindset')}
      >
        <span class="pager-dir">← 指南目录</span>
        <span class="pager-name">已是第一节</span>
      </button>
    {/if}

    {#if nextChapter}
      <button
        type="button"
        class="pager-btn pager-next"
        onclick={() => ui.navigate(`mindset/${nextChapter.id}`)}
      >
        <span class="pager-dir">下一节 →</span>
        <span class="pager-name">{nextChapter.cat}</span>
      </button>
    {:else}
      <button
        type="button"
        class="pager-btn pager-next"
        onclick={() => ui.navigate('mindset')}
      >
        <span class="pager-dir">回到目录 ↺</span>
        <span class="pager-name">已读完全部章节</span>
      </button>
    {/if}
  </div>

  {#if showTopBtn}
    <button type="button" class="float-top-btn" onclick={scrollToTop} aria-label="回到本节顶部">
      ↑ 顶部
    </button>
  {/if}
</div>

<style>
  .reader-page {
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

  .reader-card {
    margin-bottom: 0;
  }

  .cat-pill {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: var(--fs-11);
    font-weight: 600;
    margin-bottom: 8px;
  }
  .tone-mint     { background: var(--crayon-mint-soft); color: var(--crayon-mint-ink); }
  .tone-sky      { background: var(--crayon-sky-soft); color: var(--crayon-sky-ink); }
  .tone-coral    { background: var(--crayon-coral-soft); color: var(--crayon-coral-ink); }
  .tone-amber    { background: var(--crayon-amber-soft); color: var(--crayon-amber-ink); }
  .tone-indigo   { background: var(--crayon-indigo-soft); color: var(--crayon-indigo-ink); }
  .tone-lavender { background: var(--crayon-lavender-soft); color: var(--crayon-lavender-ink); }

  .reader-title {
    margin: 0 0 8px;
    font-size: var(--fs-18);
    font-weight: 700;
    color: var(--ink-1);
    line-height: 1.35;
  }

  .reader-summary {
    margin: 0 0 14px;
    font-size: var(--fs-13);
    color: var(--ink-2);
    line-height: 1.55;
  }

  .key-points-box {
    background: var(--crayon-mint-soft);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    margin-bottom: 14px;
  }
  .kp-head {
    font-size: var(--fs-13);
    font-weight: 700;
    color: var(--crayon-mint-ink);
    margin-bottom: 6px;
  }
  .kp-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: var(--fs-13);
    color: var(--ink-1);
    line-height: 1.55;
  }

  .sec-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sec-h {
    margin: 0 0 5px;
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .sec-p {
    margin: 0;
    font-size: var(--fs-13);
    color: var(--ink-2);
    line-height: 1.65;
  }
  .sec-steps {
    margin: 6px 0 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--fs-13);
    color: var(--ink-1);
    line-height: 1.55;
  }
  .sec-callout {
    margin-top: 8px;
    border-radius: var(--radius-sm);
    padding: 9px 11px;
    font-size: var(--fs-12);
    line-height: 1.5;
  }
  .callout-title {
    display: block;
    margin-bottom: 2px;
    font-size: var(--fs-12);
  }
  .callout-text {
    margin: 0;
  }
  .sec-compare {
    margin-top: 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .cmp-box {
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    border: 1px solid var(--hairline);
  }
  .cmp-good {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
  }
  .cmp-bad {
    background: var(--crayon-lavender-soft);
    color: var(--crayon-lavender-ink);
  }
  .cmp-tag {
    display: inline-block;
    font-size: var(--fs-10);
    font-weight: 700;
    margin-bottom: 3px;
  }
  .cmp-text {
    margin: 0;
    font-size: var(--fs-12);
    line-height: 1.45;
    color: var(--ink-1);
  }

  .sec-link-card {
    margin-top: 8px;
    padding: 9px 11px;
    border-radius: var(--radius-sm);
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sec-link-url {
    font-size: var(--fs-11);
    color: var(--ink-3);
    word-break: break-all;
    line-height: 1.4;
  }
  .sec-link-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sec-link-btn {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: var(--fs-12);
    font-weight: 600;
    background: var(--crayon-sky-soft);
    color: var(--crayon-sky-ink);
  }
  .sec-link-btn.tone-mint {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
  }
  .sec-link-copy {
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-2);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: var(--fs-12);
    font-weight: 600;
    cursor: pointer;
  }

  .prompt-box {
    margin-top: 12px;
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .prompt-pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: var(--font-ui);
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.55;
  }
  .copy-prompt-btn {
    border: none;
    border-radius: 999px;
    background: var(--crayon-sky-solid, var(--crayon-sky));
    color: var(--rose-on);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 9px 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .cta-practice-btn {
    width: 100%;
    min-height: 48px;
    border: none;
    border-radius: 999px;
    background: var(--crayon-coral-solid, var(--crayon-coral));
    color: var(--rose-on);
    font-size: var(--fs-14);
    font-weight: 700;
    box-shadow: var(--shadow-card);
    cursor: pointer;
  }

  .chapter-pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pager-btn {
    appearance: none;
    text-align: left;
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    border-radius: var(--radius-md);
    padding: 9px 12px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
  }
  .pager-next {
    text-align: right;
    align-items: flex-end;
  }
  .pager-dir {
    font-size: var(--fs-11);
    font-weight: 700;
    color: var(--ink-2);
  }
  .pager-name {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }

  .float-top-btn {
    position: fixed;
    right: 16px;
    bottom: calc(var(--nav-h) + 20px + env(safe-area-inset-bottom, 0px));
    z-index: 50;
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 7px 13px;
    border-radius: 999px;
    box-shadow: var(--shadow-card);
    cursor: pointer;
  }
</style>
