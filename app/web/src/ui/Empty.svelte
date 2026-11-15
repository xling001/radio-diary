<script>
  let {
    icon = '',
    title = '暂无记录',
    desc = '今天还没有练习过，录一段声音试试吧。',
    actionText = '',
    onaction = null,
    children,
    ...rest
  } = $props();
</script>

<div class="dsh-empty" {...rest}>
  <div class="empty-icon" aria-hidden="true">
    {#if icon}
      {icon}
    {:else}
      <svg class="empty-emblem" width="52" height="52" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="24" fill="var(--crayon-coral-soft)" />
        <circle cx="33" cy="24" r="14" fill="var(--crayon-mint-soft)" />
        <path d="M14 29c3 0 4.2-8 6.8-8s3.8 14 6.8 14 4.2-16 7.2-16 3.6 10 7.2 10" stroke="var(--crayon-coral)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </div>
  <div class="empty-title">{title}</div>
  {#if desc}
    <p class="empty-desc">{desc}</p>
  {/if}

  {#if actionText}
    <button class="empty-action-btn" type="button" onclick={onaction}>
      {actionText}
    </button>
  {/if}

  {@render children?.()}
</div>

<style>
  .dsh-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 16px;
    text-align: center;
    box-sizing: border-box;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    filter: drop-shadow(0 2px 4px rgba(138, 91, 99, 0.15));
  }

  .empty-title {
    font-family: var(--font-title);
    font-size: var(--fs-16, 16px);
    font-weight: 600;
    color: var(--ink-1);
    letter-spacing: 0.02em;
    margin-bottom: 6px;
  }

  .empty-desc {
    margin: 0;
    font-size: var(--fs-12, 12px);
    color: var(--ink-3);
    line-height: 1.6;
    max-width: 260px;
  }

  .empty-action-btn {
    margin-top: 16px;
    min-height: 44px;
    padding: 0 20px;
    border-radius: 999px;
    background: var(--rose-soft);
    color: var(--rose-deep);
    box-shadow: var(--shadow);
    font-size: var(--fs-13, 13px);
    font-weight: 600;
    border: none;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .empty-action-btn:active {
    transform: scale(0.96);
  }
</style>
