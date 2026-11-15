<script>
  let {
    title = '',
    desc = '',
    badge = '',
    clickable = false,
    selected = false,
    onclick = null,
    children,
    ...rest
  } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="dsh-row {clickable ? 'clickable' : ''} {selected ? 'selected' : ''}"
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
  onclick={onclick}
  onkeydown={(e) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      onclick?.(e);
    }
  }}
  {...rest}
>
  <div class="row-main">
    <div class="row-title-row">
      <span class="row-title">{title}</span>
      {#if badge}
        <span class="row-badge">{badge}</span>
      {/if}
    </div>
    {#if desc}
      <div class="row-desc">{desc}</div>
    {/if}
  </div>

  <div class="row-end">
    {@render children?.()}
  </div>
</div>

<style>
  .dsh-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 10px 14px;
    background: var(--paper-card);
    border-radius: var(--radius-sm, 12px);
    border: var(--edge-soft, 1px solid var(--border-soft));
    box-shadow: var(--shadow);
    margin-bottom: 8px;
    transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
  }

  .clickable {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .clickable:active {
    background: var(--paper-3);
    transform: scale(0.99);
  }

  .selected {
    background: var(--rose-wash);
    border-color: var(--rose);
  }

  .row-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .row-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .row-title {
    font-family: var(--font-title);
    font-size: var(--fs-14, 14px);
    font-weight: 600;
    color: var(--ink-1);
    letter-spacing: 0.01em;
  }

  .row-badge {
    font-size: var(--fs-10, 10px);
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--paper-3);
    color: var(--ink-2);
  }

  .row-desc {
    margin-top: 2px;
    font-size: var(--fs-11, 11px);
    color: var(--ink-3);
    line-height: 1.4;
  }

  .row-end {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
    flex-shrink: 0;
  }
</style>
